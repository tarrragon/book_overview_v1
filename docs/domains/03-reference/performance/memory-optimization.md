# 🧠 Chrome Extension 記憶體最佳化指南

> **第三層參考文件** - 完整的記憶體管理與最佳化策略  
> **目標讀者**: 效能工程師、Chrome Extension 開發者  
> **文件類型**: 技術深度參考手冊  

本文件提供 Readmoo 書庫提取器 Chrome Extension 的記憶體最佳化策略，涵蓋記憶體管理、洩漏檢測、大量資料處理優化等關鍵技術。

## 🎯 記憶體最佳化概觀

### Chrome Extension 記憶體架構
```
┌─────────────────────────────────────┐
│        Service Worker (背景)        │
│  - 持久化記憶體管理                │
│  - 快取策略                        │
│  - 定時清理機制                    │
├─────────────────────────────────────┤
│         Content Scripts             │
│  - 頁面特定記憶體                  │
│  - DOM 操作記憶體                  │
│  - 事件監聽器管理                  │
├─────────────────────────────────────┤
│            Popup UI                 │
│  - 臨時性記憶體使用                │
│  - 視圖狀態管理                    │
│  - 資料快取最佳化                  │
└─────────────────────────────────────┘
```

### 記憶體最佳化目標
- **記憶體使用量**: 保持在 50MB 以下 (常規使用)
- **記憶體洩漏**: 零容忍政策，定期檢測與修復
- **垃圾回收**: 主動觸發 GC，減少記憶體碎片
- **資料快取**: 智能快取策略，平衡效能與記憶體

## 📊 記憶體使用分析

### 記憶體分類與監控
```javascript
// src/core/memory/memory-monitor.js
class MemoryMonitor {
  static getMemoryUsage() {
    if (!performance.memory) {
      console.warn('Performance.memory API not available');
      return null;
    }

    const memory = performance.memory;
    return {
      // 已使用的 JS Heap 大小 (Bytes)
      usedJSHeapSize: memory.usedJSHeapSize,
      // 總 JS Heap 大小 (Bytes)
      totalJSHeapSize: memory.totalJSHeapSize,
      // JS Heap 大小限制 (Bytes)
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      // 記憶體使用率 (%)
      usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
    };
  }

  static formatMemorySize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  static logMemoryUsage(context = 'General') {
    const usage = this.getMemoryUsage();
    if (!usage) return;

    console.group(`🧠 Memory Usage - ${context}`);
    console.log(`Used: ${this.formatMemorySize(usage.usedJSHeapSize)}`);
    console.log(`Total: ${this.formatMemorySize(usage.totalJSHeapSize)}`);
    console.log(`Limit: ${this.formatMemorySize(usage.jsHeapSizeLimit)}`);
    console.log(`Usage: ${usage.usagePercentage.toFixed(2)}%`);
    console.groupEnd();
  }
}
```

### 記憶體使用基準
```javascript
// 記憶體使用基準設定
const MEMORY_THRESHOLDS = {
  // 正常使用狀態 (MB)
  NORMAL_USAGE: 30,
  // 警告閾值 (MB)  
  WARNING_THRESHOLD: 50,
  // 臨界閾值 (MB)
  CRITICAL_THRESHOLD: 80,
  // 記憶體使用率警告 (%)
  USAGE_PERCENTAGE_WARNING: 60,
  // 記憶體使用率臨界 (%)
  USAGE_PERCENTAGE_CRITICAL: 80
};

function checkMemoryThreshold(memoryUsage) {
  const usedMB = memoryUsage.usedJSHeapSize / (1024 * 1024);
  const usagePercentage = memoryUsage.usagePercentage;

  if (usedMB > MEMORY_THRESHOLDS.CRITICAL_THRESHOLD || 
      usagePercentage > MEMORY_THRESHOLDS.USAGE_PERCENTAGE_CRITICAL) {
    return 'critical';
  } else if (usedMB > MEMORY_THRESHOLDS.WARNING_THRESHOLD || 
             usagePercentage > MEMORY_THRESHOLDS.USAGE_PERCENTAGE_WARNING) {
    return 'warning';
  } else {
    return 'normal';
  }
}
```

## 🔍 記憶體洩漏檢測

### 常見記憶體洩漏模式

