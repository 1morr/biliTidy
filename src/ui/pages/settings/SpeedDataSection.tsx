import { useRef, useState } from 'react';
import { clearActivities, clearCache } from '@/core/cache';
import { ACTIVITY_TTL_DAYS, DETAIL_TTL_DAYS } from '@/core/settings';
import { LANGUAGES, setLanguage } from '@/i18n';
import type { Settings } from '@/shared/types';
import { ModeField, NumberField, type ModeOption } from '../../components/fields';
import { fmtDate } from '../../format';
import { useLanguage, useMessages } from '../../hooks/useI18n';

/**
 * 限速三選一。實際數值仍然存在 rate 的三個欄位裡（沒有新增設定項），
 * 這裡只是把「保守／預設／快」對應到一組數值；對不上任何一組就顯示「自訂」。
 * 整理收藏與清理關注共用這一組（一次只跑一個，只有一把節流器）。
 */
const RATE_PRESET_IDS = ['safe', 'normal', 'fast'] as const;
const RATE_PRESET_VALUES = {
  safe: { readRps: 1, writeIntervalMs: 1500 },
  normal: { readRps: 2, writeIntervalMs: 800 },
  fast: { readRps: 3, writeIntervalMs: 500 },
} as const;

type RatePreset = (typeof RATE_PRESET_IDS)[number] | 'custom';

function ratePresetOf(rate: Settings['rate']): RatePreset {
  for (const id of RATE_PRESET_IDS) {
    const p = RATE_PRESET_VALUES[id];
    if (p.readRps === rate.readRps && p.writeIntervalMs === rate.writeIntervalMs) return id;
  }
  return 'custom';
}

export interface CacheCounts {
  details: number;
  covers: number;
  /** 已查過活躍度的帳號數與最早一筆的時間；沒有就是 0 / null */
  accounts: number;
  oldestAccountAt: number | null;
}

/** 4 速度與資料：限速、兩組快取與備份。快取與備份的狀態只有這一段用得到。 */
export function SpeedDataSection({
  draft,
  setRate,
  cache,
  onCacheCleared,
  onExport,
  onImport,
}: {
  draft: Settings;
  setRate: (p: Partial<Settings['rate']>) => void;
  /** 快取統計由容器持有：左軌的段落摘要也要顯示它 */
  cache: CacheCounts | null;
  onCacheCleared: () => void;
  /** 匯出要用到容器的 draft 與描述，匯入要寫回容器的 draft，所以兩支都由容器提供 */
  onExport: () => string;
  onImport: (file: File) => Promise<string>;
}) {
  const m = useMessages();
  const language = useLanguage();
  const [backupNote, setBackupNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ratePreset = ratePresetOf(draft.rate);
  const rateOptions: ModeOption<RatePreset>[] = [
    ...RATE_PRESET_IDS.map((id) => ({
      value: id as RatePreset,
      title: `${m.speedData.ratePresets[id].label}（${RATE_PRESET_VALUES[id].readRps} req/s）`,
      note: m.speedData.ratePresets[id].note,
    })),
    ...(ratePreset === 'custom'
      ? [{ value: 'custom' as RatePreset, title: m.speedData.custom, note: m.speedData.customNote }]
      : []),
  ];

  const exportBackup = () => setBackupNote(onExport());
  const importBackup = (file: File) => void onImport(file).then(setBackupNote);

  return (
    <div className="c-body c-pad settings-form">
      <ModeField
        label={m.settings.language}
        name="language"
        options={LANGUAGES.map((l) => ({ value: l.id, title: l.label, note: '' }))}
        value={language}
        onChange={(lang) => void setLanguage(lang)}
      />
      <div className="divider" />
      <ModeField
        label={m.speedData.readWriteSpeed}
        name="ratePreset"
        options={rateOptions}
        value={ratePreset}
        onChange={(id) => {
          if (id === 'custom') return;
          const preset = RATE_PRESET_VALUES[id];
          setRate({ readRps: preset.readRps, writeIntervalMs: preset.writeIntervalMs });
        }}
        hint={m.speedData.rateHint}
      />
      <details className="details">
        <summary>{m.speedData.advanced}</summary>
        <div className="row">
          <NumberField
            id="rps"
            label={m.speedData.readRate}
            value={draft.rate.readRps}
            min={0.2}
            max={5}
            step={0.1}
            hint={m.speedData.readRateHint}
            onChange={(readRps) => setRate({ readRps })}
          />
          <NumberField
            id="writeInterval"
            label={m.speedData.writeInterval}
            value={draft.rate.writeIntervalMs}
            min={300}
            max={10000}
            step={100}
            hint={m.speedData.writeIntervalHint}
            onChange={(writeIntervalMs) => setRate({ writeIntervalMs })}
          />
          <NumberField
            id="moveBatch"
            label={m.speedData.perMoveBatch}
            value={draft.rate.moveBatchSize}
            min={1}
            max={50}
            hint={m.speedData.perMoveBatchHint}
            onChange={(moveBatchSize) => setRate({ moveBatchSize })}
          />
        </div>
      </details>
      <div className="divider" />
      <div className="field">
        <label>{m.speedData.cache}</label>
        <div className="row tight">
          <span className="muted">{cache ? m.speedData.cacheSummary(cache.details, cache.covers) : m.speedData.calculating}</span>
          <button
            type="button"
            className="link"
            disabled={!cache || cache.details + cache.covers === 0}
            onClick={() => void clearCache().then(onCacheCleared)}
          >
            {m.speedData.clear}
          </button>
        </div>
        <div className="row tight">
          <span className="muted">
            {cache === null
              ? m.speedData.calculating
              : cache.accounts === 0
                ? m.speedData.activityCacheEmpty
                : m.speedData.activityCacheSummary(
                    cache.accounts,
                    cache.oldestAccountAt ? fmtDate(cache.oldestAccountAt / 1000) : '—',
                  )}
          </span>
          <button
            type="button"
            className="link"
            disabled={!cache || cache.accounts === 0}
            onClick={() => void clearActivities().then(onCacheCleared)}
          >
            {m.speedData.clear}
          </button>
        </div>
        <span className="hint">{m.speedData.cacheHint(DETAIL_TTL_DAYS, ACTIVITY_TTL_DAYS)}</span>
      </div>
      <div className="field">
        <label>{m.speedData.backup}</label>
        <div className="row tight">
          <button type="button" className="btn small" onClick={exportBackup}>
            {m.speedData.exportDescriptionsAndSettings}
          </button>
          <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
            {m.speedData.import}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void importBackup(file);
            }}
          />
          {backupNote && <span className="muted small">{backupNote}</span>}
        </div>
        <span className="hint">{m.speedData.backupHint}</span>
      </div>
    </div>
  );
}
