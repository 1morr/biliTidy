import { localeTag } from '@/i18n';
import type { Progress } from '@/shared/types';
import { IconInfo } from './icons';
import { useMessages } from '../hooks/useI18n';
import { clock, useActivity } from '../hooks/useLive';

/** 樣本太少時的速率與剩餘時間只是雜訊，先不顯示 */
const MIN_SAMPLES = 3;

function rateOf(progress: Progress | null, startedAt: number | null, now: number) {
  const elapsedSec = startedAt === null ? 0 : Math.max(0, (now - startedAt) / 1000);
  const done = progress?.done ?? 0;
  const total = progress?.total ?? 0;
  const rate = done >= MIN_SAMPLES && elapsedSec > 0 ? done / elapsedSec : null;
  const remainSec = rate !== null && total > done ? (total - done) / rate : null;
  return { elapsedSec, done, total, rate, remainSec };
}

/** 儀表右側的兩個任務專屬讀數（整理收藏：快取命中／抓不到詳情；清理關注：快取命中／查不到） */
export interface GaugeReading {
  label: string;
  value: number;
  /** 0 的時候壓淡：它是「沒發生」而不是一個數字 */
  dimWhenZero?: boolean;
}

/**
 * 任務進行中的中央畫面，整理收藏與清理關注共用：一支跑十幾分鐘的任務只有一條細進度條
 * 看不出它是還在跑、卡住、還是被風控擋著，這裡把階段與統計攤成儀表，再配上最近幾筆請求。
 * 停止的控制只有一個，在底部作業列（作業列永遠是「這一批＋執行它的按鈕」）。
 * 下方骨架預示審核表的形狀：影片列（封面）或帳號列（頭像）。
 */
