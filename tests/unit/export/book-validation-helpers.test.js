'use strict'

/**
 * book-validation-helpers 單元測試（ARCH-020 抽取共用驗證 helper）
 *
 * 驗證 assertBookHasIdTitle / isPlainObject 契約，確保抽取後與原三處
 * （adapter assertRequiredBook / converter convertV1ToV2Book / convertAppLegacyToV2Book）
 * 行為等價：非 plain object（null/陣列/原始型別）throw、缺 id/title throw。
 */

const {
  isPlainObject,
  assertBookHasIdTitle
} = require('../../../src/export/book-validation-helpers')
const { BookValidationError } = require('../../../src/core/errors/BookValidationError')

describe('isPlainObject', () => {
  test('plain object → true', () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject({ id: '1' })).toBe(true)
  })

  test('null / 陣列 / 原始型別 → false', () => {
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject([1, 2])).toBe(false)
    expect(isPlainObject('string')).toBe(false)
    expect(isPlainObject(123)).toBe(false)
    expect(isPlainObject(undefined)).toBe(false)
  })
})

describe('assertBookHasIdTitle', () => {
  test('合法 book（含 id+title）→ 不 throw', () => {
    expect(() => assertBookHasIdTitle({ id: '1', title: 'X' })).not.toThrow()
  })

  test('非 plain object（null/陣列/原始型別）→ throw BookValidationError（must be an object）', () => {
    expect(() => assertBookHasIdTitle(null)).toThrow(BookValidationError)
    expect(() => assertBookHasIdTitle([])).toThrow(BookValidationError)
    expect(() => assertBookHasIdTitle(123)).toThrow(BookValidationError)
    expect(() => assertBookHasIdTitle('string')).toThrow(BookValidationError)
  })

  test('非 plain object → failures 為 [{ field: book, message: Input must be an object }]', () => {
    try {
      assertBookHasIdTitle(null)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(BookValidationError)
      expect(e.details.failures).toEqual([{ field: 'book', message: 'Input must be an object' }])
    }
  })

  test('缺 id 或 title → throw BookValidationError', () => {
    expect(() => assertBookHasIdTitle({ title: 'X' })).toThrow(BookValidationError)
    expect(() => assertBookHasIdTitle({ id: '1' })).toThrow(BookValidationError)
    expect(() => assertBookHasIdTitle({})).toThrow(BookValidationError)
  })

  test('缺 id 與 title → failures 收集兩欄位', () => {
    try {
      assertBookHasIdTitle({})
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(BookValidationError)
      expect(e.details.failures).toEqual([
        { field: 'id', message: 'Required field missing' },
        { field: 'title', message: 'Required field missing' }
      ])
    }
  })

  test('僅缺 title → failures 只含 title', () => {
    try {
      assertBookHasIdTitle({ id: '1' })
      throw new Error('should have thrown')
    } catch (e) {
      expect(e.details.failures).toEqual([{ field: 'title', message: 'Required field missing' }])
    }
  })
})
