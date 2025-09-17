/**
 * UC07ErrorFactory - UC-07 錯誤處理與恢復專用錯誤工廠
 * 
 * 提供系統錯誤處理、日誌記錄、恢復機制和學習系統的專業化錯誤建立方法
 * 支援錯誤處理系統本身的錯誤情況，包含遞迴檢測和緊急模式處理
 * 
 * 專業化錯誤類型：
 * - 錯誤處理器遞迴問題
 * - 日誌記錄系統失敗
 * - 自動恢復機制失效  
 * - 錯誤學習資料過載
 */

import { UC07ErrorAdapter } from './UC07ErrorAdapter.js'
import { ErrorCodes } from './ErrorCodes.js'

export class UC07ErrorFactory {
  /**
   * 常用錯誤快取
   * @private
   * @static
   */
  static _commonErrorCache = new Map()

  /**
   * 建立基本的 UC-07 錯誤
   * @param {string} standardErrorCode - UC-07 StandardError 代碼
   * @param {string} message - 錯誤訊息
   * @param {Object} [details] - 詳細資訊
   * @returns {Error} UC-07 錯誤物件
   */
  static createError(standardErrorCode, message, details = {}) {
    return UC07ErrorAdapter.convertError(standardErrorCode, message, details)
  }

  /**
   * 建立統一的結果物件
   * @param {boolean} success - 操作是否成功
   * @param {*} [data] - 成功時的資料
   * @param {Error} [error] - 失敗時的錯誤物件
   * @returns {Object} 統一的結果物件
   */
  static createResult(success, data = null, error = null) {
    if (success) {
      return {
        success: true,
        data,
        code: 'SUCCESS',
        message: 'Error handling operation completed successfully'
      }
    }

    // 處理錯誤結果
    const result = {
      success: false,
      data: null,
      error: error?.message || 'Unknown error occurred'
    }

    // 如果是 UC-07 錯誤，提取詳細資訊
    if (error && error.code && error.subType) {
      result.code = error.code
      result.subType = error.subType
      result.details = error.details
    } else {
      result.code = ErrorCodes.UNKNOWN_ERROR
      result.message = 'Error handling operation failed'
    }

    return result
  }

  /**
   * 建立錯誤處理器遞迴錯誤
   * @param {number} [recursionDepth=5] - 遞迴深度
   * @param {string} [originalError='UNKNOWN_ERROR'] - 原始錯誤
   * @param {Array} [handlerStack=[]] - 處理器堆疊
   * @param {boolean} [emergencyMode=true] - 是否啟用緊急模式
   * @param {Object} [additionalDetails={}] - 額外詳細資訊
   * @returns {Error} 錯誤處理器遞迴錯誤
   */
  static createHandlerRecursionError(
    recursionDepth = 5,
    originalError = 'UNKNOWN_ERROR', 
    handlerStack = [],
    emergencyMode = true,
    additionalDetails = {}
  ) {
    const details = {
      recursionDepth,
      originalError,
      handlerStack: handlerStack.length > 0 ? handlerStack : ['handleError', 'logError', 'validateErrorData'],
      emergencyMode,
      errorHandling: {
        recursionDetected: recursionDepth > 3,
        maxDepthExceeded: recursionDepth >= 10,
        handlerChain: handlerStack.join(' → '),
        breakCircuit: recursionDepth > 5
      },
      recovery: {
        emergencyFallback: emergencyMode,
        safeMode: true,
        skipLogging: recursionDepth > 3,
        directReturn: true
      },
      ...this.sanitizeDetails(additionalDetails)
    }

    return this.createError(
      'SYSTEM_ERROR_HANDLER_RECURSION',
      `錯誤處理器發生遞迴錯誤 (深度: ${recursionDepth})`,
      details
    )
  }

