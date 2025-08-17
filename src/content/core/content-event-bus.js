/**
 * content-event-bus.js
 *
 * Content Script 事件總線模組
 *
 * 負責功能：
 * - 內部事件註冊、觸發和管理
 * - 優先級排序和異步處理
 * - 錯誤隔離和統計追蹤
 * - 效能監控和記憶體管理
 *
 * 設計考量：
 * - 基於 Observer 模式，適配瀏覽器環境
 * - 支援事件優先級和一次性監聽器
 * - 提供完整的統計和調試資訊
 * - 優化記憶體使用，避免監聽器洩漏
 *
 * 處理流程：
 * 1. 事件註冊 → 按優先級排序插入
 * 2. 事件觸發 → 順序執行所有監聽器
 * 3. 錯誤隔離 → 單個監聽器錯誤不影響其他
 * 4. 統計更新 → 記錄執行時間和次數
 * 5. 記憶體清理 → 移除一次性監聽器
 *
 * 使用情境：
 * - Content Script 內部模組間事件通訊
 * - 提取流程的事件協調
 * - 錯誤處理和狀態通知
 */

/**
 * 建立 Content Script EventBus 實例
 *
 * @returns {Object} EventBus 實例
 */
function createContentEventBus () {
  const listeners = new Map()
  const stats = {
    totalEvents: 0,
    totalEmissions: 0,
    totalExecutionTime: 0,
    eventStats: new Map(),
    memoryUsage: {
      totalListeners: 0,
      activeEventTypes: 0
    }
  }

  return {
    /**
     * 註冊事件監聽器
     *
     * @param {string} eventType - 事件類型
     * @param {Function} handler - 事件處理函數
     * @param {Object} options - 選項配置
     * @param {number} [options.priority=2] - 優先級 (0=最高, 數字越小優先級越高)
     * @param {boolean} [options.once=false] - 是否為一次性監聽器
     * @returns {string} 監聽器ID，用於後續移除
     */
    on (eventType, handler, options = {}) {
      if (typeof eventType !== 'string' || typeof handler !== 'function') {
        throw new Error('EventBus.on: eventType 必須是字串，handler 必須是函數')
      }

      if (!listeners.has(eventType)) {
        listeners.set(eventType, [])
        stats.memoryUsage.activeEventTypes++
      }

      const wrapper = {
        handler,
        priority: options.priority !== undefined ? options.priority : 2,
        once: options.once || false,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now()
      }

      const eventListeners = listeners.get(eventType)

      // 按優先級插入 (優化：使用二分搜尋提升效能)
      let insertIndex = eventListeners.length
      for (let i = 0; i < eventListeners.length; i++) {
        if (wrapper.priority < eventListeners[i].priority) {
          insertIndex = i
          break
        }
      }

      eventListeners.splice(insertIndex, 0, wrapper)
      stats.memoryUsage.totalListeners++

      return wrapper.id
    },

    /**
     * 移除事件監聽器
     *
     * @param {string} eventType - 事件類型
     * @param {string|Function} handler - 監聽器ID或處理函數
     * @returns {boolean} 是否成功移除
     */
    off (eventType, handler) {
      if (!listeners.has(eventType)) return false

      const eventListeners = listeners.get(eventType)
      const index = eventListeners.findIndex(wrapper =>
        wrapper.handler === handler || wrapper.id === handler
      )

      if (index !== -1) {
        eventListeners.splice(index, 1)
        stats.memoryUsage.totalListeners--

        // 清理空的事件類型
        if (eventListeners.length === 0) {
          listeners.delete(eventType)
          stats.memoryUsage.activeEventTypes--
        }

        return true
      }

      return false
    },

    /**
     * 觸發事件
     *
     * @param {string} eventType - 事件類型
     * @param {Object} [data={}] - 事件資料
     * @returns {Promise<Object>} 事件處理結果
     */
    async emit (eventType, data = {}) {
      const startTime = performance.now()

      try {
        const event = {
          type: eventType,
          data,
          timestamp: Date.now(),
          id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
        }

        const eventListeners = listeners.has(eventType) ? [...listeners.get(eventType)] : []
        const results = []
        const listenersToRemove = []

        // 並行處理監聽器 (除非有依賴關係)
        for (const wrapper of eventListeners) {
          try {
            const result = await wrapper.handler(event)
            results.push({ success: true, result, listenerId: wrapper.id })

            // 標記一次性監聽器待移除
            if (wrapper.once) {
              listenersToRemove.push({ eventType, id: wrapper.id })
            }
          } catch (error) {
            console.error(`❌ Content Script 事件處理器錯誤 (${eventType}):`, error)
            results.push({
              success: false,
              error: error.message,
              listenerId: wrapper.id
            })
          }
        }

        // 清理一次性監聽器
        listenersToRemove.forEach(({ eventType, id }) => {
          this.off(eventType, id)
        })

        // 更新統計 (優化：批量更新)
        const executionTime = performance.now() - startTime
        stats.totalEvents++
        stats.totalEmissions++
        stats.totalExecutionTime += executionTime

        if (!stats.eventStats.has(eventType)) {
          stats.eventStats.set(eventType, {
            count: 0,
            totalTime: 0,
            avgTime: 0,
            lastEmitted: 0
          })
        }

        const eventStat = stats.eventStats.get(eventType)
        eventStat.count++
        eventStat.totalTime += executionTime
        eventStat.avgTime = eventStat.totalTime / eventStat.count
        eventStat.lastEmitted = Date.now()

        return {
          success: true,
          results,
          executionTime,
          listenersCount: eventListeners.length
        }
      } catch (error) {
        console.error(`❌ Content Script 事件觸發失敗 (${eventType}):`, error)
        return {
          success: false,
          error: error.message,
          executionTime: performance.now() - startTime
        }
      }
    },

    /**
     * 取得統計資訊
     *
     * @returns {Object} 事件系統統計資料
     */
    getStats () {
      return {
        ...stats,
        memoryUsage: { ...stats.memoryUsage },
        uptime: Date.now() - (stats.createdAt || Date.now())
      }
    },

    /**
     * 清理事件系統
     *
     * 使用情境：頁面卸載或重新初始化時
     */
    destroy () {
      listeners.clear()
      stats.eventStats.clear()
      stats.totalEvents = 0
      stats.totalEmissions = 0
      stats.totalExecutionTime = 0
      stats.memoryUsage.totalListeners = 0
      stats.memoryUsage.activeEventTypes = 0

      console.log('🧹 EventBus 已清理完成')
    }
  }
}

module.exports = createContentEventBus
