# 🚨 生產環境事件處理

## 📋 總覽

Chrome Extension 生產環境事件處理指南，涵蓋問題分級、應急響應、修復流程和事後分析的完整事件管理體系。

## 🎯 事件分級系統

### 嚴重等級定義

#### **P0 - 嚴重 (Critical)**
- 完全無法使用，影響所有用戶
- 數據丟失或安全漏洞
- 響應時間：15分鐘內
- 解決時間：2小時內

#### **P1 - 高 (High)**  
- 功能重大缺陷，影響多數用戶
- 效能嚴重下降
- 響應時間：1小時內
- 解決時間：4小時內

#### **P2 - 中 (Medium)**
- 部分功能異常，影響部分用戶
- 可使用替代方案
- 響應時間：4小時內
- 解決時間：24小時內

#### **P3 - 低 (Low)**
- 次要功能問題，用戶體驗稍差
- 非關鍵功能
- 響應時間：24小時內
- 解決時間：72小時內

### 自動分級檢測

```javascript
// 事件自動分級系統
class IncidentClassifier {
  constructor() {
    this.severityRules = {
      P0: [
        { type: 'error_rate', threshold: 0.5 },        // 錯誤率超過50%
        { type: 'availability', threshold: 0.95 },      // 可用性低於95%
        { type: 'user_impact', threshold: 1000 },       // 影響用戶超過1000
        { type: 'security', pattern: /security|breach|leak/i }
      ],
      P1: [
        { type: 'error_rate', threshold: 0.2 },        // 錯誤率20-50%
        { type: 'response_time', threshold: 5000 },     // 響應時間超過5秒
        { type: 'user_impact', threshold: 100 },        // 影響用戶100-1000
        { type: 'functionality', pattern: /extraction|core/i }
      ],
      P2: [
        { type: 'error_rate', threshold: 0.05 },       // 錯誤率5-20%
        { type: 'response_time', threshold: 3000 },     // 響應時間3-5秒
        { type: 'user_impact', threshold: 10 },         // 影響用戶10-100
      ]
    };
  }

  classifyIncident(incident) {
    const { errorRate, responseTime, affectedUsers, description } = incident;
    
    // 檢查P0條件
    if (this.matchesSeverity(incident, 'P0')) {
      return {
        severity: 'P0',
        urgency: 'CRITICAL',
        autoEscalate: true,
        notificationChannels: ['slack-critical', 'email-management', 'sms']
      };
    }
    
    // 檢查P1條件
    if (this.matchesSeverity(incident, 'P1')) {
      return {
        severity: 'P1',
        urgency: 'HIGH',
        autoEscalate: false,
        notificationChannels: ['slack-alerts', 'email-team']
      };
    }
    
    // 檢查P2條件
    if (this.matchesSeverity(incident, 'P2')) {
      return {
        severity: 'P2',
        urgency: 'MEDIUM',
        autoEscalate: false,
        notificationChannels: ['slack-general']
      };
    }
    
    // 預設P3
    return {
      severity: 'P3',
      urgency: 'LOW',
      autoEscalate: false,
      notificationChannels: ['ticket-system']
    };
  }

  matchesSeverity(incident, severity) {
    const rules = this.severityRules[severity];
    
    return rules.some(rule => {
      switch (rule.type) {
        case 'error_rate':
          return incident.errorRate >= rule.threshold;
        case 'availability':
          return incident.availability < rule.threshold;
        case 'response_time':
          return incident.responseTime >= rule.threshold;
        case 'user_impact':
          return incident.affectedUsers >= rule.threshold;
        case 'security':
        case 'functionality':
          return rule.pattern.test(incident.description);
        default:
          return false;
      }
    });
  }
}
```

## 🔥 應急響應流程

### 事件響應團隊

#### **角色與職責**

**事件指揮官 (Incident Commander)**:
- 整體事件協調
- 決策制定和優先級排序
- 對外溝通協調

**技術主導 (Technical Lead)**:
- 技術診斷和修復方案
- 工程團隊協調
- 修復進度追蹤

**溝通協調員 (Communications Lead)**:
- 狀態更新發布
- 用戶溝通
- 利益相關者通知

### 響應流程自動化

