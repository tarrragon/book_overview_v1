/**
 * FilterEngine 單元測試
 * TDD 循環 5/8 - BookSearchFilter 職責拆分重構
 *
 * 測試範圍：
 * 1. Construction - 建構器和初始化
 * 2. Filter Application - 基本篩選功能
 * 3. Status Filtering - 狀態篩選
 * 4. Category Filtering - 分類篩選
 * 5. Progress Filtering - 進度篩選
 * 6. Date Filtering - 時間篩選
 * 7. Complex Filtering - 複合條件篩選
 * 8. Event Integration - 事件系統整合
 * 9. Statistics Monitoring - 統計監控
 * 10. Error Handling - 錯誤處理
 * 11. Memory Management - 記憶體管理
 * 12. Tag Filtering - Tag 篩選（v0.17.2 PROP-007）
 * 13. TagCategory Filtering - TagCategory 分類篩選（v0.17.2 PROP-007）
 * 14. Tag + Existing Filter Combination - Tag 與現有篩選組合（v0.17.2 PROP-007）
 */

// eslint-disable-next-line no-unused-vars
const FilterEngine = require('src/ui/search/filter/filter-engine')
// eslint-disable-next-line no-unused-vars
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

describe('FilterEngine', () => {
  let filterEngine
  // eslint-disable-next-line no-unused-vars
  let mockEventBus
  // eslint-disable-next-line no-unused-vars
  let mockLogger
  // eslint-disable-next-line no-unused-vars
  let testBooks

  beforeEach(() => {
    // Mock EventBus
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    }

    // Mock Logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }

    // 測試用書籍資料
    testBooks = [
      {
        id: '1',
        title: 'JavaScript 權威指南',
        author: 'David Flanagan',
        status: 'reading',
        category: 'programming',
        progress: 0.5,
        lastRead: '2025-08-15T10:00:00Z'
      },
      {
        id: '2',
        title: 'Vue.js 設計與實現',
        author: '霍春陽',
        status: 'completed',
        category: 'programming',
        progress: 1.0,
        lastRead: '2025-08-10T15:30:00Z'
      },
      {
        id: '3',
        title: '人類簡史',
        author: 'Yuval Noah Harari',
        status: 'unread',
        category: 'history',
        progress: 0.0,
        lastRead: null
      },
      {
        id: '4',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        status: 'reading',
        category: 'programming',
        progress: 0.3,
        lastRead: '2025-08-18T09:15:00Z'
      }
    ]
  })

  afterEach(() => {
    if (filterEngine) {
      filterEngine.destroy()
    }
    jest.clearAllMocks()
  })

  // ========== 1. Construction 建構器測試 ==========
  describe('Construction', () => {
    it('should create FilterEngine instance with required dependencies', () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger
      })

      expect(filterEngine).toBeInstanceOf(FilterEngine)
      expect(filterEngine.eventBus).toBe(mockEventBus)
      expect(filterEngine.logger).toBe(mockLogger)
    })

    it('should throw error when EventBus is missing', () => {
      expect(() => {
        // eslint-disable-next-line no-unused-vars
        const _engine = new FilterEngine({ logger: mockLogger })
        // 變數賦值確保建構子結果被正確處理，測試錯誤條件
      }).toThrow(expect.objectContaining({ code: expect.any(String) }))
    })

    it('should throw error when Logger is missing', () => {
      expect(() => {
        // eslint-disable-next-line no-unused-vars
        const _engine = new FilterEngine({ eventBus: mockEventBus })
        // 變數賦值確保建構子結果被正確處理，測試錯誤條件
      }).toThrow(expect.objectContaining({ code: expect.any(String) }))
    })

    it('should initialize with default configuration', () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger
      })

      expect(filterEngine.config.enableEvents).toBe(true)
      expect(filterEngine.config.enableStatistics).toBe(true)
      expect(filterEngine.config.enableCaching).toBe(true)
    })

    it('should accept custom configuration', () => {
      // eslint-disable-next-line no-unused-vars
      const customConfig = {
        enableEvents: false,
        enableStatistics: false,
        maxCacheSize: 500
      }

      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: customConfig
      })

      expect(filterEngine.config.enableEvents).toBe(false)
      expect(filterEngine.config.enableStatistics).toBe(false)
      expect(filterEngine.config.maxCacheSize).toBe(500)
    })
  })

  // ========== 2. Filter Application 基本篩選功能 ==========
  describe('Filter Application', () => {
    beforeEach(() => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    it('should return all books when no filters applied', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, {})

      expect(result.filteredBooks).toEqual(testBooks)
      expect(result.totalCount).toBe(4)
      expect(result.appliedFilters).toEqual({})
    })

    it('should handle empty books array', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters([], { status: 'reading' })

      expect(result.filteredBooks).toEqual([])
      expect(result.totalCount).toBe(0)
      expect(result.appliedFilters).toEqual({ status: 'reading' })
    })

    it('should validate input parameters', async () => {
      await expect(filterEngine.applyFilters(null, {})).rejects.toThrow(expect.objectContaining({ code: expect.any(String) }))
      await expect(filterEngine.applyFilters(testBooks, null)).rejects.toThrow(expect.objectContaining({ code: expect.any(String) }))
      await expect(filterEngine.applyFilters('invalid', {})).rejects.toThrow(expect.objectContaining({ code: expect.any(String) }))
    })

    it('should emit filter application events when enabled', async () => {
      // eslint-disable-next-line no-unused-vars
      const filters = { status: 'reading' }
      await filterEngine.applyFilters(testBooks, filters)

      expect(mockEventBus.emit).toHaveBeenCalledWith('FILTER.APPLIED', expect.objectContaining({
        appliedFilters: filters,
        resultCount: expect.any(Number),
        processingTime: expect.any(Number)
      }))
    })
  })

  // ========== 3. Status Filtering 狀態篩選 ==========
  describe('Status Filtering', () => {
    beforeEach(() => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    it('should filter books by reading status', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, { status: 'reading' })

      expect(result.filteredBooks).toHaveLength(2)
      expect(result.filteredBooks[0].title).toBe('JavaScript 權威指南')
      expect(result.filteredBooks[1].title).toBe('Clean Code')
    })

    it('should filter books by completed status', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, { status: 'completed' })

      expect(result.filteredBooks).toHaveLength(1)
      expect(result.filteredBooks[0].title).toBe('Vue.js 設計與實現')
    })

    it('should filter books by unread status', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, { status: 'unread' })

      expect(result.filteredBooks).toHaveLength(1)
      expect(result.filteredBooks[0].title).toBe('人類簡史')
    })

    it('should return empty results for non-existing status', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, { status: 'archived' })

      expect(result.filteredBooks).toHaveLength(0)
    })
  })

  // ========== 4. Category Filtering 分類篩選 ==========
  describe('Category Filtering', () => {
    beforeEach(() => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    it('should filter books by programming category', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, { category: 'programming' })

      expect(result.filteredBooks).toHaveLength(3)
      expect(result.filteredBooks.every(book => book.category === 'programming')).toBe(true)
    })

    it('should filter books by history category', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, { category: 'history' })

      expect(result.filteredBooks).toHaveLength(1)
      expect(result.filteredBooks[0].title).toBe('人類簡史')
    })

    it('should return empty results for non-existing category', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, { category: 'fiction' })

      expect(result.filteredBooks).toHaveLength(0)
    })
  })

  // ========== 5. Progress Filtering 進度篩選 ==========
  describe('Progress Filtering', () => {
    beforeEach(() => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    it('should filter books by progress range', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, {
        progressRange: { min: 0.2, max: 0.8 }
      })

      expect(result.filteredBooks).toHaveLength(2)
      expect(result.filteredBooks.some(book => book.title === 'JavaScript 權威指南')).toBe(true)
      expect(result.filteredBooks.some(book => book.title === 'Clean Code')).toBe(true)
    })

    it('should filter books for completed reading (progress = 1.0)', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, {
        progressRange: { min: 1.0, max: 1.0 }
      })

      expect(result.filteredBooks).toHaveLength(1)
      expect(result.filteredBooks[0].title).toBe('Vue.js 設計與實現')
    })

    it('should filter books for unstarted reading (progress = 0.0)', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, {
        progressRange: { min: 0.0, max: 0.0 }
      })

      expect(result.filteredBooks).toHaveLength(1)
      expect(result.filteredBooks[0].title).toBe('人類簡史')
    })

    it('should handle invalid progress range gracefully', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, {
        progressRange: { min: 0.8, max: 0.2 } // min > max
      })

      expect(result.filteredBooks).toHaveLength(0)
    })
  })

  // ========== 6. Date Filtering 時間篩選 ==========
  describe('Date Filtering', () => {
    beforeEach(() => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    it('should filter books by lastReadAfter date', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, {
        lastReadAfter: '2025-08-12T00:00:00Z'
      })

      expect(result.filteredBooks).toHaveLength(2)
      expect(result.filteredBooks.some(book => book.title === 'JavaScript 權威指南')).toBe(true)
      expect(result.filteredBooks.some(book => book.title === 'Clean Code')).toBe(true)
    })

    it('should filter books by lastReadBefore date', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, {
        lastReadBefore: '2025-08-12T00:00:00Z'
      })

      expect(result.filteredBooks).toHaveLength(1)
      expect(result.filteredBooks[0].title).toBe('Vue.js 設計與實現')
    })

    it('should exclude books with null lastRead when filtering by date', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, {
        lastReadAfter: '2025-08-01T00:00:00Z'
      })

      expect(result.filteredBooks.every(book => book.lastRead !== null)).toBe(true)
    })

    it('should handle invalid date format gracefully', async () => {
      await expect(filterEngine.applyFilters(testBooks, {
        lastReadAfter: 'invalid-date'
      })).rejects.toThrow(expect.objectContaining({ code: expect.any(String) }))
    })
  })

  // ========== 7. Complex Filtering 複合條件篩選 ==========
  describe('Complex Filtering', () => {
    beforeEach(() => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    it('should apply multiple filters simultaneously', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, {
        status: 'reading',
        category: 'programming',
        progressRange: { min: 0.2, max: 0.8 }
      })

      expect(result.filteredBooks).toHaveLength(2)
      expect(result.filteredBooks.every(book =>
        book.status === 'reading' &&
        book.category === 'programming' &&
        book.progress >= 0.2 &&
        book.progress <= 0.8
      )).toBe(true)
    })

    it('should return empty when no books match all conditions', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, {
        status: 'reading',
        category: 'history' // 沒有 reading 狀態的 history 書籍
      })

      expect(result.filteredBooks).toHaveLength(0)
    })

    it('should handle complex date and progress combinations', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, {
        progressRange: { min: 0.1, max: 0.9 },
        lastReadAfter: '2025-08-12T00:00:00Z'
      })

      expect(result.filteredBooks).toHaveLength(2)
    })
  })

  // ========== 8. Event Integration 事件系統整合 ==========
  describe('Event Integration', () => {
    beforeEach(() => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    it('should emit filter started event', async () => {
      await filterEngine.applyFilters(testBooks, { status: 'reading' })

      expect(mockEventBus.emit).toHaveBeenCalledWith('FILTER.STARTED', expect.objectContaining({
        totalBooks: 4,
        appliedFilters: { status: 'reading' }
      }))
    })

    it('should emit filter completed event', async () => {
      await filterEngine.applyFilters(testBooks, { status: 'reading' })

      expect(mockEventBus.emit).toHaveBeenCalledWith('FILTER.COMPLETED', expect.objectContaining({
        resultCount: 2,
        processingTime: expect.any(Number)
      }))
    })

    it('should not emit events when disabled in config', async () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: { enableEvents: false }
      })

      await filterEngine.applyFilters(testBooks, { status: 'reading' })

      expect(mockEventBus.emit).not.toHaveBeenCalled()
    })

    it('should emit filter reset event', async () => {
      await filterEngine.resetFilters()

      expect(mockEventBus.emit).toHaveBeenCalledWith('FILTER.RESET', {
        timestamp: expect.any(Number)
      })
    })
  })

  // ========== 9. Statistics Monitoring 統計監控 ==========
  describe('Statistics Monitoring', () => {
    beforeEach(() => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    it('should track filter operation statistics', async () => {
      await filterEngine.applyFilters(testBooks, { status: 'reading' })
      await filterEngine.applyFilters(testBooks, { category: 'programming' })

      // eslint-disable-next-line no-unused-vars
      const stats = filterEngine.getStatistics()

      expect(stats.totalFilterOperations).toBe(2)
      expect(stats.averageProcessingTime).toBeGreaterThan(0)
      expect(stats.lastProcessingTime).toBeGreaterThan(0)
    })

    it('should track filter criteria usage', async () => {
      await filterEngine.applyFilters(testBooks, { status: 'reading' })
      await filterEngine.applyFilters(testBooks, { status: 'completed' })
      await filterEngine.applyFilters(testBooks, { category: 'programming' })

      // eslint-disable-next-line no-unused-vars
      const stats = filterEngine.getStatistics()

      expect(stats.criteriaUsage.status).toBe(2)
      expect(stats.criteriaUsage.category).toBe(1)
      expect(stats.criteriaUsage.progressRange).toBe(0)
    })

    it('should reset statistics when requested', async () => {
      await filterEngine.applyFilters(testBooks, { status: 'reading' })

      filterEngine.resetStatistics()
      // eslint-disable-next-line no-unused-vars
      const stats = filterEngine.getStatistics()

      expect(stats.totalFilterOperations).toBe(0)
      expect(stats.averageProcessingTime).toBe(0)
      expect(stats.criteriaUsage.status).toBe(0)
    })

    it('should not track statistics when disabled', async () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: { enableStatistics: false }
      })

      await filterEngine.applyFilters(testBooks, { status: 'reading' })
      // eslint-disable-next-line no-unused-vars
      const stats = filterEngine.getStatistics()

      expect(stats.totalFilterOperations).toBe(0)
    })
  })

  // ========== 10. Error Handling 錯誤處理 ==========
  describe('Error Handling', () => {
    beforeEach(() => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    it('should handle books with missing properties gracefully', async () => {
      // eslint-disable-next-line no-unused-vars
      const invalidBooks = [
        { id: '1', title: 'Book 1' }, // missing other properties
        { id: '2' }, // missing title
        null, // null book
        undefined // undefined book
      ]

      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(invalidBooks, { status: 'reading' })

      expect(result.filteredBooks).toHaveLength(0)
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should log error and throw when filter operation fails', async () => {
      // 模擬內部錯誤
      // eslint-disable-next-line no-unused-vars
      const mockError = new Error('Internal filter error')
      jest.spyOn(filterEngine, '_applyStatusFilter').mockImplementation(() => {
        throw mockError
      })

      await expect(filterEngine.applyFilters(testBooks, { status: 'reading' })).rejects.toThrow(mockError)
      expect(mockLogger.error).toHaveBeenCalledWith('篩選操作失敗', expect.objectContaining({
        error: mockError.message,
        filters: { status: 'reading' }
      }))
    })

    it('should throw error when FilterEngine is destroyed', async () => {
      filterEngine.destroy()

      await expect(filterEngine.applyFilters(testBooks, {})).rejects.toThrow(expect.objectContaining({ code: expect.any(String) }))
    })

    it('should handle invalid filter criteria gracefully', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(testBooks, {
        unknownFilter: 'value',
        invalidProgressRange: 'not-an-object'
      })

      expect(result.filteredBooks).toEqual(testBooks)
      expect(mockLogger.warn).toHaveBeenCalledWith('未知的篩選條件', expect.objectContaining({
        criterion: 'unknownFilter'
      }))
    })
  })

  // ========== 11. Memory Management 記憶體管理 ==========
  describe('Memory Management', () => {
    beforeEach(() => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    it('should cleanup internal state', () => {
      filterEngine.cleanup()

      // eslint-disable-next-line no-unused-vars
      const stats = filterEngine.getStatistics()
      expect(stats.totalFilterOperations).toBe(0)
    })

    it('should destroy FilterEngine instance', () => {
      expect(filterEngine._isDestroyed).toBe(false)

      filterEngine.destroy()

      expect(filterEngine._isDestroyed).toBe(true)
    })

    it('should manage filter cache size', async () => {
      // 啟用快取
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: { enableCaching: true, maxCacheSize: 2 }
      })

      // 執行多次篩選操作以測試快取管理
      await filterEngine.applyFilters(testBooks, { status: 'reading' })
      await filterEngine.applyFilters(testBooks, { category: 'programming' })
      await filterEngine.applyFilters(testBooks, { status: 'completed' }) // 應觸發快取清理

      // eslint-disable-next-line no-unused-vars
      const cacheSize = filterEngine._getCacheSize()
      expect(cacheSize).toBeLessThanOrEqual(2)
    })

    it('should clear filter cache when requested', async () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: { enableCaching: true }
      })

      await filterEngine.applyFilters(testBooks, { status: 'reading' })
      expect(filterEngine._getCacheSize()).toBeGreaterThan(0)

      filterEngine.clearCache()
      expect(filterEngine._getCacheSize()).toBe(0)
    })
  })

  // ========== 12. Tag Filtering Tag 篩選 ==========
  describe('Tag Filtering', () => {
    // eslint-disable-next-line no-unused-vars
    let tagBooks
    // eslint-disable-next-line no-unused-vars
    let mockTagResolver
    // eslint-disable-next-line no-unused-vars
    let mockCategoryResolver

    beforeEach(() => {
      // 含 tagIds 的測試書籍
      tagBooks = [
        { id: '1', title: 'JS Guide', status: 'reading', category: 'programming', progress: 0.5, lastRead: '2025-08-15T10:00:00Z', tagIds: ['tag-js', 'tag-web'] },
        { id: '2', title: 'Vue Design', status: 'completed', category: 'programming', progress: 1.0, lastRead: '2025-08-10T15:30:00Z', tagIds: ['tag-js', 'tag-vue'] },
        { id: '3', title: 'Sapiens', status: 'unread', category: 'history', progress: 0.0, lastRead: null, tagIds: ['tag-history'] },
        { id: '4', title: 'Clean Code', status: 'reading', category: 'programming', progress: 0.3, lastRead: '2025-08-18T09:15:00Z', tagIds: [] },
        { id: '5', title: 'Old Book', status: 'reading', category: 'misc', progress: 0.1, lastRead: '2025-07-01T00:00:00Z' } // 無 tagIds 欄位
      ]

      // Mock tagResolver: tagId => Tag | null
      mockTagResolver = jest.fn((tagId) => {
        const tags = {
          'tag-js': { id: 'tag-js', name: 'JavaScript', categoryId: 'cat-prog' },
          'tag-web': { id: 'tag-web', name: 'Web Development', categoryId: 'cat-prog' },
          'tag-vue': { id: 'tag-vue', name: 'Vue.js', categoryId: 'cat-prog' },
          'tag-history': { id: 'tag-history', name: 'History', categoryId: 'cat-humanities' }
        }
        return tags[tagId] || null
      })

      // Mock categoryResolver: categoryId => tagId[]
      mockCategoryResolver = jest.fn((catId) => {
        const categories = {
          'cat-prog': ['tag-js', 'tag-vue', 'tag-web'],
          'cat-humanities': ['tag-history']
        }
        return categories[catId] || []
      })
    })

    it('should create FilterEngine with optional tagResolver without error', () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        tagResolver: mockTagResolver
      })

      expect(filterEngine).toBeInstanceOf(FilterEngine)
    })

    it('should create FilterEngine with optional categoryResolver without error', () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        categoryResolver: mockCategoryResolver
      })

      expect(filterEngine).toBeInstanceOf(FilterEngine)
    })

    it('should create FilterEngine without tagResolver or categoryResolver (backward compatible)', () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger
      })

      expect(filterEngine).toBeInstanceOf(FilterEngine)
    })

    it('should filter books by tagIds with OR operator (default)', async () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        tagResolver: mockTagResolver
      })

      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(tagBooks, {
        tagIds: ['tag-js', 'tag-history']
      })

      // OR: 書籍含 tag-js 或 tag-history 即匹配 → book 1, 2, 3
      expect(result.filteredBooks).toHaveLength(3)
      expect(result.filteredBooks.map(b => b.id).sort()).toEqual(['1', '2', '3'])
    })

    it('should filter books by tagIds with AND operator', async () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        tagResolver: mockTagResolver
      })

      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(tagBooks, {
        tagIds: ['tag-js', 'tag-web'],
        tagOperator: 'AND'
      })

      // AND: 書籍必須同時含 tag-js 和 tag-web → 只有 book 1
      expect(result.filteredBooks).toHaveLength(1)
      expect(result.filteredBooks[0].id).toBe('1')
    })

    it('should return all books when tagIds is empty array', async () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        tagResolver: mockTagResolver
      })

      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(tagBooks, {
        tagIds: []
      })

      expect(result.filteredBooks).toHaveLength(5)
    })

    it('should exclude books without tagIds field when tag filter is active', async () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        tagResolver: mockTagResolver
      })

      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(tagBooks, {
        tagIds: ['tag-js']
      })

      // book 4 (empty tagIds) and book 5 (no tagIds) should be excluded
      expect(result.filteredBooks.every(b => b.tagIds && b.tagIds.length > 0)).toBe(true)
    })

    it('should handle non-existent tagId gracefully (no error)', async () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        tagResolver: mockTagResolver
      })

      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(tagBooks, {
        tagIds: ['tag-nonexistent']
      })

      // No book has this tag, so no matches
      expect(result.filteredBooks).toHaveLength(0)
    })
  })

  // ========== 13. TagCategory Filtering TagCategory 分類篩選 ==========
  describe('TagCategory Filtering', () => {
    // eslint-disable-next-line no-unused-vars
    let tagBooks
    // eslint-disable-next-line no-unused-vars
    let mockTagResolver
    // eslint-disable-next-line no-unused-vars
    let mockCategoryResolver

    beforeEach(() => {
      tagBooks = [
        { id: '1', title: 'JS Guide', status: 'reading', category: 'programming', progress: 0.5, lastRead: '2025-08-15T10:00:00Z', tagIds: ['tag-js', 'tag-web'] },
        { id: '2', title: 'Vue Design', status: 'completed', category: 'programming', progress: 1.0, lastRead: '2025-08-10T15:30:00Z', tagIds: ['tag-js', 'tag-vue'] },
        { id: '3', title: 'Sapiens', status: 'unread', category: 'history', progress: 0.0, lastRead: null, tagIds: ['tag-history'] },
        { id: '4', title: 'Clean Code', status: 'reading', category: 'programming', progress: 0.3, lastRead: '2025-08-18T09:15:00Z', tagIds: [] },
        { id: '5', title: 'Old Book', status: 'reading', category: 'misc', progress: 0.1, lastRead: '2025-07-01T00:00:00Z' }
      ]

      mockTagResolver = jest.fn((tagId) => {
        const tags = {
          'tag-js': { id: 'tag-js', name: 'JavaScript', categoryId: 'cat-prog' },
          'tag-web': { id: 'tag-web', name: 'Web Development', categoryId: 'cat-prog' },
          'tag-vue': { id: 'tag-vue', name: 'Vue.js', categoryId: 'cat-prog' },
          'tag-history': { id: 'tag-history', name: 'History', categoryId: 'cat-humanities' }
        }
        return tags[tagId] || null
      })

      mockCategoryResolver = jest.fn((catId) => {
        const categories = {
          'cat-prog': ['tag-js', 'tag-vue', 'tag-web'],
          'cat-humanities': ['tag-history']
        }
        return categories[catId] || []
      })
    })

    it('should filter books by tagCategoryIds (expand category to tags)', async () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        tagResolver: mockTagResolver,
        categoryResolver: mockCategoryResolver
      })

      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(tagBooks, {
        tagCategoryIds: ['cat-prog']
      })

      // cat-prog expands to [tag-js, tag-vue, tag-web], books with any → book 1, 2
      expect(result.filteredBooks).toHaveLength(2)
      expect(result.filteredBooks.map(b => b.id).sort()).toEqual(['1', '2'])
    })

    it('should match books with any tag from any specified category', async () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        tagResolver: mockTagResolver,
        categoryResolver: mockCategoryResolver
      })

      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(tagBooks, {
        tagCategoryIds: ['cat-prog', 'cat-humanities']
      })

      // Both categories → book 1, 2, 3
      expect(result.filteredBooks).toHaveLength(3)
      expect(result.filteredBooks.map(b => b.id).sort()).toEqual(['1', '2', '3'])
    })

    it('should silently skip tagCategoryIds filter when no categoryResolver', async () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger
        // no categoryResolver
      })

      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(tagBooks, {
        tagCategoryIds: ['cat-prog']
      })

      // Without resolver, filter is skipped → all books returned
      expect(result.filteredBooks).toHaveLength(5)
    })

    it('should return all books when tagCategoryIds is empty array', async () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        tagResolver: mockTagResolver,
        categoryResolver: mockCategoryResolver
      })

      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(tagBooks, {
        tagCategoryIds: []
      })

      expect(result.filteredBooks).toHaveLength(5)
    })
  })

  // ========== 14. Tag + Existing Filter Combination Tag 與現有篩選組合 ==========
  describe('Tag + Existing Filter Combination', () => {
    // eslint-disable-next-line no-unused-vars
    let tagBooks
    // eslint-disable-next-line no-unused-vars
    let mockTagResolver
    // eslint-disable-next-line no-unused-vars
    let mockCategoryResolver

    beforeEach(() => {
      tagBooks = [
        { id: '1', title: 'JS Guide', status: 'reading', category: 'programming', progress: 0.5, lastRead: '2025-08-15T10:00:00Z', tagIds: ['tag-js', 'tag-web'] },
        { id: '2', title: 'Vue Design', status: 'completed', category: 'programming', progress: 1.0, lastRead: '2025-08-10T15:30:00Z', tagIds: ['tag-js', 'tag-vue'] },
        { id: '3', title: 'Sapiens', status: 'unread', category: 'history', progress: 0.0, lastRead: null, tagIds: ['tag-history'] },
        { id: '4', title: 'Clean Code', status: 'reading', category: 'programming', progress: 0.3, lastRead: '2025-08-18T09:15:00Z', tagIds: [] },
        { id: '5', title: 'Old Book', status: 'reading', category: 'misc', progress: 0.1, lastRead: '2025-07-01T00:00:00Z' }
      ]

      mockTagResolver = jest.fn((tagId) => {
        const tags = {
          'tag-js': { id: 'tag-js', name: 'JavaScript', categoryId: 'cat-prog' },
          'tag-web': { id: 'tag-web', name: 'Web Development', categoryId: 'cat-prog' },
          'tag-vue': { id: 'tag-vue', name: 'Vue.js', categoryId: 'cat-prog' },
          'tag-history': { id: 'tag-history', name: 'History', categoryId: 'cat-humanities' }
        }
        return tags[tagId] || null
      })

      mockCategoryResolver = jest.fn((catId) => {
        const categories = {
          'cat-prog': ['tag-js', 'tag-vue', 'tag-web'],
          'cat-humanities': ['tag-history']
        }
        return categories[catId] || []
      })
    })

    it('should combine tagIds filter with status filter', async () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        tagResolver: mockTagResolver
      })

      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(tagBooks, {
        tagIds: ['tag-js'],
        status: 'reading'
      })

      // tag-js → book 1, 2; status reading → book 1 only
      expect(result.filteredBooks).toHaveLength(1)
      expect(result.filteredBooks[0].id).toBe('1')
    })

    it('should combine tagIds filter with category filter', async () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        tagResolver: mockTagResolver
      })

      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(tagBooks, {
        tagIds: ['tag-js', 'tag-history'],
        category: 'programming'
      })

      // tagIds OR → book 1, 2, 3; category programming → book 1, 2
      expect(result.filteredBooks).toHaveLength(2)
      expect(result.filteredBooks.map(b => b.id).sort()).toEqual(['1', '2'])
    })

    it('should combine tagCategoryIds filter with status filter', async () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        tagResolver: mockTagResolver,
        categoryResolver: mockCategoryResolver
      })

      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(tagBooks, {
        tagCategoryIds: ['cat-prog'],
        status: 'completed'
      })

      // cat-prog → book 1, 2; completed → book 2 only
      expect(result.filteredBooks).toHaveLength(1)
      expect(result.filteredBooks[0].id).toBe('2')
    })

    it('should combine tagIds and tagCategoryIds simultaneously', async () => {
      filterEngine = new FilterEngine({
        eventBus: mockEventBus,
        logger: mockLogger,
        tagResolver: mockTagResolver,
        categoryResolver: mockCategoryResolver
      })

      // eslint-disable-next-line no-unused-vars
      const result = await filterEngine.applyFilters(tagBooks, {
        tagIds: ['tag-history'],
        tagCategoryIds: ['cat-prog']
      })

      // tagIds OR tag-history → book 3; then tagCategoryIds cat-prog → book 1, 2
      // Both filters applied sequentially (AND): intersection = empty
      // Actually: tagIds filter first → book 3 only; then tagCategoryIds → book 3 has tag-history not in cat-prog → empty
      expect(result.filteredBooks).toHaveLength(0)
    })
  })
})
