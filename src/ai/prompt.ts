import type { VideoBasic, VideoDetail } from '@/shared/types';
import { clip } from '@/shared/text';
import type { ContentPart } from './client';

export interface PromptFolder {
  id: number;
  title: string;
  description: string;
}

/**
 * 送給模型的收藏夾編號。B 站的 media_id 是 10 位數（例如 2271580846），實測較弱的模型
 * 會把理由寫對、id 卻抄成別的夾（「標籤含绘画」卻選到音聲夾、「標籤含绝区零」卻選到原神夾）；
 * 換成 1..N 的短號之後同一個模型、同一批資料就不再出現這種錯誤
 * （`docs/research/classify-eval-2026-08.md` §5），順帶每批省下約 200 tokens。
 * 短號只存在於 prompt 與模型回覆裡，解析完立刻用 `toRealIds` 換回真正的 media_id。
 */
export interface FolderCodes {
  /** 換成短號後、要放進 prompt 的目標收藏夾（順序與傳入的一致） */
  coded: PromptFolder[];
  /** 換成短號後的來源收藏夾（整理流程才有）；固定是 1，因為它在使用者訊息裡排第一 */
  codedSource?: PromptFolder;
  /** 來源收藏夾的短號。模型把它列進 target_folder_ids ＝「這支留在原地」 */
  sourceCode?: number;
  /** 短號 → 真正的 media_id */
  realOf: Map<number, number>;
  /** 合法短號；交給 parser 當作允許的 id 集合 */
  validIds: Set<number>;
}

/**
 * 來源收藏夾也給一個短號（固定 1，目標從 2 開始）。
 *
 * 它原本刻意不給 id，「留在原地」只能用空陣列表達——代價是模型答不出「這支同時屬於現在這個夾
 * 與另一個夾」，被迫在「不動」與「搬走」之間二選一（`docs/design.md` 6.1）。給了 id 之後
 * `target_folder_ids` 的語意變成「這支最後應該在哪些收藏夾裡」，三種答案都表達得出來：
 * `[1]` 留在原地、`[1,3]` 留在原地並複製一份到 3、`[3]` 搬到 3。
 */
export function codeFolders(folders: PromptFolder[], source?: PromptFolder): FolderCodes {
  const offset = source ? 1 : 0;
  const coded = folders.map((f, i) => ({ ...f, id: i + 1 + offset }));
  const realOf = new Map<number, number>();
  if (source) realOf.set(1, source.id);
  folders.forEach((f, i) => realOf.set(i + 1 + offset, f.id));
  const codes: FolderCodes = { coded, realOf, validIds: new Set(realOf.keys()) };
  if (source) {
    codes.codedSource = { ...source, id: 1 };
    codes.sourceCode = 1;
  }
  return codes;
}

/** 把模型回的短號換回 media_id；認不得的號碼直接丟掉 */
export function toRealIds(codes: FolderCodes, ids: number[]): number[] {
  const out: number[] = [];
  for (const id of ids) {
    const real = codes.realOf.get(id);
    if (real !== undefined && !out.includes(real)) out.push(real);
  }
  return out;
}

export interface PromptVideo {
  basic: VideoBasic;
  detail?: VideoDetail;
  /** 視覺模式：封面 data URL */
  coverDataUrl?: string;
}

/**
 * 一次分類請求要送出去的東西。整理流程與影片頁的「智慧收藏」共用這個型別與底下所有的組裝函式：
 * 兩者的差別只有「有沒有來源收藏夾」與「最多挑幾個目標」，其餘的判斷原則、輸出格式、欄位排法
 * 全部一樣。曾經各寫一份，結果影片頁少了封面規則卻照樣送圖。
 */
