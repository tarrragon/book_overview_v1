/**
 * @fileoverview EventPerformanceMonitor - 事件效能監控系統
 * TDD 循環 #34: 事件效能監控和警告機制
 *
 * 核心功能：
 * - 🔍 事件處理時間追蹤和統計
 * - 📊 記憶體使用監控和警告
 * - ⚠️ 智能效能警告機制
 * - 📈 詳細統計報告生成
 * - 🧹 自動記憶體管理和清理
 * - 🎯 可配置採樣率和閾值
 *
 * 設計特點：
 * - 繼承 EventHandler，優先級 5 (中等優先級)
 * - 支援效能採樣，降低監控開銷
 * - 自動清理過期事件，防止記憶體洩漏
 * - 提供 Chrome DevTools 整合的監控介面
 *
 * @author TDD Development Team
 * @since 2025-08-07
 * @version 1.0.0
 */

const EventHandler = require('src/core/event-handler')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

/**
 * EventPerformanceMonitor 類別
 *
 * 繼承 EventHandler，提供事件系統的效能監控功能
 * 追蹤事件處理時間、記憶體使用、發出效能警告
 */
class EventPerformanceMonitor extends EventHandler {
  /**
   * 分層常數架構
   *
   * 組織架構：
   * - CONFIG: 基本配置和預設值
   * - EVENTS: 輸入和輸出事件定義
   * - WARNINGS: 警告類型和閾值
   * - PERFORMANCE: 效能相關常數
   * - ERRORS: 錯誤訊息定義
   */
  static get CONSTANTS () {
    return {
      CONFIG: {
        NAME: 'EventPerformanceMonitor',
        PRIORITY: 5,
        DEFAULT_SAMPLE_RATE: 1.0,
        DEFAULT_MAX_RECORDS: 1000,
        MAX_WARNING_HISTORY: 100
      },
      EVENTS: {
        INPUT: {
          PROCESSING_STARTED: 'EVENT.PROCESSING.STARTED',
          PROCESSING_COMPLETED: 'EVENT.PROCESSING.COMPLETED',
          PROCESSING_FAILED: 'EVENT.PROCESSING.FAILED',
          MONITOR_REQUEST: 'PERFORMANCE.MONITOR.REQUEST'
        },
        OUTPUT: {
          WARNING: 'PERFORMANCE.WARNING',
          MONITOR_RESPONSE: 'PERFORMANCE.MONITOR.RESPONSE'
        }
      },
      WARNINGS: {
        TYPES: {
          SLOW_EVENT_PROCESSING: 'SLOW_EVENT_PROCESSING',
          HIGH_MEMORY_USAGE: 'HIGH_MEMORY_USAGE',
          HIGH_ACTIVE_EVENT_COUNT: 'HIGH_ACTIVE_EVENT_COUNT'
        },
        DEFAULT_THRESHOLDS: {
          eventProcessingTime: 1000, // 1 秒
          memoryUsage: 100 * 1024 * 1024, // 100MB
          activeEventCount: 50
        }
      },
      PERFORMANCE: {
        CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 分鐘
        EVENT_TIMEOUT: 30 * 1000, // 30 秒
        MARK_PREFIX: 'event-start-',
        MEASURE_PREFIX: 'event-duration-'
      },
      ERRORS: {
        MESSAGES: {
          PROCESSING_ERROR: '效能監控處理錯誤',
          UNSUPPORTED_EVENT_TYPE: '不支援的事件類型',
          EVENT_NOT_FOUND: '找不到對應的開始事件'
        }
      }
    }
  }

  /**
   * 建構函數
   *
   * @param {Object} eventBus - 事件總線實例
   * @param {Object} options - 配置選項
   */
  constructor (eventBus, options = {}) {
    const { CONFIG, EVENTS } = EventPerformanceMonitor.CONSTANTS

    super(CONFIG.NAME, CONFIG.PRIORITY)

    this.eventBus = eventBus
    this.supportedEvents = Object.values(EVENTS.INPUT)

    // 合併配置
    this.config = this._mergeConfiguration(options)

    // 初始化狀態
    this.isEnabled = true
    this.startTime = Date.now()

    // 初始化資料結構
    this._initializeDataStructures()

    // 啟動定期清理
    this._startPeriodicCleanup()
  }

