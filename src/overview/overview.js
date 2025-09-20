/**
 * Overview 頁面初始化腳本
 * 基於事件驅動架構，整合 OverviewPageController 與事件系統
 *
 * 負責功能：
 * - 初始化 Overview 頁面的事件系統
 * - 創建和配置 OverviewPageController 實例
 * - 處理頁面載入和錯誤狀態
 * - 提供統一的錯誤處理機制
 *
 * 設計考量：
 * - 適配 Chrome Extension 環境
 * - 支援事件驅動的資料流管理
 * - 提供完整的初始化錯誤恢復機制
 * - 整合現有的事件處理器架構
 */

// 引入核心模組 - Logger 在此模組中用於錯誤記錄和除錯
const { Logger } = require('src/core/logging/Logger')

// 引入標準化錯誤處理 (瀏覽器環境)
if (typeof window !== 'undefined' && window.ErrorCodes) {
  // ErrorCodes 已在全域可用
} else if (typeof require !== 'undefined') {
  const { ErrorCodes } = require('src/core/errors/ErrorCodes')
  if (typeof window !== 'undefined') {
    window.ErrorCodes = ErrorCodes
  }
}

/* global EventBus, ChromeEventBridge, OverviewPageController, ErrorCodes */

(function () {
  'use strict'

  /**
   * 全域變數
   */
  let eventBus = null
  let chromeBridge = null
  let overviewController = null

  /**
   * 初始化事件系統
   *
   * 負責功能：
   * - 檢查並初始化 EventBus
   * - 檢查並初始化 ChromeEventBridge
   * - 設定事件系統的相互引用
   * - 提供降級處理機制
   *
   * 設計考量：
   * - 適應不同的載入環境（擴展頁面 vs 獨立頁面）
   * - 提供錯誤處理和初始化重試機制
   * - 確保事件系統的正確初始化順序
   */
  async function initializeEventSystem () {
    try {
      // 檢查 EventBus 是否可用
      if (typeof EventBus !== 'undefined') {
        eventBus = new EventBus()
      } else if (window.eventBus) {
        // 使用全域 EventBus 實例
        eventBus = window.eventBus
      } else {
        // eslint-disable-next-line no-console
        // eslint-disable-next-line no-console
        Logger.warn('⚠️ EventBus 不可用，使用簡化實現')
        eventBus = createFallbackEventBus()
      }

      // 檢查 ChromeEventBridge 是否可用
      if (typeof ChromeEventBridge !== 'undefined' && typeof chrome !== 'undefined') {
        chromeBridge = new ChromeEventBridge(eventBus)
      }

      return { eventBus, chromeBridge }
    } catch (error) {
      // eslint-disable-next-line no-console
      // eslint-disable-next-line no-console
      Logger.error('❌ 事件系統初始化失敗:', error)
      throw error
    }
  }

  /**
   * 創建降級版本的 EventBus
   * 用於非 Chrome Extension 環境或 EventBus 不可用時
   */
  function createFallbackEventBus () {
    const listeners = new Map()

    return {
      on (eventType, handler) {
        if (!listeners.has(eventType)) {
          listeners.set(eventType, [])
        }
        listeners.get(eventType).push(handler)
      },

      emit (eventType, data) {
        return new Promise((resolve) => {
          if (listeners.has(eventType)) {
            const eventHandlers = listeners.get(eventType)
            Promise.all(eventHandlers.map(handler => {
              try {
                return Promise.resolve(handler({ type: eventType, data }))
              } catch (error) {
                // eslint-disable-next-line no-console
                // eslint-disable-next-line no-console
                Logger.error(`事件處理錯誤 (${eventType}):`, error)
                return null
              }
            })).then(() => resolve())
          } else {
            resolve()
          }
        })
      },

      off (eventType, handler) {
        if (listeners.has(eventType)) {
          const handlers = listeners.get(eventType)
          const index = handlers.indexOf(handler)
          if (index !== -1) {
            handlers.splice(index, 1)
          }
        }
      }
    }
  }

  /**
   * 初始化 Overview 頁面控制器
   *
   * 負責功能：
   * - 創建 OverviewPageController 實例
   * - 配置事件系統整合
   * - 註冊必要的事件監聽器
   * - 處理控制器初始化錯誤
   */
  async function initializeOverviewController () {
    try {
      // 檢查 OverviewPageController 是否可用
      if (typeof OverviewPageController === 'undefined') {
        const error = new Error('OverviewPageController 類別不可用')
        error.code = (typeof window !== 'undefined' && window.ErrorCodes) ? window.ErrorCodes.CONFIG_ERROR : 'CONFIG_ERROR'
        error.details = {
          category: 'initialization',
          requiredClass: 'OverviewPageController',
          context: 'chrome_extension'
        }
        throw error
      }

      // 創建控制器實例
      overviewController = new OverviewPageController(eventBus, document)

      // 控制器已在建構函式中完成初始化
      if (eventBus && overviewController) {
        // 控制器初始化成功，eventBus 和 controller 都已準備就緒
        // 繼續執行後續的頁面就緒事件觸發
        Logger.info('Controller and EventBus ready')
      }

      // 觸發頁面就緒事件
      if (eventBus) {
        await eventBus.emit('OVERVIEW.PAGE.READY', {
          timestamp: Date.now(),
          controller: !!overviewController
        })
      }

      return overviewController
    } catch (error) {
      // eslint-disable-next-line no-console
      // eslint-disable-next-line no-console
      Logger.error('❌ Overview 控制器初始化失敗:', error)
      showInitializationError(error)
      throw error
    }
  }

  /**
   * 顯示初始化錯誤訊息
   *
   * @param {Error} error - 初始化錯誤
   */
  function showInitializationError (error) {
    const errorContainer = document.getElementById('errorContainer')
    const errorMessage = document.getElementById('errorMessage')

    if (errorContainer && errorMessage) {
      errorMessage.textContent = `頁面初始化失敗: ${error.message}`
      errorContainer.style.display = 'block'

      // 設定重試按鈕
      const retryBtn = document.getElementById('retryBtn')
      if (retryBtn) {
        retryBtn.onclick = () => {
          errorContainer.style.display = 'none'
          initializeOverviewPage()
        }
      }
    } else {
      // 降級處理：使用 alert
      alert(`Overview 頁面初始化失敗: ${error.message}`)
    }
  }

  /**
   * 完整的 Overview 頁面初始化流程
   */
  async function initializeOverviewPage () {
    try {
      // 顯示載入狀態
      const loadingIndicator = document.getElementById('loadingIndicator')
      if (loadingIndicator) {
        loadingIndicator.style.display = 'block'
      }

      // Step 1: 初始化事件系統
      const { eventBus: eBus, chromeBridge: cBridge } = await initializeEventSystem()
      eventBus = eBus
      chromeBridge = cBridge

      // Step 2: 初始化控制器
      await initializeOverviewController()

      // Step 3: 嘗試載入儲存的資料
      if (overviewController && typeof overviewController.loadBooksFromChromeStorage === 'function') {
        // 使用控制器的 Chrome Storage 載入方法
        await overviewController.loadBooksFromChromeStorage()
      } else if (eventBus) {
        // 降級方案：使用事件系統
        await eventBus.emit('STORAGE.LOAD.REQUESTED', {
          source: 'readmoo',
          loadType: 'all'
        })
      }

      // 隱藏載入狀態
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none'
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      // eslint-disable-next-line no-console
      Logger.error('❌ Overview 頁面初始化失敗:', error)

      // 隱藏載入狀態
      const loadingIndicator = document.getElementById('loadingIndicator')
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none'
      }

      // 顯示錯誤訊息
      showInitializationError(error)
    }
  }

  /**
   * 頁面載入完成後自動初始化
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeOverviewPage)
  } else {
    // DOM 已經載入完成，立即初始化
    initializeOverviewPage()
  }

  // 將關鍵函數暴露給全域範圍（用於除錯和擴展）
  window.overviewPage = {
    eventBus: () => eventBus,
    chromeBridge: () => chromeBridge,
    controller: () => overviewController,
    reinitialize: initializeOverviewPage
  }
})()
