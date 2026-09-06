import type { Settings } from '@/shared/types';
import { NumberField, SettingRow } from '../../components/fields';
import { useMessages } from '../../hooks/useI18n';

/**
 * 限速三選一。實際數值仍然存在 rate 的三個欄位裡（沒有新增設定項），
 * 這裡只是把「保守／預設／快」對應到一組數值；對不上任何一組就顯示「自訂」。
 * 整理收藏與清理關注共用這一組（一次只跑一個，只有一把節流器）。
 */
export const RATE_PRESET_IDS = ['safe', 'normal', 'fast'] as const;
export const RATE_PRESET_VALUES = {
  safe: { readRps: 1, writeIntervalMs: 1500 },
  normal: { readRps: 2, writeIntervalMs: 800 },
  fast: { readRps: 3, writeIntervalMs: 500 },
} as const;

export type RatePreset = (typeof RATE_PRESET_IDS)[number] | 'custom';

export function ratePresetOf(rate: Settings['rate']): RatePreset {
  for (const id of RATE_PRESET_IDS) {
    const p = RATE_PRESET_VALUES[id];
    if (p.readRps === rate.readRps && p.writeIntervalMs === rate.writeIntervalMs) return id;
  }
  return 'custom';
}

/** 04 讀寫速度：三選一，下面是它背後的三個數字。 */
export function SpeedSection({
  draft,
  saved,
  setRate,
}: {
  draft: Settings;
  saved: Settings;
  setRate: (p: Partial<Settings['rate']>) => void;
}) {
  const m = useMessages();
  const s = m.speedData;
  const preset = ratePresetOf(draft.rate);
  const rateDirty =
    draft.rate.readRps !== saved.rate.readRps ||
    draft.rate.writeIntervalMs !== saved.rate.writeIntervalMs ||
    draft.rate.moveBatchSize !== saved.rate.moveBatchSize;

  return (
    <div className="c-body c-pad settings-form">
      <SettingRow label={s.preset.label} desc={s.rateHint} def={s.preset.default} dirty={rateDirty}>
        {RATE_PRESET_IDS.map((id) => (
          <label className="check" key={id}>
            <input
              type="radio"
              name="ratePreset"
              checked={preset === id}
              onChange={() =>
                setRate({ readRps: RATE_PRESET_VALUES[id].readRps, writeIntervalMs: RATE_PRESET_VALUES[id].writeIntervalMs })
              }
            />
            <span>
              {s.ratePresets[id].label}
              <span className="mono dim"> · {RATE_PRESET_VALUES[id].readRps} req/s</span>
            </span>
            <span className="hint inline">{s.ratePresets[id].note}</span>
          </label>
        ))}
        {preset === 'custom' && (
          <label className="check">
            <input type="radio" name="ratePreset" checked readOnly />
            <span>{s.custom}</span>
            <span className="hint inline">{s.customNote}</span>
          </label>
        )}
      </SettingRow>

      <SettingRow label={s.manual.label} desc={s.manual.desc}>
        <NumberField
          id="rps"
          label={s.readRate}
          value={draft.rate.readRps}
          min={0.2}
          max={5}
          step={0.1}
          hint={s.readRateHint}
          onChange={(readRps) => setRate({ readRps })}
        />
        <NumberField
          id="writeInterval"
          label={s.writeInterval}
          value={draft.rate.writeIntervalMs}
          min={300}
          max={10000}
          step={100}
          hint={s.writeIntervalHint}
          onChange={(writeIntervalMs) => setRate({ writeIntervalMs })}
        />
        <NumberField
          id="moveBatch"
          label={s.perMoveBatch}
          value={draft.rate.moveBatchSize}
          min={1}
          max={50}
          hint={s.perMoveBatchHint}
          onChange={(moveBatchSize) => setRate({ moveBatchSize })}
        />
      </SettingRow>
    </div>
  );
}
