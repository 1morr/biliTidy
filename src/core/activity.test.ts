import { describe, expect, it } from 'vitest';
import type { FollowEntry, FollowRow } from '@/shared/types';
import { canSelect, classifyActivity, daysInactive, hasGroup, isInactive, unknownActivity } from './activity';
import { DAY_MS } from './cache';

const NOW = Date.UTC(2026, 8, 5, 12, 0, 0);
const secAgo = (days: number) => Math.floor((NOW - days * DAY_MS) / 1000);

const entry = (over: Partial<FollowEntry> = {}): FollowEntry => ({
  mid: 1,
  name: 'a',
  face: '',
  sign: '',
  tagIds: [],
  special: false,
  kind: 'follow',
  followedAt: 0,
  verify: '',
  ...over,
});

describe('classifyActivity', () => {
  it('null 代表 B 站明確說沒有影片', () => {
    expect(classifyActivity(1, null, NOW)).toMatchObject({ status: 'noVideos', checkedAt: NOW, schema: 2 });
  });
  it('有影片就帶著最新一支', () => {
    const latest = { bvid: 'BV1', title: 't', pubdate: secAgo(3) };
    expect(classifyActivity(1, latest, NOW)).toMatchObject({ status: 'videos', latest });
  });
});

describe('daysInactive / isInactive', () => {
  it('完整的 24 小時才算一天', () => {
    const r = classifyActivity(1, { bvid: 'x', title: '', pubdate: secAgo(10) + 30 }, NOW);
    expect(daysInactive(r, NOW)).toBe(9);
  });
  it('嚴格大於門檻才算不活躍', () => {
    const r = classifyActivity(1, { bvid: 'x', title: '', pubdate: secAgo(365) }, NOW);
    expect(daysInactive(r, NOW)).toBe(365);
    expect(isInactive(r, 365, NOW)).toBe(false);
    expect(isInactive(r, 364, NOW)).toBe(true);
  });
  it('確認無影片＝無限不活躍', () => {
    const r = classifyActivity(1, null, NOW);
    expect(daysInactive(r, NOW)).toBe(Number.POSITIVE_INFINITY);
    expect(isInactive(r, 100000, NOW)).toBe(true);
  });
  it('未知與沒查過永遠不算不活躍', () => {
    expect(daysInactive(unknownActivity(1, 'x', NOW), NOW)).toBeNull();
    expect(isInactive(unknownActivity(1, 'x', NOW), 0, NOW)).toBe(false);
    expect(isInactive(undefined, 0, NOW)).toBe(false);
  });
  it('pubdate 為 0 的影片當作未知，不會算出幾萬天', () => {
    const r = classifyActivity(1, { bvid: 'x', title: '', pubdate: 0 }, NOW);
    expect(daysInactive(r, NOW)).toBeNull();
  });
});

describe('canSelect', () => {
  const row = (over: Partial<FollowRow>): FollowRow => ({ entry: entry(), status: 'pending', ...over });
  it('只有 pending 且狀態已確認的列可以勾', () => {
    expect(canSelect(row({ activity: classifyActivity(1, null, NOW) }))).toBe(true);
    expect(canSelect(row({ activity: classifyActivity(1, { bvid: 'x', title: '', pubdate: secAgo(1) }, NOW) }))).toBe(true);
    expect(canSelect(row({ activity: unknownActivity(1, 'boom', NOW) }))).toBe(false);
    expect(canSelect(row({}))).toBe(false);
    expect(canSelect(row({ status: 'done', activity: classifyActivity(1, null, NOW) }))).toBe(false);
  });
});

describe('hasGroup', () => {
  it('自訂分組或特別關注都算有分組；默认分组不算', () => {
    expect(hasGroup(entry())).toBe(false);
    expect(hasGroup(entry({ tagIds: [123] }))).toBe(true);
    expect(hasGroup(entry({ special: true }))).toBe(true);
  });
});
