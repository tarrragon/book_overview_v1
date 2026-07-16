/**
 * KoboAdapter - SSR 分頁提取 單元測試
 *
 * 測試覆蓋率目標：
 * 1. _extractTotalCount - 從篩選器文字解析總筆數
 * 2. _buildPageUrl - 建構分頁 URL
 * 3. _fetchPageHtml - 透過 chrome.runtime.sendMessage 取 HTML
 * 4. _parseHtmlToBooks - DOMParser 解析 HTML 並提取書目
 * 5. extractAllBooks - 分頁迴圈（多頁整合、停止條件）
 *
 * Ticket: 1.6.0-W3-001.2
 */

describe('KoboAdapter - SSR 分頁', () => {
  let createKoboAdapter
  let adapter

  beforeEach(() => {
    jest.resetModules()

    // Mock chrome.runtime.sendMessage
    global.chrome = {
      runtime: {
        sendMessage: jest.fn()
      }
    }

    createKoboAdapter = require('src/content/adapters/kobo-adapter')
    adapter = createKoboAdapter()
  })

  afterEach(() => {
    delete global.chrome
    jest.clearAllMocks()
  })

  // 建立含書目的 HTML 片段
  const createBookHtml = (books) => {
    const bookItems = books.map(book => `
      <li class="item-wrapper book">
        <div class="item-detail">
          <div class="item-info main-meta">
            <div class="title product-field">
              <h2><a href="/tw/zh/ebook/${book.slug}">${book.title}</a></h2>
            </div>
            <div class="authors product-field">
              <span class="contributor-name">${book.author}</span>
            </div>
            <div class="genre product-field">${book.genre || '小說與文學'}</div>
          </div>
          <div class="item-bar">
            <div class="item-status-field">${book.status || '未閱讀'}</div>
          </div>
          <div class="date-field">2024/1/15</div>
        </div>
      </li>
    `).join('')

    return `<html><body>
      <nav class="library-filters">
        <span class="filter-chip">所有項目 (${books.length})</span>
      </nav>
      <region aria-label="書籍">
        <ul>${bookItems}</ul>
      </region>
    </body></html>`
  }

  describe('_extractTotalCount', () => {
    it('應從篩選器 "(N)" 文字解析總筆數', () => {
      // 設定 DOM：模擬篩選器含「所有項目 (120)」
      document.body.innerHTML = `
        <nav class="library-filters">
          <span class="filter-chip">所有項目 (120)</span>
        </nav>
      `

      const total = adapter._extractTotalCount()
      expect(total).toBe(120)
    })

    it('應在找不到篩選器時回傳 0', () => {
      document.body.innerHTML = '<div></div>'

      const total = adapter._extractTotalCount()
      expect(total).toBe(0)
    })

    it('應正確解析三位數以上的數字', () => {
      document.body.innerHTML = `
        <nav class="library-filters">
          <span class="filter-chip">所有項目 (1523)</span>
        </nav>
      `

      const total = adapter._extractTotalCount()
      expect(total).toBe(1523)
    })

    it('應忽略非數字的篩選器文字', () => {
      document.body.innerHTML = `
        <nav class="library-filters">
          <span class="filter-chip">所有項目</span>
        </nav>
      `

      const total = adapter._extractTotalCount()
      expect(total).toBe(0)
    })
  })

  describe('_buildPageUrl', () => {
    it('應建構含 pageSize=60 和 pageNumber 的 URL', () => {
      const url = adapter._buildPageUrl(2)
      expect(url).toContain('pageSize=60')
      expect(url).toContain('pageNumber=2')
    })

    it('應包含 Kobo 書庫基底 URL', () => {
      const url = adapter._buildPageUrl(3)
      expect(url).toContain('kobo.com')
      expect(url).toContain('/library/books')
    })

    it('pageNumber=1 時也應正常產生 URL', () => {
      const url = adapter._buildPageUrl(1)
      expect(url).toContain('pageNumber=1')
    })
  })

  describe('_fetchPageHtml', () => {
    it('應透過 chrome.runtime.sendMessage 取得 HTML', async () => {
      const mockHtml = '<html><body>page content</body></html>'
      global.chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        html: mockHtml,
        status: 200
      })

      const html = await adapter._fetchPageHtml('https://www.kobo.com/tw/zh/library/books?pageSize=60&pageNumber=2')

      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CONTENT.FETCH.PAGE_HTML',
          url: 'https://www.kobo.com/tw/zh/library/books?pageSize=60&pageNumber=2'
        })
      )
      expect(html).toBe(mockHtml)
    })

    it('應在 sendMessage 回傳 success:false 時拋出錯誤', async () => {
      global.chrome.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: 'Fetch failed: 403'
      })

      await expect(
        adapter._fetchPageHtml('https://www.kobo.com/tw/zh/library/books?pageSize=60&pageNumber=2')
      ).rejects.toThrow()
    })
  })

  describe('_parseHtmlToBooks', () => {
    it('應解析 HTML 字串並提取書目資料', () => {
      const html = createBookHtml([
        { slug: 'book-1', title: '測試書名', author: '測試作者' }
      ])

      const books = adapter._parseHtmlToBooks(html)

      expect(books).toHaveLength(1)
      expect(books[0].title).toBe('測試書名')
      expect(books[0].author).toBe('測試作者')
      expect(books[0].bookId).toBe('book-1')
    })

    it('應正確解析多本書', () => {
      const html = createBookHtml([
        { slug: 'book-1', title: '書名 A', author: '作者 A' },
        { slug: 'book-2', title: '書名 B', author: '作者 B' },
        { slug: 'book-3', title: '書名 C', author: '作者 C' }
      ])

      const books = adapter._parseHtmlToBooks(html)
      expect(books).toHaveLength(3)
    })

    it('應在空 HTML 時回傳空陣列', () => {
      const books = adapter._parseHtmlToBooks('<html><body></body></html>')
      expect(books).toHaveLength(0)
    })
  })

  describe('extractAllBooks - 分頁迴圈', () => {
    beforeEach(() => {
      // 讓 checkPageReady 直接 resolve
      adapter.checkPageReady = jest.fn().mockResolvedValue(true)
    })

    it('不超過 60 本時應僅解析當前頁面（不呼叫 sendMessage）', async () => {
      // 當前頁面有 10 本書
      document.body.innerHTML = createBookHtml(
        Array.from({ length: 10 }, (_, i) => ({
          slug: `book-${i}`, title: `Book ${i}`, author: `Author ${i}`
        }))
      )

      const books = await adapter.extractAllBooks()

      expect(books).toHaveLength(10)
      expect(global.chrome.runtime.sendMessage).not.toHaveBeenCalled()
    })

    it('超過 60 本時應 fetch 後續頁面並彙整', async () => {
      // 第一頁：60 本（篩選器顯示總共 80 本）
      const page1Books = Array.from({ length: 60 }, (_, i) => ({
        slug: `book-${i}`, title: `Book ${i}`, author: `Author ${i}`
      }))
      document.body.innerHTML = `
        <nav class="library-filters">
          <span class="filter-chip">所有項目 (80)</span>
        </nav>
        <region aria-label="書籍">
          <ul>${page1Books.map(b => `
            <li class="item-wrapper book">
              <div class="item-detail">
                <div class="item-info main-meta">
                  <div class="title product-field"><h2><a href="/tw/zh/ebook/${b.slug}">${b.title}</a></h2></div>
                  <span class="contributor-name">${b.author}</span>
                  <div class="genre product-field">小說</div>
                </div>
                <div class="item-bar"><div class="item-status-field">未閱讀</div></div>
                <div class="date-field">2024/1/15</div>
              </div>
            </li>
          `).join('')}</ul>
        </region>
      `

      // 第二頁：20 本
      const page2Html = createBookHtml(
        Array.from({ length: 20 }, (_, i) => ({
          slug: `book-${60 + i}`, title: `Book ${60 + i}`, author: `Author ${60 + i}`
        }))
      )

      global.chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        html: page2Html,
        status: 200
      })

      const books = await adapter.extractAllBooks()

      expect(books).toHaveLength(80)
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledTimes(1)
    })

    it('fetch 失敗時應停止分頁並回傳已取得的書籍', async () => {
      // 第一頁 60 本，篩選器顯示 120 本
      const page1Books = Array.from({ length: 60 }, (_, i) => ({
        slug: `book-${i}`, title: `Book ${i}`, author: `Author ${i}`
      }))
      document.body.innerHTML = `
        <nav class="library-filters">
          <span class="filter-chip">所有項目 (120)</span>
        </nav>
        <region aria-label="書籍">
          <ul>${page1Books.map(b => `
            <li class="item-wrapper book">
              <div class="item-detail">
                <div class="item-info main-meta">
                  <div class="title product-field"><h2><a href="/tw/zh/ebook/${b.slug}">${b.title}</a></h2></div>
                  <span class="contributor-name">${b.author}</span>
                  <div class="genre product-field">小說</div>
                </div>
                <div class="item-bar"><div class="item-status-field">未閱讀</div></div>
                <div class="date-field">2024/1/15</div>
              </div>
            </li>
          `).join('')}</ul>
        </region>
      `

      // fetch 第二頁失敗
      global.chrome.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: 'Network error'
      })

      const books = await adapter.extractAllBooks()

      // 應回傳第一頁的 60 本
      expect(books.length).toBeGreaterThanOrEqual(60)
      expect(books.length).toBeLessThan(120)
    })

    it('應遵守 MAX_PAGES 硬上限防止無限迴圈', async () => {
      // 篩選器顯示極大數字
      document.body.innerHTML = `
        <nav class="library-filters">
          <span class="filter-chip">所有項目 (999999)</span>
        </nav>
        <region aria-label="書籍">
          <ul><li class="item-wrapper book">
            <div class="item-detail">
              <div class="item-info main-meta">
                <div class="title product-field"><h2><a href="/tw/zh/ebook/test">Test</a></h2></div>
                <span class="contributor-name">Author</span>
                <div class="genre product-field">小說</div>
              </div>
              <div class="item-bar"><div class="item-status-field">未閱讀</div></div>
              <div class="date-field">2024/1/15</div>
            </div>
          </li></ul>
        </region>
      `

      // 每頁都回傳 60 本（永遠不停止）
      const pageHtml = createBookHtml(
        Array.from({ length: 60 }, (_, i) => ({
          slug: `book-${i}`, title: `Book ${i}`, author: `Author ${i}`
        }))
      )

      global.chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        html: pageHtml,
        status: 200
      })

      await adapter.extractAllBooks()

      // sendMessage 呼叫次數應不超過 MAX_PAGES（100）
      expect(global.chrome.runtime.sendMessage.mock.calls.length).toBeLessThanOrEqual(100)
    })
  })
})
