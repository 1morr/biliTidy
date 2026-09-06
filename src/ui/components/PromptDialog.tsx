import { useEffect, useState } from 'react';
import type { BatchRecord } from '@/core/organizer';
import { useMessages } from '../hooks/useI18n';

function Section({ title, text }: { title: string; text: string }) {
  const m = useMessages();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 沒有剪貼簿權限就算了，內容本來就看得到
    }
  };
  return (
    <div className="dlg-section">
      <div className="row">
        <strong>{title}</strong>
        <span className="muted small">{m.promptDialog.charCount(text.length)}</span>
        <button type="button" className="btn small spacer" onClick={() => void copy()}>
          {copied ? m.promptDialog.copied : m.promptDialog.copy}
        </button>
      </div>
      <pre className="pre">{text}</pre>
    </div>
  );
}

/** 這支影片是在哪一批送出的、送了什麼、模型原樣回了什麼 */
export function PromptDialog({ title, record, onClose }: { title: string; record: BatchRecord; onClose: () => void }) {
  const m = useMessages();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const usage = record.usage;
  return (
    <div className="dlg-backdrop" onClick={onClose}>
      <div
        className="dlg"
        role="dialog"
        aria-modal="true"
        aria-label={m.promptDialog.ariaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dlg-head">
          <div>
            <div style={{ fontWeight: 600 }}>{title}</div>
            <div className="muted small">
              {record.label}
              {m.promptDialog.videoCount(record.bvids.length)}
              {record.coverCount > 0 && m.promptDialog.coversAttached(record.coverCount)}
              {record.finishReason && <>．finish_reason={record.finishReason}</>}
              {usage && m.promptDialog.tokensSent(String(usage.prompt_tokens ?? '?'), String(usage.completion_tokens ?? '?'))}
            </div>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            {m.promptDialog.close}
          </button>
        </div>
        <div className="dlg-body">
          <Section title={m.promptDialog.system} text={record.system} />
          <Section title={m.promptDialog.user} text={record.user} />
          {record.reasoningContent && <Section title={m.promptDialog.reasoning} text={record.reasoningContent} />}
          <Section title={m.promptDialog.reply} text={record.response} />
        </div>
      </div>
    </div>
  );
}
