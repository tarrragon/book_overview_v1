/**
const Logger = require("src/core/logging/Logger")
 * Overview 頁面初始化腳本
const Logger = require("src/core/logging/Logger")
 * 基於事件驅動架構，整合 OverviewPageController 與事件系統
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 負責功能：
const Logger = require("src/core/logging/Logger")
 * - 初始化 Overview 頁面的事件系統
const Logger = require("src/core/logging/Logger")
 * - 創建和配置 OverviewPageController 實例
const Logger = require("src/core/logging/Logger")
 * - 處理頁面載入和錯誤狀態
const Logger = require("src/core/logging/Logger")
 * - 提供統一的錯誤處理機制
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 設計考量：
const Logger = require("src/core/logging/Logger")
 * - 適配 Chrome Extension 環境
const Logger = require("src/core/logging/Logger")
 * - 支援事件驅動的資料流管理
const Logger = require("src/core/logging/Logger")
 * - 提供完整的初始化錯誤恢復機制
const Logger = require("src/core/logging/Logger")
 * - 整合現有的事件處理器架構
const Logger = require("src/core/logging/Logger")
 */

// 引入標準化錯誤處理 (瀏覽器環境)
const Logger = require("src/core/logging/Logger")
if (typeof window !== 'undefined' && window.StandardError) {
const Logger = require("src/core/logging/Logger")
  // StandardError 已在全域可用
const Logger = require("src/core/logging/Logger")
} else if (typeof require !== 'undefined') {
const Logger = require("src/core/logging/Logger")
  const { StandardError } = require('src/core/errors/StandardError')
const Logger = require("src/core/logging/Logger")
  if (typeof window !== 'undefined') {
const Logger = require("src/core/logging/Logger")
    window.StandardError = StandardError
const Logger = require("src/core/logging/Logger")
  }
const Logger = require("src/core/logging/Logger")
}

/* global EventBus, ChromeEventBridge, OverviewPageController, StandardError */

