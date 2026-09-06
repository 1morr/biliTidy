import { describe, expect, it } from 'vitest';
import type { VideoBasic, VideoDetail } from '@/shared/types';
import type { ContentPart } from './client';
import {
  CUSTOM_INSTRUCTIONS_MAX,
  QUICK_FAV_MAX_TARGETS,
  buildSystemPrompt,
  buildUserMessage,
  codeFolders,
  formatVideo,
  toRealIds,
  withCustomInstructions,
  type ClassifyPrompt,
  type PromptVideo,
} from './prompt';

const basic: VideoBasic = {
  bvid: 'BV1a',
  aid: 1,
  type: 2,
  title: '標題A',
  cover: 'http://i0.hdslb.com/x.jpg',
  intro: 'x'.repeat(250),
  duration: 3725,
  pageCount: 1,
  upperName: 'UP甲',
  invalid: false,
};

const detail: VideoDetail = {
  bvid: 'BV1a',
  fetchedAt: 0,
  schema: 1,
  tags: ['t1', 't2'],
  zone: '音樂 / 音樂綜合',
  season: { title: 'DJ歌单', epCount: 12, siblingTitles: ['s1', 's2'] },
};

const source = { id: 9, title: '默认收藏夹', description: '還沒分類的新收藏' };

const folders = [
  { id: 1, title: '音樂', description: '歌單、MV' },
  { id: 2, title: '其他', description: '' },
];

/** 整理流程：有來源收藏夾 */
const organize = (videos: PromptVideo[] = [{ basic, detail }]): ClassifyPrompt => ({ source, folders, videos });
/** 影片頁：沒有來源收藏夾 */
const quickFav = (videos: PromptVideo[] = [{ basic, detail }]): ClassifyPrompt => ({
  folders,
  videos,
  maxTargets: QUICK_FAV_MAX_TARGETS,
});

const asParts = (content: string | ContentPart[]): ContentPart[] => {
  if (typeof content === 'string') throw new Error('預期是圖文交錯的 parts');
  return content;
};
const asText = (content: string | ContentPart[]): string => {
  if (typeof content !== 'string') throw new Error('預期是純文字');
  return content;
};

describe('formatVideo', () => {
  it('欄位順序固定、簡介截 200 字、空欄位省略', () => {
    const text = formatVideo(1, { basic, detail });
    const lines = text.split('\n');
    expect(lines[0]).toBe('### 影片 1（BV1a）');
    expect(lines.map((l) => l.split('：')[0])).toEqual([
      '### 影片 1（BV1a）',
      '標題',
      '標籤',
      '合集',
      '簡介',
      '分區',
      '時長',
      'UP',
    ]);
    expect(lines[2]).toBe('標籤：t1, t2');
    expect(lines[3]).toBe('合集：《DJ歌单》(共 12 集) — 同合集：s1 / s2');
    expect(lines[4]).toHaveLength('簡介：'.length + 200 + 1);
    expect(lines[6]).toBe('時長：1:02:05');
  });

  it('合集簡介併在同一行（跟著 view/detail 一起回來，不多打請求）', () => {
    const withIntro: VideoDetail = { ...detail, season: { ...detail.season!, intro: '每週更新的電音歌單' } };
    const line = formatVideo(1, { basic, detail: withIntro }).split('\n')[3];
    expect(line).toBe('合集：《DJ歌单》(共 12 集) — 簡介：每週更新的電音歌單 — 同合集：s1 / s2');
    // 併在同一行才不會讓欄位清單因為「有沒有合集簡介」而長短不一
    expect(formatVideo(1, { basic, detail: withIntro }).split('\n')).toHaveLength(8);
  });

  it('無詳情時只輸出列表欄位', () => {
    const text = formatVideo(2, { basic: { ...basic, intro: '' } });
    expect(text).toBe('### 影片 2（BV1a）\n標題：標題A\n時長：1:02:05\nUP：UP甲');
  });
});

