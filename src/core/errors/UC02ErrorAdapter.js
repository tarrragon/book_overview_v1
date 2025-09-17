/**
 * UC-02 ErrorCodes 轉換適配器
 * 
 * 功能：將UC-02的15個StandardError轉換為新的ErrorCodes v5.0.0系統
 * 
 * 設計原則：
 * - 漸進式遷移：不破壞現有功能
 * - 向後相容：保留原始錯誤資訊
 * - 效能優化：快取映射表，避免重複計算
 * - 測試驅動：符合TDD Phase 2的12個核心測試案例
 */

import { ErrorCodes } from './ErrorCodes.js'

/**
 * UC-02 專用錯誤轉換適配器
 * 負責將15個StandardError轉換為對應的ErrorCodes
 */
export class UC02ErrorAdapter {
  // 快取映射表，避免重複建立
  static _errorMapping = null

  /**
   * 獲取完整的錯誤映射表
   * @returns {Object} StandardError代碼到ErrorCodes的映射
   */
  static getErrorMapping() {
    if (!this._errorMapping) {
      this._errorMapping = Object.freeze({
        // 資料驗證錯誤 → VALIDATION_ERROR
        'DATA_DUPLICATE_DETECTION_FAILED': ErrorCodes.VALIDATION_ERROR,
        'DATA_PROGRESS_VALIDATION_ERROR': ErrorCodes.VALIDATION_ERROR,
        
        // 書籍處理錯誤 → BOOK_ERROR
        'DATA_INCREMENTAL_UPDATE_CONFLICT': ErrorCodes.BOOK_ERROR,
        
        // DOM操作錯誤 → DOM_ERROR
        'DOM_PAGE_STRUCTURE_CHANGED': ErrorCodes.DOM_ERROR,
        'DOM_INFINITE_SCROLL_DETECTION_FAILED': ErrorCodes.DOM_ERROR,
        
        // 逾時錯誤 → TIMEOUT_ERROR
        'DOM_DYNAMIC_CONTENT_TIMEOUT': ErrorCodes.TIMEOUT_ERROR,
        
        // 操作執行錯誤 → OPERATION_ERROR
        'SYSTEM_INCREMENTAL_PROCESSING_OVERLOAD': ErrorCodes.OPERATION_ERROR,
        'SYSTEM_BACKGROUND_SYNC_FAILURE': ErrorCodes.OPERATION_ERROR,
        
        // 網路錯誤 → NETWORK_ERROR / CONNECTION_ERROR
        'NETWORK_RATE_LIMITING_DETECTED': ErrorCodes.NETWORK_ERROR,
        'NETWORK_PARTIAL_CONNECTIVITY': ErrorCodes.CONNECTION_ERROR,
        
        // Chrome Extension錯誤 → CHROME_ERROR
        'PLATFORM_TAB_SWITCHING_INTERFERENCE': ErrorCodes.CHROME_ERROR,
        'PLATFORM_CHROME_EXTENSION_CONFLICT': ErrorCodes.CHROME_ERROR
      })
    }
    return this._errorMapping
  }

  /**
   * 提取StandardError的子類型
   * @param {string} standardErrorCode - 原始StandardError代碼
   * @returns {string} 子類型標識
   */
  static extractSubType(standardErrorCode) {
    const subTypeMapping = {
      'DATA_DUPLICATE_DETECTION_FAILED': 'DUPLICATE_DETECTION_FAILED',
      'DATA_PROGRESS_VALIDATION_ERROR': 'PROGRESS_VALIDATION_ERROR',
      'DATA_INCREMENTAL_UPDATE_CONFLICT': 'INCREMENTAL_UPDATE_CONFLICT',
      'DOM_PAGE_STRUCTURE_CHANGED': 'PAGE_STRUCTURE_CHANGED',
      'DOM_INFINITE_SCROLL_DETECTION_FAILED': 'INFINITE_SCROLL_FAILED',
      'DOM_DYNAMIC_CONTENT_TIMEOUT': 'DYNAMIC_CONTENT_TIMEOUT',
      'SYSTEM_INCREMENTAL_PROCESSING_OVERLOAD': 'PROCESSING_OVERLOAD',
      'SYSTEM_BACKGROUND_SYNC_FAILURE': 'BACKGROUND_SYNC_FAILURE',
      'NETWORK_RATE_LIMITING_DETECTED': 'RATE_LIMITING_DETECTED',
      'NETWORK_PARTIAL_CONNECTIVITY': 'PARTIAL_CONNECTIVITY',
      'PLATFORM_TAB_SWITCHING_INTERFERENCE': 'TAB_SWITCHING_INTERFERENCE',
      'PLATFORM_CHROME_EXTENSION_CONFLICT': 'EXTENSION_CONFLICT'
    }
    
    return subTypeMapping[standardErrorCode] || 'UNKNOWN_SUBTYPE'
  }

