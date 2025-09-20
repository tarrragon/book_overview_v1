/**
 * 統一操作結果格式
 *
 * 設計目標：
 * - 標準化成功/失敗回應格式，取代字串比對測試
 * - 處理時間 < 0.5ms
 * - 支援序列化以便於 Chrome Extension 跨環境傳遞
 * - 提供結構化驗證方法
 *
 * @example
 * // 成功結果
 * const result = OperationResult.success({ books: [] })
 * if (result.success) { console.log(result.data) }
 *
 * // 失敗結果
 * const error = new Error('驗證失敗')
 * error.code = ErrorCodes.VALIDATION_ERROR
 * const result = OperationResult.failure(error)
 * if (!result.success) { console.log(result.error.message) }
 */

// 使用 CommonJS 匯入
const { ErrorCodes } = require('./ErrorCodes')

// OperationStatus 枚舉定義
const OperationStatus = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PENDING: 'PENDING',
  CANCELLED: 'CANCELLED'
}

class OperationResult {
  /**
   * 建立操作結果物件
   * @param {boolean} success - 操作是否成功
   * @param {any} data - 成功時的資料
   * @param {Error} error - 失敗時的錯誤物件
   * @param {string} status - 操作狀態 (使用 OperationStatus 枚舉)
   * @param {Object} metadata - 附加元數據
   */
  constructor (success, data = null, error = null, status = null, metadata = {}) {
    this.success = success
    this.data = data
    this.error = error
    this.status = status || (success ? OperationStatus?.SUCCESS || 'SUCCESS' : OperationStatus?.FAILED || 'FAILED')
    this.metadata = {
      timestamp: Date.now(),
      requestId: this._generateRequestId(),
      version: '1.0.0',
      ...metadata
    }
    // 保持向後相容性
    this.timestamp = this.metadata.timestamp
  }

  /**
   * 生成請求 ID
   * @private
   * @returns {string} 唯一請求 ID
   */
  _generateRequestId () {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  /**
   * 建立成功結果的快速方法
   * @param {any} data - 成功的資料
   * @returns {OperationResult} 成功結果物件
   */
  static success (data = null) {
    return new OperationResult(true, data, null)
  }

  /**
   * 建立失敗結果的快速方法
   * @param {Error} error - 錯誤物件
   * @returns {OperationResult} 失敗結果物件
   */
  static failure (error) {
    // 確保錯誤是標準格式
    let standardError

    if (error?.code && Object.values(ErrorCodes).includes(error.code)) {
      standardError = error
    } else if (error instanceof Error) {
      // 將普通 JavaScript Error 轉換為 ErrorCodes 格式
      standardError = new Error(error.message || 'Unknown error')
      standardError.code = ErrorCodes.UNKNOWN_ERROR
      standardError.details = {
        originalError: error.toString(),
        stack: error.stack
      }
    } else if (typeof error === 'string') {
      // 字串錯誤轉換為 ErrorCodes 格式
      standardError = new Error(error)
      standardError.code = ErrorCodes.UNKNOWN_ERROR
      standardError.details = {}
    } else {
      // 其他類型轉換為 ErrorCodes 格式
      standardError = new Error('Unknown error occurred')
      standardError.code = ErrorCodes.UNKNOWN_ERROR
      standardError.details = { originalError: error }
    }

    return new OperationResult(false, null, standardError)
  }

  /**
   * 如果失敗則拋出異常（用於必須成功的場景）
   * @throws {Error} 當結果為失敗時拋出異常
   * @returns {any} 成功時的資料
   */
  throwIfFailure () {
    if (!this.success && this.error) {
      // 使用 ErrorCodes 格式重新拋出，保留原始錯誤資訊
      const error = new Error(this.error.message || 'Operation failed')
      error.code = this.error.code || ErrorCodes.OPERATION_ERROR
      error.details = this.error.details || {}
      throw error
    }
    return this.data
  }

  /**
   * 轉換為 JSON 格式（符合規劃文件的統一回應格式）
   * @returns {Object} JSON 可序列化的物件
   */
  toJSON () {
    return {
      success: this.success,
      data: this.data,
      error: this.error ? this.error.toJSON() : null,
      status: this.status,
      metadata: this.metadata
    }
  }

  /**
   * 從 JSON 建立 OperationResult 物件
   * @param {Object} json - JSON 物件
   * @returns {OperationResult} OperationResult 實例
   */
  static fromJSON (json) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      // 創建錯誤物件
      const error = new Error('Invalid JSON data for OperationResult.fromJSON')
      error.code = ErrorCodes.PARSE_ERROR
      error.details = {
        receivedType: Array.isArray(json) ? 'array' : typeof json,
        receivedValue: json
      }
      throw error
    }

    let error = null
    if (json.error) {
      // 直接使用 ErrorCodes 創建錯誤
      error = (() => {
        const err = new Error(json.error.message || 'Unknown error')
        err.code = json.error.code || ErrorCodes.UNKNOWN_ERROR
        err.details = json.error.details || {}
        return err
      })()
    }

    const result = new OperationResult(
      json.success,
      json.data,
      error,
      json.status,
      json.metadata || {}
    )

    // 向後相容性：支援舊格式的 timestamp
    if (json.timestamp && !json.metadata?.timestamp) {
      result.metadata.timestamp = json.timestamp
      result.timestamp = json.timestamp
    }

    return result
  }

  /**
   * 將操作結果轉換為 v1 相容格式
   * @returns {Object} v1 相容格式的結果物件
   */
  toV1Format () {
    if (this.success) {
      return {
        success: true,
        data: this.data
      }
    } else {
      return {
        success: false,
        error: this.error ? this.error.message : 'Unknown error',
        code: this.error ? this.error.code : 'UNKNOWN_ERROR',
        details: this.error ? this.error.details : {}
      }
    }
  }

  /**
   * 轉換為字串表示
   * @returns {string} 結果的字串表示
   */
  toString () {
    if (this.success) {
      return `OperationResult: Success (${this.data ? 'with data' : 'no data'})`
    } else {
      return `OperationResult: Failure - ${this.error ? this.error.toString() : 'Unknown error'}`
    }
  }
}

// 匯出 OperationResult 類別 (統一使用 CommonJS 格式)
module.exports = { OperationResult }
