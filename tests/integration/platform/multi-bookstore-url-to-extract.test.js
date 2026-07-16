/**
 * @fileoverview 多書城 URL-to-extract 全鏈路整合測試
 * @version v1.0.0
 * @since 2026-07-16
 *
 * 負責功能：
 * - 驗證 PlatformRegistry.detect -> adapter.getPageType -> isExtractablePage 全鏈路
 * - 覆蓋 Readmoo、博客來、Kobo 三個書城的真實 URL pattern
 * - 暴露 readmoo-adapter 缺少 getPageType/isExtractablePage/isValidDomain 的結構性缺口
 *
 * 背景（1.6.0-W4-001）：
 * book-data-extractor 的 getPageType() 優先委派 platformAdapter.getPageType()，
 * adapter 無此方法或回傳 'unknown' 時才 fallback 到 Readmoo 硬編碼 URL pattern。
 * readmoo-adapter（factory 模式）未實作這些方法，實際靠 extractor fallback 運作；
 * 單元測試因 mock 遮蔽了這條 delegation chain，故本測試以真實模組串接驗證。
 */

const PlatformRegistry = require('src/content/platform/platform-registry')
const createBookDataExtractor = require('src/content/extractors/book-data-extractor')

describe('多書城 URL-to-extract 全鏈路整合測試', () => {
  const setLocation = (href) => {
    const url = new URL(href)
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: {
        href,
        hostname: url.hostname,
        pathname: url.pathname,
        search: url.search
      }
    })
  }

  describe('Readmoo（adapter 無 getPageType，驗證 extractor fallback delegation 缺口）', () => {
    const LIBRARY_URL = 'https://read.readmoo.com/#/library'
    const UNMATCHED_URL = 'https://read.readmoo.com/#/notifications'

    test('PlatformRegistry.detect 應識別 Readmoo 並回傳對應 config', () => {
      const detection = PlatformRegistry.detect(LIBRARY_URL)

      expect(detection).not.toBeNull()
      expect(detection.config.name).toBe('readmoo')
      expect(typeof detection.createAdapter).toBe('function')
    })

    test('createAdapter 建立的 Readmoo adapter 缺少 getPageType/isExtractablePage/isValidDomain', () => {
      const detection = PlatformRegistry.detect(LIBRARY_URL)
      const adapter = detection.createAdapter()

      expect(typeof adapter.getPageType).not.toBe('function')
      expect(typeof adapter.isExtractablePage).not.toBe('function')
      expect(typeof adapter.isValidDomain).not.toBe('function')
      expect(typeof adapter.extractAllBooks).toBe('function')
    })

    test('全鏈路：library URL 經 extractor fallback 判斷為可提取頁面', async () => {
      setLocation(LIBRARY_URL)

      const detection = PlatformRegistry.detect(LIBRARY_URL)
      const adapter = detection.createAdapter()
      const extractor = createBookDataExtractor()
      extractor.setPlatformAdapter(adapter)

      const pageType = await extractor.getPageType()
      const extractable = await extractor.isExtractablePage()

      expect(pageType).toBe('library')
      expect(extractable).toBe(true)
      expect(typeof adapter.extractAllBooks).toBe('function')
    })

    test('不匹配 URL：extractor fallback 正確回傳 unknown/false', async () => {
      setLocation(UNMATCHED_URL)

      const detection = PlatformRegistry.detect(UNMATCHED_URL)
      const adapter = detection.createAdapter()
      const extractor = createBookDataExtractor()
      extractor.setPlatformAdapter(adapter)

      const pageType = await extractor.getPageType()
      const extractable = await extractor.isExtractablePage()

      expect(pageType).toBe('unknown')
      expect(extractable).toBe(false)
    })
  })

  describe('博客來（adapter 完整實作 getPageType，靠 ?readlist 判斷）', () => {
    const LIBRARY_URL = 'https://viewer-ebook.books.com.tw/viewer/index.html?readlist=all'
    const UNMATCHED_URL = 'https://viewer-ebook.books.com.tw/viewer/index.html?id=12345'

    test('PlatformRegistry.detect 應識別博客來並回傳對應 config', () => {
      const detection = PlatformRegistry.detect(LIBRARY_URL)

      expect(detection).not.toBeNull()
      expect(detection.config.name).toBe('books-com-tw')
    })

    test('全鏈路：readlist URL 經 adapter.getPageType 判斷為可提取頁面', async () => {
      setLocation(LIBRARY_URL)

      const detection = PlatformRegistry.detect(LIBRARY_URL)
      const adapter = detection.createAdapter()
      const extractor = createBookDataExtractor()
      extractor.setPlatformAdapter(adapter)

      expect(adapter.isValidDomain(LIBRARY_URL)).toBe(true)

      const pageType = await extractor.getPageType()
      const extractable = await extractor.isExtractablePage()

      expect(pageType).toBe('library')
      expect(extractable).toBe(true)
      expect(typeof adapter.extractAllBooks).toBe('function')
    })

    test('不匹配 URL：無 readlist 參數時 adapter 正確回傳 unknown/false', async () => {
      const detection = PlatformRegistry.detect(UNMATCHED_URL)
      const adapter = detection.createAdapter()

      const pageType = await adapter.getPageType(UNMATCHED_URL)
      const extractable = await adapter.isExtractablePage(UNMATCHED_URL)

      expect(pageType).toBe('unknown')
      expect(extractable).toBe(false)
    })
  })

  describe('Kobo（adapter 完整實作 getPageType，靠 /library/books 路徑判斷）', () => {
    const LIBRARY_URL = 'https://www.kobo.com/tw/zh/library/books'
    const UNMATCHED_URL = 'https://www.kobo.com/tw/zh/account/settings'

    test('PlatformRegistry.detect 應識別 Kobo 並回傳對應 config', () => {
      const detection = PlatformRegistry.detect(LIBRARY_URL)

      expect(detection).not.toBeNull()
      expect(detection.config.name).toBe('kobo')
    })

    test('全鏈路：/library/books URL 經 adapter.getPageType 判斷為可提取頁面', async () => {
      setLocation(LIBRARY_URL)

      const detection = PlatformRegistry.detect(LIBRARY_URL)
      const adapter = detection.createAdapter()
      const extractor = createBookDataExtractor()
      extractor.setPlatformAdapter(adapter)

      expect(adapter.isValidDomain(LIBRARY_URL)).toBe(true)

      const pageType = await extractor.getPageType()
      const extractable = await extractor.isExtractablePage()

      expect(pageType).toBe('library')
      expect(extractable).toBe(true)
      expect(typeof adapter.extractAllBooks).toBe('function')
    })

    test('不匹配 URL：非 /library/books 路徑時 adapter 正確回傳 unknown/false', async () => {
      const detection = PlatformRegistry.detect(UNMATCHED_URL)
      const adapter = detection.createAdapter()

      const pageType = await adapter.getPageType(UNMATCHED_URL)
      const extractable = await adapter.isExtractablePage(UNMATCHED_URL)

      expect(pageType).toBe('unknown')
      expect(extractable).toBe(false)
    })
  })

  describe('不匹配書城的 URL', () => {
    test('未註冊 hostname 時 PlatformRegistry.detect 應回傳 null', () => {
      const detection = PlatformRegistry.detect('https://www.google.com/search')

      expect(detection).toBeNull()
    })

    test('無效 URL 字串時 PlatformRegistry.detect 應回傳 null', () => {
      const detection = PlatformRegistry.detect('not-a-valid-url')

      expect(detection).toBeNull()
    })
  })
})