export function ProgressPanel({
  phaseLabel,
  progress,
  startedAt,
  now,
  waitNote,
  background,
  readings,
  skeleton,
  cached = 0,
}: {
  phaseLabel: string;
  progress: Progress | null;
  startedAt: number | null;
  now: number;
  waitNote: string | null;
  background: boolean;
  readings: GaugeReading[];
  skeleton: 'cover' | 'avatar';
  /** 這一輪直接用快取答掉的筆數：進度軌上畫成「已緩衝」的灰段，真的打了請求的才是粉色 */
  cached?: number;
}) {
  const m = useMessages();
  const log = useActivity();
  const { elapsedSec, done, total, rate, remainSec } = rateOf(progress, startedAt, now);
  const ratio = total > 0 ? done / total : 0;
  const fetchedRatio = total > 0 ? Math.max(0, done - cached) / total : 0;

  return (
    <main className="center">
      <div className="gauge">
        <div className="gauge-top">
          <span className="gauge-phase">{phaseLabel}</span>
          {progress && <span className="dim small ellipsis">{progress.label}</span>}
          {total > 0 && (
            <span className="gauge-count mono">
              {done} <small>/ {total}</small>
            </span>
          )}
        </div>
        <div className="progress">
          <div className="buf" style={{ transform: `scaleX(${ratio})` }} />
          <div style={{ transform: `scaleX(${fetchedRatio})` }} />
        </div>
        {cached > 0 && total > 0 && (
          <div className="gauge-legend">
            <span>
              <i style={{ background: 'var(--ac)' }} />
              {m.progressPanel.legendFetched}
            </span>
            <span>
              <i style={{ background: 'var(--buffered)' }} />
              {m.progressPanel.legendCached}
            </span>
          </div>
        )}
        <div className="gauge-read">
          <span className="gauge-item">
            <span>{m.progressPanel.used}</span>
            <b className="mono">{clock(elapsedSec)}</b>
          </span>
          <span className="gauge-item">
            <span>{m.progressPanel.estRemaining}</span>
            <b className="mono">{remainSec === null ? '—' : clock(remainSec)}</b>
          </span>
          <span className="gauge-item">
            <span>{m.progressPanel.actualRate}</span>
            <b className="mono">{rate === null ? '—' : `${rate.toFixed(1)} /s`}</b>
          </span>
          {readings.map((r) => (
            <span key={r.label} className="gauge-item">
              <span>{r.label}</span>
              <b className={r.dimWhenZero && r.value === 0 ? 'mono dim' : 'mono'}>{r.value}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="c-body c-pad">
        {waitNote && (
          <div className="banner warn">
            <span className="dot" style={{ background: 'var(--warn)' }} />
            <span>{waitNote}</span>
          </div>
        )}
        {background && (
          <div className="banner info">
            <IconInfo />
            <span>{m.progressPanel.backgroundTabWarning}</span>
          </div>
        )}

        <div className="log">
          <div className="log-head">
            <span className="lbl">{m.progressPanel.recentRequests}</span>
          </div>
          {log.length === 0 ? (
            <div className="log-empty">{m.progressPanel.noRequestsYet}</div>
          ) : (
            log.slice(0, 8).map((e) => (
              <div key={e.id} className="log-row">
                <span className="tm">{new Date(e.at).toLocaleTimeString(localeTag(), { hour12: false })}</span>
                <span className="ep">{e.endpoint}</span>
                <span className="arg">{e.detail ?? ''}</span>
                <span className={`rs ${e.kind}`}>{e.result}</span>
              </div>
            ))
          )}
        </div>

        <div className="row" style={{ margin: '18px 0 10px' }}>
          <span className="lbl">{m.progressPanel.reviewTable}</span>
          <span className="dim small">{m.progressPanel.reviewTableAppearsHere}</span>
        </div>
        {[0.9, 0.7, 0.45, 0.25, 0.12].map((opacity, i) =>
          skeleton === 'cover' ? (
            <div key={opacity} className="skel-row" style={{ opacity }}>
              <span className="skel-cover" />
              <span className="skel-lines">
                <span className="skel" style={{ width: `${40 + ((i * 7) % 25)}%` }} />
                <span className="skel faint" style={{ width: `${20 + ((i * 5) % 12)}%` }} />
              </span>
              <span className="skel faint" style={{ width: 110 }} />
              <span className="skel faint" style={{ width: 170 }} />
            </div>
          ) : (
            <div key={opacity} className="skel-row compact" style={{ opacity }}>
              <span className="skel-avatar" />
              <span className="skel-lines">
                <span className="skel" style={{ width: `${30 + ((i * 7) % 25)}%` }} />
                <span className="skel faint" style={{ width: `${14 + ((i * 5) % 12)}%` }} />
              </span>
              <span className="skel faint" style={{ width: 120 }} />
              <span className="skel faint" style={{ width: 220 }} />
              <span className="skel" style={{ width: 48 }} />
            </div>
          ),
        )}
      </div>
    </main>
  );
}

/** 讀取與寫入共用的底部作業列：這一批走到哪、還要多久、唯一的停止鈕 */
export function ProgressBar({
  phaseLabel,
  progress,
  waitNote = null,
  startedAt,
  now,
  onCancel,
}: {
  phaseLabel: string;
  progress: Progress | null;
  waitNote?: string | null;
  startedAt: number | null;
  now: number;
  onCancel: () => void;
}) {
  const m = useMessages();
  const { elapsedSec, done, total, remainSec } = rateOf(progress, startedAt, now);
  return (
    <footer className="runbar">
      <span className="row tight" style={{ flexWrap: 'nowrap', flex: 'none' }}>
        <span className="spin" />
        <b style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{phaseLabel}</b>
        {total > 0 && (
          <span className="mono muted" style={{ whiteSpace: 'nowrap' }}>
            {done} / {total}
          </span>
        )}
        {remainSec !== null && (
          <span className="dim" style={{ whiteSpace: 'nowrap' }}>
            {m.progressPanel.estRemainingShort(clock(remainSec))}
          </span>
        )}
        {waitNote && <span className="status-failed small ellipsis">{waitNote}</span>}
      </span>
      <span className="read-inline">
        <span className="mono">
          {m.progressPanel.used} {clock(elapsedSec)}
        </span>
        <button type="button" className="btn" onClick={onCancel}>
          {m.progressPanel.cancelThisRun}
        </button>
      </span>
    </footer>
  );
}
