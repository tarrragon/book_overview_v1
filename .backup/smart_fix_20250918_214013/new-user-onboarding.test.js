/**
 * 新手首次使用工作流程整合測試
 *
 * 測試目標：
 * - 驗證使用者首次安裝和使用Extension的完整流程
 * - 確保權限設定、初次資料提取、UI顯示等步驟正確執行
 * - 檢查新手引導和錯誤處理機制
 */

const { E2ETestSuite } = require('../../helpers/e2e-test-suite')
const { TestDataGenerator } = require('../../helpers/test-data-generator')
const { PerformanceMonitor } = require('../../helpers/performance-monitor')

describe('新手首次使用工作流程整合測試', () => {
  let testSuite
  let extensionController
  let testDataGenerator
  let performanceMonitor

  beforeAll(async () => {
    testSuite = new E2ETestSuite({
      headless: process.env.CI !== 'false',
      slowMo: 50,
      testDataSize: 'small' // 新手測試使用小型資料集
    })

    await testSuite.setup()
    extensionController = testSuite.extensionController
    testDataGenerator = new TestDataGenerator()
    performanceMonitor = new PerformanceMonitor()
  })

  afterAll(async () => {
    await testSuite.cleanup()
  })

  beforeEach(async () => {
    // 清理所有狀態，模擬全新安裝
    await testSuite.clearAllStorageData()
    await testSuite.resetExtensionState()
    performanceMonitor.startTracking()
  })

  afterEach(async () => {
    const performanceResult = performanceMonitor.stopTracking()
    console.log('Performance metrics:', performanceResult)
  })

  describe('Given 使用者首次安裝Chrome Extension', () => {
    test('應該顯示歡迎訊息和初始化狀態', async () => {
      // When: 首次開啟Extension Popup
      const popupState = await extensionController.openPopup()

      // Then: 應該顯示歡迎訊息和空資料狀態
      expect(popupState.isFirstTime).toBe(true)
      expect(popupState.bookCount).toBe(0)
      expect(popupState.welcomeMessageVisible).toBe(true)
      expect(popupState.extractButtonEnabled).toBe(true)
    })

    test('應該正確檢測Readmoo頁面環境', async () => {
      // Given: 導航到模擬Readmoo頁面
      await testSuite.navigateToMockReadmooPage()

      // When: Extension檢測頁面環境
      const detectionResult = await extensionController.detectPageEnvironment()

      // Then: 應該正確識別Readmoo環境
      expect(detectionResult.isReadmooPage).toBe(true)
      expect(detectionResult.pageType).toBe('library')
      expect(detectionResult.extractionPossible).toBe(true)
    })
  })

  describe('When 使用者執行初次資料提取', () => {
    test('應該完整執行首次提取工作流程', async () => {
      // Given: 準備測試資料和Readmoo頁面
      const testBooks = testDataGenerator.generateBooks(50, 'new-user')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testBooks)

      // When: 執行完整的首次提取流程
      await extensionController.openPopup()

      // 步驟1: 點擊提取按鈕
      const extractionStarted = await extensionController.clickExtractButton()
      expect(extractionStarted.success).toBe(true)

      // 步驟2: 監控提取進度
      const progressUpdates = []
      const progressSubscription = await extensionController.subscribeToProgress((progress) => {
        progressUpdates.push(progress)
      })

      // 步驟3: 等待提取完成
      const extractionResult = await extensionController.waitForExtractionComplete({
        timeout: 30000, // 30秒超時
        expectedBookCount: 50
      })

      progressSubscription.unsubscribe()

      // Then: 驗證提取結果
      expect(extractionResult.success).toBe(true)
      expect(extractionResult.extractedCount).toBe(50)
      expect(extractionResult.errors.length).toBe(0)

      // 驗證進度更新
      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates[progressUpdates.length - 1].completed).toBe(true)

      // 驗證最終狀態
      const finalState = await extensionController.getPopupState()
      expect(finalState.bookCount).toBe(50)
      expect(finalState.lastExtraction).toBeDefined()
      expect(finalState.overviewButtonEnabled).toBe(true)
    })

    test('應該正確處理提取過程中的進度顯示', async () => {
      // Given: 準備較大資料集以觀察進度變化
      const testBooks = testDataGenerator.generateBooks(100, 'progress-test')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testBooks)

      await extensionController.openPopup()

      // When: 開始提取並監控進度
      const progressHistory = []
      const progressSubscription = await extensionController.subscribeToProgress((progress) => {
        progressHistory.push({
          ...progress,
          timestamp: Date.now()
        })
      })

      await extensionController.clickExtractButton()
      await extensionController.waitForExtractionComplete()
      progressSubscription.unsubscribe()

      // Then: 驗證進度更新的正確性
      expect(progressHistory.length).toBeGreaterThan(5) // 至少5次進度更新

      // 驗證進度遞增
      for (let i = 1; i < progressHistory.length; i++) {
        expect(progressHistory[i].processedCount)
          .toBeGreaterThanOrEqual(progressHistory[i - 1].processedCount)
      }

      // 驗證最終進度
      const finalProgress = progressHistory[progressHistory.length - 1]
      expect(finalProgress.processedCount).toBe(100)
      expect(finalProgress.totalCount).toBe(100)
      expect(finalProgress.completed).toBe(true)

      // 驗證進度更新頻率（至少每2秒一次）
      const timeIntervals = []
      for (let i = 1; i < progressHistory.length; i++) {
        timeIntervals.push(progressHistory[i].timestamp - progressHistory[i - 1].timestamp)
      }
      const avgInterval = timeIntervals.reduce((sum, interval) => sum + interval, 0) / timeIntervals.length
      expect(avgInterval).toBeLessThan(2000) // 平均間隔小於2秒
    })
  })

  describe('Then 應該完成權限設定、首次資料提取、Popup介面正常顯示', () => {
    test('應該正確設定和驗證Extension權限', async () => {
      // Given: 首次安裝的Extension
      const initialPermissions = await extensionController.checkPermissions()

      // When: 請求必要權限
      const permissionRequest = await extensionController.requestPermissions([
        'storage',
        'activeTab',
        'tabs'
      ])

      // Then: 驗證權限已正確授予
      expect(permissionRequest.granted).toBe(true)
      expect(permissionRequest.permissions).toContain('storage')
      expect(permissionRequest.permissions).toContain('activeTab')
      expect(permissionRequest.permissions).toContain('tabs')

      // 驗證權限狀態更新
      const updatedPermissions = await extensionController.checkPermissions()
      expect(updatedPermissions.hasRequiredPermissions).toBe(true)
    })

    test('應該正確初始化Storage和狀態管理', async () => {
      // Given: 全新的Extension環境
      await testSuite.clearAllStorageData()

      // When: 執行初次提取
      const testBooks = testDataGenerator.generateBooks(20, 'storage-test')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testBooks)

      await extensionController.openPopup()
      await extensionController.clickExtractButton()
      await extensionController.waitForExtractionComplete()

      // Then: 驗證Storage狀態
      const storageData = await extensionController.getStorageData()
      expect(storageData.books).toBeDefined()
      expect(storageData.books.length).toBe(20)
      expect(storageData.metadata).toBeDefined()
      expect(storageData.metadata.version).toBeDefined()
      expect(storageData.metadata.firstInstall).toBeDefined()

      // 驗證資料結構完整性
      storageData.books.forEach(book => {
        expect(book.id).toBeDefined()
        expect(book.title).toBeDefined()
        expect(book.extractedAt).toBeDefined()
      })
    })

    test('應該在首次提取後提供Overview頁面訪問', async () => {
      // Given: 成功完成首次提取
      const testBooks = testDataGenerator.generateBooks(30, 'overview-test')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testBooks)

      await extensionController.openPopup()
      await extensionController.clickExtractButton()
      await extensionController.waitForExtractionComplete()

      // When: 點擊檢視詳細資料按鈕
      const overviewOpened = await extensionController.clickOverviewButton()

      // Then: 驗證Overview頁面正確開啟
      expect(overviewOpened.success).toBe(true)
      expect(overviewOpened.pageUrl).toContain('overview')

      // 等待Overview頁面載入
      await testSuite.waitForPageLoad(overviewOpened.pageUrl)

      // 驗證Overview頁面內容
      const overviewData = await testSuite.getOverviewPageData()
      expect(overviewData.bookCount).toBe(30)
      expect(overviewData.booksDisplayed.length).toBe(30)
      expect(overviewData.searchFunctionality).toBe(true)
      expect(overviewData.exportFunctionality).toBe(true)
    })
  })

  describe('錯誤處理和邊界情況', () => {
    test('應該處理Readmoo頁面無書籍的情況', async () => {
      // Given: 空白的Readmoo頁面
      await testSuite.setupMockReadmooPage()
      // 不注入任何書籍資料

      // When: 嘗試提取書籍
      await extensionController.openPopup()
      const extractionResult = await extensionController.clickExtractButton()

      // Then: 應該適當處理空白情況
      expect(extractionResult.success).toBe(true)
      expect(extractionResult.extractedCount).toBe(0)
      expect(extractionResult.message).toContain('未發現書籍資料')

      // 驗證UI狀態
      const popupState = await extensionController.getPopupState()
      expect(popupState.bookCount).toBe(0)
      expect(popupState.emptyStateVisible).toBe(true)
    })

    test('應該處理頁面檢測失敗的情況', async () => {
      // Given: 非Readmoo頁面
      await testSuite.navigateToPage('https://example.com')

      // When: 嘗試開啟Extension
      await extensionController.openPopup()

      // Then: 應該顯示適當的錯誤訊息
      const popupState = await extensionController.getPopupState()
      expect(popupState.pageDetectionError).toBe(true)
      expect(popupState.errorMessage).toContain('Readmoo')
      expect(popupState.extractButtonEnabled).toBe(false)
    })

    test('應該處理網路中斷的情況', async () => {
      // Given: 準備測試環境
      const testBooks = testDataGenerator.generateBooks(50, 'network-test')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testBooks)

      await extensionController.openPopup()

      // When: 開始提取後模擬網路中斷
      await extensionController.clickExtractButton()

      // 等待部分進度完成
      await testSuite.waitForTimeout(2000)

      // 模擬網路中斷
      await testSuite.simulateNetworkDisconnection()

      // Then: 應該檢測到網路問題並提供重試選項
      const errorState = await extensionController.waitForErrorState({
        timeout: 10000,
        expectedError: 'NETWORK_ERROR'
      })

      expect(errorState.errorType).toBe('NETWORK_ERROR')
      expect(errorState.retryButtonVisible).toBe(true)
      expect(errorState.errorMessage).toContain('網路')

      // 測試重試功能
      await testSuite.restoreNetworkConnection()
      const retryResult = await extensionController.clickRetryButton()

      expect(retryResult.success).toBe(true)
      await extensionController.waitForExtractionComplete()

      const finalState = await extensionController.getPopupState()
      expect(finalState.bookCount).toBe(50)
    })
  })

  describe('效能和使用者體驗驗證', () => {
    test('首次提取應該在效能基準內完成', async () => {
      // Given: 中型資料集 (新手可能遇到的合理數量)
      const testBooks = testDataGenerator.generateBooks(100, 'performance-test')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testBooks)

      // When: 執行提取並監控效能
      const startTime = Date.now()
      const startMemory = await testSuite.getMemoryUsage()

      await extensionController.openPopup()
      await extensionController.clickExtractButton()
      await extensionController.waitForExtractionComplete()

      const endTime = Date.now()
      const endMemory = await testSuite.getMemoryUsage()

      // Then: 驗證效能指標
      const executionTime = endTime - startTime
      const memoryUsage = endMemory.used - startMemory.used

      expect(executionTime).toBeLessThan(15000) // 100本書應在15秒內完成
      expect(memoryUsage).toBeLessThan(50 * 1024 * 1024) // 記憶體增長<50MB

      // 驗證UI響應性
      const responseTime = await extensionController.measureButtonResponseTime()
      expect(responseTime).toBeLessThan(100) // 按鈕響應<100ms
    })

    test('應該提供流暢的使用者體驗', async () => {
      // Given: 標準測試環境
      const testBooks = testDataGenerator.generateBooks(50, 'ux-test')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testBooks)

      // When: 執行完整工作流程並監控UX指標
      const uxMonitor = testSuite.createUXMonitor()

      await extensionController.openPopup()
      const popupLoadTime = uxMonitor.measurePopupLoadTime()

      await extensionController.clickExtractButton()
      const buttonResponseTime = uxMonitor.measureButtonResponseTime()

      await extensionController.waitForExtractionComplete()
      const progressSmoothness = uxMonitor.measureProgressSmoothness()

      // Then: 驗證UX指標
      expect(popupLoadTime).toBeLessThan(500) // Popup載入<500ms
      expect(buttonResponseTime).toBeLessThan(100) // 按鈕響應<100ms
      expect(progressSmoothness.frameDrops).toBeLessThan(5) // 掉幀<5次
      expect(progressSmoothness.smoothnessScore).toBeGreaterThan(0.9) // 流暢度>90%
    })
  })
})
