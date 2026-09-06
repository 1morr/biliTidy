// UI 預覽：攔截 B 站 API 與 AI 端點餵假資料，跑真的擴充功能程式碼，截圖到 .output/ui/（不需登入、不會碰到真實帳號）。
// 用法：npm run build && npm run ui-preview
//   UI_KEEP=1   測完不關瀏覽器（headed），可以自己點
// 四個分頁都走一遍：整理收藏（含收藏夾分頁、審核、搬移、撤銷）→ 關注（準備、執行中、審核、取關、撤銷、停下、查不到）
// → 設定三段 → 繁體中文。兩種任務互斥也順便驗：關注在跑的時候整理頁的主按鈕要變灰並寫出原因。
import { chromium } from 'playwright';
import path from 'node:path';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';

const ext = path.resolve('.output/chrome-mv3');
const profile = path.resolve('.ui-profile');
const out = path.resolve('.output/ui');
const review = path.resolve('.impeccable/review');
mkdirSync(out, { recursive: true });
mkdirSync(review, { recursive: true });
const png = readFileSync(path.join(ext, 'icon/128.png'));

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const DAY = 24 * 60 * 60;
const now = Math.floor(Date.now() / 1000);

// ---- 假資料：收藏夾 ----
const titles = [
  ['默认收藏夹', 2234, 1, ''],
  ['Windows', 784, 131, '电脑软件、技术、科技相关'],
  ['Music', 973, 2, '音乐相关'],
  ['繪畫 / 美圖', 312, 23, ''],
  ['遊戲實況', 145, 23, '各種遊戲實況與攻略'],
  ['科普 / 紀錄片', 88, 23, ''],
  ['料理', 42, 23, '做菜、烘焙'],
  ['貓', 17, 23, ''],
];
// 補到 39 個，貼近實際帳號的規模
while (titles.length < 39) titles.push([`收藏夾 ${titles.length + 1}`, (titles.length * 7) % 300, 23, '']);
const folders = titles.map(([title, media_count, attr, intro], i) => ({
  id: 1000 + i,
  fid: i,
  mid: 12345,
  attr,
  title,
  cover: `https://i0.hdslb.com/bfs/archive/cover${i}.jpg`,
  intro,
  media_count,
}));
const videos = [
  ['BV1demo0001', '【原神】4.2 深淵 36 星滿星攻略', '這期把上下半場的隊伍配置與換人時機都講一遍。', 725, 0],
  ['BV1demo0002', '摸魚', '', 62, 0],
  ['BV1demo0003', '已失效視頻', '', 0, 1],
  ['BV1demo0004', '【原神】胡桃 MMD 舞台', '', 210, 0],
];

// ---- 假資料：48 個關注，涵蓋每一種狀態 ----
const TAGS = [
  { tagid: -10, name: '特别关注', count: 3, tip: '' },
  { tagid: 0, name: '默认分组', count: 37, tip: '' },
  { tagid: 1001, name: '遊戲', count: 6, tip: '' },
  { tagid: 1002, name: '音樂', count: 4, tip: '' },
  { tagid: 1003, name: '料理', count: 2, tip: '' },
];
const NAMES = [
  '老番茄',
  '某幻君',
  '敬漢卿',
  '中国BOY超级大猩猩',
  '花少北',
  '罗翔说刑法',
  '徐大虾咯',
  '影视飓风',
  '硬核的半佛仙人',
  '何同学',
  '朱一旦的枯燥生活',
  '手工耿',
  '绵羊料理',
  '王刚',
  '泛式',
  'LexBurner',
  '凉风Kaze',
  '口袋的天空',
  '阿婆主小明',
  '一个已经不更新的UP',
  '搬砖日记',
  '深夜食堂番',
  '音游区萌新',
  '钢琴老师Momo',
  '猫咪日常',
  '数码小白',
  '读书笔记君',
  '考研上岸了',
  '摄影阿飞',
  '旅行的意义',
  '硬件茶谈',
  '木鱼水心',
  '痒局长',
  '芳斯塔芙',
  '毕导THU',
  '回形针PaperClip',
  '飞碟说',
  '观察者网',
  '央视网快看',
  '哔哩哔哩弹幕网',
  '游戏区已退坑',
  '绘画练习中',
  '翻唱搬运',
  'UP主已注销',
  '一年一更',
  '五年前的番剧解说',
  '健身打卡',
  '英语兔',
];
const follows = NAMES.map((name, i) => {
  const mid = 100000 + i * 37;
  const special = i % 16 === 3;
  const tag = i % 8 === 1 ? [1001] : i % 8 === 5 ? [1002] : i % 24 === 7 ? [1001, 1003] : special ? [-10] : null;
  const attribute = i % 6 === 4 ? 6 : 2;
  return {
    mid,
    attribute,
    mtime: now - (i * 47 + 30) * DAY,
    tag,
    special: special ? 1 : 0,
    uname: name,
    face: `https://i0.hdslb.com/bfs/face/${mid}.jpg`,
    sign: '',
    official_verify: i % 7 === 0 ? { type: 0, desc: `知识区优质UP主` } : { type: -1, desc: '' },
  };
});
const whispers = [
  {
    mid: 90001,
    attribute: 1,
    mtime: now - 900 * DAY,
    tag: null,
    special: 0,
    uname: '悄悄关注的画师',
    face: 'https://i0.hdslb.com/bfs/face/90001.jpg',
    sign: '',
    official_verify: { type: -1, desc: '' },
  },
];

