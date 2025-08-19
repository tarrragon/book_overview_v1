/**
 * EventManager - Popup 統一事件管理器
 *
 * 負責功能：
 * - 統一事件監聽器註冊和管理
 * - 事件分類和配置管理
 * - 錯誤處理和重試機制
 * - 事件清理和資源管理
 *
 * 設計考量：
 * - 統一事件處理：提供一致的事件綁定和管理接口
 * - 分類管理：支援不同類型事件的分類管理
 * - 錯誤恢復：提供重試機制和錯誤處理
 * - 資源追蹤：完整的事件監聽器生命週期管理
 *
 * 處理流程：
 * 1. 初始化事件分類和預設配置
 * 2. 根據配置註冊事件監聽器
 * 3. 提供事件處理錯誤恢復機制
 * 4. 統計和監控事件執行狀況
 * 5. 支援資源清理和選擇性移除
 *
 * 使用情境：
 * - PopupController 的統一事件管理
 * - 支援動態事件配置和清理
 * - 提供事件執行統計和錯誤追蹤
 *
 * @version 1.0.0
 * @since 2025-08-19
 */

class EventManager {
  /**
   * 建構 EventManager
   * @param {Document} document - DOM 文件物件
   * @param {Object} components - 組件容器
   */
  constructor (document, components) {
    this.document = document
    this.components = components

    // 事件分類
    this.eventCategories = [
      'UI_ACTIONS',      // UI 操作事件
      'BUSINESS_LOGIC',  // 業務邏輯事件
      'SYSTEM_EVENTS',   // 系統事件
      'ERROR_HANDLING'   // 錯誤處理事件
    ]

    // 事件配置
    this.eventConfigs = {}

    // 追蹤註冊的事件監聽器
    this.registeredEvents = []
    this.trackedListeners = []

    // 錯誤處理
    this.failedBindings = []
    this.eventErrors = []

    // 重試機制
    this.retryConfigs = {}
    this.retryStats = {}

    // 統計資訊
    this.stats = {
      totalEvents: 0,
      totalTriggers: 0,
      errorCount: 0,
      retryCount: 0,
      categories: {}
    }

    // 初始化預設配置
    this._initializeDefaultConfigs()
  }

  /**
   * 獲取支援的事件分類
   * @returns {Array<string>} 事件分類列表
   */
  getEventCategories () {
    return [...this.eventCategories]
  }

  /**
   * 獲取事件配置
   * @returns {Object} 事件配置物件
   */
  getEventConfigs () {
    return { ...this.eventConfigs }
  }

  /**
   * 獲取已註冊的事件
   * @returns {Array} 已註冊事件列表
   */
  getRegisteredEvents () {
    return [...this.registeredEvents]
  }

  /**
   * 獲取追蹤的監聽器
   * @returns {Array} 追蹤的監聽器列表
   */
  getTrackedListeners () {
    return [...this.trackedListeners]
  }

  /**
   * 獲取綁定失敗記錄
   * @returns {Array} 失敗綁定列表
   */
  getFailedBindings () {
    return [...this.failedBindings]
  }

  /**
   * 獲取事件錯誤記錄
   * @returns {Array} 事件錯誤列表
   */
  getEventErrors () {
    return [...this.eventErrors]
  }

  /**
   * 綁定所有配置的事件
   */
  bindEvents () {
    Object.entries(this.eventConfigs).forEach(([configKey, config]) => {
      this._bindSingleEvent(configKey, config)
    })
  }

  /**
   * 註冊單一事件
   * @param {string} elementId - 元素 ID
   * @param {string} eventType - 事件類型
   * @param {Function} handler - 事件處理函數
   * @param {Object} options - 事件選項
   */
  registerEvent (elementId, eventType, handler, options = {}) {
    const config = {
      elementId,
      eventType,
      handler,
      category: options.category || 'UI_ACTIONS',
      options: options.eventOptions || {}
    }

    this._bindSingleEvent(`${elementId}-${eventType}`, config)
  }

  /**
   * 取消註冊事件
   * @param {string} elementId - 元素 ID
   * @param {string} eventType - 事件類型
   */
  unregisterEvent (elementId, eventType) {
    const listeners = this.trackedListeners.filter(
      l => l.elementId === elementId && l.eventType === eventType
    )

    listeners.forEach(listener => {
      if (listener.element && listener.element.removeEventListener) {
        listener.element.removeEventListener(listener.eventType, listener.listener)
      }
    })

    // 從追蹤列表中移除
    this.trackedListeners = this.trackedListeners.filter(
      l => !(l.elementId === elementId && l.eventType === eventType)
    )

    // 從註冊列表中移除
    this.registeredEvents = this.registeredEvents.filter(
      e => !(e.elementId === elementId && e.eventType === eventType)
    )
  }

