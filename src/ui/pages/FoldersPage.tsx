import { useRef, useState } from 'react';
import { addFolder, editFolder } from '@/bilibili/fav';
import { describeFolder } from '@/core/describeFolder';
import { effectiveDescription } from '@/core/folderStore';
import { planOf } from '@/core/plan';
import { writeQueue } from '@/core/scheduler';
import { toAppError } from '@/shared/result';
import type { FolderMeta } from '@/shared/types';
import { FolderCover } from '../components/FolderCover';
import { IconArrowDown, IconPlus, IconRefresh, IconSearch, IconSparkle } from '../components/icons';
import { useMessages } from '../hooks/useI18n';
import { useAppStore } from '../store';

interface Note {
  kind: 'ok' | 'warn' | 'error';
  text: string;
}

type Facet = 'all' | 'missing' | 'fromBili' | 'draft' | 'private';

/**
 * 收藏夾的描述都在這一頁：手寫、AI 生成、從 B 站簡介帶進來、同步回 B 站，外加新增收藏夾。
 * 整理頁只負責選來源與目標，描述不在那邊編輯（同一件事只有一個地方可以改）。
 *
 * 底下那條列跟整理頁是同一個意思：你正要對勾選的這些收藏夾做什麼。
 *
 * 沒有「刪除收藏夾」：那會連同裡面的影片一起從 B 站消失且不可復原，而整理流程用不到它。
 * 真要刪就到 B 站自己的收藏夾管理頁，那裡有它自己的確認。
 */
