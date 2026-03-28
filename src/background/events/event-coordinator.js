/**
 * 事件系統協調器
 *
 * 負責功能：
 * - 管理和協調整個事件系統的初始化和運作
 * - 整合 EventBus 和 ChromeEventBridge 的功能
 * - 提供事件系統的統一管理介面
 * - 協調事件監聽器的註冊和管理
 *
 * 設計考量：
 * - 基於 BaseModule 實現標準生命週期管理
 * - 作為事件系統的中央協調點
 * - 支援事件系統的健康檢查和診斷
 * - 實現事件系統的優雅啟動和關閉
 */

const BaseModule = require('src/background/lifecycle/base-module')
const { SYSTEM_EVENTS, EVENT_PRIORITIES } = require('src/background/constants/module-constants')
const { Logger } = require('src/core/logging/Logger')
const ErrorCodes = require('src/core/errors/ErrorCodes')

class EventCoordinator extends BaseModule {
  constructor (dependencies = {}) {
    super(dependencies)

    // 確保有 logger
    this.logger = this.logger || new Logger('EventCoordinator')

    // 事件系統組件
    this.eventSystemInitializer = dependencies.eventSystemInitializer || null
    this.eventBridgeManager = dependencies.eventBridgeManager || null
    this.listenerRegistry = dependencies.listenerRegistry || null
    this.i18nManager = dependencies.i18nManager || null

    // 事件系統狀態
    this.eventSystemReady = false
    this.eventBusInstance = null
    this.chromeBridgeInstance = null

    // 核心監聽器註冊狀態
    this.coreListenersRegistered = false
    this.registeredListeners = new Map()

    // 事件統計
    this.eventStats = {
      totalEmissions: 0,
      totalHandlers: 0,
      errorCount: 0,
      lastActivity: null
    }
  }

  /**
   * 初始化事件協調器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    if (this.i18nManager) {
      this.logger.log(this.i18nManager.t('events.coordinator.initializing', { moduleName: this.moduleName }))
    } else {
      this.logger.log('🎯 初始化事件系統協調器')
    }

    // 初始化子組件
    await this.initializeSubComponents()

    // 初始化事件系統
    await this.initializeEventSystem()

    this.logger.log('✅ 事件系統協調器初始化完成')
  }

  /**
   * 啟動事件協調器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStart () {
    this.logger.log('▶️ 啟動事件系統協調器')

    // 啟動子組件
    await this.startSubComponents()

    // 註冊核心事件監聽器
    await this.registerCoreListeners()

    // 標記事件系統就緒
    await this.markEventSystemReady()

    this.logger.log('✅ 事件系統協調器啟動完成')
  }

  /**
   * 停止事件協調器
   * @returns {Promise<void>}
   * @protected
   */
  async _doStop () {
    this.logger.log('⏹️ 停止事件系統協調器')

    // 取消註冊核心監聽器
    await this.unregisterCoreListeners()

    // 停止子組件
    await this.stopSubComponents()

    // 重置事件系統狀態
    this.eventSystemReady = false
    this.eventBusInstance = null
    this.chromeBridgeInstance = null

    this.logger.log('✅ 事件系統協調器停止完成')
  }

  /**
   * 初始化子組件
   * @returns {Promise<void>}
   * @private
   */
  async initializeSubComponents () {
    this.logger.log('🔧 初始化事件系統子組件')

    const components = [
      this.eventSystemInitializer,
      this.eventBridgeManager,
      this.listenerRegistry
    ]

    for (const component of components) {
      if (component && typeof component.initialize === 'function') {
        try {
          await component.initialize()
        } catch (error) {
          this.logger.error(`❌ 事件系統子組件初始化失敗: ${component.constructor?.name}`, error)
        }
      }
    }

    this.logger.log('✅ 事件系統子組件初始化完成')
  }

