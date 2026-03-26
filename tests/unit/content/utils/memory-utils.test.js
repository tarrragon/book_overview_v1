const { ErrorCodesWithTest: ErrorCodes } = require('@tests/helpers/test-error-codes')
/**
 * @fileoverview Memory Utils TDD 測試
 * @version v1.0.0
 * @since 2025-08-16
 *
 * TDD Red 階段：設計 memory-utils.js 的完整測試套件
 *
 * 測試目標：
 * - 記憶體使用監控和分析
 * - 快取管理和清理策略
 * - 記憶體洩漏檢測和預防
 * - Content Script 效能最佳化
 * - 資源使用統計和報告
 */

describe('MemoryUtils - TDD Red 階段測試', () => {
  let MemoryUtils

  beforeAll(() => {
    // 測試執行前載入模組
    MemoryUtils = require('src/content/utils/memory-utils.js')
  })

  beforeEach(() => {
    // 設定測試環境
    global.console = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn()
    }

    // Mock performance API
    // eslint-disable-next-line no-unused-vars
    const mockMemory = {
      usedJSHeapSize: 10000000,
      totalJSHeapSize: 20000000,
      jsHeapSizeLimit: 2147483648
    }

    global.performance = {
      memory: mockMemory,
      now: jest.fn(() => Date.now()),
      mark: jest.fn(),
      measure: jest.fn(),
      getEntriesByType: jest.fn(() => []),
      clearMarks: jest.fn(),
      clearMeasures: jest.fn()
    }

    // 清理快取和統計
    if (MemoryUtils.clearAllCaches) {
      MemoryUtils.clearAllCaches()
    }
  })

  describe('📊 記憶體監控和分析', () => {
    test('應該取得當前記憶體使用狀況（fallback模式）', () => {
      // eslint-disable-next-line no-unused-vars
      const memoryInfo = MemoryUtils.getMemoryInfo()

      // 在測試環境中可能沒有 performance.memory，應該支援 fallback
      expect(memoryInfo.success).toBeDefined()
      expect(typeof memoryInfo.success).toBe('boolean')

      if (memoryInfo.success) {
        expect(memoryInfo.percentage).toBeGreaterThanOrEqual(0)
        expect(memoryInfo.percentage).toBeLessThanOrEqual(100)
      } else {
        expect(memoryInfo.fallback).toBe(true)
        expect(memoryInfo.error).toBeDefined()
      }
    })

    test('應該追蹤記憶體使用趨勢', () => {
      // 記錄多個時間點的記憶體狀態
      MemoryUtils.recordMemorySnapshot('test-operation-1')
      MemoryUtils.recordMemorySnapshot('test-operation-2')
      MemoryUtils.recordMemorySnapshot('test-operation-3')

      // eslint-disable-next-line no-unused-vars
      const trend = MemoryUtils.getMemoryTrend()

      expect(trend).toEqual({
        snapshots: expect.any(Array),
        totalSnapshots: 3,
        timeRange: expect.any(Object), // 可能是 null 或包含時間資訊
        growth: {
          absolute: expect.any(Number),
          percentage: expect.any(Number)
        },
        peak: expect.any(Object),
        average: expect.any(Number)
      })

      expect(trend.snapshots).toHaveLength(3)
    })

    test('應該檢測記憶體使用異常', () => {
      // eslint-disable-next-line no-unused-vars
      const analysis = MemoryUtils.analyzeMemoryUsage()

      // 在 fallback 模式下應該提供基本分析
      expect(analysis).toEqual(
        expect.objectContaining({
          status: expect.any(String),
          usage: expect.any(Object),
          recommendations: expect.any(Array),
          criticalIssues: expect.any(Array),
          timestamp: expect.any(Number)
        })
      )

      // 檢查基本結構
      expect(typeof analysis.status).toBe('string')
      expect(Array.isArray(analysis.recommendations)).toBe(true)
      expect(Array.isArray(analysis.criticalIssues)).toBe(true)
    })

    test('應該計算記憶體效率指標', () => {
      // 記錄一些操作
      MemoryUtils.recordMemorySnapshot('operation-start')
      MemoryUtils.recordMemorySnapshot('operation-end')

      // eslint-disable-next-line no-unused-vars
      const efficiency = MemoryUtils.calculateMemoryEfficiency()

      expect(efficiency).toEqual({
        allocation: {
          total: expect.any(Number),
          average: expect.any(Number),
          peak: expect.any(Number)
        },
        cleanup: {
          rate: expect.any(Number),
          frequency: expect.any(Number)
        },
        fragmentation: expect.any(Number),
        score: expect.any(Number),
        grade: expect.stringMatching(/^[A-F][+-]?$/)
      })
    })
  })

  describe('💾 快取管理策略', () => {
    test('應該註冊和管理不同類型的快取', () => {
      // eslint-disable-next-line no-unused-vars
      const cacheConfig = {
        name: 'book-data-cache',
        maxSize: 100,
        ttl: 300000, // 5 分鐘
        strategy: 'LRU'
      }

      // eslint-disable-next-line no-unused-vars
      const result = MemoryUtils.registerCache(cacheConfig)

      expect(result).toEqual({
        success: true,
        cacheId: 'book-data-cache',
        config: cacheConfig,
        stats: {
          size: 0,
          hits: 0,
          misses: 0,
          evictions: 0
        }
      })
    })

    test('應該執行快取清理和優化', () => {
      // 註冊多個快取
      MemoryUtils.registerCache({ name: 'cache-1', maxSize: 50 })
      MemoryUtils.registerCache({ name: 'cache-2', maxSize: 30 })

      // 模擬快取使用
      for (let i = 0; i < 10; i++) {
        MemoryUtils.setCacheItem('cache-1', `key-${i}`, { data: `value-${i}` })
      }

      // eslint-disable-next-line no-unused-vars
      const cleanupResult = MemoryUtils.performCacheCleanup()

      expect(cleanupResult).toEqual({
        success: true,
        cleaned: expect.any(Array),
        released: expect.any(Number),
        remaining: expect.any(Number),
        strategy: expect.any(String)
      })

      // 清理結果應該是合理的數字
      expect(cleanupResult.released).toBeGreaterThanOrEqual(0)
    })

    test('應該支援 LRU 快取策略', () => {
      MemoryUtils.registerCache({
        name: 'lru-cache',
        maxSize: 3,
        strategy: 'LRU'
      })

      // 填滿快取
      MemoryUtils.setCacheItem('lru-cache', 'key1', 'value1')
      MemoryUtils.setCacheItem('lru-cache', 'key2', 'value2')
      MemoryUtils.setCacheItem('lru-cache', 'key3', 'value3')

      // 存取 key1 使其變成最近使用
      MemoryUtils.getCacheItem('lru-cache', 'key1')

      // 加入新項目應該移除 key2
      MemoryUtils.setCacheItem('lru-cache', 'key4', 'value4')

      // eslint-disable-next-line no-unused-vars
      const item2 = MemoryUtils.getCacheItem('lru-cache', 'key2')
      // eslint-disable-next-line no-unused-vars
      const item1 = MemoryUtils.getCacheItem('lru-cache', 'key1')
      // eslint-disable-next-line no-unused-vars
      const item4 = MemoryUtils.getCacheItem('lru-cache', 'key4')

      expect(item2.found).toBe(false) // 應該被清除
      expect(item1.found).toBe(true) // 應該保留
      expect(item4.found).toBe(true) // 新項目
    })

    test('應該監控快取效能指標', () => {
      MemoryUtils.registerCache({ name: 'perf-cache', maxSize: 100 })

      // 執行一些快取操作
      MemoryUtils.setCacheItem('perf-cache', 'test-key', 'test-value')
      MemoryUtils.getCacheItem('perf-cache', 'test-key') // hit
      MemoryUtils.getCacheItem('perf-cache', 'missing-key') // miss

      // eslint-disable-next-line no-unused-vars
      const stats = MemoryUtils.getCacheStats('perf-cache')

      expect(stats).toEqual({
        size: 1,
        maxSize: 100,
        hits: 1,
        misses: 1,
        hitRate: 0.5,
        evictions: 0,
        memory: expect.any(Number),
        lastAccess: expect.any(Number)
      })
    })
  })

  describe('🔍 記憶體洩漏檢測', () => {
    test('應該檢測潛在的記憶體洩漏', () => {
      // 模擬記憶體快照序列
      for (let i = 0; i < 10; i++) {
        MemoryUtils.recordMemorySnapshot(`leak-test-${i}`)
      }

      // eslint-disable-next-line no-unused-vars
      const leakDetection = MemoryUtils.detectMemoryLeaks()

      expect(leakDetection).toEqual({
        hasLeaks: expect.any(Boolean),
        severity: expect.stringMatching(/^(LOW|MEDIUM|HIGH|CRITICAL)$/),
        indicators: {
          continuousGrowth: expect.any(Boolean),
          abnormalSpikes: expect.any(Boolean),
          slowCleanup: expect.any(Boolean)
        },
        analysis: {
          growthRate: expect.any(Number),
          peakGrowth: expect.any(Number),
          cleanupEfficiency: expect.any(Number)
        },
        recommendations: expect.any(Array)
      })
    })

    test('應該追蹤 DOM 節點洩漏', () => {
      // 模擬 DOM 節點建立和刪除
      // eslint-disable-next-line no-unused-vars
      const container = document.createElement('div')
      document.body.appendChild(container)

      MemoryUtils.trackDOMNodes('test-container')

      // 建立大量節點
      for (let i = 0; i < 100; i++) {
        // eslint-disable-next-line no-unused-vars
        const node = document.createElement('div')
        node.textContent = `Node ${i}`
        container.appendChild(node)
      }

      MemoryUtils.trackDOMNodes('test-container-filled')

      // eslint-disable-next-line no-unused-vars
      const domAnalysis = MemoryUtils.analyzeDOMNodeLeaks()

      expect(domAnalysis).toEqual({
        nodeCount: expect.any(Number),
        growth: expect.any(Number),
        orphanNodes: expect.any(Number),
        eventListeners: expect.any(Number),
        recommendations: expect.any(Array)
      })
    })

    test('應該檢查事件監聽器洩漏', () => {
      // eslint-disable-next-line no-unused-vars
      const mockElement = document.createElement('div')
      // eslint-disable-next-line no-unused-vars
      const mockHandler = jest.fn()

      // 模擬事件監聽器註冊
      MemoryUtils.trackEventListener(mockElement, 'click', mockHandler)
      MemoryUtils.trackEventListener(mockElement, 'scroll', mockHandler)

      // eslint-disable-next-line no-unused-vars
      const listenerAnalysis = MemoryUtils.analyzeEventListeners()

      expect(listenerAnalysis).toEqual({
        total: 2,
        byType: {
          click: 1,
          scroll: 1
        },
        orphaned: expect.any(Number),
        recommendations: expect.any(Array)
      })
    })
  })

  describe('⚡ 效能最佳化', () => {
    test('應該監控執行時間', () => {
      MemoryUtils.startTimer('test-operation')

      // 模擬一些工作
      // eslint-disable-next-line no-unused-vars
      let sum = 0
      for (let i = 0; i < 1000; i++) {
        // eslint-disable-next-line no-unused-vars
        sum += i
      }

      // eslint-disable-next-line no-unused-vars
      const timing = MemoryUtils.endTimer('test-operation')

      expect(timing).toEqual({
        success: true,
        duration: expect.any(Number),
        operation: 'test-operation',
        timestamp: expect.any(Number)
      })

      expect(timing.duration).toBeGreaterThan(0)
    })

    test('應該測量函數執行效能', () => {
      // eslint-disable-next-line no-unused-vars
      const testFunction = () => {
        // eslint-disable-next-line no-unused-vars
        let result = 0
        for (let i = 0; i < 10000; i++) {
          result += Math.sqrt(i)
        }
        return result
      }

      // eslint-disable-next-line no-unused-vars
      const performance = MemoryUtils.measurePerformance(testFunction, 'math-calculation')

      expect(performance).toEqual({
        result: expect.any(Number),
        timing: {
          duration: expect.any(Number),
          operation: 'math-calculation'
        },
        memory: {
          before: expect.any(Number),
          after: expect.any(Number),
          delta: expect.any(Number)
        }
      })
    })

    test('應該批量測量多次執行', () => {
      // eslint-disable-next-line no-unused-vars
      const simpleFunction = () => Math.random()

      // eslint-disable-next-line no-unused-vars
      const benchmark = MemoryUtils.benchmark(simpleFunction, {
        iterations: 100,
        warmup: 10,
        name: 'random-generation'
      })

      expect(benchmark).toEqual({
        name: 'random-generation',
        iterations: 100,
        timing: {
          total: expect.any(Number),
          average: expect.any(Number),
          min: expect.any(Number),
          max: expect.any(Number),
          median: expect.any(Number)
        },
        memory: {
          baseline: expect.any(Number),
          peak: expect.any(Number),
          average: expect.any(Number)
        },
        throughput: expect.any(Number)
      })
    })

    test('應該建議效能優化', () => {
      // 建立一些效能問題的情境
      MemoryUtils.recordMemorySnapshot('before-heavy-operation')
      MemoryUtils.recordMemorySnapshot('after-heavy-operation')

      // eslint-disable-next-line no-unused-vars
      const suggestions = MemoryUtils.getOptimizationSuggestions()

      expect(suggestions).toEqual({
        memory: expect.any(Array),
        performance: expect.any(Array),
        caching: expect.any(Array),
        priority: expect.stringMatching(/^(LOW|MEDIUM|HIGH|CRITICAL)$/)
      })

      // 檢查建議結構是正確的
      expect(Array.isArray(suggestions.memory)).toBe(true)
      expect(Array.isArray(suggestions.performance)).toBe(true)
      expect(Array.isArray(suggestions.caching)).toBe(true)
    })
  })

  describe('📈 統計和報告', () => {
    test('應該產生記憶體使用報告', () => {
      // 建立一些資料
      MemoryUtils.recordMemorySnapshot('report-test-1')
      MemoryUtils.recordMemorySnapshot('report-test-2')

      // eslint-disable-next-line no-unused-vars
      const report = MemoryUtils.generateMemoryReport()

      expect(report).toEqual({
        summary: {
          current: expect.any(Object),
          peak: expect.any(Object),
          average: expect.any(Number),
          efficiency: expect.any(Number)
        },
        trends: {
          growth: expect.any(Number),
          volatility: expect.any(Number),
          leakIndicators: expect.any(Array)
        },
        caches: expect.any(Array),
        recommendations: expect.any(Object), // 修正為 Object 而非 Array
        timestamp: expect.any(Number)
      })
    })

    test('應該產生效能基準報告', () => {
      // 執行一些計時操作
      MemoryUtils.startTimer('operation-1')
      MemoryUtils.endTimer('operation-1')
      MemoryUtils.startTimer('operation-2')
      MemoryUtils.endTimer('operation-2')

      // eslint-disable-next-line no-unused-vars
      const performanceReport = MemoryUtils.generatePerformanceReport()

      expect(performanceReport).toEqual({
        operations: expect.any(Array),
        summary: {
          totalOperations: expect.any(Number),
          averageDuration: expect.any(Number),
          slowestOperation: expect.any(Object),
          fastestOperation: expect.any(Object)
        },
        trends: {
          performanceDegradation: expect.any(Boolean),
          bottlenecks: expect.any(Array)
        },
        recommendations: expect.any(Array)
      })
    })

    test('應該支援資源清理和重置', () => {
      // 建立一些資源
      MemoryUtils.registerCache({ name: 'cleanup-test', maxSize: 10 })
      MemoryUtils.recordMemorySnapshot('cleanup-snapshot')
      MemoryUtils.startTimer('cleanup-timer')

      // eslint-disable-next-line no-unused-vars
      const cleanupResult = MemoryUtils.cleanup()

      expect(cleanupResult).toEqual({
        success: true,
        cleared: {
          caches: expect.any(Number),
          snapshots: expect.any(Number),
          timers: expect.any(Number),
          listeners: expect.any(Number)
        },
        memoryReleased: expect.any(Number)
      })
    })
  })

  describe('⚠️ 錯誤處理和邊界情況', () => {
    test('應該處理不支援 performance.memory 的環境', () => {
      // 暫時移除 performance.memory
      // eslint-disable-next-line no-unused-vars
      const originalMemory = global.performance.memory
      delete global.performance.memory

      // eslint-disable-next-line no-unused-vars
      const memoryInfo = MemoryUtils.getMemoryInfo()

      expect(memoryInfo.success).toBe(false)
      expect(memoryInfo.error).toBeDefined()
      expect(memoryInfo.fallback).toBe(true)

      // 恢復
      global.performance.memory = originalMemory
    })

    test('應該處理無效的快取配置', () => {
      // eslint-disable-next-line no-unused-vars
      const invalidConfigs = [
        null,
        undefined,
        {},
        { name: '' },
        { name: 'test', maxSize: -1 },
        { name: 'test', maxSize: 'invalid' }
      ]

      invalidConfigs.forEach(config => {
        // eslint-disable-next-line no-unused-vars
        const result = MemoryUtils.registerCache(config)
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      })
    })

    test('應該處理計時器錯誤', () => {
      // 結束不存在的計時器
      // eslint-disable-next-line no-unused-vars
      const result = MemoryUtils.endTimer('non-existent-timer')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('應該安全處理記憶體測量異常', () => {
      // Mock performance.now 拋出錯誤
      global.performance.now = jest.fn(() => {
        throw (() => { const error = new Error('Performance API error'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
      })

      expect(() => MemoryUtils.startTimer('error-test')).not.toThrow()

      // eslint-disable-next-line no-unused-vars
      const result = MemoryUtils.startTimer('error-test')
      expect(result.success).toBe(false)
    })
  })

  describe('🧪 工具方法測試', () => {
    test('應該匯出所有必要的方法', () => {
      // eslint-disable-next-line no-unused-vars
      const requiredMethods = [
        'getMemoryInfo',
        'recordMemorySnapshot',
        'getMemoryTrend',
        'analyzeMemoryUsage',
        'calculateMemoryEfficiency',
        'registerCache',
        'setCacheItem',
        'getCacheItem',
        'performCacheCleanup',
        'getCacheStats',
        'detectMemoryLeaks',
        'trackDOMNodes',
        'analyzeDOMNodeLeaks',
        'trackEventListener',
        'analyzeEventListeners',
        'startTimer',
        'endTimer',
        'measurePerformance',
        'benchmark',
        'getOptimizationSuggestions',
        'generateMemoryReport',
        'generatePerformanceReport',
        'clearAllCaches',
        'cleanup'
      ]

      requiredMethods.forEach(methodName => {
        expect(typeof MemoryUtils[methodName]).toBe('function')
      })
    })

    test('所有方法都應該回傳一致的結果格式', () => {
      // eslint-disable-next-line no-unused-vars
      const methods = [
        () => MemoryUtils.getMemoryInfo(),
        () => MemoryUtils.registerCache({ name: 'format-test', maxSize: 10 }),
        () => MemoryUtils.startTimer('format-test')
      ]

      methods.forEach(method => {
        // eslint-disable-next-line no-unused-vars
        const result = method()
        expect(typeof result).toBe('object')
        expect(typeof result.success).toBe('boolean')
      })
    })

    test('應該安全處理各種錯誤輸入', () => {
      // eslint-disable-next-line no-unused-vars
      const invalidInputs = [null, undefined, '', 0, {}, [], NaN]

      invalidInputs.forEach(input => {
        expect(() => MemoryUtils.recordMemorySnapshot(input)).not.toThrow()
        expect(() => MemoryUtils.registerCache(input)).not.toThrow()
        expect(() => MemoryUtils.startTimer(input)).not.toThrow()
      })
    })
  })
})
