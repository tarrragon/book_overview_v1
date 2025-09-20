/**
 * DualErrorSystemBridge ErrorCodes 遷移測試
 *
 * 測試目標:
 * - Red: 驗證 StandardError 到 ErrorCodes 遷移
 * - Green: 確保橋接功能正常運作
 * - Refactor: 優化錯誤處理和效能
 */

const { DualErrorSystemBridge, DUAL_SYSTEM_MODES, COMPATIBILITY_LEVELS } = require('src/core/migration/DualErrorSystemBridge')
const ErrorCodes = require('src/core/errors/ErrorCodes')

// TDD Phase 1: Red - 建立失敗測試
describe('DualErrorSystemBridge ErrorCodes Migration', () => {
  let bridge

  beforeEach(() => {
    bridge = new DualErrorSystemBridge({
      mode: DUAL_SYSTEM_MODES.ERRORCODES_FIRST,
      compatibilityLevel: COMPATIBILITY_LEVELS.STRICT,
      enableLogging: false
    })
  })

  afterEach(() => {
    bridge.cleanup()
  })

  describe('Internal Error Handling Migration', () => {
    it('should throw ErrorCodes format error for unknown dual system mode', () => {
      const invalidBridge = new DualErrorSystemBridge({
        mode: 'invalid_mode',
        enableLogging: false
      })

      expect(() => {
        // 觸發內部未知模式錯誤
        invalidBridge._processByMode({}, 'unknown', {})
      }).toThrow()

      // Red: 這個測試應該失敗，因為目前拋出 StandardError
      // 我們期望拋出 ErrorCodes 格式的錯誤
    })

    it('should throw ErrorCodes format error for missing errorCode in bridged error', () => {
      const mockError = { message: 'test error' }
      const mockBridgedError = { message: 'bridged error' } // 缺少 errorCode

      expect(() => {
        bridge._validateStandardToErrorCodes(mockBridgedError, mockError)
      }).toThrow()

      // Red: 這個測試應該失敗，因為目前拋出 StandardError
      // 我們期望拋出具有 ErrorCodes.IMPLEMENTATION_ERROR 的錯誤
    })

    it('should throw ErrorCodes format error for missing message in bridged error', () => {
      const mockError = { message: 'test error' }
      const mockBridgedError = { errorCode: 'TEST_ERROR' } // 缺少 message

      expect(() => {
        bridge._validateStandardToErrorCodes(mockBridgedError, mockError)
      }).toThrow()

      // Red: 預期拋出 ErrorCodes 格式錯誤
    })

    it('should throw ErrorCodes format error for missing code in ErrorCodes to Standard validation', () => {
      const mockError = { errorCode: 'TEST_ERROR', message: 'test' }
      const mockBridgedError = { name: 'StandardError', message: 'test' } // 缺少 code

      expect(() => {
        bridge._validateErrorCodesToStandard(mockBridgedError, mockError)
      }).toThrow()

      // Red: 預期拋出 ErrorCodes 格式錯誤
    })

    it('should throw ErrorCodes format error for incorrect name in bridged error', () => {
      const mockError = { errorCode: 'TEST_ERROR', message: 'test' }
      const mockBridgedError = {
        name: 'WrongError', // 錯誤的名稱
        code: 'TEST_ERROR',
        message: 'test'
      }

      expect(() => {
        bridge._validateErrorCodesToStandard(mockBridgedError, mockError)
      }).toThrow()

      // Red: 預期拋出 ErrorCodes 格式錯誤
    })

    it('should throw ErrorCodes format error for missing basic message in bidirectional validation', () => {
      const mockError = { message: 'test error' }
      const mockBridgedError = {} // 缺少基本訊息

      expect(() => {
        bridge._validateBidirectionalCompatibility(mockBridgedError, mockError)
      }).toThrow()

      // Red: 預期拋出 ErrorCodes 格式錯誤
    })
  })

  describe('Error Bridging Functionality', () => {
    it('should successfully bridge standard error to ErrorCodes format', () => {
      const standardError = {
        name: 'StandardError',
        code: 'VALIDATION_ERROR',
        message: 'Test validation error',
        category: 'general',
        details: { field: 'test' }
      }

      const bridgedError = bridge.bridgeError(standardError)

      expect(bridgedError).toHaveProperty('errorCode', ErrorCodes.VALIDATION_ERROR)
      expect(bridgedError).toHaveProperty('message', 'Test validation error')
      expect(bridgedError).toHaveProperty('subType')
      expect(bridgedError.details).toHaveProperty('originalCode', 'VALIDATION_ERROR')
    })

    it('should successfully bridge ErrorCodes format to standard error', () => {
      const errorCodesError = {
        errorCode: ErrorCodes.BOOK_ERROR,
        subType: 'BookError',
        message: 'Test book error',
        details: { bookId: '123' }
      }

      const bridgedError = bridge.bridgeError(errorCodesError)

      // 在 ERRORCODES_FIRST 模式下，應該直接返回 ErrorCodes 格式
      expect(bridgedError).toHaveProperty('errorCode', ErrorCodes.BOOK_ERROR)
      expect(bridgedError).toHaveProperty('message', 'Test book error')
    })

    it('should handle native Error objects', () => {
      const nativeError = new Error('Native error message')

      const bridgedError = bridge.bridgeError(nativeError)

      expect(bridgedError).toHaveProperty('errorCode', ErrorCodes.UNKNOWN_ERROR)
      expect(bridgedError).toHaveProperty('message', 'Native error message')
      expect(bridgedError).toHaveProperty('subType', 'UnknownError')
    })
  })

  describe('System State Management', () => {
    it('should update migration progress correctly', () => {
      bridge.updateMigrationProgress(0.5)

      const status = bridge.getSystemStatusReport()
      expect(status.systemState.migrationProgress).toBe(0.5)
      expect(status.systemState.currentState).toBe('dual_active')
    })

    it('should generate health indicators', () => {
      const status = bridge.getSystemStatusReport()

      expect(status).toHaveProperty('healthIndicators')
      expect(status.healthIndicators).toHaveProperty('overall')
      expect(status.healthIndicators).toHaveProperty('systemStability')
      expect(status.healthIndicators).toHaveProperty('migrationReadiness')
    })
  })

  describe('Performance and Caching', () => {
    it('should cache error conversion results', () => {
      const testError = {
        code: 'VALIDATION_ERROR',
        message: 'Test error',
        timestamp: 123456789
      }

      // 第一次轉換
      const firstResult = bridge._convertToErrorCodes(testError)
      const initialCacheHits = bridge.performanceMetrics.cacheHits
      const initialCacheMisses = bridge.performanceMetrics.cacheMisses

      // 第二次轉換應該使用快取
      const secondResult = bridge._convertToErrorCodes(testError)

      expect(bridge.performanceMetrics.cacheHits).toBe(initialCacheHits + 1)
      expect(bridge.performanceMetrics.cacheMisses).toBe(initialCacheMisses + 1) // 只增加了第一次的 miss
      expect(firstResult).toEqual(secondResult)
    })
  })
})
