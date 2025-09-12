/**
 * 錯誤處理系統初始化器
 *
 * 負責功能：
 * - 統一初始化所有錯誤處理組件
 * - 配置生產環境錯誤處理策略
 * - 建立使用者友善的錯誤報告機制
 * - 整合診斷和監控系統
 *
 * 使用情境：
 * - Chrome Extension 啟動時初始化
 * - 錯誤處理系統統一配置
 * - 生產環境錯誤監控設定
 */

const MessageErrorHandler = require('./message-error-handler')
const EventErrorHandler = require('./event-error-handler')
const MessageTracker = require('./message-tracker')
const EventTracker = require('./event-tracker')
const EventPerformanceMonitor = require('./event-performance-monitor')
const { getErrorConfig, getUserErrorMessage, getDiagnosticSuggestion } = require('src/config/error-config')
const { StandardError } = require('src/core/errors/StandardError')

/**
 * 錯誤處理系統管理器
 */
class ErrorSystemManager {
  constructor () {
    this.config = getErrorConfig()
    this.handlers = new Map()
    this.isInitialized = false
    this.userErrorQueue = [] // 使用者錯誤佇列
    this.diagnosticMode = false
  }

  /**
   * 初始化錯誤處理系統
   */
  async initialize (eventBus) {
    if (this.isInitialized) {
      // eslint-disable-next-line no-console
      console.warn('[ErrorSystemManager] System already initialized')
      return
    }

    try {
      console.log('[ErrorSystemManager] Initializing error handling system...')

      // 1. 初始化核心錯誤處理器
      await this._initializeErrorHandlers(eventBus)

      // 2. 初始化監控和追蹤系統
      await this._initializeMonitoring(eventBus)

      // 3. 設定全域錯誤捕獲
      this._setupGlobalErrorHandling()

      // 4. 設定使用者錯誤處理
      this._setupUserErrorHandling()

      // 5. 註冊清理機制
      this._setupCleanupMechanisms()

      this.isInitialized = true
      console.log('[ErrorSystemManager] Error handling system initialized successfully')

      // 發送系統就緒事件
      eventBus.emit('ERROR_SYSTEM.INITIALIZED', {
        timestamp: Date.now(),
        config: this.config
      })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[ErrorSystemManager] Failed to initialize error handling system:', error)
      throw error
    }
  }

  /**
   * 初始化錯誤處理器
   */
  async _initializeErrorHandlers (eventBus) {
    // 1. 訊息錯誤處理器
    const messageErrorHandler = new MessageErrorHandler()
    await messageErrorHandler.init()
    eventBus.addHandler('MESSAGE.ERROR', messageErrorHandler)
    eventBus.addHandler('MESSAGE.UNKNOWN_TYPE', messageErrorHandler)
    eventBus.addHandler('MESSAGE.ROUTING_ERROR', messageErrorHandler)
    this.handlers.set('messageError', messageErrorHandler)

    // 2. 事件錯誤處理器
    const eventErrorHandler = new EventErrorHandler()
    await eventErrorHandler.init()
    eventBus.addHandler('ERROR.SYSTEM', eventErrorHandler)
    eventBus.addHandler('ERROR.HANDLER', eventErrorHandler)
    eventBus.addHandler('ERROR.CIRCUIT_BREAKER', eventErrorHandler)
    this.handlers.set('eventError', eventErrorHandler)

    console.log('[ErrorSystemManager] Error handlers initialized')
  }

  /**
   * 初始化監控和追蹤系統
   */
  async _initializeMonitoring (eventBus) {
    // 1. 訊息追蹤器
    const messageTracker = new MessageTracker()
    await messageTracker.init()
    eventBus.addHandler('MESSAGE.SENT', messageTracker)
    eventBus.addHandler('MESSAGE.RECEIVED', messageTracker)
    eventBus.addHandler('MESSAGE.PROCESSED', messageTracker)
    eventBus.addHandler('MESSAGE.FAILED', messageTracker)
    this.handlers.set('messageTracker', messageTracker)

    // 2. 事件追蹤器
    const eventTracker = new EventTracker(this.config.tracking)
    await eventTracker.init()
    // 監聽所有事件（通過萬用字元或事件總線配置）
    eventBus.addGlobalHandler(eventTracker)
    this.handlers.set('eventTracker', eventTracker)

    // 3. 效能監控器
    const performanceMonitor = new EventPerformanceMonitor(this.config.performance)
    await performanceMonitor.init()
    eventBus.addGlobalHandler(performanceMonitor)
    this.handlers.set('performanceMonitor', performanceMonitor)

    console.log('[ErrorSystemManager] Monitoring systems initialized')
  }

