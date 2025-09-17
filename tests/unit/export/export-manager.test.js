/**
 * ExportManager 事件驅動測試 - TDD循環 #29 Red階段
 *
 * 測試範圍：
 * - ExportManager 與事件總線整合
 * - 事件監聽和派發機制
 * - 與現有 BookDataExporter 整合
 * - 匯出流程的事件驅動協調
 * - 錯誤處理和恢復機制
 *
 * 功能目標：
 * - 建立事件驅動的匯出管理器
 * - 協調不同匯出格式的處理流程
 * - 提供統一的匯出事件介面
 * - 支援並發匯出和進度追蹤
 * - 整合檔案下載和儲存功能
 *
 * 設計考量：
 * - 使用事件總線作為通訊基礎
 * - 與現有 BookDataExporter 保持相容
 * - 支援批量匯出和檔案壓縮
 * - 提供完整的錯誤處理機制
 * - 遵循單一責任原則設計
 *
 * @version 1.0.0
 * @since 2025-08-08
 */

const EventBus = require('src/core/event-bus')
const { StandardError } = require('src/core/errors/StandardError')
const MemoryLeakDetector = require('../../helpers/memory-leak-detector')

// Mock BookDataExporter
let mockExporterInstance
jest.mock('../../../src/export/book-data-exporter', () => {
  return jest.fn().mockImplementation(() => {
    mockExporterInstance = {
      exportToCSV: jest.fn().mockReturnValue('mock-csv-data'),
      exportToJSON: jest.fn().mockReturnValue('mock-json-data'),
      exportToExcel: jest.fn().mockReturnValue(new ArrayBuffer(100)),
      exportToPDF: jest.fn().mockReturnValue(new ArrayBuffer(200)),
      batchExport: jest.fn().mockReturnValue({
        csv: 'mock-csv-data',
        json: 'mock-json-data'
      }),
      exportToZip: jest.fn().mockReturnValue(new ArrayBuffer(500)),
      setProgressCallback: jest.fn(),
      downloadFile: jest.fn().mockResolvedValue(true),
      getExportStats: jest.fn().mockReturnValue({
        totalExports: 0,
        formatBreakdown: {}
      })
    }
    return mockExporterInstance
  })
})

// Mock 事件系統
jest.mock('../../../src/export/export-events', () => ({
  EXPORT_EVENTS: {
    EXPORT_REQUESTED: 'EXPORT.REQUEST.INITIATED',
    EXPORT_STARTED: 'EXPORT.PROCESS.STARTED',
    EXPORT_PROGRESS: 'EXPORT.PROCESS.PROGRESS',
    EXPORT_COMPLETED: 'EXPORT.PROCESS.COMPLETED',
    EXPORT_FAILED: 'EXPORT.PROCESS.FAILED',
    EXPORT_CANCELLED: 'EXPORT.PROCESS.CANCELLED',
    CSV_EXPORT_REQUESTED: 'EXPORT.CSV.REQUESTED',
    CSV_EXPORT_COMPLETED: 'EXPORT.CSV.COMPLETED',
    CSV_EXPORT_FAILED: 'EXPORT.CSV.FAILED',
    JSON_EXPORT_REQUESTED: 'EXPORT.JSON.REQUESTED',
    JSON_EXPORT_COMPLETED: 'EXPORT.JSON.COMPLETED',
    JSON_EXPORT_FAILED: 'EXPORT.JSON.FAILED',
    EXCEL_EXPORT_REQUESTED: 'EXPORT.EXCEL.REQUESTED',
    EXCEL_EXPORT_COMPLETED: 'EXPORT.EXCEL.COMPLETED',
    EXCEL_EXPORT_FAILED: 'EXPORT.EXCEL.FAILED',
    PDF_EXPORT_REQUESTED: 'EXPORT.PDF.REQUESTED',
    PDF_EXPORT_COMPLETED: 'EXPORT.PDF.COMPLETED',
    PDF_EXPORT_FAILED: 'EXPORT.PDF.FAILED',
    BATCH_EXPORT_REQUESTED: 'EXPORT.BATCH.REQUESTED',
    BATCH_EXPORT_STARTED: 'EXPORT.BATCH.STARTED',
    BATCH_EXPORT_COMPLETED: 'EXPORT.BATCH.COMPLETED',
    BATCH_EXPORT_FAILED: 'EXPORT.BATCH.FAILED',
    FILE_DOWNLOAD_REQUESTED: 'EXPORT.DOWNLOAD.REQUESTED',
    FILE_DOWNLOAD_STARTED: 'EXPORT.DOWNLOAD.STARTED',
    FILE_DOWNLOAD_COMPLETED: 'EXPORT.DOWNLOAD.COMPLETED',
    FILE_DOWNLOAD_FAILED: 'EXPORT.DOWNLOAD.FAILED'
  },
  EXPORT_EVENT_PRIORITIES: {
    EXPORT_REQUESTED: 100,
    EXPORT_STARTED: 200,
    EXPORT_PROGRESS: 210,
    EXPORT_COMPLETED: 220,
    EXPORT_FAILED: 50,
    CSV_EXPORT_REQUESTED: 101,
    JSON_EXPORT_REQUESTED: 102,
    EXCEL_EXPORT_REQUESTED: 103,
    PDF_EXPORT_REQUESTED: 104,
    BATCH_EXPORT_REQUESTED: 105,
    FILE_DOWNLOAD_REQUESTED: 106,
    EXPORT_CANCELLED: 50
  },
  createExportEvent: jest.fn((type, data) => ({
    id: Date.now() + Math.random(),
    type,
    data,
    timestamp: new Date().toISOString(),
    priority: 200
  }))
}))