  /**
   * 合併配置選項
   *
   * @param {Object} options - 使用者配置
   * @returns {Object} 合併後的配置
   * @private
   */
  _mergeConfiguration (options) {
    const { CONFIG, WARNINGS, PERFORMANCE } = EventPerformanceMonitor.CONSTANTS

    return {
      sampleRate: options.sampleRate || CONFIG.DEFAULT_SAMPLE_RATE,
      maxRecords: options.maxRecords || CONFIG.DEFAULT_MAX_RECORDS,
      warningThresholds: {
        ...WARNINGS.DEFAULT_THRESHOLDS,
        ...(options.warningThresholds || {})
      },
      cleanupInterval: options.cleanupInterval || PERFORMANCE.CLEANUP_INTERVAL,
      eventTimeout: options.eventTimeout || PERFORMANCE.EVENT_TIMEOUT
    }
  }

  /**
   * 初始化資料結構
   *
   * @private
   */
  _initializeDataStructures () {
    // 活躍事件追蹤
    this.activeEvents = new Map()

    // 效能統計
    this.performanceStats = {
      totalEvents: 0,
      failedEvents: 0,
      averageProcessingTime: 0,
      warningCount: 0,
      lastWarningTime: null
    }

    // 效能歷史記錄
    this.performanceHistory = []

    // 警告歷史
    this.warningHistory = []

    // 清理定時器
    this.cleanupTimer = null
  }

  /**
   * 處理事件
   *
   * @param {Object} eventData - 事件資料
   * @returns {Object} 處理結果
   */
  process (eventData) {
    if (!this.isEnabled || !this._shouldSample()) {
      return { success: true, skipped: true }
    }

    try {
      return this._dispatchEventHandler(eventData)
    } catch (error) {
      return this._createErrorResponse('PROCESSING_ERROR', error, eventData)
    }
  }

  /**
   * 分派事件處理器
   *
   * @param {Object} eventData - 事件資料
   * @returns {Object} 處理結果
   * @private
   */
  _dispatchEventHandler (eventData) {
    const { EVENTS } = EventPerformanceMonitor.CONSTANTS

    switch (eventData.type) {
      case EVENTS.INPUT.PROCESSING_STARTED:
        return this._handleProcessingStarted(eventData.data)
      case EVENTS.INPUT.PROCESSING_COMPLETED:
        return this._handleProcessingCompleted(eventData.data)
      case EVENTS.INPUT.PROCESSING_FAILED:
        return this._handleProcessingFailed(eventData.data)
      case EVENTS.INPUT.MONITOR_REQUEST:
        return this._handleMonitorRequest(eventData.data)
      default: {
        const { ERRORS } = EventPerformanceMonitor.CONSTANTS
        return this._createErrorResponse(
          'UNSUPPORTED_EVENT_TYPE',
          (() => {
            const error = new Error(`${ERRORS.MESSAGES.UNSUPPORTED_EVENT_TYPE}: ${eventData.type}`)
            error.code = ErrorCodes.VALIDATION_ERROR
            error.details = {
              category: 'general',
              component: 'EventPerformanceMonitor',
              eventType: eventData.type
            }
            return error
          })(),
          eventData
        )
      }
    }
  }

  /**
   * 處理事件開始
   *
   * @param {Object} data - 事件資料
   * @returns {Object} 處理結果
   * @private
   */
  _handleProcessingStarted (data) {
    const { eventId, eventType } = data
    const startTime = this._getCurrentTime()

    // 記錄活躍事件
    this.activeEvents.set(eventId, {
      eventType,
      startTime,
      timestamp: Date.now()
    })

    // 設置效能標記
    if (typeof performance !== 'undefined' && performance.mark) {
      const { PERFORMANCE } = EventPerformanceMonitor.CONSTANTS
      performance.mark(`${PERFORMANCE.MARK_PREFIX}${eventId}`)
    }

    // 檢查活躍事件數量警告
    this._checkActiveEventCountWarning()

    return { success: true, eventId, startTime }
  }

  /**
   * 處理事件完成
   *
   * @param {Object} data - 事件資料
   * @returns {Object} 處理結果
   * @private
   */
  _handleProcessingCompleted (data) {
    const { eventId, eventType } = data
    const endTime = this._getCurrentTime()

    if (!this.activeEvents.has(eventId)) {
      const { ERRORS } = EventPerformanceMonitor.CONSTANTS
      return { success: false, error: ERRORS.MESSAGES.EVENT_NOT_FOUND }
    }

    const eventInfo = this.activeEvents.get(eventId)
    const processingTime = endTime - eventInfo.startTime

    // 更新統計
    this._updateProcessingStats(processingTime)

    // 記錄效能資料
    this._addPerformanceRecord({
      eventId,
      eventType: eventType || eventInfo.eventType,
      processingTime,
      timestamp: Date.now()
    })

    // 檢查處理時間警告
    this._checkProcessingTimeWarning(
      eventId,
      eventType || eventInfo.eventType,
      processingTime
    )

    // 清理活躍事件
    this.activeEvents.delete(eventId)

    // 設置效能測量
    if (typeof performance !== 'undefined' && performance.measure) {
      try {
        const { PERFORMANCE } = EventPerformanceMonitor.CONSTANTS
        performance.measure(
          `${PERFORMANCE.MEASURE_PREFIX}${eventId}`,
          `${PERFORMANCE.MARK_PREFIX}${eventId}`
        )
      } catch (error) {
        // 忽略測量錯誤
      }
    }

    return { success: true, eventId, processingTime }
  }

