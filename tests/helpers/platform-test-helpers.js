/**
 * Platform Domain 測試輔助工具
 * 提供平台檢測測試的通用工具函數和斷言
 *
 * Responsible for:
 * - 平台檢測測試的通用工具
 * - 自訂 Jest 匹配器
 * - 測試資料生成器
 * - 測試報告生成
 *
 * Design considerations:
 * - 簡化測試案例撰寫
 * - 提供一致的斷言邏輯
 * - 支援效能基準測試
 * - 便於測試維護和擴展
 *
 * Usage context:
 * - Platform Detection Service 測試
 * - Platform Registry Service 測試
 * - 整合測試支援
 */

/**
 * 自訂 Jest 匹配器擴展
 */
const customMatchers = {
  /**
   * 檢查檢測結果是否為有效的平台檢測結果
   * @param {Object} received - 實際檢測結果
   * @returns {Object} Jest 匹配結果
   */
  toBeValidDetectionResult (received) {
    const pass = received &&
      typeof received.platformId === 'string' &&
      typeof received.confidence === 'number' &&
      received.confidence >= 0 && received.confidence <= 1 &&
      Array.isArray(received.features) &&
      Array.isArray(received.capabilities) &&
      typeof received.metadata === 'object' &&
      received.metadata !== null

    if (pass) {
      return {
        message: () => `Expected ${this.utils.printReceived(received)} not to be a valid detection result`,
        pass: true
      }
    } else {
      return {
        message: () => `Expected ${this.utils.printReceived(received)} to be a valid detection result`,
        pass: false
      }
    }
  },

  /**
   * 檢查檢測結果的信心度是否超過閾值
   * @param {Object} received - 實際檢測結果
   * @param {number} threshold - 信心度閾值
   * @returns {Object} Jest 匹配結果
   */
  toHaveConfidenceAbove (received, threshold) {
    const pass = received &&
      typeof received.confidence === 'number' &&
      received.confidence > threshold

    if (pass) {
      return {
        message: () => `Expected confidence ${received.confidence} not to be above ${threshold}`,
        pass: true
      }
    } else {
      return {
        message: () => `Expected confidence ${received.confidence} to be above ${threshold}`,
        pass: false
      }
    }
  },

  /**
   * 檢查檢測結果是否包含預期的平台特徵
   * @param {Object} received - 實際檢測結果
   * @param {Array} expectedFeatures - 預期特徵列表
   * @returns {Object} Jest 匹配結果
   */
  toContainFeatures (received, expectedFeatures) {
    if (!received || !Array.isArray(received.features)) {
      return {
        message: () => 'Expected result to have features array',
        pass: false
      }
    }

    const missingFeatures = expectedFeatures.filter(feature =>
      !received.features.includes(feature)
    )

    const pass = missingFeatures.length === 0

    if (pass) {
      return {
        message: () => `Expected features ${this.utils.printReceived(received.features)} not to contain ${this.utils.printExpected(expectedFeatures)}`,
        pass: true
      }
    } else {
      return {
        message: () => `Expected features ${this.utils.printReceived(received.features)} to contain ${this.utils.printExpected(expectedFeatures)}. Missing: ${missingFeatures.join(', ')}`,
        pass: false
      }
    }
  },

  /**
   * 檢查檢測是否在指定時間內完成
   * @param {number} received - 實際執行時間（毫秒）
   * @param {number} maxTime - 最大允許時間（毫秒）
   * @returns {Object} Jest 匹配結果
   */
  toCompleteWithin (received, maxTime) {
    const pass = typeof received === 'number' && received <= maxTime

    if (pass) {
      return {
        message: () => `Expected detection time ${received}ms not to be within ${maxTime}ms`,
        pass: true
      }
    } else {
      return {
        message: () => `Expected detection time ${received}ms to be within ${maxTime}ms`,
        pass: false
      }
    }
  }
}

/**
 * 安裝自訂匹配器
 */
function setupCustomMatchers () {
  expect.extend(customMatchers)
}

/**
 * 平台檢測斷言工具
 */
