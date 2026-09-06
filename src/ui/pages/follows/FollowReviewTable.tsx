import { useState, type MouseEvent } from 'react';
import { SPECIAL_TAG_ID } from '@/bilibili/relation';
import { canSelect, daysInactive } from '@/core/activity';
import type { ReviewFilter, SortKey, SortSpec } from '@/core/followFilter';
import type { Messages } from '@/i18n';
import type { FollowRow } from '@/shared/types';
import { Avatar } from '../../components/Avatar';
import { IconArrowDown, IconArrowUp, IconCheck, IconLock } from '../../components/icons';
import { fmtDate, fmtInt } from '../../format';
import { useMessages } from '../../hooks/useI18n';

const PAGE_SIZE = 100;
const MAX_GROUP_TAGS = 3;

/**
 * 審核表。篩選與排序的定義在 `core/reviewFilter.ts`，這裡只負責把交給它的列畫出來——
 * 每一列都要看得到證據：最後一支影片、多久以前、分組；查不到狀態的列整列退後、勾選框鎖著。
 * 窄於 900px 時天數折進帳號格、「關注於」省略（CSS 的 `.col-days`／`.col-followed`／`.acct-days`）。
 */
export function FollowReviewTable({
  rows,
  total,
  filter,
  selected,
  onToggle,
  tagNameOf,
  thresholdDays,
  now,
  sort,
  onSort,
  locked,
}: {
  /** 已經篩選、排序過的列 */
  rows: FollowRow[];
  /** 全部的列數，用來說明「篩掉了多少」 */
  total: number;
  filter: ReviewFilter;
  selected: ReadonlySet<number>;
  onToggle: (mid: number) => void;
  tagNameOf: (id: number) => string | undefined;
  thresholdDays: number;
  now: number;
  sort: SortSpec;
  onSort: (sort: SortSpec) => void;
  /** 寫入進行中：不能改勾選 */
  locked: boolean;
}) {
  const m = useMessages();
  // 換了篩選或排序就回到第一頁：頁碼跟著一把「篩選＋排序」的鍵存，鍵變了頁碼自然歸零
  const viewKey = JSON.stringify([filter, sort]);
  const [paging, setPaging] = useState({ key: viewKey, page: 0 });
  const page = paging.key === viewKey ? paging.page : 0;
  const setPage = (next: number) => setPaging({ key: viewKey, page: next });

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const header = (key: SortKey, label: string, className?: string) => {
    const on = sort.key === key;
    const next: SortSpec = on ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'days' ? 'desc' : 'asc' };
    return (
      <th className={className} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
        <button type="button" className={on ? 'sort on' : 'sort'} onClick={() => onSort(next)}>
          {label}
          {on && (sort.dir === 'asc' ? <IconArrowUp /> : <IconArrowDown />)}
        </button>
      </th>
    );
  };

  if (rows.length === 0) {
    return (
      <div className="c-pad dim">
        {filter.status === 'inactive' && filter.kind === 'any' && filter.group === 'any' && !filter.query
          ? m.follows.review.noneInactive(thresholdDays, total)
          : m.follows.review.emptyFiltered(total)}
      </div>
    );
  }

  return (
    <>
      {pages > 1 && (
        <div className="c-tools" style={{ justifyContent: 'flex-end' }}>
          <span className="pager">
            <button type="button" className="btn small" disabled={current === 0} onClick={() => setPage(current - 1)}>
              {m.follows.table.prevPage}
            </button>
            <span className="mono dim small">
              {current + 1}/{pages}
            </span>
            <button type="button" className="btn small" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              {m.follows.table.nextPage}
            </button>
          </span>
        </div>
      )}

      <table className="grid dense">
        <thead>
          <tr>
            <th style={{ width: 36 }} />
            {header('name', m.follows.table.headers.account)}
            {header('group', m.follows.table.headers.group)}
            <th className="col-latest">{m.follows.table.headers.lastVideo}</th>
            {header('days', m.follows.table.headers.daysInactive, 'n col-days')}
            {header('followed', m.follows.table.headers.followed, 'col-followed')}
            <th style={{ width: 140 }}>{m.follows.table.headers.status}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <Row
              key={r.entry.mid}
              row={r}
              selected={selected.has(r.entry.mid)}
              onToggle={onToggle}
              tagNameOf={tagNameOf}
              thresholdDays={thresholdDays}
              now={now}
              locked={locked}
            />
          ))}
        </tbody>
      </table>
    </>
  );
}

