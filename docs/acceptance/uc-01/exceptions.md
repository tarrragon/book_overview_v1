# UC-01: 首次安裝與設定 - Exception 規格

## 🎯 Use Case 概述
**UC-01**: 使用者第一次安裝和使用 Extension，包含歡迎流程、首次資料提取、Overview 頁面初始化

## 🚨 StandardError 定義清單

### 1. DOM_ERROR: 頁面元素解析錯誤

#### DOM_READMOO_PAGE_NOT_DETECTED
```javascript
new StandardError('DOM_READMOO_PAGE_NOT_DETECTED', '無法檢測到 Readmoo 書庫頁面', {
  severity: 'SEVERE',
  currentUrl: window.location.href,
  expectedPatterns: ['readmoo.com/library', 'readmoo.com/shelf'],
  detectedElements: []
})
```
**觸發條件**:
- 使用者不在 Readmoo 書庫頁面上點擊 Extension
- 頁面 URL 不符合預期模式
- 關鍵頁面元素無法定位

**使用者體驗**:
- 顯示友善提示：「請先前往 Readmoo 書庫頁面，再使用書籍提取功能」
- 提供「前往 Readmoo 書庫」按鈕
- 說明正確的使用步驟

#### DOM_BOOK_ELEMENTS_NOT_FOUND
```javascript
new StandardError('DOM_BOOK_ELEMENTS_NOT_FOUND', '頁面中找不到書籍元素', {
  severity: 'MODERATE',
  searchSelectors: ['.book-item', '.library-book', '[data-book-id]'],
  pageStructureChanged: true,
  fallbackAttempted: false
})
```
**觸發條件**:
- Readmoo 頁面結構更新，書籍元素選擇器失效
- 頁面載入不完整，書籍尚未渲染
- 使用者書庫為空

**使用者體驗**:
- 「正在嘗試不同的頁面解析方式...」
- 提供重新整理頁面建議
- 如果確實無書籍，顯示「您的書庫目前沒有書籍」

#### DOM_EXTRACTION_PARTIAL_FAILURE
```javascript
new StandardError('DOM_EXTRACTION_PARTIAL_FAILURE', '部分書籍資料提取失敗', {
  severity: 'MINOR',
  totalBooks: 50,
  successfulExtractions: 47,
  failedBooks: [
    { index: 12, reason: 'missing_title' },
    { index: 28, reason: 'missing_cover' },
    { index: 35, reason: 'invalid_progress' }
  ]
})
```
**觸發條件**:
- 個別書籍的資料欄位缺失或格式異常
- 書籍封面圖片無法載入
- 閱讀進度資料格式錯誤

**使用者體驗**:
- 「成功提取 47 本書籍，3 本書籍資料不完整」
- 提供詳細報告查看選項
- 說明不影響主要功能使用

### 2. NETWORK_ERROR: 網路連接錯誤

#### NETWORK_READMOO_UNREACHABLE
```javascript
new StandardError('NETWORK_READMOO_UNREACHABLE', 'Readmoo 服務暫時無法連接', {
  severity: 'SEVERE',
  endpoint: 'readmoo.com',
  timeout: 5000,
  retryCount: 3,
  lastError: 'net::ERR_INTERNET_DISCONNECTED'
})
```
**觸發條件**:
- 網路連接中斷
- Readmoo 服務器維護或故障
- 防火牆或代理服務器阻擋

**使用者體驗**:
- 「網路連接有問題，請檢查網路後重試」
- 提供「重試」和「離線模式」選項
- 顯示網路狀態檢測結果

#### NETWORK_SLOW_CONNECTION
```javascript
new StandardError('NETWORK_SLOW_CONNECTION', '網路連接緩慢，載入時間過長', {
  severity: 'MINOR',
  loadTime: 15000,
  threshold: 10000,
  suggestOfflineMode: true
})
```
**觸發條件**:
- 頁面載入時間超過 10 秒
- 書籍圖片載入緩慢
- API 回應時間過長

**使用者體驗**:
- 顯示載入進度條
- 「網路較慢，建議切換到輕量模式」
- 提供跳過圖片載入選項

### 3. SYSTEM_ERROR: 系統資源錯誤

#### SYSTEM_STORAGE_QUOTA_EXCEEDED
```javascript
new StandardError('SYSTEM_STORAGE_QUOTA_EXCEEDED', 'Extension 儲存空間不足', {
  severity: 'SEVERE',
  currentUsage: 4.8,
  maxQuota: 5.0,
  unit: 'MB',
  suggestedActions: ['清理舊資料', '匯出後刪除', '升級儲存方案']
})
```
**觸發條件**:
- Chrome Extension 儲存空間達到限制
- 嘗試儲存首次提取的大量書籍資料時失敗

