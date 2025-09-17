/**
 * UC-02 ErrorCodes 工廠類別
 * 
 * 功能：提供UC-02專用的錯誤建立和結果處理API
 * 
 * 設計原則：
 * - 統一介面：整合createError和createResult API
 * - 類型安全：提供特定錯誤類型的建立方法
 * - 效能優化：預建立常用錯誤，避免重複建立
 * - 向後相容：保持與現有API的一致性
 */

import { ErrorCodes, createError, createResult } from './index.js'
import { UC02ErrorAdapter } from './UC02ErrorAdapter.js'

/**
 * UC-02 專用錯誤工廠
 * 提供類型安全的錯誤建立方法和標準化操作結果
 */
export class UC02ErrorFactory {
  // 預建立的常用錯誤快取
  static _commonErrors = new Map()

  /**
   * 建立 UC-02 專用錯誤
   * @param {string} originalCode - 原始 StandardError 錯誤碼
   * @param {string} message - 錯誤訊息
   * @param {Object} details - 錯誤詳細資訊
   * @returns {Error} 符合 ErrorCodes 格式的錯誤物件
   */
  static createError(originalCode, message, details = {}) {
    const sanitizedDetails = this.sanitizeDetails(details)
    return UC02ErrorAdapter.convertError(originalCode, message, sanitizedDetails)
  }

  /**
   * 建立 UC-02 操作結果
   * @param {boolean} success - 操作是否成功
   * @param {any} data - 成功時的資料
   * @param {Error} error - 失敗時的錯誤物件
   * @returns {Object} 標準化操作結果
   */
  static createResult(success, data = null, error = null) {
    if (success) {
      return {
        success: true,
        data: data,
        code: 'SUCCESS',
        message: 'Operation completed successfully'
      }
    } else {
      return {
        success: false,
        error: error?.message || 'Operation failed',
        code: error?.code || ErrorCodes.UNKNOWN_ERROR,
        details: error?.details || {},
        subType: error?.subType || null
      }
    }
  }

  // ========== 專用錯誤建立方法 ==========
  
  /**
   * 建立重複檢測失敗錯誤
   * @param {Array} affectedBooks - 受影響的書籍清單
   * @param {Object} additionalDetails - 額外詳細資訊
   * @returns {Error} VALIDATION_ERROR 類型錯誤
   */
  static createDuplicateDetectionError(affectedBooks = [], additionalDetails = {}) {
    return this.createError(
      'DATA_DUPLICATE_DETECTION_FAILED',
      '重複書籍檢測機制失敗',
      {
        affectedBooks: affectedBooks,
        fallbackStrategy: 'manual_review',
        totalBooksScanned: affectedBooks.length,
        ...additionalDetails
      }
    )
  }

  /**
   * 建立進度驗證錯誤
   * @param {any} invalidProgressData - 無效的進度資料
   * @param {Object} additionalDetails - 額外詳細資訊
   * @returns {Error} VALIDATION_ERROR 類型錯誤
   */
  static createProgressValidationError(invalidProgressData, additionalDetails = {}) {
    return this.createError(
      'DATA_PROGRESS_VALIDATION_ERROR',
      '閱讀進度格式驗證失敗',
      {
        invalidProgressData: invalidProgressData,
        correctionAttempted: true,
        validRange: '0-100%',
        ...additionalDetails
      }
    )
  }

  /**
   * 建立增量更新衝突錯誤
   * @param {Array} conflictedBooks - 衝突的書籍清單
   * @param {Object} additionalDetails - 額外詳細資訊
   * @returns {Error} BOOK_ERROR 類型錯誤
   */
  static createIncrementalUpdateError(conflictedBooks = [], additionalDetails = {}) {
    return this.createError(
      'DATA_INCREMENTAL_UPDATE_CONFLICT',
      '增量更新時發生資料衝突',
      {
        conflictedBooks: conflictedBooks,
        suggestedResolution: 'keep_higher_progress',
        conflictType: 'progress_regression',
        ...additionalDetails
      }
    )
  }

  /**
   * 建立頁面結構變化錯誤
   * @param {Array} detectedChanges - 檢測到的變化清單
   * @param {Object} additionalDetails - 額外詳細資訊
   * @returns {Error} DOM_ERROR 類型錯誤
   */
  static createPageStructureError(detectedChanges = [], additionalDetails = {}) {
    return this.createError(
      'DOM_PAGE_STRUCTURE_CHANGED',
      'Readmoo 頁面結構已更新，需要適應新版面',
      {
        detectedChanges: detectedChanges,
        adaptationAttempted: true,
        fallbackSelectorsAvailable: true,
        ...additionalDetails
      }
    )
  }

