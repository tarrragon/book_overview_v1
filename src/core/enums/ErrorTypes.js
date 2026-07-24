/**
 * 錯誤類型枚舉
 *
 * 定義所有錯誤的標準類型分類，確保系統中錯誤類型的一致性
 * 對應規劃文件中的錯誤分類架構
 */

const ErrorTypes = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  BUSINESS_ERROR: 'BUSINESS_ERROR',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Chrome Extension 特定錯誤
  EXTENSION_ERROR: 'EXTENSION_ERROR',
  CONTENT_SCRIPT_ERROR: 'CONTENT_SCRIPT_ERROR',
  BACKGROUND_SCRIPT_ERROR: 'BACKGROUND_SCRIPT_ERROR',
  POPUP_ERROR: 'POPUP_ERROR',

  // 書籍處理特定錯誤
  BOOK_EXTRACTION_ERROR: 'BOOK_EXTRACTION_ERROR',
  BOOK_VALIDATION_ERROR: 'BOOK_VALIDATION_ERROR',
  BOOK_SYNC_ERROR: 'BOOK_SYNC_ERROR',

  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
})

/**
 * 錯誤嚴重程度枚舉
 */
const ErrorSeverity = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
})

/**
 * 錯誤類型對應的預設嚴重程度
 * 未列出的類型一律回傳 ErrorSeverity.MEDIUM
 */
const DEFAULT_SEVERITY_MAP = Object.freeze({
  [ErrorTypes.SYSTEM_ERROR]: ErrorSeverity.CRITICAL,
  [ErrorTypes.EXTENSION_ERROR]: ErrorSeverity.CRITICAL,
  [ErrorTypes.STORAGE_ERROR]: ErrorSeverity.HIGH,
  [ErrorTypes.PERMISSION_ERROR]: ErrorSeverity.HIGH,
  [ErrorTypes.AUTHENTICATION_ERROR]: ErrorSeverity.HIGH,
  [ErrorTypes.BOOK_SYNC_ERROR]: ErrorSeverity.HIGH,
  [ErrorTypes.NETWORK_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorTypes.BUSINESS_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorTypes.TIMEOUT_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorTypes.CONFIGURATION_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorTypes.EXTERNAL_SERVICE_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorTypes.CONTENT_SCRIPT_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorTypes.BACKGROUND_SCRIPT_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorTypes.POPUP_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorTypes.BOOK_EXTRACTION_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorTypes.BOOK_VALIDATION_ERROR]: ErrorSeverity.LOW,
  [ErrorTypes.VALIDATION_ERROR]: ErrorSeverity.LOW,
  [ErrorTypes.UNKNOWN_ERROR]: ErrorSeverity.MEDIUM
})

/**
 * 檢查給定值是否為合法的 ErrorTypes
 * @param {string} errorType - 待驗證的錯誤類型值
 * @returns {boolean} 是否為合法的 ErrorTypes
 */
function isValidErrorType (errorType) {
  return Object.values(ErrorTypes).includes(errorType)
}

/**
 * 檢查給定值是否為合法的 ErrorSeverity
 * @param {string} severity - 待驗證的嚴重程度值
 * @returns {boolean} 是否為合法的 ErrorSeverity
 */
function isValidSeverity (severity) {
  return Object.values(ErrorSeverity).includes(severity)
}

/**
 * 依錯誤類型取得預設嚴重程度，未知類型回傳 MEDIUM
 * @param {string} errorType - 錯誤類型值
 * @returns {string} 對應的 ErrorSeverity
 */
function getDefaultSeverity (errorType) {
  return DEFAULT_SEVERITY_MAP[errorType] || ErrorSeverity.MEDIUM
}

module.exports = {
  ErrorTypes,
  ErrorSeverity,
  isValidErrorType,
  isValidSeverity,
  getDefaultSeverity
}
