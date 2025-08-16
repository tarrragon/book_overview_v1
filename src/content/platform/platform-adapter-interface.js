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

/**
 * 平台適配器抽象介面
 * 
 * 所有平台適配器實作都必須繼承此介面並實作所有抽象方法
 */
class PlatformAdapterInterface {
  /**
   * 初始化平台適配器介面
   */
  constructor() {
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
  async getPageType() {
    throw new Error('Must implement getPageType()')
  }

  /**
   * 檢查當前頁面是否可提取資料
   * @returns {Promise<boolean>} 是否可提取
   * @abstract
   */
  async isExtractablePage() {
    throw new Error('Must implement isExtractablePage()')
  }

  /**
   * 檢查頁面是否已準備就緒
   * @returns {Promise<boolean>} 頁面是否準備就緒
   * @abstract
   */
  async checkPageReady() {
    throw new Error('Must implement checkPageReady()')
  }

  /**
   * 檢查當前網域是否為有效平台網域
   * @param {string} url - 要檢查的 URL (可選，預設使用當前頁面 URL)
   * @returns {boolean} 是否為有效網域
   * @abstract
   */
  isValidDomain(url = window.location.href) {
    throw new Error('Must implement isValidDomain()')
  }

  // ==================
  // 元素查找方法契約
  // ==================

  /**
   * 取得頁面中的所有書籍元素
   * @returns {NodeList|Array<Element>} 書籍元素列表
   * @abstract
   */
  getBookElements() {
    throw new Error('Must implement getBookElements()')
  }

  /**
   * 取得頁面中的書籍數量
   * @returns {number} 書籍數量
   * @abstract
   */
  getBookCount() {
    throw new Error('Must implement getBookCount()')
  }

  /**
   * 查找書籍容器元素
   * @returns {Element|null} 書籍容器元素
   * @abstract
   */
  findBookContainer() {
    throw new Error('Must implement findBookContainer()')
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
  parseBookElement(element) {
    throw new Error('Must implement parseBookElement()')
  }

  /**
   * 提取所有書籍資料
   * @returns {Promise<Array<Object>>} 書籍資料陣列
   * @abstract
   */
  async extractAllBooks() {
    throw new Error('Must implement extractAllBooks()')
  }

  /**
   * 從書籍元素提取完整資料
   * @param {Element} element - 書籍 DOM 元素
   * @returns {Object} 完整書籍資料
   * @abstract
   */
  extractBookData(element) {
    throw new Error('Must implement extractBookData()')
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
  sanitizeData(data) {
    throw new Error('Must implement sanitizeData()')
  }

  /**
   * 取得適配器統計資訊
   * @returns {Object} 統計資訊
   * @abstract
   */
  getStats() {
    throw new Error('Must implement getStats()')
  }

  /**
   * 重置適配器狀態
   * @abstract
   */
  reset() {
    throw new Error('Must implement reset()')
  }

  // ==================
  // 介面工具方法
  // ==================

  /**
   * 取得適配器描述資訊
   * @returns {string} 適配器描述
   */
  toString() {
    return `PlatformAdapterInterface[${this.platformName}] v${this.version}`
  }

  /**
   * 驗證實作是否完整
   * 檢查所有抽象方法是否已被正確實作
   * @returns {boolean} 是否實作完整
   */
  validateImplementation() {
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
      'reset'
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
  getInterfaceInfo() {
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
        'reset'
      ]
    }
  }
}

// CommonJS 匯出
module.exports = PlatformAdapterInterface