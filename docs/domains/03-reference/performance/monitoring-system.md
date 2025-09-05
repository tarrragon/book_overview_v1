# 🔍 Chrome Extension 效能監控體系

> **第三層參考文件** - 完整的效能監控架構與實施指南  
> **目標讀者**: 效能工程師、DevOps 團隊、技術主管  
> **文件類型**: 技術架構參考手冊  

本文件提供 Readmoo 書庫提取器的完整效能監控體系設計，涵蓋指標定義、監控架構、數據收集與分析方法。

## 🎯 效能監控體系概觀

### 監控目標
- **使用者體驗**: 載入時間、響應性、介面流暢度
- **系統資源**: CPU、記憶體、網路使用量
- **功能效能**: API 響應時間、資料處理速度
- **錯誤追蹤**: 效能相關錯誤和瓶頸識別

### 監控層級
```
┌─────────────────────────────────────┐
│          使用者體驗層級              │
│  - 頁面載入時間                    │
│  - 操作響應時間                    │
│  - 視覺穩定性                      │
├─────────────────────────────────────┤
│          應用程式層級                │
│  - Extension 啟動時間              │
│  - API 請求效能                    │
│  - 資料處理效能                    │
├─────────────────────────────────────┤
│          瀏覽器層級                  │
│  - Memory Heap 使用量             │
│  - CPU 使用率                      │
│  - Network 流量                    │
└─────────────────────────────────────┘
```

## 📊 核心效能指標定義

### Web Vitals 核心指標

#### Largest Contentful Paint (LCP)
**定義**: 頁面主要內容載入完成時間
```javascript
// LCP 監控實現
new PerformanceObserver((entryList) => {
  for (const entry of entryList.getEntries()) {
    console.log('LCP:', entry.startTime);
    // 發送到監控系統
    sendMetric('lcp', entry.startTime);
  }
}).observe({entryTypes: ['largest-contentful-paint']});
```

**基準值**:
- 🟢 優秀: < 2.5s
- 🟡 需要改善: 2.5s - 4.0s  
- 🔴 差: > 4.0s

#### First Input Delay (FID)
**定義**: 使用者首次互動到瀏覽器回應的延遲
```javascript
new PerformanceObserver((entryList) => {
  for (const entry of entryList.getEntries()) {
    const FID = entry.processingStart - entry.startTime;
    console.log('FID:', FID);
    sendMetric('fid', FID);
  }
}).observe({entryTypes: ['first-input']});
```

**基準值**:
- 🟢 優秀: < 100ms
- 🟡 需要改善: 100ms - 300ms
- 🔴 差: > 300ms

#### Cumulative Layout Shift (CLS)
**定義**: 頁面載入期間佈局偏移累積分數
```javascript
let clsValue = 0;
new PerformanceObserver((entryList) => {
  for (const entry of entryList.getEntries()) {
    if (!entry.hadRecentInput) {
      clsValue += entry.value;
    }
  }
  sendMetric('cls', clsValue);
}).observe({entryTypes: ['layout-shift']});
```

**基準值**:
- 🟢 優秀: < 0.1
- 🟡 需要改善: 0.1 - 0.25
- 🔴 差: > 0.25

### Chrome Extension 專用指標

#### Extension 啟動時間
```javascript
// background/performance-monitor.js
const extensionStartTime = performance.now();

chrome.runtime.onStartup.addListener(() => {
  const startupDuration = performance.now() - extensionStartTime;
  sendMetric('extension_startup', startupDuration);
});
```

#### API 請求效能
```javascript
// 監控 Readmoo API 請求效能
function monitorApiRequest(url, options) {
  const startTime = performance.now();
  
  return fetch(url, options)
    .then(response => {
      const duration = performance.now() - startTime;
      sendMetric('api_request', {
        url: url.pathname,
        duration,
        status: response.status
      });
      return response;
    });
}
```

