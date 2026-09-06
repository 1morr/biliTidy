import { AppError, isAbortError, toAppError } from '@/shared/result';
import { sleep as defaultSleep } from './sleep';

/** 風控退避序列（毫秒）：60s → 120s → 240s，超過就放棄並交給使用者決定 */
export const RISK_BACKOFF_MS = [60_000, 120_000, 240_000] as const;
/** 網路錯誤退避序列 */
export const NETWORK_BACKOFF_MS = [1_000, 2_000, 4_000] as const;

/** 回傳這次失敗應等待的毫秒數；null = 不重試 */
export type RetryPolicy = (error: AppError, attempt: number) => number | null;

/**
 * 風控（IP／指紋層級，持續性）或未登入時，重試或換下一批都只是繼續浪費配額——
 * 風控不會因為換一批小的就解除。呼叫端應該直接中止剩下的步驟，而不是每批各自
 * 燒完一輪 60+120+240 秒的退避才失敗（讀取路徑的 `fetchDetails.ts` 原本就這樣做，
 * 寫入路徑的 `core/moves.ts` 現在也共用同一支判斷）。
 */
export function isFatal(e: unknown): boolean {
  const err = toAppError(e);
  return err.kind === 'riskControl' || err.kind === 'auth';
}

export const defaultRetryPolicy: RetryPolicy = (error, attempt) => {
  switch (error.kind) {
    case 'network':
      return NETWORK_BACKOFF_MS[attempt] ?? null;
    case 'riskControl':
      return RISK_BACKOFF_MS[attempt] ?? null;
    case 'csrf':
      // cookie 剛更新：立刻重讀一次即可
      return attempt === 0 ? 0 : null;
    default:
      return null;
  }
};

export interface RetryOptions {
  policy?: RetryPolicy;
  signal?: AbortSignal;
  /** 每次等待前回呼（給 UI 顯示倒數） */
  onWait?: (info: { error: AppError; attempt: number; delayMs: number }) => void;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/** 依 policy 重試 fn；policy 回 null 或 signal 取消時丟出最後一次的錯誤。 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const policy = opts.policy ?? defaultRetryPolicy;
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (isAbortError(e)) throw e;
      const error = toAppError(e);
      const delayMs = policy(error, attempt);
      if (delayMs === null) throw error;
      opts.onWait?.({ error, attempt, delayMs });
      await sleep(delayMs, opts.signal);
    }
  }
}

/** -632（數量限制）時把批次對半拆，遞迴到單筆為止。 */
export async function runWithSplit<T>(
  items: T[],
  exec: (batch: T[]) => Promise<void>,
  onFailure: (batch: T[], error: AppError) => void,
): Promise<void> {
  if (items.length === 0) return;
  try {
    await exec(items);
  } catch (e) {
    const error = toAppError(e);
    if (error.kind === 'limit' && items.length > 1) {
      const mid = Math.ceil(items.length / 2);
      await runWithSplit(items.slice(0, mid), exec, onFailure);
      await runWithSplit(items.slice(mid), exec, onFailure);
      return;
    }
    if (isAbortError(e)) throw e;
    onFailure(items, error);
  }
}
