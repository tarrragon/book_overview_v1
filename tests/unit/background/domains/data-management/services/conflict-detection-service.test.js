/**
 * ConflictDetectionService 單元測試
 * TDD 循環 3: 衝突檢測與分析邏輯測試
 */

const ConflictDetectionService = require('../../../../../../src/background/domains/data-management/services/conflict-detection-service')

describe('ConflictDetectionService', () => {
  let service
  let mockEventBus
  let mockLogger
  let mockDataDifferenceEngine

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

    // Mock DataDifferenceEngine
    mockDataDifferenceEngine = {
      calculateDifferences: jest.fn(),
      getConfig: jest.fn(() => ({ compareFields: ['title', 'progress', 'lastUpdated'] }))
    }

    // 初始化服務
    service = new ConflictDetectionService(mockEventBus, {
      logger: mockLogger,
      dataDifferenceEngine: mockDataDifferenceEngine,
      config: {
        progressConflictThreshold: 15,
        enableIntelligentConflictDetection: true,
        autoResolveConflicts: false
      }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🏗️ 服務初始化', () => {
    test('應該正確初始化服務實例', () => {
      expect(service).toBeInstanceOf(ConflictDetectionService)
      expect(service.eventBus).toBe(mockEventBus)
      expect(service.logger).toBe(mockLogger)
      expect(service.dataDifferenceEngine).toBe(mockDataDifferenceEngine)
    })

    test('應該正確合併預設配置', () => {
      expect(service.effectiveConfig.progressConflictThreshold).toBe(15)
      expect(service.effectiveConfig.enableIntelligentConflictDetection).toBe(true)
      expect(service.effectiveConfig.autoResolveConflicts).toBe(false)
    })

    test('應該初始化衝突檢測統計', () => {
      expect(service.conflictStatistics).toEqual({
        totalConflictsDetected: 0,
        resolvedConflicts: 0,
        autoResolvedConflicts: 0,
        manualResolvedConflicts: 0,
        lastDetectionTime: null
      })
    })
  })

  describe('🔍 主要衝突檢測功能', () => {
    test('detectConflicts() 應該檢測進度衝突', async () => {
      const sourceData = [
        { id: '1', title: 'Book A', progress: 70, lastUpdated: '2025-01-01' }
      ]
      const targetData = [
        { id: '1', title: 'Book A', progress: 20, lastUpdated: '2025-01-01' }
      ]

      // Mock DataDifferenceEngine 返回修改項目
      mockDataDifferenceEngine.calculateDifferences.mockReturnValue({
        modified: [{
          id: '1',
          source: sourceData[0],
          target: targetData[0],
          changes: {
            progress: { from: 20, to: 70, type: 'modified', severity: 'high' }
          }
        }]
      })

      const result = await service.detectConflicts(sourceData, targetData)

      expect(result.hasConflicts).toBe(true)
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].type).toBe('PROGRESS_CONFLICT')
      expect(result.conflicts[0].severity).toBe('HIGH')
      expect(result.severity).toBe('HIGH')
    })

    test('detectConflicts() 應該檢測標題衝突', async () => {
      const sourceData = [
        { id: '1', title: 'New Title', progress: 50, lastUpdated: '2025-01-02' }
      ]
      const targetData = [
        { id: '1', title: 'Old Title', progress: 50, lastUpdated: '2025-01-01' }
      ]

      mockDataDifferenceEngine.calculateDifferences.mockReturnValue({
        modified: [{
          id: '1',
          source: sourceData[0],
          target: targetData[0],
          changes: {
            title: { from: 'Old Title', to: 'New Title', type: 'modified', severity: 'medium' },
            lastUpdated: { from: '2025-01-01', to: '2025-01-02', type: 'modified', severity: 'low' }
          }
        }]
      })

      const result = await service.detectConflicts(sourceData, targetData)

      expect(result.hasConflicts).toBe(true)
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].type).toBe('TITLE_CONFLICT')
      expect(result.conflicts[0].severity).toBe('MEDIUM')
    })

    test('detectConflicts() 應該檢測時間戳衝突', async () => {
      const sourceData = [
        { id: '1', title: 'Book A', progress: 50, lastUpdated: '2025-01-01' }
      ]
      const targetData = [
        { id: '1', title: 'Book A', progress: 50, lastUpdated: '2025-01-02' }
      ]

      mockDataDifferenceEngine.calculateDifferences.mockReturnValue({
        modified: [{
          id: '1',
          source: sourceData[0],
          target: targetData[0],
          changes: {
            lastUpdated: { from: '2025-01-02', to: '2025-01-01', type: 'modified', severity: 'low' }
          }
        }]
      })

      const result = await service.detectConflicts(sourceData, targetData)

      expect(result.hasConflicts).toBe(true)
      expect(result.conflicts[0].type).toBe('TIMESTAMP_CONFLICT')
    })

    test('detectConflicts() 應該處理多重衝突', async () => {
      const sourceData = [
        { id: '1', title: 'New Title', progress: 80, lastUpdated: '2025-01-01' },
        { id: '2', title: 'Book B', progress: 30, lastUpdated: '2025-01-01' }
      ]
      const targetData = [
        { id: '1', title: 'Old Title', progress: 20, lastUpdated: '2025-01-02' },
        { id: '2', title: 'Book B', progress: 90, lastUpdated: '2025-01-01' }
      ]

      mockDataDifferenceEngine.calculateDifferences.mockReturnValue({
        modified: [
          {
            id: '1',
            source: sourceData[0],
            target: targetData[0],
            changes: {
              title: { from: 'Old Title', to: 'New Title', type: 'modified', severity: 'medium' },
              progress: { from: 20, to: 80, type: 'modified', severity: 'high' },
              lastUpdated: { from: '2025-01-02', to: '2025-01-01', type: 'modified', severity: 'low' }
            }
          },
          {
            id: '2',
            source: sourceData[1],
            target: targetData[1],
            changes: {
              progress: { from: 90, to: 30, type: 'modified', severity: 'high' }
            }
          }
        ]
      })

      const result = await service.detectConflicts(sourceData, targetData)

      expect(result.hasConflicts).toBe(true)
      expect(result.conflicts).toHaveLength(2)
      expect(result.severity).toBe('HIGH')
      expect(result.recommendations).toBeDefined()
    })

    test('detectConflicts() 應該在沒有衝突時返回空結果', async () => {
      const sourceData = [
        { id: '1', title: 'Book A', progress: 50, lastUpdated: '2025-01-01' }
      ]
      const targetData = [
        { id: '1', title: 'Book A', progress: 52, lastUpdated: '2025-01-01' }
      ]

      mockDataDifferenceEngine.calculateDifferences.mockReturnValue({
        modified: [] // 沒有顯著變更
      })

      const result = await service.detectConflicts(sourceData, targetData)

      expect(result.hasConflicts).toBe(false)
      expect(result.conflicts).toHaveLength(0)
      expect(result.severity).toBe('NONE')
    })
  })

  describe('📊 衝突嚴重程度計算', () => {
    test('calculateConflictSeverity() 應該正確計算高嚴重程度', () => {
      const conflicts = [
        { type: 'PROGRESS_CONFLICT', severity: 'HIGH', field: 'progress' },
        { type: 'TITLE_CONFLICT', severity: 'MEDIUM', field: 'title' }
      ]

      const severity = service.calculateConflictSeverity(conflicts)
      expect(severity).toBe('HIGH')
    })

    test('calculateConflictSeverity() 應該正確計算中等嚴重程度', () => {
      const conflicts = [
        { type: 'TITLE_CONFLICT', severity: 'MEDIUM', field: 'title' }
      ]

      const severity = service.calculateConflictSeverity(conflicts)
      expect(severity).toBe('MEDIUM')
    })

    test('calculateConflictSeverity() 應該正確計算低嚴重程度', () => {
      const conflicts = [
        { type: 'TIMESTAMP_CONFLICT', severity: 'LOW', field: 'lastUpdated' }
      ]

      const severity = service.calculateConflictSeverity(conflicts)
      expect(severity).toBe('LOW')
    })

    test('calculateConflictSeverity() 應該在沒有衝突時返回 NONE', () => {
      const severity = service.calculateConflictSeverity([])
      expect(severity).toBe('NONE')
    })
  })

  describe('💡 衝突解決建議', () => {
    test('generateConflictRecommendations() 應該為進度衝突生成建議', () => {
      const conflicts = [
        {
          type: 'PROGRESS_CONFLICT',
          itemId: '1',
          field: 'progress',
          severity: 'HIGH',
          sourceValue: 80,
          targetValue: 20
        }
      ]

      const recommendations = service.generateConflictRecommendations(conflicts)

      expect(recommendations).toHaveLength(1)
      expect(recommendations[0].conflictId).toBe('1')
      expect(recommendations[0].strategy).toBe('USE_HIGHER_PROGRESS')
      expect(recommendations[0].autoResolvable).toBe(true)
    })

    test('generateConflictRecommendations() 應該為標題衝突生成建議', () => {
      const conflicts = [
        {
          type: 'TITLE_CONFLICT',
          itemId: '1',
          field: 'title',
          severity: 'MEDIUM',
          sourceValue: 'New Title',
          targetValue: 'Old Title'
        }
      ]

      const recommendations = service.generateConflictRecommendations(conflicts)

      expect(recommendations).toHaveLength(1)
      expect(recommendations[0].strategy).toBe('MANUAL_REVIEW')
      expect(recommendations[0].autoResolvable).toBe(false)
    })

    test('generateConflictRecommendations() 應該為批量衝突提供策略建議', () => {
      const conflicts = Array(8).fill().map((_, i) => ({
        type: 'PROGRESS_CONFLICT',
        itemId: `${i + 1}`,
        field: 'progress',
        severity: 'MEDIUM'
      }))

      const recommendations = service.generateConflictRecommendations(conflicts)

      expect(recommendations).toContainEqual(expect.objectContaining({
        strategy: 'BATCH_PROCESSING',
        description: expect.stringContaining('批量處理策略')
      }))
    })
  })

  describe('📈 統計與效能', () => {
    test('updateConflictStatistics() 應該正確更新統計資訊', () => {
      const conflicts = [
        { type: 'PROGRESS_CONFLICT', severity: 'HIGH' },
        { type: 'TITLE_CONFLICT', severity: 'MEDIUM' }
      ]

      service.updateConflictStatistics(conflicts, { resolvedCount: 1, autoResolvedCount: 1 })

      expect(service.conflictStatistics.totalConflictsDetected).toBe(2)
      expect(service.conflictStatistics.resolvedConflicts).toBe(1)
      expect(service.conflictStatistics.autoResolvedConflicts).toBe(1)
      expect(service.conflictStatistics.lastDetectionTime).toBeInstanceOf(Date)
    })

    test('getConflictStatistics() 應該返回統計資料副本', () => {
      const stats = service.getConflictStatistics()

      expect(stats).toEqual(service.conflictStatistics)
      expect(stats).not.toBe(service.conflictStatistics) // 應該是副本
    })

    test('clearConflictStatistics() 應該重置統計資料', () => {
      service.conflictStatistics.totalConflictsDetected = 5
      service.clearConflictStatistics()

      expect(service.conflictStatistics.totalConflictsDetected).toBe(0)
      expect(service.conflictStatistics.lastDetectionTime).toBeNull()
    })
  })

  describe('🔧 配置管理', () => {
    test('updateConfig() 應該動態更新衝突檢測配置', () => {
      const newConfig = {
        progressConflictThreshold: 20,
        autoResolveConflicts: true
      }

      service.updateConfig(newConfig)

      expect(service.effectiveConfig.progressConflictThreshold).toBe(20)
      expect(service.effectiveConfig.autoResolveConflicts).toBe(true)
    })

    test('getConfig() 應該返回當前配置', () => {
      const config = service.getConfig()
      expect(config).toEqual(service.effectiveConfig)
    })
  })

  describe('⚠️ 錯誤處理', () => {
    test('constructor 應該要求 eventBus 參數', () => {
      expect(() => {
        new ConflictDetectionService()
      }).toThrow('EventBus is required')
    })

    test('detectConflicts() 應該安全處理無效資料', async () => {
      mockDataDifferenceEngine.calculateDifferences.mockReturnValue({
        modified: []
      })

      await expect(service.detectConflicts(null, undefined)).resolves.not.toThrow()
      await expect(service.detectConflicts([], [])).resolves.not.toThrow()
    })

    test('detectConflicts() 應該處理 DataDifferenceEngine 錯誤', async () => {
      mockDataDifferenceEngine.calculateDifferences.mockImplementation(() => {
        throw new Error('Engine calculation failed')
      })

      await expect(service.detectConflicts([], [])).rejects.toThrow('Engine calculation failed')
    })
  })

  describe('🔄 與其他服務的整合', () => {
    test('應該與 DataDifferenceEngine 正確協作', async () => {
      const sourceData = [{ id: '1', title: 'Book A', progress: 50 }]
      const targetData = [{ id: '1', title: 'Book A', progress: 70 }]

      mockDataDifferenceEngine.calculateDifferences.mockReturnValue({
        modified: [{
          id: '1',
          source: sourceData[0],
          target: targetData[0],
          changes: {
            progress: { from: 70, to: 50, type: 'modified', severity: 'low' }
          }
        }]
      })

      const result = await service.detectConflicts(sourceData, targetData)

      expect(mockDataDifferenceEngine.calculateDifferences).toHaveBeenCalledWith(sourceData, targetData)
      expect(result).toBeDefined()
    })

    test('應該發送衝突檢測事件', async () => {
      const conflicts = [{ type: 'PROGRESS_CONFLICT', severity: 'HIGH' }]

      await service.emitConflictEvent('CONFLICT_DETECTED', {
        conflicts,
        severity: 'HIGH'
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith('DATA.CONFLICT.CONFLICT_DETECTED', expect.objectContaining({
        conflicts,
        severity: 'HIGH',
        timestamp: expect.any(Number)
      }))
    })
  })
})
