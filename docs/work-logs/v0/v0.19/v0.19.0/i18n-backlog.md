# i18n 技術債 Backlog（v0.19.0 起算）

> **用途**：彙整匯入 / 匯出 / 主控制器 等流程中硬編碼中文用戶訊息，作為 v2.0+ i18n 國際化升級的盤點輸入。
> **本檔範圍**：v0.19.0-W1-048 Phase 4 評估 F14 條目「匯入流程 12 處硬編碼中文」之歸納記錄，非全專案 i18n 完整掃描。
> **狀態**：歸納記錄，不要求 v0.19.x 修復。修復計畫排入 v2.0+ 多語言支援工項。

---

## 來源

| 項目 | 內容 |
|------|------|
| 觸發 ticket | `0.19.0-W1-048`（Phase 4 評估）F14 |
| 落地 ticket | `0.19.0-W1-048.9`（本 DOC ticket） |
| 評估結論定位 | bay TD3：「12 處硬編碼中文用戶訊息（importer 8 + controller 匯入區段 4），FILE_CONSTANTS.MESSAGES 定義但未全用」 |
| 處理優先級 | P2（延後執行，列入專案級 i18n 技術債 backlog） |
| 升級目標 | `docs/app-requirements-spec.md` §進階功能「多語言支援：國際化和本地化框架」（v2.0+） |

---

## 掃描方式說明

本專案為 Chrome Extension（JavaScript），不採用 Flutter ARB 機制。`.claude/skills/i18n-checker` 為 Flutter 專用工具，與本專案技術棧不適配。本歸納改採以下手動方式：

```bash
# 匯入流程主檔
grep -nE "(showError|showLoading|alert|throw new Error|new Error)" src/overview/book-file-importer.js | grep -E "[一-鿿]"
grep -nE "(showError|showLoading|alert|throw new Error|new Error)" src/overview/overview-page-controller.js | grep -E "[一-鿿]"

# 抽出後的 import helper 子模組（W1-048.5.x 後）
grep -nE "[一-鿿]" src/overview/import/*.js src/overview/import-flow-controller.js | grep -vE ":\s*\*|://|:\s*//"
```

未來 v2.0+ 進入 i18n 落地階段時，應為 Chrome Extension 建置對應的 i18n 工具（建議走 Chrome Extension 原生 `chrome.i18n` API + `_locales/` 目錄機制），並補充對應的硬編碼掃描腳本。

---

## 匯入流程硬編碼字串清單（W1-048 F14，12 處）

### A. `src/overview/book-file-importer.js`（importer 主檔，8 處）

| # | 位置（worktree 0.19.0-W1-048.9 行號參考） | 邏輯模組 | 硬編碼內容 | 用戶可見類型 |
|---|------------------------------------------|---------|----------|------------|
| 1 | 148 | `_validateFileBasics`（檔案存在性） | `'請先選擇一個 JSON 或 CSV 檔案！'` | showError → UI 訊息 |
| 2 | 149 | `_validateFileBasics`（Error 訊息） | `'檔案不存在'` | Error.message（log / debug） |
| 3 | 155 | `_validateFileBasics`（格式檢查） | `'請選擇 JSON 或 CSV 格式的檔案！'` | showError → UI 訊息 |
| 4 | 156 | `_validateFileBasics`（Error 訊息） | `'檔案格式不正確'` | Error.message |
| 5 | 295 | `_validateFileSize`（大小檢查） | `'檔案過大，請選擇小於 10MB 的檔案！'` | showError → UI 訊息（含寫死的「10MB」常數應同步抽出） |
| 6 | 296 | `_validateFileSize`（Error 訊息） | `'檔案大小超出限制'` | Error.message |
| 7 | 390 | `_handleReaderError`（讀檔失敗） | `'讀取檔案時發生錯誤'` | showError → UI 訊息（同字串複用為 Error.message） |
| 8 | 405 | `_handleFileProcessError`（解析失敗包裝） | `` `載入檔案失敗：${error.message}` `` | showError → UI 訊息（前綴硬編碼） |

**附加觀察（不計入 12 處但同屬 i18n 範圍）**：

| 位置 | 硬編碼內容 | 用戶可見類型 |
|------|----------|------------|
| 39–42 | `FILE_CONSTANTS.MESSAGES.{FILE_PARSE_ERROR / FILE_READ_ERROR / INVALID_JSON / INVALID_CSV}` 已定義為常數但只在部分位置使用 | 常數來源 |
| 49–53 | `CSV_HEADER_TO_FIELD` 對應的 CSV 中文表頭（書名/書城來源/進度/狀態/封面URL） | 解析 input 字面對照（屬資料格式契約，未必走 i18n） |
| 349 | `'FileReaderFactory 載入失敗：require 不可用'` | 開發者 log（環境錯誤） |
| 441 / 449 | `INVALID_CSV + '：內容為空'` / `INVALID_CSV + '：缺少必要欄位（id 或 書名）'` | Error.message（複合字串） |
| 628 | `'檔案內容為空'` | Error.message |
| 661 | `'JSON 檔案格式不正確'` | Error.message（含 cause 鏈） |
| 715 | `'[WARNING] 大型資料集，建議分批處理（未來改善）'` | console.warn（開發者 log） |
| 786 | `'[book-file-importer] 偵測到 metadata-wrap 形狀（非 SPEC-EXPORT-V2 定義），走歷史相容路徑'` | console.warn（開發者 log） |
| 800 | `'JSON 檔案應該包含一個陣列或包含books屬性的物件'` | Error.message |
| 832 | `` `${fieldName} 型別非陣列，降級為空陣列` `` | console.warn（含變數插值） |

