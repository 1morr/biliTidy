import { useEffect, useMemo, useState } from 'react';
import type { NavData } from '@/bilibili/http';
import { canSelect } from '@/core/activity';
import { downloadText, exportFilename, toCsv, uidList } from '@/core/exportRows';
import { DEFAULT_FILTER, DEFAULT_SORT, filterRows, sortRows, type ReviewFilter, type SortSpec } from '@/core/followFilter';
import type { FollowPhase } from '@/shared/types';
import { IconCopy, IconDownload, IconSearch, IconUndo, IconUserMinus } from '../components/icons';
import { useMessages } from '../hooks/useI18n';
import { useNow } from '../hooks/useLive';
import { useFollowJobStore } from '../followJobStore';
import { otherJobRunning, useJobGuard } from '../jobGuard';
import { useAppStore } from '../store';
import { FollowPrepareView } from './follows/FollowPrepareView';
import { ProgressBar } from '../components/ProgressPanel';
import { FollowReviewRail } from './follows/FollowReviewRail';
import { FollowReviewTable } from './follows/FollowReviewTable';
import { FollowRunningView } from './follows/FollowRunningView';

const READ_PHASES: FollowPhase[] = ['fetchingFollows', 'checking'];
const WRITE_PHASES: FollowPhase[] = ['unfollowing', 'restoring'];

/**
 * 清理頁。三種畫面共用同一個外殼（左軌 ／ 中央 ／ 底部作業列）：
 * 準備（帳號摘要與這次會做什麼）、執行中（進度儀表）、審核（門檻＋分面＋表格）。
 *
 * 底下那條作業列永遠是同一件事：你正要執行的批次，以及執行它的按鈕；按鈕變灰時旁邊寫得出原因。
 */
