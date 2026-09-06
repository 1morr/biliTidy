// 影片頁「智慧收藏」的 UI 預覽：假影片頁 ＋ 攔截 B 站與 AI 的請求，截圖 toast 到 .output/ui/。
// 走的是 build 後的 content script 與 service worker，只有網路是假的（不需登入、碰不到真實帳號）。
// 用法：npm run build && npm run quickfav-preview
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const ext = path.resolve('.output/chrome-mv3');
const profile = path.resolve('.quickfav-profile');
const out = path.resolve('.output/ui');
mkdirSync(out, { recursive: true });

const MID = 12345;
const BVID = 'BV1demo0001';
/** AI 會建議收進「二创」與「Ai」，用來看「一個夾一張卡」的堆疊 */
const folders = [
  ['默认收藏夹', 1785, 0, ''],
  ['Ai', 412, 1, 'AI 相關的教學、發布會與工具介紹'],
  ['二创', 233, 1, '各種二次創作、鬼畜與剪輯'],
  ['Windows', 821, 1, '電腦軟體、技術、科技相關'],
  ['Music', 978, 1, '音樂相關'],
  ['追番', 793, 1, ''],
].map(([title, media_count, attr, intro], i) => ({
  id: 1000 + i,
  fid: i,
  mid: MID,
  attr,
  title,
  cover: `https://i0.hdslb.com/bfs/archive/cover${i}.jpg`,
  intro,
  media_count,
}));

const toolbarItem = (cls, label) =>
  `<div class="toolbar-left-item-wrap"><div class="${cls} video-toolbar-left-item">${label}</div></div>`;

/** 只保留 content script 會碰到的結構：工具列容器與四個原生項目 */
const videoPage = (dark) => `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><title>預覽影片頁</title><style>
  body { margin: 0; font: 14px/1.6 sans-serif; background: ${dark ? '#17181a' : '#f6f7f8'}; color: ${dark ? '#e3e5e7' : '#18191c'}; }
  .player { height: 320px; margin: 16px; border-radius: 8px; background: ${dark ? '#0b0b0c' : '#dfe2e5'}; }
  .video-toolbar-container { margin: 0 16px; }
  .video-toolbar-left-main { display: flex; align-items: center; }
  .toolbar-left-item-wrap { margin-right: 18px; }
  .video-toolbar-left-item { display: flex; align-items: center; gap: 6px; cursor: pointer; }
  /* B 站的「已收藏」就是 .video-fav 上的 on class，照著模擬才看得出按鈕有沒有被切亮 */
  .video-fav.on { color: #0087bd; }
</style></head>
<body>
  <div class="player"></div>
  <div class="video-toolbar-container"><div class="video-toolbar-left"><div class="video-toolbar-left-main">
    ${toolbarItem('video-like', '👍 點讚')}
    ${toolbarItem('video-coin', '🪙 投幣')}
    ${toolbarItem('video-fav', '⭐ 收藏')}
    ${toolbarItem('video-share', '↗ 分享')}
  </div></div></div>
</body></html>`;

const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 900, height: 620 },
  deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});

await context.route(/www\.bilibili\.com\/video\//, (route) =>
  route.fulfill({ contentType: 'text/html; charset=utf-8', body: videoPage(route.request().url().includes('dark')) }),
);

// 收藏夾封面：每個夾給不同顏色，才看得出縮圖是各自的
await context.route(/i0\.hdslb\.com\/bfs\/archive\/cover(\d+)/, (route) => {
  const i = Number(/cover(\d+)/.exec(route.request().url())?.[1] ?? 0);
  const hue = (i * 61) % 360;
  route.fulfill({
    contentType: 'image/svg+xml',
    body: `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88"><rect width="88" height="88" fill="hsl(${hue} 62% 58%)"/><circle cx="62" cy="26" r="16" fill="hsl(${hue} 62% 74%)"/></svg>`,
  });
});

