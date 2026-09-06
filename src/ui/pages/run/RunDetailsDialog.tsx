import { useEffect, useState } from 'react';
import type { Estimate } from '@/core/estimate';
import type { Settings } from '@/shared/types';
import { FlowSteps } from '../../components/FlowSteps';
import { PromptPreview } from '../../components/PromptPreview';
import { RequestTable } from '../../components/RequestTable';
import { useMessages } from '../../hooks/useI18n';

type Tab = 'flow' | 'requests' | 'prompt';

/**
 * 「這次會做什麼」的三種問法收在同一個視窗裡：步驟、請求量、prompt 內容。
 * 它們原本是整理頁上三個攤開就多好幾百 px 的摺疊區，但看的時機是「開始之前確認一次」，
 * 不是每次捲過去都要看。
 */
export function RunDetailsDialog({
  estimate,
  settings,
  planned,
  onClose,
}: {
  estimate: Estimate;
  settings: Settings;
  planned: number;
  onClose: () => void;
}) {
  const m = useMessages();
  const [tab, setTab] = useState<Tab>('flow');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'flow', label: m.runDetailsDialog.tabs.flow },
    { id: 'requests', label: m.runDetailsDialog.tabs.requests },
    { id: 'prompt', label: m.runDetailsDialog.tabs.prompt },
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dlg-backdrop" onClick={onClose}>
      <div
        className="dlg"
        role="dialog"
        aria-modal="true"
        aria-label={m.runDetailsDialog.ariaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dlg-head">
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{m.runDetailsDialog.title}</div>
            <div className="desc">{m.runDetailsDialog.desc(planned)}</div>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            {m.common.close}
          </button>
        </div>
        <div className="c-tools" style={{ borderBottom: '1px solid var(--line)' }}>
          {tabs.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? 'chip on' : 'chip'} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="dlg-body">
          {tab === 'flow' && <FlowSteps settings={settings} />}
          {tab === 'requests' && <RequestTable estimate={estimate} />}
          {tab === 'prompt' && <PromptPreview settings={settings} />}
        </div>
      </div>
    </div>
  );
}
