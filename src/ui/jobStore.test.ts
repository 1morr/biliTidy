import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromptFolder } from '@/ai/prompt';
import { clearJobSnapshot } from '@/core/jobStore';
import { executeMoves, planRemovals, planUndo, type MoveResult } from '@/core/moves';
import { runOrganize, type OrganizeResult } from '@/core/organizer';
import { DEFAULT_SETTINGS } from '@/core/settings';
import { AppError } from '@/shared/result';
import type { FolderMeta, ReviewRow, Settings } from '@/shared/types';
import { useJobStore } from './jobStore';

vi.mock('@/core/jobStore', () => ({
  saveJobSnapshot: vi.fn(async () => undefined),
  loadJobSnapshot: vi.fn(async () => null),
  clearJobSnapshot: vi.fn(async () => undefined),
}));

vi.mock('@/core/moves', () => ({
  executeMoves: vi.fn(),
  executeRemovals: vi.fn(),
  executeUndo: vi.fn(),
  planRemovals: vi.fn(() => [] as ReviewRow[][]),
  planUndo: vi.fn(() => [] as ReviewRow[][]),
}));

vi.mock('@/core/organizer', () => ({
  runOrganize: vi.fn(),
}));

/** 一個可以從外面控制何時 resolve／reject 的 promise，用來卡住 mock 執行器、模擬長時間跑著的任務 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function row(bvid: string, status: ReviewRow['status'] = 'pending'): ReviewRow {
  return { bvid, aid: 1, type: 2, title: bvid, cover: '', suggested: [10], chosen: [10], reason: '', status };
}

const SOURCE: FolderMeta = { id: 1, title: 'src', mediaCount: 10, attr: 0, isPrivate: false, isDefault: true };
const TARGETS: PromptFolder[] = [{ id: 2, title: 'dst', description: '' }];
const SETTINGS: Settings = DEFAULT_SETTINGS;

function resetStore(): void {
  useJobStore.setState({
    phase: 'idle',
    progress: null,
    waitNote: null,
    error: null,
    rows: [],
    stats: { fetched: 0, cached: 0, aiCalls: 0, moved: 0, copied: 0, failed: 0, removed: 0, detailFailed: 0 },
    batches: [],
    sourceId: null,
    sourceTitle: '',
    targetIds: [],
    savedAt: null,
    startedAt: null,
  });
}

describe('ui/jobStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    // 真的 Web Locks 在 Node 這裡會排隊、跨測試互相干擾——這裡的重點是 controller 擁有權，
    // 不是鎖本身，所以換成立刻放行的假鎖。
    vi.stubGlobal('navigator', {
      locks: { request: (_name: string, cb: () => Promise<unknown>) => Promise.resolve(cb()) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('start()', () => {
    it('成功：phase 變 review，rows／stats 從結果帶入', async () => {
      const result: OrganizeResult = {
        rows: [row('BV1')],
        stats: { fetched: 3, cached: 1, aiCalls: 1, parseErrors: 0, detailFailed: 0 },
      };
      vi.mocked(runOrganize).mockResolvedValue(result);
      await useJobStore.getState().start({ mid: 1, source: SOURCE, sourceDescription: '', targets: TARGETS, settings: SETTINGS });
      const s = useJobStore.getState();
      expect(s.phase).toBe('review');
      expect(s.rows).toEqual([row('BV1')]);
      expect(s.stats.fetched).toBe(3);
      expect(s.stats.aiCalls).toBe(1);
    });

    it('被取消（aborted）：回到 idle，不設 error', async () => {
      vi.mocked(runOrganize).mockRejectedValue(new AppError('aborted', '已取消'));
      await useJobStore.getState().start({ mid: 1, source: SOURCE, sourceDescription: '', targets: TARGETS, settings: SETTINGS });
      const s = useJobStore.getState();
      expect(s.phase).toBe('idle');
      expect(s.error).toBeNull();
    });

    it('其他錯誤：phase 變 error，帶上訊息', async () => {
      vi.mocked(runOrganize).mockRejectedValue(new AppError('network', '連線失敗'));
      await useJobStore.getState().start({ mid: 1, source: SOURCE, sourceDescription: '', targets: TARGETS, settings: SETTINGS });
      const s = useJobStore.getState();
      expect(s.phase).toBe('error');
      expect(s.error).toBe('連線失敗');
    });
  });

  /**
   * finding 3：`runWrite`／`start` 在啟動新任務時會 abort 舊的 controller，但舊任務的
   * catch／finally 是非同步跑完的。沒有擁有權判斷的話，舊任務事後才觸發的 catch 會把新任務
   * 剛設好的 phase 蓋掉，finally 也會把新任務剛換上的 controller 清成 null，讓 cancel() 悄悄
   * 變成無效果。這裡把兩種情境（start 重入、execute 重入）都釘住。
   */
  describe('取消與重入（finding 3）', () => {
    it('cancel() 會中止目前這一輪 execute 的 signal', async () => {
      useJobStore.setState({ sourceId: 1, rows: [row('BV1')] });
      const d = deferred<MoveResult>();
      let capturedSignal: AbortSignal | undefined;
      vi.mocked(executeMoves).mockImplementation(async (input) => {
        capturedSignal = input.signal;
        return d.promise;
      });

      const p = useJobStore.getState().execute({ mid: 1, batchSize: 10 });
      expect(capturedSignal?.aborted).toBe(false);
      expect(useJobStore.getState().phase).toBe('moving');

      useJobStore.getState().cancel();
      expect(capturedSignal?.aborted).toBe(true);

      d.reject(new AppError('aborted', '已取消'));
      await p;
      expect(useJobStore.getState().phase).toBe('review');
    });

    it('第二次 execute 取代第一次：第一輪事後才 reject 不會覆蓋第二輪的 phase', async () => {
      useJobStore.setState({ sourceId: 1, rows: [row('BV1')] });
      const d1 = deferred<MoveResult>();
      const d2 = deferred<MoveResult>();
      const signals: AbortSignal[] = [];
      let call = 0;
      vi.mocked(executeMoves).mockImplementation(async (input) => {
        if (input.signal) signals.push(input.signal);
        call += 1;
        return call === 1 ? d1.promise : d2.promise;
      });

      const p1 = useJobStore.getState().execute({ mid: 1, batchSize: 10 });
      const p2 = useJobStore.getState().execute({ mid: 1, batchSize: 10 }); // 取代第一輪
      expect(signals).toHaveLength(2);
      expect(signals[0]?.aborted).toBe(true); // 第一輪已經被 abort
      expect(signals[1]?.aborted).toBe(false); // 第二輪（目前）還在跑

      // 第一輪這時候才「回來」，用一個 aborted 錯誤 reject——這是原本會把 phase 蓋掉的那個時機
      d1.reject(new AppError('aborted', '已取消'));
      await p1;
      // 第二輪還在跑，phase 不該被第一輪的 catch 改掉
      expect(useJobStore.getState().phase).toBe('moving');

      // cancel() 這時候要中止「目前」（第二輪）的任務，不能因為第一輪的 finally 把 controller
      // 清空而變成無效果
      useJobStore.getState().cancel();
      expect(signals[1]?.aborted).toBe(true);

      d2.reject(new AppError('aborted', '已取消'));
      await p2;
      expect(useJobStore.getState().phase).toBe('review');
    });

    it('第二次 execute 取代第一次：第一輪事後才成功 resolve 也不會覆蓋第二輪的結果', async () => {
      useJobStore.setState({ sourceId: 1, rows: [row('BV1')] });
      const d1 = deferred<MoveResult>();
      const d2 = deferred<MoveResult>();
      let call = 0;
      vi.mocked(executeMoves).mockImplementation(async () => {
        call += 1;
        return call === 1 ? d1.promise : d2.promise;
      });

      const p1 = useJobStore.getState().execute({ mid: 1, batchSize: 10 });
      const p2 = useJobStore.getState().execute({ mid: 1, batchSize: 10 });

      // 第一輪「成功」了（不是取消），如果沒有擁有權判斷，這會把 phase 設成 done 蓋掉第二輪
      d1.resolve({ moved: 999, copied: 0, failed: 0 });
      await p1;
      expect(useJobStore.getState().phase).toBe('moving'); // 還是第二輪在跑，不是被第一輪蓋成 done
      expect(useJobStore.getState().stats.moved).toBe(0); // 第一輪的結果沒有被採計

      d2.resolve({ moved: 1, copied: 0, failed: 0 });
      await p2;
      expect(useJobStore.getState().phase).toBe('done');
      expect(useJobStore.getState().stats.moved).toBe(1);
    });

    it('start() 重入時同樣不會被舊任務的非同步收尾蓋掉', async () => {
      const d1 = deferred<OrganizeResult>();
      const d2 = deferred<OrganizeResult>();
      let call = 0;
      vi.mocked(runOrganize).mockImplementation(async () => {
        call += 1;
        return call === 1 ? d1.promise : d2.promise;
      });

      const p1 = useJobStore
        .getState()
        .start({ mid: 1, source: SOURCE, sourceDescription: '', targets: TARGETS, settings: SETTINGS });
      const p2 = useJobStore
        .getState()
        .start({ mid: 1, source: SOURCE, sourceDescription: '', targets: TARGETS, settings: SETTINGS });

      d1.reject(new AppError('aborted', '已取消'));
      await p1;
      // 第一輪的 catch 不該把第二輪還在 fetchingList／進行中的 phase 蓋成 idle
      expect(useJobStore.getState().phase).not.toBe('idle');

      const result: OrganizeResult = {
        rows: [row('BV9')],
        stats: { fetched: 1, cached: 0, aiCalls: 1, parseErrors: 0, detailFailed: 0 },
      };
      d2.resolve(result);
      await p2;
      expect(useJobStore.getState().phase).toBe('review');
      expect(useJobStore.getState().rows).toEqual([row('BV9')]);
    });
  });

  describe('canRun 閘門', () => {
    it('removeInvalid：沒有東西可移除時不會呼叫 executeRemovals，也不改 phase', async () => {
      vi.mocked(planRemovals).mockReturnValue([]);
      useJobStore.setState({ sourceId: 1, rows: [row('BV1')], phase: 'review' });
      await useJobStore.getState().removeInvalid({ batchSize: 10 });
      expect(useJobStore.getState().phase).toBe('review');
    });

    it('undoMoves：沒有東西可撤銷時不會呼叫 executeUndo，也不改 phase', async () => {
      vi.mocked(planUndo).mockReturnValue([]);
      useJobStore.setState({ sourceId: 1, rows: [row('BV1', 'done')], phase: 'done' });
      await useJobStore.getState().undoMoves({ mid: 1, batchSize: 10 });
      expect(useJobStore.getState().phase).toBe('done');
    });
  });

  describe('其他純狀態轉換', () => {
    it('retryFailed：failed 列變回 pending，phase 回 review', () => {
      useJobStore.setState({ rows: [row('BV1', 'failed'), row('BV2', 'done')] });
      useJobStore.getState().retryFailed();
      const s = useJobStore.getState();
      expect(s.phase).toBe('review');
      expect(s.rows.find((r) => r.bvid === 'BV1')?.status).toBe('pending');
      expect(s.rows.find((r) => r.bvid === 'BV2')?.status).toBe('done');
    });

    it('discard：清空狀態並呼叫 clearJobSnapshot', async () => {
      useJobStore.setState({ sourceId: 1, rows: [row('BV1')], phase: 'review' });
      await useJobStore.getState().discard();
      expect(clearJobSnapshot).toHaveBeenCalledOnce();
      expect(useJobStore.getState().phase).toBe('idle');
      expect(useJobStore.getState().rows).toEqual([]);
      expect(useJobStore.getState().sourceId).toBeNull();
    });

    it('applyAll("採用建議")：還原 chosen 與 suggestedKeep，不動非 pending 的列', () => {
      const suggestedRow: ReviewRow = { ...row('BV1'), chosen: [], suggested: [5], suggestedKeep: true };
      const doneRow = row('BV2', 'done');
      useJobStore.setState({ rows: [suggestedRow, doneRow] });
      useJobStore.getState().applyAll('suggested');
      const s = useJobStore.getState();
      expect(s.rows.find((r) => r.bvid === 'BV1')).toMatchObject({ chosen: [5], keepSource: true });
      expect(s.rows.find((r) => r.bvid === 'BV2')).toEqual(doneRow);
    });
  });
});
