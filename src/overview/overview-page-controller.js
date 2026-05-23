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
// v2 匯出器（Interchange Format v2）：book-data-exporter.js 使用 default export
const BookDataExporter = require('src/export/book-data-exporter')
// Tag 資料來源（v2 匯出需要 tags / tagCategories 頂層區段）
const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')

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
    COLUMNS: 7,
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
  },

  // 匯入模式選擇 modal（UC-04）
  IMPORT_MODE: {
    OVERWRITE: 'overwrite',
    MERGE: 'merge'
  },

  // v2 匯出配置（Interchange Format v2）
  EXPORT_V2: {
    FORMAT_VERSION: '2.0.0',
    // COMPLETE_V2 涵蓋全部 v2 書籍欄位，最大化規格合規（含 readingStatus/tagIds/source 等）
    FIELD_PRESET: 'COMPLETE_V2',
    JSON_MIME: 'application/json;charset=utf-8;',
    CSV_MIME: 'text/csv;charset=utf-8;',
    FILENAME_PREFIX: '書籍資料_'
  }
}

/**
 * 匯入模式 modal DOM 缺失的哨兵值（UC-04）。
 *
 * promptImportMode 的合法回傳為 'overwrite' / 'merge' / null（取消）。
 * 當 modal DOM 元素未注入時需回傳一個與三者皆不碰撞的值，使 handleFileLoad
 * 能將「DOM 缺失」（應 showError）與「使用者取消」（應靜默中止）分流。
 * 用 Symbol 確保唯一性，不與任何字串 / null 相等。
 */
