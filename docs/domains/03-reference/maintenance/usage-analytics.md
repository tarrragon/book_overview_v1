# 📊 文件使用統計分析

> **第三層參考文件** - 完整統計分析系統與優化策略  
> **適用對象**: 文件管理員、專案維護者、效率分析師  
> **預期閱讀時間**: 45-60 分鐘  

## 🎯 概述

本文件提供完整的文件使用統計分析系統，包含自動化統計收集、模式分析、效果評估和優化建議。透過系統化的數據收集和分析，持續改善文件品質和使用體驗。

## 📊 統計收集架構

### 數據收集層級

#### L1: 基本訪問統計
```javascript
class BasicUsageTracker {
  constructor() {
    this.viewCounts = new Map();
    this.sessionData = new Map();
    this.lastAccess = new Map();
  }

  trackView(documentPath, userId = 'anonymous') {
    const key = `${documentPath}:${userId}`;
    const now = new Date();
    
    // 更新訪問次數
    this.viewCounts.set(key, (this.viewCounts.get(key) || 0) + 1);
    
    // 記錄會話數據
    if (!this.sessionData.has(key)) {
      this.sessionData.set(key, {
        firstVisit: now,
        totalSessions: 1,
        totalTime: 0
      });
    }
    
    this.lastAccess.set(key, now);
    
    return {
      totalViews: this.viewCounts.get(key),
      isReturningUser: this.sessionData.get(key).totalSessions > 1
    };
  }

  getPopularDocuments(limit = 10) {
    const aggregated = new Map();
    
    for (const [key, count] of this.viewCounts) {
      const [path] = key.split(':');
      aggregated.set(path, (aggregated.get(path) || 0) + count);
    }
    
    return Array.from(aggregated.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([path, views]) => ({ path, views }));
  }
}
```

#### L2: 深度閱讀分析
```javascript
class ReadingPatternAnalyzer {
  constructor() {
    this.scrollPatterns = new Map();
    this.timeSpent = new Map();
    this.completionRates = new Map();
  }

  trackScrollBehavior(documentPath, scrollData) {
    const pattern = {
      maxScroll: scrollData.maxScrollPercentage,
      scrollSpeed: scrollData.avgScrollSpeed,
      backtrackCount: scrollData.backtrackEvents,
      pausePoints: scrollData.longPauses,
      timestamp: new Date()
    };
    
    if (!this.scrollPatterns.has(documentPath)) {
      this.scrollPatterns.set(documentPath, []);
    }
    
    this.scrollPatterns.get(documentPath).push(pattern);
    return this.analyzePattern(documentPath);
  }

  analyzePattern(documentPath) {
    const patterns = this.scrollPatterns.get(documentPath) || [];
    if (patterns.length === 0) return null;
    
    const avgCompletion = patterns.reduce((sum, p) => sum + p.maxScroll, 0) / patterns.length;
    const avgBacktracks = patterns.reduce((sum, p) => sum + p.backtrackCount, 0) / patterns.length;
    
    return {
      averageCompletionRate: Math.round(avgCompletion),
      averageBacktracks: Math.round(avgBacktracks * 10) / 10,
      readingDifficulty: this.assessDifficulty(avgBacktracks, avgCompletion),
      recommendations: this.generateRecommendations(avgBacktracks, avgCompletion)
    };
  }

  assessDifficulty(backtracks, completion) {
    if (backtracks > 3 && completion < 50) return 'HIGH';
    if (backtracks > 1.5 && completion < 70) return 'MEDIUM';
    return 'LOW';
  }

  generateRecommendations(backtracks, completion) {
    const recommendations = [];
    
    if (completion < 50) {
      recommendations.push('考慮縮短文件長度或增加章節分段');
    }
    
    if (backtracks > 2) {
      recommendations.push('增加內部連結和快速導覽功能');
      recommendations.push('考慮重組內容結構，提高邏輯流暢度');
    }
    
    if (completion > 80 && backtracks < 1) {
      recommendations.push('此文件結構良好，可作為其他文件的參考範本');
    }
    
    return recommendations;
  }
}
```

