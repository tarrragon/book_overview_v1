/**
 * Overview 頁面控制器 - TDD 循環 #26
 * 基於 EventHandler 實現 Overview 頁面與事件系統的整合
 *
 * 負責功能：
 * - 管理 Overview 頁面的初始化和資料顯示
 * - 處理事件驅動的資料載入和更新
 * - 提供搜尋、篩選和匯出功能
 * - 整合儲存系統和 UI 狀態管理
 *
 * 設計考量：
 * - 繼承 EventHandler 提供標準化的事件處理流程
 * - 響應式資料更新機制
 * - 完整的錯誤處理和載入狀態管理
 * - 支援多種資料來源和格式
 *
 * 處理流程：
 * 1. 初始化 DOM 元素引用和事件監聽器
 * 2. 處理儲存系統載入完成事件
 * 3. 管理書籍資料的顯示和篩選
 * 4. 提供使用者操作功能（搜尋、匯出、重載）
 * 5. 維護頁面狀態和統計資訊
 *
 * 使用情境：
 * - Overview 頁面的主要控制器
 * - 事件驅動的資料管理
 * - 使用者互動功能的協調中心
 */

// 動態取得 EventHandler（支援瀏覽器和 Node.js）
let EventHandlerClass
let ErrorCodes
if (typeof window !== 'undefined') {
  // 瀏覽器環境：從全域變數取得（應該已由 event-handler.js 載入）
  EventHandlerClass = window.EventHandler
  ErrorCodes = window.ErrorCodes
  if (!EventHandlerClass) {
    const error = new Error('EventHandler 未在全域變數中找到，請確認 event-handler.js 已正確載入')
    error.code = ErrorCodes?.DEPENDENCY_ERROR || 'DEPENDENCY_ERROR'
    error.details = { category: 'dependency' }
    throw error
  }
} else {
  // Node.js 環境：使用 require
  EventHandlerClass = require('src/core/event-handler')
  const { ErrorCodes: ImportedErrorCodes } = require('src/core/errors/ErrorCodes')
  ErrorCodes = ImportedErrorCodes
}

// 常數定義
const CONSTANTS = {
  // 控制器配置
  PRIORITY: 2,

  // UI 訊息
  MESSAGES: {
    DEFAULT_LOAD: '載入中...',
    RELOAD: '重新載入書籍資料...',
    EMPTY_BOOKS: '📚 目前沒有書籍資料',
    NO_DATA_EXPORT: '沒有資料可以匯出',
    FILE_PARSE_ERROR: '檔案解析失敗',
    FILE_READ_ERROR: '檔案讀取失敗',
    INVALID_JSON: '無效的 JSON 格式'
  },

  // 表格配置
  TABLE: {
    COLUMNS: 5,
    COVER_SIZE: { WIDTH: 50, HEIGHT: 75 },
    DEFAULT_COVER: '📚'
  },

  // 事件配置
  EVENTS: {
    SUPPORTED: [
      'STORAGE.LOAD.COMPLETED',
      'EXTRACTION.COMPLETED',
      'UI.BOOKS.UPDATE'
    ],
    STORAGE_LOAD_REQUEST: 'STORAGE.LOAD.REQUESTED'
  },

  // 匯出配置
  EXPORT: {
    CSV_HEADERS: ['書名', '書城來源', '進度', '狀態', '封面URL'],
    FILE_TYPE: 'text/csv;charset=utf-8;',
    FILENAME_PREFIX: '書籍資料_',
    JSON_MIME: 'application/json;charset=utf-8;',
    JSON_FILENAME_PREFIX: '書籍資料_'
  },

  // 元素選取器
  SELECTORS: {
    LOADING_TEXT: '.loading-text'
  }
}

class OverviewPageController extends EventHandlerClass {
  /**
   * 建構 Overview 頁面控制器
   *
   * @param {Object} eventBus - 事件總線實例
   * @param {Document} document - DOM 文檔物件
   *
   * 負責功能：
   * - 初始化事件處理器基本配置
   * - 設定 DOM 文檔引用
   * - 初始化頁面狀態和元素引用
   * - 設置事件監聽器
   */
  constructor (eventBus, document) {
    super('OverviewPageController', CONSTANTS.PRIORITY)

    this.eventBus = eventBus
    this.document = document

    // 初始化頁面狀態
    this.currentBooks = []
    this.filteredBooks = []
    this.isLoading = false
    this.searchTerm = ''

    // 初始化 DOM 元素引用
    this.initializeElements()

    // 設置事件監聽器
    this.setupEventListeners()
  }

  // Getter 方法：為了向後相容，提供 books 屬性存取
  get books () {
    return this.currentBooks
  }

  // Setter 方法：統一書籍資料設定
  set books (value) {
    this.currentBooks = value
    this.filteredBooks = [...value] // 預設顯示全部書籍
  }

