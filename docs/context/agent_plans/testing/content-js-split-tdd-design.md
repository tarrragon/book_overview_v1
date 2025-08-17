# Content.js 拆分重構 TDD 測試架構設計

## 📋 摘要

基於 lavender-interface-designer 提供的 content.js 拆分設計策略，設計完整的 TDD 測試架構來保護這次重大重構。本設計專注於確保 1,737 行 content.js 拆分為 14 個模組的過程中，Readmoo 使用者體驗 100% 不變，同時建立可靠的測試基礎設施。

## 🎯 測試設計目標

### 核心保護目標

1. **功能零影響保證**: Readmoo 書庫/書架提取功能完全不受影響
2. **事件系統穩定性**: 與 Background Service Worker 通訊保持穩定
3. **記憶體安全保證**: 杜絕模組化過程中的記憶體洩漏風險
4. **效能基準維持**: 提取效能不低於重構前水準

### TDD 架構要求

1. **Red-Green-Refactor 循環嚴格遵循**: 每個模組拆分前先寫測試
2. **100% 程式碼覆蓋**: 所有拆分模組必須達到 100% 測試覆蓋率
3. **持續整合保護**: 每個 TDD 循環後執行完整測試套件
4. **回歸防護機制**: 建立自動化回歸檢測系統

## 🔍 重構風險分析與測試策略

### 🚨 高風險項目測試設計

#### 1. **功能回歸風險保護**

**風險描述**: 拆分過程中 Readmoo 提取功能失效
**測試策略**: E2E 功能保護測試

```javascript
// tests/e2e/refactor-protection/readmoo-function-protection.test.js
describe('Readmoo 功能保護測試', () => {
  test('書庫頁面提取功能保護', async () => {
    // 測試重構前後提取結果完全一致
  })
  
  test('書架頁面提取功能保護', async () => {
    // 測試各種書架場景
  })
  
  test('進度回報機制保護', async () => {
    // 測試提取進度事件完整性
  })
})
```

#### 2. **事件系統整合風險保護**

**風險描述**: 事件系統拆分影響跨上下文通訊
**測試策略**: 事件系統整合測試

```javascript
// tests/integration/event-system/event-communication-stability.test.js
describe('事件系統通訊穩定性測試', () => {
  test('Content Script 與 Background 雙向通訊', async () => {
    // 測試訊息發送與接收的完整性
  })
  
  test('事件轉發機制驗證', async () => {
    // 測試內部事件正確轉發到 Background
  })
  
  test('通訊失敗恢復機制', async () => {
    // 測試通訊中斷後的重連機制
  })
})
```

#### 3. **記憶體洩漏風險保護**

**風險描述**: 模組間循環依賴導致記憶體洩漏
**測試策略**: 記憶體監控測試

```javascript
// tests/performance/memory/memory-leak-detection.test.js
describe('記憶體洩漏檢測測試', () => {
  test('模組生命週期記憶體管理', async () => {
    // 測試模組載入/卸載過程中記憶體變化
  })
  
  test('事件監聽器清理驗證', async () => {
    // 測試所有事件監聽器正確清理
  })
  
  test('長時間運行記憶體穩定性', async () => {
    // 測試長時間提取過程記憶體不持續增長
  })
})
```

## 📋 Phase 1 測試設計規劃 (Week 1)

### 測試優先順序與範圍

基於拆分設計的 Phase 1 範圍，建立以下測試模組：

#### 🔧 **1. 基礎工具模組測試**

##### `utils/page-detection-utils.js` 測試設計

```javascript
// tests/unit/utils/page-detection-utils.test.js
describe('PageDetectionUtils', () => {
  describe('Readmoo 網域檢測', () => {
    test('正確識別 readmoo.com 網域', () => {
      // 測試各種 Readmoo URL 格式
    })
    
    test('拒絕非 Readmoo 網域', () => {
      // 測試其他網站 URL
    })
  })
  
  describe('頁面類型檢測', () => {
    test('正確識別書庫頁面 (library)', () => {
      // 測試 /library 路徑識別
    })
    
    test('正確識別書架頁面 (shelf)', () => {
      // 測試 /shelf 路徑識別
    })
    
    test('正確識別閱讀器頁面 (reader)', () => {
      // 測試 /api/reader 路徑識別
    })
    
    test('未知頁面類型處理', () => {
      // 測試未知頁面的fallback處理
    })
  })
  
  describe('頁面準備狀態檢查', () => {
    test('DOM 載入完成檢測', () => {
      // 測試 document.readyState 檢查
    })
    
    test('動態內容載入檢測', () => {
      // 測試 SPA 頁面內容準備狀態
    })
  })
})
```

