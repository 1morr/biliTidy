import { t } from '@/i18n';
import { AppError } from '@/shared/result';
import type { LatestArchive } from '@/shared/types';
import { biliFetch } from './http';

interface VlistRaw {
  bvid?: string;
  title?: string;
  /** 發布時間（Unix 秒）；空間投稿列表用的欄位名是 `created`，不是 `pubdate` */
  created?: number;
}

interface ArcSearchRaw {
  list?: { vlist?: VlistRaw[] | null };
  /** `count` 是這個帳號的投稿總數，0 才是「真的沒發過影片」 */
  page?: { count?: number };
}

/**
 * 該帳號最新一支影片。走空間頁自己用的 `space/wbi/arc/search`（需要 WBI 簽名，
 * `order=pubdate` 最新在前，`ps=1&pn=1` 只取一支）。
 *
 * 回傳 `null` 代表 **B 站明確說這個帳號沒有影片**（code 0、`page.count === 0`）；
 * 任何錯誤（非 0 code、HTTP 非 200、風控、網路、count 與清單對不起來）都是丟例外——
 * 分類成「未知」是呼叫端（`core/checkActivity.ts`）的事，這裡不吞。
 *
 * 這裡曾經走 `series/recArchivesByKeywords`，2026-09-06 實測發現它是「推薦稿件」介面而不是投稿列表：
 * 回的筆數與 `ps` 不成比例（`ps=1` 對**每一個**帳號都回 code 0 加空 archives，`ps=50` 對有 74 支投稿的
 * 帳號照樣回 0 筆），於是幾乎整份關注清單都被判成「從未投稿」。詳見 `docs/design.md` 11。
 */
export async function fetchLatestArchive(mid: number, signal?: AbortSignal): Promise<LatestArchive | null> {
  const d = await biliFetch<ArcSearchRaw>('/x/space/wbi/arc/search', {
    query: { mid, ps: 1, pn: 1, order: 'pubdate', index: 1, platform: 'web', web_location: 1550101 },
    wbi: true,
    signal,
  });
  const first = d?.list?.vlist?.[0];
  if (first) return { bvid: first.bvid ?? '', title: first.title ?? '', pubdate: first.created ?? 0 };
  // 說有投稿卻一支都沒回：寧可讓這個帳號變成「未知」，也不能當成從未投稿（PRODUCT.md 原則 2）
  if (d?.page?.count !== 0) throw new AppError('parse', t().errors.bilibili.archiveListEmpty);
  return null;
}
