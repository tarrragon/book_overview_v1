/**
 * PopupController 提取服務整合測試
 *
 * 測試目標：
 * - 驗證 PopupController 與真實 PopupExtractionService 的整合
 * - 確保業務邏輯正確流動到各組件
 * - 測試提取服務的錯誤處理和重試機制
 *
 * @jest-environment jsdom
 */

// Mock DOM 環境
const { JSDOM } = require('jsdom')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

// Mock Chrome Extension APIs
// eslint-disable-next-line no-unused-vars
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

describe('PopupController 提取服務整合測試', () => {
  let dom
  let document
  let window
  let PopupController
  let PopupExtractionService

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
    PopupExtractionService = require('src/popup/services/popup-extraction-service.js')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🔴 Red 階段：提取服務整合測試設計', () => {
    test('應該能夠整合真實的 PopupExtractionService', async () => {
      // Given: PopupController 實例
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)

      // When: 初始化控制器
      await controller.initialize()

      // Then: 提取服務應該是真實的 PopupExtractionService 實例
      // eslint-disable-next-line no-unused-vars
      const extractionService = controller.getComponent('extraction')
      expect(extractionService).toBeInstanceOf(PopupExtractionService)

      // 且應該有完整的提取功能
      expect(typeof extractionService.startExtraction).toBe('function')
      expect(typeof extractionService.cancelExtraction).toBe('function')
      expect(typeof extractionService.processExtractionResult).toBe('function')
      expect(typeof extractionService.cleanup).toBe('function')
    })

    test('應該正確注入依賴到 ExtractionService', async () => {
      // Given: PopupController 實例
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)

      // When: 初始化
      await controller.initialize()

      // Then: ExtractionService 應該有正確的依賴注入
      // eslint-disable-next-line no-unused-vars
      const extractionService = controller.getComponent('extraction')
      // eslint-disable-next-line no-unused-vars
      const statusManager = controller.getComponent('status')
      // eslint-disable-next-line no-unused-vars
      const progressManager = controller.getComponent('progress')
      // eslint-disable-next-line no-unused-vars
      const communicationService = controller.getComponent('communication')

      expect(extractionService).toBeDefined()
      expect(statusManager).toBeDefined()
      expect(progressManager).toBeDefined()
      expect(communicationService).toBeDefined()

      // ExtractionService 應該有正確的依賴引用
      expect(extractionService.statusManager).toBe(statusManager)
      expect(extractionService.progressManager).toBe(progressManager)
      expect(extractionService.communicationService).toBe(communicationService)
    })

    test('應該能夠通過 ExtractionService 開始提取流程', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const extractionService = controller.getComponent('extraction')

      // Mock Chrome API 回應
      mockChromeAPI.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([{
          id: 123,
          url: 'https://readmoo.com/library',
          title: 'Readmoo 書庫'
        }])
      })

      mockChromeAPI.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({
          success: true,
          extractionId: 'ext_123',
          estimatedCount: 150
        })
      })

      // When: 開始提取
      // eslint-disable-next-line no-unused-vars
      const extractionResult = await extractionService.startExtraction()

      // Then: 應該正確開始提取並更新狀態
      expect(extractionResult.success).toBe(true)
      expect(extractionResult.extractionId).toBe('ext_123')

      // 狀態應該已更新
      expect(document.getElementById('status-text').textContent).toBe('正在提取資料')
      expect(document.getElementById('status-info').textContent).toBe('已開始書庫資料提取流程')

      // 進度應該已開始
      expect(extractionService.isExtracting).toBe(true)
      expect(extractionService.currentExtractionId).toBeTruthy()
    })

    test('應該處理提取依賴驗證失敗', () => {
      // Given: 缺少必要依賴
      // When: 嘗試建立 ExtractionService
      // Then: 應該拋出錯誤
      expect(() => {
        // eslint-disable-next-line no-new
        new PopupExtractionService(null, {}, {})
      }).toThrowError(expect.objectContaining({
        code: ErrorCodes.VALIDATION_ERROR
      }))

      expect(() => {
        // eslint-disable-next-line no-new
        new PopupExtractionService({}, null, {})
      }).toThrowError(expect.objectContaining({
        code: ErrorCodes.VALIDATION_ERROR
      }))

      expect(() => {
        // eslint-disable-next-line no-new
        new PopupExtractionService({}, {}, null)
      }).toThrowError(expect.objectContaining({
        code: ErrorCodes.VALIDATION_ERROR
      }))
    })

    test('應該防止重複提取', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const extractionService = controller.getComponent('extraction')

      // Mock Chrome API 回應
      mockChromeAPI.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([{
          id: 123,
          url: 'https://readmoo.com/library',
          title: 'Readmoo 書庫'
        }])
      })

      mockChromeAPI.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ success: true, extractionId: 'ext_123' })
      })

      // When: 開始第一次提取
      await extractionService.startExtraction()

      // Then: 第二次提取應該被拒絕
      await expect(extractionService.startExtraction()).rejects.toThrowError(expect.objectContaining({
        code: ErrorCodes.OPERATION_ERROR
      }))
    })

    test('應該支援提取取消功能', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const extractionService = controller.getComponent('extraction')

      // Mock 進行中的提取
      extractionService.isExtracting = true
      extractionService.currentExtractionId = 'test_extraction'

      // When: 取消提取
      // eslint-disable-next-line no-unused-vars
      const cancelResult = await extractionService.cancelExtraction('使用者手動取消')

      // Then: 應該正確取消並更新狀態
      expect(cancelResult.cancelled).toBe(true)
      expect(cancelResult.reason).toBe('使用者手動取消')

      // 狀態應該已更新
      expect(document.getElementById('status-text').textContent).toBe('提取已取消')
      expect(document.getElementById('status-info').textContent).toBe('使用者手動取消')

      // 提取狀態應該重置
      expect(extractionService.isExtracting).toBe(false)
      expect(extractionService.currentExtractionId).toBeNull()
    })

    test('應該處理提取結果驗證', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const extractionService = controller.getComponent('extraction')

      // When: 處理有效的提取結果
      // eslint-disable-next-line no-unused-vars
      const validResult = {
        books: [{ id: 1, title: '測試書籍' }],
        totalProcessed: 100,
        successCount: 95,
        failureCount: 5
      }

      // eslint-disable-next-line no-unused-vars
      const processedResult = extractionService.processExtractionResult(validResult)

      // Then: 應該正確處理結果
      expect(processedResult.isValid).toBe(true)
      expect(processedResult.summary.totalBooks).toBe(100)
      expect(processedResult.summary.successfulBooks).toBe(95)
      expect(processedResult.summary.failedBooks).toBe(5)
      expect(processedResult.summary.successRate).toBe(95)
      expect(processedResult.books).toHaveLength(1)
    })

    test('應該處理無效的提取結果', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const extractionService = controller.getComponent('extraction')

      // When: 處理無效的提取結果
      // Then: 應該拋出錯誤並更新狀態
      expect(() => {
        extractionService.processExtractionResult(null)
      }).toThrowError(expect.objectContaining({
        code: ErrorCodes.VALIDATION_ERROR
      }))

      expect(() => {
        extractionService.processExtractionResult({ books: [] })
      }).toThrowError(expect.objectContaining({
        code: ErrorCodes.VALIDATION_ERROR
      }))

      // 狀態應該顯示錯誤
      expect(document.getElementById('status-text').textContent).toBe('資料處理失敗')
      expect(document.getElementById('status-info').textContent).toBe('提取結果格式無效')
    })

    test('應該支援批次進度更新', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const extractionService = controller.getComponent('extraction')

      // When: 更新批次進度
      // eslint-disable-next-line no-unused-vars
      const batchProgress = {
        currentBatch: 3,
        totalBatches: 10,
        batchSize: 25,
        processedInBatch: 15,
        totalProcessed: 65
      }

      extractionService.updateBatchProgress(batchProgress)

      // Then: 進度應該正確更新
      expect(document.getElementById('progress-bar').style.width).toBe('26%') // 65/(10*25)*100
      expect(document.getElementById('progress-text').textContent).toBe('批次 3/10：已處理 15/25 本書籍')
      expect(document.getElementById('progress-percentage').textContent).toBe('26%')
    })

    test('應該處理提取完成事件', async () => {
      // Given: 已初始化的控制器且正在提取
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const extractionService = controller.getComponent('extraction')
      extractionService.isExtracting = true
      extractionService.currentExtractionId = 'test_extraction'

      // When: 處理完成事件
      // eslint-disable-next-line no-unused-vars
      const completionData = {
        totalProcessed: 150,
        successCount: 145,
        failureCount: 5,
        duration: 180000 // 3分鐘
      }

      extractionService.handleExtractionCompleted(completionData)

      // Then: 狀態應該正確更新
      expect(document.getElementById('status-text').textContent).toBe('提取完成')
      expect(document.getElementById('status-info').textContent).toBe('成功處理 145/150 本書籍，耗時 3 分鐘')

      // 提取狀態應該重置
      expect(extractionService.isExtracting).toBe(false)
      expect(extractionService.currentExtractionId).toBeNull()
    })

    test('應該支援重試機制', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const extractionService = controller.getComponent('extraction')

      // Mock Chrome API 前兩次失敗，第三次成功
      // eslint-disable-next-line no-unused-vars
      let callCount = 0
      mockChromeAPI.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([{
          id: 123,
          url: 'https://readmoo.com/library',
          title: 'Readmoo 書庫'
        }])
      })

      mockChromeAPI.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callCount++
        if (callCount <= 2) {
          mockChromeAPI.runtime.lastError = { message: 'Network error' }
          callback(null)
        } else {
          mockChromeAPI.runtime.lastError = null
          callback({ success: true, extractionId: 'ext_retry' })
        }
      })

      // When: 開始提取（會重試）
      // eslint-disable-next-line no-unused-vars
      const result = await extractionService.startExtraction()

      // Then: 應該在重試後成功
      expect(result.success).toBe(true)
      expect(result.extractionId).toBe('ext_retry')
      expect(extractionService.retryCount).toBe(2) // 兩次重試
    })

    test('應該處理重試耗盡的情況', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const extractionService = controller.getComponent('extraction')

      // Mock Chrome API 持續失敗
      mockChromeAPI.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([{
          id: 123,
          url: 'https://readmoo.com/library',
          title: 'Readmoo 書庫'
        }])
      })

      mockChromeAPI.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        mockChromeAPI.runtime.lastError = { message: 'Persistent network error' }
        callback(null)
      })

      // When: 嘗試開始提取
      // Then: 應該在重試耗盡後拋出錯誤
      await expect(extractionService.startExtraction()).rejects.toThrowError(expect.objectContaining({
        code: ErrorCodes.OPERATION_ERROR
      }))

      // 狀態應該顯示錯誤
      expect(document.getElementById('status-text').textContent).toBe('提取失敗')
      expect(extractionService.isExtracting).toBe(false)
    })

    test('應該維護提取統計', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const extractionService = controller.getComponent('extraction')

      // When: 模擬完成一次提取
      extractionService.currentExtractionId = 'test_stats'
      extractionService._recordExtractionStart({ estimatedCount: 100 })

      // eslint-disable-next-line no-unused-vars
      const completionData = {
        totalProcessed: 100,
        successCount: 95,
        failureCount: 5
      }
      extractionService._recordExtractionCompletion(completionData)

      // Then: 統計應該正確記錄
      // eslint-disable-next-line no-unused-vars
      const stats = extractionService.getExtractionStatistics()
      expect(stats.totalExtractions).toBe(1)
      expect(stats.totalBooksProcessed).toBe(100)
      expect(stats.totalBooksSuccessful).toBe(95)
      expect(stats.averageSuccessRate).toBe(95)
    })

    test('應該支援狀態一致性驗證', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const extractionService = controller.getComponent('extraction')
      // eslint-disable-next-line no-unused-vars
      const statusManager = controller.getComponent('status')
      // eslint-disable-next-line no-unused-vars
      const progressManager = controller.getComponent('progress')

      // When: 設置一致的狀態
      statusManager.updateStatus({ type: 'extracting', text: '提取中' })
      progressManager.updateProgress({ percentage: 50, status: 'processing' })

      // Then: 狀態一致性應該通過
      expect(extractionService.validateStateConsistency()).toBe(true)

      // When: 設置不一致的狀態
      statusManager.updateStatus({ type: 'ready', text: '就緒' })
      // 進度仍然是 processing

      // Then: 狀態一致性應該失敗
      expect(extractionService.validateStateConsistency()).toBe(false)
    })
  })

  describe('⚠️ 錯誤處理測試', () => {
    test('應該能夠清理資源', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const extractionService = controller.getComponent('extraction')
      // eslint-disable-next-line no-unused-vars
      const communicationService = controller.getComponent('communication')

      // Mock cleanup 方法
      // eslint-disable-next-line no-unused-vars
      const cleanupSpy = jest.spyOn(communicationService, 'cleanup')

      // 設置一些狀態
      extractionService.isExtracting = true
      extractionService.currentExtractionId = 'test_cleanup'
      extractionService.componentErrors = [{ error: 'test error' }]

      // When: 清理資源
      extractionService.cleanup()

      // Then: 資源應該被清理
      expect(cleanupSpy).toHaveBeenCalled()
      expect(extractionService.isExtracting).toBe(false)
      expect(extractionService.currentExtractionId).toBeNull()
      expect(extractionService.componentErrors).toHaveLength(0)
    })

    test('應該優雅處理組件錯誤', async () => {
      // Given: 已初始化的控制器
      // eslint-disable-next-line no-unused-vars
      const controller = new PopupController(document)
      await controller.initialize()

      // eslint-disable-next-line no-unused-vars
      const extractionService = controller.getComponent('extraction')

      // Mock StatusManager 拋出錯誤
      // eslint-disable-next-line no-unused-vars
      const statusManager = controller.getComponent('status')
      jest.spyOn(statusManager, 'updateStatus').mockImplementation(() => {
        // eslint-disable-next-line no-unused-vars
        const error = new Error('Status update failed')
        error.code = ErrorCodes.OPERATION_ERROR
        error.details = { category: 'testing' }
        throw error
      })

      // When: 嘗試協調狀態更新
      extractionService.coordinateStatusUpdate({
        type: 'extracting',
        text: '測試錯誤處理'
      })

      // Then: 錯誤應該被記錄但不拋出
      expect(extractionService.componentErrors).toHaveLength(1)
      expect(extractionService.componentErrors[0].component).toBe('StatusManager')
      expect(extractionService.componentErrors[0].error).toBe('Status update failed')
    })
  })
})
