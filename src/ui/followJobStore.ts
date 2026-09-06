import { create } from 'zustand';
import { canSelect } from '@/core/activity';
import { checkActivity, type CheckResult, type StopReason } from '@/core/checkActivity';
import { fetchFollowSnapshot } from '@/core/fetchFollows';
import { clearFollowJobSnapshot, loadFollowJobSnapshot, saveFollowJobSnapshot } from '@/core/jobStore';
import { executeRestore, executeUnfollow, type WriteResult } from '@/core/unfollow';
import { t } from '@/i18n';
import type { RetryOptions } from '@/net/backoff';
import { toAppError } from '@/shared/result';
import type { FollowPhase, FollowRow, FollowStats, FollowTag, Progress, Settings } from '@/shared/types';
import { claimJob, releaseJob } from './jobGuard';
import { acquireJobLock } from './jobLock';

/**
 * 清理關注的任務狀態機（讀清單 → 查活躍度 → 審核 → 取關 → 撤銷）。
 * 與 `jobStore.ts`（整理收藏）是同一個模式：AbortController 擁有權判斷、Web Lock、快照；
 * 兩者靠 `jobGuard.ts` 互斥，一次只有一種任務在跑。
 */
interface FollowJobState {
  phase: FollowPhase;
  progress: Progress | null;
  waitNote: string | null;
  error: string | null;
  /** 上一輪提前停下的原因（風控／取消／未登入），審核畫面用橫幅顯示；null＝跑完了 */
  stopped: { reason: StopReason; remaining: number; detail: string } | null;
  mid: number | null;
  rows: FollowRow[];
  /** 勾選的 mid。只會含 `canSelect` 的列——寫入之後會把不再 pending 的清掉 */
  selected: ReadonlySet<number>;
  tags: FollowTag[];
  reported: { following: number; whisper: number } | null;
  fetchedAt: number | null;
  savedAt: number | null;
  /** 這一段（查活躍或取關）是什麼時候開始的；用來算已用時間與預估剩餘 */
  startedAt: number | null;
  stats: FollowStats;

  start: (input: { mid: number; settings: Settings; mode: 'missing' | 'all' }) => Promise<void>;
  cancel: () => void;
  toggle: (mid: number) => void;
  setSelected: (mids: number[], on: boolean) => void;
  clearSelection: () => void;
  unfollow: () => Promise<void>;
  /** 撤銷：把這次已取關的重新關注並還原分組 */
  restore: () => Promise<void>;
  retryFailed: () => void;
  restoreSnapshot: () => Promise<boolean>;
  discard: () => Promise<void>;
}

const EMPTY_STATS: FollowStats = { fetched: 0, cached: 0, unknown: 0, unfollowed: 0, failed: 0, restored: 0 };

let controller: AbortController | null = null;

/** 只存原始資料，句子交給畫面依目前語言組：存翻好的字串的話，切換語言後快照裡的橫幅還是舊語言 */
function stoppedOf(result: CheckResult): { reason: StopReason; remaining: number; detail: string } | null {
  if (!result.stopped) return null;
  const { reason, message, remaining } = result.stopped;
  return { reason, remaining, detail: message };
}