await context.route(/api\.bilibili\.com\/x\/web-interface\/nav/, (route) =>
  route.fulfill({
    json: {
      code: 0,
      data: {
        isLogin: true,
        mid: MID,
        uname: '測試帳號',
        wbi_img: {
          img_url: 'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',
          sub_url: 'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png',
        },
      },
    },
  }),
);

await context.route(/api\.bilibili\.com\/x\/web-interface\/wbi\/view\/detail/, (route) =>
  route.fulfill({
    json: {
      code: 0,
      data: {
        View: {
          bvid: BVID,
          aid: 900001,
          title: '【AI二创】用 Opus 5 重寫了一遍片頭曲',
          tid: 27,
          cid: 1,
          pages: [{ cid: 1, part: '正片' }],
          ugc_season: { id: 1, title: 'AI二创', ep_count: 12, sections: [{ episodes: [{ bvid: BVID, title: 'EP1' }] }] },
        },
        Tags: [{ tag_name: 'AI' }, { tag_name: '二创' }, { tag_name: '鬼畜' }],
      },
    },
  }),
);

// 影片頁專用：list-all 帶 fav_state 但沒有 cover，縮圖靠下面的 created/list 補
await context.route(/api\.bilibili\.com\/x\/v3\/fav\/folder\/created\/list-all/, (route) =>
  route.fulfill({
    json: {
      code: 0,
      data: { count: folders.length, list: folders.map(({ cover, intro, ...f }) => ({ ...f, fav_state: 0 })) },
    },
  }),
);
await context.route(/api\.bilibili\.com\/x\/v3\/fav\/folder\/created\/list\?/, (route) =>
  route.fulfill({ json: { code: 0, data: { list: folders, has_more: false, count: folders.length } } }),
);

