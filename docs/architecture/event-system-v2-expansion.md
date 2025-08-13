# 🎭 事件系統 v2.0 擴展規劃

**版本**: v2.0.0  
**建立日期**: 2025-08-13  
**狀態**: 架構設計階段

## 🎯 擴展目標

基於當前 v1.0.0 的事件驅動架構，設計支援多平台的事件系統，實現：
- **多平台事件命名標準化**
- **跨平台事件路由和協調**  
- **事件隔離和安全機制**
- **智能事件聚合和分析**

## 📋 事件命名系統重新設計

### 1. **階層式事件命名規範**

#### **v1.0 現有格式**
```javascript
'MODULE.ACTION.STATE'
// 例如: 'EXTRACTION.COMPLETED'
```

#### **v2.0 多平台格式**
```javascript
'DOMAIN.PLATFORM.ACTION.STATE'
// 例如: 'EXTRACTION.READMOO.COMPLETED'
//      'EXTRACTION.UNIFIED.SYNC.COMPLETED'
```

#### **完整命名規範**
```javascript
const EventNaming = {
  // 領域定義
  DOMAINS: {
    SYSTEM: 'SYSTEM',
    PAGE: 'PAGE', 
    EXTRACTION: 'EXTRACTION',
    MESSAGING: 'MESSAGING',
    PLATFORM: 'PLATFORM',
    DATA: 'DATA',
    UX: 'UX',
    ANALYTICS: 'ANALYTICS',
    SECURITY: 'SECURITY'
  },
  
  // 平台標識符
  PLATFORMS: {
    READMOO: 'READMOO',
    KINDLE: 'KINDLE',
    KOBO: 'KOBO', 
    BOOKWALKER: 'BOOKWALKER',
    BOOKS_COM: 'BOOKS_COM',
    UNIFIED: 'UNIFIED',    // 跨平台統一操作
    MULTI: 'MULTI',        // 多平台協調操作
    GENERIC: 'GENERIC'     // 平台無關操作
  },
  
  // 動作類型
  ACTIONS: {
    // 生命週期動作
    INIT: 'INIT',
    START: 'START', 
    STOP: 'STOP',
    RESTART: 'RESTART',
    
    // 資料操作
    EXTRACT: 'EXTRACT',
    SAVE: 'SAVE',
    LOAD: 'LOAD',
    SYNC: 'SYNC',
    VALIDATE: 'VALIDATE',
    
    // 平台操作
    DETECT: 'DETECT',
    SWITCH: 'SWITCH',
    REGISTER: 'REGISTER',
    
    // 使用者操作
    OPEN: 'OPEN',
    CLOSE: 'CLOSE',
    NAVIGATE: 'NAVIGATE',
    
    // 分析操作
    ANALYZE: 'ANALYZE',
    REPORT: 'REPORT',
    VISUALIZE: 'VISUALIZE'
  },
  
  // 狀態類型
  STATES: {
    REQUESTED: 'REQUESTED',
    STARTED: 'STARTED',
    PROGRESS: 'PROGRESS', 
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    TIMEOUT: 'TIMEOUT'
  }
}
```

### 2. **事件構建器和驗證器**

```javascript
class EventNameBuilder {
  static build(domain, platform, action, state) {
    // 驗證參數
    if (!EventNaming.DOMAINS[domain]) {
      throw new Error(`Invalid domain: ${domain}`)
    }
    if (!EventNaming.PLATFORMS[platform]) {
      throw new Error(`Invalid platform: ${platform}`)
    }
    
    return `${domain}.${platform}.${action}.${state}`
  }
  
  static buildUnified(domain, action, state) {
    return this.build(domain, 'UNIFIED', action, state)
  }
  
  static buildMultiPlatform(domain, action, state) {
    return this.build(domain, 'MULTI', action, state)
  }
  
  static buildGeneric(domain, action, state) {
    return this.build(domain, 'GENERIC', action, state)
  }
  
  // 向後相容性轉換
  static fromLegacy(legacyEvent) {
    const legacyMap = {
      'EXTRACTION.COMPLETED': 'EXTRACTION.READMOO.EXTRACT.COMPLETED',
      'EXTRACTION.PROGRESS': 'EXTRACTION.READMOO.EXTRACT.PROGRESS',
      'STORAGE.SAVE.COMPLETED': 'DATA.READMOO.SAVE.COMPLETED',
      'UI.POPUP.OPENED': 'UX.GENERIC.OPEN.COMPLETED'
    }
    
    return legacyMap[legacyEvent] || legacyEvent
  }
}
```

