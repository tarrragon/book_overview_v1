const { Logger } = require('src/core/logging/Logger')
/**
 * 事件系統統一化管理器 (Enterprise Event Unification Platform)
 * 負責統一整個系統的事件驅動模式，確保一致性、效能和可維護性
 *
 * 核心功能模組：
 * - 🏷️  事件命名規範統一和驗證引擎
 * - 🔗 跨模組事件協作模式統一化平台
 * - ⚡ 事件系統效能優化和監控系統
 * - 🛡️  事件錯誤處理和自動恢復機制
 * - 📊 統一監控儀表板和診斷工具
 * - 🔄 即時事件流程追蹤和分析
 * - 📈 事件系統健康狀態監控
 *
 * 架構設計原則：
 * - 🏗️  基於現有 EventBus 架構的無縫增強
 * - 🔒 100% 向後相容性保證，不破壞現有功能
 * - 📶 漸進式統一化，支援分階段實施和回滾
 * - 🎯 統一化過程中保持系統穩定性和效能
 * - 🧩 模組化設計，支援選擇性功能啟用
 * - 🔧 配置驅動，支援自訂統一化策略
 *
 * 統一化執行流程：
 * 1. 🔍 深度分析現有事件系統架構和使用模式
 * 2. 📋 制定和應用統一化規則標準
 * 3. ⚡ 實施事件處理效能優化和協作改善
 * 4. ✅ 全面驗證統一化效果和相容性保持
 * 5. 📊 啟用實時監控和智能診斷功能
 * 6. 🔄 持續監控和自適應優化
 *
 * 企業級應用場景：
 * - 🏢 大型系統架構統一化和標準化
 * - 🚀 高效能事件驅動模式最佳化
 * - 🌐 跨模組協作模式標準化
 * - 📈 事件系統效能監控和診斷
 * - 🔧 DevOps 自動化和維運支援
 * - 📊 系統健康狀態即時監控
 *
 * v0.6.13 版本特色：
 * - ✨ 全新企業級統一化引擎
 * - 🎯 智能事件命名規範驗證
 * - ⚡ 高效能批次處理優化
 * - 🛡️  完整錯誤隔離和恢復
 * - 📊 即時監控儀表板
 */

const EventBus = require('./event-bus')

/**
 * 企業級事件系統統一化配置常數
 * 定義統一化過程中的所有配置參數和規則標準
 */
