/**
 * Enum System bundle 單元測試
 *
 * 對應 docs/spec/core/domain-map.md 不變式：
 * 「每個列舉型別值集合不重複；驗證函式對非法值回傳 false」
 */

const {
  OperationStatus,
  ErrorTypes,
  ErrorSeverity,
  MessageTypes,
  MessagePriority,
  LogLevel,
  compareLogLevels,
  shouldLog,
  isValidLogLevel,
  isValidErrorType,
  isValidSeverity,
  getDefaultSeverity,
  isValidMessageType,
  isValidPriority,
  getDefaultPriority,
  isValidOperationStatus,
  isCompletedStatus,
  isSuccessStatus
} = require('src/core/enums')

describe('Enum System', () => {
  describe('列舉值集合不重複', () => {
    test.each([
      ['OperationStatus', OperationStatus],
      ['ErrorTypes', ErrorTypes],
      ['ErrorSeverity', ErrorSeverity],
      ['MessageTypes', MessageTypes],
      ['MessagePriority', MessagePriority],
      ['LogLevel', LogLevel]
    ])('%s 的所有值不重複', (name, enumObj) => {
      const values = Object.values(enumObj)
      expect(new Set(values).size).toBe(values.length)
    })
  })

  describe('LogLevel 實際可用的比較與過濾函式', () => {
    test('compareLogLevels 對非法等級拋出明確錯誤', () => {
      expect(() => compareLogLevels('NOT_A_LEVEL', LogLevel.INFO)).toThrow()
    })

    test('shouldLog 依門檻正確判定是否應記錄', () => {
      expect(shouldLog(LogLevel.ERROR, LogLevel.INFO)).toBe(true)
      expect(shouldLog(LogLevel.DEBUG, LogLevel.INFO)).toBe(false)
    })
  })

  describe('OperationStatus 驗證函式', () => {
    test('isValidOperationStatus 對合法/非法值正確判斷', () => {
      expect(isValidOperationStatus(OperationStatus.SUCCESS)).toBe(true)
      expect(isValidOperationStatus('NOT_A_STATUS')).toBe(false)
    })

    test('isCompletedStatus 對已完成/未完成狀態正確判斷', () => {
      expect(isCompletedStatus(OperationStatus.SUCCESS)).toBe(true)
      expect(isCompletedStatus(OperationStatus.FAILED)).toBe(true)
      expect(isCompletedStatus(OperationStatus.PENDING)).toBe(false)
      expect(isCompletedStatus(OperationStatus.IN_PROGRESS)).toBe(false)
    })

    test('isSuccessStatus 對成功/失敗狀態正確判斷', () => {
      expect(isSuccessStatus(OperationStatus.SUCCESS)).toBe(true)
      expect(isSuccessStatus(OperationStatus.PARTIAL_SUCCESS)).toBe(true)
      expect(isSuccessStatus(OperationStatus.FAILED)).toBe(false)
    })
  })

  describe('ErrorTypes 驗證函式', () => {
    test('isValidErrorType 對合法/非法值正確判斷', () => {
      expect(isValidErrorType(ErrorTypes.NETWORK_ERROR)).toBe(true)
      expect(isValidErrorType('NOT_AN_ERROR_TYPE')).toBe(false)
    })

    test('isValidSeverity 對合法/非法值正確判斷', () => {
      expect(isValidSeverity(ErrorSeverity.HIGH)).toBe(true)
      expect(isValidSeverity('NOT_A_SEVERITY')).toBe(false)
    })

    test('getDefaultSeverity 回傳合法 ErrorSeverity，未知類型回傳 MEDIUM', () => {
      expect(isValidSeverity(getDefaultSeverity(ErrorTypes.SYSTEM_ERROR))).toBe(true)
      expect(getDefaultSeverity('NOT_AN_ERROR_TYPE')).toBe(ErrorSeverity.MEDIUM)
    })
  })

  describe('MessageTypes 驗證函式', () => {
    test('isValidMessageType 對合法/非法值正確判斷', () => {
      expect(isValidMessageType(MessageTypes.ERROR)).toBe(true)
      expect(isValidMessageType('NOT_A_MESSAGE_TYPE')).toBe(false)
    })

    test('isValidPriority 對合法/非法值正確判斷', () => {
      expect(isValidPriority(MessagePriority.HIGH)).toBe(true)
      expect(isValidPriority('NOT_A_PRIORITY')).toBe(false)
    })

    test('getDefaultPriority 回傳合法 MessagePriority，未知類型回傳 NORMAL', () => {
      expect(isValidPriority(getDefaultPriority(MessageTypes.ERROR))).toBe(true)
      expect(getDefaultPriority('NOT_A_MESSAGE_TYPE')).toBe(MessagePriority.NORMAL)
    })
  })

  describe('LogLevel 驗證函式', () => {
    test('isValidLogLevel 對合法/非法值正確判斷', () => {
      expect(isValidLogLevel(LogLevel.INFO)).toBe(true)
      expect(isValidLogLevel('NOT_A_LEVEL')).toBe(false)
    })
  })
})
