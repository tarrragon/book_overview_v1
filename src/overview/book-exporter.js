/**
 * BookExporter - 書籍資料匯出模組
 *
 * 負責功能：
 * - CSV 匯出（生成內容、下載檔案）
 * - JSON 匯出（生成內容、下載檔案）
 * - 檔案下載觸發
 *
 * 設計考量：
 * - 從 OverviewPageController 提取，專責匯出邏輯
 * - 透過 dependency injection 接收 getFilteredBooks 和 document
 * - 保持與原 Controller 相同的匯出行為
 */

// 匯出配置常數
const EXPORT_CONSTANTS = {
  CSV_HEADERS: ['書名', '書城來源', '進度', '狀態', '封面URL'],
  FILE_TYPE: 'text/csv;charset=utf-8;',
  FILENAME_PREFIX: '書籍資料_',
  JSON_MIME: 'application/json;charset=utf-8;',
  JSON_FILENAME_PREFIX: '書籍資料_',
  NO_DATA_EXPORT: '沒有資料可以匯出'
}

class BookExporter {
  /**
   * 建構 BookExporter
   *
   * @param {Object} deps - 依賴注入
   * @param {Function} deps.getFilteredBooks - 取得當前篩選書籍的函式
   * @param {Document} deps.document - DOM 文檔物件
   */
  constructor ({ getFilteredBooks, document }) {
    this.getFilteredBooks = getFilteredBooks
    this.document = document
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
    const books = this.getFilteredBooks()
    if (!books || books.length === 0) {
      alert(EXPORT_CONSTANTS.NO_DATA_EXPORT)
      return
    }

    const csvContent = this.generateCSVContent()
    this.downloadCSVFile(csvContent)
  }

  /**
   * 處理匯出 JSON 操作
   */
  handleExportJSON () {
    const books = this.getFilteredBooks()
    if (!books || books.length === 0) {
      alert(EXPORT_CONSTANTS.NO_DATA_EXPORT)
      return
    }

    const json = this.generateJSONContent()
    this.downloadJSONFile(json)
  }

  /**
   * 生成 CSV 內容
   */
  generateCSVContent () {
    const books = this.getFilteredBooks()
    const csvRows = [
      EXPORT_CONSTANTS.CSV_HEADERS.join(','),
      ...books.map(book => this._bookToCSVRow(book))
    ]
    return csvRows.join('\n')
  }

  /**
   * 生成 JSON 內容（表格欄位對應）
   */
  generateJSONContent () {
    const books = this.getFilteredBooks()
    const rows = books.map(book => ({
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
   * 下載 CSV 檔案
   */
  downloadCSVFile (csvContent) {
    const blob = new Blob([csvContent], { type: EXPORT_CONSTANTS.FILE_TYPE })
    const filename = this._generateCSVFilename()
    this._triggerFileDownload(blob, filename)
  }

  /**
   * 下載 JSON 檔案
   */
  downloadJSONFile (jsonContent) {
    const blob = new Blob([jsonContent], { type: EXPORT_CONSTANTS.JSON_MIME })
    const date = new Date().toISOString().slice(0, 10)
    const filename = `${EXPORT_CONSTANTS.JSON_FILENAME_PREFIX}${date}.json`
    this._triggerFileDownload(blob, filename)
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
    return `${EXPORT_CONSTANTS.FILENAME_PREFIX}${date}.csv`
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
   * 格式化書城來源顯示
   * @private
   * @param {Object} book - 書籍資料
   * @returns {string} 格式化的書城來源
   */
  _formatBookSource (book) {
    // 優先使用 tags 陣列
    if (Array.isArray(book.tags) && book.tags.length > 0) {
      return book.tags.join(', ')
    }

    if (book.tag) {
      return book.tag
    }

    if (book.store) {
      return book.store
    }

    if (book.source) {
      return book.source
    }

    return 'readmoo'
  }
}

// 瀏覽器環境：將 BookExporter 定義為全域變數
if (typeof window !== 'undefined') {
  window.BookExporter = BookExporter
}

// Node.js 環境：保持 CommonJS 匯出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BookExporter }
}
