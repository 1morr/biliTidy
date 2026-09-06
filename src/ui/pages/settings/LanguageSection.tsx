import { LANGUAGES, setLanguage } from '@/i18n';
import { SettingRow } from '../../components/fields';
import { useLanguage, useMessages } from '../../hooks/useI18n';

/** 06 語言：改了立刻生效（不經 draft），每個 JS context 各自 watchLanguage 跟上。 */
export function LanguageSection() {
  const m = useMessages();
  const language = useLanguage();

  return (
    <div className="c-body c-pad settings-form">
      <SettingRow label={m.settings.languageLabel}>
        {LANGUAGES.map((l) => (
          <label className="check" key={l.id}>
            <input type="radio" name="language" checked={language === l.id} onChange={() => void setLanguage(l.id)} />
            <span>{l.label}</span>
          </label>
        ))}
      </SettingRow>
    </div>
  );
}
