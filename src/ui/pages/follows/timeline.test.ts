import { describe, expect, it } from 'vitest';
import type { FollowRow } from '@/shared/types';
import { axisDays, positionOf, thresholdPosition, timelineAxis } from './timeline';

const DAY = 86_400;
const NOW_MS = Date.UTC(2026, 8, 6, 12); // 2026-09-06 12:00 UTC
const NOW = NOW_MS / 1000;

function row(pubdate: number | null | 'unknown'): FollowRow {
  const entry = {
    mid: 1,
    name: 'a',
    face: '',
    sign: '',
    tagIds: [],
    special: false,
    kind: 'follow' as const,
    followedAt: 0,
    verify: '',
  };
  if (pubdate === 'unknown')
    return { entry, status: 'pending', activity: { mid: 1, status: 'unknown', checkedAt: 0, schema: 2 } };
  if (pubdate === null) return { entry, status: 'pending', activity: { mid: 1, status: 'noVideos', checkedAt: 0, schema: 2 } };
  return {
    entry,
    status: 'pending',
    activity: { mid: 1, status: 'videos', latest: { bvid: 'BV1', title: 't', pubdate }, checkedAt: 0, schema: 2 },
  };
}

describe('timelineAxis', () => {
  it('spans at least three years and starts on a January 1st', () => {
    const axis = timelineAxis([row(NOW - 30 * DAY)], 365, NOW_MS);
    expect(axis.end).toBe(Math.floor(NOW));
    expect(new Date(axis.start * 1000).toISOString()).toBe('2023-01-01T00:00:00.000Z');
    expect(axis.ticks.map((t) => t.label)).toEqual(['2023', '2024', '2025', '2026']);
  });

  it('stretches back to the oldest upload among the rows', () => {
    const axis = timelineAxis([row(NOW - 30 * DAY), row(Date.UTC(2019, 5, 1) / 1000)], 365, NOW_MS);
    expect(new Date(axis.start * 1000).getUTCFullYear()).toBe(2019);
  });

  it('keeps the threshold inside the axis with a margin', () => {
    const axis = timelineAxis([row(NOW - 10 * DAY)], 3650, NOW_MS);
    expect(thresholdPosition(3650, axis)).toBeGreaterThan(0);
    expect(axis.start).toBeLessThanOrEqual(NOW - (3650 + 90) * DAY);
  });

  it('ignores rows without a confirmed upload', () => {
    const axis = timelineAxis([row(null), row('unknown')], 365, NOW_MS);
    expect(new Date(axis.start * 1000).getUTCFullYear()).toBe(2023);
  });

  it('thins the year ticks when the axis is long', () => {
    const axis = timelineAxis([row(Date.UTC(2011, 0, 2) / 1000)], 365, NOW_MS);
    expect(axis.ticks.length).toBeLessThanOrEqual(10);
    expect(axis.ticks[0]?.label).toBe('2011');
  });

  it('thins further when the column is narrow', () => {
    const wide = timelineAxis([row(NOW - 30 * DAY)], 365, NOW_MS, 10);
    const narrow = timelineAxis([row(NOW - 30 * DAY)], 365, NOW_MS, 2);
    expect(wide.ticks.map((t) => t.label)).toEqual(['2023', '2024', '2025', '2026']);
    expect(narrow.ticks.map((t) => t.label)).toEqual(['2023', '2025']);
  });
});

describe('positionOf / axisDays', () => {
  const axis = timelineAxis([row(NOW - 30 * DAY)], 365, NOW_MS);

  it('maps the ends to 0 and 1 and clamps outside', () => {
    expect(positionOf(axis.start, axis)).toBe(0);
    expect(positionOf(axis.end, axis)).toBe(1);
    expect(positionOf(axis.start - DAY, axis)).toBe(0);
    expect(positionOf(axis.end + DAY, axis)).toBe(1);
  });

  it('puts the threshold N days left of the right end', () => {
    const p = thresholdPosition(365, axis);
    expect(p).toBeCloseTo(1 - 365 / axisDays(axis), 2);
  });
});
