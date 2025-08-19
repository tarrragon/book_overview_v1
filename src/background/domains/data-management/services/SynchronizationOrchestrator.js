/**
 * @fileoverview SynchronizationOrchestrator - 同步協調統籌管理服務
 * @version 1.0.0
 * @since 2025-08-19
 *
 * 負責功能：
 * - 統籌多重服務的同步協調流程
 * - 智能同步策略選擇和執行管理
 * - 跨服務的錯誤處理和恢復機制
 * - 整體同步效能監控和最佳化
 *
 * 設計考量：
 * - 作為 data-synchronization-service.js 重構的最終整合層
 * - 協調 ISynchronizationCoordinator、DataComparisonEngine、ConflictDetectionService、RetryCoordinator
 * - 提供統一的同步入口點和智能策略選擇
 * - 支援依賴注入和靈活的服務組合
 *
 * 處理流程：
 * 1. 接收同步請求和配置參數
 * 2. 協調資料比較和差異分析
 * 3. 執行衝突檢測和智能解決
 * 4. 管理重試機制和失敗恢復
 * 5. 生成完整同步報告和統計
 *
 * 使用情境：
 * - data-synchronization-service.js 的核心替代實作
 * - 統一的資料同步服務入口點
 * - 高層級的同步策略協調和管理
 * - 整合各專責服務的業務邏輯協調
 */

// 導入依賴服務
const ReadmooSynchronizationCoordinator = require('../synchronization/readmoo-synchronization-coordinator.js')
const DataComparisonEngine = require('./DataComparisonEngine.js')
const ConflictDetectionService = require('./ConflictDetectionService.js')
const RetryCoordinator = require('./RetryCoordinator.js')

class SynchronizationOrchestrator {
  /**
   * 建構同步協調統籌器
   * @param {Object} options - 協調器配置選項
   */
  constructor (options = {}) {
    // 協調器配置
    this.config = {
      enableConflictDetection: options.enableConflictDetection !== false,
      enableRetryMechanism: options.enableRetryMechanism !== false,
      enableIntelligentSync: options.enableIntelligentSync !== false,
      maxSyncAttempts: options.maxSyncAttempts || 3,
      maxConcurrentJobs: options.maxConcurrentJobs || 3,
      batchSize: options.batchSize || 100,
      syncStrategy: options.syncStrategy || 'AUTO',
      ...options
    }

    // 同步策略定義
    this.syncStrategies = {
      STANDARD_SYNC: 'STANDARD_SYNC',
      BATCH_SYNC: 'BATCH_SYNC',
      PARALLEL_SYNC: 'PARALLEL_SYNC',
      INCREMENTAL_SYNC: 'INCREMENTAL_SYNC',
      AUTO: 'AUTO'
    }

    // 初始化服務依賴（支援依賴注入）
    this.initializeServices(options)

    // 統計資訊
    this.stats = {
      totalOrchestrations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0
    }

    this.isInitialized = true
  }

  /**
   * 初始化服務依賴
   * @param {Object} options - 初始化選項
   */
  initializeServices (options) {
    // 使用依賴注入或建立預設服務
    this.syncCoordinator = options.syncCoordinator || new ReadmooSynchronizationCoordinator()
    this.comparisonEngine = options.comparisonEngine || new DataComparisonEngine()
    this.conflictService = options.conflictService || new ConflictDetectionService()
    this.retryCoordinator = options.retryCoordinator || new RetryCoordinator()
  }

  /**
   * 統籌執行完整的同步流程
   * @param {Array} sourceData - 源資料
   * @param {Array} targetData - 目標資料
   * @param {Object} options - 同步選項
   * @returns {Promise<Object>} 同步結果
   */
  async orchestrateSync (sourceData, targetData, options = {}) {
    const startTime = Date.now()

    try {
      // 驗證同步前置條件
      const validation = this.validateSyncPrerequisites({ sourceData, targetData, options })
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
          stage: 'VALIDATION',
          processingTime: Date.now() - startTime
        }
      }

