---
name: biliTidy
description: 彈幕播放器的時間軸——影片黑的平塗底、1px 分隔線、粉色只給「現在」，底部作業列就是控制列。
colors:
  ground: "#0c0c0e"
  rail: "#121316"
  panel: "#0f1012"
  raised: "#1a1b20"
  input-bg: "#09090b"
  line: "#24262c"
  line-2: "#33363e"
  tx: "#f2f3f5"
  tx2: "#a9adb6"
  tx3: "#8b9099"
  ac: "#ff5c8d"
  ac-2: "#ffb0c8"
  ac-tint: "rgba(255, 92, 141, 0.14)"
  ac-line: "rgba(255, 92, 141, 0.5)"
  ac-ink: "#1a0710"
  ok: "#a0ee00"
  ok-bg: "#18220d"
  ok-line: "#34481a"
  warn: "#ffd302"
  warn-bg: "#24200a"
  warn-line: "#4d4312"
  bad: "#ff4a3d"
  bad-bg: "#24120f"
  bad-line: "#5a2a24"
  info: "#89d5ff"
  info-bg: "#0f1a22"
  info-line: "#1f3a4a"
  track: "#24262c"
  buffered: "#4b4e57"
  row-selected: "#221217"
  row-selected-hover: "#28151b"
  row-hover: "#14151a"
  row-draft: "#17150c"
  row-done: "#121a0c"
  row-failed: "#1e1210"
typography:
  count:
    fontFamily: "Spline Sans Mono, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums"
  readout:
    fontFamily: "Spline Sans Mono, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "20px"
    fontWeight: 600
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums"
  headline:
    fontFamily: "system-ui, -apple-system, Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  body-strong:
    fontFamily: "system-ui, -apple-system, Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
  secondary:
    fontFamily: "system-ui, -apple-system, Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.08em"
  lead-number:
    fontFamily: "Spline Sans Mono, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "14px"
    fontWeight: 600
    fontFeature: "tabular-nums"
  mono:
    fontFamily: "Spline Sans Mono, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    fontFeature: "tabular-nums"
rounded:
  control: "4px"
  chip: "3px"
  track: "2px"
  knob: "50%"
spacing:
  hair: "4px"
  tight: "6px"
  sm: "8px"
  row: "10px"
  md: "14px"
  lg: "16px"
  page: "24px"
components:
  button:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.tx}"
    typography: "{typography.secondary}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "30px"
  button-hover:
    backgroundColor: "#23252c"
  button-primary:
    backgroundColor: "{colors.ac}"
    textColor: "{colors.ac-ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "#ff789f"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.bad}"
    typography: "{typography.secondary}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "30px"
  button-danger-solid:
    backgroundColor: "{colors.bad}"
    textColor: "#24090a"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.tx3}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "30px"
  input:
    backgroundColor: "{colors.input-bg}"
    textColor: "{colors.tx}"
    typography: "{typography.secondary}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "32px"
  switch:
    backgroundColor: "#2b2d35"
    rounded: "10px"
    width: "34px"
    height: "20px"
  switch-checked:
    backgroundColor: "{colors.ac}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.tx2}"
    typography: "{typography.secondary}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "26px"
  chip-on:
    backgroundColor: "{colors.ac-tint}"
    textColor: "{colors.ac-2}"
  facet:
    backgroundColor: "transparent"
    textColor: "{colors.tx2}"
    typography: "{typography.secondary}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    height: "28px"
  facet-on:
    backgroundColor: "{colors.ac-tint}"
    textColor: "{colors.ac-2}"
  tag:
    backgroundColor: "#212329"
    textColor: "{colors.tx2}"
    typography: "{typography.secondary}"
    rounded: "{rounded.chip}"
    padding: "0 6px"
    height: "20px"
  badge:
    backgroundColor: "transparent"
    textColor: "{colors.tx2}"
    typography: "{typography.secondary}"
    rounded: "{rounded.chip}"
    padding: "0 8px"
    height: "22px"
  badge-on:
    backgroundColor: "{colors.ac-tint}"
    textColor: "{colors.ac-2}"
  banner:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.tx2}"
    typography: "{typography.secondary}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  progress-track:
    backgroundColor: "{colors.track}"
    rounded: "{rounded.track}"
    height: "4px"
  progress-buffered:
    backgroundColor: "{colors.buffered}"
  progress-played:
    backgroundColor: "{colors.ac}"
  chapter-seg:
    backgroundColor: "{colors.track}"
    rounded: "{rounded.track}"
    height: "4px"
  chapter-seg-dirty:
    backgroundColor: "{colors.ac}"
  playhead-knob:
    backgroundColor: "{colors.ac}"
    rounded: "{rounded.knob}"
    size: "16px"
  dialog:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.tx}"
    rounded: "{rounded.control}"
    padding: "14px 18px"
    width: "min(1000px, 100%)"
