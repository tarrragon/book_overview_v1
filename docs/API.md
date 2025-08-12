# 📚 API 文件

**版本**: v0.5.23  
**最後更新**: 2025-08-06  
**適用範圍**: 開發者、擴展開發

## 🎯 概覽

此 API 文件涵蓋 Readmoo 書庫提取器的所有公開接口，包括核心類別、事件系統、資料格式等。

## 🏗 核心架構

### 事件系統 (Event System)

#### EventBus
中央事件總線，負責事件的註冊、觸發和管理。

```javascript
// 取得 EventBus 實例
const eventBus = EventBus.getInstance();

// 註冊事件監聽器
eventBus.on('EXTRACTION.COMPLETED', handler, priority);

// 觸發事件
eventBus.emit('EXTRACTION.STARTED', eventData, priority);

// 移除事件監聽器
eventBus.off('EXTRACTION.COMPLETED', handler);
```

**方法**:
- `on(eventType, handler, priority = 200)`: 註冊事件監聽器
- `once(eventType, handler, priority = 200)`: 註冊一次性事件監聽器
- `emit(eventType, data, priority = 200)`: 觸發事件
- `off(eventType, handler)`: 移除事件監聽器
- `hasListener(eventType)`: 檢查是否有特定事件的監聽器
- `getListenerCount(eventType)`: 取得特定事件的監聽器數量
- `getStats()`: 取得完整的事件系統統計資訊
- `getEventStats(eventType)`: 取得特定事件的詳細統計
- `destroy()`: 清理和銷毀事件系統

#### EventHandler
抽象基底類別，所有事件處理器的共同祖先。

```javascript
class CustomHandler extends EventHandler {
  constructor(priority = 1) {
    super('CustomHandler', priority);
    this.supportedEvents = ['CUSTOM.EVENT'];
  }
  
  async process(event) {
    // 處理事件邏輯
    return { success: true, data: processedData };
  }
}
```

**抽象方法**:
- `process(event)`: 必須實現的事件處理方法

**生命週期方法**:
- `beforeHandle(event)`: 處理前預處理
- `afterHandle(event, result)`: 處理後後處理
- `onError(error, event)`: 錯誤處理

## 📊 資料提取 API

### BookDataExtractor
主要的書籍資料提取器。

```javascript
const extractor = new BookDataExtractor(eventBus);

// 開始提取
const processId = await extractor.startExtraction('readmoo');

// 取消提取
await extractor.cancelExtraction(processId);

// 取得統計資訊
const stats = extractor.getStats();
```

**方法**:
- `startExtraction(platform)`: 開始資料提取
- `cancelExtraction(processId)`: 取消指定的提取流程
- `getActiveProcesses()`: 取得目前進行中的提取流程
- `getStats()`: 取得提取統計資訊

### ReadmooAdapter
Readmoo 平台特定的資料適配器。

```javascript
const adapter = new ReadmooAdapter();

// 檢查平台相容性
const isCompatible = adapter.checkCompatibility();

// 提取書籍資料
const books = await adapter.extractBooks();

// 取得書籍詳細資訊
const bookDetails = await adapter.getBookDetails(bookId);
```

**方法**:
- `checkCompatibility()`: 檢查目前頁面是否相容
- `extractBooks()`: 提取頁面上的所有書籍
- `getBookDetails(bookId)`: 取得特定書籍的詳細資訊
- `getReadingProgress(bookId)`: 取得閱讀進度

## 💾 儲存系統 API

### StorageManager
統一的儲存管理介面。

```javascript
const storage = new StorageManager();

// 儲存資料
await storage.save('books', booksData);

// 載入資料
const data = await storage.load('books');

// 刪除資料
await storage.delete('books');

// 清空所有資料
await storage.clear();
```

**方法**:
- `save(key, data)`: 儲存資料
- `load(key)`: 載入資料
- `delete(key)`: 刪除指定資料
- `clear()`: 清空所有資料
- `getStats()`: 取得儲存統計資訊

### ChromeStorageAdapter
Chrome Extension 儲存適配器。

```javascript
const adapter = new ChromeStorageAdapter({
  storageType: 'local', // 'local' or 'sync'
  quotaLimit: 5242880,  // 5MB
  compressionThreshold: 1024
});
```

**配置選項**:
- `storageType`: 儲存類型 ('local' | 'sync')
- `quotaLimit`: 配額限制 (bytes)
- `compressionThreshold`: 壓縮閾值 (bytes)

## 🎨 UI 組件 API

### OverviewPageController
Overview 頁面控制器。

```javascript
const controller = new OverviewPageController(eventBus);

// 初始化頁面
await controller.initializePage();

// 載入書籍資料
await controller.loadBooks();

// 執行搜尋
controller.performSearch('search query');

// 匯出資料
await controller.exportData('csv');
```

