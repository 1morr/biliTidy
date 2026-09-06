import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { SPECIAL_TAG_ID } from '@/bilibili/relation';
import { canSelect, daysInactive } from '@/core/activity';
import type { ReviewFilter, SortKey, SortSpec } from '@/core/followFilter';
import type { Messages } from '@/i18n';
import type { FollowRow } from '@/shared/types';
import { Avatar } from '../../components/Avatar';
import { IconArrowDown, IconArrowUp, IconCheck, IconLock } from '../../components/icons';
import { fmtDate, fmtInt } from '../../format';
import { useMessages } from '../../hooks/useI18n';
import { axisDays, positionOf, thresholdPosition, timelineAxis, type TimelineAxis } from './timeline';

const PAGE_SIZE = 100;
const MAX_GROUP_TAGS = 3;
const THRESHOLD_MIN = 1;
const THRESHOLD_MAX = 3650;
/** 一個年份刻度至少要這麼寬（px），不然相鄰的年份會撞在一起 */
const TICK_MIN_PX = 64;

const pct = (p: number) => `${(p * 100).toFixed(2)}%`;

/** 時間軸欄的實際寬度：刻度密度要看它，欄寬隨視窗變 */
function useMeasuredWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/**
 * 審核表。篩選與排序的定義在 `core/followFilter.ts`，這裡只負責把交給它的列畫出來——
 * 每一列都要看得到證據：最後一支影片、多久以前、分組；查不到狀態的列整列退後、勾選框鎖著。
 *
 * 「安靜期」那一欄是時間軸：每一列從最新一支投稿畫一條軌到今天，門檻是一條貫穿所有列的播放頭，
 * 表頭上的圓鈕可以拖（原生 range 換臉），拖了就是改門檻——與左軌的數字欄位是同一個設定。
 * 欄寬走 `table-layout: fixed`（見 colgroup），時間軸是最寬的一欄；窄於 1200px 時它先讓位給證據欄，
 * 窄於 900px 時天數折進帳號格、「關注於」省略。
 */
export function FollowReviewTable({
  rows,
  total,
  filter,
  selected,
  onToggle,
  tagNameOf,
  thresholdDays,
  onThreshold,
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
  onThreshold: (days: number) => void;
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

  const [rulerRef, rulerWidth] = useMeasuredWidth<HTMLDivElement>();
  const maxTicks = rulerWidth > 0 ? Math.floor(rulerWidth / TICK_MIN_PX) : 10;
  const axis = timelineAxis(rows, thresholdDays, now, maxTicks);
  const phPos = thresholdPosition(thresholdDays, axis);
  const spanDays = axisDays(axis);

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
        {/* 固定欄寬（styles.css 的 th.col-*）：時間軸是主角，證據欄靠省略號收邊 */}
        <thead>
          <tr>
            <th className="col-tick" />
            {header('name', m.follows.table.headers.account, 'col-account')}
            {header('group', m.follows.table.headers.group, 'col-group')}
            <th className="col-latest">{m.follows.table.headers.lastVideo}</th>
            <th className="col-lane" aria-label={m.follows.table.laneHeader}>
              <Ruler
                ref={rulerRef}
                width={rulerWidth}
                axis={axis}
                phPos={phPos}
                spanDays={spanDays}
                thresholdDays={thresholdDays}
                onThreshold={onThreshold}
              />
            </th>
            {header('days', m.follows.table.headers.daysInactive, 'n col-days')}
            {header('followed', m.follows.table.headers.followed, 'col-followed')}
            <th className="col-status">{m.follows.table.headers.status}</th>
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
              axis={axis}
              phPos={phPos}
            />
          ))}
        </tbody>
      </table>
    </>
  );
}

/** 表頭的刻度尺：年份刻度、「今天」、門檻的天數、可拖的播放頭 */
function Ruler({
  ref,
  width,
  axis,
  phPos,
  spanDays,
  thresholdDays,
  onThreshold,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  /** 量到的欄寬（px）；0＝還沒量到 */
  width: number;
  axis: TimelineAxis;
  phPos: number;
  spanDays: number;
  thresholdDays: number;
  onThreshold: (days: number) => void;
}) {
  const m = useMessages();
  // 最後一個年份刻度太靠右會撞到「今天」：離右端不到一個刻度寬的那一格不標
  const reserve = width > 0 ? Math.min(0.3, TICK_MIN_PX / width) : 0.15;
  const ticks = axis.ticks.filter((t) => positionOf(t.at, axis) < 1 - reserve);
  return (
    <div className="ruler" ref={ref}>
      {ticks.map((t, i) => {
        const p = positionOf(t.at, axis);
        return (
          <span key={t.at} style={{ display: 'contents' }}>
            <span className={i === 0 && p < 0.02 ? 'yr first' : 'yr'} style={{ left: pct(p) }}>
              {t.label}
            </span>
            <span className="tick" style={{ left: pct(p) }} />
          </span>
        );
      })}
      <span className="yr last">{m.follows.table.today}</span>
      <span className={phPos > 0.72 ? 'ph-cap flip' : 'ph-cap'} style={{ left: pct(phPos) }}>
        {m.follows.table.thresholdCap(thresholdDays)}
      </span>
      {/* range 的值是「距軸左端幾天」，往右拖＝門檻變小；換算回天數再夾進門檻的合法範圍 */}
      <input
        type="range"
        className="playhead"
        min={0}
        max={spanDays}
        step={1}
        value={Math.max(0, Math.min(spanDays, spanDays - thresholdDays))}
        aria-label={m.follows.table.playheadLabel}
        aria-valuetext={m.follows.table.thresholdCap(thresholdDays)}
        onChange={(e) => {
          const days = spanDays - Number(e.target.value);
          onThreshold(Math.max(THRESHOLD_MIN, Math.min(THRESHOLD_MAX, days)));
        }}
      />
    </div>
  );
}

