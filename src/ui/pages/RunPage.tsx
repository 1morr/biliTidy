import { useEffect, useMemo, useState } from 'react';
import { estimateRun } from '@/core/estimate';
import { planFlow } from '@/core/flow';
import { effectiveDescription } from '@/core/folderStore';
import type { BatchRecord } from '@/core/organizer';
import { planOf } from '@/core/plan';
import type { Messages } from '@/i18n';
import type { JobPhase } from '@/shared/types';
import { FolderCover } from '../components/FolderCover';
import { IconArrowRight, IconCheck, IconSearch, IconSparkle } from '../components/icons';
import { ProgressBar, ProgressPanel } from '../components/ProgressPanel';
import { ReviewTable } from '../components/ReviewTable';
import { TargetFolderTable } from '../components/TargetFolderTable';
import { useMessages } from '../hooks/useI18n';
import { useNow } from '../hooks/useLive';
import { otherJobRunning, useJobGuard } from '../jobGuard';
import { useJobStore } from '../jobStore';
import { useAppStore } from '../store';
import { BatchPanel } from './run/BatchPanel';
import { ReviewRail } from './run/ReviewRail';
import { RunDetailsDialog } from './run/RunDetailsDialog';
import { SourceRail } from './run/SourceRail';
import { countByTarget, countRows, filterRows, type ReviewFilter } from './run/reviewFilter';

/** 進行中的階段對應到 planFlow 的哪一步 */
const PHASE_STEP: Record<string, string> = {
  fetchingList: 'list',
  fetchingDetail: 'detail',
  fetchingCovers: 'cover',
  classifying: 'classify',
  moving: 'move',
};

const BUSY_PHASES: JobPhase[] = ['fetchingList', 'fetchingDetail', 'fetchingCovers', 'classifying', 'moving'];

/**
 * 整理頁。三種畫面共用同一個外殼（左軌 ／ 中央 ／ 底部作業列）：
 * 準備（選來源與目標）、分類中（進度儀表）、審核與執行（審核表）。
 *
 * 底下那條作業列永遠是同一件事：你正要執行的批次，以及執行它的按鈕；
 * 按鈕變灰時旁邊一定寫得出原因。
 */
