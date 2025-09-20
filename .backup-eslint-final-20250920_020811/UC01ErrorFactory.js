/**
 * UC-01 ErrorCodes 錯誤工廠
 *
 * 功能：為UC-01首次安裝與設定流程提供專用錯誤建立方法
 * 基於：UC-02 成功架構模式，針對UC-01特性優化
 *
 * 特色：
 * - 首次使用體驗專用錯誤處理
 * - Chrome Extension 權限與相容性錯誤
 * - 初始化階段儲存與網路錯誤處理
 */

import { UC01ErrorAdapter } from './UC01ErrorAdapter.js'
const { ErrorCodes } = require("./ErrorCodes")

/**
 * UC01ErrorFactory
 * UC-01專用的錯誤建立工廠
 */
class UC01ErrorFactory {
  /**
   * 建立通用的UC-01錯誤
   * @param {string} originalCode 原始錯誤代碼
   * @param {string} message 錯誤訊息
   * @param {Object} details 詳細資訊
   * @returns {Error} ErrorCodes格式錯誤
   */
  static createError (originalCode, message, details = {}) {
    return UC01ErrorAdapter.convertError(originalCode, message, details)
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
        message: 'Operation completed successfully'
      }
    } else {
      return {
        success: false,
        error: error?.message || 'Unknown error',
        code: error?.code || ErrorCodes.UNKNOWN_ERROR,
        details: error?.details || {},
        subType: error?.subType || 'UNKNOWN'
      }
    }
  }

  /**
   * 建立頁面檢測錯誤 (高頻使用)
   * @param {string} currentUrl 當前URL
   * @param {Array} expectedPatterns 預期的URL模式
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} DOM_ERROR 類型錯誤
   */
  static createPageDetectionError (currentUrl, expectedPatterns = [], additionalDetails = {}) {
    return this.createError(
      'DOM_READMOO_PAGE_NOT_DETECTED',
      '無法檢測到 Readmoo 書庫頁面',
      {
        currentUrl,
        expectedPatterns: expectedPatterns.length > 0 ? expectedPatterns : ['readmoo.com/library', 'readmoo.com/shelf'],
        suggestedAction: 'navigate_to_readmoo_library',
        userGuidance: '請先前往 Readmoo 書庫頁面，再使用書籍提取功能',
        ...additionalDetails
      }
    )
  }

  /**
   * 建立書籍元素未找到錯誤
   * @param {Array} searchSelectors 搜尋過的選擇器
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} DOM_ERROR 類型錯誤
   */
  static createBookElementsError (searchSelectors = [], additionalDetails = {}) {
    return this.createError(
      'DOM_BOOK_ELEMENTS_NOT_FOUND',
      '頁面中找不到書籍元素',
      {
        searchSelectors: searchSelectors.length > 0 ? searchSelectors : ['.book-item', '.library-book', '[data-book-id]'],
        pageStructureChanged: true,
        fallbackAttempted: false,
        suggestedAction: 'refresh_page_or_check_library',
        ...additionalDetails
      }
    )
  }

  /**
   * 建立部分提取失敗錯誤
   * @param {number} totalBooks 總書籍數
   * @param {number} successfulExtractions 成功提取數
   * @param {Array} failedBooks 失敗的書籍
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} DOM_ERROR 類型錯誤
   */
  static createPartialExtractionError (totalBooks, successfulExtractions, failedBooks = [], additionalDetails = {}) {
    return this.createError(
      'DOM_EXTRACTION_PARTIAL_FAILURE',
      '部分書籍資料提取失敗',
      {
        totalBooks,
        successfulExtractions,
        failedBooks,
        successRate: totalBooks > 0 ? (successfulExtractions / totalBooks * 100).toFixed(1) + '%' : '0%',
        impact: 'partial_data_available',
        ...additionalDetails
      }
    )
  }

  /**
   * 建立網路連接錯誤 (首次使用關鍵)
   * @param {string} endpoint 連接端點
   * @param {number} timeout 超時時間
   * @param {number} retryCount 重試次數
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} NETWORK_ERROR 類型錯誤
   */
  static createNetworkUnreachableError (endpoint = 'readmoo.com', timeout = 5000, retryCount = 3, additionalDetails = {}) {
    return this.createError(
      'NETWORK_READMOO_UNREACHABLE',
      'Readmoo 服務暫時無法連接',
      {
        endpoint,
        timeout,
        retryCount,
        suggestedActions: ['check_network_connection', 'retry_later', 'use_offline_mode'],
        troubleshooting: 'network_diagnostics_available',
        ...additionalDetails
      }
    )
  }

  /**
   * 建立權限拒絕錯誤 (CRITICAL)
   * @param {Array} requiredPermissions 需要的權限
   * @param {Array} missingPermissions 缺少的權限
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} CHROME_ERROR 類型錯誤
   */
  static createPermissionDeniedError (requiredPermissions = [], missingPermissions = [], additionalDetails = {}) {
    return this.createError(
      'PLATFORM_EXTENSION_PERMISSIONS_DENIED',
      'Extension 權限不足',
      {
        requiredPermissions: requiredPermissions.length > 0 ? requiredPermissions : ['activeTab', 'storage'],
        missingPermissions: missingPermissions.length > 0 ? missingPermissions : ['activeTab'],
        chromeVersion: additionalDetails.chromeVersion || 'unknown',
        suggestedActions: ['reauthorize_extension', 'check_extension_settings', 'reinstall_if_needed'],
        userGuidance: '請重新授權 Extension 權限以繼續使用',
        ...additionalDetails
      }
    )
  }

  /**
   * 建立儲存空間不足錯誤 (首次安裝常見)
   * @param {number} currentUsage 當前使用量 (MB)
   * @param {number} maxQuota 最大配額 (MB)
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} STORAGE_ERROR 類型錯誤
   */
  static createStorageQuotaError (currentUsage, maxQuota = 5.0, additionalDetails = {}) {
    return this.createError(
      'SYSTEM_STORAGE_QUOTA_EXCEEDED',
      'Extension 儲存空間不足',
      {
        currentUsage,
        maxQuota,
        unit: 'MB',
        utilizationRate: maxQuota > 0 ? (currentUsage / maxQuota * 100).toFixed(1) + '%' : '100%',
        suggestedActions: ['clear_old_data', 'export_then_delete', 'upgrade_storage'],
        cleanupAvailable: true,
        ...additionalDetails
      }
    )
  }

  /**
   * 建立初始儲存損壞錯誤
   * @param {Object} corruptedData 損壞的資料
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} STORAGE_ERROR 類型錯誤
   */
  static createInitialStorageCorruptionError (corruptedData = {}, additionalDetails = {}) {
    return this.createError(
      'DATA_INITIAL_STORAGE_CORRUPTION',
      '初始化儲存資料時發現損壞',
      {
        corruptedData,
        recoveryAttempted: true,
        backupAvailable: false,
        autoRepairEnabled: true,
        suggestedActions: ['auto_repair', 'clean_reinstall'],
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
        case 'PAGE_DETECTION':
          error = Object.freeze(this.createPageDetectionError('unknown', [], { cached: true }))
          break
        case 'PERMISSION_DENIED':
          error = Object.freeze(this.createPermissionDeniedError([], [], { cached: true }))
          break
        case 'STORAGE_QUOTA':
          error = Object.freeze(this.createStorageQuotaError(5.0, 5.0, { cached: true }))
          break
        case 'NETWORK_UNREACHABLE':
          error = Object.freeze(this.createNetworkUnreachableError('readmoo.com', 5000, 3, { cached: true }))
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
        summary: 'Large data set truncated for memory safety'
      }
    }

    return details
  }

  /**
   * 驗證是否為有效的UC-01錯誤
   */
  static isValidUC01Error (error) {
    return UC01ErrorAdapter.isValidErrorCodesError(error) &&
           error.details &&
           error.details.originalCode &&
           UC01ErrorAdapter.getErrorMapping().hasOwnProperty(error.details.originalCode)
  }
}

export { UC01ErrorFactory }

module.exports = { UC01ErrorFactory }