export function FollowsPage({ nav }: { nav: NavData }) {
  const m = useMessages();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const job = useFollowJobStore();
  // 整理收藏正在跑時，這一頁不能開始也不能寫入（兩種任務一次只跑一個）
  const blocked = otherJobRunning(
    useJobGuard((s) => s.active),
    'follows',
  );
  const [filter, setFilter] = useState<ReviewFilter>(DEFAULT_FILTER);
  const [sort, setSort] = useState<SortSpec>(DEFAULT_SORT);
  const [showSetup, setShowSetup] = useState(false);
  const [confirmUnfollow, setConfirmUnfollow] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [copied, setCopied] = useState(false);
  const reading = READ_PHASES.includes(job.phase);
  const writing = WRITE_PHASES.includes(job.phase);
  // 天數每分鐘重算一次就夠；任務跑的時候作業列的計時器另外每秒走
  const now = useNow(true, 60_000);
  const tick = useNow(writing);

  // 只在首次進入頁面時嘗試還原上次的結果（透過 getState 避免把整個 store 放進依賴）
  useEffect(() => {
    const store = useFollowJobStore.getState();
    if (store.phase === 'idle') void store.restoreSnapshot();
  }, []);

  const tagNameOf = useMemo(() => {
    const map = new Map(job.tags.map((t) => [t.id, t.name]));
    return (id: number) => map.get(id);
  }, [job.tags]);

  const threshold = settings.follows.thresholdDays;
  const shown = useMemo(
    () => sortRows(filterRows(job.rows, filter, threshold, now), sort, tagNameOf, now),
    [job.rows, filter, threshold, now, sort, tagNameOf],
  );
  const selectedRows = useMemo(() => job.rows.filter((r) => job.selected.has(r.entry.mid)), [job.rows, job.selected]);
  const selectable = shown.filter(canSelect);
  const allShownSelected = selectable.length > 0 && selectable.every((r) => job.selected.has(r.entry.mid));
  const doneCount = job.rows.filter((r) => r.status === 'done').length;
  const failedCount = job.rows.filter((r) => r.status === 'failed' || r.status === 'restoreFailed').length;
  const n = selectedRows.length;
  const hasResults = job.rows.length > 0;

  const setThreshold = (days: number) => void updateSettings((s) => ({ ...s, follows: { ...s.follows, thresholdDays: days } }));

  const copyUids = async () => {
    try {
      await navigator.clipboard.writeText(uidList(selectedRows));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 沒有剪貼簿權限就退回下載
      downloadText(exportFilename('uids'), uidList(selectedRows));
    }
  };
  const downloadCsv = () =>
    downloadText(
      exportFilename('csv'),
      toCsv(selectedRows, tagNameOf, { headers: m.follows.csv.headers, noVideos: m.follows.table.noVideos }, now),
      'text/csv;charset=utf-8',
    );

  // ── 執行中（讀關注、查活躍） ───────────────────────────────────
  if (reading) return <FollowRunningView />;

  // ── 準備 ───────────────────────────────────────────────────────
  if (!hasResults || showSetup) {
    return (
      <FollowPrepareView
        nav={nav}
        hasResults={hasResults}
        onBackToReview={() => setShowSetup(false)}
        onStart={() => {
          setShowSetup(false);
          setFilter(DEFAULT_FILTER);
          setSort(DEFAULT_SORT);
        }}
      />
    );
  }

  // ── 審核與執行 ─────────────────────────────────────────────────
  const remainingUnchecked = job.rows.filter((r) => r.status === 'pending' && r.activity === undefined).length;
  // 停下的句子在這裡才組：快照裡只有原因與數字，切換語言後橫幅跟著換
  const stoppedText = job.stopped
    ? job.stopped.reason === 'cancelled'
      ? m.follows.job.stoppedCancelled(job.stopped.remaining)
      : job.stopped.reason === 'auth'
        ? m.follows.job.stoppedAuth(job.stopped.remaining, m.errors.bilibili.notSignedIn)
        : m.follows.job.stoppedRisk(job.stopped.remaining, job.stopped.detail)
    : null;
  return (
    <div className="page">
      <div className="work rail-center">
        <FollowReviewRail
          rows={job.rows}
          tags={job.tags}
          thresholdDays={threshold}
          onThreshold={setThreshold}
          filter={filter}
          onFilter={setFilter}
          stats={job.stats}
          fetchedAt={job.fetchedAt}
          reported={job.reported}
          savedAt={job.savedAt}
          now={now}
        />
        <main className="center">
          <div className="c-head">
            <div className="c-title">{m.follows.review.title}</div>
            <p className="desc">{m.follows.review.desc}</p>
          </div>
          <div className="c-tools">
            <label className="search" style={{ width: 220 }}>
              <IconSearch />
              <input
                type="search"
                aria-label={m.follows.review.searchLabel}
                placeholder={m.follows.review.searchPlaceholder}
                value={filter.query}
                onChange={(e) => setFilter({ ...filter, query: e.target.value })}
              />
            </label>
            <span className="dim small num">{m.follows.review.shown(shown.length, job.rows.length)}</span>
            <button
              type="button"
              className="btn"
              disabled={writing || selectable.length === 0}
              onClick={() =>
                job.setSelected(
                  selectable.map((r) => r.entry.mid),
                  !allShownSelected,
                )
              }
            >
              {allShownSelected
                ? m.follows.review.deselectShown(selectable.length)
                : m.follows.review.selectShown(selectable.length)}
            </button>
            {n > 0 && (
              <button type="button" className="btn quiet" disabled={writing} onClick={job.clearSelection}>
                {m.follows.review.clearSelection(n)}
              </button>
            )}
          </div>
          <div className="c-body">
            {(job.stopped || job.error) && (
              <div className="c-pad" style={{ paddingBottom: 0 }}>
                {job.stopped && (
                  <div className={job.stopped.reason === 'auth' ? 'banner error' : 'banner warn'}>
                    <span className="dot" style={{ background: job.stopped.reason === 'auth' ? 'var(--bad)' : 'var(--warn)' }} />
                    <span>{stoppedText}</span>
                    {remainingUnchecked > 0 && (
                      <button
                        type="button"
                        className="link spacer"
                        disabled={writing || blocked}
                        onClick={() => void job.start({ mid: nav.mid, settings, mode: 'missing' })}
                      >
                        {m.follows.review.checkRemaining(remainingUnchecked)}
                      </button>
                    )}
                  </div>
                )}
                {job.error && (
                  <div className="banner error">
                    <span className="dot" style={{ background: 'var(--bad)' }} />
                    <span>{job.error}</span>
                  </div>
                )}
              </div>
            )}
            <FollowReviewTable
              rows={shown}
              total={job.rows.length}
              filter={filter}
              selected={job.selected}
              onToggle={job.toggle}
              tagNameOf={tagNameOf}
              thresholdDays={threshold}
              now={now}
              sort={sort}
              onSort={setSort}
              locked={writing}
            />
          </div>
        </main>
      </div>

      {writing ? (
        <ProgressBar
          phaseLabel={job.phase === 'unfollowing' ? m.follows.phase.unfollowing : m.follows.phase.restoring}
          progress={job.progress}
          waitNote={job.waitNote}
          startedAt={job.startedAt}
          now={tick}
          onCancel={job.cancel}
        />
      ) : (
        <footer className="runbar">
          {confirmUnfollow ? (
            <>
              <span className="status-failed small">{m.follows.runbar.confirmUnfollowText(n)}</span>
              <button
                type="button"
                className="btn danger solid"
                onClick={() => {
                  setConfirmUnfollow(false);
                  void job.unfollow();
                }}
              >
                <IconUserMinus />
                {m.follows.runbar.confirmUnfollow(n)}
              </button>
              <button type="button" className="btn quiet" onClick={() => setConfirmUnfollow(false)}>
                {m.common.cancel}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn primary"
                disabled={n === 0 || blocked}
                onClick={() => setConfirmUnfollow(true)}
              >
                <IconUserMinus />
                {m.follows.runbar.unfollow(n)}
              </button>
              {(blocked || n === 0) && (
                <span className="why">{blocked ? m.app.busyWithOrganise : m.follows.runbar.whyNoSelection}</span>
              )}
            </>
          )}
          <span className="sep" />
          <button
            type="button"
            className="btn"
            disabled={n === 0}
            title={m.follows.runbar.copyUidsHint}
            onClick={() => void copyUids()}
          >
            <IconCopy />
            {copied ? m.follows.runbar.copied : m.follows.runbar.copyUids(n)}
          </button>
          <button type="button" className="btn" disabled={n === 0} title={m.follows.runbar.downloadCsvHint} onClick={downloadCsv}>
            <IconDownload />
            {m.follows.runbar.downloadCsv(n)}
          </button>
          {doneCount > 0 && <span className="sep" />}
          {doneCount > 0 &&
            (confirmUndo ? (
              <>
                <span className="status-failed small">{m.follows.runbar.confirmUndoText(doneCount)}</span>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => {
                    setConfirmUndo(false);
                    void job.restore();
                  }}
                >
                  {m.follows.runbar.confirmUndo}
                </button>
                <button type="button" className="btn quiet" onClick={() => setConfirmUndo(false)}>
                  {m.common.cancel}
                </button>
              </>
            ) : (
              <button type="button" className="btn" disabled={blocked} onClick={() => setConfirmUndo(true)}>
                <IconUndo />
                {m.follows.runbar.undo(doneCount)}
              </button>
            ))}
          {failedCount > 0 && (
            <button type="button" className="btn" onClick={job.retryFailed}>
              {m.follows.runbar.retryFailed(failedCount)}
            </button>
          )}
          <span className="read-inline">
            <button type="button" className="btn quiet" onClick={() => setShowSetup(true)}>
              {m.follows.runbar.rerun}
            </button>
            <button type="button" className="btn quiet" onClick={() => void job.discard()}>
              {m.follows.runbar.clearResults}
            </button>
          </span>
        </footer>
      )}
    </div>
  );
}