##### `utils/error-handling-utils.js` 測試設計

```javascript
// tests/unit/utils/error-handling-utils.test.js
describe('ErrorHandlingUtils', () => {
  describe('全域錯誤捕獲', () => {
    test('捕獲並格式化同步錯誤', () => {
      // 測試 window.onerror 處理
    })
    
    test('捕獲並格式化 Promise 拒絕', () => {
      // 測試 unhandledrejection 處理
    })
  })
  
  describe('錯誤分類與上報', () => {
    test('錯誤優先級正確分類', () => {
      // 測試錯誤類型識別和優先級分派
    })
    
    test('錯誤資訊正確格式化', () => {
      // 測試錯誤訊息標準化格式
    })
    
    test('錯誤上報到 Background', () => {
      // 測試錯誤資訊正確發送到 Background
    })
  })
})
```

#### 🎭 **2. 核心事件系統測試**

##### `core/content-event-bus.js` 測試設計

```javascript
// tests/unit/core/content-event-bus.test.js
describe('ContentEventBus', () => {
  describe('事件註冊與管理', () => {
    test('正確註冊事件監聽器', () => {
      // 測試 on() 方法
    })
    
    test('支援優先級排序', () => {
      // 測試監聽器按優先級執行
    })
    
    test('支援一次性監聽器', () => {
      // 測試 { once: true } 選項
    })
    
    test('正確移除事件監聽器', () => {
      // 測試 off() 方法
    })
  })
  
  describe('事件觸發與處理', () => {
    test('正確觸發事件並收集結果', () => {
      // 測試 emit() 方法
    })
    
    test('錯誤隔離機制', () => {
      // 測試單一監聽器錯誤不影響其他
    })
    
    test('異步處理支援', () => {
      // 測試 async 監聽器正確處理
    })
  })
  
  describe('效能與統計', () => {
    test('事件統計資料正確收集', () => {
      // 測試 getStats() 方法
    })
    
    test('記憶體使用監控', () => {
      // 測試記憶體統計資料
    })
    
    test('效能監控功能', () => {
      // 測試執行時間統計
    })
  })
  
  describe('生命週期管理', () => {
    test('資源正確清理', () => {
      // 測試 destroy() 方法
    })
    
    test('記憶體洩漏防護', () => {
      // 測試長期使用無記憶體累積
    })
  })
})
```

##### `core/content-chrome-bridge.js` 測試設計

```javascript
// tests/unit/core/content-chrome-bridge.test.js
describe('ContentChromeBridge', () => {
  describe('Background 通訊', () => {
    test('正確發送訊息到 Background', () => {
      // 測試 sendToBackground() 方法
    })
    
    test('訊息格式標準化', () => {
      // 測試訊息元資料添加
    })
    
    test('通訊錯誤處理', () => {
      // 測試通訊失敗時的錯誤處理
    })
  })
  
  describe('事件轉發機制', () => {
    test('內部事件正確轉發', () => {
      // 測試 forwardEventToBackground() 方法
    })
    
    test('轉發失敗降級處理', () => {
      // 測試轉發失敗時的fallback機制
    })
  })
  
  describe('通訊效能監控', () => {
    test('通訊統計正確收集', () => {
      // 測試延遲、成功率統計
    })
    
    test('效能基準監控', () => {
      // 測試通訊效能不低於基準
    })
  })
})
```

##### `core/content-lifecycle-manager.js` 測試設計

```javascript
// tests/unit/core/content-lifecycle-manager.test.js
describe('ContentLifecycleManager', () => {
  describe('頁面生命週期管理', () => {
    test('頁面載入初始化', () => {
      // 測試 DOMContentLoaded 處理
    })
    
    test('頁面卸載清理', () => {
      // 測試 beforeunload 資源清理
    })
    
    test('URL 變更監聽', () => {
      // 測試 SPA 導航檢測
    })
  })
  
  describe('模組生命週期協調', () => {
    test('模組初始化順序控制', () => {
      // 測試依賴模組按正確順序初始化
    })
    
    test('模組清理順序控制', () => {
      // 測試模組按反向順序清理
    })
  })
  
  describe('資源管理', () => {
    test('觀察器正確設置與清理', () => {
      // 測試 MutationObserver 管理
    })
    
    test('事件監聽器生命週期', () => {
      // 測試事件監聽器正確添加和移除
    })
  })
})
```

