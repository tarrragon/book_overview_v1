/**
 * 錯誤處理器 - TDD循環 #29 Green階段實作
 *
 * 負責功能：
 * - 處理各種匯出錯誤事件
 * - 進行錯誤分類和記錄
 * - 提供錯誤恢復策略判斷
 * - 支援錯誤統計和分析
 *
 * 設計考量：
 * - 繼承自 EventHandler 基底類別
 * - 支援多種錯誤類型的統一處理
 * - 提供錯誤恢復能力判斷
 * - 維護錯誤處理統計
 *
 * @version 1.0.0
 * @since 2025-08-08
 */

const EventHandler = require('src/core/event-handler')
const { EXPORT_EVENTS } = require('src/export/export-events')
const { StandardError } = require('src/core/errors/StandardError')

/**
 * 錯誤處理器類別
 * 專門處理匯出相關的錯誤事件
 */
class ErrorHandler extends EventHandler {
  /**
   * 建構函數
   */
  constructor () {
    super('ErrorHandler', 0) // 最高優先級，優先處理錯誤

    /**
     * 錯誤統計
     * @type {Map<string, number>}
     */
    this.errorStats = new Map()
  }

  /**
   * 獲取支援的事件類型
   *
   * @returns {Array<string>} 支援的事件類型陣列
   */
  getSupportedEvents () {
    return [
      EXPORT_EVENTS.EXPORT_FAILED,
      EXPORT_EVENTS.CSV_EXPORT_FAILED,
      EXPORT_EVENTS.JSON_EXPORT_FAILED,
      EXPORT_EVENTS.EXCEL_EXPORT_FAILED,
      EXPORT_EVENTS.PDF_EXPORT_FAILED,
      EXPORT_EVENTS.BATCH_EXPORT_FAILED,
      EXPORT_EVENTS.FILE_DOWNLOAD_FAILED,
      EXPORT_EVENTS.FILE_SAVE_FAILED,
      EXPORT_EVENTS.CLIPBOARD_COPY_FAILED
    ]
  }

  /**
   * 處理事件的核心邏輯
   *
   * @param {Object} errorData - 錯誤資料
   * @param {Error} errorData.error - 錯誤物件
   * @param {string} errorData.exportId - 匯出ID
   * @param {string} errorData.format - 匯出格式
   * @param {string} errorData.phase - 發生錯誤的階段
   * @param {string} errorData.errorType - 錯誤類型
   * @returns {Promise<Object>} 處理結果
   */
  async process (errorData) {
    try {
      this._validateErrorData(errorData)

      const errorType = this._classifyError(errorData.error)
      const canRetry = this._determineRetryability(errorData)

      // 記錄錯誤
      this._logError(errorData, errorType)

      // 更新統計
      this._updateErrorStats(errorType)

      const result = {
        success: true,
        errorProcessed: true,
        exportId: errorData.exportId,
        errorType: errorData.errorType || errorType,
        canRetry,
        retryRecommendation: this._getRetryRecommendation(errorData, errorType),
        timestamp: new Date().toISOString()
      }

      return result
    } catch (error) {
      // 錯誤處理器自身的錯誤處理
      // eslint-disable-next-line no-console
      console.error('[ErrorHandler] Failed to process error:', error)
      throw error
    }
  }

  /**
   * 分類錯誤類型
   *
   * @param {Error} error - 錯誤物件
   * @returns {string} 錯誤類型
   * @private
   */
  _classifyError (error) {
    if (!error) return 'UNKNOWN'

    if (error.name === 'RangeError') {
      return 'MEMORY'
    }

    if (error.message.includes('Network') || error.message.includes('network')) {
      return 'NETWORK'
    }

    if (error.message.includes('permission') || error.message.includes('Permission')) {
      return 'PERMISSION'
    }

    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return 'TIMEOUT'
    }

    if (error.message.includes('export') || error.message.includes('Export')) {
      return 'EXPORT'
    }

    return 'GENERAL'
  }

  /**
   * 判斷錯誤是否可重試
   *
   * @param {Object} errorData - 錯誤資料
   * @returns {boolean} 是否可重試
   * @private
   */
  _determineRetryability (errorData) {
    if (!errorData.error) return false

    const errorMessage = errorData.error.message || ''

    // 記憶體錯誤通常不適合重試
    if (errorData.error.name === 'RangeError') {
      return false
    }

    // 權限錯誤不適合重試
    if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
      return false
    }

    // 網路和暫時性錯誤可以重試
    if (errorMessage.includes('Network') ||
        errorMessage.includes('Temporary') ||
        errorMessage.includes('timeout')) {
      return true
    }

    // 檢查重試次數
    const retryCount = errorData.retryCount || 0
    const maxRetries = errorData.maxRetries || 3

    return errorData.isRecoverable && retryCount < maxRetries
  }

  /**
   * 獲取重試建議
   *
   * @param {Object} errorData - 錯誤資料
   * @param {string} errorType - 錯誤類型
   * @returns {string} 重試建議
   * @private
   */
  _getRetryRecommendation (errorData, errorType) {
    switch (errorType) {
      case 'NETWORK':
        return 'Check network connection and retry'
      case 'MEMORY':
        return 'Reduce data size or free up memory'
      case 'TIMEOUT':
        return 'Retry with longer timeout'
      case 'PERMISSION':
        return 'Check file permissions'
      case 'EXPORT':
        return 'Verify export data and options'
      default:
        return 'Review error details and retry if appropriate'
    }
  }

  /**
   * 記錄錯誤資訊
   *
   * @param {Object} errorData - 錯誤資料
   * @param {string} errorType - 錯誤類型
   * @private
   */
  _logError (errorData, errorType) {
    const logInfo = {
      exportId: errorData.exportId,
      format: errorData.format,
      phase: errorData.phase,
      errorType,
      message: errorData.error ? errorData.error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }

    // eslint-disable-next-line no-console
    console.error('[ErrorHandler] Export error occurred:', logInfo)
  }

  /**
   * 更新錯誤統計
   *
   * @param {string} errorType - 錯誤類型
   * @private
   */
  _updateErrorStats (errorType) {
    const currentCount = this.errorStats.get(errorType) || 0
    this.errorStats.set(errorType, currentCount + 1)
  }

  /**
   * 驗證錯誤資料
   *
   * @param {Object} errorData - 待驗證的錯誤資料
   * @throws {Error} 當資料無效時拋出錯誤
   * @private
   */
  _validateErrorData (errorData) {
    if (!errorData) {
      throw new StandardError('REQUIRED_FIELD_MISSING', 'Error data is required', {
          "category": "export"
      })
    }

    if (!errorData.exportId) {
      throw new StandardError('REQUIRED_FIELD_MISSING', 'Export ID is required for error tracking', {
          "category": "export"
      })
    }

    // error 可能為 null，這在某些情況下是允許的
  }

  /**
   * 獲取錯誤統計
   *
   * @returns {Object} 錯誤統計資訊
   */
  getErrorStats () {
    const stats = {}
    this.errorStats.forEach((count, errorType) => {
      stats[errorType] = count
    })
    return stats
  }

  /**
   * 事件處理前的預處理
   */
  async beforeHandle (event) {
    // 錯誤處理開始
  }

  /**
   * 事件處理後的後處理
   */
  async afterHandle (event, result) {
    // 錯誤處理完成
  }

  /**
   * 錯誤處理器自身的錯誤處理
   */
  async onError (event, error) {
    // eslint-disable-next-line no-console
    console.error(`[${this.name}] Critical: Error handler failed:`, error.message)
  }
}

module.exports = ErrorHandler
