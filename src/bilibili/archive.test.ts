import { describe, expect, it, vi } from 'vitest';

const biliFetch = vi.hoisted(() => vi.fn());
vi.mock('./http', () => ({ biliFetch }));

const { fetchLatestArchive } = await import('./archive');

/** 空間投稿列表的最小回應形狀 */
function raw(count: number, vlist: { bvid: string; title: string; created: number }[] = []) {
  return { list: { vlist }, page: { count, num: 1, size: 1 } };
}

describe('fetchLatestArchive', () => {
  it('走 space/wbi/arc/search，帶 WBI 簽名、只取最新一支', async () => {
    biliFetch.mockResolvedValue(raw(24, [{ bvid: 'BV16j411G7sV', title: '最新', created: 1_677_628_800 }]));
    await expect(fetchLatestArchive(20754273)).resolves.toEqual({
      bvid: 'BV16j411G7sV',
      title: '最新',
      pubdate: 1_677_628_800,
    });
    const [path, opts] = biliFetch.mock.calls[0] as [string, { query: Record<string, unknown>; wbi: boolean }];
    expect(path).toBe('/x/space/wbi/arc/search');
    expect(opts.wbi).toBe(true);
    expect(opts.query).toMatchObject({ mid: 20754273, ps: 1, pn: 1, order: 'pubdate' });
  });

  it('count 為 0 才是「這個帳號沒有影片」', async () => {
    biliFetch.mockResolvedValue(raw(0));
    await expect(fetchLatestArchive(1)).resolves.toBeNull();
  });

  it('說有投稿卻一支都沒回：丟例外（＝未知），絕不能當成從未投稿', async () => {
    biliFetch.mockResolvedValue(raw(74));
    await expect(fetchLatestArchive(527512965)).rejects.toThrow();
  });

  it('連 count 都缺：一樣丟例外', async () => {
    biliFetch.mockResolvedValue({ list: { vlist: [] } });
    await expect(fetchLatestArchive(1)).rejects.toThrow();
  });
});
