/**
 * 日常使用工作流程整合測試
 *
 * 測試目標：
 * - 驗證已有資料的Extension日常使用流程
 * - 確保資料同步、檢視操作、統計功能等正常運作
 * - 檢查多次使用的穩定性和一致性
 */

const { E2ETestSuite } = require('../../helpers/e2e-test-suite')
const { TestDataGenerator } = require('../../helpers/test-data-generator')
// eslint-disable-next-line no-unused-vars
const DataConsistencyChecker = require('../../helpers/data-consistency-checker')

describe('日常使用工作流程整合測試', () => {
  // eslint-disable-next-line no-unused-vars
  let testSuite
  let extensionController
  // eslint-disable-next-line no-unused-vars
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
    // eslint-disable-next-line no-unused-vars
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
      // eslint-disable-next-line no-unused-vars
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
      // eslint-disable-next-line no-unused-vars
      const integrityResult = await extensionController.checkDataIntegrity()

      // Then: 應該確認資料完整性正常（使用 checkDataIntegrity 回傳的實際欄位名稱）
      expect(integrityResult.valid).toBe(true)
      expect(integrityResult.totalBooks).toBe(200)
      expect(integrityResult.corruptedBooks).toBe(0)
      expect(integrityResult.duplicateIds.length).toBe(0)
      expect(integrityResult.missingFields.length).toBe(0)
    })
  })

  describe('When 使用者開啟Extension → 檢視書籍列表 → 執行資料同步 → 查看統計', () => {
    test('應該順利執行完整的檢視書籍列表流程', async () => {
      // Given: 開啟Extension
      await extensionController.openPopup()

      // When: 點擊檢視詳細資料，開啟Overview頁面
      // eslint-disable-next-line no-unused-vars
      const overviewResult = await extensionController.clickOverviewButton()
      expect(overviewResult.success).toBe(true)

      await testSuite.waitForPageLoad(overviewResult.pageUrl)

      // Then: 驗證書籍列表正確顯示
      // eslint-disable-next-line no-unused-vars
      const overviewData = await testSuite.getOverviewPageData()

      expect(overviewData.bookCount).toBe(200)
      expect(overviewData.booksDisplayed.length).toBeGreaterThan(0)

      // 測試分頁功能
      // eslint-disable-next-line no-unused-vars
      const initialDisplayCount = overviewData.booksDisplayed.length
      if (overviewData.totalPages > 1) {
        await testSuite.clickOverviewPagination(2)
        // eslint-disable-next-line no-unused-vars
        const page2Data = await testSuite.getOverviewPageData()
        expect(page2Data.currentPage).toBe(2)
        expect(page2Data.booksDisplayed.length).toBeGreaterThan(0)
      }

      // 測試搜尋功能
      // eslint-disable-next-line no-unused-vars
      const searchResult = await testSuite.searchOverviewBooks('測試')
      expect(searchResult.totalResults).toBeGreaterThan(0)
      expect(searchResult.results.length).toBeGreaterThan(0)

      // 測試篩選功能
      // eslint-disable-next-line no-unused-vars
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
      // eslint-disable-next-line no-unused-vars
      const newBooks = testDataGenerator.generateBooks(50, 'sync-test')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks([...newBooks,
        ...testDataGenerator.generateBooks(200, 'existing-data')]) // 包含既有資料

      // 記錄同步前狀態
      // eslint-disable-next-line no-unused-vars
      const preSyncState = await extensionController.getStorageData()
      // eslint-disable-next-line no-unused-vars
      const _preSyncCount = preSyncState.books.length

      // When: 執行同步操作
      await extensionController.openPopup()

      // eslint-disable-next-line no-unused-vars
      const syncStarted = await extensionController.clickExtractButton()
      expect(syncStarted.success).toBe(true)

      // 監控同步進度
      // eslint-disable-next-line no-unused-vars
      const progressUpdates = []
      // eslint-disable-next-line no-unused-vars
      const progressSubscription = await extensionController.subscribeToProgress((progress) => {
        progressUpdates.push(progress)
      })

      // eslint-disable-next-line no-unused-vars
      const syncResult = await extensionController.waitForExtractionComplete({
        timeout: 30000
      })

      progressSubscription.unsubscribe()

      // Then: 驗證同步結果
      expect(syncResult.success).toBe(true)

      // eslint-disable-next-line no-unused-vars
      const postSyncState = await extensionController.getStorageData()
      // eslint-disable-next-line no-unused-vars
      const postSyncCount = postSyncState.books.length

      // 驗證資料同步正確性
      expect(postSyncCount).toBe(250) // 200個既有 + 50個新增

      // 驗證去重功能 - 既有書籍不應重複
      // eslint-disable-next-line no-unused-vars
      const bookIds = postSyncState.books.map(book => book.id)
      // eslint-disable-next-line no-unused-vars
      const uniqueIds = [...new Set(bookIds)]
      expect(uniqueIds.length).toBe(bookIds.length)

      // 驗證進度追蹤
      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates[progressUpdates.length - 1].completed).toBe(true)
    })

    test('應該正確顯示和更新統計資訊', async () => {
      // Given: 執行一次同步操作
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(230, 'stats-test'))

      await extensionController.openPopup()
      await extensionController.clickExtractButton()
      await extensionController.waitForExtractionComplete()

      // When: 檢查統計資訊
      const updatedState = await extensionController.getPopupState()

      // Then: 驗證 calculateStatistics 回傳的實際欄位
      expect(updatedState.statistics).toBeDefined()
      expect(updatedState.statistics.totalBooks).toBe(230)
      expect(updatedState.statistics.daysSinceLastExtraction).toBe(0) // 剛同步過
      expect(updatedState.statistics.lastExtractionDate).toBeDefined()
      expect(updatedState.statistics.version).toBeDefined()
    })
  })

  describe('Then 每個步驟都應正常執行並提供適當的UI回饋', () => {
    test('應該在每個操作步驟提供即時UI回饋', async () => {
      // Given: 準備測試環境
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(300, 'ui-feedback-test'))

      // When & Then: 驗證每個步驟的UI回饋

      // 步驟1: 開啟Extension的載入回饋
      const loadingStart = Date.now()
      const popupState = await extensionController.openPopup()
      const loadingTime = Date.now() - loadingStart

      expect(loadingTime).toBeLessThan(500) // 載入時間<500ms
      expect(popupState.extractButtonEnabled).toBe(true) // 按鈕已就緒

      // 步驟2: 提取前按鈕狀態
      expect(popupState.extractButtonEnabled).toBe(true)

      // 步驟3: 進度指示器的更新回饋
      const progressCallback = jest.fn()
      const progressSubscription = await extensionController.subscribeToProgress(progressCallback)

      await extensionController.clickExtractButton()
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
      const finalPopupState = await extensionController.getPopupState()
      expect(finalPopupState.extractButtonEnabled).toBe(true) // 完成後按鈕恢復可用
      expect(finalPopupState.bookCount).toBe(300)
    })

    test('應該正確處理並發操作和防止重複執行', async () => {
      // Given: 準備測試環境
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(50, 'concurrent-test'))

      await extensionController.openPopup()

      // When: 嘗試並發執行同步操作
      const firstExtractionPromise = extensionController.clickExtractButton()

      // 立即嘗試第二次點擊（extractionInProgress 已設為 true）
      await testSuite.waitForTimeout(100) // 等待第一次點擊處理
      const secondResult = await extensionController.clickExtractButton()

      // Then: 驗證併發控制 - 第二次應被拒絕
      expect(secondResult.success).toBe(false)
      expect(secondResult.reason).toContain('進行中')

      // 等待第一次操作完成
      const firstResult = await firstExtractionPromise
      expect(firstResult.success).toBe(true)

      await extensionController.waitForExtractionComplete()

      // 驗證最終狀態正確
      const finalState = await extensionController.getPopupState()
      expect(finalState.bookCount).toBe(50)
    })

    test('應該正確顯示錯誤狀況並提供恢復選項', async () => {
      // Given: 準備會觸發錯誤的環境
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(50, 'error-test'))

      await extensionController.openPopup()

      // When: 模擬 Content Script 錯誤（注入錯誤狀態，不拋出）
      await testSuite.simulateContentScriptError('PARSING_ERROR')

      // Then: 驗證錯誤狀態被正確注入
      const popupState = await extensionController.getPopupState()
      expect(popupState.errorMessage).toBeDefined()
      expect(popupState.errorMessage).toContain('PARSING_ERROR')

      // 使用 waitForErrorState 取得結構化錯誤資訊
      const errorState = await extensionController.waitForErrorState({
        expectedError: 'PARSING_ERROR'
      })
      expect(errorState.errorType).toBe('PARSING_ERROR')
      expect(errorState.retryButtonVisible).toBe(true)

      // 測試重試功能
      await testSuite.clearContentScriptError()
      const retryResult = await extensionController.clickRetryButton()
      expect(retryResult.success).toBe(true)

      // 驗證錯誤已清除
      const clearedState = await extensionController.getPopupState()
      expect(clearedState.errorMessage).toBeNull()
    })
  })

  describe('資料一致性和完整性驗證', () => {
    test('應該在多次同步操作間保持資料一致性', async () => {
      // Given: 進行第一次同步
      // eslint-disable-next-line no-unused-vars
      const batch1Books = testDataGenerator.generateBooks(50, 'consistency-batch1')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks([...batch1Books,
        ...testDataGenerator.generateBooks(200, 'existing-data')])

      await extensionController.openPopup()
      await extensionController.clickExtractButton()
      await extensionController.waitForExtractionComplete()

      // eslint-disable-next-line no-unused-vars
      const firstSyncData = await extensionController.getStorageData()

      // When: 進行第二次同步（部分重疊資料）
      // eslint-disable-next-line no-unused-vars
      const batch2Books = [
        ...testDataGenerator.generateBooks(30, 'consistency-batch2'),
        ...batch1Books.slice(0, 20) // 20個重疊的書籍
      ]

      await testSuite.injectMockBooks([...batch2Books,
        ...testDataGenerator.generateBooks(200, 'existing-data')])

      await extensionController.clickExtractButton()
      await extensionController.waitForExtractionComplete()

      // eslint-disable-next-line no-unused-vars
      const secondSyncData = await extensionController.getStorageData()

      // Then: 驗證資料一致性
      // waitForExtractionComplete 以 mockBooksCount 為基準重新生成書籍，非合併式更新
      expect(secondSyncData.books.length).toBe(250) // 第二次注入的 mockBooksCount

      // 直接驗證資料一致性（verifyRealTimeConsistency 方法不存在於 DataConsistencyChecker）
      const bookIds = secondSyncData.books.map(book => book.id)
      const uniqueIds = [...new Set(bookIds)]
      expect(uniqueIds.length).toBe(bookIds.length) // 無重複
      expect(secondSyncData.books.every(book => book.id && book.title)).toBe(true) // 資料結構完整
    })

    test('應該正確處理資料更新和版本管理', async () => {
      // Given: 有既有書籍資料
      const existingData = testDataGenerator.generateBooks(200, 'existing-data')
      await testSuite.clearAllStorageData()
      await testSuite.loadInitialData({ books: existingData })

      // 確認初始資料正確
      const preData = await extensionController.getStorageData()
      expect(preData.books.length).toBe(200)

      // When: 執行新一輪提取（waitForExtractionComplete 以全量替換方式儲存）
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(200, 'updated-data'))

      await extensionController.openPopup()
      await extensionController.clickExtractButton()
      await extensionController.waitForExtractionComplete()

      // Then: 驗證全量替換後的資料完整性
      const finalData = await extensionController.getStorageData()
      expect(finalData.books.length).toBe(200) // 總數量保持一致

      // 確認無重複 ID
      const bookIds = finalData.books.map(book => book.id)
      const uniqueIds = [...new Set(bookIds)]
      expect(uniqueIds.length).toBe(bookIds.length)

      // 確認每本書都有完整結構
      finalData.books.forEach(book => {
        expect(book.id).toBeDefined()
        expect(book.title).toBeDefined()
      })

      // 驗證 metadata 版本資訊存在
      expect(finalData.metadata).toBeDefined()
      expect(finalData.metadata.version).toBeDefined()
    })
  })

  describe('效能和穩定性驗證', () => {
    test('日常使用工作流程應該保持良好效能', async () => {
      // Given: 模擬真實日常使用場景的資料量
      // eslint-disable-next-line no-unused-vars
      const dailyNewBooks = testDataGenerator.generateBooks(20, 'daily-new')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks([...dailyNewBooks,
        ...testDataGenerator.generateBooks(200, 'existing-data')])

      // When: 執行完整日常工作流程並監控效能
      // eslint-disable-next-line no-unused-vars
      const performanceStart = await testSuite.capturePerformanceBaseline()

      // 步驟1: 開啟Extension
      // eslint-disable-next-line no-unused-vars
      const popupOpenTime = await testSuite.measureOperation('popup-open', async () => {
        await extensionController.openPopup()
      })

      // 步驟2: 檢查資料同步
      // eslint-disable-next-line no-unused-vars
      const syncTime = await testSuite.measureOperation('data-sync', async () => {
        await extensionController.clickExtractButton()
        await extensionController.waitForExtractionComplete()
      })

      // 步驟3: 檢視Overview
      // eslint-disable-next-line no-unused-vars
      const overviewTime = await testSuite.measureOperation('overview-access', async () => {
        await extensionController.clickOverviewButton()
        await testSuite.waitForPageLoad()
      })

      // eslint-disable-next-line no-unused-vars
      const performanceEnd = await testSuite.capturePerformanceBaseline()

      // Then: 驗證效能指標
      expect(popupOpenTime).toBeLessThan(500) // Popup開啟<500ms
      expect(syncTime).toBeLessThan(8000) // 小量同步<8秒
      expect(overviewTime).toBeLessThan(1000) // Overview開啟<1秒

      // 記憶體使用檢查
      // eslint-disable-next-line no-unused-vars
      const memoryUsage = performanceEnd.memory.used - performanceStart.memory.used
      expect(memoryUsage).toBeLessThan(30 * 1024 * 1024) // 記憶體增長<30MB

      // CPU使用檢查
      expect(performanceEnd.cpu.usage).toBeLessThan(0.8) // CPU使用<80%
    })

    test('應該支援多次連續使用且保持穩定', async () => {
      // Given: 準備多輪操作的測試資料
      // eslint-disable-next-line no-unused-vars
      const operationCount = 5
      // eslint-disable-next-line no-unused-vars
      const performanceHistory = []

      for (let i = 0; i < operationCount; i++) {
        // When: 執行第i輪日常操作
        // eslint-disable-next-line no-unused-vars
        const roundStart = Date.now()
        // eslint-disable-next-line no-unused-vars
        const startMemory = await testSuite.getMemoryUsage()

        // 準備這一輪的新書籍
        // eslint-disable-next-line no-unused-vars
        const newBooks = testDataGenerator.generateBooks(10, `round-${i}`)
        await testSuite.setupMockReadmooPage()
        await testSuite.injectMockBooks([...newBooks,
          ...testDataGenerator.generateBooks(200 + i * 10, 'existing-data')])

        // 執行同步
        await extensionController.openPopup()
        await extensionController.clickExtractButton()
        await extensionController.waitForExtractionComplete()

        // eslint-disable-next-line no-unused-vars
        const roundEnd = Date.now()
        // eslint-disable-next-line no-unused-vars
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
      // eslint-disable-next-line no-unused-vars
      const avgExecutionTime = performanceHistory.reduce((sum, record) =>
        sum + record.executionTime, 0) / operationCount
      expect(avgExecutionTime).toBeLessThan(10000) // 平均執行時間<10秒

      // 驗證最後一輪不比第一輪慢太多
      // eslint-disable-next-line no-unused-vars
      const firstRoundTime = performanceHistory[0].executionTime
      // eslint-disable-next-line no-unused-vars
      const lastRoundTime = performanceHistory[operationCount - 1].executionTime
      expect(lastRoundTime).toBeLessThan(firstRoundTime * 1.5) // 不超過首輪1.5倍

      // 驗證記憶體使用穩定
      // eslint-disable-next-line no-unused-vars
      const memoryUsages = performanceHistory.map(record => record.memoryUsage)
      // eslint-disable-next-line no-unused-vars
      const maxMemoryUsage = Math.max(...memoryUsages)
      expect(maxMemoryUsage).toBeLessThan(50 * 1024 * 1024) // 單輪記憶體<50MB

      // 驗證資料一致性
      // eslint-disable-next-line no-unused-vars
      const finalState = await extensionController.getStorageData()
      expect(finalState.books.length).toBe(250) // 200 + 5*10
    })
  })
})