  /**
   * 處理事件失敗
   *
   * @param {Object} data - 事件資料
   * @returns {Object} 處理結果
   * @private
   */
  _handleProcessingFailed (data) {
    const { eventId, eventType, error } = data

    // 更新失敗統計
    this.performanceStats.failedEvents++

    // 清理活躍事件
    if (this.activeEvents.has(eventId)) {
      this.activeEvents.delete(eventId)
    }

    // 記錄失敗事件
    this._addPerformanceRecord({
      eventId,
      eventType,
      failed: true,
      error: error?.message || '未知錯誤',
      timestamp: Date.now()
    })

    return { success: true, eventId, failed: true }
  }

  /**
   * 處理監控請求
   *
   * @param {Object} data - 請求資料
   * @returns {Object} 處理結果
   * @private
   */
  _handleMonitorRequest (data) {
    const { requestId, includeHistory = false } = data

    const report = this.generatePerformanceReport()
    const response = {
      requestId,
      report,
      timestamp: Date.now()
    }

    if (includeHistory) {
      response.history = [...this.performanceHistory]
    }

    // 發送回應事件
    this._emitMonitorResponse(response)

    return { success: true, requestId }
  }

  /**
   * 檢查是否應該採樣
   *
   * @returns {boolean} 是否採樣
   * @private
   */
  _shouldSample () {
    return Math.random() < this.config.sampleRate
  }

  /**
   * 獲取當前時間
   *
   * @returns {number} 當前時間戳
   * @private
   */
  _getCurrentTime () {
    return typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now()
  }

  /**
   * 更新處理統計
   *
   * @param {number} processingTime - 處理時間
   * @private
   */
  _updateProcessingStats (processingTime) {
    const currentTotal = this.performanceStats.totalEvents
    const currentAverage = this.performanceStats.averageProcessingTime

    this.performanceStats.totalEvents++
    this.performanceStats.averageProcessingTime =
      (currentAverage * currentTotal + processingTime) / (currentTotal + 1)
  }

  /**
   * 添加效能記錄
   *
   * @param {Object} record - 效能記錄
   * @private
   */
  _addPerformanceRecord (record) {
    this.performanceHistory.unshift(record)

    // 限制記錄數量 - 保留最新的記錄
    if (this.performanceHistory.length > this.config.maxRecords) {
      this.performanceHistory.length = this.config.maxRecords
    }
  }

  /**
   * 檢查處理時間警告
   *
   * @param {string} eventId - 事件 ID
   * @param {string} eventType - 事件類型
   * @param {number} processingTime - 處理時間
   * @private
   */
  _checkProcessingTimeWarning (eventId, eventType, processingTime) {
    const threshold = this.config.warningThresholds.eventProcessingTime

    if (processingTime > threshold) {
      this._emitWarning(
        EventPerformanceMonitor.CONSTANTS.WARNINGS.TYPES.SLOW_EVENT_PROCESSING,
        {
          eventId,
          eventType,
          processingTime,
          threshold,
          timestamp: Date.now()
        }
      )
    }
  }

  /**
   * 檢查活躍事件數量警告
   *
   * @private
   */
  _checkActiveEventCountWarning () {
    const activeCount = this.activeEvents.size
    const threshold = this.config.warningThresholds.activeEventCount

    if (activeCount > threshold) {
      this._emitWarning(
        EventPerformanceMonitor.CONSTANTS.WARNINGS.TYPES
          .HIGH_ACTIVE_EVENT_COUNT,
        {
          activeEventCount: activeCount,
          threshold,
          timestamp: Date.now()
        }
      )
    }
  }

