// 註冊 IDBRequest／IDBCursor／IDBTransaction 等支援類別到 global（idb 套件的 wrap 層會用 instanceof
// 認這些類別）；`indexedDB` 進入點本身另外每個測試用 IDBFactory 換一份全新的，見 freshDatabase()。
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoDetail } from '@/shared/types';

/**
 * 每個測試都要是全新的 IndexedDB，不然「TTL／schema 過期列會在下次開啟時被清掉」這種測試
 * 會被前一個測試留下的資料互相污染。`vi.resetModules()` 同時把 `cache.ts` 自己的 `dbPromise`
 * 單例歸零，下一次 `import('./cache')` 才會真的重新觸發一次 `openDB`（連帶跑一次 sweepStale）。
 */
function freshDatabase(): void {
  vi.stubGlobal('indexedDB', new IDBFactory());
}

async function importCache() {
  vi.resetModules();
  return import('./cache');
}

function detail(bvid: string, fetchedAt: number, schema: 1 = 1): VideoDetail {
  return { bvid, fetchedAt, schema, tags: [], zone: '' };
}

describe('core/cache', () => {
  beforeEach(() => {
    freshDatabase();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('put／get 基本往返：TTL 內、schema 正確的列讀得到', async () => {
    const cache = await importCache();
    await cache.putDetail(detail('BV1', Date.now()));
    const found = await cache.getCachedDetails(['BV1'], 30 * cache.DAY_MS);
    expect(found.get('BV1')?.bvid).toBe('BV1');
  });

  it('getCachedDetails 對過期、schema 不符的列視為 miss（讀路徑本來就有的行為）', async () => {
    const cache = await importCache();
    const stale = detail('BVold', Date.now() - 40 * cache.DAY_MS);
    const badSchema = { ...detail('BVschema', Date.now()), schema: 2 } as unknown as VideoDetail;
    await cache.putDetail(stale);
    await cache.putDetail(badSchema);
    const found = await cache.getCachedDetails(['BVold', 'BVschema'], 30 * cache.DAY_MS);
    expect(found.size).toBe(0);
  });

  it('TTL 過期與 schema 不符的 detail 列，會在下次開啟資料庫時被實際刪除（不是永遠留著）', async () => {
    const cache1 = await importCache();
    const oldEnough = Date.now() - 40 * cache1.DAY_MS; // 超過 DETAIL_TTL_DAYS=30
    await cache1.putDetail(detail('BVold', oldEnough));
    await cache1.putDetail({ ...detail('BVschema', Date.now()), schema: 2 } as unknown as VideoDetail);
    await cache1.putDetail(detail('BVok', Date.now()));
    expect((await cache1.cacheStats()).details).toBe(3);

    // 模擬「重新開啟」：只重置 cache.ts 的 module state，底下的 indexedDB 執行個體沒有換，
    // 資料還在，這次 import 會重新觸發一次 db() → sweepStale。
    const cache2 = await importCache();
    await cache2.getCachedDetails([], cache2.DAY_MS); // 隨便一次呼叫，等 db() 的 sweep 做完
    const stats = await cache2.cacheStats();
    expect(stats.details).toBe(1); // 只剩 BVok
    const remaining = await cache2.getCachedDetails(['BVok'], 30 * cache2.DAY_MS);
    expect(remaining.has('BVok')).toBe(true);
  });

  it('過期的 cover 列也會在下次開啟時被清掉', async () => {
    const cache1 = await importCache();
    await cache1.putCover('BVold', 'data:old', Date.now() - 10 * cache1.DAY_MS); // 超過 COVER_TTL_DAYS=7
    await cache1.putCover('BVok', 'data:ok', Date.now());
    expect((await cache1.cacheStats()).covers).toBe(2);

    const cache2 = await importCache();
    await cache2.getCachedCover('BVok', 30 * cache2.DAY_MS); // 觸發 db() 開啟
    expect((await cache2.cacheStats()).covers).toBe(1);
    expect(await cache2.getCachedCover('BVold', 30 * cache2.DAY_MS)).toBeUndefined();
    expect(await cache2.getCachedCover('BVok', 30 * cache2.DAY_MS)).toBe('data:ok');
  });

  it('封面超過上限時依 LRU（最舊的 fetchedAt）淘汰，不會無上限成長', async () => {
    const cache = await importCache();
    await cache.cacheStats(); // 先觸發一次 db() 開啟，確保 store／index 已經建好
    // 直接對同一個 indexedDB 執行個體批次塞資料（跳過逐筆呼叫 putCover 的淘汰檢查，加速測試）：
    // 塞到剛好在上限，最舊的那筆之後要被新的一筆擠掉。
    const raw = await openDB('bilitidy', 1);
    const tx = raw.transaction('cover', 'readwrite');
    for (let i = 0; i < cache.COVER_CAP; i++) {
      void tx.store.put({ bvid: `seed-${i}`, dataUrl: 'x', fetchedAt: i });
    }
    await tx.done;
    raw.close();
    expect((await cache.cacheStats()).covers).toBe(cache.COVER_CAP);

    // 再寫一筆：應該把 fetchedAt 最小（seed-0，最舊）的那筆擠掉，總數維持在上限
    await cache.putCover('new-one', 'y', cache.COVER_CAP + 1);
    const stats = await cache.cacheStats();
    expect(stats.covers).toBe(cache.COVER_CAP);
    expect(await cache.getCachedCover('seed-0', Number.MAX_SAFE_INTEGER)).toBeUndefined();
    expect(await cache.getCachedCover('seed-1', Number.MAX_SAFE_INTEGER)).toBe('x');
    expect(await cache.getCachedCover('new-one', Number.MAX_SAFE_INTEGER)).toBe('y');
  }, 20_000);

  it('clearCache 清空兩個 store', async () => {
    const cache = await importCache();
    await cache.putDetail(detail('BV1', Date.now()));
    await cache.putCover('BV1', 'x', Date.now());
    await cache.clearCache();
    expect(await cache.cacheStats()).toEqual({ details: 0, covers: 0 });
  });
});

describe('core/cache（帳號活躍度）', () => {
  beforeEach(() => {
    freshDatabase();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('isFresh：unknown 永遠不新鮮，過期也不新鮮', async () => {
    const cache = await importCache();
    const now = Date.now();
    expect(cache.isFresh({ mid: 1, status: 'noVideos', checkedAt: now, schema: 1 }, now)).toBe(true);
    expect(cache.isFresh({ mid: 1, status: 'unknown', checkedAt: now, schema: 1 }, now)).toBe(false);
    expect(cache.isFresh({ mid: 1, status: 'noVideos', checkedAt: now - 31 * cache.DAY_MS, schema: 1 }, now)).toBe(false);
  });

  it('getActivities 預設只回新鮮的；onlyFresh=false 連 unknown 都回；clearActivities 不動影片快取', async () => {
    const cache = await importCache();
    const now = Date.now();
    await cache.putActivity({ mid: 1, status: 'noVideos', checkedAt: now, schema: 1 });
    await cache.putActivity({ mid: 2, status: 'unknown', reason: 'x', checkedAt: now, schema: 1 });
    await cache.putDetail(detail('BV1', now));
    expect(Array.from((await cache.getActivities([1, 2], { onlyFresh: true, now })).keys())).toEqual([1]);
    expect((await cache.getActivities([1, 2], { onlyFresh: false, now })).size).toBe(2);
    expect(await cache.activityStats()).toEqual({ count: 2, oldestAt: now });
    await cache.clearActivities();
    expect(await cache.activityStats()).toEqual({ count: 0, oldestAt: null });
    expect((await cache.cacheStats()).details).toBe(1);
  });
});
