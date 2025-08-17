/**
 * validation-utils.js
 *
 * 通用資料驗證工具模組
 *
 * 負責功能：
 * - 基本資料類型驗證（字串、數字、布林、陣列、物件）
 * - 格式驗證（URL、電子郵件、日期、ISBN）
 * - 範圍驗證（數字範圍、字串長度、進度百分比）
 * - Chrome Extension 特定驗證（Extension ID、Tab ID、Window ID）
 * - 複合驗證（必填欄位、物件結構）
 * - 資料清理和標準化
 *
 * 設計考量：
 * - 防禦性程式設計：處理所有邊界情況和異常輸入
 * - 純函數設計：無副作用，可預測的輸出
 * - 效能優化：快取正則表達式和常用驗證邏輯
 * - 錯誤處理：優雅處理無效輸入，不拋出錯誤
 *
 * 使用情境：
 * - Content Script 中的表單資料驗證
 * - Background Service Worker 中的 API 參數驗證
 * - Popup 界面中的使用者輸入驗證
 * - 資料提取過程中的品質檢查
 */

// 快取正則表達式以提升效能
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_REGEX = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
const PHONE_REGEX = /[\d\s\-()+.]/g
const ISBN_CLEANUP_REGEX = /[-\s]/g
const EXTENSION_ID_REGEX = /^[a-p]{32}$/