export function RunPage({ mid, onOpenFolders }: { mid: number; onOpenFolders: () => void }) {
  const m = useMessages();
  const folders = useAppStore((s) => s.folders);
  const sourceId = useAppStore((s) => s.sourceId);
  const setTargets = useAppStore((s) => s.setTargets);
  const targetIds = useAppStore((s) => s.targetIds);
  const descriptions = useAppStore((s) => s.descriptions);
  const settings = useAppStore((s) => s.settings);
  const runScope = useAppStore((s) => s.runScope);

  const [details, setDetails] = useState(false);
  const [targetQuery, setTargetQuery] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [targetFilter, setTargetFilter] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const job = useJobStore();
  // 清理關注正在跑時，這一頁不能開始也不能寫入（兩種任務一次只跑一個）
  const blocked = otherJobRunning(
    useJobGuard((s) => s.active),
    'organise',
  );

  // 只在首次進入頁面時嘗試還原上次任務（透過 getState 避免把整個 store 物件放進依賴）
  useEffect(() => {
    const store = useJobStore.getState();
    if (store.phase === 'idle') void store.restore();
  }, []);

  const source = folders.find((f) => f.id === sourceId) ?? null;
  const sourceDesc = source ? effectiveDescription(source, descriptions) : '';
  const sourceDescFromBili = !!source && sourceDesc !== '' && (descriptions[String(source.id)] ?? '').trim() === '';
  const targets = folders.filter((f) => targetIds.includes(f.id));
  const busy = BUSY_PHASES.includes(job.phase);
  const wentBackground = useWentBackground(busy);
  const now = useNow(busy);
  const aiReady = planOf(settings).aiReady;
  const canStart = !!source && targets.length > 0 && aiReady && !busy && !blocked;

  const counts = countRows(job.rows);
  const undoRows = job.rows.filter((r) => r.status === 'done' && r.chosen.length > 0);
  const undoable = undoRows.length;
  const undoCopies = undoRows.filter((r) => r.keepSource).length;
  // 待處理的列全是「保留原位」時，那顆批次按鈕要能把它們改回搬走
  const allKeep = counts.move === 0 && counts.copy > 0;
  const invalidCount = job.rows.filter((r) => r.invalid && (r.status === 'pending' || r.status === 'failed')).length;
  const lowConfPending = job.rows.filter((r) => r.lowConfidence && r.status === 'pending' && r.chosen.length === 0).length;
  const moving = job.phase === 'moving';
  const jobTargets = folders.filter((f) => job.targetIds.includes(f.id));
  const jobSource = folders.find((f) => f.id === job.sourceId) ?? null;

  const limit = runScope.mode === 'latest' ? runScope.count : undefined;
  const planned = source ? (limit ? Math.min(limit, source.mediaCount) : source.mediaCount) : 0;
  const estimate = estimateRun(planned, settings);

  // bvid → 那一批的 AI 往返紀錄（審核表的「送了什麼」用）
  const batchOf = useMemo(() => {
    const map = new Map<string, BatchRecord>();
    for (const b of job.batches) for (const bvid of b.bvids) map.set(bvid, b);
    return map;
  }, [job.batches]);

  const shownRows = useMemo(() => filterRows(job.rows, filter, targetFilter), [job.rows, filter, targetFilter]);
  const targetCounts = useMemo(() => countByTarget(job.rows, job.targetIds), [job.rows, job.targetIds]);

  const start = () =>
    void job.start({
      mid,
      source: source!,
      sourceDescription: sourceDesc,
      targets: targets.map((t) => ({ id: t.id, title: t.title, description: effectiveDescription(t, descriptions) })),
      settings,
      ...(limit ? { limit } : {}),
    });

  const reviewing = (job.phase === 'review' || job.phase === 'moving' || job.phase === 'done') && job.rows.length > 0;
  const phaseLabel = phaseLabelOf(m, job.phase);

  // ── 分類中／搬移中 ──────────────────────────────────────────────
  if (busy) {
    return (
      <div className="page">
        <div className="work rail-center">
          <RunningRail phase={job.phase} source={jobSource ?? source} targets={jobTargets.length || targets.length} />
          <ProgressPanel
            phaseLabel={phaseLabel}
            progress={job.progress}
            startedAt={job.startedAt}
            now={now}
            waitNote={job.waitNote}
            background={wentBackground}
            readings={[
              { label: m.progressPanel.cacheHits, value: job.stats.cached },
              { label: m.progressPanel.couldNotFetch, value: job.stats.detailFailed, dimWhenZero: true },
            ]}
            skeleton="cover"
            cached={job.stats.cached}
          />
        </div>
        <ProgressBar phaseLabel={phaseLabel} progress={job.progress} startedAt={job.startedAt} now={now} onCancel={job.cancel} />
      </div>
    );
  }

  // ── 審核與執行 ─────────────────────────────────────────────────
  if (reviewing && !showSetup) {
    return (
      <div className="page">
        <div className="work rail-center">
          <ReviewRail
            sourceTitle={job.sourceTitle}
            sourceFolder={jobSource}
            targets={jobTargets}
            stats={job.stats}
            savedAt={job.savedAt}
            counts={counts}
            targetCounts={targetCounts}
            filter={filter}
            onFilter={setFilter}
            targetFilter={targetFilter}
            onTargetFilter={setTargetFilter}
          />
          <main className="center">
            <div className="c-head">
              <div className="c-title">{m.run.reviewTitle}</div>
              <p className="desc">{m.run.reviewDesc}</p>
            </div>
            <div className="c-body">
              {job.error && (
                <div className="c-pad" style={{ paddingBottom: 0 }}>
                  <div className="banner error">
                    <span className="dot" style={{ background: 'var(--bad)' }} />
                    <span>{job.error}</span>
                  </div>
                </div>
              )}
              {lowConfPending > 0 && job.phase === 'review' && filter !== 'lowConfidence' && (
                <div className="c-pad" style={{ paddingBottom: 0 }}>
                  <div className="banner warn">
                    <span className="dot" style={{ background: 'var(--warn)' }} />
                    <span>{m.run.lowConfidenceBanner(lowConfPending)}</span>
                    <button type="button" className="link spacer" onClick={() => setFilter('lowConfidence')}>
                      {m.run.showJustThese(lowConfPending)}
                    </button>
                  </div>
                </div>
              )}
              <ReviewTable
                rows={shownRows}
                total={job.rows.length}
                targets={jobTargets}
                editable={job.phase === 'review'}
                onChosen={job.setChosen}
                onKeepSource={job.setKeepSource}
                recordOf={(bvid) => batchOf.get(bvid)}
              />
            </div>
          </main>
        </div>

        <footer className="runbar">
          <button
            type="button"
            className="btn primary"
            disabled={job.phase !== 'review' || counts.move + counts.copy === 0 || blocked}
            onClick={() => void job.execute({ mid, batchSize: settings.rate.moveBatchSize })}
          >
            <IconArrowRight size={14} />
            {m.run.executeLabel(counts.move, counts.copy)}
          </button>
          {blocked ? (
            <span className="why">{m.app.busyWithFollows}</span>
          ) : job.phase === 'done' ? (
            <span className="why">{m.run.whyRunFinished}</span>
          ) : job.phase === 'review' && counts.move + counts.copy === 0 ? (
            <span className="why">{m.run.whyNothingToWrite}</span>
          ) : null}
          <span className="sep" />
          <button type="button" className="btn" disabled={job.phase !== 'review'} onClick={() => job.applyAll('suggested')}>
            {m.run.acceptAllSuggestions}
          </button>
          <button type="button" className="btn" disabled={job.phase !== 'review'} onClick={() => job.applyAll('none')}>
            {m.run.moveNoneOf}
          </button>
          <button
            type="button"
            className="btn"
            disabled={job.phase !== 'review'}
            title={m.run.keepInPlaceHint}
            onClick={() => job.applyAll(allKeep ? 'moveOut' : 'keep')}
          >
            {allKeep ? m.run.moveAllInstead : m.run.keepAllInPlace}
          </button>
          {invalidCount > 0 && <span className="sep" />}
          {invalidCount > 0 &&
            (confirmRemove ? (
              <>
                <span className="status-failed small">{m.run.confirmRemoveStale(job.sourceTitle, invalidCount)}</span>
                <button
                  type="button"
                  className="btn danger"
                  disabled={job.phase !== 'review' || blocked}
                  onClick={() => {
                    setConfirmRemove(false);
                    void job.removeInvalid({ batchSize: settings.rate.moveBatchSize });
                  }}
                >
                  {m.run.confirmRemove}
                </button>
                <button type="button" className="btn quiet" onClick={() => setConfirmRemove(false)}>
                  {m.common.cancel}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn danger"
                disabled={job.phase !== 'review' || blocked}
                onClick={() => setConfirmRemove(true)}
              >
                {m.run.removeStale(invalidCount)}
              </button>
            ))}
          {undoable > 0 &&
            !moving &&
            (confirmUndo ? (
              <>
                <span className="status-failed small">{m.run.confirmUndo(undoable, undoCopies, job.sourceTitle)}</span>
                <button
                  type="button"
                  className="btn danger"
                  disabled={blocked}
                  onClick={() => {
                    setConfirmUndo(false);
                    void job.undoMoves({ mid, batchSize: settings.rate.moveBatchSize });
                  }}
                >
                  {m.run.confirmUndoButton}
                </button>
                <button type="button" className="btn quiet" onClick={() => setConfirmUndo(false)}>
                  {m.common.cancel}
                </button>
              </>
            ) : (
              <button type="button" className="btn" onClick={() => setConfirmUndo(true)}>
                {m.run.undoButtonLabel(undoable - undoCopies, undoCopies, undoable)}
              </button>
            ))}
          {counts.failed > 0 && (
            <button type="button" className="btn" onClick={job.retryFailed}>
              {m.run.retryFailed}
            </button>
          )}
          <span className="read-inline">
            <button type="button" className="btn quiet" onClick={() => setShowSetup(true)}>
              {m.run.changeSettingsRerun}
            </button>
            <button type="button" className="btn quiet" onClick={() => void job.discard()}>
              {m.run.clearResults}
            </button>
          </span>
        </footer>
      </div>
    );
  }

  // ── 準備 ───────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="work rail-center-side">
        <SourceRail mid={mid} disabled={busy} />

        <main className="center">
          <div className="c-head">
            <div className="c-title">{m.run.targetFoldersTitle}</div>
            <p className="desc">{m.run.targetFoldersDesc}</p>
          </div>
          <div className="c-tools">
            <label className="search" style={{ width: 210 }}>
              <IconSearch />
              <input
                type="text"
                aria-label={m.run.filterTargetFolders}
                placeholder={m.run.filterTargetsPlaceholder}
                value={targetQuery}
                onChange={(e) => setTargetQuery(e.target.value)}
              />
            </label>
            <span className="mono muted">
              {m.folders.selectedPrefix}
              <b style={{ color: 'var(--ac-2)' }}>{targetIds.length}</b> / {Math.max(0, folders.length - 1)}
              {m.folders.selectedSuffix}
            </span>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void setTargets(folders.filter((f) => f.id !== sourceId).map((f) => f.id))}
            >
              {m.common.selectAll}
            </button>
            <button type="button" className="btn" disabled={busy || targetIds.length === 0} onClick={() => void setTargets([])}>
              {m.common.clear}
            </button>
            <button type="button" className="link spacer" onClick={onOpenFolders}>
              {m.run.editDescriptionsOnFoldersPage}
            </button>
          </div>

          <div className="c-body">
            {reviewing && (
              <div className="c-pad" style={{ paddingBottom: 0 }}>
                <div className="banner">
                  <span className="dot" style={{ background: 'var(--info)' }} />
                  <span>{m.run.previousResultBanner(job.rows.length)}</span>
                  <button type="button" className="link spacer" onClick={() => setShowSetup(false)}>
                    {m.run.backToReview}
                  </button>
                </div>
              </div>
            )}
            {source && (
              <div className="c-pad" style={{ paddingBottom: 0 }}>
                <div className="banner">
                  <FolderCover folder={source} size="sm" />
                  <span>
                    <b>{m.run.whatThisFolderCollects}</b>
                    <span className={sourceDesc ? 'muted' : 'dim'} style={{ marginLeft: 8 }}>
                      {sourceDesc || m.run.noDescriptionAiOnlyName}
                    </span>
                    {sourceDescFromBili && (
                      <span className="tag info" style={{ marginLeft: 8 }}>
                        {m.run.fromBilibiliDescription}
                      </span>
                    )}
                    <span className="desc">{m.run.sourceKnownHint}</span>
                  </span>
                  <button type="button" className="link spacer" onClick={onOpenFolders}>
                    {m.run.editDescription}
                  </button>
                </div>
              </div>
            )}
            <TargetFolderTable query={targetQuery} disabled={busy} onEditDescriptions={onOpenFolders} />
          </div>
        </main>

        <BatchPanel
          source={source}
          targets={targets}
          estimate={estimate}
          planned={planned}
          settings={settings}
          disabled={busy}
          onOpenDetails={() => setDetails(true)}
        />
      </div>

      <footer className="runbar">
        <button type="button" className="btn primary" disabled={!canStart} onClick={start}>
          <IconSparkle />
          {m.run.startClassification}
        </button>
        {canStart ? (
          <span className="row tight">
            {source && <b style={{ fontWeight: 600 }}>{source.title}</b>}
            <IconArrowRight size={14} className="pink-icon" />
            <span className="muted">{m.run.targetCount(targets.length)}</span>
            <span className="dim">·</span>
            <span className="muted">
              {runScope.mode === 'all' ? m.run.scopeAll : m.run.scopeLatest}{' '}
              <span className="num">{planned.toLocaleString('en-US')}</span>
            </span>
          </span>
        ) : (
          <span className="why">
            {blocked
              ? m.app.busyWithFollows
              : !source
                ? m.run.pickSourceFirst
                : !aiReady
                  ? m.run.fillAiEndpointFirst
                  : m.run.noTargetsSelected}
            {!blocked && source && aiReady && targets.length === 0 && (
              <button
                type="button"
                className="link"
                style={{ marginLeft: 6 }}
                onClick={() => void setTargets(folders.filter((f) => f.id !== sourceId).map((f) => f.id))}
              >
                {m.run.selectAllCount(Math.max(0, folders.length - 1))}
              </button>
            )}
          </span>
        )}
        <span className="read-inline">
          <span className="mono">{m.run.footerBili(estimate.biliRequests)}</span>
          <i>/</i>
          <span className="mono">{m.run.footerAi(estimate.aiCalls)}</span>
          <i>/</i>
          <span className="mono">{m.run.footerMinutes(estimate.minutes)}</span>
        </span>
      </footer>

      {details && (
        <RunDetailsDialog estimate={estimate} settings={settings} planned={planned} onClose={() => setDetails(false)} />
      )}
    </div>
  );
}

