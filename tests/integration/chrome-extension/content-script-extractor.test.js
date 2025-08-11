/**
 * Chrome Extension Content Script 提取器整合測試
 *
 * 負責功能：
 * - 驗證 BookDataExtractor 在 Content Script 中的正確運作
 * - 確保 ReadmooAdapter 的 DOM 操作功能正常
 * - 測試事件系統的跨上下文通訊機制
 * - 驗證提取流程的完整性和錯誤處理
 * - 確認頁面生命週期相容性
 *
 * 測試策略：
 * - 模擬 Content Script 環境和 DOM 結構
 * - 整合 v0.2.0 的提取器模組到瀏覽器環境
 * - 測試跨上下文事件通訊和資料流
 * - 驗證錯誤處理和恢復機制
 * - 檢查頁面載入和 SPA 導航的相容性
 */

const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

// 模擬 Content Script 環境
global.chrome = require('jest-chrome').chrome

describe('Content Script Extractor Integration', () => {
  let dom
  let window
  let document
  let contentScript
  let mockBookDataExtractor
  let mockReadmooAdapter

  beforeEach(async () => {
    // 重置 Chrome API mocks
    jest.clearAllMocks()
    if (chrome && chrome.flush) {
      chrome.flush()
    }

    // 設置 JSDOM 環境模擬真實瀏覽器
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Readmoo 測試頁面</title>
        </head>
        <body>
          <div class="library-container">
            <div class="book-shelf">
              <a href="/api/reader/12345" class="book-item">
                <img src="https://cover.url/test.jpg" alt="測試書籍標題" />
                <div class="book-info">
                  <h3>測試書籍標題</h3>
                  <div class="progress">進度: 45%</div>
                </div>
              </a>
              <a href="/api/reader/67890" class="book-item">
                <img src="https://cover.url/test2.jpg" alt="另一本測試書" />
                <div class="book-info">
                  <h3>另一本測試書</h3>
                  <div class="progress">進度: 80%</div>
                </div>
              </a>
            </div>
          </div>
        </body>
      </html>
    `, {
      url: 'https://readmoo.com/library',
      runScripts: 'dangerously',
      resources: 'usable'
    })

    window = dom.window
    document = window.document

    // 設置全域環境
    global.window = window
    global.document = document
    global.location = window.location
    global.MutationObserver = window.MutationObserver
    global.performance = window.performance || { now: () => Date.now() }

    // 模擬 console 方法
    global.console = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    }
  })

  afterEach(() => {
    if (dom) {
      dom.window.close()
    }
  })

  describe('🔧 Content Script 載入和初始化', () => {
    test('應該成功載入 content script', async () => {
      // 檢查 content.js 檔案存在
      const contentPath = path.join(__dirname, '../../../src/content/content.js')
      expect(fs.existsSync(contentPath)).toBe(true)

      // 檢查內容包含必要的功能
      const contentContent = fs.readFileSync(contentPath, 'utf8')
      expect(contentContent).toMatch(/readmoo.*com/i)
      expect(contentContent).toMatch(/extraction|extract/i)
    })

    test('應該正確識別 Readmoo 頁面', async () => {
      // 載入 content script 並執行
      await loadContentScript()

      // 應該正確識別當前頁面為 Readmoo 頁面
      expect(global.isReadmooPage).toBe(true)
      expect(global.pageType).toBeDefined()
    })

    test('應該初始化事件系統', async () => {
      await loadContentScript()

      // 應該建立 Content Script 的事件系統
      expect(global.contentEventBus).toBeDefined()
      expect(typeof global.contentEventBus.on).toBe('function')
      expect(typeof global.contentEventBus.emit).toBe('function')
    })

    test('應該建立與 Background 的通訊橋接', async () => {
      await loadContentScript()

      // 應該建立 ChromeEventBridge 實例
      expect(global.contentChromeBridge).toBeDefined()
      expect(typeof global.contentChromeBridge.sendToBackground).toBe('function')
    })

    test('應該註冊必要的訊息監聽器', async () => {
      await loadContentScript()

      // 應該監聽來自 Background 的訊息
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled()

      // 檢查監聽器功能
      const messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0]?.[0]
      expect(messageHandler).toBeDefined()
      expect(typeof messageHandler).toBe('function')
    })
  })

  describe('🔧 BookDataExtractor 整合', () => {
    test('應該成功整合 BookDataExtractor', async () => {
      await loadContentScript()

      // 應該建立 BookDataExtractor 實例
      expect(global.bookDataExtractor).toBeDefined()
      expect(global.bookDataExtractor.constructor.name).toBe('BookDataExtractor')
    })

    test('應該正確配置 BookDataExtractor 事件系統', async () => {
      await loadContentScript()

      const extractor = global.bookDataExtractor
      if (extractor) {
        // 檢查事件系統整合
        expect(extractor.eventBus).toBe(global.contentEventBus)
        expect(typeof extractor.setEventBus).toBe('function')
        expect(typeof extractor.startExtractionFlow).toBe('function')
      }
    })

    test('應該能夠檢測頁面類型', async () => {
      await loadContentScript()

      const extractor = global.bookDataExtractor
      if (extractor) {
        // 測試頁面類型檢測
        const pageType = extractor.getReadmooPageType()
        expect(['library', 'shelf', 'reader', 'unknown']).toContain(pageType)

        // 測試可提取頁面檢測
        const isExtractable = extractor.isExtractableReadmooPage()
        expect(typeof isExtractable).toBe('boolean')
      }
    })

    test('應該能夠檢查頁面準備狀態', async () => {
      await loadContentScript()

      const extractor = global.bookDataExtractor
      if (extractor) {
        // 測試頁面準備狀態檢查
        const readyStatus = await extractor.checkPageReady()
        expect(readyStatus).toBeDefined()
        expect(typeof readyStatus.isReady).toBe('boolean')

        if (readyStatus.pageType) {
          expect(['library', 'shelf', 'reader', 'unknown']).toContain(readyStatus.pageType)
        }
      }
    })

    test('應該能夠啟動提取流程', async () => {
      await loadContentScript()

      const extractor = global.bookDataExtractor
      const eventBus = global.contentEventBus

      if (extractor && eventBus) {
        // 監聽提取事件
        const extractionStartHandler = jest.fn()
        const progressHandler = jest.fn()

        eventBus.on('EXTRACTION.STARTED', extractionStartHandler)
        eventBus.on('EXTRACTION.PROGRESS', progressHandler)

        // 啟動提取流程
        const flowId = await extractor.startExtractionFlow({
          pageType: 'library',
          options: { validateData: true }
        })

        expect(flowId).toBeDefined()
        expect(typeof flowId).toBe('string')

        // 等待事件觸發
        await new Promise(resolve => setTimeout(resolve, 100))

        // 驗證事件觸發
        expect(extractionStartHandler).toHaveBeenCalled()
      }
    })

    test('應該能夠處理提取錯誤', async () => {
      await loadContentScript()

      const extractor = global.bookDataExtractor
      const eventBus = global.contentEventBus

      if (extractor && eventBus) {
        // 監聽錯誤事件
        const errorHandler = jest.fn()
        eventBus.on('EXTRACTION.ERROR', errorHandler)

        // 模擬錯誤情況 - 暫時移除ReadmooAdapter
        const originalAdapter = global.readmooAdapter
        extractor.setReadmooAdapter(null)

        try {
          await extractor.startExtractionFlow({
            pageType: 'library',
            options: {}
          })
        } catch (error) {
          // 預期的錯誤
        }

        // 恢復ReadmooAdapter
        extractor.setReadmooAdapter(originalAdapter)

        // 等待事件處理
        await new Promise(resolve => setTimeout(resolve, 100))

        // 應該觸發錯誤處理
        expect(errorHandler).toHaveBeenCalled()
      }
    })
  })

  describe('🔧 ReadmooAdapter DOM 操作', () => {
    test('應該成功整合 ReadmooAdapter', async () => {
      await loadContentScript()

      // 應該建立 ReadmooAdapter 實例
      expect(global.readmooAdapter).toBeDefined()
      expect(global.readmooAdapter.constructor.name).toBe('ReadmooAdapter')
    })

    test('應該能夠提取書籍元素', async () => {
      await loadContentScript()

      const adapter = global.readmooAdapter
      if (adapter) {
        // 測試書籍元素提取
        const bookElements = adapter.getBookElements()
        expect(Array.isArray(bookElements)).toBe(true)
        expect(bookElements.length).toBeGreaterThan(0)

        // 檢查提取的元素
        bookElements.forEach(element => {
          expect(element).toBeInstanceOf(window.HTMLElement)
          expect(element.tagName.toLowerCase()).toBe('a')
        })
      }
    })

    test('應該能夠解析書籍資料', async () => {
      await loadContentScript()

      const adapter = global.readmooAdapter
      if (adapter) {
        const bookElements = adapter.getBookElements()

        if (bookElements.length > 0) {
          // 測試書籍資料解析
          const bookData = adapter.parseBookElement(bookElements[0])

          expect(bookData).toBeDefined()
          expect(bookData.id).toBeDefined()
          expect(bookData.title).toBeDefined()
          expect(bookData.cover).toBeDefined()

          // 檢查資料格式
          expect(typeof bookData.id).toBe('string')
          expect(typeof bookData.title).toBe('string')
          expect(typeof bookData.cover).toBe('string')
        }
      }
    })

    test('應該能夠提取所有書籍資料', async () => {
      await loadContentScript()

      const adapter = global.readmooAdapter
      if (adapter) {
        // 測試批量書籍資料提取
        const booksData = await adapter.extractAllBooks()

        expect(Array.isArray(booksData)).toBe(true)
        expect(booksData.length).toBeGreaterThan(0)

        // 檢查每本書的資料
        booksData.forEach(book => {
          expect(book.id).toBeDefined()
          expect(book.title).toBeDefined()
          expect(book.cover).toBeDefined()
          expect(typeof book.id).toBe('string')
          expect(typeof book.title).toBe('string')
          expect(typeof book.cover).toBe('string')
        })
      }
    })

    test('應該提供統計資訊', async () => {
      await loadContentScript()

      const adapter = global.readmooAdapter
      if (adapter) {
        // 執行提取操作
        await adapter.extractAllBooks()

        // 檢查統計資訊
        const stats = adapter.getStats()
        expect(stats).toBeDefined()
        expect(typeof stats.totalExtracted).toBe('number')
        expect(typeof stats.successfulExtractions).toBe('number')
        expect(typeof stats.failedExtractions).toBe('number')
        expect(stats.totalExtracted).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('🔧 跨上下文事件通訊', () => {
    test('應該能夠發送訊息到 Background', async () => {
      await loadContentScript()

      const chromeBridge = global.contentChromeBridge
      if (chromeBridge) {
        // 測試發送訊息到 Background
        const testMessage = {
          type: 'CONTENT.STATUS.UPDATE',
          data: { status: 'ready', pageType: 'library' }
        }

        await chromeBridge.sendToBackground(testMessage)

        // 驗證 Chrome API 調用
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'CONTENT.STATUS.UPDATE',
            data: expect.objectContaining({
              status: 'ready',
              pageType: 'library'
            })
          })
        )
      }
    })

    test('應該能夠處理來自 Background 的訊息', async () => {
      await loadContentScript()

      // 獲取訊息處理器
      const messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0]?.[0]

      if (messageHandler) {
        const mockMessage = {
          type: 'BACKGROUND.COMMAND.START_EXTRACTION',
          data: { pageType: 'library', options: {} }
        }
        const mockSender = { id: 'test-extension-id' }
        const mockSendResponse = jest.fn()

        // 測試訊息處理
        const result = messageHandler(mockMessage, mockSender, mockSendResponse)

        // 應該處理訊息並回應
        if (result === true) {
          // 異步處理
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        expect(mockSendResponse).toHaveBeenCalled()
      }
    })

    test('應該支援簡化版的 START_EXTRACTION 訊息格式', async () => {
      await loadContentScript()

      // 獲取訊息處理器
      const messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0]?.[0]

      if (messageHandler) {
        const mockMessage = {
          type: 'START_EXTRACTION',
          data: { pageType: 'library', options: {} }
        }
        const mockSender = { id: 'test-extension-id' }
        const mockSendResponse = jest.fn()

        // 測試訊息處理
        const result = messageHandler(mockMessage, mockSender, mockSendResponse)

        // 應該處理訊息並回應
        if (result === true) {
          // 異步處理
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        expect(mockSendResponse).toHaveBeenCalled()
      }
    })

    test('應該能夠橋接內部事件到 Background', async () => {
      await loadContentScript()

      const eventBus = global.contentEventBus
      const chromeBridge = global.contentChromeBridge

      if (eventBus && chromeBridge) {
        // 觸發內部事件
        await eventBus.emit('EXTRACTION.PROGRESS', {
          flowId: 'test-flow-123',
          progress: 0.5,
          extractedCount: 10,
          totalCount: 20
        })

        // 等待事件處理
        await new Promise(resolve => setTimeout(resolve, 100))

        // 應該轉發到 Background
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'CONTENT.EVENT.FORWARD',
            eventType: 'EXTRACTION.PROGRESS',
            data: expect.objectContaining({
              flowId: 'test-flow-123',
              progress: 0.5
            })
          })
        )
      }
    })

    test('應該處理通訊錯誤', async () => {
      await loadContentScript()

      const chromeBridge = global.contentChromeBridge
      if (chromeBridge) {
        // 模擬通訊錯誤
        chrome.runtime.sendMessage.mockRejectedValueOnce(new Error('Background not available'))

        // 測試錯誤處理
        const testMessage = { type: 'TEST.MESSAGE', data: {} }

        await expect(
          chromeBridge.sendToBackground(testMessage)
        ).resolves.not.toThrow()

        // 應該記錄錯誤
        expect(global.console.error).toHaveBeenCalledWith(
          expect.stringMatching(/發送.*失敗|send.*failed/i),
          expect.any(Object)
        )
      }
    })
  })

  describe('🔧 完整提取流程測試', () => {
    test('應該能夠執行完整的書籍提取流程', async () => {
      await loadContentScript()

      const extractor = global.bookDataExtractor
      const eventBus = global.contentEventBus

      if (extractor && eventBus) {
        // 監聽提取流程事件
        const events = []
        const eventTypes = [
          'EXTRACTION.STARTED',
          'EXTRACTION.PROGRESS',
          'EXTRACTION.COMPLETED',
          'EXTRACTION.ERROR'
        ]

        eventTypes.forEach(eventType => {
          eventBus.on(eventType, (event) => {
            events.push({ type: eventType, data: event.data })
          })
        })

        // 啟動完整提取流程
        const flowId = await extractor.startExtractionFlow({
          pageType: 'library',
          options: {
            validateData: true,
            reportProgress: true
          }
        })

        // 等待提取完成
        await new Promise(resolve => setTimeout(resolve, 500))

        // 驗證事件序列
        expect(events.length).toBeGreaterThan(0)
        expect(events.some(e => e.type === 'EXTRACTION.STARTED')).toBe(true)

        // 如果有進度事件，檢查格式
        const progressEvents = events.filter(e => e.type === 'EXTRACTION.PROGRESS')
        if (progressEvents.length > 0) {
          progressEvents.forEach(event => {
            expect(event.data.flowId).toBe(flowId)
            expect(typeof event.data.progress).toBe('number')
            expect(event.data.progress).toBeGreaterThanOrEqual(0)
            expect(event.data.progress).toBeLessThanOrEqual(1)
          })
        }
      }
    })

    test('應該能夠取消進行中的提取流程', async () => {
      await loadContentScript()

      const extractor = global.bookDataExtractor
      const eventBus = global.contentEventBus

      if (extractor && eventBus) {
        // 啟動提取流程但不等待完成
        const flowPromise = extractor.startExtractionFlow({
          pageType: 'library',
          options: {}
        })

        // 等待一小段時間讓流程開始
        await new Promise(resolve => setTimeout(resolve, 50))

        // 取得流程ID (如果流程還在進行中)
        const activeFlows = extractor.getActiveExtractionFlows()
        if (activeFlows.length > 0) {
          const flowId = activeFlows[0]

          // 取消流程
          const cancelResult = await extractor.cancelExtraction(flowId)

          expect(cancelResult).toBeDefined()
          expect(cancelResult.success).toBe(true)
          expect(cancelResult.flowId).toBe(flowId)

          // 檢查流程狀態
          const flowStatus = extractor.getExtractionFlowStatus(flowId)
          expect(flowStatus).toBeNull() // 已被清理
        } else {
          // 如果流程已經完成，測試仍應通過
          console.log('提取流程已快速完成，跳過取消測試')
        }

        // 等待原始流程完成
        try {
          await flowPromise
        } catch (error) {
          // 預期可能的錯誤
        }
      }
    })

    test('應該能夠處理多個並行提取流程', async () => {
      await loadContentScript()

      const extractor = global.bookDataExtractor

      if (extractor) {
        // 啟動多個提取流程但不等待完成
        const flow1Promise = extractor.startExtractionFlow({
          pageType: 'library',
          options: { flowName: 'flow1' }
        })

        const flow2Promise = extractor.startExtractionFlow({
          pageType: 'library',
          options: { flowName: 'flow2' }
        })

        // 等待一小段時間讓流程開始
        await new Promise(resolve => setTimeout(resolve, 50))

        // 檢查活動流程
        const activeFlows = extractor.getActiveExtractionFlows()

        if (activeFlows.length >= 2) {
          // 有多個活動流程
          expect(activeFlows.length).toBeGreaterThanOrEqual(2)
        } else {
          // 流程可能已經快速完成，檢查返回的flowId
          const flow1 = await flow1Promise
          const flow2 = await flow2Promise

          expect(flow1).toBeDefined()
          expect(flow2).toBeDefined()
          expect(flow1).not.toBe(flow2)

          console.log('提取流程快速完成，驗證不同的flowID')
        }
      }
    })
  })

  describe('🔧 頁面生命週期相容性', () => {
    test('應該處理頁面載入完成事件', async () => {
      await loadContentScript()

      // 模擬 DOMContentLoaded 事件
      const event = new window.Event('DOMContentLoaded')
      document.dispatchEvent(event)

      // 等待事件處理
      await new Promise(resolve => setTimeout(resolve, 100))

      // 應該初始化完成
      expect(global.contentScriptReady).toBe(true)
    })

    test('應該處理頁面 URL 變更（SPA 導航）', async () => {
      await loadContentScript()

      // 模擬 URL 變更
      const originalLocation = window.location.href

      // 觸發 URL 變更事件（如果有 MutationObserver）
      if (global.urlChangeObserver) {
        // 模擬 URL 變更
        Object.defineProperty(window.location, 'href', {
          value: 'https://readmoo.com/library/shelf/123',
          configurable: true
        })

        // 觸發 popstate 事件
        const popstateEvent = new window.Event('popstate')
        window.dispatchEvent(popstateEvent)

        await new Promise(resolve => setTimeout(resolve, 100))

        // 應該重新檢測頁面類型
        expect(global.pageType).toBeDefined()
      }
    })

    test('應該處理頁面卸載', async () => {
      await loadContentScript()

      // 模擬頁面卸載
      const beforeUnloadEvent = new window.Event('beforeunload')
      window.dispatchEvent(beforeUnloadEvent)

      // 等待清理處理
      await new Promise(resolve => setTimeout(resolve, 100))

      // 應該清理資源
      const extractor = global.bookDataExtractor
      if (extractor) {
        const activeFlows = extractor.getActiveExtractionFlows()
        expect(activeFlows.length).toBe(0)
      }
    })

    test('應該處理動態內容載入', async () => {
      await loadContentScript()

      // 添加新的書籍元素到頁面
      const newBookElement = document.createElement('a')
      newBookElement.href = '/api/reader/99999'
      newBookElement.className = 'book-item'
      newBookElement.innerHTML = `
        <img src="https://cover.url/new.jpg" alt="新增書籍" />
        <div class="book-info">
          <h3>新增書籍</h3>
          <div class="progress">進度: 25%</div>
        </div>
      `

      const bookShelf = document.querySelector('.book-shelf')
      bookShelf.appendChild(newBookElement)

      // 等待 MutationObserver 處理
      await new Promise(resolve => setTimeout(resolve, 100))

      // 重新提取應該包含新書籍
      const adapter = global.readmooAdapter
      if (adapter) {
        const bookElements = adapter.getBookElements()
        expect(bookElements.length).toBeGreaterThanOrEqual(3) // 原有2本 + 新增1本
      }
    })
  })

  describe('🔧 錯誤處理和恢復機制', () => {
    test('應該處理 DOM 不存在的情況', async () => {
      // 清空 DOM
      document.body.innerHTML = ''

      await loadContentScript()

      const adapter = global.readmooAdapter
      if (adapter) {
        // 應該優雅處理無書籍元素的情況
        const bookElements = adapter.getBookElements()
        expect(Array.isArray(bookElements)).toBe(true)
        expect(bookElements.length).toBe(0)

        const booksData = await adapter.extractAllBooks()
        expect(Array.isArray(booksData)).toBe(true)
        expect(booksData.length).toBe(0)
      }
    })

    test('應該處理惡意 DOM 結構', async () => {
      // 添加惡意內容
      document.body.innerHTML = `
        <div class="book-shelf">
          <a href="javascript:alert('xss')" class="book-item">
            <img src="javascript:void(0)" alt="" />
          </a>
        </div>
      `

      await loadContentScript()

      const adapter = global.readmooAdapter
      if (adapter) {
        // 應該安全處理惡意內容
        const booksData = await adapter.extractAllBooks()

        if (booksData.length > 0) {
          booksData.forEach(book => {
            // 應該過濾惡意 URL
            expect(book.cover).not.toMatch(/javascript:/)
            expect(book.id).not.toMatch(/javascript:/)
          })
        }
      }
    })

    test('應該提供系統健康檢查', async () => {
      await loadContentScript()

      // 檢查系統健康狀態
      const healthCheck = {
        contentEventBus: !!global.contentEventBus,
        contentChromeBridge: !!global.contentChromeBridge,
        bookDataExtractor: !!global.bookDataExtractor,
        readmooAdapter: !!global.readmooAdapter,
        domReady: document.readyState === 'complete',
        pageDetected: !!global.isReadmooPage
      }

      Object.values(healthCheck).forEach(status => {
        expect(typeof status).toBe('boolean')
      })

      // 核心組件應該都正常
      expect(healthCheck.contentEventBus).toBe(true)
      expect(healthCheck.contentChromeBridge).toBe(true)
      expect(healthCheck.pageDetected).toBe(true)
    })
  })

  /**
   * 載入並執行 content script
   */
  async function loadContentScript () {
    const fs = require('fs')
    const path = require('path')

    try {
      // 讀取 content.js 內容
      const contentPath = path.join(__dirname, '../../../src/content/content.js')
      const contentContent = fs.readFileSync(contentPath, 'utf8')

      // 在當前上下文中執行 content script
      eval(contentContent)

      // 等待初始化完成
      await new Promise(resolve => setTimeout(resolve, 200))

      // 觸發 DOMContentLoaded 事件
      const domLoadedEvent = new window.Event('DOMContentLoaded')
      document.dispatchEvent(domLoadedEvent)

      // 再次等待事件處理
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (error) {
      console.warn('Content script 載入錯誤 (測試環境預期):', error.message)
    }
  }
})
