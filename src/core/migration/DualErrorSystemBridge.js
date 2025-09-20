/**
 * 雙重錯誤系統橋接器
 *
 * 功能：
 * - 在遷移期間同時支援 StandardError 和 ErrorCodes
 * - 提供透明的錯誤轉換和相容性保證
 * - 統一的錯誤處理介面和追蹤機制
 * - 支援逐步遷移策略
 *
 * Phase 3: 雙重錯誤系統支援實作
 */

const { StandardError } = require('src/core/errors/StandardError')
const ErrorCodes = require('src/core/errors/ErrorCodes')

/**
 * 雙重系統操作模式
 */
const DUAL_SYSTEM_MODES = {
  LEGACY_FIRST: 'legacy_first', // 優先使用 StandardError
  ERRORCODES_FIRST: 'errorcodes_first', // 優先使用 ErrorCodes
  PARALLEL: 'parallel', // 平行處理兩套系統
  TRANSITIONAL: 'transitional' // 過渡模式，基於配置決定
}

/**
 * 錯誤相容性等級
 */
const COMPATIBILITY_LEVELS = {
  STRICT: 'strict', // 嚴格相容性檢查
  LOOSE: 'loose', // 寬鬆相容性檢查
  FLEXIBLE: 'flexible' // 彈性相容性檢查
}

/**
 * 系統狀態追蹤
 */
const SYSTEM_STATES = {
  FULL_LEGACY: 'full_legacy', // 完全使用舊系統
  MIGRATION_ACTIVE: 'migration_active', // 遷移進行中
  DUAL_ACTIVE: 'dual_active', // 雙系統並行
  MIGRATION_COMPLETE: 'migration_complete' // 遷移完成
}

/**
 * 雙重錯誤系統橋接器
 */
class DualErrorSystemBridge {
  constructor (options = {}) {
    this.config = {
      mode: options.mode || DUAL_SYSTEM_MODES.TRANSITIONAL,
      compatibilityLevel: options.compatibilityLevel || COMPATIBILITY_LEVELS.LOOSE,
      enableLogging: options.enableLogging !== false,
      enableMetrics: options.enableMetrics !== false,
      fallbackToLegacy: options.fallbackToLegacy !== false,
      validationEnabled: options.validationEnabled !== false
    }

    // 系統狀態管理
    this.systemState = {
      currentState: SYSTEM_STATES.MIGRATION_ACTIVE,
      migrationProgress: 0,
      lastStateChange: Date.now(),
      errorCounts: {
        legacy: 0,
        errorCodes: 0,
        bridged: 0,
        failed: 0
      }
    }

    // 錯誤映射快取
    this.errorMappingCache = new Map()

    // 相容性驗證器
    this.compatibilityValidators = new Map()
    this._initializeCompatibilityValidators()

    // 效能統計
    this.performanceMetrics = {
      conversionTimes: [],
      validationTimes: [],
      bridgingOperations: 0,
      cacheHits: 0,
      cacheMisses: 0
    }

    this._initializeSystemState()
  }

  /**
   * 初始化相容性驗證器
   * @private
   */
  _initializeCompatibilityValidators () {
    // StandardError 到 ErrorCodes 驗證器
    this.compatibilityValidators.set('standard_to_errorcodes', {
      validate: this._validateStandardToErrorCodes.bind(this),
      description: 'StandardError 到 ErrorCodes 相容性驗證'
    })

    // ErrorCodes 到 StandardError 驗證器
    this.compatibilityValidators.set('errorcodes_to_standard', {
      validate: this._validateErrorCodesToStandard.bind(this),
      description: 'ErrorCodes 到 StandardError 相容性驗證'
    })

    // 雙向相容性驗證器
    this.compatibilityValidators.set('bidirectional', {
      validate: this._validateBidirectionalCompatibility.bind(this),
      description: '雙向相容性驗證'
    })
  }

