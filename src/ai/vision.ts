import { browser } from 'wxt/browser';
import { blobToDataUrl } from '@/shared/blob';
import type { AiSettings } from '@/shared/types';
import { chatCompletion, chatOptionsFrom, type ChatResult } from './client';

/** 用擴充功能自己的圖示當測試圖（粉色圓底＋白色資料夾） */
export async function loadTestImageDataUrl(): Promise<string> {
  const res = await fetch(browser.runtime.getURL('/icon/128.png'));
  const blob = await res.blob();
  return blobToDataUrl(blob);
}

export interface AiTestResult {
  ok: boolean;
  reply: string;
  /** content 為空、reply 取自 reasoning_content（推理模型） */
  fromReasoning: boolean;
}

export function toTestResult(result: Pick<ChatResult, 'content' | 'reasoningContent'>): AiTestResult {
  const content = result.content.trim();
  if (content) return { ok: true, reply: content, fromReasoning: false };
  const reasoning = (result.reasoningContent ?? '').trim();
  return { ok: reasoning.length > 0, reply: reasoning, fromReasoning: true };
}

/**
 * 真的送一張小圖給模型；有回覆即視為支援視覺（回覆內容顯示給使用者自行判斷是否合理）。
 * 不設 max_tokens：推理模型會先花掉大量 token 思考，設上限會讓 content 空掉而誤判為不支援。
 */
export async function runVisionTest(ai: AiSettings, signal?: AbortSignal): Promise<AiTestResult> {
  const dataUrl = await loadTestImageDataUrl();
  const result = await chatCompletion(
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: '這張圖的主要顏色與圖形是什麼？用十個字以內回答。' },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
        ],
      },
    ],
    chatOptionsFrom(ai, { jsonMode: 'off', ...(signal ? { signal } : {}) }),
  );
  return toTestResult(result);
}

/** 純文字連線測試 */
export async function runTextTest(ai: AiSettings, signal?: AbortSignal): Promise<AiTestResult> {
  const result = await chatCompletion(
    [{ role: 'user', content: '請只回覆「OK」。' }],
    chatOptionsFrom(ai, { jsonMode: 'off', ...(signal ? { signal } : {}) }),
  );
  return toTestResult(result);
}