### B. `src/overview/overview-page-controller.js`（controller 匯入區段，4 處）

匯入流程在 W1-048.5.x ANA-5 後委派至 `ImportFlowController`，controller 主檔的匯入區段大幅瘦身。F14 原始指向的 4 處對應如下：

| # | 評估時定位 | 拆分後現況（worktree 0.19.0-W1-048.9） |
|---|-----------|--------------------------------------|
| 9 | `CONSTANTS.MESSAGES.NO_DATA_EXPORT`（'沒有資料可以匯出'） | 行 52，定義仍在主檔，被 `handleExportJSONv2`（901）/ `handleExportCSVv2`（935）的 `alert()` 使用 |
| 10 | `CONSTANTS.MESSAGES.FILE_PARSE_ERROR`（'檔案解析失敗'） | 行 53，定義在主檔但無實際使用點（疑似 dead constant，待 v2.0+ 一併確認） |
| 11 | `CONSTANTS.MESSAGES.FILE_READ_ERROR`（'檔案讀取失敗'） | 行 54，定義在主檔但無實際使用點（同上） |
| 12 | `CONSTANTS.MESSAGES.INVALID_JSON`（'無效的 JSON 格式'） | 行 55，定義在主檔但無實際使用點（同上） |

**附加觀察（W1-048.5.1 拆分後新增 / 同屬 i18n 範圍）**：

下列字串於 ANA-5 `ImportFlowController` 抽出後出現在新模組，屬「匯入流程整體」i18n 範圍但不計入 F14 原始 12 處：

| 位置 | 硬編碼內容 | 用戶可見類型 |
|------|----------|------------|
| `src/overview/import-flow-controller.js:113` | `'[ERROR] 匯入模式 modal 元素缺失，無法顯示模式選擇'` | console.error（開發者 log） |
| `src/overview/import-flow-controller.js:254` | `'匯入功能初始化失敗'` | showError → UI 訊息 |
| `src/overview/import-flow-controller.js:264` | `'正在讀取檔案...'` | showLoading → UI 訊息 |
| `src/overview/import-flow-controller.js:281` | `'儲存空間不足，匯入未完成'` | showError → UI 訊息 |
| `src/overview/import-flow-controller.js:283` | `'儲存失敗，已還原原有資料'` | showError → UI 訊息 |

**進一步的拆分演進（W1-048.10.1.5.x 系列）**：

`src/overview/import/` 子目錄下的 helper class（`file-reader.js` / `file-validator.js` / `content-parser.js`）為 `book-file-importer.js` 後續瘦身的目標位置。本 ticket 派發指引提到「.10.1.4 完成後 importer.js 可能搬到 helper class」，掃描 worktree 現況確認 helper class 已存在並複製了多數字串（見上方 grep 輸出）。v2.0+ i18n 落地時需注意：**同一份硬編碼可能同時存在於 importer 與 helper class 兩處**，需一併處理避免漏網。

---

## 行號穩定性聲明

- 本檔行號為 `ticket/0.19.0-W1-048.9` 分支當下 reference（base commit `95b5513b`），不為斷言。
- 並行任務 `0.19.0-W1-048.10.1.4` 完成後 `book-file-importer.js` 可能大幅瘦身（< 80 行）、12 處硬編碼可能搬遷至 `src/overview/import/*.js`。
- v2.0+ 落地 i18n 時應重新 grep 確認實際位置。歸納的「邏輯模組 + 訊息字串」為穩定錨點。

---

## v2.0+ i18n 升級路徑引用

| 文件 | 章節 | 內容 |
|------|------|------|
| `docs/app-requirements-spec.md` | §進階功能 L773 | 「多語言支援：國際化和本地化框架」（v2.0+ 規劃條目） |
| `docs/work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W1-048.md` | Phase 4 Worth-It Filter 分類 L207 | 「延後執行（P2）F14：i18n 匯入流程硬編碼字串列入專案級 i18n 技術債 backlog」 |
| `docs/work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W1-048.md` | Spawn 規劃 L229 | DOC-9 → `0.19.0-W1-048.9`（本 ticket） |

**建議升級步驟（v2.0+）**：

1. **盤點擴展**：將本檔範圍從「匯入流程 12 處」擴展至全專案掃描（含 src/storage / src/ui / src/popup / src/background 等所有模組）
2. **工具建置**：基於 `chrome.i18n` API 建立硬編碼掃描腳本（取代不適用的 i18n-checker Flutter 工具）
3. **語系資源**：建立 `_locales/zh_TW/messages.json` 作為 baseline，後續按 Chrome Web Store 上架目標市場補英文 / 日文等
4. **替換策略**：分批替換（先 UI 訊息 → Error.message → console.log），與 v0.19.x 後續匯入流程拆分演進（W1-048.10.1.5.x）協調行號變動
5. **回歸鎖定**：對每處硬編碼移除後加 i18n key 對應的單元測試，避免 helper class 重構時遺漏

---

## 變更歷史

| 日期 | 版本 | 變更 |
|------|------|------|
| 2026-05-24 | 1.0.0 | 初始建立（W1-048.9）：歸納 W1-048 F14 12 處硬編碼，補附加觀察與拆分後現況交叉表 |
