/**
 * 日誌等級枚舉
 *
 * 定義統一的日誌等級，確保系統中日誌記錄的一致性
 * 與 Logger 系統配合使用
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

const LogLevel = Object.freeze({
  TRACE: 'TRACE',
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  FATAL: 'FATAL'
})

/**
 * 日誌等級數值對應表（用於等級比較）
 */
const LogLevelValues = Object.freeze({
  [LogLevel.TRACE]: 0,
  [LogLevel.DEBUG]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.WARN]: 3,
  [LogLevel.ERROR]: 4,
  [LogLevel.FATAL]: 5
})

/**
 * 比較兩個日誌等級
 * @param {string} level1 - 第一個日誌等級
 * @param {string} level2 - 第二個日誌等級
 * @returns {number} 比較結果 (-1: level1 < level2, 0: 相等, 1: level1 > level2)
 */
function compareLogLevels (level1, level2) {
  const value1 = LogLevelValues[level1]
  const value2 = LogLevelValues[level2]

  if (value1 === undefined || value2 === undefined) {
    const error = new Error('Invalid log level comparison: ${level1} vs ${level2}')
    error.code = ErrorCodes.VALIDATION_ERROR
    error.details = {
      level1,
      level2,
      validLevels: Object.keys(LogLevelValues),
      category: 'validation'
    }
    throw error
  }

  return value1 < value2 ? -1 : (value1 > value2 ? 1 : 0)
}

/**
 * 檢查日誌等級是否應該被記錄
 * @param {string} messageLevel - 訊息的日誌等級
 * @param {string} configuredLevel - 配置的最低日誌等級
 * @returns {boolean} 是否應該記錄此等級的訊息
 */
function shouldLog (messageLevel, configuredLevel) {
  return compareLogLevels(messageLevel, configuredLevel) >= 0
}

/**
 * 根據日誌等級獲取對應的顏色（用於控制台輸出）
 * @param {string} level - 日誌等級
 * @returns {string} ANSI 顏色代碼
 */
function getLogLevelColor (level) {
  const colorMapping = {
    [LogLevel.TRACE]: '\x1b[90m', // 灰色
    [LogLevel.DEBUG]: '\x1b[36m', // 青色
    [LogLevel.INFO]: '\x1b[32m', // 綠色
    [LogLevel.WARN]: '\x1b[33m', // 黃色
    [LogLevel.ERROR]: '\x1b[31m', // 紅色
    [LogLevel.FATAL]: '\x1b[35m' // 紫色
  }

  return colorMapping[level] || '\x1b[0m'
}

/**
 * 重置 ANSI 顏色
 */
const RESET_COLOR = '\x1b[0m'

module.exports = {
  LogLevel,
  LogLevelValues,
  compareLogLevels,
  shouldLog,
  getLogLevelColor,
  RESET_COLOR
}
