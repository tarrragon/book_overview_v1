/**
 * UC-06 ErrorCodes 轉換適配器
 *
 * 功能：將UC-06的4個StandardError轉換為新的ErrorCodes v5.0.0系統
 * 基於：UC-01~UC-05 成功架構模式
 *
 * 轉換範圍：
 * - 1個 RENDER_ERROR: Overview頁面渲染失敗
 * - 1個 STORAGE_ERROR: 搜尋索引損壞
 * - 1個 PERFORMANCE_ERROR: 分頁載入溢出
 * - 1個 VALIDATION_ERROR: 編輯驗證衝突
 */

import { ErrorCodes } from './ErrorCodes.js'

/**
 * UC06ErrorAdapter
 * 負責將4個StandardError轉換為對應的ErrorCodes
 *
 * 設計模式：複用UC-01~UC-05成功架構，針對資料管理UI場景優化
 * 效能目標：<1ms 轉換時間，零記憶體洩漏
 */
export class UC06ErrorAdapter {
  /**
   * 獲取UC-06錯誤映射表
   * @returns {Object} StandardError代碼到ErrorCodes的映射
   */
  static getErrorMapping () {
    if (!this._errorMapping) {
      this._errorMapping = Object.freeze({
        // 系統渲染錯誤 → RENDER_ERROR
        SYSTEM_OVERVIEW_RENDERING_FAILURE: ErrorCodes.RENDER_ERROR,

        // 資料索引損壞 → STORAGE_ERROR
        DATA_SEARCH_INDEX_CORRUPTION: ErrorCodes.STORAGE_ERROR,

        // 系統效能問題 → PERFORMANCE_ERROR
        SYSTEM_PAGINATION_OVERFLOW: ErrorCodes.PERFORMANCE_ERROR,

        // 資料驗證錯誤 → VALIDATION_ERROR
        DATA_EDIT_VALIDATION_CONFLICT: ErrorCodes.VALIDATION_ERROR
      })
    }
    return this._errorMapping
  }

  /**
   * 提取子類型
   */
  static extractSubType (standardErrorCode) {
    const subTypeMapping = {
      SYSTEM_OVERVIEW_RENDERING_FAILURE: 'OVERVIEW_RENDERING_FAILURE',
      DATA_SEARCH_INDEX_CORRUPTION: 'SEARCH_INDEX_CORRUPTION',
      SYSTEM_PAGINATION_OVERFLOW: 'PAGINATION_OVERFLOW',
      DATA_EDIT_VALIDATION_CONFLICT: 'EDIT_VALIDATION_CONFLICT'
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
      return this._createConversionError('Unknown UC-06 error code', {
        unknownCode: originalCode,
        availableCodes: Object.keys(mapping)
      })
    }

    // 建立新的Error物件
    const error = new Error(message || 'UC-06 data management operation failed')
    error.name = 'UC06Error'
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
    const error = new Error(`UC06 Error Conversion Failed: ${message}`)
    error.name = 'UC06ConversionError'
    error.code = ErrorCodes.UNKNOWN_ERROR
    error.subType = 'UC06_CONVERSION_ERROR'
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
      // SEVERE - 嚴重影響使用者操作的錯誤
      SYSTEM_OVERVIEW_RENDERING_FAILURE: 'SEVERE',

      // MODERATE - 中等影響的錯誤
      DATA_SEARCH_INDEX_CORRUPTION: 'MODERATE',

      // MINOR - 輕微影響的錯誤
      SYSTEM_PAGINATION_OVERFLOW: 'MINOR',
      DATA_EDIT_VALIDATION_CONFLICT: 'MINOR'
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
