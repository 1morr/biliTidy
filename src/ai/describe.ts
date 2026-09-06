import { clip } from '@/shared/text';
import type { AiSettings } from '@/shared/types';
import { chatCompletion, chatOptionsFrom } from './client';

/** 一支樣本影片；只用列表就拿得到的欄位，不打 view/detail */
export interface DescribeSample {
  title: string;
  intro?: string;
}

/**
 * 生成描述的長度上限。描述是要餵回分類 prompt 的，一句話就夠：越長越容易把樣本裡的
 * 細節寫成收錄標準，下一次分類就照那個窄範圍搬影片（`docs/design.md` 5.2 的自我強化）。
 * 目標 10 字左右，20 是硬上限；手寫的描述不受這個限制。
 */
export const DESCRIBE_MAX_CHARS = 20;
/** 一次最多送幾支樣本 */
export const DESCRIBE_SAMPLE_MAX = 80;

export interface DescribeInput {
  folderTitle: string;
  /** 從整個收藏夾平均取樣來的影片 */
  samples: DescribeSample[];
  /** 收藏夾實際有幾支；讓模型知道樣本只是一部分，不要當成全部 */
  totalCount?: number;
  /** 使用者原本寫的描述；有的話代表收錄意圖，模型要沿用它的範圍 */
  current?: string;
}

export const DESCRIBE_SYSTEM_PROMPT = `你要幫使用者寫一個 Bilibili 收藏夾的「收錄標準」。使用者會給收藏夾名稱與夾子裡的一批影片（從整個收藏夾平均取樣，新舊都有），你要歸納出它實際上在收什麼，寫成一句話給分類 AI 看。

規則：
1. 用繁體中文寫成**一句話**，目標 10 字左右、最多 ${DESCRIBE_MAX_CHARS} 字以內；不要條列、不要標題、不要引號、不要句號。
2. 只寫最上位的主題與內容形式（例如「插畫與繪師作品」「粵語翻唱與改編」「之後想補看的影片」），不要把影片標題重述一遍，也不要出現具體的影片名稱或 UP 主名稱。
3. 寫整個收藏夾的共同點，一律寫寬。某個角色、作品、語言、題材或子類型只佔樣本的一部分時，不可以把它寫成整個夾子的主軸，也不要寫「以…為主」「以…為中心」；只有幾乎每一支都符合才寫得進描述。範圍拿不準時寧可涵蓋多一點，也不要縮到只涵蓋一部分影片。
4. 使用者原本寫的描述（有給的話）代表他的收錄意圖：沿用它的範圍，只有夾子裡的影片明顯超出它時才放寬，不要因為樣本的組成把它改窄。
5. 樣本裡有少數明顯不屬於這個夾的影片時忽略它們，不要為了涵蓋它們硬加一個類別。
6. 字數不夠時先捨棄細節、子類型與例外，保留最上位的那個主題；不要寫排除條件（「不收…」）。
7. 只輸出這句話本身，不要任何前言、說明或標點以外的符號。`;

export function buildDescribeUserText(input: DescribeInput): string {
  const used = input.samples.slice(0, DESCRIBE_SAMPLE_MAX);
  const total = input.totalCount ?? used.length;
  const head = [`收藏夾名稱：${input.folderTitle}`];
  const current = (input.current ?? '').trim();
  if (current) head.push(`使用者原本寫的描述：${current}`);
  head.push(total > used.length ? `從全部 ${total} 支裡平均取樣的 ${used.length} 支影片：` : `夾子裡的 ${used.length} 支影片：`);
  const lines = used.map((s, i) => {
    const intro = clip(s.intro ?? '', 60);
    return `${i + 1}. ${clip(s.title, 80)}${intro ? `（簡介：${intro}）` : ''}`;
  });
  return `${head.join('\n')}\n${lines.join('\n')}`;
}

/** 模型偶爾會加引號、圍欄、「描述：」前綴或句號，這裡一併清掉並截到上限 */
export function cleanDescription(raw: string): string {
  const text = raw
    .replace(/```[a-z]*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(描述|收錄標準|答)[:：]\s*/, '')
    .replace(/^["'「『]|["'」』]$/g, '')
    // 一句話不需要句號，留著只會佔掉 20 字裡的一格
    .replace(/[。.]+$/, '')
    .trim();
  return text.length > DESCRIBE_MAX_CHARS ? text.slice(0, DESCRIBE_MAX_CHARS) : text;
}

/** 依收藏夾裡現有的影片歸納出一段描述。不寫入任何東西，由呼叫端決定要不要採用。 */
export async function generateDescription(ai: AiSettings, input: DescribeInput, signal?: AbortSignal): Promise<string> {
  const result = await chatCompletion(
    [
      { role: 'system', content: DESCRIBE_SYSTEM_PROMPT },
      { role: 'user', content: buildDescribeUserText(input) },
    ],
    chatOptionsFrom(ai, { jsonMode: 'off', ...(signal ? { signal } : {}) }),
  );
  return cleanDescription(result.content);
}
