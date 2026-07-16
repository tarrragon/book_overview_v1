/**
 * @fileoverview Kobo Adapter - Kobo 樂天書城電子書平台適配器
 * @version v1.0.0
 * @since 2026-07-14
 *
 * 負責功能：
 * - Kobo 台灣站書庫頁（www.kobo.com/tw/zh/library/books）的書籍資料提取
 * - DOM 解析（書名 / 作者 / 類別 / 系列 / 閱讀狀態 / 新增日期 / 封面 / slug / readnow UUID）
 * - 安全性過濾（javascript: / data: URL 攔截、HTML 標籤移除）
 *
 * 設計考量：
 * - 繼承 PlatformAdapterInterface，實作 17 個抽象方法（Liskov 替換）
 * - v1.6.0 W2 僅解析當前頁面；SSR 分頁（pageSize + pageNumber 翻頁）留待 1.6.0-W3-001
 * - hostname 採邊界比對，避免 evilkobo.com 誤判為 kobo.com
 *
 * 資料來源勘查：docs/bookstores/kobo.md
 */

const PlatformAdapterInterface = require('../platform/platform-adapter-interface')
const { Logger } = require('src/core/logging/Logger')
const { MessageDictionary } = require('src/core/messages/MessageDictionary')

/**
 * Kobo 適配器專屬訊息字典（W1-107 module-specific local dict 模式）
 *
 * Business context: 與 books-com-tw-adapter 相同，將提取層訊息與 GlobalMessages
 * 解耦，避免跨模組詞彙污染共用字典。
 */
const koboAdapterMessages = new MessageDictionary({
  KOBO_INIT: 'Kobo 適配器初始化完成',
  KOBO_EXTRACT_START: '開始提取 Kobo 書庫，初始書籍數：{count}',
  KOBO_EXTRACT_DONE: 'Kobo 書庫提取完成，成功 {success} / 失敗 {fail}',
  KOBO_BOOK_PARSE_FAILED: '單一書籍解析失敗：{reason}',
  KOBO_PAGE_FETCH_FAILED: '第 {page} 頁提取失敗，停止分頁：{reason}'
})

/**
 * Kobo 書城識別碼
 */
const PLATFORM_NAME = 'kobo'

/**
 * Kobo 書庫頁 URL（台灣站）
 */
const LIBRARY_URL = 'https://www.kobo.com/tw/zh/library/books'

/**
 * Kobo 書庫頁有效域名（邊界比對用）
 */
const VALID_HOSTNAME = 'kobo.com'

/**
 * Kobo 書庫頁 pathname 特徵（判斷是否為書庫頁）
 */
const LIBRARY_PATH_SEGMENT = '/library/books'

/**
 * DOM 選擇器配置（對齊 docs/bookstores/kobo.md 勘查結果）
 */
const SELECTORS = {
  bookContainer: '[aria-label="書籍"]',
  bookItem: 'li.item-wrapper.book',
  bookTitle: '.title.product-field',
  bookTitleLink: '.title.product-field a[href*="/ebook/"]',
  bookAuthor: '.contributor-name',
  bookCover: '.cover-image.book-image',
  bookGenre: '.genre.product-field',
  bookStatus: '.item-status-field',
  bookSeries: 'a[href*="/series/"]',
  readnowLink: 'a[href*="readnow.kobo.com/"]'
}

/**
 * 新增日期文字格式（YYYY/M/D）
 */
const DATE_ADDED_PATTERN = /\d{4}\/\d{1,2}\/\d{1,2}/

/**
 * 作者欄位分隔符
 */
const AUTHOR_SEPARATOR = '、'

/**
 * 安全 URL 協定白名單
 */
const SAFE_URL_PROTOCOLS = ['https:', 'http:']

/**
 * SSR 分頁每頁書籍數（Kobo 書庫頁固定值）
 */
const PAGE_SIZE = 60

/**
 * SSR 分頁硬上限（防止篩選器數字異常導致無限迴圈）
 */
const MAX_PAGES = 100

/**
 * 篩選器總筆數選擇器（「所有項目 (N)」文字所在元素）
 */
const FILTER_CHIP_SELECTOR = '.filter-chip'

/**
 * 篩選器文字中的總筆數格式（括號內數字）
 */
const TOTAL_COUNT_PATTERN = /\((\d+)\)/

/**
 * Content Script 背景 fetch 訊息類型（對應 1.6.0-W3-001.1 handler）
 */
const FETCH_PAGE_HTML_MESSAGE_TYPE = 'CONTENT.FETCH.PAGE_HTML'

/**
 * Kobo 電子書平台適配器
 *
 * @extends PlatformAdapterInterface
 */
