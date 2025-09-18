/**
 * 分頁狀態追蹤服務
 *
 * 負責功能：
 * - 瀏覽器分頁狀態的實時監控和追蹤
 * - 分頁生命週期事件的捕獲和處理
 * - 分頁間的狀態同步和協調
 * - 分頁相關資料的持久化和恢復
 *
 * 設計考量：
 * - 高效能的分頁狀態快取機制
 * - 智能的狀態變化檢測和通知
 * - 健壯的分頁清理和資源釋放
 * - 跨會話的狀態持續性管理
 *
 * 使用情境：
 * - 追蹤用戶在 Readmoo 網站的瀏覽行為
 * - 管理多分頁間的資料同步
 * - 提供分頁狀態的歷史記錄和分析
 */

const {
  TAB_EVENTS,
  EVENT_PRIORITIES
} = require('src/background/constants/module-constants')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class TabStateTrackingService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false,
      tracking: false
    }

    // 分頁狀態追蹤
    this.tabStates = new Map() // tabId -> tabState
    this.tabHistory = new Map() // tabId -> history array
    this.activeTabIds = new Set()
    this.registeredListeners = new Map()

    // 分頁事件監聽器
    this.chromeListeners = new Map()

    // 配置
    this.config = {
      maxHistoryEntries: 50,
      stateUpdateInterval: 1000,
      cleanupInterval: 300000, // 5分鐘
      persistState: true,
      trackInactiveTabs: true
    }

    // 統計資料
    this.stats = {
      tabsTracked: 0,
      stateUpdates: 0,
      eventsProcessed: 0,
      cleanupOperations: 0
    }

    // 定時器
    this.cleanupTimer = null
    this.stateUpdateTimer = null
  }

  /**
   * 初始化分頁狀態追蹤服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 分頁狀態追蹤服務已初始化')
      return
    }

    try {
      this.logger.log('📊 初始化分頁狀態追蹤服務')

      // 載入持久化狀態
      await this.loadPersistedState()

      // 註冊 Chrome API 事件監聽器
      await this.registerChromeListeners()

      // 註冊事件匯流排監聽器
      await this.registerEventListeners()

      // 初始化現有分頁狀態
      await this.initializeExistingTabs()

      this.state.initialized = true
      this.logger.log('✅ 分頁狀態追蹤服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.TAB_STATE.INITIALIZED')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
          serviceName: 'TabStateTrackingService',
          tabsTracked: this.tabStates.size
        })
      }
    } catch (error) {
      this.logger.error('❌ 初始化分頁狀態追蹤服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動分頁狀態追蹤服務
   */
  async start () {
    if (!this.state.initialized) {
      const error = new Error('服務尚未初始化')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
        category: 'general'
      })
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 分頁狀態追蹤服務已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動分頁狀態追蹤服務')

      // 開始定時任務
      this.startPeriodicTasks()

      this.state.active = true
      this.state.tracking = true

      this.logger.log('✅ 分頁狀態追蹤服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.TAB_STATE.STARTED')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
          serviceName: 'TabStateTrackingService'
        })
      }
    } catch (error) {
      this.logger.error('❌ 啟動分頁狀態追蹤服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止分頁狀態追蹤服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('⚠️ 分頁狀態追蹤服務未啟動')
      return
    }

    try {
      this.logger.log('🛑 停止分頁狀態追蹤服務')

      // 停止定時任務
      this.stopPeriodicTasks()

      // 保存持久化狀態
      await this.savePersistedState()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()
      await this.unregisterChromeListeners()

      this.state.active = false
      this.state.tracking = false

      this.logger.log('✅ 分頁狀態追蹤服務停止完成')

      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.TAB_STATE.STOPPED')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
          serviceName: 'TabStateTrackingService',
          finalStats: { ...this.stats }
        })
      }
    } catch (error) {
      this.logger.error('❌ 停止分頁狀態追蹤服務失敗:', error)
      throw error
    }
  }

  /**
   * 載入持久化狀態
   */
  async loadPersistedState () {
    if (!this.config.persistState) return

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(['tabStates', 'tabHistory'])

        if (result.tabStates) {
          this.tabStates = new Map(Object.entries(result.tabStates))
          this.logger.log(`📂 載入了 ${this.tabStates.size} 個分頁狀態`)
        }

        if (result.tabHistory) {
          this.tabHistory = new Map(Object.entries(result.tabHistory))
          this.logger.log(`📜 載入了 ${this.tabHistory.size} 個分頁歷史`)
        }
      }
    } catch (error) {
      this.logger.warn('載入持久化狀態失敗:', error)
    }
  }

  /**
   * 保存持久化狀態
   */
  async savePersistedState () {
    if (!this.config.persistState) return

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const data = {
          tabStates: Object.fromEntries(this.tabStates),
          tabHistory: Object.fromEntries(this.tabHistory)
        }

        await chrome.storage.local.set(data)
        this.logger.log('💾 分頁狀態已保存')
      }
    } catch (error) {
      this.logger.warn('保存持久化狀態失敗:', error)
    }
  }

  /**
   * 註冊 Chrome API 事件監聽器
   */
  async registerChromeListeners () {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      this.logger.warn('⚠️ Chrome Tabs API 不可用')
      return
    }

    try {
      // 分頁更新事件
      const onUpdatedListener = this.handleTabUpdated.bind(this)
      chrome.tabs.onUpdated.addListener(onUpdatedListener)
      this.chromeListeners.set('onUpdated', onUpdatedListener)

      // 分頁啟動事件
      const onActivatedListener = this.handleTabActivated.bind(this)
      chrome.tabs.onActivated.addListener(onActivatedListener)
      this.chromeListeners.set('onActivated', onActivatedListener)

      // 分頁移除事件
      const onRemovedListener = this.handleTabRemoved.bind(this)
      chrome.tabs.onRemoved.addListener(onRemovedListener)
      this.chromeListeners.set('onRemoved', onRemovedListener)

      // 分頁創建事件
      const onCreatedListener = this.handleTabCreated.bind(this)
      chrome.tabs.onCreated.addListener(onCreatedListener)
      this.chromeListeners.set('onCreated', onCreatedListener)

      this.logger.log('✅ Chrome 分頁事件監聽器註冊完成')
    } catch (error) {
      this.logger.error('❌ 註冊 Chrome 監聽器失敗:', error)
      throw error
    }
  }

  /**
   * 取消註冊 Chrome API 事件監聽器
   */
  async unregisterChromeListeners () {
    if (typeof chrome === 'undefined' || !chrome.tabs) return

    try {
      for (const [eventName, listener] of this.chromeListeners) {
        switch (eventName) {
          case 'onUpdated':
            chrome.tabs.onUpdated.removeListener(listener)
            break
          case 'onActivated':
            chrome.tabs.onActivated.removeListener(listener)
            break
          case 'onRemoved':
            chrome.tabs.onRemoved.removeListener(listener)
            break
          case 'onCreated':
            chrome.tabs.onCreated.removeListener(listener)
            break
        }
      }

      this.chromeListeners.clear()
      this.logger.log('✅ Chrome 分頁事件監聽器取消註冊完成')
    } catch (error) {
      this.logger.error('❌ 取消註冊 Chrome 監聽器失敗:', error)
    }
  }

  /**
   * 初始化現有分頁狀態
   */
  async initializeExistingTabs () {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const tabs = await chrome.tabs.query({})

        for (const tab of tabs) {
          await this.createTabState(tab)
        }

        this.logger.log(`🔄 初始化了 ${tabs.length} 個現有分頁`)
      }
    } catch (error) {
      this.logger.error('❌ 初始化現有分頁失敗:', error)
    }
  }

  /**
   * 開始定時任務
   */
  startPeriodicTasks () {
    // 定時清理過期狀態
    this.cleanupTimer = setInterval(() => {
      this.performCleanup()
    }, this.config.cleanupInterval)

    // 定時更新狀態
    this.stateUpdateTimer = setInterval(() => {
      this.performStateUpdate()
    }, this.config.stateUpdateInterval)

    this.logger.log('⏰ 定時任務已啟動')
  }

  /**
   * 停止定時任務
   */
  stopPeriodicTasks () {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    if (this.stateUpdateTimer) {
      clearInterval(this.stateUpdateTimer)
      this.stateUpdateTimer = null
    }

    this.logger.log('⏰ 定時任務已停止')
  }

  /**
   * 執行清理操作
   */
  async performCleanup () {
    try {
      const now = Date.now()
      const expiredTabIds = []

      // 找出過期的分頁狀態
      for (const [tabId, state] of this.tabStates) {
        if (state.removed && now - state.lastUpdate > this.config.cleanupInterval) {
          expiredTabIds.push(tabId)
        }
      }

      // 清理過期狀態
      for (const tabId of expiredTabIds) {
        this.tabStates.delete(tabId)
        this.tabHistory.delete(tabId)
      }

      if (expiredTabIds.length > 0) {
        this.stats.cleanupOperations++
        this.logger.log(`🧹 清理了 ${expiredTabIds.length} 個過期分頁狀態`)
      }

      // 定期保存狀態
      if (this.config.persistState) {
        await this.savePersistedState()
      }
    } catch (error) {
      this.logger.error('❌ 執行清理操作失敗:', error)
    }
  }

  /**
   * 執行狀態更新
   */
  async performStateUpdate () {
    if (!this.state.tracking) return

    try {
      // 更新活躍分頁的狀態
      for (const tabId of this.activeTabIds) {
        await this.updateTabState(tabId)
      }

      this.stats.stateUpdates++
    } catch (error) {
      this.logger.error('❌ 執行狀態更新失敗:', error)
    }
  }

  /**
   * 處理分頁更新事件
   */
  async handleTabUpdated (tabId, changeInfo, tab) {
    try {
      this.stats.eventsProcessed++

      await this.updateTabState(tabId, { changeInfo, tab })

      // 如果URL變化，發送導航事件
      if (changeInfo.url) {
        if (this.eventBus) {
          await this.eventBus.emit('PAGE.NAVIGATION.CHANGED')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
            tabId,
            url: changeInfo.url,
            previousUrl: this.tabStates.get(tabId)?.url
          })
        }
      }

      // 如果狀態變為完成，發送就緒事件
      if (changeInfo.status === 'complete' && this.isReadmooPage(tab.url)) {
        if (this.eventBus) {
          await this.eventBus.emit('PAGE.READY')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
            tabId,
            url: tab.url,
            title: tab.title
          })
        }
      }
    } catch (error) {
      this.logger.error(`❌ 處理分頁更新事件失敗 (${tabId}):`, error)
    }
  }

  /**
   * 處理分頁啟動事件
   */
  async handleTabActivated (activeInfo) {
    try {
      this.stats.eventsProcessed++

      const { tabId, windowId } = activeInfo

      // 更新活躍分頁集合
      this.activeTabIds.add(tabId)

      await this.updateTabState(tabId, { active: true, windowId })

      // 發送分頁啟動事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.TAB.ACTIVATED')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
          tabId,
          windowId,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理分頁啟動事件失敗:', error)
    }
  }

  /**
   * 處理分頁移除事件
   */
  async handleTabRemoved (tabId, removeInfo) {
    try {
      this.stats.eventsProcessed++

      // 從活躍分頁集合移除
      this.activeTabIds.delete(tabId)

      // 標記為已移除但保留狀態一段時間
      await this.updateTabState(tabId)
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
        removed: true,
        removeInfo,
        lastUpdate: Date.now()
      })

      // 發送分頁移除事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.TAB.REMOVED')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
          tabId,
          removeInfo,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error(`❌ 處理分頁移除事件失敗 (${tabId}):`, error)
    }
  }

  /**
   * 處理分頁創建事件
   */
  async handleTabCreated (tab) {
    try {
      this.stats.eventsProcessed++

      await this.createTabState(tab)

      // 發送分頁創建事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.TAB.CREATED')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
          tabId: tab.id,
          url: tab.url,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理分頁創建事件失敗:', error)
    }
  }

  /**
   * 創建分頁狀態
   */
  async createTabState (tab) {
    const tabState = {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      status: tab.status,
      active: tab.active,
      windowId: tab.windowId,
      index: tab.index,
      pinned: tab.pinned,
      created: Date.now(),
      lastUpdate: Date.now(),
      removed: false,
      visits: 1,
      readmooPage: this.isReadmooPage(tab.url),
      pageType: await this.detectPageType(tab.url)
    }

    this.tabStates.set(tab.id, tabState)
    this.tabHistory.set(tab.id, [])

    if (tab.active) {
      this.activeTabIds.add(tab.id)
    }

    this.stats.tabsTracked++
    this.addToHistory(tab.id, 'created', tabState)
  }

  /**
   * 更新分頁狀態
   */
  async updateTabState (tabId, updates = {}) {
    let tabState = this.tabStates.get(tabId)

    if (!tabState && !updates.removed) {
      // 如果分頁狀態不存在且不是移除操作，嘗試獲取分頁資訊
      try {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          const tab = await chrome.tabs.get(tabId)
          await this.createTabState(tab)
          tabState = this.tabStates.get(tabId)
        }
      } catch (error) {
        this.logger.warn(`無法獲取分頁資訊 (${tabId}):`, error)
        return
      }
    }

    if (!tabState) return

    // 記錄舊狀態用於比較
    const oldState = { ...tabState }

    // 應用更新
    Object.assign(tabState, updates, { lastUpdate: Date.now() })

    // 如果URL變化，重新檢測頁面類型
    if (updates.tab?.url && updates.tab.url !== oldState.url) {
      tabState.url = updates.tab.url
      tabState.title = updates.tab.title
      tabState.readmooPage = this.isReadmooPage(updates.tab.url)
      tabState.pageType = await this.detectPageType(updates.tab.url)
      tabState.visits++
    }

    // 記錄歷史
    this.addToHistory(tabId, 'updated', { ...oldState }, tabState)

    this.tabStates.set(tabId, tabState)
  }

  /**
   * 添加到歷史記錄
   */
  addToHistory (tabId, action, ...data) {
    let history = this.tabHistory.get(tabId)
    if (!history) {
      history = []
      this.tabHistory.set(tabId, history)
    }

    history.push({
      action,
      timestamp: Date.now(),
      data
    })

    // 限制歷史記錄長度
    if (history.length > this.config.maxHistoryEntries) {
      history.splice(0, history.length - this.config.maxHistoryEntries)
    }
  }

  /**
   * 檢測是否為 Readmoo 頁面
   */
  isReadmooPage (url) {
    if (!url) return false
    return url.includes('readmoo.com')
  }

  /**
   * 檢測頁面類型
   */
  async detectPageType (url) {
    if (!url || !this.isReadmooPage(url)) return null

    if (url.includes('readmoo.com/library')) return 'readmoo_library'
    if (url.match(/readmoo\.com\/book\/\d+/)) return 'readmoo_book_detail'
    if (url.includes('readmoo.com/reader')) return 'readmoo_reader'
    if (url.includes('readmoo.com')) return 'readmoo_main'

    return null
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
        event: TAB_EVENTS.STATE_REQUEST,
        handler: this.handleStateRequest.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      },
      {
        event: TAB_EVENTS.HISTORY_REQUEST,
        handler: this.handleHistoryRequest.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
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
   * 處理狀態請求
   */
  async handleStateRequest (event) {
    try {
      const { tabId, requestId } = event.data || {}

      let result
      if (tabId) {
        result = this.getTabState(tabId)
      } else {
        result = this.getAllTabStates()
      }

      if (this.eventBus) {
        await this.eventBus.emit('PAGE.TAB_STATE.RESPONSE')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
          requestId,
          tabId,
          result
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理狀態請求失敗:', error)
    }
  }

  /**
   * 處理歷史請求
   */
  async handleHistoryRequest (event) {
    try {
      const { tabId, requestId } = event.data || {}

      const result = tabId
        ? this.getTabHistory(tabId)
        : this.getAllTabHistories()

      if (this.eventBus) {
        await this.eventBus.emit('PAGE.TAB_HISTORY.RESPONSE')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
          requestId,
          tabId,
          result
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理歷史請求失敗:', error)
    }
  }

  /**
   * 獲取分頁狀態
   */
  getTabState (tabId) {
    return this.tabStates.get(tabId) || null
  }

  /**
   * 獲取所有分頁狀態
   */
  getAllTabStates () {
    return Object.fromEntries(this.tabStates)
  }

  /**
   * 獲取分頁歷史
   */
  getTabHistory (tabId) {
    return this.tabHistory.get(tabId) || []
  }

  /**
   * 獲取所有分頁歷史
   */
  getAllTabHistories () {
    return Object.fromEntries(this.tabHistory)
  }

  /**
   * 獲取活躍的 Readmoo 分頁
   */
  getActiveReadmooTabs () {
    const readmooTabs = []

    for (const [tabId, state] of this.tabStates) {
      if (state.readmooPage && !state.removed && this.activeTabIds.has(parseInt(tabId))) {
        readmooTabs.push(state)
      }
    }

    return readmooTabs
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      tracking: this.state.tracking,
      config: this.config,
      tabsTracked: this.tabStates.size,
      activeTabs: this.activeTabIds.size,
      readmooTabs: this.getActiveReadmooTabs().length,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const isHealthy = this.state.initialized && this.state.tracking

    return {
      service: 'TabStateTrackingService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      tracking: this.state.tracking,
      metrics: {
        tabsTracked: this.stats.tabsTracked,
        stateUpdates: this.stats.stateUpdates,
        eventsProcessed: this.stats.eventsProcessed,
        cleanupOperations: this.stats.cleanupOperations,
        activeTabs: this.activeTabIds.size,
        readmooTabs: this.getActiveReadmooTabs().length
      }
    }
  }
}

module.exports = TabStateTrackingService
