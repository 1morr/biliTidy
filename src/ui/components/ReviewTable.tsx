import { useMemo, useState } from 'react';
import { coverUrl } from '@/bilibili/cover';
import type { BatchRecord } from '@/core/organizer';
import type { FolderMeta, ReviewRow } from '@/shared/types';
import { useMessages } from '../hooks/useI18n';
import { IconArrowRight, IconCheck, IconLock } from './icons';
import { PromptDialog } from './PromptDialog';

const PAGE_SIZE = 100;

/**
 * 審核表。篩選（分面與「只看要搬進 X」）在左軌，這裡只負責把交給它的列畫出來——
 * 同一件事只有一個地方可以改。
 */
export function ReviewTable({
  rows,
  total,
  targets,
  editable,
  onChosen,
  onKeepSource,
  recordOf,
}: {
  /** 已經篩選過的列 */
  rows: ReviewRow[];
  /** 這次任務全部的列數，用來說明「篩掉了多少」 */
  total: number;
  targets: FolderMeta[];
  editable: boolean;
  onChosen: (bvid: string, ids: number[]) => void;
  /** 保留原位：目標改用複製，來源那份不動 */
  onKeepSource: (bvid: string, keep: boolean) => void;
  /** 這支影片所屬的 AI 批次紀錄；沒有就不顯示除錯按鈕 */
  recordOf?: (bvid: string) => BatchRecord | undefined;
}) {
  const m = useMessages();
  const [page, setPage] = useState(0);
  const [inspecting, setInspecting] = useState<ReviewRow | null>(null);
  // 一次只展開一列的目標清單：整頁都渲染 36 顆 chip × 100 列會有 3600 顆按鈕，
  // 既慢也沒辦法在一堆長得一樣的 chip 裡找到想要的那個。
  const [picking, setPicking] = useState<string | null>(null);
  const [pickQuery, setPickQuery] = useState('');
  const titleOf = useMemo(() => new Map(targets.map((t) => [t.id, t.title])), [targets]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  if (rows.length === 0) {
    return <div className="c-pad dim">{m.reviewTable.emptyFiltered(total)}</div>;
  }

  return (
    <>
      {(rows.length !== total || pages > 1) && (
        <div className="c-tools">
          <span className="dim small">{m.reviewTable.shown(rows.length, total)}</span>
          {pages > 1 && (
            <span className="row tight spacer">
              <button type="button" className="btn" disabled={current === 0} onClick={() => setPage(current - 1)}>
                {m.reviewTable.prevPage}
              </button>
              <span className="mono dim">
                {current + 1}/{pages}
              </span>
              <button type="button" className="btn" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                {m.reviewTable.nextPage}
              </button>
            </span>
          )}
        </div>
      )}

      <table className="grid">
        <thead>
          <tr>
            <th style={{ width: 120 }}>{m.reviewTable.cover}</th>
            <th>{m.reviewTable.video}</th>
            <th style={{ width: 250 }}>{m.reviewTable.aiSuggestion}</th>
            <th style={{ width: 290 }}>{m.reviewTable.targetFolders}</th>
            <th style={{ width: 100 }}>{m.reviewTable.status}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.bvid} className={r.status === 'done' ? 'done-row' : r.invalid ? 'locked' : undefined}>
              <td className="vtop">
                {/* 失效影片的 cover 是空字串，coverUrl('') 會組出一個必壞的網址 */}
                {r.cover ? (
                  <img
                    className="cover"
                    src={coverUrl(r.cover, '192w_120h_1c')}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="cover" aria-hidden="true" />
                )}
              </td>
              <td className="vtop">
                <a className="vtitle" href={`https://www.bilibili.com/video/${r.bvid}`} target="_blank" rel="noreferrer">
                  {r.title}
                </a>
                <div className="vmeta">
                  {r.seasonTitle && <span className="tag">{m.reviewTable.collection(r.seasonTitle)}</span>}
                  <span className="tag mono">{r.bvid}</span>
                </div>
              </td>
              <td className="vtop">
                {/* 模型可以同時說「留在原地」與「也放一份到 X」，兩個都要看得到 */}
                {(r.suggested.length === 0 || r.suggestedKeep) && (
                  <span className="tag" style={{ marginRight: 4 }}>
                    {m.reviewTable.staysInPlace}
                  </span>
                )}
                {r.suggested.map((id) => (
                  <span key={id} className="tag pink" style={{ marginRight: 4 }}>
                    {titleOf.get(id) ?? id}
                  </span>
                ))}
                {r.reason && <div className="reason">{r.reason}</div>}
                {r.basis && r.basis.length > 0 && (
                  <div className="basis">
                    {m.reviewTable.fieldsUsed}
                    {r.basis.map((b, i) => (
                      <span key={b + String(i)}>
                        {i > 0 && <IconArrowRight size={11} className="arrow" />}
                        {b}
                      </span>
                    ))}
                  </div>
                )}
                {r.lowConfidence && (
                  <div className="vmeta">
                    <span className="tag warn">
                      <span className="dot" style={{ background: 'var(--warn)' }} />
                      {m.reviewTable.lowConfidenceHint}
                    </span>
                  </div>
                )}
              </td>
              <td className="vtop">
                <TargetPicker
                  row={r}
                  targets={targets}
                  titleOf={titleOf}
                  locked={!editable || r.status !== 'pending' || !!r.invalid}
                  open={picking === r.bvid}
                  query={pickQuery}
                  onQuery={setPickQuery}
                  onToggleOpen={() => {
                    setPicking(picking === r.bvid ? null : r.bvid);
                    setPickQuery('');
                  }}
                  onChosen={onChosen}
                  onKeepSource={onKeepSource}
                />
              </td>
              <td className="vtop">
                <StatusCell row={r} />
                {recordOf?.(r.bvid) && (
                  <button type="button" className="link sublink" onClick={() => setInspecting(r)}>
                    {m.reviewTable.whatWasSent}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {inspecting &&
        (() => {
          const record = recordOf?.(inspecting.bvid);
          return record ? <PromptDialog title={inspecting.title} record={record} onClose={() => setInspecting(null)} /> : null;
        })()}
    </>
  );
}

/**
 * 預設只渲染「AI 建議的目標 ＋ 使用者已選的 ＋ 不搬」，要換成別的才展開帶搜尋的完整清單。
 * 一支影片同時進多個收藏夾是刻意行為（見 docs/design.md 6.1），所以選了兩個以上會明講。
 *
 * 選了目標之後底下一定看得到「會不會離開來源夾」：AI 說得對、但影片本來就該留在原本的夾子
 * 是常見情況，「也留在原位」把那一列從 move 改成 copy。
 */
function TargetPicker({
  row,
  targets,
  titleOf,
  locked,
  open,
  query,
  onQuery,
  onToggleOpen,
  onChosen,
  onKeepSource,
}: {
  row: ReviewRow;
  targets: FolderMeta[];
  titleOf: Map<number, string>;
  locked: boolean;
  open: boolean;
  query: string;
  onQuery: (q: string) => void;
  onToggleOpen: () => void;
  onChosen: (bvid: string, ids: number[]) => void;
  onKeepSource: (bvid: string, keep: boolean) => void;
}) {
  const m = useMessages();
  const shortlist = Array.from(new Set([...row.suggested, ...row.chosen]));
  const toggle = (id: number) =>
    onChosen(row.bvid, row.chosen.includes(id) ? row.chosen.filter((x) => x !== id) : [...row.chosen, id]);
  const q = query.trim().toLowerCase();
  const rest = targets.filter((t) => t.title.toLowerCase().includes(q));

  return (
    <>
      <div className="chips">
        <button
          type="button"
          className={row.chosen.length === 0 ? 'chip on' : 'chip'}
          disabled={locked}
          onClick={() => onChosen(row.bvid, [])}
        >
          {m.reviewTable.dontMove}
        </button>
        {shortlist.map((id) => (
          <button
            key={id}
            type="button"
            className={row.chosen.includes(id) ? 'chip on' : 'chip'}
            disabled={locked}
            onClick={() => toggle(id)}
          >
            {titleOf.get(id) ?? id}
          </button>
        ))}
        {!locked && (
          <button type="button" className="chip ghost" onClick={onToggleOpen}>
            {open ? m.reviewTable.collapse : m.reviewTable.changeTo}
          </button>
        )}
      </div>
      {row.chosen.length > 0 && (
        <div className="multi">
          <button
            type="button"
            className={row.keepSource ? 'chip on' : 'chip'}
            disabled={locked}
            title={m.reviewTable.alsoKeepInPlaceTitle}
            onClick={() => onKeepSource(row.bvid, !row.keepSource)}
          >
            {m.reviewTable.alsoKeepInPlace}
          </button>
          <span>{destinationNote(row, m)}</span>
        </div>
      )}
      {open && (
        <div className="chip-picker">
          <input
            type="text"
            aria-label={m.reviewTable.searchFolders}
            placeholder={m.reviewTable.searchFoldersPlaceholder}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
          <div className="chips">
            {rest.map((t) => (
              <button
                key={t.id}
                type="button"
                className={row.chosen.includes(t.id) ? 'chip on' : 'chip'}
                onClick={() => toggle(t.id)}
              >
                {t.title}
              </button>
            ))}
            {rest.length === 0 && <span className="dim small">{m.reviewTable.noMatchingFolders}</span>}
          </div>
        </div>
      )}
    </>
  );
}

/** 這一列按下去會發生什麼：會不會離開來源夾、會進幾個夾子 */
function destinationNote(row: ReviewRow, m: ReturnType<typeof useMessages>): string {
  const n = row.chosen.length;
  if (row.keepSource) return m.reviewTable.keptCopiedOut(n);
  return m.reviewTable.movedOut(n);
}

function StatusCell({ row }: { row: ReviewRow }) {
  const m = useMessages();
  const copying = !!row.keepSource;
  switch (row.status) {
    case 'done':
      return row.error ? (
        <span className="status status-failed" title={row.error}>
          {m.reviewTable.statusMovedFailed(copying)}
        </span>
      ) : (
        <span className="status status-done">
          <IconCheck />
          {copying ? m.reviewTable.statusCopied : m.reviewTable.statusMoved}
        </span>
      );
    case 'removed':
      return (
        <span className="status status-done">
          <IconCheck />
          {m.reviewTable.statusRemoved}
        </span>
      );
    case 'failed':
      return (
        <span className="status status-failed" title={row.error}>
          <span className="dot" style={{ background: 'var(--bad)' }} />
          {m.reviewTable.statusFailed}
        </span>
      );
    case 'moving':
      return (
        <span className="status muted">
          <span className="spin" />
          {copying ? m.reviewTable.statusCopying : m.reviewTable.statusMoving}
        </span>
      );
    default:
      // 失效影片：看得見、進得了計數，永遠進不了批次——與關注頁查不到的列同一個「鎖住」語彙
      if (row.invalid)
        return (
          <span className="status dim" title={m.reviewTable.staleTitle}>
            <IconLock />
            {m.reviewTable.statusStale}
          </span>
        );
      return row.chosen.length > 0 ? (
        <span className="status muted">
          <span className="dot" style={{ background: copying ? 'var(--ok)' : 'var(--info)' }} />
          {copying ? m.reviewTable.statusToCopy : m.reviewTable.statusToMove}
        </span>
      ) : (
        <span className="status dim">{m.reviewTable.statusNotMoving}</span>
      );
  }
}
