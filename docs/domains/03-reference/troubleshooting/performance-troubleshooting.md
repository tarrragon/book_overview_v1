# ⚡ 效能問題診斷

## 📋 總覽

Chrome Extension 效能問題診斷與解決指南，涵蓋載入延遲、記憶體洩漏、CPU 佔用等常見問題的系統化診斷方法。

## 🔍 診斷流程

### 效能問題分類

#### **載入效能問題**
- 頁面載入時間過長
- Extension 啟動緩慢
- 首次互動延遲

#### **執行時效能問題**
- 書籍提取速度慢
- UI 反應遲緩
- 批次操作卡頓

#### **記憶體問題**
- 記憶體洩漏
- 記憶體佔用過高
- 垃圾回收頻繁

#### **網路效能問題**
- API 請求超時
- 並發請求過多
- 資源載入失敗

## 🛠 診斷工具箱

### Chrome DevTools 效能分析

#### **Performance 面板分析**

```javascript
// 程式碼中新增效能標記
console.time('bookExtraction');

// 書籍提取邏輯
const books = await extractBooks(urls);

console.timeEnd('bookExtraction');

// 使用 Performance API
performance.mark('extraction-start');
await performExtraction();
performance.mark('extraction-end');

performance.measure(
  'extraction-duration',
  'extraction-start',
  'extraction-end'
);
```

#### **Memory 面板診斷**

```javascript
// 記憶體使用監控
class MemoryMonitor {
  constructor() {
    this.snapshots = [];
  }

  takeSnapshot() {
    if ('memory' in performance) {
      const memInfo = performance.memory;
      const snapshot = {
        timestamp: Date.now(),
        used: memInfo.usedJSHeapSize,
        total: memInfo.totalJSHeapSize,
        limit: memInfo.jsHeapSizeLimit
      };
      
      this.snapshots.push(snapshot);
      return snapshot;
    }
  }

  detectLeak() {
    if (this.snapshots.length < 2) return null;
    
    const recent = this.snapshots.slice(-10);
    const trend = recent.reduce((acc, snapshot, index) => {
      if (index === 0) return acc;
      
      const growth = snapshot.used - recent[index - 1].used;
      acc.totalGrowth += growth;
      acc.samples++;
      
      return acc;
    }, { totalGrowth: 0, samples: 0 });
    
    const avgGrowth = trend.totalGrowth / trend.samples;
    
    return {
      averageGrowthPerSnapshot: avgGrowth,
      isLeakSuspected: avgGrowth > 1024 * 1024, // 1MB growth
      currentUsage: recent[recent.length - 1].used
    };
  }
}
```

### 自動化效能檢測

```javascript
// 效能閾值監控
class PerformanceThresholds {
  constructor() {
    this.thresholds = {
      loadTime: 3000,        // 3秒
      memoryUsage: 50 * 1024 * 1024,  // 50MB
      cpuIntensive: 100,     // 100ms 連續運算
      networkTimeout: 5000   // 5秒
    };
    
    this.alerts = [];
  }

  checkLoadTime(startTime, endTime) {
    const duration = endTime - startTime;
    
    if (duration > this.thresholds.loadTime) {
      this.alerts.push({
        type: 'LOAD_TIME_EXCEEDED',
        duration,
        threshold: this.thresholds.loadTime,
        timestamp: Date.now()
      });
    }
    
    return duration;
  }

  monitorLongTasks() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > this.thresholds.cpuIntensive) {
            this.alerts.push({
              type: 'LONG_TASK',
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime
            });
          }
        });
      });
      
      observer.observe({ entryTypes: ['longtask'] });
    }
  }

  generateReport() {
    return {
      timestamp: new Date().toISOString(),
      alerts: this.alerts,
      summary: {
        totalAlerts: this.alerts.length,
        criticalIssues: this.alerts.filter(a => 
          a.type === 'LOAD_TIME_EXCEEDED' || a.type === 'MEMORY_LEAK'
        ).length
      }
    };
  }
}
```

## 🚨 常見效能問題診斷

### 問題1: 書籍提取速度慢

