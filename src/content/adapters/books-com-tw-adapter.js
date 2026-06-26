/**
 * @fileoverview Books.com.tw Adapter - 博客來電子書平台適配器
 * @version v1.0.0
 * @since 2026-06-26
 *
 * 負責功能：
 * - 博客來電子書書庫頁（viewer-ebook.books.com.tw）的書籍資料提取
 * - DOM 解析（書名 / 作者 / 封面 / 閱讀進度）
 * - 分頁載入（「看更多」按鈕點擊迴圈，非 infinite scroll）
 * - 安全性過濾（javascript: / data: URL 攔截、HTML 標籤移除）
 *
 * 設計考量：
 * - 繼承 PlatformAdapterInterface，實作 17 個抽象方法（Liskov 替換）
 * - v1.5.0 走純 DOM 解析路徑；API 攔截（page script 跨 world）留待後續版本
 * - hostname 採邊界比對，避免 evilbooks.com.tw 誤判為 books.com.tw
 *
 * 處理流程：
 * 1. checkPageReady → 等待 .bookshelf__main 容器出現
 * 2. 解析當前頁面 .bookshelf__book 元素
 * 3. 迴圈點擊「看更多」載入後續分頁直到按鈕隱藏
 * 4. sanitizeData 過濾每筆書籍資料
 *
 * 資料來源勘查：docs/bookstores/books-com-tw.md
 */

const PlatformAdapterInterface = require('../platform/platform-adapter-interface')
const { Logger } = require('src/core/logging/Logger')
const { MessageDictionary } = require('src/core/messages/MessageDictionary')

/**
 * 博客來適配器專屬訊息字典（W1-107 module-specific local dict 模式）
 *
 * Business context: 與 readmoo-adapter 相同，將提取層訊息與 GlobalMessages
 * 解耦，避免跨模組詞彙污染共用字典。
 */
const booksComTwAdapterMessages = new MessageDictionary({
  BOOKS_COM_TW_INIT: '博客來適配器初始化完成',
  BOOKS_COM_TW_EXTRACT_START: '開始提取博客來書庫，初始書籍數：{count}',
  BOOKS_COM_TW_EXTRACT_DONE: '博客來書庫提取完成，成功 {success} / 失敗 {fail}',
  BOOKS_COM_TW_BOOK_PARSE_FAILED: '單一書籍解析失敗：{reason}',
  BOOKS_COM_TW_LOAD_MORE_FAILED: '分頁載入點擊失敗：{reason}'
})

/**
 * 博客來書城識別碼
 */
const PLATFORM_NAME = 'books-com-tw'

/**
 * 博客來書庫頁 URL
 */
const LIBRARY_URL = 'https://viewer-ebook.books.com.tw/viewer/index.html?readlist=all'

/**
 * 博客來書庫頁有效域名（邊界比對用）
 */
const VALID_HOSTNAME = 'books.com.tw'

/**
 * DOM 選擇器配置（對齊 docs/bookstores/books-com-tw.md 勘查結果）
 */
const SELECTORS = {
  bookContainer: '.bookshelf__main',
  bookItem: '.bookshelf__book',
  bookTitle: '.book__description__title',
  bookTitleSimple: '.book__title',
  bookAuthor: '.book__description__author',
  bookCover: '.book__cover img',
  bookProgress: '.book__progress > div',
  loadMoreButton: '.bookshelf__load-more button',
  loadMoreContainer: '.bookshelf__load-more'
}

/**
 * 作者欄位前綴（全形與半形冒號皆需處理）
 */
const AUTHOR_PREFIX_PATTERN = /^作者[：:]/

/**
 * 安全 URL 協定白名單
 */
const SAFE_URL_PROTOCOLS = ['https:', 'http:']

/**
 * 博客來電子書平台適配器
 *
 * @extends PlatformAdapterInterface
 */
