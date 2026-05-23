/**
 * BookFileImporter - 檔案載入與解析模組
 *
 * 負責功能：
 * - JSON 檔案驗證（格式、大小）
 * - 檔案讀取（FileReader 整合）
 * - JSON 解析與 BOM 處理
 * - 書籍資料提取與驗證
 * - v2 interchange 三區段（books / tagCategories / tags）提取（W1-047.2 / IMP-B）
 *
 * 設計考量：
 * - 從 OverviewPageController 提取，專責檔案載入邏輯
 * - 透過 dependency injection 接收 document、showError、ErrorCodes
 * - 保持與原 Controller 相同的驗證和解析行為
 *
 * 回傳介面（W1-047.2 / IMP-B）：
 * 回傳鏈 _extractBooksFromData → _processBookData → _handleFileContent →
 * _readFileWithReader → handleFileLoad 由純 Book[] 升級為 ImportResult。
 *
 * @typedef {Object} ImportResult
 * @property {Array<Object>} books          - 書籍陣列，必有，可能為空陣列
 * @property {Array<Object>} tagCategories  - tag 分類陣列，必有，可能為空陣列
 * @property {Array<Object>} tags           - tag 陣列，必有，可能為空陣列
 *
 * 不變式 INV-1：ImportResult 三欄位永遠存在且型別恆為陣列，
 * 任何路徑（v1 / v2 / CSV / 空物件）不得回傳 undefined / null。
 * 消費端可無條件解構，無需 null 檢查。
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')
const { detectFormatVersion } = require('src/export/format-version-detector')
const { convertV1ToV2Data } = require('src/export/v1-to-v2-converter')

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
   * @returns {Promise<ImportResult>} 含 books / tagCategories / tags 三區段的匯入結果
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
   * 驗證檔案是否符合匯入前置條件（存在性 + 格式 + 大小）
   *
   * Public API（W1-048.1 Stage A）：合併 _validateFileBasics + _validateFileSize 為單一進入點，
   * 作為 controller / 外部呼叫者的驗證契約。內部 delegate 至既有底線私有方法，行為等價。
   *
   * @param {File} file - 要驗證的檔案
   * @throws {Error} VALIDATION_ERROR：失敗時已呼叫 showError，caller 應中止流程
   */
  validate (file) {
    this._validateFileBasics(file)
    this._validateFileSize(file)
  }

  /**
   * 從已驗證的 file 讀取內容、解析、提取 ImportResult
   *
   * Public API（W1-048.1 Stage A）：純 thin wrapper，delegate 至 _readFileWithReader。
   * 前置：file 已通過 validate（caller 責任；read 不重複驗證）。
   *
   * @param {File} file - 要讀取的檔案（須已通過 validate）
   * @returns {Promise<ImportResult>} 含 books / tagCategories / tags 三區段的匯入結果
   */
  read (file) {
    return this._readFileWithReader(file)
  }

  /**
   * 將字串內容解析為 ImportResult（純函式入口）
   *
   * Public API（W1-048.1 Stage A）：解決 F16 fileFormat 訊號遺失——
   * fileFormat 為必填參數，未傳時 throw TypeError，從型別契約消除遺漏。
   *
   * @param {string} content - 檔案內容字串
   * @param {string} fileFormat - 'json' 或 'csv'（必填，無預設值）
   * @returns {ImportResult} 含 books / tagCategories / tags 三區段的匯入結果
   * @throws {TypeError} fileFormat 缺漏（undefined / null）時拋出
   * @throws {Error} fileFormat 非 'json' / 'csv' 時拋出 PARSE_ERROR；解析失敗時拋出對應 error
   */
  parseContent (content, fileFormat) {
    if (fileFormat === undefined || fileFormat === null) {
      throw new TypeError('parseContent: fileFormat is required (must be "json" or "csv")')
    }
    if (fileFormat !== 'json' && fileFormat !== 'csv') {
      const error = new Error('parseContent: fileFormat must be "json" or "csv"')
      error.code = ErrorCodes.PARSE_ERROR
      error.details = { category: 'parsing' }
      throw error
    }
    return this._handleFileContent(content, fileFormat)
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
   * @returns {Promise<ImportResult>} 含 books / tagCategories / tags 三區段的匯入結果
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
      const result = this._handleFileContent(e.target.result, fileFormat)
      resolve(result)
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
   * @param {string} [fileFormat='json'] - 'csv' | 'json'
   * @returns {ImportResult} 含 books / tagCategories / tags 三區段的匯入結果
   */
  _handleFileContent (content, fileFormat = 'json') {
    const cleanContent = this._validateAndCleanContent(content)
    const data = fileFormat === 'csv'
      ? this._parseCSVContent(cleanContent)
      : this._parseJSONContent(cleanContent)
    return this._processBookData(data, fileFormat)
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
   * W1-048.2 修復（F9）：以 Error options 的 cause 欄位保留原始 SyntaxError 的 stack trace 與訊息，
   * 後續 telemetry / 日誌可透過 err.cause 追蹤原始 parse 失敗位置（observability-rules 規則 1 catch 必有可追溯資訊）。
   */
  _parseJSONContent (content) {
    try {
      return JSON.parse(content)
    } catch (error) {
      if (error instanceof SyntaxError) {
        const parseError = new Error('JSON 檔案格式不正確', { cause: error })
        parseError.code = ErrorCodes.PARSE_ERROR
        parseError.details = { category: 'parsing' }
        throw parseError
      }
      throw error
    }
  }

  /**
   * 處理書籍資料
   *
   * 匯聚點：接收 _extractBooksFromData 的 ImportResult，僅對 books 區段做
   * 有效性過濾與大型資料集檢查；tagCategories / tags 原樣透傳不過濾
   * （tag 區段過濾不屬本模組職責，見 feature-spec §2.2）。
   *
   * @private
   * @param {any} data - 解析後的JSON資料
   * @param {string} [fileFormat='json'] - 'csv' | 'json'，傳遞給版本偵測閘門
   * @returns {ImportResult} 含過濾後 books 與透傳 tagCategories / tags 的匯入結果
   */
  _processBookData (data, fileFormat = 'json') {
    const extracted = this._extractBooksFromData(data, fileFormat)
    const validBooks = this._filterValidBooks(extracted.books)
    this._checkLargeDataset(validBooks)
    return {
      books: validBooks,
      tagCategories: extracted.tagCategories,
      tags: extracted.tags
    }
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
      console.warn('[WARNING] 大型資料集，建議分批處理（未來改善）')
    }
  }

  /**
   * 從資料中提取 v2 interchange 三區段（W1-047.2 / IMP-B）
   * @private
   *
   * 版本顯式分流（W1-048.7）：頂層先依 fileFormat 分 CSV / JSON，JSON 子流程再依
   * detectFormatVersion 顯式分 v1 / v2，MetadataWrap 屬 spec 未定義之歷史相容路徑
   * （命中時 console.warn 標記），空物件為 v1 退化合理，其他結構維持 throw 契約。
   *
   * 6 線性分支路徑表（spec 對應）：
   * - CSV               頂層分流，不走版本偵測（F11 顯式化；CSV 自有 detectCsvFormatVersion）
   * - JSON-v1           detectFormatVersion='v1' → convertV1ToV2Data 三區段（spec §2.1 Rule 3/4）
   * - JSON-v2           detectFormatVersion='v2' → 取 data.books（spec §3.1 唯一合法形狀）
   * - JSON-MetadataWrap _isMetadataWrapFormat → 取 data.data + warn（spec 未定義，歷史相容）
   * - JSON-EmptyObject  {} → 空 ImportResult（v1 退化合理）
   * - JSON-Unrecognized → throw VALIDATION_ERROR（既有錯誤契約零回歸）
   *
   * 設計決策（W1-048.7 Solution Phase 1）：
   * - A3 MetadataWrap 保留 + console.warn：spec 未定義但 TC-05 字面要求回歸防護
   * - B2 v2 path 顯式分流：對齊 v1 path 既有 detectFormatVersion 顯式設計
   * - C2 CSV 頂層分流：消除 CSV 走 v2 形狀辨識的隱性耦合（_isDirectArrayFormat dead branch）
   *
   * 回傳介面（IMP-B）：ImportResult { books, tagCategories, tags }。
   * INV-1：所有 return path 三欄位恆為陣列，throw path 不回傳。
   *
   * @param {any} data - 解析後的 JSON 資料 / CSV 解析結果
   * @param {string} [fileFormat='json'] - 'csv' | 'json'，csv 走頂層 bypass
   * @returns {ImportResult} 含 books / tagCategories / tags 三區段的提取結果
   */
  _extractBooksFromData (data, fileFormat = 'json') {
    // 頂層分流 1：CSV — 不走版本偵測（W1-048.7 決策 C2）
    if (fileFormat === 'csv') {
      return {
        books: Array.isArray(data) ? data : [],
        tagCategories: [],
        tags: []
      }
    }

    // 頂層分流 2：JSON — 走版本偵測
    const version = detectFormatVersion(data)

    // JSON path A：v1 — converter 完整三區段（spec §2.1 Rule 3/4）
    if (version === 'v1') {
      const converted = convertV1ToV2Data(data)
      return {
        books: converted.books,
        tagCategories: this._normalizeToArray(converted.tagCategories),
        tags: this._normalizeToArray(converted.tags)
      }
    }

    // JSON path B：v2 — spec §3.1 唯一合法形狀 data.books（W1-048.7 決策 B2）
    if (version === 'v2') {
      return {
        books: data.books,
        tagCategories: this._extractTagSection(data, 'tagCategories'),
        tags: this._extractTagSection(data, 'tags')
      }
    }

    // JSON path C：MetadataWrap 歷史相容（spec 未定義，W1-048.7 決策 A3 保留 + warn）
    if (this._isMetadataWrapFormat(data)) {
      // Logger 後備方案: MetadataWrap 相容路徑降級警告
      // 設計理念: spec 未定義的歷史相容形狀（IMP-A~B 演進中加入），命中時應對開發者可見
      // 後備機制: console.warn 在無 Logger 環境提供相容路徑可觀測性
      // 使用場景: 用戶 export 含 {data: [...]} 結構檔案匯入時，標記非 SPEC-EXPORT-V2 形狀
      // eslint-disable-next-line no-console
      console.warn('[book-file-importer] 偵測到 metadata-wrap 形狀（非 SPEC-EXPORT-V2 定義），走歷史相容路徑')
      return {
        books: data.data,
        tagCategories: this._extractTagSection(data, 'tagCategories'),
        tags: this._extractTagSection(data, 'tags')
      }
    }

    // JSON path D：空 JSON 物件（v1 退化合理）
    if (data && typeof data === 'object' && Object.keys(data).length === 0) {
      return { books: [], tagCategories: [], tags: [] }
    }

    // JSON path E：throw — 既有錯誤契約（零回歸）
    const error = new Error('JSON 檔案應該包含一個陣列或包含books屬性的物件')
    error.code = ErrorCodes.VALIDATION_ERROR
    error.details = { category: 'validation' }
    throw error
  }

  /**
   * 從根物件提取單一 tag 區段（tagCategories 或 tags），採寬鬆降級。
   * @private
   *
   * 降級規則（feature-spec §2.3 / SPEC-EXPORT-V2 §2.3「必須為陣列，否則初始化為空陣列」）：
   * - 合法陣列：原樣回傳（保持參考，與既有 books 取 data.books 同參考行為一致）。
   * - 缺失（undefined）：回傳 []，不告警（缺失屬正常情況）。
   * - 非陣列（物件 / 字串 / null 等）：回傳 []，以 console.warn 記錄欄位名與降級原因。
   * - data 本身非物件（如 CSV 路徑傳入陣列、或 null）：先判型再讀屬性，安全回傳 []。
   *
   * @param {any} data - 來源根物件
   * @param {string} fieldName - 區段欄位名（'tagCategories' | 'tags'）
   * @returns {Array<Object>} 合法陣列或空陣列
   */
  _extractTagSection (data, fieldName) {
    const candidate = (data && typeof data === 'object') ? data[fieldName] : undefined
    if (Array.isArray(candidate)) {
      return candidate
    }
    // 缺失不告警；值存在但型別錯誤才告警（observability-rules 規則 1：含欄位名與原因）
    if (candidate !== undefined && candidate !== null) {
      // Logger 後備方案: tag 區段型別降級警告
      // 設計理念: 匯入檔 tag 區段型別非陣列屬資料異常，需開發者可見
      // 後備機制: console.warn 在無 Logger 環境提供降級事件可觀測性
      // 使用場景: v2 JSON 的 tagCategories / tags 欄位型別錯誤時的降級提示
      // eslint-disable-next-line no-console
      console.warn(`${fieldName} 型別非陣列，降級為空陣列`)
    }
    return []
  }

  /**
   * 將值正規化為陣列：陣列原樣回傳，否則回傳空陣列。
   * @private
   *
   * 用途：v1 路徑對 convertV1ToV2Data 輸出的防禦。converter 契約已回傳陣列，
   * 此防禦使 INV-1 在所有路徑成立，且免去對 converter 內部實作的耦合假設。
   *
   * @param {any} value - 待正規化的值
   * @returns {Array} 原陣列或空陣列
   */
  _normalizeToArray (value) {
    return Array.isArray(value) ? value : []
  }

  /**
   * 檢查是否為 metadata-wrap 形狀（{data: [...]}）。
   * @private
   *
   * 歷史相容判定，非 SPEC-EXPORT-V2 形狀（W1-048.7 決策 A3）。
   * 此 helper 為 _extractBooksFromData JSON path C 唯一使用者，命中時會
   * console.warn 標記為「歷史相容路徑」，提供未來 spec 補定義 / deprecate 的觀測訊號。
   *
   * 移除歷史（W1-048.7）：原 _isDirectArrayFormat / _isWrappedBooksFormat 兩個 helper
   * 已隨 v1 / v2 path 顯式分流而移除——detectFormatVersion Rule 3（純陣列→v1）
   * 與 Rule 1/2（v2 顯式判定）已涵蓋兩種形狀辨識需求，原 helper 成為 dead branch。
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
   *
   * W1-047.1：移除 cover 強制要求（SPEC-EXPORT-V2 §3.5 cover 為選填）。
   * 僅驗證 id 與 title；cover 型別仍由 _validateFieldTypes 檢查為 string
   * （v1 轉換產出的 book cover 為 ''，型別檢查通過）。
   */
  _validateRequiredFields (book) {
    return Boolean(book.id) &&
           Boolean(book.title)
  }

  /**
   * 驗證欄位類型
   * @private
   *
   * W1-048.4.1：cover 為選填欄位（SPEC-EXPORT-V2 §3.5、data-management.md），
   * 容許 cover 為 undefined。W1-048.4 ANA 識別 selectively-loose validation 反模式：
   * _validateRequiredFields 已不要求 cover（W1-047.1），但 _validateFieldTypes 仍嚴格要求
   * typeof === 'string'，導致缺 cover 的合法 v2 JSON 書籍被靜默過濾。
   * 修復方向：方案 A（真寬鬆）—— cover 為 string 或 undefined 皆通過。
   */
  _validateFieldTypes (book) {
    return typeof book.id === 'string' &&
           typeof book.title === 'string' &&
           (typeof book.cover === 'string' || book.cover === undefined)
  }
}

// Node.js 環境：CommonJS 匯出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BookFileImporter }
}
