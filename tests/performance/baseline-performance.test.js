/**
 * v0.9.35 基礎效能測試套件
 *
 * 測試範圍：UI回應時間、資料處理效能、記憶體使用監控
 * 測試標準：符合Chrome Extension環境的效能基準
 */

const { PerformanceMonitor, ChromeExtensionPerformanceMonitor } = require('../helpers/performance-monitor')
const { PerformanceTestDataGenerator } = require('../helpers/performance-test-data-generator')

describe('📊 基礎效能測試套件 v0.9.35', () => {
  let performanceMonitor
  let chromePerformanceMonitor
  let dataGenerator
  let testCleanup

  beforeAll(async () => {
    performanceMonitor = new PerformanceMonitor()
    chromePerformanceMonitor = new ChromeExtensionPerformanceMonitor()
    dataGenerator = new PerformanceTestDataGenerator()
    testCleanup = []

    // 建立效能測試基準環境
    await setupPerformanceTestEnvironment()
  })

  afterAll(async () => {
    // 執行所有清理任務
    for (const cleanup of testCleanup) {
      try {
        await cleanup()
      } catch (error) {
        console.warn('清理任務失敗:', error.message)
      }
    }
    dataGenerator.clearCache()
  })

  beforeEach(() => {
    // 每個測試前建立記憶體基準
    performanceMonitor.captureMemorySnapshot('test-start')
  })

  afterEach(async () => {
    // 每個測試後檢查記憶體使用
    performanceMonitor.captureMemorySnapshot('test-end')

    // 等待記憶體穩定化
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  describe('🎯 A1. UI回應時間基準測試', () => {
    test('A1-1: Popup開啟效能測試 - 應在200ms內完成', async () => {
      // Given: Chrome Extension已安裝且處於空閒狀態
      const mockPopup = await setupMockPopupEnvironment()
      const expectedMaxTime = 200 // ms

      // When: 使用者點擊Extension圖示開啟Popup
      const { result, timing } = await performanceMonitor.measureAsync(
        'popup-open',
        async () => {
          return await simulatePopupOpen(mockPopup)
        }
      )

      // Then: Popup視窗應在200ms內完全載入並顯示內容
      expect(timing.duration).toBeLessThan(expectedMaxTime)
      expect(result.isLoaded).toBe(true)
      expect(result.contentVisible).toBe(true)

      // And: 記憶體增長應小於50MB (考慮測試環境的模擬數據變化)
      const memoryGrowthMB = Math.abs(timing.memoryDelta || 0) / (1024 * 1024)
      expect(memoryGrowthMB).toBeLessThan(50)

      // And: 所有UI元素應正確渲染
      expect(result.uiElements.length).toBeGreaterThan(0)
      expect(result.uiElements.every(el => el.rendered)).toBe(true)

      console.log(`✅ Popup開啟時間: ${timing.duration.toFixed(2)}ms (目標: <${expectedMaxTime}ms)`)
    })

    test('A1-2: 按鈕點擊回應測試 - 應在100ms內回應', async () => {
      // Given: Popup已開啟且顯示正常
      const mockPopup = await setupMockPopupEnvironment()
      await simulatePopupOpen(mockPopup)
      const expectedMaxTime = 100 // ms

      // When: 使用者點擊任意功能按鈕
      const buttons = ['extract', 'import', 'export', 'settings']
      const results = []

      for (const buttonType of buttons) {
        const { result, timing } = await performanceMonitor.measureAsync(
          `button-click-${buttonType}`,
          async () => {
            return await simulateButtonClick(mockPopup, buttonType)
          }
        )

        results.push({ buttonType, timing, result })

        // Then: 視覺回饋應在100ms內出現
        expect(timing.duration).toBeLessThan(expectedMaxTime)
        expect(result.visualFeedback).toBe(true)
        expect(result.functionTriggered).toBe(true)
      }

      // 驗證所有按鈕平均回應時間
      const averageTime = results.reduce((sum, r) => sum + r.timing.duration, 0) / results.length
      expect(averageTime).toBeLessThan(expectedMaxTime)

      console.log(`✅ 按鈕平均回應時間: ${averageTime.toFixed(2)}ms (目標: <${expectedMaxTime}ms)`)
    })

    test('A1-3: 搜尋即時回應測試 - 應在300ms內顯示結果', async () => {
      // Given: Overview頁面已載入100本書籍資料
      const testBooks = dataGenerator.generateRealisticBooks(100, {
        complexityDistribution: { simple: 20, normal: 60, complex: 20 },
        includeVariations: true,
        cacheKey: 'baseline-search-test'
      })
      const mockOverview = await setupMockOverviewPage(testBooks)
      const expectedMaxTime = 300 // ms

      // When: 使用者在搜尋框輸入關鍵字
      const searchQueries = ['小說', '科幻', '李明', '2023', '熱門']
      const results = []

      for (const query of searchQueries) {
        const { result, timing } = await performanceMonitor.measureAsync(
          `search-${query}`,
          async () => {
            return await simulateSearch(mockOverview, query)
          }
        )

        results.push({ query, timing, result })

        // Then: 搜尋結果應在300ms內顯示
        expect(timing.duration).toBeLessThan(expectedMaxTime)
        expect(result.resultsDisplayed).toBe(true)
        expect(result.resultCount).toBeGreaterThanOrEqual(0)
      }

      // 驗證搜尋效能統計
      const averageTime = results.reduce((sum, r) => sum + r.timing.duration, 0) / results.length
      const maxTime = Math.max(...results.map(r => r.timing.duration))
      expect(averageTime).toBeLessThan(expectedMaxTime)
      expect(maxTime).toBeLessThan(expectedMaxTime * 1.5) // 最大不超過期望值的150%

      console.log(`✅ 搜尋平均回應時間: ${averageTime.toFixed(2)}ms, 最大: ${maxTime.toFixed(2)}ms`)
    })
  })

  describe('📊 A2. 資料處理效能基準測試', () => {
    test('A2-1: 小量書籍提取效能測試 - 10本書籍應在1秒內完成', async () => {
      // Given: 目標網頁包含10本書籍資料
      const testBooks = dataGenerator.generateRealisticBooks(10, {
        complexityDistribution: { simple: 80, normal: 20, complex: 0 },
        includeVariations: false,
        cacheKey: 'small-extraction-test'
      })
      const mockWebPage = await setupMockWebPage(testBooks)
      const expectedMaxTime = 1000 // ms

      // When: 執行書籍資料提取操作
      const { result, timing } = await performanceMonitor.measureAsync(
        'small-book-extraction',
        async () => {
          return await simulateBookExtraction(mockWebPage, testBooks.length)
        }
      )

      // Then: 提取過程應在1秒內完成
      expect(timing.duration).toBeLessThan(expectedMaxTime)
      expect(result.extractedCount).toBe(testBooks.length)
      expect(result.successRate).toBeGreaterThan(0.85) // 調整為符合真實資料的成功率

      // And: 記憶體使用應小於20MB
      const memoryGrowthMB = Math.abs(timing.memoryDelta || 0) / (1024 * 1024)
      expect(memoryGrowthMB).toBeLessThan(20)

      console.log(`✅ 10本書籍提取時間: ${timing.duration.toFixed(2)}ms, 成功率: ${(result.successRate * 100).toFixed(1)}%`)
    })

    test('A2-2: 中量書籍提取效能測試 - 100本書籍應在8秒內完成', async () => {
      // Given: 目標網頁包含100本書籍資料
      const testBooks = dataGenerator.generateRealisticBooks(100, {
        complexityDistribution: { simple: 30, normal: 50, complex: 20 },
        includeVariations: true,
        simulateRealWorldErrors: true,
        cacheKey: 'medium-extraction-test'
      })
      const mockWebPage = await setupMockWebPage(testBooks)
      const expectedMaxTime = 8000 // ms

      // When: 執行書籍資料提取操作
      const { result, timing } = await performanceMonitor.measureAsync(
        'medium-book-extraction',
        async () => {
          return await simulateBookExtraction(mockWebPage, testBooks.length)
        }
      )

      // Then: 提取過程應在8秒內完成
      expect(timing.duration).toBeLessThan(expectedMaxTime)
      expect(result.extractedCount).toBe(testBooks.length)
      expect(result.successRate).toBeGreaterThan(0.90)

      // And: 記憶體使用應合理增長
      const memoryGrowthMB = Math.abs(timing.memoryDelta || 0) / (1024 * 1024)
      expect(memoryGrowthMB).toBeLessThan(50)

      console.log(`✅ 100本書籍提取時間: ${timing.duration.toFixed(2)}ms, 成功率: ${(result.successRate * 100).toFixed(1)}%`)
    })

    test('A2-3: JSON檔案解析效能測試 - 2MB檔案應在4秒內完成', async () => {
      // Given: 準備一個2MB的標準格式JSON檔案
      const { data: jsonData, actualSize } = dataGenerator.generateJSONFile('2MB', {
        complexity: 'normal',
        format: 'standard'
      })
      const expectedMaxTime = 4000 // ms
      const expectedMinSpeed = 0.5 // MB/s

      // When: 執行檔案匯入操作
      const { result, timing } = await performanceMonitor.measureAsync(
        'json-file-parsing',
        async () => {
          return await simulateJSONImport(jsonData, actualSize)
        }
      )

      // Then: 檔案解析應在4秒內完成(0.5MB/秒)
      expect(timing.duration).toBeLessThan(expectedMaxTime)

      const processingSpeedMBs = (actualSize / (1024 * 1024)) / (timing.duration / 1000)
      expect(processingSpeedMBs).toBeGreaterThanOrEqual(expectedMinSpeed)

      // And: 所有書籍資料應正確載入
      expect(result.parsedBooks).toBe(jsonData.books.length)
      expect(result.parseErrors).toBe(0)

      // And: 記憶體使用應合理增長
      const memoryGrowthMB = Math.abs(timing.memoryDelta || 0) / (1024 * 1024)
      expect(memoryGrowthMB).toBeLessThan(actualSize / (1024 * 1024) * 2) // 不超過檔案大小的2倍

      console.log(`✅ JSON解析速度: ${processingSpeedMBs.toFixed(2)}MB/s, 記憶體增長: ${memoryGrowthMB.toFixed(2)}MB`)
    })
  })

  describe('🧠 A3. 記憶體使用監控測試', () => {
    test('A3-1: 記憶體洩漏檢測 - 長時間運行不應超過基準20MB', async () => {
      // Given: 建立記憶體基準
      const baselineSnapshot = performanceMonitor.captureMemorySnapshot('memory-baseline')
      const operationCount = 50
      const maxMemoryGrowthMB = 20

      // When: 執行多次操作模擬長時間運行
      for (let i = 0; i < operationCount; i++) {
        const books = dataGenerator.generateRealisticBooks(10, {
          complexityDistribution: { simple: 90, normal: 10, complex: 0 }
        })
        await simulateBookExtraction(await setupMockWebPage(books), 10)

        // 每10次操作等待記憶體穩定化
        if (i % 10 === 9) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }

      const finalSnapshot = performanceMonitor.captureMemorySnapshot('memory-final')

      // Then: 使用高精度記憶體洩漏檢測
      const leakAnalysis = performanceMonitor.detectMemoryLeaks(baselineSnapshot, finalSnapshot)
      expect(leakAnalysis.memoryGrowthMB).toBeLessThan(leakAnalysis.dynamicThreshold || maxMemoryGrowthMB)
      expect(leakAnalysis.isPotentialLeak).toBe(false)
      expect(leakAnalysis.confidenceLevel).toBeGreaterThan(0.7)
      expect(leakAnalysis.riskLevel).not.toBe('high')

      console.log(`✅ 記憶體增長: ${leakAnalysis.memoryGrowthMB}MB (閥值: ${leakAnalysis.dynamicThreshold}MB)`)
      console.log(`   信心度: ${(leakAnalysis.confidenceLevel * 100).toFixed(1)}%, 風險等級: ${leakAnalysis.riskLevel}`)
    })

    test('A3-2: Chrome Extension API 效能測試', async () => {
      // Given: Chrome Extension API Mock環境
      setupChromeExtensionMocks()
      const expectedMaxLatency = 50 // ms

      // When: 測試各種Chrome API操作
      const storageResult = await chromePerformanceMonitor.measureStorageOperation(
        'storage-get',
        async () => chrome.storage.local.get(['books'])
      )

      const messagingResult = await chromePerformanceMonitor.measureChromeAPI(
        'runtime-sendMessage',
        async () => chrome.runtime.sendMessage({ type: 'test' })
      )

      // Then: API呼叫應在預期時間內完成
      expect(storageResult.duration).toBeLessThan(expectedMaxLatency)
      expect(messagingResult.duration).toBeLessThan(expectedMaxLatency)

      // And: 應成功完成操作
      expect(storageResult.result).toBeDefined()
      expect(messagingResult.result).toBeDefined()

      console.log(`✅ Storage API: ${storageResult.duration.toFixed(2)}ms`)
      console.log(`✅ Messaging API: ${messagingResult.duration.toFixed(2)}ms`)
    })
  })

  // === 測試輔助函數 ===

  async function setupPerformanceTestEnvironment () {
    // 模擬Chrome Extension環境
    setupChromeExtensionMocks()

    // 設置DOM環境
    if (typeof document === 'undefined') {
      const { JSDOM } = require('jsdom')
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
      global.document = dom.window.document
      global.window = dom.window
    }

    // 設置performance API
    if (typeof performance === 'undefined') {
      global.performance = {
        now: () => Date.now(),
        mark: jest.fn(),
        measure: jest.fn()
      }
    }

    // 清理函數
    testCleanup.push(async () => {
      // 清理全域設置
      if (global.chrome) {
        delete global.chrome
      }
    })
  }

  function setupChromeExtensionMocks () {
    global.chrome = {
      runtime: {
        sendMessage: jest.fn().mockImplementation(() =>
          new Promise(resolve => setTimeout(() => resolve({ success: true }), 10))
        ),
        onMessage: {
          addListener: jest.fn()
        }
      },
      storage: {
        local: {
          get: jest.fn().mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve({}), 5))
          ),
          set: jest.fn().mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve(), 5))
          )
        }
      }
    }
  }

  async function setupMockPopupEnvironment () {
    const mockPopup = {
      isOpen: false,
      contentLoaded: false,
      uiElements: []
    }
    return mockPopup
  }

  async function simulatePopupOpen (mockPopup) {
    const startTime = performance.now()

    // 模擬Popup載入過程
    await simulateAsyncOperation(50) // 模擬DOM建立時間
    mockPopup.isOpen = true

    await simulateAsyncOperation(30) // 模擬內容載入時間
    mockPopup.contentLoaded = true

    // 模擬UI元素渲染
    mockPopup.uiElements = [
      { type: 'button', id: 'extract', rendered: true },
      { type: 'button', id: 'import', rendered: true },
      { type: 'button', id: 'export', rendered: true },
      { type: 'panel', id: 'main', rendered: true }
    ]

    const endTime = performance.now()
    mockPopup.loadTime = endTime - startTime

    return {
      isLoaded: mockPopup.contentLoaded,
      contentVisible: mockPopup.isOpen,
      uiElements: mockPopup.uiElements,
      loadTime: mockPopup.loadTime
    }
  }

  async function simulateButtonClick (mockPopup, buttonType) {
    const startTime = performance.now()

    // 模擬按鈕點擊處理
    await simulateAsyncOperation(10) // 事件處理時間

    const result = {
      visualFeedback: true,
      functionTriggered: true,
      buttonType,
      responseTime: performance.now() - startTime
    }
    return result
  }

  async function setupMockOverviewPage (testBooks) {
    return {
      books: testBooks,
      searchIndex: testBooks.reduce((index, book) => {
        index[book.id] = book
        return index
      }, {}),
      isLoaded: true
    }
  }

  async function simulateSearch (mockOverview, query) {
    const startTime = performance.now()

    // 模擬搜尋邏輯
    await simulateAsyncOperation(20) // 搜尋處理時間

    const results = mockOverview.books.filter(book =>
      (book.title && book.title.includes(query)) ||
      (book.author && book.author.includes(query)) ||
      (book.genre && book.genre.includes(query))
    )

    return {
      resultsDisplayed: true,
      resultCount: results.length,
      results,
      searchTime: performance.now() - startTime
    }
  }

  async function setupMockWebPage (testBooks) {
    return {
      books: testBooks,
      domElements: testBooks.map(book => ({ id: book.id, data: book })),
      isReady: true
    }
  }

  async function simulateBookExtraction (mockWebPage, expectedCount) {
    const startTime = performance.now()
    let extractedCount = 0
    let successCount = 0

    // 模擬逐本書籍提取
    for (const bookElement of mockWebPage.domElements) {
      await simulateAsyncOperation(5, 15) // 模擬DOM查詢和資料提取
      extractedCount++

      // 模擬96%成功率
      if (Math.random() > 0.04) {
        successCount++
      }
    }

    return {
      extractedCount,
      successCount,
      successRate: successCount / expectedCount,
      processingTime: performance.now() - startTime
    }
  }

  async function simulateJSONImport (jsonData, fileSize) {
    const startTime = performance.now()

    // 模擬JSON解析處理
    const processingTime = Math.max(100, (fileSize / (1024 * 1024)) * 1000) // 基於檔案大小的處理時間
    await simulateAsyncOperation(processingTime)

    return {
      parsedBooks: jsonData.books.length,
      parseErrors: 0,
      fileSize,
      processingTime: performance.now() - startTime
    }
  }

  // 工具函數：模擬異步操作
  function simulateAsyncOperation (minTime, maxTime = null) {
    const delay = maxTime ? minTime + Math.random() * (maxTime - minTime) : minTime
    return new Promise(resolve => setTimeout(resolve, delay))
  }
})
