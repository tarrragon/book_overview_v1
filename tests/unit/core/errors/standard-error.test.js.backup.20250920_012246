/**
 * StandardError 類別單元測試
 *
 * 測試目標：
 * - 驗證 StandardError 核心功能
 * - 測試邊界條件和異常處理
 * - 確保效能指標（建立時間 < 1ms）
 * - 驗證序列化和反序列化
 */

const { StandardError } = require('src/core/errors/StandardError')

describe('StandardError 核心功能', () => {
  let mockDateNow
  let mockMathRandom

  beforeEach(() => {
    // Mock Date.now 以獲得可預測的時間戳
    mockDateNow = jest.spyOn(Date, 'now').mockReturnValue(1693747200000) // 2025-09-03 12:00:00 UTC

    // Mock Math.random 以獲得可預測的ID
    mockMathRandom = jest.spyOn(Math, 'random').mockReturnValue(0.123456789)
  })

  afterEach(() => {
    mockDateNow.mockRestore()
    mockMathRandom.mockRestore()
  })

  test('應該正確建立標準錯誤物件', () => {
    // Given: 基本錯誤參數
    const code = 'TEST_ERROR'
    const message = '測試錯誤訊息'
    const details = { field: 'testField', value: 'testValue' }

    // When: 建立StandardError實例
    const error = new StandardError(code, message, details)

    // Then: 驗證錯誤物件結構
    expect(error.code).toBe(code)
    expect(error.message).toBe(message)
    expect(error.details).toEqual(details)
    expect(error.timestamp).toBe(1693747200000)
    // 驗證 ID 格式而非具體值（因為包含隨機部分）
    expect(error.id).toMatch(/^err_1693747200000_[a-z0-9]+$/)
  })

  test('應該繼承自 Error 類別', () => {
    // Given: StandardError 實例
    const error = new StandardError('INHERITANCE_TEST', '繼承測試')

    // Then: 驗證繼承關係
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(StandardError)
    expect(error.name).toBe('StandardError')
    expect(error.stack).toBeDefined() // 應該有 stack trace
    expect(typeof error.stack).toBe('string')
  })

  test('應該支援JSON序列化和反序列化', () => {
    // Given: 原始錯誤物件
    const originalError = new StandardError('SERIALIZE_TEST', '序列化測試', { test: true })

    // When: 執行JSON轉換
    const json = originalError.toJSON()
    const restoredError = StandardError.fromJSON(json)

    // Then: 驗證序列化完整性
    expect(restoredError.code).toBe(originalError.code)
    expect(restoredError.message).toBe(originalError.message)
    expect(restoredError.details).toEqual(originalError.details)
    expect(restoredError.timestamp).toBe(originalError.timestamp)
    expect(restoredError.id).toBe(originalError.id)
  })

  test('應該正確轉換為字串', () => {
    // Given: 錯誤物件
    const error = new StandardError('STRING_TEST', '字串測試')

    // When: 轉換為字串
    const errorString = error.toString()

    // Then: 驗證字串格式
    expect(errorString).toBe('StandardError [STRING_TEST]: 字串測試')
  })
})

describe('StandardError 邊界條件', () => {
  test('應該處理空值和無效參數', () => {
    // Given: 空值或無效參數的測試場景
    const scenarios = [
      { code: null, message: null, details: null, expectedCode: 'UNKNOWN_ERROR', expectedMessage: 'Unknown error' },
      { code: '', message: '', details: undefined, expectedCode: 'UNKNOWN_ERROR', expectedMessage: 'Unknown error' },
      { code: undefined, message: undefined, details: 'string', expectedCode: 'UNKNOWN_ERROR', expectedMessage: 'Unknown error' }
    ]

    scenarios.forEach(({ code, message, details, expectedCode, expectedMessage }) => {
      // When: 建立錯誤物件
      const error = new StandardError(code, message, details)

      // Then: 驗證預設值處理
      expect(error.code).toBe(expectedCode)
      expect(error.message).toBe(expectedMessage)
      expect(typeof error.details).toBe('object')
    })
  })

  test('應該處理循環參照的details物件', () => {
    // Given: 包含循環參照的物件
    const circularObj = { name: 'test' }
    circularObj.self = circularObj

    // When: 建立包含循環參照的錯誤
    const error = new StandardError('CIRCULAR_TEST', '循環參照測試', circularObj)

    // Then: JSON序列化應該成功（不拋出異常）
    expect(() => error.toJSON()).not.toThrow()
    const json = error.toJSON()
    expect(json.details).toBeDefined()
    expect(json.details.self).toBe('[Circular Reference]')
  })

  test('應該限制details物件大小', () => {
    // Given: 超大的details物件
    const largeDetails = {
      data: 'x'.repeat(20 * 1024) // 20KB資料
    }

    // When: 建立包含大型資料的錯誤
    const error = new StandardError('LARGE_DETAILS_TEST', '大型資料測試', largeDetails)
    const json = JSON.stringify(error.toJSON())

    // Then: 序列化後大小應該合理（被截斷）
    expect(json.length).toBeLessThan(16 * 1024) // 小於16KB (留一些buffer)
  })

  test('應該處理非物件類型的details參數', () => {
    // Given: 非物件類型的details
    const testCases = [
      { details: 'string_value', expected: { value: 'string_value' } },
      { details: 123, expected: { value: 123 } },
      { details: true, expected: { value: true } }
    ]

    testCases.forEach(({ details, expected }) => {
      // When: 建立錯誤物件
      const error = new StandardError('TYPE_TEST', '類型測試', details)

      // Then: 驗證details被正確處理
      expect(error.details).toEqual(expected)
    })
  })
})

