# 🛠️ 標準化錯誤代碼體系設計文件

## 📋 文件資訊

- **版本**: v4.0.0
- **建立日期**: 2025-09-16
- **更新日期**: 2025-09-16
- **適用範圍**: Chrome Extension 錯誤處理體系
- **狀態**: ✅ 最終實用方案
- **維護者**: Claude Code + 專案團隊

## 🎯 設計目標

### 核心問題：消除魔法字串
**真實的技術債務**：直接在程式碼中使用字串會導致：
1. **拼寫錯誤** → 錯誤處理邏輯在執行時失效
2. **重構困難** → 無法安全地重新命名錯誤代碼
3. **IDE 支援缺失** → 沒有自動完成和拼寫檢查
4. **維護困難** → 錯誤代碼散佈在程式碼中難以管理

### 解決原則
1. **解決實際問題**: 專注於消除拼寫錯誤，不過度設計
2. **最小複雜度**: 用最簡單的機制達成目標
3. **IDE 友善**: 提供自動完成和重構支援
4. **人類可讀**: 錯誤代碼在日誌中直接可讀，無需查表
5. **零負擔**: 不增加執行時效能負擔

## 📊 現有錯誤代碼分析

### 統計數據 (基於專案現狀)
```
UNKNOWN_ERROR         267 次使用  ❌ 需要替換
TEST_ERROR            99 次使用   ❌ 需要替換或移除
NETWORK_ERROR         60 次使用   ✅ 可保留但需常量化
VALIDATION_ERROR      30 次使用   ✅ 可保留但需常量化
OPERATION_FAILED      32 次使用   ⚠️ 需要細化
```

### 問題識別
1. **魔法字串** - 開發者直接輸入 `'UNKNOWN_ERROR'`，容易拼錯
2. **缺乏統一管理** - 錯誤代碼散佈在程式碼中，難以維護
3. **IDE 無法支援** - 沒有自動完成，重構工具無法處理
4. **調試困難** - 無法快速找到所有使用某個錯誤代碼的地方

## 🏗️ 標準化錯誤代碼體系設計

### 核心方案：字串常量

#### 設計理念
**用最簡單的機制解決實際問題** - 字串常量完全消除魔法字串問題，同時保持零複雜度。

#### 實作結構
```javascript
// src/core/errors/ErrorCodes.js
const ErrorCodes = {
  // 書籍處理
  BOOK_VALIDATION_FAILED: 'BOOK_VALIDATION_FAILED',
  BOOK_NOT_FOUND: 'BOOK_NOT_FOUND',
  BOOK_EXTRACTION_FAILED: 'BOOK_EXTRACTION_FAILED',
  BOOK_PROCESSING_TIMEOUT: 'BOOK_PROCESSING_TIMEOUT',

  // 網路通訊
  NETWORK_CONNECTION_TIMEOUT: 'NETWORK_CONNECTION_TIMEOUT',
  NETWORK_CONNECTION_FAILED: 'NETWORK_CONNECTION_FAILED',
  NETWORK_AUTHENTICATION_FAILED: 'NETWORK_AUTHENTICATION_FAILED',
  NETWORK_RESPONSE_INVALID: 'NETWORK_RESPONSE_INVALID',

  // 儲存管理
  STORAGE_READ_FAILED: 'STORAGE_READ_FAILED',
  STORAGE_WRITE_FAILED: 'STORAGE_WRITE_FAILED',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_DATA_CORRUPTED: 'STORAGE_DATA_CORRUPTED',

  // UI 介面
  UI_COMPONENT_INIT_FAILED: 'UI_COMPONENT_INIT_FAILED',
  UI_RENDER_FAILED: 'UI_RENDER_FAILED',
  UI_USER_INPUT_INVALID: 'UI_USER_INPUT_INVALID',
  UI_EVENT_HANDLER_FAILED: 'UI_EVENT_HANDLER_FAILED',

  // 匯出功能
  EXPORT_OPERATION_FAILED: 'EXPORT_OPERATION_FAILED',
  EXPORT_FORMAT_UNSUPPORTED: 'EXPORT_FORMAT_UNSUPPORTED',
  EXPORT_FILE_CREATION_FAILED: 'EXPORT_FILE_CREATION_FAILED',
  EXPORT_DOWNLOAD_TIMEOUT: 'EXPORT_DOWNLOAD_TIMEOUT',

  // 系統核心
  SYSTEM_INITIALIZATION_FAILED: 'SYSTEM_INITIALIZATION_FAILED',
  SYSTEM_CONFIGURATION_ERROR: 'SYSTEM_CONFIGURATION_ERROR',
  SYSTEM_SERVICE_UNAVAILABLE: 'SYSTEM_SERVICE_UNAVAILABLE',
  METHOD_NOT_IMPLEMENTED: 'METHOD_NOT_IMPLEMENTED',

  // Chrome Extension 平台
  CHROME_PERMISSION_DENIED: 'CHROME_PERMISSION_DENIED',
  CHROME_API_UNAVAILABLE: 'CHROME_API_UNAVAILABLE',
  CHROME_CONTEXT_INVALIDATED: 'CHROME_CONTEXT_INVALIDATED',

  // 保留用於遷移期
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
}

module.exports = { ErrorCodes }
```

