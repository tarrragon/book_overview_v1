/**
 * UI處理器基底類別
 * 提供所有UI處理器的共同功能和介面
 *
 * 負責功能：
 * - 提供統一的UI處理器初始化模式
 * - 管理DOM和事件總線的共同依賴
 * - 提供標準化的錯誤處理和統計
 * - 實現UI處理器的生命週期管理
 *
 * 設計考量：
 * - 繼承 EventHandler 提供事件處理基礎
 * - 抽象化共同的初始化和配置邏輯
 * - 提供可擴展的UI操作介面
 * - 統一UI處理器的錯誤處理模式
 */

const EventHandler = require('src/core/event-handler')
const UIEventValidator = require('./ui-event-validator')
const UIDOMManager = require('./ui-dom-manager')

class BaseUIHandler extends EventHandler {
  /**
   * 建構UI處理器基底
   *
   * @param {string} handlerName - 處理器名稱
   * @param {number} priority - 事件處理優先級
   * @param {Object} eventBus - 事件總線實例
   * @param {Object} document - DOM文檔物件
   */
  constructor (handlerName, priority, eventBus, document) {
    super(handlerName, priority)

    this.eventBus = eventBus
    this.document = document
    this.domManager = new UIDOMManager(document)
    this.validator = new UIEventValidator()

    // 初始化共同狀態
    this.initializeCommonState()

    // 初始化共同配置
    this.initializeCommonConfiguration()

    // 初始化共同統計
    this.initializeCommonStatistics()
  }

  /**
   * 取得處理器名稱 (提供 handlerName 別名)
   */
  get handlerName () {
    return this.name
  }

  /**
   * 初始化共同狀態管理
   * 子類別可以覆寫此方法來添加特定狀態
   */
  initializeCommonState () {
    this.activeOperations = new Map()
    this.operationTimers = new Map()
    this.lastActivity = Date.now()
  }

  /**
   * 初始化共同配置
   * 子類別可以覆寫此方法來添加特定配置
   */
  initializeCommonConfiguration () {
    this.config = {
      enabled: true,
      maxOperations: 10,
      defaultTimeout: 5000,
      enableLogging: true,
      enableStatistics: true
    }
  }

  /**
   * 初始化共同統計
   * 子類別可以覆寫此方法來添加特定統計
   */
  initializeCommonStatistics () {
    this.statistics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageProcessingTime: 0,
      lastOperationTime: null,
      operationHistory: []
    }

