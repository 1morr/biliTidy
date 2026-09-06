import { storage } from 'wxt/utils/storage';

/**
 * `entrypoints/background.ts` 的 `installHeaderRules()` 是否失敗的訊息；失敗代表 Referer/Origin
 * 沒有被補上，接下來擴充功能自己發出的每一個 api.bilibili.com 請求都會被擋，而且沒有任何提示——
 * SW 沒有畫面，使用者只會看到整理流程一路失敗。App 分頁用它顯示頂層橫幅。
 * session 層級：瀏覽器關掉、或下次 `installHeaderRules()` 成功就自動清掉，不需要另外的清除 UI。
 */
const headerRuleErrorItem = storage.defineItem<string | null>('session:headerRuleError', { fallback: null });

export async function setHeaderRuleError(message: string | null): Promise<void> {
  await headerRuleErrorItem.setValue(message);
}

export async function getHeaderRuleError(): Promise<string | null> {
  return headerRuleErrorItem.getValue();
}

export function watchHeaderRuleError(cb: (message: string | null) => void): () => void {
  return headerRuleErrorItem.watch(cb);
}
