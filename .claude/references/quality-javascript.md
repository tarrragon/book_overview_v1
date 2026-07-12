# JavaScript 品質規則

本文件為 JavaScript 語言的品質規則補充。通用規則見 quality-common.md。

> **適用代理人**：dill-javascript-developer
>
> **適用版本**：JavaScript ES2022+（執行環境 Chrome 114+ Manifest V3；建置/測試環境 Node.js 20+）

---

## 1. 命名慣例

> **版本相關**：以下命名規則適用於 ES2022+ 慣例（含 `#` 私有欄位）。

| 類型 | 規則 | 正確範例 | 錯誤範例 |
|------|------|---------|---------|
| 變數 / 函式 | camelCase，函式為動詞片語 | `extractBookData()` | `extract_book_data()` |
| 類別 | PascalCase 名詞 | `OperationResult` | `operationResult`（類別名） |
| 模組級常數 | 大寫蛇形 | `STATUS_CONFIG` | `statusConfig`（常數） |
| 私有成員 | `#` 私有欄位（ES2022） | `#retryCount` | 新程式碼用 `_retryCount` |
| 布林 | `is` / `has` / `can` 開頭 | `hasPendingExtraction` | `pendingFlag` |
| 檔案 | 類別檔 PascalCase、模組檔 kebab-case | `BookValidationError.js`, `ui-factory.js` | `bookvalidationerror.js` |

**禁止**：`data` / `info` / `value` 模糊詞單獨命名、無意義縮寫、新程式碼使用 `_` 前綴偽私有。

---

## 2. 常數管理（強制）

常數依作用域集中定義（CLAUDE.md §6.1 為權威），**程式碼中禁止硬編碼數值或業務字串**。

| 作用域 | 定義位置 | 範例 |
|--------|---------|------|
| 通用 UI token | `src/core/design-system/` | `COLORS` / `SPACING` / `FONT_SIZES` / `SHADOWS` |
| Popup UI 文字 | `src/popup/constants/ui-text.js` | 按功能分類：status / extraction / import / diagnostic / navigation |
| Popup 佈局與時序 | `src/popup/constants/layout.js` | `POPUP_DIMENSIONS` / `STATUS_CONFIG` / `HANDSHAKE_CONFIG` |
| 模組專屬常數 | 模組內 constants 檔案或模組頂部 | `const MAX_RETRY_COUNT = 3;` |

```javascript
// 正確：具名常數（require 為既有共用模組 CJS 模式，經 esbuild bundle 後執行，
// 非 content script runtime require；環境邊界見 §5 / §6）
const { HANDSHAKE_CONFIG } = require('../constants/layout');
setTimeout(retry, HANDSHAKE_CONFIG.RETRY_INTERVAL_MS);

// 錯誤：魔法數字
setTimeout(retry, 3000);
```

**禁止行為**：

| 禁止 | 正確做法 |
|------|---------|
| JS/HTML 中硬編碼 popup 文字或佈局數值 | 寫入 `ui-text.js` / `layout.js` |
| 自寫 spacing/color 字面值 | 使用 design-system token |
| popup.html 硬編碼 UI 結構 | `src/core/ui/components/ui-factory.js` 工廠函式（class 名稱對齊 `component-rules.js`，不新增 CSS） |

---

## 3. 字串管理（強制）

使用者可見字串統一由分層 Messages 系統管理，**程式碼中禁止硬編碼使用者可見字串**。權威規範：`docs/project-conventions.md`「Messages 系統規範」。

| 類型 | 放置位置 | 判定 |
|------|---------|------|
| 跨模組共用 key | GlobalMessages（`MessageDictionary.js` `_loadDefaultMessages()`） | 3 條件 AND：2+ 獨立模組引用、通用詞彙、無模組前綴 |
| 模組專屬 key | 各模組 local dict（`new MessageDictionary({...})`） | key 首段含模組識別詞（`POPUP_` / `SEARCH_` / `VALIDATOR_` / `EXTRACTOR_`）即屬此類 |

正確做法（模組 local dict）：

```javascript
const { myModuleMessages } = require('./messages');
const text = myModuleMessages.get('MYMODULE_INIT');
```

