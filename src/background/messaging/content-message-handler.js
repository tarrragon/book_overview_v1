/**
 * Content Script 訊息處理器
 *
 * 負責功能：
 * - 處理來自 Content Script 的所有訊息類型
 * - 實現與 Content Script 的雙向通訊
 * - 管理 Content Script 的狀態和連接
 * - 提供事件轉發和資料同步功能
 *
 * 設計考量：
 * - 基於 BaseModule 實現標準生命週期管理
 * - 支援多標籤頁的 Content Script 管理
 * - 實現訊息的優先級和批次處理
 * - 提供 Content Script 健康狀態監控
 */

const BaseModule = require('src/background/lifecycle/base-module')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class ContentMessageHandler extends BaseModule {
  constructor (dependencies = {}) {
    super(dependencies)

    // Content Script 管理
    this.activeContentScripts = new Map() // tabId -> scriptInfo
    this.messageQueue = []
    this.processingQueue = false

    // 訊息統計
    this.contentStats = {
      total: 0,
      success: 0,
      failed: 0,
      eventForwards: 0,
      activeScripts: 0,
      byMessageType: new Map()
    }

    // 支援的訊息類型
    this.supportedMessageTypes = new Set([
      'CONTENT.TO.BACKGROUND',
      'CONTENT.EVENT.FORWARD',
      'CONTENT.STATUS.UPDATE',
      'CONTENT.STATUS.READY',
      'CONTENT.SCRIPT.READY',
      'CONTENT.SCRIPT.ERROR'
    ])
  }

  /**
   * 初始化 Content Script 訊息處理器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    this.logger.log('初始化 Content Script 訊息處理器')

    // 清理可能存在的舊連接
    this.activeContentScripts.clear()

    // 重置統計
    this.resetStats()

    this.logger.log('[OK] Content Script 訊息處理器初始化完成')
  }

  /**
   * 啟動 Content Script 訊息處理器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStart () {
    this.logger.log('[START] 啟動 Content Script 訊息處理器')

    // 開始處理佇列中的訊息
    await this.processMessageQueue()

    // 觸發處理器啟動事件
    if (this.eventBus) {
      await this.eventBus.emit('CONTENT.HANDLER.STARTED', {
        timestamp: Date.now()
      })
    }

    this.logger.log('[OK] Content Script 訊息處理器啟動完成')
  }

  /**
   * 停止 Content Script 訊息處理器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStop () {
    this.logger.log('[STOP] 停止 Content Script 訊息處理器')

    // 等待佇列處理完成
    await this.waitForQueueCompletion()

    // 通知所有 Content Script 系統即將關閉
    await this.notifyContentScriptsShutdown()

    // 清理連接
    this.activeContentScripts.clear()

    this.logger.log('[OK] Content Script 訊息處理器停止完成')
  }

  /**
   * 處理來自 Content Script 的訊息
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>} 是否需要保持連接開啟
   */
  async handleMessage (message, sender, sendResponse) {
    try {
      this.logger.log('處理 Content Script 訊息:', {
        type: message.type,
        tabId: sender.tab?.id,
        url: sender.tab?.url
      })

      // 驗證訊息格式
      if (!this.validateMessage(message, sender)) {
        const error = new Error(`無效的訊息格式或類型: ${message?.type || 'unknown'}`)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = { category: 'general', messageType: message?.type || 'unknown' }
        throw error
      }

      // 更新統計
      this.updateContentStats(message, sender)

      // 更新 Content Script 狀態
      this.updateContentScriptStatus(sender)

      // 根據訊息類型處理
      const result = await this.routeContentMessage(message, sender, sendResponse)

      // 更新成功統計
      this.contentStats.success++

      return result
    } catch (error) {
      this.logger.error('[FAIL] Content Script 訊息處理失敗:', error)

      // 更新失敗統計
      this.contentStats.failed++

      // 發送錯誤回應
      sendResponse({
        success: false,
        error: error.message,
        timestamp: Date.now()
      })

      // 觸發錯誤事件
      if (this.eventBus) {
        await this.eventBus.emit('CONTENT.MESSAGE.ERROR', {
          error: error.message,
          messageType: message?.type,
          tabId: sender.tab?.id,
          timestamp: Date.now()
        })
      }

      return false
    }
  }

  /**
   * 驗證訊息格式
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @returns {boolean} 是否有效
   * @private
   */
  validateMessage (message, sender) {
    // 基本格式檢查
    if (!message || typeof message !== 'object') {
      return false
    }

    // 訊息類型檢查
    if (!message.type || !this.supportedMessageTypes.has(message.type)) {
      return false
    }

    // 發送者檢查（必須來自標籤頁）
    if (!sender.tab || !sender.tab.id) {
      return false
    }

    return true
  }

  /**
   * 路由 Content Script 訊息
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async routeContentMessage (message, sender, sendResponse) {
    switch (message.type) {
      case 'CONTENT.TO.BACKGROUND':
        return await this.handleContentToBackgroundMessage(message, sender, sendResponse)

      case 'CONTENT.EVENT.FORWARD':
        return await this.handleContentEventForward(message, sender, sendResponse)

      case 'CONTENT.STATUS.UPDATE':
        return await this.handleContentStatusUpdate(message, sender, sendResponse)

      case 'CONTENT.STATUS.READY':
      case 'CONTENT.SCRIPT.READY':
        return await this.handleContentScriptReady(message, sender, sendResponse)

      case 'CONTENT.SCRIPT.ERROR':
        return await this.handleContentScriptError(message, sender, sendResponse)

      default: {
        const error = new Error(`未支援的訊息類型: ${message.type}`)
        error.code = ErrorCodes.UNSUPPORTED_OPERATION
        error.details = { category: 'general', messageType: message.type }
        throw error
      }
    }
  }

  /**
   * 處理 Content Script 到 Background 的一般訊息
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handleContentToBackgroundMessage (message, sender, sendResponse) {
    this.logger.log('處理 Content Script 一般訊息:', message.data)

    // 觸發內部事件
    if (this.eventBus) {
      await this.eventBus.emit('CONTENT.MESSAGE.RECEIVED', {
        data: message.data,
        tabId: sender.tab?.id,
        url: sender.tab?.url,
        timestamp: Date.now()
      })
    }

    sendResponse({
      success: true,
      message: '訊息已處理',
      timestamp: Date.now()
    })

    return false
  }

  /**
   * 處理 Content Script 事件轉發
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handleContentEventForward (message, sender, sendResponse) {
    this.logger.log('處理 Content Script 事件轉發:', message.eventType, message.data)

    // 驗證事件轉發格式
    if (!message.eventType) {
      const error = new Error('事件類型不能為空')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'general', field: 'eventType' }
      throw error
    }

    // 更新事件轉發統計
    this.contentStats.eventForwards++

    // 增強事件資料，加入 Content Script 來源資訊
    const enhancedEventData = {
      ...message.data,
      source: {
        type: 'content-script',
        tabId: sender.tab?.id,
        url: sender.tab?.url,
        frameId: sender.frameId,
        originalTimestamp: message.timestamp || Date.now()
      },
      forwardedAt: Date.now()
    }

    // 特殊處理：EXTRACTION.COMPLETED 事件需要確保核心監聽器存在
    if (message.eventType === 'EXTRACTION.COMPLETED') {
      await this.ensureExtractionHandlers()
    }

    // 透過 EventBus 轉發事件
    if (this.eventBus) {
      this.logger.log(`準備發送事件到 EventBus: ${message.eventType}`)
      this.logger.log('事件資料:', enhancedEventData)

      const results = await this.eventBus.emit(message.eventType, enhancedEventData)
      const handlersExecuted = Array.isArray(results) ? results.length : 0

      this.logger.log(`[OK] 事件轉發成功: ${message.eventType}`, {
        handlersExecuted,
        success: true
      })

      sendResponse({
        success: true,
        message: '事件已轉發',
        eventType: message.eventType,
        handlersExecuted,
        timestamp: Date.now()
      })
    } else {
      this.logger.warn('[WARN] EventBus 未初始化，無法轉發事件')
      sendResponse({
        success: false,
        error: 'EventBus 未初始化',
        eventType: message.eventType
      })
    }

    return false
  }

  /**
   * 處理 Content Script 狀態更新
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handleContentStatusUpdate (message, sender, sendResponse) {
    const tabId = sender.tab.id
    const status = message.data?.status

    this.logger.log(`[STATS] Content Script 狀態更新: Tab ${tabId} -> ${status}`)

    // 更新 Content Script 狀態
    if (this.activeContentScripts.has(tabId)) {
      const scriptInfo = this.activeContentScripts.get(tabId)
      scriptInfo.status = status
      scriptInfo.lastUpdate = Date.now()
      scriptInfo.statusHistory.push({
        status,
        timestamp: Date.now()
      })
    }

    // 觸發狀態更新事件
    if (this.eventBus) {
      await this.eventBus.emit('CONTENT.STATUS.UPDATED', {
        tabId,
        status,
        url: sender.tab?.url,
        timestamp: Date.now()
      })
    }

    sendResponse({
      success: true,
      message: '狀態已更新',
      timestamp: Date.now()
    })

    return false
  }

  /**
   * 處理 Content Script 準備就緒
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handleContentScriptReady (message, sender, sendResponse) {
    const tabId = sender.tab.id

    this.logger.log(`[OK] Content Script 準備就緒: Tab ${tabId}`)

    // 註冊 Content Script
    this.activeContentScripts.set(tabId, {
      tabId,
      url: sender.tab.url,
      status: 'ready',
      readyTime: Date.now(),
      lastUpdate: Date.now(),
      messageCount: 0,
      statusHistory: [{
        status: 'ready',
        timestamp: Date.now()
      }]
    })

    // 更新活躍腳本統計
    this.contentStats.activeScripts = this.activeContentScripts.size

    // 觸發準備就緒事件
    if (this.eventBus) {
      await this.eventBus.emit('CONTENT.SCRIPT.READY', {
        tabId,
        url: sender.tab?.url,
        timestamp: Date.now()
      })
    }

    sendResponse({
      success: true,
      message: 'Content Script 已註冊',
      config: {
        // 可以在這裡返回配置資訊給 Content Script
        enableLogging: true,
        reportInterval: 30000
      },
      timestamp: Date.now()
    })

    return false
  }

  /**
   * 處理 Content Script 錯誤
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {Promise<boolean>}
   * @private
   */
  async handleContentScriptError (message, sender, sendResponse) {
    const tabId = sender.tab.id
    const error = message.data?.error

    this.logger.error(`[FAIL] Content Script 錯誤: Tab ${tabId}`, error)

    // 更新 Content Script 狀態
    if (this.activeContentScripts.has(tabId)) {
      const scriptInfo = this.activeContentScripts.get(tabId)
      scriptInfo.status = 'error'
      scriptInfo.lastError = error
      scriptInfo.lastUpdate = Date.now()
      scriptInfo.statusHistory.push({
        status: 'error',
        error,
        timestamp: Date.now()
      })
    }

    // 觸發錯誤事件
    if (this.eventBus) {
      await this.eventBus.emit('CONTENT.SCRIPT.ERROR', {
        tabId,
        error,
        url: sender.tab?.url,
        timestamp: Date.now()
      })
    }

    sendResponse({
      success: true,
      message: '錯誤已記錄',
      timestamp: Date.now()
    })

    return false
  }

  /**
   * 確保提取事件處理器存在
   * @returns {Promise<void>}
   * @private
   */
  async ensureExtractionHandlers () {
    // 這個方法可以檢查和註冊關鍵的提取事件監聽器
    if (this.eventBus && typeof this.eventBus.hasListener === 'function') {
      if (!this.eventBus.hasListener('EXTRACTION.COMPLETED')) {
        this.logger.warn('[WARN] EXTRACTION.COMPLETED 監聽器未註冊')
        // 可以在這裡觸發監聽器註冊事件
        if (this.eventBus) {
          await this.eventBus.emit('REGISTER.EXTRACTION.HANDLERS', {
            timestamp: Date.now()
          })
        }
      }
    }
  }

  /**
   * 發送訊息到 Content Script
   * @param {number} tabId - 標籤頁 ID
   * @param {Object} message - 訊息物件
   * @returns {Promise<Object>} 回應結果
   */
  async sendToContentScript (tabId, message) {
    try {
      this.logger.log(`發送訊息到 Content Script: Tab ${tabId}`, message)

      const response = await chrome.tabs.sendMessage(tabId, message)

      this.logger.log(`[OK] Content Script 回應: Tab ${tabId}`, response)
      return { success: true, response }
    } catch (error) {
      this.logger.error(`[FAIL] 發送訊息到 Content Script 失敗: Tab ${tabId}`, error)

      // 更新 Content Script 狀態為離線
      if (this.activeContentScripts.has(tabId)) {
        const scriptInfo = this.activeContentScripts.get(tabId)
        scriptInfo.status = 'offline'
        scriptInfo.lastUpdate = Date.now()
      }

      return { success: false, error: error.message }
    }
  }

  /**
   * 處理訊息佇列
   * @returns {Promise<void>}
   * @private
   */
  async processMessageQueue () {
    if (this.processingQueue || this.messageQueue.length === 0) {
      return
    }

    this.processingQueue = true

    try {
      while (this.messageQueue.length > 0) {
        const queuedMessage = this.messageQueue.shift()

        try {
          await this.handleMessage(
            queuedMessage.message,
            queuedMessage.sender,
            queuedMessage.sendResponse
          )
        } catch (error) {
          this.logger.error('[FAIL] 處理佇列訊息失敗:', error)
        }
      }
    } finally {
      this.processingQueue = false
    }
  }

  /**
   * 等待佇列處理完成
   * @returns {Promise<void>}
   * @private
   */
  async waitForQueueCompletion () {
    let attempts = 0
    const maxAttempts = 50 // 5秒超時

    while (this.processingQueue && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
  }

  /**
   * 通知 Content Script 系統即將關閉
   * @returns {Promise<void>}
   * @private
   */
  async notifyContentScriptsShutdown () {
    const notifications = []

    for (const [tabId, scriptInfo] of this.activeContentScripts) {
      if (scriptInfo.status === 'ready') {
        notifications.push(
          this.sendToContentScript(tabId, {
            type: 'SYSTEM.SHUTDOWN',
            timestamp: Date.now()
          }).catch(error => {
            this.logger.error(`[FAIL] 通知 Content Script 關閉失敗: Tab ${tabId}`, error)
          })
        )
      }
    }

    await Promise.all(notifications)
  }

  /**
   * 更新 Content Script 狀態
   * @param {Object} sender - 發送者資訊
   * @private
   */
  updateContentScriptStatus (sender) {
    const tabId = sender.tab.id

    if (this.activeContentScripts.has(tabId)) {
      const scriptInfo = this.activeContentScripts.get(tabId)
      scriptInfo.messageCount++
      scriptInfo.lastUpdate = Date.now()
    }
  }

  /**
   * 更新 Content Script 統計
   * @param {Object} message - 訊息物件
   * @param {Object} sender - 發送者資訊
   * @private
   */
  updateContentStats (message, sender) {
    this.contentStats.total++

    // 按訊息類型統計
    const messageType = message.type
    if (!this.contentStats.byMessageType.has(messageType)) {
      this.contentStats.byMessageType.set(messageType, 0)
    }
    this.contentStats.byMessageType.set(messageType, this.contentStats.byMessageType.get(messageType) + 1)

    // 更新活躍腳本數量
    this.contentStats.activeScripts = this.activeContentScripts.size
  }

  /**
   * 重置統計
   * @private
   */
  resetStats () {
    this.contentStats = {
      total: 0,
      success: 0,
      failed: 0,
      eventForwards: 0,
      activeScripts: 0,
      byMessageType: new Map()
    }
  }

  /**
   * 取得 Content Script 狀態
   * @returns {Object} Content Script 狀態報告
   */
  getContentScriptStatus () {
    return {
      activeScripts: Array.from(this.activeContentScripts.entries()).map(([tabId, info]) => ({
        tabId,
        ...info
      })),
      stats: {
        ...this.contentStats,
        byMessageType: Object.fromEntries(this.contentStats.byMessageType)
      },
      queueSize: this.messageQueue.length,
      processingQueue: this.processingQueue,
      timestamp: Date.now()
    }
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    const errorRate = this.contentStats.total > 0
      ? this.contentStats.failed / this.contentStats.total
      : 0

    const activeScriptsCount = this.activeContentScripts.size
    const offlineScriptsCount = Array.from(this.activeContentScripts.values())
      .filter(script => script.status === 'offline' || script.status === 'error').length

    return {
      activeScripts: activeScriptsCount,
      offlineScripts: offlineScriptsCount,
      errorRate,
      queueSize: this.messageQueue.length,
      eventForwards: this.contentStats.eventForwards,
      health: errorRate > 0.2 || offlineScriptsCount > 2 ? 'degraded' : 'healthy'
    }
  }
}

module.exports = ContentMessageHandler