export function FoldersPage({ mid }: { mid: number }) {
  const m = useMessages();
  const folders = useAppStore((s) => s.folders);
  const foldersLoading = useAppStore((s) => s.foldersLoading);
  const loadFolders = useAppStore((s) => s.loadFolders);
  const descriptions = useAppStore((s) => s.descriptions);
  const setDescription = useAppStore((s) => s.setDescription);
  const setDescriptions = useAppStore((s) => s.setDescriptions);
  const settings = useAppStore((s) => s.settings);

  const [picked, setPicked] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [facet, setFacet] = useState<Facet>('all');
  // 生成與匯入的結果都先當草稿，按「採用」才寫進去：它們不該直接蓋掉使用者自己寫的東西
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [useCurrent, setUseCurrent] = useState(true);
  const [note, setNote] = useState<Note | null>(null);
  const [running, setRunning] = useState<{ label: string; done: number; total: number; now: string } | null>(null);
  const [form, setForm] = useState({ title: '', intro: '', isPrivate: true });
  const abort = useRef<AbortController | null>(null);

  const chosen = folders.filter((f) => picked.includes(f.id));
  const draftIds = Object.keys(drafts);
  const aiReady = planOf(settings).aiReady;
  const busy = running !== null;

  const descOf = (f: FolderMeta) => (descriptions[String(f.id)] ?? '').trim();
  const usesBiliIntro = (f: FolderMeta) => descOf(f) === '' && effectiveDescription(f, descriptions) !== '';

  const counts = {
    all: folders.length,
    missing: folders.filter((f) => effectiveDescription(f, descriptions) === '').length,
    fromBili: folders.filter(usesBiliIntro).length,
    draft: draftIds.length,
    private: folders.filter((f) => f.isPrivate).length,
  };
  const covered = folders.length - counts.missing;

  const matchFacet = (f: FolderMeta) => {
    switch (facet) {
      case 'missing':
        return effectiveDescription(f, descriptions) === '';
      case 'fromBili':
        return usesBiliIntro(f);
      case 'draft':
        return drafts[String(f.id)] !== undefined;
      case 'private':
        return f.isPrivate;
      default:
        return true;
    }
  };

  const q = query.trim().toLowerCase();
  // 勾起來的一律顯示，免得篩選之後看不到自己選了什麼
  const shown = folders.filter((f) => picked.includes(f.id) || (matchFacet(f) && f.title.toLowerCase().includes(q)));

  /** 逐個跑批次操作：讀取與寫入都要經過各自的節流器，所以一定是串行 */
  async function runBatch(label: string, items: FolderMeta[], step: (f: FolderMeta, signal: AbortSignal) => Promise<void>) {
    const ctrl = new AbortController();
    abort.current = ctrl;
    setNote(null);
    const failed: string[] = [];
    try {
      for (const [i, f] of items.entries()) {
        if (ctrl.signal.aborted) break;
        setRunning({ label, done: i, total: items.length, now: f.title });
        try {
          await step(f, ctrl.signal);
        } catch (e) {
          if (ctrl.signal.aborted) break;
          failed.push(m.folders.itemFailed(f.title, toAppError(e).message));
        }
      }
    } finally {
      abort.current = null;
      setRunning(null);
    }
    if (ctrl.signal.aborted) setNote({ kind: 'warn', text: m.folders.cancelledNote(label) });
    else if (failed.length > 0) setNote({ kind: 'error', text: m.folders.someFailedNote(label, failed) });
    else
      setNote({ kind: 'ok', text: items.length > 1 ? m.folders.doneNoteMulti(label, items.length) : m.folders.doneNote(label) });
  }

  const generateInto = async (f: FolderMeta, signal: AbortSignal) => {
    const r = await describeFolder(f, settings, {
      signal,
      ...(useCurrent && descOf(f) ? { current: descOf(f) } : {}),
    });
    if (!r.text) throw new Error(m.folders.noUsableVideosError(r.scanned));
    setDrafts((d) => ({ ...d, [String(f.id)]: r.text }));
  };

  const generate = (f: FolderMeta) => runBatch(m.folders.generateInto(f.title), [f], generateInto);
  const generateChosen = () => runBatch(m.folders.generateChosen, chosen, generateInto);

  /** B 站簡介也走草稿：使用者看得到要換成什麼，不必再多一個「覆蓋已填寫的」開關 */
  const importFromBili = () => {
    const patch: Record<string, string> = {};
    let same = 0;
    let empty = 0;
    for (const f of chosen) {
      const intro = (f.intro ?? '').trim();
      if (!intro) empty++;
      else if (intro === descOf(f)) same++;
      else patch[String(f.id)] = intro;
    }
    const n = Object.keys(patch).length;
    setDrafts((d) => ({ ...d, ...patch }));
    setNote({ kind: n > 0 ? 'ok' : 'warn', text: m.folders.importSummary(n, same, empty) });
  };

  const adoptDrafts = async () => {
    await setDescriptions(drafts);
    setNote({ kind: 'ok', text: m.folders.adoptedDrafts(draftIds.length) });
    setDrafts({});
  };

  /**
   * 把本機描述寫回 B 站簡介；edit 必須帶完整欄位，少帶的會被清空。
   * 沒寫本機描述的夾子一律跳過：送空字串會把 B 站原本的簡介清掉（不可復原），
   * 而按這顆按鈕的意思是「把我寫的同步過去」，不是「把那邊清空」。
   */
  const syncToBili = async () => {
    const writable = chosen.filter((f) => descOf(f) !== '');
    const skipped = chosen.length - writable.length;
    if (writable.length === 0) {
      setNote({
        kind: 'warn',
        text: m.folders.noWritableDescriptions(chosen.length),
      });
      return;
    }
    await runBatch(m.folders.syncDescriptions, writable, async (f, signal) => {
      await writeQueue.run(() =>
        editFolder(
          f.id,
          {
            title: f.title,
            intro: descOf(f),
            ...(f.cover ? { cover: f.cover } : {}),
            isPrivate: f.isPrivate,
          },
          signal,
        ),
      );
    });
    if (skipped > 0) {
      setNote((n) => (n ? { ...n, text: `${n.text}${m.folders.skippedSync(skipped)}` } : n));
    }
    await loadFolders(mid);
  };

  const create = async () => {
    setNote(null);
    try {
      await writeQueue.run(() => addFolder({ title: form.title.trim(), intro: form.intro.trim(), isPrivate: form.isPrivate }));
      setForm({ title: '', intro: '', isPrivate: true });
      await loadFolders(mid);
      setNote({ kind: 'ok', text: m.folders.createDone });
    } catch (e) {
      setNote({ kind: 'error', text: m.folders.createFailed(toAppError(e).message) });
    }
  };

  const facets: { id: Facet; label: string; n: number; color?: string }[] = [
    { id: 'all', label: m.folders.facets.all, n: counts.all },
    { id: 'missing', label: m.folders.facets.missing, n: counts.missing, color: 'var(--bad)' },
    { id: 'fromBili', label: m.folders.facets.fromBili, n: counts.fromBili, color: 'var(--info)' },
    { id: 'draft', label: m.folders.facets.draft, n: counts.draft, color: 'var(--warn)' },
    { id: 'private', label: m.folders.facets.private, n: counts.private, color: '#4d5560' },
  ];

  return (
    <div className="page">
      <div className="work rail-center">
        <aside className="rail">
          <div className="rail-sec">
            <span className="lbl">{m.folders.descriptionCoverage}</span>
            <div className="read-row" style={{ borderBottom: 0 }}>
              <span>{m.folders.haveUsableDescription}</span>
              <span className="mono">
                <b>{covered}</b> / {folders.length}
              </span>
            </div>
            <div className="bar-meter">
              <div style={{ width: `${folders.length > 0 ? (100 * covered) / folders.length : 0}%` }} />
            </div>
            <p className="desc">{m.folders.coverageHint}</p>
          </div>

          <div className="rail-sec">
            <span className="lbl">{m.folders.filter}</span>
            <div className="facets">
              {facets.map((f) => (
                <button key={f.id} type="button" className={facet === f.id ? 'facet on' : 'facet'} onClick={() => setFacet(f.id)}>
                  {f.color && <span className="dot" style={{ background: f.color }} />}
                  <span className="name">{f.label}</span>
                  <span className="n">{f.n}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rail-sec grow">
            <span className="lbl">{m.folders.howToWrite}</span>
            <p className="desc">{m.folders.howToWriteP1}</p>
            <p className="desc" style={{ marginTop: 10 }}>
              {m.folders.howToWriteP2}
            </p>
            <p className="desc" style={{ marginTop: 10 }}>
              {m.folders.howToWriteP3}
            </p>
          </div>
        </aside>

        <main className="center">
          <div className="c-head">
            <div className="c-title">{m.folders.title}</div>
            <p className="desc">{m.folders.desc}</p>
          </div>

          <div className="c-tools">
            <label className="search" style={{ width: 210 }}>
              <IconSearch />
              <input
                type="text"
                aria-label={m.folders.searchFolders}
                placeholder={m.folders.searchFoldersPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <span className="mono muted">
              {m.folders.selectedPrefix}
              <b style={{ color: 'var(--ac-2)' }}>{picked.length}</b> / {folders.length}
              {m.folders.selectedSuffix}
            </span>
            <button type="button" className="btn" disabled={busy} onClick={() => setPicked(folders.map((f) => f.id))}>
              {m.folders.selectAll}
            </button>
            <button type="button" className="btn" disabled={busy || picked.length === 0} onClick={() => setPicked([])}>
              {m.folders.clear}
            </button>
            <button
              type="button"
              className="btn quiet spacer"
              disabled={busy || foldersLoading}
              onClick={() => void loadFolders(mid)}
            >
              <IconRefresh />
              {foldersLoading ? m.folders.reloading : m.folders.reload}
            </button>
          </div>

          <div className="c-body">
            {note && (
              <div className="c-pad" style={{ paddingBottom: 0 }}>
                <div className={note.kind === 'ok' ? 'banner ok' : note.kind === 'warn' ? 'banner warn' : 'banner error'}>
                  <span
                    className="dot"
                    style={{ background: note.kind === 'ok' ? 'var(--ok)' : note.kind === 'warn' ? 'var(--warn)' : 'var(--bad)' }}
                  />
                  <span>{note.text}</span>
                </div>
              </div>
            )}

            {draftIds.length > 0 && (
              <div className="c-pad" style={{ paddingBottom: 0 }}>
                <div className="banner warn">
                  <span className="dot" style={{ background: 'var(--warn)' }} />
                  <span>{m.folders.draftsPending(draftIds.length)}</span>
                  <span className="row tight spacer">
                    <button type="button" className="btn small" disabled={busy} onClick={() => void adoptDrafts()}>
                      {m.folders.acceptAll}
                    </button>
                    <button type="button" className="btn small" disabled={busy} onClick={() => setDrafts({})}>
                      {m.folders.discardAll}
                    </button>
                  </span>
                </div>
              </div>
            )}

            <table className="grid">
              <thead>
                <tr>
                  <th style={{ width: 44 }} />
                  <th style={{ width: 250 }}>{m.folders.folder}</th>
                  <th>{m.folders.descriptionHeader}</th>
                  <th style={{ width: 220 }}>{m.folders.bilibiliIntro}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((f) => {
                  const key = String(f.id);
                  const draft = drafts[key];
                  const now = busy && running?.now === f.title;
                  const current = descriptions[key] ?? '';
                  return (
                    <tr key={f.id} className={draft !== undefined ? 'draft' : picked.includes(f.id) ? 'picked' : undefined}>
                      <td className="vtop">
                        <input
                          type="checkbox"
                          aria-label={m.folders.checkCheckbox(f.title)}
                          checked={picked.includes(f.id)}
                          disabled={busy}
                          onChange={(e) =>
                            setPicked((ids) =>
                              e.target.checked ? [...new Set([...ids, f.id])] : ids.filter((id) => id !== f.id),
                            )
                          }
                        />
                      </td>
                      <td className="vtop">
                        <span className="fold">
                          <FolderCover folder={f} size="lg" />
                          <span className="folder-info">
                            <span className="folder-title">{f.title}</span>
                            <span className="folder-sub">
                              {m.run.videosUnit(f.mediaCount)}
                              {f.isPrivate && <span className="tag">{m.folders.private}</span>}
                              {f.isDefault && <span className="tag">{m.folders.default}</span>}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="vtop">
                        {draft === undefined ? (
                          <>
                            <textarea
                              aria-label={m.folders.descriptionAriaLabel(f.title)}
                              className="desc-field"
                              rows={1}
                              placeholder={m.folders.descPlaceholder}
                              value={current}
                              disabled={busy}
                              onChange={(e) => void setDescription(f.id, e.target.value)}
                            />
                            <div className="fmeta">
                              <span className="mono">{m.folders.charCount(current.length)}</span>
                              <button type="button" className="link" disabled={busy || !aiReady} onClick={() => void generate(f)}>
                                {now ? m.folders.generating : m.folders.generateWithAi}
                              </button>
                              {usesBiliIntro(f) && <span className="tag info">{m.folders.usesBiliIntroTag}</span>}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="draft-old">{current || m.folders.noDescriptionOriginally}</div>
                            <IconArrowDown className="draft-arrow" />
                            <textarea
                              aria-label={m.folders.descriptionDraftAriaLabel(f.title)}
                              className="desc-field draft"
                              rows={1}
                              value={draft}
                              disabled={busy}
                              onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                            />
                            <div className="fmeta">
                              <span className="tag warn">{m.folders.aiDraftTag}</span>
                              <span className="mono">{m.folders.charCount(draft.length)}</span>
                              <button
                                type="button"
                                className="btn small"
                                disabled={busy}
                                onClick={() => {
                                  void setDescription(f.id, draft);
                                  setDrafts(({ [key]: _drop, ...rest }) => rest);
                                }}
                              >
                                {m.folders.accept}
                              </button>
                              <button type="button" className="btn small" disabled={busy} onClick={() => void generate(f)}>
                                {now ? m.folders.generating : m.folders.regenerate}
                              </button>
                              <button
                                type="button"
                                className="btn small"
                                disabled={busy}
                                onClick={() => setDrafts(({ [key]: _drop, ...rest }) => rest)}
                              >
                                {m.folders.discard}
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                      <td className="vtop dim">{(f.intro ?? '').trim() || m.folders.emptyBilibiliIntro}</td>
                    </tr>
                  );
                })}

                {/* 新增收藏夾就是表格的最後一列：它是這一頁的東西，不必另開一段 */}
                <tr className="add-row">
                  <td>
                    <span className="folder-cover placeholder" style={{ width: 22, height: 22 }}>
                      <IconPlus size={13} />
                    </span>
                  </td>
                  <td>
                    <input
                      type="text"
                      aria-label={m.folders.newFolderNamePlaceholder}
                      placeholder={m.folders.newFolderNamePlaceholder}
                      style={{ width: '100%' }}
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      aria-label={m.folders.newFolderIntroPlaceholder}
                      placeholder={m.folders.newFolderIntroPlaceholder}
                      style={{ width: '100%' }}
                      value={form.intro}
                      onChange={(e) => setForm({ ...form, intro: e.target.value })}
                    />
                  </td>
                  <td>
                    <span className="row tight">
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={form.isPrivate}
                          onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })}
                        />
                        {m.folders.private2}
                      </label>
                      <button type="button" className="btn" disabled={busy || !form.title.trim()} onClick={() => void create()}>
                        {m.folders.create}
                      </button>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </main>
      </div>

      <footer className="runbar">
        {running ? (
          <>
            <span className="row tight">
              <span className="spin" />
              <b style={{ fontWeight: 600 }}>{running.label}</b>
              <span className="muted">{running.now}</span>
              <span className="mono muted">
                {running.done + 1} / {running.total}
              </span>
            </span>
            <span className="read-inline">
              <span style={{ width: 180 }}>
                <span className="progress">
                  <div style={{ transform: `scaleX(${running.done / Math.max(1, running.total)})` }} />
                </span>
              </span>
              <button type="button" className="btn" onClick={() => abort.current?.abort()}>
                {m.folders.cancel}
              </button>
            </span>
          </>
        ) : chosen.length > 0 ? (
          <>
            <span>
              {m.folders.selectedPrefix}
              <b className="num" style={{ color: 'var(--ac-2)' }}>
                {chosen.length}
              </b>
              {m.folders.selectedFoldersSuffix(chosen.length)}
            </span>
            <span className="sep" />
            <button type="button" className="btn primary" disabled={!aiReady} onClick={() => void generateChosen()}>
              <IconSparkle />
              {m.folders.generateDescriptions}
            </button>
            <label className="check">
              <input type="checkbox" checked={useCurrent} onChange={(e) => setUseCurrent(e.target.checked)} />
              {m.folders.useCurrentDescription}
            </label>
            <span className="sep" />
            <button type="button" className="btn" onClick={importFromBili}>
              {m.folders.importFromBili}
            </button>
            <button type="button" className="btn" onClick={() => void syncToBili()}>
              {m.folders.syncToBili}
            </button>
            <span className="why spacer">{m.folders.footerWhy}</span>
          </>
        ) : (
          <span className="why">{m.folders.footerEmpty}</span>
        )}
      </footer>
    </div>
  );
}
