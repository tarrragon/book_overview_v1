/**
 * RetryCoordinator - 重試協調器
 *
 * 職責：
 * - 智能重試機制和策略選擇
 * - 退避演算法和時間計算
 * - 錯誤分析和可重試性判斷
 * - 重試限制和失敗處理
 *
 * TDD實作：根據測試驅動的最小可行實作
 */
class RetryCoordinator {
  constructor (config = {}) {
    // 預設配置
    this.config = {
      maxRetryAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      jitterFactor: 0.1,
      defaultStrategy: 'EXPONENTIAL_BACKOFF',
      ...config
    }

    // 統計資料
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0
    }

    this.isInitialized = true

    // 不可重試的錯誤模式
    this.nonRetryableErrors = [
      'permission denied',
      'unauthorized',
      'forbidden',
      'access denied',
      'invalid credentials'
    ]
  }

  /**
   * 判斷是否可重試
   * @param {Object} job 作業物件
   * @returns {boolean} 是否可重試
   */
  canRetry (job) {
    // 空值檢查
    if (!job) return false
    if (job === undefined) return false
    if (Object.keys(job).length === 0) return true // 新作業，重試次數為0

    // 檢查重試次數
    const retryCount = job.retryCount || 0
    if (retryCount >= this.config.maxRetryAttempts) {
      return false
    }

    // 檢查錯誤是否可重試
    if (job.error) {
      const analysis = this.analyzeFailureReason(job)
      return analysis.retryable
    }

    return true
  }

  /**
   * 分析失敗原因
   * @param {Object} job 失敗的作業
   * @returns {Object} 分析結果
   */
  analyzeFailureReason (job) {
    const errorMessage = job.error || ''
    const lowerError = errorMessage.toLowerCase()

    // 網路錯誤
    if (lowerError.includes('network') || lowerError.includes('timeout') ||
        lowerError.includes('connection')) {
      return {
        category: 'NETWORK',
        retryable: true,
        recommendedDelay: this.config.baseDelay * 2
      }
    }

    // 資料衝突
    if (lowerError.includes('conflict') || lowerError.includes('duplicate')) {
      return {
        category: 'DATA_CONFLICT',
        retryable: true,
        recommendedDelay: this.config.baseDelay
      }
    }

    // 權限錯誤
    if (this.nonRetryableErrors.some(pattern => lowerError.includes(pattern))) {
      return {
        category: 'AUTHORIZATION',
        retryable: false,
        recommendedDelay: 0
      }
    }

    // 伺服器錯誤
    if (lowerError.includes('server') || lowerError.includes('500')) {
      return {
        category: 'SERVER_ERROR',
        retryable: true,
        recommendedDelay: this.config.baseDelay * 3
      }
    }

    // 未知錯誤 - 預設可重試
    return {
      category: 'UNKNOWN',
      retryable: true,
      recommendedDelay: this.config.baseDelay
    }
  }

  /**
   * 選擇重試策略
   * @param {Object} analysis 失敗分析結果
   * @returns {string} 重試策略
   */
  selectRetryStrategy (analysis) {
    if (!analysis.retryable) {
      throw new Error(`錯誤不可重試: ${analysis.category}`)
    }

    switch (analysis.category) {
      case 'NETWORK':
        return 'EXPONENTIAL_BACKOFF'
      case 'DATA_CONFLICT':
        return 'CONFLICT_RESOLUTION_FIRST'
      case 'SERVER_ERROR':
        return 'LINEAR_BACKOFF'
      default:
        return 'LINEAR_BACKOFF'
    }
  }

  /**
   * 計算退避延遲
   * @param {number} retryCount 重試次數
   * @returns {number} 延遲時間（毫秒）
   */
  calculateBackoffDelay (retryCount) {
    if (retryCount < 0) retryCount = 0

    // 指數退避：baseDelay * 2^retryCount
    let delay = this.config.baseDelay * Math.pow(2, retryCount)

    // 限制最大延遲
    delay = Math.min(delay, this.config.maxDelay)

    // 添加抖動
    const jitter = delay * this.config.jitterFactor * (Math.random() - 0.5) * 2
    delay += jitter

    return Math.max(delay, this.config.baseDelay * 0.5)
  }

  /**
   * 執行重試
   * @param {Object} failedJob 失敗的作業
   * @param {Function} executor 執行函數
   * @returns {Object} 執行結果
   */
  async executeRetry (failedJob, executor) {
    // 檢查是否可重試
    if (!this.canRetry(failedJob)) {
      return {
        success: false,
        error: '超過最大重試次數或錯誤不可重試',
        retryCount: failedJob.retryCount || 0
      }
    }

    // 分析失敗原因並選擇策略
    const analysis = this.analyzeFailureReason(failedJob)
    const strategy = this.selectRetryStrategy(analysis)
    const newRetryCount = (failedJob.retryCount || 0) + 1

    // 計算延遲
    const delay = this.calculateBackoffDelay(newRetryCount - 1)

    // 等待延遲
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    try {
      // 執行重試
      const params = {
        ...failedJob.originalParams,
        retryCount: newRetryCount,
        retryStrategy: strategy
      }

      const result = await executor(params)

      // 成功統計
      this.stats.totalRetries++
      this.stats.successfulRetries++

      return {
        success: true,
        result,
        retryStrategy: strategy,
        retryCount: newRetryCount,
        delayApplied: delay
      }
    } catch (error) {
      // 失敗統計
      this.stats.totalRetries++
      this.stats.failedRetries++

      return {
        success: false,
        error: error.message || error.toString(),
        retryStrategy: strategy,
        retryCount: newRetryCount,
        delayApplied: delay
      }
    }
  }

  /**
   * 判斷是否應該使用抖動
   * @param {string} strategy 重試策略
   * @returns {boolean} 是否使用抖動
   */
  shouldApplyJitter (strategy) {
    switch (strategy) {
      case 'EXPONENTIAL_BACKOFF':
      case 'LINEAR_BACKOFF':
        return true
      case 'CONFLICT_RESOLUTION_FIRST':
        return false
      default:
        return true
    }
  }

  /**
   * 獲取重試統計
   * @returns {Object} 統計資訊
   */
  getRetryStatistics () {
    const successRate = this.stats.totalRetries > 0
      ? this.stats.successfulRetries / this.stats.totalRetries
      : 0

    return {
      ...this.stats,
      successRate: Math.round(successRate * 100) / 100,
      config: this.config,
      timestamp: Date.now()
    }
  }

  /**
   * 重置統計
   */
  resetStatistics () {
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0
    }
  }

  /**
   * 更新配置
   * @param {Object} newConfig 新配置
   */
  updateConfig (newConfig) {
    this.config = { ...this.config, ...newConfig }
  }
}

module.exports = RetryCoordinator
