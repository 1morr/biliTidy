import { Throttle } from '@/net/throttle';
import { SerialQueue } from '@/net/serialQueue';
import type { RateSettings } from '@/shared/types';
import { DEFAULT_SETTINGS, READ_JITTER_PCT } from './settings';

/**
 * App 分頁內的全域排程器（單例）：所有 B 站讀取走 readThrottle、寫入走 writeQueue、封面圖走 cdnThrottle。
 * 之所以能放在頁面端而非 service worker：App 分頁是單例，本身就是全域串行點。
 */
export const readThrottle = new Throttle({
  rps: DEFAULT_SETTINGS.rate.readRps,
  jitterPct: READ_JITTER_PCT,
});

export const cdnThrottle = new Throttle({ rps: 4, jitterPct: 0.2 });

export const writeQueue = new SerialQueue(DEFAULT_SETTINGS.rate.writeIntervalMs);

export function applyRateSettings(rate: RateSettings): void {
  readThrottle.setRate(rate.readRps, READ_JITTER_PCT);
  writeQueue.setInterval(rate.writeIntervalMs);
}

/**
 * 任務期間握著的 Web Lock。兩個用途：
 *
 * 1. 背景分頁會被 Chrome 節流甚至凍結（隱藏幾分鐘後計時器與 fetch 回呼都會停住），持有
 *    `navigator.locks` 可以豁免。整理收藏與清理關注的每個任務函式都在開頭取得、finally 釋放
 *    （`ui/jobLock.ts` 的 `acquireJobLock`）。
 * 2. SW 與 App 分頁各有一份本檔案的單例（見上方模組註解），`readThrottle`／`writeQueue` 管不到彼此——
 *    App 分頁在跑任務時，SW 那邊「智慧收藏」的請求完全不會被算進同一個節流器，兩邊同時動作時
 *    打向 api.bilibili.com 的實際速率會直接翻倍。這裡不去同步兩份節流器的內部狀態（`nextAt`／`lastEnd`
 *    分散在 SW 與分頁兩個 JS 環境，SW 還會被閒置回收，同步起來比它值得的複雜度高），改讓 SW 的
 *    「智慧收藏」在同一把鎖上排隊（`navigator.locks` 是同源共享的）：有任務在跑就等它結束，
 *    兩邊永遠不會同時發請求，也就不會疊加速率。沒有任務在跑時鎖是空的，幾乎立刻放行。
 *
 * 兩種長任務（整理收藏、清理關注）**一次只跑一個**，由 `ui/jobGuard.ts` 在 UI 層擋住；
 * 這把鎖不負責互斥（`acquireJobLock` 不等待鎖，只是握著）。
 */
export const JOB_LOCK_NAME = 'bilitidy-job';