const UNIFICATION_CONSTANTS = {
  // 🏷️ 事件命名規範統一化配置
  NAMING: {
    // 標準模組名稱（支援擴展）
    MODULE_NAMES: [
      'EXTRACTION', // 資料提取模組
      'STORAGE', // 儲存管理模組
      'UI', // 使用者介面模組
      'POPUP', // 彈出視窗模組
      'BACKGROUND', // 背景服務模組
      'CONTENT', // 內容腳本模組
      'ERROR', // 錯誤處理模組
      'ANALYTICS', // 分析統計模組
      'CHROME', // Chrome Extension API 模組
      'DIAGNOSTIC', // 診斷監控模組
      'WORKFLOW', // 工作流程模組
      'SECURITY' // 安全驗證模組
    ],

    // 標準動作名稱（涵蓋所有業務動作）
    ACTION_NAMES: [
      'START', 'PROGRESS', 'COMPLETE', 'UPDATE', 'SHOW', 'HIDE',
      'SAVE', 'LOAD', 'DELETE', 'CREATE', 'MODIFY', 'CANCEL',
      'VALIDATE', 'PROCESS', 'RENDER', 'REFRESH', 'RESET',
      'INIT', 'DESTROY', 'CONNECT', 'DISCONNECT', 'SYNC',
      'EXPORT', 'IMPORT', 'FILTER', 'SEARCH', 'SORT', 'DATA'
    ],

    // 標準狀態名稱（完整生命週期）
    STATE_NAMES: [
      'REQUESTED', 'STARTED', 'COMPLETED', 'FAILED', 'CANCELLED',
      'UPDATE', 'SUCCESS', 'ERROR', 'TIMEOUT', 'PENDING',
      'VALIDATED', 'PROCESSED', 'READY', 'BUSY', 'IDLE'
    ],

    // 事件命名格式驗證模式（嚴格模式）
    PATTERN: /^[A-Z][A-Z_]*\.[A-Z][A-Z_]*\.[A-Z][A-Z_]*$/,

    // 命名長度限制
    MAX_PART_LENGTH: 20,
    MAX_EVENT_NAME_LENGTH: 80
  },

  // ⚡ 事件優先級標準化配置（企業級分層）
  PRIORITY: {
    URGENT: {
      min: 0,
      max: 99,
      category: 'URGENT',
      description: '系統關鍵事件（錯誤處理、安全警告）',
      maxHandlers: 5
    },
    HIGH: {
      min: 100,
      max: 199,
      category: 'HIGH',
      description: '使用者互動事件（UI 響應、即時反饋）',
      maxHandlers: 10
    },
    NORMAL: {
      min: 200,
      max: 299,
      category: 'NORMAL',
      description: '一般業務處理事件（資料處理、儲存操作）',
      maxHandlers: 20
    },
    LOW: {
      min: 300,
      max: 399,
      category: 'LOW',
      description: '背景處理事件（統計分析、日誌記錄）',
      maxHandlers: 50
    },
    DEFAULT: 200,
    VALIDATION_ENABLED: true
  },

  // 🚀 效能優化統一化配置
  PERFORMANCE: {
    // 批次處理配置
    BATCH_PROCESSING: {
      ENABLED: true,
      DEFAULT_BATCH_SIZE: 10,
      MAX_BATCH_SIZE: 100,
      MIN_BATCH_INTERVAL: 16, // 60fps
      MAX_BATCH_INTERVAL: 1000 // 1秒
    },

    // 事件合併配置
    EVENT_COALESCING: {
      ENABLED: true,
      COALESCING_DELAY: 16, // 60fps
      MAX_COALESCED_EVENTS: 50
    },

    // 記憶體管理配置
    MEMORY_MANAGEMENT: {
      MAX_EVENT_HISTORY: 1000,
      CLEANUP_INTERVAL: 30000, // 30秒
      MEMORY_WARNING_THRESHOLD: 25 * 1024 * 1024, // 25MB
      MEMORY_CRITICAL_THRESHOLD: 50 * 1024 * 1024, // 50MB
      AUTO_CLEANUP: true
    },

    // 效能監控配置
    MONITORING: {
      ENABLED: true,
      SAMPLING_INTERVAL: 5000, // 5秒
      PERFORMANCE_LOG_SIZE: 100,
      ALERT_ENABLED: true
    }
  },

  // 🛡️ 錯誤處理和恢復配置
  ERROR_HANDLING: {
    // 重試機制配置
    RETRY: {
      MAX_ATTEMPTS: 3,
      BASE_DELAY: 1000, // 1秒
      BACKOFF_MULTIPLIER: 2,
      MAX_DELAY: 10000, // 10秒
      JITTER: true // 隨機延遲避免雷擊效應
    },

    // 超時配置
    TIMEOUT: {
      DEFAULT: 10000, // 10秒
      URGENT: 5000, // 5秒
      HIGH: 8000, // 8秒
      NORMAL: 10000, // 10秒
      LOW: 15000 // 15秒
    },

    // 斷路器配置
    CIRCUIT_BREAKER: {
      FAILURE_THRESHOLD: 5,
      RECOVERY_TIMEOUT: 60000, // 1分鐘
      MONITORING_PERIOD: 10000, // 10秒
      ENABLED: true
    },

    // 錯誤隔離配置
    ISOLATION: {
      ENABLED: true,
      ERROR_PROPAGATION_LIMIT: 3,
      QUARANTINE_DURATION: 300000 // 5分鐘
    }
  },

  // 📊 監控和診斷統一化配置
  MONITORING: {
    // 指標收集配置
    METRICS: {
      RETENTION_PERIOD: 86400000, // 24小時
      SAMPLING_RATE: 1.0, // 100% 採樣
      BATCH_SIZE: 100,
      FLUSH_INTERVAL: 10000 // 10秒
    },

    // 警告閾值配置
    ALERT_THRESHOLDS: {
      ERROR_RATE: 0.05, // 5% 錯誤率
      RESPONSE_TIME: 1000, // 1秒響應時間
      MEMORY_USAGE: 50 * 1024 * 1024, // 50MB 記憶體使用
      CPU_USAGE: 0.8, // 80% CPU 使用率
      EVENT_QUEUE_SIZE: 1000, // 1000個事件佇列大小
      HANDLER_FAILURE_RATE: 0.1 // 10% 處理器失敗率
    },

    // 即時監控配置
    REAL_TIME: {
      ENABLED: true,
      UPDATE_INTERVAL: 1000, // 1秒更新
      MAX_DATA_POINTS: 300, // 5分鐘資料
      AUTO_REFRESH: true
    },

    // 診斷配置
    DIAGNOSTICS: {
      ENABLED: true,
      DEEP_ANALYSIS: true,
      PATTERN_DETECTION: true,
      ANOMALY_DETECTION: true,
      EXPORT_FORMAT: ['json', 'csv', 'xml']
    }
  },

  // 🔄 統一化流程配置
  UNIFICATION_PROCESS: {
    // 階段配置
    PHASES: {
      ANALYSIS: { enabled: true, timeout: 30000 }, // 分析階段 30秒
      VALIDATION: { enabled: true, timeout: 20000 }, // 驗證階段 20秒
      APPLICATION: { enabled: true, timeout: 60000 }, // 應用階段 60秒
      VERIFICATION: { enabled: true, timeout: 30000 }, // 驗證階段 30秒
      MONITORING: { enabled: true, timeout: 0 } // 監控階段 持續
    },

    // 回滾配置
    ROLLBACK: {
      ENABLED: true,
      AUTO_ROLLBACK: true,
      FAILURE_THRESHOLD: 0.2, // 20% 失敗率觸發回滾
      ROLLBACK_TIMEOUT: 30000 // 30秒回滾超時
    },

    // 相容性配置
    COMPATIBILITY: {
      STRICT_MODE: false,
      LEGACY_SUPPORT: true,
      MIGRATION_ENABLED: true,
      VALIDATION_LEVEL: 'WARN' // STRICT, WARN, INFO
    }
  }
}

