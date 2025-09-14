/**
const Logger = require("src/core/logging/Logger")
 * UI處理器基底類別
const Logger = require("src/core/logging/Logger")
 * 提供所有UI處理器的共同功能和介面
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 負責功能：
const Logger = require("src/core/logging/Logger")
 * - 提供統一的UI處理器初始化模式
const Logger = require("src/core/logging/Logger")
 * - 管理DOM和事件總線的共同依賴
const Logger = require("src/core/logging/Logger")
 * - 提供標準化的錯誤處理和統計
const Logger = require("src/core/logging/Logger")
 * - 實現UI處理器的生命週期管理
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 設計考量：
const Logger = require("src/core/logging/Logger")
 * - 繼承 EventHandler 提供事件處理基礎
const Logger = require("src/core/logging/Logger")
 * - 抽象化共同的初始化和配置邏輯
const Logger = require("src/core/logging/Logger")
 * - 提供可擴展的UI操作介面
const Logger = require("src/core/logging/Logger")
 * - 統一UI處理器的錯誤處理模式
const Logger = require("src/core/logging/Logger")
 */

const Logger = require("src/core/logging/Logger")
const EventHandler = require('src/core/event-handler')
const Logger = require("src/core/logging/Logger")
const UIEventValidator = require('./ui-event-validator')
const Logger = require("src/core/logging/Logger")
const UIDOMManager = require('./ui-dom-manager')

const Logger = require("src/core/logging/Logger")
class BaseUIHandler extends EventHandler {
const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 建構UI處理器基底
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} handlerName - 處理器名稱
const Logger = require("src/core/logging/Logger")
   * @param {number} priority - 事件處理優先級
const Logger = require("src/core/logging/Logger")
   * @param {Object} eventBus - 事件總線實例