  /**
   * 初始化事件系統
   * @returns {Promise<void>}
   * @private
   */
  async initializeEventSystem () {
    try {
      this.logger.log('📡 開始初始化事件系統')

      // 使用事件系統初始化器
      if (this.eventSystemInitializer) {
        const { eventBus, chromeBridge } = await this.eventSystemInitializer.initialize()
        this.eventBusInstance = eventBus
        this.chromeBridgeInstance = chromeBridge
      } else {
        // 回退到簡化實現
        const { eventBus, chromeBridge } = await this.createSimpleEventSystem()
        this.eventBusInstance = eventBus
        this.chromeBridgeInstance = chromeBridge
      }

      // 檢查EventBus初始化狀態
      if (!this.eventBusInstance) {
        const error = new Error('EventBus 初始化失敗 - 無法建立 EventBus 實例')
        error.code = ErrorCodes.EVENTBUS_ERROR
        error.details = { category: 'general' }
        this.logger.error('BACKGROUND_INIT_FAILED', { error: error.message })
        throw error
      }

      // 設定全域引用
      globalThis.eventBus = this.eventBusInstance
      globalThis.chromeBridge = this.chromeBridgeInstance

      // 在Node.js測試環境中，也要設定global.chromeBridge
      if (typeof global !== 'undefined') {
        global.eventBus = this.eventBusInstance
        global.chromeBridge = this.chromeBridgeInstance
      }

      // 設定事件總線引用（用於基底模組）
      this.eventBus = this.eventBusInstance

      // 設定橋接器的事件總線引用
      if (this.chromeBridgeInstance) {
        this.chromeBridgeInstance.eventBus = this.eventBusInstance
      }

      this.logger.log('✅ 事件系統初始化完成')
      this.logger.log('📊 EventBus 實例:', !!this.eventBusInstance)
      this.logger.log('🌉 ChromeEventBridge 實例:', !!this.chromeBridgeInstance)
    } catch (error) {
      this.logger.error('❌ 事件系統初始化失敗:', error)

      // 提供降級方案
      globalThis.eventBus = null
      globalThis.chromeBridge = null

      // 在Node.js測試環境中，也要清理global變數
      if (typeof global !== 'undefined') {
        global.eventBus = null
        global.chromeBridge = null
      }

      throw error
    }
  }

  /**
   * 建立簡化事件系統（回退方案）
   * @returns {Promise<Object>} 包含 eventBus 和 chromeBridge 的物件
   * @private
   */
  async createSimpleEventSystem () {
    this.logger.log('🔄 建立簡化事件系統')

    // 建立簡化 EventBus
    const eventBus = this.createSimpleEventBus()

    // 檢查EventBus創建是否成功
    if (!eventBus) {
      const error = new Error('EventBus 初始化失敗 - 無法建立 EventBus 實例')
      error.code = ErrorCodes.EVENTBUS_ERROR
      error.details = { category: 'general' }
      this.logger.error('EVENTBUS_INIT_FAILED', { error: error.message })
      throw error
    }

    // 建立簡化 ChromeEventBridge
    const chromeBridge = this.createSimpleChromeEventBridge()

    return { eventBus, chromeBridge }
  }

