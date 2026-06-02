/**
 * 系統領域協調器
 *
 * 負責功能：
 * - 統籌所有系統領域微服務的初始化和協調
 * - 管理微服務間的依賴關係和啟動順序
 * - 提供統一的系統領域對外接口
 * - 處理微服務間的事件路由和協調
 *
 * 設計考量：
 * - 微服務編排和生命週期管理
 * - 故障隔離和降級處理
 * - 統一的錯誤處理和恢復機制
 * - 可擴展的微服務架構
 *
 * 使用情境：
 * - 取代原有的 SystemDomainHandler
 * - 作為 Background 系統的統一入口
 * - 微服務架構的協調中心
 */

const LifecycleManagementService = require('./services/lifecycle-management-service')
const ConfigManagementService = require('./services/config-management-service')
const VersionControlService = require('./services/version-control-service')
const HealthMonitoringService = require('./services/health-monitoring-service')
const DiagnosticService = require('./services/diagnostic-service')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

const {
  SYSTEM_EVENTS,
  EVENT_PRIORITIES
} = require('src/background/constants/module-constants')

class SystemDomainCoordinator {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null

    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: 系統領域協調器統籌生命週期、配置、版本控制和健康監控微服務
    // 執行環境: Service Worker 初始化階段，依賴注入可能不完整
    // 後備機制: console 確保模組生命週期錯誤能被追蹤
    // 風險考量: 理想上應確保 Logger 完整可用，此為過渡性保護
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
      healthChecks: 0
    }
  }

  /**
   * 初始化所有微服務
   */
  initializeServices (dependencies) {
    // 創建微服務實例
    this.services.set('lifecycle', new LifecycleManagementService(dependencies))
    this.services.set('config', new ConfigManagementService(dependencies))
    this.services.set('version', new VersionControlService(dependencies))
    this.services.set('health', new HealthMonitoringService(dependencies))
    this.services.set('diagnostic', new DiagnosticService(dependencies))

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

    this.logger.log(`初始化了 ${this.services.size} 個微服務`)
  }

  /**
   * 設定服務依賴關係
   */
  setupServiceDependencies () {
    // 定義服務啟動順序和依賴關係
    this.serviceDependencies.set('lifecycle', []) // 無依賴，優先啟動
    this.serviceDependencies.set('config', ['lifecycle']) // 依賴生命週期
    this.serviceDependencies.set('version', ['lifecycle', 'config']) // 依賴生命週期和配置
    this.serviceDependencies.set('health', ['lifecycle']) // 依賴生命週期
    this.serviceDependencies.set('diagnostic', ['lifecycle', 'health']) // 依賴生命週期和健康監控
  }

  /**
   * 初始化系統領域協調器
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('[WARN] 系統領域協調器已初始化')
      return
    }

    try {
      this.logger.log('初始化系統領域協調器')

      // 按依賴順序初始化微服務
      await this.initializeServicesInOrder()

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 設定服務間通訊
      await this.setupServiceCommunication()

      this.state.initialized = true
      this.logger.log('[OK] 系統領域協調器初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.COORDINATOR.INITIALIZED', {
          serviceName: 'SystemDomainCoordinator',
          servicesCount: this.services.size,
          servicesReady: Array.from(this.services.keys())
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 初始化系統領域協調器失敗:', error)
      throw error
    }
  }

  /**
   * 啟動系統領域協調器
   */
  async start () {
    if (!this.state.initialized) {
      const error = new Error('協調器尚未初始化')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
        category: 'general'
      }
      throw error
    }

    if (this.state.active) {
      this.logger.warn('[WARN] 系統領域協調器已啟動')
      return
    }

    try {
      this.logger.log('[START] 啟動系統領域協調器')

      // 按依賴順序啟動微服務
      await this.startServicesInOrder()

      // 執行系統就緒檢查
      await this.performReadinessCheck()

      this.state.active = true
      this.state.servicesReady = true

      this.logger.log('[OK] 系統領域協調器啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.COORDINATOR.STARTED', {
          serviceName: 'SystemDomainCoordinator',
          servicesActive: this.getActiveServicesCount()
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 啟動系統領域協調器失敗:', error)
      throw error
    }
  }

  /**
   * 停止系統領域協調器
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('[WARN] 系統領域協調器未啟動')
      return
    }

    try {
      this.logger.log('[STOP] 停止系統領域協調器')

      // 反序停止微服務
      await this.stopServicesInReverseOrder()

      // 生成最終狀態報告
      const finalReport = this.generateFinalReport()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.state.servicesReady = false

      this.logger.log('[OK] 系統領域協調器停止完成')

      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.COORDINATOR.STOPPED', {
          serviceName: 'SystemDomainCoordinator',
          finalReport
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 停止系統領域協調器失敗:', error)
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
        this.logger.log(`初始化服務: ${serviceName}`)

        const service = this.services.get(serviceName)
        await service.initialize()

        this.serviceStates.get(serviceName).initialized = true
        this.logger.log(`[OK] 服務初始化完成: ${serviceName}`)
      } catch (error) {
        this.logger.error(`[FAIL] 服務初始化失敗: ${serviceName}`, error)
        const newError = new Error(`微服務 ${serviceName} 初始化失敗: ${error.message}`)
        newError.code = ErrorCodes.OPERATION_ERROR
        newError.details = {
          category: 'general'
        }
        throw newError
      }
    }

    this.logger.log('[OK] 所有微服務初始化完成')
  }

  /**
   * 按依賴順序啟動微服務
   */
  async startServicesInOrder () {
    const startOrder = this.calculateInitializationOrder()

    for (const serviceName of startOrder) {
      try {
        this.logger.log(`[START] 啟動服務: ${serviceName}`)

        const service = this.services.get(serviceName)
        await service.start()

        this.serviceStates.get(serviceName).active = true
        this.logger.log(`[OK] 服務啟動完成: ${serviceName}`)
      } catch (error) {
        this.logger.error(`[FAIL] 服務啟動失敗: ${serviceName}`, error)
        // 嘗試優雅降級
        await this.handleServiceStartupFailure(serviceName, error)
      }
    }

    this.logger.log('[OK] 所有微服務啟動完成')
  }

  /**
   * 反序停止微服務
   */
  async stopServicesInReverseOrder () {
    const stopOrder = this.calculateInitializationOrder().reverse()

    for (const serviceName of stopOrder) {
      try {
        this.logger.log(`[STOP] 停止服務: ${serviceName}`)

        const service = this.services.get(serviceName)
        await service.stop()

        this.serviceStates.get(serviceName).active = false
        this.logger.log(`[OK] 服務停止完成: ${serviceName}`)
      } catch (error) {
        this.logger.error(`[FAIL] 服務停止失敗: ${serviceName}`, error)
        // 繼續停止其他服務
      }
    }

    this.logger.log('[OK] 所有微服務停止完成')
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
    this.logger.log('[CHECK] 執行系統就緒檢查')

    const issues = []

    // 檢查所有服務狀態
    for (const [serviceName, service] of this.services) {
      try {
        const healthStatus = service.getHealthStatus()

        if (!healthStatus.healthy) {
          issues.push(`服務 ${serviceName} 狀態不健康`)
        }

        this.serviceStates.get(serviceName).healthy = healthStatus.healthy
      } catch (error) {
        issues.push(`無法獲取服務 ${serviceName} 健康狀態: ${error.message}`)
      }
    }

    if (issues.length > 0) {
      this.logger.warn('[WARN] 系統就緒檢查發現問題:', issues)
    } else {
      this.logger.log('[OK] 系統就緒檢查通過')
    }

    return { ready: issues.length === 0, issues }
  }

  /**
   * 處理服務啟動失敗
   */
  async handleServiceStartupFailure (serviceName, error) {
    this.logger.error(`服務啟動失敗處理: ${serviceName}`, error)

    const serviceState = this.serviceStates.get(serviceName)
    serviceState.restartCount++
    this.stats.restartAttempts++

    // 如果重試次數未超限，嘗試重啟
    if (serviceState.restartCount < 3) {
      this.logger.log(`嘗試重啟服務: ${serviceName} (第 ${serviceState.restartCount} 次)`)

      try {
        const service = this.services.get(serviceName)
        await service.start()

        serviceState.active = true
        this.logger.log(`[OK] 服務重啟成功: ${serviceName}`)
      } catch (retryError) {
        this.logger.error(`[FAIL] 服務重啟失敗: ${serviceName}`, retryError)
      }
    } else {
      this.logger.error(`服務 ${serviceName} 重試次數超限，標記為失敗`)
      serviceState.healthy = false
    }
  }

  /**
   * 設定服務間通訊
   */
  async setupServiceCommunication () {
    // 設定服務間的事件路由和通訊
    this.logger.log('設定服務間通訊')
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
      this.logger.warn('[WARN] EventBus 不可用，跳過事件監聽器註冊')
      return
    }

    const listeners = [
      {
        event: SYSTEM_EVENTS.STATUS_REQUEST,
        handler: this.handleStatusRequest.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      },
      {
        event: SYSTEM_EVENTS.RESTART_REQUEST,
        handler: this.handleRestartRequest.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: SYSTEM_EVENTS.HEALTH_CHECK_REQUEST,
        handler: this.handleHealthCheckRequest.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      }
    ]

    for (const { event, handler, priority } of listeners) {
      const listenerId = await this.eventBus.on(event, handler, { priority })
      this.registeredListeners.set(event, listenerId)
    }

    this.logger.log(`[OK] 註冊了 ${listeners.length} 個事件監聽器`)
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
        this.logger.error(`[FAIL] 取消註冊事件監聽器失敗 (${event}):`, error)
      }
    }

    this.registeredListeners.clear()
    this.logger.log('[OK] 所有事件監聽器已取消註冊')
  }

  /**
   * 處理狀態請求
   */
  async handleStatusRequest (event) {
    try {
      this.stats.eventsHandled++

      const status = this.getStatus()

      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.STATUS.RESPONSE', {
          requestId: event.data?.requestId,
          status
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理狀態請求失敗:', error)
    }
  }

  /**
   * 處理重啟請求
   */
  async handleRestartRequest (event) {
    try {
      const { serviceName } = event.data || {}

      if (serviceName && this.services.has(serviceName)) {
        await this.restartService(serviceName)
      } else {
        // 重啟所有服務
        await this.restartAllServices()
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理重啟請求失敗:', error)
    }
  }

  /**
   * 處理健康檢查請求
   */
  async handleHealthCheckRequest (event) {
    try {
      this.stats.healthChecks++

      const healthReport = await this.performHealthCheck()

      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.HEALTH.RESPONSE', {
          requestId: event.data?.requestId,
          healthReport
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理健康檢查請求失敗:', error)
    }
  }

  /**
   * 重啟指定服務
   */
  async restartService (serviceName) {
    this.logger.log(`重啟服務: ${serviceName}`)

    try {
      const service = this.services.get(serviceName)
      await service.stop()
      await service.start()

      const serviceState = this.serviceStates.get(serviceName)
      serviceState.active = true
      serviceState.restartCount++

      this.logger.log(`[OK] 服務重啟完成: ${serviceName}`)
    } catch (error) {
      this.logger.error(`[FAIL] 服務重啟失敗: ${serviceName}`, error)
      throw error
    }
  }

  /**
   * 重啟所有服務
   */
  async restartAllServices () {
    this.logger.log('重啟所有服務')

    await this.stopServicesInReverseOrder()
    await this.startServicesInOrder()

    this.logger.log('[OK] 所有服務重啟完成')
  }

  /**
   * 執行健康檢查
   */
  async performHealthCheck () {
    const healthReport = {
      timestamp: Date.now(),
      coordinator: {
        healthy: this.state.initialized && this.state.active,
        status: this.state.active ? 'active' : 'inactive'
      },
      services: {}
    }

    for (const [serviceName, service] of this.services) {
      try {
        healthReport.services[serviceName] = service.getHealthStatus()
      } catch (error) {
        healthReport.services[serviceName] = {
          healthy: false,
          error: error.message
        }
      }
    }

    return healthReport
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
      service: 'SystemDomainCoordinator',
      healthy: this.state.initialized && this.state.active && activeServices === totalServices,
      status: this.state.active ? 'active' : 'inactive',
      servicesActive: `${activeServices}/${totalServices}`,
      metrics: {
        servicesManaged: this.stats.servicesManaged,
        eventsHandled: this.stats.eventsHandled,
        restartAttempts: this.stats.restartAttempts,
        healthChecks: this.stats.healthChecks
      }
    }
  }
}

module.exports = SystemDomainCoordinator
