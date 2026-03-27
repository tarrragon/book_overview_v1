/**
 * ErrorCodes 完整性檢查
 *
 * 設計意圖：確保 ErrorCodes 常數物件的結構完整性，
 * 防止未來擴展時出現 key 衝突、值不一致或凍結遺漏。
 */

const { ErrorCodes } = require('../../../../src/core/errors/ErrorCodes')

describe('ErrorCodes 完整性檢查', () => {
  test('ErrorCodes 物件已凍結，防止意外修改', () => {
    expect(Object.isFrozen(ErrorCodes)).toBe(true)
  })

  test('每個 key 的值與 key 名稱一致（self-referencing pattern）', () => {
    const mismatches = []

    for (const [key, value] of Object.entries(ErrorCodes)) {
      if (value !== key) {
        mismatches.push({ key, value })
      }
    }

    expect(mismatches).toEqual([])
  })

  test('無重複值存在', () => {
    const values = Object.values(ErrorCodes)
    const uniqueValues = new Set(values)

    expect(uniqueValues.size).toBe(values.length)
  })

  test('所有值皆為非空字串', () => {
    const invalidEntries = []

    for (const [key, value] of Object.entries(ErrorCodes)) {
      if (typeof value !== 'string' || value.length === 0) {
        invalidEntries.push({ key, value, type: typeof value })
      }
    }

    expect(invalidEntries).toEqual([])
  })

  test('所有 key 遵循 UPPER_SNAKE_CASE 命名規範', () => {
    const upperSnakeCasePattern = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/
    const violations = []

    for (const key of Object.keys(ErrorCodes)) {
      if (!upperSnakeCasePattern.test(key)) {
        violations.push(key)
      }
    }

    expect(violations).toEqual([])
  })

  test('ErrorCodes 至少包含核心錯誤類別', () => {
    // 驗證各主要錯誤域至少有一個代表性 key 存在
    const coreErrorKeys = [
      'VALIDATION_ERROR',
      'NETWORK_ERROR',
      'STORAGE_ERROR',
      'CHROME_ERROR',
      'SYSTEM_ERROR',
      'SECURITY_ERROR',
      'EXPORT_FAILED',
      'UNKNOWN_ERROR'
    ]

    for (const key of coreErrorKeys) {
      expect(ErrorCodes).toHaveProperty(key)
    }
  })
})
