/**
 * Readmoo 書庫數據提取器 - Background Service Worker
 *
 * 負責功能：
 * - 作為事件系統的核心運行環境
 * - 協調 Content Script 和 Popup 之間的通訊
 * - 管理擴展的生命週期和狀態
 * - 處理儲存操作和資料管理
 *
 * 設計考量：
 * - 使用 Manifest V3 Service Worker 架構
 * - 整合現有的 EventBus 和 ChromeEventBridge 系統
 * - 支援跨上下文事件通訊
 * - 提供統一的錯誤處理和日誌記錄
 */

console.log('🚀 Readmoo 書庫提取器 Background Service Worker 啟動')

// ====================
// 事件系統初始化
// ====================

// 載入事件系統模組 (使用動態載入以支援 Service Worker 環境)
let EventBus, ChromeEventBridge
let eventBus, chromeBridge

/**
 * 初始化事件系統
 *
 * 負責功能：
 * - 建立和配置EventBus實例
 * - 建立和配置ChromeEventBridge實例
 * - 設定全域引用和實例整合
 * - 錯誤處理和降級方案
 *
 * 設計考量：
 * - 適配Service Worker環境的模組載入限制
 * - 提供完整的錯誤處理和恢復機制
 * - 確保事件系統在各種情況下都能正常運作
 * - 支援多次初始化調用（重新初始化）
 *
 * 處理流程：
 * 1. 建立簡化版EventBus實例
 * 2. 建立簡化版ChromeEventBridge實例
 * 3. 設定實例間的相互引用
 * 4. 設定全域變數供其他模組使用
 * 5. 記錄初始化狀態和錯誤處理
 *
 * 使用情境：
 * - Service Worker啟動時的自動初始化
 * - Service Worker重啟後的恢復初始化
 * - 錯誤發生後的重新初始化
 */
async function initializeEventSystem () {
  try {
    console.log('📡 開始初始化事件系統')

    // 注意：Service Worker 環境的模組載入限制
    // 在正式版本中，這裡應該使用標準的ES模組載入
    // 當前使用簡化實現以確保在測試和開發環境中的相容性

    // TODO: v0.4.0+ 整合完整的 EventBus 和 ChromeEventBridge 模組

    // 建立全域 EventBus 實例
    globalThis.eventBus = createSimpleEventBus()
    eventBus = globalThis.eventBus

    // 建立全域 ChromeEventBridge 實例
    globalThis.chromeBridge = createSimpleChromeEventBridge()
    chromeBridge = globalThis.chromeBridge

    // 設定事件系統整合
    chromeBridge.eventBus = eventBus

    console.log('✅ 事件系統初始化完成')
    console.log('📊 EventBus 實例:', !!eventBus)
    console.log('🌉 ChromeEventBridge 實例:', !!chromeBridge)

    return { eventBus, chromeBridge }
  } catch (error) {
    console.error('❌ EventBus 初始化失敗:', error)

    // 提供降級方案
    globalThis.eventBus = null
    globalThis.chromeBridge = null

    throw error
  }
}

/**
 * 建立簡化的 EventBus (基於 v0.1.0 的 EventBus 設計)
 *
 * 負責功能：
 * - 事件註冊、移除和觸發機制
 * - 支援優先級排序和非同步處理
 * - 錯誤隔離和統計追蹤
 * - 記憶體管理和效能監控
 *
 * 設計考量：
 * - 基於Observer模式設計，適配Service Worker環境
 * - 支援優先級排序（數字越小優先級越高）
 * - 錯誤隔離：一個處理器錯誤不影響其他處理器
 * - 統計追蹤：記錄執行次數、時間等統計資訊
 *
 * 使用情境：
 * - Chrome Extension Background Service Worker的核心事件系統
 * - 支援跨上下文事件傳遞和協調
 * - 提供與v0.1.0完整EventBus相容的簡化API
 */
