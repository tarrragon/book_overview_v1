/**
 * 錯誤處理系統統一匯出
 * 
 * 提供所有錯誤處理相關的類別和常數
 * 支援 CommonJS 和瀏覽器環境
 */

const { StandardError } = require('./StandardError')
const { OperationResult } = require('./OperationResult') 
const { ErrorHelper } = require('./ErrorHelper')

/**
 * 常用錯誤代碼常數
 */
const ErrorCodes = {
  // 通用錯誤
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  OPERATION_FAILED: 'OPERATION_FAILED',
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
  
  // 驗證錯誤
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  
  // 網路錯誤
  NETWORK_ERROR: 'NETWORK_ERROR',
  
  // 儲存錯誤
  STORAGE_ERROR: 'STORAGE_ERROR',
  
  // 權限錯誤
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  
  // 書庫相關錯誤
  BOOK_EXTRACTION_FAILED: 'BOOK_EXTRACTION_FAILED',
  BOOK_SYNC_FAILED: 'BOOK_SYNC_FAILED',
  BOOK_UPDATE_FAILED: 'BOOK_UPDATE_FAILED',
  BOOK_CLASSIFICATION_FAILED: 'BOOK_CLASSIFICATION_FAILED',
  BOOK_EXPORT_FAILED: 'BOOK_EXPORT_FAILED',
  BOOK_OPERATION_FAILED: 'BOOK_OPERATION_FAILED',
  
  // 批次處理錯誤
  BATCH_OPERATION_FAILED: 'BATCH_OPERATION_FAILED',
  BATCH_PARTIAL_FAILURE: 'BATCH_PARTIAL_FAILURE',
  RETRY_OPERATION_FAILED: 'RETRY_OPERATION_FAILED'
}

// 匯出所有錯誤處理組件
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    StandardError,
    OperationResult,
    ErrorHelper,
    ErrorCodes
  }
} else if (typeof window !== 'undefined') {
  // 瀏覽器環境
  window.ErrorHandling = {
    StandardError,
    OperationResult, 
    ErrorHelper,
    ErrorCodes
  }
}