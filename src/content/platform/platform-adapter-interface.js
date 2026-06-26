/**
 * @fileoverview Platform Adapter Interface - 平台適配器抽象介面
 * @version v1.0.0
 * @since 2025-08-16
 *
 * 負責功能：
 * - 定義通用的平台適配器契約
 * - 抽象化頁面檢測、DOM 解析、資料提取介面
 * - 為未來多平台擴展提供統一接口
 * - 確保 Readmoo 實作符合通用標準
 *
 * 設計考量：
 * - 基於抽象基類設計，強制實作必要方法
 * - 提供清楚的錯誤訊息指導實作
 * - 支援 v1.0 Readmoo 實作和未來多平台擴展
 * - 遵循 Liskov 替換原則和開放封閉原則
 *
 * 使用情境：
 * - 作為所有平台適配器的基類
 * - 定義平台實作的必要方法契約
 * - 提供介面規範和實作指導
 * - 確保平台實作的一致性和可替換性
 */

// 引入錯誤處理系統
const ErrorCodes = require('src/core/errors/ErrorCodes')

/**
 * 平台適配器抽象介面
 *
 * 所有平台適配器實作都必須繼承此介面並實作所有抽象方法
 */
class PlatformAdapterInterface {
  /**
   * 初始化平台適配器介面
   */
  constructor () {
    this.platformName = 'Abstract'
    this.version = '1.0.0'
    this.initializationTime = Date.now()
  }

  // ==================
  // 頁面檢測方法契約
  // ==================

  /**
   * 取得當前頁面類型
   * @returns {Promise<string>} 頁面類型 ('library', 'shelf', 'reader', 'unknown')
   * @abstract
   */
  async getPageType () {
    throw (() => {
      const error = new Error('Must implement getPageType()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      error.details = {
        method: 'getPageType',
        class: 'PlatformAdapterInterface'
      }
      return error
    })()
  }

  /**
   * 檢查當前頁面是否可提取資料
   * @returns {Promise<boolean>} 是否可提取
   * @abstract
   */
  async isExtractablePage () {
    throw (() => {
      const error = new Error('Must implement isExtractablePage()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      error.details = {
        method: 'isExtractablePage',
        class: 'PlatformAdapterInterface'
      }
      return error
    })()
  }

