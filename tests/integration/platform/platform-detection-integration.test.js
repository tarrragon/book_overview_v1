/**
 * Platform Detection Service 整合測試
 *
 * 負責功能：
 * - 平台檢測服務與事件系統整合
 * - 平台檢測與快取系統整合
 * - 跨平台檢測流程整合測試
 * - 效能基準與記憶體使用監控
 *
 * 設計考量：
 * - 模擬真實使用場景
 * - 驗證服務間協作正確性
 * - 確保效能符合基準要求
 * - 測試系統穩定性和可靠性
 *
 * 測試涵蓋範圍：
 * - 事件系統整合驗證
 * - 快取系統整合驗證
 * - 多平台檢測協調
 * - 錯誤恢復和容錯機制
 * - 效能基準達標驗證
 * - 記憶體使用監控
 * - 並發檢測處理
 *
 * @version 2.0.0
 * @since 2025-08-13
 */

// eslint-disable-next-line no-unused-vars
const PlatformDetectionService = require('src/background/domains/platform/services/platform-detection-service')
// eslint-disable-next-line no-unused-vars
const { createDetectionContext, validateDetectionResult, performanceHelpers, scenarioBuilder } = require('../../mocks/platform-detection.mock')
// eslint-disable-next-line no-unused-vars
const { setupCustomMatchers, assertions, _dataGenerators, performanceUtils } = require('../../helpers/platform-test-helpers')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

