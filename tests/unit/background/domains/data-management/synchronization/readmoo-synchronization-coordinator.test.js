/**
 * ReadmooSynchronizationCoordinator TDD 測試
 * 
 * 測試目標：Readmoo 平台專用同步協調器實作
 * 覆蓋範圍：
 * - 同步協調器基礎實作
 * - Readmoo 特定的同步邏輯
 * - 抽象介面合規性驗證
 * - 錯誤處理和重試機制
 * 
 * @version 1.0.0
 * @since 2025-08-19
 */

const ReadmooSynchronizationCoordinator = require('../../../../../../src/background/domains/data-management/synchronization/readmoo-synchronization-coordinator.js')
const ISynchronizationCoordinator = require('../../../../../../src/background/domains/data-management/interfaces/ISynchronizationCoordinator.js')

describe('ReadmooSynchronizationCoordinator TDD 實作', () => {
  let coordinator
  let mockEventBus
  let mockDependencies

  beforeEach(() => {
    // Mock 事件總線
    mockEventBus = {
      emit: jest.fn().mockResolvedValue([]),
      on: jest.fn(),
      off: jest.fn(),
      hasListener: jest.fn().mockReturnValue(false),
      getListenerCount: jest.fn().mockReturnValue(0)
    }

    // Mock 依賴項目
    mockDependencies = {
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      },
      storage: {
        get: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue(true),
        remove: jest.fn().mockResolvedValue(true)
      },
      validator: {
        validateBookData: jest.fn().mockResolvedValue({ isValid: true, issues: [] }),
        sanitizeData: jest.fn().mockImplementation(data => data)
      }
    }

    coordinator = new ReadmooSynchronizationCoordinator(mockEventBus, mockDependencies)
    jest.clearAllMocks()
  })

  afterEach(() => {
    if (coordinator && coordinator.cleanup) {
      coordinator.cleanup()
    }
  })

  describe('🏗️ 基礎架構實作', () => {
    test('應該正確實作 ISynchronizationCoordinator 介面', () => {
      // 驗證類別繼承
      expect(coordinator).toBeInstanceOf(ISynchronizationCoordinator)

      // 驗證必要方法實作
      const requiredMethods = [
        'initializeSync', 'executeSync', 'cancelSync',
        'getActiveSyncs', 'getSyncStatus', 'getSyncProgress',
        'getSyncHistory', 'updateSyncConfiguration'
      ]

      requiredMethods.forEach(method => {
        expect(typeof coordinator[method]).toBe('function')
      })
    })

    test('應該正確初始化協調器狀態', () => {
      expect(coordinator.eventBus).toBe(mockEventBus)
      expect(coordinator.logger).toBe(mockDependencies.logger)
      expect(coordinator.storage).toBe(mockDependencies.storage)
      expect(coordinator.validator).toBe(mockDependencies.validator)

      // 驗證內部狀態初始化
      expect(coordinator.activeSyncs).toBeDefined()
      expect(coordinator.syncQueue).toBeDefined()
      expect(coordinator.completedSyncs).toBeDefined()
    })

    test('應該支援配置自訂', () => {
      const customConfig = {
        batchSize: 100,
        retryAttempts: 5,
        syncInterval: 30000
      }

      const customCoordinator = new ReadmooSynchronizationCoordinator(
        mockEventBus, 
        { ...mockDependencies, config: customConfig }
      )

      expect(customCoordinator.config.batchSize).toBe(100)
      expect(customCoordinator.config.retryAttempts).toBe(5)
      expect(customCoordinator.config.syncInterval).toBe(30000)
    })
  })

  describe('🔄 同步作業初始化', () => {
    test('應該成功初始化 Readmoo 同步作業', async () => {
      const syncRequest = {
        syncId: 'readmoo-sync-001',
        sourceType: 'readmoo',
        targetType: 'local',
        scope: ['books', 'reading-progress'],
        strategy: 'SMART_MERGE'
      }

      const result = await coordinator.initializeSync(syncRequest)

      expect(result).toEqual({
        syncId: 'readmoo-sync-001',
        status: 'INITIALIZED',
        estimatedDuration: expect.any(Number)
      })

      expect(coordinator.activeSyncs.has('readmoo-sync-001')).toBe(true)
    })

    test('應該驗證同步請求參數', async () => {
      const invalidRequest = {
        // 缺少必要欄位
        sourceType: 'readmoo'
      }

      await expect(coordinator.initializeSync(invalidRequest))
        .rejects
        .toThrow('同步請求參數不完整')
    })

    test('應該防止重複的同步作業', async () => {
      const syncRequest = {
        syncId: 'readmoo-sync-duplicate',
        sourceType: 'readmoo',
        targetType: 'local',
        scope: ['books'],
        strategy: 'MERGE'
      }

      // 第一次初始化
      await coordinator.initializeSync(syncRequest)

      // 第二次初始化應該失敗
      await expect(coordinator.initializeSync(syncRequest))
        .rejects
        .toThrow('同步作業已存在')
    })

    test('應該正確設定預估完成時間', async () => {
      const syncRequest = {
        syncId: 'readmoo-sync-estimate',
        sourceType: 'readmoo',
        targetType: 'local',
        scope: ['books', 'reading-progress', 'bookmarks'],
        strategy: 'OVERWRITE'
      }

      const result = await coordinator.initializeSync(syncRequest)

      // 預估時間應該根據同步範圍調整
      expect(result.estimatedDuration).toBeGreaterThan(0)
      expect(result.estimatedDuration).toBeLessThan(300000) // 最多5分鐘
    })
  })

  describe('⚡ 同步作業執行', () => {
    let syncJob

    beforeEach(() => {
      syncJob = {
        jobId: 'readmoo-job-001',
        syncId: 'readmoo-sync-001',
        data: {
          books: [
            {
              bookId: 'book-1',
              title: '測試書籍 1',
              author: '測試作者',
              progress: 50
            }
          ]
        },
        options: {
          dryRun: false,
          batchSize: 50,
          priority: 'normal'
        }
      }
    })

    test('應該成功執行 Readmoo 同步作業', async () => {
      // 先初始化同步作業
      await coordinator.initializeSync({
        syncId: 'readmoo-sync-001',
        sourceType: 'readmoo',
        targetType: 'local',
        scope: ['books'],
        strategy: 'MERGE'
      })

      const result = await coordinator.executeSync(syncJob)

      expect(result).toEqual({
        jobId: 'readmoo-job-001',
        status: 'COMPLETED',
        processedRecords: 1,
        errors: []
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'SYNC.READMOO.COMPLETED',
        expect.objectContaining({
          jobId: 'readmoo-job-001',
          processedRecords: 1
        })
      )
    })

    test('應該支援乾執行模式', async () => {
      await coordinator.initializeSync({
        syncId: 'readmoo-sync-001',
        sourceType: 'readmoo',
        targetType: 'local',
        scope: ['books'],
        strategy: 'MERGE'
      })

      syncJob.options.dryRun = true

      const result = await coordinator.executeSync(syncJob)

      expect(result.status).toBe('DRY_RUN_COMPLETED')
      expect(mockDependencies.storage.set).not.toHaveBeenCalled()
    })

    test('應該正確處理批次資料', async () => {
      await coordinator.initializeSync({
        syncId: 'readmoo-sync-001',
        sourceType: 'readmoo',
        targetType: 'local',
        scope: ['books'],
        strategy: 'MERGE'
      })

      // 建立大批資料
      const largeBatch = []
      for (let i = 0; i < 100; i++) {
        largeBatch.push({
          bookId: `book-${i}`,
          title: `測試書籍 ${i}`,
          author: '批次作者',
          progress: Math.floor(Math.random() * 100)
        })
      }

      syncJob.data.books = largeBatch
      syncJob.options.batchSize = 25

      const result = await coordinator.executeSync(syncJob)

      expect(result.processedRecords).toBe(100)
      expect(result.status).toBe('COMPLETED')
    })

    test('應該處理同步過程中的錯誤', async () => {
      await coordinator.initializeSync({
        syncId: 'readmoo-sync-001',
        sourceType: 'readmoo',
        targetType: 'local',
        scope: ['books'],
        strategy: 'MERGE'
      })

      // 模擬儲存錯誤
      mockDependencies.storage.set.mockRejectedValue(new Error('儲存失敗'))

      const result = await coordinator.executeSync(syncJob)

      expect(result.status).toBe('PARTIAL_SUCCESS')
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('🛑 同步作業取消', () => {
    test('應該成功取消進行中的同步作業', async () => {
      await coordinator.initializeSync({
        syncId: 'readmoo-sync-cancel',
        sourceType: 'readmoo',
        targetType: 'local',
        scope: ['books'],
        strategy: 'MERGE'
      })

      const result = await coordinator.cancelSync('readmoo-sync-cancel', 'USER_CANCELLED')

      expect(result).toEqual({
        syncId: 'readmoo-sync-cancel',
        status: 'CANCELLED',
        cancelledAt: expect.any(Number)
      })

      expect(coordinator.activeSyncs.has('readmoo-sync-cancel')).toBe(false)
    })

    test('應該處理取消不存在的同步作業', async () => {
      await expect(coordinator.cancelSync('nonexistent-sync'))
        .rejects
        .toThrow('同步作業不存在')
    })

    test('應該清理取消作業的相關資源', async () => {
      await coordinator.initializeSync({
        syncId: 'readmoo-sync-cleanup',
        sourceType: 'readmoo',
        targetType: 'local',
        scope: ['books'],
        strategy: 'MERGE'
      })

      await coordinator.cancelSync('readmoo-sync-cleanup')

      // 驗證事件發布
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'SYNC.READMOO.CANCELLED',
        expect.objectContaining({
          syncId: 'readmoo-sync-cleanup'
        })
      )
    })
  })

  describe('📊 同步狀態管理', () => {
    test('應該正確回報活躍同步作業', async () => {
      await coordinator.initializeSync({
        syncId: 'readmoo-sync-active-1',
        sourceType: 'readmoo',
        targetType: 'local',
        scope: ['books'],
        strategy: 'MERGE'
      })

      await coordinator.initializeSync({
        syncId: 'readmoo-sync-active-2',
        sourceType: 'readmoo',
        targetType: 'local',
        scope: ['reading-progress'],
        strategy: 'OVERWRITE'
      })

      const activeSyncs = await coordinator.getActiveSyncs()

      expect(activeSyncs).toHaveLength(2)
      expect(activeSyncs[0]).toMatchObject({
        syncId: 'readmoo-sync-active-1',
        status: 'INITIALIZED'
      })
      expect(activeSyncs[1]).toMatchObject({
        syncId: 'readmoo-sync-active-2',
        status: 'INITIALIZED'
      })
    })

    test('應該支援同步作業篩選', async () => {
      await coordinator.initializeSync({
        syncId: 'readmoo-sync-books',
        sourceType: 'readmoo',
        targetType: 'local',
        scope: ['books'],
        strategy: 'MERGE'
      })

      const filter = { sourceType: 'readmoo', status: 'INITIALIZED' }
      const filteredSyncs = await coordinator.getActiveSyncs(filter)

      expect(filteredSyncs).toHaveLength(1)
      expect(filteredSyncs[0].syncId).toBe('readmoo-sync-books')
    })

    test('應該正確回報同步狀態', async () => {
      await coordinator.initializeSync({
        syncId: 'readmoo-sync-status',
        sourceType: 'readmoo',
        targetType: 'local',
        scope: ['books'],
        strategy: 'MERGE'
      })

      const status = await coordinator.getSyncStatus('readmoo-sync-status')

      expect(status).toEqual({
        syncId: 'readmoo-sync-status',
        status: 'INITIALIZED',
        progress: 0,
        currentPhase: 'INITIALIZING'
      })
    })

    test('應該正確回報同步進度', async () => {
      await coordinator.initializeSync({
        syncId: 'readmoo-sync-progress',
        sourceType: 'readmoo',
        targetType: 'local',
        scope: ['books'],
        strategy: 'MERGE'
      })

      const progress = await coordinator.getSyncProgress('readmoo-sync-progress')

      expect(progress).toEqual({
        syncId: 'readmoo-sync-progress',
        progress: 0,
        eta: expect.any(Number),
        processedRecords: 0
      })
    })
  })

  describe('📚 同步歷史管理', () => {
    test('應該記錄完成的同步作業', async () => {
      // 執行完整同步流程
      await coordinator.initializeSync({
        syncId: 'readmoo-sync-history',
        sourceType: 'readmoo',
        targetType: 'local',
        scope: ['books'],
        strategy: 'MERGE'
      })

      await coordinator.executeSync({
        jobId: 'job-history',
        syncId: 'readmoo-sync-history',
        data: { books: [] },
        options: {}
      })

      const history = await coordinator.getSyncHistory()

      expect(history).toHaveLength(1)
      expect(history[0]).toMatchObject({
        syncId: 'readmoo-sync-history',
        status: 'COMPLETED',
        completedAt: expect.any(Number)
      })
    })

    test('應該支援歷史記錄篩選', async () => {
      // 建立多個歷史記錄
      const syncs = ['sync-1', 'sync-2', 'sync-3']
      for (const syncId of syncs) {
        await coordinator.initializeSync({
          syncId,
          sourceType: 'readmoo',
          targetType: 'local',
          scope: ['books'],
          strategy: 'MERGE'
        })
        await coordinator.executeSync({
          jobId: `job-${syncId}`,
          syncId,
          data: { books: [] },
          options: {}
        })
      }

      const filter = { limit: 2, status: 'COMPLETED' }
      const history = await coordinator.getSyncHistory(filter)

      expect(history).toHaveLength(2)
    })
  })

  describe('⚙️ 配置管理', () => {
    test('應該支援配置更新', async () => {
      const newConfig = {
        batchSize: 200,
        retryAttempts: 10,
        syncTimeout: 60000
      }

      const result = await coordinator.updateSyncConfiguration(newConfig)

      expect(result).toEqual({ updated: true, config: newConfig })
      expect(coordinator.config.batchSize).toBe(200)
    })

    test('應該驗證配置參數', async () => {
      const invalidConfig = {
        batchSize: -10, // 無效值
        retryAttempts: 'invalid'
      }

      await expect(coordinator.updateSyncConfiguration(invalidConfig))
        .rejects
        .toThrow('無效的配置參數')
    })
  })

  describe('💾 資源清理', () => {
    test('應該正確清理協調器資源', () => {
      expect(() => coordinator.cleanup()).not.toThrow()

      // 驗證清理後狀態
      expect(coordinator.activeSyncs.size).toBe(0)
      expect(coordinator.syncQueue.length).toBe(0)
    })

    test('應該支援強制清理模式', () => {
      // 建立一些活躍同步
      coordinator.activeSyncs.set('test-sync', { status: 'RUNNING' })

      coordinator.cleanup(true) // 強制清理

      expect(coordinator.activeSyncs.size).toBe(0)
    })
  })
})