/**
 * @fileoverview Error Handling Utils - 錯誤處理工具
 * @version v1.0.0
 * @since 2025-08-16
 *
 * 負責功能：
 * - 錯誤分類和嚴重性評估
 * - 錯誤訊息格式化和清理
 * - 錯誤記錄、統計和模式檢測
 * - Content Script 特定錯誤處理
 * - 重試機制和錯誤恢復策略
 *
 * 設計考量：
 * - 全面的錯誤分類系統
 * - 智能重試和恢復機制
 * - 使用者友善的錯誤訊息
 * - 效能優化的錯誤記錄
 *
 * 使用情境：
 * - DOM 操作錯誤處理
 * - Chrome Extension API 錯誤
 * - 網路請求錯誤恢復
 * - 資料驗證和清理錯誤
 */

/**
 * 錯誤處理工具類
 */
const { StandardError } = require('src/core/errors/StandardError')

class ErrorHandlingUtils {
  constructor () {
    this.errorHistory = []
    this.maxHistorySize = 100
    this.notificationHandler = null
    this.errorPatterns = new Map()

    // 錯誤分類模式
    this.errorClassificationPatterns = {
      DOM_ERROR: [
        /cannot read propert.*of null/i,
        /cannot read propert.*of undefined/i,
        /queryselector/i,
        /element.*not found/i,
        /node.*not.*element/i,
        /dom.*error/i
      ],
      NETWORK_ERROR: [
        /failed to fetch/i,
        /network.*error/i,
        /timeout/i,
        /connection.*failed/i,
        /xhr.*failed/i
      ],
      VALIDATION_ERROR: [
        /invalid.*format/i,
        /validation.*failed/i,
        /missing.*required/i,
        /invalid.*data/i,
        /schema.*error/i
      ],
      SYSTEM_ERROR: [
        /chrome.*extension.*api/i,
        /permission.*denied/i,
        /extension.*context.*invalidated/i,
        /runtime.*not.*available/i
      ]
    }

    // 嚴重性規則
    this.severityRules = {
      CRITICAL: [
        /system.*crash/i,
        /extension.*context.*invalidated/i,
        /chrome.*runtime.*not.*available/i,
        /chrome.*extension.*api.*not.*available/i
      ],
      HIGH: [
        /failed to fetch/i,
        /network.*error/i,
        /permission.*denied/i
      ],
      MEDIUM: [
        /cannot read propert/i,
        /validation.*failed/i,
        /invalid.*format/i
      ],
      LOW: [
        /warning/i,
        /deprecated/i
      ]
    }
  }

  /**
   * 分類錯誤並評估嚴重性
   * @param {Error|string} error - 錯誤物件或訊息
   * @returns {Object} 錯誤分類資訊
   */
  classifyError (error) {
    if (!error) {
      return {
        category: 'UNKNOWN_ERROR',
        severity: 'LOW',
        recoverable: true,
        suggestions: ['檢查輸入參數']
      }
    }

    const message = typeof error === 'string' ? error : error.message || 'Unknown error'

    // 分類錯誤
    let category = 'UNKNOWN_ERROR'
    for (const [cat, patterns] of Object.entries(this.errorClassificationPatterns)) {
      if (patterns.some(pattern => pattern.test(message))) {
        category = cat
        break
      }
    }

    // 評估嚴重性
    let severity = 'MEDIUM'
    for (const [sev, patterns] of Object.entries(this.severityRules)) {
      if (patterns.some(pattern => pattern.test(message))) {
        severity = sev
        break
      }
    }

    // 判斷可恢復性
    const recoverable = severity !== 'CRITICAL'

    // 提供建議
    const suggestions = this._getSuggestionsByCategory(category)

    return {
      category,
      severity,
      recoverable,
      suggestions
    }
  }

