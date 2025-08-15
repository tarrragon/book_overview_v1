/**
 * @fileoverview Platform Detection Service 單元測試
 * @version v2.1.0
 * @since 2025-08-13
 *
 * TDD Red Phase - 測試驅動開發紅燈階段
 * 設計完整測試案例，確保 100% 程式碼覆蓋率
 */

const PlatformDetectionService = require('../../../../../../src/background/domains/platform/services/platform-detection-service.js')
const EventBus = require('../../../../../../src/core/event-bus.js')

// 測試專用模擬資料
const MockPlatformData = {
  // Readmoo 平台測試資料
  READMOO: {
    urls: [
      'https://readmoo.com',
      'https://read.readmoo.com',
      'https://store.readmoo.com',
      'https://readmoo.com/book/123456'
    ],
    domFeatures: [
      { selector: '.readmoo-header', exists: true },
      { selector: '.readmoo-reader', exists: true },
      { selector: 'meta[name="readmoo-version"]', exists: true }
    ],
    expectedConfidence: 0.95
  },

  // Kindle 平台測試資料
  KINDLE: {
    urls: [
      'https://read.amazon.com',
      'https://kindle.amazon.com',
      'https://read.amazon.co.uk/kp/embed'
    ],
    domFeatures: [
      { selector: '#kindle-reader', exists: true },
      { selector: '.amazon-header', exists: true }
    ],
    expectedConfidence: 0.90
  },

  // 未知平台測試資料
  UNKNOWN: {
    urls: [
      'https://example.com',
      'https://google.com',
      'https://unknown-site.org'
    ],
    expectedConfidence: 0.0
  }
}

