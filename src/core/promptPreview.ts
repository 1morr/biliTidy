import {
  buildSystemPrompt,
  buildUserMessage,
  codeFolders,
  contentToText,
  type ClassifyPrompt,
  type PromptFolder,
  type PromptVideo,
} from '@/ai/prompt';
import { t } from '@/i18n';
import type { Settings, VideoBasic, VideoDetail } from '@/shared/types';
import { planOf } from './plan';

/** 預覽用的假資料，不會發出任何請求；欄位挑成一支資訊完整、一支線索稀薄，方便看出設定差異 */
const SAMPLE_SOURCE: PromptFolder = { id: 100, title: '默认收藏夹', description: '隨手收的、還沒分類的影片' };

// id 用真實的 media_id：預覽會跟正式流程一樣先經過 codeFolders 換成短號
const SAMPLE_FOLDERS: PromptFolder[] = [
  { id: 2271580846, title: '繪畫 / 美圖', description: '手繪、插畫過程、MMD 與 3D 舞蹈、美圖欣賞' },
  { id: 329642346, title: '遊戲實況', description: '各種遊戲實況與攻略' },
];

const RICH_BASIC: VideoBasic = {
  bvid: 'BV1example01',
  aid: 1,
  type: 2,
  title: '【原神】4.2 深淵 36 星滿星攻略',
  cover: '',
  intro: '這期把上下半場的隊伍配置與換人時機都講一遍，附帶練度參考。',
  duration: 725,
  pageCount: 1,
  upperName: '示範UP',
  invalid: false,
};

const SPARSE_BASIC: VideoBasic = {
  ...RICH_BASIC,
  bvid: 'BV1example02',
  title: '摸魚',
  intro: '',
  duration: 62,
  upperName: '某位畫師',
};

const RICH_DETAIL: VideoDetail = {
  bvid: RICH_BASIC.bvid,
  fetchedAt: 0,
  schema: 1,
  tags: ['原神', '深境螺旋', '攻略', '手機遊戲'],
  zone: '遊戲 / 手機遊戲',
  season: { title: '原神版本攻略', epCount: 24, siblingTitles: ['4.1 深淵滿星', '4.0 深淵滿星'] },
};

const SPARSE_DETAIL: VideoDetail = {
  bvid: SPARSE_BASIC.bvid,
  fetchedAt: 0,
  schema: 1,
  tags: ['MMD'],
  zone: '舞蹈 / 宅舞',
};

export interface PromptPreview {
  system: string;
  user: string;
  /** 這份設定是不是真的會送出圖片 */
  withImages: boolean;
  /** 對這份預覽的補充說明 */
  note: string;
}

/**
 * 依目前設定組出「這批影片實際會送給模型的內容」。用的是假資料，
 * 但走的是正式的 prompt 組裝函式，所以設定改了預覽就會跟著改。
 */
export function buildPromptPreview(settings: Settings): PromptPreview {
  const { ai, features } = settings;
  const { visionActive, withDetail, withSubtitle, withCover } = planOf(settings);

  const videos: PromptVideo[] = [
    { basic: RICH_BASIC, ...(withDetail ? { detail: { ...RICH_DETAIL } } : {}) },
    { basic: SPARSE_BASIC, ...(withDetail ? { detail: { ...SPARSE_DETAIL } } : {}) },
  ];

  if (withSubtitle) {
    for (const v of videos) {
      if (!v.detail) continue;
      v.detail.subtitleText = '大家好 今天這期我們來看看…（字幕全文最多 400 字）';
      v.detail.subtitleFrom = v.basic.bvid === RICH_BASIC.bvid ? 'human' : 'ai';
    }
  }

  if (withCover) for (const v of videos) v.coverDataUrl = 'data:image/webp;base64,UklGRi4AAABXRUJQ…';

  const { coded, codedSource } = codeFolders(SAMPLE_FOLDERS, SAMPLE_SOURCE);
  const req: ClassifyPrompt = { source: codedSource!, folders: coded, videos };
  const notes: string[] = [];
  const m = t().promptPreviewNotes;
  if (!withDetail) notes.push(m.noDetail);
  if (!visionActive && ai.attachCover) notes.push(m.visionUnverified);
  if (withCover) notes.push(m.coverPlaceholder);
  if (features.fetchSubtitle && !withDetail) notes.push(m.subtitleNeedsDetail);

  return {
    system: buildSystemPrompt(req, ai.customInstructions),
    user: contentToText(buildUserMessage(req)),
    withImages: withCover,
    note: t().promptPreviewNotes.join(notes),
  };
}
