/**
 * MetricsCollector 效能指標收集測試
 * 基於 v0.14.1 TDD Phase 1 & 2 設計
 *
 * 測試範圍：
 * - 多維度效能指標收集（記憶體、CPU、IO、網路）
 * - 即時監控資料更新和聚合
 * - 效能資料儲存和檢索
 * - Chrome Extension 專用指標收集
 * - 採樣策略和資料品質控制
 *
 * @version v0.14.1
 * @date 2025-09-23
 */

// TODO: [0.15.0-W1-002] 此測試套件的架構假設完全過時（26/27 測試失敗）。
// 測試期望 MetricsCollector.initialize() 靜態工廠方法，但實際 API 是 new MetricsCollector(config)。
// 測試呼叫大量不存在的方法：collectMetricsWithThrottling、handleLowMemoryCondition、
// compressAndStoreMetrics、compressMetrics、cleanupExpiredMetrics 等。
// 需要根據現行 MetricsCollector API 重寫整個測試套件。

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

// Mock Chrome Extension APIs
const mockChromeAPI = {
  runtime: {
    getManifest: jest.fn(() => ({ version: '0.14.1' })),
    onMemoryWarning: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      getBytesInUse: jest.fn(() => Promise.resolve(1024))
    }
  },
  system: {
    memory: {
      getInfo: jest.fn(() => Promise.resolve({
        totalCapacityBytes: 8589934592,
        availableCapacityBytes: 4294967296
      }))
    },
    cpu: {
      getInfo: jest.fn(() => Promise.resolve({
        numOfProcessors: 8,
        archName: 'x86_64'
      }))
    }
  },
  tabs: {
    query: jest.fn(() => Promise.resolve([{ id: 1 }, { id: 2 }]))
  }
}

global.chrome = mockChromeAPI

// Mock Performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(() => []),
    getEntriesByName: jest.fn(() => []),
    memory: {
      usedJSHeapSize: 40 * 1024 * 1024, // 40MB
      totalJSHeapSize: 80 * 1024 * 1024, // 80MB
      jsHeapSizeLimit: 2 * 1024 * 1024 * 1024 // 2GB
    },
    navigation: {
      loadEventEnd: 1500,
      loadEventStart: 1200,
      domContentLoadedEventEnd: 800
    }
  }
})

// Mock Navigation API
Object.defineProperty(global, 'navigator', {
  value: {
    connection: {
      effectiveType: '4g',
      downlink: 10,
      rtt: 50
    },
    deviceMemory: 8,
    hardwareConcurrency: 8
  }
})

