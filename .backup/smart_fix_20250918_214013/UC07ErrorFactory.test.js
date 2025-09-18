/**
 * UC07ErrorFactory 單元測試
 * 測試 UC-07 錯誤處理與恢復專用錯誤工廠的所有功能
 * 基於 UC-01~UC-06 成功測試模式，針對錯誤處理系統優化
 */

import { UC07ErrorFactory } from '../../../../src/core/errors/UC07ErrorFactory.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC07ErrorFactory', () => {
  afterEach(() => {
    UC07ErrorFactory.clearCache()
  })

  describe('createError', () => {
    test('應該建立基本的 UC-07 錯誤', () => {
      const error = UC07ErrorFactory.createError(
        'SYSTEM_ERROR_HANDLER_RECURSION',
        '遞迴錯誤'
      )

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('UC07Error')
      expect(error.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(error.message).toBe('遞迴錯誤')
      expect(error.subType).toBe('ERROR_HANDLER_RECURSION')
    })

    test('應該建立帶有詳細資訊的錯誤', () => {
      const details = { recursionDepth: 5, emergencyMode: true }
      const error = UC07ErrorFactory.createError(
        'SYSTEM_ERROR_HANDLER_RECURSION',
        '測試錯誤',
        details
      )

      expect(error.details).toMatchObject(details)
      expect(error.details.originalCode).toBe('SYSTEM_ERROR_HANDLER_RECURSION')
    })
  })

  describe('createResult', () => {
    test('應該建立成功結果物件', () => {
      const data = { handledErrors: 10, systemStable: true }
      const result = UC07ErrorFactory.createResult(true, data)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(data)
      expect(result.code).toBe('SUCCESS')
      expect(result.message).toBe('Error handling operation completed successfully')
    })

    test('應該建立失敗結果物件', () => {
      const error = UC07ErrorFactory.createHandlerRecursionError()
      const result = UC07ErrorFactory.createResult(false, null, error)

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(result.subType).toBe('ERROR_HANDLER_RECURSION')
      expect(result.details).toBeDefined()
    })

    test('應該處理簡單錯誤物件', () => {
      const simpleError = new Error('簡單錯誤')
      const result = UC07ErrorFactory.createResult(false, null, simpleError)

      expect(result.success).toBe(false)
      expect(result.error).toBe('簡單錯誤')
      expect(result.code).toBe(ErrorCodes.UNKNOWN_ERROR)
    })
  })

  describe('createHandlerRecursionError', () => {
    test('應該建立錯誤處理器遞迴錯誤', () => {
      const error = UC07ErrorFactory.createHandlerRecursionError(
        8, 'DATA_VALIDATION_FAILED', ['handleDataError', 'logError'], true
      )

      expect(error.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(error.subType).toBe('ERROR_HANDLER_RECURSION')
      expect(error.message).toContain('錯誤處理器發生遞迴錯誤')
      expect(error.message).toContain('深度: 8')
      expect(error.details.recursionDepth).toBe(8)
      expect(error.details.originalError).toBe('DATA_VALIDATION_FAILED')
      expect(error.details.handlerStack).toEqual(['handleDataError', 'logError'])
      expect(error.details.emergencyMode).toBe(true)
    })

    test('應該包含錯誤處理分析', () => {
      const error = UC07ErrorFactory.createHandlerRecursionError(6)

      expect(error.details.errorHandling).toBeDefined()
      expect(error.details.errorHandling.recursionDetected).toBe(true)
      expect(error.details.errorHandling.breakCircuit).toBe(true)
      expect(error.details.recovery.emergencyFallback).toBe(true)
      expect(error.details.recovery.safeMode).toBe(true)
    })

    test('應該使用預設參數', () => {
      const error = UC07ErrorFactory.createHandlerRecursionError()

      expect(error.details.recursionDepth).toBe(5)
      expect(error.details.originalError).toBe('UNKNOWN_ERROR')
      expect(error.details.handlerStack).toHaveLength(3)
      expect(error.details.emergencyMode).toBe(true)
    })
  })

  describe('createLoggingFailureError', () => {
    test('應該建立日誌記錄失敗錯誤', () => {
      const error = UC07ErrorFactory.createLoggingFailureError(
        'chrome.storage.local', 25, true, 'memory_buffer'
      )

      expect(error.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(error.subType).toBe('ERROR_LOGGING_FAILURE')
      expect(error.message).toContain('錯誤日誌記錄系統失敗')
      expect(error.message).toContain('25 事件失敗')
      expect(error.details.logDestination).toBe('chrome.storage.local')
      expect(error.details.failedEvents).toBe(25)
      expect(error.details.storageQuotaExceeded).toBe(true)
      expect(error.details.fallbackLogging).toBe('memory_buffer')
    })

    test('應該包含日誌和儲存分析', () => {
      const error = UC07ErrorFactory.createLoggingFailureError(
        'chrome.storage.local', 15, true
      )

      expect(error.details.logging).toBeDefined()
      expect(error.details.logging.status).toBe('quota_exceeded')
      expect(error.details.storage.quotaExceeded).toBe(true)
      expect(error.details.storage.fallbackActive).toBe(true)
      expect(error.details.recovery.fallbackMethod).toBe('memory_buffer')
    })

    test('應該使用預設參數', () => {
      const error = UC07ErrorFactory.createLoggingFailureError()

      expect(error.details.logDestination).toBe('chrome.storage.local')
      expect(error.details.failedEvents).toBe(0)
      expect(error.details.storageQuotaExceeded).toBe(false)
      expect(error.details.fallbackLogging).toBe('memory_buffer')
    })
  })

  describe('createRecoveryExhaustedError', () => {
    test('應該建立恢復機制失效錯誤', () => {
      const attempts = [
        { strategy: 'restart_service', result: 'failed', timestamp: Date.now() - 30000 },
        { strategy: 'clear_cache', result: 'failed', timestamp: Date.now() - 20000 }
      ]

      const error = UC07ErrorFactory.createRecoveryExhaustedError(
        attempts, true, 'severely_damaged'
      )

      expect(error.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(error.subType).toBe('RECOVERY_MECHANISM_EXHAUSTED')
      expect(error.message).toContain('所有自動恢復機制都已失效')
      expect(error.message).toContain('2 次嘗試失敗')
      expect(error.details.failedRecoveryAttempts).toEqual(attempts)
      expect(error.details.manualInterventionRequired).toBe(true)
      expect(error.details.systemState).toBe('severely_damaged')
    })

    test('應該包含恢復和系統分析', () => {
      const error = UC07ErrorFactory.createRecoveryExhaustedError()

      expect(error.details.recovery).toBeDefined()
      expect(error.details.recovery.totalAttempts).toBeGreaterThan(0)
      expect(error.details.recovery.allFailed).toBe(true)
      expect(error.details.system.state).toBe('damaged')
      expect(error.details.intervention.required).toBe(true)
    })

    test('應該計算時間跨度', () => {
      const attempts = [
        { strategy: 'restart', result: 'failed', timestamp: 1000000 },
        { strategy: 'reset', result: 'failed', timestamp: 1030000 }
      ]

      const error = UC07ErrorFactory.createRecoveryExhaustedError(attempts)

      expect(error.details.recovery.timespan).toContain('30s')
    })

    test('應該使用預設參數', () => {
      const error = UC07ErrorFactory.createRecoveryExhaustedError()

      expect(error.details.failedRecoveryAttempts).toHaveLength(3)
      expect(error.details.manualInterventionRequired).toBe(true)
      expect(error.details.systemState).toBe('damaged')
    })
  })

  describe('createPatternLearningError', () => {
    test('應該建立模式學習過載錯誤', () => {
      const error = UC07ErrorFactory.createPatternLearningError(
        1500, 1000, '2024-12-01', true, 'keep_recent_and_frequent'
      )

      expect(error.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(error.subType).toBe('PATTERN_LEARNING_OVERFLOW')
      expect(error.message).toContain('錯誤模式學習資料過載')
      expect(error.message).toContain('1500/1000 模式')
      expect(error.details.learnedPatterns).toBe(1500)
      expect(error.details.storageLimit).toBe(1000)
      expect(error.details.oldestPattern).toBe('2024-12-01')
      expect(error.details.pruningRequired).toBe(true)
      expect(error.details.retentionPolicy).toBe('keep_recent_and_frequent')
    })

    test('應該包含學習和儲存分析', () => {
      const error = UC07ErrorFactory.createPatternLearningError(1200, 1000)

      expect(error.details.learning).toBeDefined()
      expect(error.details.learning.capacityUsed).toBe('120%')
      expect(error.details.learning.overflowAmount).toBe(200)
      expect(error.details.storage.currentSize).toBe(1200)
      expect(error.details.storage.availableSpace).toBe(0)
      expect(error.details.pruning.required).toBe(true)
    })

    test('應該生成最舊模式日期', () => {
      const error = UC07ErrorFactory.createPatternLearningError()

      expect(error.details.oldestPattern).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    test('應該使用預設參數', () => {
      const error = UC07ErrorFactory.createPatternLearningError()

      expect(error.details.learnedPatterns).toBe(1000)
      expect(error.details.storageLimit).toBe(1000)
      expect(error.details.pruningRequired).toBe(true)
      expect(error.details.retentionPolicy).toBe('keep_recent_and_frequent')
    })
  })

  describe('createSystemStageError', () => {
    test('應該為錯誤處理相關階段建立遞迴錯誤', () => {
      const error = UC07ErrorFactory.createSystemStageError(
        'error_handling', 'validateInput', { recursionDepth: 4 }
      )

      expect(error.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(error.subType).toBe('ERROR_HANDLER_RECURSION')
    })

    test('應該為日誌相關階段建立日誌錯誤', () => {
      const error = UC07ErrorFactory.createSystemStageError(
        'logging', 'writeLog', { failedEvents: 10 }
      )

      expect(error.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(error.subType).toBe('ERROR_LOGGING_FAILURE')
    })

    test('應該為恢復相關階段建立恢復錯誤', () => {
      const error = UC07ErrorFactory.createSystemStageError(
        'recovery', 'restartService'
      )

      expect(error.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(error.subType).toBe('RECOVERY_MECHANISM_EXHAUSTED')
    })

    test('應該為學習相關階段建立學習錯誤', () => {
      const error = UC07ErrorFactory.createSystemStageError(
        'pattern_learning', 'analyzePatterns'
      )

      expect(error.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(error.subType).toBe('PATTERN_LEARNING_OVERFLOW')
    })

    test('應該為其他階段建立預設錯誤', () => {
      const error = UC07ErrorFactory.createSystemStageError(
        'unknown_stage', 'unknownOperation'
      )

      expect(error.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(error.subType).toBe('ERROR_HANDLER_RECURSION')
    })
  })

  describe('getCommonError - 快取機制', () => {
    test('應該快取常用錯誤', () => {
      const error1 = UC07ErrorFactory.getCommonError('RECURSION')
      const error2 = UC07ErrorFactory.getCommonError('RECURSION')

      expect(error1).toBe(error2) // 相同參考
      expect(error1.code).toBe(ErrorCodes.OPERATION_ERROR)
    })

    test('應該支援所有快取錯誤類型', () => {
      const recursionError = UC07ErrorFactory.getCommonError('RECURSION')
      const loggingError = UC07ErrorFactory.getCommonError('LOGGING')
      const recoveryError = UC07ErrorFactory.getCommonError('RECOVERY')
      const learningError = UC07ErrorFactory.getCommonError('LEARNING')

      expect(recursionError.subType).toBe('ERROR_HANDLER_RECURSION')
      expect(loggingError.subType).toBe('ERROR_LOGGING_FAILURE')
      expect(recoveryError.subType).toBe('RECOVERY_MECHANISM_EXHAUSTED')
      expect(learningError.subType).toBe('PATTERN_LEARNING_OVERFLOW')
    })

    test('應該處理未知快取類型', () => {
      const error = UC07ErrorFactory.getCommonError('UNKNOWN_TYPE')

      expect(error.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(error.subType).toBe('ERROR_HANDLER_RECURSION')
    })
  })

  describe('clearCache', () => {
    test('應該清除錯誤快取', () => {
      UC07ErrorFactory.getCommonError('RECURSION')
      expect(UC07ErrorFactory._commonErrorCache.size).toBeGreaterThan(0)

      UC07ErrorFactory.clearCache()
      expect(UC07ErrorFactory._commonErrorCache.size).toBe(0)
    })
  })

  describe('sanitizeDetails', () => {
    test('應該保留正常大小的詳細資訊', () => {
      const details = { field1: 'value1', field2: 'value2' }
      const sanitized = UC07ErrorFactory.sanitizeDetails(details)

      expect(sanitized).toEqual(details)
    })

    test('應該截斷過大的詳細資訊', () => {
      const largeDetails = {
        largeField: 'x'.repeat(20000)
      }

      const sanitized = UC07ErrorFactory.sanitizeDetails(largeDetails)

      expect(sanitized._truncated).toBe(true)
      expect(sanitized._originalSize).toBeGreaterThan(15000)
      expect(sanitized.summary).toContain('truncated')
    })

    test('應該處理無效輸入', () => {
      expect(UC07ErrorFactory.sanitizeDetails(null)).toEqual({})
      expect(UC07ErrorFactory.sanitizeDetails(undefined)).toEqual({})
      expect(UC07ErrorFactory.sanitizeDetails('string')).toEqual({})
    })
  })

  describe('isValidUC07Error', () => {
    test('應該驗證有效的 UC-07 錯誤', () => {
      const error = UC07ErrorFactory.createHandlerRecursionError()

      expect(UC07ErrorFactory.isValidUC07Error(error)).toBe(true)
    })

    test('應該拒絕無效的錯誤', () => {
      const invalidError = new Error('普通錯誤')
      expect(UC07ErrorFactory.isValidUC07Error(invalidError)).toBe(false)

      const errorWithWrongSubType = UC07ErrorFactory.createHandlerRecursionError()
      errorWithWrongSubType.subType = 'WRONG_SUBTYPE'
      expect(UC07ErrorFactory.isValidUC07Error(errorWithWrongSubType)).toBe(false)
    })

    test('應該檢查UC-07相關的subType', () => {
      const validSubTypes = [
        'ERROR_HANDLER_RECURSION',
        'ERROR_LOGGING_FAILURE',
        'RECOVERY_MECHANISM_EXHAUSTED',
        'PATTERN_LEARNING_OVERFLOW'
      ]

      validSubTypes.forEach(subType => {
        const error = UC07ErrorFactory.createHandlerRecursionError()
        error.subType = subType
        expect(UC07ErrorFactory.isValidUC07Error(error)).toBe(true)
      })
    })
  })

  describe('錯誤處理系統專用測試', () => {
    test('遞迴錯誤應該包含緊急模式指引', () => {
      const error = UC07ErrorFactory.createHandlerRecursionError(10)

      expect(error.details.errorHandling.maxDepthExceeded).toBe(true)
      expect(error.details.recovery.emergencyFallback).toBe(true)
      expect(error.details.recovery.skipLogging).toBe(true)
    })

    test('日誌錯誤應該提供回退策略', () => {
      const error = UC07ErrorFactory.createLoggingFailureError(
        'chrome.storage.local', 60, true
      )

      expect(error.details.recovery.emergencyCleanup).toBe(true)
      expect(error.details.storage.cleanupRequired).toBe(true)
      expect(error.details.recovery.logRotationNeeded).toBe(true)
    })

    test('恢復錯誤應該提供介入建議', () => {
      const error = UC07ErrorFactory.createRecoveryExhaustedError()

      expect(error.details.intervention.required).toBe(true)
      expect(error.details.intervention.suggestedActions).toBeDefined()
      expect(Array.isArray(error.details.intervention.suggestedActions)).toBe(true)
    })

    test('學習錯誤應該提供修剪策略', () => {
      const error = UC07ErrorFactory.createPatternLearningError(1200, 1000)

      expect(error.details.pruning.required).toBe(true)
      expect(error.details.pruning.estimatedRemoval).toBeGreaterThan(0)
      expect(error.details.pruning.strategy).toBe('keep_recent_and_frequent')
    })
  })

  describe('效能測試', () => {
    test('常用錯誤建立應該快速', () => {
      const startTime = Date.now()

      for (let i = 0; i < 50; i++) {
        UC07ErrorFactory.getCommonError('RECURSION')
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(10) // 50次建立應該在10ms內
    })

    test('錯誤建立應該在合理時間內完成', () => {
      const startTime = Date.now()

      for (let i = 0; i < 20; i++) {
        UC07ErrorFactory.createHandlerRecursionError(i, `ERROR_${i}`)
        UC07ErrorFactory.createLoggingFailureError('storage', i, i > 10)
        UC07ErrorFactory.createRecoveryExhaustedError()
        UC07ErrorFactory.createPatternLearningError(1000 + i, 1000)
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(100) // 80次錯誤建立應該在100ms內
    })
  })

  describe('私有輔助方法測試', () => {
    test('_calculateTimespan 應該正確計算時間', () => {
      const attempts = [
        { timestamp: 1000000 },
        { timestamp: 1030000 }
      ]

      const timespan = UC07ErrorFactory._calculateTimespan(attempts)
      expect(timespan).toBe('30s')
    })

    test('_assessFunctionality 應該正確評估功能性', () => {
      const criticalAttempts = [
        { strategy: 'restart_service' },
        { strategy: 'restart_system' }
      ]

      const functionality = UC07ErrorFactory._assessFunctionality(criticalAttempts)
      expect(functionality).toBe('severely_degraded')
    })
  })
})
