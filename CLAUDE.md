# biliTidy — 專案指引

Chrome MV3 擴充功能（WXT + TypeScript + React），兩件「先審核、再批次收拾」的事放在一起：用 AI 整理 Bilibili 收藏夾，
以及找出不再投稿的關注帳號批次取關、可撤銷。由 biliFavOrg 與 biliFollowCleaner 合併而來。
文件與註解用繁體中文；程式碼識別符、log、commit 用英文。介面文案英文為預設語系（`src/i18n/en.ts` 是型別來源）。

**要查什麼看哪裡**（索引在 [`docs/README.md`](docs/README.md)）：
怎麼運作 → `docs/how-it-works.md`；為什麼這樣做、B 站 API 查證 → `docs/design.md`（有目錄，本檔以節號引用它：1–10 整理收藏、11–17 清理關注）；
實測數據 → `docs/research/`；改了什麼 → `CHANGELOG.md`；產品定位與不可變規則 → `PRODUCT.md`；視覺系統 → `DESIGN.md`。
**本檔只寫「改這裡會踩到什麼」**——理由不重複，一律指到 `design.md`。

## 常用指令

- `npm run build` → `.output/chrome-mv3`（`chrome://extensions` → 開發人員模式 → 載入未封裝項目）；`npm run dev` 開發模式
- `npm run typecheck`、`npm test`（vitest）、`npm run lint`（oxlint，**不是 ESLint**：TypeScript 7 沒有 JS compiler API）、`npm run format`
- `npm run ui-preview`：攔截 B 站 API 與 AI 端點餵假資料，把四個分頁走一遍——整理／收藏夾／審核／搬移／撤銷、關注的準備／執行中／審核／
  取關／撤銷／停下／查不到、兩種任務互斥、設定三段、繁中、手機寬度——截圖到 `.output/ui/`（不需登入。**UI 改動一律要看截圖**，不要只靠推論）
- `npm run quickfav-preview`：假影片頁餵給真的 content script，截圖智慧收藏的 toast（淺色／深色／挑選器）
- `npm run smoke`：Playwright 載入真的擴充功能走設定頁（需先 build；首次 `npx playwright install chromium`）
- `npm run gen-icons`：由 `public/icon/icon.svg` 重新產生 `public/icon/*.png`（Playwright 內建 Chromium 轉檔；改圖示只改 SVG）；
  `npm run mock-ai`：本機 mock OpenAI 相容端點
- `.env`（已 gitignore，範本見 `.env.example`）只給手動測試腳本用；擴充功能本身不讀它

## 單一來源：這些規則只准有一份實作

漂移都是從「再算一次就好」開始的。要用這些判斷就 import，不要自己重算。

