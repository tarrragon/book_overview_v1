/**
 * BookFileImporter - 檔案匯入流程 orchestrator
 *
 * 負責功能：
 * - 協調 validate → read → parse 三階段匯入流程
 * - 透過 DI 注入 FileValidator / FileContentReader / ContentParser
 * - 4 個 public method 為 thin wrapper，僅負責 delegate 至 helper class
 *
 * Stage B 重構（W1-048.10.1.4）：
 * - 移除 4 個底線方法：_validateFileBasics / _validateFileSize / _readFileWithReader / _handleFileContent
 * - 移除 ~17 個 CSV/JSON/書籍處理子 helper（已搬遷至 ContentParser）
 * - 移除 _isJSONFile（FileValidator.detectFormat 涵蓋）
 * - 4 個 public method（handleFileLoad / validate / read / parseContent）改 thin wrapper
 * - 保留 W1-048.10.1.5 系列加入的 public API（isCSVFile / extractBooksFromData /
 *   processBookData / validateRequiredFields / filterValidBooks）作 thin wrapper
 *   delegate 至 helper class（部分仍存取 ContentParser 內部方法以避免修改 helper class）
 *
 * 設計考量：
 * - production 路徑零變更：未注入時自建預設 helper 實例
 * - 行為等價契約由 helper class 落地時驗證（FileValidator/FileContentReader/ContentParser
 *   各自的 ticket 10.1.1 / 10.1.3 / 10.1.2 已確認與既有底線方法等價）
 *
 * 回傳介面（W1-047.2 / IMP-B）：
 * @typedef {Object} ImportResult
 * @property {Array<Object>} books          - 書籍陣列，必有，可能為空陣列
 * @property {Array<Object>} tagCategories  - tag 分類陣列，必有，可能為空陣列
 * @property {Array<Object>} tags           - tag 陣列，必有，可能為空陣列
 *
 * 不變式 INV-1：ImportResult 三欄位永遠存在且型別恆為陣列，
 * 任何路徑（v1 / v2 / CSV / 空物件）不得回傳 undefined / null。
 * 消費端可無條件解構，無需 null 檢查。
 */

const { FileValidator } = require('src/overview/import/file-validator')
const { FileContentReader } = require('src/overview/import/file-reader')
const { ContentParser } = require('src/overview/import/content-parser')

class BookFileImporter {
  /**
   * 建構 BookFileImporter
   *
   * Helper DI 注入點（Stage A 加入，Stage B 啟用）：
   * - validator：FileValidator 實例，提供 validate / detectFormat
   * - reader：FileContentReader 實例，提供 read(file) → Promise<ImportResult>
   * - parser：ContentParser 實例，提供 parse(content, fileFormat) → ImportResult
   *
   * 注入順序關鍵：parser 先於 reader（reader 預設依賴 parser）。
   * 預設情境（production）零變更：未注入時自建 helper 實例，
   * 行為與既有底線方法完全等價。
   *
   * @param {Object} deps - 依賴注入
   * @param {Document} deps.document - DOM 文檔物件
   * @param {Function} deps.showError - 顯示錯誤訊息的回呼函式
   * @param {Object} [deps.validator] - 選用，FileValidator 實例（測試注入 stub）
   * @param {Object} [deps.reader] - 選用，FileContentReader 實例（測試注入 stub）
   * @param {Object} [deps.parser] - 選用，ContentParser 實例（測試注入 stub）
   */
  constructor ({ document, showError, validator, reader, parser } = {}) {
    this.document = document
    this.showError = showError

    // Helper DI（順序：parser → validator → reader，reader 預設依賴 parser）
    this.parser = parser || new ContentParser()
    this.validator = validator || new FileValidator({ showError })
    this.reader = reader || new FileContentReader({
      parser: this.parser,
      showError,
      detectFormat: (file) => this.validator.detectFormat(file)
    })
  }

  /**
   * 處理檔案載入操作（thin wrapper：validate → read 序列）
   *
   * @param {File} file - 要載入的檔案
   * @returns {Promise<ImportResult>} 含 books / tagCategories / tags 三區段的匯入結果
   */
  async handleFileLoad (file) {
    this.validator.validate(file)
    return this.reader.read(file)
  }

  /**
   * 驗證檔案是否符合匯入前置條件（thin wrapper）
   *
   * @param {File} file - 要驗證的檔案
   * @throws {Error} VALIDATION_ERROR：失敗時已呼叫 showError，caller 應中止流程
   */
  validate (file) {
    this.validator.validate(file)
  }

  /**
   * 從已驗證的 file 讀取內容、解析、提取 ImportResult（thin wrapper）
   *
   * 前置：file 已通過 validate（caller 責任；read 不重複驗證）。
   *
   * @param {File} file - 要讀取的檔案（須已通過 validate）
   * @returns {Promise<ImportResult>} 含 books / tagCategories / tags 三區段的匯入結果
   */
  read (file) {
    return this.reader.read(file)
  }