  /**
   * 建立簡化 EventBus
   * @returns {Object} 簡化的 EventBus 實例
   * @private
   */
  createSimpleEventBus () {
    const listeners = new Map()
    const preInitQueue = []
    let isReady = false

    const stats = {
      totalEvents: 0,
      totalEmissions: 0,
      totalExecutionTime: 0,
      eventStats: new Map()
    }

    return {
      on (eventType, handler, options = {}) {
        if (!listeners.has(eventType)) {
          listeners.set(eventType, [])
        }

        const wrapper = {
          handler,
          priority: options.priority !== undefined ? options.priority : EVENT_PRIORITIES.NORMAL,
          once: options.once || false,
          id: Date.now() + Math.random()
        }

        const eventListeners = listeners.get(eventType)

        // 按優先級插入
        let insertIndex = eventListeners.length
        for (let i = 0; i < eventListeners.length; i++) {
          if (wrapper.priority < eventListeners[i].priority) {
            insertIndex = i
            break
          }
        }

        eventListeners.splice(insertIndex, 0, wrapper)
        return wrapper.id
      },

      off (eventType, handler) {
        if (!listeners.has(eventType)) return false

        const eventListeners = listeners.get(eventType)
        const index = eventListeners.findIndex(wrapper =>
          wrapper.handler === handler || wrapper.id === handler
        )

        if (index !== -1) {
          eventListeners.splice(index, 1)
          return true
        }

        return false
      },

      async emit (eventType, data = {}) {
        const startTime = performance.now()

        try {
          if (!listeners.has(eventType)) {
            if (!isReady) {
              preInitQueue.push({ type: eventType, data })
            }
            return []
          }

          const event = {
            type: eventType,
            data,
            timestamp: Date.now()
          }

          const eventListeners = [...listeners.get(eventType)]
          const results = []
          const toRemove = []

          for (const wrapper of eventListeners) {
            try {
              const result = await wrapper.handler(event)
              results.push({ success: true, result })

              if (wrapper.once) {
                toRemove.push(wrapper)
              }
            } catch (error) {
              this.logger?.error?.(`❌ 事件處理器錯誤 (${eventType}):`, error)
              results.push({ success: false, error })

              if (wrapper.once) {
                toRemove.push(wrapper)
              }
            }
          }

          // 更新統計
          stats.totalEvents++
          stats.totalEmissions++
          stats.totalExecutionTime += performance.now() - startTime

          // 移除一次性監聽器
          if (toRemove.length > 0) {
            const remainingListeners = listeners.get(eventType).filter(wrapper => !toRemove.includes(wrapper))
            if (remainingListeners.length === 0) {
              listeners.delete(eventType)
            } else {
              listeners.set(eventType, remainingListeners)
            }
          }

          return results
        } catch (error) {
          this.logger?.error?.(`❌ 事件觸發失敗 (${eventType}):`, error)
          return [{ success: false, error }]
        }
      },

      getStats () {
        return { ...stats }
      },

      hasListener (eventType) {
        return listeners.has(eventType) && listeners.get(eventType).length > 0
      },

      get listeners () {
        return listeners
      },

      getListenerCount (eventType) {
        if (!listeners.has(eventType)) return 0
        return listeners.get(eventType).length
      },

      markReady () {
        isReady = true
        if (preInitQueue.length === 0) return

        Promise.resolve().then(async () => {
          while (preInitQueue.length > 0) {
            const evt = preInitQueue.shift()
            await this.emit(evt.type, evt.data)
          }
        })
      },

      destroy () {
        listeners.clear()
        stats.eventStats.clear()
        stats.totalEvents = 0
        stats.totalEmissions = 0
        stats.totalExecutionTime = 0
      }
    }
  }

  /**
   * 建立簡化 ChromeEventBridge
   * @returns {Object} 簡化的 ChromeEventBridge 實例
   * @private
   */
  createSimpleChromeEventBridge () {
    let eventBus = null

    return {
      set eventBus (bus) {
        eventBus = bus
      },

      get eventBus () {
        return eventBus
      },

      async sendToContent (tabId, message) {
        try {
          const response = await chrome.tabs.sendMessage(tabId, message)
          return { success: true, response }
        } catch (error) {
          this.logger.error('SEND_MESSAGE_FAILED', { error: error?.message || error })
          return { success: false, error: error.message }
        }
      },

      async sendToPopup (message) {
        return { success: true, message: 'Popup communication not implemented' }
      },

      onMessageFromContent (handler) {
        // 註冊來自 content script 的訊息處理器
        if (chrome.runtime && chrome.runtime.onMessage) {
          chrome.runtime.onMessage.addListener(handler)
          return () => chrome.runtime.onMessage.removeListener(handler)
        }
        return () => {}
      }
    }
  }

  /**
   * 啟動子組件
   * @returns {Promise<void>}
   * @private
   */
  async startSubComponents () {
    this.logger.log('▶️ 啟動事件系統子組件')

    const components = [
      this.eventSystemInitializer,
      this.eventBridgeManager,
      this.listenerRegistry
    ]

    for (const component of components) {
      if (component && typeof component.start === 'function') {
        try {
          await component.start()
        } catch (error) {
          this.logger.error(`❌ 事件系統子組件啟動失敗: ${component.constructor?.name}`, error)
        }
      }
    }

    this.logger.log('✅ 事件系統子組件啟動完成')
  }

