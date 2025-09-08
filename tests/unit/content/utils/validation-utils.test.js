/**
 * validation-utils.test.js
 *
 * 測試 validation-utils 工具模組
 * 負責測試通用資料驗證功能
 */

describe('ValidationUtils', () => {
  let ValidationUtils

  beforeEach(() => {
    jest.clearAllMocks()
    ValidationUtils = require('src/content/utils/validation-utils')
  })

  describe('基本資料類型驗證', () => {
    test('驗證字串類型', () => {
      expect(ValidationUtils.isString('test')).toBe(true)
      expect(ValidationUtils.isString('')).toBe(true)
      expect(ValidationUtils.isString(123)).toBe(false)
      expect(ValidationUtils.isString(null)).toBe(false)
      expect(ValidationUtils.isString(undefined)).toBe(false)
    })

    test('驗證數字類型', () => {
      expect(ValidationUtils.isNumber(123)).toBe(true)
      expect(ValidationUtils.isNumber(0)).toBe(true)
      expect(ValidationUtils.isNumber(-123)).toBe(true)
      expect(ValidationUtils.isNumber(123.45)).toBe(true)
      expect(ValidationUtils.isNumber('123')).toBe(false)
      expect(ValidationUtils.isNumber(null)).toBe(false)
      expect(ValidationUtils.isNumber(NaN)).toBe(false)
    })

    test('驗證布林類型', () => {
      expect(ValidationUtils.isBoolean(true)).toBe(true)
      expect(ValidationUtils.isBoolean(false)).toBe(true)
      expect(ValidationUtils.isBoolean(1)).toBe(false)
      expect(ValidationUtils.isBoolean(0)).toBe(false)
      expect(ValidationUtils.isBoolean('true')).toBe(false)
    })

    test('驗證陣列類型', () => {
      expect(ValidationUtils.isArray([])).toBe(true)
      expect(ValidationUtils.isArray([1, 2, 3])).toBe(true)
      expect(ValidationUtils.isArray('array')).toBe(false)
      expect(ValidationUtils.isArray({})).toBe(false)
      expect(ValidationUtils.isArray(null)).toBe(false)
    })

    test('驗證物件類型', () => {
      expect(ValidationUtils.isObject({})).toBe(true)
      expect(ValidationUtils.isObject({ key: 'value' })).toBe(true)
      expect(ValidationUtils.isObject([])).toBe(false)
      expect(ValidationUtils.isObject(null)).toBe(false)
      expect(ValidationUtils.isObject('object')).toBe(false)
    })
  })

  describe('字串驗證', () => {
    test('驗證非空字串', () => {
      expect(ValidationUtils.isNonEmptyString('test')).toBe(true)
      expect(ValidationUtils.isNonEmptyString('   test   ')).toBe(true)
      expect(ValidationUtils.isNonEmptyString('')).toBe(false)
      expect(ValidationUtils.isNonEmptyString('   ')).toBe(false)
      expect(ValidationUtils.isNonEmptyString(123)).toBe(false)
      expect(ValidationUtils.isNonEmptyString(null)).toBe(false)
    })

    test('驗證字串長度範圍', () => {
      expect(ValidationUtils.isStringLengthInRange('test', 1, 10)).toBe(true)
      expect(ValidationUtils.isStringLengthInRange('test', 4, 4)).toBe(true)
      expect(ValidationUtils.isStringLengthInRange('test', 5, 10)).toBe(false)
      expect(ValidationUtils.isStringLengthInRange('test', 1, 3)).toBe(false)
      expect(ValidationUtils.isStringLengthInRange(123, 1, 10)).toBe(false)
    })

    test('驗證 URL 格式', () => {
      expect(ValidationUtils.isValidURL('https://example.com')).toBe(true)
      expect(ValidationUtils.isValidURL('http://example.com')).toBe(true)
      expect(ValidationUtils.isValidURL('ftp://example.com')).toBe(true)
      expect(ValidationUtils.isValidURL('example.com')).toBe(false)
      expect(ValidationUtils.isValidURL('not-a-url')).toBe(false)
      expect(ValidationUtils.isValidURL('')).toBe(false)
      expect(ValidationUtils.isValidURL(null)).toBe(false)
    })

    test('驗證電子郵件格式', () => {
      expect(ValidationUtils.isValidEmail('test@example.com')).toBe(true)
      expect(ValidationUtils.isValidEmail('user.name@domain.co.uk')).toBe(true)
      expect(ValidationUtils.isValidEmail('test@domain')).toBe(false)
      expect(ValidationUtils.isValidEmail('test.domain.com')).toBe(false)
      expect(ValidationUtils.isValidEmail('')).toBe(false)
      expect(ValidationUtils.isValidEmail(null)).toBe(false)
    })
  })

  describe('數字驗證', () => {
    test('驗證數字範圍', () => {
      expect(ValidationUtils.isNumberInRange(5, 1, 10)).toBe(true)
      expect(ValidationUtils.isNumberInRange(1, 1, 10)).toBe(true)
      expect(ValidationUtils.isNumberInRange(10, 1, 10)).toBe(true)
      expect(ValidationUtils.isNumberInRange(0, 1, 10)).toBe(false)
      expect(ValidationUtils.isNumberInRange(11, 1, 10)).toBe(false)
      expect(ValidationUtils.isNumberInRange('5', 1, 10)).toBe(false)
    })

    test('驗證正整數', () => {
      expect(ValidationUtils.isPositiveInteger(1)).toBe(true)
      expect(ValidationUtils.isPositiveInteger(100)).toBe(true)
      expect(ValidationUtils.isPositiveInteger(0)).toBe(false)
      expect(ValidationUtils.isPositiveInteger(-1)).toBe(false)
      expect(ValidationUtils.isPositiveInteger(1.5)).toBe(false)
      expect(ValidationUtils.isPositiveInteger('1')).toBe(false)
    })

    test('驗證非負數', () => {
      expect(ValidationUtils.isNonNegativeNumber(0)).toBe(true)
      expect(ValidationUtils.isNonNegativeNumber(1)).toBe(true)
      expect(ValidationUtils.isNonNegativeNumber(1.5)).toBe(true)
      expect(ValidationUtils.isNonNegativeNumber(-1)).toBe(false)
      expect(ValidationUtils.isNonNegativeNumber('0')).toBe(false)
    })
  })

  describe('日期驗證', () => {
    test('驗證日期格式', () => {
      expect(ValidationUtils.isValidDate('2023-01-01')).toBe(true)
      expect(ValidationUtils.isValidDate('2023/01/01')).toBe(true)
      expect(ValidationUtils.isValidDate('Jan 1, 2023')).toBe(true)
      expect(ValidationUtils.isValidDate(new Date())).toBe(true)
      expect(ValidationUtils.isValidDate('invalid-date')).toBe(false)
      expect(ValidationUtils.isValidDate('')).toBe(false)
      expect(ValidationUtils.isValidDate(null)).toBe(false)
    })

    test('驗證 ISO 日期格式', () => {
      expect(ValidationUtils.isValidISODate('2023-01-01T00:00:00.000Z')).toBe(true)
      expect(ValidationUtils.isValidISODate('2023-01-01T12:30:45Z')).toBe(true)
      expect(ValidationUtils.isValidISODate('2023-01-01')).toBe(false)
      expect(ValidationUtils.isValidISODate('invalid')).toBe(false)
    })
  })

  describe('Chrome Extension 特定驗證', () => {
    test('驗證 Chrome Extension ID', () => {
      const validId = 'abcdefghijklmnopabcdefghijklmnop'
      const invalidId = 'invalid-id'

      expect(ValidationUtils.isValidExtensionId(validId)).toBe(true)
      expect(ValidationUtils.isValidExtensionId(invalidId)).toBe(false)
      expect(ValidationUtils.isValidExtensionId('')).toBe(false)
      expect(ValidationUtils.isValidExtensionId(null)).toBe(false)
    })

    test('驗證 Tab ID', () => {
      expect(ValidationUtils.isValidTabId(1)).toBe(true)
      expect(ValidationUtils.isValidTabId(123)).toBe(true)
      expect(ValidationUtils.isValidTabId(0)).toBe(false)
      expect(ValidationUtils.isValidTabId(-1)).toBe(false)
      expect(ValidationUtils.isValidTabId('1')).toBe(false)
      expect(ValidationUtils.isValidTabId(null)).toBe(false)
    })

    test('驗證 Window ID', () => {
      expect(ValidationUtils.isValidWindowId(1)).toBe(true)
      expect(ValidationUtils.isValidWindowId(123)).toBe(true)
      expect(ValidationUtils.isValidWindowId(0)).toBe(false)
      expect(ValidationUtils.isValidWindowId(-1)).toBe(false)
      expect(ValidationUtils.isValidWindowId('1')).toBe(false)
    })
  })

  describe('書籍資料驗證', () => {
    test('驗證 ISBN 格式', () => {
      expect(ValidationUtils.isValidISBN('9781234567890')).toBe(true)
      expect(ValidationUtils.isValidISBN('1234567890')).toBe(true)
      expect(ValidationUtils.isValidISBN('978-1-234-56789-0')).toBe(true)
      expect(ValidationUtils.isValidISBN('1-234-56789-0')).toBe(true)
      expect(ValidationUtils.isValidISBN('123456789')).toBe(false)
      expect(ValidationUtils.isValidISBN('invalid-isbn')).toBe(false)
      expect(ValidationUtils.isValidISBN('')).toBe(false)
    })

    test('驗證評分範圍', () => {
      expect(ValidationUtils.isValidRating(0)).toBe(true)
      expect(ValidationUtils.isValidRating(2.5)).toBe(true)
      expect(ValidationUtils.isValidRating(5)).toBe(true)
      expect(ValidationUtils.isValidRating(-1)).toBe(false)
      expect(ValidationUtils.isValidRating(6)).toBe(false)
      expect(ValidationUtils.isValidRating('3')).toBe(false)
    })

    test('驗證進度百分比', () => {
      expect(ValidationUtils.isValidProgress(0)).toBe(true)
      expect(ValidationUtils.isValidProgress(50.5)).toBe(true)
      expect(ValidationUtils.isValidProgress(100)).toBe(true)
      expect(ValidationUtils.isValidProgress(-1)).toBe(false)
      expect(ValidationUtils.isValidProgress(101)).toBe(false)
      expect(ValidationUtils.isValidProgress('50')).toBe(false)
    })
  })

  describe('複合驗證', () => {
    test('驗證必填欄位', () => {
      const data = {
        name: 'test',
        age: 25,
        email: 'test@example.com'
      }
      const requiredFields = ['name', 'age', 'email']

      expect(ValidationUtils.validateRequiredFields(data, requiredFields)).toEqual({
        isValid: true,
        missingFields: []
      })

      const incompleteData = {
        name: 'test'
      }

      expect(ValidationUtils.validateRequiredFields(incompleteData, requiredFields)).toEqual({
        isValid: false,
        missingFields: ['age', 'email']
      })
    })

    test('驗證物件結構', () => {
      const schema = {
        name: { type: 'string', required: true },
        age: { type: 'number', required: true, min: 0, max: 150 },
        email: { type: 'string', required: false }
      }

      const validData = {
        name: 'John',
        age: 25,
        email: 'john@example.com'
      }

      const result = ValidationUtils.validateSchema(validData, schema)
      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
    })

    test('驗證物件結構 - 錯誤情況', () => {
      const schema = {
        name: { type: 'string', required: true },
        age: { type: 'number', required: true, min: 0, max: 150 }
      }

      const invalidData = {
        name: 123,
        age: -5
      }

      const result = ValidationUtils.validateSchema(invalidData, schema)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(2)
      expect(result.errors[0]).toMatchObject({
        field: 'name',
        message: expect.stringContaining('類型錯誤')
      })
      expect(result.errors[1]).toMatchObject({
        field: 'age',
        message: expect.stringContaining('範圍錯誤')
      })
    })

    test('驗證物件結構 - 必填欄位錯誤', () => {
      const schema = {
        name: { type: 'string', required: true },
        email: { type: 'string', required: true }
      }

      const incompleteData = {
        name: '', // 空字串
        email: null // null 值
      }

      const result = ValidationUtils.validateSchema(incompleteData, schema)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(2)
      expect(result.errors[0]).toMatchObject({
        field: 'name',
        message: expect.stringContaining('為必填')
      })
      expect(result.errors[1]).toMatchObject({
        field: 'email',
        message: expect.stringContaining('為必填')
      })
    })

    test('驗證物件結構 - 數字範圍邊界', () => {
      const schema = {
        score: { type: 'number', required: false, min: 0, max: 100 }
      }

      // 測試超出最大值
      const maxData = { score: 150 }
      const maxResult = ValidationUtils.validateSchema(maxData, schema)
      expect(maxResult.isValid).toBe(false)
      expect(maxResult.errors[0]).toMatchObject({
        field: 'score',
        message: expect.stringContaining('最大值')
      })

      // 測試低於最小值
      const minData = { score: -10 }
      const minResult = ValidationUtils.validateSchema(minData, schema)
      expect(minResult.isValid).toBe(false)
      expect(minResult.errors[0]).toMatchObject({
        field: 'score',
        message: expect.stringContaining('最小值')
      })
    })

    test('驗證所有基本類型的 validateFieldType', () => {
      expect(ValidationUtils.validateFieldType('test', 'string')).toBe(true)
      expect(ValidationUtils.validateFieldType(123, 'number')).toBe(true)
      expect(ValidationUtils.validateFieldType(true, 'boolean')).toBe(true)
      expect(ValidationUtils.validateFieldType([], 'array')).toBe(true)
      expect(ValidationUtils.validateFieldType({}, 'object')).toBe(true)
    })
  })

  describe('清理和標準化', () => {
    test('清理和標準化字串', () => {
      expect(ValidationUtils.sanitizeString('  test  ')).toBe('test')
      expect(ValidationUtils.sanitizeString('')).toBe('')
      expect(ValidationUtils.sanitizeString(null)).toBe('')
      expect(ValidationUtils.sanitizeString(123)).toBe('123')
    })

    test('標準化 ISBN', () => {
      expect(ValidationUtils.normalizeISBN('978-1-234-56789-0')).toBe('9781234567890')
      expect(ValidationUtils.normalizeISBN('1-234-56789-0')).toBe('1234567890')
      expect(ValidationUtils.normalizeISBN('  978 1 234 56789 0  ')).toBe('9781234567890')
      expect(ValidationUtils.normalizeISBN('')).toBe('')
    })

    test('標準化電話號碼', () => {
      expect(ValidationUtils.normalizePhone('+1 (234) 567-8900')).toBe('12345678900')
      expect(ValidationUtils.normalizePhone('234.567.8900')).toBe('2345678900')
      expect(ValidationUtils.normalizePhone('invalid')).toBe('')
    })
  })

  describe('錯誤處理', () => {
    test('處理無效輸入時不拋出錯誤', () => {
      expect(() => ValidationUtils.isString(undefined)).not.toThrow()
      expect(() => ValidationUtils.isNumber(null)).not.toThrow()
      expect(() => ValidationUtils.isValidURL({})).not.toThrow()
      expect(() => ValidationUtils.isValidEmail([])).not.toThrow()
    })

    test('處理極端情況', () => {
      expect(ValidationUtils.isStringLengthInRange('', 0, 0)).toBe(true)
      expect(ValidationUtils.isNumberInRange(Infinity, 0, 100)).toBe(false)
      expect(ValidationUtils.isNumberInRange(-Infinity, 0, 100)).toBe(false)
    })

    test('處理 URL 建構函數異常', () => {
      // 測試 URL 建構函數拋出異常的情況
      expect(ValidationUtils.isValidURL('://invalid-url')).toBe(false)
      expect(ValidationUtils.isValidURL('not-a-url')).toBe(false)
    })

    test('處理日期驗證邊界情況', () => {
      expect(ValidationUtils.isValidDate(123)).toBe(false)
      expect(ValidationUtils.isValidDate({})).toBe(false)
      expect(ValidationUtils.isValidDate([])).toBe(false)
    })

    test('處理電話號碼無效情況', () => {
      expect(ValidationUtils.normalizePhone('abc')).toBe('')
      expect(ValidationUtils.normalizePhone('123')).toBe('') // 太短
      expect(ValidationUtils.normalizePhone('12345678901234567890')).toBe('') // 太長
    })
  })

  describe('複合驗證邊界情況', () => {
    test('validateRequiredFields 處理無效輸入', () => {
      expect(ValidationUtils.validateRequiredFields(null, ['field'])).toEqual({
        isValid: false,
        missingFields: ['field']
      })

      expect(ValidationUtils.validateRequiredFields({}, null)).toEqual({
        isValid: false,
        missingFields: []
      })

      expect(ValidationUtils.validateRequiredFields('not-object', ['field'])).toEqual({
        isValid: false,
        missingFields: ['field']
      })
    })

    test('validateSchema 處理無效輸入', () => {
      expect(ValidationUtils.validateSchema(null, {})).toEqual({
        isValid: false,
        errors: [{ field: 'root', message: '資料或結構定義無效' }]
      })

      expect(ValidationUtils.validateSchema({}, null)).toEqual({
        isValid: false,
        errors: [{ field: 'root', message: '資料或結構定義無效' }]
      })

      expect(ValidationUtils.validateSchema('not-object', {})).toEqual({
        isValid: false,
        errors: [{ field: 'root', message: '資料或結構定義無效' }]
      })
    })

    test('validateFieldType 處理未知類型', () => {
      expect(ValidationUtils.validateFieldType('test', 'unknown')).toBe(false)
      expect(ValidationUtils.validateFieldType(123, 'custom')).toBe(false)
    })
  })
})
