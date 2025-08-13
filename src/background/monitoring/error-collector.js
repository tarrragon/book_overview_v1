/**
 * 錯誤收集器
 *
 * 負責功能：
 * - 收集和分類系統中的各類錯誤和異常
 * - 提供統一的錯誤記錄和報告介面
 * - 實現錯誤的持久化儲存和檢索
 * - 支援錯誤統計分析和趨勢監控
 *
 * 設計考量：
 * - 基於 BaseModule 實現標準生命週期管理
 * - 支援多種錯誤類型和嚴重程度分級
 * - 實現錯誤去重和聚合功能
 * - 提供錯誤報告的匯出和分析功能
 */

const BaseModule = require('../lifecycle/base-module')
const {
  SYSTEM_EVENTS,
  EVENT_PRIORITIES,
  LIMITS,
  STORAGE_KEYS
} = require('../constants/module-constants')

class ErrorCollector extends BaseModule {
  constructor (dependencies = {}) {
    super(dependencies)

    // 錯誤分類定義
    this.errorCategories = {
      SYSTEM: 'system', // 系統級錯誤
      MODULE: 'module', // 模組錯誤
      API: 'api', // API 調用錯誤
      CONTENT_SCRIPT: 'content', // Content Script 錯誤
      MESSAGE: 'message', // 訊息處理錯誤
      EXTRACTION: 'extraction', // 資料提取錯誤
      STORAGE: 'storage', // 儲存錯誤
      NETWORK: 'network', // 網路錯誤
      UNKNOWN: 'unknown' // 未知錯誤
    }

    // 錯誤嚴重程度
    this.errorSeverity = {
      CRITICAL: 'critical', // 嚴重：系統無法繼續運行
      HIGH: 'high', // 高：主要功能受影響
      MEDIUM: 'medium', // 中：部分功能受影響
      LOW: 'low', // 低：輕微影響
      INFO: 'info' // 資訊：僅供參考
    }

    // 錯誤儲存
    this.errorHistory = []
    this.errorCounts = new Map()
    this.errorPatterns = new Map()
    this.recentErrors = []

    // 配置設定
    this.config = {
      maxHistorySize: LIMITS.MAX_ERROR_HISTORY,
      recentErrorsSize: 10,
      persistErrors: true,
      enablePatternDetection: true,
      enableDeduplication: true,
      reportInterval: 300000 // 5分鐘
    }

    // 統計資料
    this.stats = {
      totalErrors: 0,
      errorsByCategory: new Map(),
      errorsBySeverity: new Map(),
      duplicateErrors: 0,
      patternsDetected: 0,
      lastReportTime: null
    }

    // 多語言支援
    this.i18nManager = dependencies.i18nManager || null
  }

  /**
   * 初始化錯誤收集器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    if (this.i18nManager) {
      this.logger.log(this.i18nManager.t('modules.operations.initialize', { moduleName: this.moduleName }))
    } else {
      this.logger.log('🚨 初始化錯誤收集器')
    }

    // 初始化錯誤統計
    this.initializeErrorStats()

    // 載入持久化的錯誤資料
    if (this.config.persistErrors) {
      await this.loadPersistedErrors()
    }

    // 設定全域錯誤處理器
    await this.setupGlobalErrorHandlers()

    this.logger.log('✅ 錯誤收集器初始化完成')
  }

  /**
   * 啟動錯誤收集器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStart () {
    this.logger.log('▶️ 啟動錯誤收集器')

    // 註冊錯誤事件監聽器
    await this.registerErrorListeners()

    // 開始定期錯誤報告
    this.startPeriodicReporting()

    this.logger.log('✅ 錯誤收集器啟動完成')
  }

  /**
   * 停止錯誤收集器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStop () {
    this.logger.log('⏹️ 停止錯誤收集器')

    // 停止定期報告
    this.stopPeriodicReporting()

    // 取消註冊錯誤事件監聽器
    await this.unregisterErrorListeners()

    // 保存錯誤資料
    if (this.config.persistErrors) {
      await this.persistErrors()
    }

    this.logger.log('✅ 錯誤收集器停止完成')
  }

  /**
   * 初始化錯誤統計
   * @private
   */
  initializeErrorStats () {
    // 初始化分類統計
    for (const category of Object.values(this.errorCategories)) {
      this.stats.errorsByCategory.set(category, 0)
    }

    // 初始化嚴重程度統計
    for (const severity of Object.values(this.errorSeverity)) {
      this.stats.errorsBySeverity.set(severity, 0)
    }
  }