  /**
   * 檢查記憶體警告
   *
   * @private
   */
  _checkMemoryWarnings () {
    const memoryStats = this._collectMemoryStats()
    const threshold = this.config.warningThresholds.memoryUsage

    if (memoryStats.usedMemory > threshold) {
      this._emitWarning(
        EventPerformanceMonitor.CONSTANTS.WARNINGS.TYPES.HIGH_MEMORY_USAGE,
        {
          usedMemory: memoryStats.usedMemory,
          threshold,
          memoryUsagePercent: memoryStats.memoryUsagePercent,
          timestamp: Date.now()
        }
      )
    }
  }

  /**
   * 收集記憶體統計
   *
   * @returns {Object} 記憶體統計資料
   * @private
   */
  _collectMemoryStats () {
    if (typeof performance !== 'undefined' && performance.memory) {
      const memory = performance.memory
      return {
        usedMemory: memory.usedJSHeapSize,
        totalMemory: memory.totalJSHeapSize,
        memoryLimit: memory.jsHeapSizeLimit,
        memoryUsagePercent: Math.round(
          (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
        )
      }
    }

    return {
      usedMemory: 0,
      totalMemory: 0,
      memoryLimit: 0,
      memoryUsagePercent: 0
    }
  }

  /**
   * 發出警告事件
   *
   * @param {string} warningType - 警告類型
   * @param {Object} warningData - 警告資料
   * @private
   */
  _emitWarning (warningType, warningData) {
    const warning = {
      type: warningType,
      ...warningData
    }

    // 更新警告統計
    this.performanceStats.warningCount++
    this.performanceStats.lastWarningTime = Date.now()

    // 記錄警告歷史
    this.warningHistory.unshift(warning)
    const { CONFIG } = EventPerformanceMonitor.CONSTANTS
    if (this.warningHistory.length > CONFIG.MAX_WARNING_HISTORY) {
      // 限制警告歷史數量
      this.warningHistory.length = CONFIG.MAX_WARNING_HISTORY
    }

    // 發送警告事件
    if (this.eventBus && this.eventBus.emit) {
      this.eventBus.emit(
        EventPerformanceMonitor.CONSTANTS.EVENTS.OUTPUT.WARNING,
        warning
      )
    }
  }

  /**
   * 發送監控回應事件
   *
   * @param {Object} response - 回應資料
   * @private
   */
  _emitMonitorResponse (response) {
    if (this.eventBus && this.eventBus.emit) {
      this.eventBus.emit(
        EventPerformanceMonitor.CONSTANTS.EVENTS.OUTPUT.MONITOR_RESPONSE,
        response
      )
    }
  }

  /**
   * 生成效能報告
   *
   * @returns {Object} 效能報告
   */
  generatePerformanceReport () {
    const memoryStats = this._collectMemoryStats()
    const uptime = Date.now() - this.startTime

    return {
      summary: {
        totalEvents: this.performanceStats.totalEvents,
        failedEvents: this.performanceStats.failedEvents,
        successRate:
          this.performanceStats.totalEvents > 0
            ? Math.round(
              ((this.performanceStats.totalEvents -
                  this.performanceStats.failedEvents) /
                  this.performanceStats.totalEvents) *
                  100
            )
            : 100,
        averageProcessingTime: this.performanceStats.averageProcessingTime,
        activeEventCount: this.activeEvents.size
      },
      warnings: {
        totalWarnings: this.performanceStats.warningCount,
        lastWarningTime: this.performanceStats.lastWarningTime,
        recentWarnings: this.warningHistory.slice(0, 5)
      },
      memory: memoryStats,
      uptime,
      timestamp: Date.now()
    }
  }

  /**
   * 獲取效能統計
   *
   * @returns {Object} 效能統計資料
   */
  getPerformanceStats () {
    return {
      ...this.performanceStats,
      uptime: Date.now() - this.startTime,
      activeEventCount: this.activeEvents.size,
      memoryStats: this._collectMemoryStats()
    }
  }

  /**
   * 重置統計資料
   */
  resetStats () {
    this.performanceStats = {
      totalEvents: 0,
      failedEvents: 0,
      averageProcessingTime: 0,
      warningCount: 0,
      lastWarningTime: null
    }

    this.performanceHistory = []
    this.warningHistory = []
    this.startTime = Date.now()
  }

  /**
   * 啟動定期清理
   *
   * @private
   */
  _startPeriodicCleanup () {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    this.cleanupTimer = setInterval(() => {
      this._performCleanup()
    }, this.config.cleanupInterval)
  }

  /**
   * 執行清理任務
   *
   * @private
   */
  _performCleanup () {
    this._cleanupExpiredEvents()
    this._checkMemoryWarnings()
  }

  /**
   * 清理過期事件
   *
   * @private
   */
  _cleanupExpiredEvents () {
    const now = Date.now()
    const timeout = this.config.eventTimeout

    for (const [eventId, eventInfo] of this.activeEvents.entries()) {
      if (now - eventInfo.timestamp > timeout) {
        this.activeEvents.delete(eventId)
      }
    }
  }

  /**
   * 停用監控器
   */
  disable () {
    this.isEnabled = false

    // 清理定時器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    // 清理資源
    this.activeEvents.clear()
    this.performanceHistory = []
    this.warningHistory = []
  }

  /**
   * 創建錯誤回應
   *
   * @param {string} errorType - 錯誤類型
   * @param {Error} error - 錯誤物件
   * @param {Object} eventData - 事件資料
   * @returns {Object} 錯誤回應
   * @private
   */
  _createErrorResponse (errorType, error, eventData) {
    return {
      success: false,
      error: errorType,
      message: error.message,
      eventData,
      timestamp: Date.now()
    }
  }
}

/**
 * ErrorCodes 即時效能監控器
 *
 * 專門針對 ErrorCodes v5.0.0 系統的效能監控
 * 基於 EventPerformanceMonitor 架構，提供 ErrorCodes 特有的監控功能
 */
class ErrorCodesPerformanceMonitor {
  /**
   * ErrorCodes 效能監控常數定義
   */
  static get CONSTANTS () {
    return {
      CONFIG: {
        NAME: 'ErrorCodesPerformanceMonitor',
        DEFAULT_MEMORY_THRESHOLD: 1000, // bytes per error
        DEFAULT_CREATION_TIME_THRESHOLD: 0.5, // ms
        BATCH_SIZE_WARNING: 1000,
        MEMORY_LEAK_THRESHOLD: 10 * 1024 * 1024 // 10MB
      },
      METRICS: {
        TYPES: {
          MEMORY_USAGE: 'MEMORY_USAGE',
          CREATION_TIME: 'CREATION_TIME',
          ERROR_FREQUENCY: 'ERROR_FREQUENCY',
          MEMORY_LEAK: 'MEMORY_LEAK'
        }
      },
      WARNINGS: {
        HIGH_MEMORY_USAGE: 'ERRORCODES_HIGH_MEMORY_USAGE',
        SLOW_CREATION: 'ERRORCODES_SLOW_CREATION',
        FREQUENT_ERRORS: 'ERRORCODES_FREQUENT_ERRORS',
        MEMORY_LEAK_DETECTED: 'ERRORCODES_MEMORY_LEAK'
      }
    }
  }

