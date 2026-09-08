import { describe, expect, it } from 'vitest';
import { hashOf, PAGES, pageFromHash } from './route';

describe('pageFromHash', () => {
  it('accepts every page id', () => {
    for (const page of PAGES) expect(pageFromHash(`#/${page}`)).toBe(page);
  });

  it('falls back to the organise page for anything it does not know', () => {
    // 空 hash 是第一次開分頁的樣子；`#/` 與 `#` 是把片段刪一半留下的
    for (const hash of ['', '#', '#/', '#/nope', '#/RUN', '#/run/extra', '#follows/']) {
      expect(pageFromHash(hash)).toBe('run');
    }
  });

  it('reads a hash without the slash as well', () => {
    expect(pageFromHash('#follows')).toBe('follows');
  });

  it('round-trips through hashOf', () => {
    for (const page of PAGES) expect(pageFromHash(hashOf(page))).toBe(page);
  });
});
