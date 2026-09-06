import { useEffect, useState } from 'react';
import { activityStats, cacheStats } from '@/core/cache';
import { planOf } from '@/core/plan';
import { normalizeSettings } from '@/core/settings';
import { toAppError } from '@/shared/result';
import type { Settings } from '@/shared/types';
import { PromptPreview } from '../../components/PromptPreview';
import { IconEye, IconGauge, IconPlug, IconRules } from '../../components/icons';
import { useMessages } from '../../hooks/useI18n';
import { useAppStore } from '../../store';
import { ensureEndpointPermission } from './permission';
import { ConnectionSection } from './ConnectionSection';
import { DataSourcesSection } from './DataSourcesSection';
import { InstructionsSection } from './InstructionsSection';
import { SpeedDataSection, type CacheCounts } from './SpeedDataSection';

type SectionId = 'connection' | 'data' | 'instructions' | 'speed';

/**
 * 設定頁的容器：段落導覽、draft／dirty／儲存，四塊內容各自成檔。
 *
 * 從一條約 4000px 的長捲改成「左側四段導覽＋一次只看一段」：每一段在左軌就看得到目前狀態，
 * 不必捲到那一段才知道端點通不通、哪幾個資料來源開著。
 *
 * draft 一定要留在這裡——視覺測試會立刻寫進 storage，而只寫 `ai` 再把 dirty 清掉的話，
 * 下面那個 useEffect 會把 draft 重設成 saved，使用者在 features／rate 的編輯就消失了。
 */
