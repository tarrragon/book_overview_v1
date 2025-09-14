# 記憶體測試最佳實踐指南

## 📋 概述

本文件建立了 Chrome Extension 記憶體測試的標準化方法，重點從「測試垃圾回收效率」轉向「預防記憶體洩漏」。

## 🎯 設計原則

### 1. **測試記憶體洩漏預防，而非垃圾回收效率**

**❌ 舊方式 (已廢除)**:
```javascript
// 假數據 - 無法控制垃圾回收
garbageCollectionTriggers: Math.floor(elapsed / 5000)
memoryEfficiency: 0.84 // 硬編碼假值
```

**✅ 新方式 (最佳實踐)**:
```javascript
// 真實測量 - 可控制的記憶體洩漏檢測
const memoryAnalysis = this._analyzeMemoryUsage(monitoring)
return {
  memoryLeaks: memoryAnalysis.suspectedLeaks,
  memoryGrowthRate: memoryAnalysis.growthRate, // bytes/ms
  memoryEfficiency: memoryAnalysis.efficiency,
  memoryHealthScore: memoryAnalysis.healthScore
}
```

### 2. **使用真實場景模擬，而非任意數字**

**測試應基於**:
- 實際記憶體使用量 (`process.memoryUsage()`)
- 真實的操作次數和時間間隔
- 可重現的測試條件

**避免**:
- 硬編碼的效率百分比
- 任意的觸發次數計算
- 無意義的假數據

### 3. **基於實際記憶體使用量，而非假定效率百分比**

使用 `MemoryLeakDetector` 類別進行真實測量：

```javascript
const detector = new MemoryLeakDetector({
  memoryGrowthThreshold: 50 * 1024 * 1024, // 50MB 警告閾值
  leakDetectionThreshold: 1024, // 1KB per operation 洩漏閾值
  samplingInterval: 100,
  minOperationsForDetection: 10
})

const analysis = await detector.detectMemoryLeak(operationFunction, 100, {
  testName: 'content-script-extraction'
})
```

## 🛠 實作指南

### 記憶體洩漏檢測工具

**位置**: `tests/helpers/memory-leak-detector.js`

**核心功能**:
1. **記憶體增長追蹤**: 監控真實記憶體使用變化
2. **洩漏模式識別**: 檢測持續增長而未釋放的記憶體
3. **效率計算**: 基於記憶體回收能力的真實評分
4. **健康評估**: 綜合記憶體使用模式的整體評分

**使用範例**:
```javascript
// 1. 啟動監控
detector.startMonitoring()

// 2. 記錄操作
const operationId = detector.recordOperationStart('extract-books')
await performBookExtraction()
await detector.recordOperationEnd(operationId)

// 3. 分析結果
const analysis = await detector.stopMonitoring()

// 4. 驗證結果
expect(analysis.hasMemoryLeak).toBe(false)
expect(analysis.summary.totalMemoryGrowth).toBeLessThan(50 * 1024 * 1024)
expect(analysis.efficiency.overallEfficiency).toBeGreaterThan(0.7)
```

### Chrome Extension Controller 整合

**已重構功能**:
- ✅ 移除假的 `garbageCollectionTriggers`
- ✅ 實作真實的記憶體分析方法
- ✅ 新增資源清理驗證
- ✅ 提供記憶體健康指標

**新增方法**:
- `_analyzeMemoryUsage()`: 分析記憶體使用模式
- `_detectMemoryLeaks()`: 檢測潛在記憶體洩漏
- `_calculateMemoryEfficiency()`: 計算記憶體效率
- `_calculateMemoryHealthScore()`: 計算健康分數
- `validateResourceCleanup()`: 驗證資源釋放狀態

## 📊 測試指標定義

### 1. **記憶體洩漏指標 (Memory Leaks)**
- **定義**: 檢測到的可疑記憶體洩漏次數
- **計算**: 基於滑動窗口的持續增長模式檢測
- **閾值**: 0 (理想狀態不應有記憶體洩漏)

### 2. **記憶體增長率 (Memory Growth Rate)**
- **定義**: 每毫秒的記憶體增長量 (bytes/ms)
- **計算**: `(最終記憶體 - 初始記憶體) / 執行時間`
- **健康標準**: ≤ 1000 bytes/ms

### 3. **記憶體效率 (Memory Efficiency)**
- **定義**: 記憶體釋放和穩定性的綜合評分 (0-1)
- **計算**: `釋放率 * 0.6 + 穩定率 * 0.4`
- **健康標準**: > 0.7

### 4. **記憶體健康分數 (Memory Health Score)**
- **定義**: 增長率、洩漏數、效率的綜合評分 (0-1)
- **計算**: `增長健康度 * 0.4 + 洩漏健康度 * 0.4 + 效率健康度 * 0.2`
- **健康標準**: > 0.5

## 🔧 測試案例重構指南

### 需要更新的測試文件

1. **integration/cross-module/background-content-integration.test.js**
   - ✅ 已更新: 測試 `memoryLeaks`, `memoryHealthScore`
   - ✅ 已通過測試驗證

2. **helpers/event-system-analyzer.js** (待處理)
   - ❌ 需移除: `memoryEfficiency: 0.84` 硬編碼值

3. **其他含有記憶體效率假數據的測試** (待處理)

### 更新步驟

1. **識別假數據**:
   ```bash
   grep -r "memoryEfficiency.*0\." tests/
   grep -r "garbageCollection" tests/
   ```

2. **替換為真實測量**:
   - 引入 `MemoryLeakDetector`
   - 使用真實的操作執行
   - 驗證實際的記憶體指標

3. **更新測試期望**:
   - 從硬編碼數值改為閾值範圍
   - 基於實際表現設定合理期望
   - 加入記憶體健康度檢查

## ⚠️ 注意事項

### 1. **不要測試無法控制的系統行為**
- 垃圾回收是 JavaScript 引擎的內部機制
- 無法預測或強制觸發垃圾回收
- 測試應專注於可控制的記憶體使用模式

### 2. **使用穩定化等待時間**
- 記憶體測量需要時間穩定
- 預設等待 500ms 讓記憶體狀態穩定
- 可根據測試需求調整等待時間

### 3. **設定合理的閾值**
- 基於實際應用場景設定記憶體限制
- 考慮測試環境和生產環境的差異
- 定期檢討和更新閾值標準

## 📈 效益評估

### v0.12.9 記憶體測試系統重構成果

**Before (假數據系統)**:
- ❌ 無法檢測真實記憶體問題
- ❌ 測試結果不可信賴
- ❌ 無法指導實際優化工作

**After (真實測量系統)**:
- ✅ 檢測真實記憶體洩漏
- ✅ 提供可操作的優化指標
- ✅ 建立可重現的測試標準
- ✅ 支援持續效能監控

**測試通過率**: 100% (記憶體管理測試已通過)
**實作完成度**: Phase 4.2 完成，正在進行 Phase 4.3

## 🚀 後續步驟

1. **Phase 4.4**: 重構其他記憶體測試
2. **Phase 5**: 建立測試完整性檢查機制
3. **持續監控**: 定期檢查記憶體測試指標
4. **文件維護**: 根據實際使用經驗更新最佳實踐

---

**建立日期**: 2025-09-14  
**版本**: v0.12.9-memory-testing-best-practices  
**負責人**: Claude Code TDD 協作系統  
**狀態**: ✅ 已完成並通過測試驗證