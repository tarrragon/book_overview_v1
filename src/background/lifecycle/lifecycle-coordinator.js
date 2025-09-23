/**
 * Service Worker 生命週期協調器
 *
 * 負責功能：
 * - 管理 Chrome Extension 的安裝、啟動、關閉生命週期
 * - 協調系統初始化的順序和依賴關係
 * - 提供生命週期事件的統一管理介面
 * - 處理生命週期過程中的錯誤和恢復
 *
 * 設計考量：
 * - 基於 BaseModule 實現標準生命週期管理
 * - 使用依賴注入支援可測試性
 * - 實現事件驅動的生命週期通知
 * - 提供完整的錯誤處理和狀態追蹤
 */

const BaseModule = require('./base-module')

class LifecycleCoordinator extends BaseModule {
  constructor (dependencies = {}) {
    super(dependencies)

    // 生命週期處理器引用
    this.installHandler = dependencies.installHandler || null
    this.startupHandler = dependencies.startupHandler || null
    this.shutdownHandler = dependencies.shutdownHandler || null

    // 生命週期狀態
    this.lifecycleState = 'not_installed'
    this.lastInstallReason = null
    this.installationHistory = []
    this.startupCount = 0

    // Chrome API 監聽器註冊狀態
    this.chromeListenersRegistered = false
  }

  /**
   * 初始化生命週期協調器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    this.logger.log('🔄 初始化 Service Worker 生命週期協調器')

    // 初始化處理器
    if (this.installHandler && typeof this.installHandler.initialize === 'function') {
      await this.installHandler.initialize()
    }

    if (this.startupHandler && typeof this.startupHandler.initialize === 'function') {
      await this.startupHandler.initialize()
    }

    if (this.shutdownHandler && typeof this.shutdownHandler.initialize === 'function') {
      await this.shutdownHandler.initialize()
    }

    this.logger.log('✅ 生命週期協調器初始化完成')
  }

  /**
   * 啟動生命週期協調器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStart () {
    this.logger.log('▶️ 啟動生命週期協調器')

    // 註冊 Chrome Extension 生命週期監聽器
    await this.registerChromeLifecycleListeners()

    // 檢查當前狀態
    await this.checkCurrentLifecycleState()

    this.logger.log('✅ 生命週期協調器啟動完成')
  }

  /**
   * 停止生命週期協調器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStop () {
    this.logger.log('⏹️ 停止生命週期協調器')

    // 取消註冊 Chrome Extension 生命週期監聽器
    this.unregisterChromeLifecycleListeners()

    this.logger.log('✅ 生命週期協調器停止完成')
  }

  /**
   * 清理生命週期協調器
   * @returns {Promise<void>}
   * @protected
   */
  async _doCleanup () {
    this.logger.log('🧹 清理生命週期協調器')

    // 清理心跳機制和狀態檢查
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
      this.logger.log('💓 Service Worker 心跳機制已停止')
    }

    if (this.stateCheckInterval) {
      clearInterval(this.stateCheckInterval)
      this.stateCheckInterval = null
      this.logger.log('🔍 定期狀態檢查已停止')
    }

    // 清理處理器
    if (this.installHandler && typeof this.installHandler.cleanup === 'function') {
      await this.installHandler.cleanup()
    }

    if (this.startupHandler && typeof this.startupHandler.cleanup === 'function') {
      await this.startupHandler.cleanup()
    }

    if (this.shutdownHandler && typeof this.shutdownHandler.cleanup === 'function') {
      await this.shutdownHandler.cleanup()
    }

    // 重置狀態
    this.lifecycleState = 'not_installed'
    this.lastInstallReason = null
    this.installationHistory = []
    this.startupCount = 0
    this.chromeListenersRegistered = false

