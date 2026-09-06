import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import type { QuickFavMessage, QuickFavResponseMap, QuickFavResult } from '@/core/messages';
import type { QuickFavFolder, QuickFavSuggestion } from '@/core/quickFav';
import { initLanguage, t, watchLanguage } from '@/i18n';

/**
 * 影片頁的「智慧收藏」按鈕。
 *
 * 接在原生工具列**後面**而不是取代收藏：B 站前端一改版，取代的做法連原生收藏都會壞掉，
 * 放旁邊最壞情況只是這顆按鈕不見。所有請求都由 service worker 代打（見 core/messages.ts）。
 *
 * DOM 依實測（2026-08）：`.video-toolbar-left-main` 底下每個功能是一個 `.toolbar-left-item-wrap`，
 * 收藏是其中的 `.video-fav.video-toolbar-left-item`，圖示與文字分別是
 * `.video-toolbar-item-icon` 與 `.video-toolbar-item-text`。
 */
const TOOLBAR = '.video-toolbar-left-main';
const FAV_ITEM = '.video-fav';
const BUTTON_ID = 'bilitidy-quick-fav';
const TOAST_ID = 'bilitidy-toast-host';
/** 重新掛按鈕的輪詢間隔；換片後工具列本來就要時間重畫，1 秒內補上足夠 */
const MOUNT_POLL_MS = 1000;
/** window load 之後再等這麼久才掛按鈕，讓 B 站前端先把工具列跑完（見 mount 的註解） */
const MOUNT_DELAY_MS = 2000;
/** 收藏成功的卡片存活時間，也就是還能按「取消收藏」的時間；搬移不可逆，撤銷要留夠久 */
const TOAST_MS = 10_000;
/** 「已移出…」這類收尾訊息不用留那麼久 */
const DONE_MS = 4000;
/** 卡片淡出動畫的長度，與 CSS 的 .leaving transition 對齊 */
const LEAVE_MS = 180;

/** AI 建議過的收藏夾在挑選器上帶的星號；畫出來而不用 emoji，才跟旁邊的文字一樣大、一樣色 */
const STAR_ICON = `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 2.1 9.4 5.6 12.9 7 9.4 8.4 8 11.9 6.6 8.4 3.1 7 6.6 5.6z"/></svg>`;

const CLOSE_ICON = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>`;

const SPARKLE = `<svg width="26" height="26" viewBox="0 0 24 24" class="video-toolbar-item-icon" aria-hidden="true"><path fill="currentColor" d="M12 2.6l1.9 4.9 4.9 1.9-4.9 1.9L12 16.2l-1.9-4.9L5.2 9.4l4.9-1.9L12 2.6zM18.6 14.4l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3zM5.4 15.1l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z"/></svg>`;

function currentBvid(): string | null {
  return /\/video\/(BV[0-9A-Za-z]+)/.exec(location.pathname)?.[1] ?? null;
}

async function send<K extends QuickFavMessage['type']>(
  message: Extract<QuickFavMessage, { type: K }>,
): Promise<QuickFavResult<QuickFavResponseMap[K]>> {
  try {
    return (await browser.runtime.sendMessage(message)) as QuickFavResult<QuickFavResponseMap[K]>;
  } catch (e) {
    // SW 被回收或擴充功能剛更新時 sendMessage 會直接 reject
    return { ok: false, kind: 'network', message: t().quickFav.connectionFailed(e instanceof Error ? e.message : String(e)) };
  }
}

// ---- toast ----

/**
 * 收藏成功時每個收藏夾各一張卡，堆在右下角。分開的理由：一次收進兩三個夾時，
 * 「已收藏到《A》、《B》」擠成一行看不出各自是什麼，一張卡一個夾才配得上封面縮圖。
 */
interface Card {
  render: (nodes: (Node | string)[]) => void;
  close: () => void;
  /** 開始倒數自動關閉；滑鼠移上去會暫停，移開再續 */
  autoClose: (ms: number) => void;
}

const TOAST_CSS = `
:host { all: initial; }
.stack {
  position: fixed; right: 24px; bottom: 24px; z-index: 2147483000;
  display: flex; flex-direction: column; align-items: stretch; gap: 10px;
  font: 13px/1.5 system-ui, -apple-system, "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif;
}
/*
 * 卡片留在淺色：它長在 B 站自己的頁面上，不能把整個頁面拖進深色。
 * 跟 App 分頁共用的是幾何（4px 圓角的控制項）、重點色、畫出來的圖示與等寬數字。
 */
