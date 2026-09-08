import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'biliTidy',
    // 擴充功能安裝時的靜態說明文字：manifest.json 只能有一份，跟著預設語言（英文）走；
    // 應用程式內文才是 `src/i18n/` 那套可切換語系（見 README「Getting started」）。
    description:
      'Tidy your Bilibili: sort favourites into folders with AI you choose, and unfollow accounts that went quiet — review first, undo after',
    // 目前用得到的 API 裡最晚出現的是 `runtime.getContexts()`（Chrome 116，background.ts 用它找 App 分頁）；
    // declarativeNetRequestWithHostAccess 與 storage.session 是 114。
    // 沒有這個宣告的話，太舊的 Chrome 照樣裝得上，卻在跑到那些 API 時才當場失敗。
    minimum_chrome_version: '116',
    // 沒有 popup：點工具列圖示由 background 開啟 App 分頁（整理收藏／收藏夾／關注／設定四個分頁都在裡面）
    action: { default_title: 'Open biliTidy' },
    // declarativeNetRequestWithHostAccess 而不是 declarativeNetRequest：兩者能力一致（Chrome 文件），
    // 但前者只需要規則實際涉及的 host_permissions（這裡是 api.bilibili.com，本來就已經宣告），
    // 不會在安裝時跳出「封鎖任何網站的內容」這種嚇人的權限警告。
    permissions: ['storage', 'cookies', 'declarativeNetRequestWithHostAccess', 'unlimitedStorage'],
    host_permissions: ['https://api.bilibili.com/*', 'https://www.bilibili.com/*', 'https://*.hdslb.com/*'],
    // AI 端點由使用者自訂，於設定頁以 permissions.request 只申請該 origin。
    // 只開 https，加上本機模型（ollama／LM Studio）常見的 http://localhost、http://127.0.0.1：
    // 開放任意 http://*/* 的話，使用者填一個 http:// 的 base URL 就會讓 Authorization: Bearer <key>
    // 以明文送出去（`core/settings.ts` 的 baseUrl 驗證與這裡的清單要保持一致）。
    optional_host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],
  },
});
