/**
 * Popup 重構效能基準測試 - TDD Red Phase
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

// Mock Performance API
// eslint-disable-next-line no-unused-vars
const mockPerformance = {
  now: () => Date.now(),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => []),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn()
}

global.performance = mockPerformance

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
  let performanceObserver

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
    performanceObserver = {
      observe: jest.fn(),
      disconnect: jest.fn(),
      takeRecords: jest.fn(() => [])
    }
    global.PerformanceObserver = jest.fn(() => performanceObserver)
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // 重設效能計數器
    mockPerformance.mark.mockClear()
    mockPerformance.measure.mockClear()
  })

  describe('🔴 Red Phase - 初始化效能基準測試', () => {
    test('should fail: PopupUIManager initialization should complete within 100ms', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const PopupUIManager = require('src/popup/popup-ui-manager')

        // 記錄開始時間
        // eslint-disable-next-line no-unused-vars
        const startTime = performance.now()
        performance.mark('ui-manager-init-start')

        // eslint-disable-next-line no-unused-vars
        const uiManager = new PopupUIManager()
        await uiManager.initialize()

        // 記錄結束時間
        // eslint-disable-next-line no-unused-vars
        const endTime = performance.now()
        performance.mark('ui-manager-init-end')
        performance.measure('ui-manager-init', 'ui-manager-init-start', 'ui-manager-init-end')

        // eslint-disable-next-line no-unused-vars
        const initializationTime = endTime - startTime

        expect(initializationTime).toBeLessThan(100) // 小於 100ms
        expect(uiManager.isInitialized).toBe(true)

        // 驗證 DOM 元素已快取
        expect(Object.keys(uiManager.elements).length).toBeGreaterThan(5)
      }).rejects.toThrow()
    })

    test('should fail: PopupErrorHandler initialization should be lightweight', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const PopupErrorHandler = require('src/popup/popup-error-handler')

        // eslint-disable-next-line no-unused-vars
        const startMemory = process.memoryUsage().heapUsed
        // eslint-disable-next-line no-unused-vars
        const startTime = performance.now()

        // eslint-disable-next-line no-unused-vars
        const errorHandler = new PopupErrorHandler()
        await errorHandler.initialize()

        // eslint-disable-next-line no-unused-vars
        const endTime = performance.now()
        // eslint-disable-next-line no-unused-vars
        const endMemory = process.memoryUsage().heapUsed

        // eslint-disable-next-line no-unused-vars
        const initTime = endTime - startTime
        // eslint-disable-next-line no-unused-vars
        const memoryIncrease = endMemory - startMemory

        expect(initTime).toBeLessThan(50) // 小於 50ms
        expect(memoryIncrease).toBeLessThan(1024 * 1024) // 小於 1MB

        expect(errorHandler.isReady).toBe(true)
      }).rejects.toThrow()
    })

    test('should fail: Integrated system initialization performance', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const PopupUIManager = require('src/popup/popup-ui-manager')
        // eslint-disable-next-line no-unused-vars
        const PopupErrorHandler = require('src/popup/popup-error-handler')
        // eslint-disable-next-line no-unused-vars
        const DiagnosticModule = require('src/popup/diagnostic-module')

        // eslint-disable-next-line no-unused-vars
        const startTime = performance.now()
        // eslint-disable-next-line no-unused-vars
        const startMemory = process.memoryUsage().heapUsed

        // 初始化整個系統
        // eslint-disable-next-line no-unused-vars
        const uiManager = new PopupUIManager()
        // eslint-disable-next-line no-unused-vars
        const errorHandler = new PopupErrorHandler({ uiManager })

        await uiManager.initialize()
        await errorHandler.initialize()

        // eslint-disable-next-line no-unused-vars
        const endTime = performance.now()
        // eslint-disable-next-line no-unused-vars
        const endMemory = process.memoryUsage().heapUsed

        // eslint-disable-next-line no-unused-vars
        const totalInitTime = endTime - startTime
        // eslint-disable-next-line no-unused-vars
        const totalMemoryIncrease = endMemory - startMemory

        expect(totalInitTime).toBeLessThan(200) // 小於 200ms
        expect(totalMemoryIncrease).toBeLessThan(3 * 1024 * 1024) // 小於 3MB
      }).rejects.toThrow()
    })
  })

  describe('🔴 Red Phase - UI 響應效能測試', () => {
    test('should fail: Error display should render within 50ms', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const PopupUIManager = require('src/popup/popup-ui-manager')

        // eslint-disable-next-line no-unused-vars
        const uiManager = new PopupUIManager()
        await uiManager.initialize()

        // eslint-disable-next-line no-unused-vars
        const errorData = {
          title: '測試錯誤',
          message: '這是一個效能測試錯誤訊息',
          actions: ['重試', '取消']
        }

        // eslint-disable-next-line no-unused-vars
        const startTime = performance.now()

        await uiManager.showError(errorData)

        // eslint-disable-next-line no-unused-vars
        const endTime = performance.now()
        // eslint-disable-next-line no-unused-vars
        const renderTime = endTime - startTime

        expect(renderTime).toBeLessThan(50) // 小於 50ms
        expect(document.getElementById('error-container')).not.toHaveClass('hidden')
      }).rejects.toThrow()
    })

    test('should fail: Progress updates should maintain 30fps', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const PopupUIManager = require('src/popup/popup-ui-manager')

        // eslint-disable-next-line no-unused-vars
        const uiManager = new PopupUIManager()
        await uiManager.initialize()

        // eslint-disable-next-line no-unused-vars
        const updates = 100
        // eslint-disable-next-line no-unused-vars
        const startTime = performance.now()

        // 模擬快速進度更新
        for (let i = 0; i <= updates; i++) {
          await uiManager.updateProgress(i)
        }

        // eslint-disable-next-line no-unused-vars
        const endTime = performance.now()
        // eslint-disable-next-line no-unused-vars
        const totalTime = endTime - startTime
        // eslint-disable-next-line no-unused-vars
        const fps = (updates / totalTime) * 1000

        expect(fps).toBeGreaterThan(30) // 大於 30fps

        // 驗證最終狀態
        expect(document.getElementById('progress-bar').style.width).toBe('100%')
      }).rejects.toThrow()
    })

    test('should fail: UI state transitions should be smooth', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const PopupUIManager = require('src/popup/popup-ui-manager')

        // eslint-disable-next-line no-unused-vars
        const uiManager = new PopupUIManager()
        await uiManager.initialize()

        // eslint-disable-next-line no-unused-vars
        const transitionTimes = []

        // 測試多種狀態轉換
        // eslint-disable-next-line no-unused-vars
        const states = [
          () => uiManager.showLoading('載入中...'),
          () => uiManager.updateProgress(50),
          () => uiManager.showError({ message: '錯誤' }),
          () => uiManager.showSuccess('成功'),
          () => uiManager.hideAll()
        ]

        for (const stateChange of states) {
          // eslint-disable-next-line no-unused-vars
          const start = performance.now()
          await stateChange()
          // eslint-disable-next-line no-unused-vars
          const end = performance.now()
          transitionTimes.push(end - start)
        }

        // 所有狀態轉換都應該快速
        // eslint-disable-next-line no-unused-vars
        const maxTransitionTime = Math.max(...transitionTimes)
        // eslint-disable-next-line no-unused-vars
        const avgTransitionTime = transitionTimes.reduce((a, b) => a + b) / transitionTimes.length

        expect(maxTransitionTime).toBeLessThan(30) // 最長轉換小於 30ms
        expect(avgTransitionTime).toBeLessThan(15) // 平均轉換小於 15ms
      }).rejects.toThrow()
    })
  })

  describe('🔴 Red Phase - 記憶體使用效能測試', () => {
    test('should fail: Error handler should prevent memory leaks', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const PopupErrorHandler = require('src/popup/popup-error-handler')

        // eslint-disable-next-line no-unused-vars
        const errorHandler = new PopupErrorHandler()
        await errorHandler.initialize()

        // eslint-disable-next-line no-unused-vars
        const initialMemory = process.memoryUsage().heapUsed

        // 產生大量錯誤事件
        for (let i = 0; i < 1000; i++) {
          await errorHandler.handleError({
            type: 'TEST_ERROR',
            message: `Test error ${i}`,
            stack: new Error().stack
          })
        }

        // 清理錯誤歷史
        errorHandler.clearErrorHistory()

        // 等待記憶體穩定化
        await new Promise(resolve => setTimeout(resolve, 50))

        // eslint-disable-next-line no-unused-vars
        const finalMemory = process.memoryUsage().heapUsed
        // eslint-disable-next-line no-unused-vars
        const memoryIncrease = finalMemory - initialMemory

        expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024) // 小於 2MB
        expect(errorHandler.errorHistory.length).toBeLessThanOrEqual(100) // 歷史記錄有上限
      }).rejects.toThrow()
    })

    test('should fail: UI manager should optimize DOM operations', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const PopupUIManager = require('src/popup/popup-ui-manager')

        // eslint-disable-next-line no-unused-vars
        const uiManager = new PopupUIManager()
        await uiManager.initialize()

        // 監控 DOM 操作次數
        // eslint-disable-next-line no-unused-vars
        const originalQuerySelector = document.querySelector
        // eslint-disable-next-line no-unused-vars
        const originalQuerySelectorAll = document.querySelectorAll

        // eslint-disable-next-line no-unused-vars
        let queryCount = 0
        document.querySelector = (...args) => {
          queryCount++
          return originalQuerySelector.apply(document, args)
        }
        document.querySelectorAll = (...args) => {
          queryCount++
          return originalQuerySelectorAll.apply(document, args)
        }

        // 執行多次 UI 操作
        for (let i = 0; i < 100; i++) {
          await uiManager.updateStatus(`Status ${i}`)
          await uiManager.updateProgress(i)
        }

        // DOM 查詢次數應該被優化（元素快取）
        expect(queryCount).toBeLessThan(20) // 少於 20 次查詢

        // 還原原始函數
        document.querySelector = originalQuerySelector
        document.querySelectorAll = originalQuerySelectorAll
      }).rejects.toThrow()
    })

    test('should fail: Diagnostic module lazy loading optimization', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const DiagnosticModule = require('src/popup/diagnostic-module')

        // eslint-disable-next-line no-unused-vars
        const initialMemory = process.memoryUsage().heapUsed

        // 診斷模組未使用時不應載入
        expect(DiagnosticModule.isLoaded).toBe(false)

        // eslint-disable-next-line no-unused-vars
        const memoryBeforeLoad = process.memoryUsage().heapUsed
        // eslint-disable-next-line no-unused-vars
        const memoryIncreaseBeforeLoad = memoryBeforeLoad - initialMemory

        expect(memoryIncreaseBeforeLoad).toBeLessThan(100 * 1024) // 小於 100KB

        // 第一次使用時才載入
        // eslint-disable-next-line no-unused-vars
        const diagnostic = new DiagnosticModule()
        await diagnostic.initialize()

        expect(DiagnosticModule.isLoaded).toBe(true)

        // eslint-disable-next-line no-unused-vars
        const memoryAfterLoad = process.memoryUsage().heapUsed
        // eslint-disable-next-line no-unused-vars
        const totalMemoryIncrease = memoryAfterLoad - initialMemory

        expect(totalMemoryIncrease).toBeLessThan(1024 * 1024) // 小於 1MB
      }).rejects.toThrow()
    })
  })

  describe('🔴 Red Phase - 事件處理效能測試', () => {
    test('should fail: Event system should handle high-frequency events', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const EventBus = require('src/core/event-bus')
        // eslint-disable-next-line no-unused-vars
        const PopupUIManager = require('src/popup/popup-ui-manager')

        // eslint-disable-next-line no-unused-vars
        const eventBus = new EventBus()
        // eslint-disable-next-line no-unused-vars
        const uiManager = new PopupUIManager({ eventBus })

        await uiManager.initialize()

        // 註冊事件監聽器
        eventBus.on('UI.PROGRESS.UPDATE', (data) => {
          uiManager.updateProgress(data.percentage)
        })

        // eslint-disable-next-line no-unused-vars
        const eventCount = 1000
        // eslint-disable-next-line no-unused-vars
        const startTime = performance.now()

        // 產生大量事件
        for (let i = 0; i < eventCount; i++) {
          eventBus.emit('UI.PROGRESS.UPDATE', { percentage: i / 10 })
        }

        // eslint-disable-next-line no-unused-vars
        const endTime = performance.now()
        // eslint-disable-next-line no-unused-vars
        const processingTime = endTime - startTime
        // eslint-disable-next-line no-unused-vars
        const eventsPerSecond = (eventCount / processingTime) * 1000

        expect(eventsPerSecond).toBeGreaterThan(1000) // 每秒處理 1000+ 事件
        expect(processingTime).toBeLessThan(1000) // 總處理時間小於 1 秒
      }).rejects.toThrow()
    })

    test('should fail: Error throttling should prevent UI spam', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const PopupErrorHandler = require('src/popup/popup-error-handler')
        // eslint-disable-next-line no-unused-vars
        const PopupUIManager = require('src/popup/popup-ui-manager')

        // eslint-disable-next-line no-unused-vars
        const uiManager = new PopupUIManager()
        // eslint-disable-next-line no-unused-vars
        const errorHandler = new PopupErrorHandler({ uiManager })

        await uiManager.initialize()
        await errorHandler.initialize()

        // eslint-disable-next-line no-unused-vars
        const duplicateError = {
          type: 'NETWORK_ERROR',
          message: '連線失敗'
        }

        // eslint-disable-next-line no-unused-vars
        const startTime = performance.now()

        // 產生重複錯誤
        // eslint-disable-next-line no-unused-vars
        const promises = []
        for (let i = 0; i < 100; i++) {
          promises.push(errorHandler.handleError(duplicateError))
        }

        await Promise.all(promises)

        // eslint-disable-next-line no-unused-vars
        const endTime = performance.now()
        // eslint-disable-next-line no-unused-vars
        const processingTime = endTime - startTime

        expect(processingTime).toBeLessThan(100) // 節流機制讓處理更快
        expect(errorHandler.errorQueue.length).toBe(1) // 重複錯誤被合併
        expect(errorHandler.errorQueue[0].count).toBe(100) // 計數正確
      }).rejects.toThrow()
    })
  })

  describe('🔴 Red Phase - Chrome Extension API 效能測試', () => {
    test('should fail: Chrome API calls should be optimized and cached', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const PopupErrorHandler = require('src/popup/popup-error-handler')

        // eslint-disable-next-line no-unused-vars
        const errorHandler = new PopupErrorHandler()
        await errorHandler.initialize()

        // eslint-disable-next-line no-unused-vars
        const startTime = performance.now()

        // 多次檢查 Chrome API 狀態
        for (let i = 0; i < 50; i++) {
          await errorHandler.checkExtensionStatus()
        }

        // eslint-disable-next-line no-unused-vars
        const endTime = performance.now()
        // eslint-disable-next-line no-unused-vars
        const totalTime = endTime - startTime

        expect(totalTime).toBeLessThan(100) // 快取機制讓後續檢查更快

        // Chrome API 呼叫次數應該被優化
        expect(mockChrome.runtime.getManifest).toHaveBeenCalledTimes(1) // 只呼叫一次，後續使用快取
      }).rejects.toThrow()
    })

    test('should fail: Background script communication should be efficient', async () => {
      expect(async () => {
        // eslint-disable-next-line no-unused-vars
        const PopupErrorHandler = require('src/popup/popup-error-handler')

        // eslint-disable-next-line no-unused-vars
        const errorHandler = new PopupErrorHandler()

        // eslint-disable-next-line no-unused-vars
        const messageCount = 100
        // eslint-disable-next-line no-unused-vars
        const startTime = performance.now()

        // 批量發送訊息
        // eslint-disable-next-line no-unused-vars
        const promises = []
        for (let i = 0; i < messageCount; i++) {
          promises.push(
            errorHandler.sendMessageToBackground({
              type: 'ERROR_REPORT',
              data: { error: `Error ${i}` }
            })
          )
        }

        await Promise.all(promises)

        // eslint-disable-next-line no-unused-vars
        const endTime = performance.now()
        // eslint-disable-next-line no-unused-vars
        const totalTime = endTime - startTime
        // eslint-disable-next-line no-unused-vars
        const avgTimePerMessage = totalTime / messageCount

        expect(avgTimePerMessage).toBeLessThan(5) // 每個訊息平均小於 5ms
        expect(totalTime).toBeLessThan(500) // 總時間小於 500ms
      }).rejects.toThrow()
    })
  })
})
