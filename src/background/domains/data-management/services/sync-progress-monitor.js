/**
 * @fileoverview Sync Progress Monitor - 同步進度監控與作業管理服務
 * @version v0.9.20
 * @since 2025-08-21
 *
 * 從 data-synchronization-service.js 提取的同步進度監控邏輯
 *
 * 負責功能：
 * - 同步作業進度監控和追蹤
 * - 作業取消和優雅停止處理
 * - 智能重試與錯誤恢復機制
 * - 健康檢查和系統狀態監控
 * - 作業清理和資源管理
 * - 進度事件發送與通知
 *
 * 設計原則：
 * - 專門化進度監控：專注於同步作業的生命週期管理
 * - 資源清理：自動管理過期作業和釋放資源
 * - 可靠的取消機制：支援優雅取消和回滾操作
 * - 智能重試策略：根據錯誤類型提供合適的重試方案
 */

const BaseModule = require('../../../lifecycle/base-module.js')

class SyncProgressMonitor extends BaseModule {
  /**
   * 初始化同步進度監控服務
   * @param {EventBus} eventBus - 事件總線實例
   * @param {Object} dependencies - 依賴注入物件
   */
  constructor (eventBus, dependencies = {}) {
    if (!eventBus) {
      throw new Error('EventBus is required')
    }

    super({
      eventBus,
      logger: dependencies.logger || console,
      config: dependencies.config || {}
    })

    this.eventBus = eventBus
    this.logger = dependencies.logger || console

    // 合併預設配置
    this.effectiveConfig = this.mergeWithDefaults(dependencies.config || {})

    // 同步作業管理
    this.activeSyncJobs = new Map()
    this.completedJobs = new Map()
    this.syncJobQueue = []

    // 效能統計
    this.performanceMetrics = {
      successfulSyncs: 0,
      failedSyncs: 0,
      cancelledSyncs: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0
    }

    // 系統狀態
    this.isInitialized = true
    this.isRunning = false
  }

  /**
   * 合併預設配置
   */
  mergeWithDefaults (userConfig) {
    const defaults = {
      cleanupInterval: 60000, // 1分鐘
      jobRetentionTime: 3600000, // 1小時
      maxActiveSyncJobs: 5,
      retryIntervals: [1000, 5000, 15000, 30000], // 重試間隔
      gracefulCancelTimeout: 30000 // 優雅取消超時
    }

    return {
      ...defaults,
      ...userConfig
    }
  }

  /**
   * 監控同步進度
   * @param {string} syncId - 同步作業 ID
   * @returns {Object} 進度資訊
   */
  async monitorSyncProgress (syncId) {
    try {
      const job = this.findSyncJob(syncId)
      if (!job) {
        return this.createJobNotFoundResponse(syncId)
      }
      return this.buildProgressReport(syncId, job)
    } catch (error) {
      await this.log(`監控同步進度失敗: ${error.message}`, 'error')
      throw error
    }
  }

  /**
   * 尋找同步作業
   */
  findSyncJob (syncId) {
    return this.activeSyncJobs.get(syncId) || this.completedJobs.get(syncId)
  }

  /**
   * 建立作業未找到回應
   */
  createJobNotFoundResponse (syncId) {
    return {
      found: false,
      syncId,
      message: '找不到指定的同步作業'
    }
  }

  /**
   * 建立進度報告
   */
  buildProgressReport (syncId, job) {
    return {
      found: true,
      syncId,
      status: job.status,
      progress: job.progress || 0,
      startTime: job.startTime,
      endTime: job.endTime,
      duration: this.calculateJobDuration(job),
      totalItems: job.totalItems || 0,
      processedItems: job.processedItems || 0,
      sourcePlatforms: job.sourcePlatforms,
      targetPlatforms: job.targetPlatforms,
      error: job.error
    }
  }

  /**
   * 計算作業執行時間
   */
  calculateJobDuration (job) {
    return job.endTime ? job.endTime - job.startTime : Date.now() - job.startTime
  }