export interface ClassifyPrompt {
  /** 有＝整理流程（影片已經在某個夾裡，預設留在原地）；沒有＝影片頁（還沒收藏，挑一個最合適的） */
  source?: PromptFolder;
  /** 可選的目標收藏夾。要先經過 `codeFolders`，id 才會是短號 */
  folders: PromptFolder[];
  videos: PromptVideo[];
  /** 最多建議幾個收藏夾；影片頁是一鍵操作，太多目標反而難確認 */
  maxTargets?: number;
}

/** 影片頁一支影片最多建議幾個收藏夾 */
export const QUICK_FAV_MAX_TARGETS = 2;

export const INTRO_MAX_CHARS = 200;
export const SUBTITLE_MAX_CHARS = 400;
/** 合集簡介：通常一兩句話就說完這個合集在做什麼，不需要留太多空間 */
export const SEASON_INTRO_MAX_CHARS = 60;

/** basis 的合法值；解析時用它擋掉模型自己發明的欄位名 */
export const BASIS_VALUES = ['標籤', '合集', '標題', '簡介', '封面', '分區', '時長', 'UP', '字幕', '分P'] as const;
export const BASIS_MAX = 3;

/** 自訂指示長度上限；超過就截斷，避免把 system prompt 灌爆 */
export const CUSTOM_INSTRUCTIONS_MAX = 1000;

/**
 * 兩種情境共用的判斷原則。這裡只放「不管影片在不在收藏夾裡都成立」的規則——
 * 「預設留在原地」那類跟情境綁在一起的話留給下面的 CONTEXT。
 */
const BASE_RULES = `判斷原則：
1. 收藏夾「描述」是使用者親自寫的收錄標準，優先級最高；名稱次之。
2. 影片資訊的參考順序：標籤 > 合集名稱與同合集其他影片 > 標題 > 簡介 > 分區 > 時長與 UP 主。合集名稱通常直接說明內容類型（例如「百日繪」「漫畫解說」）。
3. 若附有封面圖，請用它判斷內容形式（插畫／實拍／遊戲畫面／3D／截圖等），特別是標題抽象的短片。
4. 收藏夾名稱或描述指的是特定作品／遊戲／IP 時，只有影片真的屬於那個作品才算相符；不同的作品或遊戲一律不算（名稱相近也不算）。
5. basis 填你實際用來下判斷的欄位，只能從這組挑：${BASIS_VALUES.join('、')}；最多 ${BASIS_MAX} 個，依重要性由高到低排序。
6. reason 用繁體中文、20 字以內，直接寫出那個依據的內容（例如「標籤含原神」「合集《DJ歌单》」「封面為插畫」），不要只寫「內容相符」。
7. confidence 為 "high" 或 "low"：資訊不足、只能猜測時填 "low"。`;

const OUTPUT_RULES = `輸出規則：只輸出一個 JSON 物件，不要加任何說明文字或 Markdown 圍欄。格式：
{"results":[{"bvid":"BV1xxx","target_folder_ids":[2],"basis":["標籤"],"reason":"標籤含原神","confidence":"high"}]}
target_folder_ids 只能填上面出現過的 id 數字，原樣照抄那一行的 id。`;

const ORGANIZE_OPENING = `你是 Bilibili 收藏夾整理助手。使用者會提供這批影片「目前所在的收藏夾」、一組可以搬入的「目標收藏夾」（都含 id、名稱與描述），以及一批影片的資訊。你要為每支影片決定：它最後應該待在哪些收藏夾裡。`;

const ORGANIZE_TASK = `這次要做的判斷：把這支影片應該待的收藏夾 id 全部列進 target_folder_ids。「目前所在收藏夾」也有 id，它是其中一個可以列的選項。
- 預設留在原地：影片已符合「目前所在收藏夾」的收錄標準，或沒有目標收藏夾明顯更合適時，只列「目前所在收藏夾」的 id。不要為了搬而搬。
- 只有某個目標收藏夾明顯比現在的位置更符合，才可以不列「目前所在收藏夾」——那代表把影片從現在的夾子搬走。
- 影片同時符合現在的夾子與某個目標收藏夾時，兩個 id 都列出來（代表留在原地，另外複製一份過去）。一支影片通常 1～2 個 id 就夠，依相關性由高到低排序。
- 「目前所在收藏夾」的描述空白、含糊，或本身就是「什麼都收」的暫存夾時，不算符合它的收錄標準：這種影片要找一個真正對應的目標收藏夾，不要因為「放這裡也可以」就把它列進去。
- reason 寫最主要的那個依據；只留在原地時寫留下的理由（例如「已符合現在的夾子」）。`;

