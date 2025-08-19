/**
 * @fileoverview RetryCoordinator - 智能重試協調和策略管理服務
 * @version 1.0.0
 * @since 2025-08-19
 *
 * 負責功能：
 * - 智能重試機制和策略選擇
 * - 退避演算法和時間計算
 * - 錯誤分析和可重試性判斷
 * - 重試統計和效能監控
 *
 * 設計考量：
 * - 從 data-synchronization-service.js 拆分的重試協調邏輯
 * - 支援多種退避策略和錯誤分析
 * - 防雷群效應的抖動機制
 * - 可配置的重試限制和策略
 *
 * 處理流程：
 * 1. 接收失敗作業和重試請求
 * 2. 分析失敗原因和可重試性
 * 3. 選擇適當的重試策略
 * 4. 計算退避延遲和執行重試
 * 5. 記錄統計和回傳結果
 *
 * 使用情境：
 * - ReadmooSynchronizationCoordinator 的重試依賴
 * - 網路錯誤和暫時性失敗的智能恢復
 * - 衝突解決和資料同步重試
 * - 系統韌性和可靠性提升
 */

class RetryCoordinator {
  /**
   * 建構重試協調器
   * @param {Object} options - 重試配置選項
   */
  constructor (options = {}) {
    // 重試配置
    this.config = {
      maxRetryAttempts: options.maxRetryAttempts || 3,
      baseDelay: options.baseDelay || 1000,
      maxDelay: options.maxDelay || 30000,
      jitterFactor: options.jitterFactor || 0.1,
      defaultStrategy: options.defaultStrategy || 'EXPONENTIAL_BACKOFF',
      ...options
    }

    // 重試策略定義
    this.retryStrategies = {
      EXPONENTIAL_BACKOFF: 'EXPONENTIAL_BACKOFF',
      LINEAR_BACKOFF: 'LINEAR_BACKOFF',
      CONFLICT_RESOLUTION_FIRST: 'CONFLICT_RESOLUTION_FIRST'
    }

    // 錯誤類型定義
    this.errorCategories = {
      NETWORK: 'NETWORK',
      DATA_CONFLICT: 'DATA_CONFLICT',
      AUTHORIZATION: 'AUTHORIZATION',
      VALIDATION: 'VALIDATION',
      UNKNOWN: 'UNKNOWN'
    }

    // 統計資訊
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      totalDelayTime: 0,
      averageDelayTime: 0
    }

