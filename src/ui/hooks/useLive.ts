import { useEffect, useState, useSyncExternalStore } from 'react';
import { activitySnapshot, subscribeActivity, type ActivityEntry } from '@/shared/activity';

/** 最近打出去的請求（見 `shared/activity.ts`）；只存在記憶體，換頁就沒了 */
export function useActivity(): readonly ActivityEntry[] {
  return useSyncExternalStore(subscribeActivity, activitySnapshot);
}

/**
 * 每秒重繪一次的「現在」。任務跑十幾分鐘時要看得到已用時間在動，
 * 沒在跑就不要開計時器（背景分頁的 timer 本來就被節流，空轉沒有意義）。
 */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

/** 秒數 → mm:ss；超過一小時才補上小時 */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  if (mm < 60) return `${String(mm).padStart(2, '0')}:${ss}`;
  return `${String(Math.floor(mm / 60))}:${String(mm % 60).padStart(2, '0')}:${ss}`;
}
