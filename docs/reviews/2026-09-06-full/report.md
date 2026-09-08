# biliTidy 審查 · 2026-09-06

**模式**：full · **方法**：實跑（Playwright 驅動真的擴充功能產物；claude-in-chrome 走 B 站原生頁；`gh` + `git clone` 取標竿事實）
**範圍**：整個程序（四個 App 分頁 ＋ 影片頁 content script ＋ 工程面）
**版本**：`f82a44e`（審查途中從 `7b83637` 前進了一個 commit，見下方說明）· **階段**：對外產品／開源專案（MIT、公開 repo、CI badge、尚未上架商店）
**假設**：目標使用者是一般 B 站使用者，桌機 Chrome、B 站已登入、收藏夾幾百到幾千支、關注幾百到幾千個；核心任務是
T1 從 README 到能開始用、T2 把一個塞滿的收藏夾分類進正確的夾、T3 找出不再投稿的關注並批次取關、T4 影片頁一鍵智慧收藏。**使用者確認**
> **附件未入庫**：這份報告引用的 `shots/`（56 張截圖）與 `logs/`（走查腳本與輸出）留在跑審查的那台機器上，
> 沒有進版控——每審一次就多幾 MB，而結論靠文字說得清楚。報告裡的 `shots/…` 路徑是當時的證據位置，不是 repo 裡的檔案。

**標竿**：repo `wenyuanw/quick-prompt`、`zhu1090093659/deepseek-pp`、`the1812/Bilibili-Evolved`（**使用者確認**）；
同類產品 B 站原生收藏夾／關注管理頁（**實際操作**，使用者授權唯讀）、`[Bilibili] 关注管理器`（Greasy Fork，16,745 安裝）、
`madoka-chann/Bilibili-AI-Favorites-Organizer`（**新發現的直接同類**，見「同類產品對比」）

> **審查期間 repo 前進了一個 commit**：開審時是乾淨的 `7b83637`；跑到一半工作樹出現 14 個改動（活躍度端點從
> `series/recArchivesByKeywords` 換成 `space/wbi/arc/search`，修的是「整份關注清單被判成從未投稿」），
> 收尾時已經提交為 `f82a44e fix: read the latest upload from space/wbi/arc/search`。
> 我確認那份變更 typecheck／240 個測試／lint 全綠之後**改以它為準**重新 build 並重跑 T3；
> T1／T2／T4 的發現不受影響（`RunPage`、`jobStore`、`settings`、`quickFav` 都沒被動到）。
> 執行紀錄裡「審查前的 HEAD 是 235 / 31」指的就是 `7b83637`。

**證據**：`shots/` 56 張截圖 · `logs/` 走查腳本與逐步輸出（`lib.mjs` 是共用的攔截層，`t1`–`t5` 是各任務的步驟）
· `bench/` 三份標竿事實檔

## 一句話結論

**可用，而且核心承諾（審核優先、未確認進不了批次、風控感知、可撤銷）在實測下全部站得住** —— 但**任務失敗時畫面什麼都不說**：
分類跑到一半失敗會靜默退回起點，連錯誤訊息都存好了卻沒有任何地方畫它。

## 執行紀錄

| 項目 | 指令 | 結果 |
|---|---|---|
| 安裝 | `npm install` | 成功，179 套件，**0 vulnerabilities**，`postinstall` 自動跑 `wxt prepare` |
| 啟動／建置 | `npm run build` | 成功 4.2s → `.output/chrome-mv3`（925 kB）。README 沒漏步驟；**但 Vite 警告 app chunk 552 kB 超過 500 kB 門檻** |
| type check | `npm run typecheck` | 通過，1.8s（`strict` ＋ `noUncheckedIndexedAccess` ＋ `noImplicitOverride`） |
| lint | `npm run lint` | **0 error / 4 warning**（3 個 `no-console` 在 `background.ts`、1 個 `no-array-index-key`）。oxlint 對 warning 回 exit 0，CI 不擋 |
| format | `npm run format:check` | 全部符合 Prettier |
| test | `npm test` | **240 passed / 32 files / 3.5s**（審查前的 HEAD 是 235 / 31） |
| ui-preview | `npm run ui-preview` | 成功 43s，35 張截圖，**console errors: none**；印出的寫入參數方向正確 |
| quickfav-preview | `npm run quickfav-preview` | 成功 47s，原生收藏按鈕同步 1/1/0 正確、hover 暫停正確 |
| **smoke** | `npm run smoke` | **失敗，exit 1**（`scripts/smoke.mjs:73` TimeoutError）→ F02 |
| gen-icons | `npm run gen-icons` | 成功，產物與版控一致（`git status` 乾淨）。**但 README 說它是「純 Node」，實際用 Playwright Chromium** → F09 |
| 依賴健康 | `npm outdated` / `npm audit` / `depcheck` | 6 個小版本落後（zod 4.4.3→4.5.4、vitest 4→5 為 major）；**0 漏洞**；**0 個未使用依賴** |
| 結構 | `madge --circular` | **No circular dependency found**（129 檔） |
| secrets | grep `sk-` / `AKIA` / `ghp_` / PRIVATE KEY、`git log -- .env` | 全部乾淨；`git ls-files` 無建置產物 |

## 維度分數

產品面

| 維度 | 分 | 一句話 |
|---|---|---|
| A 上手與首次體驗 | 3 | README 一流、兩行指令就跑起來，但進到程式裡第一件事就踩空：沒填 key 也顯示「● Connected」，按下主按鈕燒了請求然後靜默退回 |
| B 核心任務流程 | 4 | 四個任務都走得完，步驟數比每一個替代方案都少或相當，撤銷在 API 層驗證正確；扣分在沒有暫停、上一頁會離開整個 App |
| C 介面與資訊架構 | 4 | 四個分頁共用同一套版面文法，時間軸／分面／作業列各司其職；扣分在批次做完後主畫面變成空表格 |
| D 狀態與回饋 | 2 | 進度儀表、退避倒數、灰按鈕旁一定寫原因都做得很好——但**失敗完全不說**，取消和取關完成也沒有回饋 |
| E 錯誤處理與防呆 | 2 | 風控退避與「未確認進不了批次」實測滴水不漏；但非法 Base URL 被靜默換成 OpenAI 的網址，錯誤訊息是平台原文 |
| F 文案 | 4 | 二次確認把副作用講得比多數商業產品清楚；扣分在「Connected」是假的、兩處露出原始例外字串 |
| G 無障礙與輸入方式 | 4 | 所有文字 token 對比度實算 ≥5.16:1、焦點是 2px 實心外框、顏色從不是唯一訊號；扣分在窄寬度的 15×15 勾選框 |
| H 效能與穩定性 | 4 | 五輪走查 console 全程零錯誤、375px 無橫向捲軸；扣分在 552 kB 單一 chunk |
| I 對標與產品面 | 4 | 關注那半邊 B 站原生根本做不到；差異化（風控安全、未知≠不活躍、可撤銷）在同類產品的自述裡就是痛點 |

工程面

