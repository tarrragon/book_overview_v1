/**
 * @fileoverview Page Detection Utils - 頁面檢測工具
 * @version v1.0.0
 * @since 2025-08-16
 *
 * 負責功能：
 * - Readmoo 網域檢測
 * - 頁面類型識別 (library/shelf/reader)
 * - URL 和路徑分析
 * - 頁面準備狀態檢查
 *
 * 設計考量：
 * - 純工具函數，無副作用
 * - 支援快取機制提升效能
 * - 提供完整的錯誤處理
 * - Content Script 環境優化
 *
 * 使用情境：
 * - 判斷是否在 Readmoo 頁面
 * - 決定是否啟動資料提取
 * - 頁面導航和狀態檢測
 * - 條件性初始化邏輯
 */

/**
 * 頁面檢測工具類
 */
class PageDetectionUtils {
  constructor () {
    this.cache = new Map()
    this.urlPatterns = {
      readmoo: /^https?:\/\/(?:[\w-]+\.)*readmoo\.com/i,
      library: /\/library(?:\/|$|\?)/i,
      shelf: /\/shelf(?:\/|$|\?)/i,
      reader: /\/read(?:\/|$|\?)/i
    }
  }

  /**
   * 檢查是否為 Readmoo 網域
   * @param {string} url - 要檢查的 URL (可選，預設使用當前頁面)
   * @returns {boolean} 是否為 Readmoo 網域
   */
  isReadmooDomain (url) {
    // 如果沒有提供 URL，使用當前頁面 URL
    if (url === undefined) {
      url = this._getCurrentUrl()
    }

    if (!url || typeof url !== 'string') {
      return false
    }

    try {
      return this.urlPatterns.readmoo.test(url)
    } catch (error) {
      return false
    }
  }