  /**
   * 註冊核心事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async registerCoreListeners () {
    if (!this.eventBusInstance) {
      this.logger.error('❌ EventBus 實例不存在，無法註冊核心監聽器')
      return
    }

    if (this.coreListenersRegistered) {
      this.logger.warn('⚠️ 核心監聽器已註冊')
      return
    }

    try {
      this.logger.log('🎯 註冊核心事件監聽器')

      // 註冊系統級監聽器
      await this.registerSystemListeners()

      // 註冊提取監聽器
      await this.registerExtractionListeners()

      // 註冊錯誤監聽器
      await this.registerErrorListeners()

      this.coreListenersRegistered = true
      this.logger.log('✅ 核心事件監聽器註冊完成')
    } catch (error) {
      this.logger.error('❌ 註冊核心監聽器失敗:', error)
      throw error
    }
  }

  /**
   * 註冊系統事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async registerSystemListeners () {
    // 系統安裝監聽器
    const installedId = this.eventBusInstance.on(SYSTEM_EVENTS.INSTALLED, (event) => {
      this.logger.log('🎉 系統安裝事件:', event.data)
      this.eventStats.lastActivity = Date.now()
    }, { priority: EVENT_PRIORITIES.HIGH })

    this.registeredListeners.set(SYSTEM_EVENTS.INSTALLED, installedId)

    // 系統啟動監聽器
    const startupId = this.eventBusInstance.on(SYSTEM_EVENTS.STARTUP, (event) => {
      this.logger.log('🔄 系統啟動事件:', event.data)
      this.eventStats.lastActivity = Date.now()
    }, { priority: EVENT_PRIORITIES.HIGH })

    this.registeredListeners.set(SYSTEM_EVENTS.STARTUP, startupId)

    // 系統就緒監聽器
    const readyId = this.eventBusInstance.on(SYSTEM_EVENTS.READY, (event) => {
      this.logger.log('✅ 系統就緒事件:', event.data)
      this.eventStats.lastActivity = Date.now()
    }, { priority: EVENT_PRIORITIES.HIGH })

    this.registeredListeners.set(SYSTEM_EVENTS.READY, readyId)

    this.logger.log('📝 系統事件監聽器註冊完成')
  }

  /**
   * 註冊提取事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async registerExtractionListeners () {
    // EXTRACTION.COMPLETED 監聽器
    const completedId = this.eventBusInstance.on('EXTRACTION.COMPLETED', async (event) => {
      this.logger.log('📊 書籍提取完成事件被觸發!')
      this.logger.log('📋 完整事件資料:', event)

      try {
        let books = event.data?.booksData || event.data?.books

        // 正規化每本書加入 tags
        if (Array.isArray(books)) {
          books = books.map(b => {
            const existing = Array.isArray(b.tags) ? b.tags : (b.tag ? [b.tag] : [])
            const tags = Array.from(new Set([...(existing || []), 'readmoo']))
            return { ...b, tags }
          })
        }

        if (books && Array.isArray(books)) {
          const storageData = {
            books,
            extractionTimestamp: event.timestamp || Date.now(),
            extractionCount: event.data?.count || books.length,
            extractionDuration: event.data?.duration || 0,
            source: event.data?.source || 'readmoo'
          }

          this.logger.log(`💾 準備儲存 ${books.length} 本書籍到 Chrome Storage`)
          await chrome.storage.local.set({ readmoo_books: storageData })

          const verifyData = await chrome.storage.local.get(['readmoo_books'])
          this.logger.log('✅ 驗證儲存結果:', verifyData.readmoo_books ? `${verifyData.readmoo_books.books?.length || 0} 本書籍` : '無資料')
        } else {
          this.logger.warn('⚠️ 提取完成事件中沒有有效的書籍資料')
        }

        this.eventStats.lastActivity = Date.now()
      } catch (error) {
        this.logger.error('❌ 儲存書籍資料失敗:', error)
        this.eventStats.errorCount++
      }
    }, { priority: EVENT_PRIORITIES.URGENT })

    this.registeredListeners.set('EXTRACTION.COMPLETED', completedId)
    this.logger.log('📝 EXTRACTION.COMPLETED 監聽器註冊完成')
  }

  /**
   * 註冊錯誤事件監聽器
   * @returns {Promise<void>}
   * @private
   */
  async registerErrorListeners () {
    // 系統錯誤監聽器
    const errorId = this.eventBusInstance.on(SYSTEM_EVENTS.ERROR, (event) => {
      this.logger.error('💥 系統錯誤事件:', event.data)
      this.eventStats.errorCount++
      this.eventStats.lastActivity = Date.now()
    }, { priority: EVENT_PRIORITIES.URGENT })

    this.registeredListeners.set(SYSTEM_EVENTS.ERROR, errorId)

    this.logger.log('📝 錯誤事件監聽器註冊完成')
  }