| 規則 | 唯一實作 | 誰讀它 |
| --- | --- | --- |
| 這份設定實際會怎麼跑（`withDetail`／`withSubtitle`／`withCover`／`batchSize`／`visionActive`／`aiReady`／`needsApiKey`） | `core/plan.ts` 的 `planOf()` | estimate、flow、promptPreview、organizer、quickFav、三個 UI 分頁 |
| Base URL 收不收（只准 https，或本機的 localhost／127.0.0.1）、算不算本機端點（本機不用金鑰） | `core/settings.ts` 的 `isAllowedBaseUrl()`／`isLocalEndpoint()` | schema 的 `baseUrl`、設定頁的即時驗證與存檔閘門、`planOf` 的 `needsApiKey` |
| 組 prompt → 退避重試 → 解析 → 換回 media_id | `core/classify.ts` 的 `classify()` | 整理流程、影片頁 |
| 要不要附封面（全有全無） | `core/settings.ts` 的 `attachesCover()` | 同上 ＋ estimate、flow、promptPreview |
| 收藏夾描述取哪一份 | `core/folderStore.ts` 的 `effectiveDescription()` | 整理流程、影片頁 |
| 自訂分類指示怎麼接 | `ai/prompt.ts` 的 `withCustomInstructions()` | 兩份系統提示 |
| 收藏夾審核表的篩選 | `ui/pages/run/reviewFilter.ts` | 整理頁審核畫面 |
| 關注這一列**能不能被勾選**（pending 且狀態已確認） | `core/activity.ts` 的 `canSelect()` | 關注表格的勾選框、`followJobStore` 的 toggle／setSelected、「勾選顯示中的 N 個」、取關的目標挑選 |
| 幾天沒更新、算不算不活躍（嚴格大於門檻；`noVideos`＝∞；未知＝null／false） | `core/activity.ts` 的 `daysInactive()`／`isInactive()` | 分面計數、篩選、排序、天數欄、CSV |
| 匯出的最後一道防線（再排除一次未知） | `core/exportRows.ts` 的 `confirmedOnly()` | UID 清單、CSV |
| 關注審核表的分面怎麼算、怎麼篩、怎麼排 | `core/followFilter.ts` | 關注頁左軌與表格 |
| 活躍度快取算不算新鮮（TTL 30 天、unknown 永遠不新鮮） | `core/cache.ts` 的 `isFresh()` | `checkActivity` 的 miss 判定 |
| 關注審核表時間軸的座標（軸的範圍、年份刻度、門檻＝播放頭的位置） | `ui/pages/follows/timeline.ts` | 審核表的表頭刻度尺、每一列的軌與播放頭、可拖的 range |
| 設定頁哪一章改過還沒存（章節軌亮起、主按鈕的數字、`.why` 的句子） | `ui/pages/settings/SettingsPage.tsx` 的 `changedFields()` | 設定頁控制列；各章只用 `saved` 比對自己的欄位畫 `dirty` 邊框 |
| 三態分類（API 原料 → videos／noVideos／unknown） | `core/activity.ts` 的 `classifyActivity()`＋`bilibili/archive.ts` 的「錯誤一律丟例外」 | `checkActivity` |
| 取關用哪個 act（悄悄 4、其餘 2）、撤銷要還原哪些分組（含 -10） | `core/unfollow.ts` 的 `unfollowActFor()`／`tagsToRestore()` | 取關與撤銷流程 |
| 兩種任務一次只跑一個 | `ui/jobGuard.ts` 的 `claimJob()`／`releaseJob()` | 兩個 jobStore 的每個任務函式、兩頁的主按鈕與 `.why` |
| 介面文案（英文預設、繁中可切） | `src/i18n/en.ts` 與 `zh-Hant.ts`（後者型別為 `Messages`，少一個鍵就 typecheck 失敗）；關注的文案在 `follows.*` 命名空間 | 全部 UI、content script、core 的進度文字、錯誤訊息 |

`plan.ts` 是踩過的坑：字幕規則就是各自重算漂走的（影片頁曾經少了「詳情關掉時字幕也不抓」）。
**未知不等於不活躍**是關注清理的核心承諾（`PRODUCT.md` 原則 2）：任何新的「挑出一批帳號來動手」的路徑都要經過 `canSelect()`，
任何新的匯出都要經過 `confirmedOnly()`。

**這三個是同一組設定判斷的三種呈現，改一個要三個一起改**（各有測試）：
`core/estimate.ts`（會打幾次請求）、`core/flow.ts`（會走哪幾步）、`core/promptPreview.ts`（會送出什麼內容）。

## 分層與邊界

- 依賴方向：`ui → core → {bilibili, ai, net, shared}`；`bilibili`／`ai`／`net` 是葉節點，不 import `core`。
  `i18n` 是另一個葉節點，誰都可以 import。深層模組用全域的 `t()` 取字串，React 端用 `useMessages()`／`useLanguage()`；
  每個 JS context（App 分頁、SW、content script）各自 `initLanguage()` 一次並 `watchLanguage()` 保持同步。
  **AI prompt 不是 UI**：`ai/prompt.ts`／`ai/describe.ts`／`ai/vision.ts` 與 `bilibili/tid.ts` 刻意維持中文，它們是送進模型的功能性輸入。
- **兩條長流程都在 App 分頁**（`src/entrypoints/app` + `src/ui`）執行。service worker 只負責 DNR header 規則、開分頁，
  以及影片頁「智慧收藏」的單支往返（約 1.2 秒，`core/quickFav.ts`，包在 `background.ts` 的 `keepAlive()` 裡）。**不要把長任務搬進 SW**（30 秒閒置回收）。