      // 階段 1: 資料比較分析
      let comparisonResult
      try {
        comparisonResult = await this.comparisonEngine.calculateDataDifferences(sourceData, targetData)
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stage: 'COMPARISON',
          processingTime: Date.now() - startTime
        }
      }

      // 階段 2: 衝突檢測（如果啟用）
      let conflictResult = { hasConflicts: false, items: [], severity: 'NONE' }
      if (this.config.enableConflictDetection && comparisonResult.changes.modified?.length > 0) {
        try {
          conflictResult = await this.conflictService.detectConflicts(
            sourceData,
            targetData,
            comparisonResult.changes
          )
        } catch (error) {
          // 衝突檢測失敗不阻止同步，但記錄警告
          console.warn('Conflict detection failed:', error.message)
        }
      }

      // 階段 3: 智能同步策略執行
      const syncStrategy = this.executeIntelligentSync(comparisonResult, conflictResult)

      // 階段 4: 執行同步操作
      let syncResult
      if (conflictResult.hasConflicts && !conflictResult.autoResolvable) {
        // 處理衝突
        syncResult = await this.syncCoordinator.handleConflicts(conflictResult, options)
      } else {
        // 標準同步
        const syncOptions = { ...options, changes: comparisonResult.changes }
        syncResult = await this.syncCoordinator.syncData(sourceData, targetData, syncOptions)
      }

      // 更新統計
      this.updateSuccessStatistics(Date.now() - startTime)

      return {
        success: true,
        synchronized: syncResult.synced || 0,
        conflicts: conflictResult.hasConflicts ? conflictResult.items.length : 0,
        conflictsResolved: syncResult.resolvedConflicts || 0,
        strategy: syncStrategy.strategy,
        processingTime: Date.now() - startTime,
        comparisonSummary: comparisonResult.summary,
        conflictSeverity: conflictResult.severity,
        timestamp: Date.now()
      }
    } catch (error) {
      this.updateFailureStatistics(Date.now() - startTime)
      return {
        success: false,
        error: error.message,
        stage: 'ORCHESTRATION',
        processingTime: Date.now() - startTime
      }
    }
  }

  /**
   * 執行智能同步策略選擇
   * @param {Object} comparisonResult - 比較結果
   * @param {Object} conflictResult - 衝突結果
   * @returns {Object} 選擇的策略
   */
  executeIntelligentSync (comparisonResult, conflictResult) {
    const totalChanges = comparisonResult.summary.total || 0
    const hasConflicts = conflictResult.hasConflicts

    // 根據資料量和衝突情況選擇策略
    if (totalChanges === 0) {
      return { strategy: this.syncStrategies.STANDARD_SYNC, reason: 'No changes detected' }
    }

    if (hasConflicts || totalChanges > 20) {
      return { strategy: this.syncStrategies.BATCH_SYNC, reason: 'Large changes or conflicts detected' }
    }

    if (totalChanges > 5 && !hasConflicts) {
      return { strategy: this.syncStrategies.PARALLEL_SYNC, reason: 'Medium changes without conflicts' }
    }

    return { strategy: this.syncStrategies.STANDARD_SYNC, reason: 'Small changes, standard processing' }
  }

  /**
   * 執行帶重試機制的同步
   * @param {Object} syncJob - 同步作業
   * @returns {Promise<Object>} 重試結果
   */
  async handleSyncWithRetry (syncJob) {
    if (!this.config.enableRetryMechanism) {
      return { success: false, error: 'Retry mechanism disabled' }
    }

    // 檢查是否可重試
    if (!this.retryCoordinator.canRetry(syncJob)) {
      return { success: false, error: 'Maximum retries exceeded or error not retryable' }
    }

    // 執行重試
    const executor = async (retryParams) => {
      return await this.syncCoordinator.syncData(
        retryParams.sourceData,
        retryParams.targetData,
        retryParams
      )
    }

    return await this.retryCoordinator.executeRetry(syncJob, executor)
  }

  /**
   * 驗證同步前置條件
   * @param {Object} syncData - 同步資料
   * @returns {Object} 驗證結果
   */
  validateSyncPrerequisites (syncData) {
    const { sourceData, targetData, options } = syncData
    const errors = []
    const warnings = []

    // 基本資料驗證
    if (!Array.isArray(sourceData)) {
      errors.push('Source data must be an array')
    }
    if (!Array.isArray(targetData)) {
      errors.push('Target data must be an array')
    }
    if (!options) {
      errors.push('Sync options are required')
    }

    // 警告條件
    if (Array.isArray(sourceData) && sourceData.length === 0 &&
        Array.isArray(targetData) && targetData.length === 0) {
      warnings.push('Empty data sets detected')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 根據效能統計執行動態最佳化
   * @param {Object} performanceStats - 效能統計
   * @returns {Object} 最佳化配置
   */
  optimizeSyncPerformance (performanceStats) {
    const { averageProcessingTime = 500, conflictRate = 0 } = performanceStats

    const optimizedConfig = {
      batchSize: this.config.batchSize,
      enableParallelProcessing: false,
      conflictDetectionLevel: 'STANDARD'
    }

    // 根據處理時間調整批次大小
    if (averageProcessingTime > 1000) {
      optimizedConfig.batchSize = Math.max(50, this.config.batchSize * 0.7)
      optimizedConfig.conflictDetectionLevel = 'ENHANCED'
    } else if (averageProcessingTime < 600) {
      optimizedConfig.batchSize = Math.min(200, this.config.batchSize * 1.5)
      optimizedConfig.enableParallelProcessing = true
    }

    // 根據衝突率調整檢測等級
    if (conflictRate > 0.3) {
      optimizedConfig.conflictDetectionLevel = 'ENHANCED'
    }

    return optimizedConfig
  }

  /**
   * 生成同步報告
   * @param {Object} syncResults - 同步結果
   * @param {Object} syncStats - 同步統計
   * @returns {Object} 詳細報告
   */
  generateSyncReport (syncResults, syncStats) {
    const { synchronized, conflicts, processingTime, strategy } = syncResults

    return {
      summary: {
        totalItems: synchronized,
        conflictRate: synchronized > 0 ? conflicts / synchronized : 0,
        successRate: syncResults.success ? 1 : 0
      },
      performance: {
        processingTimeMs: processingTime,
        strategy,
        throughput: synchronized > 0 ? synchronized / (processingTime / 1000) : 0
      },
      reliability: {
        retryCount: syncResults.retryCount || 0,
        conflictsResolved: syncResults.conflictsResolved || 0
      },
      recommendations: this.generatePerformanceRecommendations({
        processingTime,
        conflictRate: synchronized > 0 ? conflicts / synchronized : 0,
        totalSync: synchronized
      }),
      timestamp: Date.now()
    }
  }

  /**
   * 生成效能建議
   * @param {Object} stats - 統計資料
   * @returns {Array} 建議列表
   */
  generatePerformanceRecommendations (stats) {
    const recommendations = []
    const { processingTime, averageProcessingTime, conflictRate, retryRate } = stats

    // 使用實際參數名稱
    const actualProcessingTime = processingTime || averageProcessingTime || 0

    if (actualProcessingTime >= 1500) {
      recommendations.push('考慮增加批次大小以提高處理效率')
    }

    if (conflictRate > 0.2) {
      recommendations.push('衝突率偏高，建議加強資料驗證')
    }

    if (retryRate && retryRate > 0.15) {
      recommendations.push('重試率偏高，建議檢查網路連線或服務穩定性')
    }

    if (recommendations.length === 0) {
      recommendations.push('同步效能表現良好，維持當前配置')
    }

    return recommendations
  }

  /**
   * 更新服務配置
   * @param {Object} newConfig - 新配置
   */
  updateServiceConfigs (newConfig) {
    // 更新本服務配置
    this.config = { ...this.config, ...newConfig }

    // 同步更新所有子服務配置
    if (this.comparisonEngine?.updateConfig) {
      this.comparisonEngine.updateConfig({
        batchSize: newConfig.batchSize,
        caseSensitive: newConfig.caseSensitive,
        numericTolerance: newConfig.numericTolerance
      })
    }

    if (this.conflictService?.updateConfig) {
      this.conflictService.updateConfig({
        conflictDetectionThreshold: newConfig.conflictDetectionThreshold,
        autoResolveConflicts: newConfig.autoResolveConflicts
      })
    }

    if (this.retryCoordinator?.updateConfig) {
      this.retryCoordinator.updateConfig({
        maxRetryAttempts: newConfig.maxRetryAttempts,
        baseDelay: newConfig.baseDelay,
        maxDelay: newConfig.maxDelay
      })
    }
  }

  /**
   * 獲取彙總統計資訊
   * @returns {Object} 彙總統計
   */
  getAggregatedStatistics () {
    const comparisonStats = this.comparisonEngine?.getStatistics() || {}
    const conflictStats = this.conflictService?.getStatistics() || {}
    const retryStats = this.retryCoordinator?.getRetryStatistics() || {}

    const totalOperations = this.stats.totalOrchestrations
    const successRate = totalOperations > 0 ? this.stats.successfulSyncs / totalOperations : 0

    return {
      orchestrator: {
        ...this.stats,
        successRate: Math.round(successRate * 1000) / 1000
      },
      comparison: comparisonStats,
      conflicts: conflictStats,
      retry: retryStats,
      overall: {
        successRate,
        totalProcessingTime: this.stats.totalProcessingTime,
        averageProcessingTime: this.stats.averageProcessingTime
      },
      timestamp: Date.now()
    }
  }

  /**
   * 重置所有統計計數器
   */
  resetAllStatistics () {
    // 重置本服務統計
    this.stats = {
      totalOrchestrations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0
    }

    // 重置所有子服務統計
    if (this.comparisonEngine?.resetStatistics) {
      this.comparisonEngine.resetStatistics()
    }
    if (this.conflictService?.resetStatistics) {
      this.conflictService.resetStatistics()
    }
    if (this.retryCoordinator?.resetStatistics) {
      this.retryCoordinator.resetStatistics()
    }
  }

  /**
   * 更新成功統計
   * @param {number} processingTime - 處理時間
   */
  updateSuccessStatistics (processingTime) {
    this.stats.totalOrchestrations++
    this.stats.successfulSyncs++
    this.stats.totalProcessingTime += processingTime
    this.stats.averageProcessingTime = this.stats.totalProcessingTime / this.stats.totalOrchestrations
  }

  /**
   * 更新失敗統計
   * @param {number} processingTime - 處理時間
   */
  updateFailureStatistics (processingTime) {
    this.stats.totalOrchestrations++
    this.stats.failedSyncs++
    this.stats.totalProcessingTime += processingTime
    this.stats.averageProcessingTime = this.stats.totalProcessingTime / this.stats.totalOrchestrations
  }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SynchronizationOrchestrator
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.SynchronizationOrchestrator = SynchronizationOrchestrator
}
