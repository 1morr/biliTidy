import { describe, expect, it } from 'vitest';
import type { FollowEntry, FollowRow } from '@/shared/types';
import { classifyActivity, unknownActivity } from './activity';
import { DAY_MS } from './cache';
import { exportFilename, toCsv, uidList } from './exportRows';

const NOW = Date.UTC(2026, 8, 5);
const entry = (mid: number, over: Partial<FollowEntry> = {}): FollowEntry => ({
  mid,
  name: `u${mid}`,
  face: '',
  sign: '',
  tagIds: [],
  special: false,
  kind: 'follow',
  followedAt: 0,
  verify: '',
  ...over,
});
const LABELS = {
  headers: {
    uid: 'UID',
    name: 'Name',
    group: 'Group',
    daysInactive: 'Days',
    latestVideo: 'Latest',
    videoLink: 'Link',
    space: 'Space',
  },
  noVideos: 'No videos',
};

const rows: FollowRow[] = [
  {
    entry: entry(1, { name: 'quote "me", please' }),
    status: 'pending',
    activity: classifyActivity(1, { bvid: 'BV1', title: 'a,b', pubdate: Math.floor((NOW - 10 * DAY_MS) / 1000) }, NOW),
  },
  { entry: entry(2, { tagIds: [7], special: true }), status: 'pending', activity: classifyActivity(2, null, NOW) },
  { entry: entry(3), status: 'pending', activity: unknownActivity(3, 'x', NOW) },
  { entry: entry(4), status: 'pending' },
];

describe('uidList', () => {
  it('未知與沒查過的永遠不進匯出', () => {
    expect(uidList(rows)).toBe('1,2');
  });
});

describe('toCsv', () => {
  it('RFC 4180 跳脫、BOM、無影片的文字', () => {
    const csv = toCsv(rows, (id) => ({ 7: '遊戲', [-10]: '特别关注' })[id], LABELS, NOW);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('﻿UID,Name,Group,Days,Latest,Link,Space');
    expect(lines[1]).toBe('1,"quote ""me"", please",,10,"a,b",https://www.bilibili.com/video/BV1/,https://space.bilibili.com/1');
    expect(lines[2]).toBe('2,u2,特别关注 / 遊戲,No videos,No videos,,https://space.bilibili.com/2');
    expect(lines).toHaveLength(4); // 兩列資料 + 表頭 + 結尾空字串
  });
});

describe('exportFilename', () => {
  it('帶時間戳', () => {
    expect(exportFilename('uids', new Date(2026, 0, 2, 3, 4, 5))).toBe('inactive-uids-20260102-030405.txt');
    expect(exportFilename('csv', new Date(2026, 0, 2, 3, 4, 5))).toBe('inactive-accounts-20260102-030405.csv');
  });
});