#### 1. Event Listener 未移除
```javascript
// ❌ 不良實踐 - 可能導致記憶體洩漏
class BadEventHandler {
  constructor() {
    document.addEventListener('click', this.handleClick.bind(this));
    // 忘記移除監聽器
  }

  handleClick() {
    // 處理邏輯
  }
}

// ✅ 良好實踐 - 正確管理事件監聽器
class GoodEventHandler {
  constructor() {
    this.boundHandleClick = this.handleClick.bind(this);
    document.addEventListener('click', this.boundHandleClick);
  }

  destroy() {
    document.removeEventListener('click', this.boundHandleClick);
    this.boundHandleClick = null;
  }

  handleClick() {
    // 處理邏輯
  }
}
```

#### 2. 循環引用
```javascript
// ❌ 不良實踐 - 循環引用
class BadCircularReference {
  constructor() {
    this.data = {};
    this.data.parent = this; // 循環引用
  }
}

// ✅ 良好實踐 - 使用 WeakMap 避免循環引用
class GoodCircularReference {
  constructor() {
    this.data = {};
    // 使用 WeakMap 儲存父引用
    GoodCircularReference.parentMap.set(this.data, this);
  }

  static parentMap = new WeakMap();

  destroy() {
    GoodCircularReference.parentMap.delete(this.data);
    this.data = null;
  }
}
```

#### 3. 大量 DOM 節點快取
```javascript
// ❌ 不良實踐 - 無限制快取 DOM 節點
class BadDOMCache {
  constructor() {
    this.nodeCache = new Map(); // 永遠不清理
  }

  cacheNode(id, node) {
    this.nodeCache.set(id, node);
  }
}

// ✅ 良好實踐 - 使用 WeakMap 和 LRU 快取
class GoodDOMCache {
  constructor(maxSize = 100) {
    this.nodeCache = new Map();
    this.maxSize = maxSize;
  }

  cacheNode(id, node) {
    // LRU 策略 - 超過限制時移除最舊的
    if (this.nodeCache.size >= this.maxSize) {
      const firstKey = this.nodeCache.keys().next().value;
      this.nodeCache.delete(firstKey);
    }
    
    this.nodeCache.set(id, node);
  }

  clearCache() {
    this.nodeCache.clear();
  }
}
```

### 記憶體洩漏檢測工具
```javascript
// src/core/memory/leak-detector.js
class MemoryLeakDetector {
  constructor() {
    this.snapshots = [];
    this.detectionInterval = 30000; // 30秒
    this.isMonitoring = false;
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringTimer = setInterval(() => {
      this.takeSnapshot();
      this.analyzeSnapshots();
    }, this.detectionInterval);
  }

  stopMonitoring() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    this.isMonitoring = false;
  }

  takeSnapshot() {
    const usage = MemoryMonitor.getMemoryUsage();
    if (!usage) return;

    const snapshot = {
      timestamp: Date.now(),
      ...usage
    };

    this.snapshots.push(snapshot);
    
    // 保持最近 20 個快照
    if (this.snapshots.length > 20) {
      this.snapshots.shift();
    }
  }

  analyzeSnapshots() {
    if (this.snapshots.length < 5) return;

    const recent = this.snapshots.slice(-5);
    const growthTrend = this.calculateGrowthTrend(recent);
    
    if (growthTrend.isIncreasing && growthTrend.rate > 5) { // 5MB/分鐘
      console.warn('🚨 Potential memory leak detected:', {
        growthRate: `${growthTrend.rate.toFixed(2)} MB/min`,
        currentUsage: MemoryMonitor.formatMemorySize(recent[recent.length - 1].usedJSHeapSize)
      });
      
      // 觸發詳細分析
      this.performDetailedAnalysis();
    }
  }

  calculateGrowthTrend(snapshots) {
    if (snapshots.length < 2) return { isIncreasing: false, rate: 0 };

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    
    const timeDiff = (last.timestamp - first.timestamp) / (1000 * 60); // 分鐘
    const memoryDiff = (last.usedJSHeapSize - first.usedJSHeapSize) / (1024 * 1024); // MB

    const rate = timeDiff > 0 ? memoryDiff / timeDiff : 0;
    
    return {
      isIncreasing: rate > 0,
      rate: Math.abs(rate)
    };
  }

  performDetailedAnalysis() {
    // 強制垃圾回收 (僅開發環境)
    if (window.gc && process.env.NODE_ENV === 'development') {
      const beforeGC = MemoryMonitor.getMemoryUsage();
      window.gc();
      const afterGC = MemoryMonitor.getMemoryUsage();
      
      console.log('🔄 Manual GC triggered:', {
        before: MemoryMonitor.formatMemorySize(beforeGC.usedJSHeapSize),
        after: MemoryMonitor.formatMemorySize(afterGC.usedJSHeapSize),
        freed: MemoryMonitor.formatMemorySize(beforeGC.usedJSHeapSize - afterGC.usedJSHeapSize)
      });
    }
  }
}
```

