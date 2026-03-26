/**
 * DataComparisonEngine 測試
 *
 * 測試目標：
 * - 驗證高效能資料比較演算法
 * - 測試差異計算和變更檢測
 * - 確保最佳化比較的正確性
 * - 驗證批次處理和效能統計
 *
 * @jest-environment jsdom
 */

// eslint-disable-next-line no-unused-vars
const DataComparisonEngine = require('src/background/domains/data-management/services/DataComparisonEngine.js')

describe('DataComparisonEngine TDD 測試', () => {
  // eslint-disable-next-line no-unused-vars
  let engine

  beforeEach(() => {
    engine = new DataComparisonEngine({
      compareFields: ['title', 'progress', 'lastUpdated'],
      caseSensitive: true,
      numericTolerance: 0
    })
  })

  describe('🔴 Red 階段：基礎功能驗證', () => {
    test('應該正確初始化比較引擎', () => {
      // Given: 預設配置
      // eslint-disable-next-line no-unused-vars
      const defaultEngine = new DataComparisonEngine()

      // Then: 應該正確設置預設值
      expect(defaultEngine.config.compareFields).toEqual(['title', 'progress', 'lastUpdated'])
      expect(defaultEngine.config.caseSensitive).toBe(true)
      expect(defaultEngine.config.numericTolerance).toBe(0)
      expect(defaultEngine.isInitialized).toBe(true)
    })

    test('應該支援自訂配置', () => {
      // Given: 自訂配置
      // eslint-disable-next-line no-unused-vars
      const customEngine = new DataComparisonEngine({
        compareFields: ['id', 'status'],
        caseSensitive: false,
        numericTolerance: 5,
        batchSize: 50
      })

      // Then: 應該使用自訂配置
      expect(customEngine.config.compareFields).toEqual(['id', 'status'])
      expect(customEngine.config.caseSensitive).toBe(false)
      expect(customEngine.config.numericTolerance).toBe(5)
      expect(customEngine.config.batchSize).toBe(50)
    })

    test('calculateDataDifferences() 應該正確識別新增項目', async () => {
      // Given: 源資料包含新項目
      // eslint-disable-next-line no-unused-vars
      const sourceData = [
        { id: '1', title: 'Book A', progress: 50 },
        { id: '2', title: 'Book B', progress: 75 }
      ]
      // eslint-disable-next-line no-unused-vars
      const targetData = [
        { id: '1', title: 'Book A', progress: 50 }
      ]

      // When: 計算差異
      // eslint-disable-next-line no-unused-vars
      const result = await engine.calculateDataDifferences(sourceData, targetData)

      // Then: 應該識別出新增項目
      expect(result.changes.added).toHaveLength(1)
      expect(result.changes.added[0].id).toBe('2')
      expect(result.changes.added[0].data.title).toBe('Book B')
      expect(result.summary.added).toBe(1)
    })

    test('calculateDataDifferences() 應該正確識別刪除項目', async () => {
      // Given: 目標資料包含已刪除項目
      // eslint-disable-next-line no-unused-vars
      const sourceData = [
        { id: '1', title: 'Book A', progress: 50 }
      ]
      // eslint-disable-next-line no-unused-vars
      const targetData = [
        { id: '1', title: 'Book A', progress: 50 },
        { id: '2', title: 'Book B', progress: 75 }
      ]

      // When: 計算差異
      // eslint-disable-next-line no-unused-vars
      const result = await engine.calculateDataDifferences(sourceData, targetData)

      // Then: 應該識別出刪除項目
      expect(result.changes.deleted).toHaveLength(1)
      expect(result.changes.deleted[0].id).toBe('2')
      expect(result.changes.deleted[0].data.title).toBe('Book B')
      expect(result.summary.deleted).toBe(1)
    })

    test('calculateDataDifferences() 應該正確識別修改項目', async () => {
      // Given: 資料有修改
      // eslint-disable-next-line no-unused-vars
      const sourceData = [
        { id: '1', title: 'Book A Updated', progress: 75 }
      ]
      // eslint-disable-next-line no-unused-vars
      const targetData = [
        { id: '1', title: 'Book A', progress: 50 }
      ]

      // When: 計算差異
      // eslint-disable-next-line no-unused-vars
      const result = await engine.calculateDataDifferences(sourceData, targetData)

      // Then: 應該識別出修改項目
      expect(result.changes.modified).toHaveLength(1)
      expect(result.changes.modified[0].id).toBe('1')
      expect(result.changes.modified[0].fieldChanges.title).toBeDefined()
      expect(result.changes.modified[0].fieldChanges.progress).toBeDefined()
      expect(result.summary.modified).toBe(1)
    })

    test('calculateDataDifferences() 應該正確識別未變更項目', async () => {
      // Given: 完全相同的資料
      // eslint-disable-next-line no-unused-vars
      const sourceData = [
        { id: '1', title: 'Book A', progress: 50 }
      ]
      // eslint-disable-next-line no-unused-vars
      const targetData = [
        { id: '1', title: 'Book A', progress: 50 }
      ]

      // When: 計算差異
      // eslint-disable-next-line no-unused-vars
      const result = await engine.calculateDataDifferences(sourceData, targetData)

      // Then: 應該識別出未變更項目
      expect(result.changes.unchanged).toHaveLength(1)
      expect(result.changes.unchanged[0].id).toBe('1')
      expect(result.summary.unchanged).toBe(1)
    })

    test('compareBookDataOptimized() 應該快速比較相同資料', () => {
      // Given: 相同的書籍資料
      // eslint-disable-next-line no-unused-vars
      const book1 = { id: '1', title: 'Book A', progress: 50 }
      // eslint-disable-next-line no-unused-vars
      const book2 = { id: '1', title: 'Book A', progress: 50 }

      // When: 最佳化比較
      // eslint-disable-next-line no-unused-vars
      const hasChanges = engine.compareBookDataOptimized(book1, book2)

      // Then: 應該回傳 false（無變更）
      expect(hasChanges).toBe(false)
    })

    test('compareBookDataOptimized() 應該快速識別差異', () => {
      // Given: 不同的書籍資料
      // eslint-disable-next-line no-unused-vars
      const book1 = { id: '1', title: 'Book A', progress: 50 }
      // eslint-disable-next-line no-unused-vars
      const book2 = { id: '1', title: 'Book B', progress: 75 }

      // When: 最佳化比較
      // eslint-disable-next-line no-unused-vars
      const hasChanges = engine.compareBookDataOptimized(book1, book2)

      // Then: 應該回傳 true（有變更）
      expect(hasChanges).toBe(true)
    })

    test('getFieldChanges() 應該詳細分析欄位變更', () => {
      // Given: 有部分欄位變更的資料
      // eslint-disable-next-line no-unused-vars
      const source = { id: '1', title: 'New Title', progress: 75, lastUpdated: '2025-08-19' }
      // eslint-disable-next-line no-unused-vars
      const target = { id: '1', title: 'Old Title', progress: 50, lastUpdated: '2025-08-19' }

      // When: 獲取欄位變更
      // eslint-disable-next-line no-unused-vars
      const changes = engine.getFieldChanges(source, target)

      // Then: 應該正確識別變更欄位
      expect(changes.title).toBeDefined()
      expect(changes.title.source).toBe('New Title')
      expect(changes.title.target).toBe('Old Title')
      expect(changes.progress).toBeDefined()
      expect(changes.progress.source).toBe(75)
      expect(changes.progress.target).toBe(50)
      expect(changes.lastUpdated).toBeUndefined() // 未變更
    })

    test('getChangeType() 應該正確分類變更類型', () => {
      // Given: 不同的變更情況

      // When & Then: 測試各種變更類型
      expect(engine.getChangeType('old', 'new')).toBe('VALUE_CHANGED')
      expect(engine.getChangeType('value', null)).toBe('ADDED')
      expect(engine.getChangeType(null, 'value')).toBe('REMOVED')
      expect(engine.getChangeType('string', 123)).toBe('TYPE_CHANGED')
      expect(engine.getChangeType(100, 150)).toBe('VALUE_CHANGED')
    })

    test('calculateChangeSeverity() 應該正確評估進度變更嚴重性', () => {
      // Given & When: 測試不同程度的進度變更
      // eslint-disable-next-line no-unused-vars
      const highSeverity = engine.calculateChangeSeverity('progress', 10, 80) // 差異 70
      // eslint-disable-next-line no-unused-vars
      const mediumSeverity = engine.calculateChangeSeverity('progress', 30, 60) // 差異 30
      // eslint-disable-next-line no-unused-vars
      const lowSeverity = engine.calculateChangeSeverity('progress', 45, 55) // 差異 10

      // Then: 應該正確評估嚴重性
      expect(highSeverity).toBe('HIGH')
      expect(mediumSeverity).toBe('MEDIUM')
      expect(lowSeverity).toBe('LOW')
    })

    test('calculateStringSimilarity() 應該正確計算字串相似度', () => {
      // Given & When: 測試不同相似度的字串
      // eslint-disable-next-line no-unused-vars
      const identical = engine.calculateStringSimilarity('hello', 'hello')
      // eslint-disable-next-line no-unused-vars
      const similar = engine.calculateStringSimilarity('hello', 'hallo')
      // eslint-disable-next-line no-unused-vars
      const different = engine.calculateStringSimilarity('hello', 'world')
      // eslint-disable-next-line no-unused-vars
      const empty = engine.calculateStringSimilarity('hello', '')

      // Then: 應該回傳正確的相似度
      expect(identical).toBe(1)
      expect(similar).toBeGreaterThan(0.7)
      expect(different).toBeLessThan(0.3)
      expect(empty).toBe(0)
    })
  })

  describe('⚙️ 配置和最佳化測試', () => {
    test('應該支援大小寫不敏感比較', () => {
      // Given: 大小寫不敏感的引擎
      // eslint-disable-next-line no-unused-vars
      const caseInsensitiveEngine = new DataComparisonEngine({ caseSensitive: false })
      // eslint-disable-next-line no-unused-vars
      const book1 = { title: 'BOOK A', progress: 50 }
      // eslint-disable-next-line no-unused-vars
      const book2 = { title: 'book a', progress: 50 }

      // When: 比較資料
      // eslint-disable-next-line no-unused-vars
      const hasChanges = caseInsensitiveEngine.compareBookDataOptimized(book1, book2)

      // Then: 應該認為沒有變更
      expect(hasChanges).toBe(false)
    })

    test('應該支援數值容錯比較', () => {
      // Given: 有數值容錯的引擎
      // eslint-disable-next-line no-unused-vars
      const tolerantEngine = new DataComparisonEngine({ numericTolerance: 5 })
      // eslint-disable-next-line no-unused-vars
      const book1 = { title: 'Book A', progress: 50 }
      // eslint-disable-next-line no-unused-vars
      const book2 = { title: 'Book A', progress: 52 }

      // When: 比較資料
      // eslint-disable-next-line no-unused-vars
      const hasChanges = tolerantEngine.compareBookDataOptimized(book1, book2)

      // Then: 應該在容錯範圍內認為沒有變更
      expect(hasChanges).toBe(false)
    })

    test('updateConfig() 應該正確更新配置', () => {
      // Given: 初始引擎
      // eslint-disable-next-line no-unused-vars
      const _initialConfig = engine.config.batchSize

      // When: 更新配置
      engine.updateConfig({ batchSize: 200, newOption: true })

      // Then: 應該更新配置
      expect(engine.config.batchSize).toBe(200)
      expect(engine.config.newOption).toBe(true)
      expect(engine.config.compareFields).toBeDefined() // 保持舊配置
    })
  })

  describe('📊 效能和統計測試', () => {
    test('getStatistics() 應該回傳正確的統計資訊', async () => {
      // Given: 執行一些比較操作
      // eslint-disable-next-line no-unused-vars
      const sourceData = [{ id: '1', title: 'Book A', progress: 50 }]
      // eslint-disable-next-line no-unused-vars
      const targetData = [{ id: '1', title: 'Book A', progress: 75 }]

      // When: 執行比較並獲取統計
      await engine.calculateDataDifferences(sourceData, targetData)
      // eslint-disable-next-line no-unused-vars
      const stats = engine.getStatistics()

      // Then: 應該有正確的統計資訊
      expect(stats.totalComparisons).toBe(1)
      expect(stats.totalProcessingTime).toBeGreaterThanOrEqual(0)
      expect(stats.config).toBeDefined()
      expect(stats.timestamp).toBeDefined()
    })

    test('resetStatistics() 應該重置統計計數器', async () => {
      // Given: 執行一些操作
      await engine.calculateDataDifferences([{ id: '1' }], [])

      // When: 重置統計
      engine.resetStatistics()
      // eslint-disable-next-line no-unused-vars
      const stats = engine.getStatistics()

      // Then: 統計應該被重置
      expect(stats.totalComparisons).toBe(0)
      expect(stats.totalProcessingTime).toBe(0)
    })

    test('processBatch() 應該正確處理大量資料', async () => {
      // Given: 大量資料（超過預設批次大小）
      // eslint-disable-next-line no-unused-vars
      const sourceData = Array.from({ length: 250 }, (_, i) => ({
        id: `${i}`,
        title: `Book ${i}`,
        progress: i % 100
      }))
      // eslint-disable-next-line no-unused-vars
      const targetData = Array.from({ length: 200 }, (_, i) => ({
        id: `${i}`,
        title: `Book ${i}`,
        progress: (i + 10) % 100
      }))

      // When: 批次處理
      // eslint-disable-next-line no-unused-vars
      const result = await engine.processBatch(sourceData, targetData)

      // Then: 應該正確處理所有資料
      expect(result.summary.total).toBeGreaterThan(0)
      expect(result.batches).toBeGreaterThan(1) // 應該分批處理
      expect(result.processingTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('⚠️ 錯誤處理測試', () => {
    test('calculateDataDifferences() 應該處理無效輸入', async () => {
      // Given: 無效的輸入資料

      // When & Then: 應該拋出錯誤
      await expect(engine.calculateDataDifferences('not-array', [])).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        details: expect.any(Object)
      })
      await expect(engine.calculateDataDifferences([], 'not-array')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        details: expect.any(Object)
      })
    })

    test('應該優雅處理空資料', async () => {
      // Given: 空資料陣列
      // eslint-disable-next-line no-unused-vars
      const sourceData = []
      // eslint-disable-next-line no-unused-vars
      const targetData = []

      // When: 計算差異
      // eslint-disable-next-line no-unused-vars
      const result = await engine.calculateDataDifferences(sourceData, targetData)

      // Then: 應該回傳空結果
      expect(result.changes.added).toHaveLength(0)
      expect(result.changes.modified).toHaveLength(0)
      expect(result.changes.deleted).toHaveLength(0)
      expect(result.summary.total).toBe(0)
    })

    test('應該優雅處理缺少 id 的項目', async () => {
      // Given: 包含無效項目的資料
      // eslint-disable-next-line no-unused-vars
      const sourceData = [
        { id: '1', title: 'Valid Book' },
        { title: 'Invalid Book without ID' }, // 無效項目
        null, // 無效項目
        { id: '2', title: 'Another Valid Book' }
      ]
      // eslint-disable-next-line no-unused-vars
      const targetData = [
        { id: '1', title: 'Valid Book' }
      ]

      // When: 計算差異
      // eslint-disable-next-line no-unused-vars
      const result = await engine.calculateDataDifferences(sourceData, targetData)

      // Then: 應該只處理有效項目
      expect(result.changes.added).toHaveLength(1)
      expect(result.changes.added[0].id).toBe('2')
    })
  })
})