- **兩個 jobStore**：`ui/jobStore.ts`（整理收藏）與 `ui/followJobStore.ts`（清理關注），同一個模式——AbortController 的**擁有權判斷**
  （`isCurrent()`：被中止那一輪的 catch／finally 是非同步跑完的，沒有它會把新任務的 phase 蓋掉）、`ui/jobLock.ts` 的 Web Lock、快照。
  新增任務函式照抄那個模式，而且**開頭要 `claimJob(kind)`、finally 在 `isCurrent()` 時 `releaseJob(kind)`**——漏掉的話另一種任務會同時跑。
- App 分頁的任務期間持有 `bilitidy-job` Web Lock（`core/scheduler.ts` 的 `JOB_LOCK_NAME`）：背景分頁被 Chrome 凍結時任務會停住，Web Lock 可以豁免。
  它**不負責互斥**（`acquireJobLock` 不等待鎖）；互斥在 `ui/jobGuard.ts`。SW 的「智慧收藏」在同一把鎖上排隊（`core/quickFav.ts` 的 `queueBehindJob()`），
  所以兩份 `core/scheduler.ts` 單例（SW 與 App 分頁各一份）不會同時發請求。**新增任何會打 B 站的 SW 路徑時記得比照。**
- **所有 B 站讀取必須經 `core/scheduler.ts` 的 `readThrottle`，寫入必須經 `writeQueue`**，不要繞過。兩種任務共用同一把（一次只跑一個）。
- 查活躍度時風控或取消**不丟例外**（`core/checkActivity.ts` 回 `stopped`），部分結果照樣進審核；取關／撤銷也是（`core/unfollow.ts` 的 `WriteResult.stopped`）。
  整理收藏那邊是 `fetchDetails` 會丟、搬移遇到致命錯誤中止剩下的批次（`net/backoff.ts` 的 `isFatal()`）。

## App 分頁的版面

- 版面是**「頂列 ／ 內容 ／ 底部作業列」的滿版高度網格**（`ui/styles.css` 的 `.app`／`.page`／`.work`），每一頁自己決定左軌與右欄怎麼分，
  內容各自捲動——**不是一條長頁面**。頂列四個平行分頁：整理、收藏夾、關注、設定（`ui/App.tsx`）。
- **每個分頁的底部作業列永遠是同一件事**：你正要執行的批次，以及執行它的按鈕；按鈕變灰時旁邊一定寫得出原因（`.why`，允許換行）。
  破壞性動作（取關、撤銷、移除失效影片）一律在作業列內二次確認，不開 modal。另一種任務在跑時主按鈕變灰、`.why` 寫 `app.busyWith*`。
- 整理頁三種畫面共用這個外殼（準備／分類中／審核），關注頁也是（準備／執行中／審核）。進度儀表是共用元件 `ui/components/ProgressPanel.tsx`
  （讀數欄位與骨架形狀由各頁傳入；進度軌分「已緩衝＝快取」灰段與「已播＝真的打了請求」粉段，呼叫端傳 `cached`），取消只在作業列。
- **設定頁是六章分三組**（`ui/pages/settings/SettingsPage.tsx`）：01 AI 端點、02 給 AI 看什麼、03 分類指示＝「整理收藏 · 需要 AI」；
  04 讀寫速度、05 快取與備份、06 語言＝「兩個工具共用」；左軌最後一列是通往關注頁的門（清理關注不用 AI）。
  每一章開頭寫用在哪幾個功能（`SCOPE`），每個設定用 `components/fields.tsx` 的 `SettingRow`（標籤／說明／預設／控制項）；
  **新增設定欄位時三處同步**：`SettingRow` 的 `desc`＋`def`、`changedFields()` 的比對、`docs/how-it-works.md` 的表。
  控制列中段是章節軌（六段、缺口在 03／04 之間），改過沒存的段亮粉、目前所在的段有播放頭。
- 關注頁的門檻是審核表的主控，放在左軌最上面；**審核表時間軸欄裡那條粉色播放頭也是它**（表頭的 range 可拖，拖了就是改設定，座標算法在
  `ui/pages/follows/timeline.ts`）。分面的計數反映其他分面已套用之後還剩多少。關注審核表是 `table.grid.dense`
  （列高 46px；≤1200px 先收掉時間軸欄，≤900px 改成堆疊列）；整理頁與收藏夾的表格維持原樣、在 `.c-body` 裡橫向捲。
