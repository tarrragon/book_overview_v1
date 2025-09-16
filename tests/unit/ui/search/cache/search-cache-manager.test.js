/**
 * SearchCacheManager 單元測試 - TDD 循環 3/8
 * BookSearchFilter 職責拆分重構
 *
 * 負責功能：
 * - 搜尋結果快取管理
 * - LRU (Least Recently Used) 快取策略
 * - 快取大小限制和清理
 * - 快取命中率統計
 * - 快取失效機制
 *
 * 測試涵蓋範圍：
 * - 快取管理器初始化和配置
 * - 快取儲存和取得邏輯
 * - LRU 快取策略實作
 * - 快取大小限制和清理機制
 * - 快取統計和效能監控
 * - 快取失效和清空
 * - 錯誤處理和邊界條件
 * - 事件系統整合
 *
 * @version 1.0.0
 * @since 2025-08-20
 */

// 測試環境設定
require('../../../../test-setup')

describe('SearchCacheManager - TDD 循環 3/8', () => {
  let cacheManager
  let mockEventBus
  let mockLogger

  // 測試用搜尋結果資料
  const mockSearchResults = {
    javascript: [
      { id: 'book-001', title: 'JavaScript 權威指南', author: 'David Flanagan' },
      { id: 'book-004', title: 'React 開發實戰', author: 'Alex Banks' }
    ],
    python: [
      { id: 'book-002', title: 'Python 機器學習', author: 'Sebastian Raschka' }
    ],
    learning: [
      { id: 'book-002', title: 'Python 機器學習', author: 'Sebastian Raschka' },
      { id: 'book-003', title: 'Deep Learning 深度學習', author: 'Ian Goodfellow' }
    ]
  }

  beforeEach(() => {
    // 建立 Mock EventBus
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    }

    // 建立 Mock Logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }

    // 重置 Jest mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    if (cacheManager) {
      cacheManager.destroy?.()
      cacheManager = null
    }
  })

  describe('1. Construction & Initialization', () => {
    test('應該正確建構 SearchCacheManager 實例', () => {
      const SearchCacheManager = require('src/ui/search/cache/search-cache-manager')

      cacheManager = new SearchCacheManager({
        eventBus: mockEventBus,
        logger: mockLogger
      })

      expect(cacheManager).toBeInstanceOf(SearchCacheManager)
      expect(cacheManager.eventBus).toBe(mockEventBus)
      expect(cacheManager.logger).toBe(mockLogger)
    })

    test('建構時若缺少必要參數應該拋出錯誤', () => {
      const SearchCacheManager = require('src/ui/search/cache/search-cache-manager')

      expect(() => {
        new SearchCacheManager() // eslint-disable-line no-new
      }).toMatchObject({
        message: expect.stringContaining('EventBus 和 Logger 是必需的')
      })

      expect(() => {
        new SearchCacheManager({ eventBus: mockEventBus }) // eslint-disable-line no-new
      }).toMatchObject({
        message: expect.stringContaining('EventBus 和 Logger 是必需的')
      })

      expect(() => {
        new SearchCacheManager({ logger: mockLogger }) // eslint-disable-line no-new
      }).toMatchObject({
        message: expect.stringContaining('EventBus 和 Logger 是必需的')
      })
    })

    test('應該正確初始化快取配置', () => {
      const SearchCacheManager = require('src/ui/search/cache/search-cache-manager')

      cacheManager = new SearchCacheManager({
        eventBus: mockEventBus,
        logger: mockLogger
      })

      expect(cacheManager.config).toEqual({
        maxCacheSize: 100,
        cleanupThreshold: 0.7,
        enableStatistics: true,
        enableEvents: true,
        keyNormalization: true
      })
    })

    test('應該正確初始化快取統計', () => {
      const SearchCacheManager = require('src/ui/search/cache/search-cache-manager')

      cacheManager = new SearchCacheManager({
        eventBus: mockEventBus,
        logger: mockLogger
      })

      const stats = cacheManager.getStatistics()
      expect(stats).toEqual({
        totalHits: 0,
        totalMisses: 0,
        totalSets: 0,
        totalClears: 0,
        hitRate: 0,
        currentSize: 0,
        maxSize: 100
      })
    })

    test('應該支援自定義配置', () => {
      const SearchCacheManager = require('src/ui/search/cache/search-cache-manager')

      const customConfig = {
        maxCacheSize: 50,
        cleanupThreshold: 0.8,
        enableStatistics: false
      }

      cacheManager = new SearchCacheManager({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: customConfig
      })

      expect(cacheManager.config.maxCacheSize).toBe(50)
      expect(cacheManager.config.cleanupThreshold).toBe(0.8)
      expect(cacheManager.config.enableStatistics).toBe(false)
      // 其他配置應該使用預設值
      expect(cacheManager.config.enableEvents).toBe(true)
    })
  })

  describe('2. Basic Cache Operations', () => {
    beforeEach(() => {
      const SearchCacheManager = require('src/ui/search/cache/search-cache-manager')
      cacheManager = new SearchCacheManager({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該能夠快取搜尋結果', () => {
      const query = 'javascript'
      const results = mockSearchResults.javascript

      cacheManager.set(query, results)

      expect(cacheManager.has(query)).toBe(true)
      expect(cacheManager.get(query)).toEqual(results)
    })

    test('應該正確處理快取命中', () => {
      const query = 'python'
      const results = mockSearchResults.python

      // 設定快取
      cacheManager.set(query, results)

      // 測試快取命中
      const cachedResults = cacheManager.get(query)
      expect(cachedResults).toEqual(results)

      // 檢查統計
      const stats = cacheManager.getStatistics()
      expect(stats.totalHits).toBe(1)
      expect(stats.totalMisses).toBe(0)
      expect(stats.totalSets).toBe(1)
    })

    test('應該正確處理快取未命中', () => {
      const query = 'nonexistent'

      const result = cacheManager.get(query)
      expect(result).toBeNull()

      // 檢查統計
      const stats = cacheManager.getStatistics()
      expect(stats.totalHits).toBe(0)
      expect(stats.totalMisses).toBe(1)
      expect(stats.totalSets).toBe(0)
    })

    test('應該正確檢查快取是否存在', () => {
      const query = 'learning'
      const results = mockSearchResults.learning

      expect(cacheManager.has(query)).toBe(false)

      cacheManager.set(query, results)
      expect(cacheManager.has(query)).toBe(true)
    })

    test('應該能夠刪除特定快取項目', () => {
      const query = 'javascript'
      const results = mockSearchResults.javascript

      cacheManager.set(query, results)
      expect(cacheManager.has(query)).toBe(true)

      const deleted = cacheManager.delete(query)
      expect(deleted).toBe(true)
      expect(cacheManager.has(query)).toBe(false)
    })

    test('刪除不存在的快取項目應該返回 false', () => {
      const deleted = cacheManager.delete('nonexistent')
      expect(deleted).toBe(false)
    })
  })

  describe('3. LRU Cache Strategy', () => {
    beforeEach(() => {
      const SearchCacheManager = require('src/ui/search/cache/search-cache-manager')
      cacheManager = new SearchCacheManager({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: { maxCacheSize: 3 } // 小的快取大小便於測試
      })
    })

    test('應該按照 LRU 順序維護快取', () => {
      // 填充快取
      cacheManager.set('query1', ['result1'])
      cacheManager.set('query2', ['result2'])
      cacheManager.set('query3', ['result3'])

      // 檢查所有項目都存在
      expect(cacheManager.has('query1')).toBe(true)
      expect(cacheManager.has('query2')).toBe(true)
      expect(cacheManager.has('query3')).toBe(true)

      // 添加第四個項目，應該移除最舊的
      cacheManager.set('query4', ['result4'])

      expect(cacheManager.has('query1')).toBe(false) // 最舊的應該被移除
      expect(cacheManager.has('query2')).toBe(true)
      expect(cacheManager.has('query3')).toBe(true)
      expect(cacheManager.has('query4')).toBe(true)
    })

    test('存取快取項目應該更新其 LRU 位置', () => {
      // 填充快取
      cacheManager.set('query1', ['result1'])
      cacheManager.set('query2', ['result2'])
      cacheManager.set('query3', ['result3'])

      // 存取 query1，使其變為最新
      cacheManager.get('query1')

      // 添加新項目，應該移除 query2（現在是最舊的）
      cacheManager.set('query4', ['result4'])

      expect(cacheManager.has('query1')).toBe(true) // 因為被存取過
      expect(cacheManager.has('query2')).toBe(false) // 現在是最舊的
      expect(cacheManager.has('query3')).toBe(true)
      expect(cacheManager.has('query4')).toBe(true)
    })

    test('更新現有快取項目應該更新其 LRU 位置', () => {
      // 填充快取
      cacheManager.set('query1', ['result1'])
      cacheManager.set('query2', ['result2'])
      cacheManager.set('query3', ['result3'])

      // 更新 query1，使其變為最新
      cacheManager.set('query1', ['updated_result1'])

      // 添加新項目，應該移除 query2
      cacheManager.set('query4', ['result4'])

      expect(cacheManager.has('query1')).toBe(true)
      expect(cacheManager.has('query2')).toBe(false)
      expect(cacheManager.has('query3')).toBe(true)
      expect(cacheManager.has('query4')).toBe(true)
      expect(cacheManager.get('query1')).toEqual(['updated_result1'])
    })
  })

  describe('4. Cache Size Management', () => {
    beforeEach(() => {
      const SearchCacheManager = require('src/ui/search/cache/search-cache-manager')
      cacheManager = new SearchCacheManager({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: { maxCacheSize: 5, cleanupThreshold: 0.6 }
      })
    })

    test('應該正確報告快取大小', () => {
      expect(cacheManager.size()).toBe(0)

      cacheManager.set('query1', ['result1'])
      expect(cacheManager.size()).toBe(1)

      cacheManager.set('query2', ['result2'])
      expect(cacheManager.size()).toBe(2)

      cacheManager.delete('query1')
      expect(cacheManager.size()).toBe(1)
    })

    test('超過大小限制時應該觸發清理', () => {
      // 填充到最大大小
      for (let i = 1; i <= 5; i++) {
        cacheManager.set(`query${i}`, [`result${i}`])
      }

      expect(cacheManager.size()).toBe(5)

      // 添加第六個項目應該觸發清理
      cacheManager.set('query6', ['result6'])

      // 根據 cleanupThreshold: 0.6，應該保留 5 * 0.6 = 3 個項目
      expect(cacheManager.size()).toBeLessThanOrEqual(3)
    })

    test('手動清理應該根據閾值移除項目', () => {
      // 填充快取
      for (let i = 1; i <= 5; i++) {
        cacheManager.set(`query${i}`, [`result${i}`])
      }

      cacheManager.cleanup()

      // 應該保留 cleanupThreshold * maxSize = 0.6 * 5 = 3 個項目
      expect(cacheManager.size()).toBe(3)

      // 應該保留最新的項目
      expect(cacheManager.has('query3')).toBe(true)
      expect(cacheManager.has('query4')).toBe(true)
      expect(cacheManager.has('query5')).toBe(true)
    })

    test('清空快取應該移除所有項目', () => {
      // 填充快取
      for (let i = 1; i <= 3; i++) {
        cacheManager.set(`query${i}`, [`result${i}`])
      }

      expect(cacheManager.size()).toBe(3)

      cacheManager.clear()

      expect(cacheManager.size()).toBe(0)
      expect(cacheManager.has('query1')).toBe(false)
      expect(cacheManager.has('query2')).toBe(false)
      expect(cacheManager.has('query3')).toBe(false)
    })
  })

  describe('5. Statistics & Performance Monitoring', () => {
    beforeEach(() => {
      const SearchCacheManager = require('src/ui/search/cache/search-cache-manager')
      cacheManager = new SearchCacheManager({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該正確追蹤快取統計', () => {
      // 執行各種操作
      cacheManager.set('query1', ['result1'])
      cacheManager.set('query2', ['result2'])
      cacheManager.get('query1') // 命中
      cacheManager.get('query3') // 未命中
      cacheManager.clear()

      const stats = cacheManager.getStatistics()
      expect(stats.totalHits).toBe(1)
      expect(stats.totalMisses).toBe(1)
      expect(stats.totalSets).toBe(2)
      expect(stats.totalClears).toBe(1)
      expect(stats.hitRate).toBe(0.5) // 1 命中 / 2 總存取
      expect(stats.currentSize).toBe(0)
    })

    test('應該正確計算命中率', () => {
      cacheManager.set('query1', ['result1'])

      // 2 次命中，1 次未命中
      cacheManager.get('query1')
      cacheManager.get('query1')
      cacheManager.get('query2')

      const stats = cacheManager.getStatistics()
      expect(stats.hitRate).toBeCloseTo(2 / 3, 2) // 約 0.67
    })

    test('沒有存取時命中率應該為 0', () => {
      const stats = cacheManager.getStatistics()
      expect(stats.hitRate).toBe(0)
    })

    test('應該能夠重置統計', () => {
      // 執行一些操作
      cacheManager.set('query1', ['result1'])
      cacheManager.get('query1')
      cacheManager.get('query2')

      let stats = cacheManager.getStatistics()
      expect(stats.totalHits).toBe(1)
      expect(stats.totalMisses).toBe(1)

      cacheManager.resetStatistics()

      stats = cacheManager.getStatistics()
      expect(stats.totalHits).toBe(0)
      expect(stats.totalMisses).toBe(0)
      expect(stats.totalSets).toBe(0)
      expect(stats.totalClears).toBe(0)
      expect(stats.hitRate).toBe(0)
    })
  })

  describe('6. Key Normalization', () => {
    beforeEach(() => {
      const SearchCacheManager = require('src/ui/search/cache/search-cache-manager')
      cacheManager = new SearchCacheManager({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該正確正規化快取鍵', () => {
      const testCases = [
        { input: '  JavaScript  ', normalized: 'javascript' },
        { input: 'PYTHON', normalized: 'python' },
        { input: 'React 開發', normalized: 'react 開發' },
        { input: '  Deep   Learning  ', normalized: 'deep learning' }
      ]

      testCases.forEach(({ input, normalized }) => {
        const result = cacheManager.normalizeKey(input)
        expect(result).toBe(normalized)
      })
    })

    test('正規化的鍵應該能夠找到快取項目', () => {
      const results = ['result1']

      // 使用原始鍵設定
      cacheManager.set('  JavaScript  ', results)

      // 使用不同格式的鍵應該能找到相同項目
      expect(cacheManager.get('javascript')).toEqual(results)
      expect(cacheManager.get('JAVASCRIPT')).toEqual(results)
      expect(cacheManager.get('  JavaScript  ')).toEqual(results)
      expect(cacheManager.has('Javascript')).toBe(true)
    })

    test('應該能夠禁用鍵正規化', () => {
      const cacheManagerNoNorm = new (require('src/ui/search/cache/search-cache-manager'))({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: { keyNormalization: false }
      })

      const results = ['result1']
      cacheManagerNoNorm.set('JavaScript', results)

      expect(cacheManagerNoNorm.get('JavaScript')).toEqual(results)
      expect(cacheManagerNoNorm.get('javascript')).toBeNull()
      expect(cacheManagerNoNorm.has('JAVASCRIPT')).toBe(false)

      cacheManagerNoNorm.destroy?.()
    })
  })

  describe('7. Error Handling & Edge Cases', () => {
    beforeEach(() => {
      const SearchCacheManager = require('src/ui/search/cache/search-cache-manager')
      cacheManager = new SearchCacheManager({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該正確處理 null 或 undefined 鍵', () => {
      expect(() => {
        cacheManager.set(null, ['result'])
      }).toMatchObject({
        message: expect.stringContaining('快取鍵必須是字串')
      })

      expect(() => {
        cacheManager.set(undefined, ['result'])
      }).toMatchObject({
        message: expect.stringContaining('快取鍵必須是字串')
      })

      expect(() => {
        cacheManager.get(null)
      }).toMatchObject({
        message: expect.stringContaining('快取鍵必須是字串')
      })
    })

    test('應該正確處理非字串鍵', () => {
      expect(() => {
        cacheManager.set(123, ['result'])
      }).toMatchObject({
        message: expect.stringContaining('快取鍵必須是字串')
      })

      expect(() => {
        cacheManager.set(['array'], ['result'])
      }).toMatchObject({
        message: expect.stringContaining('快取鍵必須是字串')
      })

      expect(() => {
        cacheManager.get(true)
      }).toMatchObject({
        message: expect.stringContaining('快取鍵必須是字串')
      })
    })

    test('應該正確處理空字串鍵', () => {
      const results = ['empty_result']

      expect(() => {
        cacheManager.set('', results)
      }).not.toThrow()

      expect(cacheManager.get('')).toEqual(results)
      expect(cacheManager.has('')).toBe(true)
    })

    test('應該正確處理 null 或 undefined 值', () => {
      cacheManager.set('null_value', null)
      cacheManager.set('undefined_value', undefined)

      expect(cacheManager.get('null_value')).toBeNull()
      expect(cacheManager.get('undefined_value')).toBeUndefined()
      expect(cacheManager.has('null_value')).toBe(true)
      expect(cacheManager.has('undefined_value')).toBe(true)
    })

    test('應該正確處理極長的鍵', () => {
      const longKey = 'a'.repeat(1000)
      const results = ['long_key_result']

      expect(() => {
        cacheManager.set(longKey, results)
      }).not.toThrow()

      expect(cacheManager.get(longKey)).toEqual(results)
    })

    test('應該正確處理特殊字元鍵', () => {
      const specialKeys = ['@#$%', '!!', '???', '...', '---', '🚀', 'émoji']

      specialKeys.forEach((key, index) => {
        const results = [`result_${index}`]
        expect(() => {
          cacheManager.set(key, results)
        }).not.toThrow()

        expect(cacheManager.get(key)).toEqual(results)
      })
    })

    test('大量快取操作應該不會造成記憶體洩漏', () => {
      // 執行大量快取操作
      for (let i = 0; i < 1000; i++) {
        cacheManager.set(`query_${i}`, [`result_${i}`])
      }

      // 快取大小應該被限制
      expect(cacheManager.size()).toBeLessThanOrEqual(cacheManager.config.maxCacheSize)

      // 統計應該正確
      const stats = cacheManager.getStatistics()
      expect(stats.totalSets).toBe(1000)
      expect(stats.currentSize).toBe(cacheManager.size())
    })
  })

  describe('8. Event System Integration', () => {
    beforeEach(() => {
      const SearchCacheManager = require('src/ui/search/cache/search-cache-manager')
      cacheManager = new SearchCacheManager({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('快取命中時應該發送事件', () => {
      const query = 'javascript'
      const results = mockSearchResults.javascript

      cacheManager.set(query, results)
      cacheManager.get(query)

      expect(mockEventBus.emit).toHaveBeenCalledWith('CACHE.HIT', expect.objectContaining({
        key: query,
        size: results.length,
        timestamp: expect.any(Number)
      }))
    })

    test('快取未命中時應該發送事件', () => {
      const query = 'nonexistent'

      cacheManager.get(query)

      expect(mockEventBus.emit).toHaveBeenCalledWith('CACHE.MISS', expect.objectContaining({
        key: query,
        timestamp: expect.any(Number)
      }))
    })

    test('快取設定時應該發送事件', () => {
      const query = 'python'
      const results = mockSearchResults.python

      cacheManager.set(query, results)

      expect(mockEventBus.emit).toHaveBeenCalledWith('CACHE.SET', expect.objectContaining({
        key: query,
        size: results.length,
        cacheSize: 1,
        timestamp: expect.any(Number)
      }))
    })

    test('快取清理時應該發送事件', () => {
      // 填充快取到觸發清理
      const config = { maxCacheSize: 2, cleanupThreshold: 0.5 }
      const customCacheManager = new (require('src/ui/search/cache/search-cache-manager'))({
        eventBus: mockEventBus,
        logger: mockLogger,
        config
      })

      customCacheManager.set('query1', ['result1'])
      customCacheManager.set('query2', ['result2'])

      // 清除之前的事件
      mockEventBus.emit.mockClear()

      customCacheManager.set('query3', ['result3']) // 應該觸發清理

      expect(mockEventBus.emit).toHaveBeenCalledWith('CACHE.CLEANUP', expect.objectContaining({
        removedCount: expect.any(Number),
        remainingSize: expect.any(Number),
        timestamp: expect.any(Number)
      }))

      customCacheManager.destroy?.()
    })

    test('快取清空時應該發送事件', () => {
      cacheManager.set('query1', ['result1'])
      cacheManager.set('query2', ['result2'])

      // 清除之前的事件
      mockEventBus.emit.mockClear()

      cacheManager.clear()

      expect(mockEventBus.emit).toHaveBeenCalledWith('CACHE.CLEAR', expect.objectContaining({
        clearedCount: 2,
        timestamp: expect.any(Number)
      }))
    })

    test('應該能夠禁用事件發送', () => {
      const cacheManagerNoEvents = new (require('src/ui/search/cache/search-cache-manager'))({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: { enableEvents: false }
      })

      cacheManagerNoEvents.set('query1', ['result1'])
      cacheManagerNoEvents.get('query1')
      cacheManagerNoEvents.get('nonexistent')

      // 不應該發送任何事件
      expect(mockEventBus.emit).not.toHaveBeenCalled()

      cacheManagerNoEvents.destroy?.()
    })
  })
})