| 維度 | 分 | 一句話 |
|---|---|---|
| J 文檔 | 4 | 以這個規模是標竿等級（文件索引表、17 節設計文檔附 API 實證、research/ 有真實數據）；扣分在三處可驗證的漂移 |
| K 專案結構與模組邊界 | 5 | 零循環依賴、零反向 import、最大非 i18n 檔 546 行、「單一來源」表由測試守住——**三個標竿沒有一個做到這個程度** |
| L 程式碼規範與工具鏈 | 4 | strict + oxlint + prettier + 240 測試 + CI 五道關卡，**比兩個 WXT 標竿都嚴格**；扣分在 warning 不擋、UI 測試層完全不在 CI |

## 做得好的地方

- **「未確認的東西進不了批次」是在結構上做到的，不是靠文案。** 實測「查不到」那一列：勾選框 `disabled=true` 帶
  `title="Status unconfirmed — cannot be selected"`，Playwright `force: true` 強制點擊也無效；切到該分面後「Tick all shown」
  本身變灰；作業列同時顯示 `Copy 0 UIDs` / `Download CSV (0)`。三道關卡（`canSelect()`／分面／`confirmedOnly()`）都擋住了同一件事。
  （`shots/t3b-02-unknown-row.png`）
- **風控退避是這份程式碼最成熟的部分，而且對照組證明它是真差異化。** 讀清單與寫入兩條路都實測過 `-352`：橫幅寫
  「Likely flagged for rate limiting (-352): 风控校验失败; retrying automatically in 60s」，作業列保留取消，寫入停在第 1 筆不繼續。
  對照：Greasy Fork 上 16,745 安裝的「关注管理器」自己的說明頁掛著「频繁使用可能会触发B站保护机制……**暂时没有解决方案**」；
  `Bilibili-Evolved`（30k★）的 `src/core/ajax.ts` grep 不到任何節流或退避。
- **撤銷在 API 層是對的，不只是畫面上復原。** 取關 27 個 → 27 筆 `modify act=2`；撤銷 → 2 批 `batch/modify act=1`（20+7，
  符合 `RESTORE_BATCH_SIZE`）＋ 4 次 `tags/addUsers` 按分組還原、**含 `-10` 特別關注**。整理那邊同樣正確：`keepSource` 那一列
  只發 `copy`，撤銷時只 `batch-del` 複本、`move` 回原夾。
- **二次確認的文案把副作用講清楚**，這在同類工具裡很罕見：
  「Follow 27 accounts again and put them back in their groups? **Quiet follows come back as normal follows; the follow date will be today.**」
  「Remove 1 stale video from "默认收藏夹"? **This can't be undone.**」
- **模組邊界比三個標竿都嚴。** `madge` 零循環；`bilibili`／`ai`／`net`／`shared` 沒有任何一個 import `core` 或 `ui`；
  「單一來源」表（`plan.ts`／`activity.ts`／`exportRows.ts`／`jobGuard.ts`…）每一條都有對應測試。
  三個標竿都只有文字約定（`AGENTS.md`／`CONTRIBUTING.md`），**沒有一個有工具或測試強制**。
- **靜態工具鏈勝過兩個 WXT 標竿。** `quick-prompt`（849★）與 `deepseek-pp`（1807★）**都沒有任何 lint/format 設定檔**
  （前者 `AGENTS.md` 明寫「No ESLint/Prettier in repo」）；`quick-prompt` 連 `.github/` 都沒有。biliTidy 有 oxlint + Prettier +
  strict tsc + 240 測試，且五道全在 CI。
- **對比度是算過的，不是宣稱的。** 實算全部文字 token × 四種底色：最低 `--bad` on `--raised` = 5.16:1，其餘都在 5.36–17.6:1，
  全數超過 AA 的 4.5:1。焦點是 `solid 2px rgb(255,92,141)` 實心外框，Tab 過的每個控制項都看得見。

## 核心任務走查

### T1 從 README 到能開始用（起點：剛 `npm run build`、載入未封裝項目、B 站已登入、什麼都沒設定過）

| 步 | 操作 | 看到什麼 | 摩擦 | 截圖 |
|---|---|---|---|---|
| 1 | 點工具列圖示 | 開 App 分頁，落在「整理」，左軌 39 個收藏夾、中間 38 個目標夾、右欄成本估算 | Q1 部分否：畫面沒有任何地方說「要先去設定 AI 端點」 | `t1-01-landing.png` |
| 2 | 直接按主按鈕 | 灰的，旁邊寫「No target folders selected yet — the AI only moves videos into folders you've ticked.」 | **Q4 否**：真正的阻礙是沒填 API Key，`.why` 講的是另一件事 | 同上 |
| 3 | 勾兩個目標夾 | 按鈕亮起（`disabled=false`） | **Q4 否**：仍然沒有 key，卻看起來準備好了 | `t2-01-nokey-ready.png` |
| 4 | 按下去 | 進度跑到「Reading video details 2 / 3」→ **回到準備畫面，畫面上沒有任何錯誤** | **Q4 否**（F01） | `t2-02-nokey-failed.png` |
| 5 | 自己摸到 Settings → 01 | 左軌寫「**● Connected** · gpt-4o-mini」（綠點），Base URL 已預填 OpenAI，API Key 空白但標著 `required` | **Q3 否**：從沒連過線也說 Connected（F04） | `t1-02-settings-fresh.png` |
| 6 | 填 Base URL / Key / Model → Test connection | 顯示端點原樣的回覆；401／500／斷線三種都有具體訊息 | 無 | `t1-04-test-401.png` 等 |
| 7 | Save | 作業列「Save settings」→ 存好；回整理頁按鈕可用 | 無 | `t1-05-organise-ready.png` |

步驟數 **7**（同類產品 `Bilibili-AI-Favorites-Organizer` **4**：裝腳本 → 進收藏頁 → 點懸浮鈕 → 填 provider 與 API Key）· 完成：**是**
· 壞路徑發現：**第 2–4 步是白走的**，而且第 4 步真的打了 4 個 B 站請求；填 `http://192.168.1.10:8080/v1`（自架端點）按存檔，
欄位被**靜默改成 `https://api.openai.com/v1`**、API Key 照樣留著，作業列只寫
`Invalid base URL: Only permissions specified in the manifest may be requested.`（F03，`t1-03-badurl-saved.png`）

### T2 把一個塞滿的收藏夾分類進正確的夾（起點：設定好、39 個夾、來源夾 2,234 支）

