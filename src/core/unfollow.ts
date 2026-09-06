import { addUsersToTags, batchFollow, modifyRelation, RELATION_ACT, SPECIAL_TAG_ID, type RelationAct } from '@/bilibili/relation';
import { t } from '@/i18n';
import { isFatal, withRetry, type RetryOptions } from '@/net/backoff';
import { chunk } from '@/shared/array';
import { isAbortError, toAppError } from '@/shared/result';
import type { FollowEntry, FollowKind, Progress, FollowRow } from '@/shared/types';
import { writeQueue } from './scheduler';
import { RESTORE_BATCH_SIZE } from './settings';

export interface WriteOptions {
  signal?: AbortSignal;
  /** 某一列的狀態變了（UI 重繪用）。寫入流程會就地修改傳進來的 row */
  onRow?: (row: FollowRow) => void;
  onProgress?: (p: Progress) => void;
  onWait?: RetryOptions['onWait'];
}

export interface WriteResult {
  done: number;
  failed: number;
  /** 提前停下（取消／風控／未登入）；沒停為 undefined */
  stopped?: { message: string; remaining: number };
}

/** 一般關注與互相關注都是取關（2）；悄悄關注要用取消悄悄關注（4），用 2 會回「請求錯誤」 */
export function unfollowActFor(kind: FollowKind): RelationAct {
  return kind === 'whisper' ? RELATION_ACT.UNWHISPER : RELATION_ACT.UNFOLLOW;
}

/**
 * 逐筆取關。文檔明載 `batch/modify` 只接受關注與拉黑，所以取關一律單筆、經 writeQueue 排開。
 * 每一列成功就是 `done`、失敗就是 `failed`（帶原因）；取消或風控時停下，還沒輪到的列保持 `pending`。
 */
export async function executeUnfollow(rows: FollowRow[], opts: WriteOptions): Promise<WriteResult> {
  const targets = rows.filter((r) => r.status === 'pending');
  const result: WriteResult = { done: 0, failed: 0 };
  for (const [i, row] of targets.entries()) {
    if (opts.signal?.aborted)
      return { ...result, stopped: { message: t().errors.network.cancelled, remaining: targets.length - i } };
    row.status = 'unfollowing';
    row.error = undefined;
    opts.onRow?.(row);
    try {
      await writeQueue.run(
        () =>
          withRetry(() => modifyRelation(row.entry.mid, unfollowActFor(row.entry.kind), opts.signal), {
            signal: opts.signal,
            onWait: opts.onWait,
          }),
        opts.signal,
      );
      row.status = 'done';
      result.done++;
    } catch (e) {
      if (isAbortError(e)) {
        row.status = 'pending';
        opts.onRow?.(row);
        return { ...result, stopped: { message: t().errors.network.cancelled, remaining: targets.length - i } };
      }
      const err = toAppError(e);
      row.status = 'failed';
      row.error = err.message;
      result.failed++;
      if (isFatal(err)) {
        opts.onRow?.(row);
        return { ...result, stopped: { message: err.message, remaining: targets.length - i - 1 } };
      }
    }
    opts.onRow?.(row);
    opts.onProgress?.({
      done: i + 1,
      total: targets.length,
      label: t().follows.progress.unfollowProgress(i + 1, targets.length, row.entry.name),
    });
  }
  return result;
}

/** 撤銷時要還原的分組：特別關注也是一個分組（-10），文檔範例就是這樣帶的 */
export function tagsToRestore(entry: FollowEntry): number[] {
  const ids = [...entry.tagIds];
  if (entry.special && !ids.includes(SPECIAL_TAG_ID)) ids.push(SPECIAL_TAG_ID);
  return ids.sort((a, b) => a - b);
}

/**
 * 撤銷這次的取關：分批重新關注（`batch/modify` act=1，每批 ≤20），再依原本的分組把人放回去
 * （同一組分組的帳號併成一次 `tags/addUsers`）。悄悄關注沒辦法還原成悄悄關注（act 3 已下線），
 * 會變成一般關注，列上留備註。分組還原失敗不算撤銷失敗，只留備註——關注關係已經回來了。
 */
export async function executeRestore(rows: FollowRow[], opts: WriteOptions): Promise<WriteResult> {
  const targets = rows.filter((r) => r.status === 'done');
  const result: WriteResult = { done: 0, failed: 0 };
  const batches = chunk(targets, RESTORE_BATCH_SIZE);
  let processed = 0;

  for (const batch of batches) {
    if (opts.signal?.aborted)
      return { ...result, stopped: { message: t().errors.network.cancelled, remaining: targets.length - processed } };
    for (const row of batch) {
      row.status = 'restoring';
      row.error = undefined;
      opts.onRow?.(row);
    }
    try {
      const { failedFids } = await writeQueue.run(
        () =>
          withRetry(
            () =>
              batchFollow(
                batch.map((r) => r.entry.mid),
                opts.signal,
              ),
            { signal: opts.signal, onWait: opts.onWait },
          ),
        opts.signal,
      );
      const failed = new Set(failedFids);
      for (const row of batch) {
        if (failed.has(row.entry.mid)) {
          row.status = 'restoreFailed';
          row.error = t().follows.errors.restoreRejected;
          result.failed++;
        } else {
          row.status = 'restored';
          if (row.entry.kind === 'whisper') row.note = t().follows.errors.whisperRestoredAsFollow;
          result.done++;
        }
        opts.onRow?.(row);
      }
    } catch (e) {
      const aborted = isAbortError(e);
      const err = toAppError(e);
      for (const row of batch) {
        // 取消：這一批還沒送出（或不知道送出沒）——退回 done 讓使用者可以再按一次撤銷
        row.status = aborted ? 'done' : 'restoreFailed';
        row.error = aborted ? undefined : err.message;
        if (!aborted) result.failed++;
        opts.onRow?.(row);
      }
      if (aborted || isFatal(err)) {
        return {
          ...result,
          stopped: { message: err.message, remaining: targets.length - processed - (aborted ? 0 : batch.length) },
        };
      }
    }
    processed += batch.length;
    opts.onProgress?.({
      done: processed,
      total: targets.length,
      label: t().follows.progress.restoreProgress(processed, targets.length),
    });
  }

  // 分組還原：同一組分組簽名的帳號併成一次請求
  const groups = new Map<string, { tagIds: number[]; rows: FollowRow[] }>();
  for (const row of targets) {
    if (row.status !== 'restored') continue;
    const tagIds = tagsToRestore(row.entry);
    if (tagIds.length === 0) continue;
    const key = tagIds.join(',');
    const group = groups.get(key) ?? { tagIds, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (opts.signal?.aborted) return result;
    try {
      await writeQueue.run(
        () =>
          withRetry(
            () =>
              addUsersToTags(
                group.rows.map((r) => r.entry.mid),
                group.tagIds,
                opts.signal,
              ),
            { signal: opts.signal, onWait: opts.onWait },
          ),
        opts.signal,
      );
    } catch (e) {
      if (isAbortError(e)) return result;
      const err = toAppError(e);
      for (const row of group.rows) {
        row.note = t().follows.errors.groupsNotRestored(err.message);
        opts.onRow?.(row);
      }
      if (isFatal(err)) return result;
    }
  }
  return result;
}