const assertions = {
  /**
   * 斷言檢測結果結構完整性
   * @param {Object} result - 檢測結果
   */
  assertDetectionResultStructure (result) {
    expect(result).toBeDefined()
    expect(result).toHaveProperty('platformId')
    expect(result).toHaveProperty('confidence')
    expect(result).toHaveProperty('features')
    expect(result).toHaveProperty('capabilities')
    expect(result).toHaveProperty('metadata')

    expect(typeof result.platformId).toBe('string')
    expect(typeof result.confidence).toBe('number')
    expect(Array.isArray(result.features)).toBe(true)
    expect(Array.isArray(result.capabilities)).toBe(true)
    expect(typeof result.metadata).toBe('object')
    expect(result.metadata).not.toBeNull()
  },

  /**
   * 斷言檢測結果符合平台期望
   * @param {Object} result - 檢測結果
   * @param {string} expectedPlatform - 預期平台
   * @param {number} minConfidence - 最小信心度
   */
  assertPlatformDetection (result, expectedPlatform, minConfidence = 0.8) {
    this.assertDetectionResultStructure(result)
    expect(result.platformId).toBe(expectedPlatform)
    expect(result.confidence).toBeGreaterThanOrEqual(minConfidence)

    if (expectedPlatform !== 'UNKNOWN') {
      expect(result.features).toContain('url_pattern_match')
      expect(result.features.length).toBeGreaterThan(0)
    }
  },

  /**
   * 斷言檢測效能符合要求
   * @param {number} duration - 檢測耗時（毫秒）
   * @param {number} maxTime - 最大允許時間（毫秒）
   */
  assertDetectionPerformance (duration, maxTime = 500) {
    expect(duration).toBeLessThan(maxTime)
    expect(typeof duration).toBe('number')
    expect(duration).toBeGreaterThan(0)
  },

  /**
   * 斷言事件發送正確性
   * @param {Object} mockEventBus - 模擬事件匯流排
   * @param {string} expectedEvent - 預期事件名稱
   * @param {Object} expectedPayload - 預期事件負載
   */
  assertEventEmission (mockEventBus, expectedEvent, expectedPayload = {}) {
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      expectedEvent,
      expect.objectContaining({
        timestamp: expect.any(Number),
        ...expectedPayload
      })
    )
  }
}

/**
 * 測試資料生成器
 */
const dataGenerators = {
  /**
   * 生成隨機 URL
   * @param {string} platform - 平台類型
   * @param {Object} options - 生成選項
   * @returns {string} 生成的 URL
   */
  generateRandomUrl (platform, options = {}) {
    const baseUrls = {
      READMOO: ['https://readmoo.com', 'https://www.readmoo.com'],
      KINDLE: ['https://read.amazon.com', 'https://kindle.amazon.com'],
      KOBO: ['https://www.kobo.com', 'https://kobo.com'],
      BOOKWALKER: ['https://global.bookwalker.jp', 'https://bookwalker.jp'],
      BOOKS_COM: ['https://www.books.com.tw', 'https://member.books.com.tw']
    }

    const paths = ['/library', '/books', '/collections', '/search']
    const queries = ['', '?page=1', '?category=fiction', '?sort=title']

    const baseUrl = baseUrls[platform]
      ? baseUrls[platform][Math.floor(Math.random() * baseUrls[platform].length)]
      : 'https://unknown-platform.com'

    const path = paths[Math.floor(Math.random() * paths.length)]
    const query = queries[Math.floor(Math.random() * queries.length)]

    return `${baseUrl}${path}${query}`
  },

  /**
   * 生成測試用的檢測上下文
   * @param {string} platform - 平台類型
   * @param {Object} overrides - 覆蓋選項
   * @returns {Object} 檢測上下文
   */
  generateDetectionContext (platform, overrides = {}) {
    const url = overrides.url || this.generateRandomUrl(platform)
    let hostname

    try {
      hostname = new URL(url).hostname
    } catch (error) {
      hostname = 'unknown-platform.com'
    }

    return {
      url,
      hostname,
      DOM: overrides.DOM || this.generateMockDOM(platform),
      userAgent: overrides.userAgent || 'Mozilla/5.0 Test Agent',
      timestamp: new Date(),
      ...overrides
    }
  },

  /**
   * 生成模擬 DOM
   * @param {string} platform - 平台類型
   * @returns {Object} 模擬 DOM 物件
   */
  generateMockDOM (platform) {
    const features = {
      READMOO: { selectors: ['.library-book', '.readmoo-header'], text: '讀墨 Readmoo' },
      KINDLE: { selectors: ['.library-item', '.kindle-header'], text: 'Kindle Amazon' },
      KOBO: { selectors: ['.kobo-book', '.library-book'], text: 'Kobo My Books' },
      BOOKWALKER: { selectors: ['.bw-library-item'], text: 'BookWalker Library' },
      BOOKS_COM: { selectors: ['.book-item'], text: '博客來 books.com.tw' }
    }

    const platformFeatures = features[platform] || { selectors: [], text: 'Generic Platform' }

    return {
      querySelector: jest.fn((selector) => {
        return platformFeatures.selectors.includes(selector)
          ? { textContent: 'Mock Element' }
          : null
      }),
      querySelectorAll: jest.fn((selector) => {
        return platformFeatures.selectors.includes(selector)
          ? [{ textContent: 'Mock Element 1' }, { textContent: 'Mock Element 2' }]
          : []
      }),
      documentElement: {
        textContent: platformFeatures.text,
        innerHTML: `<body>Mock ${platform} page</body>`
      },
      readyState: 'complete'
    }
  },

  /**
   * 生成批量測試資料
   * @param {Array} platforms - 平台陣列
   * @param {number} countPerPlatform - 每平台生成數量
   * @returns {Array} 測試資料陣列
   */
  generateBatchTestData (platforms, countPerPlatform = 5) {
    const testData = []

    platforms.forEach(platform => {
      for (let i = 0; i < countPerPlatform; i++) {
        testData.push({
          platform,
          context: this.generateDetectionContext(platform),
          expectedResult: {
            platformId: platform,
            minConfidence: 0.5
          }
        })
      }
    })

    return testData
  }
}

