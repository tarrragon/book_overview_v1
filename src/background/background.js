/**
 * Readmoo 書庫數據提取器 - Background Service Worker 啟動入口
 *
 * 負責功能：
 * - 作為 Chrome Extension Background Service Worker 的主要入口點
 * - 載入和啟動 BackgroundCoordinator 模組協調器
 * - 提供 Service Worker 生命週期事件處理
 * - 實現緊急錯誤處理和系統恢復機制
 *
 * 設計考量：
 * - 保持極簡設計，將複雜邏輯委託給 BackgroundCoordinator
 * - 遵循 Manifest V3 Service Worker 最佳實踐
 * - 實現健壯的錯誤處理和恢復機制
 * - 支援開發和生產環境的不同需求
 */

console.log('🚀 Readmoo 書庫提取器 Background Service Worker 啟動')

// 全域變數
let backgroundCoordinator = null
let isInitialized = false
let initializationAttempts = 0
const MAX_INITIALIZATION_ATTEMPTS = 3

// 緊急模式標記
let emergencyMode = false

/**
 * 主要初始化函數
 *
 * 負責功能：
 * - 載入 BackgroundCoordinator 模組協調器
 * - 執行完整的系統初始化流程
 * - 處理初始化失敗的重試邏輯
 * - 實現緊急模式降級方案
 *
 * 處理流程：
 * 1. 嘗試載入 BackgroundCoordinator
 * 2. 建立協調器實例並初始化
 * 3. 啟動所有系統模組
 * 4. 記錄啟動狀態和統計資料
 * 5. 處理錯誤和重試邏輯
 */
