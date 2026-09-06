import { t } from '@/i18n';
import type { ClassificationItem } from '@/shared/types';
import { BASIS_MAX, BASIS_VALUES } from './prompt';

export interface ParseResult {
  /** 一定會有 expectedBvids 裡的每一支；模型漏掉或亂填 id 的都補成「保持原位」 */
  items: ClassificationItem[];
  /** 完全無法解析 */
  parseError?: string;
}

/**
 * 從模型輸出中抽出第一個 JSON 值（容忍 ```json 圍欄與前後說明文字）。
 * 只砍開頭／結尾真的是圍欄的部分：舊版用全域 replace 把字串裡任何位置的 ``` 都拿掉，
 * 連模型寫在 `reason` 字串裡的反引號也會被吃掉，靜靜改掉不是圍欄的內容。
 * 中間夾著說明文字（fence 前後有話）的情況本來就是靠下面找 `{`／`[` 配對括號解決，不需要先砍。
 */
export function extractJson(content: string): unknown {
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\r?\n?/i, '')
    .replace(/\r?\n?```$/i, '')
    .trim();
  const candidates = [stripped];
  const firstObj = stripped.indexOf('{');
  const firstArr = stripped.indexOf('[');
  const starts = [firstObj, firstArr].filter((i) => i >= 0).sort((a, b) => a - b);
  for (const start of starts) {
    const close = stripped[start] === '{' ? '}' : ']';
    const end = stripped.lastIndexOf(close);
    if (end > start) candidates.push(stripped.slice(start, end + 1));
  }
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      // 試下一個候選
    }
  }
  throw new Error('no valid JSON found in the model reply');
}

function toIdList(raw: unknown): number[] {
  const list = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
  return list.map(Number).filter((n) => Number.isFinite(n));
}

const BASIS_SET = new Set<string>(BASIS_VALUES);

/** 只留合法的依據名稱；模型常會回「tags」「封面圖」這類變體，正規化後仍不合法就丟掉 */
export function toBasisList(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[、,，/]/) : [];
  const out: string[] = [];
  for (const v of list) {
    const name = String(v)
      .trim()
      .replace(/圖$|名稱$|主$/, '');
    const hit = BASIS_SET.has(name) ? name : BASIS_VALUES.find((b) => name.includes(b));
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out.slice(0, BASIS_MAX);
}

export function parseClassification(content: string, expectedBvids: string[], validFolderIds: Set<number>): ParseResult {
  let data: unknown;
  try {
    data = extractJson(content);
  } catch (e) {
    return {
      items: expectedBvids.map((bvid) => ({
        bvid,
        targetFolderIds: [],
        reason: t().errors.ai.couldNotParseReply,
        lowConfidence: true,
      })),
      parseError: e instanceof Error ? e.message : String(e),
    };
  }
  const list: unknown = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)
      ? (data as { results: unknown[] }).results
      : [];

  const byBvid = new Map<string, ClassificationItem>();
  for (const raw of list as unknown[]) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const bvid = typeof r.bvid === 'string' ? r.bvid.trim() : '';
    if (!bvid || byBvid.has(bvid)) continue;
    // 清單裡沒有的 id 一律丟掉：模型偶爾會回超出 1..N 的號碼，硬搬會搬進不相干的收藏夾
    const ids = toIdList(r.target_folder_ids ?? r.target_folder_id).filter((id) => validFolderIds.has(id));
    const item: ClassificationItem = {
      bvid,
      targetFolderIds: Array.from(new Set(ids)),
      reason: typeof r.reason === 'string' ? r.reason.trim() : '',
    };
    const basis = toBasisList(r.basis);
    if (basis.length > 0) item.basis = basis;
    if (String(r.confidence ?? '').toLowerCase() === 'low') item.lowConfidence = true;
    byBvid.set(bvid, item);
  }

  const items = expectedBvids.map(
    (bvid) =>
      byBvid.get(bvid) ??
      ({ bvid, targetFolderIds: [], reason: t().errors.ai.noResultReturned, lowConfidence: true } satisfies ClassificationItem),
  );
  return { items };
}
