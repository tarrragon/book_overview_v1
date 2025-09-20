/**
 * ExtractionCompletedHandler 測試套件
 *
 * 負責功能：
 * - 監聽 EXTRACTION.COMPLETED 事件
 * - 處理提取完成資料
 * - 觸發 STORAGE.SAVE.REQUESTED 事件
 * - 觸發 UI.NOTIFICATION.SHOW 事件
 * - 觸發 ANALYTICS.EXTRACTION.COMPLETED 事件
 * - 提供完成統計追蹤
 *
 * 設計考量：
 * - 繼承自 EventHandler 基底類別
 * - HIGH 優先級確保優先處理完成事件
 * - 支援事件鏈式處理和錯誤隔離
 * - 提供詳細的完成統計和日誌
 *
 * 處理流程：
 * 1. 接收 EXTRACTION.COMPLETED 事件
 * 2. 驗證提取結果資料完整性
 * 3. 準備儲存資料結構
 * 4. 觸發 STORAGE.SAVE.REQUESTED 事件
 * 5. 觸發 UI.NOTIFICATION.SHOW 通知事件
 * 6. 觸發 ANALYTICS.EXTRACTION.COMPLETED 分析事件
 * 7. 更新完成統計和日誌
 *
 * 使用情境：
 * - BookDataExtractor 完成資料提取時
 * - 需要觸發後續儲存和通知流程時
 * - 追蹤提取完成統計時
 */

const EventHandler = require('@/core/event-handler')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

