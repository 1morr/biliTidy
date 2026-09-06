// 由 public/icon/icon.svg 產生 public/icon/{16,32,48,128}.png：manifest 只吃 PNG，原稿留在 SVG 裡好改。
// 用 Playwright 內建的 Chromium 轉檔（devDependency 已有，`npm run ui-preview` 也用它），不另外加圖像套件。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/icon/icon.svg', 'utf8');
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(`public/icon/${size}.png`, png);
}
await browser.close();
console.log('icons written from public/icon/icon.svg');