**使用者體驗**:
- 「儲存空間已滿，需要清理部分資料」
- 提供一鍵清理工具
- 建議匯出資料後清空

#### SYSTEM_MEMORY_PRESSURE
```javascript
new StandardError('SYSTEM_MEMORY_PRESSURE', '系統記憶體不足，處理大量書籍時發生錯誤', {
  severity: 'MODERATE',
  booksToProcess: 500,
  memoryUsage: '85%',
  suggestedBatchSize: 50
})
```
**觸發條件**:
- 使用者書庫有大量書籍（>300本）
- 系統記憶體不足
- 瀏覽器標籤頁過多

**使用者體驗**:
- 「您的書庫書籍較多，將分批處理以確保穩定性」
- 顯示分批處理進度
- 建議關閉其他標籤頁

### 4. PLATFORM_ERROR: 平台相容性錯誤

#### PLATFORM_EXTENSION_PERMISSIONS_DENIED
```javascript
new StandardError('PLATFORM_EXTENSION_PERMISSIONS_DENIED', 'Extension 權限不足', {
  severity: 'CRITICAL',
  requiredPermissions: ['activeTab', 'storage'],
  missingPermissions: ['activeTab'],
  chromeVersion: '120.0.6099.129'
})
```
**觸發條件**:
- 使用者拒絕了 Extension 權限請求
- Chrome 版本不支援某些 API
- Extension 安裝不完整

**使用者體驗**:
- 「需要重新授權 Extension 權限」
- 提供詳細的權限說明
- 引導使用者到 Extension 管理頁面

#### PLATFORM_MANIFEST_V3_COMPATIBILITY
```javascript
new StandardError('PLATFORM_MANIFEST_V3_COMPATIBILITY', 'Chrome Extension API 相容性問題', {
  severity: 'MODERATE',
  apiUsed: 'chrome.storage.local',
  alternativeAvailable: true,
  chromeVersion: '88.0.4324.150'
})
```
**觸發條件**:
- 舊版 Chrome 不支援 Manifest V3
- 使用了不相容的 API
- Service Worker 啟動失敗

**使用者體驗**:
- 「您的 Chrome 版本較舊，建議更新以獲得最佳體驗」
- 提供 Chrome 更新連結
- 啟用相容模式（如可用）

### 5. DATA_ERROR: 資料處理錯誤

#### DATA_INITIAL_STORAGE_CORRUPTION
```javascript
new StandardError('DATA_INITIAL_STORAGE_CORRUPTION', '初始化儲存資料時發現損壞', {
  severity: 'MODERATE',
  corruptedData: { books: null, settings: 'invalid_json' },
  recoveryAttempted: true,
  backupAvailable: false
})
```
**觸發條件**:
- 首次使用時發現殘留的損壞資料
- JSON 解析失敗
- 資料格式版本不相容

**使用者體驗**:
- 「偵測到損壞的資料，正在清理並重新初始化」
- 自動執行資料修復
- 確認清理完成後繼續

#### DATA_BOOK_VALIDATION_FAILED
```javascript
new StandardError('DATA_BOOK_VALIDATION_FAILED', '書籍資料格式驗證失敗', {
  severity: 'MINOR',
  invalidBooks: [
    { id: 'invalid_id_format', errors: ['missing_title', 'invalid_progress'] },
    { id: 'book_456', errors: ['malformed_url'] }
  ],
  totalProcessed: 25,
  validBooks: 23
})
```
**觸發條件**:
- 提取的書籍資料不符合預期格式
- 必要欄位缺失或類型錯誤
- 資料內容邏輯矛盾

**使用者體驗**:
- 「發現 2 本書籍的資料需要修正，其他書籍正常」
- 提供資料修正建議
- 允許跳過問題書籍繼續處理

## 🔗 錯誤關聯分析

### 錯誤鏈模式
1. **NETWORK_ERROR** → **DOM_ERROR**: 網路問題導致頁面載入不完整
2. **PLATFORM_ERROR** → **SYSTEM_ERROR**: 權限問題導致儲存失敗
3. **DOM_ERROR** → **DATA_ERROR**: 頁面解析錯誤導致資料格式異常

### 恢復策略優先級
1. **CRITICAL/SEVERE**: 立即中斷流程，要求使用者介入
2. **MODERATE**: 提供多種解決方案，允許使用者選擇
3. **MINOR**: 自動處理，記錄日誌但不中斷流程

## 📊 預期錯誤頻率
- **DOM_ERROR**: 15% (主要因為 Readmoo 頁面更新)
- **NETWORK_ERROR**: 8% (網路連接問題)
- **SYSTEM_ERROR**: 5% (儲存空間限制)
- **PLATFORM_ERROR**: 3% (相容性問題)
- **DATA_ERROR**: 12% (資料格式多樣性)