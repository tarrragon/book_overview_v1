/**
 * Chrome Extension 訊息路由器
 *
 * 負責功能：
 * - 統一處理來自 Content Script 和 Popup 的訊息
 * - 提供訊息路由和分發機制
 * - 實現訊息格式標準化和驗證
 * - 管理跨上下文通訊狀態和連接
 *
 * 設計考量：
 * - 基於 BaseModule 實現標準生命週期管理
 * - 支援訊息類型的可擴展路由規則
 * - 實現訊息處理的錯誤隔離和恢復
 * - 提供完整的訊息追蹤和統計功能
 */

const BaseModule = require('src/background/lifecycle/base-module')

class MessageRouter extends BaseModule {
  constructor (dependencies = {}) {
    super(dependencies)

    // 訊息處理器
    this.contentMessageHandler = dependencies.contentMessageHandler || null
    this.popupMessageHandler = dependencies.popupMessageHandler || null
    this.chromeApiWrapper = dependencies.chromeApiWrapper || null

    // 路由狀態
    this.isAcceptingMessages = true
    this.messageStats = {
      total: 0,
      success: 0,
      failed: 0,
      byType: new Map(),
      bySource: new Map()
    }

    // 訊息處理佇列
    this.messageQueue = []
    this.processingMessage = false
    this.maxQueueSize = 100

    // Chrome API 監聽器
    this.chromeMessageListener = null
  }

  /**
   * 初始化訊息路由器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    this.logger.log('📨 初始化訊息路由器')

    // 初始化訊息處理器
    const handlers = [
      this.contentMessageHandler,
      this.popupMessageHandler,
      this.chromeApiWrapper
    ]

    for (const handler of handlers) {
      if (handler && typeof handler.initialize === 'function') {
        try {
          await handler.initialize()
        } catch (error) {
          this.logger.error(`❌ 訊息處理器初始化失敗: ${handler.constructor?.name}`, error)
        }
      }
    }

    // 設定訊息監聽器
    await this.setupMessageListener()

    this.logger.log('✅ 訊息路由器初始化完成')
  }

  /**
   * 啟動訊息路由器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStart () {
    this.logger.log('▶️ 啟動訊息路由器')

    // 開始接受訊息
    this.isAcceptingMessages = true

    // 啟動訊息處理器
    const handlers = [
      this.contentMessageHandler,
      this.popupMessageHandler,
      this.chromeApiWrapper
    ]

    for (const handler of handlers) {
      if (handler && typeof handler.start === 'function') {
        try {
          await handler.start()
        } catch (error) {
          this.logger.error(`❌ 訊息處理器啟動失敗: ${handler.constructor?.name}`, error)
        }
      }
    }

    // 處理積壓的訊息
    await this.processQueuedMessages()

    this.logger.log('✅ 訊息路由器啟動完成')
  }

  /**
   * 停止訊息路由器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStop () {
    this.logger.log('⏹️ 停止訊息路由器')

    // 停止接受新訊息
    await this.stopAcceptingMessages()

    // 完成正在處理的訊息
    await this.finishPendingOperations()

    // 停止訊息處理器
    const handlers = [
      this.contentMessageHandler,
      this.popupMessageHandler,
      this.chromeApiWrapper
    ]

    for (const handler of handlers) {
      if (handler && typeof handler.stop === 'function') {
        try {
          await handler.stop()
        } catch (error) {
          this.logger.error(`❌ 訊息處理器停止失敗: ${handler.constructor?.name}`, error)
        }
      }
    }

    this.logger.log('✅ 訊息路由器停止完成')
  }

  /**
   * 設定 Chrome Extension 訊息監聽器
   * @returns {Promise<void>}
   * @private
   */
  async setupMessageListener () {
    try {
      this.logger.log('🎧 設定 Chrome Extension 訊息監聽器')

      // Manifest V3 關鍵修正：chrome.runtime.onMessage listener 必須同步回傳 true
      // 以保持訊息通道開啟，讓 async handler 可以稍後呼叫 sendResponse。
      // async function 回傳 Promise（非 true），Chrome API 不會將 Promise 視為 true，
      // 導致訊息通道在 async 處理完成前就被關閉，sendResponse 失效。
      this.chromeMessageListener = (message, sender, sendResponse) => {
        this._handleMessageAsync(message, sender, sendResponse)
        // 同步回傳 true，告知 Chrome 保持訊息通道開啟等待非同步回應
        return true
      }

      // 註冊監聽器
      chrome.runtime.onMessage.addListener(this.chromeMessageListener)

      this.logger.log('✅ Chrome Extension 訊息監聽器註冊完成')
    } catch (error) {
      this.logger.error('❌ 設定訊息監聽器失敗:', error)
      throw error
    }
  }

