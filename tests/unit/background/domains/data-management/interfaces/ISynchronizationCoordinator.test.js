/**
 * ISynchronizationCoordinator 抽象介面測試
 *
 * 測試目標：
 * - 驗證抽象類別不能直接實例化
 * - 確保所有抽象方法都會拋出錯誤
 * - 測試介面契約的完整性
 * - 驗證依賴注入機制
 *
 * @jest-environment jsdom
 */

// eslint-disable-next-line no-unused-vars
const ISynchronizationCoordinator = require('src/background/domains/data-management/interfaces/ISynchronizationCoordinator.js')

describe('ISynchronizationCoordinator 抽象介面測試', () => {
  describe('🔴 Red 階段：抽象介面設計驗證', () => {
    test('應該禁止直接實例化抽象類別', () => {
      // Given: 嘗試直接實例化抽象類別
      // When & Then: 應該拋出錯誤
      expect(() => {
        // eslint-disable-next-line no-unused-vars
        const _coordinator = new ISynchronizationCoordinator()
        // 變數賦值確保建構子結果被正確處理，測試錯誤條件
      }).toThrow(expect.objectContaining({
        code: 'OPERATION_ERROR',
        message: expect.stringContaining('ISynchronizationCoordinator 是抽象類別，不能直接實例化')
      }))
    })

    test('應該支援依賴注入機制', () => {
      // Given: 創建測試實作類別
      class TestSynchronizationCoordinator extends ISynchronizationCoordinator {
      }

      // eslint-disable-next-line no-unused-vars
      const mockLogger = { info: jest.fn(), error: jest.fn() }
      // eslint-disable-next-line no-unused-vars
      const mockStorage = { save: jest.fn(), load: jest.fn() }
      // eslint-disable-next-line no-unused-vars
      const mockValidator = { validate: jest.fn() }
      // eslint-disable-next-line no-unused-vars
      const mockEventBus = { emit: jest.fn(), on: jest.fn() }

      // When: 使用依賴注入創建實例
      // eslint-disable-next-line no-unused-vars
      const coordinator = new TestSynchronizationCoordinator({
        logger: mockLogger,
        storage: mockStorage,
        validator: mockValidator,
        eventBus: mockEventBus
      })

      // Then: 依賴應該正確注入
      expect(coordinator.logger).toBe(mockLogger)
      expect(coordinator.storage).toBe(mockStorage)
      expect(coordinator.validator).toBe(mockValidator)
      expect(coordinator.eventBus).toBe(mockEventBus)
    })

    test('應該提供預設的 logger 依賴', () => {
      // Given: 創建測試實作類別
      class TestSynchronizationCoordinator extends ISynchronizationCoordinator {
      }

      // When: 不提供 logger 依賴
      // eslint-disable-next-line no-unused-vars
      const coordinator = new TestSynchronizationCoordinator({})

      // Then: 應該使用預設的 console
      expect(coordinator.logger).toBe(console)
    })

    test('initializeSync() 應該是抽象方法', async () => {
      // Given: 創建測試實作類別但不實作該方法
      class TestSynchronizationCoordinator extends ISynchronizationCoordinator {
      }

      // eslint-disable-next-line no-unused-vars
      const coordinator = new TestSynchronizationCoordinator()

      // When & Then: 調用未實作的抽象方法應該拋出錯誤
      await expect(coordinator.initializeSync('test-sync-id'))
        .rejects.toMatchObject({
          code: 'OPERATION_ERROR',
          message: expect.stringContaining('initializeSync() 必須在子類別中實作')
        })
    })

    test('executeSync() 應該是抽象方法', async () => {
      // Given: 測試實作類別
      class TestSynchronizationCoordinator extends ISynchronizationCoordinator {
      }

      // eslint-disable-next-line no-unused-vars
      const coordinator = new TestSynchronizationCoordinator()

      // When & Then: 未實作的抽象方法應該拋出錯誤
      await expect(coordinator.executeSync('sync-id', [], [], 'MERGE'))
        .rejects.toMatchObject({
          code: 'OPERATION_ERROR',
          message: expect.stringContaining('executeSync() 必須在子類別中實作')
        })
    })

    test('cancelSync() 應該是抽象方法', async () => {
      // Given: 測試實作類別
      class TestSynchronizationCoordinator extends ISynchronizationCoordinator {
      }

      // eslint-disable-next-line no-unused-vars
      const coordinator = new TestSynchronizationCoordinator()

      // When & Then: 未實作的抽象方法應該拋出錯誤
      await expect(coordinator.cancelSync('sync-id', 'test'))
        .rejects.toMatchObject({
          code: 'OPERATION_ERROR',
          message: expect.stringContaining('cancelSync() 必須在子類別中實作')
        })
    })

    test('getSyncStatus() 應該是抽象方法', async () => {
      // Given: 測試實作類別
      class TestSynchronizationCoordinator extends ISynchronizationCoordinator {
      }

      // eslint-disable-next-line no-unused-vars
      const coordinator = new TestSynchronizationCoordinator()

      // When & Then: 未實作的抽象方法應該拋出錯誤
      await expect(coordinator.getSyncStatus('sync-id'))
        .rejects.toMatchObject({
          code: 'OPERATION_ERROR',
          message: expect.stringContaining('getSyncStatus() 必須在子類別中實作')
        })
    })

    test('getSyncProgress() 應該是抽象方法', async () => {
      // Given: 測試實作類別
      class TestSynchronizationCoordinator extends ISynchronizationCoordinator {
      }

      // eslint-disable-next-line no-unused-vars
      const coordinator = new TestSynchronizationCoordinator()

      // When & Then: 未實作的抽象方法應該拋出錯誤
      await expect(coordinator.getSyncProgress('sync-id'))
        .rejects.toMatchObject({
          code: 'OPERATION_ERROR',
          message: expect.stringContaining('getSyncProgress() 必須在子類別中實作')
        })
    })

    test('cleanupSync() 應該是抽象方法', async () => {
      // Given: 測試實作類別
      class TestSynchronizationCoordinator extends ISynchronizationCoordinator {
      }

      // eslint-disable-next-line no-unused-vars
      const coordinator = new TestSynchronizationCoordinator()

      // When & Then: 未實作的抽象方法應該拋出錯誤
      await expect(coordinator.cleanupSync('sync-id'))
        .rejects.toMatchObject({
          code: 'OPERATION_ERROR',
          message: expect.stringContaining('cleanupSync() 必須在子類別中實作')
        })
    })

    test('getSyncHistory() 應該是抽象方法', async () => {
      // Given: 測試實作類別
      class TestSynchronizationCoordinator extends ISynchronizationCoordinator {
      }

      // eslint-disable-next-line no-unused-vars
      const coordinator = new TestSynchronizationCoordinator()

      // When & Then: 未實作的抽象方法應該拋出錯誤
      await expect(coordinator.getSyncHistory({}))
        .rejects.toMatchObject({
          code: 'OPERATION_ERROR',
          message: expect.stringContaining('getSyncHistory() 必須在子類別中實作')
        })
    })

    test('estimateSyncTime() 應該是抽象方法', async () => {
      // Given: 測試實作類別
      class TestSynchronizationCoordinator extends ISynchronizationCoordinator {
      }

      // eslint-disable-next-line no-unused-vars
      const coordinator = new TestSynchronizationCoordinator()

      // When & Then: 未實作的抽象方法應該拋出錯誤
      await expect(coordinator.estimateSyncTime([], [], 'MERGE'))
        .rejects.toMatchObject({
          code: 'OPERATION_ERROR',
          message: expect.stringContaining('estimateSyncTime() 必須在子類別中實作')
        })
    })

    test('validateSyncParams() 應該是抽象方法', async () => {
      // Given: 測試實作類別
      class TestSynchronizationCoordinator extends ISynchronizationCoordinator {
      }

      // eslint-disable-next-line no-unused-vars
      const coordinator = new TestSynchronizationCoordinator()

      // When & Then: 未實作的抽象方法應該拋出錯誤
      await expect(coordinator.validateSyncParams({}))
        .rejects.toMatchObject({
          code: 'OPERATION_ERROR',
          message: expect.stringContaining('validateSyncParams() 必須在子類別中實作')
        })
    })

    test('dryRun() 應該是抽象方法', async () => {
      // Given: 測試實作類別
      class TestSynchronizationCoordinator extends ISynchronizationCoordinator {
      }

      // eslint-disable-next-line no-unused-vars
      const coordinator = new TestSynchronizationCoordinator()

      // When & Then: 未實作的抽象方法應該拋出錯誤
      await expect(coordinator.dryRun('sync-id', [], [], 'MERGE'))
        .rejects.toMatchObject({
          code: 'OPERATION_ERROR',
          message: expect.stringContaining('dryRun() 必須在子類別中實作')
        })
    })

    test('setProgressCallback() 應該是抽象方法', async () => {
      // Given: 測試實作類別
      class TestSynchronizationCoordinator extends ISynchronizationCoordinator {
      }

      // eslint-disable-next-line no-unused-vars
      const coordinator = new TestSynchronizationCoordinator()

      // When & Then: 未實作的抽象方法應該拋出錯誤
      await expect(coordinator.setProgressCallback('sync-id', jest.fn()))
        .rejects.toMatchObject({
          code: 'OPERATION_ERROR',
          message: expect.stringContaining('setProgressCallback() 必須在子類別中實作')
        })
    })

    test('getSupportedStrategies() 應該是抽象方法', async () => {
      // Given: 測試實作類別
      class TestSynchronizationCoordinator extends ISynchronizationCoordinator {
      }

      // eslint-disable-next-line no-unused-vars
      const coordinator = new TestSynchronizationCoordinator()

      // When & Then: 未實作的抽象方法應該拋出錯誤
      await expect(coordinator.getSupportedStrategies())
        .rejects.toMatchObject({
          code: 'OPERATION_ERROR',
          message: expect.stringContaining('getSupportedStrategies() 必須在子類別中實作')
        })
    })

    test('getSyncStatistics() 應該是抽象方法', async () => {
      // Given: 測試實作類別
      class TestSynchronizationCoordinator extends ISynchronizationCoordinator {
      }

      // eslint-disable-next-line no-unused-vars
      const coordinator = new TestSynchronizationCoordinator()

      // When & Then: 未實作的抽象方法應該拋出錯誤
      await expect(coordinator.getSyncStatistics({}))
        .rejects.toMatchObject({
          code: 'OPERATION_ERROR',
          message: expect.stringContaining('getSyncStatistics() 必須在子類別中實作')
        })
    })
  })

  describe('⚡ 多型和介面合約測試', () => {
    test('應該支援多型實作', () => {
      // Given: 創建兩個不同的實作類別
      class ReadmooSyncCoordinator extends ISynchronizationCoordinator {
        constructor () {
          super()
          this.platform = 'readmoo'
        }
      }

      class KindleSyncCoordinator extends ISynchronizationCoordinator {
        constructor () {
          super()
          this.platform = 'kindle'
        }
      }

      // When: 創建實例
      // eslint-disable-next-line no-unused-vars
      const readmooCoordinator = new ReadmooSyncCoordinator()
      // eslint-disable-next-line no-unused-vars
      const kindleCoordinator = new KindleSyncCoordinator()

      // Then: 應該都是 ISynchronizationCoordinator 的實例
      expect(readmooCoordinator).toBeInstanceOf(ISynchronizationCoordinator)
      expect(kindleCoordinator).toBeInstanceOf(ISynchronizationCoordinator)
      expect(readmooCoordinator.platform).toBe('readmoo')
      expect(kindleCoordinator.platform).toBe('kindle')
    })

    test('應該支援完整的方法實作', async () => {
      // Given: 創建完整實作的測試類別
      class CompleteSyncCoordinator extends ISynchronizationCoordinator {
        async initializeSync () { return { initialized: true } }
        async executeSync () { return { executed: true } }
        async cancelSync () { return true }
        async getSyncStatus () { return { status: 'completed' } }
        async getSyncProgress () { return { progress: 100 } }
        async cleanupSync () { return true }
        async getSyncHistory () { return [] }
        async estimateSyncTime () { return 1000 }
        async validateSyncParams () { return { valid: true } }
        async dryRun () { return { changes: [] } }
        async setProgressCallback () { return true }
        async getSupportedStrategies () { return ['MERGE', 'OVERWRITE'] }
        async getSyncStatistics () { return { totalSyncs: 0 } }
      }

      // eslint-disable-next-line no-unused-vars
      const coordinator = new CompleteSyncCoordinator()

      // When & Then: 所有方法都應該正常執行
      await expect(coordinator.initializeSync()).resolves.toEqual({ initialized: true })
      await expect(coordinator.executeSync()).resolves.toEqual({ executed: true })
      await expect(coordinator.cancelSync()).resolves.toBe(true)
      await expect(coordinator.getSyncStatus()).resolves.toEqual({ status: 'completed' })
      await expect(coordinator.getSyncProgress()).resolves.toEqual({ progress: 100 })
      await expect(coordinator.cleanupSync()).resolves.toBe(true)
      await expect(coordinator.getSyncHistory()).resolves.toEqual([])
      await expect(coordinator.estimateSyncTime()).resolves.toBe(1000)
      await expect(coordinator.validateSyncParams()).resolves.toEqual({ valid: true })
      await expect(coordinator.dryRun()).resolves.toEqual({ changes: [] })
      await expect(coordinator.setProgressCallback()).resolves.toBe(true)
      await expect(coordinator.getSupportedStrategies()).resolves.toEqual(['MERGE', 'OVERWRITE'])
      await expect(coordinator.getSyncStatistics()).resolves.toEqual({ totalSyncs: 0 })
    })
  })
})
