const { ErrorCodes } = require('src/core/errors/ErrorCodes')
/**
 * LocalStorageAdapter 單元測試
 *
 * 負責功能：
 * - localStorage API 整合和封裝
 * - 儲存操作 (save, load, delete, clear)
 * - 資料序列化和反序列化
 * - 錯誤處理和容錯機制
 * - 容量限制檢測和管理
 * - 效能監控和統計追蹤
 *
 * 設計考量：
 * - 作為 Chrome Storage 的備援方案
 * - 支援跨瀏覽器相容性
 * - 實現統一的儲存適配器介面
 * - 提供資料完整性檢查
 *
 * 測試涵蓋範圍：
 * - 基本結構和初始化
 * - localStorage API 整合
 * - 儲存操作邏輯
 * - 資料序列化處理
 * - 錯誤處理和恢復
 * - 效能和統計監控
 *
 * @version 1.0.0
 * @since 2025-08-06
 */

// 設置測試環境
global.window = {}

describe('LocalStorageAdapter', () => {
  let adapter
  // eslint-disable-next-line no-unused-vars
  let mockLocalStorage

  beforeEach(() => {
    // 模擬 localStorage API
    // eslint-disable-next-line no-unused-vars
    const storage = {}
    mockLocalStorage = {
      getItem: jest.fn().mockImplementation((key) => storage[key] || null),
      setItem: jest.fn().mockImplementation((key, value) => {
        storage[key] = value
      }),
      removeItem: jest.fn().mockImplementation((key) => {
        delete storage[key]
      }),
      clear: jest.fn().mockImplementation(() => {
        Object.keys(storage).forEach(key => delete storage[key])
      }),
      get length () {
        return Object.keys(storage).length
      },
      key: jest.fn().mockImplementation((index) => {
        // eslint-disable-next-line no-unused-vars
        const keys = Object.keys(storage)
        return keys[index] || null
      }),
      // 為了測試方便，暴露 storage 物件
      _storage: storage
    }

    // 將 localStorage 模擬添加到全域
    global.localStorage = mockLocalStorage
  })

  afterEach(() => {
    delete global.localStorage
    jest.clearAllMocks()
  })

  describe('🔴 TDD Red Phase - 建構和基本功能', () => {
    test('應該能夠建構 LocalStorageAdapter 實例', () => {
      // eslint-disable-next-line no-unused-vars
      const LocalStorageAdapter = require('src/storage/adapters/local-storage-adapter')
      adapter = new LocalStorageAdapter()

      expect(adapter).toBeDefined()
      expect(adapter.name).toBe('LocalStorageAdapter')
      expect(adapter.type).toBe('localStorage')
    })

    test('應該正確檢測 localStorage API 可用性', () => {
      // eslint-disable-next-line no-unused-vars
      const LocalStorageAdapter = require('src/storage/adapters/local-storage-adapter')
      adapter = new LocalStorageAdapter()

      expect(adapter.isAvailable()).toBe(true)
    })

    test('應該在 localStorage 不可用時回傳 false', () => {
      delete global.localStorage

      // eslint-disable-next-line no-unused-vars
      const LocalStorageAdapter = require('src/storage/adapters/local-storage-adapter')
      adapter = new LocalStorageAdapter()

      expect(adapter.isAvailable()).toBe(false)
    })

    test('應該初始化統計和配置', () => {
      // eslint-disable-next-line no-unused-vars
      const LocalStorageAdapter = require('src/storage/adapters/local-storage-adapter')
      adapter = new LocalStorageAdapter()

      expect(adapter.stats).toBeDefined()
      expect(adapter.config).toBeDefined()
      expect(adapter.errorStats).toBeDefined()
    })
  })

  describe('🔴 TDD Red Phase - 儲存操作', () => {
    let LocalStorageAdapter

    beforeEach(() => {
      LocalStorageAdapter = require('src/storage/adapters/local-storage-adapter')
      adapter = new LocalStorageAdapter()
    })

    test('應該能夠儲存簡單資料', async () => {
      // eslint-disable-next-line no-unused-vars
      const testData = { id: 'test-1', name: 'Test Book' }
      // eslint-disable-next-line no-unused-vars
      const result = await adapter.save('test-key', testData)

      expect(result.success).toBe(true)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('book_extractor_test-key', JSON.stringify(testData))
    })

    test('應該能夠讀取已儲存的資料', async () => {
      // eslint-disable-next-line no-unused-vars
      const testData = { id: 'test-1', name: 'Test Book' }
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(testData))

      // eslint-disable-next-line no-unused-vars
      const result = await adapter.load('test-key')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(testData)
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('book_extractor_test-key')
    })

    test('應該能夠刪除指定資料', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await adapter.delete('test-key')

      expect(result.success).toBe(true)
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('book_extractor_test-key')
    })

    test('應該能夠清空所有資料', async () => {
      // 先添加一些測試資料
      mockLocalStorage.setItem('book_extractor_test-1', 'data1')
      mockLocalStorage.setItem('book_extractor_test-2', 'data2')

      // eslint-disable-next-line no-unused-vars
      const result = await adapter.clear()

      expect(result.success).toBe(true)
      expect(result.clearedCount).toBe(2)
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('book_extractor_test-1')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('book_extractor_test-2')
    })

    test('應該能夠取得儲存容量資訊', async () => {
      // eslint-disable-next-line no-unused-vars
      const info = await adapter.getStorageInfo()

      expect(info).toBeDefined()
      expect(info.type).toBe('localStorage')
      expect(info.available).toBe(true)
      expect(typeof info.usedBytes).toBe('number')
    })
  })

  describe('🔴 TDD Red Phase - 錯誤處理', () => {
    let LocalStorageAdapter

    beforeEach(() => {
      LocalStorageAdapter = require('src/storage/adapters/local-storage-adapter')
      adapter = new LocalStorageAdapter()
    })

    test('應該處理儲存時的 JSON 序列化錯誤', async () => {
      // eslint-disable-next-line no-unused-vars
      const circularData = {}
      circularData.self = circularData // 循環引用

      // eslint-disable-next-line no-unused-vars
      const result = await adapter.save('test-key', circularData)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.errorType).toBe('SERIALIZATION_ERROR')
    })

    test('應該處理讀取時的 JSON 解析錯誤', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json{')

      // eslint-disable-next-line no-unused-vars
      const result = await adapter.load('test-key')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.errorType).toBe('PARSE_ERROR')
    })

    test('應該處理 localStorage 配額超出錯誤', async () => {
      // 確保 localStorage 是可用的，但會拋出配額錯誤
      global.localStorage = mockLocalStorage

      mockLocalStorage.setItem.mockImplementation((key, value) => {
        // 第一次是測試可用性，讓它通過
        if (key === '__localStorage_test__') {
          return
        }
        // 實際儲存時拋出配額錯誤
        // eslint-disable-next-line no-unused-vars
        const quotaError = new Error('QuotaExceededError')
        quotaError.name = 'QuotaExceededError'
        throw quotaError
      })

      // eslint-disable-next-line no-unused-vars
      const result = await adapter.save('test-key', { large: 'data' })

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('QUOTA_EXCEEDED')
    })

    test('應該處理 localStorage API 不可用時的操作', async () => {
      delete global.localStorage

      // eslint-disable-next-line no-unused-vars
      const result = await adapter.save('test-key', { data: 'test' })

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('API_UNAVAILABLE')
    })
  })

  describe('🔴 TDD Red Phase - 統計和監控', () => {
    let LocalStorageAdapter

    beforeEach(() => {
      LocalStorageAdapter = require('src/storage/adapters/local-storage-adapter')
      adapter = new LocalStorageAdapter()
    })

    test('應該統計成功的儲存操作', async () => {
      await adapter.save('test-1', { data: 'test1' })
      await adapter.save('test-2', { data: 'test2' })

      // eslint-disable-next-line no-unused-vars
      const stats = adapter.getStats()
      expect(stats.operations.save.success).toBe(2)
      expect(stats.operations.save.total).toBe(2)
    })

    test('應該統計失敗的操作', async () => {
      // 強制 localStorage 拋出錯誤
      mockLocalStorage.setItem.mockImplementation(() => {
        throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.STORAGE_LOCAL_ERROR; error.details = { category: 'testing' }; return error })()
      })

      await adapter.save('test-key', { data: 'test' })

      // eslint-disable-next-line no-unused-vars
      const stats = adapter.getStats()
      expect(stats.operations.save.errors).toBe(1)
      expect(stats.operations.save.total).toBe(1)
      expect(stats.operations.save.success).toBe(0)
    })

    test('應該追蹤效能指標', async () => {
      // 添加延遲以確保效能測量有意義的數值
      await new Promise(resolve => setTimeout(resolve, 1))
      await adapter.save('test-key', { data: 'test' })
      await new Promise(resolve => setTimeout(resolve, 1))
      await adapter.load('test-key')

      // eslint-disable-next-line no-unused-vars
      const stats = adapter.getStats()
      expect(stats.performance.averageResponseTime).toBeGreaterThanOrEqual(0)
      expect(stats.performance.totalOperations).toBe(2)
    })

    test('應該提供詳細的錯誤統計', async () => {
      // 模擬配額超出錯誤 - 需要先讓 isAvailable 通過
      mockLocalStorage.setItem
        .mockImplementationOnce(() => {}) // 通過 isAvailable 檢查
        .mockImplementationOnce((key, value) => {
          if (key === '__localStorage_test__') return
          // eslint-disable-next-line no-unused-vars
          const quotaError = new Error('QuotaExceededError')
          quotaError.name = 'QuotaExceededError'
          throw quotaError
        })

      mockLocalStorage.getItem.mockReturnValueOnce('invalid-json{')

      await adapter.save('test-1', { data: 'test1' })
      await adapter.load('test-2')

      // eslint-disable-next-line no-unused-vars
      const errorStats = adapter.getErrorStats()
      expect(errorStats.QUOTA_EXCEEDED).toBe(1)
      expect(errorStats.PARSE_ERROR).toBe(1)
      expect(errorStats.total).toBe(2)
    })
  })

  describe('🔴 TDD Red Phase - 資料完整性', () => {
    let LocalStorageAdapter

    beforeEach(() => {
      LocalStorageAdapter = require('src/storage/adapters/local-storage-adapter')
      adapter = new LocalStorageAdapter()
    })

    test('應該處理 null 和 undefined 值', async () => {
      // eslint-disable-next-line no-unused-vars
      const saveResult1 = await adapter.save('null-key', null)
      // eslint-disable-next-line no-unused-vars
      const saveResult2 = await adapter.save('undefined-key', undefined)

      expect(saveResult1.success).toBe(true)
      expect(saveResult2.success).toBe(true)

      // eslint-disable-next-line no-unused-vars
      const loadResult1 = await adapter.load('null-key')
      // eslint-disable-next-line no-unused-vars
      const loadResult2 = await adapter.load('undefined-key')

      expect(loadResult1.success).toBe(true)
      expect(loadResult1.data).toBe(null)
      expect(loadResult2.success).toBe(true)
      expect(loadResult2.data).toBe(undefined)
    })

    test('應該處理空物件和陣列', async () => {
      // eslint-disable-next-line no-unused-vars
      const emptyObject = {}
      // eslint-disable-next-line no-unused-vars
      const emptyArray = []

      await adapter.save('empty-object', emptyObject)
      await adapter.save('empty-array', emptyArray)

      // eslint-disable-next-line no-unused-vars
      const objectResult = await adapter.load('empty-object')
      // eslint-disable-next-line no-unused-vars
      const arrayResult = await adapter.load('empty-array')

      expect(objectResult.success).toBe(true)
      expect(objectResult.data).toEqual({})
      expect(arrayResult.success).toBe(true)
      expect(arrayResult.data).toEqual([])
    })

    test('應該處理包含特殊字符的資料', async () => {
      // eslint-disable-next-line no-unused-vars
      const specialData = {
        unicode: '中文測試 🔥',
        symbols: '!@#$%^&*()[]{}',
        quotes: 'Single\'s and "Double" quotes',
        newlines: 'Line 1\\nLine 2\\tTabbed'
      }

      // eslint-disable-next-line no-unused-vars
      const saveResult = await adapter.save('special-key', specialData)
      expect(saveResult.success).toBe(true)

      // eslint-disable-next-line no-unused-vars
      const loadResult = await adapter.load('special-key')
      expect(loadResult.success).toBe(true)
      expect(loadResult.data).toEqual(specialData)
    })

    test('應該正確處理大型資料結構', async () => {
      // eslint-disable-next-line no-unused-vars
      const largeData = {
        books: Array.from({ length: 100 }, (_, i) => ({
          id: `book-${i}`,
          title: `Test Book ${i}`,
          metadata: {
            pages: Math.floor(Math.random() * 500) + 100,
            tags: [`tag-${i % 10}`, `category-${i % 5}`]
          }
        }))
      }

      // eslint-disable-next-line no-unused-vars
      const saveResult = await adapter.save('large-data', largeData)
      expect(saveResult.success).toBe(true)

      // eslint-disable-next-line no-unused-vars
      const loadResult = await adapter.load('large-data')
      expect(loadResult.success).toBe(true)
      expect(loadResult.data.books).toHaveLength(100)
      expect(loadResult.data.books[0].id).toBe('book-0')
    })
  })
})