describe('StandardError 異常處理', () => {
  test('generateId方法在時間異常時的處理', () => {
    // Given: Mock Date.now 拋出異常（避免遞迴）
    const originalDateNow = Date.now
    Date.now = jest.fn(() => { throw new Error('Time error') })

    try {
      // When: 建立錯誤物件
      const error = new StandardError('TIME_ERROR_TEST', '時間異常測試')

      // Then: 不應該拋出異常，且應該有後備ID
      expect(error.id).toMatch(/^err_fallback_[a-z0-9]+$/)
    } finally {
      // 清理Mock
      Date.now = originalDateNow
    }
  })

  test('fromJSON應該處理無效的JSON資料', () => {
    // Given: 無效的JSON資料
    const invalidJsonCases = [
      null,
      undefined,
      'string',
      123,
      []
    ]

    invalidJsonCases.forEach(invalidJson => {
      // When & Then: fromJSON應該拋出StandardError
      expect(() => StandardError.fromJSON(invalidJson)).toThrow()

      try {
        StandardError.fromJSON(invalidJson)
      } catch (error) {
        expect(error).toBeInstanceOf(StandardError)
        expect(error.code).toBe('INVALID_JSON_DATA')
        expect(error.details.receivedType).toBe(typeof invalidJson)
        // 只有非 undefined 值才檢查 receivedValue
        if (invalidJson !== undefined) {
          if (Array.isArray(invalidJson)) {
            expect(error.details.receivedValue).toEqual(invalidJson)
          } else {
            expect(error.details.receivedValue).toBe(invalidJson)
          }
        }
      }
    })
  })

  test('toJSON應該處理超大物件的截斷', () => {
    // Given: 包含超大字串的details
    const hugeDetails = {
      largeField: 'x'.repeat(20 * 1024), // 20KB字串
      normalField: 'normal value',
      anotherLargeField: 'y'.repeat(10 * 1024) // 10KB字串
    }

    // When: 序列化超大錯誤物件
    const error = new StandardError('HUGE_DETAILS_TEST', '超大細節測試', hugeDetails)
    const json = error.toJSON()

    // Then: 大字串應該被截斷
    expect(json.details._truncated).toBe(true)
    expect(json.details._originalSize).toBeGreaterThan(15 * 1024)
    expect(json.details.largeField).toMatch(/^x+\.\.\. \[truncated\]$/)
    expect(json.details.anotherLargeField).toMatch(/^y+\.\.\. \[truncated\]$/)
    expect(json.details.normalField).toBe('normal value') // 正常欄位不受影響
  })
})

describe('StandardError 效能測試', () => {
  test('錯誤物件建立應該在1ms內完成', () => {
    // Given: 測試資料
    const testData = { field: 'test', value: 123, nested: { data: 'nested' } }

    // When: 測量建立時間
    const start = process.hrtime.bigint()
    const error = new StandardError('PERFORMANCE_TEST', '效能測試', testData)
    const end = process.hrtime.bigint()

    const durationMs = Number(end - start) / 1000000 // 轉換為毫秒

    // Then: 建立時間應該小於1ms
    expect(durationMs).toBeLessThan(1)
    expect(error.code).toBe('PERFORMANCE_TEST')
  })

  test('JSON序列化應該在合理時間內完成', () => {
    // Given: 中等大小的錯誤物件
    const mediumDetails = {
      books: Array.from({ length: 100 }, (_, i) => ({
        id: `book_${i}`,
        title: `測試書籍 ${i}`,
        progress: Math.random() * 100
      }))
    }

    const error = new StandardError('JSON_PERF_TEST', 'JSON效能測試', mediumDetails)

    // When: 測量序列化時間
    const start = process.hrtime.bigint()
    const json = error.toJSON()
    const end = process.hrtime.bigint()

    const durationMs = Number(end - start) / 1000000

    // Then: 序列化時間應該合理
    expect(durationMs).toBeLessThan(5) // 5ms內
    expect(json.code).toBe('JSON_PERF_TEST')
    expect(json.details.books).toHaveLength(100)
  })
})

describe('StandardError 記憶體使用', () => {
  test('單個錯誤物件記憶體使用應該合理', () => {
    // Given: 標準大小的錯誤物件
    const details = {
      operation: 'test',
      context: { url: 'https://example.com', method: 'GET' }
    }

    // When: 建立錯誤物件
    const error = new StandardError('MEMORY_TEST', '記憶體測試', details)

    // Then: 估算記憶體使用（透過JSON序列化）
    // 注意: 包含 stack trace 後大小會增加，但應該保持合理範圍
    const serializedSize = JSON.stringify(error.toJSON()).length
    expect(serializedSize).toBeLessThan(3 * 1024) // 小於3KB (包含 stack trace)

    // 確保基本屬性存在
    const json = error.toJSON()
    expect(json.name).toBe('StandardError')
    expect(json.code).toBe('MEMORY_TEST')
    expect(json.stack).toBeDefined() // 應該包含 stack trace
    expect(typeof json.stack).toBe('string')
  })
})
