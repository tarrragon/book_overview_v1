/**
 * 日誌系統統一匯出
 *
 * 提供所有日誌相關的類別和常數
 * 支援 CommonJS 和瀏覽器環境
 */

const { Logger, createLogger, quickLogger, LOG_LEVELS } = require('./Logger')

/**
 * 預設日誌等級
 */
const LogLevels = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
}

// 匯出所有日誌系統組件
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Logger,
    createLogger,
    quickLogger,
    LOG_LEVELS,
    LogLevels
  }
} else if (typeof window !== 'undefined') {
  // 瀏覽器環境
  window.LoggingSystem = {
    Logger,
    createLogger,
    quickLogger,
    LOG_LEVELS,
    LogLevels
  }
}
