# 📊 監控與警報系統

> **第三層參考文件** - 完整的生產環境監控與警報架構指南  
> **目標讀者**: DevOps 工程師、SRE 團隊、技術主管  
> **文件類型**: 監控與警報系統設計手册  

本文件提供 Readmoo 書庫提取器 Chrome Extension 的完整監控與警報系統設計，涵蓋生產環境監控、異常檢測、警報策略及事件回應流程。

## 🎯 監控體系總覽

### 監控架構設計原則
- **全面覆蓋**: 涵蓋所有關鍵系統和用戶體驗指標
- **即時響應**: 關鍵異常在 5 分鐘內觸發警報
- **分層警報**: 不同級別的問題採用不同的通知策略
- **可觀測性**: 提供完整的系統狀態可視性

### 四層監控架構
```
┌─────────────────────────────────────────────────────────────┐
│                     監控體系架構                         │
├─────────────────────────────────────────────────────────────┤
│  第一層: 🖥️ 基礎設施監控                              │
│    - Chrome Extension 運行狀態                           │
│    - Extension 安裝/卸載率                              │
│    - 系統資源使用情況                                    │
├─────────────────────────────────────────────────────────────┤
│  第二層: 🔧 應用程式監控                              │
│    - API 請求成功率                                     │
│    - 功能執行效能                                       │
│    - 錯誤率和異常分析                                    │
├─────────────────────────────────────────────────────────────┤
│  第三層: 👤 用戶體驗監控                              │
│    - 用戶互動追蹤                                       │
│    - 頁面載入時間                                       │
│    - 功能使用頻率                                       │
├─────────────────────────────────────────────────────────────┤
│  第四層: 💼 業務指標監控                              │
│    - Chrome Web Store 評分                            │
│    - 用戶增長與留存                                     │
│    - 功能採用率分析                                     │
└─────────────────────────────────────────────────────────────┘
```

## 🚨 核心警報系統

### 警報等級分類

#### 🔴 Critical (緊急)
**觸發條件**:
- Extension 完全無法運行
- 錯誤率 > 10%
- API 請求成功率 < 85%
- 大量用戶回報相同問題 (>50 個/小時)

**響應時間**: 立即 (0-5 分鐘)
**通知管道**: 電話、簡訊、Slack 急訊

#### 🟡 Warning (警告)
**觸發條件**:
- 錯誤率 > 5%
- API 響應時間 > 5 秒
- 內存使用量 > 80MB
- 用戶評分下降 > 0.5 星

**響應時間**: 30 分鐘內
**通知管道**: Slack、電子郵件

#### 🔵 Info (資訊)
**觸發條件**:
- 新版本發布通知
- 定期健康檢查報告
- 用戶數據統計摘要

**響應時間**: 不需要立即回應
**通知管道**: 電子郵件、Dashboard

### 智慧警報引擎

