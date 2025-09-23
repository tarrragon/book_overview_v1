/**
 * @fileoverview Page Detection Utils 測試
 * @version v1.0.0
 * @since 2025-08-16
 *
 * 測試目標：
 * - 驗證 Readmoo 網域檢測功能
 * - 測試頁面類型識別 (library/shelf/reader)
 * - 確保 URL 和路徑分析正確性
 * - 驗證頁面準備狀態檢查
 *
 * @jest-environment jsdom
 */

describe('PageDetectionUtils', () => {
  let PageDetectionUtils
  let originalWindow
  let originalDocument

  beforeAll(() => {
    // 備份原始環境
    originalWindow = global.window
    originalDocument = global.document

    // 載入模組
    PageDetectionUtils = require('src/content/utils/page-detection-utils.js')
  })

  afterAll(() => {
    // 還原原始環境
    global.window = originalWindow
    global.document = originalDocument
  })

  beforeEach(() => {
    // Mock DOM API for Content Script environment
    global.window = {
      location: {
        href: 'https://readmoo.com/library',
        hostname: 'readmoo.com',
        pathname: '/library'
      }
    }

    global.document = {
      readyState: 'complete',
      querySelector: jest.fn(),
      querySelectorAll: jest.fn()
    }
  })

  // 簡化的 mock 更新函數
  // eslint-disable-next-line no-unused-vars
  const updateMockLocation = (href) => {
    try {
      // eslint-disable-next-line no-unused-vars
      const url = new URL(href)
      global.window.location = {
        href,
        hostname: url.hostname,
        pathname: url.pathname
      }
    } catch (error) {
      global.window.location = {
        href,
        hostname: '',
        pathname: ''
      }
    }
  }

  describe('🌐 網域檢測功能', () => {
    test('應該正確檢測 Readmoo 主網域', () => {
      expect(PageDetectionUtils.isReadmooDomain('https://readmoo.com/library')).toBe(true)
      expect(PageDetectionUtils.isReadmooDomain('https://www.readmoo.com/shelf')).toBe(true)
      expect(PageDetectionUtils.isReadmooDomain('https://readmoo.com')).toBe(true)
    })

    test('應該正確檢測 Readmoo 子網域', () => {
      expect(PageDetectionUtils.isReadmooDomain('https://member.readmoo.com')).toBe(true)
      expect(PageDetectionUtils.isReadmooDomain('https://api.readmoo.com')).toBe(true)
    })

    test('應該拒絕非 Readmoo 網域', () => {
      expect(PageDetectionUtils.isReadmooDomain('https://amazon.com')).toBe(false)
      expect(PageDetectionUtils.isReadmooDomain('https://kobo.com')).toBe(false)
      expect(PageDetectionUtils.isReadmooDomain('https://fake-readmoo.com')).toBe(false)
    })

    test('應該處理無效的 URL', () => {
      expect(PageDetectionUtils.isReadmooDomain('')).toBe(false)
      expect(PageDetectionUtils.isReadmooDomain(null)).toBe(false)
      expect(PageDetectionUtils.isReadmooDomain('not-a-url')).toBe(false)
    })

    test('應該處理 undefined 參數使用當前 URL', () => {
      // 設定當前 URL 為 Readmoo
      updateMockLocation('https://readmoo.com/library')
      expect(PageDetectionUtils.isReadmooDomain(undefined)).toBe(true)

      // 設定當前 URL 為非 Readmoo
      updateMockLocation('https://amazon.com')
      expect(PageDetectionUtils.isReadmooDomain(undefined)).toBe(false)
    })

    test('應該使用當前頁面 URL 作為預設值', () => {
      updateMockLocation('https://readmoo.com/library')
      expect(PageDetectionUtils.isReadmooDomain()).toBe(true)
    })
  })

  describe('📄 頁面類型識別', () => {
    test('應該正確識別書庫頁面', () => {
      expect(PageDetectionUtils.getPageType('https://readmoo.com/library')).toBe('library')
      expect(PageDetectionUtils.getPageType('https://readmoo.com/library/bought')).toBe('library')
      expect(PageDetectionUtils.getPageType('https://readmoo.com/library/free')).toBe('library')
    })

    test('應該正確識別書架頁面', () => {
      expect(PageDetectionUtils.getPageType('https://readmoo.com/shelf')).toBe('shelf')
      expect(PageDetectionUtils.getPageType('https://readmoo.com/shelf/123')).toBe('shelf')
    })

    test('應該正確識別閱讀器頁面', () => {
      expect(PageDetectionUtils.getPageType('https://readmoo.com/read/123')).toBe('reader')
      expect(PageDetectionUtils.getPageType('https://readmoo.com/read/book-title')).toBe('reader')
    })

    test('應該回傳 unknown 對於無法識別的頁面', () => {
      expect(PageDetectionUtils.getPageType('https://readmoo.com/about')).toBe('unknown')
      expect(PageDetectionUtils.getPageType('https://readmoo.com/contact')).toBe('unknown')
      expect(PageDetectionUtils.getPageType('https://amazon.com')).toBe('unknown')
    })

    test('應該使用當前頁面 URL 作為預設值', () => {
      updateMockLocation('https://readmoo.com/library')
      expect(PageDetectionUtils.getPageType()).toBe('library')
    })
  })

  describe('📚 可提取性檢查', () => {
    test('應該確認書庫頁面可提取', () => {
      expect(PageDetectionUtils.isExtractablePage('library')).toBe(true)
    })

    test('應該確認書架頁面可提取', () => {
      expect(PageDetectionUtils.isExtractablePage('shelf')).toBe(true)
    })

    test('應該拒絕閱讀器頁面提取', () => {
      expect(PageDetectionUtils.isExtractablePage('reader')).toBe(false)
    })

    test('應該拒絕未知頁面提取', () => {
      expect(PageDetectionUtils.isExtractablePage('unknown')).toBe(false)
      expect(PageDetectionUtils.isExtractablePage('about')).toBe(false)
    })

    test('應該處理無效的頁面類型', () => {
      expect(PageDetectionUtils.isExtractablePage('')).toBe(false)
      expect(PageDetectionUtils.isExtractablePage(null)).toBe(false)
      expect(PageDetectionUtils.isExtractablePage(undefined)).toBe(false)
    })
  })

  describe('⏱️ 頁面準備狀態檢查', () => {
    test('應該檢查 DOM 是否完成載入', () => {
      global.document.readyState = 'complete'
      expect(PageDetectionUtils.isPageReady()).toBe(true)

      global.document.readyState = 'loading'
      expect(PageDetectionUtils.isPageReady()).toBe(false)

      global.document.readyState = 'interactive'
      expect(PageDetectionUtils.isPageReady()).toBe(false)
    })

    test('應該檢查關鍵元素是否存在', () => {
      // Mock querySelector 回傳書籍容器
      global.document.querySelector.mockReturnValue({ id: 'book-container' })
      expect(PageDetectionUtils.hasRequiredElements()).toBe(true)

      // Mock querySelector 回傳 null
      global.document.querySelector.mockReturnValue(null)
      expect(PageDetectionUtils.hasRequiredElements()).toBe(false)
    })

    test('應該等待頁面完全準備', async () => {
      global.document.readyState = 'complete'
      global.document.querySelector.mockReturnValue({ id: 'book-container' })

      // eslint-disable-next-line no-unused-vars
      const isReady = await PageDetectionUtils.waitForPageReady()
      expect(isReady).toBe(true)
    })

    test('應該在超時後回傳 false', async () => {
      global.document.readyState = 'loading'
      global.document.querySelector.mockReturnValue(null)

      // eslint-disable-next-line no-unused-vars
      const isReady = await PageDetectionUtils.waitForPageReady(100) // 100ms timeout
      expect(isReady).toBe(false)
    }, 200)
  })

  describe('🔍 URL 路徑分析', () => {
    test('應該正確解析 URL 路徑', () => {
      // eslint-disable-next-line no-unused-vars
      const urlInfo = PageDetectionUtils.parseUrl('https://readmoo.com/library/bought?page=2')

      expect(urlInfo).toEqual({
        hostname: 'readmoo.com',
        pathname: '/library/bought',
        search: '?page=2',
        pageType: 'library',
        isReadmoo: true,
        isExtractable: true
      })
    })

    test('應該處理沒有查詢參數的 URL', () => {
      // eslint-disable-next-line no-unused-vars
      const urlInfo = PageDetectionUtils.parseUrl('https://readmoo.com/shelf')

      expect(urlInfo).toEqual({
        hostname: 'readmoo.com',
        pathname: '/shelf',
        search: '',
        pageType: 'shelf',
        isReadmoo: true,
        isExtractable: true
      })
    })

    test('應該處理非 Readmoo URL', () => {
      // eslint-disable-next-line no-unused-vars
      const urlInfo = PageDetectionUtils.parseUrl('https://amazon.com/books')

      expect(urlInfo).toEqual({
        hostname: 'amazon.com',
        pathname: '/books',
        search: '',
        pageType: 'unknown',
        isReadmoo: false,
        isExtractable: false
      })
    })
  })

  describe('🚀 整合功能測試', () => {
    test('getCurrentPageInfo() 應該回傳完整的頁面資訊', () => {
      updateMockLocation('https://readmoo.com/library')
      global.document.readyState = 'complete'

      // eslint-disable-next-line no-unused-vars
      const pageInfo = PageDetectionUtils.getCurrentPageInfo()

      expect(pageInfo).toEqual({
        url: 'https://readmoo.com/library',
        hostname: 'readmoo.com',
        pathname: '/library',
        search: '',
        pageType: 'library',
        isReadmoo: true,
        isExtractable: true,
        isReady: true
      })
    })

    test('shouldActivateExtension() 應該正確判斷是否啟動擴展', () => {
      // Readmoo 可提取頁面，頁面已準備
      updateMockLocation('https://readmoo.com/library')
      global.document.readyState = 'complete'
      global.document.querySelector.mockReturnValue({ id: 'book-container' })

      expect(PageDetectionUtils.shouldActivateExtension()).toBe(true)

      // 非 Readmoo 頁面
      updateMockLocation('https://amazon.com')
      expect(PageDetectionUtils.shouldActivateExtension()).toBe(false)

      // Readmoo 不可提取頁面
      updateMockLocation('https://readmoo.com/read/123')
      expect(PageDetectionUtils.shouldActivateExtension()).toBe(false)
    })
  })

  describe('💾 快取機制測試', () => {
    test('應該快取檢測結果', () => {
      // 清空快取
      PageDetectionUtils.clearCache()

      // 第一次檢測
      // eslint-disable-next-line no-unused-vars
      const result1 = PageDetectionUtils.getPageType('https://readmoo.com/library')

      // 第二次檢測應該使用快取
      // eslint-disable-next-line no-unused-vars
      const result2 = PageDetectionUtils.getPageType('https://readmoo.com/library')

      expect(result1).toBe(result2)
      expect(result1).toBe('library')
    })

    test('應該支援清空快取', () => {
      PageDetectionUtils.getPageType('https://readmoo.com/library')
      PageDetectionUtils.clearCache()

      // 清空後應該重新檢測
      // eslint-disable-next-line no-unused-vars
      const result = PageDetectionUtils.getPageType('https://readmoo.com/shelf')
      expect(result).toBe('shelf')
    })
  })

  describe('⚠️ 錯誤處理', () => {
    test('應該安全處理 window 物件不存在的情況', () => {
      // eslint-disable-next-line no-unused-vars
      const originalWindow = global.window
      delete global.window

      expect(() => PageDetectionUtils.getCurrentPageInfo()).not.toThrow()

      global.window = originalWindow
    })

    test('應該安全處理 document 物件不存在的情況', () => {
      // eslint-disable-next-line no-unused-vars
      const originalDocument = global.document
      delete global.document

      expect(() => PageDetectionUtils.isPageReady()).not.toThrow()

      global.document = originalDocument
    })
  })
})
