import { describe, expect, it } from 'vitest';
import type { FollowEntry, FollowRow, ReviewRow } from '@/shared/types';
import { classifyActivity, unknownActivity } from './activity';
import { DAY_MS } from './cache';
import { exportFilename, toCsv, toReviewCsv, uidList } from './exportRows';

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
    expect(lines[0]).toBe('\ufeffUID,Name,Group,Days,Latest,Link,Space');
    expect(lines[1]).toBe('1,"quote ""me"", please",,10,"a,b",https://www.bilibili.com/video/BV1/,https://space.bilibili.com/1');
    expect(lines[2]).toBe('2,u2,特别关注 / 遊戲,No videos,No videos,,https://space.bilibili.com/2');
    expect(lines).toHaveLength(4); // 兩列資料 + 表頭 + 結尾空字串
  });
});

const REVIEW_LABELS = {
  headers: {
    bvid: 'BV',
    title: 'Title',
    source: 'Source folder',
    suggested: 'AI suggested',
    chosen: 'You chose',
    keepInPlace: 'Also keep in place',
    lowConfidence: 'Low confidence',
    stale: 'Stale',
    reason: 'Reason',
    basis: 'Basis',
    status: 'Status',
    error: 'Error',
  },
  yes: 'yes',
};

const FOLDERS: Record<number, string> = { 2: '遊戲', 3: '料理' };
const reviewRow = (over: Partial<ReviewRow> = {}): ReviewRow => ({
  bvid: 'BV1',
  aid: 1,
  type: 2,
  title: 't',
  cover: '',
  suggested: [],
  chosen: [],
  reason: '',
  status: 'pending',
  ...over,
});

describe('toReviewCsv', () => {
  const csvOf = (given: ReviewRow[]) => toReviewCsv(given, 'Watch later', (id) => FOLDERS[id], REVIEW_LABELS);

  it('建議與你選的各佔一欄，多個目標以斜線相接', () => {
    const csv = csvOf([reviewRow({ suggested: [2, 3], chosen: [3], reason: 'r', basis: ['tag', 'title'] })]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      '\ufeffBV,Title,Source folder,AI suggested,You chose,Also keep in place,Low confidence,Stale,Reason,Basis,Status,Error',
    );
    expect(lines[1]).toBe('BV1,t,Watch later,遊戲 / 料理,料理,,,,r,tag / title,pending,');
    expect(lines).toHaveLength(3); // 一列資料 + 表頭 + 結尾空字串
  });

  it('認不得的收藏夾 id 退回數字，不是空白', () => {
    expect(csvOf([reviewRow({ chosen: [99] })]).split('\r\n')[1]).toContain(',99,');
  });

  it('三個旗標為真時填 yes、為假時留空', () => {
    const [, on, off] = csvOf([reviewRow({ keepSource: true, lowConfidence: true, invalid: true }), reviewRow()]).split('\r\n');
    expect(on).toContain(',yes,yes,yes,');
    expect(off).toContain(',,,,');
  });

  it('狀態寫原字串、錯誤訊息跟著那一列', () => {
    const [, line] = csvOf([reviewRow({ status: 'failed', error: 'boom' })]).split('\r\n');
    expect(line?.endsWith(',failed,boom')).toBe(true);
  });

  it('每一列都寫出去，沒有 confirmedOnly 那種過濾', () => {
    const csv = csvOf([reviewRow({ invalid: true }), reviewRow(), reviewRow({ status: 'done' })]);
    expect(csv.split('\r\n')).toHaveLength(5);
  });

  it('含逗號與引號的標題照 RFC 4180 跳脫', () => {
    const line = csvOf([reviewRow({ title: 'quote "me", please' })]).split('\r\n')[1];
    expect(line).toContain('"quote ""me"", please"');
  });
});

describe('exportFilename', () => {
  it('帶時間戳', () => {
    expect(exportFilename('uids', new Date(2026, 0, 2, 3, 4, 5))).toBe('inactive-uids-20260102-030405.txt');
    expect(exportFilename('csv', new Date(2026, 0, 2, 3, 4, 5))).toBe('inactive-accounts-20260102-030405.csv');
    expect(exportFilename('review', new Date(2026, 0, 2, 3, 4, 5))).toBe('classified-videos-20260102-030405.csv');
  });
});
