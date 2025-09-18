/**
 * UI 事件驗證工具類
 * 為 UI 處理器提供統一的事件和資料驗證邏輯
 *
 * 負責功能：
 * - 提供通用的事件結構驗證
 * - 實現統一的錯誤格式和訊息
 * - 支援可擴展的驗證規則
 *
 * 設計考量：
 * - 減少重複的驗證邏輯
 * - 提供一致的錯誤處理
 * - 支援不同 UI 處理器的特定需求
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class UIEventValidator {
  /**
   * 驗證事件的基本結構
   *
   * @param {Object} event - 要驗證的事件物件
   * @throws {Error} 事件結構無效時拋出錯誤
   */
  static validateEventStructure (event) {
    if (!event || typeof event !== 'object') {
      const error = new Error('Event must be a valid object')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { dataType: 'object', category: 'ui', component: 'UIEventValidator' }
      throw error
    }

    if (!event.flowId) {
      const error = new Error('Event must have a flowId')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'ui', component: 'UIEventValidator', field: 'flowId' }
      throw error
    }
  }

  /**
   * 驗證基本資料物件結構
   *
   * @param {Object} data - 要驗證的資料物件
   * @param {string} dataType - 資料類型名稱（用於錯誤訊息）
   * @throws {Error} 資料結構無效時拋出錯誤
   */
  static validateDataStructure (data, dataType = 'data') {
    if (!data || typeof data !== 'object') {
      const error = new Error(`${dataType} must be a valid object`)
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { dataType: 'object', category: 'ui', component: 'UIEventValidator' }
      throw error
    }
  }

  /**
   * 驗證字串欄位
   *
   * @param {any} value - 要驗證的值
   * @param {string} fieldName - 欄位名稱
   * @param {Object} options - 驗證選項
   * @param {boolean} options.required - 是否為必填欄位
   * @param {number} options.minLength - 最小長度
   * @param {number} options.maxLength - 最大長度
   * @throws {Error} 驗證失敗時拋出錯誤
   */
  static validateStringField (value, fieldName, options = {}) {
    const { required = true, minLength = 0, maxLength = Infinity } = options

    if (required && (!value || typeof value !== 'string' || value.trim() === '')) {
      const error = new Error(`${fieldName} must be a non-empty string`)
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'ui', component: 'UIEventValidator', field: fieldName }
      throw error
    }

    if (value && typeof value === 'string') {
      if (value.length < minLength) {
        const error = new Error(`${fieldName} must be at least ${minLength} characters long`)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = { category: 'ui', component: 'UIEventValidator', field: fieldName, minLength }
        throw error
      }
      if (value.length > maxLength) {
        const error = new Error(`${fieldName} must be no more than ${maxLength} characters long`)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = { category: 'ui', component: 'UIEventValidator', field: fieldName, maxLength }
        throw error
      }
    }
  }

  /**
   * 驗證數值欄位
   *
   * @param {any} value - 要驗證的值
   * @param {string} fieldName - 欄位名稱
   * @param {Object} options - 驗證選項
   * @param {boolean} options.required - 是否為必填欄位
   * @param {number} options.min - 最小值
   * @param {number} options.max - 最大值
   * @param {boolean} options.integer - 是否必須為整數
   * @throws {Error} 驗證失敗時拋出錯誤
   */
  static validateNumberField (value, fieldName, options = {}) {
    const { required = true, min = -Infinity, max = Infinity, integer = false } = options

    if (required && (typeof value !== 'number' || isNaN(value))) {
      const error = new Error(`${fieldName} must be a number`)
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'ui', component: 'UIEventValidator', field: fieldName }
      throw error
    }

    if (typeof value === 'number' && !isNaN(value)) {
      if (value < min) {
        const error = new Error(`${fieldName} must be at least ${min}`)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = { category: 'ui', component: 'UIEventValidator', field: fieldName, min }
        throw error
      }
      if (value > max) {
        const error = new Error(`${fieldName} must be no more than ${max}`)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = { category: 'ui', component: 'UIEventValidator', field: fieldName, max }
        throw error
      }
      if (integer && !Number.isInteger(value)) {
        const error = new Error(`${fieldName} must be an integer`)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = { category: 'ui', component: 'UIEventValidator', field: fieldName }
        throw error
      }
    }
  }

  /**
   * 驗證枚舉欄位
   *
   * @param {any} value - 要驗證的值
   * @param {string} fieldName - 欄位名稱
   * @param {Array} validValues - 有效值陣列
   * @param {Object} options - 驗證選項
   * @param {boolean} options.required - 是否為必填欄位
   * @throws {Error} 驗證失敗時拋出錯誤
   */
  static validateEnumField (value, fieldName, validValues, options = {}) {
    const { required = true } = options

    if (required && value === undefined) {
      const error = new Error(`${fieldName} is required`)
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'ui', component: 'UIEventValidator', field: fieldName }
      throw error
    }

    if (value !== undefined && !validValues.includes(value)) {
      const error = new Error(`Invalid ${fieldName}: ${value}. Valid values: ${validValues.join(', ')}`)
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'ui', component: 'UIEventValidator', field: fieldName, validValues }
      throw error
    }
  }
}

module.exports = UIEventValidator