function phaseLabelOf(m: Messages, phase: string): string {
  if (phase === 'fetchingList') return m.run.phase.fetchingList;
  if (phase === 'fetchingDetail') return m.run.phase.fetchingDetail;
  if (phase === 'fetchingCovers') return m.run.phase.fetchingCovers;
  if (phase === 'classifying') return m.run.phase.classifying;
  if (phase === 'moving') return m.run.phase.moving;
  return phase;
}

/** 分類中的左軌：這次在整理誰，以及走到第幾步 */
function RunningRail({
  phase,
  source,
  targets,
}: {
  phase: JobPhase;
  source: { title: string; cover?: string } | null;
  targets: number;
}) {
  const m = useMessages();
  const settings = useAppStore((s) => s.settings);
  const runScope = useAppStore((s) => s.runScope);
  const steps = planFlow(settings);
  const currentKey = PHASE_STEP[phase] ?? '';
  const currentIndex = steps.findIndex((s) => s.key === currentKey);

  return (
    <aside className="rail">
      <div className="rail-sec">
        <span className="lbl">{m.run.nowOrganising}</span>
        <div className="row tight" style={{ flexWrap: 'nowrap' }}>
          <span className="folder-title">{source?.title ?? '—'}</span>
          <IconArrowRight size={15} className="pink-icon" />
          <span className="folder-title">{m.run.targetCount(targets)}</span>
        </div>
        <p className="desc">{runScope.mode === 'all' ? m.run.allVideos : m.run.latestSaved(runScope.count)}</p>
      </div>
      <div className="rail-sec grow">
        <span className="lbl">{m.run.progress}</span>
        <ol className="flow">
          {steps.map((s, i) => {
            const state = !s.active ? 'off' : i === currentIndex ? 'now' : i < currentIndex ? 'done' : '';
            return (
              <li key={s.key} className={`fstep ${state}`.trim()} title={s.detail}>
                <span className="ficon">
                  {state === 'done' ? <IconCheck /> : state === 'now' ? <span className="spin" /> : <span className="pip" />}
                </span>
                <span className="name">{s.title}</span>
                {!s.active && <span className="tag">{m.flow.skip}</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}

/**
 * 任務期間這個分頁是否被切到背景過。Chrome 會把背景分頁的 timer 鉗制到 1 秒
 * （讀取速率直接減半），所以值得提醒一次；凍結本身已由 jobStore 的 Web Lock 擋掉。
 */
function useWentBackground(active: boolean): boolean {
  const [went, setWent] = useState(false);
  useEffect(() => {
    if (!active) {
      setWent(false);
      return;
    }
    const onChange = () => {
      if (document.visibilityState === 'hidden') setWent(true);
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [active]);
  return went;
}
