import { describe, expect, it } from 'vitest';
import { AppError } from '@/shared/result';
import { defaultRetryPolicy, runWithSplit, withRetry } from './backoff';

describe('defaultRetryPolicy', () => {
  it('風控 60/120/240 秒後放棄', () => {
    const err = new AppError('riskControl', 'x');
    expect([0, 1, 2, 3].map((a) => defaultRetryPolicy(err, a))).toEqual([60_000, 120_000, 240_000, null]);
  });

  it('網路 1/2/4 秒；其他不重試', () => {
    expect(defaultRetryPolicy(new AppError('network', 'x'), 0)).toBe(1_000);
    expect(defaultRetryPolicy(new AppError('forbidden', 'x'), 0)).toBeNull();
    expect(defaultRetryPolicy(new AppError('csrf', 'x'), 0)).toBe(0);
    expect(defaultRetryPolicy(new AppError('csrf', 'x'), 1)).toBeNull();
  });
});

describe('withRetry', () => {
  it('依 policy 重試並回報等待', async () => {
    const waits: number[] = [];
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new AppError('network', 'fail');
        return 'ok';
      },
      { onWait: (i) => waits.push(i.delayMs), sleep: async () => undefined },
    );
    expect(result).toBe('ok');
    expect(waits).toEqual([1_000, 2_000]);
  });

  it('policy 回 null 時丟出原錯誤', async () => {
    await expect(
      withRetry(async () => Promise.reject(new AppError('forbidden', 'nope')), { sleep: async () => undefined }),
    ).rejects.toMatchObject({ kind: 'forbidden' });
  });
});

describe('runWithSplit', () => {
  it('-632 時對半拆到成功為止', async () => {
    const executed: number[][] = [];
    const failed: number[][] = [];
    await runWithSplit(
      [1, 2, 3, 4, 5],
      async (batch) => {
        executed.push(batch);
        if (batch.length > 2) throw new AppError('limit', 'too many');
      },
      (batch) => failed.push(batch),
    );
    expect(executed).toEqual([[1, 2, 3, 4, 5], [1, 2, 3], [1, 2], [3], [4, 5]]);
    expect(failed).toEqual([]);
  });

  it('單筆仍失敗或非 limit 錯誤 → 回報失敗', async () => {
    const failed: number[][] = [];
    await runWithSplit(
      [1, 2],
      async () => {
        throw new AppError('api', 'boom');
      },
      (batch) => failed.push(batch),
    );
    expect(failed).toEqual([[1, 2]]);
  });
});
