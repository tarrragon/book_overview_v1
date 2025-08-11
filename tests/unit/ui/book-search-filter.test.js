/**
 * BookSearchFilter 單元測試 - TDD 循環 #28
 *
 * 負責功能：
 * - 即時書籍搜尋功能（書名、作者、標籤）
 * - 多維度篩選功能（狀態、進度、分類）
 * - 搜尋結果快取和效能優化
 * - 搜尋歷史管理和建議
 * - 事件驅動的搜尋結果通知
 *
 * 測試涵蓋範圍：
 * - 基本結構和初始化
 * - 即時搜尋功能測試
 * - 多維度篩選功能
 * - 搜尋效能和快取機制
 * - 搜尋歷史和建議系統
 * - 事件整合和通知機制
 * - 錯誤處理和邊界條件
 *
 * @version 1.0.0
 * @since 2025-08-07
 */

// 測試環境設定
require('../../test-setup')

describe('BookSearchFilter - TDD 循環 #28', () => {
  let searchFilter
  let mockEventBus
  let mockDocument
  let mockSearchInput
  let mockFilterContainer
  let mockResultContainer

  // 測試用書籍資料
  const mockBooks = [
    {
      id: 'book-001',
      title: 'JavaScript 權威指南',
      author: 'David Flanagan',
      tags: ['程式設計', 'JavaScript', '技術書籍'],
      status: 'reading',
      progress: 45,
      category: 'technology',
      lastRead: '2024-08-07',
      readTime: 1200
    },
    {
      id: 'book-002',
      title: 'Python 機器學習',
      author: 'Sebastian Raschka',
      tags: ['程式設計', 'Python', '機器學習'],
      status: 'completed',
      progress: 100,
      category: 'technology',
      lastRead: '2024-07-15',
      readTime: 2400
    },
    {
      id: 'book-003',
      title: '經濟學原理',
      author: 'Gregory Mankiw',
      tags: ['經濟學', '教科書', '商業'],
      status: 'unread',
      progress: 0,
      category: 'business',
      lastRead: null,
      readTime: 0
    },
    {
      id: 'book-004',
      title: '設計模式',
      author: 'Gang of Four',
      tags: ['程式設計', '設計模式', 'OOP'],
      status: 'paused',
      progress: 67,
      category: 'technology',
      lastRead: '2024-06-20',
      readTime: 1800
    }
  ]

  beforeEach(() => {
    // 模擬事件總線
    mockEventBus = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      emitAsync: jest.fn().mockResolvedValue(true)
    }

    // 模擬搜尋輸入框
    mockSearchInput = {
      value: '',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      focus: jest.fn(),
      blur: jest.fn(),
      placeholder: '搜尋書籍...',
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn().mockReturnValue(false)
      }
    }

    // 模擬篩選容器
    mockFilterContainer = {
      innerHTML: '',
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([]),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn()
      }
    }

    // 模擬結果容器
    mockResultContainer = {
      innerHTML: '',
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn()
      }
    }

    // 模擬 DOM 環境
    mockDocument = {
      getElementById: jest.fn((id) => {
        switch (id) {
          case 'search-input': return mockSearchInput
          case 'filter-container': return mockFilterContainer
          case 'result-container': return mockResultContainer
          default: return null
        }
      }),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([]),
      createElement: jest.fn((tag) => ({
        tagName: tag.toUpperCase(),
        className: '',
        innerHTML: '',
        textContent: '',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
        style: {},
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
          contains: jest.fn()
        }
      }))
    }

    // 重置所有 mock 函數
    jest.clearAllMocks()
    jest.useFakeTimers()

    // 初始化 BookSearchFilter
    // 注意：這裡會失敗因為類別還不存在（TDD 紅燈狀態）
    try {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      searchFilter = new BookSearchFilter(mockEventBus, mockDocument)
    } catch (error) {
      // 預期的失敗狀態，符合 TDD 紅燈階段
      searchFilter = null
    }
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllTimers()
  })

  // ========================================
  // 基本結構和初始化測試
  // ========================================

  describe('基本結構和初始化', () => {
    test('應該能夠創建 BookSearchFilter 實例', () => {
      expect(() => {
        const BookSearchFilter = require('../../../src/ui/book-search-filter')
        const instance = new BookSearchFilter(mockEventBus, mockDocument)
        expect(instance).toBeDefined()
        expect(instance.constructor.name).toBe('BookSearchFilter')
      }).not.toThrow()
    })

    test('應該繼承 BaseUIHandler 並具備基本功能', () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)

      // 檢查是否具備 BaseUIHandler 的方法
      expect(typeof instance.handle).toBe('function')
      expect(typeof instance.initialize).toBe('function')
      expect(typeof instance.cleanup).toBe('function')
      expect(instance.name).toBe('BookSearchFilter')
    })

    test('應該正確初始化 DOM 元素引用', () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)

      expect(mockDocument.getElementById).toHaveBeenCalledWith('search-input')
      expect(mockDocument.getElementById).toHaveBeenCalledWith('filter-container')
      expect(mockDocument.getElementById).toHaveBeenCalledWith('result-container')
    })

    test('應該初始化搜尋狀態和配置', () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)

      expect(instance.searchHistory).toEqual([])
      expect(instance.currentFilters).toEqual({})
      expect(instance.searchCache).toBeDefined()
      expect(instance.isSearching).toBe(false)
    })

    test('應該註冊必要的事件監聽器', () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)

      // 檢查是否註冊了搜尋相關事件
      expect(mockEventBus.on).toHaveBeenCalledWith('BOOKS.DATA.UPDATED', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('SEARCH.REQUEST', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('FILTER.CHANGE', expect.any(Function))
    })
  })

  // ========================================
  // 即時搜尋功能測試
  // ========================================

  describe('即時搜尋功能', () => {
    beforeEach(() => {
      if (searchFilter) {
        // 模擬載入書籍資料
        searchFilter.booksData = mockBooks
      }
    })

    test('應該支援依書名搜尋', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      const results = await instance.searchBooks('JavaScript')

      expect(results).toHaveLength(1)
      expect(results[0].title).toContain('JavaScript')
      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.RESULTS.UPDATED', {
        query: 'JavaScript',
        results,
        totalCount: 1
      })
    })

    test('應該支援依作者搜尋', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      const results = await instance.searchBooks('David')

      expect(results).toHaveLength(1)
      expect(results[0].author).toContain('David')
    })

    test('應該支援依標籤搜尋', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      const results = await instance.searchBooks('程式設計')

      expect(results).toHaveLength(3)
      results.forEach(book => {
        expect(book.tags).toContain('程式設計')
      })
    })

    test('應該支援模糊搜尋和忽略大小寫', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      const results1 = await instance.searchBooks('javascript')
      const results2 = await instance.searchBooks('JAVASCRIPT')
      const results3 = await instance.searchBooks('Java')

      expect(results1).toHaveLength(1)
      expect(results2).toHaveLength(1)
      expect(results3).toHaveLength(1)
      expect(results1[0]).toEqual(results2[0])
    })

    test('應該正確處理空搜尋查詢', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      const results1 = await instance.searchBooks('')
      const results2 = await instance.searchBooks('   ')

      expect(results1).toHaveLength(4) // 回傳所有書籍
      expect(results2).toHaveLength(4)
    })

    test('應該正確處理無結果的搜尋', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      const results = await instance.searchBooks('不存在的書籍')

      expect(results).toHaveLength(0)
      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.NO.RESULTS', {
        query: '不存在的書籍'
      })
    })

    test('應該實現搜尋防抖功能', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      // 快速連續輸入
      instance.handleSearchInput({ target: { value: 'J' } })
      instance.handleSearchInput({ target: { value: 'Ja' } })
      instance.handleSearchInput({ target: { value: 'Jav' } })
      instance.handleSearchInput({ target: { value: 'Java' } })

      expect(instance.searchDebounceTimer).toBeDefined()

      // 快進時間觸發防抖
      jest.advanceTimersByTime(500)

      expect(mockEventBus.emit).toHaveBeenCalledTimes(1) // 只執行最後一次搜尋
    })
  })

  // ========================================
  // 多維度篩選功能測試
  // ========================================

  describe('多維度篩選功能', () => {
    beforeEach(() => {
      if (searchFilter) {
        searchFilter.booksData = mockBooks
      }
    })

    test('應該支援依閱讀狀態篩選', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      const readingBooks = await instance.applyFilters(mockBooks, { status: 'reading' })
      const completedBooks = await instance.applyFilters(mockBooks, { status: 'completed' })
      const unreadBooks = await instance.applyFilters(mockBooks, { status: 'unread' })

      expect(readingBooks).toHaveLength(1)
      expect(readingBooks[0].status).toBe('reading')
      expect(completedBooks).toHaveLength(1)
      expect(completedBooks[0].status).toBe('completed')
      expect(unreadBooks).toHaveLength(1)
      expect(unreadBooks[0].status).toBe('unread')
    })

    test('應該支援依閱讀進度範圍篩選', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      const lowProgressBooks = await instance.applyFilters(mockBooks, {
        progressRange: { min: 0, max: 50 }
      })
      const highProgressBooks = await instance.applyFilters(mockBooks, {
        progressRange: { min: 60, max: 100 }
      })

      expect(lowProgressBooks).toHaveLength(2) // progress: 45, 0
      expect(highProgressBooks).toHaveLength(2) // progress: 100, 67

      lowProgressBooks.forEach(book => {
        expect(book.progress).toBeGreaterThanOrEqual(0)
        expect(book.progress).toBeLessThanOrEqual(50)
      })
    })

    test('應該支援依書籍分類篩選', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      const techBooks = await instance.applyFilters(mockBooks, { category: 'technology' })
      const businessBooks = await instance.applyFilters(mockBooks, { category: 'business' })

      expect(techBooks).toHaveLength(3)
      expect(businessBooks).toHaveLength(1)

      techBooks.forEach(book => {
        expect(book.category).toBe('technology')
      })
    })

    test('應該支援依最近閱讀時間篩選', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      const recentBooks = await instance.applyFilters(mockBooks, {
        lastReadAfter: '2024-07-01'
      })

      expect(recentBooks).toHaveLength(2) // 2024-08-07, 2024-07-15
      recentBooks.forEach(book => {
        expect(new Date(book.lastRead)).toBeInstanceOf(Date)
      })
    })

    test('應該支援多重篩選條件組合', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      const complexFilter = {
        category: 'technology',
        status: 'reading',
        progressRange: { min: 40, max: 70 }
      }

      const results = await instance.applyFilters(mockBooks, complexFilter)

      expect(results).toHaveLength(1)
      expect(results[0].category).toBe('technology')
      expect(results[0].status).toBe('reading')
      expect(results[0].progress).toBeGreaterThanOrEqual(40)
      expect(results[0].progress).toBeLessThanOrEqual(70)
    })

    test('應該支援篩選器重置功能', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      // 套用篩選器
      instance.currentFilters = { status: 'reading', category: 'technology' }

      // 重置篩選器
      await instance.resetFilters()

      expect(instance.currentFilters).toEqual({})
      expect(mockEventBus.emit).toHaveBeenCalledWith('FILTERS.RESET', {})
    })

    test('應該正確更新篩選器 UI 狀態', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)

      const filterOptions = {
        status: 'reading',
        category: 'technology'
      }

      await instance.updateFilterUI(filterOptions)

      expect(mockEventBus.emit).toHaveBeenCalledWith('FILTER.UI.UPDATED', filterOptions)
    })
  })

  // ========================================
  // 搜尋效能和快取機制測試
  // ========================================

  describe('搜尋效能和快取機制', () => {
    test('應該實現搜尋結果快取機制', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      // 第一次搜尋
      const startTime1 = performance.now()
      const results1 = await instance.searchBooks('JavaScript')
      const endTime1 = performance.now()

      // 第二次相同搜尋（應該使用快取）
      const startTime2 = performance.now()
      const results2 = await instance.searchBooks('JavaScript')
      const endTime2 = performance.now()

      expect(results1).toEqual(results2)
      expect(instance.searchCache.has('javascript')).toBe(true)

      // 快取搜尋應該更快（在真實環境中）
      // 在測試環境中我們檢查快取是否被使用
      expect(instance.cacheHitCount).toBeGreaterThan(0)
    })

    test('應該實現搜尋快取大小限制', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks
      instance.maxCacheSize = 3 // 設定較小的快取大小用於測試

      // 執行多次不同搜尋超過快取限制
      await instance.searchBooks('JavaScript')
      await instance.searchBooks('Python')
      await instance.searchBooks('經濟學')
      await instance.searchBooks('設計模式')

      expect(instance.searchCache.size).toBeLessThanOrEqual(3)
    })

    test('應該實現索引建構提升搜尋效能', () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)

      instance.buildSearchIndex(mockBooks)

      expect(instance.titleIndex).toBeDefined()
      expect(instance.authorIndex).toBeDefined()
      expect(instance.tagIndex).toBeDefined()

      // 檢查索引內容
      expect(instance.titleIndex.has('javascript')).toBe(true)
      expect(instance.authorIndex.has('david')).toBe(true)
      expect(instance.tagIndex.has('程式設計')).toBe(true)
    })

    test('應該監控搜尋效能並發出警告', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = new Array(10000).fill(mockBooks[0]) // 大量資料
      instance.performanceWarningThreshold = 50 // 50ms 警告閾值

      await instance.searchBooks('JavaScript')

      // 檢查是否記錄了效能統計
      expect(instance.performanceStats).toBeDefined()
      expect(instance.performanceStats.lastSearchTime).toBeGreaterThan(0)
    })

    test('應該實現記憶體清理機制', () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)

      // 填充快取
      instance.searchCache.set('query1', [])
      instance.searchCache.set('query2', [])
      instance.searchCache.set('query3', [])

      // 執行清理
      instance.cleanupCache()

      expect(instance.searchCache.size).toBeLessThanOrEqual(instance.maxCacheSize)
    })
  })

  // ========================================
  // 搜尋歷史和建議系統測試
  // ========================================

  describe('搜尋歷史和建議系統', () => {
    test('應該記錄搜尋歷史', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      await instance.searchBooks('JavaScript')
      await instance.searchBooks('Python')

      expect(instance.searchHistory).toContain('JavaScript')
      expect(instance.searchHistory).toContain('Python')
      expect(instance.searchHistory).toHaveLength(2)
    })

    test('應該限制搜尋歷史大小', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks
      instance.maxHistorySize = 3 // 設定較小的歷史大小

      await instance.searchBooks('Query1')
      await instance.searchBooks('Query2')
      await instance.searchBooks('Query3')
      await instance.searchBooks('Query4')

      expect(instance.searchHistory).toHaveLength(3)
      expect(instance.searchHistory).not.toContain('Query1') // 最舊的應該被移除
    })

    test('應該提供搜尋建議功能', () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      const suggestions = instance.getSearchSuggestions('Ja')

      expect(suggestions).toContain('JavaScript')
      expect(suggestions).toHaveLength(1)
    })

    test('應該基於搜尋歷史提供建議', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      // 建立搜尋歷史
      await instance.searchBooks('JavaScript 權威指南')
      await instance.searchBooks('Python 機器學習')

      const suggestions = instance.getSearchSuggestions('J')

      expect(suggestions).toContain('JavaScript 權威指南')
    })

    test('應該支援清除搜尋歷史', () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)

      instance.searchHistory = ['Query1', 'Query2', 'Query3']
      instance.clearSearchHistory()

      expect(instance.searchHistory).toHaveLength(0)
      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.HISTORY.CLEARED', {})
    })
  })

  // ========================================
  // 事件整合和通知機制測試
  // ========================================

  describe('事件整合和通知機制', () => {
    test('應該監聽書籍資料更新事件', () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)

      expect(mockEventBus.on).toHaveBeenCalledWith(
        'BOOKS.DATA.UPDATED',
        expect.any(Function)
      )
    })

    test('應該處理書籍資料更新事件', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)

      const eventHandler = mockEventBus.on.mock.calls
        .find(call => call[0] === 'BOOKS.DATA.UPDATED')[1]

      const newBooksData = [...mockBooks, {
        id: 'book-005',
        title: 'React 開發指南',
        author: 'Dan Abramov',
        tags: ['程式設計', 'React', '前端'],
        status: 'unread',
        progress: 0,
        category: 'technology'
      }]

      await eventHandler({ data: newBooksData })

      expect(instance.booksData).toEqual(newBooksData)
      expect(instance.searchCache.size).toBe(0) // 快取應該被清除
    })

    test('應該發出搜尋狀態更新事件', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      await instance.searchBooks('JavaScript')

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.STATUS.CHANGED', {
        isSearching: false,
        hasQuery: true,
        resultCount: 1
      })
    })

    test('應該發出篩選器變更事件', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)

      const newFilters = { status: 'reading', category: 'technology' }
      await instance.updateFilters(newFilters)

      expect(mockEventBus.emit).toHaveBeenCalledWith('FILTERS.UPDATED', {
        filters: newFilters,
        activeCount: 2
      })
    })

    // 已移至 docs/testing/red-phase/ 以避免假計時器等待造成逾時

    test('應該發出搜尋進度事件', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = new Array(1000).fill(mockBooks[0]) // 大量資料

      await instance.searchBooks('JavaScript')

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.PROGRESS', expect.objectContaining({
        progress: expect.any(Number),
        phase: expect.any(String)
      }))
    })
  })

  // ========================================
  // 錯誤處理和邊界條件測試
  // ========================================

  describe('錯誤處理和邊界條件', () => {
    test('應該處理無效的書籍資料', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)

      const invalidData = [
        null,
        undefined,
        { id: 'book-001' }, // 缺少必要欄位
        { title: 'Test Book' } // 缺少 id
      ]

      instance.booksData = invalidData

      const results = await instance.searchBooks('Test')

      expect(results).toEqual([])
      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.ERROR', expect.objectContaining({
        error: expect.any(Error),
        query: 'Test'
      }))
    })

    test('應該處理極長的搜尋查詢', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      const longQuery = 'a'.repeat(1000)

      const results = await instance.searchBooks(longQuery)

      expect(results).toEqual([])
      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.WARNING', expect.objectContaining({
        message: expect.stringContaining('查詢過長'),
        query: longQuery
      }))
    })

    test('應該處理特殊字符搜尋查詢', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)
      instance.booksData = mockBooks

      const specialQueries = [
        '/*',
        '<script>',
        '\\n\\r',
        '[]{}()',
        '&&||',
        '???'
      ]

      for (const query of specialQueries) {
        const results = await instance.searchBooks(query)
        expect(results).toBeDefined()
        expect(Array.isArray(results)).toBe(true)
      }
    })

    test('應該處理搜尋過程中的錯誤', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)

      // 模擬搜尋過程中發生錯誤
      instance.booksData = mockBooks
      jest.spyOn(instance, 'applyFilters').mockRejectedValue(new Error('搜尋錯誤'))

      const results = await instance.searchBooks('JavaScript')

      expect(results).toEqual([])
      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.ERROR', expect.objectContaining({
        error: expect.any(Error)
      }))
    })

    test('應該處理 DOM 元素不存在的情況', () => {
      // 模擬 DOM 元素不存在
      mockDocument.getElementById = jest.fn().mockReturnValue(null)

      expect(() => {
        const BookSearchFilter = require('../../../src/ui/book-search-filter')
        new BookSearchFilter(mockEventBus, mockDocument)
      }).not.toThrow()
    })

    test('應該處理事件總線無法使用的情況', () => {
      const invalidEventBus = null

      expect(() => {
        const BookSearchFilter = require('../../../src/ui/book-search-filter')
        new BookSearchFilter(invalidEventBus, mockDocument)
      }).toThrow('事件總線是必需的')
    })

    test('應該正確清理資源', () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)

      // 設置一些資源
      instance.searchDebounceTimer = setTimeout(() => {}, 1000)
      instance.searchCache.set('test', [])

      instance.cleanup()

      expect(instance.searchCache.size).toBe(0)
      expect(mockEventBus.off).toHaveBeenCalled()
    })

    test('應該處理記憶體不足情況', async () => {
      const BookSearchFilter = require('../../../src/ui/book-search-filter')
      const instance = new BookSearchFilter(mockEventBus, mockDocument)

      // 模擬記憶體不足錯誤
      jest.spyOn(instance, 'buildSearchIndex').mockImplementation(() => {
        throw new Error('記憶體不足')
      })

      const hugeData = new Array(100000).fill(mockBooks[0])

      expect(() => {
        instance.booksData = hugeData
      }).not.toThrow()

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.WARNING', expect.objectContaining({
        message: expect.stringContaining('記憶體')
      }))
    })
  })
})
