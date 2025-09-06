/**
 * 內容腳本協調服務
 *
 * 負責功能：
 * - Content Scripts 的生命週期管理
 * - 注入和移除 Content Scripts
 * - Content Scripts 間的通訊協調
 * - 腳本執行狀態監控和錯誤處理
 *
 * 設計考量：
 * - 智能腳本注入策略（按需注入、避免重複）
 * - 健壯的錯誤處理和重試機制
 * - 高效的腳本狀態追蹤和管理
 * - 跨分頁的腳本協調和通訊
 *
 * 使用情境：
 * - 當檢測到 Readmoo 頁面時自動注入相應腳本
 * - 管理腳本的啟動、停止和重新載入
 * - 協調多個 Content Scripts 間的資料交換
 */

const {
  PAGE_EVENTS,
  CONTENT_SCRIPT_EVENTS,
  EVENT_PRIORITIES
} = require('src/background/constants/module-constants')

class ContentScriptCoordinatorService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false,
      coordinating: false
    }

    // 腳本管理
    this.scriptConfigs = new Map()
    this.injectedScripts = new Map() // tabId -> Set of scriptIds
    this.scriptStates = new Map() // scriptId -> state info
    this.pendingInjections = new Map()
    this.registeredListeners = new Map()

    // 重試和錯誤處理
    this.retryAttempts = new Map()
    this.maxRetryAttempts = 3
    this.retryDelay = 1000

    // 統計資料
    this.stats = {
      scriptsInjected: 0,
      scriptsRemoved: 0,
      injectionFailures: 0,
      communicationEvents: 0
    }

    // 初始化腳本配置
    this.initializeScriptConfigs()
  }

  /**
   * 初始化內容腳本協調服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 內容腳本協調服務已初始化')
      return
    }

    try {
      this.logger.log('📜 初始化內容腳本協調服務')

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 檢查現有分頁並處理
      await this.processExistingTabs()

      this.state.initialized = true
      this.logger.log('✅ 內容腳本協調服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.CONTENT_SCRIPT.INITIALIZED', {
          serviceName: 'ContentScriptCoordinatorService',
          scriptsConfigured: this.scriptConfigs.size
        })
      }
    } catch (error) {
      this.logger.error('❌ 初始化內容腳本協調服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動內容腳本協調服務
   */
  async start () {
    if (!this.state.initialized) {
      throw new Error('服務尚未初始化')
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 內容腳本協調服務已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動內容腳本協調服務')

      this.state.active = true
      this.state.coordinating = true

      this.logger.log('✅ 內容腳本協調服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.CONTENT_SCRIPT.STARTED', {
          serviceName: 'ContentScriptCoordinatorService'
        })
      }
    } catch (error) {
      this.logger.error('❌ 啟動內容腳本協調服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止內容腳本協調服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('⚠️ 內容腳本協調服務未啟動')
      return
    }

    try {
      this.logger.log('🛑 停止內容腳本協調服務')

      // 清理所有注入的腳本
      await this.cleanupAllInjectedScripts()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()

      this.state.active = false
      this.state.coordinating = false

      this.logger.log('✅ 內容腳本協調服務停止完成')

      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.CONTENT_SCRIPT.STOPPED', {
          serviceName: 'ContentScriptCoordinatorService',
          finalStats: { ...this.stats }
        })
      }
    } catch (error) {
      this.logger.error('❌ 停止內容腳本協調服務失敗:', error)
      throw error
    }
  }

  /**
   * 初始化腳本配置
   */
  initializeScriptConfigs () {
    // Readmoo 書庫頁面腳本
    this.scriptConfigs.set('readmoo_library_extractor', {
      id: 'readmoo_library_extractor',
      file: '/src/content/extractors/readmoo-library-extractor.js',
      matches: ['*://readmoo.com/library*'],
      pageTypes: ['readmoo_library'],
      runAt: 'document_idle',
      allFrames: false,
      dependencies: ['readmoo_common_utils']
    })

    // Readmoo 通用工具腳本
    this.scriptConfigs.set('readmoo_common_utils', {
      id: 'readmoo_common_utils',
      file: '/src/content/utils/readmoo-common-utils.js',
      matches: ['*://readmoo.com/*'],
      pageTypes: ['readmoo_main', 'readmoo_library', 'readmoo_book_detail', 'readmoo_reader'],
      runAt: 'document_start',
      allFrames: false,
      dependencies: []
    })

    // Readmoo 書籍詳情腳本
    this.scriptConfigs.set('readmoo_book_detail', {
      id: 'readmoo_book_detail',
      file: '/src/content/page-handlers/book-detail-handler.js',
      matches: ['*://readmoo.com/book/*'],
      pageTypes: ['readmoo_book_detail'],
      runAt: 'document_idle',
      allFrames: false,
      dependencies: ['readmoo_common_utils']
    })

    // Readmoo 閱讀頁面腳本
    this.scriptConfigs.set('readmoo_reader', {
      id: 'readmoo_reader',
      file: '/src/content/page-handlers/reader-handler.js',
      matches: ['*://readmoo.com/reader*'],
      pageTypes: ['readmoo_reader'],
      runAt: 'document_idle',
      allFrames: false,
      dependencies: ['readmoo_common_utils']
    })

    this.logger.log(`✅ 初始化了 ${this.scriptConfigs.size} 個腳本配置`)
  }

  /**
   * 處理現有分頁
   */
  async processExistingTabs () {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const tabs = await chrome.tabs.query({})

        for (const tab of tabs) {
          if (tab.url && this.shouldProcessTab(tab.url)) {
            await this.handleTabUpdate(tab.id, tab.url)
          }
        }

        this.logger.log(`🔄 處理了 ${tabs.length} 個現有分頁`)
      }
    } catch (error) {
      this.logger.error('❌ 處理現有分頁失敗:', error)
    }
  }

  /**
   * 判斷是否應該處理分頁
   */
  shouldProcessTab (url) {
    if (!url) return false

    for (const config of this.scriptConfigs.values()) {
      for (const pattern of config.matches) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'))
        if (regex.test(url)) {
          return true
        }
      }
    }

    return false
  }

  /**
   * 處理分頁更新
   */
  async handleTabUpdate (tabId, url, pageType = null) {
    if (!this.state.coordinating) return

    try {
      this.logger.log(`🔄 處理分頁更新: ${tabId} - ${url}`)

      // 檢測頁面類型
      if (!pageType) {
        pageType = await this.detectPageType(url)
      }

      if (pageType) {
        await this.injectScriptsForPageType(tabId, pageType, url)
      } else {
        await this.removeScriptsFromTab(tabId)
      }
    } catch (error) {
      this.logger.error(`❌ 處理分頁更新失敗 (${tabId}):`, error)
    }
  }

  /**
   * 檢測頁面類型
   */
  async detectPageType (url) {
    // 基本URL模式檢測
    if (url.includes('readmoo.com/library')) return 'readmoo_library'
    if (url.match(/readmoo\.com\/book\/\d+/)) return 'readmoo_book_detail'
    if (url.includes('readmoo.com/reader')) return 'readmoo_reader'
    if (url.includes('readmoo.com')) return 'readmoo_main'

    return null
  }

  /**
   * 為頁面類型注入腳本
   */
  async injectScriptsForPageType (tabId, pageType, url) {
    const scriptsToInject = []

    // 找出需要注入的腳本
    for (const config of this.scriptConfigs.values()) {
      if (config.pageTypes.includes(pageType)) {
        scriptsToInject.push(config)
      }
    }

    if (scriptsToInject.length === 0) {
      this.logger.log(`📜 頁面類型 ${pageType} 無需注入腳本`)
      return
    }

    // 按依賴順序排序
    const sortedScripts = this.sortScriptsByDependencies(scriptsToInject)

    // 逐個注入腳本
    for (const config of sortedScripts) {
      await this.injectScript(tabId, config)
    }

    this.logger.log(`✅ 為分頁 ${tabId} (${pageType}) 注入了 ${sortedScripts.length} 個腳本`)
  }

  /**
   * 按依賴順序排序腳本
   */
  sortScriptsByDependencies (scripts) {
    const sorted = []
    const visited = new Set()

    const visit = (script) => {
      if (visited.has(script.id)) return
      visited.add(script.id)

      // 先處理依賴
      for (const depId of script.dependencies) {
        const depScript = scripts.find(s => s.id === depId)
        if (depScript) {
          visit(depScript)
        }
      }

      sorted.push(script)
    }

    scripts.forEach(script => visit(script))
    return sorted
  }

  /**
   * 注入單個腳本
   */
  async injectScript (tabId, config) {
    const scriptKey = `${tabId}_${config.id}`

    // 檢查是否已注入
    if (this.scriptStates.has(scriptKey)) {
      const state = this.scriptStates.get(scriptKey)
      if (state.status === 'injected' || state.status === 'injecting') {
        return
      }
    }

    try {
      this.scriptStates.set(scriptKey, {
        tabId,
        scriptId: config.id,
        status: 'injecting',
        timestamp: Date.now()
      })

      // 使用 Chrome Extension API 注入腳本
      if (typeof chrome !== 'undefined' && chrome.scripting) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [config.file]
        })
      }

      // 更新狀態
      this.scriptStates.set(scriptKey, {
        tabId,
        scriptId: config.id,
        status: 'injected',
        timestamp: Date.now()
      })

      // 記錄到分頁腳本集合
      if (!this.injectedScripts.has(tabId)) {
        this.injectedScripts.set(tabId, new Set())
      }
      this.injectedScripts.get(tabId).add(config.id)

      this.stats.scriptsInjected++
      this.logger.log(`✅ 腳本注入成功: ${config.id} -> 分頁 ${tabId}`)

      // 發送注入成功事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.CONTENT_SCRIPT.INJECTED', {
          tabId,
          scriptId: config.id,
          pageType: config.pageTypes[0]
        })
      }
    } catch (error) {
      this.logger.error(`❌ 腳本注入失敗: ${config.id} -> 分頁 ${tabId}`, error)

      this.scriptStates.set(scriptKey, {
        tabId,
        scriptId: config.id,
        status: 'failed',
        error: error.message,
        timestamp: Date.now()
      })

      this.stats.injectionFailures++

      // 嘗試重試
      await this.handleInjectionFailure(tabId, config, error)
    }
  }

  /**
   * 處理注入失敗
   */
  async handleInjectionFailure (tabId, config, error) {
    const retryKey = `${tabId}_${config.id}`
    const attempts = this.retryAttempts.get(retryKey) || 0

    if (attempts < this.maxRetryAttempts) {
      this.retryAttempts.set(retryKey, attempts + 1)

      this.logger.log(`🔄 準備重試注入腳本: ${config.id} (第 ${attempts + 1} 次)`)

      setTimeout(async () => {
        await this.injectScript(tabId, config)
      }, this.retryDelay * (attempts + 1))
    } else {
      this.logger.error(`🚫 腳本注入重試次數已達上限: ${config.id}`)
      this.retryAttempts.delete(retryKey)
    }
  }

  /**
   * 從分頁移除腳本
   */
  async removeScriptsFromTab (tabId) {
    const injectedScripts = this.injectedScripts.get(tabId)
    if (!injectedScripts) return

    for (const scriptId of injectedScripts) {
      const scriptKey = `${tabId}_${scriptId}`
      this.scriptStates.delete(scriptKey)
      this.stats.scriptsRemoved++
    }

    this.injectedScripts.delete(tabId)
    this.logger.log(`🗑️ 從分頁 ${tabId} 移除了 ${injectedScripts.size} 個腳本`)
  }

  /**
   * 清理所有注入的腳本
   */
  async cleanupAllInjectedScripts () {
    const tabIds = Array.from(this.injectedScripts.keys())

    for (const tabId of tabIds) {
      await this.removeScriptsFromTab(tabId)
    }

    this.scriptStates.clear()
    this.retryAttempts.clear()

    this.logger.log('🧹 清理了所有注入的腳本')
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
        event: PAGE_EVENTS.DETECTED,
        handler: this.handlePageDetected.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: PAGE_EVENTS.NAVIGATION_CHANGED,
        handler: this.handleNavigationChanged.bind(this),
        priority: EVENT_PRIORITIES.HIGH
      },
      {
        event: CONTENT_SCRIPT_EVENTS.READY,
        handler: this.handleContentScriptReady.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      },
      {
        event: CONTENT_SCRIPT_EVENTS.ERROR,
        handler: this.handleContentScriptError.bind(this),
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
   * 處理頁面檢測事件
   */
  async handlePageDetected (event) {
    try {
      this.stats.communicationEvents++

      const { url, tabId, pageType } = event.data || {}

      if (tabId && pageType) {
        await this.handleTabUpdate(tabId, url, pageType)
      }
    } catch (error) {
      this.logger.error('❌ 處理頁面檢測事件失敗:', error)
    }
  }

  /**
   * 處理導航變更事件
   */
  async handleNavigationChanged (event) {
    try {
      this.stats.communicationEvents++

      const { url, tabId } = event.data || {}

      if (tabId) {
        await this.handleTabUpdate(tabId, url)
      }
    } catch (error) {
      this.logger.error('❌ 處理導航變更事件失敗:', error)
    }
  }

  /**
   * 處理內容腳本就緒事件
   */
  async handleContentScriptReady (event) {
    try {
      this.stats.communicationEvents++

      const { tabId, scriptId } = event.data || {}
      this.logger.log(`📜 內容腳本就緒: ${scriptId} (分頁 ${tabId})`)
    } catch (error) {
      this.logger.error('❌ 處理內容腳本就緒事件失敗:', error)
    }
  }

  /**
   * 處理內容腳本錯誤事件
   */
  async handleContentScriptError (event) {
    try {
      const { tabId, scriptId, error } = event.data || {}
      this.logger.error(`❌ 內容腳本錯誤: ${scriptId} (分頁 ${tabId})`, error)

      // 標記腳本為失敗狀態
      const scriptKey = `${tabId}_${scriptId}`
      if (this.scriptStates.has(scriptKey)) {
        this.scriptStates.set(scriptKey, {
          ...this.scriptStates.get(scriptKey),
          status: 'error',
          error
        })
      }
    } catch (error) {
      this.logger.error('❌ 處理內容腳本錯誤事件失敗:', error)
    }
  }

  /**
   * 獲取分頁腳本狀態
   */
  getTabScriptStates (tabId) {
    const states = {}

    for (const [, state] of this.scriptStates) {
      if (state.tabId === tabId) {
        states[state.scriptId] = state
      }
    }

    return states
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      initialized: this.state.initialized,
      active: this.state.active,
      coordinating: this.state.coordinating,
      scriptsConfigured: this.scriptConfigs.size,
      activeTabs: this.injectedScripts.size,
      activeScripts: this.scriptStates.size,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const failedScripts = Array.from(this.scriptStates.values())
      .filter(state => state.status === 'failed' || state.status === 'error').length

    const isHealthy = this.state.initialized &&
                     failedScripts < this.scriptStates.size * 0.1 // 失敗率低於10%

    return {
      service: 'ContentScriptCoordinatorService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      coordinating: this.state.coordinating,
      metrics: {
        scriptsInjected: this.stats.scriptsInjected,
        scriptsRemoved: this.stats.scriptsRemoved,
        injectionFailures: this.stats.injectionFailures,
        communicationEvents: this.stats.communicationEvents,
        failureRate: this.stats.scriptsInjected > 0
          ? (this.stats.injectionFailures / this.stats.scriptsInjected * 100).toFixed(2) + '%'
          : '0%'
      }
    }
  }
}

module.exports = ContentScriptCoordinatorService