---

# Design System: biliTidy

## Overview

**Creative North Star: "彈幕播放器的時間軸"**

這個世界借用觀眾天天在用的播放器語法。底是影片黑的平塗色，分層只靠 1px 的線與極小的明度差；螢幕上不該有光暈、投影或漸層，因為播放器的畫面裡只有內容與控制列。每一頁的底部都是控制列：左邊是「你正要執行的批次」與執行它的按鈕，中段是進度軌或章節軌，右邊是時間碼式的讀數。任務不是抽象的百分比，而是一條分成「未播／已緩衝／已播」三段的軌；關注的安靜門檻不是一個表單欄位，而是一條貫穿整張審核表的播放頭。

粉色（`ac` #ff5c8d，B 站粉提亮到黑底上站得住的亮度）在這裡是「播放頭的顏色」：它只標示現在、你選的、以及你按下去會發生事情的那顆按鈕。狀態不用粉色，狀態走彈幕色板——黃、綠、紅、淡藍是彈幕本來就會飄過去的顏色，讓「超過門檻」「還在投稿」「失敗」「從未投稿」各自有一眼認得出的色相；但顏色永遠不是唯一訊號，狀態一律是「色點＋文字」或「圖示＋文字」。

密度是工具的密度而不是儀表板的密度：13px 的介面字、12px 的次要字、46px 的密表列高、4px 的圓角。所有數字（時間碼、計數、天數、mid、端點名、預設值）走內建的 Spline Sans Mono 並開 tabular-nums，讓上下列對得齊。介面只有深色一套，沒有 `prefers-color-scheme` 分支。

**Key Characteristics:**

- 影片黑的平塗底（#0c0c0e），四階中性面靠 1px 線分層，全域零 box-shadow
- 粉色只給「現在／你選的／主要動作／焦點」，其餘一律中性
- 彈幕色板承擔狀態，且色彩永不獨自傳訊
- 「48px 頂列／內容／64px 控制列」的滿版高度三段網格，每頁自己捲
- 讀數與識別符走內建等寬（Spline Sans Mono, tabular-nums），散文走系統堆疊
- 4px 圓角的控制項、圓形的旋鈕與播放頭、2px 圓端的軌

## Colors

一套從影片黑往上疊四階的中性面，配一個粉色重點與四個彈幕狀態色；沒有第二個裝飾色。

### Primary

- **播放頭粉 Playhead Pink** (`ac`): 現在在哪、你選了什麼、你要按的那一顆。用在：主按鈕底色、分頁 active 的 3px 段、選取列的邊界訊號、作用中章節段與其播放頭、審核表的播放頭與已播進度、焦點框、caret、排序箭頭、開關打開時的軌。除了這幾處，介面上不該再出現粉色的面。
- **淺粉 Soft Pink** (`ac-2`): 粉底之外的粉「字」。連結、作用中 chip／分面／badge 的文字、播放頭旁的天數、目前所在章節的編號。
- **粉薄膜 Pink Tint** (`ac-tint`) 與 **粉線 Pink Line** (`ac-line`): 被選中的容器底與邊框——14% 不透明度的膜，足以說明「這一個是作用中的」，又不會蓋掉底下的文字。
- **粉底墨 Pink Ink** (`ac-ink`): 只出現在粉色實心面上的字色。

### Secondary（彈幕色板）

四個狀態色的語意是固定的，不可以借去做裝飾：

