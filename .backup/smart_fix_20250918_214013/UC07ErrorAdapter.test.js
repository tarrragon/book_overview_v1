/**
 * UC07ErrorAdapter 單元測試
 * 測試 UC-07 錯誤處理與恢復錯誤轉換適配器的所有功能
 * 基於 UC-01~UC-06 成功測試模式，針對錯誤處理系統優化
 */

import { UC07ErrorAdapter } from '../../../../src/core/errors/UC07ErrorAdapter.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC07ErrorAdapter', () => {
  describe('getErrorMapping', () => {
    test('應該回傳4個StandardError的映射', () => {
      const mapping = UC07ErrorAdapter.getErrorMapping()

      expect(Object.keys(mapping)).toHaveLength(4)
      expect(mapping).toEqual({
        SYSTEM_ERROR_HANDLER_RECURSION: ErrorCodes.OPERATION_ERROR,
        SYSTEM_ERROR_LOGGING_FAILURE: ErrorCodes.STORAGE_ERROR,
        SYSTEM_RECOVERY_MECHANISM_EXHAUSTED: ErrorCodes.OPERATION_ERROR,
        DATA_ERROR_PATTERN_LEARNING_OVERFLOW: ErrorCodes.STORAGE_ERROR
      })
    })

    test('應該快取映射表', () => {
      const mapping1 = UC07ErrorAdapter.getErrorMapping()
      const mapping2 = UC07ErrorAdapter.getErrorMapping()

      expect(mapping1).toBe(mapping2) // 相同參考
      expect(Object.isFrozen(mapping1)).toBe(true)
    })
  })

  describe('extractSubType', () => {
    test('應該提取正確的子類型', () => {
      expect(UC07ErrorAdapter.extractSubType('SYSTEM_ERROR_HANDLER_RECURSION'))
        .toBe('ERROR_HANDLER_RECURSION')
      expect(UC07ErrorAdapter.extractSubType('SYSTEM_ERROR_LOGGING_FAILURE'))
        .toBe('ERROR_LOGGING_FAILURE')
      expect(UC07ErrorAdapter.extractSubType('SYSTEM_RECOVERY_MECHANISM_EXHAUSTED'))
        .toBe('RECOVERY_MECHANISM_EXHAUSTED')
      expect(UC07ErrorAdapter.extractSubType('DATA_ERROR_PATTERN_LEARNING_OVERFLOW'))
        .toBe('PATTERN_LEARNING_OVERFLOW')
    })

    test('應該處理未知錯誤代碼', () => {
      expect(UC07ErrorAdapter.extractSubType('UNKNOWN_CODE'))
        .toBe('UNKNOWN_SUBTYPE')
      expect(UC07ErrorAdapter.extractSubType(''))
        .toBe('UNKNOWN_SUBTYPE')
    })
  })

  describe('convertError', () => {
    test('應該轉換SYSTEM_ERROR_HANDLER_RECURSION為OPERATION_ERROR', () => {
      const error = UC07ErrorAdapter.convertError(
        'SYSTEM_ERROR_HANDLER_RECURSION',
        '錯誤處理器遞迴錯誤',
        { recursionDepth: 5, emergencyMode: true }
      )

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('UC07Error')
      expect(error.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(error.message).toBe('錯誤處理器遞迴錯誤')
      expect(error.subType).toBe('ERROR_HANDLER_RECURSION')
      expect(error.details).toMatchObject({
        recursionDepth: 5,
        emergencyMode: true,
        originalCode: 'SYSTEM_ERROR_HANDLER_RECURSION',
        severity: 'CRITICAL'
      })
    })

    test('應該轉換SYSTEM_ERROR_LOGGING_FAILURE為STORAGE_ERROR', () => {
      const error = UC07ErrorAdapter.convertError(
        'SYSTEM_ERROR_LOGGING_FAILURE',
        '日誌記錄系統失敗'
      )

      expect(error.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(error.subType).toBe('ERROR_LOGGING_FAILURE')
      expect(error.details.severity).toBe('MODERATE')
    })

    test('應該轉換SYSTEM_RECOVERY_MECHANISM_EXHAUSTED為OPERATION_ERROR', () => {
      const error = UC07ErrorAdapter.convertError(
        'SYSTEM_RECOVERY_MECHANISM_EXHAUSTED',
        '恢復機制失效'
      )

      expect(error.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(error.subType).toBe('RECOVERY_MECHANISM_EXHAUSTED')
      expect(error.details.severity).toBe('SEVERE')
    })

    test('應該轉換DATA_ERROR_PATTERN_LEARNING_OVERFLOW為STORAGE_ERROR', () => {
      const error = UC07ErrorAdapter.convertError(
        'DATA_ERROR_PATTERN_LEARNING_OVERFLOW',
        '模式學習過載'
      )

      expect(error.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(error.subType).toBe('PATTERN_LEARNING_OVERFLOW')
      expect(error.details.severity).toBe('MINOR')
    })

    test('應該使用預設訊息', () => {
      const error = UC07ErrorAdapter.convertError('SYSTEM_ERROR_HANDLER_RECURSION')

      expect(error.message).toBe('UC-07 error handling operation failed')
    })

    test('應該合併額外的詳細資訊', () => {
      const details = {
        customField: 'value',
        handlerStack: ['handleError', 'logError']
      }

      const error = UC07ErrorAdapter.convertError(
        'SYSTEM_ERROR_HANDLER_RECURSION',
        '測試訊息',
        details
      )

      expect(error.details).toMatchObject({
        customField: 'value',
        handlerStack: ['handleError', 'logError'],
        originalCode: 'SYSTEM_ERROR_HANDLER_RECURSION'
      })
    })

    test('應該包含時間戳', () => {
      const before = Date.now()
      const error = UC07ErrorAdapter.convertError('SYSTEM_ERROR_HANDLER_RECURSION', '測試')
      const after = Date.now()

      expect(error.details.timestamp).toBeGreaterThanOrEqual(before)
      expect(error.details.timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('convertError - 錯誤處理', () => {
    test('應該處理無效的錯誤代碼', () => {
      const error = UC07ErrorAdapter.convertError(null, '測試訊息')

      expect(error.name).toBe('UC07ConversionError')
      expect(error.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(error.subType).toBe('UC07_CONVERSION_ERROR')
      expect(error.message).toContain('Invalid error code provided')
      expect(error.details.conversionError).toBe(true)
    })

    test('應該處理未知的錯誤代碼', () => {
      const error = UC07ErrorAdapter.convertError('UNKNOWN_UC07_CODE', '測試訊息')

      expect(error.name).toBe('UC07ConversionError')
      expect(error.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(error.message).toContain('Unknown UC-07 error code')
      expect(error.details.unknownCode).toBe('UNKNOWN_UC07_CODE')
      expect(error.details.availableCodes).toEqual([
        'SYSTEM_ERROR_HANDLER_RECURSION',
        'SYSTEM_ERROR_LOGGING_FAILURE',
        'SYSTEM_RECOVERY_MECHANISM_EXHAUSTED',
        'DATA_ERROR_PATTERN_LEARNING_OVERFLOW'
      ])
    })

    test('應該處理空字串錯誤代碼', () => {
      const error = UC07ErrorAdapter.convertError('', '測試訊息')

      expect(error.name).toBe('UC07ConversionError')
      expect(error.message).toContain('Invalid error code provided')
    })

    test('應該處理非字串錯誤代碼', () => {
      const error = UC07ErrorAdapter.convertError(123, '測試訊息')

      expect(error.name).toBe('UC07ConversionError')
      expect(error.details.receivedCode).toBe(123)
    })
  })

  describe('getSeverityFromCode', () => {
    test('應該回傳正確的嚴重程度', () => {
      expect(UC07ErrorAdapter.getSeverityFromCode('SYSTEM_ERROR_HANDLER_RECURSION'))
        .toBe('CRITICAL')
      expect(UC07ErrorAdapter.getSeverityFromCode('SYSTEM_ERROR_LOGGING_FAILURE'))
        .toBe('MODERATE')
      expect(UC07ErrorAdapter.getSeverityFromCode('SYSTEM_RECOVERY_MECHANISM_EXHAUSTED'))
        .toBe('SEVERE')
      expect(UC07ErrorAdapter.getSeverityFromCode('DATA_ERROR_PATTERN_LEARNING_OVERFLOW'))
        .toBe('MINOR')
    })

    test('應該對未知代碼回傳預設嚴重程度', () => {
      expect(UC07ErrorAdapter.getSeverityFromCode('UNKNOWN_CODE'))
        .toBe('MODERATE')
    })
  })

  describe('isValidErrorCodesError', () => {
    test('應該驗證有效的ErrorCodes錯誤', () => {
      const error = UC07ErrorAdapter.convertError(
        'SYSTEM_ERROR_HANDLER_RECURSION',
        '測試訊息'
      )

      expect(UC07ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
    })

    test('應該拒絕無效的錯誤物件', () => {
      const invalidError = new Error('普通錯誤')
      expect(UC07ErrorAdapter.isValidErrorCodesError(invalidError)).toBe(false)

      expect(UC07ErrorAdapter.isValidErrorCodesError(null)).toBe(false)
      expect(UC07ErrorAdapter.isValidErrorCodesError({})).toBe(false)
      expect(UC07ErrorAdapter.isValidErrorCodesError('string')).toBe(false)
    })

    test('應該檢查code屬性', () => {
      const errorWithoutCode = new Error('測試')
      errorWithoutCode.details = {}

      expect(UC07ErrorAdapter.isValidErrorCodesError(errorWithoutCode)).toBe(false)
    })

    test('應該檢查details屬性', () => {
      const errorWithoutDetails = new Error('測試')
      errorWithoutDetails.code = ErrorCodes.OPERATION_ERROR

      expect(UC07ErrorAdapter.isValidErrorCodesError(errorWithoutDetails)).toBe(false)

      const errorWithNullDetails = new Error('測試')
      errorWithNullDetails.code = ErrorCodes.OPERATION_ERROR
      errorWithNullDetails.details = null

      expect(UC07ErrorAdapter.isValidErrorCodesError(errorWithNullDetails)).toBe(false)
    })
  })

  describe('Chrome Extension 相容性', () => {
    test('錯誤物件應該可以JSON序列化', () => {
      const error = UC07ErrorAdapter.convertError(
        'SYSTEM_ERROR_HANDLER_RECURSION',
        '測試訊息',
        { recursionDepth: 3 }
      )

      const serialized = JSON.stringify(error)
      expect(serialized).toBeDefined()

      const parsed = JSON.parse(serialized)
      expect(parsed.message).toBe('測試訊息')
      expect(parsed.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(parsed.details.recursionDepth).toBe(3)
    })

    test('轉換錯誤應該可以JSON序列化', () => {
      const error = UC07ErrorAdapter.convertError('INVALID_CODE', '測試')

      const serialized = JSON.stringify(error)
      const parsed = JSON.parse(serialized)

      expect(parsed.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(parsed.details.conversionError).toBe(true)
    })

    test('應該支援toJSON方法', () => {
      const error = UC07ErrorAdapter.convertError(
        'SYSTEM_ERROR_HANDLER_RECURSION',
        '測試訊息'
      )

      expect(typeof error.toJSON).toBe('function')

      const jsonObj = error.toJSON()
      expect(jsonObj.message).toBe('測試訊息')
      expect(jsonObj.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(jsonObj.details).toBeDefined()
    })
  })

  describe('錯誤處理系統特定測試', () => {
    test('遞迴錯誤應該包含處理器資訊', () => {
      const error = UC07ErrorAdapter.convertError(
        'SYSTEM_ERROR_HANDLER_RECURSION',
        '遞迴錯誤',
        {
          recursionDepth: 8,
          originalError: 'DATA_VALIDATION_FAILED',
          handlerStack: ['handleDataError', 'logError', 'validateErrorData'],
          emergencyMode: true
        }
      )

      expect(error.details.recursionDepth).toBe(8)
      expect(error.details.originalError).toBe('DATA_VALIDATION_FAILED')
      expect(error.details.handlerStack).toHaveLength(3)
      expect(error.details.emergencyMode).toBe(true)
    })

    test('日誌錯誤應該包含儲存資訊', () => {
      const error = UC07ErrorAdapter.convertError(
        'SYSTEM_ERROR_LOGGING_FAILURE',
        '日誌失敗',
        {
          logDestination: 'chrome.storage.local',
          failedEvents: 25,
          storageQuotaExceeded: true,
          fallbackLogging: 'memory_buffer'
        }
      )

      expect(error.details.logDestination).toBe('chrome.storage.local')
      expect(error.details.failedEvents).toBe(25)
      expect(error.details.storageQuotaExceeded).toBe(true)
      expect(error.details.fallbackLogging).toBe('memory_buffer')
    })

    test('恢復錯誤應該包含嘗試資訊', () => {
      const error = UC07ErrorAdapter.convertError(
        'SYSTEM_RECOVERY_MECHANISM_EXHAUSTED',
        '恢復失敗',
        {
          failedRecoveryAttempts: [
            { strategy: 'restart_service', result: 'failed' },
            { strategy: 'clear_cache', result: 'failed' }
          ],
          manualInterventionRequired: true
        }
      )

      expect(error.details.failedRecoveryAttempts).toHaveLength(2)
      expect(error.details.manualInterventionRequired).toBe(true)
    })

    test('學習錯誤應該包含模式資訊', () => {
      const error = UC07ErrorAdapter.convertError(
        'DATA_ERROR_PATTERN_LEARNING_OVERFLOW',
        '學習過載',
        {
          learnedPatterns: 1500,
          storageLimit: 1000,
          oldestPattern: '2024-12-01',
          pruningRequired: true,
          retentionPolicy: 'keep_recent_and_frequent'
        }
      )

      expect(error.details.learnedPatterns).toBe(1500)
      expect(error.details.storageLimit).toBe(1000)
      expect(error.details.oldestPattern).toBe('2024-12-01')
      expect(error.details.pruningRequired).toBe(true)
      expect(error.details.retentionPolicy).toBe('keep_recent_and_frequent')
    })
  })

  describe('效能測試', () => {
    test('大量錯誤轉換應該保持效能', () => {
      const startTime = Date.now()

      for (let i = 0; i < 100; i++) {
        UC07ErrorAdapter.convertError(
          'SYSTEM_ERROR_HANDLER_RECURSION',
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
        UC07ErrorAdapter.getErrorMapping()
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(10) // 1000次存取應該在10ms內
    })
  })

  describe('錯誤分類驗證', () => {
    test('OPERATION_ERROR 類型應該正確映射', () => {
      const recursionError = UC07ErrorAdapter.convertError('SYSTEM_ERROR_HANDLER_RECURSION', '遞迴錯誤')
      const recoveryError = UC07ErrorAdapter.convertError('SYSTEM_RECOVERY_MECHANISM_EXHAUSTED', '恢復錯誤')

      expect(recursionError.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(recoveryError.code).toBe(ErrorCodes.OPERATION_ERROR)
    })

    test('STORAGE_ERROR 類型應該正確映射', () => {
      const loggingError = UC07ErrorAdapter.convertError('SYSTEM_ERROR_LOGGING_FAILURE', '日誌錯誤')
      const learningError = UC07ErrorAdapter.convertError('DATA_ERROR_PATTERN_LEARNING_OVERFLOW', '學習錯誤')

      expect(loggingError.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(learningError.code).toBe(ErrorCodes.STORAGE_ERROR)
    })
  })
})
