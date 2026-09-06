import { useEffect, useState } from 'react';
import { isInactive } from '@/core/activity';
import { IconCheck } from '../../components/icons';
import { fmtInt } from '../../format';
import { useMessages } from '../../hooks/useI18n';
import { useNow } from '../../hooks/useLive';
import { useFollowJobStore } from '../../followJobStore';
import { useAppStore } from '../../store';
import { ProgressBar, ProgressPanel } from '../../components/ProgressPanel';

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

/**
 * 讀關注清單／查活躍度時的畫面：左軌是走到第幾步與目前為止的結論，中央是儀表與最近的請求。
 * 「查到第幾個」只寫在儀表與作業列兩處；左軌講的是結論（安靜幾個、查不到幾個），不重複計數。
 */
export function FollowRunningView() {
  const m = useMessages();
  const job = useFollowJobStore();
  const threshold = useAppStore((s) => s.settings.follows.thresholdDays);
  const now = useNow(true);
  const wentBackground = useWentBackground(true);
  const checking = job.phase === 'checking';
  const phaseLabel = checking ? m.follows.phase.checking : m.follows.phase.fetchingFollows;

  let inactive = 0;
  let unknown = 0;
  for (const r of job.rows) {
    if (!r.activity) continue;
    if (r.activity.status === 'unknown') unknown++;
    else if (isInactive(r.activity, threshold, now)) inactive++;
  }

  const steps: { key: string; label: string; state: 'done' | 'now' | 'off' }[] = [
    { key: 'read', label: m.follows.running.step.read, state: checking ? 'done' : 'now' },
    { key: 'check', label: m.follows.running.step.check, state: checking ? 'now' : 'off' },
    { key: 'review', label: m.follows.running.step.review, state: 'off' },
  ];

  return (
    <div className="page">
      <div className="work rail-center">
        <aside className="rail">
          <div className="rail-sec">
            <span className="lbl">{m.follows.running.nowRunning}</span>
            <ol className="flow">
              {steps.map((s) => (
                <li key={s.key} className={`fstep ${s.state}`}>
                  <span className="ficon">
                    {s.state === 'done' ? (
                      <IconCheck />
                    ) : s.state === 'now' ? (
                      <span className="spin" />
                    ) : (
                      <span className="pip" />
                    )}
                  </span>
                  <span className="name">{s.label}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rail-sec">
            <span className="lbl">{m.follows.running.soFar}</span>
            <div className="stat-grid" style={{ marginTop: 0 }}>
              <span className="read-row">
                <span>{m.follows.running.followsRead}</span>
                <b className="mono">{fmtInt(job.rows.length)}</b>
              </span>
              <span className={inactive > 0 ? 'read-row' : 'read-row zero'}>
                <span>{m.follows.running.inactiveSoFar(threshold)}</span>
                <b className="mono">{fmtInt(inactive)}</b>
              </span>
              <span className={unknown > 0 ? 'read-row' : 'read-row zero'}>
                <span>{m.follows.running.unknownSoFar}</span>
                <b className="mono">{fmtInt(unknown)}</b>
              </span>
            </div>
          </div>
        </aside>
        <ProgressPanel
          phaseLabel={phaseLabel}
          progress={job.progress}
          startedAt={job.startedAt}
          now={now}
          waitNote={job.waitNote}
          background={wentBackground}
          readings={[
            { label: m.progressPanel.cacheHits, value: job.stats.cached },
            { label: m.follows.running.couldNotCheck, value: unknown, dimWhenZero: true },
          ]}
          skeleton="avatar"
        />
      </div>
      <ProgressBar
        phaseLabel={phaseLabel}
        progress={job.progress}
        waitNote={null}
        startedAt={job.startedAt}
        now={now}
        onCancel={job.cancel}
      />
    </div>
  );
}
