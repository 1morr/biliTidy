import { t } from '@/i18n';

/** 應用層錯誤分類：UI 與流程只依 kind 決定怎麼處理（重試／暫停／要求登入）。 */
export type AppErrorKind =
  | 'auth' // -101 未登入
  | 'csrf' // -111 csrf 校驗失敗
  | 'riskControl' // -352 / -412 / HTTP 412 / -799 / v_voucher
  | 'forbidden' // -403
  | 'notFound' // -404 / 11010
  | 'limit' // -632 操作對象數量限制
  | 'network' // fetch 失敗或非 2xx
  | 'api' // 其他 code !== 0
  | 'parse' // 回應格式不符
  | 'aborted';

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly code: number | undefined;
  /** 是否值得（在退避後）自動重試 */
  readonly retryable: boolean;

  constructor(kind: AppErrorKind, message: string, opts: { code?: number; cause?: unknown; retryable?: boolean } = {}) {
    super(message, { cause: opts.cause });
    this.name = 'AppError';
    this.kind = kind;
    this.code = opts.code;
    this.retryable = opts.retryable ?? (kind === 'network' || kind === 'riskControl');
  }
}

export function isAbortError(e: unknown): boolean {
  return (e instanceof AppError && e.kind === 'aborted') || (e instanceof DOMException && e.name === 'AbortError');
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (isAbortError(e)) return new AppError('aborted', t().errors.network.cancelled, { cause: e });
  if (e instanceof TypeError) return new AppError('network', t().errors.network.generic(e.message), { cause: e });
  return new AppError('api', e instanceof Error ? e.message : String(e), { cause: e });
}