- **彈幕黃 Danmaku Yellow** (`warn`): 安靜超過門檻的天數、AI 產生但還沒被採用的草稿、需要注意但還沒壞掉的橫幅。
- **彈幕綠 Danmaku Green** (`ok`): 還在投稿、已完成、寫入成功的請求列、收藏夾容量計。
- **彈幕紅 Danmaku Red** (`bad`): 失敗、破壞性動作、錯誤橫幅與錯誤狀態的頂列。
- **彈幕淡藍 Danmaku Blue** (`info`): 從未投稿之類的中性事實、端點名、資訊橫幅。

每個狀態色都有一組 `-bg`／`-line`（例如 `warn-bg`／`warn-line`）：深底薄膜配同色系的邊，給標籤與橫幅用。狀態的文字色一律取亮色本身，橫幅的文字則取該色的淡化版以維持可讀性。

### Neutral

- **影片黑 Ground** (`ground`): 應用最外層與頂列。
- **軌道灰 Rail** (`rail`): 左軌、右欄、底部控制列、對話框、表頭條——所有「控制」而非「內容」的面。
- **面板黑 Panel** (`panel`): 中央內容區與 sticky 表頭；比 rail 更暗，內容區永遠是這個世界最沉的那一面。
- **抬起灰 Raised** (`raised`): 次要按鈕與橫幅的面。
- **凹陷黑 Input** (`input-bg`): 輸入框、程式碼區塊、紀錄框——比底還深一階，讓「可以打字的地方」看起來是凹的。
- **線 Line** (`line`) 與 **強線 Line 2** (`line-2`): 1px 的分隔線與控制項邊框。分層只有這兩條線可用。
- **主要／次要／三級文字** (`tx` / `tx2` / `tx3`): 內容、說明、標籤與停用。
- **未播 Track** (`track`) 與 **已緩衝 Buffered** (`buffered`): 進度軌與章節軌的底、以及快取命中的那一段。
- **列底色**（`row-hover` / `row-selected` / `row-selected-hover` / `row-draft` / `row-done` / `row-failed`）: 表格列的六種狀態底，全部是中性面加一絲對應色相，永遠不到能與文字搶注意力的飽和度。

### Named Rules

**The Playhead Rule.** 粉色只有五種合法用途：現在、選取、主要動作、焦點、已播。任何「為了好看」而出現的粉色都是錯的；使用者特意歸檔的訊號（例如特別關注）用加重字重而不是上色。

**The Danmaku Status Rule.** 狀態色的語意鎖死：黃＝超過門檻或 AI 草稿，綠＝進行中或完成，紅＝失敗，淡藍＝從未投稿或中性告知。不新增第五個狀態色，也不把狀態色借給非狀態的元素。

**The Dot-Plus-Text Rule.** 顏色永遠不是唯一訊號。每一個狀態都必須同時有文字（或圖示＋文字）；橫幅一律以 6px 圓色點開頭。

## Typography

**Body Font:** 系統堆疊（system-ui / -apple-system / Segoe UI，CJK 靠 PingFang TC、Microsoft JhengHei）
**Mono Font:** Spline Sans Mono（隨擴充功能打包，OFL，可變字重 300–700），fallback 為 ui-monospace / Cascadia Mono / Consolas

**Character:** 介面文字刻意不表演——它用使用者作業系統自己的字，讀起來像系統工具而不是網站。所有會被拿來比大小、對得齊的東西（時間碼、計數、天數、mid、端點、預設值）換成等寬並開 tabular-nums：等寬字是這個世界唯一的「字型事件」，出現的地方就是可以用眼睛掃過去比對的地方。

### Hierarchy

- **Count**（等寬 600、22px、tabular-nums）：進度儀表的「已完成／總數」。全介面最大的字，而且是個數字。
- **Readout**（等寬 600、20px）：設定頁成本讀數條的三個數。
- **Headline**（600、19px、-0.01em）：中央區標題與任務階段名。
- **Title**（700、14px、-0.01em）：頂列品牌字。
- **Lead number**（等寬 600、14px）：一列裡最重要的那個數字（安靜天數、儀表的每一項讀數）。
- **Body**（400、13px、1.5）：內容文字、表單標籤、按鈕主要動作、帳號名。600 為其加重版。
- **Secondary**（400、12px）：說明、提示、表格儲存格、次要按鈕、chip、標籤、橫幅。介面上絕大多數的字。
- **Label**（600、12px、+0.08em、`tx3`）：軌／欄段落的段名。只用來標一個段落的開頭。
- **Mono**（等寬 400、12px、tabular-nums）：mid、端點名、預設值、年份刻度、章節編號、時間戳。

