/**
 * UC04ErrorFactory
 * UC-04 資料匯入專用錯誤建立工廠
 * 
 * 功能：提供4個專用錯誤建立方法，針對資料匯入場景優化
 * 基於：UC-01/UC-02/UC-03 成功架構模式，針對匯入場景特化
 * 
 * 專用方法：
 * - createImportFileError: 檔案格式錯誤
 * - createImportParsingError: JSON 解析錯誤  
 * - createImportMergeError: 資料合併衝突錯誤
 * - createImportStorageError: 儲存空間溢出錯誤
 */

import { UC04ErrorAdapter } from './UC04ErrorAdapter.js'
import { ErrorCodes } from './ErrorCodes.js'

/**
 * UC04ErrorFactory
 * 負責建立4種資料匯入專用錯誤，提供便利的工廠方法
 * 
 * 設計模式：複用UC-01/UC-02/UC-03成功架構，針對資料匯入場景優化
 * 效能目標：<200ms 建立100個錯誤，快取機制減少記憶體使用
 */
export class UC04ErrorFactory {
  static _cache = new Map()

  /**
   * 建立基本的 UC-04 錯誤
   * @param {string} originalCode 原始StandardError代碼
   * @param {string} message 錯誤訊息
   * @param {Object} details 詳細資訊
   * @returns {Error} 建立的錯誤物件
   */
  static createError(originalCode, message, details = {}) {
    return UC04ErrorAdapter.convertError(originalCode, message, details)
  }

  /**
   * 建立結果物件
   * @param {boolean} success 是否成功
   * @param {*} data 成功時的資料
   * @param {Error} error 失敗時的錯誤
   * @returns {Object} 統一格式的結果物件
   */
  static createResult(success, data = null, error = null) {
    if (success) {
      return {
        success: true,
        data,
        code: 'SUCCESS',
        message: 'Import completed successfully'
      }
    }

    // 處理錯誤情況
    if (error && typeof error === 'object') {
      if (error.code && error.subType) {
        // 完整的ErrorCodes錯誤
        return {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details || {},
          subType: error.subType
        }
      } else if (error.message) {
        // 簡單的錯誤物件
        return {
          success: false,
          error: error.message,
          code: ErrorCodes.UNKNOWN_ERROR,
          details: {},
          subType: 'UNKNOWN'
        }
      }
    }

    // 預設錯誤
    return {
      success: false,
      error: 'Import operation failed',
      code: ErrorCodes.UNKNOWN_ERROR,
      details: {},
      subType: 'UNKNOWN'
    }
  }

  /**
   * 建立檔案格式錯誤 (FILE_ERROR)
   * @param {string} fileName 檔案名稱
   * @param {string} fileSize 檔案大小
   * @param {Array} validationErrors 驗證錯誤詳細列表
   * @param {string} expectedFormat 預期格式
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} 檔案格式錯誤物件
   */
  static createImportFileError(
    fileName = 'unknown-file.json',
    fileSize = 'unknown',
    validationErrors = [],
    expectedFormat = 'JSON backup format',
    additionalDetails = {}
  ) {
    const details = {
      fileName,
      fileSize,
      validationErrors,
      expectedFormat,
      suggestedActions: ['select_valid_file', 'check_file_format', 'contact_support'],
      userGuidance: '請選擇有效的 JSON 備份檔案',
      fileValidation: {
        hasValidExtension: fileName.endsWith('.json'),
        hasValidSize: fileSize !== 'unknown' && !fileSize.includes('0B'),
        passedInitialCheck: validationErrors.length === 0
      },
      recoveryOptions: ['try_different_file', 'export_new_backup', 'manual_data_entry'],
      ...this.sanitizeDetails(additionalDetails)
    }

    return this.createError(
      'DATA_IMPORT_FILE_INVALID',
      '匯入檔案格式無效',
      details
    )
  }