describe('ExtractionCompletedHandler', () => {
  let ExtractionCompletedHandler
  let handler
  let mockEventBus

  beforeEach(async () => {
    // 動態載入以避免模組依賴問題
    try {
      ExtractionCompletedHandler = require('@/handlers/extraction-completed-handler')
    } catch (error) {
      // 紅燈階段：檔案尚未存在
    }

    if (ExtractionCompletedHandler) {
      handler = new ExtractionCompletedHandler()
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

  describe('處理器基本結構和繼承 (Cycle #8)', () => {
    test('應該能創建 ExtractionCompletedHandler 實例', () => {
      expect(ExtractionCompletedHandler).toBeDefined()
      expect(handler).toBeInstanceOf(ExtractionCompletedHandler)
      expect(handler).toBeInstanceOf(EventHandler)
    })

    test('應該有正確的處理器名稱和優先級', () => {
      expect(handler.handlerName).toBe('ExtractionCompletedHandler')
      expect(handler.priority).toBe(100) // HIGH 優先級
      expect(handler.isEnabled).toBe(true)
    })

    test('應該支援 EXTRACTION.COMPLETED 事件類型', () => {
      const supportedEvents = handler.getSupportedEvents()
      expect(supportedEvents).toContain('EXTRACTION.COMPLETED')
      expect(handler.isEventSupported('EXTRACTION.COMPLETED')).toBe(true)
    })

    test('應該正確初始化完成處理狀態', () => {
      expect(handler.completionStats).toBeDefined()
      expect(handler.completionStats.totalCompletions).toBe(0)
      expect(handler.completionStats.successfulSaves).toBe(0)
      expect(handler.completionStats.failedSaves).toBe(0)
      expect(handler.processingHistory).toBeInstanceOf(Array)
    })
  })

  describe('EXTRACTION.COMPLETED 事件處理 (Cycle #8)', () => {
    beforeEach(() => {
      handler.setEventBus(mockEventBus)
    })

    test('應該能處理有效的完成事件', async () => {
      const completionEvent = {
        type: 'EXTRACTION.COMPLETED',
        timestamp: Date.now(),
        flowId: 'flow-001',
        data: {
          books: [
            { id: 'book1', title: '測試書籍1', cover: 'cover1.jpg' },
            { id: 'book2', title: '測試書籍2', cover: 'cover2.jpg' }
          ],
          bookstore: 'readmoo',
          extractedAt: new Date().toISOString(),
          count: 2,
          extractionDuration: 5000,
          url: 'https://store.readmoo.com/shelf/reading'
        }
      }

      const result = await handler.handle(completionEvent)

      expect(result.success).toBe(true)
      expect(result.processedBooks).toBe(2)
      expect(result.eventsTriggered).toContain('STORAGE.SAVE.REQUESTED')
      expect(result.eventsTriggered).toContain('UI.NOTIFICATION.SHOW')
      expect(handler.completionStats.totalCompletions).toBe(1)
      expect(handler.completionStats.successfulSaves).toBe(1)
    })

    test('應該能處理不同書城的完成事件', async () => {
      const bookstores = ['readmoo', 'bookclub', 'kobo']

      for (const bookstore of bookstores) {
        const completionEvent = {
          type: 'EXTRACTION.COMPLETED',
          flowId: `flow-${bookstore}`,
          data: {
            books: [{ id: 'test', title: 'Test Book' }],
            bookstore,
            count: 1
          }
        }

        const result = await handler.handle(completionEvent)
        expect(result.success).toBe(true)
        expect(result.bookstore).toBe(bookstore)
      }

      expect(handler.completionStats.totalCompletions).toBe(3)
    })

    test('應該驗證完成事件資料的完整性', async () => {
      const invalidCompletionEvent = {
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-invalid',
        data: {
          books: [], // 空書籍陣列
          bookstore: '', // 無效書城
          count: -1 // 無效計數
        }
      }

      const result = await handler.handle(invalidCompletionEvent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid completion data')
      expect(handler.completionStats.failedSaves).toBe(1)
    })

    test('應該處理大量書籍資料的完成事件', async () => {
      const largeBookSet = Array.from({ length: 100 }, (_, i) => ({
        id: `book${i}`,
        title: `測試書籍 ${i}`,
        cover: `cover${i}.jpg`
      }))

      const completionEvent = {
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-large',
        data: {
          books: largeBookSet,
          bookstore: 'readmoo',
          count: 100
        }
      }

      const result = await handler.handle(completionEvent)

      expect(result.success).toBe(true)
      expect(result.processedBooks).toBe(100)
      expect(result.dataSize).toBeGreaterThan(0)
    })
  })

  describe('STORAGE.SAVE.REQUESTED 事件觸發 (Cycle #8)', () => {
    beforeEach(() => {
      handler.setEventBus(mockEventBus)
    })

    test('應該觸發正確格式的儲存事件', async () => {
      const completionEvent = {
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-storage',
        data: {
          books: [{ id: 'book1', title: '測試書籍' }],
          bookstore: 'readmoo',
          count: 1,
          extractedAt: '2025-01-29T10:00:00.000Z'
        }
      }

      await handler.handle(completionEvent)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'STORAGE.SAVE.REQUESTED',
        expect.objectContaining({
          type: 'STORAGE.SAVE.REQUESTED',
          timestamp: expect.toBeGreaterThan(Date.now() - 10000), // 最近10秒內的時間戳，有效的時間戳格式
          flowId: 'flow-storage',
          data: expect.objectContaining({
            key: 'extracted_books',
            books: expect.arrayContaining([
              expect.objectContaining({ id: 'book1', title: '測試書籍' })
            ]),
            metadata: expect.objectContaining({
              bookstore: 'readmoo',
              extractedAt: '2025-01-29T10:00:00.000Z',
              count: 1
            }),
            options: expect.objectContaining({
              autoSave: true,
              compress: false
            })
          })
        })
      )
    })

    test('應該根據資料大小選擇壓縮選項', async () => {
      const largeBookSet = Array.from({ length: 500 }, (_, i) => ({
        id: `book${i}`,
        title: `測試書籍 ${i}`,
        content: 'x'.repeat(1000) // 增加資料大小
      }))

      const completionEvent = {
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-compress',
        data: {
          books: largeBookSet,
          bookstore: 'readmoo',
          count: 500
        }
      }

      await handler.handle(completionEvent)

      const storageCall = mockEventBus.emit.mock.calls.find(
        call => call[0] === 'STORAGE.SAVE.REQUESTED'
      )

      expect(storageCall[1].data.options.compress).toBe(true)
    })

    test('應該處理儲存事件觸發失敗', async () => {
      mockEventBus.emit.mockImplementation((eventType) => {
        if (eventType === 'STORAGE.SAVE.REQUESTED') {
          throw (() => { const error = new Error( 'Storage service unavailable'); error.code = ErrorCodes.HANDLER_STORAGE_SERVICE_UNAVAILABLE; error.details =  { category: 'testing' }; return error })()
        }
        return Promise.resolve(true)
      })

      const completionEvent = {
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-storage-fail',
        data: {
          books: [{ id: 'book1' }],
          bookstore: 'readmoo',
          count: 1
        }
      }

      const result = await handler.handle(completionEvent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Storage service unavailable')
      expect(handler.completionStats.failedSaves).toBe(1)
    })
  })

  describe('UI.NOTIFICATION.SHOW 事件觸發 (Cycle #8)', () => {
    beforeEach(() => {
      handler.setEventBus(mockEventBus)
    })

    test('應該觸發成功通知事件', async () => {
      const completionEvent = {
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-notification',
        data: {
          books: [{ id: 'book1' }, { id: 'book2' }],
          bookstore: 'readmoo',
          count: 2
        }
      }

      await handler.handle(completionEvent)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'UI.NOTIFICATION.SHOW',
        expect.objectContaining({
          type: 'UI.NOTIFICATION.SHOW',
          data: expect.objectContaining({
            type: 'success',
            message: '成功提取 2 本 readmoo 書籍資料',
            duration: 3000,
            actions: expect.arrayContaining([
              expect.objectContaining({ text: '查看詳情', action: 'view_results' }),
              expect.objectContaining({ text: '匯出資料', action: 'export_data' })
            ])
          })
        })
      )
    })

    test('應該根據提取數量調整通知訊息', async () => {
      const testCases = [
        { count: 0, expectedMessage: '未找到任何書籍資料' },
        { count: 1, expectedMessage: '成功提取 1 本 readmoo 書籍資料' },
        { count: 50, expectedMessage: '成功提取 50 本 readmoo 書籍資料' },
        { count: 100, expectedMessage: '成功提取 100 本 readmoo 書籍資料' }
      ]

      for (const testCase of testCases) {
        mockEventBus.emit.mockClear()

        const completionEvent = {
          type: 'EXTRACTION.COMPLETED',
          flowId: `flow-${testCase.count}`,
          data: {
            books: Array.from({ length: testCase.count }, (_, i) => ({ id: `book${i}` })),
            bookstore: 'readmoo',
            count: testCase.count
          }
        }

        await handler.handle(completionEvent)

        const notificationCall = mockEventBus.emit.mock.calls.find(
          call => call[0] === 'UI.NOTIFICATION.SHOW'
        )

        if (testCase.count === 0) {
          expect(notificationCall[1].data.type).toBe('warning')
        } else {
          expect(notificationCall[1].data.type).toBe('success')
        }
        expect(notificationCall[1].data.message).toBe(testCase.expectedMessage)
      }
    })

    test('應該在通知觸發失敗時繼續處理', async () => {
      mockEventBus.emit.mockImplementation((eventType) => {
        if (eventType === 'UI.NOTIFICATION.SHOW') {
          throw (() => { const error = new Error( 'UI service unavailable'); error.code = ErrorCodes.HANDLER_UI_SERVICE_UNAVAILABLE; error.details =  { category: 'testing' }; return error })()
        }
        return Promise.resolve(true)
      })

      const completionEvent = {
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-ui-fail',
        data: {
          books: [{ id: 'book1' }],
          bookstore: 'readmoo',
          count: 1
        }
      }

      const result = await handler.handle(completionEvent)

      // 即使通知失敗，整體處理應該仍然成功
      expect(result.success).toBe(true)
      expect(result.warnings).toContain('UI notification failed')
    })
  })

  describe('分析事件觸發 (Cycle #8)', () => {
    beforeEach(() => {
      handler.setEventBus(mockEventBus)
    })

    test('應該觸發分析統計事件', async () => {
      const completionEvent = {
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-analytics',
        data: {
          books: [{ id: 'book1' }],
          bookstore: 'readmoo',
          count: 1,
          extractionDuration: 3500,
          url: 'https://store.readmoo.com/shelf/reading'
        }
      }

      await handler.handle(completionEvent)

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ANALYTICS.EXTRACTION.COMPLETED',
        expect.objectContaining({
          type: 'ANALYTICS.EXTRACTION.COMPLETED',
          data: expect.objectContaining({
            bookstore: 'readmoo',
            count: 1,
            extractionDuration: 3500,
            timestamp: expect.toBeValidISOString(), // 有效的 ISO 時間格式
            sessionId: expect.toBeValidSessionId() // 有效的工作階段 ID 格式
          })
        })
      )
    })

    test('應該收集詳細的分析資料', async () => {
      const completionEvent = {
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-detailed-analytics',
        data: {
          books: [
            { id: 'book1', type: '流式', progress: 45 },
            { id: 'book2', type: '版式', progress: 100 }
          ],
          bookstore: 'readmoo',
          count: 2,
          extractionDuration: 5500,
          url: 'https://store.readmoo.com/shelf/reading'
        }
      }

      await handler.handle(completionEvent)

      const analyticsCall = mockEventBus.emit.mock.calls.find(
        call => call[0] === 'ANALYTICS.EXTRACTION.COMPLETED'
      )

      expect(analyticsCall[1].data.analytics).toEqual(
        expect.objectContaining({
          bookTypes: { 流式: 1, 版式: 1 },
          progressDistribution: { inProgress: 1, completed: 1 },
          averageProgress: 72.5,
          extractionRate: expect.toBeGreaterThan(0) // 提取率必須大於 0
        })
      )
    })
  })

  describe('完成統計和狀態管理 (Cycle #8)', () => {
    beforeEach(() => {
      handler.setEventBus(mockEventBus)
    })

    test('應該正確追蹤完成統計', async () => {
      const completionEvents = [
        {
          type: 'EXTRACTION.COMPLETED',
          flowId: 'flow-1',
          data: { books: [{ id: 'book1' }], bookstore: 'readmoo', count: 1 }
        },
        {
          type: 'EXTRACTION.COMPLETED',
          flowId: 'flow-2',
          data: { books: [{ id: 'book2' }], bookstore: 'bookclub', count: 1 }
        }
      ]

      for (const event of completionEvents) {
        await handler.handle(event)
      }

      const stats = handler.getCompletionStats()
      expect(stats.totalCompletions).toBe(2)
      expect(stats.successfulSaves).toBe(2)
      expect(stats.failedSaves).toBe(0)
      expect(stats.bookstoreBreakdown).toEqual({
        readmoo: 1,
        bookclub: 1
      })
    })

    test('應該維護處理歷史記錄', async () => {
      const completionEvent = {
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-history',
        data: {
          books: [{ id: 'book1' }],
          bookstore: 'readmoo',
          count: 1
        }
      }

      await handler.handle(completionEvent)

      const history = handler.getProcessingHistory()
      expect(history).toHaveLength(1)
      expect(history[0]).toEqual(
        expect.objectContaining({
          flowId: 'flow-history',
          bookstore: 'readmoo',
          count: 1,
          timestamp: expect.toBeGreaterThan(Date.now() - 10000), // 最近10秒內的時間戳
          processingTime: expect.toBeGreaterThan(0), // 處理時間必須大於 0ms
          success: true
        })
      )
    })

    test('應該支援歷史記錄清理', async () => {
      // 添加多個歷史記錄
      for (let i = 0; i < 15; i++) {
        await handler.handle({
          type: 'EXTRACTION.COMPLETED',
          flowId: `flow-${i}`,
          data: { books: [], bookstore: 'readmoo', count: 0 }
        })
      }

      expect(handler.getProcessingHistory()).toHaveLength(15)

      // 清理舊記錄 (保留最新10筆)
      handler.cleanupHistory(10)

      expect(handler.getProcessingHistory()).toHaveLength(10)
      expect(handler.getProcessingHistory()[0].flowId).toBe('flow-5')
    })
  })

  describe('錯誤處理和復原機制 (Cycle #8)', () => {
    beforeEach(() => {
      handler.setEventBus(mockEventBus)
    })

    test('應該處理缺少必要完成資料的事件', async () => {
      const incompleteEvent = {
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-incomplete'
        // 缺少 data 欄位
      }

      const result = await handler.handle(incompleteEvent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Missing required completion data')
      expect(handler.completionStats.failedSaves).toBe(1)
    })

    test('應該處理完成資料格式錯誤', async () => {
      const malformedEvent = {
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-malformed',
        data: 'invalid-data-format' // 應該是 object
      }

      const result = await handler.handle(malformedEvent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid completion data format')
    })

    test('應該處理 EventBus 未設置的情況', async () => {
      handler.setEventBus(null)

      const completionEvent = {
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-no-bus',
        data: { books: [], bookstore: 'readmoo', count: 0 }
      }

      const result = await handler.handle(completionEvent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('EventBus not configured')
    })

    test('應該在部分事件觸發失敗時繼續處理', async () => {
      let callCount = 0
      mockEventBus.emit.mockImplementation((eventType) => {
        callCount++
        if (eventType === 'STORAGE.SAVE.REQUESTED' && callCount === 1) {
          throw (() => { const error = new Error( 'Storage temporarily unavailable'); error.code = ErrorCodes.HANDLER_STORAGE_TEMPORARY_UNAVAILABLE; error.details =  { category: 'testing' }; return error })()
        }
        return Promise.resolve(true)
      })

      const completionEvent = {
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-partial-fail',
        data: { books: [{ id: 'book1' }], bookstore: 'readmoo', count: 1 }
      }

      const result = await handler.handle(completionEvent)

      expect(result.success).toBe(false)
      expect(result.warnings).toBeDefined()
      expect(handler.completionStats.failedSaves).toBe(1)
    })
  })

  describe('EventHandler 基底類別整合 (Cycle #8)', () => {
    test('應該正確實現 EventHandler 抽象方法', () => {
      expect(handler.process).toBeDefined()
      expect(typeof handler.process).toBe('function')
      expect(handler.getSupportedEvents).toBeDefined()
      expect(typeof handler.getSupportedEvents).toBe('function')
    })

    test('應該追蹤執行統計', async () => {
      handler.setEventBus(mockEventBus)

      const event = {
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-stats',
        data: { books: [], bookstore: 'readmoo', count: 0 }
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
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-disabled',
        data: { books: [], bookstore: 'readmoo', count: 0 }
      }

      const result = await handler.handle(event)

      // 停用時應該跳過處理
      expect(result.success).toBe(true)
      expect(result.skipped).toBe(true)
      expect(handler.completionStats.totalCompletions).toBe(0)
    })
  })

  describe('效能優化和記憶體管理 (Cycle #8)', () => {
    beforeEach(() => {
      handler.setEventBus(mockEventBus)
    })

    test('應該在處理大量資料時保持效能', async () => {
      const startTime = performance.now()

      const largeDataEvent = {
        type: 'EXTRACTION.COMPLETED',
        flowId: 'flow-performance',
        data: {
          books: Array.from({ length: 1000 }, (_, i) => ({
            id: `book${i}`,
            title: `Book ${i}`,
            content: 'Lorem ipsum '.repeat(100)
          })),
          bookstore: 'readmoo',
          count: 1000
        }
      }

      await handler.handle(largeDataEvent)

      const processingTime = performance.now() - startTime

      // 處理1000本書應該在合理時間內完成 (< 1秒)
      expect(processingTime).toBeLessThan(1000)
    })

    test('應該正確清理記憶體資源', () => {
      // 添加一些資料
      handler.processingHistory.push(
        { flowId: 'test1', timestamp: Date.now() },
        { flowId: 'test2', timestamp: Date.now() }
      )

      expect(handler.processingHistory.length).toBe(2)

      // 銷毀處理器
      handler.destroy()

      // 確認資源被清理
      expect(handler.processingHistory.length).toBe(0)
      expect(handler.completionStats.totalCompletions).toBe(0)
    })
  })
})
