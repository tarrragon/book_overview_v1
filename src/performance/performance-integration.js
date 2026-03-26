const { Logger } = require('src/core/logging/Logger')
/**
 * @fileoverview PerformanceIntegration - 效能優化整合系統
 * TDD 循環 #35: 將效能優化整合到現有 Extension 架構
 *
 * 核心功能：
 * - 🔧 整合效能優化到現有模組
 * - ⚡ 自動啟動效能監控和優化
 * - 📊 提供統一的效能管理介面
 * - 🎯 針對不同模組的特定優化策略
 * - 🚀 Chrome Extension 環境最佳化
 *
 * 設計特點：
 * - 非侵入性的效能監控整合
 * - 與現有事件系統無縫配合
 * - 可配置的優化策略和閾值
 * - 實時效能反饋和警告機制
 *
 * @author TDD Development Team
 * @since 2025-08-09
 * @version 1.0.0
 */

const { getPerformanceOptimizer } = require('./performance-optimizer')
const { getLoadingOptimizer } = require('./loading-optimizer')

/**
 * PerformanceIntegration 類別
 *
 * 負責功能：
 * - 整合效能優化到 Extension 各個組件
 * - 統一管理效能監控和優化策略
 * - 提供效能相關的事件和 API
 * - 協調不同模組間的效能最佳化
 *
 * 設計考量：
 * - 與現有架構的無縫整合
 * - 最小化對現有程式碼的影響
 * - 提供靈活的配置和控制選項
 * - 確保效能優化不影響功能正確性
 *
 * 處理流程：
 * 1. 初始化效能監控系統
 * 2. 整合載入速度優化
 * 3. 設定記憶體管理策略
 * 4. 啟動實時效能監控
 * 5. 提供效能報告和建議
 *
 * 使用情境：
 * - Extension 啟動時自動初始化效能系統
 * - 各模組載入時的效能優化
 * - 長期運行時的效能監控和維護
 * - 效能問題的診斷和修復
 */
class PerformanceIntegration {
  /**
   * 整合配置常數
   */
  static get CONFIG () {
    return {
      MODULES: {
        BACKGROUND: 'background',
        POPUP: 'popup',
        CONTENT: 'content',
        OVERVIEW: 'overview'
      },
      OPTIMIZATION_LEVELS: {
        DISABLED: 'disabled',
        BASIC: 'basic',
        STANDARD: 'standard',
        AGGRESSIVE: 'aggressive'
      },
      MONITORING_MODES: {
        DEVELOPMENT: 'development',
        PRODUCTION: 'production',
        DEBUG: 'debug'
      }
    }
  }

  /**
   * 建構函數
   *
   * @param {Object} eventBus - 事件總線實例
   * @param {Object} options - 整合配置選項
   */
  constructor (eventBus, options = {}) {
    this.eventBus = eventBus
    this.config = {
      optimizationLevel: PerformanceIntegration.CONFIG.OPTIMIZATION_LEVELS.STANDARD,
      monitoringMode: PerformanceIntegration.CONFIG.MONITORING_MODES.PRODUCTION,
      enableAutoOptimization: true,
      enablePerformanceWarnings: true,
      moduleSpecificConfig: {},
      ...options
    }

    // 初始化整合狀態
    this.initializeIntegration()

    // 建立效能優化器實例
    this.createOptimizers()

    // 設定事件監聽
    this.setupEventListeners()

    // 註冊效能 API
    this.registerPerformanceAPI()
  }

  /**
   * 初始化整合系統
   * @private
   */
  initializeIntegration () {
    this.integrationState = {
      initialized: false,
      activeModules: new Set(),
      optimizationHistory: [],
      performanceWarnings: [],
      lastHealthCheck: null
    }

    this.modulePerformance = new Map()
    this.optimizationTasks = new Map()
    this.performanceListeners = new Set()
  }

