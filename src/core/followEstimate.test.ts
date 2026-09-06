import { describe, expect, it } from 'vitest';
import { estimateReadRequests, estimateSeconds, roundMinutes } from './followEstimate';

describe('estimate', () => {
  it('頁數 + stat/tags + 逐帳號', () => {
    expect(estimateReadRequests(120, 100)).toBe(3 + 2 + 100);
    expect(estimateReadRequests(0, 0)).toBe(2);
  });
  it('依速率換算，不足一分鐘算一分鐘', () => {
    expect(estimateSeconds(120, 100, 1)).toBe(105);
    expect(roundMinutes(105)).toBe(2);
    expect(roundMinutes(10)).toBe(1);
  });
});