describe('📤 ExportManager 事件驅動系統測試 (TDD循環 #29 Red階段)', () => {
  let exportManager
  let eventBus
  let mockBooks
  let memoryDetector

  beforeEach(() => {
    // 準備測試資料
    mockBooks = [
      {
        id: '1',
        title: 'JavaScript 高級程式設計',
        author: '張三',
        category: '程式設計',
        progress: 45,
        status: '閱讀中'
      },
      {
        id: '2',
        title: 'Python 機器學習',
        author: '李四',
        category: '機器學習',
        progress: 78,
        status: '已完成'
      }
    ]

    // 建立新的事件總線
    eventBus = new EventBus()

    // 初始化記憶體洩漏檢測器
    memoryDetector = new MemoryLeakDetector({
      memoryGrowthThreshold: 10 * 1024 * 1024, // 10MB for unit tests
      leakDetectionThreshold: 1024 // 1KB per operation
    })

    // 清理所有模擬，但保持 mock 實例引用
    if (mockExporterInstance) {
      Object.values(mockExporterInstance).forEach(fn => {
        if (jest.isMockFunction(fn)) {
          fn.mockClear()
        }
      })
    }
  })

  describe('🔴 Red Phase: ExportManager 基本結構', () => {
    test('應該能建立 ExportManager 實例', () => {
      expect(() => {
        const ExportManager = require('src/export/export-manager')
        exportManager = new ExportManager(eventBus)
      }).not.toThrow()

      expect(exportManager).toBeDefined()
    })

    test('ExportManager 應該接受事件總線作為依賴注入', () => {
      const ExportManager = require('src/export/export-manager')
      exportManager = new ExportManager(eventBus)

      expect(exportManager.eventBus).toBe(eventBus)
    })

    test('ExportManager 應該正確初始化狀態', () => {
      const ExportManager = require('src/export/export-manager')
      exportManager = new ExportManager(eventBus)

      expect(exportManager.isExporting).toBe(false)
      expect(exportManager.currentExports).toBeDefined()
      expect(exportManager.currentExports instanceof Map).toBe(true)
      expect(exportManager.exportHistory).toBeDefined()
      expect(Array.isArray(exportManager.exportHistory)).toBe(true)
    })

    test('ExportManager 應該註冊所有必要的事件監聽器', () => {
      const ExportManager = require('src/export/export-manager')
      const eventBusSpy = jest.spyOn(eventBus, 'on')

      exportManager = new ExportManager(eventBus)

      // 驗證是否註冊了必要的事件監聽器
      expect(eventBusSpy).toHaveBeenCalledWith(
        'EXPORT.CSV.REQUESTED',
        expect.any(Function),
        expect.objectContaining({ priority: expect.any(Number) })
      )

      expect(eventBusSpy).toHaveBeenCalledWith(
        'EXPORT.JSON.REQUESTED',
        expect.any(Function),
        expect.objectContaining({ priority: expect.any(Number) })
      )

      expect(eventBusSpy).toHaveBeenCalledWith(
        'EXPORT.BATCH.REQUESTED',
        expect.any(Function),
        expect.objectContaining({ priority: expect.any(Number) })
      )

      expect(eventBusSpy).toHaveBeenCalledWith(
        'EXPORT.DOWNLOAD.REQUESTED',
        expect.any(Function),
        expect.objectContaining({ priority: expect.any(Number) })
      )
    })
  })

  describe('🔴 Red Phase: CSV 匯出事件處理', () => {
    beforeEach(() => {
      const ExportManager = require('src/export/export-manager')
      exportManager = new ExportManager(eventBus)
    })

    test('應該處理 CSV 匯出請求事件', async () => {
      const csvExportData = {
        books: mockBooks,
        options: { fields: ['title', 'author'], delimiter: ',' }
      }

      // 觸發 CSV 匯出請求事件
      const results = await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThan(0)
    })

    test('CSV 匯出成功時應該觸發完成事件', async () => {
      const completedEventSpy = jest.fn()
      eventBus.on('EXPORT.CSV.COMPLETED', completedEventSpy)

      const csvExportData = {
        books: mockBooks,
        options: { fields: ['title', 'author'] }
      }

      await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      // 等待非同步事件處理完成
      await new Promise(resolve => process.nextTick(resolve))

      expect(completedEventSpy).toHaveBeenCalled()
    })

    test('CSV 匯出失敗時應該觸發失敗事件', async () => {
      const BookDataExporter = require('src/export/book-data-exporter')

      // 模擬匯出失敗 - 使用 mockImplementationOnce 避免影響其他測試
      BookDataExporter.mockImplementationOnce(() => ({
        exportToCSV: jest.fn().mockImplementation(() => {
          throw new StandardError('EXPORT_CSV_FAILED', 'CSV export failed', { category: 'testing' })
        }),
        setProgressCallback: jest.fn()
      }))

      const failedEventSpy = jest.fn()
      eventBus.on('EXPORT.CSV.FAILED', failedEventSpy)

      const csvExportData = {
        books: mockBooks,
        options: {}
      }

      await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      // 等待非同步事件處理完成
      await new Promise(resolve => process.nextTick(resolve))

      expect(failedEventSpy).toHaveBeenCalled()
    })

    test('應該在 CSV 匯出過程中更新進度', async () => {
      const progressEventSpy = jest.fn()
      eventBus.on('EXPORT.PROCESS.PROGRESS', progressEventSpy)

      const csvExportData = {
        books: mockBooks,
        options: {}
      }

      await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      // 等待非同步事件處理完成
      await new Promise(resolve => process.nextTick(resolve))

      expect(progressEventSpy).toHaveBeenCalled()
    })
  })

  describe('🔴 Red Phase: JSON 匯出事件處理', () => {
    beforeEach(() => {
      const ExportManager = require('src/export/export-manager')
      exportManager = new ExportManager(eventBus)

      // 確保 mock 實例被正確重設
      if (mockExporterInstance) {
        Object.values(mockExporterInstance).forEach(fn => {
          if (jest.isMockFunction(fn)) {
            fn.mockClear()
          }
        })
      }
    })

    test('應該處理 JSON 匯出請求事件', async () => {
      const jsonExportData = {
        books: mockBooks,
        options: {
          fields: ['title', 'author', 'progress'],
          pretty: true,
          includeMetadata: true
        }
      }

      const results = await eventBus.emit('EXPORT.JSON.REQUESTED', jsonExportData)

      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThan(0)
    })

    test('JSON 匯出成功時應該觸發完成事件', async () => {
      const completedEventSpy = jest.fn()
      eventBus.on('EXPORT.JSON.COMPLETED', completedEventSpy)

      const jsonExportData = {
        books: mockBooks,
        options: { pretty: true }
      }

      await eventBus.emit('EXPORT.JSON.REQUESTED', jsonExportData)

      expect(completedEventSpy).toHaveBeenCalled()
    })

    test('JSON 匯出應該正確傳遞選項給 BookDataExporter', async () => {
      const jsonExportData = {
        books: mockBooks,
        options: {
          fields: ['title', 'author'],
          pretty: false,
          includeMetadata: true
        }
      }

      await eventBus.emit('EXPORT.JSON.REQUESTED', jsonExportData)

      expect(mockExporterInstance.exportToJSON).toHaveBeenCalledWith(jsonExportData.options)
    })
  })

  describe('🔴 Red Phase: 批量匯出事件處理', () => {
    beforeEach(() => {
      const ExportManager = require('src/export/export-manager')
      exportManager = new ExportManager(eventBus)

      // 確保 mock 實例被正確重設
      if (mockExporterInstance) {
        Object.values(mockExporterInstance).forEach(fn => {
          if (jest.isMockFunction(fn)) {
            fn.mockClear()
          }
        })
      }
    })

    test('應該處理批量匯出請求事件', async () => {
      const batchExportData = {
        formats: ['csv', 'json'],
        books: mockBooks,
        options: {
          csv: { delimiter: ',' },
          json: { pretty: true }
        }
      }

      const results = await eventBus.emit('EXPORT.BATCH.REQUESTED', batchExportData)

      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThan(0)
    })

    test('批量匯出成功時應該觸發完成事件', async () => {
      const completedEventSpy = jest.fn()
      eventBus.on('EXPORT.BATCH.COMPLETED', completedEventSpy)

      const batchExportData = {
        formats: ['csv', 'json'],
        books: mockBooks,
        options: {}
      }

      await eventBus.emit('EXPORT.BATCH.REQUESTED', batchExportData)

      expect(completedEventSpy).toHaveBeenCalled()
    })

    test('批量匯出應該為每種格式觸發個別進度事件', async () => {
      const progressEventSpy = jest.fn()
      eventBus.on('EXPORT.PROCESS.PROGRESS', progressEventSpy)

      const batchExportData = {
        formats: ['csv', 'json', 'excel'],
        books: mockBooks,
        options: {}
      }

      await eventBus.emit('EXPORT.BATCH.REQUESTED', batchExportData)

      // 等待非同步進度事件處理完成
      await new Promise(resolve => process.nextTick(resolve))

      // 應該有多個進度更新（每種格式至少一個）
      expect(progressEventSpy).toHaveBeenCalled()
      expect(progressEventSpy.mock.calls.length).toBeGreaterThan(0)
    })

    test('批量匯出中部分失敗應該正確處理', async () => {
      const BookDataExporter = require('src/export/book-data-exporter')

      // 模擬部分格式匯出失敗 - 使用 mockImplementationOnce
      BookDataExporter.mockImplementationOnce(() => ({
        batchExport: jest.fn().mockImplementation(() => {
          throw new StandardError('EXPORT_BATCH_PARTIAL_FAILURE', 'Some formats failed', { category: 'testing' })
        }),
        setProgressCallback: jest.fn()
      }))

      const failedEventSpy = jest.fn()
      eventBus.on('EXPORT.BATCH.FAILED', failedEventSpy)

      const batchExportData = {
        formats: ['csv', 'json', 'invalid-format'],
        books: mockBooks,
        options: {}
      }

      await eventBus.emit('EXPORT.BATCH.REQUESTED', batchExportData)

      expect(failedEventSpy).toHaveBeenCalled()
    })
  })

  describe('🔴 Red Phase: 檔案下載事件處理', () => {
    beforeEach(() => {
      const ExportManager = require('src/export/export-manager')
      exportManager = new ExportManager(eventBus)

      // 確保 mock 實例被正確重設
      if (mockExporterInstance) {
        Object.values(mockExporterInstance).forEach(fn => {
          if (jest.isMockFunction(fn)) {
            fn.mockClear()
          }
        })
      }
    })

    test('應該處理檔案下載請求事件', async () => {
      const downloadData = {
        data: 'mock-csv-data',
        filename: 'books.csv',
        mimeType: 'text/csv'
      }

      const results = await eventBus.emit('EXPORT.DOWNLOAD.REQUESTED', downloadData)

      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThan(0)
    })

    test('檔案下載成功時應該觸發完成事件', async () => {
      const completedEventSpy = jest.fn()
      eventBus.on('EXPORT.DOWNLOAD.COMPLETED', completedEventSpy)

      const downloadData = {
        data: 'mock-data',
        filename: 'test.csv',
        mimeType: 'text/csv'
      }

      await eventBus.emit('EXPORT.DOWNLOAD.REQUESTED', downloadData)

      expect(completedEventSpy).toHaveBeenCalled()
    })

    test('檔案下載失敗時應該觸發失敗事件', async () => {
      const BookDataExporter = require('src/export/book-data-exporter')

      // 模擬下載失敗 - 使用 mockImplementationOnce
      BookDataExporter.mockImplementationOnce(() => ({
        downloadFile: jest.fn().mockImplementation(() => {
          throw new StandardError('EXPORT_DOWNLOAD_FAILED', 'Download failed', { category: 'testing' })
        })
      }))

      const failedEventSpy = jest.fn()
      eventBus.on('EXPORT.DOWNLOAD.FAILED', failedEventSpy)

      const downloadData = {
        data: 'mock-data',
        filename: 'test.csv',
        mimeType: 'text/csv'
      }

      await eventBus.emit('EXPORT.DOWNLOAD.REQUESTED', downloadData)

      expect(failedEventSpy).toHaveBeenCalled()
    })
  })

  describe('🔴 Red Phase: 進度追蹤和狀態管理', () => {
    beforeEach(() => {
      const ExportManager = require('src/export/export-manager')
      exportManager = new ExportManager(eventBus)
    })

    test('應該追蹤當前進行中的匯出操作', async () => {
      const csvExportData = {
        books: mockBooks,
        options: {}
      }

      // 開始匯出前，應該沒有進行中的匯出
      expect(exportManager.currentExports.size).toBe(0)
      expect(exportManager.isExporting).toBe(false)

      await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      // 匯出完成後，應該清理狀態
      expect(exportManager.currentExports.size).toBe(0)
    })

    test('應該支援並發匯出操作', async () => {
      const csvExportData = { books: mockBooks, options: {} }
      const jsonExportData = { books: mockBooks, options: {} }

      // 同時觸發兩個匯出請求
      const promises = [
        eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData),
        eventBus.emit('EXPORT.JSON.REQUESTED', jsonExportData)
      ]

      const results = await Promise.all(promises)

      expect(results).toHaveLength(2)
      results.forEach(result => {
        expect(result).toBeDefined()
        expect(result.length).toBeGreaterThan(0)
      })
    })

    test('應該提供匯出操作取消功能', async () => {
      const cancelledEventSpy = jest.fn()
      eventBus.on('EXPORT.PROCESS.CANCELLED', cancelledEventSpy)

      const exportId = 'test-export-123'

      // 觸發取消事件
      await eventBus.emit('EXPORT.PROCESS.CANCELLED', { exportId })

      expect(cancelledEventSpy).toHaveBeenCalled()
    })

    test('應該記錄匯出歷史', async () => {
      const csvExportData = {
        books: mockBooks,
        options: {}
      }

      const initialHistoryLength = exportManager.exportHistory.length

      await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      expect(exportManager.exportHistory.length).toBeGreaterThan(initialHistoryLength)
    })
  })

  describe('🔴 Red Phase: 錯誤處理和恢復', () => {
    beforeEach(() => {
      const ExportManager = require('src/export/export-manager')
      exportManager = new ExportManager(eventBus)
    })

    test('應該處理 BookDataExporter 實例化失敗', async () => {
      const BookDataExporter = require('src/export/book-data-exporter')

      // 模擬建構函數失敗 - 使用 mockImplementationOnce
      BookDataExporter.mockImplementationOnce(() => {
        throw new StandardError('EXPORT_MANAGER_INIT_FAILED', 'Exporter initialization failed', { category: 'testing' })
      })

      const failedEventSpy = jest.fn()
      eventBus.on('EXPORT.CSV.FAILED', failedEventSpy)

      const csvExportData = {
        books: mockBooks,
        options: {}
      }

      await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      expect(failedEventSpy).toHaveBeenCalled()
    })

    test('應該處理無效的匯出資料', async () => {
      const failedEventSpy = jest.fn()
      eventBus.on('EXPORT.CSV.FAILED', failedEventSpy)

      const invalidExportData = {
        books: null, // 無效資料
        options: undefined
      }

      await eventBus.emit('EXPORT.CSV.REQUESTED', invalidExportData)

      expect(failedEventSpy).toHaveBeenCalled()
    })

    test('應該處理記憶體不足的情況', async () => {
      const BookDataExporter = require('src/export/book-data-exporter')

      // 模擬記憶體不足錯誤 - 使用 mockImplementationOnce
      BookDataExporter.mockImplementationOnce(() => ({
        exportToCSV: jest.fn().mockImplementation(() => {
          const error = new StandardError('OUT_OF_MEMORY', 'Out of memory')
          error.name = 'RangeError'
          throw error
        }),
        setProgressCallback: jest.fn()
      }))

      const failedEventSpy = jest.fn()
      eventBus.on('EXPORT.CSV.FAILED', failedEventSpy)

      const largeExportData = {
        books: Array.from({ length: 100000 }, (_, i) => ({ id: i, title: `Book ${i}` })),
        options: {}
      }

      await eventBus.emit('EXPORT.CSV.REQUESTED', largeExportData)

      expect(failedEventSpy).toHaveBeenCalled()
    })

    test('應該提供錯誤恢復機制', async () => {
      let attemptCount = 0
      const BookDataExporter = require('src/export/book-data-exporter')

      // 模擬第一次失敗，第二次成功 - 使用 mockImplementationOnce
      BookDataExporter.mockImplementationOnce(() => ({
        exportToCSV: jest.fn().mockImplementation(() => {
          attemptCount++
          if (attemptCount === 1) {
            throw new StandardError('EXPORT_TEMPORARY_FAILURE', 'Temporary failure', { category: 'testing' })
          }
          return 'mock-csv-data'
        }),
        setProgressCallback: jest.fn()
      }))

      const completedEventSpy = jest.fn()
      eventBus.on('EXPORT.CSV.COMPLETED', completedEventSpy)

      const csvExportData = {
        books: mockBooks,
        options: { retryOnFailure: true }
      }

      // 第一次請求
      await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      // 重試請求
      await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      expect(completedEventSpy).toHaveBeenCalled()
    })
  })

  describe('🔴 Red Phase: 整合性測試', () => {
    beforeEach(() => {
      const ExportManager = require('src/export/export-manager')
      exportManager = new ExportManager(eventBus)

      // 確保 mock 實例被正確重設
      if (mockExporterInstance) {
        Object.values(mockExporterInstance).forEach(fn => {
          if (jest.isMockFunction(fn)) {
            fn.mockClear()
          }
        })
      }
    })

    test('應該與現有 BookDataExporter API 完全相容', async () => {
      const csvExportData = {
        books: mockBooks,
        options: { fields: ['title', 'author'] }
      }

      await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      // 驗證 BookDataExporter 方法被正確呼叫
      expect(mockExporterInstance.exportToCSV).toHaveBeenCalledWith(csvExportData.options)
      expect(mockExporterInstance.setProgressCallback).toHaveBeenCalledWith(expect.any(Function))
    })

    test('應該支援事件鏈式處理', async () => {
      const eventChain = []

      // 註冊事件鏈監聽器
      eventBus.on('EXPORT.CSV.REQUESTED', () => eventChain.push('requested'))
      eventBus.on('EXPORT.PROCESS.STARTED', () => eventChain.push('started'))
      eventBus.on('EXPORT.PROCESS.PROGRESS', () => eventChain.push('progress'))
      eventBus.on('EXPORT.CSV.COMPLETED', () => eventChain.push('completed'))

      const csvExportData = {
        books: mockBooks,
        options: {}
      }

      await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      // 驗證事件按正確順序觸發
      expect(eventChain).toContain('requested')
      expect(eventChain).toContain('completed')
    })

    test('應該支援匯出事件的相關性追蹤', async () => {
      const correlationId = 'export-session-123'
      let capturedCorrelationId = null

      eventBus.on('EXPORT.CSV.COMPLETED', (data) => {
        capturedCorrelationId = data.correlationId
      })

      const csvExportData = {
        books: mockBooks,
        options: {},
        correlationId
      }

      await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      expect(capturedCorrelationId).toBe(correlationId)
    })
  })

  describe('🔴 Red Phase: 性能和資源管理', () => {
    beforeEach(() => {
      const ExportManager = require('src/export/export-manager')
      exportManager = new ExportManager(eventBus)
    })

    test('應該限制並發匯出操作數量', async () => {
      const maxConcurrentExports = 3
      exportManager.maxConcurrentExports = maxConcurrentExports

      const exportPromises = []

      // 嘗試啟動更多匯出操作
      for (let i = 0; i < 5; i++) {
        exportPromises.push(
          eventBus.emit('EXPORT.CSV.REQUESTED', {
            books: mockBooks,
            options: {}
          })
        )
      }

      await Promise.all(exportPromises)

      // 驗證並發限制被尊重
      expect(exportManager.currentExports.size).toBeLessThanOrEqual(maxConcurrentExports)
    })

    test('應該自動清理已完成的匯出操作', async () => {
      const csvExportData = {
        books: mockBooks,
        options: {}
      }

      await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

      // 匯出完成後應該自動清理
      expect(exportManager.currentExports.size).toBe(0)
    })

    test('應該提供記憶體使用監控', async () => {
      // 測試 ExportManager 的記憶體使用監控功能
      expect(exportManager.getMemoryUsage).toBeDefined()
      expect(typeof exportManager.getMemoryUsage).toBe('function')

      const memoryUsage = exportManager.getMemoryUsage()
      expect(memoryUsage).toBeDefined()
      expect(typeof memoryUsage).toBe('object')

      // 使用 MemoryLeakDetector 進行更深入的記憶體分析
      const analysis = await memoryDetector.detectMemoryLeak(async (iteration) => {
        // 模擬多次匯出操作來測試記憶體使用
        const csvExportData = {
          books: mockBooks,
          options: {}
        }
        await eventBus.emit('EXPORT.CSV.REQUESTED', csvExportData)

        // 獲取當前記憶體使用情況
        const currentUsage = exportManager.getMemoryUsage()
        expect(currentUsage).toBeDefined()
      }, 10, { testName: 'export-manager-memory-monitoring' })

      console.log('📊 ExportManager 記憶體監控分析:')
      console.log(`  平均每操作記憶體增長: ${analysis.leakDetection.formattedAverageGrowth}`)
      console.log(`  記憶體效率: ${(analysis.efficiency.overallEfficiency * 100).toFixed(1)}%`)
      console.log(`  洩漏嚴重程度: ${analysis.leakDetection.leakSeverity}`)

      // 驗證記憶體健康度
      expect(analysis.hasMemoryLeak).toBe(false)
      expect(analysis.passesThresholds.overallOk).toBe(true)
      expect(analysis.leakDetection.leakSeverity).not.toBe('critical')
    })
  })
})
