import { localeTag } from '@/i18n';

/** 數字、日期的顯示格式集中在這裡，跟著目前語言走 */

export function fmtInt(n: number): string {
  return n.toLocaleString(localeTag());
}

/** Unix 秒 → 年月日 */
export function fmtDate(epochSec: number): string {
  if (!epochSec || epochSec <= 0) return '—';
  return new Date(epochSec * 1000).toLocaleDateString(localeTag(), { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** 毫秒 → 年月日 時分 */
export function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleString(localeTag(), {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 頭像網址：B 站 CDN 支援 `@64w_64h_1c.webp` 這種縮圖後綴，幾千列的表格不該每列載原圖。
 * 舊資料偶爾是 http://，一律升成 https（擴充功能頁面本來就擋混合內容）。
 */
export function faceUrl(face: string, px = 64): string {
  if (!face) return '';
  const https = face.replace(/^http:/, 'https:');
  if (https.includes('hdslb.com') && !https.includes('@')) return `${https}@${px}w_${px}h_1c.webp`;
  return https;
}