export function SettingsPage() {
  const m = useMessages();
  const titles: Record<SectionId, { title: string; desc: string }> = {
    connection: m.settings.sectionTitles.connection,
    data: m.settings.sectionTitles.data,
    instructions: m.settings.sectionTitles.instructions,
    speed: m.settings.sectionTitles.speed,
  };
  const saved = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const descriptions = useAppStore((s) => s.descriptions);
  const setDescriptions = useAppStore((s) => s.setDescriptions);
  const [draft, setDraft] = useState<Settings>(saved);
  const [dirty, setDirty] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>('connection');
  const [cache, setCache] = useState<CacheCounts | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft(saved);
  }, [saved, dirty]);

  const refreshCache = () =>
    void Promise.all([cacheStats(), activityStats()])
      .then(([favs, acts]) => setCache({ ...favs, accounts: acts.count, oldestAccountAt: acts.oldestAt }))
      .catch(() => undefined);
  useEffect(refreshCache, []);

  const patch = (fn: (s: Settings) => Settings) => {
    setDraft((d) => fn(d));
    setDirty(true);
  };
  const setAi = (p: Partial<Settings['ai']>) => patch((s) => ({ ...s, ai: { ...s.ai, ...p } }));
  const setRate = (p: Partial<Settings['rate']>) => patch((s) => ({ ...s, rate: { ...s.rate, ...p } }));
  const setFeat = (p: Partial<Settings['features']>) => patch((s) => ({ ...s, features: { ...s.features, ...p } }));

  // 走與整理流程同一支判斷，設定頁不自己重算（曾經兩邊的定義各自演化過）
  const plan = planOf(draft);
  const { visionActive, withCover: coverActive } = plan;
  const extraBodyInvalid = (() => {
    const text = draft.ai.extraBody?.trim();
    if (!text) return false;
    try {
      const parsed: unknown = JSON.parse(text);
      return !parsed || typeof parsed !== 'object' || Array.isArray(parsed);
    } catch {
      return true;
    }
  })();

  async function save() {
    setSaveNote(null);
    if (draft.ai.baseUrl.trim()) {
      const r = await ensureEndpointPermission(draft.ai.baseUrl);
      if (!r.ok) setSaveNote(r.error ?? m.settings.unauthorizedEndpoint);
    }
    await updateSettings(() => draft);
    setDirty(false);
    setSaveNote((n) => n ?? m.settings.saved);
  }

  /**
   * 視覺測試結果要立刻寫進 storage（避免使用者忘記按儲存），所以連整份 draft 一起存。
   * 只寫 ai 再把 dirty 清成 false 的話，上面的 useEffect 會把 draft 重設成 saved，
   * 使用者在 features／rate 的編輯就這樣消失了。
   */
  async function persistVision(p: Partial<Settings['ai']>) {
    const next: Settings = { ...draft, ai: { ...draft.ai, ...p } };
    setDraft(next);
    await updateSettings(() => next);
    setDirty(false);
    setSaveNote(m.settings.visionSavedNote);
  }

  /** 匯出：描述是這裡最難重建的資產（每個夾都要 AI 生成或手寫），金鑰刻意不帶走 */
  function exportBackup(): string {
    const payload = {
      kind: 'bilitidy-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { ...draft, ai: { ...draft.ai, apiKey: '' } },
      descriptions,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bilitidy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return m.settings.exportedNote(Object.keys(descriptions).length);
  }

  async function importBackup(file: File): Promise<string> {
    try {
      const raw: unknown = JSON.parse(await file.text());
      const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const incoming = data.descriptions;
      const texts: Record<string, string> = {};
      if (incoming && typeof incoming === 'object') {
        for (const [id, text] of Object.entries(incoming as Record<string, unknown>)) {
          if (typeof text === 'string' && text.trim()) texts[id] = text;
        }
      }
      if (data.settings) {
        // 匯入的設定不覆蓋現有的 API Key（備份本來就不含它）
        const next = normalizeSettings(data.settings);
        const merged: Settings = { ...next, ai: { ...next.ai, apiKey: next.ai.apiKey || draft.ai.apiKey } };
        setDraft(merged);
        await updateSettings(() => merged);
        setDirty(false);
      }
      if (Object.keys(texts).length > 0) await setDescriptions(texts);
      return m.settings.importedNote(Object.keys(texts).length, !!data.settings);
    } catch (e) {
      return m.settings.importFailedNote(toAppError(e).message);
    }
  }

  const customLength = draft.ai.customInstructions?.trim().length ?? 0;
  const nav: { id: SectionId; icon: React.ReactNode; status: React.ReactNode }[] = [
    {
      id: 'connection',
      icon: <IconPlug className="ic" />,
      status: plan.aiReady ? (
        <>
          <span className="dot" style={{ background: 'var(--ok)' }} />
          {m.settings.nav.connected} · <span className="mono">{draft.ai.model}</span>
          {visionActive && <span className="tag ok">{m.settings.nav.visionVerified}</span>}
        </>
      ) : (
        <>
          <span className="dot" style={{ background: 'var(--bad)' }} />
          {m.settings.nav.noEndpointOrModel}
        </>
      ),
    },
    {
      id: 'data',
      icon: <IconEye className="ic" />,
      status: (
        <>
          <span className={draft.features.fetchDetail ? 'tag ok' : 'tag'}>{m.settings.nav.tags.detail}</span>
          <span className={plan.withSubtitle ? 'tag ok' : 'tag'}>{m.settings.nav.tags.subtitle}</span>
          <span className={coverActive ? 'tag ok' : 'tag'}>{m.settings.nav.tags.cover}</span>
          <span className="mono">{m.settings.nav.perBatch(plan.batchSize)}</span>
        </>
      ),
    },
    {
      id: 'instructions',
      icon: <IconRules className="ic" />,
      status: customLength > 0 ? m.settings.nav.customInstructions(customLength) : m.settings.nav.noCustomInstructions,
    },
    {
      id: 'speed',
      icon: <IconGauge className="ic" />,
      status: (
        <>
          <span className="mono">{draft.rate.readRps} req/s</span>
          {cache && (
            <>
              <span>·</span>
              <span className="mono">{m.settings.nav.cache(cache.details)}</span>
              <span>·</span>
              <span className="mono">{m.settings.nav.activityCache(cache.accounts)}</span>
            </>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="page">
      <div className="work rail-center">
        <aside className="rail">
          <div className="rail-sec" style={{ borderBottom: 0, paddingBottom: 10 }}>
            <span className="lbl">{m.app.nav.settings}</span>
          </div>
          <div className="snav">
            {nav.map((n) => (
              <button
                key={n.id}
                type="button"
                className={section === n.id ? 'snav-item on' : 'snav-item'}
                onClick={() => setSection(n.id)}
              >
                {n.icon}
                <span>
                  <span className="nm">{titles[n.id].title}</span>
                  <span className="st">{n.status}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="rail-foot" style={{ display: 'block', lineHeight: 1.6 }}>
            {m.settings.keyStoredLocally} <span className="mono">chrome.storage.local</span>
            {m.settings.keyStoredLocallyAfter}
          </div>
        </aside>

        <main className="center">
          <div className="c-head">
            <div className="c-title">{titles[section].title}</div>
            <p className="desc">{titles[section].desc}</p>
          </div>

          {section === 'connection' && (
            <ConnectionSection
              draft={draft}
              setAi={setAi}
              visionActive={visionActive}
              extraBodyInvalid={extraBodyInvalid}
              persistVision={persistVision}
              onPermissionNote={setSaveNote}
            />
          )}
          {section === 'data' && (
            <DataSourcesSection
              draft={draft}
              setAi={setAi}
              setFeat={setFeat}
              visionActive={visionActive}
              coverActive={coverActive}
              onOpenPrompt={() => setPromptOpen(true)}
            />
          )}
          {section === 'instructions' && <InstructionsSection draft={draft} setAi={setAi} />}
          {section === 'speed' && (
            <SpeedDataSection
              draft={draft}
              setRate={setRate}
              cache={cache}
              onCacheCleared={refreshCache}
              onExport={exportBackup}
              onImport={importBackup}
            />
          )}
        </main>
      </div>

      <footer className="runbar">
        <button type="button" className="btn primary" disabled={!dirty} onClick={() => void save()}>
          {m.settings.save}
        </button>
        <span className="why">{saveNote ?? (dirty ? m.settings.unsavedChanges : m.settings.nothingToSave)}</span>
      </footer>

      {promptOpen && <PromptDialogWindow settings={draft} onClose={() => setPromptOpen(false)} />}
    </div>
  );
}

function PromptDialogWindow({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const m = useMessages();
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
        aria-label={m.settings.promptDialogAriaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dlg-head">
          <div style={{ fontSize: 15, fontWeight: 600 }}>{m.settings.whatGetsSentToAi}</div>
          <button type="button" className="btn" onClick={onClose}>
            {m.settings.close}
          </button>
        </div>
        <div className="dlg-body">
          <PromptPreview settings={settings} />
        </div>
      </div>
    </div>
  );
}
