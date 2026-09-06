import { browser } from 'wxt/browser';
import { t } from '@/i18n';
import { recordActivity } from '@/shared/activity';
import { AppError, toAppError } from '@/shared/result';
import type { AiSettings } from '@/shared/types';

export type ContentPart =
  { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface ChatOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** undefined = 不送出（推理模型多半只接受預設值） */
  temperature?: number;
  maxTokens?: number;
  jsonMode?: 'auto' | 'off';
  /** 原樣合併進 request body 的額外參數（例如 {"thinking":{"type":"disabled"}}） */
  extraBody?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface ChatResult {
  /** 正式回覆；推理模型把 token 用完時可能是空字串 */
  content: string;
  /** 部分模型的思考內容（reasoning_content）；content 為空時用來判斷模型到底有沒有動作 */
  reasoningContent?: string;
  finishReason?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

interface RawMessage {
  content?: string | ContentPart[] | null;
  reasoning_content?: string | null;
  reasoning?: string | null;
}

interface ChatCompletionResponse {
  choices?: { message?: RawMessage; finish_reason?: string }[];
  usage?: ChatResult['usage'];
  error?: { message?: string };
}

/** 端點是否支援 response_format（依 baseUrl+model 記住，auto 模式失敗一次就不再嘗試） */
const jsonUnsupported = new Set<string>();

/**
 * 等待回應的上限（收到 header 就算數，讀 body 的時間不算）。沒有它的話端點掛住＝整個任務
 * 停在那裡不動，影片頁的「智慧收藏」連取消按鈕都沒有。視覺批次會慢，所以給得寬。
 */
export const AI_TIMEOUT_MS = 120_000;

/** 端點回的錯誤是不是在抱怨 response_format（只有這種才值得改用純文字重送） */
function complainsAboutJsonMode(body: string): boolean {
  return /response_format|json_object|json[_ ]?mode|json schema/i.test(body);
}

/**
 * 把外部 signal 與逾時綁在一起。不用 `AbortSignal.any`：Chrome 116 才有，
 * 而 manifest 支援的下限是 114。
 */
function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new AppError('network', t().errors.ai.timeout(Math.round(ms / 1000)))), ms);
  const onAbort = () => ctrl.abort(signal?.reason);
  if (signal?.aborted) onAbort();
  else signal?.addEventListener('abort', onAbort, { once: true });
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

export function chatEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

/**
 * 端點印進錯誤訊息（給使用者看是打去哪裡失敗的）時只留 origin＋path，不要帶 query string——
 * 有些閘道把金鑰放在 query string 裡，原樣印出去等於把憑證洩到 UI 與 log。
 */
function endpointLabel(endpoint: string): string {
  try {
    const u = new URL(endpoint);
    return `${u.origin}${u.pathname}`;
  } catch {
    return t().errors.ai.invalidEndpointUrl;
  }
}

export function originPattern(baseUrl: string): string {
  return `${new URL(baseUrl).origin}/*`;
}

/** 使用者自訂端點屬 optional_host_permissions，需先在設定頁授權 */
export async function hasEndpointPermission(baseUrl: string): Promise<boolean> {
  try {
    return await browser.permissions.contains({ origins: [originPattern(baseUrl)] });
  } catch {
    return false;
  }
}

export async function requestEndpointPermission(baseUrl: string): Promise<boolean> {
  return browser.permissions.request({ origins: [originPattern(baseUrl)] });
}

/** 不允許使用者覆蓋的欄位：改了就無法解析回應 */
const PROTECTED_BODY_KEYS = ['messages', 'stream', 'model'];

/** 解析設定頁的「額外請求參數」；不是合法 JSON 物件就當作沒填 */
export function parseExtraBody(text: string | undefined): Record<string, unknown> | undefined {
  if (!text || !text.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    const out = { ...(parsed as Record<string, unknown>) };
    for (const key of PROTECTED_BODY_KEYS) delete out[key];
    return Object.keys(out).length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

/** 由設定組出 ChatOptions；未設定的選填欄位一律不放進去，避免送出多餘參數 */
export function chatOptionsFrom(ai: AiSettings, overrides: Partial<ChatOptions> = {}): ChatOptions {
  const extraBody = parseExtraBody(ai.extraBody);
  return {
    baseUrl: ai.baseUrl,
    apiKey: ai.apiKey,
    model: ai.model,
    ...(ai.temperature !== undefined ? { temperature: ai.temperature } : {}),
    ...(extraBody ? { extraBody } : {}),
    ...overrides,
  };
}

/** content 可能是字串，也可能是 parts 陣列（部分閘道會這樣回） */
function textOf(content: RawMessage['content']): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p) => (p.type === 'text' ? p.text : '')).join('');
  return '';
}