```javascript
// 自動事件響應系統
class IncidentResponse {
  constructor() {
    this.responseTeam = new Map();
    this.communicationChannels = new Map();
    this.escalationChain = [];
  }

  async handleIncident(incident) {
    // 1. 事件分級
    const classification = this.classifyIncident(incident);
    
    // 2. 自動通知
    await this.notifyResponseTeam(classification);
    
    // 3. 建立事件記錄
    const incidentRecord = await this.createIncidentRecord(incident, classification);
    
    // 4. 啟動響應流程
    await this.initiateResponse(incidentRecord);
    
    return incidentRecord;
  }

  async notifyResponseTeam(classification) {
    const notifications = [];
    
    for (const channel of classification.notificationChannels) {
      switch (channel) {
        case 'slack-critical':
          notifications.push(this.sendSlackAlert({
            channel: '#incident-critical',
            urgency: 'CRITICAL',
            mentions: ['@here', '@incident-commander']
          }));
          break;
          
        case 'email-management':
          notifications.push(this.sendEmail({
            to: ['management@company.com'],
            subject: `[P0] Critical Incident - Readmoo Extension`,
            urgency: 'HIGH'
          }));
          break;
          
        case 'sms':
          notifications.push(this.sendSMS({
            numbers: this.getOnCallNumbers(),
            message: 'Critical incident detected - Readmoo Extension'
          }));
          break;
      }
    }
    
    await Promise.all(notifications);
  }

  async createIncidentRecord(incident, classification) {
    const record = {
      id: `INC-${Date.now()}`,
      title: this.generateIncidentTitle(incident),
      severity: classification.severity,
      status: 'INVESTIGATING',
      created: new Date().toISOString(),
      affectedServices: ['readmoo-extension'],
      timeline: [],
      assignedTeam: [],
      resolution: null,
      postmortem: null
    };

    // 儲存到事件管理系統
    await this.saveIncidentRecord(record);
    
    return record;
  }

  generateIncidentTitle(incident) {
    if (incident.errorType) {
      return `${incident.errorType} - ${incident.component}`;
    }
    
    if (incident.alertName) {
      return incident.alertName;
    }
    
    return `Service Disruption - ${new Date().toISOString()}`;
  }
}
```

### P0事件響應清單

```markdown
## P0 事件響應檢查清單

### 立即響應 (0-15分鐘)
- [ ] **確認事件影響範圍**
  - 影響用戶數量
  - 受影響功能
  - 業務影響評估
  
- [ ] **組建響應團隊**
  - 指派事件指揮官
  - 召集技術主導
  - 啟動溝通協調員
  
- [ ] **建立溝通管道**
  - 建立專用 Slack 頻道
  - 設定狀態頁面
  - 準備用戶通知

### 診斷階段 (15-60分鐘)
- [ ] **收集診斷資訊**
  - 檢查監控面板
  - 收集錯誤日誌
  - 分析用戶回報
  
- [ ] **識別根本原因**
  - 檢查最近部署
  - 分析系統變更
  - 確認基礎設施狀態
  
- [ ] **評估修復方案**
  - 快速修復 vs 完整修復
  - 風險評估
  - 所需資源

### 修復階段 (1-2小時)
- [ ] **執行修復措施**
  - 實施臨時修復
  - 驗證修復效果
  - 監控系統穩定性
  
- [ ] **用戶溝通**
  - 發布事件通知
  - 提供進度更新
  - 設定修復預期時間
```

## 🔧 修復執行流程

### 緊急修復決策樹