    // 初始化錯誤統計
    this.errorStats = {
      errorCount: 0,
      lastError: null,
      errorHistory: []
    }
  }

  /**
   * 驗證事件資料的基本結構
   *
   * @param {Object} event - 事件物件
   * @returns {Object} 驗證結果
   */
  validateEventData (event) {
    if (!event || !event.data) {
      return {
        isValid: false,
        error: 'Event data is required',
        details: { event }
      }
    }

    const { data, flowId, timestamp } = event

    if (!flowId) {
      return {
        isValid: false,
        error: 'Flow ID is required',
        details: { event }
      }
    }

    return {
      isValid: true,
      data: { data, flowId, timestamp }
    }
  }

  /**
   * 記錄操作統計
   *
   * @param {string} operation - 操作類型
   * @param {number} duration - 操作持續時間(ms)
   * @param {boolean} success - 操作是否成功
   */
  recordOperationStatistics (operation, duration, success) {
    if (!this.config.enableStatistics) {
      return
    }

    this.statistics.totalOperations++
    this.statistics.lastOperationTime = Date.now()

    if (success) {
      this.statistics.successfulOperations++
    } else {
      this.statistics.failedOperations++
    }

    // 計算平均處理時間
    const currentAvg = this.statistics.averageProcessingTime
    const totalOps = this.statistics.totalOperations
    this.statistics.averageProcessingTime =
      ((currentAvg * (totalOps - 1)) + duration) / totalOps

    // 記錄操作歷史 (保留最近100筆)
    this.statistics.operationHistory.push({
      operation,
      duration,
      success,
      timestamp: Date.now()
    })

    if (this.statistics.operationHistory.length > 100) {
      this.statistics.operationHistory.shift()
    }
  }

  /**
   * 統一錯誤處理機制
   *
   * @param {string} flowId - 流程ID
   * @param {Error} error - 錯誤物件
   * @param {string} errorType - 錯誤類型，預設為 'GENERAL'
   * @returns {Object} 標準化的錯誤回應
   */
  handleProcessingError (flowId, error, errorType = 'GENERAL') {
    this.errorStats.errorCount++

    const errorInfo = {
      flowId,
      type: errorType,
      error: error.message,
      stack: error.stack,
      timestamp: Date.now()
    }

    // 記錄最新錯誤
    this.errorStats.lastError = errorInfo

    // 維護錯誤歷史 (保留最近50筆)
    this.errorStats.errorHistory.push(errorInfo)
    if (this.errorStats.errorHistory.length > 50) {
      this.errorStats.errorHistory.shift()
    }

    // 記錄到log（如果啟用）
    this.logError(flowId, error, errorType)

    return {
      success: false,
      flowId,
      error: error.message,
      errorType,
      timestamp: Date.now()
    }
  }

  /**
   * 統一的成功回應建構器
   *
   * @param {string} flowId - 流程ID
   * @param {Object} data - 回應資料
   * @param {Object} additionalData - 額外資料，預設為空物件
   * @returns {Object} 標準化的成功回應
   */
  buildStandardResponse (flowId, data = {}, additionalData = {}) {
    return {
      success: true,
      flowId,
      timestamp: Date.now(),
      ...data,
      ...additionalData
    }
  }

  /**
   * 記錄錯誤到 log
   *
   * @param {string} flowId - 流程ID
   * @param {Error} error - 錯誤物件
   * @param {string} errorType - 錯誤類型
   */
  logError (flowId, error, errorType) {
    if (this.config.enableLogging) {
      console.error(`[${this.name}] Error in flow ${flowId} (${errorType}):`, error.message)
      if (process.env.NODE_ENV === 'development') {
        console.error(error.stack)
      }
    }
  }

  /**
   * 清理過期的操作
   * 防止記憶體洩漏和狀態混亂
   */
  cleanupExpiredOperations () {
    const now = Date.now()
    const expireTime = this.config.defaultTimeout

    for (const [operationId, operationInfo] of this.activeOperations) {
      if (now - operationInfo.startTime > expireTime) {
        this.activeOperations.delete(operationId)

        // 清理相關的計時器
        if (this.operationTimers.has(operationId)) {
          clearTimeout(this.operationTimers.get(operationId))
          this.operationTimers.delete(operationId)
        }
      }
    }
  }

  /**
   * 取得處理器統計資訊
   *
   * @returns {Object} 統計資訊
   */
  getStats () {
    const baseStats = super.getStats ? super.getStats() : {}
    return {
      ...baseStats,
      ...this.statistics,
      errorStats: { ...this.errorStats },
      activeOperationsCount: this.activeOperations.size,
      uptime: Date.now() - this.lastActivity,
      config: { ...this.config }
    }
  }

  /**
   * 取得處理器統計資訊（別名方法）
   *
   * @returns {Object} 統計資訊
   */
  getStatistics () {
    return this.getStats()
  }

  /**
   * 重設統計資訊
   */
  resetStatistics () {
    this.initializeCommonStatistics()
  }

  /**
   * 檢查處理器是否啟用
   *
   * @returns {boolean} 是否啟用
   */
  isEnabled () {
    return this.config.enabled
  }

  /**
   * 啟用/停用處理器
   *
   * @param {boolean} enabled - 是否啟用
   */
  setEnabled (enabled) {
    this.config.enabled = !!enabled
  }

  /**
   * 覆寫父類別的handle方法以支援啟用/停用功能
   *
   * @param {Object} event - 事件物件
   * @returns {Promise<Object|null>} 處理結果，停用時返回null
   */
  async handle (event) {
    if (!this.config?.enabled) {
      return null
    }
    return super.handle(event)
  }
}

module.exports = BaseUIHandler
