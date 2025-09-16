# UC-02: 日常書籍資料提取 - Exception 規格

## 🎯 Use Case 概述
**UC-02**: 使用者定期提取新增的書籍資料，包含新書籍檢測、增量更新、進度同步和去重處理。

## 🚨 StandardError 定義清單

### 1. DATA_ERROR: 資料處理和去重錯誤

#### DATA_DUPLICATE_DETECTION_FAILED
```javascript
new StandardError('DATA_DUPLICATE_DETECTION_FAILED', '重複書籍檢測機制失敗', {
  severity: 'MODERATE',
  totalBooksScanned: 25,
  duplicateChecksFailed: 3,
  affectedBooks: [
    { id: 'book_123', reason: 'unstable_id_generation' },
    { id: 'book_456', reason: 'metadata_mismatch' }
  ],
  fallbackStrategy: 'manual_review'
})
```
**觸發條件**:
- 書籍 ID 生成邏輯不穩定，同一本書產生不同 ID
- 書籍 metadata 在不同時間提取時有所變化
- 去重算法無法正確識別相同書籍

**使用者體驗**:
- 「檢測到 3 本書籍的重複狀態需要確認」
- 提供並排比較介面讓使用者手動判斷
- 記錄使用者的判斷結果以改善算法

#### DATA_INCREMENTAL_UPDATE_CONFLICT
```javascript
new StandardError('DATA_INCREMENTAL_UPDATE_CONFLICT', '增量更新時發生資料衝突', {
  severity: 'MODERATE',
  conflictType: 'progress_mismatch',
  conflictedBooks: [
    {
      id: 'book_789',
      storedProgress: '45%',
      newProgress: '40%',
      lastUpdate: '2025-01-10',
      conflictReason: 'progress_regression'
    }
  ],
  suggestedResolution: 'keep_higher_progress'
})
```
**觸發條件**:
- 新提取的閱讀進度低於已儲存的進度
- 書籍 metadata 在不同設備間有差異
- 時間戳記顯示資料異常

**使用者體驗**:
- 「發現 1 本書籍的進度有衝突，建議保留較高進度」
- 顯示衝突詳情和建議處理方式
- 允許使用者選擇保留策略

#### DATA_PROGRESS_VALIDATION_ERROR
```javascript
new StandardError('DATA_PROGRESS_VALIDATION_ERROR', '閱讀進度格式驗證失敗', {
  severity: 'MINOR',
  invalidProgressData: [
    { bookId: 'book_321', progress: '150%', issue: 'exceeds_maximum' },
    { bookId: 'book_654', progress: 'chapter 5', issue: 'non_numeric_format' },
    { bookId: 'book_987', progress: null, issue: 'missing_data' }
  ],
  correctionAttempted: true,
  correctedCount: 2
})
```
**觸發條件**:
- 進度百分比超過 100% 或為負數
- 進度格式非數字（如章節描述）
- 進度資料完全缺失

**使用者體驗**:
- 「已自動修正 2 本書籍的進度格式，1 本需要手動確認」
- 顯示修正詳情和原始資料
- 提供手動輸入正確進度的選項

### 2. DOM_ERROR: 頁面變化和元素定位錯誤

#### DOM_PAGE_STRUCTURE_CHANGED
```javascript
new StandardError('DOM_PAGE_STRUCTURE_CHANGED', 'Readmoo 頁面結構已更新，需要適應新版面', {
  severity: 'MODERATE',
  detectedChanges: [
    { element: '.book-item', status: 'selector_deprecated' },
    { element: '.progress-bar', status: 'class_renamed' },
    { element: '[data-book-id]', status: 'attribute_changed' }
  ],
  adaptationAttempted: true,
  fallbackSelectorsUsed: ['.library-book', '.reading-progress']
})
```
**觸發條件**:
- Readmoo 更新了頁面的 CSS 類別或結構
- 原有的元素選擇器無法找到目標
- 新版面增加了反爬蟲措施

**使用者體驗**:
- 「Readmoo 頁面有更新，正在適應新版面...」
- 顯示適應進度和成功/失敗的選擇器
- 建議使用者反饋是否有功能異常

