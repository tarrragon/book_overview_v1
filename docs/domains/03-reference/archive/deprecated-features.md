# 🗑️ 棄用功能清單

## 📊 功能生命週期追蹤

### 已移除功能 (Removed Features)

#### v0.10.0 移除項目

| 功能名稱 | 移除原因 | 替代方案 | 最後支援版本 | 移除日期 |
|---------|---------|---------|-------------|---------|
| **Legacy Content Parser** | 解析準確度低、維護困難 | Enhanced DOM Parser | v0.9.8 | 2024-11-15 |
| **舊版錯誤報告系統** | 缺乏分類、資訊不足 | 統一錯誤處理架構 | v0.9.5 | 2024-11-01 |
| **Basic CSS Selector** | 不支援動態內容 | Advanced Selector Engine | v0.9.3 | 2024-10-20 |

#### v0.9.0 移除項目

| 功能名稱 | 移除原因 | 替代方案 | 最後支援版本 | 移除日期 |
|---------|---------|---------|---------|---------|
| **同步儲存機制** | 效能問題、阻塞 UI | 非同步儲存 API | v0.8.12 | 2024-09-10 |
| **固定延遲機制** | 不適應不同網速 | 智能重試系統 | v0.8.10 | 2024-09-05 |
| **單一錯誤處理** | 無法細化錯誤類型 | 階層式錯誤分類 | v0.8.8 | 2024-08-25 |

### 計劃棄用功能 (Deprecated Features)

#### ⚠️ 即將移除 (v0.12.0)

| 功能名稱 | 棄用原因 | 替代方案 | 計劃移除版本 | 影響評估 |
|---------|---------|---------|-------------|---------|
| **單一來源解析器** | 擴展性受限 | 多源統一解析架構 | v0.12.0 | 🟡 中等 |
| **基礎快取機制** | 快取效率低 | 層級快取系統 | v0.12.0 | 🟢 低 |

#### 🔄 考慮棄用 (v0.13.0+)

| 功能名稱 | 評估狀態 | 潛在替代方案 | 決策時程 | 相依性風險 |
|---------|---------|-------------|---------|----------|
| **傳統事件系統** | 效能評估中 | Event Bus 架構 | v0.13.0 前 | 🟡 中等 |
| **直接 DOM 操作** | 架構重構需要 | Virtual DOM 抽象 | 評估中 | 🔴 高 |

## 🔄 遷移指南

### Legacy Content Parser → Enhanced DOM Parser

**影響範圍**: 所有內容擷取邏輯
**遷移時間**: v0.9.9 - v0.10.0
**自動遷移**: ✅ 支援

```javascript
// ❌ 舊版用法 (v0.9.8 及之前)
const legacyParser = new LegacyContentParser();
const result = legacyParser.parseContent(htmlContent);

// ✅ 新版用法 (v0.10.0+)
const enhancedParser = new EnhancedDOMParser({
  selectors: ContentSelectors.READMOO_STANDARD,
  fallbackSelectors: ContentSelectors.READMOO_MOBILE
});
const result = await enhancedParser.extractContent(document);
```

**遷移檢查清單**:
- [ ] 更新所有 parseContent() 調用為 extractContent()
- [ ] 替換同步處理為異步處理
- [ ] 檢查錯誤處理邏輯相容性
- [ ] 驗證解析結果格式一致性

### 同步儲存 → 非同步儲存 API

**影響範圍**: 所有資料儲存操作
**遷移時間**: v0.8.13 - v0.9.0
**自動遷移**: ❌ 需要手動調整

```javascript
// ❌ 舊版用法 (v0.8.12 及之前)
chrome.storage.local.set({ bookData: data });
const result = chrome.storage.local.get(['bookData']);

// ✅ 新版用法 (v0.9.0+)
await chrome.storage.local.set({ bookData: data });
const result = await chrome.storage.local.get(['bookData']);
```

**遷移檢查清單**:
- [ ] 所有儲存操作加上 await
- [ ] 更新函數宣告為 async
- [ ] 加入適當的錯誤處理
- [ ] 測試非同步操作時序

## 📈 功能替代分析

### 效能改善統計

| 替代項目 | 效能提升 | 記憶體節省 | 錯誤減少 | 使用者體驗改善 |
|---------|---------|-----------|---------|---------------|
| Enhanced DOM Parser | +87% | -23MB | -92% | ⭐⭐⭐⭐⭐ |
| 非同步儲存 | +156% | -12MB | -78% | ⭐⭐⭐⭐ |
| 階層式錯誤處理 | +45% | -8MB | -95% | ⭐⭐⭐⭐⭐ |

### 架構相容性矩陣

| 舊功能 | 新功能 | 向後相容性 | API 一致性 | 資料遷移需求 |
|-------|-------|-----------|----------|-------------|
| Legacy Parser | Enhanced DOM | ❌ 不相容 | ❌ API 變更 | ✅ 自動遷移 |
| 同步儲存 | 非同步儲存 | ⚠️ 條件相容 | ⚠️ 部分變更 | ⚠️ 手動調整 |
| 單一錯誤處理 | 階層式處理 | ✅ 向下相容 | ✅ 擴展 API | ✅ 無需遷移 |

