# UC-04: 資料匯入與恢復 - Exception 規格

## 🎯 Use Case 概述
**UC-04**: 使用者從 JSON 檔案載入書籍資料，包含資料驗證、格式轉換和去重處理。

## 🚨 核心 StandardError 清單

### DATA_IMPORT_FILE_INVALID
```javascript
new StandardError('DATA_IMPORT_FILE_INVALID', '匯入檔案格式無效', {
  severity: 'SEVERE',
  fileName: 'invalid-backup.json',
  fileSize: '500KB',
  validationErrors: [
    { field: 'books', issue: 'not_array' },
    { field: 'metadata.version', issue: 'missing_required' }
  ],
  suggestedAction: 'select_valid_backup'
})
```
**觸發條件**: 檔案不是有效 JSON、資料結構不符合、版本不相容

### DATA_IMPORT_PARSING_ERROR
```javascript
new StandardError('DATA_IMPORT_PARSING_ERROR', 'JSON 檔案解析錯誤', {
  severity: 'SEVERE',
  parseError: 'SyntaxError: Unexpected token',
  errorPosition: { line: 45, column: 12 },
  fileSize: '1.2MB',
  possibleCause: 'file_corruption'
})
```
**觸發條件**: JSON 語法錯誤、檔案損壞、編碼問題

### DATA_IMPORT_MERGE_CONFLICT
```javascript
new StandardError('DATA_IMPORT_MERGE_CONFLICT', '資料合併時發生衝突', {
  severity: 'MODERATE',
  conflictType: 'duplicate_books_with_different_progress',
  conflictedBooks: [
    {
      id: 'book_123',
      existing: { progress: '75%', lastRead: '2025-01-10' },
      importing: { progress: '60%', lastRead: '2025-01-08' }
    }
  ],
  mergeStrategy: 'user_decision_required'
})
```
**觸發條件**: 相同書籍不同進度、資料時間戳衝突、設定偏好不一致

### SYSTEM_IMPORT_STORAGE_OVERFLOW
```javascript
new StandardError('SYSTEM_IMPORT_STORAGE_OVERFLOW', '匯入資料將超出儲存限制', {
  severity: 'SEVERE',
  existingDataSize: '3.2MB',
  importDataSize: '2.8MB',
  totalSize: '6.0MB',
  storageLimit: '5.0MB',
  suggestedActions: ['clear_old_data', 'selective_import']
})
```
**觸發條件**: 儲存空間不足、大型備份檔案、累積資料過多