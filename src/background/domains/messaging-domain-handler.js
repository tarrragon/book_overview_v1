/**
 * 通訊領域處理器
 *
 * 負責功能：
 * - 處理跨上下文通訊相關的領域邏輯和業務規則
 * - 管理 Content Scripts 和 Popup 的通訊協調
 * - 實現訊息路由、驗證和轉換邏輯
 * - 協調通訊會話管理和連接狀態控制
 *
 * 設計考量：
 * - 基於事件驅動架構，響應通訊相關事件
 * - 實現通訊領域的業務邏輯與技術實作分離
 * - 提供訊息處理的統一管理和品質保證
 * - 支援不同通訊模式的策略和協議處理
 */

const {
  MESSAGE_TYPES,
  MESSAGE_SOURCES,
  MESSAGE_EVENTS,
  EVENT_PRIORITIES,
  LIMITS,
  TIMEOUTS
} = require('../constants/module-constants')

class MessagingDomainHandler {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 通訊會話管理
    this.activeSessions = new Map()
    this.sessionHistory = []
    this.connectionStates = new Map()

    // 訊息處理配置
    this.messageHandlers = new Map()
    this.messageValidators = new Map()
    this.messageTransformers = new Map()
    this.routingRules = new Map()

    // 通訊品質控制
    this.communicationMetrics = {
      totalMessages: 0,
      successfulMessages: 0,
      failedMessages: 0,
      averageResponseTime: 0,
      activeConnections: 0,
      sessionCount: 0
    }

    // 訊息佇列管理
    this.messageQueues = {
      inbound: [],
      outbound: [],
      priority: [],
      failed: []
    }

    // 事件監聽器記錄
    this.registeredListeners = new Map()

    // 統計資料
    this.domainStats = {
      messagingEventsProcessed: 0,
      messagesRouted: 0,
      sessionsEstablished: 0,
      connectionFailures: 0,
      validationFailures: 0
    }