class BooksComTwAdapter extends PlatformAdapterInterface {
  /**
   * @param {Object} [options] - 適配器選項（預留擴充）
   */
  constructor (options = {}) {
    super()
    this.platformName = PLATFORM_NAME
    this.options = options
    this.logger = new Logger('BooksComTwAdapter', 'INFO', booksComTwAdapterMessages)
    this._stats = this._createEmptyStats()
    this.logger.info('BOOKS_COM_TW_INIT')
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
   * 檢查域名是否為博客來
   * @param {string} [url] - 待檢查 URL
   * @returns {boolean}
   */
  isValidDomain (url) {
    const target = typeof url === 'string' ? url : this._currentUrl()
    let hostname
    try {
      hostname = new URL(target).hostname.toLowerCase()
    } catch (error) {
      // 設計性靜默：無法解析的 URL（空字串 / 'not-a-url'）即非有效博客來域名
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
      const params = new URL(target).searchParams
      return params.has('readlist') ? 'library' : 'unknown'
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
   * @param {Element} element - .bookshelf__book 元素
   * @returns {Object} 書籍資料物件
   */
  parseBookElement (element) {
    return {
      title: this._extractText(element, SELECTORS.bookTitle),
      author: this._extractAuthor(element),
      coverUrl: this._extractCoverUrl(element),
      readProgress: this._extractProgress(element),
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
   * 提取所有書籍（分頁載入 + DOM 解析）
   * @returns {Promise<Array<Object>>} 書籍資料陣列
   */
  async extractAllBooks () {
    await this.checkPageReady()
    this.logger.info('BOOKS_COM_TW_EXTRACT_START', { count: this.getBookCount() })

    await this._loadAllPages()

    const books = []
    for (const element of this.getBookElements()) {
      this._stats.totalExtracted += 1
      try {
        books.push(this.extractBookData(element))
        this._stats.successCount += 1
      } catch (error) {
        this._stats.failCount += 1
        this.logger.warn('BOOKS_COM_TW_BOOK_PARSE_FAILED', { reason: error.message })
      }
    }

    this.logger.info('BOOKS_COM_TW_EXTRACT_DONE', {
      success: this._stats.successCount,
      fail: this._stats.failCount
    })
    return books
  }

  /**
   * 迴圈點擊「看更多」載入後續分頁，直到按鈕隱藏
   * @param {number} [maxClicks=100] - 最大點擊次數（防無限迴圈）
   * @returns {Promise<void>}
   * @private
   */
  async _loadAllPages (maxClicks = 100) {
    let clicks = 0
    while (clicks < maxClicks && this._hasLoadMore()) {
      try {
        this._clickLoadMore()
        await this.waitForRenderSettle()
        clicks += 1
      } catch (error) {
        this.logger.warn('BOOKS_COM_TW_LOAD_MORE_FAILED', { reason: error.message })
        break
      }
    }
  }

  /**
   * 判斷是否仍有「看更多」按鈕可點擊
   * @returns {boolean}
   * @private
   */
  _hasLoadMore () {
    if (typeof document === 'undefined') {
      return false
    }
    const container = document.querySelector(SELECTORS.loadMoreContainer)
    const button = document.querySelector(SELECTORS.loadMoreButton)
    if (!container || !button) {
      return false
    }
    return container.style.display !== 'none'
  }

  /**
   * 點擊「看更多」按鈕
   * @private
   */
  _clickLoadMore () {
    const button = document.querySelector(SELECTORS.loadMoreButton)
    if (button && typeof button.click === 'function') {
      button.click()
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
   * 提取作者並去除「作者：」前綴
   * @param {Element} element - 書籍元素
   * @returns {string}
   * @private
   */
  _extractAuthor (element) {
    const raw = this._extractText(element, SELECTORS.bookAuthor)
    return raw.replace(AUTHOR_PREFIX_PATTERN, '').trim()
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
   * 從進度條 style.width 提取閱讀進度百分比
   * @param {Element} element - 書籍元素
   * @returns {number} 0-100 整數，無進度回傳 0
   * @private
   */
  _extractProgress (element) {
    if (!element || typeof element.querySelector !== 'function') {
      return 0
    }
    const bar = element.querySelector(SELECTORS.bookProgress)
    if (!bar || !bar.style || !bar.style.width) {
      return 0
    }
    const value = parseInt(bar.style.width, 10)
    return Number.isNaN(value) ? 0 : value
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
 * 工廠函式：建立博客來適配器實例
 *
 * 與 readmoo-adapter / PlatformRegistry.createAdapter 一致採工廠模式，
 * 由 config.adapterFactory()(options) 呼叫。
 *
 * @param {Object} [options] - 適配器選項
 * @returns {BooksComTwAdapter}
 */
function createBooksComTwAdapter (options) {
  return new BooksComTwAdapter(options)
}

module.exports = createBooksComTwAdapter
module.exports.BooksComTwAdapter = BooksComTwAdapter
