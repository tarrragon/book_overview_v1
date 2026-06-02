/**
 * 訊息路由服務
 *
 * 負責功能：
 * - 管理訊息的路由和分發邏輯
 * - 處理不同來源的訊息類型識別
 * - 協調訊息處理器的註冊和執行
 * - 實現訊息轉換和格式標準化
 *
 * 設計考量：
 * - 支援多種訊息來源和目標
 * - 可插拔的訊息處理器架構
 * - 統一的訊息格式和驗證
 * - 高效能的路由演算法
 *
 * 使用情境：
 * - Content Script 與 Background 通訊
 * - Popup 與 Background 通訊
 * - 內部模組間事件路由
 */

const {
  MESSAGE_TYPES,
  MESSAGE_SOURCES,
  EVENT_PRIORITIES,
  TIMEOUTS
} = require('src/background/constants/module-constants')
const ErrorCodes = require('src/core/errors/ErrorCodes')

class MessageRoutingService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null

    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: 訊息路由服務是整個通訊系統的核心樞紐
    // 執行環境: Service Worker 持續運作，處理所有跨環境通訊
    // 後備機制: console 確保路由錯誤和通訊失敗能被追蹤
    // 重要性: 路由失敗會導致整個擴展通訊中斷，必須有可靠記錄
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false
    }

    // 路由管理
    this.messageHandlers = new Map()
    this.messageTransformers = new Map()
    this.routingRules = new Map()
    this.registeredListeners = new Map()

    // 服務依賴
    this.validationService = null
    this.queueService = null
    this.sessionService = null
    this.connectionService = null

    // 統計資料
    this.stats = {
      messagesRouted: 0,
      routingErrors: 0,
      transformationsApplied: 0,
      handlersExecuted: 0,
      averageRouteTime: 0
    }
  }

  /**
   * 初始化路由服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('[WARN] 訊息路由服務已初始化')
      return
    }

    try {
      this.logger.log('初始化訊息路由服務')

      // 初始化訊息處理器
      await this.initializeMessageHandlers()

      // 初始化訊息轉換器
      await this.initializeMessageTransformers()

      // 初始化路由規則
      await this.initializeRoutingRules()

      this.state.initialized = true
      this.logger.log('[OK] 訊息路由服務初始化完成')
    } catch (error) {
      this.logger.error('[FAIL] 初始化訊息路由服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動路由服務
   */
  async start () {
    if (!this.state.initialized) {
      const error = new Error('路由服務尚未初始化')
      error.code = ErrorCodes.CONFIG_ERROR
      error.details = { category: 'general' }
      throw error
    }

    if (this.state.active) {
      this.logger.warn('[WARN] 訊息路由服務已啟動')
      return
    }

    try {
      this.logger.log('[START] 啟動訊息路由服務')

      // 註冊事件監聽器
      await this.registerEventListeners()

      this.state.active = true
      this.logger.log('[OK] 訊息路由服務啟動完成')
    } catch (error) {
      this.logger.error('[FAIL] 啟動訊息路由服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止路由服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('[WARN] 訊息路由服務未啟動')
      return
    }

    try {
      this.logger.log('[STOP] 停止訊息路由服務')

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.logger.log('[OK] 訊息路由服務停止完成')
    } catch (error) {
      this.logger.error('[FAIL] 停止訊息路由服務失敗:', error)
      throw error
    }
  }

  /**
   * 初始化訊息處理器
   */
  async initializeMessageHandlers () {
    try {
      // Content Script 訊息處理器
      this.messageHandlers.set(MESSAGE_TYPES.CONTENT_TO_BACKGROUND, async (message, context) => {
        const { tabId, source } = context

        this.logger.log(`處理 Content Script 訊息: ${message.type || 'unknown'} (Tab ${tabId})`)

        // 更新連接狀態
        if (this.connectionService) {
          this.connectionService.updateConnectionState(tabId, 'active', source)
        }

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
        const { sessionId } = context

        this.logger.log(`處理 Popup 訊息: ${message.type || 'unknown'} (Session ${sessionId})`)

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
          service: 'MessageRoutingService'
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

      this.logger.log(`[FIX] 初始化了 ${this.messageHandlers.size} 個訊息處理器`)
    } catch (error) {
      this.logger.error('[FAIL] 初始化訊息處理器失敗:', error)
      throw error
    }
  }

  /**
   * 初始化訊息轉換器
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

      this.logger.log(`[FIX] 初始化了 ${this.messageTransformers.size} 個訊息轉換器`)
    } catch (error) {
      this.logger.error('[FAIL] 初始化訊息轉換器失敗:', error)
      throw error
    }
  }

  /**
   * 初始化路由規則
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

      this.logger.log(`[FIX] 初始化了 ${this.routingRules.size} 個路由規則`)
    } catch (error) {
      this.logger.error('[FAIL] 初始化路由規則失敗:', error)
      throw error
    }
  }

  /**
   * 路由訊息
   */
  async routeMessage (message, context) {
    const startTime = Date.now()
    this.stats.messagesRouted++

    try {
      // 獲取路由規則
      const routingRule = this.routingRules.get(context.source) ||
                         this.routingRules.get(MESSAGE_SOURCES.UNKNOWN)

      // 驗證訊息
      if (this.validationService) {
        const validation = await this.validationService.validateMessage(message, routingRule.validator)
        if (!validation.valid) {
          this.stats.routingErrors++
          return {
            success: false,
            error: 'Message validation failed',
            details: validation.errors
          }
        }
      }

      // 轉換訊息
      let transformedMessage = message
      for (const transformerName of routingRule.transformers || []) {
        const transformer = this.messageTransformers.get(transformerName)
        if (transformer) {
          transformedMessage = transformer(transformedMessage, context)
          this.stats.transformationsApplied++
        }
      }

      // 查找訊息處理器
      const handler = this.messageHandlers.get(transformedMessage.type) ||
                     this.messageHandlers.get('default')

      if (!handler) {
        this.stats.routingErrors++
        return {
          success: false,
          error: 'No handler found for message type',
          messageType: transformedMessage.type
        }
      }

      // 執行處理器
      const response = await handler(transformedMessage, context)
      this.stats.handlersExecuted++

      // 轉換回應
      const transformedResponse = this.messageTransformers.get('response_format')(response, context)

      // 更新指標
      this.updateRouteTimeMetrics(startTime)

      return transformedResponse
    } catch (error) {
      this.logger.error('[FAIL] 路由訊息失敗:', error)
      this.stats.routingErrors++

      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      }
    }
  }

  /**
   * 處理訊息
   */
  async handleMessage (data) {
    const { message, source, context } = data

    // 添加到處理佇列如果有佇列服務
    if (this.queueService) {
      await this.queueService.addToQueue(message, source, context, 'inbound')
    } else {
      // 直接路由
      return await this.routeMessage(message, { ...context, source })
    }
  }

  /**
   * 處理 Content Script 訊息
   */
  async handleContentMessage (data) {
    const { message, tabId, sender } = data

    const context = {
      source: MESSAGE_SOURCES.CONTENT_SCRIPT,
      tabId,
      sender,
      requestId: message.id || this.generateMessageId()
    }

    return await this.routeMessage(message, context)
  }

  /**
   * 處理 Popup 訊息
   */
  async handlePopupMessage (data) {
    const { message, sender } = data

    const context = {
      source: MESSAGE_SOURCES.POPUP,
      sender,
      sessionId: message.sessionId || this.generateSessionId(),
      requestId: message.id || this.generateMessageId()
    }

    return await this.routeMessage(message, context)
  }

  /**
   * 處理 Content Script 就緒
   */
  async handleContentScriptReady (message, context) {
    const { tabId } = context

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
   */
  async handlePopupSessionStart (message, context) {
    try {
      if (this.sessionService) {
        const sessionResult = await this.sessionService.startSession(context.sessionId, context)
        return sessionResult
      }

      return {
        success: true,
        sessionId: context.sessionId,
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
   * 處理狀態更新
   */
  async handleContentStatusUpdate (message, context) {
    // 更新連接狀態
    if (this.connectionService) {
      this.connectionService.updateConnectionState(
        context.tabId,
        message.status,
        context.source
      )
    }

    return {
      success: true,
      message: 'Status updated successfully'
    }
  }

  /**
   * 處理 Content Script 錯誤
   */
  async handleContentScriptError (message, context) {
    this.logger.error(`Content Script 錯誤 (Tab ${context.tabId}):`, message.error)

    // 觸發錯誤事件
    if (this.eventBus) {
      await this.eventBus.emit('CONTENT.SCRIPT.ERROR', {
        tabId: context.tabId,
        error: message.error,
        timestamp: Date.now()
      })
    }

    return {
      success: true,
      message: 'Error reported successfully'
    }
  }

  /**
   * 處理通用訊息
   */
  async handleGenericContentMessage (message, context) {
    this.logger.log(`處理通用 Content Script 訊息: ${message.type}`)

    return {
      success: true,
      message: 'Generic message processed',
      type: message.type
    }
  }

  /**
   * 處理通用 Popup 訊息
   */
  async handleGenericPopupMessage (message, context) {
    this.logger.log(`處理通用 Popup 訊息: ${message.type}`)

    return {
      success: true,
      message: 'Generic popup message processed',
      type: message.type
    }
  }

  /**
   * 處理狀態請求
   */
  async handlePopupStatusRequest (message, context) {
    return {
      success: true,
      status: this.getStatus(),
      timestamp: Date.now()
    }
  }

  /**
   * 處理資料請求
   */
  async handlePopupDataRequest (message, context) {
    // 這裡應該委託給資料服務處理
    return {
      success: true,
      message: 'Data request handled',
      requestType: message.requestType
    }
  }

  /**
   * 處理操作請求
   */
  async handlePopupOperationRequest (message, context) {
    // 這裡應該委託給操作服務處理
    return {
      success: true,
      message: 'Operation request handled',
      operation: message.operation
    }
  }

  /**
   * 處理會話結束
   */
  async handlePopupSessionEnd (message, context) {
    if (this.sessionService) {
      await this.sessionService.endSession(context.sessionId)
    }

    return {
      success: true,
      message: 'Session ended successfully'
    }
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    // 路由服務通常不直接監聽事件，而是被其他服務調用
    this.logger.log('[OK] 訊息路由服務事件監聽器註冊完成')
  }

  /**
   * 取消註冊事件監聽器
   */
  async unregisterEventListeners () {
    this.registeredListeners.clear()
    this.logger.log('[OK] 訊息路由服務事件監聽器已取消註冊')
  }

  /**
   * 設定依賴服務
   */
  setValidationService (service) {
    this.validationService = service
  }

  setQueueService (service) {
    this.queueService = service
  }

  setSessionService (service) {
    this.sessionService = service
  }

  setConnectionService (service) {
    this.connectionService = service
  }

  /**
   * 更新路由時間指標
   */
  updateRouteTimeMetrics (startTime) {
    const routeTime = Date.now() - startTime
    const totalMessages = this.stats.messagesRouted

    this.stats.averageRouteTime =
      (this.stats.averageRouteTime * (totalMessages - 1) + routeTime) / totalMessages
  }

  /**
   * 生成訊息 ID
   */
  generateMessageId () {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 生成會話 ID
   */
  generateSessionId () {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      stats: { ...this.stats },
      handlers: this.messageHandlers.size,
      transformers: this.messageTransformers.size,
      rules: this.routingRules.size
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const isHealthy = this.state.initialized &&
                     this.state.active &&
                     this.messageHandlers.size > 0

    return {
      service: 'MessageRoutingService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      metrics: {
        messagesRouted: this.stats.messagesRouted,
        routingErrors: this.stats.routingErrors,
        successRate: this.stats.messagesRouted > 0
          ? (1 - this.stats.routingErrors / this.stats.messagesRouted) * 100
          : 100
      }
    }
  }

  /**
   * 獲取路由指標
   */
  getMetrics () {
    return {
      ...this.stats,
      successRate: this.stats.messagesRouted > 0
        ? (1 - this.stats.routingErrors / this.stats.messagesRouted) * 100
        : 100
    }
  }
}

module.exports = MessageRoutingService
