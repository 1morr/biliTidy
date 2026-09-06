import { fetchCoverDataUrl } from '@/bilibili/cover';
import type { PromptFolder, PromptVideo } from '@/ai/prompt';
import { t } from '@/i18n';
import type { RetryOptions } from '@/net/backoff';
import { withRetry } from '@/net/backoff';
import { throwIfAborted } from '@/net/sleep';
import { chunk } from '@/shared/array';
import { isAbortError } from '@/shared/result';
import type {
  ClassificationItem,
  FolderMeta,
  JobPhase,
  Progress,
  ReviewRow,
  Settings,
  VideoBasic,
  VideoDetail,
} from '@/shared/types';
import { DAY_MS, getCachedCover, putCover } from './cache';
import { classify, type ClassifyRecord } from './classify';
import { fetchDetails } from './fetchDetails';
import { fetchFolderVideos } from './fetchList';
import { planOf } from './plan';
import { cdnThrottle } from './scheduler';
import { COVER_TTL_DAYS, DETAIL_TTL_DAYS } from './settings';

export interface OrganizeInput {
  mid: number;
  source: FolderMeta;
  /** 來源收藏夾的描述（使用者填的收錄標準）；一起送進 prompt，讓模型知道「留在原地」代表什麼 */
  sourceDescription: string;
  targets: PromptFolder[];
  settings: Settings;
  /** 只整理最近收藏的前 N 支；undefined = 整個收藏夾 */
  limit?: number;
}

/** 一次 AI 呼叫的完整往返；除錯視窗用，只放在記憶體不寫進快照 */
export type BatchRecord = ClassifyRecord & { id: string; label: string };

export interface OrganizeCallbacks {
  signal?: AbortSignal;
  /** 每完成一批分類就回報一次（含送出的 prompt 與模型原始回覆） */
  onBatch?: (record: BatchRecord) => void;
  onPhase?: (phase: JobPhase, progress?: Progress) => void;
  onProgress?: (progress: Progress) => void;
  onWait?: RetryOptions['onWait'];
}

export interface OrganizeResult {
  rows: ReviewRow[];
  stats: { fetched: number; cached: number; aiCalls: number; parseErrors: number; detailFailed: number };
}

export { COVER_TTL_DAYS } from './settings';

async function classifyAll(
  videos: PromptVideo[],
  input: OrganizeInput,
  cb: OrganizeCallbacks,
  stats: OrganizeResult['stats'],
  label: string,
): Promise<Map<string, ClassificationItem>> {
  const { settings, targets } = input;
  const source: PromptFolder = { id: input.source.id, title: input.source.title, description: input.sourceDescription };
  const batches = chunk(videos, planOf(settings).batchSize);
  const results = new Map<string, ClassificationItem>();
  const onBatch = cb.onBatch;
  for (const [i, batch] of batches.entries()) {
    throwIfAborted(cb.signal);
    cb.onProgress?.({ done: i, total: batches.length, label: t().progress.classifyBatch(label, i + 1, batches.length) });
    const id = `${label}-${i + 1}`;
    const batchLabel = t().progress.classifyBatch(label, i + 1, batches.length);
    const { items, parseError } = await classify(
      settings.ai,
      { source, folders: targets, videos: batch },
      {
        ...(cb.signal ? { signal: cb.signal } : {}),
        ...(cb.onWait ? { onWait: cb.onWait } : {}),
        ...(onBatch ? { onRecord: (record: ClassifyRecord) => onBatch({ ...record, id, label: batchLabel }) } : {}),
      },
    );
    stats.aiCalls++;
    if (parseError) stats.parseErrors++;
    for (const item of items) results.set(item.bvid, item);
  }
  cb.onProgress?.({ done: batches.length, total: batches.length, label: t().progress.classifyDone(label) });
  return results;
}

