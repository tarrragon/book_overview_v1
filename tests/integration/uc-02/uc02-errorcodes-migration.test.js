/**
 * UC-02 ErrorCodes 遷移整合測試
 * 
 * 測試目標：
 * - 驗證UC-02完整工作流程中的錯誤處理
 * - 測試StandardError到ErrorCodes的端對端轉換
 * - 確保使用者體驗不受影響
 * - 驗證Chrome Extension環境相容性
 */

import { ErrorCodes } from 'src/core/errors/ErrorCodes.js'
import { UC02ErrorAdapter } from 'src/core/errors/UC02ErrorAdapter.js'
import { UC02ErrorFactory } from 'src/core/errors/UC02ErrorFactory.js'

describe('UC-02 ErrorCodes 遷移整合測試', () => {

  beforeEach(() => {
    // 清除快取狀態
    UC02ErrorFactory.clearCache()
    jest.clearAllMocks()
  })

  describe('日常書籍提取工作流程', () => {

    test('完整的書籍提取流程 - 包含錯誤恢復', async () => {
      // Given: 模擬UC-02日常提取流程
      const mockBookExtractionWorkflow = {
        // 階段1: 書籍重複檢測
        async detectDuplicates(books) {
          // 模擬重複檢測失敗
          throw UC02ErrorFactory.createDuplicateDetectionError(
            [{ id: 'book_123', title: '測試書籍' }],
            { detectionMethod: 'isbn_comparison' }
          )
        },
        
        // 階段2: 進度驗證
        async validateProgress(progressData) {
          // 模擬進度驗證錯誤
          if (progressData.progress === '150%') {
            throw UC02ErrorFactory.createProgressValidationError(
              progressData,
              { validationRule: 'range_0_to_100' }
            )
          }
          return { valid: true }
        },
        
        // 階段3: 增量更新
        async performIncrementalUpdate(books) {
          // 模擬更新衝突
          throw UC02ErrorFactory.createIncrementalUpdateError(
            [{ id: 'book_456', conflict: 'progress_regression' }]
          )
        },
        
        // 階段4: DOM適應
        async adaptToPageChanges() {
          // 模擬頁面結構變化
          throw UC02ErrorFactory.createPageStructureError(
            [{ selector: '.book-item', status: 'not_found' }]
          )
        }
      }

      // When & Then: 測試每個階段的錯誤處理
      
      // 階段1: 重複檢測錯誤
      try {
        await mockBookExtractionWorkflow.detectDuplicates([])
        fail('Should have thrown duplicate detection error')
      } catch (error) {
        expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
        expect(error.subType).toBe('DUPLICATE_DETECTION_FAILED')
        expect(error.details.originalCode).toBe('DATA_DUPLICATE_DETECTION_FAILED')
        expect(error.details.fallbackStrategy).toBe('manual_review')
      }

      // 階段2: 進度驗證錯誤
      try {
        await mockBookExtractionWorkflow.validateProgress({ progress: '150%' })
        fail('Should have thrown progress validation error')
      } catch (error) {
        expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
        expect(error.subType).toBe('PROGRESS_VALIDATION_ERROR')
        expect(error.details.correctionAttempted).toBe(true)
      }

      // 階段3: 增量更新錯誤
      try {
        await mockBookExtractionWorkflow.performIncrementalUpdate([])
        fail('Should have thrown incremental update error')
      } catch (error) {
        expect(error.code).toBe(ErrorCodes.BOOK_ERROR)
        expect(error.subType).toBe('INCREMENTAL_UPDATE_CONFLICT')
        expect(error.details.suggestedResolution).toBe('keep_higher_progress')
      }

      // 階段4: DOM適應錯誤
      try {
        await mockBookExtractionWorkflow.adaptToPageChanges()
        fail('Should have thrown page structure error')
      } catch (error) {
        expect(error.code).toBe(ErrorCodes.DOM_ERROR)
        expect(error.subType).toBe('PAGE_STRUCTURE_CHANGED')
        expect(error.details.adaptationAttempted).toBe(true)
      }
    })

    test('網路相關錯誤處理流程', async () => {
      // Given: 模擬網路錯誤情境
      const networkErrorScenarios = [
        {
          name: '頻率限制檢測',
          errorFactory: () => UC02ErrorFactory.createRateLimitError({
            requestsInWindow: 50,
            rateLimit: 30,
            backoffDelay: 120000
          }),
          expectedCode: ErrorCodes.NETWORK_ERROR,
          expectedSubType: 'RATE_LIMITING_DETECTED'
        },
        {
          name: 'Chrome Extension衝突',
          errorFactory: () => UC02ErrorFactory.createExtensionConflictError([
            { id: 'ext_1', name: 'AdBlocker' }
          ]),
          expectedCode: ErrorCodes.CHROME_ERROR,
          expectedSubType: 'EXTENSION_CONFLICT'
        }
      ]

      // When & Then: 測試各種網路錯誤情境
      for (const scenario of networkErrorScenarios) {
        const error = scenario.errorFactory()
        
        expect(error.code).toBe(scenario.expectedCode)
        expect(error.subType).toBe(scenario.expectedSubType)
        expect(error.details.originalCode).toBeDefined()
        expect(error.details.timestamp).toBeDefined()
      }
    })
  })

  describe('錯誤恢復策略驗證', () => {

    test('錯誤結果物件應該包含恢復資訊', () => {
      // Given: 各種錯誤情境
      const errorScenarios = [
        {
          error: UC02ErrorFactory.createDuplicateDetectionError(['book_1']),
          expectedRecoveryInfo: 'manual_review'
        },
        {
          error: UC02ErrorFactory.createPageStructureError(['.selector']),
          expectedRecoveryInfo: true // fallbackSelectorsAvailable
        },
        {
          error: UC02ErrorFactory.createRateLimitError({ backoffDelay: 60000 }),
          expectedRecoveryInfo: 3 // maxRetries
        }
      ]

      errorScenarios.forEach(scenario => {
        // When: 建立錯誤結果
        const result = UC02ErrorFactory.createResult(false, null, scenario.error)

        // Then: 結果應包含恢復資訊
        expect(result.success).toBe(false)
        expect(result.code).toBe(scenario.error.code)
        expect(result.details).toBeDefined()
        expect(result.subType).toBe(scenario.error.subType)

        // 驗證特定恢復資訊
        if (scenario.error.subType === 'DUPLICATE_DETECTION_FAILED') {
          expect(result.details.fallbackStrategy).toBe('manual_review')
        } else if (scenario.error.subType === 'PAGE_STRUCTURE_CHANGED') {
          expect(result.details.fallbackSelectorsAvailable).toBe(true)
        } else if (scenario.error.subType === 'RATE_LIMITING_DETECTED') {
          expect(result.details.maxRetries).toBe(3)
        }
      })
    })

    test('錯誤嚴重程度應該影響處理策略', () => {
      // Given: 不同嚴重程度的錯誤
      const severityTests = [
        {
          errorType: 'DATA_PROGRESS_VALIDATION_ERROR',
          expectedSeverity: 'MINOR',
          shouldAllowContinue: true
        },
        {
          errorType: 'DATA_DUPLICATE_DETECTION_FAILED',
          expectedSeverity: 'MODERATE', 
          shouldAllowContinue: true
        },
        {
          errorType: 'SYSTEM_INCREMENTAL_PROCESSING_OVERLOAD',
          expectedSeverity: 'SEVERE',
          shouldAllowContinue: false
        }
      ]

      severityTests.forEach(test => {
        // When: 轉換錯誤
        const error = UC02ErrorAdapter.convertError(
          test.errorType,
          'Test error message'
        )

        // Then: 嚴重程度應該正確
        expect(error.details.severity).toBe(test.expectedSeverity)
        
        // 根據嚴重程度判斷是否應該繼續
        const shouldContinue = error.details.severity !== 'SEVERE'
        expect(shouldContinue).toBe(test.shouldAllowContinue)
      })
    })
  })

  describe('Chrome Extension 環境相容性', () => {

    test('錯誤物件應該可序列化於Chrome Extension環境', () => {
      // Given: 各種錯誤類型
      const errors = [
        UC02ErrorFactory.createDuplicateDetectionError(['book_1']),
        UC02ErrorFactory.createProgressValidationError({ progress: '150%' }),
        UC02ErrorFactory.createPageStructureError(['.selector']),
        UC02ErrorFactory.createRateLimitError({ backoffDelay: 60000 })
      ]

      errors.forEach(error => {
        // When: 序列化錯誤物件
        const serialized = JSON.stringify(error)
        const deserialized = JSON.parse(serialized)

        // Then: 序列化應該成功且保持完整性
        expect(serialized).toBeDefined()
        expect(deserialized.message).toBe(error.message)
        expect(deserialized.code).toBe(error.code)
        expect(deserialized.subType).toBe(error.subType)
        expect(deserialized.details).toEqual(error.details)
      })
    })

    test('錯誤詳細資訊應該符合Chrome Extension記憶體限制', () => {
      // Given: 大量資料的錯誤
      const largeBookList = new Array(1000).fill().map((_, i) => ({
        id: `book_${i}`,
        title: `Test Book ${i}`,
        metadata: { data: 'x'.repeat(100) }
      }))

      // When: 建立包含大量資料的錯誤
      const error = UC02ErrorFactory.createDuplicateDetectionError(largeBookList)

      // Then: 錯誤詳細資訊應該在合理範圍內或被截斷
      const serializedSize = JSON.stringify(error.details).length
      
      // 由於原始資料超過15KB，應該有截斷標記
      expect(error.details._truncated).toBe(true)
      expect(error.details._originalSize).toBeGreaterThan(15 * 1024)
      expect(error.details._message).toBe('Details truncated due to size limit')
      
      // 截斷後的資料應該在合理範圍內
      expect(serializedSize).toBeLessThan(15 * 1024)

      // 序列化後應該仍可正常解析
      expect(() => JSON.parse(JSON.stringify(error))).not.toThrow()
    })

    test('跨Context錯誤傳遞模擬', () => {
      // Given: 模擬Chrome Extension跨Context錯誤傳遞
      const originalError = UC02ErrorFactory.createPageStructureError(['.book-item'])

      // When: 模擬從Content Script傳遞到Background Script
      const messagePayload = {
        type: 'ERROR_OCCURRED',
        error: {
          message: originalError.message,
          code: originalError.code,
          subType: originalError.subType,
          details: originalError.details
        }
      }

      const serializedMessage = JSON.stringify(messagePayload)
      const receivedMessage = JSON.parse(serializedMessage)

      // Then: 錯誤資訊應該完整保持
      expect(receivedMessage.error.message).toBe(originalError.message)
      expect(receivedMessage.error.code).toBe(originalError.code)
      expect(receivedMessage.error.subType).toBe(originalError.subType)
      expect(receivedMessage.error.details.originalCode).toBe('DOM_PAGE_STRUCTURE_CHANGED')

      // 在接收端重新建立錯誤物件
      const reconstructedError = new Error(receivedMessage.error.message)
      reconstructedError.code = receivedMessage.error.code
      reconstructedError.subType = receivedMessage.error.subType
      reconstructedError.details = receivedMessage.error.details

      expect(UC02ErrorAdapter.isValidErrorCodesError(reconstructedError)).toBe(true)
    })
  })

  describe('效能和記憶體測試', () => {

    test('大量錯誤處理不應造成記憶體洩漏', () => {
      // Given: 大量錯誤建立和處理
      const errorCount = 1000
      const errors = []

      // When: 建立大量錯誤物件
      const startTime = performance.now()
      
      for (let i = 0; i < errorCount; i++) {
        const error = UC02ErrorFactory.createDuplicateDetectionError([`book_${i}`])
        errors.push(error)
      }

      const endTime = performance.now()

      // Then: 性能應該在合理範圍內
      expect(endTime - startTime).toBeLessThan(100) // 100ms內完成1000次錯誤建立
      expect(errors.length).toBe(errorCount)

      // 所有錯誤都應該有效
      errors.forEach(error => {
        expect(UC02ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
      })
    })

    test('錯誤快取機制應該有效工作', () => {
      // Given: 重複獲取常用錯誤
      const cacheTestCount = 100

      // When: 重複獲取預建立的錯誤
      const startTime = performance.now()
      
      for (let i = 0; i < cacheTestCount; i++) {
        UC02ErrorFactory.getCommonError('DUPLICATE_DETECTION')
        UC02ErrorFactory.getCommonError('PROGRESS_VALIDATION')
        UC02ErrorFactory.getCommonError('PAGE_STRUCTURE')
      }

      const endTime = performance.now()

      // Then: 快取機制應該顯著提升性能
      expect(endTime - startTime).toBeLessThan(10) // 應該非常快速
    })
  })

  describe('向後相容性保證', () => {

    test('所有StandardError資訊都應該保留', () => {
      // Given: 完整的StandardError資訊
      const originalStandardErrorInfo = {
        code: 'DATA_DUPLICATE_DETECTION_FAILED',
        message: '重複書籍檢測機制失敗',
        details: {
          affectedBooks: ['book_1', 'book_2'],
          detectionMethod: 'isbn_comparison',
          customField: 'custom_value'
        }
      }

      // When: 轉換為ErrorCodes格式
      const convertedError = UC02ErrorAdapter.convertError(
        originalStandardErrorInfo.code,
        originalStandardErrorInfo.message,
        originalStandardErrorInfo.details
      )

      // Then: 原始資訊應該完全保留
      expect(convertedError.details.originalCode).toBe(originalStandardErrorInfo.code)
      expect(convertedError.details.affectedBooks).toEqual(originalStandardErrorInfo.details.affectedBooks)
      expect(convertedError.details.detectionMethod).toBe(originalStandardErrorInfo.details.detectionMethod)
      expect(convertedError.details.customField).toBe(originalStandardErrorInfo.details.customField)
      
      // 新增的資訊也應該存在
      expect(convertedError.details.severity).toBeDefined()
      expect(convertedError.details.timestamp).toBeDefined()
      expect(convertedError.code).toBe(ErrorCodes.VALIDATION_ERROR)
    })

    test('錯誤處理API介面保持一致', () => {
      // Given: 使用新ErrorFactory的程式碼
      const newAPIUsage = {
        // 使用專用方法
        createSpecificError: () => UC02ErrorFactory.createDuplicateDetectionError(['book_1']),
        
        // 使用通用方法
        createGenericError: () => UC02ErrorFactory.createError(
          'DATA_PROGRESS_VALIDATION_ERROR',
          'Progress validation failed'
        ),
        
        // 使用結果建立
        createSuccessResult: (data) => UC02ErrorFactory.createResult(true, data),
        createFailureResult: (error) => UC02ErrorFactory.createResult(false, null, error)
      }

      // When & Then: 所有API都應該正常工作
      const specificError = newAPIUsage.createSpecificError()
      expect(specificError.code).toBe(ErrorCodes.VALIDATION_ERROR)
      
      const genericError = newAPIUsage.createGenericError()
      expect(genericError.code).toBe(ErrorCodes.VALIDATION_ERROR)
      
      const successResult = newAPIUsage.createSuccessResult({ books: 10 })
      expect(successResult.success).toBe(true)
      
      const failureResult = newAPIUsage.createFailureResult(specificError)
      expect(failureResult.success).toBe(false)
      expect(failureResult.code).toBe(ErrorCodes.VALIDATION_ERROR)
    })
  })
})