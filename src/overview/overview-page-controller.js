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

const EventHandler = require('../core/event-handler');

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
    CSV_HEADERS: ['書籍ID', '書名', '進度', '狀態', '封面URL'],
    FILE_TYPE: 'text/csv;charset=utf-8;',
    FILENAME_PREFIX: '書籍資料_'
  },
  
  // 元素選取器
  SELECTORS: {
    LOADING_TEXT: '.loading-text'
  }
};

class OverviewPageController extends EventHandler {
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
  constructor(eventBus, document) {
    super('OverviewPageController', CONSTANTS.PRIORITY);
    
    this.eventBus = eventBus;
    this.document = document;
    
    // 初始化頁面狀態
    this.currentBooks = [];
    this.filteredBooks = [];
    this.isLoading = false;
    this.searchTerm = '';
    
    // 初始化 DOM 元素引用
    this.initializeElements();
    
    // 設置事件監聽器
    this.setupEventListeners();
  }

  /**
   * 初始化 DOM 元素引用
   * 
   * 負責功能：
   * - 取得所有必要的 DOM 元素引用
   * - 建立元素快取以提高效能
   * - 分類組織元素引用
   */
  initializeElements() {
    // 定義元素映射表，提高可維護性
    const elementMap = {
      // 統計相關元素
      statistics: ['totalBooks', 'displayedBooks'],
      // 搜尋相關元素
      search: ['searchBox'],
      // 表格相關元素
      table: ['tableBody', 'booksTable'],
      // 操作按鈕元素
      buttons: ['exportCSVBtn', 'copyTextBtn', 'selectAllBtn', 'reloadBtn'],
      // 檔案載入相關元素
      fileLoad: ['fileUploader', 'jsonFileInput', 'loadFileBtn', 'loadSampleBtn'],
      // 狀態顯示元素
      status: ['loadingIndicator', 'errorContainer', 'errorMessage', 'retryBtn']
    };
    
    // 批量取得元素引用
    this.elements = {};
    Object.values(elementMap).flat().forEach(id => {
      this.elements[id] = this.document.getElementById(id);
    });
    
    // 快取常用元素
    this.cachedElements = {
      loadingText: this.document.querySelector(CONSTANTS.SELECTORS.LOADING_TEXT)
    };
  }

