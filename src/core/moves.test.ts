import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import type { ReviewRow } from '@/shared/types';
import { executeMoves, executeRemovals, executeUndo, planMoves, planRemovals, planUndo } from './moves';
import { writeQueue } from './scheduler';

function row(bvid: string, chosen: number[], status: ReviewRow['status'] = 'pending'): ReviewRow {
  return { bvid, aid: Number(bvid.slice(2)), type: 2, title: bvid, cover: '', suggested: chosen, chosen, reason: '', status };
}

function invalidRow(bvid: string, status: ReviewRow['status'] = 'pending'): ReviewRow {
  return { ...row(bvid, [], status), invalid: true };
}

function keepRow(bvid: string, chosen: number[], status: ReviewRow['status'] = 'pending'): ReviewRow {
  return { ...row(bvid, chosen, status), keepSource: true };
}

describe('planMoves', () => {
  it('同目標合併並依 batchSize 切批；多目標前 n-1 copy、最後 move；copy 排在 move 前', () => {
    const rows = [row('BV1', [10]), row('BV2', [10]), row('BV3', [20, 10]), row('BV4', []), row('BV5', [30], 'done')];
    const steps = planMoves(rows, 2);
    expect(steps.map((s) => [s.op, s.tarMediaId, s.rows.map((r) => r.bvid)])).toEqual([
      ['copy', 20, ['BV3']],
      ['move', 10, ['BV1', 'BV2']],
      ['move', 10, ['BV3']],
    ]);
  });

  it('保留原位：每個目標都用 copy，不發 move', () => {
    const steps = planMoves([keepRow('BV1', [10, 20]), row('BV2', [10])], 20);
    expect(steps.map((s) => [s.op, s.tarMediaId, s.rows.map((r) => r.bvid)])).toEqual([
      ['copy', 10, ['BV1']],
      ['copy', 20, ['BV1']],
      ['move', 10, ['BV2']],
    ]);
  });

  it('沒有待搬的列 → 空計畫', () => {
    expect(planMoves([row('BV1', [])], 20)).toEqual([]);
  });

  it('已移除的列不再排入搬移', () => {
    expect(planMoves([invalidRow('BV9', 'removed')], 20)).toEqual([]);
  });
});

describe('planRemovals', () => {
  it('只收失效影片，依 batchSize 切批', () => {
    const rows = [invalidRow('BV1'), row('BV2', [10]), invalidRow('BV3'), invalidRow('BV4')];
    expect(planRemovals(rows, 2).map((b) => b.map((r) => r.bvid))).toEqual([['BV1', 'BV3'], ['BV4']]);
  });

  it('已移除的不重排，失敗的可重試', () => {
    const rows = [invalidRow('BV1', 'removed'), invalidRow('BV2', 'failed'), invalidRow('BV3', 'moving')];
    expect(planRemovals(rows, 20).map((b) => b.map((r) => r.bvid))).toEqual([['BV2']]);
  });

  it('沒有失效影片 → 空計畫', () => {
    expect(planRemovals([row('BV1', [10])], 20)).toEqual([]);
  });
});

describe('planUndo', () => {
  const done = (bvid: string, chosen: number[]): ReviewRow => row(bvid, chosen, 'done');

  it('單目標：從目標搬回來源，同目標合併並切批', () => {
    const steps = planUndo([done('BV1', [10]), done('BV2', [10]), done('BV3', [20])], 2);
    expect(steps.map((s) => [s.op, s.fromMediaId, s.rows.map((r) => r.bvid)])).toEqual([
      ['move', 10, ['BV1', 'BV2']],
      ['move', 20, ['BV3']],
    ]);
  });

  it('多目標：最後一個搬回來源，其餘移除複本，move 排在 remove 前', () => {
    const steps = planUndo([done('BV1', [20, 10])], 20);
    expect(steps.map((s) => [s.op, s.fromMediaId])).toEqual([
      ['move', 10],
      ['remove', 20],
    ]);
  });

  it('保留原位：只移除複本，不搬回來源（來源那份從頭到尾沒被動過）', () => {
    const steps = planUndo([keepRow('BV1', [10, 20], 'done')], 20);
    expect(steps.map((s) => [s.op, s.fromMediaId])).toEqual([
      ['remove', 10],
      ['remove', 20],
    ]);
  });

  it('只處理已搬移的列', () => {
    expect(planUndo([row('BV1', [10]), row('BV2', [10], 'failed'), done('BV3', [])], 20)).toEqual([]);
  });
});

