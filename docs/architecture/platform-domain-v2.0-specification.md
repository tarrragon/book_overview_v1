# 🌐 Platform Domain v2.0 技術規範

**版本**: v2.1.0  
**建立日期**: 2025-08-13  
**狀態**: 實現階段 - Phase 1.1  
**責任領域**: 平台管理、適配器工廠、多平台協調

## 🎯 領域職責定義

Platform Domain 是 Domain 架構 v2.0 的核心新增領域，負責：

### **核心職責**
- **多平台自動識別**: 檢測使用者當前訪問的電子書平台
- **適配器生命週期管理**: 動態載入、配置、管理平台適配器
- **平台切換協調**: 處理使用者在不同平台間切換的狀態管理
- **平台資源隔離**: 確保不同平台的資料和配置完全分離

### **支援平台列表**
- **Readmoo** (`READMOO`) - 台灣繁體中文電子書平台
- **博客來** (`BOOKS_COM`) - 台灣最大網路書店
- **Amazon Kindle** (`KINDLE`) - 全球電子書平台
- **樂天 Kobo** (`KOBO`) - 日系國際電子書平台  
- **BookWalker** (`BOOKWALKER`) - ACG特化電子書平台

## 📋 服務架構設計

### 1. **platform-detection-service.js** - 平台檢測服務

```javascript
/**
 * 平台自動檢測和識別服務
 * 負責功能：
 * - URL 模式匹配分析
 * - DOM 結構特徵檢測
 * - API 端點驗證
 * - 平台信心度評估
 */
class PlatformDetectionService {
  constructor(eventBus) {
    this.eventBus = eventBus
    this.platformPatterns = this.initializePlatformPatterns()
    this.detectionCache = new Map()
    this.confidenceThreshold = 0.8
  }

  /**
   * 檢測當前平台
   * @param {Object} context - 檢測上下文 { url, hostname, DOM }
   * @returns {Promise<PlatformDetectionResult>}
   */
  async detectPlatform(context) {
    // 實現平台檢測邏輯
  }

  /**
   * 驗證平台檢測結果
   * @param {string} platformId - 平台標識符
   * @param {Object} context - 檢測上下文
   * @returns {Promise<number>} 信心度 (0-1)
   */
  async validatePlatform(platformId, context) {
    // 實現平台驗證邏輯
  }
}
```

**資料結構定義**:
```javascript
const PlatformDetectionResult = {
  platformId: String,        // READMOO, KINDLE, KOBO, etc.
  confidence: Number,        // 檢測信心度 (0-1)
  features: Array,           // 檢測到的平台特徵
  version: String,           // 平台版本 (如果可檢測)
  capabilities: Array,       // 平台能力清單
  metadata: Object          // 額外的平台特定資訊
}
```

**關鍵事件**:
```javascript
'PLATFORM.DETECTION.STARTED'          // 平台檢測開始
'PLATFORM.DETECTION.COMPLETED'        // 平台檢測完成
'PLATFORM.DETECTION.FAILED'           // 平台檢測失敗
'PLATFORM.VALIDATION.PASSED'          // 平台驗證通過
'PLATFORM.VALIDATION.FAILED'          // 平台驗證失敗
```

### 2. **platform-registry-service.js** - 平台註冊管理服務

```javascript
/**
 * 平台適配器註冊表管理服務
 * 負責功能：
 * - 適配器註冊和註銷
 * - 平台能力配置管理
 * - 版本相容性檢查
 * - 動態載入控制
 */
class PlatformRegistryService {
  constructor(eventBus, configService) {
    this.eventBus = eventBus
    this.configService = configService
    this.registeredPlatforms = new Map()
    this.adapterConfigs = new Map()
    this.loadedAdapters = new Map()
  }

  /**
   * 註冊平台適配器
   * @param {PlatformAdapterConfig} adapterConfig - 適配器配置
   * @returns {Promise<boolean>}
   */
  async registerPlatformAdapter(adapterConfig) {
    // 實現適配器註冊邏輯
  }

  /**
   * 取得平台配置
   * @param {string} platformId - 平台標識符
   * @returns {PlatformAdapterConfig|null}
   */
  getPlatformConfig(platformId) {
    // 實現配置取得邏輯
  }

  /**
   * 檢查平台可用性
   * @param {string} platformId - 平台標識符
   * @returns {Promise<boolean>}
   */
  async isPlatformAvailable(platformId) {
    // 實現可用性檢查邏輯
  }
}
```