### 3. **事件優先級擴展**

```javascript
const EventPriority = {
  // 系統關鍵事件 (0-99)
  SYSTEM_CRITICAL: 0,
  SECURITY_ALERT: 10,
  DATA_CORRUPTION: 20,
  SYSTEM_FAILURE: 30,
  
  // 用戶操作事件 (100-199)  
  USER_IMMEDIATE: 100,
  USER_INTERACTION: 120,
  UI_RESPONSE: 140,
  
  // 業務處理事件 (200-299)
  EXTRACTION_HIGH: 200,
  DATA_SYNC_HIGH: 220, 
  PLATFORM_SWITCH: 240,
  
  // 一般處理事件 (300-399)
  EXTRACTION_NORMAL: 300,
  DATA_PROCESSING: 320,
  ANALYTICS_UPDATE: 340,
  
  // 背景處理事件 (400-499)
  BACKGROUND_SYNC: 400,
  STATISTICS_UPDATE: 420,
  CACHE_CLEANUP: 440,
  
  // 優先級映射到具體事件類型
  getPriorityForEvent: (eventType) => {
    if (eventType.includes('SECURITY')) return EventPriority.SECURITY_ALERT
    if (eventType.includes('USER') || eventType.includes('UX')) return EventPriority.USER_INTERACTION
    if (eventType.includes('EXTRACTION')) return EventPriority.EXTRACTION_NORMAL
    if (eventType.includes('ANALYTICS')) return EventPriority.ANALYTICS_UPDATE
    return EventPriority.EXTRACTION_NORMAL // 預設優先級
  }
}
```

## 🔄 跨平台事件路由系統

### 1. **多平台事件協調器**

```javascript
class CrossPlatformEventCoordinator extends EventHandler {
  constructor(eventBus, platformRegistry) {
    super('CrossPlatformEventCoordinator', EventPriority.PLATFORM_SWITCH)
    this.eventBus = eventBus
    this.platformRegistry = platformRegistry
    this.activeRoutes = new Map()
  }
  
  async initialize() {
    // 註冊跨平台事件監聽器
    await this.registerCrossPlatformListeners()
    
    // 設定平台特定事件路由
    await this.setupPlatformRouting()
  }
  
  async registerCrossPlatformListeners() {
    // 監聽統一操作事件
    this.eventBus.on('EXTRACTION.UNIFIED.EXTRACT.STARTED', 
      this.handleUnifiedExtraction.bind(this))
    
    this.eventBus.on('DATA.UNIFIED.SYNC.STARTED',
      this.handleUnifiedDataSync.bind(this))
      
    this.eventBus.on('PLATFORM.MULTI.SWITCH.REQUESTED',
      this.handleMultiPlatformSwitch.bind(this))
  }
  
  /**
   * 處理統一提取事件 - 協調所有平台同時提取
   */
  async handleUnifiedExtraction(event) {
    const { platforms, options } = event.data
    const extractionTasks = []
    
    for (const platform of platforms) {
      const platformEvent = EventNameBuilder.build(
        'EXTRACTION', platform, 'EXTRACT', 'STARTED'
      )
      
      const task = this.eventBus.emit(platformEvent, {
        ...options,
        coordinationId: event.id,
        platform
      })
      
      extractionTasks.push({ platform, task })
    }
    
    // 等待所有平台完成
    const results = await Promise.allSettled(
      extractionTasks.map(t => t.task)
    )
    
    // 觸發統一完成事件
    await this.eventBus.emit('EXTRACTION.UNIFIED.EXTRACT.COMPLETED', {
      platforms,
      results: results.map((result, index) => ({
        platform: extractionTasks[index].platform,
        status: result.status,
        data: result.value,
        error: result.reason
      })),
      totalBooks: results.reduce((sum, r) => 
        sum + (r.value?.books?.length || 0), 0),
      coordinationId: event.id
    })
  }
  
  /**
   * 處理跨平台資料同步
   */
  async handleUnifiedDataSync(event) {
    const { sourcePlatform, targetPlatforms, syncOptions } = event.data
    
    // 從源平台載入資料
    const sourceData = await this.eventBus.emit(
      `DATA.${sourcePlatform}.LOAD.STARTED`, syncOptions
    )
    
    // 同步到目標平台
    const syncTasks = targetPlatforms.map(async (platform) => {
      const normalizedData = await this.normalizeDataForPlatform(
        sourceData, platform
      )
      
      return this.eventBus.emit(
        `DATA.${platform}.SAVE.STARTED`,
        { data: normalizedData, syncId: event.id }
      )
    })
    
    const syncResults = await Promise.allSettled(syncTasks)
    
    await this.eventBus.emit('DATA.UNIFIED.SYNC.COMPLETED', {
      sourcePlatform,
      targetPlatforms,
      results: syncResults,
      syncId: event.id
    })
  }
  
  /**
   * 資料格式標準化 - 平台間資料轉換
   */
  async normalizeDataForPlatform(data, targetPlatform) {
    const normalizer = this.platformRegistry.getNormalizer(targetPlatform)
    if (!normalizer) {
      throw new Error(`No data normalizer found for platform: ${targetPlatform}`)
    }
    
    return await normalizer.normalize(data)
  }
}
```

