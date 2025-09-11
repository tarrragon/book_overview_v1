/**
 * performance-utils.test.js
 *
 * 測試 performance-utils 工具模組
 * 負責測試效能監控和記憶體管理功能
 */

describe('PerformanceUtils', () => {
  let PerformanceUtils

  beforeEach(() => {
    jest.clearAllMocks()

    // 清除模組快取
    delete require.cache[require.resolve('src/content/utils/performance-utils')]

    // Mock performance API
    global.performance = {
      now: jest.fn(() => Date.now()),
      mark: jest.fn(),
      measure: jest.fn(),
      getEntriesByType: jest.fn(() => []),
      clearMarks: jest.fn(),
      clearMeasures: jest.fn(),
      memory: {
        usedJSHeapSize: 1024 * 1024 * 10, // 10MB
        totalJSHeapSize: 1024 * 1024 * 50, // 50MB
        jsHeapSizeLimit: 1024 * 1024 * 100 // 100MB
      }
    }

    PerformanceUtils = require('src/content/utils/performance-utils')
  })

  describe('計時器功能', () => {
    test('建立和開始計時器', () => {
      const timerId = PerformanceUtils.startTimer('test-operation')

      expect(typeof timerId).toBe('string')
      expect(timerId).toMatch(/^test-operation-\d+-[a-z0-9]+$/)
      expect(PerformanceUtils.hasActiveTimer(timerId)).toBe(true)
    })

    test('停止計時器並取得執行時間', () => {
      global.performance.now = jest.fn()
        .mockReturnValueOnce(1000) // 開始時間
        .mockReturnValueOnce(1500) // 結束時間

      const timerId = PerformanceUtils.startTimer('test-operation')
      const duration = PerformanceUtils.stopTimer(timerId)

      expect(duration).toBe(500)
      expect(PerformanceUtils.hasActiveTimer(timerId)).toBe(false)
    })

    test('取得計時器統計資料', () => {
      global.performance.now = jest.fn()
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1200)
        .mockReturnValueOnce(2000)
        .mockReturnValueOnce(2300)

      const timer1 = PerformanceUtils.startTimer('operation-1')
      PerformanceUtils.stopTimer(timer1)

      const timer2 = PerformanceUtils.startTimer('operation-1')
      PerformanceUtils.stopTimer(timer2)

      const stats = PerformanceUtils.getTimerStats('operation-1')
      expect(stats.count).toBe(2)
      expect(stats.totalTime).toBe(500) // 200 + 300
      expect(stats.averageTime).toBe(250)
      expect(stats.minTime).toBe(200)
      expect(stats.maxTime).toBe(300)
    })

    test('清除計時器統計', () => {
      const timerId = PerformanceUtils.startTimer('test-clear')
      PerformanceUtils.stopTimer(timerId)

      PerformanceUtils.clearTimerStats('test-clear')

      const stats = PerformanceUtils.getTimerStats('test-clear')
      expect(stats.count).toBe(0)
      expect(stats.totalTime).toBe(0)
    })
  })

  describe('記憶體監控功能', () => {
    test('取得當前記憶體使用量', () => {
      const memoryInfo = PerformanceUtils.getMemoryUsage()

      expect(memoryInfo).toHaveProperty('usedJSHeapSize')
      expect(memoryInfo).toHaveProperty('totalJSHeapSize')
      expect(memoryInfo).toHaveProperty('jsHeapSizeLimit')
      expect(memoryInfo).toHaveProperty('usagePercentage')
      expect(memoryInfo.usagePercentage).toBeGreaterThanOrEqual(0)
      expect(memoryInfo.usagePercentage).toBeLessThanOrEqual(100)
    })

    test('記錄記憶體快照', () => {
      PerformanceUtils.takeMemorySnapshot('before-operation')
      PerformanceUtils.takeMemorySnapshot('after-operation')

      const snapshots = PerformanceUtils.getMemorySnapshots()
      expect(snapshots).toHaveLength(2)
      expect(snapshots[0].label).toBe('before-operation')
      expect(snapshots[1].label).toBe('after-operation')
    })

    test('計算記憶體差異', () => {
      global.performance.memory = {
        usedJSHeapSize: 1024 * 1024 * 10, // 10MB
        totalJSHeapSize: 1024 * 1024 * 50,
        jsHeapSizeLimit: 1024 * 1024 * 100
      }
      PerformanceUtils.takeMemorySnapshot('start')

      global.performance.memory = {
        usedJSHeapSize: 1024 * 1024 * 15, // 15MB
        totalJSHeapSize: 1024 * 1024 * 50,
        jsHeapSizeLimit: 1024 * 1024 * 100
      }
      PerformanceUtils.takeMemorySnapshot('end')

      const diff = PerformanceUtils.getMemoryDifference('start', 'end')
      expect(diff.usedHeapDiff).toBe(1024 * 1024 * 5) // 5MB increase
      expect(diff.diffMB).toBe(5)
    })

    test('記憶體洩漏檢測', () => {
      // 模擬記憶體增長
      const baseMem = 1024 * 1024 * 10
      const samples = []

      for (let i = 0; i < 5; i++) {
        const memSize = baseMem + (i * 1024 * 1024 * 2)
        samples.push(memSize)
      }

      const hasLeak = PerformanceUtils.detectMemoryLeak(samples)
      expect(hasLeak).toBe(true)
    })
  })

  describe('效能標記功能', () => {
    test('建立效能標記', () => {
      expect(() => PerformanceUtils.mark('operation-start')).not.toThrow()
    })

    test('測量兩個標記間的時間', () => {
      expect(() => {
        PerformanceUtils.mark('start')
        PerformanceUtils.mark('end')
        PerformanceUtils.measure('operation-duration', 'start', 'end')
      }).not.toThrow()
    })

    test('清除效能標記', () => {
      expect(() => {
        PerformanceUtils.mark('test-mark')
        PerformanceUtils.clearMarks('test-mark')
      }).not.toThrow()
    })
  })

  describe('效能統計功能', () => {
    test('追蹤操作執行次數', () => {
      PerformanceUtils.incrementCounter('api-calls')
      PerformanceUtils.incrementCounter('api-calls')
      PerformanceUtils.incrementCounter('api-calls')

      const count = PerformanceUtils.getCounter('api-calls')
      expect(count).toBe(3)
    })

    test('記錄效能指標', () => {
      PerformanceUtils.recordMetric('response-time', 250)
      PerformanceUtils.recordMetric('response-time', 300)
      PerformanceUtils.recordMetric('response-time', 200)

      const metrics = PerformanceUtils.getMetrics('response-time')
      expect(metrics.count).toBe(3)
      expect(metrics.average).toBe(250)
      expect(metrics.min).toBe(200)
      expect(metrics.max).toBe(300)
    })

    test('取得效能報告', () => {
      // 建立一些測試資料
      PerformanceUtils.incrementCounter('operations')
      PerformanceUtils.recordMetric('latency', 100)
      PerformanceUtils.takeMemorySnapshot('test')

      const report = PerformanceUtils.getPerformanceReport()

      expect(report).toHaveProperty('counters')
      expect(report).toHaveProperty('metrics')
      expect(report).toHaveProperty('timers')
      expect(report).toHaveProperty('memory')
      expect(report.counters.operations).toBe(1)
      expect(report.metrics.latency.count).toBe(1)
    })
  })

  describe('資源監控功能', () => {
    test('監控 DOM 節點數量', () => {
      // 簡單地測試函數不會出錯
      expect(() => PerformanceUtils.getDOMNodeCount()).not.toThrow()

      // 測試返回值是數字
      const nodeCount = PerformanceUtils.getDOMNodeCount()
      expect(typeof nodeCount).toBe('number')
      expect(nodeCount).toBeGreaterThanOrEqual(0)
    })

    test('監控事件監聽器數量', () => {
      const listenerCount = PerformanceUtils.trackEventListeners('click', 1)
      expect(listenerCount).toBe(1)

      PerformanceUtils.trackEventListeners('click', 2)
      const totalCount = PerformanceUtils.getEventListenerCount('click')
      expect(totalCount).toBe(3)
    })

    test('檢測長時間運行的任務', () => {
      const longRunningTasks = []

      PerformanceUtils.detectLongTasks((task) => {
        longRunningTasks.push(task)
      })

      // 模擬長任務
      global.performance.getEntriesByType = jest.fn().mockReturnValue([
        { name: 'long-task', duration: 100, startTime: 1000 }
      ])

      // 觸發檢測
      PerformanceUtils.checkForLongTasks()
      expect(longRunningTasks).toHaveLength(1)
    })
  })

  describe('錯誤處理', () => {
    test('處理無效的計時器 ID', () => {
      const duration = PerformanceUtils.stopTimer('invalid-timer-id')
      expect(duration).toBe(0)
    })

    test('處理記憶體 API 不可用的情況', () => {
      delete global.performance.memory

      const memoryInfo = PerformanceUtils.getMemoryUsage()
      expect(memoryInfo.usedJSHeapSize).toBe(0)
      expect(memoryInfo.totalJSHeapSize).toBe(0)
      expect(memoryInfo.usagePercentage).toBe(0)
    })

    test('處理效能 API 不可用的情況', () => {
      global.performance.now = undefined

      expect(() => PerformanceUtils.startTimer('test')).not.toThrow()
      expect(() => PerformanceUtils.mark('test')).not.toThrow()
    })

    test('處理無效的記憶體快照標籤', () => {
      const diff = PerformanceUtils.getMemoryDifference('invalid-start', 'invalid-end')
      expect(diff.usedHeapDiff).toBe(0)
      expect(diff.diffMB).toBe(0)
    })
  })

  describe('效能優化功能', () => {
    test('偵測效能瓶頸', () => {
      // 記錄一些慢的操作
      PerformanceUtils.recordMetric('slow-operation', 1000)
      PerformanceUtils.recordMetric('slow-operation', 1200)
      PerformanceUtils.recordMetric('fast-operation', 50)

      const bottlenecks = PerformanceUtils.detectBottlenecks()
      expect(bottlenecks).toContain('slow-operation')
      expect(bottlenecks).not.toContain('fast-operation')
    })

    test('建議效能優化', () => {
      // 清理現有狀態
      PerformanceUtils.clearAllStats()

      // 測試只有事件監聽器的建議
      PerformanceUtils.trackEventListeners('click', 1000) // 大量事件監聽器

      let suggestions = PerformanceUtils.getOptimizationSuggestions()
      expect(suggestions).toContain('減少事件監聽器數量')

      // 清理並測試記憶體建議
      PerformanceUtils.clearAllStats()

      // 模擬高記憶體使用
      const originalGetMemoryUsage = PerformanceUtils.getMemoryUsage
      PerformanceUtils.getMemoryUsage = jest.fn(() => ({
        usedJSHeapSize: 1024 * 1024 * 85, // 85MB
        totalJSHeapSize: 1024 * 1024 * 100, // 100MB
        jsHeapSizeLimit: 1024 * 1024 * 100,
        usagePercentage: 85 // 85%
      }))

      suggestions = PerformanceUtils.getOptimizationSuggestions()
      expect(suggestions).toContain('減少記憶體使用')

      // 恢復原始函數
      PerformanceUtils.getMemoryUsage = originalGetMemoryUsage
    })

    test('效能基準測試', () => {
      // Mock performance.now to return incremental values
      let callCount = 0
      global.performance.now = jest.fn(() => {
        return callCount++ * 10 // Each call returns 10ms more
      })

      const benchmarkResult = PerformanceUtils.benchmark('test-function', () => {
        // 模擬一些運算
        let sum = 0
        for (let i = 0; i < 1000; i++) {
          sum += i
        }
        return sum
      }, 5) // 執行 5 次

      expect(benchmarkResult.iterations).toBe(5)
      expect(benchmarkResult.averageTime).toBeGreaterThan(0)
      expect(benchmarkResult.minTime).toBeGreaterThan(0)
      expect(benchmarkResult.maxTime).toBeGreaterThan(0)
    })
  })
})
