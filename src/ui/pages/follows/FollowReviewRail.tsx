import { useEffect, useState } from 'react';
import { DEFAULT_TAG_ID } from '@/bilibili/relation';
import {
  countGroups,
  countKinds,
  countStatus,
  STATUS_FACETS,
  type GroupFacet,
  type KindFacet,
  type ReviewFilter,
  type StatusFacet,
} from '@/core/followFilter';
import type { FollowTag, FollowStats, FollowRow } from '@/shared/types';
import { fmtDateTime, fmtInt } from '../../format';
import { useMessages } from '../../hooks/useI18n';

const PRESETS = [180, 365, 730];
const THRESHOLD_MIN = 1;
const THRESHOLD_MAX = 3650;

/** 分面前面那顆色點：狀態的顏色語彙在整個介面裡只有這一組 */
const STATUS_COLOR: Record<StatusFacet, string> = {
  all: 'var(--ac)',
  inactive: 'var(--warn)',
  active: 'var(--ok)',
  noVideos: '#8fb0d8',
  unknown: '#4d5560',
  done: 'var(--ok)',
  restored: 'var(--info)',
  failed: 'var(--bad)',
};

/** 就算是 0 也一直顯示的分面：門檻一改就要看得到「不活躍」變成多少 */
const ALWAYS_SHOWN: StatusFacet[] = ['all', 'inactive', 'active', 'unknown'];
const KIND_FACETS: Exclude<KindFacet, 'any'>[] = ['special', 'mutual', 'whisper'];

/**
 * 審核時的左軌：門檻在最上面（它是整張表的主控），下面是三組帶計數的分面，
 * 最底下是這一輪的摘要。分面的數字反映其他分面已套用之後還剩多少。
 */
