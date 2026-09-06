import { describe, expect, it } from 'vitest';
import { chunk } from './array';

describe('chunk', () => {
  it('依批次大小切分', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });

  it('size 小於 1 時當作 1（不然會無窮迴圈）', () => {
    expect(chunk([1, 2], 0)).toEqual([[1], [2]]);
    expect(chunk([1, 2], -5)).toEqual([[1], [2]]);
  });
});
