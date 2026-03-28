const ErrorCodes = require('src/core/errors/ErrorCodes')

const { EVENT_PRIORITIES, MESSAGE_EVENTS } = require('src/background/constants/module-constants')

/**
 * 佇列管理服務配置常量
 */
const QUEUE_CONFIG = {
  MAX_QUEUE_SIZE: 1000,
  MAX_MESSAGE_AGE: 60000, // 1分鐘
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 1000, // 基礎重試延遲 1秒
  PRIORITY_LEVELS: {
    LOW: 1,
    NORMAL: 2,
    HIGH: 3,
    URGENT: 4,
    CRITICAL: 5
  }
}

const PROCESSING_CONFIG = {
  BATCH_SIZE: 10,
  PROCESSING_INTERVAL: 100, // 100ms
  IDLE_TIMEOUT: 5000, // 5秒空閒後暫停處理
  HEALTH_CHECK_INTERVAL: 30000 // 30秒健康檢查
}

/**
 * 佇列管理服務
 * 負責訊息佇列管理、優先級處理、批次處理、重試機制等
 */
class QueueManagementService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null

    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: 佇列管理服務負責訊息佇列優先級處理和批次處理機制
    // 執行環境: Service Worker 初始化階段，依賴注入可能不完整
    // 後備機制: console 確保模組生命週期錯誤能被追蹤
    // 風險考量: 理想上應確保 Logger 完整可用，此為過渡性保護
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false,
      processing: false
    }

    // 佇列管理
    this.messageQueues = new Map() // 按優先級分組的佇列
    this.processingQueue = []
    this.retryQueue = []
    this.deadLetterQueue = []

    // 處理器狀態
    this.processingInterval = null
    this.healthCheckInterval = null
    this.lastProcessedTime = Date.now()

    // 統計資料
    this.stats = {
      messagesQueued: 0,
      messagesProcessed: 0,
      messagesCompleted: 0,
      messagesFailed: 0,
      messagesRetried: 0,
      messagesDeadLettered: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      queueOverflows: 0,
      batchesProcessed: 0,
      currentQueueSize: 0
    }

    // 初始化佇列
    this.initializeQueues()

    // 事件監聽器記錄
    this.registeredListeners = new Map()
  }

  /**
   * 初始化佇列結構
   */
  initializeQueues () {
    // 按優先級創建佇列
    for (const [, priority] of Object.entries(QUEUE_CONFIG.PRIORITY_LEVELS)) {
      this.messageQueues.set(priority, [])
    }
    this.logger.log('🗂️ 初始化了優先級佇列結構')
  }

  /**
   * 初始化佇列管理服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 佇列管理服務已初始化')
      return
    }

    try {
      this.logger.log('🔄 初始化佇列管理服務')

      // 載入佇列配置
      await this.loadQueueConfiguration()

      this.state.initialized = true
      this.logger.log('✅ 佇列管理服務初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化佇列管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動佇列管理服務
   */
  async start () {
    if (!this.state.initialized) {
      const error = new Error('佇列管理服務尚未初始化')
      error.code = ErrorCodes.CONFIG_ERROR
      error.details = { category: 'general' }
      throw error
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 佇列管理服務已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動佇列管理服務')

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 啟動訊息處理器
      this.startMessageProcessor()

      // 啟動健康檢查監控
      this.startHealthCheckMonitoring()

      this.state.active = true
      this.logger.log('✅ 佇列管理服務啟動完成')
    } catch (error) {
      this.logger.error('❌ 啟動佇列管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止佇列管理服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('⚠️ 佇列管理服務未啟動')
      return
    }

    try {
      this.logger.log('🛑 停止佇列管理服務')

      // 停止訊息處理器
      this.stopMessageProcessor()

      // 停止健康檢查監控
      this.stopHealthCheckMonitoring()

      // 處理剩餘訊息
      await this.processRemainingMessages()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.logger.log('✅ 佇列管理服務停止完成')
    } catch (error) {
      this.logger.error('❌ 停止佇列管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 將訊息加入佇列
   */
  async enqueueMessage (message, priority = QUEUE_CONFIG.PRIORITY_LEVELS.NORMAL) {
    try {
      // 檢查佇列大小限制
      const totalQueueSize = this.getTotalQueueSize()
      if (totalQueueSize >= QUEUE_CONFIG.MAX_QUEUE_SIZE) {
        this.stats.queueOverflows++
        this.logger.warn('⚠️ 佇列已滿，無法加入新訊息')
        return {
          success: false,
          error: 'Queue overflow',
          queueSize: totalQueueSize
        }
      }

      // 建立佇列項目
      const queueItem = {
        id: this.generateMessageId(),
        message,
        priority,
        enqueuedAt: Date.now(),
        attempts: 0,
        status: 'queued'
      }

      // 加入對應優先級佇列
      const priorityQueue = this.messageQueues.get(priority)
      if (priorityQueue) {
        priorityQueue.push(queueItem)
      } else {
        // 如果優先級不存在，加入普通優先級佇列
        this.messageQueues.get(QUEUE_CONFIG.PRIORITY_LEVELS.NORMAL).push(queueItem)
      }

      this.stats.messagesQueued++
      this.stats.currentQueueSize = this.getTotalQueueSize()

      this.logger.log(`📥 訊息已加入佇列: ${queueItem.id} (優先級: ${priority})`)

      return {
        success: true,
        messageId: queueItem.id,
        queuePosition: this.getQueuePosition(queueItem.id),
        queueSize: this.stats.currentQueueSize
      }
    } catch (error) {
      this.logger.error('❌ 加入佇列失敗:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 從佇列移除訊息
   */
  async dequeueMessage (messageId) {
    try {
      // 搜尋所有佇列
      for (const [, queue] of this.messageQueues) {
        const index = queue.findIndex(item => item.id === messageId)
        if (index !== -1) {
          const queueItem = queue.splice(index, 1)[0]
          this.stats.currentQueueSize = this.getTotalQueueSize()

          this.logger.log(`📤 訊息已從佇列移除: ${messageId}`)
          return {
            success: true,
            messageId,
            queueItem
          }
        }
      }

      return {
        success: false,
        error: 'Message not found in queue'
      }
    } catch (error) {
      this.logger.error('❌ 從佇列移除失敗:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 啟動訊息處理器
   */
  startMessageProcessor () {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
    }

    this.processingInterval = setInterval(async () => {
      await this.processMessageBatch()
    }, PROCESSING_CONFIG.PROCESSING_INTERVAL)

    this.state.processing = true
    this.logger.log('⚙️ 訊息處理器已啟動')
  }

  /**
   * 停止訊息處理器
   */
  stopMessageProcessor () {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }

    this.state.processing = false
    this.logger.log('⚙️ 訊息處理器已停止')
  }

  /**
   * 處理訊息批次
   */
  async processMessageBatch () {
    if (!this.state.active) return

    try {
      // 檢查空閒超時
      if (Date.now() - this.lastProcessedTime > PROCESSING_CONFIG.IDLE_TIMEOUT) {
        if (this.getTotalQueueSize() === 0) {
          // 暫時暫停處理以節省資源
          return
        }
      }

      // 獲取下一批次要處理的訊息
      const batch = this.getNextMessageBatch(PROCESSING_CONFIG.BATCH_SIZE)
      if (batch.length === 0) {
        return
      }

      this.stats.batchesProcessed++
      this.lastProcessedTime = Date.now()

      // 處理批次中的每個訊息
      for (const queueItem of batch) {
        await this.processQueueItem(queueItem)
      }

      // 更新佇列大小統計
      this.stats.currentQueueSize = this.getTotalQueueSize()
    } catch (error) {
      this.logger.error('❌ 處理訊息批次失敗:', error)
    }
  }

  /**
   * 獲取下一批次訊息
   */
  getNextMessageBatch (batchSize) {
    const batch = []

    // 按優先級順序處理（從高到低）
    const sortedPriorities = Array.from(this.messageQueues.keys()).sort((a, b) => b - a)

    for (const priority of sortedPriorities) {
      const queue = this.messageQueues.get(priority)

      while (queue.length > 0 && batch.length < batchSize) {
        const queueItem = queue.shift()

        // 檢查訊息是否已過期
        if (this.isMessageExpired(queueItem)) {
          this.handleExpiredMessage(queueItem)
          continue
        }

        batch.push(queueItem)
      }

      if (batch.length >= batchSize) {
        break
      }
    }

    return batch
  }

  /**
   * 處理佇列項目
   */
  async processQueueItem (queueItem) {
    const startTime = Date.now()

    try {
      queueItem.status = 'processing'
      queueItem.attempts++
      queueItem.lastAttemptAt = Date.now()

      this.stats.messagesProcessed++

      // 觸發訊息處理事件
      if (this.eventBus) {
        await this.eventBus.emit('MESSAGE.QUEUE.PROCESSING', {
          messageId: queueItem.id,
          message: queueItem.message,
          attempt: queueItem.attempts,
          timestamp: Date.now()
        }, EVENT_PRIORITIES.NORMAL)
      }

      // 模擬訊息處理（實際上會委託給其他服務）
      const processingResult = await this.delegateMessageProcessing(queueItem)

      if (processingResult.success) {
        await this.handleProcessingSuccess(queueItem, processingResult)
      } else {
        await this.handleProcessingFailure(queueItem, processingResult.error)
      }
    } catch (error) {
      await this.handleProcessingFailure(queueItem, error.message)
    } finally {
      // 更新處理時間統計
      const processingTime = Date.now() - startTime
      this.stats.totalProcessingTime += processingTime
      this.stats.averageProcessingTime = this.stats.totalProcessingTime / this.stats.messagesProcessed
    }
  }

  /**
   * 委託訊息處理
   */
  async delegateMessageProcessing (queueItem) {
    // 這裡會根據訊息類型委託給相應的處理器
    // 現在先模擬處理結果

    try {
      // 觸發具體的訊息處理事件
      if (this.eventBus) {
        const processingEvent = {
          type: 'MESSAGE.PROCESSING.DELEGATE',
          data: {
            messageId: queueItem.id,
            message: queueItem.message,
            priority: queueItem.priority
          }
        }

        // 發射處理事件
        await this.eventBus.emit(processingEvent.type, processingEvent.data)

        // 等待處理結果（這裡可能需要更複雜的事件協調）
        // 暫時假設處理成功
        return {
          success: true,
          result: 'Message processed successfully'
        }
      }

      return {
        success: true,
        result: 'Message processed successfully'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 處理成功的訊息
   */
  async handleProcessingSuccess (queueItem, result) {
    queueItem.status = 'completed'
    queueItem.completedAt = Date.now()
    queueItem.result = result

    this.stats.messagesCompleted++

    // 觸發處理完成事件
    if (this.eventBus) {
      await this.eventBus.emit('MESSAGE.QUEUE.COMPLETED', {
        messageId: queueItem.id,
        result: result.result,
        processingTime: queueItem.completedAt - queueItem.lastAttemptAt,
        attempts: queueItem.attempts,
        timestamp: Date.now()
      }, EVENT_PRIORITIES.LOW)
    }

    this.logger.log(`✅ 訊息處理完成: ${queueItem.id}`)
  }

  /**
   * 處理失敗的訊息
   */
  async handleProcessingFailure (queueItem, error) {
    queueItem.status = 'failed'
    queueItem.lastError = error
    queueItem.failedAt = Date.now()

    this.stats.messagesFailed++

    // 決定是否重試
    if (queueItem.attempts < QUEUE_CONFIG.MAX_RETRY_ATTEMPTS) {
      await this.scheduleRetry(queueItem)
    } else {
      await this.moveToDeadLetterQueue(queueItem, 'max_retries_exceeded')
    }

    this.logger.warn(`⚠️ 訊息處理失敗: ${queueItem.id}, 錯誤: ${error}`)
  }

  /**
   * 排程重試
   */
  async scheduleRetry (queueItem) {
    // 計算重試延遲（指數退避）
    const retryDelay = QUEUE_CONFIG.RETRY_DELAY_BASE * Math.pow(2, queueItem.attempts - 1)

    queueItem.status = 'retry_scheduled'
    queueItem.retryAt = Date.now() + retryDelay

    this.retryQueue.push(queueItem)
    this.stats.messagesRetried++

    // 設定重試定時器
    setTimeout(async () => {
      await this.processRetryMessage(queueItem)
    }, retryDelay)

    this.logger.log(`🔄 訊息已排程重試: ${queueItem.id}, 延遲: ${retryDelay}ms`)
  }

  /**
   * 處理重試訊息
   */
  async processRetryMessage (queueItem) {
    // 從重試佇列移除
    const retryIndex = this.retryQueue.findIndex(item => item.id === queueItem.id)
    if (retryIndex !== -1) {
      this.retryQueue.splice(retryIndex, 1)
    }

    // 重新加入處理佇列
    queueItem.status = 'queued'
    const priorityQueue = this.messageQueues.get(queueItem.priority)
    if (priorityQueue) {
      priorityQueue.unshift(queueItem) // 優先處理重試訊息
    }

    this.logger.log(`🔄 重試訊息已重新加入佇列: ${queueItem.id}`)
  }

  /**
   * 移動到死信佇列
   */
  async moveToDeadLetterQueue (queueItem, reason) {
    queueItem.status = 'dead_letter'
    queueItem.deadLetterReason = reason
    queueItem.deadLetteredAt = Date.now()

    this.deadLetterQueue.push(queueItem)
    this.stats.messagesDeadLettered++

    // 限制死信佇列大小
    if (this.deadLetterQueue.length > 100) {
      this.deadLetterQueue.shift()
    }

    // 觸發死信事件
    if (this.eventBus) {
      await this.eventBus.emit('MESSAGE.QUEUE.DEAD_LETTER', {
        messageId: queueItem.id,
        reason,
        attempts: queueItem.attempts,
        timestamp: Date.now()
      }, EVENT_PRIORITIES.HIGH)
    }

    this.logger.error(`💀 訊息已移至死信佇列: ${queueItem.id}, 原因: ${reason}`)
  }

  /**
   * 檢查訊息是否過期
   */
  isMessageExpired (queueItem) {
    const age = Date.now() - queueItem.enqueuedAt
    return age > QUEUE_CONFIG.MAX_MESSAGE_AGE
  }

  /**
   * 處理過期訊息
   */
  handleExpiredMessage (queueItem) {
    this.logger.warn(`⏰ 訊息已過期: ${queueItem.id}`)
    this.moveToDeadLetterQueue(queueItem, 'message_expired')
  }

  /**
   * 獲取佇列位置
   */
  getQueuePosition (messageId) {
    let position = 0

    // 按優先級順序計算位置
    const sortedPriorities = Array.from(this.messageQueues.keys()).sort((a, b) => b - a)

    for (const priority of sortedPriorities) {
      const queue = this.messageQueues.get(priority)
      const index = queue.findIndex(item => item.id === messageId)

      if (index !== -1) {
        return position + index + 1
      }

      position += queue.length
    }

    return -1 // 未找到
  }

  /**
   * 獲取總佇列大小
   */
  getTotalQueueSize () {
    let totalSize = 0
    for (const queue of this.messageQueues.values()) {
      totalSize += queue.length
    }
    return totalSize
  }

  /**
   * 產生訊息ID
   */
  generateMessageId () {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 處理剩餘訊息
   */
  async processRemainingMessages () {
    const totalMessages = this.getTotalQueueSize()
    if (totalMessages === 0) return

    this.logger.log(`📦 處理剩餘的 ${totalMessages} 個訊息`)

    // 快速處理剩餘訊息
    while (this.getTotalQueueSize() > 0) {
      const batch = this.getNextMessageBatch(PROCESSING_CONFIG.BATCH_SIZE)
      for (const queueItem of batch) {
        // 標記為系統關閉處理
        queueItem.status = 'system_shutdown'
        this.stats.messagesCompleted++
      }
    }

    this.logger.log('✅ 剩餘訊息處理完成')
  }

  /**
   * 載入佇列配置
   */
  async loadQueueConfiguration () {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get(['queue_config'])

        if (stored.queue_config) {
          // 合併配置（保持預設值的完整性）
          Object.assign(QUEUE_CONFIG, stored.queue_config)
          this.logger.log('📚 載入了自訂佇列配置')
        }
      }
    } catch (error) {
      this.logger.error('❌ 載入佇列配置失敗:', error)
    }
  }

  /**
   * 啟動健康檢查監控
   */
  startHealthCheckMonitoring () {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck()
    }, PROCESSING_CONFIG.HEALTH_CHECK_INTERVAL)

    this.logger.log('🔍 佇列健康檢查監控已啟動')
  }

  /**
   * 停止健康檢查監控
   */
  stopHealthCheckMonitoring () {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    this.logger.log('🔍 佇列健康檢查監控已停止')
  }

  /**
   * 執行健康檢查
   */
  async performHealthCheck () {
    const issues = []

    // 檢查佇列大小
    const totalQueueSize = this.getTotalQueueSize()
    if (totalQueueSize > QUEUE_CONFIG.MAX_QUEUE_SIZE * 0.8) {
      issues.push(`佇列接近容量上限: ${totalQueueSize}/${QUEUE_CONFIG.MAX_QUEUE_SIZE}`)
    }

    // 檢查死信佇列
    if (this.deadLetterQueue.length > 50) {
      issues.push(`死信佇列過大: ${this.deadLetterQueue.length}`)
    }

    // 檢查重試佇列
    if (this.retryQueue.length > 100) {
      issues.push(`重試佇列過大: ${this.retryQueue.length}`)
    }

    // 檢查處理效能
    if (this.stats.averageProcessingTime > 5000) {
      issues.push(`平均處理時間過長: ${this.stats.averageProcessingTime}ms`)
    }

    if (issues.length > 0) {
      this.logger.warn('⚠️ 佇列健康檢查發現問題:', issues)
    }

    return {
      healthy: issues.length === 0,
      issues,
      metrics: this.getMetrics()
    }
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 不可用，跳過事件監聽器註冊')
      return
    }

    const listeners = [
      {
        event: MESSAGE_EVENTS.ENQUEUE_REQUESTED,
        handler: this.handleEnqueueRequest.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: MESSAGE_EVENTS.DEQUEUE_REQUESTED,
        handler: this.handleDequeueRequest.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      }
    ]

    for (const { event, handler, priority } of listeners) {
      const listenerId = await this.eventBus.on(event, handler, { priority })
      this.registeredListeners.set(event, listenerId)
    }

    this.logger.log(`✅ 註冊了 ${listeners.length} 個事件監聽器`)
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
        this.logger.error(`❌ 取消註冊事件監聽器失敗 (${event}):`, error)
      }
    }

    this.registeredListeners.clear()
    this.logger.log('✅ 所有事件監聽器已取消註冊')
  }

  /**
   * 處理加入佇列請求
   */
  async handleEnqueueRequest (event) {
    try {
      const { message, priority } = event.data
      await this.enqueueMessage(message, priority)
    } catch (error) {
      this.logger.error('❌ 處理加入佇列請求失敗:', error)
    }
  }

  /**
   * 處理移除佇列請求
   */
  async handleDequeueRequest (event) {
    try {
      const { messageId } = event.data
      await this.dequeueMessage(messageId)
    } catch (error) {
      this.logger.error('❌ 處理移除佇列請求失敗:', error)
    }
  }

  /**
   * 獲取佇列狀態
   */
  getQueueStatus () {
    const queueStatus = {}

    for (const [priority, queue] of this.messageQueues) {
      queueStatus[`priority_${priority}`] = {
        size: queue.length,
        oldestMessage: queue.length > 0 ? queue[0].enqueuedAt : null
      }
    }

    return {
      queues: queueStatus,
      retryQueue: this.retryQueue.length,
      deadLetterQueue: this.deadLetterQueue.length,
      totalSize: this.getTotalQueueSize(),
      processing: this.state.processing
    }
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      processing: this.state.processing,
      queueStatus: this.getQueueStatus(),
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const isHealthy = this.state.initialized && this.state.active

    return {
      service: 'QueueManagementService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      metrics: {
        totalQueueSize: this.getTotalQueueSize(),
        messagesQueued: this.stats.messagesQueued,
        messagesProcessed: this.stats.messagesProcessed,
        messagesCompleted: this.stats.messagesCompleted,
        messagesFailed: this.stats.messagesFailed,
        averageProcessingTime: Math.round(this.stats.averageProcessingTime),
        deadLetterQueueSize: this.deadLetterQueue.length,
        retryQueueSize: this.retryQueue.length
      }
    }
  }

  /**
   * 獲取佇列指標
   */
  getMetrics () {
    return {
      ...this.stats,
      queues: this.getQueueStatus(),
      processingRate: this.stats.messagesProcessed / (Date.now() / 1000), // 每秒處理數
      successRate: this.stats.messagesCompleted / this.stats.messagesProcessed || 0,
      failureRate: this.stats.messagesFailed / this.stats.messagesProcessed || 0
    }
  }
}

module.exports = { QueueManagementService, QUEUE_CONFIG, PROCESSING_CONFIG }
