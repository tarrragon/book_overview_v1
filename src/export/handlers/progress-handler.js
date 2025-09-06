/**
 * 進度處理器 - TDD循環 #29 Green階段實作
 *
 * 負責功能：
 * - 處理匯出進度更新事件
 * - 計算和驗證進度百分比
 * - 提供進度回調機制
 * - 處理無效進度資料的情況
 *
 * 設計考量：
 * - 繼承自 EventHandler 基底類別
 * - 專門處理進度相關事件
 * - 提供準確的百分比計算
 * - 支援進度回調函數
 *
 * @version 1.0.0
 * @since 2025-08-08
 */

const EventHandler = require('src/core/event-handler')
const { EXPORT_EVENTS } = require('src/export/export-events')

/**
 * 進度處理器類別
 * 專門處理匯出進度相關事件
 */
class ProgressHandler extends EventHandler {
  /**
   * 建構函数
   */
  constructor () {
    super('ProgressHandler', 1)
    this.progressCallback = null
  }

  /**
   * 獲取支援的事件類型
   *
   * @returns {Array<string>} 支援的事件類型陣列
   */
  getSupportedEvents () {
    return [EXPORT_EVENTS.EXPORT_PROGRESS]
  }

  /**
   * 處理事件的核心邏輯
   *
   * @param {Object} progressData - 進度資料
   * @param {number} progressData.current - 當前進度值
   * @param {number} progressData.total - 總進度值
   * @param {string} progressData.exportId - 匯出ID
   * @param {string} progressData.phase - 當前階段
   * @param {string} progressData.message - 進度訊息
   * @returns {Promise<Object>} 處理結果
   */
  async process (progressData) {
    try {
      this._validateProgressData(progressData)

      const percentage = this._calculatePercentage(
        progressData.current,
        progressData.total
      )

      // 呼叫進度回調
      if (this.progressCallback) {
        this.progressCallback(percentage)
      }

      const result = {
        success: true,
        exportId: progressData.exportId,
        current: progressData.current,
        total: progressData.total,
        percentage,
        phase: progressData.phase || 'processing',
        message: progressData.message || '',
        timestamp: new Date().toISOString()
      }

      return result
    } catch (error) {
      throw error
    }
  }

  /**
   * 設定進度回調函數
   *
   * @param {Function} callback - 進度回調函數
   */
  setProgressCallback (callback) {
    if (typeof callback === 'function') {
      this.progressCallback = callback
    }
  }

  /**
   * 計算進度百分比
   *
   * @param {number} current - 當前進度
   * @param {number} total - 總進度
   * @returns {number} 百分比（0-100）
   * @private
   */
  _calculatePercentage (current, total) {
    if (total === 0) {
      return 0
    }

    if (current >= total) {
      return 100
    }

    return Math.round((current / total) * 100)
  }

  /**
   * 驗證進度資料
   *
   * @param {Object} progressData - 待驗證的進度資料
   * @throws {Error} 當資料無效時拋出錯誤
   * @private
   */
  _validateProgressData (progressData) {
    if (!progressData) {
      throw new Error('Progress data is required')
    }

    if (!progressData.exportId) {
      throw new Error('Export ID is required for progress tracking')
    }

    if (typeof progressData.current !== 'number' || progressData.current < 0) {
      throw new Error('Invalid current progress value')
    }

    if (typeof progressData.total !== 'number' || progressData.total <= 0) {
      throw new Error('Invalid total progress value')
    }

    if (progressData.current > progressData.total) {
      throw new Error('Current progress cannot exceed total progress')
    }
  }

  /**
   * 事件處理前的預處理
   */
  async beforeHandle (event) {
    // 進度事件通常頻繁，只在需要時記錄
  }

  /**
   * 事件處理後的後處理
   */
  async afterHandle (event, result) {
    // 進度處理完成後的清理工作
  }

  /**
   * 錯誤處理
   */
  async onError (event, error) {
    console.error(`[${this.name}] Progress handling failed:`, error.message)
  }
}

module.exports = ProgressHandler