class KoboAdapter extends PlatformAdapterInterface {
  /**
   * @param {Object} [options] - 適配器選項（預留擴充）
   */
  constructor (options = {}) {
    super()
    this.platformName = PLATFORM_NAME
    this.options = options
    this.logger = new Logger('KoboAdapter', 'INFO', koboAdapterMessages)
    this._stats = this._createEmptyStats()
    this.logger.info('KOBO_INIT')
  }

  /**
   * 建立初始統計物件
   * @returns {{ totalExtracted: number, successCount: number, failCount: number }}
   * @private
   */
  _createEmptyStats () {
    return { totalExtracted: 0, successCount: 0, failCount: 0 }
  }

  // ==================
  // 平台識別方法
  // ==================

  getPlatformName () {
    return PLATFORM_NAME
  }

  getLibraryUrl () {
    return LIBRARY_URL
  }

  requiresLogin () {
    return true
  }

  getLoginCheckSelector () {
    return SELECTORS.bookContainer
  }

  // ==================
  // 頁面檢測方法
  // ==================

  /**
   * 檢查域名是否為 Kobo
   * @param {string} [url] - 待檢查 URL
   * @returns {boolean}
   */
  isValidDomain (url) {
    const target = typeof url === 'string' ? url : this._currentUrl()
    let hostname
    try {
      hostname = new URL(target).hostname.toLowerCase()
    } catch (error) {
      // 設計性靜默：無法解析的 URL（空字串 / 'not-a-url'）即非有效 Kobo 域名
      return false
    }
    return hostname === VALID_HOSTNAME || hostname.endsWith(`.${VALID_HOSTNAME}`)
  }

  /**
   * 判斷頁面類型
   * @param {string} [url] - 待判斷 URL
   * @returns {Promise<string>} 'library' 或 'unknown'
   */
  async getPageType (url) {
    const target = typeof url === 'string' ? url : this._currentUrl()
    try {
      const pathname = new URL(target).pathname
      return pathname.includes(LIBRARY_PATH_SEGMENT) ? 'library' : 'unknown'
    } catch (error) {
      // 設計性靜默：URL 無法解析時視為非書庫頁
      return 'unknown'
    }
  }

  /**
   * 判斷頁面是否可提取
   * @param {string} [url] - 待判斷 URL
   * @returns {Promise<boolean>}
   */
  async isExtractablePage (url) {
    return (await this.getPageType(url)) === 'library'
  }

  /**
   * 等待書庫容器出現
   * @returns {Promise<boolean>}
   */
  async checkPageReady () {
    await this.waitForBookElements()
    return this.findBookContainer() !== null
  }

  // ==================
  // 元素查找方法
  // ==================

  findBookContainer () {
    if (typeof document === 'undefined') {
      return null
    }
    return document.querySelector(SELECTORS.bookContainer)
  }

  getBookElements () {
    if (typeof document === 'undefined') {
      return []
    }
    return Array.from(document.querySelectorAll(SELECTORS.bookItem))
  }

  getBookCount () {
    return this.getBookElements().length
  }

  // ==================
  // 資料提取方法
  // ==================

  /**
   * 解析單一書籍元素
   * @param {Element} element - li.item-wrapper.book 元素
   * @returns {Object} 書籍資料物件
   */
  parseBookElement (element) {
    return {
      bookId: this._extractBookId(element),
      title: this._extractText(element, SELECTORS.bookTitle),
      author: this._extractAuthors(element),
      coverUrl: this._extractCoverUrl(element),
      genre: this._extractText(element, SELECTORS.bookGenre),
      readStatus: this._extractText(element, SELECTORS.bookStatus),
      dateAdded: this._extractDateAdded(element),
      series: this._extractText(element, SELECTORS.bookSeries),
      readNowId: this._extractReadNowId(element),
      source: PLATFORM_NAME
    }
  }

  /**
   * 從書籍元素提取完整資料（含安全性過濾）
   * @param {Element} element - 書籍 DOM 元素
   * @returns {Object} 清理後書籍資料
   */
  extractBookData (element) {
    return this.sanitizeData(this.parseBookElement(element))
  }

