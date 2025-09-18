/**
 * UC07ErrorSystem 整合測試
 * 測試 UC07ErrorAdapter 和 UC07ErrorFactory 的整合協作
 * 模擬真實的錯誤處理與恢復系統使用場景
 */

import { UC07ErrorAdapter } from '../../../../src/core/errors/UC07ErrorAdapter.js'
import { UC07ErrorFactory } from '../../../../src/core/errors/UC07ErrorFactory.js'
import { ErrorCodes } from '../../../../src/core/errors/ErrorCodes.js'

describe('UC07ErrorSystem 整合測試', () => {
  afterEach(() => {
    UC07ErrorFactory.clearCache()
  })

  describe('Adapter 與 Factory 協作', () => {
    test('Factory 建立的錯誤應該通過 Adapter 驗證', () => {
      const error = UC07ErrorFactory.createError(
        'SYSTEM_ERROR_HANDLER_RECURSION',
        '錯誤處理器遞迴錯誤'
      )

      expect(UC07ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
      expect(UC07ErrorFactory.isValidUC07Error(error)).toBe(true)
    })

    test('所有 Factory 方法產生的錯誤都應該有效', () => {
      const errors = [
        UC07ErrorFactory.createHandlerRecursionError(5),
        UC07ErrorFactory.createLoggingFailureError('chrome.storage.local', 10),
        UC07ErrorFactory.createRecoveryExhaustedError([], true),
        UC07ErrorFactory.createPatternLearningError(1200, 1000)
      ]

      errors.forEach(error => {
        expect(UC07ErrorAdapter.isValidErrorCodesError(error)).toBe(true)
        expect(UC07ErrorFactory.isValidUC07Error(error)).toBe(true)
      })
    })
  })

  describe('錯誤處理系統完整流程模擬', () => {
    test('模擬錯誤處理器遞迴檢測與緊急處理', async () => {
      // 模擬錯誤處理器進入遞迴狀態
      const recursionError = UC07ErrorFactory.createHandlerRecursionError(
        8, // 高遞迴深度
        'DATA_VALIDATION_FAILED',
        ['handleDataError', 'logError', 'validateErrorData', 'handleDataError'], // 出現循環
        true, // 緊急模式
        {
          errorContext: 'user_input_validation',
          triggerEvent: 'form_submission',
          systemLoad: 'high',
          memoryPressure: true
        }
      )

      // 驗證錯誤結構
      expect(recursionError.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(recursionError.subType).toBe('ERROR_HANDLER_RECURSION')
      expect(recursionError.details.severity).toBe('CRITICAL')
      expect(recursionError.details.errorHandling.recursionDetected).toBe(true)
      expect(recursionError.details.errorHandling.maxDepthExceeded).toBe(false) // 8 < 10
      expect(recursionError.details.errorHandling.breakCircuit).toBe(true)
      expect(recursionError.details.recovery.emergencyFallback).toBe(true)
      expect(recursionError.details.recovery.skipLogging).toBe(true)

      // 建立結果物件
      const result = UC07ErrorFactory.createResult(false, null, recursionError)

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(result.subType).toBe('ERROR_HANDLER_RECURSION')
    })

    test('模擬日誌系統儲存配額超限與回退處理', async () => {
      // 模擬 Chrome Extension 儲存配額超限
      const loggingError = UC07ErrorFactory.createLoggingFailureError(
        'chrome.storage.local',
        75, // 大量失敗事件
        true, // 配額超限
        'memory_buffer',
        {
          storageUsed: '4.8MB',
          storageLimit: '5MB',
          logBufferSize: '500KB',
          lastSuccessfulWrite: '2025-01-16T10:30:00Z'
        }
      )

      expect(loggingError.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(loggingError.subType).toBe('ERROR_LOGGING_FAILURE')
      expect(loggingError.details.logging.status).toBe('quota_exceeded')
      expect(loggingError.details.storage.quotaExceeded).toBe(true)
      expect(loggingError.details.storage.fallbackActive).toBe(true)
      expect(loggingError.details.recovery.fallbackMethod).toBe('memory_buffer')
      expect(loggingError.details.recovery.emergencyCleanup).toBe(true) // > 50 events
      expect(loggingError.details.recovery.logRotationNeeded).toBe(true)

      // 模擬回退恢復流程
      const fallbackActive = loggingError.details.recovery.fallbackMethod === 'memory_buffer'
      const cleanupRequired = loggingError.details.recovery.emergencyCleanup

      expect(fallbackActive).toBe(true)
      expect(cleanupRequired).toBe(true)
    })

    test('模擬系統自動恢復機制全面失效處理', async () => {
      // 模擬多重恢復嘗試失敗
      const recoveryError = UC07ErrorFactory.createRecoveryExhaustedError(
        [
          { strategy: 'restart_service', result: 'failed', timestamp: Date.now() - 120000 },
          { strategy: 'clear_cache', result: 'failed', timestamp: Date.now() - 90000 },
          { strategy: 'reset_storage', result: 'failed', timestamp: Date.now() - 60000 },
          { strategy: 'restart_extension', result: 'failed', timestamp: Date.now() - 30000 },
          { strategy: 'emergency_reset', result: 'failed', timestamp: Date.now() - 10000 }
        ],
        true, // 需要人工介入
        'severely_damaged',
        {
          systemUptime: '10 hours',
          errorFrequency: 'increasing',
          lastStableState: '2025-01-16T08:00:00Z',
          criticalComponentsAffected: ['storage', 'messaging', 'ui']
        }
      )

      expect(recoveryError.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(recoveryError.subType).toBe('RECOVERY_MECHANISM_EXHAUSTED')
      expect(recoveryError.details.recovery.totalAttempts).toBe(5)
      expect(recoveryError.details.recovery.allFailed).toBe(true)
      expect(recoveryError.details.system.state).toBe('severely_damaged')
      expect(recoveryError.details.system.functionality).toBe('severely_degraded')
      expect(recoveryError.details.intervention.required).toBe(true)
      expect(recoveryError.details.intervention.urgency).toBe('immediate')
      expect(recoveryError.details.intervention.escalation).toBe(true)

      // 驗證時間跨度計算
      expect(recoveryError.details.recovery.timespan).toContain('s')
    })

    test('模擬錯誤模式學習系統資料過載與自動修剪', async () => {
      // 模擬長期運行導致學習資料累積過量
      const learningError = UC07ErrorFactory.createPatternLearningError(
        2500, // 大量模式
        1000, // 容量限制
        '2024-10-15', // 歷史悠久
        true, // 需要修剪
        'keep_recent_and_frequent',
        {
          learningPeriod: '120 days',
          patternCategories: ['validation_errors', 'network_timeouts', 'storage_failures'],
          frequentPatterns: 150,
          recentPatterns: 300,
          storageCompressionRatio: 0.7
        }
      )

      expect(learningError.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(learningError.subType).toBe('PATTERN_LEARNING_OVERFLOW')
      expect(learningError.details.learning.totalPatterns).toBe(2500)
      expect(learningError.details.learning.capacityUsed).toBe('250%')
      expect(learningError.details.learning.overflowAmount).toBe(1500)
      expect(learningError.details.storage.currentSize).toBe(2500)
      expect(learningError.details.storage.availableSpace).toBe(0)
      expect(learningError.details.pruning.required).toBe(true)
      expect(learningError.details.pruning.estimatedRemoval).toBeGreaterThan(1400) // overflow + buffer
      expect(learningError.details.pruning.preserveRecent).toBe(true)
      expect(learningError.details.pruning.preserveFrequent).toBe(true)

      // 模擬修剪策略執行
      const pruningStrategy = learningError.details.pruning.strategy
      const preserveRecent = learningError.details.pruning.preserveRecent
      const preserveFrequent = learningError.details.pruning.preserveFrequent

      expect(pruningStrategy).toBe('keep_recent_and_frequent')
      expect(preserveRecent && preserveFrequent).toBe(true)
    })
  })

  describe('錯誤結果物件整合', () => {
    test('所有錯誤類型都應該可以包裝為結果物件', () => {
      const errors = [
        UC07ErrorFactory.createHandlerRecursionError(),
        UC07ErrorFactory.createLoggingFailureError(),
        UC07ErrorFactory.createRecoveryExhaustedError(),
        UC07ErrorFactory.createPatternLearningError()
      ]

      errors.forEach(error => {
        const result = UC07ErrorFactory.createResult(false, null, error)

        expect(result.success).toBe(false)
        expect(result.code).toBeDefined()
        expect(result.subType).toBeDefined()
        expect(result.details).toBeDefined()
        expect(Object.values(ErrorCodes)).toContain(result.code)
      })
    })

    test('成功錯誤處理操作應該產生正確的結果物件', () => {
      const successData = {
        handledErrors: 25,
        systemStability: 'stable',
        recoveryAttempts: 2,
        logsWritten: 100,
        patternsLearned: 5
      }

      const result = UC07ErrorFactory.createResult(true, successData)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(successData)
      expect(result.code).toBe('SUCCESS')
      expect(result.message).toBe('Error handling operation completed successfully')
    })
  })

  describe('系統階段錯誤整合', () => {
    test('createSystemStageError 應該根據階段選擇正確的錯誤類型', () => {
      const stageTests = [
        { stage: 'error_handling', expectedSubType: 'ERROR_HANDLER_RECURSION' },
        { stage: 'logging', expectedSubType: 'ERROR_LOGGING_FAILURE' },
        { stage: 'recovery', expectedSubType: 'RECOVERY_MECHANISM_EXHAUSTED' },
        { stage: 'pattern_learning', expectedSubType: 'PATTERN_LEARNING_OVERFLOW' }
      ]

      stageTests.forEach(({ stage, expectedSubType }) => {
        const error = UC07ErrorFactory.createSystemStageError(stage, 'testOperation')
        expect(error.subType).toBe(expectedSubType)
        expect(UC07ErrorFactory.isValidUC07Error(error)).toBe(true)
      })
    })
  })

  describe('效能與記憶體管理', () => {
    test('快取機制應該提升重複錯誤建立效能', () => {
      const startTime = Date.now()

      // 建立100個相同類型的錯誤
      for (let i = 0; i < 100; i++) {
        UC07ErrorFactory.getCommonError('RECURSION')
      }

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(20) // 應該在20ms內完成
    })

    test('大型詳細資訊應該被正確清理', () => {
      const largeDetails = {
        handlerStack: new Array(10000).fill().map((_, i) => `handler_${i}`),
        errorHistory: new Array(5000).fill().map((_, i) => ({
          timestamp: Date.now() - i * 1000,
          error: `error_${i}`.repeat(100),
          context: `context_${i}`.repeat(200)
        }))
      }

      const sanitized = UC07ErrorFactory.sanitizeDetails(largeDetails)

      expect(sanitized._truncated).toBe(true)
      expect(sanitized._originalSize).toBeGreaterThan(15000)
      expect(sanitized.summary).toContain('truncated')
    })
  })

  describe('Chrome Extension 相容性', () => {
    test('所有錯誤都應該可以JSON序列化', () => {
      const errors = [
        UC07ErrorFactory.createHandlerRecursionError(5, 'VALIDATION_ERROR'),
        UC07ErrorFactory.createLoggingFailureError('chrome.storage.local', 10, true),
        UC07ErrorFactory.createRecoveryExhaustedError([], true, 'damaged'),
        UC07ErrorFactory.createPatternLearningError(1200, 1000, '2024-12-01')
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
    test('完整錯誤處理流程：從遞迴檢測到系統恢復', async () => {
      // 第一階段：檢測到錯誤處理器遞迴
      let stage = 1
      let error = UC07ErrorFactory.createHandlerRecursionError(
        6, 'USER_INPUT_VALIDATION', ['validateInput', 'handleError', 'logError'], true
      )
      let result = UC07ErrorFactory.createResult(false, null, error)

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCodes.OPERATION_ERROR)

      // 第二階段：遞迴處理導致日誌系統過載
      stage++
      error = UC07ErrorFactory.createLoggingFailureError(
        'chrome.storage.local', 50, true, 'memory_buffer'
      )
      result = UC07ErrorFactory.createResult(false, null, error)

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCodes.STORAGE_ERROR)

      // 第三階段：啟動自動恢復但失敗
      stage++
      error = UC07ErrorFactory.createRecoveryExhaustedError(
        [
          { strategy: 'restart_error_handler', result: 'failed' },
          { strategy: 'clear_log_buffer', result: 'failed' }
        ],
        true
      )
      result = UC07ErrorFactory.createResult(false, null, error)

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCodes.OPERATION_ERROR)

      // 第四階段：人工介入成功恢復
      stage++
      result = UC07ErrorFactory.createResult(true, {
        systemRestored: true,
        errorHandlerReset: true,
        logBufferCleared: true,
        recoveryStage: stage,
        manualIntervention: true
      })

      expect(result.success).toBe(true)
      expect(result.data.systemRestored).toBe(true)
      expect(result.data.recoveryStage).toBe(4)
    })

    test('錯誤學習與資料管理綜合場景', async () => {
      // 步驟1：錯誤模式學習系統過載
      const learningError = UC07ErrorFactory.createPatternLearningError(
        1800, 1000, '2024-11-01', true, 'keep_recent_and_frequent'
      )

      expect(learningError.code).toBe(ErrorCodes.STORAGE_ERROR)
      expect(learningError.details.learning.overflowAmount).toBe(800)

      // 步驟2：嘗試自動修剪但失敗
      const pruningError = UC07ErrorFactory.createRecoveryExhaustedError(
        [{ strategy: 'auto_prune_patterns', result: 'failed' }],
        false, // 暫不需要人工介入
        'degraded'
      )

      expect(pruningError.code).toBe(ErrorCodes.OPERATION_ERROR)
      expect(pruningError.details.intervention.required).toBe(false)

      // 步驟3：手動修剪成功
      const successResult = UC07ErrorFactory.createResult(true, {
        patternsRemoved: 900,
        patternsRetained: 900,
        storageReclaimed: '60%',
        learningEfficiency: 'improved'
      })

      expect(successResult.success).toBe(true)
      expect(successResult.data.patternsRemoved).toBe(900)
    })

    test('錯誤處理系統健康檢查場景', async () => {
      // 檢查各子系統狀態
      const systemChecks = [
        { subsystem: 'error_handling', healthy: false },
        { subsystem: 'logging', healthy: true },
        { subsystem: 'recovery', healthy: true },
        { subsystem: 'pattern_learning', healthy: false }
      ]

      const errors = []
      systemChecks.forEach(check => {
        if (!check.healthy) {
          const error = UC07ErrorFactory.createSystemStageError(
            check.subsystem, 'health_check', { healthy: false }
          )
          errors.push(error)
        }
      })

      expect(errors).toHaveLength(2) // error_handling 和 pattern_learning
      expect(errors[0].subType).toBe('ERROR_HANDLER_RECURSION')
      expect(errors[1].subType).toBe('PATTERN_LEARNING_OVERFLOW')

      // 驗證所有錯誤都有效
      errors.forEach(error => {
        expect(UC07ErrorFactory.isValidUC07Error(error)).toBe(true)
      })
    })
  })
})
