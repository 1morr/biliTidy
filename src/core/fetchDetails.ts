import { fetchSubtitleText } from '@/bilibili/subtitle';
import { fetchVideoDetail } from '@/bilibili/video';
import { t } from '@/i18n';
import { isFatal, withRetry, type RetryOptions } from '@/net/backoff';
import { throwIfAborted } from '@/net/sleep';
import { isAbortError, toAppError } from '@/shared/result';
import type { Progress, VideoBasic, VideoDetail } from '@/shared/types';
import { DAY_MS, getCachedDetails, putDetail } from './cache';
import { readThrottle } from './scheduler';

export interface FetchDetailsOptions {
  ttlDays: number;
  /** 順便抓字幕（每支最多再多 2 次請求） */
  subtitles?: boolean;
  signal?: AbortSignal;
  onProgress?: (p: Progress) => void;
  onWait?: RetryOptions['onWait'];
}

export interface FetchDetailsResult {
  details: Map<string, VideoDetail>;
  /** bvid → 錯誤訊息（例如已失效） */
  failed: Map<string, string>;
  stats: { fetched: number; cached: number };
}

/** 只有一般影片（type 2）且未失效的才有詳情可抓 */
export function needsDetail(v: VideoBasic): boolean {
  return v.type === 2 && !v.invalid;
}

/** 快取優先，miss 才逐支打 view/detail（節流＋退避）。 */
export async function fetchDetails(videos: VideoBasic[], opts: FetchDetailsOptions): Promise<FetchDetailsResult> {
  const targets = videos.filter(needsDetail);
  const details = await getCachedDetails(
    targets.map((v) => v.bvid),
    opts.ttlDays * DAY_MS,
  );
  const failed = new Map<string, string>();
  const misses = targets.filter((v) => !details.has(v.bvid));
  const stats = { fetched: 0, cached: details.size };
  const total = misses.length;

  opts.onProgress?.({ done: 0, total, label: t().progress.detailCacheStatus(stats.cached, total) });
  for (const [i, v] of misses.entries()) {
    throwIfAborted(opts.signal);
    await readThrottle.acquire(opts.signal);
    try {
      const detail = await withRetry(() => fetchVideoDetail(v.bvid, opts.signal), {
        signal: opts.signal,
        onWait: opts.onWait,
      });
      await putDetail(detail);
      details.set(v.bvid, detail);
      stats.fetched++;
    } catch (e) {
      if (isAbortError(e) || isFatal(e)) throw e;
      failed.set(v.bvid, toAppError(e).message);
    }
    opts.onProgress?.({ done: i + 1, total, label: t().progress.detailProgress(i + 1, total, v.title) });
  }

  if (opts.subtitles) {
    const byBvid = new Map(targets.map((v) => [v.bvid, v]));
    // 已經有字幕（快取命中）或抓不到 cid 的就跳過
    const wanted = Array.from(details.values()).filter((d) => d.subtitleText === undefined && d.cid !== undefined);
    for (const [i, detail] of wanted.entries()) {
      throwIfAborted(opts.signal);
      const basic = byBvid.get(detail.bvid);
      if (!basic || detail.cid === undefined) continue;
      opts.onProgress?.({
        done: i,
        total: wanted.length,
        label: t().progress.subtitleProgress(i + 1, wanted.length, basic.title),
      });
      await readThrottle.acquire(opts.signal);
      try {
        const sub = await withRetry(() => fetchSubtitleText(basic.aid, detail.cid!, opts.signal), {
          signal: opts.signal,
          onWait: opts.onWait,
        });
        detail.subtitleText = sub.text;
        if (sub.from) detail.subtitleFrom = sub.from;
        await putDetail(detail);
      } catch (e) {
        if (isAbortError(e) || isFatal(e)) throw e;
        // 字幕抓不到不算失敗
      }
    }
  }
  return { details, failed, stats };
}