  /**
   * 提取所有書籍（含 SSR 分頁翻頁）
   *
   * 先解析當前頁面，再依篩選器總筆數計算總頁數，翻頁 fetch 剩餘頁面並彙整。
   *
   * @returns {Promise<Array<Object>>} 書籍資料陣列
   */
  async extractAllBooks () {
    await this.checkPageReady()
    this.logger.info('KOBO_EXTRACT_START', { count: this.getBookCount() })

    const books = []
    for (const element of this.getBookElements()) {
      this._stats.totalExtracted += 1
      try {
        books.push(this.extractBookData(element))
        this._stats.successCount += 1
      } catch (error) {
        this._stats.failCount += 1
        this.logger.warn('KOBO_BOOK_PARSE_FAILED', { reason: error.message })
      }
    }

    await this._extractRemainingPages(books)

    this.logger.info('KOBO_EXTRACT_DONE', {
      success: this._stats.successCount,
      fail: this._stats.failCount
    })
    return books
  }

  /**
   * 翻頁 fetch 剩餘頁面並彙整至 books
   *
   * 停止條件：頁碼超過總頁數 / 該頁解析出 0 本 / fetch 失敗 / 超過 MAX_PAGES 硬上限。
   *
   * @param {Array<Object>} books - 已提取書籍陣列（原地追加）
   * @returns {Promise<void>}
   * @private
   */
  async _extractRemainingPages (books) {
    const totalCount = this._extractTotalCount()
    const totalPages = Math.ceil(totalCount / PAGE_SIZE)
    const lastPage = Math.min(totalPages, MAX_PAGES)

    for (let pageNumber = 2; pageNumber <= lastPage; pageNumber += 1) {
      let html
      try {
        html = await this._fetchPageHtml(this._buildPageUrl(pageNumber))
      } catch (error) {
        this.logger.warn('KOBO_PAGE_FETCH_FAILED', { page: pageNumber, reason: error.message })
        break
      }

      const pageBooks = this._parseHtmlToBooks(html)
      if (pageBooks.length === 0) {
        break
      }
      books.push(...pageBooks)
      this._stats.totalExtracted += pageBooks.length
      this._stats.successCount += pageBooks.length
    }
  }

  // ==================
  // 工具方法
  // ==================

  /**
   * 清理書籍資料（XSS 防護）
   * @param {Object} data - 待清理資料
   * @returns {Object} 清理後資料
   */
  sanitizeData (data) {
    const sanitized = { ...data }
    if (typeof sanitized.coverUrl === 'string') {
      sanitized.coverUrl = this._sanitizeUrl(sanitized.coverUrl)
    }
    if (typeof sanitized.title === 'string') {
      sanitized.title = this._stripHtml(sanitized.title)
    }
    if (typeof sanitized.author === 'string') {
      sanitized.author = this._stripHtml(sanitized.author)
    }
    return sanitized
  }

  getStats () {
    return { ...this._stats }
  }

  reset () {
    this._stats = this._createEmptyStats()
  }

  // ==================
  // 私有解析 helper
  // ==================

  /**
   * 從容器取指定選擇器的文字內容
   * @param {Element} element - 容器元素
   * @param {string} selector - 子元素選擇器
   * @returns {string} 去除頭尾空白的文字，找不到回傳空字串
   * @private
   */
  _extractText (element, selector) {
    if (!element || typeof element.querySelector !== 'function') {
      return ''
    }
    const target = element.querySelector(selector)
    return target ? target.textContent.trim() : ''
  }

  /**
   * 提取所有作者/譯者名稱並以頓號連接
   * @param {Element} element - 書籍元素
   * @returns {string}
   * @private
   */
  _extractAuthors (element) {
    if (!element || typeof element.querySelectorAll !== 'function') {
      return ''
    }
    const names = Array.from(element.querySelectorAll(SELECTORS.bookAuthor))
      .map(node => node.textContent.trim())
      .filter(name => name.length > 0)
    return names.join(AUTHOR_SEPARATOR)
  }

  /**
   * 從書名連結提取 ebook slug 作為 bookId
   * @param {Element} element - 書籍元素
   * @returns {string}
   * @private
   */
  _extractBookId (element) {
    if (!element || typeof element.querySelector !== 'function') {
      return ''
    }
    const link = element.querySelector(SELECTORS.bookTitleLink)
    if (!link) {
      return ''
    }
    const href = link.getAttribute('href') || ''
    return this._lastPathSegment(href)
  }

  /**
   * 從立即閱讀連結提取 readnow UUID
   * @param {Element} element - 書籍元素
   * @returns {string}
   * @private
   */
  _extractReadNowId (element) {
    if (!element || typeof element.querySelector !== 'function') {
      return ''
    }
    const link = element.querySelector(SELECTORS.readnowLink)
    if (!link) {
      return ''
    }
    const href = link.getAttribute('href') || ''
    return this._lastPathSegment(href)
  }