  /**
   * 建立JSON解析錯誤 (PARSE_ERROR)
   * @param {string} parseError 解析錯誤訊息
   * @param {Object} errorPosition 錯誤位置 {line, column}
   * @param {string} fileSize 檔案大小
   * @param {string} possibleCause 可能原因
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} JSON解析錯誤物件
   */
  static createImportParsingError(
    parseError = 'Unknown JSON syntax error',
    errorPosition = { line: 0, column: 0 },
    fileSize = 'unknown',
    possibleCause = 'file_corruption',
    additionalDetails = {}
  ) {
    const details = {
      parseError,
      errorPosition,
      fileSize,
      possibleCause,
      suggestedActions: ['check_file_integrity', 'try_text_editor', 'request_new_backup'],
      userGuidance: '檔案可能損壞，請檢查檔案完整性或重新產生備份',
      debugInfo: {
        isValidJSON: false,
        truncatedContent: parseError.includes('Unexpected end'),
        hasUnescapedChars: parseError.includes('Unexpected token'),
        estimatedCorruptionPoint: `Line ${errorPosition.line || 'unknown'}`
      },
      recoveryOptions: ['manual_json_repair', 'partial_import', 'fresh_export'],
      ...this.sanitizeDetails(additionalDetails)
    }

    return this.createError(
      'DATA_IMPORT_PARSING_ERROR',
      'JSON 檔案解析錯誤',
      details
    )
  }

  /**
   * 建立資料合併衝突錯誤 (VALIDATION_ERROR)
   * @param {string} conflictType 衝突類型
   * @param {Array} conflictedBooks 衝突書籍列表
   * @param {string} mergeStrategy 合併策略
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} 資料合併衝突錯誤物件
   */
  static createImportMergeError(
    conflictType = 'duplicate_books_with_different_data',
    conflictedBooks = [],
    mergeStrategy = 'user_decision_required',
    additionalDetails = {}
  ) {
    const conflictCount = conflictedBooks.length
    const conflictRate = conflictCount > 0 ? 
      `${((conflictCount / Math.max(conflictCount, 100)) * 100).toFixed(1)}%` : '0%'

    const details = {
      conflictType,
      conflictedBooks: conflictedBooks.slice(0, 10), // 限制顯示前10個衝突
      conflictCount,
      conflictRate,
      mergeStrategy,
      suggestedActions: ['review_conflicts', 'choose_merge_strategy', 'manual_resolution'],
      userGuidance: '發現資料衝突，需要選擇合併策略或手動解決',
      resolutionOptions: {
        keepExisting: '保留現有資料',
        useImported: '使用匯入資料',
        mergeByDate: '依時間戳合併',
        manualReview: '逐一手動檢查'
      },
      conflictAnalysis: {
        hasProgressConflicts: conflictedBooks.some(book => 
          book.existing?.progress !== book.importing?.progress
        ),
        hasMetadataConflicts: conflictedBooks.some(book => 
          JSON.stringify(book.existing?.metadata) !== JSON.stringify(book.importing?.metadata)
        ),
        hasTimestampConflicts: conflictedBooks.some(book => 
          book.existing?.lastRead !== book.importing?.lastRead
        )
      },
      ...this.sanitizeDetails(additionalDetails)
    }

    return this.createError(
      'DATA_IMPORT_MERGE_CONFLICT',
      '資料合併時發生衝突',
      details
    )
  }

  /**
   * 建立儲存空間溢出錯誤 (STORAGE_ERROR)
   * @param {string} existingDataSize 現有資料大小
   * @param {string} importDataSize 匯入資料大小
   * @param {string} storageLimit 儲存限制
   * @param {Array} suggestedActions 建議動作
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} 儲存空間溢出錯誤物件
   */
  static createImportStorageError(
    existingDataSize = '0MB',
    importDataSize = '0MB',
    storageLimit = '5MB',
    suggestedActions = ['clear_old_data', 'selective_import'],
    additionalDetails = {}
  ) {
    // 簡單的大小計算（假設MB格式）
    const parseSize = (sizeStr) => parseFloat(sizeStr.replace('MB', '')) || 0
    const existing = parseSize(existingDataSize)
    const importing = parseSize(importDataSize)
    const limit = parseSize(storageLimit)
    const total = existing + importing
    const overflowAmount = Math.max(0, total - limit)

    const details = {
      existingDataSize,
      importDataSize,
      totalSize: `${total.toFixed(1)}MB`,
      storageLimit,
      overflowAmount: `${overflowAmount.toFixed(1)}MB`,
      storageUsageRate: `${((total / limit) * 100).toFixed(1)}%`,
      suggestedActions,
      userGuidance: '儲存空間不足，建議清理舊資料或選擇性匯入',
      storageAnalysis: {
        canPartialImport: importing > overflowAmount,
        recommendedCleanup: `${Math.ceil(overflowAmount)}MB`,
        estimatedBooks: Math.floor(importing * 100), // 假設1MB = 100本書
        priorityData: ['recent_progress', 'bookmarks', 'reading_history']
      },
      cleanupOptions: {
        removeOldData: '移除6個月前的閱讀記錄',
        compressMetadata: '壓縮書籍中繼資料',
        selectiveImport: '僅匯入指定類別的書籍',
        increaseQuota: '申請更大儲存空間'
      },
      ...this.sanitizeDetails(additionalDetails)
    }

    return this.createError(
      'SYSTEM_IMPORT_STORAGE_OVERFLOW',
      '匯入資料將超出儲存限制',
      details
    )
  }

