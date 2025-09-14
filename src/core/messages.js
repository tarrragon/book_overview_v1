/**
const Logger = require("src/core/logging/Logger")
 * 基礎訊息字典 - 統一所有文字輸出
const Logger = require("src/core/logging/Logger")
 * 根據 Linux 和 Carmack 專家建議的最小可行解決方案
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 目的：解決 3760 個 console.log 不一致問題
const Logger = require("src/core/logging/Logger")
 * 效能：< 5ms 處理時間，< 500KB 記憶體佔用
const Logger = require("src/core/logging/Logger")
 */

// 基礎日誌訊息常數
const Logger = require("src/core/logging/Logger")
const LOG_MESSAGES = {
const Logger = require("src/core/logging/Logger")
  // === 書籍擷取相關 ===
const Logger = require("src/core/logging/Logger")
  BOOK_EXTRACTION_START: 'Book extraction started for platform: {platform}',
const Logger = require("src/core/logging/Logger")
  BOOK_EXTRACTION_SUCCESS: 'Book extracted successfully: {title}',
const Logger = require("src/core/logging/Logger")
  BOOK_EXTRACTION_FAILED: 'Book extraction failed: {reason}',
const Logger = require("src/core/logging/Logger")
  BOOK_LIST_LOADED: 'Book list loaded: {count} books',

const Logger = require("src/core/logging/Logger")
  // === 資料驗證相關 ===
const Logger = require("src/core/logging/Logger")
  VALIDATION_START: 'Starting validation for {type}',
const Logger = require("src/core/logging/Logger")
  VALIDATION_SUCCESS: 'Validation passed for {type}',
const Logger = require("src/core/logging/Logger")
  VALIDATION_FAILED: 'Validation failed: {reason}',
const Logger = require("src/core/logging/Logger")
  REQUIRED_FIELD_MISSING: 'Required field missing: {field}',
const Logger = require("src/core/logging/Logger")
  INVALID_FORMAT: 'Invalid format for {field}: expected {expected}, got {actual}',

const Logger = require("src/core/logging/Logger")
  // === 網路相關 ===
const Logger = require("src/core/logging/Logger")
  NETWORK_REQUEST_START: 'Network request started: {url}',
const Logger = require("src/core/logging/Logger")
  NETWORK_REQUEST_SUCCESS: 'Network request completed: {status}',
const Logger = require("src/core/logging/Logger")
  NETWORK_ERROR: 'Network request failed: {error}',
const Logger = require("src/core/logging/Logger")
  NETWORK_TIMEOUT: 'Network request timeout after {timeout}ms',
const Logger = require("src/core/logging/Logger")
  CONNECTION_FAILED: 'Connection failed to {host}',

const Logger = require("src/core/logging/Logger")
  // === 儲存相關 ===
const Logger = require("src/core/logging/Logger")
  STORAGE_READ_SUCCESS: 'Storage read successful: {key}',
const Logger = require("src/core/logging/Logger")
  STORAGE_WRITE_SUCCESS: 'Storage write successful: {key}',
const Logger = require("src/core/logging/Logger")
  STORAGE_ERROR: 'Storage operation failed: {operation} - {error}',
const Logger = require("src/core/logging/Logger")
  STORAGE_FULL: 'Storage space insufficient',

const Logger = require("src/core/logging/Logger")
  // === 使用者操作相關 ===
const Logger = require("src/core/logging/Logger")
  USER_ACTION_START: 'User action started: {action}',
const Logger = require("src/core/logging/Logger")
  USER_ACTION_SUCCESS: 'User action completed: {action}',
const Logger = require("src/core/logging/Logger")
  USER_ACTION_CANCELLED: 'User cancelled action: {action}',

const Logger = require("src/core/logging/Logger")
  // === 系統狀態相關 ===
const Logger = require("src/core/logging/Logger")
  SYSTEM_READY: 'System initialized successfully',
const Logger = require("src/core/logging/Logger")
  SYSTEM_ERROR: 'System error occurred: {error}',
const Logger = require("src/core/logging/Logger")
  PERMISSION_DENIED: 'Permission denied for {resource}',
const Logger = require("src/core/logging/Logger")
  RESOURCE_NOT_FOUND: 'Resource not found: {resource}'
const Logger = require("src/core/logging/Logger")
}

// 簡單的參數插值函數
const Logger = require("src/core/logging/Logger")
function formatMessage (messageKey, params = {}) {
const Logger = require("src/core/logging/Logger")
  const template = LOG_MESSAGES[messageKey] || messageKey
const Logger = require("src/core/logging/Logger")
  return template.replace(/\{(\w+)\}/g, (match, key) => {
const Logger = require("src/core/logging/Logger")
    return params[key] !== undefined ? String(params[key]) : match
const Logger = require("src/core/logging/Logger")
  })
const Logger = require("src/core/logging/Logger")
}

// 統一的日誌函數
const Logger = require("src/core/logging/Logger")
const log = {
const Logger = require("src/core/logging/Logger")
  info: (key, params = {}) => {
const Logger = require("src/core/logging/Logger")
    const message = formatMessage(key, params)
const Logger = require("src/core/logging/Logger")
    Logger.info(`[INFO] ${message}`)
const Logger = require("src/core/logging/Logger")
  },

const Logger = require("src/core/logging/Logger")
  warn: (key, params = {}) => {
const Logger = require("src/core/logging/Logger")
    const message = formatMessage(key, params)
const Logger = require("src/core/logging/Logger")
    // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
    Logger.warn(`[WARN] ${message}`)
const Logger = require("src/core/logging/Logger")
  },

const Logger = require("src/core/logging/Logger")
  error: (key, params = {}) => {
const Logger = require("src/core/logging/Logger")
    const message = formatMessage(key, params)
const Logger = require("src/core/logging/Logger")
    // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
    Logger.error(`[ERROR] ${message}`)
const Logger = require("src/core/logging/Logger")
  },

const Logger = require("src/core/logging/Logger")
  debug: (key, params = {}) => {
const Logger = require("src/core/logging/Logger")
    const message = formatMessage(key, params)
const Logger = require("src/core/logging/Logger")
  }
const Logger = require("src/core/logging/Logger")
}

// 匯出
const Logger = require("src/core/logging/Logger")
module.exports = {
const Logger = require("src/core/logging/Logger")
  LOG_MESSAGES,
const Logger = require("src/core/logging/Logger")
  formatMessage,
const Logger = require("src/core/logging/Logger")
  log
const Logger = require("src/core/logging/Logger")
}

// 使用範例：
// 舊寫法: Logger.info('Book extraction started for platform: readmoo')
// 新寫法: log.info('BOOK_EXTRACTION_START', { platform: 'readmoo' })
//
// 舊寫法: // eslint-disable-next-line no-console
// Logger.error('Validation failed:', error.message) // Example only
// 新寫法: log.error('VALIDATION_FAILED', { reason: error.message })
