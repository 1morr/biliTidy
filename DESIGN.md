---
name: biliTidy
description: 深色審核工作台——四個平行分頁、證據攤開的表格、底部永遠寫著數字的作業列。
colors:
  ground: "#0c0e11"
  rail: "#111419"
  panel: "#151920"
  raised: "#1b2028"
  input-bg: "#0f1216"
  line: "#242a33"
  line-2: "#323a45"
  row-hover: "#171c23"
  row-selected: "#1f1519"
  row-selected-hover: "#24181d"
  row-done: "#101a16"
  row-failed: "#1a1414"
  row-quiet: "#14181f"
  tx: "#e9edf2"
  tx2: "#a3adba"
  tx3: "#7d8896"
  ac: "#ff5c8d"
  ac-2: "#ffa3bf"
  ac-tint: "#2a161f"
  ac-line: "rgba(255, 92, 141, 0.45)"
  ac-on: "#16070d"
  ok: "#37d39a"
  ok-bg: "#14281f"
  warn: "#ffc247"
  warn-bg: "#1c1913"
  warn-line: "#43391f"
  bad: "#ff6a6a"
  bad-bg: "#1d1414"
  bad-line: "#4a2c2c"
  info: "#7fb0ff"
  info-bg: "#101823"
  info-line: "#1f3350"
typography:
  display:
    fontFamily: "system-ui, -apple-system, Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums"
  headline:
    fontFamily: "system-ui, -apple-system, Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums"
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "system-ui, -apple-system, Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.08em"
  numeric:
    fontFamily: "ui-monospace, Cascadia Mono, Consolas, SF Mono, monospace"
    fontSize: "11px"
    fontWeight: 400
    fontFeature: "tabular-nums"
  numeric-lead:
    fontFamily: "ui-monospace, Cascadia Mono, Consolas, SF Mono, monospace"
    fontSize: "14px"
    fontWeight: 600
    fontFeature: "tabular-nums"
rounded:
  xs: "2px"
  sm: "3px"
  md: "4px"
  switch: "10px"
  full: "50%"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  xxl: "14px"
  x3l: "16px"
  x4l: "18px"
  rail-w: "288px"
  top-h: "48px"
  bar-h: "60px"
  row-h: "46px"
components:
  button:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.tx}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "30px"
  button-hover:
    backgroundColor: "#232935"
  button-primary:
    backgroundColor: "{colors.ac}"
    textColor: "{colors.ac-on}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "#ff789f"
  button-warn:
    backgroundColor: "{colors.warn}"
    textColor: "#221a06"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 9px"
    height: "24px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.bad}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "30px"
  button-danger-solid:
    backgroundColor: "{colors.bad}"
    textColor: "#24090a"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "30px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.tx3}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "30px"
  button-small:
    typography: "{typography.label}"
    padding: "0 9px"
    height: "24px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.tx2}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0 9px"
    height: "26px"
  chip-on:
    backgroundColor: "{colors.ac-tint}"
    textColor: "{colors.ac-2}"
  facet:
    backgroundColor: "transparent"
    textColor: "{colors.tx2}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
    width: "100%"
  facet-on:
    backgroundColor: "{colors.ac-tint}"
    textColor: "{colors.ac-2}"
  tag:
    backgroundColor: "#212832"
    textColor: "{colors.tx3}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "18px"
  tag-pink:
    backgroundColor: "{colors.ac-tint}"
    textColor: "{colors.ac-2}"
  tag-ok:
    backgroundColor: "{colors.ok-bg}"
    textColor: "{colors.ok}"
  tag-warn:
    backgroundColor: "#2a2415"
    textColor: "{colors.warn}"
  tag-info:
    backgroundColor: "{colors.info-bg}"
    textColor: "{colors.info}"
  input-text:
    backgroundColor: "{colors.input-bg}"
    textColor: "{colors.tx}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "30px"
  switch:
    backgroundColor: "#262d37"
    rounded: "{rounded.switch}"
    width: "34px"
    height: "20px"
  switch-on:
    backgroundColor: "{colors.ac}"
  banner:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.tx2}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "9px 12px"
  banner-warn:
    backgroundColor: "{colors.warn-bg}"
    textColor: "#e4d3a6"
  banner-error:
    backgroundColor: "{colors.bad-bg}"
    textColor: "#f0b6b6"
  banner-info:
    backgroundColor: "{colors.info-bg}"
    textColor: "#a9c4e4"
  banner-ok:
    backgroundColor: "{colors.ok-bg}"
    textColor: "#9fdcbf"
  table-header:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.tx3}"
    typography: "{typography.label}"
    padding: "0 12px"
    height: "30px"
  table-row:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tx}"
    typography: "{typography.body-sm}"
    padding: "10px 12px"
  table-row-dense:
    padding: "8px 12px"
    height: "46px"
  table-row-hover:
    backgroundColor: "{colors.row-hover}"
  table-row-selected:
    backgroundColor: "{colors.row-selected}"
  table-row-locked:
    textColor: "{colors.tx3}"
  table-row-done:
    backgroundColor: "{colors.row-done}"
  table-row-failed:
    backgroundColor: "{colors.row-failed}"
  runbar:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.tx2}"
    typography: "{typography.body-sm}"
    padding: "0 18px"
    height: "60px"
  snav-item:
    backgroundColor: "transparent"
    textColor: "{colors.tx}"
    typography: "{typography.body}"
    padding: "11px 16px"
  snav-item-on:
    backgroundColor: "{colors.ac-tint}"
    textColor: "{colors.ac-2}"
  src-row:
    backgroundColor: "transparent"
    textColor: "{colors.tx}"
    typography: "{typography.body-sm}"
    padding: "0 14px"
    height: "42px"
  src-row-on:
    backgroundColor: "{colors.ac-tint}"
    textColor: "{colors.ac-2}"
  dialog:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tx}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    width: "min(1000px, 100%)"