## 📦 大量資料處理最佳化

### 分片處理策略
```javascript
// src/core/data/chunk-processor.js
class ChunkProcessor {
  constructor(chunkSize = 1000, processingDelay = 10) {
    this.chunkSize = chunkSize;
    this.processingDelay = processingDelay;
  }

  async processLargeDataset(dataset, processor) {
    const totalItems = dataset.length;
    const chunks = Math.ceil(totalItems / this.chunkSize);
    const results = [];

    console.log(`📦 Processing ${totalItems} items in ${chunks} chunks`);

    for (let i = 0; i < chunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, totalItems);
      const chunk = dataset.slice(start, end);

      // 記憶體監控
      const memoryBefore = MemoryMonitor.getMemoryUsage();
      
      // 處理當前分片
      const chunkResults = await processor(chunk);
      results.push(...chunkResults);

      const memoryAfter = MemoryMonitor.getMemoryUsage();
      
      console.log(`Chunk ${i + 1}/${chunks} processed:`, {
        items: chunk.length,
        memoryDelta: MemoryMonitor.formatMemorySize(
          memoryAfter.usedJSHeapSize - memoryBefore.usedJSHeapSize
        )
      });

      // 檢查記憶體使用
      if (checkMemoryThreshold(memoryAfter) === 'critical') {
        console.warn('⚠️ Critical memory usage, triggering cleanup');
        await this.performMemoryCleanup();
      }

      // 暫停以允許垃圾回收
      await new Promise(resolve => setTimeout(resolve, this.processingDelay));
    }

    return results;
  }

  async performMemoryCleanup() {
    // 觸發垃圾回收 (如果可用)
    if (window.gc) {
      window.gc();
    }
    
    // 清理應用層快取
    if (window.applicationCache) {
      window.applicationCache.clear();
    }

    // 等待 GC 完成
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

### 虛擬化列表實現
```javascript
// src/ui/virtual-list.js
class VirtualizedList {
  constructor(container, itemRenderer, itemHeight = 50) {
    this.container = container;
    this.itemRenderer = itemRenderer;
    this.itemHeight = itemHeight;
    this.data = [];
    this.renderedItems = new Map();
    
    this.initializeScrollHandling();
  }

  setData(data) {
    this.data = data;
    this.updateTotalHeight();
    this.render();
  }

  updateTotalHeight() {
    const totalHeight = this.data.length * this.itemHeight;
    this.container.style.height = `${Math.min(totalHeight, 600)}px`; // 最大高度限制
  }

  render() {
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;
    
    // 計算可見範圍
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / this.itemHeight) + 2,
      this.data.length
    );

    // 清理不在可見範圍的項目
    for (const [index, element] of this.renderedItems) {
      if (index < startIndex || index >= endIndex) {
        element.remove();
        this.renderedItems.delete(index);
      }
    }

    // 渲染可見範圍內的項目
    for (let i = startIndex; i < endIndex; i++) {
      if (!this.renderedItems.has(i)) {
        const element = this.itemRenderer(this.data[i], i);
        element.style.position = 'absolute';
        element.style.top = `${i * this.itemHeight}px`;
        element.style.height = `${this.itemHeight}px`;
        
        this.container.appendChild(element);
        this.renderedItems.set(i, element);
      }
    }
  }

  initializeScrollHandling() {
    let ticking = false;
    
    this.container.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.render();
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  destroy() {
    this.renderedItems.clear();
    this.container.innerHTML = '';
  }
}
```

### 資料快取最佳化
```javascript
// src/core/cache/smart-cache.js
class SmartCache {
  constructor(maxSize = 100, ttl = 5 * 60 * 1000) { // 5分鐘 TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.accessOrder = new Map(); // LRU 追蹤
    
    this.startCleanupTimer();
  }

  set(key, value) {
    const now = Date.now();
    
    // 如果已存在，先刪除舊的
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }

    // 檢查容量限制
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // 添加新項目
    this.cache.set(key, {
      value,
      timestamp: now,
      accessCount: 1
    });
    this.accessOrder.set(key, now);
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    
    // 檢查是否過期
    if (now - item.timestamp > this.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return null;
    }

    // 更新存取時間和計數
    item.accessCount++;
    this.accessOrder.set(key, now);
    
