import { describe, expect, it } from 'vitest';
import { SAMPLE_PAGES_MAX, pickPages, spread } from './describeFolder';

describe('pickPages', () => {
  it('頁數不超過上限就全讀', () => {
    expect(pickPages(1)).toEqual([1]);
    expect(pickPages(4)).toEqual([1, 2, 3, 4]);
    expect(pickPages(SAMPLE_PAGES_MAX)).toHaveLength(SAMPLE_PAGES_MAX);
  });

  it('大收藏夾平均取樣，頭尾都涵蓋', () => {
    const pages = pickPages(50);
    expect(pages).toHaveLength(SAMPLE_PAGES_MAX);
    expect(pages[0]).toBe(1);
    expect(pages.at(-1)).toBe(50);
    expect([...pages].sort((a, b) => a - b)).toEqual(pages);
  });

  it('不會回傳重複頁碼', () => {
    const pages = pickPages(7, 6);
    expect(new Set(pages).size).toBe(pages.length);
  });

  it('容忍 0 或負數（空收藏夾）', () => {
    expect(pickPages(0)).toEqual([1]);
  });
});

describe('spread', () => {
  it('數量在上限內就原樣回傳', () => {
    expect(spread([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  it('超過上限時平均抽稀，涵蓋到尾端而不是砍掉後半段', () => {
    const picked = spread(
      Array.from({ length: 100 }, (_, i) => i),
      10,
    );
    expect(picked).toHaveLength(10);
    expect(picked[0]).toBe(0);
    expect(picked.at(-1)).toBeGreaterThan(80);
  });
});
