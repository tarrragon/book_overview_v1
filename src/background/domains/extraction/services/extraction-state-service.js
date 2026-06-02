/**
 * 提取狀態管理服務
 *
 * 負責功能：
 * - 提取作業的狀態追蹤和管理
 * - 提取進度監控和報告
 * - 提取歷史記錄和統計
 * - 作業排程和重試機制
 *
 * 設計考量：
 * - 即時狀態更新和通知
 * - 持久化狀態儲存
 * - 自動重試和錯誤恢復機制
 * - 詳細的作業生命週期追蹤
 *
 * 使用情境：
 * - 管理書籍資料提取作業狀態
 * - 監控提取進度和效能表現
 * - 處理提取失敗和重試邏輯
 */

const {
  EXTRACTION_EVENTS,
  EVENT_PRIORITIES
} = require('src/background/constants/module-constants')
const ErrorCodes = require('src/core/errors/ErrorCodes')

class ExtractionStateService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: 提取狀態服務需要追蹤作業生命週期和狀態變化的關鍵事件
    // 執行環境: Service Worker 初始化階段，依賴注入可能不完整
    // 後備機制: console 確保模組生命週期錯誤能被追蹤
    // 風險考量: 理想上應確保 Logger 完整可用，此為過渡性保護
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false,
      tracking: false
    }

    // 提取作業管理
    this.extractionJobs = new Map()
    this.jobHistory = new Map()
    this.activeJobs = new Set()
    this.failedJobs = new Map()
    this.registeredListeners = new Map()

    // 狀態配置
    this.config = {
      maxActiveJobs: 5,
      maxRetryAttempts: 3,
      retryDelay: 5000,
      jobTimeout: 300000, // 5分鐘
      historyRetention: 100,
      enableAutoRetry: true
    }

    // 作業狀態定義
    this.JOB_STATES = {
      PENDING: 'pending',
      RUNNING: 'running',
      COMPLETED: 'completed',
      FAILED: 'failed',
      CANCELLED: 'cancelled',
      RETRYING: 'retrying'
    }

    // 統計資料
    this.stats = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      retriedJobs: 0,
      averageCompletionTime: 0,
      totalProcessingTime: 0
    }

    // 進度追蹤
    this.progressTracking = new Map()
    this.performanceMetrics = new Map()
  }

  /**
   * 初始化提取狀態服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('[WARN] 提取狀態服務已初始化')
      return
    }

    try {
      this.logger.log('[STATS] 初始化提取狀態服務')

      // 初始化作業調度器
      await this.initializeJobScheduler()

      // 載入歷史作業記錄
      await this.loadJobHistory()

      // 註冊事件監聽器
      await this.registerEventListeners()

      this.state.initialized = true
      this.logger.log('[OK] 提取狀態服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.STATE.INITIALIZED', {
          serviceName: 'ExtractionStateService',
          config: this.config
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 初始化提取狀態服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動提取狀態服務
   */
  async start () {
    if (!this.state.initialized) {
      const error = new Error('服務尚未初始化')
      error.code = ErrorCodes.SERVICE_INITIALIZATION_ERROR
      error.details = { category: 'general' }
      throw error
    }

    if (this.state.active) {
      this.logger.warn('[WARN] 提取狀態服務已啟動')
      return
    }

    try {
      this.logger.log('[START] 啟動提取狀態服務')

      this.state.active = true
      this.state.tracking = true

      // 啟動自動重試機制
      this.startAutoRetryMechanism()

      // 啟動清理機制
      this.startCleanupMechanism()

      this.logger.log('[OK] 提取狀態服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.STATE.STARTED', {
          serviceName: 'ExtractionStateService'
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 啟動提取狀態服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止提取狀態服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('[WARN] 提取狀態服務未啟動')
      return
    }

    try {
      this.logger.log('[STOP] 停止提取狀態服務')

      // 停止所有活動作業
      await this.cancelAllActiveJobs()

      // 停止自動機制
      this.stopAutoMechanisms()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.state.tracking = false

      this.logger.log('[OK] 提取狀態服務停止完成')

      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.STATE.STOPPED', {
          serviceName: 'ExtractionStateService',
          finalStats: { ...this.stats }
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 停止提取狀態服務失敗:', error)
      throw error
    }
  }

  /**
   * 創建新的提取作業
   */
  async createExtractionJob (jobConfig) {
    try {
      const jobId = this.generateJobId()

      const job = {
        id: jobId,
        type: jobConfig.type || 'unknown',
        source: jobConfig.source || 'unknown',
        target: jobConfig.target || null,
        state: this.JOB_STATES.PENDING,
        createdAt: Date.now(),
        startedAt: null,
        completedAt: null,
        config: { ...jobConfig },
        progress: {
          current: 0,
          total: jobConfig.total || 1,
          percentage: 0
        },
        attempts: 0,
        maxAttempts: jobConfig.maxAttempts || this.config.maxRetryAttempts,
        errors: [],
        metadata: {},
        result: null
      }

      this.extractionJobs.set(jobId, job)
      this.stats.totalJobs++

      this.logger.log(`[LOG] 創建提取作業: ${jobId} (${job.type})`)

      // 發送作業創建事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.JOB.CREATED', {
          jobId,
          jobType: job.type,
          jobConfig: job.config
        })
      }

      return jobId
    } catch (error) {
      this.logger.error('[FAIL] 創建提取作業失敗:', error)
      throw error
    }
  }

  /**
   * 開始執行提取作業
   */
  async startExtractionJob (jobId) {
    try {
      const job = this.extractionJobs.get(jobId)
      if (!job) {
        const error = new Error(`提取作業不存在: ${jobId}`)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = { category: 'general' }
        throw error
      }

      if (job.state !== this.JOB_STATES.PENDING && job.state !== this.JOB_STATES.RETRYING) {
        const error = new Error(`作業狀態無效，無法啟動: ${job.state}`)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = { category: 'general' }
        throw error
      }

      // 檢查同時進行的作業數量
      if (this.activeJobs.size >= this.config.maxActiveJobs) {
        const error = new Error('已達到最大同時作業數量限制')
        error.code = ErrorCodes.RESOURCE_EXHAUSTED
        error.details = { category: 'general' }
        throw error
      }

      // 更新作業狀態
      job.state = this.JOB_STATES.RUNNING
      job.startedAt = Date.now()
      job.attempts++

      this.activeJobs.add(jobId)

      // 設定超時處理
      this.setJobTimeout(jobId)

      this.logger.log(`[START] 開始執行提取作業: ${jobId}`)

      // 發送作業開始事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.JOB.STARTED', {
          jobId,
          jobType: job.type,
          attempt: job.attempts
        })
      }

      return true
    } catch (error) {
      this.logger.error(`[FAIL] 啟動提取作業失敗 (${jobId}):`, error)
      throw error
    }
  }

  /**
   * 更新作業進度
   */
  async updateJobProgress (jobId, progress) {
    try {
      const job = this.extractionJobs.get(jobId)
      if (!job) {
        const error = new Error(`提取作業不存在: ${jobId}`)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = { category: 'general' }
        throw error
      }

      // 更新進度
      job.progress.current = Math.min(progress.current || 0, job.progress.total)
      job.progress.percentage = job.progress.total > 0
        ? (job.progress.current / job.progress.total * 100)
        : 0

      // 更新元資料
      if (progress.metadata) {
        Object.assign(job.metadata, progress.metadata)
      }

      // 發送進度更新事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.JOB.PROGRESS', {
          jobId,
          progress: job.progress,
          metadata: progress.metadata
        })
      }
    } catch (error) {
      this.logger.error(`[FAIL] 更新作業進度失敗 (${jobId}):`, error)
    }
  }

  /**
   * 完成提取作業
   */
  async completeExtractionJob (jobId, result = null) {
    try {
      const job = this.extractionJobs.get(jobId)
      if (!job) {
        const error = new Error(`提取作業不存在: ${jobId}`)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = { category: 'general' }
        throw error
      }

      // 更新作業狀態
      job.state = this.JOB_STATES.COMPLETED
      job.completedAt = Date.now()
      job.result = result
      job.progress.current = job.progress.total
      job.progress.percentage = 100

      // 從活動作業中移除
      this.activeJobs.delete(jobId)

      // 更新統計
      this.stats.completedJobs++
      const completionTime = job.completedAt - job.startedAt
      this.stats.totalProcessingTime += completionTime
      this.stats.averageCompletionTime = this.stats.totalProcessingTime / this.stats.completedJobs

      // 移動到歷史記錄
      this.moveJobToHistory(jobId)

      this.logger.log(`[OK] 提取作業完成: ${jobId} (${completionTime}ms)`)

      // 發送作業完成事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.JOB.COMPLETED', {
          jobId,
          jobType: job.type,
          completionTime,
          result
        })
      }
    } catch (error) {
      this.logger.error(`[FAIL] 完成提取作業失敗 (${jobId}):`, error)
      throw error
    }
  }

  /**
   * 處理作業失敗
   */
  async failExtractionJob (jobId, error) {
    try {
      const job = this.extractionJobs.get(jobId)
      if (!job) {
        const error = new Error(`提取作業不存在: ${jobId}`)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = { category: 'general' }
        throw error
      }

      // 記錄錯誤
      job.errors.push({
        message: error.message || '未知錯誤',
        timestamp: Date.now(),
        attempt: job.attempts
      })

      // 從活動作業中移除
      this.activeJobs.delete(jobId)

      // 檢查是否需要重試
      if (this.config.enableAutoRetry && job.attempts < job.maxAttempts) {
        job.state = this.JOB_STATES.RETRYING
        this.scheduleJobRetry(jobId)
        this.stats.retriedJobs++

        this.logger.log(`[RETRY] 安排重試提取作業: ${jobId} (嘗試 ${job.attempts}/${job.maxAttempts})`)
      } else {
        job.state = this.JOB_STATES.FAILED
        job.completedAt = Date.now()
        this.stats.failedJobs++
        this.failedJobs.set(jobId, job)

        // 移動到歷史記錄
        this.moveJobToHistory(jobId)

        this.logger.error(`[FAIL] 提取作業失敗: ${jobId}`, error)
      }

      // 發送作業失敗事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.JOB.FAILED', {
          jobId,
          jobType: job.type,
          error: error.message,
          willRetry: job.state === this.JOB_STATES.RETRYING
        })
      }
    } catch (err) {
      this.logger.error(`[FAIL] 處理作業失敗時發生錯誤 (${jobId}):`, err)
    }
  }

  /**
   * 取消提取作業
   */
  async cancelExtractionJob (jobId) {
    try {
      const job = this.extractionJobs.get(jobId)
      if (!job) {
        const error = new Error(`提取作業不存在: ${jobId}`)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = { category: 'general' }
        throw error
      }

      job.state = this.JOB_STATES.CANCELLED
      job.completedAt = Date.now()

      this.activeJobs.delete(jobId)
      this.moveJobToHistory(jobId)

      this.logger.log(`取消提取作業: ${jobId}`)

      // 發送作業取消事件
      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.JOB.CANCELLED', {
          jobId,
          jobType: job.type
        })
      }
    } catch (error) {
      this.logger.error(`[FAIL] 取消提取作業失敗 (${jobId}):`, error)
      throw error
    }
  }

  /**
   * 取消所有活動作業
   */
  async cancelAllActiveJobs () {
    const activeJobIds = Array.from(this.activeJobs)
    for (const jobId of activeJobIds) {
      try {
        await this.cancelExtractionJob(jobId)
      } catch (error) {
        this.logger.error(`[FAIL] 取消活動作業失敗 (${jobId}):`, error)
      }
    }
  }

  /**
   * 獲取作業狀態
   */
  getJobStatus (jobId) {
    const job = this.extractionJobs.get(jobId) || this.jobHistory.get(jobId)
    if (!job) {
      return null
    }

    return {
      id: job.id,
      type: job.type,
      state: job.state,
      progress: job.progress,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      attempts: job.attempts,
      errors: job.errors,
      result: job.result
    }
  }

  /**
   * 獲取所有作業狀態
   */
  getAllJobStatuses () {
    const statuses = {}

    // 活動作業
    for (const [jobId] of this.extractionJobs) {
      statuses[jobId] = this.getJobStatus(jobId)
    }

    // 歷史作業
    for (const [jobId] of this.jobHistory) {
      if (!statuses[jobId]) {
        statuses[jobId] = this.getJobStatus(jobId)
      }
    }

    return statuses
  }

  /**
   * 初始化作業調度器
   */
  async initializeJobScheduler () {
    // 初始化調度器邏輯
    this.logger.log('作業調度器初始化完成')
  }

  /**
   * 載入歷史作業記錄
   */
  async loadJobHistory () {
    // 從持久化儲存載入歷史記錄
    this.logger.log('歷史作業記錄載入完成')
  }

  /**
   * 啟動自動重試機制
   */
  startAutoRetryMechanism () {
    this.autoRetryInterval = setInterval(() => {
      this.processRetryQueue()
    }, this.config.retryDelay)
  }

  /**
   * 啟動清理機制
   */
  startCleanupMechanism () {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldJobs()
    }, 60000) // 每分鐘清理一次
  }

  /**
   * 停止自動機制
   */
  stopAutoMechanisms () {
    if (this.autoRetryInterval) {
      clearInterval(this.autoRetryInterval)
      this.autoRetryInterval = null
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * 處理重試佇列
   */
  processRetryQueue () {
    // 處理需要重試的作業
  }

  /**
   * 清理舊作業
   */
  cleanupOldJobs () {
    // 清理過期的歷史記錄
    if (this.jobHistory.size > this.config.historyRetention) {
      const entries = Array.from(this.jobHistory.entries())
      entries.sort((a, b) => a[1].completedAt - b[1].completedAt)

      const toRemove = entries.slice(0, entries.length - this.config.historyRetention)
      toRemove.forEach(([jobId]) => {
        this.jobHistory.delete(jobId)
      })

      this.logger.log(`清理了 ${toRemove.length} 個舊作業記錄`)
    }
  }

  /**
   * 安排作業重試
   */
  scheduleJobRetry (jobId) {
    setTimeout(async () => {
      try {
        await this.startExtractionJob(jobId)
      } catch (error) {
        await this.failExtractionJob(jobId, error)
      }
    }, this.config.retryDelay)
  }

  /**
   * 設定作業超時
   */
  setJobTimeout (jobId) {
    setTimeout(async () => {
      const job = this.extractionJobs.get(jobId)
      if (job && job.state === this.JOB_STATES.RUNNING) {
        const error = new Error('作業執行超時')
        error.code = ErrorCodes.TIMEOUT_ERROR
        error.details = { category: 'general' }
        await this.failExtractionJob(jobId, error)
      }
    }, this.config.jobTimeout)
  }

  /**
   * 移動作業到歷史記錄
   */
  moveJobToHistory (jobId) {
    const job = this.extractionJobs.get(jobId)
    if (job) {
      this.jobHistory.set(jobId, job)
      this.extractionJobs.delete(jobId)
    }
  }

  /**
   * 生成作業 ID
   */
  generateJobId () {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('[WARN] EventBus 不可用，跳過事件監聽器註冊')
      return
    }

    const listeners = [
      {
        event: EXTRACTION_EVENTS.JOB_CREATE_REQUEST,
        handler: this.handleJobCreateRequest.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: EXTRACTION_EVENTS.JOB_START_REQUEST,
        handler: this.handleJobStartRequest.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: EXTRACTION_EVENTS.JOB_PROGRESS_UPDATE,
        handler: this.handleJobProgressUpdate.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      },
      {
        event: EXTRACTION_EVENTS.JOB_COMPLETE_REQUEST,
        handler: this.handleJobCompleteRequest.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: EXTRACTION_EVENTS.JOB_FAIL_REQUEST,
        handler: this.handleJobFailRequest.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      }
    ]

    for (const { event, handler, priority } of listeners) {
      const listenerId = await this.eventBus.on(event, handler, { priority })
      this.registeredListeners.set(event, listenerId)
    }

    this.logger.log(`[OK] 註冊了 ${listeners.length} 個事件監聽器`)
  }

  /**
   * 取消註冊事件監聽器
   */
  async unregisterEventListeners () {
    if (!this.eventBus) return

    for (const [event, listenerId] of this.registeredListeners) {
      try {
        await this.eventBus.off(event, listenerId)
      } catch (error) {
        this.logger.error(`[FAIL] 取消註冊事件監聽器失敗 (${event}):`, error)
      }
    }

    this.registeredListeners.clear()
    this.logger.log('[OK] 所有事件監聽器已取消註冊')
  }

  /**
   * 處理作業創建請求
   */
  async handleJobCreateRequest (event) {
    try {
      const { jobConfig, requestId } = event.data || {}
      const jobId = await this.createExtractionJob(jobConfig)

      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.JOB_CREATE.RESULT', {
          requestId,
          jobId,
          success: true
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理作業創建請求失敗:', error)
    }
  }

  /**
   * 處理作業啟動請求
   */
  async handleJobStartRequest (event) {
    try {
      const { jobId, requestId } = event.data || {}
      await this.startExtractionJob(jobId)

      if (this.eventBus) {
        await this.eventBus.emit('EXTRACTION.JOB_START.RESULT', {
          requestId,
          jobId,
          success: true
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理作業啟動請求失敗:', error)
    }
  }

  /**
   * 處理進度更新
   */
  async handleJobProgressUpdate (event) {
    try {
      const { jobId, progress } = event.data || {}
      await this.updateJobProgress(jobId, progress)
    } catch (error) {
      this.logger.error('[FAIL] 處理進度更新失敗:', error)
    }
  }

  /**
   * 處理作業完成請求
   */
  async handleJobCompleteRequest (event) {
    try {
      const { jobId, result } = event.data || {}
      await this.completeExtractionJob(jobId, result)
    } catch (error) {
      this.logger.error('[FAIL] 處理作業完成請求失敗:', error)
    }
  }

  /**
   * 處理作業失敗請求
   */
  async handleJobFailRequest (event) {
    try {
      const { jobId, error } = event.data || {}
      const newError = new Error(error.message || error)
      newError.code = ErrorCodes.OPERATION_ERROR
      newError.details = { category: 'general' }
      await this.failExtractionJob(jobId, newError)
    } catch (error) {
      this.logger.error('[FAIL] 處理作業失敗請求失敗:', error)
    }
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      tracking: this.state.tracking,
      config: this.config,
      activeJobs: this.activeJobs.size,
      totalJobs: this.extractionJobs.size,
      historyJobs: this.jobHistory.size,
      failedJobs: this.failedJobs.size,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const failureRate = this.stats.totalJobs > 0
      ? (this.stats.failedJobs / this.stats.totalJobs)
      : 0

    const avgCompletionTime = this.stats.averageCompletionTime

    const isHealthy = this.state.initialized &&
                     failureRate < 0.2 && // 失敗率低於20%
                     avgCompletionTime < 60000 && // 平均完成時間低於1分鐘
                     this.activeJobs.size <= this.config.maxActiveJobs

    return {
      service: 'ExtractionStateService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      tracking: this.state.tracking,
      metrics: {
        totalJobs: this.stats.totalJobs,
        completedJobs: this.stats.completedJobs,
        failedJobs: this.stats.failedJobs,
        retriedJobs: this.stats.retriedJobs,
        activeJobs: this.activeJobs.size,
        averageCompletionTime: avgCompletionTime.toFixed(2) + 'ms',
        failureRate: (failureRate * 100).toFixed(2) + '%'
      }
    }
  }
}

module.exports = ExtractionStateService
