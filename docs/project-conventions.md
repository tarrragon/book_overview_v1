# 專案特定規範（Readmoo 書庫管理器）

> **用途**：本檔案從 `CLAUDE.md §6` lazy-load 引入，載入時機為寫產品程式碼前。內容為本專案特有的錯誤處理體系與架構骨架。
>
> **存放位置說明**：本檔位於 `docs/`（專案內部文件），不會經 `.claude/` sync 機制傳遞到其他專案，可安全引用 `src/` 路徑與專案專屬識別符。

---

## 錯誤處理體系

專案採用分層錯誤處理，基於 ErrorCodes 常數和專用錯誤類別：

| 錯誤類型 | 檔案位置 | 用途 |
|---------|---------|------|
| ErrorCodes | `src/core/errors/ErrorCodes.js` | 核心錯誤代碼常數 |
| NetworkError | `src/core/errors/NetworkError.js` | 網路相關錯誤 |
| BookValidationError | `src/core/errors/BookValidationError.js` | 書籍資料驗證錯誤 |
| ErrorHelper | `src/core/errors/ErrorHelper.js` | 統一錯誤處理工具 |
| OperationResult | `src/core/errors/OperationResult.js` | 統一操作結果結構 |
| UC0X ErrorFactory/Adapter | `src/core/errors/UC0XError*.js` | 用例特定錯誤工廠 |

**強制規範**：

- 禁止 `throw 'error message'` 或 `throw new Error('message')`，使用專案錯誤類別
- 使用 `OperationResult` 統一回應格式
- 詳見：`src/core/errors/` 目錄

---

## Messages 系統規範

專案採用分層 messages 管理：跨模組共用 key 集中於 `MessageDictionary.js` 的 `_loadDefaultMessages()`（以下稱 **GlobalMessages**），模組專屬 key 由各模組自行透過 `new MessageDictionary({...})` 註冊 **local dict**。

**規範依據**：W1-107 ANA（MessageDictionary 作用域邊界分析）議題 A（GlobalMessages 納入標準）+ 議題 B 方案 1（命名前綴規範）。

### GlobalMessages 納入標準（3 條件，須同時滿足）

key 須**同時滿足以下 3 條件**才可加入 GlobalMessages：

| 條件 | 說明 |
|------|------|
| 被 2+ 獨立模組引用 | 同一 `src/` 子目錄視為同一模組；單一模組內多檔案共用不算「跨模組」 |
| 屬通用詞彙 | 錯誤碼（`NETWORK_ERROR`）、操作狀態（`SUCCESS`/`FAILED`）、系統生命週期（`SYSTEM_READY`） |
| 無模組前綴 | key 名稱不含 `POPUP_`/`SEARCH_`/`VALIDATOR_`/`EXTRACTOR_` 等模組識別詞 |

**任一條件不滿足，必須改放對應模組的 local dict**。3 條件採 AND 邏輯，避免「只滿足 2 條件」開後門。

### 合格 GlobalMessages key 範例（約 20 個）

| 分類 | key 範例 |
|------|---------|
| 錯誤類 | `VALIDATION_FAILED`, `NETWORK_ERROR`, `STORAGE_ERROR`, `PERMISSION_DENIED`, `UNKNOWN_ERROR` |
| 操作類 | `OPERATION_START`, `OPERATION_COMPLETE`, `OPERATION_CANCELLED`, `OPERATION_TIMEOUT`, `OPERATION_RETRY` |
| 系統類 | `SYSTEM_READY`, `SYSTEM_SHUTDOWN`, `LOADING`, `PROCESSING` |
| 通用 UI | `SUCCESS`, `FAILED`, `RETRY`, `CANCEL`, `CONFIRM` |
| 測試 | `TEST_MESSAGE`, `TEST_WITH_PARAMS` |

### 命名前綴規範

含模組前綴的 key 屬 **module-specific**，禁止出現在 GlobalMessages：

| 前綴 | 對應模組 | 應註冊位置 |
|------|---------|-----------|
| `POPUP_*` | `src/popup/` | popup local dict |
| `SEARCH_*` | `src/ui/`（search-filter） | `searchUIMessages` |
| `VALIDATOR_*` | `src/platform/`（validator） | `validatorMessages` |
| `EXTRACTOR_*` | `src/extractors/`, `src/content/` | extractor/content local dict（待建） |

