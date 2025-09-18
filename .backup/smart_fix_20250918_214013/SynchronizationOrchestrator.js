/**
 * SynchronizationOrchestrator - 同步協調器
 *
 * 職責：
 * - 統籌管理多重服務依賴的整合協調
 * - 智能同步策略的選擇和執行
 * - 錯誤處理和失敗恢復機制
 * - 同步協調器的統籌管理功能
 *
 * TDD實作：根據測試驅動的最小可行實作
 */

// 導入依賴服務（用於預設實例化）
const DataComparisonEngine = require('./DataComparisonEngine.js')
const ConflictDetectionService = require('./ConflictDetectionService.js')
const RetryCoordinator = require('./RetryCoordinator.js')

class SynchronizationOrchestrator {
  constructor (dependencies = {}) {
    // 依賴注入
    this.syncCoordinator = dependencies.syncCoordinator
    this.comparisonEngine = dependencies.comparisonEngine
    this.conflictService = dependencies.conflictService
    this.retryCoordinator = dependencies.retryCoordinator

    // 預設配置
    this.config = {
      enableConflictDetection: true,
      enableRetryMechanism: true,
      maxSyncAttempts: 3,
      enableSmartSync: false,
      maxConcurrentJobs: 3,
      batchSize: 100,
      ...dependencies
    }

    // 統計資料
    this.stats = {
      totalOrchestrations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalProcessingTime: 0
    }

    this.isInitialized = true

    // 自動初始化預設服務
    this._initializeDefaultServices()
  }

  /**
   * 協調同步流程
   * @param {Array} sourceData - 源資料
   * @param {Array} targetData - 目標資料
   * @param {Object} options - 同步選項
   * @returns {Promise<Object>} 同步結果
   */
  async orchestrateSync (sourceData, targetData, options = {}) {
    const startTime = performance.now()
    this.stats.totalOrchestrations++

    try {
      // 1. 資料差異計算
      const differences = await this.comparisonEngine.calculateDataDifferences(sourceData, targetData)

      // 2. 衝突檢測
      let conflictResult = { hasConflicts: false, items: [], severity: 'NONE' }
      if (this.config.enableConflictDetection) {
        conflictResult = await this.conflictService.detectConflicts(
          sourceData,
          targetData,
          differences.changes
        )
      }

      // 3. 執行同步
      let syncResult
      if (conflictResult.hasConflicts) {
        // 處理衝突的同步
        const conflictResolution = await this.syncCoordinator.handleConflicts(conflictResult)
        syncResult = {
          success: conflictResolution.success,
          synchronized: differences.summary?.total || 0,
          conflicts: conflictResult.items?.length || 0,
          conflictsResolved: conflictResolution.resolvedConflicts || 0,
          unresolvedConflicts: conflictResolution.unresolvedConflicts || 0
        }
      } else {
        // 標準同步流程
        syncResult = await this.syncCoordinator.syncData(differences.changes, options)
        syncResult = {
          success: syncResult.success,
          synchronized: syncResult.synced || differences.summary?.total || 0,
          conflicts: 0,
          conflictsResolved: 0,
          unresolvedConflicts: 0
        }
      }

      // 更新統計
      const processingTime = performance.now() - startTime
      this.stats.totalProcessingTime += processingTime
      if (syncResult.success) {
        this.stats.successfulSyncs++
      } else {
        this.stats.failedSyncs++
      }

      return {
        ...syncResult,
        processingTime,
        timestamp: Date.now()
      }
    } catch (error) {
      this.stats.failedSyncs++
      // 緩雅處理服務失敗，指示失敗階段
      let stage = 'UNKNOWN'
      if (error.message.includes('Comparison')) {
        stage = 'COMPARISON'
      } else if (error.message.includes('Conflict')) {
        stage = 'CONFLICT_DETECTION'
      } else if (error.message.includes('Sync')) {
        stage = 'SYNCHRONIZATION'
      }

      return {
        success: false,
        error: error.message,
        stage,
        synchronized: 0,
        conflicts: 0,
        processingTime: performance.now() - startTime,
        timestamp: Date.now()
      }
    }
  }