async function attachCovers(videos: PromptVideo[], cb: OrganizeCallbacks): Promise<void> {
  const total = videos.length;
  for (const [i, v] of videos.entries()) {
    throwIfAborted(cb.signal);
    cb.onProgress?.({ done: i, total, label: t().progress.coverProgress(i + 1, total) });
    const cached = await getCachedCover(v.basic.bvid, COVER_TTL_DAYS * DAY_MS);
    if (cached) {
      v.coverDataUrl = cached;
      continue;
    }
    await cdnThrottle.acquire(cb.signal);
    try {
      const dataUrl = await withRetry(() => fetchCoverDataUrl(v.basic.cover, cb.signal), { signal: cb.signal });
      await putCover(v.basic.bvid, dataUrl);
      v.coverDataUrl = dataUrl;
    } catch (e) {
      if (isAbortError(e)) throw e;
      // 封面抓不到就退回純文字，不阻斷流程
    }
  }
}

/**
 * 分類結果 → 審核列。低信心（模型自己說在猜）的建議照樣顯示，但**不預先勾選**：
 * 搬移不可逆，不該讓「直接按執行搬移」把猜測也搬走。要採用就按「全部採用建議」或逐列點。
 */
export function toRow(basic: VideoBasic, detail: VideoDetail | undefined, item: ClassificationItem | undefined): ReviewRow {
  const suggested = item?.targetFolderIds ?? [];
  const row: ReviewRow = {
    bvid: basic.bvid,
    aid: basic.aid,
    type: basic.type,
    title: basic.title,
    cover: basic.cover,
    suggested,
    chosen: item?.lowConfidence ? [] : suggested,
    reason: item?.reason ?? (basic.invalid ? t().progress.stale : t().progress.staysInPlace),
    status: 'pending',
  };
  if (item?.keepSource) {
    row.suggestedKeep = true;
    if (!item.lowConfidence) row.keepSource = true;
  }
  if (item?.basis?.length) row.basis = item.basis;
  if (item?.lowConfidence) row.lowConfidence = true;
  if (basic.invalid) row.invalid = true;
  if (detail?.season) row.seasonTitle = detail.season.title;
  return row;
}

/** 取資料 → 組 prompt → 分類，回傳審核列。不執行移動。 */
export async function runOrganize(input: OrganizeInput, cb: OrganizeCallbacks = {}): Promise<OrganizeResult> {
  const { settings, source } = input;
  const plan = planOf(settings);
  const stats: OrganizeResult['stats'] = { fetched: 0, cached: 0, aiCalls: 0, parseErrors: 0, detailFailed: 0 };

  cb.onPhase?.('fetchingList');
  const basics = await fetchFolderVideos(source.id, source.mediaCount, {
    ...(input.limit ? { limit: input.limit } : {}),
    signal: cb.signal,
    onProgress: cb.onProgress,
    onWait: cb.onWait,
  });
  const candidates = basics.filter((b) => !b.invalid);
  const details = new Map<string, VideoDetail>();

  if (plan.withDetail) {
    cb.onPhase?.('fetchingDetail');
    const r = await fetchDetails(candidates, {
      ttlDays: DETAIL_TTL_DAYS,
      subtitles: plan.withSubtitle,
      signal: cb.signal,
      onProgress: cb.onProgress,
      onWait: cb.onWait,
    });
    for (const [k, v] of r.details) details.set(k, v);
    stats.fetched += r.stats.fetched;
    stats.cached += r.stats.cached;
    // 抓不到詳情的影片照樣送去分類，但要讓使用者看得到有幾支是「線索比較少」的
    stats.detailFailed += r.failed.size;
  }

  const promptVideos: PromptVideo[] = candidates.map((basic) => {
    const pv: PromptVideo = { basic };
    const d = details.get(basic.bvid);
    if (d) pv.detail = d;
    return pv;
  });

  if (plan.withCover && promptVideos.length > 0) {
    cb.onPhase?.('fetchingCovers');
    await attachCovers(promptVideos, cb);
  }

  cb.onPhase?.('classifying');
  const results = await classifyAll(promptVideos, input, cb, stats, t().progress.classify);

  const rows = basics.map((b) => toRow(b, details.get(b.bvid), results.get(b.bvid)));
  cb.onPhase?.('review');
  return { rows, stats };
}