### 2. **事件路由規則引擎**

```javascript
class EventRoutingEngine {
  constructor() {
    this.routingRules = new Map()
    this.middlewares = []
  }
  
  /**
   * 註冊路由規則
   */
  addRoute(pattern, handler) {
    this.routingRules.set(pattern, handler)
  }
  
  /**
   * 註冊中介軟體
   */
  use(middleware) {
    this.middlewares.push(middleware)
  }
  
  /**
   * 路由事件到適當的處理器
   */
  async route(event) {
    // 應用中介軟體
    for (const middleware of this.middlewares) {
      event = await middleware(event)
    }
    
    // 查找匹配的路由規則
    for (const [pattern, handler] of this.routingRules) {
      if (this.matchPattern(event.type, pattern)) {
        return await handler(event)
      }
    }
    
    throw new Error(`No route found for event: ${event.type}`)
  }
  
  /**
   * 模式匹配 - 支援萬用字元
   */
  matchPattern(eventType, pattern) {
    const regex = new RegExp(
      pattern.replace(/\*/g, '.*').replace(/\?/g, '.')
    )
    return regex.test(eventType)
  }
  
  /**
   * 設定預設路由規則
   */
  setupDefaultRoutes() {
    // 平台特定事件路由到對應適配器
    this.addRoute('EXTRACTION.*.EXTRACT.*', async (event) => {
      const platform = event.type.split('.')[1]
      const adapter = await this.getAdapterForPlatform(platform)
      return adapter.handleExtractionEvent(event)
    })
    
    // 跨平台統一事件路由到協調器
    this.addRoute('*.UNIFIED.*', async (event) => {
      return this.crossPlatformCoordinator.handle(event)
    })
    
    // 安全相關事件路由到安全領域
    this.addRoute('SECURITY.*', async (event) => {
      return this.securityDomain.handle(event)
    })
  }
}
```

### 3. **事件聚合和批量處理**

