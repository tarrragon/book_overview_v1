/**
 * PerformanceAssessment 基礎功能測試
 *
 * 測試核心功能是否正常運作，避免記憶體溢出問題
 *
 * @version v0.14.1
 * @date 2025-09-23
 */

// const { ErrorCodes } = require('src/core/errors/ErrorCodes') // 未使用的import
const PerformanceAssessment = require('src/core/performance/PerformanceAssessment')

// Mock Chrome Extension APIs
global.chrome = {
  runtime: {
    getManifest: jest.fn(() => ({ version: '0.14.1' }))
  },
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue()
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
        archName: 'x86_64',
        modelName: 'Intel Core i7'
      }))
    }
  }
}

// Mock Performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024,
    totalJSHeapSize: 100 * 1024 * 1024,
    jsHeapSizeLimit: 2 * 1024 * 1024 * 1024
  },
  timing: {
    navigationStart: Date.now() - 1000,
    loadEventEnd: Date.now() - 500,
    domContentLoadedEventEnd: Date.now() - 700,
    fetchStart: Date.now() - 900
  },
  getEntriesByType: jest.fn(() => [])
}

// Mock other globals
global.localStorage = {
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn()
}

global.document = {
  readyState: 'complete',
  querySelectorAll: jest.fn(() => [])
}

global.navigator = {
  userAgent: 'Mozilla/5.0 Test',
  platform: 'MacIntel',
  language: 'zh-TW',
  hardwareConcurrency: 8,
  onLine: true
}

global.screen = { width: 1920, height: 1080 }

describe('PerformanceAssessment 基礎功能測試', () => {
  let assessment

  beforeEach(() => {
    jest.clearAllMocks()
    assessment = new PerformanceAssessment({
      samplingInterval: 100,
      thresholds: {
        memory: { maxHeapUsage: 80 * 1024 * 1024 }
      }
    })
  })

  test('應該成功建立 PerformanceAssessment 實例', () => {
    expect(assessment).toBeDefined()
    expect(assessment.config).toBeDefined()
    expect(assessment.metricsCollector).toBeDefined()
  })

  test('應該拒絕無效的配置參數', () => {
    expect(() => {
      const invalidAssessment = new PerformanceAssessment(null)
      return invalidAssessment
    }).toThrow(/VALIDATION_FAILED/)
  })

  test('應該正確初始化預設配置', () => {
    const defaultAssessment = new PerformanceAssessment()

    expect(defaultAssessment.config.samplingInterval).toBe(1000)
    expect(defaultAssessment.config.enableRealTimeMonitoring).toBe(false)
  })

  test('應該生成報告', () => {
    const mockMetrics = {
      memory: { heapUsed: 50000000 }
    }

    const report = assessment.generateReport(mockMetrics)

    expect(report).toBeDefined()
    expect(report.reportId).toBeDefined()
    expect(report.timestamp).toBeDefined()
    expect(report.metrics).toBeDefined()
  })

  test('應該收集記憶體指標', async () => {
    const memoryMetrics = await assessment.collectMemoryMetrics()

    expect(memoryMetrics).toBeDefined()
    expect(memoryMetrics.timestamp).toBeDefined()
  })

  test('應該啟動和停止監控', () => {
    const session = assessment.startRealTimeMonitoring({})

    expect(session).toBeDefined()
    expect(assessment.isMonitoring).toBe(true)

    assessment.stopRealTimeMonitoring()
    expect(assessment.isMonitoring).toBe(false)
  })

  test('應該收集系統資訊', async () => {
    const systemInfo = await assessment.getSystemInfo()

    expect(systemInfo).toBeDefined()
    expect(systemInfo.browser).toBeDefined()
    expect(systemInfo.extension).toBeDefined()
  })

  test('應該計算效能分數', () => {
    const mockMetrics = {
      heapUsed: 40 * 1024 * 1024,
      heapTotal: 80 * 1024 * 1024
    }

    const analysis = assessment.analyzeMemoryMetrics(mockMetrics)

    expect(analysis.score).toBeGreaterThanOrEqual(0)
    expect(analysis.score).toBeLessThanOrEqual(100)
  })
})