```javascript
// 修復決策系統
class RepairDecisionEngine {
  constructor() {
    this.repairStrategies = {
      ROLLBACK: {
        timeToRestore: 300,        // 5分鐘
        riskLevel: 'LOW',
        dataLossRisk: false,
        applicableWhen: ['deployment', 'configuration']
      },
      HOTFIX: {
        timeToRestore: 1800,       // 30分鐘
        riskLevel: 'MEDIUM',
        dataLossRisk: false,
        applicableWhen: ['code-bug', 'logic-error']
      },
      SERVICE_RESTART: {
        timeToRestore: 120,        // 2分鐘
        riskLevel: 'LOW',
        dataLossRisk: false,
        applicableWhen: ['memory-leak', 'connection-issue']
      },
      INFRASTRUCTURE_SCALE: {
        timeToRestore: 600,        // 10分鐘
        riskLevel: 'LOW',
        dataLossRisk: false,
        applicableWhen: ['capacity', 'performance']
      }
    };
  }

  recommendRepairStrategy(incident) {
    const { rootCause, severity, affectedUsers, dataAtRisk } = incident;
    
    // P0事件優先考慮最快恢復
    if (severity === 'P0') {
      if (this.canRollback(incident)) {
        return this.repairStrategies.ROLLBACK;
      }
      
      if (this.canRestart(incident)) {
        return this.repairStrategies.SERVICE_RESTART;
      }
    }
    
    // 根據根本原因選擇策略
    const applicableStrategies = Object.entries(this.repairStrategies)
      .filter(([_, strategy]) => strategy.applicableWhen.includes(rootCause))
      .sort((a, b) => a[1].timeToRestore - b[1].timeToRestore);
    
    if (applicableStrategies.length > 0) {
      return applicableStrategies[0][1];
    }
    
    // 預設策略
    return this.repairStrategies.HOTFIX;
  }

  canRollback(incident) {
    const timeSinceLastDeploy = Date.now() - incident.lastDeployTime;
    const rollbackWindow = 3600000; // 1小時
    
    return timeSinceLastDeploy < rollbackWindow && 
           incident.rootCause === 'deployment';
  }

  canRestart(incident) {
    return ['memory-leak', 'connection-issue', 'resource-exhaustion']
      .includes(incident.rootCause);
  }
}
```

### 自動回滾機制

```javascript
// Chrome Extension 自動回滾系統
class ExtensionRollback {
  constructor() {
    this.rollbackHistory = [];
    this.maxRollbackAttempts = 3;
  }

  async executeRollback(incidentId, targetVersion) {
    const rollbackOperation = {
      incidentId,
      targetVersion,
      startTime: Date.now(),
      status: 'IN_PROGRESS',
      steps: []
    };

    try {
      // 1. 驗證目標版本
      await this.validateTargetVersion(targetVersion);
      rollbackOperation.steps.push('Target version validated');

      // 2. 準備回滾環境
      await this.prepareRollbackEnvironment();
      rollbackOperation.steps.push('Rollback environment prepared');

      // 3. 執行回滾
      await this.performRollback(targetVersion);
      rollbackOperation.steps.push('Rollback executed');

      // 4. 驗證回滾成功
      await this.verifyRollback(targetVersion);
      rollbackOperation.steps.push('Rollback verified');

      // 5. 更新配置
      await this.updateConfiguration(targetVersion);
      rollbackOperation.steps.push('Configuration updated');

      rollbackOperation.status = 'COMPLETED';
      rollbackOperation.endTime = Date.now();

    } catch (error) {
      rollbackOperation.status = 'FAILED';
      rollbackOperation.error = error.message;
      rollbackOperation.endTime = Date.now();
      
      throw new Error(`Rollback failed: ${error.message}`);
    } finally {
      this.rollbackHistory.push(rollbackOperation);
      await this.logRollbackResult(rollbackOperation);
    }

    return rollbackOperation;
  }

  async performRollback(targetVersion) {
    // Chrome Extension 回滾步驟
    const rollbackSteps = [
      () => this.stopCurrentVersion(),
      () => this.restorePreviousVersion(targetVersion),
      () => this.clearCache(),
      () => this.restartExtension(),
      () => this.runHealthCheck()
    ];

    for (const step of rollbackSteps) {
      await step();
      await this.delay(1000); // 等待1秒確保步驟完成
    }
  }

  async runHealthCheck() {
    const healthChecks = [
      this.checkExtensionLoad,
      this.checkCoreFeatures,
      this.checkUserInterface,
      this.checkDataIntegrity
    ];

    const results = await Promise.allSettled(
      healthChecks.map(check => check.call(this))
    );

    const failures = results.filter(r => r.status === 'rejected');
    
    if (failures.length > 0) {
      throw new Error(`Health check failed: ${failures.length} checks failed`);
    }

    return { status: 'HEALTHY', checksRun: results.length };
  }
}
```

## 📊 事件監控與追蹤

### 實時事件面板

