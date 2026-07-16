describe('BooksComTwAdapter', () => {
  let BooksComTwAdapter
  let adapter

  beforeEach(() => {
    jest.resetModules()

    try {
      BooksComTwAdapter = require('src/content/adapters/books-com-tw-adapter')
    } catch (error) {
      BooksComTwAdapter = null
    }
  })

  afterEach(() => {
    adapter = null
    jest.clearAllMocks()
  })

  describe('模組載入', () => {
    test('應該能成功載入模組', () => {
      expect(BooksComTwAdapter).toBeDefined()
    })

    test('應該能建立 adapter 實例', () => {
      const createAdapter = BooksComTwAdapter
      adapter = createAdapter()
      expect(adapter).toBeDefined()
    })
  })

  describe('平台識別方法', () => {
    beforeEach(() => {
      adapter = BooksComTwAdapter()
    })

    test('getPlatformName 回傳 books-com-tw', () => {
      expect(adapter.getPlatformName()).toBe('books-com-tw')
    })

    test('getLibraryUrl 回傳博客來書庫頁 URL', () => {
      const url = adapter.getLibraryUrl()
      expect(url).toBe('https://viewer-ebook.books.com.tw/viewer/index.html?readlist=all')
    })

    test('requiresLogin 回傳 true', () => {
      expect(adapter.requiresLogin()).toBe(true)
    })

    test('getLoginCheckSelector 回傳非空字串', () => {
      const selector = adapter.getLoginCheckSelector()
      expect(typeof selector).toBe('string')
      expect(selector.length).toBeGreaterThan(0)
    })
  })

  describe('isValidDomain', () => {
    beforeEach(() => {
      adapter = BooksComTwAdapter()
    })

    test('viewer-ebook.books.com.tw 為有效域名', () => {
      expect(adapter.isValidDomain('https://viewer-ebook.books.com.tw/viewer/index.html')).toBe(true)
    })

    test('www.books.com.tw 為有效域名', () => {
      expect(adapter.isValidDomain('https://www.books.com.tw/')).toBe(true)
    })

    test('readmoo.com 為無效域名', () => {
      expect(adapter.isValidDomain('https://readmoo.com/')).toBe(false)
    })

    test('evilbooks.com.tw 為無效域名', () => {
      expect(adapter.isValidDomain('https://evilbooks.com.tw/')).toBe(false)
    })

    test('空字串回傳 false', () => {
      expect(adapter.isValidDomain('')).toBe(false)
    })

    test('無效 URL 回傳 false', () => {
      expect(adapter.isValidDomain('not-a-url')).toBe(false)
    })
  })

  describe('getPageType', () => {
    beforeEach(() => {
      adapter = BooksComTwAdapter()
    })

    test('書庫頁（readlist=all）回傳 library', async () => {
      const pageType = await adapter.getPageType('https://viewer-ebook.books.com.tw/viewer/index.html?readlist=all')
      expect(pageType).toBe('library')
    })

    test('非書庫頁回傳 unknown', async () => {
      const pageType = await adapter.getPageType('https://viewer-ebook.books.com.tw/viewer/index.html')
      expect(pageType).toBe('unknown')
    })
  })

  describe('isExtractablePage', () => {
    beforeEach(() => {
      adapter = BooksComTwAdapter()
    })

    test('書庫頁為可提取頁面', async () => {
      const result = await adapter.isExtractablePage('https://viewer-ebook.books.com.tw/viewer/index.html?readlist=all')
      expect(result).toBe(true)
    })

    test('非書庫頁不可提取', async () => {
      const result = await adapter.isExtractablePage('https://viewer-ebook.books.com.tw/viewer/index.html')
      expect(result).toBe(false)
    })
  })

  describe('parseBookElement', () => {
    beforeEach(() => {
      adapter = BooksComTwAdapter()
    })

    function createMockBookElement () {
      const el = document.createElement('div')
      el.classList.add('bookshelf__book')

      const titleEl = document.createElement('div')
      titleEl.classList.add('book__description__title')
      titleEl.textContent = '蜜蜂與遠雷'
      el.appendChild(titleEl)

      const authorEl = document.createElement('div')
      authorEl.classList.add('book__description__author')
      authorEl.textContent = '作者：恩田陸'
      el.appendChild(authorEl)

      const coverContainer = document.createElement('div')
      coverContainer.classList.add('book__cover')
      const coverImg = document.createElement('img')
      coverImg.src = 'https://s3public-ebook.books.com.tw/cover/G000034891.jpg'
      coverContainer.appendChild(coverImg)
      el.appendChild(coverContainer)

      const progressContainer = document.createElement('div')
      progressContainer.classList.add('book__progress')
      const progressBar = document.createElement('div')
      progressBar.style.width = '67%'
      progressContainer.appendChild(progressBar)
      el.appendChild(progressContainer)

      return el
    }

    test('正確提取書名', () => {
      const el = createMockBookElement()
      const result = adapter.parseBookElement(el)
      expect(result.title).toBe('蜜蜂與遠雷')
    })

    test('正確提取作者（去除前綴）', () => {
      const el = createMockBookElement()
      const result = adapter.parseBookElement(el)
      expect(result.author).toBe('恩田陸')
    })

    test('正確提取封面 URL', () => {
      const el = createMockBookElement()
      const result = adapter.parseBookElement(el)
      expect(result.coverUrl).toContain('books.com.tw')
    })

    test('正確提取閱讀進度', () => {
      const el = createMockBookElement()
      const result = adapter.parseBookElement(el)
      expect(result.readProgress).toBe(67)
    })

    test('元素缺少書名時回傳空字串', () => {
      const el = document.createElement('div')
      el.classList.add('bookshelf__book')
      const result = adapter.parseBookElement(el)
      expect(result.title).toBe('')
    })

    test('回傳物件含 source 欄位為 books-com-tw', () => {
      const el = createMockBookElement()
      const result = adapter.parseBookElement(el)
      expect(result.source).toBe('books-com-tw')
    })

    test('從封面 URL 提取 bookId', () => {
      const el = createMockBookElement()
      const result = adapter.parseBookElement(el)
      expect(result.bookId).toBe('G000034891')
    })

    test('元素缺少封面時 bookId 回傳空字串', () => {
      const el = document.createElement('div')
      el.classList.add('bookshelf__book')
      const result = adapter.parseBookElement(el)
      expect(result.bookId).toBe('')
    })
  })

  describe('sanitizeData', () => {
    beforeEach(() => {
      adapter = BooksComTwAdapter()
    })

    test('過濾 javascript: URL', () => {
      const data = { coverUrl: 'javascript:alert(1)', title: 'test' }
      const result = adapter.sanitizeData(data)
      expect(result.coverUrl).toBe('')
    })

    test('過濾 data: URL', () => {
      const data = { coverUrl: 'data:text/html,<script>alert(1)</script>', title: 'test' }
      const result = adapter.sanitizeData(data)
      expect(result.coverUrl).toBe('')
    })

    test('保留合法 https URL', () => {
      const data = { coverUrl: 'https://s3public-ebook.books.com.tw/cover/test.jpg', title: 'test' }
      const result = adapter.sanitizeData(data)
      expect(result.coverUrl).toBe('https://s3public-ebook.books.com.tw/cover/test.jpg')
    })

    test('移除 HTML 標籤', () => {
      const data = { title: '<script>alert(1)</script>正常書名', coverUrl: '' }
      const result = adapter.sanitizeData(data)
      expect(result.title).not.toContain('<script>')
      expect(result.title).toContain('正常書名')
    })
  })

  describe('extractAllBooks - ReadList API 路徑', () => {
    beforeEach(() => {
      adapter = BooksComTwAdapter()
    })

    afterEach(() => {
      delete global.fetch
    })

    function buildApiRecord (overrides = {}) {
      return {
        book_uni_id: 'G000034891_reflowable_normal',
        item_type: 'book',
        item_info: {
          item: 'G000034891',
          c_title: '蜜蜂與遠雷',
          author: '恩田陸',
          publisher_name: '博客來網路書店',
          publish_date: '2018/04/17',
          efile_cover_url: 'https://s3public-ebook.books.com.tw/cover/G000034891.jpg',
          percent: 67,
          last_read_time: '2025-01-24T16:48:40+08:00',
          auth_time: '2018-05-11T17:40:09+08:00',
          book_format: 'reflowable',
          language: 'zh-tw',
          type: 'book',
          ...overrides
        }
      }
    }

    test('成功時回傳對應 BookSchemaV2 欄位的書籍資料', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total_records: 1,
          current_offset: 0,
          records: [buildApiRecord()]
        })
      })

      const books = await adapter.extractAllBooks()

      expect(books).toHaveLength(1)
      expect(books[0]).toMatchObject({
        bookId: 'G000034891',
        title: '蜜蜂與遠雷',
        author: '恩田陸',
        publisher: '博客來網路書店',
        publishDate: '2018/04/17',
        coverUrl: 'https://s3public-ebook.books.com.tw/cover/G000034891.jpg',
        readProgress: 67,
        lastReadAt: '2025-01-24T16:48:40+08:00',
        purchaseDate: '2018-05-11T17:40:09+08:00',
        format: 'reflowable',
        language: 'zh-tw',
        itemType: 'book',
        source: 'books-com-tw'
      })
    })

    test('會呼叫 ReadList API endpoint 並帶入 offset 分頁參數', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ total_records: 1, current_offset: 0, records: [buildApiRecord()] })
      })

      await adapter.extractAllBooks()

      expect(global.fetch).toHaveBeenCalledWith(
        '//appapi-ebook.books.com.tw/V1.7/CMSAPIApp/ReadList',
        expect.objectContaining({ method: 'POST' })
      )
      const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body)
      expect(requestBody.offset).toBe(0)
      expect(requestBody.page_size).toBe(40)
    })

    test('total_records 超過單頁時會循環呼叫多次直到取得全部書目', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            total_records: 45,
            current_offset: 0,
            records: [buildApiRecord({ item: 'G1' })]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            total_records: 45,
            current_offset: 40,
            records: [buildApiRecord({ item: 'G2' })]
          })
        })

      const books = await adapter.extractAllBooks()

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(books.map(b => b.bookId)).toEqual(['G1', 'G2'])
    })

    test('API 回應非 ok 時降級為 DOM 解析', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 })

      const container = document.createElement('div')
      container.classList.add('bookshelf__main')
      const book = document.createElement('div')
      book.classList.add('bookshelf__book')
      const titleEl = document.createElement('div')
      titleEl.classList.add('book__description__title')
      titleEl.textContent = 'DOM Fallback 書名'
      book.appendChild(titleEl)
      container.appendChild(book)
      document.body.appendChild(container)

      const books = await adapter.extractAllBooks()

      expect(books).toHaveLength(1)
      expect(books[0].title).toBe('DOM Fallback 書名')
      expect(books[0].source).toBe('books-com-tw')

      document.body.removeChild(container)
    })

    test('fetch 未定義（無 API 支援環境）時降級為 DOM 解析', async () => {
      delete global.fetch

      const container = document.createElement('div')
      container.classList.add('bookshelf__main')
      const book = document.createElement('div')
      book.classList.add('bookshelf__book')
      container.appendChild(book)
      document.body.appendChild(container)

      const books = await adapter.extractAllBooks()

      expect(books).toHaveLength(1)
      expect(books[0].source).toBe('books-com-tw')

      document.body.removeChild(container)
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      adapter = BooksComTwAdapter()
    })

    test('初始狀態統計為零', () => {
      const stats = adapter.getStats()
      expect(stats).toBeDefined()
      expect(stats.totalExtracted).toBe(0)
      expect(stats.successCount).toBe(0)
      expect(stats.failCount).toBe(0)
    })
  })

  describe('reset', () => {
    beforeEach(() => {
      adapter = BooksComTwAdapter()
    })

    test('重置後統計歸零', () => {
      adapter.reset()
      const stats = adapter.getStats()
      expect(stats.totalExtracted).toBe(0)
    })
  })

  describe('DOM 元素查找方法', () => {
    beforeEach(() => {
      adapter = BooksComTwAdapter()
    })

    test('findBookContainer 在無容器時回傳 null', () => {
      const container = adapter.findBookContainer()
      expect(container).toBeNull()
    })

    test('getBookElements 在無書籍時回傳空陣列', () => {
      const elements = adapter.getBookElements()
      expect(elements).toHaveLength(0)
    })

    test('getBookCount 在無書籍時回傳 0', () => {
      expect(adapter.getBookCount()).toBe(0)
    })

    test('findBookContainer 找到容器', () => {
      const container = document.createElement('div')
      container.classList.add('bookshelf__main')
      document.body.appendChild(container)

      expect(adapter.findBookContainer()).toBe(container)

      document.body.removeChild(container)
    })

    test('getBookElements 找到書籍元素', () => {
      const container = document.createElement('div')
      container.classList.add('bookshelf__main')
      const book1 = document.createElement('div')
      book1.classList.add('bookshelf__book')
      const book2 = document.createElement('div')
      book2.classList.add('bookshelf__book')
      container.appendChild(book1)
      container.appendChild(book2)
      document.body.appendChild(container)

      expect(adapter.getBookElements()).toHaveLength(2)
      expect(adapter.getBookCount()).toBe(2)

      document.body.removeChild(container)
    })
  })
})

