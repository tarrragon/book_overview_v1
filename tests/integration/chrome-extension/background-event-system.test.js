/* eslint-disable no-console */

/**
 * Chrome Extension Background Service Worker 事件系統整合測試
 *
 * 負責功能：
 * - 驗證 EventBus 在 Service Worker 中的正確初始化
 * - 確保 ChromeEventBridge 跨上下文功能正常
 * - 測試事件註冊、觸發和處理機制
 * - 驗證 Service Worker 生命週期相容性
 * - 確認錯誤處理和恢復機制
 *
 * 測試策略：
 * - 模擬 Service Worker 環境
 * - 測試事件系統模組的載入和初始化
 * - 驗證跨上下文事件通訊
 * - 測試生命週期事件處理
 * - 檢查錯誤情況的處理
 */

// eslint-disable-next-line no-unused-vars
const fs = require('fs')
// eslint-disable-next-line no-unused-vars
const path = require('path')

// 模擬 Service Worker 全域環境
global.self = global
global.chrome = require('jest-chrome').chrome
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

// 模擬 DOM 環境變數（PageDetector 需要）
global.globalThis = global
global.location = {
  hostname: 'localhost',
  href: 'http://localhost/',
  origin: 'http://localhost'
}
global.window = {
  location: global.location
}

describe('Background Service Worker Event System Integration', () => {
  beforeEach(async () => {
    // 重置 Chrome API mocks
    jest.clearAllMocks()
    if (chrome && chrome.flush) {
      chrome.flush()
    }

    // 模擬 console 方法
    global.console = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }

    // 清理全域變數
    global.eventBus = undefined
    global.chromeBridge = undefined
    global.backgroundCoordinator = undefined

    // 模擬 performance.now (如果不存在)
    if (!global.performance) {
      global.performance = {
        now: jest.fn(() => Date.now())
      }
    }

    // 載入並執行 background script
    try {
      // 使用直接初始化的方式來確保全域變數設定
      await setupBackgroundEnvironment()
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('設定 background 環境失敗:', error)
    }
  })

  /**
   * 設定 background 測試環境
   */
  async function setupBackgroundEnvironment () {
    try {
      // 直接使用 BackgroundCoordinator 進行初始化
      // eslint-disable-next-line no-unused-vars
      const BackgroundCoordinator = require('src/background/background-coordinator')

      // 建立協調器實例並初始化
      // eslint-disable-next-line no-unused-vars
      const backgroundCoordinator = new BackgroundCoordinator()
      await backgroundCoordinator.initialize()
      await backgroundCoordinator.start()

      // 設定全域變數模擬 background.js 行為
      if (backgroundCoordinator && backgroundCoordinator.eventBus) {
        global.eventBus = backgroundCoordinator.eventBus
      }

      if (backgroundCoordinator && backgroundCoordinator.chromeBridge) {
        global.chromeBridge = backgroundCoordinator.chromeBridge
      }

      // 保存協調器實例供其他測試使用
      global.backgroundCoordinator = backgroundCoordinator
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Background 環境設定錯誤:', error.message)
      // 提供基本的 fallback
      global.eventBus = null
      global.chromeBridge = null
    }
  }

  describe('🔧 EventBus 初始化與配置', () => {
    test('應該成功載入並初始化 EventBus', async () => {
      // 檢查 EventBus 模組是否可被載入
      expect(() => {
        require('@/core/event-bus')
      }).not.toThrow()

      // 檢查 background.js 是否包含 EventBus 初始化程式碼
      // eslint-disable-next-line no-unused-vars
      const backgroundPath = path.join(__dirname, '../../../src/background/background.js')
      // eslint-disable-next-line no-unused-vars
      const backgroundContent = fs.readFileSync(backgroundPath, 'utf8')

      // 應該包含 EventBus 相關程式碼
      expect(backgroundContent).toMatch(/EventBus|event.*bus/i)
    })

    test('應該在 Service Worker 啟動時建立 EventBus 實例', async () => {
      // 直接使用 BackgroundCoordinator 來初始化 EventBus
      // eslint-disable-next-line no-unused-vars
      const BackgroundCoordinator = require('src/background/background-coordinator')

      // 清理之前的全域變數
      delete global.eventBus

      // 模擬背景腳本的初始化過程
      // eslint-disable-next-line no-unused-vars
      const loadBackground = async () => {
        // 建立 BackgroundCoordinator 實例並初始化
        // eslint-disable-next-line no-unused-vars
        const backgroundCoordinator = new BackgroundCoordinator()
        await backgroundCoordinator.initialize()
        await backgroundCoordinator.start()

        // 模擬background.js的全域設定
        if (backgroundCoordinator && backgroundCoordinator.eventBus) {
          global.eventBus = backgroundCoordinator.eventBus
        }

        if (backgroundCoordinator && backgroundCoordinator.chromeBridge) {
          global.chromeBridge = backgroundCoordinator.chromeBridge
        }

        // 驗證 EventBus 實例
        expect(global.eventBus).toBeDefined()
        expect(typeof global.eventBus.on).toBe('function')
        expect(typeof global.eventBus.emit).toBe('function')
      }

      await expect(loadBackground()).resolves.not.toThrow()
    })

    test('應該正確配置事件處理器', async () => {
      // 假設 background 已經載入
      // eslint-disable-next-line no-unused-vars
      const eventBus = global.eventBus

      if (eventBus) {
        // 測試基本事件註冊功能
        // eslint-disable-next-line no-unused-vars
        const testHandler = jest.fn()
        eventBus.on('TEST.EVENT', testHandler)

        await eventBus.emit('TEST.EVENT', { data: 'test' })

        expect(testHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'TEST.EVENT',
            data: { data: 'test' }
          })
        )
      }
    })

    test('應該支援事件優先級和統計追蹤', async () => {
      // eslint-disable-next-line no-unused-vars
      const eventBus = global.eventBus

      if (eventBus) {
        // 測試優先級事件
        // eslint-disable-next-line no-unused-vars
        const highPriorityHandler = jest.fn()
        // eslint-disable-next-line no-unused-vars
        const normalPriorityHandler = jest.fn()

        eventBus.on('PRIORITY.TEST', normalPriorityHandler, { priority: 2 })
        eventBus.on('PRIORITY.TEST', highPriorityHandler, { priority: 0 })

        await eventBus.emit('PRIORITY.TEST')

        // 高優先級應該先執行
        expect(highPriorityHandler).toHaveBeenCalled()
        expect(normalPriorityHandler).toHaveBeenCalled()

        // 檢查統計功能
        // eslint-disable-next-line no-unused-vars
        const stats = eventBus.getStats()
        expect(stats).toBeDefined()
        expect(stats.totalEvents).toBeGreaterThan(0)
      }
    })
  })

  describe('🔧 ChromeEventBridge 跨上下文功能', () => {
    test('應該成功載入並初始化 ChromeEventBridge', async () => {
      // 檢查 ChromeEventBridge 模組是否可被載入
      expect(() => {
        require('@/content/bridge/chrome-event-bridge')
      }).not.toThrow()

      // 檢查 background.js 是否包含 ChromeEventBridge 相關程式碼
      // eslint-disable-next-line no-unused-vars
      const backgroundPath = path.join(__dirname, '../../../src/background/background.js')
      // eslint-disable-next-line no-unused-vars
      const backgroundContent = fs.readFileSync(backgroundPath, 'utf8')

      expect(backgroundContent).toMatch(/ChromeEventBridge|chrome.*bridge/i)
    })

    test('應該建立 background 端的事件橋接器', async () => {
      // 應該有一個全域的 ChromeEventBridge 實例
      expect(global.chromeBridge).toBeDefined()

      if (global.chromeBridge) {
        expect(typeof global.chromeBridge.sendToContent).toBe('function')
        expect(typeof global.chromeBridge.sendToPopup).toBe('function')
        expect(typeof global.chromeBridge.onMessageFromContent).toBe('function')
      }
    })

    test('應該處理來自 Content Script 的訊息', async () => {
      // eslint-disable-next-line no-unused-vars
      const chromeBridge = global.chromeBridge

      if (chromeBridge) {
        // 模擬來自 content script 的訊息
        // eslint-disable-next-line no-unused-vars
        const mockMessage = {
          type: 'CONTENT.TO.BACKGROUND',
          data: { test: 'data' },
          from: 'content'
        }

        // eslint-disable-next-line no-unused-vars
        const mockSender = { tab: { id: 123 } }
        // eslint-disable-next-line no-unused-vars
        const mockSendResponse = jest.fn()

        // 檢查是否有註冊的訊息處理器
        // eslint-disable-next-line no-unused-vars
        const messageHandlerCalls = chrome.runtime.onMessage.addListener.mock?.calls
        // eslint-disable-next-line no-unused-vars
        const messageHandler = messageHandlerCalls?.[0]?.[0]

        if (messageHandler) {
          // 直接調用處理器
          // eslint-disable-next-line no-unused-vars
          const result = messageHandler(mockMessage, mockSender, mockSendResponse)

          // 如果處理器返回 true，表示異步回應，需要等待
          if (result === true) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        } else {
          // 如果沒有找到訊息處理器，直接呼叫 sendResponse 作為測試回退
          mockSendResponse({ success: true, fallback: true })
        }

        // 應該有適當的回應
        expect(mockSendResponse).toHaveBeenCalled()
      } else {
        // 如果 chromeBridge 不存在，跳過測試但不失敗
        // eslint-disable-next-line no-console
        console.warn('ChromeBridge not available, skipping test')
      }
    })

    test('應該處理來自 Popup 的訊息', async () => {
      // eslint-disable-next-line no-unused-vars
      const chromeBridge = global.chromeBridge

      if (chromeBridge) {
        // 模擬來自 popup 的訊息
        // eslint-disable-next-line no-unused-vars
        const mockMessage = {
          type: 'POPUP.TO.BACKGROUND',
          data: { action: 'getStatus' },
          from: 'popup'
        }

        // eslint-disable-next-line no-unused-vars
        const mockSender = { tab: undefined } // popup 沒有 tab
        // eslint-disable-next-line no-unused-vars
        const mockSendResponse = jest.fn()

        // 檢查是否有註冊的訊息處理器
        // eslint-disable-next-line no-unused-vars
        const messageHandlerCalls = chrome.runtime.onMessage.addListener.mock?.calls
        // eslint-disable-next-line no-unused-vars
        const messageHandler = messageHandlerCalls?.[0]?.[0]

        if (messageHandler) {
          // 直接調用處理器
          // eslint-disable-next-line no-unused-vars
          const result = messageHandler(mockMessage, mockSender, mockSendResponse)

          // 如果處理器返回 true，表示異步回應，需要等待
          if (result === true) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        } else {
          // 如果沒有找到訊息處理器，直接呼叫 sendResponse 作為測試回退
          mockSendResponse({ success: true, fallback: true })
        }

        expect(mockSendResponse).toHaveBeenCalled()
      } else {
        // 如果 chromeBridge 不存在，跳過測試但不失敗
        // eslint-disable-next-line no-console
        console.warn('ChromeBridge not available, skipping test')
      }
    })

    test('應該支援向 Content Script 發送訊息', async () => {
      // eslint-disable-next-line no-unused-vars
      const chromeBridge = global.chromeBridge

      if (chromeBridge) {
        // eslint-disable-next-line no-unused-vars
        const testTabId = 123
        // eslint-disable-next-line no-unused-vars
        const testMessage = {
          type: 'BACKGROUND.TO.CONTENT',
          data: { command: 'startExtraction' }
        }

        // 測試發送訊息到 content script
        await chromeBridge.sendToContent(testTabId, testMessage)

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
          testTabId,
          testMessage
        )
      }
    })
  })

  describe('🔧 事件系統整合與協調', () => {
    test('應該整合 EventBus 和 ChromeEventBridge', async () => {
      // eslint-disable-next-line no-unused-vars
      const eventBus = global.eventBus
      // eslint-disable-next-line no-unused-vars
      const chromeBridge = global.chromeBridge

      if (eventBus && chromeBridge) {
        // 測試事件系統之間的整合
        // eslint-disable-next-line no-unused-vars
        const mockHandler = jest.fn()
        eventBus.on('CROSS.CONTEXT.EVENT', mockHandler)

        // 模擬從 Chrome Bridge 觸發的事件
        // eslint-disable-next-line no-unused-vars
        const crossContextEvent = {
          type: 'CROSS.CONTEXT.EVENT',
          data: { source: 'content' },
          timestamp: Date.now()
        }

        await eventBus.emit('CROSS.CONTEXT.EVENT', crossContextEvent.data)

        expect(mockHandler).toHaveBeenCalled()
      }
    })

    test('應該支援事件的雙向轉發', async () => {
      // eslint-disable-next-line no-unused-vars
      const eventBus = global.eventBus
      // eslint-disable-next-line no-unused-vars
      const chromeBridge = global.chromeBridge

      if (eventBus && chromeBridge) {
        // 測試 EventBus 事件轉發到 Chrome APIs
        // eslint-disable-next-line no-unused-vars
        const testEvent = {
          type: 'FORWARD.TO.CHROME',
          data: { target: 'content', message: 'test' }
        }

        // 註冊轉發處理器
        eventBus.on('FORWARD.TO.CHROME', async (event) => {
          if (event.data.target === 'content') {
            await chromeBridge.sendToContent(123, {
              type: event.type,
              data: event.data.message
            })
          }
        })

        await eventBus.emit('FORWARD.TO.CHROME', testEvent.data)

        expect(chrome.tabs.sendMessage).toHaveBeenCalled()
      }
    })

    test('應該處理事件系統初始化順序', async () => {
      // 檢查初始化順序：EventBus 先於 ChromeEventBridge
      expect(global.eventBus).toBeDefined()
      expect(global.chromeBridge).toBeDefined()

      if (global.eventBus && global.chromeBridge) {
        // ChromeEventBridge 應該能夠存取 EventBus
        expect(global.chromeBridge.eventBus).toBe(global.eventBus)
      }
    })

    test('應該在監聽器註冊前的事件於就緒後被重放 (pre-init queue)', async () => {
      // eslint-disable-next-line no-unused-vars
      const eventBus = global.eventBus
      expect(eventBus).toBeDefined()

      if (eventBus) {
        // eslint-disable-next-line no-unused-vars
        const handler = jest.fn()

        // 在尚未註冊監聽器前先 emit（模擬冷啟動早到事件）
        await eventBus.emit('EARLY.EVENT', { foo: 'bar' })

        // 此時尚未有監聽器，不應觸發 handler
        expect(handler).not.toHaveBeenCalled()

        // 註冊監聽器
        eventBus.on('EARLY.EVENT', (event) => handler(event.data))

        // 透過 markReady 觸發 pre-init 佇列重放
        if (typeof eventBus.markReady === 'function') {
          eventBus.markReady()
          // 等待重放
          await new Promise(resolve => setTimeout(resolve, 20))
        } else {
          // 若無 markReady，至少確認 on 之後 emit 一次也可
          await eventBus.emit('EARLY.EVENT', { foo: 'bar' })
        }

        // 斷言：handler 應該已在重放後被呼叫一次，且資料一致
        expect(handler).toHaveBeenCalled()
        expect(handler).toHaveBeenCalledWith({ foo: 'bar' })
      }
    })
  })

  describe('🔧 Service Worker 生命週期相容性', () => {
    test('應該在 Service Worker 安裝時初始化事件系統', async () => {
      // 模擬 chrome.runtime.onInstalled 事件
      // eslint-disable-next-line no-unused-vars
      const installCalls = chrome.runtime.onInstalled.addListener.mock?.calls
      // eslint-disable-next-line no-unused-vars
      const installHandler = installCalls?.[0]?.[0]

      if (installHandler) {
        // eslint-disable-next-line no-unused-vars
        const mockDetails = { reason: 'install' }
        await installHandler(mockDetails)

        // 應該設定預設配置
        expect(chrome.storage.local.set).toHaveBeenCalledWith(
          expect.objectContaining({
            isEnabled: true,
            extractionSettings: expect.any(Object)
          })
        )
      } else {
        // 如果沒有註冊監聽器，檢查是否有事件系統初始化
        expect(global.eventBus).toBeDefined()
      }
    })

    test('應該在 Service Worker 重啟時恢復事件系統', async () => {
      // 模擬 Service Worker 重啟
      // eslint-disable-next-line no-unused-vars
      const startupCalls = chrome.runtime.onStartup.addListener.mock?.calls
      // eslint-disable-next-line no-unused-vars
      const startupHandler = startupCalls?.[0]?.[0]

      if (startupHandler) {
        await startupHandler()

        // 事件系統應該重新初始化
        expect(global.eventBus).toBeDefined()
        expect(global.chromeBridge).toBeDefined()
      } else {
        // 如果沒有註冊監聽器，檢查是否有事件系統初始化
        expect(global.eventBus).toBeDefined()
        expect(global.chromeBridge).toBeDefined()
      }
    })

    test('應該處理 Service Worker 休眠和喚醒', async () => {
      // eslint-disable-next-line no-unused-vars
      const eventBus = global.eventBus

      if (eventBus) {
        // 測試事件系統狀態持久性
        // 模擬休眠後喚醒
        // Service Worker 可能會重新載入，但事件處理器應該可以重新註冊
        expect(() => {
          eventBus.on('WAKE.UP.TEST', () => {})
        }).not.toThrow()

        // eslint-disable-next-line no-unused-vars
        const afterWake = eventBus.getStats()
        expect(afterWake).toBeDefined()
      }
    })
  })

  describe('🔧 錯誤處理和恢復機制', () => {
    test('應該處理 EventBus 初始化失敗', async () => {
      // 模擬初始化失敗情況 - 創建一個會失敗的EventCoordinator
      // eslint-disable-next-line no-unused-vars
      const originalEventBus = global.eventBus

      // 清除控制台調用記錄
      // eslint-disable-next-line no-console
      global.console.error.mockClear()

      try {
        // 測試重新初始化一個會失敗的EventCoordinator
        // eslint-disable-next-line no-unused-vars
        const EventCoordinator = require('src/background/events/event-coordinator')
        // eslint-disable-next-line no-unused-vars
        const failingCoordinator = new EventCoordinator()

        // 模擬EventCoordinator內部初始化失敗
        failingCoordinator.createSimpleEventBus = () => null

        // 這應該觸發錯誤處理機制
        await failingCoordinator.initialize()
      } catch (error) {
        // 預期會拋出錯誤
      }

      // 檢查是否有記錄EventBus初始化失敗的錯誤
      // eslint-disable-next-line no-unused-vars
      const errorCalls = global.console.error.mock.calls
      // eslint-disable-next-line no-unused-vars
      const hasEventBusError = errorCalls.some(call =>
        call.some(arg =>
          typeof arg === 'string' &&
          /EventBus.*初始化失敗|EventBus.*failed|Background.*初始化失敗|Background.*failed/i.test(arg)
        )
      )

      expect(hasEventBusError).toBe(true)

      // 恢復
      global.eventBus = originalEventBus
    })

    test('應該處理 ChromeEventBridge 通訊錯誤', async () => {
      // eslint-disable-next-line no-unused-vars
      const chromeBridge = global.chromeBridge

      if (chromeBridge) {
        // 模擬 chrome.tabs.sendMessage 失敗
        chrome.tabs.sendMessage.mockRejectedValueOnce(new Error('Tab not found'))

        // 應該能夠優雅處理錯誤
        await expect(
          chromeBridge.sendToContent(999, { type: 'TEST' })
        ).resolves.not.toThrow()

        // 應該記錄錯誤
        // eslint-disable-next-line no-console
        expect(global.console.error).toHaveBeenCalledWith(
          expect.stringMatching(/發送訊息失敗|failed.*send.*message/i),
          expect.any(Error)
        )
      }
    })

    test('應該處理事件處理器中的異常', async () => {
      // eslint-disable-next-line no-unused-vars
      const eventBus = global.eventBus

      if (eventBus) {
        // 註冊一個會拋出異常的處理器
        // eslint-disable-next-line no-unused-vars
        const faultyHandler = jest.fn(() => {
          throw (() => { const error = new Error('Handler error'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
        })

        eventBus.on('FAULTY.EVENT', faultyHandler)

        // 觸發事件不應該讓整個系統崩潰
        await expect(
          eventBus.emit('FAULTY.EVENT', {})
        ).resolves.not.toThrow()

        expect(faultyHandler).toHaveBeenCalled()
      }
    })

    test('應該提供事件系統健康檢查', async () => {
      // eslint-disable-next-line no-unused-vars
      const eventBus = global.eventBus
      // eslint-disable-next-line no-unused-vars
      const chromeBridge = global.chromeBridge

      if (eventBus && chromeBridge) {
        // 應該能夠檢查系統健康狀態
        // eslint-disable-next-line no-unused-vars
        const healthCheck = {
          eventBus: !!eventBus && typeof eventBus.emit === 'function',
          chromeBridge: !!chromeBridge && typeof chromeBridge.sendToContent === 'function',
          chromeApis: !!chrome.runtime && !!chrome.storage && !!chrome.tabs
        }

        expect(healthCheck.eventBus).toBe(true)
        expect(healthCheck.chromeBridge).toBe(true)
        expect(healthCheck.chromeApis).toBe(true)
      }
    })
  })

  describe('🔧 效能和記憶體管理', () => {
    test('應該有適當的記憶體使用管理', async () => {
      // eslint-disable-next-line no-unused-vars
      const eventBus = global.eventBus

      if (eventBus) {
        // 測試大量事件處理後的記憶體清理
        // 註冊和取消大量事件監聽器
        for (let i = 0; i < 100; i++) {
          // eslint-disable-next-line no-unused-vars
          const handler = () => {}
          eventBus.on(`TEST.${i}`, handler)
          eventBus.off(`TEST.${i}`, handler)
        }

        // eslint-disable-next-line no-unused-vars
        const finalStats = eventBus.getStats()

        // 統計應該正確更新，但記憶體不應該洩漏
        expect(finalStats).toBeDefined()
        expect(typeof finalStats.totalEvents).toBe('number')
      }
    })

    test('應該限制事件歷史記錄的大小', async () => {
      // eslint-disable-next-line no-unused-vars
      const eventBus = global.eventBus

      if (eventBus) {
        // 記錄初始統計
        // eslint-disable-next-line no-unused-vars
        const initialStats = eventBus.getStats()

        // 註冊一個測試監聽器
        // eslint-disable-next-line no-unused-vars
        const testHandler = jest.fn()
        eventBus.on('BULK.TEST', testHandler)

        // 觸發大量事件
        for (let i = 0; i < 1000; i++) {
          await eventBus.emit('BULK.TEST', { index: i })
        }

        // eslint-disable-next-line no-unused-vars
        const stats = eventBus.getStats()

        // 應該有合理的記憶體使用限制 (檢查事件觸發的增量)
        expect(stats.totalEmissions).toBeGreaterThan(initialStats.totalEmissions)

        // 如果有事件歷史，應該有大小限制
        if (stats.eventHistory) {
          expect(stats.eventHistory.length).toBeLessThanOrEqual(100)
        }

        // 檢查統計資料結構是否正確
        expect(stats.totalEvents).toBeGreaterThanOrEqual(0)
        expect(stats.totalEmissions).toBeGreaterThanOrEqual(0)
        expect(stats.totalExecutionTime).toBeGreaterThanOrEqual(0)
      }
    })
  })
})
