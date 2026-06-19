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

// 統一日誌管理系統
import { Logger } from '../core/logging/Logger.js'
import { MessageDictionary } from '../core/messages/MessageDictionary.js'
import { OperationResult } from '../core/errors/OperationResult.js'
import { ErrorCodes } from '../core/errors/ErrorCodes.js'

/**
 * Background Service Worker local MessageDictionary (W1-110.1)
 *
 * 業務情境：仿 W1-108 readmoo-adapter local dict 模式（commit c5c5f21a），
 * 將 27 個 background-specific 訊息 key 從 GlobalMessages 解耦，改以
 * module-level local dict 注入 Logger 第三參數消費。W1-115 修復 Logger
 * constructor union signature 後，此 local dict 在 Service Worker runtime
 * 真正生效。
 *
 * Why（W1-110 freeze 預檢）：W1-110 規劃對 GlobalMessages.messages 套
 * Object.freeze 禁止後續 addMessages 動態寫入，從根本防護 W1-004 模式重演。
 * 原 background.js 直接呼叫 GlobalMessages.addMessages(...) 註冊 27 key
 * 與 freeze 互斥，必須先遷移為 local dict 才能解鎖 W1-110。
 *
 * PC-165 防護：單元測試 mock Logger 無法驗證 messages 參數是否真正被消費；
 * 需 runtime 層級驗證（真實 Logger + spy console）確認渲染後字串非
 * `[Missing: KEY]`。
 *
 * 範圍邊界：
 * - 本地擁有：原 GlobalMessages.addMessages 註冊的 27 個 background 專屬 key
 * - 不在範圍：GlobalMessages._loadDefaultMessages 清理（W1-109 已完成）；
 *   GlobalMessages.messages freeze（W1-110 parent ticket 範圍）
 *
 * 設計考量：訊息文字保留原 emoji + 中文格式；W1-115 後 Logger 可注入 local
 * dict，此處過渡註解已更新，不再依賴 GlobalMessages 動態註冊機制。
 */
const backgroundMessages = new MessageDictionary({
  BACKGROUND_STARTUP: '[START] Readmoo 書庫提取器 Background Service Worker 啟動',
  SKIP_DUPLICATE_INIT: '[SKIP] 系統已初始化,跳過重複初始化',
  INIT_ATTEMPT: '[FIX] 開始初始化 Background 系統 (嘗試 {attempt}/{max})',
  INIT_COORDINATOR: '[FIX] 初始化模組協調器...',
  START_MODULES: '[START] 啟動所有系統模組...',
  INIT_COMPLETE: '[OK] Background 系統初始化完成',
  SYSTEM_STATS: '[STATS] 系統統計',
  EVENTBUS_READY: '[OK] 全域 EventBus 實例已設定',
  CHROMEBRIDGE_READY: '[OK] 全域 ChromeBridge 實例已設定',
  INIT_FAILED: '[FAIL] Background 系統初始化失敗 (嘗試 {attempt})',
  RETRY_INIT: '[RETRY] {delay}ms 後重試初始化...',
  MAX_RETRIES_REACHED: '[ALERT] 達到最大重試次數,啟動緊急模式',
  REGISTER_LIFECYCLE: '[LOG] 註冊 Service Worker 生命週期事件',
  EXTENSION_INSTALLED: '擴展安裝事件',
  EXTENSION_STARTUP: '[START] 擴展啟動事件',
  WORKER_ERROR: '[ALERT] Service Worker 異常錯誤',
  UNHANDLED_REJECTION: '[ALERT] 未處理的 Promise 拒絕',
  LIFECYCLE_COMPLETE: '[OK] Service Worker 生命週期事件註冊完成',
  LIFECYCLE_FAILED: '[FAIL] 註冊 Service Worker 事件失敗',
  EMERGENCY_MODE: '[ALERT] 啟動緊急模式',
  EMERGENCY_MESSAGE: '[緊急模式] 收到訊息',
  EMERGENCY_COMPLETE: '[ALERT] 緊急模式啟動完成',
  EMERGENCY_FAILED: '[FAIL] 緊急模式啟動失敗',
  EMERGENCY_ERROR: '[FAIL] [緊急模式] 事件處理錯誤 ({eventType})',
  INIT_FLOW_START: '開始 Background Service Worker 初始化流程',
  INIT_FLOW_SUCCESS: 'Background Service Worker 初始化成功完成',
  INIT_FLOW_FAILED: 'Background Service Worker 初始化最終失敗',
  PRESET_INIT_START: '[FIX] 載入賴永祥分類法預裝樹 ({trigger})',
  PRESET_INIT_OK: '[OK] 預裝樹載入完成 (共 {count} 節點)',
  PRESET_INIT_SKIP: '[SKIP] 預裝樹載入失敗或配額不足，記待補旗標 ({error})',
  PRESET_INIT_ERROR: '[FAIL] 預裝樹載入異常 ({trigger})',
  INIT_BUFFER_FLUSH: '[FIX] Flush init 期間緩衝訊息 (共 {count} 條)',
  INIT_BUFFER_OVERFLOW: '[WARN] init 緩衝已滿，拒絕訊息 ({type}，上限 {limit})',
  INIT_BUFFER_FLUSH_ERROR: '[FAIL] 緩衝訊息 flush 失敗 ({type})'
})

