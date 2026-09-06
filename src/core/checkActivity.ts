import { fetchLatestArchive } from '@/bilibili/archive';
import { t } from '@/i18n';
import { isFatal, withRetry, type RetryOptions } from '@/net/backoff';
import { isAbortError, toAppError } from '@/shared/result';
import type { ActivityRecord, FollowEntry, Progress } from '@/shared/types';
import { classifyActivity, unknownActivity } from './activity';
import { getActivities, putActivity } from './cache';
import { readThrottle } from './scheduler';

export interface CheckOptions {
  /** `missing`：只查沒有新鮮快取的帳號；`all`：全部重查 */
  mode: 'missing' | 'all';
  signal?: AbortSignal;
  onProgress?: (p: Progress) => void;
  onWait?: RetryOptions['onWait'];
  /** 每查完一個就回報一次，畫面可以邊跑邊更新 */
  onRecord?: (record: ActivityRecord) => void;
  now?: () => number;
}

export type StopReason = 'riskControl' | 'auth' | 'cancelled';

export interface CheckResult {
  records: Map<number, ActivityRecord>;
  stats: { fetched: number; cached: number; unknown: number };
  /** 提前停下的原因；正常跑完為 undefined。停下時 `records` 仍是有效的部分結果。 */
  stopped?: { reason: StopReason; message: string; remaining: number };
}

/**
 * 逐帳號查最新影片：快取優先，miss 才打 API（節流＋退避）。
 *
 * 與 biliFavOrg 的 fetchDetails 不同的一點：風控或取消時**不丟例外**，而是把已經查到的部分結果
 * 連同停下的原因一起交回去。Java 版就是這樣做的——被風控停在第 800 個帳號時，前 799 個的結果
 * 照樣可以審核、可以取關；剩下的顯示成「尚未查過」，下次按「只查缺的」補齊。
 */
export async function checkActivity(entries: FollowEntry[], opts: CheckOptions): Promise<CheckResult> {
  const now = opts.now ?? (() => Date.now());
  const mids = entries.map((e) => e.mid);
  const records =
    opts.mode === 'all' ? new Map<number, ActivityRecord>() : await getActivities(mids, { onlyFresh: true, now: now() });
  const stats = { fetched: 0, cached: records.size, unknown: 0 };
  const misses = entries.filter((e) => !records.has(e.mid));
  const total = misses.length;
  const cancelled = (i: number): CheckResult => ({
    records,
    stats,
    stopped: { reason: 'cancelled', message: t().errors.network.cancelled, remaining: total - i },
  });

  opts.onProgress?.({ done: 0, total, label: t().follows.progress.checkStart(stats.cached, total) });
  for (const [i, e] of misses.entries()) {
    if (opts.signal?.aborted) return cancelled(i);
    try {
      await readThrottle.acquire(opts.signal);
    } catch (err) {
      if (isAbortError(err)) return cancelled(i);
      throw err;
    }

    let record: ActivityRecord;
    // 打出去就算「這次查的」：失敗的帳號一樣花了請求，統計要對得上請求紀錄
    stats.fetched++;
    try {
      const latest = await withRetry(() => fetchLatestArchive(e.mid, opts.signal), { signal: opts.signal, onWait: opts.onWait });
      record = classifyActivity(e.mid, latest, now());
    } catch (err) {
      if (isAbortError(err)) return cancelled(i);
      const error = toAppError(err);
      if (isFatal(error)) {
        // 風控／未登入：再打下去只是繼續燒配額（風控不會因為換下一個帳號就解除），整輪停下
        return {
          records,
          stats,
          stopped: { reason: error.kind === 'auth' ? 'auth' : 'riskControl', message: error.message, remaining: total - i },
        };
      }
      record = unknownActivity(e.mid, error.message, now());
      stats.unknown++;
    }
    records.set(e.mid, record);
    // unknown 也寫進快取：`isFresh` 不會把它當新鮮的，下次照樣重查，但畫面能顯示上次是什麼時候失敗的
    await putActivity(record).catch(() => undefined);
    opts.onRecord?.(record);
    opts.onProgress?.({ done: i + 1, total, label: t().follows.progress.checkProgress(i + 1, total, e.name) });
  }
  return { records, stats };
}
