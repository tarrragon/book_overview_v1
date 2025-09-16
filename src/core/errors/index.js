/**
 * 錯誤處理系統統一匯出
 *
 * 提供所有錯誤處理相關的類別和常數
 * 支援 CommonJS 和瀏覽器環境
 */

const { StandardError } = require('./StandardError')
const { OperationResult } = require('./OperationResult')
const { ErrorHelper } = require('./ErrorHelper')
const { ErrorCodes } = require('./ErrorCodes')

// 匯出所有錯誤處理組件
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    StandardError,
    OperationResult,
    ErrorHelper,
    ErrorCodes
  }
} else if (typeof window !== 'undefined') {
  // 瀏覽器環境
  window.ErrorHandling = {
    StandardError,
    OperationResult,
    ErrorHelper,
    ErrorCodes
  }
}
