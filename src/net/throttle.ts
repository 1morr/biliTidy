import { sleep as defaultSleep } from './sleep';

export interface ThrottleOptions {
  /** 每秒允許的請求數 */
  rps: number;
  /** 抖動比例 0–1：每次間隔乘以 (1 ± jitterPct) 內的隨機值 */
  jitterPct: number;
  /** 測試注入 */
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
}

/**
 * 序列化的最小間隔節流：每個 acquire() 依序排隊，兩次放行之間至少間隔 1000/rps ms（含抖動）。
 * 併發呼叫會按呼叫順序排隊，不會突發。
 */
export class Throttle {
  private rps: number;
  private jitterPct: number;
  private nextAt = 0;
  private readonly now: () => number;
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  private readonly random: () => number;

  constructor(opts: ThrottleOptions) {
    this.rps = opts.rps;
    this.jitterPct = opts.jitterPct;
    this.now = opts.now ?? (() => Date.now());
    this.sleep = opts.sleep ?? defaultSleep;
    this.random = opts.random ?? Math.random;
  }

  /**
   * 改速率時把還沒到的等待依新舊間隔的比例重算：只改 `this.rps`／`this.jitterPct` 的話，
   * 已經排進 `nextAt` 的等待是照舊間隔算的，調快速率不會讓正在排隊的請求提早——
   * 使用者在設定頁把 2 req/s 調成 5 req/s，下一支影片還是照原本的間隔等。
   * 等比縮放而不是直接砍掉：多個 acquire 併發排隊時，彼此之間的相對間距還是要維持。
   */
  setRate(rps: number, jitterPct: number): void {
    const now = this.now();
    if (this.nextAt > now) {
      const oldInterval = 1000 / this.rps;
      const newInterval = 1000 / rps;
      this.nextAt = now + (this.nextAt - now) * (newInterval / oldInterval);
    }
    this.rps = rps;
    this.jitterPct = jitterPct;
  }

  /** 等到輪到自己為止；signal 取消時 reject，並把佔走的那段配額還回去（見下方說明）。 */
  async acquire(signal?: AbortSignal): Promise<void> {
    const now = this.now();
    const start = Math.max(now, this.nextAt);
    const interval = 1000 / this.rps;
    const jitter = interval * this.jitterPct * (this.random() * 2 - 1);
    const reserved = start + interval + jitter;
    this.nextAt = reserved;
    const wait = start - now;
    if (wait <= 0) return;
    try {
      await this.sleep(wait, signal);
    } catch (e) {
      // 取消：把剛剛預約的那格還回去，讓排在後面的請求不用白等一段沒人用到的配額。
      // 只有在沒有其他 acquire 又排在我們後面時才還得回去，不然會把後面的預約往前拉亂掉。
      if (this.nextAt === reserved) this.nextAt = start;
      throw e;
    }
  }
}
