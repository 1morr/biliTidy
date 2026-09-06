import type { Estimate } from '@/core/estimate';
import { planFlow } from '@/core/flow';
import type { FolderMeta, Settings } from '@/shared/types';
import { FolderCover } from '../../components/FolderCover';
import { IconArrowRight, IconDoc } from '../../components/icons';
import { useMessages } from '../../hooks/useI18n';
import { useAppStore } from '../../store';

/** 側欄的目標膠囊最多列這麼多個，其餘收成「+N」 */
const CHIP_LIMIT = 4;

/**
 * 右欄「這一批」：來源 → 目標、整理範圍、這次會花掉多少、會走哪幾步。
 * 這些數字原本散在整理頁的第 3 段裡（要捲兩屏才看得到），現在跟選擇並排，
 * 勾一個目標、改一次範圍就立刻反映在同一個視野裡。
 */
export function BatchPanel({
  source,
  targets,
  estimate,
  planned,
  settings,
  disabled,
  onOpenDetails,
}: {
  source: FolderMeta | null;
  targets: FolderMeta[];
  estimate: Estimate;
  planned: number;
  settings: Settings;
  disabled: boolean;
  onOpenDetails: () => void;
}) {
  const m = useMessages();
  const runScope = useAppStore((s) => s.runScope);
  const setRunScope = useAppStore((s) => s.setRunScope);
  const steps = planFlow(settings);

  return (
    <aside className="side">
      <div className="side-sec">
        <span className="lbl">{m.batchPanel.thisRun}</span>
        {source ? (
          <>
            <div className="row tight" style={{ flexWrap: 'nowrap' }}>
              <FolderCover folder={source} size="sm" />
              <span className="folder-title">{source.title}</span>
              <IconArrowRight size={15} className="pink-icon" />
              <span className="folder-title">{m.common.folderCount(targets.length)}</span>
            </div>
            {targets.length > 0 && (
              <div className="chips" style={{ marginTop: 10 }}>
                {targets.slice(0, CHIP_LIMIT).map((t) => (
                  <span key={t.id} className="chip on">
                    {t.title}
                  </span>
                ))}
                {targets.length > CHIP_LIMIT && <span className="chip ghost">+{targets.length - CHIP_LIMIT}</span>}
              </div>
            )}
          </>
        ) : (
          <p className="desc" style={{ margin: 0 }}>
            {m.batchPanel.pickSourceFirst}
          </p>
        )}
      </div>

      <div className="side-sec">
        <span className="lbl">{m.batchPanel.scope}</span>
        <label className={runScope.mode === 'all' ? 'check on' : 'check'}>
          <input
            type="radio"
            name="scope"
            aria-label={m.batchPanel.scopeAllOption(source?.mediaCount ?? 0)}
            checked={runScope.mode === 'all'}
            disabled={disabled}
            onChange={() => void setRunScope({ ...runScope, mode: 'all' })}
          />
          {m.batchPanel.scopeAllOption(source?.mediaCount ?? 0)}
        </label>
        <label className={runScope.mode === 'latest' ? 'check on' : 'check'} style={{ marginTop: 6 }}>
          <input
            type="radio"
            name="scope"
            aria-label={m.batchPanel.scopeLatestOption}
            checked={runScope.mode === 'latest'}
            disabled={disabled}
            onChange={() => void setRunScope({ ...runScope, mode: 'latest' })}
          />
          {m.batchPanel.scopeLatestOption}
          <input
            type="number"
            aria-label={m.batchPanel.scopeLatestCountLabel}
            min={1}
            max={10000}
            step={10}
            style={{ width: 76, height: 26 }}
            value={runScope.count}
            disabled={disabled || runScope.mode !== 'latest'}
            onChange={(e) => void setRunScope({ mode: 'latest', count: Math.max(1, Number(e.target.value) || 1) })}
          />
          {m.batchPanel.scopeLatestUnit}
        </label>
        <p className="desc">{m.batchPanel.scopeHint}</p>
      </div>

      <div className="side-sec">
        <span className="lbl">{m.batchPanel.thisWillCost}</span>
        <div className="read">
          <div className="read-row">
            <span>{m.batchPanel.videosToProcess}</span>
            <span>
              <b>{m.run.videosUnit(planned)}</b>
            </span>
          </div>
          <div className="read-row">
            <span>{m.batchPanel.bilibiliReads}</span>
            <span>
              <b>{estimate.biliRequests}</b>
            </span>
          </div>
          <div className={estimate.cdnRequests === 0 ? 'read-row zero' : 'read-row'}>
            <span>{m.batchPanel.coverDownloads}</span>
            <span>
              <b>{estimate.cdnRequests}</b>
            </span>
          </div>
          <div className="read-row">
            <span>{m.batchPanel.aiCalls}</span>
            <span>
              <b>{estimate.aiCalls}</b>
            </span>
          </div>
          <div className="read-row">
            <span>{m.batchPanel.estimatedTime}</span>
            <span>
              <b>≈{estimate.minutes}</b>
            </span>
          </div>
        </div>
        <p className="desc">{m.batchPanel.costHint(settings.rate.readRps)}</p>
        <button type="button" className="btn" style={{ marginTop: 10 }} onClick={onOpenDetails}>
          <IconDoc />
          {m.batchPanel.requestDetailsAndPrompt}
        </button>
      </div>

      <div className="side-sec">
        <span className="lbl">{m.batchPanel.stepsThisRunTakes}</span>
        <ol className="flow">
          {steps.map((s, i) => (
            <li key={s.key} className={s.active ? 'fstep' : 'fstep off'} title={s.detail}>
              <span className="fnum">{i + 1}</span>
              <span className="name">{s.title}</span>
              {!s.active && <span className="tag">{m.flow.skip}</span>}
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
