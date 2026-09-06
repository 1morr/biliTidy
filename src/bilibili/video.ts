import type { SeasonInfo, VideoBasic, VideoDetail } from '@/shared/types';
import { biliFetch } from './http';
import { zoneName } from './tid';

interface EpisodeRaw {
  bvid: string;
  title: string;
}

interface UgcSeasonRaw {
  id: number;
  title: string;
  intro?: string;
  ep_count: number;
  sections?: { title: string; episodes?: EpisodeRaw[] }[];
}

interface ViewRaw {
  bvid: string;
  cid?: number;
  tid: number;
  tname?: string;
  dynamic?: string;
  ugc_season?: UgcSeasonRaw;
  staff?: { name: string; title: string }[];
  pages?: { part: string }[];
  // 以下是影片頁「智慧收藏」用得到的欄位；整理流程從 resource/list 就拿得到，不需要它們
  aid?: number;
  title?: string;
  desc?: string;
  pic?: string;
  duration?: number;
  pubdate?: number;
  owner?: { mid: number; name: string };
}

interface ViewDetailRaw {
  View: ViewRaw;
  Tags: { tag_name: string }[] | null;
}

export const MAX_SIBLING_TITLES = 8;
export const MAX_PAGE_TITLES = 10;

export function toSeasonInfo(raw: UgcSeasonRaw, selfBvid: string): SeasonInfo {
  const siblings: string[] = [];
  for (const section of raw.sections ?? []) {
    for (const ep of section.episodes ?? []) {
      if (ep.bvid !== selfBvid && ep.title) siblings.push(ep.title);
      if (siblings.length >= MAX_SIBLING_TITLES) break;
    }
    if (siblings.length >= MAX_SIBLING_TITLES) break;
  }
  const info: SeasonInfo = { title: raw.title, epCount: raw.ep_count, siblingTitles: siblings };
  if (raw.intro?.trim()) info.intro = raw.intro.trim();
  return info;
}

export function toVideoDetail(raw: ViewDetailRaw, now = Date.now()): VideoDetail {
  const v = raw.View;
  const detail: VideoDetail = {
    bvid: v.bvid,
    fetchedAt: now,
    schema: 1,
    tags: (raw.Tags ?? []).map((t) => t.tag_name).filter(Boolean),
    // tid 只用來查分區名稱，查完就不需要留著了
    zone: v.tname?.trim() || zoneName(v.tid) || '',
  };
  if (typeof v.cid === 'number') detail.cid = v.cid;
  if (v.dynamic?.trim()) detail.dynamic = v.dynamic.trim();
  if (v.ugc_season) detail.season = toSeasonInfo(v.ugc_season, v.bvid);
  if (v.staff && v.staff.length > 0) detail.staff = v.staff.map((s) => `${s.name}（${s.title}）`);
  if (v.pages && v.pages.length > 1) {
    detail.pageTitles = v.pages.slice(0, MAX_PAGE_TITLES).map((p) => p.part);
  }
  return detail;
}

/**
 * 一次取得 Tags + View（含 ugc_season、tid、dynamic、staff、pages）。
 * 實測：帶 cookie 才能用（匿名回 HTTP 412）；文檔標示需 WBI，故走 wbi 路徑並簽名。
 */
/** View 區塊也帶著標題、簡介、時長與 UP；影片頁沒有 resource/list 可用時靠它組 VideoBasic */
export function toVideoBasicFromView(raw: ViewDetailRaw): VideoBasic {
  const v = raw.View;
  return {
    bvid: v.bvid,
    aid: v.aid ?? 0,
    type: 2,
    title: v.title ?? '',
    cover: v.pic ?? '',
    intro: v.desc ?? '',
    duration: v.duration ?? 0,
    pageCount: v.pages?.length ?? 1,
    upperName: v.owner?.name ?? '',
    invalid: false,
  };
}

/** 影片頁用：同一個請求同時取出 basic 與 detail */
export async function fetchVideoPage(bvid: string, signal?: AbortSignal): Promise<{ basic: VideoBasic; detail: VideoDetail }> {
  const raw = await biliFetch<ViewDetailRaw>('/x/web-interface/wbi/view/detail', {
    query: { bvid },
    wbi: true,
    signal,
  });
  return { basic: toVideoBasicFromView(raw), detail: toVideoDetail(raw) };
}

export async function fetchVideoDetail(bvid: string, signal?: AbortSignal): Promise<VideoDetail> {
  const raw = await biliFetch<ViewDetailRaw>('/x/web-interface/wbi/view/detail', {
    query: { bvid },
    wbi: true,
    signal,
  });
  return toVideoDetail(raw);
}
