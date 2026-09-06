import { FAV_PAGE_YIELD, listResources } from '@/bilibili/fav';
import { t } from '@/i18n';
import { withRetry, type RetryOptions } from '@/net/backoff';
import { throwIfAborted } from '@/net/sleep';
import { AppError } from '@/shared/result';
import type { Progress, VideoBasic } from '@/shared/types';
import { readThrottle } from './scheduler';

export interface FetchListOptions {
  /** 只取前 N 支（resource/list 預設依收藏時間新到舊，等於「最近收藏的 N 支」） */
  limit?: number;
  signal?: AbortSignal;
  onProgress?: (p: Progress) => void;
  onWait?: RetryOptions['onWait'];
}

/** 逐頁抓取收藏夾內容（ps=40），經節流與退避重試。 */
export async function fetchFolderVideos(
  mediaId: number,
  expectedCount: number,
  opts: FetchListOptions = {},
): Promise<VideoBasic[]> {
  const videos: VideoBasic[] = [];
  const wanted = opts.limit && opts.limit > 0 ? Math.min(opts.limit, expectedCount || opts.limit) : expectedCount;
  // 一頁不保證回滿 40 支（見 FAV_PAGE_YIELD），總頁數只是進度條用的估計值，實際可能更多
  const totalPages = Math.max(1, Math.ceil(wanted / FAV_PAGE_YIELD));
  // 安全閥：只防真正的無窮迴圈（伺服器一直回 has_more:true 但頁面內容不真的往前翻），
  // 不是拿來卡合法的大收藏夾——用回報總數估出的頁數乘 5 倍當上限，另外給一個絕對下限，
  // 避免 expectedCount 本身很小或是 0 時把安全閥收得太緊。
  const maxPages = Math.max(totalPages * 5, 20);
  for (let pn = 1; ; pn++) {
    throwIfAborted(opts.signal);
    if (pn > maxPages) {
      throw new AppError('parse', t().errors.fetchList.tooManyPages(maxPages, totalPages), { retryable: false });
    }
    opts.onProgress?.({
      done: Math.min(pn - 1, totalPages),
      total: Math.max(totalPages, pn),
      label: t().progress.listPage(pn),
    });
    await readThrottle.acquire(opts.signal);
    const page = await withRetry(() => listResources(mediaId, pn, { signal: opts.signal }), {
      signal: opts.signal,
      onWait: opts.onWait,
    });
    videos.push(...page.medias);
    if (opts.limit && videos.length >= opts.limit) break;
    if (!page.hasMore || page.medias.length === 0) break;
  }
  const result = opts.limit && opts.limit > 0 ? videos.slice(0, opts.limit) : videos;
  opts.onProgress?.({ done: totalPages, total: totalPages, label: t().progress.listDone(result.length) });
  return result;
}