#### 🔌 **3. 平台抽象介面測試**

##### `platform/platform-adapter-interface.js` 測試設計

```javascript
// tests/unit/platform/platform-adapter-interface.test.js
describe('PlatformAdapterInterface', () => {
  describe('抽象方法定義驗證', () => {
    test('所有必須實作方法都拋出錯誤', () => {
      // 測試抽象方法未實作時拋出錯誤
    })
    
    test('介面契約完整性', () => {
      // 測試所有必要方法都存在於介面定義中
    })
  })
  
  describe('方法簽名驗證', () => {
    test('getPageType() 方法簽名', () => {
      // 測試方法參數和返回值類型定義
    })
    
    test('extractAllBooks() 方法簽名', () => {
      // 測試 async 方法正確定義
    })
    
    test('parseBookElement() 方法簽名', () => {
      // 測試參數驗證和返回值格式
    })
  })
  
  describe('實作合規性檢查', () => {
    test('Readmoo 適配器合規性', () => {
      // 測試 Readmoo 實作符合介面契約
    })
    
    test('未來擴展準備度', () => {
      // 測試介面設計適合多平台擴展
    })
  })
})
```

## 🔄 TDD 循環實作流程

### TDD 階段測試策略

#### 🔴 **Red 階段 - 測試先行設計**

**目標**: 為每個拆分模組設計失敗測試

**執行步驟**:
1. 分析原始 content.js 中對應功能區塊
2. 設計新模組的預期行為和介面
3. 撰寫詳細的測試案例 (必須失敗)
4. 驗證測試確實因功能未實作而失敗

**測試清單範例** (每個模組):
```javascript
// Red 階段測試模板
describe('[模組名稱] - Red 階段', () => {
  test('模組正確載入和初始化', () => {
    // 測試模組載入 - 預期失敗
    expect(() => require('./module')).toThrow()
  })
  
  test('核心功能方法存在', () => {
    // 測試方法定義 - 預期失敗
    expect(module.coreMethod).toBeDefined()
  })
  
  test('預期行為正確實作', () => {
    // 測試功能邏輯 - 預期失敗
    expect(module.coreMethod()).toEqual(expectedResult)
  })
})
```

#### 🟢 **Green 階段 - 最小實作**

**目標**: 實作剛好讓測試通過的最小程式碼

**執行步驟**:
1. 從原始 content.js 提取對應程式碼區塊
2. 重構為新模組格式 (保持功能不變)
3. 調整至測試通過 (可以是暫時實作)
4. 驗證所有測試通過且無回歸

**品質檢查點**:
```bash
# Green 階段後必須執行的檢查
npm test                    # 所有測試通過
npm run test:coverage      # 覆蓋率達標
npm run lint               # 程式碼規範檢查
npm run test:integration   # 整合測試無回歸
```

#### 🔵 **Refactor 階段 - 程式碼優化**

**目標**: 改善程式碼品質而不影響功能

**執行步驟**:
1. 重構暫時實作為最佳實踐
2. 改善程式碼結構和可讀性
3. 消除重複程式碼和 `//todo:` 標記
4. 優化效能和記憶體使用

**重構檢查清單**:
- [ ] 消除所有 `//todo:` 標記
- [ ] 程式碼符合單一職責原則
- [ ] 函數長度控制在 30 行以內
- [ ] 無重複程式碼 (DRY 原則)
- [ ] 效能符合基準要求
- [ ] 記憶體使用最佳化

## 🧪 測試環境與工具配置

### 測試架構選擇

基於現有的 Jest 測試框架，擴展支援模組化重構需求：

#### **Jest 配置優化**

