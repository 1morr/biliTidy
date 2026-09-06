import { describe, expect, it } from 'vitest';
import type { ReviewRow } from '@/shared/types';
import { countByTarget, countRows, filterRows } from './reviewFilter';

function row(patch: Partial<ReviewRow>): ReviewRow {
  return {
    bvid: patch.bvid ?? 'BV1',
    aid: 1,
    type: 2,
    title: 't',
    cover: '',
    suggested: [],
    chosen: [],
    reason: '',
    status: 'pending',
    ...patch,
  };
}

const rows: ReviewRow[] = [
  row({ bvid: 'BVmove', chosen: [10], suggested: [10] }),
  row({ bvid: 'BVcopy', chosen: [10], suggested: [10], keepSource: true }),
  row({ bvid: 'BVstay', suggested: [11] }),
  row({ bvid: 'BVlow', suggested: [11], lowConfidence: true }),
  row({ bvid: 'BVinvalid', invalid: true }),
  row({ bvid: 'BVdone', chosen: [10], status: 'done' }),
  row({ bvid: 'BVfailed', chosen: [11], status: 'failed' }),
];

describe('countRows', () => {
  it('每個分面各自計數，同一列可以同時算進多個分面', () => {
    expect(countRows(rows)).toEqual({
      all: 7,
      move: 1, // 保留原位的 BVcopy 不算「將搬移」
      copy: 1,
      stay: 3, // BVstay、BVlow、BVinvalid 都是 pending 且沒選目標
      lowConfidence: 1,
      invalid: 1,
      done: 1,
      failed: 1,
    });
  });

  it('空表所有分面都是 0', () => {
    expect(countRows([])).toEqual({ all: 0, move: 0, copy: 0, stay: 0, lowConfidence: 0, invalid: 0, done: 0, failed: 0 });
  });
});

describe('filterRows', () => {
  it('依分面挑列', () => {
    expect(filterRows(rows, 'move').map((r) => r.bvid)).toEqual(['BVmove']);
    expect(filterRows(rows, 'copy').map((r) => r.bvid)).toEqual(['BVcopy']);
    expect(filterRows(rows, 'done').map((r) => r.bvid)).toEqual(['BVdone']);
    expect(filterRows(rows, 'all')).toHaveLength(7);
  });

  it('目標篩選看的是「建議或已選中」，兩者都算', () => {
    expect(filterRows(rows, 'all', 11).map((r) => r.bvid)).toEqual(['BVstay', 'BVlow', 'BVfailed']);
  });

  it('分面與目標篩選是交集', () => {
    expect(filterRows(rows, 'failed', 11).map((r) => r.bvid)).toEqual(['BVfailed']);
    expect(filterRows(rows, 'failed', 10)).toEqual([]);
  });
});

describe('countByTarget', () => {
  it('只算清單裡的收藏夾，建議與已選中不重複計數', () => {
    expect(countByTarget(rows, [10, 11, 12])).toEqual(
      new Map([
        [10, 3],
        [11, 3],
        [12, 0],
      ]),
    );
  });
});
