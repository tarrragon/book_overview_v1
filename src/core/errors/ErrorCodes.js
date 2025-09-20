/**
 * 錯誤代碼常數定義 - 專家優化版
 *
 * 設計原則（基於 Linux/John Carmack 專家建議）：
 * - 精簡至 17 個核心代碼，避免過度分類
 * - 使用描述性名稱，涵蓋主要錯誤域
 * - 零運行時開銷，編譯時常數
 * - Chrome Extension ES modules 專用
 *
 * 使用方式：
 * const error = new Error(`${ErrorCodes.VALIDATION_ERROR}: Email is required`)
 * error.code = ErrorCodes.IMPLEMENTATION_ERROR
 * throw error
 *
 * 效能優化使用方式：
 * const error = new Error(message)
 * error.code = ErrorCodes.VALIDATION_ERROR
 * throw error
 */

/**
 * 系統錯誤代碼常數 - 17個核心代碼
 * @readonly
 * @enum {string}
 */
const ErrorCodes = {
  // 驗證相關錯誤
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT_ERROR: 'INVALID_INPUT_ERROR',
  INVALID_DATA_FORMAT: 'INVALID_DATA_FORMAT',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',

  // 網路相關錯誤
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',

  // 儲存相關錯誤
  STORAGE_ERROR: 'STORAGE_ERROR',

  // Readmoo 平台錯誤
  READMOO_ERROR: 'READMOO_ERROR',

  // Chrome Extension 錯誤
  CHROME_ERROR: 'CHROME_ERROR',

  // 書籍處理錯誤
  BOOK_ERROR: 'BOOK_ERROR',

  // DOM 操作錯誤
  DOM_ERROR: 'DOM_ERROR',

  // 檔案處理錯誤
  FILE_ERROR: 'FILE_ERROR',
  FILE_SIZE_EXCEEDED: 'FILE_SIZE_EXCEEDED',
  LARGE_FILES_DETECTED: 'LARGE_FILES_DETECTED',

  // 操作執行錯誤
  OPERATION_ERROR: 'OPERATION_ERROR',
  OPERATION_FAILED: 'OPERATION_FAILED',
  EXPORT_OPERATION_FAILED: 'EXPORT_OPERATION_FAILED',
  UI_OPERATION_FAILED: 'UI_OPERATION_FAILED',
  UNSUPPORTED_OPERATION: 'UNSUPPORTED_OPERATION',

  // 權限相關錯誤
  PERMISSION_ERROR: 'PERMISSION_ERROR',

  // 解析錯誤
  PARSE_ERROR: 'PARSE_ERROR',

  // 設定錯誤
  CONFIG_ERROR: 'CONFIG_ERROR',

  // 渲染錯誤
  RENDER_ERROR: 'RENDER_ERROR',

  // 效能錯誤
  PERFORMANCE_ERROR: 'PERFORMANCE_ERROR',
  PERFORMANCE_MEMORY_TOO_HIGH: 'PERFORMANCE_MEMORY_TOO_HIGH',
  PERFORMANCE_STARTUP_TOO_SLOW: 'PERFORMANCE_STARTUP_TOO_SLOW',

  // 資源相關錯誤
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_NOT_AVAILABLE: 'RESOURCE_NOT_AVAILABLE',
  RESOURCE_EXHAUSTED: 'RESOURCE_EXHAUSTED',
  MISSING_REQUIRED_DATA: 'MISSING_REQUIRED_DATA',

  // 系統相關錯誤
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  INITIALIZATION_ERROR: 'INITIALIZATION_ERROR',
  SERVICE_INITIALIZATION_ERROR: 'SERVICE_INITIALIZATION_ERROR',
  IMPLEMENTATION_ERROR: 'IMPLEMENTATION_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  FEATURE_NOT_SUPPORTED: 'FEATURE_NOT_SUPPORTED',

  // 事件總線錯誤
  EVENTBUS_ERROR: 'EVENTBUS_ERROR',
  EVENTBUS_REQUIRED: 'EVENTBUS_REQUIRED',

  // 限制相關錯誤
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',

  // 安全相關錯誤
  CODE_INJECTION_RISK: 'CODE_INJECTION_RISK',
  UNSAFE_CSP_EVAL: 'UNSAFE_CSP_EVAL',
  UNSAFE_CSP_INLINE: 'UNSAFE_CSP_INLINE',
  PRIVACY_UNDECLARED_DATA_COLLECTION: 'PRIVACY_UNDECLARED_DATA_COLLECTION',

  // Manifest 相關錯誤
  MANIFEST_MISSING_FIELDS: 'MANIFEST_MISSING_FIELDS',
  MANIFEST_VERSION_INVALID: 'MANIFEST_VERSION_INVALID',
  MISSING_EXTENSION_ICON: 'MISSING_EXTENSION_ICON',

  // 品質評估錯誤
  FUNCTIONALITY_SCORE_TOO_LOW: 'FUNCTIONALITY_SCORE_TOO_LOW',

  // 未知錯誤
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
}

// 凍結物件以防止意外修改
Object.freeze(ErrorCodes)

/**
 * 預編譯常用錯誤模式（John Carmack 效能優化建議）
 * 避免熱路徑中的字串拼接成本
 */
const CommonErrors = {
  EMAIL_REQUIRED: Object.freeze(createError(ErrorCodes.VALIDATION_ERROR, 'Email is required')),
  TITLE_REQUIRED: Object.freeze(createError(ErrorCodes.VALIDATION_ERROR, 'Title is required')),
  NETWORK_TIMEOUT: Object.freeze(createError(ErrorCodes.TIMEOUT_ERROR, 'Network request timeout')),
  READMOO_LOGIN_FAILED: Object.freeze(createError(ErrorCodes.READMOO_ERROR, 'Login to Readmoo failed')),
  BOOK_EXTRACTION_FAILED: Object.freeze(createError(ErrorCodes.BOOK_ERROR, 'Book data extraction failed'))
}

/**
 * 效能優化的錯誤建立函數
 * @param {string} code - 錯誤代碼
 * @param {string} message - 錯誤訊息
 * @returns {Error} 帶有 code 屬性的 Error 物件
 */
function createError (code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

// CommonJS 支援
module.exports = {
  ErrorCodes,
  CommonErrors,
  createError
}
