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
 */

const FilterEngine = require('src/ui/search/filter/filter-engine')

describe('FilterEngine', () => {
  let filterEngine
  let mockEventBus
  let mockLogger
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
        new FilterEngine({ logger: mockLogger })
      }).toThrow('EventBus 和 Logger 是必需的')
    })

    it('should throw error when Logger is missing', () => {
      expect(() => {
        new FilterEngine({ eventBus: mockEventBus })
      }).toThrow('EventBus 和 Logger 是必需的')
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
      const result = await filterEngine.applyFilters(testBooks, {})

      expect(result.filteredBooks).toEqual(testBooks)
      expect(result.totalCount).toBe(4)
      expect(result.appliedFilters).toEqual({})
    })

    it('should handle empty books array', async () => {
      const result = await filterEngine.applyFilters([], { status: 'reading' })

      expect(result.filteredBooks).toEqual([])
      expect(result.totalCount).toBe(0)
      expect(result.appliedFilters).toEqual({ status: 'reading' })
    })

    it('should validate input parameters', async () => {
      await expect(filterEngine.applyFilters(null, {})).rejects.toThrow('書籍陣列是必需的')
      await expect(filterEngine.applyFilters(testBooks, null)).rejects.toThrow('篩選條件是必需的')
      await expect(filterEngine.applyFilters('invalid', {})).rejects.toThrow('書籍陣列是必需的')
    })

    it('should emit filter application events when enabled', async () => {
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
      const result = await filterEngine.applyFilters(testBooks, { status: 'reading' })

      expect(result.filteredBooks).toHaveLength(2)
      expect(result.filteredBooks[0].title).toBe('JavaScript 權威指南')
      expect(result.filteredBooks[1].title).toBe('Clean Code')
    })

    it('should filter books by completed status', async () => {
      const result = await filterEngine.applyFilters(testBooks, { status: 'completed' })

      expect(result.filteredBooks).toHaveLength(1)
      expect(result.filteredBooks[0].title).toBe('Vue.js 設計與實現')
    })

    it('should filter books by unread status', async () => {
      const result = await filterEngine.applyFilters(testBooks, { status: 'unread' })

      expect(result.filteredBooks).toHaveLength(1)
      expect(result.filteredBooks[0].title).toBe('人類簡史')
    })

    it('should return empty results for non-existing status', async () => {
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
      const result = await filterEngine.applyFilters(testBooks, { category: 'programming' })

      expect(result.filteredBooks).toHaveLength(3)
      expect(result.filteredBooks.every(book => book.category === 'programming')).toBe(true)
    })

    it('should filter books by history category', async () => {
      const result = await filterEngine.applyFilters(testBooks, { category: 'history' })

      expect(result.filteredBooks).toHaveLength(1)
      expect(result.filteredBooks[0].title).toBe('人類簡史')
    })

    it('should return empty results for non-existing category', async () => {
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
      const result = await filterEngine.applyFilters(testBooks, {
        progressRange: { min: 0.2, max: 0.8 }
      })

      expect(result.filteredBooks).toHaveLength(2)
      expect(result.filteredBooks.some(book => book.title === 'JavaScript 權威指南')).toBe(true)
      expect(result.filteredBooks.some(book => book.title === 'Clean Code')).toBe(true)
    })

    it('should filter books for completed reading (progress = 1.0)', async () => {
      const result = await filterEngine.applyFilters(testBooks, {
        progressRange: { min: 1.0, max: 1.0 }
      })

      expect(result.filteredBooks).toHaveLength(1)
      expect(result.filteredBooks[0].title).toBe('Vue.js 設計與實現')
    })

    it('should filter books for unstarted reading (progress = 0.0)', async () => {
      const result = await filterEngine.applyFilters(testBooks, {
        progressRange: { min: 0.0, max: 0.0 }
      })

      expect(result.filteredBooks).toHaveLength(1)
      expect(result.filteredBooks[0].title).toBe('人類簡史')
    })

    it('should handle invalid progress range gracefully', async () => {
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
      const result = await filterEngine.applyFilters(testBooks, {
        lastReadAfter: '2025-08-12T00:00:00Z'
      })

      expect(result.filteredBooks).toHaveLength(2)
      expect(result.filteredBooks.some(book => book.title === 'JavaScript 權威指南')).toBe(true)
      expect(result.filteredBooks.some(book => book.title === 'Clean Code')).toBe(true)
    })

    it('should filter books by lastReadBefore date', async () => {
      const result = await filterEngine.applyFilters(testBooks, {
        lastReadBefore: '2025-08-12T00:00:00Z'
      })

      expect(result.filteredBooks).toHaveLength(1)
      expect(result.filteredBooks[0].title).toBe('Vue.js 設計與實現')
    })

    it('should exclude books with null lastRead when filtering by date', async () => {
      const result = await filterEngine.applyFilters(testBooks, {
        lastReadAfter: '2025-08-01T00:00:00Z'
      })

      expect(result.filteredBooks.every(book => book.lastRead !== null)).toBe(true)
    })

    it('should handle invalid date format gracefully', async () => {
      await expect(filterEngine.applyFilters(testBooks, {
        lastReadAfter: 'invalid-date'
      })).rejects.toThrow('無效的日期格式')
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
      const result = await filterEngine.applyFilters(testBooks, {
        status: 'reading',
        category: 'history' // 沒有 reading 狀態的 history 書籍
      })

      expect(result.filteredBooks).toHaveLength(0)
    })

    it('should handle complex date and progress combinations', async () => {
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

      const stats = filterEngine.getStatistics()

      expect(stats.totalFilterOperations).toBe(2)
      expect(stats.averageProcessingTime).toBeGreaterThan(0)
      expect(stats.lastProcessingTime).toBeGreaterThan(0)
    })

    it('should track filter criteria usage', async () => {
      await filterEngine.applyFilters(testBooks, { status: 'reading' })
      await filterEngine.applyFilters(testBooks, { status: 'completed' })
      await filterEngine.applyFilters(testBooks, { category: 'programming' })

      const stats = filterEngine.getStatistics()

      expect(stats.criteriaUsage.status).toBe(2)
      expect(stats.criteriaUsage.category).toBe(1)
      expect(stats.criteriaUsage.progressRange).toBe(0)
    })

    it('should reset statistics when requested', async () => {
      await filterEngine.applyFilters(testBooks, { status: 'reading' })

      filterEngine.resetStatistics()
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
      const invalidBooks = [
        { id: '1', title: 'Book 1' }, // missing other properties
        { id: '2' }, // missing title
        null, // null book
        undefined // undefined book
      ]

      const result = await filterEngine.applyFilters(invalidBooks, { status: 'reading' })

      expect(result.filteredBooks).toHaveLength(0)
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should log error and throw when filter operation fails', async () => {
      // 模擬內部錯誤
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

      await expect(filterEngine.applyFilters(testBooks, {})).rejects.toThrow('篩選器已被銷毀')
    })

    it('should handle invalid filter criteria gracefully', async () => {
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
})
