import { create } from 'zustand';

/**
 * 整理收藏與清理關注一次只跑一個。兩個 jobStore 各自管自己的 AbortController 與快照，
 * 互斥就放在這個小 store：任務開始前 `claimJob`，結束（finally）時 `releaseJob`；
 * 另一種任務正在跑時 claim 失敗，呼叫端直接返回，UI 也用 `useJobGuard` 把主按鈕變灰並寫出原因。
 *
 * 為什麼不靠 Web Lock：`jobLock.ts` 的 `acquireJobLock` 刻意不等待鎖（它只是握著豁免凍結），
 * 而且就算等待，第二個任務的 phase 也已經切到「進行中」，畫面會騙人。
 */
export type JobKind = 'organise' | 'follows';

interface JobGuardState {
  active: JobKind | null;
}

export const useJobGuard = create<JobGuardState>(() => ({ active: null }));

/** 取得執行權：沒有任務在跑、或正在跑的就是同一種任務（重新開始、接著寫入）時成立 */
export function claimJob(kind: JobKind): boolean {
  const { active } = useJobGuard.getState();
  if (active !== null && active !== kind) return false;
  useJobGuard.setState({ active: kind });
  return true;
}

export function releaseJob(kind: JobKind): void {
  if (useJobGuard.getState().active === kind) useJobGuard.setState({ active: null });
}

/** 給畫面用：另一種任務是不是正在跑（要不要把這一頁的主按鈕變灰） */
export function otherJobRunning(active: JobKind | null, mine: JobKind): boolean {
  return active !== null && active !== mine;
}