#### L3: 使用效果評估
```javascript
class UsageEffectivenessEvaluator {
  constructor() {
    this.actionTracking = new Map();
    this.problemResolution = new Map();
    this.userFeedback = new Map();
  }

  trackPostReadingAction(documentPath, actionType, success) {
    const key = `${documentPath}:${actionType}`;
    
    if (!this.actionTracking.has(key)) {
      this.actionTracking.set(key, {
        attempts: 0,
        successes: 0,
        failures: 0,
        successRate: 0
      });
    }
    
    const data = this.actionTracking.get(key);
    data.attempts++;
    
    if (success) {
      data.successes++;
    } else {
      data.failures++;
    }
    
    data.successRate = Math.round((data.successes / data.attempts) * 100);
    
    return {
      documentEffectiveness: this.calculateEffectiveness(data),
      improvementSuggestions: this.suggestImprovements(data, actionType)
    };
  }

  calculateEffectiveness(data) {
    const { successRate, attempts } = data;
    
    // 結合成功率和使用頻次的綜合指標
    const popularityWeight = Math.min(attempts / 10, 1); // 最高權重 1
    const effectiveness = (successRate * popularityWeight) + (successRate * 0.3);
    
    return {
      score: Math.min(Math.round(effectiveness), 100),
      grade: this.getEffectivenessGrade(effectiveness),
      confidence: popularityWeight > 0.5 ? 'HIGH' : 'MEDIUM'
    };
  }

  getEffectivenessGrade(score) {
    if (score >= 80) return 'EXCELLENT';
    if (score >= 60) return 'GOOD';
    if (score >= 40) return 'AVERAGE';
    return 'NEEDS_IMPROVEMENT';
  }

  suggestImprovements(data, actionType) {
    const suggestions = [];
    const { successRate } = data;
    
    if (successRate < 60) {
      suggestions.push(`${actionType} 相關說明需要更詳細的步驟說明`);
      suggestions.push('考慮增加常見問題和故障排除章節');
    }
    
    if (successRate < 40) {
      suggestions.push('建議重寫相關章節，使用更清晰的語言和範例');
      suggestions.push('考慮增加影片或圖解說明');
    }
    
    return suggestions;
  }
}
```

## 📈 統計報表生成

### 每日統計報表
```javascript
class DailyReportGenerator {
  constructor(tracker, analyzer, evaluator) {
    this.basicTracker = tracker;
    this.patternAnalyzer = analyzer;
    this.effectivenessEvaluator = evaluator;
  }

  generateDailyReport(date = new Date()) {
    const report = {
      date: date.toISOString().split('T')[0],
      summary: this.generateSummary(),
      topDocuments: this.getTopDocuments(),
      problemAreas: this.identifyProblemAreas(),
      recommendations: this.generateDailyRecommendations()
    };
    
    return this.formatReport(report);
  }

  generateSummary() {
    const totalViews = Array.from(this.basicTracker.viewCounts.values())
      .reduce((sum, count) => sum + count, 0);
    
    const uniqueDocuments = new Set(
      Array.from(this.basicTracker.viewCounts.keys())
        .map(key => key.split(':')[0])
    ).size;
    
    const avgCompletionRate = this.calculateAverageCompletion();
    
    return {
      totalViews,
      uniqueDocuments,
      averageCompletionRate: `${avgCompletionRate}%`,
      activeUsersEstimate: this.estimateActiveUsers()
    };
  }

  getTopDocuments(limit = 5) {
    return this.basicTracker.getPopularDocuments(limit)
      .map(doc => ({
        ...doc,
        completionRate: this.getDocumentCompletionRate(doc.path),
        effectivenessScore: this.getDocumentEffectiveness(doc.path)
      }));
  }

  identifyProblemAreas() {
    const problems = [];
    
    // 找出完成率低的文件
    for (const [path, patterns] of this.patternAnalyzer.scrollPatterns) {
      const analysis = this.patternAnalyzer.analyzePattern(path);
      if (analysis && analysis.averageCompletionRate < 40) {
        problems.push({
          type: 'LOW_COMPLETION',
          document: path,
          completionRate: analysis.averageCompletionRate,
          severity: 'HIGH'
        });
      }
    }
    
    // 找出效果差的文件
    for (const [key, data] of this.effectivenessEvaluator.actionTracking) {
      const [path] = key.split(':');
      if (data.successRate < 50 && data.attempts > 5) {
        problems.push({
          type: 'LOW_EFFECTIVENESS',
          document: path,
          successRate: data.successRate,
          attempts: data.attempts,
          severity: 'MEDIUM'
        });
      }
    }
    
    return problems.sort((a, b) => {
      const severityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  formatReport(report) {
    return `
# 📊 文件使用統計日報
**日期**: ${report.date}

## 📈 統計概覽
- **總瀏覽次數**: ${report.summary.totalViews}
- **活躍文件數**: ${report.summary.uniqueDocuments}
- **平均完成率**: ${report.summary.averageCompletionRate}
- **活躍用戶估計**: ${report.summary.activeUsersEstimate}