#### 記憶體使用監控
```javascript
// 定期收集記憶體使用數據
setInterval(() => {
  if (performance.memory) {
    const memoryInfo = {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    };
    sendMetric('memory_usage', memoryInfo);
  }
}, 30000); // 每30秒收集一次
```

## 🏗️ 監控架構設計

### 資料收集層
```javascript
// src/core/monitoring/metrics-collector.js
class MetricsCollector {
  constructor() {
    this.metrics = [];
    this.batchSize = 10;
    this.flushInterval = 5000; // 5秒
    
    this.initializeCollectors();
    this.startBatchSender();
  }

  collect(metricName, value, tags = {}) {
    const metric = {
      name: metricName,
      value,
      timestamp: Date.now(),
      tags: {
        version: chrome.runtime.getManifest().version,
        ...tags
      }
    };
    
    this.metrics.push(metric);
    
    if (this.metrics.length >= this.batchSize) {
      this.flush();
    }
  }

  flush() {
    if (this.metrics.length === 0) return;
    
    const batch = this.metrics.splice(0);
    this.sendTelemetry(batch);
  }

  sendTelemetry(metrics) {
    // 發送到監控服務
    chrome.storage.local.set({
      [`metrics_${Date.now()}`]: metrics
    });
  }
}
```

### 效能基準測試框架
```javascript
// tests/performance/benchmark.js
class PerformanceBenchmark {
  constructor() {
    this.benchmarks = new Map();
  }

  async runBenchmark(name, testFunction, iterations = 100) {
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await testFunction();
      const endTime = performance.now();
      results.push(endTime - startTime);
    }
    
    const metrics = this.calculateStats(results);
    this.benchmarks.set(name, metrics);
    
    return metrics;
  }

  calculateStats(results) {
    const sorted = results.sort((a, b) => a - b);
    return {
      mean: results.reduce((a, b) => a + b) / results.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: Math.min(...results),
      max: Math.max(...results)
    };
  }
}
```

### 效能預算與警報
```javascript
// src/core/monitoring/performance-budget.js
const PERFORMANCE_BUDGET = {
  // 載入時間預算
  'popup_load_time': { max: 1000, critical: 2000 }, // ms
  'content_script_init': { max: 500, critical: 1000 },
  'api_request_duration': { max: 3000, critical: 5000 },
  
  // 記憶體預算  
  'heap_size_mb': { max: 50, critical: 100 }, // MB
  'dom_nodes': { max: 1000, critical: 2000 },
  
  // 使用者體驗預算
  'lcp': { max: 2500, critical: 4000 }, // ms
  'fid': { max: 100, critical: 300 },
  'cls': { max: 0.1, critical: 0.25 }
};

function checkPerformanceBudget(metric, value) {
  const budget = PERFORMANCE_BUDGET[metric];
  if (!budget) return 'unknown';
  
  if (value > budget.critical) return 'critical';
  if (value > budget.max) return 'warning';
  return 'ok';
}
```

## 📈 監控數據分析

### 效能趨勢分析
```javascript
// src/core/monitoring/trend-analyzer.js
class TrendAnalyzer {
  analyzePerformanceTrend(metrics, timeWindow = 7 * 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const recentMetrics = metrics.filter(m => 
      now - m.timestamp < timeWindow
    );
    
    return {
      trend: this.calculateTrend(recentMetrics),
      regression: this.detectRegression(recentMetrics),
      recommendations: this.generateRecommendations(recentMetrics)
    };
  }

  detectRegression(metrics) {
    // P95 響應時間回歸檢測
    const p95Values = metrics.map(m => m.p95);
    const baseline = p95Values.slice(0, Math.floor(p95Values.length / 2));
    const recent = p95Values.slice(Math.floor(p95Values.length / 2));
    
    const baselineAvg = baseline.reduce((a, b) => a + b) / baseline.length;
    const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
    
    const degradation = (recentAvg - baselineAvg) / baselineAvg;
    
    return {
      hasRegression: degradation > 0.2, // 20% 效能下降視為回歸
      degradationPercent: Math.round(degradation * 100),
      severity: degradation > 0.5 ? 'critical' : degradation > 0.2 ? 'warning' : 'ok'
    };
  }
}
```

