import { copyResources, moveResources, removeResources, type ResourceRef } from '@/bilibili/fav';
import { t } from '@/i18n';
import { isFatal, runWithSplit, withRetry, type RetryOptions } from '@/net/backoff';
import { throwIfAborted } from '@/net/sleep';
import { chunk } from '@/shared/array';
import type { Progress, ReviewRow } from '@/shared/types';
import { writeQueue } from './scheduler';

export interface MovePlanStep {
  /** copy = 複製到目標（保留來源）；move = 搬到目標（來源移除） */
  op: 'copy' | 'move';
  tarMediaId: number;
  rows: ReviewRow[];
}

/** 把一列掛到某個收藏夾的批次群組上 */
function push(map: Map<number, ReviewRow[]>, key: number, row: ReviewRow): void {
  const g = map.get(key) ?? [];
  g.push(row);
  map.set(key, g);
}

/**
 * 把審核列轉成批次計畫：同目標合併；多目標的影片前 n-1 個 copy、最後一個 move。
 * copy 步驟排在 move 之前，避免來源先被搬走導致 copy 失敗。
 *
 * `keepSource` 的列（保留原位）每個目標都用 copy，完全不發 move：來源那份不會被動到。
 */
export function planMoves(rows: ReviewRow[], batchSize: number): MovePlanStep[] {
  const copyGroups = new Map<number, ReviewRow[]>();
  const moveGroups = new Map<number, ReviewRow[]>();
  for (const row of rows) {
    if (row.status !== 'pending' || row.chosen.length === 0) continue;
    if (row.keepSource) {
      for (const target of row.chosen) push(copyGroups, target, row);
      continue;
    }
    const last = row.chosen[row.chosen.length - 1];
    if (last === undefined) continue;
    for (const target of row.chosen.slice(0, -1)) push(copyGroups, target, row);
    push(moveGroups, last, row);
  }
  const steps: MovePlanStep[] = [];
  for (const [tar, group] of copyGroups) {
    for (const batch of chunk(group, batchSize)) steps.push({ op: 'copy', tarMediaId: tar, rows: batch });
  }
  for (const [tar, group] of moveGroups) {
    for (const batch of chunk(group, batchSize)) steps.push({ op: 'move', tarMediaId: tar, rows: batch });
  }
  return steps;
}

/**
 * 中斷（取消或例外）時把還停在 `moving` 的列收尾。不收的話那幾列會永遠顯示「搬移中…」：
 * 不算在待搬移裡、不能編輯、「失敗的重新排入」也只處理 failed，而且會被寫進任務快照。
 * 那一批到底有沒有寫進 B 站是不確定的，所以訊息要講清楚。
 */
function settleInterrupted(
  rows: ReviewRow[],
  status: ReviewRow['status'],
  message: string,
  onRow?: (row: ReviewRow) => void,
): void {
  for (const r of rows) {
    if (r.status !== 'moving') continue;
    r.status = status;
    r.error = message;
    onRow?.(r);
  }
}

const INTERRUPTED = () => t().errors.moves.interrupted;

export interface UndoStep {
  /** move = 從目標搬回來源；remove = 把當初 copy 出去的複本取消收藏 */
  op: 'move' | 'remove';
  /** 要從哪個收藏夾撤回 */
  fromMediaId: number;
  rows: ReviewRow[];
}

/**
 * 撤銷計畫：把「已搬移」的列放回來源收藏夾。
 * 當初多目標是前 n-1 個 copy、最後一個 move，所以反過來是最後一個 move 回來源、
 * 其餘把複本移除；move 排在 remove 前面，讓影片在任何時刻都至少存在於一個收藏夾。
 *
 * `keepSource` 的列當初全部是 copy、來源沒被動過，撤銷就只是把複本移除。
 */
export function planUndo(rows: ReviewRow[], batchSize: number): UndoStep[] {
  const moveGroups = new Map<number, ReviewRow[]>();
  const removeGroups = new Map<number, ReviewRow[]>();
  for (const row of rows) {
    if (row.status !== 'done' || row.chosen.length === 0) continue;
    if (row.keepSource) {
      for (const target of row.chosen) push(removeGroups, target, row);
      continue;
    }
    const last = row.chosen[row.chosen.length - 1];
    if (last === undefined) continue;
    push(moveGroups, last, row);
    for (const target of row.chosen.slice(0, -1)) push(removeGroups, target, row);
  }
  const steps: UndoStep[] = [];
  const spread = (map: Map<number, ReviewRow[]>, op: UndoStep['op']) => {
    for (const [from, group] of map) {
      for (const batch of chunk(group, batchSize)) steps.push({ op, fromMediaId: from, rows: batch });
    }
  };
  spread(moveGroups, 'move');
  spread(removeGroups, 'remove');
  return steps;
}

