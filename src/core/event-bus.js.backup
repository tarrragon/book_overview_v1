/**
 * 事件總線核心實現
 * 整個事件系統的基礎架構
 *
 * 負責功能：
 * - 事件註冊、移除和觸發機制
 * - 支援優先級排序和非同步處理
 * - 錯誤隔離和統計追蹤
 * - 記憶體管理和效能監控
 *
 * 設計考量：
 * - 基於Observer模式設計
 * - 支援優先級排序（數字越小優先級越高）
 * - 錯誤隔離：一個處理器錯誤不影響其他處理器
 * - 非同步支援：所有處理器支援Promise返回
 * - 統計追蹤：記錄執行次數、時間等統計資訊
 *
 * 處理流程：
 * 1. 事件註冊時按優先級插入到適當位置
 * 2. 事件觸發時按優先級順序執行處理器
 * 3. 錯誤處理：捕獲並隔離，但不中斷其他處理器
 * 4. 統計更新：記錄執行時間和次數
 * 5. 記憶體清理：支援監聽器移除和系統清理
 *
 * 使用情境：
 * - Chrome Extension的所有模組通訊基礎
 * - background、content-script、popup之間的事件傳遞
 * - 資料提取、儲存、UI更新等跨模組協作
 */

// 引入錯誤處理系統
const { StandardError } = require('src/core/errors/StandardError')

/**
 * 事件監聽器包裝器
 */
class ListenerWrapper {
  constructor (handler, options = {}) {
    this.handler = handler
    this.priority = options.priority !== undefined ? options.priority : 2 // 預設為NORMAL優先級
    this.once = options.once || false
    this.id = Date.now() + Math.random() // 簡單的唯一ID
  }
}

/**
 * 事件總線核心類別
 */
class EventBus {
  constructor (options = {}) {
    // 事件監聽器註冊表 Map<eventType, ListenerWrapper[]>
    this.listeners = new Map()

    // 配置選項
    this.options = {
      maxListeners: options.maxListeners || 100,
      ...options
    }

    // 統計資訊
    this.stats = {
      eventStats: new Map(), // 每個事件類型的統計
      totalEmissions: 0,
      totalExecutionTime: 0,
      lastActivity: null // 記錄最後活動時間
    }
  }

  /**
   * 註冊事件監聽器
   * @param {string} eventType - 事件類型
   * @param {Function} handler - 處理器函數
   * @param {Object} options - 選項 {priority, once}
   */
  on (eventType, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new StandardError('INVALID_HANDLER', 'Handler must be a function', {
        eventType,
        handlerType: typeof handler,
        receivedValue: handler
      })
    }

    // 檢查最大監聽器限制
    const currentCount = this.getListenerCount(eventType)
    if (currentCount >= this.options.maxListeners) {
      throw new StandardError('MAX_LISTENERS_EXCEEDED', 'Maximum number of listeners exceeded', {
        eventType,
        currentCount,
        maxListeners: this.options.maxListeners
      })
    }

    // 建立監聽器包裝器
    const wrapper = new ListenerWrapper(handler, options)