### Named Rules

**The Time-Code Rule.** 等寬只給讀數與識別符：時間碼、計數、天數、mid、端點名、預設值、章節與步驟編號。散文永遠用介面字——章節摘要與說明即使裡面夾著數字，也只有數字那一段換等寬。

**The 12px Floor Rule.** 沒有比 12px 更小的字。需要更弱的層級就降色（`tx2` → `tx3`），不降字級。

**The Tabular Rule.** 任何會出現在上下相鄰列的數字都要 `tabular-nums`；一欄數字對不齊，這張表就不能用眼睛掃。

## Layout

**三段式滿版高度。** 應用是 `48px 頂列 / 1fr` 的網格，內容區再切成 `1fr / 64px 控制列`。整個介面不捲動，捲動發生在各自的欄裡（左軌、中央 `.c-body`、右欄）。這不是一條長頁面。

**頂列**：品牌記號＋名字、四個平行分頁（整理收藏／收藏夾／關注／設定）、右端的登入狀態。作用中的分頁用一段 3px、上緣圓角的粉色「已播」段壓在頂列的分隔線上。

**內容的三種欄型**：`左軌 320px + 中央`（整理、關注）、`左軌 280px + 中央 + 右欄 340px`（審核時的整理頁）、`中央 1fr + 右欄 520px`（設定頁的雙欄）。中央欄一律 `minmax(0, 1fr)`：寬表格在自己的 `.c-body` 裡橫向捲，永遠不把版面撐寬。左軌是 `rail` 面、中央是 `panel` 面，靠 1px 線分界。

**控制列**：高 64px，`rail` 面，上緣 1px 線。左邊是這一批＋執行它的按鈕；按鈕變灰時旁邊一定寫得出原因（12px、`tx3`、允許換兩行）。中段放進度軌或章節軌，右端是靠右的讀數列。破壞性動作在列內二次確認，不開 modal。

**節奏**：4 / 6 / 8 / 10 / 14 / 16 / 24。段落內距 `14px 16px`（軌）與 `16px 24px`（中央）；表格儲存格 `10px 12px`，密表 `8px 12px`、列高 46px；分隔一律 1px 線，不用空白製造分組。文字量測的上限是字元數而不是像素：說明 60ch、導言 72ch、步驟 64ch。

**斷點**：兩個。`≤1200px` 先把時間軸欄讓給證據欄（`display: none`，`table-layout: fixed` 自己重分寬度）。`≤900px` 是「窄視窗」的完整規則：左軌與右欄改成順流排在內容上下、整個工作區一起捲（`display: block`，不是被壓扁的 grid）；控制列改成換行而不是橫向捲，章節軌收起；關注審核表改成堆疊列（勾選框在左，右側由上而下是名字、天數＋mid、分組、最新投稿），表頭與時間軸欄不畫；設定列從兩欄變一欄；頂列只留品牌記號、圖示版重新檢查與頭像，分頁列自己橫向捲並在右緣淡出；勾選框與圖示按鈕的可點範圍撐到 24×24（WCAG 2.2 AA 的 2.5.8），開關維持 34×20 不受影響。

### Named Rules

**The Three-Band Rule.** 每一頁都是「頂列／內容／控制列」。新畫面只能決定內容區怎麼分欄，不能改動這三段的存在或高度。

**The Control-Bar Rule.** 控制列在每一頁講同一句話：這一批是什麼、執行它的按鈕、以及按鈕變灰時的原因。它不是工具列，不放與「執行這一批」無關的東西。

**The No-Wider-Than-Window Rule.** 每一個 grid 的內容欄用 `minmax(0, 1fr)`，寬內容在自己的捲動容器裡橫向捲。介面本身永遠不比視窗寬。