const Logger = require("src/core/logging/Logger")
   * @param {Object} document - DOM文檔物件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  constructor (handlerName, priority, eventBus, document) {
const Logger = require("src/core/logging/Logger")
    super(handlerName, priority)

const Logger = require("src/core/logging/Logger")
    this.eventBus = eventBus
const Logger = require("src/core/logging/Logger")
    this.document = document
const Logger = require("src/core/logging/Logger")
    this.domManager = new UIDOMManager(document)
const Logger = require("src/core/logging/Logger")
    this.validator = new UIEventValidator()

const Logger = require("src/core/logging/Logger")
    // 初始化共同狀態
const Logger = require("src/core/logging/Logger")
    this.initializeCommonState()

const Logger = require("src/core/logging/Logger")
    // 初始化共同配置
const Logger = require("src/core/logging/Logger")
    this.initializeCommonConfiguration()

const Logger = require("src/core/logging/Logger")
    // 初始化共同統計
const Logger = require("src/core/logging/Logger")
    this.initializeCommonStatistics()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 取得處理器名稱 (提供 handlerName 別名)
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  get handlerName () {
const Logger = require("src/core/logging/Logger")
    return this.name
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化共同狀態管理
const Logger = require("src/core/logging/Logger")
   * 子類別可以覆寫此方法來添加特定狀態
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  initializeCommonState () {
const Logger = require("src/core/logging/Logger")
    this.activeOperations = new Map()
const Logger = require("src/core/logging/Logger")
    this.operationTimers = new Map()
const Logger = require("src/core/logging/Logger")
    this.lastActivity = Date.now()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化共同配置
const Logger = require("src/core/logging/Logger")
   * 子類別可以覆寫此方法來添加特定配置
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  initializeCommonConfiguration () {
const Logger = require("src/core/logging/Logger")
    this.config = {
const Logger = require("src/core/logging/Logger")
      enabled: true,
const Logger = require("src/core/logging/Logger")
      maxOperations: 10,
const Logger = require("src/core/logging/Logger")
      defaultTimeout: 5000,
const Logger = require("src/core/logging/Logger")
      enableLogging: true,
const Logger = require("src/core/logging/Logger")
      enableStatistics: true
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化共同統計
const Logger = require("src/core/logging/Logger")
   * 子類別可以覆寫此方法來添加特定統計
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  initializeCommonStatistics () {
const Logger = require("src/core/logging/Logger")
    this.statistics = {
const Logger = require("src/core/logging/Logger")
      totalOperations: 0,
const Logger = require("src/core/logging/Logger")
      successfulOperations: 0,
const Logger = require("src/core/logging/Logger")
      failedOperations: 0,
const Logger = require("src/core/logging/Logger")
      averageProcessingTime: 0,
const Logger = require("src/core/logging/Logger")
      lastOperationTime: null,
const Logger = require("src/core/logging/Logger")
      operationHistory: []
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 初始化錯誤統計
const Logger = require("src/core/logging/Logger")
    this.errorStats = {
const Logger = require("src/core/logging/Logger")
      errorCount: 0,
const Logger = require("src/core/logging/Logger")
      lastError: null,
const Logger = require("src/core/logging/Logger")
      errorHistory: []
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 驗證事件資料的基本結構
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} event - 事件物件
const Logger = require("src/core/logging/Logger")
   * @returns {Object} 驗證結果
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  validateEventData (event) {
const Logger = require("src/core/logging/Logger")
    if (!event || !event.data) {
const Logger = require("src/core/logging/Logger")
      return {
const Logger = require("src/core/logging/Logger")
        isValid: false,
const Logger = require("src/core/logging/Logger")
        error: 'Event data is required',
const Logger = require("src/core/logging/Logger")
        details: { event }
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    const { data, flowId, timestamp } = event

const Logger = require("src/core/logging/Logger")
    if (!flowId) {
const Logger = require("src/core/logging/Logger")
      return {
const Logger = require("src/core/logging/Logger")
        isValid: false,
const Logger = require("src/core/logging/Logger")
        error: 'Flow ID is required',
const Logger = require("src/core/logging/Logger")
        details: { event }
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    return {
const Logger = require("src/core/logging/Logger")
      isValid: true,
const Logger = require("src/core/logging/Logger")
      data: { data, flowId, timestamp }
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 記錄操作統計
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} operation - 操作類型
const Logger = require("src/core/logging/Logger")
   * @param {number} duration - 操作持續時間(ms)
const Logger = require("src/core/logging/Logger")
   * @param {boolean} success - 操作是否成功
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  recordOperationStatistics (operation, duration, success) {
const Logger = require("src/core/logging/Logger")
    if (!this.config.enableStatistics) {
const Logger = require("src/core/logging/Logger")
      return
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    this.statistics.totalOperations++
const Logger = require("src/core/logging/Logger")
    this.statistics.lastOperationTime = Date.now()

const Logger = require("src/core/logging/Logger")
    if (success) {
const Logger = require("src/core/logging/Logger")
      this.statistics.successfulOperations++
const Logger = require("src/core/logging/Logger")
    } else {
const Logger = require("src/core/logging/Logger")
      this.statistics.failedOperations++
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 計算平均處理時間
const Logger = require("src/core/logging/Logger")
    const currentAvg = this.statistics.averageProcessingTime
const Logger = require("src/core/logging/Logger")
    const totalOps = this.statistics.totalOperations
const Logger = require("src/core/logging/Logger")
    this.statistics.averageProcessingTime =
const Logger = require("src/core/logging/Logger")
      ((currentAvg * (totalOps - 1)) + duration) / totalOps

const Logger = require("src/core/logging/Logger")
    // 記錄操作歷史 (保留最近100筆)
const Logger = require("src/core/logging/Logger")
    this.statistics.operationHistory.push({
const Logger = require("src/core/logging/Logger")
      operation,
const Logger = require("src/core/logging/Logger")
      duration,
const Logger = require("src/core/logging/Logger")
      success,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })

const Logger = require("src/core/logging/Logger")
    if (this.statistics.operationHistory.length > 100) {
const Logger = require("src/core/logging/Logger")
      this.statistics.operationHistory.shift()
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 統一錯誤處理機制
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} flowId - 流程ID
const Logger = require("src/core/logging/Logger")
   * @param {Error} error - 錯誤物件
const Logger = require("src/core/logging/Logger")
   * @param {string} errorType - 錯誤類型，預設為 'GENERAL'
const Logger = require("src/core/logging/Logger")
   * @returns {Object} 標準化的錯誤回應
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleProcessingError (flowId, error, errorType = 'GENERAL') {
const Logger = require("src/core/logging/Logger")
    this.errorStats.errorCount++

const Logger = require("src/core/logging/Logger")
    const errorInfo = {
const Logger = require("src/core/logging/Logger")
      flowId,
const Logger = require("src/core/logging/Logger")
      type: errorType,
const Logger = require("src/core/logging/Logger")
      error: error.message,
const Logger = require("src/core/logging/Logger")
      stack: error.stack,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 記錄最新錯誤
const Logger = require("src/core/logging/Logger")
    this.errorStats.lastError = errorInfo

const Logger = require("src/core/logging/Logger")
    // 維護錯誤歷史 (保留最近50筆)
const Logger = require("src/core/logging/Logger")
    this.errorStats.errorHistory.push(errorInfo)
const Logger = require("src/core/logging/Logger")
    if (this.errorStats.errorHistory.length > 50) {
const Logger = require("src/core/logging/Logger")
      this.errorStats.errorHistory.shift()
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 記錄到log（如果啟用）
const Logger = require("src/core/logging/Logger")
    this.logError(flowId, error, errorType)

const Logger = require("src/core/logging/Logger")
    return {
const Logger = require("src/core/logging/Logger")
      success: false,
const Logger = require("src/core/logging/Logger")
      flowId,
const Logger = require("src/core/logging/Logger")
      error: error.message,
const Logger = require("src/core/logging/Logger")
      errorType,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 統一的成功回應建構器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} flowId - 流程ID
const Logger = require("src/core/logging/Logger")
   * @param {Object} data - 回應資料
const Logger = require("src/core/logging/Logger")
   * @param {Object} additionalData - 額外資料，預設為空物件
const Logger = require("src/core/logging/Logger")
   * @returns {Object} 標準化的成功回應
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  buildStandardResponse (flowId, data = {}, additionalData = {}) {
const Logger = require("src/core/logging/Logger")
    return {
const Logger = require("src/core/logging/Logger")
      success: true,
const Logger = require("src/core/logging/Logger")
      flowId,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now(),
const Logger = require("src/core/logging/Logger")
      ...data,
const Logger = require("src/core/logging/Logger")
      ...additionalData
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 記錄錯誤到 log
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} flowId - 流程ID
const Logger = require("src/core/logging/Logger")
   * @param {Error} error - 錯誤物件
const Logger = require("src/core/logging/Logger")
   * @param {string} errorType - 錯誤類型
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  logError (flowId, error, errorType) {
const Logger = require("src/core/logging/Logger")
    if (this.config.enableLogging) {
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.error(`[${this.name}] Error in flow ${flowId} (${errorType}):`, error.message)
const Logger = require("src/core/logging/Logger")
      if (process.env.NODE_ENV === 'development') {
const Logger = require("src/core/logging/Logger")
        // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
        Logger.error(error.stack)
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 清理過期的操作
const Logger = require("src/core/logging/Logger")
   * 防止記憶體洩漏和狀態混亂
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  cleanupExpiredOperations () {
const Logger = require("src/core/logging/Logger")
    const now = Date.now()
const Logger = require("src/core/logging/Logger")
    const expireTime = this.config.defaultTimeout

const Logger = require("src/core/logging/Logger")
    for (const [operationId, operationInfo] of this.activeOperations) {
const Logger = require("src/core/logging/Logger")
      if (now - operationInfo.startTime > expireTime) {
const Logger = require("src/core/logging/Logger")
        this.activeOperations.delete(operationId)

const Logger = require("src/core/logging/Logger")
        // 清理相關的計時器
const Logger = require("src/core/logging/Logger")
        if (this.operationTimers.has(operationId)) {
const Logger = require("src/core/logging/Logger")
          clearTimeout(this.operationTimers.get(operationId))
const Logger = require("src/core/logging/Logger")
          this.operationTimers.delete(operationId)
const Logger = require("src/core/logging/Logger")
        }
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 取得處理器統計資訊
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {Object} 統計資訊
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  getStats () {
const Logger = require("src/core/logging/Logger")
    const baseStats = super.getStats ? super.getStats() : {}
const Logger = require("src/core/logging/Logger")
    return {
const Logger = require("src/core/logging/Logger")
      ...baseStats,
const Logger = require("src/core/logging/Logger")
      ...this.statistics,
const Logger = require("src/core/logging/Logger")
      errorStats: { ...this.errorStats },
const Logger = require("src/core/logging/Logger")
      activeOperationsCount: this.activeOperations.size,
const Logger = require("src/core/logging/Logger")
      uptime: Date.now() - this.lastActivity,
const Logger = require("src/core/logging/Logger")
      config: { ...this.config }
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 取得處理器統計資訊（別名方法）
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {Object} 統計資訊
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  getStatistics () {
const Logger = require("src/core/logging/Logger")
    return this.getStats()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 重設統計資訊
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  resetStatistics () {
const Logger = require("src/core/logging/Logger")
    this.initializeCommonStatistics()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 檢查處理器是否啟用
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {boolean} 是否啟用
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  isEnabled () {
const Logger = require("src/core/logging/Logger")
    return this.config.enabled
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 啟用/停用處理器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {boolean} enabled - 是否啟用
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  setEnabled (enabled) {
const Logger = require("src/core/logging/Logger")
    this.config.enabled = !!enabled
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 覆寫父類別的handle方法以支援啟用/停用功能
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} event - 事件物件
const Logger = require("src/core/logging/Logger")
   * @returns {Promise<Object|null>} 處理結果，停用時返回null
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async handle (event) {
const Logger = require("src/core/logging/Logger")
    if (!this.config?.enabled) {
const Logger = require("src/core/logging/Logger")
      return null
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
    return super.handle(event)
const Logger = require("src/core/logging/Logger")
  }
const Logger = require("src/core/logging/Logger")
}

const Logger = require("src/core/logging/Logger")
module.exports = BaseUIHandler
