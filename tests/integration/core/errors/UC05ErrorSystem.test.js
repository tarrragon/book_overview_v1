/**
 * UC05ErrorSystem 整合測試
 * 測試 UC05ErrorAdapter 和 UC05ErrorFactory 的整合協作
 * 模擬真實的跨設備同步使用場景
 */

import { UC05ErrorAdapter } from '../../../../src/core/errors/UC05ErrorAdapter.js'
import { UC05ErrorFactory } from '../../../../src/core/errors/UC05ErrorFactory.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC05ErrorSystem 整合測試', () => {
  afterEach(() => {
    UC05ErrorFactory.clearCache()
  })

  describe('Adapter 與 Factory 協作', () => {
    test('Factory 建立的錯誤應該通過 Adapter 驗證', () => {
      const error = UC05ErrorFactory.createError(
        'DATA_SYNC_VERSION_MISMATCH',
        '設備間資料版本不相容'
      )

      expect(UC05ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
      expect(UC05ErrorFactory.isValidUC05Error(error)).toBe(true)
    })

    test('所有 Factory 方法產生的錯誤都應該有效', () => {
      const errors = [
        UC05ErrorFactory.createSyncVersionError('2.1.0', '1.8.0'),
        UC05ErrorFactory.createSyncTimestampError([]),
        UC05ErrorFactory.createCloudServiceError('Google Drive'),
        UC05ErrorFactory.createSyncCorruptionError('partial_json_truncation')
      ]

      errors.forEach(error => {
        expect(UC05ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
        expect(UC05ErrorFactory.isValidUC05Error(error)).toBe(true)
      })
    })
  })

  describe('跨設備同步完整流程模擬', () => {
    test('模擬版本不相容同步失敗流程', async () => {
      // 模擬不同Extension版本間的同步
      const versionError = UC05ErrorFactory.createSyncVersionError(
        '2.1.0', // 本地版本
        '1.8.0', // 遠端版本
        'incompatible', // 不相容
        true, // 需要遷移
        ['progress_tracking', 'metadata_format'],
        {
          deviceName: 'MacBook Pro',
          lastSyncAttempt: '2025-01-15T10:30:00Z',
          extensionInfo: {
            local: { version: '2.1.0', build: '240115' },
            remote: { version: '1.8.0', build: '231220' }
          }
        }
      )

      // 驗證錯誤結構
      expect(versionError.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(versionError.subType).toBe('SYNC_VERSION_MISMATCH')
      expect(versionError.details.severity).toBe('MODERATE')
      expect(versionError.details.migrationRequired).toBe(true)
      expect(versionError.details.versionDifference.significant).toBe(true)
      expect(versionError.details.suggestedActions).toContain('perform_data_migration')

      // 建立結果物件
      const result = UC05ErrorFactory.createResult(false, null, versionError)

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(result.subType).toBe('SYNC_VERSION_MISMATCH')
    })

    test('模擬多設備時間戳衝突解決流程', async () => {
      // 模擬複雜的時間戳衝突場景
      const conflictedBooks = [
        {
          id: 'book_456',
          device1: {
            lastModified: '2025-01-15T09:00:00Z',
            progress: 80,
            deviceName: 'iPhone 15'
          },
          device2: {
            lastModified: '2025-01-15T10:30:00Z',
            progress: 75,
            deviceName: 'MacBook Pro'
          }
        },
        {
          id: 'book_789',
          device1: {
            lastModified: '2025-01-15T08:45:00Z',
            progress: 60,
            deviceName: 'iPhone 15'
          },
          device2: {
            lastModified: '2025-01-15T09:15:00Z',
            progress: 60,
            deviceName: 'MacBook Pro'
          }
        }
      ]

      const timestampError = UC05ErrorFactory.createSyncTimestampError(
        conflictedBooks,
        'latest_timestamp_wins',
        {
          syncSessionId: 'sync_20250115_103000',
          totalBooksToSync: 150,
          conflictDetectionTime: Date.now()
        },
        {
          userPreferences: {
            preferredDevice: 'MacBook Pro',
            autoResolveSimple: true
          }
        }
      )

      expect(timestampError.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(timestampError.subType).toBe('SYNC_TIMESTAMP_CONFLICT')
      expect(timestampError.details.conflictCount).toBe(2)
      expect(timestampError.details.conflictAnalysis.simpleConflictsCount).toBe(1)
      expect(timestampError.details.conflictAnalysis.complexConflictsCount).toBe(1)
      expect(timestampError.details.autoResolution.enabled).toBe(true)

      // 模擬自動解決簡單衝突
      const autoResolved = timestampError.details.conflictAnalysis.simpleConflictsCount
      const manualRequired = timestampError.details.conflictAnalysis.complexConflictsCount

      expect(autoResolved).toBe(1)
      expect(manualRequired).toBe(1)
    })

    test('模擬雲端服務中斷與重試流程', async () => {
      // 模擬Google Drive連接失敗
      const serviceError = UC05ErrorFactory.createCloudServiceError(
        'Google Drive',
        '2025-01-14T18:00:00Z', // 最後成功同步
        3, // 已重試3次
        ['local_backup', 'manual_export', 'try_dropbox'],
        {
          connectionSpeed: 'slow',
          region: 'Asia/Taipei',
          userAgent: 'Chrome Extension v2.1.0'
        },
        {
          lastErrorMessage: 'quota_exceeded',
          estimatedResolution: '30 minutes'
        }
      )

      expect(serviceError.code).toBe(ErrorCodes.NETWORK_ERROR)
      expect(serviceError.subType).toBe('CLOUD_SERVICE_UNAVAILABLE')
      expect(serviceError.details.retryAttempts).toBe(3)
      expect(serviceError.details.serviceStatus.permissionIssue).toBe(true)
      expect(serviceError.details.suggestedActions).toContain('verify_cloud_permissions')
      expect(serviceError.details.retryStrategy.nextRetryIn).toContain('seconds')

      // 模擬進度錯誤（網路階段失敗）
      const progressError = UC05ErrorFactory.createSyncProgressError(
        25, // 25%進度時失敗
        'cloud_upload',
        {
          cloudService: 'Google Drive',
          retryAttempts: 3,
          lastSync: '2025-01-14T18:00:00Z'
        }
      )

      expect(progressError.code).toBe(ErrorCodes.NETWORK_ERROR)
      // progress和stage會被放在networkInfo中，因為是網路相關錯誤
      expect(progressError.details.networkInfo.progress).toBe(25)
      expect(progressError.details.networkInfo.stage).toBe('cloud_upload')
    })

    test('模擬資料損壞檢測與恢復流程', async () => {
      // 模擬嚴重的檔案損壞
      const corruptionError = UC05ErrorFactory.createSyncCorruptionError(
        'complete_file_corruption',
        '2025-01-13T12:00:00Z', // 最後已知良好備份
        'high', // 高風險
        ['restore_from_backup', 'contact_support'],
        {
          detectionMethod: 'checksum_validation',
          affectedSections: ['book_metadata', 'progress_data'],
          recoverableSections: ['user_preferences'],
          corruptionSize: '2.1MB',
          totalFileSize: '15.7MB'
        },
        {
          autoBackupEnabled: true,
          backupFrequency: 'daily',
          corruptionSource: 'interrupted_sync'
        }
      )

      expect(corruptionError.code).toBe(ErrorCodes.FILE_ERROR)
      expect(corruptionError.subType).toBe('SYNC_CORRUPTION_DETECTED')
      expect(corruptionError.details.severity).toBe('SEVERE')
      expect(corruptionError.details.riskAssessment.level).toBe('high')
      expect(corruptionError.details.riskAssessment.immediateAction).toBe(false)
      expect(corruptionError.details.recoveryPlan.primaryOption).toBe('restore_from_backup')
      expect(corruptionError.details.suggestedActions).toContain('restore_from_backup')

      // 驗證恢復計畫
      const recoveryPlan = corruptionError.details.recoveryPlan
      expect(recoveryPlan.estimatedRecoveryTime).toBe('30-60 minutes')
      expect(recoveryPlan.dataPreservation).toBe('full_restore_needed')
    })
  })

  describe('錯誤結果物件整合', () => {
    test('所有錯誤類型都應該可以包裝為結果物件', () => {
      const errors = [
        UC05ErrorFactory.createSyncVersionError(),
        UC05ErrorFactory.createSyncTimestampError(),
        UC05ErrorFactory.createCloudServiceError(),
        UC05ErrorFactory.createSyncCorruptionError()
      ]

      errors.forEach(error => {
        const result = UC05ErrorFactory.createResult(false, null, error)

        expect(result.success).toBe(false)
        expect(result.code).toBeDefined()
        expect(result.subType).toBeDefined()
        expect(result.details).toBeDefined()
        expect(Object.values(ErrorCodes)).toContain(result.code)
      })
    })

    test('成功同步應該產生正確的結果物件', () => {
      const successData = {
        syncedBooks: 150,
        syncTime: '2025-01-15T10:35:00Z',
        conflictsResolved: 2,
        devicesInvolved: ['iPhone 15', 'MacBook Pro'],
        cloudService: 'Google Drive'
      }

      const result = UC05ErrorFactory.createResult(true, successData)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(successData)
      expect(result.code).toBe('SUCCESS')
      expect(result.message).toBe('Sync completed successfully')
    })
  })

  describe('效能與記憶體管理', () => {
    test('快取機制應該提升重複錯誤建立效能', () => {
      const startTime = Date.now()

      // 建立100個相同類型的錯誤
      for (let i = 0; i < 100; i++) {
        UC05ErrorFactory.getCommonError('SYNC_VERSION')
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(20) // 應該在20ms內完成
    })

    test('大型詳細資訊應該被正確清理', () => {
      const largeDetails = {
        books: new Array(10000).fill().map((_, i) => ({
          id: `book_${i}`,
          title: `Book Title ${i}`.repeat(100),
          progress: Math.random() * 100
        }))
      }

      const sanitized = UC05ErrorFactory.sanitizeDetails(largeDetails)

      expect(sanitized._truncated).toBe(true)
      expect(sanitized._originalSize).toBeGreaterThan(15000)
      expect(sanitized.summary).toContain('truncated')
    })
  })

  describe('Chrome Extension 相容性', () => {
    test('所有錯誤都應該可以JSON序列化', () => {
      const errors = [
        UC05ErrorFactory.createSyncVersionError('2.1.0', '1.8.0'),
        UC05ErrorFactory.createSyncTimestampError([{
          id: 'book_123',
          device1: { lastModified: '2025-01-15T09:00:00Z' },
          device2: { lastModified: '2025-01-15T10:00:00Z' }
        }]),
        UC05ErrorFactory.createCloudServiceError('Google Drive'),
        UC05ErrorFactory.createSyncCorruptionError('partial_corruption')
      ]

      errors.forEach(error => {
        const serialized = JSON.stringify(error)
        expect(serialized).toBeDefined()

        const parsed = JSON.parse(serialized)
        expect(parsed.message).toBe(error.message)
        expect(parsed.code).toBe(error.code)
        expect(parsed.details).toBeDefined()

        // 測試toJSON方法
        expect(typeof error.toJSON).toBe('function')
        const jsonObj = error.toJSON()
        expect(jsonObj.code).toBe(error.code)
        expect(jsonObj.subType).toBe(error.subType)
      })
    })
  })

  describe('實際使用場景模擬', () => {
    test('完整同步週期模擬：從失敗到成功', async () => {
      // 第一次同步：版本不相容
      let syncAttempt = 1
      let error = UC05ErrorFactory.createSyncVersionError(
        '2.0.0', '1.9.0', 'backward_compatible', true
      )
      let result = UC05ErrorFactory.createResult(false, null, error)

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCodes.VALIDATION_ERROR)

      // 第二次同步：升級後時間戳衝突
      syncAttempt++
      error = UC05ErrorFactory.createSyncTimestampError(
        [{ id: 'book_456', device1: {}, device2: {} }],
        'latest_timestamp_wins'
      )
      result = UC05ErrorFactory.createResult(false, null, error)

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCodes.VALIDATION_ERROR)

      // 第三次同步：成功
      syncAttempt++
      result = UC05ErrorFactory.createResult(true, {
        syncedBooks: 147,
        resolvedConflicts: 1,
        syncAttempt
      })

      expect(result.success).toBe(true)
      expect(result.data.syncAttempt).toBe(3)
    })
  })
})