錯誤做法（硬編碼或錯置）：

```javascript
statusEl.textContent = '提取完成';        // 硬編碼使用者可見字串
// 或：把 POPUP_* key 加進 GlobalMessages（違反命名前綴規範）
```

---

## 4. 錯誤處理（強制）

專案採分層錯誤處理（`src/core/errors/`），禁止裸字串錯誤與原生 Error 直拋。

```javascript
// 正確：專案錯誤類別 + OperationResult 統一回應格式
// （require 環境邊界說明同 §2 範例；見 §5 / §6）
const { ErrorCodes } = require('../core/errors/ErrorCodes');
const { OperationResult } = require('../core/errors/OperationResult');
return OperationResult.failure(ErrorCodes.NETWORK_ERROR, { url, cause: error });

// 錯誤：裸字串或原生 Error
throw 'network failed';
throw new Error('network failed');
```

**catch 區塊可觀測性**（observability-rules 規則 1）：每個 catch 必須記錄日誌（含錯誤訊息與元件名稱）或在註解說明靜默原因；禁止空 catch。日誌走專案 Logger，禁止散落 `console.log`（ESLint `no-console` 已設 warn，`--max-warnings=0` 下即阻擋）。

---

## 5. Chrome Extension 關鍵限制（強制）

Manifest V3 與 Node.js 環境差異是本專案最高頻的實作錯誤來源。逐項正誤對照：

| 限制 | 錯誤寫法 | 正確寫法 |
|------|---------|---------|
| Content Script 禁 `require()`（不支援 CJS runtime） | 頁面注入碼直接 `require('...')` | esbuild IIFE bundle 打包後注入 |
| 禁 bare specifier | `import x from 'src/core/...'` | 相對路徑 `'../core/...'` 或 esbuild alias |
| 禁 `global`（非 Node.js） | `global.registry = {}` | `globalThis.registry = {}` |
| Service Worker 無 `window` | SW 內 `window.addEventListener` | `self` 或 `globalThis` |
| Storage API keys 必須是陣列 | `chrome.storage.local.get('books')` | `chrome.storage.local.get(['books'])` |
| SW 事件監聽器必須頂層同步註冊 | `await init(); chrome.runtime.onMessage.addListener(...)` | 頂層同步 `addListener`，async 邏輯放 handler 內 |
| Build 必須 bundle | 只複製檔案到 build/ | esbuild 三入口點（background / content / popup）bundle |

> 通用速查：`.claude/references/chrome-extension-quickref.md`；專案完整規範：`docs/chrome-extension-dev-guide.md`；Readmoo DOM/路由：`docs/bookstores/readmoo.md`。

---

## 6. 模組系統：ES Module 與 CJS/ESM 雙模式

專案宣告為 ES Module，但 Jest（jsdom）以 CJS 載入模組，Extension runtime 由 esbuild bundle——共用模組必須雙模式相容：

```javascript
// 正確：CJS 匯出 + 條件掛載（既有共用模組主流模式）
class MessageDictionary { /* ... */ }
module.exports = { MessageDictionary };

// 錯誤：只寫 export（Jest CJS 載入失敗）或只掛 window（SW 環境無 window）
export { MessageDictionary };
window.MessageDictionary = MessageDictionary;
```

**規則**：

- 新增共用模組前，先觀察同目錄既有模組的匯出模式並對齊
- 跨環境全域掛載一律 `globalThis`，禁止 `window` / `global` 直接掛載
- 禁止在 content script 依賴 runtime `require()`（見第 5 節）

---

## 7. Jest 測試慣例

| 慣例 | 說明 |
|------|------|
| jsdom 非真實 Chrome | `chrome.storage` / `chrome.runtime` / `chrome.tabs` 需 mock，不可假設真實行為 |
| Chrome API mock | 對齊既有 `tests/` 內 mock 模式；斷言訊息傳遞用 mock 呼叫參數，不只斷言不拋錯 |
| `performance.now` mock | 遞增值需手動管理，否則 OOM |
| DOM 選擇器測試 | 目標網站 DOM 可能變更，實作需多層 fallback，測試需覆蓋 fallback 路徑 |
| 計時斷言 | `tests/unit` / `tests/integration` 禁絕對計時門檻（`toBeLessThan(Nms)`）；計時斷言集中 `tests/perf/`（test-assertion-design-rules 規則 1-2） |
| 綠燈邊界 | mock 替代真實依賴時，訊息系統/跨模組整合類修復需 runtime 層級驗證（PC-165） |

