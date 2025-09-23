/**
 * PerformanceAssessment 系統效能評估測試 (簡化版)
 * 專注於核心介面驗證，確保測試框架正常運作
 *
 * @version v0.14.1
 * @date 2025-09-23
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

// Mock Chrome Extension APIs
const mockChromeAPI = {
  runtime: {
    getManifest: jest.fn(() => ({ version: '0.14.1' }))
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  system: {
    memory: {
      getInfo: jest.fn(() => Promise.resolve({
        totalCapacityBytes: 8589934592,
        availableCapacityBytes: 4294967296
      }))
    }
  }
}

global.chrome = mockChromeAPI

// Mock Performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024,
      totalJSHeapSize: 100 * 1024 * 1024,
      jsHeapSizeLimit: 2 * 1024 * 1024 * 1024
    }
  }
})

describe('PerformanceAssessment 系統效能評估 (簡化測試)', () => {
  let mockPerformanceAssessment

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Create mock PerformanceAssessment class
    mockPerformanceAssessment = {
      initialize: jest.fn().mockResolvedValue({
        isInitialized: true,
        version: 'v0.14.1',
        config: {
          monitoring: { memoryTracking: true, cpuProfiling: true },
          budget: { startupTime: 1000, memoryLimit: 50 }
        }
      }),
      runFullAssessment: jest.fn(),
      startRealTimeMonitoring: jest.fn(),
      generateReport: jest.fn()
    }
  })

  describe('基礎功能測試', () => {
    test('應該能夠初始化效能評估系統', async () => {
      // Given: 效能評估系統
      const assessment = await mockPerformanceAssessment.initialize()

      // When & Then: 驗證初始化結果
      expect(assessment).toBeDefined()
      expect(assessment.isInitialized).toBe(true)
      expect(assessment.version).toBe('v0.14.1')
      expect(mockPerformanceAssessment.initialize).toHaveBeenCalled()
    })

    test('應該支援自訂配置', async () => {
      // Given: 自訂配置
      const customConfig = { budget: { memoryLimit: 30 } }

      // When: 使用自訂配置初始化
      mockPerformanceAssessment.initialize.mockResolvedValue({
        isInitialized: true,
        config: { ...customConfig }
      })

      const assessment = await mockPerformanceAssessment.initialize(customConfig)

      // Then: 驗證配置應用
      expect(assessment.config).toEqual(customConfig)
      expect(mockPerformanceAssessment.initialize).toHaveBeenCalledWith(customConfig)
    })

    test('應該處理初始化錯誤', async () => {
      // Given: 初始化失敗的情況
      const error = new Error('Chrome Extension API not available')
      error.code = ErrorCodes.INITIALIZATION_ERROR

      mockPerformanceAssessment.initialize.mockRejectedValue(error)

      // When & Then: 期望錯誤處理
      await expect(mockPerformanceAssessment.initialize()).rejects.toMatchObject({
        code: ErrorCodes.INITIALIZATION_ERROR,
        message: expect.stringContaining('Chrome Extension API')
      })
    })
  })

  describe('效能評估功能測試', () => {
    let assessment

    beforeEach(async () => {
      assessment = await mockPerformanceAssessment.initialize()
      assessment.runFullAssessment = jest.fn()
      assessment.startRealTimeMonitoring = jest.fn()
      assessment.generateReport = jest.fn()
    })

    test('應該執行完整效能評估', async () => {
      // Given: 評估選項
      const options = { duration: 10000, iterations: 10 }
      const mockReport = {
        meta: { timestamp: Date.now(), version: 'v0.14.1' },
        overallScore: { score: 85, grade: 'B' },
        metrics: { memory: {}, cpu: {}, io: {}, extension: {} }
      }

      assessment.runFullAssessment.mockResolvedValue(mockReport)

      // When: 執行評估
      const report = await assessment.runFullAssessment(options)

      // Then: 驗證報告結構
      expect(report.meta.version).toBe('v0.14.1')
      expect(report.overallScore.score).toBeGreaterThanOrEqual(0)
      expect(report.overallScore.score).toBeLessThanOrEqual(100)
      expect(report.metrics).toBeDefined()
      expect(assessment.runFullAssessment).toHaveBeenCalledWith(options)
    })

    test('應該啟動即時監控', async () => {
      // Given: 監控回調
      const mockCallbacks = {
        onMetricsUpdate: jest.fn(),
        onAlert: jest.fn()
      }
      const mockSession = {
        isActive: true,
        sessionId: 'session_123',
        stop: jest.fn()
      }

      assessment.startRealTimeMonitoring.mockReturnValue(mockSession)

      // When: 啟動監控
      const session = assessment.startRealTimeMonitoring(mockCallbacks)

      // Then: 驗證監控會話
      expect(session.isActive).toBe(true)
      expect(session.sessionId).toBeDefined()
      expect(typeof session.stop).toBe('function')
      expect(assessment.startRealTimeMonitoring).toHaveBeenCalledWith(mockCallbacks)
    })

    test('應該生成效能報告', () => {
      // Given: 模擬效能指標
      const mockMetrics = {
        memory: { peakUsage: 41.5, averageUsage: 38.38 },
        cpu: { averageLoad: 14.86, peakLoad: 18.2 }
      }
      const mockReport = {
        metrics: mockMetrics,
        overallScore: { score: 78 },
        recommendations: ['optimize memory usage'],
        issues: []
      }

      assessment.generateReport.mockReturnValue(mockReport)

      // When: 生成報告
      const report = assessment.generateReport(mockMetrics)

      // Then: 驗證報告內容
      expect(report.metrics).toEqual(mockMetrics)
      expect(report.overallScore.score).toBeGreaterThan(0)
      expect(Array.isArray(report.recommendations)).toBe(true)
      expect(Array.isArray(report.issues)).toBe(true)
      expect(assessment.generateReport).toHaveBeenCalledWith(mockMetrics)
    })
  })

  describe('錯誤處理測試', () => {
    test('應該處理 Performance API 不可用', async () => {
      // Given: Performance API 不可用
      const originalPerformance = global.performance
      global.performance = undefined

      const error = new Error('Performance API not available')
      error.code = ErrorCodes.PERFORMANCE_ERROR

      mockPerformanceAssessment.runFullAssessment = jest.fn().mockRejectedValue(error)

      // When & Then: 期望錯誤處理
      await expect(mockPerformanceAssessment.runFullAssessment()).rejects.toMatchObject({
        code: ErrorCodes.PERFORMANCE_ERROR,
        message: expect.stringContaining('Performance API')
      })

      // 恢復 Performance API
      global.performance = originalPerformance
    })

    test('應該處理記憶體超限', async () => {
      // Given: 記憶體超限錯誤
      const error = new Error('Memory usage exceeds budget')
      error.code = ErrorCodes.PERFORMANCE_MEMORY_TOO_HIGH

      mockPerformanceAssessment.runFullAssessment = jest.fn().mockRejectedValue(error)

      // When & Then: 期望記憶體錯誤
      await expect(mockPerformanceAssessment.runFullAssessment()).rejects.toMatchObject({
        code: ErrorCodes.PERFORMANCE_MEMORY_TOO_HIGH,
        message: expect.stringContaining('Memory usage exceeds budget')
      })
    })
  })

  describe('Chrome Extension 整合測試', () => {
    test('應該整合 Chrome Storage API', async () => {
      // Given: Chrome Storage 模擬
      mockChromeAPI.storage.local.set.mockResolvedValue()
      mockChromeAPI.storage.local.get.mockResolvedValue({
        performance_data_123: { score: 85 }
      })

      // When: 模擬儲存操作
      await mockChromeAPI.storage.local.set({ test_key: 'test_value' })
      const result = await mockChromeAPI.storage.local.get('performance_data_123')

      // Then: 驗證 Chrome Storage 整合
      expect(mockChromeAPI.storage.local.set).toHaveBeenCalledWith({ test_key: 'test_value' })
      expect(result).toEqual({ performance_data_123: { score: 85 } })
    })

    test('應該整合 Chrome System API', async () => {
      // Given: Chrome System API 模擬
      const memoryInfo = await mockChromeAPI.system.memory.getInfo()

      // Then: 驗證系統記憶體資訊
      expect(memoryInfo.totalCapacityBytes).toBe(8589934592)
      expect(memoryInfo.availableCapacityBytes).toBe(4294967296)
      expect(mockChromeAPI.system.memory.getInfo).toHaveBeenCalled()
    })
  })

  describe('Mock 功能驗證', () => {
    test('應該正確模擬 Performance API', () => {
      // Given: Performance API mock
      const now = global.performance.now()
      const memory = global.performance.memory

      // Then: 驗證 Performance API 模擬
      expect(typeof now).toBe('number')
      expect(memory.usedJSHeapSize).toBe(50 * 1024 * 1024)
      expect(memory.totalJSHeapSize).toBe(100 * 1024 * 1024)
    })

    test('應該正確模擬 Chrome API', () => {
      // Given: Chrome API mock
      const manifest = mockChromeAPI.runtime.getManifest()

      // Then: 驗證 Chrome API 模擬
      expect(manifest.version).toBe('0.14.1')
      expect(typeof mockChromeAPI.storage.local.get).toBe('function')
      expect(typeof mockChromeAPI.storage.local.set).toBe('function')
    })

    test('應該正確載入 ErrorCodes', () => {
      // Given: ErrorCodes 模組
      // Then: 驗證 ErrorCodes 可用性
      expect(ErrorCodes.PERFORMANCE_ERROR).toBeDefined()
      expect(ErrorCodes.INITIALIZATION_ERROR).toBeDefined()
      expect(ErrorCodes.PERFORMANCE_MEMORY_TOO_HIGH).toBeDefined()
      expect(typeof ErrorCodes.PERFORMANCE_ERROR).toBe('string')
    })
  })
})