**判定原則**：key 名稱**首段**為模組識別詞即視為 module-specific。`OPERATION_START` 雖含 `OPERATION_` 但非模組名（屬通用操作詞彙），不適用此規範。

### 新模組加入 messages 流程

新模組（如未來的 options page、devtools panel）需要訊息字典時，**禁止**將該模組的 key 加進 GlobalMessages，必須建立 local dict。

**local dict 模板**（仿 `searchUIMessages` / `validatorMessages` 模式）：

```javascript
// src/<your-module>/messages.js（或檔案內 const）
const { MessageDictionary } = require('../core/messages');

const myModuleMessages = new MessageDictionary({
  MYMODULE_INIT: '模組初始化',
  MYMODULE_READY: '模組已就緒',
  MYMODULE_ERROR_X: '特定錯誤訊息',
  // 模組專屬 key 全部放這裡
});

module.exports = { myModuleMessages };
```

**使用時**：

```javascript
const { myModuleMessages } = require('./messages');
const text = myModuleMessages.get('MYMODULE_INIT');
```

**禁止做法**：

```javascript
// 錯誤：把模組 key 加進 GlobalMessages
// src/core/messages/MessageDictionary.js
_loadDefaultMessages() {
  return {
    // ... 既有共用 key
    MYMODULE_INIT: '模組初始化',  // 禁止：屬 module-specific
  };
}
```

### Code Review Checklist

審查 messages 相關變更時，依以下步驟判定 key 的歸屬：

| 步驟 | 檢查項目 | 通過條件 |
|------|---------|---------|
| 1 | key 名稱是否含模組前綴？（`POPUP_`/`SEARCH_`/`VALIDATOR_`/`EXTRACTOR_` 等） | 若含 → 必須放 local dict，**不得**加進 GlobalMessages |
| 2 | key 是否被 2+ 獨立模組引用？ | grep 確認跨模組（不同 `src/` 子目錄）引用點 ≥ 2 |
| 3 | key 是否屬通用詞彙？（錯誤碼 / 操作狀態 / 系統生命週期 / 通用 UI） | 屬具體業務邏輯（如「書籍提取進度」）→ 應在 module local dict |
| 4 | 變更是否新增 module-specific 模組？ | 確認對應 local dict 已建立，未新增 key 到 GlobalMessages |

**Reviewer 拒絕條件**：

- key 含模組前綴卻加進 GlobalMessages → 要求改放 local dict
- key 僅單一模組使用卻加進 GlobalMessages → 要求改放 local dict
- 新模組訊息直接加進 GlobalMessages 而未建立 local dict → 要求建立 local dict

**強制規範**：

- GlobalMessages（`MessageDictionary.js` 的 `_loadDefaultMessages()`）僅收納跨模組共用 key
- 模組專屬 key 必須透過 `new MessageDictionary({...})` 註冊為 local dict
- 含模組前綴的 key 禁止出現在 GlobalMessages
- 詳見：`src/core/messages/MessageDictionary.js`、現有 local dict 範例（`searchUIMessages`、`validatorMessages`）

---

## 專案架構

```
src/
├── background/       # Service Worker 和後台邏輯
├── content/          # Content Script（頁面注入）
├── popup/            # 彈出視窗 UI
├── core/             # 核心模組（errors, enums 等）
├── extractors/       # 資料提取器
├── handlers/         # 事件處理器
├── storage/          # 儲存管理
├── export/           # 匯出功能
├── ui/               # 通用 UI 元件
├── utils/            # 工具函式
├── data-management/  # 資料管理
├── overview/         # 書庫總覽
├── performance/      # 效能相關
└── platform/         # 平台抽象層
```

**完整結構說明**：`docs/struct.md`

---

**遷移歷史**：自 `.claude/references/project-specific-conventions.md` 外移至 `docs/`（2026-05-11）。原檔位於 `.claude/` 跨專案 sync 範圍但含 `src/` 路徑等專案層級識別符，違反框架文件穩定性規則。
