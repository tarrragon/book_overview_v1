'use strict'

/**
 * book interchange 共用驗證 helper（單一真值來源，ARCH-020）
 *
 * 抽取自 book-interchange-v1-adapter（assertRequiredBook）與 v1-to-v2-converter
 * （convertV1ToV2Book / convertAppLegacyToV2Book）三處字面複寫的 id/title 驗證，
 * 消除重複定義導致的「驗證行為漂移」風險（ARCH-020 duplicate validation logic）。
 *
 * 契約（零行為改變，對齊原三處共同行為）：
 * - 非 plain object（null / 非物件 / 陣列）→ throw BookValidationError
 *   failures: [{ field: 'book', message: 'Input must be an object' }]
 * - 缺 id / title → throw BookValidationError，收集 missing 欄位
 *   failures: [{ field: 'id'|'title', message: 'Required field missing' }]
 *
 * 設計來源：ticket 0.19.0-W4-032（source 0.19.0-W4-031.2 Phase 4a linux 評估）。
 */

const { BookValidationError } = require('../core/errors/BookValidationError')

/**
 * 判斷值是否為 plain object（排除 null、陣列、原始型別）。
 *
 * @param {*} value - 待判斷值
 * @returns {boolean} 是 plain object 回 true
 */
function isPlainObject (value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * 驗證 book 為 plain object 且具備 id/title 必要欄位，否則 throw BookValidationError。
 *
 * @param {Object} book - 待驗證 book 物件
 * @throws {BookValidationError} 非 plain object，或缺 id / title
 */
function assertBookHasIdTitle (book) {
  if (!isPlainObject(book)) {
    throw new BookValidationError(book, [{ field: 'book', message: 'Input must be an object' }])
  }
  if (!book.id || !book.title) {
    const missing = []
    if (!book.id) missing.push({ field: 'id', message: 'Required field missing' })
    if (!book.title) missing.push({ field: 'title', message: 'Required field missing' })
    throw new BookValidationError(book, missing)
  }
}

module.exports = {
  isPlainObject,
  assertBookHasIdTitle
}
