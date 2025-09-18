const { StandardError } = require('src/core/errors/StandardError')
/**
 * @fileoverview Error Handling Utils TDD 測試
 * @version v1.0.0
 * @since 2025-08-16
 *
 * TDD Red 階段：設計 error-handling-utils.js 的完整測試套件
 *
 * 測試目標：
 * - 錯誤分類和嚴重性判斷
 * - 錯誤訊息格式化和清理
 * - 錯誤記錄和統計
 * - Content Script 特定錯誤處理
 * - 重試機制和錯誤恢復
 */

describe('ErrorHandlingUtils - TDD Red 階段測試', () => {
  let ErrorHandlingUtils

  beforeAll(() => {
    // 測試執行前載入模組
    ErrorHandlingUtils = require('src/content/utils/error-handling-utils.js')
  })

  beforeEach(() => {
    // 每個測試前清理狀態
    if (ErrorHandlingUtils.clearErrorHistory) {
      ErrorHandlingUtils.clearErrorHistory()
    }

    // 設定測試環境
    global.console = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn()
    }
  })

  describe('🏷️ 錯誤分類和嚴重性', () => {
    test('應該正確分類 DOM 相關錯誤', () => {
      const domError = new Error('Cannot read property \'querySelector\' of null')
      const classification = ErrorHandlingUtils.classifyError(domError)

      expect(classification).toEqual({
        category: 'DOM_ERROR',
        severity: 'MEDIUM',
        recoverable: true,
        suggestions: ['檢查元素是否存在', '等待頁面完全載入', '使用防禦性選擇器']
      })
    })

    test('應該正確分類網路相關錯誤', () => {
      const networkError = new Error('Failed to fetch')
      const classification = ErrorHandlingUtils.classifyError(networkError)

      expect(classification).toEqual({
        category: 'NETWORK_ERROR',
        severity: 'HIGH',
        recoverable: true,
        suggestions: ['檢查網路連線', '實施重試機制', '使用離線模式']
      })
    })

    test('應該正確分類資料驗證錯誤', () => {
      const validationError = new Error('Invalid book ID format')
      const classification = ErrorHandlingUtils.classifyError(validationError)

      expect(classification).toEqual({
        category: 'VALIDATION_ERROR',
        severity: 'MEDIUM',
        recoverable: true,
        suggestions: ['檢查資料格式', '實施資料清理', '使用預設值']
      })
    })

    test('應該正確分類系統關鍵錯誤', () => {
      const systemError = new Error('Chrome Extension API not available')
      const classification = ErrorHandlingUtils.classifyError(systemError)

      expect(classification).toEqual({
        category: 'SYSTEM_ERROR',
        severity: 'CRITICAL',
        recoverable: false,
        suggestions: ['檢查擴展權限', '重新載入擴展', '聯繫技術支援']
      })
    })

    test('應該處理未知錯誤類型', () => {
      const unknownError = new Error('Something unexpected happened')
      const classification = ErrorHandlingUtils.classifyError(unknownError)

      expect(classification.category).toBe('UNKNOWN_ERROR')
      expect(classification.severity).toBe('MEDIUM')
      expect(classification.recoverable).toBe(true)
    })

    test('應該處理字串錯誤訊息', () => {
      const classification = ErrorHandlingUtils.classifyError('Simple error message')

      expect(classification.category).toBe('UNKNOWN_ERROR')
      expect(typeof classification.severity).toBe('string')
    })
  })

  describe('📝 錯誤訊息格式化', () => {
    test('應該格式化 Error 物件', () => {
      const error = new Error('Test error message')
      error.stack = 'Error: Test error message\n    at test.js:1:1'

      const formatted = ErrorHandlingUtils.formatError(error)

      expect(formatted).toEqual({
        message: 'Test error message',
        type: 'Error',
        timestamp: expect.any(Number),
        stack: expect.stringContaining('test.js:1:1'),
        context: 'content-script',
        additionalContext: {}
      })
    })

    test('應該格式化字串錯誤', () => {
      const formatted = ErrorHandlingUtils.formatError('Simple string error')

      expect(formatted).toEqual({
        message: 'Simple string error',
        type: 'String',
        timestamp: expect.any(Number),
        stack: null,
        context: 'content-script',
        additionalContext: {}
      })
    })

    test('應該包含額外的上下文資訊', () => {
      const error = new Error('Context test')
      const context = {
        url: 'https://readmoo.com/library',
        action: 'book-extraction',
        pageType: 'library'
      }

      const formatted = ErrorHandlingUtils.formatError(error, context)

      expect(formatted.additionalContext).toEqual(context)
      expect(formatted.url).toBe('https://readmoo.com/library')
    })

    test('應該清理敏感資訊', () => {
      const error = new Error('Error with token: abc123token and password: secret123')
      const formatted = ErrorHandlingUtils.formatError(error)

      expect(formatted.message).not.toContain('abc123token')
      expect(formatted.message).not.toContain('secret123')
      expect(formatted.message).toContain('[REDACTED]')
    })

    test('應該處理 null 和 undefined', () => {
      expect(() => ErrorHandlingUtils.formatError(null)).not.toThrow()
      expect(() => ErrorHandlingUtils.formatError(undefined)).not.toThrow()

      const nullFormatted = ErrorHandlingUtils.formatError(null)
      expect(nullFormatted.message).toBe('Unknown error (null)')
    })
  })

  describe('📊 錯誤記錄和統計', () => {
    test('應該記錄錯誤到歷史記錄', () => {
      const error = new Error('Recorded error')

      ErrorHandlingUtils.recordError(error, 'TEST_CONTEXT')

      const history = ErrorHandlingUtils.getErrorHistory()
      expect(history).toHaveLength(1)
      expect(history[0].error.message).toBe('Recorded error')
      expect(history[0].context).toBe('TEST_CONTEXT')
    })

    test('應該限制錯誤歷史記錄大小', () => {
      // 記錄超過限制的錯誤
      for (let i = 0; i < 150; i++) {
        ErrorHandlingUtils.recordError(new Error(`Error ${i}`), 'TEST')
      }

      const history = ErrorHandlingUtils.getErrorHistory()
      expect(history.length).toBeLessThanOrEqual(100) // 假設最大限制為 100
    })

    test('應該提供錯誤統計資訊', () => {
      // 記錄不同類型的錯誤
      ErrorHandlingUtils.recordError(new Error('DOM error'), 'DOM_OPERATION')
      ErrorHandlingUtils.recordError(new Error('Failed to fetch'), 'NETWORK_REQUEST')
      ErrorHandlingUtils.recordError(new Error('DOM error 2'), 'DOM_OPERATION')

      const stats = ErrorHandlingUtils.getErrorStats()

      expect(stats).toEqual({
        total: 3,
        byCategory: {
          DOM_ERROR: 2,
          NETWORK_ERROR: 1
        },
        bySeverity: {
          MEDIUM: 2,
          HIGH: 1
        },
        recent: expect.any(Number),
        oldestTimestamp: expect.any(Number),
        newestTimestamp: expect.any(Number)
      })
    })

    test('應該支援清空錯誤歷史', () => {
      ErrorHandlingUtils.recordError(new Error('Test'), 'TEST')
      expect(ErrorHandlingUtils.getErrorHistory()).toHaveLength(1)

      ErrorHandlingUtils.clearErrorHistory()
      expect(ErrorHandlingUtils.getErrorHistory()).toHaveLength(0)
    })

    test('應該檢測錯誤模式和頻率', () => {
      const sameError = 'Repeated error message'

      // 記錄相同錯誤多次
      for (let i = 0; i < 5; i++) {
        ErrorHandlingUtils.recordError(new Error(sameError), 'TEST')
      }

      const patterns = ErrorHandlingUtils.detectErrorPatterns()
      expect(patterns.repeatedErrors).toHaveLength(1)
      expect(patterns.repeatedErrors[0].message).toBe(sameError)
      expect(patterns.repeatedErrors[0].count).toBe(5)
    })
  })

  describe('🔄 重試機制', () => {
    test('應該實作指數退避重試', async () => {
      let attempts = 0
      const failingFunction = jest.fn(() => {
        attempts++
        if (attempts < 3) {
          throw new StandardError('TEST_ERROR', `Attempt ${attempts} failed`, { category: 'testing' })
        }
        return 'success'
      })

      const result = await ErrorHandlingUtils.retryWithBackoff(
        failingFunction,
        { maxRetries: 3, baseDelay: 10 }
      )

      expect(result).toBe('success')
      expect(failingFunction).toHaveBeenCalledTimes(3)
    })

    test('應該在超過重試次數後失敗', async () => {
      const alwaysFailingFunction = jest.fn(() => {
        throw new StandardError('TEST_ERROR', 'Always fails', { category: 'testing' })
      })

      await expect(
        ErrorHandlingUtils.retryWithBackoff(alwaysFailingFunction, { maxRetries: 2 })
      ).rejects.toMatchObject({
        code: expect.any(String),
        message: expect.stringContaining('Always fails')
      })

      expect(alwaysFailingFunction).toHaveBeenCalledTimes(3) // 初始 + 2 次重試
    })

    test('應該支援自定義重試條件', async () => {
      let attempts = 0
      const conditionallyFailingFunction = jest.fn(() => {
        attempts++
        if (attempts === 1) {
          const error = new Error('Temporary failure')
          error.code = 'TEMPORARY'
          throw error
        }
        if (attempts === 2) {
          const error = new Error('Permanent failure')
          error.code = 'PERMANENT'
          throw error
        }
        return 'success'
      })

      const shouldRetry = (error) => error.code === 'TEMPORARY'

      await expect(
        ErrorHandlingUtils.retryWithBackoff(
          conditionallyFailingFunction,
          { maxRetries: 3, shouldRetry }
        )
      ).rejects.toMatchObject({
        code: expect.any(String),
        message: expect.stringContaining('Permanent failure')
      })

      expect(conditionallyFailingFunction).toHaveBeenCalledTimes(2)
    })
  })

  describe('🚨 Content Script 特定錯誤處理', () => {
    test('應該處理 DOM 查詢失敗', () => {
      const domQueryError = () => document.querySelector('.non-existent')

      const result = ErrorHandlingUtils.safelyExecuteDOM(domQueryError, 'QUERY_BOOKS')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.fallbackUsed).toBe(true)
    })

    test('應該處理 Chrome Extension API 錯誤', () => {
      // Mock Chrome API 錯誤
      global.chrome = {
        runtime: {
          sendMessage: jest.fn((message, callback) => {
            callback(null)
          }),
          // 模擬 Chrome lastError 已經存在
          lastError: { message: 'Extension context invalidated' }
        }
      }

      const result = ErrorHandlingUtils.handleChromeAPIError('sendMessage', ['test message'])

      expect(result.success).toBe(false)
      expect(result.error.message).toContain('Extension context invalidated')
    })

    test('應該格式化使用者友善的錯誤訊息', () => {
      const techError = new Error('TypeError: Cannot read property \'book_id\' of undefined')

      const userMessage = ErrorHandlingUtils.getUserFriendlyMessage(techError)

      expect(userMessage).toBe('資料載入時發生問題，請重新整理頁面後再試')
    })

    test('應該處理頁面導航錯誤', () => {
      const navigationError = new Error('Navigation blocked by user agent')

      const handled = ErrorHandlingUtils.handleNavigationError(navigationError, {
        currentUrl: 'https://readmoo.com/library',
        targetUrl: 'https://readmoo.com/shelf'
      })

      expect(handled.recoveryAction).toBe('RELOAD_PAGE')
      expect(handled.userMessage).toContain('頁面載入')
    })
  })

  describe('⚙️ 錯誤恢復策略', () => {
    test('應該建議 DOM 錯誤的恢復策略', () => {
      const domError = new Error('Cannot read property \'textContent\' of null')

      const strategy = ErrorHandlingUtils.getRecoveryStrategy(domError, 'BOOK_EXTRACTION')

      expect(strategy).toEqual({
        immediate: ['retry-with-delay', 'use-fallback-selector'],
        longTerm: ['wait-for-page-load', 'check-page-structure'],
        preventive: ['add-element-existence-check', 'implement-observer-pattern']
      })
    })

    test('應該建議網路錯誤的恢復策略', () => {
      const networkError = new Error('Failed to fetch')

      const strategy = ErrorHandlingUtils.getRecoveryStrategy(networkError, 'API_REQUEST')

      expect(strategy.immediate).toContain('retry-with-backoff')
      expect(strategy.longTerm).toContain('implement-offline-mode')
    })

    test('應該執行自動恢復操作', async () => {
      const mockFailingOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce('success')

      const result = await ErrorHandlingUtils.attemptAutoRecovery(
        mockFailingOperation,
        'TEMPORARY_FAILURE',
        { maxAttempts: 2 }
      )

      expect(result.recovered).toBe(true)
      expect(result.result).toBe('success')
      expect(result.attemptsUsed).toBe(2)
    })
  })

  describe('📈 錯誤報告和通知', () => {
    test('應該產生詳細的錯誤報告', () => {
      // 記錄一些錯誤
      ErrorHandlingUtils.recordError(new Error('Error 1'), 'CONTEXT_1')
      ErrorHandlingUtils.recordError(new Error('Error 2'), 'CONTEXT_2')

      const report = ErrorHandlingUtils.generateErrorReport()

      expect(report).toEqual({
        summary: {
          totalErrors: 2,
          timeRange: expect.any(Object),
          mostCommonCategory: expect.any(String),
          criticalErrorsCount: expect.any(Number)
        },
        details: expect.any(Array),
        recommendations: expect.any(Array),
        systemInfo: {
          userAgent: expect.any(String),
          url: expect.any(String),
          timestamp: expect.any(Number)
        }
      })
    })

    test('應該通知嚴重錯誤', () => {
      const criticalError = new Error('System crash imminent')
      const mockNotificationHandler = jest.fn()

      ErrorHandlingUtils.setNotificationHandler(mockNotificationHandler)
      ErrorHandlingUtils.recordError(criticalError, 'SYSTEM', { severity: 'CRITICAL' })

      expect(mockNotificationHandler).toHaveBeenCalledWith({
        type: 'CRITICAL_ERROR',
        error: expect.any(Object),
        requiresImmediateAction: true
      })
    })

    test('應該支援錯誤過濾和搜尋', () => {
      // 記錄不同類型的錯誤
      ErrorHandlingUtils.recordError(new Error('DOM error'), 'DOM_OP')
      ErrorHandlingUtils.recordError(new Error('Network timeout'), 'NETWORK_OP')
      ErrorHandlingUtils.recordError(new Error('Another DOM error'), 'DOM_OP')

      const domErrors = ErrorHandlingUtils.filterErrors({
        category: 'DOM_ERROR'
      })

      expect(domErrors).toHaveLength(2)

      const networkErrors = ErrorHandlingUtils.filterErrors({
        messageContains: 'Network'
      })

      expect(networkErrors).toHaveLength(1)
    })
  })

  describe('🧪 工具方法測試', () => {
    test('應該匯出所有必要的方法', () => {
      const requiredMethods = [
        'classifyError',
        'formatError',
        'recordError',
        'getErrorHistory',
        'getErrorStats',
        'clearErrorHistory',
        'detectErrorPatterns',
        'retryWithBackoff',
        'safelyExecuteDOM',
        'handleChromeAPIError',
        'getUserFriendlyMessage',
        'handleNavigationError',
        'getRecoveryStrategy',
        'attemptAutoRecovery',
        'generateErrorReport',
        'setNotificationHandler',
        'filterErrors'
      ]

      requiredMethods.forEach(methodName => {
        expect(typeof ErrorHandlingUtils[methodName]).toBe('function')
      })
    })

    test('所有方法應該有適當的參數數量', () => {
      expect(ErrorHandlingUtils.classifyError.length).toBeGreaterThanOrEqual(1)
      expect(ErrorHandlingUtils.formatError.length).toBeGreaterThanOrEqual(1)
      expect(ErrorHandlingUtils.recordError.length).toBeGreaterThanOrEqual(1)
      expect(ErrorHandlingUtils.retryWithBackoff.length).toBeGreaterThanOrEqual(1)
    })

    test('應該安全處理各種錯誤輸入', () => {
      const invalidInputs = [null, undefined, '', 0, {}, [], NaN]

      invalidInputs.forEach(input => {
        expect(() => ErrorHandlingUtils.classifyError(input)).not.toThrow()
        expect(() => ErrorHandlingUtils.formatError(input)).not.toThrow()
      })
    })
  })
})
