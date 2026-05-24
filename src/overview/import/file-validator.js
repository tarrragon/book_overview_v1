/**
 * FileValidator - 檔案驗證 helper class
 *
 * 對應 ticket: 0.19.0-W1-048.10.1.1（W1-048.10.1 SOLID 拆分第 1 個 sub-IMP）
 *
 * 負責功能：
 * - 純函式驗證（檔案存在性、格式、大小），無 IO、無 state
 * - 封裝 BookFileImporter._validateFileBasics + _validateFileSize +
 *   _isJSONFile + _isCSVFile 的等價邏輯
 *
 * 設計考量：
 * - 透過 dependency injection 接收 showError callback 與 maxFileSize 上限
 * - showError 為選用（缺漏時不引發二次錯誤），maxFileSize 預設 10MB
 * - 例外契約與既有 importer 等價：throw Error with code=VALIDATION_ERROR,
 *   details.category='validation'；失敗時若 showError 存在則先呼叫再 throw
 *
 * 等價契約來源：src/overview/book-file-importer.js L146-206（W1-048.1 落地版本）
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

class FileValidator {
  /**
   * 建構 FileValidator
   *
   * @param {Object} [deps] - 依賴注入
   * @param {Function} [deps.showError] - 選用，錯誤訊息回呼（行為等價於既有 importer）
   * @param {number} [deps.maxFileSize=10485760] - 選用，最大檔案大小（bytes），預設 10MB
   */
  constructor (deps = {}) {
    this._showError = typeof deps.showError === 'function' ? deps.showError : null
    this._maxFileSize = typeof deps.maxFileSize === 'number' ? deps.maxFileSize : DEFAULT_MAX_FILE_SIZE
  }

  /**
   * 驗證檔案存在性、格式與大小
   *
   * 前置鏈短路：file 存在 → 格式合法（json/csv）→ 大小不超過 maxFileSize。
   * 任一階段失敗即拋出 VALIDATION_ERROR，並先呼叫 showError（若有注入）。
   *
   * @param {File} file - 要驗證的檔案
   * @returns {void}
   * @throws {Error} code=VALIDATION_ERROR, details.category='validation'
   */
  validate (file) {
    if (!file) {
      this._notify('請先選擇一個 JSON 或 CSV 檔案！')
      throw this._buildValidationError('檔案不存在')
    }

    const format = this.detectFormat(file)
    if (format === null) {
      this._notify('請選擇 JSON 或 CSV 格式的檔案！')
      throw this._buildValidationError('檔案格式不正確')
    }

    if (typeof file.size === 'number' && file.size > this._maxFileSize) {
      this._notify('檔案過大，請選擇小於 10MB 的檔案！')
      throw this._buildValidationError('檔案大小超出限制')
    }
  }

  /**
   * 偵測檔案格式（純函式，不會 throw）
   *
   * 判定規則（與 _isJSONFile / _isCSVFile 等價）：
   * - .json 副檔名 OR application/json MIME → 'json'
   * - .csv 副檔名 OR text/csv 開頭 MIME（含 charset 變體）→ 'csv'
   * - null/undefined 或非 File 物件 → null
   *
   * @param {File} file - 要偵測的檔案
   * @returns {'json'|'csv'|null} 無法辨識時回傳 null
   */
  detectFormat (file) {
    if (!file || typeof file.name !== 'string') {
      return null
    }
    const lowerName = file.name.toLowerCase()
    const lowerType = typeof file.type === 'string' ? file.type.toLowerCase() : ''

    const isJSON = lowerName.endsWith('.json') || lowerType === 'application/json'
    if (isJSON) {
      return 'json'
    }

    const isCSV = lowerName.endsWith('.csv') || lowerType.startsWith('text/csv')
    if (isCSV) {
      return 'csv'
    }

    return null
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
   * 建立 VALIDATION_ERROR Error 物件（與既有 importer 等價）
   * @private
   * @param {string} message - 錯誤訊息
   * @returns {Error}
   */
  _buildValidationError (message) {
    const error = new Error(message)
    error.code = ErrorCodes.VALIDATION_ERROR
    error.details = { category: 'validation' }
    return error
  }
}

// CommonJS / Chrome Extension bundle 雙模式匯出（對齊 importer.js L825-828）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FileValidator }
}