| 步 | 操作 | 看到什麼 | 摩擦 | 截圖 |
|---|---|---|---|---|
| 1 | Folders → Select all → Import from Bilibili description → Accept all | 「Imported 4 drafts…, 35 have no Bilibili description」＋草稿橫幅，採用前不寫入 | 無 | `t2-04-folders-drafts.png` |
| 2 | Organise → 左軌選來源夾 | 右欄即時算出：2,311 次 B 站讀取、75 次 AI、≈20 分鐘、8 個步驟（跳過的標 Skip） | 無 | `t2-02-nokey-failed.png` |
| 3 | 勾目標夾、選 Scope | 每列顯示該夾的描述或「(Not filled in — the AI can only see the name)」 | 無 | |
| 4 | Start classification（**連點兩下**） | 第二下點不到，AI 只被呼叫 **1** 次 | 無 ✓ | |
| 5 | 審核表 | 每列：AI 建議＋理由＋依據欄位、低信心黃標且**不預勾**、失效影片標 Stale、「Also keep in place」 | 無 | `t2-05-review.png` |
| 6 | Remove stale videos (1) | 作業列內二次確認「Remove 1 stale video from "默认收藏夹"? This can't be undone.」 | 無 ✓ | `t2-06-stale-confirm.png` |
| 7 | Write changes (move 1 / copy 1) | 直接寫入（可撤銷所以不二次確認）；實際送出 `copy src=1000 tar=1003` ＋ `move src=1000 tar=1004` | 無 | `t2-08-moved.png` |
| 8 | Undo these changes (2) | 二次確認 →「Move 1 video back…, and remove the 1 copied out?」→ `move` 回來 ＋ `batch-del` 複本 | 無 ✓ | `t2-09-undone.png` |

步驟數 **8**（B 站原生 **7**，但只能一次搬到一個夾、沒有任何建議、沒有撤銷；`Bilibili-AI-Favorites-Organizer` **6**）· 完成：**是**
· 壞路徑發現：跑完後**重整分頁審核結果還在** ✓；**跑到一半重整進度全丟**（`chrome.storage.local` 裡沒有 job key，
不過詳情有 30 天快取，重跑成本大部分拿得回來）；取消後直接回起點、**沒有任何「已取消」的回饋**；
**瀏覽器上一頁 → `about:blank`，整個離開 App**（F08）

### T3 找出不再投稿的關注並批次取關（起點：49 個關注、從沒跑過；使用者真實帳號是 2,220 個）

| 步 | 操作 | 看到什麼 | 摩擦 | 截圖 |
|---|---|---|---|---|
| 1 | Follows | 準備畫面：3 個編號步驟、關注數、≈52 requests / ≈1 min、「只查缺的／全部重查」、「包含悄悄關注」 | 無 | `t3-01-prepare.png` |
| 2 | Read the list and check | 「Checking latest uploads 9 / 49 · Est. 00:08 left」＋可取消 | 無 | `t3-02-running.png` |
| 3 | 切到整理頁 | 主按鈕變灰，寫「The follow clean-up is still running — wait for it to finish, or stop it on the Follows page.」 | 無 ✓ | `t3-03-blocked.png` |
| 4 | 審核表 | 門檻欄位＋180/365/730＋時間軸播放頭；狀態／關注類型／分組三組分面；每列畫出從最後投稿到今天的軌 | 無 | `t3-04-review.png` |
| 5 | Tick all 27 shown | 作業列「Unfollow 27 accounts · Copy 27 UIDs · Download CSV (27) · 27 ticked」 | 無 | `t3-06-selected.png` |
| 6 | Unfollow → 二次確認 | 「Unfollow 27 accounts? They leave your follow list one by one; you can follow them again from this page afterwards. **Yes, unfollow 27** / Cancel」→ 27 筆 `modify act=2` | 無 ✓ | `t3-07-confirm.png` |
| 7 | 完成 | **主畫面變成空表格**「None of the 49 accounts has been quiet for more than 365 days.」；成功摘要只出現在左軌分面「Unfollowed 27」 | **Q4 否**（F05） | `t3b-03-unfollowed.png` |
| 8 | Undo — follow 27 again | 二次確認 → 2 批 `batch/modify act=1` ＋ 4 次 `tags/addUsers`（含 `-10`）還原分組 | 無 ✓ | `t3b-05-undone.png` |

步驟數 **7**（**B 站原生做不到**：批次操作只有「复制至」分組，沒有批次取關，而且列表完全不顯示最後投稿日期）· 完成：**是**
· 壞路徑發現：查不到的列三道關卡都擋住 ✓；門檻填 500/1000/180/30 即時生效並存進設定 ✓，填 0/-5/9999 彈回上一個合法值但
**沒說為什麼**（F15）；375px 無橫向捲軸 ✓

### T4 影片頁一鍵智慧收藏（起點：任一影片頁）

| 步 | 操作 | 看到什麼 | 摩擦 | 截圖 |
|---|---|---|---|---|
| 1 | 影片頁載入 | ✨ Smart favourite 掛在工具列**最後** | 無 | |
| 2 | 點一下 | 右下角「Analysing…」卡 → 一個收藏夾一張卡，10 秒自動消失、hover 暫停；原生收藏按鈕跟著亮 | 無 | `.output/ui/quickfav-saved.png` |
| 3 | **壞路徑** | 401 →「responded 401: …; **the API key may be invalid**」＋Retry；斷線 →「Network error: Failed to fetch (…)」＋Retry；沒授權 →「Not authorised to access the AI endpoint — save the base URL in Settings and allow the permission」＋Retry | 無 ✓ | `t4-01-ai-401.png`、`t4-03-no-settings.png` |

步驟數 **1** · 完成：**是** · 壞路徑發現：**三種失敗全部有明確錯誤卡與重試**——這正好反證了 F01：
**同一種失敗在影片頁講得清清楚楚，在整理頁一個字都不說。**

## 標竿 repo 對比

