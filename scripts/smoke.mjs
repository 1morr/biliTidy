// 煙霧測試：以 Playwright Chromium 載入 build 後的擴充功能，走過設定頁（對本機 mock AI）與登入後的分類流程（不搬移）。
// 用法：npm run build && node scripts/smoke.mjs
//   SMOKE_HEADED=1        顯示視窗（預設 headless）
//   SMOKE_CHANNEL=chrome  改用系統 Chrome（Chrome 137+ 品牌版已不支援 --load-extension，預設用 Playwright 的 Chromium）
//   SMOKE_KEEP=1          測試後不關閉瀏覽器；可在視窗裡登入 B 站，profile 存於 .smoke-profile/ 供下次重用
//   SMOKE_SKIP_FLOW=1     即使已登入也不跑分類流程
//
// 選擇器的規矩：**能用結構就不要用文字**。這支腳本曾經先把語言設成繁中、再用約 30 個中文字串當選擇器，
// 版面重做把章節改名之後整支就死了（而 CI 不跑它，所以沒人發現）。現在章節走 `.chap` 上的編號、
// 分頁走 `.tabs .tab` 的順序、開關走 `.srow input.switch` 的順序；真的只剩文字可用時才用英文——
// `src/i18n/en.ts` 是預設語系也是型別來源，`scripts/ui-preview.mjs` 也是同樣的做法。
import { chromium } from 'playwright';
import path from 'node:path';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createMockAiServer } from './mock-ai.mjs';

const built = path.resolve('.output/chrome-mv3');
const ext = path.resolve('.output/smoke-ext');
const profile = path.resolve('.smoke-profile');
const outDir = path.resolve('.output/smoke');
mkdirSync(outDir, { recursive: true });

// 複製 build 並把本機 mock AI 加進 host_permissions：optional permission 的原生授權視窗無法自動化
rmSync(ext, { recursive: true, force: true });
cpSync(built, ext, { recursive: true });
const manifestPath = path.join(ext, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.host_permissions = [...(manifest.host_permissions ?? []), `http://127.0.0.1/*`];
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const mock = createMockAiServer();
// 用臨時埠（port 0）而不是固定的 8787：那個埠被別的程式佔住時整個煙霧測試會以 EADDRINUSE 掛掉，
// 而 manifest 的 host_permissions 給的是 http://127.0.0.1/*（不限埠），換埠不影響授權。
await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve));
const MOCK_PORT = mock.address().port;

const context = await chromium.launchPersistentContext(profile, {
  channel: process.env.SMOKE_CHANNEL ?? 'chromium',
  headless: !process.env.SMOKE_HEADED,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});

const failures = [];
const check = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
};

