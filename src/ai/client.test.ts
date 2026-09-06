import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatCompletion, parseExtraBody } from './client';

vi.mock('wxt/browser', () => ({
  browser: {
    permissions: {
      contains: async () => true,
      request: async () => true,
    },
  },
}));

const OPTS = { baseUrl: 'https://api.example.com/v1', apiKey: 'k', model: 'm', jsonMode: 'off' as const };

function mockFetch(body: unknown, init: ResponseInit = {}) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status: 200, ...init }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

function bodyOf(fn: ReturnType<typeof mockFetch>): Record<string, unknown> {
  const sent = fn.mock.calls[0]?.[1];
  return JSON.parse(String(sent?.body ?? '{}')) as Record<string, unknown>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseExtraBody', () => {
  it('空白、非 JSON、非物件都當作沒填', () => {
    expect(parseExtraBody(undefined)).toBeUndefined();
    expect(parseExtraBody('   ')).toBeUndefined();
    expect(parseExtraBody('{壞掉')).toBeUndefined();
    expect(parseExtraBody('[1,2]')).toBeUndefined();
    expect(parseExtraBody('{}')).toBeUndefined();
  });

  it('保留使用者參數、移除受保護欄位', () => {
    expect(parseExtraBody('{"thinking":{"type":"disabled"},"messages":[],"stream":true}')).toEqual({
      thinking: { type: 'disabled' },
    });
  });
});

describe('chatCompletion', () => {
  it('回傳 content，並且不會送出未設定的 temperature', async () => {
    const fetchFn = mockFetch({ choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] });
    const result = await chatCompletion([{ role: 'user', content: 'hi' }], OPTS);
    expect(result.content).toBe('OK');
    expect(result.finishReason).toBe('stop');
    expect(bodyOf(fetchFn)).not.toHaveProperty('temperature');
  });

  it('有設定 temperature 才送出', async () => {
    const fetchFn = mockFetch({ choices: [{ message: { content: 'OK' } }] });
    await chatCompletion([{ role: 'user', content: 'hi' }], { ...OPTS, temperature: 0.4 });
    expect(bodyOf(fetchFn).temperature).toBe(0.4);
  });

  it('content 是 parts 陣列時合併文字', async () => {
    mockFetch({
      choices: [
        {
          message: {
            content: [
              { type: 'text', text: 'A' },
              { type: 'text', text: 'B' },
            ],
          },
        },
      ],
    });
    const result = await chatCompletion([{ role: 'user', content: 'hi' }], OPTS);
    expect(result.content).toBe('AB');
  });

  it('推理模型只回 reasoning_content 時不算失敗', async () => {
    mockFetch({ choices: [{ message: { content: '', reasoning_content: '思考中' }, finish_reason: 'length' }] });
    const result = await chatCompletion([{ role: 'user', content: 'hi' }], OPTS);
    expect(result.content).toBe('');
    expect(result.reasoningContent).toBe('思考中');
  });

  it('完全沒有回覆時，錯誤訊息帶上 finish_reason 與截斷說明', async () => {
    mockFetch({ choices: [{ message: { content: '' }, finish_reason: 'length' }], usage: { completion_tokens: 10 } });
    await expect(chatCompletion([{ role: 'user', content: 'hi' }], OPTS)).rejects.toThrow(
      /no reply content.*finish_reason=length.*completion_tokens=10.*max_tokens/s,
    );
  });

  it('額外請求參數會合併進 body，但不能蓋掉 model／messages', async () => {
    const fetchFn = mockFetch({ choices: [{ message: { content: 'OK' } }] });
    await chatCompletion([{ role: 'user', content: 'hi' }], {
      ...OPTS,
      extraBody: parseExtraBody('{"thinking":{"type":"disabled"},"model":"hack","messages":[]}'),
    });
    const sent = bodyOf(fetchFn);
    expect(sent.thinking).toEqual({ type: 'disabled' });
    expect(sent.model).toBe('m');
    expect(sent.messages).toHaveLength(1);
  });

  it('404 時提示 base URL 可能少了 /v1', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Not Found', { status: 404 })),
    );
    await expect(chatCompletion([{ role: 'user', content: 'hi' }], OPTS)).rejects.toThrow(/404.*\/v1/s);
  });

  it('base URL 帶 query string（例如金鑰）時，錯誤訊息不能把它印出來', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('unauthorized', { status: 401 })),
    );
    await expect(
      chatCompletion([{ role: 'user', content: 'hi' }], { ...OPTS, baseUrl: 'https://gw.example.com/v1?key=super-secret' }),
    ).rejects.toThrow(/401/);
    try {
      await chatCompletion([{ role: 'user', content: 'hi' }], { ...OPTS, baseUrl: 'https://gw.example.com/v1?key=super-secret' });
    } catch (e) {
      expect(String(e)).not.toContain('super-secret');
    }
  });
});

describe('JSON 模式的自動偵測', () => {
  const auto = { ...OPTS, jsonMode: 'auto' as const, model: 'json-probe' };

  it('端點抱怨 response_format 時改用純文字重送', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        calls.push(body.response_format ? 'json' : 'plain');
        return body.response_format
          ? new Response('{"error":{"message":"response_format is not supported"}}', { status: 400 })
          : new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
      }),
    );
    const r = await chatCompletion([{ role: 'user', content: 'x' }], auto);
    expect(calls).toEqual(['json', 'plain']);
    expect(r.content).toBe('ok');
  });

  it('與 response_format 無關的 400 不會被誤判成不支援 JSON', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        calls.push(body.response_format ? 'json' : 'plain');
        return new Response('{"error":{"message":"unknown field: thinking"}}', { status: 400 });
      }),
    );
    await expect(chatCompletion([{ role: 'user', content: 'x' }], { ...auto, model: 'bad-extra-body' })).rejects.toThrow(
      /unknown field/,
    );
    expect(calls).toEqual(['json']);
  });
});
