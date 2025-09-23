/**
 * ConflictDetectionService 測試
 *
 * 測試目標：
 * - 驗證智能衝突檢測和分類功能
 * - 測試衝突嚴重性分析和優先級排序
 * - 確保自動解決策略生成的準確性
 * - 驗證批次衝突檢測和統計功能
 *
 * @jest-environment jsdom
 */

// eslint-disable-next-line no-unused-vars
const ConflictDetectionService = require('src/background/domains/data-management/services/ConflictDetectionService.js')

describe('ConflictDetectionService TDD 測試', () => {
  // eslint-disable-next-line no-unused-vars
  let service

  beforeEach(() => {
    service = new ConflictDetectionService({
      progressConflictThreshold: 15,
      titleSimilarityThreshold: 0.8,
      timestampConflictWindow: 60000,
      enableIntelligentDetection: true,
      autoResolveConflicts: false
    })
  })

  describe('🔴 Red 階段：基礎功能驗證', () => {
    test('應該正確初始化衝突檢測服務', () => {
      // Given: 預設配置
      // eslint-disable-next-line no-unused-vars
      const defaultService = new ConflictDetectionService()

      // Then: 應該正確設置預設值
      expect(defaultService.config.progressConflictThreshold).toBe(15)
      expect(defaultService.config.titleSimilarityThreshold).toBe(0.8)
      expect(defaultService.config.enableIntelligentDetection).toBe(true)
      expect(defaultService.isInitialized).toBe(true)
    })

    test('應該支援自訂配置', () => {
      // Given: 自訂配置
      // eslint-disable-next-line no-unused-vars
      const customService = new ConflictDetectionService({
        progressConflictThreshold: 10,
        titleSimilarityThreshold: 0.9,
        autoResolveConflicts: true,
        maxConflictsPerItem: 5
      })

      // Then: 應該使用自訂配置
      expect(customService.config.progressConflictThreshold).toBe(10)
      expect(customService.config.titleSimilarityThreshold).toBe(0.9)
      expect(customService.config.autoResolveConflicts).toBe(true)
      expect(customService.config.maxConflictsPerItem).toBe(5)
    })

    test('detectConflicts() 應該檢測進度衝突', async () => {
      // Given: 有進度衝突的資料變更
      // eslint-disable-next-line no-unused-vars
      const sourceData = [{ id: '1', title: 'Book A', progress: 80 }]
      // eslint-disable-next-line no-unused-vars
      const targetData = [{ id: '1', title: 'Book A', progress: 50 }]
      // eslint-disable-next-line no-unused-vars
      const changes = {
        modified: [{
          id: '1',
          sourceData: sourceData[0],
          targetData: targetData[0],
          fieldChanges: {
            progress: {
              source: 80,
              target: 50,
              type: 'VALUE_CHANGED',
              severity: 'HIGH'
            }
          }
        }]
      }

      // When: 檢測衝突
      // eslint-disable-next-line no-unused-vars
      const result = await service.detectConflicts(sourceData, targetData, changes)

      // Then: 應該檢測出進度衝突
      expect(result.hasConflicts).toBe(true)
      expect(result.items).toHaveLength(1)
      expect(result.items[0].conflicts).toHaveLength(1)
      expect(result.items[0].conflicts[0].type).toBe('PROGRESS_MISMATCH')
      expect(result.items[0].conflicts[0].difference).toBe(30)
    })

    test('detectConflicts() 應該檢測標題衝突', async () => {
      // Given: 有標題衝突的資料變更
      // eslint-disable-next-line no-unused-vars
      const sourceData = [{ id: '1', title: 'Complete Different Book', progress: 50 }]
      // eslint-disable-next-line no-unused-vars
      const targetData = [{ id: '1', title: 'Original Book Title', progress: 50 }]
      // eslint-disable-next-line no-unused-vars
      const changes = {
        modified: [{
          id: '1',
          sourceData: sourceData[0],
          targetData: targetData[0],
          fieldChanges: {
            title: {
              source: 'Complete Different Book',
              target: 'Original Book Title',
              type: 'VALUE_CHANGED',
              severity: 'HIGH'
            }
          }
        }]
      }

      // When: 檢測衝突
      // eslint-disable-next-line no-unused-vars
      const result = await service.detectConflicts(sourceData, targetData, changes)

      // Then: 應該檢測出標題衝突
      expect(result.hasConflicts).toBe(true)
      expect(result.items[0].conflicts[0].type).toBe('TITLE_DIVERGENCE')
      expect(result.items[0].conflicts[0].similarity).toBeLessThan(0.8)
    })

    test('detectConflicts() 應該檢測時間戳衝突', async () => {
      // Given: 有時間戳衝突的資料變更
      // eslint-disable-next-line no-unused-vars
      const now = Date.now()
      // eslint-disable-next-line no-unused-vars
      const sourceData = [{ id: '1', lastUpdated: new Date(now).toISOString() }]
      // eslint-disable-next-line no-unused-vars
      const targetData = [{ id: '1', lastUpdated: new Date(now - 30000).toISOString() }]
      // eslint-disable-next-line no-unused-vars
      const changes = {
        modified: [{
          id: '1',
          sourceData: sourceData[0],
          targetData: targetData[0],
          fieldChanges: {
            lastUpdated: {
              source: sourceData[0].lastUpdated,
              target: targetData[0].lastUpdated,
              type: 'VALUE_CHANGED',
              severity: 'MEDIUM'
            }
          }
        }]
      }

      // When: 檢測衝突
      // eslint-disable-next-line no-unused-vars
      const result = await service.detectConflicts(sourceData, targetData, changes)

      // Then: 應該檢測出時間戳衝突
      expect(result.hasConflicts).toBe(true)
      expect(result.items[0].conflicts[0].type).toBe('TIMESTAMP_CONFLICT')
      expect(result.items[0].conflicts[0].autoResolvable).toBe(true)
    })

    test('detectConflicts() 應該處理無衝突的情況', async () => {
      // Given: 沒有衝突的資料變更
      // eslint-disable-next-line no-unused-vars
      const sourceData = [{ id: '1', title: 'Book A', progress: 55 }]
      // eslint-disable-next-line no-unused-vars
      const targetData = [{ id: '1', title: 'Book A', progress: 50 }]
      // eslint-disable-next-line no-unused-vars
      const changes = {
        modified: [{
          id: '1',
          sourceData: sourceData[0],
          targetData: targetData[0],
          fieldChanges: {
            progress: {
              source: 55,
              target: 50,
              type: 'VALUE_CHANGED',
              severity: 'LOW'
            }
          }
        }]
      }

      // When: 檢測衝突
      // eslint-disable-next-line no-unused-vars
      const result = await service.detectConflicts(sourceData, targetData, changes)

      // Then: 應該沒有衝突
      expect(result.hasConflicts).toBe(false)
      expect(result.items).toHaveLength(0)
      expect(result.severity).toBe('NONE')
    })

    test('checkItemConflicts() 應該處理多重衝突', () => {
      // Given: 有多個欄位衝突的項目
      // eslint-disable-next-line no-unused-vars
      const modifiedItem = {
        id: '1',
        sourceData: { id: '1', title: 'New Title', progress: 90 },
        targetData: { id: '1', title: 'Old Title', progress: 40 },
        fieldChanges: {
          title: {
            source: 'New Title',
            target: 'Old Title',
            type: 'VALUE_CHANGED',
            severity: 'HIGH'
          },
          progress: {
            source: 90,
            target: 40,
            type: 'VALUE_CHANGED',
            severity: 'HIGH'
          }
        }
      }

      // When: 檢查項目衝突
      // eslint-disable-next-line no-unused-vars
      const conflicts = service.checkItemConflicts(modifiedItem)

      // Then: 應該生成複合衝突
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].type).toBe('COMPOSITE_CONFLICT')
      expect(conflicts[0].subConflicts).toHaveLength(2)
      expect(conflicts[0].resolutionComplexity).toBe('HIGH')
    })

    test('calculateStringSimilarity() 應該正確計算字串相似度', () => {
      // Given & When: 測試不同相似度的字串
      // eslint-disable-next-line no-unused-vars
      const identical = service.calculateStringSimilarity('hello', 'hello')
      // eslint-disable-next-line no-unused-vars
      const similar = service.calculateStringSimilarity('hello world', 'hallo world')
      // eslint-disable-next-line no-unused-vars
      const different = service.calculateStringSimilarity('hello', 'goodbye')
      // eslint-disable-next-line no-unused-vars
      const empty = service.calculateStringSimilarity('hello', '')

      // Then: 應該回傳正確的相似度
      expect(identical).toBe(1)
      expect(similar).toBeGreaterThan(0.8)
      expect(different).toBeLessThan(0.5)
      expect(empty).toBe(0)
    })

    test('getConflictPriority() 應該回傳正確的優先級', () => {
      // Given & When: 測試不同衝突類型的優先級
      // eslint-disable-next-line no-unused-vars
      const progressPriority = service.getConflictPriority('PROGRESS_MISMATCH')
      // eslint-disable-next-line no-unused-vars
      const titlePriority = service.getConflictPriority('TITLE_DIVERGENCE')
      // eslint-disable-next-line no-unused-vars
      const timestampPriority = service.getConflictPriority('TIMESTAMP_CONFLICT')

      // Then: 應該回傳正確的優先級分數
      expect(titlePriority).toBeGreaterThan(progressPriority) // 標題優先級最高
      expect(progressPriority).toBeGreaterThan(timestampPriority)
      expect(timestampPriority).toBe(3)
    })
  })

  describe('⚙️ 衝突嚴重性和策略測試', () => {
    test('calculateConflictSeverity() 應該正確計算整體嚴重性', () => {
      // Given: 不同嚴重性的衝突項目
      // eslint-disable-next-line no-unused-vars
      const criticalItems = [{
        conflicts: [
          { severity: 'CRITICAL', priority: 10 },
          { severity: 'HIGH', priority: 8 }
        ]
      }]

      // eslint-disable-next-line no-unused-vars
      const mediumItems = [{
        conflicts: [
          { severity: 'MEDIUM', priority: 5 },
          { severity: 'LOW', priority: 3 }
        ]
      }]

      // When: 計算嚴重性
      // eslint-disable-next-line no-unused-vars
      const criticalSeverity = service.calculateConflictSeverity(criticalItems)
      // eslint-disable-next-line no-unused-vars
      const mediumSeverity = service.calculateConflictSeverity(mediumItems)
      // eslint-disable-next-line no-unused-vars
      const noneSeverity = service.calculateConflictSeverity([])

      // Then: 應該回傳正確的嚴重性等級
      expect(criticalSeverity).toBe('CRITICAL')
      expect(mediumSeverity).toBe('MEDIUM')
      expect(noneSeverity).toBe('NONE')
    })

    test('generateConflictRecommendations() 應該生成智能建議', () => {
      // Given: 有衝突的項目
      // eslint-disable-next-line no-unused-vars
      const conflictItems = [{
        id: '1',
        conflicts: [{
          id: 'conflict_1',
          type: 'PROGRESS_MISMATCH',
          difference: 25,
          priority: 8,
          autoResolvable: true,
          confidence: 0.9
        }]
      }]

      // When: 生成建議
      // eslint-disable-next-line no-unused-vars
      const recommendations = service.generateConflictRecommendations(conflictItems)

      // Then: 應該生成適當的建議
      expect(recommendations).toHaveLength(1)
      expect(recommendations[0].strategy).toBe('USE_HIGHER_PROGRESS')
      expect(recommendations[0].autoResolvable).toBe(true)
      expect(recommendations[0].estimatedTime).toBeLessThan(500)
    })

    test('generateConflictRecommendations() 應該處理大量衝突', () => {
      // Given: 大量衝突項目
      // eslint-disable-next-line no-unused-vars
      const manyConflictItems = Array.from({ length: 8 }, (_, i) => ({
        id: `item_${i}`,
        conflicts: [{
          id: `conflict_${i}`,
          type: 'PROGRESS_MISMATCH',
          priority: 5,
          autoResolvable: true,
          confidence: 0.8
        }]
      }))

      // When: 生成建議
      // eslint-disable-next-line no-unused-vars
      const recommendations = service.generateConflictRecommendations(manyConflictItems)

      // Then: 應該包含批次解決建議
      expect(recommendations).toHaveLength(9) // 8個個別建議 + 1個批次建議
      expect(recommendations[0].type).toBe('BULK_STRATEGY')
      expect(recommendations[0].strategy).toBe('BATCH_RESOLUTION')
    })

    test('isAutoResolvable() 應該正確判斷自動解決能力', () => {
      // Given: 不同的衝突情況
      // eslint-disable-next-line no-unused-vars
      const autoResolvableConflicts = {
        severity: 'MEDIUM',
        items: [{
          conflicts: [
            { autoResolvable: true, severity: 'LOW' },
            { autoResolvable: true, severity: 'MEDIUM' }
          ]
        }]
      }

      // eslint-disable-next-line no-unused-vars
      const nonAutoResolvableConflicts = {
        severity: 'CRITICAL',
        items: [{
          conflicts: [
            { autoResolvable: false, severity: 'HIGH' }
          ]
        }]
      }

      // When: 判斷自動解決能力
      // eslint-disable-next-line no-unused-vars
      const canAutoResolve1 = service.isAutoResolvable(autoResolvableConflicts)
      // eslint-disable-next-line no-unused-vars
      const canAutoResolve2 = service.isAutoResolvable(nonAutoResolvableConflicts)

      // Then: 應該正確判斷
      expect(canAutoResolve1).toBe(false) // autoResolveConflicts 設為 false
      expect(canAutoResolve2).toBe(false)

      // 啟用自動解決
      service.updateConfig({ autoResolveConflicts: true })
      // eslint-disable-next-line no-unused-vars
      const canAutoResolve3 = service.isAutoResolvable(autoResolvableConflicts)
      expect(canAutoResolve3).toBe(true)
    })
  })

  describe('🔍 特定衝突類型檢測測試', () => {
    test('detectProgressConflict() 應該檢測高差異進度衝突', () => {
      // Given: 高差異的進度變更
      // eslint-disable-next-line no-unused-vars
      const change = { source: 90, target: 10, type: 'VALUE_CHANGED' }
      // eslint-disable-next-line no-unused-vars
      const source = { progress: 90 }
      // eslint-disable-next-line no-unused-vars
      const target = { progress: 10 }

      // When: 檢測進度衝突
      // eslint-disable-next-line no-unused-vars
      const conflict = service.detectProgressConflict(change, source, target)

      // Then: 應該檢測出衝突
      expect(conflict).toBeDefined()
      expect(conflict.type).toBe('PROGRESS_MISMATCH')
      expect(conflict.difference).toBe(80)
      expect(conflict.severity).toBe('CRITICAL')
      expect(conflict.recommendedStrategy).toBe('MANUAL_REVIEW')
    })

    test('detectTitleConflict() 應該檢測低相似度標題衝突', () => {
      // Given: 低相似度的標題變更
      // eslint-disable-next-line no-unused-vars
      const change = { source: 'Completely Different Book', target: 'Another Book Title', type: 'VALUE_CHANGED' }
      // eslint-disable-next-line no-unused-vars
      const source = { title: 'Completely Different Book' }
      // eslint-disable-next-line no-unused-vars
      const target = { title: 'Another Book Title' }

      // When: 檢測標題衝突
      // eslint-disable-next-line no-unused-vars
      const conflict = service.detectTitleConflict(change, source, target)

      // Then: 應該檢測出衝突
      expect(conflict).toBeDefined()
      expect(conflict.type).toBe('TITLE_DIVERGENCE')
      expect(conflict.similarity).toBeLessThan(0.8)
      expect(conflict.severity).toBe('HIGH')
    })

    test('detectTimestampConflict() 應該檢測時間窗口內的衝突', () => {
      // Given: 時間窗口內的時間戳變更
      // eslint-disable-next-line no-unused-vars
      const now = Date.now()
      // eslint-disable-next-line no-unused-vars
      const change = {
        source: new Date(now).toISOString(),
        target: new Date(now - 30000).toISOString(), // 30秒差異
        type: 'VALUE_CHANGED'
      }
      // eslint-disable-next-line no-unused-vars
      const source = { lastUpdated: change.source }
      // eslint-disable-next-line no-unused-vars
      const target = { lastUpdated: change.target }

      // When: 檢測時間戳衝突
      // eslint-disable-next-line no-unused-vars
      const conflict = service.detectTimestampConflict(change, source, target)

      // Then: 應該檢測出衝突
      expect(conflict).toBeDefined()
      expect(conflict.type).toBe('TIMESTAMP_CONFLICT')
      expect(conflict.autoResolvable).toBe(true)
      expect(conflict.recommendedStrategy).toBe('USE_LATEST_TIMESTAMP')
    })

    test('detectGenericConflict() 應該檢測一般欄位衝突', () => {
      // Given: 高嚴重性的一般欄位變更
      // eslint-disable-next-line no-unused-vars
      const change = {
        source: 'new_value',
        target: 'old_value',
        type: 'VALUE_CHANGED',
        severity: 'HIGH'
      }
      // eslint-disable-next-line no-unused-vars
      const source = { customField: 'new_value' }
      // eslint-disable-next-line no-unused-vars
      const target = { customField: 'old_value' }

      // When: 檢測一般衝突
      // eslint-disable-next-line no-unused-vars
      const conflict = service.detectGenericConflict('customField', change, source, target)

      // Then: 應該檢測出衝突
      expect(conflict).toBeDefined()
      expect(conflict.type).toBe('VALUE_INCONSISTENCY')
      expect(conflict.field).toBe('customField')
      expect(conflict.recommendedStrategy).toBe('MANUAL_REVIEW')
    })
  })

  describe('📊 統計和配置測試', () => {
    test('getStatistics() 應該回傳正確的統計資訊', async () => {
      // Given: 執行一些衝突檢測
      // eslint-disable-next-line no-unused-vars
      const sourceData = [{ id: '1', progress: 80 }]
      // eslint-disable-next-line no-unused-vars
      const targetData = [{ id: '1', progress: 20 }]
      // eslint-disable-next-line no-unused-vars
      const changes = {
        modified: [{
          id: '1',
          sourceData: sourceData[0],
          targetData: targetData[0],
          fieldChanges: {
            progress: { source: 80, target: 20, type: 'VALUE_CHANGED', severity: 'HIGH' }
          }
        }]
      }

      // When: 檢測衝突並獲取統計
      await service.detectConflicts(sourceData, targetData, changes)
      // eslint-disable-next-line no-unused-vars
      const stats = service.getStatistics()

      // Then: 應該有正確的統計資訊
      expect(stats.totalConflictsDetected).toBeGreaterThanOrEqual(1)
      expect(stats.conflictsByType).toBeDefined()
      expect(stats.config).toBeDefined()
      expect(stats.timestamp).toBeDefined()
    })

    test('resetStatistics() 應該重置統計計數器', () => {
      // Given: 設置一些統計值
      service.stats.totalConflictsDetected = 10
      service.stats.resolvedConflicts = 5

      // When: 重置統計
      service.resetStatistics()

      // Then: 統計應該被重置
      expect(service.stats.totalConflictsDetected).toBe(0)
      expect(service.stats.resolvedConflicts).toBe(0)
      expect(service.stats.conflictsByType).toBeDefined()
    })

    test('updateConfig() 應該正確更新配置', () => {
      // Given: 初始配置
      // eslint-disable-next-line no-unused-vars
      const originalThreshold = service.config.progressConflictThreshold

      // When: 更新配置
      service.updateConfig({
        progressConflictThreshold: 25,
        newOption: 'test_value'
      })

      // Then: 配置應該被更新
      expect(service.config.progressConflictThreshold).toBe(25)
      expect(service.config.newOption).toBe('test_value')
      expect(service.config.titleSimilarityThreshold).toBeDefined() // 保持舊配置
    })
  })

  describe('⚠️ 錯誤處理和邊界測試', () => {
    test('detectConflicts() 應該處理空的變更資料', async () => {
      // Given: 空的變更資料
      // eslint-disable-next-line no-unused-vars
      const sourceData = []
      // eslint-disable-next-line no-unused-vars
      const targetData = []
      // eslint-disable-next-line no-unused-vars
      const changes = { modified: [] }

      // When: 檢測衝突
      // eslint-disable-next-line no-unused-vars
      const result = await service.detectConflicts(sourceData, targetData, changes)

      // Then: 應該回傳空結果
      expect(result.hasConflicts).toBe(false)
      expect(result.items).toHaveLength(0)
      expect(result.severity).toBe('NONE')
    })

    test('checkItemConflicts() 應該處理缺少 fieldChanges 的項目', () => {
      // Given: 缺少 fieldChanges 的項目
      // eslint-disable-next-line no-unused-vars
      const modifiedItem = {
        id: '1',
        sourceData: { id: '1', title: 'Book A' },
        targetData: { id: '1', title: 'Book A' }
        // 缺少 fieldChanges
      }

      // When: 檢查項目衝突
      // eslint-disable-next-line no-unused-vars
      const conflicts = service.checkItemConflicts(modifiedItem)

      // Then: 應該回傳空陣列
      expect(conflicts).toEqual([])
    })

    test('應該處理超出最大衝突限制的項目', () => {
      // Given: 配置最大衝突數為 2
      // eslint-disable-next-line no-unused-vars
      const limitedService = new ConflictDetectionService({ maxConflictsPerItem: 2 })

      // eslint-disable-next-line no-unused-vars
      const modifiedItem = {
        id: '1',
        sourceData: { id: '1', title: 'New', progress: 90, lastUpdated: '2025-08-19T10:00:00Z' },
        targetData: { id: '1', title: 'Old', progress: 10, lastUpdated: '2025-08-19T09:00:00Z' },
        fieldChanges: {
          title: { source: 'New', target: 'Old', type: 'VALUE_CHANGED', severity: 'HIGH' },
          progress: { source: 90, target: 10, type: 'VALUE_CHANGED', severity: 'HIGH' },
          lastUpdated: { source: '2025-08-19T10:00:00Z', target: '2025-08-19T09:00:00Z', type: 'VALUE_CHANGED', severity: 'HIGH' }
        }
      }

      // When: 檢查項目衝突
      // eslint-disable-next-line no-unused-vars
      const conflicts = limitedService.checkItemConflicts(modifiedItem)

      // Then: 應該限制衝突數量並生成複合衝突
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].type).toBe('COMPOSITE_CONFLICT')
      expect(conflicts[0].subConflicts.length).toBeLessThanOrEqual(2)
    })

    test('calculateStringSimilarity() 應該處理空值和 null', () => {
      // Given & When: 測試空值情況
      // eslint-disable-next-line no-unused-vars
      const nullSimilarity = service.calculateStringSimilarity(null, 'test')
      // eslint-disable-next-line no-unused-vars
      const undefinedSimilarity = service.calculateStringSimilarity(undefined, 'test')
      // eslint-disable-next-line no-unused-vars
      const emptySimilarity = service.calculateStringSimilarity('', 'test')

      // Then: 應該回傳 0
      expect(nullSimilarity).toBe(0)
      expect(undefinedSimilarity).toBe(0)
      expect(emptySimilarity).toBe(0)
    })
  })
})