| # | 項目 | 本專案 | quick-prompt (849★) | deepseek-pp (1807★) | Bilibili-Evolved (30k★) | 判定 | finding |
|---|---|---|---|---|---|---|---|
| 1 | README 結構 | 中英雙份，定位／截圖／安裝／上手／行為說明／權限表／開發／文檔索引；截圖來自真實渲染 | 中英雙份，功能／用法／截圖／安裝／授權；無疑難排解 | 中英雙份，含 50 版變更回顧內嵌；核心功能無截圖 | 單一中文，功能列表移到 `doc/` | 本專案更好（權限表三個標竿都沒有） | — |
| 2 | 文檔目錄 | `docs/` 五份＋`research/` 三份實測，`docs/README.md` 是路由表 | `docs/` 三份（一份教學＋兩份單一功能 spec） | `docs/` 九類含 ADR、契約登記表、release notes | `doc/` 七份＋工具生成的 features.md ＋第三方文檔站 | 本專案更好（規模最小卻最完整） | — |
| 3 | CHANGELOG 與版本 | Keep a Changelog 格式，只有 `[Unreleased]`；**無 tag、無 release** | 有 CHANGELOG，tag 0.0.1→2.0.4 每個都有 Release（人工） | 無根目錄 CHANGELOG，拆成 README 內回顧＋`docs/releases/` | 2781 行 CHANGELOG、202 Release、392 tag | 規模不需要（尚未發版；發第一版前補 tag 即可） | — |
| 4 | 貢獻流程 | 無 CONTRIBUTING／模板／CoC | 同左（只有 README 五步） | CONTRIBUTING＋PR/issue 模板＋兩個自動檢查 workflow | CONTRIBUTING 326 行＋模板＋CoC | 規模不需要（一人專案；真的要收 PR 時再補） | — |
| 5 | 目錄結構 | `src/` by-layer（entrypoints／bilibili／ai／net／core／shared／i18n／ui），最深 3 層 | by-layer＋entrypoints 內 by-feature，最深 3 層 | by-feature 為主，`core/` 下 35 個功能目錄 | by-feature，`registry/lib/components/<類>/<功能>/` | 本專案更好（無 `utils/` 雜物桶） | — |
| 6 | 模組邊界 | **文檔規則＋`madge` 零循環＋單一來源表有測試** | 只有 `AGENTS.md` 文字約定，無工具 | `AGENTS.md` 大量規則，**未見 lint 強制** | `AGENTS.md` 文字分工 | **本專案更好** | — |
| 7 | 靜態檢查 | tsc strict + noUncheckedIndexedAccess、oxlint、Prettier，**全在 CI** | **完全沒有 lint/format**，只有 tsc | **完全沒有 lint/format**，只有 tsc（但 CI 24 步） | ESLint + Prettier，CI 有跑 | 本專案更好；但 **warning 不擋** | F13 |
| 8 | 測試 | 32 檔 / 98 原始檔，240 測試 3.5s，純函式全覆蓋；**無 e2e 在 CI** | 37 / 110，無 e2e，**CI 不跑** | 218 / 427，含 prompt 契約凍結，CI 跑 | **零測試**（30k★） | 需要補（UI 層有腳本卻不在 CI） | F13 |
| 9 | CI/CD | 一個 workflow 五步（typecheck/lint/test/format/build），無 release 自動化 | **完全沒有 `.github/`** | 5 個 workflow，`ci:quality` 串 24 步，release 全自動、Chrome Web Store 上傳 | 三個 workflow，發版靠人工清單 | 規模不需要（未上架；要上架時抄 deepseek-pp 的 `zip:sources` 與 `wxt submit`） | — |
| 10 | 依賴管理 | lockfile 入庫、caret、**0 漏洞 0 未使用**；無 dependabot | lockfile 入庫、caret、無 dependabot | lockfile 入庫、關鍵套件精確鎖版、`npm audit` 在 CI | lockfile 入庫 | 規模不需要（6 個小版本落後，手動可控） | — |
| 11 | 設定與環境 | `.env.example` 有且**註明擴充功能不讀它**；金鑰只在 `chrome.storage.local` | `.env.example` 3 個變數 | **無 `.env.example`**，secrets 全在 GH Actions | 無 | 本專案更好 | — |
| 12 | commit 慣例 | Conventional Commits（3 條，其中 1 條 `Initial commit`）；**歷史只有 3 個 commit** | 三種風格混用，無 commitlint | Conventional 前綴＋簡中內文，無 commitlint | — | 規模不需要 | — |
| 13 | 授權與元資料 | LICENSE MIT；無 SECURITY.md；`package.json` 缺 `repository`/`author` | LICENSE MIT；無 SECURITY.md；元資料同樣不全 | Apache-2.0；無 SECURITY.md；元資料不全 | 有 CoC | 規模不需要（三個標竿都沒有 SECURITY.md） | — |
| 14 | 開發者體驗 | `scripts/` 五支，命名一致；**`ui-preview` 一鍵走完四個分頁截圖**（三個標竿都沒有等價物） | 無 scripts 目錄 | `scripts/` 22 支 `verify-*`／`smoke-*` | `dev-tools/` 四類 | **本專案更好** | — |

標竿檔案：`bench/quick-prompt.md`、`bench/deepseek-pp.md`、`bench/Bilibili-Evolved.md`

## 同類產品對比

| 任務 | 本專案步驟 | B 站原生 | 关注管理器 / AI-Favorites-Organizer | 偏離處 | 有意 / 沒想到 | finding |
|---|---|---|---|---|---|---|
| T1 上手 | 7 | — | 4（裝腳本→進頁→點懸浮鈕→填 key） | 多出「按了才發現沒 key」那三步 | **沒想到** | F01、F04 |
| T2 整理收藏 | 8 | 7（純手工勾選、一次一個目標夾、無撤銷） | 6（AI-Favorites-Organizer） | 相當；本專案多了「先寫描述」的前置，但那是命中率 94%→100% 的來源 | 有意 | — |
| T3 清理關注 | 7 | **做不到**（批次操作只有「复制至」分組，且列表不顯示最後投稿日期） | 关注管理器：可排序可批次取關，但**自述無法解決風控** | 本專案是唯一有節流／退避／停下保留進度的 | 有意（核心差異化） | — |
| T4 影片頁 | 1 | 1（原生收藏，但要自己選夾） | Bilibili-Evolved 的 `quick-favorite`（單支快速收藏，無 AI 選夾） | 本專案多了 AI 選夾 | 有意 | — |

慣例差異：

- **長任務可暫停／繼續**：`Bilibili收藏夹自动分类`（Greasy Fork）的讀取階段「可暂停/继续」並支援「继续分析剩余」。
  本專案 2,220 個關注在預設 2 req/s 下要跑 **≈18 分鐘**，只有「取消」（取消＝進度全丟）→ F11
- **Token 用量與費用估算**：`Bilibili-AI-Favorites-Organizer` 有 Token 統計與 15+ 模型的動態費用估算。
  本專案估「幾次 AI 呼叫、幾分鐘」但不估錢，而錢是使用者自己付的 → F18（之後考慮）
- **分類結果匯出**：同一支腳本支援 HTML / JSON / CSV 匯出分類結果；本專案的匯出只有關注那半邊有 → F19（之後考慮）
- **用「動態時間」判斷活躍度**：`BiliBili 关注管理`（YisRime）可按粉絲數／投稿時間／**動態時間**排序。
  本專案刻意只看投稿（`PRODUCT.md` 明列不做）——**有意取捨**，但從那支腳本過來的使用者會找不到這個選項，值得在 Follows 頁一句話說明
- **匯入 UID 清單批量取關**：`关注管理器` 0.2.8 起支援；本專案只匯出不匯入——**有意取捨**（整個產品的前提是「在這裡看過再動手」）

反過來看，本專案沒有任何不服務核心任務的多餘功能：設定六章每一章開頭都寫了「Used by ... / not used by ...」，
沒有一個設定項是找不到用途的。

## 問題清單

### F01 · S3 · D · 任務失敗時畫面完全不說，靜默退回起點

- **在哪**：`src/ui/pages/RunPage.tsx:172`（`job.error` 的橫幅只寫在 `reviewing` 分支裡）＋
  `src/ui/pages/RunPage.tsx:119`（`reviewing` 只認 `review`／`moving`／`done`）＋`src/ui/jobStore.ts:222`、`:136`（失敗時 `phase: 'error'`）。
  `phase === 'error'` 永遠不滿足 `reviewing`，所以那個橫幅**畫不出來**。實測：`shots/t2-02-nokey-failed.png`、`t2b-01-ai401.png`
