/**
 * SearchCoordinator 單元測試
 * TDD 循環 6/8 - BookSearchFilter 職責拆分重構
 *
 * 測試範圍：
 * 1. Construction - 建構器和模組依賴注入
 * 2. Search Orchestration - 搜尋流程協調
 * 3. Filter Integration - 篩選整合協調
 * 4. Module Communication - 模組間通訊協調
 * 5. Event Coordination - 事件協調和轉發
 * 6. Error Coordination - 錯誤處理協調
 * 7. Cache Coordination - 快取協調管理
 * 8. Performance Monitoring - 效能監控協調
 * 9. State Management - 狀態管理協調
 * 10. Lifecycle Management - 生命週期管理
 */

const SearchCoordinator = require('src/ui/search/coordinator/search-coordinator')

describe('SearchCoordinator', () => {
  let searchCoordinator
  let mockEventBus
  let mockLogger
  let mockSearchEngine
  let mockFilterEngine
  let mockSearchResultFormatter
  let mockSearchCacheManager
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

    // Mock SearchEngine
    mockSearchEngine = {
      search: jest.fn(),
      getStatistics: jest.fn(() => ({ totalSearches: 0, averageTime: 0 })),
      cleanup: jest.fn(),
      destroy: jest.fn()
    }

    // Mock FilterEngine
    mockFilterEngine = {
      applyFilters: jest.fn(),
      resetFilters: jest.fn(),
      getStatistics: jest.fn(() => ({ totalFilterOperations: 0 })),
      cleanup: jest.fn(),
      destroy: jest.fn()
    }

    // Mock SearchResultFormatter
    mockSearchResultFormatter = {
      formatResults: jest.fn(),
      emitResults: jest.fn(),
      getStatistics: jest.fn(() => ({ totalFormatOperations: 0 })),
      cleanup: jest.fn(),
      destroy: jest.fn()
    }

    // Mock SearchCacheManager
    mockSearchCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn(() => ({ hits: 0, misses: 0 })),
      cleanup: jest.fn(),
      destroy: jest.fn()
    }

    // 測試用書籍資料
    testBooks = [
      {
        id: '1',
        title: 'JavaScript 權威指南',
        author: 'David Flanagan',
        status: 'reading',
        category: 'programming'
      },
      {
        id: '2',
        title: 'Vue.js 設計與實現',
        author: '霍春陽',
        status: 'completed',
        category: 'programming'
      },
      {
        id: '3',
        title: '人類簡史',
        author: 'Yuval Noah Harari',
        status: 'unread',
        category: 'history'
      }
    ]
  })

  afterEach(() => {
    if (searchCoordinator) {
      searchCoordinator.destroy()
    }
    jest.clearAllMocks()
  })

  // Helper function to setup standard mocks
  const setupStandardMocks = () => {
    mockSearchCacheManager.get.mockResolvedValue(null)
    mockSearchEngine.search.mockResolvedValue([testBooks[0]])
    mockFilterEngine.applyFilters.mockResolvedValue({
      filteredBooks: [testBooks[0]],
      totalCount: 1
    })
    mockSearchResultFormatter.formatResults.mockResolvedValue({
      results: [testBooks[0]],
      metadata: { totalCount: 1 }
    })
  }

  // ========== 1. Construction 建構器測試 ==========
  describe('Construction', () => {
    it('should create SearchCoordinator instance with required dependencies', () => {
      searchCoordinator = new SearchCoordinator({
        eventBus: mockEventBus,
        logger: mockLogger,
        searchEngine: mockSearchEngine,
        filterEngine: mockFilterEngine,
        searchResultFormatter: mockSearchResultFormatter,
        searchCacheManager: mockSearchCacheManager
      })

      expect(searchCoordinator).toBeInstanceOf(SearchCoordinator)
      expect(searchCoordinator.eventBus).toBe(mockEventBus)
      expect(searchCoordinator.logger).toBe(mockLogger)
      expect(searchCoordinator.searchEngine).toBe(mockSearchEngine)
      expect(searchCoordinator.filterEngine).toBe(mockFilterEngine)
    })

    it('should throw error when EventBus is missing', () => {
      expect(() => {
        new SearchCoordinator({
          logger: mockLogger,
          searchEngine: mockSearchEngine,
          filterEngine: mockFilterEngine,
          searchResultFormatter: mockSearchResultFormatter,
          searchCacheManager: mockSearchCacheManager
        })
      }).toMatchObject({
        message: expect.stringContaining('EventBus 是必需的')
      })
    })

    it('should throw error when Logger is missing', () => {
      expect(() => {
        new SearchCoordinator({
          eventBus: mockEventBus,
          searchEngine: mockSearchEngine,
          filterEngine: mockFilterEngine,
          searchResultFormatter: mockSearchResultFormatter,
          searchCacheManager: mockSearchCacheManager
        })
      }).toMatchObject({
        message: expect.stringContaining('Logger 是必需的')
      })
    })

    it('should throw error when SearchEngine is missing', () => {
      expect(() => {
        new SearchCoordinator({
          eventBus: mockEventBus,
          logger: mockLogger,
          filterEngine: mockFilterEngine,
          searchResultFormatter: mockSearchResultFormatter,
          searchCacheManager: mockSearchCacheManager
        })
      }).toMatchObject({
        message: expect.stringContaining('SearchEngine 是必需的')
      })
    })

    it('should initialize with default configuration', () => {
      searchCoordinator = new SearchCoordinator({
        eventBus: mockEventBus,
        logger: mockLogger,
        searchEngine: mockSearchEngine,
        filterEngine: mockFilterEngine,
        searchResultFormatter: mockSearchResultFormatter,
        searchCacheManager: mockSearchCacheManager
      })

      expect(searchCoordinator.config.enableCaching).toBe(true)
      expect(searchCoordinator.config.enableEvents).toBe(true)
      expect(searchCoordinator.config.enableStatistics).toBe(true)
      expect(searchCoordinator.config.debounceDelay).toBe(300)
    })

    it('should register event listeners during construction', () => {
      searchCoordinator = new SearchCoordinator({
        eventBus: mockEventBus,
        logger: mockLogger,
        searchEngine: mockSearchEngine,
        filterEngine: mockFilterEngine,
        searchResultFormatter: mockSearchResultFormatter,
        searchCacheManager: mockSearchCacheManager
      })

      expect(mockEventBus.on).toHaveBeenCalledWith('SEARCH.EXECUTE', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('FILTER.APPLY', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('BOOKS.DATA.UPDATED', expect.any(Function))
    })
  })

  // ========== 2. Search Orchestration 搜尋流程協調 ==========
  describe('Search Orchestration', () => {
    beforeEach(() => {
      searchCoordinator = new SearchCoordinator({
        eventBus: mockEventBus,
        logger: mockLogger,
        searchEngine: mockSearchEngine,
        filterEngine: mockFilterEngine,
        searchResultFormatter: mockSearchResultFormatter,
        searchCacheManager: mockSearchCacheManager
      })

      // Set books data for coordination
      searchCoordinator.booksData = testBooks

      // Setup mocks for successful search flow
      mockSearchCacheManager.get.mockResolvedValue(null) // Cache miss
      mockSearchEngine.search.mockResolvedValue([testBooks[0], testBooks[1]])
      mockFilterEngine.applyFilters.mockResolvedValue({
        filteredBooks: [testBooks[0]],
        totalCount: 1
      })
      mockSearchResultFormatter.formatResults.mockResolvedValue({
        results: [testBooks[0]],
        metadata: { totalCount: 1 }
      })
    })

    it('should execute complete search orchestration flow', async () => {
      const query = 'JavaScript'
      const filters = { status: 'reading' }

      const result = await searchCoordinator.executeSearch(query, filters)

      expect(mockSearchCacheManager.get).toHaveBeenCalledWith(expect.stringMatching(/javascript.*reading/))
      expect(mockSearchEngine.search).toHaveBeenCalledWith(query, testBooks)
      expect(mockFilterEngine.applyFilters).toHaveBeenCalledWith([testBooks[0], testBooks[1]], filters)
      expect(mockSearchResultFormatter.formatResults).toHaveBeenCalled()

      expect(result.results).toBeDefined()
      expect(result.metadata).toBeDefined()
    })

    it('should use cached results when available', async () => {
      const cachedResult = { results: [testBooks[0]], metadata: { cached: true } }
      mockSearchCacheManager.get.mockResolvedValue(cachedResult)

      const result = await searchCoordinator.executeSearch('JavaScript', {})

      expect(mockSearchEngine.search).not.toHaveBeenCalled()
      expect(result).toBe(cachedResult)
    })

    it('should handle empty query by returning all books', async () => {
      mockSearchCacheManager.get.mockResolvedValue(null)
      mockFilterEngine.applyFilters.mockResolvedValue({
        filteredBooks: testBooks,
        totalCount: 3
      })
      mockSearchResultFormatter.formatResults.mockResolvedValue({
        results: testBooks,
        metadata: { totalCount: 3 }
      })

      const result = await searchCoordinator.executeSearch('', {})

      expect(mockSearchEngine.search).not.toHaveBeenCalled()
      expect(mockFilterEngine.applyFilters).toHaveBeenCalledWith(testBooks, {})
    })

    it('should validate search query before execution', async () => {
      await expect(searchCoordinator.executeSearch(null, {})).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })
      await expect(searchCoordinator.executeSearch(undefined, {})).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })
    })

    it('should emit search events during orchestration', async () => {
      await searchCoordinator.executeSearch('JavaScript', {})

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.STARTED', expect.objectContaining({
        query: 'JavaScript'
      }))
      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.COMPLETED', expect.objectContaining({
        resultCount: expect.any(Number)
      }))
    })

    it('should handle debounced search execution', async () => {
      jest.useFakeTimers()

      searchCoordinator.debouncedSearch('test', {})
      const promise2 = searchCoordinator.debouncedSearch('testing', {})

      // Fast-forward time
      jest.advanceTimersByTime(300)

      await promise2

      expect(mockSearchEngine.search).toHaveBeenCalledTimes(1)
      expect(mockSearchEngine.search).toHaveBeenCalledWith('testing', testBooks)

      jest.useRealTimers()
    })
  })

  // ========== 3. Filter Integration 篩選整合協調 ==========
  describe('Filter Integration', () => {
    beforeEach(() => {
      searchCoordinator = new SearchCoordinator({
        eventBus: mockEventBus,
        logger: mockLogger,
        searchEngine: mockSearchEngine,
        filterEngine: mockFilterEngine,
        searchResultFormatter: mockSearchResultFormatter,
        searchCacheManager: mockSearchCacheManager
      })

      searchCoordinator.booksData = testBooks
      mockSearchEngine.search.mockResolvedValue(testBooks)
    })

    it('should coordinate filter application with search results', async () => {
      const filters = { status: 'reading', category: 'programming' }
      const searchResults = [testBooks[0], testBooks[1]]
      const filteredResult = { filteredBooks: [testBooks[0]], totalCount: 1 }

      mockFilterEngine.applyFilters.mockResolvedValue(filteredResult)

      const result = await searchCoordinator.applyFiltersToResults(searchResults, filters)

      expect(mockFilterEngine.applyFilters).toHaveBeenCalledWith(searchResults, filters)
      expect(result).toBe(filteredResult)
    })

    it('should emit filter events during coordination', async () => {
      mockFilterEngine.applyFilters.mockResolvedValue({ filteredBooks: [], totalCount: 0 })

      await searchCoordinator.applyFiltersToResults(testBooks, { status: 'archived' })

      expect(mockEventBus.emit).toHaveBeenCalledWith('COORDINATOR.FILTER.STARTED', expect.any(Object))
      expect(mockEventBus.emit).toHaveBeenCalledWith('COORDINATOR.FILTER.COMPLETED', expect.any(Object))
    })

    it('should handle filter reset coordination', async () => {
      await searchCoordinator.resetFilters()

      expect(mockFilterEngine.resetFilters).toHaveBeenCalled()
      expect(mockEventBus.emit).toHaveBeenCalledWith('COORDINATOR.FILTERS.RESET', expect.any(Object))
    })

    it('should validate filter parameters', async () => {
      await expect(searchCoordinator.applyFiltersToResults(null, {}))
        .rejects.toMatchObject({
          code: 'TEST_ERROR',
          message: expect.any(String),
          details: expect.any(Object)
        })
      await expect(searchCoordinator.applyFiltersToResults([], null))
        .rejects.toMatchObject({
          code: 'TEST_ERROR',
          message: expect.any(String),
          details: expect.any(Object)
        })
    })
  })

  // ========== 4. Module Communication 模組間通訊協調 ==========
  describe('Module Communication', () => {
    beforeEach(() => {
      searchCoordinator = new SearchCoordinator({
        eventBus: mockEventBus,
        logger: mockLogger,
        searchEngine: mockSearchEngine,
        filterEngine: mockFilterEngine,
        searchResultFormatter: mockSearchResultFormatter,
        searchCacheManager: mockSearchCacheManager
      })
      searchCoordinator.booksData = testBooks
    })

    it('should coordinate data updates across all modules', async () => {
      const newBooks = [{ id: '4', title: 'New Book', author: 'Author' }]

      await searchCoordinator.updateBooksData(newBooks)

      expect(searchCoordinator.booksData).toBe(newBooks)
      expect(mockSearchCacheManager.clear).toHaveBeenCalled()
    })

    it('should collect statistics from all modules', async () => {
      mockSearchEngine.getStatistics.mockReturnValue({ totalSearches: 10, averageTime: 50 })
      mockFilterEngine.getStatistics.mockReturnValue({ totalFilterOperations: 5 })
      mockSearchResultFormatter.getStatistics.mockReturnValue({ totalFormatOperations: 8 })
      mockSearchCacheManager.getStats.mockReturnValue({ hits: 3, misses: 7 })

      // Execute some operations to generate coordinator statistics
      setupStandardMocks()
      await searchCoordinator.executeSearch('test', {})

      const stats = await searchCoordinator.getCoordinatedStatistics()

      expect(stats.searchEngine).toEqual({ totalSearches: 10, averageTime: 50 })
      expect(stats.filterEngine).toEqual({ totalFilterOperations: 5 })
      expect(stats.searchResultFormatter).toEqual({ totalFormatOperations: 8 })
      expect(stats.searchCacheManager).toEqual({ hits: 3, misses: 7 })
      expect(stats.coordinator.totalCoordinatedOperations).toBeGreaterThan(0)
    })

    it('should coordinate cleanup across all modules', async () => {
      await searchCoordinator.coordinatedCleanup()

      expect(mockSearchEngine.cleanup).toHaveBeenCalled()
      expect(mockFilterEngine.cleanup).toHaveBeenCalled()
      expect(mockSearchResultFormatter.cleanup).toHaveBeenCalled()
      expect(mockSearchCacheManager.cleanup).toHaveBeenCalled()
    })

    it('should handle module communication errors gracefully', async () => {
      mockSearchEngine.search.mockRejectedValue(new Error('Search engine error'))

      await expect(searchCoordinator.executeSearch('test', {}))
        .rejects.toMatchObject({
          code: 'TEST_ERROR',
          message: expect.any(String),
          details: expect.any(Object)
        })

      expect(mockLogger.error).toHaveBeenCalledWith('搜尋執行失敗', expect.any(Object))
    })
  })

  // ========== 5. Event Coordination 事件協調和轉發 ==========
  describe('Event Coordination', () => {
    beforeEach(() => {
      searchCoordinator = new SearchCoordinator({
        eventBus: mockEventBus,
        logger: mockLogger,
        searchEngine: mockSearchEngine,
        filterEngine: mockFilterEngine,
        searchResultFormatter: mockSearchResultFormatter,
        searchCacheManager: mockSearchCacheManager
      })
      searchCoordinator.booksData = testBooks
    })

    it('should coordinate event handling for search execution', async () => {
      const searchEventHandler = mockEventBus.on.mock.calls
        .find(call => call[0] === 'SEARCH.EXECUTE')[1]

      mockSearchCacheManager.get.mockResolvedValue(null)
      mockSearchEngine.search.mockResolvedValue([testBooks[0]])
      mockFilterEngine.applyFilters.mockResolvedValue({
        filteredBooks: [testBooks[0]],
        totalCount: 1
      })
      mockSearchResultFormatter.formatResults.mockResolvedValue({
        results: [testBooks[0]],
        metadata: { totalCount: 1 }
      })

      await searchEventHandler({ query: 'test', filters: {} })

      expect(mockSearchEngine.search).toHaveBeenCalledWith('test', testBooks)
    })

    it('should coordinate event handling for filter application', async () => {
      const filterEventHandler = mockEventBus.on.mock.calls
        .find(call => call[0] === 'FILTER.APPLY')[1]

      mockFilterEngine.applyFilters.mockResolvedValue({
        filteredBooks: [testBooks[0]],
        totalCount: 1
      })

      await filterEventHandler({ books: testBooks, filters: { status: 'reading' } })

      expect(mockFilterEngine.applyFilters).toHaveBeenCalledWith(testBooks, { status: 'reading' })
    })

    it('should emit coordinated events with proper metadata', async () => {
      setupStandardMocks()

      await searchCoordinator.executeSearch('test', { status: 'reading' })

      expect(mockEventBus.emit).toHaveBeenCalledWith('COORDINATOR.SEARCH.STARTED', expect.objectContaining({
        query: 'test',
        filters: { status: 'reading' },
        timestamp: expect.any(Number),
        coordinatorId: expect.any(String)
      }))
    })

    it('should not emit events when disabled in config', async () => {
      searchCoordinator = new SearchCoordinator({
        eventBus: mockEventBus,
        logger: mockLogger,
        searchEngine: mockSearchEngine,
        filterEngine: mockFilterEngine,
        searchResultFormatter: mockSearchResultFormatter,
        searchCacheManager: mockSearchCacheManager,
        config: { enableEvents: false }
      })
      searchCoordinator.booksData = testBooks
      setupStandardMocks()
      mockEventBus.emit.mockClear()

      await searchCoordinator.executeSearch('test', {})

      expect(mockEventBus.emit).not.toHaveBeenCalledWith('COORDINATOR.SEARCH.STARTED', expect.any(Object))
    })
  })

  // ========== 6. Error Coordination 錯誤處理協調 ==========
  describe('Error Coordination', () => {
    beforeEach(() => {
      searchCoordinator = new SearchCoordinator({
        eventBus: mockEventBus,
        logger: mockLogger,
        searchEngine: mockSearchEngine,
        filterEngine: mockFilterEngine,
        searchResultFormatter: mockSearchResultFormatter,
        searchCacheManager: mockSearchCacheManager
      })
      searchCoordinator.booksData = testBooks
    })

    it('should coordinate error handling across modules', async () => {
      const searchError = new Error('Search failed')
      mockSearchEngine.search.mockRejectedValue(searchError)

      await expect(searchCoordinator.executeSearch('test', {})).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      expect(mockLogger.error).toHaveBeenCalledWith('搜尋執行失敗', expect.objectContaining({
        error: 'Search failed',
        query: 'test'
      }))

      expect(mockEventBus.emit).toHaveBeenCalledWith('COORDINATOR.ERROR', expect.objectContaining({
        operation: 'search',
        error: searchError,
        context: expect.any(Object)
      }))
    })

    it('should handle partial module failures gracefully', async () => {
      mockSearchEngine.search.mockResolvedValue([testBooks[0]])
      mockFilterEngine.applyFilters.mockRejectedValue(new Error('Filter failed'))

      await expect(searchCoordinator.executeSearch('test', { status: 'reading' }))
        .rejects.toMatchObject({
          code: 'TEST_ERROR',
          message: expect.any(String),
          details: expect.any(Object)
        })

      expect(mockLogger.error).toHaveBeenCalled()
    })

    it('should emit error events for failed operations', async () => {
      mockSearchResultFormatter.formatResults.mockRejectedValue(new Error('Format failed'))
      mockSearchEngine.search.mockResolvedValue([testBooks[0]])
      mockFilterEngine.applyFilters.mockResolvedValue({ filteredBooks: [testBooks[0]], totalCount: 1 })

      await expect(searchCoordinator.executeSearch('test', {})).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith('COORDINATOR.ERROR', expect.any(Object))
    })

    it('should handle SearchCoordinator destruction gracefully', async () => {
      await searchCoordinator.destroy()

      await expect(searchCoordinator.executeSearch('test', {}))
        .rejects.toMatchObject({
          code: 'TEST_ERROR',
          message: expect.any(String),
          details: expect.any(Object)
        })
    })
  })

  // ========== 7. Cache Coordination 快取協調管理 ==========
  describe('Cache Coordination', () => {
    beforeEach(() => {
      searchCoordinator = new SearchCoordinator({
        eventBus: mockEventBus,
        logger: mockLogger,
        searchEngine: mockSearchEngine,
        filterEngine: mockFilterEngine,
        searchResultFormatter: mockSearchResultFormatter,
        searchCacheManager: mockSearchCacheManager
      })
      searchCoordinator.booksData = testBooks
    })

    it('should coordinate cache operations across search flow', async () => {
      const cachedResult = { results: [testBooks[0]], cached: true }

      mockSearchCacheManager.get.mockResolvedValue(cachedResult)

      const result = await searchCoordinator.executeSearch('test', { status: 'reading' })

      expect(mockSearchCacheManager.get).toHaveBeenCalledWith(expect.stringMatching(/test.*reading/))
      expect(result).toBe(cachedResult)
    })

    it('should cache search results after successful execution', async () => {
      mockSearchCacheManager.get.mockResolvedValue(null)
      mockSearchEngine.search.mockResolvedValue([testBooks[0]])
      mockFilterEngine.applyFilters.mockResolvedValue({ filteredBooks: [testBooks[0]], totalCount: 1 })
      mockSearchResultFormatter.formatResults.mockResolvedValue({
        results: [testBooks[0]],
        metadata: { totalCount: 1 }
      })

      await searchCoordinator.executeSearch('test', { status: 'reading' })

      expect(mockSearchCacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          results: expect.any(Array),
          metadata: expect.any(Object)
        })
      )
    })

    it('should generate consistent cache keys', () => {
      const key1 = searchCoordinator._generateCacheKey('test', { status: 'reading' })
      const key2 = searchCoordinator._generateCacheKey('test', { status: 'reading' })
      const key3 = searchCoordinator._generateCacheKey('test', { status: 'completed' })

      expect(key1).toBe(key2)
      expect(key1).not.toBe(key3)
    })

    it('should clear cache when books data is updated', async () => {
      await searchCoordinator.updateBooksData([{ id: '1', title: 'New Book' }])

      expect(mockSearchCacheManager.clear).toHaveBeenCalled()
    })

    it('should not use cache when caching is disabled', async () => {
      searchCoordinator = new SearchCoordinator({
        eventBus: mockEventBus,
        logger: mockLogger,
        searchEngine: mockSearchEngine,
        filterEngine: mockFilterEngine,
        searchResultFormatter: mockSearchResultFormatter,
        searchCacheManager: mockSearchCacheManager,
        config: { enableCaching: false }
      })
      searchCoordinator.booksData = testBooks
      setupStandardMocks()

      await searchCoordinator.executeSearch('test', {})

      expect(mockSearchCacheManager.get).not.toHaveBeenCalled()
      expect(mockSearchCacheManager.set).not.toHaveBeenCalled()
    })
  })

  // ========== 8. Performance Monitoring 效能監控協調 ==========
  describe('Performance Monitoring', () => {
    beforeEach(() => {
      searchCoordinator = new SearchCoordinator({
        eventBus: mockEventBus,
        logger: mockLogger,
        searchEngine: mockSearchEngine,
        filterEngine: mockFilterEngine,
        searchResultFormatter: mockSearchResultFormatter,
        searchCacheManager: mockSearchCacheManager
      })
      searchCoordinator.booksData = testBooks
    })

    it('should track coordination performance statistics', async () => {
      setupStandardMocks()

      await searchCoordinator.executeSearch('test', {})
      await searchCoordinator.executeSearch('another', {})

      const stats = await searchCoordinator.getCoordinatedStatistics()

      expect(stats.coordinator.totalCoordinatedOperations).toBe(2)
      expect(stats.coordinator.averageCoordinationTime).toBeGreaterThan(0)
      expect(stats.coordinator.lastCoordinationTime).toBeGreaterThan(0)
    })

    it('should emit performance warnings for slow operations', async () => {
      // Mock slow operations
      mockSearchEngine.search.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve([testBooks[0]]), 200))
      )
      mockFilterEngine.applyFilters.mockResolvedValue({ filteredBooks: [testBooks[0]], totalCount: 1 })
      mockSearchResultFormatter.formatResults.mockResolvedValue({
        results: [testBooks[0]],
        metadata: { totalCount: 1 }
      })
      mockSearchCacheManager.get.mockResolvedValue(null)

      searchCoordinator = new SearchCoordinator({
        eventBus: mockEventBus,
        logger: mockLogger,
        searchEngine: mockSearchEngine,
        filterEngine: mockFilterEngine,
        searchResultFormatter: mockSearchResultFormatter,
        searchCacheManager: mockSearchCacheManager,
        config: { performanceWarningThreshold: 100 }
      })
      searchCoordinator.booksData = testBooks

      await searchCoordinator.executeSearch('test', {})

      expect(mockLogger.warn).toHaveBeenCalledWith('協調操作效能警告', expect.objectContaining({
        executionTime: expect.any(Number),
        threshold: 100
      }))
    })

    it('should reset performance statistics when requested', () => {
      searchCoordinator.resetStatistics()

      const stats = searchCoordinator._getInternalStatistics()

      expect(stats.totalCoordinatedOperations).toBe(0)
      expect(stats.averageCoordinationTime).toBe(0)
    })
  })

  // ========== 9. State Management 狀態管理協調 ==========
  describe('State Management', () => {
    beforeEach(() => {
      searchCoordinator = new SearchCoordinator({
        eventBus: mockEventBus,
        logger: mockLogger,
        searchEngine: mockSearchEngine,
        filterEngine: mockFilterEngine,
        searchResultFormatter: mockSearchResultFormatter,
        searchCacheManager: mockSearchCacheManager
      })
      searchCoordinator.booksData = testBooks
    })

    it('should maintain current search state', async () => {
      setupStandardMocks()

      await searchCoordinator.executeSearch('test query', { status: 'reading' })

      expect(searchCoordinator.getCurrentSearchState()).toEqual({
        lastQuery: 'test query',
        lastFilters: { status: 'reading' },
        isSearching: false,
        lastSearchTime: expect.any(Number)
      })
    })

    it('should track searching state during operations', async () => {
      let isSearchingDuringOperation = false

      mockSearchCacheManager.get.mockResolvedValue(null)
      mockSearchEngine.search.mockImplementation(async () => {
        isSearchingDuringOperation = searchCoordinator.getCurrentSearchState().isSearching
        return [testBooks[0]]
      })
      mockFilterEngine.applyFilters.mockResolvedValue({ filteredBooks: [testBooks[0]], totalCount: 1 })
      mockSearchResultFormatter.formatResults.mockResolvedValue({
        results: [testBooks[0]],
        metadata: { totalCount: 1 }
      })

      await searchCoordinator.executeSearch('test', {})

      expect(isSearchingDuringOperation).toBe(true)
      expect(searchCoordinator.getCurrentSearchState().isSearching).toBe(false)
    })

    it('should emit state change events', async () => {
      setupStandardMocks()

      await searchCoordinator.executeSearch('test', {})

      expect(mockEventBus.emit).toHaveBeenCalledWith('COORDINATOR.STATE.CHANGED', expect.objectContaining({
        isSearching: false,
        lastQuery: 'test'
      }))
    })

    it('should preserve state across multiple operations', async () => {
      setupStandardMocks()

      await searchCoordinator.executeSearch('first', {})
      await searchCoordinator.executeSearch('second', { status: 'reading' })

      const state = searchCoordinator.getCurrentSearchState()
      expect(state.lastQuery).toBe('second')
      expect(state.lastFilters).toEqual({ status: 'reading' })
    })
  })

  // ========== 10. Lifecycle Management 生命週期管理 ==========
  describe('Lifecycle Management', () => {
    beforeEach(() => {
      searchCoordinator = new SearchCoordinator({
        eventBus: mockEventBus,
        logger: mockLogger,
        searchEngine: mockSearchEngine,
        filterEngine: mockFilterEngine,
        searchResultFormatter: mockSearchResultFormatter,
        searchCacheManager: mockSearchCacheManager
      })
      searchCoordinator.booksData = testBooks
    })

    it('should cleanup all modules during destruction', async () => {
      await searchCoordinator.destroy()

      expect(mockSearchEngine.destroy).toHaveBeenCalled()
      expect(mockFilterEngine.destroy).toHaveBeenCalled()
      expect(mockSearchResultFormatter.destroy).toHaveBeenCalled()
      expect(mockSearchCacheManager.destroy).toHaveBeenCalled()
    })

    it('should unregister event listeners during destruction', async () => {
      await searchCoordinator.destroy()

      expect(mockEventBus.off).toHaveBeenCalledWith('SEARCH.EXECUTE', expect.any(Function))
      expect(mockEventBus.off).toHaveBeenCalledWith('FILTER.APPLY', expect.any(Function))
      expect(mockEventBus.off).toHaveBeenCalledWith('BOOKS.DATA.UPDATED', expect.any(Function))
    })

    it('should emit lifecycle events', async () => {
      await searchCoordinator.destroy()

      expect(mockEventBus.emit).toHaveBeenCalledWith('COORDINATOR.DESTROYED', expect.objectContaining({
        coordinatorId: expect.any(String),
        timestamp: expect.any(Number)
      }))
    })

    it('should prevent operations after destruction', async () => {
      await searchCoordinator.destroy()

      await expect(searchCoordinator.executeSearch('test', {}))
        .rejects.toMatchObject({
          code: 'TEST_ERROR',
          message: expect.any(String),
          details: expect.any(Object)
        })
    })

    it('should handle graceful shutdown', async () => {
      setupStandardMocks()

      // Start some operations
      const searchPromise = searchCoordinator.executeSearch('test', {})

      // Initiate graceful shutdown
      const shutdownPromise = searchCoordinator.gracefulShutdown()

      // Wait for both to complete
      await Promise.all([searchPromise, shutdownPromise])

      expect(mockSearchEngine.destroy).toHaveBeenCalled()
      expect(searchCoordinator._isDestroyed).toBe(true)
    })
  })
})
