/**
 * Popup UI ↔ Background Service Worker 跨模組整合測試
 *
 * 測試目標：
 * - 驗證Popup介面與Background Service Worker間的狀態同步
 * - 確保UI更新、事件處理、資料流轉的即時性和正確性
 * - 檢查Popup生命周期管理和持久化機制
 */

const { E2ETestSuite } = require('../../helpers/e2e-test-suite')
const { ChromeExtensionController } = require('../../helpers/chrome-extension-controller')
const { TestDataGenerator } = require('../../helpers/test-data-generator')
const UIStateTracker = require('../../helpers/ui-state-tracker')
const PopupLifecycleManager = require('../../helpers/popup-lifecycle-manager')

describe('Popup ↔ Background 跨模組整合測試', () => {
  let testSuite
  let extensionController
  let testDataGenerator
  let uiStateTracker
  let lifecycleManager

  beforeAll(async () => {
    testSuite = new E2ETestSuite({
      headless: process.env.CI !== 'false',
      slowMo: 30,
      testDataSize: 'medium',
      enableUITracking: true // 啟用UI狀態追蹤
    })

    await testSuite.setup()
    extensionController = testSuite.extensionController
    testDataGenerator = new TestDataGenerator()
    uiStateTracker = new UIStateTracker(testSuite)
    lifecycleManager = new PopupLifecycleManager()
  })

  afterAll(async () => {
    await uiStateTracker.cleanup()
    await testSuite.cleanup()
  })

  beforeEach(async () => {
    await testSuite.clearAllStorageData()
    await uiStateTracker.reset()

    // 預載入標準測試資料
    const baseBooks = testDataGenerator.generateBooks(75, 'popup-integration-base')
    await testSuite.loadInitialData({ books: baseBooks })
  })

  describe('Popup 生命周期與Background同步', () => {
    test('應該在Popup開啟時正確同步Background狀態', async () => {
      // Given: Background有特定狀態
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(50, 'sync-test'))

      // Background執行一些操作改變狀態
      const backgroundOperation = await extensionController.executeBackgroundOperation('data-refresh')
      expect(backgroundOperation.success).toBe(true)

      // 記錄Background狀態
      const backgroundState = await extensionController.getBackgroundState()

      // When: 開啟Popup
      const popupOpenStart = Date.now()
      const popupState = await extensionController.openPopup()
      const popupOpenTime = Date.now() - popupOpenStart

      // Then: 驗證狀態同步
      expect(popupOpenTime).toBeLessThan(1000) // Popup開啟<1秒
      expect(popupState.synced).toBe(true)

      // 檢查關鍵狀態項目同步
      expect(popupState.bookCount).toBe(backgroundState.bookCount)
      expect(popupState.lastExtraction).toBe(backgroundState.lastExtraction)
      expect(popupState.systemStatus).toBe(backgroundState.systemStatus)

      // 驗證UI元素狀態正確反映Background狀態
      const uiElements = await extensionController.getPopupUIElements()
      expect(uiElements.bookCountDisplay.text).toBe(backgroundState.bookCount.toString())
      expect(uiElements.extractButton.enabled).toBe(backgroundState.extractionPossible)
      expect(uiElements.overviewButton.enabled).toBe(backgroundState.bookCount > 0)
    })

    test('應該處理Popup快速開關的狀態管理', async () => {
      // Given: 準備快速開關測試
      await testSuite.setupMockReadmooPage()

      const rapidOperations = []
      const stateSnapshots = []

      // When: 快速執行多次開關操作
      for (let i = 0; i < 5; i++) {
        const operationStart = Date.now()

        // 開啟Popup
        const popupState = await extensionController.openPopup()
        stateSnapshots.push({
          iteration: i,
          openState: popupState,
          openTime: Date.now() - operationStart
        })

        // 短暫操作
        await extensionController.clickButton('refresh-status')

        // 關閉Popup
        await extensionController.closePopup()
        stateSnapshots[i].closeTime = Date.now() - operationStart

        // 短暫間隔
        await testSuite.waitForTimeout(200)

        rapidOperations.push(stateSnapshots[i])
      }

      // Then: 驗證快速操作的穩定性
      rapidOperations.forEach((operation, index) => {
        expect(operation.openState.synced).toBe(true)
        expect(operation.openTime).toBeLessThan(800) // 每次開啟<800ms
        expect(operation.closeTime).toBeLessThan(1200) // 完整週期<1.2秒

        if (index > 0) {
          // 檢查狀態連續性
          const prevState = rapidOperations[index - 1].openState
          const currState = operation.openState
          expect(currState.bookCount).toBeGreaterThanOrEqual(prevState.bookCount)
        }
      })

      // 最終狀態一致性檢查
      const finalPopupState = await extensionController.openPopup()
      const finalBackgroundState = await extensionController.getBackgroundState()

      expect(finalPopupState.bookCount).toBe(finalBackgroundState.bookCount)
      expect(finalPopupState.systemStatus).toBe(finalBackgroundState.systemStatus)
    })

    test('應該維持Popup關閉期間Background狀態變化的追蹤', async () => {
      // Given: 開啟Popup並記錄初始狀態
      const initialPopupState = await extensionController.openPopup()
      const initialBookCount = initialPopupState.bookCount

      // 關閉Popup
      await extensionController.closePopup()

      // When: Popup關閉期間Background執行狀態變更操作
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(30, 'background-change-test'))

      // 透過Background執行提取操作 (無UI)
      const backgroundExtractionResult = await extensionController.executeBackgroundExtraction()
      expect(backgroundExtractionResult.success).toBe(true)
      expect(backgroundExtractionResult.extractedCount).toBe(30)

      // Background執行其他狀態變更
      await extensionController.updateBackgroundStatus('processing_complete')
      await extensionController.incrementBackgroundCounter('total_operations')

      // When: 重新開啟Popup
      const reopenedPopupState = await extensionController.openPopup()

      // Then: 驗證Popup能正確反映所有Background狀態變化
      expect(reopenedPopupState.bookCount).toBe(initialBookCount + 30)
      expect(reopenedPopupState.lastExtraction).toBeDefined()
      expect(reopenedPopupState.systemStatus).toBe('processing_complete')
      expect(reopenedPopupState.totalOperations).toBe(initialPopupState.totalOperations + 1)

      // 驗證UI元素正確更新
      const updatedUIElements = await extensionController.getPopupUIElements()
      expect(updatedUIElements.bookCountDisplay.text).toBe((initialBookCount + 30).toString())
      expect(updatedUIElements.statusIndicator.status).toBe('complete')
      expect(updatedUIElements.lastUpdateTime.visible).toBe(true)
    })
  })

  describe('即時狀態同步和事件響應', () => {
    test('應該實現Background到Popup的即時狀態更新', async () => {
      // Given: 開啟Popup並設置狀態監控
      await extensionController.openPopup()

      const stateUpdates = []
      const stateUpdateSubscription = await uiStateTracker.subscribeToStateUpdates((update) => {
        stateUpdates.push({
          ...update,
          timestamp: Date.now()
        })
      })

      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(80, 'realtime-test'))

      // When: 在Background執行會產生多階段狀態更新的操作
      const realtimeOperationPromise = extensionController.clickExtractButton()

      // 監控即時更新
      const updateMonitoring = await uiStateTracker.monitorRealtimeUpdates({
        expectedUpdates: ['started', 'progress', 'progress', 'progress', 'completed'],
        timeout: 15000
      })

      const operationResult = await realtimeOperationPromise
      stateUpdateSubscription.unsubscribe()

      // Then: 驗證即時更新的效果
      expect(operationResult.success).toBe(true)
      expect(stateUpdates.length).toBeGreaterThan(4) // 至少4次狀態更新

      // 檢查更新時序和內容
      const updateTypes = stateUpdates.map(update => update.type)
      expect(updateTypes).toContain('extraction_started')
      expect(updateTypes).toContain('progress_updated')
      expect(updateTypes).toContain('extraction_completed')

      // 驗證更新及時性
      const updateIntervals = []
      for (let i = 1; i < stateUpdates.length; i++) {
        updateIntervals.push(stateUpdates[i].timestamp - stateUpdates[i - 1].timestamp)
      }
      const avgUpdateInterval = updateIntervals.reduce((sum, interval) => sum + interval, 0) / updateIntervals.length
      expect(avgUpdateInterval).toBeLessThan(2000) // 平均更新間隔<2秒

      // 驗證UI響應性
      const uiResponseTimes = stateUpdates.map(update => update.uiUpdateDelay)
      const avgResponseTime = uiResponseTimes.reduce((sum, time) => sum + time, 0) / uiResponseTimes.length
      expect(avgResponseTime).toBeLessThan(100) // 平均UI響應<100ms
    })

    test('應該正確處理並發事件和競態條件', async () => {
      // Given: 設置會產生並發事件的複雜環境
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(100, 'concurrent-events-test'))

      await extensionController.openPopup()
      await uiStateTracker.enableConcurrencyDetection()

      // When: 同時觸發多個會產生狀態變化的操作
      const concurrentPromises = [
        extensionController.clickExtractButton(),
        testSuite.waitForTimeout(500).then(() => extensionController.clickRefreshButton()),
        testSuite.waitForTimeout(1000).then(() => extensionController.updateBackgroundCounter('user_actions')),
        testSuite.waitForTimeout(1500).then(() => extensionController.simulateExternalStateChange())
      ]

      // 監控並發處理
      const concurrencyAnalysis = await uiStateTracker.analyzeConcurrentEvents({
        monitorDuration: 10000,
        detectRaceConditions: true,
        detectStateConflicts: true
      })

      const results = await Promise.allSettled(concurrentPromises)

      // Then: 驗證並發處理的正確性
      const successfulOperations = results.filter(result =>
        result.status === 'fulfilled' && result.value.success
      ).length
      expect(successfulOperations).toBeGreaterThanOrEqual(3) // 至少3個操作成功

      // 檢查競態條件處理
      expect(concurrencyAnalysis.raceConditionsDetected).toBeGreaterThan(0)
      expect(concurrencyAnalysis.raceConditionsResolved).toBe(concurrencyAnalysis.raceConditionsDetected)

      // 驗證狀態一致性
      expect(concurrencyAnalysis.stateConflicts).toBe(0)
      expect(concurrencyAnalysis.finalStateConsistent).toBe(true)

      // 檢查最終UI狀態
      const finalUIState = await extensionController.getPopupState()
      const finalBackgroundState = await extensionController.getBackgroundState()

      expect(finalUIState.bookCount).toBe(finalBackgroundState.bookCount)
      expect(finalUIState.operationInProgress).toBe(false)
      expect(finalUIState.errorState).toBe(false)
    })

    test('應該支援批次狀態更新的優化處理', async () => {
      // Given: 配置批次更新模式
      await extensionController.configureBatchUpdates({
        batchSize: 10,
        batchInterval: 500, // 500ms
        priorityThreshold: 'high'
      })

      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(150, 'batch-updates-test'))

      await extensionController.openPopup()
      await uiStateTracker.enableBatchAnalysis()

      // When: 執行會產生大量狀態更新的操作
      const batchOperationPromise = extensionController.clickExtractButton()

      // 監控批次更新行為
      const batchAnalysis = await uiStateTracker.analyzeBatchUpdates({
        expectedBatches: 15, // 150個更新分15批
        monitorDuration: 20000
      })

      const operationResult = await batchOperationPromise

      // Then: 驗證批次更新的效率
      expect(operationResult.success).toBe(true)

      // 分析批次處理效果
      expect(batchAnalysis.actualBatches).toBeCloseTo(15, 3) // 接近預期批次數
      expect(batchAnalysis.averageBatchSize).toBeCloseTo(10, 2) // 接近設定批次大小
      expect(batchAnalysis.batchProcessingTime).toBeLessThan(200) // 批次處理<200ms

      // 檢查批次優化效果
      const nonBatchedUpdates = batchAnalysis.totalUpdates
      const batchedUpdates = batchAnalysis.actualBatches
      const reductionRatio = 1 - (batchedUpdates / nonBatchedUpdates)
      expect(reductionRatio).toBeGreaterThan(0.8) // 更新減少>80%

      // 驗證用戶體驗影響
      expect(batchAnalysis.uiSmoothness).toBeGreaterThan(0.9) // UI流暢度>90%
      expect(batchAnalysis.perceivedDelay).toBeLessThan(100) // 感知延遲<100ms

      // 確認最終狀態正確
      const finalState = await extensionController.getPopupState()
      expect(finalState.bookCount).toBe(225) // 75基礎 + 150新增
    })
  })

  describe('事件處理和用戶交互', () => {
    test('應該正確處理用戶交互事件的Background傳遞', async () => {
      // Given: 準備用戶交互測試環境
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(60, 'interaction-test'))

      await extensionController.openPopup()

      // 設置事件追蹤
      const eventTracker = await extensionController.enableEventTracking([
        'button_click',
        'menu_selection',
        'input_change',
        'keyboard_shortcut'
      ])

      // When: 執行各種用戶交互操作
      const interactionSequence = [
        {
          action: () => extensionController.clickButton('extract'),
          expectedEvent: 'EXTRACT_BOOKS_REQUEST',
          expectedBackgroundResponse: 'EXTRACTION_STARTED'
        },
        {
          action: () => extensionController.selectMenuOption('export-format', 'json'),
          expectedEvent: 'EXPORT_FORMAT_CHANGED',
          expectedBackgroundResponse: 'CONFIG_UPDATED'
        },
        {
          action: () => extensionController.typeInSearchBox('測試書籍'),
          expectedEvent: 'SEARCH_QUERY_CHANGED',
          expectedBackgroundResponse: 'SEARCH_INITIATED'
        },
        {
          action: () => extensionController.pressKeyboardShortcut('Ctrl+R'),
          expectedEvent: 'REFRESH_REQUESTED',
          expectedBackgroundResponse: 'REFRESH_STARTED'
        }
      ]

      const interactionResults = []

      for (const interaction of interactionSequence) {
        const startTime = Date.now()

        // 執行交互
        const actionResult = await interaction.action()

        // 等待事件傳遞和Background響應
        const eventResponse = await extensionController.waitForEventResponse({
          expectedEvent: interaction.expectedEvent,
          expectedResponse: interaction.expectedBackgroundResponse,
          timeout: 5000
        })

        const responseTime = Date.now() - startTime

        interactionResults.push({
          interaction: interaction.expectedEvent,
          success: eventResponse.received,
          responseTime,
          backgroundProcessed: eventResponse.backgroundProcessed
        })

        // 短暫間隔避免事件重疊
        await testSuite.waitForTimeout(500)
      }

      // Then: 驗證所有交互事件正確處理
      interactionResults.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.responseTime).toBeLessThan(1000) // 響應時間<1秒
        expect(result.backgroundProcessed).toBe(true)
      })

      // 檢查事件追蹤記錄
      const eventLog = await eventTracker.getEventLog()
      expect(eventLog.length).toBe(interactionSequence.length * 2) // 事件 + 響應

      // 驗證事件順序正確
      const eventTypes = eventLog.map(event => event.type)
      interactionSequence.forEach((interaction, index) => {
        const eventIndex = index * 2
        expect(eventTypes[eventIndex]).toBe(interaction.expectedEvent)
        expect(eventTypes[eventIndex + 1]).toBe(interaction.expectedBackgroundResponse)
      })
    })

    test('應該處理長時間運行操作的進度回饋', async () => {
      // Given: 準備長時間操作測試
      const longRunningData = testDataGenerator.generateBooks(300, 'long-running-test')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(longRunningData)

      await extensionController.openPopup()

      // 設置進度監控
      const progressMonitor = await uiStateTracker.enableProgressTracking({
        trackUIUpdates: true,
        trackUserFeedback: true,
        trackPerformance: true
      })

      // When: 執行長時間操作
      const longOperationPromise = extensionController.clickExtractButton()

      // 監控進度回饋
      const progressAnalysis = await progressMonitor.analyze({
        expectedDuration: 15000, // 預期15秒
        expectedProgressUpdates: 20, // 預期20次進度更新
        monitorUserExperience: true
      })

      const operationResult = await longOperationPromise

      // Then: 驗證進度回饋的品質
      expect(operationResult.success).toBe(true)

      // 檢查進度更新頻率和品質
      expect(progressAnalysis.progressUpdates.length).toBeGreaterThan(15)
      expect(progressAnalysis.averageUpdateInterval).toBeLessThan(1000) // 平均<1秒更新一次

      // 驗證進度資訊的準確性
      const progressAccuracy = progressAnalysis.calculateAccuracy()
      expect(progressAccuracy.percentageAccuracy).toBeGreaterThan(0.9) // 準確度>90%
      expect(progressAccuracy.timeEstimationError).toBeLessThan(0.2) // 時間估算誤差<20%

      // 檢查用戶體驗指標
      expect(progressAnalysis.userExperience.clarity).toBeGreaterThan(0.8)
      expect(progressAnalysis.userExperience.responsiveness).toBeGreaterThan(0.85)
      expect(progressAnalysis.userExperience.informativeness).toBeGreaterThan(0.9)

      // 驗證進度UI元素
      const progressUI = progressAnalysis.uiElements
      expect(progressUI.progressBar.visible).toBe(true)
      expect(progressUI.statusText.informative).toBe(true)
      expect(progressUI.cancelButton.accessible).toBe(true)
      expect(progressUI.estimatedTime.accurate).toBe(true)
    })

    test('應該支援操作取消和中斷處理', async () => {
      // Given: 準備可取消操作的測試
      const cancellableData = testDataGenerator.generateBooks(200, 'cancellation-test')
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(cancellableData)

      await extensionController.openPopup()

      // When: 開始操作並在中途取消
      const cancellableOperationPromise = extensionController.clickExtractButton()

      // 等待操作進行到一定程度
      await testSuite.waitForCondition(async () => {
        const progress = await extensionController.getCurrentProgress()
        return progress && progress.processedCount >= 50 // 等待處理50本書
      }, 10000)

      // 記錄取消前狀態
      const preCanellationState = await extensionController.getSystemState()
      const processedBeforeCancellation = preCanellationState.progress.processedCount

      // 執行取消操作
      const cancellationStart = Date.now()
      const cancellationResult = await extensionController.clickCancelButton()
      const cancellationTime = Date.now() - cancellationStart

      // 等待取消完成
      const operationResult = await cancellableOperationPromise

      // Then: 驗證取消處理的正確性
      expect(cancellationResult.initiated).toBe(true)
      expect(cancellationTime).toBeLessThan(2000) // 取消響應<2秒

      expect(operationResult.success).toBe(false)
      expect(operationResult.cancelled).toBe(true)
      expect(operationResult.reason).toBe('user_cancelled')

      // 檢查部分處理結果
      expect(operationResult.processedCount).toBe(processedBeforeCancellation)
      expect(operationResult.processedCount).toBeGreaterThan(40) // 確實處理了一部分
      expect(operationResult.processedCount).toBeLessThan(200) // 未完全處理

      // 驗證系統狀態清理
      const postCancellationState = await extensionController.getSystemState()
      expect(postCancellationState.operationInProgress).toBe(false)
      expect(postCancellationState.resourcesReleased).toBe(true)
      expect(postCancellationState.uiResetToIdle).toBe(true)

      // 驗證資料一致性
      const finalData = await extensionController.getStorageData()
      expect(finalData.books.length).toBe(75 + processedBeforeCancellation) // 基礎 + 已處理部分

      // 檢查後續操作可用性
      const retryAvailable = await extensionController.checkRetryAvailability()
      expect(retryAvailable.canRetry).toBe(true)
      expect(retryAvailable.canResumeFromCancellation).toBe(true)
    })
  })

  describe('錯誤處理和異常狀況', () => {
    test('應該正確處理Popup與Background間的通訊錯誤', async () => {
      // Given: 準備會發生通訊錯誤的環境
      await extensionController.openPopup()

      // When: 模擬各種通訊錯誤情況
      const communicationErrorScenarios = [
        {
          name: 'background_service_worker_dormant',
          setup: async () => {
            await extensionController.forceServiceWorkerDormant()
          },
          expectedHandling: 'auto_wake_and_retry'
        },
        {
          name: 'message_timeout',
          setup: async () => {
            await testSuite.simulateMessageDelay(10000) // 10秒延遲
          },
          expectedHandling: 'timeout_with_retry'
        },
        {
          name: 'background_process_crash',
          setup: async () => {
            await extensionController.simulateBackgroundCrash()
          },
          expectedHandling: 'graceful_degradation'
        }
      ]

      const errorHandlingResults = []

      for (const scenario of communicationErrorScenarios) {
        // 設置錯誤情境
        await scenario.setup()

        // 嘗試執行需要Background通訊的操作
        const operationStart = Date.now()
        const operationResult = await extensionController.clickExtractButton({
          expectCommunicationIssue: true,
          timeout: 15000
        })
        const handlingTime = Date.now() - operationStart

        // 記錄錯誤處理結果
        errorHandlingResults.push({
          scenario: scenario.name,
          handlingStrategy: operationResult.errorHandling?.strategy,
          handlingTime,
          recovered: operationResult.recovered,
          finalSuccess: operationResult.success
        })

        // 清理錯誤狀態
        await testSuite.restoreNormalConditions()
        await testSuite.waitForTimeout(1000)
      }

      // Then: 驗證錯誤處理策略
      errorHandlingResults.forEach(result => {
        expect(result.handlingStrategy).toBeDefined()
        expect(result.handlingTime).toBeLessThan(12000) // 處理時間<12秒

        // 檢查特定錯誤的處理策略
        const scenario = communicationErrorScenarios.find(s => s.name === result.scenario)
        if (scenario.expectedHandling === 'auto_wake_and_retry') {
          expect(result.recovered).toBe(true)
          expect(result.finalSuccess).toBe(true)
        } else if (scenario.expectedHandling === 'timeout_with_retry') {
          expect(result.handlingStrategy).toContain('retry')
        } else if (scenario.expectedHandling === 'graceful_degradation') {
          expect(result.handlingStrategy).toContain('degradation')
        }
      })
    })

    test('應該處理Popup意外關閉和重新開啟的狀態恢復', async () => {
      // Given: 準備狀態恢復測試
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(100, 'recovery-test'))

      await extensionController.openPopup()

      // 開始長時間操作
      const longOperationPromise = extensionController.clickExtractButton()

      // 等待操作進行中
      await testSuite.waitForCondition(async () => {
        const progress = await extensionController.getCurrentProgress()
        return progress && progress.processedCount > 20
      }, 8000)

      // 記錄意外關閉前的狀態
      const preCloseState = await extensionController.capturePopupState()
      const operationProgress = preCloseState.progress

      // When: 模擬意外關閉 (不是用戶主動關閉)
      await extensionController.simulateUnexpectedPopupClose()

      // Background操作應該繼續進行
      await testSuite.waitForTimeout(3000)

      // 重新開啟Popup
      const recoveredPopupState = await extensionController.openPopup()

      // Then: 驗證狀態恢復
      expect(recoveredPopupState.sessionRecovered).toBe(true)
      expect(recoveredPopupState.operationContinued).toBe(true)

      // 檢查操作是否正確恢復
      if (recoveredPopupState.operationInProgress) {
        const currentProgress = recoveredPopupState.progress
        expect(currentProgress.processedCount).toBeGreaterThan(operationProgress.processedCount)

        // 等待操作完成
        const finalResult = await extensionController.waitForExtractionComplete()
        expect(finalResult.success).toBe(true)
        expect(finalResult.recoveredFromUnexpectedClose).toBe(true)
      } else if (recoveredPopupState.operationCompleted) {
        // 操作在Popup關閉期間完成了
        expect(recoveredPopupState.bookCount).toBe(175) // 75基礎 + 100新增
        expect(recoveredPopupState.lastOperationSuccess).toBe(true)
      }

      // 驗證UI狀態正確恢復
      const uiElements = await extensionController.getPopupUIElements()
      expect(uiElements.statusDisplay.showsRecoveryMessage).toBe(true)
      expect(uiElements.extractButton.enabled).toBe(true)
      expect(uiElements.bookCount.correctValue).toBe(true)
    })

    test('應該提供清楚的錯誤訊息和恢復指導', async () => {
      // Given: 準備錯誤訊息測試
      await extensionController.openPopup()

      // When: 觸發各種需要用戶指導的錯誤
      const errorGuidanceTests = [
        {
          errorType: 'STORAGE_QUOTA_EXCEEDED',
          trigger: async () => {
            await testSuite.fillStorageToCapacity()
            await extensionController.clickExtractButton()
          },
          expectedGuidance: {
            hasActionButtons: true,
            hasClearInstructions: true,
            providesAlternatives: true
          }
        },
        {
          errorType: 'PERMISSION_REVOKED',
          trigger: async () => {
            await testSuite.revokeExtensionPermissions(['storage'])
            await extensionController.clickExtractButton()
          },
          expectedGuidance: {
            hasPermissionRestoreSteps: true,
            providesScreenshots: true,
            hasDirectLinks: true
          }
        },
        {
          errorType: 'INVALID_PAGE_CONTEXT',
          trigger: async () => {
            await testSuite.navigateToUnsupportedPage()
            await extensionController.openPopup()
          },
          expectedGuidance: {
            explainsSupportedPages: true,
            providesNavigationHelp: true,
            hasExampleLinks: true
          }
        }
      ]

      const guidanceResults = []

      for (const test of errorGuidanceTests) {
        // 觸發錯誤
        await test.trigger()

        // 等待錯誤UI顯示
        const errorUI = await extensionController.waitForErrorUI({
          expectedError: test.errorType,
          timeout: 8000
        })

        // 分析錯誤指導品質
        const guidanceAnalysis = await extensionController.analyzeErrorGuidance(errorUI)

        guidanceResults.push({
          errorType: test.errorType,
          guidanceQuality: guidanceAnalysis,
          userFriendliness: guidanceAnalysis.userFriendliness,
          actionability: guidanceAnalysis.actionability
        })

        // 清理錯誤狀態
        await testSuite.restoreNormalConditions()
        await testSuite.waitForTimeout(500)
      }

      // Then: 驗證錯誤指導品質
      guidanceResults.forEach(result => {
        expect(result.userFriendliness).toBeGreaterThan(0.8) // 用戶友善度>80%
        expect(result.actionability).toBeGreaterThan(0.7) // 可操作性>70%

        const guidance = result.guidanceQuality
        expect(guidance.messageClarity).toBe('clear')
        expect(guidance.providesNextSteps).toBe(true)
        expect(guidance.avoidsTechnicalJargon).toBe(true)

        // 檢查特定錯誤類型的指導要求
        const test = errorGuidanceTests.find(t => t.errorType === result.errorType)
        Object.entries(test.expectedGuidance).forEach(([requirement, expected]) => {
          if (expected) {
            expect(guidance[requirement]).toBe(true)
          }
        })
      })
    })
  })
})
