# 設計文件：方案、API 查證與取捨

本文記錄專案的架構決策與 Bilibili／OpenAI 相容端點的查證結果，供後續維護參考。
第 1–10 節來自 biliFavOrg（整理收藏；實測日期 2026-08-25，另有 2026-08-29／08-31 的覆測，數據在 [research/](research/)），
第 11–17 節來自 biliFollowCleaner（清理關注；實測日期 2026-09-05，在一個關注 2221 個帳號的真實帳號上以登入態 `fetch` 唯讀呼叫）。
合併時刻意**不改前身的節號**——程式碼註解與 CLAUDE.md 都以節號引用本文；合併本身的決定寫在 [1.1](#11-兩個前身合併成一個)。

**引用慣例**：其他文件與程式碼註解以節號指向本文（例如「見 `docs/design.md` 7」）。
改節號時一併更新引用，`grep -rn "design\.md" src docs CLAUDE.md README.md` 找得到全部。

## 目錄

| 節 | 回答的問題 |
| --- | --- |
| [1 架構](#1-架構) | 哪一段程式跑在哪裡、資料怎麼流 |
| [2 Bilibili API 查證](#2-bilibili-api-查證) | 每個端點實測回什麼、哪些文檔已過時 |
| [3 要給 AI 看什麼](#3-要給-ai-看什麼) | 三個資料來源的取捨與成本透明度 |
| [4 怎麼讓 AI 判斷得準](#4-怎麼讓-ai-判斷得準) | prompt 的結構性決定 |
| [5 收藏夾與描述](#5-收藏夾與描述) | 描述為什麼是最重要的輸入、放在哪裡編輯 |
| [6 寫回 B 站](#6-寫回-b-站) | 搬移與複製、撤銷、失效影片、節流退避 |
| [7 影片頁的「智慧收藏」](#7-影片頁的智慧收藏) | content script 的位置、時機與設定適用範圍 |
| [8 平台與端點限制](#8-平台與端點限制) | Chrome MV3 與「OpenAI 相容」的實際差異 |
| [9 評估後不做的事](#9-評估後不做的事) | 想過、量過，然後決定不做 |
| [10 未解決](#10-未解決) | 還沒驗證、還沒決定的事 |
| [11 關注：Bilibili API 查證](#11-關注bilibili-api-查證) | 關注清單、分組、最新投稿、關係操作的端點 |
| [12 三態與勾選資格](#12-三態與勾選資格) | 為什麼不是「活躍／不活躍」兩態 |
| [13 版面：分面審核表](#13-版面分面審核表) | 關注審核畫面為什麼長這樣 |
| [14 取關與撤銷](#14-取關與撤銷) | 為什麼逐筆、撤銷怎麼還原分組 |
| [15 節流、退避、停下](#15-節流退避停下) | 查活躍度的部分結果 |
| [16 活躍度快取](#16-活躍度快取) | 存什麼、多久、為什麼不是設定 |
| [17 關注：評估後不做的事](#17-關注評估後不做的事) | 想過然後決定不做 |

## 1. 架構

| 元件 | 職責 |
|---|---|
| App 分頁（`src/entrypoints/app`, `src/ui`） | 兩條流程都在這裡：整理收藏（取列表 → 取詳情 → 封面 → 組 prompt → AI 分類 → 審核 → 搬移）與清理關注（讀關注 → 逐帳號查最新投稿 → 審核 → 取關 → 撤銷）。extension origin 頁面與 service worker 擁有相同的 `host_permissions` CORS 豁免與 cookie 自動附帶，且不受 MV3 SW 30 秒閒置回收影響，所以不需要 RPC 層。 |
| Service worker（`src/entrypoints/background.ts`） | 安裝 `declarativeNetRequest` session rule（`initiatorDomains = 本擴充功能 id`、`requestDomains = api.bilibili.com`）把 `Referer`/`Origin` 設為 `https://www.bilibili.com`；點圖示開啟／聚焦 App 分頁單例；影片頁「智慧收藏」的單支往返（§7）。 |
| 儲存 | `chrome.storage.local`：設定（含關注門檻）、收藏夾描述、目標勾選、整理範圍、兩份任務快照（`lastJob`／`lastFollowJob`）、WBI key。IndexedDB（`idb`，資料庫 `bilitidy`）：影片詳情（30 天）、封面 base64（7 天）、帳號活躍度（30 天）。 |

資料流（整理收藏）：

```
nav ──► mid / isLogin / WBI key
folder/created/list ps=100 ──► FolderMeta[]（含 cover／intro）＋ 本機 description
resource/list ps=40 ×⌈N/40⌉ ──► VideoBasic[]（可只取最近 N 支）
IndexedDB → miss 才 wbi/view/detail ×1/影片 ──► VideoDetail（tags / tid→分區 / ugc_season 名＋同合集標題 / dynamic / pages / staff）
（視覺）cover@320w_200h_1c.webp → base64（快取）
文字 30 支/批、視覺 10 支/批 ──► chat/completions ──► {"results":[{bvid,target_folder_ids,reason,confidence}]}
審核表 ──► resource/copy（多目標前 n-1 個）+ resource/move（最後一個），≤20 筆/請求
失效影片 ──► （手動）resource/batch-del，≤20 筆/請求
```

資料流（清理關注）：

```
relation/stat ──► following / whisper 數（估頁數、估時間）
relation/tags ──► FollowTag[]（-10 特別關注、0 默认分组、自訂）
relation/followings ps=50 ×⌈N/50⌉ ──► FollowEntry[]（mid、name、face、tagIds、special、kind、followedAt）
relation/whispers ps=50 ×⌈M/50⌉ ──► FollowEntry[]（kind='whisper'）
IndexedDB → 不新鮮才 space/wbi/arc/search ×1/帳號 ──► ActivityRecord（videos / noVideos / unknown）
FollowRow[] = FollowEntry × ActivityRecord × 操作狀態 ──► 分面 → 勾選 → 作業列
取關：relation/modify（act 2／4）×1/帳號，序列化
撤銷：relation/batch/modify（act 1）≤20/批 → relation/tags/addUsers（同分組簽名併批）
```

依賴方向 `ui → core → {bilibili, ai, net, shared}`；`bilibili`／`ai`／`net` 是葉節點，不 import `core`。

### 1.1 兩個前身合併成一個

biliFavOrg 與 biliFollowCleaner 是同一位作者的一對：同一套建置鏈、同一份 `net/*`、同一份 `shared/result.ts`、同一套視覺 token，
差別只在整理的對象。分成兩個擴充功能只是讓使用者裝兩次、學兩套設定、養兩份限速器。合併時的決定（使用者拍板的三件事與其餘取捨）：

- **以 biliFavOrg 為底**：它的基礎設施是超集（WBI 簽名、封面、字幕、AI client、content script）。biliFollowCleaner 的 `bilibili/relation.ts`、
  `bilibili/archive.ts` 與 `core/{activity, checkActivity, fetchFollows, unfollow, exportRows, followFilter, followEstimate}.ts` 整個搬進來，
  型別加 `Follow` 前綴（`FollowRow`／`FollowPhase`／`FollowStats`）與原本的 `ReviewRow`／`JobPhase`／`JobStats` 區分。
- **頂列四個平行分頁**（整理／收藏夾／關注／設定），不做「收藏」「關注」兩大區各自子分頁——使用者選的；兩邊現有分頁直接並排最不用學。
- **兩種長任務一次只跑一個**——使用者選的，對風控最安全。實作是 `ui/jobGuard.ts`：一個三行的 zustand store 記著哪一種任務在跑，
  兩個 jobStore 開始任務與寫入前先 `claimJob`、finally 時 `releaseJob`；UI 用它把另一頁的主按鈕變灰並寫出原因。
  不靠 Web Lock 互斥：`acquireJobLock` 刻意不等待鎖（它只是握著豁免凍結），而且就算等待，第二個任務的 phase 也已經切到「進行中」，畫面會騙人。
- **一份 `rate` 設定、一把節流器**：限速三選一沿用 biliFavOrg 的保守 1／預設 2／快 3 req/s。biliFollowCleaner 原本預設 1 req/s
  （Java 版的經驗是再快容易碰到 `-412`），合併後查關注跟著共用的 2 req/s——被限流時本來就會退避後停下並保留進度，
  設定頁的說明寫明「關注幾千個選保守」，把這個取捨交給使用者而不是藏一條「查關注時自動減半」的規則。
- **一個 IndexedDB、三個 store**：同一個 origin 開兩個資料庫沒有意義；設定頁的「清除」分成收藏（詳情＋封面）與關注（活躍度）兩行。
- **兩份任務快照各存各的**（`local:lastJob`／`local:lastFollowJob`）：兩個分頁可以各自留著上一輪的結果。
- **進度儀表收成一個共用元件**（`ui/components/ProgressPanel.tsx`）：兩邊原本各有一份幾乎一樣的儀表＋請求紀錄＋骨架，
  差別只在右邊兩個讀數與骨架的形狀，做成參數。整理收藏儀表裡原本第二顆「取消」拿掉——取消一律在作業列（[13](#13-版面分面審核表) 的三段式規則）。
- **介面文案**：關注的部分收在 `follows.*` 命名空間；頂列、進度儀表、錯誤、設定的文案只有一份。
- **不做的**：舊設定的搬遷（兩個前身的 storage 在各自的擴充功能 id 底下，讀不到）；把兩種任務做成可以同時跑。

### 1.2 介面重做：設定頁依「誰用得到」分組（2026-09）

合併後第一版的設定頁沿用 biliFavOrg 的四段（連線／要給 AI 看什麼／要 AI 怎麼判斷／速度與資料），
但合併進來的清理關注根本不需要 AI——一個只想清關注的人打開設定頁，看到的第一章就是「填 AI 端點」，
而且每一段都沒說它影響哪個功能。重做時把六章分成三組：**01–03「整理收藏 · 需要 AI」**（端點、給 AI 看什麼、分類指示）、
**04–06「兩個工具共用」**（讀寫速度、快取與備份、語言）、最後一列是通往關注頁的門（門檻與悄悄關注仍只在關注頁改，不放第二份）。
每一章開頭列出用在哪幾個功能、明確不用在哪個；每個設定寫「做什麼、預設是什麼」，說明永遠在畫面上而不是 tooltip。
控制列中段的章節軌（六段、03／04 之間留缺口）標出哪幾章改過沒存，主按鈕寫改了幾項——「儲存」不再是一顆只會亮不會說話的按鈕。

否決過的做法：頂列改成「收藏／關注」兩大區各帶子分頁（推翻四個平行分頁的決定，導覽層級多一層）；
只在每段標題下補一行「影響：⋯」而不重排（最小改動，但「關注不用 AI」仍要讀到第四段才知道）。
視覺世界同時整組換成「彈幕播放器的時間軸」，規則與理由在 `DESIGN.md`。

## 2. Bilibili API 查證

文檔來源：`SocialSisterYi/bilibili-API-collect` 於 2026-01-28 因律師函下架，引用下架前 fork 快照 `Xiaoyu44/bilibili-API-collect@cfc5fdd`。標「實測」者為本專案實際呼叫的結果。

| 端點 | 實測 / 文檔重點 |
|---|---|
| `GET /x/web-interface/nav` | 未登入回 `-101` 但仍附 `wbi_img`；`img_url`/`sub_url` 檔名即 WBI key，每日更替。 |
| `GET /x/v3/fav/folder/created/list-all?up_mid[&rid]` | `list[]{id,title,media_count,attr}`；`attr` bit0=1 私密、bit1=0 預設收藏夾。**沒有 cover／intro**，所以整理流程不用它。但**帶 `rid`（aid）時每個夾多一個 `fav_state`**（1 = 這支影片在裡面），實測 37 個夾一個請求回完——影片頁的「智慧收藏」用它一次拿到收藏夾清單與「已經在哪些夾裡」。 |
| `GET /x/v3/fav/folder/created/list?up_mid&ps=100&pn=1` | **實測一個請求回 39 個收藏夾**（`has_more=false`），欄位比 list-all 多 `cover`、`intro`、`mtime`、`view_count`，`attr` 與 list-all 完全一致。收藏夾縮圖與「一鍵匯入 B 站簡介」都靠這一個請求，不必逐夾打 `folder/info`。 |
| `GET /x/v3/fav/resource/list?media_id&ps&pn&platform=web` | **實測 `ps` 上限 40**（50、100 回 `-400`；文檔寫 1–20 已過時），但**一頁不保證回滿**：實測同一個夾第 1 頁 25 支、第 2 頁 39 支、第 3 頁 40 支，`has_more` 都是 true（`ps=20` 的第 1、2 頁合起來等於 `ps=40` 的第 1 頁，代表 offset 仍是 `(pn-1)*ps`，逐頁抓不會漏）。估算與進度條改用保守的每頁 30 支（`FAV_PAGE_YIELD`）。`medias[]` 有 title/cover/intro/duration/page/upper/cnt_info/pubtime/fav_time/bvid/attr；`season`、`ogv` 實測恆 `null`，列表拿不到合集。公開收藏夾匿名可讀；私密匿名回 `-403`。 |
| `GET /x/v3/fav/resource/ids?media_id` | 不分頁，實測 973 筆一次回；匿名可讀公開夾。 |
| `GET /x/v3/fav/folder/info?media_id` | 含 `intro`、`cover`。 |
| `GET /x/web-interface/view/detail?bvid`（與 `wbi/view/detail`） | 帶 cookie 一次回 `View`＋`Tags[]`＋`Card`。`View.ugc_season` 含合集名、`ep_count`、`sections[].episodes[].{title,bvid}`（實測 89 集全回）。**`tname`/`tname_v2` 實測回空字串**，以 `src/bilibili/tid.ts` 由 `tid` 對照。**匿名呼叫直接 HTTP 412**。未簽名的 `wbi/view/detail` 目前可用，專案仍實作 WBI 簽名以防日後強制；簽名失敗特徵是 `code 0` 但 `data.v_voucher` 存在。 |
| `GET /x/web-interface/view?bvid`、`GET /x/web-interface/view/detail/tag?bvid` | 匿名可用（`view` 含 `ugc_season`）。若要完全匿名取詳情需 2 個請求且無 buvid3，更易命中風控，故不採用。 |
| `GET /x/player/wbi/v2?aid&cid` → `subtitle_url` | `subtitle.subtitles[]` 同時含人工與 AI 字幕，`lan` 以 `ai-` 開頭者為 AI 生成。本專案人工優先（其中再優先 `zh`），沒有才退回 AI 字幕；兩者都沒有就只花掉第一個請求。選項預設關。 |
| `POST /x/v3/fav/folder/add|edit|del` | form + `csrf`（cookie `bili_jct`）；`edit` 必須帶回完整 `title`/`intro`/`cover`，否則清空。 |
| `POST /x/v3/fav/resource/move|copy` | `resources=aid:type,…`；批量上限文檔未載明，`-632` 表示數量限制 → 每批 ≤20、遇 `-632` 對半拆。 |
| `POST /x/v3/fav/resource/deal` | 影片頁原生收藏彈窗按「確定」時打的就是這支：`rid`（aid）＋`type=2`＋`add_media_ids`／`del_media_ids`（逗號分隔）＋`csrf`。不需要來源收藏夾，適合「還沒收藏過」的影片。成功與否只看 `code`。`data.success_num` **不能**拿來判斷：成功加入時它一樣是 0（bilibili-API-collect 的 `video/action.md` 記的成功範例就是 `success_num: 0`，該欄位作用不明）。早期以為「`code 0` 但 `success_num 0` ＝ 沒寫進去」，是拿一次 no-op 移除實測後的錯誤歸因，實際線上會把「已經收藏成功」誤報成失敗。 |
| `POST /x/v3/fav/resource/batch-del` | 從收藏夾移除內容：`resources=aid:type,…`＋`media_id`＋`csrf`。另有 `POST /x/v3/fav/resource/clean`（一個請求清掉整個收藏夾的失效內容，只要 `media_id`＋`csrf`）——不採用：它的作用範圍是整個收藏夾，跟審核表列出的（可能只是「最近 N 支」）對不起來，數字與實際刪除量不一致。 |
| 圖片 CDN | `{cover}@320w_200h_1c.webp` 實測得 320×200；Referer 需留空或 B 站網域（擴充功能請求以 `referrerPolicy: 'no-referrer'`）。 |
| 錯誤碼 | `-101` 未登入、`-111` csrf、`-352` 風控（WBI/UA/cookie）、`-403` 權限、`-412`／HTTP 412 IP 風控、`-632` 數量限制、`-799` 請求過頻。 |

## 3. 要給 AI 看什麼

影片詳情、字幕、封面是三個獨立的資料來源，各自一個開關。這一節記錄它們的成本、實測價值，
以及「使用者怎麼看得出自己的設定會花多少」。

### 3.1 資訊完整度 vs. 呼叫次數

| 等級 | 每支影片額外請求 | 取得資訊 |
|---|---|---|
| 不抓詳情 | 0 | 標題／簡介／時長／UP／封面 |
| 完整（預設） | 1 | + 標籤、合集與同合集標題、分區、動態、分P、合作者 |
| + 字幕 | +2 | 只對標籤少於 3 且無合集的影片 |

以 2234 支的收藏夾為例：預設（詳情全部抓取）首次約 75（列表）+ 2234（詳情）個 GET，2 req/s 約 19 分鐘；有快取後只有新影片會打詳情。

**整理範圍**：`resource/list` 預設依收藏時間新到舊，所以「最近收藏的 N 支」只要抓前 ⌈N/40⌉ 頁就停（`core/fetchList.ts` 的 `limit`）。大收藏夾預設用這個模式分批整理，比一次跑 2234 支安全也好驗收。開始前由 `core/estimate.ts` 換算請求數與時間顯示在 UI 上。

### 3.2 三個資料來源、三個開關

影片詳情、字幕、封面都是「這個資料來源要不要抓」，各是一個勾選框（`SettingsPage` 的 `ToggleField`），整理流程與影片頁共用同一組判斷。

**「智慧」那一階已經整個移除。** 它曾經是三選一的中間項（只補文字線索不足的影片），但實測站不住腳：

- 智慧抓字幕的條件（標籤 < 3 且無合集）在 62 支裡只命中 **1 支**（1.6%），行為跟關閉幾乎沒有差別。
- 附圖在實測裡沒有穩定的方向（`docs/research/classify-eval-2026-08.md`）：「詳情＋智慧附圖」100%、「詳情＋全部附圖」92%，但把描述寫好之後反過來——「好描述＋純文字」100%、「好描述＋智慧附圖」92%。同一份 prompt 重跑本來就有約 20% 的決策會變，62 支的樣本分不出這個量級的差別。真正穩定有效的是把收藏夾描述寫好（94% → 100%）。
- 代價卻是全域的：`estimate.ts` 要用 `SMART_COVER_RATIO`＝0.4 這種猜出來的比例去估請求量（估出來的數字本來就不準）、`flow.ts` 與 `promptPreview.ts` 各要多三條分支、`organizer.ts` 的 `classifyAll` 要把一批影片依「有沒有封面」拆成視覺與文字兩組分開送，還有「不抓詳情時智慧附圖等同全部附圖」這種只有讀過 `needsCover` 才會知道的隱含規則。

收斂成開關之後：附圖是全有全無，所以一次只有一種批次大小會生效（`attachesCover(settings) ? batchSizeVision : batchSizeText`），估算不再需要任何猜測的比例，四個模組的分支各少一半。設定頁也從三組共 9 列 radio 變成 3 個勾選框。

- 為什麼不是下拉：只有開／關兩個狀態，而且每一項都要附一行「這樣會多打幾次請求」，`select` 的 `option` 放不下這種說明。
- **兩段式（`detailLevel: 'twoPass'`）也是這樣被移除的**：它靠模型自評 `confidence: low` 決定要補抓哪些詳情，但模型幾乎不承認自己沒把握，實際上退化成「先用列表分一次、再用完整資料分一次」——請求沒少、AI 呼叫翻倍。`confidence` 欄位保留，改在審核表標成「低信心」讓人優先複查。
- 已存的舊設定由 `settings.ts` 的 `migrateLegacy` 轉換，不會被預設值蓋掉。兩代都接：三選一（`coverMode`／`subtitleMode`／`detailMode`）與更早的勾選（`attachCoverAll`／`smartCovers`／`detailLevel`）。轉換方向有一處刻意不對稱——`coverMode: 'smart'` → **附上**（視覺模式是使用者主動開的，附圖比較接近原意），`subtitleMode: 'smart'` → **不抓**（它本來就幾乎不觸發，翻成開啟會讓請求量突然多一倍）。

### 3.3 視覺模式

- OpenAI 官方（developers.openai.com/api/docs/guides/images-vision）：多張圖可放同一 `content` 陣列（上限 1500 張／512 MB）。Gemini、Claude（OpenAI 相容層）、OpenRouter、vLLM 皆支援 base64；**Ollama 與 LM Studio 只接受 base64、不接受 http URL** → 一律 base64。
- 多圖混淆有文獻支持（MuirBench 2406.09411、MIHBench 2508.00726、"More Images, More Problems?" 2601.07812：干擾圖 1→34 張準確率 79%→66.5%）。對策依證據強度：每張圖前加文字標籤（Anthropic／Google 官方建議）並圖文交錯、輸出以 bvid 對應而非序號、每批限 10 張、`detail: low` + 320×200。拼成帶編號 grid 證據矛盾，不採用。
- 附圖是全有全無（`core/settings.ts` 的 `attachesCover`）：勾了「附上封面」且視覺驗證通過就每支都附。曾經有過「智慧附圖」（只對線索不足的影片附），移除的理由見 [3.2](#32-三個資料來源三個開關)。
- 成本：`detail:low` 每張 70–260 token（gpt-4o/4.1 = 85、gpt-5 = 70、Gemini ≤384px = 258、Claude 28px patch ≈ 96），與文字同量級；取捨在混淆率而非費用。

### 3.4 請求透明度

`core/estimate.ts` 依目前設定推算每個端點會打幾次、換到什麼資料，兩個地方共用同一份結果：設定頁「資料取得」以 100 支影片為基準即時反映選項變化，整理頁則用這次實際要處理的支數。使用者不必翻文件就知道「開字幕會多幾次請求」「不抓詳情能省多少」。

### 3.5 流程透明度

`core/flow.ts` 的 `planFlow(settings)` 把同一組設定翻成「實際會走哪幾步、哪幾步被跳過」，被跳過的步驟仍列出但標灰。它和 `estimate.ts` 是同一份規則的兩種呈現：一個回答「打幾次請求」，一個回答「照什麼順序做」。兩者都是純函式、各自有測試，改流程時測試會逼著同步更新說明。

**同一件事只講一次**：設定頁只放請求量表格（那才是「選項 → 成本」的即時回饋），整理頁把流程清單與請求表合成一個「看這次會做什麼」，README 只保留 Mermaid 圖給還沒安裝的人看。原本這五處各講一次，改一次流程要同步五個地方——`estimate.ts` 說會抓 200 次字幕、`flow.ts` 說步驟啟用、`organizer.ts` 其實一次都不抓，就是這樣長出來的。

## 4. 怎麼讓 AI 判斷得準

分類品質的四個結構性決定。實測數據在
[research/classify-eval-2026-08.md](research/classify-eval-2026-08.md)——最重要的結論是
**收藏夾描述的投報率遠高於任何設定**（命中率 94% → 100%），而同一份 prompt 重跑本來就有約 20%
的決策會變，所以 ±5 個百分點以內的差距不算差異。

### 4.1 來源收藏夾與「留在原地」

prompt 的使用者訊息第一塊是**影片目前所在的收藏夾**（名稱＋使用者填的描述），接著才是可搬入的目標收藏夾。少了這一塊，模型看到的題目是「這批影片配一份目標清單」，隱含前提就是每支都得找個新家：整理一個**已經分好**的收藏夾時，它只能在其他夾裡挑最像的，而「全部都不像」的門檻遠比「有一個有點像」難達成，結果就是把影片大量搬出去。實測整理「Pic（美圖）」時，百合漫畫被判給各種其他收藏夾，正是這個結構性偏差。

因此系統提示把留下寫成預設結果：影片已符合目前所在收藏夾的收錄標準，或沒有目標收藏夾**明顯更**合適時就留在原地；只有明顯更符合才搬走。留在原地怎麼表達，見 [6.1](#61-一支影片進多個收藏夾)：來源夾也有短號（固定 1），模型把它列進 `target_folder_ids` 就是「留在原地」，空陣列也一樣算（模型偶爾仍會這樣回）。

這一塊**不能拿掉**，但它的描述現在同時是一條判準（要不要留下），所以描述寫得含糊會有代價——實測見 [`docs/research/keep-source-eval-2026-08.md`](research/keep-source-eval-2026-08.md)。

來源夾與目標夾共用同一份 `descriptions`（以 folder id 為 key），所以同一個收藏夾當來源或當目標時寫的是同一段話；編輯入口只有「收藏夾」分頁一個（見 [5.1](#51-收藏夾的單一入口)）。

模型很容易把「都是遊戲」「都是動畫」當成相符，實測附圖模式下出現過「標籤含絕區零」卻判給《明日方舟》夾、「標籤含蔚藍檔案」卻判給《原神》夾，以及把標籤含 MAD 的影片判進名稱只差一個字母的 `MMD` 夾——帳號裡沒有對應的夾時，模型會退而求其次挑一個「看起來也是那類」的。所以判斷原則 5 另外寫明：收藏夾指的是特定作品／遊戲／IP 時，只有影片真的屬於那個作品才算相符，不同作品一律不算（名稱相近也不算），找不到就回空陣列。

### 4.2 收藏夾 id 用短號，不用 media_id

送給模型的目標清單原本直接用 B 站的 `media_id`（10 位數，例如 `2271580846`）。實測（`docs/research/classify-eval-2026-08.md` §5）視覺模型會出現**可重現**的抄錯：理由寫「標籤含绘画与初音」卻選到音聲夾、「標籤含绝区零」卻選到原神夾——判斷是對的，id 抄錯了。純文字模型也偶爾出現同類錯誤。

改法在 `ai/prompt.ts`：`codeFolders()` 把清單重新編號成 1..N（`FolderCodes` 同時給出 `realOf` 對照表與 `validIds`），解析完立刻用 `toRealIds()` 換回真正的 `media_id`。短號只存在於 prompt 與模型回覆裡，其餘所有程式碼（審核表、搬移、快照）看到的仍然是 `media_id`。同一個模型、同一批資料、同一份描述，兩次視覺跑分從 92%／89% 變成 100%／97%，而且那幾支可重現的錯誤消失；每批還少送約 200 tokens。

來源收藏夾也吃同一組短號，固定拿到 1（目標從 2 開始）。它原本刻意不列 id，理由是「它不是可選的目標，給了只會誘導模型把它當答案」——那個理由後來被實測推翻，見 [6.1](#61-一支影片進多個收藏夾)。

`core/organizer.ts` 的 `classifyAll` 整趟共用同一組短號（除錯視窗看到的 id 才會跟模型回覆對得起來），`ai/quickFav.ts` 的 `classifyOne` 也走同一條路。

### 4.3 自訂分類指示

`ai/prompt.ts` 的 `withCustomInstructions(base, custom)` 把使用者寫的指示接在系統提示後面，標明「與上述判斷原則衝突時以這裡為準，但輸出格式規則不可更動」——輸出格式一被改寫，整批結果都解析不出來。上限 1000 字並在組 prompt 時再截一次（設定 schema 也擋一次），避免貼進一整篇文章。

整理流程（`buildSystemPrompt`）與影片頁（`ai/quickFav.ts`）各有一份系統提示，但**共用同一支 `withCustomInstructions`**：設定頁只有一個欄位，寫著「自訂分類指示」，沒有理由只對其中一條路徑生效。

### 4.4 判斷依據與除錯視窗

模型除了 `reason` 還要回 `basis`：從固定的十個欄位名（標籤、合集、標題、簡介、封面、分區、時長、UP、字幕、分P）挑最多 3 個、依重要性排序。固定值域是為了能在 UI 上一眼比較，也讓 `parser.ts` 的 `toBasisList` 可以把「tags」「封面圖」「UP主」這類變體正規化、丟掉模型自己發明的欄位。審核表顯示成「依據：標籤 → 合集」。

`confidence: low` 的列**不預先勾選**（`toRow`）：搬移不可逆，模型自己說在猜的結果不該因為使用者直接按「執行搬移」就生效；建議仍然顯示，要採用得按「全部採用建議」或逐列點。這也是兩段式移除後 `confidence` 的唯一用途。

`organizer.ts` 的 `onBatch` 回報每次 AI 往返的完整內容（system、攤平後的 user、原始回覆、思考內容、token、finish_reason），UI 以 bvid → 批次的對照表提供每列的「送了什麼」。這些紀錄**只放在記憶體**，不寫進 `local:lastJob` 快照：2000 支影片的 prompt 全文會撐爆 `chrome.storage.local`，而除錯只需要當下這一輪。

設定頁的 prompt 預覽（`core/promptPreview.ts`）走的是同一組組裝函式，只是餵兩支假影片，所以「改設定 → 送出的內容怎麼變」不需要真的跑一次。

## 5. 收藏夾與描述

### 5.1 收藏夾的單一入口

描述是 AI 分類最重要的輸入，但「把描述寫好」與「這次要整理誰」是兩種節奏：前者偶爾做一次並且涉及所有收藏夾，後者每次都做且只涉及幾個。把兩件事疊在整理頁的結果是：一張 34 列的表格裡同時有勾選框、描述輸入框與生成按鈕，而新增／同步這些「少用」的操作只能藏在 `<details>` 裡——少用不代表該藏，藏起來的是它們的**唯一**入口。

所以收藏夾回到自己的分頁，整理頁只剩選擇與審核（描述只顯示、不編輯，旁邊一個連結跳過去；勾了沒描述的目標時會提醒）。慣例參考 Raindrop.io 的 Collections 頁與 Gmail 的「標籤」設定頁：資料的**維護**跟資料的**使用**分開。

這一頁的操作一律是「先勾選、再一次做完」：AI 生成描述、從 B 站簡介匯入、把描述同步回 B 站。幾十個收藏夾逐個點不現實。批次內部一律**串行**（讀取走 `readThrottle`、寫入走 `writeQueue`），配一條進度與取消，失敗的一併列出而不中斷剩下的。

批次列**沒勾東西時不顯示**（換成一句說明），草稿列也只在有草稿時出現：原本一排七顆按鈕加兩個勾選框全部常駐，其中大半點不下去。慣例參考 Gmail／檔案管理器的批次工具列。「從 B 站簡介匯入」也改成只產生**草稿**，與 AI 生成同一條路：使用者看得到要換成什麼再決定採不採用，原本的「覆蓋已填寫的」開關就沒存在的必要了。

**描述留空時退回 B 站簡介**（`core/folderStore.ts` 的 `effectiveDescription`）。收藏夾在 B 站的簡介本來就是使用者自己寫的收錄意圖，本機沒寫時把它晾著只是讓分類少一份線索；而且影片頁的「智慧收藏」原本就是這樣做的，整理流程卻不是——同一個收藏夾在兩條路徑上餵給模型的描述不一樣，這種不一致沒有人講得出理由。統一之後 UI 也要看得出來：目標收藏夾表與整理頁的來源描述旁邊會標「來自 B 站簡介」，「沒有描述」的提醒只在**本機與 B 站都空**時才出現。「從 B 站簡介匯入」仍然有意義——它把簡介變成可以再編輯的本機描述。

反過來，「把描述同步回 B 站」**跳過沒填描述的收藏夾**：`folder/edit` 必須帶完整欄位，送空字串等於把 B 站原本的簡介清成空白且不可復原，而按這顆按鈕的意思是「把我寫的同步過去」，不是「把那邊清掉」。跳過幾個會寫在結果訊息裡。

**沒有「刪除收藏夾」**。`folder/del` 是 B 站端的真刪除：收藏夾連同裡面的影片一起消失，不可復原；但在一個「整理收藏夾」的擴充功能裡，一顆写著「刪除」的按鈕很容易被讀成「從這個清單移除」。加重確認（例如要求輸入名稱）可以陣低風險，但這個功能本來就不屬於整理流程，而 B 站自己的收藏夾管理頁已經提供它與屬於它的上下文，所以連 `bilibili/fav.ts` 的 wrapper 一起拿掉。「新增收藏夾」保留，因為建目標夾是整理的一部分。

### 5.2 依收藏夾內容生成描述

`ai/describe.ts` 讓模型從夾子裡現有的影片歸納出收錄標準。這件事的失敗模式很單一：**把樣本裡的多數派寫成整個夾子的主軸**。實測到的兩個例子：`Sound`（使用者用來收所有音聲）被寫成「收錄以百合音聲為主的同人 ASMR…」，`zmd`（用來收《終末地》）被寫成「以洛茜為中心的二次創作…」。描述一旦變窄，下一次分類就會把不符合那個窄範圍的影片搬走——錯誤會自我強化。

三個對策一起上：

1. **取樣涵蓋整個夾子**。`core/describeFolder.ts` 的 `pickPages` 在 `1..lastPage` 平均抽最多 6 頁（頭尾必含），把讀到的候選交給 `spread` 平均抽稀到 80 支。`lastPage` 用保守的 `FAV_PAGE_YIELD`（每頁 30 支）估而不是 `FAV_PAGE_SIZE`（40）：一頁不保證回滿，用 40 算會**低估**總頁數——411 支的夾子只算到第 11 頁，實際約 14 頁，最舊的那 90 支永遠不會被取樣到，正好是這一節要解決的偏差。估多了最壞情況只是多打一兩次回空陣列的請求。舊作法只取最新一頁與最舊一頁各 15 支，對一個幾百支的夾子而言就是兩個端點的快照；最新那一頁又常常是「最近夠一批丟進來的東西」，偏得最厘害。成本從 2 次 `resource/list` 變成最多 6 次（走 `readThrottle`，約 3 秒），換到的是涵蓋率。
2. **prompt 禁止寫成少數派，而且只能寫一句**。判斷規則 3 明說：某個角色、作品、語言或子類型只佔樣本一部分時不可以寫成主軸，且不要用「以…為主」「以…為中心」這種句型；拿不準就寫寬。`DESCRIBE_MAX_CHARS` 從 120 收到 **20**（目標 10 字左右），規則 6 另外要求字數不夠時先捨棄細節與子類型、不要寫「不收…」的排除條件——字數上限本身就是最有效的防窄機制：120 字的空間會誘使模型把樣本裡看到的每個子類型都列進去，而那份清單正是下一次分類的收錄標準。手寫的描述不受這個限制（`formatFolders` 仍會在 300 字處截斷）。
3. **把使用者原本的描述一起送**。現有描述代表的是「收錄意圖」，樣本代表的只是「目前裝了什麼」；規則 4 要求模型沿用前者的範圍，只在影片明顯超出時才補充。UI 上是「參考現有描述」開關（預設開），因為有時使用者就是想重寫。

user 訊息還會說明「從全部 N 支裡平均取樣的 M 支」，避免模型把樣本當成夾子的全部。

實測（真實帳號，同一批樣本跑舊新兩版）：

| 收藏夾 | 舊：最新 15 ＋ 最舊 15 | 新：平均取樣 ＋ 參考現有描述 |
| --- | --- | --- |
| `zmd`（21 支，簡介「终末地相关」） | 「圍繞…**洛茜**的二次創作…不收與洛茜無關的內容」 | 「**终末地相关**遊戲內容，包含角色動畫、繪圖創作、迷因惡搞與攻略教學」 |
| `Sound`（46 支，簡介「ASMR、音声相关」） | 「以**百合**與女性向音聲…不收一般男性向或非百合主題」 | 「收錄**百合、男性向與女性向**的日語及中文原創或同人音聲」 |
| `Ai`（411 支，簡介「Ai相关信息和视频」） | 「…**不收**新聞快訊或單純產品發布資訊」 | 「…教學、開源專案、實際應用演示**與新聞資訊**」 |

（這張表是 `DESCRIBE_MAX_CHARS` 還是 120 時量的，所以兩欄都比現在長；要看的是**範圍**寬窄的差別，不是字數。現在同一批樣本會收斂成「终末地相关內容」「日語與中文音聲」「AI 相關資訊與教學」這種一句話。）

`Ai` 這一列是取樣改善的功労（11 頁裡抽 6 頁共 196 支、送 80 支，舊版只有 23 支）；`Sound` 則是「參考現有描述」的功労——同一批新樣本不帶現有描述時依舊寫出「以百合為主題」，這也是這個開關預設開的原因。

生成結果進入**草稿**狀態（換底色 ＋ 採用／重新生成／還原），按「採用」才寫進描述；慣例參考 Notion AI 與 Linear 的 AI 摘要，一律進可編輯的草稿而不是自動套用。從已經分錯的夾生成依舊會把錯誤固化，UI 直說了這件事，並建議先整理過再生成。

## 6. 寫回 B 站

### 6.1 一支影片進多個收藏夾

模型可以給多個 `target_folder_ids`，這是**刻意保留**的：實測整理預設收藏夾時約三分之一的影片確實同時屬於兩個夾（「百合向／中文音声」→ `Sound` + `Yuri`、「用 h3 做動態桌布」→ `Ai` + `Windows`），強迫只選一個反而會丟資訊。系統提示只提醒「通常只需要 1 個」，不禁止多選。

寫入端因此是 `planMoves` 的「前 n−1 個目標用 `resource/copy`、最後一個用 `resource/move`」：影片在任何時刻都至少存在於一個收藏夾，最後一次 move 才把它從來源移走。`planUndo` 是它的反向操作（最後那個 move 回來源、其餘複本 `batch-del`）。使用者不想要多目標時，在審核表把多餘的 chip 點掉即可。

**「也留在原位」（`ReviewRow.keepSource`）**：同一個道理再推一步——「這支該去 `Sound`」與「這支該離開現在的夾子」是兩個獨立的判斷。審核表每一列在選了目標之後都會寫出「搬離來源」還是「留在來源，另外複製一份出去」，切換它就是把那一列的每個目標都改成 `resource/copy`、一次 `move` 都不發（`planMoves` 的 `keepSource` 分支）。底部作業列有整批的「全部保留原位」／「全部改為搬走」，主按鈕跟著在「執行搬移／執行複製／執行寫入」之間換字。

**模型也答得出這個組合。** 原本的輸出合約是二選一：`target_folder_ids` 回空陣列＝留在原地，回目標 id＝搬走，來源夾刻意不列 id。代價是模型表達不出「兩個都算」——整理一個百合夾時，它在理由欄寫著「標籤含音声**與百合**」，卻只能把影片判給 `Sound`（＝從百合夾搬走）。它沒有分錯，是合約逼它二選一。

現在來源夾也吃短號（固定 1，目標從 2 開始，見 [4.2](#42-收藏夾-id-用短號不用-media_id)），`target_folder_ids` 的語意改成**「這支最後應該在哪些收藏夾裡」**：`[1]` 留在原地、`[1,3]` 留在原地並複製一份到 3、`[3]` 搬走、`[]` 也當成留在原地（模型偶爾還是會這樣回）。`classify()` 把來源短號拆成 `ClassificationItem.keepSource`，其餘的照舊換回 `media_id`。

實測（[`keep-source-eval-2026-08.md`](research/keep-source-eval-2026-08.md)）：命中率沒有變（兩個情境四次都落在 95–100%，在 ±5 個百分點的判讀門檻內），該留在來源夾的 16 支四次都留住了，並開始出現正確的「留下並複製」——包括上面那個 `h3 做動態桌布` → `Ai` ＋ `Windows`。

**但來源夾的描述因此變成一條判準。** 第一版新合約在雜物夾情境跑出 1 與 29（62 支裡 47%）的兩極結果：那個夾的描述寫著「什麼都可能有」，照字面讀任何影片都符合它的收錄標準，於是「留在原地」永遠成立。系統提示因此多一條：描述空白、含糊或本身就是暫存夾時不算相符，要找一個真正對應的目標。加上之後四次都是 1。**改這一段 prompt 要重跑那份實測。**

考慮過的另一種做法是每支多回一個 `keep_source` 布林。它往回相容、解析簡單，但「空陣列＋true／false」是同一件事的兩種寫法（冗餘狀態），而且模型要同時答兩題；短號版只有一個欄位、一種語意。

因為 copy 與 move 的請求數相同（n 個目標就是 n 次寫入），`estimate.ts` 不受影響。

### 6.2 撤銷搬移

搬移不可逆，所以審核表保留「撤銷這次搬移」：`planUndo` 把狀態為 `done` 的列反推回去——當初多目標是「前 n-1 個 copy、最後一個 move」，撤銷就是最後一個 `move` 回來源、其餘用 `batch-del` 移除複本。`move` 步驟排在 `remove` 前面，讓影片在任何時刻都至少存在於一個收藏夾；`move` 失敗的列維持 `done`（影片還在目標，可以再按一次撤銷），而且它的複本不會被刪，避免留下半套狀態。撤銷成功的列回到 `pending` 並清空 `chosen`，否則使用者接著按「執行搬移」就會把剛撤銷的決定重做一次。

`keepSource` 的列當初一次 move 都沒發，撤銷因此只是把複本 `batch-del` 掉；`runUndo` 開頭就把這些列放進 `movedBack`（那個集合本來是「搬回來源成功才處理複本」的閘門，來源沒被動過的列等同已經回到來源）。統計上它們也分開算：`JobStats.copied` 與 `moved` 各自加減，撤銷時扣回對應的那一個。

判斷依據是任務快照裡的 `chosen` 與 `sourceId`，所以關掉分頁再打開也還能撤銷。

### 6.3 失效影片

列表的 `attr !== 0` 即失效（原片被刪除或轉私有）。這些影片沒有標籤、合集，連標題都可能只剩「已失效視頻」，送給 AI 只是浪費 token，所以在 `runOrganize` 就從候選裡排除，只在審核表以 `invalid` 標記列出。要清掉時走 `resource/batch-del`（見 §2），與搬移共用 `writeQueue`、退避與 `-632` 對半拆；不可復原，UI 用兩段式確認（不用原生 `confirm`，那會卡住自動化測試與擴充功能分頁）。

### 6.4 節流與退避

- 讀取：`Throttle`（預設 2 req/s、±30% 抖動、序列化排隊），**整理收藏與清理關注共用同一個**（一次只跑一個任務，[1.1](#11-兩個前身合併成一個)）；封面 CDN 另一個 4 req/s。
- 寫入：`SerialQueue`，前一個完成後至少 800 ms 才開始下一個；搬移、取關、重新關注都走它。
- 退避：`network` 1/2/4 s；`riskControl` 60/120/240 s；`csrf` 重讀 cookie 一次；其他不重試。三次後停止並保留進度，UI 顯示原因。
- `-632`：`runWithSplit` 對半拆到單筆。
- 詳情與封面快取；WBI key 當日快取；任務快照每批寫入。

## 7. 影片頁的「智慧收藏」

接在原生工具列**後面**，不取代原生收藏。取代的做法一旦 B 站前端改版，連原生收藏都會壞掉；放旁邊最壞情況只是這顆按鈕不見，兩條路都保留。慣例參考 Raindrop.io 與 Pocket 的擴充功能（在原生 UI 旁加自己的入口），以及 Gmail 智慧標籤的「建議 ＋ 可覆蓋」而不是靜默套用。

一次點擊打 3 個請求：`wbi/view/detail`（標籤、合集、分區，順手寫進詳情快取供之後整理用）、`folder/created/list-all?rid=`（收藏夾清單 ＋ 每個夾的 `fav_state`，一個請求解決兩件事）、`resource/deal`（寫入）。

**設定的適用範圍**：影片頁跟整理流程走同一份設定，沒有例外——端點／模型／額外請求參數、限速、自訂分類指示，以及「要給 AI 看什麼」的三個開關（詳情、字幕、封面）。收藏夾描述也走同一支 `effectiveDescription`。

這一點修過兩次。封面原本是「視覺模式開著就一律附」（理由寫的是「單支影片線索最少」），字幕則是硬寫死不抓（理由是那 2 個請求會把「1.2 秒收好」變成 3 秒以上）。兩個理由都成立，但它們是**使用者該做的取捨**，不是應該藏在程式裡的常數：設定頁上明明有一個「抓字幕」的開關，打開之後影片頁卻不理它，這種不一致沒有辦法在介面上解釋。現在字幕開關對兩邊都生效，影片頁的說明直接寫「每支多等 1–2 秒」，要不要付這個代價由使用者決定。

只剩**詳情**在影片頁沒有實際效果，而且是結構性的：影片頁沒有 `resource/list`，連標題與 UP 都得靠 `view/detail` 拿，關掉它不會少打任何請求（同一支請求本來就要發），只會讓送給模型的欄位變少。所以那個開關在影片頁上不做任何事——它省的是「每支影片一次額外請求」，而影片頁根本沒有那次額外請求。

SPA 換片時把還留在畫面上的卡片全部收掉（`quickFav.content.ts` 的輪詢順便比對 bvid）：卡片握著的是**舊影片**的 aid，但 `syncNativeFav` 切的是**當前頁面**的 `.video-fav`——不收掉的話，在新影片上按舊卡片的「取消收藏」會把新影片的收藏按鈕熄掉。實測 prompt 約 1,464 token、completion 57 token、延遲 1.2 秒；system prompt 與收藏夾清單每次都一樣，端點有 prompt cache 時命中率會越來越高。它反而**省** B 站請求：原本是「先收進預設夾 → 之後 list ＋ view/detail ＋ copy/move」。

`confidence: low` 或找不到合適的夾時**不自動寫入**，直接展開帶搜尋的收藏夾清單並把建議標成 ✨——與審核表「低信心不預先勾選」同一個原則。

toast 是**一個收藏夾一張卡**，堆在右下角。合成一句「已收藏到《A》、《B》」看不出各自是什麼，也配不上封面；分開之後每張卡有自己的縮圖與自己的「取消收藏」，理由與「重新選擇」只掛在第一張，不重複。慣例參考 macOS 通知中心與 Chrome 下載提示的堆疊式卡片。

封面只有 `folder/created/list` 帶得回來（影片頁用的 `list-all` 欄位裡沒有 `cover`），所以多打一次，但**與 AI 的往返平行**發出：模型那趟約 1.2 秒，這個請求的時間被它吸收，使用者感覺不到；拿不到就退回夾名首字的色塊。

寫入之後把**原生收藏按鈕**一起切過來，不然畫面上會出現「toast 說收好了、旁邊的星星還是沒收藏」這種矛盾。B 站的「已收藏」就是 `.video-fav` 上的一個 `on` class——實測（2026-08）已收藏與未收藏的 SVG 完全相同（644 字元的同一段 path，`fill="currentColor"`），顏色差別純粹來自 `on`：有是 `rgb(0,135,189)`、沒有是 `rgb(162,167,174)`，所以切 class 就夠，不必偽造圖示。（量測時要注意那顆按鈕有 `transition: .3s`，加完 class 立刻讀 computed style 會讀到過渡前的舊值。）收藏數不動：它是總數，差一筆不影響判讀，而且會顯示成「1.5万」沒辦法可靠地加一。

成功卡 10 秒後自動消失（也就是還能按「取消收藏」的那段時間），滑鼠停在卡片上會暫停倒數、移開再續；錯誤卡與挑選器不自動關，因為它們還等著使用者決定。`npm run quickfav-preview` 用假影片頁餵真的 content script，把這幾個狀態都截下來，並驗證自動消失、hover 暫停，以及原生按鈕的 `on` 有沒有跟著切。

content script 不自己發請求：它在 `www.bilibili.com` 的 origin 上，沒有 `host_permissions` 帶來的 CORS 豁免，也拿不到 `chrome.cookies`（csrf）。所以 B 站與 AI 的請求都經 `core/messages.ts` 的訊息交給 service worker。這是 §1「SW 只做 DNR 與開分頁」的一個例外，理由是單支往返約 1.2 秒，離 SW 的 30 秒閒置回收很遠；長任務仍然只在 App 分頁跑。副作用是 SW 與 App 分頁各有一份 `core/scheduler.ts` 的單例，兩邊同時動作時讀取速率會疊加——一次點擊只有 2 個讀取請求，暫時可以接受。

DOM 依實測（2026-08）：`.video-toolbar-left-main` 底下每個功能是一個 `.toolbar-left-item-wrap`，收藏是其中的 `.video-fav.video-toolbar-left-item`。按鈕會把 `favWrap` 的 `data-v-*`（Vue scoped CSS）複製到自己身上，才拿得到工具列的間距與 hover 樣式。

**位置與時機都不能亂動**，這兩件事都會整頁壞掉，而且症狀一樣：影片頁只剩播放器與標題，右側推薦、UP 主頭像、右上角功能列全部不出現（使用者最初回報的正是這個畫面）。

- 只能 `toolbar.append()` 接在最後，不能插在收藏按鈕中間。B 站前端會依子節點位置操作工具列，中間多一個節點就讓它抓到相鄰的空白文字節點，`video.js` 拋 `n.setAttribute is not a function`，後續渲染整個停住。與 class 名無關——換成自訂 class 一樣壞。
- 要等 `window load` 之後再等 2 秒才掛。`document_idle` 時 B 站前端還在初始化工具列，這時就算接在最後也會噴 `Cannot read properties of undefined (reading 'style')`，而且按鈕會被它清掉再由輪詢補上一次。
- 換片後補掛用每秒一次的輪詢，不用 `MutationObserver`：要抓到工具列重畫就得監聽整棵 `documentElement` 子樹，代價遠高於一次 `getElementById`。

量測方式：Playwright 載入 build 後的擴充功能開影片頁，比對 `document.images.length` 與 `pageerror`／console error。乾淨頁面是 30 張圖 0 錯誤，插在收藏按鈕中間會掉到 5 張圖 2 個錯誤。toast 用 shadow DOM 隔離，深淺色依 `document.body` 的實際底色亮度決定（B 站的深色模式是 `html.night-mode`，與系統設定無關）。

## 8. 平台與端點限制

### 8.1 Chrome MV3 要點

- 有 `host_permissions` 的來源，擴充功能 fetch 視為 same-site，`SameSite=Lax/Strict` cookie 都會帶（developer.chrome.com storage-and-cookies）。`credentials: 'omit'` 完全不帶 cookie。
- DNR `modifyHeaders` 可 `set` `Referer`/`Origin`；`initiatorDomains` 可填 `chrome.runtime.id` 匹配擴充功能自身請求（SW 與 extension 頁面皆以 initiator domain 匹配）。
- 使用者自訂 AI 端點以 `optional_host_permissions` 動態申請（`chrome.permissions.request` 需使用者手勢，設定頁「儲存」按鈕觸發）。
- Chrome 137+ 品牌版移除 `--load-extension`，自動化測試改用 Playwright 的 Chromium（`channel: 'chromium'`，new headless 支援擴充功能）。
- **背景分頁會被節流甚至凍結**，這是把流程放進 App 分頁（§1）換來的代價。實測（2026-08，一般分頁）：剛切到背景時 `setTimeout(500)` 實際約 1,300 ms（1 秒鉗制，等於讀取速率砍半）；隱藏超過 5 分鐘後延遲超過 45 秒、fetch callback 逾 10 分鐘不回呼，整個任務等同停住。持有一個 Web Lock 可以豁免：同樣隱藏 14 分鐘時延遲只有 477 ms。因此 `ui/jobStore.ts` 的四個任務函式（`start`／`execute`／`removeInvalid`／`undoMoves`）與 `ui/followJobStore.ts` 的三個（`start`／`unfollow`／`restore`）在執行期間都握著 `bilitidy-job` 這把鎖（`ui/jobLock.ts`），`finally` 釋放；`navigator.locks` 在 extension 頁面可用，不需要額外權限。這把鎖**不負責兩種任務的互斥**（`acquireJobLock` 不等待鎖），互斥在 `ui/jobGuard.ts`。

- `relation/followings` 要 Referer 是 bilibili.com 子網域，擴充功能頁面不送 Referer → 同一條 DNR session rule 補上（只限本擴充功能自己發往 api.bilibili.com 的 XHR）。規則安裝失敗會記到 `session:headerRuleError`，App 分頁顯示頂層橫幅。
- 頭像只以 `<img referrerPolicy="no-referrer">` 顯示、不 fetch，所以關注清理沒有新增任何 host permission。
- 關注用到的端點都不需要 WBI 簽名；`biliFetch` 的 `wbi` 參數只有 `wbi/view/detail`、`player/wbi/v2` 帶。

### 8.2 OpenAI 相容端點的相容性處理

不同服務對「OpenAI 相容」的解讀差很多，`ai/client.ts` 針對實際踩到的狀況做了三件事：

- **推理模型只回思考內容**：DeepSeek v4 等模型在 `message.reasoning_content` 放思考、`content` 可能是空字串（`max_tokens` 太小時尤其明顯，`finish_reason=length`）。連線／視覺測試因此**不設 `max_tokens`**，並在 `content` 為空時改用 `reasoning_content` 判斷模型是否真的回應了；兩者都空才報錯，訊息帶上 `finish_reason` 與 `completion_tokens`。分類流程則直接停止並要求換模型／關閉思考模式，因為思考內容無法解析成 JSON。
- **`temperature` 不一定能送**：部分推理模型只接受預設值，送了就 400。設定頁的 temperature 留空時完全不放進 request body。
- **`response_format`**：預設自動偵測，4xx（非 401/429）時記住該 baseUrl+model 不支援並改送純文字重試。DeepSeek 文檔另外要求 prompt 裡必須出現 json 字樣，系統提示本來就有。
- **`content` 可能是陣列**：部分閘道回 `content: [{type:'text',...}]`，一律先攤平成字串。
- **廠商專屬參數的逃生口**：設定頁的「額外請求參數（JSON）」原樣併進 request body（`model`／`messages`／`stream` 會被移除），例如 DeepSeek 的 `{"thinking":{"type":"disabled"}}`。這樣就不用為每個廠商各加一個設定項。


### 8.3 為什麼 lint 是 oxlint 不是 ESLint

這個專案用 TypeScript 7（Go 版編譯器），`node_modules/typescript` 只有 `tsc` 執行檔、沒有 JS compiler API
（`createSourceFile`／`SyntaxKind` 都不存在），typescript-eslint 會直接拋 `does not support TS 7.0`。
要用它得再裝一份 TS 6 側掛，為了幾條型別感知規則多養一套編譯器，不值得。oxlint 不依賴 TypeScript 套件，速度也快得多。

`.oxlintrc.json` 關掉四條規則，都是「規則與本專案的刻意設計衝突」而不是「懶得修」：

| 關掉的規則 | 理由 |
| --- | --- |
| `no-await-in-loop` | 全案的讀寫**刻意**序列化過節流器（[6.4](#64-節流與退避)），平行化正是要避免的事 |
| `import/no-unassigned-import` | `import '@/ui/styles.css'` 要的就是副作用 |
| `react/react-in-jsx-scope` | 新版 JSX transform 不需要 |
| `react/set-state-in-effect` | 四處都是刻意把外部 store 同步進本地草稿 |

## 9. 評估後不做的事

想過、量過，然後決定不做的東西。列在這裡是為了不要每隔幾個月又被重新提案一次。

### 9.1 匿名讀取（暫時公開）

技術上可行（實測公開夾 `credentials: 'omit'` 讀取正常），但收益很小：列表只佔總請求約 2%，佔大宗的詳情請求匿名會直接 412。讀取類風控是 IP／指紋層級（`-412`、`-352`），不是帳號封禁；請求本來就從使用者瀏覽器與 IP 發出。附帶風險反而具體：處理期間收藏夾對所有人可見、程序中斷會停在公開狀態、`folder/edit` 是寫入且必須帶回原欄位否則清空。

初版做成預設關閉的選項（暫時公開 → 匿名讀 → 改回私密，加上 `local:pendingPrivacyRestore` 與啟動時自動還原）。實際評估後**整個功能連同 `core/anonRead.ts`、`biliFetch` 的 `anon` 參數一起移除**：省 2% 請求換使用者的私密收藏夾短暫公開，不划算，而且多一條需要維護的失敗路徑。真正降風險的是節流、快取與 412 即停。

### 9.2 在 B 站原生收藏彈窗裡標出 AI 建議

原本列為「部分採用」，實作時發現它需要在**彈窗打開的當下**就有建議，也就是每開一次原生彈窗
就打一次 AI——使用者沒有要求，卻要付延遲與費用。退而求其次做成「只有先按過智慧收藏才標記」的話，
那個標記本身也失去意義了（該收的已經收了）。真要做的前提是先有一層便宜的**本地**預測，
那是另一個量級的東西，不是現在該加的。

### 9.3 端點填錯時退回預設端點

`ai.baseUrl` 的 schema 原本是 `fallback(…, DEFAULT_BASE_URL)`：填了不合法的網址就默默換成 `https://api.openai.com/v1`。
用意是「壞值不要讓整段設定失效」，但它挑錯了退路——跑本機／區網模型是這個工具的主要使用情境之一，
而那些人填的 `http://192.168.1.10:8080/v1` 會被換成 OpenAI 的網址，**他們填的金鑰原封不動地留著配上另一個服務**，
下一次按「開始分類」就真的送出去了。設定頁那邊也只是把 Chrome 的內部錯誤原文貼在作業列上，一個字都沒說明真正的規則。

現在的規則是**寧可拒絕存檔，也不換端點**：`isAllowedBaseUrl()` 從 `core/settings.ts` export 出來給設定頁做即時驗證，
不合法時欄位標紅、主按鈕變灰、旁邊寫出「只接受 https://，本機模型可以用 localhost／127.0.0.1」；
`save()` 在驗證或權限申請失敗時直接 return，不往下 `updateSettings`。schema 的退路也從預設端點改成**空字串**——
「沒填過」（欄位不存在）才給預設端點，那是「還沒有意見」；「填壞了」要變成「還沒填端點」，讓 `aiReady` 是 false、UI 直接說出來。
順帶把「Base URL 留空」變成一個真的存在的狀態（以前空字串也會被換成預設端點，所以文檔描述的那條路走不到）。

同一章還有一個相關的判斷：左軌的「已連線」以前只看端點與模型兩個欄位非空，於是全新安裝一打開設定頁就是綠燈加
「Connected · gpt-4o-mini」——它描述的是「填了」，不是「連得上」。改成 `ai.connectionVerifiedAt`（比照 `visionVerifiedAt`）：
「測試連線」通過才記時間戳，改動端點／金鑰／模型就作廢，沒有它只寫「端點已填 · 未測試」。
`API Key` 也不再無條件標 required——本機模型多半不收金鑰，所以 required 跟著端點走，
而遠端端點沒填金鑰時由 `planOf()` 的 `needsApiKey` 把整理與收藏夾兩頁的主按鈕擋下來（`.why` 寫原因），
不要讓使用者讀完 2,311 次請求才收到一個 401。

### 9.4 其他已移除的路徑

這幾件事的完整理由寫在各自的章節，這裡只留索引，避免重複：

| 不做什麼 | 理由在 |
| --- | --- |
| 三個資料來源的「智慧」中間階、兩段式詳情（`detailLevel: 'twoPass'`） | [3.2](#32-三個資料來源三個開關) |
| 把封面拼成帶編號的 grid | [3.3](#33-視覺模式) |
| 刪除收藏夾（`folder/del`） | [5.1](#51-收藏夾的單一入口) |
| `resource/clean`（一次清掉整夾失效內容） | [2](#2-bilibili-api-查證)、[6.3](#63-失效影片) |
| 逐夾打 `folder/info` 取簡介與封面 | [2](#2-bilibili-api-查證)（`folder/created/list` 一個請求就有） |

### 9.5 用記下來的 tab id 找 App 分頁

點工具列圖示要「已經開著就聚焦、沒開就新建」，第一版把 `tabs.create()` 回傳的 id 存進 `storage.session`，
下次用 `tabs.get(id)` 確認分頁還在不在。**這個判斷是錯的**：使用者在 App 分頁裡打開 B 站（很自然——
表格裡每個帳號與影片都可以點開）之後，那個分頁的 id 還在、`tabs.get()` 照樣成功，於是圖示只是把一個
B 站分頁叫到前面，**點幾次都開不出 App，而且完全不說為什麼**。

要修就得知道那個分頁現在的網址，而 `Tab.url` 在 MV3 需要 `tabs` 權限或相符的 host permission
（`chrome-extension://` 不可能出現在 host permission 裡）。加 `tabs` 權限會在安裝時跳出「讀取瀏覽記錄」的警告，
和本專案刻意選 `declarativeNetRequestWithHostAccess` 的理由（§8）互相牴觸，為了一個單例判斷不值得。

改用 `runtime.getContexts({ contextTypes: ['TAB'] })`：它就是為了回答「本擴充功能現在有哪些 context、在哪個分頁」
而存在的，**不需要任何權限**（只回報自己的 context），`documentUrl` 直接可比。代價是它要 Chrome 116
（`minimum_chrome_version` 從 114 提上去；114 與 116 只差三個月，且瀏覽器自動更新）。
session storage 那份 id 一併刪掉，不留 fallback。

## 10. 未解決

還沒驗證、還沒決定的事。做到相關區域時順手收掉。

- **`resource/copy` 對「已經在目標收藏夾裡」的影片回什麼碼。** 如果是 `11201`（`FAV_ALREADY`，
  `bilibili/errors.ts` 已經有這個常數但 `classifyBiliError` 沒有分支），會落到 `api`／不可重試，
  於是「copy 成功但 move 失敗」的列在重試時整批失敗（保留原位的多目標列也一樣：重試會把已經
  成功的那幾份再 copy 一次）。實測後再決定要不要把 `11201` 視為成功。
  前車之鑑是 `resource/deal`（[2](#2-bilibili-api-查證)）：不要自己發明「成功」的判準，
  `success_num` 成功時也回 0。

- **Chrome 對 `chrome-extension://` 分頁的凍結策略是否與一般分頁完全相同**，沒有直接驗證。
  [8.1](#81-chrome-mv3-要點) 的 Web Lock 是成本一行的保險，不管答案是什麼都該做，所以沒有擋著。

- **模型回覆的理由偶爾是簡體**（「标签含绝区零」），system prompt 已經要求繁體。
  先觀察，不急著為此加後處理。

- **關注的寫入端點沒有在真實帳號上實測**：`relation/modify` act 2／4、`batch/modify` act 1、`tags/addUsers` 含 `-10` 都只依文檔與關注管理器腳本的用法實作，`npm run ui-preview` 只驗證了送出的參數。第一次真跑請照 `CLAUDE.md` 的 L4 清單挑 1–2 個帳號驗收。
- 取關一個「帳號已註銷」的關注會不會回 `22013`：文檔只說 act 1／5 不能對已註銷帳號操作。目前任何非 0 code 都當失敗顯示原因。
- 悄悄關注超過 50 個時 `whispers` 的分頁是否真的照 `pn` 翻：實測帳號沒有悄悄關注。
- 是否上架 Chrome 線上應用程式商店：未決定。

### 已知取捨（不是待辦）

- service worker 與 App 分頁各有一份 `core/scheduler.ts` 的單例，兩邊同時動作時讀取速率會**疊加**。
  「智慧收藏」在 App 分頁任務期間握著的 `bilitidy-job` Web Lock 上排隊（`core/quickFav.ts` 的 `queueBehindJob`），所以實際上不會同時發；SW 端的功能變多時要重新處理（[7](#7-影片頁的智慧收藏)）。
- 查關注的預設讀取速率從前身的 1 req/s 變成共用的 2 req/s（[1.1](#11-兩個前身合併成一個)）；真實帳號上幾千個關注會不會更容易踩到 `-412`，還沒量過。

## 11. 關注：Bilibili API 查證

| 端點 | 文檔 / 實測重點 |
|---|---|
| `GET /x/web-interface/nav` | 未登入回 `-101`。實測登入態回 `isLogin: true` 與 `mid`。查活躍度要 WBI 簽名，金鑰就是從這裡拿的（`bilibili/http.ts` 每日快取一份）。 |
| `GET /x/relation/stat?vmid` | `following`／`whisper`／`black`／`follower`；`whisper` 只有自己登入時非 0。實測 `following: 2221, whisper: 0`。 |
| `GET /x/relation/tags` | `[{tagid, name, count, tip}]`；`-10` 特別關注、`0` 默认分组。實測 9 個，前四個 id 是 `-10, 0, <自訂>, <自訂>`。 |
| `GET /x/relation/followings?vmid&pn&ps=50&order_type=` | **只有登入、Referer 為 bilibili.com 子網域、UA 不含 python 時才回清單**（否則 `code 0` 但空）——DNR 規則的理由。自己的清單可全部翻頁（別人的只到 100 個）。實測 `total: 2221`、一頁 50、欄位如文檔（`mid, attribute, mtime, tag, special, uname, face, sign, official_verify, vip, …`）；`tag` 默认分组為 `null`，`attribute` 第一頁全是 2。`order_type` 留空＝依關注順序（新到舊），`attention`＝依最常訪問。 |
| `GET /x/relation/whispers?pn&ps=50` | 文檔沒列分頁參數；關注管理器腳本一直帶著 `pn`／`ps` 翻。實測帶參數回 `code 0`、`{list: [], re_version}`（該帳號沒有悄悄關注）。悄悄關注功能已下線（`attribute 1`「现已下线」），既有資料仍在。 |
| `GET /x/space/wbi/arc/search?mid&ps=1&pn=1&order=pubdate&index=1` | 空間頁自己用的投稿列表，**必須 WBI 簽名**（不簽名回 `-403 访问权限不足`）。`order=pubdate` 最新在前，時間欄位是 `created`（不是 `pubdate`）；`page.count` 是投稿總數，**`count === 0` 才是「真的沒發過片」**。2026-09-06 實測：mid 20754273 回 `count: 24` 與 2023-03-01 的最新一支、mid 3493074839800236 回 `count: 0`、mid 1875094289 回 `count: 831`。隱藏投稿或隱私空間回 `-403`，風控回非 0 code——都丟例外變成「未知」（見 [12](#12-三態與勾選資格)）。 **2026-09-08 補驗 `created` 的語意**：空間頁自己也是吃 `arc/search`，拿它比對會循環，所以改用 `view` 介面的 `pubdate` 破環——同樣三個 mid，`created` 與 `pubdate` **分秒相同**（BV16j411G7sV 皆為 2023-03-01 11:38、BV1iPMn6zEy9 皆為 2026-07-09 22:34），標題與 bvid 也與空間頁投稿列表第一支一致；`count: 0` 那個帳號空間頁顯示「空间主人还没投过视频」。順帶量到：該帳號有 1 則**圖文**，B 站自己的「投稿」頁籤把圖文算進去，`arc/search` 的 `count` 不算——活躍度只看影片投稿。 |
| ~~`GET /x/series/recArchivesByKeywords`~~（2026-09-06 換掉，見 [17](#17-關注評估後不做的事)） | 名字像投稿列表，其實是**「推薦稿件」介面**：回幾筆與 `ps` 不成比例，而且會少回。實測 `ps=1` 對**每一個**帳號都回 `code 0` 加空 `archives`（`page.total` 同時回 521）；`ps=20` 對 `total=74` 的帳號照樣回 0 筆。用它查活躍度＝整份關注清單被判成「從未投稿」。 |
| `POST /x/relation/modify` | `fid`、`act`、`re_src`、`csrf`（cookie `bili_jct`）。`act`：1 關注、2 取關、**3 悄悄關注已下線**、4 取消悄悄關注、5 拉黑、6 取消拉黑、7 踢粉。錯誤碼 `22001` 不能對自己、`22002` 對方隱私、`22003` 在黑名單、`22009` 關注上限、`22013` 帳號已註銷、`22014` 已關注、`40061` 用戶不存在。**未在真實帳號上實測寫入**（見 [10](#10-未解決)）。 |
| `POST /x/relation/batch/modify` | `fids` 逗號分隔 ≤50，**`act` 僅可為 1 或 5**（只能批次關注與拉黑，不能批次取關）。回 `data.failed_fids`。 |
| `POST /x/relation/tags/addUsers` | `fids`、`tagids`（逗號分隔）；文檔範例 `tagids=-10,207542`，即特別關注可以這樣加。`22104` 分組不存在、`22105` 未關注。另有 `copyUsers`（複製）與 `moveUsers`（`beforeTagids`／`afterTagids`）。 |
| 錯誤碼 | `-101` 未登入、`-102` 封停、`-111` csrf、`-352` 風控、`-400` 請求錯誤、`-403` 權限、`-412`／HTTP 412 IP 風控、`-799` 請求過頻。 |

頭像：`https://i0.hdslb.com/bfs/face/<hash>.jpg`，CDN 支援 `@64w_64h_1c.webp` 縮圖後綴（`ui/format.ts` 的 `faceUrl`）。以 `<img referrerPolicy="no-referrer">` 顯示，不 fetch，所以不需要 hdslb 的 host permission。

## 12. 三態與勾選資格

Java 版修過一個會誤取關活躍帳號的 bug：風控回的是 HTTP 200 加非 0 code，payload 裡沒有影片清單，讀得太天真就等於「這個帳號從沒發過片」。修法是把狀態拆成三態並讓第三態永遠進不了批次。這裡把它做成結構而不是紀律：

- `bilibili/archive.ts` 只在 `code 0` 且 **`page.count === 0`** 時回 `null`；任何錯誤都丟例外，分類是 `core/checkActivity.ts` 的事。「說有投稿卻一支都沒回」（`count > 0` 但清單空、或連 `count` 都沒有）也算錯誤——2026-09 換端點前就是這種回應被當成「沒有影片」。
- `core/activity.ts` 的 `classifyActivity()` 把原料分成 `videos`／`noVideos`；`unknownActivity()` 記下原因。
- `daysInactive()`：`noVideos` 回 `Infinity`（比任何門檻都不活躍）、`unknown` 與沒查過回 `null`；`isInactive()` 對 `null` 永遠 `false`。
- **`canSelect(row)` 是唯一決定「這一列能不能被動手」的地方**：`pending` 且狀態已確認。勾選框的 `disabled`、`jobStore` 的 `toggle`／`setSelected`、「勾選顯示中的 N 個」、取關的目標挑選全部呼叫它。
- 匯出另外再過一次 `confirmedOnly()`（`core/exportRows.ts`）——不管畫面上勾了什麼。

「還沒查」（這一輪被停下時剩下的帳號）在型別上是 `activity === undefined`，與 `unknown` 分開顯示（「還沒查」vs「查不到＋原因」），但在資格上一樣：都不能選，分面裡都算「查不到」，橫幅上可以一鍵補查。

## 13. 版面：分面審核表

視覺世界由簡報釘死：與整理收藏同一套深色工作台（token、1px 分隔線、粉色只給選取與主要動作、頂列／內容／底部作業列的滿版高度網格、畫出來的 SVG 圖示）。要決定的只有「審核畫面」的結構。

決定的過程（Impeccable 的 surface 擲骰，seed `0f2a002a`）：先把 7 種材料上不同的結構依共鳴度排好——分面審核表、時間軸門檻、清單＋檢視窗、分組帳本、串流排行板、兩箱分揀、逐張牌組——骰子發第 7、1、4 張（牌組領頭、審核表、帳本），使用者鎖定**分面審核表**。code-led：沒有 comp；當時的契約寫在前身 `src/entrypoints/app/index.html` 的 body 註解裡，合併時沒有搬過來（視覺系統以 `DESIGN.md` 為準）。

結構上的幾個決定：

- **門檻在左軌最上面**，是整張表的主控：數字欄位＋180／365／730 三顆常用值，停止輸入 300ms 後套用，改了只重篩不重抓。它存進設定，下次打開還是同一個數字。
- **三組分面都帶計數，數字反映其他分面已套用之後還剩多少**（一般分面搜尋的慣例）：選了狀態「安靜超過門檻」再看分組，分組的數字就是「安靜超過門檻的裡面各分組有幾個」。狀態分面裡「全部／安靜超過門檻／還在投稿／查不到」就算是 0 也一直顯示——門檻一改就要看得到「安靜」變成多少。
- **表格每一列都是證據**：最新投稿的標題（可點開）與日期、安靜天數（超過門檻的用琥珀色、字級高一階）、分組標籤、關注類型標記、關注日期。查不到的列整列退到後面、勾選框鎖著並帶 title 說原因。
- **不預先勾選任何東西**；「勾選顯示中的 N 個」只勾能勾的。
- **底部作業列永遠是「取關 N 個」＋為什麼不能按**；破壞性動作在作業列內二次確認（一句話＋確定＋取消），不開 modal。撤銷、重試、匯出也在同一條列上。
- 查活躍度時中央是儀表（階段、`done/total`、已用與預估剩餘、實際速率、快取命中、查不到）加最近幾筆請求，左軌是走到第幾步與「目前為止安靜 N 個」——一支跑半小時的任務要看得出它是還在跑、卡住、還是被風控擋著。
- 窄於 900px 時左軌以自然高度排在內容上方、整頁順流捲動（`.work` 改成 block：grid 的 `auto` 列會被容器高度壓扁，
  左軌內容就溢出到中央欄上——實測量過），作業列改成換行而不是橫向捲。表格列改成**堆疊**：勾選框在左，右側由上而下是
  名字＋標記、天數（帶單位）＋mid、分組、最新投稿＋日期、狀態；天數欄、關注日期欄與表頭（含排序）省略。
  三欄並排在 390px 試過三輪都是帳號格與最新投稿欄互搶寬度，寬度怎麼調都有一邊被切，所以改成讓列往下長。
  這是桌機工具，手機只求每一件事都看得到、按得到。

### 13.1 時間軸欄：門檻就是播放頭（2026-09）

「安靜 1,387 天」是一個要換算的數字；把每個帳號從最新一支投稿到今天畫成一條軌，門檻畫成一條貫穿所有列的粉色播放頭，
安靜期就變成看得見的長度，而「超過門檻」就是「軌從播放頭左邊開始」。表頭是年份刻度尺，播放頭的圓鈕是一個換了臉的原生
`<input type="range">`（鍵盤左右鍵也能拖），拖了就呼叫與左軌數字欄位同一支 `setThreshold`——兩個控制項、一個設定。

軸的範圍由顯示中的列決定（`ui/pages/follows/timeline.ts`）：左端是「最舊的一支投稿」與「門檻再往前 90 天」兩者較早的那個，
再往前推到那年的 1 月 1 日，至少涵蓋 3 年；右端是現在。年份超過 10 個時刻度每 2 年一格、超過 20 個每 5 年。
每一列自己畫一段播放頭（上下各多 1px 蓋過列的分隔線），看起來就是一條連續的線——不用量欄位位置去疊一個絕對定位的元素。
從未投稿與查不到的列是虛線軌加一句說明；證據欄（最新投稿的標題與日期）保留，時間軸是它的圖形版，不取代它。
寬度不夠時（≤1200px）先收掉時間軸欄，門檻仍在左軌改。

## 14. 取關與撤銷

- 取關逐筆：文檔明載 `batch/modify` 只接受 act 1／5，所以每個帳號一次 `relation/modify`，一般與互粉 act 2、悄悄關注 act 4（`core/unfollow.ts` 的 `unfollowActFor`）。經與搬移共用的 `writeQueue`（`SerialQueue`）排開，間隔由設定決定（預設 800 ms）。一筆失敗不影響其他筆；未登入／風控這類致命錯誤整批停下，還沒輪到的保持 `pending`。
- **撤銷＝重新關注＋還原分組**：`batch/modify` act 1 每批 20 個（文檔上限 50，小一點失敗時損失也小；`RESTORE_BATCH_SIZE`），`failed_fids` 標成 `restoreFailed`。然後依 `tagsToRestore(entry)`（自訂分組 ＋ 特別關注 -10，排序後當簽名）把同簽名的帳號併成一次 `tags/addUsers`。**分組還原失敗不算撤銷失敗**——關注關係已經回來了，只在列上留備註。
- 做不到的兩件事直接寫在確認句裡：悄悄關注無法還原成悄悄（act 3 已下線），會變成一般關注；關注日期會是今天。
- 寫入流程就地修改傳進來的 `ReviewRow`，`jobStore` 先複製一份再以 `onRow` 回寫觸發重繪；`isCurrent()` 擁有權判斷防止被中止的那一輪事後蓋掉新任務的狀態（與整理收藏的 `runWrite` 同一個模式）。
- 取關之後勾選集合會把已經不是 `canSelect` 的列清掉；`retryFailed` 把 `failed` 退回 `pending`、`restoreFailed` 退回 `done`（帳號其實還在取關狀態，可以再撤銷一次）。

## 15. 節流、退避、停下

- 讀取走 `readThrottle`（`Throttle`：最小間隔 ＋ 抖動），與整理收藏共用同一個，預設 2 req/s ±30%（設定頁「保守 1／預設 2／快 3」，進階 0.2–5；[1.1](#11-兩個前身合併成一個)）。前身的預設是 1 req/s——Java 版最後定在 1 筆／1.5 秒，實測再快就容易碰到 `-412`——所以設定頁的說明寫明關注幾千個的話選「保守」。關注清單分頁與逐帳號查詢共用同一個節流器。
- 退避與整理收藏同一支 `net/backoff.ts`（[6.4](#64-節流與退避)）：網路錯誤 1 → 2 → 4 秒；風控（`-352`／`-412`／HTTP 412／`-799`）60 → 120 → 240 秒；csrf 立刻重讀一次；其餘不重試。
- **風控與取消不丟例外**（`checkActivity` 回 `stopped`）：Java 版被風控停在第 800 個帳號時，前 799 個的結果照樣可以審核、可以取關，剩下的下次補。這裡一樣：部分結果進審核表、橫幅寫原因與剩幾個、按一下補查剩下的（會重新開始一輪，但快取讓已查的不重打）。
- 任務期間握著 `bilitidy-job` Web Lock（[8.1](#81-chrome-mv3-要點)）：背景分頁會被 Chrome 凍結，Web Lock 可以豁免；計時器被鉗到 1 秒的減速仍會發生，畫面上提醒一次。

## 16. 活躍度快取

- 與影片詳情、封面同一個 IndexedDB `bilitidy` 裡的 `activity` store（keyPath `mid`、索引 `checkedAt`），每列是 `ActivityRecord`（status、latest、checkedAt、reason、schema）。開啟時掃掉 schema 不對的舊列；設定頁的「清除」與收藏夾那一組分開。
- **`schema` 目前是 2**。換掉 `recArchivesByKeywords` 時從 1 跳到 2，就是為了讓舊版留下的「從未投稿」紀錄自動作廢：TTL 有 30 天，不作廢的話換了端點也要等一個月才看得到正確結果。改活躍度紀錄的形狀或**判定方式**時都要跟著跳號。
- **TTL 30 天是固定值，不做設定**（`ACTIVITY_TTL_DAYS`）：快取的是「最後一支影片的日期」，帳號之後又發片的話快取會**高估**不活躍天數——那正是會誤取關的方向，所以寧可多查也不讓人把它調成永不過期。
- **`unknown` 永遠不新鮮**（`isFresh`）：查不到的下次一定重查；仍然寫進快取只是為了顯示上次是什麼時候失敗的。
- 準備畫面的「只查沒有新鮮結果的／每個都重查」是這一輪的選擇，不是設定。
- 關注清單本身不快取：幾千個關注也只是幾十頁，每次跑都重讀，新關注、取關過的自然對得上。

## 17. 關注：評估後不做的事

- **用動態（dynamic feed）判斷活躍度。** 有的 UP 不發片但天天發動態；Java 版只看投稿，這裡沿用。動態的端點需要 WBI 且回應大、風控更敏感，而且「還在發動態」對「要不要繼續跟他的影片」不是同一個問題。可以另議，先不做。
- **分組管理（建立／改名／刪除分組、移動成員）。** 那是關注管理器腳本的功能；這個工具只讀分組當訊號、撤銷時放回去。
- **拉黑、粉絲操作。** 與清理關注無關。
- **預先勾選「安靜超過門檻」的列。** 一顆「勾選顯示中的 N 個」就夠；預勾會讓人習慣性直接按確認。
- **把「默认分组」以外的分組當成「一律保留」自動排除。** 那是使用者用分組分面自己決定的事，不該替他決定。
- **把門檻做成每一輪的臨時值。** 它存進設定：使用者對「多久算安靜」的判斷不會每次不一樣。
- **在 B 站個人空間頁加按鈕（content script）。** 沒有需求：這是幾個月跑一次的批次工具，從工具列圖示進來就好。
- **繼續用 `series/recArchivesByKeywords` 查投稿。**（2026-09-06 換掉）Java 版沿用它是因為免登入、免 WBI，這裡也照抄，還把 `ps` 從不帶改成 `ps=1` 省 payload——當時「`ps=1` 回同一支第一名」的實測只驗了一個帳號。實際上它是推薦稿件介面：回幾筆與 `ps` 無關，`ps=1` 對每一個帳號都回空 `archives`，於是**整份關注清單都被判成「從未投稿」**，而 `noVideos` 的不活躍天數是 `Infinity`——最危險的方向。改走空間頁的 `space/wbi/arc/search` 並以 `page.count === 0` 為唯一的「沒有影片」判準；「回應對不起來就當未知」寫進 `bilibili/archive.ts`，不再靠「空清單＝沒影片」這種默認。
