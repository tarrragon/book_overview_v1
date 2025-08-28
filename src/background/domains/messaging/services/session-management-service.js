/**
 * 會話管理服務
 *
 * 負責功能：
 * - 管理所有活動會話的生命週期
 * - 追蹤會話狀態和互動記錄
 * - 實現會話資料的持久化和恢復
 * - 提供會話統計和分析功能
 *
 * 設計考量：
 * - 會話的獨立性和隔離性
 * - 高效率的會話查詢和管理
 * - 完整的會話記錄和統計
 * - 支援並發會話和資源管理
 *
 * 使用情境：
 * - Popup 會話管理和狀態追蹤
 * - 用戶互動記錄和分析
 * - 會話數據持久化和恢復
 */

const {
  STORAGE_KEYS,
  LIMITS,
  TIMEOUTS
} = require('../../../constants/module-constants')

class SessionManagementService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false
    }

    // 會話管理
    this.activeSessions = new Map()
    this.sessionHistory = []
    this.sessionTimeouts = new Map()
    this.sessionCleanupInterval = null

    // 統計資料
    this.stats = {
      sessionsCreated: 0,
      sessionsEnded: 0,
      activeSessionsCount: 0,
      totalSessionTime: 0,
      averageSessionDuration: 0,
      maxConcurrentSessions: 0,
      timeoutExpiredSessions: 0
    }

    // 事件監聽器記錄
    this.registeredListeners = new Map()
  }

  /**
   * 初始化會話管理服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 會話管理服務已初始化')
      return
    }

    try {
      this.logger.log('🔄 初始化會話管理服務')

      // 載入會話歷史
      await this.loadSessionHistory()

      this.state.initialized = true
      this.logger.log('✅ 會話管理服務初始化完成')
    } catch (error) {
      this.logger.error('❌ 初始化會話管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動會話管理服務
   */
  async start () {
    if (!this.state.initialized) {
      throw new Error('會話管理服務尚未初始化')
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 會話管理服務已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動會話管理服務')

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 啟動會話清理監控
      this.startSessionCleanupMonitoring()

      this.state.active = true
      this.logger.log('✅ 會話管理服務啟動完成')
    } catch (error) {
      this.logger.error('❌ 啟動會話管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止會話管理服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('⚠️ 會話管理服務未啟動')
      return
    }

    try {
      this.logger.log('🛑 停止會話管理服務')

      // 停止會話清理監控
      this.stopSessionCleanupMonitoring()

      // 結束所有活動會話
      await this.terminateAllSessions('service_shutdown')

      // 保存會話歷史
      await this.saveSessionHistory()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.logger.log('✅ 會話管理服務停止完成')
    } catch (error) {
      this.logger.error('❌ 停止會話管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 開始會話
   */
  async startSession (sessionId, context) {
    try {
      this.logger.log(`📝 開始會話: ${sessionId}`)

      // 檢查會話是否已存在
      if (this.activeSessions.has(sessionId)) {
        this.logger.warn(`⚠️ 會話 ${sessionId} 已存在`)
        return {
          success: true,
          sessionId,
          message: 'Session already exists',
          session: this.activeSessions.get(sessionId)
        }
      }

      // 建立會話
      const session = {
        id: sessionId,
        startedAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
        status: 'active',
        context: { ...context },
        metadata: {
          userAgent: context.userAgent,
          tabId: context.tabId,
          origin: context.origin
        }
      }

      this.activeSessions.set(sessionId, session)
      this.stats.sessionsCreated++
      this.stats.activeSessionsCount = this.activeSessions.size

      // 更新最大並發會話記錄
      if (this.stats.activeSessionsCount > this.stats.maxConcurrentSessions) {
        this.stats.maxConcurrentSessions = this.stats.activeSessionsCount
      }

      // 設定會話逾時
      this.setSessionTimeout(sessionId)

      // 觸發會話開始事件
      if (this.eventBus) {
        await this.eventBus.emit('MESSAGING.SESSION.STARTED', {
          sessionId,
          timestamp: Date.now(),
          activeSessionsCount: this.stats.activeSessionsCount
        })
      }

      this.logger.log(`✅ 會話開始成功: ${sessionId}`)

      return {
        success: true,
        sessionId,
        message: 'Session established successfully',
        session: { ...session }
      }
    } catch (error) {
      this.logger.error(`❌ 開始會話失敗: ${sessionId}`, error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 結束會話
   */
  async endSession (sessionId, reason = 'normal_termination') {
    try {
      this.logger.log(`📝 結束會話: ${sessionId} (原因: ${reason})`)

      const session = this.activeSessions.get(sessionId)
      if (!session) {
        this.logger.warn(`⚠️ 會話 ${sessionId} 不存在`)
        return {
          success: false,
          message: 'Session not found'
        }
      }

      // 更新會話狀態
      session.status = 'ended'
      session.endedAt = Date.now()
      session.duration = session.endedAt - session.startedAt
      session.endReason = reason

      // 移到歷史記錄
      this.sessionHistory.push({ ...session })

      // 修剚歷史記錄大小
      if (this.sessionHistory.length > LIMITS.MAX_SESSION_HISTORY) {
        this.sessionHistory.shift()
      }

      // 清理會話
      this.activeSessions.delete(sessionId)
      this.clearSessionTimeout(sessionId)

      // 更新統計
      this.stats.sessionsEnded++
      this.stats.activeSessionsCount = this.activeSessions.size
      this.stats.totalSessionTime += session.duration
      this.stats.averageSessionDuration = this.stats.totalSessionTime / this.stats.sessionsEnded

      // 紀錄逾時會話
      if (reason === 'timeout') {
        this.stats.timeoutExpiredSessions++
      }

      // 觸發會話結束事件
      if (this.eventBus) {
        await this.eventBus.emit('MESSAGING.SESSION.ENDED', {
          sessionId,
          reason,
          duration: session.duration,
          messageCount: session.messageCount,
          timestamp: Date.now(),
          activeSessionsCount: this.stats.activeSessionsCount
        })
      }

      this.logger.log(`✅ 會話結束成功: ${sessionId}`)

      return {
        success: true,
        sessionId,
        message: 'Session ended successfully',
        sessionSummary: {
          duration: session.duration,
          messageCount: session.messageCount,
          endReason: reason
        }
      }
    } catch (error) {
      this.logger.error(`❌ 結束會話失敗: ${sessionId}`, error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 更新會話活動
   */
  updateSessionActivity (sessionId, messageType = null) {
    const session = this.activeSessions.get(sessionId)
    if (session) {
      session.lastActivity = Date.now()
      session.messageCount++

      if (messageType) {
        if (!session.messageTypes) {
          session.messageTypes = {}
        }
        session.messageTypes[messageType] = (session.messageTypes[messageType] || 0) + 1
      }

      // 重新設定逾時
      this.setSessionTimeout(sessionId)
    }
  }

  /**
   * 處理 Popup 訊息
   */
  async handlePopupMessage (data) {
    const { message, sessionId } = data

    if (sessionId) {
      this.updateSessionActivity(sessionId, message.type)
    }

    // 這裡可以添加更多會話相關的訊息處理邏輯
  }

  /**
   * 結束所有活動會話
   */
  async terminateAllSessions (reason = 'system_shutdown') {
    this.logger.log('📝 結束所有活動會話')

    const sessionIds = Array.from(this.activeSessions.keys())

    for (const sessionId of sessionIds) {
      try {
        await this.endSession(sessionId, reason)
      } catch (error) {
        this.logger.error(`❌ 結束會話失敗: ${sessionId}`, error)
      }
    }

    this.logger.log(`✅ 已結束 ${sessionIds.length} 個會話`)
  }

  /**
   * 設定會話逾時
   */
  setSessionTimeout (sessionId) {
    // 清除既有逾時
    this.clearSessionTimeout(sessionId)

    // 設定新的逾時
    const timeoutId = setTimeout(async () => {
      this.logger.warn(`⚠️ 會話逾時: ${sessionId}`)
      await this.endSession(sessionId, 'timeout')
    }, TIMEOUTS.DEFAULT_MESSAGE_TIMEOUT * 2) // 會話逾時時間為訊息逾時的兩倍

    this.sessionTimeouts.set(sessionId, timeoutId)
  }

  /**
   * 清除會話逾時
   */
  clearSessionTimeout (sessionId) {
    const timeoutId = this.sessionTimeouts.get(sessionId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      this.sessionTimeouts.delete(sessionId)
    }
  }

  /**
   * 啟動會話清理監控
   */
  startSessionCleanupMonitoring () {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval)
    }

    this.sessionCleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions()
    }, 60000) // 每分鐘檢查一次

    this.logger.log('🔄 會話清理監控已啟動')
  }

  /**
   * 停止會話清理監控
   */
  stopSessionCleanupMonitoring () {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval)
      this.sessionCleanupInterval = null
    }

    this.logger.log('🔄 會話清理監控已停止')
  }

  /**
   * 清理非活動會話
   */
  cleanupInactiveSessions () {
    const now = Date.now()
    const inactiveThreshold = TIMEOUTS.DEFAULT_MESSAGE_TIMEOUT * 3 // 3倍訊息逾時時間

    for (const [sessionId, session] of this.activeSessions) {
      const timeSinceLastActivity = now - session.lastActivity

      if (timeSinceLastActivity > inactiveThreshold) {
        this.logger.warn(`⚠️ 清理非活動會話: ${sessionId}`)
        this.endSession(sessionId, 'inactivity_cleanup')
      }
    }
  }

  /**
   * 載入會話歷史
   */
  async loadSessionHistory () {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get(['messaging_sessions'])

        if (stored.messaging_sessions) {
          this.sessionHistory = stored.messaging_sessions
            .slice(-LIMITS.MAX_SESSION_HISTORY)

          this.logger.log(`📚 載入了 ${this.sessionHistory.length} 個會話歷史記錄`)
        }
      } else {
        this.logger.warn('⚠️ Chrome storage API 不可用，跳過會話歷史載入')
      }
    } catch (error) {
      this.logger.error('❌ 載入會話歷史失敗:', error)
    }
  }

  /**
   * 保存會話歷史
   */
  async saveSessionHistory () {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          messaging_sessions: this.sessionHistory.slice(-LIMITS.MAX_SESSION_HISTORY)
        })

        this.logger.log(`💾 保存了 ${this.sessionHistory.length} 個會話歷史記錄`)
      } else {
        this.logger.warn('⚠️ Chrome storage API 不可用，無法保存會話歷史')
      }
    } catch (error) {
      this.logger.error('❌ 保存會話歷史失敗:', error)
    }
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    // 會話管理服務通常不直接監聽事件，而是被其他服務調用
    this.logger.log('✅ 會話管理服務事件監聽器註冊完成')
  }

  /**
   * 取消註冊事件監聽器
   */
  async unregisterEventListeners () {
    this.registeredListeners.clear()
    this.logger.log('✅ 會話管理服務事件監聽器已取消註冊')
  }

  /**
   * 獲取會話狀態
   */
  getSessionState (sessionId = null) {
    if (sessionId) {
      return this.activeSessions.get(sessionId) || null
    }

    return {
      activeSessions: Array.from(this.activeSessions.values()),
      sessionHistory: this.sessionHistory.slice(-10),
      activeCount: this.activeSessions.size
    }
  }

  /**
   * 獲取會話統計
   */
  getSessionStatistics () {
    return {
      ...this.stats,
      activeSessions: this.activeSessions.size,
      recentSessions: this.sessionHistory.slice(-5).map(session => ({
        id: session.id,
        duration: session.duration,
        messageCount: session.messageCount,
        endReason: session.endReason,
        endedAt: session.endedAt
      }))
    }
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      activeSessions: this.activeSessions.size,
      totalSessionsCreated: this.stats.sessionsCreated,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const isHealthy = this.state.initialized &&
                     this.state.active &&
                     this.stats.activeSessionsCount >= 0 // 可以為0

    return {
      service: 'SessionManagementService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      metrics: {
        activeSessions: this.stats.activeSessionsCount,
        totalSessions: this.stats.sessionsCreated,
        averageSessionDuration: Math.round(this.stats.averageSessionDuration),
        maxConcurrentSessions: this.stats.maxConcurrentSessions,
        timeoutExpiredSessions: this.stats.timeoutExpiredSessions
      }
    }
  }

  /**
   * 獲取會話指標
   */
  getMetrics () {
    return {
      ...this.stats,
      currentActiveSessions: this.activeSessions.size,
      sessionHistoryCount: this.sessionHistory.length
    }
  }
}

module.exports = SessionManagementService
