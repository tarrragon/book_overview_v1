/**
const Logger = require("src/core/logging/Logger")
 * BookGridRenderer - 書籍網格渲染器
const Logger = require("src/core/logging/Logger")
 * TDD 循環 #27 - 重構階段優化
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 負責功能：
const Logger = require("src/core/logging/Logger")
 * - 書籍網格渲染和佈局管理
const Logger = require("src/core/logging/Logger")
 * - 響應式設計適配不同螢幕尺寸
const Logger = require("src/core/logging/Logger")
 * - 虛擬滾動支援大量資料處理
const Logger = require("src/core/logging/Logger")
 * - 書籍卡片互動功能
const Logger = require("src/core/logging/Logger")
 * - 效能優化和記憶體管理
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 設計考量：
const Logger = require("src/core/logging/Logger")
 * - 基於事件驅動架構與系統整合
const Logger = require("src/core/logging/Logger")
 * - 響應式網格佈局自動適配螢幕尺寸
const Logger = require("src/core/logging/Logger")
 * - 虛擬滾動優化大量資料處理效能
const Logger = require("src/core/logging/Logger")
 * - 記憶體管理避免 DOM 元素累積
const Logger = require("src/core/logging/Logger")
 * - 完整錯誤處理和邊界條件處理
const Logger = require("src/core/logging/Logger")
 * - 使用統一配置管理系統
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 處理流程：
const Logger = require("src/core/logging/Logger")
 * 1. 初始化容器和事件系統
const Logger = require("src/core/logging/Logger")
 * 2. 計算響應式網格佈局
const Logger = require("src/core/logging/Logger")
 * 3. 創建和管理書籍卡片
const Logger = require("src/core/logging/Logger")
 * 4. 實現虛擬滾動機制
const Logger = require("src/core/logging/Logger")
 * 5. 處理使用者互動事件
const Logger = require("src/core/logging/Logger")
 * 6. 優化渲染效能和記憶體使用
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 使用情境：
const Logger = require("src/core/logging/Logger")
 * - Overview 頁面書籍展示
const Logger = require("src/core/logging/Logger")
 * - 大量書籍資料的高效渲染
const Logger = require("src/core/logging/Logger")
 * - 響應式書籍瀏覽體驗
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * @version 1.1.0
const Logger = require("src/core/logging/Logger")
 * @since 2025-08-07
const Logger = require("src/core/logging/Logger")
 */

const Logger = require("src/core/logging/Logger")
const UI_HANDLER_CONFIG = require('./config/ui-handler-config')
const Logger = require("src/core/logging/Logger")
const { StandardError } = require('src/core/errors/StandardError')

