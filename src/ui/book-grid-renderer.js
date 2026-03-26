/**
 * BookGridRenderer - 書籍網格渲染器
 * TDD 循環 #27 - 重構階段優化
 *
 * 負責功能：
 * - 書籍網格渲染和佈局管理
 * - 響應式設計適配不同螢幕尺寸
 * - 虛擬滾動支援大量資料處理
 * - 書籍卡片互動功能
 * - 效能優化和記憶體管理
 *
 * 設計考量：
 * - 基於事件驅動架構與系統整合
 * - 響應式網格佈局自動適配螢幕尺寸
 * - 虛擬滾動優化大量資料處理效能
 * - 記憶體管理避免 DOM 元素累積
 * - 完整錯誤處理和邊界條件處理
 * - 使用統一配置管理系統
 *
 * 處理流程：
 * 1. 初始化容器和事件系統
 * 2. 計算響應式網格佈局
 * 3. 創建和管理書籍卡片
 * 4. 實現虛擬滾動機制
 * 5. 處理使用者互動事件
 * 6. 優化渲染效能和記憶體使用
 *
 * 使用情境：
 * - Overview 頁面書籍展示
 * - 大量書籍資料的高效渲染
 * - 響應式書籍瀏覽體驗
 *
 * @version 1.1.0
 * @since 2025-08-07
 */

const UI_HANDLER_CONFIG = require('./config/ui-handler-config')
const ErrorCodes = require('src/core/errors/ErrorCodes')
const { Logger } = require('src/core/logging/Logger')

class BookGridRenderer {
  /**
   * 建構 BookGridRenderer 實例
   *
   * @param {HTMLElement} container - 渲染容器
   * @param {Object} eventBus - 事件總線
   * @param {Object} options - 配置選項，預設為空物件
   * @param {Document|null} document - 文檔對象，支援依賴注入。
   *                                   在測試環境中可注入 mock document，
   *                                   在瀏覽器環境中會自動使用 window.document
   *
   * @example
   * // 瀏覽器環境使用
   * const renderer = new BookGridRenderer(container, eventBus);
   *
   * // 測試環境使用
   * const renderer = new BookGridRenderer(container, eventBus, {}, mockDocument);
   */
  constructor (container, eventBus, options = {}, document = null) {
    if (!container) {
      const error = new Error('Container is required')
      error.code = ErrorCodes.REQUIRED_FIELD_MISSING
      error.details = { category: 'ui' }
      throw error
    }

    this.container = container
    this.eventBus = eventBus

    // 依賴注入模式 - 支援測試環境的 DOM 模擬
    // 這個設計遵循依賴注入原則，使得組件可以在不同環境中運作：
    // 1. 瀏覽器環境：自動使用 window.document
    // 2. 測試環境：注入 mock document 以支援單元測試
    // 3. Node.js 環境：拋出錯誤以提早發現配置問題
    this.document = document || (typeof window !== 'undefined' ? window.document : null)

    if (!this.document) {
      const error = new Error('Document is required for BookGridRenderer. ' +
                     'In test environments, please inject a mock document.')
      error.code = ErrorCodes.REQUIRED_FIELD_MISSING
      error.details = { category: 'ui' }
      throw error
    }

    // 初始化資料
    this.books = []
    this.renderedBooks = []

    // 初始化配置
    this.initializeConfig(options)

    // 初始化統計
    this.initializeStats()

    // 初始化狀態
    this.initializeState()

    // 初始化事件監聽
    this.initializeEventListeners()

    // 初始化佈局
    this.initializeLayout()
  }

  /**
   * 初始化配置參數
   * 使用統一配置系統並合併自訂選項
   *
   * @param {Object} options - 自訂配置選項
   */
  initializeConfig (options) {
    // 從統一配置系統載入網格配置
    const gridConfig = this.loadGridConfiguration()
    const performanceConfig = UI_HANDLER_CONFIG.PERFORMANCE
    const environmentConfig = UI_HANDLER_CONFIG.getEnvironmentConfig(process.env.NODE_ENV)

    // 合併所有配置來源
    this.config = UI_HANDLER_CONFIG.mergeConfig(gridConfig, {
      ...performanceConfig,
      ...environmentConfig,
      ...options
    })

    // 設定常數
    this.CONSTANTS = this.initializeConstants()
  }

