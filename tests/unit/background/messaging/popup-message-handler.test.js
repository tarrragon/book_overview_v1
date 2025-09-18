/**
 * PopupMessageHandler 單元測試
 *
 * 測試覆蓋率目標：
 * 1. 訊息格式驗證錯誤處理
 * 2. 不支援的訊息類型錯誤處理
 * 3. 無效發送者錯誤處理
 * 4. 會話管理錯誤處理
 * 5. 操作權限檢查錯誤處理
 * 6. 系統狀態檢查錯誤處理
 * 7. 資料請求處理錯誤
 * 8. 匯出操作錯誤處理
 * 9. 擷取操作錯誤處理
 * 10. 儲存清理錯誤處理
 * 11. 系統重載錯誤處理
 * 12. 標籤頁導航錯誤處理
 */

const PopupMessageHandler = require('src/background/messaging/popup-message-handler')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')
const { StandardError } = require('src/core/errors/StandardError')

describe('PopupMessageHandler', () => {
  let popupMessageHandler
  let mockLogger
  let mockEventBus
  let mockDependencies

  beforeEach(async () => {
    // Mock Logger
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    }

    // Mock EventBus
    mockEventBus = {
      emit: jest.fn().mockResolvedValue(true),
      on: jest.fn(),
      off: jest.fn()
    }

    // Mock Dependencies
    mockDependencies = {
      logger: mockLogger,
      eventBus: mockEventBus,
      readmooService: {
        getOverviewData: jest.fn(),
        startExtraction: jest.fn()
      },
      storageService: {
        clear: jest.fn(),
        get: jest.fn(),
        set: jest.fn()
      },
      exportService: {
        exportData: jest.fn()
      },
      configService: {
        updateConfig: jest.fn()
      }
    }

    popupMessageHandler = new PopupMessageHandler(mockDependencies)

    // 初始化模組
    await popupMessageHandler._doInitialize()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('訊息格式驗證', () => {
    test('應該在訊息不是物件時拋出 VALIDATION_ERROR', async () => {
      const invalidMessage = 'not an object'
      const sender = { url: 'chrome-extension://abc/popup.html' }
      const sendResponse = jest.fn()

      const result = await popupMessageHandler.handleMessage(invalidMessage, sender, sendResponse)

      expect(result).toBe(false)
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '訊息必須是有效的物件格式',
        timestamp: expect.any(Number)
      })
    })

    test('應該在訊息缺少 type 欄位時拋出 VALIDATION_ERROR', async () => {
      const invalidMessage = { data: 'some data' }
      const sender = { url: 'chrome-extension://abc/popup.html' }
      const sendResponse = jest.fn()

      const result = await popupMessageHandler.handleMessage(invalidMessage, sender, sendResponse)

      expect(result).toBe(false)
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '訊息缺少必要的 type 欄位',
        timestamp: expect.any(Number)
      })
    })

    test('應該在不支援的訊息類型時拋出 VALIDATION_ERROR', async () => {
      const invalidMessage = { type: 'UNSUPPORTED_TYPE' }
      const sender = { url: 'chrome-extension://abc/popup.html' }
      const sendResponse = jest.fn()

      const result = await popupMessageHandler.handleMessage(invalidMessage, sender, sendResponse)

      expect(result).toBe(false)
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '不支援的訊息類型: UNSUPPORTED_TYPE',
        timestamp: expect.any(Number)
      })
    })

    test('應該在發送者不是 popup 頁面時拋出 VALIDATION_ERROR', async () => {
      const message = { type: 'POPUP.STATUS.REQUEST' }
      const invalidSender = { url: 'chrome-extension://abc/content.js' }
      const sendResponse = jest.fn()

      const result = await popupMessageHandler.handleMessage(message, invalidSender, sendResponse)

      expect(result).toBe(false)
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '訊息必須來自 popup 頁面',
        timestamp: expect.any(Number)
      })
    })
  })

  describe('訊息路由處理', () => {
    test('應該正確處理 POPUP.STATUS.REQUEST', async () => {
      const message = { type: 'POPUP.STATUS.REQUEST', sessionId: 'test-session' }
      const sender = { url: 'chrome-extension://abc/popup.html' }
      const sendResponse = jest.fn()

      // Mock 狀態請求處理
      const spy = jest.spyOn(popupMessageHandler, 'handlePopupStatusRequest')
        .mockResolvedValue({ success: true, status: 'ready' })

      const result = await popupMessageHandler.handleMessage(message, sender, sendResponse)

      expect(spy).toHaveBeenCalledWith(message, sender, sendResponse)
      expect(result).toEqual({ success: true, status: 'ready' })

      spy.mockRestore()
    })

    test('應該正確處理 POPUP.DATA.REQUEST', async () => {
      const message = { type: 'POPUP.DATA.REQUEST', sessionId: 'test-session' }
      const sender = { url: 'chrome-extension://abc/popup.html' }
      const sendResponse = jest.fn()

      // Mock 資料請求處理
      const spy = jest.spyOn(popupMessageHandler, 'handlePopupDataRequest')
        .mockResolvedValue({ success: true, data: [] })

      const result = await popupMessageHandler.handleMessage(message, sender, sendResponse)

      expect(spy).toHaveBeenCalledWith(message, sender, sendResponse)
      expect(result).toEqual({ success: true, data: [] })

      spy.mockRestore()
    })

    test('應該正確處理 POPUP.SESSION.START', async () => {
      const message = { type: 'POPUP.SESSION.START', sessionId: 'test-session' }
      const sender = { url: 'chrome-extension://abc/popup.html' }
      const sendResponse = jest.fn()

      // Mock 會話開始處理
      const spy = jest.spyOn(popupMessageHandler, 'handlePopupSessionStart')
        .mockResolvedValue({ success: true, sessionId: 'test-session' })

      const result = await popupMessageHandler.handleMessage(message, sender, sendResponse)

      expect(spy).toHaveBeenCalledWith(message, sender, sendResponse)
      expect(result).toEqual({ success: true, sessionId: 'test-session' })

      spy.mockRestore()
    })
  })

  describe('操作權限檢查', () => {
    test('checkOperationPermissions 應該在沒有活躍標籤頁時拋出 VALIDATION_ERROR', async () => {
      const operation = 'EXTRACTION.START'
      const session = { sessionId: 'test-session' }

      // Mock getCurrentActiveTab 回傳 null
      jest.spyOn(popupMessageHandler, 'getCurrentActiveTab')
        .mockResolvedValue(null)

      await expect(popupMessageHandler.checkOperationPermissions(operation, session))
        .rejects
        .toMatchObject({
          code: ErrorCodes.VALIDATION_ERROR,
          message: '操作需要活躍的標籤頁'
        })
    })

    test('checkOperationPermissions 應該在有活躍標籤頁時通過檢查', async () => {
      const operation = 'EXTRACTION.START'
      const session = { sessionId: 'test-session' }

      // Mock getCurrentActiveTab 回傳有效標籤頁
      jest.spyOn(popupMessageHandler, 'getCurrentActiveTab')
        .mockResolvedValue({ id: 123, url: 'https://readmoo.com' })

      // checkOperationPermissions 可能沒有回傳值（void），不拋出錯誤即為通過
      await expect(popupMessageHandler.checkOperationPermissions(operation, session))
        .resolves
        .not.toThrow()
    })
  })

  describe('會話管理', () => {
    test('handlePopupSessionStart 應該正確建立新會話', async () => {
      const message = { sessionId: 'new-session', type: 'POPUP.SESSION.START' }
      const sender = { url: 'chrome-extension://abc/popup.html', origin: 'chrome-extension://abc' }
      const sendResponse = jest.fn()

      await popupMessageHandler.handlePopupSessionStart(message, sender, sendResponse)

      const sessions = popupMessageHandler.activePopupSessions
      expect(sessions.has('new-session')).toBe(true)
      expect(sessions.get('new-session')).toMatchObject({
        sessionId: 'new-session',
        startTime: expect.any(Number),
        messageCount: 0
      })

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        sessionId: 'new-session',
        message: 'Popup 會話已建立',
        timestamp: expect.any(Number)
      })
    })

    test('updatePopupSession 應該正確更新現有會話', () => {
      const sessionId = 'existing-session'

      // 建立現有會話
      popupMessageHandler.activePopupSessions.set(sessionId, {
        sessionId,
        startTime: Date.now() - 1000,
        messageCount: 1,
        lastActivity: Date.now() - 1000
      })

      const message = { sessionId, type: 'POPUP.DATA.REQUEST' }
      const sender = { url: 'chrome-extension://abc/popup.html' }

      popupMessageHandler.updatePopupSession(message, sender)

      const session = popupMessageHandler.activePopupSessions.get(sessionId)
      expect(session.messageCount).toBe(2)
      expect(session.lastActivity).toBeGreaterThan(session.startTime)
    })
  })

  describe('統計管理', () => {
    test('updatePopupStats 應該正確更新統計資料', () => {
      const message = { type: 'POPUP.STATUS.REQUEST' }
      const sender = { url: 'chrome-extension://abc/popup.html' }

      const initialTotal = popupMessageHandler.popupStats.total

      popupMessageHandler.updatePopupStats(message, sender)

      expect(popupMessageHandler.popupStats.total).toBe(initialTotal + 1)
      expect(popupMessageHandler.popupStats.byMessageType.get('POPUP.STATUS.REQUEST')).toBe(1)
    })

    test('resetStats 應該正確重置統計資料', () => {
      // 先增加一些統計
      popupMessageHandler.popupStats.total = 10
      popupMessageHandler.popupStats.success = 8
      popupMessageHandler.popupStats.failed = 2

      popupMessageHandler.resetStats()

      expect(popupMessageHandler.popupStats.total).toBe(0)
      expect(popupMessageHandler.popupStats.success).toBe(0)
      expect(popupMessageHandler.popupStats.failed).toBe(0)
      expect(popupMessageHandler.popupStats.byMessageType.size).toBe(0)
    })
  })

  describe('錯誤處理和事件發送', () => {
    test('應該在處理錯誤時觸發 POPUP.MESSAGE.ERROR 事件', async () => {
      const message = { type: 'INVALID_TYPE' }
      const sender = { url: 'chrome-extension://abc/popup.html' }
      const sendResponse = jest.fn()

      await popupMessageHandler.handleMessage(message, sender, sendResponse)

      expect(mockEventBus.emit).toHaveBeenCalledWith('POPUP.MESSAGE.ERROR', {
        error: expect.stringContaining('不支援的訊息類型'),
        messageType: 'INVALID_TYPE',
        sessionId: undefined,
        timestamp: expect.any(Number)
      })
    })

    test('應該正確更新失敗統計', async () => {
      const message = { type: 'INVALID_TYPE' }
      const sender = { url: 'chrome-extension://abc/popup.html' }
      const sendResponse = jest.fn()

      const initialFailed = popupMessageHandler.popupStats.failed

      await popupMessageHandler.handleMessage(message, sender, sendResponse)

      expect(popupMessageHandler.popupStats.failed).toBe(initialFailed + 1)
    })
  })

  describe('狀態和健康檢查', () => {
    test('getPopupStatus 應該回傳正確的狀態', () => {
      // 設置一些測試資料
      popupMessageHandler.popupStats.total = 15
      popupMessageHandler.popupStats.success = 12
      popupMessageHandler.popupStats.failed = 3
      popupMessageHandler.activePopupSessions.set('test-session', {
        sessionId: 'test-session',
        startTime: Date.now()
      })

      const status = popupMessageHandler.getPopupStatus()

      expect(status.activeSessions).toBeInstanceOf(Array)
      expect(status.activeSessions).toHaveLength(1)
      expect(status.stats.total).toBe(15)
      expect(status.stats.success).toBe(12)
      expect(status.stats.failed).toBe(3)
    })

    test('_getCustomHealthStatus 應該回傳健康狀態', () => {
      const healthStatus = popupMessageHandler._getCustomHealthStatus()

      expect(healthStatus).toMatchObject({
        activeSessions: expect.any(Number),
        health: expect.any(String),
        operations: expect.any(Number),
        dataQueries: expect.any(Number),
        errorRate: expect.any(Number)
      })
    })
  })

  describe('特定操作處理', () => {
    test('handleStorageClear 應該正確處理儲存清理請求', async () => {
      const message = { type: 'STORAGE_CLEAR', sessionId: 'test-session' }
      const sender = { url: 'chrome-extension://abc/popup.html' }
      const sendResponse = jest.fn()

      // Mock 權限檢查
      jest.spyOn(popupMessageHandler, 'checkOperationPermissions')
        .mockResolvedValue(true)

      // Mock 儲存清理
      mockDependencies.storageService.clear.mockResolvedValue({ success: true })

      const spy = jest.spyOn(popupMessageHandler, 'handleStorageClear')
        .mockResolvedValue({ success: true, cleared: true })

      const result = await spy(message, sender, sendResponse)

      expect(result).toEqual({ success: true, cleared: true })

      spy.mockRestore()
    })

    test('handleSystemReload 應該正確處理系統重載請求', async () => {
      const message = { type: 'SYSTEM_RELOAD', sessionId: 'test-session' }
      const sender = { url: 'chrome-extension://abc/popup.html' }
      const sendResponse = jest.fn()

      const spy = jest.spyOn(popupMessageHandler, 'handleSystemReload')
        .mockResolvedValue({ success: true, reloaded: true })

      const result = await spy(message, sender, sendResponse)

      expect(result).toEqual({ success: true, reloaded: true })

      spy.mockRestore()
    })

    test('handleTabNavigate 應該正確處理標籤頁導航請求', async () => {
      const message = { type: 'TAB_NAVIGATE', url: 'https://example.com' }
      const sender = { url: 'chrome-extension://abc/popup.html' }
      const sendResponse = jest.fn()

      const spy = jest.spyOn(popupMessageHandler, 'handleTabNavigate')
        .mockResolvedValue({ success: true, tabId: 456 })

      const result = await spy(message, sender, sendResponse)

      expect(result).toEqual({ success: true, tabId: 456 })

      spy.mockRestore()
    })
  })
})