  /**
   * 啟用重試機制
   * @param {string} elementId - 元素 ID
   * @param {Object} retryConfig - 重試配置
   */
  enableRetry (elementId, retryConfig) {
    this.retryConfigs[elementId] = {
      maxRetries: retryConfig.maxRetries || 3,
      delay: retryConfig.delay || 1000,
      ...retryConfig
    }

    this.retryStats[elementId] = {
      totalRetries: 0,
      lastSuccess: false,
      lastError: null
    }
  }

  /**
   * 獲取重試統計
   * @param {string} elementId - 元素 ID
   * @returns {Object} 重試統計資訊
   */
  getRetryStats (elementId) {
    return this.retryStats[elementId] || null
  }

  /**
   * 按分類清理事件
   * @param {string} category - 事件分類
   */
  cleanupByCategory (category) {
    const listenersToRemove = this.trackedListeners.filter(l => l.category === category)

    listenersToRemove.forEach(listener => {
      if (listener.element && listener.element.removeEventListener) {
        listener.element.removeEventListener(listener.eventType, listener.listener)
      }
    })

    // 從追蹤列表中移除
    this.trackedListeners = this.trackedListeners.filter(l => l.category !== category)

    // 從註冊列表中移除
    this.registeredEvents = this.registeredEvents.filter(e => e.category !== category)
  }

  /**
   * 新增事件配置
   * @param {string} configKey - 配置鍵
   * @param {Object} config - 事件配置
   */
  addEventConfig (configKey, config) {
    // 驗證配置
    this._validateEventConfig(config)

    this.eventConfigs[configKey] = { ...config }

    // 如果已經初始化，立即綁定事件
    if (this.document) {
      this._bindSingleEvent(configKey, config)
    }
  }

  /**
   * 移除事件配置
   * @param {string} configKey - 配置鍵
   */
  removeEventConfig (configKey) {
    const config = this.eventConfigs[configKey]
    if (config) {
      // 取消註冊相關事件
      this.unregisterEvent(config.elementId, config.eventType)

      // 移除配置
      delete this.eventConfigs[configKey]
    }
  }

  /**
   * 獲取統計資訊
   * @returns {Object} 統計資訊
   */
  getStats () {
    return {
      ...this.stats
    }
  }

  /**
   * 清理所有事件
   */
  cleanup () {
    // 移除所有事件監聽器
    this.trackedListeners.forEach(listener => {
      if (listener.element && listener.element.removeEventListener) {
        listener.element.removeEventListener(listener.eventType, listener.listener)
      }
    })

    // 清空所有資料
    this.registeredEvents = []
    this.trackedListeners = []
    this.failedBindings = []
    this.eventErrors = []
    this.retryConfigs = {}
    this.retryStats = {}
    this.stats = {
      totalEvents: 0,
      totalTriggers: 0,
      errorCount: 0,
      retryCount: 0,
      categories: {}
    }
  }

  // ===== 私有方法 =====

  /**
   * 初始化預設事件配置
   * @private
   */
  _initializeDefaultConfigs () {
    // 提取按鈕
    this.eventConfigs['extract-button'] = {
      element: 'extract-button',
      event: 'click',
      elementId: 'extract-button',
      eventType: 'click',
      category: 'UI_ACTIONS',
      handler: () => {
        if (this.components.extraction && this.components.extraction.startExtraction) {
          this.components.extraction.startExtraction()
        }
      }
    }

    // 設定按鈕
    this.eventConfigs['settings-button'] = {
      element: 'settings-button',
      event: 'click',
      elementId: 'settings-button',
      eventType: 'click',
      category: 'UI_ACTIONS',
      handler: () => {
        // TODO: 實作設定功能
        console.log('設定功能')
      }
    }

    // 說明按鈕
    this.eventConfigs['help-button'] = {
      element: 'help-button',
      event: 'click',
      elementId: 'help-button',
      eventType: 'click',
      category: 'UI_ACTIONS',
      handler: () => {
        // TODO: 實作說明功能
        console.log('說明功能')
      }
    }

    // 重試按鈕
    this.eventConfigs['retry-button'] = {
      element: 'retry-button',
      event: 'click',
      elementId: 'retry-button',
      eventType: 'click',
      category: 'BUSINESS_LOGIC',
      handler: () => {
        if (this.components.extraction && this.components.extraction.retryExtraction) {
          this.components.extraction.retryExtraction()
        }
      }
    }

    // 取消按鈕
    this.eventConfigs['cancel-button'] = {
      element: 'cancel-button',
      event: 'click',
      elementId: 'cancel-button',
      eventType: 'click',
      category: 'BUSINESS_LOGIC',
      handler: () => {
        if (this.components.extraction && this.components.extraction.stopExtraction) {
          this.components.extraction.stopExtraction()
        }
      }
    }

    // 初始化分類統計
    this.eventCategories.forEach(category => {
      this.stats.categories[category] = {
        total: 0,
        triggers: 0,
        errors: 0
      }
    })
  }