  /**
   * 設定全域錯誤處理器
   * @returns {Promise<void>}
   * @private
   */
  async setupGlobalErrorHandlers () {
    try {
      // Service Worker 全域錯誤處理
      if (typeof self !== 'undefined') {
        self.addEventListener('error', (event) => {
          this.collectError({
            category: this.errorCategories.SYSTEM,
            severity: this.errorSeverity.HIGH,
            message: event.message || '全域錯誤',
            error: event.error,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            source: 'global_error_handler'
          })
        })

        self.addEventListener('unhandledrejection', (event) => {
          this.collectError({
            category: this.errorCategories.SYSTEM,
            severity: this.errorSeverity.HIGH,
            message: '未處理的 Promise 拒絕',
            error: event.reason,
            source: 'unhandled_rejection'
          })
        })
      }

      this.logger.log('🔧 全域錯誤處理器設定完成')
    } catch (error) {
      this.logger.error('❌ 設定全域錯誤處理器失敗:', error)
    }
  }

  /**
   * 註冊錯誤事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async registerErrorListeners () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 未初始化，跳過錯誤事件監聽器設定')
      return
    }

    try {
      // 系統錯誤事件
      this.systemErrorListenerId = this.eventBus.on(SYSTEM_EVENTS.ERROR,
        (event) => this.handleSystemError(event.data),
        { priority: EVENT_PRIORITIES.URGENT }
      )

      // 模組錯誤事件
      this.moduleErrorListenerId = this.eventBus.on('MODULE.ERROR',
        (event) => this.handleModuleError(event.data),
        { priority: EVENT_PRIORITIES.HIGH }
      )

      // Content Script 錯誤事件
      this.contentErrorListenerId = this.eventBus.on('CONTENT.SCRIPT.ERROR',
        (event) => this.handleContentScriptError(event.data),
        { priority: EVENT_PRIORITIES.HIGH }
      )

      // 提取錯誤事件
      this.extractionErrorListenerId = this.eventBus.on('EXTRACTION.ERROR',
        (event) => this.handleExtractionError(event.data),
        { priority: EVENT_PRIORITIES.HIGH }
      )

      // 訊息錯誤事件
      this.messageErrorListenerId = this.eventBus.on('MESSAGE.ERROR',
        (event) => this.handleMessageError(event.data),
        { priority: EVENT_PRIORITIES.NORMAL }
      )

      this.logger.log('📝 錯誤事件監聽器註冊完成')
    } catch (error) {
      this.logger.error('❌ 註冊錯誤事件監聽器失敗:', error)
    }
  }

  /**
   * 取消註冊錯誤事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async unregisterErrorListeners () {
    if (!this.eventBus) {
      return
    }

    try {
      const listeners = [
        { event: SYSTEM_EVENTS.ERROR, id: this.systemErrorListenerId },
        { event: 'MODULE.ERROR', id: this.moduleErrorListenerId },
        { event: 'CONTENT.SCRIPT.ERROR', id: this.contentErrorListenerId },
        { event: 'EXTRACTION.ERROR', id: this.extractionErrorListenerId },
        { event: 'MESSAGE.ERROR', id: this.messageErrorListenerId }
      ]

      for (const listener of listeners) {
        if (listener.id) {
          this.eventBus.off(listener.event, listener.id)
        }
      }

      this.logger.log('🔄 錯誤事件監聽器取消註冊完成')
    } catch (error) {
      this.logger.error('❌ 取消註冊錯誤事件監聽器失敗:', error)
    }
  }

  /**
   * 收集錯誤
   * @param {Object} errorInfo - 錯誤資訊
   * @returns {Promise<string>} 錯誤 ID
   */
  async collectError (errorInfo) {
    try {
      // 生成錯誤 ID
      const errorId = this.generateErrorId(errorInfo)

      // 建立錯誤記錄
      const errorRecord = {
        id: errorId,
        timestamp: Date.now(),
        category: errorInfo.category || this.errorCategories.UNKNOWN,
        severity: errorInfo.severity || this.errorSeverity.MEDIUM,
        message: errorInfo.message || '未知錯誤',
        error: this.sanitizeError(errorInfo.error),
        source: errorInfo.source || 'unknown',
        context: errorInfo.context || {},
        stack: errorInfo.error?.stack || null,
        userAgent: navigator.userAgent || null,
        url: errorInfo.url || null,
        count: 1
      }

      // 檢查是否為重複錯誤
      if (this.config.enableDeduplication) {
        const existingError = this.findDuplicateError(errorRecord)
        if (existingError) {
          existingError.count++
          existingError.lastOccurrence = errorRecord.timestamp
          this.stats.duplicateErrors++

          this.logger.log(`🔄 重複錯誤更新: ${errorId} (總計: ${existingError.count})`)
          return existingError.id
        }
      }

      // 新增錯誤到歷史記錄
      this.errorHistory.push(errorRecord)

      // 限制歷史記錄大小
      if (this.errorHistory.length > this.config.maxHistorySize) {
        this.errorHistory.shift()
      }

      // 更新最近錯誤列表
      this.recentErrors.unshift(errorRecord)
      if (this.recentErrors.length > this.config.recentErrorsSize) {
        this.recentErrors.pop()
      }

      // 更新統計
      this.updateErrorStats(errorRecord)

      // 檢測錯誤模式
      if (this.config.enablePatternDetection) {
        await this.detectErrorPatterns(errorRecord)
      }

      // 記錄錯誤
      this.logError(errorRecord)

      // 觸發錯誤收集事件
      if (this.eventBus) {
        await this.eventBus.emit('ERROR.COLLECTED', {
          errorId,
          category: errorRecord.category,
          severity: errorRecord.severity,
          message: errorRecord.message,
          timestamp: errorRecord.timestamp
        })
      }

      return errorId
    } catch (error) {
      // 避免錯誤收集器本身的錯誤造成無限循環
      this.logger.error('❌ 錯誤收集失敗:', error)
      return null
    }
  }

