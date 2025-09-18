/**
 * UC05ErrorAdapter 單元測試
 * 測試 UC-05 跨設備同步錯誤轉換適配器的所有功能
 * 基於 UC-01/UC-02/UC-03/UC-04 成功測試模式，針對同步場景優化
 */

import { UC05ErrorAdapter } from '../../../../src/core/errors/UC05ErrorAdapter.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC05ErrorAdapter', () => {
  describe('getErrorMapping', () => {
    test('應該回傳4個StandardError的映射', () => {
      const mapping = UC05ErrorAdapter.getErrorMapping()

      expect(Object.keys(mapping)).toHaveLength(4)
      expect(mapping).toEqual({
        DATA_SYNC_VERSION_MISMATCH: ErrorCodes.VALIDATION_ERROR,
        DATA_SYNC_TIMESTAMP_CONFLICT: ErrorCodes.VALIDATION_ERROR,
        NETWORK_CLOUD_SERVICE_UNAVAILABLE: ErrorCodes.NETWORK_ERROR,
        DATA_SYNC_CORRUPTION_DETECTED: ErrorCodes.FILE_ERROR
      })
    })

    test('應該快取映射表', () => {
      const mapping1 = UC05ErrorAdapter.getErrorMapping()
      const mapping2 = UC05ErrorAdapter.getErrorMapping()

      expect(mapping1).toBe(mapping2) // 相同參考
      expect(Object.isFrozen(mapping1)).toBe(true)
    })
  })

  describe('extractSubType', () => {
    test('應該提取正確的子類型', () => {
      expect(UC05ErrorAdapter.extractSubType('DATA_SYNC_VERSION_MISMATCH'))
        .toBe('SYNC_VERSION_MISMATCH')
      expect(UC05ErrorAdapter.extractSubType('DATA_SYNC_TIMESTAMP_CONFLICT'))
        .toBe('SYNC_TIMESTAMP_CONFLICT')
      expect(UC05ErrorAdapter.extractSubType('NETWORK_CLOUD_SERVICE_UNAVAILABLE'))
        .toBe('CLOUD_SERVICE_UNAVAILABLE')
      expect(UC05ErrorAdapter.extractSubType('DATA_SYNC_CORRUPTION_DETECTED'))
        .toBe('SYNC_CORRUPTION_DETECTED')
    })

    test('應該處理未知錯誤代碼', () => {
      expect(UC05ErrorAdapter.extractSubType('UNKNOWN_CODE'))
        .toBe('UNKNOWN_SUBTYPE')
      expect(UC05ErrorAdapter.extractSubType(''))
        .toBe('UNKNOWN_SUBTYPE')
    })
  })

  describe('convertError', () => {
    test('應該轉換DATA_SYNC_VERSION_MISMATCH為VALIDATION_ERROR', () => {
      const error = UC05ErrorAdapter.convertError(
        'DATA_SYNC_VERSION_MISMATCH',
        '設備間資料版本不相容',
        { localVersion: '2.1.0', remoteVersion: '1.8.0' }
      )

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('UC05Error')
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.message).toBe('設備間資料版本不相容')
      expect(error.subType).toBe('SYNC_VERSION_MISMATCH')
      expect(error.details).toMatchObject({
        localVersion: '2.1.0',
        remoteVersion: '1.8.0',
        originalCode: 'DATA_SYNC_VERSION_MISMATCH',
        severity: 'MODERATE'
      })
    })

    test('應該轉換DATA_SYNC_TIMESTAMP_CONFLICT為VALIDATION_ERROR', () => {
      const error = UC05ErrorAdapter.convertError(
        'DATA_SYNC_TIMESTAMP_CONFLICT',
        '時間戳衝突'
      )

      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(error.subType).toBe('SYNC_TIMESTAMP_CONFLICT')
      expect(error.details.severity).toBe('MODERATE')
    })

    test('應該轉換NETWORK_CLOUD_SERVICE_UNAVAILABLE為NETWORK_ERROR', () => {
      const error = UC05ErrorAdapter.convertError(
        'NETWORK_CLOUD_SERVICE_UNAVAILABLE',
        '雲端服務無法連接'
      )

      expect(error.code).toBe(ErrorCodes.NETWORK_ERROR)
      expect(error.subType).toBe('CLOUD_SERVICE_UNAVAILABLE')
      expect(error.details.severity).toBe('MODERATE')
    })

    test('應該轉換DATA_SYNC_CORRUPTION_DETECTED為FILE_ERROR', () => {
      const error = UC05ErrorAdapter.convertError(
        'DATA_SYNC_CORRUPTION_DETECTED',
        '同步檔案損壞'
      )

      expect(error.code).toBe(ErrorCodes.FILE_ERROR)
      expect(error.subType).toBe('SYNC_CORRUPTION_DETECTED')
      expect(error.details.severity).toBe('SEVERE')
    })

    test('應該使用預設訊息', () => {
      const error = UC05ErrorAdapter.convertError('DATA_SYNC_VERSION_MISMATCH')

      expect(error.message).toBe('UC-05 sync operation failed')
    })

    test('應該合併額外的詳細資訊', () => {
      const details = {
        customField: 'value',
        syncProgress: 75
      }

      const error = UC05ErrorAdapter.convertError(
        'DATA_SYNC_VERSION_MISMATCH',
        '測試訊息',
        details
      )

      expect(error.details).toMatchObject({
        customField: 'value',
        syncProgress: 75,
        originalCode: 'DATA_SYNC_VERSION_MISMATCH'
      })
    })

    test('應該包含時間戳', () => {
      const before = Date.now()
      const error = UC05ErrorAdapter.convertError('DATA_SYNC_VERSION_MISMATCH', '測試')
      const after = Date.now()

      expect(error.details.timestamp).toBeGreaterThanOrEqual(before)
      expect(error.details.timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('convertError - 錯誤處理', () => {
    test('應該處理無效的錯誤代碼', () => {
      const error = UC05ErrorAdapter.convertError(null, '測試訊息')

      expect(error.name).toBe('UC05ConversionError')
      expect(error.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(error.subType).toBe('UC05_CONVERSION_ERROR')
      expect(error.message).toContain('Invalid error code provided')
      expect(error.details.conversionError).toBe(true)
    })

    test('應該處理未知的錯誤代碼', () => {
      const error = UC05ErrorAdapter.convertError('UNKNOWN_UC05_CODE', '測試訊息')

      expect(error.name).toBe('UC05ConversionError')
      expect(error.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(error.message).toContain('Unknown UC-05 error code')
      expect(error.details.unknownCode).toBe('UNKNOWN_UC05_CODE')
      expect(error.details.availableCodes).toEqual([
        'DATA_SYNC_VERSION_MISMATCH',
        'DATA_SYNC_TIMESTAMP_CONFLICT',
        'NETWORK_CLOUD_SERVICE_UNAVAILABLE',
        'DATA_SYNC_CORRUPTION_DETECTED'
      ])
    })

    test('應該處理空字串錯誤代碼', () => {
      const error = UC05ErrorAdapter.convertError('', '測試訊息')

      expect(error.name).toBe('UC05ConversionError')
      expect(error.message).toContain('Invalid error code provided')
    })

    test('應該處理非字串錯誤代碼', () => {
      const error = UC05ErrorAdapter.convertError(123, '測試訊息')

      expect(error.name).toBe('UC05ConversionError')
      expect(error.details.receivedCode).toBe(123)
    })
  })

  describe('getSeverityFromCode', () => {
    test('應該回傳正確的嚴重程度', () => {
      expect(UC05ErrorAdapter.getSeverityFromCode('DATA_SYNC_CORRUPTION_DETECTED'))
        .toBe('SEVERE')
      expect(UC05ErrorAdapter.getSeverityFromCode('DATA_SYNC_VERSION_MISMATCH'))
        .toBe('MODERATE')
      expect(UC05ErrorAdapter.getSeverityFromCode('DATA_SYNC_TIMESTAMP_CONFLICT'))
        .toBe('MODERATE')
      expect(UC05ErrorAdapter.getSeverityFromCode('NETWORK_CLOUD_SERVICE_UNAVAILABLE'))
        .toBe('MODERATE')
    })

    test('應該對未知代碼回傳預設嚴重程度', () => {
      expect(UC05ErrorAdapter.getSeverityFromCode('UNKNOWN_CODE'))
        .toBe('MODERATE')
    })
  })

  describe('isValidErrorCodesError', () => {
    test('應該驗證有效的ErrorCodes錯誤', () => {
      const error = UC05ErrorAdapter.convertError(
        'DATA_SYNC_VERSION_MISMATCH',
        '測試訊息'
      )

      expect(UC05ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
    })

    test('應該拒絕無效的錯誤物件', () => {
      const invalidError = new Error('普通錯誤')
      expect(UC05ErrorAdapter.isValidErrorCodesError(invalidError)).toBe(false)

      expect(UC05ErrorAdapter.isValidErrorCodesError(null)).toBe(false)
      expect(UC05ErrorAdapter.isValidErrorCodesError({})).toBe(false)
      expect(UC05ErrorAdapter.isValidErrorCodesError('string')).toBe(false)
    })

    test('應該檢查code屬性', () => {
      const errorWithoutCode = new Error('測試')
      errorWithoutCode.details = {}

      expect(UC05ErrorAdapter.isValidErrorCodesError(errorWithoutCode)).toBe(false)
    })

    test('應該檢查details屬性', () => {
      const errorWithoutDetails = new Error('測試')
      errorWithoutDetails.code = ErrorCodes.VALIDATION_ERROR

      expect(UC05ErrorAdapter.isValidErrorCodesError(errorWithoutDetails)).toBe(false)

      const errorWithNullDetails = new Error('測試')
      errorWithNullDetails.code = ErrorCodes.VALIDATION_ERROR
      errorWithNullDetails.details = null

      expect(UC05ErrorAdapter.isValidErrorCodesError(errorWithNullDetails)).toBe(false)
    })
  })

  describe('Chrome Extension 相容性', () => {
    test('錯誤物件應該可以JSON序列化', () => {
      const error = UC05ErrorAdapter.convertError(
        'DATA_SYNC_VERSION_MISMATCH',
        '測試訊息',
        { localVersion: '2.0.0' }
      )

      const serialized = JSON.stringify(error)
      expect(serialized).toBeDefined()

      const parsed = JSON.parse(serialized)
      expect(parsed.message).toBe('測試訊息')
      expect(parsed.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(parsed.details.localVersion).toBe('2.0.0')
    })

    test('轉換錯誤應該可以JSON序列化', () => {
      const error = UC05ErrorAdapter.convertError('INVALID_CODE', '測試')

      const serialized = JSON.stringify(error)
      const parsed = JSON.parse(serialized)

      expect(parsed.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(parsed.details.conversionError).toBe(true)
    })

    test('應該支援toJSON方法', () => {
      const error = UC05ErrorAdapter.convertError(
        'DATA_SYNC_VERSION_MISMATCH',
        '測試訊息'
      )

      expect(typeof error.toJSON).toBe('function')

      const jsonObj = error.toJSON()
      expect(jsonObj.message).toBe('測試訊息')
      expect(jsonObj.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(jsonObj.details).toBeDefined()
    })
  })

  describe('同步場景特定測試', () => {
    test('版本錯誤應該包含版本資訊', () => {
      const error = UC05ErrorAdapter.convertError(
        'DATA_SYNC_VERSION_MISMATCH',
        '版本不相容',
        {
          localVersion: '2.1.0',
          remoteVersion: '1.8.0',
          compatibility: 'backward_compatible',
          migrationRequired: true
        }
      )

      expect(error.details.localVersion).toBe('2.1.0')
      expect(error.details.remoteVersion).toBe('1.8.0')
      expect(error.details.compatibility).toBe('backward_compatible')
      expect(error.details.migrationRequired).toBe(true)
    })

    test('時間戳錯誤應該包含衝突資訊', () => {
      const error = UC05ErrorAdapter.convertError(
        'DATA_SYNC_TIMESTAMP_CONFLICT',
        '時間戳衝突',
        {
          conflictedBooks: [
            {
              id: 'book_456',
              device1: { lastModified: '2025-01-15T09:00:00Z' },
              device2: { lastModified: '2025-01-15T10:30:00Z' }
            }
          ],
          resolutionStrategy: 'latest_timestamp_wins'
        }
      )

      expect(error.details.conflictedBooks).toHaveLength(1)
      expect(error.details.resolutionStrategy).toBe('latest_timestamp_wins')
    })

    test('網路錯誤應該包含雲端服務資訊', () => {
      const error = UC05ErrorAdapter.convertError(
        'NETWORK_CLOUD_SERVICE_UNAVAILABLE',
        '雲端服務無法連接',
        {
          cloudService: 'Google Drive',
          lastSuccessfulSync: '2025-01-14T18:00:00Z',
          retryAttempts: 3
        }
      )

      expect(error.details.cloudService).toBe('Google Drive')
      expect(error.details.lastSuccessfulSync).toBe('2025-01-14T18:00:00Z')
      expect(error.details.retryAttempts).toBe(3)
    })

    test('檔案損壞錯誤應該包含恢復資訊', () => {
      const error = UC05ErrorAdapter.convertError(
        'DATA_SYNC_CORRUPTION_DETECTED',
        '檔案損壞',
        {
          corruptionType: 'partial_json_truncation',
          lastKnownGoodBackup: '2025-01-13T12:00:00Z',
          dataLossRisk: 'medium'
        }
      )

      expect(error.details.corruptionType).toBe('partial_json_truncation')
      expect(error.details.lastKnownGoodBackup).toBe('2025-01-13T12:00:00Z')
      expect(error.details.dataLossRisk).toBe('medium')
    })
  })

  describe('效能測試', () => {
    test('大量錯誤轉換應該保持效能', () => {
      const startTime = Date.now()

      for (let i = 0; i < 100; i++) {
        UC05ErrorAdapter.convertError(
          'DATA_SYNC_VERSION_MISMATCH',
          `測試訊息 ${i}`,
          { testIndex: i }
        )
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(50) // 100次轉換應該在50ms內
    })

    test('映射表快取應該減少重複計算', () => {
      const startTime = Date.now()

      for (let i = 0; i < 1000; i++) {
        UC05ErrorAdapter.getErrorMapping()
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(10) // 1000次存取應該在10ms內
    })
  })

  describe('錯誤分類驗證', () => {
    test('VALIDATION_ERROR 類型應該正確映射', () => {
      const versionError = UC05ErrorAdapter.convertError('DATA_SYNC_VERSION_MISMATCH', '版本錯誤')
      const timestampError = UC05ErrorAdapter.convertError('DATA_SYNC_TIMESTAMP_CONFLICT', '時間戳錯誤')

      expect(versionError.code).toBe(ErrorCodes.VALIDATION_ERROR)
      expect(timestampError.code).toBe(ErrorCodes.VALIDATION_ERROR)
    })

    test('NETWORK_ERROR 類型應該正確映射', () => {
      const networkError = UC05ErrorAdapter.convertError('NETWORK_CLOUD_SERVICE_UNAVAILABLE', '網路錯誤')

      expect(networkError.code).toBe(ErrorCodes.NETWORK_ERROR)
    })

    test('FILE_ERROR 類型應該正確映射', () => {
      const fileError = UC05ErrorAdapter.convertError('DATA_SYNC_CORRUPTION_DETECTED', '檔案錯誤')

      expect(fileError.code).toBe(ErrorCodes.FILE_ERROR)
    })
  })
})
