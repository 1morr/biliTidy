import type { FolderMeta, VideoBasic } from '@/shared/types';
import { biliFetch } from './http';

/** 實測 ps 上限 40（50/100 回 -400） */
export const FAV_PAGE_SIZE = 40;

/**
 * 一頁實際回幾支。B 站會在同一個 offset 區間裡濾掉一部分內容，所以 `ps=40` **不保證回滿 40 支**
 * ——實測同一個收藏夾第 1 頁 25 支、第 2 頁 39 支、第 3 頁 40 支，`has_more` 都是 true
 * （`ps=20` 的第 1、2 頁合起來剛好等於 `ps=40` 的第 1 頁，代表 offset 仍是 `(pn-1)*ps`，逐頁抓不會漏）。
 * 估算頁數與進度條總頁數用這個保守值，不要用 FAV_PAGE_SIZE，否則會低估。
 */
export const FAV_PAGE_YIELD = 30;

interface FolderRaw {
  id: number;
  fid: number;
  mid: number;
  attr: number;
  title: string;
  media_count: number;
  intro?: string;
  cover?: string;
}

function toFolderMeta(f: FolderRaw): FolderMeta {
  const meta: FolderMeta = {
    id: f.id,
    title: f.title,
    mediaCount: f.media_count,
    attr: f.attr,
    isPrivate: (f.attr & 1) === 1,
    isDefault: (f.attr & 2) === 0,
  };
  if (f.intro !== undefined) meta.intro = f.intro;
  if (f.cover) meta.cover = f.cover;
  return meta;
}

/** created/list 每頁上限（實測 39 個收藏夾以 ps=100 一次回完） */
export const FOLDER_PAGE_SIZE = 100;

/**
 * 建立的收藏夾清單。用 created/list（分頁）而不是 created/list-all：
 * 實測前者同時回傳 cover 與 intro，一個請求就夠做縮圖與「一鍵匯入描述」。
 */
export async function listCreatedFolders(mid: number, signal?: AbortSignal): Promise<FolderMeta[]> {
  const folders: FolderMeta[] = [];
  for (let pn = 1; ; pn++) {
    const data = await biliFetch<{ list: FolderRaw[] | null; has_more?: boolean }>('/x/v3/fav/folder/created/list', {
      query: { up_mid: mid, ps: FOLDER_PAGE_SIZE, pn, platform: 'web' },
      signal,
    });
    const list = data.list ?? [];
    folders.push(...list.map(toFolderMeta));
    if (!data.has_more || list.length === 0) break;
  }
  return folders;
}

export interface FolderInfo extends FolderMeta {
  intro: string;
  cover: string;
}

function toFolderInfo(f: FolderRaw): FolderInfo {
  return { ...toFolderMeta(f), intro: f.intro ?? '', cover: f.cover ?? '' };
}

interface MediaRaw {
  id: number;
  type: number;
  title: string;
  cover: string;
  intro: string;
  page: number;
  duration: number;
  upper: { mid: number; name: string };
  attr: number;
  cnt_info?: { play?: number };
  pubtime: number;
  fav_time: number;
  bvid: string;
}

function toVideoBasic(m: MediaRaw): VideoBasic {
  return {
    bvid: m.bvid,
    aid: m.id,
    type: m.type,
    title: m.title,
    cover: m.cover,
    intro: m.intro ?? '',
    duration: m.duration,
    pageCount: m.page ?? 1,
    upperName: m.upper?.name ?? '',
    invalid: m.attr !== 0,
  };
}

export interface ResourcePage {
  medias: VideoBasic[];
  hasMore: boolean;
  info: FolderInfo;
}

export interface ReadOptions {
  signal?: AbortSignal;
}

export async function listResources(mediaId: number, pn: number, opts: ReadOptions = {}): Promise<ResourcePage> {
  const data = await biliFetch<{ medias: MediaRaw[] | null; has_more: boolean; info: FolderRaw }>('/x/v3/fav/resource/list', {
    query: { media_id: mediaId, ps: FAV_PAGE_SIZE, pn, platform: 'web' },
    signal: opts.signal,
  });
  return {
    medias: (data.medias ?? []).map(toVideoBasic),
    hasMore: data.has_more,
    info: toFolderInfo(data.info),
  };
}

interface FolderStateRaw extends FolderRaw {
  fav_state: number;
}

export interface FolderFavState extends FolderMeta {
  /** 這支影片已經在這個收藏夾裡 */
  favState: boolean;
}