.card {
  width: 330px; box-sizing: border-box; border-radius: 6px; overflow: hidden;
  text-wrap: pretty;
  background: #fff; color: #18191c; border: 1px solid #e3e5e7;
  box-shadow: 0 1px 2px rgba(20,24,28,.08), 0 10px 24px -10px rgba(20,24,28,.28);
  animation: bilitidy-in .18s ease-out;
}
.card.leaving { opacity: 0; transform: translateY(6px); transition: opacity .16s, transform .16s; }
@keyframes bilitidy-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.body { padding: 12px 12px 11px; }
.head { display: flex; gap: 11px; align-items: flex-start; }
.thumb {
  width: 44px; height: 44px; flex: none; border-radius: 4px; object-fit: cover;
  background: #f1f2f3; color: #9499a0; font-size: 17px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.text { flex: 1; min-width: 0; }
.title { font-weight: 600; font-size: 13px; line-height: 1.35; }
.muted { color: #61666d; font-size: 11.5px; margin-top: 4px; line-height: 1.45; }
.mono { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-variant-numeric: tabular-nums; }
.err { color: #d0453c; }
.row { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
button {
  font: inherit; font-size: 12px; cursor: pointer; border-radius: 4px; height: 26px; padding: 0 11px;
  border: 1px solid #ccd0d4; background: #fff; color: #61666d;
  display: inline-flex; align-items: center; gap: 5px;
}
button:hover { border-color: #9499a0; color: #18191c; }
button.primary { background: #fb7299; border-color: #fb7299; color: #fff; font-weight: 600; }
button.primary:hover { background: #d94f7a; border-color: #d94f7a; }
button.on { background: #fff0f5; border-color: #f7b6cb; color: #d94f7a; font-weight: 600; }
button.close {
  flex: none; margin-left: auto; border: none; background: none; color: #9499a0;
  height: 20px; padding: 0 2px;
}
button.close:hover { color: #61666d; background: none; }
input {
  font: inherit; font-size: 12px; width: 100%; box-sizing: border-box; margin-top: 10px;
  height: 30px; padding: 0 10px; border: 1px solid #ccd0d4; border-radius: 4px; color: #18191c;
}
input:focus { outline: none; border-color: #fb7299; box-shadow: 0 0 0 3px rgba(251,114,153,.18); }
.list { max-height: 190px; overflow: auto; display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
/* 自動關閉的倒數條：讓「取消收藏」還剩多久看得見；滑鼠停在卡片上時與計時器一起暫停 */
.bar { height: 2px; background: #fb7299; animation: bilitidy-countdown linear forwards; }
.card:hover .bar { animation-play-state: paused; }
@keyframes bilitidy-countdown { from { width: 100%; } to { width: 0%; } }

/* B 站有自己的深色模式（html.night-mode），跟著頁面底色走而不是跟著系統 */
.stack.dark .card { background: #18191c; color: #e3e5e7; border-color: #2f3134; }
.stack.dark .muted { color: #9499a0; }
.stack.dark .thumb { background: #101114; color: #61666d; }
.stack.dark button { background: transparent; border-color: #3f4245; color: #c5c9ce; }
.stack.dark button:hover { border-color: #61666d; color: #e3e5e7; }
.stack.dark button.primary { background: #fb7299; border-color: #fb7299; color: #fff; }
.stack.dark button.on { background: #3a2530; border-color: #fb7299; color: #fb7299; }
.stack.dark button.close { border: none; background: none; }
.stack.dark input { background: #101114; border-color: #3f4245; color: #e3e5e7; }
`;

/** 頁面底色偏暗就用深色 toast；B 站的深色模式與系統設定無關，所以量實際底色 */
function pageIsDark(): boolean {
  for (const node of [document.body, document.documentElement]) {
    const rgb = /(\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(node).backgroundColor);
    if (!rgb) continue;
    const [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    return 0.299 * r + 0.587 * g + 0.114 * b < 128;
  }
  return false;
}

const cards = new Map<string, HTMLElement>();

function stack(): HTMLElement {
  let host = document.getElementById(TOAST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = TOAST_ID;
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = TOAST_CSS;
    const box = document.createElement('div');
    box.className = pageIsDark() ? 'stack dark' : 'stack';
    shadow.append(style, box);
  }
  return host.shadowRoot?.querySelector('.stack') as HTMLElement;
}

/** 同一個 key 拿到同一張卡（重新 render 而不是再開一張）；最後一張關掉時連 host 一起收掉 */
function card(key: string): Card {
  const parent = stack();
  let existing = cards.get(key);
  if (!existing?.isConnected) {
    existing = el('div', { className: 'card' });
    parent.append(existing);
    cards.set(key, existing);
  }
  const node = existing;
  let timer = 0;
  const close = () => {
    window.clearTimeout(timer);
    if (cards.get(key) === node) cards.delete(key);
    if (!node.isConnected) return;
    node.classList.add('leaving');
    window.setTimeout(() => {
      node.remove();
      if (parent.childElementCount === 0) document.getElementById(TOAST_ID)?.remove();
    }, LEAVE_MS);
  };
  return {
    render(nodes) {
      window.clearTimeout(timer);
      node.onmouseenter = null;
      node.onmouseleave = null;
      // 內容包一層 .body，倒數條才能貼著卡片底緣通到兩側
      const body = el('div', { className: 'body' });
      body.append(...nodes.map((n) => (typeof n === 'string' ? document.createTextNode(n) : n)));
      node.replaceChildren(body);
    },
    close,
    autoClose(ms) {
      const bar = el('div', { className: 'bar' });
      node.append(bar);
      const arm = () => {
        timer = window.setTimeout(close, ms);
        // 計時器是整段重來的，倒數條也重播一次（清掉 animation 簡寫後要重設時間），兩者才不會對不上
        bar.style.animation = 'none';
        void bar.offsetWidth;
        bar.style.animation = '';
        bar.style.animationDuration = `${ms}ms`;
      };
      arm();
      // 使用者可能正在讀理由或考慮要不要取消，滑鼠停在上面就別收
      node.onmouseenter = () => window.clearTimeout(timer);
      node.onmouseleave = arm;
    },
  };
}

function closeAllCards(): void {
  for (const node of cards.values()) node.remove();
  cards.clear();
  document.getElementById(TOAST_ID)?.remove();
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

/** 收藏夾封面；沒有就退回夾名首字的色塊 */
function thumb(folder: QuickFavFolder): HTMLElement {
  if (folder.cover) {
    // B 站圖片 CDN 吃尺寸後綴，縮圖只要 88px，不必把整張封面拉下來
    const src = folder.cover.includes('@') ? folder.cover : `${folder.cover}@88w_88h_1c.webp`;
    return el('img', { className: 'thumb', src, alt: '' });
  }
  return el('div', { className: 'thumb' }, [folder.title.slice(0, 1)]);
}

function head(
  folder: QuickFavFolder | null,
  titleText: string,
  sub: string | null,
  onClose: () => void,
  isError = false,
): HTMLElement {
  const text = el('div', { className: 'text' }, [el('div', { className: isError ? 'title err' : 'title' }, [titleText])]);
  if (sub) text.append(el('div', { className: 'muted' }, [sub]));
  const nodes: (Node | string)[] = [];
  if (folder) nodes.push(thumb(folder));
  const closeBtn = el('button', { className: 'close', title: t().quickFav.close, onclick: onClose });
  closeBtn.setAttribute('aria-label', t().quickFav.close);
  closeBtn.innerHTML = CLOSE_ICON;
  nodes.push(text, closeBtn);
  return el('div', { className: 'head' }, nodes);
}

/** 錯誤卡不自動關：訊息要看得到，也要留著重試的機會 */
function showError(c: Card, titleText: string, message: string, retry: () => void): void {
  c.render([
    head(null, titleText, message, c.close, true),
    el('div', { className: 'row' }, [el('button', { className: 'primary', onclick: retry }, [t().quickFav.retry])]),
  ]);
}

function folderOf(s: QuickFavSuggestion, id: number): QuickFavFolder {
  return s.folders.find((f) => f.id === id) ?? { id, title: String(id), favState: true };
}

function titleOf(s: QuickFavSuggestion, id: number): string {
  return folderOf(s, id).title;
}

// ---- 流程 ----

let running = false;

async function run(): Promise<void> {
  const bvid = currentBvid();
  if (!bvid || running) return;
  running = true;
  const c = card('main');
  // 關掉「分析中」的卡片＝放棄這次收藏：結果回來也不寫入。
  // （SW 那邊的請求沒辦法從這裡中斷，但至少不會在使用者關掉卡片之後又自己收藏起來。）
  let dropped = false;
  c.render([
    head(null, t().quickFav.analysing, t().quickFav.analysingSub, () => {
      dropped = true;
      c.close();
    }),
  ]);
  try {
    const res = await send({ type: 'quickFav:suggest', bvid });
    if (dropped) return;
    if (!res.ok) {
      showError(c, t().quickFav.failedTitle, res.message, () => void run());
      return;
    }
    const s = res.data;
    // 低信心或沒有合適的夾就不自動寫入：收藏本身可以撤銷，但先問過比較有禮貌
    if (s.suggested.length === 0 || s.lowConfidence) showPicker(s);
    else void saveAndShow(c, s, s.suggested);
  } finally {
    running = false;
  }
}

/**
 * 讓原生收藏按鈕跟著我們的寫入變狀態。B 站的「已收藏」就是 `.video-fav` 上的一個 `on`
 * class：圖示與數字都吃 `currentColor`，有 on 是藍色、沒有是灰色，兩種狀態的 SVG 完全
 * 一樣（實測 2026-08），所以切 class 就夠，不必換圖。
 * 數字刻意不動：那是總收藏數，差一筆不影響判讀，而且它會顯示成「1.5万」沒辦法可靠地加一。
 */
function syncNativeFav(favoured: boolean): void {
  document.querySelector(FAV_ITEM)?.classList.toggle('on', favoured);
}

function markAdded(s: QuickFavSuggestion, ids: number[]): void {
  for (const id of ids) {
    const f = s.folders.find((x) => x.id === id);
    if (f) f.favState = true;
  }
  s.alreadyIn = Array.from(new Set([...s.alreadyIn, ...ids]));
  syncNativeFav(s.alreadyIn.length > 0);
}

function markRemoved(s: QuickFavSuggestion, ids: number[]): void {
  for (const id of ids) {
    const f = s.folders.find((x) => x.id === id);
    if (f) f.favState = false;
  }
  s.alreadyIn = s.alreadyIn.filter((id) => !ids.includes(id));
  syncNativeFav(s.alreadyIn.length > 0);
}

async function saveAndShow(c: Card, s: QuickFavSuggestion, addIds: number[]): Promise<void> {
  const res = await send({ type: 'quickFav:apply', aid: s.aid, addIds, delIds: [] });
  if (!res.ok) {
    showError(c, t().quickFav.saveFailedTitle, res.message, () => void saveAndShow(c, s, addIds));
    return;
  }
  markAdded(s, addIds);
  c.close();
  showSaved(s, addIds);
}

function reasonText(s: QuickFavSuggestion): string {
  return s.reason + (s.basis?.length ? t().quickFav.basisSuffix(s.basis) : '');
}

/** 收到的每個夾各一張卡；理由與「重新選擇」只掛在第一張，不必每張重複 */
function showSaved(s: QuickFavSuggestion, addIds: number[]): void {
  addIds.forEach((id, i) => renderSaved(card(`fav:${id}`), s, id, i === 0));
}

function renderSaved(c: Card, s: QuickFavSuggestion, id: number, primary: boolean): void {
  const folder = folderOf(s, id);
  const row = el('div', { className: 'row' }, [el('button', { onclick: () => void undoOne(c, s, id) }, [t().quickFav.undoSave])]);
  if (primary) row.append(el('button', { onclick: () => showPicker(s) }, [t().quickFav.changeSelection]));
  c.render([head(folder, t().quickFav.savedTo(folder.title), primary ? reasonText(s) : null, c.close), row]);
  c.autoClose(TOAST_MS);
}

async function undoOne(c: Card, s: QuickFavSuggestion, id: number): Promise<void> {
  const res = await send({ type: 'quickFav:apply', aid: s.aid, addIds: [], delIds: [id] });
  if (!res.ok) {
    showError(c, t().quickFav.removeFailedTitle, res.message, () => void undoOne(c, s, id));
    return;
  }
  markRemoved(s, [id]);
  const folder = folderOf(s, id);
  c.render([head(folder, t().quickFav.removedFrom(folder.title), null, c.close)]);
  c.autoClose(DONE_MS);
}

/** 手動挑收藏夾；已經在裡面的夾標成選取狀態，取消勾選＝移出 */
function showPicker(s: QuickFavSuggestion): void {
  closeAllCards();
  const c = card('main');
  const chosen = new Set<number>(s.alreadyIn);
  const search = el('input', { type: 'text', placeholder: t().quickFav.searchFoldersPlaceholder });
  const list = el('div', { className: 'list' });

  // AI 建議的與已經收藏的排最前面：收藏夾多的時候（實測 37 個），帶星號的可能要捲好幾行才看得到。
  // 順序只算一次，不跟著勾選變動——按下去的按鈕自己跑掉是最難用的互動。
  const rank = (f: QuickFavFolder) => (s.suggested.includes(f.id) ? 0 : s.alreadyIn.includes(f.id) ? 1 : 2);
  const ordered = s.folders.slice().sort((a, b) => rank(a) - rank(b));
  const paint = () => {
    const q = search.value.trim().toLowerCase();
    list.replaceChildren(
      ...ordered
        .filter((f) => f.title.toLowerCase().includes(q))
        .map((f) => {
          const on = chosen.has(f.id);
          const suggested = s.suggested.includes(f.id);
          const b = el('button', { className: on ? 'on' : '' });
          if (suggested) b.innerHTML = STAR_ICON;
          b.append(f.title);
          b.onclick = () => {
            if (chosen.has(f.id)) chosen.delete(f.id);
            else chosen.add(f.id);
            paint();
          };
          return b;
        }),
    );
  };
  search.oninput = paint;
  paint();

  const note =
    s.suggested.length === 0
      ? t().quickFav.noObviousMatch
      : s.lowConfidence
        ? t().quickFav.lowConfidenceReason(s.reason)
        : s.reason;
  c.render([
    head(null, s.title.slice(0, 40), note, c.close),
    search,
    list,
    el('div', { className: 'row' }, [
      el(
        'button',
        {
          className: 'primary',
          onclick: () => {
            const add = [...chosen].filter((id) => !s.alreadyIn.includes(id));
            const del = s.alreadyIn.filter((id) => !chosen.has(id));
            void applyPicked(c, s, add, del);
          },
        },
        [t().quickFav.apply],
      ),
    ]),
  ]);
}

async function applyPicked(c: Card, s: QuickFavSuggestion, addIds: number[], delIds: number[]): Promise<void> {
  if (addIds.length === 0 && delIds.length === 0) {
    c.close();
    return;
  }
  const res = await send({ type: 'quickFav:apply', aid: s.aid, addIds, delIds });
  if (!res.ok) {
    showError(c, t().quickFav.writeFailedTitle, res.message, () => void applyPicked(c, s, addIds, delIds));
    return;
  }
  markAdded(s, addIds);
  markRemoved(s, delIds);
  c.close();
  showSaved(s, addIds);
  if (delIds.length > 0) {
    const d = card('removed');
    const names = t().quickFav.folderNameList(delIds.map((id) => titleOf(s, id)));
    d.render([head(null, t().quickFav.removedMultiple(names), null, d.close)]);
    d.autoClose(DONE_MS);
  }
}

// ---- 掛上按鈕 ----

function mount(): void {
  if (document.getElementById(BUTTON_ID)) return;
  const toolbar = document.querySelector(TOOLBAR);
  if (!toolbar) return;
  const favWrap = toolbar.querySelector(FAV_ITEM)?.closest('.toolbar-left-item-wrap');

  const item = el('div', { className: 'video-toolbar-left-item', title: t().quickFav.buttonTitle });
  item.id = BUTTON_ID;
  item.style.cursor = 'pointer';
  item.innerHTML = `${SPARKLE}<span class="video-toolbar-item-text">${t().quickFav.buttonLabel}</span>`;
  item.addEventListener('click', () => void run());

  const wrap = el('div', { className: 'toolbar-left-item-wrap' }, [item]);
  // B 站用 Vue 的 scoped CSS（data-v-*）給工具列項目間距與 hover 樣式，複製過來就能長得一樣
  const scoped = favWrap ? [...favWrap.attributes].filter((a) => a.name.startsWith('data-v-')) : [];
  for (const a of scoped) {
    wrap.setAttribute(a.name, a.value);
    item.setAttribute(a.name, a.value);
  }
  if (scoped.length === 0) wrap.style.marginRight = '18px';

  // 只能接在工具列**最後面**：B 站前端會依子節點位置操作工具列（實測 2026-08），
  // 插到收藏按鈕中間會讓它抓到錯的節點而拋 TypeError（video.js 的 `n.setAttribute
  // is not a function`），整個影片頁的後續渲染就停在那裡 —— 右側推薦、UP 主頭像、
  // 右上角功能列全部不會出現。
  toolbar.append(wrap);
}

export default defineContentScript({
  matches: ['https://www.bilibili.com/video/*'],
  runAt: 'document_idle',
  main() {
    const start = () => {
      let lastBvid = currentBvid();
      mount();
      // 影片頁是 SPA，換片時整個工具列會被重畫；按鈕不見了就再掛一次。
      // 用輪詢而不是 MutationObserver：後者要監聽整棵樹才抓得到工具列重畫，
      // 而每秒一次 getElementById 的成本可以忽略。
      setInterval(() => {
        const bvid = currentBvid();
        if (bvid !== lastBvid) {
          lastBvid = bvid;
          // 上一支影片的卡片留在畫面上會對不上眼前的影片：按它的「取消收藏」動的是舊影片，
          // 但 syncNativeFav 會把**新**影片的原生收藏按鈕熄掉。換片就一律收掉。
          closeAllCards();
        }
        mount();
      }, MOUNT_POLL_MS);
    };
    // document_idle 時 B 站前端還在初始化工具列，這時插節點會打斷它（見 mount 的註解），
    // 所以等 load 之後再等一下才掛。語言偏好也要在掛按鈕前載入好，不然第一次畫出來的文字會是預設語言。
    const delayed = () => setTimeout(start, MOUNT_DELAY_MS);
    void initLanguage().then(() => {
      watchLanguage();
      if (document.readyState === 'complete') delayed();
      else window.addEventListener('load', delayed, { once: true });
    });
  },
});
