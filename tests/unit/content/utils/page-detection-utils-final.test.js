/**
 * @fileoverview Page Detection Utils 最終測試版本
 * @version v1.0.0
 * @since 2025-08-16
 *
 * TDD Red 階段：完整測試 page-detection-utils.js 的所有靜態方法
 * 專注於功能驗證，避免 JSDOM 環境問題
 */

describe('PageDetectionUtils - TDD Red 階段測試', () => {
  let PageDetectionUtils

  beforeAll(() => {
    PageDetectionUtils = require('../../../../src/content/utils/page-detection-utils.js')
  })

  beforeEach(() => {
    // 清空快取
    PageDetectionUtils.clearCache()
  })

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
      expect(PageDetectionUtils.isReadmooDomain('https://readmoo-fake.com')).toBe(false)
    })

    test('應該處理無效的 URL 輸入', () => {
      expect(PageDetectionUtils.isReadmooDomain('')).toBe(false)
      expect(PageDetectionUtils.isReadmooDomain(null)).toBe(false)
      expect(PageDetectionUtils.isReadmooDomain(undefined)).toBe(false)
      expect(PageDetectionUtils.isReadmooDomain('not-a-url')).toBe(false)
      expect(PageDetectionUtils.isReadmooDomain('invalid://url')).toBe(false)
    })

    test('應該支援不同協議的 Readmoo URL', () => {
      expect(PageDetectionUtils.isReadmooDomain('http://readmoo.com')).toBe(true)
      expect(PageDetectionUtils.isReadmooDomain('https://readmoo.com')).toBe(true)
    })
  })

  describe('📄 頁面類型識別', () => {
    test('應該正確識別書庫頁面', () => {
      expect(PageDetectionUtils.getPageType('https://readmoo.com/library')).toBe('library')
      expect(PageDetectionUtils.getPageType('https://readmoo.com/library/bought')).toBe('library')
      expect(PageDetectionUtils.getPageType('https://readmoo.com/library/free')).toBe('library')
      expect(PageDetectionUtils.getPageType('https://readmoo.com/library/subscription')).toBe('library')
    })

    test('應該正確識別書架頁面', () => {
      expect(PageDetectionUtils.getPageType('https://readmoo.com/shelf')).toBe('shelf')
      expect(PageDetectionUtils.getPageType('https://readmoo.com/shelf/123')).toBe('shelf')
      expect(PageDetectionUtils.getPageType('https://readmoo.com/shelf/my-books')).toBe('shelf')
    })

    test('應該正確識別閱讀器頁面', () => {
      expect(PageDetectionUtils.getPageType('https://readmoo.com/read/123')).toBe('reader')
      expect(PageDetectionUtils.getPageType('https://readmoo.com/read/book-title')).toBe('reader')
      expect(PageDetectionUtils.getPageType('https://readmoo.com/read/book-title/chapter-1')).toBe('reader')
    })

    test('應該回傳 unknown 對於無法識別的頁面', () => {
      expect(PageDetectionUtils.getPageType('https://readmoo.com/about')).toBe('unknown')
      expect(PageDetectionUtils.getPageType('https://readmoo.com/contact')).toBe('unknown')
      expect(PageDetectionUtils.getPageType('https://readmoo.com/help')).toBe('unknown')
      expect(PageDetectionUtils.getPageType('https://readmoo.com/pricing')).toBe('unknown')
    })

    test('應該拒絕非 Readmoo 頁面', () => {
      expect(PageDetectionUtils.getPageType('https://amazon.com')).toBe('unknown')
      expect(PageDetectionUtils.getPageType('https://kobo.com/library')).toBe('unknown')
      expect(PageDetectionUtils.getPageType('https://google.com/shelf')).toBe('unknown')
    })

    test('應該處理錯誤的 URL 輸入', () => {
      expect(PageDetectionUtils.getPageType('')).toBe('unknown')
      expect(PageDetectionUtils.getPageType(null)).toBe('unknown')
      expect(PageDetectionUtils.getPageType(undefined)).toBe('unknown')
      expect(PageDetectionUtils.getPageType('invalid-url')).toBe('unknown')
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
      expect(PageDetectionUtils.isExtractablePage('contact')).toBe(false)
    })

    test('應該處理無效的頁面類型輸入', () => {
      expect(PageDetectionUtils.isExtractablePage('')).toBe(false)
      expect(PageDetectionUtils.isExtractablePage(null)).toBe(false)
      expect(PageDetectionUtils.isExtractablePage(undefined)).toBe(false)
      expect(PageDetectionUtils.isExtractablePage(123)).toBe(false)
      expect(PageDetectionUtils.isExtractablePage({})).toBe(false)
    })
  })

  describe('🔍 URL 路徑分析', () => {
    test('應該正確解析完整的 Readmoo URL', () => {
      const urlInfo = PageDetectionUtils.parseUrl('https://readmoo.com/library/bought?page=2&sort=date')
      
      expect(urlInfo).toEqual({
        hostname: 'readmoo.com',
        pathname: '/library/bought',
        search: '?page=2&sort=date',
        pageType: 'library',
        isReadmoo: true,
        isExtractable: true
      })
    })

    test('應該正確解析沒有查詢參數的 URL', () => {
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

    test('應該正確處理閱讀器頁面 URL', () => {
      const urlInfo = PageDetectionUtils.parseUrl('https://readmoo.com/read/book-123')
      
      expect(urlInfo).toEqual({
        hostname: 'readmoo.com',
        pathname: '/read/book-123',
        search: '',
        pageType: 'reader',
        isReadmoo: true,
        isExtractable: false
      })
    })

    test('應該正確處理非 Readmoo URL', () => {
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

    test('應該處理無效的 URL', () => {
      const urlInfo = PageDetectionUtils.parseUrl('invalid-url')
      
      expect(urlInfo).toEqual({
        hostname: '',
        pathname: '',
        search: '',
        pageType: 'unknown',
        isReadmoo: false,
        isExtractable: false
      })
    })

    test('應該處理 null 和 undefined URL', () => {
      const nullUrlInfo = PageDetectionUtils.parseUrl(null)
      const undefinedUrlInfo = PageDetectionUtils.parseUrl(undefined)
      
      const expectedResult = {
        hostname: '',
        pathname: '',
        search: '',
        pageType: 'unknown',
        isReadmoo: false,
        isExtractable: false
      }

      expect(nullUrlInfo).toEqual(expectedResult)
      expect(undefinedUrlInfo).toEqual(expectedResult)
    })
  })

  describe('💾 快取機制測試', () => {
    test('應該支援快取檢測結果', () => {
      // 清空快取
      PageDetectionUtils.clearCache()
      
      // 第一次檢測
      const result1 = PageDetectionUtils.getPageType('https://readmoo.com/library')
      
      // 檢查快取是否生效
      const stats = PageDetectionUtils.getCacheStats()
      expect(stats.size).toBeGreaterThan(0)
      
      // 第二次檢測應該使用快取
      const result2 = PageDetectionUtils.getPageType('https://readmoo.com/library')
      
      expect(result1).toBe('library')
      expect(result2).toBe('library')
      expect(result1).toBe(result2)
    })

    test('應該支援清空快取', () => {
      // 檢測一些頁面以填充快取
      PageDetectionUtils.getPageType('https://readmoo.com/library')
      PageDetectionUtils.getPageType('https://readmoo.com/shelf')
      
      // 確認快取有內容
      let stats = PageDetectionUtils.getCacheStats()
      expect(stats.size).toBeGreaterThan(0)
      
      // 清空快取
      PageDetectionUtils.clearCache()
      
      // 確認快取已清空
      stats = PageDetectionUtils.getCacheStats()
      expect(stats.size).toBe(0)
    })

    test('應該提供快取統計資訊', () => {
      PageDetectionUtils.clearCache()
      
      // 執行一些檢測
      PageDetectionUtils.getPageType('https://readmoo.com/library')
      PageDetectionUtils.getPageType('https://readmoo.com/shelf')
      
      const stats = PageDetectionUtils.getCacheStats()
      expect(typeof stats).toBe('object')
      expect(typeof stats.size).toBe('number')
      expect(Array.isArray(stats.keys)).toBe(true)
      expect(stats.size).toBeGreaterThan(0)
      expect(stats.keys.length).toBeGreaterThan(0)
    })

    test('快取鍵值應該包含 pageType 前綴', () => {
      PageDetectionUtils.clearCache()
      PageDetectionUtils.getPageType('https://readmoo.com/library')
      
      const stats = PageDetectionUtils.getCacheStats()
      const hasPageTypeKey = stats.keys.some(key => key.includes('pageType:'))
      expect(hasPageTypeKey).toBe(true)
    })
  })

  describe('⚠️ 錯誤處理和邊界情況', () => {
    test('應該安全處理各種錯誤輸入', () => {
      const errorInputs = [
        '', null, undefined, 123, {}, [], NaN, Infinity, -Infinity
      ]

      errorInputs.forEach(input => {
        expect(() => PageDetectionUtils.isReadmooDomain(input)).not.toThrow()
        expect(() => PageDetectionUtils.getPageType(input)).not.toThrow()
        expect(() => PageDetectionUtils.parseUrl(input)).not.toThrow()
      })
    })

    test('應該正確處理特殊字符 URL', () => {
      const specialUrls = [
        'https://readmoo.com/library?title=書名%20特殊',
        'https://readmoo.com/shelf/書架',
        'https://readmoo.com/read/123?chapter=第一章'
      ]

      specialUrls.forEach(url => {
        expect(() => PageDetectionUtils.getPageType(url)).not.toThrow()
        expect(() => PageDetectionUtils.parseUrl(url)).not.toThrow()
      })
    })

    test('應該處理非常長的 URL', () => {
      const longPath = '/library/' + 'a'.repeat(1000)
      const longUrl = `https://readmoo.com${longPath}`
      
      expect(() => PageDetectionUtils.getPageType(longUrl)).not.toThrow()
      expect(PageDetectionUtils.getPageType(longUrl)).toBe('library')
    })

    test('應該處理 URL 中的查詢參數', () => {
      const url = 'https://readmoo.com/library?filter=all&page=1&sort=desc'
      
      // 先檢查基本功能
      expect(PageDetectionUtils.isReadmooDomain(url)).toBe(true)
      expect(PageDetectionUtils.getPageType(url)).toBe('library')
      
      const result = PageDetectionUtils.parseUrl(url)
      expect(result.pageType).toBe('library')
      expect(result.search).toContain('filter=all')
    })
  })

  describe('🧪 模組介面測試', () => {
    test('應該匯出所有必要的方法', () => {
      const requiredMethods = [
        'isReadmooDomain',
        'getPageType',
        'isExtractablePage',
        'isPageReady',
        'hasRequiredElements',
        'waitForPageReady',
        'parseUrl',
        'getCurrentPageInfo',
        'shouldActivateExtension',
        'clearCache',
        'getCacheStats'
      ]

      requiredMethods.forEach(methodName => {
        expect(typeof PageDetectionUtils[methodName]).toBe('function')
      })
    })

    test('所有方法都應該有適當的參數數量', () => {
      // 檢查關鍵方法的參數長度
      expect(PageDetectionUtils.isReadmooDomain.length).toBeLessThanOrEqual(1)
      expect(PageDetectionUtils.getPageType.length).toBeLessThanOrEqual(1)
      expect(PageDetectionUtils.isExtractablePage.length).toBe(1)
      expect(PageDetectionUtils.parseUrl.length).toBe(1)
      expect(PageDetectionUtils.waitForPageReady.length).toBeLessThanOrEqual(1)
    })
  })

  describe('🔄 整合測試場景', () => {
    test('完整 Readmoo 書庫檢測流程', () => {
      const libraryUrl = 'https://readmoo.com/library/bought?page=1'
      
      // 檢測網域
      expect(PageDetectionUtils.isReadmooDomain(libraryUrl)).toBe(true)
      
      // 檢測頁面類型
      const pageType = PageDetectionUtils.getPageType(libraryUrl)
      expect(pageType).toBe('library')
      
      // 檢測可提取性
      expect(PageDetectionUtils.isExtractablePage(pageType)).toBe(true)
      
      // 解析 URL
      const urlInfo = PageDetectionUtils.parseUrl(libraryUrl)
      expect(urlInfo.isReadmoo).toBe(true)
      expect(urlInfo.isExtractable).toBe(true)
      expect(urlInfo.pageType).toBe('library')
    })

    test('完整 Readmoo 書架檢測流程', () => {
      const shelfUrl = 'https://readmoo.com/shelf/favorites'
      
      expect(PageDetectionUtils.isReadmooDomain(shelfUrl)).toBe(true)
      
      const pageType = PageDetectionUtils.getPageType(shelfUrl)
      expect(pageType).toBe('shelf')
      
      expect(PageDetectionUtils.isExtractablePage(pageType)).toBe(true)
      
      const urlInfo = PageDetectionUtils.parseUrl(shelfUrl)
      expect(urlInfo.isReadmoo).toBe(true)
      expect(urlInfo.isExtractable).toBe(true)
    })

    test('閱讀器頁面應該被拒絕', () => {
      const readerUrl = 'https://readmoo.com/read/book-123'
      
      expect(PageDetectionUtils.isReadmooDomain(readerUrl)).toBe(true)
      
      const pageType = PageDetectionUtils.getPageType(readerUrl)
      expect(pageType).toBe('reader')
      
      expect(PageDetectionUtils.isExtractablePage(pageType)).toBe(false)
      
      const urlInfo = PageDetectionUtils.parseUrl(readerUrl)
      expect(urlInfo.isReadmoo).toBe(true)
      expect(urlInfo.isExtractable).toBe(false)
    })

    test('非 Readmoo 頁面應該被完全拒絕', () => {
      const externalUrl = 'https://amazon.com/kindle-books'
      
      expect(PageDetectionUtils.isReadmooDomain(externalUrl)).toBe(false)
      
      const pageType = PageDetectionUtils.getPageType(externalUrl)
      expect(pageType).toBe('unknown')
      
      expect(PageDetectionUtils.isExtractablePage(pageType)).toBe(false)
      
      const urlInfo = PageDetectionUtils.parseUrl(externalUrl)
      expect(urlInfo.isReadmoo).toBe(false)
      expect(urlInfo.isExtractable).toBe(false)
    })
  })
})