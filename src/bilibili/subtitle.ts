import { t } from '@/i18n';
import { AppError, toAppError } from '@/shared/result';
import { biliFetch } from './http';

interface SubtitleItem {
  lan: string;
  lan_doc: string;
  subtitle_url: string;
}

interface PlayerRaw {
  subtitle?: { subtitles?: SubtitleItem[] };
}

export type SubtitleSource = 'human' | 'ai';

const isAi = (s: SubtitleItem): boolean => s.lan.startsWith('ai-');

/**
 * 人工字幕優先（比 AI 字幕準，還可能是 UP 自己寫的重點），
 * 其中又優先中文；都沒有才退回 AI 字幕；兩者皆無就放棄。
 */
export function pickSubtitle(list: SubtitleItem[]): { item: SubtitleItem; from: SubtitleSource } | undefined {
  const human = list.filter((s) => !isAi(s));
  const ai = list.filter(isAi);
  const preferZh = (xs: SubtitleItem[]): SubtitleItem | undefined =>
    xs.find((s) => s.lan.startsWith('zh')) ?? xs.find((s) => s.lan.replace(/^ai-/, '').startsWith('zh')) ?? xs[0];
  const pickedHuman = preferZh(human);
  if (pickedHuman) return { item: pickedHuman, from: 'human' };
  const pickedAi = preferZh(ai);
  return pickedAi ? { item: pickedAi, from: 'ai' } : undefined;
}

/** 字幕 JSON → 純文字 */
export function subtitleBodyToText(body: { content?: string }[]): string {
  return body
    .map((b) => (b.content ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ');
}

export interface SubtitleResult {
  text: string;
  from?: SubtitleSource;
}

/**
 * 最多 2 個請求：player/wbi/v2 取字幕清單 → 下載字幕 JSON。
 * 這支影片沒有任何字幕時只會打 1 次，回傳空結果。
 */
export async function fetchSubtitleText(aid: number, cid: number, signal?: AbortSignal): Promise<SubtitleResult> {
  const player = await biliFetch<PlayerRaw>('/x/player/wbi/v2', { query: { aid, cid }, wbi: true, signal });
  const picked = pickSubtitle(player.subtitle?.subtitles ?? []);
  if (!picked?.item.subtitle_url) return { text: '' };
  const raw = picked.item.subtitle_url;
  const url = raw.startsWith('//') ? `https:${raw}` : raw;
  let res: Response;
  try {
    res = await fetch(url, { signal: signal ?? null, referrerPolicy: 'no-referrer' });
  } catch (e) {
    throw toAppError(e);
  }
  if (!res.ok) throw new AppError('network', t().errors.subtitle.downloadFailed(res.status), { code: res.status });
  const json = (await res.json()) as { body?: { content?: string }[] };
  return { text: subtitleBodyToText(json.body ?? []), from: picked.from };
}
