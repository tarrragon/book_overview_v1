// eslint-disable-next-line no-unused-vars
const { ErrorCodes } = require('src/core/errors/ErrorCodes')
/**
 * SearchResultFormatter 單元測試
 * TDD 循環 4/8 - BookSearchFilter 職責拆分重構
 *
 * 測試目標：
 * - 搜尋結果格式化邏輯
 * - 事件格式化和發送
 * - 結果統計和後設資料處理
 * - 空結果和錯誤狀態處理
 * - 結果分組和排序功能
 * - 效能統計整合
 */

describe('SearchResultFormatter', () => {
  // eslint-disable-next-line no-unused-vars
  let formatter
  // eslint-disable-next-line no-unused-vars
  let mockEventBus
  // eslint-disable-next-line no-unused-vars
  let mockLogger

  beforeEach(() => {
    // 設置 Mock EventBus
    mockEventBus = {
      emit: jest.fn()
    }

    // 設置 Mock Logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }

    // 重置所有 Mock
    jest.clearAllMocks()
  })

  describe('建構和初始化', () => {
    test('應該能夠正確建構 SearchResultFormatter 實例', () => {
      // eslint-disable-next-line no-unused-vars
      const SearchResultFormatter = require('src/ui/search/formatter/search-result-formatter')

      expect(() => {
        formatter = new SearchResultFormatter({
          eventBus: mockEventBus,
          logger: mockLogger
        })
        // 變數賦值確保建構子結果被正確處理
      }).not.toThrow()
    })

    test('建構時缺少 eventBus 應該拋出錯誤', () => {
      // eslint-disable-next-line no-unused-vars
      const SearchResultFormatter = require('src/ui/search/formatter/search-result-formatter')

      expect(() => {
        // eslint-disable-next-line no-unused-vars
        const invalidFormatter = new SearchResultFormatter({ logger: mockLogger })
        // 變數賦值確保建構子結果被正確處理，測試錯誤條件
      }).toMatchObject({
        message: expect.stringContaining('EventBus 和 Logger 是必需的')
      })
    })

    test('建構時缺少 logger 應該拋出錯誤', () => {
      // eslint-disable-next-line no-unused-vars
      const SearchResultFormatter = require('src/ui/search/formatter/search-result-formatter')

      expect(() => {
        // eslint-disable-next-line no-unused-vars
        const invalidFormatter = new SearchResultFormatter({ eventBus: mockEventBus })
        // 變數賦值確保建構子結果被正確處理，測試錯誤條件
      }).toMatchObject({
        message: expect.stringContaining('EventBus 和 Logger 是必需的')
      })
    })

    test('應該正確合併預設配置和自定義配置', () => {
      // eslint-disable-next-line no-unused-vars
      const SearchResultFormatter = require('src/ui/search/formatter/search-result-formatter')

      // eslint-disable-next-line no-unused-vars
      const customConfig = {
        enableStatistics: false,
        maxResultsToFormat: 50,
        enableResultGrouping: true
      }

      formatter = new SearchResultFormatter({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: customConfig
      })

      expect(formatter.config.enableStatistics).toBe(false)
      expect(formatter.config.maxResultsToFormat).toBe(50)
      expect(formatter.config.enableResultGrouping).toBe(true)
      expect(formatter.config.enableEvents).toBe(true) // 預設值
    })
  })

  describe('基本搜尋結果格式化', () => {
    beforeEach(() => {
      // eslint-disable-next-line no-unused-vars
      const SearchResultFormatter = require('src/ui/search/formatter/search-result-formatter')
      formatter = new SearchResultFormatter({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該能夠格式化基本搜尋結果', () => {
      // eslint-disable-next-line no-unused-vars
      const query = 'test query'
      // eslint-disable-next-line no-unused-vars
      const rawResults = [
        { id: 1, title: 'Test Book 1', author: 'Author 1' },
        { id: 2, title: 'Test Book 2', author: 'Author 2' }
      ]

      // eslint-disable-next-line no-unused-vars
      const formattedResults = formatter.formatResults(query, rawResults)

      expect(formattedResults).toHaveProperty('query', query)
      expect(formattedResults).toHaveProperty('results')
      expect(formattedResults).toHaveProperty('metadata')
      expect(formattedResults.results).toHaveLength(2)
      expect(formattedResults.metadata.totalCount).toBe(2)
    })

    test('應該為每個結果項目添加格式化的後設資料', () => {
      // eslint-disable-next-line no-unused-vars
      const query = 'javascript'
      // eslint-disable-next-line no-unused-vars
      const rawResults = [
        {
          id: 1,
          title: 'JavaScript Guide',
          author: 'John Doe',
          publishDate: '2023-01-01',
          readingProgress: 0.3
        }
      ]

      // eslint-disable-next-line no-unused-vars
      const formattedResults = formatter.formatResults(query, rawResults)
      // eslint-disable-next-line no-unused-vars
      const firstResult = formattedResults.results[0]

      expect(firstResult).toHaveProperty('originalData')
      expect(firstResult).toHaveProperty('formattedTitle')
      expect(firstResult).toHaveProperty('formattedAuthor')
      expect(firstResult).toHaveProperty('formattedProgress')
      expect(firstResult).toHaveProperty('relevanceScore')
    })

    test('應該能夠處理空搜尋結果', () => {
      // eslint-disable-next-line no-unused-vars
      const query = 'nonexistent'
      // eslint-disable-next-line no-unused-vars
      const rawResults = []

      // eslint-disable-next-line no-unused-vars
      const formattedResults = formatter.formatResults(query, rawResults)

      expect(formattedResults.results).toHaveLength(0)
      expect(formattedResults.metadata.totalCount).toBe(0)
      expect(formattedResults.metadata.isEmpty).toBe(true)
    })

    test('應該限制結果數量根據配置設定', () => {
      // eslint-disable-next-line no-unused-vars
      const SearchResultFormatter = require('src/ui/search/formatter/search-result-formatter')
      formatter = new SearchResultFormatter({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: { maxResultsToFormat: 2 }
      })

      // eslint-disable-next-line no-unused-vars
      const query = 'test'
      // eslint-disable-next-line no-unused-vars
      const rawResults = [
        { id: 1, title: 'Book 1' },
        { id: 2, title: 'Book 2' },
        { id: 3, title: 'Book 3' },
        { id: 4, title: 'Book 4' }
      ]

      // eslint-disable-next-line no-unused-vars
      const formattedResults = formatter.formatResults(query, rawResults)

      expect(formattedResults.results).toHaveLength(2)
      expect(formattedResults.metadata.totalAvailable).toBe(4)
      expect(formattedResults.metadata.hasMore).toBe(true)
    })
  })

  describe('事件發送和通知', () => {
    beforeEach(() => {
      // eslint-disable-next-line no-unused-vars
      const SearchResultFormatter = require('src/ui/search/formatter/search-result-formatter')
      formatter = new SearchResultFormatter({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該為有結果的搜尋發送正確的事件', () => {
      // eslint-disable-next-line no-unused-vars
      const query = 'test'
      // eslint-disable-next-line no-unused-vars
      const rawResults = [
        { id: 1, title: 'Test Book', author: 'Test Author' }
      ]

      formatter.emitResults(query, rawResults)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.RESULTS.UPDATED',
        expect.objectContaining({
          query,
          formattedResults: expect.any(Object),
          metadata: expect.any(Object)
        })
      )
    })

    test('應該為空結果搜尋發送 NO_RESULTS 事件', () => {
      // eslint-disable-next-line no-unused-vars
      const query = 'nonexistent'
      // eslint-disable-next-line no-unused-vars
      const rawResults = []

      formatter.emitResults(query, rawResults)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.NO.RESULTS',
        expect.objectContaining({
          query,
          formattedResults: expect.any(Object),
          metadata: expect.objectContaining({ isEmpty: true })
        })
      )
    })

    test('應該發送搜尋狀態更新事件', () => {
      // eslint-disable-next-line no-unused-vars
      const query = 'test'
      // eslint-disable-next-line no-unused-vars
      const rawResults = [{ id: 1, title: 'Book' }]

      formatter.emitResults(query, rawResults)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.STATUS.CHANGED',
        expect.objectContaining({
          isSearching: false,
          hasQuery: true,
          resultCount: 1,
          hasMore: false
        })
      )
    })

    test('事件發送被禁用時不應該發送事件', () => {
      // eslint-disable-next-line no-unused-vars
      const SearchResultFormatter = require('src/ui/search/formatter/search-result-formatter')
      formatter = new SearchResultFormatter({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: { enableEvents: false }
      })

      formatter.emitResults('test', [{ id: 1, title: 'Book' }])

      expect(mockEventBus.emit).not.toHaveBeenCalled()
    })
  })

  describe('結果分組功能', () => {
    beforeEach(() => {
      // eslint-disable-next-line no-unused-vars
      const SearchResultFormatter = require('src/ui/search/formatter/search-result-formatter')
      formatter = new SearchResultFormatter({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: { enableResultGrouping: true }
      })
    })

    test('應該能夠按作者分組結果', () => {
      // eslint-disable-next-line no-unused-vars
      const rawResults = [
        { id: 1, title: 'Book 1', author: 'John Doe', category: 'Tech' },
        { id: 2, title: 'Book 2', author: 'John Doe', category: 'Tech' },
        { id: 3, title: 'Book 3', author: 'Jane Smith', category: 'Tech' }
      ]

      // eslint-disable-next-line no-unused-vars
      const grouped = formatter.groupResults(rawResults, 'author')

      expect(grouped).toHaveProperty('John Doe')
      expect(grouped).toHaveProperty('Jane Smith')
      expect(grouped['John Doe']).toHaveLength(2)
      expect(grouped['Jane Smith']).toHaveLength(1)
    })

    test('應該能夠按分類分組結果', () => {
      // eslint-disable-next-line no-unused-vars
      const rawResults = [
        { id: 1, title: 'Book 1', category: 'Fiction' },
        { id: 2, title: 'Book 2', category: 'Non-Fiction' },
        { id: 3, title: 'Book 3', category: 'Fiction' }
      ]

      // eslint-disable-next-line no-unused-vars
      const grouped = formatter.groupResults(rawResults, 'category')

      expect(grouped).toHaveProperty('Fiction')
      expect(grouped).toHaveProperty('Non-Fiction')
      expect(grouped.Fiction).toHaveLength(2)
      expect(grouped['Non-Fiction']).toHaveLength(1)
    })

    test('對於無效分組鍵應該返回原始結果', () => {
      // eslint-disable-next-line no-unused-vars
      const rawResults = [
        { id: 1, title: 'Book 1' },
        { id: 2, title: 'Book 2' }
      ]

      // eslint-disable-next-line no-unused-vars
      const grouped = formatter.groupResults(rawResults, 'nonexistent')

      expect(grouped).toHaveProperty('ungrouped')
      expect(grouped.ungrouped).toHaveLength(2)
    })
  })

  describe('結果排序功能', () => {
    beforeEach(() => {
      // eslint-disable-next-line no-unused-vars
      const SearchResultFormatter = require('src/ui/search/formatter/search-result-formatter')
      formatter = new SearchResultFormatter({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該能夠按相關性分數排序結果', () => {
      // eslint-disable-next-line no-unused-vars
      const query = 'javascript'
      // eslint-disable-next-line no-unused-vars
      const rawResults = [
        { id: 1, title: 'Advanced JavaScript', author: 'Author 1' },
        { id: 2, title: 'HTML Guide', author: 'Author 2' },
        { id: 3, title: 'JavaScript Basics', author: 'Author 3' }
      ]

      // eslint-disable-next-line no-unused-vars
      const sortedResults = formatter.sortResults(rawResults, query, 'relevance')

      // JavaScript 相關書籍應該排在前面
      expect(sortedResults[0].title).toContain('JavaScript')
      expect(sortedResults[1].title).toContain('JavaScript')
      expect(sortedResults[2].title).toBe('HTML Guide')
    })

    test('應該能夠按標題字母順序排序結果', () => {
      // eslint-disable-next-line no-unused-vars
      const rawResults = [
        { id: 1, title: 'Zebra Book' },
        { id: 2, title: 'Apple Book' },
        { id: 3, title: 'Bridge Book' }
      ]

      // eslint-disable-next-line no-unused-vars
      const sortedResults = formatter.sortResults(rawResults, '', 'title')

      expect(sortedResults[0].title).toBe('Apple Book')
      expect(sortedResults[1].title).toBe('Bridge Book')
      expect(sortedResults[2].title).toBe('Zebra Book')
    })

    test('應該能夠按作者排序結果', () => {
      // eslint-disable-next-line no-unused-vars
      const rawResults = [
        { id: 1, title: 'Book 1', author: 'Zebra Author' },
        { id: 2, title: 'Book 2', author: 'Apple Author' },
        { id: 3, title: 'Book 3', author: 'Bridge Author' }
      ]

      // eslint-disable-next-line no-unused-vars
      const sortedResults = formatter.sortResults(rawResults, '', 'author')

      expect(sortedResults[0].author).toBe('Apple Author')
      expect(sortedResults[1].author).toBe('Bridge Author')
      expect(sortedResults[2].author).toBe('Zebra Author')
    })
  })

  describe('相關性分數計算', () => {
    beforeEach(() => {
      // eslint-disable-next-line no-unused-vars
      const SearchResultFormatter = require('src/ui/search/formatter/search-result-formatter')
      formatter = new SearchResultFormatter({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('標題完全匹配應該獲得最高分數', () => {
      // eslint-disable-next-line no-unused-vars
      const query = 'javascript guide'
      // eslint-disable-next-line no-unused-vars
      const book = { title: 'JavaScript Guide', author: 'John Doe' }

      // eslint-disable-next-line no-unused-vars
      const score = formatter.calculateRelevanceScore(book, query)

      expect(score).toBeGreaterThan(0.8)
    })

    test('標題部分匹配應該獲得中等分數', () => {
      // eslint-disable-next-line no-unused-vars
      const query = 'javascript'
      // eslint-disable-next-line no-unused-vars
      const book = { title: 'Advanced JavaScript Programming', author: 'John Doe' }

      // eslint-disable-next-line no-unused-vars
      const score = formatter.calculateRelevanceScore(book, query)

      expect(score).toBeGreaterThan(0.3)
      expect(score).toBeLessThan(0.8)
    })

    test('只有作者匹配應該獲得較低分數', () => {
      // eslint-disable-next-line no-unused-vars
      const query = 'john doe'
      // eslint-disable-next-line no-unused-vars
      const book = { title: 'Python Programming', author: 'John Doe' }

      // eslint-disable-next-line no-unused-vars
      const score = formatter.calculateRelevanceScore(book, query)

      expect(score).toBeGreaterThan(0.1)
      expect(score).toBeLessThan(0.3)
    })

    test('標籤匹配應該增加相關性分數', () => {
      // eslint-disable-next-line no-unused-vars
      const query = 'programming'
      // eslint-disable-next-line no-unused-vars
      const book = {
        title: 'Learning Book',
        author: 'Author',
        tags: ['programming', 'tutorial']
      }

      // eslint-disable-next-line no-unused-vars
      const score = formatter.calculateRelevanceScore(book, query)

      expect(score).toBeGreaterThan(0.2)
    })

    test('無匹配內容應該獲得零分數', () => {
      // eslint-disable-next-line no-unused-vars
      const query = 'quantum physics'
      // eslint-disable-next-line no-unused-vars
      const book = { title: 'Cooking Basics', author: 'Chef Smith' }

      // eslint-disable-next-line no-unused-vars
      const score = formatter.calculateRelevanceScore(book, query)

      expect(score).toBe(0)
    })
  })

  describe('統計和效能監控', () => {
    beforeEach(() => {
      // eslint-disable-next-line no-unused-vars
      const SearchResultFormatter = require('src/ui/search/formatter/search-result-formatter')
      formatter = new SearchResultFormatter({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: { enableStatistics: true }
      })
    })

    test('應該記錄格式化操作統計', () => {
      // eslint-disable-next-line no-unused-vars
      const query = 'test'
      // eslint-disable-next-line no-unused-vars
      const rawResults = [
        { id: 1, title: 'Book 1' },
        { id: 2, title: 'Book 2' }
      ]

      formatter.formatResults(query, rawResults)

      // eslint-disable-next-line no-unused-vars
      const stats = formatter.getStatistics()
      expect(stats.totalFormatOperations).toBe(1)
      expect(stats.totalResultsFormatted).toBe(2)
      expect(stats.averageFormattingTime).toBeGreaterThan(0)
    })

    test('應該追蹤不同查詢類型的統計', () => {
      formatter.formatResults('single', [{ id: 1, title: 'Book' }])
      formatter.formatResults('multiple words query', [{ id: 1, title: 'Book' }])
      formatter.formatResults('', [])

      // eslint-disable-next-line no-unused-vars
      const stats = formatter.getStatistics()
      expect(stats.queryTypes.singleWord).toBe(1)
      expect(stats.queryTypes.multipleWords).toBe(1)
      expect(stats.queryTypes.empty).toBe(1)
    })

    test('應該能夠重置統計資料', () => {
      formatter.formatResults('test', [{ id: 1, title: 'Book' }])

      // eslint-disable-next-line no-unused-vars
      let stats = formatter.getStatistics()
      expect(stats.totalFormatOperations).toBe(1)

      formatter.resetStatistics()

      stats = formatter.getStatistics()
      expect(stats.totalFormatOperations).toBe(0)
    })

    test('統計功能被禁用時不應該記錄統計', () => {
      // eslint-disable-next-line no-unused-vars
      const SearchResultFormatter = require('src/ui/search/formatter/search-result-formatter')
      formatter = new SearchResultFormatter({
        eventBus: mockEventBus,
        logger: mockLogger,
        config: { enableStatistics: false }
      })

      formatter.formatResults('test', [{ id: 1, title: 'Book' }])

      // eslint-disable-next-line no-unused-vars
      const stats = formatter.getStatistics()
      expect(stats.totalFormatOperations).toBe(0)
    })
  })

  describe('錯誤處理', () => {
    beforeEach(() => {
      // eslint-disable-next-line no-unused-vars
      const SearchResultFormatter = require('src/ui/search/formatter/search-result-formatter')
      formatter = new SearchResultFormatter({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('無效查詢參數應該拋出錯誤', () => {
      expect(() => {
        formatter.formatResults(null, [])
      }).toMatchObject({
        message: expect.stringContaining('查詢參數必須是字串')
      })

      expect(() => {
        formatter.formatResults(123, [])
      }).toMatchObject({
        message: expect.stringContaining('查詢參數必須是字串')
      })
    })

    test('無效結果參數應該拋出錯誤', () => {
      expect(() => {
        formatter.formatResults('test', null)
      }).toMatchObject({
        message: expect.stringContaining('結果參數必須是陣列')
      })

      expect(() => {
        formatter.formatResults('test', 'not array')
      }).toMatchObject({
        message: expect.stringContaining('結果參數必須是陣列')
      })
    })

    test('無效的書籍對象應該被跳過並記錄警告', () => {
      // eslint-disable-next-line no-unused-vars
      const query = 'test'
      // eslint-disable-next-line no-unused-vars
      const rawResults = [
        { id: 1, title: 'Valid Book' },
        null,
        { id: 2 }, // 缺少 title
        { id: 3, title: 'Another Valid Book' }
      ]

      // eslint-disable-next-line no-unused-vars
      const formattedResults = formatter.formatResults(query, rawResults)

      expect(formattedResults.results).toHaveLength(2)
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    test('事件發送失敗時應該記錄錯誤但不影響格式化', () => {
      // 模擬 eventBus 發送失敗
      mockEventBus.emit.mockImplementation(() => {
        // eslint-disable-next-line no-unused-vars
        const error = new Error('Event emission failed')
        error.code = 'MEMORY_INSUFFICIENT_ERROR'
        error.details = { category: 'testing' }
        throw error
      })

      expect(() => {
        formatter.emitResults('test', [{ id: 1, title: 'Book' }])
      }).not.toThrow()

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('記憶體管理', () => {
    beforeEach(() => {
      // eslint-disable-next-line no-unused-vars
      const SearchResultFormatter = require('src/ui/search/formatter/search-result-formatter')
      formatter = new SearchResultFormatter({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該能夠清理內部快取和狀態', () => {
      // 執行一些格式化操作建立內部狀態
      formatter.formatResults('test1', [{ id: 1, title: 'Book 1' }])
      formatter.formatResults('test2', [{ id: 2, title: 'Book 2' }])

      expect(formatter.getStatistics().totalFormatOperations).toBe(2)

      formatter.cleanup()

      // 驗證狀態已被清理
      // eslint-disable-next-line no-unused-vars
      const stats = formatter.getStatistics()
      expect(stats.totalFormatOperations).toBe(0)
    })

    test('應該能夠銷毀格式化器實例', () => {
      formatter.formatResults('test', [{ id: 1, title: 'Book' }])

      formatter.destroy()

      // 驗證銷毀後無法進行操作
      expect(() => {
        formatter.formatResults('test', [])
      }).toThrow()
    })
  })
})