  /**
   * 初始化系統狀態
   * @private
   */
  _initializeSystemState () {
    if (this.config.enableLogging) {
      // eslint-disable-next-line no-console
      console.log('🔗 雙重錯誤系統橋接器啟動')
      // eslint-disable-next-line no-console
      console.log(`   模式: ${this.config.mode}`)
      // eslint-disable-next-line no-console
      console.log(`   相容性等級: ${this.config.compatibilityLevel}`)
      // eslint-disable-next-line no-console
      console.log(`   系統狀態: ${this.systemState.currentState}`)
    }
  }

  /**
   * 橋接錯誤處理 - 主要入口點
   * @param {Error|Object} error - 原始錯誤
   * @param {Object} options - 橋接選項
   * @returns {Object} 橋接後的錯誤
   */
  bridgeError (error, options = {}) {
    const startTime = performance.now()
    this.performanceMetrics.bridgingOperations++

    try {
      // 檢測錯誤類型
      const errorType = this._detectErrorType(error)

      // 根據模式決定處理策略
      const bridgedError = this._processByMode(error, errorType, options)

      // 驗證相容性 (如果啟用)
      if (this.config.validationEnabled) {
        this._validateCompatibility(bridgedError, error, errorType)
      }

      // 更新統計
      this._updateErrorStats(errorType, 'bridged')

      // 記錄效能
      const conversionTime = performance.now() - startTime
      this.performanceMetrics.conversionTimes.push(conversionTime)

      return bridgedError
    } catch (bridgeError) {
      this._updateErrorStats('unknown', 'failed')

      if (this.config.fallbackToLegacy) {
        // eslint-disable-next-line no-console
        console.warn('⚠️ 橋接失敗，回退到原始錯誤:', bridgeError.message)
        return error
      }

      throw bridgeError
    }
  }

  /**
   * 檢測錯誤類型
   * @param {Error|Object} error - 錯誤物件
   * @returns {string} 錯誤類型
   * @private
   */
  _detectErrorType (error) {
    if (!error) return 'unknown'

    // 檢查是否為 StandardError 或其包裝器
    if (error.name === 'StandardError' || error instanceof StandardError) {
      return 'standard'
    }

    // 檢查是否為 ErrorCodes 格式
    if (error.errorCode || (error.code && error.subType)) {
      return 'errorcodes'
    }

    // 檢查是否為原生 Error
    if (error instanceof Error) {
      return 'native'
    }

    // 檢查是否為錯誤物件格式
    if (typeof error === 'object' && error.message) {
      return 'object'
    }

    return 'unknown'
  }

  /**
   * 根據模式處理錯誤
   * @param {Error|Object} error - 原始錯誤
   * @param {string} errorType - 錯誤類型
   * @param {Object} options - 處理選項
   * @returns {Object} 處理後的錯誤
   * @private
   */
  _processByMode (error, errorType, options) {
    switch (this.config.mode) {
      case DUAL_SYSTEM_MODES.LEGACY_FIRST:
        return this._processLegacyFirst(error, errorType, options)

      case DUAL_SYSTEM_MODES.ERRORCODES_FIRST:
        return this._processErrorCodesFirst(error, errorType, options)

      case DUAL_SYSTEM_MODES.PARALLEL:
        return this._processParallel(error, errorType, options)

      case DUAL_SYSTEM_MODES.TRANSITIONAL:
        return this._processTransitional(error, errorType, options)

      default: {
        const implementationError = new Error(`未知的雙重系統模式: ${this.config.mode}`)
        implementationError.code = ErrorCodes.IMPLEMENTATION_ERROR
        implementationError.details = { mode: this.config.mode, category: 'migration' }
        throw implementationError
      }
    }
  }