  /**
   * 載入網格特定配置
   *
   * @returns {Object} 網格配置物件
   */
  loadGridConfiguration () {
    return {
      // 卡片尺寸配置
      cardWidth: 200,
      cardHeight: 300,
      minCardWidth: 150,
      maxCardWidth: 250,

      // 佈局配置
      gap: 16,
      minGap: 8,
      maxGap: 24,
      virtualScrolling: true,
      bufferSize: 5,

      // 效能配置
      throttleDelay: 100,
      renderBatchSize: 10,
      animationDuration: 300,

      // 響應式斷點
      breakpoints: {
        mobile: 480,
        tablet: 768,
        desktop: 1024,
        largeDesktop: 1200
      },

      // 錯誤處理
      maxRetries: 3,
      enableErrorLogging: true
    }
  }

  /**
   * 初始化常數定義
   *
   * @returns {Object} 常數物件
   */
  initializeConstants () {
    return {
      // CSS 類別名稱
      CLASSES: {
        BOOK_CARD: 'book-card',
        BOOK_COVER: 'book-cover',
        BOOK_INFO: 'book-info',
        BOOK_TITLE: 'book-title',
        BOOK_AUTHOR: 'book-author',
        PROGRESS_CONTAINER: 'progress-container',
        PROGRESS_BAR: 'progress-bar',
        DEFAULT_COVER: 'default-cover'
      },

      // 狀態類別前綴
      STATUS_PREFIX: 'status-',

      // 事件名稱
      EVENTS: {
        RENDER_COMPLETE: 'UI.GRID.RENDER_COMPLETE',
        BOOKS_UPDATE: 'UI.BOOKS.UPDATE',
        BOOKS_FILTER: 'UI.BOOKS.FILTER'
      },

      // 錯誤類型
      ERROR_TYPES: UI_HANDLER_CONFIG.ERROR_TYPES
    }
  }

  /**
   * 初始化統計追蹤
   */
  initializeStats () {
    this.stats = {
      totalBooks: 0,
      renderedBooks: 0,
      renderTime: 0,
      scrollEvents: 0,
      lastRenderTime: 0
    }
  }

  /**
   * 初始化內部狀態
   */
  initializeState () {
    this.currentColumns = 1
    this.visibleRange = { start: 0, end: 0 }
    this.scrollTop = 0
    this.containerHeight = 0
    this.totalHeight = 0
    this.cardPool = [] // DOM 元素池
    this.throttleTimer = null
  }

  /**
   * 初始化事件監聽器
   */
  initializeEventListeners () {
    if (this.eventBus && typeof this.eventBus.on === 'function') {
      this.eventBus.on('UI.BOOKS.UPDATE', this.handleBooksUpdate.bind(this))
      this.eventBus.on('UI.BOOKS.FILTER', this.handleBooksFilter.bind(this))
    }

    // 容器滾動事件
    this.boundHandleScroll = this.handleScroll.bind(this)
    this.container.addEventListener?.('scroll', this.boundHandleScroll)

    // 視窗大小變化事件
    this.boundHandleResize = this.handleResize.bind(this)
    if (typeof window !== 'undefined') {
      window.addEventListener?.('resize', this.boundHandleResize)
    }
  }

  /**
   * 初始化佈局
   */
  initializeLayout () {
    this.updateLayout()
  }

  /**
   * 計算網格欄位數量
   * 使用配置化的響應式斷點
   *
   * @param {number} containerWidth - 容器寬度
   * @returns {number} 欄位數量
   */
  calculateColumns (containerWidth) {
    if (containerWidth <= 0) {
      return 1
    }

    const { cardWidth, gap, breakpoints } = this.config
    const availableWidth = containerWidth - gap
    const columnWidth = cardWidth + gap
    const maxColumns = Math.floor(availableWidth / columnWidth)

    // 根據響應式斷點限制最大欄數
    if (containerWidth <= breakpoints.mobile) {
      return 1 // 手機：單欄
    } else if (containerWidth <= breakpoints.tablet) {
      return Math.min(maxColumns, 2) // 平板：最多2欄
    } else if (containerWidth <= breakpoints.desktop) {
      return Math.min(maxColumns, 3) // 小桌面：最多3欄
    } else if (containerWidth <= breakpoints.largeDesktop) {
      return Math.min(maxColumns, 4) // 大桌面：最多4欄
    } else {
      return Math.min(maxColumns, 5) // 超大螢幕：最多5欄
    }
  }

