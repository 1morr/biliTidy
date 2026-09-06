import { useEffect, useState } from 'react';
import type { NavData } from '@/bilibili/http';
import { fetchRelationStat } from '@/bilibili/relation';
import { activityStats } from '@/core/cache';
import { estimateReadRequests, estimateSeconds, roundMinutes } from '@/core/followEstimate';
import { readThrottle } from '@/core/scheduler';
import { ACTIVITY_TTL_DAYS } from '@/core/settings';
import { toAppError } from '@/shared/result';
import { Avatar } from '../../components/Avatar';
import { ModeField } from '../../components/fields';
import { IconPlay } from '../../components/icons';
import { fmtDate, fmtDateTime, fmtInt } from '../../format';
import { useMessages } from '../../hooks/useI18n';
import { useFollowJobStore } from '../../followJobStore';
import { otherJobRunning, useJobGuard } from '../../jobGuard';
import { useAppStore } from '../../store';

type StatState =
  { status: 'loading' } | { status: 'ready'; following: number; whisper: number } | { status: 'error'; message: string };

/** 關注數／悄悄關注數：一支 `relation/stat`，讓準備畫面在按下去之前就寫得出「這次會查幾個」 */
function useRelationStat(mid: number): StatState {
  const [state, setState] = useState<StatState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    readThrottle
      .acquire()
      .then(() => fetchRelationStat(mid))
      .then((s) => alive && setState({ status: 'ready', ...s }))
      .catch((e: unknown) => alive && setState({ status: 'error', message: toAppError(e).message }));
    return () => {
      alive = false;
    };
  }, [mid]);
  return state;
}

function useActivityCache(): { count: number; oldestAt: number | null } | null {
  const [stats, setStats] = useState<{ count: number; oldestAt: number | null } | null>(null);
  useEffect(() => {
    activityStats()
      .then(setStats)
      .catch(() => setStats({ count: 0, oldestAt: null }));
  }, []);
  return stats;
}

/**
 * 準備畫面：這次會做什麼、要花多久、上次的結果還在不在。
 * 只有一顆主按鈕；按下去之前不會發任何會改變帳號的請求（stat 與 nav 都是讀取）。
 */