    return item.value;
  }

  evictLRU() {
    const oldestKey = this.accessOrder.keys().next().value;
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
    }
  }

  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000); // 每分鐘清理一次
  }

  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, item] of this.cache) {
      if (now - item.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    });

    console.log(`🧹 Cache cleanup: removed ${keysToDelete.length} expired items`);
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.calculateHitRate(),
      memoryEstimate: this.estimateMemoryUsage()
    };
  }

  calculateHitRate() {
    let totalAccess = 0;
    for (const item of this.cache.values()) {
      totalAccess += item.accessCount;
    }
    return totalAccess > 0 ? (this.cache.size / totalAccess) * 100 : 0;
  }

  estimateMemoryUsage() {
    let estimate = 0;
    for (const [key, item] of this.cache) {
      estimate += key.length * 2; // 字串記憶體 (Unicode)
      estimate += JSON.stringify(item.value).length * 2;
      estimate += 100; // 物件開銷估算
    }
    return MemoryMonitor.formatMemorySize(estimate);
  }

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
    this.accessOrder.clear();
  }
}
```

## 🛠️ Service Worker 記憶體管理

### Service Worker 生命周期管理
```javascript
// src/background/memory-manager.js
class ServiceWorkerMemoryManager {
  constructor() {
    this.dataCache = new SmartCache(50, 10 * 60 * 1000); // 10分鐘
    this.periodicCleanupInterval = 5 * 60 * 1000; // 5分鐘
    
    this.initializeMemoryManagement();
  }

  initializeMemoryManagement() {
    // 定期記憶體清理
    setInterval(() => {
      this.performPeriodicCleanup();
    }, this.periodicCleanupInterval);

    // 監聽記憶體壓力事件
    if ('onmemory' in self) {
      self.addEventListener('memory', (event) => {
        console.warn('🚨 Memory pressure detected:', event);
        this.performEmergencyCleanup();
      });
    }

    // Extension 啟動時清理
    chrome.runtime.onStartup.addListener(() => {
      this.performStartupCleanup();
    });
  }

  performPeriodicCleanup() {
    console.log('🧹 Performing periodic memory cleanup');
    
    // 清理過期快取
    this.dataCache.cleanup();
    
    // 清理 Chrome Storage 中的臨時數據
    this.cleanupTemporaryStorage();
    
    // 記錄記憶體使用狀況
    MemoryMonitor.logMemoryUsage('Periodic Cleanup');
  }

  async performEmergencyCleanup() {
    console.warn('⚠️ Performing emergency memory cleanup');
    
    // 立即清理所有快取
    this.dataCache.cache.clear();
    
    // 清理 Chrome Storage
    await this.cleanupTemporaryStorage();
    
    // 強制垃圾回收 (如果可用)
    if (self.gc) {
      self.gc();
    }
    
    MemoryMonitor.logMemoryUsage('Emergency Cleanup');
  }

  async performStartupCleanup() {
    console.log('🚀 Performing startup cleanup');
    
    // 清理上次運行的臨時數據
    await this.cleanupTemporaryStorage();
    
    // 重設快取
    this.dataCache = new SmartCache(50, 10 * 60 * 1000);
    
    MemoryMonitor.logMemoryUsage('Startup Cleanup');
  }

  async cleanupTemporaryStorage() {
    try {
      // 獲取所有 storage keys
      const allKeys = await chrome.storage.local.get();
      const keysToRemove = [];
      
      for (const key of Object.keys(allKeys)) {
        // 清理臨時或過期的數據
        if (key.startsWith('temp_') || 
            key.startsWith('cache_') || 
            key.startsWith('metrics_')) {
          keysToRemove.push(key);
        }
      }
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log(`🗑️ Cleaned up ${keysToRemove.length} temporary storage items`);
      }
    } catch (error) {
      console.error('Failed to cleanup temporary storage:', error);
    }
  }
}

// 初始化 Service Worker 記憶體管理
const memoryManager = new ServiceWorkerMemoryManager();
```

## 📊 記憶體效能測試

### 記憶體壓力測試
```javascript
// tests/performance/memory-stress-test.js
class MemoryStressTest {
  constructor() {
    this.testResults = [];
  }

  async runStressTest() {
    console.log('🧪 Starting memory stress test...');
    
    const tests = [
      { name: 'Large Dataset Processing', test: this.testLargeDatasetProcessing.bind(this) },
      { name: 'DOM Manipulation', test: this.testDOMManipulation.bind(this) },
      { name: 'Cache Performance', test: this.testCachePerformance.bind(this) },
      { name: 'Memory Leak Detection', test: this.testMemoryLeakDetection.bind(this) }
    ];

    for (const test of tests) {
      console.log(`Running: ${test.name}`);
      const result = await test.test();
      this.testResults.push({
        name: test.name,
        ...result
      });
    }

    this.generateReport();
  }

