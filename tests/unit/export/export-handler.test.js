/**
 * 匯出事件處理器測試 - TDD循環 #29 Red階段
 *
 * 測試範圍：
 * - 匯出請求事件處理器
 * - 進度更新事件處理器
 * - 錯誤處理和恢復機制
 * - 事件處理器的生命週期管理
 * - 多種匯出格式的專用處理器
 *
 * 功能目標：
 * - 建立模組化的匯出事件處理器
 * - 支援不同匯出格式的專門處理
 * - 提供統一的錯誤處理機制
 * - 實現進度追蹤和狀態更新
 * - 支援處理器的動態註冊和移除
 *
 * 設計考量：
 * - 繼承自 EventHandler 基底類別
 * - 遵循單一責任原則
 * - 支援處理器鏈式組合
 * - 提供完整的錯誤隔離
 * - 實現效能監控和統計
 *
 * @version 1.0.0
 * @since 2025-08-08
 */

const EventBus = require('src/core/event-bus')
const { StandardError } = require('src/core/errors/StandardError')

// Mock EventHandler 基底類別
jest.mock('../../../src/core/event-handler', () => {
  return class EventHandler {
    constructor (name, priority = 2) {
      this.name = name
      this.priority = priority
      this.isEnabled = true
      this.executionCount = 0
      this.lastExecutionTime = null
      this.averageExecutionTime = 0
    }

    async handle (event) {
      const startTime = Date.now()
      this.executionCount++

      try {
        await this.beforeHandle(event)
        const result = await this.process(event)
        await this.afterHandle(event, result)
        return result
      } catch (error) {
        await this.onError(event, error)
        throw error
      } finally {
        const executionTime = Date.now() - startTime
        this.updateStats(executionTime)
      }
    }

    async process (event) {
      throw new StandardError('METHOD_NOT_IMPLEMENTED', 'Process method must be implemented by subclass')
    }

    async beforeHandle (event) {}
    async afterHandle (event, result) {}
    async onError (event, error) {}

    updateStats (executionTime) {
      this.lastExecutionTime = executionTime
      this.averageExecutionTime =
        (this.averageExecutionTime * (this.executionCount - 1) + executionTime) /
        this.executionCount
    }

    canHandle (eventType) {
      return this.getSupportedEvents().includes(eventType)
    }

    getSupportedEvents () {
      throw new StandardError('METHOD_NOT_IMPLEMENTED', 'getSupportedEvents method must be implemented by subclass')
    }

    setEnabled (enabled) {
      this.isEnabled = enabled
    }

    getStats () {
      return {
        name: this.name,
        executionCount: this.executionCount,
        lastExecutionTime: this.lastExecutionTime,
        averageExecutionTime: this.averageExecutionTime,
        isEnabled: this.isEnabled
      }
    }
  }
})

// Mock BookDataExporter
jest.mock('../../../src/export/book-data-exporter', () => {
  return jest.fn().mockImplementation(() => ({
    exportToCSV: jest.fn().mockReturnValue('mock-csv-data'),
    exportToJSON: jest.fn().mockReturnValue('mock-json-data'),
    exportToExcel: jest.fn().mockReturnValue(new ArrayBuffer(100)),
    exportToPDF: jest.fn().mockReturnValue(new ArrayBuffer(200)),
    setProgressCallback: jest.fn(),
    getExportStats: jest.fn().mockReturnValue({
      totalExports: 1,
      formatBreakdown: { csv: 1 }
    })
  }))
})

// Mock 匯出事件系統
jest.mock('../../../src/export/export-events', () => ({
  EXPORT_EVENTS: {
    CSV_EXPORT_REQUESTED: 'EXPORT.CSV.REQUESTED',
    CSV_EXPORT_COMPLETED: 'EXPORT.CSV.COMPLETED',
    CSV_EXPORT_FAILED: 'EXPORT.CSV.FAILED',
    JSON_EXPORT_REQUESTED: 'EXPORT.JSON.REQUESTED',
    JSON_EXPORT_COMPLETED: 'EXPORT.JSON.COMPLETED',
    JSON_EXPORT_FAILED: 'EXPORT.JSON.FAILED',
    EXCEL_EXPORT_REQUESTED: 'EXPORT.EXCEL.REQUESTED',
    EXCEL_EXPORT_COMPLETED: 'EXPORT.EXCEL.COMPLETED',
    EXCEL_EXPORT_FAILED: 'EXPORT.EXCEL.FAILED',
    EXPORT_PROGRESS: 'EXPORT.PROCESS.PROGRESS',
    EXPORT_STARTED: 'EXPORT.PROCESS.STARTED',
    EXPORT_COMPLETED: 'EXPORT.PROCESS.COMPLETED',
    EXPORT_FAILED: 'EXPORT.PROCESS.FAILED'
  }
}))

