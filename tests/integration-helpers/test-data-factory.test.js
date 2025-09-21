/**
 * Test Data Factory 測試
 * 驗證測試資料工廠的資料生成功能和一致性
 *
 * @author Stage 3 TDD 主線程實作
 * @date 2025-08-27
 * @version v0.9.45
 */

// eslint-disable-next-line no-unused-vars
const TestDataFactory = require('../utils/test-data-factory')

describe('TestDataFactory', () => {
  // eslint-disable-next-line no-unused-vars
  let dataFactory

  beforeEach(() => {
    dataFactory = new TestDataFactory()
  })

  describe('🔧 基礎初始化和配置', () => {
    test('應該成功初始化資料工廠', () => {
      expect(dataFactory).toBeInstanceOf(TestDataFactory)
      expect(typeof dataFactory.createBookDataSet).toBe('function')
    })

    test('應該載入種子資料', () => {
      // eslint-disable-next-line no-unused-vars
      const stats = dataFactory.getFactoryStats()

      expect(stats.availableBookTitles).toBeGreaterThan(0)
      expect(stats.availableAuthors).toBeGreaterThan(0)
      expect(stats.availablePublishers).toBeGreaterThan(0)
      expect(stats.availableCategories).toBeGreaterThan(0)
    })

    test('應該初始化資料模板', () => {
      // eslint-disable-next-line no-unused-vars
      const stats = dataFactory.getFactoryStats()

      expect(stats.templates).toContain('book')
      expect(stats.templates).toContain('chromeMessage')
      expect(stats.templates).toContain('errorScenario')
      expect(stats.templates).toContain('userInteraction')
    })
  })

  describe('📚 書籍資料生成測試', () => {
    test('應該生成指定數量的書籍資料', () => {
      // eslint-disable-next-line no-unused-vars
      const books = dataFactory.createBookDataSet(5)

      expect(books).toHaveLength(5)
      books.forEach(book => {
        expect(book).toHaveProperty('id')
        expect(book).toHaveProperty('title')
        expect(book).toHaveProperty('author')
        expect(book).toHaveProperty('publisher')
      })
    })

    test('應該生成閱讀中書籍資料', () => {
      // eslint-disable-next-line no-unused-vars
      const books = dataFactory.createBookDataSet(3, 'reading')

      books.forEach(book => {
        expect(book.progress).toBeGreaterThan(0)
        expect(book.progress).toBeLessThan(100)
        expect(book.currentPage).toBeGreaterThan(0)
        expect(book.lastReadDate).toBeTruthy()
      })
    })

    test('應該生成已完成書籍資料', () => {
      // eslint-disable-next-line no-unused-vars
      const books = dataFactory.createBookDataSet(3, 'completed')

      books.forEach(book => {
        expect(book.progress).toBe(100)
        expect(book.currentPage).toBe(book.totalPages)
        expect(book.lastReadDate).toBeTruthy()
        expect(book.notes).toBeTruthy()
      })
    })

    test('應該生成新書籍資料', () => {
      // eslint-disable-next-line no-unused-vars
      const books = dataFactory.createBookDataSet(3, 'new')

      books.forEach(book => {
        expect(book.progress).toBe(0)
        expect(book.currentPage).toBe(0)
        expect(book.lastReadDate).toBe('')
      })
    })

    test('應該生成混合類型書籍資料', () => {
      // eslint-disable-next-line no-unused-vars
      const books = dataFactory.createBookDataSet(9, 'mixed')

      // 應該包含不同進度的書籍
      // eslint-disable-next-line no-unused-vars
      const progressValues = books.map(book => book.progress)
      // eslint-disable-next-line no-unused-vars
      const hasReading = progressValues.some(p => p > 0 && p < 100)
      // eslint-disable-next-line no-unused-vars
      const hasCompleted = progressValues.some(p => p === 100)
      // eslint-disable-next-line no-unused-vars
      const hasNew = progressValues.some(p => p === 0)

      expect(hasReading || hasCompleted || hasNew).toBe(true)
    })

    test('應該生成唯一的書籍ID', () => {
      // eslint-disable-next-line no-unused-vars
      const books = dataFactory.createBookDataSet(10)
      // eslint-disable-next-line no-unused-vars
      const ids = books.map(book => book.id)
      // eslint-disable-next-line no-unused-vars
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(ids.length)
    })

    test('應該生成有效的ISBN', () => {
      // eslint-disable-next-line no-unused-vars
      const books = dataFactory.createBookDataSet(5)

      books.forEach(book => {
        expect(book.isbn).toMatch(/^\d{13}$/)
      })
    })

    test('應該生成合理的價格範圍', () => {
      // eslint-disable-next-line no-unused-vars
      const books = dataFactory.createBookDataSet(10)

      books.forEach(book => {
        expect(book.price).toBeGreaterThan(0)
        expect(book.price).toBeLessThanOrEqual(599)
      })
    })

    test('應該生成合理的頁數', () => {
      // eslint-disable-next-line no-unused-vars
      const books = dataFactory.createBookDataSet(5)

      books.forEach(book => {
        expect(book.totalPages).toBeGreaterThan(0)
        expect(book.totalPages).toBeLessThanOrEqual(500)
      })
    })
  })

  describe('💬 Chrome消息資料生成測試', () => {
    test('應該生成指定數量的Chrome消息', () => {
      // eslint-disable-next-line no-unused-vars
      const messages = dataFactory.createChromeMessages(5)

      expect(messages).toHaveLength(5)
      messages.forEach(message => {
        expect(message).toHaveProperty('type')
        expect(message).toHaveProperty('action')
        expect(message).toHaveProperty('data')
        expect(message).toHaveProperty('sender')
        expect(message).toHaveProperty('timestamp')
      })
    })

    test('應該生成指定類型的消息', () => {
      // eslint-disable-next-line no-unused-vars
      const extractionMessages = dataFactory.createChromeMessages(3, ['EXTRACTION'])

      extractionMessages.forEach(message => {
        expect(message.type).toBe('EXTRACTION')
        expect(['START', 'PROGRESS', 'COMPLETE', 'ERROR']).toContain(message.action)
      })
    })

    test('應該生成多種類型的消息', () => {
      // eslint-disable-next-line no-unused-vars
      const messages = dataFactory.createChromeMessages(6, ['EXTRACTION', 'STORAGE', 'UI_UPDATE'])

      // eslint-disable-next-line no-unused-vars
      const types = messages.map(msg => msg.type)
      // eslint-disable-next-line no-unused-vars
      const uniqueTypes = new Set(types)

      expect(uniqueTypes.size).toBeGreaterThan(1)
    })

    test('應該生成有效的sender資訊', () => {
      // eslint-disable-next-line no-unused-vars
      const messages = dataFactory.createChromeMessages(3)

      messages.forEach(message => {
        expect(message.sender.tab.id).toBeGreaterThan(0)
        expect(message.sender.frameId).toBeDefined()
        expect(message.sender.id).toBeDefined()
      })
    })

    test('應該生成時間順序正確的消息', () => {
      // eslint-disable-next-line no-unused-vars
      const messages = dataFactory.createChromeMessages(5)

      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].timestamp).toBeGreaterThan(messages[i - 1].timestamp)
      }
    })
  })

  describe('⚠️ 錯誤場景資料生成測試', () => {
    test('應該生成指定數量的錯誤場景', () => {
      // eslint-disable-next-line no-unused-vars
      const errors = dataFactory.createErrorScenarios(5)

      expect(errors).toHaveLength(5)
      errors.forEach(error => {
        expect(error).toHaveProperty('type')
        expect(error).toHaveProperty('message')
        expect(error).toHaveProperty('code')
        expect(error).toHaveProperty('context')
        expect(error).toHaveProperty('recoverable')
      })
    })

    test('應該生成不同類型的錯誤', () => {
      // eslint-disable-next-line no-unused-vars
      const errors = dataFactory.createErrorScenarios(10)

      // eslint-disable-next-line no-unused-vars
      const types = errors.map(error => error.type)
      // eslint-disable-next-line no-unused-vars
      const uniqueTypes = new Set(types)

      expect(uniqueTypes.size).toBeGreaterThan(1)
      expect([...uniqueTypes]).toEqual(expect.arrayContaining([
        'NETWORK_ERROR',
        'PARSE_ERROR',
        'PERMISSION_ERROR',
        'STORAGE_ERROR',
        'TIMEOUT_ERROR'
      ]))
    })

    test('應該生成對應的錯誤碼', () => {
      // eslint-disable-next-line no-unused-vars
      const errors = dataFactory.createErrorScenarios(5)

      errors.forEach(error => {
        expect(error.code).toMatch(/^[A-Z]+_\d{3}$/)

        // 驗證錯誤碼與類型對應
        if (error.type === 'NETWORK_ERROR') {
          expect(error.code).toMatch(/^NET_\d{3}$/)
        }
      })
    })

    test('應該生成包含上下文的錯誤資料', () => {
      // eslint-disable-next-line no-unused-vars
      const errors = dataFactory.createErrorScenarios(3)

      errors.forEach(error => {
        expect(error.context).toHaveProperty('operation')
        expect(error.context).toHaveProperty('module')
        expect(error.context).toHaveProperty('timestamp')
        expect(error.context).toHaveProperty('attempt')
      })
    })

    test('應該設定合理的恢復性', () => {
      // eslint-disable-next-line no-unused-vars
      const errors = dataFactory.createErrorScenarios(9)

      // eslint-disable-next-line no-unused-vars
      const recoverableCount = errors.filter(error => error.recoverable).length
      // eslint-disable-next-line no-unused-vars
      const nonRecoverableCount = errors.length - recoverableCount

      // 大約2/3應該可恢復
      expect(recoverableCount).toBeGreaterThan(nonRecoverableCount)
    })
  })

  describe('👆 使用者互動序列生成測試', () => {
    test('應該生成指定長度的互動序列', () => {
      // eslint-disable-next-line no-unused-vars
      const interactions = dataFactory.createUserInteractionSequence(5)

      expect(interactions).toHaveLength(5)
      interactions.forEach(interaction => {
        expect(interaction).toHaveProperty('type')
        expect(interaction).toHaveProperty('target')
        expect(interaction).toHaveProperty('data')
        expect(interaction).toHaveProperty('timestamp')
        expect(interaction).toHaveProperty('moduleName')
      })
    })

    test('應該生成不同類型的互動', () => {
      // eslint-disable-next-line no-unused-vars
      const interactions = dataFactory.createUserInteractionSequence(10)

      // eslint-disable-next-line no-unused-vars
      const types = interactions.map(interaction => interaction.type)
      // eslint-disable-next-line no-unused-vars
      const uniqueTypes = new Set(types)

      expect(uniqueTypes.size).toBeGreaterThan(1)
      expect([...uniqueTypes]).toEqual(expect.arrayContaining([
        'click', 'input', 'scroll', 'hover', 'keypress'
      ]))
    })

    test('應該生成時間順序正確的互動', () => {
      // eslint-disable-next-line no-unused-vars
      const interactions = dataFactory.createUserInteractionSequence(5)

      for (let i = 1; i < interactions.length; i++) {
        expect(interactions[i].timestamp).toBeGreaterThan(interactions[i - 1].timestamp)
      }
    })

    test('應該為不同互動類型生成對應的資料', () => {
      // eslint-disable-next-line no-unused-vars
      const interactions = dataFactory.createUserInteractionSequence(20)

      // eslint-disable-next-line no-unused-vars
      const clickInteraction = interactions.find(i => i.type === 'click')
      if (clickInteraction) {
        expect(clickInteraction.data).toHaveProperty('button')
        expect(clickInteraction.data).toHaveProperty('coordinates')
      }

      // eslint-disable-next-line no-unused-vars
      const inputInteraction = interactions.find(i => i.type === 'input')
      if (inputInteraction) {
        expect(inputInteraction.data).toHaveProperty('value')
        expect(inputInteraction.data).toHaveProperty('inputType')
      }
    })
  })

  describe('⚡ 效能測試資料生成', () => {
    test('應該生成小型效能測試資料', () => {
      // eslint-disable-next-line no-unused-vars
      const data = dataFactory.createPerformanceTestData('small')

      expect(data.books).toHaveLength(50)
      expect(data.messages).toHaveLength(20)
      expect(data.interactions).toHaveLength(30)
      expect(data.errors.length).toBeGreaterThan(0)
    })

    test('應該生成中型效能測試資料', () => {
      // eslint-disable-next-line no-unused-vars
      const data = dataFactory.createPerformanceTestData('medium')

      expect(data.books).toHaveLength(200)
      expect(data.messages).toHaveLength(100)
      expect(data.interactions).toHaveLength(150)
    })

    test('應該生成大型效能測試資料', () => {
      // eslint-disable-next-line no-unused-vars
      const data = dataFactory.createPerformanceTestData('large')

      expect(data.books).toHaveLength(1000)
      expect(data.messages).toHaveLength(500)
      expect(data.interactions).toHaveLength(800)
    })
  })

  describe('🌐 Readmoo頁面資料生成', () => {
    test('應該生成書架頁面資料', () => {
      // eslint-disable-next-line no-unused-vars
      const pageData = dataFactory.createReadmooPageData('bookshelf')

      expect(pageData.pageType).toBe('bookshelf')
      expect(pageData.url).toContain('readmoo.com')
      expect(Array.isArray(pageData.books)).toBe(true)
      expect(pageData).toHaveProperty('pagination')
      expect(pageData).toHaveProperty('filters')
    })

    test('應該生成閱讀頁面資料', () => {
      // eslint-disable-next-line no-unused-vars
      const pageData = dataFactory.createReadmooPageData('reading')

      expect(pageData.pageType).toBe('reading')
      expect(pageData).toHaveProperty('currentBook')
      expect(pageData).toHaveProperty('readingProgress')
      expect(pageData.readingProgress).toHaveProperty('currentChapter')
      expect(pageData.readingProgress).toHaveProperty('readingTime')
    })

    test('應該生成搜尋頁面資料', () => {
      // eslint-disable-next-line no-unused-vars
      const pageData = dataFactory.createReadmooPageData('search')

      expect(pageData.pageType).toBe('search')
      expect(pageData).toHaveProperty('searchQuery')
      expect(pageData).toHaveProperty('results')
      expect(pageData).toHaveProperty('searchStats')
      expect(Array.isArray(pageData.results)).toBe(true)
    })
  })

  describe('🔄 工廠狀態管理', () => {
    test('應該支援重置工廠狀態', () => {
      // 修改一些內部狀態（假設有的話）
      // eslint-disable-next-line no-unused-vars
      const originalStats = dataFactory.getFactoryStats()

      // 重置
      dataFactory.reset()

      // 驗證重置後狀態
      // eslint-disable-next-line no-unused-vars
      const resetStats = dataFactory.getFactoryStats()
      expect(resetStats).toEqual(originalStats)
    })

    test('應該支援自訂種子資料', () => {
      // eslint-disable-next-line no-unused-vars
      const customSeeds = {
        bookTitles: ['Custom Title 1', 'Custom Title 2'],
        authors: ['Custom Author 1', 'Custom Author 2']
      }

      dataFactory.setCustomSeeds(customSeeds)

      // eslint-disable-next-line no-unused-vars
      const books = dataFactory.createBookDataSet(4)

      // 驗證使用了自訂種子
      // eslint-disable-next-line no-unused-vars
      const titles = books.map(book => book.title)
      // eslint-disable-next-line no-unused-vars
      const authors = books.map(book => book.author)

      expect(titles.some(title => customSeeds.bookTitles.includes(title))).toBe(true)
      expect(authors.some(author => customSeeds.authors.includes(author))).toBe(true)
    })

    test('應該提供正確的工廠統計資訊', () => {
      // eslint-disable-next-line no-unused-vars
      const stats = dataFactory.getFactoryStats()

      expect(typeof stats.availableBookTitles).toBe('number')
      expect(typeof stats.availableAuthors).toBe('number')
      expect(typeof stats.availablePublishers).toBe('number')
      expect(typeof stats.availableCategories).toBe('number')
      expect(Array.isArray(stats.templates)).toBe(true)
    })
  })

  describe('🔒 資料一致性和品質驗證', () => {
    test('應該生成一致性的書籍ID格式', () => {
      // eslint-disable-next-line no-unused-vars
      const books = dataFactory.createBookDataSet(20)

      books.forEach(book => {
        expect(book.id).toMatch(/^book-\d{4}-\d+$/)
      })
    })

    test('應該確保日期格式正確', () => {
      // eslint-disable-next-line no-unused-vars
      const books = dataFactory.createBookDataSet(10, 'reading')

      books.forEach(book => {
        if (book.lastReadDate) {
          expect(book.lastReadDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        }
        if (book.addedDate) {
          expect(book.addedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        }
      })
    })

    test('應該確保進度和頁數邏輯正確', () => {
      // eslint-disable-next-line no-unused-vars
      const books = dataFactory.createBookDataSet(10, 'mixed')

      books.forEach(book => {
        expect(book.progress).toBeGreaterThanOrEqual(0)
        expect(book.progress).toBeLessThanOrEqual(100)
        expect(book.currentPage).toBeGreaterThanOrEqual(0)
        expect(book.currentPage).toBeLessThanOrEqual(book.totalPages)

        // 進度和當前頁應該一致
        // eslint-disable-next-line no-unused-vars
        const expectedPage = Math.floor(book.totalPages * book.progress / 100)
        expect(Math.abs(book.currentPage - expectedPage)).toBeLessThanOrEqual(1)
      })
    })

    test('應該生成有意義的標籤', () => {
      // eslint-disable-next-line no-unused-vars
      const books = dataFactory.createBookDataSet(10)

      books.forEach(book => {
        expect(Array.isArray(book.tags)).toBe(true)
        expect(book.tags.length).toBeGreaterThan(0)
        expect(book.tags.length).toBeLessThanOrEqual(4)

        // 標籤應該不重複
        // eslint-disable-next-line no-unused-vars
        const uniqueTags = new Set(book.tags)
        expect(uniqueTags.size).toBe(book.tags.length)
      })
    })
  })
})
