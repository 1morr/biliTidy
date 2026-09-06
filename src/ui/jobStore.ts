import { create } from 'zustand';
import type { PromptFolder } from '@/ai/prompt';
import { clearJobSnapshot, loadJobSnapshot, saveJobSnapshot } from '@/core/jobStore';
import { executeMoves, executeRemovals, executeUndo, planRemovals, planUndo } from '@/core/moves';
import { runOrganize, type BatchRecord } from '@/core/organizer';
import { t } from '@/i18n';
import type { RetryOptions } from '@/net/backoff';
import { toAppError } from '@/shared/result';
import type { FolderMeta, JobPhase, JobStats, Progress, ReviewRow, Settings } from '@/shared/types';
import { claimJob, releaseJob } from './jobGuard';
import { acquireJobLock } from './jobLock';

interface JobState {
  phase: JobPhase;
  progress: Progress | null;
  waitNote: string | null;
  error: string | null;
  rows: ReviewRow[];
  stats: JobStats;
  /** 這次分類的每一批 AI 往返；只放記憶體，重開頁面就沒了 */
  batches: BatchRecord[];
  sourceId: number | null;
  sourceTitle: string;
  targetIds: number[];
  savedAt: number | null;
  /** 這一段（分類或搬移）是什麼時候開始的；用來算已用時間與預估剩餘 */
  startedAt: number | null;

  start: (input: {
    mid: number;
    source: FolderMeta;
    sourceDescription: string;
    targets: PromptFolder[];
    settings: Settings;
    limit?: number;
  }) => Promise<void>;
  cancel: () => void;
  setChosen: (bvid: string, ids: number[]) => void;
  /** 保留原位：目標改用複製，來源那份不動 */
  setKeepSource: (bvid: string, keep: boolean) => void;
  applyAll: (mode: 'suggested' | 'none' | 'keep' | 'moveOut') => void;
  execute: (input: { mid: number; batchSize: number }) => Promise<void>;
  /** 把失效影片從來源收藏夾移除（不可逆） */
  removeInvalid: (input: { batchSize: number }) => Promise<void>;
  /** 把這次已搬移的影片放回來源收藏夾 */
  undoMoves: (input: { mid: number; batchSize: number }) => Promise<void>;
  retryFailed: () => void;
  restore: () => Promise<boolean>;
  discard: () => Promise<void>;
}

const EMPTY_STATS: JobStats = { fetched: 0, cached: 0, aiCalls: 0, moved: 0, copied: 0, failed: 0, removed: 0, detailFailed: 0 };

let controller: AbortController | null = null;