function createSimpleEventBus () {
  // 事件監聽器註冊表 Map<eventType, ListenerWrapper[]>
  const listeners = new Map()

  // 統計追蹤資料
  const stats = {
    totalEvents: 0, // 總事件類型數
    totalEmissions: 0, // 總事件觸發次數
    totalExecutionTime: 0, // 總執行時間
    eventStats: new Map() // 各事件類型的詳細統計
  }

  return {
    /**
     * 註冊事件監聽器
     */
    on (eventType, handler, options = {}) {
      if (!listeners.has(eventType)) {
        listeners.set(eventType, [])
      }

      const wrapper = {
        handler,
        priority: options.priority !== undefined ? options.priority : 2,
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

    /**
     * 移除事件監聽器
     */
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

    /**
     * 觸發事件
     */
    async emit (eventType, data = {}) {
      const startTime = performance.now()

      try {
        if (!listeners.has(eventType)) {
          return { success: true, results: [] }
        }

        const event = {
          type: eventType,
          data,
          timestamp: Date.now()
        }

        const eventListeners = [...listeners.get(eventType)]
        const results = []

        for (const wrapper of eventListeners) {
          try {
            const result = await wrapper.handler(event)
            results.push({ success: true, result })

            // 處理一次性監聽器
            if (wrapper.once) {
              this.off(eventType, wrapper.id)
            }
          } catch (error) {
            console.error(`❌ 事件處理器錯誤 (${eventType}):`, error)
            results.push({ success: false, error })
          }
        }

        // 更新統計
        stats.totalEvents++
        stats.totalEmissions++
        stats.totalExecutionTime += performance.now() - startTime

        if (!stats.eventStats.has(eventType)) {
          stats.eventStats.set(eventType, { count: 0, totalTime: 0 })
        }
        const eventStat = stats.eventStats.get(eventType)
        eventStat.count++
        eventStat.totalTime += performance.now() - startTime

        return { success: true, results }
      } catch (error) {
        console.error(`❌ 事件觸發失敗 (${eventType}):`, error)
        return { success: false, error }
      }
    },

    /**
     * 取得統計資訊
     */
    getStats () {
      return { ...stats }
    },

    /**
     * 清理
     */
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
 * 建立簡化的 ChromeEventBridge (基於 v0.1.0 的 ChromeEventBridge 設計)
 *
 * 負責功能：
 * - 跨上下文事件橋接 (Background ↔ Content Script ↔ Popup)
 * - Chrome Extension API 訊息封裝和路由
 * - 事件系統與Chrome API的整合介面
 * - 錯誤處理和連接狀態管理
 *
 * 設計考量：
 * - 基於Chrome Runtime Messaging API
 * - 支援雙向通訊和異步回應機制
 * - 與EventBus緊密整合，提供事件驅動的跨上下文通訊
 * - 適配Service Worker的生命週期管理
 *
 * 處理流程：
 * 1. 接收來自不同上下文的訊息 (Content Script/Popup)
 * 2. 將Chrome API訊息轉換為內部事件
 * 3. 通過EventBus分發和處理事件
 * 4. 將處理結果回傳給發送方
 *
 * 使用情境：
 * - Background Service Worker作為通訊中樞
 * - 資料提取指令從Popup發送到Content Script
 * - Content Script狀態更新回傳到Background和Popup
 */
function createSimpleChromeEventBridge () {
  // EventBus 實例引用
  let eventBus = null

  return {
    /**
     * 設定 EventBus 實例
     */
    set eventBus (bus) {
      eventBus = bus
    },

    /**
     * 取得 EventBus 實例
     */
    get eventBus () {
      return eventBus
    },

    /**
     * 發送訊息到 Content Script
     */
    async sendToContent (tabId, message) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, message)
        return { success: true, response }
      } catch (error) {
        console.error('❌ 發送訊息失敗 (Content):', error)
        return { success: false, error }
      }
    },

    /**
     * 發送訊息到 Popup
     */
    async sendToPopup (message) {
      try {
        // Popup 通常不需要主動發送，因為它會主動連接 background
        return { success: true, message: 'Popup communication not implemented' }
      } catch (error) {
        console.error('❌ 發送訊息失敗 (Popup):', error)
        return { success: false, error }
      }
    },

    /**
     * 處理來自 Content Script 的訊息
     */
    onMessageFromContent (callback) {
      // 這個功能在主要的訊息監聽器中實現
      return true
    }
  }
}

// ====================
// Service Worker 生命週期事件
// ====================

// 擴展安裝時的初始化
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('📦 擴展安裝完成', details)

  try {
    // 初始化事件系統
    await initializeEventSystem()

    // 設定預設配置
    await chrome.storage.local.set({
      isEnabled: true,
      extractionSettings: {
        autoExtract: false,
        progressTracking: true,
        dataValidation: true
      },
      version: chrome.runtime.getManifest().version
    })

    // 觸發系統初始化事件
    if (eventBus) {
      await eventBus.emit('SYSTEM.INSTALLED', {
        reason: details.reason,
        version: chrome.runtime.getManifest().version
      })
    }

    console.log('✅ 擴展安裝初始化完成')
  } catch (error) {
    console.error('❌ 擴展安裝初始化失敗:', error)
  }
})

