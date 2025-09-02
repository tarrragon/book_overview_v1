/**
 * Chrome Runtime Messaging API 整合測試
 *
 * 測試目標：
 * - 驗證Chrome Runtime API的訊息傳遞機制正確性
 * - 確保Background、Content Script、Popup間的通訊可靠性
 * - 檢查訊息路由、錯誤處理、超時機制的有效性
 */

const { E2ETestSuite } = require('../../helpers/e2e-test-suite')
const { ChromeExtensionController } = require('../../helpers/chrome-extension-controller')
const { TestDataGenerator } = require('../../helpers/test-data-generator')
const RuntimeMessagingValidator = require('../../helpers/runtime-messaging-validator')
const MessageFlowAnalyzer = require('../../helpers/message-flow-analyzer')

describe('Chrome Runtime Messaging API 整合測試', () => {
  let testSuite
  let extensionController
  let testDataGenerator
  let messagingValidator
  let flowAnalyzer

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
    messagingValidator = new RuntimeMessagingValidator(testSuite)
    flowAnalyzer = new MessageFlowAnalyzer()
  })

  afterAll(async () => {
    await messagingValidator.cleanup()
    await flowAnalyzer.cleanup()
    await testSuite.cleanup()
  })

  beforeEach(async () => {
    await testSuite.clearAllStorageData()
    await messagingValidator.reset()
    await flowAnalyzer.reset()

    // 確保所有Extension contexts都處於正常狀態
    await extensionController.validateExtensionContexts()
  })

  describe('基礎訊息傳遞機制', () => {
    test('應該實現Popup到Background的可靠訊息傳遞', async () => {
      // Given: 設置訊息追蹤環境
      await messagingValidator.startTracking(['popup-to-background'])
      await testSuite.setupMockReadmooPage()

      // When: 從Popup發送各種類型的訊息到Background
      await extensionController.openPopup()

      const testMessages = [
        {
          type: 'GET_SYSTEM_STATUS',
          data: { requestId: 'status-001' },
          expectedResponse: { type: 'SYSTEM_STATUS_RESPONSE' }
        },
        {
          type: 'REQUEST_BOOK_COUNT',
          data: { includeMetadata: true },
          expectedResponse: { type: 'BOOK_COUNT_RESPONSE' }
        },
        {
          type: 'INITIATE_EXTRACTION',
          data: { mode: 'incremental', batchSize: 50 },
          expectedResponse: { type: 'EXTRACTION_STARTED' }
        },
        {
          type: 'UPDATE_USER_SETTINGS',
          data: { settings: { theme: 'dark', autoSync: true } },
          expectedResponse: { type: 'SETTINGS_UPDATED' }
        }
      ]

      const messagingResults = []

      for (const testMessage of testMessages) {
        const messageStart = Date.now()

        // 發送訊息
        const response = await extensionController.sendPopupToBackgroundMessage(
          testMessage.type,
          testMessage.data
        )

        const responseTime = Date.now() - messageStart

        messagingResults.push({
          messageType: testMessage.type,
          success: response.success,
          responseTime,
          responseType: response.type,
          responseData: response.data
        })
      }

      const messagingAnalysis = await messagingValidator.stopTracking()

      // Then: 驗證訊息傳遞結果
      expect(messagingResults.length).toBe(4)
      messagingResults.forEach((result, index) => {
        const testMessage = testMessages[index]

        expect(result.success).toBe(true)
        expect(result.responseTime).toBeLessThan(1000) // 響應時間<1秒
        expect(result.responseType).toBe(testMessage.expectedResponse.type)
      })

      // 檢查訊息傳遞統計
      expect(messagingAnalysis.totalMessages).toBe(8) // 4個請求 + 4個響應
      expect(messagingAnalysis.deliveryRate).toBe(1.0) // 100%投遞率
      expect(messagingAnalysis.averageResponseTime).toBeLessThan(500) // 平均響應<500ms
      expect(messagingAnalysis.lostMessages).toBe(0)
    })

    test('應該支援Background到Content Script的指令傳遞', async () => {
      // Given: 設置Content Script通訊環境
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(80, 'messaging-test'))

      await messagingValidator.startTracking(['background-to-content'])

      // 確保Content Script已注入並準備就緒
      const contentScriptReady = await extensionController.waitForContentScriptReady()
      expect(contentScriptReady).toBe(true)

      // When: 從Background發送各種指令到Content Script
      const backgroundCommands = [
        {
          command: 'EXTRACT_BOOKS_DATA',
          parameters: { startIndex: 0, batchSize: 20 },
          expectedAction: 'data_extraction_started'
        },
        {
          command: 'VALIDATE_PAGE_STRUCTURE',
          parameters: { checkElements: ['book-list', 'pagination'] },
          expectedAction: 'validation_completed'
        },
        {
          command: 'UPDATE_EXTRACTION_PROGRESS',
          parameters: { progress: 50, status: 'processing' },
          expectedAction: 'progress_updated'
        },
        {
          command: 'CLEANUP_RESOURCES',
          parameters: { releaseMemory: true },
          expectedAction: 'cleanup_completed'
        }
      ]

      const commandResults = []

      for (const command of backgroundCommands) {
        const commandStart = Date.now()

        // 執行Background到Content Script的指令
        const result = await extensionController.sendBackgroundToContentMessage(
          command.command,
          command.parameters
        )

        const executionTime = Date.now() - commandStart

        commandResults.push({
          command: command.command,
          success: result.success,
          executionTime,
          actionTaken: result.actionTaken,
          responseData: result.data
        })
      }

      const commandAnalysis = await messagingValidator.stopTracking()

      // Then: 驗證指令執行結果
      commandResults.forEach((result, index) => {
        const command = backgroundCommands[index]

        expect(result.success).toBe(true)
        expect(result.executionTime).toBeLessThan(2000) // 執行時間<2秒
        expect(result.actionTaken).toBe(command.expectedAction)
      })

      // 檢查指令傳遞效能
      expect(commandAnalysis.averageDeliveryTime).toBeLessThan(200) // 平均投遞<200ms
      expect(commandAnalysis.commandExecutionRate).toBe(1.0) // 100%執行率
      expect(commandAnalysis.failedCommands).toBe(0)

      // 驗證Content Script狀態
      const contentScriptStatus = await extensionController.getContentScriptStatus()
      expect(contentScriptStatus.responsive).toBe(true)
      expect(contentScriptStatus.commandsProcessed).toBe(4)
      expect(contentScriptStatus.errors).toBe(0)
    })

    test('應該處理Content Script到Popup的資料回報', async () => {
      // Given: 準備資料回報測試環境
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(60, 'reporting-test'))

      await messagingValidator.startTracking(['content-to-popup'])
      await extensionController.openPopup()

      // When: 模擬Content Script向Popup回報資料
      const reportingScenarios = [
        {
          reportType: 'EXTRACTION_PROGRESS',
          data: { completed: 15, total: 60, percentage: 25 },
          expectedPopupUpdate: 'progress_bar_updated'
        },
        {
          reportType: 'BOOK_DATA_BATCH',
          data: { books: testDataGenerator.generateBooks(10, 'batch-1'), batchIndex: 1 },
          expectedPopupUpdate: 'book_count_incremented'
        },
        {
          reportType: 'ERROR_ENCOUNTERED',
          data: { error: 'NETWORK_TIMEOUT', affectedItems: 3 },
          expectedPopupUpdate: 'error_indicator_shown'
        },
        {
          reportType: 'EXTRACTION_COMPLETED',
          data: { totalProcessed: 60, successRate: 0.95, duration: 8500 },
          expectedPopupUpdate: 'completion_status_displayed'
        }
      ]

      const reportingResults = []

      for (const scenario of reportingScenarios) {
        const reportStart = Date.now()

        // 模擬Content Script發送資料報告
        const reportResult = await extensionController.simulateContentScriptReport(
          scenario.reportType,
          scenario.data
        )

        // 等待Popup更新
        const popupUpdate = await extensionController.waitForPopupUpdate({
          expectedUpdate: scenario.expectedPopupUpdate,
          timeout: 3000
        })

        const reportingTime = Date.now() - reportStart

        reportingResults.push({
          reportType: scenario.reportType,
          reportSent: reportResult.sent,
          popupUpdated: popupUpdate.updated,
          reportingTime,
          updateType: popupUpdate.updateType
        })
      }

      const reportingAnalysis = await messagingValidator.stopTracking()

      // Then: 驗證資料回報機制
      reportingResults.forEach((result, index) => {
        const scenario = reportingScenarios[index]

        expect(result.reportSent).toBe(true)
        expect(result.popupUpdated).toBe(true)
        expect(result.reportingTime).toBeLessThan(1500) // 回報時間<1.5秒
        expect(result.updateType).toBe(scenario.expectedPopupUpdate)
      })

      // 檢查回報傳遞效能
      expect(reportingAnalysis.reportDeliveryRate).toBe(1.0) // 100%投遞率
      expect(reportingAnalysis.averageProcessingTime).toBeLessThan(300) // 平均處理<300ms
      expect(reportingAnalysis.popupUpdateLatency).toBeLessThan(100) // UI更新延遲<100ms

      // 驗證Popup最終狀態
      const finalPopupState = await extensionController.getPopupState()
      expect(finalPopupState.lastUpdate).toBeDefined()
      expect(finalPopupState.bookCount).toBe(60)
      expect(finalPopupState.extractionCompleted).toBe(true)
    })
  })

  describe('訊息路由和多向通訊', () => {
    test('應該正確處理多模組間的訊息路由', async () => {
      // Given: 建立多模組訊息路由測試環境
      await testSuite.setupMockReadmooPage()
      await testSuite.injectMockBooks(testDataGenerator.generateBooks(100, 'routing-test'))

      await messagingValidator.enableRoutingAnalysis()
      await extensionController.openPopup()

      // When: 觸發需要多模組協調的複雜操作
      const complexOperationPromise = extensionController.clickExtractButton()

      // 監控訊息路由
      const routingAnalysis = await messagingValidator.analyzeMessageRouting({
        trackAllModules: true,
        analyzeRoutingPatterns: true,
        measureRoutingEfficiency: true,
        monitorDuration: 12000
      })

      const operationResult = await complexOperationPromise

      // Then: 驗證訊息路由效果
      expect(operationResult.success).toBe(true)

      // 分析路由模式
      const routingPatterns = routingAnalysis.routingPatterns

      // 檢查主要路由路徑
      expect(routingPatterns.popupToBackground).toBeGreaterThan(5)
      expect(routingPatterns.backgroundToContent).toBeGreaterThan(10)
      expect(routingPatterns.contentToBackground).toBeGreaterThan(15)
      expect(routingPatterns.backgroundToPopup).toBeGreaterThan(8)

      // 驗證路由效率
      expect(routingAnalysis.averageHops).toBeLessThan(2.5) // 平均跳躍次數<2.5
      expect(routingAnalysis.routingOverhead).toBeLessThan(50) // 路由開銷<50ms
      expect(routingAnalysis.messageDeliverySuccess).toBeGreaterThan(0.98) // 投遞成功率>98%

      // 檢查路由瓶頸
      if (routingAnalysis.bottlenecks.length > 0) {
        routingAnalysis.bottlenecks.forEach(bottleneck => {
          expect(bottleneck.impact).toBeLessThan(0.3) // 瓶頸影響<30%
          expect(bottleneck.resolved).toBe(true)
        })
      }

      // 驗證路由表正確性
      const routingTable = routingAnalysis.routingTable
      expect(routingTable.popup.defaultTarget).toBe('background')
      expect(routingTable.background.availableTargets).toContain('content-script')
      expect(routingTable.background.availableTargets).toContain('popup')
      expect(routingTable.contentScript.defaultTarget).toBe('background')
    })

    test('應該支援廣播和點對點訊息傳遞', async () => {
      // Given: 設置多Context環境
      await testSuite.setupMockReadmooPage()
      await extensionController.openPopup()

      // 模擬多個Content Script (不同分頁)
      const additionalTabs = await testSuite.createAdditionalTabs([
        'https://readmoo.com/library?page=2',
        'https://readmoo.com/library?category=fiction'
      ])

      await messagingValidator.enableMulticastTesting()

      // When: 測試廣播訊息傳遞
      const broadcastTests = [
        {
          type: 'SYSTEM_STATUS_UPDATE',
          target: 'all_content_scripts',
          data: { status: 'maintenance_mode', duration: 5000 },
          expectedRecipients: 3 // 主頁面 + 2個額外分頁
        },
        {
          type: 'SETTINGS_CHANGED',
          target: 'all_contexts',
          data: { theme: 'dark', language: 'zh-TW' },
          expectedRecipients: 4 // 3個Content Scripts + 1個Popup
        },
        {
          type: 'EMERGENCY_SHUTDOWN',
          target: 'all_contexts',
          data: { reason: 'critical_error', immediate: true },
          expectedRecipients: 4
        }
      ]

      const broadcastResults = []

      for (const test of broadcastTests) {
        const broadcastStart = Date.now()

        // 執行廣播
        const broadcastResult = await extensionController.broadcastMessage(
          test.type,
          test.data,
          { target: test.target }
        )

        const broadcastTime = Date.now() - broadcastStart

        broadcastResults.push({
          messageType: test.type,
          broadcast: broadcastResult.broadcast,
          recipientsReached: broadcastResult.recipientsReached,
          expectedRecipients: test.expectedRecipients,
          broadcastTime,
          deliveryRate: broadcastResult.deliveryRate
        })
      }

      // When: 測試點對點訊息傳遞
      const p2pTests = [
        {
          from: 'popup',
          to: 'content-script-tab-0',
          message: { type: 'GET_PAGE_INFO', requestId: 'p2p-001' }
        },
        {
          from: 'background',
          to: 'content-script-tab-1',
          message: { type: 'UPDATE_EXTRACTION_CONFIG', config: { batchSize: 25 } }
        }
      ]

      const p2pResults = []

      for (const test of p2pTests) {
        const p2pStart = Date.now()

        const p2pResult = await extensionController.sendDirectMessage(
          test.from,
          test.to,
          test.message
        )

        const p2pTime = Date.now() - p2pStart

        p2pResults.push({
          from: test.from,
          to: test.to,
          delivered: p2pResult.delivered,
          responseReceived: p2pResult.responseReceived,
          p2pTime
        })
      }

      // Then: 驗證廣播和點對點傳遞

      // 檢查廣播結果
      broadcastResults.forEach(result => {
        expect(result.broadcast).toBe(true)
        expect(result.recipientsReached).toBe(result.expectedRecipients)
        expect(result.broadcastTime).toBeLessThan(2000) // 廣播時間<2秒
        expect(result.deliveryRate).toBeGreaterThan(0.9) // 投遞率>90%
      })

      // 檢查點對點結果
      p2pResults.forEach(result => {
        expect(result.delivered).toBe(true)
        expect(result.responseReceived).toBe(true)
        expect(result.p2pTime).toBeLessThan(1000) // P2P時間<1秒
      })

      // 清理額外分頁
      await testSuite.closeAdditionalTabs(additionalTabs)
    })

    test('應該實現訊息優先級和佇列管理', async () => {
      // Given: 配置訊息優先級系統
      await messagingValidator.configurePriorityTesting({
        urgentMessages: ['EMERGENCY_STOP', 'CRITICAL_ERROR'],
        highPriorityMessages: ['USER_ACTION', 'EXTRACTION_START'],
        normalMessages: ['PROGRESS_UPDATE', 'STATUS_CHANGE'],
        lowPriorityMessages: ['DEBUG_INFO', 'METRICS_REPORT']
      })

      await testSuite.setupMockReadmooPage()
      await extensionController.openPopup()

      // When: 同時發送不同優先級的大量訊息
      const messageBatches = [
        // 批次1：正常和低優先級訊息
        ...Array.from({ length: 10 }, (_, i) => ({
          type: 'PROGRESS_UPDATE',
          priority: 'normal',
          data: { step: i, total: 10 },
          timestamp: Date.now()
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          type: 'DEBUG_INFO',
          priority: 'low',
          data: { debugStep: i, details: 'test info' },
          timestamp: Date.now() + 100
        })),

        // 批次2：緊急和高優先級訊息（稍後發送但應該優先處理）
        {
          type: 'CRITICAL_ERROR',
          priority: 'urgent',
          data: { error: 'system_failure', severity: 'high' },
          timestamp: Date.now() + 200
        },
        {
          type: 'USER_ACTION',
          priority: 'high',
          data: { action: 'cancel_operation', immediate: true },
          timestamp: Date.now() + 250
        }
      ]

      // 發送所有訊息
      const messagePromises = messageBatches.map(message =>
        extensionController.sendPriorityMessage(message.type, message.data, message.priority)
      )

      // 監控處理順序
      const processingAnalysis = await messagingValidator.analyzePriorityProcessing({
        expectedMessages: messageBatches.length,
        monitorDuration: 8000
      })

      await Promise.all(messagePromises)

      // Then: 驗證優先級處理
      const processedOrder = processingAnalysis.processedOrder

      // 檢查緊急訊息優先處理
      const urgentMessageIndex = processedOrder.findIndex(msg => msg.priority === 'urgent')
      const highPriorityIndices = processedOrder
        .map((msg, index) => ({ ...msg, index }))
        .filter(msg => msg.priority === 'high')
        .map(msg => msg.index)

      // 緊急訊息應該最先處理（即使最後發送）
      expect(urgentMessageIndex).toBeLessThan(5) // 在前5個處理

      // 高優先級訊息應該在正常優先級之前處理
      highPriorityIndices.forEach(highIndex => {
        const normalIndicesAfter = processedOrder
          .slice(highIndex)
          .filter(msg => msg.priority === 'normal').length
        expect(normalIndicesAfter).toBeLessThan(8) // 大部分正常訊息在高優先級後處理
      })

      // 檢查佇列管理效果
      expect(processingAnalysis.queueOverflow).toBe(false)
      expect(processingAnalysis.averageQueueTime).toBeLessThan(500) // 平均排隊<500ms
      expect(processingAnalysis.priorityInversions).toBe(0) // 無優先級倒置

      // 驗證處理效能
      expect(processingAnalysis.totalProcessingTime).toBeLessThan(6000) // 總處理<6秒
      expect(processingAnalysis.messagesLost).toBe(0)
      expect(processingAnalysis.averageProcessingTime).toBeLessThan(200) // 平均處理<200ms
    })
  })

  describe('訊息錯誤處理和恢復機制', () => {
    test('應該處理訊息傳遞失敗和超時情況', async () => {
      // Given: 準備各種訊息傳遞失敗情境
      const failureScenarios = [
        {
          name: 'RECIPIENT_UNAVAILABLE',
          setup: async () => {
            await messagingValidator.simulateRecipientUnavailable('content-script')
          },
          expectedHandling: 'fallback_routing'
        },
        {
          name: 'MESSAGE_TIMEOUT',
          setup: async () => {
            await messagingValidator.simulateMessageDelay(8000) // 8秒延遲
          },
          expectedHandling: 'timeout_with_retry'
        },
        {
          name: 'SERIALIZATION_ERROR',
          setup: async () => {
            await messagingValidator.simulateSerializationError()
          },
          expectedHandling: 'message_format_recovery'
        },
        {
          name: 'CONTEXT_DISCONNECTED',
          setup: async () => {
            await messagingValidator.simulateContextDisconnection('popup')
          },
          expectedHandling: 'context_reconnection'
        }
      ]

      await testSuite.setupMockReadmooPage()
      await extensionController.openPopup()

      const failureHandlingResults = []

      for (const scenario of failureScenarios) {
        // When: 設置失敗情境並嘗試發送訊息
        await scenario.setup()

        const failureTestStart = Date.now()
        const testMessage = {
          type: 'TEST_MESSAGE_FAILURE',
          data: { scenarioId: scenario.name, timestamp: Date.now() }
        }

        const messageResult = await extensionController.sendMessageWithErrorHandling(
          testMessage.type,
          testMessage.data,
          {
            enableRetry: true,
            maxRetries: 3,
            timeout: 5000,
            fallbackRouting: true
          }
        )

        const handlingTime = Date.now() - failureTestStart

        failureHandlingResults.push({
          scenario: scenario.name,
          errorDetected: !messageResult.success,
          handlingStrategy: messageResult.errorHandling?.strategy,
          recoveryAttempted: messageResult.recoveryAttempted,
          finalSuccess: messageResult.recovered || messageResult.success,
          handlingTime,
          retryCount: messageResult.retryCount
        })

        // 清理失敗條件
        await messagingValidator.clearSimulatedErrors()
        await testSuite.waitForTimeout(500)
      }

      // Then: 驗證錯誤處理機制
      failureHandlingResults.forEach(result => {
        // 基本錯誤處理檢查
        expect(result.handlingStrategy).toBeDefined()
        expect(result.handlingTime).toBeLessThan(12000) // 處理時間<12秒

        // 檢查恢復嘗試
        if (result.errorDetected) {
          expect(result.recoveryAttempted).toBe(true)
          expect(result.retryCount).toBeGreaterThan(0)
        }

        // 多數情況下應該能夠恢復
        if (['RECIPIENT_UNAVAILABLE', 'MESSAGE_TIMEOUT', 'CONTEXT_DISCONNECTED'].includes(result.scenario)) {
          expect(result.finalSuccess).toBe(true)
        }
      })

      // 檢查整體錯誤處理效能
      const totalErrors = failureHandlingResults.filter(r => r.errorDetected).length
      const totalRecovered = failureHandlingResults.filter(r => r.finalSuccess).length
      const recoveryRate = totalRecovered / failureHandlingResults.length

      expect(recoveryRate).toBeGreaterThan(0.75) // 恢復率>75%

      const avgHandlingTime = failureHandlingResults.reduce((sum, r) => sum + r.handlingTime, 0) / failureHandlingResults.length
      expect(avgHandlingTime).toBeLessThan(6000) // 平均處理時間<6秒
    })

    test('應該支援訊息重試和降級機制', async () => {
      // Given: 配置重試和降級策略
      await messagingValidator.configureRetryTesting({
        retryStrategies: ['exponential_backoff', 'linear_backoff', 'immediate_retry'],
        maxRetryAttempts: 5,
        degradationStrategies: ['reduce_message_size', 'simplified_protocol', 'local_storage_fallback']
      })

      await testSuite.setupMockReadmooPage()
      await extensionController.openPopup()

      // When: 測試不同重試策略
      const retryTests = [
        {
          messageType: 'LARGE_DATA_TRANSFER',
          data: { books: testDataGenerator.generateBooks(200, 'retry-test') },
          failureType: 'temporary_overload',
          retryStrategy: 'exponential_backoff'
        },
        {
          messageType: 'CRITICAL_STATUS_UPDATE',
          data: { status: 'system_alert', priority: 'urgent' },
          failureType: 'network_congestion',
          retryStrategy: 'immediate_retry'
        },
        {
          messageType: 'PROGRESS_BATCH_UPDATE',
          data: { updates: Array.from({ length: 50 }, (_, i) => ({ id: i, progress: i * 2 })) },
          failureType: 'serialization_limit',
          retryStrategy: 'linear_backoff'
        }
      ]

      const retryResults = []

      for (const test of retryTests) {
        // 模擬對應的失敗類型
        await messagingValidator.simulateSpecificFailure(test.failureType)

        const retryStart = Date.now()

        const retryResult = await extensionController.sendMessageWithRetry(
          test.messageType,
          test.data,
          {
            retryStrategy: test.retryStrategy,
            enableDegradation: true,
            monitorRetryProcess: true
          }
        )

        const retryTime = Date.now() - retryStart

        retryResults.push({
          messageType: test.messageType,
          retryStrategy: test.retryStrategy,
          finalSuccess: retryResult.success,
          retryAttempts: retryResult.retryAttempts,
          degradationUsed: retryResult.degradationApplied,
          retryTime,
          recoveryMethod: retryResult.recoveryMethod
        })

        await messagingValidator.clearSimulatedErrors()
      }

      // Then: 驗證重試和降級效果
      retryResults.forEach(result => {
        expect(result.finalSuccess).toBe(true)
        expect(result.retryAttempts).toBeGreaterThan(0)
        expect(result.retryTime).toBeLessThan(15000) // 重試時間<15秒

        // 檢查策略特定效果
        if (result.retryStrategy === 'exponential_backoff') {
          expect(result.retryTime).toBeGreaterThan(2000) // 指數退避需要較長時間
        } else if (result.retryStrategy === 'immediate_retry') {
          expect(result.retryTime).toBeLessThan(3000) // 立即重試較快
        }

        // 如果使用了降級，應該有具體的降級方法
        if (result.degradationUsed) {
          expect(result.recoveryMethod).toBeDefined()
        }
      })

      // 檢查重試效能統計
      const avgRetryAttempts = retryResults.reduce((sum, r) => sum + r.retryAttempts, 0) / retryResults.length
      expect(avgRetryAttempts).toBeLessThan(3) // 平均重試次數<3次

      const successfulRecoveries = retryResults.filter(r => r.finalSuccess).length
      expect(successfulRecoveries).toBe(retryResults.length) // 100%恢復成功
    })

    test('應該維護訊息傳遞的順序性和完整性', async () => {
      // Given: 設置訊息順序性測試環境
      await testSuite.setupMockReadmooPage()
      await extensionController.openPopup()

      await messagingValidator.enableSequenceTracking()

      // When: 發送有嚴格順序要求的訊息序列
      const sequentialMessages = Array.from({ length: 20 }, (_, i) => ({
        type: 'SEQUENTIAL_DATA_PART',
        sequenceId: `seq-${String(i).padStart(3, '0')}`,
        data: {
          partNumber: i,
          totalParts: 20,
          content: `Data part ${i} of 20`,
          checksum: `checksum-${i}`
        },
        timestamp: Date.now() + i * 10 // 每10ms一個
      }))

      // 並發發送所有訊息（測試順序保持）
      const sequencePromises = sequentialMessages.map((message, index) =>
        new Promise(resolve => {
          setTimeout(async () => {
            const result = await extensionController.sendOrderedMessage(
              message.type,
              message.data,
              { sequenceId: message.sequenceId, enforceOrder: true }
            )
            resolve({ index, result })
          }, index * 50) // 每50ms發送一個
        })
      )

      const sequenceResults = await Promise.all(sequencePromises)

      // 檢查接收順序
      const receivedOrder = await messagingValidator.getReceivedMessageOrder()

      // Then: 驗證順序性和完整性

      // 檢查所有訊息成功發送
      expect(sequenceResults.length).toBe(20)
      sequenceResults.forEach(({ index, result }) => {
        expect(result.success).toBe(true)
        expect(result.sequenceId).toBe(`seq-${String(index).padStart(3, '0')}`)
      })

      // 驗證接收順序正確
      expect(receivedOrder.length).toBe(20)
      receivedOrder.forEach((receivedMessage, index) => {
        expect(receivedMessage.sequenceId).toBe(`seq-${String(index).padStart(3, '0')}`)
        expect(receivedMessage.data.partNumber).toBe(index)
      })

      // 檢查完整性
      const integrityCheck = await messagingValidator.verifyMessageIntegrity(receivedOrder)
      expect(integrityCheck.missingMessages).toBe(0)
      expect(integrityCheck.duplicateMessages).toBe(0)
      expect(integrityCheck.corruptedMessages).toBe(0)
      expect(integrityCheck.outOfOrderMessages).toBe(0)

      // 檢查校驗和完整性
      receivedOrder.forEach((message, index) => {
        expect(message.data.checksum).toBe(`checksum-${index}`)
      })

      // 檢查序列統計
      const sequenceStats = await messagingValidator.getSequenceStatistics()
      expect(sequenceStats.totalMessages).toBe(20)
      expect(sequenceStats.orderViolations).toBe(0)
      expect(sequenceStats.averageDeliveryTime).toBeLessThan(200) // 平均投遞<200ms
      expect(sequenceStats.sequenceCompleteness).toBe(1.0) // 100%完整
    })
  })
})
