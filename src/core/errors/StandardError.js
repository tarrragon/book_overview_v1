/**
 * @deprecated v1.0.0 移除 - 請使用 ErrorCodes + 原生 Error 替代
 *
 * StandardError 向後相容模組
 *
 * 原始 StandardError 已遷移至 ErrorCodes 系統，
 * 此檔案提供向後相容的 StandardError 類別，
 * 確保現有程式碼和測試能正常運作。
 *
 * 遷移指引：
 *   const error = new Error(message)
 *   error.code = ErrorCodes.VALIDATION_ERROR
 *   throw error
 *
 * @see src/core/errors/ErrorCodes.js
 */

class StandardError extends Error {
  /**
   * 建立標準錯誤物件
   * @param {string} code - 錯誤代碼
   * @param {string} message - 錯誤訊息
   * @param {Object} details - 附加資訊
   */
  constructor (code, message, details = {}) {
    super(message || 'Unknown error')

    this.name = 'StandardError'
    this.code = code || 'UNKNOWN_ERROR'

    if (details === null || details === undefined) {
      this.details = {}
    } else if (typeof details === 'object') {
      this.details = this._safeClone(details)
    } else {
      this.details = { value: details }
    }

    try {
      this.timestamp = Date.now()
    } catch (error) {
      this.timestamp = 0
    }
    this.id = this._generateId()

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StandardError)
    }
  }

  /**
   * 生成唯一識別碼
   * @private
   * @returns {string} 唯一識別碼
   */
  _generateId () {
    try {
      const timestamp = Date.now()
      const random = Math.random().toString(36).slice(2, 11)
      return `err_${timestamp}_${random}`
    } catch (error) {
      const random = Math.random().toString(36).slice(2, 11)
      return `err_fallback_${random}`
    }
  }

  /**
   * 安全複製物件，處理循環參照
   * @private
   * @param {Object} obj - 要複製的物件
   * @returns {Object} 安全的物件複製
   */
  _safeClone (obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }
    return this._handleCircularReferences(obj)
  }

  /**
   * 手動處理循環參照
   * @private
   * @param {Object} obj - 原始物件
   * @returns {Object} 處理後的物件
   */
  _handleCircularReferences (obj) {
    const seen = new WeakMap()
    const deepClone = (source) => {
      if (source === null || typeof source !== 'object') {
        return source
      }
      if (seen.has(source)) {
        return '[Circular Reference]'
      }
      const result = Array.isArray(source) ? [] : {}
      seen.set(source, result)
      for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          result[key] = deepClone(source[key])
        }
      }
      return result
    }
    return deepClone(obj)
  }

  /**
   * 轉換為 JSON 格式
   * @returns {Object} JSON 可序列化的物件
   */
  toJSON () {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      id: this.id,
      stack: this.stack
    }
  }

  /**
   * 從 JSON 建立錯誤物件
   * @param {Object} json - JSON 物件
   * @returns {StandardError} 錯誤物件實例
   */
  static fromJSON (json) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      const details = { receivedType: typeof json }
      if (json !== undefined) {
        details.receivedValue = json
      }
      const error = new Error('Invalid JSON data for StandardError.fromJSON')
      error.code = 'INVALID_JSON_DATA'
      error.details = details
      throw error
    }

    // eslint-disable-next-line no-restricted-syntax -- fromJSON 是棄用類別自身的靜態方法，必須使用自己的建構式
    const error = new StandardError(json.code, json.message, json.details)
    if (json.timestamp) error.timestamp = json.timestamp
    if (json.id) error.id = json.id
    if (json.stack) error.stack = json.stack
    if (json.name) error.name = json.name
    return error
  }

  /**
   * 轉換為字串表示
   * @returns {string} 錯誤的字串表示
   */
  toString () {
    return `StandardError [${this.code}]: ${this.message}`
  }
}

module.exports = { StandardError }