  /**
   * 轉換StandardError為ErrorCodes格式
   * @param {string} standardErrorCode - 原始StandardError代碼
   * @param {string} message - 錯誤訊息
   * @param {Object} details - 錯誤詳細資訊
   * @returns {Error} 轉換後的錯誤物件
   */
  static convertError(standardErrorCode, message, details = {}) {
    // 處理無效輸入
    if (!standardErrorCode || typeof standardErrorCode !== 'string') {
      return this.createUnknownError('Invalid error code provided', {
        receivedCode: standardErrorCode,
        receivedType: typeof standardErrorCode
      })
    }

    const mapping = this.getErrorMapping()
    const errorCode = mapping[standardErrorCode]

    // 處理無法識別的錯誤碼
    if (!errorCode) {
      return this.createUnknownError(`Unknown UC-02 error code: ${standardErrorCode}`, {
        unknownCode: standardErrorCode,
        availableCodes: Object.keys(mapping)
      })
    }

    // 建立轉換後的錯誤物件
    const error = new Error(message)
    error.code = errorCode
    error.subType = this.extractSubType(standardErrorCode)
    error.details = {
      ...details,
      originalCode: standardErrorCode,
      severity: this.getSeverityFromCode(standardErrorCode),
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
   * 建立未知錯誤
   * @param {string} message - 錯誤訊息
   * @param {Object} details - 詳細資訊
   * @returns {Error} 未知錯誤物件
   */
  static createUnknownError(message, details = {}) {
    const error = new Error(message)
    error.code = ErrorCodes.UNKNOWN_ERROR
    error.subType = 'UC02_CONVERSION_ERROR'
    error.details = {
      ...details,
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
   * 根據錯誤代碼獲取嚴重程度
   * @param {string} standardErrorCode - 原始錯誤代碼
   * @returns {string} 嚴重程度 (MINOR/MODERATE/SEVERE)
   */
  static getSeverityFromCode(standardErrorCode) {
    const severityMapping = {
      // MINOR - 使用者體驗影響小
      'DATA_PROGRESS_VALIDATION_ERROR': 'MINOR',
      'PLATFORM_TAB_SWITCHING_INTERFERENCE': 'MINOR',
      
      // MODERATE - 功能受限但可恢復
      'DATA_DUPLICATE_DETECTION_FAILED': 'MODERATE',
      'DATA_INCREMENTAL_UPDATE_CONFLICT': 'MODERATE',
      'DOM_PAGE_STRUCTURE_CHANGED': 'MODERATE',
      'DOM_INFINITE_SCROLL_DETECTION_FAILED': 'MODERATE',
      'DOM_DYNAMIC_CONTENT_TIMEOUT': 'MODERATE',
      'NETWORK_RATE_LIMITING_DETECTED': 'MODERATE',
      'NETWORK_PARTIAL_CONNECTIVITY': 'MODERATE',
      'PLATFORM_CHROME_EXTENSION_CONFLICT': 'MODERATE',
      
      // SEVERE - 核心功能完全失效
      'SYSTEM_INCREMENTAL_PROCESSING_OVERLOAD': 'SEVERE',
      'SYSTEM_BACKGROUND_SYNC_FAILURE': 'SEVERE'
    }
    
    return severityMapping[standardErrorCode] || 'MODERATE'
  }

  /**
   * 驗證轉換後的錯誤物件
   * @param {Error} error - 要驗證的錯誤物件
   * @returns {boolean} 是否為有效的ErrorCodes錯誤
   */
  static isValidErrorCodesError(error) {
    if (!(error instanceof Error)) {
      return false
    }

    const validCodes = Object.values(ErrorCodes)
    return validCodes.includes(error.code) && 
           error.details && 
           typeof error.details === 'object'
  }
}

