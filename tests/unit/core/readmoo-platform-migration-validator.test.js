/**
 * ReadmooPlatformMigrationValidator 測試檔案
 * 測試 Readmoo 平台遷移驗證協調器的核心功能
 *
 * 測試重點：
 * - 5層驗證策略完整性測試
 * - 遷移安全保證驗證
 * - 智能驗證機制測試
 * - 效能基準驗證
 * - 錯誤處理和恢復機制
 */

const EventBus = require('../../../src/core/event-bus')
const EventNamingUpgradeCoordinator = require('../../../src/core/events/event-naming-upgrade-coordinator')
const ReadmooPlatformMigrationValidator = require('../../../src/platform/readmoo-platform-migration-validator')

describe('ReadmooPlatformMigrationValidator', () => {
  let eventBus
  let namingCoordinator
  let migrationValidator
  let mockReadmooData
  let mockValidationContext

  beforeEach(() => {
    eventBus = new EventBus()
    namingCoordinator = new EventNamingUpgradeCoordinator(eventBus)

    // 建立 mock readmooAdapter
    const mockReadmooAdapter = {
      extractBookData: jest.fn().mockResolvedValue({ success: true, data: {} }),
      validateExtractedData: jest.fn().mockReturnValue({ valid: true })
    }

    // 建立 mock platformDetectionService
    const mockPlatformDetectionService = {
      detectPlatform: jest.fn().mockResolvedValue({ platform: 'readmoo', confidence: 0.95 }),
      validatePlatform: jest.fn().mockReturnValue({ valid: true })
    }

    migrationValidator = new ReadmooPlatformMigrationValidator({
      eventBus,
      namingCoordinator,
      readmooAdapter: mockReadmooAdapter,
      platformDetectionService: mockPlatformDetectionService
    })

    mockReadmooData = {
      bookId: 'readmoo-book-123',
      title: '測試書籍',
      author: '測試作者',
      progress: 45,
      readingStatus: 'reading',
      lastReadTime: Date.now(),
      platform: 'readmoo'
    }

    mockValidationContext = {
      validationId: `validation-${Date.now()}`,
      platform: 'readmoo',
      startTime: Date.now(),
      testEnvironment: 'unit-test'
    }
  })

  afterEach(() => {
    // 清理驗證器狀態
    migrationValidator.cleanup()
  })

  describe('核心驗證協調器功能', () => {
    test('應該正確初始化 ReadmooPlatformMigrationValidator', () => {
      expect(migrationValidator).toBeDefined()
      expect(migrationValidator.getValidatorStatus()).toBe('initialized')
      expect(migrationValidator.getSupportedPlatforms()).toContain('readmoo')
    })

    test('應該註冊所有必要的事件監聽器', () => {
      expect(eventBus.hasListener('VALIDATION.READMOO.START.REQUESTED')).toBe(true)
      expect(eventBus.hasListener('VALIDATION.READMOO.VERIFY.REQUESTED')).toBe(true)
      expect(eventBus.hasListener('VALIDATION.READMOO.COMPLETE.REQUESTED')).toBe(true)
    })

    test('應該提供完整的驗證器統計資訊', () => {
      const stats = migrationValidator.getValidationStats()

      expect(stats).toHaveProperty('totalValidations')
      expect(stats).toHaveProperty('successfulValidations')
      expect(stats).toHaveProperty('failedValidations')
      expect(stats).toHaveProperty('averageValidationTime')
      expect(stats).toHaveProperty('lastValidationTime')
    })
  })

  describe('五層驗證策略', () => {
    describe('Layer 1: 配置驗證 (Configuration Validation)', () => {
      test('應該驗證 Readmoo 平台配置完整性', async () => {
        const result = await migrationValidator.validateConfiguration('readmoo')

        expect(result).toMatchObject({
          layerName: 'configuration',
          isValid: true,
          validatedItems: expect.arrayContaining([
            'platform_config',
            'event_mappings',
            'api_endpoints',
            'extraction_rules'
          ])
        })
      })

      test('應該檢測配置缺失問題', async () => {
        // 模擬配置缺失情境
        const invalidConfig = { platform: 'readmoo' } // 缺少必要配置

        const result = await migrationValidator.validateConfiguration('readmoo', invalidConfig)

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('missing_extraction_rules')
      })

      test('應該驗證事件轉換對應表完整性', async () => {
        const result = await migrationValidator.validateEventMappings('readmoo')

        expect(result).toMatchObject({
          isValid: true,
          mappingCount: expect.any(Number),
          coveragePercentage: expect.any(Number)
        })
        expect(result.coveragePercentage).toBeGreaterThanOrEqual(95) // 95% 以上覆蓋率
      })
    })

    describe('Layer 2: 事件轉換驗證 (Event Conversion Validation)', () => {
      test('應該驗證 Legacy → Modern 事件轉換正確性', async () => {
        const legacyEvents = [
          'EXTRACTION.COMPLETED',
          'STORAGE.SAVE.COMPLETED',
          'UI.POPUP.OPENED'
        ]

        for (const legacyEvent of legacyEvents) {
          const result = await migrationValidator.validateEventConversion(legacyEvent)

          expect(result).toMatchObject({
            legacyEvent,
            modernEvent: expect.any(String),
            conversionSuccess: true,
            conversionTime: expect.any(Number)
          })
          expect(result.conversionTime).toBeLessThan(5) // < 5ms 要求
        }
      })

      test('應該驗證雙軌並行事件處理', async () => {
        const testEvent = 'EXTRACTION.COMPLETED'
        const testData = mockReadmooData

        // 發送 Legacy 格式事件
        const legacyResult = await migrationValidator.validateDualTrackHandling(testEvent, testData)

        expect(legacyResult).toMatchObject({
          legacyHandled: true,
          modernHandled: true,
          dataConsistency: true,
          processingTime: expect.any(Number)
        })
      })

      test('應該處理未知事件的智能推斷', async () => {
        const unknownEvent = 'UNKNOWN.READMOO.ACTION'

        const result = await migrationValidator.validateEventInference(unknownEvent)

        expect(result).toMatchObject({
          originalEvent: unknownEvent,
          inferredEvent: expect.any(String),
          confidenceScore: expect.any(Number),
          fallbackStrategy: expect.any(String)
        })
      })
    })

    describe('Layer 3: 功能完整性驗證 (Functional Integrity Validation)', () => {
      test('應該驗證 Readmoo 核心功能流程', async () => {
        const coreWorkflows = [
          'book_extraction',
          'data_storage',
          'ui_display',
          'export_functionality'
        ]

        for (const workflow of coreWorkflows) {
          const result = await migrationValidator.validateWorkflow(workflow, mockValidationContext)

          expect(result).toMatchObject({
            workflowName: workflow,
            isComplete: true,
            stepResults: expect.any(Array),
            totalTime: expect.any(Number)
          })
        }
      })

      test('應該驗證資料完整性和一致性', async () => {
        const result = await migrationValidator.validateDataIntegrity(mockReadmooData)

        expect(result).toMatchObject({
          dataValid: true,
          requiredFields: expect.any(Array),
          missingFields: [],
          dataTypes: expect.any(Object),
          validationErrors: []
        })
      })

      test('應該驗證跨模組通訊正常運作', async () => {
        const modules = ['extraction', 'storage', 'popup', 'background']

        const result = await migrationValidator.validateCrossModuleCommunication(modules)

        expect(result).toMatchObject({
          communicationMatrix: expect.any(Object),
          allModulesReachable: true,
          averageResponseTime: expect.any(Number)
        })
      })
    })

    describe('Layer 4: 效能基準驗證 (Performance Baseline Validation)', () => {
      test('應該驗證事件處理效能符合基準', async () => {
        const performanceTests = [
          { eventType: 'extraction', expectedTime: 100 },
          { eventType: 'storage', expectedTime: 50 },
          { eventType: 'ui_update', expectedTime: 30 }
        ]

        for (const test of performanceTests) {
          const result = await migrationValidator.validatePerformance(test.eventType)

          expect(result).toMatchObject({
            eventType: test.eventType,
            averageTime: expect.any(Number),
            maxTime: expect.any(Number),
            meetsBaseline: true
          })
          expect(result.averageTime).toBeLessThanOrEqual(test.expectedTime)
        }
      })

      test('應該驗證記憶體使用量在acceptable範圍內', async () => {
        const result = await migrationValidator.validateMemoryUsage()

        expect(result).toMatchObject({
          beforeMigration: expect.any(Number),
          afterMigration: expect.any(Number),
          increase: expect.any(Number),
          increasePercentage: expect.any(Number)
        })
        expect(result.increasePercentage).toBeLessThanOrEqual(15) // < 15% 增長要求
      })

      test('應該驗證並發事件處理能力', async () => {
        const concurrentEvents = 50

        const result = await migrationValidator.validateConcurrencyHandling(concurrentEvents)

        expect(result).toMatchObject({
          totalEvents: concurrentEvents,
          successfulEvents: concurrentEvents,
          averageProcessingTime: expect.any(Number),
          maxProcessingTime: expect.any(Number)
        })
        expect(result.successfulEvents).toBe(concurrentEvents)
      })
    })

    describe('Layer 5: 整合測試驗證 (Integration Test Validation)', () => {
      test('應該執行完整的 Readmoo 使用者流程', async () => {
        const userJourney = [
          'navigate_to_readmoo',
          'extract_book_data',
          'save_to_storage',
          'display_in_popup',
          'export_data'
        ]

        const result = await migrationValidator.validateUserJourney(userJourney, mockValidationContext)

        expect(result).toMatchObject({
          journeyComplete: true,
          stepResults: expect.arrayContaining(
            userJourney.map(step => expect.objectContaining({ step, success: true }))
          ),
          totalJourneyTime: expect.any(Number)
        })
      })

      test('應該驗證錯誤處理和恢復機制', async () => {
        const errorScenarios = [
          'network_failure',
          'storage_full',
          'invalid_page_structure',
          'event_timeout'
        ]

        for (const scenario of errorScenarios) {
          const result = await migrationValidator.validateErrorHandling(scenario)

          expect(result).toMatchObject({
            scenario,
            errorDetected: true,
            recoverySuccessful: true,
            recoveryTime: expect.any(Number)
          })
        }
      })

      test('應該驗證向後相容性保證', async () => {
        const legacyFunctions = [
          'legacy_book_extraction',
          'legacy_storage_methods',
          'legacy_event_handling'
        ]

        const result = await migrationValidator.validateBackwardCompatibility(legacyFunctions)

        expect(result).toMatchObject({
          allFunctionsWorking: true,
          functionResults: expect.any(Array),
          compatibilityScore: expect.any(Number)
        })
        expect(result.compatibilityScore).toBeGreaterThanOrEqual(100) // 100% 相容性
      })
    })
  })

  describe('智能驗證機制', () => {
    test('應該實作重試機制處理暫時性失敗', async () => {
      const failingTest = 'intermittent_failure_test'

      const result = await migrationValidator.validateWithRetry(failingTest, { maxRetries: 3 })

      expect(result).toMatchObject({
        testName: failingTest,
        attempts: expect.any(Number),
        finalResult: expect.any(Boolean),
        retryHistory: expect.any(Array)
      })
    })

    test('應該實作智能快取避免重複驗證', async () => {
      const testName = 'cacheable_test'

      // 第一次執行
      const firstResult = await migrationValidator.validateWithCache(testName)
      // 第二次執行 (應該使用快取)
      const secondResult = await migrationValidator.validateWithCache(testName)

      expect(firstResult.fromCache).toBe(false)
      expect(secondResult.fromCache).toBe(true)
      expect(secondResult.executionTime).toBeLessThan(firstResult.executionTime)
    })

    test('應該實作錯誤分類和優先級處理', async () => {
      const errors = [
        { type: 'critical', message: 'Core functionality broken' },
        { type: 'warning', message: 'Performance slightly degraded' },
        { type: 'info', message: 'Non-critical configuration change' }
      ]

      const result = await migrationValidator.categorizeErrors(errors)

      expect(result).toMatchObject({
        critical: expect.any(Array),
        warning: expect.any(Array),
        info: expect.any(Array),
        prioritizedActions: expect.any(Array)
      })
    })
  })

  describe('監控和統計功能', () => {
    test('應該提供詳細的驗證統計報告', async () => {
      // 執行幾個驗證來產生統計資料
      await migrationValidator.validateConfiguration('readmoo')
      await migrationValidator.validateEventConversion('EXTRACTION.COMPLETED')

      const stats = migrationValidator.getDetailedStats()

      expect(stats).toMatchObject({
        overview: expect.any(Object),
        layerStats: expect.any(Object),
        performanceMetrics: expect.any(Object),
        errorAnalysis: expect.any(Object),
        trendAnalysis: expect.any(Object)
      })
    })

    test('應該提供實時監控數據', () => {
      const monitoring = migrationValidator.getRealtimeMonitoring()

      expect(monitoring).toMatchObject({
        currentValidations: expect.any(Array),
        systemLoad: expect.any(Number),
        memoryUsage: expect.any(Number),
        eventQueueSize: expect.any(Number),
        healthStatus: expect.any(String)
      })
    })

    test('應該支援自訂驗證指標', async () => {
      const customMetric = {
        name: 'readmoo_book_processing_accuracy',
        validator: (data) => data.accuracy > 0.95,
        weight: 10
      }

      migrationValidator.registerCustomMetric(customMetric)

      const result = await migrationValidator.validateCustomMetrics({ accuracy: 0.97 })

      expect(result.customMetricResults).toContainEqual(
        expect.objectContaining({
          metricName: 'readmoo_book_processing_accuracy',
          passed: true
        })
      )
    })
  })

  describe('錯誤處理和恢復', () => {
    test('應該處理驗證過程中的異常情況', async () => {
      // 模擬異常情況
      const invalidInput = null

      const result = await migrationValidator.validateWithErrorHandling(invalidInput)

      expect(result).toMatchObject({
        success: false,
        errorType: 'invalid_input',
        errorMessage: expect.any(String),
        recoveryAction: expect.any(String)
      })
    })

    test('應該提供驗證失敗時的詳細診斷資訊', async () => {
      // 強制一個驗證失敗
      const result = await migrationValidator.diagnoseFailure('forced_failure_scenario')

      expect(result).toMatchObject({
        failureType: expect.any(String),
        rootCause: expect.any(String),
        affectedComponents: expect.any(Array),
        suggestedFixes: expect.any(Array),
        diagnosticData: expect.any(Object)
      })
    })
  })
})