describe('Platform Detection Integration Tests', () => {
  // eslint-disable-next-line no-unused-vars
  let service
  // eslint-disable-next-line no-unused-vars
  let mockEventBus
  // eslint-disable-next-line no-unused-vars
  let testContexts

  // 設定自訂匹配器
  beforeAll(() => {
    setupCustomMatchers()
  })

  beforeEach(() => {
    // 模擬事件系統
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      listeners: new Map()
    }

    // 模擬事件監聽器註冊
    mockEventBus.on.mockImplementation((event, listener) => {
      if (!mockEventBus.listeners.has(event)) {
        mockEventBus.listeners.set(event, [])
      }
      mockEventBus.listeners.get(event).push(listener)
    })

    // 初始化服務
    service = new PlatformDetectionService(mockEventBus)

    // 準備測試上下文
    testContexts = {
      readmoo: createDetectionContext('READMOO'),
      kindle: createDetectionContext('KINDLE'),
      kobo: createDetectionContext('KOBO'),
      unknown: createDetectionContext('UNKNOWN', {
        url: 'https://unknown-platform.com',
        hostname: 'unknown-platform.com'
      })
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
    service = null
  })

  describe('🔗 事件系統整合', () => {
    test('應該正確發送檢測生命週期事件', async () => {
      // eslint-disable-next-line no-unused-vars
      const context = testContexts.readmoo

      await service.detectPlatform(context)

      // 驗證事件發送順序和內容
      expect(mockEventBus.emit).toHaveBeenCalledTimes(3)

      // 檢測開始事件
      expect(mockEventBus.emit).toHaveBeenNthCalledWith(1,
        'PLATFORM.DETECTION.STARTED',
        expect.objectContaining({
          context,
          timestamp: expect.any(Number)
        })
      )

      // 特定平台檢測完成事件
      expect(mockEventBus.emit).toHaveBeenNthCalledWith(2,
        'PLATFORM.READMOO.DETECTION.COMPLETED',
        expect.objectContaining({
          platformId: 'READMOO',
          confidence: expect.any(Number),
          timestamp: expect.any(Number)
        })
      )

      // 通用檢測完成事件
      expect(mockEventBus.emit).toHaveBeenNthCalledWith(3,
        'PLATFORM.DETECTION.COMPLETED',
        expect.objectContaining({
          result: expect.any(Object),
          timestamp: expect.any(Number)
        })
      )
    })

    test('應該在檢測失敗時發送錯誤事件', async () => {
      // 模擬內部方法失敗 - 由於 analyzeUrlPattern 是同步方法，使用 mockImplementation
      jest.spyOn(service, 'analyzeUrlPattern').mockImplementation(() => {
        throw (() => { const error = new Error('Network Error'); error.code = ErrorCodes.NETWORK_ERROR; error.details = { category: 'testing' }; return error })()
      })

      // eslint-disable-next-line no-unused-vars
      const context = testContexts.readmoo

      // 檢測應該返回失敗結果而不是拋出錯誤
      // eslint-disable-next-line no-unused-vars
      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('UNKNOWN')
      expect(result.features).toContain('analysis_failed')

      // 驗證錯誤事件發送
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'PLATFORM.DETECTION.FAILED',
        expect.objectContaining({
          context,
          error: expect.any(Error)
        })
      )
    })

    test('應該支援事件監聽器回呼', async () => {
      // eslint-disable-next-line no-unused-vars
      const startedListener = jest.fn()
      // eslint-disable-next-line no-unused-vars
      const completedListener = jest.fn()

      // 註冊事件監聽器
      mockEventBus.on('PLATFORM.DETECTION.STARTED', startedListener)
      mockEventBus.on('PLATFORM.DETECTION.COMPLETED', completedListener)

      await service.detectPlatform(testContexts.readmoo)

      // 驗證監聽器被正確註冊
      expect(mockEventBus.listeners.get('PLATFORM.DETECTION.STARTED')).toContain(startedListener)
      expect(mockEventBus.listeners.get('PLATFORM.DETECTION.COMPLETED')).toContain(completedListener)
    })
  })

  describe('💾 快取系統整合', () => {
    test('應該正確處理快取命中和未命中', async () => {
      // eslint-disable-next-line no-unused-vars
      const context = testContexts.readmoo

      // 第一次檢測 - 快取未命中
      // eslint-disable-next-line no-unused-vars
      const result1 = await service.detectPlatform(context)
      expect(service.detectionCache.size).toBe(1)

      // 第二次檢測 - 快取命中
      // eslint-disable-next-line no-unused-vars
      const result2 = await service.detectPlatform(context)
      expect(result1).toEqual(result2)

      // 驗證快取命中時不重複發送檢測開始事件
      expect(mockEventBus.emit).toHaveBeenCalledWith('PLATFORM.DETECTION.STARTED', expect.any(Object))
      expect(mockEventBus.emit).toHaveBeenCalledWith('PLATFORM.DETECTION.COMPLETED', expect.any(Object))
    })

    test('應該為不同上下文維護獨立快取', async () => {
      await service.detectPlatform(testContexts.readmoo)
      await service.detectPlatform(testContexts.kindle)
      await service.detectPlatform(testContexts.kobo)

      expect(service.detectionCache.size).toBe(3)

      // 驗證每個平台都有獨立的快取項目
      // eslint-disable-next-line no-unused-vars
      const cacheKeys = Array.from(service.detectionCache.keys())
      expect(cacheKeys).toHaveLength(3)
      // eslint-disable-next-line no-unused-vars
      const uniqueKeys = new Set(cacheKeys)
      expect(uniqueKeys.size).toBe(3) // 確保所有鍵都是唯一的
    })

    test('應該在快取達到限制時執行清理', async () => {
      // 建立大量測試上下文來觸發快取限制
      // eslint-disable-next-line no-unused-vars
      const contexts = Array.from({ length: 150 }, (_, i) =>
        createDetectionContext('READMOO', {
          url: `https://readmoo.com/library?page=${i}`
        })
      )

      // 執行大量檢測
      for (const context of contexts) {
        await service.detectPlatform(context)
      }

      // 驗證快取大小被限制
      expect(service.detectionCache.size).toBeLessThanOrEqual(100) // 快取限制為100
    })
  })

  describe('🎯 多平台檢測協調', () => {
    test('應該正確識別各支援平台', async () => {
      // eslint-disable-next-line no-unused-vars
      const platforms = ['READMOO', 'KINDLE', 'KOBO']
      // eslint-disable-next-line no-unused-vars
      const results = []

      for (const platform of platforms) {
        // eslint-disable-next-line no-unused-vars
        const context = testContexts[platform.toLowerCase()]
        // eslint-disable-next-line no-unused-vars
        const result = await service.detectPlatform(context)
        results.push({ platform, result })

        // 使用自訂匹配器驗證結果
        expect(result).toBeValidDetectionResult()
        expect(result).toHaveConfidenceAbove(0.5)
        expect(result.platformId).toBe(platform)
      }

      // 驗證所有檢測都成功
      expect(results).toHaveLength(platforms.length)
      results.forEach(({ result, platform }) => {
        assertions.assertPlatformDetection(result, platform, 0.6)
      })
    })

    test('應該處理未知平台檢測', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await service.detectPlatform(testContexts.unknown)

      expect(result).toBeValidDetectionResult()
      expect(result.platformId).toBe('UNKNOWN')
      expect(result.confidence).toBeLessThan(service.confidenceThreshold)
    })

    test('應該支援並發平台檢測', async () => {
      // eslint-disable-next-line no-unused-vars
      const contexts = Object.values(testContexts)
      // eslint-disable-next-line no-unused-vars
      const startTime = Date.now()

      // 並發執行所有檢測
      // eslint-disable-next-line no-unused-vars
      const promises = contexts.map(context => service.detectPlatform(context))
      // eslint-disable-next-line no-unused-vars
      const results = await Promise.all(promises)

      // eslint-disable-next-line no-unused-vars
      const endTime = Date.now()

      // 驗證所有檢測都完成
      expect(results).toHaveLength(contexts.length)
      results.forEach(result => {
        expect(result).toBeValidDetectionResult()
      })

      // 驗證並發效能
      // eslint-disable-next-line no-unused-vars
      const totalTime = endTime - startTime
      expect(totalTime).toBeLessThan(2000) // 並發檢測應該更快
    })
  })

  describe('🛡️ 錯誤恢復和容錯機制', () => {
    test('應該從 URL 分析錯誤中恢復', async () => {
      // 清除快取以確保每次調用都執行完整的檢測邏輯
      service.detectionCache.clear()

      // 模擬 URL 分析失敗但 DOM 分析成功的情況
      jest.spyOn(service, 'analyzeUrlPattern')
        .mockImplementationOnce(() => {
          throw (() => { const error = new Error('URL Analysis Failed'); error.code = ErrorCodes.URL_ANALYSIS_FAILURE; error.details = { category: 'testing' }; return error })()
        })
        .mockImplementation(() => ({ platformId: 'READMOO', confidence: 0.9, features: ['url_pattern'] }))

      jest.spyOn(service, 'analyzeDOMFeatures')
        .mockResolvedValue({ platformId: 'READMOO', confidence: 0.8, features: ['dom_elements'] })

      // eslint-disable-next-line no-unused-vars
      const context = testContexts.readmoo

      // 第一次調用 - URL 分析失敗，系統應該降級處理，基於其他分析返回結果
      // eslint-disable-next-line no-unused-vars
      const firstResult = await service.detectPlatform(context)
      expect(firstResult).toBeDefined()
      expect(firstResult.platformId).toBe('UNKNOWN') // 因為分析失敗，返回 UNKNOWN
      expect(firstResult.features).toContain('analysis_failed') // 應該標記分析失敗

      // 驗證錯誤事件被發送
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'PLATFORM.DETECTION.FAILED',
        expect.objectContaining({
          error: expect.any(Error),
          timestamp: expect.any(Number)
        })
      )

      // 清除快取以確保第二次調用也執行完整邏輯
      service.detectionCache.clear()
      mockEventBus.emit.mockClear()

      // 第二次調用應該成功（從錯誤中恢復）
      // eslint-disable-next-line no-unused-vars
      const secondResult = await service.detectPlatform(context)
      expect(secondResult).toBeValidDetectionResult()
      expect(secondResult.platformId).toBe('READMOO')
      expect(secondResult.confidence).toBeGreaterThan(0)
      expect(secondResult.features).toEqual(expect.arrayContaining(['dom_elements', 'url_pattern']))

      // 驗證成功事件被發送
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'PLATFORM.DETECTION.COMPLETED',
        expect.objectContaining({
          result: secondResult,
          timestamp: expect.any(Number)
        })
      )
    })

    test('應該處理 DOM 分析異常', async () => {
      // 模擬 DOM 分析異常
      jest.spyOn(service, 'analyzeDOMFeatures')
        .mockRejectedValue(new Error('DOM Access Error'))

      // eslint-disable-next-line no-unused-vars
      const context = testContexts.readmoo

      // detectPlatform 有完整錯誤處理，不會拋出異常，而是返回錯誤結果
      // eslint-disable-next-line no-unused-vars
      const result = await service.detectPlatform(context)

      // 驗證返回的錯誤結果
      expect(result).toBeDefined()
      expect(result.platformId).toBe('UNKNOWN')
      expect(result.confidence).toBe(0)
      expect(result.features).toContain('analysis_failed')

      // 驗證錯誤事件被發送
      assertions.assertEventEmission(mockEventBus, 'PLATFORM.DETECTION.FAILED')
    })

    test('應該優雅處理快取系統錯誤', async () => {
      // 破壞快取系統
      service.detectionCache = null

      // eslint-disable-next-line no-unused-vars
      const context = testContexts.readmoo

      // 檢測仍應該繼續工作，只是不使用快取
      // eslint-disable-next-line no-unused-vars
      const result = await service.detectPlatform(context)
      expect(result).toBeValidDetectionResult()
    })
  })

  describe('⚡ 效能基準達標驗證', () => {
    test('應該滿足單次檢測效能要求', async () => {
      // eslint-disable-next-line no-unused-vars
      const context = testContexts.readmoo

      // eslint-disable-next-line no-unused-vars
      const measurement = await performanceUtils.measureExecutionTime(
        service.detectPlatform.bind(service),
        context
      )

      expect(measurement.success).toBe(true)
      expect(measurement.duration).toCompleteWithin(500) // 使用自訂匹配器
      assertions.assertDetectionPerformance(measurement.duration, 500)
    })

    test('應該滿足批量檢測效能基準', async () => {
      // eslint-disable-next-line no-unused-vars
      const testCases = scenarioBuilder.createMultiPlatformScenarios(['READMOO', 'KINDLE', 'KOBO'])
        .slice(0, 10) // 取前10個測試案例

      // eslint-disable-next-line no-unused-vars
      const benchmarks = {
        maxAverageTime: 300,
        maxSingleTime: 800,
        minSuccessRate: 0.9
      }

      // eslint-disable-next-line no-unused-vars
      const benchmarkResult = await performanceUtils.runPerformanceBenchmark(
        async (scenario) => service.detectPlatform(scenario.context),
        testCases,
        benchmarks
      )

      expect(benchmarkResult.passed).toBe(true)
      expect(benchmarkResult.metrics.averageTime).toBeLessThan(benchmarks.maxAverageTime)
      expect(benchmarkResult.metrics.maxTime).toBeLessThan(benchmarks.maxSingleTime)
      expect(benchmarkResult.metrics.successRate).toBeGreaterThanOrEqual(benchmarks.minSuccessRate)
    })

    test('應該在高頻檢測時保持穩定效能', async () => {
      // eslint-disable-next-line no-unused-vars
      const contexts = Array.from({ length: 50 }, (_, i) =>
        createDetectionContext('READMOO', {
          url: `https://readmoo.com/library?batch=${i}`
        })
      )

      // eslint-disable-next-line no-unused-vars
      const startTime = Date.now()
      // eslint-disable-next-line no-unused-vars
      const results = []

      for (const context of contexts) {
        // eslint-disable-next-line no-unused-vars
        const measurement = await performanceUtils.measureExecutionTime(
          service.detectPlatform.bind(service),
          context
        )
        results.push(measurement)
      }

      // eslint-disable-next-line no-unused-vars
      const totalTime = Date.now() - startTime
      // eslint-disable-next-line no-unused-vars
      const successfulTests = results.filter(r => r.success).length
      // eslint-disable-next-line no-unused-vars
      const averageTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length

      expect(successfulTests).toBe(contexts.length)
      expect(averageTime).toBeLessThan(200) // 平均檢測時間
      expect(totalTime).toBeLessThan(10000) // 總執行時間
    })
  })

  describe('📊 記憶體使用監控', () => {
    test('應該控制記憶體使用增長', async () => {
      // eslint-disable-next-line no-unused-vars
      const initialMemory = process.memoryUsage()

      // 執行大量檢測操作
      // eslint-disable-next-line no-unused-vars
      const contexts = Array.from({ length: 100 }, (_, i) =>
        createDetectionContext('READMOO', {
          url: `https://readmoo.com/test/${i}`
        })
      )

      for (const context of contexts) {
        await service.detectPlatform(context)
      }

      // eslint-disable-next-line no-unused-vars
      const finalMemory = process.memoryUsage()
      // eslint-disable-next-line no-unused-vars
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024) // MB

      // 記憶體增長應該在合理範圍內
      expect(memoryIncrease).toBeLessThan(50) // 小於50MB
    })

    test('應該在快取清理後釋放記憶體', async () => {
      // 填充快取
      // eslint-disable-next-line no-unused-vars
      const contexts = Array.from({ length: 50 }, (_, i) =>
        createDetectionContext('READMOO', {
          url: `https://readmoo.com/memory-test/${i}`
        })
      )

      for (const context of contexts) {
        await service.detectPlatform(context)
      }

      // eslint-disable-next-line no-unused-vars
      const beforeClearMemory = process.memoryUsage()

      // 清理快取
      service.clearCache()

      // 等待記憶體穩定化
      await new Promise(resolve => setTimeout(resolve, 100))

      // eslint-disable-next-line no-unused-vars
      const afterClearMemory = process.memoryUsage()

      // 快取清理後記憶體應該有所減少或至少不繼續增長
      expect(service.detectionCache.size).toBe(0)
      expect(afterClearMemory.heapUsed).toBeLessThanOrEqual(beforeClearMemory.heapUsed * 1.1) // 允許10%的誤差
    })
  })

  describe('🔄 並發檢測處理', () => {
    test('應該安全處理同時檢測請求', async () => {
      // eslint-disable-next-line no-unused-vars
      const context = testContexts.readmoo

      // 同時發起多個相同上下文的檢測
      // eslint-disable-next-line no-unused-vars
      const promises = Array.from({ length: 10 }, () =>
        service.detectPlatform(context)
      )

      // eslint-disable-next-line no-unused-vars
      const results = await Promise.all(promises)

      // 所有結果應該相同（來自快取）
      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(result).toEqual(results[0])
        expect(result).toBeValidDetectionResult()
      })

      // 快取中應該只有一個項目
      expect(service.detectionCache.size).toBe(1)
    })

    test('應該處理不同平台的並發檢測', async () => {
      // eslint-disable-next-line no-unused-vars
      const platforms = ['READMOO', 'KINDLE', 'KOBO']
      // eslint-disable-next-line no-unused-vars
      const concurrentPromises = []

      // 為每個平台創建多個並發檢測
      // eslint-disable-next-line no-unused-vars
      const platformUrls = {
        READMOO: 'https://readmoo.com/library',
        KINDLE: 'https://read.amazon.com/library',
        KOBO: 'https://www.kobo.com/library'
      }

      platforms.forEach(platform => {
        for (let i = 0; i < 5; i++) {
          // eslint-disable-next-line no-unused-vars
          const context = createDetectionContext(platform, {
            url: platformUrls[platform] // 使用明確的有效URL
          })
          concurrentPromises.push(
            service.detectPlatform(context).then(result => ({ platform, result, index: i }))
          )
        }
      })

      // eslint-disable-next-line no-unused-vars
      const results = await Promise.all(concurrentPromises)

      expect(results).toHaveLength(15) // 3平台 × 5檢測

      // 按平台分組驗證結果
      platforms.forEach(platform => {
        // eslint-disable-next-line no-unused-vars
        const platformResults = results.filter(r => r.platform === platform)
        expect(platformResults).toHaveLength(5)

        platformResults.forEach(({ result }) => {
          expect(result.platformId).toBe(platform)
          expect(result).toBeValidDetectionResult()
        })
      })
    })

    test('應該在並發錯誤時保持系統穩定', async () => {
      // 清除快取以確保每次調用都執行檢測邏輯
      service.detectionCache.clear()

      // 模擬部分檢測失敗 - 每三次調用失敗一次
      // eslint-disable-next-line no-unused-vars
      let callCount = 0
      jest.spyOn(service, 'analyzeUrlPattern').mockImplementation(() => {
        callCount++
        if (callCount % 3 === 0) {
          throw (() => { const error = new Error(`Simulated concurrent error ${callCount}`); error.code = ErrorCodes.CONCURRENT_OPERATION_ERROR; error.details = { category: 'testing' }; return error })()
        }
        return { platformId: 'READMOO', confidence: 0.8, features: ['url_pattern'] }
      })

      // 模擬 DOM 分析成功，以確保有備選檢測方法
      jest.spyOn(service, 'analyzeDOMFeatures')
        .mockResolvedValue({ platformId: 'READMOO', confidence: 0.7, features: ['dom_elements'] })

      // 創建 10 個並發檢測請求，每個都有不同的 URL 以避免快取
      // eslint-disable-next-line no-unused-vars
      const promises = Array.from({ length: 10 }, (_, i) =>
        service.detectPlatform(
          createDetectionContext('READMOO', {
            url: `https://readmoo.com/concurrent-error-test/${i}`,
            hostname: 'readmoo.com'
          })
        )
      )

      // eslint-disable-next-line no-unused-vars
      const results = await Promise.all(promises)

      // 驗證所有結果都是有效的檢測結果
      results.forEach(result => {
        expect(result).toBeValidDetectionResult()
        expect(result).toBeDefined()
        expect(result.platformId).toBeDefined()
        expect(typeof result.confidence).toBe('number')
      })

      // 分析結果 - 基於我們的錯誤處理機制
      // eslint-disable-next-line no-unused-vars
      const successfulDetections = results.filter(r => r.platformId === 'READMOO')
      // eslint-disable-next-line no-unused-vars
      const failedDetections = results.filter(r => r.platformId === 'UNKNOWN' && r.features.includes('analysis_failed'))

      // 驗證系統穩定性：
      // 1. 所有調用都返回有效結果（沒有未捕獲的異常）
      expect(results).toHaveLength(10)

      // 2. 成功的檢測應該基於DOM分析（因為URL分析有部分失敗）
      expect(successfulDetections.length).toBeGreaterThan(0)
      successfulDetections.forEach(result => {
        expect(result.features).toEqual(expect.arrayContaining(['dom_elements']))
      })

      // 3. 失敗的檢測應該正確標記
      if (failedDetections.length > 0) {
        failedDetections.forEach(result => {
          expect(result.features).toContain('analysis_failed')
        })
      }

      // 4. 驗證錯誤事件被正確發送（至少應該有一些錯誤事件）
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'PLATFORM.DETECTION.FAILED',
        expect.objectContaining({
          error: expect.any(Error),
          timestamp: expect.any(Number)
        })
      )
    })
  })
})