  /**
   * 取得 URL/路徑字串最後一段（去除查詢字串與斜線）
   * @param {string} href - URL 或路徑
   * @returns {string}
   * @private
   */
  _lastPathSegment (href) {
    if (!href) {
      return ''
    }
    const withoutQuery = href.split('?')[0]
    const segments = withoutQuery.split('/').filter(Boolean)
    return segments.length > 0 ? segments[segments.length - 1] : ''
  }

  /**
   * 從書籍元素文字中比對新增日期（YYYY/M/D）
   * @param {Element} element - 書籍元素
   * @returns {string} 比對到的日期文字，找不到回傳空字串
   * @private
   */
  _extractDateAdded (element) {
    if (!element || typeof element.textContent !== 'string') {
      return ''
    }
    const match = element.textContent.match(DATE_ADDED_PATTERN)
    return match ? match[0] : ''
  }

  /**
   * 提取封面 URL
   * @param {Element} element - 書籍元素
   * @returns {string}
   * @private
   */
  _extractCoverUrl (element) {
    if (!element || typeof element.querySelector !== 'function') {
      return ''
    }
    const img = element.querySelector(SELECTORS.bookCover)
    if (!img) {
      return ''
    }
    return img.getAttribute('src') || ''
  }

  /**
   * 過濾不安全 URL 協定（javascript: / data: 等）
   * @param {string} url - 待過濾 URL
   * @returns {string} 安全 URL 或空字串
   * @private
   */
  _sanitizeUrl (url) {
    const trimmed = url.trim()
    if (trimmed === '') {
      return ''
    }
    try {
      const protocol = new URL(trimmed).protocol.toLowerCase()
      return SAFE_URL_PROTOCOLS.includes(protocol) ? trimmed : ''
    } catch (error) {
      // 設計性靜默：無協定的相對路徑非預期封面來源，一律捨棄
      return ''
    }
  }

  /**
   * 移除字串中的 HTML 標籤
   * @param {string} text - 待清理文字
   * @returns {string}
   * @private
   */
  _stripHtml (text) {
    return text.replace(/<[^>]*>/g, '').trim()
  }

  /**
   * 從篩選器「所有項目 (N)」文字解析總筆數
   * @returns {number} 總筆數，找不到或無法解析回傳 0
   * @private
   */
  _extractTotalCount () {
    if (typeof document === 'undefined') {
      return 0
    }
    const chip = document.querySelector(FILTER_CHIP_SELECTOR)
    if (!chip) {
      return 0
    }
    const match = chip.textContent.match(TOTAL_COUNT_PATTERN)
    return match ? parseInt(match[1], 10) : 0
  }

  /**
   * 建構分頁 URL
   * @param {number} pageNumber - 頁碼（從 1 開始）
   * @returns {string} 含 pageSize/pageNumber 查詢字串的書庫頁 URL
   * @private
   */
  _buildPageUrl (pageNumber) {
    return `${LIBRARY_URL}?pageSize=${PAGE_SIZE}&pageNumber=${pageNumber}`
  }

  /**
   * 透過 background service worker fetch 指定分頁 HTML
   * @param {string} url - 分頁 URL
   * @returns {Promise<string>} 頁面 HTML
   * @throws {Error} sendMessage 回傳 success:false 時拋出
   * @private
   */
  async _fetchPageHtml (url) {
    const response = await chrome.runtime.sendMessage({
      type: FETCH_PAGE_HTML_MESSAGE_TYPE,
      url
    })
    if (!response || !response.success) {
      throw new Error((response && response.error) || 'Kobo 分頁 fetch 失敗')
    }
    return response.html
  }

  /**
   * 解析分頁 HTML 字串並提取書目資料
   * @param {string} html - background fetch 回傳的頁面 HTML
   * @returns {Array<Object>} 清理後書籍資料陣列
   * @private
   */
  _parseHtmlToBooks (html) {
    const parsedDocument = new DOMParser().parseFromString(html, 'text/html')
    const elements = Array.from(parsedDocument.querySelectorAll(SELECTORS.bookItem))
    return elements.map(element => this.sanitizeData(this.parseBookElement(element)))
  }

  /**
   * 取得當前頁面 URL（測試環境降級為空字串）
   * @returns {string}
   * @private
   */
  _currentUrl () {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.href
    }
    return ''
  }
}

/**
 * 工廠函式：建立 Kobo 適配器實例
 *
 * 與 readmoo-adapter / books-com-tw-adapter / PlatformRegistry.createAdapter
 * 一致採工廠模式，由 config.adapterFactory()(options) 呼叫。
 *
 * @param {Object} [options] - 適配器選項
 * @returns {KoboAdapter}
 */
function createKoboAdapter (options) {
  return new KoboAdapter(options)
}

module.exports = createKoboAdapter
module.exports.KoboAdapter = KoboAdapter
