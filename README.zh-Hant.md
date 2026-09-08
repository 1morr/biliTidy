# biliTidy

用一個 Chrome 擴充功能把 Bilibili 帳號收拾乾淨：讓你自己選的 AI 把收藏影片分進正確的收藏夾，
把已經不再投稿的關注取關——每一個改動都先經過審核表，每一批都可以撤銷。

<p>
  <a href="https://github.com/1morr/biliTidy/actions/workflows/ci.yml"><img src="https://github.com/1morr/biliTidy/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/1morr/biliTidy" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Chrome-114%2B-4285F4" alt="Chrome 114+">
</p>

[English](README.md) · **繁體中文**

biliTidy 是同一位作者的兩個擴充功能合併而成：[biliFavOrg](https://github.com/1morr/biliFavOrg)（收藏夾）與
[biliFollowCleaner](https://github.com/1morr/biliFollowCleaner)（關注）。它們做的是同一種事——用瀏覽器裡既有的登入態讀你的
B 站資料，攤成一張每一列都帶著證據的審核表，讓你勾選、確認、批次執行、可撤銷——差別只在對象是收藏夾還是關注清單。
所以現在是一個工具列圖示、一份設定、一把限速器、同一套外觀。在你按下按鈕之前，什麼都不會被搬動、沒有人會被取關。

| 整理收藏 | 清理關注 |
|---|---|
| ![收藏夾審核表](docs/images/review.png) | ![關注審核表](docs/images/follows-review.png) |

## 安裝

需要 Node.js 20+ 與 Chrome 或 Edge 114+。

```bash
npm install
npm run build      # 產出 .output/chrome-mv3
```

然後到 `chrome://extensions` → 開啟**開發人員模式** → **載入未封裝項目** → 選 `.output/chrome-mv3`。

## 開始使用

先登入 bilibili.com，再點擴充功能圖示。它會開一個分頁，裡面四個頁面：**整理**、**收藏夾**、**關注**、**設定**。

### 把收藏影片分進收藏夾

1. **設定 → 01 AI 端點**——填任一 OpenAI 相容端點的 Base URL、API Key 與 Model，按「測試連線」。
   只接受 `https://` 的網址，本機模型可以用 `http://localhost`／`http://127.0.0.1`；填別的會被擋下來，
   不會被默默換成另一個端點。儲存時會對那一個網域申請權限。
2. **收藏夾**——為每個收藏夾寫一句話，說它收什麼。可以手寫、匯入收藏夾在 B 站的簡介，或讓 AI 從裡面已有的影片歸納；
   後兩種都先是草稿，按「採用」才存。
3. **整理**——選一個來源收藏夾、勾它可以搬進去的目標收藏夾、開始分類、看審核表、再執行。**撤銷**一鍵全部放回去。
4. 任何影片頁上，原生收藏按鈕旁邊多一顆 ✨ **智慧收藏**：大約一秒把這支影片收進最合適的收藏夾，10 秒內可以取消或手動挑。

> **先把描述寫好。** 實測把一個收藏夾的描述從 `游戏视频` 這種裸標題改成一句真正的收錄標準，命中率 94% → 100%；
> 反而幫每支影片附上封面多打了 62 個請求、結果*更差*。（[完整評估](docs/research/classify-eval-2026-08.md)）

### 取關不再投稿的帳號

1. **關注**——第一個畫面會告訴你關注了幾個帳號、這次大概要打幾個請求、幾分鐘。按**讀取清單並查詢**。
   每個帳號一個請求、依設定頁的讀取速率；兩千多個關注在預設的 2 req/s 下大約半小時。結果快取 30 天，下次只查新關注的。
2. 在審核表設門檻（180／365／730 天，或自己打一個），依分組或關注類型篩選，勾選列，按**取關 N 個帳號**並確認。
   **撤銷**會把他們重新關注回來、分組也放回去。

## 它的行為

兩邊共同的：

- **審核表就是產品。** 每一列都看得到證據：AI 的建議、理由與它用了哪些欄位；或帳號的最後一支影片、多久以前、分組。
  工具沒把握的東西不會預先勾選。
- **未確認的東西進不了批次。** 失效影片永遠不送去分類；查不到投稿狀態的帳號（被限流的請求看起來跟「從沒發過片」一模一樣）
  看得見但不能勾、不能取關、不能匯出。
- **限流。** 所有讀取走同一個節流佇列（預設 2 req/s ±30% 抖動；保守 1 req/s），寫入序列化。遇到 `-352`／`-412`／`-799`／HTTP 412
  會退避 60 → 120 → 240 秒，然後**停下並保留進度**——已經抓到的列可以審核，剩下的一鍵補查。
- **一次只跑一個長任務。** 整理收藏與清理關注共用限速器，一個在跑的時候另一頁的主按鈕變灰、旁邊寫著原因。
- 任務在擴充功能自己的分頁跑、可以取消、握著 Web Lock 所以切到背景不會被 Chrome 凍結、會存快照所以關掉分頁不會丟掉審核。
  可以的話讓分頁保持在前景——Chrome 會把背景分頁的計時器鉗到每秒一次，讀取速率大約減半。

收藏夾：

- **預設是留在原地。** prompt 開頭就是這支影片目前在哪個收藏夾；沒有明顯更好的去處就留著。一支影片可以同時在幾個收藏夾裡，
  所以模型回答的是「這支最後該在哪些收藏夾」，可以同時建議留著*和*複製一份到別處（「也留在原位」）。
- **成本透明。** 設定頁算出這份設定會打哪些請求；整理頁再依這次實際的影片數算一次。
- **沒有刪除收藏夾。** 在 B 站那會連影片一起消失且不可復原。

關注：

- **三態，不是兩態。** 每個帳號是「有影片」「確認無影片」或**「未知」**三種之一。未知的列看得見但鎖著，下一輪重查。
- **分組是訊號。** 關注分組（或特別關注）通常代表你當初特意歸檔過；可以依分組篩選，或只看「沒有分組」。
- **取關一次一個**、有間隔、在作業列裡二次確認（B 站的批次端點只支援關注與拉黑）。撤銷分批重新關注並還原分組（含特別關注）；
  悄悄關注會變成一般關注。
- **匯出**仍在，當備用出口：複製勾選列的 UID（逗號分隔，Greasy Fork 關注管理器「從 UID 清單匯入」吃的格式）或下載 CSV。
  兩者都排除未知帳號。

## 權限

| 權限 | 用途 |
|---|---|
| `host_permissions` | `api.bilibili.com`（API）、`www.bilibili.com`（cookie 與影片頁的按鈕）、`*.hdslb.com`（封面與字幕） |
| `optional_host_permissions` | 只在你填入並儲存 AI 端點時，對那一個網域申請。明文 HTTP 只允許 `localhost` |
| `content_scripts` | 只作用在 `www.bilibili.com/video/*`，用來加 ✨ 按鈕。它本身不發任何請求 |
| `cookies` | 寫入（搬移、取關、重新關注）時讀 `bili_jct` 當 CSRF token |
| `declarativeNetRequestWithHostAccess` | 給擴充功能自己發往 `api.bilibili.com` 的請求補 `Referer`／`Origin`——關注清單端點少了它會回空清單 |
| `storage`、`unlimitedStorage` | 設定、描述、任務快照、IndexedDB 快取 |

你的 API Key 存在 `chrome.storage.local`，不會寫進 log、快照或匯出檔，只會送到你自己設定的那個端點。
其他東西都留在這個瀏覽器裡；連線的 B 站主機只有 `api.bilibili.com`（封面與字幕另外走 `hdslb.com`）。

## 開發

| 指令 | |
|---|---|
| `npm run dev` | WXT 開發模式（HMR） |
| `npm run build` / `npm run zip` | 建置 / 打包 |
| `npm run typecheck` / `npm test` / `npm run lint` | `tsc --noEmit` / vitest / oxlint |
| `npm run ui-preview` | 對著假的 B 站與 AI 端點把四個頁面走一遍——整輪分類、整輪關注清理、互斥狀態、設定、繁體中文——並截圖每個畫面。不需帳號、不連網。 |
| `npm run quickfav-preview` | 同樣手法跑影片頁：假影片頁餵給真的 content script，截圖智慧收藏的卡片 |
| `npm run smoke` | Playwright 載入建置好的擴充功能並走過設定頁 |
| `npm run gen-icons` | 由 `icon.svg` 重新產生 `public/icon/*.png`（用 Playwright 內建的 Chromium 轉檔） |

最後四條指令都是跑 Playwright 自帶的 Chromium——第一次用之前先 `npx playwright install chromium`。

`.env.example` 只給手動測試腳本用。**擴充功能本身完全不會讀它**——真正的 Base URL 與 API Key 在設定頁填。

## 文件

| | |
|---|---|
| [docs/how-it-works.md](docs/how-it-works.md) | 每顆按鈕做什麼、每個設定改什麼 |
| [docs/design.md](docs/design.md) | 為什麼這樣做，以及背後的 B 站 API 查證 |
| [docs/research/](docs/research/) | 上面引用的實測數據 |
| [PRODUCT.md](PRODUCT.md) / [DESIGN.md](DESIGN.md) | 給誰用、哪些規則不能動 / 視覺系統 |
| [CHANGELOG.md](CHANGELOG.md) | 改了什麼 |

由 [1morr/biliFavOrg](https://github.com/1morr/biliFavOrg) 與 [1morr/biliFollowCleaner](https://github.com/1morr/biliFollowCleaner)
合併而來；兩者各自的歷史留在原本的 repo。

## 授權

[MIT](LICENSE)
