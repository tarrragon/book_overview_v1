const { Logger } = require('src/core/logging/Logger')
/**
 * content-modular.js
 *
 * Readmoo 書庫數據提取器 - 模組化版本
 *
 * 負責功能：
 * - 整合各模組化組件（EventBus, ChromeEventBridge, BookDataExtractor, ReadmooAdapter）
 * - 提供統一的初始化和生命週期管理
 * - 處理 Background Service Worker 通訊
 * - 管理 URL 變更和頁面狀態
 *
 * 設計考量：
 * - 模組化架構，單一職責原則
 * - 事件驅動設計，鬆耦合模組間通訊
 * - 錯誤隔離，模組失敗不影響整體系統
 * - 資源清理，避免記憶體洩漏
 *
 * 架構組件：
 * - PageDetector: 頁面檢測和類型識別
 * - ContentEventBus: 內部事件管理
 * - ChromeEventBridge: 跨上下文通訊橋接
 * - BookDataExtractor: 提取流程管理
 * - ReadmooAdapter: DOM 操作和資料解析
 *
 * @version 1.0.0
 * @author Readmoo Extension Team
 */

// 引入模組化組件
const createPageDetector = require('./detectors/page-detector')
const createContentEventBus = require('./core/content-event-bus')
const createChromeEventBridge = require('./bridge/chrome-event-bridge')
const createBookDataExtractor = require('./extractors/book-data-extractor')
const createReadmooAdapter = require('./adapters/readmoo-adapter')

// ====================
// 全域狀態管理
// ====================

let contentScriptReady = false
let pageDetector = null
let contentEventBus = null
let contentChromeBridge = null
let bookDataExtractor = null
let readmooAdapter = null
let urlChangeStopFunction = null

// 效能監控
const performanceStats = {
  initializationTime: 0,
  eventProcessingTime: 0,
  extractionTime: 0
}

// ====================
// 初始化和核心功能
// ====================

/**
 * 初始化 Content Script
 */
async function initializeContentScript () {
  const initStart = performance.now()

  try {
    // 第一步：頁面檢測
    pageDetector = createPageDetector()
    const pageStatus = pageDetector.getPageStatus()

    if (!pageStatus.isReadmooPage) {
      Logger.info('非 Readmoo 頁面，跳過初始化')
      return
    }

    Logger.info(`Readmoo 頁面檢測成功: ${pageStatus.pageType}`)

    // 第二步：建立事件系統
    contentEventBus = createContentEventBus()
    contentChromeBridge = createChromeEventBridge()

    // 第三步：設定事件系統整合
    contentChromeBridge.eventBus = contentEventBus

    // 第四步：建立提取器組件
    readmooAdapter = createReadmooAdapter()
    bookDataExtractor = createBookDataExtractor()

    // 第五步：設定提取器整合
    bookDataExtractor.setEventBus(contentEventBus)
    bookDataExtractor.setReadmooAdapter(readmooAdapter)

    // 第六步：設定全域變數 (供測試使用)
    if (typeof global !== 'undefined') {
      global.pageDetector = pageDetector
      global.contentEventBus = contentEventBus
      global.contentChromeBridge = contentChromeBridge
      global.bookDataExtractor = bookDataExtractor
      global.readmooAdapter = readmooAdapter
      global.contentScriptReady = true
    }

    // 第七步：設定模組間協調
    setupModuleIntegration()

    // 第八步：設定生命週期管理
    setupLifecycleManagement()

    // 計算初始化時間
    performanceStats.initializationTime = performance.now() - initStart
    contentScriptReady = true

    Logger.info('初始化狀態', {
      pageType: pageStatus.pageType,
      initTime: performanceStats.initializationTime.toFixed(2) + 'ms',
      modules: {
        pageDetector: !!pageDetector,
        eventBus: !!contentEventBus,
        chromeBridge: !!contentChromeBridge,
        extractor: !!bookDataExtractor,
        adapter: !!readmooAdapter
      }
    })

    // 第九步：向 Background 報告就緒狀態
    await reportReadyStatus()
  } catch (error) {
    // eslint-disable-next-line no-console
    Logger.error('Content Script 初始化失敗', { error })

    // 清理已建立的組件
    cleanup()
    throw error
  }
}