  /**
   * 初始化 DOM 元素引用
   *
   * 負責功能：
   * - 取得所有必要的 DOM 元素引用
   * - 建立元素快取以提高效能
   * - 分類組織元素引用
   */
  initializeElements () {
    // 定義元素映射表，提高可維護性
    const elementMap = {
      // 統計相關元素
      statistics: ['totalBooks', 'displayedBooks'],
      // 搜尋相關元素
      search: ['searchBox'],
      // 表格相關元素
      table: ['tableBody', 'booksTable'],
      // 操作按鈕元素
      buttons: ['exportCSVBtn', 'exportJSONBtn', 'importJSONBtn', 'copyTextBtn', 'selectAllBtn', 'reloadBtn'],
      // 檔案載入相關元素
      fileLoad: ['fileUploader', 'jsonFileInput', 'loadFileBtn', 'loadSampleBtn', 'sortSelect', 'sortDirection'],
      // 狀態顯示元素
      status: ['loadingIndicator', 'errorContainer', 'errorMessage', 'retryBtn']
    }

    // 批量取得元素引用
    this.elements = {}
    Object.values(elementMap).flat().forEach(id => {
      this.elements[id] = this.document.getElementById(id)
    })

    // 快取常用元素
    this.cachedElements = {
      loadingText: this.document.querySelector(CONSTANTS.SELECTORS.LOADING_TEXT)
    }
  }