  /**
   * 設置事件監聽器
   * 
   * 負責功能：
   * - 註冊系統事件監聽器
   * - 設置 DOM 事件監聽器
   */
  setupEventListeners() {
    // 註冊系統事件監聽器
    if (this.eventBus) {
      this.eventBus.on('STORAGE.LOAD.COMPLETED', this.handleStorageLoadCompleted.bind(this));
      this.eventBus.on('EXTRACTION.COMPLETED', this.handleExtractionCompleted.bind(this));
      this.eventBus.on('UI.BOOKS.UPDATE', this.handleBooksUpdate.bind(this));
    }

    // 設置 DOM 事件監聽器
    if (this.elements.searchBox) {
      this.elements.searchBox.addEventListener('input', (e) => {
        this.handleSearchInput(e.target.value);
      });
    }

    if (this.elements.reloadBtn) {
      this.elements.reloadBtn.addEventListener('click', () => {
        this.handleReload();
      });
    }

    if (this.elements.exportCSVBtn) {
      this.elements.exportCSVBtn.addEventListener('click', () => {
        this.handleExportCSV();
      });
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
  handleStorageLoadCompleted(eventData) {
    if (this._validateEventData(eventData, 'books')) {
      this._updateBooksData(eventData.books);
      this.updateDisplay();
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
  handleExtractionCompleted(eventData) {
    this.handleReload();
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
  handleBooksUpdate(eventData) {
    if (this._validateEventData(eventData, 'books')) {
      this._updateBooksData(eventData.books);
      this.applyCurrentFilter();
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
  handleSearchInput(searchTerm) {
    this.searchTerm = searchTerm.toLowerCase().trim();
    this.applyCurrentFilter();
  }

  /**
   * 應用當前篩選條件
   * 
   * 負責功能：
   * - 根據搜尋詞篩選書籍
   * - 更新篩選結果
   * - 觸發顯示更新
   */
  applyCurrentFilter() {
    if (!this.searchTerm) {
      this.filteredBooks = [...this.currentBooks];
    } else {
      this.filteredBooks = this.currentBooks.filter(book => 
        book.title && book.title.toLowerCase().includes(this.searchTerm)
      );
    }
    this.updateDisplay();
  }

  /**
   * 更新頁面顯示
   * 
   * 負責功能：
   * - 更新統計資訊
   * - 重新渲染書籍表格
   * - 隱藏載入和錯誤狀態
   */
  updateDisplay() {
    this.updateStatistics(this.filteredBooks);
    this.renderBooksTable(this.filteredBooks);
    this.hideLoading();
    this.hideError();
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
  updateStatistics(books) {
    if (this.elements.totalBooks) {
      this.elements.totalBooks.textContent = this.currentBooks.length.toString();
    }
    
    if (this.elements.displayedBooks) {
      this.elements.displayedBooks.textContent = books.length.toString();
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
  renderBooksTable(books) {
    if (!this.elements.tableBody) return;

    this.clearTableContent();

    if (!books || books.length === 0) {
      this.renderEmptyState();
      return;
    }

    this.renderBookRows(books);
  }

  /**
   * 清空表格內容
   */
  clearTableContent() {
    this.elements.tableBody.innerHTML = '';
  }

  /**
   * 渲染空資料狀態
   */
  renderEmptyState() {
    const emptyRow = this._createEmptyTableRow();
    this.elements.tableBody.appendChild(emptyRow);
  }

  /**
   * 渲染書籍資料行
   */
  renderBookRows(books) {
    books.forEach(book => {
      const row = this.createBookRow(book);
      this.elements.tableBody.appendChild(row);
    });
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
  createBookRow(book) {
    const row = this.document.createElement('tr');
    const rowData = this._formatBookRowData(book);
    
    row.innerHTML = `
      <td>${rowData.cover}</td>
      <td>${rowData.id}</td>
      <td>${rowData.title}</td>
      <td>${rowData.progress}</td>
      <td>${rowData.status}</td>
    `;
    
    return row;
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
  showLoading(message = CONSTANTS.MESSAGES.DEFAULT_LOAD) {
    this.isLoading = true;
    this._toggleElement('loadingIndicator', true);
    this._updateLoadingText(message);
  }

  /**
   * 隱藏載入狀態
   * 
   * 負責功能：
   * - 隱藏載入指示器
   * - 清除載入狀態標記
   */
  hideLoading() {
    this.isLoading = false;
    this._toggleElement('loadingIndicator', false);
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
  showError(message) {
    this.hideLoading();
    this._toggleElement('errorContainer', true);
    this._updateErrorText(message);
  }

  /**
   * 隱藏錯誤訊息
   * 
   * 負責功能：
   * - 隱藏錯誤容器
   */
  hideError() {
    this._toggleElement('errorContainer', false);
  }

  /**
   * 處理匯出 CSV 操作
   * 
   * 負責功能：
   * - 將當前篩選的書籍資料匯出為 CSV
   * - 創建下載連結
   * - 觸發下載
   */
  handleExportCSV() {
    if (!this.filteredBooks || this.filteredBooks.length === 0) {
      alert(CONSTANTS.MESSAGES.NO_DATA_EXPORT);
      return;
    }

    const csvContent = this.generateCSVContent();
    this.downloadCSVFile(csvContent);
  }

  // ========== CSV 匯出相關方法 ==========
  
  /**
   * 生成 CSV 內容
   */
  generateCSVContent() {
    const csvRows = [
      CONSTANTS.EXPORT.CSV_HEADERS.join(','),
      ...this.filteredBooks.map(book => this._bookToCSVRow(book))
    ];
    return csvRows.join('\n');
  }

  /**
   * 下載 CSV 檔案
   */
  downloadCSVFile(csvContent) {
    const blob = new Blob([csvContent], { type: CONSTANTS.EXPORT.FILE_TYPE });
    const filename = this._generateCSVFilename();
    this._triggerFileDownload(blob, filename);
  }

  /**
   * 處理重新載入操作
   * 
   * 負責功能：
   * - 觸發儲存系統重新載入
   * - 顯示載入狀態
   * - 重置搜尋條件
   */
  handleReload() {
    this.showLoading(CONSTANTS.MESSAGES.RELOAD);
    this._resetSearchState();
    this._emitStorageLoadRequest('overview-reload');
  }

  /**
   * 處理檔案載入操作
   * 
   * @param {File} file - 要載入的檔案
   * 
   * 負責功能：
   * - 讀取 JSON 檔案
   * - 解析書籍資料
   * - 更新頁面顯示
   */
  handleFileLoad(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => this._handleFileContent(e.target.result);
    reader.onerror = () => this.showError(CONSTANTS.MESSAGES.FILE_READ_ERROR);
    reader.readAsText(file, 'utf-8');
  }

  // EventHandler 抽象方法實現

  // ========== 私有輔助方法 ==========
  
  /**
   * 驗證事件資料的有效性
   * @private
   */
  _validateEventData(eventData, property) {
    return eventData && eventData[property] && Array.isArray(eventData[property]);
  }
  
  /**
   * 更新書籍資料
   * @private
   */
  _updateBooksData(books) {
    this.currentBooks = books;
    this.filteredBooks = [...books];
  }
  
  /**
   * 切換元素的顯示/隱藏狀態
   * @private
   */
  _toggleElement(elementKey, show) {
    const element = this.elements[elementKey];
    if (element) {
      element.style.display = show ? 'block' : 'none';
    }
  }
  
  /**
   * 更新載入文字
   * @private
   */
  _updateLoadingText(message) {
    if (this.cachedElements.loadingText) {
      this.cachedElements.loadingText.textContent = message;
    }
  }
  
  /**
   * 更新錯誤文字
   * @private
   */
  _updateErrorText(message) {
    if (this.elements.errorMessage && message) {
      this.elements.errorMessage.textContent = message;
    }
  }
  
  /**
   * 創建空表格行
   * @private
   */
  _createEmptyTableRow() {
    const emptyRow = this.document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="${CONSTANTS.TABLE.COLUMNS}" style="text-align: center; padding: 40px; color: #666;">
        ${CONSTANTS.MESSAGES.EMPTY_BOOKS}
      </td>
    `;
    return emptyRow;
  }
  
  /**
   * 格式化書籍行資料
   * @private
   */
  _formatBookRowData(book) {
    const { WIDTH, HEIGHT } = CONSTANTS.TABLE.COVER_SIZE;
    
    return {
      cover: book.cover ? 
        `<img src="${book.cover}" alt="封面" style="width: ${WIDTH}px; height: ${HEIGHT}px; object-fit: cover;">` : 
        CONSTANTS.TABLE.DEFAULT_COVER,
      id: book.id || '-',
      title: book.title || '未知書名',
      progress: book.progress ? `${book.progress}%` : '-',
      status: book.status || '未知'
    };
  }
  
  /**
   * 將書籍資料轉換為 CSV 行
   * @private
   */
  _bookToCSVRow(book) {
    return [
      `"${book.id || ''}"`,
      `"${book.title || ''}"`,
      `"${book.progress || 0}"`,
      `"${book.status || ''}"`,
      `"${book.cover || ''}"`
    ].join(',');
  }
  
  /**
   * 生成 CSV 檔案名
   * @private
   */
  _generateCSVFilename() {
    const date = new Date().toISOString().slice(0, 10);
    return `${CONSTANTS.EXPORT.FILENAME_PREFIX}${date}.csv`;
  }
  
  /**
   * 觸發檔案下載
   * @private
   */
  _triggerFileDownload(blob, filename) {
    const link = this.document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    this.document.body.appendChild(link);
    link.click();
    this.document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }
  
  /**
   * 重置搜尋狀態
   * @private
   */
  _resetSearchState() {
    this.searchTerm = '';
    if (this.elements.searchBox) {
      this.elements.searchBox.value = '';
    }
  }
  
  /**
   * 發送儲存載入請求
   * @private
   */
  _emitStorageLoadRequest(source) {
    if (this.eventBus) {
      this.eventBus.emit(CONSTANTS.EVENTS.STORAGE_LOAD_REQUEST, {
        source,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * 處理檔案內容
   * @private
   */
  _handleFileContent(content) {
    try {
      const data = JSON.parse(content);
      const books = this._extractBooksFromData(data);
      
      this._updateBooksData(books);
      this.updateDisplay();
      
    } catch (error) {
      this.showError(`${CONSTANTS.MESSAGES.FILE_PARSE_ERROR}: ${error.message}`);
    }
  }
  
  /**
   * 從資料中提取書籍陣列
   * @private
   */
  _extractBooksFromData(data) {
    if (Array.isArray(data)) {
      return data;
    } else if (data.books && Array.isArray(data.books)) {
      return data.books;
    } else {
      throw new Error(CONSTANTS.MESSAGES.INVALID_JSON);
    }
  }

  // ========== EventHandler 抽象方法實現 ==========

  /**
   * 取得支援的事件類型
   * 
   * @returns {string[]} 支援的事件類型列表
   */
  getSupportedEvents() {
    return [...CONSTANTS.EVENTS.SUPPORTED];
  }

  /**
   * 處理事件的主要邏輯
   * 
   * @param {Object} event - 事件物件
   * @returns {Promise<boolean>} 處理結果
   */
  async process(event) {
    const { type: eventType, data: eventData } = event;
    
    try {
      switch (eventType) {
        case 'STORAGE.LOAD.COMPLETED':
          this.handleStorageLoadCompleted(eventData);
          break;
        case 'EXTRACTION.COMPLETED':
          this.handleExtractionCompleted(eventData);
          break;
        case 'UI.BOOKS.UPDATE':
          this.handleBooksUpdate(eventData);
          break;
        default:
          return false;
      }
      
      return true;
      
    } catch (error) {
      console.error(`Overview 控制器處理事件失敗: ${eventType}`, error);
      throw error;
    }
  }

  /**
   * 取得當前狀態
   * 
   * @returns {Object} 當前狀態資訊
   */
  getStatus() {
    return {
      name: this.name,
      isLoading: this.isLoading,
      booksCount: this.currentBooks.length,
      filteredCount: this.filteredBooks.length,
      searchTerm: this.searchTerm,
      lastUpdate: new Date().toISOString()
    };
  }
}

// CommonJS 匯出
module.exports = { OverviewPageController };