export const useFollowJobStore = create<FollowJobState>((set, get) => {
  const persist = async () => {
    const s = get();
    if (s.mid === null || s.rows.length === 0) return;
    const savedAt = Date.now();
    await saveFollowJobSnapshot({
      savedAt,
      mid: s.mid,
      fetchedAt: s.fetchedAt ?? savedAt,
      tags: s.tags,
      reported: s.reported ?? { following: 0, whisper: 0 },
      rows: s.rows,
      selected: Array.from(s.selected),
      stats: s.stats,
      ...(s.stopped ? { stopped: s.stopped } : {}),
    });
    set({ savedAt });
  };

  /**
   * 取關與撤銷共用的外殼：互斥、Web Lock、擁有權判斷、就地修改後回寫、快照。
   *
   * **擁有權判斷**：`controller?.abort()` 之後才換上新的 controller，但被中止那一輪的
   * catch／finally 是非同步跑完的——沒有 `isCurrent()` 的話，舊任務事後才 resolve 的 catch
   * 會把新任務剛設好的 phase 蓋掉。判斷法固定用「這個閉包捕捉到的 ctrl 還是不是目前的 controller」。
   */
  async function runWrite(opts: {
    phase: 'unfollowing' | 'restoring';
    pick: (rows: FollowRow[]) => FollowRow[];
    run: (
      targets: FollowRow[],
      ctx: {
        signal: AbortSignal;
        onRow: () => void;
        onProgress: (p: Progress) => void;
        onWait: NonNullable<RetryOptions['onWait']>;
      },
    ) => Promise<WriteResult>;
    settle: (stats: FollowStats, result: WriteResult) => FollowStats;
  }): Promise<void> {
    const s = get();
    if (s.mid === null) return;
    // 寫入流程會就地修改 row，這裡先複製一份給它，再以 onRow 回寫觸發重繪
    const working = s.rows.map((r) => ({ ...r }));
    const targets = opts.pick(working);
    if (targets.length === 0) return;
    // 整理收藏正在跑時不能寫入：UI 已經把按鈕變灰，這裡是最後一道
    if (!claimJob('follows')) return;
    controller?.abort();
    const ctrl = new AbortController();
    controller = ctrl;
    const isCurrent = () => controller === ctrl;
    const releaseLock = acquireJobLock();
    set({ phase: opts.phase, error: null, waitNote: null, rows: working, startedAt: Date.now(), progress: null });
    const sync = () => {
      if (isCurrent()) set({ rows: [...working] });
    };
    try {
      const result = await opts.run(targets, {
        signal: ctrl.signal,
        onRow: sync,
        onProgress: (progress) => {
          if (isCurrent()) set({ progress, waitNote: null });
        },
        onWait: ({ error, delayMs }) => {
          if (isCurrent()) set({ waitNote: t().progress.retryingIn(error.message, Math.round(delayMs / 1000)) });
        },
      });
      if (!isCurrent()) return;
      const pending = new Set(working.filter((r) => canSelect(r)).map((r) => r.entry.mid));
      set((st) => ({
        phase: 'review',
        progress: null,
        waitNote: null,
        rows: [...working],
        // 已經寫掉的列不再是可勾選的，從勾選集合裡拿掉
        selected: new Set(Array.from(st.selected).filter((mid) => pending.has(mid))),
        stats: opts.settle(st.stats, result),
        error: result.stopped ? t().follows.job.writeStopped(result.stopped.message, result.stopped.remaining) : null,
      }));
    } catch (e) {
      if (!isCurrent()) return;
      const err = toAppError(e);
      set({
        phase: 'review',
        progress: null,
        waitNote: null,
        rows: [...working],
        error: err.kind === 'aborted' ? null : err.message,
      });
    } finally {
      if (isCurrent()) {
        controller = null;
        releaseJob('follows');
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
    stopped: null,
    mid: null,
    rows: [],
    selected: new Set<number>(),
    tags: [],
    reported: null,
    fetchedAt: null,
    savedAt: null,
    startedAt: null,
    stats: EMPTY_STATS,

    async start({ mid, settings, mode }) {
      if (!claimJob('follows')) return;
      controller?.abort();
      const ctrl = new AbortController();
      controller = ctrl;
      const signal = ctrl.signal;
      const isCurrent = () => controller === ctrl;
      const releaseLock = acquireJobLock();
      set({
        phase: 'fetchingFollows',
        progress: null,
        waitNote: null,
        error: null,
        stopped: null,
        mid,
        rows: [],
        selected: new Set<number>(),
        savedAt: null,
        startedAt: Date.now(),
        stats: EMPTY_STATS,
      });
      const onWait: NonNullable<RetryOptions['onWait']> = ({ error, delayMs }) => {
        if (isCurrent()) set({ waitNote: t().progress.retryingIn(error.message, Math.round(delayMs / 1000)) });
      };
      const onProgress = (progress: Progress) => {
        if (isCurrent()) set({ progress, waitNote: null });
      };
      try {
        const snap = await fetchFollowSnapshot(mid, {
          includeWhispers: settings.follows.includeWhispers,
          signal,
          onProgress,
          onWait,
        });
        if (!isCurrent()) return;
        const rows: FollowRow[] = snap.entries.map((entry) => ({ entry, status: 'pending' }));
        const byMid = new Map(rows.map((r) => [r.entry.mid, r]));
        set({ phase: 'checking', rows, tags: snap.tags, reported: snap.reported, fetchedAt: snap.fetchedAt, progress: null });

        const result = await checkActivity(snap.entries, {
          mode,
          signal,
          onProgress,
          onWait,
          onRecord: (record) => {
            const row = byMid.get(record.mid);
            if (!row) return;
            row.activity = record;
            // 一秒一筆的頻率下重建陣列很便宜；執行中的左軌靠它顯示「目前為止不活躍 N 個」
            if (isCurrent()) set({ rows: [...rows] });
          },
        });
        if (!isCurrent()) return;
        for (const [rowMid, record] of result.records) {
          const row = byMid.get(rowMid);
          if (row) row.activity = record;
        }
        set({
          phase: 'review',
          rows: [...rows],
          stats: {
            ...EMPTY_STATS,
            fetched: result.stats.fetched,
            cached: result.stats.cached,
            unknown: rows.filter((r) => !r.activity || r.activity.status === 'unknown').length,
          },
          stopped: stoppedOf(result),
          progress: null,
          waitNote: null,
        });
        await persist().catch(() => undefined);
      } catch (e) {
        if (!isCurrent()) return;
        const err = toAppError(e);
        // 讀關注清單時取消：什麼都還沒有，回到準備畫面；其他錯誤留在錯誤畫面讓人看得到原因
        set({
          phase: err.kind === 'aborted' ? 'idle' : 'error',
          error: err.kind === 'aborted' ? null : err.message,
          progress: null,
        });
      } finally {
        if (isCurrent()) {
          controller = null;
          releaseJob('follows');
        }
        releaseLock();
      }
    },

    cancel() {
      controller?.abort();
    },

    toggle(mid) {
      set((s) => {
        const row = s.rows.find((r) => r.entry.mid === mid);
        if (!row || !canSelect(row)) return {};
        const next = new Set(s.selected);
        if (next.has(mid)) next.delete(mid);
        else next.add(mid);
        return { selected: next };
      });
    },

    setSelected(mids, on) {
      set((s) => {
        const next = new Set(s.selected);
        const selectable = new Set(s.rows.filter(canSelect).map((r) => r.entry.mid));
        for (const mid of mids) {
          if (!selectable.has(mid)) continue;
          if (on) next.add(mid);
          else next.delete(mid);
        }
        return { selected: next };
      });
    },

    clearSelection() {
      set({ selected: new Set<number>() });
    },

    async unfollow() {
      const selected = get().selected;
      await runWrite({
        phase: 'unfollowing',
        pick: (rows) => rows.filter((r) => selected.has(r.entry.mid) && canSelect(r)),
        run: (targets, ctx) => executeUnfollow(targets, ctx),
        settle: (stats, r) => ({ ...stats, unfollowed: stats.unfollowed + r.done, failed: stats.failed + r.failed }),
      });
    },

    async restore() {
      await runWrite({
        phase: 'restoring',
        pick: (rows) => rows.filter((r) => r.status === 'done'),
        run: (targets, ctx) => executeRestore(targets, ctx),
        settle: (stats, r) => ({
          ...stats,
          restored: stats.restored + r.done,
          unfollowed: Math.max(0, stats.unfollowed - r.done),
          failed: stats.failed + r.failed,
        }),
      });
    },

    retryFailed() {
      set((s) => ({
        rows: s.rows.map((r) => {
          // 取關失敗的回到待處理；撤銷失敗的帳號其實還是取關狀態，回到 done 讓人可以再撤銷一次
          if (r.status === 'failed') return { ...r, status: 'pending', error: undefined };
          if (r.status === 'restoreFailed') return { ...r, status: 'done', error: undefined };
          return r;
        }),
      }));
    },

    async restoreSnapshot() {
      const snap = await loadFollowJobSnapshot();
      if (!snap || snap.rows.length === 0) return false;
      const selectable = new Set(snap.rows.filter(canSelect).map((r) => r.entry.mid));
      set({
        phase: 'review',
        mid: snap.mid,
        rows: snap.rows,
        selected: new Set(snap.selected.filter((mid) => selectable.has(mid))),
        tags: snap.tags,
        reported: snap.reported,
        fetchedAt: snap.fetchedAt,
        savedAt: snap.savedAt,
        stats: { ...EMPTY_STATS, ...snap.stats },
        stopped: snap.stopped ?? null,
        startedAt: null,
        error: null,
        progress: null,
      });
      return true;
    },

    async discard() {
      controller?.abort();
      await clearFollowJobSnapshot();
      set({
        phase: 'idle',
        rows: [],
        selected: new Set<number>(),
        tags: [],
        reported: null,
        fetchedAt: null,
        savedAt: null,
        startedAt: null,
        stats: EMPTY_STATS,
        stopped: null,
        error: null,
        progress: null,
      });
    },
  };
});
