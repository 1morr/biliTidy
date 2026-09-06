// 煙霧測試：以 Playwright Chromium 載入 build 後的擴充功能，走過設定頁（對本機 mock AI）與登入後的分類流程（不搬移）。
// 用法：npm run build && node scripts/smoke.mjs
//   SMOKE_HEADED=1        顯示視窗（預設 headless）
//   SMOKE_CHANNEL=chrome  改用系統 Chrome（Chrome 137+ 品牌版已不支援 --load-extension，預設用 Playwright 的 Chromium）
//   SMOKE_KEEP=1          測試後不關閉瀏覽器；可在視窗裡登入 B 站，profile 存於 .smoke-profile/ 供下次重用
//   SMOKE_SKIP_FLOW=1     即使已登入也不跑分類流程
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
  // 這支腳本用繁中文案找控制項，而介面預設是英文，所以清完 storage 要把語言設回繁中。
  await sw.evaluate(() => chrome.storage.local.clear());
  await sw.evaluate(() => chrome.storage.local.set({ language: 'zh-Hant' }));

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') pageErrors.push(m.text());
  });
  await page.goto(`chrome-extension://${extId}/app.html`);
  await page.waitForFunction(() => !(document.querySelector('.session')?.textContent ?? '').includes('檢查登入狀態'), null, {
    timeout: 20000,
  });
  const session = (await page.textContent('.session'))?.trim() ?? '';
  console.log('session:', session);
  const loggedIn = /mid \d+/.test(session);

  const rules = await sw.evaluate(() => chrome.declarativeNetRequest.getSessionRules());
  check(rules.length === 1 && rules[0].condition.initiatorDomains?.[0] === extId, 'DNR header rule installed');

  // ---- 設定頁：對 mock AI 做連線測試與視覺測試，儲存後重載仍在 ----
  // 設定頁一次只顯示一段，所以要測的控制項得先切到它所在的那一段
  const section = (name) => page.locator('.snav-item', { hasText: name }).click();

  await page.getByRole('button', { name: '設定', exact: true }).click();
  await section('連線');
  await page.fill('#baseUrl', `http://127.0.0.1:${MOCK_PORT}/v1`);
  await page.fill('#model', 'mock-model');
  await page.getByRole('button', { name: '測試連線' }).click();
  await page.waitForSelector('text=回覆：OK', { timeout: 10000 });
  check(true, 'AI 連線測試（mock）');

  // 「測試視覺」會立刻寫進 storage；同一次編輯裡其他段落的改動不該被還原掉，
  // 所以先改字幕與限速再按，測完一起驗。
  await page.getByLabel('這個模型看得懂圖片').check();
  await section('要給 AI 看什麼');
  await page.getByLabel('抓字幕').check();
  check(await page.getByLabel('附上封面給模型看').isDisabled(), '確認之前不啟用封面選項');
  await section('速度與資料');
  await page.locator('input[name="ratePreset"]').first().check(); // 保守 = 1 req/s

  await section('連線');
  await page.getByRole('button', { name: '測試視覺' }).click();
  await page.waitForSelector('text=模型回覆：粉色圓形', { timeout: 10000 });
  // 「有回覆」不算通過：要使用者確認描述對得上那張圖
  await page.getByRole('button', { name: '對得上，啟用' }).click();
  await page.waitForSelector('text=一併儲存', { timeout: 10000 });
  check(true, 'AI 視覺測試（mock）');

  await section('要給 AI 看什麼');
  check(await page.getByLabel('附上封面給模型看').isEnabled(), '視覺驗證後啟用封面選項');
  check(await page.getByLabel('抓字幕').isChecked(), '測試視覺後字幕設定沒有被還原');
  await section('速度與資料');
  check(await page.locator('input[name="ratePreset"]').first().isChecked(), '測試視覺後限速設定沒有被還原');
  const afterVision = await sw.evaluate(() => chrome.storage.local.get('settings'));
  check(
    afterVision.settings?.features?.fetchSubtitle === true && afterVision.settings?.rate?.readRps === 1,
    `測試視覺一併寫進 storage（${JSON.stringify(afterVision.settings?.features)} ${JSON.stringify(afterVision.settings?.rate)}）`,
  );
  // 還原成預設值，不影響後面的流程
  await page.locator('input[name="ratePreset"]').nth(1).check();
  await section('要給 AI 看什麼');
  await page.getByLabel('抓字幕').uncheck();
  // 封面預設是開的，關掉才驗得出「儲存後真的持久化」（而且煙霧測試不需要真的抓封面）
  await page.getByLabel('附上封面給模型看').uncheck();
  await page.getByRole('button', { name: '儲存設定' }).click();
  await page.waitForSelector('text=已儲存', { timeout: 5000 });
  await page.screenshot({ path: path.join(outDir, 'settings.png'), fullPage: true });

  await page.reload();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.waitForSelector('#baseUrl');
  check((await page.inputValue('#baseUrl')) === `http://127.0.0.1:${MOCK_PORT}/v1`, '設定重載後持久化');
  await section('要給 AI 看什麼');
  check(!(await page.getByLabel('附上封面給模型看').isChecked()), '封面選項持久化');

  // 換模型名稱 → 視覺驗證作廢、封面選項停用
  await section('連線');
  await page.fill('#model', 'other-model');
  await section('要給 AI 看什麼');
  check(await page.getByLabel('附上封面給模型看').isDisabled(), '更換模型後視覺選項停用');

  await page.getByRole('button', { name: '整理', exact: true }).click();

  // ---- 已登入：跑「分類但不搬移」流程（mock AI 一律回空目標） ----
  if (loggedIn && !process.env.SMOKE_SKIP_FLOW) {
    await page.waitForSelector('.folder-card', { timeout: 20000 });
    const cards = await page.$$eval('.folder-card', (els) => els.map((el, i) => ({ i, text: el.textContent ?? '' })));
    // 選影片數最少（但 > 0）的收藏夾當來源，控制請求量
    const parsed = cards
      .map((c) => ({ ...c, count: Number(/(\d+)\s*支/.exec(c.text)?.[1] ?? 0) }))
      .filter((c) => c.count > 0)
      .sort((a, b) => a.count - b.count);
    const source = parsed[0];
    check(!!source, `找到來源收藏夾：${source?.text}`);
    await page.locator('.folder-card').nth(source.i).click();

    // 整理範圍：最近收藏的 20 支
    await page.getByLabel('最近收藏的').check();
    await page.locator('section.panel input[type=number]').first().fill('20');
    const estimate = (await page.locator('section.panel', { hasText: 'AI 分類' }).first().textContent()) ?? '';
    check(/這次處理\s*\d+\s*支/.test(estimate), `顯示預估請求量：${estimate.replace(/\s+/g, ' ').slice(0, 80)}`);

    // 描述的匯入、編輯與 AI 生成都在「收藏夾」分頁
    await page.getByRole('button', { name: '收藏夾', exact: true }).click();
    await page.getByRole('button', { name: '全選' }).click();
    await page.getByRole('button', { name: /^從 B 站簡介匯入/ }).click();
    await page.waitForSelector('.banner:has-text("匯入")', { timeout: 10000 });
    await page.getByRole('button', { name: '全部採用' }).click();
    check(true, '從 B 站簡介匯入描述並採用');
    await page.getByRole('button', { name: '整理', exact: true }).click();

    const firstTarget = page.locator('table.grid input[type=checkbox]').first();
    await firstTarget.check();
    await page.getByRole('button', { name: '開始分類' }).click();
    await page.waitForSelector('text=審核與執行', { timeout: 15 * 60 * 1000 });
    const rowCount = await page.locator('table.grid tbody tr').count();
    check(rowCount > 0, `分類完成，審核表 ${rowCount} 列`);
    const pending = await page.getByRole('button', { name: /執行搬移/ }).textContent();
    check(/（0 支）/.test(pending ?? ''), `mock 回空目標 → 待搬移 0 支（${pending}）`);
    await page.screenshot({ path: path.join(outDir, 'review.png'), fullPage: true });
  } else {
    console.log(
      loggedIn ? 'SKIP 分類流程（SMOKE_SKIP_FLOW）' : 'SKIP 分類流程（未登入；用 SMOKE_HEADED=1 SMOKE_KEEP=1 登入後重跑）',
    );
  }

  await page.screenshot({ path: path.join(outDir, 'app.png'), fullPage: true });
  check(pageErrors.length === 0, `無頁面錯誤${pageErrors.length ? `：${pageErrors.join(' | ')}` : ''}`);

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