  /**
   * 處理系統錯誤事件
   * @param {Object} data - 錯誤資料
   * @returns {Promise<void>}
   * @private
   */
  async handleSystemError (data) {
    await this.collectError({
      category: this.errorCategories.SYSTEM,
      severity: this.errorSeverity.CRITICAL,
      message: data.message || '系統錯誤',
      error: data.error,
      source: 'system_event',
      context: data.context
    })
  }

  /**
   * 處理模組錯誤事件
   * @param {Object} data - 錯誤資料
   * @returns {Promise<void>}
   * @private
   */
  async handleModuleError (data) {
    await this.collectError({
      category: this.errorCategories.MODULE,
      severity: this.errorSeverity.HIGH,
      message: data.message || '模組錯誤',
      error: data.error,
      source: `module:${data.moduleName || 'unknown'}`,
      context: data.context
    })
  }

  /**
   * 處理 Content Script 錯誤事件
   * @param {Object} data - 錯誤資料
   * @returns {Promise<void>}
   * @private
   */
  async handleContentScriptError (data) {
    await this.collectError({
      category: this.errorCategories.CONTENT_SCRIPT,
      severity: this.errorSeverity.MEDIUM,
      message: data.message || 'Content Script 錯誤',
      error: data.error,
      source: `content_script:tab_${data.tabId || 'unknown'}`,
      context: { tabId: data.tabId, ...data.context }
    })
  }

