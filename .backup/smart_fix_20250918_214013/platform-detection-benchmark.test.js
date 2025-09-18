/**
 * Platform Detection Service 效能基準測試
 *
 * 負責功能：
 * - 檢測速度效能基準測試
 * - 記憶體使用量監控測試
 * - 大量檢測壓力測試
 * - 快取效率效能測試
 *
 * 設計考量：
 * - 符合 Platform Domain v2.0 效能要求
 * - 建立可重複的效能基準
 * - 監控效能回歸
 * - 提供效能調優指導
 *
 * 效能基準要求：
 * - 平均檢測時間：≤ 500ms
 * - 最大檢測時間：≤ 1000ms
 * - 快取命中率：≥ 80%
 * - 記憶體使用增長：≤ 20%
 * - 並發檢測成功率：≥ 95%
 *
 * @version 2.0.0
 * @since 2025-08-13
 */

const PlatformDetectionService = require('src/background/domains/platform/services/platform-detection-service')
const { createDetectionContext, scenarioBuilder, performanceHelpers } = require('../mocks/platform-detection.mock')
const { performanceUtils, reportGenerator } = require('../helpers/platform-test-helpers')

describe('Platform Detection Performance Benchmarks', () => {
  let service
  let mockEventBus

  // 效能基準定義
  const PERFORMANCE_BENCHMARKS = {
    platformDetection: {
      averageTime: 500, // ms - 平均檢測時間
      maxTime: 1000, // ms - 最大檢測時間
      cacheHitRate: 0.8 // 快取命中率
    },

    memoryUsage: {
      maxIncrease: 0.2, // 最大記憶體使用增長 20%
      leakTolerance: 0 // 記憶體洩漏容忍度 0%
    },

    concurrentDetection: {
      successRate: 0.95, // 並發檢測成功率
      maxResponseTime: 2000 // 並發檢測最大回應時間
    }
  }

  beforeEach(() => {
    // 模擬事件系統（簡化版，減少效能開銷）
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    }

    // 初始化服務
    service = new PlatformDetectionService(mockEventBus)
  })

  afterEach(async () => {
    jest.clearAllMocks()
    service = null

    // 等待記憶體穩定化
    await new Promise(resolve => setTimeout(resolve, 10))
  })

  describe('⚡ 檢測速度效能基準', () => {
    test('單次檢測應符合速度基準', async () => {
      const context = createDetectionContext('READMOO')

      const measurement = await performanceUtils.measureExecutionTime(
        service.detectPlatform.bind(service),
        context
      )

      expect(measurement.success).toBe(true)
      expect(measurement.duration).toBeLessThan(PERFORMANCE_BENCHMARKS.platformDetection.averageTime)

      console.log(`Single detection time: ${measurement.duration.toFixed(2)}ms`)
    })

    test('多平台檢測平均速度基準', async () => {
      const platforms = ['READMOO', 'KINDLE', 'KOBO', 'BOOKWALKER', 'BOOKS_COM']
      const contexts = platforms.map(platform => createDetectionContext(platform))

      const benchmarkResult = await performanceUtils.runPerformanceBenchmark(
        async (context) => service.detectPlatform(context),
        contexts,
        {
          maxAverageTime: PERFORMANCE_BENCHMARKS.platformDetection.averageTime,
          maxSingleTime: PERFORMANCE_BENCHMARKS.platformDetection.maxTime,
          minSuccessRate: 1.0 // 全部應該成功
        }
      )

      expect(benchmarkResult.passed).toBe(true)

      const report = reportGenerator.generatePerformanceReport(benchmarkResult)
      console.log(report)

      // 詳細基準驗證
      expect(benchmarkResult.metrics.averageTime).toBeLessThan(
        PERFORMANCE_BENCHMARKS.platformDetection.averageTime
      )
      expect(benchmarkResult.metrics.maxTime).toBeLessThan(
        PERFORMANCE_BENCHMARKS.platformDetection.maxTime
      )
    })

    test('大量檢測批量速度基準', async () => {
      // 建立100個不同的檢測場景
      const scenarios = scenarioBuilder.createMultiPlatformScenarios(['READMOO', 'KINDLE', 'KOBO'])
        .slice(0, 100)

      const startTime = Date.now()
      const results = []

      // 批量執行檢測
      for (const scenario of scenarios) {
        const measurement = await performanceUtils.measureExecutionTime(
          service.detectPlatform.bind(service),
          scenario.context
        )
        results.push(measurement)
      }

      const totalTime = Date.now() - startTime
      const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length
      const maxTime = Math.max(...results.map(r => r.duration))
      const successRate = results.filter(r => r.success).length / results.length

      console.log(`Batch test results:
        Total time: ${totalTime}ms
        Average time: ${avgTime.toFixed(2)}ms
        Max time: ${maxTime.toFixed(2)}ms
        Success rate: ${(successRate * 100).toFixed(1)}%`)

      // 驗證基準
      expect(avgTime).toBeLessThan(PERFORMANCE_BENCHMARKS.platformDetection.averageTime)
      expect(maxTime).toBeLessThan(PERFORMANCE_BENCHMARKS.platformDetection.maxTime)
      expect(successRate).toBeGreaterThanOrEqual(0.95)
    })
  })

  describe('📊 快取效率效能測試', () => {
    test('快取命中率應符合基準', async () => {
      const context = createDetectionContext('READMOO')
      const testRuns = 20
      let cacheHits = 0

      // 第一次檢測建立快取
      await service.detectPlatform(context)

      // 測量快取命中效能
      for (let i = 0; i < testRuns; i++) {
        const startTime = process.hrtime.bigint()
        await service.detectPlatform(context)
        const endTime = process.hrtime.bigint()

        const duration = Number(endTime - startTime) / 1000000 // ms

        // 快取命中應該非常快速 (< 10ms)
        if (duration < 10) {
          cacheHits++
        }
      }

      const hitRate = cacheHits / testRuns
      console.log(`Cache hit rate: ${(hitRate * 100).toFixed(1)}% (${cacheHits}/${testRuns})`)

      expect(hitRate).toBeGreaterThanOrEqual(PERFORMANCE_BENCHMARKS.platformDetection.cacheHitRate)
    })

    test('多上下文快取效率測試', async () => {
      const contexts = [
        createDetectionContext('READMOO'),
        createDetectionContext('KINDLE'),
        createDetectionContext('KOBO')
      ]

      const measurements = []

      // 首次檢測（建立快取）
      for (const context of contexts) {
        const measurement = await performanceUtils.measureExecutionTime(
          service.detectPlatform.bind(service),
          context
        )
        measurements.push({ ...measurement, type: 'cache-miss' })
      }

      // 重複檢測（快取命中）
      for (const context of contexts) {
        const measurement = await performanceUtils.measureExecutionTime(
          service.detectPlatform.bind(service),
          context
        )
        measurements.push({ ...measurement, type: 'cache-hit' })
      }

      const cacheMiss = measurements.filter(m => m.type === 'cache-miss')
      const cacheHit = measurements.filter(m => m.type === 'cache-hit')

      const avgMissTime = cacheMiss.reduce((sum, m) => sum + m.duration, 0) / cacheMiss.length
      const avgHitTime = cacheHit.reduce((sum, m) => sum + m.duration, 0) / cacheHit.length

      console.log(`Cache performance:
        Average cache miss time: ${avgMissTime.toFixed(2)}ms
        Average cache hit time: ${avgHitTime.toFixed(2)}ms
        Speed improvement: ${(avgMissTime / avgHitTime).toFixed(1)}x`)

      // 快取命中應該比未命中快至少10倍
      expect(avgHitTime * 10).toBeLessThan(avgMissTime)
      expect(avgHitTime).toBeLessThan(50) // 快取命中應該 < 50ms
    })
  })

  describe('🧠 記憶體使用量監控', () => {
    test('單次檢測記憶體使用基準', async () => {
      const memBefore = process.memoryUsage()

      const context = createDetectionContext('READMOO')
      await service.detectPlatform(context)

      const memAfter = process.memoryUsage()
      const memoryIncrease = (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024) // MB

      console.log(`Memory usage increase: ${memoryIncrease.toFixed(2)}MB`)

      // 單次檢測記憶體增長應該很小
      expect(memoryIncrease).toBeLessThan(5) // < 5MB
    })

    test('大量檢測記憶體增長控制', async () => {
      const initialMemory = process.memoryUsage()
      const contexts = Array.from({ length: 500 }, (_, i) =>
        createDetectionContext('READMOO', {
          url: `https://readmoo.com/memory-test/${i}`
        })
      )

      // 執行大量檢測
      for (const context of contexts) {
        await service.detectPlatform(context)
      }

      const finalMemory = process.memoryUsage()
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed

      console.log(`Memory usage increase: ${(memoryIncrease * 100).toFixed(1)}%`)
      console.log(`Cache size: ${service.detectionCache.size} items`)

      // 記憶體增長應該在可控範圍內
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_BENCHMARKS.memoryUsage.maxIncrease)
    })

    test('快取清理後記憶體釋放', async () => {
      // 填充快取
      const contexts = Array.from({ length: 100 }, (_, i) =>
        createDetectionContext('READMOO', {
          url: `https://readmoo.com/cache-cleanup-test/${i}`
        })
      )

      for (const context of contexts) {
        await service.detectPlatform(context)
      }

      const beforeCleanupMemory = process.memoryUsage()

      // 清理快取
      service.clearCache()

      // 等待記憶體釋放
      await new Promise(resolve => setTimeout(resolve, 100))

      const afterCleanupMemory = process.memoryUsage()
      const memoryReduction = (beforeCleanupMemory.heapUsed - afterCleanupMemory.heapUsed) / (1024 * 1024)

      console.log(`Memory reduction after cache cleanup: ${memoryReduction.toFixed(2)}MB`)

      expect(service.detectionCache.size).toBe(0)
      expect(memoryReduction).toBeGreaterThan(0) // 應該有記憶體釋放
    })
  })

  describe('🔄 並發檢測效能基準', () => {
    test('並發檢測成功率基準', async () => {
      const concurrentCount = 50
      const contexts = Array.from({ length: concurrentCount }, (_, i) =>
        createDetectionContext('READMOO', {
          url: `https://readmoo.com/concurrent-test/${i}`
        })
      )

      const startTime = Date.now()

      // 並發執行檢測
      const promises = contexts.map(context =>
        service.detectPlatform(context)
          .then(result => ({ success: true, result }))
          .catch(error => ({ success: false, error }))
      )

      const results = await Promise.all(promises)
      const endTime = Date.now()

      const successful = results.filter(r => r.success).length
      const successRate = successful / concurrentCount
      const totalTime = endTime - startTime

      console.log(`Concurrent test results:
        Success rate: ${(successRate * 100).toFixed(1)}%
        Total time: ${totalTime}ms
        Average time per detection: ${(totalTime / concurrentCount).toFixed(2)}ms`)

      // 驗證並發效能基準
      expect(successRate).toBeGreaterThanOrEqual(PERFORMANCE_BENCHMARKS.concurrentDetection.successRate)
      expect(totalTime).toBeLessThan(PERFORMANCE_BENCHMARKS.concurrentDetection.maxResponseTime)
    })

    test('高負載並發檢測穩定性', async () => {
      const highLoadCount = 200
      const platforms = ['READMOO', 'KINDLE', 'KOBO']
      const contexts = []

      // 建立多平台高負載測試案例
      for (let i = 0; i < highLoadCount; i++) {
        const platform = platforms[i % platforms.length]
        contexts.push(
          createDetectionContext(platform, {
            url: `https://mock-${platform.toLowerCase()}.com/high-load/${i}`
          })
        )
      }

      const startTime = Date.now()
      const batchSize = 20 // 分批處理減少系統負載
      const results = []

      // 分批並發執行
      for (let i = 0; i < contexts.length; i += batchSize) {
        const batch = contexts.slice(i, i + batchSize)
        const batchPromises = batch.map(context =>
          performanceUtils.measureExecutionTime(
            service.detectPlatform.bind(service),
            context
          )
        )

        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
      }

      const totalTime = Date.now() - startTime
      const successful = results.filter(r => r.success).length
      const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length
      const maxTime = Math.max(...results.map(r => r.duration))

      console.log(`High-load test results:
        Total tests: ${results.length}
        Success rate: ${(successful / results.length * 100).toFixed(1)}%
        Total time: ${totalTime}ms
        Average time: ${avgTime.toFixed(2)}ms
        Max time: ${maxTime.toFixed(2)}ms
        Cache size: ${service.detectionCache.size}`)

      // 高負載下的效能要求
      expect(successful / results.length).toBeGreaterThanOrEqual(0.90) // 90% 成功率
      expect(avgTime).toBeLessThan(800) // 平均時間可以放寬一些
      expect(maxTime).toBeLessThan(2000) // 最大時間限制
    })
  })

  describe('📈 效能回歸測試', () => {
    test('效能基準回歸檢測', async () => {
      // 執行標準化效能測試套件
      const standardTests = [
        { name: 'READMOO Detection', context: createDetectionContext('READMOO') },
        { name: 'KINDLE Detection', context: createDetectionContext('KINDLE') },
        { name: 'KOBO Detection', context: createDetectionContext('KOBO') },
        {
          name: 'Unknown Platform',
          context: createDetectionContext('UNKNOWN', {
            url: 'https://unknown-platform.com',
            hostname: 'unknown-platform.com'
          })
        }
      ]

      const results = []

      for (const test of standardTests) {
        const measurement = await performanceUtils.measureExecutionTime(
          service.detectPlatform.bind(service),
          test.context
        )
        results.push({ ...measurement, testName: test.name })
      }

      // 生成效能報告
      const report = results.map(r =>
        `${r.testName}: ${r.duration.toFixed(2)}ms ${r.success ? '✓' : '✗'}`
      ).join('\n')

      console.log(`Performance Regression Test Results:\n${report}`)

      // 驗證沒有效能回歸
      results.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.duration).toBeLessThan(PERFORMANCE_BENCHMARKS.platformDetection.maxTime)
      })

      const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length
      expect(avgTime).toBeLessThan(PERFORMANCE_BENCHMARKS.platformDetection.averageTime)
    })
  })
})
