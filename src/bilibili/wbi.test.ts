import { describe, expect, it } from 'vitest';
import { MIXIN_KEY_ENC_TAB, encodeQuery, extractWbiKey, getMixinKey, signWbi } from './wbi';

// 測試向量來源：docs/research/wbi-test-vector.md（bilibili-API-collect docs/misc/sign/wbi.md）
const KEYS = { imgKey: '7cd084941338484aae1ad9425b84077c', subKey: '4932caff0ff746eab6f01bf08b70ac45' };

describe('wbi', () => {
  it('重排表長度為 64 且不重複', () => {
    expect(MIXIN_KEY_ENC_TAB).toHaveLength(64);
    expect(new Set(MIXIN_KEY_ENC_TAB).size).toBe(64);
  });

  it('mixin key 與文件範例一致', () => {
    expect(getMixinKey(KEYS)).toBe('ea1db124af3c7062474693fa704f4ff8');
  });

  it('w_rid 與文件範例一致', () => {
    const qs = signWbi({ foo: '114', bar: '514', zab: 1919810 }, KEYS, 1702204169);
    const params = new URLSearchParams(qs);
    expect(params.get('w_rid')).toBe('8f6f2b5b3d485fe1886cec6a0be8c5d4');
    expect(params.get('wts')).toBe('1702204169');
    expect(qs.startsWith('bar=514&foo=114&wts=1702204169&zab=1919810')).toBe(true);
  });

  it("encodeQuery 過濾 !'()* 並以 %20 編碼空格、略過 undefined", () => {
    expect(encodeQuery({ b: "a b!'()*", a: 1, c: undefined })).toBe('a=1&b=a%20b');
  });

  it('extractWbiKey 取檔名去副檔名', () => {
    expect(extractWbiKey('https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png')).toBe(
      '7cd084941338484aae1ad9425b84077c',
    );
  });
});