async function initializeBackgroundSystem () {
  if (isInitialized) {
    console.log('⏭️ 系統已初始化，跳過重複初始化')
    return backgroundCoordinator
  }

  initializationAttempts++
  console.log(`🔧 開始初始化 Background 系統 (嘗試 ${initializationAttempts}/${MAX_INITIALIZATION_ATTEMPTS})`)

  try {
    // 動態載入 BackgroundCoordinator
    const BackgroundCoordinator = require('./background-coordinator')

    // 建立協調器實例
    backgroundCoordinator = new BackgroundCoordinator()

    // 執行初始化
    console.log('🔧 初始化模組協調器...')
    await backgroundCoordinator.initialize()

    // 啟動所有模組
    console.log('▶️ 啟動所有系統模組...')
    await backgroundCoordinator.start()

    // 標記初始化完成
    isInitialized = true

    // 記錄成功狀態
    const stats = backgroundCoordinator.getCoordinatorStats()
    console.log('✅ Background 系統初始化完成')
    console.log('📊 系統統計:', {
      模組數量: stats.moduleCount,
      初始化時間: `${stats.initializationDuration}ms`,
      啟動時間: `${stats.startupDuration}ms`,
      總耗時: `${stats.initializationDuration + stats.startupDuration}ms`
    })

    // 設定全域實例供測試和外部模組使用
    if (backgroundCoordinator && backgroundCoordinator.eventBus) {
      global.eventBus = backgroundCoordinator.eventBus
      console.log('✅ 全域 EventBus 實例已設定')
    }

    if (backgroundCoordinator && backgroundCoordinator.chromeBridge) {
      global.chromeBridge = backgroundCoordinator.chromeBridge
      console.log('✅ 全域 ChromeBridge 實例已設定')
    }

    // 註冊 Service Worker 生命週期事件
    await registerServiceWorkerEvents()

    return backgroundCoordinator
  } catch (error) {
    console.error(`❌ Background 系統初始化失敗 (嘗試 ${initializationAttempts}):`, error)

    // 重試邏輯
    if (initializationAttempts < MAX_INITIALIZATION_ATTEMPTS) {
      console.log(`🔄 ${2000}ms 後重試初始化...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
      return await initializeBackgroundSystem()
    }

    // 啟動緊急模式
    console.error('🚨 達到最大重試次數，啟動緊急模式')
    await activateEmergencyMode()
    throw error
  }
}

/**
 * 註冊 Service Worker 生命週期事件
 *
 * 負責功能：
 * - 處理 Chrome Extension 安裝和更新事件
 * - 管理 Service Worker 啟動和關閉事件
 * - 實現系統健康監控和自動恢復
 * - 處理意外關閉和重新啟動邏輯
 */
async function registerServiceWorkerEvents () {
  try {
    console.log('📝 註冊 Service Worker 生命週期事件')

    // Chrome Extension 安裝事件
    if (chrome.runtime.onInstalled) {
      chrome.runtime.onInstalled.addListener(async (details) => {
        console.log('📦 擴展安裝事件:', details.reason)

        if (backgroundCoordinator && backgroundCoordinator.eventBus) {
          await backgroundCoordinator.eventBus.emit('SYSTEM.INSTALLED', {
            reason: details.reason,
            previousVersion: details.previousVersion,
            timestamp: Date.now()
          })
        }
      })
    }

    // Chrome Extension 啟動事件
    if (chrome.runtime.onStartup) {
      chrome.runtime.onStartup.addListener(async () => {
        console.log('▶️ 擴展啟動事件')

        if (backgroundCoordinator && backgroundCoordinator.eventBus) {
          await backgroundCoordinator.eventBus.emit('SYSTEM.STARTUP', {
            timestamp: Date.now()
          })
        }
      })
    }

    // Service Worker 異常中斷處理
    addEventListener('error', (event) => {
      console.error('🚨 Service Worker 異常錯誤:', event.error)

      // 嘗試收集錯誤到錯誤處理器
      if (backgroundCoordinator && backgroundCoordinator.errorHandler) {
        backgroundCoordinator.errorHandler.collectError({
          message: event.error?.message || 'Service Worker異常錯誤',
          error: event.error,
          category: 'system',
          severity: 'critical',
          context: {
            source: 'serviceWorker',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        })
      }
    })

    // Service Worker 未處理的 Promise 拒絕
    addEventListener('unhandledrejection', (event) => {
      console.error('🚨 未處理的 Promise 拒絕:', event.reason)

      // 嘗試收集錯誤到錯誤處理器
      if (backgroundCoordinator && backgroundCoordinator.errorHandler) {
        backgroundCoordinator.errorHandler.collectError({
          message: `未處理的Promise拒絕: ${event.reason}`,
          error: event.reason,
          category: 'system',
          severity: 'high',
          context: {
            source: 'serviceWorker',
            type: 'unhandledRejection'
          }
        })
      }

      // 防止錯誤傳播到控制台（已記錄）
      event.preventDefault()
    })

    console.log('✅ Service Worker 生命週期事件註冊完成')
  } catch (error) {
    console.error('❌ 註冊 Service Worker 事件失敗:', error)
  }
}

/**
 * 啟動緊急模式
 *
 * 負責功能：
 * - 當正常初始化失敗時提供基本功能
 * - 實現簡化的事件處理和通訊機制
 * - 確保擴展在降級狀態下仍能基本運作
 * - 記錄緊急模式相關的診斷資訊
 */
async function activateEmergencyMode () {
  console.log('🚨 啟動緊急模式')
  emergencyMode = true

  try {
    // 建立簡化的事件總線
    createEmergencyEventBus()

    // 註冊基本的訊息處理
    if (chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('📨 [緊急模式] 收到訊息:', message)

        // 基本的回應處理
        if (message.type === 'GET_SYSTEM_STATUS') {
          sendResponse({
            success: true,
            data: {
              mode: 'emergency',
              timestamp: Date.now(),
              message: '系統運行於緊急模式'
            }
          })
          return true
        }

        // 其他訊息的通用回應
        sendResponse({
          success: false,
          error: '系統運行於緊急模式，功能受限'
        })
        return true
      })
    }

    console.log('🚨 緊急模式啟動完成')
  } catch (error) {
    console.error('❌ 緊急模式啟動失敗:', error)
  }
}

/**
 * 建立緊急事件總線
 * @returns {Object} 簡化的事件總線
 */
function createEmergencyEventBus () {
  const listeners = new Map()

  return {
    on (eventType, handler) {
      if (!listeners.has(eventType)) {
        listeners.set(eventType, [])
      }
      listeners.get(eventType).push(handler)
    },

    async emit (eventType, data) {
      if (!listeners.has(eventType)) return

      const handlers = listeners.get(eventType)
      for (const handler of handlers) {
        try {
          await handler({ type: eventType, data, timestamp: Date.now() })
        } catch (error) {
          console.error(`❌ [緊急模式] 事件處理錯誤 (${eventType}):`, error)
        }
      }
    }
  }
}

/**
 * 提供系統狀態查詢介面
 * @returns {Object} 系統狀態資訊
 */
function getSystemStatus () {
  if (emergencyMode) {
    return {
      mode: 'emergency',
      initialized: false,
      coordinator: null,
      message: '系統運行於緊急模式'
    }
  }

  if (!isInitialized || !backgroundCoordinator) {
    return {
      mode: 'initializing',
      initialized: false,
      coordinator: null,
      attempts: initializationAttempts
    }
  }

  return {
    mode: 'normal',
    initialized: true,
    coordinator: backgroundCoordinator.getCoordinatorStats(),
    moduleStatus: backgroundCoordinator.getAllModuleStatuses()
  }
}

/**
 * 提供協調器實例訪問
 * @returns {Object|null} 協調器實例
 */
function getBackgroundCoordinator () {
  return backgroundCoordinator
}

// 立即啟動系統
console.log('🏁 開始 Background Service Worker 初始化流程')
initializeBackgroundSystem()
  .then(() => {
    console.log('🎉 Background Service Worker 初始化成功完成')
  })
  .catch((error) => {
    console.error('💥 Background Service Worker 初始化最終失敗:', error)
  })

// 匯出公用介面（用於測試和診斷）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getSystemStatus,
    getBackgroundCoordinator,
    initializeBackgroundSystem
  }
}

// 全域訪問（用於 Chrome DevTools 調試）
globalThis.backgroundServiceWorker = {
  getStatus: getSystemStatus,
  getCoordinator: getBackgroundCoordinator,
  restart: async () => {
    if (backgroundCoordinator) {
      await backgroundCoordinator.restart()
    }
  }
}
