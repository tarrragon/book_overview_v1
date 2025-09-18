/**
 * StandardError 向後相容包裝器
 *
 * Phase 3 遷移策略：提供無縫的 StandardError 到 ErrorCodes 轉換
 *
 * 功能：
 * - 完全向後相容的 StandardError 介面
 * - 自動轉換到 ErrorCodes v5.0.0 系統
 * - 漸進式遷移支援（雙重系統並行）
 * - 遷移進度追蹤和日誌記錄
 *
 * 設計原則：
 * - 零破壞性變更：現有代碼無需修改即可運行
 * - 透明轉換：自動映射到對應的 ErrorCodes
 * - 功能增強：提供 ErrorCodes 的新功能
 * - 可觀測性：記錄遷移使用情況以便追蹤進度
 */

import { ErrorCodes } from '../errors/ErrorCodes.js'

/**
 * 遷移模式配置
 */
const MIGRATION_MODES = {
  LEGACY_ONLY: 'legacy_only',           // 只使用舊的 StandardError
  WRAPPER_MODE: 'wrapper_mode',         // 包裝器模式（預設）
  DUAL_MODE: 'dual_mode',              // 雙重系統並行
  ERRORCODES_ONLY: 'errorcodes_only'   // 只使用新的 ErrorCodes
}

/**
 * 向後相容的 StandardError 包裝器
 *
 * 這個類別提供與原始 StandardError 完全相同的介面，
 * 但在內部使用 ErrorCodes v5.0.0 系統
 */
export class StandardError extends Error {
  /**
   * StandardError 到 ErrorCodes 的映射表
   */
  static get ERROR_CODE_MAPPING() {
    return {
      // 驗證相關錯誤
      'VALIDATION_ERROR': ErrorCodes.VALIDATION_ERROR,
      'REQUIRED_FIELD_MISSING': ErrorCodes.VALIDATION_ERROR,
      'INVALID_DATA_FORMAT': ErrorCodes.VALIDATION_ERROR,
      'INVALID_FORMAT': ErrorCodes.VALIDATION_ERROR,
      'DATA_VALIDATION_FAILED': ErrorCodes.VALIDATION_ERROR,

      // 操作相關錯誤
      'OPERATION_FAILED': ErrorCodes.OPERATION_ERROR,
      'OPERATION_TIMEOUT': ErrorCodes.TIMEOUT_ERROR,
      'OPERATION_ABORTED': ErrorCodes.OPERATION_ERROR,
      'OPERATION_NOT_SUPPORTED': ErrorCodes.OPERATION_ERROR,

      // 配置相關錯誤
      'CONFIGURATION_ERROR': ErrorCodes.OPERATION_ERROR,
      'CONFIGURATION_MISSING': ErrorCodes.OPERATION_ERROR,
      'EVENTBUS_NOT_CONFIGURED': ErrorCodes.OPERATION_ERROR,
      'INVALID_CONFIGURATION': ErrorCodes.OPERATION_ERROR,

      // 資源相關錯誤
      'RESOURCE_NOT_AVAILABLE': ErrorCodes.OPERATION_ERROR,
      'RESOURCE_NOT_FOUND': ErrorCodes.OPERATION_ERROR,
      'RESOURCE_UNAVAILABLE': ErrorCodes.OPERATION_ERROR,
      'RESOURCE_ACCESS_DENIED': ErrorCodes.CHROME_ERROR,

      // 網路相關錯誤
      'NETWORK_ERROR': ErrorCodes.NETWORK_ERROR,
      'NETWORK_TIMEOUT': ErrorCodes.TIMEOUT_ERROR,
      'CONNECTION_FAILED': ErrorCodes.CONNECTION_ERROR,
      'CONNECTION_TIMEOUT': ErrorCodes.TIMEOUT_ERROR,
      'REQUEST_FAILED': ErrorCodes.NETWORK_ERROR,

      // DOM 相關錯誤
      'DOM_ERROR': ErrorCodes.DOM_ERROR,
      'DOM_ELEMENT_NOT_FOUND': ErrorCodes.DOM_ERROR,
      'DOM_MANIPULATION_FAILED': ErrorCodes.DOM_ERROR,
      'DOM_ACCESS_DENIED': ErrorCodes.DOM_ERROR,

      // 儲存相關錯誤
      'STORAGE_ERROR': ErrorCodes.STORAGE_ERROR,
      'STORAGE_QUOTA_EXCEEDED': ErrorCodes.STORAGE_ERROR,
      'STORAGE_ACCESS_DENIED': ErrorCodes.STORAGE_ERROR,
      'STORAGE_UNAVAILABLE': ErrorCodes.STORAGE_ERROR,

      // Chrome Extension 相關錯誤
      'CHROME_API_ERROR': ErrorCodes.CHROME_ERROR,
      'CHROME_PERMISSION_DENIED': ErrorCodes.CHROME_ERROR,
      'PERMISSION_DENIED': ErrorCodes.CHROME_ERROR,
      'API_UNAVAILABLE': ErrorCodes.CHROME_ERROR,

      // 書籍相關錯誤
      'BOOK_ERROR': ErrorCodes.BOOK_ERROR,
      'BOOK_NOT_FOUND': ErrorCodes.BOOK_ERROR,
      'BOOK_DATA_INVALID': ErrorCodes.BOOK_ERROR,
      'BOOK_EXTRACTION_FAILED': ErrorCodes.BOOK_ERROR,

      // UI 相關錯誤
      'UI_ERROR': ErrorCodes.OPERATION_ERROR,
      'UI_ELEMENT_NOT_FOUND': ErrorCodes.DOM_ERROR,
      'UI_EVENT_FAILED': ErrorCodes.OPERATION_ERROR,
      'UI_RENDERING_FAILED': ErrorCodes.OPERATION_ERROR,

      // 其他常見錯誤
      'UNKNOWN_ERROR': ErrorCodes.UNKNOWN_ERROR,
      'INTERNAL_ERROR': ErrorCodes.UNKNOWN_ERROR,
      'UNEXPECTED_ERROR': ErrorCodes.UNKNOWN_ERROR,
      'GENERIC_ERROR': ErrorCodes.UNKNOWN_ERROR
    }
  }