  /**
   * 非同步訊息處理器（由同步 listener 呼叫）
   *
   * 設計意圖：chrome.runtime.onMessage 的 listener 必須同步回傳 true
   * 才能保持訊息通道開啟。此方法封裝原本的 async 處理邏輯，
   * 由同步的 chromeMessageListener 呼叫後，獨立完成非同步處理和回應。
   *
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @private
   */
  async _handleMessageAsync (message, sender, sendResponse) {
    try {
      // 檢查是否接受訊息
      if (!this.isAcceptingMessages) {
        sendResponse({
          success: false,
          error: '系統正在關閉，不接受新訊息'
        })
        return
      }

      // 記錄訊息統計
      this.updateMessageStats(message, sender)

      this.logger.log('📨 收到訊息:', {
        type: message.type,
        from: this.getMessageSource(sender),
        tabId: sender.tab?.id
      })

      // 路由訊息到適當的處理器
      await this.routeMessage(message, sender, sendResponse)

      // 更新成功統計
      this.messageStats.success++
    } catch (error) {
      this.logger.error('❌ 訊息處理錯誤:', error)

      // 更新失敗統計
      this.messageStats.failed++

      // 發送錯誤回應
      sendResponse({
        success: false,
        error: error.message,
        timestamp: Date.now()
      })

      // 觸發訊息錯誤事件
      if (this.eventBus) {
        await this.eventBus.emit('MESSAGE.ERROR', {
          error: error.message,
          messageType: message?.type,
          source: this.getMessageSource(sender),
          timestamp: Date.now()
        })
      }
    }
  }

  /**
   * 路由訊息到適當的處理器
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>} 是否需要保持連接開啟
   * @private
   */
  async routeMessage (message, sender, sendResponse) {
    const messageType = message.type
    const source = this.getMessageSource(sender)

    try {
      // 基本訊息類型處理
      switch (messageType) {
        case 'PING':
          return await this.handlePingMessage(message, sender, sendResponse)

        case 'HEALTH_CHECK':
          return await this.handleHealthCheckMessage(message, sender, sendResponse)

        case 'EVENT_SYSTEM_STATUS_CHECK':
          return await this.handleEventSystemStatusMessage(message, sender, sendResponse)

        case 'GET_STATUS':
          return await this.handleGetStatusMessage(message, sender, sendResponse)

        case 'EVENT.EMIT':
          return await this.handleEventEmitMessage(message, sender, sendResponse)

        case 'EVENT.STATS':
          return await this.handleEventStatsMessage(message, sender, sendResponse)

        default:
          // 根據來源路由到特定處理器
          return await this.routeBySource(message, sender, sendResponse, source)
      }
    } catch (error) {
      this.logger.error(`❌ 訊息路由失敗: ${messageType}`, error)
      sendResponse({
        success: false,
        error: error.message,
        messageType,
        timestamp: Date.now()
      })
      return false
    }
  }

