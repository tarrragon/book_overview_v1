/**
 * TDD測試：ErrorRecoveryCoordinator ErrorCodes遷移驗證
 */

const { expect } = require('@jest/globals')
const ErrorCodes = require('src/core/errors/ErrorCodes')
const { createErrorRecovery, retryOperation } = require('src/core/error-handling/error-recovery-coordinator')

// 測試輔助函數
function expectErrorWithCode(fn, expectedCode) {
  return expect(fn).toThrow(expect.objectContaining({
    code: expectedCode,
    details: expect.any(Object)
  }))
}

describe('ErrorRecoveryCoordinator ErrorCodes Migration', () => {
  describe('Error Recovery Planning with ErrorCodes', () => {
    it('should handle createErrorRecovery with missing error using ErrorCodes', () => {
      expectErrorWithCode(() => {
        createErrorRecovery(null, 'SYSTEM_ERROR')
      }, ErrorCodes.REQUIRED_FIELD_MISSING)

      expectErrorWithCode(() => {
        createErrorRecovery(undefined, 'SYSTEM_ERROR')
      }, ErrorCodes.REQUIRED_FIELD_MISSING)
    })

    it('should maintain error recovery functionality after migration', () => {
      const mockError = new Error('test error')
      mockError.code = ErrorCodes.NETWORK_ERROR

      const result = createErrorRecovery(mockError, 'NETWORK_ERROR')
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
      expect(result).toHaveProperty('canRetry')
    })
  })

  describe('Retry Operation with ErrorCodes', () => {
    it('should handle operation failure after max retries using ErrorCodes', async () => {
      const failingOperation = () => {
        throw new Error('Always fails')
      }

      await expect(retryOperation(failingOperation, { maxRetries: 1 }))
        .rejects.toMatchObject({
          code: ErrorCodes.OPERATION_FAILED,
          details: expect.objectContaining({
            attempts: 2,
            category: 'recovery'
          })
        })
    })

    it('should handle null operation gracefully', async () => {
      // retryOperation 沒有對 null 參數做檢查，會在執行時拋錯
      await expect(retryOperation(null, { maxRetries: 1 }))
        .rejects.toMatchObject({
          code: ErrorCodes.OPERATION_FAILED,
          details: expect.objectContaining({
            attempts: 2
          })
        })
    })
  })

  describe('ErrorCodes Migration Validation', () => {
    it('should use ErrorCodes pattern for all synchronous error throwing', () => {
      // 驗證同步拋出的錯誤都使用 ErrorCodes 模式
      try {
        createErrorRecovery(null, 'TEST')
        expect(true).toBe(false) // Should have thrown an error
      } catch (error) {
        expect(error).toHaveProperty('code', ErrorCodes.REQUIRED_FIELD_MISSING)
        expect(error).toHaveProperty('details')
        expect(error.details).toBeInstanceOf(Object)
      }
    })
  })
})