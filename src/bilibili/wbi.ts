// WebCrypto 沒有 MD5（只有 SHA-*）；`w_rid` 是 B 站自己的簽名演算法規定要用 MD5，
// 這裡的雜湊不是拿來做任何安全用途（不驗證誰能偽造請求），單純是照抄協議格式，
// 未來想「升級」成 WebCrypto 的雜湊之前先確認這件事。
import SparkMD5 from 'spark-md5';

/** 來源：bilibili-API-collect docs/misc/sign/wbi.md（固定重排表） */
export const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37,
  48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
] as const;

export interface WbiKeys {
  imgKey: string;
  subKey: string;
}

export type QueryValue = string | number | boolean;
export type Query = Record<string, QueryValue | undefined>;

export function getMixinKey(keys: WbiKeys): string {
  const raw = keys.imgKey + keys.subKey;
  return MIXIN_KEY_ENC_TAB.map((i) => raw[i] ?? '')
    .join('')
    .slice(0, 32);
}

/** 從 nav 回應的 wbi_img.img_url / sub_url 取出檔名（去副檔名）作為 key */
export function extractWbiKey(url: string): string {
  const file = url.slice(url.lastIndexOf('/') + 1);
  const dot = file.lastIndexOf('.');
  return dot === -1 ? file : file.slice(0, dot);
}

/** 依 B 站規則編碼：encodeURIComponent 行為（空格 %20），並過濾 value 中的 !'()* */
export function encodeQuery(query: Query): string {
  return Object.keys(query)
    .filter((k) => query[k] !== undefined)
    .sort()
    .map((k) => {
      const v = String(query[k]).replace(/[!'()*]/g, '');
      return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
    })
    .join('&');
}

/** 回傳已附加 wts 與 w_rid 的 query string */
export function signWbi(query: Query, keys: WbiKeys, wts = Math.round(Date.now() / 1000)): string {
  const mixinKey = getMixinKey(keys);
  const sorted = encodeQuery({ ...query, wts });
  const wRid = SparkMD5.hash(sorted + mixinKey);
  return `${sorted}&w_rid=${wRid}`;
}