  /**
   * 優先使用 Legacy 系統處理
   * @param {Error|Object} error - 原始錯誤
   * @param {string} errorType - 錯誤類型
   * @param {Object} options - 處理選項
   * @returns {Object} 處理後的錯誤
   * @private
   */
  _processLegacyFirst (error, errorType, options) {
    if (errorType === 'standard') {
      // 已經是 StandardError，直接返回
      this._updateErrorStats('legacy', 'success')
      return error
    }

    // 轉換為 StandardError 格式
    const legacyError = this._convertToStandardError(error)

    // 同時提供 ErrorCodes 相容性
    if (options.includeErrorCodes !== false) {
      legacyError._errorCodesCompat = this._convertToErrorCodes(error)
    }

    this._updateErrorStats('legacy', 'converted')
    return legacyError
  }

  /**
   * 優先使用 ErrorCodes 系統處理
   * @param {Error|Object} error - 原始錯誤
   * @param {string} errorType - 錯誤類型
   * @param {Object} options - 處理選項
   * @returns {Object} 處理後的錯誤
   * @private
   */
  _processErrorCodesFirst (error, errorType, options) {
    if (errorType === 'errorcodes') {
      // 已經是 ErrorCodes 格式，直接返回
      this._updateErrorStats('errorCodes', 'success')
      return error
    }

    // 轉換為 ErrorCodes 格式
    const errorCodesError = this._convertToErrorCodes(error)

    // 同時提供 StandardError 相容性
    if (options.includeLegacy !== false) {
      errorCodesError._legacyCompat = this._convertToStandardError(error)
    }

    this._updateErrorStats('errorCodes', 'converted')
    return errorCodesError
  }

  /**
   * 平行處理兩套系統
   * @param {Error|Object} error - 原始錯誤
   * @param {string} errorType - 錯誤類型
   * @param {Object} options - 處理選項
   * @returns {Object} 處理後的錯誤
   * @private
   */
  _processParallel (error, errorType, options) {
    const result = {
      bridgeType: 'parallel',
      original: error,
      legacy: this._convertToStandardError(error),
      errorCodes: this._convertToErrorCodes(error),
      timestamp: Date.now()
    }

    // 提供統一的存取介面
    result.code = result.legacy.code
    result.message = result.legacy.message
    result.errorCode = result.errorCodes.errorCode
    result.subType = result.errorCodes.subType

    this._updateErrorStats('bridged', 'parallel')
    return result
  }

  /**
   * 過渡模式處理
   * @param {Error|Object} error - 原始錯誤
   * @param {string} errorType - 錯誤類型
   * @param {Object} options - 處理選項
   * @returns {Object} 處理後的錯誤
   * @private
   */
  _processTransitional (error, errorType, options) {
    // 基於系統狀態和遷移進度決定處理方式
    const migrationProgress = this.systemState.migrationProgress

    if (migrationProgress < 0.3) {
      // 遷移初期，主要使用 Legacy 系統
      return this._processLegacyFirst(error, errorType, options)
    } else if (migrationProgress < 0.7) {
      // 遷移中期，使用平行處理
      return this._processParallel(error, errorType, options)
    } else {
      // 遷移後期，主要使用 ErrorCodes 系統
      return this._processErrorCodesFirst(error, errorType, options)
    }
  }

  /**
   * 轉換為 StandardError 格式
   * @param {Error|Object} error - 原始錯誤
   * @returns {Object} StandardError 格式錯誤
   * @private
   */
  _convertToStandardError (error) {
    // 檢查快取
    const cacheKey = this._generateCacheKey(error, 'standard')
    if (this.errorMappingCache.has(cacheKey)) {
      this.performanceMetrics.cacheHits++
      return this.errorMappingCache.get(cacheKey)
    }

    this.performanceMetrics.cacheMisses++

    let standardError

    if (error instanceof StandardError || error.name === 'StandardError') {
      standardError = error
    } else if (error.errorCode && error.subType) {
      // 從 ErrorCodes 轉換
      standardError = {
        name: 'StandardError',
        code: this._mapErrorCodeToStandard(error.errorCode),
        message: error.message || '未指定錯誤訊息',
        category: error.category || 'general',
        details: error.details || {},
        timestamp: error.timestamp || Date.now(),
        // 保留原始 ErrorCodes 資訊
        _originalErrorCode: error.errorCode,
        _originalSubType: error.subType
      }
    } else {
      // 從原生 Error 或其他格式轉換
      standardError = {
        name: 'StandardError',
        code: 'UNKNOWN_ERROR',
        message: error.message || error.toString(),
        category: 'general',
        details: {
          originalType: error.constructor?.name || 'Unknown',
          stack: error.stack
        },
        timestamp: Date.now()
      }
    }

    // 快取結果
    this.errorMappingCache.set(cacheKey, standardError)
    return standardError
  }

