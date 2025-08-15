/**
 * 通訊領域協調器
 *
 * 負責功能：
 * - 統籌所有通訊領域微服務的初始化和協調
 * - 管理跨上下文通訊的整體架構
 * - 提供統一的通訊領域對外接口
 * - 處理通訊微服務間的事件路由和協調
 *
 * 設計考量：
 * - 通訊服務的編排和生命週期管理
 * - 訊息路由的故障隔離和降級處理
 * - 統一的錯誤處理和恢復機制
 * - 可擴展的通訊微服務架構
 *
 * 使用情境：
 * - 取代原有的 MessagingDomainHandler
 * - 作為 Background 通訊系統的統一入口
 * - 通訊微服務架構的協調中心
 */

const MessageRoutingService = require('./services/message-routing-service')
const SessionManagementService = require('./services/session-management-service')
const ConnectionMonitoringService = require('./services/connection-monitoring-service')
const MessageValidationService = require('./services/message-validation-service')
const QueueManagementService = require('./services/queue-management-service')

const {
  MESSAGE_EVENTS,
  SYSTEM_EVENTS,
  EVENT_PRIORITIES,
  TIMEOUTS
} = require('../constants/module-constants')

class MessagingDomainCoordinator {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 協調器狀態
    this.state = {
      initialized: false,
      active: false,
      servicesReady: false
    }

    // 微服務管理
    this.services = new Map()
    this.serviceStates = new Map()
    this.serviceDependencies = new Map()
    this.registeredListeners = new Map()

    // 初始化微服務
    this.initializeServices(dependencies)

    // 設定服務依賴關係
    this.setupServiceDependencies()

