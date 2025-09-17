/**
 * UC-04 ErrorCodes 轉換適配器
 * 
 * 功能：將UC-04的4個StandardError轉換為新的ErrorCodes v5.0.0系統
 * 基於：UC-01/UC-02/UC-03 成功架構模式
 * 
 * 轉換範圍：
 * - 1個 FILE_ERROR: 匯入檔案格式錯誤
 * - 1個 PARSE_ERROR: JSON 解析錯誤
 * - 1個 VALIDATION_ERROR: 資料合併衝突錯誤
 * - 1個 STORAGE_ERROR: 儲存空間溢出錯誤
 */

import { ErrorCodes } from './ErrorCodes.js'

/**
 * UC04ErrorAdapter
 * 負責將4個StandardError轉換為對應的ErrorCodes
 * 
 * 設計模式：複用UC-01/UC-02/UC-03成功架構，針對資料匯入場景優化
 * 效能目標：<1ms 轉換時間，零記憶體洩漏
 */
export class UC04ErrorAdapter {
  /**
   * 獲取UC-04錯誤映射表
   * @returns {Object} StandardError代碼到ErrorCodes的映射
   */
  static getErrorMapping() {
    if (!this._errorMapping) {
      this._errorMapping = Object.freeze({
        // 檔案格式錯誤 → FILE_ERROR
        'DATA_IMPORT_FILE_INVALID': ErrorCodes.FILE_ERROR,

        // JSON 解析錯誤 → PARSE_ERROR
        'DATA_IMPORT_PARSING_ERROR': ErrorCodes.PARSE_ERROR,

        // 資料驗證衝突錯誤 → VALIDATION_ERROR
        'DATA_IMPORT_MERGE_CONFLICT': ErrorCodes.VALIDATION_ERROR,

        // 儲存空間錯誤 → STORAGE_ERROR
        'SYSTEM_IMPORT_STORAGE_OVERFLOW': ErrorCodes.STORAGE_ERROR
      })
    }
    return this._errorMapping
  }

  /**
   * 提取子類型
   */
  static extractSubType(standardErrorCode) {
    const subTypeMapping = {
      'DATA_IMPORT_FILE_INVALID': 'IMPORT_FILE_INVALID',
      'DATA_IMPORT_PARSING_ERROR': 'IMPORT_PARSING_ERROR',
      'DATA_IMPORT_MERGE_CONFLICT': 'IMPORT_MERGE_CONFLICT',
      'SYSTEM_IMPORT_STORAGE_OVERFLOW': 'IMPORT_STORAGE_OVERFLOW'
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
  static convertError(originalCode, message, details = {}) {
    if (!originalCode || typeof originalCode !== 'string') {
      return this._createConversionError('Invalid error code provided', { receivedCode: originalCode })
    }

    const mapping = this.getErrorMapping()
    const errorCode = mapping[originalCode]

    if (!errorCode) {
      return this._createConversionError('Unknown UC-04 error code', {
        unknownCode: originalCode,
        availableCodes: Object.keys(mapping)
      })
    }

    // 建立新的Error物件
    const error = new Error(message || 'UC-04 import operation failed')
    error.name = 'UC04Error'
    error.code = errorCode
    error.subType = this.extractSubType(originalCode)
    
    // 合併詳細資訊
    error.details = {
      ...details,
      originalCode: originalCode,
      severity: this.getSeverityFromCode(originalCode),
      timestamp: Date.now()
    }

    // 新增toJSON方法以支援Chrome Extension序列化
    error.toJSON = function() {
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
  static _createConversionError(message, additionalDetails = {}) {
    const error = new Error(`UC04 Error Conversion Failed: ${message}`)
    error.name = 'UC04ConversionError'
    error.code = ErrorCodes.UNKNOWN_ERROR
    error.subType = 'UC04_CONVERSION_ERROR'
    error.details = {
      conversionError: true,
      timestamp: Date.now(),
      ...additionalDetails
    }

    // 新增toJSON方法以支援Chrome Extension序列化
    error.toJSON = function() {
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
  static getSeverityFromCode(originalCode) {
    const severityMapping = {
      // SEVERE - 嚴重影響匯入功能的錯誤
      'DATA_IMPORT_FILE_INVALID': 'SEVERE',
      'DATA_IMPORT_PARSING_ERROR': 'SEVERE',
      'SYSTEM_IMPORT_STORAGE_OVERFLOW': 'SEVERE',
      
      // MODERATE - 中等影響的錯誤，需要使用者決策
      'DATA_IMPORT_MERGE_CONFLICT': 'MODERATE'
    }

    return severityMapping[originalCode] || 'MODERATE'
  }

  /**
   * 驗證是否為有效的ErrorCodes錯誤
   * @param {Error} error 要驗證的錯誤物件
   * @returns {boolean} 是否為有效的ErrorCodes錯誤
   */
  static isValidErrorCodesError(error) {
    if (!(error instanceof Error)) return false
    
    const validCodes = Object.values(ErrorCodes)
    return validCodes.includes(error.code) && 
           error.details !== undefined && 
           error.details !== null &&
           typeof error.details === 'object'
  }
}