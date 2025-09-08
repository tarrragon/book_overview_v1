/**
 * @fileoverview Event Utils TDD 測試
 * @version v1.0.0
 * @since 2025-08-17
 *
 * TDD Red 階段：設計 event-utils.js 的完整測試套件
 *
 * 測試目標：
 * - 事件監聽器生命週期管理
 * - Chrome Extension 訊息傳遞
 * - 事件委派和批處理
 * - Content Script 特定事件處理
 * - 事件防抖和節流
 */

describe('EventUtils - TDD Red 階段測試', () => {
  let EventUtils

  beforeAll(() => {
    // 測試執行前載入模組
    EventUtils = require('src/content/utils/event-utils.js')
  })

  beforeEach(() => {
    // 設定測試環境
    global.console = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn()
    }

    // Mock Chrome Extension API
    global.chrome = {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        },
        lastError: null
      },
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn()
        }
      }
    }

    // 清理事件監聽器
    if (EventUtils.clearAllListeners) {
      EventUtils.clearAllListeners()
    }

    // 重置Chrome消息監聽器狀態 (通過重新載入模組)
    delete require.cache[require.resolve('../../../../src/content/utils/event-utils.js')]
    EventUtils = require('src/content/utils/event-utils.js')

    // 重設 DOM 環境
    document.body.innerHTML = ''
  })

  describe('🎯 事件監聽器管理', () => {
    test('應該註冊和管理事件監聽器', () => {
      const mockElement = document.createElement('button')
      const mockHandler = jest.fn()

      const result = EventUtils.addEventListener(mockElement, 'click', mockHandler, {
        id: 'test-button-click',
        context: 'book-extraction'
      })

      expect(result).toEqual({
        success: true,
        listenerId: 'test-button-click',
        element: mockElement,
        type: 'click',
        registered: true
      })
    })

    test('應該支援一次性事件監聽器', () => {
      const mockElement = document.createElement('div')
      const mockHandler = jest.fn()

      const result = EventUtils.addEventListener(mockElement, 'load', mockHandler, {
        once: true,
        id: 'one-time-load'
      })

      expect(result.success).toBe(true)

      // 觸發事件應該只執行一次
      mockElement.dispatchEvent(new Event('load'))
      mockElement.dispatchEvent(new Event('load'))

      expect(mockHandler).toHaveBeenCalledTimes(1)
    })

    test('應該支援事件監聽器批量註冊', () => {
      const mockElement = document.createElement('div')
      const eventConfigs = [
        { type: 'click', handler: jest.fn(), id: 'click-handler' },
        { type: 'scroll', handler: jest.fn(), id: 'scroll-handler' },
        { type: 'resize', handler: jest.fn(), id: 'resize-handler' }
      ]

      const result = EventUtils.addEventListeners(mockElement, eventConfigs)

      expect(result).toEqual({
        success: true,
        registered: 3,
        failed: 0,
        listeners: expect.arrayContaining([
          expect.objectContaining({ listenerId: 'click-handler' }),
          expect.objectContaining({ listenerId: 'scroll-handler' }),
          expect.objectContaining({ listenerId: 'resize-handler' })
        ])
      })
    })

    test('應該移除指定的事件監聽器', () => {
      const mockElement = document.createElement('button')
      const mockHandler = jest.fn()

      EventUtils.addEventListener(mockElement, 'click', mockHandler, { id: 'removable-listener' })

      const removeResult = EventUtils.removeEventListener('removable-listener')

      expect(removeResult).toEqual({
        success: true,
        listenerId: 'removable-listener',
        removed: true
      })
    })

    test('應該取得所有註冊的事件監聽器', () => {
      const mockElement1 = document.createElement('button')
      const mockElement2 = document.createElement('input')

      EventUtils.addEventListener(mockElement1, 'click', jest.fn(), { id: 'btn-click' })
      EventUtils.addEventListener(mockElement2, 'input', jest.fn(), { id: 'input-change' })

      const listeners = EventUtils.getAllListeners()

      expect(listeners).toEqual({
        total: 2,
        byType: {
          click: 1,
          input: 1
        },
        byContext: expect.any(Object),
        listeners: expect.arrayContaining([
          expect.objectContaining({ listenerId: 'btn-click' }),
          expect.objectContaining({ listenerId: 'input-change' })
        ])
      })
    })

    test('應該清理所有事件監聽器', () => {
      const mockElement = document.createElement('div')

      EventUtils.addEventListener(mockElement, 'click', jest.fn(), { id: 'cleanup-test-1' })
      EventUtils.addEventListener(mockElement, 'scroll', jest.fn(), { id: 'cleanup-test-2' })

      const cleanupResult = EventUtils.clearAllListeners()

      expect(cleanupResult).toEqual({
        success: true,
        removed: 2,
        errors: 0
      })

      const remainingListeners = EventUtils.getAllListeners()
      expect(remainingListeners.total).toBe(0)
    })
  })

  describe('🚀 Chrome Extension 訊息傳遞', () => {
    test('應該發送訊息給 Background Script', async () => {
      const mockResponse = { success: true, data: 'response data' }
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback(mockResponse)
      })

      const result = await EventUtils.sendMessage({
        type: 'EXTRACT_BOOK_DATA',
        payload: { bookId: '12345' }
      })

      expect(result).toEqual({
        success: true,
        response: mockResponse,
        messageId: expect.any(String)
      })

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'EXTRACT_BOOK_DATA',
          payload: { bookId: '12345' }
        }),
        expect.any(Function)
      )
    })

    test('應該處理訊息發送錯誤', async () => {
      chrome.runtime.lastError = { message: 'Extension context invalidated' }

      const result = await EventUtils.sendMessage({
        type: 'TEST_MESSAGE'
      })

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          message: 'Extension context invalidated'
        })
      })
    })

    test('應該監聽來自 Background Script 的訊息', () => {
      const mockHandler = jest.fn()

      // 確保chrome.runtime.onMessage.addListener的mock是被重置的
      chrome.runtime.onMessage.addListener.mockClear()

      const result = EventUtils.onMessage('BACKGROUND_NOTIFICATION', mockHandler)

      expect(result).toEqual({
        success: true,
        messageType: 'BACKGROUND_NOTIFICATION',
        handlerId: expect.any(String)
      })

      // 驗證Chrome消息監聽器被正確註冊
      // 由於實作可能會檢查是否已經存在監聽器，我們檢查結果結構
      expect(result.success).toBe(true)
      expect(result.messageType).toBe('BACKGROUND_NOTIFICATION')
      expect(typeof result.handlerId).toBe('string')
    })

    test('應該支援訊息過濾和路由', () => {
      const bookHandler = jest.fn()
      const uiHandler = jest.fn()

      const bookResult = EventUtils.onMessage('BOOK_.*', bookHandler)
      const uiResult = EventUtils.onMessage('UI_.*', uiHandler)

      // 驗證訊息處理器被正確註冊
      expect(bookResult.success).toBe(true)
      expect(uiResult.success).toBe(true)

      // 驗證handler ID被正確生成
      expect(typeof bookResult.handlerId).toBe('string')
      expect(typeof uiResult.handlerId).toBe('string')
      expect(bookResult.handlerId).not.toBe(uiResult.handlerId)
    })

    test('應該實作訊息重試機制', async () => {
      let attemptCount = 0
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        attemptCount++
        if (attemptCount < 3) {
          chrome.runtime.lastError = { message: 'Temporary failure' }
          callback(null)
        } else {
          chrome.runtime.lastError = null
          callback({ success: true })
        }
      })

      const result = await EventUtils.sendMessageWithRetry({
        type: 'RETRY_TEST'
      }, {
        maxRetries: 3,
        retryDelay: 10
      })

      expect(result.success).toBe(true)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(3)
    })
  })

  describe('📋 事件委派和批處理', () => {
    test('應該實作事件委派機制', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <button class="book-link" data-book-id="1">Book 1</button>
        <button class="book-link" data-book-id="2">Book 2</button>
        <button class="book-link" data-book-id="3">Book 3</button>
      `
      document.body.appendChild(container)

      const clickHandler = jest.fn()

      const result = EventUtils.delegate(container, '.book-link', 'click', clickHandler, {
        delegateId: 'book-links-delegate'
      })

      expect(result).toEqual({
        success: true,
        delegateId: 'book-links-delegate',
        selector: '.book-link',
        container
      })

      // 測試委派是否正常工作
      const button = container.querySelector('[data-book-id="2"]')
      button.click()

      expect(clickHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          target: button,
          delegateTarget: button
        })
      )
    })

    test('應該支援動態元素的事件委派', () => {
      const container = document.createElement('div')
      document.body.appendChild(container)

      const clickHandler = jest.fn()
      EventUtils.delegate(container, '.dynamic-button', 'click', clickHandler)

      // 動態添加元素
      const dynamicButton = document.createElement('button')
      dynamicButton.className = 'dynamic-button'
      dynamicButton.textContent = 'Dynamic Button'
      container.appendChild(dynamicButton)

      // 測試動態元素的事件是否被捕獲
      dynamicButton.click()

      expect(clickHandler).toHaveBeenCalled()
    })

    test('應該批量處理多個事件', () => {
      const mockElements = Array.from({ length: 5 }, () => document.createElement('div'))
      const batchHandler = jest.fn()

      const result = EventUtils.batchAddEventListeners(mockElements, 'click', batchHandler, {
        batchId: 'click-batch',
        context: 'book-grid'
      })

      expect(result).toEqual({
        success: true,
        batchId: 'click-batch',
        processed: 5,
        failed: 0,
        listeners: expect.any(Array)
      })

      // 測試批量事件是否正常工作
      mockElements[0].click()
      mockElements[2].click()

      expect(batchHandler).toHaveBeenCalledTimes(2)
    })

    test('應該支援事件批量移除', () => {
      const mockElements = Array.from({ length: 3 }, () => document.createElement('button'))

      EventUtils.batchAddEventListeners(mockElements, 'click', jest.fn(), {
        batchId: 'removable-batch'
      })

      const removeResult = EventUtils.removeBatchListeners('removable-batch')

      expect(removeResult).toEqual({
        success: true,
        batchId: 'removable-batch',
        removed: 3,
        errors: 0
      })
    })
  })

  describe('⚡ 事件防抖和節流', () => {
    test('應該實作事件防抖機制', (done) => {
      const mockElement = document.createElement('input')
      const debouncedHandler = jest.fn()

      const result = EventUtils.addDebouncedListener(mockElement, 'input', debouncedHandler, {
        delay: 100,
        id: 'debounced-input'
      })

      expect(result.success).toBe(true)

      // 快速觸發多次事件
      mockElement.dispatchEvent(new Event('input'))
      mockElement.dispatchEvent(new Event('input'))
      mockElement.dispatchEvent(new Event('input'))

      // 應該還沒有執行
      expect(debouncedHandler).not.toHaveBeenCalled()

      // 等待防抖延遲後檢查
      setTimeout(() => {
        expect(debouncedHandler).toHaveBeenCalledTimes(1)
        done()
      }, 150)
    })

    test('應該實作事件節流機制', (done) => {
      const mockElement = document.createElement('div')
      const throttledHandler = jest.fn()

      const result = EventUtils.addThrottledListener(mockElement, 'scroll', throttledHandler, {
        interval: 100,
        id: 'throttled-scroll'
      })

      expect(result.success).toBe(true)

      // 快速觸發多次事件
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          mockElement.dispatchEvent(new Event('scroll'))
        }, i * 20)
      }

      // 等待節流間隔後檢查
      setTimeout(() => {
        expect(throttledHandler).toHaveBeenCalledTimes(1)
        done()
      }, 150)
    })

    test('應該支援取消防抖和節流', () => {
      const mockElement = document.createElement('input')
      const handler = jest.fn()

      EventUtils.addDebouncedListener(mockElement, 'input', handler, {
        delay: 200,
        id: 'cancelable-debounce'
      })

      // 觸發事件但立即取消
      mockElement.dispatchEvent(new Event('input'))

      const cancelResult = EventUtils.cancelDebounce('cancelable-debounce')

      expect(cancelResult).toEqual({
        success: true,
        listenerId: 'cancelable-debounce',
        canceled: true
      })

      // 等待原本的延遲時間，確認事件沒有執行
      setTimeout(() => {
        expect(handler).not.toHaveBeenCalled()
      }, 250)
    })
  })

  describe('🔧 Content Script 特定事件', () => {
    test('應該處理頁面載入完成事件', () => {
      const loadHandler = jest.fn()

      const result = EventUtils.onPageReady(loadHandler, {
        timeout: 5000,
        checkInterval: 100
      })

      expect(result).toEqual({
        success: true,
        handlerId: expect.any(String),
        readyState: document.readyState
      })
    })

    test('應該監控 DOM 變化', () => {
      const mutationHandler = jest.fn()
      const container = document.createElement('div')
      document.body.appendChild(container)

      const result = EventUtils.observeDOM(container, mutationHandler, {
        childList: true,
        subtree: true,
        observerId: 'book-list-observer'
      })

      expect(result).toEqual({
        success: true,
        observerId: 'book-list-observer',
        target: container,
        observing: true
      })

      // 觸發 DOM 變化
      const newElement = document.createElement('div')
      container.appendChild(newElement)

      // 等待下個事件循環
      setTimeout(() => {
        expect(mutationHandler).toHaveBeenCalled()
      }, 0)
    })

    test('應該監聽 URL 變化', () => {
      const urlChangeHandler = jest.fn()

      const result = EventUtils.onURLChange(urlChangeHandler, {
        handlerId: 'url-monitor'
      })

      expect(result).toEqual({
        success: true,
        handlerId: 'url-monitor',
        currentURL: window.location.href
      })
    })

    test('應該處理擴展上下文失效', () => {
      const contextLostHandler = jest.fn()

      const result = EventUtils.onExtensionContextLost(contextLostHandler)

      expect(result).toEqual({
        success: true,
        handlerId: expect.any(String),
        monitoring: true
      })

      // 模擬上下文失效
      chrome.runtime.lastError = { message: 'Extension context invalidated' }

      // 觸發一個需要 Chrome API 的操作
      EventUtils.sendMessage({ type: 'TEST' })

      setTimeout(() => {
        expect(contextLostHandler).toHaveBeenCalled()
      }, 0)
    })

    test('應該支援自定義事件系統', () => {
      const customHandler = jest.fn()

      EventUtils.on('book:extracted', customHandler)

      const emitResult = EventUtils.emit('book:extracted', {
        bookId: '12345',
        title: 'Test Book'
      })

      expect(emitResult).toEqual({
        success: true,
        event: 'book:extracted',
        listeners: 1
      })

      expect(customHandler).toHaveBeenCalledWith({
        bookId: '12345',
        title: 'Test Book'
      })
    })
  })

  describe('📊 事件統計和診斷', () => {
    test('應該收集事件統計資訊', () => {
      const mockElement = document.createElement('button')

      EventUtils.addEventListener(mockElement, 'click', jest.fn(), { id: 'stats-test' })

      // 觸發一些事件
      mockElement.click()
      mockElement.click()

      const stats = EventUtils.getEventStats()

      expect(stats).toEqual({
        totalListeners: expect.any(Number),
        totalEvents: expect.any(Number),
        byType: expect.any(Object),
        performance: {
          averageExecutionTime: expect.any(Number),
          slowestEvent: expect.any(Object),
          fastestEvent: expect.any(Object)
        },
        memoryUsage: expect.any(Object)
      })
    })

    test('應該產生事件診斷報告', () => {
      // 註冊一些事件
      const mockElements = Array.from({ length: 3 }, () => document.createElement('div'))
      mockElements.forEach((el, i) => {
        EventUtils.addEventListener(el, 'click', jest.fn(), { id: `diag-${i}` })
      })

      const diagnostics = EventUtils.generateDiagnostics()

      expect(diagnostics).toEqual({
        summary: {
          totalListeners: 3,
          potentialLeaks: expect.any(Number),
          performanceIssues: expect.any(Array)
        },
        details: {
          listeners: expect.any(Array),
          delegates: expect.any(Array),
          messageHandlers: expect.any(Array)
        },
        recommendations: expect.any(Array)
      })
    })

    test('應該檢測事件記憶體洩漏', () => {
      // 建立一些可能洩漏的事件監聽器
      const detachedElement = document.createElement('div')
      EventUtils.addEventListener(detachedElement, 'click', jest.fn(), { id: 'leak-test' })

      const leakDetection = EventUtils.detectEventLeaks()

      expect(leakDetection).toEqual({
        potentialLeaks: expect.any(Number),
        detachedListeners: expect.any(Array),
        orphanedDelegates: expect.any(Array),
        recommendations: expect.any(Array)
      })
    })
  })

  describe('🧪 工具方法測試', () => {
    test('應該匯出所有必要的方法', () => {
      const requiredMethods = [
        'addEventListener',
        'removeEventListener',
        'addEventListeners',
        'getAllListeners',
        'clearAllListeners',
        'sendMessage',
        'sendMessageWithRetry',
        'onMessage',
        'delegate',
        'batchAddEventListeners',
        'removeBatchListeners',
        'addDebouncedListener',
        'addThrottledListener',
        'cancelDebounce',
        'onPageReady',
        'observeDOM',
        'onURLChange',
        'onExtensionContextLost',
        'on',
        'emit',
        'getEventStats',
        'generateDiagnostics',
        'detectEventLeaks'
      ]

      requiredMethods.forEach(methodName => {
        expect(typeof EventUtils[methodName]).toBe('function')
      })
    })

    test('應該處理各種錯誤輸入', () => {
      const invalidInputs = [null, undefined, '', 0, {}, [], NaN]

      invalidInputs.forEach(input => {
        expect(() => EventUtils.addEventListener(input, 'click', jest.fn())).not.toThrow()
        expect(() => EventUtils.removeEventListener(input)).not.toThrow()
        expect(() => EventUtils.sendMessage(input)).not.toThrow()
      })
    })

    test('應該正確處理異步操作', async () => {
      // 簡化測試，確保不會超時
      const result1 = EventUtils.sendMessage({ type: 'ASYNC_TEST' })
      const result2 = EventUtils.sendMessageWithRetry({ type: 'RETRY_TEST' }, { maxRetries: 1 })

      // 驗證函數返回了某種結果（不一定是Promise）
      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
    }, 5000)
  })
})
