/**
 * 錯誤處理輔助函數
 *
 * 設計目標：
 * - 提供便利的錯誤建立方法，簡化常見錯誤處理
 * - 包裝既有的 try-catch 結構，支援同步和非同步操作
 * - 與 StandardError 和 OperationResult 整合
 * - 支援現有程式碼的漸進式遷移
 *
 * @example
 * // 快速建立特定類型錯誤
 * const error = ErrorHelper.createNetworkError('連線失敗', { url: 'https://example.com' })
 *
 * // 包裝既有操作
 * const result = await ErrorHelper.tryOperation(async () => {
 *   return await fetchData()
 * }, 'FETCH_DATA_FAILED')
 */

import { ErrorCodes } from './ErrorCodes.js'
import { OperationResult } from './OperationResult.js'

class ErrorHelper {
  /**
   * 建立通用標準錯誤
   * @param {string} code - 錯誤代碼
   * @param {string} message - 錯誤訊息
   * @param {Object} details - 附加資訊
   * @returns {StandardError} 標準錯誤物件
   */
  static createError (code, message, details = {}) {
    const error = new Error(message || 'Unknown error')
    error.code = ErrorCodes.UNKNOWN_ERROR
    error.details = { ...details, originalCode: code }
    return error
  }

  /**
   * 建立網路錯誤
   * @param {string} message - 錯誤訊息
   * @param {Object} details - 附加資訊（如 URL、狀態碼等）
   * @returns {StandardError} 網路錯誤物件
   */
  static createNetworkError (message, details = {}) {
    const error = new Error(message || 'Network operation failed')
    error.code = ErrorCodes.NETWORK_ERROR
    error.details = { type: 'network', ...details }
    return error
  }

  /**
   * 建立驗證錯誤
   * @param {string} field - 驗證失敗的欄位
   * @param {string} message - 錯誤訊息
   * @param {Object} details - 附加資訊（如驗證規則、實際值等）
   * @returns {StandardError} 驗證錯誤物件
   */
  static createValidationError (field, message, details = {}) {
    const error = new Error(message || 'Validation failed')
    error.code = ErrorCodes.VALIDATION_FAILED
    error.details = { field, type: 'validation', ...details }
    return error
  }

  /**
   * 建立儲存錯誤
   * @param {string} operation - 儲存操作類型（如 'save', 'load', 'delete'）
   * @param {string} message - 錯誤訊息
   * @param {Object} details - 附加資訊
   * @returns {StandardError} 儲存錯誤物件
   */
  static createStorageError (operation, message, details = {}) {
    const error = new Error(message || 'Storage operation failed')
    error.code = ErrorCodes.STORAGE_ERROR
    error.details = { operation, type: 'storage', ...details }
    return error
  }

  /**
   * 建立權限錯誤
   * @param {string} action - 需要權限的動作
   * @param {string} message - 錯誤訊息
   * @param {Object} details - 附加資訊
   * @returns {StandardError} 權限錯誤物件
   */
  static createPermissionError (action, message, details = {}) {
    const error = new Error(message || 'Permission denied')
    error.code = ErrorCodes.PERMISSION_ERROR
    error.details = { action, type: 'permission', ...details }
    return error
  }

  /**
   * 建立超時錯誤
   * @param {string} operation - 超時的操作
   * @param {number} timeout - 超時時間（毫秒）
   * @param {Object} details - 附加資訊
   * @returns {StandardError} 超時錯誤物件
   */
  static createTimeoutError (operation, timeout, details = {}) {
    const error = new Error(`Operation '${operation}' timed out after ${timeout}ms`)
    error.code = ErrorCodes.TIMEOUT_ERROR
    error.details = { operation, timeout, type: 'timeout', ...details }
    return error
  }

  /**
   * 建立書庫相關錯誤
   * @param {string} stage - 處理階段（'extraction', 'sync', 'update', 'classification', 'export'）
   * @param {string} message - 錯誤訊息
   * @param {Object} details - 附加資訊
   * @returns {StandardError} 書庫錯誤物件
   */
  static createBookLibraryError (stage, message, details = {}) {
    const { getBookErrorCode } = require('./BookErrorCodes')
    const code = getBookErrorCode(stage)

    const error = new Error(message || 'Book library operation failed')
    error.code = ErrorCodes.BOOK_ERROR
    error.details = { stage, type: 'book_library', originalCode: code, ...details }
    return error
  }

  /**
   * 包裝非同步操作，自動處理錯誤
   * @param {Function} operation - 要執行的非同步操作
   * @param {string} errorCode - 失敗時的錯誤代碼（可選）
   * @returns {Promise<OperationResult>} 操作結果
   */
  static async tryOperation (operation, errorCode = 'OPERATION_FAILED') {
    try {
      const result = await operation()
      return OperationResult.success(result)
    } catch (error) {
      let standardError

      if (error.code && Object.values(ErrorCodes).includes(error.code)) {
        standardError = error
      } else {
        standardError = new Error(error.message || 'Operation failed')
        standardError.code = ErrorCodes.OPERATION_ERROR
        standardError.details = {
          originalError: error.toString(),
          stack: error.stack,
          type: 'async_operation',
          originalCode: errorCode
        }
      }

      return OperationResult.failure(standardError)
    }
  }

