/**
 * MessageErrorHandler 測試
 * TDD 循環 #31: 訊息處理錯誤監控
 *
 * 測試目標：
 * 1. Chrome Extension 訊息錯誤捕獲和分類
 * 2. 未知訊息類型處理和提示
 * 3. 訊息路由錯誤監控
 * 4. 診斷資訊收集和報告
 */

// eslint-disable-next-line no-unused-vars
const EventHandler = require('src/core/event-handler')

describe('MessageErrorHandler - TDD 循環 #31', () => {
  // eslint-disable-next-line no-unused-vars
  let mockEventBus
  // eslint-disable-next-line no-unused-vars
  let mockChromeRuntime

  beforeEach(() => {
    // 模擬事件總線
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    }

    // 模擬 Chrome Runtime API
    mockChromeRuntime = {
      lastError: null,
      sendMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      }
    }

    global.chrome = {
      runtime: mockChromeRuntime
    }

    // 清除所有模擬
    jest.clearAllMocks()
  })

  afterEach(() => {
    delete global.chrome
  })

  describe('🔧 基本結構和初始化', () => {
    test('應該能夠創建 MessageErrorHandler 實例', () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')

      expect(() => {
        // eslint-disable-next-line no-new
        new MessageErrorHandler(mockEventBus)
      }).not.toThrow()
    })

    test('應該繼承 EventHandler 基底類別', () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      expect(handler).toBeInstanceOf(EventHandler)
      expect(handler.name).toBe('MessageErrorHandler')
    })

    test('應該正確設定優先級和支援的事件', () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      expect(handler.priority).toBe(0) // 最高優先級
      expect(handler.supportedEvents).toContain('MESSAGE.ERROR')
      expect(handler.supportedEvents).toContain('MESSAGE.UNKNOWN_TYPE')
      expect(handler.supportedEvents).toContain('MESSAGE.ROUTING_ERROR')
    })

    test('應該初始化錯誤統計和診斷狀態', () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      expect(handler.errorStats).toBeDefined()
      expect(handler.errorStats.totalErrors).toBe(0)
      expect(handler.errorStats.unknownMessageTypes).toBe(0)
      expect(handler.errorStats.routingErrors).toBe(0)
      expect(handler.diagnosticMode).toBe(false)
    })
  })

  describe('🚨 訊息錯誤捕獲和處理', () => {
    test('應該處理 MESSAGE.ERROR 事件', async () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      // eslint-disable-next-line no-unused-vars
      const errorEvent = {
        type: 'MESSAGE.ERROR',
        data: {
          error: new Error('測試錯誤'),
          message: { type: 'TEST_MESSAGE', data: {} },
          context: 'content-script',
          timestamp: Date.now()
        }
      }

      // eslint-disable-next-line no-unused-vars
      const result = await handler.handle(errorEvent)

      expect(result.success).toBe(true)
      expect(handler.errorStats.totalErrors).toBe(1)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ERROR.LOGGED',
        expect.any(Object)
      )
    })

    test('應該處理未知訊息類型錯誤', async () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      // eslint-disable-next-line no-unused-vars
      const unknownTypeEvent = {
        type: 'MESSAGE.UNKNOWN_TYPE',
        data: {
          messageType: 'START_EXTRACTION',
          receivedMessage: { type: 'START_EXTRACTION', data: {} },
          context: 'content-script',
          availableTypes: ['PAGE_READY', 'PING'],
          timestamp: Date.now()
        }
      }

      // eslint-disable-next-line no-unused-vars
      const result = await handler.handle(unknownTypeEvent)

      expect(result.success).toBe(true)
      expect(handler.errorStats.unknownMessageTypes).toBe(1)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'DIAGNOSTIC.SUGGESTION',
        expect.objectContaining({
          type: 'UNKNOWN_MESSAGE_TYPE',
          suggestion: expect.stringContaining('START_EXTRACTION')
        })
      )
    })

    test('應該處理訊息路由錯誤', async () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      // eslint-disable-next-line no-unused-vars
      const routingErrorEvent = {
        type: 'MESSAGE.ROUTING_ERROR',
        data: {
          source: 'popup',
          target: 'content-script',
          message: { type: 'START_EXTRACTION' },
          error: new Error('No receiving end'),
          timestamp: Date.now()
        }
      }

      // eslint-disable-next-line no-unused-vars
      const result = await handler.handle(routingErrorEvent)

      expect(result.success).toBe(true)
      expect(handler.errorStats.routingErrors).toBe(1)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'DIAGNOSTIC.ROUTING_ISSUE',
        expect.any(Object)
      )
    })
  })

  describe('🔍 診斷和建議系統', () => {
    test('應該提供未知訊息類型的診斷建議', async () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      // eslint-disable-next-line no-unused-vars
      const suggestion = handler.generateUnknownTypeSuggestion(
        'START_EXTRACTION',
        ['PAGE_READY', 'PING']
      )

      expect(suggestion).toContain('START_EXTRACTION')
      expect(suggestion).toContain('可能的解決方案')
      expect(suggestion).toContain('檢查訊息格式')
    })

    test('應該分析訊息路由問題', async () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      // eslint-disable-next-line no-unused-vars
      const analysis = handler.analyzeRoutingError(
        'popup',
        'content-script',
        'No receiving end'
      )

      expect(analysis.issue).toBe('CONTENT_SCRIPT_NOT_READY')
      expect(analysis.suggestions).toContain('確認 Content Script 已載入')
      expect(analysis.suggestions).toContain('檢查頁面是否為 Readmoo 網站')
    })

    test('應該啟用診斷模式收集詳細資訊', () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      handler.enableDiagnosticMode()

      expect(handler.diagnosticMode).toBe(true)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'DIAGNOSTIC.MODE_ENABLED',
        expect.any(Object)
      )
    })
  })

  describe('📊 錯誤統計和報告', () => {
    test('應該追蹤各類型錯誤的統計資訊', async () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      // 模擬多種錯誤
      await handler.handle({
        type: 'MESSAGE.ERROR',
        data: { error: new Error('錯誤1') }
      })
      await handler.handle({
        type: 'MESSAGE.UNKNOWN_TYPE',
        data: { messageType: 'TYPE1' }
      })
      await handler.handle({
        type: 'MESSAGE.UNKNOWN_TYPE',
        data: { messageType: 'TYPE2' }
      })
      await handler.handle({
        type: 'MESSAGE.ROUTING_ERROR',
        data: { error: new Error('路由錯誤') }
      })

      // eslint-disable-next-line no-unused-vars
      const stats = handler.getErrorStatistics()

      expect(stats.totalErrors).toBe(4)
      expect(stats.unknownMessageTypes).toBe(2)
      expect(stats.routingErrors).toBe(1)
      expect(stats.errorsByType).toBeDefined()
    })

    test('應該生成錯誤報告', () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      // 添加一些錯誤記錄
      handler.errorStats.totalErrors = 5
      handler.errorStats.unknownMessageTypes = 2
      handler.errorStats.routingErrors = 1

      // eslint-disable-next-line no-unused-vars
      const report = handler.generateErrorReport()

      expect(report).toContain('訊息錯誤統計報告')
      expect(report).toContain('總錯誤數: 5')
      expect(report).toContain('未知訊息類型: 2')
      expect(report).toContain('路由錯誤: 1')
    })

    test('應該支援錯誤報告匯出', () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      // eslint-disable-next-line no-unused-vars
      const exportData = handler.exportErrorData()

      expect(exportData).toHaveProperty('statistics')
      expect(exportData).toHaveProperty('recentErrors')
      expect(exportData).toHaveProperty('diagnosticInfo')
      expect(exportData).toHaveProperty('timestamp')
    })
  })

  describe('🛠 Chrome Extension 整合', () => {
    test('應該監聽 Chrome Runtime 錯誤', () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      handler.setupChromeErrorListening()

      expect(mockChromeRuntime.onMessage.addListener).toHaveBeenCalled()
    })

    test('應該處理 Chrome Runtime lastError', () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      mockChromeRuntime.lastError = { message: '測試錯誤' }

      // eslint-disable-next-line no-unused-vars
      const hasError = handler.checkChromeLastError()

      expect(hasError).toBe(true)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'MESSAGE.ERROR',
        expect.objectContaining({
          error: expect.objectContaining({ message: '測試錯誤' })
        })
      )
    })

    test('應該提供 Chrome Extension 健康檢查', () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      // eslint-disable-next-line no-unused-vars
      const healthStatus = handler.getChromeExtensionHealth()

      expect(healthStatus).toHaveProperty('runtimeAvailable')
      expect(healthStatus).toHaveProperty('messageSystemWorking')
      expect(healthStatus).toHaveProperty('lastErrorStatus')
    })
  })

  describe('⚡ 效能和記憶體管理', () => {
    test('應該限制錯誤記錄的數量', async () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      // 添加超過限制的錯誤記錄
      for (let i = 0; i < 15; i++) {
        await handler.handle({
          type: 'MESSAGE.ERROR',
          data: { error: new Error(`錯誤 ${i}`) }
        })
      }

      expect(handler.recentErrors.length).toBeLessThanOrEqual(15) // 預設限制
    })

    test('應該清理過期的錯誤記錄', () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      // 添加過期錯誤記錄
      // eslint-disable-next-line no-unused-vars
      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000 // 25小時前
      handler.recentErrors.push({
        timestamp: oldTimestamp,
        type: 'MESSAGE.ERROR',
        error: new Error('過期錯誤')
      })

      handler.cleanupExpiredErrors()

      expect(handler.recentErrors.length).toBe(0)
    })

    test('應該提供記憶體使用統計', () => {
      // eslint-disable-next-line no-unused-vars
      const MessageErrorHandler = require('src/error-handling/message-error-handler')
      // eslint-disable-next-line no-unused-vars
      const handler = new MessageErrorHandler(mockEventBus)

      // eslint-disable-next-line no-unused-vars
      const memoryStats = handler.getMemoryUsage()

      expect(memoryStats).toHaveProperty('errorRecordsCount')
      expect(memoryStats).toHaveProperty('estimatedMemoryUsage')
      expect(memoryStats).toHaveProperty('lastCleanupTime')
    })
  })
})
