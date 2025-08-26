/**
 * UC-01 完整資料提取工作流程端到端整合測試
 *
 * 測試目標：驗證從使用者點擊Extension到資料持久化儲存的完整鏈路
 * 涵蓋範圍：正常流程、邊界條件、異常處理、效能驗證
 *
 * @author TDD Phase 2 - sage-test-architect
 * @date 2025-08-25
 * @version v0.9.38
 */

const E2EIntegrationTestCoordinator = require('../../helpers/e2e-integration-test-coordinator')
const ChromeExtensionEnvironmentSimulator = require('../../helpers/chrome-extension-environment-simulator')
const ReadmooPageSimulator = require('../../helpers/readmoo-page-simulator')
const EventFlowValidator = require('../../helpers/event-flow-validator')
const E2ETestDataGenerator = require('../../helpers/e2e-test-data-generator')

describe('UC-01 Complete Extraction Workflow E2E Tests', () => {
  let coordinator
  let extensionSimulator
  let pageSimulator
  let eventValidator
  let dataGenerator

  beforeEach(async () => {
    // 初始化E2E測試協調器
    coordinator = new E2EIntegrationTestCoordinator()

    // 設置各種模擬器
    extensionSimulator = new ChromeExtensionEnvironmentSimulator()
    pageSimulator = new ReadmooPageSimulator()
    eventValidator = new EventFlowValidator()
    dataGenerator = new E2ETestDataGenerator()

    // 初始化測試環境
    await coordinator.initializeTestEnvironment({
      extensionSimulator,
      pageSimulator,
      eventValidator,
      dataGenerator
    })
  })

  afterEach(async () => {
    // 清理測試環境
    await coordinator.cleanupTestEnvironment()

    // 重置所有Mock狀態
    extensionSimulator.reset()
    pageSimulator.cleanup()
    eventValidator.clearEventHistory()
    dataGenerator.clearCache()
  })

  describe('Phase 1: Environment and Initialization Tests', () => {
    test('TC-E2E-INIT-001: E2E測試環境正確設置', async () => {
      // Given: E2E測試協調器已初始化
      const testConfig = {
        extensionId: 'test-extension-id',
        testMode: true,
        mockEnvironment: true
      }

      // When: 設置測試環境
      const environment = await coordinator.initializeTestEnvironment(testConfig)

      // Then: 環境設置完成且各組件正常運作
      expect(environment).toBeDefined()
      expect(environment.extensionContext).toBeDefined()
      expect(environment.pageContext).toBeDefined()
      expect(environment.eventSystem).toBeDefined()
      expect(environment.dataValidation).toBeDefined()
    })

    test('TC-E2E-INIT-002: Chrome Extension環境模擬準確性', async () => {
      // Given: Chrome Extension環境模擬器已設置
      const extensionConfig = {
        manifestVersion: 3,
        permissions: ['storage', 'activeTab'],
        version: '1.0.0'
      }

      // When: 設置Extension上下文
      extensionSimulator.setupExtensionContext(extensionConfig)

      // Then: Chrome API Mock正確設置
      expect(global.chrome).toBeDefined()
      expect(global.chrome.storage.local).toBeDefined()
      expect(global.chrome.runtime.sendMessage).toBeDefined()
      expect(global.chrome.tabs.query).toBeDefined()

      // 驗證權限設置正確
      const permissions = await extensionSimulator.checkPermissions(['storage', 'activeTab'])
      expect(permissions.storage).toBe(true)
      expect(permissions.activeTab).toBe(true)
    })

    test('TC-E2E-INIT-003: Readmoo頁面模擬器DOM結構正確性', async () => {
      // Given: 測試書籍資料
      const testBooks = dataGenerator.generateBookCollection({
        count: 15,
        includeEdgeCases: true
      })

      // When: 創建模擬書庫頁面
      const mockPage = pageSimulator.createMockShelfPage(testBooks)

      // Then: DOM結構符合真實Readmoo頁面
      expect(mockPage.querySelector('.shelf-container')).toBeDefined()
      expect(mockPage.querySelectorAll('.book-item')).toHaveLength(15)

      // 驗證書籍元素包含必要屬性
      const firstBook = mockPage.querySelector('.book-item')
      expect(firstBook.querySelector('.book-title')).toBeDefined()
      expect(firstBook.querySelector('.book-cover img')).toBeDefined()
      expect(firstBook.querySelector('.reading-progress')).toBeDefined()
    })

    test('TC-E2E-INIT-004: 事件追蹤系統初始化', async () => {
      // Given: 預期事件序列
      const expectedEvents = [
        'POPUP.OPENED',
        'EXTRACTOR.REQUEST.STARTED',
        'CONTENT_SCRIPT.INJECTION.COMPLETED',
        'EXTRACTOR.PROGRESS.UPDATED',
        'EXTRACTOR.DATA.EXTRACTED',
        'STORAGE.SAVE.COMPLETED'
      ]

      // When: 註冊事件序列追蹤
      eventValidator.registerEventSequenceTracking(expectedEvents)

      // Then: 事件監聽器正確設置
      expect(eventValidator.isTrackingActive()).toBe(true)
      expect(eventValidator.getExpectedEventCount()).toBe(6)
      expect(eventValidator.getRegisteredEventTypes()).toEqual(expectedEvents)
    })

    test('TC-E2E-INIT-005: 測試資料產生器功能驗證', async () => {
      // Given: 不同類型的資料生成需求
      const dataConfigs = {
        normal: { count: 20, type: 'normal' },
        edgeCase: { count: 5, type: 'edgeCase' },
        performance: { count: 500, type: 'performance' }
      }

      // When: 生成各種測試資料
      const normalData = dataGenerator.generateBookCollection(dataConfigs.normal)
      const edgeCaseData = dataGenerator.generateBookCollection(dataConfigs.edgeCase)
      const performanceData = dataGenerator.generateBookCollection(dataConfigs.performance)

      // Then: 資料生成符合預期
      expect(normalData).toHaveLength(20)
      expect(edgeCaseData).toHaveLength(5)
      expect(performanceData).toHaveLength(500)

      // 驗證邊界案例資料包含特殊情況
      const hasUnicodeTitle = edgeCaseData.some(book => /[\u{1F600}-\u{1F64F}]/u.test(book.title))
      const hasLongTitle = edgeCaseData.some(book => book.title.length > 100)
      expect(hasUnicodeTitle || hasLongTitle).toBe(true)
    })

    test('TC-E2E-INIT-006: Mock清理機制有效性', async () => {
      // Given: 測試環境已設置並產生狀態
      await coordinator.setupTestState({
        books: dataGenerator.generateBookCollection({ count: 10 }),
        events: ['TEST.EVENT.FIRED'],
        storage: { testKey: 'testValue' }
      })

      // When: 執行清理機制
      await coordinator.cleanupTestEnvironment()

      // Then: 所有測試狀態被正確清理
      expect(global.testState).toBeUndefined()
      expect(document.querySelectorAll('.book-item')).toHaveLength(0)

      // 驗證Chrome Storage被清理
      const storageData = await new Promise(resolve => {
        global.chrome.storage.local.get(null, resolve)
      })
      expect(Object.keys(storageData)).toHaveLength(0)
    })
  })

  describe('Phase 2: Normal Workflow Tests', () => {
    test('TC-E2E-001: 完整UC-01工作流程端到端驗證', async () => {
      // Given: 使用者在Readmoo書庫頁面，Extension已安裝且正常運作
      const testScenario = dataGenerator.generateTestScenario('normalWorkflow')
      const mockBooks = dataGenerator.generateBookCollection({ count: 15 })

      // 設置測試環境
      await coordinator.setupTestScenario(testScenario)
      pageSimulator.createMockShelfPage(mockBooks)
      extensionSimulator.setupExtensionContext(testScenario.extensionContext)

      // When: 使用者執行完整的資料提取流程
      const workflowResult = await coordinator.executeUC01Workflow(testScenario)

      // Then: 系統正確完成資料提取並持久化儲存
      expect(workflowResult.success).toBe(true)
      expect(workflowResult.booksExtracted).toBe(15)
      expect(workflowResult.dataStoredSuccessfully).toBe(true)
      expect(workflowResult.userFeedbackDisplayed).toBe(true)
      expect(workflowResult.extractionTime).toBeLessThan(3000) // < 3秒
      expect(workflowResult.memoryUsage).toBeLessThan(50 * 1024 * 1024) // < 50MB
    })

    test('TC-E2E-002: 事件序列正確性和時序驗證', async () => {
      // Given: E2E測試環境已設置完成，事件追蹤器已啟動
      const expectedEventSequence = [
        'POPUP.OPENED',
        'EXTRACTOR.REQUEST.STARTED',
        'CONTENT_SCRIPT.INJECTION.COMPLETED',
        'EXTRACTOR.PROGRESS.UPDATED',
        'EXTRACTOR.DATA.EXTRACTED',
        'STORAGE.SAVE.STARTED',
        'STORAGE.SAVE.COMPLETED',
        'UI.SUCCESS.DISPLAYED'
      ]

      eventValidator.registerEventSequenceTracking(expectedEventSequence)

      const testScenario = dataGenerator.generateTestScenario('eventSequence')

      // When: 執行完整UC-01工作流程
      await coordinator.executeUC01Workflow(testScenario)

      // Then: 事件按照預期順序發生，時間間隔合理，無遺漏或重複
      const eventFlowResult = eventValidator.validateEventFlow()

      expect(eventFlowResult.sequenceCorrect).toBe(true)
      expect(eventFlowResult.timingAppropriate).toBe(true)
      expect(eventFlowResult.allEventsReceived).toBe(true)
      expect(eventFlowResult.noDuplicateEvents).toBe(true)

      // 驗證事件時序合理性
      const eventTimings = eventValidator.getEventTimings()
      expect(eventTimings.totalDuration).toBeLessThan(5000) // 總時間 < 5秒
      expect(eventTimings.averageInterval).toBeLessThan(1000) // 平均間隔 < 1秒
    })

    test('TC-E2E-003: 資料完整性和準確性驗證', async () => {
      // Given: Mock Readmoo頁面包含各種類型的書籍資料
      const mockBookData = [
        { type: 'normal', hasProgress: true, hasSpecialChars: false },
        { type: 'unicode', hasProgress: false, hasSpecialChars: true },
        { type: 'longTitle', hasProgress: true, hasSpecialChars: false },
        { type: 'missingCover', hasProgress: false, hasSpecialChars: false }
      ]

      const testBooks = dataGenerator.generateMixedBookCollection(mockBookData)
      pageSimulator.createMockShelfPage(testBooks)

      // When: 執行資料提取流程
      const testScenario = dataGenerator.generateTestScenario('dataIntegrity')
      const extractionResult = await coordinator.executeUC01Workflow(testScenario)

      // Then: 提取資料與原始頁面資料100%一致，資料結構完整，特殊字符正確保留
      const dataValidationResult = coordinator.validateExtractedDataIntegrity(
        extractionResult.extractedData,
        testBooks
      )

      expect(dataValidationResult.dataMatchRate).toBe(100)
      expect(dataValidationResult.structureComplete).toBe(true)
      expect(dataValidationResult.specialCharsPreserved).toBe(true)
      expect(dataValidationResult.noDataLoss).toBe(true)
    })

    test('TC-E2E-004: Chrome Extension多上下文通訊驗證', async () => {
      // Given: Extension的三個主要上下文已設置
      const contexts = ['popup', 'background', 'contentScript']

      contexts.forEach(context => {
        extensionSimulator.setupContext(context)
      })

      // When: 執行跨上下文通訊流程
      const communicationTest = await coordinator.testCrossContextCommunication(contexts)

      // Then: 所有上下文間通訊正常，訊息傳遞無遺漏
      expect(communicationTest.popupToBackground).toBe(true)
      expect(communicationTest.backgroundToContentScript).toBe(true)
      expect(communicationTest.contentScriptToBackground).toBe(true)
      expect(communicationTest.backgroundToPopup).toBe(true)

      // 驗證訊息傳遞時延合理
      expect(communicationTest.averageLatency).toBeLessThan(100) // < 100ms
    })

    test('TC-E2E-005: PopupController與UI互動驗證', async () => {
      // Given: Popup視窗已開啟且PopupController已初始化
      const popupInstance = await extensionSimulator.openPopupWindow({
        tabId: 1,
        url: 'https://readmoo.com/shelf'
      })

      // When: 使用者與Popup UI進行互動
      const uiInteractions = [
        { type: 'click', target: '#extractButton' },
        { type: 'wait', duration: 1000 },
        { type: 'verify', target: '.progress-bar' },
        { type: 'wait', duration: 2000 },
        { type: 'verify', target: '.success-message' }
      ]

      const uiTestResult = await coordinator.executeUIInteractionSequence(
        popupInstance,
        uiInteractions
      )

      // Then: UI回應正確，狀態轉換符合預期
      expect(uiTestResult.allInteractionsSuccessful).toBe(true)
      expect(uiTestResult.stateTransitionsCorrect).toBe(true)
      expect(uiTestResult.visualFeedbackAppropriate).toBe(true)
    })

    test('TC-E2E-006: BookDataExtractor資料處理驗證', async () => {
      // Given: 書庫頁面包含各種格式的書籍資料
      const complexBookData = dataGenerator.generateComplexBookCollection({
        includeProgressVariations: true,
        includeMetadataVariations: true,
        includeFormatVariations: true
      })

      pageSimulator.createMockShelfPage(complexBookData)

      // When: BookDataExtractor進行資料提取和處理
      const extractorTest = await coordinator.testBookDataExtraction()

      // Then: 資料提取準確，處理邏輯正確
      expect(extractorTest.extractionAccuracy).toBeGreaterThan(95)
      expect(extractorTest.dataNormalizationCorrect).toBe(true)
      expect(extractorTest.idGenerationConsistent).toBe(true)
      expect(extractorTest.metadataComplete).toBe(true)
    })

    test('TC-E2E-007: ChromeStorageAdapter儲存操作驗證', async () => {
      // Given: 要儲存的書籍資料和現有儲存狀態
      const booksToStore = dataGenerator.generateBookCollection({ count: 20 })
      const existingData = dataGenerator.generateExistingStorageData({ count: 5 })

      // 設置現有儲存狀態
      await coordinator.setupStorageState(existingData)

      // When: 執行儲存操作
      const storageTest = await coordinator.testStorageOperations(booksToStore)

      // Then: 資料正確儲存，去重邏輯正確執行
      expect(storageTest.saveOperationSuccessful).toBe(true)
      expect(storageTest.deduplicationCorrect).toBe(true)
      expect(storageTest.metadataUpdated).toBe(true)
      expect(storageTest.totalBooksInStorage).toBe(25) // 20 new + 5 existing
    })

    test('TC-E2E-008: 使用者回饋和狀態顯示驗證', async () => {
      // Given: 完整的資料提取流程
      const testScenario = dataGenerator.generateTestScenario('userFeedback')

      // When: 執行工作流程並監控使用者介面
      const feedbackTest = await coordinator.testUserFeedbackSystem(testScenario)

      // Then: 使用者回饋清楚、及時、準確
      expect(feedbackTest.progressIndicatorWorking).toBe(true)
      expect(feedbackTest.statusMessagesAppropriate).toBe(true)
      expect(feedbackTest.successNotificationDisplayed).toBe(true)
      expect(feedbackTest.bookCountDisplayedCorrectly).toBe(true)
      expect(feedbackTest.userExperienceSmooth).toBe(true)
    })
  })

  describe('Phase 3: Boundary Condition Tests', () => {
    test('TC-E2E-B001: 空書庫頁面優雅處理驗證', async () => {
      // Given: Readmoo頁面不包含任何書籍資料
      const emptyShelfScenario = {
        pageContext: {
          url: 'https://readmoo.com/shelf',
          bookCount: 0,
          bookElements: []
        }
      }

      pageSimulator.createEmptyShelfPage()

      // When: 執行資料提取流程
      const emptyShelfResult = await coordinator.executeUC01Workflow(emptyShelfScenario)

      // Then: 系統優雅處理空書庫情況，顯示適當訊息，不產生錯誤
      expect(emptyShelfResult.extractionCompleted).toBe(true)
      expect(emptyShelfResult.booksExtracted).toBe(0)
      expect(emptyShelfResult.messageDisplayed).toContain('未找到書籍')
      expect(emptyShelfResult.noErrors).toBe(true)
      expect(emptyShelfResult.gracefulHandling).toBe(true)
    })

    test('TC-E2E-B002: 大量書籍處理效能驗證', async () => {
      // Given: 頁面包含大量書籍資料 (500+ books)
      const largeBooksScenario = {
        pageContext: {
          bookCount: 500,
          totalDataSize: '2MB',
          pageComplexity: 'high'
        }
      }

      const largeBookCollection = dataGenerator.generateBookCollection({
        count: 500,
        type: 'performance'
      })
      pageSimulator.createMockShelfPage(largeBookCollection)

      // When: 執行資料提取流程
      const startTime = Date.now()
      const performanceResult = await coordinator.executeUC01Workflow(largeBooksScenario)
      const endTime = Date.now()

      // Then: 系統在效能限制內完成處理，記憶體使用合理，提供進度回饋
      expect(performanceResult.extractionTimeUnder30Seconds).toBe(true)
      expect(endTime - startTime).toBeLessThan(30000) // < 30秒
      expect(performanceResult.memoryUsageUnder100MB).toBe(true)
      expect(performanceResult.progressUpdatesProvided).toBe(true)
      expect(performanceResult.uiRemainResponsive).toBe(true)
    })

    test('TC-E2E-B003: 快速重複操作防護驗證', async () => {
      // Given: 使用者快速多次點擊提取按鈕
      const rapidClickScenario = {
        userBehavior: 'rapidButtonClicks',
        clickInterval: 100, // 100ms間隔
        clickCount: 5
      }

      const popupInstance = await extensionSimulator.openPopupWindow({ tabId: 1 })

      // When: 模擬快速連續點擊行為
      const rapidClickResult = await coordinator.testRapidUserActions(
        popupInstance,
        rapidClickScenario
      )

      // Then: 系統防止重複提取，只執行一次提取操作，UI適當反饋
      expect(rapidClickResult.singleExtractionOnly).toBe(true)
      expect(rapidClickResult.buttonDisabledDuringExtraction).toBe(true)
      expect(rapidClickResult.userFeedbackClear).toBe(true)
      expect(rapidClickResult.noMultipleOperations).toBe(true)
    })

    test('TC-E2E-B004: 特殊字符和Unicode處理驗證', async () => {
      // Given: 書籍資料包含各種特殊字符和Unicode字符
      const specialCharBooks = dataGenerator.generateSpecialCharacterBooks({
        includeEmojis: true,
        includeUnicode: true,
        includeHtmlEntities: true,
        includeCJKCharacters: true
      })

      pageSimulator.createMockShelfPage(specialCharBooks)

      // When: 執行資料提取流程
      const testScenario = dataGenerator.generateTestScenario('specialCharacters')
      const specialCharResult = await coordinator.executeUC01Workflow(testScenario)

      // Then: 特殊字符正確保留，Unicode字符無損失，資料完整性維持
      expect(specialCharResult.specialCharsPreserved).toBe(true)
      expect(specialCharResult.unicodeIntegrityMaintained).toBe(true)
      expect(specialCharResult.noCharacterCorruption).toBe(true)
      expect(specialCharResult.encodingCorrect).toBe(true)
    })

    test('TC-E2E-B005: 長標題和異常資料處理驗證', async () => {
      // Given: 書籍資料包含異常長的標題和缺失資料
      const edgeCaseBooks = dataGenerator.generateEdgeCaseBooks({
        longTitles: true,
        missingData: true,
        corruptedData: true,
        oversizedData: true
      })

      pageSimulator.createMockShelfPage(edgeCaseBooks)

      // When: 執行資料提取流程
      const testScenario = dataGenerator.generateTestScenario('edgeCaseData')
      const edgeCaseResult = await coordinator.executeUC01Workflow(testScenario)

      // Then: 異常資料得到適當處理，系統保持穩定
      expect(edgeCaseResult.longTitlesHandled).toBe(true)
      expect(edgeCaseResult.missingDataCompensated).toBe(true)
      expect(edgeCaseResult.corruptedDataFiltered).toBe(true)
      expect(edgeCaseResult.systemStabilityMaintained).toBe(true)
    })

    test('TC-E2E-B006: 記憶體使用和效能限制驗證', async () => {
      // Given: 多種資料量級的測試場景
      const memoryTestScenarios = [
        { name: 'small', bookCount: 50, expectedMemory: 20 * 1024 * 1024 },
        { name: 'medium', bookCount: 200, expectedMemory: 40 * 1024 * 1024 },
        { name: 'large', bookCount: 500, expectedMemory: 80 * 1024 * 1024 }
      ]

      // When & Then: 對每個場景進行記憶體使用驗證
      for (const scenario of memoryTestScenarios) {
        const testBooks = dataGenerator.generateBookCollection({ count: scenario.bookCount })
        pageSimulator.createMockShelfPage(testBooks)

        const memoryBefore = coordinator.getCurrentMemoryUsage()
        const testScenario = dataGenerator.generateTestScenario('memoryTest')
        await coordinator.executeUC01Workflow(testScenario)
        const memoryAfter = coordinator.getCurrentMemoryUsage()

        const memoryUsed = memoryAfter - memoryBefore
        expect(memoryUsed).toBeLessThan(scenario.expectedMemory)

        // 清理記憶體以準備下一個測試
        await coordinator.performMemoryCleanup()
      }
    })
  })

  describe('Phase 4: Exception Handling Tests', () => {
    test('TC-E2E-E001: Chrome Extension權限錯誤處理驗證', async () => {
      // Given: Chrome Extension缺少必要權限或權限被撤銷
      const permissionErrorScenario = {
        permissions: {
          storage: false,
          activeTab: false
        },
        errorCondition: 'permissionDenied'
      }

      extensionSimulator.revokePermissions(['storage', 'activeTab'])

      // When: 嘗試執行資料提取流程
      const permissionErrorResult = await coordinator.executeUC01Workflow(
        permissionErrorScenario
      )

      // Then: 系統優雅處理權限錯誤，提供清楚錯誤訊息和解決建議
      expect(permissionErrorResult.errorDetected).toBe(true)
      expect(permissionErrorResult.userMessageClear).toBe(true)
      expect(permissionErrorResult.recoveryOptionsProvided).toBe(true)
      expect(permissionErrorResult.noSystemCrash).toBe(true)
      expect(permissionErrorResult.errorType).toBe('PERMISSION_DENIED')
    })

    test('TC-E2E-E002: 網路連接中斷和恢復驗證', async () => {
      // Given: 資料提取過程中網路連接中斷
      const networkErrorScenario = {
        errorType: 'networkInterruption',
        errorTiming: 'duringExtraction',
        errorDuration: 3000 // 3秒中斷
      }

      // When: 模擬網路中斷和恢復
      const networkTest = await coordinator.testNetworkResilience(networkErrorScenario)

      // Then: 系統成功恢復並完成資料提取，或提供適當的錯誤處理
      expect(networkTest.autoRetryAttempted).toBe(true)
      expect(networkTest.finalResultCorrect).toBe(true)
      expect(networkTest.userInformedOfRecovery).toBe(true)
      expect(networkTest.gracefulDegradation).toBe(true)
    })

    test('TC-E2E-E003: DOM結構變更適應性驗證', async () => {
      // Given: Readmoo頁面DOM結構發生變更
      const domChangeScenario = {
        changeType: 'selectorModification',
        affectedElements: ['bookTitle', 'bookCover', 'readingProgress'],
        changeImpact: 'partial'
      }

      // 創建初始頁面後修改DOM結構
      const initialBooks = dataGenerator.generateBookCollection({ count: 10 })
      pageSimulator.createMockShelfPage(initialBooks)
      pageSimulator.modifyDOMStructure(domChangeScenario)

      // When: 執行資料提取時遇到DOM結構變更
      const domAdaptationResult = await coordinator.executeUC01Workflow(
        domChangeScenario
      )

      // Then: 系統偵測變更，提供fallback方案或適當錯誤處理
      expect(domAdaptationResult.changeDetected).toBe(true)
      expect(domAdaptationResult.fallbackApplied).toBe(true)
      expect(domAdaptationResult.partialDataSaved).toBe(true)
      expect(domAdaptationResult.technicalDetailsLogged).toBe(true)
    })

    test('TC-E2E-E004: Chrome Storage配額超限處理驗證', async () => {
      // Given: Chrome Storage配額接近或超過限制
      const storageQuotaScenario = {
        currentUsage: 4.8 * 1024 * 1024, // 4.8MB
        totalQuota: 5 * 1024 * 1024, // 5MB
        newDataSize: 0.5 * 1024 * 1024 // 0.5MB
      }

      // 設置接近配額限制的儲存狀態
      await coordinator.setupStorageQuotaState(storageQuotaScenario)

      // When: 嘗試儲存新的書籍資料
      const quotaTestResult = await coordinator.testStorageQuotaHandling(
        storageQuotaScenario
      )

      // Then: 系統偵測配額問題，提供適當的配額管理選項
      expect(quotaTestResult.quotaExceededDetected).toBe(true)
      expect(quotaTestResult.cleanupOptionsProvided).toBe(true)
      expect(quotaTestResult.exportSuggestionOffered).toBe(true)
      expect(quotaTestResult.gracefulDegradation).toBe(true)
    })

    test('TC-E2E-E005: 系統錯誤和例外狀況恢復驗證', async () => {
      // Given: 各種系統錯誤情況
      const systemErrorScenarios = [
        { type: 'unexpectedError', source: 'BookDataExtractor' },
        { type: 'asyncOperationFailure', source: 'ChromeStorageAdapter' },
        { type: 'eventSystemFailure', source: 'EventManager' },
        { type: 'memoryOverflow', source: 'DataProcessor' }
      ]

      // When & Then: 對每種錯誤情況進行驗證
      for (const errorScenario of systemErrorScenarios) {
        const errorRecoveryResult = await coordinator.testSystemErrorRecovery(
          errorScenario
        )

        expect(errorRecoveryResult.errorCaughtGracefully).toBe(true)
        expect(errorRecoveryResult.systemRecoveredToStableState).toBe(true)
        expect(errorRecoveryResult.userNotifiedAppropriately).toBe(true)
        expect(errorRecoveryResult.noDataCorruption).toBe(true)

        // 確保系統在錯誤後能夠繼續正常運作
        const subsequentOperationResult = await coordinator.testSubsequentOperation()
        expect(subsequentOperationResult.systemFunctionalAfterError).toBe(true)
      }
    })
  })
})
