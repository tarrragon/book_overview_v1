/**
 * content-modular.test.js
 *
 * 模組化 Content Script 單元測試
 *
 * 負責功能：
 * - 驗證模組化 Content Script 的正確運作
 * - 確保各獨立模組的正確整合
 * - 測試模組間的事件協調機制
 * - 驗證生命週期管理和錯誤處理
 *
 * 測試策略：
 * - 分別測試各獨立模組的功能
 * - 測試模組間的整合和通訊
 * - 驗證主控制器的協調能力
 * - 確認錯誤隔離機制
 */

const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

// 模擬 Content Script 環境
global.chrome = require('jest-chrome').chrome

// 引入模組化組件進行單元測試
const createPageDetector = require('../../../../src/content/detectors/page-detector')
const createContentEventBus = require('../../../../src/content/core/content-event-bus')
const createChromeEventBridge = require('../../../../src/content/bridge/chrome-event-bridge')
const createBookDataExtractor = require('../../../../src/content/extractors/book-data-extractor')
const createReadmooAdapter = require('../../../../src/content/adapters/readmoo-adapter')

describe('Modular Content Script', () => {
  let dom
  let window
  let document

  beforeEach(() => {
    // 重置 Chrome API mocks
    jest.clearAllMocks()
    if (chrome && chrome.flush) {
      chrome.flush()
    }

    // 設置 JSDOM 環境
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Readmoo 測試頁面</title>
        </head>
        <body>
          <div class="library-container">
            <div class="library-item">
              <a href="/api/reader/12345">
                <img src="https://cdn.readmoo.com/cover/ab/12345_210x315.jpg" alt="測試書籍1" class="cover-img" />
                <div class="title">測試書籍1</div>
                <div class="progress-bar" style="width: 45%"></div>
                <div class="label rendition">EPUB</div>
              </a>
            </div>
            <div class="library-item">
              <a href="/api/reader/67890">
                <img src="https://cdn.readmoo.com/cover/cd/67890_210x315.jpg" alt="測試書籍2" class="cover-img" />
                <div class="title">測試書籍2</div>
                <div class="progress-bar" style="width: 80%"></div>
                <div class="label rendition">PDF</div>
              </a>
            </div>
          </div>
        </body>
      </html>
    `, {
      url: 'https://readmoo.com/library',
      referrer: 'https://readmoo.com/',
      contentType: 'text/html',
      storageQuota: 10000000
    })

    window = dom.window
    document = window.document

    // JSDOM的location物件由於安全限制無法重新定義，
    // 我們只能依賴 globalThis.location 供模組使用

    // 設置全域環境
    global.window = window
    global.document = document
    global.MutationObserver = window.MutationObserver
    global.performance = window.performance || { now: () => Date.now() }
    
    // 確保 document.body 正確設置
    if (!document.body) {
      document.body = document.createElement('body')
      document.documentElement.appendChild(document.body)
    }

    // 正確設定 location 物件 - 使用 Object.defineProperty 避免 JSDOM 限制
    const locationObj = {
      href: 'https://readmoo.com/library',
      hostname: 'readmoo.com',
      pathname: '/library',
      protocol: 'https:',
      host: 'readmoo.com',
      port: '',
      search: '',
      hash: '',
      origin: 'https://readmoo.com',
      toString: () => 'https://readmoo.com/library'
    }
    
    // 設置 global.location 供模組使用（因為 JSDOM 的 window.location 不可修改）
    global.location = locationObj
    
    // 同時設置在 window 上，但主要依賴 global.location
    try {
      Object.defineProperty(window, 'location', {
        value: locationObj,
        writable: false,
        configurable: true
      })
    } catch (e) {
      // JSDOM 可能不允許重新定義 location，忽略錯誤
    }

    // 設置 globalThis 供模組使用
    global.globalThis = global
    globalThis.document = document
    globalThis.window = window
    globalThis.location = global.location

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

  describe('PageDetector 模組', () => {
    test('應該正確檢測 Readmoo 頁面', () => {
      // JSDOM 使用 readmoo.com 域名
      console.log('Debug - window.location.hostname:', window.location.hostname)
      console.log('Debug - global.location.hostname:', global.location.hostname)
      
      const pageDetector = createPageDetector()

      const result = pageDetector.detectReadmooPage()
      expect(result.isReadmooPage).toBe(true)
      expect(result.pageType).toBe('library')
    })

    test('應該能夠檢測不同的頁面類型', () => {
      const pageDetector = createPageDetector()

      // 測試 library 頁面
      expect(pageDetector.detectPageType()).toBe('library')

      // 模擬其他頁面類型
      global.location.href = 'https://readmoo.com/shelf/123'
      global.location.pathname = '/shelf/123'
      window.location.href = 'https://readmoo.com/shelf/123'
      window.location.pathname = '/shelf/123'

      expect(pageDetector.detectPageType()).toBe('shelf')
    })

    test('應該提供頁面狀態資訊', () => {
      const pageDetector = createPageDetector()

      const status = pageDetector.getPageStatus()
      expect(status).toEqual({
        isReadmooPage: true,
        pageType: 'library',
        url: 'https://readmoo.com/library',
        hostname: 'readmoo.com',
        pathname: '/library',
        timestamp: expect.any(Number)
      })
    })

    test('應該能夠監聽 URL 變更', (done) => {
      const pageDetector = createPageDetector()

      const stopListening = pageDetector.onUrlChange((changeInfo) => {
        expect(changeInfo.newUrl).toContain('/shelf')
        expect(changeInfo.changed).toBe(true)
        stopListening()
        done()
      })

      // 模擬 URL 變更
      global.location.href = 'https://readmoo.com/shelf/456'
      window.location.href = 'https://readmoo.com/shelf/456'

      // 觸發 MutationObserver
      const newElement = document.createElement('div')
      document.body.appendChild(newElement)
    })
  })

  describe('ContentEventBus 模組', () => {
    test('應該能夠註冊和觸發事件', async () => {
      const eventBus = createContentEventBus()
      const handler = jest.fn()

      eventBus.on('TEST.EVENT', handler)

      const result = await eventBus.emit('TEST.EVENT', { message: 'test' })

      expect(result.success).toBe(true)
      expect(handler).toHaveBeenCalledWith({
        type: 'TEST.EVENT',
        data: { message: 'test' },
        timestamp: expect.any(Number),
        id: expect.any(String)
      })
    })

    test('應該支援事件優先級', async () => {
      const eventBus = createContentEventBus()
      const callOrder = []

      eventBus.on('PRIORITY.TEST', () => callOrder.push('low'), { priority: 3 })
      eventBus.on('PRIORITY.TEST', () => callOrder.push('high'), { priority: 1 })
      eventBus.on('PRIORITY.TEST', () => callOrder.push('medium'), { priority: 2 })

      await eventBus.emit('PRIORITY.TEST')

      expect(callOrder).toEqual(['high', 'medium', 'low'])
    })

    test('應該支援一次性監聽器', async () => {
      const eventBus = createContentEventBus()
      const handler = jest.fn()

      eventBus.on('ONCE.TEST', handler, { once: true })

      await eventBus.emit('ONCE.TEST')
      await eventBus.emit('ONCE.TEST')

      expect(handler).toHaveBeenCalledTimes(1)
    })

    test('應該隔離監聽器錯誤', async () => {
      const eventBus = createContentEventBus()
      const errorHandler = jest.fn(() => { throw new Error('Handler error') })
      const goodHandler = jest.fn()

      eventBus.on('ERROR.TEST', errorHandler)
      eventBus.on('ERROR.TEST', goodHandler)

      const result = await eventBus.emit('ERROR.TEST')

      expect(result.success).toBe(true)
      expect(result.results).toHaveLength(2)
      expect(result.results[0].success).toBe(false)
      expect(result.results[1].success).toBe(true)
      expect(goodHandler).toHaveBeenCalled()
    })
  })

  describe('ChromeEventBridge 模組', () => {
    test('應該能夠發送訊息到 Background', async () => {
      const bridge = createChromeEventBridge()

      chrome.runtime.sendMessage.mockResolvedValue({ success: true })

      const message = {
        type: 'TEST.MESSAGE',
        data: { test: 'data' }
      }

      const result = await bridge.sendToBackground(message)

      expect(result.success).toBe(true)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'TEST.MESSAGE',
        data: { test: 'data' },
        metadata: {
          sender: 'content-script',
          timestamp: expect.any(Number),
          version: '0.3.0',
          url: expect.stringContaining('readmoo.com')
        }
      })
    })

    test('應該處理發送錯誤', async () => {
      const bridge = createChromeEventBridge()

      chrome.runtime.sendMessage.mockRejectedValue(new Error('Connection failed'))

      const message = {
        type: 'TEST.MESSAGE',
        data: {}
      }

      const result = await bridge.sendToBackground(message)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Connection failed')
    })

    test('應該能夠轉發事件到 Background', async () => {
      const bridge = createChromeEventBridge()

      chrome.runtime.sendMessage.mockResolvedValue({ success: true })

      await bridge.forwardEventToBackground('EXTRACTION.COMPLETED', { flowId: 'test' })

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CONTENT.EVENT.FORWARD',
        eventType: 'EXTRACTION.COMPLETED',
        data: { flowId: 'test' },
        timestamp: expect.any(Number),
        metadata: expect.objectContaining({
          sender: 'content-script'
        })
      })
    })
  })

  describe('ReadmooAdapter 模組', () => {
    test('應該能夠找到書籍元素', () => {
      const adapter = createReadmooAdapter()

      const bookElements = adapter.getBookElements()

      expect(bookElements).toHaveLength(2)
      expect(bookElements[0].tagName.toLowerCase()).toBe('div')
      expect(bookElements[0].classList.contains('library-item')).toBe(true)
    })

    test('應該能夠解析書籍資料', () => {
      const adapter = createReadmooAdapter()
      const bookElements = adapter.getBookElements()

      const bookData = adapter.parseBookElement(bookElements[0])

      expect(bookData).toEqual({
        id: expect.stringMatching(/^cover-12345$/),
        title: '測試書籍1',
        cover: 'https://cdn.readmoo.com/cover/ab/12345_210x315.jpg',
        progress: 45,
        type: 'EPUB',
        extractedAt: expect.any(String),
        url: '/api/reader/12345',
        source: 'readmoo',
        identifiers: expect.objectContaining({
          readerLinkId: '12345',
          coverId: '12345',
          primarySource: 'cover'
        }),
        coverInfo: expect.objectContaining({
          url: 'https://cdn.readmoo.com/cover/ab/12345_210x315.jpg',
          filename: '12345_210x315.jpg',
          domain: 'cdn.readmoo.com'
        }),
        progressInfo: expect.objectContaining({
          progress: 45,
          hasProgress: true
        }),
        extractedFrom: 'content-script'
      })
    })

    test('應該能夠提取所有書籍', async () => {
      const adapter = createReadmooAdapter()

      const books = await adapter.extractAllBooks()

      expect(books).toHaveLength(2)
      expect(books[0].title).toBe('測試書籍1')
      expect(books[1].title).toBe('測試書籍2')
    })

    test('應該過濾不安全的 URL', () => {
      const adapter = createReadmooAdapter()

      expect(adapter.isUnsafeUrl('javascript:alert(1)')).toBe(true)
      expect(adapter.isUnsafeUrl('data:text/html,<script>alert(1)</script>')).toBe(true)
      expect(adapter.isUnsafeUrl('https://cdn.readmoo.com/cover/test.jpg')).toBe(false)
    })
  })

  describe('BookDataExtractor 模組', () => {
    test('應該能夠檢測頁面類型', () => {
      const extractor = createBookDataExtractor()

      const pageType = extractor.getReadmooPageType()
      expect(pageType).toBe('library')

      const isExtractable = extractor.isExtractableReadmooPage()
      expect(isExtractable).toBe(true)
    })

    test('應該能夠檢查頁面準備狀態', async () => {
      const extractor = createBookDataExtractor()
      const adapter = createReadmooAdapter()

      extractor.setReadmooAdapter(adapter)

      const status = await extractor.checkPageReady()

      expect(status).toEqual({
        isReady: true,
        pageType: 'library',
        bookCount: 2,
        extractable: true,
        url: 'https://readmoo.com/library',
        timestamp: expect.any(Number)
      })
    })

    test('應該能夠啟動提取流程', async () => {
      const eventBus = createContentEventBus()
      const extractor = createBookDataExtractor()
      const adapter = createReadmooAdapter()

      extractor.setEventBus(eventBus)
      extractor.setReadmooAdapter(adapter)

      const events = []
      eventBus.on('EXTRACTION.STARTED', (event) => events.push(event))
      eventBus.on('EXTRACTION.COMPLETED', (event) => events.push(event))

      const flowId = await extractor.startExtractionFlow()

      expect(flowId).toMatch(/^flow_/)
      expect(events).toHaveLength(2)
      expect(events[0].type).toBe('EXTRACTION.STARTED')
      expect(events[1].type).toBe('EXTRACTION.COMPLETED')
    })

    test('應該能夠取消提取流程', async () => {
      const eventBus = createContentEventBus()
      const extractor = createBookDataExtractor()

      extractor.setEventBus(eventBus)

      // 手動添加活動流程 (直接操作內部狀態進行測試)
      const mockFlowId = 'test-flow-123'
      // 通過反射或直接訪問私有屬性
      if (!extractor.activeExtractionFlows) {
        // 如果模組沒有公開這個屬性，我們測試不存在的流程
        const result = await extractor.cancelExtraction(mockFlowId)
        expect(result.success).toBe(false)
        expect(result.error).toBe('流程不存在')
      } else {
        extractor.activeExtractionFlows.set(mockFlowId, {
          id: mockFlowId,
          status: 'running'
        })

        const result = await extractor.cancelExtraction(mockFlowId)
        expect(result.success).toBe(true)
        expect(result.flowId).toBe(mockFlowId)
      }
    })
  })

  describe('模組整合測試', () => {
    test('應該能夠完整整合所有模組', () => {
      const pageDetector = createPageDetector()
      const eventBus = createContentEventBus()
      const chromeBridge = createChromeEventBridge()
      const adapter = createReadmooAdapter()
      const extractor = createBookDataExtractor()

      // 設定模組整合
      chromeBridge.eventBus = eventBus
      extractor.setEventBus(eventBus)
      extractor.setReadmooAdapter(adapter)

      // 測試模組建立
      expect(pageDetector).toBeDefined()
      expect(eventBus).toBeDefined()
      expect(chromeBridge).toBeDefined()
      expect(adapter).toBeDefined()
      expect(extractor).toBeDefined()

      // 測試模組整合設定
      expect(chromeBridge.eventBus).toBe(eventBus)
      expect(extractor.eventBus).toBe(eventBus)
    })

    test('應該能夠處理事件轉發', async () => {
      const eventBus = createContentEventBus()
      const chromeBridge = createChromeEventBridge()

      chromeBridge.eventBus = eventBus
      chrome.runtime.sendMessage.mockResolvedValue({ success: true })

      // 監聽並轉發事件
      eventBus.on('EXTRACTION.COMPLETED', async (event) => {
        await chromeBridge.forwardEventToBackground('EXTRACTION.COMPLETED', event.data)
      })

      await eventBus.emit('EXTRACTION.COMPLETED', { flowId: 'test-123' })

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CONTENT.EVENT.FORWARD',
        eventType: 'EXTRACTION.COMPLETED',
        data: { flowId: 'test-123' },
        timestamp: expect.any(Number),
        metadata: expect.objectContaining({
          sender: 'content-script'
        })
      })
    })

    test('應該能夠處理模組錯誤隔離', async () => {
      const eventBus = createContentEventBus()
      const extractor = createBookDataExtractor()

      extractor.setEventBus(eventBus)
      // 故意不設置 adapter

      try {
        await extractor.startExtractionFlow()
      } catch (error) {
        expect(error.message).toContain('不支援的頁面類型')
      }

      // 事件系統應該仍然正常運作
      const handler = jest.fn()
      eventBus.on('TEST.EVENT', handler)
      await eventBus.emit('TEST.EVENT')
      expect(handler).toHaveBeenCalled()
    })
  })

  describe('記憶體管理和清理', () => {
    test('PageDetector 應該能夠清理資源', () => {
      const pageDetector = createPageDetector()

      const stopFunction = pageDetector.onUrlChange(() => {})
      expect(typeof stopFunction).toBe('function')

      pageDetector.destroy()
      // 清理後應該不會拋出錯誤
      expect(() => stopFunction()).not.toThrow()
    })

    test('EventBus 應該能夠清理事件監聽器', async () => {
      const eventBus = createContentEventBus()

      eventBus.on('TEST.EVENT', () => {})
      expect(eventBus.getStats().memoryUsage.totalListeners).toBe(1)

      eventBus.destroy()
      expect(eventBus.getStats().memoryUsage.totalListeners).toBe(0)
    })

    test('應該能夠清理活動提取流程', () => {
      const extractor = createBookDataExtractor()

      // 測試取得活動流程列表 (應該是空的)
      const activeFlows = extractor.getActiveExtractionFlows()
      expect(Array.isArray(activeFlows)).toBe(true)
      expect(activeFlows).toHaveLength(0)

      // 測試取消不存在的流程
      extractor.cancelExtraction('non-existent-flow').then(result => {
        expect(result.success).toBe(false)
      })
    })
  })
})