/**
 * 天數欄的三種值講的是三件不同的事，文字要說出事實：
 * 數字＝距最新一支投稿幾天（超過門檻用琥珀色）；「從未投稿」比任何門檻都不活躍，排在降冪的最前面；
 * 「—」＝查不到或還沒查，排在最後。
 */
function daysLabel(
  days: number | null,
  thresholdDays: number,
  m: Messages,
): { text: string; short: string; cls: string; title?: string } {
  if (days === null) return { text: '—', short: '—', cls: 'na' };
  if (days === Number.POSITIVE_INFINITY) {
    return {
      text: m.follows.table.noVideosShort,
      short: m.follows.table.noVideosShort,
      cls: 'none',
      title: m.follows.table.noVideos,
    };
  }
  // `short` 是窄視窗折進帳號格時用的，帶單位：旁邊就是 mid，兩串裸數字並排會分不出哪個是天數
  return {
    text: fmtInt(days),
    short: m.follows.table.daysShort(days),
    cls: days > thresholdDays ? 'over' : '',
    title: m.follows.table.daysTitle(days),
  };
}

function Row({
  row,
  selected,
  onToggle,
  tagNameOf,
  thresholdDays,
  now,
  locked,
}: {
  row: FollowRow;
  selected: boolean;
  onToggle: (mid: number) => void;
  tagNameOf: (id: number) => string | undefined;
  thresholdDays: number;
  now: number;
  locked: boolean;
}) {
  const m = useMessages();
  const e = row.entry;
  const a = row.activity;
  const selectable = canSelect(row) && !locked;
  const unresolved = row.status === 'pending' && !canSelect(row);
  const days = daysLabel(daysInactive(a, now), thresholdDays, m);
  const cls = [
    selectable ? 'pick' : '',
    selected ? 'sel' : '',
    unresolved ? 'locked' : '',
    row.status === 'done' || row.status === 'restored' ? 'done-row' : '',
    row.status === 'failed' || row.status === 'restoreFailed' ? 'failed-row' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const onRowClick = (ev: MouseEvent<HTMLTableRowElement>) => {
    if (!selectable) return;
    const target = ev.target as HTMLElement;
    if (target.closest('a, button, input')) return;
    onToggle(e.mid);
  };

  const groups: { key: string; name: string; pink: boolean }[] = [
    ...(e.special ? [{ key: 'special', name: tagNameOf(SPECIAL_TAG_ID) ?? m.follows.table.specialTag, pink: true }] : []),
    ...e.tagIds
      .filter((id) => id !== SPECIAL_TAG_ID)
      .map((id) => ({ key: `tag-${id}`, name: tagNameOf(id) ?? String(id), pink: false })),
  ];
  const lockReason = a === undefined ? m.follows.table.cannotSelectUnchecked : m.follows.table.cannotSelectUnknown;

  return (
    <tr className={cls || undefined} onClick={onRowClick} aria-selected={selected}>
      <td>
        <input
          type="checkbox"
          checked={selected}
          disabled={!selectable}
          title={unresolved ? lockReason : undefined}
          aria-label={m.follows.table.tickLabel(e.name)}
          onChange={() => onToggle(e.mid)}
        />
      </td>
      <td>
        <div className="acct">
          <Avatar face={e.face} size="md" />
          <div className="acct-info">
            <span className="acct-name">
              <a
                href={`https://space.bilibili.com/${e.mid}`}
                target="_blank"
                rel="noreferrer"
                className="ellipsis"
                title={m.follows.table.openSpace}
              >
                {e.name}
              </a>
              {e.kind === 'mutual' && <span className="tag info">{m.follows.table.mutualTag}</span>}
              {e.kind === 'whisper' && <span className="tag">{m.follows.table.whisperTag}</span>}
            </span>
            <span className="acct-sub">
              <span className={`acct-days ${days.cls}`.trim()} title={days.title}>
                {days.short}
              </span>
              <span className="mono">{e.mid}</span>
              {e.verify && (
                <span className="ellipsis" title={e.verify}>
                  {e.verify}
                </span>
              )}
            </span>
          </div>
        </div>
      </td>
      <td className={groups.length === 0 ? 'col-group empty' : 'col-group'}>
        {groups.length === 0 ? (
          <span className="dim">—</span>
        ) : (
          <div className="groups">
            {groups.slice(0, MAX_GROUP_TAGS).map((g) => (
              <span key={g.key} className={g.pink ? 'tag pink' : 'tag'} title={g.name}>
                <span>{g.name}</span>
              </span>
            ))}
            {groups.length > MAX_GROUP_TAGS && (
              <span
                className="tag"
                title={groups
                  .slice(MAX_GROUP_TAGS)
                  .map((g) => g.name)
                  .join(', ')}
              >
                +{groups.length - MAX_GROUP_TAGS}
              </span>
            )}
          </div>
        )}
      </td>
      <td className="col-latest">
        <div className="vid">
          {a?.status === 'videos' && a.latest ? (
            <>
              <a
                className="vid-title"
                href={`https://www.bilibili.com/video/${a.latest.bvid}/`}
                target="_blank"
                rel="noreferrer"
                title={a.latest.title}
              >
                {a.latest.title || a.latest.bvid}
              </a>
              <span className="vid-sub mono">{fmtDate(a.latest.pubdate)}</span>
            </>
          ) : a?.status === 'noVideos' ? (
            <span className="vid-title">{m.follows.table.noVideos}</span>
          ) : a?.status === 'unknown' ? (
            <>
              <span className="vid-title">{m.follows.table.unknown}</span>
              {a.reason && (
                <span className="vid-sub ellipsis" title={a.reason}>
                  {a.reason}
                </span>
              )}
            </>
          ) : (
            <span className="vid-title">{m.follows.table.notChecked}</span>
          )}
        </div>
      </td>
      <td className="n col-days">
        <span className={`days ${days.cls}`.trim()} title={days.title}>
          {days.text}
        </span>
      </td>
      <td className="col-followed">
        <span className="mono dim">{fmtDate(e.followedAt)}</span>
      </td>
      <td>
        <StatusCell row={row} lockReason={unresolved ? lockReason : null} />
      </td>
    </tr>
  );
}

function StatusCell({ row, lockReason }: { row: FollowRow; lockReason: string | null }) {
  const m = useMessages();
  switch (row.status) {
    case 'unfollowing':
      return (
        <span className="status muted">
          <span className="spin" />
          {m.follows.table.status.unfollowing}
        </span>
      );
    case 'done':
      return (
        <span className="status status-done">
          <IconCheck />
          {m.follows.table.status.done}
        </span>
      );
    case 'failed':
      return (
        <span className="status status-failed" title={row.error}>
          <span className="dot" style={{ background: 'var(--bad)' }} />
          <span>
            {m.follows.table.status.failed}
            {row.error && <span className="note">{row.error}</span>}
          </span>
        </span>
      );
    case 'restoring':
      return (
        <span className="status muted">
          <span className="spin" />
          {m.follows.table.status.restoring}
        </span>
      );
    case 'restored':
      return (
        <span className="status" style={{ color: 'var(--info)' }}>
          <IconCheck />
          <span>
            {m.follows.table.status.restored}
            {row.note && <span className="note">{row.note}</span>}
          </span>
        </span>
      );
    case 'restoreFailed':
      return (
        <span className="status status-failed" title={row.error}>
          <span className="dot" style={{ background: 'var(--bad)' }} />
          <span>
            {m.follows.table.status.restoreFailed}
            {row.error && <span className="note">{row.error}</span>}
          </span>
        </span>
      );
    default:
      if (lockReason) {
        return (
          <span className="status dim">
            <IconLock />
            {lockReason}
          </span>
        );
      }
      return <span className="status dim">{m.follows.table.status.pending}</span>;
  }
}