  /**
   * 轉換為 ErrorCodes 格式
   * @param {Error|Object} error - 原始錯誤
   * @returns {Object} ErrorCodes 格式錯誤
   * @private
   */
  _convertToErrorCodes (error) {
    // 檢查快取
    const cacheKey = this._generateCacheKey(error, 'errorcodes')
    if (this.errorMappingCache.has(cacheKey)) {
      this.performanceMetrics.cacheHits++
      return this.errorMappingCache.get(cacheKey)
    }

    this.performanceMetrics.cacheMisses++

    let errorCodesError

    if (error.errorCode && error.subType) {
      errorCodesError = error
    } else if (error instanceof StandardError) {
      errorCodesError = {
        message: error.message,
        errorCode: error.errorCode,
        subType: error.subType,
        severity: error.severity,
        details: error.enhancedDetails || error.details,
        timestamp: error.timestamp
      }
    } else if (error.name === 'StandardError' || error.code) {
      // 從 StandardError 轉換
      errorCodesError = {
        message: error.message || '未指定錯誤訊息',
        errorCode: this._mapStandardToErrorCode(error.code),
        subType: this._generateSubType(error.code),
        severity: this._determineSeverity(error),
        details: {
          ...error.details,
          originalCode: error.code,
          category: error.category
        },
        timestamp: error.timestamp || Date.now()
      }
    } else {
      // 從原生 Error 轉換
      errorCodesError = {
        message: error.message || error.toString(),
        errorCode: 'UNKNOWN_ERROR',
        subType: 'UnknownError',
        severity: 'MEDIUM',
        details: {
          originalType: error.constructor?.name || 'Unknown',
          stack: error.stack
        },
        timestamp: Date.now()
      }
    }

    // 快取結果
    this.errorMappingCache.set(cacheKey, errorCodesError)
    return errorCodesError
  }

  /**
   * 映射 ErrorCode 到 StandardError 代碼
   * @param {string} errorCode - ErrorCode
   * @returns {string} StandardError 代碼
   * @private
   */
  _mapErrorCodeToStandard (errorCode) {
    const mapping = {
      VALIDATION_ERROR: 'VALIDATION_ERROR',
      BOOK_ERROR: 'BOOK_ERROR',
      DOM_ERROR: 'DOM_ERROR',
      TIMEOUT_ERROR: 'TIMEOUT_ERROR',
      OPERATION_ERROR: 'OPERATION_FAILED',
      NETWORK_ERROR: 'NETWORK_ERROR',
      CONNECTION_ERROR: 'CONNECTION_FAILED',
      CHROME_ERROR: 'CHROME_API_ERROR',
      STORAGE_ERROR: 'STORAGE_ERROR',
      UNKNOWN_ERROR: 'UNKNOWN_ERROR'
    }

    return mapping[errorCode] || 'UNKNOWN_ERROR'
  }

