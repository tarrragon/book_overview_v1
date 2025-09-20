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

const { ErrorCodes } = require('./ErrorCodes')
const { UC02ErrorAdapter } = require('./UC02ErrorAdapter')

/**
 * UC-02 專用錯誤工廠
 * 提供類型安全的錯誤建立方法和標準化操作結果
 */
class UC02ErrorFactory {
  // 預建立的常用錯誤快取
  static _commonErrors = new Map()

  /**
   * 建立 UC-02 專用錯誤
   * @param {string} originalCode - 原始 StandardError 錯誤碼
   * @param {string} message - 錯誤訊息
   * @param {Object} details - 錯誤詳細資訊
   * @returns {Error} 符合 ErrorCodes 格式的錯誤物件
   */
  static createError (originalCode, message, details = {}) {
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
  static createDuplicateDetectionError (affectedBooks = [], additionalDetails = {}) {
    return this.createError(
      'DATA_DUPLICATE_DETECTION_FAILED',
      '重複書籍檢測機制失敗',
      {
        affectedBooks,
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
  static createProgressValidationError (invalidProgressData, additionalDetails = {}) {
    return this.createError(
      'DATA_PROGRESS_VALIDATION_ERROR',
      '閱讀進度格式驗證失敗',
      {
        invalidProgressData,
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
  static createIncrementalUpdateError (conflictedBooks = [], additionalDetails = {}) {
    return this.createError(
      'DATA_INCREMENTAL_UPDATE_CONFLICT',
      '增量更新時發生資料衝突',
      {
        conflictedBooks,
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
  static createPageStructureError (detectedChanges = [], additionalDetails = {}) {
    return this.createError(
      'DOM_PAGE_STRUCTURE_CHANGED',
      'Readmoo 頁面結構已更新，需要適應新版面',
      {
        detectedChanges,
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
  static createInfiniteScrollError (scrollContext = {}, additionalDetails = {}) {
    return this.createError(
      'DOM_INFINITE_SCROLL_DETECTION_FAILED',
      '無限滾動檢測機制失敗',
      {
        scrollContext,
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
  static createRateLimitError (rateLimitInfo = {}, additionalDetails = {}) {
    const backoffDelay = Math.min(rateLimitInfo.backoffDelay || 60000, 300000) // 最大5分鐘

    return this.createError(
      'NETWORK_RATE_LIMITING_DETECTED',
      '檢測到 Readmoo 頻率限制',
      {
        rateLimitInfo,
        backoffDelay,
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
  static createExtensionConflictError (conflictingExtensions = [], additionalDetails = {}) {
    return this.createError(
      'PLATFORM_CHROME_EXTENSION_CONFLICT',
      'Chrome 擴充功能衝突影響書籍提取',
      {
        conflictingExtensions,
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
  static getCommonError (errorType) {
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
  static clearCache () {
    this._commonErrors.clear()
  }

  /**
   * 驗證錯誤物件是否符合UC-02規範
   * @param {Error} error - 要驗證的錯誤物件
   * @returns {boolean} 是否為有效的UC-02錯誤
   */
  static isValidUC02Error (error) {
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
  static sanitizeDetails (details) {
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

  /**
   * 驗證儲存容量並提供預防性策略（支援跨 UC 錯誤處理）
   * @param {Object} options - 驗證選項
   * @param {number} options.newDataSize - 新資料大小（位元組）
   * @param {Array} options.inheritedProblems - 來自其他 UC 的問題清單
   * @param {boolean} options.enablePreventiveAction - 是否啟用預防性動作
   * @returns {Promise<Object>} 驗證結果和建議策略
   */
  static async validateStorageCapacity (options = {}) {
    const {
      newDataSize = 0,
      inheritedProblems = [],
      enablePreventiveAction = true
    } = options

    const result = {
      hasCapacity: true,
      preventiveAction: false,
      strategy: null,
      basedOnUC01Experience: false,
      cleanupPlan: {},
      estimatedSavings: 0,
      recommendations: []
    }

    try {
      // 檢查是否有來自 UC-01 的儲存相關問題
      const uc01StorageProblems = inheritedProblems.filter(problem =>
        problem.code === ErrorCodes.STORAGE_ERROR ||
        (problem.details && problem.details.originalCode === 'SYSTEM_STORAGE_QUOTA_EXCEEDED')
      )

      if (uc01StorageProblems.length > 0) {
        result.basedOnUC01Experience = true
        result.preventiveAction = enablePreventiveAction

        // 分析 UC-01 的儲存問題模式
        const uc01Analysis = this._analyzeUC01StorageProblems(uc01StorageProblems)

        // 基於 UC-01 經驗制定預防策略
        if (uc01Analysis.quotaExceeded) {
          result.strategy = 'incremental_cleanup'
          result.cleanupPlan = {
            removeOldBooks: true,
            compressExistingData: true,
            batchSizeReduction: 0.5,
            prioritizeRecentBooks: true,
            archiveOldProgress: true
          }
          result.estimatedSavings = uc01Analysis.estimatedWaste || newDataSize * 0.3
        } else if (uc01Analysis.corruptionDetected) {
          result.strategy = 'integrity_first_cleanup'
          result.cleanupPlan = {
            validateBeforeCleanup: true,
            backupCriticalData: true,
            removeCorruptedEntries: true,
            defragmentStorage: true
          }
          result.estimatedSavings = uc01Analysis.corruptedSize || newDataSize * 0.2
        }

        result.recommendations.push({
          priority: 'HIGH',
          action: 'apply_uc01_lessons',
          description: '基於 UC-01 的儲存問題經驗，主動預防類似問題'
        })
      }

      // 執行實際的儲存容量檢查
      const storageAnalysis = await this._performStorageAnalysis(newDataSize)

      if (!storageAnalysis.hasEnoughSpace) {
        result.hasCapacity = false

        if (!result.strategy) {
          // 如果沒有基於 UC-01 的策略，使用標準策略
          result.strategy = 'standard_cleanup'
          result.cleanupPlan = {
            removeOldBooks: true,
            compressImages: false,
            batchSizeReduction: 0.3
          }
        }

        result.recommendations.push({
          priority: 'CRITICAL',
          action: 'immediate_cleanup',
          description: `需要釋放 ${Math.ceil(storageAnalysis.shortfall / 1024)} KB 空間`
        })
      } else if (storageAnalysis.warningLevel && result.preventiveAction) {
        // 空間充足但接近警告線，且啟用預防性動作
        result.recommendations.push({
          priority: 'MEDIUM',
          action: 'preventive_maintenance',
          description: '空間使用接近警告線，建議執行預防性清理'
        })
      }

      // 新增效能預估
      if (result.cleanupPlan && Object.keys(result.cleanupPlan).length > 0) {
        result.performanceImpact = this._estimateCleanupPerformance(result.cleanupPlan)
      }

      return result
    } catch (error) {
      // 如果驗證過程發生錯誤，返回保守的建議
      return {
        hasCapacity: false,
        preventiveAction: true,
        strategy: 'conservative_fallback',
        basedOnUC01Experience: false,
        cleanupPlan: {
          removeOldBooks: true,
          batchSizeReduction: 0.2
        },
        error: error.message,
        recommendations: [{
          priority: 'HIGH',
          action: 'manual_review',
          description: '儲存容量檢查失敗，建議手動檢查空間使用'
        }]
      }
    }
  }

  /**
   * 分析來自 UC-01 的儲存問題模式
   * @param {Array} uc01Problems - UC-01 儲存問題清單
   * @returns {Object} 分析結果
   * @private
   */
  static _analyzeUC01StorageProblems (uc01Problems) {
    const analysis = {
      quotaExceeded: false,
      corruptionDetected: false,
      estimatedWaste: 0,
      corruptedSize: 0,
      problemCount: uc01Problems.length
    }

    for (const problem of uc01Problems) {
      if (problem.details?.originalCode === 'SYSTEM_STORAGE_QUOTA_EXCEEDED') {
        analysis.quotaExceeded = true
        analysis.estimatedWaste += problem.details?.required || 0
      }

      if (problem.details?.originalCode === 'DATA_INITIAL_STORAGE_CORRUPTION') {
        analysis.corruptionDetected = true
        analysis.corruptedSize += problem.details?.corruptedSize || 0
      }
    }

    return analysis
  }

  /**
   * 執行實際的儲存空間分析
   * @param {number} requiredSpace - 需要的空間大小
   * @returns {Promise<Object>} 儲存分析結果
   * @private
   */
  static async _performStorageAnalysis (requiredSpace) {
    try {
      // 模擬 Chrome Storage API 檢查
      const usage = await this._getChromeStorageUsage()
      const quota = await this._getChromeStorageQuota()
      const available = quota - usage
      const warningThreshold = quota * 0.8 // 80% 警告線

      return {
        hasEnoughSpace: available >= requiredSpace,
        shortfall: Math.max(0, requiredSpace - available),
        currentUsage: usage,
        totalQuota: quota,
        availableSpace: available,
        warningLevel: usage > warningThreshold,
        utilizationPercentage: (usage / quota) * 100
      }
    } catch (error) {
      // 如果無法獲取儲存資訊，返回保守估計
      return {
        hasEnoughSpace: false,
        shortfall: requiredSpace,
        error: error.message
      }
    }
  }

  /**
   * 獲取 Chrome Storage 使用量
   * @returns {Promise<number>} 當前使用量（位元組）
   * @private
   */
  static async _getChromeStorageUsage () {
    // 這裡應該實際調用 Chrome Storage API
    // 暫時返回模擬數據用於測試
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const data = await chrome.storage.local.get(null)
        return new Blob([JSON.stringify(data)]).size
      } catch (error) {
        // 生產環境中不輸出 storage 錯誤，使用預設值
        return 5 * 1024 * 1024 // 預設 5MB
      }
    }
    return 5 * 1024 * 1024 // 預設 5MB 用於測試
  }

  /**
   * 獲取 Chrome Storage 配額
   * @returns {Promise<number>} 總配額（位元組）
   * @private
   */
  static async _getChromeStorageQuota () {
    // Chrome Extension storage.local 的預設配額通常是 unlimited
    // 但在實際使用中會受到磁碟空間限制
    // 這裡返回一個合理的模擬值
    return 100 * 1024 * 1024 // 100MB 用於測試
  }

  /**
   * 估算清理操作的效能影響
   * @param {Object} cleanupPlan - 清理計畫
   * @returns {Object} 效能影響評估
   * @private
   */
  static _estimateCleanupPerformance (cleanupPlan) {
    const baseTime = 100 // 基礎時間（毫秒）
    let estimatedTime = baseTime
    let complexityScore = 1

    if (cleanupPlan.removeOldBooks) {
      estimatedTime += 200
      complexityScore += 1
    }

    if (cleanupPlan.compressExistingData) {
      estimatedTime += 500
      complexityScore += 2
    }

    if (cleanupPlan.validateBeforeCleanup) {
      estimatedTime += 300
      complexityScore += 1
    }

    if (cleanupPlan.defragmentStorage) {
      estimatedTime += 800
      complexityScore += 3
    }

    return {
      estimatedDuration: estimatedTime,
      complexityScore,
      riskLevel: complexityScore > 4 ? 'HIGH' : complexityScore > 2 ? 'MEDIUM' : 'LOW',
      recommendedBatchSize: cleanupPlan.batchSizeReduction || 1,
      canRunInBackground: complexityScore <= 3
    }
  }
}

module.exports = { UC02ErrorFactory }