- **影響**：任何在「產生審核列之前」失敗的路徑——沒填 API Key、端點 401/500、AI 回傳無法解析、讀清單階段的致命錯誤——
  使用者按下「Start classification」，看到進度跑到「Reading video details 2 / 3」，然後**畫面回到準備畫面，沒有橫幅、沒有 toast、
  沒有任何字**。錯誤訊息已經存在 `job.error` 裡，只是沒有地方畫它。使用者會再按一次，每按一次都是一輪 B 站請求
  （對一個 2,234 支的夾就是 2,311 次讀取的開頭），把自己往風控推。
  **同一種失敗在影片頁是有明確錯誤卡＋Retry 的**（`t4-01-ai-401.png`），兩邊行為不一致。
- **改法**：在 `RunPage` 的「準備」分支（`:311` 之後、`<main className="center">` 的 `c-head` 下方）加上與 `:172` 同一塊
  `{job.error && <div className="banner error">…</div>}`；並在旁邊給一顆「Open Settings」的動作。
  同時把 `reviewing` 改成 `(job.phase === 'review' || 'moving' || 'done' || job.phase === 'error') && job.rows.length > 0`，
  讓「已經抓到列才失敗」的情況留在審核表上而不是丟掉。`FollowsPage.tsx:177` 已經是對的寫法，照抄它。
- **工作量**：S

### F02 · S3 · J/L · `npm run smoke` 是壞的，而且 CI 不跑它，所以沒人發現

- **在哪**：`scripts/smoke.mjs:73`。實跑 `npm run smoke` → exit 1，`TimeoutError: locator('.snav-item').filter({ hasText: '連線' })`。
  腳本 `:52` 先把語言設成 `zh-Hant`，然後用約 30 個舊的中文字串當選擇器：`'連線'`、`'要給 AI 看什麼'`、`'速度與資料'`、
  `'儲存設定'`、`'開始分類'`、`'審核與執行'`、`'執行搬移'`、`.folder-card`……在 `7b83637`（版面重做）之後這些名字全變了
  ——現在是 `AI 端點`（`src/i18n/zh-Hant.ts:452`）、`給 AI 看什麼`（`:456`），而且「速度與資料」已拆成 04／05 兩章。
- **影響**：README（兩份）、`CLAUDE.md` 的測試階梯 L3 都把 `npm run smoke` 列為「載入真的擴充功能走設定頁」的驗證層。
  任何照文檔做的人（包含未來的你）第一次跑就撞一個看起來像產品壞掉的 uncaught exception。這一層驗的是
  `ui-preview` 驗不到的東西（DNR session rule、`chrome.storage` 持久化、optional permission 流程），現在**整層是死的**。
- **改法**：把 `smoke.mjs` 的中文字串選擇器換成語言無關的：`:52` 改成設 `'en'`（或乾脆不設，用預設），
  段落切換改用 `.snav-item` 的序號（`nth(0..5)`）或給每個 `.snav-item` 一個 `data-section={id}` 再用 `[data-section="endpoint"]`
  選；`.folder-card` 改成現在的 `.src-row`。修完把它加進 CI（見 F13）。
- **工作量**：S

### F03 · S3 · E/F · 非法 Base URL 被靜默改成 `https://api.openai.com/v1`，而 API Key 照樣留著

- **在哪**：`src/core/settings.ts:45`（`fallback(z.string().refine(isAllowedBaseUrl)…, DEFAULT_BASE_URL)`）＋
  `src/ui/pages/settings/SettingsPage.tsx:132-141`（`save()` 拿到權限錯誤後**照樣 `await updateSettings(() => draft)`**）。
  實測 `shots/t1-03-badurl-saved.png`：輸入 `http://192.168.1.10:8080/v1` → 按存檔 → 欄位變成 `https://api.openai.com/v1`、
  storage 也是，`apiKey` 仍是 `sk-my-secret-key`，左軌顯示「● Connected · my-model」，作業列寫
  `Invalid base URL: Only permissions specified in the manifest may be requested.`；輸入 `abc` 則是
  `Invalid base URL: Network error: Failed to construct 'URL': Invalid URL`。
- **影響**：兩件事同時發生。(1) **文案**：兩句都是把 Chrome 的內部錯誤與 DOMException 原文丟給使用者，沒有一個字說明
  真正的規則（只允許 `https://`，或本機模型的 `http://localhost`／`http://127.0.0.1`）——使用者不知道要怎麼修。
  (2) **行為**：跑本機／區網模型（ollama、LM Studio 換個 IP）是這個工具的主要使用情境之一，這些人會發現自己的端點被
  換成 OpenAI 的網址，而且**他們填的 API Key 現在配著 api.openai.com**；只要之後按下「開始分類」，那把金鑰就會真的送出去。
- **改法**：把 `isAllowedBaseUrl` 從 `core/settings.ts` export 出來，在 `SettingsPage` 的 Base URL `SettingRow` 上做即時驗證：
  不合法時欄位標紅、主按鈕變灰、`.why` 寫「Only https:// endpoints, or http://localhost / http://127.0.0.1 for a local model」；
  `save()` 在 `ensureEndpointPermission` 失敗時**直接 return，不要往下 `updateSettings`**。
  絕不把不合法的值換成另一個端點——寧可拒絕存檔。
- **工作量**：S

### F04 · S3 · A/F · API Key 標著 `required` 但沒有任何地方檢查它；沒填也顯示「● Connected」

- **在哪**：`src/core/plan.ts:38`（`aiReady = baseUrl.trim() !== '' && model.trim() !== ''`，**不含 `apiKey`**）＋
  `src/ui/pages/settings/SettingsPage.tsx:205-208`（`plan.aiReady` 就畫綠點與 `nav.connected`）。
  `apiKey` 全專案只在 `src/ai/client.ts:176` 被用來組 `Authorization` header。
  實測 `shots/t1-02-settings-fresh.png`：全新安裝、從沒碰過設定 → 左軌已經是「● Connected · gpt-4o-mini」。
- **影響**：新使用者看到綠點與「Connected」，合理推論「已經好了」。實際上 `Base URL` 與 `Model` 只是 schema 預設值，
  從來沒有連過線。接著發生的就是 F01 那條靜默失敗。另外「Connected」這個詞本身是錯的——它描述的是「兩個欄位非空」，
  不是「連得上」。
- **改法**：兩層。(1) 把 `nav.connected` 改成描述事實的字，例如 `Endpoint set`；真正「連過線」要靠 `Test connection` 成功後
  存一個時間戳（可以比照現有的 `visionVerifiedAt`），有它才顯示 `Connected`。
  (2) `planOf()` 的 `aiReady` 不動（它的語意是「叫得動」），但在整理頁與收藏夾頁的 `.why` 判斷裡加一條：
  `apiKey` 為空且 baseUrl 不是 localhost/127.0.0.1 時，主按鈕變灰並寫「Fill in the API key in Settings first」。
  本機模型通常不需要 key，所以要放行 localhost。
- **工作量**：S

