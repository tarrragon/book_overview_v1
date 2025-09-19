/**
 * TDD測試：SystemErrorHandler ErrorCodes遷移驗證
 *
 * Red階段：建立失敗測試
 * Green階段：最小修改實作
 * Refactor階段：程式碼優化
 */

const { expect } = require('@jest/globals')
const ErrorCodes = require('src/core/errors/ErrorCodes')

// 測試輔助函數
function expectErrorWithCode(fn, expectedCode) {
  return expect(fn).toThrow(expect.objectContaining({
    code: expectedCode,
    details: expect.any(Object)
  }))
}

describe('SystemErrorHandler ErrorCodes Migration', () => {
  let systemErrorHandler

  beforeEach(() => {
    jest.clearAllMocks()
    // 重新載入模組以確保清潔狀態
    jest.resetModules()
    systemErrorHandler = require('src/core/error-handling/system-error-handler')
  })

  describe('Error Propagation with ErrorCodes', () => {
    it('should handle propagateError with missing parameters using ErrorCodes', () => {
      // Red: 測試錯誤傳播參數缺失情況
      expectErrorWithCode(() => {
        systemErrorHandler.propagateError(null, 'test', 'destination')
      }, ErrorCodes.REQUIRED_FIELD_MISSING)

      expectErrorWithCode(() => {
        systemErrorHandler.propagateError({}, null, 'destination')
      }, ErrorCodes.REQUIRED_FIELD_MISSING)

      expectErrorWithCode(() => {
        systemErrorHandler.propagateError({}, 'test', null)
      }, ErrorCodes.REQUIRED_FIELD_MISSING)
    })

    it('should maintain error propagation functionality after migration', () => {
      // 驗證 API 向後相容性
      const mockError = { message: 'test error', code: 'TEST_ERROR' }
      const result = systemErrorHandler.propagateError(mockError, 'testSource', 'testDestination')

      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })
  })

  describe('Cascading Error Handling with ErrorCodes', () => {
    it('should handle handleCascadingErrors with missing error array using ErrorCodes', () => {
      // Red: 測試級聯錯誤處理參數缺失情況
      expectErrorWithCode(() => {
        systemErrorHandler.handleCascadingErrors(null)
      }, ErrorCodes.REQUIRED_FIELD_MISSING)

      expectErrorWithCode(() => {
        systemErrorHandler.handleCascadingErrors(undefined)
      }, ErrorCodes.REQUIRED_FIELD_MISSING)
    })

    it('should maintain cascading error handling functionality after migration', () => {
      // 驗證級聯錯誤處理功能
      const mockErrors = [
        { message: 'error1', code: 'TEST_ERROR_1' },
        { message: 'error2', code: 'TEST_ERROR_2' }
      ]

      const result = systemErrorHandler.handleCascadingErrors(mockErrors)
      expect(result).toBeDefined()
    })
  })

  describe('Error UI Creation with ErrorCodes', () => {
    it('should handle createErrorUI with missing error object using ErrorCodes', () => {
      // Red: 測試錯誤UI建立參數缺失情況
      expectErrorWithCode(() => {
        systemErrorHandler.createErrorUI(null)
      }, ErrorCodes.REQUIRED_FIELD_MISSING)

      expectErrorWithCode(() => {
        systemErrorHandler.createErrorUI(undefined)
      }, ErrorCodes.REQUIRED_FIELD_MISSING)
    })

    it('should maintain error UI creation functionality after migration', () => {
      // 驗證錯誤UI建立功能
      const mockError = {
        message: 'test error',
        code: 'TEST_ERROR',
        severity: 'error'
      }

      const result = systemErrorHandler.createErrorUI(mockError)
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })
  })

  describe('ErrorCodes Migration Validation', () => {
    it('should use ErrorCodes pattern for all error throwing', () => {
      // 驗證所有拋出的錯誤都使用 ErrorCodes 模式
      const testCases = [
        () => systemErrorHandler.propagateError(null, 'test', 'dest'),
        () => systemErrorHandler.handleCascadingErrors(null),
        () => systemErrorHandler.createErrorUI(null)
      ]

      testCases.forEach(testCase => {
        try {
          testCase()
          fail('Should have thrown an error')
        } catch (error) {
          expect(error).toHaveProperty('code', ErrorCodes.REQUIRED_FIELD_MISSING)
          expect(error).toHaveProperty('details')
          expect(error.details).toBeInstanceOf(Object)
        }
      })
    })

    it('should maintain standalone utility functions', () => {
      // 驗證獨立工具函數功能
      const bookData = { id: '1', title: 'test book', cover: 'test.jpg' }
      const validation = systemErrorHandler.validateBookData(bookData)
      expect(validation).toHaveProperty('isValid')

      const platform = systemErrorHandler.checkPlatformSupport()
      expect(platform).toHaveProperty('chromeApiAvailable')
    })
  })
})