#### **症狀**
- 單本書籍提取超過 5 秒
- 批次提取時間呈線性增長
- 使用者體驗不佳

#### **診斷步驟**

```javascript
// 1. 測量提取時間分布
async function benchmarkExtraction() {
  const testUrls = [
    'https://readmoo.com/book/1',
    'https://readmoo.com/book/2',
    // ... 更多測試URL
  ];
  
  const results = [];
  
  for (const url of testUrls) {
    const startTime = performance.now();
    
    try {
      const book = await extractBook(url);
      const endTime = performance.now();
      
      results.push({
        url,
        duration: endTime - startTime,
        success: true,
        bookTitle: book.title
      });
    } catch (error) {
      results.push({
        url,
        duration: performance.now() - startTime,
        success: false,
        error: error.message
      });
    }
  }
  
  return analyzeResults(results);
}

function analyzeResults(results) {
  const successful = results.filter(r => r.success);
  const durations = successful.map(r => r.duration);
  
  return {
    averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    maxDuration: Math.max(...durations),
    minDuration: Math.min(...durations),
    successRate: successful.length / results.length,
    p95: calculatePercentile(durations, 95),
    p99: calculatePercentile(durations, 99)
  };
}
```

#### **常見原因與解決方案**

**原因1: DOM 查詢效率低下**
```javascript
// ❌ 效能差的查詢方式
function extractBookInfoSlow() {
  const title = document.querySelector('.book-title').textContent;
  const author = document.querySelector('.book-author').textContent;
  const price = document.querySelector('.book-price').textContent;
  // 每次都重新查詢 DOM
}

// ✅ 效能優化的查詢方式
function extractBookInfoFast() {
  // 一次性獲取容器，減少 DOM 遍歷
  const bookContainer = document.querySelector('.book-info');
  
  if (!bookContainer) return null;
  
  return {
    title: bookContainer.querySelector('.book-title')?.textContent || '',
    author: bookContainer.querySelector('.book-author')?.textContent || '',
    price: bookContainer.querySelector('.book-price')?.textContent || ''
  };
}
```

**原因2: 非同步操作未最佳化**
```javascript
// ❌ 序列執行，速度慢
async function extractBooksSlow(urls) {
  const books = [];
  
  for (const url of urls) {
    const book = await extractBook(url);
    books.push(book);
  }
  
  return books;
}

// ✅ 並行執行，控制併發
async function extractBooksFast(urls, concurrency = 5) {
  const chunks = chunkArray(urls, concurrency);
  const allBooks = [];
  
  for (const chunk of chunks) {
    const chunkBooks = await Promise.all(
      chunk.map(url => extractBook(url))
    );
    allBooks.push(...chunkBooks);
    
    // 避免對伺服器造成過大壓力
    await delay(100);
  }
  
  return allBooks;
}
```

### 問題2: 記憶體洩漏

#### **症狀**
- Extension 長時間使用後變慢
- 記憶體使用量持續增長
- 瀏覽器提示記憶體不足

#### **診斷步驟**

```javascript
// 記憶體洩漏檢測器
class LeakDetector {
  constructor() {
    this.references = new Set();
    this.intervals = new Map();
    this.observers = new Map();
  }

  // 追蹤 DOM 引用
  trackDOMReference(element, description) {
    this.references.add({
      type: 'DOM',
      element: new WeakRef(element),
      description,
      timestamp: Date.now()
    });
  }

  // 追蹤定時器
  trackInterval(intervalId, description) {
    this.intervals.set(intervalId, {
      description,
      timestamp: Date.now()
    });
  }

  // 追蹤事件監聽器
  trackEventListener(element, event, handler, description) {
    const key = `${description}-${event}`;
    this.observers.set(key, {
      element: new WeakRef(element),
      event,
      handler,
      description
    });
  }

  // 清理檢查
  cleanup() {
    // 清理已失效的引用
    this.references.forEach((ref) => {
      if (ref.element.deref() === undefined) {
        this.references.delete(ref);
      }
    });

    // 清理定時器
    this.intervals.forEach((info, intervalId) => {
      clearInterval(intervalId);
    });
    this.intervals.clear();

    // 清理事件監聽器
    this.observers.forEach((info, key) => {
      const element = info.element.deref();
      if (element) {
        element.removeEventListener(info.event, info.handler);
      }
    });
    this.observers.clear();
  }

  // 生成洩漏報告
  generateLeakReport() {
    return {
      activeReferences: this.references.size,
      activeIntervals: this.intervals.size,
      activeObservers: this.observers.size,
      potentialLeaks: this.identifyPotentialLeaks()
    };
  }

  identifyPotentialLeaks() {
    const leaks = [];
    
    // 檢查長時間存在的引用
    this.references.forEach((ref) => {
      const age = Date.now() - ref.timestamp;
      if (age > 300000) { // 5分鐘
        leaks.push({
          type: 'LONG_LIVED_REFERENCE',
          description: ref.description,
          age
        });
      }
    });
    
    return leaks;
  }
}
```

