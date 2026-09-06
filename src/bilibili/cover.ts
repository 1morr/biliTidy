import { t } from '@/i18n';
import { blobToDataUrl } from '@/shared/blob';
import { AppError, toAppError } from '@/shared/result';

/**
 * B 站圖片 CDN 格式化：`{url}@{w}w_{h}h_1c.webp`（實測 320×200 裁切可用）。
 * 來源：bilibili-API-collect docs/misc/picture.md
 */
export function coverUrl(cover: string, spec = '320w_200h_1c', ext = 'webp'): string {
  const base = cover.replace(/^http:\/\//, 'https://').replace(/@.*$/, '');
  return `${base}@${spec}.${ext}`;
}

/** 抓縮圖並轉成 data URL（OpenAI 相容端點一律用 base64，Ollama/LM Studio 不接受 http URL） */
export async function fetchCoverDataUrl(cover: string, signal?: AbortSignal): Promise<string> {
  let res: Response;
  try {
    res = await fetch(coverUrl(cover), { signal: signal ?? null, referrerPolicy: 'no-referrer' });
  } catch (e) {
    throw toAppError(e);
  }
  if (!res.ok) throw new AppError('network', t().errors.cover.downloadFailed(res.status), { code: res.status });
  return blobToDataUrl(await res.blob());
}
