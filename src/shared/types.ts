/** 跨層共用的資料模型。B 站時間戳為 Unix 秒；本機時間戳為毫秒（欄位名以 At 結尾）。 */

export interface AiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 「測試連線」通過的時間；undefined = 沒連過線，設定頁只說「端點已填」而不是「已連線」 */
  connectionVerifiedAt?: number;
  /** 使用者手動勾選「模型支援視覺」 */
  visionSupported: boolean;
  /** 「測試」按鈕實際驗證通過的時間；undefined = 未驗證，所有視覺功能停用 */
  visionVerifiedAt?: number;
  /** 附上封面縮圖給模型看（需視覺驗證通過才生效） */
  attachCover: boolean;
  batchSizeText: number;
  batchSizeVision: number;
  /** undefined = 不送出 temperature（推理模型多半只接受預設值） */
  temperature?: number;
  /** 額外請求參數（JSON 字串），原樣合併進 request body，例如關閉思考模式 */
  extraBody?: string;
  /** 使用者自訂的分類指示，附加在 system prompt 後面 */
  customInstructions?: string;
}

export interface RateSettings {
  /** 讀取請求速率（每秒） */
  readRps: number;
  /** 寫入請求最小間隔（毫秒） */
  writeIntervalMs: number;
  /** 每次 resource/move 的最多筆數 */
  moveBatchSize: number;
}

/**
 * 三個資料來源都是單純的開關。曾經有過「智慧」這一階（只補文字線索不足的影片），
 * 實測字幕只有 1.6% 的影片會觸發、附圖也沒有比全開準，卻讓估算、流程說明與批次切分
 * 各多三條分支，所以整個移除（`docs/design.md` 3.2）。
 */
export interface FeatureSettings {
  /** 影片詳情（標籤、合集、分區）：每支 1 次請求 */
  fetchDetail: boolean;
  /** 字幕：優先人工字幕，沒有才用 AI 字幕；每支最多再多 2 次請求 */
  fetchSubtitle: boolean;
}

/** 關注清理的設定：門檻在審核頁左軌改、「包含悄悄關注」在準備畫面改，兩個都存起來 */
export interface FollowSettings {
  /** 不活躍門檻（天）：距最後一支影片嚴格大於這個天數才算不活躍 */
  thresholdDays: number;
  /** 悄悄關注也一併讀入、篩選與取關 */
  includeWhispers: boolean;
}

export interface Settings {
  version: 1;
  ai: AiSettings;
  /** 讀寫速率兩種任務共用：整理收藏與清理關注一次只跑一個，所以只有一把節流器 */
  rate: RateSettings;
  features: FeatureSettings;
  follows: FollowSettings;
}

/** 單次整理的範圍：全部，或最近收藏的前 N 支 */
export interface RunScope {
  mode: 'all' | 'latest';
  count: number;
}

export interface FolderMeta {
  id: number;
  title: string;
  mediaCount: number;
  attr: number;
  isPrivate: boolean;
  isDefault: boolean;
  /** B 站端簡介 */
  intro?: string;
  /** B 站端封面圖 URL */
  cover?: string;
}

export interface VideoBasic {
  bvid: string;
  aid: number;
  /** 2 影片、12 音訊、21 合集 */
  type: number;
  title: string;
  cover: string;
  intro: string;
  duration: number;
  pageCount: number;
  upperName: string;
  /** attr !== 0：已失效（被刪除） */
  invalid: boolean;
}

export interface SeasonInfo {
  title: string;
  intro?: string;
  epCount: number;
  /** 同合集其他影片標題（排除自己，最多 8 條） */
  siblingTitles: string[];
}

export interface VideoDetail {
  bvid: string;
  fetchedAt: number;
  schema: 1;
  tags: string[];
  /** 第一 P 的 cid（抓字幕用） */
  cid?: number;
  /** 由本地 tid 表查得；未知時為空字串 */
  zone: string;
  dynamic?: string;
  season?: SeasonInfo;
  staff?: string[];
  pageTitles?: string[];
  subtitleText?: string;
  /** 字幕來源：人工上傳或 AI 生成 */
  subtitleFrom?: 'human' | 'ai';
}

export interface ClassificationItem {
  bvid: string;
  targetFolderIds: number[];
  /** 模型把來源收藏夾也列進答案：留在原地，targetFolderIds 是額外要複製過去的夾 */
  keepSource?: boolean;
  reason: string;
  /** 模型自陳的判斷依據（標籤、合集、封面…），最多 3 個 */
  basis?: string[];
  /** 模型自評資訊不足、只能猜 */
  lowConfidence?: boolean;
}

export type ReviewStatus = 'pending' | 'moving' | 'done' | 'failed' | 'removed';

