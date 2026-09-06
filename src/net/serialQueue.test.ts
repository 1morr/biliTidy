import { describe, expect, it } from 'vitest';
import { SerialQueue } from './serialQueue';

function fakeClock() {
  let t = 0;
  const log: string[] = [];
  return {
    log,
    now: () => t,
    sleep: async (ms: number) => {
      log.push(`sleep ${ms}`);
      t += ms;
    },
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('SerialQueue', () => {
  it('任務依序執行，開始前補足與上一個結束的間隔', async () => {
    const clock = fakeClock();
    const q = new SerialQueue(800, clock);
    const a = q.run(async () => {
      clock.log.push('a');
      return 1;
    });
    const b = q.run(async () => {
      clock.log.push('b');
      return 2;
    });
    expect(await a).toBe(1);
    expect(await b).toBe(2);
    expect(clock.log).toEqual(['a', 'sleep 800', 'b']);
  });

  it('上一個結束已久則不等待', async () => {
    const clock = fakeClock();
    const q = new SerialQueue(800, clock);
    await q.run(async () => undefined);
    clock.advance(5000);
    await q.run(async () => clock.log.push('b'));
    expect(clock.log).toEqual(['b']);
  });

  it('前一個任務失敗不影響下一個', async () => {
    const q = new SerialQueue(0, { sleep: async () => undefined });
    await expect(q.run(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(await q.run(async () => 'ok')).toBe('ok');
  });
});