describe('📤 匯出事件處理器系統測試 (TDD循環 #29 Red階段)', () => {
  let eventBus
  let mockBooks

  beforeEach(() => {
    eventBus = new EventBus()

    mockBooks = [
      {
        id: '1',
        title: 'JavaScript 高級程式設計',
        author: '張三',
        category: '程式設計',
        progress: 45
      },
      {
        id: '2',
        title: 'Python 機器學習',
        author: '李四',
        category: '機器學習',
        progress: 78
      }
    ]

    jest.clearAllMocks()
  })

  afterEach(() => {
    // 強化清理：移除所有事件監聽器
    if (eventBus && typeof eventBus.removeAllListeners === 'function') {
      eventBus.removeAllListeners()
    }

    // 清理所有 mock 和模組快取
    jest.clearAllMocks()
    jest.resetModules()
  })

  describe('🔴 Red Phase: CSVExportHandler 基本功能', () => {
    let csvHandler

    test('應該能建立 CSVExportHandler 實例', () => {
      expect(() => {
        const CSVExportHandler = require('src/export/handlers/csv-export-handler')
        csvHandler = new CSVExportHandler()
      }).not.toThrow()

      expect(csvHandler).toBeDefined()
      expect(csvHandler.name).toBe('CSVExportHandler')
    })

    test('CSVExportHandler 應該繼承自 EventHandler', () => {
      const CSVExportHandler = require('src/export/handlers/csv-export-handler')
      const EventHandler = require('src/core/event-handler')

      csvHandler = new CSVExportHandler()

      expect(csvHandler).toBeInstanceOf(EventHandler)
    })

    test('CSVExportHandler 應該支援正確的事件類型', () => {
      const CSVExportHandler = require('src/export/handlers/csv-export-handler')
      csvHandler = new CSVExportHandler()

      const supportedEvents = csvHandler.getSupportedEvents()

      expect(supportedEvents).toContain('EXPORT.CSV.REQUESTED')
      expect(supportedEvents.length).toBeGreaterThan(0)
    })

    test('CSVExportHandler 應該能處理 CSV 匯出請求', async () => {
      const CSVExportHandler = require('src/export/handlers/csv-export-handler')
      csvHandler = new CSVExportHandler()

      const eventData = {
        books: mockBooks,
        options: { fields: ['title', 'author'], delimiter: ',' }
      }

      const result = await csvHandler.process(eventData)

      expect(result).toBeDefined()
      expect(result).toHaveProperty('success')
      expect(result.success).toBe(true)
      expect(result).toHaveProperty('data')
    })

    test('CSVExportHandler 處理失敗時應該正確處理錯誤', async () => {
      const CSVExportHandler = require('src/export/handlers/csv-export-handler')
      const BookDataExporter = require('src/export/book-data-exporter')

      // 模擬匯出失敗
      BookDataExporter.mockImplementation(() => ({
        exportToCSV: jest.fn().mockImplementation(() => {
          throw new StandardError('EXPORT_CSV_FAILED', 'CSV export failed', { category: 'testing' })
        }),
        setProgressCallback: jest.fn()
      }))

      csvHandler = new CSVExportHandler()

      const eventData = {
        books: mockBooks,
        options: {}
      }

      await expect(csvHandler.process(eventData)).rejects.toThrow(StandardError)
    })

    test('CSVExportHandler 應該支援進度回調', async () => {
      const CSVExportHandler = require('src/export/handlers/csv-export-handler')
      csvHandler = new CSVExportHandler()

      const progressSpy = jest.fn()
      csvHandler.setProgressCallback(progressSpy)

      const eventData = {
        books: mockBooks,
        options: {}
      }

      await csvHandler.process(eventData)

      expect(progressSpy).toHaveBeenCalled()
    })
  })

  describe('🔴 Red Phase: JSONExportHandler 基本功能', () => {
    let jsonHandler

    test('應該能建立 JSONExportHandler 實例', () => {
      expect(() => {
        const JSONExportHandler = require('src/export/handlers/json-export-handler')
        jsonHandler = new JSONExportHandler()
      }).not.toThrow()

      expect(jsonHandler).toBeDefined()
      expect(jsonHandler.name).toBe('JSONExportHandler')
    })

    test('JSONExportHandler 應該支援正確的事件類型', () => {
      const JSONExportHandler = require('src/export/handlers/json-export-handler')
      jsonHandler = new JSONExportHandler()

      const supportedEvents = jsonHandler.getSupportedEvents()

      expect(supportedEvents).toContain('EXPORT.JSON.REQUESTED')
    })

    test('JSONExportHandler 應該能處理 JSON 匯出請求', async () => {
      const JSONExportHandler = require('src/export/handlers/json-export-handler')
      jsonHandler = new JSONExportHandler()

      const eventData = {
        books: mockBooks,
        options: {
          fields: ['title', 'author', 'progress'],
          pretty: true,
          includeMetadata: true
        }
      }

      const result = await jsonHandler.process(eventData)

      expect(result).toBeDefined()
      expect(result).toHaveProperty('success')
      expect(result.success).toBe(true)
      expect(result).toHaveProperty('data')
    })

    test('JSONExportHandler 應該正確傳遞匯出選項', async () => {
      const JSONExportHandler = require('src/export/handlers/json-export-handler')
      const BookDataExporter = require('src/export/book-data-exporter')

      jsonHandler = new JSONExportHandler()
      const mockInstance = new BookDataExporter()

      const eventData = {
        books: mockBooks,
        options: {
          fields: ['title', 'author'],
          pretty: false,
          includeMetadata: true
        }
      }

      await jsonHandler.process(eventData)

      expect(mockInstance.exportToJSON).toHaveBeenCalledWith(eventData.options)
    })

    test('JSONExportHandler 應該處理大型資料集', async () => {
      const JSONExportHandler = require('src/export/handlers/json-export-handler')
      jsonHandler = new JSONExportHandler()

      const largeBooks = Array.from({ length: 10000 }, (_, i) => ({
        id: `book_${i}`,
        title: `Test Book ${i}`,
        author: `Author ${i}`
      }))

      const eventData = {
        books: largeBooks,
        options: { pretty: false }
      }

      const result = await jsonHandler.process(eventData)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })
  })

  describe('🔴 Red Phase: ExcelExportHandler 基本功能', () => {
    let excelHandler

    test('應該能建立 ExcelExportHandler 實例', () => {
      expect(() => {
        const ExcelExportHandler = require('src/export/handlers/excel-export-handler')
        excelHandler = new ExcelExportHandler()
      }).not.toThrow()

      expect(excelHandler).toBeDefined()
      expect(excelHandler.name).toBe('ExcelExportHandler')
    })

    test('ExcelExportHandler 應該支援正確的事件類型', () => {
      const ExcelExportHandler = require('src/export/handlers/excel-export-handler')
      excelHandler = new ExcelExportHandler()

      const supportedEvents = excelHandler.getSupportedEvents()

      expect(supportedEvents).toContain('EXPORT.EXCEL.REQUESTED')
    })

    test('ExcelExportHandler 應該能處理 Excel 匯出請求', async () => {
      const ExcelExportHandler = require('src/export/handlers/excel-export-handler')
      excelHandler = new ExcelExportHandler()

      const eventData = {
        books: mockBooks,
        options: {
          sheetName: '我的書籍清單',
          headerStyle: { font: { bold: true } }
        }
      }

      const result = await excelHandler.process(eventData)

      expect(result).toBeDefined()
      expect(result).toHaveProperty('success')
      expect(result.success).toBe(true)
      expect(result).toHaveProperty('data')
      expect(result.data instanceof ArrayBuffer || typeof result.data === 'object').toBe(true)
    })

    test('ExcelExportHandler 應該支援多工作表匯出', async () => {
      const ExcelExportHandler = require('src/export/handlers/excel-export-handler')
      excelHandler = new ExcelExportHandler()

      const eventData = {
        books: mockBooks,
        options: {
          multiSheet: true,
          sheets: [
            {
              name: '程式設計書籍',
              data: mockBooks.filter(book => book.category === '程式設計')
            },
            {
              name: '機器學習書籍',
              data: mockBooks.filter(book => book.category === '機器學習')
            }
          ]
        }
      }

      const result = await excelHandler.process(eventData)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })

    test('ExcelExportHandler 應該處理空資料情況', async () => {
      const ExcelExportHandler = require('src/export/handlers/excel-export-handler')
      excelHandler = new ExcelExportHandler()

      const eventData = {
        books: [],
        options: {}
      }

      const result = await excelHandler.process(eventData)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })
  })

  describe('🔴 Red Phase: ProgressHandler 進度處理', () => {
    let progressHandler

    test('應該能建立 ProgressHandler 實例', () => {
      expect(() => {
        const ProgressHandler = require('src/export/handlers/progress-handler')
        progressHandler = new ProgressHandler()
      }).not.toThrow()

      expect(progressHandler).toBeDefined()
      expect(progressHandler.name).toBe('ProgressHandler')
    })

    test('ProgressHandler 應該支援進度事件', () => {
      const ProgressHandler = require('src/export/handlers/progress-handler')
      progressHandler = new ProgressHandler()

      const supportedEvents = progressHandler.getSupportedEvents()

      expect(supportedEvents).toContain('EXPORT.PROCESS.PROGRESS')
    })

    test('ProgressHandler 應該能處理進度更新', async () => {
      const ProgressHandler = require('src/export/handlers/progress-handler')
      progressHandler = new ProgressHandler()

      const progressData = {
        current: 50,
        total: 100,
        phase: 'processing',
        message: '處理中...',
        exportId: 'test-export-123'
      }

      const result = await progressHandler.process(progressData)

      expect(result).toBeDefined()
      expect(result).toHaveProperty('success')
      expect(result.success).toBe(true)
      expect(result).toHaveProperty('percentage')
      expect(result.percentage).toBe(50)
    })

    test('ProgressHandler 應該計算正確的百分比', async () => {
      const ProgressHandler = require('src/export/handlers/progress-handler')
      progressHandler = new ProgressHandler()

      const testCases = [
        { current: 0, total: 100, expected: 0 },
        { current: 25, total: 100, expected: 25 },
        { current: 100, total: 100, expected: 100 },
        { current: 3, total: 7, expected: Math.round((3 / 7) * 100) }
      ]

      for (const testCase of testCases) {
        const result = await progressHandler.process({
          current: testCase.current,
          total: testCase.total,
          exportId: 'test'
        })

        expect(result.percentage).toBe(testCase.expected)
      }
    })

    test('ProgressHandler 應該處理無效進度資料', async () => {
      const ProgressHandler = require('src/export/handlers/progress-handler')
      progressHandler = new ProgressHandler()

      const invalidProgressData = {
        current: 'invalid',
        total: 0,
        exportId: 'test'
      }

      await expect(progressHandler.process(invalidProgressData)).rejects.toThrow()
    })

    test('ProgressHandler 應該支援進度回調函數', async () => {
      const ProgressHandler = require('src/export/handlers/progress-handler')
      progressHandler = new ProgressHandler()

      const progressCallback = jest.fn()
      progressHandler.setProgressCallback(progressCallback)

      const progressData = {
        current: 75,
        total: 100,
        exportId: 'test'
      }

      await progressHandler.process(progressData)

      expect(progressCallback).toHaveBeenCalledWith(75)
    })
  })

  describe('🔴 Red Phase: ErrorHandler 錯誤處理', () => {
    let errorHandler

    test('應該能建立 ErrorHandler 實例', () => {
      expect(() => {
        const ErrorHandler = require('src/export/handlers/error-handler')
        errorHandler = new ErrorHandler()
      }).not.toThrow()

      expect(errorHandler).toBeDefined()
      expect(errorHandler.name).toBe('ErrorHandler')
    })

    test('ErrorHandler 應該支援錯誤事件', () => {
      const ErrorHandler = require('src/export/handlers/error-handler')
      errorHandler = new ErrorHandler()

      const supportedEvents = errorHandler.getSupportedEvents()

      expect(supportedEvents).toContain('EXPORT.PROCESS.FAILED')
      expect(supportedEvents).toContain('EXPORT.CSV.FAILED')
      expect(supportedEvents).toContain('EXPORT.JSON.FAILED')
      expect(supportedEvents).toContain('EXPORT.EXCEL.FAILED')
    })

    test('ErrorHandler 應該能處理一般匯出錯誤', async () => {
      const ErrorHandler = require('src/export/handlers/error-handler')
      errorHandler = new ErrorHandler()

      const errorData = {
        error: new StandardError('EXPORT_FAILED', 'Export failed'),
        exportId: 'test-export-123',
        format: 'csv',
        phase: 'processing'
      }

      const result = await errorHandler.process(errorData)

      expect(result).toBeDefined()
      expect(result).toHaveProperty('success')
      expect(result.success).toBe(true)
      expect(result).toHaveProperty('errorProcessed')
      expect(result.errorProcessed).toBe(true)
    })

    test('ErrorHandler 應該記錄錯誤資訊', async () => {
      const ErrorHandler = require('src/export/handlers/error-handler')
      errorHandler = new ErrorHandler()

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const errorData = {
        error: new StandardError('TEST_EXECUTION_ERROR', 'Test error'),
        exportId: 'test-export',
        format: 'csv'
      }

      await errorHandler.process(errorData)

      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    test('ErrorHandler 應該支援錯誤分類處理', async () => {
      const ErrorHandler = require('src/export/handlers/error-handler')
      errorHandler = new ErrorHandler()

      const networkError = {
        error: new StandardError('NETWORK_ERROR', 'Network error'),
        errorType: 'NETWORK',
        exportId: 'test'
      }

      const memoryError = {
        error: new RangeError('Out of memory'),
        errorType: 'MEMORY',
        exportId: 'test'
      }

      const networkResult = await errorHandler.process(networkError)
      const memoryResult = await errorHandler.process(memoryError)

      expect(networkResult).toBeDefined()
      expect(memoryResult).toBeDefined()
      expect(networkResult.errorType).toBe('NETWORK')
      expect(memoryResult.errorType).toBe('MEMORY')
    })

    test('ErrorHandler 應該支援錯誤恢復策略', async () => {
      const ErrorHandler = require('src/export/handlers/error-handler')
      errorHandler = new ErrorHandler()

      const recoverableError = {
        error: new StandardError('TEMPORARY_FAILURE', 'Temporary failure'),
        isRecoverable: true,
        retryCount: 1,
        maxRetries: 3,
        exportId: 'test'
      }

      const result = await errorHandler.process(recoverableError)

      expect(result).toBeDefined()
      expect(result).toHaveProperty('canRetry')
      expect(result.canRetry).toBe(true)
    })
  })

  describe('🔴 Red Phase: HandlerRegistry 處理器註冊', () => {
    let handlerRegistry

    test('應該能建立 HandlerRegistry 實例', () => {
      expect(() => {
        const HandlerRegistry = require('src/export/handlers/handler-registry')
        handlerRegistry = new HandlerRegistry(eventBus)
      }).not.toThrow()

      expect(handlerRegistry).toBeDefined()
    })

    test('HandlerRegistry 應該能註冊匯出處理器', () => {
      const HandlerRegistry = require('src/export/handlers/handler-registry')
      const CSVExportHandler = require('src/export/handlers/csv-export-handler')

      handlerRegistry = new HandlerRegistry(eventBus)
      const csvHandler = new CSVExportHandler()

      handlerRegistry.register(csvHandler)

      const registeredHandler = handlerRegistry.getHandler('CSVExportHandler')
      expect(registeredHandler).toBe(csvHandler)
    })

    test('HandlerRegistry 應該能移除處理器', () => {
      const HandlerRegistry = require('src/export/handlers/handler-registry')
      const CSVExportHandler = require('src/export/handlers/csv-export-handler')

      handlerRegistry = new HandlerRegistry(eventBus)
      const csvHandler = new CSVExportHandler()

      handlerRegistry.register(csvHandler)
      handlerRegistry.unregister('CSVExportHandler')

      const registeredHandler = handlerRegistry.getHandler('CSVExportHandler')
      expect(registeredHandler).toBeUndefined()
    })

    test('HandlerRegistry 應該自動註冊預設處理器', () => {
      const HandlerRegistry = require('src/export/handlers/handler-registry')
      handlerRegistry = new HandlerRegistry(eventBus)

      handlerRegistry.registerDefaultHandlers()

      expect(handlerRegistry.getHandler('CSVExportHandler')).toBeDefined()
      expect(handlerRegistry.getHandler('JSONExportHandler')).toBeDefined()
      expect(handlerRegistry.getHandler('ExcelExportHandler')).toBeDefined()
      expect(handlerRegistry.getHandler('ProgressHandler')).toBeDefined()
      expect(handlerRegistry.getHandler('ErrorHandler')).toBeDefined()
    })

    test('HandlerRegistry 應該能列出所有已註冊的處理器', () => {
      const HandlerRegistry = require('src/export/handlers/handler-registry')
      handlerRegistry = new HandlerRegistry(eventBus)

      handlerRegistry.registerDefaultHandlers()

      const handlers = handlerRegistry.getAllHandlers()

      expect(handlers).toBeDefined()
      expect(Array.isArray(handlers)).toBe(true)
      expect(handlers.length).toBeGreaterThan(0)
    })

    test('HandlerRegistry 應該能根據事件類型找到合適的處理器', () => {
      const HandlerRegistry = require('src/export/handlers/handler-registry')
      handlerRegistry = new HandlerRegistry(eventBus)

      handlerRegistry.registerDefaultHandlers()

      const handlers = handlerRegistry.getHandlersForEvent('EXPORT.CSV.REQUESTED')

      expect(handlers).toBeDefined()
      expect(Array.isArray(handlers)).toBe(true)
      expect(handlers.length).toBeGreaterThan(0)
      expect(handlers.some(handler => handler.name === 'CSVExportHandler')).toBe(true)
    })
  })

  describe('🔴 Red Phase: 處理器整合測試', () => {
    let handlerRegistry

    beforeEach(() => {
      const HandlerRegistry = require('src/export/handlers/handler-registry')
      handlerRegistry = new HandlerRegistry(eventBus)
      handlerRegistry.registerDefaultHandlers()
    })

    test('不同處理器應該能協同工作', async () => {
      const progressSpy = jest.fn()
      const errorSpy = jest.fn()

      eventBus.on('EXPORT.PROCESS.PROGRESS', progressSpy)
      eventBus.on('EXPORT.PROCESS.FAILED', errorSpy)

      const csvExportData = {
        books: mockBooks,
        options: {}
      }

      await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      // 應該有進度更新但沒有錯誤
      expect(progressSpy).toHaveBeenCalled()
      expect(errorSpy).not.toHaveBeenCalled()
    })

    test('處理器失敗時應該觸發錯誤處理器', async () => {
      /*
       * 🚨 重要測試：錯誤處理機制驗證
       *
       * 此測試驗證當匯出處理器失敗時，錯誤處理機制能正確運作
       *
       * 修復歷程：
       * - 原本此測試會導致無限循環和 heap OOM
       * - 根因：ErrorHandler 錯誤會再次觸發錯誤處理，形成遞迴
       * - 解決：在 HandlerRegistry 中添加重入保護機制 (_processingError)
       *
       * 測試要點：
       * 1. 使用 eventBus.once() 而非 .on() 避免重複觸發
       * 2. 使用最小測試資料集減少記憶體壓力
       * 3. 添加短暫等待確保非同步事件處理完成
       * 4. 驗證錯誤資料結構完整性
       *
       * ⚠️ 未來開發者注意：
       * - 不可移除 HandlerRegistry._processingError 重入保護
       * - 測試 ErrorHandler 時必須提供 exportId 字段
       * - 避免在錯誤處理流程中使用 .on() 持續監聽
       */
      const BookDataExporter = require('src/export/book-data-exporter')

      // 模擬匯出失敗
      BookDataExporter.mockImplementation(() => ({
        exportToCSV: jest.fn().mockImplementation(() => {
          throw new StandardError('EXPORT_CSV_SIMULATION_FAILED', 'Simulated export failure', { category: 'testing' })
        }),
        setProgressCallback: jest.fn()
      }))

      const errorSpy = jest.fn()
      let errorReceived = false

      // 使用 once 而非 on 避免多次觸發，並立即設置旗標
      eventBus.once('EXPORT.CSV.FAILED', (data) => {
        errorSpy(data)
        errorReceived = true
      })

      const csvExportData = {
        books: [mockBooks[0]], // 使用最小資料集
        options: {}
      }

      try {
        await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)
      } catch (err) {
        // 預期的錯誤，CSV 處理器會拋出錯誤
        expect(err.message).toBe('Simulated export failure')
      }

      // 使用短暫等待確保錯誤事件被處理
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(errorReceived).toBe(true)
      expect(errorSpy).toHaveBeenCalledTimes(1)

      // 驗證錯誤資料結構
      const errorData = errorSpy.mock.calls[0][0]
      expect(errorData).toHaveProperty('error')
      expect(errorData).toHaveProperty('format', 'csv')
      expect(errorData).toHaveProperty('exportId') // HandlerRegistry 自動提供
      expect(errorData.error.message).toBe('Simulated export failure')
    })

    test('處理器應該正確維護統計資訊', async () => {
      const csvHandler = handlerRegistry.getHandler('CSVExportHandler')

      const initialStats = csvHandler.getStats()
      const initialCount = initialStats.executionCount

      const csvExportData = {
        books: mockBooks,
        options: {}
      }

      await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      const finalStats = csvHandler.getStats()
      expect(finalStats.executionCount).toBeGreaterThan(initialCount)
      expect(finalStats.lastExecutionTime).toBeDefined()
    })

    test('處理器應該支援動態啟用和停用', async () => {
      const csvHandler = handlerRegistry.getHandler('CSVExportHandler')

      // 停用處理器
      csvHandler.setEnabled(false)

      const csvExportData = {
        books: mockBooks,
        options: {}
      }

      const results = await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      // 處理器被停用，應該沒有結果或返回null
      expect(results.every(result => result === null || result === undefined)).toBe(true)

      // 重新啟用處理器
      csvHandler.setEnabled(true)

      const results2 = await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      expect(results2.some(result => result !== null && result !== undefined)).toBe(true)
    })
  })

  describe('🔴 Red Phase: 效能和資源管理', () => {
    let handlerRegistry

    beforeEach(() => {
      const HandlerRegistry = require('src/export/handlers/handler-registry')
      handlerRegistry = new HandlerRegistry(eventBus)
      handlerRegistry.registerDefaultHandlers()
    })

    test('處理器應該在合理時間內完成處理', async () => {
      const startTime = Date.now()

      const csvExportData = {
        books: mockBooks,
        options: {}
      }

      await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      const endTime = Date.now()
      const executionTime = endTime - startTime

      // 處理時間應該在合理範圍內（1秒內）
      expect(executionTime).toBeLessThan(1000)
    })

    test('處理器應該正確處理大量並發請求', async () => {
      const concurrentRequests = 10
      const promises = []

      for (let i = 0; i < concurrentRequests; i++) {
        const csvExportData = {
          books: mockBooks,
          options: { exportId: `test-${i}` }
        }

        promises.push(eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData))
      }

      const results = await Promise.all(promises)

      expect(results).toHaveLength(concurrentRequests)
      results.forEach(result => {
        expect(result).toBeDefined()
      })
    })

    test('處理器應該適當清理資源', async () => {
      const csvHandler = handlerRegistry.getHandler('CSVExportHandler')
      const initialMemory = process.memoryUsage().heapUsed

      // 執行多次匯出操作
      for (let i = 0; i < 100; i++) {
        const csvExportData = {
          books: mockBooks.slice(0, 1), // 使用較小的資料集
          options: {}
        }

        await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)
      }

      // 等待記憶體穩定化
      await new Promise(resolve => setTimeout(resolve, 150))

      const finalMemory = process.memoryUsage().heapUsed

      // 記憶體使用量不應該大幅增長，考慮測試環境的記憶體壓力
      const memoryGrowth = finalMemory - initialMemory
      const maxAcceptableGrowth = 50 * 1024 * 1024 // 50MB (測試環境容忍度較高)

      expect(memoryGrowth).toBeLessThan(maxAcceptableGrowth)
    })
  })
})
