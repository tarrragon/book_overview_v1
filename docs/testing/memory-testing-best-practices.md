# 記憶體測試最佳實踐指南

## 📋 概要

本文件提供記憶體測試的最佳實踐指南，重點在於測試記憶體洩漏預防而非垃圾回收效率。

## 🎯 核心設計原則

### 1. 測試記憶體洩漏預防，非垃圾回收效率

**❌ 錯誤做法 - 測試垃圾回收觸發次數**:
```javascript
// 錯誤：測試假數據
expect(stats.garbageCollectionTriggers).toBeGreaterThan(0)
```

**✅ 正確做法 - 測試記憶體健康指標**:
```javascript
// 正確：測試真實記憶體狀況
expect(stats.memoryHealthScore).toBeGreaterThan(0.5)
expect(stats.memoryLeaks).toBeLessThanOrEqual(2)
expect(stats.memoryGrowthRate).toBeLessThan(1000) // bytes/ms
```

### 2. 使用真實測量而非任意數字

**❌ 錯誤做法 - 硬編碼假數據**:
```javascript
// 錯誤：使用假數據
memoryEfficiency: 0.84
garbageCollectionTriggers: Math.floor(elapsed / 5000)
```

**✅ 正確做法 - 真實計算**:
```javascript
// 正確：基於實際記憶體使用計算
memoryEfficiency: this._calculateRealMemoryEfficiency(eventData)
memoryAnalysis: this._analyzeMemoryUsage(monitoring)
```

### 3. 基於實際記憶體使用量，非假定效率百分比

**✅ 實際測量範例**:
```javascript
const memoryUsage = process.memoryUsage()
const growthRate = (currentMemory - baselineMemory) / timeElapsed
const efficiency = this._calculateMemoryReleaseRatio(measurements)
```

## 🛠 記憶體測試工具

### MemoryLeakDetector 類別

提供全面的記憶體洩漏檢測功能：

```javascript
const MemoryLeakDetector = require('tests/helpers/memory-leak-detector')

// 基本使用
const detector = new MemoryLeakDetector({
  memoryGrowthThreshold: 50 * 1024 * 1024, // 50MB
  leakDetectionThreshold: 1024, // 1KB per operation
  minOperationsForDetection: 10
})

// 執行記憶體洩漏檢測
const analysis = await detector.detectMemoryLeak(operationFunction, 100, {
  testName: 'book-extraction-test'
})
```

### 記憶體分析指標

**1. 記憶體增長率 (Growth Rate)**:
```javascript
// 計算每毫秒的記憶體增長
const growthRate = (finalMemory - initialMemory) / duration // bytes/ms
```

**2. 記憶體洩漏檢測**:
```javascript
// 檢測持續增長模式
const suspectedLeaks = this._detectConsistentGrowthWindows(measurements)
```

**3. 記憶體效率**:
```javascript
// 基於記憶體釋放能力
const efficiency = this._calculateMemoryReleaseRatio(measurements)
```

**4. 記憶體健康分數**:
```javascript
// 綜合健康評估
const healthScore = this._combineMetrics(growthRate, leaks, efficiency)
```

## 📊 測試實作模式

### 模式1: 操作前後記憶體比較

```javascript
test('應該在操作後釋放記憶體', async () => {
  const detector = new MemoryLeakDetector()
  const baselineMemory = detector.startMonitoring()
  
  // 執行操作
  const operationId = detector.recordOperationStart('book-processing')
  await performBookExtraction()
  await detector.recordOperationEnd(operationId)
  
  const analysis = await detector.stopMonitoring()
  
  // 驗證記憶體健康指標
  expect(analysis.hasMemoryLeak).toBe(false)
  expect(analysis.efficiency.overallEfficiency).toBeGreaterThan(0.7)
})
```

### 模式2: 重複操作記憶體穩定性

```javascript
test('重複操作不應造成記憶體累積', async () => {
  const detector = new MemoryLeakDetector()
  
  const analysis = await detector.detectMemoryLeak(
    async (iteration) => {
      await extractBookFromPage(mockBooks[iteration % mockBooks.length])
    },
    50, // 執行50次
    { testName: 'repeated-extraction' }
  )
  
  // 驗證記憶體不會持續增長
  expect(analysis.leakDetection.suspectedLeaks).toBeLessThanOrEqual(2)
  expect(analysis.leakDetection.memoryGrowthTrend).not.toBe('increasing')
})
```