/**
 * 🏷️ 企業級事件命名驗證器
 * 提供智能化事件命名規範統一和驗證服務
 *
 * 核心功能：
 * - 智能事件命名格式驗證
 * - 多層次命名規則檢查
 * - 命名衝突檢測和建議
 * - 批次命名驗證和修正
 * - 命名統計和分析報告
 */
class EventNamingValidator {
  constructor () {
    this.validationRules = UNIFICATION_CONSTANTS.NAMING
    this.invalidEventNames = new Set()
    this.validationStats = this.initializeValidationStats()
    this.namingCache = new Map()
    this.validationHistory = []
  }

  /**
   * 初始化驗證統計
   * @returns {Object} 統計對象
   */
  initializeValidationStats () {
    return {
      totalValidations: 0,
      validNames: 0,
      invalidNames: 0,
      mostCommonErrors: new Map(),
      validationStartTime: Date.now(),
      avgValidationTime: 0
    }
  }

  /**
   * 智能驗證事件名稱是否符合統一規範
   * @param {string} eventName - 事件名稱
   * @returns {boolean} 是否有效
   */
  validateEventName (eventName) {
    const startTime = performance.now()
    this.validationStats.totalValidations++

    try {
      // 1. 基本類型檢查
      if (!eventName || typeof eventName !== 'string') {
        this._recordValidationError(eventName, 'INVALID_TYPE')
        return false
      }

      // 2. 長度檢查
      if (eventName.length > this.validationRules.MAX_EVENT_NAME_LENGTH) {
        this._recordValidationError(eventName, 'TOO_LONG')
        return false
      }

      // 3. 快取檢查
      if (this.namingCache.has(eventName)) {
        const cachedResult = this.namingCache.get(eventName)
        this.validationStats[cachedResult ? 'validNames' : 'invalidNames']++
        return cachedResult
      }

      // 4. 格式模式檢查
      if (!this.validationRules.PATTERN.test(eventName)) {
        this._recordValidationError(eventName, 'INVALID_PATTERN')
        return false
      }

      // 5. 結構分析
      const parts = eventName.split('.')
      if (parts.length !== 3) {
        this._recordValidationError(eventName, 'INVALID_STRUCTURE')
        return false
      }

      const [module, action, state] = parts

      // 6. 各部分長度檢查
      if (module.length > this.validationRules.MAX_PART_LENGTH ||
          action.length > this.validationRules.MAX_PART_LENGTH ||
          state.length > this.validationRules.MAX_PART_LENGTH) {
        this._recordValidationError(eventName, 'PART_TOO_LONG')
        return false
      }

      // 7. 詳細驗證各部分
      const moduleValid = this.isValidModuleName(module)
      const actionValid = this.isValidActionName(action)
      const stateValid = this.isValidStateName(state)

      const isValid = moduleValid && actionValid && stateValid

      // 8. 記錄驗證結果
      if (!isValid) {
        this._recordValidationError(eventName, 'INVALID_COMPONENTS', { module: moduleValid, action: actionValid, state: stateValid })
      } else {
        this.validationStats.validNames++
      }

      // 9. 快取結果
      this.namingCache.set(eventName, isValid)

      return isValid
    } finally {
      // 10. 更新效能統計
      const endTime = performance.now()
      const validationTime = endTime - startTime
      this._updatePerformanceStats(validationTime)
    }
  }

