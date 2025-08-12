# Background Service Worker 重構架構設計文件

## 🎯 重構目標

將 1000+ 行的 `src/background/background.js` 重構為基於單一職責原則和事件驅動架構的模組化系統，提升程式碼可維護性、可測試性和擴展性。

## 📊 現況分析

### 當前問題
- **職責過於集中**：單一檔案承擔了事件系統、通訊管理、生命週期、監控等多項職責
- **程式碼臃腫**：1088 行程式碼難以維護和除錯
- **測試困難**：高耦合度使得單元測試和集成測試複雜
- **擴展性差**：新增功能需要修改主要檔案，違反開放/封閉原則

### 架構債務識別
1. **混合關注點**：事件處理、訊息路由、系統監控混在同一檔案
2. **缺乏抽象層**：直接操作 Chrome API 而無統一封裝
3. **硬編碼依賴**：模組間存在直接引用，難以測試和替換
4. **錯誤處理分散**：錯誤處理邏輯散佈在各個函數中

## 🏗 重構架構設計

### 雙層拆分策略

#### 第一層：單一職責原則拆分

**1. Service Worker 生命週期管理** (`src/background/lifecycle/`)
```
src/background/lifecycle/
├── lifecycle-coordinator.js    # 生命週期協調器
├── install-handler.js         # 安裝處理器
├── startup-handler.js         # 啟動處理器
└── shutdown-handler.js        # 關閉處理器
```

**職責範圍**：
- 擴展安裝/更新/卸載處理
- Service Worker 啟動/重啟協調
- 系統初始化順序管理
- 依賴模組的載入協調

**2. 跨上下文通訊管理** (`src/background/messaging/`)
```
src/background/messaging/
├── message-router.js          # 訊息路由器
├── content-message-handler.js # Content Script 訊息處理
├── popup-message-handler.js   # Popup 訊息處理
└── chrome-api-wrapper.js      # Chrome API 封裝
```

**職責範圍**：
- 統一訊息路由和分發
- 訊息格式標準化和驗證
- 跨上下文通訊狀態管理
- Chrome API 的統一封裝

**3. 事件系統協調** (`src/background/events/`)
```
src/background/events/
├── event-coordinator.js       # 事件協調器
├── event-bridge-manager.js    # 事件橋接管理
├── listener-registry.js       # 監聽器註冊管理
└── event-system-initializer.js # 事件系統初始化
```

**職責範圍**：
- EventBus 和 ChromeEventBridge 初始化
- 事件監聽器的註冊和管理
- 事件轉發和橋接邏輯
- 事件系統健康檢查

**4. 頁面監控與檢測** (`src/background/monitoring/`)
```
src/background/monitoring/
├── page-monitor.js            # 頁面監控器
├── readmoo-detector.js        # Readmoo 頁面檢測
├── tab-state-tracker.js       # 標籤頁狀態追蹤
└── content-script-coordinator.js # Content Script 協調
```

**職責範圍**：
- 標籤頁狀態監聽和追蹤
- 目標頁面檢測（Readmoo）
- Content Script 注入和就緒狀態管理
- 頁面導航和重載處理

**5. 錯誤處理與監控** (`src/background/error/`)
```
src/background/error/
├── global-error-handler.js    # 全域錯誤處理器
├── system-health-monitor.js   # 系統健康監控
├── error-recovery-manager.js  # 錯誤恢復管理
└── diagnostic-collector.js    # 診斷資料收集
```

**職責範圍**：
- 全域錯誤捕獲和處理
- 系統健康狀態監控
- 錯誤恢復和重試機制
- 診斷資料收集和報告

#### 第二層：事件驅動 Domain 分離

**1. 系統領域** (`src/background/domains/system/`)
```
src/background/domains/system/
├── system-event-handlers.js   # 系統事件處理器
├── system-state-manager.js    # 系統狀態管理
├── config-manager.js          # 配置管理
└── version-manager.js         # 版本管理
```

**處理事件**：
- `SYSTEM.INSTALLED`, `SYSTEM.STARTUP`, `SYSTEM.ERROR`
- `SYSTEM.READY`, `SYSTEM.SHUTDOWN`

**2. 頁面領域** (`src/background/domains/page/`)
```
src/background/domains/page/
├── page-event-handlers.js     # 頁面事件處理器
├── page-state-tracker.js      # 頁面狀態追蹤
└── content-coordination.js    # Content Script 協調
```

**處理事件**：
- `PAGE.READMOO.DETECTED`, `PAGE.CONTENT.READY`
- `PAGE.CONTENT.NOT_READY`, `PAGE.NAVIGATION.CHANGED`

**3. 提取領域** (`src/background/domains/extraction/`)
```
src/background/domains/extraction/
├── extraction-event-handlers.js # 提取事件處理器
├── data-storage-coordinator.js  # 資料儲存協調
├── extraction-progress-tracker.js # 提取進度追蹤
└── validation-manager.js        # 資料驗證管理
```

**處理事件**：
- `EXTRACTION.COMPLETED`, `EXTRACTION.STARTED`
- `EXTRACTION.PROGRESS`, `EXTRACTION.ERROR`