---

# Design System: biliTidy

## Overview

**Creative North Star:「深色審核工作台」（The Dark Review Bench）**

這個世界不是在這裡發明的。biliTidy 是同作者 biliFavOrg（收藏夾）與 biliFollowCleaner（關注）
兩個擴充功能的合併，兩邊本來就共用同一組 token 與同一套版面語法；合併把兩份 CSS 收成
`src/ui/styles.css` 這唯一一份，色票、4px 圓角、1px 分隔線、狀態色點、
「頂列／內容／底部作業列」的滿版高度網格逐字沿用。這份文件記錄的是**合併後實際 build 出來的落點**，
不是規劃書：凡與前身文件有出入的地方，以本檔為準（見各節的「與前身的差異」）。

畫面像一張擺在暗房裡的工作檯：底色 `ground` 幾乎全黑，往上分 rail、panel、raised 三層淺一點的灰藍，
層與層之間只靠 1px 的 `line` 分開，沒有浮起來的卡片、沒有陰影。資訊密度高——密表列高 46px、
控制項 30px、正文 13px、次要文字 12px——因為使用者一次要看幾百到幾千列，每多一分留白就少看幾列證據。
粉色 `ac` 是唯一的重點色，只用在「你選了什麼」與「你正要做什麼」上。

四個分頁（整理收藏 / 收藏夾 / 關注 / 設定）是平輩，沒有首頁、沒有儀表板入口。
介面本身不表演：動態只有狀態色 0.15s 過場、進度條的 scaleX、載入轉圈與開關圓鈕的 transform，
`prefers-reduced-motion` 一律關掉。深色是唯一模式（`color-scheme: dark`）。
字型走系統堆疊——那是擴充功能不連外抓資源的結果，不是排版主張。

**Key Characteristics:**
- 一層層變淺的深色面（`#0c0e11` → `#111419` → `#151920` → `#1b2028`），輸入框反而更暗
- 1px 分隔線取代卡片與陰影；全域唯一的 `box-shadow` 是輸入焦點的粉色光暈
- 單一重點色 `#ff5c8d`，只標「選取」與「主要動作」（品牌記號與排序箭頭是兩個系統標記例外）
- 所有可比較的數字走 tabular-nums，天數、mid、時間、端點名另外走等寬字
- 圖示一律是 16px 網格、1.5 描邊、`aria-hidden` 的手繪 SVG（`icons.tsx` 共 23 個），沒有 emoji、沒有圖示字型
- 滿版高度三段式：48px 頂列／可捲內容／60px 底部作業列
- 唯一被允許的覆蓋層是 `.dlg` 檢視視窗：平的，不投影，4px 圓角

## Colors

深灰藍的中性階，配一支提亮過的 B 站粉，再加四支只在語意場合出現的狀態色。

