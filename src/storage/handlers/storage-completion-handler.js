/**
 * StorageCompletionHandler - 儲存完成事件處理器
 *
 * 負責功能：
 * - 處理 STORAGE.SAVE.COMPLETED 事件
 * - 處理 STORAGE.ERROR 事件
 * - 發送完成通知事件
 * - 處理錯誤恢復流程
 * - 統計和監控
 *
 * 設計考量：
 * - 繼承 EventHandler 提供標準化處理流程
 * - 支援多種儲存結果類型和錯誤處理
 * - 智能恢復策略和錯誤分析
 * - 詳細的統計和效能監控
 *
 * 處理流程：
 * 1. 事件接收和驗證
 * 2. 根據事件類型分派處理
 * 3. 更新統計資訊
 * 4. 發送相應的通知事件
 * 5. 觸發恢復策略（如需要）
 *
 * 使用情境：
 * - 儲存操作完成後的後續處理
 * - 儲存錯誤的自動恢復
 * - UI狀態更新和使用者通知
 * - 系統健康監控
 *
 * @version 1.0.0
 * @since 2025-07-31
 */

const EventHandler = require('src/core/event-handler')
const { StandardError } = require('src/core/errors/StandardError')

class StorageCompletionHandler extends EventHandler {
  /**
   * 建構 StorageCompletionHandler 實例
   *
   * @param {EventBus} eventBus - 事件總線實例
   * @param {Object} storageAdapter - 儲存適配器實例
   */
  constructor (eventBus, storageAdapter) {
    super('StorageCompletionHandler', 1) // 名稱和優先級

    this.eventBus = eventBus
    this.storageAdapter = storageAdapter

    // 事件類型常數
    this.EVENT_TYPES = {
      SAVE_COMPLETED: 'STORAGE.SAVE.COMPLETED',
      STORAGE_ERROR: 'STORAGE.ERROR'
    }

    // 支援的事件類型
    this.SUPPORTED_EVENTS = [
      this.EVENT_TYPES.SAVE_COMPLETED,
      this.EVENT_TYPES.STORAGE_ERROR
    ]

    // 通知事件類型常數
    this.NOTIFICATION_TYPES = {
      UI_NOTIFICATION_SHOW: 'UI.NOTIFICATION.SHOW',
      UI_STORAGE_UPDATE: 'UI.STORAGE.UPDATE',
      UI_ERROR_SHOW: 'UI.ERROR.SHOW',
      STORAGE_RECOVERY_REQUESTED: 'STORAGE.RECOVERY.REQUESTED'
    }

    // 錯誤類型映射到恢復策略
    this.RECOVERY_STRATEGIES = {
      QUOTA_EXCEEDED: 'cleanup',
      NETWORK_ERROR: 'retry',
      PERMISSION_DENIED: 'request_permission',
      CORRUPTION_ERROR: 'reset_storage'
    }

    // 配置常數
    this.CONFIG = {
      HANDLER_VERSION: '1.0.0',
      DEFAULT_RETRY_DELAY: 1000,
      MAX_RETRY_ATTEMPTS: 3,
      MIN_MESSAGE_LENGTH: 1
    }

    // 初始化統計資訊
    this.completionStats = this.initializeCompletionStats()
    this.errorStats = this.initializeErrorStats()
    this.processingStats = this.initializeProcessingStats()

    // 恢復策略配置
    this.recoveryConfig = this.initializeRecoveryConfig()
  }

  /**
   * 檢查是否支援指定的事件類型
   *
   * @param {string} eventType - 事件類型
   * @returns {boolean} 是否支援該事件類型
   */
  supportsEvent (eventType) {
    return this.SUPPORTED_EVENTS.includes(eventType)
  }

  /**
   * 處理儲存完成和錯誤事件
   *
   * @param {Object} event - 事件物件
   */
  async process (event) {
    const startTime = performance.now()

    try {
      // 1. 前置驗證
      this.performPreValidation(event)

      // 2. 根據事件類型分派處理
      await this.dispatchEventHandling(event)
    } catch (error) {
      // 重新拋出錯誤供 EventHandler 基類處理
      throw this.createError('PROCESSING_FAILED', `Event processing failed: ${error.message}`, error)
    } finally {
      // 3. 更新處理時間統計
      const processingTime = performance.now() - startTime
      this.updateProcessingStats(processingTime)
    }
  }