## Elevation & Depth

這個世界沒有陰影。全域零 `box-shadow`，零投影、零光暈。深度只由三件事表達：四階中性面的明度差（`input-bg` < `panel` < `ground` < `rail` < `raised`）、1px 的分隔線、以及覆蓋層的背幕（`rgba(4,4,6,0.7)`）。唯一的覆蓋層是檢視視窗（「送了什麼」「這次會做什麼」），它靠背幕與一條 `line-2` 邊框浮起來，不加陰影、也不放大圓角。

焦點同樣不發光：輸入框聚焦是邊框轉粉，其他可聚焦元素是 2px 粉色 `outline` 加 1px offset。

漸層只有兩處，而且兩處都在描述「還有更多」或「不確定」：左軌捲動區底部的 28px 淡出遮罩（以及窄視窗分頁列右緣的 mask），還有時間軸上表示「從未投稿／查不到」的 4px 虛線軌。

### Named Rules

**The No-Glow Rule.** 這個世界不發光。焦點是實色邊框或 outline，不是光暈；抬起是明度差，不是投影。任何 `box-shadow` 都是錯的。

**The Two-Gradients Rule.** 漸層只有兩種合法用途：捲動邊界的淡出遮罩，以及表示「沒有資料」的虛線軌。裝飾性漸層一律不畫。

## Shapes

形狀語言分兩類：**控制項是 4px 的方角矩形，會動的東西是圓的。**

- 控制項圓角 4px（`--r`）：按鈕、輸入框、chip、分面、橫幅、對話框、程式碼區塊、紀錄框。
- 更小的貼片 3px：標籤、badge、收藏夾縮圖、封面、pin。
- 軌 2px 圓端：進度軌、章節段、容量計。
- 完全圓形：頭像、狀態色點（6px）、時間軸上的投稿標記（12px）、章節播放頭（14px）、審核表播放頭的拇指（16px）、開關的旋鈕、步驟編號圈（22px）。
- 邊框只有 1px 一種粗細；虛線邊只用在「還沒有東西」的 ghost chip 與虛線軌。

圖示一律是自己畫的 SVG（`ui/components/icons.tsx`），16 格線稿、`currentColor`、圓端圓角接合。品牌記號是一個帶 28 圓角的深色方塊，裡面一個白色打勾，下緣一條粉色的進度軌與播放頭圓鈕——世界的縮圖。

### Named Rules

**The 4px-and-Round Rule.** 能點的方形東西是 4px 圓角；能拖或代表「一個點在時間上」的東西是正圓。不存在第三種圓角語言，也不存在藥丸形的按鈕。

**The Drawn-Icon Rule.** 圖示只用 `icons.tsx` 裡畫好的 SVG。不用 emoji、不用符號字元、不用圖示字型——系統字型缺字會變成豆腐方塊。

## Components

元件的性格是「像播放器的控制項一樣安靜」：預設低對比，靠 hover 與選取才亮起來，過場一律 0.15s ease-out 且只動顏色或 transform。

### Buttons

- **Shape:** 4px 圓角（`--r`），1px `line-2` 邊框。
- **Default:** `raised` 底、`tx` 字、12px 500、高 30px、左右 12px。
- **Primary:** 粉底、`ac-ink` 字、13px 600、高 34px、左右 16px——比次要按鈕高 4px，因為它是控制列上的播放鍵。
- **Hover / Focus:** 底色與邊框各亮一階（`#23252c` / `#40444e`；主按鈕 `#ff789f`）；焦點是 2px 粉色 outline。
- **Danger:** 預設是紅字＋紅邊的空心；只有二次確認後的那一顆才是紅底實心（`solid`）。
- **Quiet:** 全透明、`tx3` 字，hover 才浮出 `raised` 底。
- **Disabled:** `opacity: 0.4`＋`not-allowed`，而且旁邊一定有一句 `.why` 說明為什麼。

### Chips / Facets / Tags / Badges