  /**
   * 映射 StandardError 代碼到 ErrorCode
   * @param {string} standardCode - StandardError 代碼
   * @returns {string} ErrorCode
   * @private
   */
  _mapStandardToErrorCode (standardCode) {
    const mapping = {
      VALIDATION_ERROR: 'VALIDATION_ERROR',
      BOOK_ERROR: 'BOOK_ERROR',
      DOM_ERROR: 'DOM_ERROR',
      TIMEOUT_ERROR: 'TIMEOUT_ERROR',
      OPERATION_FAILED: 'OPERATION_ERROR',
      NETWORK_ERROR: 'NETWORK_ERROR',
      CONNECTION_FAILED: 'CONNECTION_ERROR',
      CHROME_API_ERROR: 'CHROME_ERROR',
      STORAGE_ERROR: 'STORAGE_ERROR',
      UNKNOWN_ERROR: 'UNKNOWN_ERROR'
    }

    return mapping[standardCode] || 'UNKNOWN_ERROR'
  }

  /**
   * 產生子類型
   * @param {string} code - 錯誤代碼
   * @returns {string} 子類型
   * @private
   */
  _generateSubType (code) {
    return code.replace(/_ERROR$/, '').toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('') + 'Error'
  }

  /**
   * 決定錯誤嚴重程度
   * @param {Object} error - 錯誤物件
   * @returns {string} 嚴重程度
   * @private
   */
  _determineSeverity (error) {
    if (error.severity) return error.severity

    const code = error.code || error.errorCode || ''

    if (code.includes('CRITICAL') || code.includes('FATAL')) return 'HIGH'
    if (code.includes('TIMEOUT') || code.includes('NETWORK')) return 'MEDIUM'

    return 'LOW'
  }

  /**
   * 產生快取鍵值
   * @param {Object} error - 錯誤物件
   * @param {string} targetType - 目標類型
   * @returns {string} 快取鍵值
   * @private
   */
  _generateCacheKey (error, targetType) {
    const errorKey = error.code || error.errorCode || error.message || 'unknown'
    return `${targetType}_${errorKey}_${error.timestamp || 'no_time'}`
  }

  /**
   * 驗證相容性
   * @param {Object} bridgedError - 橋接後的錯誤
   * @param {Object} originalError - 原始錯誤
   * @param {string} errorType - 錯誤類型
   * @private
   */
  _validateCompatibility (bridgedError, originalError, errorType) {
    const startTime = performance.now()

    try {
      // 根據相容性等級選擇驗證策略
      const validators = this._selectValidators(errorType)

      for (const validator of validators) {
        validator.validate(bridgedError, originalError)
      }

      const validationTime = performance.now() - startTime
      this.performanceMetrics.validationTimes.push(validationTime)
    } catch (validationError) {
      if (this.config.compatibilityLevel === COMPATIBILITY_LEVELS.STRICT) {
        throw validationError
      } else {
        // eslint-disable-next-line no-console
        console.warn('⚠️ 相容性驗證警告:', validationError.message)
      }
    }
  }

  /**
   * 選擇驗證器
   * @param {string} errorType - 錯誤類型
   * @returns {Array} 驗證器清單
   * @private
   */
  _selectValidators (errorType) {
    const validators = []

    switch (this.config.compatibilityLevel) {
      case COMPATIBILITY_LEVELS.STRICT:
        validators.push(
          this.compatibilityValidators.get('bidirectional'),
          this.compatibilityValidators.get('standard_to_errorcodes'),
          this.compatibilityValidators.get('errorcodes_to_standard')
        )
        break

      case COMPATIBILITY_LEVELS.LOOSE:
        if (errorType === 'standard') {
          validators.push(this.compatibilityValidators.get('standard_to_errorcodes'))
        } else if (errorType === 'errorcodes') {
          validators.push(this.compatibilityValidators.get('errorcodes_to_standard'))
        }
        break

      case COMPATIBILITY_LEVELS.FLEXIBLE:
        // 僅基本驗證
        validators.push(this.compatibilityValidators.get('bidirectional'))
        break
    }

    return validators.filter(v => v) // 過濾 undefined
  }

