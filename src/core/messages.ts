import { z } from 'zod';
import type { AppError } from '@/shared/result';
import type { QuickFavSuggestion } from './quickFav';

/**
 * content script ↔ service worker 的訊息。
 * 影片頁的 content script 沒有 host_permissions 帶來的 CORS 豁免、也拿不到 chrome.cookies，
 * 所以 B 站與 AI 的請求都由 SW 代打；content script 只負責畫按鈕與 toast。
 *
 * `externally_connectable` 沒有宣告，所以其他擴充功能或網頁碰不到 `runtime.onMessage`；
 * 這裡驗證主要是防禦性的（格式跑掉時給一個好懂的錯誤，而不是讓 `applyFavorite` 內部
 * 因為某個欄位是 `undefined` 而拋出不相干的 TypeError）。
 */
export const quickFavMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('quickFav:suggest'), bvid: z.string() }),
  z.object({
    type: z.literal('quickFav:apply'),
    aid: z.number(),
    addIds: z.array(z.number()),
    delIds: z.array(z.number()),
  }),
]);

export type QuickFavMessage = z.infer<typeof quickFavMessageSchema>;

export type QuickFavResult<T> = { ok: true; data: T } | { ok: false; kind: AppError['kind']; message: string };

export interface QuickFavResponseMap {
  'quickFav:suggest': QuickFavSuggestion;
  'quickFav:apply': null;
}