export interface UndoInput {
  mid: number;
  /** 當初的來源收藏夾，影片要搬回這裡 */
  srcMediaId: number;
  rows: ReviewRow[];
  batchSize: number;
  signal?: AbortSignal;
  onRow?: (row: ReviewRow) => void;
  onProgress?: (p: Progress) => void;
  onWait?: RetryOptions['onWait'];
}

export interface UndoResult {
  /** 搬回來源的支數 */
  undone: number;
  /** 保留原位那批被移掉的複本支數（來源本來就沒動過） */
  copiesUndone: number;
  failed: number;
}

/**
 * 撤銷已完成的搬移。成功的列回到「待搬移」但清空目標選擇，
 * 避免使用者一按「執行搬移」又把剛撤銷的決定重做一次。
 */
export async function executeUndo(input: UndoInput): Promise<UndoResult> {
  const current = { op: 'move' as UndoStep['op'] };
  try {
    return await runUndo(input, current);
  } finally {
    // move 中斷：影片可能還在目標夾，保持 done 讓使用者可以再按一次「撤銷」。
    // remove 中斷：影片已經回到來源，只是複本可能還在，回到 pending。
    settleInterrupted(input.rows, current.op === 'move' ? 'done' : 'pending', INTERRUPTED(), input.onRow);
  }
}

async function runUndo(input: UndoInput, current: { op: UndoStep['op'] }): Promise<UndoResult> {
  const steps = planUndo(input.rows, input.batchSize);
  // 搬回來源成功的列才處理複本：move 失敗代表影片還在目標，留著整列等下次重試比較單純。
  // 保留原位的列當初沒有 move（來源那份一直都在），所以直接視為已經回到來源。
  const movedBack = new Set(input.rows.filter((r) => r.keepSource).map((r) => r.bvid));
  const copiesUndone = new Set<string>();
  let undone = 0;
  let failed = 0;

  for (const [i, step] of steps.entries()) {
    throwIfAborted(input.signal);
    current.op = step.op;
    const label = step.op === 'move' ? t().progress.moveBack : t().progress.removeCopy;
    input.onProgress?.({
      done: i,
      total: steps.length,
      label: t().progress.undoBatch(label, i + 1, steps.length, step.rows.length),
    });
    const pending = step.op === 'move' ? step.rows : step.rows.filter((r) => movedBack.has(r.bvid));
    if (pending.length === 0) continue;
    for (const r of pending) {
      r.status = 'moving';
      r.error = undefined;
      input.onRow?.(r);
    }
    const exec = async (rows: ReviewRow[]) => {
      const items: ResourceRef[] = rows.map((r) => ({ aid: r.aid, type: r.type }));
      await writeQueue.run(
        () =>
          withRetry(
            () =>
              step.op === 'move'
                ? moveResources(
                    { srcMediaId: step.fromMediaId, tarMediaId: input.srcMediaId, mid: input.mid, items },
                    input.signal,
                  )
                : removeResources(step.fromMediaId, items, input.signal),
            { signal: input.signal, onWait: input.onWait },
          ),
        input.signal,
      );
      for (const r of rows) {
        r.status = 'pending';
        r.chosen = [];
        input.onRow?.(r);
        if (step.op === 'move') movedBack.add(r.bvid);
        else if (r.keepSource) copiesUndone.add(r.bvid);
      }
      if (step.op === 'move') undone += rows.length;
    };
    await runWithSplit(pending, exec, (rows, error) => {
      for (const r of rows) {
        // move 失敗＝還在目標裡，留成 done 以便再按一次撤銷；remove 失敗＝影片已回來源，只是複本還在
        r.status = step.op === 'move' ? 'done' : 'pending';
        r.error = step.op === 'move' ? error.message : t().errors.moves.copyNotRemoved(error.message);
        failed++;
        input.onRow?.(r);
      }
      // 風控／未登入：後面的步驟燒完整輪退避也只會失敗，丟出去中止剩下的批次（未觸及的列維持原狀態，之後可再試）
      if (isFatal(error)) throw error;
    });
  }
  const total = undone + copiesUndone.size;
  input.onProgress?.({ done: steps.length, total: steps.length, label: t().progress.undoDone(total, failed) });
  return { undone, copiesUndone: copiesUndone.size, failed };
}

export interface ExecuteMovesInput {
  mid: number;
  srcMediaId: number;
  rows: ReviewRow[];
  batchSize: number;
  signal?: AbortSignal;
  onRow?: (row: ReviewRow) => void;
  onProgress?: (p: Progress) => void;
  onWait?: RetryOptions['onWait'];
}

export interface MoveResult {
  /** 從來源搬走的支數 */
  moved: number;
  /** 保留原位、只複製出去的支數 */
  copied: number;
  failed: number;
}

/** 依計畫序列執行（writeQueue 限速），每列狀態透過 onRow 回報；-632 自動對半拆。 */
export async function executeMoves(input: ExecuteMovesInput): Promise<MoveResult> {
  try {
    return await runMoves(input);
  } finally {
    settleInterrupted(input.rows, 'failed', INTERRUPTED(), input.onRow);
  }
}

