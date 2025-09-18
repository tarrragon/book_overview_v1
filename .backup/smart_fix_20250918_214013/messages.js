/**
 * 基礎訊息字典 - 統一所有文字輸出
 * 根據 Linux 和 Carmack 專家建議的最小可行解決方案
 *
 * 目的：解決 3760 個 console.log 不一致問題
 * 效能：< 5ms 處理時間，< 500KB 記憶體佔用
 */

// 基礎日誌訊息常數
const LOG_MESSAGES = {
  // === 書籍擷取相關 ===
  BOOK_EXTRACTION_START: 'Book extraction started for platform: {platform}',
  BOOK_EXTRACTION_SUCCESS: 'Book extracted successfully: {title}',
  BOOK_EXTRACTION_FAILED: 'Book extraction failed: {reason}',
  BOOK_LIST_LOADED: 'Book list loaded: {count} books',

  // === 資料驗證相關 ===
  VALIDATION_START: 'Starting validation for {type}',
  VALIDATION_SUCCESS: 'Validation passed for {type}',
  VALIDATION_FAILED: 'Validation failed: {reason}',
  REQUIRED_FIELD_MISSING: 'Required field missing: {field}',
  INVALID_FORMAT: 'Invalid format for {field}: expected {expected}, got {actual}',

  // === 網路相關 ===
  NETWORK_REQUEST_START: 'Network request started: {url}',
  NETWORK_REQUEST_SUCCESS: 'Network request completed: {status}',
  NETWORK_ERROR: 'Network request failed: {error}',
  NETWORK_TIMEOUT: 'Network request timeout after {timeout}ms',
  CONNECTION_FAILED: 'Connection failed to {host}',

  // === 儲存相關 ===
  STORAGE_READ_SUCCESS: 'Storage read successful: {key}',
  STORAGE_WRITE_SUCCESS: 'Storage write successful: {key}',
  STORAGE_ERROR: 'Storage operation failed: {operation} - {error}',
  STORAGE_FULL: 'Storage space insufficient',

  // === 使用者操作相關 ===
  USER_ACTION_START: 'User action started: {action}',
  USER_ACTION_SUCCESS: 'User action completed: {action}',
  USER_ACTION_CANCELLED: 'User cancelled action: {action}',

  // === 系統狀態相關 ===
  SYSTEM_READY: 'System initialized successfully',
  SYSTEM_ERROR: 'System error occurred: {error}',
  PERMISSION_DENIED: 'Permission denied for {resource}',
  RESOURCE_NOT_FOUND: 'Resource not found: {resource}'
}

// 簡單的參數插值函數
function formatMessage (messageKey, params = {}) {
  const template = LOG_MESSAGES[messageKey] || messageKey
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] !== undefined ? String(params[key]) : match
  })
}

// 統一的日誌函數
const log = {
  info: (key, params = {}) => {
    const message = formatMessage(key, params)
    // Logger 後備方案: Core Messages 統一輸出系統
    // 設計理念: 專門的 console 封裝模組，目的是統一和規範化所有文字輸出
    // 後備機制: 直接使用 console，這就是此模組的核心功能
    // 使用場景: 統一處理 3760+ 個分散的 console.log 問題
    // eslint-disable-next-line no-console
    console.log(`[INFO] ${message}`)
  },

  warn: (key, params = {}) => {
    const message = formatMessage(key, params)
    // Logger 後備方案: Core Messages 統一輸出系統
    // 設計理念: 專門的 console 封裝模組，提供標準化的警告輸出
    // 後備機制: 直接使用 console，這是設計核心而非後備
    // 使用場景: 系統級警告訊息的統一管理和輸出
    // eslint-disable-next-line no-console
    console.warn(`[WARN] ${message}`)
  },

  error: (key, params = {}) => {
    const message = formatMessage(key, params)
    // Logger 後備方案: Core Messages 統一輸出系統
    // 設計理念: 專門的 console 封裝模組，提供標準化的錯誤輸出
    // 後備機制: 直接使用 console，這是核心功能而非退而求其次
    // 使用場景: 系統級錯誤訊息的統一管理、格式化和輸出
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${message}`)
  },

  debug: (key, params = {}) => {
    // TODO: 實作 debug 訊息處理
    const message = formatMessage(key, params)
    // Logger 後備方案: Core Messages 統一輸出系統
    // 設計理念: 專門的 console 封裝模組，提供標準化的除錯輸出
    // 後備機制: 直接使用 console，這是設計意圖而非備用選擇
    // 使用場景: 開發階段除錯訊息的統一管理和輸出
    // eslint-disable-next-line no-console
    console.debug(`[DEBUG] ${message}`)
  }
}

// 匯出
module.exports = {
  LOG_MESSAGES,
  formatMessage,
  log
}

// 使用範例：
// 舊寫法: console.log('Book extraction started for platform: readmoo')
// 新寫法: log.info('BOOK_EXTRACTION_START', { platform: 'readmoo' })
//
// 舊寫法: // eslint-disable-next-line no-console
// console.error('Validation failed:', error.message) // Example only
// 新寫法: log.error('VALIDATION_FAILED', { reason: error.message })