### Primary
- **提亮 B 站粉 Bilibili Pink**（`ac`）：選取狀態（分面、chip、來源列、設定側欄的目前項）、主要動作按鈕、
  進度條填色、焦點環、caret、`::selection`、品牌記號、排序箭頭。原生 `#fb7299` 在這個底色上只有 4.6:1，提亮後才站得住。
- **淺粉 Soft Pink**（`ac-2`）：粉底上的文字（`.facet.on`、`.chip.on`、`.tag.pink`、`.snav-item.on`）與連結預設色；連結 hover 才轉成 `ac`。
- **粉底 Pink Wash**（`ac-tint`）／**粉線 Pink Hairline**（`ac-line`）：選取態的底與框，永遠是低飽和的暗紅粉，不是實心粉。

### Secondary（狀態色，只做語意）
- **綠 Confirmed**（`ok`）：完成的列、流程步驟的打勾、已驗證標籤、收藏夾描述覆蓋率的量條。
- **琥珀 Over Threshold**（`warn`）：超過不活躍門檻的天數、AI 草稿（描述草稿、採用草稿的按鈕）、風控／取消的橫幅。
- **紅 Failed**（`bad`）：失敗的列、破壞性動作的按鈕與它旁邊的就地確認句。
- **藍 Neutral Info**（`info`）：中性告知橫幅、互相關注標籤、請求紀錄裡的端點名（`#8fb0d8`）。

每支狀態色都有配套的底（`*-bg`）與線（`*-line`），三者成組使用，不混搭。

### Neutral
- **底 Ground**（`ground`）：文件底色。
- **軌道 Rail**（`rail`）：頂列、左軌、右欄、底部作業列、表頭、讀數條的頭——「框住內容的東西」都是這一層。
- **面板 Panel**（`panel`）：中央內容區與對話框，比 rail 亮一階。
- **抬起 Raised**（`raised`）：次要按鈕與中性橫幅的底。
- **凹陷 Input**（`input-bg`）：輸入框、請求紀錄、`.pre`、chip 選擇器——比它坐的面更暗。
- **線 Line**（`line`）／**強線 Line 2**（`line-2`）：`line` 分隔區塊，`line-2` 描控制項的邊與對話框的外框。
- **文字三階**（`tx` / `tx2` / `tx3`）：主要內容／次要說明／標籤與已停用。
- **列色五支**（`row-hover` / `row-selected` / `row-done` / `row-failed` / `row-quiet`）：表格列的互動與結果底色。
  `row-quiet` 是「這一列不是資料」（新增收藏夾列、草稿原值）。**這五支在 CSS 裡是字面值，不是 custom property**；
  新畫面要用同一批值，不要再造第六支。

### Named Rules
**The Accent-Means-State Rule.** 重點色只給三件事：**選取**（`tr.sel`、作用中的分面與 chip、來源列、設定側欄的目前項）、
**主要動作**（`.btn.primary`、進度填色、載入轉圈）與**焦點環**；連結用淡一階的 `ac-2`，hover 才轉成 `ac`。
品牌記號與排序箭頭是僅有的兩個系統標記例外。除此之外不出現粉色，也不用它做裝飾。

**The Dot-Plus-Word Rule.** 狀態永遠是「6px 色點＋文字」或「圖示＋文字」。顏色不可以是唯一訊號——
失敗的列除了紅底還寫著原因，鎖住的列除了變暗還有鎖頭圖示、文字與 `title` 說明。

**The Danger-Is-Earned Rule.** 紅色只給兩種東西：已經失敗的結果，以及使用者正要按下的破壞性動作
（`.btn.danger` / `.btn.danger.solid` 與它旁邊的 `.status-failed` 確認句）。不用紅色做強調。

**The Amber-Means-Draft Rule.** 琥珀是「機器寫的、還沒被你認可的東西」與「超過門檻的數字」，
兩者共用同一支 `warn`。實心琥珀按鈕（`.btn.warn`，24px 小尺寸）只出現在「採用草稿」這一種動作上。

## Typography

**Body Font:** 系統堆疊（`system-ui, -apple-system, Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif`）
**Numeric/Mono Font:** `ui-monospace, Cascadia Mono, Consolas, SF Mono, monospace`（`--mono`）

