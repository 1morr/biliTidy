import type { ActivityRecord, FollowEntry, LatestArchive, FollowRow } from '@/shared/types';
import { DAY_MS } from './cache';

/**
 * 三態判定與「不活躍」的唯一實作。UI 的分面計數、勾選資格、匯出與取關都 import 這裡，
 * 不要在別處再算一次「這一列到底能不能選」。
 */

/** 把 API 的原料分類：`null`＝B 站明確說沒有影片 */
export function classifyActivity(mid: number, latest: LatestArchive | null, now = Date.now()): ActivityRecord {
  if (latest === null) return { mid, status: 'noVideos', checkedAt: now, schema: 1 };
  return { mid, status: 'videos', latest, checkedAt: now, schema: 1 };
}

export function unknownActivity(mid: number, reason: string, now = Date.now()): ActivityRecord {
  return { mid, status: 'unknown', reason, checkedAt: now, schema: 1 };
}

/**
 * 距最後一支影片幾天（完整的 24 小時算一天，與 Java 版 `ChronoUnit.DAYS.between` 一致）。
 * `noVideos` 回 `Infinity`（無限不活躍）；`unknown`／沒查過回 `null`。
 */
export function daysInactive(record: ActivityRecord | undefined, now = Date.now()): number | null {
  if (!record || record.status === 'unknown') return null;
  if (record.status === 'noVideos') return Number.POSITIVE_INFINITY;
  const pub = record.latest?.pubdate ?? 0;
  if (pub <= 0) return null;
  return Math.max(0, Math.floor((now - pub * 1000) / DAY_MS));
}

/** 嚴格大於門檻才算不活躍；未知永遠 false——未能確認的帳號絕不能被當作不活躍。 */
export function isInactive(record: ActivityRecord | undefined, thresholdDays: number, now = Date.now()): boolean {
  const days = daysInactive(record, now);
  return days !== null && days > thresholdDays;
}

/** 這一列能不能被勾選：只有還沒操作過、而且狀態已確認（有影片或確認無影片）的列 */
export function canSelect(row: FollowRow): boolean {
  return row.status === 'pending' && row.activity !== undefined && row.activity.status !== 'unknown';
}

/** 有分組＝使用者曾特意歸檔（含特別關注）；默认分组算沒有 */
export function hasGroup(entry: FollowEntry): boolean {
  return entry.special || entry.tagIds.length > 0;
}