#### 異常檢測算法
```javascript
// src/monitoring/anomaly-detector.js
class AnomalyDetector {
  constructor() {
    this.baselineWindow = 7 * 24 * 60 * 60 * 1000; // 7天基線
    this.thresholds = {
      error_rate: {
        warning: 0.05,  // 5%
        critical: 0.10  // 10%
      },
      response_time: {
        warning: 3000,   // 3秒
        critical: 5000   // 5秒
      },
      memory_usage: {
        warning: 67108864,  // 64MB
        critical: 104857600 // 100MB
      }
    };
  }
  
  analyzeMetrics(currentMetrics, historicalData) {
    const anomalies = [];
    
    // 統計基線計算
    const baseline = this.calculateBaseline(historicalData);
    
    // 檢測錯誤率異常
    const errorRateAnomaly = this.detectErrorRateAnomaly(
      currentMetrics.error_rate, 
      baseline.error_rate
    );
    if (errorRateAnomaly) anomalies.push(errorRateAnomaly);
    
    // 檢測效能回歸
    const performanceAnomaly = this.detectPerformanceRegression(
      currentMetrics.response_time,
      baseline.response_time
    );
    if (performanceAnomaly) anomalies.push(performanceAnomaly);
    
    // 檢測記憶體洩漏
    const memoryAnomaly = this.detectMemoryLeak(
      currentMetrics.memory_usage,
      historicalData.memory_trend
    );
    if (memoryAnomaly) anomalies.push(memoryAnomaly);
    
    return anomalies;
  }
  
  detectErrorRateAnomaly(current, baseline) {
    const deviation = Math.abs(current - baseline.mean);
    const standardDeviation = baseline.stdDev;
    
    // Z-Score 異常檢測
    const zScore = deviation / standardDeviation;
    
    if (current > this.thresholds.error_rate.critical || zScore > 3) {
      return {
        type: 'error_rate',
        level: 'critical',
        message: `錯誤率異常高: ${(current * 100).toFixed(2)}%`,
        current_value: current,
        baseline_mean: baseline.mean,
        z_score: zScore
      };
    } else if (current > this.thresholds.error_rate.warning || zScore > 2) {
      return {
        type: 'error_rate',
        level: 'warning',
        message: `錯誤率偏高: ${(current * 100).toFixed(2)}%`,
        current_value: current,
        baseline_mean: baseline.mean,
        z_score: zScore
      };
    }
    
    return null;
  }
  
  detectPerformanceRegression(currentResponseTime, baselineResponseTime) {
    const regressionThreshold = 1.5; // 50% 效能回歸閾值
    const ratio = currentResponseTime / baselineResponseTime.mean;
    
    if (ratio > regressionThreshold && currentResponseTime > this.thresholds.response_time.critical) {
      return {
        type: 'performance_regression',
        level: 'critical',
        message: `嚴重效能回歸: ${currentResponseTime}ms`,
        regression_ratio: ratio,
        baseline_mean: baselineResponseTime.mean
      };
    } else if (ratio > 1.2 && currentResponseTime > this.thresholds.response_time.warning) {
      return {
        type: 'performance_regression',
        level: 'warning',
        message: `效能回歸警告: ${currentResponseTime}ms`,
        regression_ratio: ratio,
        baseline_mean: baselineResponseTime.mean
      };
    }
    
    return null;
  }
}
```

#### 警報去重與聚合
```javascript
// src/monitoring/alert-manager.js
class AlertManager {
  constructor() {
    this.activeAlerts = new Map();
    this.suppressionRules = {
      duplicate_window: 10 * 60 * 1000, // 10分鐘去重
      escalation_delay: 30 * 60 * 1000  // 30分鐘升級
    };
  }
  
  processAlert(alert) {
    const alertKey = this.generateAlertKey(alert);
    
    // 檢查是否為重複警報
    if (this.isDuplicateAlert(alertKey, alert)) {
      this.updateAlertCount(alertKey);
      return false; // 不發送重複警報
    }
    
    // 記錄新警報
    this.activeAlerts.set(alertKey, {
      ...alert,
      first_occurrence: Date.now(),
      count: 1,
      escalated: false
    });
    
    // 發送警報
    this.sendAlert(alert);
    
    // 設定升級檢查
    this.scheduleEscalation(alertKey, alert);
    
    return true;
  }
  
  isDuplicateAlert(alertKey, alert) {
    const existing = this.activeAlerts.get(alertKey);
    if (!existing) return false;
    
    const timeSinceFirst = Date.now() - existing.first_occurrence;
    return timeSinceFirst < this.suppressionRules.duplicate_window;
  }
  
  scheduleEscalation(alertKey, alert) {
    if (alert.level !== 'critical') return;
    
    setTimeout(() => {
      const activeAlert = this.activeAlerts.get(alertKey);
      if (activeAlert && !activeAlert.escalated) {
        // 升級至更高級別通知
        this.escalateAlert(activeAlert);
      }
    }, this.suppressionRules.escalation_delay);
  }
  
  escalateAlert(alert) {
    alert.escalated = true;
    
    // 發送升級通知 (電話/簡訊)
    this.sendEscalatedAlert({
      ...alert,
      message: `🚨 未處理的緊急警報: ${alert.message}`,
      escalated_at: Date.now()
    });
  }
}
```

## 📈 監控指標體系

### Chrome Extension 專用指標

