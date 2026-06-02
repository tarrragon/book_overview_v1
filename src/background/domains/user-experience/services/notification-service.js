/**
 * 通知管理服務
 *
 * 負責功能：
 * - 統一的通知顯示管理和協調
 * - 通知優先級處理和去重邏輯
 * - 通知歷史記錄和狀態追蹤
 * - 用戶通知偏好的遵循和執行
 *
 * 設計考量：
 * - 支援多種通知類型（成功、警告、錯誤、資訊）
 * - 通知優先級和去重機制
 * - 通知持續時間和自動關閉
 * - 通知偏好設定的即時生效
 *
 * 處理流程：
 * 1. 檢查用戶通知偏好
 * 2. 驗證和處理通知優先級
 * 3. 執行去重和顯示邏輯
 * 4. 記錄通知歷史和統計
 *
 * 使用情境：
 * - Popup 操作結果通知
 * - 系統狀態變更通知
 * - 錯誤和警告提示
 * - 成功操作確認
 */

const ErrorCodes = require('../../../../core/errors/ErrorCodes')
const { COLORS } = require('../../../../core/design-system/colors.js')

class NotificationService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null

    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: 通知管理服務統一處理用戶界面通知顯示和優先級協調
    // 執行環境: Service Worker 初始化階段，依賴注入可能不完整
    // 後備機制: console 確保模組生命週期錯誤能被追蹤
    // 風險考量: 理想上應確保 Logger 完整可用，此為過渡性保護
    this.logger = dependencies.logger || console
    this.preferenceService = dependencies.preferenceService || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false
    }

    // 通知管理
    this.activeNotifications = new Map()
    this.notificationHistory = []
    this.notificationQueue = []
    this.notificationTimers = new Map()

    // 通知配置
    this.notificationTypes = {
      info: {
        icon: '[INFO] ',
        color: COLORS.primary,
        priority: 1,
        defaultDuration: 5000
      },
      success: {
        icon: '[OK] ',
        color: COLORS.success,
        priority: 2,
        defaultDuration: 3000
      },
      warning: {
        icon: '[WARN] ',
        color: COLORS.warning,
        priority: 3,
        defaultDuration: 7000
      },
      error: {
        icon: '[FAIL] ',
        color: COLORS.error,
        priority: 4,
        defaultDuration: 10000
      }
    }

    // 通知去重配置
    this.deduplicationWindow = 30000 // 30秒內相同通知視為重複
    this.maxActiveNotifications = 5
    this.maxQueueSize = 20

    // 通知統計
    this.stats = {
      notificationsShown: 0,
      notificationsDismissed: 0,
      notificationsDuplicated: 0,
      notificationsQueued: 0,
      notificationsByType: {
        info: 0,
        success: 0,
        warning: 0,
        error: 0
      }
    }
  }

  /**
   * 初始化通知管理服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('[WARN] 通知管理服務已初始化')
      return
    }

    try {
      this.logger.log('初始化通知管理服務')

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 初始化通知清理機制
      await this.initializeNotificationCleanup()

      this.state.initialized = true
      this.logger.log('[OK] 通知管理服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.NOTIFICATION.SERVICE.INITIALIZED', {
          serviceName: 'NotificationService',
          supportedTypes: Object.keys(this.notificationTypes)
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 初始化通知管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動通知管理服務
   */
  async start () {
    if (!this.state.initialized) {
      const error = new Error('通知管理服務尚未初始化')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = { category: 'general' }
      throw error
    }

    if (this.state.active) {
      this.logger.warn('[WARN] 通知管理服務已啟動')
      return
    }

    try {
      this.logger.log('[START] 啟動通知管理服務')

      // 處理隊列中的通知
      await this.processNotificationQueue()

      this.state.active = true
      this.logger.log('[OK] 通知管理服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.NOTIFICATION.SERVICE.STARTED', {
          serviceName: 'NotificationService',
          ready: true
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 啟動通知管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 顯示通知
   */
  async showNotification (notification) {
    this.logger.log(`顯示通知: ${notification.type}`)

    try {
      // 檢查用戶通知偏好
      const notificationsEnabled = await this.checkNotificationPreferences()
      if (!notificationsEnabled) {
        return { shown: false, reason: 'notifications_disabled' }
      }

      // 驗證通知格式
      const validatedNotification = await this.validateNotification(notification)

      // 檢查是否為重複通知
      if (await this.isDuplicateNotification(validatedNotification)) {
        this.stats.notificationsDuplicated++
        return { shown: false, reason: 'duplicate' }
      }

      // 處理通知優先級
      const processedNotification = await this.processNotificationPriority(validatedNotification)

      // 檢查活躍通知數量限制
      if (this.activeNotifications.size >= this.maxActiveNotifications) {
        await this.queueNotification(processedNotification)
        return { shown: false, reason: 'queued' }
      }

      // 顯示通知
      const result = await this.displayNotification(processedNotification)

      // 記錄通知歷史
      this.recordNotificationHistory(processedNotification, result)

      // 統計
      this.stats.notificationsShown++
      this.stats.notificationsByType[processedNotification.type]++

      // 發送通知顯示事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.NOTIFICATION.SHOWN', {
          notification: processedNotification,
          result,
          timestamp: Date.now()
        })
      }

      this.logger.log(`[OK] 通知顯示完成: ${processedNotification.id}`)
      return result
    } catch (error) {
      this.logger.error('[FAIL] 顯示通知失敗:', error)
      return { shown: false, reason: 'error', error: error.message }
    }
  }

  /**
   * 清除通知
   */
  async clearNotification (notificationId) {
    this.logger.log(`清除通知: ${notificationId}`)

    try {
      if (this.activeNotifications.has(notificationId)) {
        const notification = this.activeNotifications.get(notificationId)

        // 清除定時器
        if (this.notificationTimers.has(notificationId)) {
          clearTimeout(this.notificationTimers.get(notificationId))
          this.notificationTimers.delete(notificationId)
        }

        // 移除活躍通知
        this.activeNotifications.delete(notificationId)

        // 統計
        this.stats.notificationsDismissed++

        // 處理隊列中的通知
        await this.processNextQueuedNotification()

        // 發送通知清除事件
        if (this.eventBus) {
          await this.eventBus.emit('UX.NOTIFICATION.CLEARED', {
            notificationId,
            notification,
            timestamp: Date.now()
          })
        }

        this.logger.log(`[OK] 通知清除完成: ${notificationId}`)
        return { cleared: true, notificationId }
      } else {
        this.logger.warn(`[WARN] 通知不存在: ${notificationId}`)
        return { cleared: false, reason: 'not_found' }
      }
    } catch (error) {
      this.logger.error(`[FAIL] 清除通知失敗: ${notificationId}`, error)
      return { cleared: false, reason: 'error', error: error.message }
    }
  }

  /**
   * 清除所有通知
   */
  async clearAllNotifications () {
    this.logger.log('清除所有通知')

    try {
      const clearedCount = this.activeNotifications.size

      // 清除所有定時器
      for (const timerId of this.notificationTimers.values()) {
        clearTimeout(timerId)
      }
      this.notificationTimers.clear()

      // 清除所有活躍通知
      this.activeNotifications.clear()

      // 清空隊列
      this.notificationQueue = []

      // 發送清除所有通知事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.NOTIFICATION.ALL_CLEARED', {
          clearedCount,
          timestamp: Date.now()
        })
      }

      this.logger.log(`[OK] 清除所有通知完成 (${clearedCount} 個)`)
      return { cleared: true, count: clearedCount }
    } catch (error) {
      this.logger.error('[FAIL] 清除所有通知失敗:', error)
      return { cleared: false, reason: 'error', error: error.message }
    }
  }

  /**
   * 獲取通知歷史
   */
  getNotificationHistory (filter = {}) {
    let history = [...this.notificationHistory]

    // 按類型過濾
    if (filter.type) {
      history = history.filter(entry => entry.notification.type === filter.type)
    }

    // 按時間範圍過濾
    if (filter.startTime) {
      history = history.filter(entry => entry.timestamp >= filter.startTime)
    }

    if (filter.endTime) {
      history = history.filter(entry => entry.timestamp <= filter.endTime)
    }

    // 限制數量
    if (filter.limit) {
      history = history.slice(-filter.limit)
    }

    return history
  }

  /**
   * 檢查通知偏好設定
   */
  async checkNotificationPreferences () {
    try {
      if (this.preferenceService) {
        const enabled = await this.preferenceService.getPreference('notification.enabled', true)
        return enabled
      }

      // 預設啟用通知
      return true
    } catch (error) {
      this.logger.error('[FAIL] 檢查通知偏好失敗:', error)
      return true
    }
  }

  /**
   * 驗證通知格式
   */
  async validateNotification (notification) {
    // 生成通知 ID
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 驗證必要欄位
    if (!notification.type || !this.notificationTypes[notification.type]) {
      const error = new Error(`無效的通知類型: ${notification.type}`)
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'general' }
      throw error
    }

    if (!notification.title && !notification.message) {
      const error = new Error('通知必須包含標題或訊息')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'general' }
      throw error
    }

    // 標準化通知結構
    const validatedNotification = {
      id,
      type: notification.type,
      title: notification.title || '',
      message: notification.message || '',
      icon: notification.icon || this.notificationTypes[notification.type].icon,
      duration: notification.duration || this.notificationTypes[notification.type].defaultDuration,
      priority: this.notificationTypes[notification.type].priority,
      timestamp: Date.now(),
      metadata: notification.metadata || {}
    }

    return validatedNotification
  }

  /**
   * 檢查是否為重複通知
   */
  async isDuplicateNotification (notification) {
    const currentTime = Date.now()
    const windowStart = currentTime - this.deduplicationWindow

    // 檢查歷史記錄中是否有相同的通知
    const duplicates = this.notificationHistory.filter(entry => {
      return entry.timestamp >= windowStart &&
             entry.notification.type === notification.type &&
             entry.notification.title === notification.title &&
             entry.notification.message === notification.message
    })

    return duplicates.length > 0
  }

  /**
   * 處理通知優先級
   */
  async processNotificationPriority (notification) {
    // 根據優先級調整顯示行為
    if (notification.priority >= 4) { // 錯誤級別
      // 錯誤通知不自動關閉
      notification.duration = 0
    } else if (notification.priority >= 3) { // 警告級別
      // 警告通知延長顯示時間
      notification.duration = Math.max(notification.duration, 7000)
    }

    return notification
  }

  /**
   * 顯示通知
   */
  async displayNotification (notification) {
    try {
      // 添加到活躍通知
      this.activeNotifications.set(notification.id, notification)

      // 設定自動關閉定時器
      if (notification.duration > 0) {
        const timerId = setTimeout(async () => {
          await this.clearNotification(notification.id)
        }, notification.duration)

        this.notificationTimers.set(notification.id, timerId)
      }

      // 這裡可以整合具體的通知顯示邏輯
      // 例如：Chrome Extension 通知、Popup 通知等
      await this.renderNotification(notification)

      return {
        shown: true,
        id: notification.id,
        type: notification.type,
        duration: notification.duration
      }
    } catch (error) {
      this.logger.error(`[FAIL] 顯示通知失敗: ${notification.id}`, error)
      throw error
    }
  }

  /**
   * 渲染通知
   */
  async renderNotification (notification) {
    // 發送渲染事件供 UI 組件處理
    if (this.eventBus) {
      await this.eventBus.emit('UX.NOTIFICATION.RENDER', {
        notification,
        timestamp: Date.now()
      })
    }

    this.logger.log(`渲染通知: ${notification.type} - ${notification.title}`)
  }

  /**
   * 將通知加入隊列
   */
  async queueNotification (notification) {
    if (this.notificationQueue.length >= this.maxQueueSize) {
      // 移除最舊的通知
      this.notificationQueue.shift()
      this.logger.warn('[WARN] 通知隊列已滿，移除最舊通知')
    }

    this.notificationQueue.push(notification)
    this.stats.notificationsQueued++

    this.logger.log(`通知已加入隊列: ${notification.id}`)

    // 發送隊列更新事件
    if (this.eventBus) {
      await this.eventBus.emit('UX.NOTIFICATION.QUEUE.UPDATED', {
        queueSize: this.notificationQueue.length,
        notification,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 處理隊列中的下一個通知
   */
  async processNextQueuedNotification () {
    if (this.notificationQueue.length > 0 && this.activeNotifications.size < this.maxActiveNotifications) {
      const nextNotification = this.notificationQueue.shift()

      this.logger.log(`處理隊列通知: ${nextNotification.id}`)

      // 重新顯示通知
      await this.displayNotification(nextNotification)
    }
  }

  /**
   * 處理通知隊列
   */
  async processNotificationQueue () {
    while (this.notificationQueue.length > 0 && this.activeNotifications.size < this.maxActiveNotifications) {
      await this.processNextQueuedNotification()
    }
  }

  /**
   * 記錄通知歷史
   */
  recordNotificationHistory (notification, result) {
    const historyEntry = {
      notification: { ...notification },
      result: { ...result },
      timestamp: Date.now()
    }

    this.notificationHistory.push(historyEntry)

    // 限制歷史記錄數量
    if (this.notificationHistory.length > 1000) {
      this.notificationHistory = this.notificationHistory.slice(-500)
    }
  }

  /**
   * 初始化通知清理機制
   */
  async initializeNotificationCleanup () {
    // 設定定期清理過期通知的機制
    setInterval(() => {
      this.cleanupExpiredNotifications()
    }, 60000) // 每分鐘檢查一次

    this.logger.log('[OK] 通知清理機制初始化完成')
  }

  /**
   * 清理過期通知
   */
  cleanupExpiredNotifications () {
    const currentTime = Date.now()
    const expiredNotifications = []

    for (const [id, notification] of this.activeNotifications) {
      // 檢查是否超過最大存活時間
      const maxAge = 300000 // 5分鐘
      if (currentTime - notification.timestamp > maxAge) {
        expiredNotifications.push(id)
      }
    }

    // 清理過期通知
    for (const id of expiredNotifications) {
      this.clearNotification(id)
    }

    if (expiredNotifications.length > 0) {
      this.logger.log(`清理了 ${expiredNotifications.length} 個過期通知`)
    }
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('[WARN] EventBus 不可用，跳過通知事件監聽器註冊')
      return
    }

    // 監聽顯示通知請求
    await this.eventBus.on('UX.NOTIFICATION.SHOW.REQUEST', async (event) => {
      const { notification } = event.data || {}
      if (notification) {
        await this.showNotification(notification)
      }
    })

    // 監聽清除通知請求
    await this.eventBus.on('UX.NOTIFICATION.CLEAR.REQUEST', async (event) => {
      const { notificationId } = event.data || {}
      if (notificationId) {
        await this.clearNotification(notificationId)
      }
    })

    // 監聽清除所有通知請求
    await this.eventBus.on('UX.NOTIFICATION.CLEAR_ALL.REQUEST', async (event) => {
      await this.clearAllNotifications()
    })

    this.logger.log('[OK] 通知事件監聽器註冊完成')
  }

  /**
   * 獲取活躍通知
   */
  getActiveNotifications () {
    const notifications = []
    for (const notification of this.activeNotifications.values()) {
      notifications.push({ ...notification })
    }
    return notifications
  }

  /**
   * 獲取通知統計
   */
  getNotificationStats () {
    return {
      ...this.stats,
      activeCount: this.activeNotifications.size,
      queuedCount: this.notificationQueue.length,
      historyCount: this.notificationHistory.length,
      typesSupported: Object.keys(this.notificationTypes).length
    }
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      service: 'NotificationService',
      initialized: this.state.initialized,
      active: this.state.active,
      activeNotifications: this.activeNotifications.size,
      queuedNotifications: this.notificationQueue.length,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    return {
      service: 'NotificationService',
      healthy: this.state.initialized && this.state.active,
      status: this.state.active ? 'active' : 'inactive',
      metrics: {
        activeNotifications: this.activeNotifications.size,
        queuedNotifications: this.notificationQueue.length,
        totalShown: this.stats.notificationsShown,
        totalDismissed: this.stats.notificationsDismissed,
        duplicatesFiltered: this.stats.notificationsDuplicated,
        queueUsage: `${this.notificationQueue.length}/${this.maxQueueSize}`,
        activeUsage: `${this.activeNotifications.size}/${this.maxActiveNotifications}`
      }
    }
  }
}

module.exports = NotificationService
