/**
 * StorageSaveHandler 單元測試
 *
 * 測試範圍：
 * - STORAGE.SAVE.REQUESTED 事件處理
 * - EventHandler 基底類別繼承
 * - 儲存適配器整合
 * - 錯誤處理和恢復機制
 * - 儲存完成事件觸發
 */

// 設置 Node.js 環境，避免 window 相關錯誤
const mockWindow = {}
global.window = mockWindow

const EventHandler = require('src/core/event-handler')

describe('StorageSaveHandler 單元測試', () => {
  let storageSaveHandler
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
      save: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
      getCapacity: jest.fn().mockReturnValue(1024 * 1024), // 1MB
      getName: jest.fn().mockReturnValue('MockStorageAdapter')
    }

    // StorageSaveHandler 類別將在實現時導入
    // const StorageSaveHandler = require('src/storage/handlers/storage-save-handler');
    // storageSaveHandler = new StorageSaveHandler(mockEventBus, mockStorageAdapter);
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ==================== 🟢 綠燈階段 - 基本結構測試 ====================
  describe('🟢 綠燈階段 - 基本結構', () => {
    test('應該能創建 StorageSaveHandler 實例', () => {
      const StorageSaveHandler = require('src/storage/handlers/storage-save-handler')
      storageSaveHandler = new StorageSaveHandler(mockEventBus, mockStorageAdapter)

      expect(storageSaveHandler).toBeDefined()
      expect(storageSaveHandler.name).toBe('StorageSaveHandler')
    })

    test('應該繼承自 EventHandler', () => {
      const StorageSaveHandler = require('src/storage/handlers/storage-save-handler')
      storageSaveHandler = new StorageSaveHandler(mockEventBus, mockStorageAdapter)

      expect(storageSaveHandler).toBeInstanceOf(EventHandler)
    })

    test('應該有正確的處理器名稱和優先級', () => {
      const StorageSaveHandler = require('src/storage/handlers/storage-save-handler')
      storageSaveHandler = new StorageSaveHandler(mockEventBus, mockStorageAdapter)

      expect(storageSaveHandler.name).toBe('StorageSaveHandler')
      expect(storageSaveHandler.priority).toBe(1) // 儲存操作應該有較高優先級
    })
  })

  // ==================== 🟢 綠燈階段 - 事件支援測試 ====================
  describe('🟢 綠燈階段 - 事件支援', () => {
    test('應該支援 STORAGE.SAVE.REQUESTED 事件', () => {
      const StorageSaveHandler = require('src/storage/handlers/storage-save-handler')
      storageSaveHandler = new StorageSaveHandler(mockEventBus, mockStorageAdapter)

      const supportedEvents = storageSaveHandler.getSupportedEvents()
      expect(supportedEvents).toContain('STORAGE.SAVE.REQUESTED')
    })

    test('應該能處理 STORAGE.SAVE.REQUESTED 事件', async () => {
      const StorageSaveHandler = require('src/storage/handlers/storage-save-handler')
      storageSaveHandler = new StorageSaveHandler(mockEventBus, mockStorageAdapter)

      // 模擬成功儲存
      mockStorageAdapter.save.mockResolvedValue({
        success: true,
        savedAt: new Date().toISOString(),
        size: 1024
      })

      const saveEvent = {
        type: 'STORAGE.SAVE.REQUESTED',
        data: {
          books: [{ id: '1', title: 'Test Book' }],
          metadata: {
            extractedAt: new Date().toISOString(),
            source: 'readmoo'
          }
        },
        flowId: 'test-flow-123',
        timestamp: Date.now()
      }

      const result = await storageSaveHandler.handle(saveEvent)
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })
  })

  // ==================== 🟢 綠燈階段 - 儲存處理邏輯測試 ====================
  describe('🟢 綠燈階段 - 儲存處理邏輯', () => {
    test('應該能調用儲存適配器保存資料', async () => {
      const StorageSaveHandler = require('src/storage/handlers/storage-save-handler')
      storageSaveHandler = new StorageSaveHandler(mockEventBus, mockStorageAdapter)

      // 模擬成功儲存
      mockStorageAdapter.save.mockResolvedValue({
        success: true,
        savedAt: new Date().toISOString(),
        size: 1024
      })

      const saveEvent = {
        type: 'STORAGE.SAVE.REQUESTED',
        data: {
          books: [{ id: '1', title: 'Test Book' }],
          metadata: { source: 'readmoo' }
        },
        flowId: 'test-flow-123'
      }

      await storageSaveHandler.handle(saveEvent)

      expect(mockStorageAdapter.save).toHaveBeenCalledWith(
        expect.objectContaining({
          books: saveEvent.data.books,
          metadata: expect.objectContaining(saveEvent.data.metadata)
        })
      )
    })

    test('應該在儲存成功後觸發 STORAGE.SAVE.COMPLETED 事件', async () => {
      const StorageSaveHandler = require('src/storage/handlers/storage-save-handler')
      storageSaveHandler = new StorageSaveHandler(mockEventBus, mockStorageAdapter)

      mockStorageAdapter.save.mockResolvedValue({
        success: true,
        savedAt: new Date().toISOString(),
        size: 1024
      })

      const saveEvent = {
        type: 'STORAGE.SAVE.REQUESTED',
        data: { books: [{ id: '1', title: 'Test Book' }] },
        flowId: 'test-flow-123'
      }

      await storageSaveHandler.handle(saveEvent)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'STORAGE.SAVE.COMPLETED',
        expect.objectContaining({
          flowId: 'test-flow-123',
          success: true,
          result: expect.any(Object)
        })
      )
    })

    test('應該能處理儲存失敗情況', async () => {
      const StorageSaveHandler = require('src/storage/handlers/storage-save-handler')
      storageSaveHandler = new StorageSaveHandler(mockEventBus, mockStorageAdapter)

      // 模擬儲存失敗
      const saveError = new Error('Storage quota exceeded')
      mockStorageAdapter.save.mockRejectedValue(saveError)

      const saveEvent = {
        type: 'STORAGE.SAVE.REQUESTED',
        data: { books: [{ id: '1', title: 'Test Book' }] },
        flowId: 'test-flow-123'
      }

      await expect(storageSaveHandler.handle(saveEvent)).rejects.toThrow(Error)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'STORAGE.ERROR',
        expect.objectContaining({
          flowId: 'test-flow-123',
          error: expect.stringContaining('Storage quota exceeded')
        })
      )
    })
  })

  // ==================== 🟢 綠燈階段 - 資料驗證測試 ====================
  describe('🟢 綠燈階段 - 資料驗證', () => {
    test('應該驗證儲存資料的必要欄位', async () => {
      const StorageSaveHandler = require('src/storage/handlers/storage-save-handler')
      storageSaveHandler = new StorageSaveHandler(mockEventBus, mockStorageAdapter)

      const invalidEvent = {
        type: 'STORAGE.SAVE.REQUESTED',
        data: {}, // 缺少必要的 books 資料
        flowId: 'test-flow-123'
      }

      await expect(storageSaveHandler.handle(invalidEvent)).rejects.toMatchObject({
        code: 'INVALID_INPUT_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'STORAGE.ERROR',
        expect.objectContaining({
          flowId: 'test-flow-123',
          error: expect.stringContaining('Invalid data')
        })
      )
    })

    test('應該檢查儲存適配器的可用性', async () => {
      const StorageSaveHandler = require('src/storage/handlers/storage-save-handler')

      // 模擬不可用的儲存適配器
      mockStorageAdapter.isAvailable.mockReturnValue(false)
      storageSaveHandler = new StorageSaveHandler(mockEventBus, mockStorageAdapter)

      const saveEvent = {
        type: 'STORAGE.SAVE.REQUESTED',
        data: { books: [{ id: '1', title: 'Test Book' }] },
        flowId: 'test-flow-123'
      }

      await expect(storageSaveHandler.handle(saveEvent)).rejects.toThrow(Error)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'STORAGE.ERROR',
        expect.objectContaining({
          flowId: 'test-flow-123',
          error: expect.stringContaining('Storage adapter not available')
        })
      )
    })
  })

  // ==================== 🟢 綠燈階段 - 效能和統計測試 ====================
  describe('🟢 綠燈階段 - 效能和統計', () => {
    test('應該記錄儲存操作的執行時間', async () => {
      const StorageSaveHandler = require('src/storage/handlers/storage-save-handler')
      storageSaveHandler = new StorageSaveHandler(mockEventBus, mockStorageAdapter)

      mockStorageAdapter.save.mockResolvedValue({ success: true })

      const saveEvent = {
        type: 'STORAGE.SAVE.REQUESTED',
        data: { books: [{ id: '1', title: 'Test Book' }] },
        flowId: 'test-flow-123'
      }

      await storageSaveHandler.handle(saveEvent)

      expect(storageSaveHandler.executionCount).toBe(1)
      expect(storageSaveHandler.lastExecutionTime).toBeGreaterThan(0)
    })

    test('應該提供儲存操作的統計資訊', () => {
      const StorageSaveHandler = require('src/storage/handlers/storage-save-handler')
      storageSaveHandler = new StorageSaveHandler(mockEventBus, mockStorageAdapter)

      const stats = storageSaveHandler.getStats()
      expect(stats).toHaveProperty('executionCount')
      expect(stats).toHaveProperty('averageExecutionTime')
      expect(stats).toHaveProperty('lastExecutionTime')
      expect(stats).toHaveProperty('saveCount')
      expect(stats).toHaveProperty('totalSavedSize')
    })
  })
})
