/**
 * SynchronizationOrchestrator 整合測試
 *
 * 測試目標：
 * - 驗證端到端同步流程（executeSyncFlow）串接所有服務
 * - 測試 UC-07 五個替代流程（7a~7e）
 * - 驗證 SyncStrategyProcessor / RetryCoordinator / SyncMetadataManager 整合
 * - 確保服務間通訊和降級機制正確運作
 *
 * @jest-environment jsdom
 */

const SynchronizationOrchestrator = require('src/background/domains/data-management/services/SynchronizationOrchestrator.js')
const { SYNC_STAGES, ALT_FLOW_TYPES } = require('src/background/domains/data-management/services/SynchronizationOrchestrator.js')

describe('SynchronizationOrchestrator 整合測試', () => {
  let orchestrator
  let mockSyncCoordinator
  let mockComparisonEngine
  let mockConflictService
  let mockRetryCoordinator
  let mockStrategyProcessor
  let mockMetadataManager
  let mockLogger

  beforeEach(() => {
    // 靜音 logger 避免測試噪音
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }

    mockSyncCoordinator = {
      syncData: jest.fn(),
      validateDataIntegrity: jest.fn(),
      handleConflicts: jest.fn(),
      getStatistics: jest.fn().mockReturnValue({ totalSync: 0 })
    }

    mockComparisonEngine = {
      calculateDataDifferences: jest.fn(),
      getStatistics: jest.fn().mockReturnValue({ totalComparisons: 0 }),
      updateConfig: jest.fn()
    }

    mockConflictService = {
      detectConflicts: jest.fn(),
      getStatistics: jest.fn().mockReturnValue({ totalConflictsDetected: 0 }),
      updateConfig: jest.fn()
    }

    mockRetryCoordinator = {
      executeRetry: jest.fn(),
      canRetry: jest.fn(),
      isCircuitOpen: jest.fn().mockReturnValue(false),
      getCircuitState: jest.fn().mockReturnValue({ state: 'CLOSED', failureCount: 0 }),
      getRetryStatistics: jest.fn().mockReturnValue({ totalRetries: 0 }),
      updateConfig: jest.fn(),
      resetStatistics: jest.fn()
    }

    // W3-001: SyncStrategyProcessor mock
    mockStrategyProcessor = {
      processStrategy: jest.fn(),
      initialize: jest.fn(),
      getStatus: jest.fn().mockReturnValue({ initialized: true })
    }

    // W3-003: SyncMetadataManager mock
    mockMetadataManager = {
      loadMetadata: jest.fn(),
      saveMetadata: jest.fn(),
      loadUserSettings: jest.fn(),
      saveUserSettings: jest.fn(),
      getStatus: jest.fn().mockReturnValue({ initialized: true })
    }

    orchestrator = new SynchronizationOrchestrator({
      syncCoordinator: mockSyncCoordinator,
      comparisonEngine: mockComparisonEngine,
      conflictService: mockConflictService,
      retryCoordinator: mockRetryCoordinator,
      strategyProcessor: mockStrategyProcessor,
      metadataManager: mockMetadataManager,
      logger: mockLogger
    })
  })

  describe('executeSyncFlow() - UC-07 主要成功場景', () => {
    test('應該按正確順序串接所有同步服務', async () => {
      // Given: 完整的服務和資料配置
      const sourceData = [
        { id: '1', title: 'Book A', progress: 50 },
        { id: '2', title: 'Book B', progress: 75 }
      ]
      const targetData = [
        { id: '1', title: 'Book A', progress: 45 }
      ]

      // 配置各服務的回傳值
      mockMetadataManager.loadMetadata.mockResolvedValue({
        lastSyncTime: Date.now() - 60000
      })

      mockStrategyProcessor.processStrategy.mockResolvedValue({
        strategy: 'timestamp-based',
        decision: 'pull',
        processed: true
      })

      mockComparisonEngine.calculateDataDifferences.mockResolvedValue({
        changes: {
          added: [{ id: '2' }],
          modified: [{ id: '1' }]
        },
        summary: { total: 2, added: 1, modified: 1 }
      })

      mockConflictService.detectConflicts.mockResolvedValue({
        hasConflicts: false,
        items: [],
        severity: 'NONE'
      })

      mockSyncCoordinator.syncData.mockResolvedValue({
        success: true,
        synced: 2
      })

      mockMetadataManager.saveMetadata.mockResolvedValue()

      // When: 執行端到端同步流程
      const result = await orchestrator.executeSyncFlow(sourceData, targetData, {
        remoteTimestamp: new Date().toISOString()
      })

      // Then: 驗證所有服務按順序被呼叫
      expect(mockMetadataManager.loadMetadata).toHaveBeenCalled()
      expect(mockStrategyProcessor.processStrategy).toHaveBeenCalledWith(
        'timestamp-based',
        expect.objectContaining({
          remoteTimestamp: expect.any(String)
        })
      )
      expect(mockComparisonEngine.calculateDataDifferences).toHaveBeenCalledWith(
        sourceData, targetData
      )
      expect(mockConflictService.detectConflicts).toHaveBeenCalled()
      expect(mockSyncCoordinator.syncData).toHaveBeenCalled()
      expect(mockMetadataManager.saveMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          lastSyncTime: expect.any(Number),
          itemsSynced: 2
        })
      )

      // 驗證結果
      expect(result.success).toBe(true)
      expect(result.synchronized).toBe(2)
      expect(result.decision).toBe('pull')
      expect(result.processingTime).toBeGreaterThanOrEqual(0)
    })

    test('策略決定 skip 時應該直接回傳成功而不執行同步', async () => {
      // Given: 策略判斷資料已是最新
      mockMetadataManager.loadMetadata.mockResolvedValue({
        lastSyncTime: Date.now()
      })

      mockStrategyProcessor.processStrategy.mockResolvedValue({
        strategy: 'timestamp-based',
        decision: 'skip',
        processed: true
      })

      // When
      const result = await orchestrator.executeSyncFlow([], [], {})

      // Then: 不應呼叫後續服務
      expect(mockComparisonEngine.calculateDataDifferences).not.toHaveBeenCalled()
      expect(mockSyncCoordinator.syncData).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.decision).toBe('skip')
      expect(result.synchronized).toBe(0)
    })

    test('同步失敗時應該透過 RetryCoordinator 重試', async () => {
      // Given: 同步第一次失敗
      mockMetadataManager.loadMetadata.mockResolvedValue(null)
      mockStrategyProcessor.processStrategy.mockResolvedValue({
        decision: 'pull', processed: true
      })
      mockComparisonEngine.calculateDataDifferences.mockResolvedValue({
        changes: { modified: [{ id: '1' }] },
        summary: { total: 1 }
      })
      mockConflictService.detectConflicts.mockResolvedValue({
        hasConflicts: false, items: [], severity: 'NONE'
      })

      // 第一次失敗
      mockSyncCoordinator.syncData.mockRejectedValueOnce(new Error('Network timeout'))

      // RetryCoordinator 允許重試並成功
      mockRetryCoordinator.canRetry.mockReturnValue(true)
      mockRetryCoordinator.executeRetry.mockResolvedValue({
        success: true,
        result: { synced: 1 },
        retryCount: 1
      })

      // When
      const result = await orchestrator.executeSyncFlow(
        [{ id: '1' }], [{ id: '1' }], {}
      )

      // Then
      expect(mockRetryCoordinator.canRetry).toHaveBeenCalled()
      expect(mockRetryCoordinator.executeRetry).toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.retryCount).toBe(1)
    })

    test('無 strategyProcessor/metadataManager 時應使用預設值（向後相容）', async () => {
      // Given: 不注入新服務
      const basicOrchestrator = new SynchronizationOrchestrator({
        syncCoordinator: mockSyncCoordinator,
        comparisonEngine: mockComparisonEngine,
        conflictService: mockConflictService,
        retryCoordinator: mockRetryCoordinator,
        logger: mockLogger
      })

      mockComparisonEngine.calculateDataDifferences.mockResolvedValue({
        changes: { modified: [] },
        summary: { total: 0 }
      })
      mockConflictService.detectConflicts.mockResolvedValue({
        hasConflicts: false, items: [], severity: 'NONE'
      })
      mockSyncCoordinator.syncData.mockResolvedValue({
        success: true, synced: 0
      })

      // When
      const result = await basicOrchestrator.executeSyncFlow([], [], {})

      // Then: 不應因缺少服務而崩潰
      expect(result.success).toBe(true)
      expect(result.decision).toBe('pull') // 預設決策
    })

    test('偵測到衝突時應走衝突處理流程', async () => {
      // Given
      mockMetadataManager.loadMetadata.mockResolvedValue(null)
      mockStrategyProcessor.processStrategy.mockResolvedValue({
        decision: 'pull', processed: true
      })
      mockComparisonEngine.calculateDataDifferences.mockResolvedValue({
        changes: { modified: [{ id: '1' }] },
        summary: { total: 1 }
      })
      mockConflictService.detectConflicts.mockResolvedValue({
        hasConflicts: true,
        items: [{ id: '1', conflicts: [{ type: 'PROGRESS_MISMATCH' }] }],
        severity: 'HIGH'
      })
      mockSyncCoordinator.handleConflicts.mockResolvedValue({
        success: true,
        resolvedConflicts: 1,
        unresolvedConflicts: 0
      })

      // When
      const result = await orchestrator.executeSyncFlow(
        [{ id: '1', progress: 80 }],
        [{ id: '1', progress: 20 }],
        {}
      )

      // Then
      expect(mockSyncCoordinator.handleConflicts).toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.conflicts).toBe(1)
      expect(result.conflictsResolved).toBe(1)
    })
  })

  describe('UC-07 替代流程 7a: 資料不一致處理', () => {
    test('handleDataInconsistency() 應該降級為 pull 同步', async () => {
      // Given
      mockMetadataManager.loadMetadata.mockResolvedValue({
        lastSyncTime: Date.now() - 60000
      })
      mockStrategyProcessor.processStrategy.mockResolvedValue({
        decision: 'pull', processed: true
      })
      mockComparisonEngine.calculateDataDifferences.mockResolvedValue({
        changes: { modified: [] },
        summary: { total: 0 }
      })
      mockConflictService.detectConflicts.mockResolvedValue({
        hasConflicts: false, items: [], severity: 'NONE'
      })
      mockSyncCoordinator.syncData.mockResolvedValue({
        success: true, synced: 0
      })
      mockMetadataManager.saveMetadata.mockResolvedValue()

      // When
      const result = await orchestrator.handleDataInconsistency(
        [{ id: '1' }], [{ id: '1' }],
        { source: 'readmoo' }
      )

      // Then
      expect(result.altFlow).toBe(ALT_FLOW_TYPES.DATA_INCONSISTENCY)
      expect(result.recovered).toBe(true)
    })

    test('handleDataInconsistency() 應該在驗證失敗時回報錯誤', async () => {
      // When: 使用無效資料
      const result = await orchestrator.handleDataInconsistency(
        'invalid', [],
        {}
      )

      // Then
      expect(result.success).toBe(false)
      expect(result.altFlow).toBe(ALT_FLOW_TYPES.DATA_INCONSISTENCY)
      expect(result.recovered).toBe(false)
    })
  })

  describe('UC-07 替代流程 7b: 衝突處理', () => {
    test('handleConflict() 應該使用衝突解決策略', async () => {
      // Given
      mockStrategyProcessor.processStrategy.mockResolvedValue({
        strategy: 'conflict-resolution',
        decision: 'resolve',
        resolution: { strategy: 'last-write-wins', winner: 'remote' }
      })
      mockSyncCoordinator.handleConflicts.mockResolvedValue({
        success: true,
        resolvedConflicts: 1,
        unresolvedConflicts: 0
      })

      // When
      const result = await orchestrator.handleConflict({
        localVersion: { id: '1', updatedAt: '2026-01-01' },
        remoteVersion: { id: '1', updatedAt: '2026-03-01' },
        items: [{ id: '1' }],
        severity: 'MEDIUM'
      })

      // Then
      expect(result.success).toBe(true)
      expect(result.altFlow).toBe(ALT_FLOW_TYPES.CONFLICT)
      expect(result.resolvedConflicts).toBe(1)
      expect(mockStrategyProcessor.processStrategy).toHaveBeenCalledWith(
        'conflict-resolution',
        expect.objectContaining({
          localVersion: expect.any(Object),
          remoteVersion: expect.any(Object)
        })
      )
    })
  })

  describe('UC-07 替代流程 7c: 網路不穩處理', () => {
    test('handleNetworkInstability() 應該在斷路器開啟時降級', async () => {
      // Given: 斷路器已開啟
      mockRetryCoordinator.isCircuitOpen.mockReturnValue(true)
      mockRetryCoordinator.getCircuitState.mockReturnValue({
        state: 'OPEN',
        failureCount: 5,
        cooldownPeriod: 60000
      })

      // When
      const result = await orchestrator.handleNetworkInstability({
        syncId: 'test_sync',
        error: 'Network error'
      })

      // Then
      expect(result.success).toBe(false)
      expect(result.altFlow).toBe(ALT_FLOW_TYPES.NETWORK_UNSTABLE)
      expect(result.degraded).toBe(true)
      expect(result.circuitState.state).toBe('OPEN')
    })

    test('handleNetworkInstability() 應該透過 RetryCoordinator 重試', async () => {
      // Given: 斷路器關閉，可重試
      mockRetryCoordinator.isCircuitOpen.mockReturnValue(false)
      mockRetryCoordinator.canRetry.mockReturnValue(true)
      mockRetryCoordinator.executeRetry.mockResolvedValue({
        success: true,
        retryCount: 1,
        retryStrategy: 'EXPONENTIAL_BACKOFF'
      })

      // When
      const result = await orchestrator.handleNetworkInstability({
        syncId: 'test_sync',
        error: 'Network timeout',
        retryCount: 0,
        executor: jest.fn().mockResolvedValue({ success: true })
      })

      // Then
      expect(result.success).toBe(true)
      expect(result.altFlow).toBe(ALT_FLOW_TYPES.NETWORK_UNSTABLE)
      expect(result.retryCount).toBe(1)
      expect(result.degraded).toBe(false)
    })
  })

  describe('UC-07 替代流程 7d: 儲存空間不足處理', () => {
    test('handleInsufficientStorage() 應該降級為部分同步', async () => {
      // Given: 混合類型的資料
      const sourceData = [
        { id: '1', type: 'books', title: 'Book A' },
        { id: '2', type: 'books', title: 'Book B' },
        { id: '3', type: 'annotations', content: 'Note 1' },
        { id: '4', type: 'settings', key: 'theme' }
      ]

      // 設置 executeSyncFlow 需要的 mock
      mockMetadataManager.loadMetadata.mockResolvedValue(null)
      mockStrategyProcessor.processStrategy.mockResolvedValue({
        decision: 'pull', processed: true
      })
      mockComparisonEngine.calculateDataDifferences.mockResolvedValue({
        changes: { modified: [] },
        summary: { total: 0 }
      })
      mockConflictService.detectConflicts.mockResolvedValue({
        hasConflicts: false, items: [], severity: 'NONE'
      })
      mockSyncCoordinator.syncData.mockResolvedValue({
        success: true, synced: 2
      })
      mockMetadataManager.saveMetadata.mockResolvedValue()

      // When
      const result = await orchestrator.handleInsufficientStorage(
        { requiredBytes: 10000, availableBytes: 5000 },
        { sourceData, targetData: [] }
      )

      // Then
      expect(result.altFlow).toBe(ALT_FLOW_TYPES.INSUFFICIENT_STORAGE)
      expect(result.partialSync).toBe(true)
      expect(result.skippedItems).toBe(2) // annotations + settings
    })

    test('handleInsufficientStorage() 無資料時應回報錯誤', async () => {
      // When: 不提供資料
      const result = await orchestrator.handleInsufficientStorage(
        { requiredBytes: 10000, availableBytes: 5000 },
        {}
      )

      // Then
      expect(result.success).toBe(false)
      expect(result.altFlow).toBe(ALT_FLOW_TYPES.INSUFFICIENT_STORAGE)
      expect(result.requiredBytes).toBe(10000)
      expect(result.availableBytes).toBe(5000)
    })
  })

  describe('UC-07 替代流程 7e: 服務不可用處理', () => {
    test('handleServiceUnavailable() 應該用降級方案繼續同步', async () => {
      // Given: strategyProcessor 不可用
      mockComparisonEngine.calculateDataDifferences.mockResolvedValue({
        changes: { modified: [] },
        summary: { total: 0 }
      })
      mockConflictService.detectConflicts.mockResolvedValue({
        hasConflicts: false, items: [], severity: 'NONE'
      })
      mockSyncCoordinator.syncData.mockResolvedValue({
        success: true, synced: 0
      })

      // When
      const result = await orchestrator.handleServiceUnavailable(
        { serviceName: 'strategyProcessor' },
        { sourceData: [{ id: '1' }], targetData: [] }
      )

      // Then
      expect(result.altFlow).toBe(ALT_FLOW_TYPES.SERVICE_UNAVAILABLE)
      expect(result.degradedCapabilities).toContain('策略選擇降級為預設 pull')
      expect(result.unavailableService).toBe('strategyProcessor')
      // 原始服務應被恢復
      expect(orchestrator.strategyProcessor).toBe(mockStrategyProcessor)
    })

    test('handleServiceUnavailable() 無資料時應回報錯誤', async () => {
      // When
      const result = await orchestrator.handleServiceUnavailable(
        { serviceName: 'metadataManager' },
        {}
      )

      // Then
      expect(result.success).toBe(false)
      expect(result.altFlow).toBe(ALT_FLOW_TYPES.SERVICE_UNAVAILABLE)
      expect(result.degradedCapabilities).toContain('元資料同步暫停')
    })
  })

  describe('常數匯出驗證', () => {
    test('SYNC_STAGES 應包含所有同步階段', () => {
      expect(SYNC_STAGES.LOAD_METADATA).toBe('LOAD_METADATA')
      expect(SYNC_STAGES.STRATEGY_SELECTION).toBe('STRATEGY_SELECTION')
      expect(SYNC_STAGES.COMPARISON).toBe('COMPARISON')
      expect(SYNC_STAGES.SYNCHRONIZATION).toBe('SYNCHRONIZATION')
      expect(SYNC_STAGES.SAVE_METADATA).toBe('SAVE_METADATA')
    })

    test('ALT_FLOW_TYPES 應包含所有替代流程', () => {
      expect(ALT_FLOW_TYPES.DATA_INCONSISTENCY).toBe('7a')
      expect(ALT_FLOW_TYPES.CONFLICT).toBe('7b')
      expect(ALT_FLOW_TYPES.NETWORK_UNSTABLE).toBe('7c')
      expect(ALT_FLOW_TYPES.INSUFFICIENT_STORAGE).toBe('7d')
      expect(ALT_FLOW_TYPES.SERVICE_UNAVAILABLE).toBe('7e')
    })
  })

  describe('錯誤分類驗證', () => {
    test('executeSyncFlow 失敗時應正確分類替代流程', async () => {
      // Given: 網路錯誤
      mockMetadataManager.loadMetadata.mockResolvedValue(null)
      mockStrategyProcessor.processStrategy.mockResolvedValue({
        decision: 'pull', processed: true
      })
      mockComparisonEngine.calculateDataDifferences.mockRejectedValue(
        new Error('Network connection timeout')
      )

      // When
      const result = await orchestrator.executeSyncFlow(
        [{ id: '1' }], [], {}
      )

      // Then
      expect(result.success).toBe(false)
      expect(result.altFlow).toBe(ALT_FLOW_TYPES.NETWORK_UNSTABLE)
      expect(result.stage).toBe(SYNC_STAGES.COMPARISON)
    })
  })
})