/**
 * 天數欄的三種值講的是三件不同的事，文字要說出事實：
 * 數字＝距最新一支投稿幾天（超過門檻用黃色）；「從未投稿」比任何門檻都不活躍，排在降冪的最前面；
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
      text: m.follows.table.noVideosCell,
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
  axis,
  phPos,
}: {
  row: FollowRow;
  selected: boolean;
  onToggle: (mid: number) => void;
  tagNameOf: (id: number) => string | undefined;
  thresholdDays: number;
  now: number;
  locked: boolean;
  axis: TimelineAxis;
  phPos: number;
}) {
  const m = useMessages();
  const e = row.entry;
  const a = row.activity;
  const selectable = canSelect(row) && !locked;
  const unresolved = row.status === 'pending' && !canSelect(row);
  const inactiveDays = daysInactive(a, now);
  const days = daysLabel(inactiveDays, thresholdDays, m);
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

  // 特別關注是使用者特意歸檔的訊號，用粗體中性標籤；粉色留給選取與主要動作
  const groups: { key: string; name: string; strong: boolean }[] = [
    ...(e.special ? [{ key: 'special', name: tagNameOf(SPECIAL_TAG_ID) ?? m.follows.table.specialTag, strong: true }] : []),
    ...e.tagIds
      .filter((id) => id !== SPECIAL_TAG_ID)
      .map((id) => ({ key: `tag-${id}`, name: tagNameOf(id) ?? String(id), strong: false })),
  ];
  const lockReason = a === undefined ? m.follows.table.cannotSelectUnchecked : m.follows.table.cannotSelectUnknown;
  const over = inactiveDays !== null && inactiveDays > thresholdDays;

  // 時間軸那一格：有投稿＝從那一天到今天的一段（超過門檻黃、沒超過綠）；從未投稿＝虛線軌加一句；查不到＝虛線軌加鎖住的理由
  const lane = (() => {
    if (a?.status === 'videos' && a.latest && inactiveDays !== null && inactiveDays !== Number.POSITIVE_INFINITY) {
      const p = positionOf(a.latest.pubdate, axis);
      const color = over ? 'var(--warn)' : 'var(--ok)';
      return (
        <div className="lane">
          <span className="trk" />
          <span className="bar" style={{ left: pct(p), background: color }} />
          <span className="mk" style={{ left: pct(p), background: color }} />
          <span className="ph" style={{ left: pct(phPos) }} />
        </div>
      );
    }
    const none = a?.status === 'noVideos';
    return (
      <div className={none ? 'lane none' : 'lane na'}>
        <span className="trk" />
        <span className="note">
          {none ? m.follows.table.noVideosShort : a === undefined ? m.follows.table.notChecked : m.follows.table.unknown}
        </span>
        <span className="ph" style={{ left: pct(phPos) }} />
      </div>
    );
  })();

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
              <span>{e.mid}</span>
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
              <span key={g.key} className={g.strong ? 'tag strong' : 'tag'} title={g.name}>
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
      <td className="col-lane">{lane}</td>
      <td className="n col-days">
        <span className={`days ${days.cls}`.trim()} title={days.title}>
          {days.text}
        </span>
      </td>
      <td className="col-followed">
        <span className="mono dim">{fmtDate(e.followedAt)}</span>
      </td>
      <td>
        <StatusCell row={row} lockReason={unresolved ? lockReason : null} over={over} />
      </td>
    </tr>
  );
}

/**
 * 狀態格：操作中／已完成／失敗寫操作結果；還沒動過的列寫它的活躍度判定（安靜、還在更新、沒有影片），
 * 與左軌的狀態分面同一套字——這一格永遠有內容，不會整欄空白。
 */
function StatusCell({ row, lockReason, over }: { row: FollowRow; lockReason: string | null; over: boolean }) {
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
    default: {
      if (lockReason) {
        return (
          <span className="status dim">
            <IconLock />
            {lockReason}
          </span>
        );
      }
      const a = row.activity;
      if (a?.status === 'noVideos') {
        return (
          <span className="status muted">
            <span className="dot" style={{ background: 'var(--info)' }} />
            {m.follows.table.state.noVideos}
          </span>
        );
      }
      return (
        <span className="status muted">
          <span className="dot" style={{ background: over ? 'var(--warn)' : 'var(--ok)' }} />
          {over ? m.follows.table.state.quiet : m.follows.table.state.uploading}
        </span>
      );
    }
  }
}