#### DOM_INFINITE_SCROLL_DETECTION_FAILED
```javascript
new StandardError('DOM_INFINITE_SCROLL_DETECTION_FAILED', '無法正確處理無限滾動載入', {
  severity: 'MODERATE',
  expectedBooks: 150,
  loadedBooks: 50,
  scrollAttempts: 5,
  lastScrollTime: '2025-01-15T10:30:00Z',
  possibleCauses: ['network_slow', 'scroll_handler_changed', 'rate_limiting']
})
```
**觸發條件**:
- Readmoo 使用無限滾動載入書籍，但載入機制失效
- 網路速度太慢導致新內容載入不完整
- 頁面實施了載入頻率限制

**使用者體驗**:
- 「檢測到您有更多書籍，正在載入剩餘內容...」
- 顯示載入進度和預估時間
- 提供手動重試或跳過選項

#### DOM_DYNAMIC_CONTENT_TIMEOUT
```javascript
new StandardError('DOM_DYNAMIC_CONTENT_TIMEOUT', '動態內容載入超時', {
  severity: 'MINOR',
  timeoutDuration: 15000,
  waitingFor: 'book_covers_and_metadata',
  partiallyLoaded: true,
  loadedElements: 45,
  totalElements: 50
})
```
**觸發條件**:
- 書籍封面圖片載入緩慢
- 部分書籍的 metadata 需要額外的 AJAX 請求
- 網路連接不穩定導致間歇性載入

**使用者體驗**:
- 「大部分書籍已載入完成，少數封面仍在載入中」
- 提供「繼續等待」或「跳過缺失內容」選項
- 說明不會影響核心資料的完整性

### 3. SYSTEM_ERROR: 效能和資源管理錯誤

#### SYSTEM_INCREMENTAL_PROCESSING_OVERLOAD
```javascript
new StandardError('SYSTEM_INCREMENTAL_PROCESSING_OVERLOAD', '增量處理負載過高', {
  severity: 'MODERATE',
  newBooksDetected: 25,
  existingBooksToUpdate: 180,
  totalProcessingLoad: 205,
  systemCapacity: 150,
  recommendedBatchSize: 50
})
```
**觸發條件**:
- 使用者長時間未使用，累積大量新書籍
- 系統需要同時處理新書籍和進度更新
- 記憶體或處理能力不足以一次性處理所有變更

**使用者體驗**:
- 「檢測到大量更新，將分批處理以確保穩定性」
- 顯示分批處理進度條
- 提供暫停和恢復選項

#### SYSTEM_BACKGROUND_SYNC_FAILURE
```javascript
new StandardError('SYSTEM_BACKGROUND_SYNC_FAILURE', '背景同步處理失敗', {
  severity: 'MINOR',
  syncType: 'progress_update',
  failedOperations: ['cover_cache_update', 'metadata_refresh'],
  retryScheduled: true,
  nextRetryTime: '2025-01-15T11:00:00Z'
})
```
**觸發條件**:
- 背景程序執行期間遇到錯誤
- 快取更新失敗
- 系統資源不足導致背景任務被終止

**使用者體驗**:
- 在背景靜默處理，不中斷使用者操作
- 記錄問題並排程重試
- 如果多次失敗才顯示通知

### 4. NETWORK_ERROR: 網路和連接錯誤

#### NETWORK_RATE_LIMITING_DETECTED
```javascript
new StandardError('NETWORK_RATE_LIMITING_DETECTED', '檢測到 Readmoo 頻率限制', {
  severity: 'MODERATE',
  requestsInWindow: 50,
  rateLimit: 30,
  timeWindow: '60s',
  backoffDelay: 120000,
  adaptiveStrategy: 'exponential_backoff'
})
```
**觸發條件**:
- Readmoo 實施了 API 或頁面訪問頻率限制
- 快速連續的資料提取觸發反爬蟲機制
- 同時有多個使用者在相同 IP 使用類似工具

**使用者體驗**:
- 「Readmoo 限制了訪問頻率，將自動調整提取速度」
- 顯示等待時間倒數
- 說明這是正常的保護機制

