/**
 * BookDataExporter - 書籍資料匯出器 (TDD循環 #29)
 *
 * 負責功能：
 * - 多格式資料匯出 (CSV, JSON, Excel, PDF)
 * - 自訂欄位和格式設定
 * - 批量匯出和檔案壓縮
 * - 匯出進度追蹤和統計
 * - 範本系統和樣式客製化
 *
 * 設計考量：
 * - 支援多種主流匯出格式
 * - 高度可客製化的匯出選項
 * - 進度追蹤和錯誤處理
 * - 批量處理和檔案壓縮
 * - 範本化匯出和樣式系統
 *
 * 使用情境：
 * - Overview 頁面的資料匯出功能
 * - 書籍清單的批量匯出
 * - 閱讀報告的生成和下載
 *
 * @version 1.0.0
 * @since 2025-08-06
 */

// 常數定義 - 分層組織架構
const { StandardError } = require('src/core/errors/StandardError')

const CONSTANTS = {
  // 配置管理
  CONFIG: {
    DEFAULT: {
      defaultFormat: 'csv',
      includeHeaders: true,
      dateFormat: 'YYYY-MM-DD',
      encoding: 'utf-8',
      delimiter: ',',
      lineEnding: '\n'
    },
    FORMATS: {
      CSV: 'csv',
      JSON: 'json',
      EXCEL: 'excel',
      PDF: 'pdf',
      ZIP: 'zip'
    },
    ENCODINGS: ['utf-8', 'utf-16', 'gbk', 'big5']
  },

  // 匯出欄位
  FIELDS: {
    BASIC: ['id', 'title', 'author', 'publisher'],
    EXTENDED: ['id', 'title', 'author', 'publisher', 'publishDate', 'category', 'progress', 'status'],
    COMPLETE: ['id', 'title', 'author', 'publisher', 'publishDate', 'category', 'progress', 'status', 'isbn', 'rating', 'tags', 'notes', 'readingTime', 'price'],
    READING: ['title', 'author', 'progress', 'status', 'rating', 'notes'],
    STATISTICS: ['category', 'status', 'progress', 'rating', 'readingTime']
  },

  // 範本系統
  TEMPLATES: {
    DEFAULT: 'default',
    READING_PROGRESS: 'reading-progress',
    LIBRARY_CATALOG: 'library-catalog',
    STATISTICS_REPORT: 'statistics-report',
    CUSTOM: 'custom'
  },

  // 檔案和效能
  FILES: {
    MAX_SIZE_MB: 100,
    BATCH_SIZE: 1000,
    CHUNK_SIZE: 10000
  },

  // MIME 類型
  MIME_TYPES: {
    CSV: 'text/csv',
    JSON: 'application/json',
    EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    PDF: 'application/pdf',
    ZIP: 'application/zip'
  }
}

class BookDataExporter {
  /**
   * 建構書籍資料匯出器
   *
   * @param {Array} books - 書籍陣列
   * @param {Object} options - 配置選項
   */
  constructor (books = [], options = {}) {
    this.books = books
    this.config = { ...CONSTANTS.CONFIG.DEFAULT, ...options }

    this._initializeState()
    this._initializeStats()
    this._initializeTemplates()
  }

  /**
   * 初始化狀態
   */
  _initializeState () {
    this.exportHistory = []
    this.isExporting = false
    this.currentProgress = 0
    this.errorLog = []
    this.progressCallback = null
  }

  /**
   * 初始化統計資料
   */
  _initializeStats () {
    this.stats = {
      totalExports: 0,
      formatBreakdown: {},
      totalDataExported: 0,
      averageExportTime: 0
    }
  }

  /**
   * 初始化範本系統
   */
  _initializeTemplates () {
    this.templates = new Map()
    this.initializeDefaultTemplates()
  }

  /**
   * 通用匯出包裝器
   *
   * @param {string} format - 匯出格式
   * @param {Function} exportFunction - 實際匯出函數
   * @param {Object} options - 匯出選項
   * @returns {any} 匯出結果
   */
  _executeExport (format, exportFunction, options = {}) {
    const startTime = performance.now()
    this.updateProgress(0)

    try {
      const result = exportFunction(options)
      this.recordExport(format, this.books.length, performance.now() - startTime)
      return result
    } catch (error) {
      this.logError(`${format.toUpperCase()} export failed`, error)
      throw error
    }
  }

