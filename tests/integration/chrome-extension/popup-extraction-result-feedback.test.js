/* eslint-disable no-console */

/**
 * Chrome Extension - Popup 提取結果回饋整合測試（0.19.0-W1-007）
 *
 * 負責功能：
 * - 重現並防護 BUG-A：content script 提取成功但 popup 誤顯「提取失敗 / 未知錯誤」
 * - 驗證 content script 多個 onMessage 監聽器並存時的回應契約
 * - 確保非處理該訊息的監聽器不會以 Promise(undefined) 覆蓋正確回應
 *
 * 根因說明：
 * - content script 內有多個 chrome.runtime.onMessage.addListener
 *   1. content-modular.js — 處理 START_EXTRACTION，回應 { success: true, ... }
 *   2. chrome-event-bridge.js — 僅處理 CROSS_CONTEXT_EVENT
 * - chrome-event-bridge 的監聽器原為 async 函式：收到 START_EXTRACTION 時
 *   不符合 CROSS_CONTEXT_EVENT 分支，函式體結束，async 函式回傳 Promise.resolve(undefined)
 * - Chrome MV3 行為：監聽器回傳 Promise 視為「此監聽器負責回應」，
 *   會把 Promise resolve 的值（undefined）送回 sender，與正確監聽器的回應競爭
 * - popup 端 chrome.tabs.sendMessage 收到 undefined → response 為 falsy
 *   → popup.js startExtraction 走 else 分支拋出 new Error('未知錯誤')
 *
 * 修復契約：
 * - 不處理該訊息類型的監聽器，必須同步回傳非 Promise 的 falsy 值（undefined / false）
 * - 監聽器不可宣告為 async（async 一律回傳 Promise）
 *
 * 測試策略：
 * - 直接針對 chrome-event-bridge 工廠註冊的監聽器驗證回傳型別契約
 * - 模擬 Chrome 多監聽器情境，驗證提取成功時 sender 取得 { success: true }
 *
 * @jest-environment jsdom
 */

const createChromeEventBridge = require('@/content/bridge/chrome-event-bridge')

describe('Popup 提取結果回饋整合測試（0.19.0-W1-007 BUG-A）', () => {
  let mockChrome

  beforeEach(() => {
    jest.clearAllMocks()

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
  })

  afterEach(() => {
    delete global.chrome
  })

  describe('chrome-event-bridge 監聽器回應契約', () => {
    test('收到非 CROSS_CONTEXT_EVENT 訊息（如 START_EXTRACTION）時，監聽器不可回傳 Promise', () => {
      // Arrange：建立 bridge，取得實際註冊的監聽器
      createChromeEventBridge()
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0]

      const startExtractionMessage = { type: 'START_EXTRACTION' }
      const sender = {}
      const sendResponse = jest.fn()

      // Act：同步呼叫監聽器，不使用 await，檢查「函式直接回傳值」
      const returnValue = messageListener(startExtractionMessage, sender, sendResponse)

      // Assert：
      // Chrome MV3 中，監聽器回傳 Promise 會被視為「我負責回應」，
      // 並把 Promise resolve 的值送回 sender。
      // 非處理該訊息的監聽器必須回傳非 Promise 的 falsy 值，
      // 讓 Chrome 忽略此監聽器，由真正處理的監聽器回應。
      expect(returnValue).not.toBeInstanceOf(Promise)
      expect(returnValue).toBeFalsy()

      // 且不可呼叫 sendResponse（避免以 undefined 覆蓋正確回應）
      expect(sendResponse).not.toHaveBeenCalled()
    })

    test('收到 CROSS_CONTEXT_EVENT 時仍正常處理並回應', async () => {
      // Arrange
      createChromeEventBridge()
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0]

      const crossContextMessage = {
        type: 'CROSS_CONTEXT_EVENT',
        data: {
          event: { type: 'TEST.EVENT' },
          targetContext: 'background'
        }
      }
      const sender = {}
      const sendResponse = jest.fn()

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (callback) callback({ handled: true })
      })

      // Act
      const returnValue = messageListener(crossContextMessage, sender, sendResponse)

      // 等待非同步處理完成
      await Promise.resolve()
      await Promise.resolve()

      // Assert：處理 CROSS_CONTEXT_EVENT 時必須保持通道開啟（回傳 true）
      expect(returnValue).toBe(true)
    })
  })

  describe('多監聽器並存時的回應競爭（BUG-A 重現）', () => {
    /**
     * 模擬 Chrome MV3 多監聽器回應分派語意：
     * - 監聽器回傳 true → 該監聽器宣告會「以 sendResponse 非同步回應」，取得通道擁有權
     * - 監聽器回傳 Promise → 該監聽器宣告「以 Promise resolve 值回應」，取得通道擁有權
     * - 監聽器回傳 falsy 非 Promise（undefined / false）→ Chrome 忽略此監聽器
     * - 第一個取得通道擁有權的監聽器的回應送回 sender，後續忽略
     */
    function simulateChromeDispatch (listeners, message) {
      let response
      let owner = null // 'sendResponse' | 'promise'
      let ownerPromise = null
      const sendResponse = (value) => {
        if (owner === 'sendResponse' && response === undefined) {
          response = value
        }
      }

      for (const listener of listeners) {
        const result = listener(message, {}, sendResponse)
        if (owner !== null) continue // 通道已被先前監聽器取得
        if (result === true) {
          owner = 'sendResponse'
        } else if (result instanceof Promise) {
          owner = 'promise'
          ownerPromise = result
        }
        // falsy 非 Promise → Chrome 忽略，繼續下一個監聽器
      }

      return {
        getResponse: async () => {
          if (owner === 'promise') {
            return await ownerPromise
          }
          // owner === 'sendResponse'：等待非同步 sendResponse 觸發
          await Promise.resolve()
          await Promise.resolve()
          return response
        }
      }
    }

    test('提取成功時，sender 取得 { success: true } 而非 undefined', async () => {
      // Arrange：模擬 content script 註冊的兩個監聽器
      // 1. content-modular 風格：處理 START_EXTRACTION，非同步回應成功
      const extractionListener = (message, sender, sendResponse) => {
        if (message.type === 'START_EXTRACTION') {
          // 模擬非同步提取，完成後回應成功
          Promise.resolve().then(() => {
            sendResponse({
              success: true,
              flowId: 'flow-1',
              message: '提取流程已啟動'
            })
          })
          return true // 保持通道開啟
        }
        return undefined
      }

      // 2. bridge 監聽器（取自實際工廠）
      createChromeEventBridge()
      const bridgeListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0]

      // Act：bridge 監聽器先註冊，模擬 Chrome 依註冊順序分派
      const dispatch = simulateChromeDispatch(
        [bridgeListener, extractionListener],
        { type: 'START_EXTRACTION' }
      )
      const finalResponse = await dispatch.getResponse()

      // Assert：
      // 修復前：bridgeListener 為 async，回傳 Promise(undefined) 搶先取得通道，
      //   sender 取得 undefined → popup 誤判「提取失敗 / 未知錯誤」。
      // 修復後：bridgeListener 對 START_EXTRACTION 回傳 undefined（不搶通道），
      //   extractionListener 取得通道並回應 { success: true }。
      expect(finalResponse).toBeDefined()
      expect(finalResponse).toEqual(
        expect.objectContaining({ success: true })
      )
    })
  })
})