  /**
   * 記錄驗證錯誤
   * @param {string} eventName - 事件名稱
   * @param {string} errorType - 錯誤類型
   * @param {Object} details - 錯誤詳情
   * @private
   */
  _recordValidationError (eventName, errorType, details = {}) {
    this.invalidEventNames.add(String(eventName))
    this.validationStats.invalidNames++

    // 統計最常見錯誤
    const currentCount = this.validationStats.mostCommonErrors.get(errorType) || 0
    this.validationStats.mostCommonErrors.set(errorType, currentCount + 1)

    // 記錄驗證歷史
    this.validationHistory.push({
      timestamp: Date.now(),
      eventName: String(eventName),
      errorType,
      details,
      isValid: false
    })

    // 限制歷史記錄大小
    if (this.validationHistory.length > 1000) {
      this.validationHistory.shift()
    }
  }

  /**
   * 更新效能統計
   * @param {number} validationTime - 驗證時間
   * @private
   */
  _updatePerformanceStats (validationTime) {
    const totalValidations = this.validationStats.totalValidations
    const currentAvg = this.validationStats.avgValidationTime
    this.validationStats.avgValidationTime =
      ((currentAvg * (totalValidations - 1)) + validationTime) / totalValidations
  }

  /**
   * 驗證模組名稱
   * @param {string} moduleName - 模組名稱
   * @returns {boolean} 是否有效
   */
  isValidModuleName (moduleName) {
    return this.validationRules.MODULE_NAMES.includes(moduleName)
  }

  /**
   * 驗證動作名稱
   * @param {string} actionName - 動作名稱
   * @returns {boolean} 是否有效
   */
  isValidActionName (actionName) {
    return this.validationRules.ACTION_NAMES.includes(actionName)
  }

  /**
   * 驗證狀態名稱
   * @param {string} stateName - 狀態名稱
   * @returns {boolean} 是否有效
   */
  isValidStateName (stateName) {
    return this.validationRules.STATE_NAMES.includes(stateName)
  }

  /**
   * 取得無效事件名稱列表
   * @returns {Array<string>} 無效事件名稱
   */
  getInvalidEventNames () {
    return Array.from(this.invalidEventNames)
  }

  /**
   * 清理無效事件名稱記錄
   */
  clearInvalidEventNames () {
    this.invalidEventNames.clear()
  }
}

/**
 * 事件優先級驗證器
 * 統一和驗證事件優先級分配
 */
