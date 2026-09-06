import type { FollowEntry, FollowKind, FollowTag } from '@/shared/types';
import { biliFetch } from './http';

/** `relation/followings` 每頁筆數（文檔預設值；自己的清單可以一直翻到底） */
export const FOLLOW_PAGE_SIZE = 50;

/**
 * `relation/modify` 的操作碼（docs/user/relation.md）。
 * 1 關注、2 取關、4 取消悄悄關注；3（悄悄關注）已下線，所以撤銷一個悄悄關注只能重新關注成一般關注。
 * 拉黑（5／6）與踢粉（7）這個工具用不到，刻意不列。
 */
export const RELATION_ACT = { FOLLOW: 1, UNFOLLOW: 2, UNWHISPER: 4 } as const;
export type RelationAct = (typeof RELATION_ACT)[keyof typeof RELATION_ACT];

/** 關注來源代碼：11＝個人空間（關注管理器腳本也用它） */
const RE_SRC = 11;

/** `relation/tags` 裡的特別關注與默认分组 */
export const SPECIAL_TAG_ID = -10;
export const DEFAULT_TAG_ID = 0;

interface RelationRaw {
  mid: number;
  attribute: number;
  mtime: number;
  tag: number[] | null;
  special: number;
  uname: string;
  face: string;
  sign: string;
  official_verify?: { type: number; desc: string };
}

interface StatRaw {
  following: number;
  whisper: number;
  black: number;
  follower: number;
}

function kindOf(raw: RelationRaw, whisperList: boolean): FollowKind {
  if (whisperList || raw.attribute === 1) return 'whisper';
  return raw.attribute === 6 ? 'mutual' : 'follow';
}

function toEntry(raw: RelationRaw, whisperList: boolean): FollowEntry {
  return {
    mid: raw.mid,
    name: raw.uname ?? '',
    face: raw.face ?? '',
    sign: raw.sign ?? '',
    tagIds: Array.isArray(raw.tag) ? raw.tag : [],
    special: raw.special === 1,
    kind: kindOf(raw, whisperList),
    followedAt: raw.mtime ?? 0,
    verify: raw.official_verify?.desc ?? '',
  };
}

/** 關注數／悄悄關注數：跑之前先知道要翻幾頁 */
export async function fetchRelationStat(vmid: number, signal?: AbortSignal): Promise<{ following: number; whisper: number }> {
  const d = await biliFetch<StatRaw>('/x/relation/stat', { query: { vmid }, signal });
  return { following: d.following ?? 0, whisper: d.whisper ?? 0 };
}

export async function fetchTags(signal?: AbortSignal): Promise<FollowTag[]> {
  const list = await biliFetch<{ tagid: number; name: string; count: number }[]>('/x/relation/tags', { signal });
  return (list ?? []).map((t) => ({ id: t.tagid, name: t.name, count: t.count ?? 0 }));
}

/** 自己的關注明細一頁。`order_type` 留空＝依關注順序（新到舊）。 */
export async function fetchFollowingsPage(vmid: number, pn: number, signal?: AbortSignal): Promise<FollowEntry[]> {
  const d = await biliFetch<{ list: RelationRaw[] | null; total: number }>('/x/relation/followings', {
    query: { vmid, pn, ps: FOLLOW_PAGE_SIZE, order_type: '' },
    signal,
  });
  return (d.list ?? []).map((raw) => toEntry(raw, false));
}

/** 悄悄關注一頁。文檔沒列分頁參數，關注管理器腳本一直是這樣帶著 pn／ps 翻的。 */
export async function fetchWhispersPage(pn: number, signal?: AbortSignal): Promise<FollowEntry[]> {
  const d = await biliFetch<{ list: RelationRaw[] | null }>('/x/relation/whispers', {
    query: { pn, ps: FOLLOW_PAGE_SIZE },
    signal,
  });
  return (d.list ?? []).map((raw) => toEntry(raw, true));
}

/**
 * 單筆關係操作。文檔明載 `batch/modify` 只接受 act 1／5，所以取關一律走這支、一次一個，
 * 由 `core/scheduler.ts` 的 writeQueue 排開。
 */
export async function modifyRelation(fid: number, act: RelationAct, signal?: AbortSignal): Promise<void> {
  await biliFetch<unknown>('/x/relation/modify', { method: 'POST', form: { fid, act, re_src: RE_SRC }, signal });
}

/** 批次重新關注（撤銷用）。最多 50 個 mid；回傳沒成功的那幾個。 */
export async function batchFollow(fids: number[], signal?: AbortSignal): Promise<{ failedFids: number[] }> {
  const d = await biliFetch<{ failed_fids?: number[] } | undefined>('/x/relation/batch/modify', {
    method: 'POST',
    form: { fids: fids.join(','), act: RELATION_ACT.FOLLOW, re_src: RE_SRC },
    signal,
  });
  return { failedFids: d?.failed_fids ?? [] };
}

/** 把幾個帳號加進幾個分組（可含 -10 特別關注；文檔範例就是 `tagids=-10,207542`）。 */
export async function addUsersToTags(fids: number[], tagIds: number[], signal?: AbortSignal): Promise<void> {
  await biliFetch<unknown>('/x/relation/tags/addUsers', {
    method: 'POST',
    form: { fids: fids.join(','), tagids: tagIds.join(',') },
    signal,
  });
}
