# Platform Domain 測試執行指引

**版本**: v2.0.0  
**建立日期**: 2025-08-13  
**維護者**: sage-test-architect (TDD 測試設計專家)

## 測試概覽

本文件說明 Platform Domain v2.0 的完整測試設計和執行方式，包含單元測試、整合測試、效能基準測試等。

### 測試目標

- **100% 單元測試覆蓋** - 涵蓋所有可測試程式碼路徑
- **95%+ 整合測試覆蓋** - 確保服務間協作正確
- **效能基準達標** - 符合 Platform Domain v2.0 效能要求
- **向後相容性保證** - 確保 Readmoo 平台無縫遷移

### [STATS] 測試覆蓋範圍

#### 已實現測試 [OK] 

1. **Platform Detection Service** (平台檢測服務)
   - 單元測試: 67 個測試案例
   - 整合測試: 24 個測試案例
   - 效能測試: 12 個基準測試
   - 覆蓋率目標: 100%

#### 待實現測試 [LOG] 

2. **Platform Registry Service** (平台註冊服務) - 待開發
3. **Adapter Factory Service** (適配器工廠服務) - 待開發
4. **Platform Switcher Service** (平台切換服務) - 待開發
5. **Platform Domain Coordinator** (領域協調器) - 待開發

## [START] 快速開始

### 執行所有 Platform Domain 測試

```bash
# 執行完整測試套件
npm test -- --testPathPattern="platform"

# 僅執行單元測試
npm test -- tests/unit/background/domains/platform/

# 僅執行整合測試
npm test -- tests/integration/platform/

# 僅執行效能測試
npm test -- tests/performance/platform-detection-benchmark.test.js
```

### 執行特定服務測試

```bash
# Platform Detection Service 單元測試
npm test -- tests/unit/background/domains/platform/services/platform-detection-service.test.js

# Platform Detection Service 整合測試
npm test -- tests/integration/platform/platform-detection-integration.test.js

# Platform Detection Service 效能基準測試
npm test -- tests/performance/platform-detection-benchmark.test.js
```

### 測試覆蓋率報告

```bash
# 生成覆蓋率報告
npm run test:coverage -- --testPathPattern="platform"

# 檢視 HTML 覆蓋率報告
open coverage/index.html
```

## 測試檔案結構

```
tests/
├── unit/background/domains/platform/
│   ├── services/
│   │   └── platform-detection-service.test.js      # 主要單元測試
│   └── platform-domain.test.suite.js               # 測試套件索引
├── integration/platform/
│   └── platform-detection-integration.test.js      # 整合測試
├── performance/
│   └── platform-detection-benchmark.test.js        # 效能基準測試
├── mocks/
│   └── platform-detection.mock.js                  # 模擬資料和工具
├── helpers/
│   └── platform-test-helpers.js                    # 測試輔助工具
└── README-platform-tests.md                        # 本文件
```

## 🧪 測試設計架構

### 單元測試設計 (Unit Tests)

**檔案**: `tests/unit/background/domains/platform/services/platform-detection-service.test.js`

**測試範圍**:

- 基本初始化和配置 (5 個測試)
- URL 模式匹配分析 (18 個測試)
- DOM 結構特徵檢測 (12 個測試)
- 平台檢測核心邏輯 (8 個測試)
- 檢測結果快取系統 (6 個測試)
- 信心度計算演算法 (8 個測試)
- 事件發送和監聽 (4 個測試)
- 錯誤處理和邊界情況 (4 個測試)
- 平台驗證功能 (2 個測試)

**關鍵特色**:

- 使用參數化測試 (`test.each`) 涵蓋多平台場景
- 自訂 Jest 匹配器提供專業的斷言
- 完整的邊界情況和錯誤處理測試
- 模擬真實 DOM 結構和 URL 模式

### 整合測試設計 (Integration Tests)

**檔案**: `tests/integration/platform/platform-detection-integration.test.js`

**測試範圍**:

- 事件系統整合 (3 個測試)
- 快取系統整合 (3 個測試)
- 多平台檢測協調 (3 個測試)
- 錯誤恢復和容錯機制 (3 個測試)
- 效能基準達標驗證 (3 個測試)
- 記憶體使用監控 (2 個測試)
- 並發檢測處理 (3 個測試)

**關鍵特色**:

- 模擬真實服務間協作
- 驗證事件系統雙向通訊
- 測試並發場景和競態條件
- 記憶體使用和效能監控

### 效能基準測試 (Performance Tests)

**檔案**: `tests/performance/platform-detection-benchmark.test.js`

**效能基準**:

- 平均檢測時間: ≤ 500ms
- 最大檢測時間: ≤ 1000ms
- 快取命中率: ≥ 80%
- 記憶體使用增長: ≤ 20%
- 並發檢測成功率: ≥ 95%

**測試範圍**:

- 檢測速度效能基準 (3 個測試)
- 快取效率效能測試 (2 個測試)
- 記憶體使用量監控 (3 個測試)
- 並發檢測效能基準 (2 個測試)
- 效能回歸測試 (1 個測試)

## 測試工具和模擬物件

### 模擬資料 (`platform-detection.mock.js`)

**功能**:

- 5個平台的 URL 模式測試資料 (100+ 個真實 URL)
- DOM 元素特徵模擬資料 (選擇器、屬性、文字內容)
- 動態 DOM 模擬物件建立器
- 檢測上下文建構器
- 檢測結果驗證器
- 效能測試輔助工具
- 測試場景建構器

**關鍵特色**:

- 基於真實平台網站結構
- 支援動態場景生成
- 內建效能監控工具

### 測試輔助工具 (`platform-test-helpers.js`)

**功能**:

- 自訂 Jest 匹配器 (4個專業匹配器)
- 平台檢測斷言工具
- 測試資料生成器
- 效能測試工具
- 測試報告生成器

**自訂匹配器**:

- `toBeValidDetectionResult()` - 驗證檢測結果結構
- `toHaveConfidenceAbove(threshold)` - 驗證信心度閾值
- `toContainFeatures(features)` - 驗證平台特徵
- `toCompleteWithin(time)` - 驗證效能時間

## [STATS] 測試執行和報告

### 測試執行統計

```bash
# 檢視測試統計
npm test -- --verbose tests/unit/background/domains/platform/platform-domain.test.suite.js
```

**預期輸出**:

```
Platform Domain Test Suite
  ✓ Platform Detection Service (67 tests)
  ○ Platform Registry Service (待實現)
  ○ Adapter Factory Service (待實現)
  ○ Platform Switcher Service (待實現)
  ○ Platform Domain Coordinator (待實現)

Test Summary:
  Total Tests: 67 implemented + 36 pending
  Unit Tests: 67 [OK] 
  Integration Tests: 24 [OK] 
  Performance Tests: 12 [OK] 
```

### 效能基準報告

效能測試會生成詳細的基準報告:

```
Performance Benchmark Report
============================
Status: PASSED ✓

Metrics:
- Average Time: 245.32ms (Limit: 500ms)
- Maximum Time: 687.45ms (Limit: 1000ms)
- Success Rate: 100.0% (Min: 95.0%)
- Cache Hit Rate: 92.5% (Target: 80.0%)

All benchmarks passed!
```

## [FIX] 測試環境配置

### Jest 配置調整

針對 Platform Domain 測試，建議在 `jest.config.js` 中調整:

```javascript
module.exports = {
  // 針對 platform domain 的特殊配置
  testEnvironment: 'jsdom',

  // 平台測試專用的覆蓋率閾值
  coverageThreshold: {
    './src/background/domains/platform/': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },

  // 效能測試超時設定
  testTimeout: 30000, // 30秒，用於效能基準測試

  // 平台測試專用的設定檔
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/platform-test-helpers.js']
}
```

### 測試環境變數

```bash
# 開啟效能測試詳細輸出
PLATFORM_PERF_VERBOSE=true npm test

# 開啟記憶體監控
NODE_OPTIONS="--expose-gc" npm test

# 效能測試專用模式
NODE_ENV=performance-test npm test
```

## [LOG] 測試維護指引

### 新增測試案例

1. **單元測試新增**:
   - 在對應的 `describe` 區塊中加入新測試
   - 使用現有的模擬資料和輔助工具
   - 確保測試命名清楚且描述性強

2. **整合測試新增**:
   - 考慮跨服務的協作場景
   - 使用真實的事件流程測試
   - 驗證錯誤處理和恢復機制

3. **效能測試新增**:
   - 定義明確的效能基準
   - 使用統一的測量工具
   - 提供詳細的效能報告

### 測試資料維護

- **URL 模式更新**: 在 `PLATFORM_URL_PATTERNS` 中新增真實的平台 URL
- **DOM 特徵更新**: 在 `DOM_FEATURES` 中更新平台的 DOM 結構特徵
- **效能基準調整**: 在 `PERFORMANCE_BENCHMARKS` 中調整基準值

### 失敗測試除錯

1. **檢查模擬資料**: 確認模擬的 DOM 結構和 URL 是否符合真實情況
2. **驗證事件發送**: 使用 `mockEventBus.emit.mock.calls` 檢查事件發送
3. **效能問題除錯**: 使用 `console.log` 輸出詳細的效能測量資料
4. **記憶體洩漏檢查**: 開啟 `--expose-gc` 選項並檢查記憶體使用

## [ALERT] 重要注意事項

### 不可測試程式碼標註

根據 TDD 要求，對於無法測試的程式碼部分（如第三方 API 調用限制），已在設計文件中明確標註：

```javascript
// 例如：Chrome Extension API 調用
// 標註: 無法直接測試，使用模擬物件代替
// 建議: 透過依賴注入改善可測試性
```

### 測試覆蓋率要求

- **單元測試**: 100% 覆蓋所有可測試程式碼
- **整合測試**: 95%+ 覆蓋服務間協作
- **效能測試**: 100% 覆蓋關鍵效能指標
- **邊界測試**: 100% 覆蓋錯誤處理路徑

### CI/CD 整合

測試套件已設計為支援 CI/CD 流程:

```bash
# CI/CD 管道中的測試命令
npm run test:coverage -- --testPathPattern="platform" --ci --watchAll=false
```

---

**建立者**: sage-test-architect  
**最後更新**: 2025-08-13  
**版本**: v2.0.0

此測試設計遵循 CLAUDE.md 中的 TDD 嚴格要求和架構債務零容忍原則，確保 Platform Domain 實現的最高品質和可維護性。