/** 每個 mid 最新一支影片距今幾天；null＝沒有影片；'error'＝回非 0 code（查不到） */
function latestAgeOf(mid) {
  const i = (mid - 100000) / 37;
  if (mid === 90001) return 1300;
  if (i === 19 || i === 40) return null; // 完全沒有影片
  if (i === 43) return 'error'; // 已註銷：回 -404
  if (i % 5 === 0) return 3 + i; // 還在更新
  if (i % 3 === 0) return 120 + i * 2; // 幾個月
  return 400 + i * 21; // 安靜很久
}

const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: !process.env.UI_KEEP,
  viewport: DESKTOP,
  deviceScaleFactor: 1,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});

const json = (route, data) => route.fulfill({ json: { code: 0, message: '0', ttl: 1, data } });

// ---- 共用 ----
await context.route(/api\.bilibili\.com\/x\/web-interface\/nav/, (route) =>
  json(route, {
    isLogin: true,
    mid: 12345,
    uname: '測試帳號',
    face: 'https://i0.hdslb.com/bfs/face/test.jpg',
    wbi_img: {
      img_url: 'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',
      sub_url: 'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png',
    },
  }),
);
await context.route(/hdslb\.com/, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: png }));

// ---- 收藏夾 ----
await context.route(/api\.bilibili\.com\/x\/v3\/fav\/folder\/created\/list/, (route) =>
  json(route, { list: folders, has_more: false, count: folders.length }),
);
await context.route(/api\.bilibili\.com\/x\/v3\/fav\/resource\/list/, (route) =>
  json(route, {
    medias: videos.map(([bvid, title, intro, duration, attr], i) => ({
      id: 1000 + i,
      type: 2,
      title,
      cover: `https://i0.hdslb.com/bfs/archive/${bvid}.jpg`,
      intro,
      page: 1,
      duration,
      upper: { mid: 9, name: '示範UP' },
      attr,
      cnt_info: { play: 100 },
      pubtime: 0,
      fav_time: 0,
      bvid,
    })),
    has_more: false,
    info: folders[0],
  }),
);
await context.route(/api\.bilibili\.com\/x\/web-interface\/wbi\/view\/detail/, (route) => {
  const bvid = new URL(route.request().url()).searchParams.get('bvid') ?? '';
  const rich = bvid === 'BV1demo0001';
  json(route, {
    View: {
      bvid,
      tid: rich ? 172 : 20,
      cid: 1,
      pages: [{ cid: 1, part: '正片' }],
      ...(rich
        ? { ugc_season: { id: 1, title: '原神版本攻略', ep_count: 24, sections: [{ episodes: [{ bvid, title: '4.2' }] }] } }
        : {}),
    },
    Tags: rich ? [{ tag_name: '原神' }, { tag_name: '深境螺旋' }, { tag_name: '攻略' }] : [{ tag_name: 'MMD' }],
  });
});
// AI 端點：借用已有 host_permissions 的網域，省掉 optional permission 的互動
await context.route(/api\.bilibili\.com\/mockai\/v1\/chat\/completions/, (route) => {
  // 生成描述與分類共用同一個端點，用 describe 專屬的句子分辨（分類的 system prompt 也有「收錄標準」）
  const isDescribe = (route.request().postData() ?? '').includes('歸納出它實際上在收什麼');
  const content = isDescribe
    ? '手繪插畫與美圖欣賞'
    : // target_folder_ids 是送進 prompt 的短號，不是 media_id：
      // 1＝來源收藏夾（列出來代表留在原地），2＝繪畫 / 美圖、3＝遊戲實況（勾選順序）
      JSON.stringify({
        results: [
          { bvid: 'BV1demo0001', target_folder_ids: [3], basis: ['標籤', '合集'], reason: '標籤含原神', confidence: 'high' },
          { bvid: 'BV1demo0002', target_folder_ids: [2], basis: ['標籤'], reason: '標籤 MMD', confidence: 'low' },
          // 留在原地並複製一份過去：模型自己就答得出這個組合
          { bvid: 'BV1demo0004', target_folder_ids: [1, 2], basis: ['標籤'], reason: '標籤含 MMD 與原神', confidence: 'high' },
        ],
      });
  route.fulfill({
    json: {
      choices: [{ message: { content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1234, completion_tokens: 88 },
    },
  });
});

// ---- 關注 ----
await context.route(/api\.bilibili\.com\/x\/relation\/stat/, (route) =>
  json(route, { mid: 12345, following: follows.length, whisper: whispers.length, black: 0, follower: 12 }),
);
await context.route(/api\.bilibili\.com\/x\/relation\/tags/, (route) => json(route, TAGS));
await context.route(/api\.bilibili\.com\/x\/relation\/followings/, (route) => {
  const pn = Number(new URL(route.request().url()).searchParams.get('pn') ?? '1');
  json(route, { list: follows.slice((pn - 1) * 50, pn * 50), re_version: 0, total: follows.length });
});
await context.route(/api\.bilibili\.com\/x\/relation\/whispers/, (route) => {
  const pn = Number(new URL(route.request().url()).searchParams.get('pn') ?? '1');
  json(route, { list: pn === 1 ? whispers : [], re_version: 0 });
});
// 停下的情境：第 failAfter 次之後的查詢回 -101（未登入），整輪立刻停下、橫幅、剩下的列鎖著
let lookups = 0;
let failAfter = Number.POSITIVE_INFINITY;
await context.route(/api\.bilibili\.com\/x\/space\/wbi\/arc\/search/, (route) => {
  const mid = Number(new URL(route.request().url()).searchParams.get('mid'));
  lookups++;
  if (lookups > failAfter) return route.fulfill({ json: { code: -101, message: '账号未登录', ttl: 1 } });
  const age = latestAgeOf(mid);
  if (age === 'error') return route.fulfill({ json: { code: -404, message: '啥都木有', ttl: 1 } });
  const vlist =
    age === null
      ? []
      : [
          {
            aid: mid,
            bvid: `BV1${String(mid).slice(-6)}xyz`,
            title: `【${mid}】最後一支投稿的標題會顯示在這裡`,
            created: now - age * DAY,
          },
        ];
  json(route, { list: { vlist, tlist: {} }, page: { pn: 1, ps: 1, count: vlist.length } });
});

// 寫入需要 bili_jct（csrf）。假 cookie 放在拋棄式 profile 裡，所有 B 站請求都被攔截，碰不到真實帳號
await context.addCookies([{ name: 'bili_jct', value: 'preview-csrf', domain: '.bilibili.com', path: '/' }]);

// 寫入類請求：不真的打出去，記下參數以便確認搬移／撤銷／取關的方向正確
const writes = [];
await context.route(/api\.bilibili\.com\/x\/v3\/fav\/resource\/(move|copy|batch-del)/, (route) => {
  const url = new URL(route.request().url());
  const form = new URLSearchParams(route.request().postData() ?? '');
  writes.push(
    `${url.pathname.split('/').pop()} src=${form.get('src_media_id') ?? '-'} tar=${form.get('tar_media_id') ?? form.get('media_id') ?? '-'} res=${form.get('resources')}`,
  );
  route.fulfill({ json: { code: 0, message: '0', ttl: 1, data: 0 } });
});
await context.route(/api\.bilibili\.com\/x\/relation\/(modify|batch\/modify|tags\/addUsers)/, (route) => {
  const url = new URL(route.request().url());
  const form = new URLSearchParams(route.request().postData() ?? '');
  const endpoint = url.pathname.replace('/x/relation/', '');
  writes.push(
    `${endpoint} ${[...form.entries()]
      .filter(([k]) => k !== 'csrf')
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')}`,
  );
  if (endpoint === 'batch/modify') return json(route, { failed_fids: [] });
  route.fulfill({ json: { code: 0, message: '0', ttl: 1 } });
});

let sw = context.serviceWorkers()[0];
if (!sw) sw = await context.waitForEvent('serviceworker');
const extId = new URL(sw.url()).host;
await sw.evaluate(() => chrome.storage.local.clear());
// IndexedDB 也要清：不清的話第二次起關注全部命中快取、查詢瞬間結束，「執行中」的截圖會截到已經完成的審核表。
// SW 與 App 分頁同源，在這裡刪（此時還沒有分頁開著連線，不會被 blocked）。
await sw.evaluate(
  () =>
    new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('bilitidy');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    }),
);
// 預覽用最快的合法速率，48 個帳號十幾秒查完；真實預設是 2 req/s
await sw.evaluate(() =>
  chrome.storage.local.set({
    settings: {
      ai: { baseUrl: 'https://api.bilibili.com/mockai/v1', apiKey: 'preview', model: 'mock-model' },
      rate: { readRps: 5, writeIntervalMs: 300, moveBatchSize: 20 },
    },
  }),
);