  /**
   * 建立無限滾動檢測失敗錯誤
   * @param {Object} scrollContext - 滾動上下文資訊
   * @param {Object} additionalDetails - 額外詳細資訊
   * @returns {Error} DOM_ERROR 類型錯誤
   */
  static createInfiniteScrollError(scrollContext = {}, additionalDetails = {}) {
    return this.createError(
      'DOM_INFINITE_SCROLL_DETECTION_FAILED',
      '無限滾動檢測機制失敗',
      {
        scrollContext: scrollContext,
        retryAttempted: true,
        fallbackStrategy: 'pagination_detection',
        ...additionalDetails
      }
    )
  }

  /**
   * 建立頻率限制錯誤
   * @param {Object} rateLimitInfo - 頻率限制資訊
   * @param {Object} additionalDetails - 額外詳細資訊
   * @returns {Error} NETWORK_ERROR 類型錯誤
   */
  static createRateLimitError(rateLimitInfo = {}, additionalDetails = {}) {
    const backoffDelay = Math.min(rateLimitInfo.backoffDelay || 60000, 300000) // 最大5分鐘
    
    return this.createError(
      'NETWORK_RATE_LIMITING_DETECTED',
      '檢測到 Readmoo 頻率限制',
      {
        rateLimitInfo: rateLimitInfo,
        backoffDelay: backoffDelay,
        maxRetries: 3,
        safetyTimeout: backoffDelay * 1.5,
        ...additionalDetails
      }
    )
  }

  /**
   * 建立Chrome Extension衝突錯誤
   * @param {Array} conflictingExtensions - 衝突的擴充功能清單
   * @param {Object} additionalDetails - 額外詳細資訊
   * @returns {Error} CHROME_ERROR 類型錯誤
   */
  static createExtensionConflictError(conflictingExtensions = [], additionalDetails = {}) {
    return this.createError(
      'PLATFORM_CHROME_EXTENSION_CONFLICT',
      'Chrome 擴充功能衝突影響書籍提取',
      {
        conflictingExtensions: conflictingExtensions,
        isolationAttempted: true,
        recommendedAction: 'disable_conflicting_extensions',
        ...additionalDetails
      }
    )
  }

  // ========== 快取和效能優化 ==========

  /**
   * 獲取預建立的常用錯誤
   * @param {string} errorType - 錯誤類型
   * @returns {Error|null} 預建立的錯誤物件
   */
  static getCommonError(errorType) {
    if (!this._commonErrors.has(errorType)) {
      // 依照需求建立常用錯誤
      switch (errorType) {
        case 'DUPLICATE_DETECTION':
          this._commonErrors.set(errorType, Object.freeze(
            this.createDuplicateDetectionError()
          ))
          break
        case 'PROGRESS_VALIDATION':
          this._commonErrors.set(errorType, Object.freeze(
            this.createProgressValidationError('invalid_format')
          ))
          break
        case 'PAGE_STRUCTURE':
          this._commonErrors.set(errorType, Object.freeze(
            this.createPageStructureError(['selector_not_found'])
          ))
          break
        default:
          return null
      }
    }
    
    return this._commonErrors.get(errorType)
  }

  /**
   * 清除錯誤快取（主要用於測試）
   */
  static clearCache() {
    this._commonErrors.clear()
  }

  /**
   * 驗證錯誤物件是否符合UC-02規範
   * @param {Error} error - 要驗證的錯誤物件
   * @returns {boolean} 是否為有效的UC-02錯誤
   */
  static isValidUC02Error(error) {
    return UC02ErrorAdapter.isValidErrorCodesError(error) &&
           error.details &&
           error.details.originalCode &&
           UC02ErrorAdapter.getErrorMapping()[error.details.originalCode] !== undefined
  }

  /**
   * 安全化錯誤詳細資訊（避免記憶體問題）
   * @param {Object} details - 原始詳細資訊
   * @returns {Object} 安全化後的詳細資訊
   */
  static sanitizeDetails(details) {
    const maxSize = 15 * 1024 // 15KB 限制
    const stringified = JSON.stringify(details)
    
    if (stringified.length > maxSize) {
      // 實際截斷大檔案，保留基本資訊
      const truncatedDetails = {
        _truncated: true,
        _originalSize: stringified.length,
        _message: 'Details truncated due to size limit'
      }
      
      // 嘗試保留重要的小型欄位
      Object.keys(details).forEach(key => {
        const fieldValue = details[key]
        const fieldSize = JSON.stringify(fieldValue).length
        
        // 只保留小於1KB的欄位
        if (fieldSize < 1024) {
          truncatedDetails[key] = fieldValue
        } else if (Array.isArray(fieldValue)) {
          // 對陣列進行採樣
          truncatedDetails[key] = fieldValue.slice(0, 3)
          truncatedDetails[`${key}_count`] = fieldValue.length
        }
      })
      
      return truncatedDetails
    }
    
    return details
  }
}

