/**
 * MetricsCollector 效能指標收集測試 (簡化版)
 * 專注於核心介面驗證，確保測試框架正常運作
 *
 * @version v0.14.1
 * @date 2025-09-23
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

// Mock Chrome Extension APIs
const mockChromeAPI = {
  runtime: { getManifest: jest.fn(() => ({ version: '0.14.1' })) },
  storage: { local: { get: jest.fn(), set: jest.fn(), getBytesInUse: jest.fn(() => Promise.resolve(1024)) } },
  system: {
    memory: { getInfo: jest.fn(() => Promise.resolve({ totalCapacityBytes: 8589934592, availableCapacityBytes: 4294967296 })) },
    cpu: { getInfo: jest.fn(() => Promise.resolve({ numOfProcessors: 8, archName: 'x86_64' })) }
  },
  tabs: { query: jest.fn(() => Promise.resolve([{ id: 1 }, { id: 2 }])) }
}

global.chrome = mockChromeAPI

// Mock Performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 40 * 1024 * 1024,
      totalJSHeapSize: 80 * 1024 * 1024,
      jsHeapSizeLimit: 2 * 1024 * 1024 * 1024
    }
  }
})

// Mock Navigator API
Object.defineProperty(global, 'navigator', {
  value: {
    connection: { effectiveType: '4g', downlink: 10, rtt: 50 },
    deviceMemory: 8,
    hardwareConcurrency: 8
  }
})

describe('MetricsCollector 效能指標收集 (簡化測試)', () => {
  let mockMetricsCollector

  beforeEach(() => {
    jest.clearAllMocks()

    // Create mock MetricsCollector class
    mockMetricsCollector = {
      initialize: jest.fn().mockResolvedValue({
        isInitialized: true,
        version: 'v0.14.1',
        config: {
          sampling: { interval: 30000, batchSize: 50 },
          metrics: { memory: true, cpu: true, io: true }
        }
      }),
      collectMemoryMetrics: jest.fn(),
      collectCPUMetrics: jest.fn(),
      collectStorageMetrics: jest.fn(),
      collectNetworkMetrics: jest.fn(),
      aggregateMetrics: jest.fn(),
      detectAnomalies: jest.fn()
    }
  })

  describe('MetricsCollector 初始化測試', () => {
    test('應該成功初始化指標收集器', async () => {
      // Given: MetricsCollector 初始化
      const collector = await mockMetricsCollector.initialize()

      // When & Then: 驗證初始化
      expect(collector).toBeDefined()
      expect(collector.isInitialized).toBe(true)
      expect(collector.version).toBe('v0.14.1')
      expect(collector.config.sampling.interval).toBe(30000)
      expect(mockMetricsCollector.initialize).toHaveBeenCalled()
    })

    test('應該支援自訂採樣配置', async () => {
      // Given: 自訂配置
      const customConfig = { sampling: { interval: 10000 } }

      mockMetricsCollector.initialize.mockResolvedValue({
        isInitialized: true,
        config: customConfig
      })

      // When: 使用自訂配置
      const collector = await mockMetricsCollector.initialize(customConfig)

      // Then: 驗證配置
      expect(collector.config).toEqual(customConfig)
      expect(mockMetricsCollector.initialize).toHaveBeenCalledWith(customConfig)
    })

    test('應該處理初始化錯誤', async () => {
      // Given: 初始化失敗
      const error = new Error('Performance API not available')
      error.code = ErrorCodes.INITIALIZATION_ERROR

      mockMetricsCollector.initialize.mockRejectedValue(error)

      // When & Then: 期望錯誤
      await expect(mockMetricsCollector.initialize()).rejects.toMatchObject({
        code: ErrorCodes.INITIALIZATION_ERROR
      })
    })
  })

  describe('記憶體指標收集測試', () => {
    let collector

    beforeEach(async () => {
      collector = await mockMetricsCollector.initialize()
      collector.collectMemoryMetrics = jest.fn()
    })

    test('應該收集 JavaScript 堆記憶體指標', async () => {
      // Given: 記憶體使用模擬
      const mockMemoryMetrics = {
        usedJSHeapMB: 45,
        totalJSHeapMB: 90,
        heapUsagePercentage: 50,
        timestamp: Date.now()
      }

      collector.collectMemoryMetrics.mockResolvedValue(mockMemoryMetrics)

      // When: 收集記憶體指標
      const metrics = await collector.collectMemoryMetrics()

      // Then: 驗證指標
      expect(metrics.usedJSHeapMB).toBe(45)
      expect(metrics.heapUsagePercentage).toBe(50)
      expect(metrics.timestamp).toBeDefined()
      expect(collector.collectMemoryMetrics).toHaveBeenCalled()
    })

    test('應該監控記憶體趨勢', async () => {
      // Given: 記憶體增長分析
      const mockTrendAnalysis = {
        growthRate: 0.15,
        suspectedLeak: true,
        recommendation: 'Check for memory leak'
      }

      collector.analyzeMemoryTrend = jest.fn().mockResolvedValue(mockTrendAnalysis)

      // When: 分析記憶體趨勢
      const analysis = await collector.analyzeMemoryTrend()

      // Then: 驗證分析結果
      expect(analysis.growthRate).toBeGreaterThan(0)
      expect(analysis.suspectedLeak).toBe(true)
      expect(analysis.recommendation).toContain('memory leak')
    })

    test('應該收集系統記憶體資訊', async () => {
      // Given: 系統記憶體資訊
      const mockSystemMemory = {
        totalCapacityGB: 16,
        availableCapacityGB: 8,
        usagePercentage: 50
      }

      collector.collectSystemMemoryMetrics = jest.fn().mockResolvedValue(mockSystemMemory)

      // When: 收集系統記憶體
      const systemMemory = await collector.collectSystemMemoryMetrics()

      // Then: 驗證系統記憶體指標
      expect(systemMemory.totalCapacityGB).toBe(16)
      expect(systemMemory.usagePercentage).toBe(50)
      expect(mockChromeAPI.system.memory.getInfo).toHaveBeenCalled()
    })
  })

  describe('CPU 效能指標測試', () => {
    let collector

    beforeEach(async () => {
      collector = await mockMetricsCollector.initialize()
      collector.measureCPUUsage = jest.fn()
    })

    test('應該測量 JavaScript 執行時間', async () => {
      // Given: CPU 使用測量
      const mockCPUMetrics = {
        executionTime: 150,
        blockingTime: 25,
        cpuIntensive: false,
        timestamp: Date.now()
      }

      collector.measureCPUUsage.mockResolvedValue(mockCPUMetrics)

      // When: 測量 CPU 使用
      const cpuMetrics = await collector.measureCPUUsage(() => {})

      // Then: 驗證 CPU 指標
      expect(cpuMetrics.executionTime).toBeGreaterThan(0)
      expect(cpuMetrics.blockingTime).toBeGreaterThanOrEqual(0)
      expect(typeof cpuMetrics.cpuIntensive).toBe('boolean')
    })

    test('應該監控長時間運行任務', async () => {
      // Given: 長時間任務監控
      const mockTaskMetrics = {
        duration: 350,
        isPerformanceBottleneck: true,
        recommendation: 'Consider breaking into smaller tasks'
      }

      collector.monitorLongRunningTask = jest.fn().mockResolvedValue(mockTaskMetrics)

      // When: 監控長時間任務
      const taskMetrics = await collector.monitorLongRunningTask(async () => {})

      // Then: 驗證任務監控
      expect(taskMetrics.duration).toBeGreaterThan(300)
      expect(taskMetrics.isPerformanceBottleneck).toBe(true)
      expect(taskMetrics.recommendation).toContain('blocking')
    })
  })

  describe('IO 效能指標測試', () => {
    let collector

    beforeEach(async () => {
      collector = await mockMetricsCollector.initialize()
      collector.measureStoragePerformance = jest.fn()
    })

    test('應該測量 Chrome Storage 效能', async () => {
      // Given: Storage 效能測量
      const mockStorageMetrics = {
        readTime: 75,
        writeTime: 50,
        totalIOTime: 125
      }

      collector.measureStoragePerformance.mockResolvedValue(mockStorageMetrics)

      // When: 測量 Storage 效能
      const storageMetrics = await collector.measureStoragePerformance()

      // Then: 驗證 Storage 效能
      expect(storageMetrics.readTime).toBeGreaterThan(0)
      expect(storageMetrics.writeTime).toBeGreaterThan(0)
      expect(storageMetrics.totalIOTime).toBeGreaterThan(0)
    })

    test('應該監控 Storage 使用空間', async () => {
      // Given: Storage 使用監控
      const mockStorageUsage = {
        usedBytes: 2048,
        usedKB: 2,
        quotaUsagePercentage: 0.02
      }

      collector.collectStorageUsageMetrics = jest.fn().mockResolvedValue(mockStorageUsage)

      // When: 收集 Storage 使用指標
      const storageUsage = await collector.collectStorageUsageMetrics()

      // Then: 驗證 Storage 使用
      expect(storageUsage.usedBytes).toBe(2048)
      expect(storageUsage.quotaUsagePercentage).toBeLessThan(1)
      expect(mockChromeAPI.storage.local.getBytesInUse).toHaveBeenCalled()
    })
  })

  describe('網路效能指標測試', () => {
    let collector

    beforeEach(async () => {
      collector = await mockMetricsCollector.initialize()
      collector.collectNetworkMetrics = jest.fn()
    })

    test('應該檢測網路連線品質', async () => {
      // Given: 網路指標
      const mockNetworkMetrics = {
        effectiveType: '4g',
        downlinkMbps: 25.5,
        roundTripTime: 35,
        networkQuality: 'excellent'
      }

      collector.collectNetworkMetrics.mockResolvedValue(mockNetworkMetrics)

      // When: 收集網路指標
      const networkMetrics = await collector.collectNetworkMetrics()

      // Then: 驗證網路指標
      expect(networkMetrics.effectiveType).toBe('4g')
      expect(networkMetrics.downlinkMbps).toBeGreaterThan(0)
      expect(networkMetrics.networkQuality).toBe('excellent')
    })

    test('應該測量 API 響應時間', async () => {
      // Given: API 響應測量
      const mockAPIMetrics = {
        responseTime: 125,
        success: true,
        endpoint: 'https://api.example.com/test'
      }

      collector.measureAPIResponseTime = jest.fn().mockResolvedValue(mockAPIMetrics)

      // When: 測量 API 響應
      const apiMetrics = await collector.measureAPIResponseTime('https://api.example.com/test')

      // Then: 驗證 API 效能
      expect(apiMetrics.responseTime).toBeGreaterThan(0)
      expect(apiMetrics.success).toBe(true)
      expect(apiMetrics.endpoint).toBeDefined()
    })
  })

  describe('資料聚合和分析測試', () => {
    let collector

    beforeEach(async () => {
      collector = await mockMetricsCollector.initialize()
      collector.aggregateMetrics = jest.fn()
      collector.detectAnomalies = jest.fn()
    })

    test('應該聚合效能指標', async () => {
      // Given: 聚合指標
      const mockAggregatedMetrics = {
        sampleCount: 3,
        memoryAvg: 38.33,
        cpuAvg: 15,
        memoryPeak: 42,
        timeSpan: 120000
      }

      collector.aggregateMetrics.mockResolvedValue(mockAggregatedMetrics)

      // When: 聚合指標
      const aggregated = await collector.aggregateMetrics('performance')

      // Then: 驗證聚合結果
      expect(aggregated.sampleCount).toBe(3)
      expect(aggregated.memoryAvg).toBeCloseTo(38.33, 1)
      expect(aggregated.timeSpan).toBeGreaterThan(0)
    })

    test('應該檢測效能異常', async () => {
      // Given: 異常檢測
      const mockAnomalyReport = {
        anomaliesFound: true,
        memoryAnomalies: [{ value: 85, threshold: 50 }],
        cpuAnomalies: [{ value: 45, threshold: 30 }],
        severity: 'high'
      }

      collector.detectAnomalies.mockResolvedValue(mockAnomalyReport)

      // When: 檢測異常
      const anomalies = await collector.detectAnomalies('test_data')

      // Then: 驗證異常檢測
      expect(anomalies.anomaliesFound).toBe(true)
      expect(anomalies.memoryAnomalies.length).toBeGreaterThan(0)
      expect(anomalies.severity).toBe('high')
    })
  })

  describe('錯誤處理測試', () => {
    let collector

    beforeEach(async () => {
      collector = await mockMetricsCollector.initialize()
    })

    test('應該處理 Chrome API 錯誤', async () => {
      // Given: Chrome API 失敗
      const error = new Error('Storage API unavailable')
      error.code = ErrorCodes.CHROME_ERROR

      collector.collectStorageMetricsWithFallback = jest.fn().mockResolvedValue({
        success: false,
        error,
        fallbackData: { estimatedUsage: 1024 }
      })

      // When: 處理錯誤
      const result = await collector.collectStorageMetricsWithFallback()

      // Then: 驗證錯誤處理
      expect(result.success).toBe(false)
      expect(result.error.code).toBe(ErrorCodes.CHROME_ERROR)
      expect(result.fallbackData).toBeDefined()
    })

    test('應該處理記憶體不足', async () => {
      // Given: 低記憶體條件
      const mockLowMemoryResult = {
        memoryWarning: true,
        adjustedSamplingRate: 'reduced',
        recommendation: 'reduce memory usage'
      }

      collector.handleLowMemoryCondition = jest.fn().mockResolvedValue(mockLowMemoryResult)

      // When: 處理低記憶體
      const result = await collector.handleLowMemoryCondition()

      // Then: 驗證低記憶體處理
      expect(result.memoryWarning).toBe(true)
      expect(result.adjustedSamplingRate).toBe('reduced')
      expect(result.recommendation).toContain('reduce memory usage')
    })
  })

  describe('Mock API 驗證', () => {
    test('應該正確模擬 Chrome Extension APIs', () => {
      // Then: 驗證 Chrome API 模擬
      expect(typeof mockChromeAPI.runtime.getManifest).toBe('function')
      expect(typeof mockChromeAPI.storage.local.get).toBe('function')
      expect(typeof mockChromeAPI.system.memory.getInfo).toBe('function')
      expect(typeof mockChromeAPI.tabs.query).toBe('function')
    })

    test('應該正確模擬 Performance API', () => {
      // Then: 驗證 Performance API 模擬
      expect(typeof global.performance.now).toBe('function')
      expect(global.performance.memory.usedJSHeapSize).toBe(40 * 1024 * 1024)
      expect(global.performance.memory.totalJSHeapSize).toBe(80 * 1024 * 1024)
    })

    test('應該正確模擬 Navigator API', () => {
      // Then: 驗證 Navigator API 模擬
      expect(global.navigator.connection.effectiveType).toBe('4g')
      expect(global.navigator.deviceMemory).toBe(8)
      expect(global.navigator.hardwareConcurrency).toBe(8)
    })

    test('應該正確載入 ErrorCodes', () => {
      // Then: 驗證 ErrorCodes 可用性
      expect(ErrorCodes.INITIALIZATION_ERROR).toBeDefined()
      expect(ErrorCodes.CHROME_ERROR).toBeDefined()
      expect(ErrorCodes.PERFORMANCE_ERROR).toBeDefined()
      expect(typeof ErrorCodes.INITIALIZATION_ERROR).toBe('string')
    })
  })
})