  /**
   * 計算書籍卡片位置
   *
   * @param {Array} books - 書籍陣列
   * @param {number} columns - 欄位數量
   * @returns {Array} 位置陣列
   */
  calculatePositions (books, columns) {
    const positions = []
    const { cardWidth, cardHeight, gap } = this.config

    books.forEach((book, index) => {
      const row = Math.floor(index / columns)
      const col = index % columns
      const x = col * (cardWidth + gap) + gap
      const y = row * (cardHeight + gap) + gap

      positions.push({ row, col, x, y })
    })

    return positions
  }

  /**
   * 計算容器總高度
   *
   * @param {Array} books - 書籍陣列
   * @param {number} columns - 欄位數量
   * @returns {number} 總高度
   */
  calculateTotalHeight (books, columns) {
    if (books.length === 0) return 0

    const { cardHeight, gap } = this.config
    const rows = Math.ceil(books.length / columns)

    return rows * (cardHeight + gap) + gap
  }

  /**
   * 計算間距
   *
   * @param {number} containerWidth - 容器寬度
   * @returns {number} 間距值
   */
  calculateGap (containerWidth) {
    if (containerWidth <= 480) return 8 // 手機小間距
    if (containerWidth <= 768) return 12 // 平板中等間距
    return 16 // 桌面大間距
  }

  /**
   * 更新佈局
   */
  updateLayout () {
    const rect = this.container.getBoundingClientRect()
    const containerWidth = rect.width
    const containerHeight = rect.height

    this.currentColumns = this.calculateColumns(containerWidth)
    this.containerHeight = containerHeight
    this.config.gap = this.calculateGap(containerWidth)
    this.totalHeight = this.calculateTotalHeight(this.books, this.currentColumns)

    // 更新可見範圍
    this.updateVisibleRange()
  }

  /**
   * 創建書籍卡片
   * 使用常數定義和改善的錯誤處理
   *
   * @param {Object} book - 書籍資料
   * @returns {HTMLElement} 書籍卡片元素
   */
  createBookCard (book) {
    try {
      const card = this.document.createElement('div')
      const { BOOK_CARD } = this.CONSTANTS.CLASSES
      const { STATUS_PREFIX } = this.CONSTANTS

      card.classList.add(BOOK_CARD)
      card.setAttribute('data-book-id', book.id)

      // 設定基本樣式
      this.setCardBaseStyles(card)

      // 創建卡片內容
      this.populateBookCard(card, book)

      // 添加狀態樣式
      if (book.status && typeof book.status === 'string') {
        card.classList.add(`${STATUS_PREFIX}${book.status}`)
      }

      return card
    } catch (error) {
      this.handleCardCreationError(book, error)
      return this.createFallbackCard(book)
    }
  }

  /**
   * 設定卡片基本樣式
   *
   * @param {HTMLElement} card - 卡片元素
   */
  setCardBaseStyles (card) {
    const { cardWidth, cardHeight } = this.config

    Object.assign(card.style, {
      position: 'absolute',
      width: `${cardWidth}px`,
      height: `${cardHeight}px`,
      boxSizing: 'border-box'
    })
  }

  /**
   * 處理卡片創建錯誤
   *
   * @param {Object} book - 書籍資料
   * @param {Error} error - 錯誤物件
   */
  handleCardCreationError (book, error) {
    if (this.config.enableErrorLogging) {
      // eslint-disable-next-line no-console
      Logger.error(`[BookGridRenderer] Failed to create card for book ${book.id}`, { error })
    }

    // 更新錯誤統計
    this.stats.cardCreationErrors = (this.stats.cardCreationErrors || 0) + 1
  }

