/**
 * @fileoverview Page Detection Utils 完整功能測試
 * @version v1.0.0
 * @since 2025-08-16
 *
 * 測試 Red 階段：完整驗證 page-detection-utils.js 模組的所有功能
 */

describe('PageDetectionUtils - 完整功能測試', () => {
  let PageDetectionUtils

  beforeAll(() => {
    PageDetectionUtils = require('../../../../src/content/utils/page-detection-utils.js')
  })

  beforeEach(() => {
    // 設定基本的 DOM 環境
    global.window = {
      location: {
        href: 'https://readmoo.com/library',
        hostname: 'readmoo.com',
        pathname: '/library'
      }
    }

    global.document = {
      readyState: 'complete',
      querySelector: jest.fn(() => ({ id: 'book-container' }))
    }
  })

  // 測試輔助函數：更新 mock location
  const updateMockLocation = (href) => {
    try {
      const url = new URL(href)
      const mockLocation = {
        href,
        hostname: url.hostname,
        pathname: url.pathname,
        search: url.search || ''
      }
      
      // 更新全域 window.location 和 global.window.location
      Object.defineProperty(window, 'location', {
        writable: true,
        value: mockLocation
      })
      global.window.location = mockLocation
    } catch (error) {
      const mockLocation = {
        href,
        hostname: '',
        pathname: '',
        search: ''
      }
      Object.defineProperty(window, 'location', {
        writable: true,
        value: mockLocation
      })
      global.window.location = mockLocation
    }
  }

  // 測試輔助函數：設置 document.readyState
  const setDocumentReadyState = (state) => {
    Object.defineProperty(document, 'readyState', {
      writable: true,
      value: state
    })
  }

  describe('🌐 網域檢測功能', () => {
    test('應該正確檢測 Readmoo 網域', () => {
      expect(PageDetectionUtils.isReadmooDomain('https://readmoo.com/library')).toBe(true)
      expect(PageDetectionUtils.isReadmooDomain('https://www.readmoo.com/shelf')).toBe(true)
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

    test('應該使用當前頁面 URL 作為預設值', () => {
      // 使用 updateMockLocation 更新 mock 環境
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
      // 使用 updateMockLocation 更新 mock 環境
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
      // 測試 complete 狀態
      setDocumentReadyState('complete')
      expect(PageDetectionUtils.isPageReady()).toBe(true)

      // 測試 loading 狀態
      setDocumentReadyState('loading')
      expect(PageDetectionUtils.isPageReady()).toBe(false)

      // 測試 interactive 狀態
      setDocumentReadyState('interactive')
      expect(PageDetectionUtils.isPageReady()).toBe(false)
    })

    test('應該檢查關鍵元素是否存在', () => {
      // Mock querySelector 回傳書籍容器
      global.document.querySelector = jest.fn().mockReturnValue({ id: 'book-container' })
      expect(PageDetectionUtils.hasRequiredElements()).toBe(true)

      // Mock querySelector 回傳 null
      global.document.querySelector = jest.fn().mockReturnValue(null)
      expect(PageDetectionUtils.hasRequiredElements()).toBe(false)
    })

    test('應該等待頁面完全準備', async () => {
      global.document.readyState = 'complete'
      global.document.querySelector = jest.fn().mockReturnValue({ id: 'book-container' })

      const isReady = await PageDetectionUtils.waitForPageReady()
      expect(isReady).toBe(true)
    })

    test('應該在超時後回傳 false', async () => {
      global.document.readyState = 'loading'
      global.document.querySelector = jest.fn().mockReturnValue(null)

      const isReady = await PageDetectionUtils.waitForPageReady(100) // 100ms timeout
      expect(isReady).toBe(false)
    }, 200)
  })

  describe('🔍 URL 路徑分析', () => {
    test('應該正確解析 URL 路徑', () => {
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
      // 設定完整的 mock 環境
      updateMockLocation('https://readmoo.com/library')
      setDocumentReadyState('complete')

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
      // 設定 Readmoo 可提取頁面環境
      updateMockLocation('https://readmoo.com/library')
      setDocumentReadyState('complete')
      document.querySelector = jest.fn().mockReturnValue({ id: 'book-container' })

      expect(PageDetectionUtils.shouldActivateExtension()).toBe(true)

      // 測試沒有必要元素的情況
      global.document.querySelector = jest.fn().mockReturnValue(null)
      expect(PageDetectionUtils.shouldActivateExtension()).toBe(false)
    })
  })

  describe('💾 快取機制測試', () => {
    test('應該快取檢測結果', () => {
      // 清空快取
      PageDetectionUtils.clearCache()

      // 第一次檢測
      const result1 = PageDetectionUtils.getPageType('https://readmoo.com/library')

      // 第二次檢測應該使用快取
      const result2 = PageDetectionUtils.getPageType('https://readmoo.com/library')

      expect(result1).toBe(result2)
      expect(result1).toBe('library')
    })

    test('應該支援清空快取', () => {
      PageDetectionUtils.getPageType('https://readmoo.com/library')
      PageDetectionUtils.clearCache()

      // 清空後應該重新檢測
      const result = PageDetectionUtils.getPageType('https://readmoo.com/shelf')
      expect(result).toBe('shelf')
    })

    test('應該提供快取統計資訊', () => {
      PageDetectionUtils.clearCache()
      PageDetectionUtils.getPageType('https://readmoo.com/library')

      const stats = PageDetectionUtils.getCacheStats()
      expect(stats.size).toBeGreaterThan(0)
      expect(Array.isArray(stats.keys)).toBe(true)
    })
  })

  describe('⚠️ 錯誤處理', () => {
    test('應該安全處理 window 物件不存在的情況', () => {
      const originalWindow = global.window
      delete global.window

      expect(() => PageDetectionUtils.getCurrentPageInfo()).not.toThrow()

      global.window = originalWindow
    })

    test('應該安全處理 document 物件不存在的情況', () => {
      const originalDocument = global.document
      delete global.document

      expect(() => PageDetectionUtils.isPageReady()).not.toThrow()

      global.document = originalDocument
    })

    test('應該處理各種錯誤輸入', () => {
      expect(PageDetectionUtils.isReadmooDomain('')).toBe(false)
      expect(PageDetectionUtils.isReadmooDomain(null)).toBe(false)
      expect(PageDetectionUtils.getPageType('invalid-url')).toBe('unknown')
      expect(PageDetectionUtils.isExtractablePage('')).toBe(false)
    })
  })
})
