/**
 * BookDataExporter 單元測試 - TDD循環 #29
 *
 * 測試範圍：
 * - 多格式資料匯出功能
 * - CSV、JSON、Excel、PDF 匯出
 * - 自訂欄位和格式設定
 * - 匯出進度追蹤
 * - 檔案壓縮和批量匯出
 *
 * 功能目標：
 * - 支援多種匯出格式（CSV、JSON、Excel、PDF）
 * - 可自訂匯出欄位和格式
 * - 批量匯出和檔案壓縮
 * - 匯出進度追蹤和錯誤處理
 * - 範本系統和自訂樣式
 *
 * @version 1.0.0
 * @since 2025-08-06
 */

// 設置測試環境
global.window = {}
global.navigator = {}

// 創建 mock DOM 元素
// eslint-disable-next-line no-unused-vars
const createMockElement = () => ({
  click: jest.fn(),
  setAttribute: jest.fn(),
  style: {},
  href: '',
  download: '',
  appendChild: jest.fn(),
  removeChild: jest.fn()
})

global.document = {
  createElement: jest.fn(() => createMockElement()),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }
}

// Mock URL.createObjectURL
global.URL = {
  createObjectURL: jest.fn(() => 'blob:mock-url'),
  revokeObjectURL: jest.fn()
}

// eslint-disable-next-line no-unused-vars
const BookDataExporter = require('src/export/book-data-exporter')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

