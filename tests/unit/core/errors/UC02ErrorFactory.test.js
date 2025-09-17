/**
 * UC02ErrorFactory 單元測試
 * 
 * 測試目標：
 * - 專用錯誤建立方法的正確性
 * - createResult API的完整性
 * - 錯誤快取和效能優化
 * - 記憶體安全和資料清理
 */

import { ErrorCodes } from 'src/core/errors/ErrorCodes.js'
import { UC02ErrorFactory } from 'src/core/errors/UC02ErrorFactory.js'

describe('UC02ErrorFactory - 錯誤工廠測試', () => {
  
  beforeEach(() => {
    // 清除快取和 mock 狀態
    UC02ErrorFactory.clearCache()
    jest.clearAllMocks()
  })

  describe('基本API功能測試', () => {
    
    test('createError 應該正確建立ErrorCodes錯誤', () => {
      // Given: 標準錯誤建立參數
      const originalCode = 'DATA_DUPLICATE_DETECTION_FAILED'
      const message = '重複書籍檢測機制失敗'
      const details = { affectedBooks: ['book_123'] }

      // When: 使用工廠建立錯誤
      const error = UC02ErrorFactory.createError(originalCode, message, details)

      // Then: 驗證錯誤物件結構
      expect(error).toBeInstanceOf(Error)
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.message).toBe(message)
      expect(error.details).toEqual(expect.objectContaining({
        ...details,
        originalCode: originalCode,
        severity: 'MODERATE',
        timestamp: expect.any(Number)
      }))
    })

    test('createResult 應該正確建立成功結果', () => {
      // Given: 成功操作條件
      const successData = { extractedBooks: 25, totalTime: 1200 }

      // When: 建立成功結果
      const result = UC02ErrorFactory.createResult(true, successData)

      // Then: 驗證成功結果結構
      expect(result).toEqual({
        success: true,
        data: successData,
        code: 'SUCCESS',
        message: 'Operation completed successfully'
      })
    })

    test('createResult 應該正確建立失敗結果', () => {
      // Given: 失敗操作條件
      const error = UC02ErrorFactory.createError(
        'DATA_PROGRESS_VALIDATION_ERROR',
        '進度驗證失敗',
        { invalidProgress: '150%' }
      )

      // When: 建立失敗結果
      const result = UC02ErrorFactory.createResult(false, null, error)

      // Then: 驗證失敗結果結構
      expect(result).toEqual({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        subType: error.subType
      })
    })
  })

  describe('專用錯誤建立方法測試', () => {
    
    test('createDuplicateDetectionError 應該建立正確的重複檢測錯誤', () => {
      // Given: 重複檢測失敗條件
      const affectedBooks = [
        { id: 'book_123', title: '重複書籍 1' },
        { id: 'book_456', title: '重複書籍 2' }
      ]
      const additionalDetails = { detectionMethod: 'isbn_comparison' }

      // When: 建立重複檢測錯誤
      const error = UC02ErrorFactory.createDuplicateDetectionError(affectedBooks, additionalDetails)

      // Then: 驗證錯誤結構
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.subType).toBe('DUPLICATE_DETECTION_FAILED')
      expect(error.message).toBe('重複書籍檢測機制失敗')
      expect(error.details).toEqual(expect.objectContaining({
        affectedBooks: affectedBooks,
        fallbackStrategy: 'manual_review',
        totalBooksScanned: affectedBooks.length,
        detectionMethod: 'isbn_comparison',
        originalCode: 'DATA_DUPLICATE_DETECTION_FAILED'
      }))
    })

    test('createProgressValidationError 應該建立正確的進度驗證錯誤', () => {
      // Given: 無效進度資料
      const invalidProgressData = { progress: '150%', bookId: 'book_789' }
      const additionalDetails = { validationRule: 'range_0_to_100' }

      // When: 建立進度驗證錯誤
      const error = UC02ErrorFactory.createProgressValidationError(invalidProgressData, additionalDetails)

      // Then: 驗證錯誤結構
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.subType).toBe('PROGRESS_VALIDATION_ERROR')
      expect(error.message).toBe('閱讀進度格式驗證失敗')
      expect(error.details).toEqual(expect.objectContaining({
        invalidProgressData: invalidProgressData,
        correctionAttempted: true,
        validRange: '0-100%',
        validationRule: 'range_0_to_100',
        originalCode: 'DATA_PROGRESS_VALIDATION_ERROR'
      }))
    })

    test('createIncrementalUpdateError 應該建立正確的更新衝突錯誤', () => {
      // Given: 衝突的書籍資料
      const conflictedBooks = [
        {
          id: 'book_321',
          storedProgress: '60%',
          newProgress: '45%',
          conflictType: 'progress_regression'
        }
      ]

      // When: 建立增量更新錯誤
      const error = UC02ErrorFactory.createIncrementalUpdateError(conflictedBooks)

      // Then: 驗證錯誤結構
      expect(error.code).toBe(ErrorCodes.BOOK_ERROR)
      expect(error.subType).toBe('INCREMENTAL_UPDATE_CONFLICT')
      expect(error.message).toBe('增量更新時發生資料衝突')
      expect(error.details).toEqual(expect.objectContaining({
        conflictedBooks: conflictedBooks,
        suggestedResolution: 'keep_higher_progress',
        conflictType: 'progress_regression',
        originalCode: 'DATA_INCREMENTAL_UPDATE_CONFLICT'
      }))
    })

    test('createPageStructureError 應該建立正確的頁面結構錯誤', () => {
      // Given: 頁面結構變化資訊
      const detectedChanges = [
        { selector: '.book-item', status: 'not_found' },
        { selector: '.progress-bar', status: 'modified' }
      ]

      // When: 建立頁面結構錯誤
      const error = UC02ErrorFactory.createPageStructureError(detectedChanges)

      // Then: 驗證錯誤結構
      expect(error.code).toBe(ErrorCodes.DOM_ERROR)
      expect(error.subType).toBe('PAGE_STRUCTURE_CHANGED')
      expect(error.message).toBe('Readmoo 頁面結構已更新，需要適應新版面')
      expect(error.details).toEqual(expect.objectContaining({
        detectedChanges: detectedChanges,
        adaptationAttempted: true,
        fallbackSelectorsAvailable: true,
        originalCode: 'DOM_PAGE_STRUCTURE_CHANGED'
      }))
    })

    test('createRateLimitError 應該建立正確的頻率限制錯誤並處理退避延遲', () => {
      // Given: 頻率限制資訊
      const rateLimitInfo = {
        requestsInWindow: 50,
        rateLimit: 30,
        window: '60s',
        backoffDelay: 120000 // 2分鐘
      }

      // When: 建立頻率限制錯誤
      const error = UC02ErrorFactory.createRateLimitError(rateLimitInfo)

      // Then: 驗證錯誤結構和退避延遲處理
      expect(error.code).toBe(ErrorCodes.NETWORK_ERROR)
      expect(error.subType).toBe('RATE_LIMITING_DETECTED')
      expect(error.message).toBe('檢測到 Readmoo 頻率限制')
      expect(error.details.backoffDelay).toBe(120000) // 在限制內
      expect(error.details.safetyTimeout).toBe(180000) // 1.5倍退避延遲
      expect(error.details.maxRetries).toBe(3)
    })

    test('createRateLimitError 應該限制過大的退避延遲', () => {
      // Given: 過大的退避延遲
      const rateLimitInfo = {
        backoffDelay: 600000 // 10分鐘，超過5分鐘限制
      }

      // When: 建立頻率限制錯誤
      const error = UC02ErrorFactory.createRateLimitError(rateLimitInfo)

      // Then: 退避延遲應該被限制在5分鐘內
      expect(error.details.backoffDelay).toBe(300000) // 5分鐘上限
      expect(error.details.safetyTimeout).toBe(450000) // 1.5倍
    })

    test('createExtensionConflictError 應該建立正確的擴充功能衝突錯誤', () => {
      // Given: 衝突的擴充功能資訊
      const conflictingExtensions = [
        { id: 'extension_1', name: 'AdBlocker' },
        { id: 'extension_2', name: 'PageModifier' }
      ]

      // When: 建立擴充功能衝突錯誤
      const error = UC02ErrorFactory.createExtensionConflictError(conflictingExtensions)

      // Then: 驗證錯誤結構
      expect(error.code).toBe(ErrorCodes.CHROME_ERROR)
      expect(error.subType).toBe('EXTENSION_CONFLICT')
      expect(error.message).toBe('Chrome 擴充功能衝突影響書籍提取')
      expect(error.details).toEqual(expect.objectContaining({
        conflictingExtensions: conflictingExtensions,
        isolationAttempted: true,
        recommendedAction: 'disable_conflicting_extensions',
        originalCode: 'PLATFORM_CHROME_EXTENSION_CONFLICT'
      }))
    })
  })

  describe('快取和效能優化測試', () => {
    
    test('getCommonError 應該提供預建立的常用錯誤', () => {
      // Given: 常用錯誤類型
      const commonErrorTypes = [
        'DUPLICATE_DETECTION',
        'PROGRESS_VALIDATION',
        'PAGE_STRUCTURE'
      ]

      commonErrorTypes.forEach(errorType => {
        // When: 獲取常用錯誤
        const error = UC02ErrorFactory.getCommonError(errorType)

        // Then: 應該回傳凍結的錯誤物件
        expect(error).not.toBeNull()
        expect(Object.isFrozen(error)).toBe(true)
        expect(error).toBeInstanceOf(Error)
      })
    })

    test('getCommonError 應該使用快取機制', () => {
      // Given: 第一次獲取常用錯誤
      const error1 = UC02ErrorFactory.getCommonError('DUPLICATE_DETECTION')

      // When: 第二次獲取相同錯誤
      const error2 = UC02ErrorFactory.getCommonError('DUPLICATE_DETECTION')

      // Then: 應該回傳相同的物件參照（快取效果）
      expect(error1).toBe(error2)
    })

    test('clearCache 應該清除錯誤快取', () => {
      // Given: 快取中有錯誤物件
      const error1 = UC02ErrorFactory.getCommonError('PROGRESS_VALIDATION')
      expect(error1).not.toBeNull()

      // When: 清除快取
      UC02ErrorFactory.clearCache()
      const error2 = UC02ErrorFactory.getCommonError('PROGRESS_VALIDATION')

      // Then: 應該建立新的錯誤物件
      expect(error2).not.toBe(error1) // 不同物件參照
      expect(error2).toEqual(error1) // 但內容相同
    })

    test('專用錯誤建立方法應該在合理時間內完成', () => {
      // Given: 測量各個專用方法的執行時間
      const performanceTests = [
        () => UC02ErrorFactory.createDuplicateDetectionError(['book_1']),
        () => UC02ErrorFactory.createProgressValidationError({ progress: '50%' }),
        () => UC02ErrorFactory.createIncrementalUpdateError([{ id: 'book_1' }]),
        () => UC02ErrorFactory.createPageStructureError(['.selector']),
        () => UC02ErrorFactory.createRateLimitError({ backoffDelay: 60000 })
      ]

      performanceTests.forEach((testFunction, index) => {
        // When: 測量執行時間
        const startTime = performance.now()
        const error = testFunction()
        const endTime = performance.now()

        // Then: 執行時間應該小於1毫秒
        expect(endTime - startTime).toBeLessThan(1)
        expect(error).toBeInstanceOf(Error)
      })
    })
  })

  describe('資料安全和驗證測試', () => {
    
    test('sanitizeDetails 應該限制過大的詳細資訊', () => {
      // Given: 過大的詳細資訊
      const largeDetails = {
        normalField: 'normal data',
        largeArray: new Array(10000).fill('large data item'),
        metadata: { info: 'test' }
      }

      // When: 安全化詳細資訊
      const sanitized = UC02ErrorFactory.sanitizeDetails(largeDetails)

      // Then: 應該標記為被截斷
      expect(sanitized._truncated).toBe(true)
      expect(sanitized._originalSize).toBeGreaterThan(15 * 1024)
      expect(sanitized._message).toBe('Details truncated due to size limit')
    })

    test('sanitizeDetails 應該保留正常大小的詳細資訊', () => {
      // Given: 正常大小的詳細資訊
      const normalDetails = {
        bookId: 'book_123',
        progress: '50%',
        metadata: { author: 'Test Author', genre: 'Fiction' }
      }

      // When: 安全化詳細資訊
      const sanitized = UC02ErrorFactory.sanitizeDetails(normalDetails)

      // Then: 應該保持原樣
      expect(sanitized).toEqual(normalDetails)
      expect(sanitized._truncated).toBeUndefined()
    })

    test('isValidUC02Error 應該正確驗證UC-02錯誤', () => {
      // Given: 有效的UC-02錯誤
      const validError = UC02ErrorFactory.createDuplicateDetectionError(['book_1'])

      // When: 驗證錯誤
      const isValid = UC02ErrorFactory.isValidUC02Error(validError)

      // Then: 應該通過驗證
      expect(isValid).toBe(true)
    })

    test('isValidUC02Error 應該拒絕非UC-02錯誤', () => {
      // Given: 非UC-02錯誤
      const invalidErrors = [
        new Error('Regular error'),
        { code: ErrorCodes.VALIDATION_ERROR, message: 'Not UC-02' },
        null
      ]

      invalidErrors.forEach(invalidError => {
        // When: 驗證無效錯誤
        const isValid = UC02ErrorFactory.isValidUC02Error(invalidError)

        // Then: 應該被拒絕
        expect(isValid).toBe(false)
      })
    })
  })

  describe('邊界條件處理測試', () => {
    
    test('專用錯誤建立方法應該處理空參數', () => {
      // Given: 空參數條件
      const emptyArrayTests = [
        () => UC02ErrorFactory.createDuplicateDetectionError([]),
        () => UC02ErrorFactory.createIncrementalUpdateError([]),
        () => UC02ErrorFactory.createPageStructureError([]),
        () => UC02ErrorFactory.createExtensionConflictError([])
      ]

      emptyArrayTests.forEach(testFunction => {
        // When: 使用空參數建立錯誤
        const error = testFunction()

        // Then: 應該成功建立錯誤物件
        expect(error).toBeInstanceOf(Error)
        expect(error.details).toBeDefined()
        expect(error.details.originalCode).toBeDefined()
      })
    })

    test('createResult 應該處理null和undefined參數', () => {
      // Given: null/undefined參數條件
      const nullTests = [
        () => UC02ErrorFactory.createResult(true, null),
        () => UC02ErrorFactory.createResult(false, null, null)
      ]

      nullTests.forEach(testFunction => {
        // When: 使用null參數建立結果
        const result = testFunction()

        // Then: 應該有有效的結果結構
        expect(result).toHaveProperty('success')
        expect(typeof result.success).toBe('boolean')
      })
    })

    test('getCommonError 應該處理未知的錯誤類型', () => {
      // Given: 未知的錯誤類型
      const unknownErrorType = 'UNKNOWN_ERROR_TYPE'

      // When: 嘗試獲取未知錯誤類型
      const error = UC02ErrorFactory.getCommonError(unknownErrorType)

      // Then: 應該回傳null
      expect(error).toBeNull()
    })
  })
})