## 🏆 熱門文件 TOP ${report.topDocuments.length}
${report.topDocuments.map((doc, i) => 
  `${i+1}. **${doc.path}**
   - 瀏覽次數: ${doc.views}
   - 完成率: ${doc.completionRate}%
   - 效果評分: ${doc.effectivenessScore}/100`
).join('\n\n')}

## ⚠️ 問題區域
${report.problemAreas.length > 0 ? 
  report.problemAreas.map(problem => 
    `- **${problem.document}** (${problem.type}): ${problem.severity} 優先級`
  ).join('\n') : 
  '今日未發現顯著問題'}

## 💡 改善建議
${report.recommendations.join('\n')}

---
*報表生成時間: ${new Date().toLocaleString('zh-TW')}*
    `;
  }
}
```

### 週報和月報
```javascript
class PeriodicalReportGenerator {
  constructor(dailyGenerator) {
    this.dailyGenerator = dailyGenerator;
    this.historicalData = new Map();
  }

  generateWeeklyReport(endDate = new Date()) {
    const weekData = this.collectWeekData(endDate);
    
    return {
      period: this.getWeekPeriod(endDate),
      trends: this.analyzeTrends(weekData),
      topPerformers: this.identifyTopPerformers(weekData),
      improvements: this.trackImprovements(weekData),
      strategicRecommendations: this.generateStrategicRecommendations(weekData)
    };
  }

  generateMonthlyReport(endDate = new Date()) {
    const monthData = this.collectMonthData(endDate);
    
    return {
      period: this.getMonthPeriod(endDate),
      overallHealth: this.assessOverallHealth(monthData),
      documentLifecycle: this.analyzeDocumentLifecycle(monthData),
      userEngagement: this.analyzeUserEngagement(monthData),
      longTermStrategy: this.formulateLongTermStrategy(monthData)
    };
  }

  analyzeTrends(data) {
    const trends = {
      viewGrowth: this.calculateGrowthRate(data, 'views'),
      completionTrend: this.calculateTrendDirection(data, 'completion'),
      effectivenessTrend: this.calculateTrendDirection(data, 'effectiveness'),
      emergingPopular: this.identifyEmergingDocuments(data)
    };
    
    return trends;
  }

  generateStrategicRecommendations(data) {
    const recommendations = [];
    
    // 基於趋势的建议
    if (data.trends.viewGrowth < 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Content Strategy',
        action: '考慮重新評估文件內容相關性和搜尋可發現性',
        rationale: '整體瀏覽量呈下降趨勢'
      });
    }
    
    if (data.trends.completionTrend === 'DECLINING') {
      recommendations.push({
        priority: 'HIGH',
        category: 'User Experience',
        action: '重新設計文件結構，提高閱讀體驗',
        rationale: '用戶完成率持續下降'
      });
    }
    
    // 基於表現的建议
    if (data.topPerformers.length < 3) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Content Development',
        action: '參考現有高效文件特徵，改進其他文件',
        rationale: '高效果文件數量不足'
      });
    }
    
    return recommendations;
  }
}
```

## 🔧 實施整合指南

### 與現有系統整合

#### GitHub Actions 整合
```yaml
# .github/workflows/usage-analytics.yml
name: Documentation Usage Analytics

on:
  schedule:
    - cron: '0 6 * * *'  # 每日早上 6 點執行
  workflow_dispatch:

jobs:
  generate-analytics:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install --production
    
    - name: Generate daily report
      run: |
        node scripts/generate-usage-report.js --type daily
        
    - name: Update analytics dashboard
      run: |
        node scripts/update-analytics-dashboard.js
        
    - name: Commit reports
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        git add docs/analytics/
        git commit -m "📊 自動更新使用統計報告 $(date +'%Y-%m-%d')" || exit 0
        git push
```

#### 與工作日誌系統整合
```javascript
// scripts/integrate-usage-analytics.js
class WorkLogIntegration {
  constructor(usageAnalytics, workLogManager) {
    this.analytics = usageAnalytics;
    this.workLog = workLogManager;
  }

  async generateWeeklyWorkLogSection() {
    const weeklyData = await this.analytics.generateWeeklyReport();
    const mostUsedDocs = weeklyData.topPerformers.slice(0, 3);
    const problemDocs = weeklyData.problemAreas.filter(p => p.severity === 'HIGH');
    
    const section = `
## 📊 文件使用統計摘要

### 本週熱門文件
${mostUsedDocs.map(doc => `- ${doc.name}: ${doc.views} 次瀏覽，${doc.completionRate}% 完成率`).join('\n')}

### 需要關注的文件
${problemDocs.length > 0 ? 
  problemDocs.map(doc => `- ${doc.name}: ${doc.issue}`).join('\n') : 
  '本週無需特別關注的問題文件'}

