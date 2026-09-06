import { JOB_LOCK_NAME } from '@/core/scheduler';

/**
 * 背景分頁會被 Chrome 節流甚至凍結（實測隱藏 5 分鐘後 setTimeout 延遲 > 45 秒、
 * fetch callback 逾 10 分鐘不回呼），整個任務就這樣靜止。持有 Web Lock 可以豁免，
 * 所以任務期間一直握著，呼叫端在 finally 釋放。
 * 這把鎖同時也是 SW「智慧收藏」排隊等這裡任務跑完的依據，鎖名（`JOB_LOCK_NAME`）
 * 因此定義在 `core/scheduler.ts` 讓兩邊共用，不要各自寫一份字面值（`docs/design.md` 8.1／7）。
 *
 * 它**不等待**鎖（`request` 沒有 await）：兩種任務的互斥由 `jobGuard.ts` 負責。
 */
export function acquireJobLock(): () => void {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  void navigator.locks?.request(JOB_LOCK_NAME, () => held).catch(() => undefined);
  return release;
}
