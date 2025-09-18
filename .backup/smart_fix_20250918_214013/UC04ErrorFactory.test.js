/**
 * UC04ErrorFactory 單元測試
 * 測試 UC-04 資料匯入專用錯誤建立工廠的所有功能
 * 基於 UC-01/UC-02/UC-03 成功測試模式，針對匯入場景優化
 */

import { UC04ErrorFactory } from '../../../../src/core/errors/UC04ErrorFactory.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC04ErrorFactory', () => {
  afterEach(() => {
    // 清除快取避免測試間影響
    UC04ErrorFactory.clearCache()
  })

  describe('createError', () => {
    test('應該建立基本的 UC-04 錯誤', () => {
      const error = UC04ErrorFactory.createError(
        'DATA_IMPORT_FILE_INVALID',
        '匯入檔案格式無效'
      )

      expect(error).toBeInstanceOf(Error)
      expect(error.code).toBe(ErrorCodes.FILE_ERROR)
      expect(error.message).toBe('匯入檔案格式無效')
      expect(error.details.originalCode).toBe('DATA_IMPORT_FILE_INVALID')
    })

    test('應該建立帶有詳細資訊的錯誤', () => {
      const details = {
        fileName: 'backup.json',
        fileSize: '2.5MB'
      }

      const error = UC04ErrorFactory.createError(
        'DATA_IMPORT_FILE_INVALID',
        '匯入失敗',
        details
      )

      expect(error.details).toMatchObject(details)
      expect(error.details.originalCode).toBe('DATA_IMPORT_FILE_INVALID')
    })
  })

  describe('createResult', () => {
    test('應該建立成功結果物件', () => {
      const result = UC04ErrorFactory.createResult(true, {
        importedBooks: 150,
        fileName: 'backup.json'
      })

      expect(result).toEqual({
        success: true,
        data: {
          importedBooks: 150,
          fileName: 'backup.json'
        },
        code: 'SUCCESS',
        message: 'Import completed successfully'
      })
    })

    test('應該建立失敗結果物件', () => {
      const error = UC04ErrorFactory.createError(
        'DATA_IMPORT_FILE_INVALID',
        '檔案無效'
      )

      const result = UC04ErrorFactory.createResult(false, null, error)

      expect(result).toEqual({
        success: false,
        error: '檔案無效',
        code: ErrorCodes.FILE_ERROR,
        details: error.details,
        subType: 'IMPORT_FILE_INVALID'
      })
    })

    test('應該處理簡單錯誤物件', () => {
      const simpleError = { message: '簡單錯誤' }
      const result = UC04ErrorFactory.createResult(false, null, simpleError)

      expect(result).toEqual({
        success: false,
        error: '簡單錯誤',
        code: ErrorCodes.UNKNOWN_ERROR,
        details: {},
        subType: 'UNKNOWN'
      })
    })
  })

  describe('createImportFileError', () => {
    test('應該建立檔案格式錯誤', () => {
      const error = UC04ErrorFactory.createImportFileError(
        'invalid.json',
        '500KB',
        [
          { field: 'books', issue: 'not_array' },
          { field: 'metadata.version', issue: 'missing_required' }
        ],
        'Valid JSON backup format',
        { source: 'file_upload' }
      )

      expect(error.code).toBe(ErrorCodes.FILE_ERROR)
      expect(error.message).toBe('匯入檔案格式無效')
      expect(error.details).toMatchObject({
        fileName: 'invalid.json',
        fileSize: '500KB',
        validationErrors: [
          { field: 'books', issue: 'not_array' },
          { field: 'metadata.version', issue: 'missing_required' }
        ],
        expectedFormat: 'Valid JSON backup format',
        suggestedActions: ['select_valid_file', 'check_file_format', 'contact_support'],
        userGuidance: '請選擇有效的 JSON 備份檔案',
        source: 'file_upload'
      })
    })

    test('應該包含檔案驗證資訊', () => {
      const error = UC04ErrorFactory.createImportFileError('test.json')

      expect(error.details.fileValidation).toMatchObject({
        hasValidExtension: true,
        hasValidSize: false, // 因為預設是 'unknown'
        passedInitialCheck: true // 因為預設 validationErrors 是空陣列
      })
    })

    test('應該使用預設參數', () => {
      const error = UC04ErrorFactory.createImportFileError()

      expect(error.details.fileName).toBe('unknown-file.json')
      expect(error.details.fileSize).toBe('unknown')
      expect(error.details.validationErrors).toEqual([])
      expect(error.details.expectedFormat).toBe('JSON backup format')
    })
  })

  describe('createImportParsingError', () => {
    test('應該建立JSON解析錯誤', () => {
      const error = UC04ErrorFactory.createImportParsingError(
        'SyntaxError: Unexpected token } in JSON at position 1234',
        { line: 45, column: 12 },
        '1.2MB',
        'file_corruption',
        { corruptionType: 'unexpected_eof' }
      )

      expect(error.code).toBe(ErrorCodes.PARSE_ERROR)
      expect(error.message).toBe('JSON 檔案解析錯誤')
      expect(error.details).toMatchObject({
        parseError: 'SyntaxError: Unexpected token } in JSON at position 1234',
        errorPosition: { line: 45, column: 12 },
        fileSize: '1.2MB',
        possibleCause: 'file_corruption',
        suggestedActions: ['check_file_integrity', 'try_text_editor', 'request_new_backup'],
        userGuidance: '檔案可能損壞，請檢查檔案完整性或重新產生備份',
        corruptionType: 'unexpected_eof'
      })
    })

    test('應該包含除錯資訊', () => {
      const error = UC04ErrorFactory.createImportParsingError(
        'SyntaxError: Unexpected end of JSON input'
      )

      expect(error.details.debugInfo).toMatchObject({
        isValidJSON: false,
        truncatedContent: true, // 因為包含 'Unexpected end'
        hasUnescapedChars: false,
        estimatedCorruptionPoint: 'Line unknown'
      })
    })

    test('應該使用預設參數', () => {
      const error = UC04ErrorFactory.createImportParsingError()

      expect(error.details.parseError).toBe('Unknown JSON syntax error')
      expect(error.details.errorPosition).toEqual({ line: 0, column: 0 })
      expect(error.details.possibleCause).toBe('file_corruption')
    })
  })

  describe('createImportMergeError', () => {
    test('應該建立資料合併衝突錯誤', () => {
      const conflictedBooks = [
        {
          id: 'book_123',
          existing: { progress: '75%', lastRead: '2025-01-10' },
          importing: { progress: '60%', lastRead: '2025-01-08' }
        },
        {
          id: 'book_456',
          existing: { metadata: { author: 'Author A' } },
          importing: { metadata: { author: 'Author B' } }
        }
      ]

      const error = UC04ErrorFactory.createImportMergeError(
        'duplicate_books_with_different_progress',
        conflictedBooks,
        'user_decision_required',
        { importSource: 'backup_2025_01_15' }
      )

      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.message).toBe('資料合併時發生衝突')
      expect(error.details).toMatchObject({
        conflictType: 'duplicate_books_with_different_progress',
        conflictedBooks,
        conflictCount: 2,
        conflictRate: '2.0%', // 2/100 * 100
        mergeStrategy: 'user_decision_required',
        suggestedActions: ['review_conflicts', 'choose_merge_strategy', 'manual_resolution'],
        userGuidance: '發現資料衝突，需要選擇合併策略或手動解決',
        importSource: 'backup_2025_01_15'
      })
    })

    test('應該包含衝突分析', () => {
      const conflictedBooks = [
        {
          id: 'book_1',
          existing: { progress: '50%', metadata: { tag: 'A' }, lastRead: '2025-01-01' },
          importing: { progress: '75%', metadata: { tag: 'B' }, lastRead: '2025-01-02' }
        }
      ]

      const error = UC04ErrorFactory.createImportMergeError(
        'multiple_conflicts',
        conflictedBooks
      )

      expect(error.details.conflictAnalysis).toMatchObject({
        hasProgressConflicts: true,
        hasMetadataConflicts: true,
        hasTimestampConflicts: true
      })
    })

    test('應該限制顯示的衝突書籍數量', () => {
      const manyBooks = Array.from({ length: 15 }, (_, i) => ({ id: `book_${i}` }))

      const error = UC04ErrorFactory.createImportMergeError(
        'many_conflicts',
        manyBooks
      )

      expect(error.details.conflictedBooks).toHaveLength(10) // 限制為10個
      expect(error.details.conflictCount).toBe(15) // 但總數正確
    })

    test('應該使用預設參數', () => {
      const error = UC04ErrorFactory.createImportMergeError()

      expect(error.details.conflictType).toBe('duplicate_books_with_different_data')
      expect(error.details.conflictedBooks).toEqual([])
      expect(error.details.mergeStrategy).toBe('user_decision_required')
      expect(error.details.conflictCount).toBe(0)
    })
  })

  describe('createImportStorageError', () => {
    test('應該建立儲存空間溢出錯誤', () => {
      const error = UC04ErrorFactory.createImportStorageError(
        '3.2MB',
        '2.8MB',
        '5.0MB',
        ['clear_old_data', 'selective_import'],
        { importType: 'full_backup' }
      )

      expect(error.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(error.message).toBe('匯入資料將超出儲存限制')
      expect(error.details).toMatchObject({
        existingDataSize: '3.2MB',
        importDataSize: '2.8MB',
        totalSize: '6.0MB',
        storageLimit: '5.0MB',
        overflowAmount: '1.0MB',
        storageUsageRate: '120.0%', // (6.0/5.0) * 100
        suggestedActions: ['clear_old_data', 'selective_import'],
        userGuidance: '儲存空間不足，建議清理舊資料或選擇性匯入',
        importType: 'full_backup'
      })
    })

    test('應該包含儲存分析', () => {
      const error = UC04ErrorFactory.createImportStorageError(
        '2.0MB',
        '4.0MB',
        '5.0MB'
      )

      expect(error.details.storageAnalysis).toMatchObject({
        canPartialImport: true, // 4.0 > 1.0 (overflow)
        recommendedCleanup: '1MB', // Math.ceil(1.0)
        estimatedBooks: 400, // 4.0 * 100
        priorityData: ['recent_progress', 'bookmarks', 'reading_history']
      })
    })

    test('應該包含清理選項', () => {
      const error = UC04ErrorFactory.createImportStorageError()

      expect(error.details.cleanupOptions).toMatchObject({
        removeOldData: '移除6個月前的閱讀記錄',
        compressMetadata: '壓縮書籍中繼資料',
        selectiveImport: '僅匯入指定類別的書籍',
        increaseQuota: '申請更大儲存空間'
      })
    })

    test('應該正確計算儲存溢出', () => {
      // 測試無溢出情況
      const noOverflowError = UC04ErrorFactory.createImportStorageError(
        '2.0MB',
        '2.0MB',
        '5.0MB'
      )
      expect(noOverflowError.details.overflowAmount).toBe('0.0MB')
      expect(noOverflowError.details.storageUsageRate).toBe('80.0%')

      // 測試大量溢出情況
      const largeOverflowError = UC04ErrorFactory.createImportStorageError(
        '3.0MB',
        '5.0MB',
        '5.0MB'
      )
      expect(largeOverflowError.details.overflowAmount).toBe('3.0MB')
      expect(largeOverflowError.details.storageUsageRate).toBe('160.0%')
    })
  })

  describe('createImportProgressError', () => {
    test('應該為早期失敗建立檔案錯誤', () => {
      const error = UC04ErrorFactory.createImportProgressError(
        30,
        'file_validation',
        { fileName: 'early-fail.json', context: 'early_stage' }
      )

      expect(error.code).toBe(ErrorCodes.FILE_ERROR)
      expect(error.details.progress).toBe(30)
      expect(error.details.stage).toBe('file_validation')
      expect(error.details.earlyFailure).toBe(true)
      expect(error.details.fileName).toBe('early-fail.json')
    })

    test('應該為後期解析失敗建立解析錯誤', () => {
      const error = UC04ErrorFactory.createImportProgressError(
        75,
        'json_parsing',
        { fileSize: '2MB', context: 'late_stage' }
      )

      expect(error.code).toBe(ErrorCodes.PARSE_ERROR)
      expect(error.details.progress).toBe(75)
      expect(error.details.stage).toBe('json_parsing')
      expect(error.details.lateFailure).toBe(true)
      expect(error.details.fileSize).toBe('2MB')
    })

    test('應該為後期儲存失敗建立儲存錯誤', () => {
      const error = UC04ErrorFactory.createImportProgressError(
        90,
        'data_storage',
        {
          existingSize: '3MB',
          importSize: '3MB',
          storageLimit: '5MB',
          context: 'late_stage'
        }
      )

      expect(error.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(error.details.progress).toBe(90)
      expect(error.details.stage).toBe('data_storage')
      expect(error.details.lateFailure).toBe(true)
    })
  })

  describe('getCommonError - 快取機制', () => {
    test('應該快取常用錯誤', () => {
      const error1 = UC04ErrorFactory.getCommonError('IMPORT_FILE')
      const error2 = UC04ErrorFactory.getCommonError('IMPORT_FILE')

      expect(error1).toBe(error2) // 相同參考
      expect(Object.isFrozen(error1)).toBe(true)
      expect(error1.details.cached).toBe(true)
    })

    test('應該支援所有快取錯誤類型', () => {
      const cacheTypes = [
        'IMPORT_FILE',
        'IMPORT_PARSING',
        'IMPORT_MERGE',
        'IMPORT_STORAGE'
      ]

      cacheTypes.forEach(type => {
        const error = UC04ErrorFactory.getCommonError(type)
        expect(error).toBeInstanceOf(Error)
        expect(error.details.cached).toBe(true)
      })
    })

    test('應該處理未知快取類型', () => {
      const error = UC04ErrorFactory.getCommonError('UNKNOWN_TYPE')
      expect(error).toBeNull()
    })
  })

  describe('clearCache', () => {
    test('應該清除錯誤快取', () => {
      // 建立快取
      UC04ErrorFactory.getCommonError('IMPORT_FILE')

      // 清除快取
      UC04ErrorFactory.clearCache()

      // 重新取得應該是新物件
      const error1 = UC04ErrorFactory.getCommonError('IMPORT_FILE')
      const error2 = UC04ErrorFactory.getCommonError('IMPORT_FILE')

      expect(error1).toBe(error2) // 新快取中相同
      expect(error1.details.cached).toBe(true)
    })
  })

  describe('sanitizeDetails', () => {
    test('應該保留正常大小的詳細資訊', () => {
      const details = {
        fileName: 'backup.json',
        fileSize: '2.5MB',
        books: ['book1', 'book2']
      }

      const sanitized = UC04ErrorFactory.sanitizeDetails(details)
      expect(sanitized).toEqual(details)
    })

    test('應該截斷過大的詳細資訊', () => {
      const largeDetails = {
        largeData: 'x'.repeat(20000) // 超過 15KB 限制
      }

      const sanitized = UC04ErrorFactory.sanitizeDetails(largeDetails)

      expect(sanitized._truncated).toBe(true)
      expect(sanitized._originalSize).toBeGreaterThan(15000)
      expect(sanitized._message).toBe('Details truncated due to size limit')
      expect(sanitized.summary).toBe('Large import data set truncated for memory safety')
    })

    test('應該處理無效輸入', () => {
      expect(UC04ErrorFactory.sanitizeDetails(null)).toEqual({})
      expect(UC04ErrorFactory.sanitizeDetails(undefined)).toEqual({})
      expect(UC04ErrorFactory.sanitizeDetails('string')).toEqual({})
      expect(UC04ErrorFactory.sanitizeDetails(123)).toEqual({})
    })
  })

  describe('isValidUC04Error', () => {
    test('應該驗證有效的 UC-04 錯誤', () => {
      const error = UC04ErrorFactory.createError(
        'DATA_IMPORT_FILE_INVALID',
        '測試訊息'
      )

      expect(UC04ErrorFactory.isValidUC04Error(error)).toBe(true)
    })

    test('應該拒絕無效的錯誤', () => {
      const invalidError = new Error('普通錯誤')
      expect(UC04ErrorFactory.isValidUC04Error(invalidError)).toBe(false)

      expect(UC04ErrorFactory.isValidUC04Error(null)).toBe(false)
      expect(UC04ErrorFactory.isValidUC04Error({})).toBe(false)
    })

    test('應該檢查UC-04相關的subType', () => {
      const validError = UC04ErrorFactory.createImportFileError()
      expect(UC04ErrorFactory.isValidUC04Error(validError)).toBe(true)

      // 建立一個不相關的錯誤
      const otherError = new Error('其他錯誤')
      otherError.code = ErrorCodes.FILE_ERROR
      otherError.subType = 'OTHER_ERROR'
      otherError.details = {}

      expect(UC04ErrorFactory.isValidUC04Error(otherError)).toBe(false)
    })
  })

  describe('資料匯入場景專用測試', () => {
    test('檔案錯誤應該包含匯入指引', () => {
      const error = UC04ErrorFactory.createImportFileError()
      expect(error.details.userGuidance).toContain('選擇有效的 JSON 備份檔案')
      expect(error.details.suggestedActions).toContain('select_valid_file')
      expect(error.details.recoveryOptions).toContain('try_different_file')
    })

    test('解析錯誤應該提供修復建議', () => {
      const error = UC04ErrorFactory.createImportParsingError()
      expect(error.details.userGuidance).toContain('檔案完整性')
      expect(error.details.suggestedActions).toContain('check_file_integrity')
      expect(error.details.recoveryOptions).toContain('manual_json_repair')
    })

    test('合併錯誤應該提供決策選項', () => {
      const error = UC04ErrorFactory.createImportMergeError()
      expect(error.details.userGuidance).toContain('選擇合併策略')
      expect(error.details.resolutionOptions.keepExisting).toBe('保留現有資料')
      expect(error.details.resolutionOptions.useImported).toBe('使用匯入資料')
    })

    test('儲存錯誤應該提供空間管理建議', () => {
      const error = UC04ErrorFactory.createImportStorageError()
      expect(error.details.userGuidance).toContain('清理舊資料')
      expect(error.details.cleanupOptions.removeOldData).toContain('6個月前')
      expect(error.details.storageAnalysis.priorityData).toContain('recent_progress')
    })
  })

  describe('效能測試', () => {
    test('常用錯誤建立應該快速', () => {
      const startTime = Date.now()

      for (let i = 0; i < 100; i++) {
        UC04ErrorFactory.getCommonError('IMPORT_FILE')
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(10) // 100次快取存取應該在10ms內
    })

    test('錯誤建立應該在合理時間內完成', () => {
      const startTime = Date.now()

      for (let i = 0; i < 50; i++) {
        UC04ErrorFactory.createImportFileError(
          `file_${i}.json`,
          `${i}MB`,
          [{ field: `field_${i}`, issue: 'test' }],
          'JSON backup',
          { testIndex: i }
        )
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(100) // 50個複雜錯誤應該在100ms內
    })
  })
})
