/**
 * 生命週期管理服務
 *
 * 負責功能：
 * - 系統狀態載入和保存
 * - 服務生命週期協調 (初始化、啟動、停止)
 * - 事件監聽器註冊和管理
 * - 系統啟動和關閉檢查
 *
 * 設計考量：
 * - 統一的生命週期管理介面
 * - 狀態持久化和恢復機制
 * - 完整的錯誤處理和恢復
 * - 事件監聽器生命週期管理
 *
 * 使用情境：
 * - System Domain 生命週期協調
 * - 與其他微服務的啟動順序管理
 * - 系統狀態的統一管理
 */

const {
  SYSTEM_EVENTS,
  LIFECYCLE_EVENTS,
  STORAGE_KEYS,
  DEFAULT_CONFIG
} = require('../../constants/module-constants')

class LifecycleManagementService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 生命週期狀態
    this.state = {
      initialized: false,
      active: false,
      startupTime: null,
      shutdownRequested: false
    }

    // 系統狀態管理
    this.systemState = {
      installationInfo: null,
      currentVersion: null,
      lastStartupTime: null,
      maintenanceMode: false,
      configuration: { ...DEFAULT_CONFIG }
    }

    // 事件監聽器記錄
    this.registeredListeners = new Map()

    // 統計資料
    this.stats = {
      startupAttempts: 0,
      shutdownAttempts: 0,
      stateLoadAttempts: 0,
      stateSaveAttempts: 0
    }
  }

  /**
   * 初始化生命週期管理服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 生命週期管理服務已初始化')
      return
    }

    try {
      this.logger.log('🔄 初始化生命週期管理服務')

      // 載入系統狀態
      await this.loadSystemState()

      // 註冊事件監聽器
      await this.registerEventListeners()

      this.state.initialized = true
      this.logger.log('✅ 生命週期管理服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.LIFECYCLE.INITIALIZED', {
          serviceName: 'LifecycleManagementService',
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('❌ 初始化生命週期管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動生命週期管理服務
   */
  async start () {
    if (!this.state.initialized) {
      throw new Error('服務尚未初始化')
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 生命週期管理服務已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動生命週期管理服務')
      this.stats.startupAttempts++

      // 執行啟動檢查
      await this.performStartupChecks()

      this.state.active = true
      this.state.startupTime = Date.now()
      this.systemState.lastStartupTime = this.state.startupTime

      // 保存狀態
      await this.saveSystemState()

      this.logger.log('✅ 生命週期管理服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.LIFECYCLE.STARTED', {
          serviceName: 'LifecycleManagementService',
          startupTime: this.state.startupTime
        })
      }
    } catch (error) {
      this.logger.error('❌ 啟動生命週期管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止生命週期管理服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('⚠️ 生命週期管理服務未啟動')
      return
    }

    try {
      this.logger.log('🛑 停止生命週期管理服務')
      this.stats.shutdownAttempts++
      this.state.shutdownRequested = true

      // 執行關閉檢查
      await this.performShutdownChecks()

      // 保存最終狀態
      await this.saveSystemState()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.logger.log('✅ 生命週期管理服務停止完成')

      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('SYSTEM.LIFECYCLE.STOPPED', {
          serviceName: 'LifecycleManagementService',
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('❌ 停止生命週期管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 載入系統狀態
   */
  async loadSystemState () {
    this.stats.stateLoadAttempts++

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get([
          STORAGE_KEYS.SYSTEM_STATE,
          STORAGE_KEYS.INSTALLATION_INFO,
          STORAGE_KEYS.SYSTEM_CONFIG
        ])

        // 載入系統狀態
        if (result[STORAGE_KEYS.SYSTEM_STATE]) {
          this.systemState = { ...this.systemState, ...result[STORAGE_KEYS.SYSTEM_STATE] }
        }

        // 載入安裝資訊
        if (result[STORAGE_KEYS.INSTALLATION_INFO]) {
          this.systemState.installationInfo = result[STORAGE_KEYS.INSTALLATION_INFO]
        }

        // 載入配置
        if (result[STORAGE_KEYS.SYSTEM_CONFIG]) {
          this.systemState.configuration = { ...DEFAULT_CONFIG, ...result[STORAGE_KEYS.SYSTEM_CONFIG] }
        }

        this.logger.log('✅ 系統狀態載入完成')
      } else {
        this.logger.warn('⚠️ Chrome storage API 不可用，使用預設狀態')
      }
    } catch (error) {
      this.logger.error('❌ 載入系統狀態失敗:', error)
      // 使用預設狀態，不拋出錯誤
    }
  }

  /**
   * 保存系統狀態
   */
  async saveSystemState () {
    this.stats.stateSaveAttempts++

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stateToSave = {
          [STORAGE_KEYS.SYSTEM_STATE]: {
            currentVersion: this.systemState.currentVersion,
            lastStartupTime: this.systemState.lastStartupTime,
            maintenanceMode: this.systemState.maintenanceMode
          },
          [STORAGE_KEYS.INSTALLATION_INFO]: this.systemState.installationInfo,
          [STORAGE_KEYS.SYSTEM_CONFIG]: this.systemState.configuration
        }

        await chrome.storage.local.set(stateToSave)
        this.logger.log('✅ 系統狀態保存完成')
      } else {
        this.logger.warn('⚠️ Chrome storage API 不可用，無法保存狀態')
      }
    } catch (error) {
      this.logger.error('❌ 保存系統狀態失敗:', error)
      throw error
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
        event: LIFECYCLE_EVENTS.STARTUP_REQUESTED,
        handler: this.handleStartupRequest.bind(this),
        priority: 1
      },
      {
        event: LIFECYCLE_EVENTS.SHUTDOWN_REQUESTED,
        handler: this.handleShutdownRequest.bind(this),
        priority: 1
      },
      {
        event: SYSTEM_EVENTS.STATE_SAVE_REQUESTED,
        handler: this.handleStateSaveRequest.bind(this),
        priority: 2
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
   * 執行啟動檢查
   */
  async performStartupChecks () {
    // 檢查系統狀態
    if (this.systemState.maintenanceMode) {
      this.logger.warn('⚠️ 系統處於維護模式')
    }

    // 檢查配置完整性
    if (!this.systemState.configuration) {
      this.logger.warn('⚠️ 系統配置不完整，使用預設配置')
      this.systemState.configuration = { ...DEFAULT_CONFIG }
    }

    this.logger.log('✅ 啟動檢查完成')
  }

  /**
   * 執行關閉檢查
   */
  async performShutdownChecks () {
    // 檢查是否有未完成的操作
    if (this.state.shutdownRequested) {
      this.logger.log('🔄 執行正常關閉流程')
    }

    this.logger.log('✅ 關閉檢查完成')
  }

  /**
   * 處理啟動請求
   */
  async handleStartupRequest (event) {
    try {
      this.logger.log('🔄 處理啟動請求')
      if (!this.state.active) {
        await this.start()
      }
    } catch (error) {
      this.logger.error('❌ 處理啟動請求失敗:', error)
    }
  }

  /**
   * 處理關閉請求
   */
  async handleShutdownRequest (event) {
    try {
      this.logger.log('🔄 處理關閉請求')
      if (this.state.active) {
        await this.stop()
      }
    } catch (error) {
      this.logger.error('❌ 處理關閉請求失敗:', error)
    }
  }

  /**
   * 處理狀態保存請求
   */
  async handleStateSaveRequest (event) {
    try {
      await this.saveSystemState()
    } catch (error) {
      this.logger.error('❌ 處理狀態保存請求失敗:', error)
    }
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      startupTime: this.state.startupTime,
      systemState: { ...this.systemState },
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const isHealthy = this.state.initialized &&
                     !this.systemState.maintenanceMode &&
                     this.stats.stateLoadAttempts > 0

    return {
      service: 'LifecycleManagementService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      uptime: this.state.startupTime ? Date.now() - this.state.startupTime : 0,
      metrics: {
        startupAttempts: this.stats.startupAttempts,
        shutdownAttempts: this.stats.shutdownAttempts,
        stateOperations: this.stats.stateLoadAttempts + this.stats.stateSaveAttempts
      }
    }
  }
}

module.exports = LifecycleManagementService
