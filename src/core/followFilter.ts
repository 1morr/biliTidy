import type { FollowTag, FollowRow } from '@/shared/types';
import { canSelect, daysInactive, hasGroup, isInactive } from './activity';

/**
 * 審核表的分面、篩選、排序。分面畫在左軌、表格在中間，兩邊要用同一份定義，
 * 所以「怎麼算、怎麼篩」全部是這裡的純函式。計數採一般分面搜尋的慣例：
 * 每一組分面的數字反映「其他分面已經套用之後」還剩多少，選了才不會是 0。
 */

export type StatusFacet = 'all' | 'inactive' | 'active' | 'noVideos' | 'unknown' | 'done' | 'restored' | 'failed';
export type KindFacet = 'any' | 'whisper' | 'special' | 'mutual';
/** `'none'`＝默认分组（沒有任何分組）；數字＝該分組 id（-10 特別關注也是一個） */
export type GroupFacet = 'any' | 'none' | number;

export interface ReviewFilter {
  status: StatusFacet;
  kind: KindFacet;
  group: GroupFacet;
  query: string;
}

export const DEFAULT_FILTER: ReviewFilter = { status: 'inactive', kind: 'any', group: 'any', query: '' };

export type SortKey = 'days' | 'name' | 'followed' | 'group';
export interface SortSpec {
  key: SortKey;
  dir: 'asc' | 'desc';
}
export const DEFAULT_SORT: SortSpec = { key: 'days', dir: 'desc' };

export const STATUS_FACETS: StatusFacet[] = ['all', 'inactive', 'active', 'noVideos', 'unknown', 'done', 'restored', 'failed'];

export function matchStatus(row: FollowRow, facet: StatusFacet, thresholdDays: number, now: number): boolean {
  const a = row.activity;
  switch (facet) {
    case 'all':
      return true;
    case 'inactive':
      return canSelect(row) && isInactive(a, thresholdDays, now);
    case 'active':
      return canSelect(row) && !isInactive(a, thresholdDays, now);
    case 'noVideos':
      return row.status === 'pending' && a?.status === 'noVideos';
    case 'unknown':
      return row.status === 'pending' && (a === undefined || a.status === 'unknown');
    case 'done':
      return row.status === 'done' || row.status === 'unfollowing';
    case 'restored':
      return row.status === 'restored' || row.status === 'restoring';
    case 'failed':
      return row.status === 'failed' || row.status === 'restoreFailed';
  }
}

export function matchKind(row: FollowRow, facet: KindFacet): boolean {
  switch (facet) {
    case 'any':
      return true;
    case 'whisper':
      return row.entry.kind === 'whisper';
    case 'mutual':
      return row.entry.kind === 'mutual';
    case 'special':
      return row.entry.special;
  }
}

export function matchGroup(row: FollowRow, facet: GroupFacet): boolean {
  if (facet === 'any') return true;
  if (facet === 'none') return !hasGroup(row.entry);
  if (facet === -10) return row.entry.special || row.entry.tagIds.includes(-10);
  return row.entry.tagIds.includes(facet);
}

export function matchQuery(row: FollowRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return row.entry.name.toLowerCase().includes(q) || String(row.entry.mid) === q;
}

export function filterRows(
  rows: readonly FollowRow[],
  filter: ReviewFilter,
  thresholdDays: number,
  now = Date.now(),
): FollowRow[] {
  return rows.filter(
    (r) =>
      matchStatus(r, filter.status, thresholdDays, now) &&
      matchKind(r, filter.kind) &&
      matchGroup(r, filter.group) &&
      matchQuery(r, filter.query),
  );
}

/** 狀態分面的計數：套用了關注類型、分組、搜尋之後 */
export function countStatus(
  rows: readonly FollowRow[],
  filter: ReviewFilter,
  thresholdDays: number,
  now = Date.now(),
): Record<StatusFacet, number> {
  const counts = Object.fromEntries(STATUS_FACETS.map((f) => [f, 0])) as Record<StatusFacet, number>;
  for (const r of rows) {
    if (!matchKind(r, filter.kind) || !matchGroup(r, filter.group) || !matchQuery(r, filter.query)) continue;
    for (const f of STATUS_FACETS) if (matchStatus(r, f, thresholdDays, now)) counts[f]++;
  }
  return counts;
}

/** 關注類型分面的計數：套用了狀態、分組、搜尋之後 */
export function countKinds(
  rows: readonly FollowRow[],
  filter: ReviewFilter,
  thresholdDays: number,
  now = Date.now(),
): Record<KindFacet, number> {
  const counts: Record<KindFacet, number> = { any: 0, whisper: 0, special: 0, mutual: 0 };
  for (const r of rows) {
    if (!matchStatus(r, filter.status, thresholdDays, now) || !matchGroup(r, filter.group) || !matchQuery(r, filter.query))
      continue;
    counts.any++;
    if (matchKind(r, 'whisper')) counts.whisper++;
    if (matchKind(r, 'special')) counts.special++;
    if (matchKind(r, 'mutual')) counts.mutual++;
  }
  return counts;
}

/** 分組分面的計數（含「沒有分組」）：套用了狀態、關注類型、搜尋之後 */
export function countGroups(
  rows: readonly FollowRow[],
  tags: readonly FollowTag[],
  filter: ReviewFilter,
  thresholdDays: number,
  now = Date.now(),
): Map<GroupFacet, number> {
  const counts = new Map<GroupFacet, number>([['none', 0], ...tags.map((t) => [t.id, 0] as [GroupFacet, number])]);
  for (const r of rows) {
    if (!matchStatus(r, filter.status, thresholdDays, now) || !matchKind(r, filter.kind) || !matchQuery(r, filter.query))
      continue;
    for (const key of counts.keys()) {
      if (key !== 'any' && matchGroup(r, key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * 排序。天數欄的三個特殊值要排得有意義：確認無影片（Infinity）在「最不活躍」那一端，
 * 未知（null）永遠排在最後——不管升冪降冪，查不到的都不該混進可以動手的那一段。
 */
export function sortRows(
  rows: readonly FollowRow[],
  sort: SortSpec,
  tagNameOf: (id: number) => string | undefined,
  now = Date.now(),
): FollowRow[] {
  const dir = sort.dir === 'asc' ? 1 : -1;
  const groupLabel = (r: FollowRow) =>
    [...(r.entry.special ? [tagNameOf(-10) ?? ''] : []), ...r.entry.tagIds.map((id) => tagNameOf(id) ?? '')].join(' ');
  return [...rows].sort((a, b) => {
    if (sort.key === 'days') {
      const da = daysInactive(a.activity, now);
      const db = daysInactive(b.activity, now);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return (da - db) * dir || a.entry.name.localeCompare(b.entry.name);
    }
    if (sort.key === 'followed') return (a.entry.followedAt - b.entry.followedAt) * dir;
    if (sort.key === 'group') return groupLabel(a).localeCompare(groupLabel(b)) * dir || a.entry.name.localeCompare(b.entry.name);
    return a.entry.name.localeCompare(b.entry.name) * dir;
  });
}
