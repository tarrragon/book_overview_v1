/**
 * SynchronizationOrchestrator 測試
 *
 * 測試目標：
 * - 驗證同步協調器的統籌管理功能
 * - 測試多重服務依賴的整合協調
 * - 確保智能同步策略的選擇和執行
 * - 驗證錯誤處理和失敗恢復機制
 *
 * @jest-environment jsdom
 */

const SynchronizationOrchestrator = require('../../../../../../src/background/domains/data-management/services/SynchronizationOrchestrator.js')
const ISynchronizationCoordinator = require('../../../../../../src/background/domains/data-management/interfaces/ISynchronizationCoordinator.js')
const DataComparisonEngine = require('../../../../../../src/background/domains/data-management/services/DataComparisonEngine.js')
const ConflictDetectionService = require('../../../../../../src/background/domains/data-management/services/ConflictDetectionService.js')
const RetryCoordinator = require('../../../../../../src/background/domains/data-management/services/RetryCoordinator.js')

describe('SynchronizationOrchestrator TDD 測試', () => {
  let orchestrator
  let mockSyncCoordinator
  let mockComparisonEngine
  let mockConflictService
  let mockRetryCoordinator

  beforeEach(() => {
    // 建立 mock 依賴服務
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
      getRetryStatistics: jest.fn().mockReturnValue({ totalRetries: 0 }),
      updateConfig: jest.fn()
    }

    // 建立協調器實例
    orchestrator = new SynchronizationOrchestrator({
      syncCoordinator: mockSyncCoordinator,
      comparisonEngine: mockComparisonEngine,
      conflictService: mockConflictService,
      retryCoordinator: mockRetryCoordinator
    })
  })

  describe('🔴 Red 階段：基礎功能驗證', () => {
    test('應該正確初始化同步協調器', () => {
      // Given: 預設配置
      const defaultOrchestrator = new SynchronizationOrchestrator()

      // Then: 應該正確設置預設值
      expect(defaultOrchestrator.config.enableConflictDetection).toBe(true)
      expect(defaultOrchestrator.config.enableRetryMechanism).toBe(true)
      expect(defaultOrchestrator.config.maxSyncAttempts).toBe(3)
      expect(defaultOrchestrator.isInitialized).toBe(true)
    })

    test('應該支援自訂依賴注入', () => {
      // Given: 自訂依賴的協調器
      const customOrchestrator = new SynchronizationOrchestrator({
        syncCoordinator: mockSyncCoordinator,
        comparisonEngine: mockComparisonEngine,
        conflictService: mockConflictService,
        retryCoordinator: mockRetryCoordinator,
        enableSmartSync: true,
        maxConcurrentJobs: 5
      })

      // Then: 應該使用注入的依賴
      expect(customOrchestrator.syncCoordinator).toBe(mockSyncCoordinator)
      expect(customOrchestrator.comparisonEngine).toBe(mockComparisonEngine)
      expect(customOrchestrator.conflictService).toBe(mockConflictService)
      expect(customOrchestrator.retryCoordinator).toBe(mockRetryCoordinator)
      expect(customOrchestrator.config.enableSmartSync).toBe(true)
      expect(customOrchestrator.config.maxConcurrentJobs).toBe(5)
    })

    test('orchestrateSync() 應該執行完整的同步流程', async () => {
      // Given: 基本同步資料和配置
      const sourceData = [
        { id: '1', title: 'Book A', progress: 50 },
        { id: '2', title: 'Book B', progress: 75 }
      ]
      const targetData = [
        { id: '1', title: 'Book A', progress: 45 }
      ]
      const options = { source: 'readmoo', target: 'local' }

      // Mock 預期行為
      mockComparisonEngine.calculateDataDifferences.mockResolvedValue({
        changes: {
          added: [{ id: '2', data: { title: 'Book B', progress: 75 } }],
          modified: [{ id: '1', data: { progress: 50 }, fieldChanges: { progress: { source: 50, target: 45 } } }],
          deleted: [],
          unchanged: []
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
        synced: 2,
        conflicts: 0
      })

      // When: 執行協調同步
      const result = await orchestrator.orchestrateSync(sourceData, targetData, options)

      // Then: 應該執行完整流程
      expect(mockComparisonEngine.calculateDataDifferences).toHaveBeenCalledWith(sourceData, targetData)
      expect(mockConflictService.detectConflicts).toHaveBeenCalled()
      expect(mockSyncCoordinator.syncData).toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.synchronized).toBe(2)
      expect(result.conflicts).toBe(0)
    })

    test('orchestrateSync() 應該處理有衝突的同步', async () => {
      // Given: 有衝突的資料
      const sourceData = [{ id: '1', title: 'Book A', progress: 80 }]
      const targetData = [{ id: '1', title: 'Book A', progress: 20 }]
      const options = { source: 'readmoo', target: 'local' }

      // Mock 衝突檢測
      mockComparisonEngine.calculateDataDifferences.mockResolvedValue({
        changes: {
          modified: [{
            id: '1',
            fieldChanges: { progress: { source: 80, target: 20 } }
          }]
        },
        summary: { total: 1, modified: 1 }
      })

      mockConflictService.detectConflicts.mockResolvedValue({
        hasConflicts: true,
        items: [{
          id: '1',
          conflicts: [{
            type: 'PROGRESS_MISMATCH',
            severity: 'HIGH',
            autoResolvable: false
          }]
        }],
        severity: 'HIGH',
        autoResolvable: false
      })

      mockSyncCoordinator.handleConflicts.mockResolvedValue({
        success: true,
        resolvedConflicts: 1,
        unresolvedConflicts: 0
      })

      // When: 執行協調同步
      const result = await orchestrator.orchestrateSync(sourceData, targetData, options)

      // Then: 應該處理衝突
      expect(mockConflictService.detectConflicts).toHaveBeenCalled()
      expect(mockSyncCoordinator.handleConflicts).toHaveBeenCalled()
      expect(result.conflicts).toBe(1)
      expect(result.conflictsResolved).toBe(1)
    })

    test('executeIntelligentSync() 應該選擇適當的同步策略', async () => {
      // Given: 不同複雜度的同步場景
      const simpleChanges = {
        changes: { modified: [{ id: '1' }] },
        summary: { total: 1 }
      }
      const complexChanges = {
        changes: {
          modified: Array.from({ length: 50 }, (_, i) => ({ id: `${i}` }))
        },
        summary: { total: 50 }
      }

      // When: 執行智能同步
      const simpleStrategy = orchestrator.executeIntelligentSync(simpleChanges, { hasConflicts: false })
      const complexStrategy = orchestrator.executeIntelligentSync(complexChanges, { hasConflicts: true })

      // Then: 應該選擇不同策略
      expect(simpleStrategy.strategy).toBe('STANDARD_SYNC')
      expect(complexStrategy.strategy).toBe('BATCH_SYNC')
    })

    test('handleSyncWithRetry() 應該在失敗時執行重試', async () => {
      // Given: 會失敗的同步作業
      const syncJob = {
        id: 'sync_retry_test',
        sourceData: [{ id: '1' }],
        targetData: [{ id: '1' }],
        options: { source: 'readmoo' }
      }

      // Mock 第一次失敗，重試成功
      mockSyncCoordinator.syncData
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({ success: true, synced: 1 })

      mockRetryCoordinator.canRetry.mockReturnValue(true)
      mockRetryCoordinator.executeRetry.mockResolvedValue({
        success: true,
        result: { success: true, synced: 1 },
        retryCount: 1
      })

      // When: 執行帶重試的同步
      const result = await orchestrator.handleSyncWithRetry(syncJob)

      // Then: 應該執行重試並成功
      expect(mockRetryCoordinator.canRetry).toHaveBeenCalled()
      expect(mockRetryCoordinator.executeRetry).toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.retryCount).toBe(1)
    })

    test('optimizeSyncPerformance() 應該動態調整配置', () => {
      // Given: 不同的同步統計
      const lightStats = {
        totalSync: 10,
        averageProcessingTime: 500,
        conflictRate: 0.1
      }
      const heavyStats = {
        totalSync: 100,
        averageProcessingTime: 2000,
        conflictRate: 0.5
      }

      // When: 執行效能優化
      const lightOptimization = orchestrator.optimizeSyncPerformance(lightStats)
      const heavyOptimization = orchestrator.optimizeSyncPerformance(heavyStats)

      // Then: 應該給出不同的優化建議
      expect(lightOptimization.batchSize).toBeGreaterThan(heavyOptimization.batchSize)
      expect(lightOptimization.enableParallelProcessing).toBe(true)
      expect(heavyOptimization.conflictDetectionLevel).toBe('ENHANCED')
    })

    test('validateSyncPrerequisites() 應該檢查同步前置條件', () => {
      // Given: 不同的輸入條件
      const validData = {
        sourceData: [{ id: '1' }],
        targetData: [{ id: '2' }],
        options: { source: 'readmoo' }
      }
      const invalidData = {
        sourceData: 'invalid',
        targetData: [],
        options: {}
      }

      // When: 檢查前置條件
      const validResult = orchestrator.validateSyncPrerequisites(validData)
      const invalidResult = orchestrator.validateSyncPrerequisites(invalidData)

      // Then: 應該正確驗證
      expect(validResult.isValid).toBe(true)
      expect(validResult.errors).toHaveLength(0)
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.errors).toContain('Source data must be an array')
    })

    test('generateSyncReport() 應該生成詳細的同步報告', () => {
      // Given: 完整的同步結果
      const syncResults = {
        success: true,
        synchronized: 15,
        conflicts: 2,
        conflictsResolved: 1,
        processingTime: 2500,
        strategy: 'BATCH_SYNC',
        retryCount: 1
      }
      const syncStats = {
        comparisonStats: { totalComparisons: 15 },
        conflictStats: { totalConflictsDetected: 2 },
        retryStats: { totalRetries: 1 }
      }

      // When: 生成同步報告
      const report = orchestrator.generateSyncReport(syncResults, syncStats)

      // Then: 應該包含完整資訊
      expect(report.summary.totalItems).toBe(15)
      expect(report.summary.conflictRate).toBe(2 / 15)
      expect(report.performance.processingTimeMs).toBe(2500)
      expect(report.performance.strategy).toBe('BATCH_SYNC')
      expect(report.reliability.retryCount).toBe(1)
      expect(report.recommendations).toBeDefined()
    })
  })

  describe('⚙️ 服務管理和配置測試', () => {
    test('initializeServices() 應該正確初始化所有服務', () => {
      // Given: 未初始化的協調器
      const uninitializedOrchestrator = new SynchronizationOrchestrator()

      // When: 初始化服務
      uninitializedOrchestrator.initializeServices({
        enableConflictDetection: false,
        customRetryConfig: { maxRetries: 5 }
      })

      // Then: 應該正確初始化
      expect(uninitializedOrchestrator.syncCoordinator).toBeDefined()
      expect(uninitializedOrchestrator.comparisonEngine).toBeDefined()
      expect(uninitializedOrchestrator.conflictService).toBeDefined()
      expect(uninitializedOrchestrator.retryCoordinator).toBeDefined()
    })

    test('updateServiceConfigs() 應該同步更新所有服務配置', () => {
      // Given: 新的配置設定
      const newConfig = {
        batchSize: 150,
        conflictDetectionThreshold: 0.7,
        maxRetryAttempts: 5,
        enableIntelligentSync: true
      }

      // When: 更新服務配置
      orchestrator.updateServiceConfigs(newConfig)

      // Then: 應該更新所有服務
      expect(mockComparisonEngine.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ batchSize: 150 })
      )
      expect(mockConflictService.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ conflictDetectionThreshold: 0.7 })
      )
      expect(mockRetryCoordinator.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ maxRetryAttempts: 5 })
      )
    })

    test('getAggregatedStatistics() 應該彙總所有服務的統計資訊', () => {
      // Given: 設定協調器的統計
      orchestrator.stats.totalOrchestrations = 10
      orchestrator.stats.successfulSyncs = 8

      // 各服務的統計資料
      mockComparisonEngine.getStatistics.mockReturnValue({
        totalComparisons: 100,
        totalProcessingTime: 5000
      })
      mockConflictService.getStatistics.mockReturnValue({
        totalConflictsDetected: 20,
        resolvedConflicts: 18
      })
      mockRetryCoordinator.getRetryStatistics.mockReturnValue({
        totalRetries: 5,
        successfulRetries: 4
      })

      // When: 獲取彙總統計
      const stats = orchestrator.getAggregatedStatistics()

      // Then: 應該包含所有服務的統計
      expect(stats.comparison.totalComparisons).toBe(100)
      expect(stats.conflicts.totalConflictsDetected).toBe(20)
      expect(stats.retry.totalRetries).toBe(5)
      expect(stats.overall.successRate).toBeGreaterThan(0)
    })

    test('resetAllStatistics() 應該重置所有服務的統計', () => {
      // Given: 有統計資料的服務
      mockComparisonEngine.resetStatistics = jest.fn()
      mockConflictService.resetStatistics = jest.fn()
      mockRetryCoordinator.resetStatistics = jest.fn()

      // When: 重置統計
      orchestrator.resetAllStatistics()

      // Then: 應該重置所有服務統計
      expect(mockComparisonEngine.resetStatistics).toHaveBeenCalled()
      expect(mockConflictService.resetStatistics).toHaveBeenCalled()
      expect(mockRetryCoordinator.resetStatistics).toHaveBeenCalled()
    })
  })

  describe('🔍 錯誤處理和邊界條件測試', () => {
    test('orchestrateSync() 應該優雅處理服務失敗', async () => {
      // Given: 比較引擎失敗
      const sourceData = [{ id: '1' }]
      const targetData = [{ id: '1' }]

      mockComparisonEngine.calculateDataDifferences.mockRejectedValue(
        new Error('Comparison engine failure')
      )

      // When: 執行同步
      const result = await orchestrator.orchestrateSync(sourceData, targetData, {})

      // Then: 應該優雅處理錯誤
      expect(result.success).toBe(false)
      expect(result.error).toContain('Comparison engine failure')
      expect(result.stage).toBe('COMPARISON')
    })

    test('應該處理無效的依賴注入', () => {
      // Given: 無效的依賴
      const invalidDependencies = {
        syncCoordinator: null,
        comparisonEngine: 'invalid',
        conflictService: undefined
      }

      // When: 建立協調器
      const invalidOrchestrator = new SynchronizationOrchestrator(invalidDependencies)

      // Then: 應該使用預設服務
      expect(invalidOrchestrator.syncCoordinator).toBeDefined()
      expect(invalidOrchestrator.comparisonEngine).toBeDefined()
      expect(invalidOrchestrator.conflictService).toBeDefined()
    })

    test('handleSyncWithRetry() 應該處理重試失敗', async () => {
      // Given: 重試也失敗的作業
      const syncJob = {
        id: 'failing_job',
        retryCount: 3,
        error: 'Persistent error'
      }

      mockRetryCoordinator.canRetry.mockReturnValue(false)

      // When: 嘗試重試
      const result = await orchestrator.handleSyncWithRetry(syncJob)

      // Then: 應該回傳失敗結果
      expect(result.success).toBe(false)
      expect(result.error).toContain('Maximum retries exceeded')
      expect(mockRetryCoordinator.executeRetry).not.toHaveBeenCalled()
    })

    test('validateSyncPrerequisites() 應該處理邊界條件', () => {
      // Given: 邊界條件測試案例
      const emptyData = {
        sourceData: [],
        targetData: [],
        options: { source: 'readmoo' }
      }
      const missingOptions = {
        sourceData: [{ id: '1' }],
        targetData: [{ id: '1' }],
        options: null
      }

      // When: 驗證邊界條件
      const emptyResult = orchestrator.validateSyncPrerequisites(emptyData)
      const missingResult = orchestrator.validateSyncPrerequisites(missingOptions)

      // Then: 應該正確處理
      expect(emptyResult.isValid).toBe(true) // 空資料也是有效的
      expect(emptyResult.warnings).toContain('Empty data sets detected')
      expect(missingResult.isValid).toBe(false)
      expect(missingResult.errors).toContain('Sync options are required')
    })

    test('應該處理大量資料的同步', async () => {
      // Given: 大量資料
      const largeSourceData = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        title: `Book ${i}`
      }))
      const largeTargetData = Array.from({ length: 800 }, (_, i) => ({
        id: `${i}`,
        title: `Book ${i}`
      }))

      // Mock 批次處理
      mockComparisonEngine.calculateDataDifferences.mockResolvedValueOnce({
        changes: { added: Array.from({ length: 200 }, (_, i) => ({ id: `${800 + i}` })) },
        summary: { total: 1000, added: 200 }
      })

      mockConflictService.detectConflicts.mockResolvedValueOnce({
        hasConflicts: false,
        items: [],
        severity: 'NONE'
      })

      mockSyncCoordinator.syncData.mockResolvedValueOnce({
        success: true,
        synced: 200
      })

      // When: 處理大量資料
      const result = await orchestrator.orchestrateSync(largeSourceData, largeTargetData, {
        enableBatchProcessing: true
      })

      // Then: 應該成功處理
      expect(result.success).toBe(true)
      expect(result.processingTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('🚀 效能最佳化測試', () => {
    test('應該根據負載動態調整批次大小', () => {
      // Given: 不同的負載統計
      const lightLoad = { averageProcessingTime: 200, conflictRate: 0.1 }
      const heavyLoad = { averageProcessingTime: 2000, conflictRate: 0.8 }

      // When: 優化效能
      const lightConfig = orchestrator.optimizeSyncPerformance(lightLoad)
      const heavyConfig = orchestrator.optimizeSyncPerformance(heavyLoad)

      // Then: 應該動態調整
      expect(lightConfig.batchSize).toBeGreaterThan(heavyConfig.batchSize)
      expect(heavyConfig.conflictDetectionLevel).toBe('ENHANCED')
      expect(lightConfig.enableParallelProcessing).toBe(true)
    })

    test('應該提供智能的效能建議', () => {
      // Given: 效能統計資料
      const stats = {
        totalSync: 1000,
        averageProcessingTime: 1500,
        conflictRate: 0.3,
        retryRate: 0.2
      }

      // When: 生成效能建議
      const recommendations = orchestrator.generatePerformanceRecommendations(stats)

      // Then: 應該提供具體建議
      expect(recommendations).toContain('考慮增加批次大小以提高處理效率')
      expect(recommendations).toContain('衝突率偏高，建議加強資料驗證')
    })
  })
})
