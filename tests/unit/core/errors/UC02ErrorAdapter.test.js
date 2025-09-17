/**
 * UC02ErrorAdapter 單元測試
 * 
 * 測試目標：
 * - 15個StandardError到ErrorCodes的正確映射
 * - 錯誤轉換邏輯的完整性
 * - 邊界條件和異常情況的處理
 * - 效能和記憶體使用的驗證
 */

import { ErrorCodes } from 'src/core/errors/ErrorCodes.js'
import { UC02ErrorAdapter } from 'src/core/errors/UC02ErrorAdapter.js'

describe('UC02ErrorAdapter - StandardError 轉換測試', () => {
  
  beforeEach(() => {
    // 清除任何快取狀態
    jest.clearAllMocks()
  })

  describe('基本錯誤映射測試', () => {
    
    test('應該正確映射 DATA_DUPLICATE_DETECTION_FAILED 到 VALIDATION_ERROR', () => {
      // Given: 重複檢測失敗的條件
      const originalCode = 'DATA_DUPLICATE_DETECTION_FAILED'
      const message = '重複書籍檢測機制失敗'
      const details = { affectedBooks: ['book_123', 'book_456'] }

      // When: 執行錯誤轉換
      const error = UC02ErrorAdapter.convertError(originalCode, message, details)

      // Then: 驗證轉換結果
      expect(error).toBeInstanceOf(Error)
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.message).toBe(message)
      expect(error.subType).toBe('DUPLICATE_DETECTION_FAILED')
      expect(error.details.originalCode).toBe(originalCode)
      expect(error.details.affectedBooks).toEqual(details.affectedBooks)
      expect(error.details.severity).toBe('MODERATE')
    })

    test('應該正確映射 DATA_PROGRESS_VALIDATION_ERROR 到 VALIDATION_ERROR', () => {
      // Given: 進度驗證錯誤的條件
      const originalCode = 'DATA_PROGRESS_VALIDATION_ERROR'
      const message = '閱讀進度格式驗證失敗'
      const details = { invalidProgressData: { progress: '150%' } }

      // When: 執行錯誤轉換
      const error = UC02ErrorAdapter.convertError(originalCode, message, details)

      // Then: 驗證轉換結果
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.subType).toBe('PROGRESS_VALIDATION_ERROR')
      expect(error.details.severity).toBe('MINOR')
    })

    test('應該正確映射 DATA_INCREMENTAL_UPDATE_CONFLICT 到 BOOK_ERROR', () => {
      // Given: 增量更新衝突
      const originalCode = 'DATA_INCREMENTAL_UPDATE_CONFLICT'
      const message = '增量更新時發生資料衝突'
      const details = { conflictedBooks: [{ id: 'book_789', conflict: 'progress_regression' }] }

      // When: 執行錯誤轉換
      const error = UC02ErrorAdapter.convertError(originalCode, message, details)

      // Then: 驗證轉換結果
      expect(error.code).toBe(ErrorCodes.BOOK_ERROR)
      expect(error.subType).toBe('INCREMENTAL_UPDATE_CONFLICT')
      expect(error.details.severity).toBe('MODERATE')
    })

    test('應該正確映射 DOM_PAGE_STRUCTURE_CHANGED 到 DOM_ERROR', () => {
      // Given: 頁面結構變化
      const originalCode = 'DOM_PAGE_STRUCTURE_CHANGED'
      const message = 'Readmoo 頁面結構已更新'
      const details = { detectedChanges: ['.book-item', '.progress-bar'] }

      // When: 執行錯誤轉換
      const error = UC02ErrorAdapter.convertError(originalCode, message, details)

      // Then: 驗證轉換結果
      expect(error.code).toBe(ErrorCodes.DOM_ERROR)
      expect(error.subType).toBe('PAGE_STRUCTURE_CHANGED')
      expect(error.details.severity).toBe('MODERATE')
    })

    test('應該正確映射 NETWORK_RATE_LIMITING_DETECTED 到 NETWORK_ERROR', () => {
      // Given: 網路頻率限制
      const originalCode = 'NETWORK_RATE_LIMITING_DETECTED'
      const message = '檢測到 Readmoo 頻率限制'
      const details = { requestsInWindow: 50, rateLimit: 30 }

      // When: 執行錯誤轉換
      const error = UC02ErrorAdapter.convertError(originalCode, message, details)

      // Then: 驗證轉換結果
      expect(error.code).toBe(ErrorCodes.NETWORK_ERROR)
      expect(error.subType).toBe('RATE_LIMITING_DETECTED')
      expect(error.details.severity).toBe('MODERATE')
    })

    test('應該正確映射 PLATFORM_CHROME_EXTENSION_CONFLICT 到 CHROME_ERROR', () => {
      // Given: Chrome擴充功能衝突
      const originalCode = 'PLATFORM_CHROME_EXTENSION_CONFLICT'
      const message = 'Chrome 擴充功能衝突影響書籍提取'
      const details = { conflictingExtensions: ['extension_1', 'extension_2'] }

      // When: 執行錯誤轉換
      const error = UC02ErrorAdapter.convertError(originalCode, message, details)

      // Then: 驗證轉換結果
      expect(error.code).toBe(ErrorCodes.CHROME_ERROR)
      expect(error.subType).toBe('EXTENSION_CONFLICT')
      expect(error.details.severity).toBe('MODERATE')
    })
  })

  describe('完整映射覆蓋測試', () => {
    
    test('應該覆蓋所有15個UC-02 StandardError代碼', () => {
      // Given: UC-02的所有15個錯誤代碼
      const allUC02Errors = [
        'DATA_DUPLICATE_DETECTION_FAILED',
        'DATA_INCREMENTAL_UPDATE_CONFLICT',
        'DATA_PROGRESS_VALIDATION_ERROR',
        'DOM_PAGE_STRUCTURE_CHANGED',
        'DOM_INFINITE_SCROLL_DETECTION_FAILED',
        'DOM_DYNAMIC_CONTENT_TIMEOUT',
        'SYSTEM_INCREMENTAL_PROCESSING_OVERLOAD',
        'SYSTEM_BACKGROUND_SYNC_FAILURE',
        'NETWORK_RATE_LIMITING_DETECTED',
        'NETWORK_PARTIAL_CONNECTIVITY',
        'PLATFORM_TAB_SWITCHING_INTERFERENCE',
        'PLATFORM_CHROME_EXTENSION_CONFLICT'
      ]

      // When: 獲取映射表
      const mapping = UC02ErrorAdapter.getErrorMapping()

      // Then: 驗證所有錯誤都有對應的映射
      allUC02Errors.forEach(errorCode => {
        expect(mapping).toHaveProperty(errorCode)
        expect(Object.values(ErrorCodes)).toContain(mapping[errorCode])
      })

      // 驗證映射數量正確
      expect(Object.keys(mapping).length).toBe(12) // UC-02實際有12個錯誤
    })

    test('應該正確分類錯誤到對應的ErrorCodes類別', () => {
      // Given: 預期的錯誤分類
      const expectedCategorization = {
        [ErrorCodes.VALIDATION_ERROR]: [
          'DATA_DUPLICATE_DETECTION_FAILED',
          'DATA_PROGRESS_VALIDATION_ERROR'
        ],
        [ErrorCodes.BOOK_ERROR]: [
          'DATA_INCREMENTAL_UPDATE_CONFLICT'
        ],
        [ErrorCodes.DOM_ERROR]: [
          'DOM_PAGE_STRUCTURE_CHANGED',
          'DOM_INFINITE_SCROLL_DETECTION_FAILED'
        ],
        [ErrorCodes.TIMEOUT_ERROR]: [
          'DOM_DYNAMIC_CONTENT_TIMEOUT'
        ],
        [ErrorCodes.OPERATION_ERROR]: [
          'SYSTEM_INCREMENTAL_PROCESSING_OVERLOAD',
          'SYSTEM_BACKGROUND_SYNC_FAILURE'
        ],
        [ErrorCodes.NETWORK_ERROR]: [
          'NETWORK_RATE_LIMITING_DETECTED'
        ],
        [ErrorCodes.CONNECTION_ERROR]: [
          'NETWORK_PARTIAL_CONNECTIVITY'
        ],
        [ErrorCodes.CHROME_ERROR]: [
          'PLATFORM_TAB_SWITCHING_INTERFERENCE',
          'PLATFORM_CHROME_EXTENSION_CONFLICT'
        ]
      }

      // When: 獲取映射表
      const mapping = UC02ErrorAdapter.getErrorMapping()

      // Then: 驗證分類正確性
      Object.entries(expectedCategorization).forEach(([expectedErrorCode, originalCodes]) => {
        originalCodes.forEach(originalCode => {
          expect(mapping[originalCode]).toBe(expectedErrorCode)
        })
      })
    })
  })

  describe('邊界條件和異常處理測試', () => {
    
    test('應該處理無效的錯誤代碼輸入', () => {
      // Given: 無效輸入條件
      const invalidInputs = [null, undefined, '', 123, {}, []]

      invalidInputs.forEach(invalidInput => {
        // When: 轉換無效輸入
        const error = UC02ErrorAdapter.convertError(invalidInput, 'test message')

        // Then: 應該回傳UNKNOWN_ERROR
        expect(error.code).toBe(ErrorCodes.UNKNOWN_ERROR)
        expect(error.subType).toBe('UC02_CONVERSION_ERROR')
        expect(error.details.receivedCode).toBe(invalidInput)
      })
    })

    test('應該處理未知的StandardError代碼', () => {
      // Given: 未知的錯誤代碼
      const unknownCode = 'UNKNOWN_UC02_ERROR_CODE'
      const message = 'Unknown error occurred'

      // When: 轉換未知錯誤代碼
      const error = UC02ErrorAdapter.convertError(unknownCode, message)

      // Then: 應該回傳UNKNOWN_ERROR並包含診斷資訊
      expect(error.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(error.subType).toBe('UC02_CONVERSION_ERROR')
      expect(error.details.unknownCode).toBe(unknownCode)
      expect(error.details.availableCodes).toEqual(expect.arrayContaining([
        'DATA_DUPLICATE_DETECTION_FAILED',
        'DATA_INCREMENTAL_UPDATE_CONFLICT'
      ]))
    })

    test('應該正確處理空的details物件', () => {
      // Given: 沒有額外詳細資訊
      const originalCode = 'DATA_PROGRESS_VALIDATION_ERROR'
      const message = 'Simple validation error'

      // When: 轉換錯誤（沒有details）
      const error = UC02ErrorAdapter.convertError(originalCode, message)

      // Then: 應該包含預設的details結構
      expect(error.details).toEqual(expect.objectContaining({
        originalCode: originalCode,
        severity: 'MINOR',
        timestamp: expect.any(Number)
      }))
    })

    test('應該保留並合併額外的details資訊', () => {
      // Given: 包含額外詳細資訊
      const originalCode = 'DATA_DUPLICATE_DETECTION_FAILED'
      const message = 'Duplicate detection failed'
      const customDetails = {
        customField: 'custom value',
        additionalInfo: { nested: 'data' }
      }

      // When: 轉換錯誤
      const error = UC02ErrorAdapter.convertError(originalCode, message, customDetails)

      // Then: 應該保留自定義詳細資訊
      expect(error.details).toEqual(expect.objectContaining({
        ...customDetails,
        originalCode: originalCode,
        severity: expect.any(String),
        timestamp: expect.any(Number)
      }))
    })
  })

  describe('效能和記憶體使用測試', () => {
    
    test('錯誤映射表應該使用快取機制', () => {
      // Given: 第一次獲取映射表
      const mapping1 = UC02ErrorAdapter.getErrorMapping()

      // When: 第二次獲取映射表
      const mapping2 = UC02ErrorAdapter.getErrorMapping()

      // Then: 應該回傳相同的物件參照（快取效果）
      expect(mapping1).toBe(mapping2)
      expect(Object.isFrozen(mapping1)).toBe(true)
    })

    test('錯誤轉換應該在合理時間內完成', () => {
      // Given: 標準錯誤轉換條件
      const originalCode = 'DATA_DUPLICATE_DETECTION_FAILED'
      const message = 'Performance test error'
      const details = { performanceTest: true }

      // When: 測量轉換執行時間
      const startTime = performance.now()
      const error = UC02ErrorAdapter.convertError(originalCode, message, details)
      const endTime = performance.now()

      // Then: 執行時間應該小於1毫秒（效能要求）
      expect(endTime - startTime).toBeLessThan(1)
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
    })

    test('錯誤物件記憶體使用應該在合理範圍內', () => {
      // Given: 建立錯誤物件
      const originalCode = 'DATA_INCREMENTAL_UPDATE_CONFLICT'
      const message = 'Memory usage test error'
      const details = {
        largeDataSet: new Array(100).fill('test data'),
        metadata: { info: 'memory test' }
      }

      // When: 轉換錯誤
      const error = UC02ErrorAdapter.convertError(originalCode, message, details)

      // Then: 驗證錯誤物件結構合理
      expect(error).toEqual(expect.objectContaining({
        message: expect.any(String),
        code: expect.any(String),
        subType: expect.any(String),
        details: expect.any(Object)
      }))

      // 驗證序列化大小不會過大
      const serialized = JSON.stringify(error.details)
      expect(serialized.length).toBeLessThan(15 * 1024) // 15KB限制
    })
  })

  describe('驗證功能測試', () => {
    
    test('isValidErrorCodesError 應該正確驗證ErrorCodes錯誤', () => {
      // Given: 有效的ErrorCodes錯誤
      const validError = UC02ErrorAdapter.convertError(
        'DATA_PROGRESS_VALIDATION_ERROR',
        'Valid error',
        { validationTest: true }
      )

      // When: 驗證錯誤物件
      const isValid = UC02ErrorAdapter.isValidErrorCodesError(validError)

      // Then: 應該回傳true
      expect(isValid).toBe(true)
    })

    test('isValidErrorCodesError 應該拒絕無效的錯誤物件', () => {
      // Given: 無效的錯誤物件
      const invalidErrors = [
        new Error('Regular error'),
        { code: 'INVALID_CODE', message: 'Not an Error instance' },
        null,
        undefined
      ]

      invalidErrors.forEach(invalidError => {
        // When: 驗證無效錯誤
        const isValid = UC02ErrorAdapter.isValidErrorCodesError(invalidError)

        // Then: 應該回傳false
        expect(isValid).toBe(false)
      })
    })

    test('getSeverityFromCode 應該正確分類錯誤嚴重程度', () => {
      // Given: 不同嚴重程度的錯誤代碼
      const severityTests = [
        { code: 'DATA_PROGRESS_VALIDATION_ERROR', expected: 'MINOR' },
        { code: 'DATA_DUPLICATE_DETECTION_FAILED', expected: 'MODERATE' },
        { code: 'SYSTEM_INCREMENTAL_PROCESSING_OVERLOAD', expected: 'SEVERE' }
      ]

      severityTests.forEach(({ code, expected }) => {
        // When: 獲取嚴重程度
        const severity = UC02ErrorAdapter.getSeverityFromCode(code)

        // Then: 應該匹配預期值
        expect(severity).toBe(expected)
      })
    })

    test('extractSubType 應該正確提取子類型', () => {
      // Given: 測試子類型提取
      const subTypeTests = [
        { code: 'DATA_DUPLICATE_DETECTION_FAILED', expected: 'DUPLICATE_DETECTION_FAILED' },
        { code: 'DOM_PAGE_STRUCTURE_CHANGED', expected: 'PAGE_STRUCTURE_CHANGED' },
        { code: 'NETWORK_RATE_LIMITING_DETECTED', expected: 'RATE_LIMITING_DETECTED' }
      ]

      subTypeTests.forEach(({ code, expected }) => {
        // When: 提取子類型
        const subType = UC02ErrorAdapter.extractSubType(code)

        // Then: 應該匹配預期值
        expect(subType).toBe(expected)
      })
    })
  })
})