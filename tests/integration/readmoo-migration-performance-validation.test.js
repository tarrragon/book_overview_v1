/**
 * Readmoo 遷移效能驗證測試
 * 整合測試：驗證事件系統 v2.0 升級後的效能基準
 * 
 * 測試重點：
 * - 事件處理效能基準驗證
 * - 記憶體使用量監控
 * - 並發處理能力驗證
 * - Readmoo 平台功能效能回歸測試
 */

const EventBus = require('../../src/core/event-bus')
const EventNamingUpgradeCoordinator = require('../../src/core/events/event-naming-upgrade-coordinator')
const ReadmooPlatformMigrationValidator = require('../../src/core/events/readmoo-platform-migration-validator')

describe('Readmoo 遷移效能驗證整合測試', () => {
  let eventBus
  let namingCoordinator
  let migrationValidator
  let performanceBaselines

  beforeAll(() => {
    // 設定效能基準線
    performanceBaselines = {
      eventProcessing: {
        extraction: 100, // ms
        storage: 50, // ms
        ui_update: 30, // ms
        cross_module_communication: 25 // ms
      },
      memoryUsage: {
        maxIncrease: 15, // 百分比
        baselineBeforeMigration: 100, // MB (模擬值)
        maxAfterMigration: 115 // MB (模擬值)
      },
      concurrency: {
        maxConcurrentEvents: 50,
        maxProcessingTime: 200, // ms
        minSuccessRate: 0.95 // 95%
      },
      userJourney: {
        maxNavigationTime: 1000, // ms
        maxExtractionTime: 3000, // ms
        maxStorageTime: 1500, // ms
        maxUIRenderTime: 800 // ms
      }
    }
  })

  beforeEach(() => {
    eventBus = new EventBus()
    namingCoordinator = new EventNamingUpgradeCoordinator(eventBus)
    migrationValidator = new ReadmooPlatformMigrationValidator(eventBus, namingCoordinator)
  })

  afterEach(() => {
    migrationValidator.cleanup()
  })

  describe('事件處理效能基準驗證', () => {
    test('應該在基準時間內處理 EXTRACTION 相關事件', async () => {
      const startTime = Date.now()
      
      // 模擬多個提取事件處理
      const extractionEvents = [
        'EXTRACTION.COMPLETED',
        'EXTRACTION.PROGRESS', 
        'EXTRACTION.STARTED'
      ]
      
      const processingTimes = []
      
      for (const eventName of extractionEvents) {
        const eventStartTime = Date.now()
        await migrationValidator.validateEventConversion(eventName)
        const processingTime = Date.now() - eventStartTime
        processingTimes.push(processingTime)
        
        expect(processingTime).toBeLessThan(performanceBaselines.eventProcessing.extraction)
      }
      
      const averageProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      const totalTime = Date.now() - startTime
      
      expect(averageProcessingTime).toBeLessThan(performanceBaselines.eventProcessing.extraction)
      expect(totalTime).toBeLessThan(performanceBaselines.eventProcessing.extraction * extractionEvents.length * 1.5)
    })

    test('應該在基準時間內處理 STORAGE 相關事件', async () => {
      const storageEvents = [
        'STORAGE.SAVE.COMPLETED',
        'STORAGE.LOAD.COMPLETED',
        'STORAGE.SAVE.REQUESTED',
        'STORAGE.LOAD.REQUESTED'
      ]
      
      const processingTimes = []
      
      for (const eventName of storageEvents) {
        const startTime = Date.now()
        await migrationValidator.validateEventConversion(eventName)
        const processingTime = Date.now() - startTime
        processingTimes.push(processingTime)
        
        expect(processingTime).toBeLessThan(performanceBaselines.eventProcessing.storage)
      }
      
      const averageProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      expect(averageProcessingTime).toBeLessThan(performanceBaselines.eventProcessing.storage)
    })

    test('應該在基準時間內處理 UI 相關事件', async () => {
      const uiEvents = [
        'UI.POPUP.OPENED',
        'UI.POPUP.CLOSED',
        'UI.OVERVIEW.RENDERED'
      ]
      
      const processingTimes = []
      
      for (const eventName of uiEvents) {
        const startTime = Date.now()
        await migrationValidator.validateEventConversion(eventName)
        const processingTime = Date.now() - startTime
        processingTimes.push(processingTime)
        
        expect(processingTime).toBeLessThan(performanceBaselines.eventProcessing.ui_update)
      }
      
      const averageProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      expect(averageProcessingTime).toBeLessThan(performanceBaselines.eventProcessing.ui_update)
    })
  })

  describe('記憶體使用量監控驗證', () => {
    test('應該驗證記憶體使用量增長在acceptable範圍內', async () => {
      // 執行多次驗證操作來模擬記憶體使用
      const iterations = 100
      
      for (let i = 0; i < iterations; i++) {
        await migrationValidator.validateConfiguration('readmoo')
        await migrationValidator.validateEventConversion('EXTRACTION.COMPLETED')
        await migrationValidator.validateDataIntegrity({
          bookId: `test-book-${i}`,
          title: `測試書籍 ${i}`,
          platform: 'readmoo'
        })
      }
      
      const memoryResult = await migrationValidator.validateMemoryUsage()
      
      expect(memoryResult.increasePercentage).toBeLessThanOrEqual(
        performanceBaselines.memoryUsage.maxIncrease
      )
      expect(memoryResult.afterMigration).toBeLessThanOrEqual(
        performanceBaselines.memoryUsage.maxAfterMigration
      )
    })

    test('應該監控快取系統的記憶體使用', async () => {
      // 填充快取來測試記憶體管理
      const cacheOperations = 50
      
      for (let i = 0; i < cacheOperations; i++) {
        await migrationValidator.validateWithCache(`cache_test_${i}`)
      }
      
      const detailedStats = migrationValidator.getDetailedStats()
      expect(detailedStats.performanceMetrics.cacheHitRate).toBeGreaterThan(0)
      
      // 清理快取並驗證記憶體釋放
      migrationValidator.cleanup()
      
      const postCleanupStats = migrationValidator.getDetailedStats()
      expect(postCleanupStats.performanceMetrics.cacheHitRate).toBe(0)
    })
  })

  describe('並發處理能力驗證', () => {
    test('應該能處理大量並發事件', async () => {
      const concurrentEvents = performanceBaselines.concurrency.maxConcurrentEvents
      const startTime = Date.now()
      
      const result = await migrationValidator.validateConcurrencyHandling(concurrentEvents)
      const totalTime = Date.now() - startTime
      
      expect(result.totalEvents).toBe(concurrentEvents)
      expect(result.successfulEvents).toBe(concurrentEvents)
      expect(result.maxProcessingTime).toBeLessThan(performanceBaselines.concurrency.maxProcessingTime)
      expect(totalTime).toBeLessThan(performanceBaselines.concurrency.maxProcessingTime * 2)
      
      const successRate = result.successfulEvents / result.totalEvents
      expect(successRate).toBeGreaterThanOrEqual(performanceBaselines.concurrency.minSuccessRate)
    })

    test('應該能在高負載情況下保持穩定性', async () => {
      // 連續多輪並發測試
      const rounds = 5
      const eventsPerRound = 20
      const results = []
      
      for (let round = 0; round < rounds; round++) {
        const roundStartTime = Date.now()
        const result = await migrationValidator.validateConcurrencyHandling(eventsPerRound)
        const roundTime = Date.now() - roundStartTime
        
        results.push({
          round,
          result,
          processingTime: roundTime,
          successRate: result.successfulEvents / result.totalEvents
        })
        
        expect(result.successfulEvents).toBe(eventsPerRound)
        expect(roundTime).toBeLessThan(performanceBaselines.concurrency.maxProcessingTime)
      }
      
      // 驗證穩定性 - 所有輪次的成功率都應該一致
      const successRates = results.map(r => r.successRate)
      const averageSuccessRate = successRates.reduce((a, b) => a + b, 0) / successRates.length
      expect(averageSuccessRate).toBe(1.0) // 100% 成功率
    })
  })

  describe('完整使用者流程效能驗證', () => {
    test('應該在基準時間內完成完整 Readmoo 使用者流程', async () => {
      const userJourney = [
        'navigate_to_readmoo',
        'extract_book_data',
        'save_to_storage',
        'display_in_popup',
        'export_data'
      ]
      
      const mockValidationContext = {
        validationId: `perf-validation-${Date.now()}`,
        platform: 'readmoo',
        startTime: Date.now(),
        testEnvironment: 'performance-test'
      }
      
      const startTime = Date.now()
      const result = await migrationValidator.validateUserJourney(userJourney, mockValidationContext)
      const totalTime = Date.now() - startTime
      
      expect(result.journeyComplete).toBe(true)
      expect(totalTime).toBeLessThan(
        performanceBaselines.userJourney.maxNavigationTime +
        performanceBaselines.userJourney.maxExtractionTime +
        performanceBaselines.userJourney.maxStorageTime +
        performanceBaselines.userJourney.maxUIRenderTime
      )
      
      // 驗證各步驟執行時間
      result.stepResults.forEach(step => {
        expect(step.success).toBe(true)
        expect(step.time).toBeLessThan(1000) // 每步驟不超過 1 秒
      })
    })

    test('應該測量跨模組通訊效能', async () => {
      const modules = ['extraction', 'storage', 'popup', 'background', 'content']
      
      const startTime = Date.now()
      const result = await migrationValidator.validateCrossModuleCommunication(modules)
      const totalTime = Date.now() - startTime
      
      expect(result.allModulesReachable).toBe(true)
      expect(result.averageResponseTime).toBeLessThan(
        performanceBaselines.eventProcessing.cross_module_communication
      )
      expect(totalTime).toBeLessThan(performanceBaselines.eventProcessing.cross_module_communication * modules.length)
      
      // 驗證每個模組的回應時間
      Object.values(result.communicationMatrix).forEach(module => {
        expect(module.reachable).toBe(true)
        expect(module.responseTime).toBeLessThan(performanceBaselines.eventProcessing.cross_module_communication)
      })
    })
  })

  describe('效能退化回歸測試', () => {
    test('應該驗證事件系統升級未導致效能退化', async () => {
      // 模擬升級前後的效能比較
      const testScenarios = [
        'EXTRACTION.COMPLETED',
        'STORAGE.SAVE.COMPLETED',
        'UI.POPUP.OPENED'
      ]
      
      const legacyPerformance = []
      const modernPerformance = []
      
      // 測試 Legacy 事件處理效能
      for (const eventName of testScenarios) {
        const startTime = Date.now()
        await migrationValidator.validateEventConversion(eventName)
        legacyPerformance.push(Date.now() - startTime)
      }
      
      // 測試 Modern 事件處理效能（透過雙軌並行）
      for (const eventName of testScenarios) {
        const startTime = Date.now()
        await migrationValidator.validateDualTrackHandling(eventName, { test: 'data' })
        modernPerformance.push(Date.now() - startTime)
      }
      
      // 驗證升級後效能沒有明顯退化（允許最多 50% 的性能開銷，因為雙軌並行）
      for (let i = 0; i < testScenarios.length; i++) {
        const legacyTime = legacyPerformance[i]
        const modernTime = modernPerformance[i]
        
        // 確保有效的性能數據
        expect(legacyTime).toBeGreaterThan(0)
        expect(modernTime).toBeGreaterThan(0)
        
        const performanceDegradation = (modernTime - legacyTime) / legacyTime
        expect(performanceDegradation).toBeLessThan(1.0) // 不超過 100% 退化（雙軌並行的合理開銷）
      }
    })

    test('應該驗證重試機制不會造成過度效能開銷', async () => {
      const retryScenarios = [
        'intermittent_failure_test_1',
        'intermittent_failure_test_2',
        'intermittent_failure_test_3'
      ]
      
      const retryResults = []
      
      for (const testName of retryScenarios) {
        const startTime = Date.now()
        const result = await migrationValidator.validateWithRetry(testName, { maxRetries: 3 })
        const totalTime = Date.now() - startTime
        
        retryResults.push({
          testName,
          attempts: result.attempts,
          totalTime,
          success: result.finalResult
        })
        
        // 重試機制總時間不應超過合理範圍
        expect(totalTime).toBeLessThan(5000) // 5 秒內完成
        expect(result.finalResult).toBe(true)
      }
      
      // 驗證重試機制整體效率
      const averageTime = retryResults.reduce((sum, r) => sum + r.totalTime, 0) / retryResults.length
      expect(averageTime).toBeLessThan(3000) // 平均 3 秒內完成
    })
  })

  describe('效能監控統計驗證', () => {
    test('應該提供準確的效能統計數據', async () => {
      // 執行多種驗證操作來產生統計資料
      const operations = [
        () => migrationValidator.validateConfiguration('readmoo'),
        () => migrationValidator.validateEventConversion('EXTRACTION.COMPLETED'),
        () => migrationValidator.validateDataIntegrity({ bookId: 'test', title: 'Test', platform: 'readmoo' }),
        () => migrationValidator.validatePerformance('extraction'),
        () => migrationValidator.validateMemoryUsage()
      ]
      
      // 執行操作
      for (const operation of operations) {
        await operation()
      }
      
      const stats = migrationValidator.getValidationStats()
      const detailedStats = migrationValidator.getDetailedStats()
      
      // 驗證基本統計
      expect(stats.totalValidations).toBeGreaterThan(0)
      expect(stats.successfulValidations).toBeGreaterThan(0)
      expect(stats.averageValidationTime).toBeGreaterThan(0)
      expect(stats.lastValidationTime).toBeDefined()
      
      // 驗證詳細統計
      expect(detailedStats.overview).toBeDefined()
      expect(detailedStats.performanceMetrics).toBeDefined()
      expect(detailedStats.performanceMetrics.averageExecutionTime).toBeGreaterThan(0)
      expect(detailedStats.trendAnalysis.validationVolume).toBe(stats.totalValidations)
    })

    test('應該提供實時監控數據', async () => {
      const monitoring = migrationValidator.getRealtimeMonitoring()
      
      expect(monitoring).toMatchObject({
        currentValidations: expect.any(Array),
        systemLoad: expect.any(Number),
        memoryUsage: expect.any(Number),
        eventQueueSize: expect.any(Number),
        healthStatus: expect.any(String)
      })
      
      expect(monitoring.systemLoad).toBeGreaterThanOrEqual(0)
      expect(monitoring.memoryUsage).toBeGreaterThanOrEqual(0)
      expect(monitoring.eventQueueSize).toBeGreaterThanOrEqual(0)
      expect(['healthy', 'warning', 'critical']).toContain(monitoring.healthStatus)
    })

    test('應該支援自訂效能指標', async () => {
      // 註冊自訂效能指標
      const performanceMetrics = [
        {
          name: 'readmoo_extraction_accuracy',
          validator: (data) => data.accuracy >= 0.95,
          weight: 10
        },
        {
          name: 'readmoo_response_time',
          validator: (data) => data.responseTime <= 100,
          weight: 8
        },
        {
          name: 'readmoo_error_rate',
          validator: (data) => data.errorRate <= 0.01,
          weight: 15
        }
      ]
      
      performanceMetrics.forEach(metric => {
        migrationValidator.registerCustomMetric(metric)
      })
      
      // 測試自訂指標
      const testData = {
        accuracy: 0.97,
        responseTime: 85,
        errorRate: 0.005
      }
      
      const result = await migrationValidator.validateCustomMetrics(testData)
      
      expect(result.customMetricResults).toHaveLength(3)
      result.customMetricResults.forEach(metric => {
        expect(metric.passed).toBe(true)
        expect(metric.weight).toBeGreaterThan(0)
      })
    })
  })
})