  /**
   * 取消同步作業（優雅版本）
   * @param {string} syncId - 同步作業 ID
   * @returns {Object} 取消結果
   */
  async cancelSync (syncId) {
    try {
      const job = this.activeSyncJobs.get(syncId)

      if (!job) {
        return {
          success: false,
          syncId,
          message: '找不到活躍的同步作業'
        }
      }

      // 優雅取消流程
      const cancelResult = await this.performGracefulCancellation(syncId, job)

      await this.log(`同步作業 ${syncId} 已優雅取消`)

      return {
        success: true,
        syncId,
        message: '同步作業已成功取消',
        rollbackInfo: cancelResult.rollbackInfo,
        resourcesCleared: cancelResult.resourcesCleared
      }
    } catch (error) {
      await this.log(`取消同步作業失敗: ${error.message}`, 'error')
      throw error
    }
  }

  /**
   * 重試失敗的同步（智能版本）
   * @param {string} syncId - 同步作業 ID
   * @param {Object} retryOptions - 重試選項
   * @returns {Object} 重試結果
   */
  async retryFailedSync (syncId, retryOptions = {}) {
    try {
      const failedJob = this.completedJobs.get(syncId)

      if (!failedJob || failedJob.status !== 'FAILED') {
        return {
          success: false,
          syncId,
          message: '找不到失敗的同步作業'
        }
      }

      // 智能重試邏輯
      const retryResult = await this.performIntelligentRetry(failedJob, retryOptions)

      await this.log(`智能重試完成: ${syncId} -> ${retryResult.newSyncId}`)

      return {
        success: true,
        originalSyncId: syncId,
        newSyncId: retryResult.newSyncId,
        result: retryResult.result,
        retryStrategy: retryResult.strategy,
        errorAnalysis: retryResult.errorAnalysis
      }
    } catch (error) {
      await this.log(`重試同步作業失敗: ${error.message}`, 'error')
      throw error
    }
  }

