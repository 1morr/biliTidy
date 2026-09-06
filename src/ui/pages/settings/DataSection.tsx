import { useRef, useState } from 'react';
import { clearActivities, clearCache } from '@/core/cache';
import { ACTIVITY_TTL_DAYS, DETAIL_TTL_DAYS } from '@/core/settings';
import { SettingRow } from '../../components/fields';
import { fmtDate } from '../../format';
import { useMessages } from '../../hooks/useI18n';

export interface CacheCounts {
  details: number;
  covers: number;
  /** 已查過活躍度的帳號數與最早一筆的時間；沒有就是 0 / null */
  accounts: number;
  oldestAccountAt: number | null;
}

/** 05 快取與備份：兩組快取各自清、描述與設定的匯出匯入。這裡的動作都是按下去立刻生效，沒有草稿。 */
export function DataSection({
  cache,
  onCacheCleared,
  onExport,
  onImport,
}: {
  /** 快取統計由容器持有：左軌的章節摘要也要顯示它 */
  cache: CacheCounts | null;
  onCacheCleared: () => void;
  /** 匯出要用到容器的 draft 與描述，匯入要寫回容器的 draft，所以兩支都由容器提供 */
  onExport: () => string;
  onImport: (file: File) => Promise<string>;
}) {
  const m = useMessages();
  const s = m.speedData;
  const [backupNote, setBackupNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="c-body c-pad settings-form">
      <SettingRow label={s.videoCache.label} desc={s.videoCache.desc(DETAIL_TTL_DAYS)}>
        <div className="row tight">
          <span className="muted">{cache ? s.cacheSummary(cache.details, cache.covers) : s.calculating}</span>
          <button
            type="button"
            className="link"
            disabled={!cache || cache.details + cache.covers === 0}
            onClick={() => void clearCache().then(onCacheCleared)}
          >
            {s.clear}
          </button>
        </div>
      </SettingRow>

      <SettingRow label={s.activityCache.label} desc={s.activityCache.desc(ACTIVITY_TTL_DAYS)}>
        <div className="row tight">
          <span className="muted">
            {cache === null
              ? s.calculating
              : cache.accounts === 0
                ? s.activityCacheEmpty
                : s.activityCacheSummary(cache.accounts, cache.oldestAccountAt ? fmtDate(cache.oldestAccountAt / 1000) : '—')}
          </span>
          <button
            type="button"
            className="link"
            disabled={!cache || cache.accounts === 0}
            onClick={() => void clearActivities().then(onCacheCleared)}
          >
            {s.clear}
          </button>
        </div>
      </SettingRow>

      <SettingRow label={s.backup.label} desc={s.backup.desc}>
        <div className="row tight">
          <button type="button" className="btn" onClick={() => setBackupNote(onExport())}>
            {s.exportDescriptionsAndSettings}
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            {s.import}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void onImport(file).then(setBackupNote);
            }}
          />
        </div>
        {backupNote && <span className="muted small">{backupNote}</span>}
      </SettingRow>
    </div>
  );
}
