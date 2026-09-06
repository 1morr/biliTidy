import { storage } from 'wxt/utils/storage';
import type { FollowRow, FollowStats, FollowTag, JobStats, ReviewRow } from '@/shared/types';
import type { StopReason } from './checkActivity';

/** 上次分類結果快照：重開頁面可回到審核／續搬 */
export interface JobSnapshot {
  savedAt: number;
  sourceId: number;
  sourceTitle: string;
  targetIds: number[];
  rows: ReviewRow[];
  stats: JobStats;
}

const jobItem = storage.defineItem<JobSnapshot | null>('local:lastJob', { fallback: null });

export async function loadJobSnapshot(): Promise<JobSnapshot | null> {
  return jobItem.getValue();
}

export async function saveJobSnapshot(snapshot: JobSnapshot): Promise<void> {
  await jobItem.setValue(snapshot);
}

export async function clearJobSnapshot(): Promise<void> {
  await jobItem.setValue(null);
}

/**
 * 上次清理關注跑完的結果快照：重開頁面可以直接回到審核（勾選也還在），或接著撤銷。
 * 幾千列連同活躍度大約幾百 KB，放 storage.local（已宣告 unlimitedStorage）。
 * 與整理收藏的快照各存各的：兩個分頁可以各自留著上一輪的結果。
 */
export interface FollowJobSnapshot {
  savedAt: number;
  mid: number;
  /** 關注清單是什麼時候讀的 */
  fetchedAt: number;
  tags: FollowTag[];
  reported: { following: number; whisper: number };
  rows: FollowRow[];
  selected: number[];
  stats: FollowStats;
  /** 上一輪查活躍度是不是提前停下（風控／取消），給畫面顯示原因 */
  stopped?: { reason: StopReason; remaining: number; detail: string };
}

const followJobItem = storage.defineItem<FollowJobSnapshot | null>('local:lastFollowJob', { fallback: null });

export async function loadFollowJobSnapshot(): Promise<FollowJobSnapshot | null> {
  return followJobItem.getValue();
}

export async function saveFollowJobSnapshot(snapshot: FollowJobSnapshot): Promise<void> {
  await followJobItem.setValue(snapshot);
}

export async function clearFollowJobSnapshot(): Promise<void> {
  await followJobItem.setValue(null);
}
