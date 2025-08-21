/**
 * SyncProgressMonitor 單元測試
 * TDD 循環 6: 同步進度監控與作業管理邏輯測試
 */

const SyncProgressMonitor = require('../../../../../../src/background/domains/data-management/services/sync-progress-monitor')

describe('SyncProgressMonitor', () => {
  let monitor
  let mockEventBus
  let mockLogger

  beforeEach(() => {
    // 建立 Mock 物件
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

    // 初始化監控服務
    monitor = new SyncProgressMonitor(mockEventBus, {
      logger: mockLogger,
      config: {
        cleanupInterval: 60000,
        jobRetentionTime: 3600000,
        maxActiveSyncJobs: 5
      }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🏗️ 服務初始化', () => {
    test('應該正確初始化監控服務實例', () => {
      expect(monitor).toBeInstanceOf(SyncProgressMonitor)
      expect(monitor.eventBus).toBe(mockEventBus)
      expect(monitor.logger).toBe(mockLogger)
    })

    test('應該正確初始化同步作業容器', () => {
      expect(monitor.activeSyncJobs).toBeInstanceOf(Map)
      expect(monitor.completedJobs).toBeInstanceOf(Map)
      expect(monitor.activeSyncJobs.size).toBe(0)
      expect(monitor.completedJobs.size).toBe(0)
    })

    test('應該正確合併預設配置', () => {
      expect(monitor.effectiveConfig.cleanupInterval).toBe(60000)
      expect(monitor.effectiveConfig.jobRetentionTime).toBe(3600000)
      expect(monitor.effectiveConfig.maxActiveSyncJobs).toBe(5)
    })
  })

  describe('📊 進度監控功能', () => {
    test('monitorSyncProgress() 應該監控活躍的同步作業', async () => {
      const syncId = 'sync_123'
      const mockJob = {
        syncId,
        status: 'RUNNING',
        progress: 45,
        startTime: Date.now() - 10000,
        totalItems: 100,
        processedItems: 45,
        sourcePlatforms: ['readmoo'],
        targetPlatforms: ['local']
      }

      monitor.activeSyncJobs.set(syncId, mockJob)

      const progress = await monitor.monitorSyncProgress(syncId)

      expect(progress.found).toBe(true)
      expect(progress.syncId).toBe(syncId)
      expect(progress.status).toBe('RUNNING')
      expect(progress.progress).toBe(45)
      expect(progress.duration).toBeGreaterThan(0)
    })

    test('monitorSyncProgress() 應該監控已完成的同步作業', async () => {
      const syncId = 'sync_456'
      const mockJob = {
        syncId,
        status: 'COMPLETED',
        progress: 100,
        startTime: Date.now() - 30000,
        endTime: Date.now() - 5000,
        totalItems: 50,
        processedItems: 50
      }

      monitor.completedJobs.set(syncId, mockJob)

      const progress = await monitor.monitorSyncProgress(syncId)

      expect(progress.found).toBe(true)
      expect(progress.status).toBe('COMPLETED')
      expect(progress.progress).toBe(100)
      expect(progress.endTime).toBe(mockJob.endTime)
    })

    test('monitorSyncProgress() 應該處理找不到作業的情況', async () => {
      const progress = await monitor.monitorSyncProgress('nonexistent')

      expect(progress.found).toBe(false)
      expect(progress.syncId).toBe('nonexistent')
      expect(progress.message).toBe('找不到指定的同步作業')
    })
  })

  describe('⚡ 作業取消功能', () => {
    test('cancelSync() 應該成功取消活躍的同步作業', async () => {
      const syncId = 'sync_789'
      const mockJob = {
        syncId,
        status: 'RUNNING',
        progress: 30,
        startTime: Date.now() - 15000
      }

      monitor.activeSyncJobs.set(syncId, mockJob)

      // Mock 優雅取消方法
      monitor.performGracefulCancellation = jest.fn().mockResolvedValue({
        rollbackInfo: ['reverted change 1'],
        resourcesCleared: ['memory', 'connections']
      })

      const result = await monitor.cancelSync(syncId)

      expect(result.success).toBe(true)
      expect(result.syncId).toBe(syncId)
      expect(result.message).toBe('同步作業已成功取消')
      expect(monitor.performGracefulCancellation).toHaveBeenCalledWith(syncId, mockJob)
    })

    test('cancelSync() 應該處理找不到活躍作業的情況', async () => {
      const result = await monitor.cancelSync('nonexistent')

      expect(result.success).toBe(false)
      expect(result.syncId).toBe('nonexistent')
      expect(result.message).toBe('找不到活躍的同步作業')
    })
  })

  describe('🔄 智能重試功能', () => {
    test('retryFailedSync() 應該重試失敗的同步作業', async () => {
      const syncId = 'sync_failed'
      const failedJob = {
        syncId,
        status: 'FAILED',
        error: 'Network timeout',
        startTime: Date.now() - 60000,
        endTime: Date.now() - 50000
      }

      monitor.completedJobs.set(syncId, failedJob)

      // Mock 智能重試方法
      monitor.performIntelligentRetry = jest.fn().mockResolvedValue({
        newSyncId: 'sync_retry_001',
        result: 'QUEUED_FOR_RETRY',
        strategy: 'EXPONENTIAL_BACKOFF',
        errorAnalysis: {
          errorType: 'NETWORK_ERROR',
          retryRecommended: true,
          estimatedDelay: 30000
        }
      })

      const result = await monitor.retryFailedSync(syncId, { maxRetries: 3 })

      expect(result.success).toBe(true)
      expect(result.originalSyncId).toBe(syncId)
      expect(result.newSyncId).toBe('sync_retry_001')
      expect(result.retryStrategy).toBe('EXPONENTIAL_BACKOFF')
    })

    test('retryFailedSync() 應該處理非失敗作業的重試請求', async () => {
      const syncId = 'sync_success'
      const successJob = {
        syncId,
        status: 'COMPLETED'
      }

      monitor.completedJobs.set(syncId, successJob)

      const result = await monitor.retryFailedSync(syncId)

      expect(result.success).toBe(false)
      expect(result.syncId).toBe(syncId)
      expect(result.message).toBe('找不到失敗的同步作業')
    })
  })

  describe('🏥 健康檢查功能', () => {
    test('healthCheck() 應該返回完整的健康狀態報告', async () => {
      // 設置一些測試資料
      monitor.activeSyncJobs.set('sync1', { status: 'RUNNING' })
      monitor.activeSyncJobs.set('sync2', { status: 'RUNNING' })
      monitor.syncJobQueue = ['job1', 'job2', 'job3']
      monitor.performanceMetrics = {
        successfulSyncs: 10,
        failedSyncs: 2,
        averageProcessingTime: 45000
      }

      const health = await monitor.healthCheck()

      expect(health.isInitialized).toBe(true)
      expect(health.activeSyncJobs).toBe(2)
      expect(health.queuedJobs).toBe(3)
      expect(health.performanceMetrics).toBeDefined()
      expect(health.lastCheck).toBeGreaterThan(0)
    })
  })

  describe('🧹 清理管理功能', () => {
    test('cleanupCompletedJobs() 應該清理過期的已完成作業', () => {
      const currentTime = Date.now()
      const expiredTime = currentTime - 7200000 // 2小時前
      const recentTime = currentTime - 1800000  // 30分鐘前

      // 添加過期和未過期的作業
      monitor.completedJobs.set('expired_job', {
        syncId: 'expired_job',
        status: 'COMPLETED',
        completedAt: expiredTime
      })

      monitor.completedJobs.set('recent_job', {
        syncId: 'recent_job',
        status: 'COMPLETED',
        completedAt: recentTime
      })

      expect(monitor.completedJobs.size).toBe(2)

      monitor.cleanupCompletedJobs()

      expect(monitor.completedJobs.size).toBe(1)
      expect(monitor.completedJobs.has('recent_job')).toBe(true)
      expect(monitor.completedJobs.has('expired_job')).toBe(false)
    })

    test('startCleanupTasks() 應該啟動定時清理任務', () => {
      jest.spyOn(global, 'setInterval')

      monitor.startCleanupTasks()

      expect(setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        monitor.effectiveConfig.cleanupInterval
      )
    })
  })

  describe('📡 事件發送功能', () => {
    test('emitSyncProgressEvent() 應該發送進度更新事件', async () => {
      const syncId = 'sync_progress_test'
      const progress = 75
      const message = '資料處理中'

      await monitor.emitSyncProgressEvent(syncId, progress, message)

      expect(mockEventBus.emit).toHaveBeenCalledWith('DATA.SYNC.PROGRESS', {
        syncId,
        progress,
        message,
        timestamp: expect.any(Number)
      })
    })

    test('應該支援自定義事件發送', async () => {
      const eventType = 'CUSTOM.EVENT'
      const eventData = { key: 'value' }

      await monitor.emitEvent(eventType, eventData)

      expect(mockEventBus.emit).toHaveBeenCalledWith(eventType, eventData)
    })
  })

  describe('⚠️ 錯誤處理', () => {
    test('constructor 應該要求 eventBus 參數', () => {
      expect(() => {
        new SyncProgressMonitor()
      }).toThrow('EventBus is required')
    })

    test('monitorSyncProgress() 應該處理內部錯誤', async () => {
      // 強制觸發內部錯誤
      monitor.activeSyncJobs = null

      await expect(monitor.monitorSyncProgress('test')).rejects.toThrow()
    })

    test('cancelSync() 應該處理取消過程中的錯誤', async () => {
      const syncId = 'sync_error'
      const mockJob = { syncId, status: 'RUNNING' }
      monitor.activeSyncJobs.set(syncId, mockJob)

      monitor.performGracefulCancellation = jest.fn().mockRejectedValue(
        new Error('Cancellation failed')
      )

      await expect(monitor.cancelSync(syncId)).rejects.toThrow('Cancellation failed')
    })
  })

  describe('🔧 配置管理', () => {
    test('應該支援動態配置更新', () => {
      const newConfig = {
        maxActiveSyncJobs: 10,
        jobRetentionTime: 7200000
      }

      monitor.updateConfig(newConfig)

      expect(monitor.effectiveConfig.maxActiveSyncJobs).toBe(10)
      expect(monitor.effectiveConfig.jobRetentionTime).toBe(7200000)
    })

    test('getConfig() 應該返回當前配置', () => {
      const config = monitor.getConfig()
      expect(config).toEqual(monitor.effectiveConfig)
    })
  })
})