describe('📤 BookDataExporter 書籍資料匯出器測試 (TDD循環 #29)', () => {
  let exporter
  // eslint-disable-next-line no-unused-vars
  let mockBooks

  beforeEach(() => {
    // 準備測試資料
    mockBooks = [
      {
        id: '1',
        title: 'JavaScript 高級程式設計',
        author: '張三',
        publisher: '電腦人出版社',
        publishDate: '2023-01-15',
        category: '程式設計',
        progress: 45,
        status: '閱讀中',
        isbn: '9789861234567',
        rating: 4.5,
        tags: ['前端', 'JavaScript', '程式設計'],
        notes: '很好的 JavaScript 參考書',
        readingTime: 120,
        price: 580
      },
      {
        id: '2',
        title: 'Python 機器學習',
        author: '李四',
        publisher: '科技出版社',
        publishDate: '2023-03-20',
        category: '機器學習',
        progress: 78,
        status: '已完成',
        isbn: '9789861234568',
        rating: 4.8,
        tags: ['Python', '機器學習', 'AI'],
        notes: '深入淺出的機器學習教材',
        readingTime: 200,
        price: 650
      },
      {
        id: '3',
        title: 'Web 前端開發實戰',
        author: '王五',
        publisher: '電腦人出版社',
        publishDate: '2022-11-10',
        category: '程式設計',
        progress: 20,
        status: '閱讀中',
        isbn: '9789861234569',
        rating: 4.2,
        tags: ['前端', 'HTML', 'CSS', 'JavaScript'],
        notes: '實戰案例豐富',
        readingTime: 80,
        price: 520
      }
    ]

    // 清理所有模擬
    jest.clearAllMocks()
  })

  describe('🔴 Red Phase: 基本結構和初始化', () => {
    test('應該能創建 BookDataExporter 實例', () => {
      expect(() => {
        exporter = new BookDataExporter(mockBooks)
      }).not.toThrow()

      expect(exporter).toBeDefined()
      expect(exporter).toBeInstanceOf(BookDataExporter)
    })

    test('應該能正確初始化匯出配置', () => {
      // eslint-disable-next-line no-unused-vars
      const options = {
        defaultFormat: 'json',
        includeHeaders: true,
        dateFormat: 'YYYY-MM-DD',
        encoding: 'utf-8'
      }

      exporter = new BookDataExporter(mockBooks, options)

      expect(exporter.config.defaultFormat).toBe('json')
      expect(exporter.config.includeHeaders).toBe(true)
      expect(exporter.config.dateFormat).toBe('YYYY-MM-DD')
      expect(exporter.config.encoding).toBe('utf-8')
    })

    test('應該設定預設配置值', () => {
      exporter = new BookDataExporter(mockBooks)

      expect(exporter.config.defaultFormat).toBeDefined()
      expect(exporter.config.includeHeaders).toBeDefined()
      expect(exporter.config.dateFormat).toBeDefined()
      expect(exporter.config.encoding).toBeDefined()
    })

    test('應該正確初始化匯出狀態', () => {
      exporter = new BookDataExporter(mockBooks)

      expect(exporter.books).toEqual(mockBooks)
      expect(exporter.exportHistory).toEqual([])
      expect(exporter.isExporting).toBe(false)
      expect(exporter.currentProgress).toBe(0)
    })
  })

  describe('🔴 Red Phase: CSV 匯出功能', () => {
    beforeEach(() => {
      exporter = new BookDataExporter(mockBooks)
    })

    test('應該能匯出為 CSV 格式', () => {
      // eslint-disable-next-line no-unused-vars
      const csvData = exporter.exportToCSV()

      expect(csvData).toBeDefined()
      expect(typeof csvData).toBe('string')
      expect(csvData.length).toBeGreaterThan(0)
    })

    test('CSV 匯出應該包含標題行', () => {
      // eslint-disable-next-line no-unused-vars
      const csvData = exporter.exportToCSV()
      // eslint-disable-next-line no-unused-vars
      const lines = csvData.split('\n')

      expect(lines.length).toBeGreaterThan(1)
      expect(lines[0]).toContain('title')
      expect(lines[0]).toContain('author')
    })

    test('CSV 匯出應該包含所有書籍資料', () => {
      // eslint-disable-next-line no-unused-vars
      const csvData = exporter.exportToCSV()
      // eslint-disable-next-line no-unused-vars
      const lines = csvData.split('\n')

      // 標題行 + 資料行（過濾掉空行）
      // eslint-disable-next-line no-unused-vars
      const nonEmptyLines = lines.filter(line => line.trim().length > 0)
      expect(nonEmptyLines.length).toBe(mockBooks.length + 1)

      // 檢查是否包含書籍標題
      expect(csvData).toContain('JavaScript 高級程式設計')
      expect(csvData).toContain('Python 機器學習')
      expect(csvData).toContain('Web 前端開發實戰')
    })

    test('應該能自訂 CSV 匯出欄位', () => {
      // eslint-disable-next-line no-unused-vars
      const fields = ['title', 'author', 'progress']
      // eslint-disable-next-line no-unused-vars
      const csvData = exporter.exportToCSV({ fields })
      // eslint-disable-next-line no-unused-vars
      const lines = csvData.split('\n')

      // 檢查標題行只包含指定欄位
      // eslint-disable-next-line no-unused-vars
      const headers = lines[0].split(',')
      expect(headers.length).toBe(3)
      expect(headers).toContain('title')
      expect(headers).toContain('author')
      expect(headers).toContain('progress')
    })

    test('應該能處理 CSV 中的特殊字符', () => {
      // eslint-disable-next-line no-unused-vars
      const booksWithSpecialChars = [{
        id: '1',
        title: 'Book with "quotes" and, commas',
        author: 'Author with\nnewlines',
        notes: 'Notes with special chars: àáâãäå'
      }]

      // eslint-disable-next-line no-unused-vars
      const specialExporter = new BookDataExporter(booksWithSpecialChars)
      // eslint-disable-next-line no-unused-vars
      const csvData = specialExporter.exportToCSV()

      expect(csvData).toBeDefined()
      expect(typeof csvData).toBe('string')
      // CSV 應該正確處理引號和逗號
      expect(csvData).toContain('"Book with ""quotes"" and, commas"')
    })

    test('應該能設定 CSV 分隔符號', () => {
      // eslint-disable-next-line no-unused-vars
      const csvData = exporter.exportToCSV({ delimiter: ';' })

      expect(csvData).toContain(';')
      expect(csvData.split(';').length).toBeGreaterThan(1)
    })
  })

  describe('🔴 Red Phase: JSON 匯出功能', () => {
    beforeEach(() => {
      exporter = new BookDataExporter(mockBooks)
    })

    test('應該能匯出為 JSON 格式', () => {
      // eslint-disable-next-line no-unused-vars
      const jsonData = exporter.exportToJSON()

      expect(jsonData).toBeDefined()
      expect(typeof jsonData).toBe('string')

      // 驗證是否為有效的 JSON
      expect(() => JSON.parse(jsonData)).not.toThrow()
    })

    test('JSON 匯出應該包含所有書籍資料', () => {
      // eslint-disable-next-line no-unused-vars
      const jsonData = exporter.exportToJSON()
      // eslint-disable-next-line no-unused-vars
      const parsedData = JSON.parse(jsonData)

      expect(Array.isArray(parsedData)).toBe(true)
      expect(parsedData.length).toBe(mockBooks.length)
      expect(parsedData[0]).toHaveProperty('title')
      expect(parsedData[0]).toHaveProperty('author')
    })

    test('應該能設定 JSON 格式化選項', () => {
      // eslint-disable-next-line no-unused-vars
      const prettyJsonData = exporter.exportToJSON({ pretty: true })
      // eslint-disable-next-line no-unused-vars
      const compactJsonData = exporter.exportToJSON({ pretty: false })

      // 格式化的 JSON 應該包含換行符和縮排
      expect(prettyJsonData.includes('\n')).toBe(true)
      expect(prettyJsonData.includes('  ')).toBe(true)

      // 緊湊的 JSON 不應該包含不必要的空白
      expect(compactJsonData.includes('\n')).toBe(false)
    })

    test('應該能自訂 JSON 匯出欄位', () => {
      // eslint-disable-next-line no-unused-vars
      const fields = ['title', 'author', 'rating']
      // eslint-disable-next-line no-unused-vars
      const jsonData = exporter.exportToJSON({ fields })
      // eslint-disable-next-line no-unused-vars
      const parsedData = JSON.parse(jsonData)

      expect(parsedData[0]).toHaveProperty('title')
      expect(parsedData[0]).toHaveProperty('author')
      expect(parsedData[0]).toHaveProperty('rating')
      expect(parsedData[0]).not.toHaveProperty('isbn')
    })

    test('應該能加入 JSON 匯出的元資料', () => {
      // eslint-disable-next-line no-unused-vars
      const jsonData = exporter.exportToJSON({
        includeMetadata: true,
        metadata: {
          exportDate: '2025-08-06',
          version: '1.0.0',
          totalBooks: mockBooks.length
        }
      })

      // eslint-disable-next-line no-unused-vars
      const parsedData = JSON.parse(jsonData)
      expect(parsedData).toHaveProperty('metadata')
      expect(parsedData).toHaveProperty('books')
      expect(parsedData.metadata.totalBooks).toBe(mockBooks.length)
    })
  })

  describe('🔴 Red Phase: Excel 匯出功能', () => {
    beforeEach(() => {
      exporter = new BookDataExporter(mockBooks)
    })

    test('應該能匯出為 Excel 格式', () => {
      // eslint-disable-next-line no-unused-vars
      const excelData = exporter.exportToExcel()

      expect(excelData).toBeDefined()
      expect(excelData instanceof ArrayBuffer || typeof excelData === 'object').toBe(true)
    })

    test('應該能設定 Excel 工作表名稱', () => {
      // eslint-disable-next-line no-unused-vars
      const sheetName = '我的書籍清單'
      // eslint-disable-next-line no-unused-vars
      const excelData = exporter.exportToExcel({ sheetName })

      expect(excelData).toBeDefined()
      // 注意：實際測試中需要檢查 Excel 檔案內容
    })

    test('應該能加入 Excel 格式設定', () => {
      // eslint-disable-next-line no-unused-vars
      const options = {
        headerStyle: {
          font: { bold: true },
          fill: { fgColor: { rgb: 'FFCCCCCC' } }
        },
        columnWidths: [20, 15, 30, 12]
      }

      // eslint-disable-next-line no-unused-vars
      const excelData = exporter.exportToExcel(options)
      expect(excelData).toBeDefined()
    })

    test('應該能創建多個 Excel 工作表', () => {
      // eslint-disable-next-line no-unused-vars
      const sheets = [
        { name: '程式設計書籍', data: mockBooks.filter(book => book.category === '程式設計') },
        { name: '機器學習書籍', data: mockBooks.filter(book => book.category === '機器學習') }
      ]

      // eslint-disable-next-line no-unused-vars
      const excelData = exporter.exportToExcel({ multiSheet: true, sheets })
      expect(excelData).toBeDefined()
    })
  })

  describe('🔴 Red Phase: PDF 報告功能', () => {
    beforeEach(() => {
      exporter = new BookDataExporter(mockBooks)
    })

    test('應該能匯出為 PDF 報告', () => {
      // eslint-disable-next-line no-unused-vars
      const pdfData = exporter.exportToPDF()

      expect(pdfData).toBeDefined()
      expect(pdfData instanceof ArrayBuffer || typeof pdfData === 'object').toBe(true)
    })

    test('應該能設定 PDF 報告範本', () => {
      // eslint-disable-next-line no-unused-vars
      const template = 'summary' // 或 'detailed', 'custom'
      // eslint-disable-next-line no-unused-vars
      const pdfData = exporter.exportToPDF({ template })

      expect(pdfData).toBeDefined()
    })

    test('應該能加入 PDF 報告統計資訊', () => {
      // eslint-disable-next-line no-unused-vars
      const options = {
        includeStats: true,
        includeCharts: true,
        title: '我的書籍閱讀報告'
      }

      // eslint-disable-next-line no-unused-vars
      const pdfData = exporter.exportToPDF(options)
      expect(pdfData).toBeDefined()
    })

    test('應該能自訂 PDF 報告樣式', () => {
      // eslint-disable-next-line no-unused-vars
      const style = {
        fontFamily: 'Arial',
        fontSize: 12,
        primaryColor: '#333333',
        accentColor: '#007bff'
      }

      // eslint-disable-next-line no-unused-vars
      const pdfData = exporter.exportToPDF({ style })
      expect(pdfData).toBeDefined()
    })
  })

  describe('🔴 Red Phase: 批量匯出和壓縮', () => {
    beforeEach(() => {
      exporter = new BookDataExporter(mockBooks)
    })

    test('應該能批量匯出多種格式', () => {
      // eslint-disable-next-line no-unused-vars
      const formats = ['csv', 'json', 'excel']
      // eslint-disable-next-line no-unused-vars
      const batchExport = exporter.batchExport(formats)

      expect(batchExport).toBeDefined()
      expect(typeof batchExport).toBe('object')
      expect(batchExport).toHaveProperty('csv')
      expect(batchExport).toHaveProperty('json')
      expect(batchExport).toHaveProperty('excel')
    })

    test('應該能創建壓縮檔案', () => {
      // eslint-disable-next-line no-unused-vars
      const zipData = exporter.exportToZip(['csv', 'json'])

      expect(zipData).toBeDefined()
      expect(zipData instanceof ArrayBuffer || typeof zipData === 'object').toBe(true)
    })

    test('應該能設定壓縮檔案名稱和結構', () => {
      // eslint-disable-next-line no-unused-vars
      const options = {
        zipName: 'my-books-export.zip',
        folder: 'book-data',
        includeReadme: true
      }

      // eslint-disable-next-line no-unused-vars
      const zipData = exporter.exportToZip(['csv', 'json'], options)
      expect(zipData).toBeDefined()
    })

    test('應該能按分類分組匯出', () => {
      // eslint-disable-next-line no-unused-vars
      const groupedExport = exporter.exportByCategory()

      expect(groupedExport).toBeDefined()
      expect(typeof groupedExport).toBe('object')
      expect(groupedExport).toHaveProperty('程式設計')
      expect(groupedExport).toHaveProperty('機器學習')
    })
  })

  describe('🔴 Red Phase: 匯出進度和統計', () => {
    beforeEach(() => {
      exporter = new BookDataExporter(mockBooks)
    })

    test('應該能追蹤匯出進度', () => {
      // eslint-disable-next-line no-unused-vars
      const progressCallback = jest.fn()

      exporter.setProgressCallback(progressCallback)
      exporter.exportToCSV()

      expect(progressCallback).toHaveBeenCalled()
      expect(exporter.currentProgress).toBeGreaterThanOrEqual(0)
      expect(exporter.currentProgress).toBeLessThanOrEqual(100)
    })

    test('應該能取得匯出統計資訊', () => {
      exporter.exportToCSV()
      exporter.exportToJSON()

      // eslint-disable-next-line no-unused-vars
      const stats = exporter.getExportStats()

      expect(stats).toBeDefined()
      expect(stats).toHaveProperty('totalExports')
      expect(stats).toHaveProperty('formatBreakdown')
      expect(stats).toHaveProperty('totalDataExported')
      expect(stats.totalExports).toBe(2)
    })

    test('應該能記錄匯出歷史', () => {
      exporter.exportToCSV()
      exporter.exportToJSON()

      // eslint-disable-next-line no-unused-vars
      const history = exporter.getExportHistory()

      expect(history).toBeDefined()
      expect(Array.isArray(history)).toBe(true)
      expect(history.length).toBe(2)
      expect(history[0]).toHaveProperty('format')
      expect(history[0]).toHaveProperty('timestamp')
      expect(history[0]).toHaveProperty('recordCount')
    })

    test('應該能估算匯出檔案大小', () => {
      // eslint-disable-next-line no-unused-vars
      const csvSize = exporter.estimateFileSize('csv')
      // eslint-disable-next-line no-unused-vars
      const jsonSize = exporter.estimateFileSize('json')

      expect(typeof csvSize).toBe('number')
      expect(typeof jsonSize).toBe('number')
      expect(csvSize).toBeGreaterThan(0)
      expect(jsonSize).toBeGreaterThan(0)
    })
  })

  describe('🔴 Red Phase: 檔案下載和儲存', () => {
    beforeEach(() => {
      exporter = new BookDataExporter(mockBooks)
      // 重新設置 mock
      global.document.createElement = jest.fn(() => ({
        click: jest.fn(),
        setAttribute: jest.fn(),
        style: {},
        href: '',
        download: ''
      }))
    })

    test('應該能觸發檔案下載', () => {
      // eslint-disable-next-line no-unused-vars
      const downloadSpy = jest.spyOn(exporter, 'downloadFile').mockImplementation(() => {})

      exporter.downloadCSV()

      expect(downloadSpy).toHaveBeenCalled()
      expect(downloadSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('.csv'),
        'text/csv'
      )
    })

    test('應該能設定下載檔案名稱', () => {
      // eslint-disable-next-line no-unused-vars
      const downloadSpy = jest.spyOn(exporter, 'downloadFile').mockImplementation(() => {})
      // eslint-disable-next-line no-unused-vars
      const filename = 'my-books-2025.csv'

      exporter.downloadCSV({ filename })

      expect(downloadSpy).toHaveBeenCalledWith(
        expect.any(String),
        filename,
        'text/csv'
      )
    })

    test('應該能儲存到本地檔案系統', async () => {
      // 模擬現代瀏覽器的檔案系統 API
      global.window.showSaveFilePicker = jest.fn().mockResolvedValue({
        createWritable: jest.fn().mockResolvedValue({
          write: jest.fn(),
          close: jest.fn()
        })
      })

      await expect(exporter.saveToFile('csv')).resolves.not.toThrow()
    })

    test('應該能複製到剪貼簿', async () => {
      // 設置 clipboard mock
      global.navigator.clipboard = {
        writeText: jest.fn().mockResolvedValue()
      }

      await exporter.copyToClipboard('csv')
      expect(global.navigator.clipboard.writeText).toHaveBeenCalled()
    })
  })

  describe('🔴 Red Phase: 範本和客製化', () => {
    beforeEach(() => {
      exporter = new BookDataExporter(mockBooks)
    })

    test('應該能使用預設範本', () => {
      // eslint-disable-next-line no-unused-vars
      const templates = exporter.getAvailableTemplates()

      expect(templates).toBeDefined()
      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBeGreaterThan(0)
      expect(templates).toContain('default')
    })

    test('應該能建立自訂範本', () => {
      // eslint-disable-next-line no-unused-vars
      const customTemplate = {
        name: 'reading-progress',
        fields: ['title', 'author', 'progress', 'status'],
        format: 'csv',
        options: { delimiter: ';' }
      }

      exporter.addTemplate(customTemplate)
      // eslint-disable-next-line no-unused-vars
      const templates = exporter.getAvailableTemplates()

      expect(templates).toContain('reading-progress')
    })

    test('應該能套用範本匯出', () => {
      // eslint-disable-next-line no-unused-vars
      const templateName = 'default'
      // eslint-disable-next-line no-unused-vars
      const data = exporter.exportWithTemplate(templateName)

      expect(data).toBeDefined()
      expect(typeof data).toBe('string')
    })

    test('應該能驗證範本格式', () => {
      // eslint-disable-next-line no-unused-vars
      const validTemplate = {
        name: 'valid-template',
        fields: ['title', 'author'],
        format: 'csv'
      }

      // eslint-disable-next-line no-unused-vars
      const invalidTemplate = {
        name: '', // 空名稱
        fields: [], // 空欄位
        format: 'invalid' // 無效格式
      }

      expect(exporter.validateTemplate(validTemplate)).toBe(true)
      expect(exporter.validateTemplate(invalidTemplate)).toBe(false)
    })
  })

  describe('🔴 Red Phase: 錯誤處理和邊界情況', () => {
    test('應該處理空的書籍陣列', () => {
      expect(() => {
        exporter = new BookDataExporter([])
      }).not.toThrow()

      // eslint-disable-next-line no-unused-vars
      const csvData = exporter.exportToCSV()
      expect(csvData).toBeDefined()
      expect(typeof csvData).toBe('string')
    })

    test('應該處理無效的匯出格式', () => {
      exporter = new BookDataExporter(mockBooks)

      expect(() => {
        exporter.exportToFormat('invalid-format')
      }).toThrow()
    })

    test('應該處理書籍資料缺失的情況', () => {
      // eslint-disable-next-line no-unused-vars
      const incompleteBooks = [
        { id: '1', title: 'Incomplete Book' },
        { id: '2' }, // 缺少 title
        null, // null 值
        undefined // undefined 值
      ]

      exporter = new BookDataExporter(incompleteBooks)

      expect(() => {
        exporter.exportToCSV()
      }).not.toThrow()

      expect(() => {
        exporter.exportToJSON()
      }).not.toThrow()
    })

    test('應該處理大量資料的匯出', () => {
      // eslint-disable-next-line no-unused-vars
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `book_${i}`,
        title: `Test Book ${i}`,
        author: `Author ${i % 100}`,
        category: `Category ${i % 10}`,
        progress: i % 101,
        status: ['未開始', '閱讀中', '已完成'][i % 3]
      }))

      // eslint-disable-next-line no-unused-vars
      const largeExporter = new BookDataExporter(largeDataset)

      expect(() => {
        largeExporter.exportToCSV()
      }).not.toThrow()

      expect(() => {
        largeExporter.exportToJSON()
      }).not.toThrow()
    })

    test('應該處理匯出過程中的錯誤', () => {
      exporter = new BookDataExporter(mockBooks)

      // 模擬 URL.createObjectURL 失敗
      // eslint-disable-next-line no-unused-vars
      const originalCreateObjectURL = global.URL.createObjectURL
      global.URL.createObjectURL = jest.fn(() => {
        throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.EXPORT_URL_CREATION_FAILED; error.details = { category: 'testing' }; return error })()
      })

      try {
        // 下載應該拋出錯誤但被捕獲
        expect(() => {
          exporter.downloadCSV()
        }).toThrow(Error)

        // 應該記錄錯誤
        // eslint-disable-next-line no-unused-vars
        const errorLog = exporter.getErrorLog()
        expect(errorLog.length).toBeGreaterThan(0)
      } finally {
        // 恢復原始函數
        global.URL.createObjectURL = originalCreateObjectURL
      }
    })
  })

  describe('v2 JSON Export', () => {
    // v2 data model 的 mock 資料
    const mockBooksV2 = [
      {
        id: 'book-001',
        title: '三體',
        readingStatus: 'finished',
        authors: ['劉慈欣'],
        publisher: '貓頭鷹出版社',
        progress: 100,
        type: 'epub',
        cover: 'https://readmoo.com/cover/book-001.jpg',
        tagIds: ['tag_001', 'tag_002'],
        isManualStatus: false,
        extractedAt: '2026-01-15T10:30:00.000Z',
        updatedAt: '2026-04-01T08:00:00.000Z',
        source: 'readmoo'
      },
      {
        id: 'book-002',
        title: '原子習慣',
        readingStatus: 'reading',
        authors: ['James Clear'],
        publisher: '方智出版社',
        progress: 45,
        type: 'epub',
        cover: '',
        tagIds: [],
        isManualStatus: false,
        extractedAt: '2026-03-15T09:00:00.000Z',
        updatedAt: '2026-04-02T11:00:00.000Z',
        source: 'readmoo'
      },
      {
        id: 'book-003',
        title: '未開始的書',
        readingStatus: 'unread',
        authors: ['測試作者'],
        publisher: '測試出版社',
        progress: 0,
        type: 'pdf',
        cover: '',
        isManualStatus: false,
        extractedAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
        source: 'readmoo'
      }
    ]

    const mockTagCategories = [
      {
        id: 'cat_system_type',
        name: '書籍類型',
        description: '',
        color: '#808080',
        isSystem: true,
        sortOrder: 0,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z'
      }
    ]

    const mockTags = [
      {
        id: 'tag_001',
        name: '科幻',
        categoryId: 'cat_system_type',
        isSystem: false,
        sortOrder: 0,
        createdAt: '2026-04-02T00:00:00.000Z',
        updatedAt: '2026-04-02T00:00:00.000Z'
      },
      {
        id: 'tag_002',
        name: '中國文學',
        categoryId: 'cat_system_type',
        isSystem: false,
        sortOrder: 1,
        createdAt: '2026-04-02T00:00:00.000Z',
        updatedAt: '2026-04-02T00:00:00.000Z'
      }
    ]

    let v2Exporter

    beforeEach(() => {
      v2Exporter = new BookDataExporter(mockBooksV2)
    })

    test('v2 根結構應包含 metadata/tagCategories/tags/books 四區段', () => {
      const jsonString = v2Exporter.exportToJSON({
        formatVersion: '2.0.0',
        tagCategories: mockTagCategories,
        tags: mockTags
      })
      const result = JSON.parse(jsonString)

      expect(result).toHaveProperty('metadata')
      expect(result).toHaveProperty('tagCategories')
      expect(result).toHaveProperty('tags')
      expect(result).toHaveProperty('books')
      // 確認只有 4 個頂層 key
      expect(Object.keys(result)).toEqual(['metadata', 'tagCategories', 'tags', 'books'])
    })

    test('metadata 應包含所有必填欄位且值正確', () => {
      const jsonString = v2Exporter.exportToJSON({
        formatVersion: '2.0.0',
        tagCategories: mockTagCategories,
        tags: mockTags
      })
      const { metadata } = JSON.parse(jsonString)

      expect(metadata.formatVersion).toBe('2.0.0')
      expect(metadata.source).toBe('readmoo-book-extractor')
      expect(metadata.schemaVersion).toBe('3.0.0')
      expect(metadata.totalBooks).toBe(3)
      expect(metadata.totalTags).toBe(2)
      expect(metadata.totalTagCategories).toBe(1)
      // exportDate 應為有效的 ISO 8601
      expect(() => new Date(metadata.exportDate)).not.toThrow()
      expect(new Date(metadata.exportDate).toISOString()).toBe(metadata.exportDate)
    })

    test('tagCategories 和 tags 應原樣序列化', () => {
      const jsonString = v2Exporter.exportToJSON({
        formatVersion: '2.0.0',
        tagCategories: mockTagCategories,
        tags: mockTags
      })
      const result = JSON.parse(jsonString)

      expect(result.tagCategories).toEqual(mockTagCategories)
      expect(result.tags).toEqual(mockTags)
    })

    test('預設 EXTENDED_V2 preset 應篩選正確的 books 欄位', () => {
      const jsonString = v2Exporter.exportToJSON({
        formatVersion: '2.0.0',
        tagCategories: mockTagCategories,
        tags: mockTags
      })
      const { books } = JSON.parse(jsonString)
      const expectedFields = ['id', 'title', 'authors', 'publisher', 'progress', 'readingStatus', 'type', 'tagIds']

      books.forEach(book => {
        expect(Object.keys(book).sort()).toEqual(expectedFields.sort())
      })
      // 第一本書的 tagIds 保留
      expect(books[0].tagIds).toEqual(['tag_001', 'tag_002'])
      expect(books[0].readingStatus).toBe('finished')
    })

    test('BASIC_V2 preset 應只包含基本欄位', () => {
      const jsonString = v2Exporter.exportToJSON({
        formatVersion: '2.0.0',
        fieldPreset: 'BASIC_V2',
        tagCategories: mockTagCategories,
        tags: mockTags
      })
      const { books } = JSON.parse(jsonString)
      const expectedFields = ['id', 'title', 'authors', 'publisher']

      books.forEach(book => {
        expect(Object.keys(book).sort()).toEqual(expectedFields.sort())
      })
    })

    test('COMPLETE_V2 preset 應包含所有 v2 欄位', () => {
      const jsonString = v2Exporter.exportToJSON({
        formatVersion: '2.0.0',
        fieldPreset: 'COMPLETE_V2',
        tagCategories: mockTagCategories,
        tags: mockTags
      })
      const { books } = JSON.parse(jsonString)
      const expectedFields = [
        'id', 'title', 'authors', 'publisher',
        'progress', 'readingStatus', 'type', 'cover',
        'tagIds', 'isManualStatus',
        'extractedAt', 'updatedAt', 'source'
      ]

      // 第一本書（所有欄位都有值）
      expect(Object.keys(books[0]).sort()).toEqual(expectedFields.sort())
      expect(books[0].isManualStatus).toBe(false)
      expect(books[0].source).toBe('readmoo')
    })

    test('書籍無 tagIds 屬性時應輸出空陣列 []', () => {
      // book-003 沒有 tagIds 屬性
      const jsonString = v2Exporter.exportToJSON({
        formatVersion: '2.0.0',
        tagCategories: [],
        tags: []
      })
      const { books } = JSON.parse(jsonString)
      const bookWithoutTags = books.find(b => b.id === 'book-003')

      expect(bookWithoutTags.tagIds).toEqual([])
      // book-002 有空 tagIds
      const bookWithEmptyTags = books.find(b => b.id === 'book-002')
      expect(bookWithEmptyTags.tagIds).toEqual([])
    })
  })

  describe('v2 CSV Export', () => {
    // 與 v2 JSON Export 共用相同的 mock 資料結構
    const mockBooksV2 = [
      {
        id: 'book-001',
        title: '三體',
        readingStatus: 'finished',
        authors: ['劉慈欣'],
        publisher: '貓頭鷹出版社',
        progress: 100,
        type: 'epub',
        cover: 'https://readmoo.com/cover/book-001.jpg',
        tagIds: ['tag_001', 'tag_002'],
        isManualStatus: false,
        extractedAt: '2026-01-15T10:30:00.000Z',
        updatedAt: '2026-04-01T08:00:00.000Z',
        source: 'readmoo'
      },
      {
        id: 'book-002',
        title: '原子習慣',
        readingStatus: 'reading',
        authors: ['James Clear'],
        publisher: '方智出版社',
        progress: 45,
        type: 'epub',
        cover: '',
        tagIds: [],
        isManualStatus: false,
        extractedAt: '2026-03-15T09:00:00.000Z',
        updatedAt: '2026-04-02T11:00:00.000Z',
        source: 'readmoo'
      }
    ]

    const mockTagCategories = [
      {
        id: 'cat_system_type',
        name: '書籍類型',
        description: '',
        color: '#808080',
        isSystem: true,
        sortOrder: 0,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z'
      }
    ]

    const mockTags = [
      {
        id: 'tag_001',
        name: '科幻',
        categoryId: 'cat_system_type',
        isSystem: false,
        sortOrder: 0,
        createdAt: '2026-04-02T00:00:00.000Z',
        updatedAt: '2026-04-02T00:00:00.000Z'
      },
      {
        id: 'tag_002',
        name: '中國文學',
        categoryId: 'cat_system_type',
        isSystem: false,
        sortOrder: 1,
        createdAt: '2026-04-02T00:00:00.000Z',
        updatedAt: '2026-04-02T00:00:00.000Z'
      }
    ]

    let v2Exporter

    beforeEach(() => {
      v2Exporter = new BookDataExporter(mockBooksV2)
    })

    test('CSV v2 標題行應包含 EXTENDED_V2 欄位 + 衍生欄位', () => {
      const csv = v2Exporter.exportToCSV({
        formatVersion: '2.0.0',
        tags: mockTags,
        tagCategories: mockTagCategories
      })
      const headerLine = csv.split('\n')[0]
      const headers = headerLine.split(',')

      // EXTENDED_V2 欄位 + tagNames + tagCategories 衍生欄位
      const expectedHeaders = [
        'id', 'title', 'authors', 'publisher', 'progress',
        'readingStatus', 'type', 'tagIds', 'tagNames', 'tagCategories'
      ]
      expect(headers).toEqual(expectedHeaders)
    })

    test('tagIds 應以分號分隔序列化', () => {
      const csv = v2Exporter.exportToCSV({
        formatVersion: '2.0.0',
        tags: mockTags,
        tagCategories: mockTagCategories
      })
      const lines = csv.split('\n')
      // 第二行是 book-001 的資料
      const book001Row = lines[1]

      // tagIds 欄位（第 8 欄，index 7）應為 "tag_001; tag_002"
      expect(book001Row).toContain('tag_001; tag_002')
    })

    test('tagNames 應正確從 tagIds resolve', () => {
      const csv = v2Exporter.exportToCSV({
        formatVersion: '2.0.0',
        tags: mockTags,
        tagCategories: mockTagCategories
      })
      const lines = csv.split('\n')
      const book001Row = lines[1]

      // tagNames 衍生欄位應從 tag_001 → '科幻', tag_002 → '中國文學'
      expect(book001Row).toContain('科幻; 中國文學')
    })

    test('tagCategories 應正確從 tagIds resolve', () => {
      const csv = v2Exporter.exportToCSV({
        formatVersion: '2.0.0',
        tags: mockTags,
        tagCategories: mockTagCategories
      })
      const lines = csv.split('\n')
      const book001Row = lines[1]

      // 兩個 tag 都屬於 cat_system_type（書籍類型）
      expect(book001Row).toContain('書籍類型; 書籍類型')
    })

    test('無 tag 的書籍衍生欄位應為空字串', () => {
      const csv = v2Exporter.exportToCSV({
        formatVersion: '2.0.0',
        tags: mockTags,
        tagCategories: mockTagCategories
      })
      const lines = csv.split('\n')
      // 第三行是 book-002（tagIds: []）
      const book002Row = lines[2]
      const fields = book002Row.split(',')

      // tagIds（index 7）、tagNames（index 8）、tagCategories（index 9）應為空字串
      expect(fields[7]).toBe('')
      expect(fields[8]).toBe('')
      expect(fields[9]).toBe('')
    })

    test('COMPLETE_V2 preset 應包含所有欄位 + 衍生欄位', () => {
      const csv = v2Exporter.exportToCSV({
        formatVersion: '2.0.0',
        fieldPreset: 'COMPLETE_V2',
        tags: mockTags,
        tagCategories: mockTagCategories
      })
      const headerLine = csv.split('\n')[0]
      const headers = headerLine.split(',')

      // COMPLETE_V2 所有欄位 + tagNames + tagCategories
      const expectedHeaders = [
        'id', 'title', 'authors', 'publisher',
        'progress', 'readingStatus', 'type', 'cover',
        'tagIds', 'isManualStatus',
        'extractedAt', 'updatedAt', 'source',
        'tagNames', 'tagCategories'
      ]
      expect(headers).toEqual(expectedHeaders)
    })
  })
})