  /**
   * 標記事件系統就緒
   * @returns {Promise<void>}
   * @private
   */
  async markEventSystemReady () {
    this.eventSystemReady = true

    // 標記 EventBus 就緒
    if (this.eventBusInstance && typeof this.eventBusInstance.markReady === 'function') {
      this.eventBusInstance.markReady()
    }

    // 觸發事件系統就緒事件
    if (this.eventBusInstance) {
      await this.eventBusInstance.emit('EVENT.SYSTEM.READY', {
        timestamp: Date.now(),
        handlersCount: this.registeredListeners.size
      })
    }

    this.logger.log('🎯 事件系統已標記為就緒')
  }

  /**
   * 取消註冊核心監聽器
   * @returns {Promise<void>}
   * @private
   */
  async unregisterCoreListeners () {
    if (!this.eventBusInstance || !this.coreListenersRegistered) {
      return
    }

    this.logger.log('🔄 取消註冊核心事件監聽器')

    for (const [eventType, listenerId] of this.registeredListeners) {
      try {
        this.eventBusInstance.off(eventType, listenerId)
      } catch (error) {
        this.logger.error(`❌ 取消註冊監聽器失敗: ${eventType}`, error)
      }
    }

    this.registeredListeners.clear()
    this.coreListenersRegistered = false

    this.logger.log('✅ 核心事件監聽器取消註冊完成')
  }

  /**
   * 停止子組件
   * @returns {Promise<void>}
   * @private
   */
  async stopSubComponents () {
    this.logger.log('⏹️ 停止事件系統子組件')

    const components = [
      this.listenerRegistry,
      this.eventBridgeManager,
      this.eventSystemInitializer
    ]

    for (const component of components) {
      if (component && typeof component.stop === 'function') {
        try {
          await component.stop()
        } catch (error) {
          this.logger.error(`❌ 事件系統子組件停止失敗: ${component.constructor?.name}`, error)
        }
      }
    }

    this.logger.log('✅ 事件系統子組件停止完成')
  }

  /**
   * 獲取事件系統狀態
   * @returns {Object} 事件系統狀態報告
   */
  getEventSystemStatus () {
    return {
      ready: this.eventSystemReady,
      coreListenersRegistered: this.coreListenersRegistered,
      eventBusActive: !!this.eventBusInstance,
      chromeBridgeActive: !!this.chromeBridgeInstance,
      registeredListeners: this.registeredListeners.size,
      stats: {
        ...this.eventStats,
        eventBusStats: this.eventBusInstance
          ? (typeof this.eventBusInstance.getStats === 'function' ? this.eventBusInstance.getStats() : null)
          : null
      },
      timestamp: Date.now()
    }
  }

  /**
   * 觸發事件（便捷方法）
   * @param {string} eventType - 事件類型
   * @param {Object} data - 事件資料
   * @returns {Promise<Array>} 處理結果
   */
  async emit (eventType, data = {}) {
    if (!this.eventBusInstance) {
      const error = new Error('EventBus 實例不存在')
      error.code = ErrorCodes.EVENTBUS_ERROR
      error.details = { category: 'general' }
      throw error
    }

    return await this.eventBusInstance.emit(eventType, data)
  }

  /**
   * 註冊事件監聽器（便捷方法）
   * @param {string} eventType - 事件類型
   * @param {Function} handler - 處理函數
   * @param {Object} options - 選項
   * @returns {string} 監聽器 ID
   */
  on (eventType, handler, options = {}) {
    if (!this.eventBusInstance) {
      const error = new Error('EventBus 實例不存在')
      error.code = ErrorCodes.EVENTBUS_ERROR
      error.details = { category: 'general' }
      throw error
    }

    return this.eventBusInstance.on(eventType, handler, options)
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    return {
      eventSystemReady: this.eventSystemReady,
      eventBusActive: !!this.eventBusInstance,
      chromeBridgeActive: !!this.chromeBridgeInstance,
      coreListenersRegistered: this.coreListenersRegistered,
      registeredListeners: this.registeredListeners.size,
      errorCount: this.eventStats.errorCount,
      lastActivity: this.eventStats.lastActivity,
      health: !this.eventSystemReady || this.eventStats.errorCount > 5 ? 'degraded' : 'healthy'
    }
  }
}

module.exports = EventCoordinator