  /**
   * 處理提取錯誤事件
   * @param {Object} data - 錯誤資料
   * @returns {Promise<void>}
   * @private
   */
  async handleExtractionError (data) {
    await this.collectError({
      category: this.errorCategories.EXTRACTION,
      severity: this.errorSeverity.HIGH,
      message: data.message || '資料提取錯誤',
      error: data.error,
      source: 'extraction',
      context: data.context
    })
  }

  /**
   * 處理訊息錯誤事件
   * @param {Object} data - 錯誤資料
   * @returns {Promise<void>}
   * @private
   */
  async handleMessageError (data) {
    await this.collectError({
      category: this.errorCategories.MESSAGE,
      severity: this.errorSeverity.MEDIUM,
      message: data.message || '訊息處理錯誤',
      error: data.error,
      source: `message:${data.messageType || 'unknown'}`,
      context: data.context
    })
  }

  /**
   * 生成錯誤 ID
   * @param {Object} errorInfo - 錯誤資訊
   * @returns {string} 錯誤 ID
   * @private
   */
  generateErrorId (errorInfo) {
    const hash = this.simpleHash(
      (errorInfo.message || '') +
      (errorInfo.source || '') +
      (errorInfo.error?.stack?.split('\n')[0] || '')
    )
    return `error_${Date.now()}_${hash}`
  }