  /**
   * 創建備用卡片
   *
   * @param {Object} book - 書籍資料
   * @returns {HTMLElement} 備用卡片元素
   */
  createFallbackCard (book) {
    const card = this.document.createElement('div')
    card.classList.add(this.CONSTANTS.CLASSES.BOOK_CARD, 'fallback-card')
    card.setAttribute('data-book-id', book.id)
    card.textContent = book.title || 'Unknown Book'

    this.setCardBaseStyles(card)

    return card
  }

  /**
   * 填充書籍卡片內容
   * 使用常數定義和改善的結構化方法
   *
   * @param {HTMLElement} card - 卡片元素
   * @param {Object} book - 書籍資料
   */
  populateBookCard (card, book) {
    const { CLASSES } = this.CONSTANTS

    try {
      // 創建封面區域
      const coverContainer = this.createCoverContainer(book, CLASSES)
      card.appendChild(coverContainer)

      // 創建資訊區域
      const infoContainer = this.createInfoContainer(book, CLASSES)
      card.appendChild(infoContainer)

      // 創建進度指示器
      if (this.shouldShowProgress(book)) {
        const progressContainer = this.createProgressContainer(book, CLASSES)
        card.appendChild(progressContainer)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.warn(`[BookGridRenderer] Failed to populate card for book ${book.id}`, { error })
    }
  }

  /**
   * 創建封面容器
   *
   * @param {Object} book - 書籍資料
   * @param {Object} CLASSES - CSS 類別常數
   * @returns {HTMLElement} 封面容器元素
   */
  createCoverContainer (book, CLASSES) {
    const coverContainer = this.document.createElement('div')
    coverContainer.classList.add(CLASSES.BOOK_COVER)

    if (book.coverImage && typeof book.coverImage === 'string') {
      const coverImg = this.document.createElement('img')
      coverImg.src = book.coverImage
      coverImg.alt = book.title || 'Book cover'
      coverImg.loading = 'lazy' // 延遲載入優化

      // 錯誤處理
      coverImg.onerror = () => {
        this.handleImageError(coverContainer, book)
      }

      coverContainer.appendChild(coverImg)
    } else {
      this.createDefaultCover(coverContainer, book, CLASSES)
    }

    return coverContainer
  }

  /**
   * 創建預設封面
   *
   * @param {HTMLElement} container - 封面容器
   * @param {Object} book - 書籍資料
   * @param {Object} CLASSES - CSS 類別常數
   */
  createDefaultCover (container, book, CLASSES) {
    container.classList.add(CLASSES.DEFAULT_COVER)

    // 使用書籍標題首字母或預設圖示
    const displayText = book.title?.charAt(0)?.toUpperCase() || '📖'
    container.textContent = displayText
  }

  /**
   * 處理圖片載入錯誤
   *
   * @param {HTMLElement} container - 封面容器
   * @param {Object} book - 書籍資料
   */
  handleImageError (container, book) {
    // 移除錯誤的圖片
    const img = container.querySelector('img')
    if (img) {
      container.removeChild(img)
    }

    // 建立預設封面
    this.createDefaultCover(container, book, this.CONSTANTS.CLASSES)
  }

  /**
   * 創建資訊容器
   *
   * @param {Object} book - 書籍資料
   * @param {Object} CLASSES - CSS 類別常數
   * @returns {HTMLElement} 資訊容器元素
   */
  createInfoContainer (book, CLASSES) {
    const infoContainer = this.document.createElement('div')
    infoContainer.classList.add(CLASSES.BOOK_INFO)

    // 添加標題
    if (book.title && typeof book.title === 'string') {
      const title = this.document.createElement('h3')
      title.classList.add(CLASSES.BOOK_TITLE)
      title.textContent = this.truncateText(book.title, 50)
      title.title = book.title // 完整標題作為 tooltip
      infoContainer.appendChild(title)
    }

    // 添加作者
    if (book.author && typeof book.author === 'string') {
      const author = this.document.createElement('p')
      author.classList.add(CLASSES.BOOK_AUTHOR)
      author.textContent = this.truncateText(book.author, 30)
      author.title = book.author // 完整作者名作為 tooltip
      infoContainer.appendChild(author)
    }

    return infoContainer
  }

  /**
   * 創建進度容器
   *
   * @param {Object} book - 書籍資料
   * @param {Object} CLASSES - CSS 類別常數
   * @returns {HTMLElement} 進度容器元素
   */
  createProgressContainer (book, CLASSES) {
    const progressContainer = this.document.createElement('div')
    progressContainer.classList.add(CLASSES.PROGRESS_CONTAINER)

    const progressBar = this.document.createElement('div')
    progressBar.classList.add(CLASSES.PROGRESS_BAR)

    // 正規化進度值（0-100）
    const normalizedProgress = this.normalizeProgress(book.progress)
    progressBar.style.width = `${normalizedProgress}%`

    // 添加進度文字
    const progressText = this.document.createElement('span')
    progressText.classList.add('progress-text')
    progressText.textContent = `${normalizedProgress}%`

    progressContainer.appendChild(progressBar)
    progressContainer.appendChild(progressText)

    return progressContainer
  }

  /**
   * 檢查是否應該顯示進度
   *
   * @param {Object} book - 書籍資料
   * @returns {boolean} 是否顯示進度
   */
  shouldShowProgress (book) {
    return typeof book.progress === 'number' &&
           !isNaN(book.progress) &&
           book.progress >= 0
  }

  /**
   * 正規化進度值
   *
   * @param {number} progress - 原始進度值
   * @returns {number} 正規化後的進度值 (0-100)
   */
  normalizeProgress (progress) {
    if (typeof progress !== 'number' || isNaN(progress)) {
      return 0
    }
    return Math.max(0, Math.min(100, Math.round(progress)))
  }

  /**
   * 截斷文字
   *
   * @param {string} text - 原始文字
   * @param {number} maxLength - 最大長度
   * @returns {string} 截斷後的文字
   */
  truncateText (text, maxLength) {
    if (!text || typeof text !== 'string') {
      return ''
    }

    if (text.length <= maxLength) {
      return text
    }

    return text.substring(0, maxLength - 3) + '...'
  }

  /**
   * 處理尺寸變化
   */
  handleResize () {
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer)
    }