**Character:** 沒有品牌字。介面用宿主系統的 UI 字（擴充功能不連外抓字型，CJK 交給 PingFang TC / Microsoft JhengHei），
性格全部來自尺寸與字重的落差；真正被設計過的是數字——凡是要上下對齊、要一眼比大小的欄位一律走等寬與 tabular-nums。
字級只有六階（22 / 19 / 15 / 13 / 12 / 11），沒有中間值。

### Hierarchy
- **Display**（600、22px、-0.01em、tabular-nums）：只有進度儀表的計數（`.gauge-count`），整個產品最大的一個字。
- **Headline**（600、19px）：儀表的階段名（`.gauge-phase`）與設定頁成本讀數的數字（`.read-item b`）。
- **Title**（600、15px）：內容區標題（`.c-title`）與門檻輸入框裡的天數（等寬）。
- **Body**（400、13px、1.5）：根字級。步驟標題、欄位 label、分頁名、來源列名稱、`.snav-item .nm` 走 13px/500–600。
- **Body-sm**（400、12px）：表格儲存格、按鈕、chip、橫幅、`.why`、說明文字——畫面上最常見的字級。
- **Label**（500、11px、0.08em）：左軌與右欄的區段標題（`.lbl`）；也是 `.tag`、`.acct-sub`、`.vid-sub`、
  `.folder-sub`、計數等第二行資訊的字級（這些不加字距）。
- **Numeric**（等寬、tabular-nums、11px）：mid、時間、請求紀錄、端點名。
- **Numeric-lead**（等寬、600、14px）：審核表裡的不活躍天數與儀表讀數（`.gauge-item b`）。

### Named Rules
**The Tabular Number Rule.** 每一個會被上下比較的數字都開 tabular-nums：天數、分面計數、統計讀數、儀表計數、
成本估算、mid、時間。mid、天數、時間、bvid、端點名另外走等寬字。數字不可以用比例字排在表格裡。

**The One Loud Number Rule.** 一列只有一個數字比周圍高一階——關注審核表裡是不活躍天數（14px/600，超標時轉琥珀），
其餘欄位一律 12px。要在新表格裡強調別的欄位，得先降掉這一個。

**The Eleven-Pixel Floor Rule.** 11px 是最小字級，而且只給標籤與第二行資訊；正文不低於 12px。

**The Label-Is-A-Section-Header Rule.** `.lbl`（11px/500/0.08em）只用來標**一個區段**（左軌／右欄／面板的段落標題）。
它不放在標題正上方當引言小字，也不用來裝飾單一元素。

## Layout

**外殼**：`html/body/#root` 滿版高度，`.app` 是 `grid-template-rows: 48px 1fr` ＋ `grid-template-columns: minmax(0, 1fr)`
的兩列——頂列，以及裝著頂層橫幅與目前分頁的 `.app-body`。整頁不捲，只有內容區捲。

**分頁**：每個分頁自己是 `grid-template-rows: 1fr 60px`（可捲內容 ＋ 底部作業列）；沒有作業列的用 `.page.no-bar`。

**工作區有兩種形狀**：
- `.work.rail-center`：`288px minmax(0, 1fr)`——左軌（篩選／來源）＋ 中央。關注審核、收藏夾、設定用這個。
- `.work.rail-center-side`：`280px minmax(0, 1fr) 340px`——整理收藏的設定畫面：來源軌 ＋ 目標夾表 ＋ 右邊「這一批」。
  右欄（`.side`）是 rail 層、左邊一條 1px 線，段落用 `.side-sec`（`14px 16px`）。

**中央**（`.center`，panel 層）是 `.c-head`（`14px 18px 12px`，標題＋說明）／`.c-tools`（`10px 18px`，搜尋與全選）／
`.c-body`（可捲）三段，段與段之間一條 1px 線；純內容用 `.c-pad`（`16px 18px`）。
設定表單收在 `max-width: 860px`，說明文字收在 58–76ch。

**節奏**：內距走 4／6／8／10／12／14／16／18 的階。左軌區段 `.rail-sec` 是 `12px 16px`，
密表儲存格 `8px 12px`（列高 46px），一般表格儲存格 `10px 12px`（列高隨內容），
控制項高 30px（主要動作 34px、分面 28px、chip 26px、小按鈕與讀數列 24–26px、來源列 42px）。

**捲動邊界**：可捲的左軌底部掛一道 28px 的漸層（透明 → rail）說明「下面還有」，最後一段多留 36px 內距。