// W1-110.1: Logger 第三參數注入 backgroundMessages local dict
// （W1-115 修復 constructor union signature 後，此模式 runtime 真正生效）
const logger = new Logger('BackgroundService', 'INFO', backgroundMessages)

// 維持向下相容的 log 物件
// W1-110.1.1（PC-165 收尾）：log.error 第二參數新增 union 型別支援：
// (Error | Object)。傳入 Error 時自動萃取為 { error: error.message }；
// 傳入 Object 時視為 logEntry data 直接交由 Logger 渲染。後者保留
// messageKey placeholder 所需的 context 欄位（如 EMERGENCY_ERROR
// 需 { eventType, error } 同時提供）。
const log = {
  info: (message, data = {}) => logger.info(message, data),
  error: (message, errorOrData = {}) => {
    const isError = errorOrData instanceof Error
    const data = isError ? { error: errorOrData.message } : errorOrData
    logger.error(message, data)
  },
  warn: (message, data = {}) => logger.warn(message, data)
}

log.info('BACKGROUND_STARTUP')

// 全域變數
let backgroundCoordinator = null
let isInitialized = false
let initializationAttempts = 0
const MAX_INITIALIZATION_ATTEMPTS = 3

// 緊急模式標記
let emergencyMode = false

/**
 * init 期間訊息緩衝（0.20.0-W2-006.1，W2-006 方案 A）
 *
 * 業務情境：W2-002 已將頂層 onMessage listener 同步註冊（MV3 鐵則），但真正
 * 的業務訊息路由 listener 由 coordinator 內 MessageRouter 在 await init 之後
 * 才註冊。MV3 service worker 非持久，SW 在 init await 期間被喚醒時，業務訊息
 * 會在 MessageRouter listener 註冊前派發 → 靜默漏接。
 *
 * 解法：init 期間（isInitialized=false 且非 emergency）頂層 listener 將業務
 * 訊息三元組緩衝於模組頂層陣列，並 return true 保持 sendResponse 通道開啟；
 * initializeBackgroundSystem 完成後 flushPendingMessages 逐一交
 * backgroundCoordinator.messageRouter.routeMessage 路由，原 sendResponse
 * 通道得以回應。
 *
 * 上限保護：緩衝達 MAX_PENDING_MESSAGES 條時，新訊息直接回 OperationResult
 * 失敗回應（避免無上限記憶體成長 / SW 喚醒風暴堆積）。
 */