```javascript
// tests/jest.config.refactor.js (重構專用配置)
module.exports = {
  ...require('./jest.config.js'), // 繼承基礎配置
  
  // 重構測試專用設置
  testMatch: [
    '<rootDir>/tests/unit/refactor/**/*.test.js',
    '<rootDir>/tests/integration/refactor/**/*.test.js',
    '<rootDir>/tests/e2e/refactor-protection/**/*.test.js'
  ],
  
  // 更嚴格的覆蓋率要求
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },
  
  // 重構階段特殊設置
  setupFilesAfterEnv: [
    '<rootDir>/tests/test-setup.js',
    '<rootDir>/tests/setup/refactor-protection.js'
  ]
}
```

#### **Chrome Extension 測試環境**

```javascript
// tests/mocks/chrome-extension-refactor.mock.js
// Chrome API 模擬 (針對重構測試特化)
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  // 針對重構期間的特殊模擬需求
}
```

### Mock 策略設計

#### **模組依賴 Mock**

```javascript
// tests/mocks/module-dependencies.mock.js
// 模組間依賴的模擬策略
export const createMockEventBus = () => ({
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn().mockResolvedValue({ success: true }),
  getStats: jest.fn().mockReturnValue({}),
  destroy: jest.fn()
})

export const createMockChromeBridge = () => ({
  sendToBackground: jest.fn().mockResolvedValue({ success: true }),
  forwardEventToBackground: jest.fn().mockResolvedValue({ success: true }),
  getStats: jest.fn().mockReturnValue({})
})
```

#### **DOM 環境 Mock**

```javascript
// tests/fixtures/readmoo-dom-refactor.html
<!-- 針對重構測試的 Readmoo 頁面模擬 -->
<!DOCTYPE html>
<html>
<head>
  <title>Readmoo 書庫 - 重構測試</title>
</head>
<body>
  <!-- 各種 Readmoo 書籍容器結構 -->
  <div class="library-item">
    <a href="/api/reader/book123">
      <img class="cover-img" src="https://cdn.readmoo.com/cover/xx/book123_210x315.jpg" alt="測試書籍">
      <div class="title">測試書籍標題</div>
    </a>
  </div>
</body>
</html>
```

## 📊 測試覆蓋率與品質標準

### 覆蓋率要求

#### **絕對要求 (100% 覆蓋)**
- **單元測試**: 所有新拆分模組 100% 程式碼覆蓋
- **功能測試**: 所有 Readmoo 提取功能 100% 覆蓋  
- **整合測試**: 所有模組間介面 100% 覆蓋
- **E2E 測試**: 所有使用者場景 100% 覆蓋

#### **覆蓋率監控**

```javascript
// tests/coverage/refactor-coverage-monitor.js
// 重構階段覆蓋率監控工具
module.exports = {
  // 每個 TDD 循環後執行覆蓋率檢查
  checkCoverageThreshold: () => {
    // 驗證覆蓋率不低於 100%
  },
  
  // 覆蓋率回歸檢測
  detectCoverageRegression: () => {
    // 比較重構前後覆蓋率變化
  },
  
  // 未覆蓋程式碼報告
  reportUncoveredCode: () => {
    // 生成詳細的未覆蓋程式碼報告
  }
}
```

### 測試品質檢查

#### **測試可靠性驗證**

```javascript
// tests/quality/test-reliability.test.js
describe('測試可靠性驗證', () => {
  test('所有測試都是確定性的', async () => {
    // 執行多次測試，確保結果一致
    for (let i = 0; i < 10; i++) {
      const result = await runAllTests()
      expect(result.failed).toBe(0)
    }
  })
  
  test('測試隔離性驗證', () => {
    // 確保測試間沒有相互影響
  })
  
  test('測試執行效能基準', () => {
    // 確保測試執行時間在可接受範圍
  })
})
```

#### **回歸防護機制**

```javascript
// tests/regression/functional-regression.test.js
describe('功能回歸防護', () => {
  test('Readmoo 提取結果一致性', async () => {
    // 比較重構前後提取結果，必須完全一致
    const beforeRefactor = await loadBaselineResults()
    const afterRefactor = await performExtraction()
    expect(afterRefactor).toEqual(beforeRefactor)
  })
  
  test('效能回歸檢測', async () => {
    // 確保重構後效能不低於基準
    const performanceResult = await runPerformanceBenchmark()
    expect(performanceResult.time).toBeLessThanOrEqual(BASELINE_TIME * 1.1)
  })
})
```

## ⚡ 效能與記憶體測試

### 效能基準測試