  /**
   * 包裝同步操作，自動處理錯誤
   * @param {Function} operation - 要執行的同步操作
   * @param {string} errorCode - 失敗時的錯誤代碼（可選）
   * @returns {OperationResult} 操作結果
   */
  static trySync (operation, errorCode = 'OPERATION_FAILED') {
    try {
      const result = operation()
      return OperationResult.success(result)
    } catch (error) {
      let standardError

      if (error.code && Object.values(ErrorCodes).includes(error.code)) {
        standardError = error
      } else {
        standardError = new Error(error.message || 'Operation failed')
        standardError.code = ErrorCodes.OPERATION_ERROR
        standardError.details = {
          originalError: error.toString(),
          stack: error.stack,
          type: 'sync_operation',
          originalCode: errorCode
        }
      }

      return OperationResult.failure(standardError)
    }
  }

  /**
   * 包裝帶超時的非同步操作
   * @param {Function} operation - 要執行的非同步操作
   * @param {number} timeoutMs - 超時時間（毫秒）
   * @param {string} errorCode - 失敗時的錯誤代碼（可選）
   * @returns {Promise<OperationResult>} 操作結果
   */
  static async tryWithTimeout (operation, timeoutMs, errorCode = 'OPERATION_FAILED') {
    try {
      const timeoutPromise = new Promise((_resolve, reject) => {
        setTimeout(() => {
          reject(this.createTimeoutError('async_operation', timeoutMs, { errorCode }))
        }, timeoutMs)
      })

      const result = await Promise.race([
        operation(),
        timeoutPromise
      ])

      return OperationResult.success(result)
    } catch (error) {
      if (error.code && Object.values(ErrorCodes).includes(error.code)) {
        return OperationResult.failure(error)
      } else {
        const standardError = new Error(error.message || 'Operation failed')
        standardError.code = ErrorCodes.OPERATION_ERROR
        standardError.details = {
          originalError: error.toString(),
          timeout: timeoutMs,
          type: 'timeout_operation',
          originalCode: errorCode
        }
        return OperationResult.failure(standardError)
      }
    }
  }

  /**
   * 重試操作（帶指數退避）
   * @param {Function} operation - 要重試的操作
   * @param {Object} options - 重試選項
   * @param {number} options.maxRetries - 最大重試次數（預設: 3）
   * @param {number} options.baseDelay - 基礎延遲時間（預設: 1000ms）
   * @param {number} options.maxDelay - 最大延遲時間（預設: 10000ms）
   * @param {Function} options.shouldRetry - 判斷是否應該重試的函數
   * @returns {Promise<OperationResult>} 操作結果
   */
  static async retryOperation (operation, options = {}) {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      shouldRetry = () => true
    } = options

    let lastError = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation()
        return OperationResult.success(result)
      } catch (error) {
        lastError = error

        // 最後一次嘗試失敗
        if (attempt === maxRetries) {
          break
        }

        // 檢查是否應該重試
        if (!shouldRetry(error, attempt)) {
          break
        }

        // 計算延遲時間（指數退避）
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // 所有重試都失敗
    const standardError = (lastError?.code && Object.values(ErrorCodes).includes(lastError.code))
      ? lastError
      : (() => {
          const error = new Error(`Operation failed after ${maxRetries} retries: ${lastError?.message || 'Unknown error'}`)
          error.code = ErrorCodes.OPERATION_ERROR
          error.details = {
            maxRetries,
            lastError: lastError?.toString(),
            type: 'retry_operation',
            originalCode: 'RETRY_OPERATION_FAILED'
          }
          return error
        })()

    return OperationResult.failure(standardError)
  }

  /**
   * 批次處理操作（部分失敗不影響其他操作）
   * @param {Array<Function>} operations - 操作陣列
   * @param {Object} options - 選項
   * @param {boolean} options.stopOnFirstError - 遇到第一個錯誤時停止（預設: false）
   * @returns {Promise<OperationResult>} 批次處理結果
   */
  static async batchOperations (operations, options = {}) {
    const { stopOnFirstError = false } = options

    const results = []
    const errors = []

    for (let i = 0; i < operations.length; i++) {
      try {
        const result = await operations[i]()
        results.push({ index: i, success: true, data: result })
      } catch (error) {
        const standardError = (error?.code && Object.values(ErrorCodes).includes(error.code))
          ? error
          : (() => {
              const err = new Error(error.message || 'Batch operation failed')
              err.code = ErrorCodes.OPERATION_ERROR
              err.details = {
                index: i,
                originalError: error.toString(),
                originalCode: 'BATCH_OPERATION_FAILED'
              }
              return err
            })()

        errors.push({ index: i, error: standardError })
        results.push({ index: i, success: false, error: standardError })

        if (stopOnFirstError) {
          break
        }
      }
    }

    if (errors.length === 0) {
      return OperationResult.success({
        results,
        totalCount: operations.length,
        successCount: results.length,
        errorCount: 0
      })
    } else {
      const batchError = new Error(`Batch operation completed with ${errors.length} errors out of ${operations.length} operations`)
      batchError.code = ErrorCodes.OPERATION_ERROR
      batchError.details = {
        results,
        errors,
        totalCount: operations.length,
        successCount: results.filter(r => r.success).length,
        errorCount: errors.length,
        originalCode: 'BATCH_PARTIAL_FAILURE'
      }

      return OperationResult.failure(batchError)
    }
  }
}

// 匯出 ErrorHelper 類別 (統一使用 ES Module 格式)
export { ErrorHelper }