#### 運行時指標收集
```javascript
// src/monitoring/extension-metrics.js
class ExtensionMetrics {
  constructor() {
    this.metricsBuffer = [];
    this.reportingInterval = 60000; // 1分鐘
    this.startPeriodicReporting();
  }
  
  collectRuntimeMetrics() {
    const metrics = {
      timestamp: Date.now(),
      extension_id: chrome.runtime.id,
      version: chrome.runtime.getManifest().version,
      
      // 系統資源指標
      memory: this.getMemoryUsage(),
      
      // 功能使用指標
      api_calls: this.getApiCallStats(),
      
      // 錯誤指標
      errors: this.getErrorStats(),
      
      // 用戶互動指標
      user_interactions: this.getUserInteractionStats(),
      
      // Chrome Store 指標
      store_metrics: this.getStoreMetrics()
    };
    
    this.metricsBuffer.push(metrics);
    return metrics;
  }
  
  getMemoryUsage() {
    if (!performance.memory) return null;
    
    return {
      used_heap_size: performance.memory.usedJSHeapSize,
      total_heap_size: performance.memory.totalJSHeapSize,
      heap_size_limit: performance.memory.jsHeapSizeLimit,
      usage_percentage: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100
    };
  }
  
  getApiCallStats() {
    const stats = this.getStoredStats('api_calls') || {
      total_calls: 0,
      successful_calls: 0,
      failed_calls: 0,
      average_response_time: 0
    };
    
    return {
      ...stats,
      success_rate: stats.total_calls > 0 ? stats.successful_calls / stats.total_calls : 0,
      error_rate: stats.total_calls > 0 ? stats.failed_calls / stats.total_calls : 0
    };
  }
  
  getErrorStats() {
    const errors = this.getStoredStats('errors') || {
      javascript_errors: 0,
      api_errors: 0,
      extension_errors: 0
    };
    
    return {
      ...errors,
      total_errors: errors.javascript_errors + errors.api_errors + errors.extension_errors,
      error_rate: this.calculateErrorRate(errors)
    };
  }
  
  getUserInteractionStats() {
    return this.getStoredStats('user_interactions') || {
      popup_opens: 0,
      button_clicks: 0,
      feature_usage: {},
      session_duration: 0
    };
  }
  
  startPeriodicReporting() {
    setInterval(() => {
      const metrics = this.collectRuntimeMetrics();
      this.reportMetrics(metrics);
    }, this.reportingInterval);
  }
  
  reportMetrics(metrics) {
    // 發送到本地存儲
    this.storeMetricsLocally(metrics);
    
    // 發送到監控服務 (如果有網路連接)
    if (navigator.onLine) {
      this.sendToMonitoringService(metrics);
    }
  }
}
```

#### 業務指標追蹤
```javascript
// src/monitoring/business-metrics.js
class BusinessMetrics {
  constructor() {
    this.userJourney = new UserJourneyTracker();
    this.featureAdoption = new FeatureAdoptionTracker();
  }
  
  trackUserJourney(event, data) {
    const journeyEvent = {
      timestamp: Date.now(),
      event_type: event,
      user_id: this.getUserId(),
      session_id: this.getSessionId(),
      data: data
    };
    
    this.userJourney.record(journeyEvent);
    
    // 即時分析關鍵業務指標
    this.analyzeBusinessImpact(journeyEvent);
  }
  
  analyzeBusinessImpact(event) {
    // 分析用戶流失點
    if (event.event_type === 'extension_error') {
      this.trackUserChurn(event);
    }
    
    // 分析功能採用率
    if (event.event_type === 'feature_first_use') {
      this.featureAdoption.recordFirstUse(event.data.feature_name);
    }
    
    // 分析用戶滿意度指標
    if (event.event_type === 'user_feedback') {
      this.analyzeUserSentiment(event.data);
    }
  }
  
  trackUserChurn(errorEvent) {
    const churnRisk = this.calculateChurnRisk(errorEvent);
    
    if (churnRisk > 0.7) { // 70% 流失風險閾值
      this.alertManager.processAlert({
        type: 'user_churn_risk',
        level: 'warning',
        message: `用戶流失風險較高: ${errorEvent.data.error_message}`,
        user_id: errorEvent.user_id,
        churn_risk_score: churnRisk
      });
    }
  }
}
```

### 外部服務監控

