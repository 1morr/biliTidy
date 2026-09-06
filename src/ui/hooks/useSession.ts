import { useCallback, useEffect, useState } from 'react';
import { fetchNav, type NavData } from '@/bilibili/http';
import { getHeaderRuleError, watchHeaderRuleError } from '@/core/headerRules';
import { toAppError } from '@/shared/result';

export type SessionState = { status: 'loading' } | { status: 'ready'; nav: NavData } | { status: 'error'; message: string };

/** 讀取 B 站登入狀態（nav），並順便暖好 WBI key。 */
export function useSession() {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const nav = await fetchNav();
      setState({ status: 'ready', nav });
    } catch (e) {
      setState({ status: 'error', message: toAppError(e).message });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, refresh };
}

/**
 * `background.ts` 的 `installHeaderRules()` 失敗時要顯示的頂層橫幅：失敗代表 Referer/Origin
 * 沒補上，之後每個打向 api.bilibili.com 的請求都會被擋，SW 那邊沒有畫面可以講這件事。
 */
export function useHeaderRuleError(): string | null {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    getHeaderRuleError()
      .then(setMessage)
      .catch(() => undefined);
    return watchHeaderRuleError(setMessage);
  }, []);
  return message;
}