**窄視窗（單一斷點 `max-width: 900px`，一個 media block 四件事）**：

1. **順流**：`.work.rail-center` **與** `.work.rail-center-side` 都改成 `display: block`，
   左軌／右欄以自然高度排在內容上下、整個工作區一起捲；左軌不再自己截高度，捲動漸層關閉。
   `.page` 那一列改成 `1fr auto`。
2. **作業列換行**：`.runbar` 走 `flex-wrap`、內距收到 `8px 12px`、行距 6px，**不再橫向捲**；
   `.why` 與 `.read-inline` 各自 `flex: 1 1 100%` 佔滿一行，分隔線（`.sep`）隱藏。
3. **只有密表改成堆疊列**：`table.grid.dense`（關注審核表）變成 block、`thead`（連同排序按鈕）不顯示，
   每一列是 `36px minmax(0, 1fr)` 的兩欄——左欄是跨四列的勾選框，右欄由上而下是名稱＋標記、
   天數（折進 `.acct-days`）＋mid、分組、最新投稿（兩行截斷）＋日期、狀態；`td.col-days`、`td.col-followed`
   與空的 `td.col-group` 不畫。底色改掛在 `tr` 上。**其他表格（影片審核表、收藏夾表、請求表）維持原樣，
   在 `.c-body` 裡橫向捲。**
4. **頂列與橫幅**：品牌只留記號（`.brand-name` 隱藏）、「重新檢查」只留圖示、帳號只留頭像；
   分頁列自己橫向捲並在右緣 mask 淡出；橫幅可換行，動作落到自己一行、靠左。

### Named Rules
**The Three-Band Rule.** 每一個分頁都是「頂列／內容／底部作業列」。作業列在每一頁都是同一件事：
你正要執行的批次，以及執行它的按鈕。不為了某個畫面拿掉這條帶子或改變它的意思。

**The Line-Not-Card Rule.** 區塊之間只用 1px `line` 分開，層次靠底色差。不用卡片、圓角容器或陰影切版面。

**The Table-Never-Widens-The-Window Rule.** 中央欄一律 `minmax(0, 1fr)`；表格太寬就在 `.c-body` 裡自己橫向捲。
頂列同理：`.app` 的 `minmax(0, 1fr)` 讓品牌＋四個分頁＋帳號不會把外殼撐寬。

**The Control-On-Top Rule.** 決定整張表要看什麼的那個控制項（關注的不活躍門檻、整理的來源夾）永遠是左軌第一段，
下面才是分面；它一動，所有分面計數與表格內容即時重算，不重新抓資料。

## Elevation & Depth

沒有陰影系統。深度完全靠色調分層：`ground` → `rail` → `panel` → `raised` 四階，各差一小步亮度，
邊界一律是 1px `line`。輸入框是唯一往下凹的面（`input-bg` 比周圍都暗），請求紀錄與 `.pre` 也用它。

唯一的覆蓋層 `.dlg` 也不投影：它靠 `rgba(4, 6, 8, 0.66)` 的背幕、panel 底色與 1px `line-2` 外框分層，
圓角仍是 4px——覆蓋層不因為浮在上面就換一套材質。

全域唯一的 `box-shadow` 是輸入焦點的粉色光暈（`0 0 0 3px rgba(255, 92, 141, 0.18)`，同時把邊框換成 `ac`）；
其餘可聚焦元素用 `:focus-visible { outline: 2px solid var(--ac); outline-offset: 1px }`。

### Named Rules
**The No-Shadow Rule.** 這個世界不投影。要區分兩個面就換底色再加一條 1px 線；`box-shadow` 只允許出現在焦點狀態。

**The Recessed Input Rule.** 可輸入的東西比它坐的面更暗（`input-bg`），可按的東西（`.btn`）比它坐的面更亮（`raised`）。

## Shapes

矩形世界，圓角小到幾乎只是去毛邊：控制項、按鈕、橫幅、chip、對話框、容器一律 4px（`--r`），
小標籤與縮圖 3px，進度條與骨架 2px，開關 10px 膠囊。真正的圓形只留給頭像、狀態色點（6px）、
流程小點（5px）、步驟編號圈（22px）與載入轉圈（12px）。

