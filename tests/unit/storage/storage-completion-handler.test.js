/**
 * StorageCompletionHandler 單元測試
 *
 * 負責功能：
 * - 處理 STORAGE.SAVE.COMPLETED 事件
 * - 處理 STORAGE.ERROR 事件
 * - 發送完成通知事件
 * - 處理錯誤恢復流程
 * - 統計和監控
 *
 * 設計考量：
 * - 繼承 EventHandler 基底類別
 * - 支援多種儲存結果類型
 * - 提供詳細的錯誤分析
 * - 統計成功率和效能指標
 *
 * 測試涵蓋範圍：
 * - 基本結構和初始化
 * - 事件處理邏輯
 * - 完成通知機制
 * - 錯誤處理和恢復
 * - 統計和效能監控
 *
 * @version 1.0.0
 * @since 2025-07-31
 */

// 設置測試環境
global.window = {}

// eslint-disable-next-line no-unused-vars
const StorageCompletionHandler = require('src/storage/handlers/storage-completion-handler')
// eslint-disable-next-line no-unused-vars
const EventHandler = require('src/core/event-handler')

describe('StorageCompletionHandler', () => {
  // eslint-disable-next-line no-unused-vars
  let handler
  // eslint-disable-next-line no-unused-vars
  let mockEventBus
  // eslint-disable-next-line no-unused-vars
  let mockStorageAdapter

  beforeEach(() => {
    // 模擬 EventBus
    mockEventBus = {
      emit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      off: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        totalEvents: 0,
        totalHandlers: 0
      })
    }

    // 模擬 StorageAdapter
    mockStorageAdapter = {
      isAvailable: jest.fn().mockReturnValue(true),
      save: jest.fn().mockResolvedValue({ success: true }),
      load: jest.fn().mockResolvedValue({ books: [] }),
      delete: jest.fn().mockResolvedValue({ success: true }),
      getMetadata: jest.fn().mockReturnValue({
        version: '1.0.0',
        type: 'mock'
      })
    }

    // 清理 console 模擬
    jest.clearAllMocks()
  })

  describe('🔧 基本結構測試', () => {
    test('應該正確繼承 EventHandler', () => {
      handler = new StorageCompletionHandler(mockEventBus, mockStorageAdapter)
      expect(handler).toBeInstanceOf(EventHandler)
      expect(handler).toBeInstanceOf(StorageCompletionHandler)
    })

    test('應該能夠正確實例化', () => {
      expect(() => {
        handler = new StorageCompletionHandler(mockEventBus, mockStorageAdapter)
      }).not.toThrow()

      expect(handler).toBeDefined()
      expect(handler.eventBus).toBe(mockEventBus)
      expect(handler.storageAdapter).toBe(mockStorageAdapter)
    })

    test('應該有正確的處理器名稱', () => {
      handler = new StorageCompletionHandler(mockEventBus, mockStorageAdapter)
      expect(handler.name).toBe('StorageCompletionHandler')
    })

    test('應該有適當的優先級設定', () => {
      handler = new StorageCompletionHandler(mockEventBus, mockStorageAdapter)
      expect(handler.priority).toBe(1)
      expect(typeof handler.priority).toBe('number')
    })
  })

  describe('🔧 事件支援測試', () => {
    beforeEach(() => {
      handler = new StorageCompletionHandler(mockEventBus, mockStorageAdapter)
    })

    test('應該支援 STORAGE.SAVE.COMPLETED 事件', () => {
      // eslint-disable-next-line no-unused-vars
      const supports = handler.supportsEvent('STORAGE.SAVE.COMPLETED')
      expect(supports).toBe(true)
    })

    test('應該支援 STORAGE.ERROR 事件', () => {
      // eslint-disable-next-line no-unused-vars
      const supports = handler.supportsEvent('STORAGE.ERROR')
      expect(supports).toBe(true)
    })

    test('應該拒絕不支援的事件類型', () => {
      // eslint-disable-next-line no-unused-vars
      const unsupportedEvents = [
        'STORAGE.LOAD.REQUESTED',
        'EXTRACTION.COMPLETED',
        'UI.UPDATE',
        'UNKNOWN.EVENT'
      ]

      unsupportedEvents.forEach(eventType => {
        // eslint-disable-next-line no-unused-vars
        const supports = handler.supportsEvent(eventType)
        expect(supports).toBe(false)
      })
    })
  })

  describe('🔧 儲存完成處理測試', () => {
    beforeEach(() => {
      handler = new StorageCompletionHandler(mockEventBus, mockStorageAdapter)
    })

    test('應該處理成功的儲存完成事件', async () => {
      // eslint-disable-next-line no-unused-vars
      const event = {
        type: 'STORAGE.SAVE.COMPLETED',
        data: {
          flowId: 'test-flow-123',
          result: {
            success: true,
            savedCount: 50,
            timestamp: Date.now(),
            storageType: 'chrome.storage'
          }
        },
        metadata: {
          timestamp: Date.now(),
          source: 'StorageSaveHandler'
        }
      }

      await handler.handle(event)

      // 應該發送完成通知事件
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.stringMatching(/^UI\.NOTIFICATION\.SHOW$/),
        expect.objectContaining({
          type: 'success',
          message: expect.stringContaining('儲存完成')
        })
      )

      // 應該發送UI更新事件
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.stringMatching(/^UI\.STORAGE\.UPDATE$/),
        expect.objectContaining({
          status: 'completed',
          result: event.data.result
        })
      )
    })

    test('應該處理失敗的儲存完成事件', async () => {
      // eslint-disable-next-line no-unused-vars
      const event = {
        type: 'STORAGE.SAVE.COMPLETED',
        data: {
          flowId: 'test-flow-456',
          result: {
            success: false,
            error: 'Quota exceeded',
            partialSave: true,
            savedCount: 25,
            totalCount: 50
          }
        },
        metadata: {
          timestamp: Date.now(),
          source: 'StorageSaveHandler'
        }
      }

      await handler.handle(event)

      // 應該發送警告通知
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.stringMatching(/^UI\.NOTIFICATION\.SHOW$/),
        expect.objectContaining({
          type: 'warning',
          message: expect.stringContaining('部分儲存')
        })
      )
    })

    test('應該更新完成統計資訊', async () => {
      // eslint-disable-next-line no-unused-vars
      const event = {
        type: 'STORAGE.SAVE.COMPLETED',
        data: {
          flowId: 'test-flow-789',
          result: {
            success: true,
            savedCount: 30,
            processingTime: 1500
          }
        },
        metadata: { timestamp: Date.now() }
      }

      // eslint-disable-next-line no-unused-vars
      const initialStats = handler.getCompletionStats()
      await handler.handle(event)
      // eslint-disable-next-line no-unused-vars
      const updatedStats = handler.getCompletionStats()

      expect(updatedStats.totalCompletions).toBe(initialStats.totalCompletions + 1)
      expect(updatedStats.successfulCompletions).toBe(initialStats.successfulCompletions + 1)
      expect(updatedStats.totalSavedItems).toBe(initialStats.totalSavedItems + 30)
    })
  })

  describe('🔧 錯誤處理測試', () => {
    beforeEach(() => {
      handler = new StorageCompletionHandler(mockEventBus, mockStorageAdapter)
    })

    test('應該處理儲存錯誤事件', async () => {
      // eslint-disable-next-line no-unused-vars
      const event = {
        type: 'STORAGE.ERROR',
        data: {
          flowId: 'error-flow-123',
          error: {
            type: 'QUOTA_EXCEEDED',
            message: 'Storage quota exceeded',
            code: 'QUOTA_EXCEEDED_ERR'
          },
          context: {
            operation: 'save',
            itemCount: 100,
            storageType: 'chrome.storage'
          }
        },
        metadata: { timestamp: Date.now() }
      }

      await handler.handle(event)

      // 應該發送錯誤通知
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.stringMatching(/^UI\.ERROR\.SHOW$/),
        expect.objectContaining({
          error: event.data.error,
          context: event.data.context
        })
      )

      // 應該觸發恢復策略
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.stringMatching(/^STORAGE\.RECOVERY\.REQUESTED$/),
        expect.objectContaining({
          flowId: event.data.flowId,
          errorType: 'QUOTA_EXCEEDED'
        })
      )
    })

    test('應該分析錯誤類型並提供適當策略', async () => {
      // eslint-disable-next-line no-unused-vars
      const errorTypes = [
        { type: 'QUOTA_EXCEEDED', expectedRecovery: 'cleanup' },
        { type: 'NETWORK_ERROR', expectedRecovery: 'retry' },
        { type: 'PERMISSION_DENIED', expectedRecovery: 'request_permission' },
        { type: 'CORRUPTION_ERROR', expectedRecovery: 'reset_storage' }
      ]

      for (const errorType of errorTypes) {
        // eslint-disable-next-line no-unused-vars
        const event = {
          type: 'STORAGE.ERROR',
          data: {
            flowId: `error-${errorType.type}`,
            error: { type: errorType.type, message: `Test ${errorType.type}` }
          },
          metadata: { timestamp: Date.now() }
        }

        await handler.handle(event)

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          expect.stringMatching(/^STORAGE\.RECOVERY\.REQUESTED$/),
          expect.objectContaining({
            strategy: errorType.expectedRecovery
          })
        )
      }
    })

    test('應該更新錯誤統計資訊', async () => {
      // eslint-disable-next-line no-unused-vars
      const event = {
        type: 'STORAGE.ERROR',
        data: {
          flowId: 'error-stats-test',
          error: { type: 'NETWORK_ERROR', message: 'Connection failed' }
        },
        metadata: { timestamp: Date.now() }
      }

      // eslint-disable-next-line no-unused-vars
      const initialStats = handler.getErrorStats()
      await handler.handle(event)
      // eslint-disable-next-line no-unused-vars
      const updatedStats = handler.getErrorStats()

      expect(updatedStats.totalErrors).toBe(initialStats.totalErrors + 1)
      expect(updatedStats.errorsByType.NETWORK_ERROR).toBe(
        (initialStats.errorsByType.NETWORK_ERROR || 0) + 1
      )
    })
  })

  describe('🔧 事件驗證測試', () => {
    beforeEach(() => {
      handler = new StorageCompletionHandler(mockEventBus, mockStorageAdapter)
    })

    test('應該驗證事件結構完整性', async () => {
      // eslint-disable-next-line no-unused-vars
      const invalidEvents = [
        { type: 'STORAGE.SAVE.COMPLETED' }, // 缺少 data
        { data: { flowId: 'test' } }, // 缺少 type
        { type: 'STORAGE.SAVE.COMPLETED', data: {} }, // 缺少 flowId
        { type: 'STORAGE.ERROR', data: { flowId: 'test' } } // 缺少 error
      ]

      for (const invalidEvent of invalidEvents) {
        await expect(handler.handle(invalidEvent)).rejects.toThrow()
      }
    })

    test('應該驗證完成結果資料', async () => {
      // eslint-disable-next-line no-unused-vars
      const event = {
        type: 'STORAGE.SAVE.COMPLETED',
        data: {
          flowId: 'validation-test',
          result: {} // 空的結果物件
        },
        metadata: { timestamp: Date.now() }
      }

      await expect(handler.handle(event)).rejects.toMatchObject({
        code: 'INVALID_INPUT_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })
    })

    test('應該驗證錯誤資料結構', async () => {
      // eslint-disable-next-line no-unused-vars
      const event = {
        type: 'STORAGE.ERROR',
        data: {
          flowId: 'error-validation-test',
          error: {} // 空的錯誤物件
        },
        metadata: { timestamp: Date.now() }
      }

      await expect(handler.handle(event)).rejects.toMatchObject({
        code: 'INVALID_INPUT_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })
    })
  })

  describe('🔧 統計和效能測試', () => {
    beforeEach(() => {
      handler = new StorageCompletionHandler(mockEventBus, mockStorageAdapter)
    })

    test('應該提供完成統計資訊', () => {
      // eslint-disable-next-line no-unused-vars
      const stats = handler.getCompletionStats()

      expect(stats).toHaveProperty('totalCompletions')
      expect(stats).toHaveProperty('successfulCompletions')
      expect(stats).toHaveProperty('failedCompletions')
      expect(stats).toHaveProperty('totalSavedItems')
      expect(stats).toHaveProperty('averageProcessingTime')
      expect(stats).toHaveProperty('successRate')

      expect(typeof stats.totalCompletions).toBe('number')
      expect(typeof stats.successRate).toBe('number')
    })

    test('應該提供錯誤統計資訊', () => {
      // eslint-disable-next-line no-unused-vars
      const stats = handler.getErrorStats()

      expect(stats).toHaveProperty('totalErrors')
      expect(stats).toHaveProperty('errorsByType')
      expect(stats).toHaveProperty('recoveryAttempts')
      expect(stats).toHaveProperty('recoverySuccessRate')

      expect(typeof stats.totalErrors).toBe('number')
      expect(typeof stats.errorsByType).toBe('object')
    })

    test('應該追蹤處理時間', async () => {
      // eslint-disable-next-line no-unused-vars
      const event = {
        type: 'STORAGE.SAVE.COMPLETED',
        data: {
          flowId: 'timing-test',
          result: { success: true, savedCount: 10 }
        },
        metadata: { timestamp: Date.now() }
      }

      // eslint-disable-next-line no-unused-vars
      const startTime = performance.now()
      await handler.handle(event)
      // eslint-disable-next-line no-unused-vars
      const endTime = performance.now()

      // eslint-disable-next-line no-unused-vars
      const stats = handler.getProcessingStats()
      expect(stats.lastProcessingTime).toBeGreaterThan(0)
      expect(stats.lastProcessingTime).toBeLessThan(endTime - startTime + 10) // 允許小誤差
    })

    test('應該計算成功率', async () => {
      // 處理一個成功事件
      await handler.handle({
        type: 'STORAGE.SAVE.COMPLETED',
        data: {
          flowId: 'success-1',
          result: { success: true, savedCount: 10 }
        },
        metadata: { timestamp: Date.now() }
      })

      // 處理一個失敗事件
      await handler.handle({
        type: 'STORAGE.SAVE.COMPLETED',
        data: {
          flowId: 'failure-1',
          result: { success: false, error: 'Test error' }
        },
        metadata: { timestamp: Date.now() }
      })

      // eslint-disable-next-line no-unused-vars
      const stats = handler.getCompletionStats()
      expect(stats.successRate).toBe(50) // 50% 成功率
    })
  })

  describe('🔧 恢復策略測試', () => {
    beforeEach(() => {
      handler = new StorageCompletionHandler(mockEventBus, mockStorageAdapter)
    })

    test('應該為配額超限錯誤提供清理策略', async () => {
      // eslint-disable-next-line no-unused-vars
      const event = {
        type: 'STORAGE.ERROR',
        data: {
          flowId: 'quota-error',
          error: { type: 'QUOTA_EXCEEDED', message: 'Storage full' },
          context: { storageSize: 5242880 } // 5MB
        },
        metadata: { timestamp: Date.now() }
      }

      await handler.handle(event)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'STORAGE.RECOVERY.REQUESTED',
        expect.objectContaining({
          strategy: 'cleanup',
          actions: expect.arrayContaining(['remove_old_data', 'compress_data'])
        })
      )
    })

    test('應該為網路錯誤提供重試策略', async () => {
      // eslint-disable-next-line no-unused-vars
      const event = {
        type: 'STORAGE.ERROR',
        data: {
          flowId: 'network-error',
          error: { type: 'NETWORK_ERROR', message: 'Connection failed' },
          context: { retryCount: 2 }
        },
        metadata: { timestamp: Date.now() }
      }

      await handler.handle(event)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'STORAGE.RECOVERY.REQUESTED',
        expect.objectContaining({
          strategy: 'retry',
          retryDelay: expect.any(Number),
          maxRetries: expect.any(Number)
        })
      )
    })

    test('應該記錄恢復嘗試統計', async () => {
      // eslint-disable-next-line no-unused-vars
      const event = {
        type: 'STORAGE.ERROR',
        data: {
          flowId: 'recovery-tracking',
          error: { type: 'CORRUPTION_ERROR', message: 'Data corrupted' }
        },
        metadata: { timestamp: Date.now() }
      }

      // eslint-disable-next-line no-unused-vars
      const initialStats = handler.getErrorStats()
      await handler.handle(event)
      // eslint-disable-next-line no-unused-vars
      const updatedStats = handler.getErrorStats()

      expect(updatedStats.recoveryAttempts).toBe(initialStats.recoveryAttempts + 1)
    })
  })
})