```bash
npm test                                  # 核心測試（單元 + 整合）
npx jest tests/unit/<path>.test.js        # 單檔迭代
npm run lint                              # ESLint（--max-warnings=0 由 pre-commit 把關）
```

---

## 8. 版本特有品質要求（ES2022+，強制）

> **核心原則**：必須使用 ES2022+ 語法，**預設不考慮向下相容**。

| 功能 | ES2022+ 做法 | 舊版做法（禁止） | 說明 |
|------|-------------|----------------|------|
| 私有成員 | `#retryCount` | `this._retryCount` | `_` 無封裝保證，`#` 有語言級私有 |
| 尾端存取 | `items.at(-1)` | `items[items.length - 1]` | 意圖直讀，消除 off-by-one |
| 預設值 | `config.timeout ?? DEFAULT_TIMEOUT` | `config.timeout \|\| DEFAULT_TIMEOUT` | `\|\|` 把 `0` / `''` 誤判為缺值 |
| 安全取值 | `book?.tags?.length` | `book && book.tags && book.tags.length` | 巢狀防呆鏈降認知負擔 |
| 深拷貝 | `structuredClone(state)` | `JSON.parse(JSON.stringify(state))` | JSON 迂迴丟失 Date/Map 且效能差 |
| 錯誤鏈 | `new NetworkError(msg, { cause: error })` | 吞掉原始錯誤重新 throw | 保留根因上下文（ES2022 Error cause） |

**禁止行為**：

| 禁止 | 原因 |
|------|------|
| `var` 宣告 | 函式作用域提升造成隱性 bug，一律 `const` 優先、必要時 `let` |
| callback 巢狀處理異步 | 統一 `async/await`，錯誤走 try/catch + 專案錯誤類別 |
| top-level await 進入 Extension bundle | SW 事件監聽器頂層同步註冊會被 await 延遲（違反第 5 節） |

---

## 9. JavaScript 品質檢查清單

（在通用清單基礎上追加）

- [ ] 命名符合 ES2022+ 慣例（camelCase / PascalCase / 大寫蛇形常數 / `#` 私有）
- [ ] 無硬編碼數值：常數集中於 design-system / popup constants / 模組 constants
- [ ] 無硬編碼使用者可見字串：GlobalMessages 3 條件判定，模組 key 入 local dict
- [ ] 錯誤處理走 `src/core/errors/`（ErrorCodes + OperationResult），catch 有日誌或靜默註解
- [ ] Chrome Extension 限制逐項通過（第 5 節表格對照）
- [ ] 共用模組 CJS/ESM 雙模式相容，全域掛載用 `globalThis`
- [ ] 使用 ES2022+ 語法（無 `var`、無 callback 巢狀、無 `\|\|` 誤作預設值）
- [ ] 計時斷言未混入 `tests/unit` / `tests/integration`
- [ ] `npm run lint` 0 warnings
- [ ] `npm test` 100% 通過

---

## 相關文件

- .claude/references/quality-common.md - 通用品質基線（核心規則定義）
- .claude/agents/dill-javascript-developer.md - JavaScript 代理人定義（含版本規範章節）
- .claude/references/chrome-extension-quickref.md - Manifest V3 通用限制速查
- .claude/rules/core/test-assertion-design-rules.md - 測試斷言設計（JS/Jest 四規則）
- docs/project-conventions.md - 錯誤處理體系與 Messages 系統規範（權威）
- docs/chrome-extension-dev-guide.md - 專案 Chrome Extension 完整開發規範

---

**Last Updated**: 2026-07-12
**Version**: 1.0.0 - 從 quality-language-template.md 建立（ticket 1.5.0-W6-013）
**JavaScript Version**: ES2022+（Chrome 114+ / Node.js 20+）
