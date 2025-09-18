const ErrorCodes = require('src/core/errors/ErrorCodes')


const { EVENT_PRIORITIES, CONNECTION_EVENTS } = require('src/core/event-bus')

/**
 * 連接監控服務配置常量
 */
const LIMITS = {
  MAX_CONNECTION_HISTORY: 100,
  MAX_RETRY_ATTEMPTS: 3,
  HEALTH_CHECK_INTERVAL: 30000,
  CONNECTION_TIMEOUT: 10000
}

const TIMEOUTS = {
  DEFAULT_CONNECTION_TIMEOUT: 10000,
  HEARTBEAT_INTERVAL: 5000,
  RECONNECTION_DELAY: 2000
}

/**
 * 連接監控服務
 * 負責監控各種連接狀態、處理連接異常、維護連接品質
 */
class ConnectionMonitoringService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null

    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: 連接監控服務負責通訊穩定性的核心監控任務
    // 執行環境: Service Worker 持續監控，連接異常必須被追蹤
    // 後備機制: console 確保連接問題能被記錄和除錯
    // 監控重要性: 連接失敗會影響整個擴展功能，必須有可靠記錄
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false
    }

    // 連接管理
    this.activeConnections = new Map()
    this.connectionHistory = []
    this.healthCheckInterval = null
    this.heartbeatInterval = null

    // 統計資料
    this.stats = {
      connectionsEstablished: 0,
      connectionsClosed: 0,
      activeConnectionsCount: 0,
      totalConnectionTime: 0,
      averageConnectionDuration: 0,
      maxConcurrentConnections: 0,
      failedConnectionAttempts: 0,
      reconnectionAttempts: 0,
      healthChecksPerformed: 0,
      heartbeatsSent: 0
    }

    // 事件監聽器記錄
    this.registeredListeners = new Map()
  }

  /**
   * 初始化連接監控服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 連接監控服務已初始化')
      return
    }

    try {
      this.logger.log('🔄 初始化連接監控服務')

      // 載入連接歷史
      await this.loadConnectionHistory()

      this.state.initialized = true
      this.logger.log('✅ 連接監控服務初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化連接監控服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動連接監控服務
   */
  async start () {
    if (!this.state.initialized) {
      const error = new Error('連接監控服務尚未初始化')
      error.code = ErrorCodes.CONFIG_ERROR
      error.details = { category: 'general' }
      throw error
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 連接監控服務已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動連接監控服務')

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 啟動健康檢查監控
      this.startHealthCheckMonitoring()

      // 啟動心跳監控
      this.startHeartbeatMonitoring()

      this.state.active = true
      this.logger.log('✅ 連接監控服務啟動完成')
    } catch (error) {
      this.logger.error('❌ 啟動連接監控服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止連接監控服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('⚠️ 連接監控服務未啟動')
      return
    }

    try {
      this.logger.log('🛑 停止連接監控服務')

      // 停止健康檢查監控
      this.stopHealthCheckMonitoring()

      // 停止心跳監控
      this.stopHeartbeatMonitoring()

      // 關閉所有活動連接
      await this.closeAllConnections('service_shutdown')

      // 保存連接歷史
      await this.saveConnectionHistory()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.logger.log('✅ 連接監控服務停止完成')
    } catch (error) {
      this.logger.error('❌ 停止連接監控服務失敗:', error)
      throw error
    }
  }

  /**
   * 建立連接
   */
  async establishConnection (connectionId, connectionInfo) {
    try {
      this.logger.log(`🔗 建立連接: ${connectionId}`)

      // 檢查連接是否已存在
      if (this.activeConnections.has(connectionId)) {
        this.logger.warn(`⚠️ 連接 ${connectionId} 已存在`)
        return {
          success: true,
          connectionId,
          message: 'Connection already exists',
          connection: this.activeConnections.get(connectionId)
        }
      }

      // 建立連接
      const connection = {
        id: connectionId,
        type: connectionInfo.type || 'unknown',
        target: connectionInfo.target || 'unknown',
        establishedAt: Date.now(),
        lastActivity: Date.now(),
        status: 'active',
        retryAttempts: 0,
        messageCount: 0,
        metadata: {
          userAgent: connectionInfo.userAgent,
          origin: connectionInfo.origin,
          protocol: connectionInfo.protocol
        }
      }

      this.activeConnections.set(connectionId, connection)
      this.stats.connectionsEstablished++
      this.stats.activeConnectionsCount = this.activeConnections.size

      // 更新最大並發連接記錄
      if (this.stats.activeConnectionsCount > this.stats.maxConcurrentConnections) {
        this.stats.maxConcurrentConnections = this.stats.activeConnectionsCount
      }

      // 觸發連接建立事件
      if (this.eventBus) {
        await this.eventBus.emit('MESSAGING.CONNECTION.ESTABLISHED', {
          connectionId,
          connectionType: connection.type,
          timestamp: Date.now(),
          activeConnectionsCount: this.stats.activeConnectionsCount
        }, EVENT_PRIORITIES.NORMAL)
      }

      this.logger.log(`✅ 連接建立成功: ${connectionId}`)

      return {
        success: true,
        connectionId,
        message: 'Connection established successfully',
        connection: { ...connection }
      }
    } catch (error) {
      this.logger.error(`❌ 建立連接失敗: ${connectionId}`, error)
      this.stats.failedConnectionAttempts++
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 關閉連接
   */
  async closeConnection (connectionId, reason = 'normal_closure') {
    try {
      this.logger.log(`🔗 關閉連接: ${connectionId} (原因: ${reason})`)

      const connection = this.activeConnections.get(connectionId)
      if (!connection) {
        this.logger.warn(`⚠️ 連接 ${connectionId} 不存在`)
        return {
          success: false,
          message: 'Connection not found'
        }
      }

      // 更新連接狀態
      connection.status = 'closed'
      connection.closedAt = Date.now()
      connection.duration = connection.closedAt - connection.establishedAt
      connection.closeReason = reason

      // 移到歷史記錄
      this.connectionHistory.push({ ...connection })

      // 修剪歷史記錄大小
      if (this.connectionHistory.length > LIMITS.MAX_CONNECTION_HISTORY) {
        this.connectionHistory.shift()
      }

      // 清理連接
      this.activeConnections.delete(connectionId)

      // 更新統計
      this.stats.connectionsClosed++
      this.stats.activeConnectionsCount = this.activeConnections.size
      this.stats.totalConnectionTime += connection.duration
      this.stats.averageConnectionDuration = this.stats.totalConnectionTime / this.stats.connectionsClosed

      // 觸發連接關閉事件
      if (this.eventBus) {
        await this.eventBus.emit('MESSAGING.CONNECTION.CLOSED', {
          connectionId,
          reason,
          duration: connection.duration,
          messageCount: connection.messageCount,
          timestamp: Date.now(),
          activeConnectionsCount: this.stats.activeConnectionsCount
        }, EVENT_PRIORITIES.NORMAL)
      }

      this.logger.log(`✅ 連接關閉成功: ${connectionId}`)

      return {
        success: true,
        connectionId,
        message: 'Connection closed successfully',
        connectionSummary: {
          duration: connection.duration,
          messageCount: connection.messageCount,
          closeReason: reason
        }
      }
    } catch (error) {
      this.logger.error(`❌ 關閉連接失敗: ${connectionId}`, error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 更新連接活動
   */
  updateConnectionActivity (connectionId, activityType = null) {
    const connection = this.activeConnections.get(connectionId)
    if (connection) {
      connection.lastActivity = Date.now()
      connection.messageCount++

      if (activityType) {
        if (!connection.activityTypes) {
          connection.activityTypes = {}
        }
        connection.activityTypes[activityType] = (connection.activityTypes[activityType] || 0) + 1
      }
    }
  }

  /**
   * 關閉所有活動連接
   */
  async closeAllConnections (reason = 'system_shutdown') {
    this.logger.log('🔗 關閉所有活動連接')

    const connectionIds = Array.from(this.activeConnections.keys())

    for (const connectionId of connectionIds) {
      try {
        await this.closeConnection(connectionId, reason)
      } catch (error) {
        this.logger.error(`❌ 關閉連接失敗: ${connectionId}`, error)
      }
    }

    this.logger.log(`✅ 已關閉 ${connectionIds.length} 個連接`)
  }

  /**
   * 執行健康檢查
   */
  async performHealthCheck () {
    this.stats.healthChecksPerformed++

    const healthIssues = []
    const now = Date.now()

    for (const [connectionId, connection] of this.activeConnections) {
      // 檢查連接活動狀態
      const inactiveTime = now - connection.lastActivity
      if (inactiveTime > TIMEOUTS.DEFAULT_CONNECTION_TIMEOUT) {
        healthIssues.push({
          connectionId,
          issue: 'connection_inactive',
          inactiveTime
        })
      }

      // 檢查連接狀態
      if (connection.status !== 'active') {
        healthIssues.push({
          connectionId,
          issue: 'connection_status_invalid',
          status: connection.status
        })
      }
    }

    if (healthIssues.length > 0) {
      this.logger.warn('⚠️ 連接健康檢查發現問題:', healthIssues)

      // 處理健康問題
      for (const issue of healthIssues) {
        await this.handleHealthIssue(issue)
      }
    }

    return {
      healthy: healthIssues.length === 0,
      issues: healthIssues,
      activeConnections: this.activeConnections.size
    }
  }

  /**
   * 處理健康問題
   */
  async handleHealthIssue (issue) {
    const { connectionId, issue: issueType } = issue

    switch (issueType) {
      case 'connection_inactive':
        this.logger.warn(`⚠️ 處理非活動連接: ${connectionId}`)
        await this.closeConnection(connectionId, 'inactivity_timeout')
        break

      case 'connection_status_invalid':
        this.logger.warn(`⚠️ 處理狀態無效連接: ${connectionId}`)
        await this.closeConnection(connectionId, 'status_invalid')
        break

      default:
        this.logger.warn(`⚠️ 未知健康問題類型: ${issueType}`)
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
    }, LIMITS.HEALTH_CHECK_INTERVAL)

    this.logger.log('🔄 連接健康檢查監控已啟動')
  }

  /**
   * 停止健康檢查監控
   */
  stopHealthCheckMonitoring () {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    this.logger.log('🔄 連接健康檢查監控已停止')
  }

  /**
   * 啟動心跳監控
   */
  startHeartbeatMonitoring () {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    this.heartbeatInterval = setInterval(async () => {
      await this.sendHeartbeat()
    }, TIMEOUTS.HEARTBEAT_INTERVAL)

    this.logger.log('💓 心跳監控已啟動')
  }

  /**
   * 停止心跳監控
   */
  stopHeartbeatMonitoring () {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    this.logger.log('💓 心跳監控已停止')
  }

  /**
   * 發送心跳
   */
  async sendHeartbeat () {
    this.stats.heartbeatsSent++

    // 向所有活動連接發送心跳信號
    for (const [connectionId, connection] of this.activeConnections) {
      if (connection.status === 'active') {
        // 觸發心跳事件
        if (this.eventBus) {
          await this.eventBus.emit('MESSAGING.CONNECTION.HEARTBEAT', {
            connectionId,
            timestamp: Date.now()
          }, EVENT_PRIORITIES.LOW)
        }
      }
    }
  }

  /**
   * 載入連接歷史
   */
  async loadConnectionHistory () {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get(['messaging_connections'])

        if (stored.messaging_connections) {
          this.connectionHistory = stored.messaging_connections
            .slice(-LIMITS.MAX_CONNECTION_HISTORY)

          this.logger.log(`📚 載入了 ${this.connectionHistory.length} 個連接歷史記錄`)
        }
      } else {
        this.logger.warn('⚠️ Chrome storage API 不可用，跳過連接歷史載入')
      }
    } catch (error) {
      this.logger.error('❌ 載入連接歷史失敗:', error)
    }
  }

  /**
   * 保存連接歷史
   */
  async saveConnectionHistory () {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          messaging_connections: this.connectionHistory.slice(-LIMITS.MAX_CONNECTION_HISTORY)
        })

        this.logger.log(`💾 保存了 ${this.connectionHistory.length} 個連接歷史記錄`)
      } else {
        this.logger.warn('⚠️ Chrome storage API 不可用，無法保存連接歷史')
      }
    } catch (error) {
      this.logger.error('❌ 保存連接歷史失敗:', error)
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
        event: CONNECTION_EVENTS.ESTABLISH_REQUESTED,
        handler: this.handleConnectionEstablishRequest.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: CONNECTION_EVENTS.CLOSE_REQUESTED,
        handler: this.handleConnectionCloseRequest.bind(this),
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
   * 處理連接建立請求
   */
  async handleConnectionEstablishRequest (event) {
    try {
      const { connectionId, connectionInfo } = event.data
      await this.establishConnection(connectionId, connectionInfo)
    } catch (error) {
      this.logger.error('❌ 處理連接建立請求失敗:', error)
    }
  }

  /**
   * 處理連接關閉請求
   */
  async handleConnectionCloseRequest (event) {
    try {
      const { connectionId, reason } = event.data
      await this.closeConnection(connectionId, reason)
    } catch (error) {
      this.logger.error('❌ 處理連接關閉請求失敗:', error)
    }
  }

  /**
   * 獲取連接狀態
   */
  getConnectionState (connectionId = null) {
    if (connectionId) {
      return this.activeConnections.get(connectionId) || null
    }

    return {
      activeConnections: Array.from(this.activeConnections.values()),
      connectionHistory: this.connectionHistory.slice(-10),
      activeCount: this.activeConnections.size
    }
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      activeConnections: this.activeConnections.size,
      totalConnectionsEstablished: this.stats.connectionsEstablished,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const isHealthy = this.state.initialized &&
                     this.state.active &&
                     this.stats.activeConnectionsCount >= 0

    return {
      service: 'ConnectionMonitoringService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      metrics: {
        activeConnections: this.stats.activeConnectionsCount,
        totalConnections: this.stats.connectionsEstablished,
        averageConnectionDuration: Math.round(this.stats.averageConnectionDuration),
        maxConcurrentConnections: this.stats.maxConcurrentConnections,
        failedConnectionAttempts: this.stats.failedConnectionAttempts,
        reconnectionAttempts: this.stats.reconnectionAttempts,
        healthChecksPerformed: this.stats.healthChecksPerformed,
        heartbeatsSent: this.stats.heartbeatsSent
      }
    }
  }

  /**
   * 獲取連接指標
   */
  getMetrics () {
    return {
      ...this.stats,
      currentActiveConnections: this.activeConnections.size,
      connectionHistoryCount: this.connectionHistory.length
    }
  }
}

module.exports = { ConnectionMonitoringService, LIMITS, TIMEOUTS }