#### **常見原因與解決方案**

**原因1: 事件監聽器未清理**
```javascript
// ❌ 事件監聽器洩漏
class BookExtractor {
  constructor() {
    this.handleScroll = this.handleScroll.bind(this);
    window.addEventListener('scroll', this.handleScroll);
    // 未提供清理方法
  }
  
  handleScroll() {
    // 滾動處理邏輯
  }
}

// ✅ 正確的事件管理
class BookExtractor {
  constructor() {
    this.handleScroll = this.handleScroll.bind(this);
    this.cleanup = this.cleanup.bind(this);
    
    window.addEventListener('scroll', this.handleScroll);
    
    // 頁面卸載時自動清理
    window.addEventListener('beforeunload', this.cleanup);
  }
  
  cleanup() {
    window.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('beforeunload', this.cleanup);
  }
  
  destroy() {
    this.cleanup();
  }
}
```

**原因2: 定時器未清理**
```javascript
// ❌ 定時器洩漏
function startPeriodicCheck() {
  setInterval(() => {
    checkForUpdates();
  }, 5000);
  // 沒有保存引用，無法清理
}

// ✅ 正確的定時器管理
class UpdateChecker {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }
  
  start() {
    if (this.isRunning) return;
    
    this.intervalId = setInterval(() => {
      this.checkForUpdates();
    }, 5000);
    
    this.isRunning = true;
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
    }
  }
  
  async checkForUpdates() {
    // 更新檢查邏輯
  }
}
```

### 問題3: CPU 高佔用

#### **症狀**
- 頁面卡頓或無回應
- 風扇轉速提升
- 其他程式變慢

#### **診斷與最佳化**

```javascript
// CPU 密集任務最佳化
class CPUOptimizer {
  // 分批處理大量資料
  async processLargeDataset(data, batchSize = 100) {
    const results = [];
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchResults = batch.map(item => this.processItem(item));
      
      results.push(...batchResults);
      
      // 讓出主執行緒，避免阻塞 UI
      await this.yieldControl();
    }
    
    return results;
  }
  
  yieldControl() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }
  
  // 使用 Worker 處理 CPU 密集任務
  async processInWorker(data) {
    return new Promise((resolve, reject) => {
      const worker = new Worker('processing-worker.js');
      
      worker.postMessage({ data });
      
      worker.onmessage = (event) => {
        worker.terminate();
        resolve(event.data);
      };
      
      worker.onerror = (error) => {
        worker.terminate();
        reject(error);
      };
    });
  }
}
```

## 📊 效能基準測試

### 建立效能基準

