/**
 * 訊息類型枚舉
 *
 * 定義所有訊息的標準類型，確保系統中訊息分類的一致性
 * 與 MessageDictionary 配合使用
 */

const MessageTypes = Object.freeze({
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  DEBUG: 'DEBUG',

  // 操作相關訊息
  OPERATION_START: 'OPERATION_START',
  OPERATION_PROGRESS: 'OPERATION_PROGRESS',
  OPERATION_COMPLETE: 'OPERATION_COMPLETE',
  OPERATION_CANCEL: 'OPERATION_CANCEL',

  // 系統相關訊息
  SYSTEM_STATUS: 'SYSTEM_STATUS',
  SYSTEM_READY: 'SYSTEM_READY',
  SYSTEM_SHUTDOWN: 'SYSTEM_SHUTDOWN',

  // 使用者互動訊息
  USER_PROMPT: 'USER_PROMPT',
  USER_NOTIFICATION: 'USER_NOTIFICATION',
  USER_CONFIRMATION: 'USER_CONFIRMATION',

  // 驗證相關訊息
  VALIDATION_SUCCESS: 'VALIDATION_SUCCESS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  VALIDATION_WARNING: 'VALIDATION_WARNING',

  // Chrome Extension 特定訊息
  EXTENSION_STATUS: 'EXTENSION_STATUS',
  CONTENT_SCRIPT_MESSAGE: 'CONTENT_SCRIPT_MESSAGE',
  BACKGROUND_MESSAGE: 'BACKGROUND_MESSAGE',
  POPUP_MESSAGE: 'POPUP_MESSAGE',

  // 書籍處理相關訊息
  BOOK_EXTRACTION_STATUS: 'BOOK_EXTRACTION_STATUS',
  BOOK_VALIDATION_STATUS: 'BOOK_VALIDATION_STATUS',
  BOOK_SYNC_STATUS: 'BOOK_SYNC_STATUS'
})

/**
 * 訊息優先級枚舉
 */
const MessagePriority = Object.freeze({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
})

/**
 * 訊息類型對應的預設優先級
 * 未列出的類型一律回傳 MessagePriority.NORMAL
 */
const DEFAULT_PRIORITY_MAP = Object.freeze({
  [MessageTypes.ERROR]: MessagePriority.URGENT,
  [MessageTypes.SYSTEM_SHUTDOWN]: MessagePriority.URGENT,
  [MessageTypes.WARNING]: MessagePriority.HIGH,
  [MessageTypes.VALIDATION_ERROR]: MessagePriority.HIGH,
  [MessageTypes.USER_CONFIRMATION]: MessagePriority.HIGH,
  [MessageTypes.DEBUG]: MessagePriority.LOW,
  [MessageTypes.OPERATION_PROGRESS]: MessagePriority.LOW
})

/**
 * 檢查給定值是否為合法的 MessageTypes
 * @param {string} messageType - 待驗證的訊息類型值
 * @returns {boolean} 是否為合法的 MessageTypes
 */
function isValidMessageType (messageType) {
  return Object.values(MessageTypes).includes(messageType)
}

/**
 * 檢查給定值是否為合法的 MessagePriority
 * @param {string} priority - 待驗證的優先級值
 * @returns {boolean} 是否為合法的 MessagePriority
 */
function isValidPriority (priority) {
  return Object.values(MessagePriority).includes(priority)
}

/**
 * 依訊息類型取得預設優先級，未知類型回傳 NORMAL
 * @param {string} messageType - 訊息類型值
 * @returns {string} 對應的 MessagePriority
 */
function getDefaultPriority (messageType) {
  return DEFAULT_PRIORITY_MAP[messageType] || MessagePriority.NORMAL
}

module.exports = {
  MessageTypes,
  MessagePriority,
  isValidMessageType,
  isValidPriority,
  getDefaultPriority
}