  /**
   * 建立日誌記錄失敗錯誤
   * @param {string} [logDestination='chrome.storage.local'] - 日誌目標
   * @param {number} [failedEvents=0] - 失敗事件數
   * @param {boolean} [storageQuotaExceeded=false] - 是否儲存配額超限
   * @param {string} [fallbackLogging='memory_buffer'] - 回退日誌方式
   * @param {Object} [additionalDetails={}] - 額外詳細資訊
   * @returns {Error} 日誌記錄失敗錯誤
   */
  static createLoggingFailureError(
    logDestination = 'chrome.storage.local',
    failedEvents = 0,
    storageQuotaExceeded = false,
    fallbackLogging = 'memory_buffer',
    additionalDetails = {}
  ) {
    const details = {
      logDestination,
      failedEvents,
      storageQuotaExceeded,
      fallbackLogging,
      logging: {
        destination: logDestination,
        status: storageQuotaExceeded ? 'quota_exceeded' : 'write_failed',
        bufferSize: failedEvents,
        retryAttempts: Math.min(failedEvents, 3)
      },
      storage: {
        quotaExceeded: storageQuotaExceeded,
        fallbackActive: true,
        estimatedSpace: storageQuotaExceeded ? '0MB' : 'unknown',
        cleanupRequired: storageQuotaExceeded
      },
      recovery: {
        fallbackMethod: fallbackLogging,
        memoryBufferActive: fallbackLogging === 'memory_buffer',
        logRotationNeeded: storageQuotaExceeded,
        emergencyCleanup: failedEvents > 50
      },
      ...this.sanitizeDetails(additionalDetails)
    }

    return this.createError(
      'SYSTEM_ERROR_LOGGING_FAILURE',
      `錯誤日誌記錄系統失敗 (${failedEvents} 事件失敗)`,
      details
    )
  }

  /**
   * 建立恢復機制失效錯誤
   * @param {Array} [failedRecoveryAttempts=[]] - 失敗的恢復嘗試
   * @param {boolean} [manualInterventionRequired=true] - 是否需要人工介入
   * @param {string} [systemState='damaged'] - 系統狀態
   * @param {Object} [additionalDetails={}] - 額外詳細資訊
   * @returns {Error} 恢復機制失效錯誤
   */
  static createRecoveryExhaustedError(
    failedRecoveryAttempts = [],
    manualInterventionRequired = true,
    systemState = 'damaged',
    additionalDetails = {}
  ) {
    // 預設恢復嘗試
    const defaultAttempts = [
      { strategy: 'restart_service', result: 'failed', timestamp: Date.now() - 30000 },
      { strategy: 'clear_cache', result: 'failed', timestamp: Date.now() - 20000 },
      { strategy: 'reset_storage', result: 'failed', timestamp: Date.now() - 10000 }
    ]

    const attempts = failedRecoveryAttempts.length > 0 ? failedRecoveryAttempts : defaultAttempts

    const details = {
      failedRecoveryAttempts: attempts,
      manualInterventionRequired,
      systemState,
      recovery: {
        totalAttempts: attempts.length,
        allFailed: attempts.every(attempt => attempt.result === 'failed'),
        lastAttempt: attempts[attempts.length - 1]?.strategy || 'unknown',
        timespan: this._calculateTimespan(attempts)
      },
      system: {
        state: systemState,
        stability: systemState === 'damaged' ? 'unstable' : 'degraded',
        functionality: this._assessFunctionality(attempts),
        criticalErrors: attempts.filter(a => a.strategy.includes('restart')).length
      },
      intervention: {
        required: manualInterventionRequired,
        urgency: attempts.length >= 5 ? 'immediate' : 'moderate',
        suggestedActions: this._generateInterventionSuggestions(attempts),
        escalation: attempts.length > 3
      },
      ...this.sanitizeDetails(additionalDetails)
    }

    return this.createError(
      'SYSTEM_RECOVERY_MECHANISM_EXHAUSTED',
      `所有自動恢復機制都已失效 (${attempts.length} 次嘗試失敗)`,
      details
    )
  }