/**
 * 設定模組間整合
 */
function setupModuleIntegration () {
  if (!contentEventBus || !contentChromeBridge) return

  // 將重要的內部事件轉發到 Background
  const forwardEvents = [
    'EXTRACTION.STARTED',
    'EXTRACTION.PROGRESS',
    'EXTRACTION.COMPLETED',
    'EXTRACTION.ERROR',
    'EXTRACTION.CANCELLED'
  ]

  forwardEvents.forEach(eventType => {
    contentEventBus.on(eventType, async (event) => {
      try {
        await contentChromeBridge.forwardEventToBackground(eventType, event.data)
      } catch (error) {
        // eslint-disable-next-line no-console
        Logger.error(`轉發事件失敗 (${eventType})`, { error })
      }
    })
  })

  Logger.info('模組間整合設定完成')
}

/**
 * 設定生命週期管理
 */
function setupLifecycleManagement () {
  // URL 變更監聽 (SPA 導航)
  if (pageDetector) {
    urlChangeStopFunction = pageDetector.onUrlChange(async (changeInfo) => {
      if (changeInfo.changed) {
        // 延遲重新檢查頁面狀態，等待 DOM 更新
        setTimeout(async () => {
          await reportReadyStatus()
        }, 1000)
      }
    })
  }

  // 頁面卸載清理
  window.addEventListener('beforeunload', () => {
    cleanup()
  })
}

/**
 * 報告就緒狀態
 */
async function reportReadyStatus () {
  if (!contentChromeBridge || !pageDetector) return

  try {
    const pageStatus = pageDetector.getPageStatus()
    let bookCount = 0

    // 檢查書籍數量（使用 waitForBookElements 等待 SPA 動態渲染完成）
    if (readmooAdapter && pageStatus.isReadmooPage) {
      const bookElements = await readmooAdapter.waitForBookElements({ timeoutMs: 3000 })
      bookCount = bookElements.length
    }

    const status = {
      type: 'CONTENT.STATUS.READY',
      data: {
        ...pageStatus,
        bookCount,
        extractable: pageDetector.isExtractablePage() && bookCount > 0,
        modules: {
          pageDetector: !!pageDetector,
          eventBus: !!contentEventBus,
          chromeBridge: !!contentChromeBridge,
          extractor: !!bookDataExtractor,
          adapter: !!readmooAdapter
        },
        ready: contentScriptReady,
        performance: performanceStats
      }
    }

    await contentChromeBridge.sendToBackground(status)
    Logger.info('就緒狀態已報告', { data: status.data })
  } catch (error) {
    // eslint-disable-next-line no-console
    Logger.error('報告就緒狀態失敗', { error })
  }
}

/**
 * 清理資源
 */
function cleanup () {
  try {
    // 取消提取流程
    if (bookDataExtractor) {
      const activeFlows = bookDataExtractor.getActiveExtractionFlows()
      activeFlows.forEach(flowId => {
        bookDataExtractor.cancelExtraction(flowId)
      })
    }

    // 停止 URL 變更監聽
    if (urlChangeStopFunction) {
      urlChangeStopFunction()
      urlChangeStopFunction = null
    }

    // 清理各模組
    if (pageDetector) {
      pageDetector.destroy()
      pageDetector = null
    }

    if (contentEventBus) {
      contentEventBus.destroy()
      contentEventBus = null
    }

    // 重置狀態
    contentScriptReady = false
  } catch (error) {
    // eslint-disable-next-line no-console
    Logger.error('清理資源時發生錯誤', { error })
  }
}

// ====================
// Chrome API 訊息處理
// ====================

/**
 * 來自 Background 的訊息處理
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  Logger.info('Content Script 收到訊息', { message })

  handleBackgroundMessage(message, sender, sendResponse)

  // 返回 true 表示會異步回應
  return true
})

/**
 * 處理 Background 訊息
 */
