const { ErrorCodesWithTest: ErrorCodes } = require('@tests/helpers/test-error-codes')
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
      // eslint-disable-next-line no-unused-vars
      const supportedUrls = adapter.getSupportedUrls()

      expect(supportedUrls).toContain('readmoo.com')
      expect(supportedUrls).toContain('member.readmoo.com')
      expect(Array.isArray(supportedUrls)).toBe(true)
    })

    test('getSupportedUrls 不應殘留過時的 readmoo.com/library 硬編碼模式', () => {
      // W1-029.1: 真實書庫頁為 https://read.readmoo.com/#/library
      // （Vue SPA hash route），不含子字串 readmoo.com/library。
      // Chrome match pattern 不支援 fragment(#)，故 path 段不可硬編 /library。
      const supportedUrls = adapter.getSupportedUrls()

      const stalePatterns = supportedUrls.filter(
        (pattern) => pattern.includes('readmoo.com/library') ||
          pattern.includes('readmoo.com/bookshelf')
      )
      expect(stalePatterns).toEqual([])
    })

    test('應該能驗證 Readmoo 書庫頁面', () => {
      // eslint-disable-next-line no-unused-vars
      const libraryUrl = 'https://member.readmoo.com/library'
      // eslint-disable-next-line no-unused-vars
      const isValid = adapter.validatePage(libraryUrl)

      expect(isValid).toBe(true)
    })

    test('應該能驗證 Readmoo 書架頁面', () => {
      // eslint-disable-next-line no-unused-vars
      const shelfUrl = 'https://member.readmoo.com/shelf'
      // eslint-disable-next-line no-unused-vars
      const isValid = adapter.validatePage(shelfUrl)

      expect(isValid).toBe(true)
    })

    test('應該拒絕非 Readmoo 頁面', () => {
      // eslint-disable-next-line no-unused-vars
      const invalidUrls = [
        'https://example.com',
        'https://google.com',
        'https://books.com.tw'
      ]

      invalidUrls.forEach(url => {
        // eslint-disable-next-line no-unused-vars
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
      // eslint-disable-next-line no-unused-vars
      const result = adapter.parseDocument(document)

      expect(result).toBeDefined()
      expect(result.isValid).toBe(true)
      expect(Array.isArray(result.bookElements)).toBe(true)
    })

    test('應該能找到書籍元素', () => {
      // eslint-disable-next-line no-unused-vars
      const result = adapter.parseDocument(document)

      expect(result.bookElements.length).toBeGreaterThan(0)
      expect(result.bookElements[0]).toBeInstanceOf(Element)
    })

    test('應該能識別書籍容器', () => {
      // eslint-disable-next-line no-unused-vars
      const containers = adapter.findBookContainers(document)

      expect(Array.isArray(containers)).toBe(true)
      expect(containers.length).toBeGreaterThan(0)
      expect(containers[0].classList.contains('library-item')).toBe(true)
    })

    test('應該能處理空的 DOM', () => {
      document.body.innerHTML = ''

      // eslint-disable-next-line no-unused-vars
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
      // eslint-disable-next-line no-unused-vars
      const books = await adapter.extractBooks()

      expect(Array.isArray(books)).toBe(true)
      expect(books.length).toBeGreaterThan(0)

      // eslint-disable-next-line no-unused-vars
      const book = books[0]
      expect(book).toHaveProperty('id')
      expect(book).toHaveProperty('title')
      expect(book).toHaveProperty('cover')
      expect(book).toHaveProperty('progress')
      expect(book).toHaveProperty('type')
    })

    test('應該能正確提取書籍 ID（reader-link 優先，W6-012.2.1）', async () => {
      // eslint-disable-next-line no-unused-vars
      const books = await adapter.extractBooks()
      // eslint-disable-next-line no-unused-vars
      const book = books[0]

      // W6-012.2.1：策略順序重排為 reader-link → cover → title → fallback
      // 有合法 reader-link href 時，使用 reader-{readerId} 作為主 ID
      expect(book.id).toBe('reader-210327003000101')

      // 檢查額外識別資訊（coverId 仍然提取保留作參考）
      expect(book.identifiers).toBeDefined()
      expect(book.identifiers.coverId).toBe('qpfmrmi')
      expect(book.identifiers.readerLinkId).toBe('210327003000101')
      expect(book.identifiers.primarySource).toBe('reader-link')
    })

    test('應該能正確提取書籍標題', async () => {
      // eslint-disable-next-line no-unused-vars
      const books = await adapter.extractBooks()
      // eslint-disable-next-line no-unused-vars
      const book = books[0]

      expect(book.title).toBe('大腦不滿足')
    })

    test('應該能正確提取書籍封面和細節資訊', async () => {
      // eslint-disable-next-line no-unused-vars
      const books = await adapter.extractBooks()
      // eslint-disable-next-line no-unused-vars
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
      // eslint-disable-next-line no-unused-vars
      const books = await adapter.extractBooks()
      // eslint-disable-next-line no-unused-vars
      const book = books[0]

      expect(book.progress).toBe(60)
      expect(typeof book.progress).toBe('number')
    })

    test('應該能正確識別書籍類型', async () => {
      // eslint-disable-next-line no-unused-vars
      const books = await adapter.extractBooks()
      // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const books = await adapter.extractBooks()
      // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const books = await adapter.extractBooks()
      // eslint-disable-next-line no-unused-vars
      const book = books[0]

      expect(book.progress).toBe(0)
      // W6-012.2.1：reader-link 優先，使用 reader-{readerId}
      expect(book.id).toBe('reader-987654321')
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

      // eslint-disable-next-line no-unused-vars
      const books = await adapter.extractBooks()
      // eslint-disable-next-line no-unused-vars
      const book = books[0]

      // W6-012.2.1：reader-link 優先，使用 reader-{readerId}
      expect(book.id).toBe('reader-111111111')
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

      // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const initialStats = adapter.getStats()
      expect(initialStats.totalExtractions).toBe(0)

      await adapter.extractBooks()

      // eslint-disable-next-line no-unused-vars
      const updatedStats = adapter.getStats()
      expect(updatedStats.totalExtractions).toBe(1)
      expect(updatedStats.successfulExtractions).toBe(1)
    })

    test('應該能重置適配器狀態', () => {
      adapter.stats.totalExtractions = 5
      adapter.reset()

      // eslint-disable-next-line no-unused-vars
      const stats = adapter.getStats()
      expect(stats.totalExtractions).toBe(0)
    })

    test('應該提供適配器資訊', () => {
      // eslint-disable-next-line no-unused-vars
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

    test('應該優先使用 reader-link 提取書籍ID（W6-012.2.1）', async () => {
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

      // eslint-disable-next-line no-unused-vars
      const books = await adapter.extractBooks()
      // eslint-disable-next-line no-unused-vars
      const book = books[0]

      // W6-012.2.1：reader-link 優先（穩定可反查 Readmoo 真實書籍）
      expect(book.id).toBe('reader-999999999')
      expect(book.identifiers.coverId).toBe('test123') // coverId 仍提取保留
      expect(book.identifiers.primarySource).toBe('reader-link')
      expect(book.identifiers.readerLinkId).toBe('999999999')
    })

    test('無 reader-link 與無 cover 時，應該從標題生成備用ID（W6-012.2.1）', async () => {
      // W6-012.2.1：reader-link 優先策略下，僅當 reader-link 也缺失才走 title
      // 用 readerLink 缺失（href 空 / 無 anchor）模擬無 reader id 來源
      document.body.innerHTML = `
        <div class="library-item">
          <div class="cover">
            <img class="cover-img"
                 src="https://invalid-domain.com/nopattern.jpg"
                 alt="複雜 書籍@標題 (第一集)">
          </div>
          <div class="info">
            <div class="title" title="複雜 書籍@標題 (第一集)">複雜 書籍@標題 (第一集)</div>
          </div>
        </div>
      `

      // eslint-disable-next-line no-unused-vars
      const books = await adapter.extractBooks()
      // eslint-disable-next-line no-unused-vars
      const book = books[0]

      // 由於 reader-link 缺失 + cover URL 無法識別，應該使用標題生成ID
      expect(book.id).toBe('title-複雜-書籍標題-第一集')
      expect(book.identifiers.primarySource).toBe('title')
      expect(book.identifiers.titleBased).toBe('複雜-書籍標題-第一集')
    })

    test('應該以 reader-link 為主 ID（W6-012.2.1：reader-{readerId}，已移除 unstable- 前綴）', async () => {
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

      // eslint-disable-next-line no-unused-vars
      const books = await adapter.extractBooks()
      // eslint-disable-next-line no-unused-vars
      const book = books[0]

      // W6-012.2.1：tryReaderStrategy 改返 reader-{id}（移除 unstable- 前綴）
      expect(book.id).toBe('reader-777777777')
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

      // eslint-disable-next-line no-unused-vars
      const books = await adapter.extractBooks()
      // eslint-disable-next-line no-unused-vars
      const book = books[0]

      // 檢查完整的識別資訊結構（W6-012.2.1：primarySource 改為 reader-link）
      expect(book.identifiers).toEqual({
        coverId: 'unique456',
        titleBased: '完整測試書籍',
        readerLinkId: '555555555',
        privacyBookId: '',
        primarySource: 'reader-link'
      })

      expect(book.coverInfo).toEqual({
        url: 'https://cdn.readmoo.com/cover/xy/unique456_210x315.jpg?v=789',
        filename: 'unique456_210x315.jpg',
        domain: 'cdn.readmoo.com'
      })
    })

    test('應該正確解析不同的封面URL格式（W6-012.2.1：coverId 仍提取保留為輔助識別）', async () => {
      // W6-012.2.1：reader-link 已成主 ID 來源，cover 改為輔助識別
      // 本測試聚焦於 coverId 解析的正確性，book.id 由 reader-link 提供
      const testCases = [
        {
          url: 'https://cdn.readmoo.com/cover/ab/bookid123_210x315.jpg?v=123',
          expectedCoverId: 'bookid123'
        },
        {
          url: 'https://cdn.readmoo.com/cover/xy/another-book_300x450.png',
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

        // eslint-disable-next-line no-unused-vars
        const books = await adapter.extractBooks()
        // eslint-disable-next-line no-unused-vars
        const book = books[0]

        expect(book.id).toBe('reader-123456')
        expect(book.identifiers.coverId).toBe(testCase.expectedCoverId)
        expect(book.identifiers.primarySource).toBe('reader-link')
      }
    })
  })

  // W6-012.2.1：ID 策略優先級重排（reader-link 第一優先 + cover known-unstable 過濾）
  // 對應 ticket: 0.18.0-W6-012.2.1
  describe('ID 策略優先級 (W6-012.2.1)', () => {
    beforeEach(() => {
      adapter = createReadmooAdapter()
    })

    test('Case 1: reader-link 與 cover 同時可用時，reader-link 優先', () => {
      const inputs = {
        readerId: '18337744',
        title: 'X',
        cover: 'https://cdn.readmoo.com/cover/aa/abc_210x315.jpg'
      }
      const result = adapter.applyIdGenerationStrategiesWithInfo(inputs)
      expect(result.id).toBe('reader-18337744')
      expect(result.strategy).toBe('reader-link')
    })

    test('Case 2: reader-link 缺失但 cover 可用時，使用 cover 後備', () => {
      const inputs = {
        readerId: '',
        title: 'X',
        cover: 'https://cdn.readmoo.com/cover/aa/abc_210x315.jpg'
      }
      const result = adapter.applyIdGenerationStrategiesWithInfo(inputs)
      expect(result.id).toBe('cover-abc')
      expect(result.strategy).toBe('cover')
    })

    test('Case 3: cover 為 openbook 佔位圖時，過濾並改走 title 策略', () => {
      const inputs = {
        readerId: '',
        title: '範例書名',
        cover: 'https://read.readmoo.com/images/openbook.png'
      }
      const result = adapter.applyIdGenerationStrategiesWithInfo(inputs)
      expect(result.strategy).toBe('title')
      expect(result.id).toMatch(/^title-/)
    })

    test('Case 4: 全部來源缺失時，回退至 fallback 策略', () => {
      const inputs = {
        readerId: '',
        title: '',
        cover: ''
      }
      const result = adapter.applyIdGenerationStrategiesWithInfo(inputs)
      expect(result.strategy).toBe('fallback')
      // createFallbackId 目前回傳 'reader-undefined'（既有實作）
      // 此處驗證 strategy 而非 id 字面，避免綁定 fallback id 內部格式
      expect(typeof result.id).toBe('string')
      expect(result.id.length).toBeGreaterThan(0)
    })
  })

  describe('錯誤處理和邊界情況 (Cycle #4)', () => {
    beforeEach(() => {
      adapter = createReadmooAdapter()
    })

    test('應該能處理 null 文檔', async () => {
      // eslint-disable-next-line no-unused-vars
      const books = await adapter.extractBooks()
      expect(books).toEqual([])
    })

    test('應該能處理無效的 DOM 結構', async () => {
      document.body.innerHTML = '<div>無效結構</div>'

      // eslint-disable-next-line no-unused-vars
      const books = await adapter.extractBooks()
      expect(Array.isArray(books)).toBe(true)
      expect(books).toHaveLength(0)
    })

    test('應該記錄錯誤統計', async () => {
      // 模擬解析錯誤
      jest.spyOn(adapter, 'parseBookElement').mockImplementation(() => {
        throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
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

      // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const books = await adapter.extractBooks()

      // 應該能提取有效的書籍，忽略無效項目
      expect(books).toHaveLength(1)
      // W6-012.2.1：reader-link 優先，readerId = 'valid'
      expect(books[0].id).toBe('reader-valid')
    })
  })

  describe('容錯策略 - 必要/可選欄位分離 (W3-004)', () => {
    beforeEach(() => {
      adapter = createReadmooAdapter()
    })

    test('readerLink 找不到時，應從其他元素提取 title 並保留記錄', async () => {
      // 沒有 a[href*="/api/reader/"] 連結，但有 title 和 cover
      document.body.innerHTML = `
        <div class="library-item">
          <div class="cover">
            <img class="cover-img"
                 src="https://cdn.readmoo.com/cover/ab/nolink123_210x315.jpg"
                 alt="無連結書籍">
          </div>
          <div class="info">
            <div class="title">無連結書籍</div>
          </div>
        </div>
      `

      const books = await adapter.extractBooks()

      expect(books).toHaveLength(1)
      expect(books[0].title).toBe('無連結書籍')
      expect(books[0].url).toBe('')
      expect(books[0].id).toBe('cover-nolink123')
      expect(books[0].identifiers.readerLinkId).toBe('')
    })

    test('href 不安全時，應清空 href 但不丟棄整筆記錄', async () => {
      document.body.innerHTML = `
        <div class="library-item">
          <div class="cover">
            <a href="javascript:alert('xss')" class="reader-link">
              <img class="cover-img"
                   src="https://cdn.readmoo.com/cover/cd/unsafe456_210x315.jpg"
                   alt="不安全連結書籍">
            </a>
          </div>
          <div class="info">
            <div class="title">不安全連結書籍</div>
          </div>
        </div>
      `

      const books = await adapter.extractBooks()

      // readerLink 選擇器 a[href*="/api/reader/"] 不會匹配 javascript: href
      // 因此行為等同於 readerLink 找不到，但仍有 title 和 cover
      expect(books).toHaveLength(1)
      expect(books[0].title).toBe('不安全連結書籍')
      expect(books[0].url).toBe('')
      expect(books[0].id).toBe('cover-unsafe456')
    })

    test('extractBookId 失敗時，應使用 title-based ID 作為 fallback', async () => {
      // href 格式不含 /api/reader/ 也不含 /book/，extractBookId 回傳空字串
      document.body.innerHTML = `
        <div class="library-item">
          <div class="cover">
            <a href="https://readmoo.com/api/reader/" class="reader-link">
              <img class="cover-img"
                   src="https://invalid-domain.com/no-pattern.jpg"
                   alt="ID提取失敗">
            </a>
          </div>
          <div class="info">
            <div class="title">ID提取失敗的書籍</div>
          </div>
        </div>
      `

      const books = await adapter.extractBooks()

      expect(books).toHaveLength(1)
      expect(books[0].title).toBe('ID提取失敗的書籍')
      // readerId 為空字串，封面 URL 非 readmoo 域名，應使用 title-based ID
      expect(books[0].identifiers.primarySource).toBe('title')
    })

    test('title 和所有 ID 來源都為空時，才 return null', async () => {
      document.body.innerHTML = `
        <div class="library-item">
          <div class="cover">
          </div>
          <div class="info">
            <div class="title"></div>
          </div>
        </div>
      `

      const books = await adapter.extractBooks()

      expect(books).toHaveLength(0)
    })

    test('只有 title 可用時，應保留記錄並使用 title-based ID', async () => {
      document.body.innerHTML = `
        <div class="library-item">
          <div class="info">
            <div class="title">只有標題的書籍</div>
          </div>
        </div>
      `

      const books = await adapter.extractBooks()

      expect(books).toHaveLength(1)
      expect(books[0].title).toBe('只有標題的書籍')
      expect(books[0].cover).toBe('')
      expect(books[0].url).toBe('')
      expect(books[0].identifiers.primarySource).toBe('title')
    })

    test('只有 cover 可用時（含有效 coverId），應保留記錄', async () => {
      document.body.innerHTML = `
        <div class="library-item">
          <div class="cover">
            <img class="cover-img"
                 src="https://cdn.readmoo.com/cover/ef/onlycover789_210x315.jpg"
                 alt="">
          </div>
          <div class="info">
            <div class="title"></div>
          </div>
        </div>
      `

      const books = await adapter.extractBooks()

      expect(books).toHaveLength(1)
      expect(books[0].id).toBe('cover-onlycover789')
      expect(books[0].title).toBe('未知標題')
      expect(books[0].identifiers.coverId).toBe('onlycover789')
    })

    test('可選欄位（progress、bookType）失敗時應留預設值', async () => {
      document.body.innerHTML = `
        <div class="library-item">
          <div class="cover">
            <img class="cover-img"
                 src="https://cdn.readmoo.com/cover/gh/optfield_210x315.jpg"
                 alt="可選欄位測試">
          </div>
          <div class="info">
            <div class="title">可選欄位測試</div>
          </div>
        </div>
      `

      const books = await adapter.extractBooks()

      expect(books).toHaveLength(1)
      expect(books[0].progress).toBe(0)
      expect(books[0].type).toBe('未知')
    })

    test('混合場景：部分書籍缺 readerLink，應保留可提取的記錄', async () => {
      document.body.innerHTML = `
        <div class="row">
          <div class="library-item">
            <div class="cover">
              <a href="https://readmoo.com/api/reader/111222333" class="reader-link">
                <img class="cover-img"
                     src="https://cdn.readmoo.com/cover/aa/normal_210x315.jpg"
                     alt="正常書籍">
              </a>
            </div>
            <div class="info"><div class="title">正常書籍</div></div>
          </div>
          <div class="library-item">
            <div class="cover">
              <img class="cover-img"
                   src="https://cdn.readmoo.com/cover/bb/nolink_210x315.jpg"
                   alt="無連結書籍">
            </div>
            <div class="info"><div class="title">無連結書籍</div></div>
          </div>
          <div class="library-item">
            <div class="info"><div class="title"></div></div>
          </div>
        </div>
      `

      const books = await adapter.extractBooks()

      // 前兩本應該保留，第三本（無 title 無 ID 來源）應被丟棄
      expect(books).toHaveLength(2)
      expect(books[0].title).toBe('正常書籍')
      expect(books[1].title).toBe('無連結書籍')
    })

    describe('extractHrefFromElement 單元測試', () => {
      test('readerLink 不存在時回傳空字串', () => {
        document.body.innerHTML = '<div class="library-item"><div class="info"></div></div>'
        const element = document.querySelector('.library-item')

        const result = adapter.extractHrefFromElement(element)

        expect(result.href).toBe('')
        expect(result.readerId).toBe('')
      })

      test('readerLink 存在且合法時回傳 href 和 readerId', () => {
        document.body.innerHTML = `
          <div class="library-item">
            <a href="https://readmoo.com/api/reader/abc123" class="reader-link"></a>
          </div>
        `
        const element = document.querySelector('.library-item')

        const result = adapter.extractHrefFromElement(element)

        expect(result.href).toBe('https://readmoo.com/api/reader/abc123')
        expect(result.readerId).toBe('abc123')
      })
    })

    describe('extractBookIdFromPrivacy 單元測試', () => {
      test('privacy 元素存在時回傳書籍 ID', () => {
        document.body.innerHTML = `
          <div class="library-item">
            <div class="privacy" id="privacy-8606906"></div>
          </div>
        `
        const element = document.querySelector('.library-item')

        const result = adapter.extractBookIdFromPrivacy(element)

        expect(result).toBe('8606906')
      })

      test('privacy 元素不存在時回傳空字串', () => {
        document.body.innerHTML = `
          <div class="library-item">
            <div class="info"></div>
          </div>
        `
        const element = document.querySelector('.library-item')

        const result = adapter.extractBookIdFromPrivacy(element)

        expect(result).toBe('')
      })

      test('privacy id 格式不正確時回傳空字串', () => {
        document.body.innerHTML = `
          <div class="library-item">
            <div class="privacy" id="privacy-abc"></div>
          </div>
        `
        const element = document.querySelector('.library-item')

        const result = adapter.extractBookIdFromPrivacy(element)

        expect(result).toBe('')
      })
    })

    describe('佔位 URL 偵測與 privacy ID 替換', () => {
      test('href 為佔位值且 privacy ID 存在時，使用 privacy ID 構建 URL', async () => {
        // 模擬實機 DOM：所有書共用同一 href，但每本有獨立 privacy ID
        document.body.innerHTML = `
          <div class="library-item">
            <div class="cover-outer">
              <div class="cover">
                <a href="https://readmoo.com/api/reader/210017268000101" class="reader-link"
                   data-open-in-browser="true" target="_blank" rel="noopener noreferrer">
                  <img class="cover-img" alt="哲學與宗教全史"
                       src="https://cdn.readmoo.com/cover/po/jfkfuvv_210x315.jpg?v=1744015069">
                </a>
              </div>
            </div>
            <div class="privacy" id="privacy-8606906"></div>
            <div class="info">
              <div class="progress progress-simple">
                <div class="progress-bar" style="width: 56%;"></div>
              </div>
              <div class="title" title="哲學與宗教全史">哲學與宗教全史</div>
            </div>
          </div>
        `

        const books = await adapter.extractBooks()

        expect(books).toHaveLength(1)
        const book = books[0]
        // URL 應使用 privacy ID 構建，不是佔位值
        expect(book.url).toBe('https://readmoo.com/api/reader/8606906')
        // identifiers 應記錄 privacy ID
        expect(book.identifiers.privacyBookId).toBe('8606906')
        // readerLinkId 應為 privacy ID（取代佔位 ID）
        expect(book.identifiers.readerLinkId).toBe('8606906')
      })

      test('href 與 privacy ID 相同時，保留原始 URL', async () => {
        // 正常情況：href 中的 ID 與 privacy ID 一致
        document.body.innerHTML = `
          <div class="library-item">
            <div class="cover">
              <a href="https://readmoo.com/api/reader/8606906" class="reader-link">
                <img class="cover-img" alt="正常書籍"
                     src="https://cdn.readmoo.com/cover/ab/test123_210x315.jpg">
              </a>
            </div>
            <div class="privacy" id="privacy-8606906"></div>
            <div class="info">
              <div class="title">正常書籍</div>
            </div>
          </div>
        `

        const books = await adapter.extractBooks()

        expect(books).toHaveLength(1)
        const book = books[0]
        // URL 不需要替換
        expect(book.url).toBe('https://readmoo.com/api/reader/8606906')
        expect(book.identifiers.privacyBookId).toBe('8606906')
        expect(book.identifiers.readerLinkId).toBe('8606906')
      })

      test('多本書都使用佔位 URL 時，各自使用 privacy ID', async () => {
        document.body.innerHTML = `
          <div class="library-item">
            <div class="cover">
              <a href="https://readmoo.com/api/reader/210017268000101" class="reader-link">
                <img class="cover-img" alt="書籍A"
                     src="https://cdn.readmoo.com/cover/ab/aaa111_210x315.jpg">
              </a>
            </div>
            <div class="privacy" id="privacy-1001"></div>
            <div class="info">
              <div class="title">書籍A</div>
            </div>
          </div>
          <div class="library-item">
            <div class="cover">
              <a href="https://readmoo.com/api/reader/210017268000101" class="reader-link">
                <img class="cover-img" alt="書籍B"
                     src="https://cdn.readmoo.com/cover/cd/bbb222_210x315.jpg">
              </a>
            </div>
            <div class="privacy" id="privacy-2002"></div>
            <div class="info">
              <div class="title">書籍B</div>
            </div>
          </div>
        `

        const books = await adapter.extractBooks()

        expect(books).toHaveLength(2)
        // 每本書應有獨立的 URL
        expect(books[0].url).toBe('https://readmoo.com/api/reader/1001')
        expect(books[1].url).toBe('https://readmoo.com/api/reader/2002')
        // URL 不應相同
        expect(books[0].url).not.toBe(books[1].url)
        // privacy ID 正確記錄
        expect(books[0].identifiers.privacyBookId).toBe('1001')
        expect(books[1].identifiers.privacyBookId).toBe('2002')
      })

      test('無 privacy 元素且有合法 href 時，保留原始行為', async () => {
        document.body.innerHTML = `
          <div class="library-item">
            <div class="cover">
              <a href="https://readmoo.com/api/reader/12345" class="reader-link">
                <img class="cover-img" alt="無privacy書籍"
                     src="https://cdn.readmoo.com/cover/ab/xyz789_210x315.jpg">
              </a>
            </div>
            <div class="info">
              <div class="title">無privacy書籍</div>
            </div>
          </div>
        `

        const books = await adapter.extractBooks()

        expect(books).toHaveLength(1)
        const book = books[0]
        // 保留原始 URL
        expect(book.url).toBe('https://readmoo.com/api/reader/12345')
        expect(book.identifiers.privacyBookId).toBe('')
        expect(book.identifiers.readerLinkId).toBe('12345')
      })
    })

    describe('hasRequiredFields 單元測試', () => {
      test('有 title 時回傳 true', () => {
        expect(adapter.hasRequiredFields('書名', '', '')).toBe(true)
      })

      test('有 readerId 時回傳 true', () => {
        expect(adapter.hasRequiredFields('', '123', '')).toBe(true)
      })

      test('有有效 cover（含 coverId）時回傳 true', () => {
        expect(adapter.hasRequiredFields('', '', 'https://cdn.readmoo.com/cover/ab/test_210x315.jpg')).toBe(true)
      })

      test('全部為空時回傳 false', () => {
        expect(adapter.hasRequiredFields('', '', '')).toBe(false)
      })

      test('空白字串視為空', () => {
        expect(adapter.hasRequiredFields('  ', '  ', '')).toBe(false)
      })
    })
  })

  describe('isUnsafeUrl 相對路徑封面 URL 修復 (W1-010)', () => {
    beforeEach(() => {
      adapter = createReadmooAdapter()
    })

    describe('isUnsafeUrl 單元測試 - base 參數支援相對路徑', () => {
      test('相對路徑 cover URL 帶 base 時不被誤判為 unsafe', () => {
        // W1-006 根因：單參數 new URL() 對相對路徑 throw，被誤判為 unsafe
        expect(adapter.isUnsafeUrl('/cover/abc/xyz_210x315.jpg', 'https://readmoo.com')).toBe(false)
      })

      test('不帶斜線開頭的相對路徑帶 base 時不被誤判為 unsafe', () => {
        expect(adapter.isUnsafeUrl('cover/abc/xyz_210x315.jpg', 'https://readmoo.com')).toBe(false)
      })

      test('絕對 URL 帶 base 時 base 被忽略，結果不變', () => {
        expect(adapter.isUnsafeUrl('https://cdn.readmoo.com/cover/jb/q_210x315.jpg', 'https://readmoo.com')).toBe(false)
      })

      test('javascript: URI 帶 base 時仍被判定為 unsafe', () => {
        expect(adapter.isUnsafeUrl('javascript:alert(1)', 'https://readmoo.com')).toBe(true)
      })

      test('data: URI 帶 base 時仍被判定為 unsafe', () => {
        expect(adapter.isUnsafeUrl('data:image/png;base64,AAAA', 'https://readmoo.com')).toBe(true)
      })

      test('相對路徑含路徑遍歷 (..) 帶 base 時仍被判定為 unsafe', () => {
        // new URL(url, base) 會把 .. 正規化掉，故必須對原始字串檢查
        expect(adapter.isUnsafeUrl('/cover/../../../etc/passwd', 'https://readmoo.com')).toBe(true)
      })

      test('相對路徑含 %2e%2e 編碼路徑遍歷帶 base 時仍被判定為 unsafe', () => {
        expect(adapter.isUnsafeUrl('/cover/%2e%2e/%2e%2e/etc/passwd', 'https://readmoo.com')).toBe(true)
      })

      test('不帶 base 時絕對 URL 行為不變（向後相容）', () => {
        expect(adapter.isUnsafeUrl('https://cdn.readmoo.com/cover/jb/q_210x315.jpg')).toBe(false)
        expect(adapter.isUnsafeUrl('javascript:alert(1)')).toBe(true)
      })

      test('空值或非字串輸入仍回傳 unsafe', () => {
        expect(adapter.isUnsafeUrl('', 'https://readmoo.com')).toBe(true)
        expect(adapter.isUnsafeUrl(null, 'https://readmoo.com')).toBe(true)
      })
    })

    describe('extractCoverAndTitle 對相對路徑封面的處理', () => {
      test('相對路徑封面 URL 不應被清空（W1-006: 78/96 封面誤過濾）', () => {
        const element = buildLibraryItem('/cover/abc/relcover001_210x315.jpg', '相對路徑封面書籍')

        const result = adapter.extractCoverAndTitle(element)

        expect(result.cover).toBe('/cover/abc/relcover001_210x315.jpg')
        expect(result.title).toBe('相對路徑封面書籍')
      })

      test('相對路徑封面含 javascript: 仍被清空', () => {
        const element = buildLibraryItem("javascript:alert('xss')", '惡意封面書籍')

        const result = adapter.extractCoverAndTitle(element)

        expect(result.cover).toBe('')
        expect(result.title).toBe('惡意封面書籍')
      })

      test('相對路徑封面含路徑遍歷 (..) 仍被清空', () => {
        const element = buildLibraryItem('/cover/../../../etc/passwd', '遍歷封面書籍')

        const result = adapter.extractCoverAndTitle(element)

        expect(result.cover).toBe('')
        expect(result.title).toBe('遍歷封面書籍')
      })
    })
  })

  /**
   * W1-012：extractHrefFromElement 相對路徑 reader link 修復
   *
   * 根因（同 W1-010 模式）：extractHrefFromElement 呼叫 isUnsafeUrl(rawHref) 未傳 base，
   * 相對路徑 reader link（如 /api/reader/abc123）會被單參數 new URL() throw 誤判為 unsafe，
   * 導致 href 清空 → readerId 變空 → 書籍主 ID 退化為 fallback（privacy ID / 硬編碼）。
   *
   * 修復：isUnsafeUrl(rawHref) → isUnsafeUrl(rawHref, getLocation().origin)
   * 安全保證：javascript:/data: 協議與路徑遍歷 (../%2e%2e) 仍會被 isUnsafeUrl 過濾。
   */
  describe('extractHrefFromElement 相對路徑 reader link 修復 (W1-012)', () => {
    beforeEach(() => {
      adapter = createReadmooAdapter()
    })

    test('相對路徑 reader link 不被誤判為 unsafe，readerId 正確提取', () => {
      // W1-012 根因：單參數 new URL() 對相對路徑 throw，被 isUnsafeUrl 誤判為 unsafe
      // 修復後：傳入 getLocation().origin（測試環境為 https://readmoo.com）作 base
      document.body.innerHTML = `
        <div class="library-item">
          <a href="/api/reader/abc123" class="reader-link"></a>
        </div>
      `
      const element = document.querySelector('.library-item')

      const result = adapter.extractHrefFromElement(element)

      // href 不應被清空（修復前：相對路徑被誤判 unsafe → href = ''）
      expect(result.href).toBe('/api/reader/abc123')
      // readerId 不應退化（修復前：href 清空 → extractBookId 取不到 → readerId = ''）
      expect(result.readerId).toBe('abc123')
    })

    test('相對 /api/reader/ 多段路徑 reader link 不被誤判為 unsafe', () => {
      // 真實 Readmoo reader link selector 為 a[href*="/api/reader/"]，
      // 此測試確認多段路徑（不只 /api/reader/{id} 短形）的相對路徑也能正確處理。
      document.body.innerHTML = `
        <div class="library-item">
          <a href="/api/reader/xyz789/chapter/1" class="reader-link"></a>
        </div>
      `
      const element = document.querySelector('.library-item')

      const result = adapter.extractHrefFromElement(element)

      expect(result.href).toBe('/api/reader/xyz789/chapter/1')
      expect(result.readerId).toBe('xyz789')
    })

    test('絕對路徑 reader link 行為不變（向後相容）', () => {
      document.body.innerHTML = `
        <div class="library-item">
          <a href="https://readmoo.com/api/reader/abs999" class="reader-link"></a>
        </div>
      `
      const element = document.querySelector('.library-item')

      const result = adapter.extractHrefFromElement(element)

      expect(result.href).toBe('https://readmoo.com/api/reader/abs999')
      expect(result.readerId).toBe('abs999')
    })

    test('相對路徑 reader link 含 javascript: 仍被清空（安全檢查未弱化）', () => {
      document.body.innerHTML = `
        <div class="library-item">
          <a href="javascript:alert('xss')" class="reader-link"></a>
        </div>
      `
      const element = document.querySelector('.library-item')

      const result = adapter.extractHrefFromElement(element)

      expect(result.href).toBe('')
      expect(result.readerId).toBe('')
    })

    test('相對路徑 reader link 含路徑遍歷 (..) 仍被清空（安全檢查未弱化）', () => {
      document.body.innerHTML = `
        <div class="library-item">
          <a href="/api/reader/../../../etc/passwd" class="reader-link"></a>
        </div>
      `
      const element = document.querySelector('.library-item')

      const result = adapter.extractHrefFromElement(element)

      expect(result.href).toBe('')
      expect(result.readerId).toBe('')
    })

    test('相對路徑 reader link 含 %2e%2e 編碼路徑遍歷仍被清空', () => {
      document.body.innerHTML = `
        <div class="library-item">
          <a href="/api/reader/%2e%2e/%2e%2e/etc/passwd" class="reader-link"></a>
        </div>
      `
      const element = document.querySelector('.library-item')

      const result = adapter.extractHrefFromElement(element)

      expect(result.href).toBe('')
      expect(result.readerId).toBe('')
    })
  })

  /**
   * W1-013：validateCoverUrlInput 與 validateReadmooDomain 相對 cover URL 修復
   *
   * 根因（同 W1-010/W1-012 模式）：
   * 1. validateCoverUrlInput 呼叫 isUnsafeUrl(trimmed) 未傳 base → 相對路徑誤判 unsafe
   * 2. validateReadmooDomain 呼叫 new URL(url) 未傳 base → 相對路徑 throw → false
   *
   * W1-010 已使 extractCoverAndTitle 保留相對封面，但 extractCoverIdFromUrl
   * 呼叫鏈（validateCoverUrlInput → validateReadmooDomain）雙重阻擋相對 URL，
   * 導致 coverId 無法提取 → tryCoverStrategy 失效 → 書籍 ID 退化為其他 fallback。
   *
   * 修復：
   * - validateCoverUrlInput：isUnsafeUrl(trimmed) → isUnsafeUrl(trimmed, getLocation().origin)
   * - validateReadmooDomain：相對 URL 以 base 解析 + 接受 /cover/ 路徑（已過上游安全閘）
   *
   * 安全保證：javascript:/data: 與路徑遍歷由 isUnsafeUrl 過濾，hostname 嚴格性
   * 對絕對 URL 保留（cdn.readmoo.com only）。
   */
  describe('extractCoverIdFromUrl 相對 cover URL 修復 (W1-013)', () => {
    beforeEach(() => {
      adapter = createReadmooAdapter()
    })

    describe('validateCoverUrlInput - 相對路徑支援', () => {
      test('相對 cover URL 不被誤判為 unsafe，回傳原 URL', () => {
        // W1-013 根因 1：未傳 base 時相對路徑被誤判 unsafe → null
        expect(adapter.validateCoverUrlInput('/cover/abc/xyz_210x315.jpg'))
          .toBe('/cover/abc/xyz_210x315.jpg')
      })

      test('絕對 cover URL 行為不變（向後相容）', () => {
        expect(adapter.validateCoverUrlInput('https://cdn.readmoo.com/cover/jb/q_210x315.jpg'))
          .toBe('https://cdn.readmoo.com/cover/jb/q_210x315.jpg')
      })

      test('javascript: URI 仍被過濾為 null（安全檢查未弱化）', () => {
        expect(adapter.validateCoverUrlInput('javascript:alert(1)')).toBeNull()
      })

      test('data: URI 仍被過濾為 null（安全檢查未弱化）', () => {
        expect(adapter.validateCoverUrlInput('data:image/png;base64,AAAA')).toBeNull()
      })

      test('相對路徑含路徑遍歷 (..) 仍被過濾為 null', () => {
        expect(adapter.validateCoverUrlInput('/cover/../../../etc/passwd')).toBeNull()
      })

      test('空值或非字串輸入仍回傳 null', () => {
        expect(adapter.validateCoverUrlInput('')).toBeNull()
        expect(adapter.validateCoverUrlInput(null)).toBeNull()
        expect(adapter.validateCoverUrlInput(undefined)).toBeNull()
        expect(adapter.validateCoverUrlInput(123)).toBeNull()
      })
    })

    describe('validateReadmooDomain - 相對路徑支援', () => {
      test('相對 /cover/ 路徑被視為合法（隱含 readmoo-domain）', () => {
        expect(adapter.validateReadmooDomain('/cover/abc/xyz_210x315.jpg')).toBe(true)
      })

      test('絕對 cdn.readmoo.com /cover/ URL 行為不變（向後相容）', () => {
        expect(adapter.validateReadmooDomain('https://cdn.readmoo.com/cover/jb/q_210x315.jpg'))
          .toBe(true)
      })

      test('絕對 cdn.readmoo.com 非 /cover/ 路徑仍被拒絕', () => {
        expect(adapter.validateReadmooDomain('https://cdn.readmoo.com/other/path.jpg'))
          .toBe(false)
      })

      test('絕對非 cdn.readmoo.com 域名（即使路徑含 /cover/）仍被拒絕（hostname 嚴格性保留）', () => {
        expect(adapter.validateReadmooDomain('https://evil.com/cover/abc/xyz.jpg')).toBe(false)
      })

      test('相對路徑非 /cover/ 開頭仍被拒絕', () => {
        expect(adapter.validateReadmooDomain('/other/abc/xyz.jpg')).toBe(false)
      })

      test('protocol-relative URL (//evil.com/cover/...) 不視為相對路徑', () => {
        // protocol-relative URL resolve 後 hostname = evil.com，非 cdn.readmoo.com，被拒絕
        expect(adapter.validateReadmooDomain('//evil.com/cover/abc/xyz.jpg')).toBe(false)
      })

      test('無效輸入回傳 false（handleWithFallback 兜底）', () => {
        expect(adapter.validateReadmooDomain('')).toBe(false)
        expect(adapter.validateReadmooDomain(null)).toBe(false)
        expect(adapter.validateReadmooDomain('not a url')).toBe(false)
      })
    })

    describe('extractCoverIdFromUrl - 端到端相對路徑支援（主回歸）', () => {
      test('相對 cover URL 可正確提取 coverId（W1-013 主修復目標）', () => {
        // W1-013 主 AC：相對 cover URL 可正確提取 coverId
        // 修復前：validateCoverUrlInput → null 或 validateReadmooDomain → false → null
        // 修復後：完整流程通過 → extractIdFromCoverPath 取出 'xyz'
        expect(adapter.extractCoverIdFromUrl('/cover/abc/xyz_210x315.jpg')).toBe('xyz')
      })

      test('絕對 cover URL 行為不變（向後相容）', () => {
        expect(adapter.extractCoverIdFromUrl('https://cdn.readmoo.com/cover/jb/qpfmrmi_210x315.jpg'))
          .toBe('qpfmrmi')
      })

      test('相對 cover URL 含查詢參數可正確提取 coverId', () => {
        expect(adapter.extractCoverIdFromUrl('/cover/ab/test123_210x315.jpg?v=123456'))
          .toBe('test123')
      })

      test('相對 cover URL 含 javascript: 被攔截回傳 null（安全檢查未弱化）', () => {
        expect(adapter.extractCoverIdFromUrl('javascript:alert(1)')).toBeNull()
      })

      test('相對 cover URL 含路徑遍歷被攔截回傳 null（安全檢查未弱化）', () => {
        expect(adapter.extractCoverIdFromUrl('/cover/../../../etc/passwd')).toBeNull()
      })

      test('非 cdn.readmoo.com 的絕對 URL 被拒絕回傳 null（hostname 嚴格性）', () => {
        expect(adapter.extractCoverIdFromUrl('https://evil.com/cover/abc/xyz_210x315.jpg'))
          .toBeNull()
      })
    })
  })

  /**
   * TG-8：extractAllBooks 與 loadAllBooksLazy 整合（0.19.0-W1-030）
   *
   * 對應 Phase 2 測試設計 TG-8。驗證捲動載入在 extractAllBooks 內
   * 於 waitForBookElements 之前呼叫、回傳型別不變、降級銜接、
   * EXTRACTION_COMPLETED 日誌併入涵蓋率欄位。
   */
  describe('extractAllBooks 捲動載入整合 (W1-030 TG-8)', () => {
    beforeEach(() => {
      adapter = createReadmooAdapter()
    })

    // TC-8.1 loadAllBooksLazy 於 waitForBookElements 之前呼叫
    test('TC-8.1 loadAllBooksLazy 呼叫順序早於 waitForBookElements', async () => {
      expect(typeof adapter.loadAllBooksLazy).toBe('function')
      expect(typeof adapter.waitForBookElements).toBe('function')

      const loadSpy = jest.spyOn(adapter, 'loadAllBooksLazy').mockResolvedValue({
        loadedCount: 96,
        expectedTotal: 96,
        coverageComplete: true,
        missingCount: 0,
        stopReason: 'reached_total',
        iterations: 1,
        durationMs: 100
      })
      const waitSpy = jest.spyOn(adapter, 'waitForBookElements').mockResolvedValue([])

      await adapter.extractAllBooks()

      expect(loadSpy).toHaveBeenCalled()
      expect(waitSpy).toHaveBeenCalled()
      expect(loadSpy.mock.invocationCallOrder[0])
        .toBeLessThan(waitSpy.mock.invocationCallOrder[0])
    })

    // TC-8.2 extractAllBooks 回傳型別不變
    test('TC-8.2 extractAllBooks 回傳 Promise<Object[]>（陣列）', async () => {
      jest.spyOn(adapter, 'loadAllBooksLazy').mockResolvedValue({
        loadedCount: 0,
        expectedTotal: 0,
        coverageComplete: true,
        missingCount: 0,
        stopReason: 'already_complete',
        iterations: 0,
        durationMs: 0
      })
      jest.spyOn(adapter, 'waitForBookElements').mockResolvedValue([])

      const books = await adapter.extractAllBooks()

      expect(Array.isArray(books)).toBe(true)
    })

    // TC-8.3 EXTRACTION_COMPLETED 日誌併入涵蓋率欄位
    test('TC-8.3 EXTRACTION_COMPLETED 日誌含 expectedTotal 與 coverageComplete', async () => {
      const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
      adapter = createReadmooAdapter({ logger: mockLogger })
      jest.spyOn(adapter, 'loadAllBooksLazy').mockResolvedValue({
        loadedCount: 928,
        expectedTotal: 928,
        coverageComplete: true,
        missingCount: 0,
        stopReason: 'reached_total',
        iterations: 10,
        durationMs: 5000
      })
      jest.spyOn(adapter, 'waitForBookElements').mockResolvedValue([])

      await adapter.extractAllBooks()

      expect(mockLogger.info).toHaveBeenCalledWith('EXTRACTION_COMPLETED', expect.objectContaining({
        expectedTotal: 928,
        coverageComplete: true
      }))
    })

    // TC-8.4 容器找不到時降級為現行提取行為
    test('TC-8.4 loadAllBooksLazy 回傳 container_not_found 時 waitForBookElements 仍被呼叫', async () => {
      jest.spyOn(adapter, 'loadAllBooksLazy').mockResolvedValue({
        loadedCount: 96,
        expectedTotal: 96,
        coverageComplete: true,
        missingCount: 0,
        stopReason: 'container_not_found',
        iterations: 0,
        durationMs: 0
      })
      const waitSpy = jest.spyOn(adapter, 'waitForBookElements').mockResolvedValue([])

      const books = await adapter.extractAllBooks()

      expect(waitSpy).toHaveBeenCalled()
      expect(Array.isArray(books)).toBe(true)
    })

    // TC-8.5 loadAllBooksLazy 回傳 error 時提取仍以已載入書籍繼續
    test('TC-8.5 loadAllBooksLazy 回傳 error 時 extractAllBooks 不整體失敗', async () => {
      jest.spyOn(adapter, 'loadAllBooksLazy').mockResolvedValue({
        loadedCount: 400,
        expectedTotal: 928,
        coverageComplete: false,
        missingCount: 528,
        stopReason: 'error',
        iterations: 3,
        durationMs: 2000
      })
      jest.spyOn(adapter, 'waitForBookElements').mockResolvedValue([])

      await expect(adapter.extractAllBooks()).resolves.toBeDefined()
    })
  })
})

/**
 * 建立 library-item DOM 元素供 extractCoverAndTitle 測試使用
 *
 * 以安全 DOM API（createElement / setAttribute / textContent）建構，
 * 避免 innerHTML 注入測試固定值。
 *
 * @param {string} coverSrc - 封面 img 的 src 值（可為相對路徑）
 * @param {string} titleText - 書名文字
 * @returns {HTMLElement} library-item 容器元素
 */
function buildLibraryItem (coverSrc, titleText) {
  const item = document.createElement('div')
  item.className = 'library-item'

  const cover = document.createElement('div')
  cover.className = 'cover'
  const img = document.createElement('img')
  img.className = 'cover-img'
  img.setAttribute('src', coverSrc)
  img.setAttribute('alt', titleText)
  cover.appendChild(img)

  const info = document.createElement('div')
  info.className = 'info'
  const title = document.createElement('div')
  title.className = 'title'
  title.textContent = titleText
  info.appendChild(title)

  item.appendChild(cover)
  item.appendChild(info)
  return item
}