const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
const shot = (name, opts = {}) => page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false, ...opts });
const phone = async (name, scrollTo) => {
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(300);
  if (scrollTo) await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), scrollTo);
  await page.waitForTimeout(200);
  await shot(name);
  await page.setViewportSize(DESKTOP);
  await page.waitForTimeout(200);
};
const tab = (name) => page.getByRole('button', { name, exact: true }).click();

await page.goto(`chrome-extension://${extId}/app.html`);
await page.waitForSelector('.src-row', { timeout: 20000 });

// ══ 收藏夾分頁：描述的編輯、匯入與 AI 生成都在這裡 ══════════════════════════
await tab('Folders');
await page.getByRole('button', { name: 'Select all' }).click();
await page.getByRole('button', { name: /^Import from Bilibili/ }).click();
await page.getByRole('button', { name: 'Accept all' }).click();
await page.locator('table.grid tbody tr').first().getByRole('button', { name: 'Generate with AI' }).click();
await page.waitForSelector('textarea.draft', { timeout: 30000 });
await page.waitForTimeout(200);
await shot('folders', { fullPage: true });

// ══ 整理分頁 ══════════════════════════════════════════════════════════════
await page.getByLabel('Description: 料理').fill('');
await tab('Organise');
await page.getByRole('radio', { name: 'Latest saved' }).check();
await page.waitForTimeout(300);
await shot('run', { fullPage: true });
await phone('run-mobile');

