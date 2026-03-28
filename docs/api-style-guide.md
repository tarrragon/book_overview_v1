# API 風格指南

本文件定義 Readmoo 書庫管理器 Chrome Extension 的程式碼風格規範，供團隊開發和 Code Review 時遵循。

---

## 1. 概述

### 目的

統一專案的程式碼風格，確保所有模組遵循一致的設計模式、錯誤處理、日誌記錄和命名規範。

### 適用範圍

| 範圍 | 說明 |
|------|------|
| 新程式碼 | 必須 100% 遵循 |
| 既有程式碼 | 逐步遷移，修改時順帶修正 |
| 測試程式碼 | 遵循相同規範，測試斷言字串除外 |

### 參考檔案

| 檔案 | 用途 |
|------|------|
| `src/core/errors/ErrorCodes.js` | 錯誤代碼統一入口 |
| `src/core/errors/OperationResult.js` | 統一操作結果格式 |
| `src/core/logging/Logger.js` | 統一日誌系統 |
| `src/core/errors/codes/` | 域分類錯誤代碼 |

---

## 2. Class vs Factory 使用場景

### 規則總覽

| 層級 | 模式 | 適用條件 | 範例 |
|------|------|---------|------|
| Module/Service 層 | class | 有狀態、需生命週期管理 | `BackgroundCoordinator`, `ChromeStorageAdapter` |
| Utility 層 | factory function | 無狀態或輕量化封裝 | `createBookDataExtractor()`, `createPageDetector()` |
| 靜態工具 | class + static methods | 無實例狀態，僅提供工具方法 | `FileReaderFactory` |

### 何時使用 class

使用 class 的條件（滿足任一即可）：

- 需要維護內部狀態（如 `this.logger`, `this.config`）
- 需要生命週期管理（初始化、啟動、停止、清理）
- 繼承 `BaseModule` 或其他基底類別
- 需要依賴注入

正確範例（參考 `src/background/background-coordinator.js`）：

```javascript
class BackgroundCoordinator extends BaseModule {
  constructor () {
    super()
    this.name = 'BackgroundCoordinator'
    this.logger = new Logger('BackgroundCoordinator')
    // 有狀態、有生命週期 → 適合 class
  }

  async initialize () { /* ... */ }
  async start () { /* ... */ }
  async stop () { /* ... */ }
}

module.exports = BackgroundCoordinator
```

正確範例（參考 `src/storage/adapters/chrome-storage-adapter.js`）：

```javascript
class ChromeStorageAdapter {
  constructor (options = {}) {
    this.type = 'chrome.storage'
    this.name = 'ChromeStorageAdapter'
    // 有配置、有狀態 → 適合 class
  }

  async save (key, data) { /* ... */ }
  async load (key) { /* ... */ }
}

module.exports = ChromeStorageAdapter
```

### 何時使用 factory function

使用 factory 的條件（滿足任一即可）：

- 透過閉包管理內部狀態，不需要 `this`
- 回傳物件字面值，不需要原型鏈
- Content Script 中的輕量化模組

正確範例（參考 `src/content/extractors/book-data-extractor.js`）：

```javascript
function createBookDataExtractor () {
  let eventBus = null
  let readmooAdapter = null
  const activeExtractionFlows = new Map()

  const extractor = {
    setEventBus (bus) {
      eventBus = bus
    },
    // 透過閉包管理狀態 → 適合 factory
  }

  return extractor
}

module.exports = createBookDataExtractor
```

正確範例（參考 `src/content/detectors/page-detector.js`）：

```javascript
function createPageDetector () {
  let isReadmooPage = false
  let pageType = 'unknown'

  const detector = {
    detectReadmooPage () { /* ... */ },
    getPageType () { return pageType }
  }

  return detector
}

module.exports = createPageDetector
```

### 禁止混用

| 禁止行為 | 原因 |
|---------|------|
| 同一檔案同時匯出 class 和 factory | 增加認知負擔，使用者不知該用哪個 |
| class 內部使用 factory 建立自身 | 職責混淆 |
| factory 回傳的物件模擬 class 繼承 | 違反模式語義 |

錯誤範例：

```javascript
// 錯誤：同一檔案混用兩種模式
class BookParser { /* ... */ }

function createBookParser () {
  return new BookParser()
}

module.exports = { BookParser, createBookParser }
```

---

## 3. 錯誤處理規範

### 錯誤代碼體系

所有錯誤必須使用 `ErrorCodes` 常數，定義在 `src/core/errors/codes/` 目錄下的 11 個分類檔案中。

