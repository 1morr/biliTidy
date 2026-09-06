import { chatCompletion, chatOptionsFrom, type ChatResult } from '@/ai/client';
import { parseClassification } from '@/ai/parser';
import {
  buildSystemPrompt,
  buildUserMessage,
  codeFolders,
  contentToText,
  toRealIds,
  type ClassifyPrompt,
  type PromptFolder,
  type PromptVideo,
} from '@/ai/prompt';
import { t } from '@/i18n';
import { withRetry, type RetryOptions } from '@/net/backoff';
import { AppError } from '@/shared/result';
import type { AiSettings, ClassificationItem } from '@/shared/types';

/** 一次 AI 往返的完整紀錄；除錯視窗用，只放記憶體、不寫進任務快照（2000 支的 prompt 會撐爆 storage） */
export interface ClassifyRecord {
  bvids: string[];
  system: string;
  user: string;
  response: string;
  reasoningContent?: string;
  finishReason?: string;
  usage?: ChatResult['usage'];
  coverCount: number;
}

export interface ClassifyRequest {
  /** 影片目前所在的收藏夾。給了＝整理流程（預設留在原地）；不給＝影片頁（挑一個最合適的） */
  source?: PromptFolder;
  /** 可以搬進／收進的收藏夾，帶**真正的 media_id**；內部會換成 1..N 短號再送出去 */
  folders: PromptFolder[];
  videos: PromptVideo[];
  /** 一支影片最多回幾個目標；不給＝不限制 */
  maxTargets?: number;
}

export interface ClassifyOptions {
  signal?: AbortSignal;
  onWait?: RetryOptions['onWait'];
  /**
   * 紀錄一組好就回報——**在空回覆檢查之前**。
   * 「模型只回思考內容」會丟錯，那時呼叫端拿不到回傳值，但除錯視窗仍該看得到送出去的是什麼。
   */
  onRecord?: (record: ClassifyRecord) => void;
}

export interface ClassifyResult {
  /** 每支輸入影片一筆、順序與 videos 一致；targetFolderIds 已換回 media_id 並依 maxTargets 截斷 */
  items: ClassificationItem[];
  parseError: boolean;
  record: ClassifyRecord;
}

/**
 * 一次分類請求的唯一入口。固定走：codeFolders → 組訊息 → withRetry(chatCompletion)
 * → 空回覆檢查 → parseClassification → toRealIds → maxTargets 截斷。
 *
 * 整理流程（有 source、一批多支）與影片頁的「智慧收藏」（無 source、單支）都走這一支。
 * 兩邊曾經各寫一份，結果影片頁少了退避重試、少了封面規則，「只回思考內容」的處理也不一樣——
 * 加新的分類入口時不要再複製這五個步驟，補參數就好。
 *
 * 落在 `core` 而不是 `ai`：退避重試是編排層的政策，`ai` 那三個葉節點目前只依賴 `shared`，
 * 把 `net/backoff` 拉進去會多一條跨葉邊。
 */
export async function classify(ai: AiSettings, req: ClassifyRequest, opts: ClassifyOptions = {}): Promise<ClassifyResult> {
  // 短號是逐次算的，但只要 folders 陣列同一份、順序沒變，每一批算出來的對照表就一樣，
  // 除錯視窗看到的 id 才會跟模型回覆對得起來（呼叫端不要在迴圈裡對 folders 做 filter／sort）。
  const codes = codeFolders(req.folders, req.source);
  const prompt: ClassifyPrompt = {
    ...(codes.codedSource ? { source: codes.codedSource } : {}),
    folders: codes.coded,
    videos: req.videos,
    ...(req.maxTargets !== undefined ? { maxTargets: req.maxTargets } : {}),
  };
  const system = buildSystemPrompt(prompt, ai.customInstructions);
  const content = buildUserMessage(prompt);
  const bvids = req.videos.map((v) => v.basic.bvid);

  const result = await withRetry(
    () =>
      chatCompletion(
        [
          { role: 'system', content: system },
          { role: 'user', content },
        ],
        chatOptionsFrom(ai, opts.signal ? { signal: opts.signal } : {}),
      ),
    { ...(opts.signal ? { signal: opts.signal } : {}), ...(opts.onWait ? { onWait: opts.onWait } : {}) },
  );

  const record: ClassifyRecord = {
    bvids,
    system,
    user: contentToText(content),
    response: result.content,
    coverCount: req.videos.filter((v) => v.coverDataUrl).length,
  };
  if (result.reasoningContent) record.reasoningContent = result.reasoningContent;
  if (result.finishReason) record.finishReason = result.finishReason;
  if (result.usage) record.usage = result.usage;
  opts.onRecord?.(record);

  if (!result.content.trim()) {
    // 推理模型只回了思考內容：再跑下去只會整批分不出來，直接停並說明原因
    throw new AppError('api', t().errors.ai.onlyReasoningNoReply, {
      retryable: false,
    });
  }

  const parsed = parseClassification(result.content, bvids, codes.validIds);
  const max = req.maxTargets ?? Number.POSITIVE_INFINITY;
  // 模型回的是短號，換回真正的 media_id 之後才交給 UI 與寫入。
  // 來源短號要先拆出來：它不是搬移目標，而是「這支留在原地」——同時還有目標時就是
  // 「留下並複製一份過去」。回空陣列（舊寫法，模型偶爾還是會這樣答）一樣是留在原地。
  const items = parsed.items.map((item) => {
    const keepSource = codes.sourceCode !== undefined && item.targetFolderIds.includes(codes.sourceCode);
    const targets =
      codes.sourceCode === undefined ? item.targetFolderIds : item.targetFolderIds.filter((id) => id !== codes.sourceCode);
    const next: ClassificationItem = { ...item, targetFolderIds: toRealIds(codes, targets).slice(0, max) };
    if (keepSource && next.targetFolderIds.length > 0) next.keepSource = true;
    return next;
  });
  return { items, parseError: parsed.parseError !== undefined, record };
}
