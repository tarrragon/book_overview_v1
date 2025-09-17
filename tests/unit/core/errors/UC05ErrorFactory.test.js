/**
 * UC05ErrorFactory 單元測試
 * 測試 UC-05 跨設備同步專用錯誤建立工廠的所有功能
 * 基於 UC-01/UC-02/UC-03/UC-04 成功測試模式，針對同步場景優化
 */

import { UC05ErrorFactory } from '../../../../src/core/errors/UC05ErrorFactory.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC05ErrorFactory', () => {
  afterEach(() => {
    // 清除快取避免測試間影響
    UC05ErrorFactory.clearCache()
  })

  describe('createError', () => {
    test('應該建立基本的 UC-05 錯誤', () => {
      const error = UC05ErrorFactory.createError(
        'DATA_SYNC_VERSION_MISMATCH',
        '設備間資料版本不相容'
      )

      expect(error).toBeInstanceOf(Error)
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.message).toBe('設備間資料版本不相容')
      expect(error.details.originalCode).toBe('DATA_SYNC_VERSION_MISMATCH')
    })

    test('應該建立帶有詳細資訊的錯誤', () => {
      const details = {
        localVersion: '2.1.0',
        remoteVersion: '1.8.0'
      }

      const error = UC05ErrorFactory.createError(
        'DATA_SYNC_VERSION_MISMATCH',
        '版本不相容',
        details
      )

      expect(error.details).toMatchObject(details)
      expect(error.details.originalCode).toBe('DATA_SYNC_VERSION_MISMATCH')
    })
  })

  describe('createResult', () => {
    test('應該建立成功結果物件', () => {
      const result = UC05ErrorFactory.createResult(true, {
        syncedBooks: 150,
        syncTime: '2025-01-15T10:30:00Z'
      })

      expect(result).toEqual({
        success: true,
        data: {
          syncedBooks: 150,
          syncTime: '2025-01-15T10:30:00Z'
        },
        code: 'SUCCESS',
        message: 'Sync completed successfully'
      })
    })

    test('應該建立失敗結果物件', () => {
      const error = UC05ErrorFactory.createError(
        'DATA_SYNC_VERSION_MISMATCH',
        '版本不相容'
      )

      const result = UC05ErrorFactory.createResult(false, null, error)

      expect(result).toEqual({
        success: false,
        error: '版本不相容',
        code: ErrorCodes.VALIDATION_ERROR,
        details: error.details,
        subType: 'SYNC_VERSION_MISMATCH'
      })
    })

    test('應該處理簡單錯誤物件', () => {
      const simpleError = { message: '簡單錯誤' }
      const result = UC05ErrorFactory.createResult(false, null, simpleError)

      expect(result).toEqual({
        success: false,
        error: '簡單錯誤',
        code: ErrorCodes.UNKNOWN_ERROR,
        details: {},
        subType: 'UNKNOWN'
      })
    })
  })

  describe('createSyncVersionError', () => {
    test('應該建立版本不相容錯誤', () => {
      const error = UC05ErrorFactory.createSyncVersionError(
        '2.1.0',
        '1.8.0',
        'backward_compatible',
        true,
        ['progress_tracking', 'metadata_format'],
        { source: 'version_check' }
      )

      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.message).toBe('設備間資料版本不相容')
      expect(error.details).toMatchObject({
        localVersion: '2.1.0',
        remoteVersion: '1.8.0',
        compatibility: 'backward_compatible',
        migrationRequired: true,
        affectedFeatures: ['progress_tracking', 'metadata_format'],
        source: 'version_check'
      })
    })

    test('應該包含版本分析資訊', () => {
      const error = UC05ErrorFactory.createSyncVersionError('2.1.0', '1.8.0')

      expect(error.details.versionDifference).toBeDefined()
      expect(error.details.isBackwardCompatible).toBe(false) // 預設 compatibility 是 'unknown'
      expect(error.details.resolutionStrategy).toBeDefined()
      expect(error.details.suggestedActions).toContain('check_extension_versions')
    })

    test('應該使用預設參數', () => {
      const error = UC05ErrorFactory.createSyncVersionError()

      expect(error.details.localVersion).toBe('unknown')
      expect(error.details.remoteVersion).toBe('unknown')
      expect(error.details.compatibility).toBe('unknown')
      expect(error.details.migrationRequired).toBe(false)
      expect(error.details.affectedFeatures).toEqual([])
    })

    test('應該正確計算版本差異', () => {
      const error = UC05ErrorFactory.createSyncVersionError('2.1.3', '1.8.5')

      expect(error.details.versionDifference.major).toBe(1) // 2 - 1
      expect(error.details.versionDifference.minor).toBe(-7) // 1 - 8
      expect(error.details.versionDifference.patch).toBe(-2) // 3 - 5
      expect(error.details.versionDifference.significant).toBe(true)
    })
  })

  describe('createSyncTimestampError', () => {
    test('應該建立時間戳衝突錯誤', () => {
      const conflictedBooks = [
        {
          id: 'book_456',
          device1: { lastModified: '2025-01-15T09:00:00Z', progress: '80%' },
          device2: { lastModified: '2025-01-15T10:30:00Z', progress: '75%' }
        }
      ]

      const error = UC05ErrorFactory.createSyncTimestampError(
        conflictedBooks,
        'latest_timestamp_wins',
        { syncId: 'sync_123' },
        { context: 'auto_sync' }
      )

      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.message).toBe('同步時發現時間戳衝突')
      expect(error.details).toMatchObject({
        conflictedBooks,
        conflictCount: 1,
        resolutionStrategy: 'latest_timestamp_wins',
        syncMetadata: { syncId: 'sync_123' },
        context: 'auto_sync'
      })
    })

    test('應該包含衝突分析', () => {
      const conflictedBooks = [
        {
          id: 'book_1',
          device1: { progress: '80%' },
          device2: { progress: '80%' } // 相同進度 = 簡單衝突
        },
        {
          id: 'book_2',
          device1: { progress: '70%' },
          device2: { progress: '85%' } // 不同進度 = 複雜衝突
        }
      ]

      const error = UC05ErrorFactory.createSyncTimestampError(conflictedBooks)

      expect(error.details.conflictAnalysis.simpleConflictsCount).toBe(1)
      expect(error.details.conflictAnalysis.complexConflictsCount).toBe(1)
      expect(error.details.conflictAnalysis.autoResolutionConfidence).toBe(50) // 1/2 * 100
      expect(error.details.conflictAnalysis.recommendedStrategy).toBe('manual_review')
    })

    test('應該限制顯示的衝突書籍數量', () => {
      const manyBooks = Array.from({ length: 15 }, (_, i) => ({ id: `book_${i}` }))

      const error = UC05ErrorFactory.createSyncTimestampError(manyBooks)

      expect(error.details.conflictedBooks).toHaveLength(10) // 限制為10個
      expect(error.details.conflictCount).toBe(15) // 但總數正確
    })

    test('應該使用預設參數', () => {
      const error = UC05ErrorFactory.createSyncTimestampError()

      expect(error.details.conflictedBooks).toEqual([])
      expect(error.details.resolutionStrategy).toBe('manual_resolution')
      expect(error.details.conflictCount).toBe(0)
    })
  })

  describe('createCloudServiceError', () => {
    test('應該建立雲端服務無法連接錯誤', () => {
      const error = UC05ErrorFactory.createCloudServiceError(
        'Google Drive',
        '2025-01-14T18:00:00Z',
        3,
        ['local_backup', 'manual_export'],
        { online: true, latency: 100 },
        { userId: 'user_123' }
      )

      expect(error.code).toBe(ErrorCodes.NETWORK_ERROR)
      expect(error.message).toBe('雲端服務暫時無法連接')
      expect(error.details).toMatchObject({
        cloudService: 'Google Drive',
        lastSuccessfulSync: '2025-01-14T18:00:00Z',
        retryAttempts: 3,
        fallbackOptions: ['local_backup', 'manual_export'],
        userId: 'user_123'
      })
    })

    test('應該包含服務狀態分析', () => {
      const error = UC05ErrorFactory.createCloudServiceError('Dropbox', null, 5)

      expect(error.details.serviceStatus.serviceName).toBe('Dropbox')
      expect(error.details.serviceStatus.estimatedAvailability).toBe('extended_outage') // retryAttempts >= 3
      expect(error.details.serviceStatus.serviceOutage).toBe(true) // retryAttempts > 4
    })

    test('應該計算重試延遲', () => {
      const error = UC05ErrorFactory.createCloudServiceError('Test Service', null, 2)

      expect(error.details.retryStrategy.exponentialBackoff).toBe(true)
      expect(error.details.retryStrategy.nextRetryIn).toBeDefined()
      expect(error.details.retryStrategy.maxRetryDelay).toBe('5 minutes')
    })

    test('應該包含故障排除建議', () => {
      const error = UC05ErrorFactory.createCloudServiceError('Test Service', null, 4)

      expect(error.details.troubleshooting.checkNetworkConnection).toBe(true)
      expect(error.details.troubleshooting.tryDifferentService).toBe(true) // retryAttempts > 3
    })

    test('應該使用預設參數', () => {
      const error = UC05ErrorFactory.createCloudServiceError()

      expect(error.details.cloudService).toBe('Unknown Cloud Service')
      expect(error.details.retryAttempts).toBe(0)
      expect(error.details.fallbackOptions).toEqual(['local_backup', 'manual_export'])
    })
  })

  describe('createSyncCorruptionError', () => {
    test('應該建立同步檔案損壞錯誤', () => {
      const error = UC05ErrorFactory.createSyncCorruptionError(
        'partial_json_truncation',
        '2025-01-13T12:00:00Z',
        'medium',
        ['restore_from_backup', 'manual_reconstruction'],
        { detectionMethod: 'checksum_validation' },
        { fileSize: '2.5MB' }
      )

      expect(error.code).toBe(ErrorCodes.FILE_ERROR)
      expect(error.message).toBe('同步檔案損壞，無法安全合併')
      expect(error.details).toMatchObject({
        corruptionType: 'partial_json_truncation',
        lastKnownGoodBackup: '2025-01-13T12:00:00Z',
        dataLossRisk: 'medium',
        recoveryOptions: ['restore_from_backup', 'manual_reconstruction'],
        fileSize: '2.5MB'
      })
    })

    test('應該包含風險評估', () => {
      const error = UC05ErrorFactory.createSyncCorruptionError(
        'complete_file_corruption',
        null,
        'severe'
      )

      expect(error.details.riskAssessment.level).toBe('severe')
      expect(error.details.riskAssessment.recoverable).toBe(false)
      expect(error.details.riskAssessment.immediateAction).toBe(true)
    })

    test('應該包含恢復計畫', () => {
      const error = UC05ErrorFactory.createSyncCorruptionError(
        'metadata_corruption',
        null,
        'medium',
        ['repair_metadata', 'restore_backup']
      )

      expect(error.details.recoveryPlan.primaryOption).toBe('repair_metadata')
      expect(error.details.recoveryPlan.fallbackOptions).toEqual(['restore_backup'])
      expect(error.details.recoveryPlan.estimatedRecoveryTime).toBeDefined()
    })

    test('應該包含預防措施建議', () => {
      const error = UC05ErrorFactory.createSyncCorruptionError()

      expect(error.details.preventiveMeasures.enableAutoBackup).toBe(true)
      expect(error.details.preventiveMeasures.useMultipleCloudServices).toBe(true)
    })

    test('應該使用預設參數', () => {
      const error = UC05ErrorFactory.createSyncCorruptionError()

      expect(error.details.corruptionType).toBe('unknown_corruption')
      expect(error.details.dataLossRisk).toBe('unknown')
      expect(error.details.recoveryOptions).toEqual(['restore_from_backup', 'manual_reconstruction'])
    })
  })

  describe('createSyncProgressError', () => {
    test('應該為版本相關階段建立版本錯誤', () => {
      const error = UC05ErrorFactory.createSyncProgressError(
        30,
        'version_compatibility_check',
        { localVersion: '2.0.0', remoteVersion: '1.8.0' }
      )

      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.details.progress).toBe(30)
      expect(error.details.stage).toBe('version_compatibility_check')
    })

    test('應該為時間戳相關階段建立時間戳錯誤', () => {
      const error = UC05ErrorFactory.createSyncProgressError(
        60,
        'timestamp_conflict_resolution',
        { conflictedBooks: [{ id: 'book_1' }] }
      )

      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.details.resolutionStrategy).toBe('auto_resolution_failed')
    })

    test('應該為網路相關階段建立網路錯誤', () => {
      const error = UC05ErrorFactory.createSyncProgressError(
        80,
        'cloud_service_upload',
        { cloudService: 'Google Drive' }
      )

      expect(error.code).toBe(ErrorCodes.NETWORK_ERROR)
      expect(error.details.cloudService).toBe('Google Drive')
    })

    test('應該為其他階段建立檔案錯誤', () => {
      const error = UC05ErrorFactory.createSyncProgressError(
        90,
        'data_validation',
        { lastBackup: '2025-01-14T12:00:00Z' }
      )

      expect(error.code).toBe(ErrorCodes.FILE_ERROR)
      expect(error.details.corruptionType).toBe('corruption_during_data_validation')
    })
  })

  describe('getCommonError - 快取機制', () => {
    test('應該快取常用錯誤', () => {
      const error1 = UC05ErrorFactory.getCommonError('SYNC_VERSION')
      const error2 = UC05ErrorFactory.getCommonError('SYNC_VERSION')

      expect(error1).toBe(error2) // 相同參考
      expect(Object.isFrozen(error1)).toBe(true)
      expect(error1.details.cached).toBe(true)
    })

    test('應該支援所有快取錯誤類型', () => {
      const cacheTypes = [
        'SYNC_VERSION',
        'SYNC_TIMESTAMP',
        'CLOUD_SERVICE',
        'SYNC_CORRUPTION'
      ]

      cacheTypes.forEach(type => {
        const error = UC05ErrorFactory.getCommonError(type)
        expect(error).toBeInstanceOf(Error)
        expect(error.details.cached).toBe(true)
      })
    })

    test('應該處理未知快取類型', () => {
      const error = UC05ErrorFactory.getCommonError('UNKNOWN_TYPE')
      expect(error).toBeNull()
    })
  })

  describe('clearCache', () => {
    test('應該清除錯誤快取', () => {
      // 建立快取
      UC05ErrorFactory.getCommonError('SYNC_VERSION')

      // 清除快取
      UC05ErrorFactory.clearCache()

      // 重新取得應該是新物件
      const error1 = UC05ErrorFactory.getCommonError('SYNC_VERSION')
      const error2 = UC05ErrorFactory.getCommonError('SYNC_VERSION')

      expect(error1).toBe(error2) // 新快取中相同
      expect(error1.details.cached).toBe(true)
    })
  })

  describe('sanitizeDetails', () => {
    test('應該保留正常大小的詳細資訊', () => {
      const details = {
        syncId: 'sync_123',
        deviceList: ['device1', 'device2'],
        timestamp: '2025-01-15T10:30:00Z'
      }

      const sanitized = UC05ErrorFactory.sanitizeDetails(details)
      expect(sanitized).toEqual(details)
    })

    test('應該截斷過大的詳細資訊', () => {
      const largeDetails = {
        largeDeviceList: new Array(10000).fill().map((_, i) => ({
          id: `device_${i}`,
          data: `裝置資料 ${i}`.repeat(50) // 大量重複文字
        }))
      }

      const sanitized = UC05ErrorFactory.sanitizeDetails(largeDetails)

      expect(sanitized._truncated).toBe(true)
      expect(sanitized._originalSize).toBeGreaterThan(15000)
      expect(sanitized._message).toBe('Details truncated due to size limit')
      expect(sanitized.summary).toBe('Large sync data set truncated for memory safety')
    })

    test('應該處理無效輸入', () => {
      expect(UC05ErrorFactory.sanitizeDetails(null)).toEqual({})
      expect(UC05ErrorFactory.sanitizeDetails(undefined)).toEqual({})
      expect(UC05ErrorFactory.sanitizeDetails('string')).toEqual({})
      expect(UC05ErrorFactory.sanitizeDetails(123)).toEqual({})
    })
  })

  describe('isValidUC05Error', () => {
    test('應該驗證有效的 UC-05 錯誤', () => {
      const error = UC05ErrorFactory.createError(
        'DATA_SYNC_VERSION_MISMATCH',
        '測試訊息'
      )

      expect(UC05ErrorFactory.isValidUC05Error(error)).toBe(true)
    })

    test('應該拒絕無效的錯誤', () => {
      const invalidError = new Error('普通錯誤')
      expect(UC05ErrorFactory.isValidUC05Error(invalidError)).toBe(false)

      expect(UC05ErrorFactory.isValidUC05Error(null)).toBe(false)
      expect(UC05ErrorFactory.isValidUC05Error({})).toBe(false)
    })

    test('應該檢查UC-05相關的subType', () => {
      const validError = UC05ErrorFactory.createSyncVersionError()
      expect(UC05ErrorFactory.isValidUC05Error(validError)).toBe(true)

      // 建立一個不相關的錯誤
      const otherError = new Error('其他錯誤')
      otherError.code = ErrorCodes.VALIDATION_ERROR
      otherError.subType = 'OTHER_ERROR'
      otherError.details = {}

      expect(UC05ErrorFactory.isValidUC05Error(otherError)).toBe(false)
    })
  })

  describe('跨設備同步場景專用測試', () => {
    test('版本錯誤應該包含同步指引', () => {
      const error = UC05ErrorFactory.createSyncVersionError()
      expect(error.details.userGuidance).toContain('版本差異可以自動處理')
      expect(error.details.suggestedActions).toContain('check_extension_versions')
    })

    test('時間戳錯誤應該提供衝突解決選項', () => {
      const error = UC05ErrorFactory.createSyncTimestampError()
      expect(error.details.userGuidance).toContain('選擇合併策略')
      expect(error.details.resolutionOptions.latestTimestampWins).toBe('採用最新時間戳的資料')
    })

    test('雲端服務錯誤應該提供重試策略', () => {
      const error = UC05ErrorFactory.createCloudServiceError()
      expect(error.details.userGuidance).toContain('備用方案')
      expect(error.details.retryStrategy.exponentialBackoff).toBe(true)
    })

    test('檔案損壞錯誤應該提供恢復計畫', () => {
      const error = UC05ErrorFactory.createSyncCorruptionError()
      expect(error.details.userGuidance).toContain('恢復策略')
      expect(error.details.recoveryPlan.primaryOption).toBeDefined()
    })
  })

  describe('效能測試', () => {
    test('常用錯誤建立應該快速', () => {
      const startTime = Date.now()

      for (let i = 0; i < 100; i++) {
        UC05ErrorFactory.getCommonError('SYNC_VERSION')
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(10) // 100次快取存取應該在10ms內
    })

    test('錯誤建立應該在合理時間內完成', () => {
      const startTime = Date.now()

      for (let i = 0; i < 50; i++) {
        UC05ErrorFactory.createSyncVersionError(
          `2.${i}.0`,
          `1.${i}.0`,
          'backward_compatible',
          true,
          [`feature_${i}`],
          { testIndex: i }
        )
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(100) // 50個複雜錯誤應該在100ms內
    })
  })

  describe('私有輔助方法測試', () => {
    test('_calculateVersionDifference 應該正確計算版本差異', () => {
      const difference = UC05ErrorFactory._calculateVersionDifference('2.1.3', '1.8.5')

      expect(difference.major).toBe(1)
      expect(difference.minor).toBe(-7)
      expect(difference.patch).toBe(-2)
      expect(difference.significant).toBe(true)
    })

    test('_formatDuration 應該正確格式化時間', () => {
      expect(UC05ErrorFactory._formatDuration(30000)).toBe('30 seconds')
      expect(UC05ErrorFactory._formatDuration(120000)).toBe('2 minutes')
      expect(UC05ErrorFactory._formatDuration(3600000)).toBe('1 hours')
      expect(UC05ErrorFactory._formatDuration(86400000)).toBe('1 days')
    })
  })
})