const Logger = require("src/core/logging/Logger")
(function () {
const Logger = require("src/core/logging/Logger")
  'use strict'

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 全域變數
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  let eventBus = null
const Logger = require("src/core/logging/Logger")
  let chromeBridge = null
const Logger = require("src/core/logging/Logger")
  let overviewController = null

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化事件系統
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * 負責功能：
const Logger = require("src/core/logging/Logger")
   * - 檢查並初始化 EventBus
const Logger = require("src/core/logging/Logger")
   * - 檢查並初始化 ChromeEventBridge
const Logger = require("src/core/logging/Logger")
   * - 設定事件系統的相互引用
const Logger = require("src/core/logging/Logger")
   * - 提供降級處理機制
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * 設計考量：
const Logger = require("src/core/logging/Logger")
   * - 適應不同的載入環境（擴展頁面 vs 獨立頁面）
const Logger = require("src/core/logging/Logger")
   * - 提供錯誤處理和初始化重試機制
const Logger = require("src/core/logging/Logger")
   * - 確保事件系統的正確初始化順序
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async function initializeEventSystem () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      // 檢查 EventBus 是否可用
const Logger = require("src/core/logging/Logger")
      if (typeof EventBus !== 'undefined') {
const Logger = require("src/core/logging/Logger")
        eventBus = new EventBus()
const Logger = require("src/core/logging/Logger")
      } else if (window.eventBus) {
const Logger = require("src/core/logging/Logger")
        // 使用全域 EventBus 實例
const Logger = require("src/core/logging/Logger")
        eventBus = window.eventBus
const Logger = require("src/core/logging/Logger")
      } else {
const Logger = require("src/core/logging/Logger")
        // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
        // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
        Logger.warn('⚠️ EventBus 不可用，使用簡化實現')
const Logger = require("src/core/logging/Logger")
        eventBus = createFallbackEventBus()
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      // 檢查 ChromeEventBridge 是否可用
const Logger = require("src/core/logging/Logger")
      if (typeof ChromeEventBridge !== 'undefined' && typeof chrome !== 'undefined') {
const Logger = require("src/core/logging/Logger")
        chromeBridge = new ChromeEventBridge(eventBus)
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      return { eventBus, chromeBridge }
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.error('❌ 事件系統初始化失敗:', error)
const Logger = require("src/core/logging/Logger")
      throw error
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 創建降級版本的 EventBus
const Logger = require("src/core/logging/Logger")
   * 用於非 Chrome Extension 環境或 EventBus 不可用時
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  function createFallbackEventBus () {
const Logger = require("src/core/logging/Logger")
    const listeners = new Map()

const Logger = require("src/core/logging/Logger")
    return {
const Logger = require("src/core/logging/Logger")
      on (eventType, handler) {
const Logger = require("src/core/logging/Logger")
        if (!listeners.has(eventType)) {
const Logger = require("src/core/logging/Logger")
          listeners.set(eventType, [])
const Logger = require("src/core/logging/Logger")
        }
const Logger = require("src/core/logging/Logger")
        listeners.get(eventType).push(handler)
const Logger = require("src/core/logging/Logger")
      },

const Logger = require("src/core/logging/Logger")
      emit (eventType, data) {
const Logger = require("src/core/logging/Logger")
        return new Promise((resolve) => {
const Logger = require("src/core/logging/Logger")
          if (listeners.has(eventType)) {
const Logger = require("src/core/logging/Logger")
            const eventHandlers = listeners.get(eventType)
const Logger = require("src/core/logging/Logger")
            Promise.all(eventHandlers.map(handler => {
const Logger = require("src/core/logging/Logger")
              try {
const Logger = require("src/core/logging/Logger")
                return Promise.resolve(handler({ type: eventType, data }))
const Logger = require("src/core/logging/Logger")
              } catch (error) {
const Logger = require("src/core/logging/Logger")
                // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
                // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
                Logger.error(`事件處理錯誤 (${eventType}):`, error)
const Logger = require("src/core/logging/Logger")
                return null
const Logger = require("src/core/logging/Logger")
              }
const Logger = require("src/core/logging/Logger")
            })).then(() => resolve())
const Logger = require("src/core/logging/Logger")
          } else {
const Logger = require("src/core/logging/Logger")
            resolve()
const Logger = require("src/core/logging/Logger")
          }
const Logger = require("src/core/logging/Logger")
        })
const Logger = require("src/core/logging/Logger")
      },

const Logger = require("src/core/logging/Logger")
      off (eventType, handler) {
const Logger = require("src/core/logging/Logger")
        if (listeners.has(eventType)) {
const Logger = require("src/core/logging/Logger")
          const handlers = listeners.get(eventType)
const Logger = require("src/core/logging/Logger")
          const index = handlers.indexOf(handler)
const Logger = require("src/core/logging/Logger")
          if (index !== -1) {
const Logger = require("src/core/logging/Logger")
            handlers.splice(index, 1)
const Logger = require("src/core/logging/Logger")
          }
const Logger = require("src/core/logging/Logger")
        }
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化 Overview 頁面控制器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * 負責功能：
const Logger = require("src/core/logging/Logger")
   * - 創建 OverviewPageController 實例
const Logger = require("src/core/logging/Logger")
   * - 配置事件系統整合
const Logger = require("src/core/logging/Logger")
   * - 註冊必要的事件監聽器
const Logger = require("src/core/logging/Logger")
   * - 處理控制器初始化錯誤
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async function initializeOverviewController () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      // 檢查 OverviewPageController 是否可用
const Logger = require("src/core/logging/Logger")
      if (typeof OverviewPageController === 'undefined') {
const Logger = require("src/core/logging/Logger")
        throw new StandardError('OVERVIEW_CONTROLLER_UNAVAILABLE', 'OverviewPageController 類別不可用', {
const Logger = require("src/core/logging/Logger")
          category: 'initialization',
const Logger = require("src/core/logging/Logger")
          requiredClass: 'OverviewPageController',
const Logger = require("src/core/logging/Logger")
          context: 'chrome_extension'
const Logger = require("src/core/logging/Logger")
        })
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      // 創建控制器實例
const Logger = require("src/core/logging/Logger")
      overviewController = new OverviewPageController(eventBus, document)

const Logger = require("src/core/logging/Logger")
      // 控制器已在建構函式中完成初始化
const Logger = require("src/core/logging/Logger")
      if (eventBus && overviewController) {
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      // 觸發頁面就緒事件
const Logger = require("src/core/logging/Logger")
      if (eventBus) {
const Logger = require("src/core/logging/Logger")
        await eventBus.emit('OVERVIEW.PAGE.READY', {
const Logger = require("src/core/logging/Logger")
          timestamp: Date.now(),
const Logger = require("src/core/logging/Logger")
          controller: !!overviewController
const Logger = require("src/core/logging/Logger")
        })
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      return overviewController
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.error('❌ Overview 控制器初始化失敗:', error)
const Logger = require("src/core/logging/Logger")
      showInitializationError(error)
const Logger = require("src/core/logging/Logger")
      throw error
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 顯示初始化錯誤訊息
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Error} error - 初始化錯誤
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  function showInitializationError (error) {
const Logger = require("src/core/logging/Logger")
    const errorContainer = document.getElementById('errorContainer')
const Logger = require("src/core/logging/Logger")
    const errorMessage = document.getElementById('errorMessage')

const Logger = require("src/core/logging/Logger")
    if (errorContainer && errorMessage) {
const Logger = require("src/core/logging/Logger")
      errorMessage.textContent = `頁面初始化失敗: ${error.message}`
const Logger = require("src/core/logging/Logger")
      errorContainer.style.display = 'block'

const Logger = require("src/core/logging/Logger")
      // 設定重試按鈕
const Logger = require("src/core/logging/Logger")
      const retryBtn = document.getElementById('retryBtn')
const Logger = require("src/core/logging/Logger")
      if (retryBtn) {
const Logger = require("src/core/logging/Logger")
        retryBtn.onclick = () => {
const Logger = require("src/core/logging/Logger")
          errorContainer.style.display = 'none'
const Logger = require("src/core/logging/Logger")
          initializeOverviewPage()
const Logger = require("src/core/logging/Logger")
        }
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    } else {
const Logger = require("src/core/logging/Logger")
      // 降級處理：使用 alert
const Logger = require("src/core/logging/Logger")
      alert(`Overview 頁面初始化失敗: ${error.message}`)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 完整的 Overview 頁面初始化流程
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async function initializeOverviewPage () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      // 顯示載入狀態
const Logger = require("src/core/logging/Logger")
      const loadingIndicator = document.getElementById('loadingIndicator')
const Logger = require("src/core/logging/Logger")
      if (loadingIndicator) {
const Logger = require("src/core/logging/Logger")
        loadingIndicator.style.display = 'block'
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      // Step 1: 初始化事件系統
const Logger = require("src/core/logging/Logger")
      const { eventBus: eBus, chromeBridge: cBridge } = await initializeEventSystem()
const Logger = require("src/core/logging/Logger")
      eventBus = eBus
const Logger = require("src/core/logging/Logger")
      chromeBridge = cBridge

const Logger = require("src/core/logging/Logger")
      // Step 2: 初始化控制器
const Logger = require("src/core/logging/Logger")
      await initializeOverviewController()

const Logger = require("src/core/logging/Logger")
      // Step 3: 嘗試載入儲存的資料
const Logger = require("src/core/logging/Logger")
      if (overviewController && typeof overviewController.loadBooksFromChromeStorage === 'function') {
const Logger = require("src/core/logging/Logger")
        // 使用控制器的 Chrome Storage 載入方法
const Logger = require("src/core/logging/Logger")
        await overviewController.loadBooksFromChromeStorage()
const Logger = require("src/core/logging/Logger")
      } else if (eventBus) {
const Logger = require("src/core/logging/Logger")
        // 降級方案：使用事件系統
const Logger = require("src/core/logging/Logger")
        await eventBus.emit('STORAGE.LOAD.REQUESTED', {
const Logger = require("src/core/logging/Logger")
          source: 'readmoo',
const Logger = require("src/core/logging/Logger")
          loadType: 'all'
const Logger = require("src/core/logging/Logger")
        })
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      // 隱藏載入狀態
const Logger = require("src/core/logging/Logger")
      if (loadingIndicator) {
const Logger = require("src/core/logging/Logger")
        loadingIndicator.style.display = 'none'
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.error('❌ Overview 頁面初始化失敗:', error)

const Logger = require("src/core/logging/Logger")
      // 隱藏載入狀態
const Logger = require("src/core/logging/Logger")
      const loadingIndicator = document.getElementById('loadingIndicator')
const Logger = require("src/core/logging/Logger")
      if (loadingIndicator) {
const Logger = require("src/core/logging/Logger")
        loadingIndicator.style.display = 'none'
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      // 顯示錯誤訊息
const Logger = require("src/core/logging/Logger")
      showInitializationError(error)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 頁面載入完成後自動初始化
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  if (document.readyState === 'loading') {
const Logger = require("src/core/logging/Logger")
    document.addEventListener('DOMContentLoaded', initializeOverviewPage)
const Logger = require("src/core/logging/Logger")
  } else {
const Logger = require("src/core/logging/Logger")
    // DOM 已經載入完成，立即初始化
const Logger = require("src/core/logging/Logger")
    initializeOverviewPage()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  // 將關鍵函數暴露給全域範圍（用於除錯和擴展）
const Logger = require("src/core/logging/Logger")
  window.overviewPage = {
const Logger = require("src/core/logging/Logger")
    eventBus: () => eventBus,
const Logger = require("src/core/logging/Logger")
    chromeBridge: () => chromeBridge,
const Logger = require("src/core/logging/Logger")
    controller: () => overviewController,
const Logger = require("src/core/logging/Logger")
    reinitialize: initializeOverviewPage
const Logger = require("src/core/logging/Logger")
  }
const Logger = require("src/core/logging/Logger")
})()