    this.throttleTimer = setTimeout(() => {
      this.updateLayout()
      this.renderVisibleBooks()
    }, this.config.throttleDelay)
  }

  /**
   * 處理滾動事件
   */
  handleScroll () {
    this.stats.scrollEvents++

    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer)
    }

    this.throttleTimer = setTimeout(() => {
      this.scrollTop = this.container.scrollTop
      this.updateVisibleRange()
      this.renderVisibleBooks()
    }, this.config.throttleDelay)
  }

  /**
   * 計算可見區域範圍
   *
   * @returns {Object} 可見範圍 {start, end}
   */
  calculateVisibleRange () {
    const { cardHeight, gap } = this.config
    const rowHeight = cardHeight + gap
    const bufferRows = this.config.bufferSize

    const startRow = Math.max(0, Math.floor(this.scrollTop / rowHeight) - bufferRows)
    const endRow = Math.min(
      Math.ceil(this.books.length / this.currentColumns),
      Math.ceil((this.scrollTop + this.containerHeight) / rowHeight) + bufferRows
    )

    const start = startRow * this.currentColumns
    const end = Math.min(this.books.length, endRow * this.currentColumns)

    return { start, end }
  }

  /**
   * 更新可見範圍
   */
  updateVisibleRange () {
    this.visibleRange = this.calculateVisibleRange()
  }

  /**
   * 渲染可見的書籍
   */
  renderVisibleBooks () {
    const startTime = performance.now()

    // 清除現有渲染
    this.clearRenderedBooks()

    // 渲染可見範圍內的書籍
    const visibleBooks = this.books.slice(this.visibleRange.start, this.visibleRange.end)
    const positions = this.calculatePositions(this.books, this.currentColumns)

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        this.renderBookBatch(visibleBooks, positions, this.visibleRange.start)

        // 更新統計
        this.stats.renderTime = performance.now() - startTime
        this.stats.renderedBooks = visibleBooks.length
        this.stats.lastRenderTime = Date.now()

        this.notifyRenderComplete()
      })
    } else {
      this.renderBookBatch(visibleBooks, positions, this.visibleRange.start)
      this.stats.renderTime = performance.now() - startTime
      this.stats.renderedBooks = visibleBooks.length
    }
  }

  /**
   * 批次渲染書籍
   *
   * @param {Array} books - 書籍陣列
   * @param {Array} positions - 位置陣列
   * @param {number} startIndex - 開始索引
   */
  renderBookBatch (books, positions, startIndex) {
    books.forEach((book, index) => {
      const globalIndex = startIndex + index
      const position = positions[globalIndex]

      if (position && this.isValidBook(book)) {
        const card = this.createBookCard(book)

        // 設定位置
        card.style.left = `${position.x}px`
        card.style.top = `${position.y}px`

        try {
          this.container.appendChild(card)
          this.renderedBooks.push(card)
        } catch (error) {
          // eslint-disable-next-line no-console
          Logger.warn('Failed to append book card', { error })
        }
      }
    })

    // 設定容器總高度
    this.container.style.height = `${this.totalHeight}px`
  }

  /**
   * 清除已渲染的書籍
   */
  clearRenderedBooks () {
    this.renderedBooks.forEach(card => {
      try {
        if (card.parentNode === this.container) {
          this.container.removeChild(card)
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        Logger.warn('Failed to remove book card', { error })
      }
    })
    this.renderedBooks = []
  }

  /**
   * 更新書籍資料
   *
   * @param {Array} books - 書籍陣列
   * @param {Object} options - 選項
   */
  updateBooks (books, options = {}) {
    // 驗證和過濾書籍資料
    this.books = this.validateAndFilterBooks(books)
    this.stats.totalBooks = this.books.length

    // 更新佈局
    this.updateLayout()

    // 保持滾動位置（如果需要）
    if (!options.preserveScrollPosition) {
      this.container.scrollTop = 0
      this.scrollTop = 0
    }

    // 重新渲染
    this.renderVisibleBooks()
  }

  /**
   * 驗證和過濾書籍資料
   *
   * @param {Array} books - 原始書籍陣列
   * @returns {Array} 過濾後的書籍陣列
   */
  validateAndFilterBooks (books) {
    if (!Array.isArray(books)) {
      return []
    }

    return books.filter(book => this.isValidBook(book))
  }

  /**
   * 檢查書籍是否有效
   *
   * @param {Object} book - 書籍物件
   * @returns {boolean} 是否有效
   */
  isValidBook (book) {
    return book &&
           typeof book === 'object' &&
           book.id &&
           typeof book.id === 'string'
  }

  /**
   * 處理書籍更新事件
   *
   * @param {Object} event - 事件物件
   */
  handleBooksUpdate (event) {
    if (event && event.data && Array.isArray(event.data.books)) {
      this.updateBooks(event.data.books)
    }
  }

  /**
   * 處理書籍篩選事件
   *
   * @param {Object} event - 事件物件
   */
  handleBooksFilter (event) {
    if (event && event.data) {
      // 重新渲染以反映篩選結果
      this.renderVisibleBooks()
    }
  }

  /**
   * 通知渲染完成
   */
  notifyRenderComplete () {
    try {
      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        this.eventBus.emit('UI.GRID.RENDER_COMPLETE', {
          totalBooks: this.stats.totalBooks,
          renderedBooks: this.stats.renderedBooks,
          renderTime: this.stats.renderTime
        })
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.warn('Failed to notify render complete', { error })
    }
  }

  /**
   * 銷毀渲染器
   */
  destroy () {
    // 清除事件監聽器
    if (this.eventBus && typeof this.eventBus.off === 'function') {
      this.eventBus.off('UI.BOOKS.UPDATE', this.handleBooksUpdate)
      this.eventBus.off('UI.BOOKS.FILTER', this.handleBooksFilter)
    }

    this.container.removeEventListener?.('scroll', this.boundHandleScroll)
    if (typeof window !== 'undefined') {
      window.removeEventListener?.('resize', this.boundHandleResize)
    }

    // 清除定時器
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer)
    }

    // 清除渲染內容
    this.clearRenderedBooks()

    // 清除引用
    this.books = []
    this.renderedBooks = []
    this.container = null
    this.eventBus = null
  }

  /**
   * 取得統計資訊
   *
   * @returns {Object} 統計資訊
   */
  getStats () {
    return { ...this.stats }
  }
}

module.exports = BookGridRenderer
