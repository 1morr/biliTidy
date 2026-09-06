import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatCompletion } from '@/ai/client';
import { QUICK_FAV_MAX_TARGETS, type PromptVideo } from '@/ai/prompt';
import { AppError } from '@/shared/result';
import type { AiSettings, VideoBasic, VideoDetail } from '@/shared/types';
import { classify, type ClassifyRecord, type ClassifyRequest } from './classify';

vi.mock('@/ai/client', () => ({ chatCompletion: vi.fn(), chatOptionsFrom: () => ({}) }));

const basic: VideoBasic = {
  bvid: 'BV1a',
  aid: 1,
  type: 2,
  title: '【原神】4.2 深淵攻略',
  cover: 'http://i0.hdslb.com/x.jpg',
  intro: '這期講隊伍配置',
  duration: 725,
  pageCount: 1,
  upperName: '示範UP',
  invalid: false,
};

const detail: VideoDetail = { bvid: 'BV1a', fetchedAt: 0, schema: 1, tags: ['原神', '攻略'], zone: '單機遊戲' };
const video: PromptVideo = { basic, detail };

/** 真正的 media_id：classify 要把它們換成 1..N 送出去，再把回來的短號換回來 */
const folders = [
  { id: 2271580846, title: '繪畫', description: '插畫與繪師作品' },
  { id: 329642346, title: '遊戲', description: '各種遊戲實況' },
];

const ai = { model: 'm', baseUrl: 'https://x/v1' } as AiSettings;

/** 整理流程：有來源收藏夾 */
const organize: ClassifyRequest = {
  source: { id: 99, title: '默认收藏夹', description: '還沒分類' },
  folders,
  videos: [video],
};
/** 影片頁：沒有來源收藏夾 */
const quickFav: ClassifyRequest = { folders, videos: [video], maxTargets: QUICK_FAV_MAX_TARGETS };

/**
 * 兩種情境跑同一組斷言——這整支測試的重點就是它們走的是同一條路。
 * 第三個值是短號的位移：整理流程的短號 1 是「目前所在收藏夾」，目標從 2 開始。
 */
const bothPaths: [string, ClassifyRequest, number][] = [
  ['整理流程', organize, 1],
  ['影片頁', quickFav, 0],
];

const replyWith = (ids: number[]) => ({
  content: JSON.stringify({ results: [{ bvid: 'BV1a', target_folder_ids: ids, reason: '標籤含原神' }] }),
});

const userTextOf = (call = 0): string => {
  const content = vi.mocked(chatCompletion).mock.calls[call]?.[0]?.[1]?.content;
  return typeof content === 'string' ? content : JSON.stringify(content);
};

beforeEach(() => vi.mocked(chatCompletion).mockReset());

describe.each(bothPaths)('classify（%s）', (_name, req, off) => {
  it('送出的是 1..N 短號，回來換成真正的 media_id', async () => {
    vi.mocked(chatCompletion).mockResolvedValue(replyWith([2 + off]) as never);
    const { items } = await classify(ai, req);
    expect(userTextOf()).toContain(`id=${1 + off} 名稱：繪畫`);
    expect(userTextOf()).not.toContain('2271580846');
    expect(items[0]?.targetFolderIds).toEqual([329642346]);
  });

  it('遇到可重試的錯誤會退避重試（影片頁曾經沒有這一段）', async () => {
    // 用 csrf 是因為它的退避是 0 秒（見 defaultRetryPolicy），測試不必真的睡一秒；
    // 要驗的是 withRetry 有沒有包在裡面，不是退避多久。
    vi.mocked(chatCompletion)
      .mockRejectedValueOnce(new AppError('csrf', 'cookie 剛更新'))
      .mockResolvedValueOnce(replyWith([1 + off]) as never);
    const { items } = await classify(ai, req);
    expect(vi.mocked(chatCompletion)).toHaveBeenCalledTimes(2);
    expect(items[0]?.targetFolderIds).toEqual([2271580846]);
  });

  it('模型只回思考內容：丟錯，但除錯紀錄仍然回報得出去', async () => {
    vi.mocked(chatCompletion).mockResolvedValue({ content: '   ', reasoningContent: '嗯…' } as never);
    const seen: ClassifyRecord[] = [];
    await expect(classify(ai, req, { onRecord: (r) => seen.push(r) })).rejects.toThrow('only returned its reasoning');
    // 丟錯之前就要回報，否則使用者在除錯視窗看不到到底送了什麼
    expect(seen).toHaveLength(1);
    expect(seen[0]?.reasoningContent).toBe('嗯…');
  });

  it('帶上設定頁的自訂分類指示', async () => {
    vi.mocked(chatCompletion).mockResolvedValue(replyWith([1 + off]) as never);
    await classify({ ...ai, customInstructions: 'MMD 一律進繪畫夾' }, req);
    const system = vi.mocked(chatCompletion).mock.calls[0]?.[0]?.[0]?.content;
    expect(system).toContain('【使用者的額外指示】');
    expect(system).toContain('MMD 一律進繪畫夾');
  });

  it('同一組收藏夾連呼叫兩次，送出去的短號完全一樣', async () => {
    vi.mocked(chatCompletion).mockResolvedValue(replyWith([1 + off]) as never);
    await classify(ai, req);
    await classify(ai, req);
    expect(userTextOf(0)).toBe(userTextOf(1));
  });
});