| 域分類 | 檔案 | 範例代碼 |
|-------|------|---------|
| 驗證 | `codes/validation.js` | `VALIDATION_ERROR`, `INVALID_INPUT_ERROR` |
| 網路 | `codes/network.js` | 網路請求相關錯誤 |
| 儲存 | `codes/storage.js` | 儲存操作相關錯誤 |
| 匯出 | `codes/export.js` | 匯出功能相關錯誤 |
| 安全 | `codes/security.js` | 權限和安全相關錯誤 |
| Chrome | `codes/chrome-extension.js` | Extension API 相關錯誤 |
| UI | `codes/ui.js` | 介面顯示相關錯誤 |
| 資料處理 | `codes/data-processing.js` | 資料轉換相關錯誤 |
| 訊息 | `codes/messaging.js` | 跨組件通訊相關錯誤 |
| 系統 | `codes/system.js` | 系統級操作相關錯誤 |
| 測試 | `codes/testing.js` | 測試基礎設施相關錯誤 |

### 拋出錯誤的正確方式

正確範例（參考 `src/utils/file-reader-factory.js`）：

```javascript
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

static createReader () {
  if (global.FileReader) return new global.FileReader()
  if (typeof FileReader !== 'undefined') return new FileReader()

  const error = new Error('檔案讀取功能不支援')
  error.code = ErrorCodes.FILE_ERROR
  error.details = { category: 'general' }
  throw error
}
```

正確範例（參考 `src/handlers/extraction-completed-handler.js`）：

```javascript
const error = new Error('無效的提取結果')
error.code = ErrorCodes.VALIDATION_ERROR
throw error
```

錯誤範例：

```javascript
// 錯誤：未設定 error.code
throw new Error('驗證失敗')

// 錯誤：使用字串字面值而非 ErrorCodes 常數
const error = new Error('找不到資料')
error.code = 'NOT_FOUND'  // 應使用 ErrorCodes.XXX
throw error

// 錯誤：直接 throw 字串
throw '操作失敗'
```

### 錯誤建立標準流程

```javascript
// 步驟 1：建立 Error 物件
const error = new Error('描述性錯誤訊息')

// 步驟 2：設定 ErrorCodes（必須）
error.code = ErrorCodes.VALIDATION_ERROR

// 步驟 3：附加 details（建議）
error.details = {
  field: 'title',
  reason: 'required'
}

// 步驟 4：拋出
throw error
```

### OperationResult 使用規範

函式回傳值使用 `OperationResult` 統一格式（參考 `src/core/errors/OperationResult.js`）：

```javascript
const { OperationResult } = require('src/core/errors/OperationResult')

// 成功結果
return OperationResult.success({ books: extractedBooks })

// 失敗結果
const error = new Error('驗證失敗')
error.code = ErrorCodes.VALIDATION_ERROR
return OperationResult.failure(error)
```

| 場景 | 使用方式 |
|------|---------|
| 服務層方法回傳 | `OperationResult.success(data)` / `OperationResult.failure(error)` |
| 跨組件通訊回應 | 序列化的 `OperationResult` |
| 內部工具函式 | 可直接 throw，由呼叫端包裝為 `OperationResult` |

---

## 4. Logger 使用規範

### Logger API

Logger 定義在 `src/core/logging/Logger.js`，提供四個日誌等級。

```javascript
const Logger = require('src/core/logging/Logger')

class MyService {
  constructor () {
    this.logger = new Logger('MyService')
  }

  process () {
    this.logger.debug('PROCESSING_START', { id: 123 })
    this.logger.info('OPERATION_COMPLETE', { count: 5 })
    this.logger.warn('QUOTA_WARNING', { usage: '90%' })
    this.logger.error('SAVE_FAILED', { reason: 'quota exceeded' })
  }
}
```

### 日誌等級使用指引

| 等級 | 用途 | 範例場景 |
|------|------|---------|
| `DEBUG` | 開發階段除錯資訊 | 變數值、流程追蹤 |
| `INFO` | 正常操作記錄 | 提取完成、儲存成功 |
| `WARN` | 非預期但可恢復的狀況 | 配額接近上限、降級處理 |
| `ERROR` | 錯誤和失敗 | 儲存失敗、API 錯誤 |

### 禁止直接使用 console

| 禁止 | 替代 |
|------|------|
| `console.log(...)` | `this.logger.info(messageKey, data)` |
| `console.warn(...)` | `this.logger.warn(messageKey, data)` |
| `console.error(...)` | `this.logger.error(messageKey, data)` |

**唯一例外**：在 `Logger` 本身無法使用的極端情境（如 Logger 初始化前），可使用 `console` 並加上註解說明原因。

參考 `src/overview/overview-page-controller.js` 中的既有 console 使用，這些屬於待遷移的技術債務：

