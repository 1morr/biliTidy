import { useEffect, useState } from 'react';
import { activityStats, cacheStats } from '@/core/cache';
import { planOf } from '@/core/plan';
import { normalizeSettings } from '@/core/settings';
import { LANGUAGES } from '@/i18n';
import { toAppError } from '@/shared/result';
import type { Settings } from '@/shared/types';
import { PromptPreview } from '../../components/PromptPreview';
import { IconArrowRight } from '../../components/icons';
import { useLanguage, useMessages } from '../../hooks/useI18n';
import { useAppStore } from '../../store';
import { ensureEndpointPermission } from './permission';
import { ConnectionSection } from './ConnectionSection';
import { DataSection, type CacheCounts } from './DataSection';
import { DataSourcesSection } from './DataSourcesSection';
import { InstructionsSection } from './InstructionsSection';
import { LanguageSection } from './LanguageSection';
import { ratePresetOf, SpeedSection } from './SpeedSection';

/**
 * 六章分三組：01–03 只有整理收藏（與收藏夾描述、影片頁）用得到，也就是「需要 AI」的那些；
 * 04–06 兩個工具共用；清理關注自己的兩個設定不在這裡，左軌最後一列是通往關注頁的門。
 */
export type SectionId = 'endpoint' | 'sources' | 'instructions' | 'speed' | 'data' | 'language';
const ORDER: SectionId[] = ['endpoint', 'sources', 'instructions', 'speed', 'data', 'language'];
const ORGANISE: SectionId[] = ['endpoint', 'sources', 'instructions'];
const SHARED: SectionId[] = ['speed', 'data', 'language'];

type ScopeKey = 'organise' | 'descriptions' | 'quickFav' | 'follows';
/** 每一章影響哪些功能、明確不影響哪個——寫在章節開頭，讓人不必讀完整章才知道跟自己有沒有關係 */
const SCOPE: Record<SectionId, { used: ScopeKey[]; notUsed: ScopeKey[] }> = {
  endpoint: { used: ['organise', 'descriptions', 'quickFav'], notUsed: ['follows'] },
  sources: { used: ['organise', 'quickFav'], notUsed: ['follows'] },
  instructions: { used: ['organise', 'quickFav'], notUsed: ['follows'] },
  speed: { used: ['organise', 'follows', 'quickFav'], notUsed: [] },
  data: { used: ['organise', 'follows'], notUsed: [] },
  language: { used: ['organise', 'follows', 'quickFav'], notUsed: [] },
};

const chapterNo = (id: SectionId) => String(ORDER.indexOf(id) + 1).padStart(2, '0');

const differs = (a: unknown, b: unknown) => ((a ?? '') !== (b ?? '') ? 1 : 0);

/** 每一章有幾個欄位改過還沒存：控制列上亮起的章節段、主按鈕上的數字、`.why` 的句子都從這裡來 */
function changedFields(draft: Settings, saved: Settings): Record<SectionId, number> {
  const a = draft.ai;
  const b = saved.ai;
  return {
    endpoint:
      differs(a.baseUrl, b.baseUrl) +
      differs(a.apiKey, b.apiKey) +
      differs(a.model, b.model) +
      differs(a.visionSupported, b.visionSupported) +
      differs(a.visionVerifiedAt, b.visionVerifiedAt) +
      differs(a.temperature, b.temperature) +
      differs(a.extraBody, b.extraBody),
    sources:
      differs(draft.features.fetchDetail, saved.features.fetchDetail) +
      differs(draft.features.fetchSubtitle, saved.features.fetchSubtitle) +
      differs(a.attachCover, b.attachCover) +
      differs(a.batchSizeText, b.batchSizeText) +
      differs(a.batchSizeVision, b.batchSizeVision),
    instructions: differs(a.customInstructions, b.customInstructions),
    speed:
      differs(draft.rate.readRps, saved.rate.readRps) +
      differs(draft.rate.writeIntervalMs, saved.rate.writeIntervalMs) +
      differs(draft.rate.moveBatchSize, saved.rate.moveBatchSize),
    // 快取、備份、語言都是按下去立刻生效的動作，沒有草稿
    data: 0,
    language: 0,
  };
}