**4. 通訊領域** (`src/background/domains/messaging/`)
```
src/background/domains/messaging/
├── messaging-event-handlers.js  # 通訊事件處理器
├── cross-context-coordinator.js # 跨上下文協調
└── message-state-manager.js     # 訊息狀態管理
```

**處理事件**：
- `CONTENT.MESSAGE.RECEIVED`, `POPUP.MESSAGE.RECEIVED`
- `MESSAGE.SENT`, `MESSAGE.FAILED`

### 統一協調層

**主要協調器** (`src/background/background.js`)
```javascript
/**
 * Background Service Worker 主協調器
 * 
 * 職責：
 * - 載入和初始化各個模組
 * - 協調模組間的啟動順序
 * - 提供統一的錯誤處理
 * - 註冊 Chrome Extension 生命週期監聽器
 */
```

## 📋 實作規範

### 模組設計原則

1. **單一職責**：每個模組只負責一個明確的功能領域
2. **依賴注入**：通過構造函數注入依賴，便於測試
3. **事件驅動**：模組間通過事件系統通訊，避免直接依賴
4. **錯誤隔離**：每個模組有自己的錯誤邊界和處理機制
5. **可測試性**：所有模組都可以獨立測試

### 介面規範

**模組標準介面**：
```javascript
class BaseModule {
  constructor(dependencies = {}) {
    // 依賴注入
  }
  
  async initialize() {
    // 初始化邏輯
  }
  
  async start() {
    // 啟動邏輯
  }
  
  async stop() {
    // 停止邏輯
  }
  
  async cleanup() {
    // 清理邏輯
  }
  
  getHealthStatus() {
    // 健康狀態檢查
  }
}
```

**事件處理器標準介面**：
```javascript
class BaseDomainHandler {
  constructor(eventBus, logger) {
    this.eventBus = eventBus
    this.logger = logger
  }
  
  registerEventHandlers() {
    // 註冊事件監聽器
  }
  
  async handleEvent(event) {
    // 處理特定事件
  }
  
  unregisterEventHandlers() {
    // 取消註冊事件監聽器
  }
}
```

### 錯誤處理策略

1. **分層錯誤處理**：
   - 模組級錯誤：在模組內部處理
   - 系統級錯誤：上報到全域錯誤處理器
   - 致命錯誤：觸發恢復機制

2. **錯誤恢復機制**：
   - 自動重試：對於暫時性錯誤
   - 降級服務：保持基本功能運行
   - 系統重啟：在無法恢復時重新初始化

## 🧪 測試策略

### 測試覆蓋範圍

1. **單元測試**：每個模組的獨立功能測試
2. **整合測試**：模組間協作和事件流測試
3. **端對端測試**：完整功能流程測試

### 測試工具和框架

- **Jest**：單元測試和整合測試
- **Chrome Extension API Mocks**：模擬 Chrome API
- **事件系統測試工具**：驗證事件流和處理器

## 📈 遷移計劃

### 階段 1：架構準備（第 1-3 個任務）
- 撰寫完整設計文件
- 確認測試覆蓋率
- 建立新的目錄結構

### 階段 2：核心模組拆分（第 4-8 個任務）
- 按單一職責原則拆分現有功能
- 建立標準化介面和抽象層
- 實現依賴注入和模組化

### 階段 3：事件驅動重構（第 9-12 個任務）
- 建立領域事件處理器
- 分離事件邏輯和通訊邏輯
- 實現事件驅動架構

### 階段 4：整合驗證（第 13-15 個任務）
- 重構主協調器
- 執行完整測試套件
- 更新文件和日誌

## 🎯 預期效益

### 程式碼品質提升
- **可讀性**：每個模組職責明確，程式碼更易理解
- **可維護性**：修改和擴展功能更加容易
- **可測試性**：模組化設計使測試更加簡單

### 開發效率提升
- **並行開發**：不同開發者可以同時處理不同模組
- **除錯便利**：問題定位更加精確
- **功能擴展**：新增功能時影響範圍更小

### 系統穩定性提升
- **錯誤隔離**：單個模組錯誤不影響整體系統
- **恢復能力**：更好的錯誤恢復和降級機制
- **監控可視**：系統健康狀態更加透明

## 📝 風險評估

### 技術風險
- **複雜度增加**：模組數量增加可能增加系統複雜度
- **效能影響**：模組間通訊可能影響效能
- **整合困難**：事件驅動架構的除錯可能較困難

### 緩解措施
- **段階式重構**：逐步遷移，降低風險
- **充分測試**：確保每個階段都有完整測試覆蓋
- **效能監控**：持續監控系統效能指標
- **文件完整**：提供詳細的架構文件和使用指南

## 📖 參考資料

- Chrome Extension Manifest V3 最佳實踐
- 領域驅動設計 (DDD) 原則
- 事件驅動架構模式
- 單一職責原則 (SRP) 實作指南

---

此文件將作為 Background Service Worker 重構的完整指南，確保重構過程有序、高效且不影響現有功能。