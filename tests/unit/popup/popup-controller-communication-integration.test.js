/**
 * PopupController 通訊服務整合測試
 *
 * 測試目標：
 * - 驗證 PopupController 與真實 PopupCommunicationService 的整合
 * - 確保 Chrome API 通訊正確流動到各組件
 * - 測試通訊服務的錯誤處理和超時機制
 *
 * @jest-environment jsdom
 */

// Mock DOM 環境
const { JSDOM } = require('jsdom')

// Mock Chrome Extension APIs
const mockChromeAPI = {
  runtime: {
    getManifest: jest.fn(() => ({ version: '0.9.8' })),
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    lastError: null
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  }
}

global.chrome = mockChromeAPI

describe('PopupController 通訊服務整合測試', () => {
  jest.setTimeout(15000) // 設定整個測試套件的超時為15秒
  let dom
  let document
  let window
  let PopupController
  let PopupCommunicationService

  beforeEach(() => {
    // 重置 Chrome API mocks
    jest.clearAllMocks()
    mockChromeAPI.runtime.lastError = null

    // 建立 JSDOM 環境
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
      <body>
        <div id="status-dot" class="status-dot loading"></div>
        <div id="status-text">檢查中...</div>
        <div id="status-info"></div>
        <div id="extension-status">正在初始化...</div>
        <button id="extract-button">開始提取書庫資料</button>
        <div id="progress-container" class="hidden">
          <div id="progress-bar" style="width: 0%"></div>
          <div id="progress-text">準備中...</div>
          <div id="progress-percentage">0%</div>
        </div>
        <div id="error-container" class="hidden">
          <div id="error-title"></div>
          <div id="error-message"></div>
        </div>
      </body>
      </html>
    `, { url: 'chrome-extension://test/popup.html' })

    window = dom.window
    document = window.document
    global.window = window
    global.document = document

    // 載入相關模組
    PopupController = require('src/popup/popup-controller.js')
    PopupCommunicationService = require('src/popup/services/popup-communication-service.js')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🔴 Red 階段：通訊服務整合測試設計', () => {
    test('應該能夠整合真實的 PopupCommunicationService', async () => {
      // Given: PopupController 實例
      const controller = new PopupController(document)

      // When: 初始化控制器
      await controller.initialize()

      // Then: 通訊服務應該是真實的 PopupCommunicationService 實例
      const communicationService = controller.getComponent('communication')
      expect(communicationService).toBeInstanceOf(PopupCommunicationService)

      // 且應該有完整的通訊功能
      expect(typeof communicationService.checkBackgroundStatus).toBe('function')
      expect(typeof communicationService.startExtraction).toBe('function')
      expect(typeof communicationService.isReadmooPage).toBe('function')
      expect(typeof communicationService.cleanup).toBe('function')
    })

    test('應該正確注入依賴到 CommunicationService', async () => {
      // Given: PopupController 實例
      const controller = new PopupController(document)

      // When: 初始化
      await controller.initialize()

      // Then: CommunicationService 應該有正確的依賴注入
      const communicationService = controller.getComponent('communication')
      const statusManager = controller.getComponent('status')
      const progressManager = controller.getComponent('progress')

      expect(communicationService).toBeDefined()
      expect(statusManager).toBeDefined()
      expect(progressManager).toBeDefined()

      // CommunicationService 應該能夠通過狀態和進度管理器更新界面
      expect(communicationService.statusManager).toBeDefined()
      expect(communicationService.progressManager).toBeDefined()
    })

    test('應該能夠檢查 Background Service Worker 狀態', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const communicationService = controller.getComponent('communication')

      // 在測試環境中，應該跳過實際的背景檢查
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production' // 臨時設為非測試環境以測試實際通訊

      // Mock Chrome API 回應
      mockChromeAPI.runtime.sendMessage.mockImplementation((message, callback) => {
        setTimeout(() => {
          callback({
            success: true,
            data: {
              status: 'ready',
              version: '0.9.8',
              lastActivity: Date.now()
            }
          })
        }, 100)
      })

      // When: 檢查背景狀態
      const statusResult = await communicationService.checkBackgroundStatus()

      // Then: 應該正確取得狀態並更新 UI
      expect(mockChromeAPI.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'GET_STATUS' },
        expect.any(Function)
      )
      expect(statusResult.status).toBe('ready')
      expect(statusResult.version).toBe('0.9.8')

      // 恢復測試環境
      process.env.NODE_ENV = originalEnv
    })

    test('應該處理 Background 通訊超時', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const communicationService = controller.getComponent('communication')

      // 在測試環境中，應該跳過實際的背景檢查
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production' // 臨時設為非測試環境以測試實際通訊

      // Mock Chrome API 不回應（超時）
      mockChromeAPI.runtime.sendMessage.mockImplementation(() => {
        // 不調用 callback，模擬超時
      })

      // When: 檢查背景狀態
      // Then: 應該在超時後拋出錯誤
      await expect(communicationService.checkBackgroundStatus()).rejects.toMatchObject({
        code: 'TIMEOUT_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      // 恢復測試環境
      process.env.NODE_ENV = originalEnv
    }, 5000) // 5秒超時

    test('應該處理 Chrome API 錯誤', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const communicationService = controller.getComponent('communication')

      // 在測試環境中，應該跳過實際的背景檢查
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production' // 臨時設為非測試環境以測試實際通訊

      // Mock Chrome API 錯誤
      mockChromeAPI.runtime.lastError = { message: 'Extension context invalidated' }
      mockChromeAPI.runtime.sendMessage.mockImplementation((message, callback) => {
        callback(null)
      })

      // When: 檢查背景狀態
      // Then: 應該拋出錯誤
      await expect(communicationService.checkBackgroundStatus()).rejects.toMatchObject({
        code: 'INVALID_INPUT_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      // 恢復測試環境
      process.env.NODE_ENV = originalEnv
    }, 5000) // 5秒超時

    test('應該能夠檢查 Readmoo 頁面', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const communicationService = controller.getComponent('communication')

      // When: 檢查不同的 URL
      // Then: 應該正確識別 Readmoo 頁面
      expect(communicationService.isReadmooPage('https://readmoo.com')).toBe(true)
      expect(communicationService.isReadmooPage('https://www.readmoo.com')).toBe(true)
      expect(communicationService.isReadmooPage('https://readmoo.com/library')).toBe(true)
      expect(communicationService.isReadmooPage('https://google.com')).toBe(false)
      expect(communicationService.isReadmooPage('https://facebook.com')).toBe(false)
      expect(communicationService.isReadmooPage('')).toBe(false)
      expect(communicationService.isReadmooPage(null)).toBe(false)
    })

    test('應該能夠開始提取流程', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const communicationService = controller.getComponent('communication')

      // Mock tabs.query 回應
      mockChromeAPI.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([{
          id: 123,
          url: 'https://readmoo.com/library',
          title: 'Readmoo 書庫'
        }])
      })

      // Mock tabs.sendMessage 回應
      mockChromeAPI.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ success: true, extractionId: 'ext_123' })
      })

      // When: 開始提取
      const extractionResult = await communicationService.startExtraction()

      // Then: 應該正確開始提取
      expect(mockChromeAPI.tabs.query).toHaveBeenCalledWith(
        { active: true, currentWindow: true },
        expect.any(Function)
      )
      expect(mockChromeAPI.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        { type: 'START_EXTRACTION' },
        expect.any(Function)
      )
      expect(extractionResult.success).toBe(true)
      expect(extractionResult.extractionId).toBe('ext_123')
    })

    test('應該處理非 Readmoo 頁面的提取請求', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const communicationService = controller.getComponent('communication')

      // Mock tabs.query 回應非 Readmoo 頁面
      mockChromeAPI.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([{
          id: 123,
          url: 'https://google.com',
          title: 'Google'
        }])
      })

      // When: 嘗試開始提取
      // Then: 應該拋出錯誤並更新狀態
      await expect(communicationService.startExtraction()).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      // 狀態應該已更新
      expect(document.getElementById('status-text').textContent).toBe('請前往 Readmoo 網站')
      expect(document.getElementById('status-info').textContent).toBe('需要在 Readmoo 書庫頁面使用此功能')
    })

    test('應該處理沒有活躍標籤頁的情況', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const communicationService = controller.getComponent('communication')

      // Mock tabs.query 回應空陣列
      mockChromeAPI.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([])
      })

      // When: 嘗試開始提取
      // Then: 應該拋出錯誤並更新狀態
      await expect(communicationService.startExtraction()).rejects.toMatchObject({
        code: 'TEST_ERROR',
        message: expect.any(String),
        details: expect.any(Object)
      })

      // 狀態應該已更新
      expect(document.getElementById('status-text').textContent).toBe('找不到活躍標籤頁')
      expect(document.getElementById('status-info').textContent).toBe('請確保有開啟的瀏覽器標籤頁')
    })

    test('應該能夠處理訊息監聽', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const communicationService = controller.getComponent('communication')

      // When: 檢查訊息監聽器是否已註冊
      // Then: 應該已註冊訊息監聽器
      expect(mockChromeAPI.runtime.onMessage.addListener).toHaveBeenCalled()
      expect(communicationService.messageListener).toBeDefined()
    })

    test('應該正確處理進度更新訊息', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const communicationService = controller.getComponent('communication')

      // When: 模擬接收進度更新訊息
      const progressMessage = {
        type: 'EXTRACTION_PROGRESS',
        data: {
          percentage: 75,
          text: '正在處理第 75 本書籍',
          status: 'extracting'
        }
      }

      communicationService._handleMessage(progressMessage, {}, () => {})

      // Then: 進度應該正確更新
      expect(document.getElementById('progress-bar').style.width).toBe('75%')
      expect(document.getElementById('progress-text').textContent).toBe('正在處理第 75 本書籍')
      expect(document.getElementById('progress-percentage').textContent).toBe('75%')
    })

    test('應該正確處理提取完成訊息', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const communicationService = controller.getComponent('communication')

      // When: 模擬接收提取完成訊息
      const completionMessage = {
        type: 'EXTRACTION_COMPLETED',
        data: {
          totalProcessed: 150,
          successCount: 145,
          failureCount: 5,
          duration: 45000
        }
      }

      communicationService._handleMessage(completionMessage, {}, () => {})

      // Then: 狀態和進度應該正確更新
      expect(document.getElementById('status-text').textContent).toBe('提取完成')
      expect(document.getElementById('status-info').textContent).toBe('成功處理 145/150 本書籍')
    })

    test('應該正確處理提取錯誤訊息', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const communicationService = controller.getComponent('communication')

      // When: 模擬接收錯誤訊息
      const errorMessage = {
        type: 'EXTRACTION_ERROR',
        data: {
          message: '網路連線中斷',
          code: 'NETWORK_ERROR'
        }
      }

      communicationService._handleMessage(errorMessage, {}, () => {})

      // Then: 錯誤狀態應該正確更新
      expect(document.getElementById('status-text').textContent).toBe('提取發生錯誤')
      expect(document.getElementById('status-info').textContent).toBe('網路連線中斷')
    })
  })

  describe('⚠️ 錯誤處理測試', () => {
    test('應該能夠清理訊息監聽器', async () => {
      // Given: 已初始化的控制器
      const controller = new PopupController(document)
      await controller.initialize()

      const communicationService = controller.getComponent('communication')
      const originalListener = communicationService.messageListener

      // When: 清理資源
      communicationService.cleanup()

      // Then: 監聽器應該被移除
      expect(mockChromeAPI.runtime.onMessage.removeListener).toHaveBeenCalledWith(originalListener)
      expect(communicationService.messageListener).toBeNull()
    })
  })
})