邊框只有兩種寬度：1px（分隔與描邊）與 2px（分頁的 active 底線、焦點外框）。
控制項描 `line-2`，區塊分隔用 `line`；表格與側欄裡的次級分隔線降到半透明
（`rgba(36, 42, 51, 0.5 / 0.55 / 0.6 / 0.9)`）或虛線。

**The Four-Pixel Rule.** 需要圓角的東西一律 4px。要更圓只有一種理由：它本來就是圓的（頭像、色點、開關）；
要更方只有一種理由：它比 4px 還小（18px 標籤、4px 進度條）。

## Components

### Buttons
- **Shape:** 4px 圓角，1px `line-2` 描邊，行內 flex、圖示與文字間距 6px，`flex: none`、不換行。
- **Default:** raised 底、`tx` 字、30px 高、左右 12px；hover 轉 `#232935`、邊框轉 `#3f4854`；`:disabled` 走 `opacity: 0.4` 與 `not-allowed`。
- **Primary:** 粉底、深色字（`ac-on`）、600、13px、34px 高、左右 16px——**每個分頁只有一顆**，永遠在作業列左端，永遠帶著數字。
- **Warn:** 實心琥珀、深色字、600，只給「採用 AI 草稿」，永遠是 `.small`（24px）。
- **Danger / Danger solid:** 前者是紅字紅框透明底（觸發破壞性動作與撤銷），後者是實心紅底深色字（已確認的那一下）。
- **Quiet:** 透明底無框、`tx3` 字，hover 才浮出 raised 底；用於「清除結果」這類收尾動作。
- **Small:** 24px 高、11px 字，用在分頁器、表格內與草稿動作。
- **Link:** 沒有邊框與底色的粉色文字鈕（`ac-2`，hover 轉 `ac` 並加 3px offset 底線），用在「重試」「重新檢查」這類行內動作。
- **Transition:** 只過場 `background-color` 與 `border-color`，0.15s ease-out。

### Chips
- **Style:** 26px 高、透明底、`line-2` 描邊、`tx2` 字、12px、tabular-nums。
- **State:** `.on` 換成 `ac-tint` 底、`ac-line` 邊、`ac-2` 字、600；hover 只提亮邊框與文字；`.ghost` 是虛線邊＋`tx3`。
- **Modifier size:** 審核表列裡的 `.multi .chip` 縮到 22px／11px——它是那一列的修飾，不是又一個目標。

### Facets（左軌篩選）
- **Style:** 整列可按的 28px 按鈕，無邊框、4px 圓角，名稱靠左（可省略號）、計數靠右（11px、`tx3`、tabular-nums）。
- **State:** hover 是 `row-hover`；`.on` 是 `ac-tint` 底、`ac-2` 字、600，計數轉半透明粉。
- **Behavior:** 計數反映「其他分面已經套用之後」的結果，會隨其他選擇一起變動（計數自身有 0.2s 顏色過場）。

### Tags
- **Style:** 18px 高、3px 圓角、`#212832` 底、`tx3` 字、11px；最大寬 160px，超出用省略號，多的收成 `+N`。
- **Variants:** `.pink` 給特別關注與 AI 建議的目標夾；`.ok` 給已啟用／已驗證；`.warn` 給 AI 草稿；`.info` 給互相關注。
  標籤的顏色由**它是什麼**決定，不由語氣挑。

### Inputs / Fields
- **Style:** 30px 高、`input-bg` 底、`line-2` 描邊、4px 圓角、12px 字；placeholder 走 `tx3`；
  文字欄 `max-width: 560px`、數字欄 140px。
- **Focus:** 邊框轉 `ac` 並加 3px 粉色光暈（全域唯一的 box-shadow）。
- **Disabled:** `opacity: 0.45`、`not-allowed`。
- **Field 結構:** label（13px/600）＋控制項＋`.hint`（12px、`tx3`、`text-wrap: pretty`）縱向堆疊，間距 5px、段距 14px。
- **Search:** 相對定位的容器，放大鏡 SVG 絕對定位在左 9px（`pointer-events: none`），輸入框左內距 28px。
- **Checkbox vs Switch:** 勾選＝挑東西（原生 15px checkbox，`accent-color: ac`）；開關＝改設定
  （同一個原生 checkbox 換臉成 34×20 膠囊，圓鈕走 transform）。兩者在同一頁上必須長得不一樣。

