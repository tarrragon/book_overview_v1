/**
 * PopupCommunicationService 單元測試
 *
 * 負責測試：
 * - Chrome Extension API 通訊
 * - Background Service Worker 狀態檢查
 * - Content Script 通訊
 * - 訊息超時和錯誤處理
 */

// Mock Chrome API
const mockChrome = {
  runtime: {
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

global.chrome = mockChrome

describe('PopupCommunicationService 核心功能', () => {
  let communicationService
  let mockStatusManager
  let mockProgressManager

  beforeEach(() => {
    // 建立 Mock 管理器
    mockStatusManager = {
      updateStatus: jest.fn(),
      handleSyncFailure: jest.fn()
    }

    mockProgressManager = {
      updateProgress: jest.fn(),
      startProgress: jest.fn(),
      completeProgress: jest.fn()
    }

    // 重置所有 Mock
    jest.clearAllMocks()
    mockChrome.runtime.lastError = null
  })

  describe('📡 Background Service Worker 通訊', () => {
    test('應該正確檢查 Background 狀態', async () => {
      // Given: 通訊服務和 Mock 回應
      const PopupCommunicationService = require('../../../src/popup/services/popup-communication-service.js')
      communicationService = new PopupCommunicationService(mockStatusManager, mockProgressManager)

      const mockResponse = {
        type: 'STATUS_RESPONSE',
        data: {
          status: 'ready',
          isReadmooPage: true,
          bookCount: 42
        }
      }
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback(mockResponse)
      })

      // When: 檢查 Background 狀態
      const result = await communicationService.checkBackgroundStatus()

      // Then: 正確處理回應並更新狀態
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_STATUS'
      }, expect.any(Function))
      expect(result).toEqual(mockResponse.data)
      expect(mockStatusManager.updateStatus).toHaveBeenCalledWith({
        type: 'ready',
        text: '擴展就緒',
        info: 'Background Service Worker 正常運作'
      })
    })

    test('應該正確處理通訊超時', async () => {
      // Given: 模擬通訊超時
      const PopupCommunicationService = require('../../../src/popup/services/popup-communication-service.js')
      communicationService = new PopupCommunicationService(mockStatusManager, mockProgressManager)

      // 模擬超時（不呼叫 callback）
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        // 不呼叫 callback 模擬超時
      })

      // When: 執行狀態檢查（應該超時）
      await expect(communicationService.checkBackgroundStatus())
        .rejects.toThrow('Background communication timeout')

      // Then: 正確處理超時
      expect(mockStatusManager.handleSyncFailure).toHaveBeenCalledWith('Background communication timeout')
    })

    test('應該正確處理 Chrome API 錯誤', async () => {
      // Given: Chrome API 錯誤
      const PopupCommunicationService = require('../../../src/popup/services/popup-communication-service.js')
      communicationService = new PopupCommunicationService(mockStatusManager, mockProgressManager)

      mockChrome.runtime.lastError = { message: 'Extension context invalidated.' }
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback(null) // Chrome API 錯誤時回傳 null
      })

      // When: 執行狀態檢查
      await expect(communicationService.checkBackgroundStatus())
        .rejects.toThrow('Chrome API error: Extension context invalidated.')

      // Then: 錯誤被正確處理
      expect(mockStatusManager.handleSyncFailure).toHaveBeenCalledWith('Chrome API error: Extension context invalidated.')
    })
  })

  describe('📋 Content Script 通訊', () => {
    test('應該正確發送提取開始訊息', async () => {
      // Given: 有效的標籤頁資料
      const PopupCommunicationService = require('../../../src/popup/services/popup-communication-service.js')
      communicationService = new PopupCommunicationService(mockStatusManager, mockProgressManager)

      const mockTab = { id: 123, url: 'https://readmoo.com/library' }
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([mockTab])
      })

      const mockExtractionResponse = {
        success: true,
        message: '提取已開始',
        estimatedCount: 50
      }
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback(mockExtractionResponse)
      })

      // When: 發送提取開始訊息
      const result = await communicationService.startExtraction()

      // Then: 訊息正確發送並處理回應
      expect(mockChrome.tabs.query).toHaveBeenCalledWith(
        { active: true, currentWindow: true },
        expect.any(Function)
      )
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        mockTab.id,
        { type: 'START_EXTRACTION' },
        expect.any(Function)
      )
      expect(result).toEqual(mockExtractionResponse)
    })

    test('應該正確處理非 Readmoo 頁面', async () => {
      // Given: 非 Readmoo 頁面
      const PopupCommunicationService = require('../../../src/popup/services/popup-communication-service.js')
      communicationService = new PopupCommunicationService(mockStatusManager, mockProgressManager)

      const mockTab = { id: 123, url: 'https://google.com' }
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([mockTab])
      })

      // When: 嘗試開始提取
      await expect(communicationService.startExtraction())
        .rejects.toThrow('Not on Readmoo page')

      // Then: 狀態正確更新
      expect(mockStatusManager.updateStatus).toHaveBeenCalledWith({
        type: 'error',
        text: '請前往 Readmoo 網站',
        info: '需要在 Readmoo 書庫頁面使用此功能'
      })
    })

    test('應該正確處理沒有活躍標籤頁的情況', async () => {
      // Given: 沒有活躍標籤頁
      const PopupCommunicationService = require('../../../src/popup/services/popup-communication-service.js')
      communicationService = new PopupCommunicationService(mockStatusManager, mockProgressManager)

      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([]) // 沒有標籤頁
      })

      // When: 嘗試開始提取
      await expect(communicationService.startExtraction())
        .rejects.toThrow('No active tab found')

      // Then: 錯誤被正確處理
      expect(mockStatusManager.updateStatus).toHaveBeenCalledWith({
        type: 'error',
        text: '找不到活躍標籤頁',
        info: '請確保有開啟的瀏覽器標籤頁'
      })
    })
  })

  describe('📨 訊息監聽和處理', () => {
    test('應該正確註冊訊息監聽器', () => {
      // Given: 通訊服務
      const PopupCommunicationService = require('../../../src/popup/services/popup-communication-service.js')
      communicationService = new PopupCommunicationService(mockStatusManager, mockProgressManager)

      // When: 初始化服務（自動註冊監聽器）
      communicationService.initialize()

      // Then: 監聽器被註冊
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      )
    })

    test('應該正確處理進度更新訊息', () => {
      // Given: 通訊服務和進度更新訊息
      const PopupCommunicationService = require('../../../src/popup/services/popup-communication-service.js')
      communicationService = new PopupCommunicationService(mockStatusManager, mockProgressManager)

      const progressMessage = {
        type: 'EXTRACTION_PROGRESS',
        data: {
          percentage: 65,
          text: '已提取 65/100 本書籍',
          status: 'extracting'
        }
      }

      // When: 處理訊息
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0]
      messageHandler(progressMessage, {}, jest.fn())

      // Then: 進度正確更新
      expect(mockProgressManager.updateProgress).toHaveBeenCalledWith({
        percentage: 65,
        text: '已提取 65/100 本書籍',
        status: 'extracting'
      })
    })

    test('應該正確處理提取完成訊息', () => {
      // Given: 通訊服務和完成訊息
      const PopupCommunicationService = require('../../../src/popup/services/popup-communication-service.js')
      communicationService = new PopupCommunicationService(mockStatusManager, mockProgressManager)

      const completionMessage = {
        type: 'EXTRACTION_COMPLETED',
        data: {
          totalProcessed: 98,
          successCount: 95,
          failureCount: 3,
          duration: 60000
        }
      }

      // When: 處理訊息
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0]
      messageHandler(completionMessage, {}, jest.fn())

      // Then: 完成狀態正確更新
      expect(mockProgressManager.completeProgress).toHaveBeenCalledWith({
        totalProcessed: 98,
        successCount: 95,
        failureCount: 3,
        duration: 60000
      })
      expect(mockStatusManager.updateStatus).toHaveBeenCalledWith({
        type: 'completed',
        text: '提取完成',
        info: '成功處理 95/98 本書籍'
      })
    })
  })

  describe('🔧 工具方法和輔助功能', () => {
    test('應該正確檢測 Readmoo 頁面', () => {
      // Given: 通訊服務
      const PopupCommunicationService = require('../../../src/popup/services/popup-communication-service.js')
      communicationService = new PopupCommunicationService(mockStatusManager, mockProgressManager)

      // When: 測試各種 URL
      const testCases = [
        { url: 'https://readmoo.com/library', expected: true },
        { url: 'https://www.readmoo.com/books', expected: true },
        { url: 'https://readmoo.com/read/book/123', expected: true },
        { url: 'https://google.com', expected: false },
        { url: 'https://amazon.com/kindle', expected: false }
      ]

      testCases.forEach(({ url, expected }) => {
        const result = communicationService.isReadmooPage(url)
        expect(result).toBe(expected)
      })
    })

    test('應該正確清理資源', () => {
      // Given: 初始化的通訊服務
      const PopupCommunicationService = require('../../../src/popup/services/popup-communication-service.js')
      communicationService = new PopupCommunicationService(mockStatusManager, mockProgressManager)
      communicationService.initialize()

      // When: 清理資源
      communicationService.cleanup()

      // Then: 監聽器被移除
      expect(mockChrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(
        expect.any(Function)
      )
    })
  })
})
