/**
 * 驗證相關錯誤代碼
 *
 * 涵蓋輸入驗證、資料格式驗證、必填欄位檢查等場景。
 */
const ValidationCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT_ERROR: 'INVALID_INPUT_ERROR',
  INVALID_DATA_FORMAT: 'INVALID_DATA_FORMAT',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING'
}

Object.freeze(ValidationCodes)

module.exports = { ValidationCodes }
