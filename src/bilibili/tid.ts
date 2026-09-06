// 來源：bilibili-API-collect docs/video/video_zone.md（fork 快照 cfc5fdd，2026-01）
// https://raw.githubusercontent.com/Xiaoyu44/bilibili-API-collect/cfc5fddcc8a94b74d91970bb5b4eaeb349addc47/docs/video/video_zone.md
// 實測 view API 的 tname 目前回空字串，故以本表由 tid 查分區名。
//
// 名稱由原文簡體轉換為繁體；「已下線」的子分區沿用文件標註。
// 文件「生活」分區下的 美食圈(76)、動物圈(75)、汽車(176)，以及「時尚」分區下的
// 健身(164)，皆為「(重定向)」項目，tid 與其他分區的現行子分區重複，
// 為避免 Record 出現重複 key，本表不重複收錄，只在對應的現行子分區加註曾用名。
export interface ZoneInfo {
  /** 子分區名 */
  name: string;
  /** 主分區名 */
  parent: string;
}

export const ZONES: Record<number, ZoneInfo> = {
  // 動畫
  1: { name: '動畫', parent: '動畫' },
  24: { name: 'MAD·AMV', parent: '動畫' },
  25: { name: 'MMD·3D', parent: '動畫' },
  47: { name: '同人·手書', parent: '動畫' },
  257: { name: '配音', parent: '動畫' },
  210: { name: '手辦·模玩', parent: '動畫' },
  86: { name: '特攝', parent: '動畫' },
  253: { name: '動漫雜談', parent: '動畫' },
  27: { name: '綜合', parent: '動畫' },

  // 番劇
  13: { name: '番劇', parent: '番劇' },
  51: { name: '資訊', parent: '番劇' },
  152: { name: '官方延伸', parent: '番劇' },
  32: { name: '完結動畫', parent: '番劇' },
  33: { name: '連載動畫', parent: '番劇' },

  // 國創
  167: { name: '國創', parent: '國創' },
  153: { name: '國產動畫', parent: '國創' },
  168: { name: '國產原創相關', parent: '國創' },
  169: { name: '布袋戲', parent: '國創' },
  170: { name: '資訊', parent: '國創' },
  195: { name: '動態漫·廣播劇', parent: '國創' },

  // 音樂
  3: { name: '音樂', parent: '音樂' },
  28: { name: '原創音樂', parent: '音樂' },
  29: { name: '音樂現場', parent: '音樂' },
  31: { name: '翻唱', parent: '音樂' },
  59: { name: '演奏', parent: '音樂' },
  243: { name: '樂評盤點', parent: '音樂' },
  30: { name: 'VOCALOID·UTAU', parent: '音樂' },
  193: { name: 'MV', parent: '音樂' },
  266: { name: '音樂粉絲飯拍', parent: '音樂' },
  265: { name: 'AI音樂', parent: '音樂' },
  267: { name: '電台', parent: '音樂' },
  244: { name: '音樂教學', parent: '音樂' },
  130: { name: '音樂綜合', parent: '音樂' },
  194: { name: '電音', parent: '音樂' }, // 已下線

  // 舞蹈
  129: { name: '舞蹈', parent: '舞蹈' },
  20: { name: '宅舞', parent: '舞蹈' },
  198: { name: '街舞', parent: '舞蹈' },
  199: { name: '明星舞蹈', parent: '舞蹈' },
  200: { name: '國風舞蹈', parent: '舞蹈' },
  255: { name: '顏值·網紅舞', parent: '舞蹈' },
  154: { name: '舞蹈綜合', parent: '舞蹈' },
  156: { name: '舞蹈教程', parent: '舞蹈' },

  // 遊戲
  4: { name: '遊戲', parent: '遊戲' },
  17: { name: '單機遊戲', parent: '遊戲' },
  171: { name: '電子競技', parent: '遊戲' },
  172: { name: '手機遊戲', parent: '遊戲' },
  65: { name: '網絡遊戲', parent: '遊戲' },
  173: { name: '桌遊棋牌', parent: '遊戲' },
  121: { name: 'GMV', parent: '遊戲' },
  136: { name: '音遊', parent: '遊戲' },
  19: { name: 'Mugen', parent: '遊戲' },

  // 知識
  36: { name: '知識', parent: '知識' },
  201: { name: '科學科普', parent: '知識' },
  124: { name: '社科·法律·心理', parent: '知識' },
  228: { name: '人文歷史', parent: '知識' },
  207: { name: '財經商業', parent: '知識' },
  208: { name: '校園學習', parent: '知識' },
  209: { name: '職業職場', parent: '知識' },
  229: { name: '設計·創意', parent: '知識' },
  122: { name: '野生技術協會', parent: '知識' },
  39: { name: '演講·公開課', parent: '知識' }, // 已下線
  96: { name: '星海', parent: '知識' }, // 已下線
  98: { name: '機械', parent: '知識' }, // 已下線

  // 科技
  188: { name: '科技', parent: '科技' },
  95: { name: '數碼', parent: '科技' },
  230: { name: '軟件應用', parent: '科技' },
  231: { name: '計算機技術', parent: '科技' },
  232: { name: '科工機械', parent: '科技' },
  233: { name: '極客DIY', parent: '科技' },
  189: { name: '電腦裝機', parent: '科技' }, // 已下線
  190: { name: '攝影攝像', parent: '科技' }, // 已下線
  191: { name: '影音智能', parent: '科技' }, // 已下線

  // 運動
  234: { name: '運動', parent: '運動' },
  235: { name: '籃球', parent: '運動' },
  249: { name: '足球', parent: '運動' },
  164: { name: '健身', parent: '運動' }, // 曾用名：時尚分區「健身(重定向)」與此同 tid
  236: { name: '競技體育', parent: '運動' },
  237: { name: '運動文化', parent: '運動' },
  238: { name: '運動綜合', parent: '運動' },

  // 汽車
  223: { name: '汽車', parent: '汽車' },
  258: { name: '汽車知識科普', parent: '汽車' },
  227: { name: '購車攻略', parent: '汽車' },
  247: { name: '新能源車', parent: '汽車' },
  245: { name: '賽車', parent: '汽車' },
  246: { name: '改裝玩車', parent: '汽車' },
  240: { name: '摩托車', parent: '汽車' },
  248: { name: '房車', parent: '汽車' },
  176: { name: '汽車生活', parent: '汽車' }, // 曾用名：生活分區「汽車(重定向)」與此同 tid
  224: { name: '汽車文化', parent: '汽車' }, // 已下線
  225: { name: '汽車極客', parent: '汽車' }, // 已下線
  226: { name: '智能出行', parent: '汽車' }, // 已下線

  // 生活
  160: { name: '生活', parent: '生活' },
  138: { name: '搞笑', parent: '生活' },
  254: { name: '親子', parent: '生活' },
  250: { name: '出行', parent: '生活' },
  251: { name: '三農', parent: '生活' },
  239: { name: '家居房產', parent: '生活' },
  161: { name: '手工', parent: '生活' },
  162: { name: '繪畫', parent: '生活' },
  21: { name: '日常', parent: '生活' },
  163: { name: '運動', parent: '生活' }, // 重定向（已合併，與主分區「運動」不同 tid）
  174: { name: '其他', parent: '生活' }, // 已下線

  // 美食
  211: { name: '美食', parent: '美食' },
  76: { name: '美食製作', parent: '美食' }, // 曾用名：生活分區「美食圈(重定向)」與此同 tid
  212: { name: '美食偵探', parent: '美食' },
  213: { name: '美食測評', parent: '美食' },
  214: { name: '田園美食', parent: '美食' },
  215: { name: '美食記錄', parent: '美食' },

  // 動物圈
  217: { name: '動物圈', parent: '動物圈' },
  218: { name: '喵星人', parent: '動物圈' },
  219: { name: '汪星人', parent: '動物圈' },
  222: { name: '小寵異寵', parent: '動物圈' },
  221: { name: '野生動物', parent: '動物圈' },
  220: { name: '動物二創', parent: '動物圈' },
  75: { name: '動物綜合', parent: '動物圈' }, // 曾用名：生活分區「動物圈(重定向)」與此同 tid

  // 鬼畜
  119: { name: '鬼畜', parent: '鬼畜' },
  22: { name: '鬼畜調教', parent: '鬼畜' },
  26: { name: '音MAD', parent: '鬼畜' },
  126: { name: '人力VOCALOID', parent: '鬼畜' },
  216: { name: '鬼畜劇場', parent: '鬼畜' },
  127: { name: '教程演示', parent: '鬼畜' },

  // 時尚
  155: { name: '時尚', parent: '時尚' },
  157: { name: '美妝護膚', parent: '時尚' },
  252: { name: '仿妝cos', parent: '時尚' },
  158: { name: '穿搭', parent: '時尚' },
  159: { name: '時尚潮流', parent: '時尚' },
  192: { name: '風尚標', parent: '時尚' }, // 已下線

  // 資訊（該分區無排名功能）
  202: { name: '資訊', parent: '資訊' },
  203: { name: '熱點', parent: '資訊' },
  204: { name: '環球', parent: '資訊' },
  205: { name: '社會', parent: '資訊' },
  206: { name: '綜合', parent: '資訊' },

  // 廣告（該分區已下線）
  165: { name: '廣告', parent: '廣告' }, // 已下線
  166: { name: '廣告', parent: '廣告' }, // 已下線

  // 娛樂
  5: { name: '娛樂', parent: '娛樂' },
  241: { name: '娛樂雜談', parent: '娛樂' },
  262: { name: 'CP安利', parent: '娛樂' },
  263: { name: '顏值安利', parent: '娛樂' },
  242: { name: '娛樂粉絲創作', parent: '娛樂' },
  264: { name: '娛樂資訊', parent: '娛樂' },
  137: { name: '明星綜合', parent: '娛樂' },
  71: { name: '綜藝', parent: '娛樂' },
  131: { name: 'Korea相關', parent: '娛樂' }, // 已下線

  // 影視
  181: { name: '影視', parent: '影視' },
  182: { name: '影視雜談', parent: '影視' },
  183: { name: '影視剪輯', parent: '影視' },
  260: { name: '影視整活', parent: '影視' },
  259: { name: 'AI影像', parent: '影視' },
  184: { name: '預告·資訊', parent: '影視' },
  85: { name: '小劇場', parent: '影視' },
  256: { name: '短片', parent: '影視' },
  261: { name: '影視綜合', parent: '影視' },

  // 紀錄片
  177: { name: '紀錄片', parent: '紀錄片' },
  37: { name: '人文·歷史', parent: '紀錄片' },
  178: { name: '科學·探索·自然', parent: '紀錄片' },
  179: { name: '軍事', parent: '紀錄片' },
  180: { name: '社會·美食·旅行', parent: '紀錄片' },

  // 電影
  23: { name: '電影', parent: '電影' },
  147: { name: '華語電影', parent: '電影' },
  145: { name: '歐美電影', parent: '電影' },
  146: { name: '日本電影', parent: '電影' },
  83: { name: '其他國家', parent: '電影' },

  // 電視劇
  11: { name: '電視劇', parent: '電視劇' },
  185: { name: '國產劇', parent: '電視劇' },
  187: { name: '海外劇', parent: '電視劇' },
};

/** 回傳「主分區 / 子分區」，主分區本身則只回主分區名；未知 tid 回 undefined */
export function zoneName(tid: number): string | undefined {
  const z = ZONES[tid];
  if (!z) return undefined;
  return z.name === z.parent ? z.parent : `${z.parent} / ${z.name}`;
}
