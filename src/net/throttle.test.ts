import { describe, expect, it } from 'vitest';
import { Throttle } from './throttle';

function fakeClock() {
  let t = 0;
  const waits: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      waits.push(ms);
      t += ms;
    },
    waits,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('Throttle', () => {
  it('2 req/s 無抖動：10 次請求間隔 500ms，總等待 4500ms', async () => {
    const clock = fakeClock();
    const th = new Throttle({ rps: 2, jitterPct: 0, now: clock.now, sleep: clock.sleep, random: () => 0.5 });
    for (let i = 0; i < 10; i++) await th.acquire();
    expect(clock.waits).toHaveLength(9);
    expect(clock.waits.every((w) => w === 500)).toBe(true);
    expect(clock.now()).toBe(4500);
  });

  it('第一次不等待；閒置超過間隔後也不等待', async () => {
    const clock = fakeClock();
    const th = new Throttle({ rps: 2, jitterPct: 0, now: clock.now, sleep: clock.sleep });
    await th.acquire();
    clock.advance(10_000);
    await th.acquire();
    expect(clock.waits).toHaveLength(0);
  });

  it('抖動落在 ±jitterPct 範圍內', async () => {
    const clock = fakeClock();
    const th = new Throttle({ rps: 1, jitterPct: 0.3, now: clock.now, sleep: clock.sleep, random: () => 1 });
    await th.acquire();
    await th.acquire();
    expect(clock.waits[0]).toBe(1300);
    th.setRate(1, 0.3);
    const th2 = new Throttle({ rps: 1, jitterPct: 0.3, now: clock.now, sleep: clock.sleep, random: () => 0 });
    await th2.acquire();
    await th2.acquire();
    expect(clock.waits[1]).toBe(700);
  });

  it('併發 acquire 依序排隊', async () => {
    const clock = fakeClock();
    const th = new Throttle({ rps: 4, jitterPct: 0, now: clock.now, sleep: clock.sleep });
    await Promise.all([th.acquire(), th.acquire(), th.acquire()]);
    expect(clock.waits).toEqual([250, 250]);
    expect(clock.now()).toBe(500);
  });

  it('setRate 依新舊間隔比例重算還沒到的等待：調快速率讓正在排隊的請求提早', async () => {
    const clock = fakeClock();
    const th = new Throttle({ rps: 1, jitterPct: 0, now: clock.now, sleep: clock.sleep, random: () => 0.5 });
    await th.acquire(); // 第一次不等；下一次的排程在 t=1000
    th.setRate(2, 0); // 間隔從 1000ms 砍半成 500ms，剩下的等待跟著砍半
    await th.acquire();
    expect(clock.waits).toEqual([500]);
    expect(clock.now()).toBe(500);
  });

  it('setRate 調慢速率時，剩下的等待跟著等比拉長', async () => {
    const clock = fakeClock();
    const th = new Throttle({ rps: 2, jitterPct: 0, now: clock.now, sleep: clock.sleep, random: () => 0.5 });
    await th.acquire(); // 下一次的排程在 t=500
    th.setRate(1, 0); // 間隔從 500ms 變 1000ms，剩下的等待也跟著變兩倍
    await th.acquire();
    expect(clock.waits).toEqual([1000]);
  });

  it('acquire 被取消時把預約的那格還回去，不會讓下一個排隊者白等', async () => {
    let t = 0;
    const waits: number[] = [];
    const sleep = (ms: number, signal?: AbortSignal): Promise<void> => {
      waits.push(ms);
      if (signal?.aborted) return Promise.reject(new Error('aborted'));
      t += ms;
      return Promise.resolve();
    };
    const th = new Throttle({ rps: 1, jitterPct: 0, now: () => t, sleep, random: () => 0.5 });
    await th.acquire(); // 不用等；下一次排程在 t=1000
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(th.acquire(ctrl.signal)).rejects.toThrow();
    // 被取消那次原本要預約到 t=2000，退回去之後，下一個排隊者接著用 t=1000 那格，不是白等到 2000
    await th.acquire();
    expect(waits).toEqual([1000, 1000]);
  });
});
