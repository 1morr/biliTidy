import { z } from 'zod';
import { storage } from 'wxt/utils/storage';
import type { Settings } from '@/shared/types';

/** 影片詳情快取天數（固定值：B 站的標籤／合集幾乎不變，不值得做成設定） */
export const DETAIL_TTL_DAYS = 30;
/** 封面 base64 快取天數（固定值） */
export const COVER_TTL_DAYS = 7;
/** 讀取節流的抖動比例（固定值） */
export const READ_JITTER_PCT = 0.3;
/**
 * 帳號活躍度快取的有效天數（固定值）。快取的是「最後一支影片的日期」，帳號之後又發片的話
 * 快取會高估不活躍天數——那正是會把人誤取關的方向，所以超過這個天數一律重查，不做成設定項。
 */
export const ACTIVITY_TTL_DAYS = 30;
/** 撤銷取關時每次 `relation/batch/modify` 帶幾個 mid（文檔上限 50；小一點失敗時損失也小） */
export const RESTORE_BATCH_SIZE = 20;

/**
 * 每個欄位都自己 `.catch()` 回預設值：一個欄位填壞（例如把批次大小清空）不可以
 * 波及同一段裡的其他欄位——曾經因此把使用者的 Base URL 與 API Key 一起清成預設值。
 */
const fallback = <T extends z.ZodType>(schema: T, value: z.output<T>) => schema.catch(value);
/** 選填欄位填了非法值時退回「沒填」，而不是讓整段失效 */
const optional = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/**
 * 只允許 https，或本機模型（ollama／LM Studio）常見的 http://localhost、http://127.0.0.1。
 * `optional_host_permissions`（`wxt.config.ts`）也只開到這三種，兩邊要保持一致——開放任意 http
 * 網域的話，使用者填一個 http:// 的 base URL 就會讓 `Authorization: Bearer <key>` 明文送出去。
 */
function isAllowedBaseUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol === 'https:') return true;
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

const aiSchema = z.object({
  baseUrl: fallback(z.string().refine(isAllowedBaseUrl).default(DEFAULT_BASE_URL), DEFAULT_BASE_URL),
  apiKey: fallback(z.string().default(''), ''),
  model: fallback(z.string().default('gpt-4o-mini'), 'gpt-4o-mini'),
  visionSupported: fallback(z.boolean().default(false), false),
  visionVerifiedAt: optional(z.number()),
  attachCover: fallback(z.boolean().default(true), true),
  batchSizeText: fallback(z.number().int().min(1).max(100).default(30), 30),
  batchSizeVision: fallback(z.number().int().min(1).max(30).default(10), 10),
  temperature: optional(z.number().min(0).max(2)),
  extraBody: optional(z.string().max(2000)),
  customInstructions: optional(z.string().max(1000)),
});

const rateSchema = z.object({
  readRps: fallback(z.number().min(0.2).max(5).default(2), 2),
  writeIntervalMs: fallback(z.number().int().min(300).max(10_000).default(800), 800),
  moveBatchSize: fallback(z.number().int().min(1).max(50).default(20), 20),
});

const featureSchema = z.object({
  fetchDetail: fallback(z.boolean().default(true), true),
  fetchSubtitle: fallback(z.boolean().default(false), false),
});

const followsSchema = z.object({
  thresholdDays: fallback(z.number().int().min(1).max(3650).default(365), 365),
  includeWhispers: fallback(z.boolean().default(true), true),
});

export const settingsSchema = z.object({
  version: z.literal(1).default(1),
  ai: aiSchema.prefault({}),
  rate: rateSchema.prefault({}),
  features: featureSchema.prefault({}),
  follows: followsSchema.prefault({}),
});

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

const asObject = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? { ...(v as object) } : {});

/**
 * 把已存起來的舊欄位翻成現在的三個開關，讓使用者不會因為改版被默默重設。
 * 三選一（off／smart／all）與更早的勾選欄位都在這裡收斂。
 */
export function migrateLegacy(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = asObject(raw);
  const ai = asObject(obj.ai);
  const features = asObject(obj.features);
  // 視覺模式是使用者主動打開的，smart 翻成「附上」比較接近原本的意圖
  if (ai.attachCover === undefined) {
    if (ai.coverMode !== undefined) ai.attachCover = ai.coverMode !== 'off';
    else if ('attachCoverAll' in ai || 'smartCovers' in ai) {
      ai.attachCover = ai.attachCoverAll === true || ai.smartCovers !== false;
    }
  }
  if (features.fetchDetail === undefined) {
    if (features.detailMode !== undefined) features.fetchDetail = features.detailMode !== 'off';
    // 兩段式已移除，落回「抓取」：它本來就是為了少抓詳情，但沒省到
    else if ('detailLevel' in features) features.fetchDetail = features.detailLevel !== 'listOnly';
  }
  // 字幕的 smart 只命中缺標籤又沒合集的影片（實測 62 支中 1 支），行為接近關閉；
  // 翻成開啟會讓請求量突然多一倍，所以只有原本就是 all 的才保留開啟。
  if (features.fetchSubtitle === undefined && features.subtitleMode !== undefined) {
    features.fetchSubtitle = features.subtitleMode === 'all';
  }
  return { ...obj, ai, features };
}

/**
 * 讀取時以 schema 補齊缺漏／修正非法值，避免舊版設定讓 UI 壞掉。
 * 退回預設的範圍由小到大：欄位（schema 上的 `.catch`）→ 區段 → 整份。
 */
export function normalizeSettings(input: unknown): Settings {
  const raw = migrateLegacy(input);
  const result = settingsSchema.safeParse(raw ?? {});
  if (result.success) return result.data;
  // 整段不是物件（例如 ai 存成字串）時才會走到這裡
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    version: 1,
    ai: aiSchema.safeParse(obj.ai).data ?? DEFAULT_SETTINGS.ai,
    rate: rateSchema.safeParse(obj.rate).data ?? DEFAULT_SETTINGS.rate,
    features: featureSchema.safeParse(obj.features).data ?? DEFAULT_SETTINGS.features,
    follows: followsSchema.safeParse(obj.follows).data ?? DEFAULT_SETTINGS.follows,
  };
}

const settingsItem = storage.defineItem<Settings>('local:settings', { fallback: DEFAULT_SETTINGS });

export async function loadSettings(): Promise<Settings> {
  return normalizeSettings(await settingsItem.getValue());
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const normalized = normalizeSettings(settings);
  await settingsItem.setValue(normalized);
  return normalized;
}

export function watchSettings(cb: (settings: Settings) => void): () => void {
  return settingsItem.watch((value) => cb(normalizeSettings(value)));
}

/** 視覺功能是否可用：勾選且測試通過 */
export function isVisionActive(settings: Settings): boolean {
  return settings.ai.visionSupported && settings.ai.visionVerifiedAt !== undefined;
}

/** 這份設定會不會附上封面：勾了「附上封面」而且視覺已驗證通過 */
export function attachesCover(settings: Settings): boolean {
  return settings.ai.attachCover && isVisionActive(settings);
}