  /**
   * 處理欄位值以供匯出
   *
   * @param {any} value - 原始值
   * @param {string} format - 匯出格式
   * @returns {string} 處理後的值
   */
  _processFieldValue (value, format = 'csv') {
    // 處理特殊值
    if (value === null || value === undefined) {
      return ''
    }

    if (Array.isArray(value)) {
      return value.join('; ')
    }

    if (typeof value === 'object') {
      return JSON.stringify(value)
    }

    const stringValue = String(value)

    // CSV 特殊字符處理
    if (format === 'csv') {
      const delimiter = this.config.delimiter
      if (stringValue.includes(delimiter) || stringValue.includes('"') || stringValue.includes('\n')) {
        return '"' + stringValue.replace(/"/g, '""') + '"'
      }
    }

    return stringValue
  }

  /**
   * 初始化預設範本
   */
  initializeDefaultTemplates () {
    // 預設範本
    this.templates.set(CONSTANTS.TEMPLATES.DEFAULT, {
      name: 'default',
      fields: CONSTANTS.FIELDS.EXTENDED,
      format: 'csv',
      options: {}
    })

    // 閱讀進度範本
    this.templates.set(CONSTANTS.TEMPLATES.READING_PROGRESS, {
      name: 'reading-progress',
      fields: CONSTANTS.FIELDS.READING,
      format: 'csv',
      options: { delimiter: ',' }
    })

    // 圖書館目錄範本
    this.templates.set(CONSTANTS.TEMPLATES.LIBRARY_CATALOG, {
      name: 'library-catalog',
      fields: CONSTANTS.FIELDS.BASIC.concat(['publishDate', 'isbn', 'category']),
      format: 'csv',
      options: {}
    })

    // 統計報告範本
    this.templates.set(CONSTANTS.TEMPLATES.STATISTICS_REPORT, {
      name: 'statistics-report',
      fields: CONSTANTS.FIELDS.STATISTICS,
      format: 'json',
      options: { includeMetadata: true }
    })
  }

  /**
   * 匯出為 CSV 格式
   *
   * @param {Object} options - 匯出選項
   * @returns {string} CSV 字串
   */
  exportToCSV (options = {}) {
    return this._executeExport('csv', (opts) => {
      const fields = opts.fields || CONSTANTS.FIELDS.EXTENDED
      const delimiter = opts.delimiter || this.config.delimiter
      const includeHeaders = opts.includeHeaders !== false

      let csv = ''

      // 加入標題行
      if (includeHeaders) {
        csv += fields.join(delimiter) + this.config.lineEnding
      }

      // 處理資料行
      const validBooks = this.books.filter(book => book && typeof book === 'object')

      validBooks.forEach((book, index) => {
        const row = fields.map(field =>
          this._processFieldValue(book[field], 'csv')
        )

        csv += row.join(delimiter) + this.config.lineEnding

        // 更新進度
        this.updateProgress((index + 1) / validBooks.length * 100)
      })

      return csv
    }, options)
  }

  /**
   * 匯出為 JSON 格式
   *
   * @param {Object} options - 匯出選項
   * @returns {string} JSON 字串
   */
  exportToJSON (options = {}) {
    const startTime = performance.now()
    this.updateProgress(0)

    try {
      const fields = options.fields
      const pretty = options.pretty !== false
      const includeMetadata = options.includeMetadata || false

      let data = this.books

      // 篩選欄位
      if (fields && Array.isArray(fields)) {
        data = this.books.map(book => {
          const filteredBook = {}
          fields.forEach(field => {
            if (book.hasOwnProperty(field)) {
              filteredBook[field] = book[field]
            }
          })
          return filteredBook
        })
      }

      // 包含元資料
      if (includeMetadata) {
        const result = {
          metadata: {
            exportDate: new Date().toISOString(),
            totalBooks: this.books.length,
            fields: fields || Object.keys(this.books[0] || {}),
            ...options.metadata
          },
          books: data
        }
        data = result
      }

      this.updateProgress(50)

      // 生成 JSON
      const jsonString = pretty
        ? JSON.stringify(data, null, 2)
        : JSON.stringify(data)

      this.updateProgress(100)

      // 記錄匯出
      this.recordExport('json', this.books.length, performance.now() - startTime)

      return jsonString
    } catch (error) {
      this.logError('JSON export failed', error)
      throw error
    }
  }

  /**
   * 匯出為 Excel 格式
   *
   * @param {Object} options - 匯出選項
   * @returns {ArrayBuffer} Excel 檔案資料
   */
  exportToExcel (options = {}) {
    const startTime = performance.now()
    this.updateProgress(0)

    try {
      // 模擬 Excel 檔案生成（實際應用中會使用 xlsx 等函式庫）
      const sheetName = options.sheetName || '書籍清單'
      const fields = options.fields || CONSTANTS.FIELDS.EXTENDED

      // 創建工作簿資料結構
      const workbook = {
        SheetNames: [sheetName],
        Sheets: {}
      }

      this.updateProgress(25)

      // 處理多工作表
      if (options.multiSheet && options.sheets) {
        workbook.SheetNames = options.sheets.map(sheet => sheet.name)
        options.sheets.forEach(sheet => {
          workbook.Sheets[sheet.name] = this.createExcelSheet(sheet.data, fields)
        })
      } else {
        workbook.Sheets[sheetName] = this.createExcelSheet(this.books, fields)
      }

      this.updateProgress(75)

      // 模擬轉換為 ArrayBuffer（實際會使用 XLSX.write）
      const excelData = this.simulateExcelBuffer(workbook)

      this.updateProgress(100)

      // 記錄匯出
      this.recordExport('excel', this.books.length, performance.now() - startTime)

      return excelData
    } catch (error) {
      this.logError('Excel export failed', error)
      throw error
    }
  }

  /**
   * 創建 Excel 工作表
   *
   * @param {Array} data - 資料陣列
   * @param {Array} fields - 欄位陣列
   * @returns {Object} 工作表物件
   */
  createExcelSheet (data, fields) {
    const sheet = {}
    const range = { s: { c: 0, r: 0 }, e: { c: fields.length - 1, r: data.length } }

    // 標題行
    fields.forEach((field, colIndex) => {
      const cellAddress = this.encodeCellAddress(0, colIndex)
      sheet[cellAddress] = { v: field, t: 's' }
    })

    // 資料行
    data.forEach((item, rowIndex) => {
      fields.forEach((field, colIndex) => {
        const cellAddress = this.encodeCellAddress(rowIndex + 1, colIndex)
        const value = item[field]

        if (value !== null && value !== undefined) {
          if (typeof value === 'number') {
            sheet[cellAddress] = { v: value, t: 'n' }
          } else if (Array.isArray(value)) {
            sheet[cellAddress] = { v: value.join('; '), t: 's' }
          } else {
            sheet[cellAddress] = { v: String(value), t: 's' }
          }
        }
      })
    })

    sheet['!ref'] = this.encodeRange(range)
    return sheet
  }

  /**
   * 編碼儲存格位址
   *
   * @param {number} row - 行號
   * @param {number} col - 列號
   * @returns {string} 儲存格位址
   */
  encodeCellAddress (row, col) {
    let colName = ''
    let colNum = col

    while (colNum >= 0) {
      colName = String.fromCharCode(65 + (colNum % 26)) + colName
      colNum = Math.floor(colNum / 26) - 1
    }

    return colName + (row + 1)
  }

  /**
   * 編碼範圍
   *
   * @param {Object} range - 範圍物件
   * @returns {string} 範圍字串
   */
  encodeRange (range) {
    const start = this.encodeCellAddress(range.s.r, range.s.c)
    const end = this.encodeCellAddress(range.e.r, range.e.c)
    return `${start}:${end}`
  }

  /**
   * 模擬 Excel Buffer
   *
   * @param {Object} workbook - 工作簿物件
   * @returns {ArrayBuffer} 模擬的 Excel 資料
   */
  simulateExcelBuffer (workbook) {
    // 實際應用中會使用 XLSX.write(workbook, {type: 'array'})
    const jsonString = JSON.stringify(workbook)
    const buffer = new ArrayBuffer(jsonString.length)
    const view = new Uint8Array(buffer)

    for (let i = 0; i < jsonString.length; i++) {
      view[i] = jsonString.charCodeAt(i)
    }

    return buffer
  }

  /**
   * 匯出為 PDF 報告
   *
   * @param {Object} options - 匯出選項
   * @returns {ArrayBuffer} PDF 檔案資料
   */
  exportToPDF (options = {}) {
    const startTime = performance.now()
    this.updateProgress(0)

    try {
      const template = options.template || 'default'
      const includeStats = options.includeStats || false
      const includeCharts = options.includeCharts || false
      const title = options.title || '書籍閱讀報告'

      this.updateProgress(25)

      // 生成 PDF 內容結構
      const pdfContent = {
        title,
        metadata: {
          author: 'BookDataExporter',
          creator: 'Readmoo Book Extractor',
          creationDate: new Date()
        },
        content: []
      }

      // 加入書籍清單
      pdfContent.content.push({
        type: 'table',
        title: '書籍清單',
        data: this.books,
        fields: options.fields || CONSTANTS.FIELDS.READING
      })

      this.updateProgress(50)

      // 加入統計資訊
      if (includeStats) {
        pdfContent.content.push({
          type: 'statistics',
          title: '閱讀統計',
          data: this.generateStatistics()
        })
      }

      this.updateProgress(75)

      // 模擬 PDF 生成（實際會使用 jsPDF 等函式庫）
      const pdfData = this.simulatePDFBuffer(pdfContent, options.style)

      this.updateProgress(100)

      // 記錄匯出
      this.recordExport('pdf', this.books.length, performance.now() - startTime)

      return pdfData
    } catch (error) {
      this.logError('PDF export failed', error)
      throw error
    }
  }

  /**
   * 生成統計資訊
   *
   * @returns {Object} 統計資料
   */
  generateStatistics () {
    const stats = {
      總書籍數: this.books.length,
      已完成: this.books.filter(book => book.status === '已完成').length,
      閱讀中: this.books.filter(book => book.status === '閱讀中').length,
      未開始: this.books.filter(book => book.status === '未開始').length,
      平均進度: this.books.reduce((sum, book) => sum + (book.progress || 0), 0) / this.books.length,
      平均評分: this.books.reduce((sum, book) => sum + (book.rating || 0), 0) / this.books.length
    }

    return stats
  }

  /**
   * 模擬 PDF Buffer
   *
   * @param {Object} content - PDF 內容
   * @param {Object} style - 樣式設定
   * @returns {ArrayBuffer} 模擬的 PDF 資料
   */
  simulatePDFBuffer (content, style = {}) {
    // 實際應用中會使用 jsPDF 生成真實的 PDF
    const pdfString = JSON.stringify({ content, style })
    const buffer = new ArrayBuffer(pdfString.length)
    const view = new Uint8Array(buffer)

    for (let i = 0; i < pdfString.length; i++) {
      view[i] = pdfString.charCodeAt(i)
    }

    return buffer
  }

  /**
   * 批量匯出多種格式
   *
   * @param {Array} formats - 格式陣列
   * @param {Object} options - 匯出選項
   * @returns {Object} 各格式的匯出結果
   */
  batchExport (formats, options = {}) {
    const results = {}

    formats.forEach(format => {
      try {
        switch (format.toLowerCase()) {
          case 'csv':
            results.csv = this.exportToCSV(options.csv)
            break
          case 'json':
            results.json = this.exportToJSON(options.json)
            break
          case 'excel':
            results.excel = this.exportToExcel(options.excel)
            break
          case 'pdf':
            results.pdf = this.exportToPDF(options.pdf)
            break
          default:
            this.logError(`Unsupported format: ${format}`)
        }
      } catch (error) {
        this.logError(`Batch export failed for format ${format}`, error)
      }
    })

    return results
  }

  /**
   * 匯出為壓縮檔案
   *
   * @param {Array} formats - 要壓縮的格式
   * @param {Object} options - 壓縮選項
   * @returns {ArrayBuffer} ZIP 檔案資料
   */
  exportToZip (formats, options = {}) {
    const startTime = performance.now()

    try {
      const batchResults = this.batchExport(formats, options)

      // 模擬 ZIP 檔案創建（實際會使用 JSZip）
      const zipData = {
        files: {},
        options: {
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        }
      }

      // 加入各格式檔案
      Object.keys(batchResults).forEach(format => {
        const filename = `books.${format}`
        zipData.files[filename] = batchResults[format]
      })

      // 加入 README
      if (options.includeReadme) {
        zipData.files['README.txt'] = this.generateReadme()
      }

      // 模擬轉換為 ArrayBuffer
      const zipBuffer = this.simulateZipBuffer(zipData)

      // 記錄匯出
      this.recordExport('zip', this.books.length, performance.now() - startTime)

      return zipBuffer
    } catch (error) {
      this.logError('ZIP export failed', error)
      throw error
    }
  }

  /**
   * 按分類分組匯出
   *
   * @returns {Object} 按分類分組的匯出結果
   */
  exportByCategory () {
    const groupedBooks = {}

    this.books.forEach(book => {
      const category = book.category || '未分類'
      if (!groupedBooks[category]) {
        groupedBooks[category] = []
      }
      groupedBooks[category].push(book)
    })

    const results = {}
    Object.keys(groupedBooks).forEach(category => {
      const categoryExporter = new BookDataExporter(groupedBooks[category], this.config)
      results[category] = categoryExporter.exportToCSV()
    })

    return results
  }

  /**
   * 生成 README 內容
   *
   * @returns {string} README 內容
   */
  generateReadme () {
    return `書籍資料匯出檔案
================

匯出時間: ${new Date().toLocaleString()}
總書籍數: ${this.books.length}
匯出格式: 多種格式

檔案說明:
- books.csv: CSV 格式的書籍清單
- books.json: JSON 格式的書籍資料
- books.xlsx: Excel 格式的書籍清單
- books.pdf: PDF 格式的書籍報告

使用說明:
1. CSV 檔案可用 Excel、Google Sheets 等軟體開啟
2. JSON 檔案可用於程式開發或資料交換
3. Excel 檔案支援進階格式化和公式
4. PDF 檔案適合列印和分享

由 Readmoo 書庫提取器生成
`
  }

  /**
   * 模擬 ZIP Buffer
   *
   * @param {Object} zipData - ZIP 資料
   * @returns {ArrayBuffer} 模擬的 ZIP 資料
   */
  simulateZipBuffer (zipData) {
    const zipString = JSON.stringify(zipData)
    const buffer = new ArrayBuffer(zipString.length)
    const view = new Uint8Array(buffer)

    for (let i = 0; i < zipString.length; i++) {
      view[i] = zipString.charCodeAt(i)
    }

    return buffer
  }

  /**
   * 觸發檔案下載
   *
   * @param {string|ArrayBuffer} data - 檔案資料
   * @param {string} filename - 檔案名稱
   * @param {string} mimeType - MIME 類型
   */
  downloadFile (data, filename, mimeType) {
    try {
      let blob

      if (data instanceof ArrayBuffer) {
        blob = new Blob([data], { type: mimeType })
      } else {
        blob = new Blob([data], { type: mimeType + ';charset=utf-8' })
      }

      const url = global.URL.createObjectURL(blob)
      const link = global.document.createElement('a')

      link.href = url
      link.download = filename
      link.style.display = 'none'

      global.document.body.appendChild(link)
      link.click()
      global.document.body.removeChild(link)

      global.URL.revokeObjectURL(url)
    } catch (error) {
      this.logError('File download failed', error)
      throw error
    }
  }

  /**
   * 下載 CSV 檔案
   *
   * @param {Object} options - 下載選項
   */
  downloadCSV (options = {}) {
    const csvData = this.exportToCSV(options)
    const filename = options.filename || `books-${this.formatDate(new Date())}.csv`
    this.downloadFile(csvData, filename, CONSTANTS.MIME_TYPES.CSV)
  }

  /**
   * 下載 JSON 檔案
   *
   * @param {Object} options - 下載選項
   */
  downloadJSON (options = {}) {
    const jsonData = this.exportToJSON(options)
    const filename = options.filename || `books-${this.formatDate(new Date())}.json`
    this.downloadFile(jsonData, filename, CONSTANTS.MIME_TYPES.JSON)
  }

  /**
   * 下載 Excel 檔案
   *
   * @param {Object} options - 下載選項
   */
  downloadExcel (options = {}) {
    const excelData = this.exportToExcel(options)
    const filename = options.filename || `books-${this.formatDate(new Date())}.xlsx`
    this.downloadFile(excelData, filename, CONSTANTS.MIME_TYPES.EXCEL)
  }

  /**
   * 下載 PDF 檔案
   *
   * @param {Object} options - 下載選項
   */
  downloadPDF (options = {}) {
    const pdfData = this.exportToPDF(options)
    const filename = options.filename || `books-report-${this.formatDate(new Date())}.pdf`
    this.downloadFile(pdfData, filename, CONSTANTS.MIME_TYPES.PDF)
  }

  /**
   * 儲存到本地檔案系統
   *
   * @param {string} format - 檔案格式
   * @param {Object} options - 儲存選項
   */
  async saveToFile (format, options = {}) {
    if (!window.showSaveFilePicker) {
      throw new StandardError('FEATURE_NOT_SUPPORTED', 'File System Access API not supported', {
        category: 'export'
      })
    }

    try {
      let data
      let mimeType
      let defaultName

      switch (format.toLowerCase()) {
        case 'csv':
          data = this.exportToCSV(options)
          mimeType = CONSTANTS.MIME_TYPES.CSV
          defaultName = 'books.csv'
          break
        case 'json':
          data = this.exportToJSON(options)
          mimeType = CONSTANTS.MIME_TYPES.JSON
          defaultName = 'books.json'
          break
        default:
          throw new StandardError('UNKNOWN_ERROR', `Unsupported format: ${format}`, {
            category: 'export'
          })
      }

      const fileHandle = await window.showSaveFilePicker({
        suggestedName: defaultName,
        types: [{
          description: `${format.toUpperCase()} files`,
          accept: { [mimeType]: [`.${format}`] }
        }]
      })

      const writable = await fileHandle.createWritable()
      await writable.write(data)
      await writable.close()
    } catch (error) {
      this.logError('Save to file failed', error)
      throw error
    }
  }

  /**
   * 複製到剪貼簿
   *
   * @param {string} format - 資料格式
   * @param {Object} options - 複製選項
   */
  async copyToClipboard (format, options = {}) {
    if (!global.navigator || !global.navigator.clipboard || !global.navigator.clipboard.writeText) {
      throw new StandardError('FEATURE_NOT_SUPPORTED', 'Clipboard API not supported', {
        category: 'export'
      })
    }

    try {
      let data

      switch (format.toLowerCase()) {
        case 'csv':
          data = this.exportToCSV(options)
          break
        case 'json':
          data = this.exportToJSON(options)
          break
        default:
          throw new StandardError('UNKNOWN_ERROR', `Unsupported format for clipboard: ${format}`, {
            category: 'export'
          })
      }

      await global.navigator.clipboard.writeText(data)
    } catch (error) {
      this.logError('Copy to clipboard failed', error)
      throw error
    }
  }

  /**
   * 取得可用範本
   *
   * @returns {Array} 範本名稱陣列
   */
  getAvailableTemplates () {
    return Array.from(this.templates.keys())
  }

  /**
   * 加入自訂範本
   *
   * @param {Object} template - 範本定義
   */
  addTemplate (template) {
    if (this.validateTemplate(template)) {
      this.templates.set(template.name, template)
    } else {
      throw new StandardError('INVALID_DATA_FORMAT', 'Invalid template format', {
        category: 'export'
      })
    }
  }

  /**
   * 驗證範本格式
   *
   * @param {Object} template - 範本物件
   * @returns {boolean} 是否有效
   */
  validateTemplate (template) {
    return template &&
           typeof template.name === 'string' &&
           template.name.length > 0 &&
           Array.isArray(template.fields) &&
           template.fields.length > 0 &&
           typeof template.format === 'string' &&
           Object.values(CONSTANTS.CONFIG.FORMATS).includes(template.format)
  }

  /**
   * 使用範本匯出
   *
   * @param {string} templateName - 範本名稱
   * @returns {string|ArrayBuffer} 匯出結果
   */
  exportWithTemplate (templateName) {
    const template = this.templates.get(templateName)
    if (!template) {
      throw new StandardError('RESOURCE_NOT_FOUND', `Template not found: ${templateName}`, {
        category: 'export'
      })
    }

    const options = {
      fields: template.fields,
      ...template.options
    }

    switch (template.format) {
      case 'csv':
        return this.exportToCSV(options)
      case 'json':
        return this.exportToJSON(options)
      case 'excel':
        return this.exportToExcel(options)
      case 'pdf':
        return this.exportToPDF(options)
      default:
        throw new StandardError('UNKNOWN_ERROR', `Unsupported template format: ${template.format}`, {
          category: 'export'
        })
    }
  }

  /**
   * 匯出到指定格式
   *
   * @param {string} format - 目標格式
   * @param {Object} options - 匯出選項
   * @returns {string|ArrayBuffer} 匯出結果
   */
  exportToFormat (format, options = {}) {
    switch (format.toLowerCase()) {
      case 'csv':
        return this.exportToCSV(options)
      case 'json':
        return this.exportToJSON(options)
      case 'excel':
        return this.exportToExcel(options)
      case 'pdf':
        return this.exportToPDF(options)
      default:
        throw new StandardError('EXPORT_OPERATION_FAILED', `Unsupported export format: ${format}`, {
          category: 'export'
        })
    }
  }

  /**
   * 設定進度回調
   *
   * @param {Function} callback - 進度回調函數
   */
  setProgressCallback (callback) {
    this.progressCallback = callback
  }

  /**
   * 更新進度
   *
   * @param {number} progress - 進度百分比
   */
  updateProgress (progress) {
    this.currentProgress = Math.max(0, Math.min(100, progress))
    if (this.progressCallback) {
      this.progressCallback(this.currentProgress)
    }
  }

  /**
   * 取得匯出統計
   *
   * @returns {Object} 統計資料
   */
  getExportStats () {
    return { ...this.stats }
  }

  /**
   * 取得匯出歷史
   *
   * @returns {Array} 匯出歷史記錄
   */
  getExportHistory () {
    return [...this.exportHistory]
  }

  /**
   * 估算檔案大小
   *
   * @param {string} format - 檔案格式
   * @returns {number} 估算大小（bytes）
   */
  estimateFileSize (format) {
    const avgBookSize = 500 // 假設每本書平均 500 bytes
    const baseSize = this.books.length * avgBookSize

    switch (format.toLowerCase()) {
      case 'csv':
        return baseSize * 0.7 // CSV 通常較緊湊
      case 'json':
        return baseSize * 1.5 // JSON 有較多結構資訊
      case 'excel':
        return baseSize * 2.0 // Excel 有格式資訊
      case 'pdf':
        return baseSize * 3.0 // PDF 有排版資訊
      default:
        return baseSize
    }
  }

  /**
   * 取得錯誤記錄
   *
   * @returns {Array} 錯誤記錄
   */
  getErrorLog () {
    return [...this.errorLog]
  }

  /**
   * 記錄匯出
   *
   * @param {string} format - 匯出格式
   * @param {number} recordCount - 記錄數量
   * @param {number} exportTime - 匯出時間（毫秒）
   */
  recordExport (format, recordCount, exportTime) {
    const exportRecord = {
      format,
      recordCount,
      exportTime,
      timestamp: new Date().toISOString(),
      fileSize: this.estimateFileSize(format)
    }

    this.exportHistory.push(exportRecord)

    // 更新統計
    this.stats.totalExports++
    this.stats.totalDataExported += recordCount
    this.stats.formatBreakdown[format] = (this.stats.formatBreakdown[format] || 0) + 1

    // 計算平均匯出時間
    const totalTime = this.exportHistory.reduce((sum, record) => sum + record.exportTime, 0)
    this.stats.averageExportTime = totalTime / this.exportHistory.length
  }

  /**
   * 記錄錯誤
   *
   * @param {string} message - 錯誤訊息
   * @param {Error} error - 錯誤物件
   */
  logError (message, error = null) {
    const errorRecord = {
      message,
      error: error ? error.toString() : null,
      timestamp: new Date().toISOString(),
      stack: error ? error.stack : null
    }

    this.errorLog.push(errorRecord)
  }

  /**
   * 格式化日期
   *
   * @param {Date} date - 日期物件
   * @returns {string} 格式化的日期字串
   */
  formatDate (date) {
    return date.toISOString().split('T')[0]
  }
}

// CommonJS 匯出
module.exports = BookDataExporter
