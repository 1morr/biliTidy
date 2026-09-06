import { FAV_PAGE_SIZE, FAV_PAGE_YIELD } from '@/bilibili/fav';
import { t } from '@/i18n';
import type { Settings } from '@/shared/types';
import { planOf } from './plan';

export type EstimateKind = 'bili' | 'cdn' | 'ai';

export interface EstimateRow {
  key: string;
  /** 呼叫的端點（顯示用短名） */
  endpoint: string;
  /** 這個請求換到什麼資料 */
  purpose: string;
  count: number;
  kind: EstimateKind;
  /** true = 上限或粗估，不是精確值 */
  approx?: boolean;
  /** 補充說明（例如為什麼是 0） */
  note?: string;
}

export interface Estimate {
  videos: number;
  rows: EstimateRow[];
  /** B 站 API 請求合計（不含封面 CDN） */
  biliRequests: number;
  cdnRequests: number;
  aiCalls: number;
  /** 以讀取速率換算的分鐘數（首次、無快取） */
  minutes: number;
}

/**
 * 依目前設定推估一次整理會打出哪些請求、各幾次。
 * 寧可高估：詳情列的數字是「沒有任何快取」時的上限。
 */
export function estimateRun(videoCount: number, settings: Settings): Estimate {
  const videos = Math.max(0, Math.floor(videoCount));
  const { features, rate } = settings;
  const { visionActive, withDetail, withSubtitle, withCover, batchSize } = planOf(settings);

  // 一頁不保證回滿 40 支（見 FAV_PAGE_YIELD），用保守值估才不會低估
  const listRequests = Math.ceil(videos / FAV_PAGE_YIELD);
  const detailRequests = withDetail ? videos : 0;
  // 每支最多 2 次（播放器介面 + 字幕 JSON）；沒有字幕的影片只會打第一次
  const subtitleRequests = withSubtitle ? videos * 2 : 0;
  const coverRequests = withCover ? videos : 0;
  const aiCalls = Math.ceil(videos / batchSize);
  const moveRequests = Math.ceil(videos / Math.max(1, rate.moveBatchSize));

  const m = t().estimate.rows;
  const rows: EstimateRow[] = [
    {
      key: 'nav',
      endpoint: 'web-interface/nav',
      purpose: m.nav.purpose,
      count: 1,
      kind: 'bili',
      note: m.nav.note,
    },
    {
      key: 'folders',
      endpoint: 'fav/folder/created/list',
      purpose: m.folders.purpose,
      count: 1,
      kind: 'bili',
      note: m.folders.note,
    },
    {
      key: 'list',
      endpoint: 'fav/resource/list',
      purpose: m.list.purpose,
      count: listRequests,
      kind: 'bili',
      approx: listRequests > 0,
      note: m.list.note(FAV_PAGE_SIZE, FAV_PAGE_YIELD),
    },
    {
      key: 'detail',
      endpoint: 'web-interface/wbi/view/detail',
      purpose: m.detail.purpose,
      count: detailRequests,
      kind: 'bili',
      approx: detailRequests > 0,
      note: detailRequests > 0 ? m.detail.noteOn : m.detail.noteOff,
    },
    {
      key: 'subtitle',
      endpoint: `player/wbi/v2${m.subtitle.endpointSuffix}`,
      purpose: m.subtitle.purpose,
      count: subtitleRequests,
      kind: 'bili',
      approx: subtitleRequests > 0,
      note: !features.fetchSubtitle ? m.subtitle.noteOff : !withDetail ? m.subtitle.noteNeedsDetail : m.subtitle.noteOn,
    },
    {
      key: 'cover',
      endpoint: `i0.hdslb.com${m.cover.endpointSuffix}`,
      purpose: m.cover.purpose,
      count: coverRequests,
      kind: 'cdn',
      note: withCover ? m.cover.noteOn : !visionActive ? m.cover.noteVisionInactive : m.cover.noteTextOnly,
    },
    {
      key: 'ai',
      endpoint: `chat/completions${m.ai.endpointSuffix}`,
      purpose: m.ai.purpose,
      count: aiCalls,
      kind: 'ai',
      note: m.ai.note(batchSize, withCover),
    },
    {
      key: 'move',
      endpoint: 'fav/resource/move|copy',
      purpose: m.move.purpose,
      count: moveRequests,
      kind: 'bili',
      approx: true,
      note: m.move.note(rate.moveBatchSize),
    },
  ];

  // 合計直接從逐項表加總，成本卡與明細才不可能對不起來（曾經漏算 nav 與 folders 兩列）。
  // 搬移不計入：它要按下「執行搬移」才發生，不屬於「這次分類會打幾次請求」。
  const biliRequests = rows.filter((r) => r.kind === 'bili' && r.key !== 'move').reduce((n, r) => n + r.count, 0);
  const minutes = Math.ceil(biliRequests / Math.max(0.2, rate.readRps) / 60 + coverRequests / 4 / 60);
  return { videos, rows, biliRequests, cdnRequests: coverRequests, aiCalls, minutes };
}