const ORGANIZE_OUTPUT = `每支輸入影片都必須出現且只出現一次。`;

const QUICK_FAV_OPENING = `你是 Bilibili 收藏夾整理助手。使用者剛看完一支影片，想把它收藏起來。你會拿到使用者所有的收藏夾（名稱與描述）與這支影片的資訊，要決定它該收進哪一個收藏夾。`;

const quickFavTask = (maxTargets: number) => `這次要做的判斷：
- 通常只挑 1 個；影片真的同時屬於兩個主題時才多給，最多 ${maxTargets} 個。
- 沒有明顯合適的收藏夾就回傳空陣列，不要硬塞進最像的那一個。`;

const QUICK_FAV_OUTPUT = `results 只放這一支影片。`;

/**
 * 自訂指示排在判斷原則之後、優先級最高，但輸出格式規則不可被覆蓋
 * （模型改了輸出格式會讓整批解析失敗）。兩種情境共用這一支——設定頁只有一個欄位，
 * 不該只對其中一邊生效。
 */
export function withCustomInstructions(base: string, customInstructions?: string): string {
  const custom = customInstructions?.trim();
  if (!custom) return base;
  return `${base}

【使用者的額外指示】（與上述判斷原則衝突時以這裡為準，但輸出格式規則不可更動）
${custom.slice(0, CUSTOM_INSTRUCTIONS_MAX)}`;
}