await page.getByRole('button', { name: /^Request details/ }).click();
await page.waitForSelector('.dlg', { timeout: 5000 });
await page.getByRole('button', { name: 'Requests' }).click();
await page.waitForTimeout(200);
await shot('run-details');
await page.keyboard.press('Escape');

await page.getByLabel('Add as target: 繪畫 / 美圖').check();
await page.getByLabel('Add as target: 遊戲實況').check();
await page.getByRole('button', { name: 'Start classification' }).click();
await page.waitForSelector('text=Review & execute', { timeout: 20000 });
await page.waitForTimeout(300);
await shot('review', { fullPage: true });
copyFileSync(path.join(out, 'review.png'), path.join(review, 'desktop.png'));
console.log('mixed button:', await page.getByRole('button', { name: /^Write changes/ }).textContent());
await page.getByRole('button', { name: 'What was sent' }).first().click();
await page.waitForSelector('.dlg', { timeout: 5000 });
await page.waitForTimeout(200);
await shot('dialog');
await page.keyboard.press('Escape');

await page.getByRole('button', { name: 'Keep all in place' }).click();
await page.waitForSelector('text=To copy', { timeout: 5000 });
await page.waitForTimeout(200);
await shot('review-copy', { fullPage: true });
await page.getByRole('button', { name: 'Move all instead' }).click();
await page.waitForSelector('text=To move', { timeout: 5000 });

