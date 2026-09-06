import { CUSTOM_INSTRUCTIONS_MAX } from '@/ai/prompt';
import type { Settings } from '@/shared/types';
import { SettingRow } from '../../components/fields';
import { useMessages } from '../../hooks/useI18n';

/** 03 分類指示：只有一個欄位，但它同時對整理流程與影片頁生效。 */
export function InstructionsSection({
  draft,
  saved,
  setAi,
}: {
  draft: Settings;
  saved: Settings;
  setAi: (p: Partial<Settings['ai']>) => void;
}) {
  const m = useMessages();
  const ai = draft.ai;

  return (
    <div className="c-body c-pad settings-form">
      <SettingRow
        id="customInstructions"
        label={m.instructions.label}
        desc={m.instructions.hint(ai.customInstructions?.length ?? 0, CUSTOM_INSTRUCTIONS_MAX)}
        dirty={(ai.customInstructions ?? '') !== (saved.ai.customInstructions ?? '')}
      >
        <textarea
          id="customInstructions"
          rows={5}
          placeholder={m.instructions.example}
          maxLength={CUSTOM_INSTRUCTIONS_MAX}
          value={ai.customInstructions ?? ''}
          onChange={(e) => setAi({ customInstructions: e.target.value })}
        />
      </SettingRow>
    </div>
  );
}
