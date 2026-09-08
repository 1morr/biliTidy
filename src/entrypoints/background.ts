import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import { quickFavMessageSchema, type QuickFavResult } from '@/core/messages';
import { applyFavorite, suggestFavorite } from '@/core/quickFav';
import { applyRateSettings } from '@/core/scheduler';
import { loadSettings, watchSettings } from '@/core/settings';
import { setHeaderRuleError } from '@/core/headerRules';
import { initLanguage, t, watchLanguage } from '@/i18n';
import { toAppError } from '@/shared/result';

const HEADER_RULE_ID = 1;
const SITE = 'https://www.bilibili.com';

/**
 * 擴充功能自己（App 分頁與本 SW）發往 api.bilibili.com 的請求，補上 B 站前端會帶的 Referer/Origin。
 * condition 以 initiatorDomains = 本擴充功能 id 限定，不影響 bilibili.com 分頁自身的請求。
 * session rule 在瀏覽器關閉後消失，所以 SW 每次啟動都重新安裝（先移除再新增，冪等）。
 *
 * 這支失敗的話 Referer/Origin 就沒有補上，之後每一個打向 api.bilibili.com 的請求都會被擋，
 * 而且 SW 沒有畫面、使用者只會看到整理流程一路失敗、完全不知道原因。所以失敗要記下來
 * （`core/headerRules.ts`），讓 App 分頁能在頂層顯示橫幅；成功時清掉上一次的錯誤訊息，
 * 不然重試成功之後橫幅還留著。呼叫端一律當它「不會 throw」來用（內部已經吞掉例外）。
 */
async function installHeaderRules(): Promise<void> {
  try {
    await browser.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [HEADER_RULE_ID],
      addRules: [
        {
          id: HEADER_RULE_ID,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [
              { header: 'Referer', operation: 'set', value: `${SITE}/` },
              { header: 'Origin', operation: 'set', value: SITE },
            ],
          },
          condition: {
            initiatorDomains: [browser.runtime.id],
            requestDomains: ['api.bilibili.com'],
            resourceTypes: ['xmlhttprequest'],
          },
        },
      ],
    });
    await setHeaderRuleError(null).catch(() => undefined);
  } catch (e) {
    const message = t().errors.headerRuleFailed(toAppError(e).message);
    // oxlint-disable-next-line no-console -- SW 沒有 UI 可以顯示錯誤，這是唯一看得到的地方（chrome://extensions 的 service worker console）
    console.error('[biliTidy]', message, e);
    await setHeaderRuleError(message).catch(() => undefined);
  }
}

const appTabItem = storage.defineItem<number | null>('session:appTabId', { fallback: null });

/** App 分頁單例：已開啟就聚焦，否則新建 */
async function openAppTab(): Promise<void> {
  const existingId = await appTabItem.getValue();
  if (existingId !== null) {
    try {
      const tab = await browser.tabs.get(existingId);
      await browser.tabs.update(existingId, { active: true });
      if (tab.windowId !== undefined) await browser.windows.update(tab.windowId, { focused: true });
      return;
    } catch {
      // 分頁已被關閉，往下新建
    }
  }
  const tab = await browser.tabs.create({ url: browser.runtime.getURL('/app.html') });
  if (tab.id !== undefined) await appTabItem.setValue(tab.id);
}

/**
 * SW 閒置滿 30 秒就會被回收（Chrome 110 起與 web 標準對齊）。單支影片的往返實測約 1.2 秒，
 * 但本機模型或慢端點可以跑到 AI 的 120 秒逾時，中間完全沒有事件，SW 會在回覆之前先被收掉，
 * content script 就永遠等不到答案。官方建議的做法是跑的時候定期呼叫一支沒有副作用的
 * 擴充功能 API 把閒置計時器歸零（developer.chrome.com/docs/extensions/develop/migrate/to-service-workers）。
 */
const KEEP_ALIVE_MS = 25_000;

function keepAlive<T>(work: Promise<T>): Promise<T> {
  const timer = setInterval(() => void browser.runtime.getPlatformInfo(), KEEP_ALIVE_MS);
  return work.finally(() => clearInterval(timer));
}

/**
 * 影片頁「智慧收藏」的後端。整理流程仍然全部在 App 分頁跑，
 * 這裡只做單支影片的一次往返。
 */
function handleQuickFav(message: unknown, sendResponse: (r: unknown) => void): boolean {
  // externally_connectable 沒有宣告，這裡收得到的訊息只可能來自本擴充功能自己的 content script；
  // 驗證是防禦性的——格式跑掉時給一個好懂的錯誤，而不是讓 applyFavorite 內部因為某個欄位是
  // undefined 而拋出不相干的 TypeError。
  const parsed = quickFavMessageSchema.safeParse(message);
  if (!parsed.success) return false;
  const msg = parsed.data;
  const reply = (p: Promise<unknown>) => {
    p.then((data) => sendResponse({ ok: true, data } satisfies QuickFavResult<unknown>)).catch((e: unknown) => {
      const err = toAppError(e);
      sendResponse({ ok: false, kind: err.kind, message: err.message } satisfies QuickFavResult<never>);
    });
  };
  if (msg.type === 'quickFav:suggest') {
    reply(keepAlive(suggestFavorite(msg.bvid)));
    return true;
  }
  reply(keepAlive(applyFavorite(msg.aid, msg.addIds, msg.delIds).then(() => null)));
  return true;
}

/**
 * SW 有自己一份 scheduler 單例（App 分頁那份管不到這裡），所以限速設定要在這邊也套一次，
 * 否則設定頁選了「保守」，影片頁的「智慧收藏」還是用預設速率。讀取失敗（例如 storage 一時不可用）
 * 就維持預設速率，不讓「智慧收藏」整支掛掉——記個 log 就好，不值得跟安裝規則失敗一樣開橫幅。
 */
async function applyRate(): Promise<void> {
  try {
    applyRateSettings((await loadSettings()).rate);
  } catch (e) {
    // oxlint-disable-next-line no-console -- SW 沒有 UI 可以顯示錯誤，這是唯一看得到的地方（chrome://extensions 的 service worker console）
    console.error('[biliTidy] could not read the rate settings; the service worker scheduler keeps its default rate', e);
  }
}

export default defineBackground(() => {
  // 事件監聽器一律同步註冊（MV3 SW 被喚醒時才抓得到），語言偏好載入後才需要的動作串在它後面
  void initLanguage().then(() => {
    watchLanguage();
    void installHeaderRules();
    void applyRate();
  });
  watchSettings((settings) => applyRateSettings(settings.rate));
  browser.runtime.onInstalled.addListener(() => void installHeaderRules());
  browser.runtime.onStartup.addListener(() => void installHeaderRules());
  browser.action.onClicked.addListener(
    // oxlint-disable-next-line no-console -- SW 沒有 UI 可以顯示錯誤，這是唯一看得到的地方（chrome://extensions 的 service worker console）
    () => void openAppTab().catch((e: unknown) => console.error('[biliTidy] could not open the app tab', e)),
  );
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => handleQuickFav(message, sendResponse));
});