- **Chip**（可點的篩選或目標）：26px 高、4px 圓角、透明底、`line-2` 邊；作用中＝粉薄膜底＋粉線邊＋淺粉字＋600。`ghost` 變體是虛線邊，代表「還可以加一個」。
- **Facet**（左軌的篩選列）：28px 高、整列可點、右端是等寬的計數；作用中＝粉薄膜底＋淺粉字。計數反映其他分面套用後還剩多少。
- **Tag**（唯讀的事實）：20px 高、3px 圓角，中性底；狀態變體用彈幕色板的 `-bg`＋亮色字。使用者自己標記的重要性（特別關注）用 `strong`：加重字重、底色升一階，不上色。
- **Badge**（章節開頭的適用範圍）：22px 高，`on` 是粉薄膜，`off` 是 `tx3` 加刪除線。

### Cards / Containers

這個世界沒有卡片。容器是「用 1px 線切出來的段」：左軌的 `.rail-sec`、右欄的 `.side-sec`、設定的 `.frow`，一律 `padding: 14–16px`＋下緣 1px `line`，最後一段不畫線。唯一帶邊框的盒子是資料容器（讀數條、紀錄框、程式碼區塊、chip 挑選器）：1px `line` 邊、`input-bg` 底、4px 圓角。

### Inputs / Fields

- **Style:** 32px 高、`input-bg` 底、1px `line-2` 邊、4px 圓角、12px 字。URL／密碼／數字欄自動走等寬。textarea 最低 54px、只允許縱向調整。
- **Focus:** 邊框轉粉，不加光暈。
- **Dirty（改過還沒存）:** 邊框轉半透明粉（`ac-line`），與控制列上亮起的章節段是同一個訊號。
- **Disabled:** `opacity: 0.45`。
- **SettingRow（`.frow`）:** 左邊是「這是什麼、做什麼、預設是什麼」（13px 600 標題／12px 說明／等寬預設值），右邊是控制項欄（280–420px）。說明永遠在畫面上，不藏進 tooltip。窄視窗收成一欄，說明在上、控制項在下。
- **勾選與開關的分工:** 勾選框＝挑東西（原生 checkbox，`accent-color` 粉），開關＝改設定（同樣是原生 checkbox，只換一張臉：34×20 的軌、14px 圓鈕、以 `transform` 移動）。同一頁上不可以讓這兩件事長得一樣。

### Navigation

- **頂列分頁:** 13px，未選 `tx3`、hover 轉 `tx`、作用中 `tx` 600 並在下緣長出一段 3px 粉色圓端段。四個分頁永遠平行，不做下拉。
- **設定頁左軌章節:** `34px 編號 + 名稱` 的兩欄列，第二行是一行摘要（超出用省略號，不換行）。作用中＝粉薄膜底、粉色編號、淺粉摘要。章節分三組，組與組之間以 1px 線與組名（12px 600 +0.06em）分開。
- **控制列的章節軌:** 六段等寬的 4px 軌，段間 3px；第 3 與第 4 段之間留 14px 缺口，標示「AI 專用／共用」的分界。改過沒存的段整段轉粉，目前所在的段上方掛一顆 14px 的圓形播放頭（2px `rail` 描邊）。軌下方是等寬的 01–06 編號，目前那個轉淺粉。

### 時間軸欄（Signature）

關注審核表的主角，也是這個世界的命名來源。

- 表格是 `table-layout: fixed`：勾選 36px、帳號 19%、最新投稿 20%、分組 80px、**時間軸 24%（最寬的百分比欄）**、天數 104px、關注於 92px、狀態 100px。欄位藏起來時 fixed layout 自己重分寬度。
- **表頭是刻度尺**（40px 高）：年份刻度（等寬 12px＋1px 6px 短刻線）由左至右，軸的右端就是「今天」。
- **播放頭是原生 `input[type=range]` 換臉**：軌透明、拇指是 16px 粉色圓鈕（2px `panel` 描邊），hover／focus 放大 1.25 倍，鍵盤左右鍵可拖。它綁的是安靜門檻——拖動＝改設定。旁邊貼著等寬的天數標籤，靠右超過 72% 時翻到左邊。
- **每一列是一條軌**（46px 高）：2px 的未播軌貫穿整列；從最新投稿到今天畫一條 6px、35% 不透明度的安靜期長條，起點是一個 12px 的圓標記，兩者取該列狀態色。沒有投稿或查不到的列改畫 4px 虛線軌＋等寬註記。
- **門檻在每一列各畫一段 2px 粉色豎線**，上下各多 1px 蓋過列的分隔線，看起來就是一條貫穿整張表的連續播放頭。