**資料結構定義**:
```javascript
const PlatformAdapterConfig = {
  platformId: String,           // 平台標識符
  adapterClass: String,         // 適配器類別名稱
  version: String,              // 適配器版本
  capabilities: Array,          // 支援的功能列表
  requirements: Object,         // 環境需求
  loadPriority: Number,         // 載入優先級
  configuration: Object         // 平台特定配置
}
```

**關鍵事件**:
```javascript
'PLATFORM.REGISTRY.ADAPTER.REGISTERED'    // 適配器註冊完成
'PLATFORM.REGISTRY.ADAPTER.UNREGISTERED'  // 適配器註銷完成
'PLATFORM.REGISTRY.CONFIG.UPDATED'        // 平台配置更新
'PLATFORM.REGISTRY.AVAILABILITY.CHANGED'  // 平台可用性變更
```

### 3. **adapter-factory-service.js** - 適配器工廠服務

```javascript
/**
 * 適配器工廠模式服務
 * 負責功能：
 * - 適配器實例化
 * - 依賴注入和配置
 * - 生命週期管理
 * - 資源池管理
 */
class AdapterFactoryService {
  constructor(eventBus, registryService) {
    this.eventBus = eventBus
    this.registryService = registryService
    this.adapterPool = new Map()
    this.instanceCache = new Map()
    this.maxPoolSize = 10
  }

  /**
   * 建立平台適配器實例
   * @param {string} platformId - 平台標識符
   * @param {Object} options - 建立選項
   * @returns {Promise<PlatformAdapter>}
   */
  async createAdapter(platformId, options = {}) {
    // 實現適配器建立邏輯
  }

  /**
   * 取得快取的適配器實例
   * @param {string} platformId - 平台標識符
   * @returns {PlatformAdapter|null}
   */
  getCachedAdapter(platformId) {
    // 實現快取適配器取得邏輯
  }

  /**
   * 釋放適配器資源
   * @param {string} platformId - 平台標識符
   * @returns {Promise<boolean>}
   */
  async releaseAdapter(platformId) {
    // 實現適配器資源釋放邏輯
  }
}
```

**資料結構定義**:
```javascript
const PlatformAdapter = {
  platformId: String,           // 平台標識符
  instance: Object,             // 適配器實例
  createdAt: Date,              // 建立時間
  lastUsed: Date,               // 最後使用時間
  configuration: Object,        // 實例配置
  statistics: Object           // 使用統計
}
```

**關鍵事件**:
```javascript
'PLATFORM.ADAPTER.CREATED'             // 適配器建立完成
'PLATFORM.ADAPTER.CACHED'              // 適配器快取完成
'PLATFORM.ADAPTER.RELEASED'            // 適配器釋放完成
'PLATFORM.ADAPTER.POOL.FULL'           // 適配器池已滿
'PLATFORM.ADAPTER.LIFECYCLE.EXPIRED'   // 適配器生命週期過期
```

### 4. **platform-switcher-service.js** - 平台切換控制服務

```javascript
/**
 * 平台切換控制和狀態管理服務
 * 負責功能：
 * - 跨平台導航協調
 * - 狀態遷移管理
 * - 使用者體驗優化
 * - 切換歷史記錄
 */
class PlatformSwitcherService {
  constructor(eventBus, adapterFactory) {
    this.eventBus = eventBus
    this.adapterFactory = adapterFactory
    this.currentPlatform = null
    this.previousPlatform = null
    this.switchHistory = []
    this.maxHistorySize = 50
  }

  /**
   * 切換到指定平台
   * @param {string} targetPlatformId - 目標平台標識符
   * @param {Object} switchOptions - 切換選項
   * @returns {Promise<PlatformSwitchResult>}
   */
  async switchToPlatform(targetPlatformId, switchOptions = {}) {
    // 實現平台切換邏輯
  }

  /**
   * 取得目前平台
   * @returns {string|null}
   */
  getCurrentPlatform() {
    return this.currentPlatform
  }

  /**
   * 取得切換歷史
   * @param {number} limit - 取得筆數限制
   * @returns {Array<PlatformSwitchRecord>}
   */
  getSwitchHistory(limit = 10) {
    // 實現切換歷史取得邏輯
  }
}
```