- **視覺只有深色一套**（`color-scheme: dark`，沒有 `prefers-color-scheme` 分支），token 見 `DESIGN.md`。粉色只給「現在／你選的／主要動作」
  （`tr.sel`、`.facet.on`、`.chip.on`、`.btn.primary`、播放頭與進度軌的已播段）；狀態色是彈幕色板（黃＝超過門檻／草稿、綠＝還在投稿／完成、
  紅＝失敗、淡藍＝從未投稿／告知）。**不發光、不投影**：焦點是實心邊框或 outline，沒有 box-shadow。
  淺色只留給影片頁的卡片，因為它長在 B 站自己的頁面上。
- 數字走內建的 Spline Sans Mono（`public/fonts/SplineSansMono.woff2`，`@font-face` 在 `styles.css`）：時間碼、計數、天數、mid、端點名。
  介面字仍是系統堆疊；不連外抓字型。
- 圖示一律畫在 `ui/components/icons.tsx`，**不要用 emoji 或符號字元**（系統字型缺字會變豆腐方塊）。工具列圖示的原稿是 `public/icon/icon.svg`，
  `IconBrand` 畫同一組座標；改圖示要兩邊一起改、重跑 `npm run gen-icons`，並更新「測試視覺」的確認題（`connection.doesItMatchQuestion`）。
- 關注的查不到列（`tr.locked`）整列退到後面、勾選框 disabled 並帶 title 說原因；已取關的列 `tr.done-row`、失敗的 `tr.failed-row`。

## 影片頁的 content script

細節與量測方式見 `design.md` 7。

- `entrypoints/quickFav.content.ts` **只畫按鈕與 toast，不發任何請求**：它拿不到 host_permissions 的 CORS 豁免與 `chrome.cookies`，B 站與 AI 的請求一律經 `core/messages.ts` 交給 SW。
- 按鈕**只能 `append` 到工具列最後、而且要等 `window load` 之後再掛**。插在收藏按鈕中間或掛得太早，B 站前端會抓到錯的節點而拋錯，**整個影片頁的渲染會停住**。
- DOM 選擇器（`.video-toolbar-left-main`／`.video-fav`／`.toolbar-left-item-wrap`）是實測來的，改動前先到真實影片頁確認。DOM id 是 `bilitidy-quick-fav`／`bilitidy-toast-host`（`scripts/quickfav-preview.mjs` 也用它們）。
- toast 是**一個收藏夾一張卡**堆在右下角：成功卡 10 秒後自動消失、滑鼠停在上面會暫停，錯誤卡與挑選器不自動關。
- **SPA 換片時要把還在畫面上的卡片全部收掉**；寫入後同步原生收藏按鈕（`.video-fav` 上的 `on` class）。
- 影片頁**跟隨設定**：端點／模型／額外參數、限速、自訂分類指示、封面附圖與字幕，全部走 `planOf`。**不要再讓影片頁長出自己的規則。**

## B 站 API

端點清單、實測結果與錯誤碼在 `design.md` 2（收藏夾）與 11（關注），WBI 測試向量在 `docs/research/wbi-test-vector.md`。最容易踩到的幾件事：