  /**
   * 取得頁面類型
   * @param {string} url - 要分析的 URL (可選，預設使用當前頁面)
   * @returns {string} 頁面類型 ('library', 'shelf', 'reader', 'unknown')
   */
  getPageType (url) {
    // 如果沒有提供 URL，使用當前頁面 URL
    if (url === undefined) {
      url = this._getCurrentUrl()
    }

    if (!url || typeof url !== 'string') {
      return 'unknown'
    }

    // 檢查快取
    const cacheKey = `pageType:${url}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    let pageType = 'unknown'

    try {
      // 必須是 Readmoo 網域
      if (!this.isReadmooDomain(url)) {
        pageType = 'unknown'
      } else if (this.urlPatterns.library.test(url)) {
        pageType = 'library'
      } else if (this.urlPatterns.shelf.test(url)) {
        pageType = 'shelf'
      } else if (this.urlPatterns.reader.test(url)) {
        pageType = 'reader'
      }
    } catch (error) {
      pageType = 'unknown'
    }

    // 儲存到快取
    this.cache.set(cacheKey, pageType)
    return pageType
  }

  /**
   * 檢查頁面是否可提取資料
   * @param {string} pageType - 頁面類型
   * @returns {boolean} 是否可提取
   */
  isExtractablePage (pageType) {
    if (!pageType || typeof pageType !== 'string') {
      return false
    }

    const extractableTypes = ['library', 'shelf']
    return extractableTypes.includes(pageType)
  }

  /**
   * 檢查頁面是否已準備就緒
   * @returns {boolean} 頁面是否準備就緒
   */
  isPageReady () {
    try {
      if (typeof document === 'undefined') {
        return false
      }

      return document.readyState === 'complete'
    } catch (error) {
      return false
    }
  }

  /**
   * 檢查是否存在必要的頁面元素
   * @returns {boolean} 是否存在必要元素
   */
  hasRequiredElements () {
    try {
      if (typeof document === 'undefined') {
        return false
      }

      // 檢查常見的書籍容器元素
      const bookContainers = [
        '[data-book-id]',
        '.book-item',
        '.shelf-book',
        '.library-book',
        '[class*="book"]',
        '[id*="book"]'
      ]

      for (const selector of bookContainers) {
        if (document.querySelector(selector)) {
          return true
        }
      }

      return false
    } catch (error) {
      return false
    }
  }

  /**
   * 等待頁面完全準備
   * @param {number} timeout - 超時時間 (毫秒)
   * @returns {Promise<boolean>} 是否準備完成
   */
  async waitForPageReady (timeout = 10000) {
    const startTime = Date.now()

    return new Promise((resolve) => {
      const checkReady = () => {
        if (this.isPageReady() && this.hasRequiredElements()) {
          resolve(true)
          return
        }

        if (Date.now() - startTime >= timeout) {
          resolve(false)
          return
        }

        setTimeout(checkReady, 100)
      }

      checkReady()
    })
  }

  /**
   * 解析 URL 並回傳詳細資訊
   * @param {string} url - 要解析的 URL
   * @returns {Object} URL 資訊物件
   */
  parseUrl (url) {
    try {
      const urlObj = new URL(url)
      const pageType = this.getPageType(url)

      return {
        hostname: urlObj.hostname,
        pathname: urlObj.pathname,
        search: urlObj.search,
        pageType,
        isReadmoo: this.isReadmooDomain(url),
        isExtractable: this.isExtractablePage(pageType)
      }
    } catch (error) {
      return {
        hostname: '',
        pathname: '',
        search: '',
        pageType: 'unknown',
        isReadmoo: false,
        isExtractable: false
      }
    }
  }

  /**
   * 取得當前頁面的完整資訊
   * @returns {Object} 頁面資訊物件
   */
  getCurrentPageInfo () {
    const url = this._getCurrentUrl()
    const urlInfo = this.parseUrl(url)

    return {
      url,
      ...urlInfo,
      isReady: this.isPageReady()
    }
  }

  /**
   * 判斷是否應該啟動擴展功能
   * @returns {boolean} 是否應該啟動
   */
  shouldActivateExtension () {
    try {
      const pageInfo = this.getCurrentPageInfo()

      return pageInfo.isReadmoo &&
             pageInfo.isExtractable &&
             pageInfo.isReady &&
             this.hasRequiredElements()
    } catch (error) {
      return false
    }
  }

  /**
   * 清空檢測結果快取
   */
  clearCache () {
    this.cache.clear()
  }

  /**
   * 取得快取統計資訊
   * @returns {Object} 快取統計
   */
  getCacheStats () {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  // ==================
  // 私有輔助方法
  // ==================

  /**
   * 安全地取得當前頁面 URL
   * @returns {string} 當前 URL
   * @private
   */
  _getCurrentUrl () {
    try {
      if (typeof window !== 'undefined' && window.location) {
        return window.location.href
      }
      return ''
    } catch (error) {
      return ''
    }
  }

  /**
   * 取得當前 hostname
   * @returns {string} 當前 hostname
   * @private
   */
  _getCurrentHostname () {
    try {
      if (typeof window !== 'undefined' && window.location) {
        return window.location.hostname
      }
      return ''
    } catch (error) {
      return ''
    }
  }

  /**
   * 取得當前 pathname
   * @returns {string} 當前 pathname
   * @private
   */
  _getCurrentPathname () {
    try {
      if (typeof window !== 'undefined' && window.location) {
        return window.location.pathname
      }
      return ''
    } catch (error) {
      return ''
    }
  }
}

// 建立單例實例
const pageDetectionUtils = new PageDetectionUtils()

// 匯出靜態方法介面
module.exports = {
  isReadmooDomain: (url) => pageDetectionUtils.isReadmooDomain(url),
  getPageType: (url) => pageDetectionUtils.getPageType(url),
  isExtractablePage: (pageType) => pageDetectionUtils.isExtractablePage(pageType),
  isPageReady: () => pageDetectionUtils.isPageReady(),
  hasRequiredElements: () => pageDetectionUtils.hasRequiredElements(),
  waitForPageReady: (timeout) => pageDetectionUtils.waitForPageReady(timeout),
  parseUrl: (url) => pageDetectionUtils.parseUrl(url),
  getCurrentPageInfo: () => pageDetectionUtils.getCurrentPageInfo(),
  shouldActivateExtension: () => pageDetectionUtils.shouldActivateExtension(),
  clearCache: () => pageDetectionUtils.clearCache(),
  getCacheStats: () => pageDetectionUtils.getCacheStats()
}