/**
 * 設定頁的容器：章節導覽、draft／dirty／儲存，六章內容各自成檔。
 *
 * draft 一定要留在這裡——視覺測試會立刻寫進 storage，而只寫 `ai` 再把 dirty 清掉的話，
 * 下面那個 useEffect 會把 draft 重設成 saved，使用者在 features／rate 的編輯就消失了。
 */
export function SettingsPage({ onOpenFollows }: { onOpenFollows: () => void }) {
  const m = useMessages();
  const language = useLanguage();
  const saved = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const descriptions = useAppStore((s) => s.descriptions);
  const setDescriptions = useAppStore((s) => s.setDescriptions);
  const [draft, setDraft] = useState<Settings>(saved);
  const [dirty, setDirty] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>('endpoint');
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

  const changed = changedFields(draft, saved);
  const changedTotal = ORDER.reduce((n, id) => n + changed[id], 0);
  const changedNames = ORDER.filter((id) => changed[id] > 0)
    .map((id) => `${chapterNo(id)} ${m.settings.sections[id].title}`)
    .join(', ');

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

  // 左軌每一章下面那一行摘要：不必點進去就知道這一章目前的狀態
  const customLength = draft.ai.customInstructions?.trim().length ?? 0;
  const preset = ratePresetOf(draft.rate);
  const presetLabel = preset === 'custom' ? m.speedData.custom : m.speedData.ratePresets[preset].label;
  const status: Record<SectionId, React.ReactNode> = {
    endpoint: plan.aiReady ? (
      <>
        <span className="dot" style={{ background: 'var(--ok)' }} />
        <span>{m.settings.nav.connected}</span>
        <span>·</span>
        <span className="ellipsis mono">{draft.ai.model}</span>
        {visionActive && <span className="tag ok">{m.settings.nav.visionVerified}</span>}
      </>
    ) : (
      <>
        <span className="dot" style={{ background: 'var(--bad)' }} />
        <span className="ellipsis">{m.settings.nav.noEndpointOrModel}</span>
      </>
    ),
    sources: (
      <>
        <span className={draft.features.fetchDetail ? 'tag ok' : 'tag'}>{m.settings.nav.tags.detail}</span>
        <span className={plan.withSubtitle ? 'tag ok' : 'tag'}>{m.settings.nav.tags.subtitle}</span>
        <span className={coverActive ? 'tag ok' : 'tag'}>{m.settings.nav.tags.cover}</span>
        <span className="ellipsis mono">{m.settings.nav.perBatch(plan.batchSize)}</span>
      </>
    ),
    instructions: (
      <span className="ellipsis">
        {customLength > 0 ? m.settings.nav.customInstructions(customLength) : m.settings.nav.noCustomInstructions}
      </span>
    ),
    speed: (
      <span className="ellipsis mono">{m.settings.nav.speed(presetLabel, draft.rate.readRps, draft.rate.writeIntervalMs)}</span>
    ),
    data: cache ? (
      <>
        <span className="mono">{m.settings.nav.cache(cache.details)}</span>
        <span>·</span>
        <span className="mono">{m.settings.nav.activityCache(cache.accounts)}</span>
      </>
    ) : (
      <span>{m.speedData.calculating}</span>
    ),
    language: <span>{LANGUAGES.find((l) => l.id === language)?.label ?? language}</span>,
  };

  const chapter = (id: SectionId) => (
    <button
      key={id}
      type="button"
      className={section === id ? 'chap on' : 'chap'}
      aria-current={section === id ? 'page' : undefined}
      onClick={() => setSection(id)}
    >
      <span className="no">{chapterNo(id)}</span>
      <span className="nm">{m.settings.sections[id].title}</span>
      <span className="st">{status[id]}</span>
    </button>
  );

  const scope = SCOPE[section];
  const title = m.settings.sections[section];

  return (
    <div className="page">
      <div className="work rail-center">
        <aside className="rail">
          <div className="chap-grp">
            <span className="no">01 – 03</span>
            <span className="g">{m.settings.groups.organise}</span>
          </div>
          {ORGANISE.map(chapter)}
          <div className="chap-grp">
            <span className="no">04 – 06</span>
            <span className="g">{m.settings.groups.shared}</span>
          </div>
          {SHARED.map(chapter)}
          <div className="chap-grp">
            <span className="no">—</span>
            <span className="g">{m.settings.groups.follows}</span>
          </div>
          <button type="button" className="chap link" onClick={onOpenFollows}>
            <span className="no">
              <IconArrowRight size={13} />
            </span>
            <span className="nm">{m.settings.followsPointer.title(draft.follows.thresholdDays)}</span>
            <span className="st">{m.settings.followsPointer.desc}</span>
          </button>
          <div className="rail-foot" style={{ display: 'block', lineHeight: 1.6 }}>
            {m.settings.keyStoredLocally} <span className="mono">chrome.storage.local</span>
            {m.settings.keyStoredLocallyAfter}
          </div>
        </aside>

        <main className="center">
          <div className="c-head">
            <div className="c-title">
              <span className="no">{chapterNo(section)}</span>
              {title.title}
            </div>
            <div className="scope">
              <span>{m.settings.scope.usedBy}</span>
              {scope.used.map((k) => (
                <span key={k} className="badge on">
                  {m.settings.scope[k]}
                </span>
              ))}
              {scope.notUsed.length > 0 && (
                <>
                  <span className="dim">·</span>
                  <span>{m.settings.scope.notUsedBy}</span>
                  {scope.notUsed.map((k) => (
                    <span key={k} className="badge off">
                      {m.settings.scope[k]}
                    </span>
                  ))}
                </>
              )}
            </div>
            <p className="intro">{title.desc}</p>
          </div>

          {section === 'endpoint' && (
            <ConnectionSection
              draft={draft}
              saved={saved}
              setAi={setAi}
              visionActive={visionActive}
              extraBodyInvalid={extraBodyInvalid}
              persistVision={persistVision}
              onPermissionNote={setSaveNote}
            />
          )}
          {section === 'sources' && (
            <DataSourcesSection
              draft={draft}
              setAi={setAi}
              setFeat={setFeat}
              visionActive={visionActive}
              coverActive={coverActive}
              onOpenPrompt={() => setPromptOpen(true)}
            />
          )}
          {section === 'instructions' && <InstructionsSection draft={draft} saved={saved} setAi={setAi} />}
          {section === 'speed' && <SpeedSection draft={draft} saved={saved} setRate={setRate} />}
          {section === 'data' && (
            <DataSection cache={cache} onCacheCleared={refreshCache} onExport={exportBackup} onImport={importBackup} />
          )}
          {section === 'language' && <LanguageSection />}
        </main>
      </div>

      <footer className="runbar">
        <button type="button" className="btn primary" disabled={!dirty || changedTotal === 0} onClick={() => void save()}>
          {changedTotal > 0 ? m.settings.saveN(changedTotal) : m.settings.save}
        </button>
        <span className="why">
          {saveNote ?? (changedTotal > 0 ? m.settings.unsavedIn(changedNames) : m.settings.nothingToSave)}
        </span>
        <div className="chapters">
          <div className="segs">
            {ORDER.map((id, i) => (
              <span key={id} style={{ display: 'contents' }}>
                <button
                  type="button"
                  className={['seg', changed[id] > 0 ? 'dirty' : '', section === id ? 'now' : ''].filter(Boolean).join(' ')}
                  aria-label={m.settings.chapterAria(chapterNo(id), m.settings.sections[id].title)}
                  onClick={() => setSection(id)}
                />
                {i === ORGANISE.length - 1 && <span className="gap" />}
              </span>
            ))}
          </div>
          <div className="seg-labels" aria-hidden="true">
            {ORDER.map((id, i) => (
              <span key={id} style={{ display: 'contents' }}>
                <span className={section === id ? 'now' : undefined}>{chapterNo(id)}</span>
                {i === ORGANISE.length - 1 && <span className="gap" />}
              </span>
            ))}
          </div>
        </div>
        <span className="read-inline mono">
          {m.settings.chapterReadout(ORDER.indexOf(section) + 1, ORDER.length, changedTotal)}
        </span>
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