async function handleBackgroundMessage (message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'PAGE_READY': {
        const pageStatus = await getPageStatus()
        sendResponse({ success: true, ...pageStatus })
        break
      }

      case 'START_EXTRACTION':
      case 'BACKGROUND.COMMAND.START_EXTRACTION': {
        if (bookDataExtractor) {
          const flowId = await bookDataExtractor.startExtractionFlow(message.data || {})
          sendResponse({
            success: true,
            flowId,
            message: '提取流程已啟動'
          })
        } else {
          sendResponse({
            success: false,
            error: '提取器未初始化'
          })
        }
        break
      }

      case 'PING': {
        const healthStatus = getHealthStatus()
        sendResponse({
          success: true,
          message: 'Content Script 運作正常',
          ...healthStatus
        })
        break
      }

      default:
        // eslint-disable-next-line no-console
        Logger.warn('Content Script 收到未知訊息類型', { messageType: message.type })
        sendResponse({ success: false, error: '未知的訊息類型' })
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    Logger.error('處理 Background 訊息失敗', { error })
    sendResponse({ success: false, error: error.message })
  }
}

/**
 * 取得頁面狀態
 */
async function getPageStatus () {
  if (!pageDetector) {
    return {
      isReadmooPage: false,
      pageType: 'unknown',
      bookCount: 0,
      extractable: false,
      error: 'PageDetector 未初始化'
    }
  }

  const pageStatus = pageDetector.getPageStatus()
  let bookCount = 0

  if (readmooAdapter && pageStatus.isReadmooPage) {
    // getPageStatus 是同步回應場景，使用即時查詢不等待
    const bookElements = readmooAdapter.getBookElements()
    bookCount = bookElements.length
  }

  return {
    ...pageStatus,
    bookCount,
    extractable: pageDetector.isExtractablePage() && bookCount > 0
  }
}

/**
 * 取得系統健康狀態
 */
function getHealthStatus () {
  const pageStatus = pageDetector ? pageDetector.getPageStatus() : {}

  return {
    ...pageStatus,
    modules: {
      pageDetector: !!pageDetector,
      contentEventBus: !!contentEventBus,
      contentChromeBridge: !!contentChromeBridge,
      bookDataExtractor: !!bookDataExtractor,
      readmooAdapter: !!readmooAdapter
    },
    ready: contentScriptReady,
    performance: performanceStats
  }
}

// ====================
// 錯誤處理
// ====================

/**
 * 全域錯誤處理
 */
window.addEventListener('error', async (event) => {
  // eslint-disable-next-line no-console
  Logger.error('Content Script 全域錯誤', { error: event.error })

  if (contentChromeBridge) {
    try {
      await contentChromeBridge.sendToBackground({
        type: 'CONTENT.ERROR',
        data: {
          message: event.error.message,
          stack: event.error.stack,
          url: window.location.href,
          timestamp: Date.now()
        }
      })
    } catch (bridgeError) {
      // eslint-disable-next-line no-console
      Logger.error('發送錯誤報告失敗', { error: bridgeError })
    }
  }
})

/**
 * 未處理的 Promise 拒絕
 */
window.addEventListener('unhandledrejection', async (event) => {
  // eslint-disable-next-line no-console
  Logger.error('Content Script 未處理的 Promise 拒絕', { reason: event.reason })

  if (contentChromeBridge) {
    try {
      await contentChromeBridge.sendToBackground({
        type: 'CONTENT.PROMISE.REJECTION',
        data: {
          reason: event.reason?.message || event.reason,
          url: window.location.href,
          timestamp: Date.now()
        }
      })
    } catch (bridgeError) {
      // eslint-disable-next-line no-console
      Logger.error('發送 Promise 拒絕報告失敗', { error: bridgeError })
    }
  }
})

// ====================
// 初始化和啟動
// ====================

// 頁面載入完成後初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript)
} else {
  // 頁面已經載入完成
  initializeContentScript()
}