### F05 · S2 · D · 批次做完之後主畫面變成空表格，成功摘要只在左軌角落

- **在哪**：`shots/t3b-03-unfollowed.png`。取關 27 個帳號完成後：中央區顯示「None of the 49 accounts has been quiet for
  more than 365 days. Lower the threshold or pick another status on the left.」，分面停在「Quiet past the threshold **0**」，
  作業列的 `.why` 退回「Tick accounts in the table first.」。剛完成的事只出現在左軌分面「Unfollowed 27」與「This run」面板。
- **影響**：使用者剛做完這個工具最不可逆的動作，畫面卻讀起來像「這裡沒有東西可做」。要確認到底做了什麼，得自己注意到
  左軌多了一個分面並點進去。整理頁的搬移完成也是同樣的形狀（`t2-08-moved.png` 靠作業列文字承載）。
- **改法**：批次完成時把分面自動切到剛產生的那一個（`Unfollowed` / 已搬移），並在中央區頂端放一條 `banner ok`：
  「Unfollowed 27 accounts. Undo is available until you clear the results.」——`FollowsPage.tsx:177` 那塊橫幅已經有
  `stopped`／`error` 兩種樣式，加一種 `done` 即可。
- **工作量**：S

### F06 · S2 · C · Folders 分頁沒勾選時，作業列一顆按鈕都沒有

- **在哪**：`src/ui/pages/FoldersPage.tsx:473-525`——`chosen.length === 0` 時 `<footer className="runbar">` 裡只有一個
  `<span className="why">`。實測 `shots/t1-02-folders-fresh.png`：整條作業列只有一句
  「Select folders to see what you can do with them: generate descriptions with AI, import from Bilibili descriptions, or sync descriptions back to Bilibili.」
- **影響**：違反本專案自己的規則（`CLAUDE.md`：「每個分頁的底部作業列永遠是同一件事：你正要執行的批次，以及執行它的按鈕；
  按鈕變灰時旁邊一定寫得出原因」）。其他三頁都是「灰按鈕＋原因」，只有這頁的按鈕整組消失，使用者得先從一句話裡推出
  「原來要先勾選」。第一次進 Folders 的人正好處在這個狀態。
- **改法**：`chosen.length === 0` 時渲染跟有選時同一組按鈕，全部 `disabled`，`.why` 保留現在那句（可以縮短成
  「Select folders first — then you can generate, import or sync their descriptions.」）。
- **工作量**：S

### F07 · S2 · F/J · README 與設定說明宣稱「Base URL 留空會讓主按鈕變灰並說明原因」，實際上不會

- **在哪**：`README.md`「Settings → 01 AI endpoint」段與 `src/i18n/en.ts:514`（`Any OpenAI-compatible endpoint works.
  **Left empty**, the Organise page's "Start classification" greys out and says why`）。
  實測（`logs/t5.mjs`，四種組合，輸出見 `logs/t5.log`）：Base URL 留空 → 按鈕 **enabled**，`.why` 完全沒提 AI；**Model** 留空才會變灰並寫
  「Fill in the AI endpoint and model in Settings first.」。原因是 `core/settings.ts:45` 的 `.catch()` 把空字串換成
  `DEFAULT_BASE_URL`，所以「baseUrl 為空」這個狀態在程式眼裡不存在。
- **影響**：文檔描述了一條走不到的路。照著說明清空 Base URL 想確認行為的人，會看到跟說明相反的結果。
- **改法**：把兩處文案改成講 Model（「Leave the model empty and the Organise page's "Start classification" greys out and says why」），
  或修 F03 之後讓 Base URL 也真的能是空的並納入 `aiReady`。兩者擇一，但要一致。
- **工作量**：S

### F08 · S2 · B · 瀏覽器上一頁會離開整個 App，四個分頁沒有 URL 狀態

- **在哪**：`src/ui/App.tsx:49-82`，分頁切換是純 React state，不碰 `history`。實測：在審核畫面按上一頁 → `about:blank`。
- **影響**：滑鼠側鍵、`Alt+←`、觸控板兩指滑動都會觸發。使用者在一個跑了 20 分鐘的任務畫面上誤按，整個工具就不見了
  （審核結果有快照救得回來，但要自己重新點工具列圖示）。也沒辦法把「關注審核表」這個畫面加書籤或分享給自己。
- **改法**：用 `history.pushState` 把分頁寫進 hash（`#/organise`、`#/folders`、`#/follows`、`#/settings`），
  監聽 `popstate` 還原分頁。不需要 router 套件，`App.tsx` 裡十幾行就夠。
- **工作量**：S

### F09 · S2 · J · 兩份 README 說 `gen-icons` 是「純 Node」，實際上要 Playwright 的 Chromium

- **在哪**：`README.md:157`（`Regenerates public/icon/*.png (pure Node)`）、`README.zh-Hant.md:110`（「純 Node」）
  vs `scripts/gen-icons.mjs:3`（`import { chromium } from 'playwright'`，第 2 行註解自己寫著「用 Playwright 內建的 Chromium 轉檔」）。
  `CLAUDE.md:20` 是對的。
- **影響**：沒跑過 `npx playwright install chromium` 的人（README 只在 `ui-preview` 那一列提到要裝）照著這句話跑 `gen-icons`
  會拿到 browser executable 不存在的錯誤，而說明說它不需要瀏覽器。