  async testLargeDatasetProcessing() {
    const startMemory = MemoryMonitor.getMemoryUsage();
    const processor = new ChunkProcessor();
    
    // 建立大型假資料集
    const largeDataset = Array(10000).fill(null).map((_, i) => ({
      id: i,
      title: `Book ${i}`,
      content: 'Lorem ipsum '.repeat(100) // 模擬大量文字內容
    }));

    const startTime = performance.now();
    
    await processor.processLargeDataset(largeDataset, (chunk) => {
      // 模擬資料處理
      return chunk.map(item => ({
        ...item,
        processed: true,
        timestamp: Date.now()
      }));
    });

    const endTime = performance.now();
    const endMemory = MemoryMonitor.getMemoryUsage();

    return {
      processingTime: endTime - startTime,
      memoryBefore: startMemory.usedJSHeapSize,
      memoryAfter: endMemory.usedJSHeapSize,
      memoryDelta: endMemory.usedJSHeapSize - startMemory.usedJSHeapSize,
      status: checkMemoryThreshold(endMemory)
    };
  }

  async testCachePerformance() {
    const cache = new SmartCache(1000);
    const startMemory = MemoryMonitor.getMemoryUsage();
    
    // 填充快取
    for (let i = 0; i < 1000; i++) {
      cache.set(`key_${i}`, {
        data: 'test data '.repeat(50),
        timestamp: Date.now()
      });
    }

    const midMemory = MemoryMonitor.getMemoryUsage();
    
    // 執行大量讀取操作
    for (let i = 0; i < 5000; i++) {
      cache.get(`key_${i % 1000}`);
    }

    const endMemory = MemoryMonitor.getMemoryUsage();
    
    const stats = cache.getStats();
    cache.destroy();

    return {
      cacheSize: stats.size,
      hitRate: stats.hitRate,
      memoryUsage: midMemory.usedJSHeapSize - startMemory.usedJSHeapSize,
      finalMemoryDelta: endMemory.usedJSHeapSize - startMemory.usedJSHeapSize,
      status: checkMemoryThreshold(endMemory)
    };
  }

  generateReport() {
    console.group('📊 Memory Stress Test Report');
    
    this.testResults.forEach(result => {
      console.group(`${result.name}:`);
      Object.keys(result).forEach(key => {
        if (key !== 'name') {
          const value = typeof result[key] === 'number' && key.includes('memory') 
            ? MemoryMonitor.formatMemorySize(result[key])
            : result[key];
          console.log(`${key}: ${value}`);
        }
      });
      console.groupEnd();
    });
    
    console.groupEnd();
    
    return this.testResults;
  }
}
```

## 📚 最佳實踐總結

### 記憶體最佳化檢查清單
- [ ] **事件監聽器管理**: 確保所有事件監聽器正確移除
- [ ] **DOM 節點清理**: 避免持有不必要的 DOM 引用
- [ ] **循環引用預防**: 使用 WeakMap/WeakSet 避免記憶體洩漏
- [ ] **快取策略**: 實施 LRU 和 TTL 機制
- [ ] **分片處理**: 大量資料分片處理，避免記憶體峰值
- [ ] **定期清理**: 定時清理臨時資料和過期快取
- [ ] **記憶體監控**: 持續監控記憶體使用量
- [ ] **虛擬化**: 大量 UI 元素使用虛擬化技術

### Chrome Extension 特殊注意事項
- **Service Worker 休眠**: 設計考慮 Service Worker 可能被終止
- **跨頁面資料**: 使用 Chrome Storage API 而非記憶體儲存持久資料
- **Content Script 隔離**: 避免 Content Script 與頁面 JS 的記憶體衝突
- **Popup 生命周期**: Popup 關閉時清理所有資源

## 📚 相關資源

### 內部文件連結
- [效能監控體系](./monitoring-system.md)
- [載入效能優化](./loading-performance.md)
- [效能測試方法](./performance-testing.md)
- [效能問題診斷](../troubleshooting/performance-troubleshooting.md)

### 外部參考資源
- [Chrome DevTools Memory Tab](https://developers.google.com/web/tools/chrome-devtools/memory-problems)
- [JavaScript Memory Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management)
- [Chrome Extension Performance Best Practices](https://developer.chrome.com/docs/extensions/mv3/performance/)
- [Web Performance Working Group](https://www.w3.org/webperf/)

---

**🧠 記憶體最佳化策略已建立，開始實施高效能的記憶體管理方案！**