  /**
   * 設定全域錯誤捕獲
   */
  _setupGlobalErrorHandling () {
    // Chrome Extension 全域錯誤處理
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onStartup.addListener(() => {
        this._logSystemEvent('Chrome Extension startup')
      })

      chrome.runtime.onSuspend.addListener(() => {
        this._logSystemEvent('Chrome Extension suspend')
        this._performCleanup()
      })
    }

    // JavaScript 全域錯誤處理
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this._handleGlobalError(event.error, 'JavaScript Error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        })
      })

      window.addEventListener('unhandledrejection', (event) => {
        this._handleGlobalError(event.reason, 'Unhandled Promise Rejection', {
          promise: event.promise
        })
      })
    }

    // Node.js 環境錯誤處理（用於測試）
    if (typeof process !== 'undefined') {
      process.on('uncaughtException', (error) => {
        this._handleGlobalError(error, 'Uncaught Exception')
      })

      process.on('unhandledRejection', (reason, promise) => {
        this._handleGlobalError(reason, 'Unhandled Rejection', { promise })
      })
    }
  }

  /**
   * 設定使用者錯誤處理
   */
  _setupUserErrorHandling () {
    // 監聽錯誤事件並轉換為使用者友善訊息
    const eventTracker = this.handlers.get('eventTracker')
    if (eventTracker && eventTracker.eventBus) {
      eventTracker.eventBus.on('ERROR.*', (event) => {
        this._handleUserError(event)
      })

      eventTracker.eventBus.on('MESSAGE.ERROR', (event) => {
        this._handleUserError(event)
      })
    }
  }

  /**
   * 處理全域錯誤
   */
  _handleGlobalError (error, type, context = {}) {
    const errorData = {
      error: error instanceof Error ? error : new StandardError('UNKNOWN_ERROR', String(error, {
          "category": "general"
      })),
      type,
      context,
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown'
    }

    // 記錄到事件追蹤器
    const eventTracker = this.handlers.get('eventTracker')
    if (eventTracker) {
      eventTracker.recordEvent({
        type: 'ERROR.GLOBAL',
        data: errorData,
        priority: 0, // 最高優先級
        timestamp: Date.now()
      })
    }

    // 如果是生產環境，發送使用者友善訊息
    if (this.config.userNotification.enableDiagnosticSuggestions) {
      this._queueUserError('SYSTEM_ERROR', errorData)
    }

    // eslint-disable-next-line no-console
    console.error(`[ErrorSystemManager] Global ${type}:`, error)
  }

  /**
   * 處理使用者錯誤
   */
  _handleUserError (event) {
    // 提取錯誤類型
    const errorType = this._extractErrorType(event)
    const userMessage = getUserErrorMessage(errorType, event.data?.message)

    // 加入使用者錯誤佇列
    this._queueUserError(errorType, {
      ...userMessage,
      originalEvent: event,
      timestamp: Date.now()
    })
  }

  /**
   * 將錯誤加入使用者佇列
   */
  _queueUserError (errorType, errorData) {
    const maxQueueSize = 50 // 限制佇列大小

    this.userErrorQueue.push({
      id: Date.now() + Math.random(),
      type: errorType,
      data: errorData,
      timestamp: Date.now(),
      displayed: false
    })

    // 保持佇列大小
    if (this.userErrorQueue.length > maxQueueSize) {
      this.userErrorQueue = this.userErrorQueue.slice(-maxQueueSize)
    }

    // 如果有使用者介面，觸發顯示
    this._notifyUserInterface()
  }

  /**
   * 通知使用者介面
   */
  _notifyUserInterface () {
    // 透過 Chrome Extension 訊息系統通知 Popup
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      const unDisplayedErrors = this.userErrorQueue.filter(e => !e.displayed)
      if (unDisplayedErrors.length > 0) {
        chrome.runtime.sendMessage({
          type: 'USER_ERROR_NOTIFICATION',
          errors: unDisplayedErrors
        }).catch(() => {
          // Popup 可能未開啟，忽略錯誤
        })
      }
    }
  }

  /**
   * 提取錯誤類型
   */
  _extractErrorType (event) {
    if (!event || !event.type) return 'UNKNOWN_ERROR'

    // 訊息錯誤對應
    if (event.type.includes('MESSAGE.UNKNOWN_TYPE')) return 'MESSAGE_UNKNOWN_TYPE'
    if (event.type.includes('MESSAGE.ROUTING_ERROR')) return 'MESSAGE_ROUTING_ERROR'

    // 提取錯誤對應
    if (event.type.includes('EXTRACTION') && event.data?.error) {
      if (event.data.error.includes('not ready')) return 'EXTRACTION_PAGE_NOT_READY'
      if (event.data.error.includes('no data')) return 'EXTRACTION_NO_DATA'
      if (event.data.error.includes('access denied')) return 'EXTRACTION_ACCESS_DENIED'
    }

    // 儲存錯誤對應
    if (event.type.includes('STORAGE')) {
      if (event.data?.error?.includes('quota')) return 'STORAGE_QUOTA_EXCEEDED'
      if (event.data?.error?.includes('corrupted')) return 'STORAGE_DATA_CORRUPTED'
      return 'STORAGE_ACCESS_ERROR'
    }

    return 'UNKNOWN_ERROR'
  }

  /**
   * 設定清理機制
   */
  _setupCleanupMechanisms () {
    // 定期清理過期資料
    setInterval(() => {
      this._performCleanup()
    }, 60000 * 60) // 每小時執行一次
  }

  /**
   * 執行清理
   */
  _performCleanup () {
    const now = Date.now()

    // 清理過期的使用者錯誤
    const retentionTime = this.config.userNotification.maxUserErrorHistoryDays * 24 * 60 * 60 * 1000
    this.userErrorQueue = this.userErrorQueue.filter(error =>
      (now - error.timestamp) < retentionTime
    )

    // 通知各處理器執行清理
    this.handlers.forEach(handler => {
      if (typeof handler.cleanup === 'function') {
        try {
          handler.cleanup()
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('[ErrorSystemManager] Cleanup failed for handler:', error)
        }
      }
    })
  }

  /**
   * 記錄系統事件
   */
  _logSystemEvent (message) {
    const eventTracker = this.handlers.get('eventTracker')
    if (eventTracker) {
      eventTracker.recordEvent({
        type: 'SYSTEM.EVENT',
        data: { message },
        timestamp: Date.now()
      })
    }
  }

  /**
   * 取得使用者錯誤佇列
   */
  getUserErrors (onlyUnDisplayed = false) {
    return this.userErrorQueue.filter(error =>
      !onlyUnDisplayed || !error.displayed
    )
  }

  /**
   * 標記錯誤為已顯示
   */
  markErrorAsDisplayed (errorId) {
    const error = this.userErrorQueue.find(e => e.id === errorId)
    if (error) {
      error.displayed = true
    }
  }

  /**
   * 啟用診斷模式
   */
  enableDiagnosticMode () {
    this.diagnosticMode = true
    this.handlers.forEach(handler => {
      if (typeof handler.enableDiagnosticMode === 'function') {
        handler.enableDiagnosticMode()
      }
    })
    console.log('[ErrorSystemManager] Diagnostic mode enabled')
  }

  /**
   * 停用診斷模式
   */
  disableDiagnosticMode () {
    this.diagnosticMode = false
    this.handlers.forEach(handler => {
      if (typeof handler.disableDiagnosticMode === 'function') {
        handler.disableDiagnosticMode()
      }
    })
    console.log('[ErrorSystemManager] Diagnostic mode disabled')
  }

  /**
   * 匯出診斷報告
   */
  async exportDiagnosticReport () {
    const report = {
      timestamp: Date.now(),
      config: this.config,
      userErrors: this.userErrorQueue,
      handlerReports: {}
    }

    // 收集各處理器的報告
    for (const [name, handler] of this.handlers) {
      if (typeof handler.generateReport === 'function') {
        try {
          report.handlerReports[name] = await handler.generateReport()
        } catch (error) {
          report.handlerReports[name] = { error: error.message }
        }
      }
    }

    return report
  }

  /**
   * 銷毀錯誤處理系統
   */
  async destroy () {
    if (!this.isInitialized) return

    console.log('[ErrorSystemManager] Destroying error handling system...')

    // 清理所有處理器
    for (const handler of this.handlers.values()) {
      if (typeof handler.destroy === 'function') {
        try {
          await handler.destroy()
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('[ErrorSystemManager] Handler cleanup failed:', error)
        }
      }
    }

    this.handlers.clear()
    this.userErrorQueue = []
    this.isInitialized = false

    console.log('[ErrorSystemManager] Error handling system destroyed')
  }
}

module.exports = ErrorSystemManager
