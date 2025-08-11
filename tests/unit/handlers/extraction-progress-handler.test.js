/**
 * ExtractionProgressHandler 測試套件
 *
 * 負責功能：
 * - 監聽 EXTRACTION.PROGRESS 事件
 * - 處理提取進度資料
 * - 觸發 UI.PROGRESS.UPDATE 事件
 * - 驗證進度資料有效性
 * - 提供進度統計追蹤
 *
 * 設計考量：
 * - 繼承自 EventHandler 基底類別
 * - 專責處理提取進度相關事件
 * - 確保進度資料的完整性和有效性
 * - 支援即時UI更新機制
 *
 * 處理流程：
 * 1. 接收 EXTRACTION.PROGRESS 事件
 * 2. 驗證進度資料格式和有效性
 * 3. 處理進度統計和狀態更新
 * 4. 觸發 UI.PROGRESS.UPDATE 事件
 * 5. 記錄進度處理統計
 *
 * 使用情境：
 * - BookDataExtractor 報告提取進度時
 * - 需要實時更新UI進度顯示時
 * - 追蹤提取過程狀態變化時
 */

const EventHandler = require('@/core/event-handler')

describe('ExtractionProgressHandler', () => {
  let ExtractionProgressHandler
  let handler
  let mockEventBus

  beforeEach(async () => {
    // 動態載入以避免模組依賴問題
    try {
      ExtractionProgressHandler = require('@/handlers/extraction-progress-handler')
    } catch (error) {
      // 紅燈階段：檔案尚未存在
    }

    if (ExtractionProgressHandler) {
      handler = new ExtractionProgressHandler()
      mockEventBus = {
        emit: jest.fn().mockResolvedValue(true),
        on: jest.fn(),
        off: jest.fn()
      }
    }
  })

  afterEach(() => {
    if (handler) {
      handler.destroy()
    }
    jest.clearAllMocks()
  })

  describe('處理器基本結構和繼承 (Cycle #7)', () => {
    test('應該能創建 ExtractionProgressHandler 實例', () => {
      expect(ExtractionProgressHandler).toBeDefined()
      expect(handler).toBeInstanceOf(ExtractionProgressHandler)
      expect(handler).toBeInstanceOf(EventHandler)
    })

    test('應該有正確的處理器名稱和優先級', () => {
      expect(handler.handlerName).toBe('ExtractionProgressHandler')
      expect(handler.priority).toBe(200) // NORMAL 優先級
      expect(handler.isEnabled).toBe(true)
    })

    test('應該支援 EXTRACTION.PROGRESS 事件類型', () => {
      const supportedEvents = handler.getSupportedEvents()
      expect(supportedEvents).toContain('EXTRACTION.PROGRESS')
      expect(handler.isEventSupported('EXTRACTION.PROGRESS')).toBe(true)
    })

    test('應該正確初始化進度處理狀態', () => {
      expect(handler.progressStats).toBeDefined()
      expect(handler.progressStats.totalProgressEvents).toBe(0)
      expect(handler.progressStats.successfulUpdates).toBe(0)
      expect(handler.progressStats.failedUpdates).toBe(0)
      expect(handler.currentExtractionFlows).toBeInstanceOf(Map)
    })
  })

  describe('EXTRACTION.PROGRESS 事件處理 (Cycle #7)', () => {
    beforeEach(() => {
      handler.setEventBus(mockEventBus)
    })

    test('應該能處理有效的進度事件', async () => {
      const progressEvent = {
        type: 'EXTRACTION.PROGRESS',
        timestamp: Date.now(),
        flowId: 'flow-001',
        data: {
          url: 'https://store.readmoo.com/shelf/reading',
          currentStep: 'parsing',
          currentStepIndex: 2,
          totalSteps: 5,
          progressPercentage: 40,
          processedBooks: 8,
          totalBooks: 20,
          estimatedTimeRemaining: 15000,
          details: {
            phase: 'data-extraction',
            message: '正在提取書籍資料...'
          }
        }
      }

      const result = await handler.handle(progressEvent)

      expect(result.success).toBe(true)
      expect(result.progressData).toBeDefined()
      expect(result.uiUpdateTriggered).toBe(true)
      expect(handler.progressStats.totalProgressEvents).toBe(1)
      expect(handler.progressStats.successfulUpdates).toBe(1)
    })

    test('應該能追蹤多個提取流程的進度', async () => {
      const flow1Event = {
        type: 'EXTRACTION.PROGRESS',
        flowId: 'flow-001',
        data: { progressPercentage: 25, currentStep: 'initialization' }
      }

      const flow2Event = {
        type: 'EXTRACTION.PROGRESS',
        flowId: 'flow-002',
        data: { progressPercentage: 60, currentStep: 'parsing' }
      }

      await handler.handle(flow1Event)
      await handler.handle(flow2Event)

      expect(handler.currentExtractionFlows.size).toBe(2)
      expect(handler.currentExtractionFlows.get('flow-001').progressPercentage).toBe(25)
      expect(handler.currentExtractionFlows.get('flow-002').progressPercentage).toBe(60)
    })

    test('應該驗證進度資料的有效性', async () => {
      const invalidProgressEvent = {
        type: 'EXTRACTION.PROGRESS',
        flowId: 'flow-001',
        data: {
          progressPercentage: 150, // 無效：超過100%
          currentStepIndex: -1, // 無效：負數
          totalSteps: 0 // 無效：零步驟
        }
      }

      const result = await handler.handle(invalidProgressEvent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid progress data')
      expect(handler.progressStats.failedUpdates).toBe(1)
    })

    test('應該處理進度資料的邊界情況', async () => {
      const edgeCaseEvents = [
        {
          type: 'EXTRACTION.PROGRESS',
          flowId: 'flow-start',
          data: { progressPercentage: 0, currentStep: 'start' }
        },
        {
          type: 'EXTRACTION.PROGRESS',
          flowId: 'flow-complete',
          data: { progressPercentage: 100, currentStep: 'completed' }
        },
        {
          type: 'EXTRACTION.PROGRESS',
          flowId: 'flow-minimal',
          data: { progressPercentage: 50 } // 最小必要資料
        }
      ]

      for (const event of edgeCaseEvents) {
        const result = await handler.handle(event)
        expect(result.success).toBe(true)
      }

      expect(handler.progressStats.successfulUpdates).toBe(3)
    })
  })

  describe('UI.PROGRESS.UPDATE 事件觸發 (Cycle #7)', () => {
    beforeEach(() => {
      handler.setEventBus(mockEventBus)
    })

    test('應該觸發正確格式的 UI 進度更新事件', async () => {
      const progressEvent = {
        type: 'EXTRACTION.PROGRESS',
        flowId: 'flow-001',
        data: {
          url: 'https://store.readmoo.com/shelf/reading',
          progressPercentage: 75,
          currentStep: 'data-processing',
          processedBooks: 15,
          totalBooks: 20,
          estimatedTimeRemaining: 5000
        }
      }

      await handler.handle(progressEvent)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'UI.PROGRESS.UPDATE',
        expect.objectContaining({
          type: 'UI.PROGRESS.UPDATE',
          timestamp: expect.any(Number),
          flowId: 'flow-001',
          data: expect.objectContaining({
            progressPercentage: 75,
            currentStep: 'data-processing',
            processedBooks: 15,
            totalBooks: 20,
            estimatedTimeRemaining: 5000,
            url: 'https://store.readmoo.com/shelf/reading'
          })
        })
      )
    })

    test('應該在多個進度更新時觸發對應的 UI 事件', async () => {
      const progressUpdates = [
        { flowId: 'flow-001', progressPercentage: 25 },
        { flowId: 'flow-001', progressPercentage: 50 },
        { flowId: 'flow-001', progressPercentage: 75 }
      ]

      for (const update of progressUpdates) {
        await handler.handle({
          type: 'EXTRACTION.PROGRESS',
          flowId: update.flowId,
          data: update
        })
      }

      expect(mockEventBus.emit).toHaveBeenCalledTimes(3)
      expect(mockEventBus.emit).toHaveBeenNthCalledWith(1, 'UI.PROGRESS.UPDATE', expect.any(Object))
      expect(mockEventBus.emit).toHaveBeenNthCalledWith(2, 'UI.PROGRESS.UPDATE', expect.any(Object))
      expect(mockEventBus.emit).toHaveBeenNthCalledWith(3, 'UI.PROGRESS.UPDATE', expect.any(Object))
    })

    test('應該在觸發 UI 事件失敗時記錄錯誤', async () => {
      mockEventBus.emit.mockRejectedValueOnce(new Error('UI event failed'))

      const progressEvent = {
        type: 'EXTRACTION.PROGRESS',
        flowId: 'flow-001',
        data: { progressPercentage: 50 }
      }

      const result = await handler.handle(progressEvent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('UI event failed')
      expect(handler.progressStats.failedUpdates).toBe(1)
    })
  })

  describe('進度資料驗證和處理 (Cycle #7)', () => {
    test('應該驗證進度百分比範圍', async () => {
      const testCases = [
        { progressPercentage: -10, expected: false },
        { progressPercentage: 0, expected: true },
        { progressPercentage: 50, expected: true },
        { progressPercentage: 100, expected: true },
        { progressPercentage: 110, expected: false }
      ]

      for (const testCase of testCases) {
        const result = await handler.validateProgressData({
          progressPercentage: testCase.progressPercentage
        })
        expect(result.valid).toBe(testCase.expected)
      }
    })

    test('應該驗證步驟資料的一致性', async () => {
      const validStepData = {
        currentStepIndex: 2,
        totalSteps: 5,
        currentStep: 'parsing'
      }

      const invalidStepData = {
        currentStepIndex: 6, // 超過總步驟數
        totalSteps: 5,
        currentStep: 'invalid-step'
      }

      const validResult = await handler.validateProgressData(validStepData)
      const invalidResult = await handler.validateProgressData(invalidStepData)

      expect(validResult.valid).toBe(true)
      expect(invalidResult.valid).toBe(false)
      expect(invalidResult.errors).toContain('currentStepIndex exceeds totalSteps')
    })

    test('應該計算並提供進度預估', async () => {
      const progressData = {
        progressPercentage: 40,
        processedBooks: 8,
        totalBooks: 20,
        startTime: Date.now() - 10000 // 10秒前開始
      }

      const estimation = await handler.calculateProgressEstimation(progressData)

      expect(estimation.estimatedTimeRemaining).toBeGreaterThan(0)
      expect(estimation.estimatedCompletionTime).toBeGreaterThan(Date.now())
      expect(estimation.processingRate).toBeCloseTo(0.8) // 8 books / 10 seconds = 0.8 books/second
    })
  })

  describe('進度統計和狀態管理 (Cycle #7)', () => {
    test('應該正確追蹤進度統計', async () => {
      // 處理多個進度事件
      const events = [
        { type: 'EXTRACTION.PROGRESS', flowId: 'flow-1', data: { progressPercentage: 25 } },
        { type: 'EXTRACTION.PROGRESS', flowId: 'flow-2', data: { progressPercentage: 50 } },
        { type: 'EXTRACTION.PROGRESS', flowId: 'flow-1', data: { progressPercentage: 75 } }
      ]

      handler.setEventBus(mockEventBus)

      for (const event of events) {
        await handler.handle(event)
      }

      const stats = handler.getProgressStats()
      expect(stats.totalProgressEvents).toBe(3)
      expect(stats.successfulUpdates).toBe(3)
      expect(stats.failedUpdates).toBe(0)
      expect(stats.activeFlows).toBe(2)
    })

    test('應該提供當前活躍流程的詳細資訊', async () => {
      const progressEvent = {
        type: 'EXTRACTION.PROGRESS',
        flowId: 'flow-detailed',
        data: {
          url: 'https://store.readmoo.com/shelf/reading',
          progressPercentage: 60,
          currentStep: 'data-validation',
          processedBooks: 12,
          totalBooks: 20
        }
      }

      handler.setEventBus(mockEventBus)
      await handler.handle(progressEvent)

      const activeFlows = handler.getActiveExtractionFlows()
      expect(activeFlows.size).toBe(1)

      const flowInfo = activeFlows.get('flow-detailed')
      expect(flowInfo.progressPercentage).toBe(60)
      expect(flowInfo.currentStep).toBe('data-validation')
      expect(flowInfo.url).toBe('https://store.readmoo.com/shelf/reading')
    })

    test('應該能清理完成的提取流程', async () => {
      // 直接添加流程資料 (避免 EventBus 依賴)
      handler.addExtractionFlow('flow-1', { progressPercentage: 100, currentStep: 'completed' })
      handler.addExtractionFlow('flow-2', { progressPercentage: 50, currentStep: 'processing' })

      // 清理完成的流程
      await handler.cleanupCompletedFlows()

      const activeFlows = handler.getActiveExtractionFlows()
      expect(activeFlows.size).toBe(1)
      expect(activeFlows.has('flow-2')).toBe(true)
      expect(activeFlows.has('flow-1')).toBe(false)
    })
  })

  describe('錯誤處理和復原機制 (Cycle #7)', () => {
    test('應該處理缺少必要進度資料的事件', async () => {
      const incompleteEvent = {
        type: 'EXTRACTION.PROGRESS',
        flowId: 'flow-incomplete'
        // 缺少 data 欄位
      }

      handler.setEventBus(mockEventBus)
      const result = await handler.handle(incompleteEvent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Missing required progress data')
      expect(handler.progressStats.failedUpdates).toBe(1)
    })

    test('應該處理進度資料格式錯誤', async () => {
      const malformedEvent = {
        type: 'EXTRACTION.PROGRESS',
        flowId: 'flow-malformed',
        data: 'invalid-data-format' // 應該是 object
      }

      handler.setEventBus(mockEventBus)
      const result = await handler.handle(malformedEvent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid progress data format')
    })

    test('應該處理 EventBus 未設置的情況', async () => {
      // 不設置 EventBus
      const progressEvent = {
        type: 'EXTRACTION.PROGRESS',
        flowId: 'flow-no-bus',
        data: { progressPercentage: 50 }
      }

      const result = await handler.handle(progressEvent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('EventBus not configured')
    })

    test('應該在錯誤後能夠恢復正常處理', async () => {
      handler.setEventBus(mockEventBus)

      // 先處理一個錯誤事件
      await handler.handle({
        type: 'EXTRACTION.PROGRESS',
        flowId: 'flow-error',
        data: { progressPercentage: -10 } // 無效數據
      })

      // 再處理一個正確事件
      const result = await handler.handle({
        type: 'EXTRACTION.PROGRESS',
        flowId: 'flow-recovery',
        data: { progressPercentage: 50 }
      })

      expect(result.success).toBe(true)
      expect(handler.progressStats.failedUpdates).toBe(1)
      expect(handler.progressStats.successfulUpdates).toBe(1)
    })
  })

  describe('EventHandler 基底類別整合 (Cycle #7)', () => {
    test('應該正確實現 EventHandler 抽象方法', () => {
      expect(handler.process).toBeDefined()
      expect(typeof handler.process).toBe('function')
      expect(handler.getSupportedEvents).toBeDefined()
      expect(typeof handler.getSupportedEvents).toBe('function')
    })

    test('應該追蹤執行統計', async () => {
      handler.setEventBus(mockEventBus)

      const event = {
        type: 'EXTRACTION.PROGRESS',
        flowId: 'flow-stats',
        data: { progressPercentage: 50 }
      }

      await handler.handle(event)

      const stats = handler.getStats()
      expect(stats.executionCount).toBe(1)
      expect(stats.lastExecutionTime).toBeGreaterThan(0)
      expect(stats.averageExecutionTime).toBeGreaterThan(0)
    })

    test('應該支援啟用/停用功能', async () => {
      handler.setEnabled(false)
      handler.setEventBus(mockEventBus)

      const event = {
        type: 'EXTRACTION.PROGRESS',
        flowId: 'flow-disabled',
        data: { progressPercentage: 50 }
      }

      const result = await handler.handle(event)

      // 停用時應該跳過處理
      expect(result.success).toBe(true)
      expect(result.skipped).toBe(true)
      expect(handler.progressStats.totalProgressEvents).toBe(0)
    })
  })
})
