import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ActivityRecord, VideoDetail } from '@/shared/types';
import { ACTIVITY_TTL_DAYS, COVER_TTL_DAYS, DETAIL_TTL_DAYS } from './settings';

interface CoverEntry {
  bvid: string;
  dataUrl: string;
  fetchedAt: number;
}

/**
 * 一個資料庫、三個 store：整理收藏用 `videoDetail`／`cover`，清理關注用 `activity`。
 * 兩個前身各有一個資料庫；合併後同一個 origin 只留一份，「清除快取」在設定頁分成兩組各自清。
 */
interface CacheSchema extends DBSchema {
  videoDetail: { key: string; value: VideoDetail; indexes: { fetchedAt: number } };
  cover: { key: string; value: CoverEntry; indexes: { fetchedAt: number } };
  activity: { key: number; value: ActivityRecord; indexes: { checkedAt: number } };
}

const DB_NAME = 'bilitidy';
const DB_VERSION = 1;

/** `VideoDetail.schema` 目前唯一合法值；之後改資料形狀就把這裡跟著改成新的字面值。
 * `sweepStale` 靠它把改版前留下的舊 schema 列清掉，不然 `getCachedDetails` 的過濾只會讓它們變成
 * 永遠讀不到、永遠不會被刪的孤兒列。 */
const CURRENT_DETAIL_SCHEMA = 1;
/** `ActivityRecord.schema` 目前唯一合法值；同上 */
const CURRENT_ACTIVITY_SCHEMA = 1;

/** 封面是 base64 data URL，一張就有機會到幾十 KB；上限之外用 LRU（依 fetchedAt）淘汰最舊的。 */
export const COVER_CAP = 5000;

let dbPromise: Promise<IDBPDatabase<CacheSchema>> | null = null;

function db(): Promise<IDBPDatabase<CacheSchema>> {
  dbPromise ??= openDB<CacheSchema>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('videoDetail', { keyPath: 'bvid' }).createIndex('fetchedAt', 'fetchedAt');
      database.createObjectStore('cover', { keyPath: 'bvid' }).createIndex('fetchedAt', 'fetchedAt');
      database.createObjectStore('activity', { keyPath: 'mid' }).createIndex('checkedAt', 'checkedAt');
    },
  }).then(async (database) => {
    // 開頭掃一次即可：這支只在 SW／App 分頁的生命週期跑一次，不需要每次讀寫都掃。
    // 等它做完才把 database 交出去，之後每個呼叫端拿到的都已經是掃過的狀態，不會跟第一批
    // 讀寫夾雜出「這次拿到的到底掃過沒」的競爭。失敗（例如 quota）不該讓整個快取打不開，
    // 吞掉就好，下次重新開啟再試一次。
    await sweepStale(database).catch(() => undefined);
    return database;
  });
  return dbPromise;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 清掉過期（依各自的 TTL）與 schema 已經不是目前版本的列。不清的話：
 * TTL 只在讀的時候擋，過期列會留在 IndexedDB 裡到手動「清除快取」；
 * schema 一改版，舊列會變成讀不到也刪不掉的孤兒，永遠占空間。
 * 活躍度列只掃 schema：它的 TTL 由 `isFresh` 在讀取時判斷，過期列留著能顯示「上次查到什麼」。
 */
async function sweepStale(database: IDBPDatabase<CacheSchema>, now = Date.now()): Promise<void> {
  const detailCutoff = now - DETAIL_TTL_DAYS * DAY_MS;
  const coverCutoff = now - COVER_TTL_DAYS * DAY_MS;
  const tx = database.transaction(['videoDetail', 'cover', 'activity'], 'readwrite');

  let detailCursor = await tx.objectStore('videoDetail').openCursor();
  while (detailCursor) {
    const d = detailCursor.value;
    if (d.schema !== CURRENT_DETAIL_SCHEMA || d.fetchedAt < detailCutoff) await detailCursor.delete();
    detailCursor = await detailCursor.continue();
  }

  let coverCursor = await tx.objectStore('cover').openCursor();
  while (coverCursor) {
    if (coverCursor.value.fetchedAt < coverCutoff) await coverCursor.delete();
    coverCursor = await coverCursor.continue();
  }

  let activityCursor = await tx.objectStore('activity').openCursor();
  while (activityCursor) {
    if (activityCursor.value.schema !== CURRENT_ACTIVITY_SCHEMA) await activityCursor.delete();
    activityCursor = await activityCursor.continue();
  }

  await tx.done;
}

