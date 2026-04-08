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

// 引入核心模組（由 esbuild 在建置時打包解析）
const EventHandlerClass = require('src/core/event-handler')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')
const { BookExporter } = require('src/overview/book-exporter')
const { BookFileImporter } = require('src/overview/book-file-importer')
const { DuplicateBookMerger } = require('src/overview/duplicate-book-merger')
const { createTagCellRenderer } = require('src/overview/tag-cell-renderer')

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
    COLUMNS: 6,
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
    this.statusFilter = null
    this.tagFilterState = { selectedTagIds: new Set(), mode: 'or' }
    this.tagMap = new Map()
    this.categoryMap = new Map()

    // 初始化 Tag Cell Renderer
    this.tagCellRenderer = createTagCellRenderer({
      getTagById: id => this.tagMap.get(id),
      getCategoryById: id => this.categoryMap.get(id),
      document: this.document
    })

    // 初始化匯出模組
    this.bookExporter = new BookExporter({
      getFilteredBooks: () => this.filteredBooks,
      document: this.document
    })

    // 初始化檔案載入模組
    this.bookFileImporter = new BookFileImporter({
      document: this.document,
      showError: (msg) => this.showError(msg)
    })

    // 初始化重複書籍合併模組
    this.duplicateBookMerger = new DuplicateBookMerger()

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
        this.bookExporter.handleExportCSV()
      })
    }

    if (this.elements.exportJSONBtn) {
      this.elements.exportJSONBtn.addEventListener('click', () => {
        this.bookExporter.handleExportJSON()
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
   * 設定 readingStatus 篩選條件
   *
   * @param {string|null} status - readingStatus 值，null 表示顯示全部
   *
   * 業務規則：
   * - 設定特定狀態時只顯示該狀態的書籍
   * - 設定 null 時清除篩選顯示全部
   * - 與文字搜尋條件同時套用
   */
  setStatusFilter (status) {
    this.statusFilter = status
    this.applyCurrentFilter()
  }

  /**
   * 設定 Tag 篩選條件
   * @param {Set<string>} selectedTagIds - 已選 tag ID 集合
   * @param {'and'|'or'} mode - 篩選模式
   */
  setTagFilter (selectedTagIds, mode) {
    this.tagFilterState = { selectedTagIds, mode }
    this.applyCurrentFilter()
  }

  /**
   * 清除 Tag 篩選，恢復顯示全部
   */
  clearTagFilter () {
    this.tagFilterState = { selectedTagIds: new Set(), mode: 'or' }
    this.applyCurrentFilter()
  }

  /**
   * 應用當前篩選條件
   *
   * 篩選管線：狀態篩選 → Tag 篩選 → 文字搜尋 → 排序
   */
  applyCurrentFilter () {
    // 狀態篩選
    const statusFiltered = this.statusFilter
      ? this.currentBooks.filter(book => book.readingStatus === this.statusFilter)
      : [...this.currentBooks]

    // Tag 篩選
    const tagFiltered = this.tagFilterState.selectedTagIds.size === 0
      ? statusFiltered
      : statusFiltered.filter(book => {
        const bookTagIds = book.tagIds || []
        if (bookTagIds.length === 0) return false
        if (this.tagFilterState.mode === 'and') {
          return [...this.tagFilterState.selectedTagIds].every(id => bookTagIds.includes(id))
        }
        return bookTagIds.some(id => this.tagFilterState.selectedTagIds.has(id))
      })

    // 文字搜尋
    const base = !this.searchTerm
      ? tagFiltered
      : tagFiltered.filter(book => book.title && book.title.toLowerCase().includes(this.searchTerm))

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

  // ========== Tag 顯示方法 ==========

  /**
   * 批量解析 tagIds 為顯示用資料
   * @param {string[]} tagIds - 書籍的 tagIds
   * @param {Map<string, Object>} tagMap - tag ID -> tag 物件的查找表
   * @param {Map<string, Object>} categoryMap - category ID -> category 物件的查找表
   * @returns {Array<{ tagId: string, tagName: string, categoryName: string, categoryColor: string }>}
   */
  resolveTagsForDisplay (tagIds, tagMap, categoryMap) {
    // 向後相容 proxy：支援 3 參數直接呼叫（測試使用）和無參數委派
    // 當明確傳入 tagMap/categoryMap 時，使用傳入的 Map 進行解析
    // 否則委派給 tagCellRenderer（使用 constructor 綁定的 getter）
    if (tagMap && categoryMap) {
      if (!Array.isArray(tagIds)) return []
      return tagIds.reduce((result, tagId) => {
        const tag = tagMap.get(tagId)
        if (!tag) return result
        const category = categoryMap.get(tag.categoryId) || {}
        result.push({
          tagId,
          tagName: tag.name,
          categoryName: category.name || '',
          categoryColor: category.color || ''
        })
        return result
      }, [])
    }
    return this.tagCellRenderer.resolveTagsForDisplay(tagIds)
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

    const tagCell = this.tagCellRenderer.createTagCell(book.tagIds || [])
    row.appendChild(tagCell)

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

  // ========== 匯出方法（委派至 BookExporter） ==========

  /**
   * 處理匯出 CSV 操作（委派至 BookExporter）
   *
   * 保留 Controller 層級的方法簽名，以維持向後相容性。
   * 內部透過自身的 generateCSVContent / downloadCSVFile 方法執行，
   * 確保外部 spy 可以正確攔截子方法呼叫。
   */
  handleExportCSV () {
    if (!this.filteredBooks || this.filteredBooks.length === 0) {
      alert(CONSTANTS.MESSAGES.NO_DATA_EXPORT)
      return
    }

    const csvContent = this.generateCSVContent()
    this.downloadCSVFile(csvContent)
  }

  /**
   * 處理匯出 JSON 操作（委派至 BookExporter）
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
   * 生成 CSV 內容（委派至 BookExporter）
   */
  generateCSVContent () {
    return this.bookExporter.generateCSVContent()
  }

  /**
   * 生成 JSON 內容（委派至 BookExporter）
   */
  generateJSONContent () {
    return this.bookExporter.generateJSONContent()
  }

  /**
   * 下載 CSV 檔案（委派至 BookExporter）
   */
  downloadCSVFile (csvContent) {
    this.bookExporter.downloadCSVFile(csvContent)
  }

  /**
   * 下載 JSON 檔案（委派至 BookExporter）
   */
  downloadJSONFile (jsonContent) {
    this.bookExporter.downloadJSONFile(jsonContent)
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
   * 處理檔案載入操作（委派至 BookFileImporter）
   *
   * @param {File} file - 要載入的檔案
   * @returns {Promise<void>} 載入完成Promise
   *
   * 負責功能：
   * - 委派檔案驗證和讀取至 BookFileImporter
   * - 管理載入狀態
   * - 接收解析後的書籍資料更新 UI
   */
  async handleFileLoad (file) {
    // 驗證階段由 importer 處理（會呼叫 showError 並 throw）
    this.bookFileImporter._validateFileBasics(file)
    this.bookFileImporter._validateFileSize(file)
    this.showLoading('正在讀取檔案...')

    // 讀取和解析由 importer 處理，回傳書籍陣列
    const books = await this.bookFileImporter._readFileWithReader(file)
    this._updateUIWithBooks(books)
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
    const readingStatus = book.readingStatus || ''

    return {
      cover: book.cover
        ? `<img src="${book.cover}" alt="封面" style="width: ${WIDTH}px; height: ${HEIGHT}px; object-fit: cover;">`
        : CONSTANTS.TABLE.DEFAULT_COVER,
      title: book.title || '未知書名',
      source: this._formatBookSource(book),
      progress: book.progress ? `${book.progress}%` : '-',
      status: readingStatus
        ? `<span class="reading-status-badge" data-status="${readingStatus}">${readingStatus}</span>`
        : (book.status || '未知')
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

  // ========== 檔案載入代理方法（向後相容） ==========

  /**
   * 處理檔案內容（委派至 BookFileImporter）
   * @private
   * @param {string} content - 檔案內容
   *
   * 保留此代理方法以維持向後相容性（測試和外部呼叫者可能直接使用）
   */
  _handleFileContent (content) {
    const books = this.bookFileImporter._handleFileContent(content)
    this._updateUIWithBooks(books)
  }

  /**
   * 驗證檔案基本要求（委派至 BookFileImporter）
   * @private
   */
  _validateFileBasics (file) {
    return this.bookFileImporter._validateFileBasics(file)
  }

  /**
   * 驗證檔案大小（委派至 BookFileImporter）
   * @private
   */
  _validateFileSize (file) {
    return this.bookFileImporter._validateFileSize(file)
  }

  /**
   * 檢查是否為JSON檔案（委派至 BookFileImporter）
   * @private
   */
  _isJSONFile (file) {
    return this.bookFileImporter._isJSONFile(file)
  }

  /**
   * 使用FileReader讀取檔案（委派至 BookFileImporter）
   * @private
   */
  _readFileWithReader (file) {
    return this.bookFileImporter._readFileWithReader(file)
  }

  /**
   * 建立FileReader實例（委派至 BookFileImporter）
   * @private
   */
  _createFileReader () {
    return this.bookFileImporter._createFileReader()
  }

  /**
   * 載入FileReaderFactory（委派至 BookFileImporter）
   * @private
   */
  _loadFileReaderFactory () {
    return this.bookFileImporter._loadFileReaderFactory()
  }

  /**
   * 設定FileReader事件處理器（委派至 BookFileImporter）
   * @private
   */
  _setupReaderHandlers (reader, resolve, reject) {
    return this.bookFileImporter._setupReaderHandlers(reader, resolve, reject)
  }

  /**
   * 處理FileReader成功事件（委派至 BookFileImporter）
   * @private
   */
  _handleReaderSuccess (e, resolve, reject) {
    return this.bookFileImporter._handleReaderSuccess(e, resolve, reject)
  }

  /**
   * 處理FileReader錯誤事件（委派至 BookFileImporter）
   * @private
   */
  _handleReaderError (reject) {
    return this.bookFileImporter._handleReaderError(reject)
  }

  /**
   * 處理檔案處理錯誤（委派至 BookFileImporter）
   * @private
   */
  _handleFileProcessError (error, reject) {
    return this.bookFileImporter._handleFileProcessError(error, reject)
  }

  /**
   * 驗證並清理檔案內容（委派至 BookFileImporter）
   * @private
   */
  _validateAndCleanContent (content) {
    return this.bookFileImporter._validateAndCleanContent(content)
  }

  /**
   * 移除UTF-8 BOM標記（委派至 BookFileImporter）
   * @private
   */
  _removeBOM (content) {
    return this.bookFileImporter._removeBOM(content)
  }

  /**
   * 解析JSON內容（委派至 BookFileImporter）
   * @private
   */
  _parseJSONContent (content) {
    return this.bookFileImporter._parseJSONContent(content)
  }

  /**
   * 處理書籍資料（委派至 BookFileImporter）
   * @private
   */
  _processBookData (data) {
    return this.bookFileImporter._processBookData(data)
  }

  /**
   * 過濾有效書籍（委派至 BookFileImporter）
   * @private
   */
  _filterValidBooks (books) {
    return this.bookFileImporter._filterValidBooks(books)
  }

  /**
   * 檢查大型資料集（委派至 BookFileImporter）
   * @private
   */
  _checkLargeDataset (books) {
    return this.bookFileImporter._checkLargeDataset(books)
  }

  /**
   * 從資料中提取書籍陣列（委派至 BookFileImporter）
   * @private
   */
  _extractBooksFromData (data) {
    return this.bookFileImporter._extractBooksFromData(data)
  }

  /**
   * 檢查是否為直接陣列格式（委派至 BookFileImporter）
   * @private
   */
  _isDirectArrayFormat (data) {
    return this.bookFileImporter._isDirectArrayFormat(data)
  }

  /**
   * 檢查是否為包裝books格式（委派至 BookFileImporter）
   * @private
   */
  _isWrappedBooksFormat (data) {
    return this.bookFileImporter._isWrappedBooksFormat(data)
  }

  /**
   * 檢查是否為metadata包裝格式（委派至 BookFileImporter）
   * @private
   */
  _isMetadataWrapFormat (data) {
    return this.bookFileImporter._isMetadataWrapFormat(data)
  }

  /**
   * 驗證書籍資料是否有效（委派至 BookFileImporter）
   * @private
   */
  _isValidBook (book) {
    return this.bookFileImporter._isValidBook(book)
  }

  /**
   * 驗證書籍基本結構（委派至 BookFileImporter）
   * @private
   */
  _validateBookStructure (book) {
    return this.bookFileImporter._validateBookStructure(book)
  }

  /**
   * 驗證必要欄位存在（委派至 BookFileImporter）
   * @private
   */
  _validateRequiredFields (book) {
    return this.bookFileImporter._validateRequiredFields(book)
  }

  /**
   * 驗證欄位類型（委派至 BookFileImporter）
   * @private
   */
  _validateFieldTypes (book) {
    return this.bookFileImporter._validateFieldTypes(book)
  }

  // ========== 重複書籍處理（委派至 DuplicateBookMerger） ==========

  /**
   * 處理重複書籍的合併策略（委派至 DuplicateBookMerger）
   *
   * @param {Array} existingBooks - 既有書籍陣列
   * @param {Array} importedBooks - 匯入書籍陣列
   * @param {string} strategy - 合併策略 ('skip' | 'override' | 'merge')
   * @returns {Array} 合併後的書籍陣列
   */
  _handleDuplicateBooks (existingBooks, importedBooks, strategy) {
    return this.duplicateBookMerger.handleDuplicateBooks(existingBooks, importedBooks, strategy)
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
