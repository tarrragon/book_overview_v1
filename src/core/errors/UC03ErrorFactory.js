/**
 * UC-03 ErrorCodes 錯誤工廠
 *
 * 功能：為UC-03資料匯出與備份流程提供專用錯誤建立方法
 * 基於：UC-01/UC-02 成功架構模式，針對匯出場景優化
 *
 * 特色：
 * - 資料匯出專用錯誤處理
 * - 檔案下載與瀏覽器相容性錯誤
 * - 大量資料處理記憶體管理錯誤
 * - 資料完整性驗證錯誤處理
 */

import { UC03ErrorAdapter } from './UC03ErrorAdapter.js'
const { ErrorCodes } = require('./ErrorCodes')

/**
 * UC03ErrorFactory
 * UC-03專用的錯誤建立工廠
 */
class UC03ErrorFactory {
  /**
   * 建立通用的UC-03錯誤
   * @param {string} originalCode 原始錯誤代碼
   * @param {string} message 錯誤訊息
   * @param {Object} details 詳細資訊
   * @returns {Error} ErrorCodes格式錯誤
   */
  static createError (originalCode, message, details = {}) {
    return UC03ErrorAdapter.convertError(originalCode, message, details)
  }

  /**
   * 建立結果物件
   * @param {boolean} success 是否成功
   * @param {*} data 成功時的資料
   * @param {Error} error 失敗時的錯誤
   * @returns {Object} 統一格式的結果物件
   */
  static createResult (success, data = null, error = null) {
    if (success) {
      return {
        success: true,
        data,
        code: 'SUCCESS',
        message: 'Export completed successfully'
      }
    } else {
      return {
        success: false,
        error: error?.message || 'Unknown export error',
        code: error?.code || ErrorCodes.UNKNOWN_ERROR,
        details: error?.details || {},
        subType: error?.subType || 'UNKNOWN'
      }
    }
  }

  /**
   * 建立匯出檔案生成失敗錯誤
   * @param {string} exportFormat 匯出格式 (JSON/CSV)
   * @param {string} dataSize 資料大小
   * @param {string} failurePoint 失敗點
   * @param {Array} corruptedBooks 損壞的書籍
   * @param {number} totalBooks 總書籍數
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} DATA_ERROR 類型錯誤
   */
  static createExportGenerationError (
    exportFormat = 'JSON',
    dataSize = 'unknown',
    failurePoint = 'unknown',
    corruptedBooks = [],
    totalBooks = 0,
    additionalDetails = {}
  ) {
    return this.createError(
      'DATA_EXPORT_GENERATION_FAILED',
      '匯出檔案生成失敗',
      {
        exportFormat,
        dataSize,
        failurePoint,
        corruptedBooks,
        totalBooks,
        suggestedActions: ['retry_export', 'check_data_integrity', 'contact_support'],
        userGuidance: '請檢查資料完整性並重新嘗試匯出',
        ...additionalDetails
      }
    )
  }

  /**
   * 建立匯出記憶體不足錯誤
   * @param {number} booksToExport 要匯出的書籍數量
   * @param {string} estimatedSize 預估大小
   * @param {string} availableMemory 可用記憶體
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} OPERATION_ERROR 類型錯誤
   */
  static createExportMemoryError (
    booksToExport = 0,
    estimatedSize = 'unknown',
    availableMemory = 'unknown',
    additionalDetails = {}
  ) {
    return this.createError(
      'SYSTEM_EXPORT_MEMORY_EXHAUSTED',
      '匯出大量資料時記憶體不足',
      {
        booksToExport,
        estimatedSize,
        availableMemory,
        suggestedSolution: 'batch_export',
        suggestedActions: ['reduce_batch_size', 'close_other_tabs', 'try_smaller_export'],
        userGuidance: '建議分批匯出或減少同時匯出的書籍數量',
        batchSizeRecommendation: Math.min(booksToExport, 100),
        ...additionalDetails
      }
    )
  }

  /**
   * 建立下載被阻止錯誤
   * @param {string} fileName 檔案名稱
   * @param {string} fileSize 檔案大小
   * @param {string} blockReason 阻止原因
   * @param {Array} retryOptions 重試選項
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} CHROME_ERROR 類型錯誤
   */
  static createDownloadBlockedError (
    fileName = 'export-file',
    fileSize = 'unknown',
    blockReason = 'unknown',
    retryOptions = ['user_gesture_required', 'download_permission'],
    additionalDetails = {}
  ) {
    return this.createError(
      'PLATFORM_DOWNLOAD_BLOCKED',
      '瀏覽器阻止檔案下載',
      {
        fileName,
        fileSize,
        blockReason,
        retryOptions,
        suggestedActions: ['enable_downloads', 'disable_popup_blocker', 'manual_download'],
        userGuidance: '請允許下載權限或手動點擊下載按鈕',
        downloadUrl: null, // 可設定手動下載連結
        ...additionalDetails
      }
    )
  }