  /**
   * 建立效能優化器實例
   * @private
   */
  createOptimizers () {
    // 建立效能監控優化器
    this.performanceOptimizer = getPerformanceOptimizer({
      MONITORING: {
        SAMPLE_INTERVAL: this.config.monitoringMode === 'debug' ? 1000 : 5000
      }
    })

    // 建立載入優化器
    const loadingMode = this.getLoadingOptimizationMode()
    this.loadingOptimizer = getLoadingOptimizer({
      mode: loadingMode,
      enablePreloading: this.config.optimizationLevel !== 'basic',
      enableLazyLoading: true,
      enableCodeSplitting: this.config.optimizationLevel === 'aggressive'
    })
  }

  /**
   * 獲取載入優化模式
   * @returns {string} 優化模式
   * @private
   */
  getLoadingOptimizationMode () {
    switch (this.config.optimizationLevel) {
      case PerformanceIntegration.CONFIG.OPTIMIZATION_LEVELS.AGGRESSIVE:
        return 'fast_startup'
      case PerformanceIntegration.CONFIG.OPTIMIZATION_LEVELS.BASIC:
        return 'low_memory'
      default:
        return 'balanced'
    }
  }

  /**
   * 設定事件監聽
   * @private
   */
  setupEventListeners () {
    if (!this.eventBus) return

    // 監聽模組初始化事件
    this.eventBus.on('MODULE.INITIALIZED', this.handleModuleInitialized.bind(this))

    // 監聽效能警告事件
    this.eventBus.on('PERFORMANCE.WARNING', this.handlePerformanceWarning.bind(this))

    // 監聽載入完成事件
    this.eventBus.on('LOADING.COMPLETED', this.handleLoadingCompleted.bind(this))

    // 監聽錯誤事件，可能影響效能
    this.eventBus.on('ERROR.OCCURRED', this.handleErrorOccurred.bind(this))
  }

