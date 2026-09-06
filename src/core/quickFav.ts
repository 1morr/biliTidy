import { QUICK_FAV_MAX_TARGETS, type PromptFolder, type PromptVideo } from '@/ai/prompt';
import { fetchCoverDataUrl } from '@/bilibili/cover';
import { dealFavorite, listCreatedFolders, listFoldersWithFavState } from '@/bilibili/fav';
import { getMid } from '@/bilibili/http';
import { fetchSubtitleText } from '@/bilibili/subtitle';
import { fetchVideoPage } from '@/bilibili/video';
import { t } from '@/i18n';
import { withRetry } from '@/net/backoff';
import { AppError } from '@/shared/result';
import { DAY_MS, getCachedCover, putCover, putDetail } from './cache';
import { classify } from './classify';
import { effectiveDescription, loadDescriptions } from './folderStore';
import { planOf } from './plan';
import { cdnThrottle, JOB_LOCK_NAME, readThrottle, writeQueue } from './scheduler';
import { COVER_TTL_DAYS, loadSettings } from './settings';

/**
 * SW 這裡有自己一份 `core/scheduler.ts` 單例，App 分頁的整理任務管不到它（`design.md` 8.1／6.4）：
 * 兩邊同時發送請求，打向 api.bilibili.com 的實際速率會直接翻倍。用 App 分頁任務期間持有的
 * 同一把 `bilitidy-job` Web Lock 排隊：有任務在跑就在這裡等，跑完才輪到「智慧收藏」，兩邊就不會
 * 同時發請求。沒有任務在跑（多數情況）時鎖是空的，幾乎立刻放行。
 * `navigator.locks` 不存在時（理論上目前支援的 Chrome 版本都有）就直接執行，不讓這裡變成新的失敗點。
 */
function queueBehindJob<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!navigator.locks) return fn();
  return navigator.locks.request(JOB_LOCK_NAME, signal ? { signal } : {}, fn);
}

export interface QuickFavFolder {
  id: number;
  title: string;
  /** 這支影片已經在這個收藏夾裡 */
  favState: boolean;
  /** 收藏夾封面；list-all 不帶這個欄位，靠 created/list 補（拿不到就沒有縮圖） */
  cover?: string;
}

export interface QuickFavSuggestion {
  bvid: string;
  aid: number;
  title: string;
  /** 全部收藏夾，讓 UI 可以「改成…」 */
  folders: QuickFavFolder[];
  /** AI 建議收進哪些（已排除影片本來就在的） */
  suggested: number[];
  reason: string;
  basis?: string[];
  lowConfidence?: boolean;
  alreadyIn: number[];
}

/**
 * 封面縮圖（與整理流程共用同一份快取）；抓不到就退回純文字，不要因為一張圖讓收藏失敗。
 * 刻意**不包** withRetry：這是 best-effort 的補充資料，而不是非成功不可的請求
 * （`fetchVideoPage` 與 `listFoldersWithFavState` 那兩支才有）。一次風控如果在這裡退避，
 * toast 卡片會卡上 60+120+240 秒，而卡片上沒有取消按鈕。字幕同理。
 */
async function coverDataUrl(bvid: string, cover: string, signal?: AbortSignal): Promise<string | undefined> {
  const cached = await getCachedCover(bvid, COVER_TTL_DAYS * DAY_MS).catch(() => undefined);
  if (cached) return cached;
  try {
    await cdnThrottle.acquire(signal);
    const dataUrl = await fetchCoverDataUrl(cover, signal);
    await putCover(bvid, dataUrl).catch(() => undefined);
    return dataUrl;
  } catch {
    return undefined;
  }
}

/** 字幕（抓不到就算了，一支影片的字幕不值得讓整次收藏失敗）；設定關閉時根本不會走到這裡 */
async function attachSubtitle(video: PromptVideo, cid: number, signal?: AbortSignal): Promise<void> {
  try {
    await readThrottle.acquire(signal);
    const sub = await fetchSubtitleText(video.basic.aid, cid, signal);
    if (video.detail) {
      video.detail.subtitleText = sub.text;
      if (sub.from) video.detail.subtitleFrom = sub.from;
    }
  } catch {
    // 沒有字幕、或播放器介面失敗，都退回沒有字幕
  }
}

/**
 * 影片頁「智慧收藏」：問一次 view/detail 與一次 folder/created/list-all，交給模型挑收藏夾。
 * 只給建議、不寫入——寫入由 applyFavorite 做，讓 UI 有機會在低信心時先讓使用者確認。
 * 對外一律經 `queueBehindJob`：有整理任務在跑就先排隊，見上面的說明。
 */
