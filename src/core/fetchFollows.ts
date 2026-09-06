import { fetchFollowingsPage, fetchRelationStat, fetchTags, fetchWhispersPage, FOLLOW_PAGE_SIZE } from '@/bilibili/relation';
import { t } from '@/i18n';
import { withRetry, type RetryOptions } from '@/net/backoff';
import { throwIfAborted } from '@/net/sleep';
import type { FollowEntry, FollowSnapshot, Progress } from '@/shared/types';
import { readThrottle } from './scheduler';

export interface FetchFollowsOptions {
  includeWhispers: boolean;
  signal?: AbortSignal;
  onProgress?: (p: Progress) => void;
  onWait?: RetryOptions['onWait'];
}

/**
 * 讀完整份關注清單：關注數 → 分組 → 關注明細逐頁 → 悄悄關注逐頁。全部經節流與退避重試。
 * 幾千個關注也只是幾十頁，所以每次跑都重新讀，不快取（快取的是逐帳號的活躍度）。
 */
export async function fetchFollowSnapshot(mid: number, opts: FetchFollowsOptions): Promise<FollowSnapshot> {
  const { signal, onWait } = opts;
  const paced = async <T>(fn: () => Promise<T>): Promise<T> => {
    throwIfAborted(signal);
    await readThrottle.acquire(signal);
    return withRetry(fn, { signal, onWait });
  };

  opts.onProgress?.({ done: 0, total: 1, label: t().follows.progress.followStat });
  const reported = await paced(() => fetchRelationStat(mid, signal));
  const tags = await paced(() => fetchTags(signal));

  const entries: FollowEntry[] = [];
  const seen = new Set<number>();
  const push = (list: FollowEntry[]) => {
    for (const e of list) {
      if (seen.has(e.mid)) continue;
      seen.add(e.mid);
      entries.push(e);
    }
  };

  const expectedPages = Math.max(1, Math.ceil(reported.following / FOLLOW_PAGE_SIZE));
  // 安全閥：回報數與實際頁數對不上時最多再多翻幾頁，不讓一直回滿頁的伺服器把迴圈拖成無窮
  const maxPages = expectedPages + 5;
  for (let pn = 1; pn <= maxPages; pn++) {
    opts.onProgress?.({ done: pn - 1, total: expectedPages, label: t().follows.progress.followPage(pn, expectedPages) });
    const page = await paced(() => fetchFollowingsPage(mid, pn, signal));
    push(page);
    if (page.length < FOLLOW_PAGE_SIZE) break;
  }

  if (opts.includeWhispers && reported.whisper > 0) {
    const whisperPages = Math.ceil(reported.whisper / FOLLOW_PAGE_SIZE);
    for (let pn = 1; pn <= whisperPages + 5; pn++) {
      opts.onProgress?.({ done: pn - 1, total: whisperPages, label: t().follows.progress.whisperPage(pn, whisperPages) });
      const page = await paced(() => fetchWhispersPage(pn, signal));
      push(page);
      if (page.length < FOLLOW_PAGE_SIZE) break;
    }
  }

  opts.onProgress?.({ done: expectedPages, total: expectedPages, label: t().follows.progress.followDone(entries.length) });
  return { mid, fetchedAt: Date.now(), tags, entries, reported };
}