### BookGridRenderer
書籍網格渲染器。

```javascript
const renderer = new BookGridRenderer(container, {
  viewMode: 'grid',        // 'grid' | 'list'
  itemsPerRow: 4,         // 每行項目數
  enableVirtualScrolling: true,
  bufferSize: 10
});

// 渲染書籍
await renderer.renderBooks(booksData);

// 切換檢視模式
renderer.setViewMode('list');

// 更新單一項目
renderer.updateItem(bookId, newData);
```

### BookSearchFilter
書籍搜尋和篩選器。

```javascript
const filter = new BookSearchFilter(booksData, {
  fuzzySearch: true,
  enableSuggestions: true,
  maxSuggestions: 5
});

// 執行搜尋
const results = filter.search('搜尋關鍵字');

// 套用篩選條件
filter.setFilters({
  categories: ['小說'],
  status: ['已完成'],
  progressRange: [0, 100]
});

// 執行排序
const sorted = filter.sort('title', 'asc');
```

## 📡 事件系統事件定義

### 資料提取事件
```javascript
// 提取開始
'EXTRACTION.STARTED' -> { processId, platform, timestamp }

// 提取進度
'EXTRACTION.PROGRESS' -> { 
  processId, 
  current, 
  total, 
  percentage, 
  estimatedTime 
}

// 提取完成
'EXTRACTION.COMPLETED' -> { 
  processId, 
  data, 
  stats, 
  duration 
}

// 提取錯誤
'EXTRACTION.ERROR' -> { 
  processId, 
  error, 
  recoverable 
}
```

### 儲存事件
```javascript
// 儲存請求
'STORAGE.SAVE.REQUESTED' -> { key, data, options }

// 儲存完成
'STORAGE.SAVE.COMPLETED' -> { key, size, duration }

// 載入完成
'STORAGE.LOAD.COMPLETED' -> { key, data, size }

// 儲存錯誤
'STORAGE.ERROR' -> { operation, key, error, suggestion }
```

### UI 事件
```javascript
// UI 更新
'UI.BOOKS.UPDATE' -> { books, filterApplied }

// 進度更新
'UI.PROGRESS.UPDATE' -> { current, total, message }

// 通知顯示
'UI.NOTIFICATION.SHOW' -> { 
  type: 'success' | 'warning' | 'error',
  message,
  duration
}
```

## 📋 資料格式

### Book 物件格式
```javascript
{
  id: String,              // 唯一識別碼
  platform: 'readmoo',     // 平台識別
  title: String,           // 書籍標題
  author: String,          // 作者
  coverUrl: String,        // 封面圖片 URL
  progress: Number,        // 閱讀進度 (0-100)
  status: String,          // 閱讀狀態
  categories: Array,       // 分類標籤
  tags: Array,            // 用戶標籤
  lastRead: Date,         // 最後閱讀時間
  addedDate: Date,        // 加入時間
  metadata: {             // 平台特有資料
    isbn: String,
    publisher: String,
    publishDate: Date,
    pageCount: Number,
    rating: Number
  }
}
```

### Event 物件格式
```javascript
{
  type: String,           // 事件類型
  timestamp: Date,        // 事件時間戳
  source: String,         // 事件來源
  target: String,         // 事件目標
  data: Object,           // 事件資料
  priority: Number,       // 事件優先級
  metadata: {             // 元資料
    processId: String,
    userId: String,
    sessionId: String
  }
}
```

## 🔧 配置選項

### 全域配置
```javascript
const CONFIG = {
  // 事件系統配置
  events: {
    maxListeners: 100,
    defaultPriority: 200,
    enableStatistics: true
  },
  
  // 儲存配置
  storage: {
    defaultAdapter: 'chrome',
    autoCleanup: true,
    compressionEnabled: true
  },
  
  // UI 配置
  ui: {
    theme: 'light',
    itemsPerPage: 20,
    animationEnabled: true
  },
  
  // 除錯配置
  debug: {
    enabled: false,
    logLevel: 'info',
    showTimestamps: true
  }
};
```

## 🚨 錯誤處理

### 錯誤類型
```javascript
class ExtractorError extends Error {
  constructor(code, message, recoverable = false) {
    super(message);
    this.code = code;
    this.recoverable = recoverable;
  }
}

// 錯誤代碼
const ERROR_CODES = {
  PLATFORM_NOT_SUPPORTED: 'E001',
  DOM_STRUCTURE_CHANGED: 'E002', 
  NETWORK_ERROR: 'E003',
  STORAGE_QUOTA_EXCEEDED: 'E004',
  PERMISSION_DENIED: 'E005'
};
```

