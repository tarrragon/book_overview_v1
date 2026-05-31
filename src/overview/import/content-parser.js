/**
 * ContentParser - 檔案內容解析 helper class
 *
 * 對應 ticket: 0.19.0-W1-048.10.1.2（W1-048.10.1 SOLID 拆分第 2 個 sub-IMP）
 *
 * 負責功能：
 * - 純函式 content 解析（無 IO 無 state）
 * - JSON / CSV 解析、BOM 移除、版本偵測、三區段提取、book 驗證過濾
 * - 封裝 BookFileImporter._handleFileContent 及其 ~22 個子 helper 邏輯
 *
 * 設計考量：
 * - 透過 dependency injection 接收 detectFormatVersion / convertV1ToV2Data 函式，
 *   預設用 src/export/* 模組（生產情境零變更，向後相容）
 * - largeDatasetThreshold 預設 1000（對齊既有 FILE_CONSTANTS.LARGE_DATASET_THRESHOLD）
 * - 例外契約完整繼承既有 importer.parseContent + _handleFileContent：
 *   * fileFormat 缺漏 → TypeError
 *   * fileFormat 非 'json'/'csv' → PARSE_ERROR
 *   * content 為空 → VALIDATION_ERROR
 *   * JSON parse 失敗 → PARSE_ERROR (含 cause 保留)
 *   * CSV 內容為空 / 缺必要欄位 → PARSE_ERROR
 *   * 無法辨識的 JSON 結構 → VALIDATION_ERROR
 *
 * INV-1 不變式：
 * - 所有正常 return path，回傳 ImportResult 三欄位 (books / tagCategories / tags) 恆為陣列。
 *
 * 等價契約來源：src/overview/book-file-importer.js L322-823（W1-048.7 / W1-048.8 落地版本）
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')
const {
  detectFormatVersion: defaultDetectFormatVersion
} = require('src/export/format-version-detector')
const {
  convertV1ToV2Data: defaultConvertV1ToV2Data
} = require('src/export/v1-to-v2-converter')

// 模組常數（對齊 importer.js FILE_CONSTANTS）
const DEFAULT_LARGE_DATASET_THRESHOLD = 1000

const MESSAGES = {
  INVALID_CSV: '無效的 CSV 格式'
}

// CSV header → book 物件欄位的映射（等價搬遷自 importer.js CSV_HEADER_TO_FIELD L46-57）
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

class ContentParser {
  /**
   * 建構 ContentParser
   *
   * @param {Object} [deps] - 依賴注入（全為選用）
   * @param {Function} [deps.detectFormatVersion] - 預設用 src/export/format-version-detector
   * @param {Function} [deps.convertV1ToV2Data] - 預設用 src/export/v1-to-v2-converter
   * @param {number} [deps.largeDatasetThreshold=1000] - 大型資料集警告閾值
   */
  constructor (deps = {}) {
    this._detectFormatVersion = typeof deps.detectFormatVersion === 'function'
      ? deps.detectFormatVersion
      : defaultDetectFormatVersion
    this._convertV1ToV2Data = typeof deps.convertV1ToV2Data === 'function'
      ? deps.convertV1ToV2Data
      : defaultConvertV1ToV2Data
    this._largeDatasetThreshold = typeof deps.largeDatasetThreshold === 'number'
      ? deps.largeDatasetThreshold
      : DEFAULT_LARGE_DATASET_THRESHOLD
  }

  /**
   * 將字串內容解析為 ImportResult（純函式入口）
   *
   * 前置鏈短路（與 importer.parseContent + _handleFileContent 等價）：
   * 1. fileFormat 必填（TypeError）
   * 2. fileFormat 合法（'json' / 'csv'，否則 PARSE_ERROR）
   * 3. content 非空（VALIDATION_ERROR）
   * 4. BOM 移除
   * 5. format-specific parse（JSON SyntaxError → PARSE_ERROR；CSV 欄位 → PARSE_ERROR）
   * 6. 結構辨識（v1 / v2 / 三區段 / 空物件 / 未知 → VALIDATION_ERROR）
   * 7. INV-1 後處理（三欄位陣列化）
   *
   * @param {string} content - 檔案內容字串
   * @param {'json'|'csv'} fileFormat - 必填
   * @returns {{ books: Array, tagCategories: Array, tags: Array }} ImportResult，三欄位恆為陣列
   * @throws {TypeError} fileFormat 缺漏（undefined / null）
   * @throws {Error} code=PARSE_ERROR / VALIDATION_ERROR，details.category 對應
   */
  parse (content, fileFormat) {
    if (fileFormat === undefined || fileFormat === null) {
      throw new TypeError('parse: fileFormat is required (must be "json" or "csv")')
    }
    if (fileFormat !== 'json' && fileFormat !== 'csv') {
      const error = new Error('parse: fileFormat must be "json" or "csv"')
      error.code = ErrorCodes.PARSE_ERROR
      error.details = { category: 'parsing' }
      throw error
    }
    const cleanContent = this._validateAndCleanContent(content)
    const data = fileFormat === 'csv'
      ? this._parseCSVContent(cleanContent)
      : this._parseJSONContent(cleanContent)
    return this._processBookData(data, fileFormat)
  }

  // ===== Content cleaning =====

  /**
   * 驗證並清理檔案內容
   * @private
   * @param {string} content - 原始檔案內容
   * @returns {string} 清理後的內容
   * @throws {Error} VALIDATION_ERROR：content 為空 / null / 全空白
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
   * 移除 UTF-8 BOM 標記
   * @private
   */
  _removeBOM (content) {
    // 使用 Unicode escape (U+FEFF) 取代字面 BOM 字元，避免 no-irregular-whitespace lint 錯誤
    return content.replace(/^\uFEFF/, '')
  }

  // ===== JSON path =====

  /**
   * 解析 JSON 內容
   * @private
   * @returns {any} 解析後的資料
   * @throws {Error} PARSE_ERROR (含 cause 保留原 SyntaxError)
   *
   * W1-048.2 修復（F9）：以 Error options 的 cause 欄位保留原始 SyntaxError 的 stack trace 與訊息，
   * 後續 telemetry / 日誌可透過 err.cause 追蹤原始 parse 失敗位置。
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

  // ===== CSV path（state machine 等價搬遷自 W1-048.8 F13）=====

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
   * @returns {Array} 解析後的 book 物件陣列
   * @throws {Error} PARSE_ERROR：內容為空 / 缺必要欄位
   */
  _parseCSVContent (content) {
    const rows = this._parseCSVRows(content)
    if (rows.length === 0) {
      const error = new Error(MESSAGES.INVALID_CSV + '：內容為空')
      error.code = ErrorCodes.PARSE_ERROR
      error.details = { category: 'parsing' }
      throw error
    }
    const headerRow = rows[0]
    const fieldNames = headerRow.map(h => CSV_HEADER_TO_FIELD[h] || null)
    if (!fieldNames.includes('id') || !fieldNames.includes('title')) {
      const error = new Error(MESSAGES.INVALID_CSV + '：缺少必要欄位（id 或 書名）')
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
   * W1-048.8 重構（F13）：state 物件 + 兩個 helper（quoted / unquoted）分流，
   * 主迴圈單一 dispatch + EOF flush。
   *
   * @private
   * @returns {Array<Array<string>>}
   */
  _parseCSVRows (content) {
    const state = { rows: [], currentRow: [], currentField: '', inQuotes: false }
    let i = 0
    while (i < content.length) {
      i += state.inQuotes
        ? this._consumeQuotedChar(state, content, i)
        : this._consumeUnquotedChar(state, content, i)
    }
    this._flushPendingRow(state)
    return state.rows
  }

  /**
   * 處理引號狀態內的單一字元，回傳前進步數（1 或 2）。
   * @private
   */
  _consumeQuotedChar (state, content, i) {
    const ch = content[i]
    if (ch === '"') {
      if (content[i + 1] === '"') {
        state.currentField += '"'
        return 2
      }
      state.inQuotes = false
      return 1
    }
    state.currentField += ch
    return 1
  }

  /**
   * 處理非引號狀態的單一字元，回傳前進步數（1 或 2）。
   * @private
   */
  _consumeUnquotedChar (state, content, i) {
    const ch = content[i]
    if (ch === '"') {
      state.inQuotes = true
      return 1
    }
    if (ch === ',') {
      state.currentRow.push(state.currentField)
      state.currentField = ''
      return 1
    }
    if (ch === '\r' && content[i + 1] === '\n') {
      this._commitRow(state)
      return 2
    }
    if (ch === '\n' || ch === '\r') {
      this._commitRow(state)
      return 1
    }
    state.currentField += ch
    return 1
  }

  /**
   * 將當前 field/row 提交至 rows，並重置 currentRow / currentField。
   * @private
   */
  _commitRow (state) {
    state.currentRow.push(state.currentField)
    state.rows.push(state.currentRow)
    state.currentRow = []
    state.currentField = ''
  }

  /**
   * EOF 收尾：若有未提交的最後一個欄位 / 列（檔案可能不以換行結束），補入 rows。
   * @private
   */
  _flushPendingRow (state) {
    if (state.currentField !== '' || state.currentRow.length > 0) {
      state.currentRow.push(state.currentField)
      state.rows.push(state.currentRow)
    }
  }

  /**
   * 將單一 CSV 資料列依 fieldNames 對應映射回 book 物件。
   * @private
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
   * @private
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

  // ===== Book data processing（六線性分支 + 過濾 + INV-1）=====

  /**
   * 處理書籍資料：提取 → 過濾 → 大型資料集檢查 → INV-1 組裝
   *
   * 匯聚點：接收 _extractBooksFromData 的 ImportResult，僅對 books 區段做
   * 有效性過濾與大型資料集檢查；tagCategories / tags 原樣透傳不過濾
   * （tag 區段過濾不屬本模組職責，見 feature-spec §2.2）。
   *
   * @private
   * @returns {{ books: Array, tagCategories: Array, tags: Array }} ImportResult
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
   */
  _filterValidBooks (books) {
    return books.filter(book => this._isValidBook(book))
  }

  /**
   * 檢查大型資料集（超過閾值時 console.warn 提示）
   * @private
   */
  _checkLargeDataset (books) {
    if (books.length > this._largeDatasetThreshold) {
      // Logger 後備方案: UI Component 效能警告
      // 設計理念: 大資料集處理警告需要開發者和用戶立即可見
      // 後備機制: console.warn 提供效能問題的即時提醒
      // 使用場景: 超過 threshold 本書籍時的效能警告，提示未來優化需求
      // eslint-disable-next-line no-console
      console.warn('[WARNING] 大型資料集，建議分批處理(未來改善)')
    }
  }

  /**
   * 從資料中提取 v2 interchange 三區段（W1-047.2 / IMP-B）
   *
   * 6 線性分支路徑表（spec 對應）：
   * - CSV               頂層分流，不走版本偵測（F11 顯式化；CSV 自有 detectCsvFormatVersion）
   * - JSON-v1           detectFormatVersion='v1' → convertV1ToV2Data 三區段（spec §2.1 Rule 3/4）
   * - JSON-v2           detectFormatVersion='v2' → 取 data.books（spec §3.1 唯一合法形狀）
   * - JSON-MetadataWrap _isMetadataWrapFormat → 取 data.data + warn（spec 未定義，歷史相容）
   * - JSON-EmptyObject  {} → 空 ImportResult（v1 退化合理）
   * - JSON-Unrecognized → throw VALIDATION_ERROR（既有錯誤契約零回歸）
   *
   * INV-1：所有 return path 三欄位恆為陣列，throw path 不回傳。
   *
   * @private
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

    // 頂層分流 2：JSON — 走版本偵測（透過注入點）
    const version = this._detectFormatVersion(data)

    // JSON path A：v1 — converter 完整三區段（spec §2.1 Rule 3/4）
    if (version === 'v1') {
      const converted = this._convertV1ToV2Data(data)
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
      // 設計理念: spec 未定義的歷史相容形狀(IMP-A~B 演進中加入)，命中時應對開發者可見
      // 後備機制: console.warn 在無 Logger 環境提供相容路徑可觀測性
      // 使用場景: 用戶 export 含 {data: [...]} 結構檔案匯入時，標記非 SPEC-EXPORT-V2 形狀
      // eslint-disable-next-line no-console
      console.warn('[book-file-importer] 偵測到 metadata-wrap 形狀(非 SPEC-EXPORT-V2 定義)，走歷史相容路徑')
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
   *
   * 降級規則（feature-spec §2.3 / SPEC-EXPORT-V2 §2.3「必須為陣列，否則初始化為空陣列」）：
   * - 合法陣列：原樣回傳（保持參考）。
   * - 缺失（undefined / null）：回傳 []，不告警。
   * - 非陣列（物件 / 字串等）：回傳 []，console.warn 記錄欄位名與降級原因。
   * - data 本身非物件：先判型再讀屬性，安全回傳 []。
   *
   * @private
   */
  _extractTagSection (data, fieldName) {
    const candidate = (data && typeof data === 'object') ? data[fieldName] : undefined
    if (Array.isArray(candidate)) {
      return candidate
    }
    // 缺失不告警；值存在但型別錯誤才告警
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
   *
   * 用途：v1 路徑對 convertV1ToV2Data 輸出的防禦，使 INV-1 在所有路徑成立。
   * @private
   */
  _normalizeToArray (value) {
    return Array.isArray(value) ? value : []
  }

  /**
   * 檢查是否為 metadata-wrap 形狀（{data: [...]}）。
   * @private
   *
   * 歷史相容判定，非 SPEC-EXPORT-V2 形狀（W1-048.7 決策 A3）。
   */
  _isMetadataWrapFormat (data) {
    return data &&
           data.data &&
           Array.isArray(data.data)
  }

  // ===== Book validation =====

  /**
   * 驗證書籍資料是否有效
   * @private
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
   * 驗證必要欄位存在（W1-047.1：移除 cover 強制要求）
   * @private
   */
  _validateRequiredFields (book) {
    return Boolean(book.id) &&
           Boolean(book.title)
  }

  /**
   * 驗證欄位類型（W1-048.4.1：cover 為選填，容許 undefined）
   * @private
   */
  _validateFieldTypes (book) {
    return typeof book.id === 'string' &&
           typeof book.title === 'string' &&
           (typeof book.cover === 'string' || book.cover === undefined)
  }
}

// CommonJS / Chrome Extension bundle 雙模式匯出（對齊 importer.js / file-validator.js）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ContentParser }
}
