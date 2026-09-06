import { buildPromptPreview } from '@/core/promptPreview';
import type { Settings } from '@/shared/types';
import { useMessages } from '../hooks/useI18n';

/** 用假影片示範「這份設定會送出什麼」；走的是正式的 prompt 組裝，設定一改就跟著變 */
export function PromptPreview({ settings }: { settings: Settings }) {
  const m = useMessages();
  const preview = buildPromptPreview(settings);
  return (
    <div>
      <p className="desc">
        {m.promptPreview.intro}
        {preview.note && <> {preview.note}</>}
      </p>
      <div className="dlg-section">
        <strong>{m.promptPreview.system}</strong>
        <pre className="pre">{preview.system}</pre>
      </div>
      <div className="dlg-section">
        <strong>{m.promptPreview.user}</strong>
        <pre className="pre">{preview.user}</pre>
      </div>
    </div>
  );
}