- `resource/list` 的 `ps` 上限 40、預設依收藏時間新到舊，但**一頁不保證回滿**。**估算與進度條一律用 `FAV_PAGE_YIELD`（每頁 30 支），不要用 `FAV_PAGE_SIZE` 算頁數。**
- 拿 `cover` 與 `intro` 要用 `folder/created/list`，**不是 `list-all`**。影片頁反過來用 `list-all`（帶 `rid` 就回每個夾的 `fav_state`）。
- `view/detail` 要帶 cookie（匿名回 HTTP 412），且 `tname` 實測為空，用 `bilibili/tid.ts` 對照。
- `resource/deal` 的成功與否**只看 `code`**：`data.success_num` 成功時也回 0。
- `relation/followings`：**Referer 必須是 bilibili.com 子網域**，否則回空清單但 `code 0`——這就是 DNR 規則存在的理由。`tag: null`＝默认分组。
- `relation/whispers`：文檔沒列分頁參數，但關注管理器腳本一直帶著 `pn`／`ps=50` 翻頁，照做。
- `relation/batch/modify` **只接受 act 1（關注）與 5（拉黑）**，取關一律單筆 `relation/modify`；悄悄關注要用 act 4。
- `relation/tags/addUsers` 的 `tagids` 可以含 `-10`（特別關注）；`22104` 分組不存在、`22105` 未關注。
- `space/wbi/arc/search`（查活躍度）：**要 WBI 簽名**（不簽名回 `-403`），`order=pubdate&ps=1&pn=1` 取最新一支，時間欄位是 `created`。
  **只有 `page.count === 0` 才算「沒有影片」**；`count > 0` 卻回空清單、或連 `count` 都沒有，一律丟例外變成「未知」。
  **不要用 `series/recArchivesByKeywords`**：它是推薦稿件介面不是投稿列表，回幾筆與 `ps` 無關（`ps=1` 對每個帳號都回 code 0 加空 archives），
  2026-09 就是它把整份關注清單判成「從未投稿」（`design.md` 11／17）。改活躍度的判定方式要一起跳 `ActivityRecord.schema`，讓舊快取作廢。
- `biliFetch` 的 envelope `data` 是選填（關係操作類端點沒有 data）；`activityDetail` 同時認收藏夾（bvid／aid／media_id）與關注（mid／pn／fid）的參數。
- 錯誤碼：`-101` 未登入、`-111` csrf、`-352`／`-412`／HTTP 412／`-799` 風控（`net/backoff.ts` 統一退避 60 → 120 → 240 秒後放棄）、`-632` 數量限制、
  `22009` 關注上限、`22013` 帳號已註銷、`40061` 用戶不存在。

## AI 與 prompt

- 送給模型的收藏夾 id 是 `ai/prompt.ts` 的 `codeFolders()` 產生的 1..N **短號**，解析完用 `toRealIds()` 換回 `media_id`。**來源收藏夾固定是短號 1，目標從 2 開始**。
- prompt 的使用者訊息**第一塊一定是「目前所在收藏夾」**：**不要把來源夾拿掉**（`design.md` 4.1）。
- **來源夾的描述是一條判準**：系統提示裡「描述含糊或本身就是暫存夾時不算相符」那一條**不能拿掉**（`docs/research/keep-source-eval-2026-08.md`）。改 `ORGANIZE_TASK` 要重跑那份 L5。
- 加新的分類入口時**補 `classify()` 的參數**，不要再複製那五個步驟。
- AI 端點相容性都集中在 `ai/client.ts`（`design.md` 8.2）。AI 呼叫有 120 秒逾時。
- 每批 AI 往返由 `organizer.ts` 的 `onBatch` 回報給 UI，**只放記憶體、不要寫進任務快照**。

## 設定

- schema 在 `core/settings.ts`（zod 4：物件預設值用 `.prefault({})`，**每個欄位都要用 `fallback()`／`optional()` 掛 `.catch()`**——一個欄位填壞不可以波及同段其他欄位）。
  四段：`ai`、`rate`（兩種任務共用）、`features`、`follows`（`thresholdDays`、`includeWhispers`）。
  **`baseUrl` 是例外**：沒填過給預設端點，但**填壞了退回空字串、不是預設端點**——把想跑本機／區網模型的人默默接到
  `api.openai.com`，而他們填的金鑰還留著，下一次分類就真的送出去（`design.md` 9.3）。
  設定頁不合法時直接不存（`isAllowedBaseUrl()` 即時驗證＋`save()` 提前 return），不要再加「先存起來再說」的路徑。
- 固定值（詳情快取 30 天、封面 7 天、活躍度 30 天 `ACTIVITY_TTL_DAYS`、抖動 ±30%、撤銷每批 20 `RESTORE_BATCH_SIZE`）用同檔的常數，**不要再變成設定項**。
- 設定頁六章分三組，左軌一次只顯示一章：01 AI 端點、02 給 AI 看什麼、03 分類指示（整理收藏 · 需要 AI）；
  04 讀寫速度（三選一＋自己填數值）、05 快取與備份（兩組快取各自清、匯出匯入）、06 語言（兩個工具共用）。
