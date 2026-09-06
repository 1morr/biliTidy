import type { LatestArchive } from '@/shared/types';
import { biliFetch } from './http';

interface ArchiveRaw {
  bvid: string;
  title: string;
  pubdate: number;
}

/**
 * 該帳號最新一支影片。走 `series/recArchivesByKeywords`（Java 版沿用至今：免登入、免 WBI，
 * `keywords` 留空即全部、`orderby=senddate` 最新在前）。
 *
 * 回傳 `null` 代表 **B 站明確說這個帳號沒有影片**（code 0、archives 空）；
 * 任何錯誤（非 0 code、HTTP 非 200、風控、網路）都是丟例外——分類成「未知」是呼叫端
 * （`core/checkActivity.ts`）的事，這裡不吞。這個區分就是 Java 版修過的那個 bug：
 * 風控回的是 HTTP 200 加非 0 code，payload 沒有影片清單，讀得太天真會把活躍帳號當成從沒發過片。
 */
export async function fetchLatestArchive(mid: number, signal?: AbortSignal): Promise<LatestArchive | null> {
  const d = await biliFetch<{ archives?: ArchiveRaw[] | null }>('/x/series/recArchivesByKeywords', {
    // ps=1：只要最新一支。2026-09-05 在真實帳號實測 ps=1&pn=1 回的就是不帶 ps 時的第一支，payload 小 20 倍
    query: { mid, keywords: '', orderby: 'senddate', ps: 1, pn: 1 },
    signal,
  });
  const first = d?.archives?.[0];
  if (!first) return null;
  return { bvid: first.bvid ?? '', title: first.title ?? '', pubdate: first.pubdate ?? 0 };
}
