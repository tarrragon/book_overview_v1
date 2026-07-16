/**
 * ContentMessageHandler - CONTENT.FETCH.PAGE_HTML 單元測試
 *
 * 測試覆蓋率目標：
 * 1. 成功 fetch 並回傳 HTML
 * 2. 域名驗證：拒絕非平台域名
 * 3. 域名驗證：允許已知平台域名（kobo.com）
 * 4. fetch 失敗時回傳錯誤
 * 5. 超時處理
 * 6. 缺少 url 參數時回傳錯誤
 * 7. 無效 URL 格式時回傳錯誤
 *
 * Ticket: 1.6.0-W3-001.1
 */

const ContentMessageHandler = require('src/background/messaging/content-message-handler')

describe('ContentMessageHandler - CONTENT.FETCH.PAGE_HTML', () => {
  let handler
  let mockLogger
  let mockEventBus
  let sendResponse

  beforeEach(async () => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    }

    mockEventBus = {
      emit: jest.fn().mockResolvedValue(true),
      on: jest.fn(),
      off: jest.fn(),
      hasListener: jest.fn().mockReturnValue(true)
    }

    handler = new ContentMessageHandler({
      logger: mockLogger,
      eventBus: mockEventBus
    })

    handler.logger = mockLogger
    handler.eventBus = mockEventBus

    sendResponse = jest.fn()

    // Mock global fetch
    global.fetch = jest.fn()
  })

  afterEach(() => {
    delete global.fetch
    jest.restoreAllMocks()
  })

  const createSender = (tabId = 1, url = 'https://www.kobo.com/tw/zh/library/books') => ({
    tab: { id: tabId, url }
  })

  const createFetchMessage = (url) => ({
    type: 'CONTENT.FETCH.PAGE_HTML',
    url,
    platform: 'kobo'
  })

  describe('message type 註冊', () => {
    it('應支援 CONTENT.FETCH.PAGE_HTML message type', () => {
      expect(handler.supportedMessageTypes.has('CONTENT.FETCH.PAGE_HTML')).toBe(true)
    })
  })

  describe('成功 fetch', () => {
    it('應 fetch 指定 URL 並回傳 HTML 文字', async () => {
      const mockHtml = '<html><body><li class="item-wrapper book">Test Book</li></body></html>'
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(mockHtml)
      })

      await handler.handleMessage(
        createFetchMessage('https://www.kobo.com/tw/zh/library/books?pageSize=60&pageNumber=2'),
        createSender(),
        sendResponse
      )

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          html: mockHtml,
          status: 200
        })
      )
    })

    it('應使用 credentials: include 確保 cookies 傳遞', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('<html></html>')
      })

      await handler.handleMessage(
        createFetchMessage('https://www.kobo.com/tw/zh/library/books?pageSize=60&pageNumber=2'),
        createSender(),
        sendResponse
      )

      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.kobo.com/tw/zh/library/books?pageSize=60&pageNumber=2',
        expect.objectContaining({
          credentials: 'include'
        })
      )
    })
  })

  describe('域名驗證', () => {
    it('應拒絕非平台域名的 URL', async () => {
      await handler.handleMessage(
        createFetchMessage('https://evil-site.com/steal-data'),
        createSender(),
        sendResponse
      )

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('域名')
        })
      )
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('應允許 kobo.com 域名', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('<html></html>')
      })

      await handler.handleMessage(
        createFetchMessage('https://www.kobo.com/tw/zh/library/books?pageSize=60&pageNumber=3'),
        createSender(),
        sendResponse
      )

      expect(global.fetch).toHaveBeenCalled()
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      )
    })

    it('應允許子域名（如 www.kobo.com）', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('<html></html>')
      })

      await handler.handleMessage(
        createFetchMessage('https://www.kobo.com/tw/zh/library/books'),
        createSender(),
        sendResponse
      )

      expect(global.fetch).toHaveBeenCalled()
    })

    it('應拒絕非 HTTPS 協定（HTTP）', async () => {
      await handler.handleMessage(
        createFetchMessage('http://www.kobo.com/tw/zh/library/books'),
        createSender(),
        sendResponse
      )

      expect(global.fetch).not.toHaveBeenCalled()
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      )
    })

    it('應拒絕非 HTTPS 協定（FTP）', async () => {
      await handler.handleMessage(
        createFetchMessage('ftp://kobo.com/library/books'),
        createSender(),
        sendResponse
      )

      expect(global.fetch).not.toHaveBeenCalled()
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      )
    })

    it('應拒絕 hostname 尾碼偽裝（evilkobo.com）', async () => {
      await handler.handleMessage(
        createFetchMessage('https://evilkobo.com/tw/zh/library/books'),
        createSender(),
        sendResponse
      )

      expect(global.fetch).not.toHaveBeenCalled()
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      )
    })
  })

  describe('錯誤處理', () => {
    it('應處理 fetch 失敗（HTTP 錯誤狀態）', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      })

      await handler.handleMessage(
        createFetchMessage('https://www.kobo.com/tw/zh/library/books?pageSize=60&pageNumber=2'),
        createSender(),
        sendResponse
      )

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/403/)
        })
      )
    })

    it('應處理 fetch 網路錯誤', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'))

      await handler.handleMessage(
        createFetchMessage('https://www.kobo.com/tw/zh/library/books?pageSize=60&pageNumber=2'),
        createSender(),
        sendResponse
      )

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Network error')
        })
      )
    })

    it('應在缺少 url 參數時回傳錯誤', async () => {
      await handler.handleMessage(
        { type: 'CONTENT.FETCH.PAGE_HTML' },
        createSender(),
        sendResponse
      )

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('url')
        })
      )
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('應在 URL 格式無效時回傳錯誤', async () => {
      await handler.handleMessage(
        createFetchMessage('not-a-valid-url'),
        createSender(),
        sendResponse
      )

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      )
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('超時處理', () => {
    it('應在 fetch 超時後回傳錯誤', async () => {
      // 模擬永不 resolve 的 fetch（在測試中以 AbortError 模擬）
      global.fetch.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))

      await handler.handleMessage(
        createFetchMessage('https://www.kobo.com/tw/zh/library/books?pageSize=60&pageNumber=2'),
        createSender(),
        sendResponse
      )

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/abort|timeout/i)
        })
      )
    })
  })
})