/**
 * 一次拿到「所有收藏夾 ＋ 這支影片在不在裡面」（影片頁的原生收藏彈窗用的就是這支）。
 * 與 created/list 的差別：這裡不回 cover／intro，但可以帶 rid 問 fav_state。
 * 實測 2026-08：37 個收藏夾一個請求回完，命中的夾 fav_state = 1。
 */
export async function listFoldersWithFavState(mid: number, aid: number, signal?: AbortSignal): Promise<FolderFavState[]> {
  const data = await biliFetch<{ count: number; list: FolderStateRaw[] | null }>('/x/v3/fav/folder/created/list-all', {
    query: { up_mid: mid, type: 2, rid: aid },
    signal,
  });
  return (data.list ?? []).map((f) => ({ ...toFolderMeta(f), favState: f.fav_state !== 0 }));
}

// ---- 寫入 ----

export interface FolderInput {
  title: string;
  intro?: string;
  /** true = 私密 */
  isPrivate: boolean;
}

/**
 * 把一支影片一次加進／移出多個收藏夾（影片頁收藏彈窗按「確定」時打的就是這支）。
 * 與 resource/copy｜move 不同：它不需要來源收藏夾，適合「還沒收藏過」的影片。
 * 成功與否只看 `code`（biliFetch 已經在 code !== 0 時丟錯）：回應裡的 `data.success_num`
 * 連成功加入時也是 0（bilibili-API-collect 的 video/action.md 就是這樣記的，該欄位作用不明），
 * 不能拿來判斷寫入結果。
 */
export async function dealFavorite(
  aid: number,
  addMediaIds: number[],
  delMediaIds: number[] = [],
  signal?: AbortSignal,
): Promise<void> {
  await biliFetch<unknown>('/x/v3/fav/resource/deal', {
    method: 'POST',
    form: {
      rid: aid,
      type: 2,
      ...(addMediaIds.length > 0 ? { add_media_ids: addMediaIds.join(',') } : {}),
      ...(delMediaIds.length > 0 ? { del_media_ids: delMediaIds.join(',') } : {}),
      platform: 'web',
    },
    signal,
  });
}

export async function addFolder(input: FolderInput, signal?: AbortSignal): Promise<FolderMeta> {
  const f = await biliFetch<FolderRaw>('/x/v3/fav/folder/add', {
    method: 'POST',
    form: { title: input.title, intro: input.intro ?? '', privacy: input.isPrivate ? 1 : 0 },
    signal,
  });
  return toFolderMeta(f);
}

/** edit 必須帶完整 title/intro/privacy，否則會被清空 */
export async function editFolder(
  mediaId: number,
  input: FolderInput & { cover?: string },
  signal?: AbortSignal,
): Promise<FolderMeta> {
  const f = await biliFetch<FolderRaw>('/x/v3/fav/folder/edit', {
    method: 'POST',
    form: {
      media_id: mediaId,
      title: input.title,
      intro: input.intro ?? '',
      privacy: input.isPrivate ? 1 : 0,
      cover: input.cover,
    },
    signal,
  });
  return toFolderMeta(f);
}

export interface ResourceRef {
  aid: number;
  type: number;
}

export interface TransferInput {
  srcMediaId: number;
  tarMediaId: number;
  mid: number;
  items: ResourceRef[];
}

function transferForm(input: TransferInput) {
  return {
    src_media_id: input.srcMediaId,
    tar_media_id: input.tarMediaId,
    mid: input.mid,
    resources: input.items.map((r) => `${r.aid}:${r.type}`).join(','),
    platform: 'web',
  };
}

export async function moveResources(input: TransferInput, signal?: AbortSignal): Promise<void> {
  await biliFetch<unknown>('/x/v3/fav/resource/move', {
    method: 'POST',
    form: transferForm(input),
    signal,
  });
}

/**
 * 從收藏夾移除內容（取消收藏）。用 batch-del 逐筆指定，而不是 resource/clean
 * （clean 會清掉整個收藏夾裡所有失效內容，數量與審核表顯示的不一致）。
 */
export async function removeResources(mediaId: number, items: ResourceRef[], signal?: AbortSignal): Promise<void> {
  await biliFetch<unknown>('/x/v3/fav/resource/batch-del', {
    method: 'POST',
    form: {
      media_id: mediaId,
      resources: items.map((r) => `${r.aid}:${r.type}`).join(','),
      platform: 'web',
    },
    signal,
  });
}

export async function copyResources(input: TransferInput, signal?: AbortSignal): Promise<void> {
  await biliFetch<unknown>('/x/v3/fav/resource/copy', {
    method: 'POST',
    form: transferForm(input),
    signal,
  });
}