### 優化建議
${weeklyData.strategicRecommendations.slice(0, 2).map(rec => `- ${rec.action}`).join('\n')}
    `;
    
    return section;
  }

  async updateWorkLogWithAnalytics() {
    try {
      const analyticsSection = await this.generateWeeklyWorkLogSection();
      await this.workLog.appendToCurrentLog(analyticsSection);
      
      console.log('✅ 工作日誌已更新統計數據');
    } catch (error) {
      console.error('❌ 統計數據整合失敗:', error.message);
    }
  }
}
```

### 監控設定

#### 效能監控
```javascript
class AnalyticsPerformanceMonitor {
  constructor() {
    this.processingTimes = [];
    this.errorCounts = new Map();
    this.memoryUsage = [];
  }

  async monitorProcessing(analyticsTask) {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await analyticsTask();
      
      // 記錄處理時間
      const endTime = process.hrtime.bigint();
      const processingTime = Number(endTime - startTime) / 1000000; // 轉換為毫秒
      this.processingTimes.push(processingTime);
      
      // 記錄記憶體使用
      const endMemory = process.memoryUsage();
      this.memoryUsage.push({
        peak: Math.max(startMemory.heapUsed, endMemory.heapUsed),
        growth: endMemory.heapUsed - startMemory.heapUsed
      });
      
      // 效能警告
      if (processingTime > 5000) { // 超過 5 秒
        console.warn(`⚠️ 統計處理時間過長: ${processingTime}ms`);
      }
      
      if (endMemory.heapUsed > startMemory.heapUsed * 2) {
        console.warn(`⚠️ 記憶體使用量大幅增加: ${(endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024}MB`);
      }
      
      return result;
      
    } catch (error) {
      // 記錄錯誤
      const errorType = error.name || 'UnknownError';
      this.errorCounts.set(errorType, (this.errorCounts.get(errorType) || 0) + 1);
      
      console.error(`❌ 統計處理失敗 (${errorType}):`, error.message);
      throw error;
    }
  }

  getPerformanceReport() {
    const avgProcessingTime = this.processingTimes.length > 0 ?
      this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length : 0;
    
    const totalErrors = Array.from(this.errorCounts.values())
      .reduce((sum, count) => sum + count, 0);
    
    return {
      averageProcessingTime: Math.round(avgProcessingTime),
      totalProcessedTasks: this.processingTimes.length,
      totalErrors,
      errorRate: totalErrors / (this.processingTimes.length + totalErrors) * 100,
      memoryEfficiency: this.calculateMemoryEfficiency()
    };
  }

  calculateMemoryEfficiency() {
    if (this.memoryUsage.length === 0) return 'N/A';
    
    const avgGrowth = this.memoryUsage.reduce((sum, usage) => sum + usage.growth, 0) / this.memoryUsage.length;
    
    if (avgGrowth < 1024 * 1024) return 'EXCELLENT'; // < 1MB
    if (avgGrowth < 5 * 1024 * 1024) return 'GOOD'; // < 5MB
    if (avgGrowth < 10 * 1024 * 1024) return 'AVERAGE'; // < 10MB
    return 'NEEDS_OPTIMIZATION'; // >= 10MB
  }
}
```

## 📋 最佳實踐

### 統計數據品質保證
1. **數據驗證**: 定期檢查統計數據完整性和準確性
2. **隱私保護**: 匿名化用戶數據，遵循隱私保護原則  
3. **效能優化**: 使用批次處理和快取機制優化處理效能
4. **錯誤處理**: 實施完善的錯誤處理和恢復機制

### 報表自動化
1. **定期生成**: 設定自動化排程生成日報、週報、月報
2. **智能警報**: 設定關鍵指標閾值，異常時自動通知
3. **趨勢追蹤**: 建立長期趨勢分析，識別文件系統發展方向
4. **行動建議**: 基於數據自動生成具體的改善行動建議

### 持續改善流程
1. **回饋循環**: 建立統計結果與文件改善的閉環流程
2. **實驗跟蹤**: 記錄文件改善措施的效果，驗證改善成效
3. **基準比較**: 建立同類型文件的效能基準，進行橫向比較
4. **預測分析**: 利用歷史數據預測文件需求和使用趨勢

## 🔗 相關文件

- [文件維護策略](./documentation-maintenance.md) - 統計數據驅動的維護流程
- [效能監控指南](../performance/performance-monitoring.md) - 系統效能監控整合
- [工作日誌管理](../../workflows/work-log-management.md) - 統計數據工作日誌整合

---

**📝 文件狀態**: 已完成 | **最後更新**: 2025-09-06 | **版本**: v0.11.0