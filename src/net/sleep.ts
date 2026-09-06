import { t } from '@/i18n';
import { AppError } from '@/shared/result';

/** 可取消的 sleep；signal 觸發時以 AppError('aborted') reject。 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AppError('aborted', t().errors.network.cancelled));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new AppError('aborted', t().errors.network.cancelled));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AppError('aborted', t().errors.network.cancelled);
}