export async function chatCompletion(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
  const startedAt = Date.now();
  if (!opts.baseUrl || !opts.model) throw new AppError('api', t().errors.ai.noEndpointOrModel, { retryable: false });
  if (!(await hasEndpointPermission(opts.baseUrl))) {
    throw new AppError('forbidden', t().errors.ai.notAuthorized, {
      retryable: false,
    });
  }
  const endpoint = chatEndpoint(opts.baseUrl);
  const key = `${opts.baseUrl}|${opts.model}`;
  const useJson = (opts.jsonMode ?? 'auto') === 'auto' && !jsonUnsupported.has(key);

  const attempt = async (withJson: boolean): Promise<Response> => {
    const body: Record<string, unknown> = { ...(opts.extraBody ?? {}), model: opts.model, messages };
    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    if (withJson) body.response_format = { type: 'json_object' };
    const timeout = withTimeout(opts.signal, AI_TIMEOUT_MS);
    try {
      return await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: timeout.signal,
      });
    } catch (e) {
      // 逾時的 abort 帶著我們自己的 AppError（呼叫端取消時帶的是原本的 reason）
      if (opts.signal?.aborted) throw toAppError(e);
      const reason: unknown = timeout.signal.reason;
      if (reason instanceof AppError) throw reason;
      const err = toAppError(e);
      if (err.kind === 'aborted') throw err;
      throw new AppError(err.kind, t().errors.ai.withEndpointSuffix(err.message, endpointLabel(endpoint)), {
        retryable: err.retryable,
        cause: e,
      });
    } finally {
      timeout.done();
    }
  };

  let res = await attempt(useJson);
  let errorBody = '';
  if (!res.ok && useJson && res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429) {
    // 只有端點確實在抱怨 response_format 時才改用純文字重送：
    // 否則 extraBody 打錯之類的 400 會被誤判成「這個端點不支援 JSON 模式」而永久記住。
    errorBody = (await res.text().catch(() => '')).slice(0, 300);
    if (complainsAboutJsonMode(errorBody)) {
      jsonUnsupported.add(key);
      res = await attempt(false);
      errorBody = '';
    }
  }
  recordActivity({
    endpoint: 'chat/completions',
    detail: opts.model,
    result: res.ok ? `${res.status} · ${Math.round((Date.now() - startedAt) / 100) / 10} s` : `HTTP ${res.status}`,
    kind: res.ok ? 'ok' : 'bad',
  });
  if (!res.ok) {
    const text = errorBody || (await res.text().catch(() => '')).slice(0, 300);
    const retryable = res.status === 429 || res.status >= 500;
    const hint = res.status === 404 ? t().errors.ai.hint404 : res.status === 401 ? t().errors.ai.hint401 : '';
    throw new AppError(
      retryable ? 'network' : 'api',
      t().errors.ai.httpError(endpointLabel(endpoint), res.status, text || res.statusText, hint),
      {
        code: res.status,
        retryable,
      },
    );
  }
  let json: ChatCompletionResponse;
  try {
    json = (await res.json()) as ChatCompletionResponse;
  } catch (e) {
    throw new AppError('parse', t().errors.ai.notJson, { cause: e });
  }
  const choice = json.choices?.[0];
  if (!choice) {
    throw new AppError('api', t().errors.ai.noChoices(json.error?.message));
  }
  const content = textOf(choice.message?.content);
  const reasoning = (choice.message?.reasoning_content ?? choice.message?.reasoning ?? '').trim();
  if (!content.trim() && !reasoning) {
    // 推理模型把輸出額度花在思考上、或 max_tokens 太小時會走到這裡
    const facts = [
      choice.finish_reason ? `finish_reason=${choice.finish_reason}` : '',
      json.usage?.completion_tokens !== undefined ? `completion_tokens=${json.usage.completion_tokens}` : '',
    ].filter(Boolean);
    throw new AppError('api', t().errors.ai.noReplyContent(facts, choice.finish_reason === 'length'), {
      retryable: false,
    });
  }
  const result: ChatResult = { content };
  if (reasoning) result.reasoningContent = reasoning;
  if (choice.finish_reason) result.finishReason = choice.finish_reason;
  if (json.usage) result.usage = json.usage;
  return result;
}
