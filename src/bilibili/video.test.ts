import { describe, expect, it } from 'vitest';
import { toVideoDetail } from './video';

const base = {
  View: { bvid: 'BV1self', tid: 130, tname: '', dynamic: ' 動態 ', staff: [], pages: [{ part: 'p1' }] },
  Tags: [{ tag_name: '聽歌' }, { tag_name: '' }, { tag_name: '歌單' }],
};

describe('toVideoDetail', () => {
  it('tags 過濾空值、tname 空時以 tid 表補分區、dynamic 去空白、單 P 不輸出 pageTitles', () => {
    const d = toVideoDetail(base, 123);
    expect(d.tags).toEqual(['聽歌', '歌單']);
    expect(d.zone).toBe('音樂 / 音樂綜合');
    expect(d.dynamic).toBe('動態');
    expect(d.pageTitles).toBeUndefined();
    expect(d.staff).toBeUndefined();
    expect(d.season).toBeUndefined();
    expect(d.fetchedAt).toBe(123);
  });

  it('合集：同合集標題排除自己且最多 8 條', () => {
    const episodes = Array.from({ length: 12 }, (_, i) => ({ bvid: i === 3 ? 'BV1self' : `BV${i}`, title: `第${i}集` }));
    const d = toVideoDetail({
      ...base,
      View: {
        ...base.View,
        ugc_season: { id: 1, title: 'DJ歌单', intro: '', ep_count: 12, sections: [{ title: '正片', episodes }] },
      },
    });
    expect(d.season?.title).toBe('DJ歌单');
    expect(d.season?.epCount).toBe(12);
    expect(d.season?.siblingTitles).toHaveLength(8);
    expect(d.season?.siblingTitles).not.toContain('第3集');
    expect(d.season?.intro).toBeUndefined();
  });

  it('多 P 輸出分 P 標題（最多 10），staff 格式化', () => {
    const d = toVideoDetail({
      ...base,
      View: {
        ...base.View,
        staff: [{ name: '小明', title: 'UP主' }],
        pages: Array.from({ length: 12 }, (_, i) => ({ part: `P${i + 1}` })),
      },
    });
    expect(d.staff).toEqual(['小明（UP主）']);
    expect(d.pageTitles).toHaveLength(10);
  });
});
