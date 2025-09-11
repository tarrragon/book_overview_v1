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

class StandardError {
  /**
   * 建立標準錯誤物件
   * @param {string} code - 錯誤代碼
   * @param {string} message - 錯誤訊息
   * @param {Object} details - 附加資訊
   */
  constructor (code, message, details = {}) {
    // 處理空值和無效參數
    this.code = code || 'UNKNOWN_ERROR'
    this.message = message || 'Unknown error'

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

    this.timestamp = Date.now()
    this.id = this._generateId()
  }

  /**
   * 生成唯一識別碼
   * @private
   * @returns {string} 唯一識別碼
   */
  _generateId () {
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2, 11)
    return `err_${timestamp}_${random}`
  }

  /**
   * 安全複製物件，簡化版本
   * @private
   * @param {Object} obj - 要複製的物件
   * @returns {Object} 安全的物件複製
   */
  _safeClone (obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }

    try {
      return JSON.parse(JSON.stringify(obj))
    } catch (error) {
      return '[Serialization Error]'
    }
  }

  /**
   * 轉換為 JSON 格式（用於傳輸和儲存）
   * 限制序列化後大小 < 15KB
   * @returns {Object} JSON 可序列化的物件
   */
  toJSON () {
    const json = {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      id: this.id
    }

    // 檢查序列化大小
    const jsonString = JSON.stringify(json)
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

    return json
  }

  /**
   * 從 JSON 建立錯誤物件
   * @param {Object} json - JSON 物件
   * @returns {StandardError} 錯誤物件實例
   */
  static fromJSON (json) {
    if (!json || typeof json !== 'object') {
      throw new StandardError('INVALID_JSON_DATA', 'Invalid JSON data for StandardError.fromJSON', { 
        receivedType: typeof json, 
        receivedValue: json 
      })
    }

    const error = new StandardError(json.code, json.message, json.details)

    // 恢復原始的 timestamp 和 id
    if (json.timestamp) {
      error.timestamp = json.timestamp
    }
    if (json.id) {
      error.id = json.id
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
