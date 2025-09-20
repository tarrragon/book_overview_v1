/**
 * UC-01 ErrorCodes 轉換適配器
 *
 * 功能：將UC-01的10個StandardError轉換為新的ErrorCodes v5.0.0系統
 * 基於：UC-02 成功架構模式
 *
 * 轉換範圍：
 * - 3個 DOM_ERROR: 頁面檢測與元素提取錯誤
 * - 2個 NETWORK_ERROR: 連接與速度問題
 * - 2個 SYSTEM_ERROR: 儲存與記憶體問題
 * - 2個 PLATFORM_ERROR: Chrome Extension 權限與相容性
 * - 1個 DATA_ERROR: 初始化資料損壞
 */

const { ErrorCodes } = require('./ErrorCodes')

/**
 * UC01ErrorAdapter
 * 負責將10個StandardError轉換為對應的ErrorCodes
 *
 * 設計模式：複用UC-02成功架構，針對UC-01特性調整
 * 效能目標：<1ms 轉換時間，零記憶體洩漏
 */
class UC01ErrorAdapter {
  /**
   * 獲取UC-01錯誤映射表
   * @returns {Object} StandardError代碼到ErrorCodes的映射
   */
  static getErrorMapping () {
    if (!this._errorMapping) {
      this._errorMapping = Object.freeze({
        // DOM操作錯誤 → DOM_ERROR
        DOM_READMOO_PAGE_NOT_DETECTED: ErrorCodes.DOM_ERROR,
        DOM_BOOK_ELEMENTS_NOT_FOUND: ErrorCodes.DOM_ERROR,
        DOM_EXTRACTION_PARTIAL_FAILURE: ErrorCodes.DOM_ERROR,

        // 網路錯誤 → NETWORK_ERROR
        NETWORK_READMOO_UNREACHABLE: ErrorCodes.NETWORK_ERROR,
        NETWORK_SLOW_CONNECTION: ErrorCodes.NETWORK_ERROR,

        // 儲存空間錯誤 → STORAGE_ERROR
        SYSTEM_STORAGE_QUOTA_EXCEEDED: ErrorCodes.STORAGE_ERROR,
        DATA_INITIAL_STORAGE_CORRUPTION: ErrorCodes.STORAGE_ERROR,

        // 操作執行錯誤 → OPERATION_ERROR
        SYSTEM_MEMORY_PRESSURE: ErrorCodes.OPERATION_ERROR,

        // Chrome Extension錯誤 → CHROME_ERROR
        PLATFORM_EXTENSION_PERMISSIONS_DENIED: ErrorCodes.CHROME_ERROR,
        PLATFORM_MANIFEST_V3_COMPATIBILITY: ErrorCodes.CHROME_ERROR
      })
    }
    return this._errorMapping
  }

  /**
   * 提取子類型
   */
  static extractSubType (standardErrorCode) {
    const subTypeMapping = {
      DOM_READMOO_PAGE_NOT_DETECTED: 'PAGE_NOT_DETECTED',
      DOM_BOOK_ELEMENTS_NOT_FOUND: 'ELEMENTS_NOT_FOUND',
      DOM_EXTRACTION_PARTIAL_FAILURE: 'EXTRACTION_PARTIAL_FAILURE',
      NETWORK_READMOO_UNREACHABLE: 'READMOO_UNREACHABLE',
      NETWORK_SLOW_CONNECTION: 'SLOW_CONNECTION',
      SYSTEM_STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
      SYSTEM_MEMORY_PRESSURE: 'MEMORY_PRESSURE',
      PLATFORM_EXTENSION_PERMISSIONS_DENIED: 'PERMISSIONS_DENIED',
      PLATFORM_MANIFEST_V3_COMPATIBILITY: 'MANIFEST_V3_COMPATIBILITY',
      DATA_INITIAL_STORAGE_CORRUPTION: 'INITIAL_STORAGE_CORRUPTION'
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
      return this._createConversionError('Unknown UC-01 error code', {
        unknownCode: originalCode,
        availableCodes: Object.keys(mapping)
      })
    }

    // 建立新的Error物件
    const error = new Error(message || 'UC-01 operation failed')
    error.name = 'UC01Error'
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
    const error = new Error(`UC01 Error Conversion Failed: ${message}`)
    error.name = 'UC01ConversionError'
    error.code = ErrorCodes.UNKNOWN_ERROR
    error.subType = 'UC01_CONVERSION_ERROR'
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
      // CRITICAL - 影響首次使用體驗的核心錯誤
      PLATFORM_EXTENSION_PERMISSIONS_DENIED: 'CRITICAL',

      // SEVERE - 嚴重影響功能的錯誤
      DOM_READMOO_PAGE_NOT_DETECTED: 'SEVERE',
      NETWORK_READMOO_UNREACHABLE: 'SEVERE',
      SYSTEM_STORAGE_QUOTA_EXCEEDED: 'SEVERE',
      DATA_INITIAL_STORAGE_CORRUPTION: 'SEVERE',

      // MODERATE - 中等影響的錯誤
      DOM_BOOK_ELEMENTS_NOT_FOUND: 'MODERATE',
      SYSTEM_MEMORY_PRESSURE: 'MODERATE',
      PLATFORM_MANIFEST_V3_COMPATIBILITY: 'MODERATE',

      // MINOR - 輕微影響的錯誤
      DOM_EXTRACTION_PARTIAL_FAILURE: 'MINOR',
      NETWORK_SLOW_CONNECTION: 'MINOR'
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

export { UC01ErrorAdapter }

module.exports = { UC01ErrorAdapter }