const pendingMessages = []
const MAX_PENDING_MESSAGES = 50

// Service Worker 全域錯誤處理（必須在頂層同步註冊，避免 Chrome 警告）
// 設計意圖：Chrome 要求 error/unhandledrejection handler 在 SW 腳本初始評估階段註冊，
// 不可在 async 函式中延遲註冊。此處用 console.error 因為 Logger 可能尚未完成初始化。
// eslint-disable-next-line no-console
addEventListener('error', (event) => {
  // eslint-disable-next-line no-console
  console.error('[SW] 未捕獲錯誤:', event.error || event.message)
})

// eslint-disable-next-line no-console
addEventListener('unhandledrejection', (event) => {
  // eslint-disable-next-line no-console
  console.error('[SW] 未處理的 Promise 拒絕:', event.reason)
})

/**
 * 同步註冊 Service Worker 生命週期 listener（MV3 鐵則，0.20.0-W2-002）
 *
 * 業務情境：MV3 service worker 非持久（約 30 秒無活動即被終止）。Chrome 要求
 * 事件 listener 在 SW 腳本「初始評估的同步階段」就 addListener，否則 SW 被
 * 喚醒/重啟時，事件可能在 listener 註冊前派發而靜默漏接。
 *
 * 缺陷修正：原 onInstalled / onStartup 包在 registerServiceWorkerEvents() 內，
 * 而該函式於 initializeBackgroundSystem() 的多個 await（coordinator.initialize /
 * start）之後（約行 188）才被呼叫——違反 MV3 鐵則。onMessage 過去更僅在
 * emergency 模式才註冊，正常路徑下喚醒期間完全漏接。本函式將三個 addListener
 * 提至模組頂層同步階段；callback 內部的 async 工作（emit / 路由）不變，於事件
 * 實際觸發時才執行，此時 backgroundCoordinator 多已就緒（callback 內已有
 * null guard）。
 *
 * 設計考量：
 * - listener 「註冊」在同步階段；callback「執行」在事件觸發時（延後），符合
 *   MV3 規範且不需等待 init 完成。
 * - onMessage 頂層 listener 僅處理 early-boot / emergency 的 baseline 回應
 *   （GET_SYSTEM_STATUS），其餘訊息回傳 undefined，交由 coordinator 內
 *   MessageRouter 註冊的 listener 處理，避免 sendResponse 通道雙重佔用。
 */
/**
 * 載入賴永祥分類法預裝樹（場景組 D 接線）。
 *
 * 業務情境：MV3 onInstalled（首裝/更新）與 onStartup（喚醒補償）皆呼叫
 * initializePresets——其確定性 ID upsert 冪等，已存在節點跳過、僅補缺失，
 * 故兩個生命週期事件重複觸發不會重建或產生重複節點（D3 補償安全）。
 *
 * 設計考量：採惰性 require（非頂層 import），避免 listener 同步註冊階段
 * 連帶載入 adapter 與其相依模組；實際載入工作延後至事件觸發時執行，符合
 * MV3「listener 註冊同步、callback 執行延後」規範。失敗（配額不足/寫入錯誤）
 * 不拋出，記日誌待補旗標，避免影響其餘生命週期流程。
 *
 * @param {string} trigger - 觸發來源（'onInstalled' | 'onStartup'），供日誌標示
 */
async function loadClassificationPresets (trigger) {
  try {
    log.info('PRESET_INIT_START', { trigger })
    const TagStorageAdapter = require('../storage/adapters/tag-storage-adapter')
    const result = await TagStorageAdapter.initializePresets()
    if (result && result.success) {
      log.info('PRESET_INIT_OK', { count: result.count })
    } else {
      log.warn('PRESET_INIT_SKIP', { error: (result && result.error) || 'unknown' })
    }
  } catch (error) {
    log.error('PRESET_INIT_ERROR', { trigger, error: error?.message })
  }
}