### 為什麼這個方案是最佳選擇

#### ✅ 完全解決核心問題
```javascript
// ❌ 之前：容易拼錯的魔法字串
if (error.code === 'BOOK_VALIDATON_FAILED') { ... }  // 拼錯了

// ✅ 現在：IDE 自動完成，不可能拼錯
if (error.code === ErrorCodes.BOOK_VALIDATION_FAILED) { ... }
```

#### ✅ 零學習成本
- 任何 JavaScript 開發者都能立即理解
- 不需要文件或培訓
- 沒有抽象層或複雜概念

#### ✅ 完美的工具支援
- **IDE 自動完成** - 輸入 `ErrorCodes.` 就能看到所有選項
- **重構工具支援** - 可以安全地重新命名錯誤代碼
- **搜尋友善** - `grep "BOOK_VALIDATION_FAILED"` 找到所有使用處
- **型別檢查** - undefined property 會被捕捉為編譯錯誤

#### ✅ 除錯友善
```javascript
// 日誌直接可讀，不需要查表
console.error(`Error occurred: ${error.code}`)
// 輸出: Error occurred: BOOK_VALIDATION_FAILED
```

#### ✅ 零效能負擔
- 字串常量在執行時就是字串
- 沒有額外的查找或轉換
- 記憶體佔用和直接使用字串完全相同

## 🔄 實施指引

### 使用方式

#### 1. 引入錯誤代碼
```javascript
const { ErrorCodes } = require('src/core/errors/ErrorCodes')
const { StandardError } = require('src/core/errors/StandardError')
```

#### 2. 拋出錯誤
```javascript
// ✅ 正確使用
throw new StandardError(
  ErrorCodes.BOOK_VALIDATION_FAILED,
  '書籍資料驗證失敗',
  { bookId: 123, missingField: 'title' }
)
```

#### 3. 錯誤處理
```javascript
// ✅ 錯誤比對
try {
  validateBookData(book)
} catch (error) {
  if (error.code === ErrorCodes.BOOK_VALIDATION_FAILED) {
    // 處理書籍驗證失敗
    console.log('書籍驗證失敗:', error.details)
  }
}
```

### 新增錯誤代碼流程

1. **識別需求** - 確認需要新的錯誤代碼
2. **選擇模組** - 決定屬於哪個模組 (BOOK_, NETWORK_, 等)
3. **添加常量** - 在 ErrorCodes.js 中添加新項目
4. **立即使用** - 在程式碼中使用新的常量

## 📈 遷移策略

### 分階段遷移

#### 第一階段：建立常量定義 (1天)
1. 創建 `src/core/errors/ErrorCodes.js`
2. 定義所有現有的錯誤代碼作為常量
3. 寫簡單的單元測試驗證常量存在

#### 第二階段：逐步遷移使用 (1週)
1. **新程式碼優先** - 所有新程式碼必須使用 ErrorCodes
2. **修改現有檔案** - 每次修改檔案時順便遷移
3. **批量替換工具** - 使用 IDE 的批量替換功能

#### 第三階段：清理和驗證 (2天)
1. **ESLint 規則** - 禁止直接使用錯誤代碼字串
2. **自動化檢查** - 確保沒有遺留的魔法字串
3. **移除不用的錯誤代碼** - 清理 UNKNOWN_ERROR 等