  /**
   * 健康檢查
   * @returns {Object} 健康狀態報告
   */
  async healthCheck () {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      activeSyncJobs: this.activeSyncJobs.size,
      queuedJobs: this.syncJobQueue.length,
      performanceMetrics: this.performanceMetrics,
      lastCheck: Date.now()
    }
  }

  /**
   * 發送同步進度事件
   */
  async emitSyncProgressEvent (syncId, progress, message) {
    await this.emitEvent('DATA.SYNC.PROGRESS', {
      syncId,
      progress,
      message,
      timestamp: Date.now()
    })
  }

  /**
   * 啟動清理任務
   */
  startCleanupTasks () {
    setInterval(() => {
      this.cleanupCompletedJobs()
    }, this.effectiveConfig.cleanupInterval)
  }

  /**
   * 清理已完成的同步作業
   */
  cleanupCompletedJobs () {
    const cutoffTime = Date.now() - (this.effectiveConfig.jobRetentionTime || 3600000) // 1小時

    let cleanedCount = 0
    for (const [jobId, job] of this.completedJobs.entries()) {
      if (job.completedAt && job.completedAt < cutoffTime) {
        this.completedJobs.delete(jobId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      this.log(`清理了 ${cleanedCount} 個已完成的同步作業`)
    }
  }

  /**
   * 執行優雅取消
   */
  async performGracefulCancellation (syncId, job) {
    const result = this.createCancellationResult()
    
    try {
      this.markJobAsCancelling(job)
      await this.rollbackJobPartialChanges(job, result)
      await this.clearJobResources(syncId, result)
      this.finalizeCancelledJob(syncId, job)
    } catch (error) {
      await this.log(`優雅取消過程中發生錯誤: ${error.message}`, 'error')
    }

    return result
  }

  /**
   * 建立取消結果容器
   */
  createCancellationResult () {
    return {
      rollbackInfo: [],
      resourcesCleared: []
    }
  }

  /**
   * 標記作業為取消中
   */
  markJobAsCancelling (job) {
    job.cancelling = true
  }

  /**
   * 回滾部分變更
   */
  async rollbackJobPartialChanges (job, result) {
    if (!job.partialResults) return
    
    for (const partialResult of job.partialResults) {
      const rollback = await this.rollbackSinglePartialChange(partialResult)
      result.rollbackInfo.push(rollback)
    }
  }

  /**
   * 清理作業資源
   */
  async clearJobResources (syncId, result) {
    const resourceTypes = ['memory', 'connections', 'locks', 'tempFiles']
    for (const resourceType of resourceTypes) {
      const cleared = await this.clearResourceType(syncId, resourceType)
      if (cleared) {
        result.resourcesCleared.push(resourceType)
      }
    }
  }

  /**
   * 完成取消作業
   */
  finalizeCancelledJob (syncId, job) {
    this.updateJobStatusToCancelled(job)
    this.moveJobToCompleted(syncId, job)
    this.updateCancellationMetrics()
  }

  /**
   * 更新作業狀態為已取消
   */
  updateJobStatusToCancelled (job) {
    job.status = 'CANCELLED'
    job.endTime = Date.now()
    job.cancelled = true
  }

  /**
   * 移動作業到已完成佇列
   */
  moveJobToCompleted (syncId, job) {
    this.completedJobs.set(syncId, job)
    this.activeSyncJobs.delete(syncId)
  }

  /**
   * 更新取消統計
   */
  updateCancellationMetrics () {
    this.performanceMetrics.cancelledSyncs += 1
  }

  /**
   * 執行智能重試
   */
  async performIntelligentRetry (failedJob, retryOptions) {
    // 分析錯誤類型
    const errorAnalysis = this.analyzeRetryError(failedJob.error)

    // 生成新的同步 ID
    const newSyncId = this.generateRetryJobId(failedJob.syncId)

    // 決定重試策略
    const strategy = this.determineRetryStrategy(errorAnalysis, retryOptions)

    return {
      newSyncId,
      result: 'QUEUED_FOR_RETRY',
      strategy,
      errorAnalysis
    }
  }

  /**
   * 分析重試錯誤
   */
  analyzeRetryError (error) {
    const errorMessage = error || ''
    
    if (errorMessage.includes('Network') || errorMessage.includes('timeout')) {
      return {
        errorType: 'NETWORK_ERROR',
        retryRecommended: true,
        estimatedDelay: 30000
      }
    }

    if (errorMessage.includes('permission') || errorMessage.includes('auth')) {
      return {
        errorType: 'PERMISSION_ERROR',
        retryRecommended: false,
        estimatedDelay: 0
      }
    }

    return {
      errorType: 'UNKNOWN_ERROR',
      retryRecommended: true,
      estimatedDelay: 15000
    }
  }

  /**
   * 決定重試策略
   */
  determineRetryStrategy (errorAnalysis, retryOptions) {
    if (!errorAnalysis.retryRecommended) {
      return 'NO_RETRY'
    }

    const maxRetries = retryOptions.maxRetries || 3
    if (maxRetries > 1) {
      return 'EXPONENTIAL_BACKOFF'
    }

    return 'IMMEDIATE_RETRY'
  }

  /**
   * 生成重試作業 ID
   */
  generateRetryJobId (originalSyncId) {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 6)
    return `sync_retry_${timestamp}_${random}`
  }

  /**
   * 回滾單一部分變更（模擬實作）
   */
  async rollbackSinglePartialChange (partialResult) {
    // 模擬回滾操作
    return `reverted change 1`
  }

  /**
   * 清理資源類型（模擬實作）
   */
  async clearResourceType (syncId, resourceType) {
    // 模擬清理操作
    return ['memory', 'connections'].includes(resourceType)
  }

  /**
   * 動態更新配置
   */
  updateConfig (newConfig) {
    this.effectiveConfig = {
      ...this.effectiveConfig,
      ...newConfig
    }
  }

  /**
   * 獲取當前配置
   */
  getConfig () {
    return { ...this.effectiveConfig }
  }

  /**
   * 發送事件
   * @param {string} eventType - 事件類型
   * @param {Object} data - 事件資料
   */
  async emitEvent (eventType, data) {
    if (this.eventBus && this.eventBus.emit) {
      await this.eventBus.emit(eventType, data)
    }
  }

  /**
   * 記錄日誌
   * @param {string} message - 日誌訊息
   * @param {string} level - 日誌級別
   */
  async log (message, level = 'info') {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [SyncProgressMonitor] ${message}`

    if (this.logger && this.logger[level]) {
      this.logger[level](logMessage)
    } else {
      console.log(logMessage)
    }
  }
}

module.exports = SyncProgressMonitor