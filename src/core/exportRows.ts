import type { FollowRow } from '@/shared/types';
import { daysInactive } from './activity';

/**
 * 匯出是取關以外的備用出口（例如想拿去別的工具）。
 * 兩種格式都在這裡再過濾一次「狀態已確認」——不管呼叫端傳什麼進來，
 * 未能確認活躍度的帳號永遠不能出現在匯出檔裡（Java 版的最後一道防線，原樣保留）。
 */
export function confirmedOnly(rows: readonly FollowRow[]): FollowRow[] {
  return rows.filter((r) => r.activity !== undefined && r.activity.status !== 'unknown');
}

/** 逗號分隔的 UID 清單（關注管理器腳本「從 UID 清單匯入」吃的就是這個格式） */
export function uidList(rows: readonly FollowRow[]): string {
  return confirmedOnly(rows)
    .map((r) => String(r.entry.mid))
    .join(',');
}

export interface CsvLabels {
  headers: {
    uid: string;
    name: string;
    group: string;
    daysInactive: string;
    latestVideo: string;
    videoLink: string;
    space: string;
  };
  noVideos: string;
}

function csvCell(value: string | number): string {
  const s = String(value);
  // RFC 4180：含逗號、引號、換行的欄位用雙引號包起來，內部的引號寫成兩個
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 詳細 CSV。開頭帶 BOM，Excel 才會把中文欄位當 UTF-8 讀。 */
export function toCsv(
  rows: readonly FollowRow[],
  tagNameOf: (id: number) => string | undefined,
  labels: CsvLabels,
  now = Date.now(),
): string {
  const h = labels.headers;
  const lines = [[h.uid, h.name, h.group, h.daysInactive, h.latestVideo, h.videoLink, h.space].map(csvCell).join(',')];
  for (const r of confirmedOnly(rows)) {
    const days = daysInactive(r.activity, now);
    const groups = [
      ...(r.entry.special ? [tagNameOf(-10) ?? ''] : []),
      ...r.entry.tagIds.map((id) => tagNameOf(id) ?? String(id)),
    ]
      .filter(Boolean)
      .join(' / ');
    const latest = r.activity?.latest;
    lines.push(
      [
        r.entry.mid,
        r.entry.name,
        groups,
        days === null ? '' : days === Number.POSITIVE_INFINITY ? labels.noVideos : days,
        latest?.title ?? (r.activity?.status === 'noVideos' ? labels.noVideos : ''),
        latest ? `https://www.bilibili.com/video/${latest.bvid}/` : '',
        `https://space.bilibili.com/${r.entry.mid}`,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function exportFilename(kind: 'uids' | 'csv', now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return kind === 'uids' ? `inactive-uids-${stamp}.txt` : `inactive-accounts-${stamp}.csv`;
}

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