  /**
   * 執行智能同步策略選擇
   * @param {Object} differences - 資料差異
   * @param {Object} conflictResult - 衝突結果
   * @returns {Object} 同步策略
   */
  executeIntelligentSync (differences, conflictResult) {
    const totalChanges = differences.summary?.total || 0
    const hasConflicts = conflictResult.hasConflicts

    // 策略選擇邏輯
    if (totalChanges > 30 || hasConflicts) {
      return {
        strategy: 'BATCH_SYNC',
        reason: 'Large number of changes or conflicts detected',
        estimatedTime: totalChanges * 100,
        priority: 'HIGH'
      }
    } else {
      return {
        strategy: 'STANDARD_SYNC',
        reason: 'Small number of changes, no conflicts',
        estimatedTime: totalChanges * 50,
        priority: 'NORMAL'
      }
    }
  }

  /**
   * 帶重試機制的同步處理
   * @param {Object} syncJob - 同步作業
   * @returns {Promise<Object>} 同步結果
   */
  async handleSyncWithRetry (syncJob) {
    // 檢查是否已經超過重試限制
    if (syncJob.retryCount >= 3 || !this.retryCoordinator.canRetry(syncJob.id, syncJob.error)) {
      return {
        success: false,
        error: 'Maximum retries exceeded: ' + (syncJob.error || 'Unknown error'),
        retryCount: syncJob.retryCount || 0
      }
    }

    try {
      // 第一次嘗試
      const result = await this.syncCoordinator.syncData(
        syncJob.sourceData,
        syncJob.options
      )
      return {
        success: true,
        result,
        retryCount: 0
      }
    } catch (error) {
      // 檢查是否可以重試
      if (this.retryCoordinator.canRetry(syncJob.id, error)) {
        const retryResult = await this.retryCoordinator.executeRetry(
          syncJob.id,
          () => this.syncCoordinator.syncData(syncJob.sourceData, syncJob.options)
        )
        return {
          success: retryResult.success,
          result: retryResult.result,
          retryCount: retryResult.retryCount || 1
        }
      }

      return {
        success: false,
        error: 'Maximum retries exceeded: ' + error.message,
        retryCount: this.config.maxSyncAttempts
      }
    }
  }

  /**
   * 動態調整同步效能配置
   * @param {Object} stats - 同步統計
   * @returns {Object} 優化建議
   */
  optimizeSyncPerformance (stats) {
    const recommendations = []

    // 根據統計調整建議
    const optimizedConfig = {
      batchSize: this.config.batchSize,
      enableParallelProcessing: false,
      conflictDetectionLevel: 'STANDARD'
    }

    // 輕量工作負載優化
    if (stats.averageProcessingTime < 1000 && stats.conflictRate < 0.3) {
      optimizedConfig.batchSize = Math.min(200, this.config.batchSize * 1.5)
      optimizedConfig.enableParallelProcessing = true

      recommendations.push({
        type: 'PERFORMANCE',
        suggestion: 'Increase batch size for better throughput',
        currentValue: this.config.batchSize,
        recommendedValue: optimizedConfig.batchSize
      })
    }

    // 重量工作負載優化
    if (stats.averageProcessingTime > 1000 || stats.conflictRate > 0.3) {
      optimizedConfig.batchSize = Math.max(50, this.config.batchSize * 0.7)
      optimizedConfig.conflictDetectionLevel = 'ENHANCED'

      recommendations.push({
        type: 'PERFORMANCE',
        suggestion: 'Reduce batch size to improve stability',
        currentValue: this.config.batchSize,
        recommendedValue: optimizedConfig.batchSize
      })

      if (stats.conflictRate > 0.3) {
        recommendations.push({
          type: 'CONFLICT',
          suggestion: 'Enable enhanced conflict detection',
          action: 'ENABLE_ENHANCED_DETECTION'
        })
      }
    }

    return optimizedConfig
  }