// Service Worker 啟動
chrome.runtime.onStartup.addListener(async () => {
  console.log('🔄 Service Worker 重新啟動')

  try {
    // 重新初始化事件系統
    await initializeEventSystem()

    // 觸發系統重啟事件
    if (eventBus) {
      await eventBus.emit('SYSTEM.STARTUP', {
        timestamp: Date.now()
      })
    }

    console.log('✅ Service Worker 重啟完成')
  } catch (error) {
    console.error('❌ Service Worker 重啟失敗:', error)
  }
})

// ====================
// 跨上下文訊息處理
// ====================

// 來自 Content Script 和 Popup 的訊息處理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 收到訊息:', message, '來自:', sender)

  // 確保事件系統已初始化
  if (!eventBus || !chromeBridge) {
    console.warn('⚠️ 事件系統尚未初始化，嘗試重新初始化')
    initializeEventSystem().then(() => {
      handleMessage(message, sender, sendResponse)
    }).catch(error => {
      console.error('❌ 事件系統初始化失敗:', error)
      sendResponse({ success: false, error: '事件系統尚未就緒' })
    })
    return true // 保持訊息通道開啟
  }

  return handleMessage(message, sender, sendResponse)
})

/**
 * 處理跨上下文訊息
 */
function handleMessage (message, sender, sendResponse) {
  try {
    // 基本的訊息路由處理
    switch (message.type) {
      case 'PING':
        sendResponse({
          success: true,
          message: 'Background Service Worker 運作正常',
          eventSystem: {
            eventBus: !!eventBus,
            chromeBridge: !!chromeBridge
          }
        })
        break

      case 'HEALTH_CHECK':
        sendResponse({
          success: true,
          message: 'Background Service Worker 健康狀態正常',
          uptime: Date.now() - (globalThis.backgroundStartTime || Date.now()),
          eventSystem: {
            initialized: !!(eventBus && chromeBridge),
            eventBus: !!eventBus,
            chromeBridge: !!chromeBridge,
            handlersCount: eventBus ? Object.keys(eventBus._handlers || {}).length : 0,
            eventsProcessed: eventBus ? eventBus.getStats?.()?.totalEvents || 0 : 0
          }
        })
        break

      case 'EVENT_SYSTEM_STATUS_CHECK':
        sendResponse({
          success: true,
          eventSystem: {
            initialized: !!(eventBus && chromeBridge),
            eventBusStatus: eventBus ? 'active' : 'inactive',
            chromeBridgeStatus: chromeBridge ? 'active' : 'inactive',
            handlersCount: eventBus ? Object.keys(eventBus._handlers || {}).length : 0,
            eventsProcessed: eventBus ? eventBus.getStats?.()?.totalEvents || 0 : 0,
            lastActivity: eventBus ? eventBus.getStats?.()?.lastActivity || null : null
          }
        })
        break

      case 'GET_STATUS':
        chrome.storage.local.get(['isEnabled'], (result) => {
          sendResponse({
            success: true,
            isEnabled: result.isEnabled ?? true,
            serviceWorkerActive: true,
            eventSystem: {
              eventBus: !!eventBus,
              chromeBridge: !!chromeBridge,
              stats: eventBus ? eventBus.getStats() : null
            }
          })
        })
        return true // 保持訊息通道開啟用於異步回應

      // 事件系統相關訊息
      case 'EVENT.EMIT':
        if (message.eventType && eventBus) {
          eventBus.emit(message.eventType, message.data || {})
            .then(result => {
              sendResponse({ success: true, result })
            })
            .catch(error => {
              console.error('❌ 事件觸發失敗:', error)
              sendResponse({ success: false, error: error.message })
            })
          return true // 異步回應
        } else {
          sendResponse({ success: false, error: '事件類型或事件系統缺失' })
        }
        break

      case 'EVENT.STATS':
        if (eventBus) {
          sendResponse({
            success: true,
            stats: eventBus.getStats()
          })
        } else {
          sendResponse({ success: false, error: '事件系統未初始化' })
        }
        break

      // Content Script 來源的訊息
      case 'CONTENT.TO.BACKGROUND':
        handleContentMessage(message, sender, sendResponse)
        return true // 可能是異步回應

      // Popup 來源的訊息
      case 'POPUP.TO.BACKGROUND':
        handlePopupMessage(message, sender, sendResponse)
        return true // 可能是異步回應

      default:
        console.warn('⚠️ 未知的訊息類型:', message.type)
        sendResponse({ success: false, error: '未知的訊息類型' })
    }
  } catch (error) {
    console.error('❌ 訊息處理錯誤:', error)
    sendResponse({ success: false, error: error.message })
  }
}

