/**
 * 訊息字典系統統一匯出
 *
 * 提供所有訊息管理相關的類別和常數
 * 支援 CommonJS 和瀏覽器環境
 */

const { MessageDictionary, GlobalMessages } = require('./MessageDictionary')

/**
 * 常用訊息鍵值常數
 */
const MessageKeys = {
  // 基本狀態
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  LOADING: 'LOADING',
  PROCESSING: 'PROCESSING',

  // 操作相關
  OPERATION_START: 'OPERATION_START',
  OPERATION_COMPLETE: 'OPERATION_COMPLETE',
  OPERATION_CANCELLED: 'OPERATION_CANCELLED',
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
  OPERATION_RETRY: 'OPERATION_RETRY',

  // 系統狀態
  SYSTEM_READY: 'SYSTEM_READY',
  SYSTEM_SHUTDOWN: 'SYSTEM_SHUTDOWN',

  // 錯誤訊息
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',

  // 書庫相關
  BOOK_EXTRACTION_START: 'BOOK_EXTRACTION_START',
  BOOK_EXTRACTION_COMPLETE: 'BOOK_EXTRACTION_COMPLETE',
  BOOK_COUNT: 'BOOK_COUNT',
  BOOK_PROGRESS_UPDATE: 'BOOK_PROGRESS_UPDATE',
  BOOK_VALIDATION_FAILED: 'BOOK_VALIDATION_FAILED',

  // Chrome Extension 相關
  EXTENSION_READY: 'EXTENSION_READY',
  CONTENT_SCRIPT_LOADED: 'CONTENT_SCRIPT_LOADED',
  POPUP_OPENED: 'POPUP_OPENED',
  BACKGROUND_SCRIPT_ACTIVE: 'BACKGROUND_SCRIPT_ACTIVE',

  // 使用者介面
  RETRY: 'RETRY',
  CANCEL: 'CANCEL',
  CONFIRM: 'CONFIRM',

  // 日誌相關
  DEBUG_MESSAGE: 'DEBUG_MESSAGE',
  INFO_MESSAGE: 'INFO_MESSAGE',
  WARN_MESSAGE: 'WARN_MESSAGE',
  ERROR_MESSAGE: 'ERROR_MESSAGE'
}

// 匯出所有訊息字典組件
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MessageDictionary,
    GlobalMessages,
    MessageKeys
  }
} else if (typeof window !== 'undefined') {
  // 瀏覽器環境
  window.MessageSystem = {
    MessageDictionary,
    GlobalMessages,
    MessageKeys
  }
}