```javascript
// 事件監控面板
class IncidentDashboard {
  constructor() {
    this.activeIncidents = new Map();
    this.metricsCollector = new MetricsCollector();
    this.alertSystem = new AlertSystem();
  }

  async initializeDashboard() {
    // 設定實時監控
    this.startRealTimeMonitoring();
    
    // 載入歷史事件
    await this.loadHistoricalData();
    
    // 啟動告警系統
    this.alertSystem.start();
  }

  startRealTimeMonitoring() {
    // 監控關鍵指標
    const criticalMetrics = [
      'error_rate',
      'response_time',
      'active_users',
      'extension_crashes',
      'api_failures'
    ];

    criticalMetrics.forEach(metric => {
      this.metricsCollector.monitor(metric, {
        interval: 30000, // 30秒
        threshold: this.getThreshold(metric),
        onThresholdExceeded: (data) => this.handleThresholdBreach(metric, data)
      });
    });
  }

  getThreshold(metric) {
    const thresholds = {
      error_rate: 0.05,           // 5%
      response_time: 3000,        // 3秒
      active_users: -0.3,         // 30%下降
      extension_crashes: 10,      // 10次/小時
      api_failures: 0.1          // 10%
    };

    return thresholds[metric];
  }

  async handleThresholdBreach(metric, data) {
    const severity = this.calculateSeverity(metric, data);
    
    if (severity >= 'P1') {
      const incident = await this.createIncident({
        type: 'THRESHOLD_BREACH',
        metric,
        severity,
        data,
        detectedAt: new Date().toISOString()
      });

      await this.escalateIncident(incident);
    }
  }

  generateStatusReport() {
    const report = {
      timestamp: new Date().toISOString(),
      overallStatus: this.getOverallStatus(),
      activeIncidents: Array.from(this.activeIncidents.values()),
      systemMetrics: this.metricsCollector.getCurrentMetrics(),
      recentEvents: this.getRecentEvents()
    };

    return report;
  }

  getOverallStatus() {
    const activeP0 = Array.from(this.activeIncidents.values())
      .filter(i => i.severity === 'P0').length;
    
    const activeP1 = Array.from(this.activeIncidents.values())
      .filter(i => i.severity === 'P1').length;

    if (activeP0 > 0) return 'CRITICAL';
    if (activeP1 > 0) return 'DEGRADED';
    return 'OPERATIONAL';
  }
}
```

## 📋 事後分析流程

### Postmortem 流程

#### **無責備事後分析原則**
- 專注於系統問題，非個人責任
- 學習導向，非懲罰導向
- 透明開放的討論環境
- 持續改善的行動方案

#### **Postmortem 模板**

```markdown
# 事件事後分析報告

## 基本資訊
- **事件ID**: INC-2024-001
- **事件標題**: Chrome Extension 書籍提取功能完全失效
- **嚴重等級**: P0
- **發生時間**: 2024-01-15 14:30 UTC
- **恢復時間**: 2024-01-15 16:45 UTC
- **總持續時間**: 2小時15分鐘
- **影響用戶**: 約 15,000 名活躍用戶

## 事件摘要
簡述事件的影響和根本原因

## 事件時間線
| 時間 | 事件 | 負責人 |
|------|------|--------|
| 14:30 | 用戶開始回報提取失敗 | - |
| 14:35 | 監控告警觸發 | 系統 |
| 14:45 | 事件確認，啟動P0響應 | @incident-commander |
| 15:00 | 識別根本原因 | @tech-lead |
| 15:30 | 部署修復 | @dev-team |
| 16:45 | 服務完全恢復 | @tech-lead |

## 根本原因分析
### 直接原因
描述導致事件的直接技術原因

### 根本原因
使用 5 Why 分析法深入探討

1. 為什麼書籍提取功能失效？
   - API 回傳 500 錯誤

2. 為什麼 API 回傳 500 錯誤？
   - 資料庫連接池耗盡

3. 為什麼資料庫連接池耗盡？
   - 查詢效能問題導致連接未正常釋放

4. 為什麼查詢效能突然變差？
   - 缺少必要的索引

5. 為什麼缺少索引？
   - 部署流程未包含數據庫遷移檢查

## 修復措施
描述執行的修復動作

## 學習重點
事件中學到的重要經驗

## 行動項目
| 行動項目 | 負責人 | 預計完成時間 | 狀態 |
|----------|--------|--------------|------|
| 新增資料庫索引 | @db-team | 2024-01-20 | 進行中 |
| 改善部署檢查流程 | @devops-team | 2024-01-25 | 未開始 |
| 強化監控告警 | @monitoring-team | 2024-01-30 | 未開始 |

## 預防措施
防止類似事件再次發生的長期改善計劃
```

### 自動化分析工具

