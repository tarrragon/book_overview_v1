/* eslint-disable no-console */

/**
 * 資料提取到 Overview 顯示的端到端整合測試
 *
 * 負責功能：
 * - 驗證從 Content Script 提取書籍到 Overview 頁面顯示的完整資料流
 * - 偵測 ContentMessageHandler 未正確組裝的問題
 * - 偵測 EventCoordinator 生命週期不完整的問題
 * - 驗證 chromeMessageListener 同步回傳 true 的 Manifest V3 合規性
 *
 * 資料流架構：
 * [1] Content Script -> ReadmooAdapter.extractAllBooks() -> eventBus.emit('EXTRACTION.COMPLETED')
 * [2] Chrome Event Bridge -> chrome.runtime.sendMessage({ type: 'CONTENT.EVENT.FORWARD' })
 * [3] Background SW -> MessageRouter -> ContentMessageHandler -> eventBus.emit()
 * [4] EventCoordinator -> EXTRACTION.COMPLETED listener -> chrome.storage.local.set({ readmoo_books })
 * [5] Overview Page -> chrome.storage.local.get(['readmoo_books']) -> renderBooksTable()
 *
 * @see Ticket 0.15.4-W4-002
 */

global.chrome = require('jest-chrome').chrome
global.self = global

// 模擬 performance.now
if (!global.performance) {
  global.performance = { now: jest.fn(() => Date.now()) }
}

