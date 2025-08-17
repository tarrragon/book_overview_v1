/**
 * chrome-event-bridge.js
 *
 * Chrome 事件橋接模組
 *
 * 負責功能：
 * - 與 Background Service Worker 的雙向通訊
 * - 內部事件與 Chrome API 的橋接
 * - 訊息封裝和錯誤處理
 * - 通訊效能監控
 *
 * 設計考量：
 * - 確保訊息格式的一致性
 * - 提供強健的錯誤恢復機制
 * - 支援高頻率訊息的效能優化
 * - 記錄通訊統計供調試使用
 *
 * 處理流程：
 * 1. 訊息封裝 → 統一格式和元資料
 * 2. Chrome API 調用 → 發送到 Background
 * 3. 錯誤處理 → 記錄失敗原因
 * 4. 統計更新 → 追蹤通訊效能
 *
 * 使用情境：
 * - Content Script 與 Background 通訊
 * - 事件轉發和狀態同步
 * - 錯誤報告和診斷資訊傳送
 */

/**
 * 建立 Chrome 事件橋接實例
 *
 * @returns {Object} ChromeEventBridge 實例
 */
function createChromeEventBridge () {
  let eventBus = null
  const communicationStats = {
    messagesSent: 0,
    messagesSucceeded: 0,
    messagesFailed: 0,
    totalLatency: 0,
    avgLatency: 0,
    lastCommunication: 0
  }

  return {
    /**
     * 設定 EventBus 實例
     *
     * @param {Object} bus - EventBus 實例
     */
    set eventBus (bus) {
      eventBus = bus
    },

    /**
     * 取得 EventBus 實例
     *
     * @returns {Object} EventBus 實例
     */
    get eventBus () {
      return eventBus
    },

    /**
     * 發送訊息到 Background
     *
     * @param {Object} message - 要發送的訊息
     * @param {string} message.type - 訊息類型
     * @param {Object} [message.data] - 訊息資料
     * @returns {Promise<Object>} 發送結果
     */
    async sendToBackground (message) {
      const startTime = performance.now()

      try {
        // 訊息格式驗證
        if (!message || typeof message.type !== 'string') {
          throw new Error('無效的訊息格式：缺少 type 欄位')
        }

        // 添加元資料
        const enrichedMessage = {
          ...message,
          metadata: {
            sender: 'content-script',
            timestamp: Date.now(),
            version: '0.3.0',
            url: window.location.href,
            ...message.metadata
          }
        }

        communicationStats.messagesSent++
        const response = await chrome.runtime.sendMessage(enrichedMessage)

        const latency = performance.now() - startTime
        communicationStats.messagesSucceeded++
        communicationStats.totalLatency += latency
        communicationStats.avgLatency = communicationStats.totalLatency / communicationStats.messagesSucceeded
        communicationStats.lastCommunication = Date.now()

        return {
          success: true,
          response,
          latency
        }
      } catch (error) {
        const latency = performance.now() - startTime
        communicationStats.messagesFailed++

        console.error('❌ Content Script 發送訊息失敗 (Background):', {
          error: error.message,
          message: message.type,
          latency
        })

        return {
          success: false,
          error: error.message,
          latency
        }
      }
    },

    /**
     * 橋接內部事件到 Background
     *
     * @param {string} eventType - 事件類型
     * @param {Object} data - 事件資料
     * @returns {Promise<Object>} 轉發結果
     */
    async forwardEventToBackground (eventType, data) {
      const message = {
        type: 'CONTENT.EVENT.FORWARD',
        eventType,
        data,
        timestamp: Date.now()
      }

      return await this.sendToBackground(message)
    },

    /**
     * 取得通訊統計
     *
     * @returns {Object} 通訊統計資料
     */
    getStats () {
      return { ...communicationStats }
    }
  }
}

module.exports = createChromeEventBridge