```javascript
// 錯誤（現存技術債務，待遷移）：
console.warn('處理 storage 變更失敗:', error)
console.log(`提取時間: ${new Date(timestamp).toLocaleString()}`)
console.error('從 Chrome Storage 載入書籍資料失敗:', error)

// 正確：
this.logger.warn('STORAGE_CHANGE_FAILED', { error: error.message })
this.logger.info('EXTRACTION_TIMESTAMP', { timestamp })
this.logger.error('STORAGE_LOAD_FAILED', { error: error.message })
```

---

## 5. 模組匯出規範

### 統一使用 CommonJS

專案統一使用 CommonJS 模組系統（`require` / `module.exports`）。

| 規範 | 說明 |
|------|------|
| 模組系統 | CommonJS（`require` / `module.exports`） |
| 禁止 | ES6 `import` / `export`（除非在獨立的遷移模組中） |

### 匯出格式

**單一 class 匯出**（適用於大多數 Service 和 Module）：

```javascript
// 正確（參考 src/utils/file-reader-factory.js）
class FileReaderFactory { /* ... */ }
module.exports = FileReaderFactory

// 正確（參考 src/handlers/extraction-completed-handler.js）
class ExtractionCompletedHandler { /* ... */ }
module.exports = ExtractionCompletedHandler
```

**單一 factory 匯出**（適用於 Content Script 模組）：

```javascript
// 正確（參考 src/content/extractors/book-data-extractor.js）
function createBookDataExtractor () { /* ... */ }
module.exports = createBookDataExtractor

// 正確（參考 src/content/detectors/page-detector.js）
function createPageDetector () { /* ... */ }
module.exports = createPageDetector
```

**具名匯出**（適用於常數和多項目匯出）：

```javascript
// 正確（參考 src/core/errors/ErrorCodes.js）
const ErrorCodes = { /* ... */ }
module.exports = { ErrorCodes }

// 正確（參考 src/core/errors/codes/validation.js）
const ValidationCodes = { /* ... */ }
module.exports = { ValidationCodes }
```

### 禁止的匯出模式

```javascript
// 錯誤：混用 ES6 export
export class StandardErrorMigrationAnalyzer { /* ... */ }

// 錯誤：匯出匿名物件
module.exports = {
  doSomething () { /* ... */ },
  doOtherThing () { /* ... */ }
}
// 應改為 class 或具名 factory

// 錯誤：動態匯出
if (process.env.NODE_ENV === 'test') {
  module.exports = MockClass
} else {
  module.exports = RealClass
}
```

### 匯入規範

```javascript
// 正確：解構具名匯出
const { ErrorCodes } = require('src/core/errors/ErrorCodes')
const { OperationResult } = require('src/core/errors/OperationResult')

// 正確：直接匯入單一 class
const ChromeStorageAdapter = require('src/storage/adapters/chrome-storage-adapter')

// 正確：直接匯入 factory
const createPageDetector = require('src/content/detectors/page-detector')
```

---

## 6. 異步處理規範

### 統一使用 async/await

| 規範 | 說明 |
|------|------|
| 異步模式 | 統一 `async/await` |
| 禁止 | `.then()` / `.catch()` 鏈式呼叫 |
| 現存例外 | 待遷移的遺留程式碼 |

### 正確範例

```javascript
// 正確：使用 async/await
async save (key, data) {
  try {
    await this._acquireLock(key)
    const result = await chrome.storage.local.set({ [key]: data })
    return OperationResult.success(result)
  } catch (error) {
    error.code = error.code || ErrorCodes.STORAGE_ERROR
    return OperationResult.failure(error)
  } finally {
    this._releaseLock(key)
  }
}
```

### 禁止的模式

```javascript
// 錯誤（現存技術債務，參考 src/performance/loading-optimizer.js）：
this.loadResource(resourceName)
  .then(() => {
    this.logger.info('RESOURCE_LOADED')
  })
  .catch(error => {
    this.logger.error('LOAD_FAILED', { error })
  })

// 正確：改為 async/await
try {
  await this.loadResource(resourceName)
  this.logger.info('RESOURCE_LOADED')
} catch (error) {
  this.logger.error('LOAD_FAILED', { error: error.message })
}
```

### 錯誤處理與 async/await

```javascript
// 正確：async 函式中的錯誤處理
async extractBooks () {
  try {
    const rawData = await this._fetchBookData()
    const validated = await this._validateData(rawData)
    return OperationResult.success(validated)
  } catch (error) {
    if (!error.code) {
      error.code = ErrorCodes.DATA_PROCESSING_ERROR
    }
    this.logger.error('EXTRACTION_FAILED', {
      code: error.code,
      message: error.message
    })
    return OperationResult.failure(error)
  }
}
```

---

## 7. 命名規範

### 類別命名

| 規範 | 格式 | 範例 |
|------|------|------|
| 大小寫 | PascalCase | `BackgroundCoordinator`, `ChromeStorageAdapter` |
| 後綴慣例 | 依職責加後綴 | 見下表 |

