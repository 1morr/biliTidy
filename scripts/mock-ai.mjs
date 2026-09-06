// 本機 mock 的 OpenAI 相容端點，供煙霧測試與離線開發使用。
// 行為：帶圖片的請求回「粉色圓形與白色資料夾」；分類請求回每支影片 target_folder_ids=[]（不搬移）。
// 用法：node scripts/mock-ai.mjs [port]  （預設 8787）；在設定頁填 http://127.0.0.1:8787/v1、model 任意。
import http from 'node:http';

export function createMockAiServer() {
  return http.createServer((req, res) => {
    if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
      res.writeHead(404).end();
      return;
    }
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: { message: 'bad json' } }));
        return;
      }
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const parts = messages.flatMap((m) =>
        Array.isArray(m.content) ? m.content : [{ type: 'text', text: String(m.content ?? '') }],
      );
      const hasImage = parts.some((p) => p.type === 'image_url');
      const text = parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('\n');
      let content;
      if (/待分類影片/.test(text)) {
        const bvids = Array.from(text.matchAll(/### 影片 \d+（(BV[0-9A-Za-z]+)）/g)).map((m) => m[1]);
        content = JSON.stringify({
          results: bvids.map((bvid) => ({ bvid, target_folder_ids: [], reason: 'mock：不搬', confidence: 'high' })),
        });
      } else if (hasImage) {
        content = '粉色圓形與白色資料夾';
      } else {
        content = 'OK';
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          id: 'mock',
          object: 'chat.completion',
          model: body.model ?? 'mock',
          choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
          usage: { prompt_tokens: text.length, completion_tokens: content.length },
        }),
      );
    });
  });
}

if (process.argv[1] && process.argv[1].endsWith('mock-ai.mjs')) {
  const port = Number(process.argv[2] ?? 8787);
  createMockAiServer().listen(port, '127.0.0.1', () => console.log(`mock AI listening on http://127.0.0.1:${port}/v1`));
}