    // 取得或建立事件類型的監聽器陣列
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, [])
    }

    const listeners = this.listeners.get(eventType)

    // 按優先級插入（優先級數字越小越優先）
    // 簡化邏輯：遍歷陣列，找到第一個優先級大於當前wrapper的位置
    let insertIndex = listeners.length // 預設插入到最後

    for (let i = 0; i < listeners.length; i++) {
      if (listeners[i].priority > wrapper.priority) {
        insertIndex = i
        break
      }
    }

    listeners.splice(insertIndex, 0, wrapper)

    return this // 支援鏈式呼叫
  }

  /**
   * 註冊一次性事件監聽器
   * @param {string} eventType - 事件類型
   * @param {Function} handler - 處理器函數
   * @param {Object} options - 選項
   */
  once (eventType, handler, options = {}) {
    return this.on(eventType, handler, { ...options, once: true })
  }

  /**
   * 移除特定的事件監聽器
   * @param {string} eventType - 事件類型
   * @param {Function} handler - 要移除的處理器函數
   */
  off (eventType, handler) {
    if (!this.listeners.has(eventType)) {
      return this
    }

    const listeners = this.listeners.get(eventType)
    const filteredListeners = listeners.filter(wrapper => wrapper.handler !== handler)

    if (filteredListeners.length === 0) {
      this.listeners.delete(eventType)
    } else {
      this.listeners.set(eventType, filteredListeners)
    }

    return this
  }

  /**
   * 移除事件類型的所有監聽器
   * @param {string} eventType - 事件類型，如果不提供則移除所有
   */
  removeAllListeners (eventType = null) {
    if (eventType === null) {
      this.listeners.clear()
    } else {
      this.listeners.delete(eventType)
    }
    return this
  }

  /**
   * 觸發事件並執行所有監聽器
   * @param {string} eventType - 事件類型
   * @param {*} data - 事件資料
   * @returns {Promise<Array>} 所有處理器的執行結果
   */
  async emit (eventType, data = null) {
    const startTime = performance.now() // 使用高精度時間

    // 更新統計
    this.stats.totalEmissions++
    this.stats.lastActivity = new Date().toISOString()

    if (!this.listeners.has(eventType)) {
      return []
    }

    const listeners = this.listeners.get(eventType)
    const results = []
    const toRemove = []

    // 依序執行所有監聽器
    for (let i = 0; i < listeners.length; i++) {
      const wrapper = listeners[i]

      try {
        // 執行處理器（支援同步和非同步）
        const result = await Promise.resolve(wrapper.handler(data))
        results.push(result)

        // 標記一次性監聽器待移除
        if (wrapper.once) {
          toRemove.push(wrapper)
        }
      } catch (error) {
        // 錯誤隔離：記錄錯誤但不中斷其他處理器
        results.push(error)

        // 即使錯誤也要移除一次性監聽器
        if (wrapper.once) {
          toRemove.push(wrapper)
        }
      }
    }

    // 移除一次性監聽器
    if (toRemove.length > 0) {
      const remainingListeners = listeners.filter(wrapper => !toRemove.includes(wrapper))
      if (remainingListeners.length === 0) {
        this.listeners.delete(eventType)
      } else {
        this.listeners.set(eventType, remainingListeners)
      }
    }

    // 更新事件統計
    const executionTime = performance.now() - startTime
    this.updateEventStats(eventType, executionTime)

    return results
  }

  /**
   * 檢查是否有特定事件類型的監聽器
   * @param {string} eventType - 事件類型
   * @returns {boolean}
   */
  hasListener (eventType) {
    return this.listeners.has(eventType) && this.listeners.get(eventType).length > 0
  }

  /**
   * 取得特定事件類型的監聽器數量
   * @param {string} eventType - 事件類型
   * @returns {number}
   */
  getListenerCount (eventType) {
    if (!this.listeners.has(eventType)) {
      return 0
    }
    return this.listeners.get(eventType).length
  }

  /**
   * 取得事件系統統計資訊
   * @returns {Object}
   */
  getStats () {
    const eventTypes = Array.from(this.listeners.keys())
    const listenerCounts = {}
    let totalListeners = 0

    eventTypes.forEach(eventType => {
      const count = this.getListenerCount(eventType)
      listenerCounts[eventType] = count
      totalListeners += count
    })

    return {
      // 監聽器相關統計
      totalEventTypes: eventTypes.length,
      totalListeners,
      eventTypes,
      listenerCounts,
      // 事件觸發相關統計
      totalEvents: this.stats.totalEmissions, // 總事件觸發次數
      totalEmissions: this.stats.totalEmissions, // 向後相容
      totalExecutionTime: this.stats.totalExecutionTime,
      lastActivity: this.stats.lastActivity
    }
  }

  /**
   * 取得特定事件的統計資訊
   * @param {string} eventType - 事件類型
   * @returns {Object}
   */
  getEventStats (eventType) {
    if (!this.stats.eventStats.has(eventType)) {
      return {
        emitCount: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0
      }
    }

    return this.stats.eventStats.get(eventType)
  }

  /**
   * 更新事件統計資訊
   * @private
   * @param {string} eventType - 事件類型
   * @param {number} executionTime - 執行時間（毫秒）
   */
  updateEventStats (eventType, executionTime) {
    if (!this.stats.eventStats.has(eventType)) {
      this.stats.eventStats.set(eventType, {
        emitCount: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0
      })
    }

    const stats = this.stats.eventStats.get(eventType)
    stats.emitCount++
    stats.totalExecutionTime += executionTime
    stats.averageExecutionTime = stats.totalExecutionTime / stats.emitCount

    this.stats.totalExecutionTime += executionTime
  }

  /**
   * 清理和銷毀事件系統
   */
  destroy () {
    this.listeners.clear()
    this.stats.eventStats.clear()
    this.stats.totalEmissions = 0
    this.stats.totalExecutionTime = 0
    this.stats.lastActivity = null
  }
}

// 瀏覽器環境：將 EventBus 定義為全域變數
if (typeof window !== 'undefined') {
  window.EventBus = EventBus
}

// Node.js 環境：保持 CommonJS 匯出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventBus
}
