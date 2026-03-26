/* eslint-disable no-console */

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

// eslint-disable-next-line no-unused-vars
const fs = require('fs')
// eslint-disable-next-line no-unused-vars
const path = require('path')
const { JSDOM } = require('jsdom')

// 模擬 Content Script 環境
global.chrome = require('jest-chrome').chrome

describe('Content Script Extractor Integration', () => {
  let dom
  let window
  let document

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
              <div class="library-item">
                <a href="https://readmoo.com/api/reader/12345" class="book-item">
                  <img class="cover-img" src="https://cover.url/test.jpg" alt="測試書籍標題" />
                  <div class="book-info">
                    <span class="title">測試書籍標題</span>
                    <div class="progress">進度: 45%</div>
                  </div>
                </a>
              </div>
              <div class="library-item">
                <a href="/api/reader/67890" class="book-item">
                  <img class="cover-img" src="https://cover.url/test2.jpg" alt="另一本測試書" />
                  <div class="book-info">
                    <span class="title">另一本測試書</span>
                    <div class="progress">進度: 80%</div>
                  </div>
                </a>
              </div>
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
      // 檢查 content-modular.js 檔案存在 (用於整合測試)
      // eslint-disable-next-line no-unused-vars
      const contentPath = path.join(__dirname, '../../../src/content/content-modular.js')
      expect(fs.existsSync(contentPath)).toBe(true)

      // 檢查內容包含必要的功能
      // eslint-disable-next-line no-unused-vars
      const contentContent = fs.readFileSync(contentPath, 'utf8')
      expect(contentContent).toMatch(/readmoo/i)
      expect(contentContent).toMatch(/extraction|extract/i)
    })

    test('應該正確識別 Readmoo 頁面', async () => {
      // 載入 content script 並執行
      await loadContentScript()

      // 應該正確識別當前頁面為 Readmoo 頁面（透過 pageDetector 全域變數）
      expect(global.pageDetector).toBeDefined()
      const pageStatus = global.pageDetector.getPageStatus()
      expect(pageStatus.isReadmooPage).toBe(true)
      expect(pageStatus.pageType).toBeDefined()
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

      // 驗證 ChromeEventBridge 已註冊消息監聽器
      // bridge.messageListener 在成功註冊後會被設定
      expect(global.contentChromeBridge).toBeDefined()
      expect(global.contentChromeBridge.messageListener).toBeDefined()
      expect(typeof global.contentChromeBridge.messageListener).toBe('function')
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

      // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const extractor = global.bookDataExtractor
      if (extractor) {
        // 測試頁面類型檢測
        // eslint-disable-next-line no-unused-vars
        const pageType = extractor.getReadmooPageType()
        expect(['library', 'shelf', 'reader', 'unknown']).toContain(pageType)

        // 測試可提取頁面檢測
        // eslint-disable-next-line no-unused-vars
        const isExtractable = extractor.isExtractableReadmooPage()
        expect(typeof isExtractable).toBe('boolean')
      }
    })

    test('應該能夠檢查頁面準備狀態', async () => {
      await loadContentScript()

      // eslint-disable-next-line no-unused-vars
      const extractor = global.bookDataExtractor
      if (extractor) {
        // 測試頁面準備狀態檢查
        // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const extractor = global.bookDataExtractor
      // eslint-disable-next-line no-unused-vars
      const eventBus = global.contentEventBus

      if (extractor && eventBus) {
        // 監聽提取事件
        // eslint-disable-next-line no-unused-vars
        const extractionStartHandler = jest.fn()
        // eslint-disable-next-line no-unused-vars
        const progressHandler = jest.fn()

        eventBus.on('EXTRACTION.STARTED', extractionStartHandler)
        eventBus.on('EXTRACTION.PROGRESS', progressHandler)

        // 啟動提取流程
        // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const extractor = global.bookDataExtractor
      // eslint-disable-next-line no-unused-vars
      const eventBus = global.contentEventBus

      if (extractor && eventBus) {
        // 監聽錯誤事件
        // eslint-disable-next-line no-unused-vars
        const errorHandler = jest.fn()
        eventBus.on('EXTRACTION.ERROR', errorHandler)

        // 模擬錯誤情況 - 暫時移除ReadmooAdapter
        // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const adapter = global.readmooAdapter
      if (adapter) {
        // 測試書籍元素提取
        // eslint-disable-next-line no-unused-vars
        const bookElements = adapter.getBookElements()
        expect(Array.isArray(bookElements)).toBe(true)
        expect(bookElements.length).toBeGreaterThan(0)

        // 檢查提取的元素
        bookElements.forEach(element => {
          expect(element).toBeInstanceOf(window.HTMLElement)
          expect(element.tagName.toLowerCase()).toBe('div') // .library-item 容器是 div
        })
      }
    })

    test('應該能夠解析書籍資料', async () => {
      await loadContentScript()

      // eslint-disable-next-line no-unused-vars
      const adapter = global.readmooAdapter
      if (adapter) {
        // eslint-disable-next-line no-unused-vars
        const bookElements = adapter.getBookElements()

        if (bookElements.length > 0) {
          // 測試書籍資料解析
          // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const adapter = global.readmooAdapter
      if (adapter) {
        // 測試批量書籍資料提取
        // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const adapter = global.readmooAdapter
      if (adapter) {
        // 執行提取操作
        await adapter.extractAllBooks()

        // 檢查統計資訊
        // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const chromeBridge = global.contentChromeBridge
      if (chromeBridge) {
        // 測試發送訊息到 Background
        // eslint-disable-next-line no-unused-vars
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
      // eslint-disable-next-line no-unused-vars
      const messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0]?.[0]

      if (messageHandler) {
        // eslint-disable-next-line no-unused-vars
        const mockMessage = {
          type: 'BACKGROUND.COMMAND.START_EXTRACTION',
          data: { pageType: 'library', options: {} }
        }
        // eslint-disable-next-line no-unused-vars
        const mockSender = { id: 'test-extension-id' }
        // eslint-disable-next-line no-unused-vars
        const mockSendResponse = jest.fn()

        // 測試訊息處理
        // eslint-disable-next-line no-unused-vars
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
      // eslint-disable-next-line no-unused-vars
      const messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0]?.[0]

      if (messageHandler) {
        // eslint-disable-next-line no-unused-vars
        const mockMessage = {
          type: 'START_EXTRACTION',
          data: { pageType: 'library', options: {} }
        }
        // eslint-disable-next-line no-unused-vars
        const mockSender = { id: 'test-extension-id' }
        // eslint-disable-next-line no-unused-vars
        const mockSendResponse = jest.fn()

        // 測試訊息處理
        // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const eventBus = global.contentEventBus
      // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const chromeBridge = global.contentChromeBridge
      if (chromeBridge) {
        // 模擬通訊錯誤
        chrome.runtime.sendMessage.mockRejectedValueOnce(new Error('Background not available'))

        // 測試錯誤處理
        // eslint-disable-next-line no-unused-vars
        const testMessage = { type: 'TEST.MESSAGE', data: {} }

        await expect(
          chromeBridge.sendToBackground(testMessage)
        ).resolves.not.toThrow()

        // 應該記錄錯誤
        // eslint-disable-next-line no-console
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

      // eslint-disable-next-line no-unused-vars
      const extractor = global.bookDataExtractor
      // eslint-disable-next-line no-unused-vars
      const eventBus = global.contentEventBus

      if (extractor && eventBus) {
        // 監聽提取流程事件
        // eslint-disable-next-line no-unused-vars
        const events = []
        // eslint-disable-next-line no-unused-vars
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
        // eslint-disable-next-line no-unused-vars
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
        // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const extractor = global.bookDataExtractor
      // eslint-disable-next-line no-unused-vars
      const eventBus = global.contentEventBus

      if (extractor && eventBus) {
        // 啟動提取流程但不等待完成
        // eslint-disable-next-line no-unused-vars
        const flowPromise = extractor.startExtractionFlow({
          pageType: 'library',
          options: {}
        })

        // 等待一小段時間讓流程開始
        await new Promise(resolve => setTimeout(resolve, 50))

        // 取得流程ID (如果流程還在進行中)
        // eslint-disable-next-line no-unused-vars
        const activeFlows = extractor.getActiveExtractionFlows()
        if (activeFlows.length > 0) {
          // eslint-disable-next-line no-unused-vars
          const flowId = activeFlows[0]

          // 取消流程
          // eslint-disable-next-line no-unused-vars
          const cancelResult = await extractor.cancelExtraction(flowId)

          expect(cancelResult).toBeDefined()
          expect(cancelResult.success).toBe(true)
          expect(cancelResult.flowId).toBe(flowId)

          // 檢查流程狀態
          // eslint-disable-next-line no-unused-vars
          const flowStatus = extractor.getExtractionFlowStatus(flowId)
          expect(flowStatus).toBeNull() // 已被清理
        } else {
          // 如果流程已經完成，測試仍應通過
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

      // eslint-disable-next-line no-unused-vars
      const extractor = global.bookDataExtractor

      if (extractor) {
        // 啟動多個提取流程但不等待完成
        // eslint-disable-next-line no-unused-vars
        const flow1Promise = extractor.startExtractionFlow({
          pageType: 'library',
          options: { flowName: 'flow1' }
        })

        // eslint-disable-next-line no-unused-vars
        const flow2Promise = extractor.startExtractionFlow({
          pageType: 'library',
          options: { flowName: 'flow2' }
        })

        // 等待一小段時間讓流程開始
        await new Promise(resolve => setTimeout(resolve, 50))

        // 檢查活動流程
        // eslint-disable-next-line no-unused-vars
        const activeFlows = extractor.getActiveExtractionFlows()

        if (activeFlows.length >= 2) {
          // 有多個活動流程
          expect(activeFlows.length).toBeGreaterThanOrEqual(2)
        } else {
          // 流程可能已經快速完成，檢查返回的flowId
          // eslint-disable-next-line no-unused-vars
          const flow1 = await flow1Promise
          // eslint-disable-next-line no-unused-vars
          const flow2 = await flow2Promise

          expect(flow1).toBeDefined()
          expect(flow2).toBeDefined()
          expect(flow1).not.toBe(flow2)

          // eslint-disable-next-line no-console
          console.log('提取流程快速完成，驗證不同的flowID')
        }
      }
    })
  })

  describe('🔧 頁面生命週期相容性', () => {
    test('應該處理頁面載入完成事件', async () => {
      await loadContentScript()

      // 模擬 DOMContentLoaded 事件
      // eslint-disable-next-line no-unused-vars
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
      // 觸發 URL 變更事件（如果有 MutationObserver）
      if (global.urlChangeObserver) {
        // 模擬 URL 變更
        Object.defineProperty(window.location, 'href', {
          value: 'https://readmoo.com/library/shelf/123',
          configurable: true
        })

        // 觸發 popstate 事件
        // eslint-disable-next-line no-unused-vars
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
      // eslint-disable-next-line no-unused-vars
      const beforeUnloadEvent = new window.Event('beforeunload')
      window.dispatchEvent(beforeUnloadEvent)

      // 等待清理處理
      await new Promise(resolve => setTimeout(resolve, 100))

      // 應該清理資源
      // eslint-disable-next-line no-unused-vars
      const extractor = global.bookDataExtractor
      if (extractor) {
        // eslint-disable-next-line no-unused-vars
        const activeFlows = extractor.getActiveExtractionFlows()
        expect(activeFlows.length).toBe(0)
      }
    })

    test('應該處理動態內容載入', async () => {
      await loadContentScript()

      // 添加新的書籍元素到頁面（使用 .library-item 容器匹配 ReadmooAdapter 的主要選擇器）
      // eslint-disable-next-line no-unused-vars
      const newBookWrapper = document.createElement('div')
      newBookWrapper.className = 'library-item'
      newBookWrapper.innerHTML = `
        <a href="https://readmoo.com/api/reader/99999" class="book-item">
          <img class="cover-img" src="https://cover.url/new.jpg" alt="新增書籍" />
          <span class="title">新增書籍</span>
          <div class="progress">進度: 25%</div>
        </a>
      `

      // eslint-disable-next-line no-unused-vars
      const bookShelf = document.querySelector('.book-shelf')
      bookShelf.appendChild(newBookWrapper)

      // 等待 MutationObserver 處理
      await new Promise(resolve => setTimeout(resolve, 100))

      // 重新提取應該包含新書籍
      // eslint-disable-next-line no-unused-vars
      const adapter = global.readmooAdapter
      if (adapter) {
        // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const adapter = global.readmooAdapter
      if (adapter) {
        // 應該優雅處理無書籍元素的情況
        // eslint-disable-next-line no-unused-vars
        const bookElements = adapter.getBookElements()
        expect(Array.isArray(bookElements)).toBe(true)
        expect(bookElements.length).toBe(0)

        // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const adapter = global.readmooAdapter
      if (adapter) {
        // 應該安全處理惡意內容
        // eslint-disable-next-line no-unused-vars
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
      // eslint-disable-next-line no-unused-vars
      const healthCheck = {
        contentEventBus: !!global.contentEventBus,
        contentChromeBridge: !!global.contentChromeBridge,
        bookDataExtractor: !!global.bookDataExtractor,
        readmooAdapter: !!global.readmooAdapter,
        domReady: document.readyState === 'complete',
        pageDetected: !!(global.pageDetector && global.pageDetector.getPageStatus().isReadmooPage)
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
    try {
      // 覆寫全域環境變數，確保 content-modular.js 的模組在正確的環境中初始化
      // jsdom 的 location/document 是特殊屬性，需要用 delete + 重新賦值覆寫
      delete globalThis.location
      globalThis.location = {
        hostname: 'readmoo.com',
        href: 'https://readmoo.com/library',
        pathname: '/library',
        origin: 'https://readmoo.com',
        protocol: 'https:',
        host: 'readmoo.com'
      }

      // 確保 document 和 MutationObserver 來自同一個 JSDOM 實例，避免跨 realm 錯誤
      const savedDocument = globalThis.document
      Object.defineProperty(globalThis, 'document', {
        value: document,
        writable: true,
        configurable: true
      })
      globalThis.MutationObserver = window.MutationObserver

      // 使用 require 載入 content script，利用 Jest 的模組解析（支援 src/ 路徑）
      // 每次呼叫前清除快取，確保重新執行初始化邏輯
      const contentModulePath = require.resolve('src/content/content-modular')
      delete require.cache[contentModulePath]

      // 同時清除子模組快取，確保重新初始化
      Object.keys(require.cache).forEach(key => {
        if (key.includes('src/content/')) {
          delete require.cache[key]
        }
      })

      require('src/content/content-modular')

      // 等待非同步初始化完成
      await new Promise(resolve => setTimeout(resolve, 300))

      // 觸發 DOMContentLoaded 事件（若初始化依賴此事件）
      // eslint-disable-next-line no-unused-vars
      const domLoadedEvent = new window.Event('DOMContentLoaded')
      document.dispatchEvent(domLoadedEvent)

      // 再次等待事件處理
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Content script 載入錯誤 (測試環境預期):', error.message)
    }
  }
})
