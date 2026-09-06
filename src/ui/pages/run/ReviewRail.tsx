import { localeTag, type Messages } from '@/i18n';
import type { FolderMeta, JobStats } from '@/shared/types';
import { FolderCover } from '../../components/FolderCover';
import { IconArrowRight } from '../../components/icons';
import { useMessages } from '../../hooks/useI18n';
import type { ReviewCounts, ReviewFilter } from './reviewFilter';

function facetsOf(m: Messages): { id: ReviewFilter; label: string; key: keyof ReviewCounts; color?: string }[] {
  return [
    { id: 'all', label: m.reviewRail.facets.all, key: 'all', color: 'var(--ac)' },
    { id: 'move', label: m.reviewRail.facets.move, key: 'move', color: 'var(--info)' },
    { id: 'copy', label: m.reviewRail.facets.copy, key: 'copy', color: 'var(--ok)' },
    { id: 'stay', label: m.reviewRail.facets.stay, key: 'stay', color: '#4d5560' },
    { id: 'lowConfidence', label: m.reviewRail.facets.lowConfidence, key: 'lowConfidence', color: 'var(--warn)' },
    { id: 'invalid', label: m.reviewRail.facets.invalid, key: 'invalid', color: 'var(--bad)' },
    { id: 'done', label: m.reviewRail.facets.done, key: 'done', color: 'var(--ok)' },
    { id: 'failed', label: m.reviewRail.facets.failed, key: 'failed', color: '#3a4049' },
  ];
}

/**
 * 審核時的左軌：這次任務的摘要，加上兩組分面。
 * 原本是表格上方一排橫向 tab 加一個下拉，收藏夾一多就看不完；
 * 垂直分面把數量直接寫在旁邊，「只看要搬進 X」才真的用得起來。
 */
export function ReviewRail({
  sourceTitle,
  sourceFolder,
  targets,
  stats,
  savedAt,
  counts,
  targetCounts,
  filter,
  onFilter,
  targetFilter,
  onTargetFilter,
}: {
  sourceTitle: string;
  sourceFolder: FolderMeta | null;
  targets: FolderMeta[];
  stats: JobStats;
  savedAt: number | null;
  counts: ReviewCounts;
  targetCounts: Map<number, number>;
  filter: ReviewFilter;
  onFilter: (f: ReviewFilter) => void;
  targetFilter: number;
  onTargetFilter: (id: number) => void;
}) {
  const m = useMessages();
  const facets = facetsOf(m);
  return (
    <aside className="rail">
      <div className="rail-sec">
        <span className="lbl">{m.reviewRail.thisRun}</span>
        <div className="row tight" style={{ flexWrap: 'nowrap' }}>
          {sourceFolder && <FolderCover folder={sourceFolder} size="sm" />}
          <span className="folder-title">{sourceTitle}</span>
          <IconArrowRight size={15} className="pink-icon" />
          <span className="folder-title">{m.run.targetCount(targets.length)}</span>
        </div>
        <div className="stat-grid">
          <span className="read-row">
            <span>{m.reviewRail.detailsFetched}</span>
            <b className="mono">{stats.fetched}</b>
          </span>
          <span className="read-row">
            <span>{m.reviewRail.cacheHits}</span>
            <b className="mono">{stats.cached}</b>
          </span>
          <span className="read-row">
            <span>{m.reviewRail.aiCalls}</span>
            <b className="mono">{stats.aiCalls}</b>
          </span>
          <span className="read-row">
            <span>{m.reviewRail.moved}</span>
            <b className="mono">{stats.moved}</b>
          </span>
          {stats.copied > 0 && (
            <span className="read-row">
              <span>{m.reviewRail.copied}</span>
              <b className="mono">{stats.copied}</b>
            </span>
          )}
          {stats.removed > 0 && (
            <span className="read-row">
              <span>{m.reviewRail.staleRemoved}</span>
              <b className="mono">{stats.removed}</b>
            </span>
          )}
          {stats.detailFailed > 0 && (
            <span className="read-row">
              <span>{m.reviewRail.detailsUnavailable}</span>
              <b className="mono">{stats.detailFailed}</b>
            </span>
          )}
        </div>
        {savedAt !== null && (
          <div className="dim mono" style={{ fontSize: 11, marginTop: 9 }}>
            {m.reviewRail.savedAt(new Date(savedAt).toLocaleTimeString(localeTag(), { hour12: false }))}
          </div>
        )}
      </div>

      <div className="rail-sec">
        <span className="lbl">{m.reviewRail.filter}</span>
        <div className="facets">
          {facets
            .filter((f) => f.id === 'all' || f.id === 'move' || f.id === 'stay' || counts[f.key] > 0 || filter === f.id)
            .map((f) => (
              <button key={f.id} type="button" className={filter === f.id ? 'facet on' : 'facet'} onClick={() => onFilter(f.id)}>
                <span className="dot" style={{ background: f.color }} />
                <span className="name">{f.label}</span>
                <span className="n">{counts[f.key]}</span>
              </button>
            ))}
        </div>
      </div>

      {targets.length > 1 && (
        <div className="rail-sec grow">
          <span className="lbl">{m.reviewRail.onlyShowMovingInto}</span>
          <div className="facets">
            <button type="button" className={targetFilter === 0 ? 'facet on' : 'facet'} onClick={() => onTargetFilter(0)}>
              <span className="name">{m.reviewRail.allTargets}</span>
              <span className="n">{counts.move}</span>
            </button>
            {targets.map((t) => (
              <button
                key={t.id}
                type="button"
                className={targetFilter === t.id ? 'facet on' : 'facet'}
                onClick={() => onTargetFilter(t.id)}
              >
                <span className="name">{t.title}</span>
                <span className="n">{targetCounts.get(t.id) ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