### 遷移工具

#### 半自動化遷移腳本
```bash
#!/bin/bash
# migrate-error-codes.sh - 協助快速遷移

echo "=== 尋找需要遷移的錯誤代碼 ==="
grep -r "new StandardError(\s*['\"]" src/ --include="*.js" | head -20

echo ""
echo "=== 建議的替換 ==="
echo "手動檢查每個錯誤的上下文，然後使用 IDE 的批量替換："
echo "1. 找到: throw new StandardError('BOOK_INVALID'"
echo "   替換: throw new StandardError(ErrorCodes.BOOK_VALIDATION_FAILED"
echo "2. 確認每個檔案都有: const { ErrorCodes } = require('src/core/errors/ErrorCodes')"
```

## 🔍 品質保證

### ESLint 規則
```javascript
// .eslintrc.js
rules: {
  // 禁止魔法字串錯誤代碼
  'no-magic-strings-in-standard-error': 'error'
}
```

### 單元測試
```javascript
// tests/unit/errors/error-codes.test.js
describe('ErrorCodes', () => {
  it('should have all required error codes defined', () => {
    expect(ErrorCodes.BOOK_VALIDATION_FAILED).toBe('BOOK_VALIDATION_FAILED')
    expect(ErrorCodes.NETWORK_TIMEOUT).toBe('NETWORK_TIMEOUT')
    // ... 測試所有錯誤代碼
  })

  it('should not have duplicate values', () => {
    const values = Object.values(ErrorCodes)
    const uniqueValues = [...new Set(values)]
    expect(values.length).toBe(uniqueValues.length)
  })
})
```

### 自動化驗證
```bash
# 檢查是否還有魔法字串
grep -r "new StandardError(\s*['\"]" src/ && echo "❌ 發現魔法字串" || echo "✅ 無魔法字串"

# 檢查錯誤代碼一致性
node scripts/validate-error-codes.js
```

## 📊 成功指標

### 技術指標
- **魔法字串消除**: 專案中 0 個直接字串錯誤代碼
- **IDE 支援**: 100% 錯誤代碼使用 IDE 自動完成
- **重構安全**: 錯誤代碼重新命名不會遺漏任何地方

### 實用指標
- **開發體驗**: 開發者不再因為錯誤代碼拼寫錯誤而調試
- **維護效率**: 新增錯誤代碼從找遍所有檔案變成只修改一個檔案
- **代碼品質**: 錯誤處理邏輯更加可靠和一致

## 🔗 相關文件

- [StandardError 核心架構](./error-handling-overview.md)
- [錯誤處理最佳實踐](../claude/format-fix-examples.md)
- [ESLint 錯誤處理規則](../claude/eslint-error-handling-rules.md)

---

## 📝 版本更新記錄

### v4.0.0 (2025-09-16)
**最終實用方案** - 簡單字串常量

**核心理念**：
- 🎯 **解決實際問題**: 消除魔法字串拼寫錯誤
- 🛠️ **最小複雜度**: 用最簡單的機制達成目標
- 💡 **好品味原則**: 不過度工程化，專注解決問題

**技術決策**：
- 採用字串常量 (`BOOK_VALIDATION_FAILED: 'BOOK_VALIDATION_FAILED'`)
- 完全的 IDE 支援和重構安全性
- 人類可讀的日誌輸出
- 零執行時效能負擔
- 零學習成本

**優勢總結**：
- ✅ 完全消除拼寫錯誤風險
- ✅ IDE 自動完成和重構支援
- ✅ 搜尋和除錯友善
- ✅ 零複雜度，任何開發者都能理解
- ✅ 無需文件或培訓

### v3.0.0 (2025-09-16)
**數字代碼方案** - 已廢棄
- 過度複雜化，解決不存在的效能問題

### v2.0.0 (2025-09-16)
**簡化字串方案** - 已被取代
- 使用縮寫，不符合可讀性要求

### v1.0.0 (2025-09-16)
**初始四層方案** - 已廢棄
- 過度設計，不實用

---

**文件版本**: v4.0.0
**最後更新**: 2025-09-16
**下次審查**: 2025-10-01
**狀態**: ✅ 最終方案，準備實施