const IMPORT_MODE_MODAL_MISSING = Symbol('import-mode-modal-missing')

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

    // 選取狀態（W6-012.7.1）：以 bookId 為唯一識別，UI 從此 Set 計算 checked / row-selected
    this.selectedBookIds = new Set()

    // 匯入模式 modal 單一實例保護（UC-04）：modal 開啟期間 pending Promise 暫存於此，
    // 重複觸發匯入時回傳同一 Promise，不開第二個 modal。null 表示無進行中的 modal。
    this._importModePending = null

    // 匯入模式 modal 開啟前的焦點元素，modal 關閉時還原焦點至此（無障礙）
    this._importModePreviousFocus = null

    // 初始化 Tag Cell Renderer
    this.tagCellRenderer = createTagCellRenderer({
      getTagById: id => this.tagMap.get(id),
      getCategoryById: id => this.categoryMap.get(id),
      document: this.document
    })

    // 初始化匯出模組
    // selection-aware DI（W6-012.7.2）：當 selectedBookIds 非空時，匯出/copy 僅針對選取項；
    // 為空時退回全量 filteredBooks，維持向後相容。getFilteredBooks 僅由 book-exporter
    // 消費（grep 確認唯一呼叫者），擴展語意安全。
    this.bookExporter = new BookExporter({
      getFilteredBooks: () => {
        if (this.selectedBookIds.size === 0) return this.filteredBooks
        return this.filteredBooks.filter(b => this.selectedBookIds.has(b.id))
      },
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
      buttons: ['exportCSVBtn', 'exportJSONBtn', 'importJSONBtn', 'copyTextBtn', 'selectAllBtn', 'reloadBtn', 'selectAllHeaderCheckbox'],
      // 檔案載入相關元素
      fileLoad: ['fileUploader', 'jsonFileInput', 'loadFileBtn', 'loadSampleBtn', 'sortSelect', 'sortDirection'],
      // 狀態顯示元素
      status: ['loadingIndicator', 'errorContainer', 'errorMessage', 'retryBtn'],
      // 匯入模式選擇 modal 元素（UC-04）
      importMode: ['importModeOverlay', 'importModeModal', 'importModeTitle', 'importModeOverwriteBtn', 'importModeMergeBtn', 'importModeCancelBtn']
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

    // 匯出 CSV/JSON 按鈕（W1-042.1）：改接 BookDataExporter v2 路徑
    // 產出符合 Interchange Format v2 規格（含 metadata/tagCategories/tags 頂層、
    // readingStatus/tagIds 書籍欄位）。v2 路徑需從 storage 讀取 tags，故為 async。
    if (this.elements.exportCSVBtn) {
      this.elements.exportCSVBtn.addEventListener('click', () => {
        this.handleExportCSVv2()
      })
    }

    if (this.elements.exportJSONBtn) {
      this.elements.exportJSONBtn.addEventListener('click', () => {
        this.handleExportJSONv2()
      })
    }

    // 複製為文字按鈕（W6-012.7.3）：與 exportCSV/exportJSON 行為一致
    // selection-aware：透過 bookExporter.getFilteredBooks DI 自動尊重 selectedBookIds
    // （W6-012.7.2 已注入 selection-aware getter）
    if (this.elements.copyTextBtn) {
      this.elements.copyTextBtn.addEventListener('click', () => {
        this.bookExporter.handleCopyText()
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

    // 選取全部按鈕（W6-012.7.1）：toggle — 若已全選則清空，否則全選 displayedBooks
    if (this.elements.selectAllBtn) {
      this.elements.selectAllBtn.addEventListener('click', () => {
        this.handleSelectAllToggle()
      })
    }

    // 表格 header checkbox：與 selectAllBtn 行為一致
    if (this.elements.selectAllHeaderCheckbox) {
      this.elements.selectAllHeaderCheckbox.addEventListener('click', () => {
        this.handleSelectAllToggle()
      })
    }
  }

  /**
   * 切換全選狀態（W6-012.7.1）
   *
   * 規則：
   * - 若當前已選取的書本數 === displayedBooks 數量，則清空選取
   * - 否則將 displayedBooks 中所有書本加入選取
   * - 切換後重新渲染表格以同步 UI
   */
  handleSelectAllToggle () {
    const displayed = this.filteredBooks || []
    const displayedIds = displayed.map(b => this._getBookId(b)).filter(id => id !== null)

    const allSelected = displayedIds.length > 0 &&
      displayedIds.every(id => this.selectedBookIds.has(id))

    if (allSelected) {
      // 清空 displayed 範圍內的選取（保留範圍外的已選，雖然當前 UI 只看到 displayed）
      displayedIds.forEach(id => this.selectedBookIds.delete(id))
    } else {
      displayedIds.forEach(id => this.selectedBookIds.add(id))
    }

    this.renderBooksTable(this.filteredBooks)
    this._syncHeaderCheckboxState()
  }

  /**
   * 切換單筆書本的選取狀態（W6-012.7.1）
   * @param {string} bookId
   */
  handleRowCheckboxToggle (bookId) {
    if (!bookId) return
    if (this.selectedBookIds.has(bookId)) {
      this.selectedBookIds.delete(bookId)
    } else {
      this.selectedBookIds.add(bookId)
    }
    // 只 toggle 該 row 的視覺，不 re-render 整表（效能 + 不打斷使用者）
    this._updateRowSelectedClass(bookId)
    this._syncHeaderCheckboxState()
  }

  /**
   * 取得書本唯一識別（W6-012.7.1）
   * @private
   */
  _getBookId (book) {
    if (!book) return null
    return book.id || book.bookId || null
  }

  /**
   * 同步 header checkbox 的 checked 狀態（W6-012.7.1）
   * @private
   */
  _syncHeaderCheckboxState () {
    const header = this.elements.selectAllHeaderCheckbox
    if (!header) return
    const displayed = this.filteredBooks || []
    const displayedIds = displayed.map(b => this._getBookId(b)).filter(id => id !== null)
    const allSelected = displayedIds.length > 0 &&
      displayedIds.every(id => this.selectedBookIds.has(id))
    header.checked = allSelected
  }

  /**
   * 更新單筆 row 的選取視覺（W6-012.7.1）
   * @private
   */
  _updateRowSelectedClass (bookId) {
    if (!this.elements.tableBody) return
    const checkbox = this.elements.tableBody.querySelector(
      `input.row-checkbox[data-book-id="${bookId}"]`
    )
    if (!checkbox) return
    const row = checkbox.closest('tr')
    if (!row) return
    if (this.selectedBookIds.has(bookId)) {
      row.classList.add('row-selected')
      checkbox.checked = true
    } else {
      row.classList.remove('row-selected')
      checkbox.checked = false
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
      this._syncHeaderCheckboxState()
      return
    }

    this.renderBookRows(books)
    this._syncHeaderCheckboxState()
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

    // 選取 checkbox 欄位（W6-012.7.1）
    const bookId = this._getBookId(book)
    const selectCell = this.document.createElement('td')
    selectCell.className = 'select-col'
    if (bookId) {
      const checkbox = this.document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.className = 'row-checkbox'
      checkbox.setAttribute('data-book-id', bookId)
      checkbox.setAttribute('aria-label', '選取此書')
      if (this.selectedBookIds.has(bookId)) {
        checkbox.checked = true
        row.classList.add('row-selected')
      }
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation()
        this.handleRowCheckboxToggle(bookId)
      })
      selectCell.appendChild(checkbox)
    }
    row.appendChild(selectCell)

    // XSS 防護：使用 DOM API 建立各欄位，避免 innerHTML 注入
    // cover 欄位：驗證 URL 協議後建立 img 元素
    const coverCell = this.document.createElement('td')
    if (book.cover) {
      const isSafeUrl = /^https?:\/\//i.test(book.cover)
      if (isSafeUrl) {
        const img = this.document.createElement('img')
        img.src = book.cover
        img.alt = '封面'
        img.style.width = `${CONSTANTS.TABLE.COVER_SIZE.WIDTH}px`
        img.style.height = `${CONSTANTS.TABLE.COVER_SIZE.HEIGHT}px`
        img.style.objectFit = 'cover'
        coverCell.appendChild(img)
      } else {
        coverCell.textContent = CONSTANTS.TABLE.DEFAULT_COVER
      }
    } else {
      coverCell.textContent = CONSTANTS.TABLE.DEFAULT_COVER
    }
    row.appendChild(coverCell)

    // title, source, progress 欄位：使用 textContent 自動逸出
    const titleCell = this.document.createElement('td')
    titleCell.className = 'book-title-cell'
    titleCell.textContent = rowData.title
    row.appendChild(titleCell)

    const sourceCell = this.document.createElement('td')
    sourceCell.textContent = rowData.source
    row.appendChild(sourceCell)

    const progressCell = this.document.createElement('td')
    progressCell.textContent = rowData.progress
    row.appendChild(progressCell)

    // status 欄位：badge HTML 由內部生成（_formatBookRowData），非使用者輸入
    const statusCell = this.document.createElement('td')
    statusCell.innerHTML = rowData.status
    row.appendChild(statusCell)

    // tag 欄位：由 tagCellRenderer 以 DOM API 建立，安全
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

  // ========== v2 匯出方法（委派至 BookDataExporter，Interchange Format v2） ==========

  /**
   * 處理 JSON 匯出（v2 路徑，W1-042.1）
   *
   * 改接 BookDataExporter 的 v2 路徑，產出符合 Interchange Format v2 規格的 JSON：
   * - 頂層含 metadata（formatVersion 2.0.0）/ tagCategories / tags / books 四區段
   * - 書籍欄位用 readingStatus（非 status）、tagIds（非 tags）
   *
   * v2 路徑需 tags / tagCategories 資料，故從 Chrome Storage 讀取，方法為 async。
   *
   * @returns {Promise<void>}
   */
  async handleExportJSONv2 () {
    const books = this._getBooksForExport()
    if (!books || books.length === 0) {
      alert(CONSTANTS.MESSAGES.NO_DATA_EXPORT)
      return
    }

    try {
      const { tags, tagCategories } = await this._loadTagData()
      const exporter = new BookDataExporter(books)
      const json = exporter.exportToJSON({
        formatVersion: CONSTANTS.EXPORT_V2.FORMAT_VERSION,
        fieldPreset: CONSTANTS.EXPORT_V2.FIELD_PRESET,
        tags,
        tagCategories
      })
      this._triggerExportDownload(json, 'json', CONSTANTS.EXPORT_V2.JSON_MIME)
    } catch (error) {
      // 匯出失敗（storage 讀取或序列化錯誤）須讓使用者可見，避免靜默無回饋
      // eslint-disable-next-line no-console
      console.error('❌ v2 JSON 匯出失敗:', error)
      this.showError('JSON 匯出失敗: ' + (error && error.message ? error.message : error))
    }
  }

  /**
   * 處理 CSV 匯出（v2 路徑，W1-042.1）
   *
   * 改接 BookDataExporter 的 v2 路徑，產出符合 csv-export-spec v2 的 CSV：
   * - headers 為英文欄位名（id,title,authors,...,readingStatus,tagIds,tagNames,tagCategories）
   * - 衍生欄位 tagNames / tagCategories 由 tagIds 解析
   *
   * @returns {Promise<void>}
   */
  async handleExportCSVv2 () {
    const books = this._getBooksForExport()
    if (!books || books.length === 0) {
      alert(CONSTANTS.MESSAGES.NO_DATA_EXPORT)
      return
    }

    try {
      const { tags, tagCategories } = await this._loadTagData()
      const exporter = new BookDataExporter(books)
      const csv = exporter.exportToCSV({
        formatVersion: CONSTANTS.EXPORT_V2.FORMAT_VERSION,
        fieldPreset: CONSTANTS.EXPORT_V2.FIELD_PRESET,
        tags,
        tagCategories
      })
      this._triggerExportDownload(csv, 'csv', CONSTANTS.EXPORT_V2.CSV_MIME)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ v2 CSV 匯出失敗:', error)
      this.showError('CSV 匯出失敗: ' + (error && error.message ? error.message : error))
    }
  }

  /**
   * 取得待匯出的書籍清單（selection-aware）
   *
   * 與 BookExporter 的 getFilteredBooks DI 行為一致：
   * - 有書本被選取時僅匯出選取項
   * - 無選取時退回全量 filteredBooks
   *
   * @private
   * @returns {Array} 待匯出書籍陣列
   */
  _getBooksForExport () {
    if (this.selectedBookIds.size === 0) return this.filteredBooks
    return this.filteredBooks.filter(b => this.selectedBookIds.has(this._getBookId(b)))
  }

  /**
   * 從 Chrome Storage 讀取 tags 與 tagCategories
   *
   * v2 匯出需要完整的 tags / tagCategories 頂層區段。透過 TagStorageAdapter
   * 讀取對應 storage key（tags / tag_categories）。非 Chrome Extension 環境
   * （如測試）或 storage 無資料時退回空陣列，匯出仍可進行。
   *
   * @private
   * @returns {Promise<{tags: Array, tagCategories: Array}>}
   */
  async _loadTagData () {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return { tags: [], tagCategories: [] }
    }
    const [tags, tagCategories] = await Promise.all([
      TagStorageAdapter.getAllTags(),
      TagStorageAdapter.getAllTagCategories()
    ])
    return {
      tags: Array.isArray(tags) ? tags : [],
      tagCategories: Array.isArray(tagCategories) ? tagCategories : []
    }
  }

  /**
   * 觸發 v2 匯出檔案下載
   *
   * 以 this.document 建立隱藏 anchor 並觸發 click，與 BookExporter 的下載
   * 機制一致（不使用 BookDataExporter.downloadFile，因其依賴 global.document）。
   *
   * @private
   * @param {string} content - 檔案內容
   * @param {string} extension - 副檔名（不含點，如 'json' / 'csv'）
   * @param {string} mimeType - MIME 類型
   */
  _triggerExportDownload (content, extension, mimeType) {
    const blob = new Blob([content], { type: mimeType })
    const date = new Date().toISOString().slice(0, 10)
    const filename = `${CONSTANTS.EXPORT_V2.FILENAME_PREFIX}${date}.${extension}`

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

  // ========== 匯入模式選擇 modal（UC-04 / IMP-E） ==========

  /**
   * 顯示匯入模式選擇 modal，回傳使用者選擇的模式（UC-04 / IMP-E）
   *
   * @returns {Promise<'overwrite' | 'merge' | null | symbol>}
   *   - 'overwrite'：使用者選擇覆蓋模式（清空現有書庫後載入）
   *   - 'merge'：使用者選擇合併模式（保留現有書庫並合併）
   *   - null：使用者取消（取消鈕 / Esc / 點遮罩）
   *   - IMPORT_MODE_MODAL_MISSING：modal DOM 未注入（呼叫端應 showError）
   *
   * 設計：
   * - modal 一次只允許一個實例；重複呼叫回傳「同一個」pending Promise 物件（場景 8）。
   *   本方法刻意不用 async（async 會將回傳值包成新 Promise，破壞 pending Promise
   *   的物件識別性），改為直接回傳 Promise 物件以保證重複呼叫得到同一引用。
   * - resolve 前 modal 持續顯示，不自動關閉。
   * - settle 統一收斂出口：移除監聽器 → 隱藏 modal → 清 pending 旗標 → 還原焦點 → resolve。
   */
  promptImportMode () {
    const overlay = this.elements.importModeOverlay
    const modal = this.elements.importModeModal
    const overwriteBtn = this.elements.importModeOverwriteBtn
    const mergeBtn = this.elements.importModeMergeBtn
    const cancelBtn = this.elements.importModeCancelBtn

    // DOM 缺失防禦：任一元素為 null 視為設計缺陷，回傳哨兵值供 handleFileLoad 分流
    if (!overlay || !modal || !overwriteBtn || !mergeBtn || !cancelBtn) {
      // eslint-disable-next-line no-console
      console.error('❌ 匯入模式 modal 元素缺失，無法顯示模式選擇')
      return Promise.resolve(IMPORT_MODE_MODAL_MISSING)
    }

    // 單一實例保護：modal 已開啟時回傳既有 pending Promise，不開第二個（場景 8）
    if (this._importModePending) {
      return this._importModePending
    }

    this._importModePending = new Promise((resolve) => {
      // 焦點還原起點：記錄 modal 開啟前的焦點元素
      this._importModePreviousFocus =
        (this.document && this.document.activeElement) || null

      const focusable = [overwriteBtn, mergeBtn, cancelBtn]

      // focus trap：Tab / Shift+Tab 在三按鈕集合內循環，不跑出 modal
      const handleFocusTrap = (event) => {
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = this.document.activeElement
        if (event.shiftKey && active === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        }
      }

      // keydown 處理：Esc 取消、Tab 進入 focus trap
      const onKeydown = (event) => {
        if (event.key === 'Escape') {
          settle(null)
        } else if (event.key === 'Tab') {
          handleFocusTrap(event)
        }
      }

      // 遮罩點擊：只有點遮罩本身（非冒泡自 modal 內部）才視為取消（場景 5 / TC-B4）
      const onOverlayClick = (event) => {
        if (event.target === overlay) {
          settle(null)
        }
      }

      const onOverwrite = () => settle(CONSTANTS.IMPORT_MODE.OVERWRITE)
      const onMerge = () => settle(CONSTANTS.IMPORT_MODE.MERGE)
      const onCancel = () => settle(null)

      // 統一收斂出口：移除監聽器 → 隱藏 modal → 清 pending 旗標 → 還原焦點 → resolve
      const settle = (result) => {
        overwriteBtn.removeEventListener('click', onOverwrite)
        mergeBtn.removeEventListener('click', onMerge)
        cancelBtn.removeEventListener('click', onCancel)
        overlay.removeEventListener('click', onOverlayClick)
        modal.removeEventListener('keydown', onKeydown)

        this._hideImportModeModal()
        this._importModePending = null

        // 焦點還原：modal 關閉後焦點回到開啟前的元素
        if (
          this._importModePreviousFocus &&
          typeof this._importModePreviousFocus.focus === 'function'
        ) {
          this._importModePreviousFocus.focus()
        }
        this._importModePreviousFocus = null

        resolve(result)
      }

      // 綁定四種出口
      overwriteBtn.addEventListener('click', onOverwrite)
      mergeBtn.addEventListener('click', onMerge)
      cancelBtn.addEventListener('click', onCancel)
      overlay.addEventListener('click', onOverlayClick)
      modal.addEventListener('keydown', onKeydown)

      // 顯示 modal 並設初始焦點至預設按鈕（覆蓋）
      this._showImportModeModal()
      overwriteBtn.focus()
    })

    return this._importModePending
  }

  /**
   * 顯示匯入模式 modal（UC-04）
   * @private
   */
  _showImportModeModal () {
    if (this.elements.importModeOverlay) {
      this.elements.importModeOverlay.style.display = 'flex'
    }
  }

  /**
   * 隱藏匯入模式 modal（UC-04）
   * @private
   */
  _hideImportModeModal () {
    if (this.elements.importModeOverlay) {
      this.elements.importModeOverlay.style.display = 'none'
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
   * - 彈出模式選擇 modal，依使用者選擇分流至覆蓋 / 合併模式
   * - 管理載入狀態
   * - 持久化匯入資料至 chrome.storage.local
   * - 持久化成功才以 books 更新 UI
   *
   * W1-047.2 / IMP-B：importer 回傳介面由 Book[] 升級為 ImportResult
   * （{ books, tagCategories, tags }）。
   *
   * W1-047.3 / IMP-C：解構 ImportResult 後呼叫 TagStorageAdapter.replaceAllData
   * 覆蓋模式持久化三區段（books / tags / tagCategories）。
   *
   * W1-047.5 / IMP-E：在檔案驗證之後、讀檔之前彈出模式選擇 modal——
   * 覆蓋走 replaceAllData，合併走 mergeAllData，取消則靜默中止，
   * modal DOM 缺失則 showError。讀檔在 modal resolve 之後才執行。
   */
  async handleFileLoad (file) {
    // 1. 驗證階段由 importer 處理（會呼叫 showError 並 throw）——先於 modal
    this.bookFileImporter.validate(file)

    // 2. 模式選擇 modal：驗證通過後、讀檔前彈出
    const mode = await this.promptImportMode()

    // 3. modal DOM 缺失分流：視為設計缺陷，showError 後中止
    if (mode === IMPORT_MODE_MODAL_MISSING) {
      this.showError('匯入功能初始化失敗')
      return
    }

    // 4. 取消分流：使用者取消為正常操作，靜默中止——不讀檔、不寫 storage、UI 不變
    if (mode === null) {
      return
    }

    // 5. 讀檔（modal resolve 之後）：importer 回傳 ImportResult（INV-1 保證三欄位恆陣列）
    this.showLoading('正在讀取檔案...')
    const importResult = await this.bookFileImporter.read(file)

    // 6. 依模式分流持久化：覆蓋走 replaceAllData，合併走 mergeAllData
    const payload = {
      books: importResult.books,
      tags: importResult.tags,
      tagCategories: importResult.tagCategories
    }
    const writeResult = mode === CONSTANTS.IMPORT_MODE.OVERWRITE
      ? await TagStorageAdapter.replaceAllData(payload)
      : await TagStorageAdapter.mergeAllData(payload)

    // 7. 持久化成功才更新 UI；失敗中止並 showError（覆蓋 / 合併共用，回傳契約對稱）
    if (writeResult.success === true) {
      this._updateUIWithBooks(importResult.books)
    } else if (writeResult.error === 'quota_exceeded') {
      this.showError('儲存空間不足，匯入未完成')
    } else {
      this.showError('儲存失敗，已還原原有資料')
    }
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

  // ========== 檔案載入代理方法（向後相容，測試直接呼叫） ==========

  /**
   * 處理檔案內容（委派至 BookFileImporter）
   * @private
   * @param {string} content - 檔案內容
   *
   * 保留原因：測試環境中 handleFileLoad 的替代實作直接呼叫此方法
   *
   * W1-047.2 / IMP-B：importer 回傳 ImportResult，於此邊界解構 books 傳給 UI 層。
   */
  _handleFileContent (content) {
    const importResult = this.bookFileImporter._handleFileContent(content)
    this._updateUIWithBooks(importResult.books)
  }

  /**
   * 驗證檔案基本要求（委派至 BookFileImporter）
   * @private
   *
   * 保留原因：overview-page.test.js 透過 jest.spyOn 攔截此方法
   */
  _validateFileBasics (file) {
    return this.bookFileImporter._validateFileBasics(file)
  }

  /**
   * 驗證檔案大小（委派至 BookFileImporter）
   * @private
   *
   * 保留原因：overview-page.test.js 透過 jest.spyOn 攔截此方法
   */
  _validateFileSize (file) {
    return this.bookFileImporter._validateFileSize(file)
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