export interface ReviewRow {
  bvid: string;
  aid: number;
  type: number;
  title: string;
  cover: string;
  seasonTitle?: string;
  /** 影片已失效（被刪除／私有化）：不分類、不搬移，只能從收藏夾移除 */
  invalid?: boolean;
  suggested: number[];
  /** 模型建議的 keepSource；「全部採用建議」要能把整個建議還原，不只是目標清單 */
  suggestedKeep?: boolean;
  /** 使用者最終選擇的目標收藏夾（空 = 不搬） */
  chosen: number[];
  /**
   * 保留在來源收藏夾：目標全部用 `resource/copy`，來源那份不動。
   * 一支影片本來就可以同時在多個收藏夾裡，「搬到別的夾子」與「也放一份到別的夾子」
   * 是兩件不同的事，這個旗標決定寫入時用 copy 還是 move（`docs/design.md` 6.1）。
   */
  keepSource?: boolean;
  reason: string;
  /** 模型自陳的判斷依據 */
  basis?: string[];
  /** 模型自評資訊不足、只能猜 */
  lowConfidence?: boolean;
  status: ReviewStatus;
  error?: string;
}

export type JobPhase =
  | 'idle'
  | 'fetchingList'
  | 'fetchingDetail'
  | 'fetchingCovers'
  | 'classifying'
  | 'review'
  | 'moving'
  | 'done'
  | 'paused'
  | 'error';

export interface Progress {
  done: number;
  total: number;
  label: string;
}

export interface JobStats {
  fetched: number;
  cached: number;
  aiCalls: number;
  moved: number;
  /** 保留原位、只複製一份出去的影片數 */
  copied: number;
  failed: number;
  /** 已從收藏夾移除的失效影片數 */
  removed: number;
  /** 詳情抓不到的影片數（這些只靠列表欄位分類，準確度會下降） */
  detailFailed: number;
}

// ---- 清理關注（原 biliFollowCleaner；型別加上 Follow 前綴，與上面整理收藏的 ReviewRow／JobPhase／JobStats 區分）----

/** B 站關注分組。`id` -10＝特別關注、0＝默认分组，其餘是使用者自訂的 */
export interface FollowTag {
  id: number;
  name: string;
  count: number;
}

/** 一般關注／互相關注／悄悄關注（後者功能已下線但既有資料仍在，取關要用不同的 act） */
export type FollowKind = 'follow' | 'mutual' | 'whisper';

/** 關注清單裡的一個帳號（`relation/followings`／`whispers` 的一列，只留用得到的欄位） */
export interface FollowEntry {
  mid: number;
  name: string;
  face: string;
  sign: string;
  /** 所屬分組 id；默认分组的帳號 API 回 `tag: null`，這裡收成空陣列 */
  tagIds: number[];
  /** 特別關注 */
  special: boolean;
  kind: FollowKind;
  /** 關注時間（Unix 秒） */
  followedAt: number;
  /** 認證說明（UP 主／機構認證），沒有為空字串 */
  verify: string;
}

/** 一次讀完的關注清單 */
export interface FollowSnapshot {
  mid: number;
  fetchedAt: number;
  tags: FollowTag[];
  entries: FollowEntry[];
  /** `relation/stat` 回報的關注數與悄悄關注數，用來核對有沒有抓齊 */
  reported: { following: number; whisper: number };
}

/**
 * 逐帳號查最新影片的三態結果（沿用 Java 版）：
 * `videos`＝`code 0` 且投稿列表有東西；`noVideos`＝`code 0` 且 `page.count === 0`；
 * `unknown`＝其餘一切（請求失敗、非 0 code、風控、說有投稿卻一支都沒回）。未知的帳號永遠不能被當成不活躍。
 */
export type ActivityStatus = 'videos' | 'noVideos' | 'unknown';

export interface LatestArchive {
  bvid: string;
  title: string;
  /** 發布時間（Unix 秒） */
  pubdate: number;
}

export interface ActivityRecord {
  mid: number;
  status: ActivityStatus;
  /** 最新一支影片（`status === 'videos'` 時才有） */
  latest?: LatestArchive;
  checkedAt: number;
  /** `unknown` 時的原因（錯誤訊息），給畫面顯示 */
  reason?: string;
  /** 2＝改用 `space/wbi/arc/search` 之後的紀錄；1 是 `recArchivesByKeywords` 那版，會誤判成「從未投稿」，一律作廢 */
  schema: 2;
}

/**
 * 關注審核表每一列的操作狀態。`pending` 是唯一可以被勾選的狀態；
 * 取關成功是 `done`，撤銷（重新關注）成功是 `restored`。
 */
export type FollowRowStatus = 'pending' | 'unfollowing' | 'done' | 'failed' | 'restoring' | 'restored' | 'restoreFailed';

/** 關注審核表的一列：關注清單 × 活躍度查詢結果 × 這次的操作狀態 */
export interface FollowRow {
  entry: FollowEntry;
  /** 尚未查過（本輪被取消或風控停下）為 undefined；畫面上與 `unknown` 一樣都不能選 */
  activity?: ActivityRecord;
  status: FollowRowStatus;
  /** 失敗原因 */
  error?: string;
  /** 非失敗的備註，例如「分組沒有還原」「悄悄關注已改為一般關注」 */
  note?: string;
}

export type FollowPhase = 'idle' | 'fetchingFollows' | 'checking' | 'review' | 'unfollowing' | 'restoring' | 'error';

export interface FollowStats {
  /** 這次實際打了 API 查活躍度的帳號數 */
  fetched: number;
  /** 直接用快取的帳號數 */
  cached: number;
  /** 查不到狀態的帳號數 */
  unknown: number;
  unfollowed: number;
  failed: number;
  restored: number;
}