  /**
   * 遷移統計資料
   */
  static migrationStats = {
    totalUsages: 0,
    errorTypeUsage: new Map(),
    migrationModeUsage: new Map(),
    startTime: Date.now(),
    lastReportTime: Date.now()
  }

  /**
   * 遷移配置
   */
  static migrationConfig = {
    mode: MIGRATION_MODES.WRAPPER_MODE,
    enableLogging: true,
    reportInterval: 60000, // 1分鐘
    autoReportThreshold: 100 // 每100次使用自動報告
  }

  /**
   * 建構函式 - 與原始 StandardError 完全相容
   *
   * @param {string} code - 錯誤代碼
   * @param {string} message - 錯誤訊息
   * @param {Object} options - 錯誤選項
   */
  constructor(code, message, options = {}) {
    // 呼叫父類別建構函式
    super(message)

    // 保持與原始 StandardError 相同的屬性
    this.name = 'StandardError'
    this.code = code
    this.category = options.category || 'general'
    this.details = options.details || {}
    this.timestamp = options.timestamp || Date.now()

    // 新增 ErrorCodes 相容屬性
    this.errorCode = this._mapToErrorCode(code)
    this.subType = this._generateSubType(code)
    this.severity = this._determineSeverity(code, options)

    // 增強的錯誤詳細資訊
    this.enhancedDetails = {
      ...this.details,
      originalCode: code,
      mappedCode: this.errorCode,
      migrationMode: StandardError.migrationConfig.mode,
      wrapperVersion: '1.0.0',
      timestamp: this.timestamp
    }

    // 更新遷移統計
    this._updateMigrationStats(code)

    // 添加 JSON 序列化支援（Chrome Extension 相容）
    this._addSerializationSupport()

    // 根據模式執行不同的處理
    this._handleMigrationMode()
  }

  /**
   * 映射 StandardError 代碼到 ErrorCodes
   * @param {string} standardCode - StandardError 代碼
   * @returns {string} 對應的 ErrorCode
   * @private
   */
  _mapToErrorCode(standardCode) {
    const mapping = StandardError.ERROR_CODE_MAPPING
    const errorCode = mapping[standardCode]

    if (!errorCode) {
      // 記錄未知的錯誤代碼以便後續分析
      this._logUnknownErrorCode(standardCode)
      return ErrorCodes.UNKNOWN_ERROR
    }

    return errorCode
  }