```javascript
// 效能基準測試套件
class PerformanceBenchmark {
  constructor() {
    this.benchmarks = new Map();
  }

  async runBenchmark(name, testFunction, iterations = 10) {
    const results = [];
    
    // 暖身運行
    await testFunction();
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      await testFunction();
      
      const endTime = performance.now();
      results.push(endTime - startTime);
    }
    
    const stats = this.calculateStats(results);
    this.benchmarks.set(name, stats);
    
    return stats;
  }

  calculateStats(results) {
    const sorted = results.sort((a, b) => a - b);
    
    return {
      average: results.reduce((a, b) => a + b, 0) / results.length,
      median: sorted[Math.floor(sorted.length / 2)],
      min: Math.min(...results),
      max: Math.max(...results),
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      standardDeviation: this.calculateStdDev(results)
    };
  }

  calculateStdDev(results) {
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const squaredDiffs = results.map(value => Math.pow(value - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    
    return Math.sqrt(avgSquaredDiff);
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      benchmarks: Object.fromEntries(this.benchmarks)
    };
    
    console.table(this.benchmarks);
    return report;
  }
}

// 使用範例
async function runPerformanceTests() {
  const benchmark = new PerformanceBenchmark();
  
  // 測試書籍提取效能
  await benchmark.runBenchmark(
    'bookExtraction',
    () => extractBook('https://readmoo.com/book/test'),
    5
  );
  
  // 測試 DOM 查詢效能
  await benchmark.runBenchmark(
    'domQuery',
    () => document.querySelectorAll('.book-item'),
    20
  );
  
  // 測試資料處理效能
  await benchmark.runBenchmark(
    'dataProcessing',
    () => processBookData(generateTestData(1000)),
    10
  );
  
  return benchmark.generateReport();
}
```

## 🎯 效能監控與告警

### 生產環境監控

```javascript
// 生產環境效能監控
class ProductionMonitor {
  constructor() {
    this.metrics = {
      errors: 0,
      loadTime: [],
      memoryUsage: [],
      userActions: []
    };
    
    this.startMonitoring();
  }

  startMonitoring() {
    // 監控載入效能
    this.monitorLoadPerformance();
    
    // 監控錯誤
    this.monitorErrors();
    
    // 監控記憶體使用
    this.monitorMemoryUsage();
    
    // 定期報告
    setInterval(() => {
      this.generateReport();
    }, 300000); // 每5分鐘
  }

  monitorLoadPerformance() {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'navigation') {
          this.metrics.loadTime.push(entry.loadEventEnd - entry.loadEventStart);
        }
      });
    });
    
    observer.observe({ entryTypes: ['navigation'] });
  }

  monitorErrors() {
    window.addEventListener('error', (event) => {
      this.metrics.errors++;
      
      // 嚴重錯誤立即告警
      if (this.isCriticalError(event.error)) {
        this.sendAlert({
          type: 'CRITICAL_ERROR',
          message: event.message,
          stack: event.error.stack,
          timestamp: Date.now()
        });
      }
    });
  }

  isCriticalError(error) {
    const criticalPatterns = [
      /Cannot read property.*of null/,
      /NetworkError/,
      /SecurityError/,
      /QuotaExceededError/
    ];
    
    return criticalPatterns.some(pattern => 
      pattern.test(error.message || error.toString())
    );
  }

  async sendAlert(alert) {
    try {
      // 發送到監控服務
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert)
      });
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }
}
```

## 📚 最佳實踐清單

### 效能優化清單

**載入效能**:
- [ ] 使用 lazy loading 延遲載入非關鍵資源
- [ ] 實作 Service Worker 快取策略
- [ ] 優化 CSS 和 JavaScript 大小
- [ ] 使用 CDN 加速資源載入

**執行時效能**:
- [ ] 避免頻繁的 DOM 操作
- [ ] 使用 requestAnimationFrame 處理動畫
- [ ] 實作虛擬滾動處理大列表
- [ ] 使用 Web Worker 處理 CPU 密集任務

**記憶體管理**:
- [ ] 及時清理事件監聽器
- [ ] 避免循環引用
- [ ] 使用 WeakMap 和 WeakSet
- [ ] 定期檢查記憶體洩漏

**網路效能**:
- [ ] 實作請求去重
- [ ] 使用合適的超時設定
- [ ] 實作指數退避重試
- [ ] 控制並發請求數量

---

## 📚 相關文件參考

- [效能監控體系](../performance/monitoring-system.md) - 監控工具配置
- [記憶體優化指南](../performance/memory-optimization.md) - 記憶體管理最佳實務
- [載入效能優化](../performance/loading-performance.md) - 載入速度改善策略

---

**⚡ 效能提醒**: 定期效能檢查和基準測試是維持 Extension 高效能的關鍵