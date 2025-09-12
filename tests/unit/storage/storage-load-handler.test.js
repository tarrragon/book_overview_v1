/**
 * StorageLoadHandler 單元測試
 *
 * 測試範圍：
 * - STORAGE.LOAD.REQUESTED 事件處理
 * - EventHandler 基底類別繼承
 * - 儲存適配器整合
 * - 載入資料驗證和處理
 * - 錯誤處理和恢復機制
 * - 載入完成事件觸發
 */

// 設置 Node.js 環境，避免 window 相關錯誤
const mockWindow = {}
global.window = mockWindow

const EventHandler = require('src/core/event-handler')

describe('StorageLoadHandler 單元測試', () => {
  let storageLoadHandler
  let mockEventBus
  let mockStorageAdapter

  beforeEach(() => {
    // 模擬 EventBus
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    }

    // 模擬 StorageAdapter
    mockStorageAdapter = {
      load: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
      getCapacity: jest.fn().mockReturnValue(1024 * 1024), // 1MB
      getName: jest.fn().mockReturnValue('MockStorageAdapter')
    }

    // StorageLoadHandler 類別將在實現時導入
    // const StorageLoadHandler = require('src/storage/handlers/storage-load-handler');
    // storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter);
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ==================== 🟢 綠燈階段 - 基本結構測試 ====================
  describe('🟢 綠燈階段 - 基本結構', () => {
    test('應該能創建 StorageLoadHandler 實例', () => {
      const StorageLoadHandler = require('src/storage/handlers/storage-load-handler')
      storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter)

      expect(storageLoadHandler).toBeDefined()
      expect(storageLoadHandler.name).toBe('StorageLoadHandler')
    })

    test('應該繼承自 EventHandler', () => {
      const StorageLoadHandler = require('src/storage/handlers/storage-load-handler')
      storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter)

      expect(storageLoadHandler).toBeInstanceOf(EventHandler)
    })

    test('應該有正確的處理器名稱和優先級', () => {
      const StorageLoadHandler = require('src/storage/handlers/storage-load-handler')
      storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter)

      expect(storageLoadHandler.name).toBe('StorageLoadHandler')
      expect(storageLoadHandler.priority).toBe(1) // 載入操作應該有較高優先級
    })
  })

  // ==================== 🟢 綠燈階段 - 事件支援測試 ====================
  describe('🟢 綠燈階段 - 事件支援', () => {
    test('應該支援 STORAGE.LOAD.REQUESTED 事件', () => {
      const StorageLoadHandler = require('src/storage/handlers/storage-load-handler')
      storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter)

      const supportedEvents = storageLoadHandler.getSupportedEvents()
      expect(supportedEvents).toContain('STORAGE.LOAD.REQUESTED')
    })

    test('應該能處理 STORAGE.LOAD.REQUESTED 事件', async () => {
      const StorageLoadHandler = require('src/storage/handlers/storage-load-handler')
      storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter)

      // 模擬成功載入
      const mockLoadedData = {
        books: [{ id: '1', title: 'Test Book' }],
        metadata: { source: 'readmoo', totalCount: 1 }
      }

      mockStorageAdapter.load.mockResolvedValue({
        success: true,
        data: mockLoadedData,
        loadedAt: new Date().toISOString(),
        size: 1024
      })

      const loadEvent = {
        type: 'STORAGE.LOAD.REQUESTED',
        data: {
          source: 'readmoo',
          loadType: 'recent' // 載入最近的資料
        },
        flowId: 'test-load-flow-123',
        timestamp: Date.now()
      }

      const result = await storageLoadHandler.handle(loadEvent)
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })
  })

  // ==================== 🟢 綠燈階段 - 載入處理邏輯測試 ====================
  describe('🟢 綠燈階段 - 載入處理邏輯', () => {
    test('應該能調用儲存適配器載入資料', async () => {
      const StorageLoadHandler = require('src/storage/handlers/storage-load-handler')
      storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter)

      // 模擬成功載入
      const mockLoadedData = {
        books: [
          { id: '1', title: 'Test Book 1' },
          { id: '2', title: 'Test Book 2' }
        ],
        metadata: {
          savedAt: new Date().toISOString(),
          source: 'readmoo',
          totalCount: 2
        }
      }

      mockStorageAdapter.load.mockResolvedValue({
        success: true,
        data: mockLoadedData,
        loadedAt: new Date().toISOString(),
        size: 2048
      })

      const loadEvent = {
        type: 'STORAGE.LOAD.REQUESTED',
        data: {
          source: 'readmoo',
          loadType: 'all'
        },
        flowId: 'test-load-flow-123'
      }

      await storageLoadHandler.handle(loadEvent)

      expect(mockStorageAdapter.load).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'readmoo',
          loadType: 'all'
        })
      )
    })

    test('應該在載入成功後觸發 STORAGE.LOAD.COMPLETED 事件', async () => {
      const StorageLoadHandler = require('src/storage/handlers/storage-load-handler')
      storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter)

      const mockLoadedData = {
        books: [{ id: '1', title: 'Test Book' }],
        metadata: { source: 'readmoo', totalCount: 1 }
      }

      mockStorageAdapter.load.mockResolvedValue({
        success: true,
        data: mockLoadedData,
        loadedAt: new Date().toISOString(),
        size: 1024
      })

      const loadEvent = {
        type: 'STORAGE.LOAD.REQUESTED',
        data: { source: 'readmoo', loadType: 'all' },
        flowId: 'test-load-flow-123'
      }

      await storageLoadHandler.handle(loadEvent)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'STORAGE.LOAD.COMPLETED',
        expect.objectContaining({
          flowId: 'test-load-flow-123',
          success: true,
          data: mockLoadedData
        })
      )
    })

    test('應該能處理載入失敗情況', async () => {
      const StorageLoadHandler = require('src/storage/handlers/storage-load-handler')
      storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter)

      // 模擬載入失敗
      const loadError = new Error('Data not found')
      mockStorageAdapter.load.mockRejectedValue(loadError)

      const loadEvent = {
        type: 'STORAGE.LOAD.REQUESTED',
        data: { source: 'readmoo', loadType: 'all' },
        flowId: 'test-load-flow-123'
      }

      await expect(storageLoadHandler.handle(loadEvent)).rejects.toMatchObject({
        code: 'NOT_FOUND_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'STORAGE.ERROR',
        expect.objectContaining({
          flowId: 'test-load-flow-123',
          error: expect.stringContaining('Load operation failed: Data not found')
        })
      )
    })
  })

  // ==================== 🟢 綠燈階段 - 載入請求驗證測試 ====================
  describe('🟢 綠燈階段 - 載入請求驗證', () => {
    test('應該驗證載入請求的必要欄位', async () => {
      const StorageLoadHandler = require('src/storage/handlers/storage-load-handler')
      storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter)

      const invalidEvent = {
        type: 'STORAGE.LOAD.REQUESTED',
        data: {}, // 缺少必要的 source 和 loadType
        flowId: 'test-load-flow-123'
      }

      await expect(storageLoadHandler.handle(invalidEvent)).rejects.toMatchObject({
        code: 'INVALID_INPUT_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'STORAGE.ERROR',
        expect.objectContaining({
          flowId: 'test-load-flow-123',
          error: expect.stringContaining('Invalid load request')
        })
      )
    })

    test('應該驗證載入類型的有效性', async () => {
      const StorageLoadHandler = require('src/storage/handlers/storage-load-handler')
      storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter)

      const invalidEvent = {
        type: 'STORAGE.LOAD.REQUESTED',
        data: {
          source: 'readmoo',
          loadType: 'invalid_type' // 無效的載入類型
        },
        flowId: 'test-load-flow-123'
      }

      await expect(storageLoadHandler.handle(invalidEvent)).rejects.toMatchObject({
        code: 'INVALID_INPUT_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'STORAGE.ERROR',
        expect.objectContaining({
          flowId: 'test-load-flow-123',
          error: expect.stringContaining('Invalid load type')
        })
      )
    })

    test('應該檢查儲存適配器的可用性', async () => {
      const StorageLoadHandler = require('src/storage/handlers/storage-load-handler')

      // 模擬不可用的儲存適配器
      mockStorageAdapter.isAvailable.mockReturnValue(false)
      storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter)

      const loadEvent = {
        type: 'STORAGE.LOAD.REQUESTED',
        data: { source: 'readmoo', loadType: 'all' },
        flowId: 'test-load-flow-123'
      }

      await expect(storageLoadHandler.handle(loadEvent)).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'STORAGE.ERROR',
        expect.objectContaining({
          flowId: 'test-load-flow-123',
          error: expect.stringContaining('Storage adapter not available')
        })
      )
    })
  })

  // ==================== 🟢 綠燈階段 - 載入結果處理測試 ====================
  describe('🟢 綠燈階段 - 載入結果處理', () => {
    test('應該驗證載入結果的完整性', async () => {
      const StorageLoadHandler = require('src/storage/handlers/storage-load-handler')
      storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter)

      // 模擬返回無效結果的載入
      mockStorageAdapter.load.mockResolvedValue({
        success: false,
        data: null, // 無效的結果
        error: 'No data found'
      })

      const loadEvent = {
        type: 'STORAGE.LOAD.REQUESTED',
        data: { source: 'readmoo', loadType: 'all' },
        flowId: 'test-load-flow-123'
      }

      await expect(storageLoadHandler.handle(loadEvent)).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'STORAGE.ERROR',
        expect.objectContaining({
          flowId: 'test-load-flow-123',
          error: expect.stringContaining('Load operation failed: No data found')
        })
      )
    })

    test('應該處理空的載入結果', async () => {
      const StorageLoadHandler = require('src/storage/handlers/storage-load-handler')
      storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter)

      // 模擬返回空資料的載入
      mockStorageAdapter.load.mockResolvedValue({
        success: true,
        data: {
          books: [],
          metadata: { source: 'readmoo', totalCount: 0 }
        },
        loadedAt: new Date().toISOString(),
        size: 0
      })

      const loadEvent = {
        type: 'STORAGE.LOAD.REQUESTED',
        data: { source: 'readmoo', loadType: 'all' },
        flowId: 'test-load-flow-123'
      }

      const result = await storageLoadHandler.handle(loadEvent)

      expect(result.success).toBe(true)
      expect(result.data.books).toHaveLength(0)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'STORAGE.LOAD.COMPLETED',
        expect.objectContaining({
          flowId: 'test-load-flow-123',
          success: true
        })
      )
    })
  })

  // ==================== 🟢 綠燈階段 - 效能和統計測試 ====================
  describe('🟢 綠燈階段 - 效能和統計', () => {
    test('應該記錄載入操作的執行時間', async () => {
      const StorageLoadHandler = require('src/storage/handlers/storage-load-handler')
      storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter)

      mockStorageAdapter.load.mockResolvedValue({
        success: true,
        data: { books: [], metadata: {} }
      })

      const loadEvent = {
        type: 'STORAGE.LOAD.REQUESTED',
        data: { source: 'readmoo', loadType: 'all' },
        flowId: 'test-load-flow-123'
      }

      await storageLoadHandler.handle(loadEvent)

      expect(storageLoadHandler.executionCount).toBe(1)
      expect(storageLoadHandler.lastExecutionTime).toBeGreaterThan(0)
    })

    test('應該提供載入操作的統計資訊', () => {
      const StorageLoadHandler = require('src/storage/handlers/storage-load-handler')
      storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter)

      const stats = storageLoadHandler.getStats()
      expect(stats).toHaveProperty('executionCount')
      expect(stats).toHaveProperty('averageExecutionTime')
      expect(stats).toHaveProperty('lastExecutionTime')
      expect(stats).toHaveProperty('loadCount')
      expect(stats).toHaveProperty('totalLoadedSize')
    })

    test('應該支援不同的載入類型統計', () => {
      const StorageLoadHandler = require('src/storage/handlers/storage-load-handler')
      storageLoadHandler = new StorageLoadHandler(mockEventBus, mockStorageAdapter)

      const stats = storageLoadHandler.getStats()
      expect(stats).toHaveProperty('loadTypeStats')
      expect(stats.loadTypeStats).toHaveProperty('all')
      expect(stats.loadTypeStats).toHaveProperty('recent')
      expect(stats.loadTypeStats).toHaveProperty('filtered')
    })
  })
})
