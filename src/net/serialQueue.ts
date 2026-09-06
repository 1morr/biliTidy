import { sleep as defaultSleep } from './sleep';

/**
 * 寫入請求序列化：一次只跑一個任務，且距離上一個任務結束至少 intervalMs 才開始下一個。
 * 間隔在「下一個任務開始前」補足，不會留下懸空的計時器；任務失敗不影響後續排程。
 */
export class SerialQueue {
  private tail: Promise<void> = Promise.resolve();
  private lastEnd: number | null = null;
  private intervalMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;

  constructor(
    intervalMs: number,
    opts: { now?: () => number; sleep?: (ms: number, signal?: AbortSignal) => Promise<void> } = {},
  ) {
    this.intervalMs = intervalMs;
    this.now = opts.now ?? (() => Date.now());
    this.sleep = opts.sleep ?? defaultSleep;
  }

  setInterval(ms: number): void {
    this.intervalMs = ms;
  }

  run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const result = this.tail.then(async () => {
      if (this.lastEnd !== null) {
        const wait = this.lastEnd + this.intervalMs - this.now();
        if (wait > 0) await this.sleep(wait, signal);
      }
      try {
        return await task();
      } finally {
        this.lastEnd = this.now();
      }
    });
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
