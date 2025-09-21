const { ErrorCodes } = require('src/core/errors/ErrorCodes')
/**
 * Chrome Extension 事件橋接器單元測試
 * 測試跨上下文事件通訊機制
 *
 * 負責功能：
 * - 測試 Chrome Runtime 消息監聽器設置
 * - 驗證跨上下文事件分發機制
 * - 測試 background ↔ content script ↔ popup 通訊
 * - 驗證 Promise 包裝的 Chrome API 呼叫
 * - 測試錯誤處理和復原機制
 * - 驗證 Readmoo 分頁查詢功能
 *
 * 設計考量：
 * - ChromeEventBridge 處理不同腳本環境間的通訊
 * - 使用 chrome.runtime.sendMessage 和 chrome.tabs.sendMessage
 * - 支援非同步事件分發和錯誤隔離
 * - 確保通訊的可靠性和錯誤復原
 *
 * 處理流程：
 * 1. 設置消息監聽器
 * 2. 接收跨上下文事件請求
 * 3. 路由到目標上下文
 * 4. 處理回應和錯誤
 * 5. 返回結果給發送者
 *
 * 使用情境：
 * - Extension background script 與 content script 通訊
 * - Popup 與 background script 資料交換
 * - 跨分頁的事件同步處理
 */

describe('🌐 Chrome Extension 事件橋接器測試', () => {
  let createChromeEventBridge
  let bridge
  // eslint-disable-next-line no-unused-vars
  let mockChrome

  beforeEach(() => {
    // 重置測試環境
    global.testUtils.cleanup()

    // 設置詳細的 Chrome API 模擬
    mockChrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        },
        sendMessage: jest.fn(),
        lastError: null
      },
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn()
      }
    }

    global.chrome = mockChrome

    // 載入 ChromeEventBridge 工廠函數
    createChromeEventBridge = require('@/content/bridge/chrome-event-bridge')

    // 創建橋接器實例
    bridge = createChromeEventBridge()
  })

  afterEach(() => {
    // 清理
    if (bridge && bridge.destroy) {
      bridge.destroy()
    }
  })

  describe('📝 基本構造和設置', () => {
    test('應該能夠創建橋接器實例', () => {
      // Act & Assert
      expect(bridge).toBeDefined()
      expect(typeof bridge).toBe('object')
      expect(typeof bridge.sendToBackground).toBe('function')
    })

    test('應該設置Chrome Runtime消息監聽器', () => {
      // Assert
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1)
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      )
    })

    test('應該初始化消息處理器映射', () => {
      // Assert
      expect(bridge.messageHandlers.size).toBe(0)
    })
  })

  describe('🔄 跨上下文事件處理', () => {
    test('應該能夠處理跨上下文事件消息', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const mockMessage = {
        type: 'CROSS_CONTEXT_EVENT',
        data: {
          event: { type: 'test.event', data: { value: 'test' } },
          targetContext: 'background'
        }
      }
      // eslint-disable-next-line no-unused-vars
      const mockSender = { tab: { id: 123 } }
      // eslint-disable-next-line no-unused-vars
      const mockSendResponse = jest.fn()

      bridge.dispatchToContext = jest.fn().mockResolvedValue('success-result')

      // 取得實際的消息監聽器
      // eslint-disable-next-line no-unused-vars
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0]

      // Act
      // eslint-disable-next-line no-unused-vars
      const result = await messageListener(mockMessage, mockSender, mockSendResponse)

      // Assert
      expect(result).toBe(true) // 保持消息通道開啟
      expect(bridge.dispatchToContext).toHaveBeenCalledWith(
        mockMessage.data.event,
        mockMessage.data.targetContext
      )
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        result: 'success-result'
      })
    })

    test('應該處理非跨上下文事件消息', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const mockMessage = { type: 'OTHER_MESSAGE' }
      // eslint-disable-next-line no-unused-vars
      const mockSender = {}
      // eslint-disable-next-line no-unused-vars
      const mockSendResponse = jest.fn()

      // 取得實際的消息監聽器
      // eslint-disable-next-line no-unused-vars
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0]

      // Act
      // eslint-disable-next-line no-unused-vars
      const result = await messageListener(mockMessage, mockSender, mockSendResponse)

      // Assert
      expect(result).toBeUndefined() // 不處理其他消息類型
      expect(mockSendResponse).not.toHaveBeenCalled()
    })

    test('應該處理跨上下文事件的錯誤', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const mockMessage = {
        type: 'CROSS_CONTEXT_EVENT',
        data: {
          event: { type: 'test.event' },
          targetContext: 'invalid'
        }
      }
      // eslint-disable-next-line no-unused-vars
      const mockSender = {}
      // eslint-disable-next-line no-unused-vars
      const mockSendResponse = jest.fn()

      bridge.dispatchToContext = jest.fn().mockRejectedValue(new Error('Unknown context'))

      // 取得實際的消息監聽器
      // eslint-disable-next-line no-unused-vars
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0]

      // Act
      await messageListener(mockMessage, mockSender, mockSendResponse)

      // Assert
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Unknown context'
      })
    })
  })

  describe('🎯 上下文分發機制', () => {
    test('應該能夠分發到 background 上下文', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.background.event', data: { test: true } }
      bridge.dispatchToBackground = jest.fn().mockResolvedValue('background-result')

      // Act
      // eslint-disable-next-line no-unused-vars
      const result = await bridge.dispatchToContext(mockEvent, 'background')

      // Assert
      expect(result).toBe('background-result')
      expect(bridge.dispatchToBackground).toHaveBeenCalledWith(mockEvent)
    })

    test('應該能夠分發到 content 上下文', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.content.event', data: { test: true } }
      bridge.dispatchToContent = jest.fn().mockResolvedValue(['content-result'])

      // Act
      // eslint-disable-next-line no-unused-vars
      const result = await bridge.dispatchToContext(mockEvent, 'content')

      // Assert
      expect(result).toEqual(['content-result'])
      expect(bridge.dispatchToContent).toHaveBeenCalledWith(mockEvent)
    })

    test('應該能夠分發到 popup 上下文', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.popup.event', data: { test: true } }
      bridge.dispatchToPopup = jest.fn().mockResolvedValue('popup-result')

      // Act
      // eslint-disable-next-line no-unused-vars
      const result = await bridge.dispatchToContext(mockEvent, 'popup')

      // Assert
      expect(result).toBe('popup-result')
      expect(bridge.dispatchToPopup).toHaveBeenCalledWith(mockEvent)
    })

    test('應該拋出未知上下文錯誤', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'test.event' }

      // Act & Assert
      await expect(bridge.dispatchToContext(mockEvent, 'unknown')).rejects.toMatchObject({
        code: ErrorCodes.VALIDATION_ERROR,
        message: expect.any(String),
        details: expect.any(Object)
      })
    })
  })

  describe('📤 Background 通訊機制', () => {
    test('應該能夠發送事件到 background', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'background.test', data: { value: 123 } }
      // eslint-disable-next-line no-unused-vars
      const mockResponse = { success: true, data: 'response' }

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        setTimeout(() => callback(mockResponse), 0)
      })

      // Act
      // eslint-disable-next-line no-unused-vars
      const result = await bridge.dispatchToBackground(mockEvent)

      // Assert
      expect(result).toBe(mockResponse)
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'BACKGROUND_EVENT',
        event: mockEvent
      }, expect.any(Function))
    })

    test('應該處理 background 通訊錯誤', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'background.test' }

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        mockChrome.runtime.lastError = { message: 'Connection error' }
        setTimeout(() => callback(), 0)
      })

      // Act & Assert
      await expect(bridge.dispatchToBackground(mockEvent)).rejects.toMatchObject({
        code: ErrorCodes.SYSTEM_ERROR,
        message: expect.any(String),
        details: expect.any(Object)
      })

      // Cleanup
      mockChrome.runtime.lastError = null
    })
  })

  describe('📥 Content Script 通訊機制', () => {
    test('應該能夠發送事件到 content scripts', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'content.test', data: { value: 456 } }
      // eslint-disable-next-line no-unused-vars
      const mockTabs = [
        { id: 1, url: 'https://readmoo.com/book/123' },
        { id: 2, url: 'https://members.readmoo.com/profile' }
      ]
      // eslint-disable-next-line no-unused-vars
      const mockResponses = ['response1', 'response2']

      bridge.getReadmooTabs = jest.fn().mockResolvedValue(mockTabs)
      bridge.sendToTab = jest.fn()
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1])

      // Act
      // eslint-disable-next-line no-unused-vars
      const results = await bridge.dispatchToContent(mockEvent)

      // Assert
      expect(results).toEqual(mockResponses)
      expect(bridge.getReadmooTabs).toHaveBeenCalled()
      expect(bridge.sendToTab).toHaveBeenCalledTimes(2)
      expect(bridge.sendToTab).toHaveBeenCalledWith(1, {
        type: 'CONTENT_EVENT',
        event: mockEvent
      })
      expect(bridge.sendToTab).toHaveBeenCalledWith(2, {
        type: 'CONTENT_EVENT',
        event: mockEvent
      })
    })

    test('應該處理部分分頁發送失敗', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'content.test' }
      // eslint-disable-next-line no-unused-vars
      const mockTabs = [{ id: 1 }, { id: 2 }, { id: 3 }]

      bridge.getReadmooTabs = jest.fn().mockResolvedValue(mockTabs)
      bridge.sendToTab = jest.fn()
        .mockResolvedValueOnce('success1')
        .mockRejectedValueOnce(new Error('Tab closed'))
        .mockResolvedValueOnce('success3')

      // eslint-disable-next-line no-unused-vars
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      // Act
      // eslint-disable-next-line no-unused-vars
      const results = await bridge.dispatchToContent(mockEvent)

      // Assert
      expect(results).toEqual(['success1', 'success3']) // 只包含成功的結果
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send event to tab 2:',
        expect.any(Error)
      )

      // Cleanup
      consoleSpy.mockRestore()
    })
  })

  describe('🔍 Readmoo 分頁查詢', () => {
    test('應該能夠查詢 Readmoo 相關分頁', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const mockTabs = [
        { id: 1, url: 'https://readmoo.com/book/123' },
        { id: 2, url: 'https://members.readmoo.com/profile' }
      ]

      mockChrome.tabs.query.mockImplementation((queryInfo, callback) => {
        expect(queryInfo).toEqual({
          url: ['*://readmoo.com/*', '*://*.readmoo.com/*']
        })
        setTimeout(() => callback(mockTabs), 0)
      })

      // Act
      // eslint-disable-next-line no-unused-vars
      const tabs = await bridge.getReadmooTabs()

      // Assert
      expect(tabs).toEqual(mockTabs)
      expect(mockChrome.tabs.query).toHaveBeenCalledTimes(1)
    })

    test('應該處理沒有 Readmoo 分頁的情況', async () => {
      // Arrange
      mockChrome.tabs.query.mockImplementation((queryInfo, callback) => {
        setTimeout(() => callback([]), 0)
      })

      // Act
      // eslint-disable-next-line no-unused-vars
      const tabs = await bridge.getReadmooTabs()

      // Assert
      expect(tabs).toEqual([])
    })
  })

  describe('📨 分頁消息發送', () => {
    test('應該能夠發送消息到指定分頁', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const tabId = 123
      // eslint-disable-next-line no-unused-vars
      const message = { type: 'TEST_MESSAGE', data: { test: true } }
      // eslint-disable-next-line no-unused-vars
      const mockResponse = { success: true }

      mockChrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        expect(id).toBe(tabId)
        expect(msg).toBe(message)
        setTimeout(() => callback(mockResponse), 0)
      })

      // Act
      // eslint-disable-next-line no-unused-vars
      const response = await bridge.sendToTab(tabId, message)

      // Assert
      expect(response).toBe(mockResponse)
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        tabId, message, expect.any(Function)
      )
    })

    test('應該處理分頁消息發送錯誤', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const tabId = 456
      // eslint-disable-next-line no-unused-vars
      const message = { type: 'TEST_MESSAGE' }

      mockChrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        mockChrome.runtime.lastError = { message: 'Could not establish connection' }
        setTimeout(() => callback(), 0)
      })

      // Act & Assert
      await expect(bridge.sendToTab(tabId, message)).rejects.toMatchObject({
        code: ErrorCodes.SYSTEM_ERROR,
        message: expect.any(String),
        details: expect.any(Object)
      })

      // Cleanup
      mockChrome.runtime.lastError = null
    })
  })

  describe('🎨 Popup 通訊機制', () => {
    test('應該能夠處理 popup 通訊', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const mockEvent = { type: 'popup.test', data: { ui: 'update' } }

      // 假設 popup 通訊與 background 通訊類似
      bridge.dispatchToBackground = jest.fn().mockResolvedValue('popup-handled')

      // Act
      // eslint-disable-next-line no-unused-vars
      const result = await bridge.dispatchToPopup(mockEvent)

      // Assert
      expect(result).toBe('popup-handled')
    })
  })

  describe('🛡 錯誤處理和復原', () => {
    test('應該能夠處理消息監聽器註冊失敗', () => {
      // Arrange
      mockChrome.runtime.onMessage.addListener.mockImplementation(() => {
        // eslint-disable-next-line no-unused-vars
        const error = new Error('Listener registration failed')
        error.code = ErrorCodes.SYSTEM_ERROR
        error.details = { category: 'testing', component: 'ChromeEventBridge' }
        throw error
      })

      // Act & Assert
      expect(() => {
        createChromeEventBridge()
      }).toThrow()

      // 驗證拋出的錯誤符合預期格式
      try {
        createChromeEventBridge()
      } catch (error) {
        expect(error).toMatchObject({
          code: ErrorCodes.SYSTEM_ERROR,
          details: expect.any(Object)
        })
      }
    })

    test('應該能夠清理資源', () => {
      // Arrange
      bridge.messageHandlers.set('test', 'handler')
      // eslint-disable-next-line no-unused-vars
      const mockListener = jest.fn()
      bridge.messageListener = mockListener

      // Act
      bridge.destroy()

      // Assert
      expect(bridge.messageHandlers.size).toBe(0)
      expect(mockChrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(mockListener)
    })
  })

  describe('⚡ 整合測試', () => {
    test('應該能夠完成完整的跨上下文事件流程', async () => {
      // Arrange
      // eslint-disable-next-line no-unused-vars
      const originalEvent = {
        type: 'extractor.data.extracted',
        data: { books: [{ id: '123', title: 'Test Book' }] }
      }

      // eslint-disable-next-line no-unused-vars
      const crossContextMessage = {
        type: 'CROSS_CONTEXT_EVENT',
        data: {
          event: originalEvent,
          targetContext: 'content'
        }
      }

      // eslint-disable-next-line no-unused-vars
      const mockSender = { tab: { id: 100 } }
      // eslint-disable-next-line no-unused-vars
      const mockSendResponse = jest.fn()

      // 模擬完整的content發送流程
      bridge.getReadmooTabs = jest.fn().mockResolvedValue([{ id: 200 }])
      bridge.sendToTab = jest.fn().mockResolvedValue({ processed: true })

      // 取得消息監聽器
      // eslint-disable-next-line no-unused-vars
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0]

      // Act
      await messageListener(crossContextMessage, mockSender, mockSendResponse)

      // Assert
      expect(bridge.getReadmooTabs).toHaveBeenCalled()
      expect(bridge.sendToTab).toHaveBeenCalledWith(200, {
        type: 'CONTENT_EVENT',
        event: originalEvent
      })
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        result: [{ processed: true }]
      })
    })
  })
})