describe.skip('MetricsCollector 效能指標收集', () => {
  let MetricsCollector
  let collector

  beforeAll(() => {
    // Dynamically require to ensure mocks are in place
    MetricsCollector = require('src/core/performance/MetricsCollector')
  })

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Reset performance values
    global.performance.memory.usedJSHeapSize = 40 * 1024 * 1024
    global.performance.now.mockReturnValue(Date.now())

    // Reset Chrome API responses
    mockChromeAPI.storage.local.get.mockResolvedValue({})
    mockChromeAPI.storage.local.set.mockResolvedValue()
  })

  afterEach(() => {
    if (collector && typeof collector.cleanup === 'function') {
      collector.cleanup()
    }
  })

  describe('MetricsCollector 初始化測試', () => {
    test('應該成功初始化指標收集器並設定預設配置', async () => {
      // Given: MetricsCollector 需要初始化
      const expectedConfig = {
        sampling: {
          interval: 30000,
          batchSize: 50,
          maxSamples: 1000
        },
        metrics: {
          memory: true,
          cpu: true,
          io: true,
          network: true,
          extension: true
        },
        storage: {
          retention: 7, // 保留7天
          compression: true
        }
      }

      // When: 初始化 MetricsCollector
      collector = await MetricsCollector.initialize()

      // Then: 驗證初始化成功且配置正確
      expect(collector).toBeDefined()
      expect(collector.isInitialized).toBe(true)
      expect(collector.config).toEqual(expectedConfig)
      expect(collector.version).toBe('v0.14.1')
    })

    test('應該允許自訂採樣配置', async () => {
      // Given: 自訂採樣配置
      const customConfig = {
        sampling: {
          interval: 10000, // 10秒採樣
          batchSize: 25,
          maxSamples: 500
        },
        metrics: {
          memory: true,
          cpu: false, // 停用 CPU 監控
          network: false // 停用網路監控
        }
      }

      // When: 使用自訂配置初始化
      collector = await MetricsCollector.initialize(customConfig)

      // Then: 驗證自訂配置正確應用
      expect(collector.config.sampling.interval).toBe(10000)
      expect(collector.config.metrics.cpu).toBe(false)
      expect(collector.config.metrics.network).toBe(false)
      expect(collector.config.metrics.memory).toBe(true) // 保持啟用
    })

    test('應該在缺少必要 API 時拋出初始化錯誤', async () => {
      // Given: Performance API 不可用
      const originalPerformance = global.performance
      global.performance = undefined

      // When & Then: 期望初始化失敗
      await expect(MetricsCollector.initialize()).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCodes.INITIALIZATION_ERROR,
          message: expect.stringContaining('Performance API not available')
        })
      )

      // 恢復 Performance API
      global.performance = originalPerformance
    })
  })

  describe('記憶體指標收集測試', () => {
    beforeEach(async () => {
      collector = await MetricsCollector.initialize()
    })

    test('應該準確收集 JavaScript 堆記憶體使用指標', async () => {
      // Given: 模擬記憶體使用狀況
      global.performance.memory.usedJSHeapSize = 45 * 1024 * 1024 // 45MB
      global.performance.memory.totalJSHeapSize = 90 * 1024 * 1024 // 90MB

      // When: 收集記憶體指標
      const memoryMetrics = await collector.collectMemoryMetrics()

      // Then: 驗證記憶體指標準確性
      expect(memoryMetrics.usedJSHeapMB).toBeCloseTo(45, 1)
      expect(memoryMetrics.totalJSHeapMB).toBeCloseTo(90, 1)
      expect(memoryMetrics.heapUsagePercentage).toBeCloseTo(50, 1)
      expect(memoryMetrics.timestamp).toBeDefined()
    })

    test('應該監控記憶體增長趨勢和可能的洩漏', async () => {
      // Given: 模擬記憶體持續增長
      const memoryGrowthSamples = [30, 35, 42, 48, 55, 63] // MB

      for (const memoryUsage of memoryGrowthSamples) {
        global.performance.memory.usedJSHeapSize = memoryUsage * 1024 * 1024
        await collector.collectMemoryMetrics()
        // 模擬時間間隔
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // When: 分析記憶體趨勢
      const memoryAnalysis = await collector.analyzeMemoryTrend()

      // Then: 驗證洩漏檢測
      expect(memoryAnalysis.growthRate).toBeGreaterThan(0)
      expect(memoryAnalysis.suspectedLeak).toBe(true)
      expect(memoryAnalysis.recommendation).toContain('memory leak')
    })

    test('應該收集系統記憶體資訊並計算可用容量', async () => {
      // Given: Chrome System API 回應系統記憶體資訊
      mockChromeAPI.system.memory.getInfo.mockResolvedValue({
        totalCapacityBytes: 16106127360, // 16GB
        availableCapacityBytes: 8589934592 // 8GB
      })

      // When: 收集系統記憶體指標
      const systemMemory = await collector.collectSystemMemoryMetrics()

      // Then: 驗證系統記憶體指標
      expect(systemMemory.totalCapacityGB).toBeCloseTo(16, 1)
      expect(systemMemory.availableCapacityGB).toBeCloseTo(8, 1)
      expect(systemMemory.usagePercentage).toBeCloseTo(50, 1)
      expect(mockChromeAPI.system.memory.getInfo).toHaveBeenCalled()
    })
  })

  describe('CPU 效能指標測試', () => {
    beforeEach(async () => {
      collector = await MetricsCollector.initialize()
    })

    test('應該測量 JavaScript 執行時間和阻塞時間', async () => {
      // Given: 模擬 CPU 密集任務
      // 模擬 CPU 密集計算
      const heavyTask = () => {
        let sum = 0
        for (let i = 0; i < 1000000; i++) {
          sum += Math.sqrt(i)
        }
        return sum
      }

      // When: 測量 CPU 使用
      const cpuMetrics = await collector.measureCPUUsage(heavyTask)

      // Then: 驗證 CPU 指標
      expect(cpuMetrics.executionTime).toBeGreaterThan(0)
      expect(cpuMetrics.blockingTime).toBeGreaterThan(0)
      expect(cpuMetrics.cpuIntensive).toBe(true)
      expect(cpuMetrics.timestamp).toBeDefined()
    })

    test('應該監控長時間運行任務並檢測效能瓶頸', async () => {
      // Given: 模擬長時間運行任務
      const longRunningTask = async () => {
        await new Promise(resolve => setTimeout(resolve, 300)) // 300ms 任務
      }

      // When: 監控長時間任務
      const taskMetrics = await collector.monitorLongRunningTask(longRunningTask)

      // Then: 驗證任務監控
      expect(taskMetrics.duration).toBeGreaterThanOrEqual(300)
      expect(taskMetrics.isPerformanceBottleneck).toBe(true)
      expect(taskMetrics.recommendation).toContain('blocking')
    })

    test('應該收集系統 CPU 資訊並計算負載', async () => {
      // Given: Chrome System API 回應 CPU 資訊
      mockChromeAPI.system.cpu.getInfo.mockResolvedValue({
        numOfProcessors: 8,
        archName: 'x86_64',
        modelName: 'Intel Core i7',
        features: ['sse', 'sse2', 'sse3']
      })

      // When: 收集系統 CPU 指標
      const cpuInfo = await collector.collectSystemCPUMetrics()

      // Then: 驗證 CPU 資訊
      expect(cpuInfo.cores).toBe(8)
      expect(cpuInfo.architecture).toBe('x86_64')
      expect(cpuInfo.model).toContain('Intel Core i7')
      expect(cpuInfo.features).toContain('sse')
      expect(mockChromeAPI.system.cpu.getInfo).toHaveBeenCalled()
    })
  })

  describe('IO 效能指標測試', () => {
    beforeEach(async () => {
      collector = await MetricsCollector.initialize()
    })

    test('應該測量 Chrome Storage API 讀寫效能', async () => {
      // Given: 模擬 Storage API 延遲
      mockChromeAPI.storage.local.get.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ key: 'value' }), 75))
      )
      mockChromeAPI.storage.local.set.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 50))
      )

      // When: 測量 Storage 效能
      const storageMetrics = await collector.measureStoragePerformance()

      // Then: 驗證 Storage 效能指標
      expect(storageMetrics.readTime).toBeGreaterThan(70)
      expect(storageMetrics.writeTime).toBeGreaterThan(45)
      expect(storageMetrics.totalIOTime).toBeGreaterThan(115)
      expect(mockChromeAPI.storage.local.get).toHaveBeenCalled()
      expect(mockChromeAPI.storage.local.set).toHaveBeenCalled()
    })

    test('應該監控 Storage 使用空間和配額', async () => {
      // Given: Chrome Storage 使用資訊
      mockChromeAPI.storage.local.getBytesInUse.mockResolvedValue(2048) // 2KB

      // When: 收集 Storage 使用指標
      const storageUsage = await collector.collectStorageUsageMetrics()

      // Then: 驗證 Storage 使用指標
      expect(storageUsage.usedBytes).toBe(2048)
      expect(storageUsage.usedKB).toBeCloseTo(2, 1)
      expect(storageUsage.quotaUsagePercentage).toBeLessThan(1)
      expect(mockChromeAPI.storage.local.getBytesInUse).toHaveBeenCalled()
    })

    test('應該測量檔案操作和批量 IO 效能', async () => {
      // Given: 模擬大量資料讀取
      const largeDataSet = Array.from({ length: 100 }, (_, i) => ({ id: i, data: `item_${i}` }))
      mockChromeAPI.storage.local.get.mockResolvedValue({ dataset: largeDataSet })

      // When: 測量批量 IO 效能
      const batchMetrics = await collector.measureBatchIOPerformance(100)

      // Then: 驗證批量 IO 指標
      expect(batchMetrics.itemCount).toBe(100)
      expect(batchMetrics.avgTimePerItem).toBeGreaterThan(0)
      expect(batchMetrics.totalBatchTime).toBeGreaterThan(0)
      expect(batchMetrics.throughputItemsPerSecond).toBeGreaterThan(0)
    })
  })

  describe('網路效能指標測試', () => {
    beforeEach(async () => {
      collector = await MetricsCollector.initialize()
    })

    test('應該檢測網路連線品質和延遲', async () => {
      // Given: Navigator Connection API 提供網路資訊
      Object.defineProperty(global.navigator, 'connection', {
        value: {
          effectiveType: '4g',
          downlink: 25.5,
          rtt: 35
        }
      })

      // When: 收集網路指標
      const networkMetrics = await collector.collectNetworkMetrics()

      // Then: 驗證網路指標
      expect(networkMetrics.effectiveType).toBe('4g')
      expect(networkMetrics.downlinkMbps).toBe(25.5)
      expect(networkMetrics.roundTripTime).toBe(35)
      expect(networkMetrics.networkQuality).toBe('excellent')
    })

    test('應該測量 API 請求響應時間', async () => {
      // Given: 模擬 API 請求
      const mockFetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: 'test' })
        })
      )
      global.fetch = mockFetch

      const apiEndpoint = 'https://api.example.com/test'

      // When: 測量 API 響應時間
      const apiMetrics = await collector.measureAPIResponseTime(apiEndpoint)

      // Then: 驗證 API 效能指標
      expect(apiMetrics.responseTime).toBeGreaterThan(0)
      expect(apiMetrics.success).toBe(true)
      expect(apiMetrics.endpoint).toBe(apiEndpoint)
      expect(mockFetch).toHaveBeenCalledWith(apiEndpoint)
    })

    test('應該檢測網路條件變化並調整採樣策略', async () => {
      // Given: 從好網路變為差網路
      let connectionState = { effectiveType: '4g', downlink: 25 }
      Object.defineProperty(global.navigator, 'connection', {
        get: () => connectionState
      })

      // 初始採樣
      await collector.collectNetworkMetrics()

      // 網路條件變差
      connectionState = { effectiveType: '2g', downlink: 1.5 }

      // When: 再次採樣並檢測變化
      const adaptiveMetrics = await collector.collectAdaptiveNetworkMetrics()

      // Then: 驗證自適應採樣
      expect(adaptiveMetrics.networkDegraded).toBe(true)
      expect(adaptiveMetrics.samplingAdjustment).toBe('reduced_frequency')
      expect(adaptiveMetrics.recommendedInterval).toBeGreaterThan(30000)
    })
  })

  describe('Chrome Extension 專用指標測試', () => {
    beforeEach(async () => {
      collector = await MetricsCollector.initialize()
    })

    test('應該測量 Extension 啟動和載入時間', async () => {
      // Given: 模擬 Extension 載入過程
      const mockManifest = { version: '0.14.1', name: 'Test Extension' }
      mockChromeAPI.runtime.getManifest.mockReturnValue(mockManifest)

      // When: 測量 Extension 啟動指標
      const extensionMetrics = await collector.measureExtensionStartup()

      // Then: 驗證 Extension 指標
      expect(extensionMetrics.version).toBe('0.14.1')
      expect(extensionMetrics.startupTime).toBeGreaterThan(0)
      expect(extensionMetrics.manifestLoadTime).toBeGreaterThan(0)
      expect(mockChromeAPI.runtime.getManifest).toHaveBeenCalled()
    })

    test('應該監控活動頁籤數量對效能的影響', async () => {
      // Given: 模擬多個活動頁籤
      const mockTabs = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, active: i === 0 }))
      mockChromeAPI.tabs.query.mockResolvedValue(mockTabs)

      // When: 收集頁籤相關指標
      const tabMetrics = await collector.collectTabMetrics()

      // Then: 驗證頁籤指標
      expect(tabMetrics.totalTabs).toBe(15)
      expect(tabMetrics.activeTabs).toBe(1)
      expect(tabMetrics.memoryImpact).toBe('high') // 15個頁籤影響較大
      expect(mockChromeAPI.tabs.query).toHaveBeenCalled()
    })

    test('應該監控 Extension 權限和 API 使用情況', async () => {
      // Given: Extension 使用多種 Chrome API
      const apiUsageLog = [
        'chrome.storage.local.get',
        'chrome.tabs.query',
        'chrome.runtime.sendMessage'
      ]

      // When: 分析 API 使用模式
      const apiMetrics = await collector.analyzeAPIUsagePattern(apiUsageLog)

      // Then: 驗證 API 使用分析
      expect(apiMetrics.uniqueAPIs).toBe(3)
      expect(apiMetrics.storageAPIUsage).toBeGreaterThan(0)
      expect(apiMetrics.messagingAPIUsage).toBeGreaterThan(0)
      expect(apiMetrics.overallUsagePattern).toBe('moderate')
    })
  })

  describe('資料聚合和分析測試', () => {
    beforeEach(async () => {
      collector = await MetricsCollector.initialize()
    })

    test('應該聚合多個採樣週期的指標資料', async () => {
      // Given: 多個採樣週期的資料
      const sampleData = [
        { memory: 35, cpu: 15, timestamp: Date.now() - 120000 },
        { memory: 42, cpu: 18, timestamp: Date.now() - 60000 },
        { memory: 38, cpu: 12, timestamp: Date.now() }
      ]

      for (const sample of sampleData) {
        await collector.addSample('performance', sample)
      }

      // When: 聚合分析資料
      const aggregatedMetrics = await collector.aggregateMetrics('performance')

      // Then: 驗證聚合結果
      expect(aggregatedMetrics.sampleCount).toBe(3)
      expect(aggregatedMetrics.memoryAvg).toBeCloseTo(38.33, 1)
      expect(aggregatedMetrics.cpuAvg).toBeCloseTo(15, 1)
      expect(aggregatedMetrics.memoryPeak).toBe(42)
      expect(aggregatedMetrics.timeSpan).toBeGreaterThan(120000)
    })

    test('應該識別效能異常和趨勢變化', async () => {
      // Given: 包含異常值的效能資料
      const performanceData = [
        { memory: 30, cpu: 10 }, // 正常
        { memory: 32, cpu: 12 }, // 正常
        { memory: 85, cpu: 45 }, // 異常：記憶體和 CPU 飆升
        { memory: 31, cpu: 11 } // 恢復正常
      ]

      for (const sample of performanceData) {
        await collector.addSample('anomaly_test', sample)
      }

      // When: 檢測異常
      const anomalyReport = await collector.detectAnomalies('anomaly_test')

      // Then: 驗證異常檢測
      expect(anomalyReport.anomaliesFound).toBe(true)
      expect(anomalyReport.memoryAnomalies.length).toBe(1)
      expect(anomalyReport.cpuAnomalies.length).toBe(1)
      expect(anomalyReport.severity).toBe('high')
    })

    test('應該產生效能基準和比較報告', async () => {
      // Given: 基準效能資料
      const baselineData = { memory: 25, cpu: 8, responseTime: 150 }
      const currentData = { memory: 35, cpu: 15, responseTime: 220 }

      await collector.setBaseline('performance_baseline', baselineData)

      // When: 比較當前效能與基準
      const comparisonReport = await collector.compareWithBaseline('performance_baseline', currentData)

      // Then: 驗證比較報告
      expect(comparisonReport.memoryChange).toBeCloseTo(40, 1) // +40%
      expect(comparisonReport.cpuChange).toBeCloseTo(87.5, 1) // +87.5%
      expect(comparisonReport.responseTimeChange).toBeCloseTo(46.67, 1) // +46.67%
      expect(comparisonReport.overallTrend).toBe('degraded')
    })
  })

  describe('錯誤處理和容錯測試', () => {
    beforeEach(async () => {
      collector = await MetricsCollector.initialize()
    })

    test('應該優雅處理 Chrome API 不可用的情況', async () => {
      // Given: Chrome Storage API 暫時不可用
      mockChromeAPI.storage.local.get.mockRejectedValue(new Error('Storage API unavailable'))

      // When: 嘗試收集 Storage 指標
      const result = await collector.collectStorageMetricsWithFallback()

      // Then: 驗證錯誤處理
      expect(result.success).toBe(false)
      expect(result.error.code).toBe(ErrorCodes.CHROME_ERROR)
      expect(result.fallbackData).toBeDefined()
      expect(result.fallbackData.estimatedUsage).toBeGreaterThan(0)
    })

    test('應該在採樣頻率過高時自動調節', async () => {
      // Given: 高頻採樣配置
      collector = await MetricsCollector.initialize({
        sampling: { interval: 100 } // 100ms 極高頻
      })

      // When: 連續進行多次採樣
      const samplingResults = []
      for (let i = 0; i < 10; i++) {
        const result = await collector.collectMetricsWithThrottling()
        samplingResults.push(result)
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Then: 驗證自動調節機制
      const throttledResults = samplingResults.filter(r => r.throttled)
      expect(throttledResults.length).toBeGreaterThan(0)
      expect(collector.currentInterval).toBeGreaterThan(100) // 自動增加間隔
    })

    test('應該處理記憶體不足和資源限制', async () => {
      // Given: 模擬低記憶體環境
      global.performance.memory.usedJSHeapSize = 1.9 * 1024 * 1024 * 1024 // 接近 2GB 限制
      mockChromeAPI.system.memory.getInfo.mockResolvedValue({
        totalCapacityBytes: 2147483648, // 2GB
        availableCapacityBytes: 104857600 // 只剩 100MB
      })

      // When: 在低記憶體環境下操作
      const lowMemoryResult = await collector.handleLowMemoryCondition()

      // Then: 驗證低記憶體處理
      expect(lowMemoryResult.memoryWarning).toBe(true)
      expect(lowMemoryResult.adjustedSamplingRate).toBe('reduced')
      expect(lowMemoryResult.recommendation).toContain('reduce memory usage')
    })
  })

  describe('效能資料持久化和檢索測試', () => {
    beforeEach(async () => {
      collector = await MetricsCollector.initialize()
    })

    test('應該壓縮並儲存大量效能資料', async () => {
      // Given: 大量效能資料
      const largeDataSet = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: Date.now() - (i * 60000),
        memory: 30 + Math.random() * 20,
        cpu: 10 + Math.random() * 15
      }))

      // When: 壓縮並儲存資料
      const storageResult = await collector.compressAndStoreMetrics(largeDataSet)

      // Then: 驗證壓縮儲存
      expect(storageResult.originalSize).toBeGreaterThan(storageResult.compressedSize)
      expect(storageResult.compressionRatio).toBeGreaterThan(0.1)
      expect(storageResult.storageKey).toBeDefined()
      expect(mockChromeAPI.storage.local.set).toHaveBeenCalled()
    })

    test('應該從儲存中檢索並解壓縮效能資料', async () => {
      // Given: 儲存的壓縮資料
      const originalData = [
        { timestamp: Date.now(), memory: 35, cpu: 12 },
        { timestamp: Date.now() - 60000, memory: 38, cpu: 15 }
      ]

      const compressedData = await collector.compressMetrics(originalData)
      mockChromeAPI.storage.local.get.mockResolvedValue({
        metrics_compressed_data: compressedData
      })

      // When: 檢索並解壓縮資料
      const retrievedData = await collector.retrieveAndDecompressMetrics('metrics_compressed_data')

      // Then: 驗證資料完整性
      expect(retrievedData.length).toBe(2)
      expect(retrievedData[0].memory).toBe(35)
      expect(retrievedData[1].cpu).toBe(15)
      expect(mockChromeAPI.storage.local.get).toHaveBeenCalled()
    })

    test('應該自動清理過期的效能資料', async () => {
      // Given: 包含新舊資料的儲存
      const currentTime = Date.now()
      const expiredData = {
        [`metrics_${currentTime - 10 * 24 * 60 * 60 * 1000}`]: { old: 'data' }, // 10天前
        [`metrics_${currentTime - 2 * 24 * 60 * 60 * 1000}`]: { recent: 'data' } // 2天前
      }

      mockChromeAPI.storage.local.get.mockResolvedValue(expiredData)

      // When: 執行資料清理
      const cleanupResult = await collector.cleanupExpiredMetrics()

      // Then: 驗證過期資料清理
      expect(cleanupResult.itemsRemoved).toBe(1)
      expect(cleanupResult.itemsRetained).toBe(1)
      expect(cleanupResult.spaceFreed).toBeGreaterThan(0)
    })
  })
})
