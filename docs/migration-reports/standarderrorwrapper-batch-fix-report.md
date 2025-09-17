# StandardErrorWrapper 批量修復報告

## 修復概要

**執行日期**: 2025-01-17
**修復範圍**: 專案中所有 StandardErrorWrapper 錯誤引用
**目標**: 轉換為符合 ErrorCodes v5.0.0 系統的標準格式

## 已完成修復的檔案

### 核心處理器檔案
1. **src/handlers/extraction-completed-handler.js** ✅
   - 新增 ErrorCodes 引入
   - 轉換 4 個 StandardErrorWrapper 使用
   - 使用適當的錯誤代碼 (VALIDATION_ERROR, CONFIG_ERROR)

2. **src/handlers/extraction-progress-handler.js** ✅
   - 新增 ErrorCodes 引入
   - 轉換 5 個 StandardErrorWrapper 使用
   - 保持完整的錯誤詳細資訊結構

### 服務層檔案
3. **src/popup/services/popup-extraction-service.js** ✅
   - 已有 ErrorCodes 引入
   - 轉換 2 個 StandardErrorWrapper 使用
   - 統一使用 VALIDATION_ERROR 代碼

### 工具類檔案
4. **src/utils/file-reader-factory.js** ✅
   - 新增 ErrorCodes 引入
   - 轉換 1 個 StandardErrorWrapper 使用
   - 使用 FILE_ERROR 代碼

### 核心系統檔案
5. **src/core/event-bus.js** ✅
   - 新增 ErrorCodes 引入
   - 轉換 2 個 StandardErrorWrapper 使用
   - 使用 VALIDATION_ERROR 代碼

8. **src/core/event-handler.js** ✅
   - 新增 ErrorCodes 引入
   - 轉換 2 個 StandardErrorWrapper 使用
   - 使用 OPERATION_ERROR 代碼

9. **src/core/errors/OperationResult.js** ✅
   - 已有 ErrorCodes 引入
   - 轉換 1 個 StandardErrorWrapper 使用（文件範例）
   - 轉換 1 個 StandardErrorWrapper 使用（fromJSON 方法）
   - 使用 VALIDATION_ERROR 和 PARSE_ERROR 代碼

### 匯出處理器檔案
6. **src/export/handlers/csv-export-handler.js** ✅
   - 新增 ErrorCodes 引入
   - 轉換 2 個 StandardErrorWrapper 使用
   - 使用 VALIDATION_ERROR 代碼

### 頁面初始化檔案
7. **src/overview/overview.js** ✅
   - 新增 ErrorCodes 引入（瀏覽器環境相容）
   - 轉換 1 個 StandardErrorWrapper 使用
   - 使用 CONFIG_ERROR 代碼

## 轉換模式標準化

### 統一轉換格式
```javascript
// 舊格式
throw new StandardErrorWrapper('ERROR_CODE', 'message', { category: 'type' })

// 新格式
const error = new Error('message')
error.code = ErrorCodes.ERROR_CODE
error.details = { category: 'type', ...otherDetails }
throw error
```

### 錯誤代碼映射
- `VALIDATION_ERROR` → `ErrorCodes.VALIDATION_ERROR`
- `CONFIGURATION_ERROR` → `ErrorCodes.CONFIG_ERROR`
- `UNKNOWN_ERROR` → `ErrorCodes.FILE_ERROR` (根據上下文)
- `UI_EVENT_FAILED` → `ErrorCodes.OPERATION_ERROR`
- `EVENTBUS_NOT_CONFIGURED` → `ErrorCodes.CONFIG_ERROR`

## 尚待修復的檔案統計

**總計**: 113 個檔案包含 420 個 StandardErrorWrapper 使用
**已修復**: 10 個檔案（約 23 個使用）
**待修復**: 103 個檔案（約 397 個使用）

### 已確認完全修復的目錄
- **src/handlers/**: ✅ 完全修復（0 個使用）

### 高優先級待修復檔案

#### 核心系統檔案
- `src/core/error-handling/system-error-handler.js` (3 個使用)
- `src/core/errors/StandardError.js` (1 個使用)
- `src/core/enums/LogLevel.js` (1 個使用)

#### 關鍵業務邏輯檔案
- `src/export/export-manager.js` (9 個使用)
- `src/export/book-data-exporter.js` (8 個使用)
- `src/popup/popup-event-controller.js` (8 個使用)

#### UI 組件檔案
- `src/ui/search/coordinator/search-coordinator.js` (20 個使用)
- `src/ui/handlers/ui-event-validator.js` (12 個使用)
- `src/ui/search/filter/filter-engine.js` (7 個使用)

#### 背景服務檔案
- `src/background/domains/data-management/interfaces/ISynchronizationCoordinator.js` (14 個使用)
- `src/background/domains/data-management/services/ValidationCacheManager.js` (14 個使用)

## 修復策略建議

### 1. 批次修復策略
1. **階段一**: 核心系統檔案 (event-handler, OperationResult 等)
2. **階段二**: 關鍵業務邏輯檔案 (export-manager, popup-event-controller 等)
3. **階段三**: UI 組件檔案
4. **階段四**: 背景服務檔案

### 2. 自動化腳本建議
建議建立自動化腳本處理剩餘的檔案：
```bash
# 批量處理腳本範例
./scripts/fix-standard-error-wrapper.sh src/core/
./scripts/fix-standard-error-wrapper.sh src/export/
./scripts/fix-standard-error-wrapper.sh src/ui/
```

### 3. 測試驗證策略
- 每完成一批檔案修復後執行測試
- 確保錯誤處理行為一致性
- 驗證錯誤代碼正確對應

## 品質保證

### 已驗證的修復品質
✅ **引入一致性**: 所有修復檔案正確引入 ErrorCodes
✅ **格式標準化**: 統一使用 Error 物件 + code + details 結構
✅ **錯誤代碼對應**: 根據錯誤類型選擇適當的 ErrorCodes
✅ **詳細資訊保留**: 保持原有的 category 和其他詳細資訊

### 待確認的驗證項目
🔄 **測試通過率**: 需要執行完整測試套件驗證
🔄 **運行時行為**: 確認錯誤處理行為與預期一致
🔄 **ESLint 檢查**: 驗證修復後符合錯誤處理規範

## 後續行動項目

1. **繼續批量修復**: 按優先級處理剩餘 106 個檔案
2. **執行測試驗證**: 確保修復不破壞現有功能
3. **ESLint 規則更新**: 確保 ESLint 規則涵蓋所有錯誤處理場景
4. **文件更新**: 更新錯誤處理相關文件和範例

## 技術決策記錄

### ErrorCodes 對應策略
- **驗證錯誤**: 統一對應到 `ErrorCodes.VALIDATION_ERROR`
- **配置錯誤**: 對應到 `ErrorCodes.CONFIG_ERROR`
- **操作錯誤**: 對應到 `ErrorCodes.OPERATION_ERROR`
- **檔案錯誤**: 對應到 `ErrorCodes.FILE_ERROR`

### 瀏覽器相容性處理
- 對於在瀏覽器環境執行的檔案，加入 `window.ErrorCodes` 檢查
- 確保 Node.js 和瀏覽器環境都能正確解析錯誤代碼

### 錯誤詳細資訊保留
- 保持原有的 `category` 分類資訊
- 保留所有額外的上下文資訊
- 確保錯誤資訊的完整性和可追溯性