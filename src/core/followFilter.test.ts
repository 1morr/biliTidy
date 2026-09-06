import { describe, expect, it } from 'vitest';
import type { ActivityRecord, FollowEntry, FollowTag, FollowRow } from '@/shared/types';
import { classifyActivity, unknownActivity } from './activity';
import { DAY_MS } from './cache';
import { countGroups, countKinds, countStatus, DEFAULT_FILTER, filterRows, matchGroup, sortRows } from './followFilter';

const NOW = Date.UTC(2026, 8, 5);
const secAgo = (days: number) => Math.floor((NOW - days * DAY_MS) / 1000);
const videos = (mid: number, days: number): ActivityRecord =>
  classifyActivity(mid, { bvid: `BV${mid}`, title: `t${mid}`, pubdate: secAgo(days) }, NOW);

const entry = (mid: number, over: Partial<FollowEntry> = {}): FollowEntry => ({
  mid,
  name: `user${mid}`,
  face: '',
  sign: '',
  tagIds: [],
  special: false,
  kind: 'follow',
  followedAt: mid * 1000,
  verify: '',
  ...over,
});

const TAGS: FollowTag[] = [
  { id: -10, name: '特别关注', count: 1 },
  { id: 0, name: '默认分组', count: 3 },
  { id: 7, name: '遊戲', count: 2 },
];

const rows: FollowRow[] = [
  { entry: entry(1), status: 'pending', activity: videos(1, 800) }, // 不活躍、沒分組
  { entry: entry(2, { tagIds: [7] }), status: 'pending', activity: videos(2, 400) }, // 不活躍、遊戲
  { entry: entry(3, { special: true, kind: 'mutual' }), status: 'pending', activity: videos(3, 10) }, // 活躍、特別關注、互粉
  { entry: entry(4, { kind: 'whisper' }), status: 'pending', activity: classifyActivity(4, null, NOW) }, // 無影片、悄悄
  { entry: entry(5), status: 'pending', activity: unknownActivity(5, 'timeout', NOW) }, // 未知
  { entry: entry(6, { tagIds: [7] }), status: 'pending' }, // 還沒查
  { entry: entry(7), status: 'done', activity: videos(7, 900) }, // 已取關
];

describe('countStatus', () => {
  it('預設篩選（不活躍）之外的分面各自計數；未知與沒查過都算「查不到」', () => {
    const c = countStatus(rows, DEFAULT_FILTER, 365, NOW);
    expect(c).toMatchObject({ all: 7, inactive: 3, active: 1, noVideos: 1, unknown: 2, done: 1, restored: 0, failed: 0 });
  });
  it('狀態計數反映已套用的分組分面', () => {
    const c = countStatus(rows, { ...DEFAULT_FILTER, group: 7 }, 365, NOW);
    expect(c.inactive).toBe(1);
    expect(c.unknown).toBe(1);
  });
});

describe('matchGroup / countGroups', () => {
  it("'none' 是默认分组，-10 是特別關注", () => {
    expect(matchGroup(rows[0]!, 'none')).toBe(true);
    expect(matchGroup(rows[1]!, 'none')).toBe(false);
    expect(matchGroup(rows[2]!, -10)).toBe(true);
    expect(matchGroup(rows[2]!, 'none')).toBe(false);
  });
  it('分組計數套用了狀態分面', () => {
    const c = countGroups(rows, TAGS, { ...DEFAULT_FILTER, status: 'all' }, 365, NOW);
    expect(c.get('none')).toBe(4);
    expect(c.get(7)).toBe(2);
    expect(c.get(-10)).toBe(1);
  });
});

describe('countKinds / filterRows', () => {
  it('關注類型計數', () => {
    const c = countKinds(rows, { ...DEFAULT_FILTER, status: 'all' }, 365, NOW);
    expect(c).toEqual({ any: 7, whisper: 1, special: 1, mutual: 1 });
  });
  it('搜尋吃名稱或整個 UID', () => {
    expect(filterRows(rows, { ...DEFAULT_FILTER, status: 'all', query: '3' }, 365, NOW).map((r) => r.entry.mid)).toEqual([3]);
    expect(filterRows(rows, { ...DEFAULT_FILTER, status: 'all', query: 'USER1' }, 365, NOW).map((r) => r.entry.mid)).toEqual([1]);
  });
  it('門檻改了不活躍的集合跟著變', () => {
    expect(filterRows(rows, DEFAULT_FILTER, 365, NOW).map((r) => r.entry.mid)).toEqual([1, 2, 4]);
    expect(filterRows(rows, DEFAULT_FILTER, 5, NOW).map((r) => r.entry.mid)).toEqual([1, 2, 3, 4]);
  });
});

describe('sortRows', () => {
  const nameOf = (id: number) => TAGS.find((t) => t.id === id)?.name;
  it('天數降冪：無影片最前、未知與沒查過永遠最後', () => {
    const order = sortRows(rows, { key: 'days', dir: 'desc' }, nameOf, NOW).map((r) => r.entry.mid);
    expect(order.slice(0, 1)).toEqual([4]);
    expect(order.slice(1, 5)).toEqual([7, 1, 2, 3]);
    expect(new Set(order.slice(5))).toEqual(new Set([5, 6]));
  });
  it('天數升冪：未知仍在最後', () => {
    const order = sortRows(rows, { key: 'days', dir: 'asc' }, nameOf, NOW).map((r) => r.entry.mid);
    expect(order[0]).toBe(3);
    expect(new Set(order.slice(5))).toEqual(new Set([5, 6]));
  });
});
