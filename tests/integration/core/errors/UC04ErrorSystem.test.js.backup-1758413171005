/**
 * UC04ErrorSystem 整合測試
 * 測試 UC04ErrorAdapter 和 UC04ErrorFactory 的整合協作
 * 模擬真實的資料匯入使用場景
 */

import { UC04ErrorAdapter } from '../../../../src/core/errors/UC04ErrorAdapter.js'
import { UC04ErrorFactory } from '../../../../src/core/errors/UC04ErrorFactory.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC04ErrorSystem 整合測試', () => {
  afterEach(() => {
    UC04ErrorFactory.clearCache()
  })

  describe('Adapter 與 Factory 協作', () => {
    test('Factory 建立的錯誤應該通過 Adapter 驗證', () => {
      const error = UC04ErrorFactory.createError(
        'DATA_IMPORT_FILE_INVALID',
        '匯入檔案格式無效'
      )

      expect(UC04ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
      expect(UC04ErrorFactory.isValidUC04Error(error)).toBe(true)
    })

    test('所有 Factory 方法產生的錯誤都應該有效', () => {
      const errors = [
        UC04ErrorFactory.createImportFileError('test.json'),
        UC04ErrorFactory.createImportParsingError('Parse error'),
        UC04ErrorFactory.createImportMergeError('conflict', []),
        UC04ErrorFactory.createImportStorageError('2MB', '4MB', '5MB')
      ]

      errors.forEach(error => {
        expect(UC04ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
        expect(UC04ErrorFactory.isValidUC04Error(error)).toBe(true)
      })
    })
  })

  describe('資料匯入完整流程模擬', () => {
    test('模擬檔案格式驗證失敗流程', async () => {
      // 模擬上傳無效檔案
      const fileError = UC04ErrorFactory.createImportFileError(
        'corrupted-backup.json',
        '500KB',
        [
          { field: 'books', issue: 'not_array' },
          { field: 'metadata.version', issue: 'missing_required' },
          { field: 'metadata.timestamp', issue: 'invalid_format' }
        ],
        'Valid Readmoo backup JSON',
        {
          uploadSource: 'drag_drop',
          fileLastModified: '2025-01-10T10:00:00Z',
          expectedVersion: '2.1.0',
          detectedFormat: 'unknown'
        }
      )

      // 驗證錯誤結構
      expect(fileError.code).toBe(ErrorCodes.FILE_ERROR)
      expect(fileError.details.severity).toBe('SEVERE')
      expect(fileError.details.suggestedActions).toContain('select_valid_file')
      expect(fileError.details.validationErrors).toHaveLength(3)

      // 建立結果物件
      const result = UC04ErrorFactory.createResult(false, null, fileError)

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCodes.FILE_ERROR)
      expect(result.subType).toBe('IMPORT_FILE_INVALID')
    })

    test('模擬大型JSON檔案解析失敗流程', async () => {
      // 模擬處理2MB JSON檔案解析錯誤
      const parseError = UC04ErrorFactory.createImportParsingError(
        'SyntaxError: Unexpected token } in JSON at position 1,234,567',
        { line: 4567, column: 23 },
        '2.1MB',
        'partial_file_corruption',
        {
          bytesProcessed: 1234567,
          totalBytes: 2200000,
          progressWhenFailed: 56,
          possibleCauses: ['incomplete_download', 'storage_corruption']
        }
      )

      expect(parseError.code).toBe(ErrorCodes.PARSE_ERROR)
      expect(parseError.details.debugInfo.truncatedContent).toBe(false)
      expect(parseError.details.suggestedActions).toContain('check_file_integrity')

      // 模擬重新下載並解析成功
      const retryResult = UC04ErrorFactory.createResult(
        true,
        {
          fileName: 'readmoo-backup-redownload.json',
          fileSize: '2.1MB',
          booksImported: 450,
          parseTime: '2.3s',
          recoveryMethod: 'fresh_download'
        }
      )

      expect(retryResult.success).toBe(true)
      expect(retryResult.data.booksImported).toBe(450)
    })

    test('模擬資料合併衝突處理流程', async () => {
      // 模擬匯入與現有資料的複雜衝突
      const conflictedBooks = [
        {
          id: 'book_12345',
          existing: {
            progress: '85%',
            lastRead: '2025-01-15T20:30:00Z',
            bookmarks: 12,
            notes: 5
          },
          importing: {
            progress: '75%',
            lastRead: '2025-01-10T15:45:00Z',
            bookmarks: 8,
            notes: 3
          }
        },
        {
          id: 'book_67890',
          existing: {
            metadata: { tags: ['技術', '程式設計'], rating: 5 },
            customData: { priority: 'high' }
          },
          importing: {
            metadata: { tags: ['技術', 'AI'], rating: 4 },
            customData: { priority: 'medium' }
          }
        }
      ]

      const mergeError = UC04ErrorFactory.createImportMergeError(
        'complex_data_conflicts',
        conflictedBooks,
        'smart_merge_with_user_review',
        {
          totalConflicts: 15,
          conflictTypes: ['progress_mismatch', 'metadata_difference', 'timestamp_conflict'],
          importSource: 'backup_2025_01_10.json',
          mergeComplexity: 'high',
          estimatedResolutionTime: '5-10 minutes'
        }
      )

      expect(mergeError.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(mergeError.details.conflictAnalysis.hasProgressConflicts).toBe(true)
      expect(mergeError.details.conflictAnalysis.hasMetadataConflicts).toBe(true)
      expect(mergeError.details.conflictAnalysis.hasTimestampConflicts).toBe(true)

      // 模擬用戶選擇合併策略後成功
      const mergeResult = UC04ErrorFactory.createResult(
        true,
        {
          mergeStrategy: 'keep_latest_by_timestamp',
          resolvedConflicts: 15,
          mergedBooks: conflictedBooks.length,
          finalBookCount: 450,
          mergeSummary: {
            progressUpdated: 1,
            metadataUpdated: 1,
            timestampsUpdated: 2
          }
        }
      )

      expect(mergeResult.success).toBe(true)
      expect(mergeResult.data.resolvedConflicts).toBe(15)
    })

    test('模擬儲存空間管理流程', async () => {
      // 模擬Chrome Extension 5MB限制下的儲存溢出
      const storageError = UC04ErrorFactory.createImportStorageError(
        '3.8MB',
        '2.5MB',
        '5.0MB',
        ['clear_old_data', 'selective_import', 'compress_metadata'],
        {
          currentBookCount: 380,
          importingBookCount: 250,
          projectedTotalCount: 630,
          storageBreakdown: {
            bookData: '2.1MB',
            metadata: '0.9MB',
            progress: '0.5MB',
            cache: '0.3MB'
          },
          compressionPotential: '0.8MB'
        }
      )

      expect(storageError.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(storageError.details.overflowAmount).toBe('1.3MB')
      expect(storageError.details.storageUsageRate).toBe('126.0%')

      // 模擬執行清理策略
      const cleanupSteps = [
        // 步驟1: 清理6個月前的快取
        UC04ErrorFactory.createResult(true, {
          action: 'cache_cleanup',
          freedSpace: '0.3MB',
          remainingNeeded: '1.0MB'
        }),

        // 步驟2: 壓縮舊書籍的中繼資料
        UC04ErrorFactory.createResult(true, {
          action: 'metadata_compression',
          freedSpace: '0.5MB',
          remainingNeeded: '0.5MB'
        }),

        // 步驟3: 選擇性匯入（僅匯入最近閱讀的書籍）
        UC04ErrorFactory.createResult(true, {
          action: 'selective_import',
          booksSkipped: 80,
          booksImported: 170,
          finalStorageUsage: '4.8MB'
        })
      ]

      expect(cleanupSteps.every(step => step.success)).toBe(true)
      expect(cleanupSteps[2].data.finalStorageUsage).toBe('4.8MB')
    })
  })

  describe('匯入格式特定測試', () => {
    test('應該支援Readmoo備份格式錯誤處理', () => {
      const readmooError = UC04ErrorFactory.createImportFileError(
        'readmoo-backup-2025.json',
        '1.8MB',
        [
          { field: 'readmoo_metadata.user_id', issue: 'missing' },
          { field: 'books[0].readmoo_id', issue: 'invalid_format' }
        ],
        'Readmoo Official Backup Format v2.1',
        {
          detectedFormat: 'generic_json',
          formatVersion: 'unknown',
          hasReadmooSignature: false
        }
      )

      expect(readmooError.details.expectedFormat).toBe('Readmoo Official Backup Format v2.1')
      expect(readmooError.details.hasReadmooSignature).toBe(false)
      expect(readmooError.code).toBe(ErrorCodes.FILE_ERROR)
    })

    test('應該支援批次匯入進度追蹤', () => {
      const progressErrors = [
        UC04ErrorFactory.createImportProgressError(15, 'file_validation'),
        UC04ErrorFactory.createImportProgressError(65, 'json_parsing'),
        UC04ErrorFactory.createImportProgressError(85, 'data_storage')
      ]

      expect(progressErrors[0].details.earlyFailure).toBe(true)
      expect(progressErrors[1].details.lateFailure).toBe(true)
      expect(progressErrors[2].details.lateFailure).toBe(true)

      // 驗證不同階段的錯誤類型
      expect(progressErrors[0].code).toBe(ErrorCodes.FILE_ERROR)
      expect(progressErrors[1].code).toBe(ErrorCodes.PARSE_ERROR)
      expect(progressErrors[2].code).toBe(ErrorCodes.STORAGE_ERROR)
    })
  })

  describe('錯誤恢復策略測試', () => {
    test('應該支援自動重試機制', () => {
      // 模擬儲存錯誤自動重試
      const storageError = UC04ErrorFactory.createImportStorageError('4MB', '2MB', '5MB')

      // 基於錯誤建議的自動調整
      const suggestedCleanup = storageError.details.storageAnalysis.recommendedCleanup
      const retryAttempt = UC04ErrorFactory.createImportStorageError(
        '3.5MB', // 清理後的大小
        '1.5MB', // 減少匯入量
        '5MB',
        ['proceed_with_import'],
        {
          retryAttempt: 1,
          originalImportSize: '2MB',
          adjustedImportSize: '1.5MB',
          cleanupPerformed: suggestedCleanup
        }
      )

      expect(retryAttempt.details.adjustedImportSize).toBe('1.5MB')
      expect(retryAttempt.details.retryAttempt).toBe(1)
      expect(retryAttempt.details.overflowAmount).toBe('0.0MB') // 不再溢出
    })

    test('應該支援降級匯入策略', () => {
      // 模擬完整匯入失敗，降級為核心資料匯入
      const fullImportError = UC04ErrorFactory.createImportParsingError(
        'Memory exhausted during full metadata parsing',
        { line: 2500, column: 0 },
        '5MB',
        'memory_limitation',
        {
          includeProgress: true,
          includeMetadata: true,
          includeNotes: true,
          includeBookmarks: true
        }
      )

      // 降級為僅包含核心閱讀進度的匯入
      const fallbackResult = UC04ErrorFactory.createResult(
        true,
        {
          importMode: 'core_data_only',
          originalMode: 'full_backup',
          excludedFields: ['detailed_metadata', 'notes', 'bookmarks'],
          booksImported: 450,
          dataSize: '1.2MB',
          features: ['progress', 'basic_metadata', 'reading_history']
        }
      )

      expect(fallbackResult.success).toBe(true)
      expect(fallbackResult.data.importMode).toBe('core_data_only')
      expect(fallbackResult.data.excludedFields).toContain('notes')
    })
  })

  describe('Chrome Extension 環境相容性', () => {
    test('錯誤物件應該可以序列化', () => {
      const error = UC04ErrorFactory.createImportFileError('backup.json')

      // 測試 JSON 序列化
      const serialized = JSON.stringify(error)
      expect(serialized).toBeDefined()

      const parsed = JSON.parse(serialized)
      expect(parsed.message).toBe(error.message)
      expect(parsed.code).toBe(error.code)
      expect(parsed.details.fileName).toBe('backup.json')
    })

    test('錯誤物件應該支援 Service Worker 環境', () => {
      const error = UC04ErrorFactory.createImportMergeError('conflicts', [])

      // 模擬 Service Worker 中的訊息傳遞
      const messageData = {
        type: 'import_conflict_detected',
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        },
        resolutionOptions: error.details.resolutionOptions
      }

      expect(messageData.error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(messageData.resolutionOptions.keepExisting).toBe('保留現有資料')
    })
  })

  describe('效能與記憶體測試', () => {
    test('大量錯誤建立應該保持效能', () => {
      const startTime = Date.now()
      const errors = []

      // 建立 100 個不同的匯入錯誤
      for (let i = 0; i < 100; i++) {
        if (i % 4 === 0) {
          errors.push(UC04ErrorFactory.createImportFileError(`file_${i}.json`))
        } else if (i % 4 === 1) {
          errors.push(UC04ErrorFactory.createImportParsingError(`Parse error ${i}`))
        } else if (i % 4 === 2) {
          errors.push(UC04ErrorFactory.createImportMergeError(`conflict_${i}`, []))
        } else {
          errors.push(UC04ErrorFactory.createImportStorageError(`${i}MB`, '2MB', '5MB'))
        }
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(200) // 100個錯誤建立應該在200ms內
      expect(errors).toHaveLength(100)

      // 驗證所有錯誤都有效
      errors.forEach(error => {
        expect(UC04ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
      })
    })

    test('快取機制應該減少記憶體使用', () => {
      // 建立大量相同類型的錯誤
      const importErrors = []
      for (let i = 0; i < 50; i++) {
        importErrors.push(UC04ErrorFactory.getCommonError('IMPORT_FILE'))
      }

      // 驗證都是相同引用 (快取有效)
      const firstError = importErrors[0]
      importErrors.forEach(error => {
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
          title: `匯入書籍 ${i}`.repeat(50), // 大量重複文字
          content: { chapters: new Array(100).fill('章節內容'.repeat(30)) }
        }))
      }

      const sanitized = UC04ErrorFactory.sanitizeDetails(hugeDetails)

      expect(sanitized._truncated).toBe(true)
      expect(sanitized._originalSize).toBeGreaterThan(15000)
      expect(sanitized.largeBookList).toBeUndefined()
    })

    test('錯誤物件應該不包含敏感資訊', () => {
      const error = UC04ErrorFactory.createImportFileError(
        'secret-backup.json',
        '2.5MB',
        [],
        'JSON backup',
        {
          userToken: 'bearer_token_456',
          apiKey: 'secret_api_key_789',
          personalInfo: { email: 'user@example.com' }
        }
      )

      // 敏感資訊應該被包含但不會意外暴露在錯誤訊息中
      expect(error.message).not.toContain('bearer_token_456')
      expect(error.message).not.toContain('secret_api_key_789')
      expect(error.message).not.toContain('user@example.com')

      // 但詳細資訊中應該保留 (由開發者控制)
      expect(error.details.userToken).toBe('bearer_token_456')
    })
  })

  describe('跨UC整合測試', () => {
    test('應該與其他UC錯誤系統相容', () => {
      // UC-04 錯誤
      const uc04Error = UC04ErrorFactory.createImportFileError()

      // 模擬與其他UC系統的錯誤格式比較
      const errorStructure = {
        hasCode: typeof uc04Error.code === 'string',
        hasSubType: typeof uc04Error.subType === 'string',
        hasDetails: typeof uc04Error.details === 'object',
        hasTimestamp: typeof uc04Error.details.timestamp === 'number',
        hasSeverity: typeof uc04Error.details.severity === 'string',
        hasToJSON: typeof uc04Error.toJSON === 'function'
      }

      // 驗證符合統一錯誤格式
      Object.values(errorStructure).forEach(hasProperty => {
        expect(hasProperty).toBe(true)
      })
    })
  })

  describe('實際使用場景模擬', () => {
    test('完整的匯入工作流程', async () => {
      // 1. 檔案上傳階段
      const uploadResult = UC04ErrorFactory.createResult(true, {
        fileName: 'readmoo-backup-2025.json',
        fileSize: '2.1MB',
        uploadTime: Date.now()
      })
      expect(uploadResult.success).toBe(true)

      // 2. 檔案驗證階段
      const validationResult = UC04ErrorFactory.createResult(true, {
        validationPassed: true,
        detectedBooks: 450,
        estimatedImportTime: '30 seconds'
      })
      expect(validationResult.success).toBe(true)

      // 3. 解析階段
      const parseResult = UC04ErrorFactory.createResult(true, {
        parseTime: '2.1s',
        booksFound: 450,
        metadataComplete: true
      })
      expect(parseResult.success).toBe(true)

      // 4. 合併階段 (發現衝突)
      const mergeError = UC04ErrorFactory.createImportMergeError(
        'progress_conflicts',
        [{ id: 'book_1', existing: {}, importing: {} }]
      )

      // 5. 用戶解決衝突後重試
      const resolvedResult = UC04ErrorFactory.createResult(true, {
        mergeStrategy: 'keep_latest',
        conflictsResolved: 1,
        finalImport: {
          booksImported: 450,
          totalTime: '45s',
          storageUsed: '4.2MB'
        }
      })
      expect(resolvedResult.success).toBe(true)
    })
  })
})
