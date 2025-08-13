/**
 * 頁面領域協調器
 * 
 * 負責功能：
 * - 統籌所有頁面領域微服務的初始化和協調
 * - 管理頁面檢測、內容腳本協調、權限管理等微服務
 * - 提供統一的頁面領域對外接口
 * - 處理微服務間的事件路由和協調
 * 
 * 設計考量：
 * - 取代原有的 PageDomainHandler
 * - 微服務編排和生命週期管理
 * - 故障隔離和降級處理
 * - 可擴展的微服務架構
 */

const PageDetectionService = require('./services/page-detection-service')
const ContentScriptCoordinatorService = require('./services/content-script-coordinator-service')
const TabStateTrackingService = require('./services/tab-state-tracking-service')
const PermissionManagementService = require('./services/permission-management-service')
const NavigationService = require('./services/navigation-service')

const {
  PAGE_EVENTS,
  EVENT_PRIORITIES
} = require('../constants/module-constants')

class PageDomainCoordinator {
  constructor(dependencies = {}) {
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
    this.registeredListeners = new Map()
    
    // 初始化微服務
    this.initializeServices(dependencies)
    
    // 統計資料
    this.stats = {
      servicesManaged: this.services.size,
      eventsHandled: 0,
      pageDetections: 0,
      contentScriptCoordinations: 0
    }
  }

  /**
   * 初始化所有微服務
   */
  initializeServices(dependencies) {
    // 創建微服務實例
    this.services.set('pageDetection', new PageDetectionService(dependencies))
    this.services.set('contentScriptCoordinator', new ContentScriptCoordinatorService(dependencies))
    this.services.set('tabStateTracking', new TabStateTrackingService(dependencies))
    this.services.set('permissionManagement', new PermissionManagementService(dependencies))
    this.services.set('navigation', new NavigationService(dependencies))
    
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
    
    this.logger.log(`🏗️ Page Domain 初始化了 ${this.services.size} 個微服務`)
  }

  /**
   * 初始化頁面領域協調器
   */
  async initialize() {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 頁面領域協調器已初始化')
      return
    }