  /**
   * 設置事件監聽器
   *
   * 負責功能：
   * - 註冊系統事件監聽器
   * - 設置 DOM 事件監聽器
   */
  setupEventListeners () {
    // 註冊系統事件監聽器
    if (this.eventBus) {
      this.eventBus.on('STORAGE.LOAD.COMPLETED', this.handleStorageLoadCompleted.bind(this))
      this.eventBus.on('EXTRACTION.COMPLETED', this.handleExtractionCompleted.bind(this))
      this.eventBus.on('UI.BOOKS.UPDATE', this.handleBooksUpdate.bind(this))
    }

    // 監聽 Chrome Storage 資料變更，實現跨上下文的自動資料同步
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        try {
          if (area === 'local' && changes.readmoo_books && changes.readmoo_books.newValue) {
            const newValue = changes.readmoo_books.newValue
            const books = Array.isArray(newValue.books) ? newValue.books : []
            this._updateBooksData(books)
            this.updateDisplay()
          }
        } catch (error) {
          // Logger 後備方案: UI Component 輕量化設計
          // 設計理念: Overview 頁面組件優先保持輕量，避免依賴重量級 Logger
          // 後備機制: console.warn 提供 storage 事件處理錯誤的基本可見性
          // 使用場景: Chrome Storage API 事件監聽錯誤，不應中斷頁面功能
          // eslint-disable-next-line no-console
          console.warn('⚠️ 處理 storage 變更失敗:', error)
        }
      })
    }

    // 設置 DOM 事件監聽器
    if (this.elements.searchBox) {
      this.elements.searchBox.addEventListener('input', (e) => {
        this.handleSearchInput(e.target.value)
      })
    }

    if (this.elements.reloadBtn) {
      this.elements.reloadBtn.addEventListener('click', () => {
        this.handleReload()
      })
    }

    if (this.elements.exportCSVBtn) {
      this.elements.exportCSVBtn.addEventListener('click', () => {
        this.handleExportCSV()
      })
    }

    if (this.elements.exportJSONBtn) {
      this.elements.exportJSONBtn.addEventListener('click', () => {
        this.handleExportJSON()
      })
    }

    if (this.elements.importJSONBtn) {
      this.elements.importJSONBtn.addEventListener('click', () => {
        if (this.elements.fileUploader) {
          this.elements.fileUploader.style.display = this.elements.fileUploader.style.display === 'none' ? 'block' : 'none'
        }
      })
    }

    if (this.elements.loadFileBtn && this.elements.jsonFileInput) {
      this.elements.loadFileBtn.addEventListener('click', () => {
        const fileInput = this.elements.jsonFileInput
        if (fileInput && fileInput.files && fileInput.files[0]) {
          this.handleFileLoad(fileInput.files[0])
        }
      })
    }

    if (this.elements.sortSelect) {
      this.elements.sortSelect.addEventListener('change', () => this.applyCurrentFilter())
    }
    if (this.elements.sortDirection) {
      this.elements.sortDirection.addEventListener('change', () => this.applyCurrentFilter())
    }
  }

  // ========== 事件處理方法 ==========

  /**
   * 處理儲存系統載入完成事件
   *
   * @param {Object} eventData - 事件資料
   * @param {Array} eventData.books - 書籍資料陣列
   *
   * 負責功能：
   * - 接收載入完成的書籍資料
   * - 更新當前書籍列表
   * - 觸發頁面重新渲染
   */
  handleStorageLoadCompleted (eventData) {
    if (this._validateEventData(eventData, 'books')) {
      this._updateBooksData(eventData.books)
      this.updateDisplay()
    }
  }

  /**
   * 從 Chrome Storage 載入書籍資料
   *
   * 負責功能：
   * - 直接從 Chrome Storage 讀取書籍資料
   * - 處理載入錯誤和空資料狀況
   * - 更新頁面顯示
   */
  async loadBooksFromChromeStorage () {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      // Logger 後備方案: 環境檢測警告
      // 設計理念: Chrome API 可用性檢測需要立即可見的警告
      // 後備機制: console.warn 確保環境問題能被立即發現
      // 使用場景: 非 Chrome Extension 環境或 API 不可用時的即時提醒
      // eslint-disable-next-line no-console
      console.warn('⚠️ Chrome Storage API 不可用')
      return
    }

    try {
      this.showLoading('從儲存載入書籍資料...')

      const result = await chrome.storage.local.get(['readmoo_books'])

      if (result.readmoo_books && result.readmoo_books.books) {
        const books = result.readmoo_books.books
        const timestamp = result.readmoo_books.extractionTimestamp

        // Logger 後備方案: UI Component 資訊記錄
        // 設計理念: Overview 頁面載入時的關鍵資訊需要用戶可見
        // 後備機制: console.log 提供資料時間戳記錄，便於除錯
        // 使用場景: 顯示書籍資料的提取時間，幫助用戶了解資料新舊程度
        // eslint-disable-next-line no-console
        console.log(`📅 提取時間: ${new Date(timestamp).toLocaleString()}`)

        this._updateBooksData(books)
        this.updateDisplay()
      } else {
        // Logger 後備方案: UI Component 狀態記錄
        // 設計理念: 空資料狀態需要明確記錄，便於使用者理解和開發者除錯
        // 後備機制: console.log 提供資料載入狀態的可見性
        // 使用場景: Chrome Storage 無書籍資料時的狀態說明
        // eslint-disable-next-line no-console
        console.log('📂 Chrome Storage 中沒有書籍資料')
        this.hideLoading()
        // 顯示空資料狀態，但不顯示錯誤
        this.renderBooksTable([])
      }
    } catch (error) {
      // Logger 後備方案: UI Component 關鍵錯誤記錄
      // 設計理念: Chrome Storage 載入失敗是嚴重錯誤，必須記錄
      // 後備機制: console.error 確保錯誤可見性，即使在無 Logger 環境
      // 使用場景: 頁面核心功能無法運作時的錯誤追蹤
      // eslint-disable-next-line no-console
      console.error('❌ 從 Chrome Storage 載入書籍資料失敗:', error)
      this.showError('無法載入書籍資料: ' + error.message)
    }
  }

  /**
   * 處理提取完成事件
   *
   * @param {Object} eventData - 事件資料
   *
   * 負責功能：
   * - 處理新的書籍提取完成
   * - 觸發資料重新載入
   */
  handleExtractionCompleted (eventData) {
    this.handleReload()
  }

  /**
   * 處理書籍更新事件
   *
   * @param {Object} eventData - 事件資料
   *
   * 負責功能：
   * - 處理書籍資料更新
   * - 重新渲染頁面
   */
  handleBooksUpdate (eventData) {
    if (this._validateEventData(eventData, 'books')) {
      this._updateBooksData(eventData.books)
      this.applyCurrentFilter()
    }
  }

  /**
   * 處理搜尋輸入
   *
   * @param {string} searchTerm - 搜尋詞
   *
   * 負責功能：
   * - 根據搜尋詞篩選書籍
   * - 更新顯示的書籍列表
   * - 更新統計資訊
   */
  handleSearchInput (searchTerm) {
    this.searchTerm = searchTerm.toLowerCase().trim()
    this.applyCurrentFilter()
  }

  /**
   * 應用當前篩選條件
   *
   * 負責功能：
   * - 根據搜尋詞篩選書籍
   * - 更新篩選結果
   * - 觸發顯示更新
   */
  applyCurrentFilter () {
    // 搜尋
    const base = !this.searchTerm
      ? [...this.currentBooks]
      : this.currentBooks.filter(book => book.title && book.title.toLowerCase().includes(this.searchTerm))

    // 排序
    const sortKey = this.elements.sortSelect ? this.elements.sortSelect.value : 'title'
    const direction = this.elements.sortDirection ? this.elements.sortDirection.value : 'asc'
    const sign = direction === 'desc' ? -1 : 1

    const normalizeTitle = (t) => (t || '').toString().toLowerCase()
    const getSource = (b) => this._formatBookSource(b)

    const compare = (a, b) => {
      if (sortKey === 'title') {
        return normalizeTitle(a.title).localeCompare(normalizeTitle(b.title)) * sign
      }
      if (sortKey === 'progress') {
        const pa = Number(a.progress || 0)
        const pb = Number(b.progress || 0)
        return (pa - pb) * sign
      }
      if (sortKey === 'source') {
        return String(getSource(a)).localeCompare(String(getSource(b))) * sign
      }
      return 0
    }

    this.filteredBooks = base.sort(compare)
    this.updateDisplay()
  }

  /**
   * 更新頁面顯示
   *
   * 負責功能：
   * - 更新統計資訊
   * - 重新渲染書籍表格
   * - 隱藏載入和錯誤狀態
   */
  updateDisplay () {
    this.updateStatistics(this.filteredBooks)
    this.renderBooksTable(this.filteredBooks)
    this.hideLoading()
    this.hideError()
  }

  /**
   * 更新統計資訊顯示
   *
   * @param {Array} books - 要統計的書籍陣列
   *
   * 負責功能：
   * - 更新總書籍數
   * - 更新顯示中的書籍數
   */
  updateStatistics (books) {
    if (this.elements.totalBooks) {
      this.elements.totalBooks.textContent = this.currentBooks.length.toString()
    }

    if (this.elements.displayedBooks) {
      this.elements.displayedBooks.textContent = books.length.toString()
    }
  }

  /**
   * 渲染書籍表格
   *
   * @param {Array} books - 要顯示的書籍陣列
   *
   * 負責功能：
   * - 清空現有表格內容
   * - 渲染書籍資料行
   * - 處理空資料狀態
   */
  renderBooksTable (books) {
    if (!this.elements.tableBody) return

    this.clearTableContent()

    if (!books || books.length === 0) {
      this.renderEmptyState()
      return
    }

    this.renderBookRows(books)
  }

  /**
   * 清空表格內容
   */
  clearTableContent () {
    this.elements.tableBody.innerHTML = ''
  }

  /**
   * 渲染空資料狀態
   */
  renderEmptyState () {
    const emptyRow = this._createEmptyTableRow()
    this.elements.tableBody.appendChild(emptyRow)
  }

  /**
   * 渲染書籍資料行
   */
  renderBookRows (books) {
    books.forEach(book => {
      const row = this.createBookRow(book)
      this.elements.tableBody.appendChild(row)
    })
  }

  /**
   * 創建書籍資料行
   *
   * @param {Object} book - 書籍資料
   * @returns {HTMLElement} 表格行元素
   *
   * 負責功能：
   * - 創建單個書籍的表格行
   * - 格式化書籍資料顯示
   * - 處理缺失資料
   */
  createBookRow (book) {
    const row = this.document.createElement('tr')
    const rowData = this._formatBookRowData(book)

    row.innerHTML = `
      <td>${rowData.cover}</td>
      <td>${rowData.title}</td>
      <td>${rowData.source}</td>
      <td>${rowData.progress}</td>
      <td>${rowData.status}</td>
    `

    return row
  }

  // ========== 狀態管理方法 ==========

  /**
   * 顯示載入狀態
   *
   * @param {string} message - 載入訊息
   *
   * 負責功能：
   * - 顯示載入指示器
   * - 更新載入訊息
   * - 設置載入狀態標記
   */
  showLoading (message = CONSTANTS.MESSAGES.DEFAULT_LOAD) {
    this.isLoading = true
    this._toggleElement('loadingIndicator', true)
    this._updateLoadingText(message)
  }

  /**
   * 隱藏載入狀態
   *
   * 負責功能：
   * - 隱藏載入指示器
   * - 清除載入狀態標記
   */
  hideLoading () {
    this.isLoading = false
    this._toggleElement('loadingIndicator', false)
  }

  /**
   * 顯示錯誤訊息
   *
   * @param {string} message - 錯誤訊息
   *
   * 負責功能：
   * - 顯示錯誤容器
   * - 更新錯誤訊息文字
   * - 隱藏載入狀態
   */
  showError (message) {
    this.hideLoading()
    this._toggleElement('errorContainer', true)
    this._updateErrorText(message)
  }

  /**
   * 隱藏錯誤訊息
   *
   * 負責功能：
   * - 隱藏錯誤容器
   */
  hideError () {
    this._toggleElement('errorContainer', false)
  }

  /**
   * 處理匯出 CSV 操作
   *
   * 負責功能：
   * - 將當前篩選的書籍資料匯出為 CSV
   * - 創建下載連結
   * - 觸發下載
   */
  handleExportCSV () {
    if (!this.filteredBooks || this.filteredBooks.length === 0) {
      alert(CONSTANTS.MESSAGES.NO_DATA_EXPORT)
      return
    }

    const csvContent = this.generateCSVContent()
    this.downloadCSVFile(csvContent)
  }

  // ========== CSV 匯出相關方法 ==========

  /**
   * 生成 CSV 內容
   */
  generateCSVContent () {
    const csvRows = [
      CONSTANTS.EXPORT.CSV_HEADERS.join(','),
      ...this.filteredBooks.map(book => this._bookToCSVRow(book))
    ]
    return csvRows.join('\n')
  }

  // ========== JSON 匯出相關方法 ==========

  /**
   * 處理匯出 JSON 操作
   */
  handleExportJSON () {
    if (!this.filteredBooks || this.filteredBooks.length === 0) {
      alert(CONSTANTS.MESSAGES.NO_DATA_EXPORT)
      return
    }

    const json = this.generateJSONContent()
    this.downloadJSONFile(json)
  }

  /**
   * 生成 JSON 內容（表格欄位對應）
   */
  generateJSONContent () {
    const rows = this.filteredBooks.map(book => ({
      id: book.id || '',
      title: book.title || '',
      progress: Number(book.progress || 0),
      status: book.status || '',
      cover: book.cover || '',
      tags: Array.isArray(book.tags)
        ? book.tags
        : (book.tag ? [book.tag] : ['readmoo'])
    }))
    return JSON.stringify({ books: rows }, null, 2)
  }

  /**
   * 下載 JSON 檔案
   */
  downloadJSONFile (jsonContent) {
    const blob = new Blob([jsonContent], { type: CONSTANTS.EXPORT.JSON_MIME })
    const date = new Date().toISOString().slice(0, 10)
    const filename = `${CONSTANTS.EXPORT.JSON_FILENAME_PREFIX}${date}.json`
    this._triggerFileDownload(blob, filename)
  }

  /**
   * 下載 CSV 檔案
   */
  downloadCSVFile (csvContent) {
    const blob = new Blob([csvContent], { type: CONSTANTS.EXPORT.FILE_TYPE })
    const filename = this._generateCSVFilename()
    this._triggerFileDownload(blob, filename)
  }

  /**
   * 處理重新載入操作
   *
   * 負責功能：
   * - 從 Chrome Storage 重新載入資料
   * - 顯示載入狀態
   * - 重置搜尋條件
   */
  async handleReload () {
    this._resetSearchState()

    // 優先使用 Chrome Storage 載入
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await this.loadBooksFromChromeStorage()
    } else {
      // 降級方案：使用事件系統
      this.showLoading(CONSTANTS.MESSAGES.RELOAD)
      this._emitStorageLoadRequest('overview-reload')
    }
  }

  /**
   * 處理檔案載入操作 - 重構版本
   *
   * @param {File} file - 要載入的檔案
   * @returns {Promise<void>} 載入完成Promise
   *
   * 負責功能：
   * - 協調檔案載入流程
   * - 整合驗證和讀取步驟
   * - 管理載入狀態
   */
  async handleFileLoad (file) {
    this._validateFileBasics(file)
    this._validateFileSize(file)
    this.showLoading('正在讀取檔案...')
    return this._readFileWithReader(file)
  }

  /**
   * 驗證檔案基本要求
   * @private
   * @param {File} file - 要驗證的檔案
   * @throws {Error} 檔案不符合基本要求時拋出錯誤
   */
  _validateFileBasics (file) {
    if (!file) {
      this.showError('請先選擇一個 JSON 檔案！')
      const error = new Error('檔案不存在')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'validation' }
      throw error
    }
    if (!this._isJSONFile(file)) {
      this.showError('請選擇 JSON 格式的檔案！')
      const error = new Error('檔案格式不正確')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'validation' }
      throw error
    }
  }

  /**
   * 檢查是否為JSON檔案
   * @private
   * @param {File} file - 要檢查的檔案
   * @returns {boolean} 是否為JSON檔案
   */
  _isJSONFile (file) {
    // 檢查副檔名
    const hasJsonExtension = file.name.toLowerCase().endsWith('.json')

    // 檢查 MIME 類型
    const hasJsonMimeType = file.type === 'application/json'

    return hasJsonExtension || hasJsonMimeType
  }

  /**
   * 驗證檔案大小
   * @private
   * @param {File} file - 要驗證的檔案
   * @throws {Error} 檔案過大時拋出錯誤
   */
  _validateFileSize (file) {
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      this.showError('檔案過大，請選擇小於 10MB 的檔案！')
      const error = new Error('檔案大小超出限制')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'validation' }
      throw error
    }
  }

  /**
   * 使用FileReader讀取檔案
   * @private
   * @param {File} file - 要讀取的檔案
   * @returns {Promise<void>} 讀取完成Promise
   */
  _readFileWithReader (file) {
    return new Promise((resolve, reject) => {
      const reader = this._createFileReader()
      this._setupReaderHandlers(reader, resolve, reject)
      reader.readAsText(file, 'utf-8')
    })
  }

  /**
   * 建立FileReader實例
   * @private
   * @returns {FileReader} FileReader實例
   */
  _createFileReader () {
    const FileReaderFactory = this._loadFileReaderFactory()
    return FileReaderFactory.createReader()
  }

  /**
   * 載入FileReaderFactory
   * @private
   * @returns {Object} FileReaderFactory類
   */
  _loadFileReaderFactory () {
    if (typeof require !== 'undefined') {
      return require('src/utils/file-reader-factory')
    }
    return window.FileReaderFactory
  }

  /**
   * 設定FileReader事件處理器
   * @private
   * @param {FileReader} reader - FileReader實例
   * @param {Function} resolve - Promise resolve函數
   * @param {Function} reject - Promise reject函數
   */
  _setupReaderHandlers (reader, resolve, reject) {
    reader.onload = (e) => this._handleReaderSuccess(e, resolve, reject)
    reader.onerror = () => this._handleReaderError(reject)
  }

  /**
   * 處理FileReader成功事件
   * @private
   * @param {Event} e - 載入事件
   * @param {Function} resolve - Promise resolve函數
   * @param {Function} reject - Promise reject函數
   */
  _handleReaderSuccess (e, resolve, reject) {
    try {
      this._handleFileContent(e.target.result)
      resolve()
    } catch (error) {
      this._handleFileProcessError(error, reject)
    }
  }

  /**
   * 處理FileReader錯誤事件
   * @private
   * @param {Function} reject - Promise reject函數
   */
  _handleReaderError (reject) {
    const errorMsg = '讀取檔案時發生錯誤'
    this.showError(errorMsg)
    const error = new Error(errorMsg)
    error.code = ErrorCodes.UNKNOWN_ERROR
    error.details = { category: 'general' }
    reject(error)
  }

  /**
   * 處理檔案處理錯誤
   * @private
   * @param {Error} error - 錯誤對象
   * @param {Function} reject - Promise reject函數
   */
  _handleFileProcessError (error, reject) {
    this.showError(`載入檔案失敗：${error.message}`)
    reject(error)
  }

  // EventHandler 抽象方法實現

  // ========== 私有輔助方法 ==========

  /**
   * 驗證事件資料的有效性
   * @private
   */
  _validateEventData (eventData, property) {
    return eventData && eventData[property] && Array.isArray(eventData[property])
  }

  /**
   * 更新書籍資料
   * @private
   */
  _updateBooksData (books) {
    this.currentBooks = books
    this.filteredBooks = [...books]
  }

  /**
   * 切換元素的顯示/隱藏狀態
   * @private
   */
  _toggleElement (elementKey, show) {
    const element = this.elements[elementKey]
    if (element) {
      element.style.display = show ? 'block' : 'none'
    }
  }

  /**
   * 更新載入文字
   * @private
   */
  _updateLoadingText (message) {
    if (this.cachedElements.loadingText) {
      this.cachedElements.loadingText.textContent = message
    }
  }

  /**
   * 更新錯誤文字
   * @private
   */
  _updateErrorText (message) {
    if (this.elements.errorMessage && message) {
      this.elements.errorMessage.textContent = message
    }
  }

  /**
   * 創建空表格行
   * @private
   */
  _createEmptyTableRow () {
    const emptyRow = this.document.createElement('tr')
    emptyRow.innerHTML = `
      <td colspan="${CONSTANTS.TABLE.COLUMNS}" style="text-align: center; padding: 40px; color: #666;">
        ${CONSTANTS.MESSAGES.EMPTY_BOOKS}
      </td>
    `
    return emptyRow
  }

  /**
   * 格式化書籍行資料
   * @private
   */
  _formatBookRowData (book) {
    const { WIDTH, HEIGHT } = CONSTANTS.TABLE.COVER_SIZE

    return {
      cover: book.cover
        ? `<img src="${book.cover}" alt="封面" style="width: ${WIDTH}px; height: ${HEIGHT}px; object-fit: cover;">`
        : CONSTANTS.TABLE.DEFAULT_COVER,
      title: book.title || '未知書名',
      source: this._formatBookSource(book),
      progress: book.progress ? `${book.progress}%` : '-',
      status: book.status || '未知'
    }
  }

  /**
   * 格式化書城來源顯示
   * @private
   * @param {Object} book - 書籍資料
   * @returns {string} 格式化的書城來源
   */
  _formatBookSource (book) {
    // 優先使用 tags 陣列
    if (Array.isArray(book.tags) && book.tags.length > 0) {
      // 如果有多個來源，顯示所有，以逗號分隔
      return book.tags.join(', ')
    }

    // 其次使用單一 tag 或 store 字段
    if (book.tag) {
      return book.tag
    }

    if (book.store) {
      return book.store
    }

    // 最後檢查 source 字段
    if (book.source) {
      return book.source
    }

    // 默認值
    return 'readmoo'
  }

  /**
   * 將書籍資料轉換為 CSV 行
   * @private
   */
  _bookToCSVRow (book) {
    return [
      `"${book.title || ''}"`,
      `"${this._formatBookSource(book)}"`,
      `"${book.progress || 0}"`,
      `"${book.status || ''}"`,
      `"${book.cover || ''}"`
    ].join(',')
  }

  /**
   * 生成 CSV 檔案名
   * @private
   */
  _generateCSVFilename () {
    const date = new Date().toISOString().slice(0, 10)
    return `${CONSTANTS.EXPORT.FILENAME_PREFIX}${date}.csv`
  }

  /**
   * 觸發檔案下載
   * @private
   */
  _triggerFileDownload (blob, filename) {
    const link = this.document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'

    this.document.body.appendChild(link)
    link.click()
    this.document.body.removeChild(link)

    URL.revokeObjectURL(url)
  }

  /**
   * 重置搜尋狀態
   * @private
   */
  _resetSearchState () {
    this.searchTerm = ''
    if (this.elements.searchBox) {
      this.elements.searchBox.value = ''
    }
  }

  /**
   * 發送儲存載入請求
   * @private
   */
  _emitStorageLoadRequest (source) {
    if (this.eventBus) {
      this.eventBus.emit(CONSTANTS.EVENTS.STORAGE_LOAD_REQUEST, {
        source,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 處理檔案內容 - 重構版本
   * @private
   *
   * @param {string} content - 檔案內容
   */
  _handleFileContent (content) {
    const cleanContent = this._validateAndCleanContent(content)
    const data = this._parseJSONContent(cleanContent)
    const books = this._processBookData(data)
    this._updateUIWithBooks(books)
  }

  /**
   * 驗證並清理檔案內容
   * @private
   * @param {string} content - 原始檔案內容
   * @returns {string} 清理後的內容
   */
  _validateAndCleanContent (content) {
    if (!content || content.trim() === '') {
      const error = new Error('檔案內容為空')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'validation' }
      throw error
    }
    return this._removeBOM(content)
  }

  /**
   * 移除UTF-8 BOM標記
   * @private
   * @param {string} content - 檔案內容
   * @returns {string} 移除BOM後的內容
   */
  _removeBOM (content) {
    return content.replace(/^\uFEFF/, '')
  }

  /**
   * 解析JSON內容
   * @private
   * @param {string} content - 要解析的JSON內容
   * @returns {any} 解析後的資料
   */
  _parseJSONContent (content) {
    try {
      return JSON.parse(content)
    } catch (error) {
      if (error instanceof SyntaxError) {
        const error = new Error('JSON 檔案格式不正確')
        error.code = ErrorCodes.PARSE_ERROR
        error.details = { category: 'parsing' }
        throw error
      }
      throw error
    }
  }

  /**
   * 處理書籍資料
   * @private
   * @param {any} data - 解析後的JSON資料
   * @returns {Array} 驗證後的書籍陣列
   */
  _processBookData (data) {
    const books = this._extractBooksFromData(data)
    const validBooks = this._filterValidBooks(books)
    this._checkLargeDataset(validBooks)
    return validBooks
  }

  /**
   * 過濾有效書籍
   * @private
   * @param {Array} books - 書籍陣列
   * @returns {Array} 有效書籍陣列
   */
  _filterValidBooks (books) {
    return books.filter(book => this._isValidBook(book))
  }

  /**
   * 檢查大型資料集
   * @private
   * @param {Array} books - 書籍陣列
   */
  _checkLargeDataset (books) {
    if (books.length > 1000) {
      // Logger 後備方案: UI Component 效能警告
      // 設計理念: 大資料集處理警告需要開發者和用戶立即可見
      // 後備機制: console.warn 提供效能問題的即時提醒
      // 使用場景: 超過 1000 本書籍時的效能警告，提示未來優化需求
      // eslint-disable-next-line no-console
      console.warn('⚠️ 大型資料集，建議分批處理（未來改善）')
    }
  }

  /**
   * 更新UI與書籍資料
   * @private
   * @param {Array} books - 書籍陣列
   */
  _updateUIWithBooks (books) {
    this._updateBooksData(books)
    this.updateDisplay()
    this._logLoadSuccess(books)
  }

  /**
   * 記錄載入成功訊息
   * @private
   * @param {Array} books - 載入的書籍陣列
   */
  _logLoadSuccess (books) {
  }

  /**
   * 從資料中提取書籍陣列 - 重構版本
   * @private
   *
   * @param {any} data - 解析後的JSON資料
   * @returns {Array} 書籍陣列
   */
  _extractBooksFromData (data) {
    if (this._isDirectArrayFormat(data)) return data
    if (this._isWrappedBooksFormat(data)) return data.books
    if (this._isMetadataWrapFormat(data)) return data.data

    // 處理空 JSON 對象的情況
    if (data && typeof data === 'object' && Object.keys(data).length === 0) {
      return [] // 空對象回傳空陣列
    }

    const error = new Error('JSON 檔案應該包含一個陣列或包含books屬性的物件')
    error.code = ErrorCodes.VALIDATION_ERROR
    error.details = { category: 'validation' }
    throw error
  }

  /**
   * 檢查是否為直接陣列格式
   * @private
   * @param {any} data - 要檢查的資料
   * @returns {boolean} 是否為直接陣列格式
   */
  _isDirectArrayFormat (data) {
    return Array.isArray(data)
  }

  /**
   * 檢查是否為包裝books格式
   * @private
   * @param {any} data - 要檢查的資料
   * @returns {boolean} 是否為包裝books格式
   */
  _isWrappedBooksFormat (data) {
    return data &&
           typeof data === 'object' &&
           Array.isArray(data.books)
  }

  /**
   * 檢查是否為metadata包裝格式
   * @private
   * @param {any} data - 要檢查的資料
   * @returns {boolean} 是否為metadata包裝格式
   */
  _isMetadataWrapFormat (data) {
    return data &&
           data.data &&
           Array.isArray(data.data)
  }

  /**
   * 驗證書籍資料是否有效 - 重構版本
   * @private
   *
   * @param {Object} book - 書籍物件
   * @returns {boolean} 是否有效
   */
  _isValidBook (book) {
    return this._validateBookStructure(book) &&
           this._validateRequiredFields(book) &&
           this._validateFieldTypes(book)
  }

  /**
   * 驗證書籍基本結構
   * @private
   * @param {any} book - 要驗證的書籍對象
   * @returns {boolean} 結構是否有效
   */
  _validateBookStructure (book) {
    return book && typeof book === 'object'
  }

  /**
   * 驗證必要欄位存在
   * @private
   * @param {Object} book - 書籍物件
   * @returns {boolean} 必要欄位是否都存在
   */
  _validateRequiredFields (book) {
    return Boolean(book.id) &&
           Boolean(book.title) &&
           Boolean(book.cover)
  }

  /**
   * 驗證欄位類型
   * @private
   * @param {Object} book - 書籍物件
   * @returns {boolean} 欄位類型是否正確
   */
  _validateFieldTypes (book) {
    return typeof book.id === 'string' &&
           typeof book.title === 'string' &&
           typeof book.cover === 'string'
  }

  // ========== EventHandler 抽象方法實現 ==========

  /**
   * 取得支援的事件類型
   *
   * @returns {string[]} 支援的事件類型列表
   */
  getSupportedEvents () {
    return [...CONSTANTS.EVENTS.SUPPORTED]
  }

  /**
   * 處理事件的主要邏輯
   *
   * @param {Object} event - 事件物件
   * @returns {Promise<boolean>} 處理結果
   */
  async process (event) {
    const { type: eventType, data: eventData } = event

    try {
      switch (eventType) {
        case 'STORAGE.LOAD.COMPLETED':
          this.handleStorageLoadCompleted(eventData)
          break
        case 'EXTRACTION.COMPLETED':
          this.handleExtractionCompleted(eventData)
          break
        case 'UI.BOOKS.UPDATE':
          this.handleBooksUpdate(eventData)
          break
        default:
          return false
      }

      return true
    } catch (error) {
      // Logger 後備方案: UI Component 事件處理錯誤
      // 設計理念: 事件處理失敗是控制器層級的嚴重錯誤，必須記錄
      // 後備機制: console.error 確保事件處理錯誤的可追蹤性
      // 使用場景: Overview 控制器事件處理失敗時的錯誤記錄
      // eslint-disable-next-line no-console
      console.error(`Overview 控制器處理事件失敗: ${eventType}`, error)
      throw error
    }
  }

  /**
   * 取得當前狀態
   *
   * @returns {Object} 當前狀態資訊
   */
  getStatus () {
    return {
      name: this.name,
      isLoading: this.isLoading,
      booksCount: this.currentBooks.length,
      filteredCount: this.filteredBooks.length,
      searchTerm: this.searchTerm,
      lastUpdate: new Date().toISOString()
    }
  }
}

// 瀏覽器環境：將 OverviewPageController 定義為全域變數
if (typeof window !== 'undefined') {
  window.OverviewPageController = OverviewPageController
}

// Node.js 環境：保持 CommonJS 匯出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OverviewPageController }
}
