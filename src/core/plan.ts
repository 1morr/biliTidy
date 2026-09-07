import type { Settings } from '@/shared/types';
import { attachesCover, isLocalEndpoint, isVisionActive } from './settings';

/**
 * 一份設定實際會怎麼跑：抓不抓詳情／字幕／封面、一批送幾支、AI 叫不叫得動。
 *
 * 這幾個判斷原本散在 `estimate`／`flow`／`promptPreview`／`organizer`／`quickFav`
 * 與三個 UI 頁面裡各算一次，「改一個要三個一起改」只能靠紀律維持——而字幕那條就是這樣漂走的
 * （影片頁少了「詳情關掉時字幕也不抓」的條件）。收成一支純函式之後，那條紀律變成型別保證。
 *
 * 與 `flow.ts` 的分工：這裡回答「這次會做什麼」（給程式判斷用的布林），
 * `planFlow` 回答「這些判斷要怎麼講給使用者聽」（給 UI 顯示用的步驟說明）。
 */
export interface RunPlan {
  /** 視覺功能可用：勾了「模型看得懂圖片」而且通過「測試視覺」 */
  visionActive: boolean;
  /** 抓影片詳情（標籤、合集、分區） */
  withDetail: boolean;
  /** 抓字幕。跟著詳情走：詳情不抓時字幕也不抓——整理流程與影片頁同一條規則 */
  withSubtitle: boolean;
  /** 附上封面給模型看 */
  withCover: boolean;
  /** 一批送幾支。附圖是全有全無，所以只有兩種可能 */
  batchSize: number;
  /** 端點與模型都填了才叫得動 AI */
  aiReady: boolean;
  /**
   * 端點需要金鑰但沒填。遠端端點少了 `Authorization` 就是一個 401，
   * 而那個失敗要等整批影片都讀完才會發生——所以在按下去之前就擋。
   * 本機模型（localhost／127.0.0.1）多半不收金鑰，那種端點不擋。
   */
  needsApiKey: boolean;
}

export function planOf(settings: Settings): RunPlan {
  const withDetail = settings.features.fetchDetail;
  const withCover = attachesCover(settings);
  const baseUrl = settings.ai.baseUrl.trim();
  return {
    visionActive: isVisionActive(settings),
    withDetail,
    withSubtitle: withDetail && settings.features.fetchSubtitle,
    withCover,
    batchSize: Math.max(1, withCover ? settings.ai.batchSizeVision : settings.ai.batchSizeText),
    aiReady: baseUrl !== '' && settings.ai.model.trim() !== '',
    needsApiKey: baseUrl !== '' && settings.ai.apiKey.trim() === '' && !isLocalEndpoint(baseUrl),
  };
}
