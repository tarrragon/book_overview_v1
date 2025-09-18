/**
 * UC03ErrorFactory 單元測試
 * 測試 UC-03 資料匯出專用錯誤建立工廠的所有功能
 * 基於 UC-01/UC-02 成功測試模式，針對匯出場景優化
 */

import { UC03ErrorFactory } from '../../../../src/core/errors/UC03ErrorFactory.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC03ErrorFactory', () => {
  afterEach(() => {
    // 清除快取避免測試間影響
    UC03ErrorFactory.clearCache()
  })

  describe('createError', () => {
    test('應該建立基本的 UC-03 錯誤', () => {
      const error = UC03ErrorFactory.createError(
        'DATA_EXPORT_GENERATION_FAILED',
        '匯出檔案生成失敗'
      )

      expect(error).toBeInstanceOf(Error)
      expect(error.code).toBe(ErrorCodes.FILE_ERROR)
      expect(error.message).toBe('匯出檔案生成失敗')
      expect(error.details.originalCode).toBe('DATA_EXPORT_GENERATION_FAILED')
    })

    test('應該建立帶有詳細資訊的錯誤', () => {
      const details = {
        exportFormat: 'JSON',
        dataSize: '2.5MB'
      }

      const error = UC03ErrorFactory.createError(
        'DATA_EXPORT_GENERATION_FAILED',
        '匯出失敗',
        details
      )

      expect(error.details).toMatchObject(details)
      expect(error.details.originalCode).toBe('DATA_EXPORT_GENERATION_FAILED')
    })
  })

  describe('createResult', () => {
    test('應該建立成功結果物件', () => {
      const result = UC03ErrorFactory.createResult(true, {
        fileName: 'export.json',
        fileSize: '2.5MB'
      })

      expect(result).toEqual({
        success: true,
        data: {
          fileName: 'export.json',
          fileSize: '2.5MB'
        },
        code: 'SUCCESS',
        message: 'Export completed successfully'
      })
    })

    test('應該建立失敗結果物件', () => {
      const error = UC03ErrorFactory.createError(
        'DATA_EXPORT_GENERATION_FAILED',
        '生成失敗'
      )

      const result = UC03ErrorFactory.createResult(false, null, error)

      expect(result).toEqual({
        success: false,
        error: '生成失敗',
        code: ErrorCodes.FILE_ERROR,
        details: error.details,
        subType: 'EXPORT_GENERATION_FAILED'
      })
    })

    test('應該處理簡單錯誤物件', () => {
      const simpleError = { message: '簡單錯誤' }
      const result = UC03ErrorFactory.createResult(false, null, simpleError)

      expect(result).toEqual({
        success: false,
        error: '簡單錯誤',
        code: ErrorCodes.UNKNOWN_ERROR,
        details: {},
        subType: 'UNKNOWN'
      })
    })
  })

  describe('createExportGenerationError', () => {
    test('應該建立匯出生成錯誤', () => {
      const error = UC03ErrorFactory.createExportGenerationError(
        'JSON',
        '2.5MB',
        'json_serialization',
        ['book_1', 'book_2'],
        150,
        { customField: 'value' }
      )

      expect(error.code).toBe(ErrorCodes.FILE_ERROR)
      expect(error.message).toBe('匯出檔案生成失敗')
      expect(error.details).toMatchObject({
        exportFormat: 'JSON',
        dataSize: '2.5MB',
        failurePoint: 'json_serialization',
        corruptedBooks: ['book_1', 'book_2'],
        totalBooks: 150,
        suggestedActions: ['retry_export', 'check_data_integrity', 'contact_support'],
        userGuidance: '請檢查資料完整性並重新嘗試匯出',
        customField: 'value'
      })
    })

    test('應該使用預設參數', () => {
      const error = UC03ErrorFactory.createExportGenerationError()

      expect(error.details.exportFormat).toBe('JSON')
      expect(error.details.dataSize).toBe('unknown')
      expect(error.details.failurePoint).toBe('unknown')
      expect(error.details.corruptedBooks).toEqual([])
      expect(error.details.totalBooks).toBe(0)
    })
  })

  describe('createExportMemoryError', () => {
    test('應該建立記憶體不足錯誤', () => {
      const error = UC03ErrorFactory.createExportMemoryError(
        1000,
        '15MB',
        '8MB',
        { reason: 'large_dataset' }
      )

      expect(error.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(error.message).toBe('匯出大量資料時記憶體不足')
      expect(error.details).toMatchObject({
        booksToExport: 1000,
        estimatedSize: '15MB',
        availableMemory: '8MB',
        suggestedSolution: 'batch_export',
        suggestedActions: ['reduce_batch_size', 'close_other_tabs', 'try_smaller_export'],
        userGuidance: '建議分批匯出或減少同時匯出的書籍數量',
        batchSizeRecommendation: 100,
        reason: 'large_dataset'
      })
    })

    test('應該正確計算批次大小建議', () => {
      const error1 = UC03ErrorFactory.createExportMemoryError(50)
      expect(error1.details.batchSizeRecommendation).toBe(50)

      const error2 = UC03ErrorFactory.createExportMemoryError(500)
      expect(error2.details.batchSizeRecommendation).toBe(100)
    })
  })

  describe('createDownloadBlockedError', () => {
    test('應該建立下載被阻止錯誤', () => {
      const error = UC03ErrorFactory.createDownloadBlockedError(
        'export.json',
        '2.5MB',
        'popup_blocker',
        ['user_gesture_required', 'download_permission'],
        { browserInfo: 'Chrome 120' }
      )

      expect(error.code).toBe(ErrorCodes.CHROME_ERROR)
      expect(error.message).toBe('瀏覽器阻止檔案下載')
      expect(error.details).toMatchObject({
        fileName: 'export.json',
        fileSize: '2.5MB',
        blockReason: 'popup_blocker',
        retryOptions: ['user_gesture_required', 'download_permission'],
        suggestedActions: ['enable_downloads', 'disable_popup_blocker', 'manual_download'],
        userGuidance: '請允許下載權限或手動點擊下載按鈕',
        downloadUrl: null,
        browserInfo: 'Chrome 120'
      })
    })

    test('應該使用預設參數', () => {
      const error = UC03ErrorFactory.createDownloadBlockedError()

      expect(error.details.fileName).toBe('export-file')
      expect(error.details.fileSize).toBe('unknown')
      expect(error.details.blockReason).toBe('unknown')
      expect(error.details.retryOptions).toEqual(['user_gesture_required', 'download_permission'])
    })
  })

  describe('createIntegrityViolationError', () => {
    test('應該建立完整性違規錯誤', () => {
      const error = UC03ErrorFactory.createIntegrityViolationError(
        150,
        147,
        ['book_1', 'book_2', 'book_3'],
        { checksum: 'abc123' }
      )

      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.message).toBe('匯出資料完整性檢查失敗')
      expect(error.details).toMatchObject({
        originalCount: 150,
        exportedCount: 147,
        missingBooks: ['book_1', 'book_2', 'book_3'],
        integrityCheckFailed: true,
        dataLossRate: '2.0%',
        suggestedActions: ['retry_full_export', 'verify_source_data', 'contact_support'],
        userGuidance: '檢測到資料遺失，建議重新進行完整匯出',
        checksum: 'abc123'
      })
    })

    test('應該正確計算資料遺失率', () => {
      const error1 = UC03ErrorFactory.createIntegrityViolationError(100, 90)
      expect(error1.details.dataLossRate).toBe('10.0%')

      const error2 = UC03ErrorFactory.createIntegrityViolationError(100, 100)
      expect(error2.details.dataLossRate).toBe('0.0%')

      const error3 = UC03ErrorFactory.createIntegrityViolationError(0, 0)
      expect(error3.details.dataLossRate).toBe('0%')
    })
  })

  describe('createExportProgressError', () => {
    test('應該為早期失敗建立生成錯誤', () => {
      const error = UC03ErrorFactory.createExportProgressError(
        30,
        'data_preparation',
        { context: 'early_stage' }
      )

      expect(error.code).toBe(ErrorCodes.FILE_ERROR)
      expect(error.details.progress).toBe(30)
      expect(error.details.stage).toBe('data_preparation')
      expect(error.details.earlyFailure).toBe(true)
    })

    test('應該為後期失敗建立記憶體錯誤', () => {
      const error = UC03ErrorFactory.createExportProgressError(
        80,
        'file_generation',
        { context: 'late_stage' }
      )

      expect(error.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(error.details.progress).toBe(80)
      expect(error.details.stage).toBe('file_generation')
      expect(error.details.lateFailure).toBe(true)
    })
  })

  describe('getCommonError - 快取機制', () => {
    test('應該快取常用錯誤', () => {
      const error1 = UC03ErrorFactory.getCommonError('EXPORT_GENERATION')
      const error2 = UC03ErrorFactory.getCommonError('EXPORT_GENERATION')

      expect(error1).toBe(error2) // 相同參考
      expect(Object.isFrozen(error1)).toBe(true)
      expect(error1.details.cached).toBe(true)
    })

    test('應該支援所有快取錯誤類型', () => {
      const cacheTypes = [
        'EXPORT_GENERATION',
        'EXPORT_MEMORY',
        'DOWNLOAD_BLOCKED',
        'INTEGRITY_VIOLATION'
      ]

      cacheTypes.forEach(type => {
        const error = UC03ErrorFactory.getCommonError(type)
        expect(error).toBeInstanceOf(Error)
        expect(error.details.cached).toBe(true)
      })
    })

    test('應該處理未知快取類型', () => {
      const error = UC03ErrorFactory.getCommonError('UNKNOWN_TYPE')
      expect(error).toBeNull()
    })
  })

  describe('clearCache', () => {
    test('應該清除錯誤快取', () => {
      // 建立快取
      UC03ErrorFactory.getCommonError('EXPORT_GENERATION')

      // 清除快取
      UC03ErrorFactory.clearCache()

      // 重新取得應該是新物件
      const error1 = UC03ErrorFactory.getCommonError('EXPORT_GENERATION')
      const error2 = UC03ErrorFactory.getCommonError('EXPORT_GENERATION')

      expect(error1).toBe(error2) // 新快取中相同
      expect(error1.details.cached).toBe(true)
    })
  })

  describe('sanitizeDetails', () => {
    test('應該保留正常大小的詳細資訊', () => {
      const details = {
        fileName: 'export.json',
        fileSize: '2.5MB',
        books: ['book1', 'book2']
      }

      const sanitized = UC03ErrorFactory.sanitizeDetails(details)
      expect(sanitized).toEqual(details)
    })

    test('應該截斷過大的詳細資訊', () => {
      const largeDetails = {
        largeData: 'x'.repeat(20000) // 超過 15KB 限制
      }

      const sanitized = UC03ErrorFactory.sanitizeDetails(largeDetails)

      expect(sanitized._truncated).toBe(true)
      expect(sanitized._originalSize).toBeGreaterThan(15000)
      expect(sanitized._message).toBe('Details truncated due to size limit')
      expect(sanitized.summary).toBe('Large export data set truncated for memory safety')
    })

    test('應該處理無效輸入', () => {
      expect(UC03ErrorFactory.sanitizeDetails(null)).toEqual({})
      expect(UC03ErrorFactory.sanitizeDetails(undefined)).toEqual({})
      expect(UC03ErrorFactory.sanitizeDetails('string')).toEqual({})
      expect(UC03ErrorFactory.sanitizeDetails(123)).toEqual({})
    })
  })

  describe('isValidUC03Error', () => {
    test('應該驗證有效的 UC-03 錯誤', () => {
      const error = UC03ErrorFactory.createError(
        'DATA_EXPORT_GENERATION_FAILED',
        '測試訊息'
      )

      expect(UC03ErrorFactory.isValidUC03Error(error)).toBe(true)
    })

    test('應該拒絕無效的錯誤', () => {
      const invalidError = new Error('普通錯誤')
      expect(UC03ErrorFactory.isValidUC03Error(invalidError)).toBe(false)

      expect(UC03ErrorFactory.isValidUC03Error(null)).toBe(false)
      expect(UC03ErrorFactory.isValidUC03Error({})).toBe(false)
    })
  })

  describe('資料匯出場景專用測試', () => {
    test('生成錯誤應該包含匯出指引', () => {
      const error = UC03ErrorFactory.createExportGenerationError()
      expect(error.details.userGuidance).toContain('檢查資料完整性')
      expect(error.details.suggestedActions).toContain('retry_export')
    })

    test('記憶體錯誤應該提供分批建議', () => {
      const error = UC03ErrorFactory.createExportMemoryError(1000)
      expect(error.details.suggestedSolution).toBe('batch_export')
      expect(error.details.userGuidance).toContain('分批匯出')
      expect(error.details.batchSizeRecommendation).toBe(100)
    })

    test('下載錯誤應該提供權限指引', () => {
      const error = UC03ErrorFactory.createDownloadBlockedError()
      expect(error.details.userGuidance).toContain('允許下載權限')
      expect(error.details.suggestedActions).toContain('enable_downloads')
    })

    test('完整性錯誤應該提供重新匯出建議', () => {
      const error = UC03ErrorFactory.createIntegrityViolationError(100, 95)
      expect(error.details.userGuidance).toContain('重新進行完整匯出')
      expect(error.details.suggestedActions).toContain('retry_full_export')
    })
  })

  describe('效能測試', () => {
    test('常用錯誤建立應該快速', () => {
      const startTime = Date.now()

      for (let i = 0; i < 100; i++) {
        UC03ErrorFactory.getCommonError('EXPORT_GENERATION')
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(10) // 100次快取存取應該在10ms內
    })

    test('錯誤建立應該在合理時間內完成', () => {
      const startTime = Date.now()

      for (let i = 0; i < 50; i++) {
        UC03ErrorFactory.createExportGenerationError(
          'JSON',
          `${i}MB`,
          `stage_${i}`,
          [`book_${i}`],
          100 + i
        )
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(100) // 50個複雜錯誤應該在100ms內
    })
  })
})
