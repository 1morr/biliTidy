import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/result';
import type { FollowEntry, FollowRow } from '@/shared/types';

vi.mock('@/bilibili/relation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/bilibili/relation')>();
  return { ...actual, modifyRelation: vi.fn(), batchFollow: vi.fn(), addUsersToTags: vi.fn() };
});

import { addUsersToTags, batchFollow, modifyRelation } from '@/bilibili/relation';
import { writeQueue } from './scheduler';
import { executeRestore, executeUnfollow, tagsToRestore, unfollowActFor } from './unfollow';

const entry = (mid: number, over: Partial<FollowEntry> = {}): FollowEntry => ({
  mid,
  name: `u${mid}`,
  face: '',
  sign: '',
  tagIds: [],
  special: false,
  kind: 'follow',
  followedAt: 0,
  verify: '',
  ...over,
});
const pending = (mid: number, over: Partial<FollowEntry> = {}): FollowRow => ({ entry: entry(mid, over), status: 'pending' });
const done = (mid: number, over: Partial<FollowEntry> = {}): FollowRow => ({ entry: entry(mid, over), status: 'done' });

beforeEach(() => {
  writeQueue.setInterval(0);
  vi.mocked(modifyRelation).mockReset();
  vi.mocked(batchFollow).mockReset();
  vi.mocked(addUsersToTags).mockReset();
});

describe('unfollowActFor / tagsToRestore', () => {
  it('悄悄關注用 4，其餘用 2', () => {
    expect(unfollowActFor('whisper')).toBe(4);
    expect(unfollowActFor('follow')).toBe(2);
    expect(unfollowActFor('mutual')).toBe(2);
  });
  it('特別關注也是一個分組（-10），排序且不重複', () => {
    expect(tagsToRestore(entry(1, { tagIds: [9, 3], special: true }))).toEqual([-10, 3, 9]);
    expect(tagsToRestore(entry(1, { tagIds: [-10, 3], special: true }))).toEqual([-10, 3]);
    expect(tagsToRestore(entry(1))).toEqual([]);
  });
});

describe('executeUnfollow', () => {
  it('逐筆送出，一筆失敗不影響其他筆', async () => {
    vi.mocked(modifyRelation).mockImplementation(async (fid) => {
      if (fid === 2) throw new AppError('api', 'boom', { retryable: false });
    });
    const rows = [pending(1), pending(2), pending(3, { kind: 'whisper' })];
    const seen: string[] = [];
    const result = await executeUnfollow(rows, { onRow: (r) => seen.push(`${r.entry.mid}:${r.status}`) });
    expect(result).toEqual({ done: 2, failed: 1 });
    expect(rows.map((r) => r.status)).toEqual(['done', 'failed', 'done']);
    expect(rows[1]!.error).toBe('boom');
    expect(vi.mocked(modifyRelation).mock.calls.map(([fid, act]) => [fid, act])).toEqual([
      [1, 2],
      [2, 2],
      [3, 4],
    ]);
    expect(seen).toContain('1:unfollowing');
  });

  it('未登入這類致命錯誤整批停下，還沒輪到的保持 pending', async () => {
    vi.mocked(modifyRelation).mockRejectedValue(new AppError('auth', 'not signed in'));
    const rows = [pending(1), pending(2)];
    const result = await executeUnfollow(rows, {});
    expect(result.done).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.stopped).toEqual({ message: 'not signed in', remaining: 1 });
    expect(rows.map((r) => r.status)).toEqual(['failed', 'pending']);
    expect(modifyRelation).toHaveBeenCalledTimes(1);
  });

  it('已取消的 signal 什麼都不送', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const rows = [pending(1)];
    const result = await executeUnfollow(rows, { signal: ctrl.signal });
    expect(result.stopped?.remaining).toBe(1);
    expect(modifyRelation).not.toHaveBeenCalled();
    expect(rows[0]!.status).toBe('pending');
  });
});

describe('executeRestore', () => {
  it('批次重新關注，失敗的 fid 標成 restoreFailed，成功的依原分組放回去', async () => {
    vi.mocked(batchFollow).mockResolvedValue({ failedFids: [2] });
    vi.mocked(addUsersToTags).mockResolvedValue();
    const rows = [
      done(1, { tagIds: [5], special: true }),
      done(2),
      done(3, { tagIds: [5], special: true }),
      done(4, { kind: 'whisper' }),
    ];
    const result = await executeRestore(rows, {});
    expect(result).toEqual({ done: 3, failed: 1 });
    expect(rows.map((r) => r.status)).toEqual(['restored', 'restoreFailed', 'restored', 'restored']);
    expect(batchFollow).toHaveBeenCalledTimes(1);
    expect(vi.mocked(batchFollow).mock.calls[0]![0]).toEqual([1, 2, 3, 4]);
    // 同一組分組簽名的帳號併成一次請求；沒有分組的（4）不打
    expect(vi.mocked(addUsersToTags).mock.calls.map(([fids, tags]) => [fids, tags])).toEqual([
      [
        [1, 3],
        [-10, 5],
      ],
    ]);
    expect(rows[3]!.note).toBeTruthy();
  });

  it('分組還原失敗只留備註，關注關係已經回來了', async () => {
    vi.mocked(batchFollow).mockResolvedValue({ failedFids: [] });
    vi.mocked(addUsersToTags).mockRejectedValue(new AppError('api', 'tag gone', { retryable: false }));
    const rows = [done(1, { tagIds: [5] })];
    const result = await executeRestore(rows, {});
    expect(result).toEqual({ done: 1, failed: 0 });
    expect(rows[0]!.status).toBe('restored');
    expect(rows[0]!.note).toContain('tag gone');
  });
});
