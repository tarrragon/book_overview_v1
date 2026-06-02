/**
 * 導航服務
 *
 * 負責功能：
 * - 瀏覽器導航事件的捕獲和處理
 * - 頁面導航歷史的追蹤和管理
 * - 導航相關的使用者行為分析
 * - 導航事件的路由和分發
 *
 * 設計考量：
 * - 高效能的導航事件處理機制
 * - 智能的導航意圖識別和分類
 * - 完整的導航生命週期管理
 * - 跨分頁的導航協調和同步
 *
 * 使用情境：
 * - 監控用戶在 Readmoo 網站的導航行為
 * - 提供導航歷史和路徑分析
 * - 實現導航相關的自動化操作
 */

const {
  NAVIGATION_EVENTS,
  EVENT_PRIORITIES
} = require('src/background/constants/module-constants')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class NavigationService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null

    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: 導航服務作為用戶行為追蹤中心，負責記錄導航事件和行為分析
    // 執行環境: Service Worker 初始化階段，依賴注入可能不完整
    // 後備機制: console 確保導航事件和使用者行為能被追蹤
    // 風險考量: 理想上應確保 Logger 完整可用，此為過渡性保護
    this.logger = dependencies.logger || console
    this.i18nManager = dependencies.i18nManager || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false,
      tracking: false
    }

    // 導航追蹤
    this.navigationHistory = new Map() // tabId -> navigation history
    this.currentNavigations = new Map() // tabId -> current navigation
    this.navigationPatterns = new Map()
    this.registeredListeners = new Map()

    // 導航事件監聽器
    this.webNavigationListeners = new Map()

    // 導航分析
    this.routeAnalyzer = new Map()
    this.behaviorTracker = new Map()

    // 配置
    this.config = {
      maxHistoryEntries: 100,
      trackSubFrames: false,
      analyzePatterns: true,
      debounceDelay: 500,
      minStayDuration: 1000 // 最小停留時間
    }

    // 統計資料
    this.stats = {
      navigationsTracked: 0,
      patternsDetected: 0,
      eventsProcessed: 0,
      routesAnalyzed: 0
    }

    // 防抖處理
    this.navigationTimers = new Map()
  }

  /**
   * 初始化導航服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('[WARN] 導航服務已初始化')
      return
    }

    try {
      this.logger.log('初始化導航服務')

      // 註冊 Web Navigation API 監聽器
      await this.registerWebNavigationListeners()

      // 註冊事件匯流排監聽器
      await this.registerEventListeners()

      // 初始化路由分析器
      await this.initializeRouteAnalyzers()

      this.state.initialized = true
      this.logger.log('[OK] 導航服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.NAVIGATION.INITIALIZED')
      }
    } catch (error) {
      this.logger.error('[FAIL] 初始化導航服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動導航服務
   */
  async start () {
    if (!this.state.initialized) {
      const error = new Error('服務尚未初始化')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
        category: 'general'
      }
      throw error
    }

    if (this.state.active) {
      this.logger.warn('[WARN] 導航服務已啟動')
      return
    }

    try {
      this.logger.log('[START] 啟動導航服務')

      this.state.active = true
      this.state.tracking = true

      this.logger.log('[OK] 導航服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.NAVIGATION.STARTED')
      }
    } catch (error) {
      this.logger.error('[FAIL] 啟動導航服務失敗:', error)
      throw error
    }
  }

  /**
   * 停止導航服務
   */
  async stop () {
    if (!this.state.active) {
      this.logger.warn('[WARN] 導航服務未啟動')
      return
    }

    try {
      this.logger.log('[STOP] 停止導航服務')

      // 清理防抖計時器
      this.clearNavigationTimers()

      // 取消註冊事件監聽器
      await this.unregisterEventListeners()
      await this.unregisterWebNavigationListeners()

      this.state.active = false
      this.state.tracking = false

      this.logger.log('[OK] 導航服務停止完成')

      // 發送停止完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.NAVIGATION.STOPPED')
      }
    } catch (error) {
      this.logger.error('[FAIL] 停止導航服務失敗:', error)
      throw error
    }
  }

  /**
   * 註冊 Web Navigation API 監聽器
   */
  async registerWebNavigationListeners () {
    if (typeof chrome === 'undefined' || !chrome.webNavigation) {
      this.logger.warn('[WARN] Chrome WebNavigation API 不可用')
      return
    }

    try {
      // 導航開始事件
      const onBeforeNavigateListener = this.handleBeforeNavigate.bind(this)
      chrome.webNavigation.onBeforeNavigate.addListener(onBeforeNavigateListener)
      this.webNavigationListeners.set('onBeforeNavigate', onBeforeNavigateListener)

      // 導航提交事件
      const onCommittedListener = this.handleNavigationCommitted.bind(this)
      chrome.webNavigation.onCommitted.addListener(onCommittedListener)
      this.webNavigationListeners.set('onCommitted', onCommittedListener)

      // 導航完成事件
      const onCompletedListener = this.handleNavigationCompleted.bind(this)
      chrome.webNavigation.onCompleted.addListener(onCompletedListener)
      this.webNavigationListeners.set('onCompleted', onCompletedListener)

      // 導航錯誤事件
      const onErrorOccurredListener = this.handleNavigationError.bind(this)
      chrome.webNavigation.onErrorOccurred.addListener(onErrorOccurredListener)
      this.webNavigationListeners.set('onErrorOccurred', onErrorOccurredListener)

      // 歷史狀態更新事件
      const onHistoryStateUpdatedListener = this.handleHistoryStateUpdated.bind(this)
      chrome.webNavigation.onHistoryStateUpdated.addListener(onHistoryStateUpdatedListener)
      this.webNavigationListeners.set('onHistoryStateUpdated', onHistoryStateUpdatedListener)

      this.logger.log('[OK] Web Navigation 事件監聽器註冊完成')
    } catch (error) {
      this.logger.error('[FAIL] 註冊 Web Navigation 監聽器失敗:', error)
      throw error
    }
  }

  /**
   * 取消註冊 Web Navigation API 監聽器
   */
  async unregisterWebNavigationListeners () {
    if (typeof chrome === 'undefined' || !chrome.webNavigation) return

    try {
      for (const [eventName, listener] of this.webNavigationListeners) {
        switch (eventName) {
          case 'onBeforeNavigate':
            chrome.webNavigation.onBeforeNavigate.removeListener(listener)
            break
          case 'onCommitted':
            chrome.webNavigation.onCommitted.removeListener(listener)
            break
          case 'onCompleted':
            chrome.webNavigation.onCompleted.removeListener(listener)
            break
          case 'onErrorOccurred':
            chrome.webNavigation.onErrorOccurred.removeListener(listener)
            break
          case 'onHistoryStateUpdated':
            chrome.webNavigation.onHistoryStateUpdated.removeListener(listener)
            break
        }
      }

      this.webNavigationListeners.clear()
      this.logger.log('[OK] Web Navigation 事件監聽器取消註冊完成')
    } catch (error) {
      this.logger.error('[FAIL] 取消註冊 Web Navigation 監聽器失敗:', error)
    }
  }

  /**
   * 初始化路由分析器
   */
  async initializeRouteAnalyzers () {
    // Readmoo 頁面路由分析器
    this.routeAnalyzer.set('readmoo_routes', (url) => {
      if (!url.includes('readmoo.com')) return null

      const route = {
        domain: 'readmoo',
        path: this.extractPath(url),
        pageType: this.classifyReadmooPage(url),
        parameters: this.extractParameters(url)
      }

      return route
    })

    // 導航模式分析器
    this.behaviorTracker.set('navigation_patterns', (history) => {
      const patterns = []

      if (history.length >= 2) {
        const recent = history.slice(-2)
        const pattern = recent.map(nav => nav.route?.pageType).join(' -> ')
        patterns.push({
          type: 'sequence',
          pattern,
          frequency: this.getPatternFrequency(pattern)
        })
      }

      return patterns
    })

    this.logger.log(`[OK] 初始化了 ${this.routeAnalyzer.size} 個路由分析器`)
  }

  /**
   * 處理導航開始事件
   */
  async handleBeforeNavigate (details) {
    if (!this.shouldTrackNavigation(details)) return

    try {
      this.stats.eventsProcessed++

      const { tabId, url, frameId, timeStamp } = details

      // 只追蹤主框架
      if (frameId !== 0 && !this.config.trackSubFrames) return

      this.logger.log(`導航開始: ${url} (分頁 ${tabId})`)

      // 創建導航記錄
      const navigation = {
        id: `nav_${tabId}_${timeStamp}`,
        tabId,
        url,
        frameId,
        startTime: timeStamp,
        status: 'started',
        route: await this.analyzeRoute(url)
      }

      // 設定防抖處理
      this.debounceNavigation(tabId, () => {
        this.recordNavigation(tabId, navigation)
      })
    } catch (error) {
      this.logger.error('[FAIL] 處理導航開始事件失敗:', error)
    }
  }

  /**
   * 處理導航提交事件
   */
  async handleNavigationCommitted (details) {
    if (!this.shouldTrackNavigation(details)) return

    try {
      this.stats.eventsProcessed++

      const { tabId, url, frameId, timeStamp, transitionType, transitionQualifiers } = details

      if (frameId !== 0 && !this.config.trackSubFrames) return

      this.logger.log(`導航提交: ${url} (${transitionType})`)

      // 更新當前導航
      const currentNav = this.currentNavigations.get(tabId)
      if (currentNav) {
        currentNav.status = 'committed'
        currentNav.commitTime = timeStamp
        currentNav.transitionType = transitionType
        currentNav.transitionQualifiers = transitionQualifiers
      }

      // 發送導航變更事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.NAVIGATION.COMMITTED', {
          tabId,
          url,
          transitionType,
          route: currentNav?.route
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理導航提交事件失敗:', error)
    }
  }

  /**
   * 處理導航完成事件
   */
  async handleNavigationCompleted (details) {
    if (!this.shouldTrackNavigation(details)) return

    try {
      this.stats.eventsProcessed++

      const { tabId, url, frameId, timeStamp } = details

      if (frameId !== 0 && !this.config.trackSubFrames) return

      this.logger.log(`導航完成: ${url}`)

      // 更新當前導航
      const currentNav = this.currentNavigations.get(tabId)
      if (currentNav) {
        currentNav.status = 'completed'
        currentNav.completeTime = timeStamp
        currentNav.duration = timeStamp - currentNav.startTime

        // 分析導航模式
        if (this.config.analyzePatterns) {
          await this.analyzeNavigationPatterns(tabId)
        }
      }

      // 發送導航完成事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.NAVIGATION.COMPLETED', {
          tabId,
          url,
          navigation: currentNav
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理導航完成事件失敗:', error)
    }
  }

  /**
   * 處理導航錯誤事件
   */
  async handleNavigationError (details) {
    if (!this.shouldTrackNavigation(details)) return

    try {
      this.stats.eventsProcessed++

      const { tabId, url, error, frameId, timeStamp } = details

      if (frameId !== 0 && !this.config.trackSubFrames) return

      this.logger.warn(`導航錯誤: ${url} - ${error}`)

      // 更新當前導航
      const currentNav = this.currentNavigations.get(tabId)
      if (currentNav) {
        currentNav.status = 'error'
        currentNav.error = error
        currentNav.errorTime = timeStamp
      }

      // 發送導航錯誤事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.NAVIGATION.ERROR', {
          tabId,
          url,
          error,
          navigation: currentNav
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理導航錯誤事件失敗:', error)
    }
  }

  /**
   * 處理歷史狀態更新事件
   */
  async handleHistoryStateUpdated (details) {
    if (!this.shouldTrackNavigation(details)) return

    try {
      this.stats.eventsProcessed++

      const { tabId, url, frameId, timeStamp, transitionType, transitionQualifiers } = details

      if (frameId !== 0 && !this.config.trackSubFrames) return

      this.logger.log(`歷史狀態更新: ${url}`)

      // 記錄為歷史導航
      const navigation = {
        id: `hist_${tabId}_${timeStamp}`,
        tabId,
        url,
        frameId,
        startTime: timeStamp,
        status: 'history_updated',
        transitionType,
        transitionQualifiers,
        route: await this.analyzeRoute(url)
      }

      this.recordNavigation(tabId, navigation)

      // 發送歷史更新事件
      if (this.eventBus) {
        await this.eventBus.emit('PAGE.NAVIGATION.HISTORY_UPDATED', {
          tabId,
          url,
          navigation
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理歷史狀態更新事件失敗:', error)
    }
  }

  /**
   * 判斷是否應該追蹤導航
   */
  shouldTrackNavigation (details) {
    if (!this.state.tracking) return false

    const { url } = details

    // 只追蹤 HTTP/HTTPS 協議
    if (!url.startsWith('http://') && !url.startsWith('https://')) return false

    // 重點追蹤 Readmoo 網站
    return url.includes('readmoo.com')
  }

  /**
   * 防抖導航處理
   */
  debounceNavigation (tabId, callback) {
    // 清除現有計時器
    if (this.navigationTimers.has(tabId)) {
      clearTimeout(this.navigationTimers.get(tabId))
    }

    // 設定新計時器
    const timer = setTimeout(() => {
      callback()
      this.navigationTimers.delete(tabId)
    }, this.config.debounceDelay)

    this.navigationTimers.set(tabId, timer)
  }

  /**
   * 清理導航計時器
   */
  clearNavigationTimers () {
    for (const timer of this.navigationTimers.values()) {
      clearTimeout(timer)
    }
    this.navigationTimers.clear()
  }

  /**
   * 記錄導航
   */
  recordNavigation (tabId, navigation) {
    // 更新當前導航
    this.currentNavigations.set(tabId, navigation)

    // 添加到歷史記錄
    if (!this.navigationHistory.has(tabId)) {
      this.navigationHistory.set(tabId, [])
    }

    const history = this.navigationHistory.get(tabId)
    history.push(navigation)

    // 限制歷史記錄長度
    if (history.length > this.config.maxHistoryEntries) {
      history.splice(0, history.length - this.config.maxHistoryEntries)
    }

    this.stats.navigationsTracked++
    this.logger.log(`[LOG] 記錄導航: ${navigation.url} (分頁 ${tabId})`)
  }

  /**
   * 分析路由
   */
  async analyzeRoute (url) {
    this.stats.routesAnalyzed++

    for (const [name, analyzer] of this.routeAnalyzer) {
      try {
        const route = analyzer(url)
        if (route) {
          return { analyzer: name, ...route }
        }
      } catch (error) {
        this.logger.error(`[FAIL] 路由分析器執行失敗 (${name}):`, error)
      }
    }

    return null
  }

  /**
   * 分析導航模式
   */
  async analyzeNavigationPatterns (tabId) {
    const history = this.navigationHistory.get(tabId)
    if (!history || history.length < 2) return

    for (const [name, tracker] of this.behaviorTracker) {
      try {
        const patterns = tracker(history)
        if (patterns && patterns.length > 0) {
          this.stats.patternsDetected++
          this.logger.log(`[CHECK] 檢測到導航模式: ${JSON.stringify(patterns)}`)

          // 發送模式檢測事件
          if (this.eventBus) {
            await this.eventBus.emit('PAGE.NAVIGATION.PATTERN_DETECTED', {
              tabId,
              patterns,
              analyzer: name
            })
          }
        }
      } catch (error) {
        this.logger.error(`[FAIL] 導航模式分析失敗 (${name}):`, error)
      }
    }
  }

  /**
   * 提取路徑
   */
  extractPath (url) {
    try {
      const urlObj = new URL(url)
      return urlObj.pathname
    } catch (error) {
      return ''
    }
  }

  /**
   * 提取參數
   */
  extractParameters (url) {
    try {
      const urlObj = new URL(url)
      return Object.fromEntries(urlObj.searchParams)
    } catch (error) {
      return {}
    }
  }

  /**
   * 分類 Readmoo 頁面
   */
  classifyReadmooPage (url) {
    if (url.includes('/library')) return 'library'
    if (url.match(/\/book\/\d+/)) return 'book_detail'
    if (url.includes('/reader')) return 'reader'
    if (url.includes('/search')) return 'search'
    if (url.includes('/profile')) return 'profile'
    return 'main'
  }

  /**
   * 獲取模式頻率
   */
  getPatternFrequency (pattern) {
    if (!this.navigationPatterns.has(pattern)) {
      this.navigationPatterns.set(pattern, 0)
    }

    const count = this.navigationPatterns.get(pattern) + 1
    this.navigationPatterns.set(pattern, count)
    return count
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
        event: NAVIGATION_EVENTS.HISTORY_REQUEST,
        handler: this.handleHistoryRequest.bind(this),
        priority: EVENT_PRIORITIES.NORMAL
      },
      {
        event: NAVIGATION_EVENTS.PATTERN_REQUEST,
        handler: this.handlePatternRequest.bind(this),
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
   * 處理歷史請求
   */
  async handleHistoryRequest (event) {
    try {
      const { tabId, requestId } = event.data || {}

      let result
      if (tabId) {
        result = this.getNavigationHistory(tabId)
      } else {
        result = this.getAllNavigationHistories()
      }

      if (this.eventBus) {
        await this.eventBus.emit('PAGE.NAVIGATION.HISTORY_RESPONSE', {
          requestId,
          tabId,
          result
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理導航歷史請求失敗:', error)
    }
  }

  /**
   * 處理模式請求
   */
  async handlePatternRequest (event) {
    try {
      const { requestId } = event.data || {}

      const result = {
        patterns: Object.fromEntries(this.navigationPatterns),
        totalPatterns: this.navigationPatterns.size,
        totalNavigations: this.stats.navigationsTracked
      }

      if (this.eventBus) {
        await this.eventBus.emit('PAGE.NAVIGATION.PATTERN_RESPONSE', {
          requestId,
          result
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 處理導航模式請求失敗:', error)
    }
  }

  /**
   * 獲取導航歷史
   */
  getNavigationHistory (tabId) {
    return this.navigationHistory.get(tabId) || []
  }

  /**
   * 獲取所有導航歷史
   */
  getAllNavigationHistories () {
    return Object.fromEntries(this.navigationHistory)
  }

  /**
   * 獲取當前導航
   */
  getCurrentNavigation (tabId) {
    return this.currentNavigations.get(tabId) || null
  }

  /**
   * 獲取所有當前導航
   */
  getAllCurrentNavigations () {
    return Object.fromEntries(this.currentNavigations)
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
      tabsTracked: this.navigationHistory.size,
      currentNavigations: this.currentNavigations.size,
      patternsDetected: this.navigationPatterns.size,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    const isHealthy = this.state.initialized && this.state.tracking

    return {
      service: 'NavigationService',
      healthy: isHealthy,
      status: this.state.active ? 'active' : 'inactive',
      tracking: this.state.tracking,
      metrics: {
        navigationsTracked: this.stats.navigationsTracked,
        patternsDetected: this.stats.patternsDetected,
        eventsProcessed: this.stats.eventsProcessed,
        routesAnalyzed: this.stats.routesAnalyzed,
        activeNavigations: this.currentNavigations.size
      }
    }
  }
}

module.exports = NavigationService