```javascript
class EventAggregator {
  constructor(eventBus, config = {}) {
    this.eventBus = eventBus
    this.batchSize = config.batchSize || 10
    this.batchTimeout = config.batchTimeout || 5000
    this.aggregationBuffer = new Map()
    this.timers = new Map()
  }
  
  /**
   * 註冊需要聚合的事件模式
   */
  aggregateEvents(pattern, aggregator) {
    this.eventBus.on(pattern, async (event) => {
      await this.addToAggregation(pattern, event, aggregator)
    })
  }
  
  /**
   * 將事件加入聚合緩衝區
   */
  async addToAggregation(pattern, event, aggregator) {
    if (!this.aggregationBuffer.has(pattern)) {
      this.aggregationBuffer.set(pattern, [])
    }
    
    const buffer = this.aggregationBuffer.get(pattern)
    buffer.push(event)
    
    // 檢查是否達到批次大小或超時
    if (buffer.length >= this.batchSize) {
      await this.flushAggregation(pattern, aggregator)
    } else {
      this.scheduleFlush(pattern, aggregator)
    }
  }
  
  /**
   * 排程自動清空聚合緩衝區
   */
  scheduleFlush(pattern, aggregator) {
    if (this.timers.has(pattern)) return
    
    const timer = setTimeout(() => {
      this.flushAggregation(pattern, aggregator)
      this.timers.delete(pattern)
    }, this.batchTimeout)
    
    this.timers.set(pattern, timer)
  }
  
  /**
   * 清空聚合緩衝區並處理
   */
  async flushAggregation(pattern, aggregator) {
    const buffer = this.aggregationBuffer.get(pattern)
    if (!buffer || buffer.length === 0) return
    
    // 清空緩衝區
    this.aggregationBuffer.set(pattern, [])
    
    // 清除定時器
    if (this.timers.has(pattern)) {
      clearTimeout(this.timers.get(pattern))
      this.timers.delete(pattern)
    }
    
    // 執行聚合處理
    try {
      const aggregatedEvent = await aggregator(buffer)
      await this.eventBus.emit(aggregatedEvent.type, aggregatedEvent.data)
    } catch (error) {
      console.error(`Aggregation failed for pattern ${pattern}:`, error)
    }
  }
}

// 使用範例：聚合多平台提取進度
const aggregator = new EventAggregator(eventBus)

aggregator.aggregateEvents('EXTRACTION.*.EXTRACT.PROGRESS', async (events) => {
  const platformProgress = events.reduce((acc, event) => {
    const platform = event.type.split('.')[1]
    acc[platform] = event.data.progress
    return acc
  }, {})
  
  const totalProgress = Object.values(platformProgress).reduce((sum, p) => sum + p, 0) / 
                       Object.keys(platformProgress).length
  
  return {
    type: 'EXTRACTION.UNIFIED.EXTRACT.PROGRESS',
    data: {
      platformProgress,
      averageProgress: totalProgress,
      timestamp: Date.now()
    }
  }
})
```

## 🔒 事件安全和隔離機制

### 1. **平台資料隔離**

```javascript
class PlatformIsolationMiddleware {
  constructor(securityConfig) {
    this.isolationPolicies = securityConfig.isolation || {}
    this.crossPlatformAllowed = securityConfig.crossPlatformAllowed || []
  }
  
  async process(event) {
    const sourcePlatform = this.extractPlatform(event.type)
    const targetPlatform = event.data?.targetPlatform
    
    // 檢查跨平台操作權限
    if (targetPlatform && sourcePlatform !== targetPlatform) {
      if (!this.isCrossPlatformAllowed(sourcePlatform, targetPlatform)) {
        throw new SecurityError(
          `Cross-platform access denied: ${sourcePlatform} -> ${targetPlatform}`
        )
      }
    }
    
    // 清理敏感資料
    event.data = this.sanitizeData(event.data, sourcePlatform)
    
    return event
  }
  
  isCrossPlatformAllowed(source, target) {
    const key = `${source}->${target}`
    return this.crossPlatformAllowed.includes(key) || 
           this.crossPlatformAllowed.includes('*')
  }
  
  sanitizeData(data, platform) {
    const policy = this.isolationPolicies[platform] || {}
    const sanitized = { ...data }
    
    // 移除敏感欄位
    if (policy.removeFields) {
      policy.removeFields.forEach(field => {
        delete sanitized[field]
      })
    }
    
    // 加密敏感資料
    if (policy.encryptFields) {
      policy.encryptFields.forEach(field => {
        if (sanitized[field]) {
          sanitized[field] = this.encrypt(sanitized[field])
        }
      })
    }
    
    return sanitized
  }
}
```

### 2. **事件審計和監控**

```javascript
class EventAuditLogger {
  constructor(auditConfig) {
    this.auditLevel = auditConfig.level || 'INFO'
    this.sensitiveEvents = auditConfig.sensitiveEvents || []
    this.auditStorage = auditConfig.storage
  }
  
  async logEvent(event, context) {
    const auditEntry = {
      eventId: event.id,
      eventType: event.type,
      timestamp: event.timestamp,
      source: context.source,
      platform: this.extractPlatform(event.type),
      severity: this.calculateSeverity(event),
      dataFingerprint: this.createDataFingerprint(event.data),
      userContext: context.user,
      sessionId: context.sessionId
    }
    
    // 敏感事件記錄完整資料
    if (this.isSensitiveEvent(event.type)) {
      auditEntry.fullData = this.sanitizeForAudit(event.data)
      auditEntry.sensitive = true
    }
    
    await this.auditStorage.store(auditEntry)
    
    // 即時安全警報
    if (auditEntry.severity === 'CRITICAL') {
      await this.triggerSecurityAlert(auditEntry)
    }
  }
  
  isSensitiveEvent(eventType) {
    return this.sensitiveEvents.some(pattern => 
      new RegExp(pattern).test(eventType)
    )
  }
  
  calculateSeverity(event) {
    if (event.type.includes('SECURITY')) return 'CRITICAL'
    if (event.type.includes('ERROR') || event.type.includes('FAILED')) return 'HIGH'
    if (event.type.includes('DATA.SYNC')) return 'MEDIUM'
    return 'LOW'
  }
  
  createDataFingerprint(data) {
    // 建立資料指紋而不洩露實際內容
    return crypto.createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 16)
  }
}
```