  /**
   * 建構函式
   * @param {Object} options - 監控選項
   */
  constructor (options = {}) {
    const { CONFIG } = ErrorCodesPerformanceMonitor.CONSTANTS

    this.config = {
      memoryThreshold: options.memoryThreshold || CONFIG.DEFAULT_MEMORY_THRESHOLD,
      creationTimeThreshold: options.creationTimeThreshold || CONFIG.DEFAULT_CREATION_TIME_THRESHOLD,
      batchSizeWarning: options.batchSizeWarning || CONFIG.BATCH_SIZE_WARNING,
      memoryLeakThreshold: options.memoryLeakThreshold || CONFIG.MEMORY_LEAK_THRESHOLD
    }

    // 初始化監控數據
    this._initializeMonitoringData()

    // 啟動即時監控
    this._startRealtimeMonitoring()
  }

  /**
   * 初始化監控數據結構
   * @private
   */
  _initializeMonitoringData () {
    // 效能指標收集
    this.metrics = {
      memoryUsage: [],
      creationTimes: [],
      errorFrequency: new Map(),
      memoryBaseline: 0
    }

    // 即時統計
    this.realtimeStats = {
      totalErrorsCreated: 0,
      averageMemoryUsage: 0,
      averageCreationTime: 0,
      peakMemoryUsage: 0,
      errorTypeCounts: new Map(),
      lastMemoryMeasurement: 0
    }

    // 警告歷史
    this.warnings = []

    // 監控狀態
    this.isMonitoring = true
    this.monitoringStartTime = Date.now()
  }

  /**
   * 啟動即時監控
   * @private
   */
  _startRealtimeMonitoring () {
    // 每 5 秒進行一次記憶體檢查
    this.memoryCheckInterval = setInterval(() => {
      this._checkMemoryUsage()
    }, 5000)

    // 每分鐘進行效能分析
    this.performanceAnalysisInterval = setInterval(() => {
      this._performanceAnalysis()
    }, 60000)

    // 建立初始記憶體基準線
    this._establishMemoryBaseline()
  }

