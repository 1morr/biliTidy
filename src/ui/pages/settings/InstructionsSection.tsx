import { CUSTOM_INSTRUCTIONS_MAX } from '@/ai/prompt';
import type { Settings } from '@/shared/types';
import { useMessages } from '../../hooks/useI18n';

/** 3 要 AI 怎麼判斷：只有一個欄位，但它同時對整理流程與影片頁生效。 */
export function InstructionsSection({ draft, setAi }: { draft: Settings; setAi: (p: Partial<Settings['ai']>) => void }) {
  const m = useMessages();
  const ai = draft.ai;

  return (
    <div className="c-body c-pad settings-form">
      <div className="field">
        <label htmlFor="customInstructions">{m.instructions.label}</label>
        <textarea
          id="customInstructions"
          rows={3}
          placeholder={m.instructions.example}
          maxLength={CUSTOM_INSTRUCTIONS_MAX}
          value={ai.customInstructions ?? ''}
          onChange={(e) => setAi({ customInstructions: e.target.value })}
        />
        <span className="hint">{m.instructions.hint(ai.customInstructions?.length ?? 0, CUSTOM_INSTRUCTIONS_MAX)}</span>
      </div>
    </div>
  );
}