async function runMoves(input: ExecuteMovesInput): Promise<MoveResult> {
  const steps = planMoves(input.rows, input.batchSize);
  const failedBvids = new Set<string>();
  // 一列可能橫跨好幾個步驟（多目標，或保留原位時的每一份複本），全部做完才算完成
  const remaining = new Map<string, number>();
  for (const step of steps) for (const r of step.rows) remaining.set(r.bvid, (remaining.get(r.bvid) ?? 0) + 1);
  let moved = 0;
  let copied = 0;
  let failed = 0;

  for (const [i, step] of steps.entries()) {
    throwIfAborted(input.signal);
    input.onProgress?.({
      done: i,
      total: steps.length,
      label: t().progress.moveBatch(step.op, i + 1, steps.length, step.rows.length),
    });
    // 之前 copy 失敗的列不再 move，避免半套結果
    const rows = step.rows.filter((r) => !failedBvids.has(r.bvid));
    if (rows.length === 0) continue;
    for (const r of rows) {
      r.status = 'moving';
      input.onRow?.(r);
    }
    const exec = async (batch: ReviewRow[]) => {
      const items: ResourceRef[] = batch.map((r) => ({ aid: r.aid, type: r.type }));
      const payload = { srcMediaId: input.srcMediaId, tarMediaId: step.tarMediaId, mid: input.mid, items };
      await writeQueue.run(
        () =>
          withRetry(() => (step.op === 'copy' ? copyResources(payload, input.signal) : moveResources(payload, input.signal)), {
            signal: input.signal,
            onWait: input.onWait,
          }),
        input.signal,
      );
      for (const r of batch) {
        const left = (remaining.get(r.bvid) ?? 1) - 1;
        remaining.set(r.bvid, left);
        if (left > 0) continue;
        r.status = 'done';
        if (r.keepSource) copied++;
        else moved++;
        input.onRow?.(r);
      }
    };
    await runWithSplit(rows, exec, (batch, error) => {
      for (const r of batch) {
        r.status = 'failed';
        r.error = error.message;
        failedBvids.add(r.bvid);
        failed++;
        input.onRow?.(r);
      }
      // 風控是 IP 層級、持續性的：後面每一批都只是重新燒一輪 60+120+240 秒退避再失敗，
      // 中止剩下的批次比逐批硬打安全（design.md 6.4）。未觸及的列還是 pending，之後可以再試。
      if (isFatal(error)) throw error;
    });
  }
  input.onProgress?.({ done: steps.length, total: steps.length, label: t().progress.moveDone(moved, copied, failed) });
  return { moved, copied, failed };
}

/** 待移除的失效影片分批；已處理過的列不再排入。 */
export function planRemovals(rows: ReviewRow[], batchSize: number): ReviewRow[][] {
  return chunk(
    rows.filter((r) => r.invalid && (r.status === 'pending' || r.status === 'failed')),
    batchSize,
  );
}

export interface RemoveInput {
  srcMediaId: number;
  rows: ReviewRow[];
  batchSize: number;
  signal?: AbortSignal;
  onRow?: (row: ReviewRow) => void;
  onProgress?: (p: Progress) => void;
  onWait?: RetryOptions['onWait'];
}

/** 把失效影片從來源收藏夾移除（不可逆）。與搬移共用寫入佇列與退避。 */
export async function executeRemovals(input: RemoveInput): Promise<{ removed: number; failed: number }> {
  try {
    return await runRemovals(input);
  } finally {
    settleInterrupted(input.rows, 'failed', INTERRUPTED(), input.onRow);
  }
}

async function runRemovals(input: RemoveInput): Promise<{ removed: number; failed: number }> {
  const batches = planRemovals(input.rows, input.batchSize);
  let removed = 0;
  let failed = 0;

  for (const [i, batch] of batches.entries()) {
    throwIfAborted(input.signal);
    input.onProgress?.({ done: i, total: batches.length, label: t().progress.removeBatch(i + 1, batches.length, batch.length) });
    for (const r of batch) {
      r.status = 'moving';
      r.error = undefined;
      input.onRow?.(r);
    }
    const exec = async (rows: ReviewRow[]) => {
      const items: ResourceRef[] = rows.map((r) => ({ aid: r.aid, type: r.type }));
      await writeQueue.run(
        () =>
          withRetry(() => removeResources(input.srcMediaId, items, input.signal), {
            signal: input.signal,
            onWait: input.onWait,
          }),
        input.signal,
      );
      for (const r of rows) {
        r.status = 'removed';
        removed++;
        input.onRow?.(r);
      }
    };
    await runWithSplit(batch, exec, (rows, error) => {
      for (const r of rows) {
        r.status = 'failed';
        r.error = error.message;
        failed++;
        input.onRow?.(r);
      }
      if (isFatal(error)) throw error;
    });
  }
  input.onProgress?.({ done: batches.length, total: batches.length, label: t().progress.removeDone(removed, failed) });
  return { removed, failed };
}