  /**
   * 建立匯入進度錯誤（輔助方法）
   * @param {number} progress 進度百分比
   * @param {string} stage 失敗階段
   * @param {Object} context 額外上下文
   * @returns {Error} 對應的錯誤物件
   */
  static createImportProgressError(progress, stage, context = {}) {
    if (progress < 50) {
      // 早期失敗 - 通常是檔案問題
      return this.createImportFileError(
        context.fileName || 'import-file.json',
        context.fileSize || 'unknown',
        [{ stage, progress, issue: 'early_failure' }],
        'Valid JSON backup',
        { 
          progress, 
          stage, 
          earlyFailure: true,
          ...context 
        }
      )
    } else {
      // 後期失敗 - 通常是解析或儲存問題
      if (stage.includes('parsing') || stage.includes('json')) {
        return this.createImportParsingError(
          `Parsing failed at ${progress}% completion`,
          { line: Math.floor(progress * 10), column: 0 },
          context.fileSize || 'unknown',
          'partial_corruption',
          { 
            progress, 
            stage, 
            lateFailure: true,
            ...context 
          }
        )
      } else {
        return this.createImportStorageError(
          context.existingSize || '2MB',
          context.importSize || '4MB',
          context.storageLimit || '5MB',
          ['free_space', 'partial_import'],
          { 
            progress, 
            stage, 
            lateFailure: true,
            ...context 
          }
        )
      }
    }
  }

  /**
   * 取得常用錯誤快取
   * @param {string} type 錯誤類型
   * @returns {Error|null} 快取的錯誤物件
   */
  static getCommonError(type) {
    if (this._cache.has(type)) {
      return this._cache.get(type)
    }

    let error = null
    switch (type) {
      case 'IMPORT_FILE':
        error = this.createImportFileError()
        break
      case 'IMPORT_PARSING':
        error = this.createImportParsingError()
        break
      case 'IMPORT_MERGE':
        error = this.createImportMergeError()
        break
      case 'IMPORT_STORAGE':
        error = this.createImportStorageError()
        break
      default:
        return null
    }

    if (error) {
      error.details.cached = true
      Object.freeze(error)
      this._cache.set(type, error)
    }

    return error
  }

  /**
   * 清除錯誤快取
   */
  static clearCache() {
    this._cache.clear()
  }

  /**
   * 清理過大的詳細資訊
   * @param {Object} details 詳細資訊物件
   * @returns {Object} 清理後的詳細資訊
   */
  static sanitizeDetails(details) {
    if (!details || typeof details !== 'object') {
      return {}
    }

    const serialized = JSON.stringify(details)
    const sizeLimit = 15 * 1024 // 15KB limit

    if (serialized.length > sizeLimit) {
      return {
        _truncated: true,
        _originalSize: serialized.length,
        _message: 'Details truncated due to size limit',
        summary: 'Large import data set truncated for memory safety'
      }
    }

    return details
  }

  /**
   * 驗證是否為有效的 UC-04 錯誤
   * @param {Error} error 要驗證的錯誤物件
   * @returns {boolean} 是否為有效的UC-04錯誤
   */
  static isValidUC04Error(error) {
    if (!(error instanceof Error)) return false
    
    // 檢查是否有必要的屬性
    return error.code !== undefined && 
           error.subType !== undefined &&
           error.details !== undefined &&
           typeof error.details === 'object' &&
           // 檢查是否為UC-04相關的subType
           (error.subType.includes('IMPORT_') || error.subType.includes('UC04'))
  }
}