### 自動化效能報告
```javascript
// scripts/performance-report.js
class PerformanceReporter {
  async generateReport() {
    const metrics = await this.collectMetrics();
    const analysis = await this.analyzeMetrics(metrics);
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        overallScore: this.calculateOverallScore(metrics),
        criticalIssues: analysis.criticalIssues.length,
        recommendations: analysis.recommendations.length
      },
      webVitals: {
        lcp: this.getMetricSummary(metrics, 'lcp'),
        fid: this.getMetricSummary(metrics, 'fid'),
        cls: this.getMetricSummary(metrics, 'cls')
      },
      extensionMetrics: {
        startupTime: this.getMetricSummary(metrics, 'extension_startup'),
        memoryUsage: this.getMetricSummary(metrics, 'memory_usage'),
        apiPerformance: this.getMetricSummary(metrics, 'api_request')
      }
    };
    
    return report;
  }
}
```

## 🔧 實施指南

### Phase 1: 基礎監控建立 (1週)
```javascript
// 優先實施項目
const PHASE_1_METRICS = [
  'extension_startup',
  'popup_load_time', 
  'api_request_duration',
  'memory_usage'
];

// 設置基本收集器
const metricsCollector = new MetricsCollector();
PHASE_1_METRICS.forEach(metric => {
  metricsCollector.enableMetric(metric);
});
```

### Phase 2: Web Vitals 整合 (1週)
- 整合 Web Vitals 庫
- 設置 CLS、LCP、FID 監控
- 建立效能預算警報

### Phase 3: 進階分析與報告 (1週)
- 實作趨勢分析
- 自動化效能回歸檢測
- 建立效能報告系統

### Phase 4: 監控最佳化 (持續進行)
- 調整採樣率以降低效能影響
- 最佳化數據存儲和傳輸
- 建立效能最佳化回饋循環

## 🚨 效能警報設置

### 警報等級定義
```javascript
const ALERT_LEVELS = {
  INFO: { color: '#2196F3', urgent: false },
  WARNING: { color: '#FF9800', urgent: false },
  CRITICAL: { color: '#F44336', urgent: true }
};
```

### 警報觸發條件
- **Critical**: 任何核心指標超過臨界值
- **Warning**: 任何指標超過警告閾值
- **Info**: 效能趨勢變化通知

### 警報通知機制
- Chrome Storage API 本地通知
- Console 日誌記錄
- 開發環境下的 DevTools 警告

## 📚 相關資源

### 內部文件連結
- [記憶體最佳化指南](./memory-optimization.md)
- [載入效能優化](./loading-performance.md)  
- [效能測試方法](./performance-testing.md)
- [效能問題診斷](../troubleshooting/performance-troubleshooting.md)

### 外部參考資源
- [Web Vitals 官方指南](https://web.dev/vitals/)
- [Chrome DevTools Performance](https://developers.google.com/web/tools/chrome-devtools/performance)
- [Performance API 文件](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API)
- [Chrome Extension Performance](https://developer.chrome.com/docs/extensions/mv3/performance/)

## ✅ 監控檢查清單

設置完整監控系統的檢查項目：

- [ ] Web Vitals 指標收集 (LCP、FID、CLS)
- [ ] Extension 專用指標監控
- [ ] 記憶體使用量追蹤
- [ ] API 效能監控
- [ ] 效能預算設置與警報
- [ ] 自動化效能回歸檢測
- [ ] 效能報告生成機制
- [ ] 監控數據本地存儲
- [ ] 效能最佳化回饋循環

---

**🔍 監控體系已建立完成，開始收集效能數據並持續優化使用者體驗！**