    // 統計資料
    this.stats = {
      servicesManaged: this.services.size,
      eventsHandled: 0,
      restartAttempts: 0,
      healthChecks: 0,
      messagesRouted: 0,
      sessionsManaged: 0
    }
  }

  /**
   * 初始化所有微服務
   */
  initializeServices (dependencies) {
    // 創建微服務實例
    this.services.set('routing', new MessageRoutingService(dependencies))
    this.services.set('session', new SessionManagementService(dependencies))
    this.services.set('connection', new ConnectionMonitoringService(dependencies))
    this.services.set('validation', new MessageValidationService(dependencies))
    this.services.set('queue', new QueueManagementService(dependencies))

    // 初始化服務狀態
    for (const serviceName of this.services.keys()) {
      this.serviceStates.set(serviceName, {
        initialized: false,
        active: false,
        healthy: true,
        lastCheck: 0,
        restartCount: 0
      })
    }

    this.logger.log(`🏗️ 初始化了 ${this.services.size} 個通訊微服務`)
  }

  /**
   * 設定服務依賴關係
   */
  setupServiceDependencies () {
    // 定義服務啟動順序和依賴關係
    this.serviceDependencies.set('validation', []) // 無依賴，優先啟動
    this.serviceDependencies.set('queue', ['validation']) // 依賴驗證服務
    this.serviceDependencies.set('connection', ['validation']) // 依賴驗證服務
    this.serviceDependencies.set('session', ['validation', 'connection']) // 依賴驗證和連接監控
    this.serviceDependencies.set('routing', ['validation', 'queue', 'connection', 'session']) // 依賴所有其他服務
  }

  /**
   * 初始化通訊領域協調器
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 通訊領域協調器已初始化')
      return
    }

    try {
      this.logger.log('💬 初始化通訊領域協調器')

      // 按依賴順序初始化微服務
      await this.initializeServicesInOrder()

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 設定服務間通訊
      await this.setupServiceCommunication()

      this.state.initialized = true
      this.logger.log('✅ 通訊領域協調器初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('MESSAGING.COORDINATOR.INITIALIZED', {
          serviceName: 'MessagingDomainCoordinator',
          servicesCount: this.services.size,
          servicesReady: Array.from(this.services.keys())
        }, EVENT_PRIORITIES.NORMAL)
      }
    } catch (error) {
      this.logger.error('❌ 初始化通訊領域協調器失敗:', error)
      throw error
    }
  }

  /**
   * 啟動通訊領域協調器
   */
  async start () {
    if (!this.state.initialized) {
      throw new Error('協調器尚未初始化')
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 通訊領域協調器已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動通訊領域協調器')

      // 按依賴順序啟動微服務
      await this.startServicesInOrder()

      // 執行通訊系統就緒檢查
      await this.performReadinessCheck()

      this.state.active = true
      this.state.servicesReady = true

      this.logger.log('✅ 通訊領域協調器啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('MESSAGING.COORDINATOR.STARTED', {
          serviceName: 'MessagingDomainCoordinator',
          servicesActive: this.getActiveServicesCount()
        }, EVENT_PRIORITIES.NORMAL)
      }
    } catch (error) {
      this.logger.error('❌ 啟動通訊領域協調器失敗:', error)
      throw error
    }
  }

  /**
   * 停止通訊領域協調器
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('⚠️ 通訊領域協調器未啟動')
      return
    }

    try {
      this.logger.log('🛑 停止通訊領域協調器')

      // 反序停止微服務
      await this.stopServicesInReverseOrder()

      // 生成最終狀態報告
      const finalReport = this.generateFinalReport()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.state.servicesReady = false

      this.logger.log('✅ 通訊領域協調器停止完成')

      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('MESSAGING.COORDINATOR.STOPPED', {
          serviceName: 'MessagingDomainCoordinator',
          finalReport
        }, EVENT_PRIORITIES.NORMAL)
      }
    } catch (error) {
      this.logger.error('❌ 停止通訊領域協調器失敗:', error)
      throw error
    }
  }

  /**
   * 按依賴順序初始化微服務
   */
  async initializeServicesInOrder () {
    const initializationOrder = this.calculateInitializationOrder()

    for (const serviceName of initializationOrder) {
      try {
        this.logger.log(`🔄 初始化通訊服務: ${serviceName}`)

        const service = this.services.get(serviceName)
        await service.initialize()

        this.serviceStates.get(serviceName).initialized = true
        this.logger.log(`✅ 通訊服務初始化完成: ${serviceName}`)
      } catch (error) {
        this.logger.error(`❌ 通訊服務初始化失敗: ${serviceName}`, error)
        throw new Error(`微服務 ${serviceName} 初始化失敗: ${error.message}`)
      }
    }

    this.logger.log('✅ 所有通訊微服務初始化完成')
  }

  /**
   * 按依賴順序啟動微服務
   */
  async startServicesInOrder () {
    const startOrder = this.calculateInitializationOrder()

    for (const serviceName of startOrder) {
      try {
        this.logger.log(`🚀 啟動通訊服務: ${serviceName}`)

        const service = this.services.get(serviceName)
        await service.start()

        this.serviceStates.get(serviceName).active = true
        this.logger.log(`✅ 通訊服務啟動完成: ${serviceName}`)
      } catch (error) {
        this.logger.error(`❌ 通訊服務啟動失敗: ${serviceName}`, error)
        // 嘗試優雅降級
        await this.handleServiceStartupFailure(serviceName, error)
      }
    }

    this.logger.log('✅ 所有通訊微服務啟動完成')
  }

  /**
   * 反序停止微服務
   */
  async stopServicesInReverseOrder () {
    const stopOrder = this.calculateInitializationOrder().reverse()

    for (const serviceName of stopOrder) {
      try {
        this.logger.log(`🛑 停止通訊服務: ${serviceName}`)

        const service = this.services.get(serviceName)
        await service.stop()

        this.serviceStates.get(serviceName).active = false
        this.logger.log(`✅ 通訊服務停止完成: ${serviceName}`)
      } catch (error) {
        this.logger.error(`❌ 通訊服務停止失敗: ${serviceName}`, error)
        // 繼續停止其他服務
      }
    }

    this.logger.log('✅ 所有通訊微服務停止完成')
  }

  /**
   * 計算初始化順序
   */
  calculateInitializationOrder () {
    const visited = new Set()
    const order = []

    const visit = (serviceName) => {
      if (visited.has(serviceName)) return

      visited.add(serviceName)

      // 先處理依賴
      const dependencies = this.serviceDependencies.get(serviceName) || []
      for (const dep of dependencies) {
        visit(dep)
      }

      order.push(serviceName)
    }

    // 訪問所有服務
    for (const serviceName of this.services.keys()) {
      visit(serviceName)
    }

    return order
  }

  /**
   * 執行就緒檢查
   */
  async performReadinessCheck () {
    this.logger.log('🔍 執行通訊系統就緒檢查')

    const issues = []

    // 檢查所有服務狀態
    for (const [serviceName, service] of this.services) {
      try {
        const healthStatus = service.getHealthStatus()

        if (!healthStatus.healthy) {
          issues.push(`通訊服務 ${serviceName} 狀態不健康`)
        }

        this.serviceStates.get(serviceName).healthy = healthStatus.healthy
      } catch (error) {
        issues.push(`無法獲取通訊服務 ${serviceName} 健康狀態: ${error.message}`)
      }
    }

    if (issues.length > 0) {
      this.logger.warn('⚠️ 通訊系統就緒檢查發現問題:', issues)
    } else {
      this.logger.log('✅ 通訊系統就緒檢查通過')
    }

    return { ready: issues.length === 0, issues }
  }

  /**
   * 處理服務啟動失敗
   */
  async handleServiceStartupFailure (serviceName, error) {
    this.logger.error(`💥 通訊服務啟動失敗處理: ${serviceName}`, error)

    const serviceState = this.serviceStates.get(serviceName)
    serviceState.restartCount++
    this.stats.restartAttempts++

    // 如果重試次數未超限，嘗試重啟
    if (serviceState.restartCount < 3) {
      this.logger.log(`🔄 嘗試重啟通訊服務: ${serviceName} (第 ${serviceState.restartCount} 次)`)

      try {
        const service = this.services.get(serviceName)
        await service.start()

        serviceState.active = true
        this.logger.log(`✅ 通訊服務重啟成功: ${serviceName}`)
      } catch (retryError) {
        this.logger.error(`❌ 通訊服務重啟失敗: ${serviceName}`, retryError)
      }
    } else {
      this.logger.error(`🚫 通訊服務 ${serviceName} 重試次數超限，標記為失敗`)
      serviceState.healthy = false
    }
  }

  /**
   * 設定服務間通訊
   */
  async setupServiceCommunication () {
    // 設定通訊服務間的事件路由和協調
    this.logger.log('🔗 設定通訊服務間通訊')

    // 路由服務與其他服務的協調
    const routingService = this.services.get('routing')
    if (routingService) {
      // 設定與驗證服務的協調
      routingService.setValidationService(this.services.get('validation'))

      // 設定與佇列服務的協調
      routingService.setQueueService(this.services.get('queue'))

      // 設定與會話服務的協調
      routingService.setSessionService(this.services.get('session'))

      // 設定與連接監控服務的協調
      routingService.setConnectionService(this.services.get('connection'))
    }
  }

  /**
   * 生成最終報告
   */
  generateFinalReport () {
    const serviceReports = {}

    for (const [serviceName, service] of this.services) {
      try {
        serviceReports[serviceName] = {
          status: service.getStatus(),
          health: service.getHealthStatus()
        }
      } catch (error) {
        serviceReports[serviceName] = {
          error: error.message
        }
      }
    }

    return {
      timestamp: Date.now(),
      coordinator: {
        initialized: this.state.initialized,
        active: this.state.active,
        servicesReady: this.state.servicesReady
      },
      services: serviceReports,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取活躍服務數量
   */
  getActiveServicesCount () {
    return Array.from(this.serviceStates.values())
      .filter(state => state.active).length
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
        event: MESSAGE_EVENTS.RECEIVED,
        handler: this.handleMessageReceived.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: MESSAGE_EVENTS.CONTENT_MESSAGE_RECEIVED,
        handler: this.handleContentMessage.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      },
      {
        event: MESSAGE_EVENTS.POPUP_MESSAGE_RECEIVED,
        handler: this.handlePopupMessage.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: SYSTEM_EVENTS.SHUTDOWN,
        handler: this.handleSystemShutdown.bind(this),
        priority: EVENT_PRIORITIES.URGENT
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
   * 處理訊息接收事件
   */
  async handleMessageReceived (event) {
    try {
      this.stats.eventsHandled++
      this.stats.messagesRouted++

      const routingService = this.services.get('routing')
      if (routingService) {
        await routingService.handleMessage(event.data)
      }
    } catch (error) {
      this.logger.error('❌ 處理訊息接收事件失敗:', error)
    }
  }

  /**
   * 處理 Content Script 訊息
   */
  async handleContentMessage (event) {
    try {
      this.stats.eventsHandled++

      const routingService = this.services.get('routing')
      if (routingService) {
        await routingService.handleContentMessage(event.data)
      }
    } catch (error) {
      this.logger.error('❌ 處理 Content Script 訊息失敗:', error)
    }
  }

  /**
   * 處理 Popup 訊息
   */
  async handlePopupMessage (event) {
    try {
      this.stats.eventsHandled++

      const sessionService = this.services.get('session')
      if (sessionService) {
        this.stats.sessionsManaged++
        await sessionService.handlePopupMessage(event.data)
      }

      const routingService = this.services.get('routing')
      if (routingService) {
        await routingService.handlePopupMessage(event.data)
      }
    } catch (error) {
      this.logger.error('❌ 處理 Popup 訊息失敗:', error)
    }
  }

  /**
   * 處理系統關閉事件
   */
  async handleSystemShutdown (event) {
    try {
      this.logger.log('🔄 處理系統關閉事件')
      if (this.state.active) {
        await this.stop()
      }
    } catch (error) {
      this.logger.error('❌ 處理系統關閉事件失敗:', error)
    }
  }

  /**
   * 路由訊息到適當的服務
   */
  async routeMessage (message, context) {
    const routingService = this.services.get('routing')
    if (routingService) {
      return await routingService.routeMessage(message, context)
    } else {
      throw new Error('路由服務不可用')
    }
  }

  /**
   * 獲取指定服務
   */
  getService (serviceName) {
    return this.services.get(serviceName)
  }

  /**
   * 獲取所有服務狀態
   */
  getAllServiceStates () {
    const states = {}
    for (const [serviceName, state] of this.serviceStates) {
      states[serviceName] = { ...state }
    }
    return states
  }

  /**
   * 獲取協調器狀態
   */
  getStatus () {
    return {
      coordinator: {
        initialized: this.state.initialized,
        active: this.state.active,
        servicesReady: this.state.servicesReady
      },
      services: this.getAllServiceStates(),
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const activeServices = this.getActiveServicesCount()
    const totalServices = this.services.size

    return {
      service: 'MessagingDomainCoordinator',
      healthy: this.state.initialized && this.state.active && activeServices === totalServices,
      status: this.state.active ? 'active' : 'inactive',
      servicesActive: `${activeServices}/${totalServices}`,
      metrics: {
        servicesManaged: this.stats.servicesManaged,
        eventsHandled: this.stats.eventsHandled,
        restartAttempts: this.stats.restartAttempts,
        healthChecks: this.stats.healthChecks,
        messagesRouted: this.stats.messagesRouted,
        sessionsManaged: this.stats.sessionsManaged
      }
    }
  }

  /**
   * 獲取通訊指標
   */
  getCommunicationMetrics () {
    const routingService = this.services.get('routing')
    const sessionService = this.services.get('session')
    const connectionService = this.services.get('connection')
    const queueService = this.services.get('queue')

    return {
      routing: routingService ? routingService.getMetrics() : null,
      sessions: sessionService ? sessionService.getMetrics() : null,
      connections: connectionService ? connectionService.getMetrics() : null,
      queues: queueService ? queueService.getMetrics() : null
    }
  }
}

module.exports = MessagingDomainCoordinator