**資料結構定義**:
```javascript
const PlatformSwitchResult = {
  success: Boolean,             // 切換是否成功
  fromPlatform: String,         // 來源平台
  toPlatform: String,           // 目標平台
  switchTime: Date,             // 切換時間
  duration: Number,             // 切換耗時 (ms)
  error: String                 // 錯誤訊息 (如果失敗)
}

const PlatformSwitchRecord = {
  switchId: String,             // 切換記錄ID
  fromPlatform: String,         // 來源平台
  toPlatform: String,           // 目標平台
  timestamp: Date,              // 切換時間戳
  reason: String,               // 切換原因
  userAgent: String,            // 使用者代理
  success: Boolean              // 切換結果
}
```

**關鍵事件**:
```javascript
'PLATFORM.SWITCH.REQUESTED'            // 平台切換請求
'PLATFORM.SWITCH.STARTED'              // 平台切換開始
'PLATFORM.SWITCH.COMPLETED'            // 平台切換完成
'PLATFORM.SWITCH.FAILED'               // 平台切換失敗
'PLATFORM.SWITCH.HISTORY.UPDATED'      // 切換歷史更新
```

## 🔗 Platform Domain 協調器設計

```javascript
/**
 * Platform Domain 協調器 - 統一協調4個專業服務
 */
class PlatformDomainCoordinator extends EventHandler {
  constructor(eventBus) {
    super('PlatformDomainCoordinator', EventPriority.PLATFORM_SWITCH)
    this.eventBus = eventBus
    
    // 注入4個核心服務
    this.detectionService = null
    this.registryService = null
    this.adapterFactory = null
    this.switcherService = null
  }

  /**
   * 初始化 Platform Domain
   * @returns {Promise<void>}
   */
  async initialize() {
    // 依序初始化4個服務
    // 建立服務間依賴關係
    // 註冊事件監聽器
  }

  /**
   * 處理平台檢測請求
   * @param {Object} event - 檢測請求事件
   */
  async handlePlatformDetectionRequest(event) {
    // 協調平台檢測流程
  }

  /**
   * 處理平台切換請求
   * @param {Object} event - 切換請求事件  
   */
  async handlePlatformSwitchRequest(event) {
    // 協調平台切換流程
  }
}
```

## 📊 API 接口規範

### **對外 API 接口**

```javascript
// Platform Domain 統一對外接口
const PlatformDomainAPI = {
  // 平台檢測
  async detectCurrentPlatform() {
    return await this.coordinator.detectCurrentPlatform()
  },

  // 平台切換
  async switchToPlatform(platformId, options = {}) {
    return await this.coordinator.switchToPlatform(platformId, options)
  },

  // 取得支援平台清單
  getSupportedPlatforms() {
    return this.coordinator.getSupportedPlatforms()
  },

  // 取得當前平台資訊
  getCurrentPlatformInfo() {
    return this.coordinator.getCurrentPlatformInfo()
  }
}
```

### **內部服務協作接口**

```javascript
// 服務間依賴注入接口
const ServiceDependencies = {
  // Detection Service 依賴
  detectionService: {
    requires: ['eventBus', 'configService'],
    provides: ['detectPlatform', 'validatePlatform']
  },

  // Registry Service 依賴
  registryService: {
    requires: ['eventBus', 'configService'],
    provides: ['registerAdapter', 'getPlatformConfig']
  },

  // Adapter Factory 依賴
  adapterFactory: {
    requires: ['eventBus', 'registryService'],
    provides: ['createAdapter', 'getCachedAdapter']
  },

  // Switcher Service 依賴
  switcherService: {
    requires: ['eventBus', 'adapterFactory'],  
    provides: ['switchToPlatform', 'getCurrentPlatform']
  }
}
```

## 🎭 事件系統 v2.0 整合

### **Platform Domain 事件命名規範**

