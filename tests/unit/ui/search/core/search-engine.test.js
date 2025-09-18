/**
 * SearchEngine 單元測試 - TDD 循環 2/8
 * BookSearchFilter 職責拆分重構
 *
 * 負責功能：
 * - 執行搜尋操作和匹配演算法
 * - 查詢驗證和正規化
 * - 搜尋條件匹配邏輯
 * - 多欄位搜尋支援（書名、作者、標籤）
 * - 搜尋效能監控
 *
 * 測試涵蓋範圍：
 * - 搜尋引擎初始化和配置
 * - 查詢驗證和正規化
 * - 基本搜尋匹配功能
 * - 多欄位搜尋邏輯
 * - 進階搜尋功能（模糊搜尋、權重評分）
 * - 效能監控和統計
 * - 錯誤處理和邊界條件
 *
 * @version 1.0.0
 * @since 2025-08-20
 */

// 測試環境設定
require('../../../../test-setup')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

describe('SearchEngine - TDD 循環 2/8', () => {
  let searchEngine
  let mockIndexManager
  let mockEventBus
  let mockLogger

  // 測試用書籍資料
  const mockBooks = [
    {
      id: 'book-001',
      title: 'JavaScript 權威指南',
      author: 'David Flanagan',
      tags: ['程式設計', 'JavaScript', '技術書籍'],
      status: 'reading',
      progress: 45,
      category: 'technology'
    },
    {
      id: 'book-002',
      title: 'Python 機器學習',
      author: 'Sebastian Raschka',
      tags: ['機器學習', 'Python', '人工智慧'],
      status: 'completed',
      progress: 100,
      category: 'ai'
    },
    {
      id: 'book-003',
      title: 'Deep Learning 深度學習',
      author: 'Ian Goodfellow',
      tags: ['深度學習', 'AI', '神經網路'],
      status: 'planned',
      progress: 0,
      category: 'ai'
    },
    {
      id: 'book-004',
      title: 'React 開發實戰',
      author: 'Alex Banks',
      tags: ['React', 'Frontend', '前端開發'],
      status: 'reading',
      progress: 30,
      category: 'frontend'
    }
  ]

  beforeEach(() => {
    // 建立 Mock IndexManager
    mockIndexManager = {
      titleIndex: new Map([
        ['javascript', [mockBooks[0]]],
        ['權威指南', [mockBooks[0]]],
        ['python', [mockBooks[1]]],
        ['機器學習', [mockBooks[1]]],
        ['deep', [mockBooks[2]]],
        ['learning', [mockBooks[2]]],
        ['react', [mockBooks[3]]],
        ['開發實戰', [mockBooks[3]]]
      ]),
      authorIndex: new Map([
        ['david', [mockBooks[0]]],
        ['flanagan', [mockBooks[0]]],
        ['sebastian', [mockBooks[1]]],
        ['raschka', [mockBooks[1]]],
        ['ian', [mockBooks[2]]],
        ['goodfellow', [mockBooks[2]]],
        ['alex', [mockBooks[3]]],
        ['banks', [mockBooks[3]]]
      ]),
      tagIndex: new Map([
        ['程式設計', [mockBooks[0]]],
        ['javascript', [mockBooks[0]]],
        ['機器學習', [mockBooks[1]]],
        ['python', [mockBooks[1]]],
        ['深度學習', [mockBooks[2]]],
        ['ai', [mockBooks[2]]],
        ['react', [mockBooks[3]]],
        ['frontend', [mockBooks[3]]]
      ]),
      getIndexStats: jest.fn(() => ({
        titleIndexSize: 8,
        authorIndexSize: 8,
        tagIndexSize: 8,
        totalBooks: 4
      }))
    }

    // 建立 Mock EventBus
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    }

    // 建立 Mock Logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }

    // 重置 Jest mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    if (searchEngine) {
      searchEngine.destroy?.()
      searchEngine = null
    }
  })

  describe('1. Construction & Initialization', () => {
    test('應該正確建構 SearchEngine 實例', () => {
      const SearchEngine = require('src/ui/search/core/search-engine')

      searchEngine = new SearchEngine({
        indexManager: mockIndexManager,
        eventBus: mockEventBus,
        logger: mockLogger
      })

      expect(searchEngine).toBeInstanceOf(SearchEngine)
      expect(searchEngine.indexManager).toBe(mockIndexManager)
      expect(searchEngine.eventBus).toBe(mockEventBus)
      expect(searchEngine.logger).toBe(mockLogger)
    })

    test('建構時若缺少必要參數應該拋出錯誤', () => {
      const SearchEngine = require('src/ui/search/core/search-engine')

      expect(() => {
        const engine = new SearchEngine()
        // 變數賦值確保建構子結果被正確處理，測試錯誤條件
      }).toMatchObject({
        message: expect.stringContaining('IndexManager、EventBus 和 Logger 是必需的')
      })

      expect(() => {
        const engine = new SearchEngine({ indexManager: mockIndexManager })
        // 變數賦值確保建構子結果被正確處理，測試錯誤條件
      }).toMatchObject({
        message: expect.stringContaining('IndexManager、EventBus 和 Logger 是必需的')
      })

      expect(() => {
        const engine = new SearchEngine({
          indexManager: mockIndexManager,
          eventBus: mockEventBus
        })
        // 變數賦值確保建構子結果被正確處理，測試錯誤條件
      }).toMatchObject({
        message: expect.stringContaining('IndexManager、EventBus 和 Logger 是必需的')
      })
    })

    test('應該正確初始化搜尋配置', () => {
      const SearchEngine = require('src/ui/search/core/search-engine')

      searchEngine = new SearchEngine({
        indexManager: mockIndexManager,
        eventBus: mockEventBus,
        logger: mockLogger
      })

      expect(searchEngine.config).toEqual({
        maxQueryLength: 100,
        minQueryLength: 1,
        enableFuzzySearch: true,
        fuzzyThreshold: 0.5,
        maxResults: 1000,
        enableWeightedSearch: true,
        performanceWarningThreshold: 1000
      })
    })

    test('應該正確初始化效能統計', () => {
      const SearchEngine = require('src/ui/search/core/search-engine')

      searchEngine = new SearchEngine({
        indexManager: mockIndexManager,
        eventBus: mockEventBus,
        logger: mockLogger
      })

      const stats = searchEngine.getPerformanceStats()
      expect(stats).toEqual({
        totalSearches: 0,
        totalSearchTime: 0,
        averageSearchTime: 0,
        fastestSearch: null,
        slowestSearch: null,
        indexBasedSearches: 0,
        linearSearches: 0
      })
    })

    test('應該支援自定義配置', () => {
      const SearchEngine = require('src/ui/search/core/search-engine')

      const customConfig = {
        maxQueryLength: 200,
        enableFuzzySearch: false,
        maxResults: 500
      }

      searchEngine = new SearchEngine({
        indexManager: mockIndexManager,
        eventBus: mockEventBus,
        logger: mockLogger,
        config: customConfig
      })

      expect(searchEngine.config.maxQueryLength).toBe(200)
      expect(searchEngine.config.enableFuzzySearch).toBe(false)
      expect(searchEngine.config.maxResults).toBe(500)
      // 其他配置應該使用預設值
      expect(searchEngine.config.minQueryLength).toBe(1)
    })
  })

  describe('2. Query Validation & Normalization', () => {
    beforeEach(() => {
      const SearchEngine = require('src/ui/search/core/search-engine')
      searchEngine = new SearchEngine({
        indexManager: mockIndexManager,
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該正確驗證有效查詢', () => {
      const validQueries = [
        'JavaScript',
        'js',
        'React 開發',
        'A',
        'Python 機器學習入門指南'
      ]

      validQueries.forEach(query => {
        const result = searchEngine.validateQuery(query)
        expect(result.isValid).toBe(true)
        expect(result.error).toBeUndefined()
      })
    })

    test('應該正確識別無效查詢', () => {
      const testCases = [
        { query: null, expectedError: '查詢必須是字串' },
        { query: undefined, expectedError: '查詢必須是字串' },
        { query: 123, expectedError: '查詢必須是字串' },
        { query: 'a'.repeat(101), expectedError: '查詢長度必須在 1 到 100 個字元之間' }
      ]

      testCases.forEach(({ query, expectedError }) => {
        const result = searchEngine.validateQuery(query)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe(expectedError)
      })
    })

    test('應該正確正規化查詢字串', () => {
      const testCases = [
        { input: '  JavaScript  ', expected: 'javascript' },
        { input: 'PYTHON', expected: 'python' },
        { input: 'React 開發', expected: 'react 開發' },
        { input: '  Deep   Learning  ', expected: 'deep learning' },
        { input: 'AI/ML', expected: 'ai/ml' }
      ]

      testCases.forEach(({ input, expected }) => {
        const result = searchEngine.normalizeQuery(input)
        expect(result).toBe(expected)
      })
    })

    test('應該處理特殊字元和標點符號', () => {
      const testCases = [
        { input: 'JavaScript!', expected: 'javascript!' },
        { input: 'Python (3.9)', expected: 'python (3.9)' },
        { input: 'C++/C#', expected: 'c++/c#' },
        { input: 'Node.js', expected: 'node.js' }
      ]

      testCases.forEach(({ input, expected }) => {
        const result = searchEngine.normalizeQuery(input)
        expect(result).toBe(expected)
      })
    })
  })

  describe('3. Basic Search Functionality', () => {
    beforeEach(() => {
      const SearchEngine = require('src/ui/search/core/search-engine')
      searchEngine = new SearchEngine({
        indexManager: mockIndexManager,
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該支援空查詢返回所有結果', async () => {
      const results = await searchEngine.search('', mockBooks)

      expect(results).toHaveLength(4)
      expect(results).toEqual(mockBooks)
    })

    test('應該根據書名進行基本搜尋', async () => {
      const results = await searchEngine.search('JavaScript', mockBooks)

      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('JavaScript 權威指南')
    })

    test('應該根據作者進行搜尋', async () => {
      const results = await searchEngine.search('David', mockBooks)

      expect(results).toHaveLength(1)
      expect(results[0].author).toBe('David Flanagan')
    })

    test('應該根據標籤進行搜尋', async () => {
      const results = await searchEngine.search('機器學習', mockBooks)

      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Python 機器學習')
    })

    test('應該支援部分匹配搜尋', async () => {
      const results = await searchEngine.search('學習', mockBooks)

      expect(results).toHaveLength(2)
      expect(results.some(book => book.title.includes('機器學習'))).toBe(true)
      expect(results.some(book => book.title.includes('深度學習'))).toBe(true)
    })

    test('應該支援多個關鍵字搜尋', async () => {
      const results = await searchEngine.search('Python 機器', mockBooks)

      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Python 機器學習')
    })

    test('搜尋應該不區分大小寫', async () => {
      const testCases = ['javascript', 'JAVASCRIPT', 'JavaScript', 'jAvAsCrIpT']

      for (const query of testCases) {
        const results = await searchEngine.search(query, mockBooks)
        expect(results).toHaveLength(1)
        expect(results[0].title).toBe('JavaScript 權威指南')
      }
    })
  })

  describe('4. Advanced Search Features', () => {
    beforeEach(() => {
      const SearchEngine = require('src/ui/search/core/search-engine')
      searchEngine = new SearchEngine({
        indexManager: mockIndexManager,
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該支援模糊搜尋', async () => {
      // 啟用模糊搜尋
      const results = await searchEngine.search('Javascrpt', mockBooks) // 拼寫錯誤

      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('JavaScript 權威指南')
    })

    test('應該支援權重評分搜尋', async () => {
      const results = await searchEngine.searchWithScoring('機器學習', mockBooks)

      expect(results).toBeInstanceOf(Array)
      expect(results.length).toBeGreaterThan(0)

      // 結果應該包含評分
      results.forEach(result => {
        expect(result).toHaveProperty('book')
        expect(result).toHaveProperty('score')
        expect(typeof result.score).toBe('number')
        expect(result.score).toBeGreaterThan(0)
        expect(result.score).toBeLessThanOrEqual(1)
      })

      // 結果應該按評分排序（降序）
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
      }
    })

    test('應該支援欄位權重設定', async () => {
      const fieldWeights = {
        title: 1.0,
        author: 0.8,
        tags: 0.6
      }

      const results = await searchEngine.searchWithScoring('JavaScript', mockBooks, fieldWeights)

      expect(results).toHaveLength(1)
      expect(results[0].book.title).toBe('JavaScript 權威指南')
      expect(results[0].score).toBeGreaterThan(0.8) // 高分因為書名匹配
    })

    test('應該支援搜尋結果限制', async () => {
      const customEngine = new (require('src/ui/search/core/search-engine'))({
        indexManager: mockIndexManager,
        eventBus: mockEventBus,
        logger: mockLogger,
        config: { maxResults: 2 }
      })

      const results = await customEngine.search('學習', mockBooks)

      expect(results.length).toBeLessThanOrEqual(2)
    })

    test('應該支援自定義匹配函數', async () => {
      const customMatcher = (book, query) => {
        // 只匹配進度大於 50% 的書籍
        return book.progress > 50 && book.title.toLowerCase().includes(query)
      }

      const results = await searchEngine.searchWithMatcher(customMatcher, 'python', mockBooks)

      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Python 機器學習')
      expect(results[0].progress).toBe(100)
    })
  })

  describe('5. Index-Based Search Optimization', () => {
    beforeEach(() => {
      const SearchEngine = require('src/ui/search/core/search-engine')
      searchEngine = new SearchEngine({
        indexManager: mockIndexManager,
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該優先使用索引進行搜尋', async () => {
      const results = await searchEngine.search('JavaScript', mockBooks)

      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('JavaScript 權威指南')

      // 驗證使用了索引搜尋
      const stats = searchEngine.getPerformanceStats()
      expect(stats.indexBasedSearches).toBe(1)
      expect(stats.linearSearches).toBe(0)
    })

    test('不在索引中的查詢應該回退到線性搜尋', async () => {
      const results = await searchEngine.search('不存在的關鍵字xyz', mockBooks)

      expect(results).toHaveLength(0)

      // 驗證使用了線性搜尋
      const stats = searchEngine.getPerformanceStats()
      expect(stats.linearSearches).toBe(1)
    })

    test('應該正確合併多個索引的結果', async () => {
      const results = await searchEngine.search('ai', mockBooks)

      // 'ai' 在標籤索引中
      expect(results).toHaveLength(1)
      expect(results[0].tags).toContain('AI')
    })

    test('應該去除重複結果', async () => {
      // 搜尋可能在多個索引中都匹配的詞
      const results = await searchEngine.search('JavaScript', mockBooks)

      // 確保沒有重複結果
      const uniqueIds = new Set(results.map(book => book.id))
      expect(uniqueIds.size).toBe(results.length)
    })
  })

  describe('6. Performance Monitoring', () => {
    beforeEach(() => {
      const SearchEngine = require('src/ui/search/core/search-engine')
      searchEngine = new SearchEngine({
        indexManager: mockIndexManager,
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該記錄搜尋效能統計', async () => {
      await searchEngine.search('JavaScript', mockBooks)
      await searchEngine.search('Python', mockBooks)

      const stats = searchEngine.getPerformanceStats()
      expect(stats.totalSearches).toBe(2)
      expect(stats.totalSearchTime).toBeGreaterThan(0)
      expect(stats.averageSearchTime).toBeGreaterThan(0)
      expect(stats.fastestSearch).toBeGreaterThan(0)
      expect(stats.slowestSearch).toBeGreaterThan(0)
    })

    test('應該發送效能事件', async () => {
      await searchEngine.search('JavaScript', mockBooks)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.PERFORMANCE.RECORDED', expect.objectContaining({
        query: 'javascript',
        searchTime: expect.any(Number),
        resultCount: expect.any(Number),
        searchType: expect.any(String)
      }))
    })

    test('慢速搜尋應該發送警告事件', async () => {
      // 使用依賴注入的時間函數來模擬慢速搜尋
      let callCount = 0
      const mockTimeFunction = jest.fn(() => {
        if (callCount === 0) {
          callCount++
          return 0 // 開始時間
        } else {
          return 2000 // 結束時間（2秒）
        }
      })

      // 創建使用注入時間函數的 SearchEngine 實例
      const SearchEngine = require('src/ui/search/core/search-engine')
      const testSearchEngine = new SearchEngine({
        indexManager: mockIndexManager,
        eventBus: mockEventBus,
        logger: mockLogger,
        getCurrentTime: mockTimeFunction
      })

      await testSearchEngine.search('JavaScript', mockBooks)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.PERFORMANCE.WARNING', expect.objectContaining({
        type: 'slow_search',
        searchTime: 2000,
        threshold: expect.any(Number)
      }))
    })

    test('應該重置效能統計', () => {
      // 執行一些搜尋
      return searchEngine.search('JavaScript', mockBooks).then(() => {
        searchEngine.resetPerformanceStats()

        const stats = searchEngine.getPerformanceStats()
        expect(stats.totalSearches).toBe(0)
        expect(stats.totalSearchTime).toBe(0)
        expect(stats.averageSearchTime).toBe(0)
        expect(stats.fastestSearch).toBeNull()
        expect(stats.slowestSearch).toBeNull()
      })
    })
  })

  describe('7. Error Handling & Edge Cases', () => {
    beforeEach(() => {
      const SearchEngine = require('src/ui/search/core/search-engine')
      searchEngine = new SearchEngine({
        indexManager: mockIndexManager,
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該正確處理 null 或 undefined 書籍陣列', async () => {
      const results1 = await searchEngine.search('JavaScript', null)
      const results2 = await searchEngine.search('JavaScript', undefined)

      expect(results1).toEqual([])
      expect(results2).toEqual([])
    })

    test('應該正確處理空書籍陣列', async () => {
      const results = await searchEngine.search('JavaScript', [])

      expect(results).toEqual([])
    })

    test('應該正確處理包含無效書籍的陣列', async () => {
      const booksWithInvalid = [
        mockBooks[0],
        null,
        undefined,
        { id: 'invalid', title: null }, // 無效書籍
        mockBooks[1]
      ]

      // 搜尋一個不在索引中的詞，強制線性搜尋
      const results = await searchEngine.search('不存在的詞xyz', booksWithInvalid)

      expect(results).toHaveLength(0)

      // 檢查警告日誌
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    test('應該正確處理搜尋過程中的錯誤', async () => {
      // Mock 索引管理器拋出錯誤
      const brokenIndexManager = {
        ...mockIndexManager,
        titleIndex: {
          get: jest.fn(() => {
            const error = new Error('索引讀取失敗')
            error.code = 'SEARCH_RESULT_EVENT_ERROR'
            error.details = { category: 'testing' }
            throw error
          }),
          has: jest.fn(() => true)
        }
      }

      const brokenEngine = new (require('src/ui/search/core/search-engine'))({
        indexManager: brokenIndexManager,
        eventBus: mockEventBus,
        logger: mockLogger
      })

      const results = await brokenEngine.search('JavaScript', mockBooks)

      // 應該回退到線性搜尋
      expect(results).toHaveLength(1)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('索引搜尋失敗'),
        expect.any(Object)
      )
    })

    test('應該處理極長的查詢字串', async () => {
      const longQuery = 'a'.repeat(1000)

      const result = searchEngine.validateQuery(longQuery)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('查詢長度必須在 1 到 100 個字元之間')
    })

    test('應該處理特殊字元查詢', async () => {
      const specialQueries = ['@#$%', '!!', '???', '...', '---']

      for (const query of specialQueries) {
        const results = await searchEngine.search(query, mockBooks)
        expect(Array.isArray(results)).toBe(true)
        // 特殊字元搜尋通常不會有結果，但不應該拋出錯誤
      }
    })

    test('應該處理非 ASCII 字元', async () => {
      const unicodeQueries = ['機器學習', '🚀', '中文測試', 'émoji']

      for (const query of unicodeQueries) {
        expect(() => {
          searchEngine.normalizeQuery(query)
        }).not.toThrow()
      }
    })
  })

  describe('8. Integration & Event Handling', () => {
    beforeEach(() => {
      const SearchEngine = require('src/ui/search/core/search-engine')
      searchEngine = new SearchEngine({
        indexManager: mockIndexManager,
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('搜尋完成時應該發送事件', async () => {
      const results = await searchEngine.search('JavaScript', mockBooks)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.COMPLETED', expect.objectContaining({
        query: 'javascript',
        results,
        resultCount: results.length,
        searchTime: expect.any(Number)
      }))
    })

    test('應該支援事件驅動的搜尋請求', () => {
      const searchRequest = {
        query: 'JavaScript',
        books: mockBooks,
        options: { maxResults: 10 }
      }

      searchEngine.handleSearchRequest(searchRequest)

      // 事件處理應該是異步的，檢查是否正確處理
      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.REQUEST.RECEIVED', expect.objectContaining({
        query: 'JavaScript'
      }))
    })

    test('應該與索引管理器正確集成', async () => {
      // 確保搜尋引擎正確使用索引管理器
      await searchEngine.search('JavaScript', mockBooks)

      // 驗證統計資料更新
      const stats = searchEngine.getPerformanceStats()
      expect(stats.indexBasedSearches).toBe(1)
    })

    test('應該處理索引管理器狀態變更', () => {
      const newIndexStats = {
        titleIndexSize: 10,
        authorIndexSize: 10,
        tagIndexSize: 10,
        totalBooks: 5
      }

      searchEngine.handleIndexUpdate(newIndexStats)

      expect(mockLogger.info).toHaveBeenCalledWith(
        '搜尋引擎已更新索引統計',
        newIndexStats
      )
    })
  })
})
