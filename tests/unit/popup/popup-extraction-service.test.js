/**
 * PopupExtractionService 單元測試
 *
 * 負責測試：
 * - 業務邏輯協調和依賴整合
 * - 提取流程生命週期控制
 * - 錯誤處理和重試機制
 * - 資料處理協調和驗證
 * - 組件間協調和狀態同步
 */

describe('PopupExtractionService 核心功能', () => {
  let extractionService
  let mockStatusManager
  let mockProgressManager
  let mockCommunicationService

  beforeEach(() => {
    // 建立 Mock StatusManager
    mockStatusManager = {
      updateStatus: jest.fn(),
      getCurrentStatus: jest.fn().mockReturnValue({ type: 'ready', text: '就緒' }),
      syncFromBackground: jest.fn(),
      handleSyncFailure: jest.fn()
    }

    // 建立 Mock ProgressManager
    mockProgressManager = {
      updateProgress: jest.fn(),
      startProgress: jest.fn(),
      completeProgress: jest.fn(),
      cancelProgress: jest.fn(),
      getCurrentProgress: jest.fn().mockReturnValue({
        percentage: 0,
        status: 'idle',
        isVisible: false
      })
    }

    // 建立 Mock CommunicationService
    mockCommunicationService = {
      checkBackgroundStatus: jest.fn().mockResolvedValue({ isReady: true }),
      startExtraction: jest.fn().mockResolvedValue({
        success: true,
        estimatedCount: 100
      }),
      isReadmooPage: jest.fn().mockReturnValue(true),
      cleanup: jest.fn()
    }

    // 重置所有 Mock
    jest.clearAllMocks()
  })

  describe('🏗 建構和初始化', () => {
    test('應該正確初始化提取服務', () => {
      // Given: 提取服務的依賴
      const PopupExtractionService = require('../../../src/popup/services/popup-extraction-service.js')

      // When: 建立提取服務
      extractionService = new PopupExtractionService(
        mockStatusManager,
        mockProgressManager,
        mockCommunicationService
      )

      // Then: 服務正確初始化
      expect(extractionService).toBeDefined()
      expect(extractionService.statusManager).toBe(mockStatusManager)
      expect(extractionService.progressManager).toBe(mockProgressManager)
      expect(extractionService.communicationService).toBe(mockCommunicationService)
    })

    test('應該驗證依賴注入的完整性', () => {
      // Given: 缺少必要依賴
      const PopupExtractionService = require('../../../src/popup/services/popup-extraction-service.js')

      // When & Then: 應該拋出錯誤
      expect(() => {
        new PopupExtractionService(null, mockProgressManager, mockCommunicationService)
      }).toThrow('StatusManager is required')

      expect(() => {
        new PopupExtractionService(mockStatusManager, null, mockCommunicationService)
      }).toThrow('ProgressManager is required')

      expect(() => {
        new PopupExtractionService(mockStatusManager, mockProgressManager, null)
      }).toThrow('CommunicationService is required')
    })

    test('應該支援提取選項配置', () => {
      // Given: 自訂提取選項
      const PopupExtractionService = require('../../../src/popup/services/popup-extraction-service.js')
      const options = {
        maxRetries: 5,
        timeout: 10000,
        batchSize: 50
      }

      // When: 使用選項建立服務
      extractionService = new PopupExtractionService(
        mockStatusManager,
        mockProgressManager,
        mockCommunicationService,
        options
      )

      // Then: 選項正確設定
      expect(extractionService.config.maxRetries).toBe(5)
      expect(extractionService.config.timeout).toBe(10000)
      expect(extractionService.config.batchSize).toBe(50)
    })
  })

  describe('🔄 提取流程控制', () => {
    beforeEach(() => {
      const PopupExtractionService = require('../../../src/popup/services/popup-extraction-service.js')
      extractionService = new PopupExtractionService(
        mockStatusManager,
        mockProgressManager,
        mockCommunicationService
      )
    })

    test('應該正確執行完整提取流程', async () => {
      // Given: 成功的通訊回應
      mockCommunicationService.startExtraction.mockResolvedValue({
        success: true,
        estimatedCount: 150,
        message: '開始提取書庫資料'
      })

      // When: 開始提取
      const result = await extractionService.startExtraction()

      // Then: 流程正確執行
      expect(mockStatusManager.updateStatus).toHaveBeenCalledWith({
        type: 'extracting',
        text: '正在提取資料',
        info: '已開始書庫資料提取流程'
      })
      expect(mockProgressManager.startProgress).toHaveBeenCalledWith({
        title: '提取書庫資料',
        estimatedTotal: 150
      })
      expect(mockCommunicationService.startExtraction).toHaveBeenCalled()
      expect(result.success).toBe(true)
    })

    test('應該防止重複開始提取', async () => {
      // Given: 已經在提取中
      extractionService.isExtracting = true

      // When: 嘗試再次開始提取
      await expect(extractionService.startExtraction())
        .rejects.toThrow('Extraction already in progress')

      // Then: 不應該重複呼叫通訊服務
      expect(mockCommunicationService.startExtraction).not.toHaveBeenCalled()
    })

    test('應該正確取消進行中的提取', async () => {
      // Given: 進行中的提取
      extractionService.isExtracting = true
      extractionService.currentExtractionId = 'test-123'

      // When: 取消提取
      const result = await extractionService.cancelExtraction('使用者取消')

      // Then: 取消流程正確執行
      expect(mockStatusManager.updateStatus).toHaveBeenCalledWith({
        type: 'ready',
        text: '提取已取消',
        info: '使用者取消'
      })
      expect(mockProgressManager.cancelProgress).toHaveBeenCalledWith('使用者取消')
      expect(extractionService.isExtracting).toBe(false)
      expect(result.cancelled).toBe(true)
    })
  })

  describe('⚠️ 錯誤處理和重試機制', () => {
    beforeEach(() => {
      const PopupExtractionService = require('../../../src/popup/services/popup-extraction-service.js')
      extractionService = new PopupExtractionService(
        mockStatusManager,
        mockProgressManager,
        mockCommunicationService,
        { maxRetries: 3 }
      )
    })

    test('應該實現重試機制處理通訊失敗', async () => {
      // Given: 前兩次失敗，第三次成功
      mockCommunicationService.startExtraction
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce({ success: true, estimatedCount: 100 })

      // When: 開始提取（會自動重試）
      const result = await extractionService.startExtraction()

      // Then: 重試成功
      expect(mockCommunicationService.startExtraction).toHaveBeenCalledTimes(3)
      expect(result.success).toBe(true)
      expect(extractionService.retryCount).toBe(2)
    })

    test('應該在達到最大重試次數後失敗', async () => {
      // Given: 持續失敗的通訊
      mockCommunicationService.startExtraction.mockRejectedValue(
        new Error('Persistent failure')
      )

      // When: 嘗試開始提取
      await expect(extractionService.startExtraction())
        .rejects.toThrow('Extraction failed after 3 retries')

      // Then: 達到最大重試次數
      expect(mockCommunicationService.startExtraction).toHaveBeenCalledTimes(3)
      expect(mockStatusManager.updateStatus).toHaveBeenCalledWith({
        type: 'error',
        text: '提取失敗',
        info: 'Persistent failure'
      })
    })

    test('應該處理部分失敗的恢復機制', async () => {
      // Given: 部分成功的提取結果
      const partialResult = {
        success: false,
        totalProcessed: 100,
        successCount: 75,
        failureCount: 25,
        errors: ['無法存取部分書籍', '網路連線不穩定']
      }

      // When: 處理部分失敗
      extractionService.handlePartialFailure(partialResult)

      // Then: 狀態正確更新
      expect(mockStatusManager.updateStatus).toHaveBeenCalledWith({
        type: 'completed',
        text: '提取部分完成',
        info: '成功處理 75/100 本書籍，25 個項目失敗'
      })
      expect(mockProgressManager.completeProgress).toHaveBeenCalledWith(partialResult)
    })
  })

  describe('📊 資料處理協調', () => {
    beforeEach(() => {
      const PopupExtractionService = require('../../../src/popup/services/popup-extraction-service.js')
      extractionService = new PopupExtractionService(
        mockStatusManager,
        mockProgressManager,
        mockCommunicationService
      )
    })

    test('應該正確驗證和處理提取結果', () => {
      // Given: 有效的提取結果
      const extractionResult = {
        books: [
          { id: '1', title: '書籍A', author: '作者A', status: 'success' },
          { id: '2', title: '書籍B', author: '作者B', status: 'success' }
        ],
        totalProcessed: 2,
        successCount: 2,
        failureCount: 0
      }

      // When: 處理結果
      const processedResult = extractionService.processExtractionResult(extractionResult)

      // Then: 結果正確處理
      expect(processedResult.isValid).toBe(true)
      expect(processedResult.summary).toEqual({
        totalBooks: 2,
        successfulBooks: 2,
        failedBooks: 0,
        successRate: 100
      })
    })

    test('應該處理無效或損壞的資料', () => {
      // Given: 無效的提取結果
      const invalidResult = {
        books: null,
        totalProcessed: 'invalid',
        successCount: undefined
      }

      // When: 嘗試處理結果
      expect(() => {
        extractionService.processExtractionResult(invalidResult)
      }).toThrow('Invalid extraction result format')

      // Then: 錯誤狀態正確更新
      expect(mockStatusManager.updateStatus).toHaveBeenCalledWith({
        type: 'error',
        text: '資料處理失敗',
        info: '提取結果格式無效'
      })
    })

    test('應該正確追蹤批次處理進度', () => {
      // Given: 批次進度資料
      const batchProgress = {
        currentBatch: 3,
        totalBatches: 10,
        batchSize: 50,
        processedInBatch: 35,
        totalProcessed: 135
      }

      // When: 更新批次進度
      extractionService.updateBatchProgress(batchProgress)

      // Then: 進度正確計算和更新
      const expectedPercentage = Math.round((135 / 500) * 100) // 總計約 500 本書
      expect(mockProgressManager.updateProgress).toHaveBeenCalledWith({
        percentage: expectedPercentage,
        status: 'processing',
        text: '批次 3/10：已處理 35/50 本書籍'
      })
    })
  })

  describe('🔄 組件協調和狀態同步', () => {
    beforeEach(() => {
      const PopupExtractionService = require('../../../src/popup/services/popup-extraction-service.js')
      extractionService = new PopupExtractionService(
        mockStatusManager,
        mockProgressManager,
        mockCommunicationService
      )
    })

    test('應該正確協調狀態管理器更新', () => {
      // Given: 狀態更新事件
      const statusUpdate = {
        type: 'extracting',
        text: '正在處理書庫資料',
        info: '目前處理進度 45%',
        timestamp: Date.now()
      }

      // When: 協調狀態更新
      extractionService.coordinateStatusUpdate(statusUpdate)

      // Then: 狀態管理器正確更新
      expect(mockStatusManager.updateStatus).toHaveBeenCalledWith(statusUpdate)
      expect(extractionService.lastStatusUpdate).toEqual(statusUpdate)
    })

    test('應該同步處理進度和狀態的一致性', () => {
      // Given: 進度資料和狀態不一致
      mockProgressManager.getCurrentProgress.mockReturnValue({
        percentage: 75,
        status: 'processing'
      })
      mockStatusManager.getCurrentStatus.mockReturnValue({
        type: 'extracting'
      })

      // When: 檢查一致性
      const isConsistent = extractionService.validateStateConsistency()

      // Then: 一致性檢查正確
      expect(isConsistent).toBe(true)
    })

    test('應該處理組件間通訊錯誤', () => {
      // Given: StatusManager 更新失敗
      mockStatusManager.updateStatus.mockImplementation(() => {
        throw new Error('Status update failed')
      })

      // When: 嘗試更新狀態
      const statusUpdate = { type: 'error', text: '測試錯誤', info: '測試' }
      extractionService.coordinateStatusUpdate(statusUpdate)

      // Then: 錯誤被優雅處理
      expect(extractionService.componentErrors).toHaveLength(1)
      expect(extractionService.componentErrors[0]).toMatchObject({
        component: 'StatusManager',
        error: 'Status update failed'
      })
    })

    test('應該正確處理提取完成事件', () => {
      // Given: 提取完成資料
      const completionData = {
        totalProcessed: 250,
        successCount: 230,
        failureCount: 20,
        duration: 120000, // 2 分鐘
        extractedData: ['book1', 'book2']
      }

      // When: 處理完成事件
      extractionService.handleExtractionCompleted(completionData)

      // Then: 所有組件正確更新
      expect(mockProgressManager.completeProgress).toHaveBeenCalledWith(completionData)
      expect(mockStatusManager.updateStatus).toHaveBeenCalledWith({
        type: 'completed',
        text: '提取完成',
        info: '成功處理 230/250 本書籍，耗時 2 分鐘'
      })
      expect(extractionService.isExtracting).toBe(false)
    })

    test('應該處理通訊服務事件流', () => {
      // Given: 通訊事件序列
      const events = [
        { type: 'EXTRACTION_STARTED', data: { estimatedCount: 100 } },
        { type: 'EXTRACTION_PROGRESS', data: { percentage: 25, text: '25%' } },
        { type: 'EXTRACTION_PROGRESS', data: { percentage: 50, text: '50%' } },
        { type: 'EXTRACTION_COMPLETED', data: { successCount: 95 } }
      ]

      // When: 處理事件序列
      events.forEach(event => {
        extractionService.handleCommunicationEvent(event)
      })

      // Then: 事件正確處理
      expect(mockProgressManager.startProgress).toHaveBeenCalled()
      expect(mockProgressManager.updateProgress).toHaveBeenCalledTimes(2)
      expect(mockProgressManager.completeProgress).toHaveBeenCalled()
    })

    test('應該實現清理和資源釋放', () => {
      // Given: 活躍的提取服務
      extractionService.isExtracting = true
      extractionService.currentExtractionId = 'test-456'

      // When: 清理服務
      extractionService.cleanup()

      // Then: 資源正確釋放
      expect(mockCommunicationService.cleanup).toHaveBeenCalled()
      expect(extractionService.isExtracting).toBe(false)
      expect(extractionService.currentExtractionId).toBeNull()
    })

    test('應該處理併發提取請求', async () => {
      // Given: 並行的提取請求
      const request1 = extractionService.startExtraction()
      const request2 = extractionService.startExtraction()

      // When: 等待結果
      const results = await Promise.allSettled([request1, request2])

      // Then: 只有一個成功，另一個被拒絕
      const [result1, result2] = results
      expect(result1.status).toBe('fulfilled')
      expect(result2.status).toBe('rejected')
      expect(result2.reason.message).toContain('already in progress')
    })

    test('應該提供提取統計和報告', () => {
      // Given: 完成的提取歷史
      extractionService.extractionHistory = [
        {
          id: 'extraction-1',
          startTime: Date.now() - 300000,
          endTime: Date.now() - 240000,
          successCount: 50,
          totalProcessed: 55
        },
        {
          id: 'extraction-2',
          startTime: Date.now() - 180000,
          endTime: Date.now() - 120000,
          successCount: 75,
          totalProcessed: 80
        }
      ]

      // When: 生成統計報告
      const stats = extractionService.getExtractionStatistics()

      // Then: 統計正確計算
      expect(stats).toMatchObject({
        totalExtractions: 2,
        totalBooksProcessed: 135,
        totalBooksSuccessful: 125,
        averageSuccessRate: expect.closeTo(92.6, 1),
        averageDuration: expect.any(Number)
      })
    })
  })
})