- **改法**：兩份 README 都改成「Regenerates `public/icon/*.png` from `icon.svg` (uses Playwright's Chromium)」／
  「由 `icon.svg` 重新產生（用 Playwright 內建 Chromium）」，並把「首次要 `npx playwright install chromium`」從
  `ui-preview` 那列提到表格下方一句共用備註。
- **工作量**：S

### F10 · S2 · J · `PRODUCT.md` 指到錯的 design.md 節號，而 `CLAUDE.md` 的同步 grep 剛好漏掉 `PRODUCT.md`

- **在哪**：`PRODUCT.md:48`「收藏夾端點見 `docs/design.md` 2，**關注端點見 `docs/design.md` 3**」——
  但 `docs/design.md` 第 3 節是「要給 AI 看什麼」，關注端點在**第 11 節**（`CLAUDE.md:112` 寫的是對的）。
  根因在 `CLAUDE.md:173`：「改了 `design.md` 的節號 → `grep -rn "design\.md" src docs CLAUDE.md README.md`」——
  這條指令**沒有包含 `PRODUCT.md` 與 `DESIGN.md`**，所以合併時的節號重排漏掉了這一處。
- **影響**：照著 `PRODUCT.md` 找關注端點查證的人（含未來的 AI 代理）會翻到 AI 資料來源那一節。同一個漏洞下次還會再發生。
- **改法**：`PRODUCT.md:48` 改成「11」；`CLAUDE.md:173` 的指令補上 `PRODUCT.md DESIGN.md`（或直接改成 `grep -rn "design\.md" . --exclude-dir={node_modules,.output,.wxt,.git}`）。
- **工作量**：S

### F11 · S2 · B/I · 長任務只能取消不能暫停，取消等於進度全丟

- **在哪**：`src/ui/jobStore.ts:222` 與 `followJobStore.ts:254`——`aborted` 一律回 `phase: 'idle'`。
  實測（`logs/t2c.log`）：在「Reading video details 0 / 3」按 Cancel → 直接回準備畫面，抓到的東西沒有留在任何地方，
  **也沒有任何「已取消」的字**。同樣的操作在跑到一半重整分頁也是（`chrome.storage.local` 裡沒有 job key）。
- **影響**：使用者真實帳號是 2,220 個關注，預設 2 req/s 就是 **≈18 分鐘**；整理一個 2,234 支的夾是 **≈20 分鐘**。
  這段期間任何原因要中斷（要出門、要用網路做別的事、想先調個設定），代價都是從頭再來一次的請求量。
  同類產品 `Bilibili收藏夹自动分类` 的讀取階段就有「可暂停/继续」與「继续分析剩余」。
  註：影片詳情有 30 天快取、關注活躍度有 30 天快取，所以**重跑的實際成本沒有名目上那麼高**——這也是這條只給 S2 的原因。
- **改法**：分兩步。短期（S）：取消後在準備畫面留一條 `banner`「Cancelled at 37 / 49. Cached results are kept — run again to continue.」，
  把「其實不會白跑」講出來。中期（M）：`checkActivity`／`fetchDetails` 的迴圈支援 pause（用一個 `Promise` 閘門），
  作業列的 Cancel 旁加 Pause／Resume。
- **工作量**：S（第一步）／M（第二步）

### F12 · S2 · G · 窄視窗下勾選框 15×15、頂列按鈕 13×13，遠低於可點門檻

- **在哪**：實測 375px 寬（`shots/t1-06-mobile-375.png`、`logs/t1b.log`）：`input "Add as target: Windows" 15x15`（38 個目標夾列全部如此）、
  `button "Recheck" 13x13 @352,17`、`button "Edit descriptions on the Folders page" 160x15`。
  桌面寬度下這些是正常的；問題只在窄寬度。
- **影響**：Chrome 擴充功能不會跑在手機上，所以這不是「行動裝置」問題——但把分頁縮成半個螢幕（並排看 B 站與 biliTidy
  是這個工具很自然的用法）就會進到這個斷點。13×13 的 Recheck 幾乎點不到，15×15 的勾選框在觸控筆電上也很難中。
  `PRODUCT.md` 的無障礙段落只提了鍵盤與對比度，沒提觸控目標。
- **改法**：在 `styles.css` 的 `@media (max-width: 900px)` 區塊裡給 `input[type=checkbox]` 與 `.grid td:first-child` 加
  `min-width/min-height: 24px`（WCAG 2.2 AA 的 target size 下限），頂列在窄寬度改成只留頭像＋一顆 ≥24px 的重新檢查鈕。
- **工作量**：S

### F13 · S2 · L · lint warning 不擋 CI，而且三支 UI 驗證腳本一支都不在 CI

- **在哪**：`.github/workflows/ci.yml` 跑 `typecheck / lint / test / format:check / build` 五步。
  `npm run lint` 目前有 4 個 warning，oxlint 對 warning 回 exit 0，所以 CI 綠燈。
  `ui-preview`／`quickfav-preview`／`smoke` 三支都不在 CI——這正是 F02（smoke 壞了半個 commit 沒人知道）的原因。
- **影響**：`CLAUDE.md` 的測試階梯把 L2（UI 截圖）與 L3（煙霧測試）列為改動 UI 與流程時的必跑層，但沒有任何自動化在守。
  警告會累積成背景噪音（現在 4 個，其中 3 個是 `background.ts` 的 `console`，那是**刻意的**，該用 inline disable 註明而不是放著）。
- **改法**：(1) `lint` 腳本改成 `oxlint --deny-warnings`，把 `background.ts` 那三處 `console` 改成
  `// oslint-disable-next-line no-console -- SW 的生命週期日誌，只在 chrome://extensions 的 SW console 看得到`（或本專案慣用的抑制寫法），
  `RequestTable.tsx:28` 換成穩定 key。(2) CI 加一個 job：`npx playwright install --with-deps chromium` → `npm run build` →
  `npm run ui-preview` → `npm run quickfav-preview` → `npm run smoke`（修好之後），三支腳本本來就會在偵測到 console error 或
  斷言失敗時退出，直接當測試用。
- **工作量**：M

### F14 · S1 · D · 取消任務後沒有任何回饋

- **在哪**：`logs/t2c.log` 實測——按下「Cancel this run」後畫面直接回到準備畫面，橫幅只剩原本就在的兩個提示。
- **影響**：使用者按了取消，畫面確實變了，但沒有一句話確認「已取消、抓到的東西怎麼了」。
- **改法**：併進 F11 的第一步一起做。
- **工作量**：S

### F15 · S1 · E · 門檻欄位填非法值時彈回舊值，不說為什麼

- **在哪**：`src/ui/pages/follows/FollowReviewRail.tsx:110` 的 `#threshold`（`<input type="number" min=1 max=3650 step=1>`）。
  實測：填 `500`／`1000`／`180`／`30` 都即時生效並寫進設定 ✓；填 `0`／`-5`／`9999`／空字串一律**彈回上一個合法值，
  畫面上沒有任何說明**。
- **影響**：行為是安全的（不會存進壞值），但使用者看到自己打的數字被吃掉會困惑，尤其 `9999` 這種「我想抓五年以上」的合理意圖。
- **改法**：欄位下方加一行常駐說明「1–3650 days」，或在彈回時把該行 `.why` 換成「Threshold must be between 1 and 3,650 days.」兩秒。
- **工作量**：S

### F16 · S1 · G · 從作業列往後 Tab 會落在 `<body>`，焦點看不見

- **在哪**：`logs/t2.log` 的 Tab 序列——`Remove stale videos` → `Change settings & rerun` → `Clear results` →
  **`body`（`focus=none`）** → `Organise` → `Folders` …。另外頂列目前所在的那個分頁按鈕不在 Tab 順序裡
  （Tab 1 直接落在「Folders」而不是「Organise」）。
- **影響**：只用鍵盤的人在作業列末尾多按一次 Tab，焦點消失一拍才回到頂列。當前分頁按鈕不可聚焦則讓螢幕閱讀器使用者
  少一個確認「我在哪一頁」的機會（如果 `aria-current` 有設就影響不大）。
- **改法**：確認 `.app` 或 `.app-body` 沒有多餘的 `tabindex="0"`／`tabindex="-1"` 造成的落點；當前分頁按鈕改成
  `aria-current="page"` 而不是 `disabled`，讓它留在 Tab 順序裡。
- **工作量**：S
- **2026-09-08 覆查：一半修掉、另一半是誤判。** 分頁按鈕已加上 `aria-current="page"`（F08 那一批）。
  `<body>` 那一站則不是缺陷：`scripts/ui-preview.mjs` 現在會在審核畫面從第一個分頁按鈕開始按 Tab 走完一整圈
  （回到起點才停），量到 **42 站、其中恰好 1 站在 body**，位置在作業列最後一顆「Clear results」與頂列
  「Organise」之間——那是「文件最後一個可聚焦元素之後」的瀏覽器預設落點，任何網頁都有。
  另外「當前分頁按鈕不在 Tab 順序裡」也不成立：它是普通 `<button>`、沒有 `disabled`，
  報告量到的「Tab 1 落在 Folders」只是因為焦點本來就停在 Organise 上。
  全 repo 沒有任何 `tabIndex`，焦點樣式（`styles.css` 的全域 `:focus-visible`）也是完整的。
  那段走查留著當回歸守門：中間多出任何一站 body 就會讓 `ui-preview` 失敗。

### F17 · S1 · H · app chunk 552 kB，超過 Vite 警告線且沒有分割

- **在哪**：`npm run build` 輸出——`chunks/app-*.js 552.41 kB`，Vite 印出 `Some chunks are larger than 500 kB after minification`。
  總產物 925 kB。
- **影響**：載入未封裝的擴充功能是本機讀檔，開啟 App 分頁的實際延遲感受不到（走查全程沒有感覺到白畫面）。
  真正的成本在上架審查時的包大小，以及未來加功能時這個數字只會單向成長。
- **改法**：四個分頁其實天然可分割——把 `pages/FollowsPage`、`pages/FoldersPage`、`pages/settings/SettingsPage`
  改成 `React.lazy()` + `<Suspense>`，只有「整理」預先載入。或者確認警告可接受，就在 `wxt.config.ts` 設
  `vite: { build: { chunkSizeWarningLimit: 700 } }` 並註明理由，讓警告不再是背景噪音。
- **工作量**：S

### F18 · S0 · I · 沒有 token 用量與費用估算

- **在哪**：`core/estimate.ts` 算的是「B 站讀取幾次、封面幾張、AI 呼叫幾次、大約幾分鐘」，沒有 token 或金額。
- **影響**：使用者自己付 API 費用。整理 2,234 支影片是 75 次 AI 呼叫，帶字幕會多 54% token（`docs/research` 自己量過）——
  但畫面上沒有任何金額或 token 的量級。同類產品 `Bilibili-AI-Favorites-Organizer` 有 Token 統計與 15+ 模型的費用估算。
- **改法**：`promptPreview.ts` 已經組得出真實 prompt，可以用它估 prompt token（字元數 ÷ 經驗係數就夠），在成本卡多一行
  「≈ N,000 prompt tokens」。要不要做金額換算是產品決定——維護一張模型價目表是長期負擔，估 token 就停在那裡也合理。
- **工作量**：S

### F19 · S0 · I · 整理的分類結果不能匯出

- **在哪**：關注那半邊有「Copy N UIDs」與「Download CSV」；整理的審核表沒有等價功能。
- **影響**：想在別處保存「這次 AI 把哪支影片分到哪個夾、理由是什麼」的人做不到。
  `Bilibili-AI-Favorites-Organizer` 支援 HTML / JSON / CSV 匯出分類結果。
- **改法**：審核表作業列右段加一顆「Download CSV」，欄位用現有的 `ReviewRow`（bvid、標題、來源、目標、理由、依據、信心、
  keepSource）。`core/exportRows.ts` 的 CSV 產生器可以直接沿用。
- **工作量**：S

## 優化路線圖

### 立刻做
<S3 以上且工作量 S>
- **F01** 任務失敗時畫面完全不說（在準備分支補上 `job.error` 橫幅）
- **F02** `npm run smoke` 是壞的（換掉中文字串選擇器）
- **F03** 非法 Base URL 被靜默換成 OpenAI 的網址（即時驗證 ＋ 失敗時不要往下存）
- **F04** API Key 沒填也顯示「Connected」（改文案 ＋ 主按鈕加一條 `.why`）

### 下一步
<S3 以上且工作量 M / L；或 S2 且工作量 S>
- **F13** lint warning 不擋 CI、三支 UI 腳本不在 CI（工作量 M，但它是 F02 這類問題的根因）
- **F05** 批次做完後主畫面變空表格，沒有成功摘要
- **F06** Folders 空狀態的作業列沒有按鈕（違反自家規則）
- **F07** README／設定說明宣稱的「Base URL 留空會變灰」走不到
- **F08** 瀏覽器上一頁會離開整個 App
- **F09** 兩份 README 的 `gen-icons`「純 Node」是錯的
- **F10** `PRODUCT.md` 的 design.md 節號錯了，且同步 grep 漏掉這個檔
- **F11**（第一步）取消後告訴使用者「快取還在，重跑不會白跑」
- **F12** 窄視窗下的 15×15 勾選框與 13×13 按鈕

### 之後考慮
- **F11**（第二步）長任務的暫停／繼續
- **F14** 取消後的回饋（併進 F11 第一步）
- **F15** 門檻欄位的合法範圍說明
- **F16** Tab 落在 `<body>`、當前分頁不可聚焦
- **F17** 552 kB 單一 chunk（`React.lazy` 或明確放寬警告線）
- **F18** token 用量估算
- **F19** 整理結果匯出 CSV
- **對標建議**：發第一版之前，把 `deepseek-pp` 的 `zip:sources`（Chrome Web Store 稽核要的原始碼包）與
  `wxt submit` 流程抄過來；打第一個 tag 時把 CHANGELOG 的 `[Unreleased]` 收成 `0.1.0`
- **對標建議**：Follows 頁的說明加一句「活躍度只看投稿，不看動態」——從 `BiliBili 关注管理` 那類腳本過來的人會找這個選項

## 未審查的部分

- **真實帳號的寫入驗收（`CLAUDE.md` 的 L4）**：使用者授權的是唯讀操作，所以沒有在真實帳號上跑過搬移／取關／撤銷。
  所有寫入都是攔截後記錄參數來驗證方向正確，**「B 站真的接受了嗎」沒有驗過**。
- **`npm run dev`（HMR）、`npm run zip`、`npm run mock-ai`**：沒跑。README 有列。
- **「測試視覺」（Test vision）流程**：需要一個看得懂圖的模型與權限互動，headless 下沒走。
- **備份匯出／匯入、收藏夾「同步描述回 B 站」、「新增收藏夾」的實際寫入路徑**：沒走到（前兩者是 `folder/edit`／`folder/add`，
  是這個工具少數會改動 B 站設定的路徑，值得補一次 L4）。
- **L5 分類品質**：改 prompt 才需要，本次沒改。
- **Firefox / Edge**：`wxt.config.ts` 只設定了 chrome-mv3，README 說 Edge 114+ 但沒有 Edge 的建置目標，未驗證。
- **未提交的活躍度端點修正**：我驗了它 typecheck／測試／lint 全綠並以它為準跑 T3，但**沒有對真實 B 站帳號驗證
  `space/wbi/arc/search` 的回應形狀**——那正是上一版踩坑的地方，建議在真實帳號上抽三個帳號比對空間頁顯示的最後投稿日期。
