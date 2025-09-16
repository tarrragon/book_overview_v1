/**
 * 錯誤處理系統統一匯出 - 簡化版
 *
 * 基於專家建議的簡化錯誤處理系統
 * 回歸原生 JavaScript Error + ErrorCodes 模式
 */

import { ErrorCodes, CommonErrors } from './ErrorCodes.js'

// Chrome Extension ES modules 專用匯出
export { ErrorCodes, CommonErrors }

/**
 * 效能優化的錯誤建立函數
 * @param {string} code - 錯誤代碼
 * @param {string} message - 錯誤訊息
 * @param {Object} details - 可選的額外資訊
 * @returns {Error} 帶有 code 屬性的 Error 物件
 */
export function createError(code, message, details = {}) {
  const error = new Error(message)
  error.code = code

  // 如果有額外資訊，加入 error 物件
  if (details && typeof details === 'object') {
    Object.assign(error, details)
  }

  return error
}

/**
 * 結果物件建立函數（用於業務邏輯）
 * @param {boolean} success - 是否成功
 * @param {any} data - 成功時的資料
 * @param {string} error - 失敗時的錯誤訊息
 * @param {string} code - 錯誤代碼
 * @returns {Object} 標準化結果物件
 */
export function createResult(success, data = null, error = null, code = null) {
  const result = { success }

  if (success) {
    if (data !== null) result.data = data
  } else {
    if (error) result.error = error
    if (code) result.code = code
  }

  return result
}