const ValidationUtils = {

  // ==================== 基本資料類型驗證 ====================

  /**
   * 驗證是否為字串類型
   */
  isString (value) {
    return typeof value === 'string'
  },

  /**
   * 驗證是否為數字類型（排除 NaN）
   */
  isNumber (value) {
    return typeof value === 'number' && !isNaN(value)
  },

  /**
   * 驗證是否為布林類型
   */
  isBoolean (value) {
    return typeof value === 'boolean'
  },

  /**
   * 驗證是否為陣列類型
   */
  isArray (value) {
    return Array.isArray(value)
  },

  /**
   * 驗證是否為物件類型（排除 null 和陣列）
   */
  isObject (value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  },

  // ==================== 字串驗證 ====================

  /**
   * 驗證是否為非空字串（去除空白後）
   */
  isNonEmptyString (value) {
    return this.isString(value) && value.trim().length > 0
  },

  /**
   * 驗證字串長度是否在指定範圍內
   */
  isStringLengthInRange (value, min, max) {
    if (!this.isString(value)) return false
    const length = value.length
    return length >= min && length <= max
  },

  /**
   * 驗證 URL 格式
   */
  isValidURL (value) {
    if (!this.isString(value) || value.length === 0) return false

    try {
      // 使用內建 URL 建構函數驗證
      const url = new URL(value)
      // 檢查 URL 對象是否有效
      return url && URL_REGEX.test(value)
    } catch {
      return false
    }
  },

  /**
   * 驗證電子郵件格式
   */
  isValidEmail (value) {
    if (!this.isString(value) || value.length === 0) return false
    return EMAIL_REGEX.test(value)
  },

  // ==================== 數字驗證 ====================

  /**
   * 驗證數字是否在指定範圍內
   */
  isNumberInRange (value, min, max) {
    if (!this.isNumber(value)) return false
    return value >= min && value <= max
  },

  /**
   * 驗證是否為正整數
   */
  isPositiveInteger (value) {
    return this.isNumber(value) && Number.isInteger(value) && value > 0
  },

  /**
   * 驗證是否為非負數
   */
  isNonNegativeNumber (value) {
    return this.isNumber(value) && value >= 0
  },

  // ==================== 日期驗證 ====================

  /**
   * 驗證日期格式
   */
  isValidDate (value) {
    if (!value) return false

    // 如果已經是 Date 物件
    if (value instanceof Date) {
      return !isNaN(value.getTime())
    }

    // 如果是字串，嘗試轉換
    if (this.isString(value)) {
      const date = new Date(value)
      return !isNaN(date.getTime())
    }

    return false
  },

  /**
   * 驗證 ISO 日期格式
   */
  isValidISODate (value) {
    if (!this.isString(value)) return false
    return ISO_DATE_REGEX.test(value)
  },

  // ==================== Chrome Extension 特定驗證 ====================

  /**
   * 驗證 Chrome Extension ID 格式
   */
  isValidExtensionId (value) {
    if (!this.isString(value)) return false
    return EXTENSION_ID_REGEX.test(value)
  },

  /**
   * 驗證 Tab ID
   */
  isValidTabId (value) {
    return this.isPositiveInteger(value)
  },

  /**
   * 驗證 Window ID
   */
  isValidWindowId (value) {
    return this.isPositiveInteger(value)
  },

  // ==================== 書籍資料驗證 ====================

  /**
   * 驗證 ISBN 格式（10 或 13 位數）
   */
  isValidISBN (value) {
    if (!this.isString(value) || value.length === 0) return false

    // 移除破折號和空格
    const cleanISBN = value.replace(ISBN_CLEANUP_REGEX, '')

    // 檢查長度（10 或 13 位數）
    return cleanISBN.length === 10 || cleanISBN.length === 13
  },

  /**
   * 驗證評分範圍（0-5）
   */
  isValidRating (value) {
    return this.isNumberInRange(value, 0, 5)
  },

  /**
   * 驗證進度百分比（0-100）
   */
  isValidProgress (value) {
    return this.isNumberInRange(value, 0, 100)
  },

  // ==================== 複合驗證 ====================

  /**
   * 驗證必填欄位
   */
  validateRequiredFields (data, requiredFields) {
    if (!this.isObject(data) || !this.isArray(requiredFields)) {
      return {
        isValid: false,
        missingFields: requiredFields || []
      }
    }

    const missingFields = requiredFields.filter(field => {
      const value = data[field]
      return value === undefined || value === null || value === ''
    })

    return {
      isValid: missingFields.length === 0,
      missingFields
    }
  },

  /**
   * 驗證物件結構
   */
  validateSchema (data, schema) {
    if (!this.isObject(data) || !this.isObject(schema)) {
      return {
        isValid: false,
        errors: [{ field: 'root', message: '資料或結構定義無效' }]
      }
    }

    const errors = []

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field]

      // 檢查必填欄位
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field,
          message: `欄位 ${field} 為必填`
        })
        continue
      }

      // 如果欄位存在，檢查類型
      if (value !== undefined && value !== null) {
        if (!this.validateFieldType(value, rules.type)) {
          errors.push({
            field,
            message: `欄位 ${field} 類型錯誤，預期: ${rules.type}`
          })
        }

        // 檢查數字範圍
        if (rules.type === 'number' && this.isNumber(value)) {
          if (rules.min !== undefined && value < rules.min) {
            errors.push({
              field,
              message: `欄位 ${field} 範圍錯誤，最小值: ${rules.min}`
            })
          }
          if (rules.max !== undefined && value > rules.max) {
            errors.push({
              field,
              message: `欄位 ${field} 範圍錯誤，最大值: ${rules.max}`
            })
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  },

  /**
   * 驗證欄位類型
   */
  validateFieldType (value, expectedType) {
    switch (expectedType) {
      case 'string':
        return this.isString(value)
      case 'number':
        return this.isNumber(value)
      case 'boolean':
        return this.isBoolean(value)
      case 'array':
        return this.isArray(value)
      case 'object':
        return this.isObject(value)
      default:
        return false
    }
  },

  // ==================== 清理和標準化 ====================

  /**
   * 清理和標準化字串
   */
  sanitizeString (value) {
    if (value === null || value === undefined) return ''
    return String(value).trim()
  },

  /**
   * 標準化 ISBN
   */
  normalizeISBN (value) {
    if (!this.isString(value)) return ''
    return value.replace(ISBN_CLEANUP_REGEX, '').trim()
  },

  /**
   * 標準化電話號碼
   */
  normalizePhone (value) {
    if (!this.isString(value)) return ''

    // 提取所有數字和相關字符
    const digits = value.match(PHONE_REGEX)
    if (!digits) return ''

    // 移除所有非數字字符
    const cleanDigits = digits.join('').replace(/\D/g, '')

    // 基本長度檢查
    if (cleanDigits.length < 7 || cleanDigits.length > 15) return ''

    return cleanDigits
  }
}

module.exports = ValidationUtils
