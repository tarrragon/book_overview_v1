/**
 * PerformanceAssessment 最小功能測試
 * 只測試核心功能，避免複雜的異步操作
 */

const PerformanceAssessment = require('../../../../src/core/performance/PerformanceAssessment')

// Mock Chrome APIs
global.chrome = {
  runtime: { getManifest: () => ({ version: '0.14.1' }) },
  storage: { local: { get: async () => ({}), set: async () => {} } },
  system: {
    memory: { getInfo: async () => ({ totalCapacityBytes: 8000000000, availableCapacityBytes: 4000000000 }) },
    cpu: { getInfo: async () => ({ numOfProcessors: 8 }) }
  }
}

// Mock Performance API
global.performance = {
  now: () => Date.now(),
  memory: { usedJSHeapSize: 50000000, totalJSHeapSize: 100000000, jsHeapSizeLimit: 2000000000 },
  timing: { navigationStart: 1000, loadEventEnd: 1500, fetchStart: 1100 },
  getEntriesByType: () => []
}

// Mock other globals
global.localStorage = { setItem: () => {}, getItem: () => null, removeItem: () => {} }
global.document = { readyState: 'complete', querySelectorAll: () => [] }
global.navigator = { userAgent: 'test', platform: 'test', hardwareConcurrency: 8, onLine: true }
global.screen = { width: 1920, height: 1080 }
global.Intl = { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 'UTC' }) }) }

describe('PerformanceAssessment 最小功能測試', () => {
  test('應該成功建立實例', () => {
    const assessment = new PerformanceAssessment()
    expect(assessment).toBeDefined()
    expect(assessment.config).toBeDefined()
  })

  test('應該拒絕無效配置', () => {
    expect(() => new PerformanceAssessment(null)).toThrow()
  })

  test('應該生成基本報告', () => {
    const assessment = new PerformanceAssessment()
    const report = assessment.generateReport({ memory: { heapUsed: 50000000 } })

    expect(report).toBeDefined()
    expect(report.reportId).toBeDefined()
    expect(report.timestamp).toBeDefined()
  })

  test('應該分析記憶體指標', () => {
    const assessment = new PerformanceAssessment()
    const analysis = assessment.analyzeMemoryMetrics({
      heapUsed: 40000000,
      heapTotal: 80000000
    })

    expect(analysis.score).toBeGreaterThanOrEqual(0)
    expect(analysis.score).toBeLessThanOrEqual(100)
  })

  test('應該計算總體分數', () => {
    const assessment = new PerformanceAssessment()
    const score = assessment.calculateOverallScore({
      memory: { score: 80 },
      cpu: { score: 70 }
    })

    expect(score).toBe(75) // (80+70)/2
  })
})
