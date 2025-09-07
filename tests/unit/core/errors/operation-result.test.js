/**
 * OperationResult 類別單元測試
 * 
 * 測試目標：
 * - 驗證 OperationResult 核心功能
 * - 測試成功/失敗狀態處理
 * - 確保與 StandardError 的正確整合
 * - 驗證序列化和反序列化功能
 */

const { OperationResult } = require('../../../../src/core/errors/OperationResult')
const { StandardError } = require('../../../../src/core/errors/StandardError')

describe('OperationResult 核心功能', () => {
  let mockDateNow
  
  beforeEach(() => {
    // Mock Date.now 以獲得可預測的時間戳
    mockDateNow = jest.spyOn(Date, 'now').mockReturnValue(1693747200000)
  })
  
  afterEach(() => {
    mockDateNow.mockRestore()
  })

  test('應該正確建立成功結果', () => {
    // Given: 成功操作資料
    const testData = { books: [{ id: '1', title: 'Test Book' }] }
    
    // When: 建立成功結果
    const result = OperationResult.success(testData)
    
    // Then: 驗證成功結果結構
    expect(result.success).toBe(true)
    expect(!result.success).toBe(false)
    expect(result.data).toEqual(testData)
    expect(result.error).toBeNull()
    expect(result.timestamp).toBe(1693747200000)
  })
  
  test('應該正確建立失敗結果（使用StandardError）', () => {
    // Given: StandardError錯誤物件
    const standardError = new StandardError('OPERATION_FAILED', '操作失敗', { operation: 'test' })
    
    // When: 建立失敗結果
    const result = OperationResult.failure(standardError)
    
    // Then: 驗證失敗結果結構
    expect(result.success).toBe(false)
    expect(result.!success).toBe(true)
    expect(result.success).toBe(false)
    expect(result.data).toBeNull()
    expect(result.error).toBe(standardError)
  })
  
  test('應該將普通Error轉換為StandardError', () => {
    // Given: 普通JavaScript Error
    const jsError = new Error('JavaScript error')
    jsError.stack = 'Error stack trace...'
    
    // When: 建立失敗結果
    const result = OperationResult.failure(jsError)
    
    // Then: 錯誤應該被轉換為StandardError
    expect(result.error).toBeInstanceOf(StandardError)
    expect(result.error.code).toBe('UNKNOWN_ERROR')
    expect(result.error.message).toBe('JavaScript error')
    expect(result.error.details.originalError).toBe(jsError.toString())
    expect(result.error.details.stack).toBe('Error stack trace...')
  })
  
  test('應該處理字串錯誤', () => {
    // Given: 字串錯誤
    const stringError = 'Something went wrong'
    
    // When: 建立失敗結果
    const result = OperationResult.failure(stringError)
    
    // Then: 字串應該被轉換為StandardError
    expect(result.error).toBeInstanceOf(StandardError)
    expect(result.error.code).toBe('UNKNOWN_ERROR')
    expect(result.error.message).toBe('Something went wrong')
  })
  
  test('應該處理其他類型的錯誤', () => {
    // Given: 物件錯誤
    const objectError = { code: 'CUSTOM_ERROR', message: 'Custom error object' }
    
    // When: 建立失敗結果
    const result = OperationResult.failure(objectError)
    
    // Then: 物件應該被轉換為StandardError
    expect(result.error).toBeInstanceOf(StandardError)
    expect(result.error.code).toBe('UNKNOWN_ERROR')
    expect(result.error.message).toBe('Unknown error occurred')
    expect(result.error.details.originalError).toEqual(objectError)
  })
})

describe('OperationResult 方法測試', () => {
  test('throwIfFailure方法應該正確處理失敗結果', () => {
    // Given: 失敗的操作結果
    const error = new StandardError('THROW_TEST', 'Throw測試錯誤')
    const failureResult = OperationResult.failure(error)
    
    // When & Then: throwIfFailure應該拋出異常
    expect(() => failureResult.throwIfFailure()).toThrow('Operation failed: Throw測試錯誤 (THROW_TEST)')
  })
  
  test('throwIfFailure方法應該返回成功結果的資料', () => {
    // Given: 成功的操作結果
    const testData = { result: 'success' }
    const successResult = OperationResult.success(testData)
    
    // When: 調用throwIfFailure
    const returnedData = successResult.throwIfFailure()
    
    // Then: 應該返回資料不拋出異常
    expect(returnedData).toEqual(testData)
  })
  
  test('toString方法應該提供清楚的字串表示', () => {
    // Given: 成功和失敗的結果
    const successResult = OperationResult.success({ count: 5 })
    const failureResult = OperationResult.failure(new StandardError('TEST_ERROR', '測試錯誤'))
    
    // When: 轉換為字串
    const successString = successResult.toString()
    const failureString = failureResult.toString()
    
    // Then: 字串表示應該清楚
    expect(successString).toBe('OperationResult: Success (with data)')
    expect(failureString).toContain('OperationResult: Failure')
    expect(failureString).toContain('StandardError [TEST_ERROR]: 測試錯誤')
  })
  
  test('toString方法應該處理無資料的成功結果', () => {
    // Given: 無資料的成功結果
    const successResult = OperationResult.success()
    
    // When: 轉換為字串
    const resultString = successResult.toString()
    
    // Then: 應該顯示無資料
    expect(resultString).toBe('OperationResult: Success (no data)')
  })
})