  /**
   * 執行前置驗證
   *
   * @param {Object} event - 事件物件
   */
  performPreValidation (event) {
    this.validateEvent(event)
  }

  /**
   * 根據事件類型分派處理
   *
   * @param {Object} event - 事件物件
   */
  async dispatchEventHandling (event) {
    switch (event.type) {
      case this.EVENT_TYPES.SAVE_COMPLETED:
        await this.handleSaveCompleted(event)
        break
      case this.EVENT_TYPES.STORAGE_ERROR:
        await this.handleStorageError(event)
        break
      default:
        throw this.createError('UNSUPPORTED_EVENT', `Unsupported event type: ${event.type}`)
    }
  }

  /**
   * 處理儲存完成事件
   *
   * @param {Object} event - STORAGE.SAVE.COMPLETED 事件
   */
  async handleSaveCompleted (event) {
    const { data } = event

    // 驗證完成結果
    this.validateCompletionResult(data.result)

    // 更新完成統計
    this.updateCompletionStats(data.result)

    // 發送適當的通知
    if (data.result.success) {
      await this.sendSuccessNotification(data)
    } else {
      await this.sendPartialSaveNotification(data)
    }

    // 發送UI更新事件
    await this.sendUIUpdateEvent(data)
  }

  /**
   * 處理儲存錯誤事件
   *
   * @param {Object} event - STORAGE.ERROR 事件
   */
  async handleStorageError (event) {
    const { data } = event

    // 驗證錯誤資料
    this.validateErrorData(data.error)

    // 更新錯誤統計
    this.updateErrorStats(data.error)

    // 發送錯誤通知
    await this.sendErrorNotification(data)

    // 觸發恢復策略
    await this.triggerRecoveryStrategy(data)
  }

  /**
   * 驗證事件結構
   *
   * @param {Object} event - 事件物件
   */
  validateEvent (event) {
    if (!event || typeof event !== 'object') {
      throw this.createError('INVALID_EVENT', 'Event must be a valid object')
    }

    if (!event.type || typeof event.type !== 'string') {
      throw this.createError('INVALID_EVENT', 'Event type is required and must be a string')
    }

    if (!event.data || typeof event.data !== 'object') {
      throw this.createError('INVALID_EVENT', 'Event data is required and must be an object')
    }

    if (!event.data.flowId || typeof event.data.flowId !== 'string') {
      throw this.createError('INVALID_EVENT', 'FlowId is required and must be a string')
    }

    // 驗證事件特定要求
    if (event.type === this.EVENT_TYPES.SAVE_COMPLETED && !event.data.result) {
      throw this.createError('INVALID_EVENT', 'Completion event requires result data')
    }

    if (event.type === this.EVENT_TYPES.STORAGE_ERROR && !event.data.error) {
      throw this.createError('INVALID_EVENT', 'Error event requires error data')
    }
  }

  /**
   * 驗證完成結果資料
   *
   * @param {Object} result - 完成結果物件
   */
  validateCompletionResult (result) {
    if (!result || typeof result !== 'object') {
      throw this.createError('INVALID_RESULT', 'Invalid completion result')
    }

    if (typeof result.success !== 'boolean') {
      throw this.createError('INVALID_RESULT', 'Result must have success boolean field')
    }
  }

  /**
   * 驗證錯誤資料結構
   *
   * @param {Object} error - 錯誤物件
   */
  validateErrorData (error) {
    if (!error || typeof error !== 'object') {
      throw this.createError('INVALID_ERROR', 'Invalid error data')
    }

    if (!error.type || typeof error.type !== 'string') {
      throw this.createError('INVALID_ERROR', 'Error must have type field')
    }

    if (!error.message || typeof error.message !== 'string') {
      throw this.createError('INVALID_ERROR', 'Error must have message field')
    }
  }