    try {
      this.logger.log('🎯 初始化頁面領域協調器')
      
      // 初始化微服務
      for (const [serviceName, service] of this.services) {
        try {
          await service.initialize()
          this.serviceStates.get(serviceName).initialized = true
          this.logger.log(`✅ ${serviceName} 初始化完成`)
        } catch (error) {
          this.logger.error(`❌ ${serviceName} 初始化失敗:`, error)
          throw error
        }
      }
      
      // 註冊事件監聽器
      await this.registerEventListeners()
      
      this.state.initialized = true
      this.logger.log('✅ 頁面領域協調器初始化完成')
      
      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.COORDINATOR.INITIALIZED', {
          serviceName: 'PageDomainCoordinator',
          servicesCount: this.services.size
        })
      }
    } catch (error) {
      this.logger.error('❌ 初始化頁面領域協調器失敗:', error)
      throw error
    }
  }

  /**
   * 啟動頁面領域協調器
   */
  async start() {
    if (!this.state.initialized) {
      throw new Error('協調器尚未初始化')
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 頁面領域協調器已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動頁面領域協調器')
      
      // 啟動微服務
      for (const [serviceName, service] of this.services) {
        try {
          await service.start()
          this.serviceStates.get(serviceName).active = true
          this.logger.log(`✅ ${serviceName} 啟動完成`)
        } catch (error) {
          this.logger.error(`❌ ${serviceName} 啟動失敗:`, error)
        }
      }
      
      this.state.active = true
      this.state.servicesReady = true
      
      this.logger.log('✅ 頁面領域協調器啟動完成')
      
      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.COORDINATOR.STARTED', {
          serviceName: 'PageDomainCoordinator'
        })
      }
    } catch (error) {
      this.logger.error('❌ 啟動頁面領域協調器失敗:', error)
      throw error
    }
  }

  /**
   * 停止頁面領域協調器
   */
  async stop() {
    if (!this.state.active) {
      this.logger.warn('⚠️ 頁面領域協調器未啟動')
      return
    }

    try {
      this.logger.log('🛑 停止頁面領域協調器')
      
      // 停止微服務
      for (const [serviceName, service] of this.services) {
        try {
          await service.stop()
          this.serviceStates.get(serviceName).active = false
          this.logger.log(`✅ ${serviceName} 停止完成`)
        } catch (error) {
          this.logger.error(`❌ ${serviceName} 停止失敗:`, error)
        }
      }
      
      // 取消註冊事件監聽器
      await this.unregisterEventListeners()
      
      this.state.active = false
      this.state.servicesReady = false
      
      this.logger.log('✅ 頁面領域協調器停止完成')
      
      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.COORDINATOR.STOPPED', {
          serviceName: 'PageDomainCoordinator'
        })
      }
    } catch (error) {
      this.logger.error('❌ 停止頁面領域協調器失敗:', error)
      throw error
    }
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners() {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 不可用，跳過事件監聽器註冊')
      return
    }

    const listeners = [
      {
        event: PAGE_EVENTS.DETECTED,
        handler: this.handlePageDetected.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: PAGE_EVENTS.NAVIGATION_CHANGED,
        handler: this.handlePageNavigationChanged.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: PAGE_EVENTS.CONTENT_READY,
        handler: this.handleContentScriptReady.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      },
      {
        event: 'PAGE.TAB.ACTIVATED',
        handler: this.handleTabActivated.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      },
      {
        event: 'PAGE.PERMISSION.CHANGED',
        handler: this.handlePermissionChanged.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      }
    ]

    for (const { event, handler, priority } of listeners) {
      const listenerId = await this.eventBus.on(event, handler, { priority })
      this.registeredListeners.set(event, listenerId)
    }

    this.logger.log(`✅ Page Domain 註冊了 ${listeners.length} 個事件監聽器`)
  }

  /**
   * 取消註冊事件監聽器
   */
  async unregisterEventListeners() {
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
   * 處理頁面檢測事件
   */
  async handlePageDetected(event) {
    try {
      this.stats.eventsHandled++
      this.stats.pageDetections++
      
      const { url, title, tabId, pageType } = event.data || {}
      
      this.logger.log(`🔍 檢測到頁面: ${pageType} (${url})`)
      
      // 協調其他微服務的響應
      // 內容腳本服務會自動處理腳本注入
      // 分頁狀態服務會記錄頁面變化
      // 權限服務會檢查所需權限
      
    } catch (error) {
      this.logger.error('❌ 處理 Readmoo 頁面檢測事件失敗:', error)
    }
  }

  /**
   * 處理頁面導航變更事件
   */
  async handlePageNavigationChanged(event) {
    try {
      this.stats.eventsHandled++
      
      const { url, tabId } = event.data || {}
      this.logger.log(`🧭 頁面導航變更: ${url}`)
      
      // 觸發重新檢測
      const detectionService = this.services.get('pageDetection')
      if (detectionService) {
        await detectionService.detectPageType(url, '', tabId)
      }
      
    } catch (error) {
      this.logger.error('❌ 處理頁面導航變更事件失敗:', error)
    }
  }

  /**
   * 處理內容腳本就緒事件
   */
  async handleContentScriptReady(event) {
    try {
      this.stats.eventsHandled++
      this.stats.contentScriptCoordinations++
      
      const { tabId, url } = event.data || {}
      this.logger.log(`📜 內容腳本就緒: ${url}`)
      
    } catch (error) {
      this.logger.error('❌ 處理內容腳本就緒事件失敗:', error)
    }
  }

  /**
   * 處理分頁啟動事件
   */
  async handleTabActivated(event) {
    try {
      this.stats.eventsHandled++
      
      const { tabId, windowId } = event.data || {}
      this.logger.log(`🔄 分頁啟動: ${tabId}`)
      
      // 可以在此觸發相關的頁面檢測或狀態更新
      
    } catch (error) {
      this.logger.error('❌ 處理分頁啟動事件失敗:', error)
    }
  }

  /**
   * 處理權限變更事件
   */
  async handlePermissionChanged(event) {
    try {
      this.stats.eventsHandled++
      
      const { type, permissions } = event.data || {}
      this.logger.log(`🔐 權限變更: ${type}`, permissions)
      
      // 根據權限變更調整服務行為
      
    } catch (error) {
      this.logger.error('❌ 處理權限變更事件失敗:', error)
    }
  }

  /**
   * 獲取指定服務
   */
  getService(serviceName) {
    return this.services.get(serviceName)
  }

  /**
   * 獲取所有服務狀態
   */
  getAllServiceStates() {
    const states = {}
    for (const [serviceName, state] of this.serviceStates) {
      states[serviceName] = { ...state }
    }
    return states
  }

  /**
   * 獲取協調器狀態
   */
  getStatus() {
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
  getHealthStatus() {
    const activeServices = Array.from(this.serviceStates.values())
      .filter(state => state.active).length
    const totalServices = this.services.size
    
    return {
      service: 'PageDomainCoordinator',
      healthy: this.state.initialized && this.state.active && activeServices === totalServices,
      status: this.state.active ? 'active' : 'inactive',
      servicesActive: `${activeServices}/${totalServices}`,
      metrics: {
        servicesManaged: this.stats.servicesManaged,
        eventsHandled: this.stats.eventsHandled,
        pageDetections: this.stats.pageDetections,
        contentScriptCoordinations: this.stats.contentScriptCoordinations
      }
    }
  }
}

module.exports = PageDomainCoordinator