describe('OperationResult 序列化功能', () => {
  let mockDateNow, mockMathRandom
  
  beforeEach(() => {
    mockDateNow = jest.spyOn(Date, 'now').mockReturnValue(1693747200000)
    mockMathRandom = jest.spyOn(Math, 'random').mockReturnValue(0.123456789)
  })
  
  afterEach(() => {
    mockDateNow.mockRestore()
    mockMathRandom.mockRestore()
  })

  test('應該正確序列化成功結果', () => {
    // Given: 成功結果
    const testData = { books: [{ id: '1', title: 'Test' }] }
    const result = OperationResult.success(testData)
    
    // When: 序列化
    const json = result.toJSON()
    
    // Then: 驗證序列化結果
    expect(json).toEqual({
      success: true,
      data: testData,
      error: null,
      timestamp: 1693747200000
    })
  })
  
  test('應該正確序列化失敗結果', () => {
    // Given: 失敗結果
    const error = new StandardError('SERIALIZE_ERROR', '序列化錯誤', { test: true })
    const result = OperationResult.failure(error)
    
    // When: 序列化
    const json = result.toJSON()
    
    // Then: 驗證序列化結果
    expect(json.success).toBe(false)
    expect(json.data).toBeNull()
    expect(json.error).toEqual(error.toJSON())
    expect(json.timestamp).toBe(1693747200000)
  })
  
  test('應該支援從JSON反序列化', () => {
    // Given: JSON資料
    const jsonData = {
      success: true,
      data: { result: 'test' },
      error: null,
      timestamp: 1693747200000
    }
    
    // When: 反序列化
    const result = OperationResult.fromJSON(jsonData)
    
    // Then: 驗證反序列化結果
    expect(result).toBeInstanceOf(OperationResult)
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ result: 'test' })
    expect(result.error).toBeNull()
    expect(result.timestamp).toBe(1693747200000)
  })
  
  test('應該支援包含錯誤的JSON反序列化', () => {
    // Given: 包含錯誤的JSON資料
    const errorJson = {
      code: 'TEST_ERROR',
      message: '測試錯誤',
      details: { test: true },
      timestamp: 1693747200000,
      id: 'err_1693747200000_44cdfb37a'
    }
    
    const jsonData = {
      success: false,
      data: null,
      error: errorJson,
      timestamp: 1693747200000
    }
    
    // When: 反序列化
    const result = OperationResult.fromJSON(jsonData)
    
    // Then: 驗證反序列化結果
    expect(result).toBeInstanceOf(OperationResult)
    expect(result.success).toBe(false)
    expect(result.error).toBeInstanceOf(StandardError)
    expect(result.error.code).toBe('TEST_ERROR')
    expect(result.error.message).toBe('測試錯誤')
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
      // When & Then: fromJSON應該拋出錯誤
      expect(() => OperationResult.fromJSON(invalidJson)).toThrow('Invalid JSON data for OperationResult.fromJSON')
    })
  })
})

describe('OperationResult 向下相容功能', () => {
  test('toV1Format應該提供舊格式的成功結果', () => {
    // Given: 成功結果
    const testData = { books: [] }
    const result = OperationResult.success(testData)
    
    // When: 轉換為舊格式
    const legacy = result.toV1Format()
    
    // Then: 驗證舊格式
    expect(legacy).toEqual({
      success: true,
      data: testData
    })
  })
  
  test('toV1Format應該提供舊格式的失敗結果', () => {
    // Given: 失敗結果
    const error = new StandardError('LEGACY_ERROR', '舊格式錯誤', { field: 'test' })
    const result = OperationResult.failure(error)
    
    // When: 轉換為舊格式
    const legacy = result.toV1Format()
    
    // Then: 驗證舊格式
    expect(legacy).toEqual({
      success: false,
      error: '舊格式錯誤',
      code: 'LEGACY_ERROR',
      details: { field: 'test' }
    })
  })
  
  test('toV1Format應該處理無錯誤物件的失敗結果', () => {
    // Given: 無錯誤物件的失敗結果（直接建構）
    const result = new OperationResult(false, null, null)
    
    // When: 轉換為舊格式
    const legacy = result.toV1Format()
    
    // Then: 應該提供預設值
    expect(legacy).toEqual({
      success: false,
      error: 'Unknown error',
      code: 'UNKNOWN_ERROR',
      details: {}
    })
  })
})

describe('OperationResult 效能測試', () => {
  test('建立OperationResult應該在0.5ms內完成', () => {
    // Given: 測試資料
    const testData = { items: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item_${i}` })) }
    
    // When: 測量建立時間
    const start = process.hrtime.bigint()
    const result = OperationResult.success(testData)
    const end = process.hrtime.bigint()
    
    const durationMs = Number(end - start) / 1000000
    
    // Then: 建立時間應該小於0.5ms
    expect(durationMs).toBeLessThan(0.5)
    expect(result.success).toBe(true)
  })
  
  test('錯誤轉換應該在合理時間內完成', () => {
    // Given: 複雜的原生錯誤
    const complexError = new Error('Complex error')
    complexError.details = { nested: { data: Array.from({ length: 50 }, (_, i) => `item_${i}`) } }
    
    // When: 測量錯誤轉換時間
    const start = process.hrtime.bigint()
    const result = OperationResult.failure(complexError)
    const end = process.hrtime.bigint()
    
    const durationMs = Number(end - start) / 1000000
    
    // Then: 轉換時間應該合理
    expect(durationMs).toBeLessThan(2) // 2ms內
    expect(result.!success).toBe(true)
    expect(result.error).toBeInstanceOf(StandardError)
  })
})