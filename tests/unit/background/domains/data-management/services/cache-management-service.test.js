/**
 * CacheManagementService 測試
 * TDD 重構循環 5/8: 快取管理邏輯提取
 *
 * 目標：將快取管理邏輯從 DataValidationService 中提取
 */

const CacheManagementService = require('src/background/domains/data-management/services/cache-management-service.js')

describe('CacheManagementService - 快取管理服務', () => {
  let cacheService
  let mockEventBus
  let mockLogger

  beforeEach(() => {
    mockEventBus = {
      on: jest.fn(),
      emit: jest.fn(),
      off: jest.fn()
    }

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    }

    cacheService = new CacheManagementService(mockEventBus, {
      logger: mockLogger,
      config: {
        enableCache: true,
        cacheSize: 10,
        cacheTTL: 5000, // 5秒
        cacheTypes: ['validation', 'normalization', 'quality']
      }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
    cacheService.clearAllCaches()
  })

  describe('🏗️ 服務初始化', () => {
    test('應該正確初始化快取管理服務', () => {
      expect(cacheService).toBeInstanceOf(CacheManagementService)
      expect(cacheService.eventBus).toBe(mockEventBus)
      expect(cacheService.logger).toBe(mockLogger)
    })

    test('應該初始化快取配置', () => {
      expect(cacheService.config.enableCache).toBe(true)
      expect(cacheService.config.cacheSize).toBe(10)
      expect(cacheService.config.cacheTTL).toBe(5000)
    })

    test('應該初始化快取容器', () => {
      expect(cacheService.caches).toBeDefined()
      expect(cacheService.cacheTimestamps).toBeDefined()
      expect(cacheService.cacheStats).toBeDefined()
    })

    test('應該支援停用快取功能', () => {
      const disabledCacheService = new CacheManagementService(mockEventBus, {
        logger: mockLogger,
        config: { enableCache: false }
      })

      expect(disabledCacheService.config.enableCache).toBe(false)
    })
  })

  describe('🔑 快取鍵管理', () => {
    test('generateCacheKey() 應該生成唯一的快取鍵', () => {
      const book1 = { id: 'book1', title: '書籍1' }
      const book2 = { id: 'book2', title: '書籍2' }

      const key1 = cacheService.generateCacheKey(book1, 'READMOO')
      const key2 = cacheService.generateCacheKey(book2, 'READMOO')
      const key3 = cacheService.generateCacheKey(book1, 'KINDLE')

      expect(key1).not.toBe(key2)
      expect(key1).not.toBe(key3)
      expect(key2).not.toBe(key3)
    })

    test('generateCacheKey() 應該對相同資料產生相同鍵', () => {
      const book = { id: 'book1', title: '書籍1' }

      const key1 = cacheService.generateCacheKey(book, 'READMOO')
      const key2 = cacheService.generateCacheKey(book, 'READMOO')

      expect(key1).toBe(key2)
    })

    test('generateCacheKey() 應該處理不同資料格式', () => {
      const bookWithId = { id: 'book1', title: '書籍1' }
      const bookWithASIN = { ASIN: 'B001ABCDEF', title: 'Kindle Book' }
      const bookWithKoboId = { kobo_id: 'kobo123', title: 'Kobo Book' }

      const key1 = cacheService.generateCacheKey(bookWithId, 'READMOO')
      const key2 = cacheService.generateCacheKey(bookWithASIN, 'KINDLE')
      const key3 = cacheService.generateCacheKey(bookWithKoboId, 'KOBO')

      expect(key1).toContain('book1')
      expect(key2).toContain('B001ABCDEF')
      expect(key3).toContain('kobo123')
    })
  })

  describe('💾 基本快取操作', () => {
    test('setCacheValue() 應該儲存快取值', () => {
      const cacheKey = 'test_key'
      const cacheValue = { result: '測試資料', score: 85 }

      const result = cacheService.setCacheValue(cacheKey, cacheValue, 'validation')

      expect(result).toBe(true)
      expect(cacheService.cacheStats.validation.totalSets).toBe(1)
    })

    test('getCacheValue() 應該取得快取值', () => {
      const cacheKey = 'test_key'
      const cacheValue = { result: '測試資料', score: 85 }

      cacheService.setCacheValue(cacheKey, cacheValue, 'validation')
      const retrieved = cacheService.getCacheValue(cacheKey, 'validation')

      expect(retrieved).toEqual(cacheValue)
      expect(retrieved).not.toBe(cacheValue) // 應該是深拷貝
      expect(cacheService.cacheStats.validation.totalHits).toBe(1)
    })

    test('getCacheValue() 應該處理快取未命中', () => {
      const result = cacheService.getCacheValue('non_existent_key', 'validation')

      expect(result).toBeNull()
      expect(cacheService.cacheStats.validation.totalMisses).toBe(1)
    })

    test('hasCacheValue() 應該檢查快取是否存在', () => {
      const cacheKey = 'test_key'
      const cacheValue = { result: '測試資料' }

      expect(cacheService.hasCacheValue(cacheKey, 'validation')).toBe(false)

      cacheService.setCacheValue(cacheKey, cacheValue, 'validation')

      expect(cacheService.hasCacheValue(cacheKey, 'validation')).toBe(true)
    })
  })

  describe('⏰ TTL (Time To Live) 管理', () => {
    test('應該在 TTL 過期後自動清除快取', async () => {
      // 使用短 TTL 進行測試
      cacheService.config.cacheTTL = 100 // 100ms

      const cacheKey = 'ttl_test_key'
      const cacheValue = { result: '測試資料' }

      cacheService.setCacheValue(cacheKey, cacheValue, 'validation')
      expect(cacheService.getCacheValue(cacheKey, 'validation')).toEqual(cacheValue)

      // 等待 TTL 過期
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(cacheService.getCacheValue(cacheKey, 'validation')).toBeNull()
    })

    test('updateCacheTTL() 應該更新快取生命週期', () => {
      cacheService.updateCacheTTL(10000)
      expect(cacheService.config.cacheTTL).toBe(10000)
    })

    test('refreshCacheEntry() 應該刷新快取項目時間戳', async () => {
      const cacheKey = 'refresh_test'
      const cacheValue = { result: '測試資料' }

      cacheService.setCacheValue(cacheKey, cacheValue, 'validation')
      const originalTimestamp = cacheService.cacheTimestamps.get('validation').get(cacheKey)

      // 等待一小段時間
      await new Promise(resolve => setTimeout(resolve, 10))

      cacheService.refreshCacheEntry(cacheKey, 'validation')
      const newTimestamp = cacheService.cacheTimestamps.get('validation').get(cacheKey)

      expect(newTimestamp).toBeGreaterThan(originalTimestamp)
    })
  })

  describe('📊 快取大小限制', () => {
    test('應該在達到大小限制時移除最舊項目', () => {
      // 設置小的快取大小
      cacheService.config.cacheSize = 3

      // 添加超過限制的項目
      for (let i = 1; i <= 5; i++) {
        cacheService.setCacheValue(`key${i}`, { value: i }, 'validation')
      }

      // 應該只保留最新的3個項目
      expect(cacheService.getCacheValue('key1', 'validation')).toBeNull()
      expect(cacheService.getCacheValue('key2', 'validation')).toBeNull()
      expect(cacheService.getCacheValue('key3', 'validation')).toEqual({ value: 3 })
      expect(cacheService.getCacheValue('key4', 'validation')).toEqual({ value: 4 })
      expect(cacheService.getCacheValue('key5', 'validation')).toEqual({ value: 5 })
    })

    test('updateCacheSize() 應該更新快取大小限制', () => {
      cacheService.updateCacheSize(20)
      expect(cacheService.config.cacheSize).toBe(20)
    })
  })

  describe('🧹 快取清理功能', () => {
    beforeEach(() => {
      // 設置一些測試快取
      cacheService.setCacheValue('validation_key', { result: 'validation' }, 'validation')
      cacheService.setCacheValue('normalization_key', { result: 'normalization' }, 'normalization')
      cacheService.setCacheValue('quality_key', { result: 'quality' }, 'quality')
    })

    test('clearCache() 應該清除指定類型的快取', () => {
      cacheService.clearCache('validation')

      expect(cacheService.getCacheValue('validation_key', 'validation')).toBeNull()
      expect(cacheService.getCacheValue('normalization_key', 'normalization')).toEqual({ result: 'normalization' })
    })

    test('clearAllCaches() 應該清除所有快取', () => {
      cacheService.clearAllCaches()

      expect(cacheService.getCacheValue('validation_key', 'validation')).toBeNull()
      expect(cacheService.getCacheValue('normalization_key', 'normalization')).toBeNull()
      expect(cacheService.getCacheValue('quality_key', 'quality')).toBeNull()
    })

    test('clearExpiredEntries() 應該只清除過期項目', async () => {
      // 使用短 TTL
      cacheService.config.cacheTTL = 100

      cacheService.setCacheValue('expired_key', { result: 'expired' }, 'validation')

      // 等待過期
      await new Promise(resolve => setTimeout(resolve, 150))

      cacheService.setCacheValue('fresh_key', { result: 'fresh' }, 'validation')

      cacheService.clearExpiredEntries('validation')

      expect(cacheService.getCacheValue('expired_key', 'validation')).toBeNull()
      expect(cacheService.getCacheValue('fresh_key', 'validation')).toEqual({ result: 'fresh' })
    })
  })

  describe('📊 快取統計', () => {
    test('getCacheStatistics() 應該提供詳細統計資訊', () => {
      // 生成一些統計資料
      cacheService.setCacheValue('key1', { value: 1 }, 'validation')
      cacheService.setCacheValue('key2', { value: 2 }, 'validation')
      cacheService.getCacheValue('key1', 'validation') // hit
      cacheService.getCacheValue('key3', 'validation') // miss

      const stats = cacheService.getCacheStatistics()

      expect(stats.validation.totalSets).toBe(2)
      expect(stats.validation.totalHits).toBe(1)
      expect(stats.validation.totalMisses).toBe(1)
      expect(stats.validation.hitRate).toBe(50) // 1 hit / 2 total requests
      expect(stats.validation.currentSize).toBe(2)
    })

    test('getCacheStatistics() 應該處理空快取', () => {
      const stats = cacheService.getCacheStatistics()

      expect(stats.validation.totalSets).toBe(0)
      expect(stats.validation.hitRate).toBe(0)
      expect(stats.validation.currentSize).toBe(0)
    })

    test('resetStatistics() 應該重置統計數據', () => {
      cacheService.setCacheValue('key1', { value: 1 }, 'validation')
      cacheService.getCacheValue('key1', 'validation')

      cacheService.resetStatistics()

      const stats = cacheService.getCacheStatistics()
      expect(stats.validation.totalSets).toBe(0)
      expect(stats.validation.totalHits).toBe(0)
    })
  })

  describe('🔄 批次快取操作', () => {
    test('setCacheValueBatch() 應該批次設置快取', () => {
      const batchData = [
        { key: 'batch1', value: { result: 'data1' }, type: 'validation' },
        { key: 'batch2', value: { result: 'data2' }, type: 'validation' },
        { key: 'batch3', value: { result: 'data3' }, type: 'normalization' }
      ]

      const results = cacheService.setCacheValueBatch(batchData)

      expect(results.successCount).toBe(3)
      expect(results.failureCount).toBe(0)
      expect(cacheService.getCacheValue('batch1', 'validation')).toEqual({ result: 'data1' })
      expect(cacheService.getCacheValue('batch3', 'normalization')).toEqual({ result: 'data3' })
    })

    test('getCacheValueBatch() 應該批次取得快取', () => {
      // 先設置一些快取
      cacheService.setCacheValue('batch1', { result: 'data1' }, 'validation')
      cacheService.setCacheValue('batch2', { result: 'data2' }, 'validation')

      const keys = ['batch1', 'batch2', 'batch3']
      const results = cacheService.getCacheValueBatch(keys, 'validation')

      expect(results.batch1).toEqual({ result: 'data1' })
      expect(results.batch2).toEqual({ result: 'data2' })
      expect(results.batch3).toBeNull()
    })
  })

  describe('🔧 快取配置管理', () => {
    test('updateCacheConfig() 應該更新快取配置', () => {
      const newConfig = {
        cacheSize: 50,
        cacheTTL: 10000,
        enableCache: false
      }

      cacheService.updateCacheConfig(newConfig)

      expect(cacheService.config.cacheSize).toBe(50)
      expect(cacheService.config.cacheTTL).toBe(10000)
      expect(cacheService.config.enableCache).toBe(false)
    })

    test('getCacheConfig() 應該返回當前配置', () => {
      const config = cacheService.getCacheConfig()

      expect(config.cacheSize).toBe(10)
      expect(config.cacheTTL).toBe(5000)
      expect(config.enableCache).toBe(true)
    })
  })

  describe('🏥 服務健康狀態', () => {
    test('isCacheServiceHealthy() 應該檢查服務健康狀態', () => {
      const health = cacheService.isCacheServiceHealthy()

      expect(health.isHealthy).toBe(true)
      expect(health.cacheEnabled).toBe(true)
      expect(health.memoryUsage).toBeDefined()
      expect(health.lastCheck).toBeDefined()
    })

    test('健康檢查應該檢測記憶體使用過高', () => {
      // 填充大量快取以測試記憶體使用
      for (let i = 0; i < 100; i++) {
        cacheService.setCacheValue(`stress_key_${i}`, {
          data: 'x'.repeat(1000),
          index: i
        }, 'validation')
      }

      const health = cacheService.isCacheServiceHealthy()
      expect(health.memoryUsage).toBeDefined()
    })
  })

  describe('⚠️ 錯誤處理', () => {
    test('constructor 應該要求 eventBus 參數', () => {
      expect(() => {
        new CacheManagementService()
      }).toMatchObject({
        message: expect.stringContaining('EventBus is required')
      })
    })

    test('應該處理快取停用情況', () => {
      const disabledService = new CacheManagementService(mockEventBus, {
        config: { enableCache: false }
      })

      expect(disabledService.setCacheValue('key', 'value', 'validation')).toBe(false)
      expect(disabledService.getCacheValue('key', 'validation')).toBeNull()
    })

    test('應該處理無效的快取類型', () => {
      const result1 = cacheService.setCacheValue('key', 'value', 'invalid_type')
      const result2 = cacheService.getCacheValue('key', 'invalid_type')

      expect(result1).toBe(false)
      expect(result2).toBeNull()
    })

    test('應該處理快取操作過程中的錯誤', () => {
      // 模擬序列化錯誤
      const circularObject = {}
      circularObject.self = circularObject

      const result = cacheService.setCacheValue('circular', circularObject, 'validation')
      expect(result).toBe(false)
    })
  })
})