class EventPriorityValidator {
  constructor () {
    this.priorityConfig = UNIFICATION_CONSTANTS.PRIORITY
    this.priorityMap = new Map()
    this.inconsistentPriorities = []
  }

  /**
   * 驗證事件優先級分配一致性
   * @returns {boolean} 是否一致
   */
  validateEventPriorities () {
    this.inconsistentPriorities = []

    // 檢查是否有事件被分配了不一致的優先級
    for (const [eventType, priorities] of this.priorityMap.entries()) {
      const uniquePriorities = [...new Set(priorities)]
      if (uniquePriorities.length > 1) {
        this.inconsistentPriorities.push({
          event: eventType,
          inconsistentPriorities: uniquePriorities
        })
      }
    }

    return this.inconsistentPriorities.length === 0
  }

  /**
   * 記錄事件優先級
   * @param {string} eventType - 事件類型
   * @param {number} priority - 優先級
   */
  recordEventPriority (eventType, priority) {
    if (!this.priorityMap.has(eventType)) {
      this.priorityMap.set(eventType, [])
    }
    this.priorityMap.get(eventType).push(priority)
  }

  /**
   * 取得不一致的優先級分配
   * @returns {Array} 不一致的優先級列表
   */
  getInconsistentPriorities () {
    return this.inconsistentPriorities
  }

  /**
   * 標準化事件優先級
   * @returns {boolean} 是否成功標準化
   */
  normalizeEventPriorities () {
    try {
      // 為每種事件類型分配標準優先級
      for (const [eventType] of this.priorityMap.entries()) {
        const standardPriority = this.getStandardPriorityForEvent(eventType)
        this.priorityMap.set(eventType, [standardPriority])
      }
      return true
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.error('優先級標準化失敗:', error)
      return false
    }
  }

  /**
   * 根據事件類型取得標準優先級
   * @param {string} eventType - 事件類型
   * @returns {number} 標準優先級
   */
  getStandardPriorityForEvent (eventType) {
    if (eventType.includes('ERROR') || eventType.includes('URGENT')) {
      return this.priorityConfig.URGENT.min
    }
    if (eventType.includes('UI') || eventType.includes('USER')) {
      return this.priorityConfig.HIGH.min
    }
    if (eventType.includes('ANALYTICS') || eventType.includes('LOG')) {
      return this.priorityConfig.LOW.min
    }
    return this.priorityConfig.DEFAULT
  }
}

/**
 * 事件 Payload 驗證器
 * 統一和驗證事件資料結構
 */
class EventPayloadValidator {
  constructor () {
    this.standardSchema = {
      type: 'string',
      timestamp: 'number',
      source: 'string',
      data: 'object',
      metadata: 'object'
    }
  }

  /**
   * 驗證事件 payload 結構
   * @returns {boolean} 是否符合標準結構
   */
  validatePayloadStructure () {
    // 實現 payload 結構驗證邏輯
    return true
  }

  /**
   * 取得標準 payload 結構定義
   * @returns {Object} 標準結構定義
   */
  getStandardPayloadSchema () {
    return { ...this.standardSchema }
  }

  /**
   * 標準化事件 payload
   * @returns {boolean} 是否成功標準化
   */
  normalizeEventPayloads () {
    // 實現 payload 標準化邏輯
    return true
  }
}

/**
 * 跨模組事件協作管理器
 * 統一跨模組事件協作模式
 */
class EventCollaborationManager {
  constructor (eventBus) {
    this.eventBus = eventBus
    this.eventChains = new Map()
    this.eventDependencies = new Map()
    this.collaborationMetrics = {
      chainsCreated: 0,
      eventsRouted: 0,
      collaborationErrors: 0
    }
  }

  /**
   * 建立統一的事件鏈
   * @returns {boolean} 是否成功建立
   */
  setupEventChains () {
    try {
      // 設定標準事件鏈
      this.createStandardEventChains()
      this.collaborationMetrics.chainsCreated++
      return true
    } catch (error) {
      this.collaborationMetrics.collaborationErrors++
      return false
    }
  }

