/**
 * @fileoverview Event Utils - 事件處理工具
 * @version v1.0.0
 * @since 2025-08-17
 *
 * 負責功能：
 * - 事件監聽器生命週期管理
 * - Chrome Extension 訊息傳遞
 * - 事件委派和批處理
 * - Content Script 特定事件處理
 * - 事件防抖和節流
 *
 * 設計考量：
 * - 統一的事件管理接口
 * - 自動清理和記憶體管理
 * - 防禦性程式設計
 * - Chrome Extension 最佳實踐
 *
 * 使用情境：
 * - DOM 事件監聽管理
 * - Chrome Extension 訊息通訊
 * - 頁面交互事件處理
 * - 效能優化的事件處理
 */

/**
 * 事件處理工具類
 */
class EventUtils {
  constructor () {
    this.listeners = new Map()
    this.messageHandlers = new Map()
    this.delegates = new Map()
    this.batches = new Map()
    this.debounceTimers = new Map()
    this.throttleTimers = new Map()
    this.mutationObservers = new Map()
    this.customEvents = new Map()
    this.eventStats = {
      totalListeners: 0,
      totalEvents: 0,
      byType: {},
      performance: {
        events: []
      }
    }

    // 初始化 Chrome Extension 訊息監聽
    this._chromeMessageListener = null
    this._initializeChromeMessageHandling()
  }

