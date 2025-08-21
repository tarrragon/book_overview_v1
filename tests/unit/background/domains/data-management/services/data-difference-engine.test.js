/**
 * DataDifferenceEngine 單元測試
 * TDD 循環 2: 純粹資料差異計算演算法測試
 */

const DataDifferenceEngine = require('../../../../../../src/background/domains/data-management/services/data-difference-engine')

describe('DataDifferenceEngine', () => {
  let engine
  let config

  beforeEach(() => {
    config = {
      compareFields: ['title', 'progress', 'lastUpdated'],
      caseSensitive: true,
      numericTolerance: 0
    }
    engine = new DataDifferenceEngine(config)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🏗️ 引擎初始化', () => {
    test('應該正確初始化差異引擎實例', () => {
      expect(engine).toBeInstanceOf(DataDifferenceEngine)
      expect(engine.config).toEqual(config)
    })

    test('應該使用預設配置當沒有配置時', () => {
      const defaultEngine = new DataDifferenceEngine()
      expect(defaultEngine.config).toEqual({
        compareFields: ['title', 'progress', 'lastUpdated'],
        caseSensitive: true,
        numericTolerance: 0
      })
    })

    test('應該正確合併自訂配置', () => {
      const customConfig = {
        compareFields: ['title', 'author'],
        caseSensitive: false
      }
      const customEngine = new DataDifferenceEngine(customConfig)
      expect(customEngine.config.compareFields).toEqual(['title', 'author'])
      expect(customEngine.config.caseSensitive).toBe(false)
      expect(customEngine.config.numericTolerance).toBe(0) // 預設值保留
    })
  })

  describe('📊 資料差異計算', () => {
    test('calculateDifferences() 應該正確計算新增項目', () => {
      const sourceData = [
        { id: '1', title: 'Book A', progress: 50 },
        { id: '2', title: 'Book B', progress: 30 }
      ]
      const targetData = [
        { id: '1', title: 'Book A', progress: 50 }
      ]

      const result = engine.calculateDifferences(sourceData, targetData)

      expect(result.added).toHaveLength(1)
      expect(result.added[0]).toEqual({ id: '2', title: 'Book B', progress: 30 })
      expect(result.modified).toHaveLength(0)
      expect(result.deleted).toHaveLength(0)
      expect(result.unchanged).toHaveLength(1)
      expect(result.summary.addedCount).toBe(1)
      expect(result.summary.totalChanges).toBe(1)
    })

    test('calculateDifferences() 應該正確計算刪除項目', () => {
      const sourceData = [
        { id: '1', title: 'Book A', progress: 50 }
      ]
      const targetData = [
        { id: '1', title: 'Book A', progress: 50 },
        { id: '2', title: 'Book B', progress: 30 }
      ]

      const result = engine.calculateDifferences(sourceData, targetData)

      expect(result.added).toHaveLength(0)
      expect(result.modified).toHaveLength(0)
      expect(result.deleted).toHaveLength(1)
      expect(result.deleted[0]).toEqual({ id: '2', title: 'Book B', progress: 30 })
      expect(result.unchanged).toHaveLength(1)
      expect(result.summary.deletedCount).toBe(1)
      expect(result.summary.totalChanges).toBe(1)
    })

    test('calculateDifferences() 應該正確計算修改項目', () => {
      const sourceData = [
        { id: '1', title: 'Book A', progress: 70 }
      ]
      const targetData = [
        { id: '1', title: 'Book A', progress: 50 }
      ]

      const result = engine.calculateDifferences(sourceData, targetData)

      expect(result.added).toHaveLength(0)
      expect(result.modified).toHaveLength(1)
      expect(result.deleted).toHaveLength(0)
      expect(result.unchanged).toHaveLength(0)

      const modifiedItem = result.modified[0]
      expect(modifiedItem.id).toBe('1')
      expect(modifiedItem.source.progress).toBe(70)
      expect(modifiedItem.target.progress).toBe(50)
      expect(modifiedItem.changes).toBeDefined()
      expect(result.summary.modifiedCount).toBe(1)
      expect(result.summary.totalChanges).toBe(1)
    })

    test('calculateDifferences() 應該正確處理複雜場景', () => {
      const sourceData = [
        { id: '1', title: 'Book A', progress: 70 }, // 修改
        { id: '2', title: 'Book B', progress: 30 }, // 新增
        { id: '3', title: 'Book C', progress: 100 } // 不變
      ]
      const targetData = [
        { id: '1', title: 'Book A', progress: 50 }, // 修改
        { id: '3', title: 'Book C', progress: 100 }, // 不變
        { id: '4', title: 'Book D', progress: 20 } // 刪除
      ]

      const result = engine.calculateDifferences(sourceData, targetData)

      expect(result.added).toHaveLength(1)
      expect(result.added[0].id).toBe('2')
      expect(result.modified).toHaveLength(1)
      expect(result.modified[0].id).toBe('1')
      expect(result.deleted).toHaveLength(1)
      expect(result.deleted[0].id).toBe('4')
      expect(result.unchanged).toHaveLength(1)
      expect(result.unchanged[0].id).toBe('3')
      expect(result.summary.totalChanges).toBe(3)
    })

    test('calculateDifferences() 應該安全處理空資料', () => {
      expect(() => engine.calculateDifferences([], [])).not.toThrow()
      expect(() => engine.calculateDifferences(null, [])).not.toThrow()
      expect(() => engine.calculateDifferences([], null)).not.toThrow()
      expect(() => engine.calculateDifferences(undefined, undefined)).not.toThrow()

      const result = engine.calculateDifferences([], [])
      expect(result.summary.totalChanges).toBe(0)
    })

    test('calculateDifferences() 應該忽略無效項目', () => {
      const sourceData = [
        { id: '1', title: 'Book A' },
        null,
        { title: 'Book B' }, // 缺少 id
        undefined,
        { id: '2', title: 'Book C' }
      ]
      const targetData = [
        { id: '1', title: 'Book A' }
      ]

      const result = engine.calculateDifferences(sourceData, targetData)

      expect(result.added).toHaveLength(1)
      expect(result.added[0].id).toBe('2')
      expect(result.unchanged).toHaveLength(1)
      expect(result.unchanged[0].id).toBe('1')
    })
  })

  describe('🔍 項目比較功能', () => {
    test('compareItems() 應該檢測到標題變更', () => {
      const source = { title: 'Old Title', progress: 50 }
      const target = { title: 'New Title', progress: 50 }

      expect(engine.compareItems(source, target)).toBe(true)
    })

    test('compareItems() 應該檢測到進度變更', () => {
      const source = { title: 'Book A', progress: 70 }
      const target = { title: 'Book A', progress: 50 }

      expect(engine.compareItems(source, target)).toBe(true)
    })

    test('compareItems() 應該在沒有變更時返回 false', () => {
      const source = { title: 'Book A', progress: 50, lastUpdated: '2025-01-01' }
      const target = { title: 'Book A', progress: 50, lastUpdated: '2025-01-01' }

      expect(engine.compareItems(source, target)).toBe(false)
    })

    test('compareItems() 應該支援大小寫不敏感比較', () => {
      const caseInsensitiveEngine = new DataDifferenceEngine({
        compareFields: ['title'],
        caseSensitive: false
      })

      const source = { title: 'BOOK A' }
      const target = { title: 'book a' }

      expect(caseInsensitiveEngine.compareItems(source, target)).toBe(false)
    })

    test('compareItems() 應該支援數字容差比較', () => {
      const tolerantEngine = new DataDifferenceEngine({
        compareFields: ['progress'],
        numericTolerance: 5
      })

      const source = { progress: 50 }
      const target = { progress: 52 }

      expect(tolerantEngine.compareItems(source, target)).toBe(false) // 在容差範圍內

      const target2 = { progress: 57 }
      expect(tolerantEngine.compareItems(source, target2)).toBe(true) // 超出容差範圍
    })

    test('compareItems() 應該只比較配置的欄位', () => {
      const engine = new DataDifferenceEngine({
        compareFields: ['title']
      })

      const source = { title: 'Book A', progress: 50, author: 'Author A' }
      const target = { title: 'Book A', progress: 100, author: 'Author B' }

      expect(engine.compareItems(source, target)).toBe(false) // 只比較 title
    })
  })

  describe('📝 變更詳情分析', () => {
    test('getFieldChanges() 應該返回詳細的變更資訊', () => {
      const source = { title: 'New Title', progress: 70, lastUpdated: '2025-01-02' }
      const target = { title: 'Old Title', progress: 50, lastUpdated: '2025-01-01' }

      const changes = engine.getFieldChanges(source, target)

      expect(changes).toEqual({
        title: {
          from: 'Old Title',
          to: 'New Title',
          type: 'modified',
          severity: 'medium'
        },
        progress: {
          from: 50,
          to: 70,
          type: 'modified',
          severity: 'low'
        },
        lastUpdated: {
          from: '2025-01-01',
          to: '2025-01-02',
          type: 'modified',
          severity: 'low'
        }
      })
    })

    test('getFieldChanges() 應該忽略未變更的欄位', () => {
      const source = { title: 'Same Title', progress: 70 }
      const target = { title: 'Same Title', progress: 50 }

      const changes = engine.getFieldChanges(source, target)

      expect(changes).toEqual({
        progress: {
          from: 50,
          to: 70,
          type: 'modified',
          severity: 'low'
        }
      })
      expect(changes.title).toBeUndefined()
    })

    test('getFieldChanges() 應該正確分類變更嚴重程度', () => {
      const source = { title: 'New Title', progress: 100 }
      const target = { title: 'Old Title', progress: 0 }

      const changes = engine.getFieldChanges(source, target)

      expect(changes.title.severity).toBe('medium')
      expect(changes.progress.severity).toBe('high') // 大幅進度變更
    })
  })

  describe('🛠️ 配置管理', () => {
    test('updateConfig() 應該動態更新配置', () => {
      const newConfig = {
        compareFields: ['title', 'author'],
        caseSensitive: false
      }

      engine.updateConfig(newConfig)

      expect(engine.config.compareFields).toEqual(['title', 'author'])
      expect(engine.config.caseSensitive).toBe(false)
      expect(engine.config.numericTolerance).toBe(0) // 保留原有值
    })

    test('getConfig() 應該返回當前配置', () => {
      const currentConfig = engine.getConfig()
      expect(currentConfig).toEqual(config)
    })

    test('resetConfig() 應該重置為預設配置', () => {
      engine.updateConfig({ compareFields: ['custom'] })
      engine.resetConfig()

      expect(engine.config).toEqual({
        compareFields: ['title', 'progress', 'lastUpdated'],
        caseSensitive: true,
        numericTolerance: 0
      })
    })
  })

  describe('📊 統計與效能', () => {
    test('getStatistics() 應該提供差異統計資訊', () => {
      const sourceData = [
        { id: '1', title: 'Book A', progress: 70 },
        { id: '2', title: 'Book B', progress: 30 }
      ]
      const targetData = [
        { id: '1', title: 'Book A', progress: 50 }
      ]

      const result = engine.calculateDifferences(sourceData, targetData)
      const stats = engine.getStatistics()

      expect(stats).toEqual({
        lastCalculation: expect.objectContaining({
          sourceCount: 2,
          targetCount: 1,
          addedCount: 1,
          modifiedCount: 1,
          deletedCount: 0,
          unchangedCount: 0,
          totalChanges: 2,
          calculationTime: expect.any(Number)
        }),
        totalCalculations: 1,
        totalChangesProcessed: 2
      })
    })

    test('clearStatistics() 應該清除統計資料', () => {
      // 執行一些計算
      engine.calculateDifferences([{ id: '1', title: 'Book A' }], [])

      engine.clearStatistics()
      const stats = engine.getStatistics()

      expect(stats.totalCalculations).toBe(0)
      expect(stats.totalChangesProcessed).toBe(0)
      expect(stats.lastCalculation).toBeNull()
    })
  })

  describe('⚠️ 錯誤處理', () => {
    test('應該安全處理循環引用', () => {
      const circularSource = { id: '1', title: 'Book A' }
      circularSource.self = circularSource

      const target = { id: '1', title: 'Book A' }

      expect(() => engine.calculateDifferences([circularSource], [target])).not.toThrow()
    })

    test('應該安全處理深層嵌套物件', () => {
      const source = {
        id: '1',
        title: 'Book A',
        metadata: {
          author: { name: 'Author A', country: 'US' },
          publisher: { name: 'Publisher A' }
        }
      }
      const target = {
        id: '1',
        title: 'Book A',
        metadata: {
          author: { name: 'Author B', country: 'UK' },
          publisher: { name: 'Publisher A' }
        }
      }

      expect(() => engine.calculateDifferences([source], [target])).not.toThrow()
    })

    test('應該處理不合法的配置值', () => {
      expect(() => new DataDifferenceEngine({ compareFields: null })).not.toThrow()
      expect(() => new DataDifferenceEngine({ caseSensitive: 'invalid' })).not.toThrow()
      expect(() => new DataDifferenceEngine({ numericTolerance: 'not-a-number' })).not.toThrow()
    })
  })
})
