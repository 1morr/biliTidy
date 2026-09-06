import type { FollowRow } from '@/shared/types';

/**
 * 關注審核表的時間軸：每一列是「最新一支投稿 → 今天」的安靜期，門檻是一條貫穿所有列的播放頭。
 * 這裡只算座標（純函式），畫在 `FollowReviewTable.tsx`。時間一律用 Unix 秒，與 B 站的 pubdate 一致。
 */

const DAY = 86_400;
const YEAR = 365 * DAY;
/** 軸至少涵蓋這麼久：門檻 365／730 天要看得到、播放頭不能貼在左邊緣 */
const MIN_SPAN_YEARS = 3;
/** 門檻之外再留一點餘裕，播放頭左邊還看得到「更早」 */
const THRESHOLD_MARGIN_DAYS = 90;

export interface TimelineAxis {
  /** 軸的左端（某一年的 1 月 1 日 UTC） */
  start: number;
  /** 軸的右端＝現在 */
  end: number;
  /** 年份刻度 */
  ticks: { at: number; label: string }[];
}

function yearStart(year: number): number {
  return Date.UTC(year, 0, 1) / 1000;
}

/**
 * 依顯示中的列決定軸的範圍：左端是「最舊的一支投稿」與「門檻再往前一點」兩者較早的那個，
 * 再往前推到那一年的 1 月 1 日；右端是現在。刻度最多 `maxTicks` 個，放不下就每 2／5／10 年一格。
 */
export function timelineAxis(rows: FollowRow[], thresholdDays: number, nowMs = Date.now(), maxTicks = 10): TimelineAxis {
  const end = Math.floor(nowMs / 1000);
  let oldest = end;
  for (const r of rows) {
    const pub = r.activity?.status === 'videos' ? r.activity.latest?.pubdate : undefined;
    if (pub && pub > 0 && pub < oldest) oldest = pub;
  }
  const minSpan = Math.max(MIN_SPAN_YEARS * YEAR, (thresholdDays + THRESHOLD_MARGIN_DAYS) * DAY);
  const candidate = Math.min(oldest, end - minSpan);
  const firstYear = new Date(candidate * 1000).getUTCFullYear();
  const lastYear = new Date(end * 1000).getUTCFullYear();
  const start = yearStart(firstYear);
  const years = lastYear - firstYear + 1;
  // 刻度間隔取 1／2／5／10／20 年裡最小、又放得進 maxTicks 格的那個（maxTicks 由實際欄寬換算，窄欄少幾個年份）
  const step = [1, 2, 5, 10, 20].find((s) => Math.ceil(years / s) <= Math.max(2, maxTicks)) ?? 20;
  const ticks: TimelineAxis['ticks'] = [];
  for (let y = firstYear; y <= lastYear; y += step) ticks.push({ at: yearStart(y), label: String(y) });
  return { start, end, ticks };
}

/** 某個時間點在軸上的位置（0 = 左端、1 = 右端），超出範圍就夾住 */
export function positionOf(at: number, axis: TimelineAxis): number {
  const span = axis.end - axis.start;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (at - axis.start) / span));
}

/** 門檻（N 天前）在軸上的位置 */
export function thresholdPosition(thresholdDays: number, axis: TimelineAxis): number {
  return positionOf(axis.end - thresholdDays * DAY, axis);
}

/** 整條軸有幾天：拖播放頭時的 range 上限 */
export function axisDays(axis: TimelineAxis): number {
  return Math.max(1, Math.round((axis.end - axis.start) / DAY));
}