function registerLifecycleListeners () {
  try {
    log.info('REGISTER_LIFECYCLE')

    // Chrome Extension 安裝事件
    if (chrome.runtime.onInstalled) {
      chrome.runtime.onInstalled.addListener(async (details) => {
        log.info('EXTENSION_INSTALLED', { reason: details.reason })

        // 場景組 D：首裝/更新載入賴永祥分類法預裝樹（冪等 upsert）
        await loadClassificationPresets('onInstalled')

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
        log.info('EXTENSION_STARTUP')

        // 場景組 D：喚醒補償載入（冪等，補注 onInstalled 可能遺漏的節點）
        await loadClassificationPresets('onStartup')

        if (backgroundCoordinator && backgroundCoordinator.eventBus) {
          await backgroundCoordinator.eventBus.emit('SYSTEM.STARTUP', {
            timestamp: Date.now()
          })
        }
      })
    }

    // Chrome Extension 訊息事件（baseline / 緩衝 / emergency 回應）
    // 設計意圖：正常訊息路由由 coordinator 內 MessageRouter 的 onMessage
    // listener 負責。此頂層 listener 處理三種未就緒情境：
    // 1. 系統正常就緒 → 回傳 undefined 不攔截，讓 MessageRouter listener 接手。
    // 2. init 進行中（非 emergency）→ GET_SYSTEM_STATUS 回 baseline 狀態；
    //    其餘業務訊息緩衝（W2-006.1），init 完成後 flush 至 MessageRouter。
    // 3. emergency 模式 → GET_SYSTEM_STATUS 回 emergency baseline；其餘回受限提示
    //    （無 coordinator 可 flush，故不緩衝）。
    if (chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // 系統正常就緒後，交由 MessageRouter 處理（回傳 undefined 不攔截）
        if (isInitialized && !emergencyMode) {
          return undefined
        }

        // GET_SYSTEM_STATUS：未就緒狀態下提供 baseline 狀態回應（不緩衝）
        if (message && message.type === 'GET_SYSTEM_STATUS') {
          if (emergencyMode) {
            log.info('EMERGENCY_MESSAGE', { message })
          }
          sendResponse({
            success: true,
            data: {
              mode: emergencyMode ? 'emergency' : 'initializing',
              timestamp: Date.now(),
              message: emergencyMode ? '系統運行於緊急模式' : '系統初始化中'
            }
          })
          return true
        }

        // GET_STATUS：init 期間提供 baseline 回應，讓 popup 知道 SW 正在初始化
        // （1.1.0-W1-019 C 方案核心：消除 popup 2 秒 timeout 前無回應的永久離線）
        if (message && message.type === 'GET_STATUS' && !emergencyMode) {
          sendResponse({
            success: true,
            isEnabled: true,
            serviceWorkerActive: true,
            initializing: true,
            mode: 'initializing',
            timestamp: Date.now()
          })
          return true
        }

        // emergency 模式：無 coordinator 可 flush，業務訊息回受限提示
        if (emergencyMode) {
          sendResponse({
            success: false,
            error: '系統運行於緊急模式，功能受限'
          })
          return true
        }

        // init 進行中：緩衝業務訊息三元組，init 完成後 flush 至 MessageRouter
        return bufferMessageDuringInit(message, sender, sendResponse)
      })
    }

    log.info('LIFECYCLE_COMPLETE')
  } catch (error) {
    log.error('LIFECYCLE_FAILED', error)
  }
}

// MV3 鐵則：在模組頂層同步階段註冊 listener（不可延後到 init 完成之後）
registerLifecycleListeners()

