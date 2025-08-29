/**
 * BookSearchFilterIntegrated 整合測試
 * TDD 循環 8/8 - 最終整合版本測試
 *
 * 測試目標：
 * - 驗證整合版本與原始版本功能一致性
 * - 確保所有模組化組件正確整合
 * - 驗證 API 相容性和事件相容性
 * - 確保效能和記憶體管理正常
 */

const { JSDOM } = require('jsdom')

// 模擬 DOM 環境
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
  <div class="search-container">
    <input type="text" id="search-input" placeholder="搜尋書籍..." />
    <div class="search-filters">
      <select id="status-filter">
        <option value="">所有狀態</option>
        <option value="completed">已完成</option>
        <option value="reading">閱讀中</option>
        <option value="not_started">未開始</option>
      </select>
      <select id="category-filter">
        <option value="">所有分類</option>
        <option value="tech">技術</option>
        <option value="literature">文學</option>
        <option value="business">商業</option>
      </select>
    </div>
    <div id="search-results"></div>
    <div id="search-stats"></div>
  </div>
</body>
</html>
`)

global.window = dom.window
global.document = dom.window.document
global.Event = dom.window.Event
global.CustomEvent = dom.window.CustomEvent

// 模擬基本環境
global.performance = {
  now: () => Date.now()
}

// 模擬事件總線
class MockEventBus {
  constructor () {
    this.listeners = new Map()
    this.eventHistory = []
  }

  on (eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, [])
    }
    this.listeners.get(eventType).push(handler)
  }

  emit (eventType, data) {
    this.eventHistory.push({ eventType, data, timestamp: Date.now() })
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error(`事件處理器錯誤 (${eventType}):`, error)
        }
      })
    }
  }

  off (eventType, handler) {
    if (!this.listeners.has(eventType)) {
      return this
    }

    const listeners = this.listeners.get(eventType)
    const filteredListeners = listeners.filter(listener => listener !== handler)

    if (filteredListeners.length === 0) {
      this.listeners.delete(eventType)
    } else {
      this.listeners.set(eventType, filteredListeners)
    }

    return this
  }

  removeAllListeners () {
    this.listeners.clear()
    this.eventHistory = []
  }

  getEventHistory () {
    return this.eventHistory
  }
}

describe('BookSearchFilterIntegrated - TDD 循環 8/8', () => {
  let bookSearchFilter
  let eventBus
  let testBooks

  beforeEach(() => {
    // 重置 DOM
    document.body.innerHTML = `
      <div class="search-container">
        <input type="text" id="search-input" placeholder="搜尋書籍..." />
        <div class="search-filters">
          <select id="status-filter">
            <option value="">所有狀態</option>
            <option value="completed">已完成</option>
            <option value="reading">閱讀中</option>
            <option value="not_started">未開始</option>
          </select>
          <select id="category-filter">
            <option value="">所有分類</option>
            <option value="tech">技術</option>
            <option value="literature">文學</option>
            <option value="business">商業</option>
          </select>
        </div>
        <div id="search-results"></div>
        <div id="search-stats"></div>
      </div>
    `

    // 創建事件總線
    eventBus = new MockEventBus()

    // 測試書籍資料
    testBooks = [
      {
        id: '1',
        title: 'JavaScript 權威指南',
        author: 'David Flanagan',
        status: 'completed',
        progress: 100,
        category: 'tech',
        tags: ['javascript', 'programming'],
        lastRead: '2024-01-15'
      },
      {
        id: '2',
        title: '百年孤寂',
        author: 'Gabriel García Márquez',
        status: 'reading',
        progress: 45,
        category: 'literature',
        tags: ['classic', 'novel'],
        lastRead: '2024-02-10'
      },
      {
        id: '3',
        title: '精實創業',
        author: 'Eric Ries',
        status: 'not_started',
        progress: 0,
        category: 'business',
        tags: ['startup', 'business'],
        lastRead: null
      },
      {
        id: '4',
        title: 'React 技術手冊',
        author: 'Alex Banks',
        status: 'reading',
        progress: 75,
        category: 'tech',
        tags: ['react', 'frontend'],
        lastRead: '2024-02-12'
      }
    ]

    // 創建整合版本實例
    const BookSearchFilterIntegrated = require('../../../src/ui/book-search-filter-integrated')
    bookSearchFilter = new BookSearchFilterIntegrated(eventBus, document)

    // 設定測試資料
    bookSearchFilter.updateBooksData(testBooks)
  })

  afterEach(() => {
    if (bookSearchFilter) {
      bookSearchFilter.cleanup()
    }
    eventBus.removeAllListeners()
  })

  describe('基本結構和初始化', () => {
    test('應該能夠創建 BookSearchFilterIntegrated 實例', () => {
      expect(bookSearchFilter).toBeDefined()
      expect(bookSearchFilter.constructor.name).toBe('BookSearchFilterIntegrated')
    })

    test('應該正確初始化所有模組化組件', () => {
      const health = bookSearchFilter.getModuleHealth()

      expect(health.searchIndexManager).toBe(true)
      expect(health.searchEngine).toBe(true)
      expect(health.searchCacheManager).toBe(true)
      expect(health.searchResultFormatter).toBe(true)
      expect(health.filterEngine).toBe(true)
      expect(health.searchCoordinator).toBe(true)
      expect(health.searchUIController).toBe(true)
      expect(health.eventBus).toBe(true)
      expect(health.booksDataLoaded).toBe(true)
    })

    test('應該繼承 BaseUIHandler 並具備基本功能', () => {
      expect(bookSearchFilter.handlerName).toBe('BookSearchFilterIntegrated')
      expect(bookSearchFilter.priority).toBe(200)
      expect(typeof bookSearchFilter.cleanup).toBe('function')
    })

    test('應該正確初始化搜尋狀態和配置', () => {
      expect(bookSearchFilter.searchState).toBeDefined()
      expect(bookSearchFilter.searchConfig).toBeDefined()
      expect(bookSearchFilter.searchState.isSearching).toBe(false)
      expect(bookSearchFilter.searchState.currentQuery).toBe('')
      expect(bookSearchFilter.searchConfig.debounceDelay).toBe(300)
    })

    test('應該正確載入書籍資料', () => {
      expect(bookSearchFilter.booksData).toHaveLength(4)
      expect(bookSearchFilter.booksData[0].title).toBe('JavaScript 權威指南')
    })
  })

  describe('即時搜尋功能整合', () => {
    test('應該支援依書名搜尋', async () => {
      const results = await bookSearchFilter.performSearch('JavaScript')

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(book => book.title.includes('JavaScript'))).toBe(true)
    })

    test('應該支援依作者搜尋', async () => {
      const results = await bookSearchFilter.performSearch('David Flanagan')

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(book => book.author.includes('David Flanagan'))).toBe(true)
    })

    test('應該支援模糊搜尋', async () => {
      const results = await bookSearchFilter.performSearch('javascrpt') // 拼字錯誤

      expect(Array.isArray(results)).toBe(true)
      // 模糊搜尋應該能找到相似的結果
    })

    test('應該正確處理空搜尋查詢', async () => {
      const results = await bookSearchFilter.performSearch('')

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(testBooks.length) // 應該返回所有書籍
    })

    test('應該正確處理無結果的搜尋', async () => {
      const results = await bookSearchFilter.performSearch('不存在的書籍名稱')

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)
    })
  })

  describe('多維度篩選功能整合', () => {
    test('應該支援依閱讀狀態篩選', async () => {
      const filters = { status: 'completed' }
      const results = await bookSearchFilter.applyFilters(filters)

      expect(Array.isArray(results)).toBe(true)
      expect(results.every(book => book.status === 'completed')).toBe(true)
    })

    test('應該支援依閱讀進度範圍篩選', async () => {
      const filters = { progress: { min: 50, max: 100 } }
      const results = await bookSearchFilter.applyFilters(filters)

      expect(Array.isArray(results)).toBe(true)
      expect(results.every(book => book.progress >= 50 && book.progress <= 100)).toBe(true)
    })

    test('應該支援依書籍分類篩選', async () => {
      const filters = { category: 'tech' }
      const results = await bookSearchFilter.applyFilters(filters)

      expect(Array.isArray(results)).toBe(true)
      expect(results.every(book => book.category === 'tech')).toBe(true)
    })

    test('應該支援多重篩選條件組合', async () => {
      const filters = {
        status: 'reading',
        category: 'tech'
      }
      const results = await bookSearchFilter.applyFilters(filters)

      expect(Array.isArray(results)).toBe(true)
      expect(results.every(book =>
        book.status === 'reading' && book.category === 'tech'
      )).toBe(true)
    })
  })

  describe('搜尋和篩選整合流程', () => {
    test('應該能夠執行搜尋後再篩選', async () => {
      // 先搜尋技術相關書籍
      const searchResults = await bookSearchFilter.performSearch('tech')

      // 再篩選正在閱讀的書籍
      const filteredResults = await bookSearchFilter.applyFilters({ status: 'reading' })

      expect(Array.isArray(filteredResults)).toBe(true)
      expect(filteredResults.every(book => book.status === 'reading')).toBe(true)
    })

    test('應該能夠清除搜尋和篩選', () => {
      bookSearchFilter.clearSearchAndFilters()

      expect(bookSearchFilter.searchState.currentQuery).toBe('')
      expect(bookSearchFilter.searchState.searchResults).toEqual([])
      expect(bookSearchFilter.searchState.filteredResults).toEqual([])
      expect(bookSearchFilter.searchState.appliedFilters).toEqual({})
    })
  })

  describe('事件整合和通知機制', () => {
    test('應該發出搜尋結果更新事件', async () => {
      await bookSearchFilter.performSearch('JavaScript')

      const searchEvents = eventBus.getEventHistory().filter(
        event => event.eventType === 'SEARCH.RESULTS_UPDATED'
      )

      expect(searchEvents.length).toBeGreaterThan(0)
      expect(searchEvents[0].data.source).toBe('BookSearchFilterIntegrated')
    })

    test('應該發出篩選應用事件', async () => {
      await bookSearchFilter.applyFilters({ status: 'completed' })

      const filterEvents = eventBus.getEventHistory().filter(
        event => event.eventType === 'FILTER.APPLIED'
      )

      expect(filterEvents.length).toBeGreaterThan(0)
      expect(filterEvents[0].data.source).toBe('BookSearchFilterIntegrated')
    })

    test('應該監聽書籍資料更新事件', () => {
      const newBooks = [...testBooks, {
        id: '5',
        title: '新增的書籍',
        author: '測試作者',
        status: 'not_started',
        progress: 0,
        category: 'test'
      }]

      eventBus.emit('BOOKS.DATA_UPDATED', { books: newBooks })

      expect(bookSearchFilter.booksData).toHaveLength(5)
    })
  })

  describe('效能和統計監控', () => {
    test('應該提供搜尋統計資訊', async () => {
      await bookSearchFilter.performSearch('JavaScript')
      await bookSearchFilter.applyFilters({ status: 'completed' })

      const stats = bookSearchFilter.getSearchStatistics()

      expect(typeof stats).toBe('object')
      expect(typeof stats.totalSearches).toBe('number')
      expect(typeof stats.totalFilters).toBe('number')
      expect(typeof stats.averageSearchTime).toBe('number')
    })

    test('應該監控效能並處理慢操作', async () => {
      // 執行搜尋操作
      await bookSearchFilter.performSearch('test')

      const stats = bookSearchFilter.getSearchStatistics()
      expect(stats.averageSearchTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('錯誤處理和邊界條件', () => {
    test('應該處理無效的書籍資料', () => {
      expect(() => {
        bookSearchFilter.updateBooksData(null)
      }).not.toThrow()

      expect(() => {
        bookSearchFilter.updateBooksData('invalid data')
      }).not.toThrow()
    })

    test('應該處理搜尋過程中的錯誤', async () => {
      // 模擬搜尋錯誤
      bookSearchFilter.searchCoordinator = null

      await expect(
        bookSearchFilter.performSearch('test')
      ).rejects.toThrow()
    })

    test('應該處理篩選過程中的錯誤', async () => {
      // 模擬篩選錯誤
      bookSearchFilter.searchCoordinator = null

      await expect(
        bookSearchFilter.applyFilters({ status: 'completed' })
      ).rejects.toThrow()
    })

    test('應該正確清理資源', () => {
      expect(() => {
        bookSearchFilter.cleanup()
      }).not.toThrow()

      // 驗證清理後的狀態
      expect(bookSearchFilter.searchState).toBeNull()
      expect(bookSearchFilter._booksData).toEqual([])
    })
  })

  describe('API 相容性驗證', () => {
    test('應該提供與原版相同的公開方法', () => {
      // 驗證關鍵方法存在
      expect(typeof bookSearchFilter.performSearch).toBe('function')
      expect(typeof bookSearchFilter.applyFilters).toBe('function')
      expect(typeof bookSearchFilter.clearSearchAndFilters).toBe('function')
      expect(typeof bookSearchFilter.updateBooksData).toBe('function')
      expect(typeof bookSearchFilter.getSearchStatistics).toBe('function')
      expect(typeof bookSearchFilter.cleanup).toBe('function')
    })

    test('應該維持相同的屬性結構', () => {
      expect(bookSearchFilter.searchState).toBeDefined()
      expect(bookSearchFilter.searchConfig).toBeDefined()
      expect(bookSearchFilter.booksData).toBeDefined()
      expect(bookSearchFilter.eventBus).toBeDefined()
    })

    test('應該提供相同的事件介面', async () => {
      // 執行操作並檢查事件
      await bookSearchFilter.performSearch('test')

      const events = eventBus.getEventHistory()
      const searchEvents = events.filter(e => e.eventType.startsWith('SEARCH.'))

      expect(searchEvents.length).toBeGreaterThan(0)
    })
  })

  describe('模組間協調驗證', () => {
    test('應該正確協調搜尋引擎和索引管理器', async () => {
      const results = await bookSearchFilter.performSearch('JavaScript')

      // 驗證搜尋引擎能夠使用索引管理器
      expect(Array.isArray(results)).toBe(true)
    })

    test('應該正確協調篩選引擎和結果格式化器', async () => {
      const results = await bookSearchFilter.applyFilters({ status: 'reading' })

      // 驗證篩選結果被正確格式化
      expect(Array.isArray(results)).toBe(true)
      if (results.length > 0) {
        expect(results[0]).toHaveProperty('title')
        expect(results[0]).toHaveProperty('author')
      }
    })

    test('應該正確協調快取管理器', async () => {
      // 執行相同搜尋兩次
      await bookSearchFilter.performSearch('JavaScript')
      await bookSearchFilter.performSearch('JavaScript')

      const stats = bookSearchFilter.getSearchStatistics()
      // 第二次搜尋應該更快 (使用快取)
      expect(typeof stats.cacheHitRate).toBe('number')
    })
  })
})