  /**
   * 發送成功通知
   *
   * @param {Object} data - 完成事件資料
   */
  async sendSuccessNotification (data) {
    const { result } = data
    const savedCount = result.savedCount || 0

    await this.eventBus.emit(this.NOTIFICATION_TYPES.UI_NOTIFICATION_SHOW, {
      type: 'success',
      message: `儲存完成：成功儲存 ${savedCount} 筆資料`,
      duration: 3000,
      timestamp: Date.now()
    })
  }

  /**
   * 發送部分儲存通知
   *
   * @param {Object} data - 完成事件資料
   */
  async sendPartialSaveNotification (data) {
    const { result } = data
    const savedCount = result.savedCount || 0
    const totalCount = result.totalCount || 0

    await this.eventBus.emit(this.NOTIFICATION_TYPES.UI_NOTIFICATION_SHOW, {
      type: 'warning',
      message: `部分儲存：已儲存 ${savedCount}/${totalCount} 筆資料`,
      duration: 5000,
      timestamp: Date.now()
    })
  }

  /**
   * 發送UI更新事件
   *
   * @param {Object} data - 完成事件資料
   */
  async sendUIUpdateEvent (data) {
    await this.eventBus.emit(this.NOTIFICATION_TYPES.UI_STORAGE_UPDATE, {
      status: 'completed',
      result: data.result,
      timestamp: Date.now()
    })
  }

  /**
   * 發送錯誤通知
   *
   * @param {Object} data - 錯誤事件資料
   */
  async sendErrorNotification (data) {
    await this.eventBus.emit(this.NOTIFICATION_TYPES.UI_ERROR_SHOW, {
      error: data.error,
      context: data.context,
      timestamp: Date.now()
    })
  }

  /**
   * 觸發恢復策略
   *
   * @param {Object} data - 錯誤事件資料
   */
  async triggerRecoveryStrategy (data) {
    const { error, flowId, context } = data
    const strategy = this.RECOVERY_STRATEGIES[error.type] || 'unknown'

    // 更新恢復嘗試統計
    this.errorStats.recoveryAttempts++

    const recoveryEvent = {
      flowId,
      errorType: error.type,
      strategy,
      timestamp: Date.now()
    }

    // 根據錯誤類型添加特定的恢復配置
    switch (error.type) {
      case 'QUOTA_EXCEEDED':
        recoveryEvent.actions = ['remove_old_data', 'compress_data']
        break

      case 'NETWORK_ERROR':
        recoveryEvent.retryDelay = this.calculateRetryDelay(context)
        recoveryEvent.maxRetries = this.CONFIG.MAX_RETRY_ATTEMPTS
        break

      case 'PERMISSION_DENIED':
        recoveryEvent.permissions = ['storage']
        break

      case 'CORRUPTION_ERROR':
        recoveryEvent.resetScope = 'all'
        break
    }

    await this.eventBus.emit(this.NOTIFICATION_TYPES.STORAGE_RECOVERY_REQUESTED, recoveryEvent)
  }

  /**
   * 計算重試延遲時間
   *
   * @param {Object} context - 錯誤上下文
   * @returns {number} 延遲時間（毫秒）
   */
  calculateRetryDelay (context) {
    const retryCount = context?.retryCount || 0
    return this.CONFIG.DEFAULT_RETRY_DELAY * Math.pow(2, retryCount) // 指數退避
  }

  /**
   * 更新完成統計資訊
   *
   * @param {Object} result - 完成結果
   */
  updateCompletionStats (result) {
    this.completionStats.totalCompletions++

    if (result.success) {
      this.completionStats.successfulCompletions++
    } else {
      this.completionStats.failedCompletions++
    }

    // 更新儲存項目統計
    const savedCount = result.savedCount || 0
    this.completionStats.totalSavedItems += savedCount

    // 更新處理時間統計
    if (result.processingTime) {
      this.updateAverageProcessingTime(result.processingTime)
    }

    // 計算成功率
    this.completionStats.successRate = Math.round(
      (this.completionStats.successfulCompletions / this.completionStats.totalCompletions) * 100
    )
  }

