/**
 * 錯誤代碼常數定義 - 專家優化版
 *
 * 設計原則（基於 Linux/John Carmack 專家建議）：
 * - 精簡至 15 個核心代碼，避免過度分類
 * - 使用描述性名稱，涵蓋主要錯誤域
 * - 零運行時開銷，編譯時常數
 * - Chrome Extension ES modules 專用
 *
 * 使用方式：
 * throw new Error(`${ErrorCodes.VALIDATION_ERROR}: Email is required`)
 *
 * 效能優化使用方式：
 * const error = new Error(message)
 * error.code = ErrorCodes.VALIDATION_ERROR
 * throw error
 */

/**
 * 系統錯誤代碼常數 - 15個核心代碼
 * @readonly
 * @enum {string}
 */
export const ErrorCodes = {
  // 驗證相關錯誤
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // 網路相關錯誤
  NETWORK_ERROR: 'NETWORK_ERROR',

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

  // 操作執行錯誤
  OPERATION_ERROR: 'OPERATION_ERROR',

  // 權限相關錯誤
  PERMISSION_ERROR: 'PERMISSION_ERROR',

  // 逾時錯誤
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',

  // 解析錯誤
  PARSE_ERROR: 'PARSE_ERROR',

  // 連線錯誤
  CONNECTION_ERROR: 'CONNECTION_ERROR',

  // 設定錯誤
  CONFIG_ERROR: 'CONFIG_ERROR',

  // 未知錯誤
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
}

// 凍結物件以防止意外修改
Object.freeze(ErrorCodes)

/**
 * 預編譯常用錯誤模式（John Carmack 效能優化建議）
 * 避免熱路徑中的字串拼接成本
 */
export const CommonErrors = {
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
function createError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}