| 後綴 | 用途 | 範例 |
|------|------|------|
| `Coordinator` | 模組協調器 | `BackgroundCoordinator`, `EventCoordinator` |
| `Handler` | 事件/請求處理器 | `ExtractionCompletedHandler`, `StorageSaveHandler` |
| `Adapter` | 外部介面適配器 | `ChromeStorageAdapter`, `LocalStorageAdapter` |
| `Service` | 單一責任服務 | `DataValidationService` |
| `Manager` | 資源管理器 | `I18nManager` |
| `Validator` | 資料驗證器 | `ReadmooDataValidator` |
| `Monitor` | 監控模組 | `PageMonitor` |
| `Router` | 訊息路由 | `MessageRouter` |
| `Factory` | 工廠模式 | `FileReaderFactory` |

### 函式命名

| 規範 | 格式 | 範例 |
|------|------|------|
| 大小寫 | camelCase | `detectReadmooPage()`, `setEventBus()` |
| 開頭 | 動詞 | `create`, `get`, `set`, `validate`, `extract` |
| Factory 函式 | `create` + 名詞 | `createBookDataExtractor()`, `createPageDetector()` |
| 私有方法 | `_` 前綴 | `_generateRequestId()`, `_acquireLock()` |

| 禁止 | 原因 | 替代 |
|------|------|------|
| `process()` | 過於模糊 | `processExtractionResult()` |
| `handle()` | 過於模糊 | `handleStorageChange()` |
| `do()` | 毫無意義 | 描述具體動作 |

### 檔案命名

| 規範 | 格式 | 範例 |
|------|------|------|
| 統一格式 | kebab-case | `background-coordinator.js`, `chrome-storage-adapter.js` |
| 禁止 PascalCase | 逐步遷移 | `ErrorCodes.js` → `error-codes.js`（遷移時處理） |
| 禁止 snake_case | 不符慣例 | `some_module.js` → `some-module.js` |

現存的 PascalCase 檔案（如 `src/core/errors/ErrorCodes.js`、`src/core/logging/Logger.js`）為歷史遺留，新檔案必須使用 kebab-case。修改既有檔案時，優先處理匯入路徑的相容性。

### 變數與常數命名

| 類型 | 格式 | 範例 |
|------|------|------|
| 一般變數 | camelCase | `eventBus`, `pageType`, `activeExtractionFlows` |
| 布林變數 | `is`/`has`/`can` 開頭 | `isReadmooPage`, `hasPermission` |
| 常數物件 | UPPER_SNAKE_CASE | `LOG_LEVELS`, `LEVEL_PRIORITIES`, `STORAGE_TYPES` |
| 常數列舉 | PascalCase 物件 + UPPER_SNAKE_CASE 值 | `OperationStatus.SUCCESS` |
| 集合 | 複數名詞 | `activeExtractionFlows`, `extractionHistory` |

---

## 8. 檢查清單

### Code Review 必檢項目

#### 錯誤處理

- [ ] 所有 `throw` 的 error 物件都設定了 `error.code = ErrorCodes.XXX`
- [ ] 沒有 `throw new Error('message')` 未設定 code 的情況
- [ ] 沒有 `throw '字串'` 的情況
- [ ] 服務層方法使用 `OperationResult` 回傳

#### Logger

- [ ] 沒有 `console.log` / `console.warn` / `console.error`（除非有註解說明例外原因）
- [ ] Logger 使用 messageKey 而非直接字串
- [ ] Logger 實例在 constructor 中建立：`this.logger = new Logger('ClassName')`

#### 模組匯出

- [ ] 使用 CommonJS `module.exports`（非 ES6 `export`）
- [ ] 單一 class/factory 使用 `module.exports = ClassName`
- [ ] 多項目使用 `module.exports = { Name1, Name2 }`

#### 異步處理

- [ ] 使用 `async/await`（非 `.then()/.catch()`）
- [ ] `async` 函式內有適當的 `try/catch`
- [ ] catch 區塊中設定 `error.code`

#### 命名

- [ ] 類別名稱使用 PascalCase 且有適當後綴
- [ ] 函式名稱使用 camelCase 且以動詞開頭
- [ ] 新建檔案使用 kebab-case
- [ ] 布林變數使用 `is`/`has`/`can` 開頭
- [ ] 無模糊命名（`data`, `info`, `temp`, `flag`）

#### Class vs Factory

- [ ] 有狀態/生命週期的模組使用 class
- [ ] 輕量化/閉包管理的模組使用 factory function
- [ ] 同一檔案沒有混用兩種模式

---

**Last Updated**: 2026-03-28
**Version**: 1.0.0