  /**
   * 根據來源路由訊息
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @param {string} source - 訊息來源
   * @returns {Promise<boolean>}
   * @private
   */
  async routeBySource (message, sender, sendResponse, source) {
    switch (source) {
      case 'content-script':
        if (this.contentMessageHandler) {
          return await this.contentMessageHandler.handleMessage(message, sender, sendResponse)
        }
        break

      case 'popup':
        if (this.popupMessageHandler) {
          return await this.popupMessageHandler.handleMessage(message, sender, sendResponse)
        }
        break

      case 'background':
        // 內部訊息，可能來自其他模組
        return await this.handleInternalMessage(message, sender, sendResponse)

      default:
        this.logger.warn(`⚠️ 未知的訊息來源: ${source}`)
        sendResponse({
          success: false,
          error: `未知的訊息來源: ${source}`,
          timestamp: Date.now()
        })
        return false
    }

    // 如果沒有適當的處理器
    this.logger.warn(`⚠️ 沒有處理器處理訊息類型: ${message.type}`)
    sendResponse({
      success: false,
      error: `沒有處理器處理訊息類型: ${message.type}`,
      timestamp: Date.now()
    })
    return false
  }

  /**
   * 處理 PING 訊息
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handlePingMessage (message, sender, sendResponse) {
    sendResponse({
      success: true,
      message: 'Background Service Worker 運作正常',
      eventSystem: {
        eventBus: !!this.eventBus,
        messageRouter: true
      },
      timestamp: Date.now()
    })
    return false
  }

  /**
   * 處理健康檢查訊息
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handleHealthCheckMessage (message, sender, sendResponse) {
    const healthStatus = this.getHealthStatus()

    sendResponse({
      success: true,
      message: 'Background Service Worker 健康狀態正常',
      uptime: Date.now() - (globalThis.backgroundStartTime || Date.now()),
      messageRouter: healthStatus,
      eventSystem: {
        initialized: !!this.eventBus,
        eventBus: !!this.eventBus
      },
      timestamp: Date.now()
    })
    return false
  }

  /**
   * 處理事件系統狀態檢查訊息
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handleEventSystemStatusMessage (message, sender, sendResponse) {
    sendResponse({
      success: true,
      eventSystem: {
        initialized: !!this.eventBus,
        eventBusStatus: this.eventBus ? 'active' : 'inactive',
        messageRouterStatus: this.isAcceptingMessages ? 'active' : 'inactive',
        messageStats: { ...this.messageStats },
        lastActivity: Date.now()
      },
      timestamp: Date.now()
    })
    return false
  }

  /**
   * 處理獲取狀態訊息
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handleGetStatusMessage (message, sender, sendResponse) {
    try {
      const result = await chrome.storage.local.get(['isEnabled'])

      sendResponse({
        success: true,
        isEnabled: result.isEnabled ?? true,
        serviceWorkerActive: true,
        messageRouter: {
          isAcceptingMessages: this.isAcceptingMessages,
          stats: { ...this.messageStats }
        },
        timestamp: Date.now()
      })

      return false
    } catch (error) {
      this.logger.error('❌ 獲取狀態失敗:', error)
      sendResponse({
        success: false,
        error: error.message,
        timestamp: Date.now()
      })
      return false
    }
  }

  /**
   * 處理事件觸發訊息
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handleEventEmitMessage (message, sender, sendResponse) {
    if (!message.eventType || !this.eventBus) {
      sendResponse({
        success: false,
        error: '事件類型或事件系統缺失',
        timestamp: Date.now()
      })
      return false
    }

    try {
      const result = await this.eventBus.emit(message.eventType, message.data || {})

      sendResponse({
        success: true,
        result,
        timestamp: Date.now()
      })

      return false
    } catch (error) {
      this.logger.error('❌ 事件觸發失敗:', error)
      sendResponse({
        success: false,
        error: error.message,
        timestamp: Date.now()
      })
      return false
    }
  }

  /**
   * 處理事件統計訊息
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handleEventStatsMessage (message, sender, sendResponse) {
    if (!this.eventBus) {
      sendResponse({
        success: false,
        error: '事件系統未初始化',
        timestamp: Date.now()
      })
      return false
    }

    const stats = typeof this.eventBus.getStats === 'function'
      ? this.eventBus.getStats()
      : null

    sendResponse({
      success: true,
      stats,
      timestamp: Date.now()
    })
    return false
  }

  /**
   * 處理內部訊息
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handleInternalMessage (message, sender, sendResponse) {
    this.logger.log('🔄 處理內部訊息:', message.type)

    // 內部訊息可以直接回應成功
    sendResponse({
      success: true,
      message: '內部訊息已接收',
      timestamp: Date.now()
    })

    return false
  }

  /**
   * 停止接受新訊息
   * @returns {Promise<void>}
   */
  async stopAcceptingMessages () {
    this.logger.log('🚫 停止接受新訊息')
    this.isAcceptingMessages = false

    // 觸發停止接受訊息事件
    if (this.eventBus) {
      await this.eventBus.emit('MESSAGE.ROUTER.STOP.ACCEPTING', {
        timestamp: Date.now()
      })
    }
  }

