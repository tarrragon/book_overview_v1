/**
 * UC07ErrorAdapter - UC-07 錯誤處理與恢復 ErrorCodes 轉換適配器
 *
 * 處理系統錯誤處理、日誌記錄、恢復機制和學習系統的錯誤轉換
 * 從 UC-07 StandardError 轉換為統一的 ErrorCodes v5.0.0 格式
 *
 * 專門處理錯誤處理系統本身的錯誤情況：
 * - 錯誤處理器遞迴問題
 * - 日誌記錄系統失敗
 * - 自動恢復機制失效
 * - 錯誤學習資料過載
 */

import { ErrorCodes } from './ErrorCodes.js'

export class UC07ErrorAdapter {
  /**
   * UC-07 StandardError 到 ErrorCodes 的映射表
   * @private
   * @static
   */
  static _errorMapping = null

  /**
   * 取得 UC-07 錯誤映射表（含快取機制）
   * @returns {Object} StandardError 到 ErrorCodes 的映射
   */
  static getErrorMapping () {
    if (!this._errorMapping) {
      this._errorMapping = Object.freeze({
        // 錯誤處理器遞迴 → 操作錯誤
        SYSTEM_ERROR_HANDLER_RECURSION: ErrorCodes.OPERATION_ERROR,

        // 日誌記錄失敗 → 儲存錯誤
        SYSTEM_ERROR_LOGGING_FAILURE: ErrorCodes.STORAGE_ERROR,

        // 恢復機制失效 → 操作錯誤
        SYSTEM_RECOVERY_MECHANISM_EXHAUSTED: ErrorCodes.OPERATION_ERROR,

        // 學習資料過載 → 儲存錯誤
        DATA_ERROR_PATTERN_LEARNING_OVERFLOW: ErrorCodes.STORAGE_ERROR
      })
    }
    return this._errorMapping
  }

  /**
   * 從 StandardError 代碼提取子類型
   * @param {string} standardErrorCode - 原始 StandardError 代碼
   * @returns {string} 子類型代碼
   */
  static extractSubType (standardErrorCode) {
    const mapping = {
      SYSTEM_ERROR_HANDLER_RECURSION: 'ERROR_HANDLER_RECURSION',
      SYSTEM_ERROR_LOGGING_FAILURE: 'ERROR_LOGGING_FAILURE',
      SYSTEM_RECOVERY_MECHANISM_EXHAUSTED: 'RECOVERY_MECHANISM_EXHAUSTED',
      DATA_ERROR_PATTERN_LEARNING_OVERFLOW: 'PATTERN_LEARNING_OVERFLOW'
    }

    return mapping[standardErrorCode] || 'UNKNOWN_SUBTYPE'
  }

  /**
   * 根據 StandardError 代碼決定嚴重程度
   * @param {string} standardErrorCode - 原始 StandardError 代碼
   * @returns {string} 嚴重程度等級
   */
  static getSeverityFromCode (standardErrorCode) {
    const severityMapping = {
      SYSTEM_ERROR_HANDLER_RECURSION: 'CRITICAL',
      SYSTEM_ERROR_LOGGING_FAILURE: 'MODERATE',
      SYSTEM_RECOVERY_MECHANISM_EXHAUSTED: 'SEVERE',
      DATA_ERROR_PATTERN_LEARNING_OVERFLOW: 'MINOR'
    }

    return severityMapping[standardErrorCode] || 'MODERATE'
  }

  /**
   * 轉換 UC-07 StandardError 為 ErrorCodes 格式
   * @param {string} standardErrorCode - UC-07 StandardError 代碼
   * @param {string} [message] - 錯誤訊息
   * @param {Object} [details] - 詳細資訊
   * @returns {Error} 轉換後的錯誤物件
   */
  static convertError (standardErrorCode, message = 'UC-07 error handling operation failed', details = {}) {
    // 驗證輸入參數
    if (!standardErrorCode || typeof standardErrorCode !== 'string') {
      return this._createConversionError('Invalid error code provided', {
        receivedCode: standardErrorCode,
        conversionError: true
      })
    }

    const errorMapping = this.getErrorMapping()
    const targetErrorCode = errorMapping[standardErrorCode]

    // 處理未知的錯誤代碼
    if (!targetErrorCode) {
      return this._createConversionError(`Unknown UC-07 error code: ${standardErrorCode}`, {
        unknownCode: standardErrorCode,
        availableCodes: Object.keys(errorMapping)
      })
    }

    // 建立轉換後的錯誤
    const error = new Error(message)
    error.name = 'UC07Error'
    error.code = targetErrorCode
    error.subType = this.extractSubType(standardErrorCode)

    // 合併詳細資訊
    error.details = {
      ...details,
      originalCode: standardErrorCode,
      severity: this.getSeverityFromCode(standardErrorCode),
      timestamp: Date.now()
    }

    // 添加 JSON 序列化支援
    error.toJSON = function () {
      return {
        name: this.name,
        message: this.message,
        code: this.code,
        subType: this.subType,
        details: this.details
      }
    }

    return error
  }

  /**
   * 建立轉換錯誤
   * @private
   * @param {string} message - 錯誤訊息
   * @param {Object} details - 詳細資訊
   * @returns {Error} 轉換錯誤物件
   */
  static _createConversionError (message, details) {
    const error = new Error(message)
    error.name = 'UC07ConversionError'
    error.code = ErrorCodes.UNKNOWN_ERROR
    error.subType = 'UC07_CONVERSION_ERROR'
    error.details = {
      ...details,
      conversionError: true,
      timestamp: Date.now()
    }

    error.toJSON = function () {
      return {
        name: this.name,
        message: this.message,
        code: this.code,
        subType: this.subType,
        details: this.details
      }
    }

    return error
  }

  /**
   * 驗證是否為有效的 ErrorCodes 錯誤
   * @param {*} error - 待驗證的錯誤物件
   * @returns {boolean} 是否為有效的 ErrorCodes 錯誤
   */
  static isValidErrorCodesError (error) {
    return error instanceof Error &&
           typeof error.code === 'string' &&
           error.details !== undefined &&
           typeof error.details === 'object' &&
           error.details !== null
  }
}
