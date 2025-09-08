/**
 * chrome-event-bridge.js
 *
 * Chrome Extension 跨上下文事件橋接器
 *
 * 負責功能：
 * - 跨上下文事件通訊機制 (background ↔ content script ↔ popup)
 * - Chrome Runtime 消息監聽器設置
 * - Promise 包裝的 Chrome API 呼叫
 * - 錯誤處理和復原機制
 * - Readmoo 分頁查詢功能
 * - 通訊效能監控
 *
 * 設計考量：
 * - ChromeEventBridge 處理不同腳本環境間的通訊
 * - 使用 chrome.runtime.sendMessage 和 chrome.tabs.sendMessage
 * - 支援非同步事件分發和錯誤隔離
 * - 確保通訊的可靠性和錯誤復原
 *
 * 處理流程：
 * 1. 設置消息監聽器
 * 2. 接收跨上下文事件請求
 * 3. 路由到目標上下文
 * 4. 處理回應和錯誤
 * 5. 返回結果給發送者
 *
 * 使用情境：
 * - Extension background script 與 content script 通訊
 * - Popup 與 background script 資料交換
 * - 跨分頁的事件同步處理
 */

/**
 * 建立 Chrome 事件橋接實例
 *
 * @returns {Object} ChromeEventBridge 實例
 */
function createChromeEventBridge () {
  let eventBus = null
  let messageListener = null
  const messageHandlers = new Map()
  const communicationStats = {
    messagesSent: 0,
    messagesSucceeded: 0,
    messagesFailed: 0,
    totalLatency: 0,
    avgLatency: 0,
    lastCommunication: 0
  }

  // 創建實例對象
  const bridge = {
    /**
     * 消息處理器映射
     */
    messageHandlers,

    /**
     * 消息監聽器引用
     */
    messageListener: null,

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

        this._logCommunicationError('Background', error, message.type, latency)

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
     * 分發事件到指定上下文
     *
     * @param {Object} event - 要分發的事件
     * @param {string} targetContext - 目標上下文 ('background', 'content', 'popup')
     * @returns {Promise<*>} 分發結果
     */
    async dispatchToContext (event, targetContext) {
      switch (targetContext) {
        case 'background':
          return await this.dispatchToBackground(event)
        case 'content':
          return await this.dispatchToContent(event)
        case 'popup':
          return await this.dispatchToPopup(event)
        default:
          throw new Error(`Unknown target context: ${targetContext}`)
      }
    },

    /**
     * 分發事件到 Background 上下文
     *
     * @param {Object} event - 要分發的事件
     * @returns {Promise<*>} Background 處理結果
     */
    async dispatchToBackground (event) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'BACKGROUND_EVENT',
          event
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(response)
          }
        })
      })
    },

    /**
     * 分發事件到 Content Scripts
     *
     * @param {Object} event - 要分發的事件
     * @returns {Promise<Array>} Content Scripts 處理結果陣列
     */
    async dispatchToContent (event) {
      const tabs = await this.getReadmooTabs()
      const results = []

      for (const tab of tabs) {
        try {
          const result = await this.sendToTab(tab.id, {
            type: 'CONTENT_EVENT',
            event
          })
          results.push(result)
        } catch (error) {
          // 部分分頁失敗使用警告級別日誌
          console.warn(`Failed to send event to tab ${tab.id}:`, error)
        }
      }

      return results
    },

    /**
     * 分發事件到 Popup 上下文
     *
     * @param {Object} event - 要分發的事件
     * @returns {Promise<*>} Popup 處理結果
     */
    async dispatchToPopup (event) {
      // Popup 通訊與 Background 通訊類似
      return await this.dispatchToBackground(event)
    },

    /**
     * 查詢 Readmoo 相關分頁
     *
     * @returns {Promise<Array>} Readmoo 分頁陣列
     */
    async getReadmooTabs () {
      return new Promise((resolve, reject) => {
        chrome.tabs.query({
          url: ['*://readmoo.com/*', '*://*.readmoo.com/*']
        }, (tabs) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(tabs || [])
          }
        })
      })
    },

    /**
     * 發送消息到指定分頁
     *
     * @param {number} tabId - 分頁 ID
     * @param {Object} message - 要發送的消息
     * @returns {Promise<*>} 分頁回應
     */
    async sendToTab (tabId, message) {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(response)
          }
        })
      })
    },

    /**
     * 清理資源
     */
    destroy () {
      // 清理消息處理器
      messageHandlers.clear()

      // 移除消息監聽器
      const listenerToRemove = bridge.messageListener || messageListener
      if (listenerToRemove && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(listenerToRemove)
      }

      // 重置引用
      bridge.messageListener = null
      messageListener = null
    },

    /**
     * 取得通訊統計
     *
     * @returns {Object} 通訊統計資料
     */
    getStats () {
      return { ...communicationStats }
    },

    /**
     * 記錄通訊錯誤
     * @private
     */
    _logCommunicationError (target, error, messageType, latency) {
      console.error(`❌ Content Script 發送訊息失敗 (${target}):`, {
        error: error.message,
        message: messageType,
        latency
      })
    }
  }

  // 設置 Chrome Runtime 消息監聽器
  messageListener = async (message, sender, sendResponse) => {
    // 處理跨上下文事件消息
    if (message.type === 'CROSS_CONTEXT_EVENT') {
      try {
        const result = await bridge.dispatchToContext(
          message.data.event,
          message.data.targetContext
        )
        sendResponse({
          success: true,
          result
        })
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        })
      }
      return true // 保持消息通道開啟
    }
  }

  // 註冊消息監聽器
  if (chrome.runtime && chrome.runtime.onMessage) {
    // eslint-disable-next-line no-useless-catch
    try {
      chrome.runtime.onMessage.addListener(messageListener)
      bridge.messageListener = messageListener
    } catch (error) {
      // 重新拋出錯誤以供測試捕獲
      throw error
    }
  }

  return bridge
}

module.exports = createChromeEventBridge
