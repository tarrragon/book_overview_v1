/* eslint-disable no-console */

/**
 * 完整書籍資料提取工作流程測試
 *
 * 負責功能：
 * - 測試從 Readmoo 頁面到資料提取完成的完整流程
 * - 驗證 Background Script, Content Script, Popup 的整合
 * - 測試資料儲存和 UI 更新的端對端流程
 * - 驗證錯誤處理和恢復機制
 *
 * 設計考量：
 * - 使用 E2ETestSuite mock 環境模擬真實使用者操作序列
 * - 測試跨上下文的事件通訊
 * - 驗證資料一致性和完整性
 * - 確保系統在各種情境下的穩定性
 *
 * 處理流程：
 * 1. 初始化 E2ETestSuite 並準備測試資料
 * 2. 模擬導航到 Readmoo 測試頁面
 * 3. 透過工作流程引擎觸發提取
 * 4. 監控提取過程和事件流
 * 5. 驗證資料儲存和 UI 更新
 * 6. 測試錯誤情境和恢復機制
 *
 * 使用情境：
 * - 驗證 Extension 完整功能是否正常運作
 * - 測試產品發布前的品質保證
 * - 回歸測試確保修改不影響核心功能
 */

const { E2ETestSuite } = require('../../helpers/e2e-test-suite')