## 📊 智能事件分析和優化

### 1. **事件效能監控**

```javascript
class EventPerformanceAnalyzer {
  constructor() {
    this.metrics = new Map()
    this.performanceThresholds = {
      warning: 1000,   // 1 秒
      critical: 5000   // 5 秒
    }
    this.analysisInterval = 60000 // 1 分鐘
  }
  
  async analyze() {
    const analysis = {
      slowEvents: this.identifySlowEvents(),
      highVolumeEvents: this.identifyHighVolumeEvents(),
      errorPrones: this.identifyErrorProneEvents(),
      recommendations: []
    }
    
    // 生成優化建議
    analysis.recommendations = this.generateRecommendations(analysis)
    
    return analysis
  }
  
  identifySlowEvents() {
    return Array.from(this.metrics.entries())
      .filter(([_, metric]) => metric.averageTime > this.performanceThresholds.warning)
      .map(([eventType, metric]) => ({
        eventType,
        averageTime: metric.averageTime,
        maxTime: metric.maxTime,
        count: metric.count
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
  }
  
  identifyHighVolumeEvents() {
    return Array.from(this.metrics.entries())
      .map(([eventType, metric]) => ({
        eventType,
        count: metric.count,
        frequency: metric.count / (Date.now() - metric.firstSeen)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }
  
  generateRecommendations(analysis) {
    const recommendations = []
    
    // 慢事件優化建議
    analysis.slowEvents.forEach(event => {
      if (event.eventType.includes('EXTRACTION')) {
        recommendations.push({
          type: 'optimization',
          priority: 'high',
          message: `Consider optimizing ${event.eventType} extraction logic`,
          suggestion: 'Use batch processing or async operations'
        })
      }
    })
    
    // 高頻事件聚合建議
    analysis.highVolumeEvents.forEach(event => {
      if (event.frequency > 100) { // 超過每秒100次
        recommendations.push({
          type: 'aggregation',
          priority: 'medium',
          message: `High frequency event ${event.eventType} should be aggregated`,
          suggestion: 'Implement event batching or debouncing'
        })
      }
    })
    
    return recommendations
  }
}
```

### 2. **自適應事件調節**

```javascript
class AdaptiveEventThrottler {
  constructor(eventBus) {
    this.eventBus = eventBus
    this.throttleConfigs = new Map()
    this.eventCounters = new Map()
    this.adaptationRules = []
  }
  
  /**
   * 註冊自適應節流規則
   */
  addAdaptationRule(eventPattern, rule) {
    this.adaptationRules.push({ pattern: eventPattern, rule })
  }
  
  /**
   * 處理事件節流
   */
  async processEvent(event) {
    const eventType = event.type
    const currentTime = Date.now()
    
    // 更新事件計數器
    this.updateEventCounter(eventType, currentTime)
    
    // 檢查是否需要節流
    if (this.shouldThrottle(eventType, currentTime)) {
      return null // 事件被節流丟棄
    }
    
    // 動態調整節流配置
    await this.adaptThrottling(eventType, currentTime)
    
    return event
  }
  
  /**
   * 動態調整節流策略
   */
  async adaptThrottling(eventType, currentTime) {
    const counter = this.eventCounters.get(eventType)
    if (!counter) return
    
    const recentRate = counter.count / Math.max(currentTime - counter.windowStart, 1)
    
    // 查找適用的自適應規則
    for (const { pattern, rule } of this.adaptationRules) {
      if (new RegExp(pattern).test(eventType)) {
        const newConfig = rule(recentRate, counter)
        if (newConfig) {
          this.throttleConfigs.set(eventType, newConfig)
          console.log(`Adapted throttling for ${eventType}:`, newConfig)
        }
      }
    }
  }
}

// 使用範例：設定自適應規則
const throttler = new AdaptiveEventThrottler(eventBus)

// 提取進度事件自適應節流
throttler.addAdaptationRule('EXTRACTION.*.EXTRACT.PROGRESS', (rate, counter) => {
  if (rate > 50) { // 每秒超過50次
    return { 
      maxPerSecond: 10,  // 限制為每秒10次
      burstSize: 5       // 突發大小5
    }
  } else if (rate > 20) {
    return {
      maxPerSecond: 20,
      burstSize: 10
    }
  }
  return null // 不調整
})
```