await page.getByRole('button', { name: /^Move \d/ }).click();
await page.waitForSelector('text=Moved', { timeout: 10000 });
await shot('moved', { fullPage: true });
await page.getByRole('button', { name: /^Undo this move/ }).click();
await page.getByRole('button', { name: 'Confirm undo' }).click();
await page.waitForSelector('text=Moved', { state: 'detached', timeout: 15000 });
await page.waitForTimeout(300);
await shot('undone', { fullPage: true });

// ══ 關注分頁 ══════════════════════════════════════════════════════════════
await tab('Follows');
await page.waitForSelector('.who', { timeout: 20000 });
await page.waitForSelector('text=Follows 48 accounts', { timeout: 10000 });
await page.waitForTimeout(300);
await shot('follows-prepare');
await phone('follows-prepare-mobile');

await page.getByRole('button', { name: /^Read the list and check/ }).click();
await page.waitForSelector('.gauge', { timeout: 10000 });

// 兩種任務互斥：關注在跑的時候，整理頁的主按鈕要變灰並寫出原因
await tab('Organise');
await page.waitForSelector('text=still running', { timeout: 5000 });
const blockedDisabled = await page.getByRole('button', { name: /^Move \d/ }).isDisabled();
console.log('organise blocked while follows run:', blockedDisabled);
await shot('blocked');
await tab('Follows');
await page.waitForSelector('.gauge', { timeout: 10000 });
// 等到逐帳號查詢真的走了幾個（計數 ≥ 3）再截，確定截到的是進行中，不是剛開始也不是已結束
await page.waitForFunction(() => Number.parseInt(document.querySelector('.gauge-count')?.textContent ?? '', 10) >= 3, null, {
  timeout: 15000,
});
await shot('follows-running');
await phone('follows-running-mobile');

await page.waitForSelector('text=Review and unfollow', { timeout: 90000 });
await page.waitForTimeout(400);
await shot('follows-review');
copyFileSync(path.join(out, 'follows-review.png'), path.join(review, 'follows-desktop.png'));
// 時間軸欄：每一列一段播放頭、表頭一個可拖的圓鈕；拖到別的位置門檻要跟著變
console.log('timeline playhead cells:', await page.locator('td.col-lane .ph').count());
const playhead = page.locator('input.playhead');
const spanDays = Number(await playhead.getAttribute('max'));
await playhead.fill(String(spanDays - 500));
await page.waitForTimeout(400);
console.log('threshold after dragging the playhead:', await page.locator('#threshold').inputValue());
await page.getByRole('button', { name: '365', exact: true }).click();
await page.waitForTimeout(400);
await phone('follows-review-mobile', 'table.grid');
copyFileSync(path.join(out, 'follows-review-mobile.png'), path.join(review, 'mobile.png'));

// 門檻改成 180 → 「安靜超過門檻」的數字要跟著變
await page.getByRole('button', { name: '180', exact: true }).click();
await page.waitForTimeout(400);
const inactiveFacet = await page.locator('.facet', { hasText: 'Quiet past the threshold' }).textContent();
console.log('inactive facet @180:', inactiveFacet?.replace(/\s+/g, ' '));
await page.getByRole('button', { name: '365', exact: true }).click();
await page.waitForTimeout(400);

// 勾三列 → 作業列主按鈕要寫出數字；再按一次進入二次確認
const pickable = page.locator('table.grid tbody tr.pick');
for (let i = 0; i < 3; i++) await pickable.nth(i).locator('input[type=checkbox]').check();
await page.waitForTimeout(200);
await shot('follows-selected');
console.log('unfollow button:', await page.getByRole('button', { name: /^Unfollow \d/ }).textContent());
await page.getByRole('button', { name: /^Unfollow \d/ }).click();
await page.waitForSelector('text=Yes, unfollow', { timeout: 5000 });
await page.waitForTimeout(200);
await shot('follows-confirm');

// 真的執行（請求被攔截），然後撤銷
await page.getByRole('button', { name: /^Yes, unfollow/ }).click();
await page.waitForSelector('.facet:has-text("Unfollowed")', { timeout: 20000 });
await page.waitForSelector('button:has-text("Undo")', { timeout: 20000 });
await page.locator('.facet', { hasText: 'Unfollowed' }).click();
await page.waitForTimeout(300);
await shot('follows-unfollowed');