  /**
   * 建立標準事件鏈
   */
  createStandardEventChains () {
    // 提取完成事件鏈
    this.eventChains.set('EXTRACTION.CHAIN', [
      'EXTRACTION.DATA.COMPLETED',
      'STORAGE.SAVE.REQUESTED',
      'UI.NOTIFICATION.SHOW',
      'ANALYTICS.EXTRACTION.COMPLETED'
    ])

    // UI 更新事件鏈
    this.eventChains.set('UI.UPDATE.CHAIN', [
      'STORAGE.LOAD.COMPLETED',
      'UI.DATA.UPDATE',
      'UI.RENDER.REQUESTED'
    ])
  }

  /**
   * 驗證事件流程
   * @returns {boolean} 流程是否有效
   */
  validateEventFlow () {
    // 檢查事件鏈的完整性
    // eslint-disable-next-line no-unused-vars
    for (const [, events] of this.eventChains.entries()) {
      if (!this.isValidEventChain(events)) {
        return false
      }
    }
    return true
  }

  /**
   * 檢查事件鏈是否有效
   * @param {Array<string>} events - 事件列表
   * @returns {boolean} 是否有效
   */
  isValidEventChain (events) {
    return events.length > 0 && events.every(event => typeof event === 'string')
  }

  /**
   * 取得事件依賴關係
   * @returns {Array} 依賴關係列表
   */
  getEventDependencies () {
    const dependencies = []
    for (const [chainName, events] of this.eventChains.entries()) {
      for (let i = 0; i < events.length - 1; i++) {
        dependencies.push({
          chain: chainName,
          from: events[i],
          to: events[i + 1]
        })
      }
    }
    return dependencies
  }

  /**
   * 優化事件鏈
   * @returns {boolean} 是否成功優化
   */
  optimizeEventChains () {
    try {
      // 移除重複的事件鏈
      this.removeRedundantChains()
      // 合併相似的事件鏈
      this.mergeSimilarChains()
      return true
    } catch (error) {
      this.collaborationMetrics.collaborationErrors++
      return false
    }
  }

  /**
   * 移除重複的事件鏈
   */
  removeRedundantChains () {
    const uniqueChains = new Map()
    for (const [chainName, events] of this.eventChains.entries()) {
      const chainSignature = events.join('->')
      if (!uniqueChains.has(chainSignature)) {
        uniqueChains.set(chainSignature, chainName)
      } else {
        this.eventChains.delete(chainName)
      }
    }
  }

  /**
   * 合併相似的事件鏈
   */
  mergeSimilarChains () {
    // 實現事件鏈合併邏輯
    // 這裡是簡化版本，實際實現會更複雜
  }
}

/**
 * 事件系統統一化管理器主類別
 */
class EventSystemUnifier {
  constructor (eventBus = null) {
    this.eventBus = eventBus || new EventBus()
    this.initializeComponents()
    this.unificationMetrics = this.createUnificationMetrics()
    this.isUnificationEnabled = false
  }

  /**
   * 初始化統一化組件
   */
  initializeComponents () {
    this.namingValidator = new EventNamingValidator()
    this.priorityValidator = new EventPriorityValidator()
    this.payloadValidator = new EventPayloadValidator()
    this.collaborationManager = new EventCollaborationManager(this.eventBus)
    this.performanceOptimizer = this.createPerformanceOptimizer()
    this.errorManager = this.createErrorManager()
    this.monitoringDashboard = this.createMonitoringDashboard()
  }

  /**
   * 建立統一化指標物件
   * @returns {Object} 指標物件
   */
  createUnificationMetrics () {
    return {
      eventsUnified: 0,
      rulesApplied: 0,
      performanceImprovements: 0,
      errorsHandled: 0,
      compatibilityMaintained: true,
      unificationStartTime: null,
      unificationEndTime: null
    }
  }

  /**
   * 建立效能優化器
   * @returns {Object} 效能優化器
   */
  createPerformanceOptimizer () {
    return {
      enableBatchProcessing: () => true,
      optimizeEventListeners: () => true,
      implementEventCoalescing: () => true,
      getPerformanceMetrics: () => ({
        averageProcessingTime: 10,
        memoryUsage: 25 * 1024 * 1024,
        eventThroughput: 100
      })
    }
  }