#### Chrome Web Store 指標監控
```javascript
// src/monitoring/store-monitor.js
class ChromeStoreMonitor {
  constructor() {
    this.storeApi = new ChromeWebStoreAPI();
    this.checkInterval = 6 * 60 * 60 * 1000; // 6小時檢查一次
    this.startMonitoring();
  }
  
  async monitorStoreMetrics() {
    try {
      const metrics = await this.fetchStoreMetrics();
      const analysis = this.analyzeStoreMetrics(metrics);
      
      // 檢查評分下降
      if (analysis.rating_decline > 0.5) {
        this.alertManager.processAlert({
          type: 'store_rating_decline',
          level: 'warning',
          message: `Chrome Store 評分下降 ${analysis.rating_decline} 星`,
          current_rating: metrics.rating,
          previous_rating: analysis.previous_rating
        });
      }
      
      // 檢查安裝率異常
      if (analysis.install_rate_change < -0.2) { // 20% 下降
        this.alertManager.processAlert({
          type: 'install_rate_decline',
          level: 'critical',
          message: `安裝率大幅下降: ${(analysis.install_rate_change * 100).toFixed(1)}%`,
          current_installs: metrics.weekly_installs,
          change_percentage: analysis.install_rate_change * 100
        });
      }
      
      return metrics;
    } catch (error) {
      this.alertManager.processAlert({
        type: 'store_api_error',
        level: 'warning',
        message: `無法獲取 Chrome Store 指標: ${error.message}`
      });
    }
  }
  
  async fetchStoreMetrics() {
    // 從 Chrome Web Store Developer API 獲取指標
    const response = await this.storeApi.getExtensionStats();
    
    return {
      rating: response.rating,
      rating_count: response.ratingCount,
      weekly_installs: response.weeklyInstalls,
      total_installs: response.totalInstalls,
      weekly_users: response.weeklyUsers,
      reviews: response.recentReviews
    };
  }
  
  startMonitoring() {
    this.monitorStoreMetrics(); // 立即執行一次
    
    setInterval(() => {
      this.monitorStoreMetrics();
    }, this.checkInterval);
  }
}
```

## 🔧 監控基礎設施

### 本地監控存儲系統

#### 數據存儲與管理
```javascript
// src/monitoring/local-storage.js
class MonitoringStorage {
  constructor() {
    this.storageQuota = 5 * 1024 * 1024; // 5MB 配額
    this.retentionPeriod = 30 * 24 * 60 * 60 * 1000; // 30天保留期
    this.compressionEnabled = true;
  }
  
  async storeMetrics(metrics) {
    try {
      // 壓縮數據以節省空間
      const compressedData = this.compressionEnabled 
        ? await this.compressData(metrics)
        : JSON.stringify(metrics);
      
      // 生成存儲鍵
      const storageKey = `metrics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 檢查存儲空間
      await this.ensureStorageSpace();
      
      // 存儲數據
      await chrome.storage.local.set({
        [storageKey]: {
          data: compressedData,
          timestamp: Date.now(),
          compressed: this.compressionEnabled
        }
      });
      
      return storageKey;
    } catch (error) {
      console.error('存儲監控數據失敗:', error);
      throw error;
    }
  }
  
  async ensureStorageSpace() {
    const usage = await chrome.storage.local.getBytesInUse();
    
    if (usage > this.storageQuota * 0.8) { // 80% 使用率觸發清理
      await this.cleanupOldData();
    }
  }
  
  async cleanupOldData() {
    const allData = await chrome.storage.local.get();
    const cutoffTime = Date.now() - this.retentionPeriod;
    const keysToRemove = [];
    
    Object.entries(allData).forEach(([key, value]) => {
      if (key.startsWith('metrics_') && value.timestamp < cutoffTime) {
        keysToRemove.push(key);
      }
    });
    
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log(`清理了 ${keysToRemove.length} 個過期的監控數據項目`);
    }
  }
  
  async queryMetrics(timeRange, metricTypes) {
    const allData = await chrome.storage.local.get();
    const results = [];
    
    Object.entries(allData).forEach(([key, value]) => {
      if (!key.startsWith('metrics_')) return;
      
      if (value.timestamp >= timeRange.start && value.timestamp <= timeRange.end) {
        const data = value.compressed 
          ? this.decompressData(value.data)
          : JSON.parse(value.data);
          
        // 過濾指標類型
        if (!metricTypes || metricTypes.some(type => data[type])) {
          results.push({
            timestamp: value.timestamp,
            data: data
          });
        }
      }
    });
    
    return results.sort((a, b) => a.timestamp - b.timestamp);
  }
}
```

#### 監控儀表板
```javascript
// src/monitoring/dashboard.js
class MonitoringDashboard {
  constructor() {
    this.storage = new MonitoringStorage();
    this.refreshInterval = 30000; // 30秒刷新
    this.charts = new Map();
  }
  