## 🚀 部署和遷移策略

### 1. **階段式事件系統升級**

```javascript
class EventSystemMigration {
  constructor(eventBus) {
    this.eventBus = eventBus
    this.migrationPhase = 'LEGACY' // LEGACY -> HYBRID -> MODERN
    this.legacySupport = true
  }
  
  /**
   * 開始遷移到 v2.0 事件系統
   */
  async migrate() {
    console.log('Starting event system migration to v2.0')
    
    // Phase 1: 啟用混合模式
    await this.enableHybridMode()
    
    // Phase 2: 遷移關鍵事件
    await this.migrateCriticalEvents()
    
    // Phase 3: 完全切換到現代事件系統
    await this.enableModernMode()
    
    console.log('Event system migration completed')
  }
  
  async enableHybridMode() {
    this.migrationPhase = 'HYBRID'
    
    // 註冊事件轉換器
    this.setupEventTranslators()
    
    // 啟用雙重事件發送
    this.enableDualEventEmission()
  }
  
  async migrateCriticalEvents() {
    const criticalEvents = [
      'EXTRACTION.COMPLETED',
      'STORAGE.SAVE.COMPLETED',
      'UI.POPUP.OPENED'
    ]
    
    for (const event of criticalEvents) {
      await this.migrateEvent(event)
    }
  }
  
  async migrateEvent(legacyEvent) {
    const modernEvent = EventNameBuilder.fromLegacy(legacyEvent)
    
    // 註冊現代事件監聽器
    this.eventBus.on(modernEvent, async (data) => {
      // 現代事件處理邏輯
      await this.handleModernEvent(modernEvent, data)
    })
    
    console.log(`Migrated ${legacyEvent} -> ${modernEvent}`)
  }
}
```

### 2. **向後相容性保證**

```javascript
class BackwardCompatibilityLayer {
  constructor(modernEventBus) {
    this.modernEventBus = modernEventBus
    this.legacyEventMap = new Map()
    this.setupLegacyEventMapping()
  }
  
  setupLegacyEventMapping() {
    // 建立舊版到新版的事件對應
    const mappings = [
      ['EXTRACTION.COMPLETED', 'EXTRACTION.READMOO.EXTRACT.COMPLETED'],
      ['EXTRACTION.PROGRESS', 'EXTRACTION.READMOO.EXTRACT.PROGRESS'],
      ['STORAGE.SAVE.COMPLETED', 'DATA.READMOO.SAVE.COMPLETED'],
      ['UI.POPUP.OPENED', 'UX.GENERIC.OPEN.COMPLETED']
    ]
    
    mappings.forEach(([legacy, modern]) => {
      this.legacyEventMap.set(legacy, modern)
      
      // 雙向支援：現代事件觸發時也觸發舊版事件
      this.modernEventBus.on(modern, async (data) => {
        await this.modernEventBus.emit(legacy, data)
      })
      
      // 舊版事件觸發時轉換為現代事件
      this.modernEventBus.on(legacy, async (data) => {
        await this.modernEventBus.emit(modern, data)
      })
    })
  }
  
  /**
   * 提供舊版 API 兼容介面
   */
  createLegacyAPI() {
    return {
      // 保持原有的方法簽名
      emitExtractionCompleted: async (data) => {
        return await this.modernEventBus.emit(
          'EXTRACTION.READMOO.EXTRACT.COMPLETED', 
          data
        )
      },
      
      onExtractionCompleted: (handler) => {
        this.modernEventBus.on('EXTRACTION.READMOO.EXTRACT.COMPLETED', handler)
        // 同時監聽舊版事件以確保相容性
        this.modernEventBus.on('EXTRACTION.COMPLETED', handler)
      }
    }
  }
}
```

