/**
 * 書庫相關錯誤代碼和業務邏輯
 * 將業務邏輯與錯誤處理分離
 * @author 程式碼品質優化
 * @version 1.0.0
 */

/**
 * 書庫操作階段對應的錯誤代碼對應表
 */
const BOOK_ERROR_CODES = {
  extraction: 'BOOK_EXTRACTION_FAILED',
  sync: 'BOOK_SYNC_FAILED',
  update: 'BOOK_UPDATE_FAILED',
  classification: 'BOOK_CLASSIFICATION_FAILED',
  export: 'BOOK_EXPORT_FAILED'
}

/**
 * 預設書庫錯誤代碼
 */
const DEFAULT_BOOK_ERROR_CODE = 'BOOK_OPERATION_FAILED'

/**
 * 根據操作階段取得對應的錯誤代碼
 * @param {string} stage - 操作階段
 * @returns {string} 錯誤代碼
 */
function getBookErrorCode(stage) {
  return BOOK_ERROR_CODES[stage] || DEFAULT_BOOK_ERROR_CODE
}

/**
 * 取得所有支援的書庫操作階段
 * @returns {string[]} 支援的操作階段清單
 */
function getSupportedBookStages() {
  return Object.keys(BOOK_ERROR_CODES)
}

/**
 * 檢查操作階段是否為有效的書庫操作
 * @param {string} stage - 操作階段
 * @returns {boolean} 是否為有效操作
 */
function isValidBookStage(stage) {
  return stage in BOOK_ERROR_CODES
}

module.exports = {
  BOOK_ERROR_CODES,
  DEFAULT_BOOK_ERROR_CODE,
  getBookErrorCode,
  getSupportedBookStages,
  isValidBookStage
}