- 關注的門檻在關注頁左軌或審核表的播放頭改＝改設定；「包含悄悄關注」只在關注頁的準備畫面，**不要在設定頁再放一份**——
  設定頁左軌最後一列只是一扇門，顯示目前門檻並切到關注頁。
- 三個資料來源就是三個布林，各一個開關（原生 checkbox 換張臉：**勾選＝挑東西、開關＝改設定**）。**不要再加回「智慧」那一階**（`design.md` 3.2）。
- 改動已存在的設定欄位時**在 `migrateLegacy` 補轉換**，別讓使用者的設定被預設值蓋掉。

## 收藏夾與描述

- 「收藏夾」分頁是描述的**唯一入口**：編輯、AI 生成、從 B 站匯入、同步回 B 站、新增收藏夾都在這裡。整理頁只做選擇與審核。
- 批次操作一律「先勾選、再一次做完」且串行；AI 生成與 B 站匯入都只產生**草稿**，按「採用」才寫入。
- 「把描述同步回 B 站」**必須跳過沒填描述的夾子**：`folder/edit` 帶空字串會把 B 站的簡介清掉且不可復原。
- 生成描述的取樣在 `core/describeFolder.ts`（`pickPages`／`spread`，總頁數用 `FAV_PAGE_YIELD` 估）；結果是**一句 20 字以內**的話。
- **不提供刪除收藏夾**：`folder/del` 會連內容一起消失且不可復原，`bilibili/fav.ts` 也沒有這支 wrapper。

## 寫入與錯誤

- 錯誤一律轉成 `shared/result.ts` 的 `AppError`，UI 依 `kind` 處理；風控類（`riskControl`）由 `net/backoff.ts` 統一退避。
- **`ReviewRow.keepSource`（審核表的「也留在原位」）＝那一列的目標全部用 `copy`、一次 `move` 都不發**。撤銷時它只移除複本。加新的寫入或撤銷路徑時**兩條分支都要走一遍**（`design.md` 6.1）。
- 搬移／移除／撤銷被取消或丟例外時，`core/moves.ts` 會在 `finally` 把還停在 `moving` 的列收尾。**加新的寫入流程時記得比照。**
- 取關之後勾選集合會把已經不是 `canSelect` 的列清掉；`retryFailed` 把 `failed` 退回 `pending`、`restoreFailed` 退回 `done`。

## 改動時要同步更新什麼

| 改了 | 也要改 |
| --- | --- |
| 流程或請求行為（整理） | `estimate.ts`＋`flow.ts`＋`promptPreview.ts`（三個都有測試） |
| 設定項（新增／改名／改語意） | `migrateLegacy`、`docs/how-it-works.md` 的設定表、README 的設定區塊 |
| 指令、環境變數、目錄結構、對外介面 | README（兩份）、本檔、`.env.example`、`CHANGELOG.md` |
| `design.md` 的節號 | `grep -rn "design\.md" src docs CLAUDE.md README.md` 找出所有引用 |
| 使用者看得到的行為 | `CHANGELOG.md` 的 `[Unreleased]`、`docs/how-it-works.md`，並重跑 `npm run ui-preview` 看截圖 |
| 做了取捨或否決了某個方案 | `design.md`（整理收藏寫進 9、關注寫進 17） |
| 視覺 token、元件語法、版面規則 | `DESIGN.md`；兩個前身若還要同步再一起改 |
| B 站 API 的新事實 | `design.md` 2／11 與本檔的「B 站 API」 |

## 測試

六層，由便宜到昂貴。改動只碰純函式就跑 L0–L1，碰 UI 加 L2，碰流程或 B 站 API 加 L3–L4，碰 prompt／資料來源／模型才需要 L5。

### L0 靜態

```bash
npm run typecheck && npm test && npm run lint   # tsc --noEmit + vitest + oxlint
npm run format                                  # prettier --write .（format:check 只檢查）
```

