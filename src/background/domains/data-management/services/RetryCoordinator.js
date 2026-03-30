/**
 * RetryCoordinator - 重試協調器
 *
 * 職責：
 * - 重試機制和策略選擇
 * - 退避演算法和時間計算
 * - 錯誤分析和可重試性判斷
 * - 重試限制和失敗處理
 * - 斷路器模式：連續失敗超過閾值時暫停重試，防止無效請求
 * - 狀態持久化：透過 chrome.storage.local 在 Service Worker 重啟後恢復狀態
 *
 * TDD實作：根據測試驅動的最小可行實作
 */
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

// 斷路器狀態常數
const CircuitState = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
}

// 持久化存儲 key
const STORAGE_KEY = 'retryCoordinator_state'

class RetryCoordinator {
  constructor (config = {}) {
    // 預設配置
    this.config = {
      maxRetryAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      jitterFactor: 0.1,
      defaultStrategy: 'EXPONENTIAL_BACKOFF',
      circuitBreakerCooldown: 60000,
      circuitBreakerThreshold: 5,
      ...config
    }

    // 統計資料
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0
    }

    // 斷路器狀態：連續失敗超過 threshold 後進入 OPEN，拒絕所有重試
    this.circuitBreaker = {
      state: CircuitState.CLOSED,
      failureCount: 0,
      lastFailureTime: null,
      cooldownPeriod: this.config.circuitBreakerCooldown,
      failureThreshold: this.config.circuitBreakerThreshold
    }

    // 待處理的重試任務（用於持久化恢復）
    this.pendingRetries = []

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
      const error = new Error(`錯誤不可重試: ${analysis.category}`)
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = { category: 'general', analysis }
      throw error
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
    // 斷路器檢查：OPEN 狀態拒絕所有重試
    if (this.isCircuitOpen()) {
      return {
        success: false,
        error: '斷路器已開啟，暫停重試等待冷卻',
        retryCount: failedJob.retryCount || 0,
        circuitState: this.circuitBreaker.state
      }
    }

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

      // 斷路器記錄成功
      this.recordSuccess()

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

      // 斷路器記錄失敗
      this.recordFailure()

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

  // --- 斷路器（Circuit Breaker）方法 ---

  /**
   * 檢查斷路器是否開啟（應拒絕請求）
   *
   * 業務規則：
   * - CLOSED：正常，允許重試
   * - OPEN：超過冷卻期後轉為 HALF_OPEN 允許一次試探；否則拒絕
   * - HALF_OPEN：允許一次試探性重試
   *
   * @returns {boolean} true 表示斷路器開啟，應拒絕重試
   */
  isCircuitOpen () {
    if (this.circuitBreaker.state === CircuitState.CLOSED) {
      return false
    }

    if (this.circuitBreaker.state === CircuitState.OPEN) {
      const elapsed = Date.now() - this.circuitBreaker.lastFailureTime
      if (elapsed >= this.circuitBreaker.cooldownPeriod) {
        // 冷卻期已過，轉為 HALF_OPEN 允許試探
        this.circuitBreaker.state = CircuitState.HALF_OPEN
        return false
      }
      return true
    }

    // HALF_OPEN：允許一次試探性重試
    return false
  }

  /**
   * 記錄重試成功，重置斷路器
   *
   * 業務規則：成功時將斷路器恢復為 CLOSED，清零失敗計數
   */
  recordSuccess () {
    this.circuitBreaker.failureCount = 0
    this.circuitBreaker.state = CircuitState.CLOSED
  }

  /**
   * 記錄重試失敗，可能觸發斷路器開啟
   *
   * 業務規則：連續失敗次數達到 failureThreshold 時進入 OPEN 狀態
   */
  recordFailure () {
    this.circuitBreaker.failureCount++
    this.circuitBreaker.lastFailureTime = Date.now()

    if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
      this.circuitBreaker.state = CircuitState.OPEN
    }
  }

  /**
   * 取得斷路器當前狀態
   * @returns {Object} 斷路器狀態快照
   */
  getCircuitState () {
    return {
      state: this.circuitBreaker.state,
      failureCount: this.circuitBreaker.failureCount,
      lastFailureTime: this.circuitBreaker.lastFailureTime,
      cooldownPeriod: this.circuitBreaker.cooldownPeriod,
      failureThreshold: this.circuitBreaker.failureThreshold
    }
  }

  // --- 持久化（chrome.storage.local）方法 ---

  /**
   * 將重試佇列和斷路器狀態存到 chrome.storage.local
   *
   * 業務規則：Service Worker 可能隨時被終止，
   * 持久化確保重啟後能恢復未完成的重試和斷路器狀態
   */
  async saveState () {
    const stateData = {
      circuitBreaker: {
        state: this.circuitBreaker.state,
        failureCount: this.circuitBreaker.failureCount,
        lastFailureTime: this.circuitBreaker.lastFailureTime
      },
      pendingRetries: this.pendingRetries,
      stats: { ...this.stats },
      savedAt: Date.now()
    }

    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: stateData })
    } catch (error) {
      // 持久化失敗不應阻塞重試流程，記錄錯誤供除錯
      console.error('RetryCoordinator saveState 失敗:', error.message || error)
    }
  }

  /**
   * 從 chrome.storage.local 恢復狀態
   *
   * 業務規則：Service Worker 重啟時呼叫，恢復未完成的重試和斷路器狀態
   *
   * @returns {Object|null} 恢復的狀態，若無存儲資料則回傳 null
   */
  async loadState () {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY)
      const stateData = result[STORAGE_KEY]

      if (!stateData) {
        return null
      }

      // 恢復斷路器狀態
      if (stateData.circuitBreaker) {
        this.circuitBreaker.state = stateData.circuitBreaker.state || CircuitState.CLOSED
        this.circuitBreaker.failureCount = stateData.circuitBreaker.failureCount || 0
        this.circuitBreaker.lastFailureTime = stateData.circuitBreaker.lastFailureTime || null
      }

      // 恢復待處理的重試任務
      if (Array.isArray(stateData.pendingRetries)) {
        this.pendingRetries = stateData.pendingRetries
      }

      // 恢復統計資料
      if (stateData.stats) {
        this.stats = {
          totalRetries: stateData.stats.totalRetries || 0,
          successfulRetries: stateData.stats.successfulRetries || 0,
          failedRetries: stateData.stats.failedRetries || 0
        }
      }

      return stateData
    } catch (error) {
      // 載入失敗不應阻塞初始化，記錄錯誤供除錯
      console.error('RetryCoordinator loadState 失敗:', error.message || error)
      return null
    }
  }
}

module.exports = RetryCoordinator
module.exports.CircuitState = CircuitState
module.exports.STORAGE_KEY = STORAGE_KEY
