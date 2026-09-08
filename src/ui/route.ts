/**
 * 四個分頁與網址片段的對應：`app.html#/follows`。
 *
 * 為什麼要有網址：分頁本來是純 React state，不碰 `history`，於是滑鼠側鍵、`Alt+←`、
 * 觸控板兩指滑動都會把整個 App 帶走，而任務動輒跑二十分鐘。切分頁改成 `pushState` 之後，
 * 上一頁退回的是上一個分頁；每個分頁也各自有網址可以加書籤。
 *
 * 片段直接用分頁 id，不另外取一組對外名稱——同一個東西兩個名字，遲早會有一邊漂走。
 */
export const PAGES = ['run', 'folders', 'follows', 'settings'] as const;

export type Page = (typeof PAGES)[number];

const DEFAULT_PAGE: Page = 'run';

/** 認不得的片段（空的、`#/`、外面傳進來的怪東西）一律回預設分頁，不讓網址把畫面弄成空的 */
export function pageFromHash(hash: string): Page {
  const id = hash.replace(/^#\/?/, '');
  return (PAGES as readonly string[]).includes(id) ? (id as Page) : DEFAULT_PAGE;
}

export function hashOf(page: Page): string {
  return `#/${page}`;
}