/** 依情境組出系統提示：判斷原則兩邊一樣，開場白、這次的判斷與輸出補充各自不同。 */
export function buildSystemPrompt(req: ClassifyPrompt, customInstructions?: string): string {
  const organizing = req.source !== undefined;
  const opening = organizing ? ORGANIZE_OPENING : QUICK_FAV_OPENING;
  const task = organizing ? ORGANIZE_TASK : quickFavTask(req.maxTargets ?? QUICK_FAV_MAX_TARGETS);
  const outputSuffix = organizing ? ORGANIZE_OUTPUT : QUICK_FAV_OUTPUT;
  return withCustomInstructions(
    `${opening}

${BASE_RULES}

${task}

${OUTPUT_RULES}${outputSuffix}`,
    customInstructions,
  );
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function formatFolders(folders: PromptFolder[]): string {
  return folders
    .map((f) => `- id=${f.id} 名稱：${f.title}${f.description.trim() ? ` | 描述：${clip(f.description, 300)}` : ''}`)
    .join('\n');
}

/** 單支影片的文字區塊；欄位順序固定，空欄位整行省略 */
export function formatVideo(index: number, video: PromptVideo): string {
  const { basic, detail } = video;
  const lines: string[] = [`### 影片 ${index}（${basic.bvid}）`, `標題：${basic.title}`];
  if (detail?.tags.length) lines.push(`標籤：${detail.tags.join(', ')}`);
  if (detail?.season) {
    const s = detail.season;
    // 合集的簡介與同集標題都跟著 view/detail 一起回來，不多打任何請求；
    // 併在同一行而不是各佔一行，欄位清單才不會因為「有沒有合集」而長短不一。
    const intro = s.intro?.trim() ? ` — 簡介：${clip(s.intro, SEASON_INTRO_MAX_CHARS)}` : '';
    const siblings = s.siblingTitles.length ? ` — 同合集：${s.siblingTitles.join(' / ')}` : '';
    lines.push(`合集：《${s.title}》(共 ${s.epCount} 集)${intro}${siblings}`);
  }
  if (basic.intro.trim()) lines.push(`簡介：${clip(basic.intro, INTRO_MAX_CHARS)}`);
  if (detail?.dynamic) lines.push(`動態：${clip(detail.dynamic, 120)}`);
  if (detail?.zone) lines.push(`分區：${detail.zone}`);
  const duration = formatDuration(basic.duration);
  if (duration) lines.push(`時長：${duration}${basic.pageCount > 1 ? `（${basic.pageCount} P）` : ''}`);
  if (detail?.pageTitles?.length) lines.push(`分P：${detail.pageTitles.join(' / ')}`);
  if (basic.upperName) lines.push(`UP：${basic.upperName}`);
  if (detail?.staff?.length) lines.push(`合作：${detail.staff.join('、')}`);
  if (detail?.subtitleText) {
    const from = detail.subtitleFrom === 'ai' ? '（AI 生成）' : detail.subtitleFrom === 'human' ? '（人工）' : '';
    lines.push(`字幕${from}：${clip(detail.subtitleText, SUBTITLE_MAX_CHARS)}`);
  }
  return lines.join('\n');
}

const USER_SOURCE = '【目前所在收藏夾】';
const USER_TARGETS = '【目標收藏夾】';
const USER_VIDEOS = '【待分類影片】';
const USER_FOOTER = '請依系統規則輸出 JSON；沒有明顯更合適的目標收藏夾時，只列「目前所在收藏夾」的 id，讓影片留在原地。';
const QUICK_FAV_FOLDERS = '【可以收藏到的收藏夾】';
const QUICK_FAV_VIDEO = '【這支影片】';

/** 影片清單前面的抬頭：整理流程要先講「現在在哪」，影片頁沒有那一段 */
function header(req: ClassifyPrompt): string {
  const folders = formatFolders(req.folders);
  if (!req.source) return `${QUICK_FAV_FOLDERS}\n${folders}\n\n${QUICK_FAV_VIDEO}`;
  return `${USER_SOURCE}\n${formatFolders([req.source])}\n\n${USER_TARGETS}\n${folders}\n\n${USER_VIDEOS}`;
}

/**
 * 使用者訊息。有任何一支影片帶封面就走圖文交錯，否則純文字——
 * 呼叫端不必自己判斷要用哪一種，附圖與否已經在 `PromptVideo` 上了。
 *
 * 圖文交錯的排法：每支影片 =「影片 N 封面：」標籤 → 該封面 → 該影片文字欄位，
 * 讓模型不必跨區塊對應圖片與影片（多圖混淆的主要來源）。沒有封面的影片只出文字。
 */
export function buildUserMessage(req: ClassifyPrompt): string | ContentPart[] {
  const footer = req.source ? USER_FOOTER : '';

  if (!req.videos.some((v) => v.coverDataUrl)) {
    const lines = [header(req), req.videos.map((v, i) => formatVideo(i + 1, v)).join('\n\n')];
    if (footer) lines.push('', footer);
    return lines.join('\n');
  }

  const parts: ContentPart[] = [{ type: 'text', text: header(req) }];
  req.videos.forEach((v, i) => {
    const index = i + 1;
    if (v.coverDataUrl) {
      parts.push({ type: 'text', text: `影片 ${index}（${v.basic.bvid}）封面：` });
      parts.push({ type: 'image_url', image_url: { url: v.coverDataUrl, detail: 'low' } });
    }
    parts.push({ type: 'text', text: formatVideo(index, v) });
  });
  if (footer) parts.push({ type: 'text', text: footer });
  return parts;
}

/** 把圖文交錯的 content 攤平成純文字（除錯視窗與 prompt 預覽用；圖片以佔位符表示） */
export function contentToText(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content;
  return content.map((p) => (p.type === 'text' ? p.text : '【封面圖片（base64，已省略）】')).join('\n');
}