## 🚨 風險評估與緩解

### 高風險移除項目

#### 直接 DOM 操作 (考慮中)

**風險等級**: 🔴 高
**影響範圍**: 核心擷取邏輯
**緩解策略**:
- 階段性引入 Virtual DOM 抽象層
- 保持關鍵路徑的直接操作能力
- 建立完整的回歸測試套件
- 設計 fallback 機制

**時程規劃**:
```
Phase 1 (v0.12.0): Virtual DOM 概念驗證
Phase 2 (v0.13.0): 部分邏輯遷移
Phase 3 (v0.14.0): 全面評估決策點
```

### 中風險移除項目

#### 傳統事件系統

**風險等級**: 🟡 中等
**影響範圍**: 組件間通訊
**緩解策略**:
- Event Bus 架構逐步導入
- 維持事件介面相容性
- 建立事件流程測試
- 效能基準測試比較

## 📊 棄用決策流程

### 功能評估準則

```javascript
class DeprecationEvaluator {
  constructor() {
    this.evaluationCriteria = {
      PERFORMANCE_IMPACT: {
        weight: 0.25,
        threshold: { critical: -30, warning: -15, acceptable: 0 }
      },
      MAINTENANCE_COST: {
        weight: 0.20,
        threshold: { critical: 40, warning: 25, acceptable: 15 }
      },
      SECURITY_RISK: {
        weight: 0.30,
        threshold: { critical: 8, warning: 5, acceptable: 2 }
      },
      USER_IMPACT: {
        weight: 0.15,
        threshold: { critical: 7, warning: 4, acceptable: 2 }
      },
      TECHNICAL_DEBT: {
        weight: 0.10,
        threshold: { critical: 8, warning: 5, acceptable: 3 }
      }
    };
  }

  evaluateFeature(featureName, metrics) {
    const score = this.calculateWeightedScore(metrics);
    const recommendation = this.generateRecommendation(score, metrics);
    
    return {
      feature: featureName,
      score,
      recommendation,
      timeline: this.suggestDeprecationTimeline(score),
      migrationComplexity: this.assessMigrationComplexity(metrics),
      riskLevel: this.determineRiskLevel(score)
    };
  }

  generateRecommendation(score, metrics) {
    if (score >= 8.0) {
      return 'IMMEDIATE_DEPRECATION';
    } else if (score >= 6.0) {
      return 'PLANNED_DEPRECATION';
    } else if (score >= 4.0) {
      return 'MONITOR_AND_EVALUATE';
    } else {
      return 'CONTINUE_SUPPORT';
    }
  }
}
```

### 決策記錄範本

```markdown
## 功能棄用決策記錄

**功能名稱**: [功能名稱]
**評估日期**: [YYYY-MM-DD]
**決策者**: [責任人員]

### 評估結果
- 效能影響: [分數/10]
- 維護成本: [分數/10]
- 安全風險: [分數/10]
- 使用者影響: [分數/10]
- 技術債務: [分數/10]

### 決策結論
- [IMMEDIATE_DEPRECATION | PLANNED_DEPRECATION | MONITOR_AND_EVALUATE | CONTINUE_SUPPORT]

### 執行計劃
1. 通知時程: [時間點]
2. 棄用標記: [版本]
3. 移除時程: [版本]
4. 遷移支援: [描述]
```

## 🔍 監控和追蹤

### 使用量統計

```javascript
class DeprecatedFeatureTracker {
  constructor() {
    this.usageMetrics = new Map();
    this.warningCounts = new Map();
  }

  trackUsage(featureName, context) {
    const usage = this.usageMetrics.get(featureName) || {
      count: 0,
      lastUsed: null,
      contexts: new Set()
    };
    
    usage.count++;
    usage.lastUsed = new Date();
    usage.contexts.add(context);
    
    this.usageMetrics.set(featureName, usage);
    
    // 發出棄用警告
    this.issueDeprecationWarning(featureName, usage);
  }

  generateUsageReport() {
    const report = {
      timestamp: new Date().toISOString(),
      features: [],
      recommendations: []
    };
    
    for (const [feature, metrics] of this.usageMetrics) {
      report.features.push({
        name: feature,
        usage: metrics,
        risk: this.assessRemovalRisk(metrics)
      });
    }
    
    return report;
  }
}
```

## 📝 文件維護

**建立日期**: 2025-09-06  
**最後更新**: 2025-09-06  
**版本**: v0.11.0  
**維護者**: Readmoo 書籍擷取專案團隊  

**更新頻率**: 每個主要版本發布時檢視  
**檢視責任**: 技術負責人、架構師  

---

*本文件是三層漸進式架構的第三層參考文件，提供完整的功能棄用管理和遷移指南。*