/**
 * IValidationCacheManager 介面測試
 *
 * 測試目標：
 * - 驗證驗證快取管理介面契約
 * - 測試驗證結果快取、失效和更新功能
 * - 確保快取效能和記憶體管理
 * - 驗證多層級快取策略和統計追蹤
 *
 * @jest-environment jsdom
 */

describe('IValidationCacheManager TDD 介面契約測試', () => {
  let validationCacheManager
  let mockStorage
  let mockEvictionCallback

  beforeEach(() => {
    // Mock 依賴服務
    mockStorage = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      keys: jest.fn(),
      size: jest.fn()
    }

    mockEvictionCallback = jest.fn()

    // 實例化 ValidationCacheManager
    const ValidationCacheManager = require('src/background/domains/data-management/services/ValidationCacheManager.js')
    validationCacheManager = new ValidationCacheManager({
      storage: mockStorage,
      maxMemoryCache: 1000,
      maxPersistentCache: 5000,
      defaultTTL: 300000, // 5分鐘
      enablePersistentCache: true,
      enableStatistics: true
    })
  })

  describe('🔴 Red 階段：介面契約驗證', () => {
    test('應該正確實作 IValidationCacheManager 介面', () => {
      // Given: ValidationCacheManager 實例

      // Then: 應該實作所有必要的介面方法
      expect(typeof validationCacheManager.cacheValidationResult).toBe('function')
      expect(typeof validationCacheManager.getCachedValidation).toBe('function')
      expect(typeof validationCacheManager.invalidateCache).toBe('function')
      expect(typeof validationCacheManager.clearCache).toBe('function')
      expect(typeof validationCacheManager.cacheQualityAnalysis).toBe('function')
      expect(typeof validationCacheManager.getCachedQuality).toBe('function')
      expect(typeof validationCacheManager.cachePlatformRules).toBe('function')
      expect(typeof validationCacheManager.getCachedRules).toBe('function')
      expect(typeof validationCacheManager.getStatistics).toBe('function')
      expect(typeof validationCacheManager.optimizeCache).toBe('function')
      expect(validationCacheManager.isInitialized).toBeDefined()
    })

    test('cacheValidationResult() 應該快取驗證結果', async () => {
      // Given: 驗證結果和快取選項
      const cacheKey = 'book_123_READMOO_validation'
      const validationResult = {
        isValid: true,
        errors: [],
        warnings: ['minor format issue'],
        processingTime: 45,
        timestamp: Date.now(),
        bookId: 'book_123',
        platform: 'READMOO'
      }
      const cacheOptions = {
        ttl: 600000, // 10分鐘
        priority: 'high',
        persistToDisk: true
      }

      // When: 快取驗證結果
      const cacheResult = await validationCacheManager.cacheValidationResult(
        cacheKey,
        validationResult,
        cacheOptions
      )

      // Then: 應該成功快取並返回結果
      expect(cacheResult).toHaveProperty('cached', true)
      expect(cacheResult).toHaveProperty('cacheKey', cacheKey)
      expect(cacheResult).toHaveProperty('cacheLevel')
      expect(cacheResult).toHaveProperty('expiresAt')
      expect(cacheResult).toHaveProperty('size')
      expect(['memory', 'persistent', 'both'].includes(cacheResult.cacheLevel)).toBe(true)
    })

    test('getCachedValidation() 應該檢索快取的驗證結果', async () => {
      // Given: 已快取的驗證結果
      const cacheKey = 'book_456_KINDLE_validation'
      const originalResult = {
        isValid: false,
        errors: ['missing required field'],
        warnings: [],
        processingTime: 30,
        bookId: 'book_456',
        platform: 'KINDLE'
      }

      // 先快取結果
      await validationCacheManager.cacheValidationResult(cacheKey, originalResult)

      // When: 檢索快取的驗證結果
      const cachedResult = await validationCacheManager.getCachedValidation(cacheKey)

      // Then: 應該返回快取的結果
      expect(cachedResult).toHaveProperty('found', true)
      expect(cachedResult).toHaveProperty('data')
      expect(cachedResult).toHaveProperty('cacheLevel')
      expect(cachedResult).toHaveProperty('cachedAt')
      expect(cachedResult).toHaveProperty('expiresAt')
      expect(cachedResult.data.isValid).toBe(false)
      expect(cachedResult.data.bookId).toBe('book_456')
      expect(cachedResult.data.errors).toEqual(['missing required field'])
    })

    test('cacheQualityAnalysis() 應該快取品質分析結果', async () => {
      // Given: 品質分析結果
      const cacheKey = 'book_789_READMOO_quality'
      const qualityResult = {
        bookId: 'book_789',
        platform: 'READMOO',
        overallScore: 85,
        qualityDimensions: {
          completeness: 90,
          validity: 85,
          consistency: 80,
          accuracy: 85
        },
        strengths: ['good completeness', 'valid format'],
        weaknesses: ['minor consistency issues'],
        improvementSuggestions: [
          {
            priority: 'medium',
            category: 'consistency',
            recommendation: 'Standardize author format'
          }
        ],
        processingTime: 120
      }

      // When: 快取品質分析結果
      const cacheResult = await validationCacheManager.cacheQualityAnalysis(
        cacheKey,
        qualityResult,
        { ttl: 900000 } // 15分鐘
      )

      // Then: 應該成功快取
      expect(cacheResult.cached).toBe(true)
      expect(cacheResult.cacheKey).toBe(cacheKey)
      expect(typeof cacheResult.expiresAt).toBe('number')
    })

    test('getCachedQuality() 應該檢索快取的品質分析', async () => {
      // Given: 已快取的品質分析
      const cacheKey = 'book_101_KOBO_quality'
      const qualityData = {
        bookId: 'book_101',
        overallScore: 92,
        qualityDimensions: { completeness: 95, validity: 90 }
      }

      await validationCacheManager.cacheQualityAnalysis(cacheKey, qualityData)

      // When: 檢索快取的品質分析
      const cachedQuality = await validationCacheManager.getCachedQuality(cacheKey)

      // Then: 應該返回快取的品質資料
      expect(cachedQuality.found).toBe(true)
      expect(cachedQuality.data.bookId).toBe('book_101')
      expect(cachedQuality.data.overallScore).toBe(92)
    })

    test('cachePlatformRules() 應該快取平台規則', async () => {
      // Given: 平台規則資料
      const platform = 'READMOO'
      const rules = {
        requiredFields: ['id', 'title', 'authors'],
        dataTypes: {
          id: 'string',
          title: 'string',
          authors: 'array'
        },
        businessRules: {
          titleMinLength: 2,
          progressRange: [0, 100]
        },
        validationConfig: {
          strictMode: false
        }
      }

      // When: 快取平台規則
      const cacheResult = await validationCacheManager.cachePlatformRules(platform, rules)

      // Then: 應該成功快取規則
      expect(cacheResult.cached).toBe(true)
      expect(cacheResult.platform).toBe(platform)
      expect(cacheResult).toHaveProperty('ruleVersion')
    })

    test('getCachedRules() 應該檢索快取的平台規則', async () => {
      // Given: 已快取的平台規則
      const platform = 'KINDLE'
      const rules = {
        requiredFields: ['id', 'title', 'asin'],
        businessRules: { kindleSpecificValidation: true }
      }

      await validationCacheManager.cachePlatformRules(platform, rules)

      // When: 檢索快取的規則
      const cachedRules = await validationCacheManager.getCachedRules(platform)

      // Then: 應該返回快取的規則
      expect(cachedRules.found).toBe(true)
      expect(cachedRules.data.requiredFields).toContain('asin')
      expect(cachedRules.data.businessRules.kindleSpecificValidation).toBe(true)
    })

    test('invalidateCache() 應該支援選擇性快取失效', async () => {
      // Given: 多個快取項目
      const items = [
        { key: 'book_1_validation', type: 'validation' },
        { key: 'book_1_quality', type: 'quality' },
        { key: 'book_2_validation', type: 'validation' },
        { key: 'READMOO_rules', type: 'rules' }
      ]

      // 建立快取項目
      for (const item of items) {
        if (item.type === 'validation') {
          await validationCacheManager.cacheValidationResult(item.key, { isValid: true })
        } else if (item.type === 'quality') {
          await validationCacheManager.cacheQualityAnalysis(item.key, { overallScore: 80 })
        } else if (item.type === 'rules') {
          await validationCacheManager.cachePlatformRules('READMOO', { requiredFields: [] })
        }
      }

      // When: 選擇性失效驗證相關快取
      const invalidationResult = await validationCacheManager.invalidateCache({
        pattern: '*validation*',
        type: 'validation',
        olderThan: null
      })

      // Then: 應該只失效匹配的項目
      expect(invalidationResult).toHaveProperty('invalidated')
      expect(invalidationResult).toHaveProperty('remaining')
      expect(invalidationResult).toHaveProperty('patterns')
      expect(Array.isArray(invalidationResult.invalidated)).toBe(true)
      expect(invalidationResult.invalidated.length).toBeGreaterThan(0)
    })

    test('clearCache() 應該支援完整和部分清除', async () => {
      // Given: 包含多種類型的快取
      await validationCacheManager.cacheValidationResult('test_validation', { isValid: true })
      await validationCacheManager.cacheQualityAnalysis('test_quality', { overallScore: 75 })
      await validationCacheManager.cachePlatformRules('TEST_PLATFORM', { requiredFields: ['id'] })

      // When: 清除所有快取
      const clearResult = await validationCacheManager.clearCache({
        level: 'all', // memory, persistent, all
        preserveRules: false
      })

      // Then: 應該清除所有快取
      expect(clearResult).toHaveProperty('cleared', true)
      expect(clearResult).toHaveProperty('itemsCleared')
      expect(clearResult).toHaveProperty('memoryCleared')
      expect(clearResult).toHaveProperty('persistentCleared')
      expect(typeof clearResult.itemsCleared).toBe('number')

      // 驗證快取已清空
      const testValidation = await validationCacheManager.getCachedValidation('test_validation')
      expect(testValidation.found).toBe(false)
    })

    test('getStatistics() 應該提供詳細快取統計', async () => {
      // Given: 一些快取操作
      await validationCacheManager.cacheValidationResult('stats_test_1', { isValid: true })
      await validationCacheManager.cacheValidationResult('stats_test_2', { isValid: false })
      await validationCacheManager.getCachedValidation('stats_test_1') // cache hit
      await validationCacheManager.getCachedValidation('nonexistent') // cache miss

      // When: 獲取統計資訊
      const stats = validationCacheManager.getStatistics()

      // Then: 應該包含完整統計
      expect(stats).toHaveProperty('memoryCache')
      expect(stats).toHaveProperty('persistentCache')
      expect(stats).toHaveProperty('hitRate')
      expect(stats).toHaveProperty('missRate')
      expect(stats).toHaveProperty('totalOperations')
      expect(stats).toHaveProperty('cacheSize')
      expect(stats).toHaveProperty('memoryUsage')
      expect(stats).toHaveProperty('evictionCount')
      expect(stats).toHaveProperty('typeDistribution')

      expect(typeof stats.hitRate).toBe('number')
      expect(stats.hitRate).toBeGreaterThanOrEqual(0)
      expect(stats.hitRate).toBeLessThanOrEqual(1)
      expect(stats.memoryCache).toHaveProperty('size')
      expect(stats.memoryCache).toHaveProperty('maxSize')
    })

    test('optimizeCache() 應該執行快取優化', async () => {
      // Given: 包含過期和低優先級項目的快取
      const items = [
        { key: 'old_item', ttl: 1 }, // 很快過期
        { key: 'new_item', ttl: 600000 },
        { key: 'low_priority', priority: 'low' },
        { key: 'high_priority', priority: 'high' }
      ]

      for (const item of items) {
        await validationCacheManager.cacheValidationResult(
          item.key,
          { isValid: true },
          { ttl: item.ttl, priority: item.priority }
        )
      }

      // 等待過期
      await new Promise(resolve => setTimeout(resolve, 10))

      // When: 執行快取優化
      const optimizationResult = await validationCacheManager.optimizeCache({
        cleanupExpired: true,
        compactMemory: true,
        rebalancePriorities: true
      })

      // Then: 應該完成優化操作
      expect(optimizationResult).toHaveProperty('optimized', true)
      expect(optimizationResult).toHaveProperty('expiredRemoved')
      expect(optimizationResult).toHaveProperty('memoryCompacted')
      expect(optimizationResult).toHaveProperty('prioritiesRebalanced')
      expect(optimizationResult).toHaveProperty('sizeReduction')
      expect(typeof optimizationResult.expiredRemoved).toBe('number')
    })

    test('應該處理並行存取和競爭條件', async () => {
      // Given: 並行快取操作
      const cacheKey = 'concurrent_test'
      const operations = []

      // When: 同時執行多個快取操作
      for (let i = 0; i < 10; i++) {
        operations.push(
          validationCacheManager.cacheValidationResult(
            `${cacheKey}_${i}`,
            { isValid: i % 2 === 0, index: i }
          )
        )
      }

      const results = await Promise.all(operations)

      // Then: 所有操作都應該成功
      expect(results.length).toBe(10)
      results.forEach((result, index) => {
        expect(result.cached).toBe(true)
        expect(result.cacheKey).toBe(`${cacheKey}_${index}`)
      })

      // 驗證資料完整性
      for (let i = 0; i < 10; i++) {
        const cached = await validationCacheManager.getCachedValidation(`${cacheKey}_${i}`)
        expect(cached.found).toBe(true)
        expect(cached.data.index).toBe(i)
      }
    })

    test('應該支援快取層級策略', async () => {
      // Given: 不同層級的快取配置
      const testCases = [
        { key: 'memory_only', level: 'memory', persistToDisk: false },
        { key: 'persistent_only', level: 'persistent', persistToDisk: true },
        { key: 'both_levels', level: 'both', persistToDisk: true }
      ]

      // When: 使用不同策略快取
      for (const testCase of testCases) {
        await validationCacheManager.cacheValidationResult(
          testCase.key,
          { isValid: true, level: testCase.level },
          { persistToDisk: testCase.persistToDisk }
        )
      }

      // Then: 應該根據策略正確快取
      const stats = validationCacheManager.getStatistics()
      expect(stats.memoryCache.size).toBeGreaterThan(0)

      // 檢查各層級的快取
      for (const testCase of testCases) {
        const cached = await validationCacheManager.getCachedValidation(testCase.key)
        expect(cached.found).toBe(true)
        expect(cached.data.level).toBe(testCase.level)
      }
    })

    test('應該處理記憶體限制和驅逐策略', async () => {
      // Given: 接近記憶體限制的快取管理器
      const smallCacheManager = new (require('src/background/domains/data-management/services/ValidationCacheManager.js'))({
        maxMemoryCache: 3, // 很小的限制
        evictionStrategy: 'lru'
      })

      // When: 添加超過限制的項目
      const items = ['item1', 'item2', 'item3', 'item4', 'item5']
      for (const item of items) {
        await smallCacheManager.cacheValidationResult(
          item,
          { isValid: true, item },
          { evictionCallback: mockEvictionCallback }
        )
      }

      // Then: 應該觸發驅逐機制
      const stats = smallCacheManager.getStatistics()
      expect(stats.memoryCache.size).toBeLessThanOrEqual(3)
      expect(stats.evictionCount).toBeGreaterThan(0)

      // 最新的項目應該仍在快取中
      const latestItem = await smallCacheManager.getCachedValidation('item5')
      expect(latestItem.found).toBe(true)
    })

    test('應該支援批次操作', async () => {
      // Given: 批次快取操作
      const batchItems = [
        { key: 'batch_1', data: { isValid: true, batch: 1 } },
        { key: 'batch_2', data: { isValid: false, batch: 2 } },
        { key: 'batch_3', data: { isValid: true, batch: 3 } }
      ]

      // When: 執行批次快取
      const batchCacheResult = await validationCacheManager.cacheValidationBatch(
        batchItems,
        { ttl: 300000, atomic: true }
      )

      // Then: 應該成功快取所有項目
      expect(batchCacheResult).toHaveProperty('cached', true)
      expect(batchCacheResult).toHaveProperty('totalItems', 3)
      expect(batchCacheResult).toHaveProperty('successfulItems', 3)
      expect(batchCacheResult).toHaveProperty('failedItems', 0)

      // When: 執行批次檢索
      const batchKeys = batchItems.map(item => item.key)
      const batchGetResult = await validationCacheManager.getCachedValidationBatch(batchKeys)

      // Then: 應該檢索所有項目
      expect(batchGetResult).toHaveProperty('results')
      expect(Array.isArray(batchGetResult.results)).toBe(true)
      expect(batchGetResult.results.length).toBe(3)
      batchGetResult.results.forEach((result, index) => {
        expect(result.found).toBe(true)
        expect(result.data.batch).toBe(index + 1)
      })
    })
  })
})