  /**
   * 建立模式學習過載錯誤  
   * @param {number} [learnedPatterns=1000] - 已學習模式數
   * @param {number} [storageLimit=1000] - 儲存限制
   * @param {string} [oldestPattern=null] - 最舊模式日期
   * @param {boolean} [pruningRequired=true] - 是否需要修剪
   * @param {string} [retentionPolicy='keep_recent_and_frequent'] - 保留策略
   * @param {Object} [additionalDetails={}] - 額外詳細資訊
   * @returns {Error} 模式學習過載錯誤
   */
  static createPatternLearningError(
    learnedPatterns = 1000,
    storageLimit = 1000,
    oldestPattern = null,
    pruningRequired = true,
    retentionPolicy = 'keep_recent_and_frequent',
    additionalDetails = {}
  ) {
    const overflowRatio = learnedPatterns / storageLimit
    const oldestDate = oldestPattern || this._generateOldestPatternDate()

    const details = {
      learnedPatterns,
      storageLimit,
      oldestPattern: oldestDate,
      pruningRequired,
      retentionPolicy,
      learning: {
        totalPatterns: learnedPatterns,
        capacityUsed: `${Math.round(overflowRatio * 100)}%`,
        overflowAmount: Math.max(0, learnedPatterns - storageLimit),
        learningRate: this._estimateLearningRate(learnedPatterns, oldestDate)
      },
      storage: {
        currentSize: learnedPatterns,
        maxCapacity: storageLimit,
        availableSpace: Math.max(0, storageLimit - learnedPatterns),
        compressionPossible: learnedPatterns > storageLimit * 0.8
      },
      pruning: {
        required: pruningRequired,
        strategy: retentionPolicy,
        estimatedRemoval: this._calculatePruningAmount(learnedPatterns, storageLimit, retentionPolicy),
        preserveRecent: retentionPolicy.includes('recent'),
        preserveFrequent: retentionPolicy.includes('frequent')
      },
      ...this.sanitizeDetails(additionalDetails)
    }

    return this.createError(
      'DATA_ERROR_PATTERN_LEARNING_OVERFLOW',
      `錯誤模式學習資料過載 (${learnedPatterns}/${storageLimit} 模式)`,
      details
    )
  }

  /**
   * 建立系統階段錯誤（根據階段自動選擇錯誤類型）
   * @param {string} stage - 系統階段
   * @param {string} [operation='unknown'] - 操作類型
   * @param {Object} [context={}] - 上下文資訊
   * @returns {Error} 對應的錯誤類型
   */
  static createSystemStageError(stage, operation = 'unknown', context = {}) {
    const stageMapping = {
      // 錯誤處理相關階段
      'error_handling': () => this.createHandlerRecursionError(
        context.recursionDepth, context.originalError, context.handlerStack
      ),
      'error_processing': () => this.createHandlerRecursionError(),
      
      // 日誌記錄相關階段  
      'logging': () => this.createLoggingFailureError(
        context.logDestination, context.failedEvents, context.storageQuotaExceeded
      ),
      'log_storage': () => this.createLoggingFailureError(),
      
      // 恢復機制相關階段
      'recovery': () => this.createRecoveryExhaustedError(
        context.failedRecoveryAttempts, context.manualInterventionRequired
      ),
      'system_repair': () => this.createRecoveryExhaustedError(),
      
      // 學習系統相關階段
      'pattern_learning': () => this.createPatternLearningError(
        context.learnedPatterns, context.storageLimit, context.oldestPattern
      ),
      'data_analysis': () => this.createPatternLearningError()
    }

    const createErrorFn = stageMapping[stage]
    if (createErrorFn) {
      return createErrorFn()
    }

    // 預設使用處理器錯誤
    return this.createHandlerRecursionError(3, `STAGE_${stage.toUpperCase()}_ERROR`, [operation])
  }

  /**
   * 取得常用錯誤（含快取機制）
   * @param {string} errorType - 錯誤類型
   * @returns {Error} 快取的錯誤物件
   */
  static getCommonError(errorType) {
    if (this._commonErrorCache.has(errorType)) {
      return this._commonErrorCache.get(errorType)
    }

    let error
    switch (errorType) {
      case 'RECURSION':
        error = this.createHandlerRecursionError()
        break
      case 'LOGGING':
        error = this.createLoggingFailureError()
        break
      case 'RECOVERY':
        error = this.createRecoveryExhaustedError()
        break
      case 'LEARNING':
        error = this.createPatternLearningError()
        break
      default:
        error = this.createHandlerRecursionError(1, 'COMMON_ERROR', ['getCommonError'])
    }

    this._commonErrorCache.set(errorType, error)
    return error
  }

  /**
   * 清除錯誤快取
   */
  static clearCache() {
    this._commonErrorCache.clear()
  }