  /**
   * 註冊效能 API
   * @private
   */
  registerPerformanceAPI () {
    // 將效能 API 掛載到全域（如果在瀏覽器環境）
    if (typeof window !== 'undefined') {
      window.ExtensionPerformance = {
        getReport: this.getPerformanceReport.bind(this),
        optimize: this.optimizeNow.bind(this),
        configure: this.configure.bind(this),
        getRecommendations: this.getOptimizationRecommendations.bind(this)
      }
    }

    // 註冊到 Chrome Extension API（如果可用）
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'PERFORMANCE_API') {
          this.handlePerformanceAPIRequest(request, sendResponse)
          return true // 保持消息通道開放
        }
      })
    }
  }

  /**
   * 啟動整合效能系統
   * @returns {Promise<Object>} 啟動結果
   */
  async startPerformanceSystem () {
    const startTime = Date.now()

    try {
      // 1. 啟動載入優化
      const loadingResult = await this.loadingOptimizer.startOptimizedLoading()

      // 2. 開始效能監控
      this.performanceOptimizer.startPerformanceMonitoring()

      // 3. 設定自動優化任務
      if (this.config.enableAutoOptimization) {
        this.scheduleAutoOptimization()
      }

      // 4. 執行初始健康檢查
      await this.performHealthCheck()

      const endTime = Date.now()
      const initTime = endTime - startTime

      this.integrationState.initialized = true

      const result = {
        success: true,
        initializationTime: initTime,
        loadingResult,
        optimizationLevel: this.config.optimizationLevel,
        monitoringMode: this.config.monitoringMode
      }

      // 發出初始化完成事件
      this.emitPerformanceEvent('PERFORMANCE.SYSTEM.INITIALIZED', result)

      return result
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.error('效能系統啟動失敗', { error })

      this.emitPerformanceEvent('PERFORMANCE.SYSTEM.FAILED', {
        error: error.message,
        timestamp: Date.now()
      })

      throw error
    }
  }

  /**
   * 註冊模組效能優化
   * @param {string} moduleId - 模組標識符
   * @param {Object} moduleConfig - 模組配置
   * @returns {Object} 優化策略
   */
  registerModule (moduleId, moduleConfig = {}) {
    Logger.info(`註冊模組效能優化: ${moduleId}`)

    // 建立模組特定的效能配置
    const performanceConfig = {
      moduleId,
      type: this.detectModuleType(moduleId),
      loadPriority: moduleConfig.priority || 'normal',
      memoryOptimization: moduleConfig.memoryOptimization !== false,
      loadingOptimization: moduleConfig.loadingOptimization !== false,
      ...this.config.moduleSpecificConfig[moduleId]
    }

    this.modulePerformance.set(moduleId, {
      config: performanceConfig,
      metrics: {
        loadTime: null,
        memoryUsage: null,
        lastOptimization: null
      },
      optimizations: []
    })

    this.integrationState.activeModules.add(moduleId)

    // 根據模組類型設定特定優化
    const optimizationStrategy = this.createModuleOptimizationStrategy(performanceConfig)

    this.emitPerformanceEvent('MODULE.REGISTERED', {
      moduleId,
      config: performanceConfig,
      strategy: optimizationStrategy
    })

    return optimizationStrategy
  }

  /**
   * 偵測模組類型
   * @param {string} moduleId - 模組標識符
   * @returns {string} 模組類型
   * @private
   */
  detectModuleType (moduleId) {
    const { MODULES } = PerformanceIntegration.CONFIG

    if (moduleId.includes('popup') || moduleId.includes('Popup')) {
      return MODULES.POPUP
    } else if (moduleId.includes('content') || moduleId.includes('Content')) {
      return MODULES.CONTENT
    } else if (moduleId.includes('background') || moduleId.includes('Background')) {
      return MODULES.BACKGROUND
    } else if (moduleId.includes('overview') || moduleId.includes('Overview')) {
      return MODULES.OVERVIEW
    }

    return 'unknown'
  }

  /**
   * 建立模組優化策略
   * @param {Object} config - 模組配置
   * @returns {Object} 優化策略
   * @private
   */
  createModuleOptimizationStrategy (config) {
    const { MODULES } = PerformanceIntegration.CONFIG

    const baseStrategy = {
      preload: config.loadPriority === 'high',
      lazyLoad: config.loadPriority === 'low',
      memoryManagement: config.memoryOptimization,
      performanceMonitoring: true
    }

    // 根據模組類型調整策略
    switch (config.type) {
      case MODULES.POPUP:
        return {
          ...baseStrategy,
          fastStartup: true,
          uiOptimization: true,
          responseTimeTarget: 1000
        }

      case MODULES.CONTENT:
        return {
          ...baseStrategy,
          injectionOptimization: true,
          domOptimization: true,
          responseTimeTarget: 200
        }

      case MODULES.BACKGROUND:
        return {
          ...baseStrategy,
          persistentOptimization: true,
          eventOptimization: true,
          memoryTarget: 30 * 1024 * 1024 // 30MB
        }

      case MODULES.OVERVIEW:
        return {
          ...baseStrategy,
          dataOptimization: true,
          renderingOptimization: true,
          responseTimeTarget: 3000
        }

      default:
        return baseStrategy
    }
  }

  /**
   * 處理模組初始化事件
   * @param {Object} eventData - 事件資料
   * @private
   */
  handleModuleInitialized (eventData) {
    const { moduleId, initTime } = eventData

    const modulePerf = this.modulePerformance.get(moduleId)
    if (modulePerf) {
      modulePerf.metrics.loadTime = initTime

      // 檢查是否超過目標時間
      const strategy = this.createModuleOptimizationStrategy(modulePerf.config)
      if (strategy.responseTimeTarget && initTime > strategy.responseTimeTarget) {
        this.emitPerformanceWarning('MODULE_SLOW_INIT', {
          moduleId,
          actualTime: initTime,
          targetTime: strategy.responseTimeTarget
        })
      }
    }
  }

  /**
   * 處理效能警告事件
   * @param {Object} warningData - 警告資料
   * @private
   */
  handlePerformanceWarning (warningData) {
    this.integrationState.performanceWarnings.push({
      ...warningData,
      timestamp: Date.now()
    })

    // 如果啟用自動優化，嘗試解決問題
    if (this.config.enableAutoOptimization) {
      this.handleAutomaticOptimization(warningData)
    }

    // 限制警告歷史大小
    if (this.integrationState.performanceWarnings.length > 100) {
      this.integrationState.performanceWarnings.splice(0, 50)
    }
  }

  /**
   * 處理自動優化
   * @param {Object} warningData - 警告資料
   * @private
   */
  handleAutomaticOptimization (warningData) {
    switch (warningData.type) {
      case 'HIGH_MEMORY_USAGE':
        this.performanceOptimizer.optimizeMemoryUsage()
        break

      case 'SLOW_LOADING':
        this.optimizeModuleLoading(warningData.moduleId)
        break

      case 'MODULE_SLOW_INIT':
        this.optimizeModuleInitialization(warningData.moduleId)
        break
    }
  }

  /**
   * 優化模組載入
   * @param {string} moduleId - 模組標識符
   * @private
   */
  async optimizeModuleLoading (moduleId) {
    const modulePerf = this.modulePerformance.get(moduleId)
    if (!modulePerf) return

    // 嘗試預載入模組依賴
    const dependencies = this.getModuleDependencies(moduleId)
    if (dependencies.length > 0) {
      await this.loadingOptimizer.warmupCache(dependencies)
    }

    // 記錄優化
    modulePerf.optimizations.push({
      type: 'loading_optimization',
      timestamp: Date.now(),
      details: { dependencies }
    })
  }

  /**
   * 優化模組初始化
   * @param {string} moduleId - 模組標識符
   * @private
   */
  optimizeModuleInitialization (moduleId) {
    Logger.info(`優化模組初始化: ${moduleId}`)

    const modulePerf = this.modulePerformance.get(moduleId)
    if (!modulePerf) return

    // 建議延遲載入非關鍵組件
    this.scheduleOptimizationTask(moduleId, 'defer_non_critical', {
      delay: 1000,
      priority: 'low'
    })

    // 記錄優化
    modulePerf.optimizations.push({
      type: 'initialization_optimization',
      timestamp: Date.now(),
      details: { strategy: 'defer_non_critical' }
    })
  }

  /**
   * 獲取模組依賴
   * @param {string} moduleId - 模組標識符
   * @returns {Array} 依賴列表
   * @private
   */
  getModuleDependencies (moduleId) {
    // 基於模組類型返回常見依賴
    const dependencyMap = {
      popup: ['event-bus', 'ui-components', 'storage-adapter'],
      content: ['event-bus', 'extractor', 'validator'],
      background: ['event-bus', 'storage-adapter', 'message-handler'],
      overview: ['event-bus', 'renderer', 'search-filter']
    }

    const moduleType = this.detectModuleType(moduleId)
    return dependencyMap[moduleType] || []
  }

  /**
   * 排程優化任務
   * @param {string} moduleId - 模組標識符
   * @param {string} taskType - 任務類型
   * @param {Object} options - 任務選項
   * @private
   */
  scheduleOptimizationTask (moduleId, taskType, options = {}) {
    const taskId = `${moduleId}_${taskType}_${Date.now()}`

    const task = {
      id: taskId,
      moduleId,
      type: taskType,
      options,
      scheduled: Date.now(),
      executed: null
    }

    this.optimizationTasks.set(taskId, task)

    // 根據優先級安排執行
    const delay = options.delay || 0
    setTimeout(() => {
      this.executeOptimizationTask(taskId)
    }, delay)
  }

  /**
   * 執行優化任務
   * @param {string} taskId - 任務 ID
   * @private
   */
  executeOptimizationTask (taskId) {
    const task = this.optimizationTasks.get(taskId)
    if (!task) return

    task.executed = Date.now()

    // 根據任務類型執行相應優化
    switch (task.type) {
      case 'defer_non_critical':
        this.deferNonCriticalComponents(task.moduleId)
        break

      case 'memory_cleanup':
        this.performanceOptimizer.optimizeMemoryUsage()
        break

      case 'cache_warmup':
        this.loadingOptimizer.warmupCache(task.options.resources || [])
        break
    }

    // 清理已執行的任務
    this.optimizationTasks.delete(taskId)
  }

  /**
   * 延遲非關鍵組件
   * @param {string} moduleId - 模組標識符
   * @private
   */
  deferNonCriticalComponents (moduleId) {
    // 發送延遲載入建議事件
    this.emitPerformanceEvent('OPTIMIZATION.DEFER_COMPONENTS', {
      moduleId,
      recommendation: 'defer_non_critical',
      timestamp: Date.now()
    })
  }

  /**
   * 排程自動優化
   * @private
   */
  scheduleAutoOptimization () {
    // 每 5 分鐘執行一次例行優化
    setInterval(() => {
      this.performRoutineOptimization()
    }, 5 * 60 * 1000)

    // 每小時執行健康檢查
    setInterval(() => {
      this.performHealthCheck()
    }, 60 * 60 * 1000)
  }

  /**
   * 執行例行優化
   * @private
   */
  async performRoutineOptimization () {
    // 記憶體優化
    this.performanceOptimizer.performRoutineOptimization()

    // 清理過期的優化任務
    this.cleanupExpiredTasks()

    // 更新模組效能指標
    this.updateModuleMetrics()
  }

  /**
   * 執行健康檢查
   * @returns {Promise<Object>} 健康檢查結果
   */
  async performHealthCheck () {
    Logger.info('執行效能健康檢查')

    const healthReport = {
      timestamp: Date.now(),
      overall: 'healthy',
      issues: [],
      recommendations: []
    }

    // 檢查記憶體使用
    const memoryInfo = this.performanceOptimizer.getMemoryInfo()
    const memoryUsagePercent = (memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize) * 100

    if (memoryUsagePercent > 80) {
      healthReport.overall = 'warning'
      healthReport.issues.push({
        type: 'high_memory_usage',
        severity: 'warning',
        description: `記憶體使用率過高: ${memoryUsagePercent.toFixed(1)}%`
      })
      healthReport.recommendations.push('執行記憶體清理和優化')
    }

    // 檢查載入效能
    const loadingMetrics = this.loadingOptimizer.getLoadingMetrics()
    if (loadingMetrics.cache.hitRate < 50) {
      healthReport.issues.push({
        type: 'low_cache_hit_rate',
        severity: 'info',
        description: `快取命中率較低: ${loadingMetrics.cache.hitRate.toFixed(1)}%`
      })
      healthReport.recommendations.push('增加資源預載入和快取策略')
    }

    // 檢查模組效能
    for (const [moduleId, modulePerf] of this.modulePerformance) {
      if (modulePerf.metrics.loadTime && modulePerf.metrics.loadTime > 3000) {
        healthReport.issues.push({
          type: 'slow_module_loading',
          severity: 'warning',
          description: `模組 ${moduleId} 載入緩慢: ${modulePerf.metrics.loadTime}ms`
        })
        healthReport.recommendations.push(`優化模組 ${moduleId} 的載入流程`)
      }
    }

    this.integrationState.lastHealthCheck = healthReport

    // 發送健康檢查事件
    this.emitPerformanceEvent('PERFORMANCE.HEALTH_CHECK', healthReport)

    return healthReport
  }

  /**
   * 立即優化
   * @returns {Promise<Object>} 優化結果
   */
  async optimizeNow () {
    const startTime = Date.now()
    const optimizationResults = []

    try {
      // 1. 記憶體優化
      this.performanceOptimizer.optimizeMemoryUsage()
      optimizationResults.push({ type: 'memory', success: true })

      // 2. 快取優化
      this.loadingOptimizer.clearCache({ keepCritical: true, maxAge: 300000 })
      optimizationResults.push({ type: 'cache', success: true })

      // 3. 模組特定優化
      for (const moduleId of this.integrationState.activeModules) {
        try {
          await this.optimizeModuleLoading(moduleId)
          optimizationResults.push({ type: 'module', moduleId, success: true })
        } catch (error) {
          optimizationResults.push({ type: 'module', moduleId, success: false, error: error.message })
        }
      }

      const endTime = Date.now()
      const totalTime = endTime - startTime

      const result = {
        success: true,
        optimizationTime: totalTime,
        results: optimizationResults,
        timestamp: Date.now()
      }

      return result
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.error('即時優化失敗', { error })

      return {
        success: false,
        error: error.message,
        results: optimizationResults,
        timestamp: Date.now()
      }
    }
  }

  /**
   * 獲取綜合效能報告
   * @returns {Object} 效能報告
   */
  getPerformanceReport () {
    const performanceReport = this.performanceOptimizer.getPerformanceReport()
    const loadingMetrics = this.loadingOptimizer.getLoadingMetrics()

    return {
      integration: {
        initialized: this.integrationState.initialized,
        activeModules: Array.from(this.integrationState.activeModules),
        optimizationLevel: this.config.optimizationLevel,
        lastHealthCheck: this.integrationState.lastHealthCheck
      },
      performance: performanceReport,
      loading: loadingMetrics,
      modules: this.getModulesReport(),
      recommendations: this.getIntegratedRecommendations(),
      timestamp: Date.now()
    }
  }

  /**
   * 獲取模組報告
   * @returns {Object} 模組效能報告
   * @private
   */
  getModulesReport () {
    const report = {}

    for (const [moduleId, modulePerf] of this.modulePerformance) {
      report[moduleId] = {
        config: modulePerf.config,
        metrics: modulePerf.metrics,
        optimizations: modulePerf.optimizations.length,
        lastOptimization: modulePerf.optimizations.length > 0
          ? modulePerf.optimizations[modulePerf.optimizations.length - 1].timestamp
          : null
      }
    }

    return report
  }

  /**
   * 獲取整合建議
   * @returns {Array} 建議列表
   * @private
   */
  getIntegratedRecommendations () {
    const recommendations = []

    // 從效能優化器獲取建議
    const perfRecommendations = this.performanceOptimizer.getPerformanceReport().recommendations
    recommendations.push(...perfRecommendations)

    // 從健康檢查獲取建議
    if (this.integrationState.lastHealthCheck) {
      recommendations.push(...this.integrationState.lastHealthCheck.recommendations.map(rec => ({
        priority: 'MEDIUM',
        type: 'HEALTH_CHECK',
        description: rec
      })))
    }

    // 模組特定建議
    for (const [moduleId, modulePerf] of this.modulePerformance) {
      if (modulePerf.metrics.loadTime > 2000) {
        recommendations.push({
          priority: 'HIGH',
          type: 'MODULE_OPTIMIZATION',
          description: `模組 ${moduleId} 需要載入優化`,
          moduleId
        })
      }
    }

    return recommendations
  }

  /**
   * 獲取優化建議
   * @returns {Array} 優化建議
   */
  getOptimizationRecommendations () {
    return this.getIntegratedRecommendations()
  }

  /**
   * 配置效能系統
   * @param {Object} newConfig - 新的配置
   */
  configure (newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    }

    // 重新配置優化器
    if (newConfig.optimizationLevel) {
      const loadingMode = this.getLoadingOptimizationMode()
      this.loadingOptimizer.config.mode = loadingMode
    }

    Logger.info('效能系統配置已更新')

    this.emitPerformanceEvent('PERFORMANCE.CONFIG_UPDATED', this.config)
  }

  /**
   * 處理效能 API 請求
   * @param {Object} request - 請求物件
   * @param {Function} sendResponse - 回應函數
   * @private
   */
  handlePerformanceAPIRequest (request, sendResponse) {
    const { action, data } = request

    switch (action) {
      case 'GET_REPORT':
        sendResponse({ success: true, data: this.getPerformanceReport() })
        break

      case 'OPTIMIZE_NOW':
        this.optimizeNow().then(result => {
          sendResponse({ success: true, data: result })
        }).catch(error => {
          sendResponse({ success: false, error: error.message })
        })
        break

      case 'CONFIGURE':
        this.configure(data)
        sendResponse({ success: true })
        break

      case 'GET_RECOMMENDATIONS':
        sendResponse({ success: true, data: this.getOptimizationRecommendations() })
        break

      default:
        sendResponse({ success: false, error: '未知的 API 動作' })
    }
  }

  /**
   * 發送效能事件
   * @param {string} eventType - 事件類型
   * @param {Object} eventData - 事件資料
   * @private
   */
  emitPerformanceEvent (eventType, eventData) {
    if (this.eventBus && this.eventBus.emit) {
      this.eventBus.emit(eventType, eventData)
    }

    // 通知所有效能監聽器
    for (const listener of this.performanceListeners) {
      try {
        listener(eventType, eventData)
      } catch (error) {
        // eslint-disable-next-line no-console
        Logger.warn('效能事件監聽器錯誤', { error })
      }
    }
  }

  /**
   * 發送效能警告
   * @param {string} warningType - 警告類型
   * @param {Object} warningData - 警告資料
   * @private
   */
  emitPerformanceWarning (warningType, warningData) {
    const warning = {
      type: warningType,
      ...warningData,
      timestamp: Date.now()
    }

    if (this.config.enablePerformanceWarnings) {
      // eslint-disable-next-line no-console
      Logger.warn('效能警告', { warning })
    }

    this.emitPerformanceEvent('PERFORMANCE.WARNING', warning)
  }

  /**
   * 添加效能監聽器
   * @param {Function} listener - 監聽器函數
   */
  addPerformanceListener (listener) {
    this.performanceListeners.add(listener)
  }

  /**
   * 移除效能監聽器
   * @param {Function} listener - 監聽器函數
   */
  removePerformanceListener (listener) {
    this.performanceListeners.delete(listener)
  }

  /**
   * 清理過期任務
   * @private
   */
  cleanupExpiredTasks () {
    const now = Date.now()
    const TASK_TIMEOUT = 10 * 60 * 1000 // 10 分鐘

    for (const [taskId, task] of this.optimizationTasks) {
      if (now - task.scheduled > TASK_TIMEOUT) {
        this.optimizationTasks.delete(taskId)
      }
    }
  }

  /**
   * 更新模組指標
   * @private
   */
  updateModuleMetrics () {
    const currentMemory = this.performanceOptimizer.getMemoryInfo().usedJSHeapSize

    for (const [, modulePerf] of this.modulePerformance) {
      modulePerf.metrics.memoryUsage = currentMemory / this.integrationState.activeModules.size
    }
  }

  /**
   * 停止效能系統
   */
  stop () {
    Logger.info('停止效能系統')

    // 停止優化器
    if (this.performanceOptimizer) {
      this.performanceOptimizer.stopPerformanceMonitoring()
    }

    if (this.loadingOptimizer) {
      this.loadingOptimizer.destroy()
    }

    // 清理狀態
    this.integrationState.initialized = false
    this.modulePerformance.clear()
    this.optimizationTasks.clear()
    this.performanceListeners.clear()

    // 移除全域 API
    if (typeof window !== 'undefined' && window.ExtensionPerformance) {
      delete window.ExtensionPerformance
    }
  }
}

// 單例模式實作
let performanceIntegrationInstance = null

/**
 * 獲取 PerformanceIntegration 單例
 * @param {Object} eventBus - 事件總線
 * @param {Object} options - 配置選項
 * @returns {PerformanceIntegration} 整合實例
 */
function getPerformanceIntegration (eventBus, options = {}) {
  if (!performanceIntegrationInstance) {
    performanceIntegrationInstance = new PerformanceIntegration(eventBus, options)
  }
  return performanceIntegrationInstance
}

// 模組匯出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PerformanceIntegration,
    getPerformanceIntegration
  }
} else if (typeof window !== 'undefined') {
  window.PerformanceIntegration = PerformanceIntegration
  window.getPerformanceIntegration = getPerformanceIntegration
}
