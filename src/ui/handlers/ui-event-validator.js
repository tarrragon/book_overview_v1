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

class UIEventValidator {
  /**
   * 驗證事件的基本結構
   *
   * @param {Object} event - 要驗證的事件物件
   * @throws {Error} 事件結構無效時拋出錯誤
   */
  static validateEventStructure (event) {
    if (!event || typeof event !== 'object') {
      throw new Error('Event must be a valid object')
    }

    if (!event.flowId) {
      throw new Error('Event must have a flowId')
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
      throw new Error(`${dataType} must be a valid object`)
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
      throw new Error(`${fieldName} must be a non-empty string`)
    }

    if (value && typeof value === 'string') {
      if (value.length < minLength) {
        throw new Error(`${fieldName} must be at least ${minLength} characters long`)
      }
      if (value.length > maxLength) {
        throw new Error(`${fieldName} must be no more than ${maxLength} characters long`)
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
      throw new Error(`${fieldName} must be a number`)
    }

    if (typeof value === 'number' && !isNaN(value)) {
      if (value < min) {
        throw new Error(`${fieldName} must be at least ${min}`)
      }
      if (value > max) {
        throw new Error(`${fieldName} must be no more than ${max}`)
      }
      if (integer && !Number.isInteger(value)) {
        throw new Error(`${fieldName} must be an integer`)
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
      throw new Error(`${fieldName} is required`)
    }

    if (value !== undefined && !validValues.includes(value)) {
      throw new Error(`Invalid ${fieldName}: ${value}. Valid values: ${validValues.join(', ')}`)
    }
  }
}

module.exports = UIEventValidator