  /**
   * 清理和截斷過大的詳細資訊
   * @param {*} details - 原始詳細資訊
   * @returns {Object} 清理後的詳細資訊
   */
  static sanitizeDetails(details) {
    if (!details || typeof details !== 'object') {
      return {}
    }

    const serialized = JSON.stringify(details)
    const maxSize = 15000

    if (serialized.length <= maxSize) {
      return details
    }

    // 截斷過大的詳細資訊
    return {
      _truncated: true,
      _originalSize: serialized.length,
      summary: `Large error details truncated (${serialized.length} > ${maxSize} chars)`,
      keyFields: this._extractKeyFields(details)
    }
  }

  /**
   * 驗證是否為有效的 UC-07 錯誤
   * @param {*} error - 待驗證的錯誤物件
   * @returns {boolean} 是否為有效的 UC-07 錯誤
   */
  static isValidUC07Error(error) {
    return UC07ErrorAdapter.isValidErrorCodesError(error) &&
           error.subType &&
           ['ERROR_HANDLER_RECURSION', 'ERROR_LOGGING_FAILURE', 'RECOVERY_MECHANISM_EXHAUSTED', 'PATTERN_LEARNING_OVERFLOW']
             .includes(error.subType)
  }

  // 私有輔助方法

  /**
   * 計算恢復嘗試的時間跨度
   * @private
   */
  static _calculateTimespan(attempts) {
    if (attempts.length < 2) return '0s'
    
    const timestamps = attempts
      .map(a => a.timestamp)
      .filter(t => typeof t === 'number')
      .sort()
    
    if (timestamps.length < 2) return 'unknown'
    
    const span = timestamps[timestamps.length - 1] - timestamps[0]
    return `${Math.round(span / 1000)}s`
  }

  /**
   * 評估系統功能性
   * @private
   */
  static _assessFunctionality(attempts) {
    const criticalFailures = attempts.filter(a => 
      a.strategy.includes('restart') || a.strategy.includes('reset')
    ).length
    
    if (criticalFailures >= 2) return 'severely_degraded'
    if (attempts.length >= 5) return 'degraded'
    return 'limited'
  }

  /**
   * 生成介入建議
   * @private
   */
  static _generateInterventionSuggestions(attempts) {
    const suggestions = []
    
    if (attempts.some(a => a.strategy.includes('restart'))) {
      suggestions.push('manual_system_restart')
    }
    if (attempts.some(a => a.strategy.includes('storage'))) {
      suggestions.push('storage_cleanup')
    }
    if (attempts.length > 3) {
      suggestions.push('investigate_root_cause')
    }
    
    return suggestions.length > 0 ? suggestions : ['contact_support']
  }

  /**
   * 生成最舊模式日期
   * @private
   */
  static _generateOldestPatternDate() {
    const now = new Date()
    const daysAgo = Math.floor(Math.random() * 90) + 30 // 30-120 天前
    const oldDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    return oldDate.toISOString().split('T')[0]
  }

  /**
   * 估算學習速率
   * @private
   */
  static _estimateLearningRate(patterns, oldestDate) {
    try {
      const daysSince = Math.floor(
        (Date.now() - new Date(oldestDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      return daysSince > 0 ? `${Math.round(patterns / daysSince)} patterns/day` : 'unknown'
    } catch {
      return 'unknown'
    }
  }

  /**
   * 計算修剪數量
   * @private
   */
  static _calculatePruningAmount(current, limit, policy) {
    const overflow = Math.max(0, current - limit)
    const buffer = Math.floor(limit * 0.1) // 10% 緩衝區
    
    return overflow + buffer
  }

  /**
   * 提取關鍵欄位
   * @private
   */
  static _extractKeyFields(details) {
    const keyFields = {}
    const importantKeys = [
      'recursionDepth', 'originalError', 'emergencyMode',
      'failedEvents', 'storageQuotaExceeded', 'fallbackLogging',
      'manualInterventionRequired', 'systemState',
      'learnedPatterns', 'storageLimit', 'pruningRequired'
    ]
    
    importantKeys.forEach(key => {
      if (key in details) {
        keyFields[key] = details[key]
      }
    })
    
    return keyFields
  }
}