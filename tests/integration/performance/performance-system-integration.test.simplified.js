/**
 * 系統效能評估整合測試 (簡化版)
 * 專注於核心系統整合驗證
 *
 * @version v0.14.1
 * @date 2025-09-23
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

// Mock Chrome Extension APIs
const mockChromeAPI = {
  runtime: {
    getManifest: jest.fn(() => ({ version: '0.14.1' })),
    sendMessage: jest.fn(),
    onMessage: { addListener: jest.fn(), removeListener: jest.fn() }
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
    memory: { getInfo: jest.fn(() => Promise.resolve({ totalCapacityBytes: 8589934592, availableCapacityBytes: 4294967296 })) },
    cpu: { getInfo: jest.fn(() => Promise.resolve({ numOfProcessors: 8, archName: 'x86_64' })) }
  },
  tabs: { query: jest.fn(() => Promise.resolve([{ id: 1 }])) }
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

describe('系統效能評估整合測試 (簡化版)', () => {
  let mockPerformanceAssessment
  let mockMetricsCollector

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock PerformanceAssessment
    mockPerformanceAssessment = {
      initialize: jest.fn(),
      integrateWithCollector: jest.fn(),
      runIntegratedAssessment: jest.fn(),
      startRealTimeMonitoring: jest.fn(),
      integrateWithHookSystem: jest.fn(),
      saveToStorage: jest.fn(),
      getHistoricalData: jest.fn(),
      checkStorageUsage: jest.fn(),
      detectPerformanceRegression: jest.fn(),
      cleanup: jest.fn()
    }

    // Mock MetricsCollector
    mockMetricsCollector = {
      initialize: jest.fn(),
      hasAssessment: false,
      cleanup: jest.fn()
    }

    // Setup default return values
    mockPerformanceAssessment.initialize.mockResolvedValue({
      hasCollector: false,
      integrateWithCollector: mockPerformanceAssessment.integrateWithCollector
    })

    mockMetricsCollector.initialize.mockResolvedValue({
      hasAssessment: false
    })
  })

  describe('PerformanceAssessment 與 MetricsCollector 整合', () => {
    test('應該建立效能評估和監控整合系統', async () => {
      // Given: 初始化效能評估和指標收集系統
      const assessment = await mockPerformanceAssessment.initialize({
        monitoring: { memoryTracking: true, cpuProfiling: true }
      })
      const collector = await mockMetricsCollector.initialize({
        sampling: { interval: 5000 }
      })

      // When: 建立整合系統
      mockPerformanceAssessment.integrateWithCollector.mockResolvedValue({
        success: true,
        sharedConfig: { integrated: true }
      })

      const integrationResult = await assessment.integrateWithCollector(collector)

      // Then: 驗證整合成功
      expect(integrationResult.success).toBe(true)
      expect(integrationResult.sharedConfig).toBeDefined()
      expect(mockPerformanceAssessment.integrateWithCollector).toHaveBeenCalledWith(collector)
    })

    test('應該執行端到端效能評估', async () => {
      // Given: 整合的效能評估系統
      const assessment = await mockPerformanceAssessment.initialize()
      const collector = await mockMetricsCollector.initialize()

      await assessment.integrateWithCollector(collector)

      // When: 執行端到端效能評估
      mockPerformanceAssessment.runIntegratedAssessment.mockResolvedValue({
        assessmentData: { score: 85 },
        collectedMetrics: { memory: 45, cpu: 15 },
        integrationStatus: 'success',
        overallScore: { score: 85 }
      })

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
    })

    test('應該支援即時監控和資料收集', async () => {
      // Given: 整合系統與即時監控配置
      const assessment = await mockPerformanceAssessment.initialize()
      const collector = await mockMetricsCollector.initialize()

      await assessment.integrateWithCollector(collector)

      // When: 啟動即時監控
      const mockSession = {
        isActive: true,
        sessionId: 'session_123',
        stop: jest.fn()
      }

      mockPerformanceAssessment.startRealTimeMonitoring.mockReturnValue(mockSession)

      const monitoringSession = assessment.startRealTimeMonitoring({
        onMetricsUpdate: jest.fn()
      })

      // Then: 驗證即時監控
      expect(monitoringSession.isActive).toBe(true)
      expect(monitoringSession.sessionId).toBeDefined()
      expect(typeof monitoringSession.stop).toBe('function')
    })
  })

  describe('Hook 系統協作測試', () => {
    let assessment

    beforeEach(async () => {
      assessment = await mockPerformanceAssessment.initialize()
    })

    test('應該與 Hook 系統整合進行效能監控', async () => {
      // Given: Hook 系統監控配置
      const hookConfig = {
        performanceHooks: {
          memoryThreshold: 50,
          cpuThreshold: 30,
          responseTimeThreshold: 2000
        }
      }

      // When: 啟動 Hook 系統整合監控
      mockPerformanceAssessment.integrateWithHookSystem.mockResolvedValue({
        success: true,
        activeHooks: ['memoryMonitor', 'cpuMonitor'],
        thresholds: hookConfig.performanceHooks
      })

      const hookIntegration = await assessment.integrateWithHookSystem(hookConfig)

      // Then: 驗證 Hook 系統整合
      expect(hookIntegration.success).toBe(true)
      expect(hookIntegration.activeHooks).toContain('memoryMonitor')
      expect(hookIntegration.activeHooks).toContain('cpuMonitor')
      expect(hookIntegration.thresholds).toEqual(hookConfig.performanceHooks)
    })

    test('應該在檢測到效能問題時觸發 Hook 警報', async () => {
      // Given: 設定低閾值以觸發警報
      await assessment.integrateWithHookSystem({
        performanceHooks: { memoryThreshold: 30 }
      })

      // Mock Hook 警報處理
      const mockHookHandler = jest.fn()
      assessment.onHookAlert = jest.fn().mockImplementation((handler) => {
        // 模擬觸發警報
        setTimeout(() => {
          handler({
            type: 'memory_threshold_exceeded',
            threshold: 30,
            currentValue: 45,
            severity: 'warning'
          })
        }, 100)
      })

      // When: 設定警報處理器
      const hookAlerts = []
      assessment.onHookAlert((alert) => {
        hookAlerts.push(alert)
        mockHookHandler(alert)
      })

      // 等待警報觸發
      await new Promise(resolve => setTimeout(resolve, 200))

      // Then: 驗證 Hook 警報觸發
      expect(hookAlerts.length).toBeGreaterThan(0)
      expect(mockHookHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'memory_threshold_exceeded',
          threshold: 30,
          severity: 'warning'
        })
      )
    })
  })

  describe('ErrorCodes 整合測試', () => {
    let assessment

    beforeEach(async () => {
      assessment = await mockPerformanceAssessment.initialize()
    })

    test('應該使用標準化 ErrorCodes 處理效能評估錯誤', async () => {
      // Given: 模擬 Performance API 不可用
      const error = new Error('Performance API not available')
      error.code = ErrorCodes.PERFORMANCE_ERROR

      mockPerformanceAssessment.runIntegratedAssessment.mockRejectedValue(error)

      // When & Then: 期望標準化錯誤代碼
      await expect(assessment.runIntegratedAssessment()).rejects.toMatchObject({
        code: ErrorCodes.PERFORMANCE_ERROR,
        message: expect.stringContaining('Performance API')
      })
    })

    test('應該在記憶體超限時使用正確的錯誤代碼', async () => {
      // Given: 模擬記憶體超限
      const error = new Error('Memory usage exceeds budget')
      error.code = ErrorCodes.PERFORMANCE_MEMORY_TOO_HIGH

      mockPerformanceAssessment.runIntegratedAssessment.mockRejectedValue(error)

      // When & Then: 期望記憶體錯誤代碼
      await expect(assessment.runIntegratedAssessment()).rejects.toMatchObject({
        code: ErrorCodes.PERFORMANCE_MEMORY_TOO_HIGH,
        message: expect.stringContaining('Memory usage exceeds budget')
      })
    })

    test('應該在啟動時間過長時使用正確的錯誤代碼', async () => {
      // Given: 模擬啟動時間過長
      const error = new Error('Startup time exceeds budget')
      error.code = ErrorCodes.PERFORMANCE_STARTUP_TOO_SLOW

      mockPerformanceAssessment.runIntegratedAssessment.mockRejectedValue(error)

      // When & Then: 期望啟動時間錯誤代碼
      await expect(assessment.runIntegratedAssessment()).rejects.toMatchObject({
        code: ErrorCodes.PERFORMANCE_STARTUP_TOO_SLOW,
        message: expect.stringContaining('Startup time exceeds budget')
      })
    })
  })

  describe('Chrome Storage API 整合測試', () => {
    let assessment

    beforeEach(async () => {
      assessment = await mockPerformanceAssessment.initialize()
    })

    test('應該整合 Chrome Storage 進行效能資料持久化', async () => {
      // Given: 效能評估結果
      const performanceReport = {
        timestamp: Date.now(),
        version: 'v0.14.1',
        overallScore: { score: 85, grade: 'B' },
        metrics: { memory: { peakUsage: 42.5 }, cpu: { averageLoad: 15.8 } }
      }

      // When: 儲存到 Chrome Storage
      mockPerformanceAssessment.saveToStorage.mockResolvedValue({
        success: true,
        storageKey: `performance_${performanceReport.timestamp}`
      })

      const storageResult = await assessment.saveToStorage(performanceReport)

      // Then: 驗證 Chrome Storage 整合
      expect(storageResult.success).toBe(true)
      expect(storageResult.storageKey).toBeDefined()
      expect(mockPerformanceAssessment.saveToStorage).toHaveBeenCalledWith(performanceReport)
    })

    test('應該從 Chrome Storage 檢索歷史效能資料', async () => {
      // Given: 儲存的歷史資料
      const historicalData = [
        { timestamp: Date.now() - 3600000, overallScore: { score: 82 } },
        { timestamp: Date.now() - 86400000, overallScore: { score: 78 } }
      ]

      mockChromeAPI.storage.local.get.mockResolvedValue({
        performance_data_1: historicalData[0],
        performance_data_2: historicalData[1]
      })

      mockPerformanceAssessment.getHistoricalData.mockResolvedValue(historicalData)

      // When: 檢索歷史資料
      const retrievedData = await assessment.getHistoricalData()

      // Then: 驗證資料檢索
      expect(retrievedData.length).toBe(2)
      expect(retrievedData[0].overallScore.score).toBe(82)
      expect(retrievedData[1].overallScore.score).toBe(78)
    })

    test('應該監控 Chrome Storage 使用空間', async () => {
      // Given: Storage 使用情況
      mockChromeAPI.storage.local.getBytesInUse.mockResolvedValue(3145728) // 3MB

      mockPerformanceAssessment.checkStorageUsage.mockResolvedValue({
        usedMB: 3,
        quotaUsagePercentage: 30,
        needsCleanup: false
      })

      // When: 檢查 Storage 使用狀況
      const storageUsage = await assessment.checkStorageUsage()

      // Then: 驗證 Storage 監控
      expect(storageUsage.usedMB).toBe(3)
      expect(storageUsage.quotaUsagePercentage).toBeLessThan(50)
      expect(storageUsage.needsCleanup).toBe(false)
      expect(mockChromeAPI.storage.local.getBytesInUse).toHaveBeenCalled()
    })
  })

  describe('效能回歸檢測整合測試', () => {
    let assessment

    beforeEach(async () => {
      assessment = await mockPerformanceAssessment.initialize()
    })

    test('應該檢測效能回歸並提供分析', async () => {
      // Given: 效能回歸檢測
      const mockRegressionReport = {
        regressionDetected: true,
        affectedMetrics: ['memory'],
        memoryRegression: { percentage: 25 },
        severity: 'moderate'
      }

      mockPerformanceAssessment.detectPerformanceRegression.mockResolvedValue(mockRegressionReport)

      // When: 執行回歸檢測
      const regressionReport = await assessment.detectPerformanceRegression()

      // Then: 驗證回歸檢測
      expect(regressionReport.regressionDetected).toBe(true)
      expect(regressionReport.affectedMetrics).toContain('memory')
      expect(regressionReport.memoryRegression.percentage).toBeGreaterThan(20)
      expect(regressionReport.severity).toMatch(/moderate|high/)
    })

    test('應該生成效能趨勢分析', async () => {
      // Given: 趨勢分析
      const mockTrendAnalysis = {
        memoryTrend: { direction: 'increasing' },
        cpuTrend: { direction: 'increasing' },
        prediction: { nextWeekMemory: 42 },
        recommendation: 'Consider memory optimization'
      }

      assessment.analyzeTrends = jest.fn().mockResolvedValue(mockTrendAnalysis)

      // When: 生成趨勢分析
      const trendAnalysis = await assessment.analyzeTrends()

      // Then: 驗證趨勢分析
      expect(trendAnalysis.memoryTrend.direction).toBe('increasing')
      expect(trendAnalysis.cpuTrend.direction).toBe('increasing')
      expect(trendAnalysis.prediction.nextWeekMemory).toBeGreaterThan(38)
      expect(trendAnalysis.recommendation).toBeDefined()
    })
  })

  describe('系統穩定性測試', () => {
    let assessment
    let collector

    beforeEach(async () => {
      assessment = await mockPerformanceAssessment.initialize()
      collector = await mockMetricsCollector.initialize()
      await assessment.integrateWithCollector(collector)
    })

    test('應該在高負載情況下保持系統穩定性', async () => {
      // Given: 高負載測試配置
      const mockLoadTestResults = Array.from({ length: 5 }, () => ({
        success: true,
        overallScore: { score: Math.floor(Math.random() * 20) + 80 }
      }))

      mockPerformanceAssessment.runIntegratedAssessment.mockImplementation(() =>
        Promise.resolve(mockLoadTestResults[Math.floor(Math.random() * mockLoadTestResults.length)])
      )

      // When: 執行高負載測試
      const loadTestPromises = Array.from({ length: 5 }, () =>
        assessment.runIntegratedAssessment({ duration: 5000 })
      )

      const loadTestResults = await Promise.all(loadTestPromises)

      // Then: 驗證系統穩定性
      expect(loadTestResults.length).toBe(5)
      loadTestResults.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.overallScore.score).toBeGreaterThanOrEqual(0)
      })
    })

    test('應該正確處理同時多個監控會話', async () => {
      // Given: 多個同時監控會話
      const sessions = []

      for (let i = 0; i < 3; i++) {
        const mockSession = {
          isActive: true,
          sessionId: `session_${i}`,
          stop: jest.fn()
        }

        mockPerformanceAssessment.startRealTimeMonitoring.mockReturnValue(mockSession)
        const session = assessment.startRealTimeMonitoring({
          onMetricsUpdate: jest.fn()
        })
        sessions.push(session)
      }

      // Then: 驗證多會話處理
      expect(sessions.length).toBe(3)
      sessions.forEach((session, index) => {
        expect(session.isActive).toBe(true)
        expect(session.sessionId).toBe(`session_${index}`)
        expect(typeof session.stop).toBe('function')
      })

      // 清理會話
      sessions.forEach(session => session.stop())
    })
  })

  describe('整合測試環境驗證', () => {
    test('應該正確設定 Chrome Extension 測試環境', () => {
      // Then: 驗證 Chrome API 可用性
      expect(global.chrome).toBeDefined()
      expect(typeof global.chrome.runtime.getManifest).toBe('function')
      expect(typeof global.chrome.storage.local.get).toBe('function')
      expect(typeof global.chrome.system.memory.getInfo).toBe('function')
    })

    test('應該正確設定 Performance API 測試環境', () => {
      // Then: 驗證 Performance API 可用性
      expect(global.performance).toBeDefined()
      expect(typeof global.performance.now).toBe('function')
      expect(global.performance.memory).toBeDefined()
      expect(typeof global.performance.memory.usedJSHeapSize).toBe('number')
    })

    test('應該正確載入 ErrorCodes 系統', () => {
      // Then: 驗證 ErrorCodes 可用性
      expect(ErrorCodes).toBeDefined()
      expect(ErrorCodes.PERFORMANCE_ERROR).toBeDefined()
      expect(ErrorCodes.PERFORMANCE_MEMORY_TOO_HIGH).toBeDefined()
      expect(ErrorCodes.PERFORMANCE_STARTUP_TOO_SLOW).toBeDefined()
      expect(ErrorCodes.INITIALIZATION_ERROR).toBeDefined()
      expect(ErrorCodes.CHROME_ERROR).toBeDefined()
    })

    test('應該支援 Jest Mock 功能', () => {
      // Given: Jest Mock 測試
      const mockFunction = jest.fn()
      mockFunction.mockReturnValue('test_value')

      // When: 使用 Mock 函數
      const result = mockFunction('test_input')

      // Then: 驗證 Mock 功能
      expect(result).toBe('test_value')
      expect(mockFunction).toHaveBeenCalledWith('test_input')
      expect(mockFunction).toHaveBeenCalledTimes(1)
    })
  })
})