// AI 端點：借用已有 host_permissions 的網域，省掉 optional permission 的互動
await context.route(/api\.bilibili\.com\/mockai\/v1\/chat\/completions/, (route) =>
  route.fulfill({
    json: {
      choices: [
        {
          message: {
            content: JSON.stringify({
              results: [
                {
                  bvid: BVID,
                  // 短號：模型拿到的是 1..N 的編號（1=默认收藏夹、2=Ai、3=二创…），不是 media_id
                  target_folder_ids: [3, 2],
                  basis: ['合集', '標籤'],
                  reason: '合集《AI二创》',
                  confidence: 'high',
                },
              ],
            }),
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 1464, completion_tokens: 57 },
    },
  }),
);

// 寫入不真的打出去；success_num 故意回 0，順便守住「成功與否只看 code」這條
const writes = [];
await context.route(/api\.bilibili\.com\/x\/v3\/fav\/resource\/deal/, (route) => {
  const form = new URLSearchParams(route.request().postData() ?? '');
  writes.push(`deal add=${form.get('add_media_ids') ?? '-'} del=${form.get('del_media_ids') ?? '-'}`);
  route.fulfill({ json: { code: 0, message: '0', ttl: 1, data: { prompt: false, success_num: 0 } } });
});

await context.addCookies([
  { name: 'bili_jct', value: 'preview-csrf', domain: '.bilibili.com', path: '/' },
  { name: 'DedeUserID', value: String(MID), domain: '.bilibili.com', path: '/' },
]);

let sw = context.serviceWorkers()[0];
if (!sw) sw = await context.waitForEvent('serviceworker');
await sw.evaluate(() => chrome.storage.local.clear());
await sw.evaluate(() =>
  chrome.storage.local.set({
    settings: { ai: { baseUrl: 'https://api.bilibili.com/mockai/v1', apiKey: 'preview', model: 'mock-model' } },
  }),
);

const errors = [];
const shots = [];

async function shoot(name, theme, after) {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  await page.goto(`https://www.bilibili.com/video/${BVID}/${theme === 'dark' ? '?theme=dark' : ''}`);
  // content script 等 window load ＋ MOUNT_DELAY_MS 才掛按鈕
  await page.waitForSelector('#bilitidy-quick-fav', { timeout: 20000 });
  await page.click('#bilitidy-quick-fav');
  await page.waitForSelector('#bilitidy-toast-host .card .title', { timeout: 20000 });
  if (after) await after(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  shots.push(`${name}.png`);
  await page.close();
}

// 收到兩個夾：兩張卡各自帶封面與「取消收藏」，理由與「重新選擇」只在第一張
await shoot('quickfav-saved', 'light', (page) => page.waitForSelector('#bilitidy-toast-host .card:nth-child(2)'));
await shoot('quickfav-saved-dark', 'dark', (page) => page.waitForSelector('#bilitidy-toast-host .card:nth-child(2)'));
// 「重新選擇」會收掉成功卡，換成挑選器
await shoot('quickfav-picker', 'light', async (page) => {
  await page.getByRole('button', { name: 'Change selection' }).click();
  await page.waitForSelector('#bilitidy-toast-host input');
});

// 原生收藏按鈕要跟著切：收完亮起來、全部取消後熄掉
{
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`native-fav: ${e.message}`));
  await page.goto(`https://www.bilibili.com/video/${BVID}/`);
  await page.waitForSelector('#bilitidy-quick-fav', { timeout: 20000 });
  await page.click('#bilitidy-quick-fav');
  await page.waitForSelector('#bilitidy-toast-host .card:nth-child(2)', { timeout: 20000 });
  const onCount = () => page.locator('.video-fav.on').count();
  const undo = async () => {
    const btns = page.getByRole('button', { name: 'Undo save' });
    const before = await btns.count();
    await btns.first().click();
    // 等這張卡改寫成「已移出…」再動下一張，不然會重複點到同一顆
    for (let w = 0; w < 30 && (await btns.count()) >= before; w++) await page.waitForTimeout(100);
  };
  const afterSave = await onCount();
  await undo();
  const afterFirst = await onCount();
  await undo();
  const afterBoth = await onCount();
  console.log(
    `native-fav: 收藏後 on=${afterSave}、移出一個夾後 on=${afterFirst}、兩個都移出後 on=${afterBoth}（應為 1 / 1 / 0）`,
  );
  if (afterSave !== 1 || afterFirst !== 1 || afterBoth !== 0) errors.push('native-fav: 原生收藏按鈕沒有跟著切狀態');
  await page.close();
}

// 自動消失與 hover 暫停：舊版的 toast 會一直留在畫面上，這裡守住它會自己走
{
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`auto-close: ${e.message}`));
  await page.goto(`https://www.bilibili.com/video/${BVID}/`);
  await page.waitForSelector('#bilitidy-quick-fav', { timeout: 20000 });
  await page.click('#bilitidy-quick-fav');
  await page.waitForSelector('#bilitidy-toast-host .card', { timeout: 20000 });
  // 滑鼠壓在第一張卡上：它要留著，沒被 hover 的第二張該自己收掉
  await page.hover('#bilitidy-toast-host .card');
  await page.waitForTimeout(12000);
  const hovered = await page.locator('#bilitidy-toast-host .card').count();
  await page.mouse.move(5, 5);
  let closed = true;
  try {
    await page.waitForSelector('#bilitidy-toast-host', { state: 'detached', timeout: 15000 });
  } catch {
    closed = false;
  }
  console.log(`auto-close: hover 期間留下 ${hovered} 張（應為 1）、移開後收掉 = ${closed}`);
  if (hovered !== 1 || !closed) errors.push('auto-close: 自動消失或 hover 暫停沒有照預期');
  await page.close();
}

console.log('writes:', writes.join(' | '));
console.log('screenshots:', shots.join(', '), '→', out);
if (errors.length) {
  console.log('ERRORS:');
  for (const e of errors) console.log('  ' + e);
}
await context.close();
process.exit(errors.length ? 1 : 0);