### 模式3: 長期執行記憶體監控

```javascript
test('長期操作應維持記憶體穩定', async () => {
  const detector = new MemoryLeakDetector({
    memoryGrowthThreshold: 100 * 1024 * 1024, // 100MB for long-running
    stabilizationWaitTime: 1000 // 長期測試需要更長穩定時間
  })
  
  detector.startMonitoring()
  
  // 模擬長期運行
  for (let i = 0; i < 200; i++) {
    const opId = detector.recordOperationStart(`long-run-${i}`)
    await performLightweightOperation()
    await detector.recordOperationEnd(opId)
    
    // 每50次操作檢查一次
    if (i % 50 === 49) {
      const currentMemory = process.memoryUsage()
      console.log(`After ${i + 1} operations: ${detector._formatMemorySize(currentMemory.heapUsed)}`)
    }
  }
  
  const analysis = await detector.stopMonitoring()
  
  // 長期穩定性驗證
  expect(analysis.summary.totalMemoryGrowth).toBeLessThan(100 * 1024 * 1024)
  expect(analysis.passesThresholds.overallOk).toBe(true)
})
```

## 🚨 常見錯誤和避免方法

### 錯誤1: 測試垃圾回收器行為

```javascript
// ❌ 錯誤：無法控制的系統行為
expect(garbageCollectionCount).toBeGreaterThan(5)

// ✅ 正確：測試我們能控制的記憶體使用
expect(memoryLeaks).toBe(0)
expect(memoryGrowthRate).toBeLessThan(threshold)
```

### 錯誤2: 使用固定效率值

```javascript
// ❌ 錯誤：任意假設
memoryEfficiency: 0.84

// ✅ 正確：基於實際計算
memoryEfficiency: this._calculateActualEfficiency(data)
```

### 錯誤3: 忽略記憶體穩定化時間

```javascript
// ❌ 錯誤：立即檢查記憶體
const memoryAfter = process.memoryUsage()

// ✅ 正確：等待記憶體穩定
await new Promise(resolve => setTimeout(resolve, 500))
const memoryAfter = process.memoryUsage()
```

## 📈 記憶體測試檢查清單

### 開發階段檢查
- [ ] 使用 MemoryLeakDetector 而非手動記憶體檢查
- [ ] 測試記憶體洩漏預防而非垃圾回收效率
- [ ] 使用真實測量值而非硬編碼數字
- [ ] 包含記憶體穩定化等待時間
- [ ] 測試重複操作的記憶體穩定性

### 測試品質檢查
- [ ] 記憶體測試有明確的閾值設定
- [ ] 測試涵蓋不同操作規模（輕量、中等、重度）
- [ ] 長期執行測試驗證記憶體不會累積
- [ ] 測試失敗時有足夠的診斷資訊

### 持續整合檢查
- [ ] 記憶體測試在 CI 中能穩定通過
- [ ] 記憶體閾值根據環境適當調整
- [ ] 測試結果包含記憶體使用趨勢資訊
- [ ] 記憶體警告有適當的嚴重程度分級

## 🔧 工具設定範例

### Jest 測試配置

```javascript
// jest.config.js 記憶體測試專用設定
module.exports = {
  testEnvironment: 'node',
  testTimeout: 60000, // 記憶體測試需要更長時間
  maxWorkers: 1, // 避免並行測試影響記憶體測量
  setupFilesAfterEnv: ['<rootDir>/tests/setup/memory-test-setup.js']
}
```

### 記憶體測試環境設定

```javascript
// tests/setup/memory-test-setup.js
const MemoryLeakDetector = require('../helpers/memory-leak-detector')

global.memoryDetector = new MemoryLeakDetector({
  memoryGrowthThreshold: 50 * 1024 * 1024,
  leakDetectionThreshold: 1024,
  stabilizationWaitTime: 500
})

// 測試後清理
afterEach(async () => {
  if (global.gc) {
    global.gc()
    await new Promise(resolve => setTimeout(resolve, 100))
  }
})
```

## 📚 相關文件

- [MemoryLeakDetector 類別文件](../tests/helpers/memory-leak-detector.js)
- [Chrome Extension Controller 記憶體監控](../tests/helpers/chrome-extension-controller.js)
- [Event System Analyzer 記憶體效率計算](../tests/helpers/event-system-analyzer.js)
- [測試系統完整性重構 v0.12.9](../work-logs/v0.12.9-test-system-integrity-refactor.md)