/**
 * 取消（或任何例外）之後，列不可以留在 `moving`：那個狀態在 UI 上是「搬移中…」，
 * 不算待搬移、不能編輯、「失敗的重新排入」也管不到，而且會被寫進任務快照。
 */
describe('中斷後的收尾', () => {
  // 一個永遠不 resolve、只在 abort 時 reject 的 fetch，模擬「請求送出去了但使用者按取消」
  const hangingFetch = () =>
    vi.stubGlobal(
      'fetch',
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );

  const cancelDuring = async (start: (signal: AbortSignal) => Promise<unknown>) => {
    hangingFetch();
    (browser as unknown as { cookies: unknown }).cookies = { get: async () => ({ value: 'csrf' }) };
    const ctrl = new AbortController();
    const running = start(ctrl.signal).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 20));
    ctrl.abort();
    await running;
  };

  it('搬移途中取消 → failed（可用「失敗的重新排入」再試）', async () => {
    const rows = [row('BV1', [10]), row('BV2', [10])];
    await cancelDuring((signal) => executeMoves({ mid: 1, srcMediaId: 9, rows, batchSize: 20, signal }));
    expect(rows.map((r) => r.status)).toEqual(['failed', 'failed']);
    expect(rows[0]?.error).toContain("isn't clear");
  });

  it('移除失效途中取消 → failed', async () => {
    const rows = [invalidRow('BV3')];
    await cancelDuring((signal) => executeRemovals({ srcMediaId: 9, rows, batchSize: 20, signal }));
    expect(rows[0]?.status).toBe('failed');
  });

  it('撤銷途中取消 → 回到 done，還可以再撤銷一次', async () => {
    const rows = [row('BV4', [10], 'done')];
    await cancelDuring((signal) => executeUndo({ mid: 1, srcMediaId: 9, rows, batchSize: 20, signal }));
    expect(rows[0]?.status).toBe('done');
  });
});

/**
 * 保留原位的列只發 copy，所以「什麼時候算完成」不能再靠 move 那一步——
 * 兩份複本都寫完才算 done，而且要計進 copied 而不是 moved。
 */
describe('保留原位的寫入與撤銷', () => {
  const okFetch = (calls: string[]) =>
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push(`${new URL(url).pathname} ${new URLSearchParams(init.body as URLSearchParams).toString()}`);
      return new Response('{"code":0,"data":{}}', { status: 200, headers: { 'content-type': 'application/json' } });
    });

  beforeEach(() => {
    (browser as unknown as { cookies: unknown }).cookies = { get: async () => ({ value: 'csrf' }) };
    writeQueue.setInterval(0);
  });

  it('兩個目標都 copy 完才算完成，計進 copied', async () => {
    const calls: string[] = [];
    okFetch(calls);
    const rows = [keepRow('BV1', [10, 20])];
    const result = await executeMoves({ mid: 1, srcMediaId: 9, rows, batchSize: 20 });
    expect(result).toEqual({ moved: 0, copied: 1, failed: 0 });
    expect(rows[0]?.status).toBe('done');
    expect(calls.map((c) => c.split(' ')[0])).toEqual(['/x/v3/fav/resource/copy', '/x/v3/fav/resource/copy']);
    expect(calls[0]).toContain('tar_media_id=10');
    expect(calls[1]).toContain('tar_media_id=20');
  });

  it('撤銷只移除複本，來源不動', async () => {
    const calls: string[] = [];
    okFetch(calls);
    const rows = [keepRow('BV1', [10, 20], 'done')];
    const result = await executeUndo({ mid: 1, srcMediaId: 9, rows, batchSize: 20 });
    expect(result).toEqual({ undone: 0, copiesUndone: 1, failed: 0 });
    expect(calls.map((c) => c.split(' ')[0])).toEqual(['/x/v3/fav/resource/batch-del', '/x/v3/fav/resource/batch-del']);
    expect(rows[0]).toMatchObject({ status: 'pending', chosen: [] });
  });
});
