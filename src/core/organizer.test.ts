import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatCompletion } from '@/ai/client';
import type { ClassificationItem, FolderMeta, VideoBasic, VideoDetail } from '@/shared/types';
import { fetchDetails } from './fetchDetails';
import { fetchFolderVideos } from './fetchList';
import { runOrganize, toRow } from './organizer';
import { DEFAULT_SETTINGS } from './settings';

vi.mock('./fetchList', () => ({ fetchFolderVideos: vi.fn() }));
vi.mock('./fetchDetails', () => ({ fetchDetails: vi.fn() }));
vi.mock('./cache', () => ({ DAY_MS: 86_400_000, getCachedCover: vi.fn(), putCover: vi.fn() }));
vi.mock('@/bilibili/cover', () => ({ fetchCoverDataUrl: vi.fn() }));
vi.mock('@/ai/client', () => ({ chatCompletion: vi.fn(), chatOptionsFrom: () => ({}) }));

const basic = (intro: string): VideoBasic => ({
  bvid: 'BV1',
  aid: 1,
  type: 2,
  title: 't',
  cover: 'c',
  intro,
  duration: 60,
  pageCount: 1,
  upperName: 'up',
  invalid: false,
});

const detail = (patch: Partial<VideoDetail>): VideoDetail => ({
  bvid: 'BV1',
  fetchedAt: 0,
  schema: 1,
  tags: [],
  zone: '',
  ...patch,
});

describe('toRow', () => {
  const item = (patch: Partial<ClassificationItem> = {}): ClassificationItem => ({
    bvid: 'BV1',
    targetFolderIds: [7],
    reason: 'r',
    ...patch,
  });

  it('一般結果預先勾選建議', () => {
    const row = toRow(basic(''), undefined, item());
    expect(row.suggested).toEqual([7]);
    expect(row.chosen).toEqual([7]);
  });

  it('低信心：保留建議但不預先勾選', () => {
    const row = toRow(basic(''), undefined, item({ lowConfidence: true }));
    expect(row.suggested).toEqual([7]);
    expect(row.chosen).toEqual([]);
    expect(row.lowConfidence).toBe(true);
  });

  it('模型說「留在原地並複製一份」：預先勾選，且那一列用複製', () => {
    const row = toRow(basic(''), undefined, item({ keepSource: true }));
    expect(row.chosen).toEqual([7]);
    expect(row.keepSource).toBe(true);
    expect(row.suggestedKeep).toBe(true);
  });

  it('低信心的「留在原地並複製一份」照樣不預先勾選，但建議留著', () => {
    const row = toRow(basic(''), undefined, item({ keepSource: true, lowConfidence: true }));
    expect(row.chosen).toEqual([]);
    expect(row.keepSource).toBeUndefined();
    expect(row.suggestedKeep).toBe(true);
  });

  it('沒有分類結果就是不搬', () => {
    expect(toRow(basic(''), undefined, undefined).chosen).toEqual([]);
  });
});

describe('runOrganize', () => {
  const source: FolderMeta = { id: 1, title: '來源', mediaCount: 2, attr: 0, isPrivate: false, isDefault: false };
  const video = (bvid: string): VideoBasic => ({ ...basic(''), bvid, aid: Number(bvid.slice(2)) || 1 });

  beforeEach(() => {
    vi.mocked(fetchFolderVideos).mockResolvedValue([video('BV1'), video('BV2')]);
    vi.mocked(chatCompletion).mockResolvedValue({
      content: JSON.stringify([
        // 短號 1 是來源收藏夾，2 才是清單裡的第 1 個目標；organizer 要換回真正的 media_id 7
        { bvid: 'BV1', target_folder_ids: [2], reason: 'r' },
        { bvid: 'BV2', target_folder_ids: [1], reason: '留在原地' },
      ]),
    });
  });

  it('詳情抓不到的影片照樣完成分類，並計進 detailFailed', async () => {
    vi.mocked(fetchDetails).mockResolvedValue({
      details: new Map([['BV1', detail({ tags: ['a'] })]]),
      failed: new Map([['BV2', '取得失敗']]),
      stats: { fetched: 1, cached: 0 },
    });
    const result = await runOrganize({
      mid: 1,
      source,
      sourceDescription: '',
      targets: [{ id: 7, title: '目標', description: '' }],
      settings: DEFAULT_SETTINGS,
    });
    expect(result.stats.detailFailed).toBe(1);
    expect(result.stats.fetched).toBe(1);
    expect(result.stats.aiCalls).toBe(1);
    expect(result.rows.map((r) => r.bvid)).toEqual(['BV1', 'BV2']);
    expect(result.rows[0]?.chosen).toEqual([7]);
    expect(result.rows[1]?.chosen).toEqual([]);
  });

  it('送出去的目標收藏夾是短號，不是 10 位數的 media_id', async () => {
    vi.mocked(fetchDetails).mockResolvedValue({
      details: new Map(),
      failed: new Map(),
      stats: { fetched: 0, cached: 0 },
    });
    await runOrganize({
      mid: 1,
      source,
      sourceDescription: '',
      targets: [{ id: 2271580846, title: '目標', description: '' }],
      settings: DEFAULT_SETTINGS,
    });
    const [messages] = vi.mocked(chatCompletion).mock.calls[0] ?? [];
    const user = messages?.[1]?.content;
    expect(typeof user === 'string' && user).toContain('- id=2 名稱：目標');
    expect(typeof user === 'string' && user).not.toContain('2271580846');
  });

  it('全部抓得到詳情時 detailFailed 是 0', async () => {
    vi.mocked(fetchDetails).mockResolvedValue({
      details: new Map([
        ['BV1', detail({ tags: ['a'] })],
        ['BV2', detail({ bvid: 'BV2', tags: ['b'] })],
      ]),
      failed: new Map(),
      stats: { fetched: 2, cached: 0 },
    });
    const result = await runOrganize({
      mid: 1,
      source,
      sourceDescription: '',
      targets: [{ id: 7, title: '目標', description: '' }],
      settings: DEFAULT_SETTINGS,
    });
    expect(result.stats.detailFailed).toBe(0);
  });
});