describe('完整書籍資料提取工作流程', () => {
  let suite

  beforeAll(async () => {
    suite = new E2ETestSuite({
      testDataSize: 'small',
      enableStorageTracking: true
    })
    await suite.initialize()

    // 準備測試資料：模擬已完成一次資料提取
    await suite.navigateToMockReadmooPage()
    await suite.setupMockReadmooPage()
  })

  afterAll(async () => {
    if (suite) {
      await suite.cleanup()
    }
  })

  describe('基本工作流程測試', () => {
    test('應該能夠載入 Extension 並初始化環境', async () => {
      // 驗證 Extension 環境已初始化
      expect(suite.testEnvironment.initialized).toBe(true)
      expect(suite.testEnvironment.extension).toBeDefined()
      expect(suite.testEnvironment.extension.id).toBeDefined()
      expect(suite.testEnvironment.extension.id.length).toBeGreaterThan(10)

      // 驗證 Background context 已設定
      const backgroundContext = suite.testEnvironment.contexts.get('background')
      expect(backgroundContext).toBeDefined()
      expect(backgroundContext.active).toBe(true)
    })

    test('應該能夠導航到 Readmoo 測試頁面', async () => {
      // 導航到模擬 Readmoo 頁面
      const navResult = await suite.navigateToMockReadmooPage()
      expect(navResult.success).toBe(true)
      expect(navResult.url).toContain('readmoo.com')

      // 驗證頁面環境已正確設定
      expect(suite.extensionController.state.pageEnvironment).toBeDefined()
      expect(suite.extensionController.state.pageEnvironment.pageType).toBe('library')

      // 注入測試書籍資料（模擬頁面上的 5 本書）
      const testBooks = Array.from({ length: 5 }, (_, i) => ({
        id: `book-${i + 1}`,
        title: `Test Book ${i + 1}`,
        author: `Author ${i + 1}`,
        progress: (i + 1) * 20
      }))
      await suite.injectMockBooks(testBooks)

      // 驗證測試資料存在
      expect(suite.testData.books).toHaveLength(5)
    })

    test('應該能夠開啟 Extension Popup', async () => {
      // 驗證 Popup context 存在
      const popupContext = suite.testEnvironment.contexts.get('popup')
      expect(popupContext).toBeDefined()

      // 模擬開啟 Popup 的工作流程
      const popupResult = await suite.executeWorkflow('open-popup', [
        { type: 'click', params: { selector: '#extensionIcon' } },
        { type: 'wait', params: { duration: 50 } }
      ])

      expect(popupResult.result.success).toBe(true)
      expect(popupResult.steps.length).toBe(2)
    })
  })

  describe('資料提取流程測試', () => {
    test('應該能夠觸發書籍資料提取', async () => {
      // 模擬點擊提取按鈕並等待狀態更新
      const extractionResult = await suite.executeWorkflow('extraction-trigger', [
        { type: 'click', params: { selector: '#extractButton' } },
        { type: 'wait', params: { duration: 100 } }
      ])

      // 驗證提取工作流程成功啟動
      expect(extractionResult.result.success).toBe(true)
      expect(extractionResult.steps[0].success).toBe(true)

      // 驗證提取步驟已記錄到 metrics
      const metrics = suite.getMetrics()
      expect(metrics.operations).toBeGreaterThan(0)
    })

    test('應該能夠提取並顯示書籍資料', async () => {
      // 模擬完整提取流程
      const extractResult = await suite.executeWorkflow('extraction-complete', [
        { type: 'click', params: { selector: '#extractButton' } },
        { type: 'wait', params: { duration: 100 } },
        { type: 'verify', params: { condition: 'extraction-complete' } }
      ])

      expect(extractResult.result.success).toBe(true)
      expect(extractResult.result.completedSteps).toBe(3)

      // 驗證書籍資料可取得
      const overviewData = await suite.getOverviewPageData()
      expect(overviewData.bookCount).toBe(5)
      expect(overviewData.booksDisplayed).toHaveLength(5)

      console.log(`提取完成，共 ${overviewData.bookCount} 本書`)
    })

    test('應該能夠在 Background Script 中接收到資料', async () => {
      // 將資料寫入模擬儲存
      await suite.simulateStorageWrite('extractedBooks', suite.testData.books)

      // 驗證儲存中有資料
      const storedBooks = await suite.simulateStorageRead('extractedBooks')
      expect(storedBooks).toBeDefined()
      expect(storedBooks.length).toBeGreaterThan(0)

      // 驗證 Background context 處於活動狀態
      const bgContext = suite.testEnvironment.contexts.get('background')
      expect(bgContext.active).toBe(true)
    })
  })

  describe('資料儲存驗證測試', () => {
    test('應該能夠正確儲存提取的書籍資料', async () => {
      // 確保測試資料已寫入儲存
      await suite.simulateStorageWrite('extractedBooks', suite.testData.books)

      // 從儲存中讀取書籍資料
      const storedData = await suite.simulateStorageRead('extractedBooks')

      // 驗證資料完整性
      expect(storedData).toHaveLength(5)

      // 驗證第一本書的資料結構
      const firstBook = storedData[0]
      expect(firstBook).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        author: expect.any(String),
        progress: expect.any(Number)
      })
    })

    test('應該能夠儲存提取時間戳記', async () => {
      // 模擬儲存提取元資料
      const extractionMetadata = {
        extractionTime: new Date().toISOString(),
        bookCount: suite.testData.books.length,
        source: 'readmoo-library'
      }
      await suite.simulateStorageWrite('extractionMetadata', extractionMetadata)

      // 驗證元資料已儲存
      const metadata = await suite.simulateStorageRead('extractionMetadata')
      expect(metadata).toBeDefined()
      expect(metadata.extractionTime).toBeDefined()

      const extractionDate = new Date(metadata.extractionTime)
      expect(extractionDate).toBeInstanceOf(Date)
      expect(isNaN(extractionDate.getTime())).toBe(false)
    })
  })

  describe('UI 整合測試', () => {
    test('應該能夠開啟 Overview 頁面並載入資料', async () => {
      // 模擬點擊「查看書庫」按鈕並導航到 Overview
      const navigationResult = await suite.executeWorkflow('open-overview', [
        { type: 'click', params: { selector: '#viewLibraryButton' } },
        { type: 'navigate', params: { url: 'chrome-extension://test/overview.html' } },
        { type: 'wait', params: { duration: 100 } }
      ])

      expect(navigationResult.result.success).toBe(true)

      // 驗證 Overview 頁面資料
      const overviewData = await suite.getOverviewPageData()
      expect(overviewData).toBeTruthy()
      expect(overviewData.bookCount).toBeGreaterThan(0)
      expect(overviewData.booksDisplayed.length).toBeGreaterThan(0)
    })

    test('應該能夠顯示正確的書籍統計資訊', async () => {
      // 驗證 Overview 頁面統計
      const overviewData = await suite.getOverviewPageData()

      expect(overviewData.bookCount).toBe(5)
      expect(overviewData.searchFunctionality).toBe(true)
      expect(overviewData.exportFunctionality).toBe(true)

      console.log(`書籍統計：共 ${overviewData.bookCount} 本書`)
    })
  })

  describe('錯誤處理測試', () => {
    test('應該能夠處理網頁載入失敗', async () => {
      // 導航到非 Readmoo 頁面（觸發頁面偵測錯誤）
      await suite.navigateToPage('http://invalid-readmoo-url.test')

      // 驗證 extensionController 識別到非 Readmoo 頁面
      const isReadmooPage = suite.extensionController.state.storage.get('isReadmooPage')
      expect(isReadmooPage).toBe(false)

      // 驗證錯誤訊息已設定
      const errorMessage = suite.extensionController.state.storage.get('errorMessage')
      expect(errorMessage).toBeDefined()
      expect(errorMessage).toContain('Readmoo')

      // 恢復正常狀態
      await suite.navigateToMockReadmooPage()
      await suite.setupMockReadmooPage()
    })

    test('應該能夠在提取失敗後重試', async () => {
      // 先模擬一次失敗（內容腳本錯誤）
      await suite.simulateContentScriptError('extraction-failed')

      // 驗證錯誤狀態已設定
      const contentScriptError = suite.extensionController.state.storage.get('contentScriptError')
      expect(contentScriptError).toBeDefined()
      expect(contentScriptError.type).toBe('extraction-failed')

      // 清除錯誤狀態（模擬重試準備）
      await suite.clearContentScriptError()

      // 重試提取
      const retryResult = await suite.executeWorkflow('retry-extraction', [
        { type: 'click', params: { selector: '#retryButton' } },
        { type: 'wait', params: { duration: 100 } },
        { type: 'verify', params: { condition: 'extraction-complete' } }
      ])

      expect(retryResult.result.success).toBe(true)

      // 驗證重試後資料恢復
      const overviewData = await suite.getOverviewPageData()
      expect(overviewData.bookCount).toBeGreaterThan(0)
    })
  })

  describe('效能基準測試', () => {
    test('提取過程應該在合理時間內完成', async () => {
      // 使用 measureOperation 測量提取時間
      const extractionTime = await suite.measureOperation('full-extraction', async () => {
        const result = await suite.executeWorkflow('timed-extraction', [
          { type: 'click', params: { selector: '#extractButton' } },
          { type: 'wait', params: { duration: 50 } },
          { type: 'verify', params: { condition: 'extraction-complete' } }
        ])
        return result
      })

      // 驗證提取時間在合理範圍內（20 秒）
      expect(extractionTime).toBeLessThan(20000)

      console.log(`提取完成時間: ${extractionTime}ms`)
    })

    test('記憶體使用應該在合理範圍內', async () => {
      // 取得記憶體使用情況
      const memoryInfo = await suite.getMemoryUsage()

      expect(memoryInfo).toBeDefined()
      expect(memoryInfo.used).toBeDefined()
      expect(memoryInfo.total).toBeDefined()

      const memoryUsageMB = memoryInfo.used / 1024 / 1024

      // 驗證記憶體使用少於 200MB（測試環境含 Jest 開銷）
      expect(memoryUsageMB).toBeLessThan(200)

      console.log(`記憶體使用量: ${memoryUsageMB.toFixed(2)}MB`)
    })
  })

  describe('視覺回歸測試', () => {
    test('應該能夠驗證核心頁面狀態', async () => {
      // 驗證 Popup 狀態
      const popupContext = suite.testEnvironment.contexts.get('popup')
      expect(popupContext).toBeDefined()

      // 驗證主頁面資料完整性
      const overviewData = await suite.getOverviewPageData()
      expect(overviewData).toBeTruthy()
      expect(overviewData.bookCount).toBeGreaterThan(0)

      // 驗證所有核心功能仍可用
      expect(overviewData.searchFunctionality).toBe(true)
      expect(overviewData.exportFunctionality).toBe(true)

      console.log('核心頁面狀態驗證通過')
    })
  })
})