  async initialize() {
    await this.createDashboard();
    this.startAutoRefresh();
  }
  
  async createDashboard() {
    const dashboardHTML = `
      <div class="monitoring-dashboard">
        <div class="dashboard-header">
          <h2>📊 Extension 監控儀表板</h2>
          <div class="last-updated">最後更新: <span id="lastUpdated">-</span></div>
        </div>
        
        <div class="metrics-grid">
          <div class="metric-card critical-metrics">
            <h3>🚨 關鍵指標</h3>
            <div class="metric-value" id="errorRate">-</div>
            <div class="metric-label">錯誤率</div>
          </div>
          
          <div class="metric-card performance-metrics">
            <h3>⚡ 效能指標</h3>
            <div class="metric-value" id="responseTime">-</div>
            <div class="metric-label">平均響應時間</div>
          </div>
          
          <div class="metric-card memory-metrics">
            <h3>🧠 記憶體使用</h3>
            <div class="metric-value" id="memoryUsage">-</div>
            <div class="metric-label">記憶體使用率</div>
          </div>
          
          <div class="metric-card user-metrics">
            <h3>👥 用戶指標</h3>
            <div class="metric-value" id="activeUsers">-</div>
            <div class="metric-label">活躍用戶數</div>
          </div>
        </div>
        
        <div class="charts-container">
          <div class="chart-panel">
            <canvas id="errorRateChart"></canvas>
          </div>
          <div class="chart-panel">
            <canvas id="performanceChart"></canvas>
          </div>
        </div>
        
        <div class="alerts-panel">
          <h3>🔔 最近警報</h3>
          <div id="recentAlerts" class="alerts-list">
            <!-- 動態填充 -->
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', dashboardHTML);
    await this.setupCharts();
  }
  
  async refreshDashboard() {
    const currentTime = Date.now();
    const timeRange = {
      start: currentTime - (24 * 60 * 60 * 1000), // 24小時前
      end: currentTime
    };
    
    try {
      // 獲取監控數據
      const metrics = await this.storage.queryMetrics(timeRange);
      
      if (metrics.length === 0) {
        this.showNoDataMessage();
        return;
      }
      
      // 計算聚合指標
      const aggregated = this.aggregateMetrics(metrics);
      
      // 更新儀表板
      this.updateMetricCards(aggregated);
      this.updateCharts(metrics);
      this.updateAlertsPanel(aggregated.alerts);
      
      // 更新時間戳
      document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
      
    } catch (error) {
      console.error('刷新儀表板失敗:', error);
      this.showErrorMessage(error.message);
    }
  }
  
  aggregateMetrics(metrics) {
    const aggregated = {
      error_rate: 0,
      avg_response_time: 0,
      memory_usage: 0,
      active_users: 0,
      alerts: []
    };
    
    if (metrics.length === 0) return aggregated;
    
    let totalErrors = 0, totalRequests = 0;
    let totalResponseTime = 0, responseTimeCount = 0;
    let totalMemoryUsage = 0;
    const uniqueUsers = new Set();
    
    metrics.forEach(metric => {
      const data = metric.data;
      
      // 聚合錯誤率
      if (data.errors && data.api_calls) {
        totalErrors += data.errors.total_errors;
        totalRequests += data.api_calls.total_calls;
      }
      
      // 聚合響應時間
      if (data.api_calls && data.api_calls.average_response_time > 0) {
        totalResponseTime += data.api_calls.average_response_time;
        responseTimeCount++;
      }
      
      // 聚合記憶體使用
      if (data.memory && data.memory.usage_percentage) {
        totalMemoryUsage += data.memory.usage_percentage;
      }
      
      // 計算活躍用戶
      if (data.user_interactions && data.user_id) {
        uniqueUsers.add(data.user_id);
      }
    });
    
    // 計算平均值
    aggregated.error_rate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    aggregated.avg_response_time = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
    aggregated.memory_usage = metrics.length > 0 ? totalMemoryUsage / metrics.length : 0;
    aggregated.active_users = uniqueUsers.size;
    
    return aggregated;
  }
}
```

## 📱 通知與警報管道

### 多管道通知系統

#### Slack 整合
```javascript
// src/monitoring/notifications/slack.js
class SlackNotifier {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
    this.rateLimiter = new RateLimiter(10, 60000); // 10條/分鐘
  }
  
  async sendAlert(alert) {
    if (!this.rateLimiter.isAllowed()) {
      console.warn('Slack 通知頻率限制');
      return false;
    }
    
    const message = this.formatSlackMessage(alert);
    
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
      
      return response.ok;
    } catch (error) {
      console.error('發送 Slack 通知失敗:', error);
      return false;
    }
  }
  
  formatSlackMessage(alert) {
    const emoji = this.getAlertEmoji(alert.level);
    const color = this.getAlertColor(alert.level);
    
    return {
      text: `${emoji} Extension 監控警報`,
      attachments: [{
        color: color,
        fields: [
          {
            title: '警報類型',
            value: alert.type,
            short: true
          },
          {
            title: '嚴重程度',
            value: alert.level.toUpperCase(),
            short: true
          },
          {
            title: '描述',
            value: alert.message,
            short: false
          },
          {
            title: '時間',
            value: new Date(alert.timestamp).toLocaleString(),
            short: true
          }
        ],
        footer: 'Readmoo Extension Monitor',
        ts: Math.floor(alert.timestamp / 1000)
      }]
    };
  }
  
  getAlertEmoji(level) {
    const emojiMap = {
      'critical': '🚨',
      'warning': '⚠️',
      'info': 'ℹ️'
    };
    return emojiMap[level] || '📊';
  }
  
  getAlertColor(level) {
    const colorMap = {
      'critical': '#FF0000',
      'warning': '#FFA500',
      'info': '#0066CC'
    };
    return colorMap[level] || '#808080';
  }
}
```

#### 電子郵件通知
```javascript
// src/monitoring/notifications/email.js
class EmailNotifier {
  constructor() {
    this.templates = new EmailTemplates();
    this.rateLimiter = new RateLimiter(5, 60000); // 5封/分鐘
  }
  
  async sendAlert(alert, recipients) {
    if (!this.rateLimiter.isAllowed()) {
      console.warn('電子郵件通知頻率限制');
      return false;
    }
    
    const template = this.templates.getAlertTemplate(alert.level);
    const htmlContent = this.renderTemplate(template, alert);
    
    const emailData = {
      to: recipients,
      subject: this.generateSubject(alert),
      html: htmlContent,
      priority: alert.level === 'critical' ? 'high' : 'normal'
    };
    
    return await this.sendEmail(emailData);
  }
  
  generateSubject(alert) {
    const prefix = alert.level === 'critical' ? '🚨 緊急' : '⚠️ 警報';
    return `${prefix} - Readmoo Extension: ${alert.message}`;
  }
  
  renderTemplate(template, alert) {
    return template
      .replace('{{ALERT_LEVEL}}', alert.level)
      .replace('{{ALERT_MESSAGE}}', alert.message)
      .replace('{{ALERT_TYPE}}', alert.type)
      .replace('{{TIMESTAMP}}', new Date(alert.timestamp).toLocaleString())
      .replace('{{ADDITIONAL_DATA}}', this.formatAdditionalData(alert.data));
  }
}
```

### 警報升級機制

#### 自動升級流程
```javascript
// src/monitoring/escalation.js
class AlertEscalation {
  constructor() {
    this.escalationRules = [
      {
        level: 'critical',
        timeLimit: 15 * 60 * 1000, // 15分鐘
        actions: ['phone', 'sms', 'slack_urgent']
      },
      {
        level: 'warning',
        timeLimit: 60 * 60 * 1000, // 1小時
        actions: ['email', 'slack']
      }
    ];
    
    this.acknowledgments = new Map();
    this.escalationTimers = new Map();
  }
  
  processAlert(alert) {
    const rule = this.escalationRules.find(r => r.level === alert.level);
    if (!rule) return;
    
    // 立即發送初始通知
    this.sendInitialNotifications(alert, rule.actions);
    
    // 設置升級計時器
    if (alert.level === 'critical') {
      this.setEscalationTimer(alert, rule.timeLimit);
    }
  }
  
  setEscalationTimer(alert, timeLimit) {
    const alertKey = this.generateAlertKey(alert);
    
    const timer = setTimeout(() => {
      if (!this.isAcknowledged(alertKey)) {
        this.escalateAlert(alert);
      }
    }, timeLimit);
    
    this.escalationTimers.set(alertKey, timer);
  }
  
  escalateAlert(alert) {
    // 發送升級通知
    this.sendEscalatedNotifications(alert);
    
    // 記錄升級事件
    this.logEscalation(alert);
    
    // 通知管理層
    if (alert.level === 'critical') {
      this.notifyManagement(alert);
    }
  }
  
  acknowledgeAlert(alertKey, acknowledger) {
    this.acknowledgments.set(alertKey, {
      acknowledger: acknowledger,
      timestamp: Date.now()
    });
    
    // 取消升級計時器
    const timer = this.escalationTimers.get(alertKey);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(alertKey);
    }
  }
}
```

## 🔍 監控分析與報告

### 自動化報告系統

#### 每日監控報告
```javascript
// src/monitoring/reporting.js
class MonitoringReporter {
  constructor() {
    this.storage = new MonitoringStorage();
    this.scheduler = new ReportScheduler();
  }
  
  async generateDailyReport(date = new Date()) {
    const reportData = await this.collectDailyMetrics(date);
    const analysis = await this.analyzeMetrics(reportData);
    
    const report = {
      date: date.toISOString().split('T')[0],
      summary: this.generateSummary(analysis),
      metrics: reportData,
      alerts: analysis.alerts,
      recommendations: analysis.recommendations,
      trends: analysis.trends
    };
    
    // 生成不同格式的報告
    const htmlReport = this.generateHTMLReport(report);
    const markdownReport = this.generateMarkdownReport(report);
    
    // 發送報告
    await this.distributeReport(report, htmlReport, markdownReport);
    
    return report;
  }
  
  generateSummary(analysis) {
    const summary = {
      overall_health: this.calculateOverallHealth(analysis),
      key_issues: analysis.critical_issues,
      performance_score: analysis.performance_score,
      availability: analysis.availability_percentage
    };
    
    // 生成建議
    if (summary.overall_health < 0.8) {
      summary.action_required = true;
      summary.priority_actions = this.generatePriorityActions(analysis);
    }
    
    return summary;
  }
  
  calculateOverallHealth(analysis) {
    const weights = {
      error_rate: 0.3,
      performance: 0.25,
      availability: 0.25,
      user_satisfaction: 0.2
    };
    
    const scores = {
      error_rate: Math.max(0, 1 - (analysis.error_rate / 0.1)), // 10%為最低分
      performance: Math.max(0, 1 - (analysis.avg_response_time / 10000)), // 10s為最低分
      availability: analysis.availability_percentage / 100,
      user_satisfaction: analysis.user_satisfaction_score / 5 // 5星為滿分
    };
    
    return Object.entries(weights).reduce((total, [key, weight]) => {
      return total + (scores[key] * weight);
    }, 0);
  }
  
  async distributeReport(report, htmlReport, markdownReport) {
    const recipients = await this.getReportRecipients();
    
    // 發送 HTML 報告至管理層
    await this.emailNotifier.sendReport(
      recipients.management,
      '📊 Readmoo Extension 每日監控報告',
      htmlReport
    );
    
    // 發送摘要至 Slack
    await this.slackNotifier.sendReportSummary(report.summary);
    
    // 存儲報告供後續分析
    await this.storage.storeReport(report);
  }
}
```

#### 趨勢分析與預測
```javascript
// src/monitoring/trend-analyzer.js
class TrendAnalyzer {
  constructor() {
    this.storage = new MonitoringStorage();
    this.predictionModels = new Map();
  }
  
  async analyzeTrends(metricType, timeRange = 30) {
    const historicalData = await this.getHistoricalData(metricType, timeRange);
    
    if (historicalData.length < 7) {
      return { status: 'insufficient_data' };
    }
    
    const trends = {
      direction: this.calculateTrendDirection(historicalData),
      strength: this.calculateTrendStrength(historicalData),
      prediction: await this.predictFutureTrend(historicalData),
      anomalies: this.detectAnomalies(historicalData),
      seasonality: this.analyzeSeasonality(historicalData)
    };
    
    return trends;
  }
  
  calculateTrendDirection(data) {
    const n = data.length;
    if (n < 2) return 'stable';
    
    const firstHalf = data.slice(0, Math.floor(n/2));
    const secondHalf = data.slice(Math.floor(n/2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b.value, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (Math.abs(change) < 0.05) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }
  
  async predictFutureTrend(historicalData) {
    const model = this.getOrCreatePredictionModel(historicalData);
    const prediction = model.predict(7); // 預測未來7天
    
    return {
      values: prediction.values,
      confidence: prediction.confidence,
      warning_threshold: prediction.warningThreshold
    };
  }
  
  detectAnomalies(data) {
    const values = data.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length);
    
    const anomalies = data.filter(d => {
      const zScore = Math.abs((d.value - mean) / stdDev);
      return zScore > 2.5; // 2.5 標準差為異常閾值
    });
    
    return anomalies.map(a => ({
      timestamp: a.timestamp,
      value: a.value,
      severity: this.calculateAnomalySeverity(a.value, mean, stdDev)
    }));
  }
}
```

## 📚 相關資源

### 內部文件連結
- [效能監控體系](../performance/monitoring-system.md)
- [CI/CD 流水線設計](./cicd-pipeline.md)
- [Chrome Store 上架指南](./chrome-store-guide.md)
- [版本發布策略](./release-strategy.md)

### 外部參考資源
- [Chrome Extension Performance API](https://developer.chrome.com/docs/extensions/reference/performance/)
- [Web Vitals 指標說明](https://web.dev/vitals/)
- [Slack Webhook API](https://api.slack.com/messaging/webhooks)
- [Chrome Web Store Developer API](https://developers.google.com/webstore/api/)

## ✅ 監控系統檢查清單

完整的監控系統設置檢查項目：

### 基礎監控設置
- [ ] Extension 運行時監控已啟用
- [ ] 記憶體使用量追蹤正常運行
- [ ] API 請求監控已配置
- [ ] 錯誤捕獲與報告機制就緒
- [ ] 用戶互動追蹤已實施

### 警報系統配置
- [ ] 警報等級與閾值已定義
- [ ] 多管道通知系統已設置 (Slack, Email)
- [ ] 警報去重與聚合機制運行正常
- [ ] 升級流程與時間限制已配置
- [ ] 警報確認與解除機制正常

### 監控儀表板
- [ ] 即時監控儀表板可正常訪問
- [ ] 關鍵指標顯示正確
- [ ] 歷史數據查詢功能正常
- [ ] 圖表與視覺化元件運行良好
- [ ] 警報面板顯示最新狀態

### 數據管理
- [ ] 本地存儲系統運行正常
- [ ] 數據壓縮與清理機制啟用
- [ ] 存儲空間監控與管理
- [ ] 數據保留政策已實施
- [ ] 備份與恢復機制就緒

### 報告與分析
- [ ] 自動化日報生成正常
- [ ] 趨勢分析功能運行
- [ ] 異常檢測算法已啟用
- [ ] 預測模型正常運作
- [ ] 報告分發機制正確設置

### 外部整合
- [ ] Chrome Web Store 指標監控
- [ ] 第三方服務狀態監控
- [ ] API 整合測試通過
- [ ] 網絡連接檢測機制
- [ ] 故障轉移機制就緒

---

**📊 監控與警報系統已完整建立，確保 Extension 的高可用性和優異性能！**