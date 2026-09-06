import { hasEndpointPermission, requestEndpointPermission } from '@/ai/client';
import { t } from '@/i18n';
import { toAppError } from '@/shared/result';

/**
 * 使用者自訂的端點屬於 optional_host_permissions：儲存設定與按測試之前都要先確認拿得到權限，
 * 否則 chatCompletion 會直接以 forbidden 失敗。容器（儲存）與連線那一段（測試）共用這一支。
 */
export async function ensureEndpointPermission(baseUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (await hasEndpointPermission(baseUrl)) return { ok: true };
    return { ok: await requestEndpointPermission(baseUrl) };
  } catch (e) {
    return { ok: false, error: t().connection.invalidBaseUrl(toAppError(e).message) };
  }
}
