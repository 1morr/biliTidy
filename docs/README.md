# 文件索引

每份文件各回答一個問題，不重複同一件事。**要改哪一件事，就改它所屬的那一份**：

| 文件 | 回答 | 什麼時候寫進去 |
| --- | --- | --- |
| [how-it-works.md](how-it-works.md) | **按下去之後發生什麼事** | 使用者看得到的行為變了 |
| [design.md](design.md) | **為什麼這樣做**、B 站與 AI 端點的 API 查證（1–10 整理收藏、11–17 清理關注） | 做了取捨、否決了某個方案、量到 API 的新事實 |
| [research/](research/) | **實測數據** | 跑了一次量測，不管結論是什麼 |
| [../CHANGELOG.md](../CHANGELOG.md) | **改了什麼** | 每一次行為變更 |
| [../PRODUCT.md](../PRODUCT.md) | **這是給誰、做什麼、哪些規則不能動** | 產品定位或不可變規則變了 |
| [../DESIGN.md](../DESIGN.md) | **長什麼樣子**：token、元件、版面規則 | 視覺系統變了 |

另外兩份不在這裡：[README](../README.md) 是給還沒安裝的人看的入口，
[AGENTS.md](../AGENTS.md) 是給 AI 代理的施工守則（哪裡有地雷、改動要同步什麼）。

## research/

| 檔案 | 內容 |
| --- | --- |
| [classify-eval-2026-08.md](research/classify-eval-2026-08.md) | 分類品質實測：設定之間的差距、描述的投報率、短號 id、批次大小；末尾是分類路徑合流後的回歸實測 |
| [keep-source-eval-2026-08.md](research/keep-source-eval-2026-08.md) | 來源收藏夾要不要給模型一個 id：命中率、「什麼都保留」的錨定效應與防治規則 |
| [wbi-test-vector.md](research/wbi-test-vector.md) | WBI 簽名的常數與測試向量（`src/bilibili/wbi.test.ts` 的來源） |

新增實測時照 `<主題>-eval-<YYYY-MM>.md` 命名，並在上表加一列。
方法與判讀門檻（±5 個百分點內不算差異）寫在 [AGENTS.md 的測試階梯 L5](../AGENTS.md#l5-分類品質實測改-prompt資料來源換模型時)。

## 程式碼地圖

```
src/
├─ entrypoints/   background.ts（DNR 規則、開分頁、智慧收藏 RPC）
│                 app/（React 整頁）、quickFav.content.ts（影片頁按鈕）
├─ bilibili/      B 站 API：http（WBI/csrf/錯誤分類/請求紀錄）、fav、video、subtitle、cover、tid 對照表、
│                 relation（關注清單、分組、關係操作）、archive（最新投稿）
├─ net/           throttle、serialQueue、backoff、sleep（純函式，有測試）
├─ ai/            OpenAI 相容 client、prompt、parser、describe（生成描述）、vision 測試
├─ core/          settings、scheduler、cache（idb：詳情／封面／活躍度）、jobStore（兩份快照）、headerRules、messages
│                 整理收藏：plan、fetchList、fetchDetails、classify、organizer、moves、estimate、flow、promptPreview、describeFolder、quickFav
│                 清理關注：activity（三態與資格）、fetchFollows、checkActivity、unfollow（取關與撤銷）、followFilter、exportRows、followEstimate
├─ shared/        型別（收藏夾＋關注）、AppError、activity（請求紀錄環狀緩衝）、chunk
├─ i18n/          en（型別來源）、zh-Hant；關注的文案在 follows.* 命名空間
└─ ui/            App（四個分頁）、store（設定、收藏夾）、jobStore（整理）、followJobStore（關注）、jobGuard（互斥）、jobLock（Web Lock）
                  pages/run（整理）、pages/FoldersPage、pages/FollowsPage ＋ pages/follows/*、pages/settings/*
                  components（ProgressPanel 共用儀表、ReviewTable、Avatar、icons、fields…）
scripts/          gen-icons、mock-ai、smoke、ui-preview、quickfav-preview
```

依賴方向是 `ui → core → {bilibili, ai, net, shared}`；`bilibili`／`ai`／`net` 是葉節點，不 import `core`。

同一組規則有多個呈現的地方（`planOf()`、`canSelect()`、`jobGuard` 這些「只准有一份實作」的判斷），
完整對照表在 [AGENTS.md](../AGENTS.md) 的「單一來源」一節——這裡不再複製一份，兩份會漂。