describe('buildUserMessage', () => {
  it('整理流程：含來源收藏夾、目標描述與影片區塊', () => {
    const text = asText(buildUserMessage(organize()));
    expect(text.startsWith('【目前所在收藏夾】')).toBe(true);
    // 來源夾也有 id：模型要能把它列進答案，才表達得出「留在原地」與「留下並複製一份」
    expect(text).toContain('- id=9 名稱：默认收藏夹 | 描述：還沒分類的新收藏');
    expect(text.indexOf('【目前所在收藏夾】')).toBeLessThan(text.indexOf('【目標收藏夾】'));
    expect(text).toContain('- id=1 名稱：音樂 | 描述：歌單、MV');
    expect(text).toContain('- id=2 名稱：其他\n');
    expect(text).toContain('### 影片 1（BV1a）');
    expect(text.trimEnd().endsWith('讓影片留在原地。')).toBe(true);
  });

  it('影片頁：沒有來源收藏夾那一段，也沒有「留在原地」的結尾', () => {
    const text = asText(buildUserMessage(quickFav()));
    expect(text.indexOf('【可以收藏到的收藏夾】')).toBeLessThan(text.indexOf('【這支影片】'));
    expect(text).not.toContain('【目前所在收藏夾】');
    expect(text).not.toContain('留在原地');
    expect(text).toContain('- id=1 名稱：音樂 | 描述：歌單、MV');
    expect(text).toContain('標籤：t1, t2');
  });

  it('視覺模式：標籤 → 圖片 → 文字 交錯；無封面者只有文字', () => {
    const parts = asParts(
      buildUserMessage(
        organize([{ basic, detail, coverDataUrl: 'data:image/webp;base64,AAA' }, { basic: { ...basic, bvid: 'BV2b' } }]),
      ),
    );
    const kinds = parts.map((p) => (p.type === 'text' ? `text:${p.text.slice(0, 6)}` : 'image'));
    expect(kinds).toEqual([
      'text:【目前所在收',
      'text:影片 1（B',
      'image',
      'text:### 影片',
      'text:### 影片',
      'text:請依系統規則',
    ]);
    const head = parts[0];
    expect(head?.type === 'text' && head.text).toContain('- id=9 名稱：默认收藏夹 | 描述：還沒分類的新收藏');
    const img = parts[2];
    expect(img?.type === 'image_url' && img.image_url.detail).toBe('low');
  });

  it('影片頁的視覺模式排法與整理流程一致，只是少了結尾', () => {
    const parts = asParts(buildUserMessage(quickFav([{ basic, detail, coverDataUrl: 'data:image/webp;base64,AAA' }])));
    expect(parts.map((p) => p.type)).toEqual(['text', 'text', 'image_url', 'text']);
  });
});

describe('codeFolders', () => {
  it('把 media_id 換成 1..N 的短號，toRealIds 換得回來', () => {
    const codes = codeFolders([
      { id: 2271580846, title: 'Pic', description: '' },
      { id: 1581164046, title: 'Sound', description: '' },
    ]);
    expect(codes.coded.map((f) => f.id)).toEqual([1, 2]);
    expect(codes.coded.map((f) => f.title)).toEqual(['Pic', 'Sound']);
    expect([...codes.validIds]).toEqual([1, 2]);
    expect(toRealIds(codes, [2, 1])).toEqual([1581164046, 2271580846]);
    // 認不得的號碼（模型自己發明的、或抄了 media_id）直接丟掉；重複的只留一次
    expect(toRealIds(codes, [3, 2271580846, 1, 1])).toEqual([2271580846]);
  });
});

describe('buildSystemPrompt', () => {
  const organizeSystem = buildSystemPrompt(organize());
  const quickFavSystem = buildSystemPrompt(quickFav());

  it('整理流程：把「留在原地」寫成預設結果', () => {
    expect(organizeSystem).toContain('目前所在的收藏夾');
    expect(organizeSystem).toContain('預設留在原地');
    expect(organizeSystem).toContain('每支輸入影片都必須出現且只出現一次');
  });

  it('影片頁：預設不是「留在原地」，而是挑一個或回空陣列', () => {
    expect(quickFavSystem).toContain('沒有明顯合適的收藏夾就回傳空陣列');
    expect(quickFavSystem).toContain(`最多 ${QUICK_FAV_MAX_TARGETS} 個`);
    expect(quickFavSystem).toContain('results 只放這一支影片');
    // 這支影片還沒被收藏，沒有「原地」可以留
    expect(quickFavSystem).not.toContain('留在原地');
  });

  it('兩種情境共用同一組判斷原則與輸出格式', () => {
    for (const system of [organizeSystem, quickFavSystem]) {
      expect(system).toContain('原樣照抄那一行的 id');
      expect(system).toContain('"results"');
      expect(system).toContain('不同的作品或遊戲一律不算');
      // 封面規則曾經只寫在整理流程那一份，影片頁卻照樣送圖
      expect(system).toContain('若附有封面圖');
      expect(system).toContain('confidence');
    }
  });

  it('沒有自訂指示時不多加東西', () => {
    expect(buildSystemPrompt(organize(), '   ')).toBe(organizeSystem);
    expect(withCustomInstructions('別份提示')).toBe('別份提示');
  });

  it('自訂指示接在後面並截長度，兩種情境都生效', () => {
    for (const req of [organize(), quickFav()]) {
      const text = buildSystemPrompt(req, 'MMD 一律進繪畫夾');
      expect(text.startsWith(buildSystemPrompt(req))).toBe(true);
      expect(text).toContain('【使用者的額外指示】');
      expect(text).toContain('MMD 一律進繪畫夾');
    }
    const long = buildSystemPrompt(organize(), 'x'.repeat(CUSTOM_INSTRUCTIONS_MAX + 50));
    expect(long).toContain('x'.repeat(CUSTOM_INSTRUCTIONS_MAX));
    expect(long).not.toContain('x'.repeat(CUSTOM_INSTRUCTIONS_MAX + 1));
  });
});