/** cover 數量超過上限時，依 fetchedAt 由舊到新刪到剩上限（LRU：最近寫入的優先留著）。 */
async function evictCoverOverCap(database: IDBPDatabase<CacheSchema>): Promise<void> {
  const tx = database.transaction('cover', 'readwrite');
  let excess = (await tx.store.count()) - COVER_CAP;
  if (excess > 0) {
    let cursor = await tx.store.index('fetchedAt').openCursor();
    while (cursor && excess > 0) {
      await cursor.delete();
      excess--;
      cursor = await cursor.continue();
    }
  }
  await tx.done;
}

// ---- 整理收藏：影片詳情與封面 ----

/** 批次讀取未過期的 detail（單一交易） */
export async function getCachedDetails(bvids: string[], ttlMs: number, now = Date.now()): Promise<Map<string, VideoDetail>> {
  const database = await db();
  const tx = database.transaction('videoDetail', 'readonly');
  const found = new Map<string, VideoDetail>();
  await Promise.all(
    bvids.map(async (bvid) => {
      const d = await tx.store.get(bvid);
      if (d && d.schema === CURRENT_DETAIL_SCHEMA && now - d.fetchedAt < ttlMs) found.set(bvid, d);
    }),
  );
  await tx.done;
  return found;
}

export async function putDetail(detail: VideoDetail): Promise<void> {
  await (await db()).put('videoDetail', detail);
}

export async function getCachedCover(bvid: string, ttlMs: number, now = Date.now()): Promise<string | undefined> {
  const entry = await (await db()).get('cover', bvid);
  if (entry && now - entry.fetchedAt < ttlMs) return entry.dataUrl;
  return undefined;
}

export async function putCover(bvid: string, dataUrl: string, now = Date.now()): Promise<void> {
  const database = await db();
  await database.put('cover', { bvid, dataUrl, fetchedAt: now });
  await evictCoverOverCap(database);
}

/** 清掉影片詳情與封面（活躍度另外有 `clearActivities`） */
export async function clearCache(): Promise<void> {
  const database = await db();
  await Promise.all([database.clear('videoDetail'), database.clear('cover')]);
}

export async function cacheStats(): Promise<{ details: number; covers: number }> {
  const database = await db();
  const [details, covers] = await Promise.all([database.count('videoDetail'), database.count('cover')]);
  return { details, covers };
}

// ---- 清理關注：帳號活躍度 ----

/**
 * 「還算新鮮」的定義集中在這裡：schema 對、沒超過 TTL、而且**不是 unknown**——
 * 查不到狀態的帳號永遠要重查，快取只是讓畫面能顯示「上次是什麼時候失敗的」。
 */
export function isFresh(record: ActivityRecord, now = Date.now(), ttlDays = ACTIVITY_TTL_DAYS): boolean {
  return record.schema === CURRENT_ACTIVITY_SCHEMA && record.status !== 'unknown' && now - record.checkedAt < ttlDays * DAY_MS;
}

/** 批次讀取（單一交易）；`onlyFresh` 為 false 時連過期與 unknown 的都回，給畫面顯示用 */
export async function getActivities(mids: number[], opts: { onlyFresh: boolean; now?: number } = { onlyFresh: true }) {
  const database = await db();
  const tx = database.transaction('activity', 'readonly');
  const found = new Map<number, ActivityRecord>();
  const now = opts.now ?? Date.now();
  await Promise.all(
    mids.map(async (mid) => {
      const r = await tx.store.get(mid);
      if (!r || r.schema !== CURRENT_ACTIVITY_SCHEMA) return;
      if (!opts.onlyFresh || isFresh(r, now)) found.set(mid, r);
    }),
  );
  await tx.done;
  return found;
}

export async function putActivity(record: ActivityRecord): Promise<void> {
  await (await db()).put('activity', record);
}

export async function clearActivities(): Promise<void> {
  await (await db()).clear('activity');
}

export async function activityStats(): Promise<{ count: number; oldestAt: number | null }> {
  const database = await db();
  const count = await database.count('activity');
  const cursor = await database.transaction('activity').store.index('checkedAt').openCursor();
  return { count, oldestAt: cursor ? cursor.value.checkedAt : null };
}
