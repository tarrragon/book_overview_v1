/**
 * 錯誤斷言輔助函數 - ErrorCodes機制專用
 *
 * 設計目的：
 * - 支援StandardError → ErrorCodes遷移
 * - 提供一致的錯誤驗證邏輯
 * - 簡化測試程式碼撰寫
 *
 * 使用方式：
 * ```javascript
 * const { expectErrorWithCode, expectErrorDetails } = require('tests/helpers/error-assertions')
 *
 * // 基本錯誤代碼驗證
 * await expectErrorWithCode(
 *   () => service.validateInput({}),
 *   ErrorCodes.VALIDATION_ERROR,
 *   '必填欄位缺失'
 * )
 *
 * // 詳細錯誤內容驗證
 * const error = await getError(() => service.process())
 * expectErrorDetails(error, {
 *   code: ErrorCodes.OPERATION_ERROR,
 *   message: '操作失敗',
 *   details: { category: 'system' }
 * })
 * ```
 */

const ErrorCodes = require('src/core/errors/ErrorCodes')

/**
 * 驗證拋出錯誤符合ErrorCodes規範
 * @param {Function|Promise} fn - 要執行的函數或Promise
 * @param {string} expectedCode - 期望的錯誤代碼
 * @param {string} [expectedMessage] - 期望的錯誤訊息（可選）
 * @returns {Promise<Error>} - 捕獲的錯誤物件
 */
async function expectErrorWithCode(fn, expectedCode, expectedMessage) {
  let caughtError

  try {
    if (typeof fn === 'function') {
      await fn()
    } else {
      await fn  // 假設是 Promise
    }
    throw new Error('Expected function to throw an error, but it did not')
  } catch (error) {
    caughtError = error
  }

  // 驗證錯誤是標準Error實例
  expect(caughtError).toBeInstanceOf(Error)

  // 驗證錯誤代碼
  expect(caughtError.code).toBe(expectedCode)

  // 可選：驗證錯誤訊息
  if (expectedMessage) {
    expect(caughtError.message).toContain(expectedMessage)
  }

  return caughtError
}

/**
 * 驗證錯誤物件的詳細內容
 * @param {Error} error - 錯誤物件
 * @param {Object} expected - 期望的錯誤屬性
 * @param {string} expected.code - 期望的錯誤代碼
 * @param {string} [expected.message] - 期望的錯誤訊息
 * @param {Object} [expected.details] - 期望的錯誤詳情
 */
function expectErrorDetails(error, expected) {
  expect(error).toBeInstanceOf(Error)
  expect(error.code).toBe(expected.code)

  if (expected.message) {
    expect(error.message).toContain(expected.message)
  }

  if (expected.details) {
    expect(error.details).toEqual(expect.objectContaining(expected.details))
  }
}

/**
 * 捕獲非同步函數的錯誤
 * @param {Function} fn - 要執行的函數
 * @returns {Promise<Error|null>} - 捕獲的錯誤或null
 */
async function getError(fn) {
  try {
    await fn()
    return null
  } catch (error) {
    return error
  }
}

/**
 * 驗證Jest expect.rejects的ErrorCodes相容性
 * 使用方式：await expect(fn()).rejects.toMatchErrorCode(ErrorCodes.VALIDATION_ERROR)
 */
function toMatchErrorCode(received, expectedCode) {
  const pass = received.code === expectedCode

  if (pass) {
    return {
      message: () => `Expected error code not to be ${expectedCode}`,
      pass: true
    }
  } else {
    return {
      message: () => `Expected error code to be ${expectedCode}, but received ${received.code}`,
      pass: false
    }
  }
}

// 擴展Jest匹配器
if (global.expect && global.expect.extend) {
  global.expect.extend({
    toMatchErrorCode
  })
}

module.exports = {
  expectErrorWithCode,
  expectErrorDetails,
  getError,
  toMatchErrorCode,
  ErrorCodes
}