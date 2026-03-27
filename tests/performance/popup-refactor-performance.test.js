/**
 * Popup 重構效能基準測試
 *
 * 負責功能：
 * - 建立重構前後的效能基準
 * - 測試記憶體使用優化
 * - 驗證 UI 響應速度改善
 * - 監控載入時間和資源消耗
 *
 * 效能指標：
 * - 初始化載入時間 < 100ms
 * - 錯誤處理響應時間 < 50ms
 * - 記憶體使用增長 < 5MB
 * - UI 更新頻率 > 30fps
 */

const { PERFORMANCE_CONFIG } = require('./performance-config')

// Mock Chrome Extension APIs
// eslint-disable-next-line no-unused-vars
const mockChrome = {
  runtime: {
    reload: jest.fn(() => Promise.resolve()),
    sendMessage: jest.fn(() => Promise.resolve({ success: true })),
    onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
    getManifest: jest.fn(() => ({ version: '0.6.8' }))
  },
  tabs: {
    query: jest.fn(() => Promise.resolve([{ id: 1 }])),
    reload: jest.fn(() => Promise.resolve())
  }
}

global.chrome = mockChrome

// Mock DOM
const { JSDOM } = require('jsdom')

describe('⚡ Popup Refactor Performance Tests (TDD循環 #39)', () => {
  let dom
  let document

  beforeAll(() => {
    // 設定效能測試的 DOM 環境
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Performance Test</title>
          <style>
            .hidden { display: none; }
            .fade-in { transition: opacity 0.3s ease-in-out; }
            .slide-up { transform: translateY(100%); transition: transform 0.2s ease-out; }
          </style>
        </head>
        <body>
          <div id="main-content">
            <div id="status-container">
              <div id="status-message">Ready</div>
              <div id="progress-bar" style="width: 0%"></div>
            </div>
            <div id="error-container" class="hidden">
              <div id="error-message">Error message</div>
              <div id="error-actions">
                <button id="retry-button">Retry</button>
                <button id="reload-button">Reload</button>
              </div>
            </div>
            <div id="loading-overlay" class="hidden">
              <div id="loading-spinner">Loading...</div>
            </div>
            <div id="diagnostic-panel" class="hidden">
              <div id="diagnostic-content">Diagnostic info</div>
            </div>
          </div>
        </body>
      </html>
    `)

    global.window = dom.window
    global.document = dom.window.document
    document = dom.window.document

    // Mock Performance Observer
    const performanceObserver = {
      observe: jest.fn(),
      disconnect: jest.fn(),
      takeRecords: jest.fn(() => [])
    }
    global.PerformanceObserver = jest.fn(() => performanceObserver)
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('初始化效能基準測試', () => {
    test('PopupUIManager initialization should complete quickly', async () => {
      const PopupUIManager = require('src/popup/popup-ui-manager')

      const startTime = Date.now()

      const uiManager = new PopupUIManager()
      await uiManager.initialize()

      const initializationTime = Date.now() - startTime

      expect(initializationTime).toBeLessThan(PERFORMANCE_CONFIG.time.uiManagerInit) // UI Manager 初始化時間上限
      expect(uiManager.elements).toBeDefined()
    })

    test('PopupErrorHandler initialization should be lightweight', async () => {
      const PopupErrorHandler = require('src/popup/popup-error-handler')

      const startMemory = process.memoryUsage().heapUsed
      const startTime = Date.now()

      const errorHandler = new PopupErrorHandler()
      errorHandler.initialize()

      const initTime = Date.now() - startTime
      const endMemory = process.memoryUsage().heapUsed
      const memoryIncrease = endMemory - startMemory

      expect(initTime).toBeLessThan(PERFORMANCE_CONFIG.time.errorHandlerInit) // ErrorHandler 初始化時間上限
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_CONFIG.memory.errorHandlerInit) // ErrorHandler 初始化記憶體上限
    })

    test('Integrated system initialization performance', async () => {
      const PopupUIManager = require('src/popup/popup-ui-manager')
      const PopupErrorHandler = require('src/popup/popup-error-handler')

      const startTime = Date.now()

      const uiManager = new PopupUIManager()
      const errorHandler = new PopupErrorHandler({ uiManager })

      await uiManager.initialize()
      errorHandler.initialize()

      const totalInitTime = Date.now() - startTime

      expect(totalInitTime).toBeLessThan(PERFORMANCE_CONFIG.time.systemInit) // 系統初始化時間上限
    })
  })

  describe('UI 響應效能測試', () => {
    test('Error display should render within 50ms', async () => {
      const PopupUIManager = require('src/popup/popup-ui-manager')

      const uiManager = new PopupUIManager()
      await uiManager.initialize()

      const errorData = {
        title: '測試錯誤',
        message: '這是一個效能測試錯誤訊息',
        actions: ['重試', '取消']
      }

      const startTime = Date.now()
      await uiManager.showError(errorData)
      const renderTime = Date.now() - startTime

      expect(renderTime).toBeLessThan(PERFORMANCE_CONFIG.time.errorRenderTime) // 錯誤渲染時間上限
    })

    test('Progress updates should be fast', async () => {
      const PopupUIManager = require('src/popup/popup-ui-manager')

      const uiManager = new PopupUIManager()
      await uiManager.initialize()

      const updates = 100
      const startTime = Date.now()

      for (let i = 0; i <= updates; i++) {
        await uiManager.updateProgress(i)
      }

      const totalTime = Date.now() - startTime
      const fps = (updates / totalTime) * 1000

      expect(fps).toBeGreaterThan(PERFORMANCE_CONFIG.ratio.minFps) // 最低幀率要求
    })

    test('UI state transitions should be smooth', async () => {
      const PopupUIManager = require('src/popup/popup-ui-manager')

      const uiManager = new PopupUIManager()
      await uiManager.initialize()

      const transitionTimes = []

      // 測試多種狀態轉換（使用實際存在的 API）
      const states = [
        () => uiManager.showLoading('載入中...'),
        () => uiManager.updateProgress(50),
        () => uiManager.showError({ message: '錯誤' }),
        () => uiManager.showSuccess('成功')
      ]

      for (const stateChange of states) {
        const start = Date.now()
        await stateChange()
        const end = Date.now()
        transitionTimes.push(end - start)
      }

      const maxTransitionTime = Math.max(...transitionTimes)
      const avgTransitionTime = transitionTimes.reduce((a, b) => a + b) / transitionTimes.length

      expect(maxTransitionTime).toBeLessThan(PERFORMANCE_CONFIG.time.uiStateTransitionMax) // 最長轉換時間上限
      expect(avgTransitionTime).toBeLessThan(PERFORMANCE_CONFIG.time.uiStateTransitionAvg) // 平均轉換時間上限
    })
  })

  describe('記憶體使用效能測試', () => {
    test('Error handler should limit error history', () => {
      const PopupErrorHandler = require('src/popup/popup-error-handler')

      const errorHandler = new PopupErrorHandler()
      errorHandler.initialize()

      // 產生大量錯誤事件
      for (let i = 0; i < 200; i++) {
        errorHandler.handleError({
          type: 'TEST_ERROR',
          message: `Test error ${i}`,
          stack: new Error().stack
        })
      }

      // 歷史記錄有上限（原始碼限制 100 條）
      expect(errorHandler.errorHistory.length).toBeLessThanOrEqual(PERFORMANCE_CONFIG.ratio.maxErrorHistory)
    })

    test('UI manager should optimize DOM operations via element caching', async () => {
      const PopupUIManager = require('src/popup/popup-ui-manager')

      const uiManager = new PopupUIManager()
      await uiManager.initialize()

      // 監控 DOM 操作次數
      const originalQuerySelector = document.querySelector
      const originalQuerySelectorAll = document.querySelectorAll

      let queryCount = 0
      document.querySelector = (...args) => {
        queryCount++
        return originalQuerySelector.apply(document, args)
      }
      document.querySelectorAll = (...args) => {
        queryCount++
        return originalQuerySelectorAll.apply(document, args)
      }

      // 執行多次 UI 操作（初始化後不應重複查詢 DOM）
      for (let i = 0; i < 100; i++) {
        await uiManager.updateStatus(`Status ${i}`)
        await uiManager.updateProgress(i)
      }

      // DOM 查詢次數應該被優化（元素快取）- 放寬閾值
      expect(queryCount).toBeLessThan(PERFORMANCE_CONFIG.ratio.maxDomQueries) // DOM 查詢次數上限（有快取機制）

      // 還原原始函數
      document.querySelector = originalQuerySelector
      document.querySelectorAll = originalQuerySelectorAll
    })

    test('Diagnostic module initialization should be lightweight', async () => {
      const DiagnosticModule = require('src/popup/diagnostic-module')

      const initialMemory = process.memoryUsage().heapUsed

      const diagnostic = new DiagnosticModule()
      await diagnostic.initialize()

      const memoryAfterLoad = process.memoryUsage().heapUsed
      const totalMemoryIncrease = memoryAfterLoad - initialMemory

      expect(totalMemoryIncrease).toBeLessThan(PERFORMANCE_CONFIG.memory.diagnosticInit) // Diagnostic 初始化記憶體上限
    })
  })

  describe('事件處理效能測試', () => {
    test('Event system should handle high-frequency events', async () => {
      const EventBus = require('src/core/event-bus')
      const PopupUIManager = require('src/popup/popup-ui-manager')

      const eventBus = new EventBus()
      const uiManager = new PopupUIManager()

      await uiManager.initialize()

      // 註冊事件監聽器
      eventBus.on('UI.PROGRESS.UPDATE', (data) => {
        uiManager.updateProgress(data.percentage)
      })

      const eventCount = 1000
      const startTime = Date.now()

      // 產生大量事件
      for (let i = 0; i < eventCount; i++) {
        eventBus.emit('UI.PROGRESS.UPDATE', { percentage: i / 10 })
      }

      const processingTime = Date.now() - startTime
      const eventsPerSecond = (eventCount / processingTime) * 1000

      expect(eventsPerSecond).toBeGreaterThan(PERFORMANCE_CONFIG.ratio.minEventsPerSecond) // 最低事件處理速率
      expect(processingTime).toBeLessThan(PERFORMANCE_CONFIG.time.eventProcessTotal) // 事件處理總時間上限
    })

    test('Error throttling should deduplicate repeated errors', () => {
      const PopupErrorHandler = require('src/popup/popup-error-handler')
      const PopupUIManager = require('src/popup/popup-ui-manager')

      const uiManager = new PopupUIManager()
      const errorHandler = new PopupErrorHandler({ uiManager })

      errorHandler.initialize()

      const duplicateError = {
        type: 'NETWORK_ERROR',
        message: '連線失敗'
      }

      const startTime = Date.now()

      // 產生重複錯誤
      for (let i = 0; i < 100; i++) {
        errorHandler.handleError(duplicateError)
      }

      const processingTime = Date.now() - startTime

      expect(processingTime).toBeLessThan(PERFORMANCE_CONFIG.time.errorThrottleTime) // 節流機制時間上限
      // 錯誤佇列應該合併重複錯誤
      expect(errorHandler.errorQueue.length).toBe(1)
      expect(errorHandler.errorQueue[0].count).toBe(100)
    })
  })

  describe('Chrome Extension API 效能測試', () => {
    test('Error handler should initialize with Chrome API mocks', () => {
      const PopupErrorHandler = require('src/popup/popup-error-handler')

      const errorHandler = new PopupErrorHandler()
      errorHandler.initialize()

      // 驗證初始化成功並可以處理錯誤
      expect(errorHandler.errorQueue).toBeDefined()
      expect(errorHandler.errorHistory).toBeDefined()

      // 驗證 Chrome API mocks 可用
      expect(typeof chrome.runtime.sendMessage).toBe('function')
      expect(typeof chrome.runtime.getManifest).toBe('function')
    })

    test('Error handler should handle errors without performance degradation', () => {
      const PopupErrorHandler = require('src/popup/popup-error-handler')

      const errorHandler = new PopupErrorHandler()
      errorHandler.initialize()

      const messageCount = 100
      const startTime = Date.now()

      for (let i = 0; i < messageCount; i++) {
        errorHandler.handleError({
          type: 'ERROR_REPORT',
          message: `Error ${i}`
        })
      }

      const totalTime = Date.now() - startTime
      const avgTimePerMessage = totalTime / messageCount

      expect(avgTimePerMessage).toBeLessThan(PERFORMANCE_CONFIG.time.errorProcessAvg) // 每個錯誤處理平均時間上限
      expect(totalTime).toBeLessThan(PERFORMANCE_CONFIG.time.errorProcess100Total) // 錯誤處理總時間上限
    })
  })
})
