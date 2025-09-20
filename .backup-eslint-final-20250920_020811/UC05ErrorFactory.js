/**
 * UC05ErrorFactory
 * UC-05 跨設備同步專用錯誤建立工廠
 *
 * 功能：提供4個專用錯誤建立方法，針對跨設備同步場景優化
 * 基於：UC-01/UC-02/UC-03/UC-04 成功架構模式，針對同步場景特化
 *
 * 專用方法：
 * - createSyncVersionError: 版本不相容錯誤
 * - createSyncTimestampError: 時間戳衝突錯誤
 * - createCloudServiceError: 雲端服務無法連接錯誤
 * - createSyncCorruptionError: 同步檔案損壞錯誤
 */

import { UC05ErrorAdapter } from './UC05ErrorAdapter.js'
const { ErrorCodes } = require("./ErrorCodes")

/**
 * UC05ErrorFactory
 * 負責建立4種跨設備同步專用錯誤，提供便利的工廠方法
 *
 * 設計模式：複用UC-01/UC-02/UC-03/UC-04成功架構，針對同步場景優化
 * 效能目標：<200ms 建立100個錯誤，快取機制減少記憶體使用
 */
class UC05ErrorFactory {
  static _cache = new Map()

  /**
   * 建立基本的 UC-05 錯誤
   * @param {string} originalCode 原始StandardError代碼
   * @param {string} message 錯誤訊息
   * @param {Object} details 詳細資訊
   * @returns {Error} 建立的錯誤物件
   */
  static createError (originalCode, message, details = {}) {
    return UC05ErrorAdapter.convertError(originalCode, message, details)
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
        message: 'Sync completed successfully'
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
      error: 'Sync operation failed',
      code: ErrorCodes.UNKNOWN_ERROR,
      details: {},
      subType: 'UNKNOWN'
    }
  }

  /**
   * 建立版本不相容錯誤 (VALIDATION_ERROR)
   * @param {string} localVersion 本地版本
   * @param {string} remoteVersion 遠端版本
   * @param {string} compatibility 相容性狀態
   * @param {boolean} migrationRequired 是否需要遷移
   * @param {Array} affectedFeatures 受影響的功能
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} 版本不相容錯誤物件
   */
  static createSyncVersionError (
    localVersion = 'unknown',
    remoteVersion = 'unknown',
    compatibility = 'unknown',
    migrationRequired = false,
    affectedFeatures = [],
    additionalDetails = {}
  ) {
    const isBackwardCompatible = compatibility === 'backward_compatible'
    const versionDifference = this._calculateVersionDifference(localVersion, remoteVersion)

    const details = {
      localVersion,
      remoteVersion,
      compatibility,
      migrationRequired,
      affectedFeatures,
      versionDifference,
      isBackwardCompatible,
      suggestedActions: this._getVersionConflictActions(compatibility, migrationRequired),
      userGuidance: this._getVersionConflictGuidance(compatibility, migrationRequired),
      resolutionStrategy: {
        autoResolvable: isBackwardCompatible && !migrationRequired,
        requiresUserAction: migrationRequired,
        recommendedAction: isBackwardCompatible ? 'auto_migrate' : 'manual_update'
      },
      ...this.sanitizeDetails(additionalDetails)
    }

    return this.createError(
      'DATA_SYNC_VERSION_MISMATCH',
      '設備間資料版本不相容',
      details
    )
  }

  /**
   * 建立時間戳衝突錯誤 (VALIDATION_ERROR)
   * @param {Array} conflictedBooks 衝突書籍列表
   * @param {string} resolutionStrategy 解決策略
   * @param {Object} syncMetadata 同步中繼資料
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} 時間戳衝突錯誤物件
   */
  static createSyncTimestampError (
    conflictedBooks = [],
    resolutionStrategy = 'manual_resolution',
    syncMetadata = {},
    additionalDetails = {}
  ) {
    const conflictCount = conflictedBooks.length
    const conflictAnalysis = this._analyzeTimestampConflicts(conflictedBooks)

    const details = {
      conflictedBooks: conflictedBooks.slice(0, 10), // 限制顯示前10個衝突
      conflictCount,
      conflictRate: conflictCount > 0 ? `${((conflictCount / Math.max(conflictCount, 100)) * 100).toFixed(1)}%` : '0%',
      resolutionStrategy,
      conflictAnalysis,
      syncMetadata,
      suggestedActions: this._getTimestampConflictActions(resolutionStrategy),
      userGuidance: '發現時間戳衝突，需要選擇合併策略',
      resolutionOptions: {
        latestTimestampWins: '採用最新時間戳的資料',
        manualReview: '逐一手動檢查衝突',
        devicePriority: '基於設備優先級決定',
        preserveBoth: '保留雙方資料供後續選擇'
      },
      autoResolution: {
        enabled: resolutionStrategy !== 'manual_resolution',
        confidence: conflictAnalysis.autoResolutionConfidence,
        fallbackToManual: conflictAnalysis.complexConflictsCount > 0
      },
      ...this.sanitizeDetails(additionalDetails)
    }

    return this.createError(
      'DATA_SYNC_TIMESTAMP_CONFLICT',
      '同步時發現時間戳衝突',
      details
    )
  }

  /**
   * 建立雲端服務無法連接錯誤 (NETWORK_ERROR)
   * @param {string} cloudService 雲端服務名稱
   * @param {string} lastSuccessfulSync 最後成功同步時間
   * @param {number} retryAttempts 重試次數
   * @param {Array} fallbackOptions 備用選項
   * @param {Object} networkInfo 網路資訊
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} 雲端服務無法連接錯誤物件
   */
  static createCloudServiceError (
    cloudService = 'Unknown Cloud Service',
    lastSuccessfulSync = null,
    retryAttempts = 0,
    fallbackOptions = ['local_backup', 'manual_export'],
    networkInfo = {},
    additionalDetails = {}
  ) {
    const serviceStatus = this._analyzeCloudServiceStatus(cloudService, retryAttempts)
    const timeSinceLastSync = lastSuccessfulSync
      ? Date.now() - new Date(lastSuccessfulSync).getTime()
      : null

    const details = {
      cloudService,
      lastSuccessfulSync,
      timeSinceLastSync: timeSinceLastSync ? this._formatDuration(timeSinceLastSync) : 'unknown',
      retryAttempts,
      maxRetryAttempts: 5,
      fallbackOptions,
      networkInfo: {
        online: navigator?.onLine ?? true,
        ...networkInfo
      },
      serviceStatus,
      suggestedActions: this._getCloudServiceActions(serviceStatus, retryAttempts),
      userGuidance: '雲端服務暫時無法連接，可以嘗試備用方案',
      retryStrategy: {
        nextRetryIn: this._calculateNextRetryDelay(retryAttempts),
        exponentialBackoff: true,
        maxRetryDelay: '5 minutes'
      },
      troubleshooting: {
        checkNetworkConnection: true,
        verifyCloudPermissions: serviceStatus.permissionIssue,
        tryDifferentService: retryAttempts > 3
      },
      ...this.sanitizeDetails(additionalDetails)
    }

    return this.createError(
      'NETWORK_CLOUD_SERVICE_UNAVAILABLE',
      '雲端服務暫時無法連接',
      details
    )
  }

  /**
   * 建立同步檔案損壞錯誤 (FILE_ERROR)
   * @param {string} corruptionType 損壞類型
   * @param {string} lastKnownGoodBackup 最後已知良好備份時間
   * @param {string} dataLossRisk 資料遺失風險
   * @param {Array} recoveryOptions 恢復選項
   * @param {Object} corruptionAnalysis 損壞分析
   * @param {Object} additionalDetails 額外詳細資訊
   * @returns {Error} 同步檔案損壞錯誤物件
   */
  static createSyncCorruptionError (
    corruptionType = 'unknown_corruption',
    lastKnownGoodBackup = null,
    dataLossRisk = 'unknown',
    recoveryOptions = ['restore_from_backup', 'manual_reconstruction'],
    corruptionAnalysis = {},
    additionalDetails = {}
  ) {
    const riskAssessment = this._assessDataLossRisk(dataLossRisk, corruptionAnalysis)
    const recoveryPlan = this._generateRecoveryPlan(corruptionType, recoveryOptions)

    const details = {
      corruptionType,
      lastKnownGoodBackup,
      timeSinceGoodBackup: lastKnownGoodBackup
        ? this._formatDuration(Date.now() - new Date(lastKnownGoodBackup).getTime())
        : 'unknown',
      dataLossRisk,
      riskAssessment,
      recoveryOptions,
      recoveryPlan,
      corruptionAnalysis: {
        detectionMethod: 'checksum_validation',
        affectedSections: [],
        recoverableSections: [],
        ...corruptionAnalysis
      },
      suggestedActions: this._getCorruptionRecoveryActions(riskAssessment.level),
      userGuidance: '同步檔案損壞，需要選擇恢復策略以避免資料遺失',
      preventiveMeasures: {
        enableAutoBackup: true,
        increaseBackupFrequency: riskAssessment.level === 'high',
        useMultipleCloudServices: true
      },
      ...this.sanitizeDetails(additionalDetails)
    }

    return this.createError(
      'DATA_SYNC_CORRUPTION_DETECTED',
      '同步檔案損壞，無法安全合併',
      details
    )
  }

  /**
   * 建立同步進度錯誤（輔助方法）
   * @param {number} progress 進度百分比
   * @param {string} stage 失敗階段
   * @param {Object} context 額外上下文
   * @returns {Error} 對應的錯誤物件
   */
  static createSyncProgressError (progress, stage, context = {}) {
    if (stage.includes('version') || stage.includes('compatibility')) {
      return this.createSyncVersionError(
        context.localVersion || 'unknown',
        context.remoteVersion || 'unknown',
        'version_check_failed',
        true,
        ['sync_progress'],
        { progress, stage, ...context }
      )
    } else if (stage.includes('timestamp') || stage.includes('conflict')) {
      return this.createSyncTimestampError(
        context.conflictedBooks || [],
        'auto_resolution_failed',
        { progress, stage },
        context
      )
    } else if (stage.includes('network') || stage.includes('cloud')) {
      return this.createCloudServiceError(
        context.cloudService || 'Unknown Service',
        context.lastSync,
        context.retryAttempts || 0,
        ['retry_later', 'local_backup'],
        { progress, stage },
        context
      )
    } else {
      return this.createSyncCorruptionError(
        `corruption_during_${stage}`,
        context.lastBackup,
        'medium',
        ['restore_from_backup'],
        { progress, stage },
        context
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
      case 'SYNC_VERSION':
        error = this.createSyncVersionError()
        break
      case 'SYNC_TIMESTAMP':
        error = this.createSyncTimestampError()
        break
      case 'CLOUD_SERVICE':
        error = this.createCloudServiceError()
        break
      case 'SYNC_CORRUPTION':
        error = this.createSyncCorruptionError()
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
        summary: 'Large sync data set truncated for memory safety'
      }
    }

    return details
  }

  /**
   * 驗證是否為有效的 UC-05 錯誤
   * @param {Error} error 要驗證的錯誤物件
   * @returns {boolean} 是否為有效的UC-05錯誤
   */
  static isValidUC05Error (error) {
    if (!(error instanceof Error)) return false

    // 檢查是否有必要的屬性
    return error.code !== undefined &&
           error.subType !== undefined &&
           error.details !== undefined &&
           typeof error.details === 'object' &&
           // 檢查是否為UC-05相關的subType
           (error.subType.includes('SYNC_') || error.subType.includes('CLOUD_') || error.subType.includes('UC05'))
  }

  // === 私有輔助方法 ===

  /**
   * 計算版本差異
   */
  static _calculateVersionDifference (localVersion, remoteVersion) {
    try {
      const parseVersion = (v) => v.split('.').map(n => parseInt(n) || 0)
      const local = parseVersion(localVersion)
      const remote = parseVersion(remoteVersion)

      const majorDiff = local[0] - remote[0]
      const minorDiff = local[1] - remote[1]
      const patchDiff = local[2] - remote[2]

      return {
        major: majorDiff,
        minor: minorDiff,
        patch: patchDiff,
        significant: Math.abs(majorDiff) > 0 || Math.abs(minorDiff) > 1
      }
    } catch (e) {
      return { major: 0, minor: 0, patch: 0, significant: false }
    }
  }

  /**
   * 獲取版本衝突處理動作
   */
  static _getVersionConflictActions (compatibility, migrationRequired) {
    const actions = ['check_extension_versions']

    if (migrationRequired) {
      actions.push('perform_data_migration', 'backup_before_migration')
    }

    if (compatibility === 'backward_compatible') {
      actions.push('auto_upgrade_data_format')
    } else {
      actions.push('manual_version_alignment', 'contact_support')
    }

    return actions
  }

  /**
   * 獲取版本衝突指引
   */
  static _getVersionConflictGuidance (compatibility, migrationRequired) {
    if (migrationRequired && compatibility === 'backward_compatible') {
      return '需要進行資料遷移，但可以自動處理'
    } else if (migrationRequired) {
      return '需要手動更新Extension版本以保持同步相容性'
    } else {
      return '版本差異可以自動處理，無需額外操作'
    }
  }

  /**
   * 分析時間戳衝突
   */
  static _analyzeTimestampConflicts (conflictedBooks) {
    const totalConflicts = conflictedBooks.length
    let simpleConflicts = 0
    let complexConflicts = 0

    conflictedBooks.forEach(book => {
      // 簡單衝突：只有時間戳不同，其他資料相同
      if (book.device1?.progress === book.device2?.progress) {
        simpleConflicts++
      } else {
        complexConflicts++
      }
    })

    return {
      totalConflicts,
      simpleConflictsCount: simpleConflicts,
      complexConflictsCount: complexConflicts,
      autoResolutionConfidence: simpleConflicts / Math.max(totalConflicts, 1) * 100,
      recommendedStrategy: complexConflicts >= simpleConflicts ? 'manual_review' : 'latest_timestamp_wins'
    }
  }

  /**
   * 獲取時間戳衝突處理動作
   */
  static _getTimestampConflictActions (strategy) {
    const actions = ['review_conflicts']

    switch (strategy) {
      case 'latest_timestamp_wins':
        actions.push('auto_resolve_by_timestamp', 'verify_resolution')
        break
      case 'manual_resolution':
        actions.push('manual_conflict_review', 'choose_preferred_data')
        break
      case 'device_priority':
        actions.push('set_device_priority', 'apply_priority_rules')
        break
      default:
        actions.push('choose_resolution_strategy')
    }

    return actions
  }

  /**
   * 分析雲端服務狀態
   */
  static _analyzeCloudServiceStatus (cloudService, retryAttempts) {
    return {
      serviceName: cloudService,
      estimatedAvailability: retryAttempts < 3 ? 'temporary_issue' : 'extended_outage',
      permissionIssue: retryAttempts > 2,
      networkIssue: retryAttempts === 1,
      serviceOutage: retryAttempts > 4
    }
  }

  /**
   * 獲取雲端服務處理動作
   */
  static _getCloudServiceActions (serviceStatus, retryAttempts) {
    const actions = ['check_network_connection']

    if (serviceStatus.permissionIssue) {
      actions.push('verify_cloud_permissions', 'reauthorize_service')
    }

    if (retryAttempts < 3) {
      actions.push('retry_connection')
    } else {
      actions.push('try_fallback_options', 'use_local_backup')
    }

    return actions
  }

  /**
   * 計算下次重試延遲
   */
  static _calculateNextRetryDelay (retryAttempts) {
    const baseDelay = 1000 // 1秒
    const maxDelay = 300000 // 5分鐘
    const delay = Math.min(baseDelay * Math.pow(2, retryAttempts), maxDelay)
    return this._formatDuration(delay)
  }

  /**
   * 評估資料遺失風險
   */
  static _assessDataLossRisk (dataLossRisk, corruptionAnalysis) {
    const riskLevels = ['low', 'medium', 'high', 'severe']
    const level = riskLevels.includes(dataLossRisk) ? dataLossRisk : 'medium'

    return {
      level,
      recoverable: level !== 'severe',
      backupRequired: level === 'high' || level === 'severe',
      immediateAction: level === 'severe',
      description: this._getRiskDescription(level)
    }
  }

  /**
   * 生成恢復計畫
   */
  static _generateRecoveryPlan (corruptionType, recoveryOptions) {
    const plan = {
      primaryOption: recoveryOptions[0] || 'restore_from_backup',
      fallbackOptions: recoveryOptions.slice(1),
      estimatedRecoveryTime: this._estimateRecoveryTime(corruptionType),
      dataPreservation: corruptionType.includes('partial') ? 'partial' : 'full_restore_needed'
    }

    return plan
  }

  /**
   * 獲取損壞恢復動作
   */
  static _getCorruptionRecoveryActions (riskLevel) {
    const actions = ['stop_sync_operations', 'assess_data_integrity']

    switch (riskLevel) {
      case 'severe':
        actions.push('immediate_backup_restore', 'contact_support')
        break
      case 'high':
        actions.push('restore_from_backup', 'verify_data_integrity')
        break
      case 'medium':
        actions.push('attempt_repair', 'partial_restore')
        break
      default:
        actions.push('try_auto_repair')
    }

    return actions
  }

  /**
   * 格式化時間間隔
   */
  static _formatDuration (milliseconds) {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days} days`
    if (hours > 0) return `${hours} hours`
    if (minutes > 0) return `${minutes} minutes`
    return `${seconds} seconds`
  }

  /**
   * 獲取風險描述
   */
  static _getRiskDescription (level) {
    const descriptions = {
      low: '輕微損壞，大部分資料可以恢復',
      medium: '中等損壞，部分資料可能遺失',
      high: '嚴重損壞，需要立即備份恢復',
      severe: '極嚴重損壞，可能無法完全恢復'
    }
    return descriptions[level] || '未知風險等級'
  }

  /**
   * 估算恢復時間
   */
  static _estimateRecoveryTime (corruptionType) {
    const timeEstimates = {
      partial_json_truncation: '5-10 minutes',
      complete_file_corruption: '30-60 minutes',
      metadata_corruption: '10-20 minutes',
      unknown_corruption: '15-30 minutes'
    }
    return timeEstimates[corruptionType] || '15-30 minutes'
  }
}

module.exports = { UC05ErrorFactory }