  /**
   * 格式化錯誤資訊
   * @param {Error|string|any} error - 錯誤物件
   * @param {Object} additionalContext - 額外上下文
   * @returns {Object} 格式化後的錯誤資訊
   */
  formatError (error, additionalContext = {}) {
    const timestamp = Date.now()
    const baseFormat = {
      timestamp,
      context: 'content-script',
      additionalContext
    }

    if (error === null || error === undefined) {
      return {
        message: `Unknown error (${error})`,
        type: typeof error,
        stack: null,
        ...baseFormat
      }
    }

    if (typeof error === 'string') {
      return {
        message: this._sanitizeMessage(error),
        type: 'String',
        stack: null,
        ...baseFormat
      }
    }

    if (error instanceof Error) {
      const formatted = {
        message: this._sanitizeMessage(error.message),
        type: error.constructor.name,
        stack: error.stack || null,
        ...baseFormat
      }

      // 將額外上下文的屬性直接添加到主物件
      Object.assign(formatted, additionalContext)

      return formatted
    }

    // 處理其他類型
    return {
      message: `Unexpected error type: ${typeof error}`,
      type: typeof error,
      stack: null,
      ...baseFormat
    }
  }

  /**
   * 記錄錯誤到歷史記錄
   * @param {Error|string} error - 錯誤
   * @param {string} context - 上下文
   * @param {Object} options - 選項
   */
  recordError (error, context = 'UNKNOWN', options = {}) {
    const formatted = this.formatError(error, { context, ...options })
    const classification = this.classifyError(error)

    const record = {
      error: formatted,
      classification,
      context,
      timestamp: formatted.timestamp
    }

    // 添加到歷史記錄
    this.errorHistory.push(record)

    // 限制歷史記錄大小
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift()
    }

    // 更新錯誤模式統計
    this._updateErrorPatterns(formatted.message)

