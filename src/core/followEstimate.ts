import { FOLLOW_PAGE_SIZE } from '@/bilibili/relation';

/**
 * 這次大概要跑多久：關注清單的頁數（關注數／50，加上 stat 與 tags 兩支）＋ 要查活躍度的帳號數，
 * 全部走同一個讀取節流器，所以直接除以每秒請求數。給作業列與準備畫面顯示用，不是承諾。
 */
export function estimateReadRequests(follows: number, toCheck: number): number {
  return Math.ceil(follows / FOLLOW_PAGE_SIZE) + 2 + toCheck;
}

export function estimateSeconds(follows: number, toCheck: number, readRps: number): number {
  return estimateReadRequests(follows, toCheck) / Math.max(0.1, readRps);
}

/** 秒 → 給人看的分鐘數，不足一分鐘算一分鐘 */
export function roundMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}