export function FollowReviewRail({
  rows,
  tags,
  thresholdDays,
  onThreshold,
  filter,
  onFilter,
  stats,
  fetchedAt,
  reported,
  savedAt,
  now,
}: {
  rows: FollowRow[];
  tags: FollowTag[];
  thresholdDays: number;
  onThreshold: (days: number) => void;
  filter: ReviewFilter;
  onFilter: (f: ReviewFilter) => void;
  stats: FollowStats;
  fetchedAt: number | null;
  reported: { following: number; whisper: number } | null;
  savedAt: number | null;
  now: number;
}) {
  const m = useMessages();
  const [text, setText] = useState(String(thresholdDays));
  // 門檻在別處被改（預設值 chip、設定頁）時，欄位文字跟著換：在 render 期間推導，不用 effect
  const [seenThreshold, setSeenThreshold] = useState(thresholdDays);
  if (seenThreshold !== thresholdDays) {
    setSeenThreshold(thresholdDays);
    setText(String(thresholdDays));
  }
  // 停止輸入 300ms 後才套用：打「365」三個鍵不必重算三次整張表
  useEffect(() => {
    const n = Number(text);
    if (!Number.isInteger(n) || n < THRESHOLD_MIN || n > THRESHOLD_MAX || n === thresholdDays) return;
    const id = setTimeout(() => onThreshold(n), 300);
    return () => clearTimeout(id);
  }, [text, thresholdDays, onThreshold]);

  const statusCounts = countStatus(rows, filter, thresholdDays, now);
  const kindCounts = countKinds(rows, filter, thresholdDays, now);
  const groupCounts = countGroups(rows, tags, filter, thresholdDays, now);
  const noneName = tags.find((t) => t.id === DEFAULT_TAG_ID)?.name ?? m.follows.review.noGroup;
  const groups = tags
    .filter((t) => t.id !== DEFAULT_TAG_ID)
    .map((t) => ({ facet: t.id as GroupFacet, name: t.name, n: groupCounts.get(t.id) ?? 0 }))
    .filter((g) => g.n > 0 || filter.group === g.facet)
    .sort((a, b) => b.n - a.n);
  const kindsShown = KIND_FACETS.filter((k) => kindCounts[k] > 0 || filter.kind === k);
  const total = (reported?.following ?? 0) + (reported?.whisper ?? 0);

  const facetButton = (on: boolean, onClick: () => void, name: string, n: number, color?: string, key?: string | number) => (
    <button key={key ?? name} type="button" className={on ? 'facet on' : 'facet'} onClick={onClick} aria-pressed={on}>
      {color && <span className="dot" style={{ background: color }} />}
      <span className="name">{name}</span>
      <span className="n">{fmtInt(n)}</span>
    </button>
  );

  return (
    <aside className="rail">
      <div className="rail-sec">
        <label className="lbl" htmlFor="threshold">
          {m.follows.review.thresholdLabel}
        </label>
        <div className="threshold">
          <input
            id="threshold"
            type="number"
            min={THRESHOLD_MIN}
            max={THRESHOLD_MAX}
            step={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              const n = Number(text);
              if (!Number.isInteger(n) || n < THRESHOLD_MIN || n > THRESHOLD_MAX) setText(String(thresholdDays));
            }}
          />
          <span className="unit">{m.follows.review.thresholdUnit}</span>
          {/* 收得的範圍常駐寫著：填 9999 會被 onBlur 彈回上一個合法值，不說的話那個數字看起來就是被吃掉了 */}
          <span className="dim small mono">{m.follows.review.thresholdRange}</span>
        </div>
        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p} type="button" className={thresholdDays === p ? 'chip on' : 'chip'} onClick={() => onThreshold(p)}>
              {p}
            </button>
          ))}
        </div>
        <span className="desc">{m.follows.review.thresholdHint}</span>
      </div>

      <div className="rail-scroll">
        <div className="rail-sec">
          <span className="lbl">{m.follows.review.statusTitle}</span>
          <div className="facets">
            {STATUS_FACETS.filter((f) => ALWAYS_SHOWN.includes(f) || statusCounts[f] > 0 || filter.status === f).map((f) =>
              facetButton(
                filter.status === f,
                () => onFilter({ ...filter, status: f }),
                m.follows.review.status[f],
                statusCounts[f],
                STATUS_COLOR[f],
                f,
              ),
            )}
          </div>
        </div>

        {kindsShown.length > 0 && (
          <div className="rail-sec">
            <span className="lbl">{m.follows.review.kindTitle}</span>
            <div className="facets">
              {facetButton(
                filter.kind === 'any',
                () => onFilter({ ...filter, kind: 'any' }),
                m.follows.review.kind.any,
                kindCounts.any,
                undefined,
                'any',
              )}
              {kindsShown.map((k) =>
                facetButton(
                  filter.kind === k,
                  () => onFilter({ ...filter, kind: k }),
                  m.follows.review.kind[k],
                  kindCounts[k],
                  undefined,
                  k,
                ),
              )}
            </div>
          </div>
        )}

        <div className="rail-sec">
          <span className="lbl">{m.follows.review.groupTitle}</span>
          <div className="facets">
            {facetButton(
              filter.group === 'any',
              () => onFilter({ ...filter, group: 'any' }),
              m.follows.review.anyGroup,
              Array.from(groupCounts.values()).length > 0 ? statusCounts[filter.status] : 0,
              undefined,
              'any',
            )}
            {facetButton(
              filter.group === 'none',
              () => onFilter({ ...filter, group: 'none' }),
              noneName,
              groupCounts.get('none') ?? 0,
              undefined,
              'none',
            )}
            {groups.map((g) =>
              facetButton(
                filter.group === g.facet,
                () => onFilter({ ...filter, group: g.facet }),
                g.name,
                g.n,
                undefined,
                g.facet,
              ),
            )}
          </div>
        </div>
      </div>

      <div className="rail-sec" style={{ borderTop: '1px solid var(--line)', borderBottom: 0 }}>
        <span className="lbl">{m.follows.review.thisRun}</span>
        <div className="stat-grid" style={{ marginTop: 0 }}>
          <span className="read-row">
            <span>{m.follows.review.accounts}</span>
            <b className="mono">
              {total > 0 && total !== rows.length ? `${fmtInt(rows.length)} / ${fmtInt(total)}` : fmtInt(rows.length)}
            </b>
          </span>
          <span className="read-row">
            <span>{m.follows.review.checkedNow}</span>
            <b className="mono">{fmtInt(stats.fetched)}</b>
          </span>
          <span className="read-row">
            <span>{m.follows.review.fromCache}</span>
            <b className="mono">{fmtInt(stats.cached)}</b>
          </span>
          <span className={stats.unknown > 0 ? 'read-row' : 'read-row zero'}>
            <span>{m.follows.review.unknownCount}</span>
            <b className="mono">{fmtInt(stats.unknown)}</b>
          </span>
          {stats.unfollowed > 0 && (
            <span className="read-row">
              <span>{m.follows.review.unfollowedCount}</span>
              <b className="mono">{fmtInt(stats.unfollowed)}</b>
            </span>
          )}
          {stats.restored > 0 && (
            <span className="read-row">
              <span>{m.follows.review.restoredCount}</span>
              <b className="mono">{fmtInt(stats.restored)}</b>
            </span>
          )}
        </div>
        <div className="dim mono" style={{ fontSize: 11, marginTop: 9 }}>
          {fetchedAt !== null && m.follows.review.readAt(fmtDateTime(fetchedAt))}
          {savedAt !== null && ` · ${m.follows.review.savedAt(fmtDateTime(savedAt))}`}
        </div>
      </div>
    </aside>
  );
}
