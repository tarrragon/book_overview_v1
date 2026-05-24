/**
 * FileContentReader - 檔案讀取 helper class
 *
 * 對應 ticket: 0.19.0-W1-048.10.1.3（W1-048.10.1 SOLID 拆分第 3 個 sub-IMP）
 *
 * 負責功能：
 * - 包裹 FileReader DOM API（onload / onerror 事件處理）
 * - 協調 detectFormat + parser 完成「file → ImportResult」鏈
 * - 隔離 IO 邊界，純函式 ContentParser 由 deps.parser 注入
 *
 * 設計考量：
 * - class 名為 FileContentReader 避免遮蔽 DOM globalThis.FileReader
 * - 透過 dependency injection 接收 parser（必填）/ showError / readerFactory / detectFormat
 * - readerFactory 預設 () => new globalThis.FileReader()，測試注入 FakeFileReader
 * - detectFormat 預設用副檔名 / MIME 內建判定（與 FileValidator.detectFormat 等價）
 * - 例外契約：
 *   * parser 缺漏 → TypeError（constructor）
 *   * FileReader.onerror → UNKNOWN_ERROR / category=general（reject）
 *   * parser.parse throw → 原 error 透傳（reject，保留 code / details）
 *   * 失敗時若 showError 注入則先呼叫再 reject
 *
 * 等價契約來源：src/overview/book-file-importer.js L208-312（_readFileWithReader 鏈）
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

const ERROR_MSG_READ_FAILED = '讀取檔案時發生錯誤'
const ERROR_MSG_LOAD_FAILED_PREFIX = '載入檔案失敗：'

class FileContentReader {
  /**
   * 建構 FileContentReader
   *
   * @param {Object} deps - 依賴注入
   * @param {Object} deps.parser - 必填，介面：parser.parse(content, fileFormat) → ImportResult
   * @param {Function} [deps.showError] - 選用，錯誤訊息回呼
   * @param {Function} [deps.readerFactory] - 選用，回傳 FileReader 實例的工廠
   *                                          預設 () => new globalThis.FileReader()
   * @param {Function} [deps.detectFormat] - 選用，回傳 'json'|'csv'|null 的格式偵測函式
   *                                         預設用副檔名 + MIME 內建判定
   * @throws {TypeError} parser 缺漏（undefined / null）時拋出
   */
  constructor (deps) {
    const d = deps || {}
    if (!d.parser) {
      throw new TypeError('FileContentReader: parser is required')
    }
    this._parser = d.parser
    this._showError = typeof d.showError === 'function' ? d.showError : null
    this._readerFactory = typeof d.readerFactory === 'function'
      ? d.readerFactory
      : () => new globalThis.FileReader()
    this._detectFormat = typeof d.detectFormat === 'function'
      ? d.detectFormat
      : (file) => this._defaultDetectFormat(file)
  }

  /**
   * 讀取檔案內容並解析為 ImportResult
   *
   * 行為鏈：
   * 1. detectFormat(file) → fileFormat（fallback 'json' 若回傳 null/undefined）
   * 2. readerFactory() → reader 實例
   * 3. 註冊 onload / onerror handlers
   * 4. reader.readAsText(file, 'utf-8')
   * 5. onload 觸發 → parser.parse(content, fileFormat) → resolve
   * 6. onerror 觸發 → showError + reject(UNKNOWN_ERROR)
   * 7. parser.parse throw → showError + reject(原 error)
   *
   * @param {File} file - 要讀取的檔案
   * @returns {Promise<Object>} 含 books / tagCategories / tags 三區段的 ImportResult
   */
  read (file) {
    const fileFormat = this._detectFormat(file) || 'json'
    return new Promise((resolve, reject) => {
      const reader = this._readerFactory()
      reader.onload = (e) => this._handleSuccess(e, resolve, reject, fileFormat)
      reader.onerror = () => this._handleError(reject)
      reader.readAsText(file, 'utf-8')
    })
  }

  /**
   * 處理 FileReader 成功事件
   * @private
   *
   * 嘗試 parser.parse，成功時 resolve 結果；失敗時 showError + reject 原 error。
   * 透傳 parser 拋出的 error（保留 code / details / message），符合既有 importer 契約。
   *
   * @param {Event} e - load 事件物件，e.target.result 為讀取內容
   * @param {Function} resolve - Promise resolve
   * @param {Function} reject - Promise reject
   * @param {string} fileFormat - 'json' | 'csv'
   */
  _handleSuccess (e, resolve, reject, fileFormat) {
    try {
      const result = this._parser.parse(e.target.result, fileFormat)
      resolve(result)
    } catch (error) {
      this._notify(`${ERROR_MSG_LOAD_FAILED_PREFIX}${error.message}`)
      reject(error)
    }
  }

  /**
   * 處理 FileReader 錯誤事件
   * @private
   *
   * 建立 UNKNOWN_ERROR Error 物件並 reject，先呼叫 showError 通知用戶。
   *
   * @param {Function} reject - Promise reject
   */
  _handleError (reject) {
    this._notify(ERROR_MSG_READ_FAILED)
    const error = new Error(ERROR_MSG_READ_FAILED)
    error.code = ErrorCodes.UNKNOWN_ERROR
    error.details = { category: 'general' }
    reject(error)
  }

  /**
   * 呼叫 showError callback（若存在）
   * @private
   * @param {string} message - 錯誤訊息
   */
  _notify (message) {
    if (this._showError) {
      this._showError(message)
    }
  }

  /**
   * 內建格式偵測 fallback（無 deps.detectFormat 時使用）
   * @private
   *
   * 判定規則（與 FileValidator.detectFormat 等價）：
   * - .json 副檔名 OR application/json MIME → 'json'
   * - .csv 副檔名 OR text/csv 開頭 MIME → 'csv'
   * - 無法辨識 → null（caller 端 fallback 為 'json'）
   *
   * @param {File} file - 要偵測的檔案
   * @returns {'json'|'csv'|null}
   */
  _defaultDetectFormat (file) {
    if (!file || typeof file.name !== 'string') {
      return null
    }
    const lowerName = file.name.toLowerCase()
    const lowerType = typeof file.type === 'string' ? file.type.toLowerCase() : ''
    if (lowerName.endsWith('.csv') || lowerType.startsWith('text/csv')) {
      return 'csv'
    }
    if (lowerName.endsWith('.json') || lowerType === 'application/json') {
      return 'json'
    }
    return null
  }
}

// CommonJS / Chrome Extension bundle 雙模式匯出（對齊 importer.js / file-validator.js / content-parser.js）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FileContentReader }
}
