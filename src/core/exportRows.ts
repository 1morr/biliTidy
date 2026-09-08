import type { FollowRow, ReviewRow } from '@/shared/types';
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
  return `\ufeff${lines.join('\r\n')}\r\n`;
}

export interface ReviewCsvLabels {
  headers: {
    bvid: string;
    title: string;
    source: string;
    suggested: string;
    chosen: string;
    keepInPlace: string;
    lowConfidence: string;
    stale: string;
    reason: string;
    basis: string;
    status: string;
    error: string;
  };
  /** 是／否欄位為真時填的字；為假時留空——CSV 讀起來一眼看得出哪幾列有標記 */
  yes: string;
}

/**
 * 整理結果的存檔：這次 AI 把哪支影片分到哪個夾、理由是什麼、你最後選了什麼。
 *
 * 兩件與關注那半邊不同的事：
 * - **每一列都寫出去**，不是只寫「你勾的」。關注匯出的是要餵回別的工具的名單、等同一次批次，
 *   所以有 `confirmedOnly()` 那道防線；這份檔案不會被拿去執行任何寫入，失效影片與你決定不搬的列
 *   一起留著才是完整紀錄。
 * - `status` 直接寫 `ReviewStatus` 的原字串、不翻譯。CSV 是給工具與往後的自己讀的，穩定的機器值
 *   比畫面上的句子有用，而且不必跟 `ReviewTable` 那個「done ＋ keepSource ＝ 已複製」的組合邏輯
 *   維持同步——那些條件在這裡是各自獨立的欄位。
 */
export function toReviewCsv(
  rows: readonly ReviewRow[],
  sourceTitle: string,
  folderNameOf: (id: number) => string | undefined,
  labels: ReviewCsvLabels,
): string {
  const h = labels.headers;
  const names = (ids: readonly number[]) => ids.map((id) => folderNameOf(id) ?? String(id)).join(' / ');
  const flag = (on: boolean | undefined) => (on ? labels.yes : '');
  const lines = [
    [
      h.bvid,
      h.title,
      h.source,
      h.suggested,
      h.chosen,
      h.keepInPlace,
      h.lowConfidence,
      h.stale,
      h.reason,
      h.basis,
      h.status,
      h.error,
    ]
      .map(csvCell)
      .join(','),
  ];
  for (const r of rows) {
    lines.push(
      [
        r.bvid,
        r.title,
        sourceTitle,
        names(r.suggested),
        names(r.chosen),
        flag(r.keepSource),
        flag(r.lowConfidence),
        flag(r.invalid),
        r.reason,
        (r.basis ?? []).join(' / '),
        r.status,
        r.error ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `\ufeff${lines.join('\r\n')}\r\n`;
}

export type ExportKind = 'uids' | 'csv' | 'review';

const FILENAMES: Record<ExportKind, (stamp: string) => string> = {
  uids: (s) => `inactive-uids-${s}.txt`,
  csv: (s) => `inactive-accounts-${s}.csv`,
  review: (s) => `classified-videos-${s}.csv`,
};

export function exportFilename(kind: ExportKind, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return FILENAMES[kind](stamp);
}

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