  /**
   * 簡單雜湊函數
   * @param {string} str - 輸入字串
   * @returns {string} 雜湊值
   * @private
   */
  simpleHash (str) {
    let hash = 0
    if (str.length === 0) return hash.toString()

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16)
  }

  /**
   * 清理錯誤物件
   * @param {Error|string|Object} error - 錯誤物件
   * @returns {Object} 清理後的錯誤資訊
   * @private
   */
  sanitizeError (error) {
    if (!error) return null

    if (typeof error === 'string') {
      return { message: error }
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    }

    if (typeof error === 'object') {
      return {
        message: error.message || '未知錯誤',
        name: error.name || 'UnknownError',
        stack: error.stack || null
      }
    }

    return { message: String(error) }
  }

  /**
   * 尋找重複錯誤
   * @param {Object} errorRecord - 錯誤記錄
   * @returns {Object|null} 現有的重複錯誤
   * @private
   */
  findDuplicateError (errorRecord) {
    return this.errorHistory.find(existing =>
      existing.message === errorRecord.message &&
      existing.source === errorRecord.source &&
      existing.category === errorRecord.category
    )
  }

  /**
   * 更新錯誤統計
   * @param {Object} errorRecord - 錯誤記錄
   * @private
   */
  updateErrorStats (errorRecord) {
    this.stats.totalErrors++

    // 更新分類統計
    const categoryCount = this.stats.errorsByCategory.get(errorRecord.category) || 0
    this.stats.errorsByCategory.set(errorRecord.category, categoryCount + 1)

    // 更新嚴重程度統計
    const severityCount = this.stats.errorsBySeverity.get(errorRecord.severity) || 0
    this.stats.errorsBySeverity.set(errorRecord.severity, severityCount + 1)
  }

  /**
   * 檢測錯誤模式
   * @param {Object} errorRecord - 錯誤記錄
   * @returns {Promise<void>}
   * @private
   */
  async detectErrorPatterns (errorRecord) {
    try {
      const patternKey = `${errorRecord.category}:${errorRecord.source}`
      const pattern = this.errorPatterns.get(patternKey) || {
        occurrences: [],
        detected: false
      }

      pattern.occurrences.push(errorRecord.timestamp)

      // 保留最近一小時的錯誤時間戳
      const oneHourAgo = Date.now() - 3600000
      pattern.occurrences = pattern.occurrences.filter(time => time > oneHourAgo)

      // 檢測是否為錯誤模式（一小時內超過5次）
      if (pattern.occurrences.length >= 5 && !pattern.detected) {
        pattern.detected = true
        this.stats.patternsDetected++

        this.logger.warn(`🔍 檢測到錯誤模式: ${patternKey} (${pattern.occurrences.length} 次/小時)`)

        // 觸發模式檢測事件
        if (this.eventBus) {
          await this.eventBus.emit('ERROR.PATTERN.DETECTED', {
            pattern: patternKey,
            category: errorRecord.category,
            source: errorRecord.source,
            occurrences: pattern.occurrences.length,
            timeWindow: '1hour'
          })
        }
      }

      this.errorPatterns.set(patternKey, pattern)
    } catch (error) {
      this.logger.error('❌ 檢測錯誤模式失敗:', error)
    }
  }

  /**
   * 記錄錯誤
   * @param {Object} errorRecord - 錯誤記錄
   * @private
   */
  logError (errorRecord) {
    const logLevel = this.getLogLevelBySeverity(errorRecord.severity)
    const logMessage = `🚨 [${errorRecord.category.toUpperCase()}] ${errorRecord.message}`

    switch (logLevel) {
      case 'error':
        this.logger.error(logMessage, errorRecord.error)
        break
      case 'warn':
        this.logger.warn(logMessage)
        break
      default:
        this.logger.log(logMessage)
    }
  }

  /**
   * 根據嚴重程度獲取日誌等級
   * @param {string} severity - 嚴重程度
   * @returns {string} 日誌等級
   * @private
   */
  getLogLevelBySeverity (severity) {
    switch (severity) {
      case this.errorSeverity.CRITICAL:
      case this.errorSeverity.HIGH:
        return 'error'
      case this.errorSeverity.MEDIUM:
        return 'warn'
      default:
        return 'log'
    }
  }

  /**
   * 開始定期錯誤報告
   * @private
   */
  startPeriodicReporting () {
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval)
    }

    this.reportingInterval = setInterval(async () => {
      await this.generatePeriodicReport()
    }, this.config.reportInterval)

    this.logger.log('📊 定期錯誤報告已啟動')
  }

  /**
   * 停止定期錯誤報告
   * @private
   */
  stopPeriodicReporting () {
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval)
      this.reportingInterval = null
    }

    this.logger.log('📊 定期錯誤報告已停止')
  }

  /**
   * 生成定期報告
   * @returns {Promise<void>}
   * @private
   */
  async generatePeriodicReport () {
    try {
      const report = this.generateErrorReport()

      this.logger.log('📈 錯誤統計報告:', report)

      // 觸發報告事件
      if (this.eventBus) {
        await this.eventBus.emit('ERROR.REPORT.GENERATED', {
          report,
          timestamp: Date.now()
        })
      }

      this.stats.lastReportTime = Date.now()
    } catch (error) {
      this.logger.error('❌ 生成定期報告失敗:', error)
    }
  }

  /**
   * 載入持久化的錯誤資料
   * @returns {Promise<void>}
   * @private
   */
  async loadPersistedErrors () {
    try {
      const data = await chrome.storage.local.get('error_history')
      if (data.error_history && Array.isArray(data.error_history)) {
        this.errorHistory = data.error_history.slice(0, this.config.maxHistorySize)

        // 重建統計
        this.stats.totalErrors = this.errorHistory.length
        for (const error of this.errorHistory) {
          this.updateErrorStats(error)
        }

        this.logger.log(`📚 載入了 ${this.errorHistory.length} 個持久化錯誤記錄`)
      }
    } catch (error) {
      this.logger.error('❌ 載入持久化錯誤資料失敗:', error)
    }
  }

  /**
   * 持久化錯誤資料
   * @returns {Promise<void>}
   * @private
   */
  async persistErrors () {
    try {
      await chrome.storage.local.set({
        error_history: this.errorHistory.slice(-this.config.maxHistorySize)
      })

      this.logger.log(`💾 錯誤資料已持久化 (${this.errorHistory.length} 個記錄)`)
    } catch (error) {
      this.logger.error('❌ 持久化錯誤資料失敗:', error)
    }
  }

  /**
   * 生成錯誤報告
   * @param {Object} options - 報告選項
   * @returns {Object} 錯誤報告
   */
  generateErrorReport (options = {}) {
    const timeRange = options.timeRange || 3600000 // 預設1小時
    const cutoffTime = Date.now() - timeRange

    const recentErrors = this.errorHistory.filter(error => error.timestamp > cutoffTime)

    const categoryStats = new Map()
    const severityStats = new Map()

    for (const error of recentErrors) {
      // 分類統計
      const categoryCount = categoryStats.get(error.category) || 0
      categoryStats.set(error.category, categoryCount + 1)

      // 嚴重程度統計
      const severityCount = severityStats.get(error.severity) || 0
      severityStats.set(error.severity, severityCount + 1)
    }

    return {
      summary: {
        totalErrors: this.stats.totalErrors,
        recentErrors: recentErrors.length,
        duplicateErrors: this.stats.duplicateErrors,
        patternsDetected: this.stats.patternsDetected,
        timeRange
      },
      categories: Object.fromEntries(categoryStats),
      severities: Object.fromEntries(severityStats),
      recentErrorSample: this.recentErrors.slice(0, 5),
      errorPatterns: Array.from(this.errorPatterns.entries()).map(([pattern, data]) => ({
        pattern,
        occurrences: data.occurrences.length,
        detected: data.detected
      })),
      timestamp: Date.now()
    }
  }

  /**
   * 獲取錯誤統計
   * @returns {Object} 錯誤統計
   */
  getErrorStats () {
    return {
      totalErrors: this.stats.totalErrors,
      errorsByCategory: Object.fromEntries(this.stats.errorsByCategory),
      errorsBySeverity: Object.fromEntries(this.stats.errorsBySeverity),
      duplicateErrors: this.stats.duplicateErrors,
      patternsDetected: this.stats.patternsDetected,
      recentErrorsCount: this.recentErrors.length,
      historySize: this.errorHistory.length,
      lastReportTime: this.stats.lastReportTime
    }
  }

  /**
   * 獲取最近錯誤
   * @param {number} limit - 限制數量
   * @returns {Array} 最近錯誤列表
   */
  getRecentErrors (limit = 10) {
    return this.recentErrors.slice(0, limit)
  }

  /**
   * 清理錯誤歷史
   * @param {Object} options - 清理選項
   * @returns {Promise<number>} 清理的錯誤數量
   */
  async clearErrorHistory (options = {}) {
    const beforeCount = this.errorHistory.length

    if (options.olderThan) {
      const cutoffTime = Date.now() - options.olderThan
      this.errorHistory = this.errorHistory.filter(error => error.timestamp > cutoffTime)
    } else if (options.category) {
      this.errorHistory = this.errorHistory.filter(error => error.category !== options.category)
    } else {
      this.errorHistory = []
      this.recentErrors = []
      this.errorPatterns.clear()
    }

    const clearedCount = beforeCount - this.errorHistory.length

    // 重建統計
    this.initializeErrorStats()
    for (const error of this.errorHistory) {
      this.updateErrorStats(error)
    }

    // 持久化變更
    if (this.config.persistErrors) {
      await this.persistErrors()
    }

    this.logger.log(`🧹 清理了 ${clearedCount} 個錯誤記錄`)
    return clearedCount
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    const recentErrors = this.errorHistory.filter(error =>
      error.timestamp > Date.now() - 3600000 // 最近一小時
    )

    const criticalErrors = recentErrors.filter(error =>
      error.severity === this.errorSeverity.CRITICAL
    ).length

    const highErrors = recentErrors.filter(error =>
      error.severity === this.errorSeverity.HIGH
    ).length

    return {
      totalErrors: this.stats.totalErrors,
      recentErrorsCount: recentErrors.length,
      criticalErrors,
      highErrors,
      patternsDetected: this.stats.patternsDetected,
      duplicateRate: this.stats.totalErrors > 0
        ? (this.stats.duplicateErrors / this.stats.totalErrors).toFixed(3)
        : '0',
      health: (criticalErrors > 0 || highErrors > 5) ? 'degraded' : 'healthy'
    }
  }
}

module.exports = ErrorCollector
