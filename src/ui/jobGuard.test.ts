import { beforeEach, describe, expect, it } from 'vitest';
import { claimJob, otherJobRunning, releaseJob, useJobGuard } from './jobGuard';

describe('jobGuard', () => {
  beforeEach(() => {
    useJobGuard.setState({ active: null });
  });

  it('沒有任務在跑時任一種都能開始；同一種可以重複 claim（重新開始、接著寫入）', () => {
    expect(claimJob('organise')).toBe(true);
    expect(claimJob('organise')).toBe(true);
    expect(useJobGuard.getState().active).toBe('organise');
  });

  it('另一種任務在跑時 claim 失敗，狀態不變', () => {
    expect(claimJob('follows')).toBe(true);
    expect(claimJob('organise')).toBe(false);
    expect(useJobGuard.getState().active).toBe('follows');
  });

  it('只有持有者能釋放；釋放後另一種才能開始', () => {
    claimJob('follows');
    releaseJob('organise');
    expect(useJobGuard.getState().active).toBe('follows');
    releaseJob('follows');
    expect(useJobGuard.getState().active).toBeNull();
    expect(claimJob('organise')).toBe(true);
  });

  it('otherJobRunning：只有「別種任務在跑」才算', () => {
    expect(otherJobRunning(null, 'organise')).toBe(false);
    expect(otherJobRunning('organise', 'organise')).toBe(false);
    expect(otherJobRunning('follows', 'organise')).toBe(true);
  });
});
