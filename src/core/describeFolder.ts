import { DESCRIBE_SAMPLE_MAX, generateDescription, type DescribeSample } from '@/ai/describe';
import { FAV_PAGE_YIELD, listResources } from '@/bilibili/fav';
import { withRetry, type RetryOptions } from '@/net/backoff';
import type { FolderMeta, Settings } from '@/shared/types';
import { readThrottle } from './scheduler';

/**
 * 一個收藏夾最多讀幾頁當樣本。每頁最多 40 支，6 頁＝最多 240 支候選、6 次 B 站請求（約 3 秒）。
 * 只讀最新一兩頁會被「最近剛丟進來的那一批」帶偏——實測 Sound（全音聲）因為第一頁多是百合作品，
 * 生出「以百合音聲為主」的描述，等於把片面的樣本固化成收錄標準。
 */
export const SAMPLE_PAGES_MAX = 6;

export interface DescribeFolderOptions {
  signal?: AbortSignal;
  onWait?: RetryOptions['onWait'];
  /** 使用者原本寫的描述；傳了就讓模型沿用它的範圍 */
  current?: string;
}

/** 從 1..lastPage 平均挑最多 max 頁；頭尾一定包含 */
export function pickPages(lastPage: number, max = SAMPLE_PAGES_MAX): number[] {
  const last = Math.max(1, Math.floor(lastPage));
  if (last <= max) return Array.from({ length: last }, (_, i) => i + 1);
  const step = (last - 1) / (max - 1);
  const pages = new Set<number>();
  for (let i = 0; i < max; i++) pages.add(Math.round(1 + i * step));
  return [...pages].sort((a, b) => a - b);
}

/** 平均抽稀到 max 筆，保留原本的分布（不是砍掉後半段） */
export function spread<T>(items: T[], max: number): T[] {
  if (items.length <= max || max <= 0) return items.slice(0, Math.max(0, max) || items.length);
  const step = items.length / max;
  return Array.from({ length: max }, (_, i) => items[Math.floor(i * step)] as T);
}

export interface FolderSampling {
  /** 實際要送給模型的樣本 */
  samples: DescribeSample[];
  /** 抽稀前一共讀到幾支有效影片 */
  scanned: number;
}

/** 取樣：在整個收藏夾裡平均挑幾頁讀完，再抽稀到模型吃得下的數量 */
export async function sampleFolderVideos(folder: FolderMeta, opts: DescribeFolderOptions = {}): Promise<FolderSampling> {
  // 一頁不保證回滿 40 支，用保守的 FAV_PAGE_YIELD 估頁數：估少了會抽不到最舊的那幾頁
  // （411 支的夾子用 40 算只到第 11 頁，實際約 14 頁，等於最舊的 90 支永遠沒被取樣過），
  // 估多了最壞情況只是多打一兩次回空陣列的請求。
  const lastPage = Math.max(1, Math.ceil(folder.mediaCount / FAV_PAGE_YIELD));
  const seen = new Set<string>();
  const all: DescribeSample[] = [];
  for (const pn of pickPages(lastPage)) {
    await readThrottle.acquire(opts.signal);
    const page = await withRetry(() => listResources(folder.id, pn, { ...(opts.signal ? { signal: opts.signal } : {}) }), {
      ...(opts.signal ? { signal: opts.signal } : {}),
      ...(opts.onWait ? { onWait: opts.onWait } : {}),
    });
    for (const m of page.medias) {
      if (m.invalid || seen.has(m.bvid)) continue;
      seen.add(m.bvid);
      all.push({ title: m.title, ...(m.intro.trim() ? { intro: m.intro } : {}) });
    }
  }
  return { samples: spread(all, DESCRIBE_SAMPLE_MAX), scanned: all.length };
}

export interface DescribeFolderResult {
  /** 生成的描述；夾子裡沒有可用影片時是空字串 */
  text: string;
  /** 實際送進 prompt 的樣本數 */
  used: number;
  /** 為了抽出這些樣本一共讀了幾支 */
  scanned: number;
}

/** 取樣 → 交給模型歸納。回傳的描述是草稿，由 UI 決定要不要採用。 */
export async function describeFolder(
  folder: FolderMeta,
  settings: Settings,
  opts: DescribeFolderOptions = {},
): Promise<DescribeFolderResult> {
  const { samples, scanned } = await sampleFolderVideos(folder, opts);
  if (samples.length === 0) return { text: '', used: 0, scanned };
  const current = (opts.current ?? '').trim();
  const text = await generateDescription(
    settings.ai,
    {
      folderTitle: folder.title,
      samples,
      totalCount: folder.mediaCount,
      ...(current ? { current } : {}),
    },
    opts.signal,
  );
  return { text, used: samples.length, scanned };
}
