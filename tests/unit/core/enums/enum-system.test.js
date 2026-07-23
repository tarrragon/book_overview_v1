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
  isValidMessageType,
  isValidPriority,
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

  describe('驗證函式 API 缺口（src/core/enums/index.js 匯出但未實作）', () => {
    // src/core/enums/index.js 解構 isValid* 系列函式，但 OperationStatus.js /
    // ErrorTypes.js / MessageTypes.js / LogLevel.js 皆未定義對應函式，
    // destructure 結果為 undefined。此為既有 src API 缺口，非本票（1.6.1-W3-004）範圍，
    // 以下測試鎖定現況並在 Solution 記錄，避免未來誤以為這些函式可用。
    test('isValidOperationStatus / isCompletedStatus / isSuccessStatus 未實作', () => {
      expect(isValidOperationStatus).toBeUndefined()
      expect(isCompletedStatus).toBeUndefined()
      expect(isSuccessStatus).toBeUndefined()
    })

    test('isValidErrorType / isValidSeverity 未實作', () => {
      expect(isValidErrorType).toBeUndefined()
      expect(isValidSeverity).toBeUndefined()
    })

    test('isValidMessageType / isValidPriority 未實作', () => {
      expect(isValidMessageType).toBeUndefined()
      expect(isValidPriority).toBeUndefined()
    })

    test('isValidLogLevel 未實作', () => {
      expect(isValidLogLevel).toBeUndefined()
    })
  })
})