/**
 * 緩衝 init 期間的業務訊息（0.20.0-W2-006.1，W2-006 方案 A）
 *
 * 業務情境：init 進行中時，coordinator 內 MessageRouter listener 尚未註冊，
 * 業務訊息無法路由。將三元組緩衝於頂層 pendingMessages 陣列，init 完成後由
 * flushPendingMessages 逐一交 MessageRouter；同步 return true 保持 sendResponse
 * 通道開啟，使 flush 時的回應得以送回原 caller。
 *
 * 上限保護：緩衝達 MAX_PENDING_MESSAGES 時，新訊息直接回 OperationResult
 * 失敗回應（不入緩衝），避免無上限記憶體成長。
 *
 * @param {Object} message - 訊息物件
 * @param {Object} sender - 發送者資訊
 * @param {Function} sendResponse - 回應函數（須保持通道供 flush 時回應）
 * @returns {boolean} true 保持 sendResponse 通道開啟（MV3 鐵則）
 */
function bufferMessageDuringInit (message, sender, sendResponse) {
  if (pendingMessages.length >= MAX_PENDING_MESSAGES) {
    const error = new Error('系統初始化中訊息緩衝已滿，請稍後再試')
    error.code = ErrorCodes.OPERATION_ERROR
    sendResponse(OperationResult.failure(error).toJSON())
    log.warn('INIT_BUFFER_OVERFLOW', { type: message?.type, limit: MAX_PENDING_MESSAGES })
    return true
  }

  pendingMessages.push({ message, sender, sendResponse })
  return true
}

/**
 * Flush init 期間緩衝的訊息至 MessageRouter（0.20.0-W2-006.1）
 *
 * 業務情境：initializeBackgroundSystem 完成（isInitialized=true）後呼叫，將
 * 緩衝的業務訊息三元組逐一交 backgroundCoordinator.messageRouter.routeMessage
 * 路由，使 init await 期間漏接的訊息得以正常處理並回應原 caller。
 *
 * 設計考量：
 * - 逐一處理保持 FIFO 順序（與緩衝順序一致）。
 * - 單條路由失敗不中斷後續 flush（錯誤隔離），個別失敗以 OperationResult
 *   回原 sendResponse 並記日誌。
 * - flush 後清空緩衝；coordinator 或 messageRouter 缺失時降級回受限提示，
 *   避免靜默吞掉已緩衝訊息。
 *
 * @returns {Promise<void>}
 */