  /**
   * 完成正在進行的操作
   * @returns {Promise<void>}
   */
  async finishPendingOperations () {
    this.logger.log('⏳ 等待正在處理的訊息完成')

    // 等待當前訊息處理完成
    let attempts = 0
    const maxAttempts = 50 // 5秒超時

    while (this.processingMessage && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }

    if (this.processingMessage) {
      this.logger.warn('⚠️ 訊息處理超時')
    } else {
      this.logger.log('✅ 正在處理的訊息已完成')
    }
  }

  /**
   * 處理佇列中的訊息
   * @returns {Promise<void>}
   * @private
   */
  async processQueuedMessages () {
    if (this.messageQueue.length === 0) {
      return
    }

    this.logger.log(`📋 處理佇列中的 ${this.messageQueue.length} 個訊息`)

    while (this.messageQueue.length > 0 && this.isAcceptingMessages) {
      const queuedMessage = this.messageQueue.shift()

      try {
        await this.routeMessage(
          queuedMessage.message,
          queuedMessage.sender,
          queuedMessage.sendResponse
        )
      } catch (error) {
        this.logger.error('❌ 處理佇列訊息失敗:', error)
      }
    }

    this.logger.log('✅ 佇列訊息處理完成')
  }

  /**
   * 更新訊息統計
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @private
   */
  updateMessageStats (message, sender) {
    this.messageStats.total++

    // 按類型統計
    const messageType = message.type || 'unknown'
    if (!this.messageStats.byType.has(messageType)) {
      this.messageStats.byType.set(messageType, 0)
    }
    this.messageStats.byType.set(messageType, this.messageStats.byType.get(messageType) + 1)

    // 按來源統計
    const source = this.getMessageSource(sender)
    if (!this.messageStats.bySource.has(source)) {
      this.messageStats.bySource.set(source, 0)
    }
    this.messageStats.bySource.set(source, this.messageStats.bySource.get(source) + 1)
  }

  /**
   * 取得訊息來源
   * @param {Object} sender - 發送者資訊
   * @returns {string} 訊息來源
   * @private
   */
  getMessageSource (sender) {
    if (sender.tab) {
      return 'content-script'
    } else if (sender.url && sender.url.includes('popup.html')) {
      return 'popup'
    } else if (!sender.tab && !sender.url) {
      return 'background'
    } else {
      return 'unknown'
    }
  }

  /**
   * 取得訊息路由狀態
   * @returns {Object} 訊息路由狀態報告
   */
  getMessageRouterStatus () {
    return {
      isAcceptingMessages: this.isAcceptingMessages,
      stats: {
        ...this.messageStats,
        byType: Object.fromEntries(this.messageStats.byType),
        bySource: Object.fromEntries(this.messageStats.bySource)
      },
      queueSize: this.messageQueue.length,
      processingMessage: this.processingMessage,
      timestamp: Date.now()
    }
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    const errorRate = this.messageStats.total > 0
      ? this.messageStats.failed / this.messageStats.total
      : 0

    return {
      isAcceptingMessages: this.isAcceptingMessages,
      messageStats: { ...this.messageStats },
      queueSize: this.messageQueue.length,
      errorRate,
      hasHandlers: !!(this.contentMessageHandler || this.popupMessageHandler),
      health: errorRate > 0.1 ? 'degraded' : 'healthy'
    }
  }
}

module.exports = MessageRouter