## 📊 驗收標準和測試策略

### 1. **事件系統完整性測試**

```javascript
describe('Event System v2.0', () => {
  describe('Multi-platform Event Naming', () => {
    test('should build valid multi-platform events', () => {
      const event = EventNameBuilder.build(
        'EXTRACTION', 'KINDLE', 'EXTRACT', 'COMPLETED'
      )
      expect(event).toBe('EXTRACTION.KINDLE.EXTRACT.COMPLETED')
    })
    
    test('should convert legacy events correctly', () => {
      const modern = EventNameBuilder.fromLegacy('EXTRACTION.COMPLETED')
      expect(modern).toBe('EXTRACTION.READMOO.EXTRACT.COMPLETED')
    })
  })
  
  describe('Cross-platform Event Coordination', () => {
    test('should coordinate multi-platform extraction', async () => {
      const coordinator = new CrossPlatformEventCoordinator(eventBus, platformRegistry)
      
      const unifiedEvent = {
        type: 'EXTRACTION.UNIFIED.EXTRACT.STARTED',
        data: {
          platforms: ['READMOO', 'KINDLE'],
          options: { includeMetadata: true }
        }
      }
      
      await coordinator.handleUnifiedExtraction(unifiedEvent)
      
      // 驗證所有平台事件都被觸發
      expect(eventBus.hasBeenCalledWith('EXTRACTION.READMOO.EXTRACT.STARTED')).toBe(true)
      expect(eventBus.hasBeenCalledWith('EXTRACTION.KINDLE.EXTRACT.STARTED')).toBe(true)
      expect(eventBus.hasBeenCalledWith('EXTRACTION.UNIFIED.EXTRACT.COMPLETED')).toBe(true)
    })
  })
  
  describe('Event Security and Isolation', () => {
    test('should prevent unauthorized cross-platform access', async () => {
      const middleware = new PlatformIsolationMiddleware({
        crossPlatformAllowed: ['READMOO->KINDLE']
      })
      
      const unauthorizedEvent = {
        type: 'DATA.READMOO.SYNC.STARTED',
        data: { targetPlatform: 'KOBO' }
      }
      
      await expect(middleware.process(unauthorizedEvent))
        .rejects.toThrow('Cross-platform access denied')
    })
  })
})
```

### 2. **效能和擴展性測試**

```javascript
describe('Event System Performance', () => {
  test('should handle high-volume events efficiently', async () => {
    const startTime = Date.now()
    const eventCount = 10000
    
    const promises = Array.from({ length: eventCount }, (_, i) => 
      eventBus.emit('ANALYTICS.GENERIC.UPDATE.COMPLETED', { id: i })
    )
    
    await Promise.all(promises)
    
    const endTime = Date.now()
    const throughput = eventCount / (endTime - startTime) * 1000
    
    expect(throughput).toBeGreaterThan(1000) // 每秒1000+事件
  })
  
  test('should maintain memory usage under load', async () => {
    const initialMemory = process.memoryUsage().heapUsed
    
    // 觸發大量事件
    for (let i = 0; i < 50000; i++) {
      await eventBus.emit('TEST.MEMORY.LOAD', { data: 'x'.repeat(100) })
    }
    
    // 強制垃圾回收
    if (global.gc) global.gc()
    
    const finalMemory = process.memoryUsage().heapUsed
    const memoryIncrease = finalMemory - initialMemory
    
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // 少於50MB增長
  })
})
```

## 🎯 成功指標

### **技術指標**
- [ ] 支援 5 個平台的事件命名 100%
- [ ] 跨平台事件路由延遲 < 50ms 
- [ ] 事件系統記憶體佔用增長 < 20%
- [ ] 向後相容性測試通過率 100%
- [ ] 事件處理吞吐量 > 5000 events/sec

### **功能指標**
- [ ] 多平台事件協調成功率 > 99%
- [ ] 資料隔離和安全檢查 100% 有效
- [ ] 事件聚合和批量處理減少 80% 網路開銷
- [ ] 自適應節流降低 60% CPU 使用率

### **開發者體驗**
- [ ] 事件 API 學習曲線 < 2 小時
- [ ] 除錯和監控工具完整性 100%
- [ ] 文件和範例覆蓋率 > 95%

---

**維護者**: Claude Code 事件驅動架構專家  
**審核週期**: 每兩週檢視架構演進和最佳實踐更新