    // 通知嚴重錯誤
    if (classification.severity === 'CRITICAL' && this.notificationHandler) {
      this.notificationHandler({
        type: 'CRITICAL_ERROR',
        error: record,
        requiresImmediateAction: true
      })
    }
  }

  /**
   * 取得錯誤歷史記錄
   * @returns {Array} 錯誤歷史記錄
   */
  getErrorHistory () {
    return [...this.errorHistory]
  }

  /**
   * 取得錯誤統計資訊
   * @returns {Object} 統計資訊
   */
  getErrorStats () {
    if (this.errorHistory.length === 0) {
      return {
        total: 0,
        byCategory: {},
        bySeverity: {},
        recent: 0,
        oldestTimestamp: null,
        newestTimestamp: null
      }
    }

    const now = Date.now()
    const recentThreshold = now - (5 * 60 * 1000) // 5 分鐘前

    const stats = {
      total: this.errorHistory.length,
      byCategory: {},
      bySeverity: {},
      recent: 0,
      oldestTimestamp: this.errorHistory[0].timestamp,
      newestTimestamp: this.errorHistory[this.errorHistory.length - 1].timestamp
    }

    this.errorHistory.forEach(record => {
      const { category, severity } = record.classification

      // 統計分類
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1

      // 統計嚴重性
      stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1

      // 統計最近錯誤
      if (record.timestamp > recentThreshold) {
        stats.recent++
      }
    })

    return stats
  }

  /**
   * 清空錯誤歷史記錄
   */
  clearErrorHistory () {
    this.errorHistory = []
    this.errorPatterns.clear()
  }

  /**
   * 檢測錯誤模式
   * @returns {Object} 錯誤模式分析
   */
  detectErrorPatterns () {
    const repeatedErrors = []
    const messageCount = new Map()

    this.errorHistory.forEach(record => {
      const message = record.error.message
      messageCount.set(message, (messageCount.get(message) || 0) + 1)
    })

    messageCount.forEach((count, message) => {
      if (count > 1) {
        repeatedErrors.push({ message, count })
      }
    })

    return {
      repeatedErrors: repeatedErrors.sort((a, b) => b.count - a.count)
    }
  }

  /**
   * 指數退避重試機制
   * @param {Function} fn - 要重試的函數
   * @param {Object} options - 重試選項
   * @returns {Promise} 執行結果
   */
  async retryWithBackoff (fn, options = {}) {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      shouldRetry = () => true
    } = options

    let lastError

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error

        if (attempt === maxRetries || !shouldRetry(error)) {
          throw error
        }

        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

  /**
   * 安全執行 DOM 操作
   * @param {Function} domOperation - DOM 操作函數
   * @param {string} context - 操作上下文
   * @returns {Object} 執行結果
   */
  safelyExecuteDOM (domOperation, context = 'DOM_OPERATION') {
    try {
      const result = domOperation()

      // 檢查結果是否為 null (表示找不到元素)
      if (result === null || result === undefined) {
        const error = new StandardError('RESOURCE_NOT_FOUND', 'DOM element not found', {
          "category": "general"
      })
        this.recordError(error, context)

        return {
          success: false,
          error: this.formatError(error),
          fallbackUsed: true
        }
      }

      return {
        success: true,
        result,
        fallbackUsed: false
      }
    } catch (error) {
      this.recordError(error, context)

      return {
        success: false,
        error: this.formatError(error),
        fallbackUsed: true
      }
    }
  }

  /**
   * 處理 Chrome Extension API 錯誤
   * @param {string} apiName - API 名稱
   * @param {Array} args - API 參數
   * @returns {Object} 處理結果
   */
  handleChromeAPIError (apiName, args = []) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
        const error = new StandardError('UNKNOWN_ERROR', chrome.runtime.lastError.message, {
          "category": "general"
      })
        this.recordError(error, `CHROME_API_${apiName.toUpperCase()}`)

        return {
          success: false,
          error: this.formatError(error)
        }
      }

      return {
        success: true,
        result: null
      }
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      }
    }
  }

  /**
   * 取得使用者友善的錯誤訊息
   * @param {Error|string} error - 錯誤
   * @returns {string} 使用者友善訊息
   */
  getUserFriendlyMessage (error) {
    const classification = this.classifyError(error)

    const friendlyMessages = {
      DOM_ERROR: '資料載入時發生問題，請重新整理頁面後再試',
      NETWORK_ERROR: '網路連線問題，請檢查網路狀態後重試',
      VALIDATION_ERROR: '資料格式有誤，請稍後再試',
      SYSTEM_ERROR: '系統發生問題，請重新載入擴展後再試'
    }

    return friendlyMessages[classification.category] || '發生未知錯誤，請稍後再試'
  }

  /**
   * 處理頁面導航錯誤
   * @param {Error} error - 導航錯誤
   * @param {Object} context - 導航上下文
   * @returns {Object} 處理結果
   */
  handleNavigationError (error, context = {}) {
    this.recordError(error, 'PAGE_NAVIGATION', context)

    return {
      recoveryAction: 'RELOAD_PAGE',
      userMessage: '頁面載入遇到問題，建議重新整理頁面',
      technical: this.formatError(error, context)
    }
  }

  /**
   * 取得錯誤恢復策略
   * @param {Error|string} error - 錯誤
   * @param {string} context - 上下文
   * @returns {Object} 恢復策略
   */
  getRecoveryStrategy (error, context = 'UNKNOWN') {
    const classification = this.classifyError(error)

    const strategies = {
      DOM_ERROR: {
        immediate: ['retry-with-delay', 'use-fallback-selector'],
        longTerm: ['wait-for-page-load', 'check-page-structure'],
        preventive: ['add-element-existence-check', 'implement-observer-pattern']
      },
      NETWORK_ERROR: {
        immediate: ['retry-with-backoff', 'check-connection'],
        longTerm: ['implement-offline-mode', 'cache-responses'],
        preventive: ['add-timeout-handling', 'implement-circuit-breaker']
      },
      VALIDATION_ERROR: {
        immediate: ['use-default-values', 'sanitize-data'],
        longTerm: ['improve-validation-rules', 'add-data-cleaning'],
        preventive: ['implement-schema-validation', 'add-type-checking']
      },
      SYSTEM_ERROR: {
        immediate: ['reload-extension', 'check-permissions'],
        longTerm: ['update-manifest', 'contact-support'],
        preventive: ['add-permission-checks', 'implement-graceful-degradation']
      }
    }

    return strategies[classification.category] || strategies.DOM_ERROR
  }

  /**
   * 嘗試自動恢復
   * @param {Function} operation - 操作函數
   * @param {string} errorType - 錯誤類型
   * @param {Object} options - 恢復選項
   * @returns {Promise} 恢復結果
   */
  async attemptAutoRecovery (operation, errorType, options = {}) {
    const { maxAttempts = 3 } = options

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation()
        return {
          recovered: true,
          result,
          attemptsUsed: attempt
        }
      } catch (error) {
        if (attempt === maxAttempts) {
          return {
            recovered: false,
            finalError: this.formatError(error),
            attemptsUsed: attempt
          }
        }

        // 等待一段時間後重試
        await new Promise(resolve => setTimeout(resolve, attempt * 1000))
      }
    }
  }

  /**
   * 產生錯誤報告
   * @returns {Object} 錯誤報告
   */
  generateErrorReport () {
    const stats = this.getErrorStats()
    const patterns = this.detectErrorPatterns()

    return {
      summary: {
        totalErrors: stats.total,
        timeRange: {
          from: stats.oldestTimestamp,
          to: stats.newestTimestamp
        },
        mostCommonCategory: this._getMostCommonCategory(stats.byCategory),
        criticalErrorsCount: stats.bySeverity.CRITICAL || 0
      },
      details: this.errorHistory.slice(-10), // 最近 10 個錯誤
      recommendations: this._generateRecommendations(stats, patterns),
      systemInfo: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
        timestamp: Date.now()
      }
    }
  }

  /**
   * 設定通知處理器
   * @param {Function} handler - 通知處理函數
   */
  setNotificationHandler (handler) {
    this.notificationHandler = handler
  }

  /**
   * 過濾錯誤記錄
   * @param {Object} filters - 過濾條件
   * @returns {Array} 過濾後的錯誤記錄
   */
  filterErrors (filters = {}) {
    return this.errorHistory.filter(record => {
      // 按分類過濾
      if (filters.category && record.classification.category !== filters.category) {
        return false
      }

      // 按嚴重性過濾
      if (filters.severity && record.classification.severity !== filters.severity) {
        return false
      }

      // 按訊息內容過濾
      if (filters.messageContains && !record.error.message.includes(filters.messageContains)) {
        return false
      }

      // 按時間範圍過濾
      if (filters.timeFrom && record.timestamp < filters.timeFrom) {
        return false
      }

      if (filters.timeTo && record.timestamp > filters.timeTo) {
        return false
      }

      return true
    })
  }

  // ==================
  // 私有輔助方法
  // ==================

  /**
   * 根據分類取得建議
   * @param {string} category - 錯誤分類
   * @returns {Array} 建議列表
   * @private
   */
  _getSuggestionsByCategory (category) {
    const suggestions = {
      DOM_ERROR: ['檢查元素是否存在', '等待頁面完全載入', '使用防禦性選擇器'],
      NETWORK_ERROR: ['檢查網路連線', '實施重試機制', '使用離線模式'],
      VALIDATION_ERROR: ['檢查資料格式', '實施資料清理', '使用預設值'],
      SYSTEM_ERROR: ['檢查擴展權限', '重新載入擴展', '聯繫技術支援'],
      UNKNOWN_ERROR: ['重新載入頁面', '檢查開發者工具', '聯繫技術支援']
    }

    return suggestions[category] || suggestions.UNKNOWN_ERROR
  }

  /**
   * 清理敏感訊息
   * @param {string} message - 訊息
   * @returns {string} 清理後的訊息
   * @private
   */
  _sanitizeMessage (message) {
    if (!message || typeof message !== 'string') {
      return 'Invalid message'
    }

    // 移除可能的敏感資訊
    return message
      .replace(/token[:\s]*[a-zA-Z0-9]{10,}/gi, 'token: [REDACTED]')
      .replace(/password[:\s]*[^\s]{3,}/gi, 'password: [REDACTED]')
      .replace(/key[:\s]*[a-zA-Z0-9]{10,}/gi, 'key: [REDACTED]')
      .replace(/secret[:\s]*[a-zA-Z0-9]{10,}/gi, 'secret: [REDACTED]')
  }

  /**
   * 更新錯誤模式統計
   * @param {string} message - 錯誤訊息
   * @private
   */
  _updateErrorPatterns (message) {
    if (!message) return

    const count = this.errorPatterns.get(message) || 0
    this.errorPatterns.set(message, count + 1)
  }

  /**
   * 取得最常見的錯誤分類
   * @param {Object} categoryStats - 分類統計
   * @returns {string} 最常見分類
   * @private
   */
  _getMostCommonCategory (categoryStats) {
    if (!categoryStats || Object.keys(categoryStats).length === 0) {
      return 'NONE'
    }

    return Object.entries(categoryStats)
      .sort(([, a], [, b]) => b - a)[0][0]
  }

  /**
   * 產生建議
   * @param {Object} stats - 統計資料
   * @param {Object} patterns - 模式分析
   * @returns {Array} 建議列表
   * @private
   */
  _generateRecommendations (stats, patterns) {
    const recommendations = []

    if (stats.total > 10) {
      recommendations.push('考慮實施更好的錯誤預防機制')
    }

    if (stats.bySeverity.CRITICAL > 0) {
      recommendations.push('立即處理嚴重錯誤問題')
    }

    if (patterns.repeatedErrors.length > 0) {
      recommendations.push('修正重複出現的錯誤模式')
    }

    return recommendations
  }
}