  /**
   * 檢查頁面是否已準備就緒
   * @returns {Promise<boolean>} 頁面是否準備就緒
   * @abstract
   */
  async checkPageReady () {
    throw (() => {
      const error = new Error('Must implement checkPageReady()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      return error
    })()
  }

  /**
   * 檢查當前網域是否為有效平台網域
   * @param {string} url - 要檢查的 URL (可選，預設使用當前頁面 URL)
   * @returns {boolean} 是否為有效網域
   * @abstract
   */
  isValidDomain (url = window.location.href) {
    throw (() => {
      const error = new Error('Must implement isValidDomain()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      return error
    })()
  }

  // ==================
  // 元素查找方法契約
  // ==================

  /**
   * 取得頁面中的所有書籍元素
   * @returns {NodeList|Array<Element>} 書籍元素列表
   * @abstract
   */
  getBookElements () {
    throw (() => {
      const error = new Error('Must implement getBookElements()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      return error
    })()
  }

  /**
   * 取得頁面中的書籍數量
   * @returns {number} 書籍數量
   * @abstract
   */
  getBookCount () {
    throw (() => {
      const error = new Error('Must implement getBookCount()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      return error
    })()
  }

  /**
   * 查找書籍容器元素
   * @returns {Element|null} 書籍容器元素
   * @abstract
   */
  findBookContainer () {
    throw (() => {
      const error = new Error('Must implement findBookContainer()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      return error
    })()
  }

  // ==================
  // 資料提取方法契約
  // ==================

  /**
   * 解析單一書籍元素
   * @param {Element} element - 書籍 DOM 元素
   * @returns {Object} 書籍資料物件
   * @abstract
   */
  parseBookElement (element) {
    throw (() => {
      const error = new Error('Must implement parseBookElement()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      return error
    })()
  }

  /**
   * 提取所有書籍資料
   * @returns {Promise<Array<Object>>} 書籍資料陣列
   * @abstract
   */
  async extractAllBooks () {
    throw (() => {
      const error = new Error('Must implement extractAllBooks()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      return error
    })()
  }

  /**
   * 從書籍元素提取完整資料
   * @param {Element} element - 書籍 DOM 元素
   * @returns {Object} 完整書籍資料
   * @abstract
   */
  extractBookData (element) {
    throw (() => {
      const error = new Error('Must implement extractBookData()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      return error
    })()
  }

  // ==================
  // 工具方法契約
  // ==================

  /**
   * 清理和驗證資料
   * @param {Object} data - 要清理的資料
   * @returns {Object} 清理後的資料
   * @abstract
   */
  sanitizeData (data) {
    throw (() => {
      const error = new Error('Must implement sanitizeData()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      return error
    })()
  }

  /**
   * 取得適配器統計資訊
   * @returns {Object} 統計資訊
   * @abstract
   */
  getStats () {
    throw (() => {
      const error = new Error('Must implement getStats()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      return error
    })()
  }

  /**
   * 重置適配器狀態
   * @abstract
   */
  reset () {
    throw (() => {
      const error = new Error('Must implement reset()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      return error
    })()
  }

  // ==================
  // 平台識別方法契約
  // ==================

  /**
   * 取得平台名稱
   * @returns {string} 平台名稱 (如 'Readmoo', 'Books')
   * @abstract
   */
  getPlatformName () {
    throw (() => {
      const error = new Error('Must implement getPlatformName()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      return error
    })()
  }

  /**
   * 取得平台書庫頁面 URL
   * @returns {string} 書庫 URL
   * @abstract
   */
  getLibraryUrl () {
    throw (() => {
      const error = new Error('Must implement getLibraryUrl()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      return error
    })()
  }

  /**
   * 平台是否需要登入才能提取書庫
   * @returns {boolean} 是否需要登入
   * @abstract
   */
  requiresLogin () {
    throw (() => {
      const error = new Error('Must implement requiresLogin()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      return error
    })()
  }

  /**
   * 取得判斷登入狀態的 DOM 選擇器
   * @returns {string|null} 登入檢查選擇器，無則回傳 null
   * @abstract
   */
  getLoginCheckSelector () {
    throw (() => {
      const error = new Error('Must implement getLoginCheckSelector()')
      error.code = ErrorCodes.NOT_IMPLEMENTED
      return error
    })()
  }

  // ==================
  // 通用捲動載入 Helper（protected，子類可沿用或覆寫）
  // ==================

  /**
   * 捲動頁面一段距離以觸發 lazy 載入
   * @param {number} distance - 捲動距離（像素）
   * @returns {Promise<void>}
   * @protected
   */
  async _scrollStep (distance = 800) {
    if (typeof window !== 'undefined' && typeof window.scrollBy === 'function') {
      window.scrollBy(0, distance)
    }
  }

  /**
   * 等待頁面渲染穩定
   * @param {number} delayMs - 等待毫秒數
   * @returns {Promise<void>}
   * @protected
   */
  async waitForRenderSettle (delayMs = 500) {
    return new Promise(resolve => setTimeout(resolve, delayMs))
  }

  /**
   * 等待書籍元素出現
   * @param {number} timeoutMs - 逾時毫秒數
   * @param {number} intervalMs - 輪詢間隔毫秒數
   * @returns {Promise<NodeList|Array<Element>>} 書籍元素列表
   * @protected
   */
  async waitForBookElements (timeoutMs = 5000, intervalMs = 200) {
    const startTime = Date.now()
    while (Date.now() - startTime < timeoutMs) {
      if (this.getBookCount() > 0) {
        return this.getBookElements()
      }
      await this.waitForRenderSettle(intervalMs)
    }
    return this.getBookElements()
  }

  /**
   * 透過反覆捲動載入所有書籍（lazy load）
   * @param {Object} options - 載入選項
   * @param {number} [options.maxScrolls=50] - 最大捲動次數
   * @param {number} [options.scrollDistance=800] - 每次捲動距離
   * @param {number} [options.settleDelayMs=500] - 每次捲動後等待毫秒數
   * @returns {Promise<NodeList|Array<Element>>} 所有書籍元素
   * @protected
   */
  async loadAllBooksLazy (options = {}) {
    const { maxScrolls = 50, scrollDistance = 800, settleDelayMs = 500 } = options
    let previousCount = -1
    let currentCount = this.getBookCount()
    let scrollAttempts = 0
    while (currentCount !== previousCount && scrollAttempts < maxScrolls) {
      previousCount = currentCount
      await this._scrollStep(scrollDistance)
      await this.waitForRenderSettle(settleDelayMs)
      currentCount = this.getBookCount()
      scrollAttempts++
    }
    return this.getBookElements()
  }

  // ==================
  // 介面工具方法
  // ==================

  /**
   * 取得適配器描述資訊
   * @returns {string} 適配器描述
   */
  toString () {
    return `PlatformAdapterInterface[${this.platformName}] v${this.version}`
  }

  /**
   * 驗證實作是否完整
   * 檢查所有抽象方法是否已被正確實作
   * @returns {boolean} 是否實作完整
   */
  validateImplementation () {
    const abstractMethods = [
      'getPageType',
      'isExtractablePage',
      'checkPageReady',
      'isValidDomain',
      'getBookElements',
      'getBookCount',
      'findBookContainer',
      'parseBookElement',
      'extractAllBooks',
      'extractBookData',
      'sanitizeData',
      'getStats',
      'reset',
      'getPlatformName',
      'getLibraryUrl',
      'requiresLogin',
      'getLoginCheckSelector'
    ]

    for (const methodName of abstractMethods) {
      try {
        // 對於非異步方法，直接呼叫測試
        if (!['getPageType', 'isExtractablePage', 'checkPageReady', 'extractAllBooks'].includes(methodName)) {
          if (methodName === 'parseBookElement' || methodName === 'extractBookData') {
            this[methodName](document.createElement('div'))
          } else if (methodName === 'sanitizeData') {
            this[methodName]({})
          } else {
            this[methodName]()
          }
        }
        return false // 如果沒有拋出錯誤，表示未正確實作
      } catch (error) {
        if (error.message.includes('Must implement')) {
          return false // 發現未實作的方法
        }
      }
    }
    return true // 所有方法都已實作
  }

  /**
   * 取得介面版本資訊
   * @returns {Object} 版本資訊
   */
  getInterfaceInfo () {
    return {
      interfaceName: 'PlatformAdapterInterface',
      version: this.version,
      platformName: this.platformName,
      initializationTime: this.initializationTime,
      requiredMethods: [
        'getPageType',
        'isExtractablePage',
        'checkPageReady',
        'isValidDomain',
        'getBookElements',
        'getBookCount',
        'findBookContainer',
        'parseBookElement',
        'extractAllBooks',
        'extractBookData',
        'sanitizeData',
        'getStats',
        'reset',
        'getPlatformName',
        'getLibraryUrl',
        'requiresLogin',
        'getLoginCheckSelector'
      ]
    }
  }
}

// CommonJS 匯出
module.exports = PlatformAdapterInterface