純函式模組（wbi、prompt、parser、describe、describeFolder、quickFav、throttle、serialQueue、backoff、moves、settings、video、subtitle、estimate、flow、
promptPreview、organizer、plan、classify、cache、activity、followFilter、exportRows、unfollow（mock 掉 `bilibili/relation`）、followEstimate、jobGuard、shared 的 chunk）
都有 `*.test.ts`，改行為要同步改測試。

### L1 建置

```bash
npm run build      # 產出 .output/chrome-mv3；後面幾層都吃這個產物
```

### L2 UI 截圖（不需登入，最常用）

```bash
npm run ui-preview      # 四個分頁全部走一遍 → .output/ui/*.png；UI_KEEP=1 顯示視窗且測完不關
npm run quickfav-preview   # 影片頁 toast：淺色／深色／挑選器 → .output/ui/
```

兩者都是攔截 B 站 API 與 AI 端點餵假資料、跑真的程式碼。腳本會印出實際送出的寫入參數（`move src=… tar=…`、`modify fid=… act=2`、
`batch/modify fids=… act=1`、`tags/addUsers …`）、鎖住的列數，以及「關注在跑時整理頁有沒有被擋住」。

### L3 煙霧測試（Playwright 載入真的擴充功能）

```bash
npm run smoke                        # 未登入 profile：只驗證設定頁（對本機 mock AI）
SMOKE_HEADED=1 SMOKE_KEEP=1 npm run smoke   # 顯示視窗且測完不關，可在視窗裡登入 B 站
```

兩支 Playwright 腳本（`smoke`／`ui-preview`）都跑**預設的英文語系**，選擇器**能用結構就不要用文字**：
章節走 `.chap` 上畫出來的編號、分頁走 `.tabs .tab` 的順序、資料來源開關走 `.srow input.switch` 的順序。
`smoke` 曾經先把語言設成繁中再用約 30 個中文字串當選擇器，版面重做把章節改名之後整支就死了半年（CI 不跑它）。

### L4 真實帳號手動驗收

自動化測不到「B 站真的接受了嗎」。改到寫入路徑、DOM、權限時照這張表走一次（載入 `.output/chrome-mv3`）：

- [ ] 未登入時頂列顯示「未登入」與提示；登入後「重新檢查」變成頭像＋名稱
- [ ] 設定頁填真的 Base URL／Key／Model →「測試連線」通過；權限請求視窗有跳出來
- [ ] 收藏夾分頁：AI 生成一個夾的描述、「採用」、重新整理後還在
- [ ] 整理分頁：來源選一個小夾、範圍「最近 20 支」、勾 2–3 個目標 →「開始分類」→ 審核表低信心那幾列**沒有**被預先勾選
- [ ] 「執行搬移」→ 到 B 站確認影片真的在目標夾裡 →「撤銷這次搬移」→ 確認回到來源夾、複本也不見了
- [ ] 關注分頁：準備畫面的關注數與 B 站個人空間顯示的一致；跑完後「這一輪」的帳號數＝關注數＋悄悄關注數
- [ ] 隨機開三個「安靜超過門檻」的帳號空間，最後一支影片日期與表格一致
- [ ] 挑 1–2 個自己願意取關的帳號 → 取關 → B 站關注清單真的少了 → 撤銷 → 回來了，分組也回來了
- [ ] 關注在跑的時候切到整理分頁：主按鈕變灰、寫著原因；跑完後恢復
- [ ] 影片頁：✨ 智慧收藏 → 卡片出現、原生收藏按鈕跟著亮 →「取消收藏」→ 原生按鈕熄掉；SPA 換片按鈕會自己重新掛上
- [ ] 任務跑到一半把分頁切到背景 5 分鐘再切回來 → 任務沒有停住（Web Lock 生效）

### L5 分類品質實測（改 prompt／資料來源／換模型時）

方法與判讀門檻（±5 個百分點內不算差異、同一份 prompt 重跑約 20% 的決策會變）見 `docs/research/classify-eval-2026-08.md`；
取 fixture 要在**已登入的分頁內**（`SESSDATA` 是 httpOnly），跑分類用 vitest 檔（`plugins: [WxtVitest()]`）餵 fixture 給
`buildUserText`／`chatCompletion`／`parseClassification`，不同設定各跑一次輸出決策表。