```javascript
// 事後分析輔助工具
class PostmortemAnalyzer {
  constructor() {
    this.analysisTools = {
      timeline: new TimelineAnalyzer(),
      impact: new ImpactCalculator(),
      rootCause: new RootCauseAnalyzer()
    };
  }

  async generatePostmortemData(incident) {
    const data = {
      basicInfo: this.extractBasicInfo(incident),
      timeline: await this.analysisTools.timeline.analyze(incident),
      impact: await this.analysisTools.impact.calculate(incident),
      rootCauses: await this.analysisTools.rootCause.identify(incident),
      recommendations: this.generateRecommendations(incident)
    };

    return data;
  }

  generateRecommendations(incident) {
    const recommendations = [];
    
    // 基於事件類型的建議
    if (incident.rootCause === 'deployment') {
      recommendations.push({
        category: 'DEPLOYMENT',
        priority: 'HIGH',
        description: '改善部署前檢查流程',
        actionItems: [
          '新增自動化測試',
          '實施分階段部署',
          '強化回滾機制'
        ]
      });
    }

    if (incident.detectionDelay > 600000) { // 超過10分鐘
      recommendations.push({
        category: 'MONITORING',
        priority: 'HIGH',
        description: '改善事件檢測速度',
        actionItems: [
          '新增實時告警',
          '優化監控指標',
          '設定更敏感的閾值'
        ]
      });
    }

    return recommendations;
  }

  calculateMTTR(incident) {
    const detectionTime = incident.detectedAt - incident.startTime;
    const responseTime = incident.responseStartAt - incident.detectedAt;
    const resolutionTime = incident.resolvedAt - incident.responseStartAt;

    return {
      meanTimeToDetect: detectionTime,
      meanTimeToRespond: responseTime,
      meanTimeToResolve: resolutionTime,
      totalMTTR: incident.resolvedAt - incident.startTime
    };
  }
}
```

## 🔄 持續改善機制

### 改善追蹤系統

```javascript
// 事件改善追蹤系統
class ImprovementTracker {
  constructor() {
    this.actionItems = new Map();
    this.metrics = {
      incidentFrequency: [],
      mttr: [],
      preventionRate: 0
    };
  }

  trackActionItem(item) {
    const actionItem = {
      id: this.generateId(),
      title: item.title,
      description: item.description,
      priority: item.priority,
      assignee: item.assignee,
      dueDate: item.dueDate,
      status: 'OPEN',
      createdAt: new Date(),
      relatedIncidents: item.relatedIncidents || []
    };

    this.actionItems.set(actionItem.id, actionItem);
    
    // 設定提醒
    this.scheduleReminders(actionItem);
    
    return actionItem;
  }

  async scheduleReminders(actionItem) {
    const reminderSchedule = [
      { days: 7, type: 'WEEKLY_REMINDER' },
      { days: 3, type: 'URGENT_REMINDER' },
      { days: 0, type: 'OVERDUE_ALERT' }
    ];

    for (const reminder of reminderSchedule) {
      const reminderDate = new Date(actionItem.dueDate);
      reminderDate.setDate(reminderDate.getDate() - reminder.days);

      setTimeout(() => {
        this.sendReminder(actionItem, reminder.type);
      }, reminderDate.getTime() - Date.now());
    }
  }

  generateMetricsReport() {
    const report = {
      period: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前
        end: new Date()
      },
      incidentStats: this.calculateIncidentStats(),
      improvementProgress: this.calculateImprovementProgress(),
      preventionEffectiveness: this.calculatePreventionEffectiveness()
    };

    return report;
  }

  calculatePreventionEffectiveness() {
    const completedActions = Array.from(this.actionItems.values())
      .filter(item => item.status === 'COMPLETED');
    
    const preventedIncidents = completedActions.reduce((count, action) => {
      // 計算由於改善措施而防止的潜在事件
      return count + (action.estimatedPreventions || 0);
    }, 0);

    return {
      completedActions: completedActions.length,
      estimatedPreventedIncidents: preventedIncidents,
      preventionROI: this.calculatePreventionROI(preventedIncidents)
    };
  }
}
```

---

## 📚 相關文件參考

- [監控告警系統](../deployment/monitoring-alerts.md) - 事件檢測和告警配置
- [效能問題診斷](./performance-troubleshooting.md) - 技術問題診斷方法
- [Chrome Extension 部署](../deployment/chrome-extension.md) - 部署相關問題處理

---

**🚨 重要提醒**: 生產事件處理重在快速響應和有效溝通，持續改善機制是防範未來事件的關鍵