### Banners
- **Style:** 4px 圓角、1px 邊、`9px 12px` 內距、12px 字、`text-wrap: pretty`；色點或圖示在左、動作靠右（`.spacer`）。
- **Variants:** 中性用 raised；`.warn` 給風控與取消；`.error` 給未登入這類要求使用者行動的錯誤；`.info` / `.ok` 給告知與完成。
  橫幅的顏色由原因決定。頂層橫幅（header rule 失效）掛在 `.app-body` 上、`12px 16px 0`。

### Navigation
- **Top tabs:** 頂列裡 48px 全高的分頁，13px、`tx3` 字，hover 轉 `tx`，active 是 `tx` ＋600 ＋2px 粉色底線（`margin-bottom: -1px` 壓在頂列的分隔線上）。四個分頁是平輩，沒有首頁。
- **Session badge:** 頂列最右，20px 頭像＋暱稱＋等寬 mid＋「重新檢查」連結鈕；查不到時整塊轉 `bad`。
- **Settings side nav:** `.snav-item` 是 `11px 16px` 的列，18px 圖示＋13px/500 名稱＋下方一行 11px 摘要；
  `.on` 是粉底、粉字、粉圖示。**摘要永遠只有一行**（`white-space: nowrap` ＋省略號）——換了行左軌的節奏就斷。
- **Source rail（整理收藏）:** `.src-row` 42px 高的整列按鈕，`.on` 是 `ac-tint` 底＋`ac-2` 粗體名稱，
  右端 11px 計數；來源夾另掛實心粉 `.pin` 標記（17px、11px/700）。

### Review Table（招牌元件）
兩張表共用 `table.grid`：影片審核表（`10px 12px` 儲存格、`td.vtop` 頂端對齊、96×60 封面）
與關注審核表（`table.grid.dense`：`8px 12px`、列高 46px、整列可點選）。

- **Head:** `position: sticky` 的表頭，rail 底、11px/500 標籤色、30px 高；可排序欄位整個標題是按鈕，箭頭用粉色。
- **Row:** 底部 1px 線，hover 是 `row-hover`（0.15s 過場），可選的列 `cursor: pointer`（點在 `a / button / input` 上不觸發選取）。
- **Selected:** `tr.sel` 是暗紅粉底 `row-selected`（hover 再深一階）——選取用底色表示，不用邊框、不用額外標記。
- **Result rows:** 完成的列走 `row-done`、失敗的列走 `row-failed`；結果寫在原地那一列，不另開摘要。
- **Non-data rows:** 新增收藏夾那一列與草稿原值走 `row-quiet`（比 panel 更沉），表示它不是資料。
- **Narrow:** 只有 `.dense` 改堆疊列（見 Layout）。

### Locked Row（招牌裝置，兩張表共用）
狀態未確認的東西在結構上進不了任何批次，而且**看得見**：
- 關注表裡是「還沒查／查不到活躍度」的帳號（`tr.locked`），影片表裡是失效影片（同一個 class）。
- 表現一致：整列文字退到 `tx3`（帳號名退到 `tx2`，仍讀得出來）、checkbox `disabled` 並帶 `title` 寫出理由、
  狀態格是**鎖頭圖示＋一個詞**。
- **這種列進得了計數、進不了批次。** 不要用隱藏、不要用灰到看不見、不要只留一個圖示沒有字。

### Run Bar（招牌元件）
- **Style:** 60px 高、rail 底、上緣 1px 線、左右 18px、元素間距 8px；群組之間用 22px 的 `.sep` 直線分隔。
- **Content:** 左端是帶數字的主要動作（`取關 N 個`／`執行 N 筆`）；右端是匯出動作與讀數（`.read-inline`，
  數字之間用 `#4d5560` 的分隔符）。
- **The Grey-Button-Has-A-Reason Rule:** 主按鈕變灰時，旁邊**必定**有一行 12px `tx3` 的 `.why` 寫出原因，
  三種原因寫法統一：沒選東西（`whyNoSelection` / `footerEmpty`）、這一階段沒事可做（`whyRunFinished` / `whyNothingToWrite`）、
  **另一個長任務在跑**（`app.busyWithOrganise` / `app.busyWithFollows`）。第三種是互斥狀態的唯一表現方式。
- **Confirm:** 破壞性動作就地二次確認——主按鈕換成一句紅色 `.status-failed small` 說明，
  加一顆實心／描邊紅按鈕與一顆 quiet 取消，**不開對話框**。