  /**
   * 監控錯誤建立效能
   * @param {Function} errorCreationFn - 錯誤建立函式
   * @param {Object} context - 建立上下文
   * @returns {Object} 效能監控結果
   */
  monitorErrorCreation (errorCreationFn, context = {}) {
    if (!this.isMonitoring) {
      return errorCreationFn()
    }

    const startTime = process.hrtime.bigint()
    const memoryBefore = this._measureMemory()

    try {
      // 執行錯誤建立
      const result = errorCreationFn()

      const endTime = process.hrtime.bigint()
      const memoryAfter = this._measureMemory()

      // 計算效能指標
      const creationTime = Number(endTime - startTime) / 1000000 // 轉換為毫秒
      const memoryUsed = memoryAfter.heapUsed - memoryBefore.heapUsed

      // 記錄效能數據
      this._recordPerformanceData({
        creationTime,
        memoryUsed,
        errorType: result?.code || 'UNKNOWN',
        context,
        timestamp: Date.now()
      })

      // 檢查效能警告
      this._checkPerformanceWarnings(creationTime, memoryUsed, result?.code)

      return result
    } catch (error) {
      // 記錄錯誤建立失敗
      this._recordErrorCreationFailure(error, context)
      throw error
    }
  }

  /**
   * 監控批次錯誤建立
   * @param {Function} batchCreationFn - 批次建立函式
   * @param {number} batchSize - 批次大小
   * @returns {Object} 批次效能結果
   */
  monitorBatchErrorCreation (batchCreationFn, batchSize) {
    if (batchSize > this.config.batchSizeWarning) {
      this._emitWarning(
        ErrorCodesPerformanceMonitor.CONSTANTS.WARNINGS.FREQUENT_ERRORS,
        {
          batchSize,
          threshold: this.config.batchSizeWarning,
          message: `大批次錯誤建立可能影響效能: ${batchSize} 個錯誤`
        }
      )
    }

    const startTime = process.hrtime.bigint()
    const memoryBefore = this._measureMemory()

    if (global.gc) global.gc() // 強制垃圾回收以獲得準確的記憶體測量

    const result = batchCreationFn()

    const endTime = process.hrtime.bigint()
    const memoryAfter = this._measureMemory()

    const totalTime = Number(endTime - startTime) / 1000000
    const totalMemory = memoryAfter.heapUsed - memoryBefore.heapUsed

    // 記錄批次效能
    this._recordBatchPerformance({
      batchSize,
      totalTime,
      totalMemory,
      averageTimePerError: totalTime / batchSize,
      averageMemoryPerError: totalMemory / batchSize,
      timestamp: Date.now()
    })

    return result
  }

  /**
   * 測量當前記憶體使用量
   * @returns {Object} 記憶體使用資訊
   * @private
   */
  _measureMemory () {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage()
    }

    // Chrome Extension 環境的記憶體測量
    if (typeof performance !== 'undefined' && performance.memory) {
      const memory = performance.memory
      return {
        heapUsed: memory.usedJSHeapSize,
        heapTotal: memory.totalJSHeapSize,
        external: 0,
        rss: memory.usedJSHeapSize
      }
    }