  /**
   * StandardError 到 ErrorCodes 相容性驗證
   * @param {Object} bridgedError - 橋接後的錯誤
   * @param {Object} originalError - 原始錯誤
   * @private
   */
  _validateStandardToErrorCodes (bridgedError, originalError) {
    if (!bridgedError.errorCode) {
      const validationError = new Error('橋接後的錯誤缺少 errorCode 屬性')
      validationError.code = ErrorCodes.IMPLEMENTATION_ERROR
      validationError.details = { category: 'validation', bridgedError }
      throw validationError
    }

    if (!bridgedError.message) {
      const validationError = new Error('橋接後的錯誤缺少 message 屬性')
      validationError.code = ErrorCodes.IMPLEMENTATION_ERROR
      validationError.details = { category: 'validation', bridgedError }
      throw validationError
    }

    // 驗證訊息一致性
    if (originalError.message && bridgedError.message !== originalError.message) {
      // eslint-disable-next-line no-console
      console.warn(`⚠️ 錯誤訊息不一致: "${originalError.message}" vs "${bridgedError.message}"`)
    }
  }

  /**
   * ErrorCodes 到 StandardError 相容性驗證
   * @param {Object} bridgedError - 橋接後的錯誤
   * @param {Object} originalError - 原始錯誤
   * @private
   */
  _validateErrorCodesToStandard (bridgedError, originalError) {
    if (!bridgedError.code) {
      const validationError = new Error('橋接後的錯誤缺少 code 屬性')
      validationError.code = ErrorCodes.IMPLEMENTATION_ERROR
      validationError.details = { category: 'validation', bridgedError }
      throw validationError
    }

    if (!bridgedError.name || bridgedError.name !== 'StandardError') {
      const validationError = new Error('橋接後的錯誤 name 屬性不正確')
      validationError.code = ErrorCodes.IMPLEMENTATION_ERROR
      validationError.details = { category: 'validation', expectedName: 'StandardError', actualName: bridgedError.name }
      throw validationError
    }

    // 驗證類別一致性
    if (originalError.details && !bridgedError.details) {
      // eslint-disable-next-line no-console
      console.warn('⚠️ 橋接過程中遺失了錯誤詳細資訊')
    }
  }

  /**
   * 雙向相容性驗證
   * @param {Object} bridgedError - 橋接後的錯誤
   * @param {Object} originalError - 原始錯誤
   * @private
   */
  _validateBidirectionalCompatibility (bridgedError, originalError) {
    // 基本屬性檢查
    if (!bridgedError.message) {
      const validationError = new Error('橋接後的錯誤缺少基本訊息')
      validationError.code = ErrorCodes.IMPLEMENTATION_ERROR
      validationError.details = { category: 'validation', bridgedError }
      throw validationError
    }

    if (!bridgedError.timestamp) {
      // eslint-disable-next-line no-console
      console.warn('⚠️ 橋接後的錯誤缺少時間戳')
    }

    // 確保橋接沒有遺失重要資訊
    const originalKeys = Object.keys(originalError)
    const bridgedKeys = Object.keys(bridgedError)

    if (originalKeys.length > bridgedKeys.length + 2) { // 允許一些轉換損失
      // eslint-disable-next-line no-console
      console.warn('⚠️ 橋接過程可能遺失了一些屬性')
    }
  }

  /**
   * 更新錯誤統計
   * @param {string} type - 錯誤類型
   * @param {string} operation - 操作類型
   * @private
   */
  _updateErrorStats (type, operation) {
    if (type === 'legacy' || type === 'standard') {
      this.systemState.errorCounts.legacy++
    } else if (type === 'errorcodes') {
      this.systemState.errorCounts.errorCodes++
    } else if (type === 'bridged') {
      this.systemState.errorCounts.bridged++
    } else {
      this.systemState.errorCounts.failed++
    }
  }