await page.getByRole('button', { name: /^Undo/ }).click();
await page.getByRole('button', { name: 'Yes, follow them again' }).click();
await page.waitForSelector('.facet:has-text("Followed again")', { timeout: 20000 });
await page.waitForFunction(() => !document.querySelector('.spin'), null, { timeout: 20000 });
await page.locator('.facet', { hasText: 'Followed again' }).click();
await page.waitForTimeout(300);
await shot('follows-undone');

// 未登入而停下：重查全部、第 10 次之後回 -101 → 審核表帶錯誤橫幅、其餘列「還沒查」且鎖著
failAfter = lookups + 10;
await page.getByRole('button', { name: 'Check again' }).click();
await page.getByLabel('Every account, again').check();
await page.getByRole('button', { name: /^Read the list and check/ }).click();
await page.waitForSelector('.banner.error', { timeout: 60000 });
await page.waitForTimeout(400);
await shot('follows-stopped');
await phone('follows-stopped-mobile', '.center');
failAfter = Number.POSITIVE_INFINITY;
console.log('stopped banner:', (await page.locator('.banner.error').first().textContent())?.slice(0, 140));

// 查不到的列：鎖著、不能勾
await page.locator('.facet', { hasText: 'Could not check' }).click();
await page.waitForTimeout(200);
const lockedBoxes = await page.locator('table.grid tbody tr.locked input[type=checkbox]:disabled').count();
console.log('locked rows:', lockedBoxes);
await shot('follows-unknown');
await phone('follows-unknown-mobile', 'table.grid');
await page.locator('.facet', { hasText: 'Quiet past the threshold' }).click();

// ══ 設定：六章分三組、一次只看一章；01 帶著兩個改過沒存的欄位，控制列的章節軌要亮起來 ══════════
await tab('Settings');
await page.getByLabel('Model', { exact: true }).fill('mock-model-2');
await page.waitForTimeout(200);
console.log('settings save button:', await page.getByRole('button', { name: /^Save/ }).textContent());
console.log('dirty chapter segments:', await page.locator('.runbar .seg.dirty').count());
await shot('settings', { fullPage: true });
copyFileSync(path.join(out, 'settings.png'), path.join(review, 'settings-desktop.png'));
await phone('settings-mobile');
await page.getByLabel('Model', { exact: true }).fill('mock-model');
// 章節在左軌（.chap）與控制列的章節軌（.seg）各有一顆按鈕；點左軌的
const chapter = (title) => page.locator('button.chap', { hasText: title }).click();
await chapter('What the AI sees');
await page.waitForTimeout(200);
await shot('settings-data', { fullPage: true });
await chapter('Read & write speed');
await page.waitForTimeout(200);
await shot('settings-speed', { fullPage: true });
await chapter('Cache & backup');
await page.waitForTimeout(200);
await shot('settings-cache', { fullPage: true });
// 左軌最後一列是通往關注頁的門
await page.locator('button.chap.link').click();
await page.waitForSelector('text=Review and unfollow', { timeout: 10000 });
console.log('follows pointer opens the Follows page: true');
await tab('Settings');
await chapter('Language');
await page.waitForTimeout(200);

// ══ 繁體中文：切語言 → 關注頁（結果從快照還原）→ 整理頁 ═══════════════════
await page.getByLabel('繁體中文').check();
await page.waitForTimeout(200);
await tab('關注');
await page.waitForSelector('text=審核與取關', { timeout: 10000 });
await page.waitForTimeout(400);
await shot('follows-review-zh-Hant');
await tab('整理');
await page.waitForSelector('text=審核與執行', { timeout: 10000 });
await page.waitForTimeout(300);
await shot('review-zh-Hant', { fullPage: true });

console.log('writes:', writes);
console.log('errors:', errors.length ? errors : 'none');
console.log('screenshots in', out);
if (process.env.UI_KEEP) {
  console.log('UI_KEEP is set; close the browser window to finish.');
  await new Promise((resolve) => context.on('close', resolve));
} else {
  await context.close();
}
if (errors.length) process.exit(1);