/**
 * 效能測試工具
 */
const performanceUtils = {
  /**
   * 測量函數執行時間
   * @param {Function} fn - 要測量的函數
   * @param {...any} args - 函數參數
   * @returns {Promise<Object>} 執行結果和時間
   */
  async measureExecutionTime (fn, ...args) {
    const start = process.hrtime.bigint()

    try {
      const result = await fn(...args)
      const end = process.hrtime.bigint()
      const duration = Number(end - start) / 1000000 // 轉換為毫秒

      return { result, duration, success: true }
    } catch (error) {
      const end = process.hrtime.bigint()
      const duration = Number(end - start) / 1000000

      return { error, duration, success: false }
    }
  },

  /**
   * 執行效能基準測試
   * @param {Function} fn - 測試函數
   * @param {Array} testCases - 測試案例
   * @param {Object} benchmarks - 效能基準
   * @returns {Promise<Object>} 基準測試結果
   */
  async runPerformanceBenchmark (fn, testCases, benchmarks = {}) {
    const {
      maxAverageTime = 500,
      maxSingleTime = 1000,
      minSuccessRate = 0.95
    } = benchmarks

    const results = []
    let totalTime = 0
    let successCount = 0

    for (const testCase of testCases) {
      const measurement = await this.measureExecutionTime(fn, testCase)
      results.push(measurement)

      totalTime += measurement.duration
      if (measurement.success) successCount++
    }

    const averageTime = totalTime / testCases.length
    const maxTime = Math.max(...results.map(r => r.duration))
    const successRate = successCount / testCases.length

    const benchmarkResult = {
      passed: averageTime <= maxAverageTime &&
              maxTime <= maxSingleTime &&
              successRate >= minSuccessRate,
      metrics: {
        averageTime,
        maxTime,
        totalTime,
        successRate,
        testCount: testCases.length
      },
      benchmarks: {
        maxAverageTime,
        maxSingleTime,
        minSuccessRate
      },
      results
    }

    return benchmarkResult
  }
}

/**
 * 測試報告生成器
 */
const reportGenerator = {
  /**
   * 生成檢測結果摘要報告
   * @param {Array} testResults - 測試結果陣列
   * @returns {Object} 摘要報告
   */
  generateDetectionSummary (testResults) {
    const summary = {
      totalTests: testResults.length,
      successful: 0,
      failed: 0,
      platformStats: {},
      averageConfidence: 0,
      averageTime: 0
    }

    let totalConfidence = 0
    let totalTime = 0

    testResults.forEach(result => {
      if (result.success) {
        summary.successful++
        totalConfidence += result.detection?.confidence || 0

        const platform = result.detection?.platformId || 'UNKNOWN'
        if (!summary.platformStats[platform]) {
          summary.platformStats[platform] = { count: 0, avgConfidence: 0 }
        }
        summary.platformStats[platform].count++
      } else {
        summary.failed++
      }

      totalTime += result.duration || 0
    })

    summary.averageConfidence = totalConfidence / summary.successful || 0
    summary.averageTime = totalTime / summary.totalTests || 0
    summary.successRate = summary.successful / summary.totalTests

    // 計算各平台平均信心度
    Object.keys(summary.platformStats).forEach(platform => {
      const platformResults = testResults.filter(r =>
        r.success && r.detection?.platformId === platform
      )
      const avgConfidence = platformResults.reduce((sum, r) =>
        sum + r.detection.confidence, 0
      ) / platformResults.length

      summary.platformStats[platform].avgConfidence = avgConfidence
    })

    return summary
  },

  /**
   * 生成效能測試報告
   * @param {Object} benchmarkResult - 基準測試結果
   * @returns {string} 效能報告文字
   */
  generatePerformanceReport (benchmarkResult) {
    const { metrics, benchmarks, passed } = benchmarkResult

    return `
Performance Benchmark Report
============================
Status: ${passed ? 'PASSED ✓' : 'FAILED ✗'}

Metrics:
- Average Time: ${metrics.averageTime.toFixed(2)}ms (Limit: ${benchmarks.maxAverageTime}ms)
- Maximum Time: ${metrics.maxTime.toFixed(2)}ms (Limit: ${benchmarks.maxSingleTime}ms)
- Total Time: ${metrics.totalTime.toFixed(2)}ms
- Success Rate: ${(metrics.successRate * 100).toFixed(1)}% (Min: ${(benchmarks.minSuccessRate * 100).toFixed(1)}%)
- Test Count: ${metrics.testCount}

${passed ? 'All benchmarks passed!' : 'Some benchmarks failed!'}
`
  }
}

module.exports = {
  setupCustomMatchers,
  assertions,
  dataGenerators,
  performanceUtils,
  reportGenerator,
  customMatchers
}