async function flushPendingMessages () {
  if (pendingMessages.length === 0) {
    return
  }

  log.info('INIT_BUFFER_FLUSH', { count: pendingMessages.length })

  // 取出全部緩衝並清空，避免 flush 期間新訊息混入重複處理
  const buffered = pendingMessages.splice(0, pendingMessages.length)
  const messageRouter = backgroundCoordinator && backgroundCoordinator.messageRouter

  for (const { message, sender, sendResponse } of buffered) {
    try {
      if (messageRouter && typeof messageRouter.routeMessage === 'function') {
        await messageRouter.routeMessage(message, sender, sendResponse)
      } else {
        // 降級：coordinator/messageRouter 缺失，回受限提示不靜默吞掉
        const error = new Error('訊息路由器不可用，緩衝訊息無法路由')
        error.code = ErrorCodes.OPERATION_ERROR
        sendResponse(OperationResult.failure(error).toJSON())
      }
    } catch (error) {
      log.error('INIT_BUFFER_FLUSH_ERROR', { type: message?.type, error: error?.message })
      try {
        const flushError = new Error(error?.message || '緩衝訊息路由失敗')
        flushError.code = ErrorCodes.OPERATION_ERROR
        sendResponse(OperationResult.failure(flushError).toJSON())
      } catch (responseError) {
        // sendResponse 通道可能已關閉，記錄不再拋出（錯誤隔離）
        log.error('INIT_BUFFER_FLUSH_ERROR', { type: message?.type, error: responseError?.message })
      }
    }
  }
}

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
    log.info('SKIP_DUPLICATE_INIT')
    return backgroundCoordinator
  }

  initializationAttempts++
  log.info('INIT_ATTEMPT', { attempt: initializationAttempts, max: MAX_INITIALIZATION_ATTEMPTS })

  try {
    // 動態載入 BackgroundCoordinator
    const BackgroundCoordinator = require('./background-coordinator')

    // 建立協調器實例
    backgroundCoordinator = new BackgroundCoordinator()

    // 執行初始化
    log.info('INIT_COORDINATOR')
    await backgroundCoordinator.initialize()

    // 啟動所有模組
    log.info('START_MODULES')
    await backgroundCoordinator.start()

    // 標記初始化完成
    isInitialized = true

    // Flush init 期間緩衝的業務訊息至 MessageRouter（0.20.0-W2-006.1）。
    // 此時 coordinator 已 start（MessageRouter listener 已註冊），init 後新訊息
    // 由 MessageRouter listener 直接接手，僅 init await 期間漏接的緩衝訊息需 flush。
    await flushPendingMessages()

    // 記錄成功狀態
    const stats = backgroundCoordinator.getCoordinatorStats()
    log.info('INIT_COMPLETE')
    log.info('SYSTEM_STATS', {
      模組數量: stats.moduleCount,
      初始化時間: `${stats.initializationDuration}ms`,
      啟動時間: `${stats.startupDuration}ms`,
      總耗時: `${stats.initializationDuration + stats.startupDuration}ms`
    })

    // 設定全域實例供測試和外部模組使用
    if (backgroundCoordinator && backgroundCoordinator.eventBus) {
      globalThis.eventBus = backgroundCoordinator.eventBus
      log.info('EVENTBUS_READY')
    }

    if (backgroundCoordinator && backgroundCoordinator.chromeBridge) {
      globalThis.chromeBridge = backgroundCoordinator.chromeBridge
      log.info('CHROMEBRIDGE_READY')
    }

    // 生命週期事件 listener 已於模組頂層同步階段註冊（registerLifecycleListeners，
    // MV3 鐵則 0.20.0-W2-002），此處不再延後註冊。

    return backgroundCoordinator
  } catch (error) {
    log.error('INIT_FAILED', { attempt: initializationAttempts, error })

    // 重試邏輯
    if (initializationAttempts < MAX_INITIALIZATION_ATTEMPTS) {
      log.info('RETRY_INIT', { delay: 2000 })
      await new Promise(resolve => setTimeout(resolve, 2000))
      return await initializeBackgroundSystem()
    }

    // 啟動緊急模式
    log.error('MAX_RETRIES_REACHED')
    await activateEmergencyMode()
    throw error
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
  log.error('EMERGENCY_MODE')
  emergencyMode = true

  try {
    // 建立簡化的事件總線
    createEmergencyEventBus()

    // 訊息處理：onMessage listener 已於模組頂層同步註冊
    // （registerLifecycleListeners，MV3 鐵則 0.20.0-W2-002）。emergencyMode
    // 旗標已於本函式開頭設為 true，頂層 handler 會據此切換為 emergency baseline
    // 回應，不再於此重複註冊 addListener（避免延後註冊 + 雙重 listener）。

    log.info('EMERGENCY_COMPLETE')
  } catch (error) {
    log.error('EMERGENCY_FAILED', error)
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
          // W1-110.1.1 補強：PA 表格未列此案（line 322），但與 PA 13 案
          // 同屬 PC-165 「描述性字串繞過 messageKey」反模式（dict key
          // EMERGENCY_ERROR 已就緒含 {eventType} placeholder），於本
          // ticket 一併修復。data 同時帶 eventType 與 error message，
          // 經 union 型別 log.error wrapper 直傳 logger。
          log.error('EMERGENCY_ERROR', { eventType, error: error?.message })
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
log.info('INIT_FLOW_START')
initializeBackgroundSystem()
  .then(() => {
    log.info('INIT_FLOW_SUCCESS')
  })
  .catch((error) => {
    log.error('INIT_FLOW_FAILED', error)
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
