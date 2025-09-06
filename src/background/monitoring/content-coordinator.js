/**
 * Content Script 協調器
 *
 * 負責功能：
 * - 管理和協調 Content Scripts 的生命週期
 * - 監控 Content Scripts 的健康狀態和連接性
 * - 處理 Content Scripts 的註冊和註銷
 * - 提供 Content Scripts 與 Background 的通訊協調
 *
 * 設計考量：
 * - 基於 BaseModule 實現標準生命週期管理
 * - 支援多標籤頁 Content Scripts 管理
 * - 實現 Content Scripts 自動重新連接機制
 * - 提供統一的 Content Scripts 狀態監控
 */

const BaseModule = require('src/background/lifecycle/base-module')
const {
  CONTENT_SCRIPT_STATES,
  MESSAGE_TYPES,
  TIMEOUTS,
  LIMITS
} = require('src/background/constants/module-constants')

class ContentCoordinator extends BaseModule {
  constructor (dependencies = {}) {
    super(dependencies)

    // Content Scripts 管理
    this.contentScripts = new Map()
    this.connectionRegistry = new Map()
    this.healthCheckIntervals = new Map()

    // 狀態管理
    this.coordinatorReady = false
    this.shutdownInProgress = false

    // 配置設定
    this.config = {
      healthCheckInterval: TIMEOUTS.HEALTH_CHECK_INTERVAL,
      connectionTimeout: TIMEOUTS.DEFAULT_MESSAGE_TIMEOUT,
      maxRetries: LIMITS.MAX_RETRIES,
      autoReconnect: true
    }

    // 統計資料
    this.stats = {
      totalRegistrations: 0,
      activeConnections: 0,
      failedConnections: 0,
      healthCheckFailures: 0,
      reconnectAttempts: 0
    }

    // 多語言支援
    this.i18nManager = dependencies.i18nManager || null
  }

