/**
 * ReadmooAdapter 單元測試
 *
 * 測試 ReadmooAdapter 的核心功能：
 * - 適配器基本結構和介面
 * - DOM 解析能力
 * - 書籍資料提取
 * - 適配器標準化介面
 */

describe('ReadmooAdapter', () => {
  let createReadmooAdapter
  let adapter

  beforeEach(() => {
    // 重新載入模組以確保乾淨的測試環境
    jest.resetModules()

    try {
      createReadmooAdapter = require('src/content/adapters/readmoo-adapter')
    } catch (error) {
      // 預期在紅燈階段會失敗
      createReadmooAdapter = null
    }
  })

  afterEach(() => {
    if (adapter) {
      adapter = null
    }
    jest.clearAllMocks()
  })

  describe('適配器基本結構 (Cycle #4)', () => {
    test('應該能創建 ReadmooAdapter 實例', () => {
      expect(createReadmooAdapter).toBeDefined()

      adapter = createReadmooAdapter()
      expect(adapter).toBeDefined()
      expect(typeof adapter).toBe('object')
      expect(adapter.constructor.name).toBe('ReadmooAdapter')
    })

    test('應該有正確的適配器名稱和版本', () => {
      adapter = createReadmooAdapter()

      expect(adapter.name).toBe('ReadmooAdapter')
      expect(adapter.version).toBeDefined()
      expect(typeof adapter.version).toBe('string')
    })

    test('應該實現標準化適配器介面', () => {
      adapter = createReadmooAdapter()

      // 檢查必需的方法
      expect(typeof adapter.extractBooks).toBe('function')
      expect(typeof adapter.parseDocument).toBe('function')
      expect(typeof adapter.validatePage).toBe('function')
      expect(typeof adapter.getSupportedUrls).toBe('function')
    })

    test('應該有適配器配置和狀態', () => {
      adapter = createReadmooAdapter()

      expect(adapter.config).toBeDefined()
      expect(adapter.stats).toBeDefined()
      expect(adapter.isInitialized).toBe(false)
    })
  })

  describe('Readmoo 頁面驗證 (Cycle #4)', () => {
    beforeEach(() => {
      adapter = createReadmooAdapter()
    })

    test('應該能識別支援的 Readmoo URL', () => {
      const supportedUrls = adapter.getSupportedUrls()

      expect(supportedUrls).toContain('readmoo.com')
      expect(supportedUrls).toContain('member.readmoo.com')
      expect(Array.isArray(supportedUrls)).toBe(true)
    })

    test('應該能驗證 Readmoo 書庫頁面', () => {
      const libraryUrl = 'https://member.readmoo.com/library'
      const isValid = adapter.validatePage(libraryUrl)

      expect(isValid).toBe(true)
    })

    test('應該能驗證 Readmoo 書架頁面', () => {
      const shelfUrl = 'https://member.readmoo.com/shelf'
      const isValid = adapter.validatePage(shelfUrl)

      expect(isValid).toBe(true)
    })

    test('應該拒絕非 Readmoo 頁面', () => {
      const invalidUrls = [
        'https://example.com',
        'https://google.com',
        'https://books.com.tw'
      ]

      invalidUrls.forEach(url => {
        const isValid = adapter.validatePage(url)
        expect(isValid).toBe(false)
      })
    })
  })

  describe('DOM 解析能力 (Cycle #4)', () => {
    beforeEach(() => {
      adapter = createReadmooAdapter()

      // 模擬 DOM 環境
      document.body.innerHTML = `
        <div class="row">
          <div class="library-item library-item-grid-view col-lg-2 col-sm-3 col-4" style="z-index: 1">
            <div class="cover-outer">
              <div class="cover-container">
                <div class="cover">
                  <a data-open-in-browser="true" target="_blank" rel="noopener noreferrer" 
                     href="https://readmoo.com/api/reader/210327003000101" class="reader-link">
                    <img class="cover-img" 
                         src="https://cdn.readmoo.com/cover/jb/qpfmrmi_210x315.jpg?v=1714370332" 
                         alt="大腦不滿足">
                  </a>
                </div>
              </div>
              <div class="rendition-overlay d-flex justify-content-between align-items-end">
                <div><div class="label rendition">流式</div></div>
              </div>
            </div>
            <div class="info">
              <div class="progress progress-simple">
                <div class="progress-bar" style="width: 60%"></div>
              </div>
              <div class="title" title="大腦不滿足">大腦不滿足</div>
            </div>
            <div class="select-overlay" data-selected="false">
              <div class="circle"><i class="mo mo-check"></i></div>
            </div>
          </div>
        </div>
      `
    })

    test('應該能解析 DOM 文檔', () => {
      const result = adapter.parseDocument(document)

      expect(result).toBeDefined()
      expect(result.isValid).toBe(true)
      expect(Array.isArray(result.bookElements)).toBe(true)
    })

    test('應該能找到書籍元素', () => {
      const result = adapter.parseDocument(document)

      expect(result.bookElements.length).toBeGreaterThan(0)
      expect(result.bookElements[0]).toBeInstanceOf(Element)
    })

    test('應該能識別書籍容器', () => {
      const containers = adapter.findBookContainers(document)

      expect(Array.isArray(containers)).toBe(true)
      expect(containers.length).toBeGreaterThan(0)
      expect(containers[0].classList.contains('library-item')).toBe(true)
    })

    test('應該能處理空的 DOM', () => {
      document.body.innerHTML = ''

      const result = adapter.parseDocument(document)

      expect(result.isValid).toBe(true)
      expect(result.bookElements).toHaveLength(0)
    })
  })

  describe('書籍資料提取 (Cycle #4)', () => {
    beforeEach(() => {
      adapter = createReadmooAdapter()

      // 設置測試 DOM
      document.body.innerHTML = `
        <div class="row">
          <div class="library-item library-item-grid-view col-lg-2 col-sm-3 col-4">
            <div class="cover-outer">
              <div class="cover-container">
                <div class="cover">
                  <a href="https://readmoo.com/api/reader/210327003000101" class="reader-link">
                    <img class="cover-img" 
                         src="https://cdn.readmoo.com/cover/jb/qpfmrmi_210x315.jpg" 
                         alt="大腦不滿足">
                  </a>
                </div>
              </div>
              <div class="rendition-overlay">
                <div><div class="label rendition">流式</div></div>
              </div>
            </div>
            <div class="info">
              <div class="progress progress-simple">
                <div class="progress-bar" style="width: 60%"></div>
              </div>
              <div class="title" title="大腦不滿足">大腦不滿足</div>
            </div>
          </div>
        </div>
      `
    })

    test('應該能提取完整的書籍資料', async () => {
      const books = await adapter.extractBooks()

      expect(Array.isArray(books)).toBe(true)
      expect(books.length).toBeGreaterThan(0)

      const book = books[0]
      expect(book).toHaveProperty('id')
      expect(book).toHaveProperty('title')
      expect(book).toHaveProperty('cover')
      expect(book).toHaveProperty('progress')
      expect(book).toHaveProperty('type')
    })

    test('應該能正確提取書籍 ID（使用封面URL系統）', async () => {
      const books = await adapter.extractBooks()
      const book = books[0]

      // 新系統使用封面URL作為主要識別
      expect(book.id).toBe('cover-qpfmrmi')

      // 檢查額外識別資訊
      expect(book.identifiers).toBeDefined()
      expect(book.identifiers.coverId).toBe('qpfmrmi')
      expect(book.identifiers.readerLinkId).toBe('210327003000101')
      expect(book.identifiers.primarySource).toBe('cover')
    })

    test('應該能正確提取書籍標題', async () => {
      const books = await adapter.extractBooks()
      const book = books[0]

      expect(book.title).toBe('大腦不滿足')
    })

    test('應該能正確提取書籍封面和細節資訊', async () => {
      const books = await adapter.extractBooks()
      const book = books[0]

      expect(book.cover).toContain('cdn.readmoo.com')
      expect(book.cover).toContain('qpfmrmi_210x315.jpg')

      // 檢查封面資訊
      expect(book.coverInfo).toBeDefined()
      expect(book.coverInfo.url).toBe(book.cover)
      expect(book.coverInfo.filename).toContain('qpfmrmi_210x315.jpg')
      expect(book.coverInfo.domain).toBe('cdn.readmoo.com')
    })

    test('應該能正確解析閱讀進度', async () => {
      const books = await adapter.extractBooks()
      const book = books[0]

      expect(book.progress).toBe(60)
      expect(typeof book.progress).toBe('number')
    })

    test('應該能正確識別書籍類型', async () => {
      const books = await adapter.extractBooks()
      const book = books[0]

      expect(book.type).toBe('流式')
    })
  })

  describe('進階書籍資料提取 (Cycle #4)', () => {
    beforeEach(() => {
      adapter = createReadmooAdapter()
    })

    test('應該能處理版式書籍', async () => {
      document.body.innerHTML = `
        <div class="library-item">
          <div class="cover-outer">
            <div class="cover">
              <a href="https://readmoo.com/api/reader/123456789" class="reader-link">
                <img class="cover-img" src="https://cdn.readmoo.com/cover/test.jpg" alt="版式書籍">
              </a>
            </div>
            <div class="rendition-overlay">
              <div><div class="label rendition">版式</div></div>
            </div>
          </div>
          <div class="info">
            <div class="progress progress-simple">
              <div class="progress-bar" style="width: 100%"></div>
            </div>
            <div class="title">版式書籍</div>
          </div>
        </div>
      `

      const books = await adapter.extractBooks()
      const book = books[0]

      expect(book.type).toBe('版式')
      expect(book.progress).toBe(100)
    })

    test('應該能處理未開始閱讀的書籍', async () => {
      document.body.innerHTML = `
        <div class="library-item">
          <div class="cover">
            <a href="https://readmoo.com/api/reader/987654321" class="reader-link">
              <img class="cover-img" src="https://cdn.readmoo.com/cover/new.jpg" alt="新書">
            </a>
          </div>
          <div class="info">
            <div class="progress progress-simple">
              <div class="progress-bar" style="width: 0%"></div>
            </div>
            <div class="title">新書</div>
          </div>
        </div>
      `

      const books = await adapter.extractBooks()
      const book = books[0]

      expect(book.progress).toBe(0)
      // 新系統中會嘗試從封面URL提取ID
      expect(book.id).toContain('new') // 封面名稱為cover-new或相似
    })

    test('應該能處理缺少某些欄位的書籍', async () => {
      document.body.innerHTML = `
        <div class="library-item">
          <div class="cover">
            <a href="https://readmoo.com/api/reader/111111111" class="reader-link">
              <img class="cover-img" src="https://cdn.readmoo.com/cover/incomplete.jpg" alt="不完整資料">
            </a>
          </div>
          <div class="info">
            <div class="title">不完整資料</div>
          </div>
        </div>
      `

      const books = await adapter.extractBooks()
      const book = books[0]

      // 新系統中會嘗試從封面URL提取ID
      expect(book.id).toContain('incomplete') // 封面名稱為cover-incomplete或相似
      expect(book.title).toBe('不完整資料')
      expect(book.progress).toBe(0) // 預設值
      expect(book.type).toBe('未知') // 預設值
    })

    test('應該能處理多本書籍', async () => {
      document.body.innerHTML = `
        <div class="row">
          <div class="library-item">
            <div class="cover">
              <a href="https://readmoo.com/api/reader/111" class="reader-link">
                <img class="cover-img" src="https://cdn.readmoo.com/1.jpg" alt="書籍1">
              </a>
            </div>
            <div class="info"><div class="title">書籍1</div></div>
          </div>
          <div class="library-item">
            <div class="cover">
              <a href="https://readmoo.com/api/reader/222" class="reader-link">
                <img class="cover-img" src="https://cdn.readmoo.com/2.jpg" alt="書籍2">
              </a>
            </div>
            <div class="info"><div class="title">書籍2</div></div>
          </div>
        </div>
      `

      const books = await adapter.extractBooks()

      expect(books).toHaveLength(2)
      // 新系統使用封面為主要識別，會根據封面檔名生成ID
      expect(books[0].id).toContain('1') // 可能是 cover-1 或類似
      expect(books[1].id).toContain('2') // 可能是 cover-2 或類似
    })
  })

  describe('適配器統計和狀態 (Cycle #4)', () => {
    beforeEach(() => {
      adapter = createReadmooAdapter()
    })

    test('應該追蹤提取統計', async () => {
      document.body.innerHTML = `
        <div class="library-item">
          <div class="cover">
            <a href="https://readmoo.com/api/reader/123" class="reader-link">
              <img class="cover-img" src="test.jpg" alt="測試書籍">
            </a>
          </div>
          <div class="info"><div class="title">測試書籍</div></div>
        </div>
      `

      const initialStats = adapter.getStats()
      expect(initialStats.totalExtractions).toBe(0)

      await adapter.extractBooks()

      const updatedStats = adapter.getStats()
      expect(updatedStats.totalExtractions).toBe(1)
      expect(updatedStats.successfulExtractions).toBe(1)
    })

    test('應該能重置適配器狀態', () => {
      adapter.stats.totalExtractions = 5
      adapter.reset()

      const stats = adapter.getStats()
      expect(stats.totalExtractions).toBe(0)
    })

    test('應該提供適配器資訊', () => {
      const info = adapter.getAdapterInfo()

      expect(info).toHaveProperty('name')
      expect(info).toHaveProperty('version')
      expect(info).toHaveProperty('supportedSites')
      expect(info.supportedSites).toContain('readmoo.com')
    })
  })

  describe('新書籍識別系統 (ID System v2.0)', () => {
    beforeEach(() => {
      adapter = createReadmooAdapter()
    })

    test('應該優先使用封面URL提取書籍ID', async () => {
      document.body.innerHTML = `
        <div class="library-item">
          <div class="cover">
            <a href="https://readmoo.com/api/reader/999999999" class="reader-link">
              <img class="cover-img" 
                   src="https://cdn.readmoo.com/cover/ab/test123_210x315.jpg?v=123456" 
                   alt="測試書籍">
            </a>
          </div>
          <div class="info">
            <div class="title" title="測試書籍">測試書籍</div>
          </div>
        </div>
      `

      const books = await adapter.extractBooks()
      const book = books[0]

      // 主要ID應該來自封面URL
      expect(book.id).toBe('cover-test123')
      expect(book.identifiers.coverId).toBe('test123')
      expect(book.identifiers.primarySource).toBe('cover')
      expect(book.identifiers.readerLinkId).toBe('999999999')
    })

    test('應該能從標題生成備用ID', async () => {
      document.body.innerHTML = `
        <div class="library-item">
          <div class="cover">
            <a href="https://readmoo.com/api/reader/888888888" class="reader-link">
              <img class="cover-img" 
                   src="https://invalid-domain.com/nopattern.jpg" 
                   alt="複雜 書籍@標題 (第一集)">
            </a>
          </div>
          <div class="info">
            <div class="title" title="複雜 書籍@標題 (第一集)">複雜 書籍@標題 (第一集)</div>
          </div>
        </div>
      `

      const books = await adapter.extractBooks()
      const book = books[0]

      // 由於封面URL無法識別，應該使用標題生成ID
      expect(book.id).toBe('title-複雜-書籍標題-第一集')
      expect(book.identifiers.primarySource).toBe('title')
      expect(book.identifiers.titleBased).toBe('複雜-書籍標題-第一集')
    })

    test('應該標記不穩定的reader-link ID', async () => {
      document.body.innerHTML = `
        <div class="library-item">
          <div class="cover">
            <a href="https://readmoo.com/api/reader/777777777" class="reader-link">
              <img class="cover-img" 
                   src="https://unknowndomain.com/unknown.png" 
                   alt="">
            </a>
          </div>
          <div class="info">
            <div class="title"></div>
          </div>
        </div>
      `

      const books = await adapter.extractBooks()
      const book = books[0]

      // 最後備用方案：使用reader-link但標記為不穩定
      expect(book.id).toBe('unstable-777777777')
      expect(book.identifiers.primarySource).toBe('reader-link')
      expect(book.identifiers.readerLinkId).toBe('777777777')
    })

    test('應該包含完整的識別資訊結構', async () => {
      document.body.innerHTML = `
        <div class="library-item">
          <div class="cover">
            <a href="https://readmoo.com/api/reader/555555555" class="reader-link">
              <img class="cover-img" 
                   src="https://cdn.readmoo.com/cover/xy/unique456_210x315.jpg?v=789" 
                   alt="完整測試">
            </a>
          </div>
          <div class="info">
            <div class="title" title="完整測試書籍">完整測試書籍</div>
          </div>
        </div>
      `

      const books = await adapter.extractBooks()
      const book = books[0]

      // 檢查完整的識別資訊結構
      expect(book.identifiers).toEqual({
        coverId: 'unique456',
        titleBased: '完整測試書籍',
        readerLinkId: '555555555',
        primarySource: 'cover'
      })

      expect(book.coverInfo).toEqual({
        url: 'https://cdn.readmoo.com/cover/xy/unique456_210x315.jpg?v=789',
        filename: 'unique456_210x315.jpg',
        domain: 'cdn.readmoo.com'
      })
    })

    test('應該正確處理不同的封面URL格式', async () => {
      const testCases = [
        {
          url: 'https://cdn.readmoo.com/cover/ab/bookid123_210x315.jpg?v=123',
          expectedId: 'cover-bookid123',
          expectedCoverId: 'bookid123'
        },
        {
          url: 'https://cdn.readmoo.com/cover/xy/another-book_300x450.png',
          expectedId: 'cover-another-book',
          expectedCoverId: 'another-book'
        }
      ]

      for (const testCase of testCases) {
        document.body.innerHTML = `
          <div class="library-item">
            <div class="cover">
              <a href="https://readmoo.com/api/reader/123456" class="reader-link">
                <img class="cover-img" src="${testCase.url}" alt="測試">
              </a>
            </div>
            <div class="info">
              <div class="title">測試書籍</div>
            </div>
          </div>
        `

        const books = await adapter.extractBooks()
        const book = books[0]

        expect(book.id).toBe(testCase.expectedId)
        expect(book.identifiers.coverId).toBe(testCase.expectedCoverId)
        expect(book.identifiers.primarySource).toBe('cover')
      }
    })
  })

  describe('錯誤處理和邊界情況 (Cycle #4)', () => {
    beforeEach(() => {
      adapter = createReadmooAdapter()
    })

    test('應該能處理 null 文檔', async () => {
      const books = await adapter.extractBooks()
      expect(books).toEqual([])
    })

    test('應該能處理無效的 DOM 結構', async () => {
      document.body.innerHTML = '<div>無效結構</div>'

      const books = await adapter.extractBooks()
      expect(Array.isArray(books)).toBe(true)
      expect(books).toHaveLength(0)
    })

    test('應該記錄錯誤統計', async () => {
      // 模擬解析錯誤
      jest.spyOn(adapter, 'parseBookElement').mockImplementation(() => {
        throw new Error('解析錯誤')
      })

      document.body.innerHTML = `
        <div class="library-item">
          <div class="cover">
            <a href="https://readmoo.com/api/reader/error" class="reader-link">
              <img class="cover-img" src="error.jpg" alt="錯誤書籍">
            </a>
          </div>
        </div>
      `

      await adapter.extractBooks()

      const stats = adapter.getStats()
      expect(stats.failedExtractions).toBeGreaterThan(0)
    })

    test('應該能恢復部分失敗的提取', async () => {
      document.body.innerHTML = `
        <div class="row">
          <div class="library-item">
            <div class="cover">
              <a href="https://readmoo.com/api/reader/valid" class="reader-link">
                <img class="cover-img" src="valid.jpg" alt="有效書籍">
              </a>
            </div>
            <div class="info"><div class="title">有效書籍</div></div>
          </div>
          <div class="invalid-item">無效項目</div>
        </div>
      `

      const books = await adapter.extractBooks()

      // 應該能提取有效的書籍，忽略無效項目
      expect(books).toHaveLength(1)
      // 由於封面URL無效，會使用標題生成ID
      expect(books[0].id).toBe('title-有效書籍')
    })
  })
})
