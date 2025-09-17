/**
 * UC-03 ErrorCodes 轉換適配器
 *
 * 功能：將UC-03的4個StandardError轉換為新的ErrorCodes v5.0.0系統
 * 基於：UC-01/UC-02 成功架構模式
 *
 * 轉換範圍：
 * - 1個 FILE_ERROR: 匯出檔案生成錯誤
 * - 1個 OPERATION_ERROR: 記憶體操作錯誤
 * - 1個 CHROME_ERROR: 瀏覽器下載限制錯誤
 * - 1個 VALIDATION_ERROR: 資料完整性驗證錯誤
 */
import { ErrorCodes } from './ErrorCodes.js'
/**
 * UC03ErrorAdapter
 * 負責將4個StandardError轉換為對應的ErrorCodes
 *
 * 設計模式：複用UC-01/UC-02成功架構，針對資料匯出場景優化
 * 效能目標：<1ms 轉換時間，零記憶體洩漏
 */
export class UC03ErrorAdapter {
  /**
   * 獲取UC-03錯誤映射表
   * @returns {Object} StandardError代碼到ErrorCodes的映射
   */
  static getErrorMapping () {
    if (!this._errorMapping) {
      this._errorMapping = Object.freeze({
        // 檔案處理錯誤 → FILE_ERROR
        DATA_EXPORT_GENERATION_FAILED: ErrorCodes.FILE_ERROR,
        // 操作執行錯誤 → OPERATION_ERROR
        SYSTEM_EXPORT_MEMORY_EXHAUSTED: ErrorCodes.OPERATION_ERROR,
        // 瀏覽器/擴充功能錯誤 → CHROME_ERROR
        PLATFORM_DOWNLOAD_BLOCKED: ErrorCodes.CHROME_ERROR,
        // 資料驗證錯誤 → VALIDATION_ERROR
        DATA_EXPORT_INTEGRITY_VIOLATION: ErrorCodes.VALIDATION_ERROR
      })
    }
    return this._errorMapping
  }

  /**
   * 提取子類型
   */
  static extractSubType (standardErrorCode) {
    const subTypeMapping = {
      DATA_EXPORT_GENERATION_FAILED: 'EXPORT_GENERATION_FAILED',
      SYSTEM_EXPORT_MEMORY_EXHAUSTED: 'EXPORT_MEMORY_EXHAUSTED',
      PLATFORM_DOWNLOAD_BLOCKED: 'DOWNLOAD_BLOCKED',
      DATA_EXPORT_INTEGRITY_VIOLATION: 'EXPORT_INTEGRITY_VIOLATION'
    }
    return subTypeMapping[standardErrorCode] || 'UNKNOWN_SUBTYPE'
  }

  /**
   * 轉換StandardError為ErrorCodes格式
   * @param {string} originalCode 原始StandardError代碼
   * @param {string} message 錯誤訊息
   * @param {Object} details 詳細資訊
   * @returns {Error} 轉換後的Error物件
   */
  static convertError (originalCode, message, details = {}) {
    if (!originalCode || typeof originalCode !== 'string') {
      return this._createConversionError('Invalid error code provided', { receivedCode: originalCode })
    }
    const mapping = this.getErrorMapping()
    const errorCode = mapping[originalCode]
    if (!errorCode) {
      return this._createConversionError('Unknown UC-03 error code', {
        unknownCode: originalCode,
        availableCodes: Object.keys(mapping)
      })
    }
    // 建立新的Error物件
    const error = new Error(message || 'UC-03 export operation failed')
    error.name = 'UC03Error'
    error.code = errorCode
    error.subType = this.extractSubType(originalCode)
    // 合併詳細資訊
    error.details = {
      ...details,
      originalCode,
      severity: this.getSeverityFromCode(originalCode),
      timestamp: Date.now()
    }
    // 新增toJSON方法以支援Chrome Extension序列化
    error.toJSON = function () {
      return {
        message: this.message,
        name: this.name,
        stack: this.stack,
        code: this.code,
        subType: this.subType,
        details: this.details
      }
    }
    return error
  }

  /**
   * 建立轉換錯誤
   */
  static _createConversionError (message, additionalDetails = {}) {
    const error = new Error(`UC03 Error Conversion Failed: ${message}`)
    error.name = 'UC03ConversionError'
    error.code = ErrorCodes.UNKNOWN_ERROR
    error.subType = 'UC03_CONVERSION_ERROR'
    error.details = {
      conversionError: true,
      timestamp: Date.now(),
      ...additionalDetails
    }
    // 新增toJSON方法以支援Chrome Extension序列化
    error.toJSON = function () {
      return {
        message: this.message,
        name: this.name,
        stack: this.stack,
        code: this.code,
        subType: this.subType,
        details: this.details
      }
    }
    return error
  }

  /**
   * 獲取錯誤嚴重程度
   */
  static getSeverityFromCode (originalCode) {
    const severityMapping = {
      // SEVERE - 嚴重影響匯出功能的錯誤
      DATA_EXPORT_GENERATION_FAILED: 'SEVERE',
      DATA_EXPORT_INTEGRITY_VIOLATION: 'SEVERE',
      // MODERATE - 中等影響的錯誤，有恢復方案
      SYSTEM_EXPORT_MEMORY_EXHAUSTED: 'MODERATE',
      PLATFORM_DOWNLOAD_BLOCKED: 'MODERATE'
    }
    return severityMapping[originalCode] || 'MODERATE'
  }

  /**
   * 驗證是否為有效的ErrorCodes錯誤
   * @param {Error} error 要驗證的錯誤物件
   * @returns {boolean} 是否為有效的ErrorCodes錯誤
   */
  static isValidErrorCodesError (error) {
    if (!(error instanceof Error)) return false
    const validCodes = Object.values(ErrorCodes)
    return validCodes.includes(error.code) &&
           error.details !== undefined &&
           error.details !== null &&
           typeof error.details === 'object'
  }
}