// 建立單例實例
const errorHandlingUtils = new ErrorHandlingUtils()

// 匯出靜態方法介面
module.exports = {
  classifyError: (error) => errorHandlingUtils.classifyError(error),
  formatError: (error, context) => errorHandlingUtils.formatError(error, context),
  recordError: (error, context, options) => errorHandlingUtils.recordError(error, context, options),
  getErrorHistory: () => errorHandlingUtils.getErrorHistory(),
  getErrorStats: () => errorHandlingUtils.getErrorStats(),
  clearErrorHistory: () => errorHandlingUtils.clearErrorHistory(),
  detectErrorPatterns: () => errorHandlingUtils.detectErrorPatterns(),
  retryWithBackoff: (fn, options) => errorHandlingUtils.retryWithBackoff(fn, options),
  safelyExecuteDOM: (operation, context) => errorHandlingUtils.safelyExecuteDOM(operation, context),
  handleChromeAPIError: (apiName, args) => errorHandlingUtils.handleChromeAPIError(apiName, args),
  getUserFriendlyMessage: (error) => errorHandlingUtils.getUserFriendlyMessage(error),
  handleNavigationError: (error, context) => errorHandlingUtils.handleNavigationError(error, context),
  getRecoveryStrategy: (error, context) => errorHandlingUtils.getRecoveryStrategy(error, context),
  attemptAutoRecovery: (operation, errorType, options) => errorHandlingUtils.attemptAutoRecovery(operation, errorType, options),
  generateErrorReport: () => errorHandlingUtils.generateErrorReport(),
  setNotificationHandler: (handler) => errorHandlingUtils.setNotificationHandler(handler),
  filterErrors: (filters) => errorHandlingUtils.filterErrors(filters)
}
