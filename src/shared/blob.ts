import { t } from '@/i18n';

/** Blob → data URL。AI 端點一律吃 base64（Ollama／LM Studio 不接受 http URL） */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error(t().errors.imageReadFailed));
    reader.readAsDataURL(blob);
  });
}