  /**
   * 建立資料完整性違規錯誤
   * @param {number} originalCount 原始資料數量
   * @param {number} exportedCount 實際匯出數量
   * @param {Array} missingBooks 遺失的書籍
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} VALIDATION_ERROR 類型錯誤
   */
  static createIntegrityViolationError (
    originalCount = 0,
    exportedCount = 0,
    missingBooks = [],
    additionalDetails = {}
  ) {
    const lossRate = originalCount > 0 ? ((originalCount - exportedCount) / originalCount * 100).toFixed(1) : '0'

    return this.createError(
      'DATA_EXPORT_INTEGRITY_VIOLATION',
      '匯出資料完整性檢查失敗',
      {
        originalCount,
        exportedCount,
        missingBooks,
        integrityCheckFailed: true,
        dataLossRate: `${lossRate}%`,
        suggestedActions: ['retry_full_export', 'verify_source_data', 'contact_support'],
        userGuidance: '檢測到資料遺失，建議重新進行完整匯出',
        ...additionalDetails
      }
    )
  }

  /**
   * 常用錯誤快取 (效能優化)
   */
  static _commonErrors = new Map()

  /**
   * 獲取常用錯誤 (快取優化)
   */
  static getCommonError (errorType) {
    if (!this._commonErrors.has(errorType)) {
      let error = null

      switch (errorType) {
        case 'EXPORT_GENERATION':
          error = Object.freeze(this.createExportGenerationError('JSON', '2.5MB', 'json_serialization', [], 150, { cached: true }))
          break
        case 'EXPORT_MEMORY':
          error = Object.freeze(this.createExportMemoryError(1000, '15MB', '8MB', { cached: true }))
          break
        case 'DOWNLOAD_BLOCKED':
          error = Object.freeze(this.createDownloadBlockedError('export.json', '2.5MB', 'popup_blocker', [], { cached: true }))
          break
        case 'INTEGRITY_VIOLATION':
          error = Object.freeze(this.createIntegrityViolationError(150, 147, ['book_1', 'book_2'], { cached: true }))
          break
        default:
          return null
      }

      if (error) {
        this._commonErrors.set(errorType, error)
      }
    }

    return this._commonErrors.get(errorType) || null
  }

  /**
   * 清除錯誤快取
   */
  static clearCache () {
    this._commonErrors.clear()
  }

  /**
   * 安全化詳細資訊 (防止記憶體洩漏)
   */
  static sanitizeDetails (details) {
    if (!details || typeof details !== 'object') {
      return {}
    }

    const serialized = JSON.stringify(details)
    const maxSize = 15 * 1024 // 15KB 限制

    if (serialized.length > maxSize) {
      return {
        _truncated: true,
        _originalSize: serialized.length,
        _message: 'Details truncated due to size limit',
        summary: 'Large export data set truncated for memory safety'
      }
    }

    return details
  }

  /**
   * 驗證是否為有效的UC-03錯誤
   */
  static isValidUC03Error (error) {
    return UC03ErrorAdapter.isValidErrorCodesError(error) &&
           error.details &&
           error.details.originalCode &&
           Object.prototype.hasOwnProperty.call(UC03ErrorAdapter.getErrorMapping(), error.details.originalCode)
  }

  /**
   * 建立匯出進度錯誤（額外輔助方法）
   * @param {number} progress 當前進度 (0-100)
   * @param {string} stage 當前階段
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} 進度相關錯誤
   */
  static createExportProgressError (progress = 0, stage = 'unknown', additionalDetails = {}) {
    if (progress < 50) {
      // 早期失敗，可能是資料生成問題
      return this.createExportGenerationError('JSON', 'unknown', stage, [], 0, {
        progress,
        stage,
        earlyFailure: true,
        ...additionalDetails
      })
    } else {
      // 後期失敗，可能是記憶體或下載問題
      return this.createExportMemoryError(0, 'unknown', 'unknown', {
        progress,
        stage,
        lateFailure: true,
        ...additionalDetails
      })
    }
  }
}

module.exports = { UC03ErrorFactory }
