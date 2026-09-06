import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import { t } from '@/i18n';
import { recordActivity } from '@/shared/activity';
import { AppError, toAppError } from '@/shared/result';
import { BILI_CODE, classifyBiliError } from './errors';
import { encodeQuery, extractWbiKey, signWbi, type Query, type WbiKeys } from './wbi';

const API_BASE = 'https://api.bilibili.com';
const SITE = 'https://www.bilibili.com';

interface BiliEnvelope<T> {
  code: number;
  message: string;
  /** 寫入類端點（relation/modify 等）沒有 data */
  data?: T;
}

export interface BiliRequestOptions {
  query?: Query;
  method?: 'GET' | 'POST';
  /** POST 表單（會自動附上 csrf） */
  form?: Query;
  /** 附加 WBI 簽名 */
  wbi?: boolean;
  signal?: AbortSignal;
}

async function rawFetch<T>(path: string, opts: BiliRequestOptions): Promise<BiliEnvelope<T>> {
  const method = opts.method ?? 'GET';
  const query = opts.query ?? {};
  const qs = opts.wbi ? signWbi(query, await getWbiKeys()) : encodeQuery(query);
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`;

  const init: RequestInit = {
    method,
    credentials: 'include',
    signal: opts.signal ?? null,
    // 擴充功能頁面不會送 Referer；background 的 DNR 規則會補上 Referer/Origin
    referrerPolicy: 'no-referrer',
  };
  if (method === 'POST') {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.form ?? {})) {
      if (v !== undefined) form.set(k, String(v));
    }
    form.set('csrf', await getCsrf());
    init.body = form;
  }

  const startedAt = Date.now();
  const log = (result: string, kind: 'ok' | 'bad') =>
    recordActivity({ endpoint: shortPath(path), ...activityDetail(query, opts.form), result, kind });

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    const err = toAppError(e);
    if (err.kind !== 'aborted') log(err.message.slice(0, 40), 'bad');
    throw err;
  }
  if (res.status === 412) {
    log(t().activity.riskControl412, 'bad');
    throw new AppError('riskControl', t().errors.bilibili.http412, { code: 412 });
  }
  if (!res.ok) {
    log(`HTTP ${res.status}`, 'bad');
    throw new AppError('network', `HTTP ${res.status} ${res.statusText}`, { code: res.status });
  }
  let json: BiliEnvelope<T>;
  try {
    json = (await res.json()) as BiliEnvelope<T>;
  } catch (e) {
    log(t().activity.notJson, 'bad');
    throw new AppError('parse', t().errors.bilibili.notJson, { cause: e });
  }
  // nav 未登入時回 -101 但仍是一次成功的往返，所以照樣記成 ok，右邊帶著 code
  log(json.code === 0 ? `200 · ${Date.now() - startedAt} ms` : `code ${json.code}`, json.code === 0 ? 'ok' : 'bad');
  return json;
}

/** 請求紀錄裡的端點簡名：`/x/v3/fav/resource/list` → `fav/resource/list` */
function shortPath(path: string): string {
  return path
    .replace(/^\/x\//, '')
    .replace(/^v3\//, '')
    .replace(/^web-interface\//, '');
}

/**
 * 請求紀錄裡跟在端點後面的那一段：挑最能認出「這是哪一支」的參數。
 * 收藏夾端點認 bvid／aid／media_id，關注端點認 mid／分頁與表單裡的 fid(s)。
 */
function activityDetail(query: Query, form: Query | undefined): { detail?: string } {
  const bvid = query.bvid;
  if (bvid !== undefined) return { detail: String(bvid) };
  const aid = query.aid ?? query.rid;
  if (aid !== undefined) return { detail: `av${String(aid)}` };
  const mediaId = query.media_id;
  if (mediaId !== undefined) {
    const page = query.pn !== undefined ? `pn=${String(query.pn)}` : '';
    const size = query.ps !== undefined ? ` · ps=${String(query.ps)}` : '';
    return { detail: page ? `${page}${size}` : `media_id=${String(mediaId)}` };
  }
  if (query.mid !== undefined) return { detail: `mid ${String(query.mid)}` };
  if (query.pn !== undefined) return { detail: `pn=${String(query.pn)}` };
  if (form?.fid !== undefined) return { detail: `fid ${String(form.fid)} · act ${String(form.act)}` };
  if (form?.fids !== undefined) return { detail: `${String(form.fids).split(',').length} fids` };
  return {};
}

/** 呼叫 B 站 API 並回傳 data；code !== 0 或出現 v_voucher 一律丟 AppError。 */
export async function biliFetch<T>(path: string, opts: BiliRequestOptions = {}): Promise<T> {
  const json = await rawFetch<T>(path, opts);
  if (json.code !== 0) throw classifyBiliError(json.code, json.message);
  const data: unknown = json.data;
  if (data && typeof data === 'object' && 'v_voucher' in data) {
    // 文檔 misc/sign/v_voucher.md：簽名或風控失敗時 code 仍為 0、data 只剩 v_voucher
    throw new AppError('riskControl', t().errors.bilibili.wbiOrRiskCheckFailed, {
      code: BILI_CODE.RISK,
    });
  }
  return json.data as T;
}

// ---- 登入態 / csrf / WBI key ----

export interface NavData {
  isLogin: boolean;
  mid: number;
  uname: string;
  face: string;
  wbiKeys: WbiKeys;
}

interface NavRaw {
  isLogin: boolean;
  mid?: number;
  uname?: string;
  face?: string;
  wbi_img?: { img_url: string; sub_url: string };
}

/**
 * nav 一次就回 WBI 金鑰與自己的 mid，兩者一起快取、一起在換日時作廢。
 * mid 曾經有自己一份沒有期限的快取，換帳號之後影片頁會去問舊帳號的收藏夾；
 * 掛在這裡之後「最多沿用到當天」就是結構上保證的，不必靠別處記得同步。
 */
const navItem = storage.defineItem<(WbiKeys & { day: string; mid: number }) | null>('local:wbiKeys', {
  fallback: null,
});

let cachedKeys: WbiKeys | null = null;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 未登入時 nav 回 code -101 但仍附 wbi_img，所以不走 biliFetch 的 code 檢查 */
export async function fetchNav(signal?: AbortSignal): Promise<NavData> {
  const json = await rawFetch<NavRaw>('/x/web-interface/nav', { signal });
  if (json.code !== 0 && json.code !== BILI_CODE.NOT_LOGIN) {
    throw classifyBiliError(json.code, json.message);
  }
  const d: NavRaw = json.data ?? { isLogin: false };
  const wbi = d.wbi_img;
  if (!wbi) throw new AppError('parse', t().errors.bilibili.navMissingWbi);
  const nav: NavData = {
    isLogin: d.isLogin === true,
    mid: d.mid ?? 0,
    uname: d.uname ?? '',
    face: d.face ?? '',
    wbiKeys: { imgKey: extractWbiKey(wbi.img_url), subKey: extractWbiKey(wbi.sub_url) },
  };
  cachedKeys = nav.wbiKeys;
  await navItem.setValue({ ...nav.wbiKeys, day: todayKey(), mid: nav.isLogin ? nav.mid : 0 });
  return nav;
}

/** 當天的 nav 快取；過期或沒有就回 null */
async function todayNav(): Promise<(WbiKeys & { mid: number }) | null> {
  const stored = await navItem.getValue();
  return stored && stored.day === todayKey() ? stored : null;
}

/** WBI key 每日更替；記憶體 → storage → nav 三層 */
export async function getWbiKeys(force = false): Promise<WbiKeys> {
  if (!force && cachedKeys) return cachedKeys;
  if (!force) {
    const stored = await todayNav();
    if (stored) {
      cachedKeys = { imgKey: stored.imgKey, subKey: stored.subKey };
      return cachedKeys;
    }
  }
  return (await fetchNav()).wbiKeys;
}

/** 自己的 mid。影片頁的「智慧收藏」需要它問 folder/created/list-all，避免每次都多打一次 nav。 */
export async function getMid(): Promise<number> {
  const cached = await todayNav();
  if (cached?.mid) return cached.mid;
  const nav = await fetchNav();
  if (!nav.isLogin || !nav.mid) {
    throw new AppError('auth', t().errors.bilibili.notSignedIn, { code: BILI_CODE.NOT_LOGIN });
  }
  return nav.mid;
}

export async function getCsrf(): Promise<string> {
  const cookie = await browser.cookies.get({ url: SITE, name: 'bili_jct' });
  if (!cookie?.value) {
    throw new AppError('auth', t().errors.bilibili.noBiliJctCookie, {
      code: BILI_CODE.NOT_LOGIN,
    });
  }
  return cookie.value;
}