  /**
   * 將字串內容解析為 ImportResult（thin wrapper）
   *
   * fileFormat 必填檢查與 PARSE_ERROR 拋出邏輯由 ContentParser.parse 內部處理（10.1.2 落地）。
   *
   * @param {string} content - 檔案內容字串
   * @param {string} fileFormat - 'json' 或 'csv'（必填，無預設值）
   * @returns {ImportResult} 含 books / tagCategories / tags 三區段的匯入結果
   * @throws {TypeError} fileFormat 缺漏（undefined / null）時拋出
   * @throws {Error} fileFormat 非 'json' / 'csv' 時拋出 PARSE_ERROR；解析失敗時拋出對應 error
   */
  parseContent (content, fileFormat) {
    return this.parser.parse(content, fileFormat)
  }

  // ===== W1-048.10.1.5 系列保留的 public API（thin wrapper / delegate）=====

  /**
   * 檢查是否為 CSV 檔案（W6-012.6.2 / W1-048.10.1.5.1）
   *
   * Public API（Stage B 改寫為 delegate validator.detectFormat）：
   * - 內部委派 FileValidator.detectFormat，回傳 'csv' 即為 true
   * - 與 W1-048.10.1.5.1 設計等價（單一格式判定 SSOT）
   *
   * @param {File} file - 要檢查的檔案
   * @returns {boolean} 是否為 CSV 檔案
   */
  isCSVFile (file) {
    return this.validator.detectFormat(file) === 'csv'
  }

  /**
   * 從解析後的資料中提取 v2 interchange 三區段（W1-048.10.1.5.2）
   *
   * Public API（Stage B 改寫為 delegate parser 內部方法）：
   * - 委派 ContentParser._extractBooksFromData，保留 6 線性分支路徑與錯誤契約不變
   * - 採跨類別存取內部方法的設計，原因：本 ticket 範圍禁編輯 helper class，
   *   ContentParser 尚未提供對等 public API；未來如有需求可再拆 follow-up ticket
   *   將 ContentParser 內部方法升為 public 並修正本處 delegate
   *
   * 前置：資料已通過解析（CSV 為 book 物件陣列；JSON 為解析後物件 / 陣列）。
   *
   * @param {any} data - 解析後的 JSON 資料 / CSV 解析結果
   * @param {string} [fileFormat='json'] - 'csv' | 'json'，csv 走頂層 bypass
   * @returns {ImportResult} 含 books / tagCategories / tags 三區段的提取結果
   * @throws {Error} JSON 無法辨識結構時拋出 VALIDATION_ERROR（既有錯誤契約）
   */
  extractBooksFromData (data, fileFormat = 'json') {
    return this.parser._extractBooksFromData(data, fileFormat)
  }

  /**
   * 處理書籍資料：提取三區段 + 過濾無效 books + 大資料集檢查（W1-048.10.1.5.2）
   *
   * Public API（Stage B 改寫為 delegate parser 內部方法）：
   * - 委派 ContentParser._processBookData，保留原有實作與過濾鏈不變
   * - 同 extractBooksFromData：跨類別存取內部方法為本 ticket 範圍折衷
   *
   * @param {any} data - 解析後的 JSON 資料 / CSV 解析結果
   * @param {string} [fileFormat='json'] - 'csv' | 'json'，傳遞給版本偵測閘門
   * @returns {ImportResult} 含過濾後 books 與透傳 tagCategories / tags 的匯入結果
   */
  processBookData (data, fileFormat = 'json') {
    return this.parser._processBookData(data, fileFormat)
  }

  /**
   * 驗證書籍必要欄位（id 與 title）是否存在（W1-048.10.1.5.3）
   *
   * Public API（Stage B 改寫為 delegate parser 內部方法）：
   * - 委派 ContentParser._validateRequiredFields
   * - 驗證規則（W1-047.1）：僅檢查 id 與 title（cover 為選填，SPEC-EXPORT-V2 §3.5）
   *
   * @param {Object} book - 書籍物件
   * @returns {boolean} 必要欄位齊備時為 true，否則為 false
   */
  validateRequiredFields (book) {
    return this.parser._validateRequiredFields(book)
  }

  /**
   * 過濾出陣列中所有有效的書籍（W1-048.10.1.5.3）
   *
   * Public API（Stage B 改寫為 delegate parser 內部方法）：
   * - 委派 ContentParser._filterValidBooks（內部使用 _isValidBook 三段檢查鏈）
   *
   * @param {Array<Object>} books - 書籍陣列
   * @returns {Array<Object>} 通過所有驗證的書籍陣列
   */
  filterValidBooks (books) {
    return this.parser._filterValidBooks(books)
  }
}

// Node.js 環境：CommonJS 匯出（保留雙模式相容，對齊 helper class 設計）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BookFileImporter }
}
