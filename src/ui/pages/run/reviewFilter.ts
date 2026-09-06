import type { ReviewRow } from '@/shared/types';

/**
 * 審核表的篩選。分面本身畫在左軌、表格在中間，兩邊要用同一份定義，
 * 所以把「怎麼算、怎麼篩」抽成純函式放這裡。
 */
export type ReviewFilter = 'all' | 'move' | 'copy' | 'stay' | 'lowConfidence' | 'invalid' | 'done' | 'failed';

export interface ReviewCounts {
  all: number;
  /** 會從來源搬走 */
  move: number;
  /** 保留原位、只複製一份出去 */
  copy: number;
  stay: number;
  lowConfidence: number;
  invalid: number;
  done: number;
  failed: number;
}

const MATCH: Record<ReviewFilter, (r: ReviewRow) => boolean> = {
  all: () => true,
  move: (r) => r.status === 'pending' && r.chosen.length > 0 && !r.keepSource,
  copy: (r) => r.status === 'pending' && r.chosen.length > 0 && !!r.keepSource,
  stay: (r) => r.status === 'pending' && r.chosen.length === 0,
  lowConfidence: (r) => !!r.lowConfidence,
  invalid: (r) => !!r.invalid,
  done: (r) => r.status === 'done',
  failed: (r) => r.status === 'failed',
};

export function countRows(rows: readonly ReviewRow[]): ReviewCounts {
  const counts: ReviewCounts = { all: rows.length, move: 0, copy: 0, stay: 0, lowConfidence: 0, invalid: 0, done: 0, failed: 0 };
  for (const r of rows) {
    if (MATCH.move(r)) counts.move++;
    if (MATCH.copy(r)) counts.copy++;
    if (MATCH.stay(r)) counts.stay++;
    if (MATCH.lowConfidence(r)) counts.lowConfidence++;
    if (MATCH.invalid(r)) counts.invalid++;
    if (MATCH.done(r)) counts.done++;
    if (MATCH.failed(r)) counts.failed++;
  }
  return counts;
}

/** targetFilter = 0 代表不限；其餘是目標收藏夾 id（建議或已選中都算） */
export function filterRows(rows: readonly ReviewRow[], filter: ReviewFilter, targetFilter = 0): ReviewRow[] {
  return rows.filter((r) => {
    if (targetFilter !== 0 && !r.chosen.includes(targetFilter) && !r.suggested.includes(targetFilter)) return false;
    return MATCH[filter](r);
  });
}

/** 每個目標收藏夾各有幾支影片會進去（建議或已選中）；左軌的「只看要搬進」用它 */
export function countByTarget(rows: readonly ReviewRow[], targetIds: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>(targetIds.map((id) => [id, 0]));
  for (const r of rows) {
    for (const id of new Set([...r.chosen, ...r.suggested])) {
      const n = counts.get(id);
      if (n !== undefined) counts.set(id, n + 1);
    }
  }
  return counts;
}