    // 初始化狀態
    this.isInitialized = true
  }

  /**
   * 判斷作業是否可重試
   * @param {Object} job - 失敗的作業物件
   * @returns {boolean} 是否可重試
   */
  canRetry (job) {
    if (!job) return false

    // 檢查重試次數限制
    const retryCount = job.retryCount || 0
    if (retryCount >= this.config.maxRetryAttempts) {
      return false
    }

    // 分析失敗原因
    const analysis = this.analyzeFailureReason(job)
    return analysis.retryable
  }

  /**
   * 分析失敗原因
   * @param {Object} job - 失敗的作業物件
   * @returns {Object} 錯誤分析結果
   */
  analyzeFailureReason (job) {
    const error = (job.error || '').toString().toLowerCase()

    if (error.includes('network') || error.includes('timeout') || error.includes('connection')) {
      return {
        category: this.errorCategories.NETWORK,
        severity: 'MEDIUM',
        retryable: true,
        recommendedDelay: 5000,
        description: '網路相關錯誤，建議重試'
      }
    }

    if (error.includes('conflict') || error.includes('validation')) {
      return {
        category: this.errorCategories.DATA_CONFLICT,
        severity: 'HIGH',
        retryable: true,
        recommendedDelay: 1000,
        description: '資料衝突，需要衝突解決'
      }
    }

    if (error.includes('permission') || error.includes('auth') || error.includes('denied')) {
      return {
        category: this.errorCategories.AUTHORIZATION,
        severity: 'HIGH',
        retryable: false,
        recommendedDelay: 0,
        description: '權限錯誤，需要人工處理'
      }
    }

    if (error.includes('validation') || error.includes('invalid')) {
      return {
        category: this.errorCategories.VALIDATION,
        severity: 'MEDIUM',
        retryable: true,
        recommendedDelay: 2000,
        description: '驗證錯誤，可嘗試重新處理'
      }
    }

    return {
      category: this.errorCategories.UNKNOWN,
      severity: 'MEDIUM',
      retryable: true,
      recommendedDelay: 2000,
      description: '未知錯誤，嘗試重試'
    }
  }

  /**
   * 選擇重試策略
   * @param {Object} errorAnalysis - 錯誤分析結果
   * @param {Object} options - 重試選項
   * @returns {string} 重試策略
   */
  selectRetryStrategy (errorAnalysis, options = {}) {
    if (!errorAnalysis.retryable) {
      throw new Error(`錯誤不可重試: ${errorAnalysis.category}`)
    }

    // 使用者指定策略
    if (options.strategy) {
      return options.strategy
    }

    // 根據錯誤類型選擇策略
    switch (errorAnalysis.category) {
      case this.errorCategories.NETWORK:
        return this.retryStrategies.EXPONENTIAL_BACKOFF
      case this.errorCategories.DATA_CONFLICT:
        return this.retryStrategies.CONFLICT_RESOLUTION_FIRST
      case this.errorCategories.VALIDATION:
        return this.retryStrategies.LINEAR_BACKOFF
      case this.errorCategories.UNKNOWN:
        return this.retryStrategies.LINEAR_BACKOFF
      default:
        return this.config.defaultStrategy
    }
  }

  /**
   * 計算退避延遲
   * @param {number} retryCount - 重試次數
   * @param {string} strategy - 重試策略
   * @returns {number} 延遲時間（毫秒）
   */
  calculateBackoffDelay (retryCount, strategy = 'EXPONENTIAL_BACKOFF') {
    const count = Math.max(0, retryCount) // 確保不為負數
    const baseDelay = this.config.baseDelay
    const maxDelay = this.config.maxDelay

    let delay

    switch (strategy) {
      case this.retryStrategies.EXPONENTIAL_BACKOFF:
        // 指數退避
        delay = Math.min(baseDelay * Math.pow(2, count), maxDelay)
        break

      case this.retryStrategies.LINEAR_BACKOFF:
        // 線性退避
        delay = Math.min(baseDelay * (count + 1), maxDelay)
        break

      case this.retryStrategies.CONFLICT_RESOLUTION_FIRST:
        // 衝突解決優先，使用固定短延遲
        delay = Math.min(baseDelay * 0.5, maxDelay)
        break

      default:
        delay = Math.min(baseDelay * Math.pow(2, count), maxDelay)
    }

    // 加入抖動以防止雷群效應
    if (this.shouldApplyJitter(strategy)) {
      const jitter = Math.random() * this.config.jitterFactor * delay
      delay = delay + jitter
    }

    // 確保不超過最大延遲
    return Math.floor(Math.min(delay, maxDelay))
  }

  /**
   * 判斷是否應該應用抖動
   * @param {string} strategy - 重試策略
   * @returns {boolean} 是否應用抖動
   */
  shouldApplyJitter (strategy) {
    // 衝突解決優先策略不使用抖動，以確保快速處理
    return strategy !== this.retryStrategies.CONFLICT_RESOLUTION_FIRST
  }

  /**
   * 執行重試
   * @param {Object} job - 失敗的作業物件
   * @param {Function} executor - 執行函數
   * @param {Object} options - 重試選項
   * @returns {Promise<Object>} 重試結果
   */
  async executeRetry (job, executor, options = {}) {
    const startTime = Date.now()

    try {
      // 檢查是否可重試
      if (!this.canRetry(job)) {
        return {
          success: false,
          error: '超過最大重試次數或錯誤不可重試',
          retryCount: job.retryCount || 0,
          strategy: null
        }
      }

      // 分析錯誤和選擇策略
      const errorAnalysis = this.analyzeFailureReason(job)
      const strategy = this.selectRetryStrategy(errorAnalysis, options)
      const retryCount = (job.retryCount || 0) + 1

      // 計算退避延遲
      const delay = this.calculateBackoffDelay(job.retryCount || 0, strategy)

      // 應用延遲
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      // 準備重試參數
      const retryParams = {
        ...job.originalParams,
        retryCount,
        retryStrategy: strategy,
        errorAnalysis,
        previousError: job.error
      }

      // 執行重試
      const result = await executor(retryParams)

      // 更新統計
      this.updateSuccessStatistics(Date.now() - startTime, delay)

      return {
        success: true,
        result,
        retryStrategy: strategy,
        retryCount,
        delayApplied: delay,
        errorAnalysis,
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      // 更新統計
      this.updateFailureStatistics(Date.now() - startTime)

      return {
        success: false,
        error: error.message || error.toString(),
        retryStrategy: this.selectRetryStrategy(this.analyzeFailureReason(job)),
        retryCount: (job.retryCount || 0) + 1,
        delayApplied: this.calculateBackoffDelay(job.retryCount || 0),
        executionTime: Date.now() - startTime
      }
    }
  }

  /**
   * 更新成功統計
   * @param {number} executionTime - 執行時間
   * @param {number} delayTime - 延遲時間
   */
  updateSuccessStatistics (executionTime, delayTime) {
    this.stats.totalRetries++
    this.stats.successfulRetries++
    this.stats.totalDelayTime += delayTime
    this.stats.averageDelayTime = this.stats.totalDelayTime / this.stats.totalRetries
  }

  /**
   * 更新失敗統計
   * @param {number} executionTime - 執行時間
   */
  updateFailureStatistics (executionTime) {
    this.stats.totalRetries++
    this.stats.failedRetries++
  }

  /**
   * 獲取重試統計資訊
   * @returns {Object} 統計資訊
   */
  getRetryStatistics () {
    const successRate = this.stats.totalRetries > 0
      ? this.stats.successfulRetries / this.stats.totalRetries
      : 0

    return {
      ...this.stats,
      successRate: Math.round(successRate * 1000) / 1000, // 保留 3 位小數
      config: this.config,
      timestamp: Date.now()
    }
  }

  /**
   * 重置統計計數器
   */
  resetStatistics () {
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      totalDelayTime: 0,
      averageDelayTime: 0
    }
  }

  /**
   * 更新配置
   * @param {Object} newConfig - 新的配置
   */
  updateConfig (newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    }
  }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RetryCoordinator
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.RetryCoordinator = RetryCoordinator
}
