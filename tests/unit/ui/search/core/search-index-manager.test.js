/**
 * SearchIndexManager 單元測試 - TDD 循環 1/8
 * BookSearchFilter 職責拆分重構
 *
 * 負責功能：
 * - 搜尋索引的建構和維護
 * - 書名、作者、標籤索引管理
 * - 索引更新和重建機制
 * - 索引統計和診斷功能
 * - 記憶體管理和錯誤處理
 *
 * 測試涵蓋範圍：
 * - 索引建構和初始化
 * - 多類型索引管理（書名、作者、標籤）
 * - 索引更新和重建
 * - 效能和記憶體管理
 * - 錯誤處理和邊界條件
 *
 * @version 1.0.0
 * @since 2025-08-20
 */

// 測試環境設定
require('../../../../test-setup')
const { StandardError } = require('src/core/errors/StandardError')

describe('SearchIndexManager - TDD 循環 1/8', () => {
  let indexManager
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
      progress: 45
    },
    {
      id: 'book-002',
      title: 'Python 機器學習',
      author: 'Sebastian Raschka',
      tags: ['機器學習', 'Python', '人工智慧'],
      status: 'completed',
      progress: 100
    },
    {
      id: 'book-003',
      title: 'Deep Learning 深度學習',
      author: 'Ian Goodfellow',
      tags: ['深度學習', 'AI', '神經網路'],
      status: 'planned',
      progress: 0
    }
  ]

  beforeEach(() => {
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
    if (indexManager) {
      indexManager.destroy?.()
      indexManager = null
    }
  })

  describe('1. Construction & Initialization', () => {
    test('應該正確建構 SearchIndexManager 實例', () => {
      const SearchIndexManager = require('src/ui/search/core/search-index-manager')

      indexManager = new SearchIndexManager({
        eventBus: mockEventBus,
        logger: mockLogger
      })

      expect(indexManager).toBeInstanceOf(SearchIndexManager)
      expect(indexManager.eventBus).toBe(mockEventBus)
      expect(indexManager.logger).toBe(mockLogger)
    })

    test('應該初始化空的索引 Maps', () => {
      const SearchIndexManager = require('src/ui/search/core/search-index-manager')

      indexManager = new SearchIndexManager({
        eventBus: mockEventBus,
        logger: mockLogger
      })

      expect(indexManager.titleIndex).toBeInstanceOf(Map)
      expect(indexManager.authorIndex).toBeInstanceOf(Map)
      expect(indexManager.tagIndex).toBeInstanceOf(Map)
      expect(indexManager.titleIndex.size).toBe(0)
      expect(indexManager.authorIndex.size).toBe(0)
      expect(indexManager.tagIndex.size).toBe(0)
    })

    test('建構時若缺少必要參數應該拋出錯誤', () => {
      const SearchIndexManager = require('src/ui/search/core/search-index-manager')

      expect(() => {
        new SearchIndexManager()
      }).toMatchObject({
        message: expect.stringContaining('EventBus 和 Logger 是必需的')
      })

      expect(() => {
        new SearchIndexManager({ eventBus: mockEventBus })
      }).toMatchObject({
        message: expect.stringContaining('EventBus 和 Logger 是必需的')
      })
    })

    test('應該正確初始化統計資料', () => {
      const SearchIndexManager = require('src/ui/search/core/search-index-manager')

      indexManager = new SearchIndexManager({
        eventBus: mockEventBus,
        logger: mockLogger
      })

      const stats = indexManager.getIndexStats()
      expect(stats).toEqual({
        titleIndexSize: 0,
        authorIndexSize: 0,
        tagIndexSize: 0,
        totalBooks: 0,
        lastBuildTime: null,
        buildDuration: 0
      })
    })
  })

  describe('2. Index Building & Management', () => {
    beforeEach(() => {
      const SearchIndexManager = require('src/ui/search/core/search-index-manager')
      indexManager = new SearchIndexManager({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該正確建構書名索引（完整標題和分詞）', () => {
      indexManager.buildIndex(mockBooks)

      // 檢查完整標題索引
      expect(indexManager.titleIndex.has('javascript 權威指南')).toBe(true)
      expect(indexManager.titleIndex.has('python 機器學習')).toBe(true)
      expect(indexManager.titleIndex.has('deep learning 深度學習')).toBe(true)

      // 檢查分詞索引
      expect(indexManager.titleIndex.has('javascript')).toBe(true)
      expect(indexManager.titleIndex.has('權威指南')).toBe(true)
      expect(indexManager.titleIndex.has('python')).toBe(true)
      expect(indexManager.titleIndex.has('machine')).toBe(false) // 確認中文標題不會被錯誤分詞

      // 檢查索引內容正確性
      const jsBooks = indexManager.titleIndex.get('javascript')
      expect(jsBooks).toHaveLength(1)
      expect(jsBooks[0].id).toBe('book-001')
    })

    test('應該正確建構作者索引（完整姓名和分詞）', () => {
      indexManager.buildIndex(mockBooks)

      // 檢查完整作者姓名索引
      expect(indexManager.authorIndex.has('david flanagan')).toBe(true)
      expect(indexManager.authorIndex.has('sebastian raschka')).toBe(true)
      expect(indexManager.authorIndex.has('ian goodfellow')).toBe(true)

      // 檢查分詞索引
      expect(indexManager.authorIndex.has('david')).toBe(true)
      expect(indexManager.authorIndex.has('flanagan')).toBe(true)
      expect(indexManager.authorIndex.has('sebastian')).toBe(true)
      expect(indexManager.authorIndex.has('goodfellow')).toBe(true)

      // 檢查索引內容正確性
      const davidBooks = indexManager.authorIndex.get('david')
      expect(davidBooks).toHaveLength(1)
      expect(davidBooks[0].author).toBe('David Flanagan')
    })

    test('應該正確建構標籤索引', () => {
      indexManager.buildIndex(mockBooks)

      // 檢查標籤索引
      expect(indexManager.tagIndex.has('程式設計')).toBe(true)
      expect(indexManager.tagIndex.has('javascript')).toBe(true)
      expect(indexManager.tagIndex.has('機器學習')).toBe(true)
      expect(indexManager.tagIndex.has('python')).toBe(true)
      expect(indexManager.tagIndex.has('深度學習')).toBe(true)
      expect(indexManager.tagIndex.has('ai')).toBe(true)

      // 檢查標籤索引內容正確性
      const jsTagBooks = indexManager.tagIndex.get('javascript')
      expect(jsTagBooks).toHaveLength(1)
      expect(jsTagBooks[0].id).toBe('book-001')

      const pythonTagBooks = indexManager.tagIndex.get('python')
      expect(pythonTagBooks).toHaveLength(1)
      expect(pythonTagBooks[0].id).toBe('book-002')
    })

    test('建構索引後應該更新統計資料', () => {
      const startTime = Date.now()
      indexManager.buildIndex(mockBooks)
      const endTime = Date.now()

      const stats = indexManager.getIndexStats()
      expect(stats.totalBooks).toBe(3)
      expect(stats.titleIndexSize).toBeGreaterThan(0)
      expect(stats.authorIndexSize).toBeGreaterThan(0)
      expect(stats.tagIndexSize).toBeGreaterThan(0)
      expect(stats.lastBuildTime).toBeGreaterThanOrEqual(startTime)
      expect(stats.lastBuildTime).toBeLessThanOrEqual(endTime)
      expect(stats.buildDuration).toBeGreaterThanOrEqual(0)
    })

    test('應該正確處理空書籍陣列', () => {
      indexManager.buildIndex([])

      expect(indexManager.titleIndex.size).toBe(0)
      expect(indexManager.authorIndex.size).toBe(0)
      expect(indexManager.tagIndex.size).toBe(0)

      const stats = indexManager.getIndexStats()
      expect(stats.totalBooks).toBe(0)
    })

    test('應該正確處理缺少資料欄位的書籍', () => {
      const incompleteBooks = [
        { id: 'book-incomplete-1', title: 'Only Title' },
        { id: 'book-incomplete-2', author: 'Only Author' },
        { id: 'book-incomplete-3', tags: ['only', 'tags'] },
        { id: 'book-incomplete-4' } // 完全沒有可索引的資料
      ]

      expect(() => {
        indexManager.buildIndex(incompleteBooks)
      }).not.toThrow()

      // 檢查部分索引是否正確建立
      expect(indexManager.titleIndex.has('only title')).toBe(true)
      expect(indexManager.authorIndex.has('only author')).toBe(true)
      expect(indexManager.tagIndex.has('only')).toBe(true)
      expect(indexManager.tagIndex.has('tags')).toBe(true)
    })
  })

  describe('3. Index Updates & Rebuilding', () => {
    beforeEach(() => {
      const SearchIndexManager = require('src/ui/search/core/search-index-manager')
      indexManager = new SearchIndexManager({
        eventBus: mockEventBus,
        logger: mockLogger
      })
      indexManager.buildIndex(mockBooks)
    })

    test('應該支援新增單一書籍到索引', () => {
      const newBook = {
        id: 'book-new',
        title: 'React 開發實戰',
        author: 'Alex Banks',
        tags: ['React', 'Frontend', '開發']
      }

      indexManager.addBookToIndex(newBook)

      // 檢查新書是否正確加入索引
      expect(indexManager.titleIndex.has('react 開發實戰')).toBe(true)
      expect(indexManager.titleIndex.has('react')).toBe(true)
      expect(indexManager.authorIndex.has('alex banks')).toBe(true)
      expect(indexManager.authorIndex.has('alex')).toBe(true)
      expect(indexManager.tagIndex.has('react')).toBe(true)
      expect(indexManager.tagIndex.has('frontend')).toBe(true)

      const stats = indexManager.getIndexStats()
      expect(stats.totalBooks).toBe(4) // 原本3本 + 新增1本
    })

    test('應該支援從索引中移除書籍', () => {
      const bookToRemove = mockBooks[0] // JavaScript 權威指南

      indexManager.removeBookFromIndex(bookToRemove)

      // 檢查書籍是否從索引中移除
      const jsBooks = indexManager.titleIndex.get('javascript')
      expect(jsBooks || []).toHaveLength(0)

      const davidBooks = indexManager.authorIndex.get('david')
      expect(davidBooks || []).toHaveLength(0)

      const jsTagBooks = indexManager.tagIndex.get('javascript')
      expect(jsTagBooks || []).toHaveLength(0)

      const stats = indexManager.getIndexStats()
      expect(stats.totalBooks).toBe(2) // 原本3本 - 移除1本
    })

    test('應該支援更新現有書籍索引', () => {
      const updatedBook = {
        ...mockBooks[0],
        title: 'JavaScript ES2024 權威指南 (第七版)',
        tags: ['程式設計', 'JavaScript', 'ES2024', '前端開發']
      }

      indexManager.updateBookInIndex(mockBooks[0], updatedBook)

      // 檢查舊資料是否移除
      expect(indexManager.titleIndex.has('javascript 權威指南')).toBe(false)

      // 檢查新資料是否正確加入
      expect(indexManager.titleIndex.has('javascript es2024 權威指南 (第七版)')).toBe(true)
      expect(indexManager.titleIndex.has('es2024')).toBe(true)
      expect(indexManager.tagIndex.has('es2024')).toBe(true)
      expect(indexManager.tagIndex.has('前端開發')).toBe(true)

      const stats = indexManager.getIndexStats()
      expect(stats.totalBooks).toBe(3) // 總數不變，只是更新
    })

    test('應該支援清空所有索引', () => {
      indexManager.clearIndex()

      expect(indexManager.titleIndex.size).toBe(0)
      expect(indexManager.authorIndex.size).toBe(0)
      expect(indexManager.tagIndex.size).toBe(0)

      const stats = indexManager.getIndexStats()
      expect(stats.totalBooks).toBe(0)
      expect(stats.titleIndexSize).toBe(0)
      expect(stats.authorIndexSize).toBe(0)
      expect(stats.tagIndexSize).toBe(0)
    })

    test('應該支援重建整個索引', () => {
      // 先修改一些資料讓索引不一致
      indexManager.titleIndex.set('fake-entry', [])

      const newBooks = [
        {
          id: 'new-book-1',
          title: 'Vue.js 開發指南',
          author: 'Evan You',
          tags: ['Vue', 'Frontend']
        }
      ]

      indexManager.rebuildIndex(newBooks)

      // 檢查舊資料被清除
      expect(indexManager.titleIndex.has('fake-entry')).toBe(false)
      expect(indexManager.titleIndex.has('javascript 權威指南')).toBe(false)

      // 檢查新資料正確建立
      expect(indexManager.titleIndex.has('vue.js 開發指南')).toBe(true)
      expect(indexManager.authorIndex.has('evan you')).toBe(true)
      expect(indexManager.tagIndex.has('vue')).toBe(true)

      const stats = indexManager.getIndexStats()
      expect(stats.totalBooks).toBe(1)
    })
  })

  describe('4. Performance & Memory Management', () => {
    beforeEach(() => {
      const SearchIndexManager = require('src/ui/search/core/search-index-manager')
      indexManager = new SearchIndexManager({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該在記憶體不足時拋出錯誤', () => {
      // 建立超過記憶體限制的大量資料 (模擬50000+書籍)
      const largeBookArray = new Array(50001).fill(null).map((_, index) => ({
        id: `book-${index}`,
        title: `Book ${index}`,
        author: `Author ${index}`,
        tags: [`tag${index}`]
      }))

      expect(() => {
        indexManager.buildIndex(largeBookArray)
      }).toMatchObject({
        message: expect.stringContaining('記憶體不足')
      })

      // 檢查錯誤事件是否被發送
      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.WARNING', expect.objectContaining({
        message: '記憶體不足，無法建構搜尋索引',
        error: '記憶體不足'
      }))
    })

    test('應該提供記憶體使用估算', () => {
      indexManager.buildIndex(mockBooks)

      const memoryUsage = indexManager.getMemoryUsage()
      expect(memoryUsage).toEqual({
        titleIndexEntries: expect.any(Number),
        authorIndexEntries: expect.any(Number),
        tagIndexEntries: expect.any(Number),
        totalIndexEntries: expect.any(Number),
        estimatedMemoryKB: expect.any(Number)
      })

      expect(memoryUsage.totalIndexEntries).toBeGreaterThan(0)
      expect(memoryUsage.estimatedMemoryKB).toBeGreaterThan(0)
    })

    test('應該支援索引壓縮優化', () => {
      // 建立一些重複的索引項目
      const duplicateBooks = [
        ...mockBooks,
        ...mockBooks.map(book => ({ ...book, id: book.id + '-duplicate' }))
      ]

      indexManager.buildIndex(duplicateBooks)
      const beforeStats = indexManager.getIndexStats()

      indexManager.optimizeIndex()
      const afterStats = indexManager.getIndexStats()

      // 驗證優化後索引仍然正確
      expect(afterStats.totalBooks).toBe(beforeStats.totalBooks)
      expect(afterStats.titleIndexSize).toBeGreaterThan(0)
      expect(afterStats.authorIndexSize).toBeGreaterThan(0)
      expect(afterStats.tagIndexSize).toBeGreaterThan(0)
    })

    test('建構大量資料索引時應該記錄效能指標', () => {
      const mediumBookArray = new Array(1000).fill(null).map((_, index) => ({
        id: `book-${index}`,
        title: `測試書籍 ${index}`,
        author: `作者 ${index}`,
        tags: [`標籤${index}`]
      }))

      const startTime = Date.now()
      indexManager.buildIndex(mediumBookArray)
      const endTime = Date.now()

      const stats = indexManager.getIndexStats()
      expect(stats.buildDuration).toBeGreaterThan(0)
      expect(stats.buildDuration).toBeLessThan(endTime - startTime + 50) // 允許50ms誤差
      expect(stats.totalBooks).toBe(1000)
    })
  })

  describe('5. Error Handling & Edge Cases', () => {
    beforeEach(() => {
      const SearchIndexManager = require('src/ui/search/core/search-index-manager')
      indexManager = new SearchIndexManager({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('應該正確處理 null 或 undefined 書籍陣列', () => {
      expect(() => {
        indexManager.buildIndex(null)
      }).not.toThrow()

      expect(() => {
        indexManager.buildIndex(undefined)
      }).not.toThrow()

      const stats = indexManager.getIndexStats()
      expect(stats.totalBooks).toBe(0)
    })

    test('應該正確處理包含 null 書籍的陣列', () => {
      const booksWithNull = [
        mockBooks[0],
        null,
        undefined,
        mockBooks[1],
        null
      ]

      expect(() => {
        indexManager.buildIndex(booksWithNull)
      }).not.toThrow()

      const stats = indexManager.getIndexStats()
      expect(stats.totalBooks).toBe(2) // 只有兩本有效書籍
    })

    test('應該正確處理特殊字元和空字串', () => {
      const specialBooks = [
        {
          id: 'special-1',
          title: '  ', // 只有空白
          author: '', // 空字串
          tags: ['', '   ', 'valid-tag'] // 混合空白和有效標籤
        },
        {
          id: 'special-2',
          title: '特殊字元!@#$%^&*()',
          author: 'Author with 數字123',
          tags: ['標籤-with-dash', 'tag_with_underscore']
        }
      ]

      expect(() => {
        indexManager.buildIndex(specialBooks)
      }).not.toThrow()

      // 檢查特殊字元是否正確處理
      expect(indexManager.titleIndex.has('特殊字元!@#$%^&*()')).toBe(true)
      expect(indexManager.authorIndex.has('author with 數字123')).toBe(true)
      expect(indexManager.tagIndex.has('標籤-with-dash')).toBe(true)
      expect(indexManager.tagIndex.has('tag_with_underscore')).toBe(true)
      expect(indexManager.tagIndex.has('valid-tag')).toBe(true)

      // 空字串不應該被加入索引
      expect(indexManager.tagIndex.has('')).toBe(false)
    })

    test('應該正確處理非字串類型的資料', () => {
      const invalidBooks = [
        {
          id: 'invalid-1',
          title: 123, // 數字
          author: true, // 布林值
          tags: 'not-array' // 非陣列
        },
        {
          id: 'invalid-2',
          title: { nested: 'object' }, // 物件
          author: ['array', 'as', 'author'], // 陣列
          tags: null // null
        }
      ]

      expect(() => {
        indexManager.buildIndex(invalidBooks)
      }).not.toThrow()

      // 檢查錯誤記錄
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    test('索引操作過程中發生錯誤時應該正確處理', () => {
      // Mock Map 拋出錯誤
      const originalSet = Map.prototype.set
      Map.prototype.set = jest.fn().mockImplementation(() => {
        throw new StandardError('TEST_ERROR', '索引操作失敗', { category: 'testing' })
      })

      expect(() => {
        indexManager.buildIndex(mockBooks)
      }).toMatchObject({
        message: expect.stringContaining('索引操作失敗')
      })

      // 檢查錯誤是否被記錄
      expect(mockLogger.error).toHaveBeenCalled()

      // 復原 Map.prototype.set
      Map.prototype.set = originalSet
    })
  })

  describe('6. Integration & Event Handling', () => {
    beforeEach(() => {
      const SearchIndexManager = require('src/ui/search/core/search-index-manager')
      indexManager = new SearchIndexManager({
        eventBus: mockEventBus,
        logger: mockLogger
      })
    })

    test('索引建構完成時應該發送事件', () => {
      indexManager.buildIndex(mockBooks)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.INDEX.BUILT', expect.objectContaining({
        totalBooks: 3,
        titleIndexSize: expect.any(Number),
        authorIndexSize: expect.any(Number),
        tagIndexSize: expect.any(Number),
        buildDuration: expect.any(Number)
      }))
    })

    test('索引更新時應該發送對應事件', () => {
      const newBook = { id: 'new', title: 'New Book', author: 'New Author', tags: ['new'] }

      indexManager.addBookToIndex(newBook)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.INDEX.UPDATED', expect.objectContaining({
        action: 'add',
        bookId: 'new',
        totalBooks: 1
      }))
    })

    test('記憶體警告時應該發送警告事件', () => {
      const largeBookArray = new Array(50001).fill(null).map((_, index) => ({
        id: `book-${index}`,
        title: `Book ${index}`
      }))

      expect(() => {
        indexManager.buildIndex(largeBookArray)
      }).toThrow()

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.WARNING', expect.objectContaining({
        message: '記憶體不足，無法建構搜尋索引',
        error: '記憶體不足'
      }))
    })

    test('應該支援事件驅動的索引重建', () => {
      // 模擬接收到重建索引的事件
      const rebuildEventData = {
        books: [mockBooks[0]], // 只重建一本書
        force: true
      }

      indexManager.handleRebuildRequest(rebuildEventData)

      expect(indexManager.getIndexStats().totalBooks).toBe(1)
      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.INDEX.REBUILT', expect.any(Object))
    })
  })
})
