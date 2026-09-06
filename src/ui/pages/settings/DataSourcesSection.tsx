import { estimateRun } from '@/core/estimate';
import { planOf } from '@/core/plan';
import { buildPromptPreview } from '@/core/promptPreview';
import { DETAIL_TTL_DAYS } from '@/core/settings';
import type { Settings } from '@/shared/types';
import { IconDoc } from '../../components/icons';
import { RequestTable } from '../../components/RequestTable';
import { useMessages } from '../../hooks/useI18n';

/** 設定頁用固定的影片數當基準，讓不同選項之間可以直接比較 */
const REFERENCE_VIDEOS = 100;

/** 左欄那塊 prompt 預覽只放開頭幾行，完整版在對話框裡 */
const PREVIEW_LINES = 16;

/**
 * 2 要給 AI 看什麼：三個資料來源開關（左）、成本讀數與請求明細（右），
 * 底下是這份設定實際會送出什麼的開頭幾行——開關一改就跟著變。
 *
 * 成本從四張數字卡改成一條讀數列：同樣的資訊，少掉四個容器。
 */
export function DataSourcesSection({
  draft,
  setAi,
  setFeat,
  visionActive,
  coverActive,
  onOpenPrompt,
}: {
  draft: Settings;
  setAi: (p: Partial<Settings['ai']>) => void;
  setFeat: (p: Partial<Settings['features']>) => void;
  visionActive: boolean;
  coverActive: boolean;
  onOpenPrompt: () => void;
}) {
  const m = useMessages();
  const ai = draft.ai;
  const estimate = estimateRun(REFERENCE_VIDEOS, draft);
  const { batchSize } = planOf(draft);
  const preview = buildPromptPreview(draft);
  const head = preview.user.split('\n').slice(0, PREVIEW_LINES).join('\n');

  const sources = [
    {
      key: 'detail',
      name: m.dataSources.sources.detail.name,
      badge: m.dataSources.sources.detail.badge,
      checked: draft.features.fetchDetail,
      disabled: false,
      cost: `+${REFERENCE_VIDEOS}`,
      unit: m.dataSources.sources.detail.unit,
      desc: m.dataSources.sources.detail.desc(DETAIL_TTL_DAYS),
      def: m.dataSources.sources.detail.default,
      onChange: (fetchDetail: boolean) => setFeat({ fetchDetail }),
    },
    {
      key: 'subtitle',
      name: m.dataSources.sources.subtitle.name,
      checked: draft.features.fetchSubtitle,
      disabled: !draft.features.fetchDetail,
      cost: draft.features.fetchSubtitle && draft.features.fetchDetail ? `+${REFERENCE_VIDEOS * 2}` : '+0',
      unit: m.dataSources.sources.subtitle.unit,
      desc: draft.features.fetchDetail ? m.dataSources.sources.subtitle.descOn : m.dataSources.sources.subtitle.descOff,
      def: m.dataSources.sources.subtitle.default,
      onChange: (fetchSubtitle: boolean) => setFeat({ fetchSubtitle }),
    },
    {
      key: 'cover',
      name: m.dataSources.sources.cover.name,
      badge: visionActive ? undefined : m.dataSources.sources.cover.badgeNeedsTest,
      checked: ai.attachCover,
      disabled: !visionActive,
      cost: `+${estimate.cdnRequests}`,
      unit: m.dataSources.sources.cover.unit,
      desc: m.dataSources.sources.cover.desc,
      def: m.dataSources.sources.cover.default,
      onChange: (attachCover: boolean) => setAi({ attachCover }),
    },
  ];

  return (
    <div className="cols">
      <div className="col-l">
        {sources.map((s) => (
          <div key={s.key} className="srow">
            <input
              type="checkbox"
              className="switch"
              aria-label={s.name}
              checked={s.checked}
              disabled={s.disabled}
              onChange={(e) => s.onChange(e.target.checked)}
            />
            <span className="srow-main">
              <span className="srow-name">
                {s.name}
                {s.badge && (
                  <span className={s.badge === m.dataSources.sources.detail.badge ? 'tag pink' : 'tag'}>{s.badge}</span>
                )}
              </span>
              <span className="srow-desc">{s.desc}</span>
              <span className="srow-def">
                {m.settings.defaultLabel} <b>{s.def}</b>
              </span>
            </span>
            <span className="srow-cost">
              <b className={s.cost === '+0' ? 'mono dim' : 'mono'}>{s.cost}</b>
              <span>{s.unit}</span>
            </span>
          </div>
        ))}

        <div className="srow" style={{ borderTop: '1px solid var(--line)' }}>
          <span className="srow-main">
            <span className="srow-name">
              <label htmlFor="batchSize">{m.dataSources.perBatch}</label>
            </span>
            <span className="srow-desc">{coverActive ? m.dataSources.perBatchHintCover : m.dataSources.perBatchHintText}</span>
            <span className="srow-def">
              {m.settings.defaultLabel} <b>{m.dataSources.perBatchDefault}</b>
            </span>
          </span>
          <span className="srow-cost">
            <input
              id="batchSize"
              type="number"
              min={1}
              max={coverActive ? 30 : 100}
              style={{ width: 84 }}
              value={coverActive ? (ai.batchSizeVision ?? batchSize) : (ai.batchSizeText ?? batchSize)}
              onChange={(e) => {
                const n = Math.max(1, Number(e.target.value) || 1);
                if (coverActive) setAi({ batchSizeVision: n });
                else setAi({ batchSizeText: n });
              }}
            />
          </span>
        </div>

        <div className="promptbox">
          <div className="row" style={{ marginBottom: 10 }}>
            <span className="lbl">{m.dataSources.whatGetsSent}</span>
            <span className="why">
              {m.dataSources.userMessageStart} {preview.note}
            </span>
            <button type="button" className="btn spacer" onClick={onOpenPrompt}>
              <IconDoc />
              {m.dataSources.expandFull}
            </button>
          </div>
          <pre className="pre clip">{head}</pre>
        </div>
      </div>

      <div className="col-r">
        <div className="read-strip">
          <div className="read-strip-head">
            <span className="lbl">{m.dataSources.thisSettingCosts}</span>
            <span className="mono dim spacer" style={{ fontSize: 11 }}>
              {m.dataSources.noCache(REFERENCE_VIDEOS)}
            </span>
          </div>
          <div className="read-strip-body">
            <span className="read-item">
              <b className="mono">{estimate.biliRequests}</b>
              <span>{m.dataSources.bilibiliReads}</span>
            </span>
            <span className={estimate.cdnRequests === 0 ? 'read-item zero' : 'read-item'}>
              <b className="mono">{estimate.cdnRequests}</b>
              <span>{m.dataSources.coverImages}</span>
            </span>
            <span className="read-item">
              <b className="mono">{estimate.aiCalls}</b>
              <span>{m.dataSources.aiCalls}</span>
            </span>
            <span className="read-item">
              <b className="mono">≈{estimate.minutes}</b>
              <span>{m.dataSources.minutes}</span>
            </span>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <RequestTable estimate={estimate} compact />
        </div>

        <p className="desc" style={{ marginTop: 12 }}>
          {m.dataSources.fadedRowsNote(estimate.minutes)}
        </p>
      </div>
    </div>
  );
}