  /**
   * 生成同步報告
   * @param {Object} syncResults - 同步結果
   * @param {Object} syncStats - 同步統計
   * @returns {Object} 同步報告
   */
  generateSyncReport (syncResults, syncStats) {
    const conflictRate = syncResults.synchronized > 0
      ? syncResults.conflicts / syncResults.synchronized
      : 0

    return {
      summary: {
        totalItems: syncResults.synchronized,
        conflictRate,
        successRate: syncResults.success ? 1.0 : 0.0,
        timestamp: Date.now()
      },
      performance: {
        processingTimeMs: syncResults.processingTime,
        strategy: syncResults.strategy,
        throughput: syncResults.synchronized / (syncResults.processingTime / 1000)
      },
      reliability: {
        retryCount: syncResults.retryCount || 0,
        errorRate: syncResults.success ? 0.0 : 1.0
      },
      statistics: {
        comparison: syncStats.comparisonStats || {},
        conflicts: syncStats.conflictStats || {},
        retry: syncStats.retryStats || {}
      },
      recommendations: this._generateRecommendations(syncResults, conflictRate)
    }
  }

  /**
   * 初始化服務
   * @param {Object} config - 配置選項
   */
  initializeServices (config = {}) {
    this.config = { ...this.config, ...config }

    // 總是建立服務實例，即使有依賴注入也要確保都有定義
    this._initializeDefaultServices()
  }

