/**
 * BookFileImporter - 檔案載入與解析模組
 *
 * 負責功能：
 * - JSON 檔案驗證（格式、大小）
 * - 檔案讀取（FileReader 整合）
 * - JSON 解析與 BOM 處理
 * - 書籍資料提取與驗證
 *
 * 設計考量：
 * - 從 OverviewPageController 提取，專責檔案載入邏輯
 * - 透過 dependency injection 接收 document、showError、ErrorCodes
 * - 保持與原 Controller 相同的驗證和解析行為
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

// 檔案載入相關常數
const FILE_CONSTANTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  LARGE_DATASET_THRESHOLD: 1000,
  MESSAGES: {
    FILE_PARSE_ERROR: '檔案解析失敗',
    FILE_READ_ERROR: '檔案讀取失敗',
    INVALID_JSON: '無效的 JSON 格式',
    INVALID_CSV: '無效的 CSV 格式'
  }
}

// CSV header → book 物件欄位的映射（對齊 book-exporter.js CSV_HEADERS）
// W6-012.6.1 輸出: ['書名', '書城來源', '進度', '狀態', '封面URL', 'id', 'authors', 'tagIds']
const CSV_HEADER_TO_FIELD = {
  書名: 'title',
  書城來源: 'source',
  進度: 'progress',
  狀態: 'status',
  封面URL: 'cover',
  id: 'id',
  authors: 'authors',
  tagIds: 'tagIds'
}

class BookFileImporter {
  /**
   * 建構 BookFileImporter
   *
   * @param {Object} deps - 依賴注入
   * @param {Document} deps.document - DOM 文檔物件
   * @param {Function} deps.showError - 顯示錯誤訊息的回呼函式
   */
  constructor ({ document, showError }) {
    this.document = document
    this.showError = showError
  }

  /**
   * 處理檔案載入操作
   *
   * @param {File} file - 要載入的檔案
   * @returns {Promise<Array>} 解析後的書籍陣列
   *
   * 負責功能：
   * - 協調檔案載入流程
   * - 整合驗證和讀取步驟
   */
  async handleFileLoad (file) {
    this._validateFileBasics(file)
    this._validateFileSize(file)
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
      this.showError('請先選擇一個 JSON 或 CSV 檔案！')
      const error = new Error('檔案不存在')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'validation' }
      throw error
    }
    if (!this._isJSONFile(file) && !this._isCSVFile(file)) {
      this.showError('請選擇 JSON 或 CSV 格式的檔案！')
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
   * 檢查是否為 CSV 檔案（W6-012.6.2）
   * @private
   * @param {File} file - 要檢查的檔案
   * @returns {boolean} 是否為 CSV 檔案
   */
  _isCSVFile (file) {
    const hasCSVExtension = file.name.toLowerCase().endsWith('.csv')
    // book-exporter.js 使用 'text/csv;charset=utf-8;'；部分瀏覽器回傳 'text/csv'
    const hasCSVMimeType = typeof file.type === 'string' && file.type.toLowerCase().startsWith('text/csv')
    return hasCSVExtension || hasCSVMimeType
  }

  /**
   * 驗證檔案大小
   * @private
   * @param {File} file - 要驗證的檔案
   * @throws {Error} 檔案過大時拋出錯誤
   */
  _validateFileSize (file) {
    if (file.size > FILE_CONSTANTS.MAX_FILE_SIZE) {
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
   * @returns {Promise<Array>} 解析後的書籍陣列
   */
  _readFileWithReader (file) {
    const fileFormat = this._isCSVFile(file) ? 'csv' : 'json'
    return new Promise((resolve, reject) => {
      const reader = this._createFileReader()
      this._setupReaderHandlers(reader, resolve, reject, fileFormat)
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
  _setupReaderHandlers (reader, resolve, reject, fileFormat) {
    reader.onload = (e) => this._handleReaderSuccess(e, resolve, reject, fileFormat)
    reader.onerror = () => this._handleReaderError(reject)
  }

  /**
   * 處理FileReader成功事件
   * @private
   * @param {Event} e - 載入事件
   * @param {Function} resolve - Promise resolve函數
   * @param {Function} reject - Promise reject函數
   * @param {string} fileFormat - 'csv' | 'json'（預設 json）
   */
  _handleReaderSuccess (e, resolve, reject, fileFormat) {
    try {
      const books = this._handleFileContent(e.target.result, fileFormat)
      resolve(books)
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

  /**
   * 處理檔案內容
   * @private
   *
   * @param {string} content - 檔案內容
   * @returns {Array} 處理後的書籍陣列
   */
  _handleFileContent (content, fileFormat) {
    const cleanContent = this._validateAndCleanContent(content)
    const data = fileFormat === 'csv'
      ? this._parseCSVContent(cleanContent)
      : this._parseJSONContent(cleanContent)
    const books = this._processBookData(data)
    return books
  }

  /**
   * 解析 CSV 內容（W6-012.6.2）
   *
   * 支援 W6-012.6.1 book-exporter.js 輸出格式：
   * - Header 列：書名,書城來源,進度,狀態,封面URL,id,authors,tagIds
   * - 每個欄位以雙引號包覆（exporter 固定加引號）
   * - authors 陣列以 ", " 分隔；tagIds 以 "; " 分隔
   * - 欄位順序容錯：依 header 名稱對應 field（非依固定位置）
   *
   * @private
   * @param {string} content - 要解析的 CSV 內容
   * @returns {Array} 解析後的 book 物件陣列
   */
  _parseCSVContent (content) {
    const rows = this._parseCSVRows(content)
    if (rows.length === 0) {
      const error = new Error(FILE_CONSTANTS.MESSAGES.INVALID_CSV + '：內容為空')
      error.code = ErrorCodes.PARSE_ERROR
      error.details = { category: 'parsing' }
      throw error
    }
    const headerRow = rows[0]
    const fieldNames = headerRow.map(h => CSV_HEADER_TO_FIELD[h] || null)
    if (!fieldNames.includes('id') || !fieldNames.includes('title')) {
      const error = new Error(FILE_CONSTANTS.MESSAGES.INVALID_CSV + '：缺少必要欄位（id 或 書名）')
      error.code = ErrorCodes.PARSE_ERROR
      error.details = { category: 'parsing' }
      throw error
    }
    const books = []
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i]
      if (this._isBlankRow(row)) continue
      books.push(this._csvRowToBook(row, fieldNames))
    }
    return books
  }

  /**
   * 判斷 CSV 列是否完全空白（用於忽略尾端空行）
   * @private
   */
  _isBlankRow (row) {
    return row.every(cell => cell === '' || cell === undefined)
  }

  /**
   * 將 CSV 內容拆解為二維 row × cell 陣列。
   *
   * 處理規則：
   * - 雙引號包覆欄位：欄位內可含逗號與換行
   * - 連續雙引號 `""` 視為單個跳脫雙引號
   * - 行尾換行 \n 或 \r\n
   *
   * @private
   * @param {string} content - CSV 純文字
   * @returns {Array<Array<string>>}
   */
  _parseCSVRows (content) {
    const rows = []
    let currentRow = []
    let currentField = ''
    let inQuotes = false
    let i = 0
    while (i < content.length) {
      const ch = content[i]
      if (inQuotes) {
        if (ch === '"') {
          if (content[i + 1] === '"') {
            currentField += '"'
            i += 2
            continue
          }
          inQuotes = false
          i += 1
          continue
        }
        currentField += ch
        i += 1
        continue
      }
      if (ch === '"') {
        inQuotes = true
        i += 1
        continue
      }
      if (ch === ',') {
        currentRow.push(currentField)
        currentField = ''
        i += 1
        continue
      }
      if (ch === '\r' && content[i + 1] === '\n') {
        currentRow.push(currentField)
        rows.push(currentRow)
        currentRow = []
        currentField = ''
        i += 2
        continue
      }
      if (ch === '\n' || ch === '\r') {
        currentRow.push(currentField)
        rows.push(currentRow)
        currentRow = []
        currentField = ''
        i += 1
        continue
      }
      currentField += ch
      i += 1
    }
    // 收尾：最後一個欄位 / 列（檔案可能不以換行結束）
    if (currentField !== '' || currentRow.length > 0) {
      currentRow.push(currentField)
      rows.push(currentRow)
    }
    return rows
  }

  /**
   * 將單一 CSV 資料列依 fieldNames 對應映射回 book 物件。
   *
   * @private
   * @param {Array<string>} row - 單列 cell 陣列
   * @param {Array<string|null>} fieldNames - 對應 header 解析出的 field 名稱
   * @returns {Object} book 物件
   */
  _csvRowToBook (row, fieldNames) {
    const book = {}
    for (let idx = 0; idx < fieldNames.length; idx += 1) {
      const field = fieldNames[idx]
      if (!field) continue // 未知 header，忽略該欄
      const raw = row[idx] === undefined ? '' : row[idx]
      book[field] = this._deserializeCSVField(field, raw)
    }
    return book
  }

  /**
   * 將 CSV cell 字串依欄位反序列化為對應型別。
   *
   * @private
   * @param {string} field - book 物件欄位名
   * @param {string} raw - CSV cell 原始字串值
   * @returns {*} 反序列化後的值
   */
  _deserializeCSVField (field, raw) {
    if (field === 'authors') {
      if (raw === '') return []
      return raw.split(', ').map(s => s.trim()).filter(s => s !== '')
    }
    if (field === 'tagIds') {
      if (raw === '') return []
      return raw.split('; ').map(s => s.trim()).filter(s => s !== '')
    }
    if (field === 'progress') {
      const n = Number(raw)
      return Number.isFinite(n) ? n : 0
    }
    return raw
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
   *
   * W5-002 修復：catch 區塊的 const error 改為 const parseError，避免變數遮蔽
   */
  _parseJSONContent (content) {
    try {
      return JSON.parse(content)
    } catch (error) {
      if (error instanceof SyntaxError) {
        const parseError = new Error('JSON 檔案格式不正確')
        parseError.code = ErrorCodes.PARSE_ERROR
        parseError.details = { category: 'parsing' }
        throw parseError
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
    if (books.length > FILE_CONSTANTS.LARGE_DATASET_THRESHOLD) {
      // Logger 後備方案: UI Component 效能警告
      // 設計理念: 大資料集處理警告需要開發者和用戶立即可見
      // 後備機制: console.warn 提供效能問題的即時提醒
      // 使用場景: 超過 1000 本書籍時的效能警告，提示未來優化需求
      // eslint-disable-next-line no-console
      console.warn('⚠️ 大型資料集，建議分批處理（未來改善）')
    }
  }

  /**
   * 從資料中提取書籍陣列
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
   */
  _isDirectArrayFormat (data) {
    return Array.isArray(data)
  }

  /**
   * 檢查是否為包裝books格式
   * @private
   */
  _isWrappedBooksFormat (data) {
    return data &&
           typeof data === 'object' &&
           Array.isArray(data.books)
  }

  /**
   * 檢查是否為metadata包裝格式
   * @private
   */
  _isMetadataWrapFormat (data) {
    return data &&
           data.data &&
           Array.isArray(data.data)
  }

  /**
   * 驗證書籍資料是否有效
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
   */
  _validateBookStructure (book) {
    return book && typeof book === 'object'
  }

  /**
   * 驗證必要欄位存在
   * @private
   */
  _validateRequiredFields (book) {
    return Boolean(book.id) &&
           Boolean(book.title) &&
           Boolean(book.cover)
  }

  /**
   * 驗證欄位類型
   * @private
   */
  _validateFieldTypes (book) {
    return typeof book.id === 'string' &&
           typeof book.title === 'string' &&
           typeof book.cover === 'string'
  }
}

// Node.js 環境：CommonJS 匯出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BookFileImporter }
}