  /**
   * 綁定單一事件
   * @param {string} configKey - 配置鍵
   * @param {Object} config - 事件配置
   * @private
   */
  _bindSingleEvent (configKey, config) {
    try {
      const elementId = config.elementId || config.element
      const element = this.document.getElementById(elementId)
      
      if (!element) {
        this.failedBindings.push({
          configKey,
          elementId,
          reason: '元素不存在'
        })
        return
      }

      const wrappedHandler = this._createWrappedHandler(config)

      // 綁定事件
      element.addEventListener(config.eventType || config.event, wrappedHandler, config.options)

      // 記錄追蹤資訊
      const listenerInfo = {
        configKey,
        element,
        elementId: config.elementId || config.element,
        eventType: config.eventType || config.event,
        listener: wrappedHandler,
        category: config.category || 'UI_ACTIONS',
        timestamp: Date.now()
      }

      this.trackedListeners.push(listenerInfo)
      this.registeredEvents.push({
        elementId: config.elementId || config.element,
        eventType: config.eventType || config.event,
        category: config.category || 'UI_ACTIONS'
      })

      // 更新統計
      this.stats.totalEvents++
      if (this.stats.categories[config.category]) {
        this.stats.categories[config.category].total++
      }

    } catch (error) {
      this.failedBindings.push({
        configKey,
        elementId: config.elementId || config.element,
        reason: error.message
      })
    }
  }

  /**
   * 建立包裝的事件處理函數
   * @param {Object} config - 事件配置
   * @returns {Function} 包裝的處理函數
   * @private
   */
  _createWrappedHandler (config) {
    return async (event) => {
      try {
        // 更新觸發統計
        this.stats.totalTriggers++
        if (this.stats.categories[config.category]) {
          this.stats.categories[config.category].triggers++
        }

        // 執行原始處理函數
        if (typeof config.handler === 'function') {
          await config.handler(event)
        }

        // 更新重試統計
        const elementId = config.elementId || config.element
        if (this.retryStats[elementId]) {
          this.retryStats[elementId].lastSuccess = true
          this.retryStats[elementId].lastError = null
        }

      } catch (error) {
        // 記錄錯誤
        this.eventErrors.push({
          elementId: config.elementId || config.element,
          eventType: config.eventType || config.event,
          error: error.message,
          timestamp: Date.now()
        })

        // 更新錯誤統計
        this.stats.errorCount++
        if (this.stats.categories[config.category]) {
          this.stats.categories[config.category].errors++
        }

        // 嘗試重試機制
        const elementId = config.elementId || config.element
        if (this.retryConfigs[elementId]) {
          await this._handleRetry(elementId, config, error)
        }
      }
    }
  }

  /**
   * 處理重試機制
   * @param {string} elementId - 元素 ID
   * @param {Object} config - 事件配置
   * @param {Error} error - 原始錯誤
   * @private
   */
  async _handleRetry (elementId, config, error) {
    const retryConfig = this.retryConfigs[elementId]
    const retryStats = this.retryStats[elementId]

    if (retryStats.totalRetries < retryConfig.maxRetries) {
      retryStats.totalRetries++
      retryStats.lastError = error.message
      this.stats.retryCount++

      // 延遲後重試
      setTimeout(async () => {
        try {
          if (typeof config.handler === 'function') {
            await config.handler()
          }
          retryStats.lastSuccess = true
          retryStats.lastError = null
        } catch (retryError) {
          retryStats.lastSuccess = false
          retryStats.lastError = retryError.message
          
          // 遞歸重試
          await this._handleRetry(elementId, config, retryError)
        }
      }, retryConfig.delay)
    }
  }

  /**
   * 驗證事件配置
   * @param {Object} config - 事件配置
   * @private
   */
  _validateEventConfig (config) {
    if (!config.elementId || typeof config.elementId !== 'string' || config.elementId.trim() === '') {
      throw new Error('無效的事件配置: elementId 必須是非空字符串')
    }

    if (!config.eventType || typeof config.eventType !== 'string') {
      throw new Error('無效的事件配置: eventType 必須是字符串')
    }

    if (config.handler && typeof config.handler !== 'function') {
      throw new Error('無效的事件配置: handler 必須是函數')
    }
  }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventManager
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.EventManager = EventManager
}