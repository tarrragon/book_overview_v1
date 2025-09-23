/**
 * UC03ErrorSystem 整合測試
 * 測試 UC03ErrorAdapter 和 UC03ErrorFactory 的整合協作
 * 模擬真實的資料匯出使用場景
 */

import { UC03ErrorAdapter } from '../../../../src/core/errors/UC03ErrorAdapter.js'
import { UC03ErrorFactory } from '../../../../src/core/errors/UC03ErrorFactory.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC03ErrorSystem 整合測試', () => {
  afterEach(() => {
    UC03ErrorFactory.clearCache()
  })

  describe('Adapter 與 Factory 協作', () => {
    test('Factory 建立的錯誤應該通過 Adapter 驗證', () => {
      const error = UC03ErrorFactory.createError(
        'DATA_EXPORT_GENERATION_FAILED',
        '匯出檔案生成失敗'
      )

      expect(UC03ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
      expect(UC03ErrorFactory.isValidUC03Error(error)).toBe(true)
    })

    test('所有 Factory 方法產生的錯誤都應該有效', () => {
      const errors = [
        UC03ErrorFactory.createExportGenerationError('JSON'),
        UC03ErrorFactory.createExportMemoryError(1000),
        UC03ErrorFactory.createDownloadBlockedError('export.json'),
        UC03ErrorFactory.createIntegrityViolationError(100, 95)
      ]

      errors.forEach(error => {
        expect(UC03ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
        expect(UC03ErrorFactory.isValidUC03Error(error)).toBe(true)
      })
    })
  })

  describe('資料匯出完整流程模擬', () => {
    test('模擬JSON匯出生成失敗流程', async () => {
      // 模擬JSON序列化失敗
      const generationError = UC03ErrorFactory.createExportGenerationError(
        'JSON',
        '2.5MB',
        'json_serialization',
        ['book_123', 'book_456'],
        150,
        {
          errorDetails: 'Circular reference detected',
          affectedFields: ['metadata.references']
        }
      )

      // 驗證錯誤結構
      expect(generationError.code).toBe(ErrorCodes.FILE_ERROR)
      expect(generationError.details.severity).toBe('SEVERE')
      expect(generationError.details.suggestedActions).toContain('check_data_integrity')

      // 建立結果物件
      const result = UC03ErrorFactory.createResult(false, null, generationError)

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCodes.FILE_ERROR)
      expect(result.subType).toBe('EXPORT_GENERATION_FAILED')
    })

    test('模擬大量資料匯出記憶體不足流程', async () => {
      // 模擬處理1000本書的大型匯出
      const memoryError = UC03ErrorFactory.createExportMemoryError(
        1000,
        '15MB',
        '8MB',
        {
          processedBooks: 650,
          remainingBooks: 350,
          memoryPeak: '12MB'
        }
      )

      expect(memoryError.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(memoryError.details.suggestedSolution).toBe('batch_export')
      expect(memoryError.details.batchSizeRecommendation).toBe(100)

      // 模擬自動分批重試成功
      const batchResults = []
      const batchSize = memoryError.details.batchSizeRecommendation
      const totalBatches = Math.ceil(memoryError.details.booksToExport / batchSize)

      for (let i = 0; i < totalBatches; i++) {
        batchResults.push(UC03ErrorFactory.createResult(
          true,
          {
            batchNumber: i + 1,
            booksInBatch: Math.min(batchSize, memoryError.details.booksToExport - i * batchSize),
            fileName: `export_batch_${i + 1}.json`
          }
        ))
      }

      expect(batchResults).toHaveLength(10) // 1000 / 100 = 10 批次
      expect(batchResults.every(result => result.success)).toBe(true)
    })

    test('模擬瀏覽器下載被阻止流程', async () => {
      // 模擬彈出視窗攔截器阻止下載
      const downloadError = UC03ErrorFactory.createDownloadBlockedError(
        'readmoo-books-2025-01-15.json',
        '2.5MB',
        'popup_blocker',
        ['user_gesture_required', 'download_permission'],
        {
          browserInfo: 'Chrome 120.0.6099.109',
          popupBlocked: true,
          downloadAttempts: 3
        }
      )

      expect(downloadError.code).toBe(ErrorCodes.CHROME_ERROR)
      expect(downloadError.details.retryOptions).toContain('user_gesture_required')
      expect(downloadError.details.suggestedActions).toContain('disable_popup_blocker')

      // 模擬使用者手動觸發下載成功
      const manualDownloadResult = UC03ErrorFactory.createResult(
        true,
        {
          downloadMethod: 'manual_trigger',
          fileName: downloadError.details.fileName,
          fileSize: downloadError.details.fileSize,
          downloadTime: Date.now()
        }
      )

      expect(manualDownloadResult.success).toBe(true)
      expect(manualDownloadResult.data.downloadMethod).toBe('manual_trigger')
    })

    test('模擬資料完整性檢查失敗流程', async () => {
      // 模擬匯出過程中資料遺失
      const integrityError = UC03ErrorFactory.createIntegrityViolationError(
        150,
        147,
        ['book_789', 'book_012', 'book_345'],
        {
          checksumOriginal: 'abc123def456',
          checksumExported: 'abc123def000',
          corruptionDetected: true,
          affectedDataTypes: ['metadata', 'progress']
        }
      )

      expect(integrityError.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(integrityError.details.dataLossRate).toBe('2.0%')
      expect(integrityError.details.suggestedActions).toContain('retry_full_export')

      // 模擬重新匯出成功
      const retryResult = UC03ErrorFactory.createResult(
        true,
        {
          originalCount: 150,
          exportedCount: 150,
          integrityCheck: 'passed',
          checksum: 'abc123def456',
          recoveredBooks: integrityError.details.missingBooks
        }
      )

      expect(retryResult.success).toBe(true)
      expect(retryResult.data.exportedCount).toBe(150)
    })
  })

  describe('匯出格式特定測試', () => {
    test('應該支援CSV匯出錯誤處理', () => {
      const csvError = UC03ErrorFactory.createExportGenerationError(
        'CSV',
        '1.8MB',
        'csv_formatting',
        ['book_with_special_chars'],
        200,
        {
          encodingIssue: true,
          specialCharsCount: 45,
          delimiter: ','
        }
      )

      expect(csvError.details.exportFormat).toBe('CSV')
      expect(csvError.details.encodingIssue).toBe(true)
      expect(csvError.code).toBe(ErrorCodes.FILE_ERROR)
    })

    test('應該支援批次匯出進度追蹤', () => {
      const progressErrors = [
        UC03ErrorFactory.createExportProgressError(25, 'data_validation'),
        UC03ErrorFactory.createExportProgressError(60, 'file_generation'),
        UC03ErrorFactory.createExportProgressError(85, 'download_preparation')
      ]

      expect(progressErrors[0].details.earlyFailure).toBe(true)
      expect(progressErrors[1].details.lateFailure).toBe(true)
      expect(progressErrors[2].details.lateFailure).toBe(true)

      // 驗證不同階段的錯誤類型
      expect(progressErrors[0].code).toBe(ErrorCodes.FILE_ERROR)
      expect(progressErrors[1].code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(progressErrors[2].code).toBe(ErrorCodes.OPERATION_ERROR)
    })
  })

  describe('錯誤恢復策略測試', () => {
    test('應該支援自動重試機制', () => {
      // 模擬記憶體錯誤自動重試
      const memoryError = UC03ErrorFactory.createExportMemoryError(500, '10MB', '6MB')

      // 基於錯誤建議的自動調整
      const adjustedBatchSize = memoryError.details.batchSizeRecommendation
      const retryAttempt = UC03ErrorFactory.createExportMemoryError(
        adjustedBatchSize,
        '2MB',
        '6MB',
        {
          retryAttempt: 1,
          originalBatchSize: 500,
          adjustedBatchSize
        }
      )

      expect(retryAttempt.details.adjustedBatchSize).toBe(100)
      expect(retryAttempt.details.retryAttempt).toBe(1)
    })

    test('應該支援降級匯出策略', () => {
      // 模擬完整匯出失敗，降級為基本匯出
      const fullExportError = UC03ErrorFactory.createExportGenerationError(
        'JSON',
        '5MB',
        'metadata_processing',
        [],
        500,
        { includeMetadata: true, includeProgress: true }
      )

      // 降級為僅包含基本資訊的匯出
      const fallbackResult = UC03ErrorFactory.createResult(
        true,
        {
          exportMode: 'basic',
          originalMode: 'full',
          excludedFields: ['metadata', 'progress'],
          booksExported: 500,
          fileSize: '2.1MB'
        }
      )

      expect(fallbackResult.success).toBe(true)
      expect(fallbackResult.data.exportMode).toBe('basic')
    })
  })

  describe('Chrome Extension 環境相容性', () => {
    test('錯誤物件應該可以序列化', () => {
      const error = UC03ErrorFactory.createExportGenerationError('JSON')

      // 測試 JSON 序列化
      const serialized = JSON.stringify(error)
      expect(serialized).toBeDefined()

      const parsed = JSON.parse(serialized)
      expect(parsed.message).toBe(error.message)
      expect(parsed.code).toBe(error.code)
      expect(parsed.details.exportFormat).toBe('JSON')
    })

    test('錯誤物件應該支援 Service Worker 環境', () => {
      const error = UC03ErrorFactory.createDownloadBlockedError('export.json')

      // 模擬 Service Worker 中的訊息傳遞
      const messageData = {
        type: 'export_error_occurred',
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        },
        retryOptions: error.details.retryOptions
      }

      expect(messageData.error.code).toBe(ErrorCodes.CHROME_ERROR)
      expect(messageData.retryOptions).toContain('user_gesture_required')
    })
  })

  describe('效能與記憶體測試', () => {
    test('大量錯誤建立應該保持效能', () => {
      const startTime = Date.now()
      const errors = []

      // 建立 100 個不同的匯出錯誤
      for (let i = 0; i < 100; i++) {
        if (i % 4 === 0) {
          errors.push(UC03ErrorFactory.createExportGenerationError(`format_${i}`))
        } else if (i % 4 === 1) {
          errors.push(UC03ErrorFactory.createExportMemoryError(100 + i))
        } else if (i % 4 === 2) {
          errors.push(UC03ErrorFactory.createDownloadBlockedError(`file_${i}.json`))
        } else {
          errors.push(UC03ErrorFactory.createIntegrityViolationError(100, 90 + i % 10))
        }
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(200) // 100個錯誤建立應該在200ms內
      expect(errors).toHaveLength(100)

      // 驗證所有錯誤都有效
      errors.forEach(error => {
        expect(UC03ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
      })
    })

    test('快取機制應該減少記憶體使用', () => {
      // 建立大量相同類型的錯誤
      const exportErrors = []
      for (let i = 0; i < 50; i++) {
        exportErrors.push(UC03ErrorFactory.getCommonError('EXPORT_GENERATION'))
      }

      // 驗證都是相同引用 (快取有效)
      const firstError = exportErrors[0]
      exportErrors.forEach(error => {
        expect(error).toBe(firstError)
      })

      expect(Object.isFrozen(firstError)).toBe(true)
    })
  })

  describe('安全性測試', () => {
    test('sanitizeDetails 應該防止記憶體洩漏', () => {
      const hugeDetails = {
        largeBookList: new Array(10000).fill().map((_, i) => ({
          id: `book_${i}`,
          title: `Test Book ${i}`.repeat(50), // 大量重複文字
          metadata: { author: 'Test Author'.repeat(20) }
        }))
      }

      const sanitized = UC03ErrorFactory.sanitizeDetails(hugeDetails)

      expect(sanitized._truncated).toBe(true)
      expect(sanitized._originalSize).toBeGreaterThan(15000)
      expect(sanitized.largeBookList).toBeUndefined()
    })

    test('錯誤物件應該不包含敏感資訊', () => {
      const error = UC03ErrorFactory.createExportGenerationError(
        'JSON',
        '2.5MB',
        'encryption',
        [],
        100,
        {
          encryptionKey: 'secret_key_123',
          userToken: 'bearer_token_456'
        }
      )

      // 敏感資訊應該被包含但不會意外暴露在錯誤訊息中
      expect(error.message).not.toContain('secret_key_123')
      expect(error.message).not.toContain('bearer_token_456')

      // 但詳細資訊中應該保留 (由開發者控制)
      expect(error.details.encryptionKey).toBe('secret_key_123')
    })
  })

  describe('跨UC整合測試', () => {
    test('應該與其他UC錯誤系統相容', () => {
      // UC-03 錯誤
      const uc03Error = UC03ErrorFactory.createExportGenerationError()

      // 模擬與其他UC系統的錯誤格式比較
      const errorStructure = {
        hasCode: typeof uc03Error.code === 'string',
        hasSubType: typeof uc03Error.subType === 'string',
        hasDetails: typeof uc03Error.details === 'object',
        hasTimestamp: typeof uc03Error.details.timestamp === 'number',
        hasSeverity: typeof uc03Error.details.severity === 'string',
        hasToJSON: typeof uc03Error.toJSON === 'function'
      }

      // 驗證符合統一錯誤格式
      Object.values(errorStructure).forEach(hasProperty => {
        expect(hasProperty).toBe(true)
      })
    })
  })
})