### Progress track

進度是播放器的進度條，不是百分比文字：4px 高、`track` 底，上面疊兩層——`buffered` 灰段是快取命中的部分，粉色段是真的打了請求的部分。填色用 `scaleX` 而不是寬度，只在合成層動。有快取命中時下方出現 12px 的圖例。儀表區上方是階段名（19px）與等寬 22px 的「已完成／總數」，下方是以 1px 直線分隔的讀數項（已用、預估剩餘、實際速率、任務專屬讀數）。

### Tables

- 表頭 sticky、40px 高、`panel` 底、12px 600 +0.06em `tx3`；可排序的表頭整格是按鈕，箭頭用粉色（這是系統標記，不是選取）。
- 儲存格 12px、下緣 1px `line`。hover 底色升一階；選取列是 `row-selected`（帶粉的暗紅），完成／失敗／草稿列各有自己的中性偏色底。
- **鎖住的列**（狀態查不到或還沒查）：`tr.locked` 文字整列退到 `tx3`、勾選框 disabled 並帶 title 說明原因——看得見、讀得到、但選不動。

### Named Rules

**The Visible-But-Locked Rule.** 不能被選的列不藏起來也不變灰到讀不出來：整列退一階、勾選框鎖上、並且說得出為什麼。使用者要能看見自己沒被納入的那一批是誰。

**The Restyle-Native Rule.** 開關、播放頭、勾選框都是原生表單元素換一張臉。不做自訂的假控制項，鍵盤與輔助技術的行為必須原封不動。

**The Reason-Beside-The-Button Rule.** 主按鈕變灰時，旁邊必定有一句 12px 的原因。沒有原因就不該讓按鈕變灰。

## Do's and Don'ts

### Do:

- **Do** 讓粉色（#ff5c8d）只出現在現在、選取、主要動作、焦點、已播這五種位置上。
- **Do** 用彈幕色板表達狀態，並且永遠配上文字：黃＝超過門檻／AI 草稿，綠＝進行中／完成，紅＝失敗，淡藍＝從未投稿／中性告知。
- **Do** 用 1px `line` 與四階中性面分層；容器是「切出來的段」，不是浮起來的卡片。
- **Do** 把每一頁做成「48px 頂列／內容／64px 控制列」，內容各自捲動。
- **Do** 在控制列上放這一批＋執行它的按鈕，按鈕變灰時寫出原因。
- **Do** 讓時間碼、計數、天數、mid、端點名、預設值走 Spline Sans Mono 並開 tabular-nums。
- **Do** 用 4px 圓角給控制項、正圓給旋鈕與時間點標記、2px 圓端給軌。
- **Do** 用 `icons.tsx` 裡畫好的 SVG 圖示。
- **Do** 讓不能選的列留在畫面上、鎖住勾選框、並說明原因。

### Don't:

- **Don't** 加任何 `box-shadow`、光暈或投影——這個世界不發光，焦點是實色邊框或 outline。
- **Don't** 畫裝飾性漸層；漸層只留給捲動邊界的淡出遮罩與代表「沒有資料」的虛線軌。
- **Don't** 用粉色表達狀態，也不要用狀態色標示選取。
- **Don't** 讓顏色單獨傳訊；每個狀態都要有文字或圖示。
- **Don't** 用小於 12px 的字；要更弱就降色不降字級。
- **Don't** 用 emoji 或符號字元當圖示。
- **Don't** 為破壞性動作開 modal；在控制列內二次確認。
- **Don't** 讓表格或頂列把版面撐得比視窗寬（內容欄一律 `minmax(0, 1fr)`）。
- **Don't** 加淺色主題或 `prefers-color-scheme` 分支；App 分頁只有深色一套（淺色只屬於長在 B 站頁面上的影片頁卡片）。
- **Don't** 為了「這一頁比較特別」而改動控制列的意思或三段版面的存在。