  /**
   * 更新錯誤統計資訊
   *
   * @param {Object} error - 錯誤物件
   */
  updateErrorStats (error) {
    this.errorStats.totalErrors++

    // 按類型統計錯誤
    if (!this.errorStats.errorsByType[error.type]) {
      this.errorStats.errorsByType[error.type] = 0
    }
    this.errorStats.errorsByType[error.type]++

    // 計算恢復成功率
    if (this.errorStats.recoveryAttempts > 0) {
      this.errorStats.recoverySuccessRate = Math.round(
        (this.errorStats.recoverySuccesses / this.errorStats.recoveryAttempts) * 100
      )
    }
  }

  /**
   * 更新處理時間統計
   *
   * @param {number} processingTime - 處理時間（毫秒）
   */
  updateProcessingStats (processingTime) {
    this.processingStats.lastProcessingTime = processingTime
    this.processingStats.totalProcessingTime += processingTime
    this.processingStats.processedEvents++

    this.processingStats.averageProcessingTime =
      this.processingStats.totalProcessingTime / this.processingStats.processedEvents
  }

  /**
   * 更新平均處理時間
   *
   * @param {number} newTime - 新的處理時間
   */
  updateAverageProcessingTime (newTime) {
    const current = this.completionStats.averageProcessingTime || 0
    const count = this.completionStats.totalCompletions

    this.completionStats.averageProcessingTime =
      ((current * (count - 1)) + newTime) / count
  }

  /**
   * 初始化完成統計資訊
   *
   * @returns {Object} 完成統計物件
   */
  initializeCompletionStats () {
    return {
      totalCompletions: 0,
      successfulCompletions: 0,
      failedCompletions: 0,
      totalSavedItems: 0,
      averageProcessingTime: 0,
      successRate: 0
    }
  }

  /**
   * 初始化錯誤統計資訊
   *
   * @returns {Object} 錯誤統計物件
   */
  initializeErrorStats () {
    return {
      totalErrors: 0,
      errorsByType: {},
      recoveryAttempts: 0,
      recoverySuccesses: 0,
      recoverySuccessRate: 0
    }
  }

  /**
   * 初始化處理統計資訊
   *
   * @returns {Object} 處理統計物件
   */
  initializeProcessingStats () {
    return {
      lastProcessingTime: 0,
      totalProcessingTime: 0,
      processedEvents: 0,
      averageProcessingTime: 0
    }
  }

  /**
   * 初始化恢復配置
   *
   * @returns {Object} 恢復配置物件
   */
  initializeRecoveryConfig () {
    return {
      quotaCleanupThreshold: 0.9, // 90% 配額使用率觸發清理
      networkRetryLimit: 3,
      retryBackoffMultiplier: 2,
      corruptionResetDelay: 5000
    }
  }

  /**
   * 取得完成統計資訊
   *
   * @returns {Object} 完成統計物件
   */
  getCompletionStats () {
    return { ...this.completionStats }
  }

  /**
   * 取得錯誤統計資訊
   *
   * @returns {Object} 錯誤統計物件
   */
  getErrorStats () {
    return {
      ...this.errorStats,
      errorsByType: { ...this.errorStats.errorsByType }
    }
  }

  /**
   * 取得處理統計資訊
   *
   * @returns {Object} 處理統計物件
   */
  getProcessingStats () {
    return { ...this.processingStats }
  }

  /**
   * 創建標準化錯誤物件
   *
   * @param {string} type - 錯誤類型
   * @param {string} message - 錯誤訊息
   * @param {Error} [originalError] - 原始錯誤物件
   * @returns {Error} 標準化錯誤物件
   */
  createError (type, message, originalError) {
    const prefix = this.getErrorPrefix(type)
    const error = new StandardError('UNKNOWN_ERROR', `${prefix}: ${message}`, {
      category: 'storage'
    })
    error.type = type

    if (originalError) {
      error.originalError = originalError
      error.stack = originalError.stack
    }

    return error
  }

  /**
   * 取得錯誤前綴
   *
   * @param {string} type - 錯誤類型
   * @returns {string} 錯誤前綴
   */
  getErrorPrefix (type) {
    const prefixes = {
      INVALID_EVENT: 'Invalid event',
      INVALID_RESULT: 'Invalid completion result',
      INVALID_ERROR: 'Invalid error data',
      PROCESSING_FAILED: 'Processing failed'
    }

    return prefixes[type] || 'Storage completion error'
  }
}

module.exports = StorageCompletionHandler