export function suggestFavorite(bvid: string, signal?: AbortSignal): Promise<QuickFavSuggestion> {
  return queueBehindJob(() => doSuggestFavorite(bvid, signal), signal);
}

async function doSuggestFavorite(bvid: string, signal?: AbortSignal): Promise<QuickFavSuggestion> {
  const settings = await loadSettings();
  const plan = planOf(settings);
  if (!plan.aiReady) {
    throw new AppError('api', t().quickFav.noAiEndpoint, { retryable: false });
  }

  await readThrottle.acquire(signal);
  const { basic, detail } = await withRetry(() => fetchVideoPage(bvid, signal), { ...(signal ? { signal } : {}) });

  const mid = await getMid();
  await readThrottle.acquire(signal);
  const folders = await withRetry(() => listFoldersWithFavState(mid, basic.aid, signal), { ...(signal ? { signal } : {}) });
  if (folders.length === 0) throw new AppError('api', t().quickFav.noFolders, { retryable: false });

  // 封面只有 created/list 帶得回來（list-all 的欄位裡沒有 cover），與 AI 的往返平行去拿：
  // 模型那趟實測約 1.2 秒，這個請求的時間被它吸收掉，不會多讓使用者等。拿不到就只是沒有縮圖。
  const coversPromise = readThrottle
    .acquire(signal)
    .then(() => listCreatedFolders(mid, signal))
    .then((metas) => new Map(metas.map((m) => [m.id, m.cover])))
    .catch(() => new Map<number, string | undefined>());

  const descriptions = await loadDescriptions();
  const promptFolders: PromptFolder[] = folders.map((f) => ({
    id: f.id,
    title: f.title,
    description: effectiveDescription(f, descriptions),
  }));

  // 資料來源三個開關與整理流程共用同一份 planOf，影片頁不再有自己的規則
  // （詳情是唯一的例外：view/detail 一次就回基本資訊與詳情，這裡不抓就什麼都沒有）。
  const video: PromptVideo = { basic, detail };
  if (plan.withSubtitle && detail.cid !== undefined) {
    await attachSubtitle(video, detail.cid, signal);
  }
  if (plan.withCover && basic.cover) {
    const cover = await coverDataUrl(basic.bvid, basic.cover, signal);
    if (cover) video.coverDataUrl = cover;
  }
  // 詳情連同剛抓到的字幕一起寫進快取，之後整理整個收藏夾時就不用再打一次。
  // 一定要等 attachSubtitle 之後才存：先存的話字幕那 2 次請求等於白打，下次還要再抓一遍。
  await putDetail(detail).catch(() => undefined);

  const { items } = await classify(
    settings.ai,
    { folders: promptFolders, videos: [video], maxTargets: QUICK_FAV_MAX_TARGETS },
    signal ? { signal } : {},
  );
  const item = items[0] ?? {
    bvid: basic.bvid,
    targetFolderIds: [],
    reason: t().errors.ai.couldNotParseReply,
    lowConfidence: true,
  };
  const covers = await coversPromise;
  const alreadyIn = folders.filter((f) => f.favState).map((f) => f.id);
  const suggestion: QuickFavSuggestion = {
    bvid: basic.bvid,
    aid: basic.aid,
    title: basic.title,
    folders: folders.map((f) => {
      const folder: QuickFavFolder = { id: f.id, title: f.title, favState: f.favState };
      const cover = covers.get(f.id);
      if (cover) folder.cover = cover;
      return folder;
    }),
    suggested: item.targetFolderIds.filter((id) => !alreadyIn.includes(id)),
    reason: item.reason,
    alreadyIn,
  };
  if (item.basis?.length) suggestion.basis = item.basis;
  if (item.lowConfidence) suggestion.lowConfidence = true;
  return suggestion;
}

/**
 * 實際寫入：走與搬移同一條 writeQueue 與退避，避免和整理任務同時打出寫入請求；
 * 對外一律經 `queueBehindJob`，理由同 `suggestFavorite`。
 */
export function applyFavorite(aid: number, addIds: number[], delIds: number[] = []): Promise<void> {
  return queueBehindJob(() => doApplyFavorite(aid, addIds, delIds));
}

async function doApplyFavorite(aid: number, addIds: number[], delIds: number[]): Promise<void> {
  if (addIds.length === 0 && delIds.length === 0) return;
  await writeQueue.run(() => withRetry(() => dealFavorite(aid, addIds, delIds)));
}