describe('Data Flow End-to-End Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    if (chrome && chrome.flush) {
      chrome.flush()
    }

    // 模擬 console 方法
    global.console = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    }

    // 清理全域變數
    global.eventBus = undefined
    global.chromeBridge = undefined
    global.backgroundCoordinator = undefined

    // 設定 chrome.storage.local mock（預設回傳空物件）
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      if (typeof callback === 'function') {
        callback({})
      }
      return Promise.resolve({})
    })
    chrome.storage.local.set.mockImplementation((data, callback) => {
      if (typeof callback === 'function') {
        callback()
      }
      return Promise.resolve()
    })
  })

  afterEach(() => {
    // 清理模組快取，避免測試間汙染
    Object.keys(require.cache).forEach(key => {
      if (key.includes('src/background/')) {
        delete require.cache[key]
      }
    })
  })

  describe('測試 1: 完整資料流（正常路徑）', () => {
    test('EXTRACTION.COMPLETED 事件應觸發 chrome.storage.local.set 儲存書籍資料', async () => {
      // Arrange: 建立 EventCoordinator 並完成完整生命週期
      const EventCoordinator = require('src/background/events/event-coordinator')
      const coordinator = new EventCoordinator()

      await coordinator.initialize()
      await coordinator.start()

      const eventBus = coordinator.eventBusInstance

      // 驗證 eventBus 成功建立
      expect(eventBus).toBeDefined()
      expect(typeof eventBus.emit).toBe('function')

      // Act: 模擬 Content Script 提取完成後的事件資料
      const mockBooks = [
        {
          id: '12345',
          title: '測試書籍一',
          cover: 'https://cover.url/test1.jpg',
          progress: 45,
          url: 'https://readmoo.com/api/reader/12345'
        },
        {
          id: '67890',
          title: '測試書籍二',
          cover: 'https://cover.url/test2.jpg',
          progress: 80,
          url: 'https://readmoo.com/api/reader/67890'
        }
      ]

      await eventBus.emit('EXTRACTION.COMPLETED', {
        booksData: mockBooks,
        count: mockBooks.length,
        duration: 1500,
        source: 'readmoo'
      })

      // Assert: 驗證 chrome.storage.local.set 被呼叫
      expect(chrome.storage.local.set).toHaveBeenCalled()

      // 驗證儲存的資料結構正確
      const setCall = chrome.storage.local.set.mock.calls[0][0]
      expect(setCall).toHaveProperty('readmoo_books')
      expect(setCall.readmoo_books).toHaveProperty('books')
      expect(setCall.readmoo_books).toHaveProperty('extractionTimestamp')
      expect(setCall.readmoo_books).toHaveProperty('extractionCount')
      expect(setCall.readmoo_books).toHaveProperty('source', 'readmoo')

      // 驗證書籍資料內容
      const storedBooks = setCall.readmoo_books.books
      expect(storedBooks).toHaveLength(2)
      expect(storedBooks[0].title).toBe('測試書籍一')
      expect(storedBooks[1].title).toBe('測試書籍二')

      // 驗證每本書都加了 'readmoo' tag（EventCoordinator 的正規化邏輯）
      storedBooks.forEach(book => {
        expect(book.tags).toContain('readmoo')
      })
    })

    test('Overview 頁面應能從 chrome.storage.local 讀取書籍資料', async () => {
      // Arrange: 模擬 chrome.storage.local 已有資料
      const mockStorageData = {
        readmoo_books: {
          books: [
            { id: '12345', title: '測試書籍', cover: 'https://cover.url/test.jpg', tags: ['readmoo'] }
          ],
          extractionTimestamp: Date.now(),
          extractionCount: 1,
          source: 'readmoo'
        }
      }

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        if (typeof callback === 'function') {
          callback(mockStorageData)
        }
        return Promise.resolve(mockStorageData)
      })

      // Act: 模擬 Overview 頁面讀取
      const result = await chrome.storage.local.get(['readmoo_books'])

      // Assert: 驗證讀取到的資料
      expect(result.readmoo_books).toBeDefined()
      expect(result.readmoo_books.books).toHaveLength(1)
      expect(result.readmoo_books.books[0].title).toBe('測試書籍')
    })
  })

  describe('測試 2: ContentMessageHandler 未注入偵測', () => {
    test('MessageRouter 在 contentMessageHandler 為 null 時應回傳錯誤', async () => {
      // Arrange: 建立 MessageRouter，但不注入 contentMessageHandler
      const MessageRouter = require('src/background/messaging/message-router')
      const router = new MessageRouter({
        contentMessageHandler: null,
        popupMessageHandler: null
      })

      await router.initialize()
      await router.start()

      // 取得已註冊的 Chrome 訊息監聽器
      const listenerCalls = chrome.runtime.onMessage.addListener.mock.calls
      expect(listenerCalls.length).toBeGreaterThan(0)

      const chromeMessageListener = listenerCalls[0][0]

      // Act: 模擬 Content Script 發送 CONTENT.EVENT.FORWARD 訊息
      const mockMessage = {
        type: 'CONTENT.EVENT.FORWARD',
        eventType: 'EXTRACTION.COMPLETED',
        data: { booksData: [] }
      }
      const mockSender = { tab: { id: 123, url: 'https://readmoo.com/library' } }
      const mockSendResponse = jest.fn()

      // 呼叫監聽器
      chromeMessageListener(mockMessage, mockSender, mockSendResponse)

      // 等待非同步處理完成
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert: 驗證 sendResponse 被呼叫且包含錯誤資訊
      expect(mockSendResponse).toHaveBeenCalled()
      const response = mockSendResponse.mock.calls[0][0]
      expect(response.success).toBe(false)
    })
  })

  describe('測試 3: EventCoordinator 未啟動偵測', () => {
    test('EventCoordinator 只 initialize 沒 start 時 EXTRACTION.COMPLETED 不會觸發儲存', async () => {
      // Arrange: 建立 EventCoordinator 但只做 initialize 不做 start
      const EventCoordinator = require('src/background/events/event-coordinator')
      const coordinator = new EventCoordinator()

      // 只 initialize，不 start（不註冊核心監聽器）
      await coordinator.initialize()

      const eventBus = coordinator.eventBusInstance
      expect(eventBus).toBeDefined()

      // Act: emit EXTRACTION.COMPLETED 事件
      await eventBus.emit('EXTRACTION.COMPLETED', {
        booksData: [{ id: '1', title: 'test', cover: 'url' }],
        count: 1
      })

      // Assert: chrome.storage.local.set 不應被呼叫
      // 因為核心監聽器（registerExtractionListeners）在 start() 中註冊
      expect(chrome.storage.local.set).not.toHaveBeenCalled()
    })
  })

  describe('測試 4: async listener 問題偵測', () => {
    test('chromeMessageListener 應同步回傳 true（非 Promise）', async () => {
      // Arrange: 建立 MessageRouter 以獲取 chromeMessageListener
      const MessageRouter = require('src/background/messaging/message-router')
      const router = new MessageRouter()

      await router.initialize()

      // 取得已註冊的 Chrome 訊息監聽器
      const listenerCalls = chrome.runtime.onMessage.addListener.mock.calls
      expect(listenerCalls.length).toBeGreaterThan(0)

      const chromeMessageListener = listenerCalls[0][0]

      // Act: 呼叫 listener
      const mockMessage = { type: 'PING' }
      const mockSender = {}
      const mockSendResponse = jest.fn()

      const returnValue = chromeMessageListener(mockMessage, mockSender, mockSendResponse)

      // Assert: 回傳值必須嚴格等於 true（不是 Promise）
      // Manifest V3 要求：listener 必須同步回傳 true 以保持訊息通道開啟
      expect(returnValue).toBe(true)
      expect(returnValue).not.toBeInstanceOf(Promise)
    })

    test('chromeMessageListener 回傳值不應是 Promise 型別', async () => {
      // 此測試確保開發者不會將 listener 改為 async function
      // async function 回傳 Promise，Chrome API 不會將 Promise 視為 true
      const MessageRouter = require('src/background/messaging/message-router')
      const router = new MessageRouter()

      await router.initialize()

      const listenerCalls = chrome.runtime.onMessage.addListener.mock.calls
      const chromeMessageListener = listenerCalls[0][0]

      // 驗證 listener 不是 async function
      // async function 的 constructor.name 為 'AsyncFunction'
      expect(chromeMessageListener.constructor.name).not.toBe('AsyncFunction')

      // 額外驗證：呼叫任何訊息都同步回傳 true
      const result = chromeMessageListener(
        { type: 'CONTENT.EVENT.FORWARD', eventType: 'TEST', data: {} },
        { tab: { id: 1 } },
        jest.fn()
      )
      expect(result).toBe(true)
    })
  })
})
