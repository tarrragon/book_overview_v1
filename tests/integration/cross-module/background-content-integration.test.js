/**
 * Background Service Worker ↔ Content Scripts 跨模組整合測試
 *
 * 測試目標：
 * - 驗證Background Service Worker與Content Scripts間的通訊完整性
 * - 確保事件傳遞、資料流轉、錯誤處理的正確性
 * - 檢查生命周期管理和狀態同步機制
 */

const { E2ETestSuite } = require('../../helpers/e2e-test-suite')
const { ChromeExtensionController } = require('../../helpers/chrome-extension-controller')
const { TestDataGenerator } = require('../../helpers/test-data-generator')
const MessageFlowTracker = require('../../helpers/message-flow-tracker')
const { LifecycleValidator } = require('../../helpers/lifecycle-validator')

describe('Background ↔ Content Script 跨模組整合測試', () => {
  let testSuite
  let extensionController
  let testDataGenerator
  let messageTracker
  let lifecycleValidator

  beforeAll(async () => {
    testSuite = new E2ETestSuite({
      headless: process.env.CI !== 'false',
      slowMo: 30,
      testDataSize: 'medium',
      enableMessageTracking: true // 啟用訊息追蹤
    })

    await testSuite.setup()
    extensionController = testSuite.extensionController
    testDataGenerator = new TestDataGenerator()
    messageTracker = new MessageFlowTracker(testSuite)
    lifecycleValidator = new LifecycleValidator()
  })

  afterAll(async () => {
    await messageTracker.cleanup()
    await testSuite.cleanup()
  })

  beforeEach(async () => {
    await testSuite.clearAllStorageData()
    await messageTracker.reset()

    // 預載入基礎資料
    const baseBooks = testDataGenerator.generateBooks(50, 'integration-test-base')
    await testSuite.loadInitialData({ books: baseBooks })
  })

  describe('Background Service Worker 生命周期管理', () => {
    test('應該正確管理Service Worker的啟動和休眠', async () => {
      // Given: 檢查Service Worker初始狀態
      const initialState = await extensionController.getBackgroundServiceWorkerState()
      expect(initialState.isActive).toBe(true)
      expect(initialState.uptime).toBeGreaterThan(0)

      // When: 觸發Service Worker休眠
      await extensionController.triggerServiceWorkerIdle()

      // 等待Service Worker進入休眠狀態 (約5分鐘的空閒時間)
      const dormantState = await extensionController.waitForServiceWorkerState('dormant', {
        timeout: 10000, // 在測試環境中加速
        forceTimeout: true
      })

      expect(dormantState.isActive).toBe(false)
      expect(dormantState.lastActiveTime).toBeDefined()

      // When: 透過事件喚醒Service Worker
      await testSuite.setupMockReadmooPage()
      await extensionController.openPopup()
      await extensionController.clickExtractButton()

      // Then: 驗證Service Worker正確喚醒
      const awakenState = await extensionController.waitForServiceWorkerState('active', {
        timeout: 5000
      })

      expect(awakenState.isActive).toBe(true)
      expect(awakenState.awakeningReason).toBe('extension_event')
      expect(awakenState.stateTransitionTime).toBeLessThan(3000) // 喚醒時間<3秒

      // 驗證喚醒後功能正常
      const extractionResult = await extensionController.waitForExtractionComplete()
      expect(extractionResult.success).toBe(true)
    })

    test('應該在Service Worker重啟時維持狀態一致性', async () => {
      // Given: 設置複雜的運行狀態
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(100, 'restart-test'))

      await extensionController.openPopup()

      // 開始長時間操作
      const longOperationPromise = extensionController.clickExtractButton()

      // 等待操作進行到一半
      await testSuite.waitForTimeout(3000)

      // 記錄重啟前的狀態
      const preRestartState = await extensionController.captureFullSystemState()

      // When: 強制重啟Service Worker
      await extensionController.forceServiceWorkerRestart()

      // Then: 驗證狀態恢復
      const postRestartState = await extensionController.waitForSystemStateRecovery({
        timeout: 10000,
        expectedState: preRestartState
      })

      expect(postRestartState.recovered).toBe(true)
      expect(postRestartState.dataIntegrity).toBe('maintained')
      expect(postRestartState.operationContinuity).toBe('resumed')

      // 驗證操作能夠繼續完成
      const finalResult = await longOperationPromise
      expect(finalResult.success).toBe(true)
      expect(finalResult.wasResumedAfterRestart).toBe(true)
    })
  })

  describe('Content Script 注入和初始化', () => {
    test('應該正確檢測頁面類型並注入適當的Content Script', async () => {
      // Given: 不同類型的頁面測試
      const pageTypes = [
        {
          url: 'https://readmoo.com/library',
          expectedScriptType: 'readmoo-library',
          shouldInject: true
        },
        {
          url: 'https://readmoo.com/book/12345',
          expectedScriptType: 'readmoo-book-detail',
          shouldInject: true
        },
        {
          url: 'https://example.com',
          expectedScriptType: null,
          shouldInject: false
        },
        {
          url: 'https://readmoo.com/search',
          expectedScriptType: 'readmoo-search',
          shouldInject: true
        }
      ]

      for (const pageType of pageTypes) {
        // When: 導航到特定頁面類型
        await testSuite.navigateToPage(pageType.url)

        // 觸發Content Script檢測和注入
        const injectionResult = await extensionController.triggerContentScriptInjection()

        // Then: 驗證注入結果
        if (pageType.shouldInject) {
          expect(injectionResult.injected).toBe(true)
          expect(injectionResult.scriptType).toBe(pageType.expectedScriptType)
          expect(injectionResult.injectionTime).toBeLessThan(2000) // 注入時間<2秒

          // 驗證Content Script功能性
          const scriptFunctionality = await extensionController.testContentScriptFunctionality()
          expect(scriptFunctionality.canExtractData).toBe(true)
          expect(scriptFunctionality.canCommunicateWithBackground).toBe(true)
        } else {
          expect(injectionResult.injected).toBe(false)
          expect(injectionResult.reason).toContain('不支援的頁面類型')
        }

        console.log(`✓ Page type: ${pageType.url} - ${pageType.shouldInject ? 'Injected' : 'Skipped'}`)
      }
    })

    test('應該處理Content Script注入失敗的情況', async () => {
      // Given: 模擬各種注入失敗情況
      const failureScenarios = [
        {
          name: 'CSP_VIOLATION',
          setup: async () => {
            await testSuite.navigateToCSPRestrictedPage()
          },
          expectedError: 'Content Security Policy violation',
          recoverable: false
        },
        {
          name: 'PERMISSION_DENIED',
          setup: async () => {
            await testSuite.revokeTabPermissions()
            await testSuite.navigateToMockReadmooPage()
          },
          expectedError: 'Permission denied',
          recoverable: true
        },
        {
          name: 'SCRIPT_LOAD_ERROR',
          setup: async () => {
            await testSuite.simulateScriptLoadFailure()
            await testSuite.navigateToMockReadmooPage()
          },
          expectedError: 'Script loading failed',
          recoverable: true
        }
      ]

      for (const scenario of failureScenarios) {
        // When: 設置失敗情境並嘗試注入
        await scenario.setup()

        const injectionResult = await extensionController.triggerContentScriptInjection()

        // Then: 驗證失敗處理
        expect(injectionResult.injected).toBe(false)
        expect(injectionResult.error).toContain(scenario.expectedError)
        expect(injectionResult.recoverable).toBe(scenario.recoverable)

        if (scenario.recoverable) {
          // 測試錯誤恢復
          await testSuite.restoreNormalConditions()
          const retryResult = await extensionController.retryContentScriptInjection()

          expect(retryResult.injected).toBe(true)
          expect(retryResult.recoveredFromError).toBe(scenario.name)
        }

        console.log(`✓ ${scenario.name}: ${scenario.recoverable ? 'Recovered' : 'Handled'}`)
      }
    })
  })

  describe('Background ↔ Content Script 訊息通訊', () => {
    test('應該實現可靠的雙向訊息傳遞', async () => {
      // Given: 設置訊息追蹤環境
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(80, 'message-test'))

      await messageTracker.startTracking()

      // When: 執行需要大量訊息交換的操作
      await extensionController.openPopup()

      const messageExchangePromise = extensionController.clickExtractButton()

      // 監控訊息流
      const messageFlow = await messageTracker.captureMessageFlow({
        duration: 10000, // 監控10秒
        expectedMessageTypes: [
          'EXTRACT_BOOKS_REQUEST',
          'EXTRACTION_PROGRESS',
          'BOOK_DATA_BATCH',
          'EXTRACTION_COMPLETE'
        ]
      })

      const extractionResult = await messageExchangePromise
      await messageTracker.stopTracking()

      // Then: 驗證訊息交換的完整性
      expect(extractionResult.success).toBe(true)

      // 分析訊息流模式
      expect(messageFlow.totalMessages).toBeGreaterThan(10) // 至少10條訊息
      expect(messageFlow.backgroundToContent).toBeGreaterThan(0)
      expect(messageFlow.contentToBackground).toBeGreaterThan(0)

      // 驗證訊息順序正確性
      const messageSequence = messageFlow.chronologicalSequence
      expect(messageSequence[0].type).toBe('EXTRACT_BOOKS_REQUEST') // 第一條應該是請求
      expect(messageSequence[messageSequence.length - 1].type).toBe('EXTRACTION_COMPLETE') // 最後是完成

      // 檢查進度訊息的連續性
      const progressMessages = messageSequence.filter(msg => msg.type === 'EXTRACTION_PROGRESS')
      expect(progressMessages.length).toBeGreaterThan(3)

      // 驗證進度遞增
      for (let i = 1; i < progressMessages.length; i++) {
        expect(progressMessages[i].data.processedCount)
          .toBeGreaterThanOrEqual(progressMessages[i - 1].data.processedCount)
      }
    })

    test('應該處理訊息傳遞失敗和重試機制', async () => {
      // Given: 準備會導致訊息失敗的環境
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(60, 'message-failure-test'))

      await messageTracker.startTracking()

      // When: 在操作過程中模擬訊息傳遞失敗
      await extensionController.openPopup()

      const operationPromise = extensionController.clickExtractButton()

      // 等待操作開始後模擬通訊中斷
      await testSuite.waitForTimeout(2000)
      await messageTracker.simulateMessageDeliveryFailure({
        failureRate: 0.3, // 30%的訊息失敗
        failureTypes: ['timeout', 'connection_lost', 'malformed_response']
      })

      // 監控重試機制
      const retryAnalysis = await messageTracker.captureRetryBehavior({
        duration: 15000
      })

      const operationResult = await operationPromise

      // Then: 驗證重試機制有效性
      expect(operationResult.success).toBe(true) // 最終應該成功

      // 分析重試行為
      expect(retryAnalysis.failedMessages).toBeGreaterThan(0)
      expect(retryAnalysis.retriedMessages).toBe(retryAnalysis.failedMessages)
      expect(retryAnalysis.finalSuccessRate).toBeGreaterThan(0.95) // 最終成功率>95%

      // 檢查重試策略
      expect(retryAnalysis.retryStrategy).toBeDefined()
      expect(retryAnalysis.retryStrategy.backoffType).toBe('exponential')
      expect(retryAnalysis.averageRetryDelay).toBeLessThan(5000) // 平均重試延遲<5秒

      // 驗證資料完整性未受影響
      const finalData = await extensionController.getStorageData()
      expect(finalData.books.length).toBe(110) // 50基礎 + 60新增
    })

    test('應該支援大量資料的分批傳輸', async () => {
      // Given: 準備大量書籍資料測試分批傳輸
      const largeDataset = testDataGenerator.generateBooks(500, 'batch-transfer-test')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(largeDataset)

      // 配置批次傳輸參數
      await extensionController.configureBatchTransfer({
        batchSize: 50,
        batchDelay: 100, // 100ms間隔
        compressionEnabled: true
      })

      await messageTracker.startTracking()

      // When: 執行大量資料提取
      await extensionController.openPopup()

      const batchTransferPromise = extensionController.clickExtractButton()

      // 監控批次傳輸行為
      const batchAnalysis = await messageTracker.analyzeBatchTransfer({
        expectedBatches: 10, // 500/50 = 10批
        monitorDuration: 30000
      })

      const transferResult = await batchTransferPromise

      // Then: 驗證分批傳輸效果
      expect(transferResult.success).toBe(true)
      expect(transferResult.extractedCount).toBe(500)

      // 分析批次傳輸模式
      expect(batchAnalysis.batchCount).toBe(10)
      expect(batchAnalysis.averageBatchSize).toBeCloseTo(50, 2)
      expect(batchAnalysis.totalTransferTime).toBeLessThan(25000) // 總時間<25秒

      // 檢查批次間隔
      const batchIntervals = batchAnalysis.batchIntervals
      const avgInterval = batchIntervals.reduce((sum, interval) => sum + interval, 0) / batchIntervals.length
      expect(avgInterval).toBeCloseTo(100, 50) // 接近設定的100ms

      // 驗證資料壓縮效果
      if (batchAnalysis.compressionStats) {
        expect(batchAnalysis.compressionStats.compressionRatio).toBeGreaterThan(0.7) // 壓縮率>70%
        expect(batchAnalysis.compressionStats.transferSizeSaved).toBeGreaterThan(0)
      }

      // 驗證最終資料完整性
      const finalData = await extensionController.getStorageData()
      expect(finalData.books.length).toBe(550) // 50基礎 + 500新增

      // 檢查批次邊界無資料遺失
      const extractedBooks = finalData.books.filter(book => book.id.includes('batch-transfer-test'))
      expect(extractedBooks.length).toBe(500)
    })
  })

  describe('錯誤處理和異常情況', () => {
    test('應該正確處理Content Script崩潰情況', async () => {
      // Given: 準備會導致Content Script崩潰的情況
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(100, 'crash-test'))

      await extensionController.openPopup()

      // When: 開始操作並模擬Content Script崩潰
      const crashRecoveryPromise = extensionController.clickExtractButton()

      await testSuite.waitForTimeout(2000)

      // 模擬Content Script異常終止
      await testSuite.simulateContentScriptCrash()

      // Then: 驗證崩潰檢測和恢復
      const crashDetectionResult = await extensionController.waitForCrashDetection({
        timeout: 8000
      })

      expect(crashDetectionResult.detected).toBe(true)
      expect(crashDetectionResult.crashType).toBe('content_script_unresponsive')
      expect(crashDetectionResult.detectionTime).toBeLessThan(5000) // 5秒內檢測到

      // 檢查自動恢復機制
      const recoveryResult = await extensionController.waitForAutoRecovery({
        timeout: 10000
      })

      expect(recoveryResult.attempted).toBe(true)
      expect(recoveryResult.recoveryActions).toContain('reinject_content_script')
      expect(recoveryResult.recoveryActions).toContain('resume_operation')

      // 驗證操作恢復成功
      const finalResult = await crashRecoveryPromise
      expect(finalResult.success).toBe(true)
      expect(finalResult.recoveredFromCrash).toBe(true)
      expect(finalResult.extractedCount).toBe(100)
    })

    test('應該處理Background和Content Script間的時序問題', async () => {
      // Given: 設置會產生時序問題的複雜場景
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(80, 'timing-test'))

      // 模擬網路延遲情況
      await testSuite.simulateNetworkLatency({
        min: 500,
        max: 2000,
        variance: 0.3
      })

      await messageTracker.enableTimingAnalysis()

      // When: 執行需要精確時序的操作
      await extensionController.openPopup()

      const timingTestPromise = extensionController.clickExtractButton()

      // 監控時序問題
      const timingAnalysis = await messageTracker.analyzeMessageTiming({
        detectOutOfOrder: true,
        detectTimeouts: true,
        detectRaceConditions: true
      })

      const operationResult = await timingTestPromise

      // Then: 驗證時序問題的處理
      expect(operationResult.success).toBe(true)

      // 分析時序問題處理
      if (timingAnalysis.outOfOrderMessages > 0) {
        expect(timingAnalysis.reorderedCorrectly).toBe(timingAnalysis.outOfOrderMessages)
      }

      if (timingAnalysis.timeoutMessages > 0) {
        expect(timingAnalysis.retriedSuccessfully).toBeGreaterThan(0)
      }

      if (timingAnalysis.raceConditions > 0) {
        expect(timingAnalysis.raceConditionsResolved).toBe(timingAnalysis.raceConditions)
      }

      // 檢查最終資料一致性
      const consistencyCheck = await extensionController.validateDataConsistency()
      expect(consistencyCheck.isConsistent).toBe(true)
      expect(consistencyCheck.sequenceIntegrity).toBe(true)
      expect(consistencyCheck.noDataLoss).toBe(true)
    })

    test('應該實現優雅的連接中斷恢復', async () => {
      // Given: 準備長時間操作以測試連接穩定性
      const sustainedOperationData = testDataGenerator.generateBooks(200, 'sustained-test')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(sustainedOperationData)

      await extensionController.openPopup()

      // When: 開始操作並模擬間歇性連接問題
      const sustainedOperationPromise = extensionController.clickExtractButton()

      // 模擬連接問題序列
      const connectionIssues = [
        { delay: 2000, duration: 1000, type: 'disconnect' },
        { delay: 6000, duration: 2000, type: 'slow_response' },
        { delay: 10000, duration: 500, type: 'packet_loss' }
      ]

      const connectionRecoveryPromises = connectionIssues.map(async (issue) => {
        await testSuite.waitForTimeout(issue.delay)
        await testSuite.simulateConnectionIssue(issue.type, issue.duration)
        return issue
      })

      await Promise.all(connectionRecoveryPromises)

      // Then: 驗證優雅恢復
      const operationResult = await sustainedOperationPromise

      expect(operationResult.success).toBe(true)
      expect(operationResult.extractedCount).toBe(200)
      expect(operationResult.connectionIssuesEncountered).toBe(3)
      expect(operationResult.gracefulRecoveries).toBe(3)

      // 檢查恢復策略效果
      expect(operationResult.totalDowntime).toBeLessThan(4000) // 總中斷時間<4秒
      expect(operationResult.dataIntegrityMaintained).toBe(true)
      expect(operationResult.operationContinuity).toBe('maintained')

      // 驗證最終狀態
      const finalData = await extensionController.getStorageData()
      expect(finalData.books.length).toBe(250) // 50基礎 + 200新增

      const integrityValidation = await lifecycleValidator.validateOperationIntegrity(
        operationResult.operationLog
      )
      expect(integrityValidation.passed).toBe(true)
      expect(integrityValidation.resilienceScore).toBeGreaterThan(0.9)
    })
  })

  describe('效能和資源管理', () => {
    test('應該有效管理記憶體使用和資源釋放', async () => {
      // Given: 準備記憶體使用測試
      const memoryTestData = testDataGenerator.generateBooks(300, 'memory-test')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(memoryTestData)

      // 記錄初始記憶體狀態
      const initialMemory = await extensionController.getMemoryUsage()

      // When: 執行需要大量記憶體的操作
      await extensionController.openPopup()

      const memoryIntensivePromise = extensionController.clickExtractButton()

      // 監控記憶體使用
      const memoryMonitoring = extensionController.monitorMemoryUsage({
        interval: 1000, // 每秒檢查
        alertThreshold: 150 * 1024 * 1024 // 150MB閾值
      })

      const operationResult = await memoryIntensivePromise
      const memoryStats = await memoryMonitoring.stop()

      // Then: 驗證記憶體管理效果
      expect(operationResult.success).toBe(true)

      // 檢查記憶體使用模式
      expect(memoryStats.peakUsage).toBeLessThan(150 * 1024 * 1024) // 峰值<150MB
      expect(memoryStats.memoryLeaks).toBe(0)
      expect(memoryStats.garbageCollectionTriggers).toBeGreaterThan(0)

      // 驗證記憶體清理效果
      const finalMemory = await extensionController.getMemoryUsage()
      const memoryGrowth = finalMemory.used - initialMemory.used
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024) // 記憶體增長<50MB

      // 檢查資源釋放
      const resourceCleanup = await extensionController.validateResourceCleanup()
      expect(resourceCleanup.unreleased.eventListeners).toBe(0)
      expect(resourceCleanup.unreleased.timers).toBe(0)
      expect(resourceCleanup.unreleased.references).toBe(0)
    })

    test('應該優化大量並發訊息的處理效能', async () => {
      // Given: 準備並發訊息測試環境
      const concurrentTestData = testDataGenerator.generateBooks(400, 'concurrent-test')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(concurrentTestData)

      // 配置高並發模式
      await extensionController.configureConcurrentProcessing({
        maxConcurrentMessages: 10,
        messageQueueSize: 100,
        priorityBased: true
      })

      await messageTracker.enablePerformanceAnalysis()

      // When: 執行高並發操作
      await extensionController.openPopup()

      const concurrentProcessingPromise = extensionController.clickExtractButton()

      // 監控並發處理效能
      const performanceAnalysis = await messageTracker.analyzeConcurrentPerformance({
        monitorDuration: 20000,
        measureThroughput: true,
        measureLatency: true,
        measureResourceUsage: true
      })

      const processingResult = await concurrentProcessingPromise

      // Then: 驗證並發處理效能
      expect(processingResult.success).toBe(true)
      expect(processingResult.extractedCount).toBe(400)

      // 分析並發效能指標
      expect(performanceAnalysis.averageThroughput).toBeGreaterThan(20) // >20 messages/sec
      expect(performanceAnalysis.averageLatency).toBeLessThan(500) // 平均延遲<500ms
      expect(performanceAnalysis.queueUtilization).toBeLessThan(0.8) // 隊列使用率<80%

      // 檢查訊息處理順序和優先級
      expect(performanceAnalysis.priorityRespected).toBe(true)
      expect(performanceAnalysis.messageOrderingCorrect).toBe(true)
      expect(performanceAnalysis.noMessageLoss).toBe(true)

      // 驗證資源使用效率
      expect(performanceAnalysis.cpuEfficiency).toBeGreaterThan(0.7) // CPU效率>70%
      expect(performanceAnalysis.memoryEfficiency).toBeGreaterThan(0.8) // 記憶體效率>80%
    })
  })
})