```javascript
// v2.0 階層式事件命名: DOMAIN.PLATFORM.ACTION.STATE
const PlatformEvents = {
  // 平台檢測事件
  DETECTION: {
    STARTED: 'PLATFORM.DETECTION.STARTED',
    COMPLETED: 'PLATFORM.DETECTION.COMPLETED', 
    FAILED: 'PLATFORM.DETECTION.FAILED'
  },

  // 平台切換事件 (支援所有平台)
  SWITCH: {
    READMOO: {
      STARTED: 'PLATFORM.READMOO.SWITCH.STARTED',
      COMPLETED: 'PLATFORM.READMOO.SWITCH.COMPLETED'
    },
    KINDLE: {
      STARTED: 'PLATFORM.KINDLE.SWITCH.STARTED',
      COMPLETED: 'PLATFORM.KINDLE.SWITCH.COMPLETED'
    },
    // ... 其他平台
    UNIFIED: {
      STARTED: 'PLATFORM.UNIFIED.SWITCH.STARTED',
      COMPLETED: 'PLATFORM.UNIFIED.SWITCH.COMPLETED'
    }
  },

  // 適配器事件
  ADAPTER: {
    CREATED: 'PLATFORM.ADAPTER.CREATED',
    LOADED: 'PLATFORM.ADAPTER.LOADED',
    FAILED: 'PLATFORM.ADAPTER.FAILED'
  }
}
```

### **向後相容性支援**

```javascript
// v1.0 → v2.0 事件轉換對應
const LegacyEventMapping = {
  // 舊版平台事件自動轉換
  'PLATFORM.DETECTED': 'PLATFORM.READMOO.DETECTION.COMPLETED',
  'PLATFORM.CHANGED': 'PLATFORM.READMOO.SWITCH.COMPLETED',
  'ADAPTER.LOADED': 'PLATFORM.READMOO.ADAPTER.LOADED'
}
```

## 🧪 測試策略與覆蓋要求

### **單元測試覆蓋 (100%)**

```javascript
// 每個服務的測試結構
describe('Platform Detection Service', () => {
  describe('Platform Detection', () => {
    test('should detect Readmoo platform correctly')
    test('should detect Kindle platform correctly')
    test('should return unknown for unsupported platforms')
    test('should validate detection confidence threshold')
  })
  
  describe('DOM Analysis', () => {
    test('should analyze DOM features accurately')
    test('should handle DOM changes gracefully')
  })
  
  describe('Error Handling', () => {
    test('should handle network errors')
    test('should handle invalid URLs')
    test('should provide meaningful error messages')
  })
})
```

### **整合測試覆蓋 (95%+)**

```javascript
describe('Platform Domain Integration', () => {
  describe('Service Coordination', () => {
    test('should coordinate detection → registry → factory → switcher flow')
    test('should handle service dependency injection correctly')
    test('should maintain service lifecycle properly')
  })
  
  describe('Event System Integration', () => {
    test('should emit correct v2.0 events')
    test('should maintain v1.0 event compatibility')
    test('should handle event priority correctly')
  })
})
```

### **向後相容性測試 (100%)**

```javascript
describe('Backward Compatibility', () => {
  describe('Readmoo Platform Migration', () => {
    test('should maintain all existing Readmoo functionality')
    test('should preserve API interface signatures')
    test('should convert legacy events correctly')
  })
  
  describe('Performance Impact', () => {
    test('should not degrade existing performance')
    test('should maintain memory usage within limits')
  })
})
```

## 🚀 效能基準與監控

### **效能基準要求**

```javascript
const PerformanceBenchmarks = {
  platformDetection: {
    averageTime: 500,      // ms - 平均檢測時間
    maxTime: 1000,         // ms - 最大檢測時間
    cacheHitRate: 0.8      // 快取命中率
  },
  
  adapterLoading: {
    averageTime: 200,      // ms - 平均載入時間
    maxTime: 500,          // ms - 最大載入時間
    poolEfficiency: 0.9    // 資源池效率
  },
  
  platformSwitching: {
    averageTime: 1000,     // ms - 平均切換時間
    maxTime: 2000,         // ms - 最大切換時間
    successRate: 0.95      // 切換成功率
  },
  
  memoryUsage: {
    maxIncrease: 0.2,      // 最大記憶體使用增長 20%
    leakTolerance: 0       // 記憶體洩漏容忍度 0%
  }
}
```

### **監控指標**