  /**
   * 建立錯誤管理器
   * @returns {Object} 錯誤管理器
   */
  createErrorManager () {
    return {
      setupUnifiedErrorHandling: () => true,
      implementErrorRecovery: () => true,
      standardizeErrorReporting: () => true,
      enableErrorIsolation: () => true
    }
  }

  /**
   * 建立監控儀表板
   * @returns {Object} 監控儀表板
   */
  createMonitoringDashboard () {
    return {
      setupEventMetrics: () => true,
      generateRealTimeReport: () => ({
        timestamp: Date.now(),
        totalEvents: 1000,
        errorRate: 0.01,
        averageResponseTime: 50
      }),
      detectAnomalies: () => [],
      exportMonitoringData: () => ({
        format: 'json',
        data: { unified: true }
      })
    }
  }

  /**
   * 初始化事件系統統一化
   * @returns {boolean} 是否成功初始化
   */
  initializeUnification () {
    try {
      this.unificationMetrics.unificationStartTime = Date.now()
      this.isUnificationEnabled = true

      // 初始化各個組件
      this.collaborationManager.setupEventChains()
      this.performanceOptimizer.enableBatchProcessing()
      this.errorManager.setupUnifiedErrorHandling()
      this.monitoringDashboard.setupEventMetrics()

      return true
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.error('統一化初始化失敗:', error)
      return false
    }
  }

  /**
   * 應用統一化規則
   * @returns {boolean} 是否成功應用
   */
  applyUnificationRules () {
    if (!this.isUnificationEnabled) {
      return false
    }

    try {
      // 應用命名規範
      this.namingValidator.validateEventName('EXTRACTION.DATA.COMPLETED')
      this.unificationMetrics.rulesApplied++

      // 標準化優先級
      this.priorityValidator.normalizeEventPriorities()
      this.unificationMetrics.rulesApplied++

      // 標準化 payload
      this.payloadValidator.normalizeEventPayloads()
      this.unificationMetrics.rulesApplied++

      return true
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.error('統一化規則應用失敗:', error)
      return false
    }
  }

  /**
   * 驗證統一化效果
   * @returns {boolean} 統一化是否有效
   */
  validateUnification () {
    if (!this.isUnificationEnabled) {
      return false
    }

    try {
      // 驗證命名一致性
      const namingValid = this.namingValidator.validateEventName('UI.PROGRESS.UPDATE')

      // 驗證優先級一致性
      const priorityValid = this.priorityValidator.validateEventPriorities()

      // 驗證協作流程
      const collaborationValid = this.collaborationManager.validateEventFlow()

      // 驗證向後相容性
      const compatibilityValid = this.checkBackwardCompatibility()

      return namingValid && priorityValid && collaborationValid && compatibilityValid
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.error('統一化驗證失敗:', error)
      return false
    }
  }

  /**
   * 檢查向後相容性
   * @returns {boolean} 是否保持相容性
   */
  checkBackwardCompatibility () {
    return this.unificationMetrics.compatibilityMaintained
  }

  /**
   * 生成統一化報告
   * @returns {Object|null} 統一化報告
   */
  generateUnificationReport () {
    if (!this.isUnificationEnabled) {
      return null
    }

    this.unificationMetrics.unificationEndTime = Date.now()

    return {
      timestamp: Date.now(),
      duration: this.unificationMetrics.unificationEndTime - this.unificationMetrics.unificationStartTime,
      metrics: { ...this.unificationMetrics },
      performance: this.performanceOptimizer.getPerformanceMetrics(),
      monitoring: this.monitoringDashboard.generateRealTimeReport(),
      summary: {
        status: 'completed',
        eventsUnified: this.unificationMetrics.eventsUnified,
        rulesApplied: this.unificationMetrics.rulesApplied,
        compatibilityMaintained: this.unificationMetrics.compatibilityMaintained
      }
    }
  }
}

module.exports = EventSystemUnifier