- **Narrow:** 換行排列，`.why` 與讀數各佔一整行。

### Progress Panel（招牌元件，兩個任務共用）
- **Gauge:** `18px 20px 16px` 的段落，上排是階段名（19px/600）＋目前標的（`dim small ellipsis`）＋
  右端計數（22px/600，`done / total` 的分母用 14px `tx3`）；下面 4px 進度條（填色走 `scaleX`，0.2s）。
- **Readings:** `.gauge-read` 是一排用 1px 線分隔的欄（11px 標籤／14px 等寬數字），
  兩個任務各自帶自己的兩個讀數；值為 0 的讀數壓淡成 `tx3`——它是「沒發生」而不是一個數字。
- **Log + skeleton:** 下面是最近幾筆請求（`input-bg` 底的 `.log`，26px 等寬列、11px）與骨架列，
  骨架預示接下來審核表的形狀（封面 74px／頭像 46px）。停止的控制只有一個，在作業列。

### Dialog（唯一的覆蓋層）
- **Backdrop:** `rgba(4, 6, 8, 0.66)` 滿版、24px 內距、置中、`z-index: 50`。
- **Panel:** panel 底、1px `line-2`、**4px 圓角、不投影**、`min(1000px, 100%)`、最高滿版，內部自己捲。
- **Use:** 只做檢視——「送了什麼／請求細節」與「這次會做什麼」。**不用它做確認**（確認在作業列就地發生）。

### Icons
16px 網格、`fill: none`、`stroke: currentColor`、1.5 描邊、圓端圓角的手繪 SVG，`aria-hidden`，
顏色一律繼承文字色，實際渲染尺寸 11–18px。品牌記號是一顆打勾的圓（`IconBrand`，17px，粉色），
與工具列圖示同一個符號。不用 emoji、不用符號字元、不用圖示字型。

## Do's and Don'ts

### Do:
- **Do** 把這裡的 token 視為與兩個前身共用的同一組值：合併後 `src/ui/styles.css` 是唯一一份，改了就是改全部四個分頁。
- **Do** 用 4px 圓角、1px `line` 與底色分層做出區塊，讓新畫面自然落在同一張工作檯上。
- **Do** 讓每個分頁都有「頂列／內容／底部作業列」的三段結構，作業列永遠寫著批次數字。
- **Do** 在主要動作變灰時補一行 `.why`，並照三種既有寫法（沒選、沒事可做、另一個任務在跑）挑一種。
- **Do** 讓破壞性動作就地在作業列二次確認：紅句子＋紅按鈕＋quiet 取消。
- **Do** 讓不能操作的列留在畫面上並鎖住（文字退 `tx3`、checkbox 停用帶 `title`、狀態格鎖頭＋文字），而不是把它藏起來。
- **Do** 讓所有可比較的數字走 tabular-nums，天數、mid、時間、bvid、端點名走等寬字。
- **Do** 把狀態表達成「色點／圖示＋文字」，並在 `title` 裡補上原因。
- **Do** 新圖示照 16px 網格、1.5 描邊畫成 SVG，並繼承文字色。
- **Do** 在窄視窗只讓密表堆疊；其他表格橫向捲。

### Don't:
- **Don't** 用陰影或浮起卡片製造層次；`box-shadow` 只有焦點環一個用途，連對話框都不投影。
- **Don't** 讓粉色離開「選取」與「主要動作」，也不要引入第二支重點色。
- **Don't** 用 emoji、符號字元或圖示字型代替 SVG 圖示。
- **Don't** 用對話框做確認——`.dlg` 只做檢視，確認發生在它被觸發的那條帶子上。
- **Don't** 加首頁／儀表板／總覽頁；四個分頁是平輩，入口就是分頁本身。
- **Don't** 讓顏色成為唯一訊號（超標的天數是琥珀色，但旁邊永遠有數字與單位）。
- **Don't** 加淺色主題或任何 `prefers-color-scheme` 分支；這個世界只有深色。
- **Don't** 引入遠端字型或字型檔；擴充功能不連外抓資源。
- **Don't** 讓表格或頂列的 min-content 撐寬視窗。
- **Don't** 在同一頁上用相同外觀表示「勾選」與「設定開關」。
- **Don't** 把 `.lbl` 當成標題上方的引言小字；它只標區段。
- **Don't** 讓設定側欄的摘要換行（永遠一行，超出用省略號）。