/**
 * 處理來自 Content Script 的訊息
 */
async function handleContentMessage (message, sender, sendResponse) {
  try {
    console.log('📱 處理 Content Script 訊息:', message.data)

    // 觸發內部事件
    if (eventBus) {
      await eventBus.emit('CONTENT.MESSAGE.RECEIVED', {
        data: message.data,
        tabId: sender.tab?.id,
        url: sender.tab?.url,
        timestamp: Date.now()
      })
    }

    sendResponse({
      success: true,
      message: '訊息已處理',
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('❌ Content Script 訊息處理錯誤:', error)
    sendResponse({ success: false, error: error.message })
  }
}

/**
 * 處理來自 Popup 的訊息
 */
async function handlePopupMessage (message, sender, sendResponse) {
  try {
    console.log('🎨 處理 Popup 訊息:', message.data)

    // 觸發內部事件
    if (eventBus) {
      await eventBus.emit('POPUP.MESSAGE.RECEIVED', {
        data: message.data,
        timestamp: Date.now()
      })
    }

    sendResponse({
      success: true,
      message: '訊息已處理',
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('❌ Popup 訊息處理錯誤:', error)
    sendResponse({ success: false, error: error.message })
  }
}

// ====================
// 標籤頁監聽和頁面檢測
// ====================

// 標籤頁更新監聽（用於偵測 Readmoo 頁面）
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isReadmooPage = tab.url.includes('readmoo.com')

    if (isReadmooPage) {
      console.log('📚 檢測到 Readmoo 頁面:', tab.url)

      try {
        // 觸發頁面檢測事件
        if (eventBus) {
          await eventBus.emit('PAGE.READMOO.DETECTED', {
            tabId,
            url: tab.url,
            timestamp: Date.now()
          })
        }

        // 向 Content Script 發送頁面準備訊息
        const response = await chrome.tabs.sendMessage(tabId, {
          type: 'PAGE_READY',
          url: tab.url,
          timestamp: Date.now()
        })

        console.log('✅ Content Script 回應:', response)

        // 觸發頁面準備完成事件
        if (eventBus) {
          await eventBus.emit('PAGE.CONTENT.READY', {
            tabId,
            url: tab.url,
            response,
            timestamp: Date.now()
          })
        }
      } catch (error) {
        // Content Script 可能還未載入，這是正常的
        console.log('📝 Content Script 尚未就緒:', error.message)

        // 觸發 Content Script 未就緒事件
        if (eventBus) {
          await eventBus.emit('PAGE.CONTENT.NOT_READY', {
            tabId,
            url: tab.url,
            error: error.message,
            timestamp: Date.now()
          })
        }
      }
    }
  }
})

// ====================
// 錯誤處理和系統監控
// ====================

// Service Worker 錯誤處理
self.addEventListener('error', async (event) => {
  console.error('❌ Service Worker 錯誤:', event.error)

  // 觸發系統錯誤事件
  if (eventBus) {
    try {
      await eventBus.emit('SYSTEM.ERROR', {
        type: 'service_worker_error',
        error: event.error.message,
        stack: event.error.stack,
        timestamp: Date.now()
      })
    } catch (err) {
      console.error('❌ 無法記錄系統錯誤事件:', err)
    }
  }
})

// 未處理的 Promise 拒絕
self.addEventListener('unhandledrejection', async (event) => {
  console.error('❌ 未處理的 Promise 拒絕:', event.reason)

  // 觸發系統錯誤事件
  if (eventBus) {
    try {
      await eventBus.emit('SYSTEM.ERROR', {
        type: 'unhandled_promise_rejection',
        reason: event.reason?.message || event.reason,
        timestamp: Date.now()
      })
    } catch (err) {
      console.error('❌ 無法記錄 Promise 拒絕事件:', err)
    }
  }
});

// ====================
// Service Worker 初始化
// ====================

// 在 Service Worker 載入時立即初始化事件系統
(async function initializeBackgroundServiceWorker () {
  try {
    console.log('🚀 開始 Background Service Worker 初始化')

    // 初始化事件系統
    await initializeEventSystem()

    // 註冊基本事件監聽器
    if (eventBus) {
      // 系統事件監聽
      eventBus.on('SYSTEM.INSTALLED', (event) => {
        console.log('🎉 系統安裝事件:', event.data)
      })

      eventBus.on('SYSTEM.STARTUP', (event) => {
        console.log('🔄 系統啟動事件:', event.data)
      })

      eventBus.on('SYSTEM.ERROR', (event) => {
        console.error('💥 系統錯誤事件:', event.data)
      })

      // 頁面事件監聽
      eventBus.on('PAGE.READMOO.DETECTED', (event) => {
        console.log('📚 Readmoo 頁面檢測事件:', event.data)
      })

      eventBus.on('PAGE.CONTENT.READY', (event) => {
        console.log('✅ Content Script 就緒事件:', event.data)
      })

      // 跨上下文訊息事件監聽
      eventBus.on('CONTENT.MESSAGE.RECEIVED', (event) => {
        console.log('📱 Content Script 訊息事件:', event.data)
      })

      eventBus.on('POPUP.MESSAGE.RECEIVED', (event) => {
        console.log('🎨 Popup 訊息事件:', event.data)
      })
    }

    console.log('✅ Background Service Worker 初始化完成')

    // 觸發系統就緒事件
    if (eventBus) {
      await eventBus.emit('SYSTEM.READY', {
        timestamp: Date.now(),
        version: chrome.runtime.getManifest().version
      })
    }

    // 記錄啟動時間
    globalThis.backgroundStartTime = Date.now()
  } catch (error) {
    console.error('❌ Background Service Worker 初始化失敗:', error)
  }
})()