```javascript
const MonitoringMetrics = {
  // 使用統計
  detectionRequests: 0,
  switchingRequests: 0,
  adapterCreations: 0,
  
  // 效能指標
  averageDetectionTime: 0,
  averageSwitchTime: 0,
  cacheHitRate: 0,
  
  // 錯誤統計
  detectionErrors: 0,
  switchingErrors: 0,
  adapterErrors: 0,
  
  // 資源使用
  activeAdapters: 0,
  memoryUsage: 0,
  cpuUsage: 0
}
```

## 🛡️ 錯誤處理與恢復策略

### **錯誤分類與處理**

```javascript
const ErrorHandlingStrategy = {
  // 檢測錯誤處理
  DetectionError: {
    NetworkError: 'retry with exponential backoff',
    InvalidURL: 'return unknown platform with warning',
    DOMError: 'fallback to URL-based detection',
    TimeoutError: 'return cached result if available'
  },
  
  // 適配器錯誤處理
  AdapterError: {
    LoadingError: 'attempt alternative adapter source',
    ConfigurationError: 'use default configuration',
    InitializationError: 'mark adapter as unavailable',
    RuntimeError: 'restart adapter with error reporting'
  },
  
  // 切換錯誤處理  
  SwitchingError: {
    AdapterUnavailable: 'queue switch for later retry',
    StateConflict: 'force state reset and retry',
    UserAborted: 'clean up partial state',
    SystemError: 'rollback to previous platform'
  }
}
```

### **恢復機制**

```javascript
const RecoveryMechanisms = {
  // 自動恢復
  autoRecovery: {
    maxRetries: 3,
    retryInterval: 1000,    // ms
    backoffMultiplier: 2.0
  },
  
  // 狀態恢復
  stateRecovery: {
    checkpointInterval: 5000,  // ms
    maxCheckpoints: 10,
    recoveryTimeout: 30000     // ms
  },
  
  // 資源恢復
  resourceRecovery: {
    memoryThreshold: 0.8,      // 80% 記憶體使用觸發清理
    adapterPoolCleanup: true,
    cacheEvictionPolicy: 'LRU'
  }
}
```

## 📝 實現檢查清單

### **Phase 1.1 基礎架構 (2天)**

- [ ] **platform-detection-service.js**
  - [ ] 基礎平台識別邏輯
  - [ ] URL 模式匹配實現
  - [ ] DOM 特徵檢測機制
  - [ ] 檢測結果快取系統
  - [ ] 100% 單元測試覆蓋

- [ ] **platform-registry-service.js**  
  - [ ] 適配器註冊表管理
  - [ ] 平台配置載入機制
  - [ ] 版本相容性檢查
  - [ ] 動態載入控制邏輯
  - [ ] 100% 單元測試覆蓋

- [ ] **platform-domain-coordinator.js**
  - [ ] 服務依賴注入設計
  - [ ] 事件監聽器註冊
  - [ ] 協調流程實現
  - [ ] 錯誤處理機制
  - [ ] 整合測試覆蓋

### **Phase 1.2 適配器系統 (2天)**

- [ ] **adapter-factory-service.js**
  - [ ] 適配器工廠模式實現
  - [ ] 實例化邏輯和配置注入
  - [ ] 生命週期管理機制
  - [ ] 資源池管理功能
  - [ ] 100% 單元測試覆蓋

- [ ] **platform-switcher-service.js**
  - [ ] 平台切換控制邏輯
  - [ ] 狀態遷移管理機制
  - [ ] 切換歷史記錄功能
  - [ ] 使用者體驗優化
  - [ ] 100% 單元測試覆蓋

### **整合驗證要求**

- [ ] **Platform Domain 完整整合測試**
- [ ] **與既有領域的協作測試**
- [ ] **事件系統 v2.0 相容性測試**
- [ ] **Readmoo 平台無縫遷移驗證**
- [ ] **效能基準達標驗證**
- [ ] **記憶體使用監控通過**

---

**規範負責人**: rosemary-project-manager (專案管理) + sage-test-architect (測試設計)  
**技術實現負責人**: thyme-extension-engineer + basil-event-architect  
**審核週期**: 每日檢視進度，每週更新規範

本規範遵循 CLAUDE.md 中的文件先行策略和架構債務零容忍原則，確保 Platform Domain 的實現品質和長期可維護性。