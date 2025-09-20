/**
 * UC-06 ErrorFactory 錯誤工廠
 *
 * 功能：為UC-06資料管理UI場景提供專用錯誤建立方法
 * 基於：UC-01~UC-05 成功架構模式
 *
 * 專用方法：
 * - createRenderingError: Overview頁面渲染失敗
 * - createSearchIndexError: 搜尋索引損壞
 * - createPaginationError: 分頁載入溢出
 * - createEditValidationError: 編輯驗證衝突
 */

import { UC06ErrorAdapter } from './UC06ErrorAdapter.js'
const { ErrorCodes } = require('./ErrorCodes')

/**
 * UC06ErrorFactory
 * 提供UC-06專用的錯誤建立方法
 *
 * 設計模式：工廠模式，提供語義化的錯誤建立介面
 * 效能優化：內建快取機制，減少重複建立開銷
 */
class UC06ErrorFactory {
  static _cache = new Map()

  /**
   * 建立基本的 UC-06 錯誤
   * @param {string} originalCode 原始StandardError代碼
   * @param {string} message 錯誤訊息
   * @param {Object} details 詳細資訊
   * @returns {Error} 建立的錯誤物件
   */
  static createError (originalCode, message, details = {}) {
    return UC06ErrorAdapter.convertError(originalCode, message, details)
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
        message: 'Data management operation completed successfully'
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
      error: 'Data management operation failed',
      code: ErrorCodes.UNKNOWN_ERROR,
      details: {},
      subType: 'UNKNOWN'
    }
  }

  /**
   * 建立Overview頁面渲染失敗錯誤 (RENDER_ERROR)
   * @param {number} totalBooks 書籍總數
   * @param {string} renderAttempt 渲染嘗試階段
   * @param {string} memoryUsage 記憶體使用率
   * @param {string} failurePoint 失敗點
   * @param {boolean} degradedModeAvailable 是否有降級模式
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} 渲染失敗錯誤物件
   */
  static createRenderingError (
    totalBooks = 0,
    renderAttempt = 'initial_load',
    memoryUsage = 'unknown',
    failurePoint = 'unknown',
    degradedModeAvailable = true,
    additionalDetails = {}
  ) {
    const renderingStrategy = this._determineRenderingStrategy(totalBooks, memoryUsage)

    const details = {
      totalBooks,
      renderAttempt,
      memoryUsage,
      failurePoint,
      degradedModeAvailable,
      renderingStrategy,
      suggestedActions: this._getRenderingActions(failurePoint, degradedModeAvailable),
      userGuidance: 'Overview頁面載入失敗，嘗試使用降級模式或減少顯示數量',
      performanceMetrics: {
        estimatedRenderTime: this._estimateRenderTime(totalBooks),
        memoryRequired: this._estimateMemoryRequired(totalBooks),
        optimizationSuggested: totalBooks > 100
      },
      fallbackOptions: {
        useVirtualScrolling: totalBooks > 200,
        usePagination: totalBooks > 500,
        useSimplifiedView: degradedModeAvailable
      },
      ...this.sanitizeDetails(additionalDetails)
    }

    return this.createError(
      'SYSTEM_OVERVIEW_RENDERING_FAILURE',
      'Overview 頁面渲染失敗',
      details
    )
  }

  /**
   * 建立搜尋索引損壞錯誤 (STORAGE_ERROR)
   * @param {Array} corruptedFields 損壞的索引欄位
   * @param {string} searchAccuracy 搜尋精確度狀態
   * @param {boolean} rebuildRequired 是否需要重建
   * @param {string} estimatedRebuildTime 預估重建時間
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} 索引損壞錯誤物件
   */
  static createSearchIndexError (
    corruptedFields = [],
    searchAccuracy = 'degraded',
    rebuildRequired = true,
    estimatedRebuildTime = '30s',
    additionalDetails = {}
  ) {
    const indexHealthScore = this._calculateIndexHealth(corruptedFields, searchAccuracy)

    const details = {
      corruptedFields,
      corruptedFieldsCount: corruptedFields.length,
      searchAccuracy,
      rebuildRequired,
      estimatedRebuildTime,
      indexHealthScore,
      suggestedActions: this._getIndexRecoveryActions(rebuildRequired, corruptedFields.length),
      userGuidance: '搜尋索引需要修復，部分搜尋功能可能暫時不可用',
      searchCapabilities: {
        titleSearch: !corruptedFields.includes('title_index'),
        authorSearch: !corruptedFields.includes('author_index'),
        contentSearch: !corruptedFields.includes('content_index'),
        fuzzySearch: searchAccuracy !== 'failed'
      },
      rebuildStrategy: {
        autoRebuild: rebuildRequired && estimatedRebuildTime !== 'unknown',
        backgroundProcess: true,
        priorityFields: ['title_index', 'author_index']
      },
      ...this.sanitizeDetails(additionalDetails)
    }

    return this.createError(
      'DATA_SEARCH_INDEX_CORRUPTION',
      '搜尋索引損壞，影響搜尋功能',
      details
    )
  }

  /**
   * 建立分頁載入溢出錯誤 (PERFORMANCE_ERROR)
   * @param {number} requestedPage 請求的頁碼
   * @param {number} booksPerPage 每頁書籍數
   * @param {number} totalBooks 書籍總數
   * @param {boolean} loadTimeout 是否載入超時
   * @param {string} fallbackStrategy 備用策略
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} 分頁溢出錯誤物件
   */
  static createPaginationError (
    requestedPage = 1,
    booksPerPage = 50,
    totalBooks = 0,
    loadTimeout = false,
    fallbackStrategy = 'reduce_page_size',
    additionalDetails = {}
  ) {
    const optimizedPageSize = this._calculateOptimalPageSize(totalBooks, loadTimeout)
    const totalPages = Math.ceil(totalBooks / booksPerPage)

    const details = {
      requestedPage,
      booksPerPage,
      totalBooks,
      totalPages,
      loadTimeout,
      fallbackStrategy,
      optimizedPageSize,
      suggestedActions: this._getPaginationActions(fallbackStrategy, loadTimeout),
      userGuidance: '頁面載入資料過多，建議減少每頁顯示數量或使用篩選功能',
      performanceAnalysis: {
        dataOverload: booksPerPage > optimizedPageSize,
        pageOutOfBounds: requestedPage > totalPages,
        memoryPressure: totalBooks * booksPerPage > 10000
      },
      optimizationOptions: {
        recommendedPageSize: optimizedPageSize,
        enableLazyLoading: true,
        useIncrementalRendering: booksPerPage >= 100,
        enableCaching: totalPages > 10
      },
      ...this.sanitizeDetails(additionalDetails)
    }

    return this.createError(
      'SYSTEM_PAGINATION_OVERFLOW',
      '分頁載入資料量超出處理能力',
      details
    )
  }

  /**
   * 建立編輯驗證衝突錯誤 (VALIDATION_ERROR)
   * @param {string} editType 編輯類型
   * @param {string} bookId 書籍ID
   * @param {*} invalidValue 無效的值
   * @param {Array} validationRules 驗證規則
   * @param {string} userInput 使用者輸入狀態
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} 編輯驗證錯誤物件
   */
  static createEditValidationError (
    editType = 'unknown_edit',
    bookId = '',
    invalidValue = null,
    validationRules = [],
    userInput = 'correctable',
    additionalDetails = {}
  ) {
    const validationSuggestion = this._getValidationSuggestion(editType, invalidValue, validationRules)

    const details = {
      editType,
      bookId,
      invalidValue,
      validationRules,
      userInput,
      validationSuggestion,
      suggestedActions: this._getEditValidationActions(editType, userInput),
      userGuidance: '輸入資料不符合格式要求，請檢查並修正',
      fieldConstraints: this._getFieldConstraints(editType),
      correctionOptions: {
        autoCorrect: userInput === 'correctable',
        suggestedValue: validationSuggestion,
        validationHelp: this._getValidationHelp(editType)
      },
      affectedFields: {
        field: editType,
        bookId,
        originalValue: null,
        attemptedValue: invalidValue
      },
      ...this.sanitizeDetails(additionalDetails)
    }

    return this.createError(
      'DATA_EDIT_VALIDATION_CONFLICT',
      '編輯操作驗證失敗',
      details
    )
  }

  /**
   * 建立UI操作進度錯誤（輔助方法）
   * @param {number} progress 進度百分比
   * @param {string} stage 失敗階段
   * @param {Object} context 額外上下文
   * @returns {Error} 對應的錯誤物件
   */
  static createUIProgressError (progress, stage, context = {}) {
    if (stage.includes('render') || stage.includes('display')) {
      return this.createRenderingError(
        context.totalBooks || 0,
        stage,
        context.memoryUsage || 'unknown',
        stage,
        true,
        { progress, ...context }
      )
    } else if (stage.includes('search') || stage.includes('index')) {
      return this.createSearchIndexError(
        context.corruptedFields || [],
        'degraded',
        true,
        '30s',
        { progress, stage, ...context }
      )
    } else if (stage.includes('page') || stage.includes('pagination')) {
      return this.createPaginationError(
        context.page || 1,
        context.pageSize || 50,
        context.totalBooks || 0,
        progress < 100,
        'reduce_page_size',
        { progress, stage, ...context }
      )
    } else {
      return this.createEditValidationError(
        stage,
        context.bookId || '',
        context.value,
        [],
        'correctable',
        { progress, ...context }
      )
    }
  }

  /**
   * 取得常用錯誤快取
   * @param {string} type 錯誤類型
   * @returns {Error|null} 快取的錯誤物件
   */
  static getCommonError (type) {
    if (this._cache.has(type)) {
      return this._cache.get(type)
    }

    let error = null
    switch (type) {
      case 'RENDERING':
        error = this.createRenderingError()
        break
      case 'SEARCH_INDEX':
        error = this.createSearchIndexError()
        break
      case 'PAGINATION':
        error = this.createPaginationError()
        break
      case 'EDIT_VALIDATION':
        error = this.createEditValidationError()
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
  static clearCache () {
    this._cache.clear()
  }

  /**
   * 清理過大的詳細資訊
   * @param {Object} details 詳細資訊物件
   * @returns {Object} 清理後的詳細資訊
   */
  static sanitizeDetails (details) {
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
        summary: 'Large data set truncated for memory safety'
      }
    }

    return details
  }

  /**
   * 驗證是否為有效的 UC-06 錯誤
   * @param {Error} error 要驗證的錯誤物件
   * @returns {boolean} 是否為有效的UC-06錯誤
   */
  static isValidUC06Error (error) {
    if (!(error instanceof Error)) return false

    // 檢查是否有必要的屬性
    return error.code !== undefined &&
           error.subType !== undefined &&
           error.details !== undefined &&
           typeof error.details === 'object' &&
           // 檢查是否為UC-06相關的subType
           (error.subType.includes('RENDERING') ||
            error.subType.includes('INDEX') ||
            error.subType.includes('PAGINATION') ||
            error.subType.includes('VALIDATION') ||
            error.subType.includes('UC06'))
  }

  // === 私有輔助方法 ===

  /**
   * 決定渲染策略
   */
  static _determineRenderingStrategy (totalBooks, memoryUsage) {
    if (totalBooks < 100) return 'direct_render'
    if (totalBooks < 500) return 'batch_render'
    if (totalBooks < 1000) return 'virtual_scrolling'
    return 'pagination_only'
  }

  /**
   * 估算渲染時間
   */
  static _estimateRenderTime (totalBooks) {
    if (totalBooks < 100) return '< 1s'
    if (totalBooks < 500) return '1-3s'
    if (totalBooks < 1000) return '3-5s'
    return '> 5s'
  }

  /**
   * 估算記憶體需求
   */
  static _estimateMemoryRequired (totalBooks) {
    const mbPerBook = 0.1 // 估計每本書0.1MB
    return `${(totalBooks * mbPerBook).toFixed(1)} MB`
  }

  /**
   * 獲取渲染處理動作
   */
  static _getRenderingActions (failurePoint, degradedModeAvailable) {
    const actions = ['check_memory_usage', 'reduce_display_items']

    if (failurePoint.includes('virtual_scrolling')) {
      actions.push('disable_virtual_scrolling', 'use_pagination')
    }

    if (degradedModeAvailable) {
      actions.push('enable_degraded_mode')
    }

    return actions
  }

  /**
   * 計算索引健康分數
   */
  static _calculateIndexHealth (corruptedFields, searchAccuracy) {
    const fieldPenalty = corruptedFields.length * 20
    const accuracyScore = searchAccuracy === 'normal' ? 100 : searchAccuracy === 'degraded' ? 50 : 0
    return Math.max(0, accuracyScore - fieldPenalty)
  }

  /**
   * 獲取索引恢復動作
   */
  static _getIndexRecoveryActions (rebuildRequired, corruptedCount) {
    const actions = ['diagnose_corruption']

    if (rebuildRequired) {
      actions.push('rebuild_index', 'verify_data_integrity')
    }

    if (corruptedCount > 2) {
      actions.push('full_index_reset')
    } else {
      actions.push('partial_index_repair')
    }

    return actions
  }

  /**
   * 計算最佳頁面大小
   */
  static _calculateOptimalPageSize (totalBooks, loadTimeout) {
    if (loadTimeout) return 20
    if (totalBooks < 100) return 50
    if (totalBooks < 500) return 30
    return 20
  }

  /**
   * 獲取分頁處理動作
   */
  static _getPaginationActions (fallbackStrategy, loadTimeout) {
    const actions = ['optimize_page_size']

    if (loadTimeout) {
      actions.push('implement_timeout_handling', 'enable_progressive_loading')
    }

    if (fallbackStrategy === 'reduce_page_size') {
      actions.push('reduce_items_per_page')
    }

    return actions
  }

  /**
   * 獲取驗證建議
   */
  static _getValidationSuggestion (editType, invalidValue, validationRules) {
    if (editType === 'progress_update' && typeof invalidValue === 'string') {
      const numValue = parseFloat(invalidValue)
      if (numValue > 100) return '100%'
      if (numValue < 0) return '0%'
      return `${numValue}%`
    }
    return null
  }

  /**
   * 獲取編輯驗證動作
   */
  static _getEditValidationActions (editType, userInput) {
    const actions = ['show_validation_error']

    if (userInput === 'correctable') {
      actions.push('suggest_correction', 'enable_auto_correct')
    }

    actions.push('highlight_invalid_field', 'show_help_tooltip')
    return actions
  }

  /**
   * 獲取欄位約束
   */
  static _getFieldConstraints (editType) {
    const constraints = {
      progress_update: { min: 0, max: 100, type: 'percentage' },
      title_edit: { maxLength: 200, required: true, type: 'string' },
      author_edit: { maxLength: 100, required: true, type: 'string' },
      notes_edit: { maxLength: 5000, required: false, type: 'text' }
    }
    return constraints[editType] || {}
  }

  /**
   * 獲取驗證幫助
   */
  static _getValidationHelp (editType) {
    const helpText = {
      progress_update: '請輸入0-100之間的數字，代表閱讀進度百分比',
      title_edit: '書名最多200個字元，不可為空',
      author_edit: '作者名稱最多100個字元，不可為空',
      notes_edit: '筆記內容最多5000個字元'
    }
    return helpText[editType] || '請檢查輸入格式是否正確'
  }
}

module.exports = { UC06ErrorFactory }
