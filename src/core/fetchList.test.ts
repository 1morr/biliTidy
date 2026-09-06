import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResourcePage } from '@/bilibili/fav';
import type { VideoBasic } from '@/shared/types';

vi.mock('@/bilibili/fav', () => ({ FAV_PAGE_YIELD: 30, listResources: vi.fn() }));

import { listResources } from '@/bilibili/fav';
import { fetchFolderVideos } from './fetchList';
import { readThrottle } from './scheduler';

const info: ResourcePage['info'] = {
  id: 1,
  title: 'f',
  mediaCount: 0,
  attr: 0,
  isPrivate: false,
  isDefault: true,
  intro: '',
  cover: '',
};

function video(bvid: string): VideoBasic {
  return { bvid, aid: 1, type: 2, title: bvid, cover: '', intro: '', duration: 1, pageCount: 1, upperName: '', invalid: false };
}

describe('fetchFolderVideos', () => {
  beforeEach(() => {
    // 避免真的節流器拖慢測試（預設 2 req/s）
    readThrottle.setRate(100_000, 0);
  });

  it('has_more 變 false 就停止', async () => {
    vi.mocked(listResources).mockResolvedValueOnce({ medias: [video('BV1')], hasMore: false, info });
    const result = await fetchFolderVideos(1, 1);
    expect(result.map((v) => v.bvid)).toEqual(['BV1']);
    expect(listResources).toHaveBeenCalledTimes(1);
  });

  it('伺服器一直回 has_more:true 且內容非空 → 觸發安全閥中止，不會無窮迴圈', async () => {
    vi.mocked(listResources).mockResolvedValue({ medias: [video('BVx')], hasMore: true, info });
    // expectedCount=1 → totalPages 估 1 頁，安全閥上限 = max(1*5, 20) = 20 頁
    await expect(fetchFolderVideos(1, 1)).rejects.toThrow(/past 20 pages|server error/);
    expect(vi.mocked(listResources).mock.calls.length).toBeLessThanOrEqual(21);
  });
});
