/**
 * 系統效能評估整合測試
 * 基於 v0.14.1 TDD Phase 1 & 2 設計
 *
 * 測試範圍：
 * - PerformanceAssessment 與 MetricsCollector 整合
 * - Hook 系統協作測試
 * - ErrorCodes 整合測試
 * - Chrome Storage API 整合測試
 * - 端到端效能評估流程
 * - 即時監控和警報系統整合
 *
 * @version v0.14.1
 * @date 2025-09-23
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

// Mock Chrome Extension APIs
const mockChromeAPI = {
  runtime: {
    getManifest: jest.fn(() => ({ version: '0.14.1' })),
    onMemoryWarning: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
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
    query: jest.fn(() => Promise.resolve([{ id: 1 }]))
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
    connection: {
      effectiveType: '4g',
      downlink: 10,
      rtt: 50
    },
    deviceMemory: 8,
    hardwareConcurrency: 8
  }
})

// TODO: 整個套件依賴 PerformanceAssessment.integrateWithCollector() 和 PerformanceAssessment.initialize() 等不存在的 API，
// 需要根據實際 PerformanceAssessment / MetricsCollector 介面重寫 (Ticket: 0.15.0-W1-002)
describe.skip('系統效能評估整合測試', () => {
  let PerformanceAssessment
  let MetricsCollector
  let assessment
  let collector

  beforeAll(() => {
    // Dynamically require to ensure mocks are in place
    PerformanceAssessment = require('src/core/performance/PerformanceAssessment')
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
    mockChromeAPI.runtime.sendMessage.mockResolvedValue({ success: true })
  })

  afterEach(async () => {
    if (assessment && typeof assessment.cleanup === 'function') {
      await assessment.cleanup()
    }
    if (collector && typeof collector.cleanup === 'function') {
      await collector.cleanup()
    }
  })

  describe('PerformanceAssessment 與 MetricsCollector 整合', () => {
    test('應該建立完整的效能評估和監控整合系統', async () => {
      // Given: 初始化效能評估和指標收集系統
      assessment = await PerformanceAssessment.initialize({
        monitoring: {
          memoryTracking: true,
          cpuProfiling: true,
          ioMonitoring: true
        }
      })
      collector = await MetricsCollector.initialize({
        sampling: { interval: 5000 }
      })

      // When: 建立整合系統
      const integrationResult = await assessment.integrateWithCollector(collector)

      // Then: 驗證整合成功
      expect(integrationResult.success).toBe(true)
      expect(assessment.hasCollector).toBe(true)
      expect(collector.hasAssessment).toBe(true)
      expect(integrationResult.sharedConfig).toBeDefined()
    })

    test('應該在整合系統中執行端到端效能評估', async () => {
      // Given: 整合的效能評估系統
      assessment = await PerformanceAssessment.initialize()
      collector = await MetricsCollector.initialize()
      await assessment.integrateWithCollector(collector)

      // When: 執行端到端效能評估
      const endToEndReport = await assessment.runIntegratedAssessment({
        duration: 10000,
        collectMetrics: true,
        generateReport: true
      })

      // Then: 驗證端到端評估結果
      expect(endToEndReport.assessmentData).toBeDefined()
      expect(endToEndReport.collectedMetrics).toBeDefined()
      expect(endToEndReport.integrationStatus).toBe('success')
      expect(endToEndReport.overallScore.score).toBeGreaterThanOrEqual(0)
      expect(endToEndReport.overallScore.score).toBeLessThanOrEqual(100)
    })

    test('應該在效能評估過程中即時收集和分析指標', async () => {
      // Given: 整合系統與即時監控配置
      assessment = await PerformanceAssessment.initialize({
        monitoring: { realTimeAnalysis: true }
      })
      collector = await MetricsCollector.initialize({
        sampling: { interval: 1000 } // 1秒採樣
      })
      await assessment.integrateWithCollector(collector)

      const metricsUpdates = []
      const mockCallback = jest.fn((metrics) => {
        metricsUpdates.push(metrics)
      })

      // When: 啟動即時監控和評估
      const monitoringSession = assessment.startRealTimeMonitoring({
        onMetricsUpdate: mockCallback
      })

      // 等待多次採樣
      await new Promise(resolve => setTimeout(resolve, 3500))

      // Then: 驗證即時資料收集
      expect(metricsUpdates.length).toBeGreaterThanOrEqual(3)
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          memory: expect.any(Object),
          timestamp: expect.any(Number)
        })
      )

      monitoringSession.stop()
    })
  })

  describe('Hook 系統協作測試', () => {
    beforeEach(async () => {
      assessment = await PerformanceAssessment.initialize()
      collector = await MetricsCollector.initialize()
    })

    test('應該與 Hook 系統整合進行效能監控', async () => {
      // Given: Hook 系統監控配置
      const hookConfig = {
        performanceHooks: {
          memoryThreshold: 50, // 50MB
          cpuThreshold: 30, // 30%
          responseTimeThreshold: 2000 // 2秒
        }
      }

      // When: 啟動 Hook 系統整合監控
      const hookIntegration = await assessment.integrateWithHookSystem(hookConfig)

      // Then: 驗證 Hook 系統整合
      expect(hookIntegration.success).toBe(true)
      expect(hookIntegration.activeHooks).toContain('memoryMonitor')
      expect(hookIntegration.activeHooks).toContain('cpuMonitor')
      expect(hookIntegration.thresholds).toEqual(hookConfig.performanceHooks)
    })

    test('應該在檢測到效能問題時觸發 Hook 系統警報', async () => {
      // Given: 設定低閾值以觸發警報
      await assessment.integrateWithHookSystem({
        performanceHooks: {
          memoryThreshold: 30 // 30MB（低於當前 40MB）
        }
      })

      const hookAlerts = []
      const mockHookHandler = jest.fn((alert) => {
        hookAlerts.push(alert)
      })

      assessment.onHookAlert(mockHookHandler)

      // When: 執行效能檢查
      await assessment._triggerPerformanceCheck()

      // Then: 驗證 Hook 警報觸發
      expect(hookAlerts.length).toBeGreaterThan(0)
      expect(hookAlerts[0]).toEqual(
        expect.objectContaining({
          type: 'memory_threshold_exceeded',
          threshold: 30,
          currentValue: expect.any(Number),
          severity: 'warning'
        })
      )
    })

    test('應該基於 Hook 系統回饋調整監控策略', async () => {
      // Given: Hook 系統提供效能回饋
      const hookFeedback = {
        memoryPressure: 'high',
        cpuLoad: 'moderate',
        ioLatency: 'low',
        recommendation: 'reduce_sampling_frequency'
      }

      // When: 根據 Hook 回饋調整監控
      const adjustmentResult = await assessment.adjustMonitoringBasedOnHookFeedback(hookFeedback)

      // Then: 驗證監控策略調整
      expect(adjustmentResult.adjustmentMade).toBe(true)
      expect(adjustmentResult.newSamplingInterval).toBeGreaterThan(30000) // 降低採樣頻率
      expect(adjustmentResult.reason).toContain('high memory pressure')
    })
  })

  describe('ErrorCodes 整合測試', () => {
    beforeEach(async () => {
      assessment = await PerformanceAssessment.initialize()
      collector = await MetricsCollector.initialize()
    })

    test('應該使用標準化 ErrorCodes 處理效能評估錯誤', async () => {
      // Given: 模擬 Performance API 不可用
      const originalPerformance = global.performance
      global.performance = undefined

      // When: 嘗試收集效能指標
      try {
        await assessment.runFullAssessment()
      } catch (error) {
        // Then: 驗證標準化錯誤代碼
        expect(error.code).toBe(ErrorCodes.PERFORMANCE_ERROR)
        expect(error.message).toContain('Performance API')
      }

      // 恢復 Performance API
      global.performance = originalPerformance
    })

    test('應該在記憶體超限時使用正確的錯誤代碼', async () => {
      // Given: 模擬記憶體超限情況
      global.performance.memory.usedJSHeapSize = 60 * 1024 * 1024 // 60MB
      assessment = await PerformanceAssessment.initialize({
        budget: { memoryLimit: 50 } // 50MB 限制
      })

      // When: 檢測記憶體使用
      try {
        await assessment._enforceMemoryBudget()
      } catch (error) {
        // Then: 驗證記憶體錯誤代碼
        expect(error.code).toBe(ErrorCodes.PERFORMANCE_MEMORY_TOO_HIGH)
        expect(error.message).toContain('Memory usage exceeds budget')
      }
    })

    test('應該在啟動時間過長時使用正確的錯誤代碼', async () => {
      // Given: 模擬啟動時間過長
      jest.spyOn(assessment, '_measureStartupTime').mockResolvedValue(2500) // 2.5秒

      assessment = await PerformanceAssessment.initialize({
        budget: { startupTime: 1000 } // 1秒限制
      })

      // When: 檢測啟動時間
      try {
        await assessment._enforceStartupTimeBudget()
      } catch (error) {
        // Then: 驗證啟動時間錯誤代碼
        expect(error.code).toBe(ErrorCodes.PERFORMANCE_STARTUP_TOO_SLOW)
        expect(error.message).toContain('Startup time exceeds budget')
      }
    })
  })

  describe('Chrome Storage API 整合測試', () => {
    beforeEach(async () => {
      assessment = await PerformanceAssessment.initialize()
      collector = await MetricsCollector.initialize()
    })

    test('應該整合 Chrome Storage 進行效能資料持久化', async () => {
      // Given: 效能評估結果
      const performanceReport = {
        timestamp: Date.now(),
        version: 'v0.14.1',
        overallScore: { score: 85, grade: 'B' },
        metrics: {
          memory: { peakUsage: 42.5, averageUsage: 38.2 },
          cpu: { averageLoad: 15.8 }
        }
      }

      // When: 儲存到 Chrome Storage
      const storageResult = await assessment.saveToStorage(performanceReport)

      // Then: 驗證 Chrome Storage 整合
      expect(storageResult.success).toBe(true)
      expect(storageResult.storageKey).toBeDefined()
      expect(mockChromeAPI.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [storageResult.storageKey]: performanceReport
        })
      )
    })

    test('應該從 Chrome Storage 檢索歷史效能資料', async () => {
      // Given: 儲存的歷史資料
      const historicalData = {
        performance_20250923_001: {
          timestamp: Date.now() - 86400000, // 1天前
          overallScore: { score: 78 }
        },
        performance_20250923_002: {
          timestamp: Date.now() - 3600000, // 1小時前
          overallScore: { score: 82 }
        }
      }

      mockChromeAPI.storage.local.get.mockResolvedValue(historicalData)

      // When: 檢索歷史資料
      const retrievedData = await assessment.getHistoricalData()

      // Then: 驗證資料檢索
      expect(retrievedData.length).toBe(2)
      expect(retrievedData[0].overallScore.score).toBe(82) // 最新的資料
      expect(retrievedData[1].overallScore.score).toBe(78) // 較舊的資料
      expect(mockChromeAPI.storage.local.get).toHaveBeenCalled()
    })

    test('應該監控 Chrome Storage 使用空間並進行資料管理', async () => {
      // Given: Storage 使用情況
      mockChromeAPI.storage.local.getBytesInUse.mockResolvedValue(3145728) // 3MB

      // When: 檢查 Storage 使用狀況
      const storageUsage = await assessment.checkStorageUsage()

      // Then: 驗證 Storage 監控
      expect(storageUsage.usedMB).toBeCloseTo(3, 1)
      expect(storageUsage.quotaUsagePercentage).toBeLessThan(50) // Chrome 限制約 10MB
      expect(storageUsage.needsCleanup).toBe(false)
      expect(mockChromeAPI.storage.local.getBytesInUse).toHaveBeenCalled()
    })
  })

  describe('即時監控和警報系統整合測試', () => {
    beforeEach(async () => {
      assessment = await PerformanceAssessment.initialize()
      collector = await MetricsCollector.initialize()
      await assessment.integrateWithCollector(collector)
    })

    test('應該建立完整的即時監控和警報系統', async () => {
      // Given: 警報配置
      const alertConfig = {
        memoryAlert: { threshold: 45, severity: 'warning' },
        cpuAlert: { threshold: 25, severity: 'warning' },
        responseTimeAlert: { threshold: 1500, severity: 'critical' }
      }

      const alerts = []
      const mockAlertHandler = jest.fn((alert) => {
        alerts.push(alert)
      })

      // When: 啟動即時監控和警報
      const monitoringSession = assessment.startRealTimeMonitoring({
        onAlert: mockAlertHandler,
        alertConfig
      })

      // 模擬記憶體使用超標
      global.performance.memory.usedJSHeapSize = 50 * 1024 * 1024 // 50MB

      await new Promise(resolve => setTimeout(resolve, 2000))

      // Then: 驗證警報系統
      expect(alerts.length).toBeGreaterThan(0)
      expect(alerts[0]).toEqual(
        expect.objectContaining({
          type: 'memory_threshold_exceeded',
          severity: 'warning',
          threshold: 45,
          currentValue: expect.any(Number)
        })
      )

      monitoringSession.stop()
    })

    test('應該支援多級警報和升級機制', async () => {
      // Given: 多級警報配置
      const escalationConfig = {
        memory: {
          warning: 40, // 40MB
          critical: 55, // 55MB
          emergency: 70 // 70MB
        }
      }

      const alerts = []
      const mockAlertHandler = jest.fn((alert) => {
        alerts.push(alert)
      })

      assessment.configureAlertEscalation(escalationConfig)
      const session = assessment.startRealTimeMonitoring({
        onAlert: mockAlertHandler
      })

      // When: 模擬記憶體使用逐步增加
      const memorySteps = [45, 60, 75] // MB
      for (const memoryUsage of memorySteps) {
        global.performance.memory.usedJSHeapSize = memoryUsage * 1024 * 1024
        await assessment._triggerMemoryCheck()
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Then: 驗證多級警報
      const severityLevels = alerts.map(alert => alert.severity)
      expect(severityLevels).toContain('warning')
      expect(severityLevels).toContain('critical')
      expect(severityLevels).toContain('emergency')

      session.stop()
    })

    test('應該整合通知系統發送效能警報', async () => {
      // Given: Chrome runtime 訊息系統
      const notificationsSent = []
      mockChromeAPI.runtime.sendMessage.mockImplementation((message) => {
        notificationsSent.push(message)
        return Promise.resolve({ success: true })
      })

      // When: 觸發效能警報並發送通知
      assessment.configureNotifications({ enabled: true, channel: 'runtime_message' })

      const session = assessment.startRealTimeMonitoring({
        notificationsEnabled: true
      })

      // 模擬記憶體警報
      global.performance.memory.usedJSHeapSize = 60 * 1024 * 1024 // 60MB
      await assessment._triggerMemoryCheck()

      // Then: 驗證通知發送
      expect(notificationsSent.length).toBeGreaterThan(0)
      expect(notificationsSent[0]).toEqual(
        expect.objectContaining({
          type: 'performance_alert',
          data: expect.objectContaining({
            alertType: 'memory_threshold_exceeded',
            severity: expect.any(String)
          })
        })
      )

      session.stop()
    })
  })

  describe('效能回歸檢測整合測試', () => {
    beforeEach(async () => {
      assessment = await PerformanceAssessment.initialize()
      collector = await MetricsCollector.initialize()
      await assessment.integrateWithCollector(collector)
    })

    test('應該檢測效能回歸並提供詳細分析', async () => {
      // Given: 歷史效能基準
      const baselinePerformance = {
        memory: { average: 35, peak: 42 },
        cpu: { average: 12, peak: 18 },
        responseTime: { average: 150, peak: 250 }
      }

      await assessment.setPerformanceBaseline(baselinePerformance)

      // 模擬當前較差的效能
      global.performance.memory.usedJSHeapSize = 55 * 1024 * 1024 // 55MB

      // When: 執行回歸檢測
      const regressionReport = await assessment.detectPerformanceRegression()

      // Then: 驗證回歸檢測
      expect(regressionReport.regressionDetected).toBe(true)
      expect(regressionReport.affectedMetrics).toContain('memory')
      expect(regressionReport.memoryRegression.percentage).toBeGreaterThan(20)
      expect(regressionReport.severity).toMatch(/moderate|high/)
    })

    test('應該生成效能趨勢分析和預測', async () => {
      // Given: 多個時間點的效能資料
      const performanceHistory = [
        { timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, memory: 30, cpu: 10 }, // 7天前
        { timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, memory: 32, cpu: 11 }, // 5天前
        { timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, memory: 35, cpu: 13 }, // 3天前
        { timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, memory: 38, cpu: 15 } // 1天前
      ]

      for (const dataPoint of performanceHistory) {
        await collector.addHistoricalSample(dataPoint)
      }

      // When: 生成趨勢分析
      const trendAnalysis = await assessment.analyzeTrends()

      // Then: 驗證趨勢分析
      expect(trendAnalysis.memoryTrend.direction).toBe('increasing')
      expect(trendAnalysis.cpuTrend.direction).toBe('increasing')
      expect(trendAnalysis.prediction.nextWeekMemory).toBeGreaterThan(38)
      expect(trendAnalysis.recommendation).toBeDefined()
    })

    test('應該支援自動化效能回歸測試', async () => {
      // Given: 自動化回歸測試配置
      const regressionTestConfig = {
        schedule: 'daily',
        thresholds: {
          memoryIncrease: 15, // 15% 增加為回歸
          cpuIncrease: 20, // 20% 增加為回歸
          responseTimeIncrease: 25 // 25% 增加為回歸
        },
        actions: {
          onRegression: 'alert_and_log',
          autoRevert: false
        }
      }

      // When: 設定自動化回歸測試
      const automationResult = await assessment.setupAutomatedRegressionTesting(regressionTestConfig)

      // Then: 驗證自動化設定
      expect(automationResult.success).toBe(true)
      expect(automationResult.scheduledTests).toBeDefined()
      expect(automationResult.nextTestTime).toBeGreaterThan(Date.now())
      expect(automationResult.thresholds).toEqual(regressionTestConfig.thresholds)
    })
  })

  describe('系統整合壓力測試', () => {
    beforeEach(async () => {
      assessment = await PerformanceAssessment.initialize()
      collector = await MetricsCollector.initialize()
      await assessment.integrateWithCollector(collector)
    })

    test('應該在高負載情況下保持系統穩定性', async () => {
      // Given: 高負載測試配置
      const highLoadConfig = {
        concurrentAssessments: 5,
        samplingFrequency: 500, // 500ms
        duration: 10000 // 10秒
      }

      // When: 執行高負載測試
      const loadTestPromises = Array.from(
        { length: highLoadConfig.concurrentAssessments },
        () => assessment.runFullAssessment({ duration: highLoadConfig.duration })
      )

      const loadTestResults = await Promise.all(loadTestPromises)

      // Then: 驗證系統穩定性
      expect(loadTestResults.length).toBe(5)
      loadTestResults.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.overallScore.score).toBeGreaterThanOrEqual(0)
      })

      // 驗證沒有記憶體洩漏
      const memoryAfterTest = global.performance.memory.usedJSHeapSize
      expect(memoryAfterTest).toBeLessThan(100 * 1024 * 1024) // < 100MB
    })

    test('應該正確處理同時多個監控會話', async () => {
      // Given: 多個同時監控會話
      const sessions = []
      const allMetricsUpdates = []

      for (let i = 0; i < 3; i++) {
        const sessionMetrics = []
        const session = assessment.startRealTimeMonitoring({
          onMetricsUpdate: (metrics) => {
            sessionMetrics.push(metrics)
            allMetricsUpdates.push({ session: i, metrics })
          }
        })
        sessions.push({ session, metrics: sessionMetrics })
      }

      // When: 等待多個會話收集資料
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Then: 驗證多會話處理
      expect(sessions.length).toBe(3)
      sessions.forEach(({ session, metrics }) => {
        expect(session.isActive).toBe(true)
        expect(metrics.length).toBeGreaterThan(0)
      })

      expect(allMetricsUpdates.length).toBeGreaterThan(6) // 每個會話至少2次更新

      // 清理會話
      sessions.forEach(({ session }) => session.stop())
    })

    test('應該在資源限制下優雅降級', async () => {
      // Given: 模擬資源限制環境
      global.performance.memory.usedJSHeapSize = 90 * 1024 * 1024 // 90MB 高記憶體使用

      mockChromeAPI.system.memory.getInfo.mockResolvedValue({
        totalCapacityBytes: 2147483648, // 2GB
        availableCapacityBytes: 268435456 // 256MB 可用
      })

      // When: 在資源限制下啟動監控
      const resourceLimitedSession = assessment.startRealTimeMonitoring({
        adaptToResources: true
      })

      await new Promise(resolve => setTimeout(resolve, 2000))

      // Then: 驗證優雅降級
      expect(resourceLimitedSession.isActive).toBe(true)
      expect(resourceLimitedSession.adaptiveMode).toBe(true)
      expect(resourceLimitedSession.reducedSampling).toBe(true)

      resourceLimitedSession.stop()
    })
  })
})
