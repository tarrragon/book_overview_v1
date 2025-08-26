/**
 * 日常使用工作流程整合測試
 *
 * 測試目標：
 * - 驗證已有資料的Extension日常使用流程
 * - 確保資料同步、檢視操作、統計功能等正常運作
 * - 檢查多次使用的穩定性和一致性
 */

const { E2ETestSuite } = require('../../helpers/e2e-test-suite')
const { ChromeExtensionController } = require('../../helpers/chrome-extension-controller')
const { TestDataGenerator } = require('../../helpers/test-data-generator')
const { DataConsistencyChecker } = require('../../helpers/data-consistency-checker')

describe('日常使用工作流程整合測試', () => {
  let testSuite
  let extensionController
  let testDataGenerator
  let consistencyChecker

  beforeAll(async () => {
    testSuite = new E2ETestSuite({
      headless: process.env.CI !== 'false',
      slowMo: 30,
      testDataSize: 'medium' // 日常使用一般是中型資料集
    })

    await testSuite.setup()
    extensionController = testSuite.extensionController
    testDataGenerator = new TestDataGenerator()
    consistencyChecker = new DataConsistencyChecker()
  })

  afterAll(async () => {
    await testSuite.cleanup()
  })

  beforeEach(async () => {
    // 設定標準的日常使用初始狀態
    await testSuite.clearAllStorageData()

    // 預載入一些既有書籍資料，模擬已使用一段時間的狀態
    const existingBooks = testDataGenerator.generateBooks(200, 'existing-data')
    await testSuite.loadInitialData({
      books: existingBooks,
      metadata: {
        firstInstall: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天前安裝
        lastExtraction: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 昨天提取過
        version: '0.9.34'
      }
    })
  })

  describe('Given Extension已安裝並有既有資料', () => {
    test('應該正確載入和顯示既有資料狀態', async () => {
      // When: 開啟Extension Popup
      const popupState = await extensionController.openPopup()

      // Then: 應該顯示正確的既有資料狀態
      expect(popupState.isFirstTime).toBe(false)
      expect(popupState.bookCount).toBe(200)
      expect(popupState.lastExtraction).toBeDefined()
      expect(popupState.overviewButtonEnabled).toBe(true)
      expect(popupState.extractButtonEnabled).toBe(true)

      // 驗證統計資訊顯示
      expect(popupState.statistics).toBeDefined()
      expect(popupState.statistics.totalBooks).toBe(200)
      expect(popupState.statistics.daysSinceLastExtraction).toBe(1)
    })

    test('應該正確檢測資料完整性', async () => {
      // When: 執行資料完整性檢查
      const integrityResult = await extensionController.checkDataIntegrity()

      // Then: 應該確認資料完整性正常
      expect(integrityResult.status).toBe('healthy')
      expect(integrityResult.totalRecords).toBe(200)
      expect(integrityResult.corruptedRecords.length).toBe(0)
      expect(integrityResult.duplicateRecords.length).toBe(0)
      expect(integrityResult.missingFields.length).toBe(0)
    })
  })

  describe('When 使用者開啟Extension → 檢視書籍列表 → 執行資料同步 → 查看統計', () => {
    test('應該順利執行完整的檢視書籍列表流程', async () => {
      // Given: 開啟Extension
      await extensionController.openPopup()

      // When: 點擊檢視詳細資料，開啟Overview頁面
      const overviewResult = await extensionController.clickOverviewButton()
      expect(overviewResult.success).toBe(true)

      await testSuite.waitForPageLoad(overviewResult.pageUrl)

      // Then: 驗證書籍列表正確顯示
      const overviewData = await testSuite.getOverviewPageData()

      expect(overviewData.bookCount).toBe(200)
      expect(overviewData.booksDisplayed.length).toBeGreaterThan(0)

      // 測試分頁功能
      const initialDisplayCount = overviewData.booksDisplayed.length
      if (overviewData.totalPages > 1) {
        await testSuite.clickOverviewPagination(2)
        const page2Data = await testSuite.getOverviewPageData()
        expect(page2Data.currentPage).toBe(2)
        expect(page2Data.booksDisplayed.length).toBeGreaterThan(0)
      }

      // 測試搜尋功能
      const searchResult = await testSuite.searchOverviewBooks('測試')
      expect(searchResult.resultsFound).toBeGreaterThan(0)
      expect(searchResult.displayedBooks.length).toBeGreaterThan(0)

      // 測試篩選功能
      const filterResult = await testSuite.filterOverviewBooks({
        progressRange: { min: 50, max: 100 }
      })
      expect(filterResult.filteredCount).toBeGreaterThan(0)
      filterResult.displayedBooks.forEach(book => {
        expect(book.progress).toBeGreaterThanOrEqual(50)
        expect(book.progress).toBeLessThanOrEqual(100)
      })
    })

    test('應該正確執行資料同步流程', async () => {
      // Given: 準備新的Readmoo頁面資料
      const newBooks = testDataGenerator.generateBooks(50, 'sync-test')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks([...newBooks,
        ...testDataGenerator.generateBooks(200, 'existing-data')]) // 包含既有資料

      // 記錄同步前狀態
      const preSyncState = await extensionController.getStorageData()
      const preSyncCount = preSyncState.books.length

      // When: 執行同步操作
      await extensionController.openPopup()

      const syncStarted = await extensionController.clickExtractButton()
      expect(syncStarted.success).toBe(true)

      // 監控同步進度
      const progressUpdates = []
      const progressSubscription = await extensionController.subscribeToProgress((progress) => {
        progressUpdates.push(progress)
      })

      const syncResult = await extensionController.waitForExtractionComplete({
        timeout: 30000
      })

      progressSubscription.unsubscribe()

      // Then: 驗證同步結果
      expect(syncResult.success).toBe(true)

      const postSyncState = await extensionController.getStorageData()
      const postSyncCount = postSyncState.books.length

      // 驗證資料同步正確性
      expect(postSyncCount).toBe(250) // 200個既有 + 50個新增

      // 驗證去重功能 - 既有書籍不應重複
      const bookIds = postSyncState.books.map(book => book.id)
      const uniqueIds = [...new Set(bookIds)]
      expect(uniqueIds.length).toBe(bookIds.length)

      // 驗證進度追蹤
      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates[progressUpdates.length - 1].completed).toBe(true)
    })

    test('應該正確顯示和更新統計資訊', async () => {
      // Given: 執行一次同步操作
      const newBooks = testDataGenerator.generateBooks(30, 'stats-test')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks([...newBooks,
        ...testDataGenerator.generateBooks(200, 'existing-data')])

      await extensionController.openPopup()
      await extensionController.clickExtractButton()
      await extensionController.waitForExtractionComplete()

      // When: 檢查統計資訊
      const updatedState = await extensionController.getPopupState()

      // Then: 驗證統計資訊正確性
      expect(updatedState.statistics).toBeDefined()
      expect(updatedState.statistics.totalBooks).toBe(230) // 200個既有 + 30個新增
      expect(updatedState.statistics.newBooksThisSession).toBe(30)
      expect(updatedState.statistics.daysSinceLastExtraction).toBe(0) // 剛同步過
      expect(updatedState.statistics.lastExtractionTime).toBeDefined()

      // 驗證統計資訊在Overview頁面的顯示
      await extensionController.clickOverviewButton()
      const overviewStats = await testSuite.getOverviewStatistics()

      expect(overviewStats.totalBooks).toBe(230)
      expect(overviewStats.averageProgress).toBeDefined()
      expect(overviewStats.completedBooks).toBeDefined()
      expect(overviewStats.inProgressBooks).toBeDefined()
    })
  })

  describe('Then 每個步驟都應正常執行並提供適當的UI回饋', () => {
    test('應該在每個操作步驟提供即時UI回饋', async () => {
      // Given: 準備測試環境
      const testBooks = testDataGenerator.generateBooks(100, 'ui-feedback-test')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks([...testBooks,
        ...testDataGenerator.generateBooks(200, 'existing-data')])

      // When & Then: 驗證每個步驟的UI回饋

      // 步驟1: 開啟Extension的載入回饋
      const loadingStart = Date.now()
      const popupState = await extensionController.openPopup()
      const loadingTime = Date.now() - loadingStart

      expect(loadingTime).toBeLessThan(500) // 載入時間<500ms
      expect(popupState.loadingIndicatorShown).toBe(false) // 載入完成後隱藏

      // 步驟2: 同步按鈕的狀態變化回饋
      const buttonStateBeforeClick = await extensionController.getButtonState('extract')
      expect(buttonStateBeforeClick.enabled).toBe(true)
      expect(buttonStateBeforeClick.loading).toBe(false)

      await extensionController.clickExtractButton()

      const buttonStateDuringExtraction = await extensionController.getButtonState('extract')
      expect(buttonStateDuringExtraction.enabled).toBe(false)
      expect(buttonStateDuringExtraction.loading).toBe(true)

      // 步驟3: 進度指示器的更新回饋
      const progressCallback = jest.fn()
      const progressSubscription = await extensionController.subscribeToProgress(progressCallback)

      await extensionController.waitForExtractionComplete()
      progressSubscription.unsubscribe()

      // 驗證進度回調被調用
      expect(progressCallback).toHaveBeenCalled()

      const progressCalls = progressCallback.mock.calls
      expect(progressCalls.length).toBeGreaterThan(3) // 至少3次進度更新

      // 驗證進度遞增
      for (let i = 1; i < progressCalls.length; i++) {
        const prevProgress = progressCalls[i - 1][0]
        const currProgress = progressCalls[i][0]
        expect(currProgress.processedCount).toBeGreaterThanOrEqual(prevProgress.processedCount)
      }

      // 步驟4: 完成後的狀態回饋
      const finalButtonState = await extensionController.getButtonState('extract')
      expect(finalButtonState.enabled).toBe(true)
      expect(finalButtonState.loading).toBe(false)

      const finalPopupState = await extensionController.getPopupState()
      expect(finalPopupState.completionMessageShown).toBe(true)
      expect(finalPopupState.bookCount).toBe(300) // 200 + 100
    })

    test('應該正確處理並發操作和防止重複執行', async () => {
      // Given: 準備測試環境
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(50, 'concurrent-test'))

      await extensionController.openPopup()

      // When: 嘗試並發執行同步操作
      const firstExtractionPromise = extensionController.clickExtractButton()

      // 立即嘗試第二次點擊
      await testSuite.waitForTimeout(100) // 等待第一次點擊處理
      const secondExtractionPromise = extensionController.clickExtractButton()

      const [firstResult, secondResult] = await Promise.all([
        firstExtractionPromise,
        secondExtractionPromise
      ])

      // Then: 驗證併發控制
      expect(firstResult.success).toBe(true)
      expect(secondResult.success).toBe(false) // 第二次應被拒絕
      expect(secondResult.reason).toContain('進行中') // 提示已有操作進行中

      // 等待第一次操作完成
      await extensionController.waitForExtractionComplete()

      // 驗證最終狀態正確
      const finalState = await extensionController.getPopupState()
      expect(finalState.bookCount).toBe(250) // 200 (既有) + 50 (新增)
    })

    test('應該正確顯示錯誤狀況並提供恢復選項', async () => {
      // Given: 準備會觸發錯誤的環境
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(50, 'error-test'))

      await extensionController.openPopup()

      // When: 開始同步後模擬錯誤情況
      await extensionController.clickExtractButton()

      // 等待部分進度
      await testSuite.waitForTimeout(2000)

      // 模擬Content Script錯誤
      await testSuite.simulateContentScriptError('PARSING_ERROR')

      // Then: 驗證錯誤處理和UI回饋
      const errorState = await extensionController.waitForErrorState({
        timeout: 10000,
        expectedError: 'PARSING_ERROR'
      })

      expect(errorState.errorDisplayed).toBe(true)
      expect(errorState.errorMessage).toContain('解析')
      expect(errorState.retryButtonVisible).toBe(true)
      expect(errorState.cancelButtonVisible).toBe(true)

      // 測試重試功能
      await testSuite.clearContentScriptError()
      const retryResult = await extensionController.clickRetryButton()

      expect(retryResult.success).toBe(true)

      // 驗證重試後成功完成
      await extensionController.waitForExtractionComplete()
      const finalState = await extensionController.getPopupState()
      expect(finalState.bookCount).toBe(250)
    })
  })

  describe('資料一致性和完整性驗證', () => {
    test('應該在多次同步操作間保持資料一致性', async () => {
      // Given: 進行第一次同步
      const batch1Books = testDataGenerator.generateBooks(50, 'consistency-batch1')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks([...batch1Books,
        ...testDataGenerator.generateBooks(200, 'existing-data')])

      await extensionController.openPopup()
      await extensionController.clickExtractButton()
      await extensionController.waitForExtractionComplete()

      const firstSyncData = await extensionController.getStorageData()

      // When: 進行第二次同步（部分重疊資料）
      const batch2Books = [
        ...testDataGenerator.generateBooks(30, 'consistency-batch2'),
        ...batch1Books.slice(0, 20) // 20個重疊的書籍
      ]

      await testSuite.injectMockBooks([...batch2Books,
        ...testDataGenerator.generateBooks(200, 'existing-data')])

      await extensionController.clickExtractButton()
      await extensionController.waitForExtractionComplete()

      const secondSyncData = await extensionController.getStorageData()

      // Then: 驗證資料一致性
      expect(secondSyncData.books.length).toBe(280) // 200 + 50 + 30 (重疊的20個不重複計算)

      // 使用一致性檢查器驗證
      const consistencyResult = await consistencyChecker.verifyRealTimeConsistency(
        firstSyncData,
        secondSyncData
      )

      expect(consistencyResult.duplicatesFound).toBe(0)
      expect(consistencyResult.dataCorruption).toBe(false)
      expect(consistencyResult.missingRecords).toEqual([])
      expect(consistencyResult.inconsistentFields).toEqual([])
    })

    test('應該正確處理資料更新和版本管理', async () => {
      // Given: 有一本書籍的進度需要更新
      const existingBook = {
        id: 'update-test-001',
        title: '更新測試書籍',
        progress: 30,
        lastModified: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }

      // 預設既有資料包含這本書
      const existingData = [
        existingBook,
        ...testDataGenerator.generateBooks(199, 'existing-data')
      ]
      await testSuite.clearAllStorageData()
      await testSuite.loadInitialData({ books: existingData })

      // When: 同步時發現相同書籍但進度已更新
      const updatedBook = {
        ...existingBook,
        progress: 75, // 進度更新
        lastModified: new Date().toISOString()
      }

      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks([
        updatedBook,
        ...testDataGenerator.generateBooks(199, 'existing-data')
      ])

      await extensionController.openPopup()
      await extensionController.clickExtractButton()
      await extensionController.waitForExtractionComplete()

      // Then: 驗證資料更新正確處理
      const finalData = await extensionController.getStorageData()
      const updatedBookInStorage = finalData.books.find(book => book.id === 'update-test-001')

      expect(updatedBookInStorage).toBeDefined()
      expect(updatedBookInStorage.progress).toBe(75) // 進度已更新
      expect(updatedBookInStorage.lastModified).toBe(updatedBook.lastModified)

      // 確認沒有重複記錄
      const sameIdBooks = finalData.books.filter(book => book.id === 'update-test-001')
      expect(sameIdBooks.length).toBe(1)

      // 總數量正確
      expect(finalData.books.length).toBe(200)
    })
  })

  describe('效能和穩定性驗證', () => {
    test('日常使用工作流程應該保持良好效能', async () => {
      // Given: 模擬真實日常使用場景的資料量
      const dailyNewBooks = testDataGenerator.generateBooks(20, 'daily-new')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks([...dailyNewBooks,
        ...testDataGenerator.generateBooks(200, 'existing-data')])

      // When: 執行完整日常工作流程並監控效能
      const performanceStart = await testSuite.capturePerformanceBaseline()

      // 步驟1: 開啟Extension
      const popupOpenTime = await testSuite.measureOperation('popup-open', async () => {
        await extensionController.openPopup()
      })

      // 步驟2: 檢查資料同步
      const syncTime = await testSuite.measureOperation('data-sync', async () => {
        await extensionController.clickExtractButton()
        await extensionController.waitForExtractionComplete()
      })

      // 步驟3: 檢視Overview
      const overviewTime = await testSuite.measureOperation('overview-access', async () => {
        await extensionController.clickOverviewButton()
        await testSuite.waitForPageLoad()
      })

      const performanceEnd = await testSuite.capturePerformanceBaseline()

      // Then: 驗證效能指標
      expect(popupOpenTime).toBeLessThan(500) // Popup開啟<500ms
      expect(syncTime).toBeLessThan(8000) // 小量同步<8秒
      expect(overviewTime).toBeLessThan(1000) // Overview開啟<1秒

      // 記憶體使用檢查
      const memoryUsage = performanceEnd.memory.used - performanceStart.memory.used
      expect(memoryUsage).toBeLessThan(30 * 1024 * 1024) // 記憶體增長<30MB

      // CPU使用檢查
      expect(performanceEnd.cpu.usage).toBeLessThan(0.8) // CPU使用<80%
    })

    test('應該支援多次連續使用且保持穩定', async () => {
      // Given: 準備多輪操作的測試資料
      const operationCount = 5
      const performanceHistory = []

      for (let i = 0; i < operationCount; i++) {
        // When: 執行第i輪日常操作
        const roundStart = Date.now()
        const startMemory = await testSuite.getMemoryUsage()

        // 準備這一輪的新書籍
        const newBooks = testDataGenerator.generateBooks(10, `round-${i}`)
        await testSuite.setupMockReadmooPage()
        await testSuite.injectMockBooks([...newBooks,
          ...testDataGenerator.generateBooks(200 + i * 10, 'existing-data')])

        // 執行同步
        await extensionController.openPopup()
        await extensionController.clickExtractButton()
        await extensionController.waitForExtractionComplete()

        const roundEnd = Date.now()
        const endMemory = await testSuite.getMemoryUsage()

        // 記錄這一輪的效能
        performanceHistory.push({
          round: i + 1,
          executionTime: roundEnd - roundStart,
          memoryUsage: endMemory.used - startMemory.used,
          finalBookCount: 210 + i * 10
        })

        // 短暫等待，模擬真實使用間隔
        await testSuite.waitForTimeout(1000)
      }

      // Then: 驗證多輪操作的穩定性

      // 驗證效能沒有顯著退化
      const avgExecutionTime = performanceHistory.reduce((sum, record) =>
        sum + record.executionTime, 0) / operationCount
      expect(avgExecutionTime).toBeLessThan(10000) // 平均執行時間<10秒

      // 驗證最後一輪不比第一輪慢太多
      const firstRoundTime = performanceHistory[0].executionTime
      const lastRoundTime = performanceHistory[operationCount - 1].executionTime
      expect(lastRoundTime).toBeLessThan(firstRoundTime * 1.5) // 不超過首輪1.5倍

      // 驗證記憶體使用穩定
      const memoryUsages = performanceHistory.map(record => record.memoryUsage)
      const maxMemoryUsage = Math.max(...memoryUsages)
      expect(maxMemoryUsage).toBeLessThan(50 * 1024 * 1024) // 單輪記憶體<50MB

      // 驗證資料一致性
      const finalState = await extensionController.getStorageData()
      expect(finalState.books.length).toBe(250) // 200 + 5*10
    })
  })
})