export const useJobStore = create<JobState>((set, get) => {
  const persist = async () => {
    const s = get();
    if (s.sourceId === null) return;
    const savedAt = Date.now();
    await saveJobSnapshot({
      savedAt,
      sourceId: s.sourceId,
      sourceTitle: s.sourceTitle,
      targetIds: s.targetIds,
      rows: s.rows,
      stats: s.stats,
    });
    set({ savedAt });
  };

  /**
   * 三個寫入動作（搬移／移除失效／撤銷）共用的外殼。它們原本各寫一份 40 行，其中 32 行一模一樣，
   * 而漏掉其中任何一段都不會有人立刻發現——尤其是 Web Lock（分頁被凍結時任務會整個停住）
   * 與 persist（重開頁面回不到審核狀態）。加新的寫入流程一律走這一支。
   *
   * **擁有權判斷**：`controller?.abort()` 之後才換上新的 controller，但被中止那一輪的
   * `catch`／`finally`／甚至還沒收到 abort 通知的 `onRow`／`onProgress` 是非同步跑完的——
   * 沒有這層 `isCurrent()` 判斷的話，舊任務事後才 resolve 的 catch 會把新任務剛設好的 phase
   * 蓋掉，`finally` 也會把新任務剛換上的 controller 清成 `null`，讓 `cancel()` 悄悄變成無效果。
   * 判斷法固定用「這個閉包捕捉到的 ctrl 還是不是目前的 controller」，不是比對 signal 或 phase。
   */
  async function runWrite<T>(opts: {
    /** 有事可做才啟動。**必須在 abort 之前判斷**：否則按一下沒事可做的按鈕會殺掉正在跑的任務 */
    canRun?: (rows: ReviewRow[]) => boolean;
    run: (ctx: {
      srcMediaId: number;
      rows: ReviewRow[];
      signal: AbortSignal;
      onRow: () => void;
      onProgress: (p: Progress) => void;
      onWait: NonNullable<RetryOptions['onWait']>;
    }) => Promise<T>;
    /** 成功之後怎麼更新 phase 與 stats */
    settle: (state: JobState, result: T) => Partial<JobState>;
  }): Promise<void> {
    const s = get();
    if (s.sourceId === null) return;
    if (opts.canRun && !opts.canRun(s.rows)) return;
    // 清理關注正在跑時不能寫入：UI 已經把按鈕變灰，這裡是最後一道
    if (!claimJob('organise')) return;
    controller?.abort();
    const ctrl = new AbortController();
    controller = ctrl;
    const signal = ctrl.signal;
    const isCurrent = () => controller === ctrl;
    const releaseLock = acquireJobLock();
    // 寫入流程會就地修改 row，這裡先複製一份給它，再以 onRow 回寫觸發重繪
    const working = s.rows.map((r) => ({ ...r }));
    const byBvid = new Map(working.map((r) => [r.bvid, r]));
    set({ phase: 'moving', error: null, waitNote: null, rows: working, startedAt: Date.now() });
    const sync = () => {
      if (isCurrent()) set({ rows: Array.from(byBvid.values()) });
    };
    try {
      const result = await opts.run({
        srcMediaId: s.sourceId,
        rows: working,
        signal,
        onRow: () => sync(),
        onProgress: (progress) => {
          if (!isCurrent()) return;
          set({ progress, waitNote: null });
          void persist().catch(() => undefined);
        },
        onWait: ({ error, delayMs }) => {
          if (isCurrent()) set({ waitNote: t().progress.retryingIn(error.message, Math.round(delayMs / 1000)) });
        },
      });
      if (!isCurrent()) return; // 這一輪已經被新任務取代，結果不算數
      set((st) => opts.settle(st, result));
    } catch (e) {
      if (!isCurrent()) return; // 同上：被取代的那一輪不可以覆蓋新任務的 phase
      const err = toAppError(e);
      sync();
      set({ phase: err.kind === 'aborted' ? 'review' : 'error', error: err.kind === 'aborted' ? null : err.message });
    } finally {
      if (isCurrent()) {
        controller = null;
        releaseJob('organise');
      }
      releaseLock();
      await persist().catch(() => undefined);
    }
  }

  return {
    phase: 'idle',
    progress: null,
    waitNote: null,
    error: null,
    rows: [],
    stats: EMPTY_STATS,
    batches: [],
    sourceId: null,
    sourceTitle: '',
    targetIds: [],
    savedAt: null,
    startedAt: null,

    async start({ mid, source, sourceDescription, targets, settings, limit }) {
      if (!claimJob('organise')) return;
      controller?.abort();
      const ctrl = new AbortController();
      controller = ctrl;
      const signal = ctrl.signal;
      const isCurrent = () => controller === ctrl;
      const releaseLock = acquireJobLock();
      set({
        phase: 'fetchingList',
        progress: null,
        waitNote: null,
        error: null,
        rows: [],
        stats: EMPTY_STATS,
        batches: [],
        sourceId: source.id,
        sourceTitle: source.title,
        targetIds: targets.map((target) => target.id),
        savedAt: null,
        startedAt: Date.now(),
      });
      const run = () =>
        runOrganize(
          { mid, source, sourceDescription, targets, settings, ...(limit ? { limit } : {}) },
          {
            signal,
            onBatch: (record) => {
              if (isCurrent()) set((st) => ({ batches: [...st.batches, record] }));
            },
            onPhase: (phase) => {
              if (isCurrent()) set({ phase, progress: null, waitNote: null });
            },
            onProgress: (progress) => {
              if (isCurrent()) set({ progress, waitNote: null });
            },
            onWait: ({ error, delayMs }) => {
              if (isCurrent()) set({ waitNote: t().progress.retryingIn(error.message, Math.round(delayMs / 1000)) });
            },
          },
        );
      try {
        const result = await run();
        if (!isCurrent()) return; // 這一輪已經被新任務取代（同一個 controller 擁有權判斷見 runWrite）
        set({
          phase: 'review',
          rows: result.rows,
          stats: {
            ...EMPTY_STATS,
            fetched: result.stats.fetched,
            cached: result.stats.cached,
            aiCalls: result.stats.aiCalls,
            detailFailed: result.stats.detailFailed,
          },
          progress: null,
          waitNote: null,
        });
        await persist().catch(() => undefined);
      } catch (e) {
        if (!isCurrent()) return;
        const err = toAppError(e);
        set({ phase: err.kind === 'aborted' ? 'idle' : 'error', error: err.kind === 'aborted' ? null : err.message });
      } finally {
        if (isCurrent()) {
          controller = null;
          releaseJob('organise');
        }
        releaseLock();
      }
    },

    cancel() {
      controller?.abort();
    },

    setChosen(bvid, ids) {
      set((s) => ({ rows: s.rows.map((r) => (r.bvid === bvid && r.status === 'pending' ? { ...r, chosen: ids } : r)) }));
    },

    setKeepSource(bvid, keep) {
      set((s) => ({
        rows: s.rows.map((r) => (r.bvid === bvid && r.status === 'pending' ? { ...r, keepSource: keep } : r)),
      }));
    },

    /**
     * 待處理的列一次套用同一個決定。keep／moveOut 只改「搬走還是留一份」，不動目標選擇——
     * 使用者按它的時機是「AI 分的都對，但我不想讓影片離開現在的夾子」。
     */
    applyAll(mode) {
      set((s) => ({
        rows: s.rows.map((r) => {
          if (r.status !== 'pending') return r;
          if (mode === 'keep' || mode === 'moveOut') return { ...r, keepSource: mode === 'keep' };
          if (mode === 'none') return { ...r, chosen: [] };
          // 「採用建議」要還原模型的整個決定，包含它有沒有說「留在原地並複製一份」
          return { ...r, chosen: r.suggested, keepSource: !!r.suggestedKeep };
        }),
      }));
    },

    async execute({ mid, batchSize }) {
      await runWrite({
        run: (ctx) => executeMoves({ ...ctx, mid, batchSize }),
        settle: (st, r) => ({
          phase: 'done',
          stats: {
            ...st.stats,
            moved: st.stats.moved + r.moved,
            copied: st.stats.copied + r.copied,
            failed: st.stats.failed + r.failed,
          },
        }),
      });
    },

    async removeInvalid({ batchSize }) {
      await runWrite({
        canRun: (rows) => planRemovals(rows, batchSize).length > 0,
        run: (ctx) => executeRemovals({ ...ctx, batchSize }),
        settle: (st, r) => ({
          // 還有待搬移的列就回到審核，讓使用者接著按「執行搬移」
          phase: st.rows.some((x) => x.status === 'pending') ? 'review' : 'done',
          stats: { ...st.stats, removed: st.stats.removed + r.removed, failed: st.stats.failed + r.failed },
        }),
      });
    },

    async undoMoves({ mid, batchSize }) {
      await runWrite({
        canRun: (rows) => planUndo(rows, batchSize).length > 0,
        run: (ctx) => executeUndo({ ...ctx, mid, batchSize }),
        settle: (st, r) => ({
          phase: 'review',
          // 撤銷掉的不再算進「已搬移」／「已複製」
          stats: {
            ...st.stats,
            moved: Math.max(0, st.stats.moved - r.undone),
            copied: Math.max(0, st.stats.copied - r.copiesUndone),
            failed: st.stats.failed + r.failed,
          },
        }),
      });
    },

    retryFailed() {
      set((s) => ({
        phase: 'review',
        rows: s.rows.map((r) => (r.status === 'failed' ? { ...r, status: 'pending', error: undefined } : r)),
      }));
    },

    async restore() {
      const snap = await loadJobSnapshot();
      if (!snap) return false;
      set({
        phase: snap.rows.some((r) => r.status === 'pending') ? 'review' : 'done',
        rows: snap.rows,
        // 舊快照可能缺欄位（例如 removed）
        stats: { ...EMPTY_STATS, ...snap.stats },
        sourceId: snap.sourceId,
        sourceTitle: snap.sourceTitle,
        targetIds: snap.targetIds,
        savedAt: snap.savedAt,
        startedAt: null,
        error: null,
        progress: null,
      });
      return true;
    },

    async discard() {
      controller?.abort();
      await clearJobSnapshot();
      set({
        phase: 'idle',
        rows: [],
        stats: EMPTY_STATS,
        batches: [],
        sourceId: null,
        sourceTitle: '',
        targetIds: [],
        savedAt: null,
        startedAt: null,
        error: null,
        progress: null,
      });
    },
  };
});