    // 處理器狀態
    this.initialized = false
    this.active = false
  }

  /**
   * 初始化通訊領域處理器
   * @returns {Promise<void>}
   */
  async initialize () {
    if (this.initialized) {
      this.logger.warn('⚠️ 通訊領域處理器已初始化')
      return
    }

    try {
      if (this.i18nManager) {
        this.logger.log(this.i18nManager.t('modules.operations.initialize', { moduleName: '通訊領域處理器' }))
      } else {
        this.logger.log('💬 初始化通訊領域處理器')
      }

      // 初始化訊息處理器
      await this.initializeMessageHandlers()

      // 初始化訊息驗證器
      await this.initializeMessageValidators()

      // 初始化訊息轉換器
      await this.initializeMessageTransformers()

      // 初始化路由規則
      await this.initializeRoutingRules()

      // 載入會話歷史
      await this.loadSessionHistory()

      this.initialized = true
      this.logger.log('✅ 通訊領域處理器初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化通訊領域處理器失敗:', error)
      throw error
    }
  }

  /**
   * 啟動通訊領域處理器
   * @returns {Promise<void>}
   */
  async start () {
    if (!this.initialized) {
      throw new Error('通訊領域處理器尚未初始化')
    }

    if (this.active) {
      this.logger.warn('⚠️ 通訊領域處理器已啟動')
      return
    }

    try {
      this.logger.log('▶️ 啟動通訊領域處理器')

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 啟動訊息處理循環
      this.startMessageProcessingLoop()

      // 啟動連接狀態監控
      this.startConnectionMonitoring()

      this.active = true
      this.logger.log('✅ 通訊領域處理器啟動完成')
    } catch (error) {
      this.logger.error('❌ 啟動通訊領域處理器失敗:', error)
      throw error
    }
  }

  /**
   * 停止通訊領域處理器
   * @returns {Promise<void>}
   */
  async stop () {
    if (!this.active) {
      return
    }

    try {
      this.logger.log('⏹️ 停止通訊領域處理器')

      // 停止連接狀態監控
      this.stopConnectionMonitoring()

      // 停止訊息處理循環
      this.stopMessageProcessingLoop()

      // 結束所有活動會話
      await this.terminateAllSessions()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      // 保存會話歷史
      await this.saveSessionHistory()

      this.active = false
      this.logger.log('✅ 通訊領域處理器停止完成')
    } catch (error) {
      this.logger.error('❌ 停止通訊領域處理器失敗:', error)
      throw error
    }
  }

  /**
   * 初始化訊息處理器
   * @returns {Promise<void>}
   * @private
   */
  async initializeMessageHandlers () {
    try {
      // Content Script 訊息處理器
      this.messageHandlers.set(MESSAGE_TYPES.CONTENT_TO_BACKGROUND, async (message, context) => {
        const { tabId, source } = context

        this.logger.log(`📨 處理 Content Script 訊息: ${message.type || 'unknown'} (Tab ${tabId})`)

        // 更新連接狀態
        this.updateConnectionState(tabId, 'active', source)

        // 根據訊息類型處理
        switch (message.type) {
          case MESSAGE_TYPES.CONTENT_SCRIPT_READY:
            return await this.handleContentScriptReady(message, context)

          case MESSAGE_TYPES.CONTENT_EVENT_FORWARD:
            return await this.handleContentEventForward(message, context)

          case MESSAGE_TYPES.CONTENT_STATUS_UPDATE:
            return await this.handleContentStatusUpdate(message, context)

          case MESSAGE_TYPES.CONTENT_SCRIPT_ERROR:
            return await this.handleContentScriptError(message, context)

          default:
            return await this.handleGenericContentMessage(message, context)
        }
      })

      // Popup 訊息處理器
      this.messageHandlers.set(MESSAGE_TYPES.POPUP_TO_BACKGROUND, async (message, context) => {
        const { source, sessionId } = context

        this.logger.log(`🎛️ 處理 Popup 訊息: ${message.type || 'unknown'} (Session ${sessionId})`)

        // 根據訊息類型處理
        switch (message.type) {
          case MESSAGE_TYPES.POPUP_SESSION_START:
            return await this.handlePopupSessionStart(message, context)

          case MESSAGE_TYPES.POPUP_STATUS_REQUEST:
            return await this.handlePopupStatusRequest(message, context)

          case MESSAGE_TYPES.POPUP_DATA_REQUEST:
            return await this.handlePopupDataRequest(message, context)

          case MESSAGE_TYPES.POPUP_OPERATION_REQUEST:
            return await this.handlePopupOperationRequest(message, context)

          case MESSAGE_TYPES.POPUP_SESSION_END:
            return await this.handlePopupSessionEnd(message, context)

          default:
            return await this.handleGenericPopupMessage(message, context)
        }
      })

      // 健康檢查訊息處理器
      this.messageHandlers.set(MESSAGE_TYPES.HEALTH_CHECK, async (message, context) => {
        return {
          success: true,
          status: 'healthy',
          timestamp: Date.now(),
          metrics: this.getCommunicationMetrics()
        }
      })

      // Ping 訊息處理器
      this.messageHandlers.set(MESSAGE_TYPES.PING, async (message, context) => {
        return {
          success: true,
          pong: true,
          timestamp: Date.now()
        }
      })

      this.logger.log('🔧 訊息處理器初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化訊息處理器失敗:', error)
    }
  }

  /**
   * 初始化訊息驗證器
   * @returns {Promise<void>}
   * @private
   */
  async initializeMessageValidators () {
    try {
      // 基本訊息格式驗證器
      this.messageValidators.set('basic', (message) => {
        const errors = []

        if (!message || typeof message !== 'object') {
          errors.push('訊息必須是物件格式')
        }

        if (!message.type || typeof message.type !== 'string') {
          errors.push('訊息必須包含有效的 type 欄位')
        }

        if (message.timestamp && (typeof message.timestamp !== 'number' || message.timestamp <= 0)) {
          errors.push('timestamp 欄位格式無效')
        }

        return {
          valid: errors.length === 0,
          errors
        }
      })

      // Content Script 訊息驗證器
      this.messageValidators.set('content_script', (message) => {
        const errors = []

        // 基本驗證
        const basicValidation = this.messageValidators.get('basic')(message)
        if (!basicValidation.valid) {
          errors.push(...basicValidation.errors)
        }

        // Content Script 特定驗證
        if (message.type === MESSAGE_TYPES.CONTENT_EVENT_FORWARD) {
          if (!message.eventType || typeof message.eventType !== 'string') {
            errors.push('事件轉發訊息必須包含 eventType')
          }

          if (!message.eventData || typeof message.eventData !== 'object') {
            errors.push('事件轉發訊息必須包含 eventData')
          }
        }

        return {
          valid: errors.length === 0,
          errors
        }
      })

      // Popup 訊息驗證器
      this.messageValidators.set('popup', (message) => {
        const errors = []

        // 基本驗證
        const basicValidation = this.messageValidators.get('basic')(message)
        if (!basicValidation.valid) {
          errors.push(...basicValidation.errors)
        }

        // Popup 特定驗證
        if (message.type === MESSAGE_TYPES.POPUP_OPERATION_REQUEST) {
          if (!message.operation || typeof message.operation !== 'string') {
            errors.push('操作請求訊息必須包含 operation')
          }
        }

        return {
          valid: errors.length === 0,
          errors
        }
      })

      this.logger.log('🔧 訊息驗證器初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化訊息驗證器失敗:', error)
    }
  }

  /**
   * 初始化訊息轉換器
   * @returns {Promise<void>}
   * @private
   */
  async initializeMessageTransformers () {
    try {
      // 標準化訊息轉換器
      this.messageTransformers.set('standardize', (message, context) => {
        return {
          ...message,
          timestamp: message.timestamp || Date.now(),
          source: context.source || MESSAGE_SOURCES.UNKNOWN,
          id: message.id || this.generateMessageId(),
          version: '1.0'
        }
      })

      // 事件轉換器
      this.messageTransformers.set('event_forward', (message, context) => {
        if (message.type === MESSAGE_TYPES.CONTENT_EVENT_FORWARD) {
          return {
            type: message.eventType,
            data: {
              ...message.eventData,
              tabId: context.tabId,
              forwardedFrom: 'content_script',
              originalMessage: message
            },
            timestamp: message.timestamp,
            source: context.source
          }
        }

        return message
      })

      // 回應格式轉換器
      this.messageTransformers.set('response_format', (response, context) => {
        return {
          success: response.success !== false,
          data: response.data || response,
          timestamp: Date.now(),
          source: 'background',
          requestId: context.requestId
        }
      })

      this.logger.log('🔧 訊息轉換器初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化訊息轉換器失敗:', error)
    }
  }

  /**
   * 初始化路由規則
   * @returns {Promise<void>}
   * @private
   */
  async initializeRoutingRules () {
    try {
      // Content Script 路由規則
      this.routingRules.set(MESSAGE_SOURCES.CONTENT_SCRIPT, {
        priority: EVENT_PRIORITIES.NORMAL,
        validator: 'content_script',
        transformers: ['standardize', 'event_forward'],
        timeout: TIMEOUTS.DEFAULT_MESSAGE_TIMEOUT,
        retryCount: 2
      })

      // Popup 路由規則
      this.routingRules.set(MESSAGE_SOURCES.POPUP, {
        priority: EVENT_PRIORITIES.HIGH,
        validator: 'popup',
        transformers: ['standardize'],
        timeout: TIMEOUTS.DEFAULT_MESSAGE_TIMEOUT / 2, // Popup 需要更快回應
        retryCount: 1
      })

      // 系統內部訊息路由規則
      this.routingRules.set(MESSAGE_SOURCES.BACKGROUND, {
        priority: EVENT_PRIORITIES.URGENT,
        validator: 'basic',
        transformers: ['standardize'],
        timeout: TIMEOUTS.DEFAULT_MESSAGE_TIMEOUT / 4,
        retryCount: 0
      })

      this.logger.log('🔧 路由規則初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化路由規則失敗:', error)
    }
  }

  /**
   * 載入會話歷史
   * @returns {Promise<void>}
   * @private
   */
  async loadSessionHistory () {
    try {
      const stored = await chrome.storage.local.get(['messaging_sessions'])

      if (stored.messaging_sessions) {
        this.sessionHistory = stored.messaging_sessions
          .slice(-LIMITS.MAX_SESSION_HISTORY)

        this.logger.log(`📚 載入了 ${this.sessionHistory.length} 個會話歷史記錄`)
      }
    } catch (error) {
      this.logger.error('❌ 載入會話歷史失敗:', error)
    }
  }

  /**
   * 保存會話歷史
   * @returns {Promise<void>}
   * @private
   */
  async saveSessionHistory () {
    try {
      await chrome.storage.local.set({
        messaging_sessions: this.sessionHistory.slice(-LIMITS.MAX_SESSION_HISTORY)
      })

      this.logger.log(`💾 保存了 ${this.sessionHistory.length} 個會話歷史記錄`)
    } catch (error) {
      this.logger.error('❌ 保存會話歷史失敗:', error)
    }
  }

  /**
   * 註冊事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 未初始化，跳過事件監聽器註冊')
      return
    }

    try {
      // 訊息接收事件
      this.registeredListeners.set('messageReceived',
        this.eventBus.on(MESSAGE_EVENTS.RECEIVED,
          (event) => this.handleMessageReceived(event.data),
          { priority: EVENT_PRIORITIES.HIGH }
        )
      )

      // 訊息錯誤事件
      this.registeredListeners.set('messageError',
        this.eventBus.on(MESSAGE_EVENTS.ERROR,
          (event) => this.handleMessageError(event.data),
          { priority: EVENT_PRIORITIES.HIGH }
        )
      )

      // Content Script 訊息接收事件
      this.registeredListeners.set('contentMessage',
        this.eventBus.on(MESSAGE_EVENTS.CONTENT_MESSAGE_RECEIVED,
          (event) => this.handleContentScriptMessage(event.data),
          { priority: EVENT_PRIORITIES.NORMAL }
        )
      )

      // Popup 訊息接收事件
      this.registeredListeners.set('popupMessage',
        this.eventBus.on(MESSAGE_EVENTS.POPUP_MESSAGE_RECEIVED,
          (event) => this.handlePopupMessage(event.data),
          { priority: EVENT_PRIORITIES.HIGH }
        )
      )

      // 系統關閉事件
      this.registeredListeners.set('systemShutdown',
        this.eventBus.on('SYSTEM.SHUTDOWN',
          (event) => this.handleSystemShutdown(event.data),
          { priority: EVENT_PRIORITIES.URGENT }
        )
      )

      this.logger.log('📝 通訊領域事件監聽器註冊完成')
    } catch (error) {
      this.logger.error('❌ 註冊事件監聽器失敗:', error)
    }
  }

  /**
   * 取消註冊事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async unregisterEventListeners () {
    if (!this.eventBus) {
      return
    }

    try {
      const eventTypes = {
        messageReceived: MESSAGE_EVENTS.RECEIVED,
        messageError: MESSAGE_EVENTS.ERROR,
        contentMessage: MESSAGE_EVENTS.CONTENT_MESSAGE_RECEIVED,
        popupMessage: MESSAGE_EVENTS.POPUP_MESSAGE_RECEIVED,
        systemShutdown: 'SYSTEM.SHUTDOWN'
      }

      for (const [key, listenerId] of this.registeredListeners) {
        const eventType = eventTypes[key]
        if (eventType && listenerId) {
          this.eventBus.off(eventType, listenerId)
        }
      }

      this.registeredListeners.clear()
      this.logger.log('🔄 通訊領域事件監聽器取消註冊完成')
    } catch (error) {
      this.logger.error('❌ 取消註冊事件監聽器失敗:', error)
    }
  }

  /**
   * 處理訊息接收事件
   * @param {Object} data - 訊息資料
   * @returns {Promise<void>}
   * @private
   */
  async handleMessageReceived (data) {
    try {
      const { message, source, context } = data
      this.domainStats.messagingEventsProcessed++

      // 添加到處理佇列
      this.addToMessageQueue(message, source, context, 'inbound')
    } catch (error) {
      this.logger.error('❌ 處理訊息接收事件失敗:', error)
    }
  }

  /**
   * 處理 Content Script 訊息
   * @param {Object} data - 訊息資料
   * @returns {Promise<void>}
   * @private
   */
  async handleContentScriptMessage (data) {
    try {
      const { message, tabId, sender } = data
      this.domainStats.messagingEventsProcessed++

      const context = {
        source: MESSAGE_SOURCES.CONTENT_SCRIPT,
        tabId,
        sender,
        requestId: message.id || this.generateMessageId()
      }

      // 路由訊息
      const response = await this.routeMessage(message, context)

      // 記錄處理結果
      this.recordMessageProcessing(message, context, response)

      return response
    } catch (error) {
      this.logger.error('❌ 處理 Content Script 訊息失敗:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 處理 Popup 訊息
   * @param {Object} data - 訊息資料
   * @returns {Promise<void>}
   * @private
   */
  async handlePopupMessage (data) {
    try {
      const { message, sender } = data
      this.domainStats.messagingEventsProcessed++

      const context = {
        source: MESSAGE_SOURCES.POPUP,
        sender,
        sessionId: message.sessionId || this.generateSessionId(),
        requestId: message.id || this.generateMessageId()
      }

      // 路由訊息
      const response = await this.routeMessage(message, context)

      // 記錄處理結果
      this.recordMessageProcessing(message, context, response)

      return response
    } catch (error) {
      this.logger.error('❌ 處理 Popup 訊息失敗:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 路由訊息
   * @param {Object} message - 訊息
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 處理結果
   * @private
   */
  async routeMessage (message, context) {
    try {
      const startTime = Date.now()
      this.domainStats.messagesRouted++

      // 獲取路由規則
      const routingRule = this.routingRules.get(context.source) ||
                         this.routingRules.get(MESSAGE_SOURCES.UNKNOWN)

      // 驗證訊息
      const validation = await this.validateMessage(message, routingRule.validator)
      if (!validation.valid) {
        this.domainStats.validationFailures++
        return {
          success: false,
          error: 'Message validation failed',
          details: validation.errors
        }
      }

      // 轉換訊息
      let transformedMessage = message
      for (const transformerName of routingRule.transformers || []) {
        const transformer = this.messageTransformers.get(transformerName)
        if (transformer) {
          transformedMessage = transformer(transformedMessage, context)
        }
      }

      // 查找訊息處理器
      const handler = this.messageHandlers.get(transformedMessage.type) ||
                     this.messageHandlers.get('default')

      if (!handler) {
        return {
          success: false,
          error: 'No handler found for message type',
          messageType: transformedMessage.type
        }
      }

      // 執行處理器
      const response = await handler(transformedMessage, context)

      // 轉換回應
      const transformedResponse = this.messageTransformers.get('response_format')(response, context)

      // 更新指標
      this.updateCommunicationMetrics(startTime, true)

      return transformedResponse
    } catch (error) {
      this.logger.error('❌ 路由訊息失敗:', error)
      this.updateCommunicationMetrics(Date.now(), false)

      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      }
    }
  }

  /**
   * 驗證訊息
   * @param {Object} message - 訊息
   * @param {string} validatorName - 驗證器名稱
   * @returns {Promise<Object>} 驗證結果
   * @private
   */
  async validateMessage (message, validatorName) {
    try {
      const validator = this.messageValidators.get(validatorName) ||
                       this.messageValidators.get('basic')

      return validator(message)
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`]
      }
    }
  }

  /**
   * 處理 Content Script 就緒
   * @param {Object} message - 訊息
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 處理結果
   * @private
   */
  async handleContentScriptReady (message, context) {
    const { tabId } = context

    // 建立連接狀態
    this.connectionStates.set(tabId, {
      status: 'ready',
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0
    })

    // 觸發 Content Script 就緒事件
    if (this.eventBus) {
      await this.eventBus.emit('CONTENT.SCRIPT.READY', {
        tabId,
        scriptInfo: message.scriptInfo,
        timestamp: Date.now()
      })
    }

    return {
      success: true,
      message: 'Content Script registered successfully',
      timestamp: Date.now()
    }
  }

  /**
   * 處理事件轉發
   * @param {Object} message - 訊息
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 處理結果
   * @private
   */
  async handleContentEventForward (message, context) {
    try {
      // 轉發事件到 EventBus
      if (this.eventBus) {
        await this.eventBus.emit(message.eventType, {
          ...message.eventData,
          tabId: context.tabId,
          source: 'content_script'
        })
      }

      return {
        success: true,
        message: 'Event forwarded successfully'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 處理 Popup 會話開始
   * @param {Object} message - 訊息
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 處理結果
   * @private
   */
  async handlePopupSessionStart (message, context) {
    try {
      const sessionId = context.sessionId

      // 建立會話
      const session = {
        id: sessionId,
        startedAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
        status: 'active'
      }

      this.activeSessions.set(sessionId, session)
      this.domainStats.sessionsEstablished++
      this.communicationMetrics.sessionCount++

      // 觸發會話開始事件
      if (this.eventBus) {
        await this.eventBus.emit('POPUP.SESSION.STARTED', {
          sessionId,
          timestamp: Date.now()
        })
      }

      return {
        success: true,
        sessionId,
        message: 'Session established successfully'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 啟動訊息處理循環
   * @private
   */
  startMessageProcessingLoop () {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
    }

    this.processingInterval = setInterval(async () => {
      await this.processMessageQueues()
    }, 100) // 每100ms處理一次佇列

    this.logger.log('🔄 訊息處理循環已啟動')
  }

  /**
   * 停止訊息處理循環
   * @private
   */
  stopMessageProcessingLoop () {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }

    this.logger.log('🔄 訊息處理循環已停止')
  }

  /**
   * 處理訊息佇列
   * @returns {Promise<void>}
   * @private
   */
  async processMessageQueues () {
    try {
      // 處理優先級佇列
      await this.processQueue('priority')

      // 處理入站佇列
      await this.processQueue('inbound')

      // 處理出站佇列
      await this.processQueue('outbound')

      // 重試失敗佇列
      await this.retryFailedMessages()
    } catch (error) {
      this.logger.error('❌ 處理訊息佇列失敗:', error)
    }
  }

  /**
   * 處理指定佇列
   * @param {string} queueName - 佇列名稱
   * @returns {Promise<void>}
   * @private
   */
  async processQueue (queueName) {
    const queue = this.messageQueues[queueName]
    if (!queue || queue.length === 0) {
      return
    }

    const batchSize = Math.min(queue.length, 10) // 批次處理10個訊息
    const batch = queue.splice(0, batchSize)

    for (const item of batch) {
      try {
        await this.processQueuedMessage(item)
      } catch (error) {
        this.logger.error(`❌ 處理佇列訊息失敗 (${queueName}):`, error)

        // 移到失敗佇列
        this.messageQueues.failed.push({
          ...item,
          failedAt: Date.now(),
          error: error.message,
          retryCount: (item.retryCount || 0) + 1
        })
      }
    }
  }

  /**
   * 添加訊息到佇列
   * @param {Object} message - 訊息
   * @param {string} source - 來源
   * @param {Object} context - 上下文
   * @param {string} queueType - 佇列類型
   * @private
   */
  addToMessageQueue (message, source, context, queueType) {
    const queueItem = {
      message,
      source,
      context,
      queuedAt: Date.now(),
      retryCount: 0
    }

    this.messageQueues[queueType].push(queueItem)

    // 限制佇列大小
    if (this.messageQueues[queueType].length > LIMITS.MAX_QUEUE_SIZE) {
      this.messageQueues[queueType].shift() // 移除最舊的訊息
    }
  }

  /**
   * 更新通訊指標
   * @param {number} startTime - 開始時間
   * @param {boolean} success - 是否成功
   * @private
   */
  updateCommunicationMetrics (startTime, success) {
    this.communicationMetrics.totalMessages++

    if (success) {
      this.communicationMetrics.successfulMessages++
    } else {
      this.communicationMetrics.failedMessages++
    }

    // 更新平均回應時間
    const responseTime = Date.now() - startTime
    this.communicationMetrics.averageResponseTime =
      (this.communicationMetrics.averageResponseTime * (this.communicationMetrics.totalMessages - 1) + responseTime) /
      this.communicationMetrics.totalMessages
  }

  /**
   * 更新連接狀態
   * @param {number} tabId - 標籤頁 ID
   * @param {string} status - 狀態
   * @param {string} source - 來源
   * @private
   */
  updateConnectionState (tabId, status, source) {
    let connectionState = this.connectionStates.get(tabId)

    if (!connectionState) {
      connectionState = {
        status: 'unknown',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0
      }
      this.connectionStates.set(tabId, connectionState)
    }

    connectionState.status = status
    connectionState.lastActivity = Date.now()
    connectionState.messageCount++
  }

  /**
   * 生成訊息 ID
   * @returns {string} 訊息 ID
   * @private
   */
  generateMessageId () {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 生成會話 ID
   * @returns {string} 會話 ID
   * @private
   */
  generateSessionId () {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 結束所有活動會話
   * @returns {Promise<void>}
   * @private
   */
  async terminateAllSessions () {
    for (const [sessionId, session] of this.activeSessions) {
      try {
        session.status = 'terminated'
        session.terminatedAt = Date.now()

        // 移到歷史記錄
        this.sessionHistory.push({ ...session })

        // 觸發會話結束事件
        if (this.eventBus) {
          await this.eventBus.emit('POPUP.SESSION.ENDED', {
            sessionId,
            reason: 'system_shutdown',
            timestamp: Date.now()
          })
        }
      } catch (error) {
        this.logger.error(`❌ 結束會話失敗: ${sessionId}`, error)
      }
    }

    this.activeSessions.clear()
    this.logger.log('✅ 所有活動會話已結束')
  }

  /**
   * 獲取通訊指標
   * @returns {Object} 通訊指標
   */
  getCommunicationMetrics () {
    return {
      ...this.communicationMetrics,
      activeConnections: this.connectionStates.size,
      activeSessions: this.activeSessions.size,
      queueSizes: {
        inbound: this.messageQueues.inbound.length,
        outbound: this.messageQueues.outbound.length,
        priority: this.messageQueues.priority.length,
        failed: this.messageQueues.failed.length
      }
    }
  }

  /**
   * 獲取會話狀態
   * @param {string} sessionId - 會話 ID (可選)
   * @returns {Object} 會話狀態
   */
  getSessionState (sessionId = null) {
    if (sessionId) {
      return this.activeSessions.get(sessionId) || null
    }

    return {
      activeSessions: Array.from(this.activeSessions.values()),
      sessionHistory: this.sessionHistory.slice(-10),
      connectionStates: Array.from(this.connectionStates.entries())
    }
  }

  /**
   * 獲取統計資料
   * @returns {Object} 統計資料
   */
  getStats () {
    return {
      ...this.domainStats,
      communicationMetrics: this.getCommunicationMetrics(),
      activeSessionsCount: this.activeSessions.size,
      connectionStatesCount: this.connectionStates.size
    }
  }
}

module.exports = MessagingDomainHandler