describe('PlatformDetectionService', () => {
  let service
  let mockEventBus
  let mockDOM

  beforeEach(() => {
    // 初始化模擬 EventBus
    mockEventBus = {
      emit: jest.fn().mockResolvedValue([]),
      on: jest.fn(),
      off: jest.fn(),
      hasListener: jest.fn().mockReturnValue(false)
    }

    // 初始化模擬 DOM
    mockDOM = {
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(),
      location: { hostname: '', href: '' }
    }

    // 初始化服務
    service = new PlatformDetectionService(mockEventBus)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ==================== 基本初始化和配置測試 ====================
  describe('Service Initialization', () => {
    test('should initialize with correct default configuration', () => {
      expect(service.eventBus).toBe(mockEventBus)
      expect(service.confidenceThreshold).toBe(0.8)
      expect(service.detectionCache).toBeDefined()
      expect(service.platformPatterns).toBeDefined()
    })

    test('should initialize platform patterns correctly', () => {
      const patterns = service.platformPatterns
      expect(patterns.get('READMOO')).toBeDefined()
      expect(patterns.get('KINDLE')).toBeDefined()
      expect(patterns.get('KOBO')).toBeDefined()
      expect(patterns.get('BOOKWALKER')).toBeDefined()
      expect(patterns.get('BOOKS_COM')).toBeDefined()
    })

    test('should initialize with empty detection cache', () => {
      expect(service.detectionCache.size).toBe(0)
    })

    test('should set correct confidence threshold', () => {
      expect(service.confidenceThreshold).toBeGreaterThan(0)
      expect(service.confidenceThreshold).toBeLessThanOrEqual(1)
    })

    test('should register event listeners on initialization', () => {
      expect(mockEventBus.on).toHaveBeenCalled()
    })
  })

  // ==================== URL 模式匹配分析測試 ====================
  describe('URL Pattern Matching', () => {
    test('should detect Readmoo platform from main URL', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('READMOO')
      expect(result.confidence).toBeGreaterThan(0.8)
      expect(result.features).toContain('url_pattern_match')
    })

    test('should detect Readmoo platform from reader URL', async () => {
      const context = {
        url: 'https://read.readmoo.com/book/123456',
        hostname: 'read.readmoo.com'
      }

      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('READMOO')
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    test('should detect Kindle platform from Amazon read URL', async () => {
      const context = {
        url: 'https://read.amazon.com/kp/embed',
        hostname: 'read.amazon.com'
      }

      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('KINDLE')
      expect(result.confidence).toBeGreaterThan(0.7)
    })

    test('should detect Kobo platform correctly', async () => {
      const context = {
        url: 'https://www.kobo.com/tw/zh/ebook',
        hostname: 'www.kobo.com'
      }

      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('KOBO')
      expect(result.confidence).toBeGreaterThan(0.7)
    })

    test('should detect BookWalker platform correctly', async () => {
      const context = {
        url: 'https://www.bookwalker.com.tw/product/12345',
        hostname: 'www.bookwalker.com.tw'
      }

      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('BOOKWALKER')
      expect(result.confidence).toBeGreaterThan(0.7)
    })

    test('should detect Books.com platform correctly', async () => {
      const context = {
        url: 'https://www.books.com.tw/web/ebook',
        hostname: 'www.books.com.tw'
      }

      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('BOOKS_COM')
      expect(result.confidence).toBeGreaterThan(0.7)
    })

    test('should return unknown for unrecognized URLs', async () => {
      const context = {
        url: 'https://unknown-site.com',
        hostname: 'unknown-site.com'
      }

      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('UNKNOWN')
      expect(result.confidence).toBe(0)
    })

    test('should handle malformed URLs gracefully', async () => {
      const context = {
        url: 'not-a-valid-url',
        hostname: ''
      }

      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('UNKNOWN')
      expect(result.confidence).toBe(0)
      expect(result.error).toBeDefined()
    })

    test('should handle URLs with query parameters', async () => {
      const context = {
        url: 'https://readmoo.com/book/123456?ref=search&page=1',
        hostname: 'readmoo.com'
      }

      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('READMOO')
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    test('should handle HTTPS vs HTTP variations', async () => {
      const contextHTTPS = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      const contextHTTP = {
        url: 'http://readmoo.com',
        hostname: 'readmoo.com'
      }

      const resultHTTPS = await service.detectPlatform(contextHTTPS)
      const resultHTTP = await service.detectPlatform(contextHTTP)

      expect(resultHTTPS.platformId).toBe(resultHTTP.platformId)
    })

    test('should handle subdomain variations correctly', async () => {
      const contexts = [
        { url: 'https://store.readmoo.com', hostname: 'store.readmoo.com' },
        { url: 'https://read.readmoo.com', hostname: 'read.readmoo.com' },
        { url: 'https://api.readmoo.com', hostname: 'api.readmoo.com' }
      ]

      for (const context of contexts) {
        const result = await service.detectPlatform(context)
        expect(result.platformId).toBe('READMOO')
      }
    })

    test('should prioritize more specific URL patterns', async () => {
      const context = {
        url: 'https://read.readmoo.com/reader/book/123456',
        hostname: 'read.readmoo.com'
      }

      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('READMOO')
      expect(result.confidence).toBeGreaterThan(0.85)
      expect(result.features).toContain('reader_url_pattern')
    })

    // 國際化URL測試
    test('should handle internationalized URLs', async () => {
      const context = {
        url: 'https://www.kobo.com/jp/ja/ebook',
        hostname: 'www.kobo.com'
      }

      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('KOBO')
      expect(result.confidence).toBeGreaterThan(0.7)
    })

    test('should handle URL fragments and anchors', async () => {
      const context = {
        url: 'https://readmoo.com/book/123456#chapter-3',
        hostname: 'readmoo.com'
      }

      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('READMOO')
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    // 效能相關測試
    test('should complete URL pattern matching within performance threshold', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      const startTime = performance.now()
      await service.detectPlatform(context)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(50) // 50ms threshold for URL matching
    })

    test('should cache URL pattern matching results', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      // First call
      await service.detectPlatform(context)

      // Second call should be faster (cached)
      const startTime = performance.now()
      await service.detectPlatform(context)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(10) // Should be very fast from cache
    })

    test('should handle concurrent URL pattern matching', async () => {
      const contexts = [
        { url: 'https://readmoo.com', hostname: 'readmoo.com' },
        { url: 'https://read.amazon.com', hostname: 'read.amazon.com' },
        { url: 'https://www.kobo.com', hostname: 'www.kobo.com' }
      ]

      const promises = contexts.map(context => service.detectPlatform(context))
      const results = await Promise.all(promises)

      expect(results[0].platformId).toBe('READMOO')
      expect(results[1].platformId).toBe('KINDLE')
      expect(results[2].platformId).toBe('KOBO')
    })
  })

  // ==================== DOM 結構特徵檢測測試 ====================
  describe('DOM Feature Detection', () => {
    test('should detect Readmoo DOM features correctly', async () => {
      mockDOM.querySelector = jest.fn()
        .mockReturnValueOnce({ className: 'readmoo-header' }) // .readmoo-header
        .mockReturnValueOnce({ content: 'readmoo-reader' }) // .readmoo-reader

      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com',
        DOM: mockDOM
      }

      const result = await service.detectPlatform(context)

      expect(result.confidence).toBeGreaterThan(0.9)
      expect(result.features).toContain('dom_features_match')
    })

    test('should detect Kindle DOM features correctly', async () => {
      mockDOM.querySelector = jest.fn()
        .mockReturnValueOnce({ id: 'kindle-reader' })
        .mockReturnValueOnce({ className: 'amazon-header' })

      const context = {
        url: 'https://read.amazon.com',
        hostname: 'read.amazon.com',
        DOM: mockDOM
      }

      const result = await service.detectPlatform(context)

      expect(result.confidence).toBeGreaterThan(0.8)
      expect(result.features).toContain('dom_features_match')
    })

    test('should handle missing DOM gracefully', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
        // No DOM provided
      }

      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('READMOO')
      expect(result.confidence).toBeGreaterThan(0.5) // Lower confidence without DOM
      expect(result.features).toContain('url_pattern_match')
      expect(result.features).not.toContain('dom_features_match')
    })

    test('should handle DOM query errors gracefully', async () => {
      mockDOM.querySelector = jest.fn().mockImplementation(() => {
        throw new Error('DOM query failed')
      })

      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com',
        DOM: mockDOM
      }

      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('READMOO')
      expect(result.features).toContain('url_pattern_match')
      expect(result.features).not.toContain('dom_features_match')
    })

    test('should prioritize DOM features over URL patterns', async () => {
      // URL suggests one platform, but DOM suggests another
      mockDOM.querySelector = jest.fn()
        .mockReturnValueOnce({ id: 'kindle-reader' })
        .mockReturnValueOnce({ className: 'amazon-header' })

      const context = {
        url: 'https://confusing-domain.com', // Ambiguous URL
        hostname: 'confusing-domain.com',
        DOM: mockDOM
      }

      // Mock URL pattern to return low confidence
      service.analyzeUrlPattern = jest.fn().mockReturnValue({
        platformId: 'UNKNOWN',
        confidence: 0.1
      })

      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('KINDLE') // DOM should win
      expect(result.confidence).toBeGreaterThan(0.7)
    })

    test('should combine URL and DOM confidence scores correctly', async () => {
      mockDOM.querySelector = jest.fn()
        .mockReturnValueOnce({ className: 'readmoo-header' })
        .mockReturnValueOnce({ content: 'readmoo-reader' })

      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com',
        DOM: mockDOM
      }

      const result = await service.detectPlatform(context)

      // Both URL and DOM should contribute to high confidence
      expect(result.confidence).toBeGreaterThan(0.9)
      expect(result.features).toContain('url_pattern_match')
      expect(result.features).toContain('dom_features_match')
    })

    test('should detect multiple DOM elements correctly', async () => {
      mockDOM.querySelectorAll = jest.fn()
        .mockReturnValueOnce([
          { className: 'readmoo-book' },
          { className: 'readmoo-book' },
          { className: 'readmoo-book' }
        ])

      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com',
        DOM: mockDOM
      }

      const result = await service.detectPlatform(context)

      expect(result.features).toContain('multiple_dom_elements')
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    test('should handle dynamic DOM changes', async () => {
      let domCallCount = 0
      mockDOM.querySelector = jest.fn().mockImplementation((selector) => {
        domCallCount++
        // First call returns nothing, second call returns element (simulating lazy loading)
        return domCallCount > 1 ? { className: 'readmoo-reader' } : null
      })

      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com',
        DOM: mockDOM
      }

      // Enable retry mechanism
      service.enableDOMRetry = true

      const result = await service.detectPlatform(context)

      expect(mockDOM.querySelector).toHaveBeenCalledTimes(2)
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    test('should respect DOM analysis timeout', async () => {
      mockDOM.querySelector = jest.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({ className: 'readmoo-header' }), 1000) // 1 second delay
        })
      })

      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com',
        DOM: mockDOM
      }

      service.domAnalysisTimeout = 500 // 500ms timeout

      const startTime = performance.now()
      const result = await service.detectPlatform(context)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(600) // Should timeout
      expect(result.features).toContain('dom_analysis_timeout')
    })

    test('should detect meta tags correctly', async () => {
      mockDOM.querySelector = jest.fn().mockImplementation((selector) => {
        if (selector.includes('meta[name="readmoo-version"]')) {
          return { content: '2.1.0' }
        }
        return null
      })

      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com',
        DOM: mockDOM
      }

      const result = await service.detectPlatform(context)

      expect(result.features).toContain('meta_tag_match')
      expect(result.metadata).toHaveProperty('version', '2.1.0')
    })

    test('should detect JavaScript objects in global scope', async () => {
      const mockWindow = {
        readmoo: {
          version: '2.1.0',
          reader: {}
        }
      }

      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com',
        DOM: mockDOM,
        window: mockWindow
      }

      const result = await service.detectPlatform(context)

      expect(result.features).toContain('javascript_object_match')
      expect(result.confidence).toBeGreaterThan(0.8)
    })
  })

  // ==================== 平台檢測核心邏輯測試 ====================
  describe('Platform Detection Core Logic', () => {
    test('should return structured detection result', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      const result = await service.detectPlatform(context)

      expect(result).toHaveProperty('platformId')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('features')
      expect(result).toHaveProperty('version')
      expect(result).toHaveProperty('capabilities')
      expect(result).toHaveProperty('metadata')
      expect(Array.isArray(result.features)).toBe(true)
      expect(Array.isArray(result.capabilities)).toBe(true)
      expect(typeof result.metadata).toBe('object')
    })

    test('should handle empty context gracefully', async () => {
      const result = await service.detectPlatform({})

      expect(result.platformId).toBe('UNKNOWN')
      expect(result.confidence).toBe(0)
      expect(result.features).toEqual([])
    })

    test('should handle null context gracefully', async () => {
      const result = await service.detectPlatform(null)

      expect(result.platformId).toBe('UNKNOWN')
      expect(result.confidence).toBe(0)
      expect(result.error).toBeDefined()
    })

    test('should emit detection started event', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      await service.detectPlatform(context)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'PLATFORM.DETECTION.STARTED',
        expect.objectContaining({
          context,
          timestamp: expect.any(Number)
        })
      )
    })

    test('should emit detection completed event', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      const result = await service.detectPlatform(context)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'PLATFORM.DETECTION.COMPLETED',
        expect.objectContaining({
          result,
          timestamp: expect.any(Number)
        })
      )
    })

    test('should emit detection failed event on error', async () => {
      // Force an error
      service.analyzeUrlPattern = jest.fn().mockImplementation(() => {
        throw new Error('Analysis failed')
      })

      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      const result = await service.detectPlatform(context)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'PLATFORM.DETECTION.FAILED',
        expect.objectContaining({
          error: expect.any(Error),
          context,
          timestamp: expect.any(Number)
        })
      )
    })

    test('should maintain detection statistics', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      // Perform multiple detections
      await service.detectPlatform(context)
      await service.detectPlatform(context)

      const stats = service.getDetectionStatistics()

      expect(stats.totalDetections).toBeGreaterThan(0)
      expect(stats.platformCounts).toHaveProperty('READMOO')
      expect(stats.averageDetectionTime).toBeGreaterThan(0)
    })

    test('should respect confidence threshold', async () => {
      service.confidenceThreshold = 0.9 // High threshold

      const context = {
        url: 'https://maybe-readmoo.com', // Ambiguous URL
        hostname: 'maybe-readmoo.com'
      }

      const result = await service.detectPlatform(context)

      if (result.confidence < service.confidenceThreshold) {
        expect(result.platformId).toBe('UNKNOWN')
      }
    })

    test('should handle concurrent detection requests', async () => {
      const contexts = [
        { url: 'https://readmoo.com', hostname: 'readmoo.com' },
        { url: 'https://read.amazon.com', hostname: 'read.amazon.com' },
        { url: 'https://www.kobo.com', hostname: 'www.kobo.com' }
      ]

      const promises = contexts.map(context => service.detectPlatform(context))
      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      expect(results[0].platformId).toBe('READMOO')
      expect(results[1].platformId).toBe('KINDLE')
      expect(results[2].platformId).toBe('KOBO')
    })

    test('should provide detailed capabilities for detected platforms', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      const result = await service.detectPlatform(context)

      expect(result.capabilities).toContain('book_extraction')
      expect(result.capabilities).toContain('reading_progress')
      expect(result.capabilities).toContain('user_annotations')
    })
  })

  // ==================== 檢測結果快取系統測試 ====================
  describe('Detection Cache System', () => {
    test('should cache detection results', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      // First detection
      const result1 = await service.detectPlatform(context)

      // Second detection should use cache
      const result2 = await service.detectPlatform(context)

      expect(result1).toEqual(result2)
      expect(service.detectionCache.size).toBeGreaterThan(0)
    })

    test('should generate correct cache keys', () => {
      const context1 = { url: 'https://readmoo.com', hostname: 'readmoo.com' }
      const context2 = { url: 'https://readmoo.com', hostname: 'readmoo.com' }
      const context3 = { url: 'https://kindle.amazon.com', hostname: 'kindle.amazon.com' }

      const key1 = service.generateCacheKey(context1)
      const key2 = service.generateCacheKey(context2)
      const key3 = service.generateCacheKey(context3)

      expect(key1).toBe(key2) // Same context should generate same key
      expect(key1).not.toBe(key3) // Different context should generate different key
    })

    test('should respect cache expiration', async () => {
      service.cacheTimeout = 100 // 100ms timeout

      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      // First detection
      await service.detectPlatform(context)

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150))

      // Second detection should not use expired cache
      const spy = jest.spyOn(service, 'analyzeUrlPattern')
      await service.detectPlatform(context)

      expect(spy).toHaveBeenCalled() // Should have analyzed again
    })

    test('should limit cache size', async () => {
      service.maxCacheSize = 2 // Limit to 2 entries

      const contexts = [
        { url: 'https://readmoo.com', hostname: 'readmoo.com' },
        { url: 'https://read.amazon.com', hostname: 'read.amazon.com' },
        { url: 'https://www.kobo.com', hostname: 'www.kobo.com' }
      ]

      // Fill cache beyond limit
      for (const context of contexts) {
        await service.detectPlatform(context)
      }

      expect(service.detectionCache.size).toBeLessThanOrEqual(service.maxCacheSize)
    })

    test('should clear cache when requested', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      await service.detectPlatform(context)
      expect(service.detectionCache.size).toBeGreaterThan(0)

      service.clearCache()
      expect(service.detectionCache.size).toBe(0)
    })

    test('should provide cache statistics', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      // First call (cache miss)
      await service.detectPlatform(context)
      // Second call (cache hit)
      await service.detectPlatform(context)

      const stats = service.getCacheStatistics()

      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBe(0.5)
    })

    test('should handle cache corruption gracefully', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      // Corrupt cache entry
      const cacheKey = service.generateCacheKey(context)
      service.detectionCache.set(cacheKey, null)

      // Should handle corrupted cache and perform fresh detection
      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('READMOO')
      expect(result.confidence).toBeGreaterThan(0)
    })
  })

  // ==================== 信心度計算演算法測試 ====================
  describe('Confidence Calculation Algorithm', () => {
    test('should calculate confidence correctly for perfect match', () => {
      const factors = {
        urlMatch: 1.0,
        domMatch: 1.0,
        metaMatch: 1.0,
        jsMatch: 1.0
      }

      const confidence = service.calculateConfidence(factors)

      expect(confidence).toBe(1.0)
    })

    test('should calculate confidence correctly for partial match', () => {
      const factors = {
        urlMatch: 0.8,
        domMatch: 0.6,
        metaMatch: 0.0,
        jsMatch: 0.4
      }

      const confidence = service.calculateConfidence(factors)

      expect(confidence).toBeGreaterThan(0.4)
      expect(confidence).toBeLessThan(0.8)
    })

    test('should weight URL matches higher than DOM matches', () => {
      const urlOnlyFactors = {
        urlMatch: 0.8,
        domMatch: 0.0,
        metaMatch: 0.0,
        jsMatch: 0.0
      }

      const domOnlyFactors = {
        urlMatch: 0.0,
        domMatch: 0.8,
        metaMatch: 0.0,
        jsMatch: 0.0
      }

      const urlConfidence = service.calculateConfidence(urlOnlyFactors)
      const domConfidence = service.calculateConfidence(domOnlyFactors)

      expect(urlConfidence).toBeGreaterThan(domConfidence)
    })

    test('should return zero confidence for no matches', () => {
      const factors = {
        urlMatch: 0.0,
        domMatch: 0.0,
        metaMatch: 0.0,
        jsMatch: 0.0
      }

      const confidence = service.calculateConfidence(factors)

      expect(confidence).toBe(0.0)
    })

    test('should apply confidence decay over time', () => {
      const baseConfidence = 0.8

      // Fresh detection
      const freshConfidence = service.applyTimeDecay(baseConfidence, 0)

      // Old detection (5 minutes)
      const oldConfidence = service.applyTimeDecay(baseConfidence, 5 * 60 * 1000)

      expect(freshConfidence).toBe(baseConfidence)
      expect(oldConfidence).toBeLessThan(baseConfidence)
    })

    test('should adjust confidence based on platform specificity', () => {
      // Highly specific platform
      const specificConfidence = service.adjustForPlatformSpecificity('READMOO', 0.8)

      // Generic platform pattern
      const genericConfidence = service.adjustForPlatformSpecificity('UNKNOWN', 0.8)

      expect(specificConfidence).toBeGreaterThanOrEqual(genericConfidence)
    })

    test('should normalize confidence scores correctly', () => {
      const rawScores = [1.2, 0.8, -0.1, 0.5]

      const normalizedScores = rawScores.map(score => service.normalizeConfidence(score))

      normalizedScores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(1)
      })
    })

    test('should handle edge cases in confidence calculation', () => {
      const edgeCases = [
        null,
        undefined,
        {},
        { urlMatch: NaN },
        { urlMatch: Infinity },
        { urlMatch: -Infinity }
      ]

      edgeCases.forEach(factors => {
        const confidence = service.calculateConfidence(factors)
        expect(confidence).toBeGreaterThanOrEqual(0)
        expect(confidence).toBeLessThanOrEqual(1)
        expect(Number.isFinite(confidence)).toBe(true)
      })
    })
  })

  // ==================== 事件發送和監聽測試 ====================
  describe('Event Emission and Handling', () => {
    test('should emit platform detected event with v2.0 format', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      await service.detectPlatform(context)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'PLATFORM.READMOO.DETECTION.COMPLETED',
        expect.objectContaining({
          platformId: 'READMOO',
          timestamp: expect.any(Number)
        })
      )
    })

    test('should emit generic detection events for backward compatibility', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      await service.detectPlatform(context)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'PLATFORM.DETECTION.COMPLETED',
        expect.any(Object)
      )
    })

    test('should handle event emission failures gracefully', async () => {
      mockEventBus.emit.mockRejectedValue(new Error('Event emission failed'))

      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      // Should not throw error
      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('READMOO')
    })

    test('should listen for platform validation requests', () => {
      expect(mockEventBus.on).toHaveBeenCalledWith(
        'PLATFORM.VALIDATION.REQUESTED',
        expect.any(Function)
      )
    })
  })

  // ==================== 錯誤處理和邊界情況測試 ====================
  describe('Error Handling and Edge Cases', () => {
    test('should handle service initialization errors', () => {
      // Mock EventBus constructor to throw error
      const originalEventBus = EventBus
      EventBus.mockImplementation(() => {
        throw new Error('EventBus initialization failed')
      })

      expect(() => {
        new PlatformDetectionService(mockEventBus)
      }).not.toThrow()

      // Restore original
      EventBus.mockImplementation(originalEventBus)
    })

    test('should handle pattern initialization errors', () => {
      service.initializePlatformPatterns = jest.fn().mockImplementation(() => {
        throw new Error('Pattern initialization failed')
      })

      // Should handle gracefully
      const patterns = service.platformPatterns
      expect(patterns).toBeDefined()
    })

    test('should handle network timeouts during detection', async () => {
      // Simulate network timeout
      service.fetchPlatformAPI = jest.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 100)
        })
      })

      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('READMOO') // Should still detect via URL
      expect(result.features).toContain('network_timeout')
    })

    test('should handle memory pressure gracefully', async () => {
      // Fill cache to simulate memory pressure
      for (let i = 0; i < 1000; i++) {
        service.detectionCache.set(`key-${i}`, { platformId: 'TEST', confidence: 0.5 })
      }

      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      // Should handle gracefully and clear cache if needed
      const result = await service.detectPlatform(context)

      expect(result.platformId).toBe('READMOO')
      expect(service.detectionCache.size).toBeLessThan(1000) // Should have cleaned up
    })
  })

  // ==================== 平台驗證功能測試 ====================
  describe('Platform Validation', () => {
    test('should validate detected platform correctly', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      const confidence = await service.validatePlatform('READMOO', context)

      expect(confidence).toBeGreaterThan(0.8)
    })

    test('should reject invalid platform validation', async () => {
      const context = {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      }

      const confidence = await service.validatePlatform('KINDLE', context)

      expect(confidence).toBeLessThan(0.5)
    })
  })
})

// ==================== 測試輔助工具 ====================
const TestHelpers = {
  createMockContext: (platform, options = {}) => {
    const contexts = {
      READMOO: {
        url: 'https://readmoo.com',
        hostname: 'readmoo.com'
      },
      KINDLE: {
        url: 'https://read.amazon.com',
        hostname: 'read.amazon.com'
      },
      KOBO: {
        url: 'https://www.kobo.com',
        hostname: 'www.kobo.com'
      }
    }

    return { ...contexts[platform], ...options }
  },

  expectValidDetectionResult: (result) => {
    expect(result).toHaveProperty('platformId')
    expect(result).toHaveProperty('confidence')
    expect(result).toHaveProperty('features')
    expect(typeof result.platformId).toBe('string')
    expect(typeof result.confidence).toBe('number')
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(Array.isArray(result.features)).toBe(true)
  },

  measurePerformance: async (fn) => {
    const startTime = performance.now()
    const result = await fn()
    const endTime = performance.now()

    return {
      result,
      duration: endTime - startTime
    }
  }
}

// Export for use in integration tests
module.exports = { TestHelpers }