  /**
   * 更新遷移進度
   * @param {number} progress - 進度 (0-1)
   */
  updateMigrationProgress (progress) {
    const oldProgress = this.systemState.migrationProgress
    this.systemState.migrationProgress = Math.max(0, Math.min(1, progress))
    this.systemState.lastStateChange = Date.now()

    // 根據進度更新系統狀態
    if (progress === 0) {
      this.systemState.currentState = SYSTEM_STATES.FULL_LEGACY
    } else if (progress === 1) {
      this.systemState.currentState = SYSTEM_STATES.MIGRATION_COMPLETE
    } else if (progress > 0.3 && progress < 0.7) {
      this.systemState.currentState = SYSTEM_STATES.DUAL_ACTIVE
    } else {
      this.systemState.currentState = SYSTEM_STATES.MIGRATION_ACTIVE
    }

    if (this.config.enableLogging && Math.abs(progress - oldProgress) > 0.1) {
      // eslint-disable-next-line no-console
      console.log(`📊 遷移進度更新: ${(progress * 100).toFixed(1)}% (狀態: ${this.systemState.currentState})`)
    }
  }

  /**
   * 取得系統狀態報告
   * @returns {Object} 系統狀態報告
   */
  getSystemStatusReport () {
    const now = Date.now()
    const runtime = now - (this.systemState.lastStateChange || now)

    return {
      timestamp: now,
      runtime,
      systemState: { ...this.systemState },
      configuration: { ...this.config },
      statistics: {
        errorCounts: { ...this.systemState.errorCounts },
        totalErrors: Object.values(this.systemState.errorCounts).reduce((sum, count) => sum + count, 0),
        cacheStats: {
          hits: this.performanceMetrics.cacheHits,
          misses: this.performanceMetrics.cacheMisses,
          hitRate: this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) || 0
        },
        performanceStats: {
          averageConversionTime: this._calculateAverage(this.performanceMetrics.conversionTimes),
          averageValidationTime: this._calculateAverage(this.performanceMetrics.validationTimes),
          totalBridgingOperations: this.performanceMetrics.bridgingOperations
        }
      },
      healthIndicators: this._generateHealthIndicators()
    }
  }

  /**
   * 計算平均值
   * @param {Array} values - 數值陣列
   * @returns {number} 平均值
   * @private
   */
  _calculateAverage (values) {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  /**
   * 產生健康指標
   * @returns {Object} 健康指標
   * @private
   */
  _generateHealthIndicators () {
    const totalErrors = Object.values(this.systemState.errorCounts).reduce((sum, count) => sum + count, 0)
    const failureRate = totalErrors > 0 ? this.systemState.errorCounts.failed / totalErrors : 0
    const cacheHitRate = this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) || 0

    return {
      overall: this._calculateOverallHealth(failureRate, cacheHitRate),
      failureRate,
      cacheEfficiency: cacheHitRate,
      systemStability: failureRate < 0.05 ? 'stable' : failureRate < 0.1 ? 'moderate' : 'unstable',
      migrationReadiness: this.systemState.migrationProgress > 0.8 ? 'ready' : 'in_progress'
    }
  }

  /**
   * 計算整體健康度
   * @param {number} failureRate - 失敗率
   * @param {number} cacheHitRate - 快取命中率
   * @returns {string} 健康狀態
   * @private
   */
  _calculateOverallHealth (failureRate, cacheHitRate) {
    if (failureRate < 0.02 && cacheHitRate > 0.8) return 'excellent'
    if (failureRate < 0.05 && cacheHitRate > 0.6) return 'good'
    if (failureRate < 0.1 && cacheHitRate > 0.4) return 'fair'
    return 'poor'
  }

  /**
   * 清理資源
   */
  cleanup () {
    this.errorMappingCache.clear()
    this.performanceMetrics.conversionTimes = []
    this.performanceMetrics.validationTimes = []

    if (this.config.enableLogging) {
      // eslint-disable-next-line no-console
      console.log('🧹 雙重錯誤系統橋接器資源已清理')
    }
  }
}

// CommonJS exports
module.exports = {
  DualErrorSystemBridge,
  DUAL_SYSTEM_MODES,
  COMPATIBILITY_LEVELS,
  SYSTEM_STATES
}