#### NETWORK_PARTIAL_CONNECTIVITY
```javascript
new StandardError('NETWORK_PARTIAL_CONNECTIVITY', '網路連接不穩定，部分請求失敗', {
  severity: 'MINOR',
  successfulRequests: 42,
  failedRequests: 8,
  failureRate: 0.16,
  networkJitter: 'high',
  retryStrategy: 'smart_retry_with_jitter'
})
```
**觸發條件**:
- 網路連接間歇性中斷
- 部分請求成功，部分失敗
- 網路延遲波動很大

**使用者體驗**:
- 「網路不太穩定，正在重試失敗的請求...」
- 顯示成功/失敗統計
- 提供穩定性建議（如關閉其他下載）

### 5. PLATFORM_ERROR: 瀏覽器和平台錯誤

#### PLATFORM_TAB_SWITCHING_INTERFERENCE
```javascript
new StandardError('PLATFORM_TAB_SWITCHING_INTERFERENCE', '分頁切換影響資料提取', {
  severity: 'MINOR',
  tabSwitchDetected: true,
  extractionPaused: true,
  resumeStrategy: 'continue_from_last_position',
  affectedOperations: ['dom_scanning', 'progress_reading']
})
```
**觸發條件**:
- 使用者在提取過程中切換到其他分頁
- 瀏覽器將 Readmoo 分頁設為非活動狀態
- 某些 DOM 操作在非活動分頁中被限制

**使用者體驗**:
- 「檢測到分頁切換，已暫停提取以避免錯誤」
- 提供一鍵恢復按鈕
- 建議在提取期間保持在 Readmoo 分頁

#### PLATFORM_CHROME_EXTENSION_CONFLICT
```javascript
new StandardError('PLATFORM_CHROME_EXTENSION_CONFLICT', '檢測到其他擴充功能的衝突', {
  severity: 'MODERATE',
  conflictingExtensions: [
    { name: 'AdBlocker Plus', interference: 'dom_modification' },
    { name: 'Dark Reader', interference: 'css_override' }
  ],
  workaroundApplied: true,
  successRate: 0.85
})
```
**觸發條件**:
- 其他擴充功能修改了頁面 DOM 結構
- 廣告攔截器影響頁面元素載入
- 主題擴充功能改變了 CSS 選擇器

**使用者體驗**:
- 「檢測到其他擴充功能可能影響提取效果」
- 顯示受影響的擴充功能清單
- 提供暫時停用建議和解決方案

## 🔗 錯誤關聯分析

### UC-02 特有的錯誤鏈
1. **NETWORK_RATE_LIMITING** → **DOM_DYNAMIC_CONTENT_TIMEOUT**: 頻率限制導致內容載入超時
2. **DOM_PAGE_STRUCTURE_CHANGED** → **DATA_DUPLICATE_DETECTION_FAILED**: 頁面變化影響去重算法
3. **SYSTEM_INCREMENTAL_PROCESSING_OVERLOAD** → **PLATFORM_TAB_SWITCHING_INTERFERENCE**: 系統負載高時更容易受分頁切換影響

### 與 UC-01 的錯誤傳承
- **DOM_READMOO_PAGE_NOT_DETECTED** 問題延續到 UC-02
- **SYSTEM_STORAGE_QUOTA_EXCEEDED** 在增量更新時可能再次觸發
- **DATA_VALIDATION** 錯誤模式的學習和改善

### 恢復策略優先級
1. **DATA_ERROR**: 優先保護現有資料完整性
2. **DOM_ERROR**: 嘗試多種適應策略
3. **SYSTEM_ERROR**: 調整處理策略，降低負載
4. **NETWORK_ERROR**: 智慧重試和頻率控制
5. **PLATFORM_ERROR**: 提供使用者指導和自動解決方案

## 📊 預期錯誤頻率
- **DATA_ERROR**: 20% (去重和增量更新的複雜性)
- **DOM_ERROR**: 25% (Readmoo 頁面更新頻繁)
- **SYSTEM_ERROR**: 10% (主要在大量書籍時)
- **NETWORK_ERROR**: 15% (網路環境變化)
- **PLATFORM_ERROR**: 8% (擴充功能生態複雜性)