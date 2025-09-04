/**
 * 系統枚舉統一匯出
 * 
 * 提供所有系統枚舉的統一入口點
 * 確保枚舉系統的一致性和易用性
 */

const { OperationStatus, isValidOperationStatus, isCompletedStatus, isSuccessStatus } = require('./OperationStatus')
const { ErrorTypes, ErrorSeverity, isValidErrorType, isValidSeverity, getDefaultSeverity } = require('./ErrorTypes')
const { MessageTypes, MessagePriority, isValidMessageType, isValidPriority, getDefaultPriority } = require('./MessageTypes')
const { LogLevel, LogLevelValues, isValidLogLevel, compareLogLevels, shouldLog, getLogLevelColor, RESET_COLOR } = require('./LogLevel')

module.exports = {
  // 操作狀態相關
  OperationStatus,
  isValidOperationStatus,
  isCompletedStatus,
  isSuccessStatus,
  
  // 錯誤類型相關
  ErrorTypes,
  ErrorSeverity,
  isValidErrorType,
  isValidSeverity,
  getDefaultSeverity,
  
  // 訊息類型相關
  MessageTypes,
  MessagePriority,
  isValidMessageType,
  isValidPriority,
  getDefaultPriority,
  
  // 日誌等級相關
  LogLevel,
  LogLevelValues,
  isValidLogLevel,
  compareLogLevels,
  shouldLog,
  getLogLevelColor,
  RESET_COLOR
}