try {
  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  const extId = new URL(sw.url()).host;
  console.log('extension id:', extId);
  // 每次從乾淨的設定開始，讓流程可重複執行（cookie／登入態不受影響）。
  // 不設語言：預設就是英文，選擇器跟著 src/i18n/en.ts。
  await sw.evaluate(() => chrome.storage.local.clear());

  // CI 上這支唯一會碰到外網的地方就是 nav（判斷登入態）。Azure 的 IP 被 B 站風控或擋掉時，
  // 整支會卡在下面那句 waitForSelector 而不是驗證失敗——那不是這支腳本要測的東西。
  // SMOKE_OFFLINE=1 餵一份未登入的 nav，讓 CI 跟本機未登入時走同一條路（分類流程照樣 SKIP）。
  if (process.env.SMOKE_OFFLINE) {
    await context.route('**/x/web-interface/nav*', (route) =>
      route.fulfill({
        json: {
          code: -101,
          message: '账号未登录',
          ttl: 1,
          data: {
            isLogin: false,
            wbi_img: {
              img_url: 'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',
              sub_url: 'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png',
            },
          },
        },
      }),
    );
  }

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') pageErrors.push(m.text());
  });
  await page.goto(`chrome-extension://${extId}/app.html`);
  // 「重新檢查」那顆按鈕只在登入狀態查完之後才出現（查詢中是純文字，查失敗是另一顆 .link）
  await page.waitForSelector('.session .recheck', { timeout: 20000 });
  const session = (await page.textContent('.session'))?.trim() ?? '';
  console.log('session:', session);
  const loggedIn = /mid \d+/.test(session);

  const rules = await sw.evaluate(() => chrome.declarativeNetRequest.getSessionRules());
  check(rules.length === 1 && rules[0].condition.initiatorDomains?.[0] === extId, 'DNR header rule installed');

  // 頂列四個分頁的順序（ui/App.tsx 的 pages）與設定頁六章的編號（SettingsPage 的 ORDER）都是介面自己的座標，
  // 不隨語言改變——章節編號甚至就印在畫面上。
  const TAB = { run: 0, folders: 1, follows: 2, settings: 3 };
  const tab = (id) => page.locator('.tabs .tab').nth(TAB[id]).click();
  const CH = { endpoint: '01', sources: '02', instructions: '03', speed: '04', data: '05', language: '06' };
  const section = (no) => page.locator(`button.chap:has(.no:text-is("${no}"))`).click();
  const chapterStatus = (no) => page.locator(`button.chap:has(.no:text-is("${no}")) .st`).textContent();
  // 02「給 AI 看什麼」的三個資料來源開關（DataSourcesSection 的 sources 陣列順序）
  const SRC = { detail: 0, subtitle: 1, cover: 2 };
  const sourceSwitch = (key) => page.locator('.srow input.switch').nth(SRC[key]);
  const saveButton = () => page.locator('.runbar .btn.primary');

  // ---- 設定頁：對 mock AI 做連線測試與視覺測試，儲存後重載仍在 ----
  // 設定頁一次只顯示一章，所以要測的控制項得先切到它所在的那一章
  await tab('settings');
  await section(CH.endpoint);
  await page.fill('#baseUrl', `http://127.0.0.1:${MOCK_PORT}/v1`);
  await page.fill('#model', 'mock-model');
  await page.getByRole('button', { name: 'Test connection' }).click();
  await page.waitForSelector('text=Reply: OK', { timeout: 10000 });
  check(true, 'AI 連線測試（mock）');
  // 「已連線」要測試通過才算數，不可以只看欄位有沒有填
  check((await chapterStatus(CH.endpoint))?.includes('Connected') === true, '連線測試通過後左軌顯示 Connected');

  // 「測試視覺」會立刻寫進 storage；同一次編輯裡其他章節的改動不該被還原掉，
  // 所以先改字幕與限速再按，測完一起驗。
  await page.locator('.settings-form input.switch').check();
  await section(CH.sources);
  await sourceSwitch('subtitle').check();
  check(await sourceSwitch('cover').isDisabled(), '確認之前不啟用封面選項');
  await section(CH.speed);
  await page.locator('input[name="ratePreset"]').first().check();

  await section(CH.endpoint);
  await page.getByRole('button', { name: 'Test vision' }).click();
  await page.waitForSelector('text=Model reply:', { timeout: 10000 });
  // 「有回覆」不算通過：要使用者確認描述對得上那張圖
  await page.getByRole('button', { name: 'It matches, enable' }).click();
  await page.waitForSelector('text=Vision setting saved', { timeout: 10000 });
  check(true, 'AI 視覺測試（mock）');

  await section(CH.sources);
  check(await sourceSwitch('cover').isEnabled(), '視覺驗證後啟用封面選項');
  check(await sourceSwitch('subtitle').isChecked(), '測試視覺後字幕設定沒有被還原');
  await section(CH.speed);
  check(await page.locator('input[name="ratePreset"]').first().isChecked(), '測試視覺後限速設定沒有被還原');
  const afterVision = await sw.evaluate(() => chrome.storage.local.get('settings'));
  check(
    afterVision.settings?.features?.fetchSubtitle === true && afterVision.settings?.rate?.readRps === 1,
    `測試視覺一併寫進 storage（${JSON.stringify(afterVision.settings?.features)} ${JSON.stringify(afterVision.settings?.rate)}）`,
  );
  // 還原成預設值，不影響後面的流程
  await page.locator('input[name="ratePreset"]').nth(1).check();
  await section(CH.sources);
  await sourceSwitch('subtitle').uncheck();
  // 封面預設是開的，關掉才驗得出「儲存後真的持久化」（而且煙霧測試不需要真的抓封面）
  await sourceSwitch('cover').uncheck();
  await saveButton().click();
  // 存完 dirty 會清掉、主按鈕跟著變灰——不必比對「已儲存」那句話
  await page.waitForFunction(() => document.querySelector('.runbar .btn.primary')?.disabled === true, null, { timeout: 5000 });
  check(true, '儲存設定');
  await page.screenshot({ path: path.join(outDir, 'settings.png'), fullPage: true });

  await page.reload();
  await tab('settings');
  await page.waitForSelector('#baseUrl');
  check((await page.inputValue('#baseUrl')) === `http://127.0.0.1:${MOCK_PORT}/v1`, '設定重載後持久化');
  await section(CH.sources);
  check(!(await sourceSwitch('cover').isChecked()), '封面選項持久化');

  // 不合法的 Base URL 不可以被默默換成別的端點：主按鈕變灰、旁邊寫出規則、storage 原封不動
  await section(CH.endpoint);
  await page.fill('#baseUrl', 'http://192.168.1.10:8080/v1');
  check(await saveButton().isDisabled(), '非法 Base URL 時主按鈕變灰');
  const why = (await page.locator('.runbar .why').textContent()) ?? '';
  check(why.includes('Only https://'), `非法 Base URL 時作業列寫出規則：${why.slice(0, 60)}`);
  const afterBadUrl = await sw.evaluate(() => chrome.storage.local.get('settings'));
  check(
    afterBadUrl.settings?.ai?.baseUrl === `http://127.0.0.1:${MOCK_PORT}/v1`,
    `非法 Base URL 沒有寫進 storage（${afterBadUrl.settings?.ai?.baseUrl}）`,
  );
  await page.fill('#baseUrl', `http://127.0.0.1:${MOCK_PORT}/v1`);

  // 換模型名稱 → 視覺驗證作廢、封面選項停用
  await page.fill('#model', 'other-model');
  await section(CH.sources);
  check(await sourceSwitch('cover').isDisabled(), '更換模型後視覺選項停用');

  await tab('run');

  // ---- 已登入：跑「分類但不搬移」流程（mock AI 一律回空目標） ----
  if (loggedIn && !process.env.SMOKE_SKIP_FLOW) {
    await page.waitForSelector('.src-row', { timeout: 20000 });
    const rows = await page.$$eval('.src-row', (els) =>
      els.map((el, i) => ({
        i,
        title: el.querySelector('.src-name')?.textContent ?? '',
        n: Number(el.querySelector('.src-n')?.textContent ?? 0),
      })),
    );
    // 選影片數最少（但 > 0）的收藏夾當來源，控制請求量
    const source = rows.filter((r) => r.n > 0).sort((a, b) => a.n - b.n)[0];
    check(!!source, `找到來源收藏夾：${source?.title}（${source?.n} 支）`);
    await page.locator('.src-row').nth(source.i).click();

    // 整理範圍：最近收藏的 20 支（BatchPanel 的第二個 scope radio）
    await page.locator('input[name="scope"]').nth(1).check();
    await page.locator('aside.side input[type=number]').first().fill('20');
    const estimate = (await page.locator('aside.side .read').first().textContent()) ?? '';
    check(/\b20\b/.test(estimate), `顯示預估請求量：${estimate.replace(/\s+/g, ' ').slice(0, 80)}`);

    // 描述的匯入、編輯與 AI 生成都在「收藏夾」分頁
    await tab('folders');
    await page.getByRole('button', { name: 'Select all' }).click();
    await page.getByRole('button', { name: /^Import from Bilibili/ }).click();
    await page.getByRole('button', { name: 'Accept all' }).click();
    check(true, '從 B 站簡介匯入描述並採用');
    await tab('run');

    await page.locator('table.grid tbody input[type=checkbox]').first().check();
    await page.getByRole('button', { name: 'Start classification' }).click();
    await page.waitForSelector('text=Review & execute', { timeout: 15 * 60 * 1000 });
    const rowCount = await page.locator('table.grid tbody tr').count();
    check(rowCount > 0, `分類完成，審核表 ${rowCount} 列`);
    const pending = (await page.getByRole('button', { name: /^Move \d/ }).textContent()) ?? '';
    check(/^Move 0 /.test(pending), `mock 回空目標 → 待搬移 0 支（${pending}）`);
    await page.screenshot({ path: path.join(outDir, 'review.png'), fullPage: true });
  } else {
    console.log(
      loggedIn ? 'SKIP 分類流程（SMOKE_SKIP_FLOW）' : 'SKIP 分類流程（未登入；用 SMOKE_HEADED=1 SMOKE_KEEP=1 登入後重跑）',
    );
  }

  await page.screenshot({ path: path.join(outDir, 'app.png'), fullPage: true });
  check(pageErrors.length === 0, `無頁面錯誤${pageErrors.length ? `：${pageErrors.join(' | ')}` : ''}`);

  // 工具列圖示的單例判斷（background.ts 的 openAppTab）。放在最後，因為第二條要把分頁導走。
  // 舊寫法記 tab id 再用 tabs.get 確認，分頁被導去別的網站時照樣成功——圖示於是永遠開不出 App。
  const appContexts = async () =>
    (await sw.evaluate(() => chrome.runtime.getContexts({ contextTypes: ['TAB'] }))).filter((c) =>
      c.documentUrl?.startsWith(`chrome-extension://${extId}/app.html`),
    );
  check((await appContexts()).length === 1, 'getContexts 找得到 App 分頁');
  await page.goto('about:blank');
  check((await appContexts()).length === 0, '導去別的網址之後就不算 App 分頁了（圖示會開新的）');
  await page.goto(`chrome-extension://${extId}/app.html`);

  if (process.env.SMOKE_KEEP) {
    console.log('SMOKE_KEEP 已設定，瀏覽器保持開啟；關閉視窗即結束。');
    await new Promise((resolve) => context.on('close', resolve));
  }
} finally {
  if (!process.env.SMOKE_KEEP) await context.close();
  mock.close();
}

if (failures.length) {
  console.log(`\n${failures.length} 項失敗`);
  process.exit(1);
}
console.log('\n全部通過');