### 錯誤處理模式
```javascript
try {
  await extractor.startExtraction('readmoo');
} catch (error) {
  if (error instanceof ExtractorError && error.recoverable) {
    // 可恢復錯誤，嘗試重試
    await retryExtraction();
  } else {
    // 不可恢復錯誤，顯示錯誤訊息
    showError(error.message);
  }
}
```

## 🔍 除錯工具

### Debug 模式啟用
```javascript
// 啟用全域除錯
window.DEBUG = true;

// 啟用特定模組除錯
window.DEBUG_EXTRACTOR = true;
window.DEBUG_STORAGE = true;
window.DEBUG_UI = true;

// 取得除錯資訊
const debugInfo = getDebugInfo();
console.log(debugInfo);
```

### 效能監控
```javascript
// 效能統計
const stats = {
  extraction: extractor.getPerformanceStats(),
  storage: storage.getPerformanceStats(),
  ui: uiManager.getPerformanceStats()
};

// 記憶體使用
const memoryInfo = getMemoryUsage();
```

### EventBus 診斷統計

EventBus 提供完整的統計資訊，用於系統監控、效能分析和除錯診斷。

#### `getStats()` 方法

返回完整的事件系統統計資訊：

```javascript
const eventBus = new EventBus();
const stats = eventBus.getStats();

console.log(stats);
// 輸出：
{
  // 監聽器相關統計
  totalEventTypes: 3,           // 註冊的事件類型總數
  totalListeners: 5,            // 監聽器總數量
  eventTypes: [                 // 所有已註冊事件類型陣列
    'EXTRACTION.COMPLETED', 
    'UI.UPDATE.PROGRESS', 
    'SYSTEM.ERROR'
  ],
  listenerCounts: {             // 每種事件類型的監聽器數量
    'EXTRACTION.COMPLETED': 2,
    'UI.UPDATE.PROGRESS': 2,
    'SYSTEM.ERROR': 1
  },
  
  // 事件觸發相關統計
  totalEvents: 15,              // 總事件觸發次數
  totalEmissions: 15,           // 總事件觸發次數（向後相容）
  totalExecutionTime: 245.7,    // 累計執行時間（毫秒）
  lastActivity: '2025-08-12T10:30:45.123Z'  // 最後活動時間戳
}
```

#### 常見使用場景

**1. 系統健康檢查**
```javascript
function checkEventSystemHealth() {
  const stats = eventBus.getStats();
  
  return {
    isActive: stats.totalListeners > 0,
    eventsProcessed: stats.totalEvents,
    averageExecutionTime: stats.totalExecutionTime / Math.max(stats.totalEvents, 1),
    lastActivity: stats.lastActivity,
    criticalListenersPresent: [
      'EXTRACTION.COMPLETED',
      'STORAGE.SAVE.COMPLETED'
    ].every(event => stats.listenerCounts[event] > 0)
  };
}
```

**2. 效能分析**
```javascript
// 監控事件處理效能
function analyzePerformance() {
  const stats = eventBus.getStats();
  
  if (stats.totalEvents > 0) {
    const avgTime = stats.totalExecutionTime / stats.totalEvents;
    
    if (avgTime > 50) { // 超過50ms平均執行時間
      console.warn('Event processing performance degraded:', {
        averageTime: avgTime,
        totalEvents: stats.totalEvents,
        slowListeners: Object.entries(stats.listenerCounts)
          .filter(([_, count]) => count > 3) // 可能的效能瓶頸
      });
    }
  }
}
```

**3. 除錯診斷**
```javascript
// 檢查關鍵監聽器是否遺失
function validateCriticalListeners() {
  const stats = eventBus.getStats();
  const requiredEvents = [
    'EXTRACTION.COMPLETED',
    'STORAGE.SAVE.COMPLETED',
    'UI.UPDATE.PROGRESS'
  ];
  
  const missing = requiredEvents.filter(event => 
    !stats.eventTypes.includes(event) || 
    stats.listenerCounts[event] === 0
  );
  
  if (missing.length > 0) {
    console.error('Critical listeners missing:', missing);
    return false;
  }
  
  return true;
}
```

#### `getEventStats(eventType)` 方法

取得特定事件的詳細統計：

```javascript
const eventStats = eventBus.getEventStats('EXTRACTION.COMPLETED');

console.log(eventStats);
// 輸出：
{
  emitCount: 5,                 // 觸發次數
  totalExecutionTime: 125.3,    // 總執行時間
  averageExecutionTime: 25.06   // 平均執行時間
}
```

#### 統計資料重置

使用 `destroy()` 方法可以重置所有統計資料：

```javascript
eventBus.destroy(); // 清理所有監聽器和統計資料

const stats = eventBus.getStats();
// 所有統計歸零
console.log(stats.totalEvents); // 0
console.log(stats.lastActivity); // null
```

---

**API 版本**: v0.5.23  
**相容性**: Chrome Extension Manifest V3  
**維護狀態**: 積極維護