  /**
   * 生成子類型標識
   * @param {string} standardCode - StandardError 代碼
   * @returns {string} 子類型
   * @private
   */
  _generateSubType(standardCode) {
    // 移除常見前綴並轉換為子類型格式
    const subType = standardCode
      .replace(/^(DATA_|DOM_|NETWORK_|STORAGE_|CHROME_|UI_)/, '')
      .replace(/_ERROR$/, '')
      .toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')

    return `Legacy${subType}Error`
  }

  /**
   * 決定錯誤嚴重程度
   * @param {string} code - 錯誤代碼
   * @param {Object} options - 錯誤選項
   * @returns {string} 嚴重程度
   * @private
   */
  _determineSeverity(code, options) {
    // 如果明確指定嚴重程度則使用
    if (options.severity) {
      return options.severity
    }

    // 基於錯誤代碼推斷嚴重程度
    const highSeverityPatterns = [
      'CRITICAL', 'FATAL', 'SECURITY', 'CORRUPTION', 'PERMISSION_DENIED'
    ]

    const mediumSeverityPatterns = [
      'TIMEOUT', 'NETWORK_', 'STORAGE_', 'OPERATION_FAILED'
    ]

    if (highSeverityPatterns.some(pattern => code.includes(pattern))) {
      return 'HIGH'
    }

    if (mediumSeverityPatterns.some(pattern => code.includes(pattern))) {
      return 'MEDIUM'
    }

    return 'LOW'
  }

  /**
   * 更新遷移統計資料
   * @param {string} code - 錯誤代碼
   * @private
   */
  _updateMigrationStats(code) {
    const stats = StandardError.migrationStats

    stats.totalUsages++
    stats.errorTypeUsage.set(code, (stats.errorTypeUsage.get(code) || 0) + 1)
    stats.migrationModeUsage.set(
      StandardError.migrationConfig.mode,
      (stats.migrationModeUsage.get(StandardError.migrationConfig.mode) || 0) + 1
    )

    // 定期報告或達到閾值時報告
    const shouldReport = (
      stats.totalUsages % StandardError.migrationConfig.autoReportThreshold === 0 ||
      Date.now() - stats.lastReportTime > StandardError.migrationConfig.reportInterval
    )

    if (shouldReport) {
      this._reportMigrationProgress()
    }
  }

  /**
   * 記錄未知錯誤代碼
   * @param {string} code - 未知的錯誤代碼
   * @private
   */
  _logUnknownErrorCode(code) {
    if (StandardError.migrationConfig.enableLogging) {
      console.warn(`[StandardError 遷移] 未知錯誤代碼: ${code}`)
    }
  }

  /**
   * 處理不同的遷移模式
   * @private
   */
  _handleMigrationMode() {
    const mode = StandardError.migrationConfig.mode

    switch (mode) {
      case MIGRATION_MODES.LEGACY_ONLY:
        // 只使用原始 StandardError 屬性
        delete this.errorCode
        delete this.subType
        delete this.enhancedDetails
        break

      case MIGRATION_MODES.WRAPPER_MODE:
        // 預設模式，同時提供兩種介面
        break

      case MIGRATION_MODES.DUAL_MODE:
        // 同時記錄到兩個系統
        this._logToDualSystems()
        break

      case MIGRATION_MODES.ERRORCODES_ONLY:
        // 主要使用 ErrorCodes 屬性
        this.name = 'ErrorCodes'
        break
    }
  }

  /**
   * 雙重系統記錄
   * @private
   */
  _logToDualSystems() {
    // 可以在這裡同時記錄到舊系統和新系統
    // 用於並行驗證和比較
    if (StandardError.migrationConfig.enableLogging) {
      console.log(`[雙重系統] StandardError: ${this.code} → ErrorCodes: ${this.errorCode}`)
    }
  }

  /**
   * 添加序列化支援
   * @private
   */
  _addSerializationSupport() {
    this.toJSON = () => ({
      name: this.name,
      message: this.message,
      stack: this.stack,
      code: this.code,
      errorCode: this.errorCode,
      subType: this.subType,
      category: this.category,
      severity: this.severity,
      details: this.details,
      enhancedDetails: this.enhancedDetails,
      timestamp: this.timestamp
    })
  }