```javascript
// tests/performance/refactor-performance.test.js
describe('重構效能基準測試', () => {
  test('模組載入時間基準', async () => {
    const startTime = performance.now()
    await loadAllModules()
    const loadTime = performance.now() - startTime
    
    expect(loadTime).toBeLessThan(ACCEPTABLE_LOAD_TIME)
  })
  
  test('提取效能基準維持', async () => {
    const extractionTime = await measureExtractionTime()
    expect(extractionTime).toBeLessThanOrEqual(BASELINE_EXTRACTION_TIME)
  })
  
  test('事件處理效能', async () => {
    const eventProcessingTime = await measureEventProcessing()
    expect(eventProcessingTime).toBeLessThan(MAX_EVENT_PROCESSING_TIME)
  })
})
```

### 記憶體監控測試

```javascript
// tests/memory/memory-monitoring.test.js
describe('記憶體使用監控', () => {
  test('模組初始化記憶體使用', () => {
    const initialMemory = getMemoryUsage()
    initializeAllModules()
    const afterInit = getMemoryUsage()
    
    expect(afterInit - initialMemory).toBeLessThan(MAX_INIT_MEMORY)
  })
  
  test('長期運行記憶體穩定性', async () => {
    const initialMemory = getMemoryUsage()
    
    // 模擬長期使用
    for (let i = 0; i < 100; i++) {
      await performExtraction()
      await cleanup()
    }
    
    const finalMemory = getMemoryUsage()
    expect(finalMemory - initialMemory).toBeLessThan(MEMORY_LEAK_THRESHOLD)
  })
})
```

## 🚀 自動化測試執行

### 持續整合工作流

```javascript
// tests/automation/ci-workflow.js
// TDD 循環自動化執行腳本
module.exports = {
  // 每個 TDD 階段後執行
  runTDDCycleValidation: async () => {
    console.log('🔄 執行 TDD 循環驗證...')
    
    // Red 階段驗證
    await validateRedPhase()
    
    // Green 階段驗證  
    await validateGreenPhase()
    
    // Refactor 階段驗證
    await validateRefactorPhase()
    
    console.log('✅ TDD 循環驗證完成')
  },
  
  // 完整回歸測試
  runFullRegressionSuite: async () => {
    console.log('🧪 執行完整回歸測試套件...')
    
    await runUnitTests()
    await runIntegrationTests()
    await runE2ETests()
    await runPerformanceTests()
    await runMemoryTests()
    
    console.log('✅ 回歸測試套件完成')
  }
}
```

### 測試報告生成

```javascript
// tests/reporting/refactor-progress-report.js
// 重構進度測試報告生成器
module.exports = {
  generateProgressReport: () => {
    return {
      // 重構進度統計
      refactorProgress: {
        totalModules: 14,
        completedModules: getCurrentCompletedCount(),
        testCoverage: getCurrentCoverage(),
        performanceImpact: getPerformanceImpact()
      },
      
      // 品質指標
      qualityMetrics: {
        allTestsPassing: getAllTestsStatus(),
        noRegressions: getRegressionStatus(),
        memoryStable: getMemoryStatus(),
        performanceStable: getPerformanceStatus()
      },
      
      // 風險評估
      riskAssessment: {
        functionalRisk: 'LOW',
        performanceRisk: 'LOW', 
        memoryRisk: 'LOW',
        integrationRisk: 'MEDIUM'
      }
    }
  }
}
```

## 📋 測試執行檢查清單

### 每個 TDD 循環必須執行

#### 🔴 **Red 階段檢查**
- [ ] 新測試確實失敗 (紅燈狀態)
- [ ] 失敗原因符合預期 (因功能未實作)
- [ ] 測試描述清楚表達預期行為
- [ ] 測試資料和模擬環境正確設置

#### 🟢 **Green 階段檢查**
- [ ] 所有測試通過 (綠燈狀態)
- [ ] 新功能按預期工作
- [ ] 沒有回歸問題 (既有測試仍通過)
- [ ] 程式碼覆蓋率達到 100%

#### 🔵 **Refactor 階段檢查**
- [ ] 所有測試仍然通過
- [ ] 效能沒有明顯退化
- [ ] 記憶體使用沒有增長
- [ ] 程式碼品質符合標準
- [ ] 所有 `//todo:` 標記已解決

