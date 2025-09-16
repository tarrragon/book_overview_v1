/**
 * 標準錯誤類別
 *
 * 設計目標：
 * - 統一錯誤格式，支援序列化和JSON轉換
 * - 記憶體使用 < 1KB per error
 * - 處理時間 < 1ms
 * - 支援 Chrome Extension 環境
 *
 * @example
 * const error = new StandardError('VALIDATION_FAILED', '資料驗證失敗', { field: 'email' })
 * console.log(error.toJSON()) // 可序列化的錯誤物件
 */

class StandardError extends Error {
  /**
   * 建立標準錯誤物件
   * @param {string} code - 錯誤代碼
   * @param {string} message - 錯誤訊息
   * @param {Object} details - 附加資訊
   */
  constructor (code, message, details = {}) {
    // 讓原生 Error 處理 message 和 stack trace
    super(message || 'Unknown error')

    // 設定錯誤名稱
    this.name = 'StandardError'

    // 處理空值和無效參數
    this.code = code || 'UNKNOWN_ERROR'

    // 處理 details 參數
    if (details === null || details === undefined) {
      this.details = {}
    } else if (typeof details === 'object') {
      // 處理循環參照問題 - 創建安全的複製
      this.details = this._safeClone(details)
    } else {
      // 非物件類型轉換為物件
      this.details = { value: details }
    }

    try {
      this.timestamp = Date.now()
    } catch (error) {
      this.timestamp = 0 // 後備時間戳
    }
    this.id = this._generateId()

    // 確保 stack trace 正確設定 (針對不同 JavaScript 引擎)
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
      // 後備ID生成機制
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
   * 轉換為 JSON 格式（用於傳輸和儲存）
   * 限制序列化後大小 < 15KB
   * @returns {Object} JSON 可序列化的物件
   */
  toJSON () {
    const json = {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      id: this.id,
      stack: this.stack // 包含原生 stack trace
    }

    try {
      // 檢查序列化大小，使用循環參照處理
      const jsonString = JSON.stringify(json, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          const seen = new Set()
          const checkCircular = (val) => {
            if (seen.has(val)) {
              return '[Circular Reference]'
            }
            seen.add(val)
            return val
          }
          return checkCircular(value)
        }
        return value
      })

      if (jsonString.length > 15 * 1024) { // 15KB 限制
        // 簡化 details 以符合大小限制
        json.details = {
          ...this.details,
          _truncated: true,
          _originalSize: jsonString.length
        }

        // 移除過大的屬性
        for (const key in json.details) {
          if (typeof json.details[key] === 'string' && json.details[key].length > 1000) {
            json.details[key] = json.details[key].substring(0, 1000) + '... [truncated]'
          }
        }
      }
    } catch (error) {
      // 如果序列化失敗，回退到安全處理
      json.details = this._handleCircularReferences(this.details)
    }

    return json
  }

  /**
   * 從 JSON 建立錯誤物件
   * @param {Object} json - JSON 物件
   * @returns {StandardError} 錯誤物件實例
   */
  static fromJSON (json) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      const details = {
        receivedType: typeof json
      }
      // 只有非 undefined 值才加入 receivedValue
      if (json !== undefined) {
        details.receivedValue = json
      }
      throw new StandardError('INVALID_JSON_DATA', 'Invalid JSON data for StandardError.fromJSON', details)
    }

    const error = new StandardError(json.code, json.message, json.details)

    // 恢復原始的 timestamp, id 和 stack
    if (json.timestamp) {
      error.timestamp = json.timestamp
    }
    if (json.id) {
      error.id = json.id
    }
    if (json.stack) {
      error.stack = json.stack
    }
    if (json.name) {
      error.name = json.name
    }

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

// 匯出 StandardError 類別
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StandardError }
} else if (typeof window !== 'undefined') {
  window.StandardError = StandardError
}
