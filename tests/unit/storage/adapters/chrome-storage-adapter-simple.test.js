/**
 * ChromeStorageAdapter 簡化測試
 * 專注於核心功能驗證
 */

// 設置測試環境
global.window = {}

const ChromeStorageAdapter = require('../../../../src/storage/adapters/chrome-storage-adapter')

describe('ChromeStorageAdapter - Core Functionality', () => {
  let adapter
  let mockChromeStorage

  beforeEach(() => {
    // 簡化的 Chrome Storage API 模擬
    mockChromeStorage = {
      local: {
        set: jest.fn((items, callback) => {
          setTimeout(() => callback && callback(), 0)
        }),
        get: jest.fn((keys, callback) => {
          setTimeout(() => callback && callback({}), 0)
        }),
        remove: jest.fn((keys, callback) => {
          setTimeout(() => callback && callback(), 0)
        }),
        clear: jest.fn((callback) => {
          setTimeout(() => callback && callback(), 0)
        }),
        getBytesInUse: jest.fn((keys, callback) => {
          setTimeout(() => callback && callback(100), 0)
        })
      }
    }

    // 設置全域 chrome 物件
    global.chrome = {
      storage: mockChromeStorage,
      runtime: { lastError: null }
    }

    jest.clearAllMocks()
  })

  afterEach(() => {
    delete global.chrome
  })

  describe('🔧 基本功能測試', () => {
    test('應該能夠正確實例化', () => {
      expect(() => {
        adapter = new ChromeStorageAdapter()
      }).not.toThrow()

      expect(adapter).toBeDefined()
      expect(adapter.type).toBe('chrome.storage')
      expect(adapter.name).toBe('ChromeStorageAdapter')
    })

    test('應該檢查 Chrome Storage API 可用性', () => {
      adapter = new ChromeStorageAdapter()
      expect(adapter.isAvailable()).toBe(true)

      // 測試 API 不可用的情況
      delete global.chrome
      expect(adapter.isAvailable()).toBe(false)

      // 恢復 chrome 物件
      global.chrome = {
        storage: mockChromeStorage,
        runtime: { lastError: null }
      }
    })

    test('應該支援配置選項', () => {
      const options = {
        maxSize: 5242880,
        keyPrefix: 'test_',
        compressionEnabled: false
      }

      adapter = new ChromeStorageAdapter(options)
      expect(adapter.config.maxSize).toBe(5242880)
      expect(adapter.config.keyPrefix).toBe('test_')
      expect(adapter.config.compressionEnabled).toBe(false)
    })
  })

  describe('🔧 儲存操作測試', () => {
    beforeEach(() => {
      adapter = new ChromeStorageAdapter()
    })

    test('應該成功儲存數據', async () => {
      const key = 'test_key'
      const data = { books: [{ id: 1, title: 'Test Book' }] }

      const result = await adapter.save(key, data)

      expect(result.success).toBe(true)
      expect(result.key).toBe(key)
      expect(mockChromeStorage.local.set).toHaveBeenCalledWith(
        { [key]: data },
        expect.any(Function)
      )
    })

    test('應該成功載入數據', async () => {
      const key = 'test_key'
      const expectedData = { books: [{ id: 1, title: 'Test Book' }] }

      // 設置模擬返回數據
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        setTimeout(() => callback && callback({ [key]: expectedData }), 0)
      })

      const result = await adapter.load(key)

      expect(result).toEqual(expectedData)
      expect(mockChromeStorage.local.get).toHaveBeenCalledWith([key], expect.any(Function))
    })

    test('應該處理不存在的 key', async () => {
      const key = 'non_existent_key'

      const result = await adapter.load(key)

      expect(result).toBeNull()
    })

    test('應該成功刪除數據', async () => {
      const key = 'test_key'

      const result = await adapter.delete(key)

      expect(result.success).toBe(true)
      expect(result.key).toBe(key)
      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith([key], expect.any(Function))
    })

    test('應該成功清空所有數據', async () => {
      const result = await adapter.clear()

      expect(result.success).toBe(true)
      expect(mockChromeStorage.local.clear).toHaveBeenCalled()
    })
  })

  describe('🔧 統計功能測試', () => {
    beforeEach(() => {
      adapter = new ChromeStorageAdapter()
    })

    test('應該提供統計資訊', () => {
      const stats = adapter.getStats()

      expect(stats).toHaveProperty('operations')
      expect(stats).toHaveProperty('totalOperations')
      expect(stats.operations).toHaveProperty('save')
      expect(stats.operations).toHaveProperty('load')
      expect(stats.operations).toHaveProperty('delete')
      expect(stats.operations).toHaveProperty('clear')
    })

    test('應該追蹤操作統計', async () => {
      await adapter.save('test', { data: 'test' })

      const stats = adapter.getStats()
      expect(stats.operations.save).toBe(1)
      expect(stats.totalOperations).toBe(1)
    })

    test('應該提供錯誤統計', () => {
      const errorStats = adapter.getErrorStats()

      expect(errorStats).toHaveProperty('totalErrors')
      expect(errorStats).toHaveProperty('errorsByType')
      expect(errorStats.totalErrors).toBe(0)
    })

    test('應該提供效能指標', () => {
      const metrics = adapter.getPerformanceMetrics()

      expect(metrics).toHaveProperty('lastOperationTime')
      expect(metrics).toHaveProperty('averageResponseTime')
      expect(metrics).toHaveProperty('operationCount')
    })
  })

  describe('🔧 配額管理測試', () => {
    beforeEach(() => {
      adapter = new ChromeStorageAdapter({ maxSize: 1048576 }) // 1MB
    })

    test('應該檢查儲存配額', async () => {
      mockChromeStorage.local.getBytesInUse.mockImplementation((keys, callback) => {
        setTimeout(() => callback && callback(524288), 0) // 0.5MB
      })

      const quotaInfo = await adapter.checkQuota()

      expect(quotaInfo.usedBytes).toBe(524288)
      expect(quotaInfo.maxBytes).toBe(1048576)
      expect(quotaInfo.usagePercentage).toBe(50)
      expect(quotaInfo.isNearLimit).toBe(false)
    })

    test('應該偵測配額接近限制', async () => {
      mockChromeStorage.local.getBytesInUse.mockImplementation((keys, callback) => {
        setTimeout(() => callback && callback(943718), 0) // 90%
      })

      const quotaInfo = await adapter.checkQuota()

      expect(quotaInfo.usagePercentage).toBe(90)
      expect(quotaInfo.isNearLimit).toBe(true)
    })
  })

  describe('🔧 健康檢查測試', () => {
    beforeEach(() => {
      adapter = new ChromeStorageAdapter()
    })

    test('應該提供健康狀態', async () => {
      const health = await adapter.getHealthStatus()

      expect(health).toHaveProperty('isHealthy')
      expect(health).toHaveProperty('apiAvailable')
      expect(health).toHaveProperty('responseTime')
      expect(health).toHaveProperty('errorRate')
      expect(health.apiAvailable).toBe(true)
      expect(health.errorRate).toBe(0)
    })
  })

  describe('🔧 鎖定機制測試', () => {
    beforeEach(() => {
      adapter = new ChromeStorageAdapter()
    })

    test('應該提供鎖定狀態查詢', () => {
      const key = 'test_key'

      expect(adapter.isLocked(key)).toBe(false)
      expect(typeof adapter.isLocked).toBe('function')
    })
  })

  describe('🔧 數據壓縮測試', () => {
    test('應該跳過小型數據的壓縮', async () => {
      adapter = new ChromeStorageAdapter({
        compressionEnabled: true,
        compressionThreshold: 1024
      })

      const smallData = { id: 1, title: 'Small' }

      const result = await adapter.save('small_data', smallData)

      expect(result.success).toBe(true)
      expect(result.compressed).toBe(false)
    })
  })
})