### 完整循環後驗證

#### 🧪 **功能驗證**
```bash
# 功能完整性檢查
npm run test:e2e:readmoo           # Readmoo 功能測試
npm run test:integration:events   # 事件系統整合測試
npm run test:performance:baseline # 效能基準檢查
npm run test:memory:leak          # 記憶體洩漏檢測
```

#### 📊 **品質指標驗證**
```bash
# 品質指標檢查
npm run test:coverage             # 覆蓋率檢查 (必須 100%)
npm run lint                      # 程式碼規範檢查
npm run test:reliability         # 測試可靠性驗證
npm run test:regression           # 回歸檢測
```

## 🎯 成功標準定義

### 絕對成功標準 (必須達成)

1. **功能完整性**: Readmoo 所有提取功能 100% 正常
2. **測試覆蓋率**: 所有新模組 100% 程式碼覆蓋
3. **效能基準**: 提取效能不低於重構前 90%
4. **記憶體安全**: 長期使用記憶體增長 <50MB
5. **通訊穩定**: Background 通訊成功率 >99%

### 品質標準 (高標準要求)

1. **程式碼品質**: 所有模組符合單一職責原則
2. **測試品質**: 測試確定性和隔離性 100%
3. **文件完整**: 每個模組都有完整 API 文件
4. **回歸防護**: 零功能回歸，零效能重大退化
5. **架構一致**: 模組設計符合既定架構原則

### 驗收標準檢查

```javascript
// tests/acceptance/final-acceptance.test.js
describe('重構最終驗收測試', () => {
  test('所有絕對成功標準達成', async () => {
    const results = await runFullValidationSuite()
    
    expect(results.functionalIntegrity).toBe(100)
    expect(results.testCoverage).toBe(100)
    expect(results.performanceRatio).toBeGreaterThanOrEqual(0.9)
    expect(results.memoryGrowth).toBeLessThan(50)
    expect(results.communicationSuccessRate).toBeGreaterThan(0.99)
  })
  
  test('所有品質標準達成', async () => {
    const qualityResults = await runQualityValidation()
    
    expect(qualityResults.allModulesFollowSRP).toBe(true)
    expect(qualityResults.testReliability).toBe(100)
    expect(qualityResults.documentationComplete).toBe(true)
    expect(qualityResults.zeroRegressions).toBe(true)
  })
})
```

## 📋 總結與執行建議

### 🎯 **測試架構核心價值**

透過這個 TDD 測試架構設計，將實現：

1. **零風險重構**: 完整的測試保護確保 Readmoo 功能零影響
2. **品質驅動**: 測試優先確保每個拆分模組都符合高品質標準
3. **持續驗證**: 每個 TDD 循環都有完整的驗證機制
4. **回歸防護**: 自動化檢測系統防止任何功能或效能回歸
5. **架構保障**: 測試設計確保拆分後的架構符合設計原則

### 🔄 **執行優先順序建議**

#### Week 1 執行計劃:
1. **Day 1-2**: 建立測試基礎設施和 Mock 環境
2. **Day 3-4**: 實作 Phase 1 核心模組測試 (工具和事件系統)
3. **Day 5-7**: 建立平台抽象介面測試和驗證機制

#### 關鍵成功要素:
1. **測試先行**: 每個模組拆分前必須先寫完整測試
2. **小步迭代**: 一次只拆分一個模組，確保每步都穩定
3. **持續驗證**: 每個 TDD 循環後立即執行完整驗證
4. **品質堅持**: 不允許為了進度而犧牲測試覆蓋或品質標準

### ⚠️ **風險控制機制**

1. **即時中止**: 任何測試失敗或品質下降立即暫停重構
2. **快速回退**: 保留每個穩定狀態的完整備份
3. **持續監控**: 建立實時監控儀表板追蹤所有關鍵指標
4. **升級機制**: 遇到技術困難時啟動敏捷升級流程

這個測試架構設計為 content.js 拆分重構提供了全方位的保護和驗證機制，確保在提升架構品質的同時，完全保障使用者體驗和系統穩定性。

---

**設計完成時間**: 2025-01-16  
**預計測試開發時間**: 3-5 天 (Phase 1)  
**風險等級**: 低 (有完整測試保護)  
**預期效益**: 零風險重構，高品質模組化架構