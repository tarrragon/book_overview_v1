/**
 * UC-05 ErrorCodes 轉換適配器
 *
 * 功能：將UC-05的4個StandardError轉換為新的ErrorCodes v5.0.0系統
 * 基於：UC-01/UC-02/UC-03/UC-04 成功架構模式
 *
 * 轉換範圍：
 * - 2個 VALIDATION_ERROR: 版本不相容、時間戳衝突
 * - 1個 NETWORK_ERROR: 雲端服務無法連接
 * - 1個 FILE_ERROR: 同步檔案損壞
 */

const { ErrorCodes } = require('./ErrorCodes')

/**
 * UC05ErrorAdapter
 * 負責將4個StandardError轉換為對應的ErrorCodes
 *
 * 設計模式：複用UC-01/UC-02/UC-03/UC-04成功架構，針對跨設備同步場景優化
 * 效能目標：<1ms 轉換時間，零記憶體洩漏
 */
class UC05ErrorAdapter {
  /**
   * 獲取UC-05錯誤映射表
   * @returns {Object} StandardError代碼到ErrorCodes的映射
   */
  static getErrorMapping () {
    if (!this._errorMapping) {
      this._errorMapping = Object.freeze({
        // 版本相容性驗證錯誤 → VALIDATION_ERROR
        DATA_SYNC_VERSION_MISMATCH: ErrorCodes.VALIDATION_ERROR,

        // 時間戳衝突驗證錯誤 → VALIDATION_ERROR
        DATA_SYNC_TIMESTAMP_CONFLICT: ErrorCodes.VALIDATION_ERROR,

        // 網路連接錯誤 → NETWORK_ERROR
        NETWORK_CLOUD_SERVICE_UNAVAILABLE: ErrorCodes.NETWORK_ERROR,

        // 檔案損壞錯誤 → FILE_ERROR
        DATA_SYNC_CORRUPTION_DETECTED: ErrorCodes.FILE_ERROR
      })
    }
    return this._errorMapping
  }

  /**
   * 提取子類型
   */
  static extractSubType (standardErrorCode) {
    const subTypeMapping = {
      DATA_SYNC_VERSION_MISMATCH: 'SYNC_VERSION_MISMATCH',
      DATA_SYNC_TIMESTAMP_CONFLICT: 'SYNC_TIMESTAMP_CONFLICT',
      NETWORK_CLOUD_SERVICE_UNAVAILABLE: 'CLOUD_SERVICE_UNAVAILABLE',
      DATA_SYNC_CORRUPTION_DETECTED: 'SYNC_CORRUPTION_DETECTED'
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
      return this._createConversionError('Unknown UC-05 error code', {
        unknownCode: originalCode,
        availableCodes: Object.keys(mapping)
      })
    }

    // 建立新的Error物件
    const error = new Error(message || 'UC-05 sync operation failed')
    error.name = 'UC05Error'
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
    const error = new Error(`UC05 Error Conversion Failed: ${message}`)
    error.name = 'UC05ConversionError'
    error.code = ErrorCodes.UNKNOWN_ERROR
    error.subType = 'UC05_CONVERSION_ERROR'
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
      // SEVERE - 嚴重影響同步功能的錯誤
      DATA_SYNC_CORRUPTION_DETECTED: 'SEVERE',

      // MODERATE - 中等影響的錯誤，需要處理但不會完全阻斷同步
      DATA_SYNC_VERSION_MISMATCH: 'MODERATE',
      DATA_SYNC_TIMESTAMP_CONFLICT: 'MODERATE',
      NETWORK_CLOUD_SERVICE_UNAVAILABLE: 'MODERATE'
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

module.exports = { UC05ErrorAdapter }
