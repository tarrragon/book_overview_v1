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

const BookDataExporter = require('src/export/book-data-exporter')

describe('📤 BookDataExporter 書籍資料匯出器測試 (TDD循環 #29)', () => {
  let exporter
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
      const csvData = exporter.exportToCSV()

      expect(csvData).toBeDefined()
      expect(typeof csvData).toBe('string')
      expect(csvData.length).toBeGreaterThan(0)
    })

    test('CSV 匯出應該包含標題行', () => {
      const csvData = exporter.exportToCSV()
      const lines = csvData.split('\n')

      expect(lines.length).toBeGreaterThan(1)
      expect(lines[0]).toContain('title')
      expect(lines[0]).toContain('author')
    })

    test('CSV 匯出應該包含所有書籍資料', () => {
      const csvData = exporter.exportToCSV()
      const lines = csvData.split('\n')

      // 標題行 + 資料行（過濾掉空行）
      const nonEmptyLines = lines.filter(line => line.trim().length > 0)
      expect(nonEmptyLines.length).toBe(mockBooks.length + 1)

      // 檢查是否包含書籍標題
      expect(csvData).toContain('JavaScript 高級程式設計')
      expect(csvData).toContain('Python 機器學習')
      expect(csvData).toContain('Web 前端開發實戰')
    })

    test('應該能自訂 CSV 匯出欄位', () => {
      const fields = ['title', 'author', 'progress']
      const csvData = exporter.exportToCSV({ fields })
      const lines = csvData.split('\n')

      // 檢查標題行只包含指定欄位
      const headers = lines[0].split(',')
      expect(headers.length).toBe(3)
      expect(headers).toContain('title')
      expect(headers).toContain('author')
      expect(headers).toContain('progress')
    })

    test('應該能處理 CSV 中的特殊字符', () => {
      const booksWithSpecialChars = [{
        id: '1',
        title: 'Book with "quotes" and, commas',
        author: 'Author with\nnewlines',
        notes: 'Notes with special chars: àáâãäå'
      }]

      const specialExporter = new BookDataExporter(booksWithSpecialChars)
      const csvData = specialExporter.exportToCSV()

      expect(csvData).toBeDefined()
      expect(typeof csvData).toBe('string')
      // CSV 應該正確處理引號和逗號
      expect(csvData).toContain('"Book with ""quotes"" and, commas"')
    })

    test('應該能設定 CSV 分隔符號', () => {
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
      const jsonData = exporter.exportToJSON()

      expect(jsonData).toBeDefined()
      expect(typeof jsonData).toBe('string')

      // 驗證是否為有效的 JSON
      expect(() => JSON.parse(jsonData)).not.toThrow()
    })

    test('JSON 匯出應該包含所有書籍資料', () => {
      const jsonData = exporter.exportToJSON()
      const parsedData = JSON.parse(jsonData)

      expect(Array.isArray(parsedData)).toBe(true)
      expect(parsedData.length).toBe(mockBooks.length)
      expect(parsedData[0]).toHaveProperty('title')
      expect(parsedData[0]).toHaveProperty('author')
    })

    test('應該能設定 JSON 格式化選項', () => {
      const prettyJsonData = exporter.exportToJSON({ pretty: true })
      const compactJsonData = exporter.exportToJSON({ pretty: false })

      // 格式化的 JSON 應該包含換行符和縮排
      expect(prettyJsonData.includes('\n')).toBe(true)
      expect(prettyJsonData.includes('  ')).toBe(true)

      // 緊湊的 JSON 不應該包含不必要的空白
      expect(compactJsonData.includes('\n')).toBe(false)
    })

    test('應該能自訂 JSON 匯出欄位', () => {
      const fields = ['title', 'author', 'rating']
      const jsonData = exporter.exportToJSON({ fields })
      const parsedData = JSON.parse(jsonData)

      expect(parsedData[0]).toHaveProperty('title')
      expect(parsedData[0]).toHaveProperty('author')
      expect(parsedData[0]).toHaveProperty('rating')
      expect(parsedData[0]).not.toHaveProperty('isbn')
    })

    test('應該能加入 JSON 匯出的元資料', () => {
      const jsonData = exporter.exportToJSON({
        includeMetadata: true,
        metadata: {
          exportDate: '2025-08-06',
          version: '1.0.0',
          totalBooks: mockBooks.length
        }
      })

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
      const excelData = exporter.exportToExcel()

      expect(excelData).toBeDefined()
      expect(excelData instanceof ArrayBuffer || typeof excelData === 'object').toBe(true)
    })

    test('應該能設定 Excel 工作表名稱', () => {
      const sheetName = '我的書籍清單'
      const excelData = exporter.exportToExcel({ sheetName })

      expect(excelData).toBeDefined()
      // 注意：實際測試中需要檢查 Excel 檔案內容
    })

    test('應該能加入 Excel 格式設定', () => {
      const options = {
        headerStyle: {
          font: { bold: true },
          fill: { fgColor: { rgb: 'FFCCCCCC' } }
        },
        columnWidths: [20, 15, 30, 12]
      }

      const excelData = exporter.exportToExcel(options)
      expect(excelData).toBeDefined()
    })

    test('應該能創建多個 Excel 工作表', () => {
      const sheets = [
        { name: '程式設計書籍', data: mockBooks.filter(book => book.category === '程式設計') },
        { name: '機器學習書籍', data: mockBooks.filter(book => book.category === '機器學習') }
      ]

      const excelData = exporter.exportToExcel({ multiSheet: true, sheets })
      expect(excelData).toBeDefined()
    })
  })

  describe('🔴 Red Phase: PDF 報告功能', () => {
    beforeEach(() => {
      exporter = new BookDataExporter(mockBooks)
    })

    test('應該能匯出為 PDF 報告', () => {
      const pdfData = exporter.exportToPDF()

      expect(pdfData).toBeDefined()
      expect(pdfData instanceof ArrayBuffer || typeof pdfData === 'object').toBe(true)
    })

    test('應該能設定 PDF 報告範本', () => {
      const template = 'summary' // 或 'detailed', 'custom'
      const pdfData = exporter.exportToPDF({ template })

      expect(pdfData).toBeDefined()
    })

    test('應該能加入 PDF 報告統計資訊', () => {
      const options = {
        includeStats: true,
        includeCharts: true,
        title: '我的書籍閱讀報告'
      }

      const pdfData = exporter.exportToPDF(options)
      expect(pdfData).toBeDefined()
    })

    test('應該能自訂 PDF 報告樣式', () => {
      const style = {
        fontFamily: 'Arial',
        fontSize: 12,
        primaryColor: '#333333',
        accentColor: '#007bff'
      }

      const pdfData = exporter.exportToPDF({ style })
      expect(pdfData).toBeDefined()
    })
  })

  describe('🔴 Red Phase: 批量匯出和壓縮', () => {
    beforeEach(() => {
      exporter = new BookDataExporter(mockBooks)
    })

    test('應該能批量匯出多種格式', () => {
      const formats = ['csv', 'json', 'excel']
      const batchExport = exporter.batchExport(formats)

      expect(batchExport).toBeDefined()
      expect(typeof batchExport).toBe('object')
      expect(batchExport).toHaveProperty('csv')
      expect(batchExport).toHaveProperty('json')
      expect(batchExport).toHaveProperty('excel')
    })

    test('應該能創建壓縮檔案', () => {
      const zipData = exporter.exportToZip(['csv', 'json'])

      expect(zipData).toBeDefined()
      expect(zipData instanceof ArrayBuffer || typeof zipData === 'object').toBe(true)
    })

    test('應該能設定壓縮檔案名稱和結構', () => {
      const options = {
        zipName: 'my-books-export.zip',
        folder: 'book-data',
        includeReadme: true
      }

      const zipData = exporter.exportToZip(['csv', 'json'], options)
      expect(zipData).toBeDefined()
    })

    test('應該能按分類分組匯出', () => {
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

      const history = exporter.getExportHistory()

      expect(history).toBeDefined()
      expect(Array.isArray(history)).toBe(true)
      expect(history.length).toBe(2)
      expect(history[0]).toHaveProperty('format')
      expect(history[0]).toHaveProperty('timestamp')
      expect(history[0]).toHaveProperty('recordCount')
    })

    test('應該能估算匯出檔案大小', () => {
      const csvSize = exporter.estimateFileSize('csv')
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
      const downloadSpy = jest.spyOn(exporter, 'downloadFile').mockImplementation(() => {})
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
      const templates = exporter.getAvailableTemplates()

      expect(templates).toBeDefined()
      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBeGreaterThan(0)
      expect(templates).toContain('default')
    })

    test('應該能建立自訂範本', () => {
      const customTemplate = {
        name: 'reading-progress',
        fields: ['title', 'author', 'progress', 'status'],
        format: 'csv',
        options: { delimiter: ';' }
      }

      exporter.addTemplate(customTemplate)
      const templates = exporter.getAvailableTemplates()

      expect(templates).toContain('reading-progress')
    })

    test('應該能套用範本匯出', () => {
      const templateName = 'default'
      const data = exporter.exportWithTemplate(templateName)

      expect(data).toBeDefined()
      expect(typeof data).toBe('string')
    })

    test('應該能驗證範本格式', () => {
      const validTemplate = {
        name: 'valid-template',
        fields: ['title', 'author'],
        format: 'csv'
      }

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
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `book_${i}`,
        title: `Test Book ${i}`,
        author: `Author ${i % 100}`,
        category: `Category ${i % 10}`,
        progress: i % 101,
        status: ['未開始', '閱讀中', '已完成'][i % 3]
      }))

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
      const originalCreateObjectURL = global.URL.createObjectURL
      global.URL.createObjectURL = jest.fn(() => {
        throw new Error('URL creation failed')
      })

      try {
        // 下載應該拋出錯誤但被捕獲
        expect(() => {
          exporter.downloadCSV()
        }).toThrow('URL creation failed')

        // 應該記錄錯誤
        const errorLog = exporter.getErrorLog()
        expect(errorLog.length).toBeGreaterThan(0)
      } finally {
        // 恢復原始函數
        global.URL.createObjectURL = originalCreateObjectURL
      }
    })
  })
})