    this.logger.log('✅ 生命週期協調器清理完成')
  }

  /**
   * 註冊 Chrome Extension 生命週期監聽器
   * @returns {Promise<void>}
   */
  async registerChromeLifecycleListeners () {
    if (this.chromeListenersRegistered) {
      this.logger.warn('⚠️ Chrome 生命週期監聽器已註冊')
      return
    }

    try {
      // 擴展安裝監聽器
      chrome.runtime.onInstalled.addListener(async (details) => {
        await this.handleInstallEvent(details)
      })

      // Service Worker 啟動監聽器
      chrome.runtime.onStartup.addListener(async () => {
        await this.handleStartupEvent()
      })

      // Manifest V3 Service Worker 生命週期管理
      // 使用 beforeunload 和 visibilitychange 替代 onSuspend
      this.setupServiceWorkerLifecycleManagement()

      this.chromeListenersRegistered = true
      this.logger.log('✅ Chrome Extension 生命週期監聽器註冊完成 (Manifest V3)')

      // 觸發監聽器註冊事件
      if (this.eventBus) {
        await this.eventBus.emit('LIFECYCLE.LISTENERS.REGISTERED', {
          timestamp: Date.now(),
          coordinator: this.moduleId,
          manifestVersion: 3
        })
      }
    } catch (error) {
      this.logger.error('❌ Chrome 生命週期監聽器註冊失敗:', error)
      throw error
    }
  }

  /**
   * 設置 Manifest V3 Service Worker 生命週期管理
   * 替代已棄用的 chrome.runtime.onSuspend
   */
  setupServiceWorkerLifecycleManagement () {
    // Manifest V3 Service Worker 生命週期處理策略
    // 1. 使用 chrome.runtime.onSuspend 的替代方案
    // 2. 監聽擴展卸載和重新載入事件
    // 3. 實現優雅關閉機制

    // 監聽擴展上下文失效事件
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      // 設置定期心跳檢查，確保 Service Worker 存活
      this.setupServiceWorkerHeartbeat()

      // 監聽連接斷開事件（當擴展被禁用或卸載時）
      chrome.runtime.onConnect.addListener((port) => {
        port.onDisconnect.addListener(() => {
          this.handleServiceWorkerDisconnect()
        })
      })

      // 監聽 runtime 訊息以檢測擴展狀態變化
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'EXTENSION_RELOAD') {
          this.handleServiceWorkerReload()
        }
      })

      // 設置定期狀態檢查以替代 onSuspend
      this.setupPeriodicStateCheck()

      this.logger.log('✅ Manifest V3 Service Worker 生命週期管理已設置')
    }
  }

  /**
   * 設置 Service Worker 心跳機制
   * 確保 Service Worker 在閒置時不會被暫停
   */
  setupServiceWorkerHeartbeat () {
    // 每 20 秒發送一次心跳
    this.heartbeatInterval = setInterval(() => {
      if (this.eventBus) {
        this.eventBus.emit('LIFECYCLE.HEARTBEAT', {
          timestamp: Date.now(),
          state: this.lifecycleState
        })
      }
    }, 20000)

    this.logger.log('💓 Service Worker 心跳機制已啟動')
  }

  /**
   * 設置定期狀態檢查以替代 onSuspend
   * 監控 Service Worker 狀態變化
   */
  setupPeriodicStateCheck () {
    // 每 30 秒檢查一次擴展狀態
    this.stateCheckInterval = setInterval(async () => {
      try {
        // 檢查 runtime 是否仍然有效
        if (chrome.runtime && chrome.runtime.id) {
          // 檢查擴展是否仍在運行
          const manifest = chrome.runtime.getManifest()
          if (!manifest) {
            // 擴展可能正在關閉
            await this.handleServiceWorkerSuspend()
          }
        } else {
          // Runtime 已失效，擴展正在關閉
          await this.handleServiceWorkerSuspend()
        }
      } catch (error) {
        // Chrome API 調用失敗，可能擴展正在關閉
        this.logger.warn('⚠️ 狀態檢查失敗，可能擴展正在關閉:', error.message)
        await this.handleServiceWorkerSuspend()
      }
    }, 30000)

    this.logger.log('🔍 定期狀態檢查已啟動')
  }

  /**
   * 處理 Service Worker 暫停事件 (替代 onSuspend)
   */
  async handleServiceWorkerSuspend () {
    try {
      this.logger.log('⏸️ 處理 Service Worker 暫停事件')

      // 更新狀態
      this.lifecycleState = 'suspending'

      // 觸發暫停事件
      if (this.eventBus) {
        await this.eventBus.emit('LIFECYCLE.SUSPENDING', {
          timestamp: Date.now(),
          reason: 'service_worker_suspend'
        })
      }

      // 委派給關閉處理器
      if (this.shutdownHandler && typeof this.shutdownHandler.handleShutdown === 'function') {
        await this.shutdownHandler.handleShutdown({ reason: 'suspend' })
      }

      // 清理資源
      this.cleanupBeforeSuspend()

      this.logger.log('✅ Service Worker 暫停事件處理完成')
    } catch (error) {
      this.logger.error('❌ 處理 Service Worker 暫停事件失敗:', error)
    }
  }

  /**
   * 在暫停前清理資源
   */
  cleanupBeforeSuspend () {
    // 停止心跳和狀態檢查
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.stateCheckInterval) {
      clearInterval(this.stateCheckInterval)
      this.stateCheckInterval = null
    }

    this.logger.log('🧹 暫停前資源清理完成')
  }

  /**
   * 處理 Service Worker 連接斷開事件
   */
  async handleServiceWorkerDisconnect () {
    try {
      this.logger.log('🔌 處理 Service Worker 連接斷開事件')

      // 更新狀態
      this.lifecycleState = 'disconnected'

      // 觸發斷開事件
      if (this.eventBus) {
        await this.eventBus.emit('LIFECYCLE.DISCONNECTED', {
          timestamp: Date.now(),
          reason: 'service_worker_disconnect'
        })
      }

      // 委派給關閉處理器
      if (this.shutdownHandler && typeof this.shutdownHandler.handleShutdown === 'function') {
        await this.shutdownHandler.handleShutdown({ reason: 'disconnect' })
      }

      this.logger.log('✅ Service Worker 斷開事件處理完成')
    } catch (error) {
      this.logger.error('❌ 處理 Service Worker 斷開事件失敗:', error)
    }
  }

  /**
   * 處理 Service Worker 重新載入事件
   */
  async handleServiceWorkerReload () {
    try {
      this.logger.log('🔄 處理 Service Worker 重新載入事件')

      // 更新狀態
      this.lifecycleState = 'reloading'

      // 觸發重新載入事件
      if (this.eventBus) {
        await this.eventBus.emit('LIFECYCLE.RELOADING', {
          timestamp: Date.now(),
          reason: 'extension_reload'
        })
      }

      // 清理當前資源
      this.cleanupBeforeSuspend()

      // 重新初始化生命週期管理
      await this.registerChromeLifecycleListeners()
      await this.checkCurrentLifecycleState()

      this.logger.log('✅ Service Worker 重新載入事件處理完成')
    } catch (error) {
      this.logger.error('❌ 處理 Service Worker 重新載入事件失敗:', error)
    }
  }

  /**
   * 取消註冊 Chrome Extension 生命週期監聽器
   */
  unregisterChromeLifecycleListeners () {
    // Chrome Extension API 不提供直接取消註冊的方法
    // 這裡主要是標記狀態
    this.chromeListenersRegistered = false
    this.logger.log('✅ Chrome Extension 生命週期監聽器標記為已取消註冊')
  }

  /**
   * 處理擴展安裝事件
   * @param {Object} details - Chrome Extension 安裝詳情
   */
  async handleInstallEvent (details) {
    try {
      this.logger.log('📦 處理擴展安裝事件:', details)

      // 更新狀態
      this.lifecycleState = 'installed'
      this.lastInstallReason = details.reason
      this.installationHistory.push({
        reason: details.reason,
        previousVersion: details.previousVersion || null,
        timestamp: Date.now()
      })

      // 觸發安裝事件
      if (this.eventBus) {
        await this.eventBus.emit('LIFECYCLE.INSTALLED', {
          reason: details.reason,
          previousVersion: details.previousVersion,
          currentVersion: chrome.runtime.getManifest().version,
          timestamp: Date.now()
        })
      }

      // 委派給安裝處理器
      if (this.installHandler && typeof this.installHandler.handleInstall === 'function') {
        await this.installHandler.handleInstall(details)
      }

      this.logger.log('✅ 擴展安裝事件處理完成')
    } catch (error) {
      this.logger.error('❌ 處理擴展安裝事件失敗:', error)

      // 觸發安裝失敗事件
      if (this.eventBus) {
        await this.eventBus.emit('LIFECYCLE.INSTALL.FAILED', {
          reason: details.reason,
          error: error.message,
          timestamp: Date.now()
        })
      }

      throw error
    }
  }

  /**
   * 處理 Service Worker 啟動事件
   */
  async handleStartupEvent () {
    try {
      this.logger.log('🔄 處理 Service Worker 啟動事件')

      // 更新狀態
      this.lifecycleState = 'running'
      this.startupCount++

      // 觸發啟動事件
      if (this.eventBus) {
        await this.eventBus.emit('LIFECYCLE.STARTUP', {
          startupCount: this.startupCount,
          timestamp: Date.now()
        })
      }

      // 委派給啟動處理器
      if (this.startupHandler && typeof this.startupHandler.handleStartup === 'function') {
        await this.startupHandler.handleStartup()
      }

      this.logger.log('✅ Service Worker 啟動事件處理完成')
    } catch (error) {
      this.logger.error('❌ 處理 Service Worker 啟動事件失敗:', error)

      // 觸發啟動失敗事件
      if (this.eventBus) {
        await this.eventBus.emit('LIFECYCLE.STARTUP.FAILED', {
          error: error.message,
          timestamp: Date.now()
        })
      }

      throw error
    }
  }

  /**
   * 檢查當前生命週期狀態
   * @returns {Promise<void>}
   */
  async checkCurrentLifecycleState () {
    try {
      // 檢查擴展是否已安裝
      const manifest = chrome.runtime.getManifest()
      if (manifest) {
        this.lifecycleState = 'running'
        this.logger.log(`📋 當前擴展版本: ${manifest.version}`)
      }

      // 觸發狀態檢查事件
      if (this.eventBus) {
        await this.eventBus.emit('LIFECYCLE.STATE.CHECKED', {
          state: this.lifecycleState,
          version: manifest?.version,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('❌ 檢查生命週期狀態失敗:', error)
    }
  }

  /**
   * 取得生命週期狀態資訊
   * @returns {Object} 生命週期狀態報告
   */
  getLifecycleStatus () {
    return {
      state: this.lifecycleState,
      lastInstallReason: this.lastInstallReason,
      startupCount: this.startupCount,
      installationHistory: [...this.installationHistory],
      chromeListenersRegistered: this.chromeListenersRegistered,
      timestamp: Date.now()
    }
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    const hasHandlers = !!(this.installHandler || this.startupHandler || this.shutdownHandler)

    return {
      lifecycleState: this.lifecycleState,
      chromeListenersRegistered: this.chromeListenersRegistered,
      hasHandlers,
      startupCount: this.startupCount,
      health: hasHandlers && this.chromeListenersRegistered ? 'healthy' : 'degraded'
    }
  }
}

module.exports = LifecycleCoordinator