export function FollowPrepareView({
  nav,
  hasResults,
  onBackToReview,
  onStart,
}: {
  nav: NavData;
  hasResults: boolean;
  onBackToReview: () => void;
  /** 按下開始的瞬間通知父層：從「再查一次」進來的 showSetup 旗標要清掉，跑完才會落到審核表而不是又回到這裡 */
  onStart: () => void;
}) {
  const m = useMessages();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const job = useFollowJobStore();
  const blocked = otherJobRunning(
    useJobGuard((s) => s.active),
    'follows',
  );
  const [mode, setMode] = useState<'missing' | 'all'>('missing');
  const stat = useRelationStat(nav.mid);
  const cache = useActivityCache();

  const follows = stat.status === 'ready' ? stat.following + (settings.follows.includeWhispers ? stat.whisper : 0) : null;
  const toCheck = follows === null ? null : mode === 'all' ? follows : Math.max(0, follows - (cache?.count ?? 0));
  const requests = follows === null || toCheck === null ? null : estimateReadRequests(follows, toCheck);
  const minutes =
    follows === null || toCheck === null ? null : roundMinutes(estimateSeconds(follows, toCheck, settings.rate.readRps));

  return (
    <div className="page">
      <div className="work rail-center">
        <aside className="rail">
          <div className="rail-sec">
            <span className="lbl">{m.follows.prepare.account}</span>
            <div className="who">
              <Avatar face={nav.face} size="lg" />
              <div style={{ minWidth: 0 }}>
                <div className="name">{nav.uname}</div>
                <div className="sub">
                  {stat.status === 'ready'
                    ? m.follows.prepare.whoFollows(stat.following, stat.whisper)
                    : stat.status === 'error'
                      ? stat.message
                      : m.follows.prepare.statLoading}
                </div>
              </div>
            </div>
          </div>
          <div className="rail-sec">
            <span className="lbl">{m.follows.prepare.cacheTitle}</span>
            <p className="desc" style={{ marginTop: 0 }}>
              {cache === null
                ? m.speedData.calculating
                : cache.count === 0
                  ? m.follows.prepare.cacheEmpty
                  : m.follows.prepare.cacheSummary(cache.count, cache.oldestAt ? fmtDate(cache.oldestAt / 1000) : '—')}
            </p>
          </div>
          {hasResults && (
            <div className="rail-sec">
              <span className="lbl">{m.follows.prepare.lastResults}</span>
              <p className="desc" style={{ marginTop: 0 }}>
                {m.follows.prepare.lastResultsSummary(job.rows.length, job.fetchedAt ? fmtDateTime(job.fetchedAt) : '—')}
              </p>
              <button type="button" className="link small" style={{ marginTop: 6 }} onClick={onBackToReview}>
                {m.follows.prepare.backToReview}
              </button>
            </div>
          )}
          <div className="rail-foot" style={{ display: 'block', lineHeight: 1.6 }}>
            {m.follows.prepare.privacyNote}
          </div>
        </aside>

        <main className="center">
          <div className="c-head">
            <div className="c-title">{m.follows.prepare.title}</div>
            <p className="desc">{m.follows.prepare.desc}</p>
          </div>
          <div className="c-body c-pad settings-form">
            {job.phase === 'error' && job.error && (
              <div className="banner error">
                <span className="dot" style={{ background: 'var(--bad)' }} />
                <span>{job.error}</span>
              </div>
            )}
            <ol className="steps">
              <li className="step">
                <span className="k">1</span>
                <div>
                  <div className="t">{m.follows.prepare.steps.read.title}</div>
                  <span className="desc">{m.follows.prepare.steps.read.desc}</span>
                </div>
                <span className="m">{follows === null ? '—' : m.follows.prepare.steps.read.meter(follows)}</span>
              </li>
              <li className="step">
                <span className="k">2</span>
                <div>
                  <div className="t">{m.follows.prepare.steps.check.title}</div>
                  <span className="desc">{m.follows.prepare.steps.check.desc(ACTIVITY_TTL_DAYS)}</span>
                </div>
                <span className="m">{toCheck === null ? '—' : m.follows.prepare.steps.check.meter(toCheck)}</span>
              </li>
              <li className="step">
                <span className="k">3</span>
                <div>
                  <div className="t">{m.follows.prepare.steps.review.title}</div>
                  <span className="desc">{m.follows.prepare.steps.review.desc}</span>
                </div>
                <span className="m dim">{m.follows.prepare.steps.review.meter}</span>
              </li>
            </ol>
            <div className="divider" />
            <ModeField
              label={m.follows.prepare.modeLabel}
              name="checkMode"
              options={[
                {
                  value: 'missing',
                  title: m.follows.prepare.modeMissing,
                  note: m.follows.prepare.modeMissingNote(ACTIVITY_TTL_DAYS),
                },
                { value: 'all', title: m.follows.prepare.modeAll, note: m.follows.prepare.modeAllNote },
              ]}
              value={mode}
              onChange={setMode}
            />
            <div className="field">
              <label className="check">
                <input
                  type="checkbox"
                  className="switch"
                  checked={settings.follows.includeWhispers}
                  onChange={(e) =>
                    void updateSettings((s) => ({ ...s, follows: { ...s.follows, includeWhispers: e.target.checked } }))
                  }
                />
                {m.follows.prepare.whispersLabel}
                <span className="hint inline">{m.follows.prepare.whispersNote}</span>
              </label>
            </div>
          </div>
        </main>
      </div>

      <footer className="runbar">
        <button
          type="button"
          className="btn primary"
          disabled={blocked}
          onClick={() => {
            onStart();
            void job.start({ mid: nav.mid, settings, mode });
          }}
        >
          <IconPlay />
          {toCheck === null ? m.follows.prepare.startShort : m.follows.prepare.start(toCheck)}
        </button>
        <span className="why">{blocked ? m.app.busyWithOrganise : m.follows.prepare.startHint}</span>
        <span className="read-inline">
          {requests !== null && minutes !== null && (
            <>
              <span className="mono">{m.follows.prepare.estRequests(fmtInt(requests))}</span>
              <i>/</i>
              <span className="mono">{m.follows.prepare.estMinutes(minutes)}</span>
            </>
          )}
        </span>
      </footer>
    </div>
  );
}