  /**
   * 添加事件監聽器
   * @param {Element} element - 目標元素
   * @param {string} type - 事件類型
   * @param {Function} handler - 事件處理函數
   * @param {Object} options - 選項
   * @returns {Object} 註冊結果
   */
  addEventListener (element, type, handler, options = {}) {
    if (!element || typeof type !== 'string' || typeof handler !== 'function') {
      return {
        success: false,
        error: new Error('Invalid parameters')
      }
    }

    try {
      const listenerId = options.id || `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // 包裝處理函數以收集統計
      const wrappedHandler = (event) => {
        const startTime = performance.now()

        try {
          const result = handler(event)

          // 記錄事件統計
          this._recordEventExecution(type, performance.now() - startTime)

          return result
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Event handler error:', error)
          throw error
        }
      }

      // 處理一次性監聽器
      if (options.once) {
        const onceWrapper = (event) => {
          wrappedHandler(event)
          this.removeEventListener(listenerId)
        }
        element.addEventListener(type, onceWrapper, options)

        this.listeners.set(listenerId, {
          element,
          type,
          handler: onceWrapper,
          original: handler,
          options,
          registered: Date.now()
        })
      } else {
        element.addEventListener(type, wrappedHandler, options)

        this.listeners.set(listenerId, {
          element,
          type,
          handler: wrappedHandler,
          original: handler,
          options,
          registered: Date.now()
        })
      }

      this.eventStats.totalListeners++
      this.eventStats.byType[type] = (this.eventStats.byType[type] || 0) + 1

      return {
        success: true,
        listenerId,
        element,
        type,
        registered: true
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 移除事件監聽器
   * @param {string} listenerId - 監聽器ID
   * @returns {Object} 移除結果
   */
  removeEventListener (listenerId) {
    if (!listenerId || typeof listenerId !== 'string') {
      return {
        success: false,
        error: new Error('Invalid listener ID')
      }
    }

    const listener = this.listeners.get(listenerId)

    if (!listener) {
      return {
        success: false,
        error: new Error('Listener not found')
      }
    }

    try {
      listener.element.removeEventListener(listener.type, listener.handler, listener.options)
      this.listeners.delete(listenerId)

      this.eventStats.totalListeners--
      if (this.eventStats.byType[listener.type] > 0) {
        this.eventStats.byType[listener.type]--
      }

      return {
        success: true,
        listenerId,
        removed: true
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 批量添加事件監聽器
   * @param {Element} element - 目標元素
   * @param {Array} eventConfigs - 事件配置列表
   * @returns {Object} 批量註冊結果
   */
  addEventListeners (element, eventConfigs) {
    if (!element || !Array.isArray(eventConfigs)) {
      return {
        success: false,
        error: new Error('Invalid parameters')
      }
    }

    const results = []
    let registered = 0
    let failed = 0

    eventConfigs.forEach(config => {
      const result = this.addEventListener(element, config.type, config.handler, config)

      if (result.success) {
        registered++
        results.push(result)
      } else {
        failed++
      }
    })

    return {
      success: true,
      registered,
      failed,
      listeners: results
    }
  }

  /**
   * 取得所有監聽器
   * @returns {Object} 監聽器資訊
   */
  getAllListeners () {
    const listeners = Array.from(this.listeners.values())
    const byType = {}
    const byContext = {}

    listeners.forEach(listener => {
      byType[listener.type] = (byType[listener.type] || 0) + 1

      const context = listener.options.context || 'default'
      byContext[context] = (byContext[context] || 0) + 1
    })

    return {
      total: listeners.length,
      byType,
      byContext,
      listeners: listeners.map(l => ({
        listenerId: Array.from(this.listeners.entries()).find(([id, data]) => data === l)?.[0],
        type: l.type,
        context: l.options.context,
        registered: l.registered
      }))
    }
  }

  /**
   * 清理所有事件監聽器
   * @returns {Object} 清理結果
   */
  clearAllListeners () {
    let removed = 0
    let errors = 0

    for (const [listenerId] of this.listeners) {
      const result = this.removeEventListener(listenerId)
      if (result.success) {
        removed++
      } else {
        errors++
      }
    }

    return {
      success: true,
      removed,
      errors
    }
  }

  /**
   * 發送訊息給 Background Script
   * @param {Object} message - 訊息內容
   * @param {Object} options - 選項
   * @returns {Promise} 發送結果
   */
  async sendMessage (message, options = {}) {
    if (!message || typeof message !== 'object') {
      return {
        success: false,
        error: new Error('Invalid message')
      }
    }

    return new Promise((resolve) => {
      try {
        if (!chrome || !chrome.runtime) {
          resolve({
            success: false,
            error: new Error('Chrome runtime not available')
          })
          return
        }

        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const fullMessage = {
          ...message,
          messageId,
          timestamp: Date.now()
        }

        // 檢查是否有上下文失效錯誤
        if (chrome.runtime.lastError) {
          // 觸發上下文失效處理
          if (this._contextLostHandler) {
            setTimeout(() => this._contextLostHandler(), 0)
          }

          resolve({
            success: false,
            error: chrome.runtime.lastError
          })
          return
        }

        chrome.runtime.sendMessage(fullMessage, (response) => {
          if (chrome.runtime.lastError) {
            // 觸發上下文失效處理
            if (this._contextLostHandler) {
              setTimeout(() => this._contextLostHandler(), 0)
            }

            resolve({
              success: false,
              error: chrome.runtime.lastError
            })
          } else {
            resolve({
              success: true,
              response,
              messageId
            })
          }
        })
      } catch (error) {
        resolve({
          success: false,
          error
        })
      }
    })
  }

  /**
   * 帶重試的訊息發送
   * @param {Object} message - 訊息內容
   * @param {Object} options - 重試選項
   * @returns {Promise} 發送結果
   */
  async sendMessageWithRetry (message, options = {}) {
    const { maxRetries = 3, retryDelay = 1000 } = options
    let lastError
    let attempts = 0

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      attempts++

      try {
        // 在重試時暫時清除錯誤狀態
        if (attempt > 0 && chrome && chrome.runtime) {
          chrome.runtime.lastError = null
        }

        const result = await this.sendMessage(message)

        if (result.success) {
          return {
            ...result,
            attempts
          }
        }

        lastError = result.error

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
        }
      } catch (error) {
        lastError = error

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts
    }
  }

  /**
   * 監聽訊息
   * @param {string} messageType - 訊息類型或模式
   * @param {Function} handler - 處理函數
   * @returns {Object} 監聽結果
   */
  onMessage (messageType, handler) {
    if (!messageType || typeof handler !== 'function') {
      return {
        success: false,
        error: new Error('Invalid parameters')
      }
    }

    const handlerId = `msg-handler-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    this.messageHandlers.set(handlerId, {
      pattern: messageType,
      handler,
      registered: Date.now()
    })

    // 確保訊息監聽器已初始化
    if (!this._chromeMessageListener && chrome && chrome.runtime && chrome.runtime.onMessage) {
      this._initializeChromeMessageHandling()
    }

    return {
      success: true,
      messageType,
      handlerId
    }
  }

  /**
   * 事件委派
   * @param {Element} container - 容器元素
   * @param {string} selector - 目標選擇器
   * @param {string} type - 事件類型
   * @param {Function} handler - 處理函數
   * @param {Object} options - 選項
   * @returns {Object} 委派結果
   */
  delegate (container, selector, type, handler, options = {}) {
    if (!container || !selector || !type || typeof handler !== 'function') {
      return {
        success: false,
        error: new Error('Invalid parameters')
      }
    }

    const delegateId = options.delegateId || `delegate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const delegateHandler = (event) => {
      const target = event.target.closest(selector)
      if (target && container.contains(target)) {
        const delegateEvent = {
          ...event,
          target: event.target,
          delegateTarget: target
        }
        handler(delegateEvent)
      }
    }

    container.addEventListener(type, delegateHandler, options)

    this.delegates.set(delegateId, {
      container,
      selector,
      type,
      handler: delegateHandler,
      original: handler,
      options
    })

    return {
      success: true,
      delegateId,
      selector,
      container
    }
  }

  /**
   * 批量添加事件監聽器
   * @param {Array} elements - 元素列表
   * @param {string} type - 事件類型
   * @param {Function} handler - 處理函數
   * @param {Object} options - 選項
   * @returns {Object} 批量結果
   */
  batchAddEventListeners (elements, type, handler, options = {}) {
    if (!Array.isArray(elements) || !type || typeof handler !== 'function') {
      return {
        success: false,
        error: new Error('Invalid parameters')
      }
    }

    const batchId = options.batchId || `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const listeners = []
    let processed = 0
    let failed = 0

    elements.forEach((element, index) => {
      const listenerOptions = {
        ...options,
        id: `${batchId}-${index}`
      }

      const result = this.addEventListener(element, type, handler, listenerOptions)

      if (result.success) {
        processed++
        listeners.push(result)
      } else {
        failed++
      }
    })

    this.batches.set(batchId, {
      listeners: listeners.map(l => l.listenerId),
      options
    })

    return {
      success: true,
      batchId,
      processed,
      failed,
      listeners
    }
  }

  /**
   * 移除批量監聽器
   * @param {string} batchId - 批次ID
   * @returns {Object} 移除結果
   */
  removeBatchListeners (batchId) {
    const batch = this.batches.get(batchId)

    if (!batch) {
      return {
        success: false,
        error: new Error('Batch not found')
      }
    }

    let removed = 0
    let errors = 0

    batch.listeners.forEach(listenerId => {
      const result = this.removeEventListener(listenerId)
      if (result.success) {
        removed++
      } else {
        errors++
      }
    })

    this.batches.delete(batchId)

    return {
      success: true,
      batchId,
      removed,
      errors
    }
  }

  /**
   * 添加防抖監聽器
   * @param {Element} element - 目標元素
   * @param {string} type - 事件類型
   * @param {Function} handler - 處理函數
   * @param {Object} options - 選項
   * @returns {Object} 註冊結果
   */
  addDebouncedListener (element, type, handler, options = {}) {
    const { delay = 300, id } = options
    const listenerId = id || `debounce-${type}-${Date.now()}`

    const debouncedHandler = (event) => {
      // 清除之前的計時器
      if (this.debounceTimers.has(listenerId)) {
        clearTimeout(this.debounceTimers.get(listenerId))
      }

      // 設定新的計時器
      const timer = setTimeout(() => {
        handler(event)
        this.debounceTimers.delete(listenerId)
      }, delay)

      this.debounceTimers.set(listenerId, timer)
    }

    const result = this.addEventListener(element, type, debouncedHandler, { ...options, id: listenerId })

    return result
  }

  /**
   * 添加節流監聽器
   * @param {Element} element - 目標元素
   * @param {string} type - 事件類型
   * @param {Function} handler - 處理函數
   * @param {Object} options - 選項
   * @returns {Object} 註冊結果
   */
  addThrottledListener (element, type, handler, options = {}) {
    const { interval = 100, id } = options
    const listenerId = id || `throttle-${type}-${Date.now()}`

    const throttledHandler = (event) => {
      if (!this.throttleTimers.has(listenerId)) {
        handler(event)

        this.throttleTimers.set(listenerId, setTimeout(() => {
          this.throttleTimers.delete(listenerId)
        }, interval))
      }
    }

    const result = this.addEventListener(element, type, throttledHandler, { ...options, id: listenerId })

    return result
  }

  /**
   * 取消防抖
   * @param {string} listenerId - 監聽器ID
   * @returns {Object} 取消結果
   */
  cancelDebounce (listenerId) {
    if (this.debounceTimers.has(listenerId)) {
      clearTimeout(this.debounceTimers.get(listenerId))
      this.debounceTimers.delete(listenerId)

      return {
        success: true,
        listenerId,
        canceled: true
      }
    }

    return {
      success: false,
      error: new Error('Debounce timer not found')
    }
  }

  /**
   * 頁面就緒監聽
   * @param {Function} handler - 處理函數
   * @param {Object} options - 選項
   * @returns {Object} 監聽結果
   */
  onPageReady (handler, options = {}) {
    const handlerId = `ready-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    if (document.readyState === 'complete') {
      setTimeout(handler, 0)
    } else {
      document.addEventListener('DOMContentLoaded', handler, { once: true })
    }

    return {
      success: true,
      handlerId,
      readyState: document.readyState
    }
  }

  /**
   * DOM 變化監控
   * @param {Element} target - 監控目標
   * @param {Function} handler - 處理函數
   * @param {Object} options - 監控選項
   * @returns {Object} 監控結果
   */
  observeDOM (target, handler, options = {}) {
    const observerId = options.observerId || `observer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    try {
      const observer = new MutationObserver(handler)
      observer.observe(target, {
        childList: true,
        subtree: false,
        ...options
      })

      this.mutationObservers.set(observerId, observer)

      return {
        success: true,
        observerId,
        target,
        observing: true
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * URL 變化監聽
   * @param {Function} handler - 處理函數
   * @param {Object} options - 選項
   * @returns {Object} 監聽結果
   */
  onURLChange (handler, options = {}) {
    const handlerId = options.handlerId || `url-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // 簡化實作：監聽 popstate 事件
    window.addEventListener('popstate', handler)

    return {
      success: true,
      handlerId,
      currentURL: window.location.href
    }
  }

  /**
   * 擴展上下文失效監聽
   * @param {Function} handler - 處理函數
   * @returns {Object} 監聽結果
   */
  onExtensionContextLost (handler) {
    const handlerId = `context-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // 監控 Chrome API 錯誤
    this._contextLostHandler = handler

    return {
      success: true,
      handlerId,
      monitoring: true
    }
  }

  /**
   * 自定義事件監聽
   * @param {string} eventName - 事件名稱
   * @param {Function} handler - 處理函數
   * @returns {Object} 監聽結果
   */
  on (eventName, handler) {
    if (!this.customEvents.has(eventName)) {
      this.customEvents.set(eventName, [])
    }

    this.customEvents.get(eventName).push(handler)

    return {
      success: true,
      eventName,
      listeners: this.customEvents.get(eventName).length
    }
  }

  /**
   * 觸發自定義事件
   * @param {string} eventName - 事件名稱
   * @param {any} data - 事件資料
   * @returns {Object} 觸發結果
   */
  emit (eventName, data) {
    const handlers = this.customEvents.get(eventName) || []

    handlers.forEach(handler => {
      try {
        handler(data)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Custom event handler error:', error)
      }
    })

    return {
      success: true,
      event: eventName,
      listeners: handlers.length
    }
  }

  /**
   * 取得事件統計
   * @returns {Object} 統計資訊
   */
  getEventStats () {
    const performance = this.eventStats.performance
    const events = performance.events

    return {
      totalListeners: this.eventStats.totalListeners,
      totalEvents: this.eventStats.totalEvents,
      byType: { ...this.eventStats.byType },
      performance: {
        averageExecutionTime: events.length > 0
          ? events.reduce((sum, e) => sum + e.duration, 0) / events.length
          : 0,
        slowestEvent: events.length > 0
          ? events.reduce((max, e) => e.duration > max.duration ? e : max)
          : null,
        fastestEvent: events.length > 0
          ? events.reduce((min, e) => e.duration < min.duration ? e : min)
          : null
      },
      memoryUsage: {
        listeners: this.listeners.size,
        delegates: this.delegates.size,
        batches: this.batches.size
      }
    }
  }

  /**
   * 產生診斷報告
   * @returns {Object} 診斷報告
   */
  generateDiagnostics () {
    const listeners = Array.from(this.listeners.values())
    const potentialLeaks = listeners.filter(l => !document.contains(l.element)).length

    return {
      summary: {
        totalListeners: listeners.length,
        potentialLeaks,
        performanceIssues: []
      },
      details: {
        listeners: listeners.map(l => ({
          type: l.type,
          registered: l.registered,
          attached: document.contains(l.element)
        })),
        delegates: Array.from(this.delegates.keys()),
        messageHandlers: Array.from(this.messageHandlers.keys())
      },
      recommendations: potentialLeaks > 0 ? ['清理已分離的事件監聽器'] : []
    }
  }

  /**
   * 檢測事件洩漏
   * @returns {Object} 洩漏檢測結果
   */
  detectEventLeaks () {
    const listeners = Array.from(this.listeners.values())
    const detachedListeners = listeners.filter(l => !document.contains(l.element))

    return {
      potentialLeaks: detachedListeners.length,
      detachedListeners: detachedListeners.map(l => ({
        type: l.type,
        registered: l.registered
      })),
      orphanedDelegates: [],
      recommendations: detachedListeners.length > 0
        ? ['清理分離的 DOM 元素的事件監聽器']
        : []
    }
  }

  // ==================
  // 私有輔助方法
  // ==================

  /**
   * 初始化 Chrome 訊息處理
   * @private
   */
  _initializeChromeMessageHandling () {
    if (chrome && chrome.runtime && chrome.runtime.onMessage && !this._chromeMessageListener) {
      this._chromeMessageListener = (message, sender, sendResponse) => {
        this.messageHandlers.forEach(({ pattern, handler }) => {
          if (this._matchesPattern(message.type, pattern)) {
            try {
              handler(message, sender, sendResponse)
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error('Message handler error:', error)
            }
          }
        })
      }
      chrome.runtime.onMessage.addListener(this._chromeMessageListener)
    }
  }

  /**
   * 檢查訊息是否匹配模式
   * @param {string} messageType - 訊息類型
   * @param {string} pattern - 模式
   * @returns {boolean} 是否匹配
   * @private
   */
  _matchesPattern (messageType, pattern) {
    if (!messageType || !pattern) return false

    try {
      const regex = new RegExp(pattern)
      return regex.test(messageType)
    } catch (error) {
      return messageType === pattern
    }
  }

  /**
   * 記錄事件執行統計
   * @param {string} type - 事件類型
   * @param {number} duration - 執行時間
   * @private
   */
  _recordEventExecution (type, duration) {
    this.eventStats.totalEvents++
    this.eventStats.performance.events.push({
      type,
      duration,
      timestamp: Date.now()
    })

    // 限制歷史記錄大小
    if (this.eventStats.performance.events.length > 100) {
      this.eventStats.performance.events.shift()
    }
  }
}

// 建立單例實例
const eventUtils = new EventUtils()

// 匯出靜態方法介面
module.exports = {
  addEventListener: (element, type, handler, options) => eventUtils.addEventListener(element, type, handler, options),
  removeEventListener: (listenerId) => eventUtils.removeEventListener(listenerId),
  addEventListeners: (element, eventConfigs) => eventUtils.addEventListeners(element, eventConfigs),
  getAllListeners: () => eventUtils.getAllListeners(),
  clearAllListeners: () => eventUtils.clearAllListeners(),
  sendMessage: (message, options) => eventUtils.sendMessage(message, options),
  sendMessageWithRetry: (message, options) => eventUtils.sendMessageWithRetry(message, options),
  onMessage: (messageType, handler) => eventUtils.onMessage(messageType, handler),
  delegate: (container, selector, type, handler, options) => eventUtils.delegate(container, selector, type, handler, options),
  batchAddEventListeners: (elements, type, handler, options) => eventUtils.batchAddEventListeners(elements, type, handler, options),
  removeBatchListeners: (batchId) => eventUtils.removeBatchListeners(batchId),
  addDebouncedListener: (element, type, handler, options) => eventUtils.addDebouncedListener(element, type, handler, options),
  addThrottledListener: (element, type, handler, options) => eventUtils.addThrottledListener(element, type, handler, options),
  cancelDebounce: (listenerId) => eventUtils.cancelDebounce(listenerId),
  onPageReady: (handler, options) => eventUtils.onPageReady(handler, options),
  observeDOM: (target, handler, options) => eventUtils.observeDOM(target, handler, options),
  onURLChange: (handler, options) => eventUtils.onURLChange(handler, options),
  onExtensionContextLost: (handler) => eventUtils.onExtensionContextLost(handler),
  on: (eventName, handler) => eventUtils.on(eventName, handler),
  emit: (eventName, data) => eventUtils.emit(eventName, data),
  getEventStats: () => eventUtils.getEventStats(),
  generateDiagnostics: () => eventUtils.generateDiagnostics(),
  detectEventLeaks: () => eventUtils.detectEventLeaks()
}
