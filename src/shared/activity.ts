/**
 * 最近打出去的請求，給「分類中」畫面顯示。
 *
 * 一支任務會跑十幾分鐘，中間只有一條進度條的話看不出它是還在跑、卡住、還是被風控擋著。
 * 這裡只留記憶體裡最後幾筆，不寫 storage、不上傳，換頁就沒了。
 *
 * 放在 shared 是因為寫入端在葉節點（`bilibili/http.ts`、`ai/client.ts`），
 * 而它們不可以 import core；shared 是兩邊都能用的那一層。
 */

export type ActivityKind = 'ok' | 'bad' | 'hit';

export interface ActivityEntry {
  /** 單調遞增，給 React key 用 */
  id: number;
  at: number;
  /** 端點簡名，例如 wbi/view/detail */
  endpoint: string;
  /** 這次請求的關鍵參數，例如 BV 號或 pn=2 · ps=40 */
  detail?: string;
  /** 右邊那欄：200 · 412 ms、快取命中、-799 之類 */
  result: string;
  kind: ActivityKind;
}

/** 只留最近這幾筆；畫面一次也只看得到 5–8 列 */
const MAX = 40;

let entries: readonly ActivityEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

export function recordActivity(entry: Omit<ActivityEntry, 'id' | 'at'>): void {
  const next = [{ ...entry, id: nextId++, at: Date.now() }, ...entries];
  entries = next.length > MAX ? next.slice(0, MAX) : next;
  for (const fn of listeners) fn();
}

export function activitySnapshot(): readonly ActivityEntry[] {
  return entries;
}

export function subscribeActivity(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function clearActivity(): void {
  entries = [];
  for (const fn of listeners) fn();
}