  /**
   * 初始化 Content Script 協調器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    if (this.i18nManager) {
      this.logger.log(this.i18nManager.t('modules.operations.initialize', { moduleName: this.moduleName }))
    } else {
      this.logger.log('📡 初始化 Content Script 協調器')
    }

    // 清理現有狀態
    await this.clearAllConnections()

    // 初始化訊息監聽器
    await this.initializeMessageListeners()

    this.logger.log('✅ Content Script 協調器初始化完成')
  }

  /**
   * 啟動 Content Script 協調器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStart () {
    this.logger.log('▶️ 啟動 Content Script 協調器')

    // 註冊事件監聽器
    await this.registerEventListeners()

    // 開始健康檢查
    await this.startHealthMonitoring()

    // 標記協調器就緒
    this.coordinatorReady = true

    this.logger.log('✅ Content Script 協調器啟動完成')
  }

  /**
   * 停止 Content Script 協調器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStop () {
    this.logger.log('⏹️ 停止 Content Script 協調器')

    this.shutdownInProgress = true
    this.coordinatorReady = false

    // 停止健康監控
    await this.stopHealthMonitoring()

    // 取消註冊事件監聽器
    await this.unregisterEventListeners()

    // 通知所有 Content Scripts 關閉
    await this.notifyContentScriptsShutdown()

    // 清理所有連接
    await this.clearAllConnections()

    this.logger.log('✅ Content Script 協調器停止完成')
  }

  /**
   * 初始化訊息監聽器
   * @returns {Promise<void>}
   * @private
   */
  async initializeMessageListeners () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 未初始化，跳過訊息監聽器設定')
      return
    }

    try {
      // 監聽 Content Script 註冊事件
      this.registrationListenerId = this.eventBus.on(MESSAGE_TYPES.CONTENT_SCRIPT_READY,
        (event) => this.handleContentScriptRegistration(event.data)
      )

      // 監聽 Content Script 狀態更新
      this.statusUpdateListenerId = this.eventBus.on(MESSAGE_TYPES.CONTENT_STATUS_UPDATE,
        (event) => this.handleContentScriptStatusUpdate(event.data)
      )

      // 監聽 Content Script 錯誤報告
      this.errorListenerId = this.eventBus.on(MESSAGE_TYPES.CONTENT_SCRIPT_ERROR,
        (event) => this.handleContentScriptError(event.data)
      )

      this.logger.log('📝 Content Script 訊息監聽器初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化訊息監聽器失敗:', error)
      throw error
    }
  }

  /**
   * 註冊事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      return
    }

    try {
      // 監聽標籤頁關閉事件
      this.tabCloseListenerId = this.eventBus.on('TAB.REMOVED',
        (event) => this.handleTabClosed(event.data)
      )

      // 監聽標籤頁更新事件
      this.tabUpdateListenerId = this.eventBus.on('TAB.UPDATED',
        (event) => this.handleTabUpdated(event.data)
      )

      this.logger.log('📝 事件監聽器註冊完成')
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
      const listeners = [
        { event: MESSAGE_TYPES.CONTENT_SCRIPT_READY, id: this.registrationListenerId },
        { event: MESSAGE_TYPES.CONTENT_STATUS_UPDATE, id: this.statusUpdateListenerId },
        { event: MESSAGE_TYPES.CONTENT_SCRIPT_ERROR, id: this.errorListenerId },
        { event: 'TAB.REMOVED', id: this.tabCloseListenerId },
        { event: 'TAB.UPDATED', id: this.tabUpdateListenerId }
      ]

      for (const listener of listeners) {
        if (listener.id) {
          this.eventBus.off(listener.event, listener.id)
        }
      }

      this.logger.log('🔄 事件監聽器取消註冊完成')
    } catch (error) {
      this.logger.error('❌ 取消註冊事件監聽器失敗:', error)
    }
  }

  /**
   * 處理 Content Script 註冊
   * @param {Object} data - 註冊資料
   * @returns {Promise<void>}
   * @private
   */
  async handleContentScriptRegistration (data) {
    try {
      const { tabId, scriptInfo } = data

      this.logger.log(`📝 Content Script 註冊: Tab ${tabId}`)

      // 建立 Content Script 記錄
      const contentScript = {
        tabId,
        scriptInfo,
        status: CONTENT_SCRIPT_STATES.READY,
        registeredAt: Date.now(),
        lastActivity: Date.now(),
        retryCount: 0,
        healthCheckFailures: 0
      }

      // 儲存到註冊表
      this.contentScripts.set(tabId, contentScript)
      this.stats.totalRegistrations++
      this.stats.activeConnections++

      // 開始該標籤頁的健康檢查
      await this.startTabHealthCheck(tabId)

      // 觸發註冊完成事件
      if (this.eventBus) {
        await this.eventBus.emit('CONTENT.SCRIPT.REGISTERED', {
          tabId,
          scriptInfo,
          timestamp: Date.now()
        })
      }

      this.logger.log(`✅ Content Script 註冊完成: Tab ${tabId}`)
    } catch (error) {
      this.logger.error('❌ 處理 Content Script 註冊失敗:', error)
    }
  }

  /**
   * 處理 Content Script 狀態更新
   * @param {Object} data - 狀態更新資料
   * @returns {Promise<void>}
   * @private
   */
  async handleContentScriptStatusUpdate (data) {
    try {
      const { tabId, status, details } = data

      if (!this.contentScripts.has(tabId)) {
        this.logger.warn(`⚠️ 收到未註冊的 Content Script 狀態更新: Tab ${tabId}`)
        return
      }

      const contentScript = this.contentScripts.get(tabId)
      const previousStatus = contentScript.status

      // 更新狀態
      contentScript.status = status
      contentScript.lastActivity = Date.now()

      if (details) {
        contentScript.details = details
      }

      this.logger.log(`📊 Content Script 狀態更新: Tab ${tabId} → ${status}`)

      // 處理狀態變更
      await this.handleStatusChange(tabId, previousStatus, status)
    } catch (error) {
      this.logger.error('❌ 處理 Content Script 狀態更新失敗:', error)
    }
  }

  /**
   * 處理 Content Script 錯誤
   * @param {Object} data - 錯誤資料
   * @returns {Promise<void>}
   * @private
   */
  async handleContentScriptError (data) {
    try {
      const { tabId, error, errorType } = data

      this.logger.error(`❌ Content Script 錯誤: Tab ${tabId}`, error)

      if (this.contentScripts.has(tabId)) {
        const contentScript = this.contentScripts.get(tabId)
        contentScript.status = CONTENT_SCRIPT_STATES.ERROR
        contentScript.lastError = { error, errorType, timestamp: Date.now() }
        contentScript.retryCount++
      }

      this.stats.failedConnections++

      // 嘗試重新連接
      if (this.config.autoReconnect) {
        await this.attemptReconnection(tabId)
      }
    } catch (error) {
      this.logger.error('❌ 處理 Content Script 錯誤失敗:', error)
    }
  }

  /**
   * 處理標籤頁關閉事件
   * @param {Object} data - 標籤頁資料
   * @returns {Promise<void>}
   * @private
   */
  async handleTabClosed (data) {
    try {
      const { tabId } = data

      if (this.contentScripts.has(tabId)) {
        this.logger.log(`🗂️ 清理已關閉標籤頁的 Content Script: Tab ${tabId}`)

        // 停止健康檢查
        await this.stopTabHealthCheck(tabId)

        // 移除註冊記錄
        this.contentScripts.delete(tabId)
        this.stats.activeConnections--
      }
    } catch (error) {
      this.logger.error('❌ 處理標籤頁關閉事件失敗:', error)
    }
  }

  /**
   * 處理標籤頁更新事件
   * @param {Object} data - 更新資料
   * @returns {Promise<void>}
   * @private
   */
  async handleTabUpdated (data) {
    try {
      const { tabId, changeInfo } = data

      // 處理 URL 變更
      if (changeInfo.url && this.contentScripts.has(tabId)) {
        const contentScript = this.contentScripts.get(tabId)

        // 重設重試計數和健康狀態
        contentScript.retryCount = 0
        contentScript.healthCheckFailures = 0
        contentScript.lastActivity = Date.now()

        this.logger.log(`🔄 標籤頁 URL 變更，重設 Content Script 狀態: Tab ${tabId}`)
      }
    } catch (error) {
      this.logger.error('❌ 處理標籤頁更新事件失敗:', error)
    }
  }

  /**
   * 處理狀態變更
   * @param {number} tabId - 標籤頁 ID
   * @param {string} previousStatus - 先前狀態
   * @param {string} currentStatus - 當前狀態
   * @returns {Promise<void>}
   * @private
   */
  async handleStatusChange (tabId, previousStatus, currentStatus) {
    try {
      // 狀態轉換為離線時的處理
      if (currentStatus === CONTENT_SCRIPT_STATES.OFFLINE &&
          previousStatus !== CONTENT_SCRIPT_STATES.OFFLINE) {
        this.logger.warn(`⚠️ Content Script 離線: Tab ${tabId}`)

        if (this.config.autoReconnect) {
          await this.scheduleReconnection(tabId)
        }
      }

      // 狀態轉換為就緒時的處理
      if (currentStatus === CONTENT_SCRIPT_STATES.READY &&
          previousStatus !== CONTENT_SCRIPT_STATES.READY) {
        this.logger.log(`✅ Content Script 恢復連接: Tab ${tabId}`)

        // 重設錯誤計數
        const contentScript = this.contentScripts.get(tabId)
        if (contentScript) {
          contentScript.retryCount = 0
          contentScript.healthCheckFailures = 0
        }
      }
    } catch (error) {
      this.logger.error('❌ 處理狀態變更失敗:', error)
    }
  }

  /**
   * 開始健康監控
   * @returns {Promise<void>}
   * @private
   */
  async startHealthMonitoring () {
    if (this.globalHealthCheckInterval) {
      clearInterval(this.globalHealthCheckInterval)
    }

    this.globalHealthCheckInterval = setInterval(async () => {
      if (!this.shutdownInProgress) {
        await this.performGlobalHealthCheck()
      }
    }, this.config.healthCheckInterval)

    this.logger.log('💓 Content Script 全域健康監控已啟動')
  }

  /**
   * 停止健康監控
   * @returns {Promise<void>}
   * @private
   */
  async stopHealthMonitoring () {
    if (this.globalHealthCheckInterval) {
      clearInterval(this.globalHealthCheckInterval)
      this.globalHealthCheckInterval = null
    }

    // 停止所有標籤頁的健康檢查
    for (const tabId of this.healthCheckIntervals.keys()) {
      await this.stopTabHealthCheck(tabId)
    }

    this.logger.log('💓 Content Script 健康監控已停止')
  }

  /**
   * 開始指定標籤頁的健康檢查
   * @param {number} tabId - 標籤頁 ID
   * @returns {Promise<void>}
   * @private
   */
  async startTabHealthCheck (tabId) {
    // 停止現有的健康檢查
    await this.stopTabHealthCheck(tabId)

    const interval = setInterval(async () => {
      if (!this.shutdownInProgress) {
        await this.performTabHealthCheck(tabId)
      }
    }, this.config.healthCheckInterval)

    this.healthCheckIntervals.set(tabId, interval)
  }

  /**
   * 停止指定標籤頁的健康檢查
   * @param {number} tabId - 標籤頁 ID
   * @returns {Promise<void>}
   * @private
   */
  async stopTabHealthCheck (tabId) {
    if (this.healthCheckIntervals.has(tabId)) {
      clearInterval(this.healthCheckIntervals.get(tabId))
      this.healthCheckIntervals.delete(tabId)
    }
  }

  /**
   * 執行全域健康檢查
   * @returns {Promise<void>}
   * @private
   */
  async performGlobalHealthCheck () {
    try {
      const activeScripts = Array.from(this.contentScripts.keys())
      this.logger.log(`💓 執行全域健康檢查，檢查 ${activeScripts.length} 個 Content Scripts`)

      for (const tabId of activeScripts) {
        await this.performTabHealthCheck(tabId)
      }
    } catch (error) {
      this.logger.error('❌ 全域健康檢查失敗:', error)
    }
  }

  /**
   * 執行指定標籤頁的健康檢查
   * @param {number} tabId - 標籤頁 ID
   * @returns {Promise<void>}
   * @private
   */
  async performTabHealthCheck (tabId) {
    if (!this.contentScripts.has(tabId)) {
      return
    }

    try {
      const contentScript = this.contentScripts.get(tabId)

      // 發送健康檢查訊息
      const response = await chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.HEALTH_CHECK,
        timestamp: Date.now()
      })

      if (response && response.success) {
        // 健康檢查成功
        contentScript.status = CONTENT_SCRIPT_STATES.READY
        contentScript.lastActivity = Date.now()
        contentScript.healthCheckFailures = 0
      } else {
        throw new Error('Health check failed')
      }
    } catch (error) {
      const contentScript = this.contentScripts.get(tabId)
      contentScript.healthCheckFailures++
      this.stats.healthCheckFailures++

      if (contentScript.healthCheckFailures >= this.config.maxRetries) {
        contentScript.status = CONTENT_SCRIPT_STATES.OFFLINE
        this.logger.warn(`⚠️ Content Script 健康檢查失敗，標記為離線: Tab ${tabId}`)

        if (this.config.autoReconnect) {
          await this.attemptReconnection(tabId)
        }
      }
    }
  }

  /**
   * 嘗試重新連接
   * @param {number} tabId - 標籤頁 ID
   * @returns {Promise<void>}
   * @private
   */
  async attemptReconnection (tabId) {
    if (!this.contentScripts.has(tabId)) {
      return
    }

    const contentScript = this.contentScripts.get(tabId)

    if (contentScript.retryCount >= this.config.maxRetries) {
      this.logger.error(`❌ Content Script 重連次數已達上限: Tab ${tabId}`)
      return
    }

    try {
      contentScript.retryCount++
      this.stats.reconnectAttempts++

      this.logger.log(`🔄 嘗試重新連接 Content Script: Tab ${tabId} (${contentScript.retryCount}/${this.config.maxRetries})`)

      // 嘗試重新注入 Content Script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content/content.js']
      })

      // 等待重新註冊
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      this.logger.error(`❌ 重新連接 Content Script 失敗: Tab ${tabId}`, error)
      contentScript.status = CONTENT_SCRIPT_STATES.ERROR
    }
  }

  /**
   * 安排重新連接
   * @param {number} tabId - 標籤頁 ID
   * @returns {Promise<void>}
   * @private
   */
  async scheduleReconnection (tabId) {
    // 延遲重連，避免過於頻繁的重試
    setTimeout(async () => {
      if (!this.shutdownInProgress) {
        await this.attemptReconnection(tabId)
      }
    }, 5000)
  }

  /**
   * 通知所有 Content Scripts 系統關閉
   * @returns {Promise<void>}
   * @private
   */
  async notifyContentScriptsShutdown () {
    const activeScripts = Array.from(this.contentScripts.keys())

    this.logger.log(`📢 通知 ${activeScripts.length} 個 Content Scripts 系統即將關閉`)

    const notifications = activeScripts.map(async (tabId) => {
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: 'SYSTEM_SHUTDOWN',
          message: 'Background Service Worker is shutting down'
        })
      } catch (error) {
        // 忽略通知失敗，因為系統正在關閉
      }
    })

    await Promise.allSettled(notifications)
  }

  /**
   * 清理所有連接
   * @returns {Promise<void>}
   * @private
   */
  async clearAllConnections () {
    // 停止所有健康檢查
    for (const tabId of this.healthCheckIntervals.keys()) {
      await this.stopTabHealthCheck(tabId)
    }

    // 清理註冊表
    this.contentScripts.clear()
    this.connectionRegistry.clear()

    // 重設統計
    this.stats.activeConnections = 0
  }

  /**
   * 獲取 Content Script 狀態
   * @param {number} tabId - 標籤頁 ID (可選)
   * @returns {Object} Content Script 狀態
   */
  getContentScriptStatus (tabId = null) {
    if (tabId) {
      return this.contentScripts.get(tabId) || null
    }

    return {
      totalScripts: this.contentScripts.size,
      scripts: Array.from(this.contentScripts.entries()).map(([id, script]) => ({
        tabId: id,
        ...script
      })),
      stats: this.stats,
      coordinatorReady: this.coordinatorReady
    }
  }

  /**
   * 檢查 Content Script 是否就緒
   * @param {number} tabId - 標籤頁 ID
   * @returns {boolean} 是否就緒
   */
  isContentScriptReady (tabId) {
    const contentScript = this.contentScripts.get(tabId)
    return contentScript && contentScript.status === CONTENT_SCRIPT_STATES.READY
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    const totalScripts = this.contentScripts.size
    const readyScripts = Array.from(this.contentScripts.values())
      .filter(script => script.status === CONTENT_SCRIPT_STATES.READY).length
    const errorRate = this.stats.totalRegistrations > 0
      ? this.stats.failedConnections / this.stats.totalRegistrations
      : 0

    return {
      totalScripts,
      readyScripts,
      activeConnections: this.stats.activeConnections,
      errorRate: errorRate.toFixed(3),
      reconnectAttempts: this.stats.reconnectAttempts,
      coordinatorReady: this.coordinatorReady,
      health: (readyScripts / Math.max(totalScripts, 1)) < 0.8 ? 'degraded' : 'healthy'
    }
  }
}

module.exports = ContentCoordinator