describe('PlatformRegistry 博客來配置', () => {
  let PlatformRegistry

  beforeEach(() => {
    jest.resetModules()
    PlatformRegistry = require('src/content/platform/platform-registry')
  })

  test('detect 能識別博客來書庫頁 URL', () => {
    const result = PlatformRegistry.detect('https://viewer-ebook.books.com.tw/viewer/index.html?readlist=all')
    expect(result).not.toBeNull()
    expect(result.config.name).toBe('books-com-tw')
  })

  test('detect 能識別博客來主域名', () => {
    const result = PlatformRegistry.detect('https://www.books.com.tw/')
    expect(result).not.toBeNull()
    expect(result.config.name).toBe('books-com-tw')
  })

  test('getAllMatchPatterns 包含博客來 pattern', () => {
    const patterns = PlatformRegistry.getAllMatchPatterns()
    expect(patterns.some(p => p.includes('books.com.tw'))).toBe(true)
  })

  test('createAdapter 能建立博客來 adapter', () => {
    const result = PlatformRegistry.detect('https://viewer-ebook.books.com.tw/viewer/index.html')
    expect(result).not.toBeNull()
    const adapter = result.createAdapter()
    expect(adapter).toBeDefined()
    expect(adapter.getPlatformName()).toBe('books-com-tw')
  })

  test('Readmoo URL 不誤判為博客來', () => {
    const result = PlatformRegistry.detect('https://readmoo.com/')
    expect(result).not.toBeNull()
    expect(result.config.name).toBe('readmoo')
  })
})