const Logger = require("src/core/logging/Logger")
class BookGridRenderer {
const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 建構 BookGridRenderer 實例
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {HTMLElement} container - 渲染容器
const Logger = require("src/core/logging/Logger")
   * @param {Object} eventBus - 事件總線
const Logger = require("src/core/logging/Logger")
   * @param {Object} options - 配置選項，預設為空物件
const Logger = require("src/core/logging/Logger")
   * @param {Document|null} document - 文檔對象，支援依賴注入。
const Logger = require("src/core/logging/Logger")
   *                                   在測試環境中可注入 mock document，
const Logger = require("src/core/logging/Logger")
   *                                   在瀏覽器環境中會自動使用 window.document
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @example
const Logger = require("src/core/logging/Logger")
   * // 瀏覽器環境使用
const Logger = require("src/core/logging/Logger")
   * const renderer = new BookGridRenderer(container, eventBus);
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * // 測試環境使用
const Logger = require("src/core/logging/Logger")
   * const renderer = new BookGridRenderer(container, eventBus, {}, mockDocument);
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  constructor (container, eventBus, options = {}, document = null) {
const Logger = require("src/core/logging/Logger")
    if (!container) {
const Logger = require("src/core/logging/Logger")
      throw new StandardError('REQUIRED_FIELD_MISSING', 'Container is required', {
const Logger = require("src/core/logging/Logger")
        category: 'ui'
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    this.container = container
const Logger = require("src/core/logging/Logger")
    this.eventBus = eventBus

const Logger = require("src/core/logging/Logger")
    // 依賴注入模式 - 支援測試環境的 DOM 模擬
const Logger = require("src/core/logging/Logger")
    // 這個設計遵循依賴注入原則，使得組件可以在不同環境中運作：
const Logger = require("src/core/logging/Logger")
    // 1. 瀏覽器環境：自動使用 window.document
const Logger = require("src/core/logging/Logger")
    // 2. 測試環境：注入 mock document 以支援單元測試
const Logger = require("src/core/logging/Logger")
    // 3. Node.js 環境：拋出錯誤以提早發現配置問題
const Logger = require("src/core/logging/Logger")
    this.document = document || (typeof window !== 'undefined' ? window.document : null)

const Logger = require("src/core/logging/Logger")
    if (!this.document) {
const Logger = require("src/core/logging/Logger")
      throw new StandardError('REQUIRED_FIELD_MISSING', 'Document is required for BookGridRenderer. ' +
const Logger = require("src/core/logging/Logger")
                     'In test environments, please inject a mock document.', {
const Logger = require("src/core/logging/Logger")
        category: 'ui'
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 初始化資料
const Logger = require("src/core/logging/Logger")
    this.books = []
const Logger = require("src/core/logging/Logger")
    this.renderedBooks = []

const Logger = require("src/core/logging/Logger")
    // 初始化配置
const Logger = require("src/core/logging/Logger")
    this.initializeConfig(options)

const Logger = require("src/core/logging/Logger")
    // 初始化統計
const Logger = require("src/core/logging/Logger")
    this.initializeStats()

const Logger = require("src/core/logging/Logger")
    // 初始化狀態
const Logger = require("src/core/logging/Logger")
    this.initializeState()

const Logger = require("src/core/logging/Logger")
    // 初始化事件監聽
const Logger = require("src/core/logging/Logger")
    this.initializeEventListeners()

const Logger = require("src/core/logging/Logger")
    // 初始化佈局
const Logger = require("src/core/logging/Logger")
    this.initializeLayout()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化配置參數
const Logger = require("src/core/logging/Logger")
   * 使用統一配置系統並合併自訂選項
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} options - 自訂配置選項
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  initializeConfig (options) {
const Logger = require("src/core/logging/Logger")
    // 從統一配置系統載入網格配置
const Logger = require("src/core/logging/Logger")
    const gridConfig = this.loadGridConfiguration()
const Logger = require("src/core/logging/Logger")
    const performanceConfig = UI_HANDLER_CONFIG.PERFORMANCE
const Logger = require("src/core/logging/Logger")
    const environmentConfig = UI_HANDLER_CONFIG.getEnvironmentConfig(process.env.NODE_ENV)

const Logger = require("src/core/logging/Logger")
    // 合併所有配置來源
const Logger = require("src/core/logging/Logger")
    this.config = UI_HANDLER_CONFIG.mergeConfig(gridConfig, {
const Logger = require("src/core/logging/Logger")
      ...performanceConfig,
const Logger = require("src/core/logging/Logger")
      ...environmentConfig,
const Logger = require("src/core/logging/Logger")
      ...options
const Logger = require("src/core/logging/Logger")
    })

const Logger = require("src/core/logging/Logger")
    // 設定常數
const Logger = require("src/core/logging/Logger")
    this.CONSTANTS = this.initializeConstants()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 載入網格特定配置
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {Object} 網格配置物件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  loadGridConfiguration () {
const Logger = require("src/core/logging/Logger")
    return {
const Logger = require("src/core/logging/Logger")
      // 卡片尺寸配置
const Logger = require("src/core/logging/Logger")
      cardWidth: 200,
const Logger = require("src/core/logging/Logger")
      cardHeight: 300,
const Logger = require("src/core/logging/Logger")
      minCardWidth: 150,
const Logger = require("src/core/logging/Logger")
      maxCardWidth: 250,

const Logger = require("src/core/logging/Logger")
      // 佈局配置
const Logger = require("src/core/logging/Logger")
      gap: 16,
const Logger = require("src/core/logging/Logger")
      minGap: 8,
const Logger = require("src/core/logging/Logger")
      maxGap: 24,
const Logger = require("src/core/logging/Logger")
      virtualScrolling: true,
const Logger = require("src/core/logging/Logger")
      bufferSize: 5,

const Logger = require("src/core/logging/Logger")
      // 效能配置
const Logger = require("src/core/logging/Logger")
      throttleDelay: 100,
const Logger = require("src/core/logging/Logger")
      renderBatchSize: 10,
const Logger = require("src/core/logging/Logger")
      animationDuration: 300,

const Logger = require("src/core/logging/Logger")
      // 響應式斷點
const Logger = require("src/core/logging/Logger")
      breakpoints: {
const Logger = require("src/core/logging/Logger")
        mobile: 480,
const Logger = require("src/core/logging/Logger")
        tablet: 768,
const Logger = require("src/core/logging/Logger")
        desktop: 1024,
const Logger = require("src/core/logging/Logger")
        largeDesktop: 1200
const Logger = require("src/core/logging/Logger")
      },

const Logger = require("src/core/logging/Logger")
      // 錯誤處理
const Logger = require("src/core/logging/Logger")
      maxRetries: 3,
const Logger = require("src/core/logging/Logger")
      enableErrorLogging: true
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化常數定義
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {Object} 常數物件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  initializeConstants () {
const Logger = require("src/core/logging/Logger")
    return {
const Logger = require("src/core/logging/Logger")
      // CSS 類別名稱
const Logger = require("src/core/logging/Logger")
      CLASSES: {
const Logger = require("src/core/logging/Logger")
        BOOK_CARD: 'book-card',
const Logger = require("src/core/logging/Logger")
        BOOK_COVER: 'book-cover',
const Logger = require("src/core/logging/Logger")
        BOOK_INFO: 'book-info',
const Logger = require("src/core/logging/Logger")
        BOOK_TITLE: 'book-title',
const Logger = require("src/core/logging/Logger")
        BOOK_AUTHOR: 'book-author',
const Logger = require("src/core/logging/Logger")
        PROGRESS_CONTAINER: 'progress-container',
const Logger = require("src/core/logging/Logger")
        PROGRESS_BAR: 'progress-bar',
const Logger = require("src/core/logging/Logger")
        DEFAULT_COVER: 'default-cover'
const Logger = require("src/core/logging/Logger")
      },

const Logger = require("src/core/logging/Logger")
      // 狀態類別前綴
const Logger = require("src/core/logging/Logger")
      STATUS_PREFIX: 'status-',

const Logger = require("src/core/logging/Logger")
      // 事件名稱
const Logger = require("src/core/logging/Logger")
      EVENTS: {
const Logger = require("src/core/logging/Logger")
        RENDER_COMPLETE: 'UI.GRID.RENDER_COMPLETE',
const Logger = require("src/core/logging/Logger")
        BOOKS_UPDATE: 'UI.BOOKS.UPDATE',
const Logger = require("src/core/logging/Logger")
        BOOKS_FILTER: 'UI.BOOKS.FILTER'
const Logger = require("src/core/logging/Logger")
      },

const Logger = require("src/core/logging/Logger")
      // 錯誤類型
const Logger = require("src/core/logging/Logger")
      ERROR_TYPES: UI_HANDLER_CONFIG.ERROR_TYPES
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化統計追蹤
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  initializeStats () {
const Logger = require("src/core/logging/Logger")
    this.stats = {
const Logger = require("src/core/logging/Logger")
      totalBooks: 0,
const Logger = require("src/core/logging/Logger")
      renderedBooks: 0,
const Logger = require("src/core/logging/Logger")
      renderTime: 0,
const Logger = require("src/core/logging/Logger")
      scrollEvents: 0,
const Logger = require("src/core/logging/Logger")
      lastRenderTime: 0
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化內部狀態
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  initializeState () {
const Logger = require("src/core/logging/Logger")
    this.currentColumns = 1
const Logger = require("src/core/logging/Logger")
    this.visibleRange = { start: 0, end: 0 }
const Logger = require("src/core/logging/Logger")
    this.scrollTop = 0
const Logger = require("src/core/logging/Logger")
    this.containerHeight = 0
const Logger = require("src/core/logging/Logger")
    this.totalHeight = 0
const Logger = require("src/core/logging/Logger")
    this.cardPool = [] // DOM 元素池
const Logger = require("src/core/logging/Logger")
    this.throttleTimer = null
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化事件監聽器
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  initializeEventListeners () {
const Logger = require("src/core/logging/Logger")
    if (this.eventBus && typeof this.eventBus.on === 'function') {
const Logger = require("src/core/logging/Logger")
      this.eventBus.on('UI.BOOKS.UPDATE', this.handleBooksUpdate.bind(this))
const Logger = require("src/core/logging/Logger")
      this.eventBus.on('UI.BOOKS.FILTER', this.handleBooksFilter.bind(this))
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 容器滾動事件
const Logger = require("src/core/logging/Logger")
    this.boundHandleScroll = this.handleScroll.bind(this)
const Logger = require("src/core/logging/Logger")
    this.container.addEventListener?.('scroll', this.boundHandleScroll)

const Logger = require("src/core/logging/Logger")
    // 視窗大小變化事件
const Logger = require("src/core/logging/Logger")
    this.boundHandleResize = this.handleResize.bind(this)
const Logger = require("src/core/logging/Logger")
    if (typeof window !== 'undefined') {
const Logger = require("src/core/logging/Logger")
      window.addEventListener?.('resize', this.boundHandleResize)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化佈局
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  initializeLayout () {
const Logger = require("src/core/logging/Logger")
    this.updateLayout()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 計算網格欄位數量
const Logger = require("src/core/logging/Logger")
   * 使用配置化的響應式斷點
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {number} containerWidth - 容器寬度
const Logger = require("src/core/logging/Logger")
   * @returns {number} 欄位數量
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  calculateColumns (containerWidth) {
const Logger = require("src/core/logging/Logger")
    if (containerWidth <= 0) {
const Logger = require("src/core/logging/Logger")
      return 1
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    const { cardWidth, gap, breakpoints } = this.config
const Logger = require("src/core/logging/Logger")
    const availableWidth = containerWidth - gap
const Logger = require("src/core/logging/Logger")
    const columnWidth = cardWidth + gap
const Logger = require("src/core/logging/Logger")
    const maxColumns = Math.floor(availableWidth / columnWidth)

const Logger = require("src/core/logging/Logger")
    // 根據響應式斷點限制最大欄數
const Logger = require("src/core/logging/Logger")
    if (containerWidth <= breakpoints.mobile) {
const Logger = require("src/core/logging/Logger")
      return 1 // 手機：單欄
const Logger = require("src/core/logging/Logger")
    } else if (containerWidth <= breakpoints.tablet) {
const Logger = require("src/core/logging/Logger")
      return Math.min(maxColumns, 2) // 平板：最多2欄
const Logger = require("src/core/logging/Logger")
    } else if (containerWidth <= breakpoints.desktop) {
const Logger = require("src/core/logging/Logger")
      return Math.min(maxColumns, 3) // 小桌面：最多3欄
const Logger = require("src/core/logging/Logger")
    } else if (containerWidth <= breakpoints.largeDesktop) {
const Logger = require("src/core/logging/Logger")
      return Math.min(maxColumns, 4) // 大桌面：最多4欄
const Logger = require("src/core/logging/Logger")
    } else {
const Logger = require("src/core/logging/Logger")
      return Math.min(maxColumns, 5) // 超大螢幕：最多5欄
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 計算書籍卡片位置
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Array} books - 書籍陣列
const Logger = require("src/core/logging/Logger")
   * @param {number} columns - 欄位數量
const Logger = require("src/core/logging/Logger")
   * @returns {Array} 位置陣列
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  calculatePositions (books, columns) {
const Logger = require("src/core/logging/Logger")
    const positions = []
const Logger = require("src/core/logging/Logger")
    const { cardWidth, cardHeight, gap } = this.config

const Logger = require("src/core/logging/Logger")
    books.forEach((book, index) => {
const Logger = require("src/core/logging/Logger")
      const row = Math.floor(index / columns)
const Logger = require("src/core/logging/Logger")
      const col = index % columns
const Logger = require("src/core/logging/Logger")
      const x = col * (cardWidth + gap) + gap
const Logger = require("src/core/logging/Logger")
      const y = row * (cardHeight + gap) + gap

const Logger = require("src/core/logging/Logger")
      positions.push({ row, col, x, y })
const Logger = require("src/core/logging/Logger")
    })

const Logger = require("src/core/logging/Logger")
    return positions
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 計算容器總高度
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Array} books - 書籍陣列
const Logger = require("src/core/logging/Logger")
   * @param {number} columns - 欄位數量
const Logger = require("src/core/logging/Logger")
   * @returns {number} 總高度
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  calculateTotalHeight (books, columns) {
const Logger = require("src/core/logging/Logger")
    if (books.length === 0) return 0

const Logger = require("src/core/logging/Logger")
    const { cardHeight, gap } = this.config
const Logger = require("src/core/logging/Logger")
    const rows = Math.ceil(books.length / columns)

const Logger = require("src/core/logging/Logger")
    return rows * (cardHeight + gap) + gap
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 計算間距
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {number} containerWidth - 容器寬度
const Logger = require("src/core/logging/Logger")
   * @returns {number} 間距值
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  calculateGap (containerWidth) {
const Logger = require("src/core/logging/Logger")
    if (containerWidth <= 480) return 8 // 手機小間距
const Logger = require("src/core/logging/Logger")
    if (containerWidth <= 768) return 12 // 平板中等間距
const Logger = require("src/core/logging/Logger")
    return 16 // 桌面大間距
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 更新佈局
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  updateLayout () {
const Logger = require("src/core/logging/Logger")
    const rect = this.container.getBoundingClientRect()
const Logger = require("src/core/logging/Logger")
    const containerWidth = rect.width
const Logger = require("src/core/logging/Logger")
    const containerHeight = rect.height

const Logger = require("src/core/logging/Logger")
    this.currentColumns = this.calculateColumns(containerWidth)
const Logger = require("src/core/logging/Logger")
    this.containerHeight = containerHeight
const Logger = require("src/core/logging/Logger")
    this.config.gap = this.calculateGap(containerWidth)
const Logger = require("src/core/logging/Logger")
    this.totalHeight = this.calculateTotalHeight(this.books, this.currentColumns)

const Logger = require("src/core/logging/Logger")
    // 更新可見範圍
const Logger = require("src/core/logging/Logger")
    this.updateVisibleRange()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 創建書籍卡片
const Logger = require("src/core/logging/Logger")
   * 使用常數定義和改善的錯誤處理
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} book - 書籍資料
const Logger = require("src/core/logging/Logger")
   * @returns {HTMLElement} 書籍卡片元素
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  createBookCard (book) {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      const card = this.document.createElement('div')
const Logger = require("src/core/logging/Logger")
      const { BOOK_CARD } = this.CONSTANTS.CLASSES
const Logger = require("src/core/logging/Logger")
      const { STATUS_PREFIX } = this.CONSTANTS

const Logger = require("src/core/logging/Logger")
      card.classList.add(BOOK_CARD)
const Logger = require("src/core/logging/Logger")
      card.setAttribute('data-book-id', book.id)

const Logger = require("src/core/logging/Logger")
      // 設定基本樣式
const Logger = require("src/core/logging/Logger")
      this.setCardBaseStyles(card)

const Logger = require("src/core/logging/Logger")
      // 創建卡片內容
const Logger = require("src/core/logging/Logger")
      this.populateBookCard(card, book)

const Logger = require("src/core/logging/Logger")
      // 添加狀態樣式
const Logger = require("src/core/logging/Logger")
      if (book.status && typeof book.status === 'string') {
const Logger = require("src/core/logging/Logger")
        card.classList.add(`${STATUS_PREFIX}${book.status}`)
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      return card
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      this.handleCardCreationError(book, error)
const Logger = require("src/core/logging/Logger")
      return this.createFallbackCard(book)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 設定卡片基本樣式
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {HTMLElement} card - 卡片元素
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  setCardBaseStyles (card) {
const Logger = require("src/core/logging/Logger")
    const { cardWidth, cardHeight } = this.config

const Logger = require("src/core/logging/Logger")
    Object.assign(card.style, {
const Logger = require("src/core/logging/Logger")
      position: 'absolute',
const Logger = require("src/core/logging/Logger")
      width: `${cardWidth}px`,
const Logger = require("src/core/logging/Logger")
      height: `${cardHeight}px`,
const Logger = require("src/core/logging/Logger")
      boxSizing: 'border-box'
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理卡片創建錯誤
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} book - 書籍資料
const Logger = require("src/core/logging/Logger")
   * @param {Error} error - 錯誤物件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleCardCreationError (book, error) {
const Logger = require("src/core/logging/Logger")
    if (this.config.enableErrorLogging) {
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.error(`[BookGridRenderer] Failed to create card for book ${book.id}:`, error)
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 更新錯誤統計
const Logger = require("src/core/logging/Logger")
    this.stats.cardCreationErrors = (this.stats.cardCreationErrors || 0) + 1
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 創建備用卡片
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} book - 書籍資料
const Logger = require("src/core/logging/Logger")
   * @returns {HTMLElement} 備用卡片元素
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  createFallbackCard (book) {
const Logger = require("src/core/logging/Logger")
    const card = this.document.createElement('div')
const Logger = require("src/core/logging/Logger")
    card.classList.add(this.CONSTANTS.CLASSES.BOOK_CARD, 'fallback-card')
const Logger = require("src/core/logging/Logger")
    card.setAttribute('data-book-id', book.id)
const Logger = require("src/core/logging/Logger")
    card.textContent = book.title || 'Unknown Book'

const Logger = require("src/core/logging/Logger")
    this.setCardBaseStyles(card)

const Logger = require("src/core/logging/Logger")
    return card
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 填充書籍卡片內容
const Logger = require("src/core/logging/Logger")
   * 使用常數定義和改善的結構化方法
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {HTMLElement} card - 卡片元素
const Logger = require("src/core/logging/Logger")
   * @param {Object} book - 書籍資料
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  populateBookCard (card, book) {
const Logger = require("src/core/logging/Logger")
    const { CLASSES } = this.CONSTANTS

const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      // 創建封面區域
const Logger = require("src/core/logging/Logger")
      const coverContainer = this.createCoverContainer(book, CLASSES)
const Logger = require("src/core/logging/Logger")
      card.appendChild(coverContainer)

const Logger = require("src/core/logging/Logger")
      // 創建資訊區域
const Logger = require("src/core/logging/Logger")
      const infoContainer = this.createInfoContainer(book, CLASSES)
const Logger = require("src/core/logging/Logger")
      card.appendChild(infoContainer)

const Logger = require("src/core/logging/Logger")
      // 創建進度指示器
const Logger = require("src/core/logging/Logger")
      if (this.shouldShowProgress(book)) {
const Logger = require("src/core/logging/Logger")
        const progressContainer = this.createProgressContainer(book, CLASSES)
const Logger = require("src/core/logging/Logger")
        card.appendChild(progressContainer)
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.warn(`[BookGridRenderer] Failed to populate card for book ${book.id}:`, error)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 創建封面容器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} book - 書籍資料
const Logger = require("src/core/logging/Logger")
   * @param {Object} CLASSES - CSS 類別常數
const Logger = require("src/core/logging/Logger")
   * @returns {HTMLElement} 封面容器元素
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  createCoverContainer (book, CLASSES) {
const Logger = require("src/core/logging/Logger")
    const coverContainer = this.document.createElement('div')
const Logger = require("src/core/logging/Logger")
    coverContainer.classList.add(CLASSES.BOOK_COVER)

const Logger = require("src/core/logging/Logger")
    if (book.coverImage && typeof book.coverImage === 'string') {
const Logger = require("src/core/logging/Logger")
      const coverImg = this.document.createElement('img')
const Logger = require("src/core/logging/Logger")
      coverImg.src = book.coverImage
const Logger = require("src/core/logging/Logger")
      coverImg.alt = book.title || 'Book cover'
const Logger = require("src/core/logging/Logger")
      coverImg.loading = 'lazy' // 延遲載入優化

const Logger = require("src/core/logging/Logger")
      // 錯誤處理
const Logger = require("src/core/logging/Logger")
      coverImg.onerror = () => {
const Logger = require("src/core/logging/Logger")
        this.handleImageError(coverContainer, book)
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      coverContainer.appendChild(coverImg)
const Logger = require("src/core/logging/Logger")
    } else {
const Logger = require("src/core/logging/Logger")
      this.createDefaultCover(coverContainer, book, CLASSES)
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    return coverContainer
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 創建預設封面
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {HTMLElement} container - 封面容器
const Logger = require("src/core/logging/Logger")
   * @param {Object} book - 書籍資料
const Logger = require("src/core/logging/Logger")
   * @param {Object} CLASSES - CSS 類別常數
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  createDefaultCover (container, book, CLASSES) {
const Logger = require("src/core/logging/Logger")
    container.classList.add(CLASSES.DEFAULT_COVER)

const Logger = require("src/core/logging/Logger")
    // 使用書籍標題首字母或預設圖示
const Logger = require("src/core/logging/Logger")
    const displayText = book.title?.charAt(0)?.toUpperCase() || '📖'
const Logger = require("src/core/logging/Logger")
    container.textContent = displayText
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理圖片載入錯誤
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {HTMLElement} container - 封面容器
const Logger = require("src/core/logging/Logger")
   * @param {Object} book - 書籍資料
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleImageError (container, book) {
const Logger = require("src/core/logging/Logger")
    // 移除錯誤的圖片
const Logger = require("src/core/logging/Logger")
    const img = container.querySelector('img')
const Logger = require("src/core/logging/Logger")
    if (img) {
const Logger = require("src/core/logging/Logger")
      container.removeChild(img)
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 建立預設封面
const Logger = require("src/core/logging/Logger")
    this.createDefaultCover(container, book, this.CONSTANTS.CLASSES)
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 創建資訊容器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} book - 書籍資料
const Logger = require("src/core/logging/Logger")
   * @param {Object} CLASSES - CSS 類別常數
const Logger = require("src/core/logging/Logger")
   * @returns {HTMLElement} 資訊容器元素
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  createInfoContainer (book, CLASSES) {
const Logger = require("src/core/logging/Logger")
    const infoContainer = this.document.createElement('div')
const Logger = require("src/core/logging/Logger")
    infoContainer.classList.add(CLASSES.BOOK_INFO)

const Logger = require("src/core/logging/Logger")
    // 添加標題
const Logger = require("src/core/logging/Logger")
    if (book.title && typeof book.title === 'string') {
const Logger = require("src/core/logging/Logger")
      const title = this.document.createElement('h3')
const Logger = require("src/core/logging/Logger")
      title.classList.add(CLASSES.BOOK_TITLE)
const Logger = require("src/core/logging/Logger")
      title.textContent = this.truncateText(book.title, 50)
const Logger = require("src/core/logging/Logger")
      title.title = book.title // 完整標題作為 tooltip
const Logger = require("src/core/logging/Logger")
      infoContainer.appendChild(title)
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 添加作者
const Logger = require("src/core/logging/Logger")
    if (book.author && typeof book.author === 'string') {
const Logger = require("src/core/logging/Logger")
      const author = this.document.createElement('p')
const Logger = require("src/core/logging/Logger")
      author.classList.add(CLASSES.BOOK_AUTHOR)
const Logger = require("src/core/logging/Logger")
      author.textContent = this.truncateText(book.author, 30)
const Logger = require("src/core/logging/Logger")
      author.title = book.author // 完整作者名作為 tooltip
const Logger = require("src/core/logging/Logger")
      infoContainer.appendChild(author)
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    return infoContainer
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 創建進度容器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} book - 書籍資料
const Logger = require("src/core/logging/Logger")
   * @param {Object} CLASSES - CSS 類別常數
const Logger = require("src/core/logging/Logger")
   * @returns {HTMLElement} 進度容器元素
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  createProgressContainer (book, CLASSES) {
const Logger = require("src/core/logging/Logger")
    const progressContainer = this.document.createElement('div')
const Logger = require("src/core/logging/Logger")
    progressContainer.classList.add(CLASSES.PROGRESS_CONTAINER)

const Logger = require("src/core/logging/Logger")
    const progressBar = this.document.createElement('div')
const Logger = require("src/core/logging/Logger")
    progressBar.classList.add(CLASSES.PROGRESS_BAR)

const Logger = require("src/core/logging/Logger")
    // 正規化進度值（0-100）
const Logger = require("src/core/logging/Logger")
    const normalizedProgress = this.normalizeProgress(book.progress)
const Logger = require("src/core/logging/Logger")
    progressBar.style.width = `${normalizedProgress}%`

const Logger = require("src/core/logging/Logger")
    // 添加進度文字
const Logger = require("src/core/logging/Logger")
    const progressText = this.document.createElement('span')
const Logger = require("src/core/logging/Logger")
    progressText.classList.add('progress-text')
const Logger = require("src/core/logging/Logger")
    progressText.textContent = `${normalizedProgress}%`

const Logger = require("src/core/logging/Logger")
    progressContainer.appendChild(progressBar)
const Logger = require("src/core/logging/Logger")
    progressContainer.appendChild(progressText)

const Logger = require("src/core/logging/Logger")
    return progressContainer
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 檢查是否應該顯示進度
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} book - 書籍資料
const Logger = require("src/core/logging/Logger")
   * @returns {boolean} 是否顯示進度
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  shouldShowProgress (book) {
const Logger = require("src/core/logging/Logger")
    return typeof book.progress === 'number' &&
const Logger = require("src/core/logging/Logger")
           !isNaN(book.progress) &&
const Logger = require("src/core/logging/Logger")
           book.progress >= 0
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 正規化進度值
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {number} progress - 原始進度值
const Logger = require("src/core/logging/Logger")
   * @returns {number} 正規化後的進度值 (0-100)
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  normalizeProgress (progress) {
const Logger = require("src/core/logging/Logger")
    if (typeof progress !== 'number' || isNaN(progress)) {
const Logger = require("src/core/logging/Logger")
      return 0
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
    return Math.max(0, Math.min(100, Math.round(progress)))
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 截斷文字
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} text - 原始文字
const Logger = require("src/core/logging/Logger")
   * @param {number} maxLength - 最大長度
const Logger = require("src/core/logging/Logger")
   * @returns {string} 截斷後的文字
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  truncateText (text, maxLength) {
const Logger = require("src/core/logging/Logger")
    if (!text || typeof text !== 'string') {
const Logger = require("src/core/logging/Logger")
      return ''
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (text.length <= maxLength) {
const Logger = require("src/core/logging/Logger")
      return text
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    return text.substring(0, maxLength - 3) + '...'
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理尺寸變化
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleResize () {
const Logger = require("src/core/logging/Logger")
    if (this.throttleTimer) {
const Logger = require("src/core/logging/Logger")
      clearTimeout(this.throttleTimer)
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    this.throttleTimer = setTimeout(() => {
const Logger = require("src/core/logging/Logger")
      this.updateLayout()
const Logger = require("src/core/logging/Logger")
      this.renderVisibleBooks()
const Logger = require("src/core/logging/Logger")
    }, this.config.throttleDelay)
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理滾動事件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleScroll () {
const Logger = require("src/core/logging/Logger")
    this.stats.scrollEvents++

const Logger = require("src/core/logging/Logger")
    if (this.throttleTimer) {
const Logger = require("src/core/logging/Logger")
      clearTimeout(this.throttleTimer)
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    this.throttleTimer = setTimeout(() => {
const Logger = require("src/core/logging/Logger")
      this.scrollTop = this.container.scrollTop
const Logger = require("src/core/logging/Logger")
      this.updateVisibleRange()
const Logger = require("src/core/logging/Logger")
      this.renderVisibleBooks()
const Logger = require("src/core/logging/Logger")
    }, this.config.throttleDelay)
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 計算可見區域範圍
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {Object} 可見範圍 {start, end}
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  calculateVisibleRange () {
const Logger = require("src/core/logging/Logger")
    const { cardHeight, gap } = this.config
const Logger = require("src/core/logging/Logger")
    const rowHeight = cardHeight + gap
const Logger = require("src/core/logging/Logger")
    const bufferRows = this.config.bufferSize

const Logger = require("src/core/logging/Logger")
    const startRow = Math.max(0, Math.floor(this.scrollTop / rowHeight) - bufferRows)
const Logger = require("src/core/logging/Logger")
    const endRow = Math.min(
const Logger = require("src/core/logging/Logger")
      Math.ceil(this.books.length / this.currentColumns),
const Logger = require("src/core/logging/Logger")
      Math.ceil((this.scrollTop + this.containerHeight) / rowHeight) + bufferRows
const Logger = require("src/core/logging/Logger")
    )

const Logger = require("src/core/logging/Logger")
    const start = startRow * this.currentColumns
const Logger = require("src/core/logging/Logger")
    const end = Math.min(this.books.length, endRow * this.currentColumns)

const Logger = require("src/core/logging/Logger")
    return { start, end }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 更新可見範圍
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  updateVisibleRange () {
const Logger = require("src/core/logging/Logger")
    this.visibleRange = this.calculateVisibleRange()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 渲染可見的書籍
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  renderVisibleBooks () {
const Logger = require("src/core/logging/Logger")
    const startTime = performance.now()

const Logger = require("src/core/logging/Logger")
    // 清除現有渲染
const Logger = require("src/core/logging/Logger")
    this.clearRenderedBooks()

const Logger = require("src/core/logging/Logger")
    // 渲染可見範圍內的書籍
const Logger = require("src/core/logging/Logger")
    const visibleBooks = this.books.slice(this.visibleRange.start, this.visibleRange.end)
const Logger = require("src/core/logging/Logger")
    const positions = this.calculatePositions(this.books, this.currentColumns)

const Logger = require("src/core/logging/Logger")
    if (typeof requestAnimationFrame !== 'undefined') {
const Logger = require("src/core/logging/Logger")
      requestAnimationFrame(() => {
const Logger = require("src/core/logging/Logger")
        this.renderBookBatch(visibleBooks, positions, this.visibleRange.start)

const Logger = require("src/core/logging/Logger")
        // 更新統計
const Logger = require("src/core/logging/Logger")
        this.stats.renderTime = performance.now() - startTime
const Logger = require("src/core/logging/Logger")
        this.stats.renderedBooks = visibleBooks.length
const Logger = require("src/core/logging/Logger")
        this.stats.lastRenderTime = Date.now()

const Logger = require("src/core/logging/Logger")
        this.notifyRenderComplete()
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
    } else {
const Logger = require("src/core/logging/Logger")
      this.renderBookBatch(visibleBooks, positions, this.visibleRange.start)
const Logger = require("src/core/logging/Logger")
      this.stats.renderTime = performance.now() - startTime
const Logger = require("src/core/logging/Logger")
      this.stats.renderedBooks = visibleBooks.length
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 批次渲染書籍
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Array} books - 書籍陣列
const Logger = require("src/core/logging/Logger")
   * @param {Array} positions - 位置陣列
const Logger = require("src/core/logging/Logger")
   * @param {number} startIndex - 開始索引
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  renderBookBatch (books, positions, startIndex) {
const Logger = require("src/core/logging/Logger")
    books.forEach((book, index) => {
const Logger = require("src/core/logging/Logger")
      const globalIndex = startIndex + index
const Logger = require("src/core/logging/Logger")
      const position = positions[globalIndex]

const Logger = require("src/core/logging/Logger")
      if (position && this.isValidBook(book)) {
const Logger = require("src/core/logging/Logger")
        const card = this.createBookCard(book)

const Logger = require("src/core/logging/Logger")
        // 設定位置
const Logger = require("src/core/logging/Logger")
        card.style.left = `${position.x}px`
const Logger = require("src/core/logging/Logger")
        card.style.top = `${position.y}px`

const Logger = require("src/core/logging/Logger")
        try {
const Logger = require("src/core/logging/Logger")
          this.container.appendChild(card)
const Logger = require("src/core/logging/Logger")
          this.renderedBooks.push(card)
const Logger = require("src/core/logging/Logger")
        } catch (error) {
const Logger = require("src/core/logging/Logger")
          // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
          Logger.warn('Failed to append book card:', error)
const Logger = require("src/core/logging/Logger")
        }
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    })

const Logger = require("src/core/logging/Logger")
    // 設定容器總高度
const Logger = require("src/core/logging/Logger")
    this.container.style.height = `${this.totalHeight}px`
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 清除已渲染的書籍
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  clearRenderedBooks () {
const Logger = require("src/core/logging/Logger")
    this.renderedBooks.forEach(card => {
const Logger = require("src/core/logging/Logger")
      try {
const Logger = require("src/core/logging/Logger")
        if (card.parentNode === this.container) {
const Logger = require("src/core/logging/Logger")
          this.container.removeChild(card)
const Logger = require("src/core/logging/Logger")
        }
const Logger = require("src/core/logging/Logger")
      } catch (error) {
const Logger = require("src/core/logging/Logger")
        // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
        Logger.warn('Failed to remove book card:', error)
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
    this.renderedBooks = []
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 更新書籍資料
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Array} books - 書籍陣列
const Logger = require("src/core/logging/Logger")
   * @param {Object} options - 選項
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  updateBooks (books, options = {}) {
const Logger = require("src/core/logging/Logger")
    // 驗證和過濾書籍資料
const Logger = require("src/core/logging/Logger")
    this.books = this.validateAndFilterBooks(books)
const Logger = require("src/core/logging/Logger")
    this.stats.totalBooks = this.books.length

const Logger = require("src/core/logging/Logger")
    // 更新佈局
const Logger = require("src/core/logging/Logger")
    this.updateLayout()

const Logger = require("src/core/logging/Logger")
    // 保持滾動位置（如果需要）
const Logger = require("src/core/logging/Logger")
    if (!options.preserveScrollPosition) {
const Logger = require("src/core/logging/Logger")
      this.container.scrollTop = 0
const Logger = require("src/core/logging/Logger")
      this.scrollTop = 0
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 重新渲染
const Logger = require("src/core/logging/Logger")
    this.renderVisibleBooks()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 驗證和過濾書籍資料
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Array} books - 原始書籍陣列
const Logger = require("src/core/logging/Logger")
   * @returns {Array} 過濾後的書籍陣列
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  validateAndFilterBooks (books) {
const Logger = require("src/core/logging/Logger")
    if (!Array.isArray(books)) {
const Logger = require("src/core/logging/Logger")
      return []
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    return books.filter(book => this.isValidBook(book))
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 檢查書籍是否有效
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} book - 書籍物件
const Logger = require("src/core/logging/Logger")
   * @returns {boolean} 是否有效
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  isValidBook (book) {
const Logger = require("src/core/logging/Logger")
    return book &&
const Logger = require("src/core/logging/Logger")
           typeof book === 'object' &&
const Logger = require("src/core/logging/Logger")
           book.id &&
const Logger = require("src/core/logging/Logger")
           typeof book.id === 'string'
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理書籍更新事件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} event - 事件物件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleBooksUpdate (event) {
const Logger = require("src/core/logging/Logger")
    if (event && event.data && Array.isArray(event.data.books)) {
const Logger = require("src/core/logging/Logger")
      this.updateBooks(event.data.books)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理書籍篩選事件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} event - 事件物件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleBooksFilter (event) {
const Logger = require("src/core/logging/Logger")
    if (event && event.data) {
const Logger = require("src/core/logging/Logger")
      // 重新渲染以反映篩選結果
const Logger = require("src/core/logging/Logger")
      this.renderVisibleBooks()
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 通知渲染完成
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  notifyRenderComplete () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
const Logger = require("src/core/logging/Logger")
        this.eventBus.emit('UI.GRID.RENDER_COMPLETE', {
const Logger = require("src/core/logging/Logger")
          totalBooks: this.stats.totalBooks,
const Logger = require("src/core/logging/Logger")
          renderedBooks: this.stats.renderedBooks,
const Logger = require("src/core/logging/Logger")
          renderTime: this.stats.renderTime
const Logger = require("src/core/logging/Logger")
        })
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.warn('Failed to notify render complete:', error)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 銷毀渲染器
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  destroy () {
const Logger = require("src/core/logging/Logger")
    // 清除事件監聽器
const Logger = require("src/core/logging/Logger")
    if (this.eventBus && typeof this.eventBus.off === 'function') {
const Logger = require("src/core/logging/Logger")
      this.eventBus.off('UI.BOOKS.UPDATE', this.handleBooksUpdate)
const Logger = require("src/core/logging/Logger")
      this.eventBus.off('UI.BOOKS.FILTER', this.handleBooksFilter)
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    this.container.removeEventListener?.('scroll', this.boundHandleScroll)
const Logger = require("src/core/logging/Logger")
    if (typeof window !== 'undefined') {
const Logger = require("src/core/logging/Logger")
      window.removeEventListener?.('resize', this.boundHandleResize)
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 清除定時器
const Logger = require("src/core/logging/Logger")
    if (this.throttleTimer) {
const Logger = require("src/core/logging/Logger")
      clearTimeout(this.throttleTimer)
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 清除渲染內容
const Logger = require("src/core/logging/Logger")
    this.clearRenderedBooks()

const Logger = require("src/core/logging/Logger")
    // 清除引用
const Logger = require("src/core/logging/Logger")
    this.books = []
const Logger = require("src/core/logging/Logger")
    this.renderedBooks = []
const Logger = require("src/core/logging/Logger")
    this.container = null
const Logger = require("src/core/logging/Logger")
    this.eventBus = null
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 取得統計資訊
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {Object} 統計資訊
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  getStats () {
const Logger = require("src/core/logging/Logger")
    return { ...this.stats }
const Logger = require("src/core/logging/Logger")
  }
const Logger = require("src/core/logging/Logger")
}

const Logger = require("src/core/logging/Logger")
module.exports = BookGridRenderer