describe('classify 的兩種情境差在哪', () => {
  it('整理流程不限目標數，影片頁截到上限', async () => {
    vi.mocked(chatCompletion).mockResolvedValue(replyWith([3, 2]) as never);
    const both = await classify(ai, organize);
    expect(both.items[0]?.targetFolderIds).toEqual([329642346, 2271580846]);

    vi.mocked(chatCompletion).mockResolvedValue(replyWith([2, 1]) as never);
    const capped = await classify(ai, { ...quickFav, maxTargets: 1 });
    expect(capped.items[0]?.targetFolderIds).toEqual([329642346]);
  });

  it('只有整理流程會送出「目前所在收藏夾」', async () => {
    vi.mocked(chatCompletion).mockResolvedValue(replyWith([2]) as never);
    await classify(ai, organize);
    expect(userTextOf()).toContain('【目前所在收藏夾】');

    vi.mocked(chatCompletion).mockReset();
    vi.mocked(chatCompletion).mockResolvedValue(replyWith([1]) as never);
    await classify(ai, quickFav);
    expect(userTextOf()).not.toContain('【目前所在收藏夾】');
  });
});

/**
 * 來源收藏夾在整理流程裡也有短號（固定 1）。模型把它列進 target_folder_ids
 * ＝「這支留在原地」；同時還有目標＝「留下並複製一份過去」（`docs/design.md` 6.1）。
 */
describe('來源短號的三種答案', () => {
  it('只回來源短號 → 留在原地，沒有目標', async () => {
    vi.mocked(chatCompletion).mockResolvedValue(replyWith([1]) as never);
    const { items } = await classify(ai, organize);
    expect(items[0]?.targetFolderIds).toEqual([]);
    expect(items[0]?.keepSource).toBeUndefined();
  });

  it('來源短號＋目標 → 保留原位並複製過去；來源不會混進目標清單', async () => {
    vi.mocked(chatCompletion).mockResolvedValue(replyWith([1, 3]) as never);
    const { items } = await classify(ai, organize);
    expect(items[0]?.targetFolderIds).toEqual([329642346]);
    expect(items[0]?.keepSource).toBe(true);
  });

  it('只回目標 → 搬走', async () => {
    vi.mocked(chatCompletion).mockResolvedValue(replyWith([3]) as never);
    const { items } = await classify(ai, organize);
    expect(items[0]?.targetFolderIds).toEqual([329642346]);
    expect(items[0]?.keepSource).toBeUndefined();
  });

  it('回空陣列（舊寫法）仍然是留在原地', async () => {
    vi.mocked(chatCompletion).mockResolvedValue(replyWith([]) as never);
    const { items } = await classify(ai, organize);
    expect(items[0]?.targetFolderIds).toEqual([]);
    expect(items[0]?.keepSource).toBeUndefined();
  });

  it('影片頁沒有來源夾，短號 1 就是第一個目標', async () => {
    vi.mocked(chatCompletion).mockResolvedValue(replyWith([1]) as never);
    const { items } = await classify(ai, quickFav);
    expect(items[0]?.targetFolderIds).toEqual([2271580846]);
    expect(items[0]?.keepSource).toBeUndefined();
  });
});

describe('classify 的除錯紀錄', () => {
  it('帶回 bvid 順序、封面張數與攤平成文字的 prompt', async () => {
    vi.mocked(chatCompletion).mockResolvedValue(replyWith([2]) as never);
    const withCover: PromptVideo = { basic: { ...basic, bvid: 'BV2b' }, coverDataUrl: 'data:image/webp;base64,AA' };
    const { record } = await classify(ai, { ...organize, videos: [video, withCover] });
    expect(record.bvids).toEqual(['BV1a', 'BV2b']);
    expect(record.coverCount).toBe(1);
    expect(record.user).toContain('【封面圖片（base64，已省略）】');
    expect(record.response).toContain('BV1a');
  });

  it('解析不出 JSON 時 parseError 為 true，每支都退成留在原地', async () => {
    vi.mocked(chatCompletion).mockResolvedValue({ content: '我覺得放繪畫夾比較好' } as never);
    const { items, parseError } = await classify(ai, organize);
    expect(parseError).toBe(true);
    expect(items[0]?.targetFolderIds).toEqual([]);
    expect(items[0]?.lowConfidence).toBe(true);
  });
});