    return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 }
  }

  /**
   * 建立記憶體基準線
   * @private
   */
  _establishMemoryBaseline () {
    if (global.gc) global.gc()

    setTimeout(() => {
      const baseline = this._measureMemory()
      this.metrics.memoryBaseline = baseline.heapUsed
      this.realtimeStats.lastMemoryMeasurement = baseline.heapUsed
    }, 1000)
  }

  /**
   * 記錄效能數據
   * @param {Object} data - 效能數據
   * @private
   */
  _recordPerformanceData (data) {
    // 更新指標收集
    this.metrics.creationTimes.push(data.creationTime)
    this.metrics.memoryUsage.push(data.memoryUsed)

    // 限制數據長度避免記憶體洩漏
    if (this.metrics.creationTimes.length > 1000) {
      this.metrics.creationTimes = this.metrics.creationTimes.slice(-500)
    }
    if (this.metrics.memoryUsage.length > 1000) {
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-500)
    }

    // 更新即時統計
    this.realtimeStats.totalErrorsCreated++

    // 更新錯誤類型計數
    const errorType = data.errorType
    this.realtimeStats.errorTypeCounts.set(
      errorType,
      (this.realtimeStats.errorTypeCounts.get(errorType) || 0) + 1
    )

    // 更新平均值
    this._updateAverages()

    // 更新峰值
    if (data.memoryUsed > this.realtimeStats.peakMemoryUsage) {
      this.realtimeStats.peakMemoryUsage = data.memoryUsed
    }
  }

  /**
   * 更新平均值統計
   * @private
   */
  _updateAverages () {
    if (this.metrics.creationTimes.length > 0) {
      this.realtimeStats.averageCreationTime =
        this.metrics.creationTimes.reduce((sum, time) => sum + time, 0) /
        this.metrics.creationTimes.length
    }

    if (this.metrics.memoryUsage.length > 0) {
      this.realtimeStats.averageMemoryUsage =
        this.metrics.memoryUsage.reduce((sum, mem) => sum + mem, 0) /
        this.metrics.memoryUsage.length
    }
  }

  /**
   * 檢查效能警告
   * @param {number} creationTime - 建立時間
   * @param {number} memoryUsed - 記憶體使用量
   * @param {string} errorType - 錯誤類型
   * @private
   */
  _checkPerformanceWarnings (creationTime, memoryUsed, errorType) {
    const { WARNINGS } = ErrorCodesPerformanceMonitor.CONSTANTS

    // 檢查建立時間警告
    if (creationTime > this.config.creationTimeThreshold) {
      this._emitWarning(WARNINGS.SLOW_CREATION, {
        creationTime,
        threshold: this.config.creationTimeThreshold,
        errorType,
        message: `ErrorCodes 建立時間過長: ${creationTime.toFixed(3)}ms`
      })
    }

    // 檢查記憶體使用警告
    if (memoryUsed > this.config.memoryThreshold) {
      this._emitWarning(WARNINGS.HIGH_MEMORY_USAGE, {
        memoryUsed,
        threshold: this.config.memoryThreshold,
        errorType,
        message: `ErrorCodes 記憶體使用過高: ${memoryUsed} bytes`
      })
    }
  }

  /**
   * 檢查記憶體使用狀況
   * @private
   */
  _checkMemoryUsage () {
    const currentMemory = this._measureMemory()
    const memoryIncrease = currentMemory.heapUsed - this.realtimeStats.lastMemoryMeasurement

    // 檢查記憶體洩漏
    if (memoryIncrease > this.config.memoryLeakThreshold) {
      this._emitWarning(
        ErrorCodesPerformanceMonitor.CONSTANTS.WARNINGS.MEMORY_LEAK_DETECTED,
        {
          memoryIncrease,
          currentMemory: currentMemory.heapUsed,
          baseline: this.metrics.memoryBaseline,
          message: `可能檢測到記憶體洩漏: 增加 ${memoryIncrease} bytes`
        }
      )
    }

    this.realtimeStats.lastMemoryMeasurement = currentMemory.heapUsed
  }

  /**
   * 執行效能分析
   * @private
   */
  _performanceAnalysis () {
    const analysis = this.generatePerformanceAnalysis()

    // 檢查效能趨勢
    if (analysis.trends.memoryTrend === 'increasing' &&
        analysis.trends.timeTrend === 'increasing') {
      this._emitWarning(
        ErrorCodesPerformanceMonitor.CONSTANTS.WARNINGS.FREQUENT_ERRORS,
        {
          message: '檢測到效能下降趨勢',
          memoryTrend: analysis.trends.memoryTrend,
          timeTrend: analysis.trends.timeTrend,
          recommendations: analysis.recommendations
        }
      )
    }
  }

  /**
   * 記錄批次效能
   * @param {Object} batchData - 批次效能數據
   * @private
   */
  _recordBatchPerformance (batchData) {
    // 這裡可以記錄批次效能數據以供後續分析
    console.log(`批次效能記錄: ${JSON.stringify(batchData, null, 2)}`)
  }

  /**
   * 記錄錯誤建立失敗
   * @param {Error} error - 失敗錯誤
   * @param {Object} context - 上下文
   * @private
   */
  _recordErrorCreationFailure (error, context) {
    console.error('ErrorCodes 建立失敗:', error.message, context)
  }

  /**
   * 發出效能警告
   * @param {string} warningType - 警告類型
   * @param {Object} warningData - 警告數據
   * @private
   */
  _emitWarning (warningType, warningData) {
    const warning = {
      type: warningType,
      timestamp: Date.now(),
      ...warningData
    }

    this.warnings.unshift(warning)

    // 限制警告歷史長度
    if (this.warnings.length > 100) {
      this.warnings = this.warnings.slice(0, 50)
    }

    // 輸出警告到控制台（在生產環境中可以發送到監控系統）
    console.warn(`[ErrorCodes 效能警告] ${warningType}:`, warningData)
  }

  /**
   * 生成效能分析報告
   * @returns {Object} 效能分析結果
   */
  generatePerformanceAnalysis () {
    const { creationTimes, memoryUsage } = this.metrics

    // 計算統計指標
    const stats = {
      creationTime: this._calculateStats(creationTimes),
      memoryUsage: this._calculateStats(memoryUsage)
    }

    // 分析趨勢
    const trends = {
      memoryTrend: this._analyzeTrend(memoryUsage),
      timeTrend: this._analyzeTrend(creationTimes)
    }

    // 生成建議
    const recommendations = this._generateRecommendations(stats, trends)

    return {
      timestamp: Date.now(),
      monitoringDuration: Date.now() - this.monitoringStartTime,
      realtimeStats: { ...this.realtimeStats },
      statistics: stats,
      trends,
      recommendations,
      recentWarnings: this.warnings.slice(0, 5)
    }
  }

  /**
   * 計算統計指標
   * @param {Array} data - 數據陣列
   * @returns {Object} 統計結果
   * @private
   */
  _calculateStats (data) {
    if (data.length === 0) {
      return { count: 0, mean: 0, median: 0, p95: 0, p99: 0, min: 0, max: 0 }
    }

    const sorted = [...data].sort((a, b) => a - b)
    const count = sorted.length

    return {
      count,
      mean: sorted.reduce((sum, val) => sum + val, 0) / count,
      median: sorted[Math.floor(count / 2)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
      min: sorted[0],
      max: sorted[count - 1]
    }
  }

  /**
   * 分析趨勢
   * @param {Array} data - 時間序列數據
   * @returns {string} 趨勢描述
   * @private
   */
  _analyzeTrend (data) {
    if (data.length < 10) return 'insufficient_data'

    const recent = data.slice(-10)
    const earlier = data.slice(-20, -10)

    if (earlier.length === 0) return 'insufficient_data'

    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length
    const earlierAvg = earlier.reduce((sum, val) => sum + val, 0) / earlier.length

    const changePercent = ((recentAvg - earlierAvg) / earlierAvg) * 100

    if (changePercent > 10) return 'increasing'
    if (changePercent < -10) return 'decreasing'
    return 'stable'
  }

  /**
   * 生成效能建議
   * @param {Object} stats - 統計數據
   * @param {Object} trends - 趨勢分析
   * @returns {Array} 建議列表
   * @private
   */
  _generateRecommendations (stats, trends) {
    const recommendations = []

    if (stats.creationTime.p95 > this.config.creationTimeThreshold) {
      recommendations.push('考慮使用 CommonErrors 預編譯錯誤以改善建立效能')
    }

    if (stats.memoryUsage.mean > this.config.memoryThreshold * 0.8) {
      recommendations.push('檢查錯誤物件的記憶體使用，考慮減少 details 欄位大小')
    }

    if (trends.memoryTrend === 'increasing') {
      recommendations.push('記憶體使用呈上升趨勢，建議檢查是否有記憶體洩漏')
    }

    if (this.realtimeStats.totalErrorsCreated > 10000) {
      recommendations.push('錯誤建立頻率較高，建議檢查是否有重複錯誤產生')
    }

    return recommendations
  }

  /**
   * 獲取即時效能狀態
   * @returns {Object} 效能狀態
   */
  getRealtimeStatus () {
    const currentMemory = this._measureMemory()

    return {
      isMonitoring: this.isMonitoring,
      uptime: Date.now() - this.monitoringStartTime,
      currentMemory: currentMemory.heapUsed,
      memoryBaseline: this.metrics.memoryBaseline,
      realtimeStats: { ...this.realtimeStats },
      recentWarnings: this.warnings.slice(0, 3),
      healthStatus: this._calculateHealthStatus()
    }
  }

  /**
   * 計算健康狀態
   * @returns {string} 健康狀態
   * @private
   */
  _calculateHealthStatus () {
    const recentWarnings = this.warnings.filter(
      w => Date.now() - w.timestamp < 300000 // 最近 5 分鐘
    ).length

    if (recentWarnings > 5) return 'critical'
    if (recentWarnings > 2) return 'warning'
    if (this.realtimeStats.averageCreationTime > this.config.creationTimeThreshold) return 'degraded'

    return 'healthy'
  }

  /**
   * 停止監控
   */
  stopMonitoring () {
    this.isMonitoring = false

    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval)
    }

    if (this.performanceAnalysisInterval) {
      clearInterval(this.performanceAnalysisInterval)
    }
  }
}

module.exports = { EventPerformanceMonitor, ErrorCodesPerformanceMonitor }

module.exports = EventPerformanceMonitor