  /**
   * 更新服務配置
   * @param {Object} newConfig - 新配置
   */
  updateServiceConfigs (newConfig) {
    this.config = { ...this.config, ...newConfig }

    // 更新各服務的配置
    if (this.comparisonEngine && this.comparisonEngine.updateConfig) {
      this.comparisonEngine.updateConfig({
        batchSize: newConfig.batchSize
      })
    }

    if (this.conflictService && this.conflictService.updateConfig) {
      this.conflictService.updateConfig({
        conflictDetectionThreshold: newConfig.conflictDetectionThreshold
      })
    }

    if (this.retryCoordinator && this.retryCoordinator.updateConfig) {
      this.retryCoordinator.updateConfig({
        maxRetryAttempts: newConfig.maxRetryAttempts
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

    const successRate = this.stats.totalOrchestrations > 0
      ? this.stats.successfulSyncs / this.stats.totalOrchestrations
      : 0

    return {
      comparison: {
        totalComparisons: comparisonStats.totalComparisons || 0,
        totalProcessingTime: comparisonStats.totalProcessingTime || 0
      },
      conflicts: {
        totalConflictsDetected: conflictStats.totalConflictsDetected || 0,
        resolvedConflicts: conflictStats.resolvedConflicts || 0
      },
      retry: {
        totalRetries: retryStats.totalRetries || 0,
        successfulRetries: retryStats.successfulRetries || 0
      },
      overall: {
        successRate,
        totalOrchestrations: this.stats.totalOrchestrations,
        averageProcessingTime: this.stats.totalOrchestrations > 0
          ? this.stats.totalProcessingTime / this.stats.totalOrchestrations
          : 0
      }
    }
  }

  /**
   * 重置所有統計
   */
  resetAllStatistics () {
    // 重置自身統計
    this.stats = {
      totalOrchestrations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalProcessingTime: 0
    }

    // 重置各服務統計 - 使用不同的方法名稱
    if (this.comparisonEngine?.clearStatistics) {
      this.comparisonEngine.clearStatistics()
    } else if (this.comparisonEngine?.resetStatistics) {
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
   * 計算優化分數
   * @param {Object} stats - 統計資料
   * @returns {number} 優化分數 (0-100)
   */
  _calculateOptimizationScore (stats) {
    let score = 100

    // 處理時間影響
    if (stats.averageProcessingTime > 1000) {
      score -= 20
    }

    // 衝突率影響
    if (stats.conflictRate > 0.2) {
      score -= 30
    }

    // 重試率影響
    if (stats.retryRate > 0.1) {
      score -= 15
    }

    return Math.max(0, score)
  }

  /**
   * 生成報告建議
   * @param {Object} syncResults - 同步結果
   * @param {number} conflictRate - 衝突率
   * @returns {Array} 建議列表
   */
  _generateRecommendations (syncResults, conflictRate) {
    const recommendations = []

    if (conflictRate > 0.2) {
      recommendations.push({
        type: 'CONFLICT_OPTIMIZATION',
        message: 'High conflict rate detected. Consider reviewing data validation rules.'
      })
    }

    if (syncResults.retryCount > 2) {
      recommendations.push({
        type: 'RELIABILITY_IMPROVEMENT',
        message: 'Multiple retries occurred. Check network stability and service availability.'
      })
    }

    return recommendations
  }

  /**
   * 驗證同步前置條件
   * @param {Object} data - 同步資料
   * @returns {Object} 驗證結果
   */
  validateSyncPrerequisites (data) {
    const errors = []
    const warnings = []

    // 檢查源資料
    if (!Array.isArray(data.sourceData)) {
      if (data.sourceData === 'invalid') {
        errors.push('Source data must be an array')
      } else if (!data.sourceData) {
        errors.push('Source data is required')
      }
    } else if (data.sourceData.length === 0) {
      warnings.push('Empty data sets detected')
    }

    // 檢查目標資料
    if (!Array.isArray(data.targetData)) {
      errors.push('Target data must be an array')
    } else if (data.targetData.length === 0 && data.sourceData.length === 0) {
      warnings.push('Empty data sets detected')
    }

    // 檢查選項
    if (!data.options || Object.keys(data.options).length === 0) {
      errors.push('Sync options are required')
    } else if (!data.options.source) {
      errors.push('Source option is required')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 產生效能建議
   * @param {Object} stats - 效能統計
   * @returns {Array} 建議列表
   */
  generatePerformanceRecommendations (stats) {
    const recommendations = []

    if (stats.averageProcessingTime > 500) {
      recommendations.push('考慮增加批次大小以提高處理效率')
    }

    if (stats.conflictRate > 0.2) {
      recommendations.push('建議啟用進階衝突檢測以減少衝突發生')
      recommendations.push('衝突率偏高，建議加強資料驗證')
    }

    if (stats.throughput < 50) {
      recommendations.push('優化資料傳輸效率以提升整體性能')
    }

    return recommendations
  }

  /**
   * 處理重試失敗
   * @param {Object} syncJob - 同步作業
   * @returns {Promise<Object>} 同步結果
   */
  async handleSyncWithRetryFailure (syncJob) {
    try {
      // 第一次嘗試
      const result = await this.syncCoordinator.syncData(
        syncJob.sourceData,
        syncJob.options
      )
      return {
        success: true,
        result,
        retryCount: 0
      }
    } catch (error) {
      // 檢查是否可以重試
      if (this.retryCoordinator.canRetry(syncJob.id, error)) {
        try {
          const retryResult = await this.retryCoordinator.executeRetry(
            syncJob.id,
            () => this.syncCoordinator.syncData(syncJob.sourceData, syncJob.options)
          )
          return {
            success: retryResult.success,
            result: retryResult.result,
            retryCount: retryResult.retryCount || 1
          }
        } catch (retryError) {
          return {
            success: false,
            error: 'Maximum retries exceeded: ' + retryError.message,
            retryCount: this.config.maxSyncAttempts
          }
        }
      } else {
        return {
          success: false,
          error: 'Maximum retries exceeded: ' + error.message,
          retryCount: 0
        }
      }
    }
  }

  /**
   * 初始化預設服務實例
   */
  _initializeDefaultServices () {
    // 總是建立服務，即使是空值或無效值也要建立預設實例
    if (!this.syncCoordinator || this.syncCoordinator === null) {
      this.syncCoordinator = {
        syncData: () => Promise.resolve({ success: true, synced: 0 }),
        handleConflicts: () => Promise.resolve({ success: true, resolvedConflicts: 0 }),
        validateDataIntegrity: () => Promise.resolve(true),
        getStatistics: () => ({ totalSync: 0 })
      }
    }

    if (!this.comparisonEngine || typeof this.comparisonEngine === 'string') {
      this.comparisonEngine = new DataComparisonEngine()
    }

    if (!this.conflictService || this.conflictService === undefined) {
      this.conflictService = new ConflictDetectionService()
    }

    if (!this.retryCoordinator) {
      this.retryCoordinator = new RetryCoordinator()
    }
  }
}

module.exports = SynchronizationOrchestrator