  /**
   * 報告遷移進度
   * @private
   */
  _reportMigrationProgress() {
    const stats = StandardError.migrationStats
    const now = Date.now()
    const runtime = now - stats.startTime

    const report = {
      timestamp: now,
      runtime: runtime,
      totalUsages: stats.totalUsages,
      usageRate: stats.totalUsages / (runtime / 1000), // 每秒使用次數
      topErrorTypes: this._getTopErrorTypes(5),
      migrationModeDistribution: Object.fromEntries(stats.migrationModeUsage),
      recommendations: this._generateMigrationRecommendations()
    }

    if (StandardError.migrationConfig.enableLogging) {
      console.log('[StandardError 遷移進度]', report)
    }

    stats.lastReportTime = now
    return report
  }

  /**
   * 獲取最常用的錯誤類型
   * @param {number} limit - 限制數量
   * @returns {Array} 錯誤類型排行
   * @private
   */
  _getTopErrorTypes(limit = 5) {
    const stats = StandardError.migrationStats
    return Array.from(stats.errorTypeUsage.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([type, count]) => ({ type, count }))
  }

  /**
   * 生成遷移建議
   * @returns {Array} 建議列表
   * @private
   */
  _generateMigrationRecommendations() {
    const stats = StandardError.migrationStats
    const recommendations = []

    // 基於使用量的建議
    if (stats.totalUsages > 1000) {
      recommendations.push('考慮開始逐步遷移到 ErrorCodes 系統')
    }

    // 基於錯誤類型分布的建議
    const unknownErrorUsage = stats.errorTypeUsage.get('UNKNOWN_ERROR') || 0
    if (unknownErrorUsage > stats.totalUsages * 0.1) {
      recommendations.push('有較多未知錯誤類型，建議檢查映射表的完整性')
    }

    return recommendations
  }

  // 靜態方法：相容性和配置

  /**
   * 設定遷移模式
   * @param {string} mode - 遷移模式
   */
  static setMigrationMode(mode) {
    if (Object.values(MIGRATION_MODES).includes(mode)) {
      this.migrationConfig.mode = mode
      console.log(`[StandardError 遷移] 模式已設定為: ${mode}`)
    } else {
      throw new Error(`無效的遷移模式: ${mode}`)
    }
  }

  /**
   * 獲取遷移統計資料
   * @returns {Object} 統計資料
   */
  static getMigrationStats() {
    return {
      ...this.migrationStats,
      config: { ...this.migrationConfig }
    }
  }

  /**
   * 重置遷移統計資料
   */
  static resetMigrationStats() {
    this.migrationStats = {
      totalUsages: 0,
      errorTypeUsage: new Map(),
      migrationModeUsage: new Map(),
      startTime: Date.now(),
      lastReportTime: Date.now()
    }
  }

  /**
   * 檢查代碼是否支援映射
   * @param {string} code - 錯誤代碼
   * @returns {boolean} 是否支援
   */
  static isSupportedErrorCode(code) {
    return code in this.ERROR_CODE_MAPPING
  }

  /**
   * 獲取建議的 ErrorCode
   * @param {string} standardCode - StandardError 代碼
   * @returns {string} 建議的 ErrorCode
   */
  static getSuggestedErrorCode(standardCode) {
    return this.ERROR_CODE_MAPPING[standardCode] || ErrorCodes.UNKNOWN_ERROR
  }

  /**
   * 驗證遷移包裝器功能
   * @returns {Object} 驗證結果
   */
  static validateWrapper() {
    const testCases = [
      { code: 'VALIDATION_ERROR', message: '測試驗證錯誤' },
      { code: 'OPERATION_FAILED', message: '測試操作失敗' },
      { code: 'UNKNOWN_TEST_ERROR', message: '測試未知錯誤' }
    ]

    const results = testCases.map(testCase => {
      try {
        const error = new StandardError(testCase.code, testCase.message)
        return {
          testCase,
          success: true,
          errorCode: error.errorCode,
          hasSerializationSupport: typeof error.toJSON === 'function'
        }
      } catch (err) {
        return {
          testCase,
          success: false,
          error: err.message
        }
      }
    })

    return {
      timestamp: Date.now(),
      allTestsPassed: results.every(r => r.success),
      results
    }
  }
}

// 為了向後相容，也提供直接的 StandardError 別名
export const StandardError = StandardError

// 提供遷移模式常數
export { MIGRATION_MODES }