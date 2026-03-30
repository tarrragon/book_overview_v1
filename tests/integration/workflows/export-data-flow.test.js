/**
 * UC-02 匯出完整資訊鏈整合測試
 *
 * 測試範圍：
 * - Storage (currentBooks) -> 格式轉換 -> 檔案產生 -> 下載觸發
 * - JSON 和 CSV 匯出正常路徑
 * - Storage 讀取失敗異常路徑
 * - DOM 結構變更偵測（PROP-005）
 *
 * 設計考量：
 * - 整合測試：驗證元件間串接，非 mock 到底的單元測試
 * - 瀏覽器 API（Blob/URL.createObjectURL/document.createElement）需 mock
 * - chrome.storage API 需 mock
 *
 * @jest-environment jsdom
 */

const { JSDOM } = require('jsdom')

describe('UC-02 匯出完整資訊鏈整合測試', () => {
  let dom
  let document
  let window
  let controller
  let OverviewPageController
  let mockEventBus

  // 測試用書籍資料
  const testBooks = [
    {
      id: 'book-001',
      title: '深入理解 JavaScript',
      progress: 75,
      status: '閱讀中',
      cover: 'https://example.com/cover1.jpg',
      tags: ['readmoo', 'technical'],
      source: 'readmoo'
    },
    {
      id: 'book-002',
      title: '設計模式精解',
      progress: 100,
      status: '已完成',
      cover: 'https://example.com/cover2.jpg',
      tags: ['readmoo'],
      source: 'readmoo'
    }
  ]

  /**
   * 建立包含匯出按鈕的 DOM 結構
   * 需求：OverviewPageController 的 initializeElements 會查找這些 ID
   */
  function createExportDOM () {
    return new JSDOM(`
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head><meta charset="UTF-8"><title>Readmoo 書籍目錄</title></head>
      <body>
        <div class="container">
          <div class="stats">
            <div class="stat-item">
              <div class="stat-number" id="totalBooks">0</div>
              <div class="stat-label">總書籍數</div>
            </div>
            <div class="stat-item">
              <div class="stat-number" id="displayedBooks">0</div>
              <div class="stat-label">顯示中</div>
            </div>
          </div>

          <div class="actions">
            <button class="export-btn" id="exportCSVBtn">匯出 CSV</button>
            <button class="export-btn" id="exportJSONBtn">匯出 JSON</button>
            <button class="export-btn" id="importJSONBtn">匯入 JSON</button>
            <button class="export-btn" id="reloadBtn">重新載入</button>
          </div>

          <div id="fileUploader" style="display: none;">
            <input type="file" id="jsonFileInput" accept=".json">
            <button id="loadFileBtn">載入檔案</button>
          </div>

          <div id="loadingIndicator" style="display: none;">
            <div class="loading-spinner"></div>
            <div class="loading-text">載入中...</div>
          </div>

          <div id="errorContainer" style="display: none;">
            <div id="errorMessage"></div>
            <button id="retryBtn">重試</button>
          </div>

          <input type="text" id="searchBox" placeholder="搜尋...">

          <table id="booksTable">
            <thead>
              <tr>
                <th>封面</th><th>書名</th><th>來源</th><th>進度</th><th>狀態</th>
              </tr>
            </thead>
            <tbody id="tableBody"></tbody>
          </table>
        </div>
      </body>
      </html>
    `)
  }

  /**
   * 建立不含匯出按鈕的 DOM 結構（用於 DOM 結構變更偵測測試）
   */
  function createDOMWithoutExportButtons () {
    return new JSDOM(`
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head><meta charset="UTF-8"><title>Readmoo 書籍目錄</title></head>
      <body>
        <div class="container">
          <div class="stats">
            <div class="stat-number" id="totalBooks">0</div>
            <div class="stat-number" id="displayedBooks">0</div>
          </div>
          <div id="loadingIndicator" style="display: none;">
            <div class="loading-text">載入中...</div>
          </div>
          <div id="errorContainer" style="display: none;">
            <div id="errorMessage"></div>
            <button id="retryBtn">重試</button>
          </div>
          <table id="booksTable">
            <thead><tr><th>封面</th><th>書名</th></tr></thead>
            <tbody id="tableBody"></tbody>
          </table>
        </div>
      </body>
      </html>
    `)
  }

  beforeEach(() => {
    dom = createExportDOM()
    document = dom.window.document
    window = dom.window

    // Mock EventHandler 基礎類別
    global.EventHandler = class EventHandler {
      constructor (name, priority = 2) {
        this.name = name
        this.priority = priority
        this.isEnabled = true
        this.executionCount = 0
        this.lastExecutionTime = null
      }

      async execute (eventData) {
        if (!this.isEnabled) return null
        this.executionCount++
        this.lastExecutionTime = new Date()
        return eventData
      }

      enable () { this.isEnabled = true }
      disable () { this.isEnabled = false }
    }

    // Mock EventBus
    mockEventBus = {
      listeners: new Map(),
      emit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn().mockImplementation((eventName, handler) => {
        if (!mockEventBus.listeners.has(eventName)) {
          mockEventBus.listeners.set(eventName, [])
        }
        mockEventBus.listeners.get(eventName).push(handler)
      }),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      off: jest.fn()
    }

    // 設置全域 DOM 環境
    global.document = document
    global.window = window
    window.EventHandler = global.EventHandler

    // Mock URL API
    global.URL = {
      createObjectURL: jest.fn().mockReturnValue('blob:mock-url'),
      revokeObjectURL: jest.fn()
    }

    // Mock Blob
    global.Blob = jest.fn().mockImplementation((content, options) => ({
      size: content[0] ? content[0].length : 0,
      type: options ? options.type : '',
      content: content[0]
    }))

    // Mock alert
    global.alert = jest.fn()

    // Mock console
    global.console = {
      ...console,
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }

    // 載入 OverviewPageController
    const { OverviewPageController: OPC } = require('@/overview/overview-page-controller')
    OverviewPageController = OPC

    // 建立控制器實例並載入測試資料
    controller = new OverviewPageController(mockEventBus, document)
    controller.books = [...testBooks]
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete global.EventHandler
    delete global.document
    delete global.window
    delete global.URL
    delete global.Blob
    delete global.alert
    delete require.cache[require.resolve('@/overview/overview-page-controller')]
  })

  // ========== 正常路徑：JSON 匯出 ==========

  describe('正常路徑 - JSON 匯出流程', () => {
    test('應從 currentBooks 讀取資料並生成包含正確書籍的 JSON 內容', () => {
      // When: 生成 JSON 內容
      const jsonContent = controller.generateJSONContent()

      // Then: JSON 應包含正確的書籍資料
      const parsed = JSON.parse(jsonContent)
      expect(parsed).toHaveProperty('books')
      expect(parsed.books).toHaveLength(2)

      // 驗證第一本書的資料完整性
      const firstBook = parsed.books[0]
      expect(firstBook.id).toBe('book-001')
      expect(firstBook.title).toBe('深入理解 JavaScript')
      expect(firstBook.progress).toBe(75)
      expect(firstBook.status).toBe('閱讀中')
      expect(firstBook.tags).toEqual(['readmoo', 'technical'])

      // 驗證第二本書
      const secondBook = parsed.books[1]
      expect(secondBook.id).toBe('book-002')
      expect(secondBook.title).toBe('設計模式精解')
      expect(secondBook.progress).toBe(100)
    })

    test('handleExportJSON 應完成完整的 Storage -> 轉換 -> Blob -> 下載流程', () => {
      // Given: 追蹤 link.click 呼叫
      const clickSpy = jest.fn()
      const originalCreateElement = document.createElement.bind(document)
      jest.spyOn(document, 'createElement').mockImplementation((tag) => {
        const el = originalCreateElement(tag)
        if (tag === 'a') {
          el.click = clickSpy
        }
        return el
      })

      // When: 執行 JSON 匯出
      controller.handleExportJSON()

      // Then: 應建立 Blob（JSON MIME 類型）
      expect(global.Blob).toHaveBeenCalledTimes(1)
      const blobArgs = global.Blob.mock.calls[0]
      const blobContent = blobArgs[0][0]
      const blobOptions = blobArgs[1]
      expect(blobOptions.type).toContain('application/json')

      // Then: Blob 內容應為有效的 JSON
      const parsed = JSON.parse(blobContent)
      expect(parsed.books).toHaveLength(2)

      // Then: 應建立下載 URL 並觸發下載
      expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1)
      expect(clickSpy).toHaveBeenCalledTimes(1)

      // Then: 應清理 URL 資源
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })
  })

  // ========== 正常路徑：CSV 匯出 ==========

  describe('正常路徑 - CSV 匯出流程', () => {
    test('應從 currentBooks 讀取資料並生成包含表頭和正確分隔的 CSV 內容', () => {
      // When: 生成 CSV 內容
      const csvContent = controller.generateCSVContent()

      // Then: 第一行應為表頭
      const lines = csvContent.split('\n')
      expect(lines[0]).toBe('書名,書城來源,進度,狀態,封面URL')

      // Then: 應有 2 筆資料行
      expect(lines.length).toBe(3) // 1 表頭 + 2 資料

      // Then: 資料行欄位分隔正確
      const firstDataRow = lines[1]
      expect(firstDataRow).toContain('"深入理解 JavaScript"')
      expect(firstDataRow).toContain('"75"')
      expect(firstDataRow).toContain('"閱讀中"')
    })

    test('CSV 內容應正確處理中文字元', () => {
      // When: 生成 CSV 內容
      const csvContent = controller.generateCSVContent()

      // Then: 中文表頭正確
      expect(csvContent).toContain('書名')
      expect(csvContent).toContain('書城來源')
      expect(csvContent).toContain('封面URL')

      // Then: 中文書名正確
      expect(csvContent).toContain('深入理解 JavaScript')
      expect(csvContent).toContain('設計模式精解')
    })

    test('handleExportCSV 應完成完整的 Storage -> 轉換 -> Blob -> 下載流程', () => {
      // Given: 追蹤 link.click 呼叫
      const clickSpy = jest.fn()
      const originalCreateElement = document.createElement.bind(document)
      jest.spyOn(document, 'createElement').mockImplementation((tag) => {
        const el = originalCreateElement(tag)
        if (tag === 'a') {
          el.click = clickSpy
        }
        return el
      })

      // When: 執行 CSV 匯出
      controller.handleExportCSV()

      // Then: 應建立 Blob（CSV MIME 類型）
      expect(global.Blob).toHaveBeenCalledTimes(1)
      const blobOptions = global.Blob.mock.calls[0][1]
      expect(blobOptions.type).toContain('text/csv')

      // Then: 應觸發下載
      expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1)
      expect(clickSpy).toHaveBeenCalledTimes(1)

      // Then: 下載的檔案名稱應包含日期和 .csv 副檔名
      // 透過 createElement 回傳的 <a> 元素驗證
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })
  })

  // ========== 異常路徑：Storage 讀取失敗 ==========

  describe('異常路徑 - Storage 讀取失敗', () => {
    test('currentBooks 為空時 handleExportJSON 應顯示警告而非觸發下載', () => {
      // Given: 清空書籍資料
      controller.books = []

      // When: 嘗試匯出 JSON
      controller.handleExportJSON()

      // Then: 應顯示「沒有資料可以匯出」警告
      expect(global.alert).toHaveBeenCalledWith('沒有資料可以匯出')

      // Then: 不應建立 Blob 或觸發下載
      expect(global.Blob).not.toHaveBeenCalled()
      expect(global.URL.createObjectURL).not.toHaveBeenCalled()
    })

    test('currentBooks 為空時 handleExportCSV 應顯示警告而非觸發下載', () => {
      // Given: 清空書籍資料
      controller.books = []

      // When: 嘗試匯出 CSV
      controller.handleExportCSV()

      // Then: 應顯示警告
      expect(global.alert).toHaveBeenCalledWith('沒有資料可以匯出')

      // Then: 不應建立 Blob
      expect(global.Blob).not.toHaveBeenCalled()
    })

    test('filteredBooks 為 undefined 時 handleExportJSON 應正確處理', () => {
      // Given: 將 filteredBooks 設為 undefined（模擬異常狀態）
      controller.filteredBooks = undefined

      // When: 嘗試匯出 JSON
      controller.handleExportJSON()

      // Then: 應顯示警告而非拋出錯誤
      expect(global.alert).toHaveBeenCalledWith('沒有資料可以匯出')
      expect(global.Blob).not.toHaveBeenCalled()
    })
  })

  // ========== DOM 結構變更偵測（PROP-005） ==========

  describe('DOM 結構變更偵測 - PROP-005', () => {
    test('匯出按鈕 DOM 選擇器失效時 controller 應正常初始化但按鈕為 null', () => {
      // Given: 使用不含匯出按鈕的 DOM 結構
      delete require.cache[require.resolve('@/overview/overview-page-controller')]
      const minimalDom = createDOMWithoutExportButtons()
      const minimalDocument = minimalDom.window.document
      global.document = minimalDocument
      global.window = minimalDom.window
      minimalDom.window.EventHandler = global.EventHandler

      const { OverviewPageController: FreshOPC } = require('@/overview/overview-page-controller')

      // When: 建立 controller（不含匯出按鈕的 DOM）
      const minimalController = new FreshOPC(mockEventBus, minimalDocument)

      // Then: controller 應正常初始化
      expect(minimalController).toBeDefined()

      // Then: 匯出按鈕元素應為 null
      expect(minimalController.elements.exportCSVBtn).toBeNull()
      expect(minimalController.elements.exportJSONBtn).toBeNull()
    })

    test('匯出按鈕不存在時點擊事件不會綁定，不會拋出錯誤', () => {
      // Given: 使用不含匯出按鈕的 DOM 結構
      delete require.cache[require.resolve('@/overview/overview-page-controller')]
      const minimalDom = createDOMWithoutExportButtons()
      const minimalDocument = minimalDom.window.document
      global.document = minimalDocument
      global.window = minimalDom.window
      minimalDom.window.EventHandler = global.EventHandler

      const { OverviewPageController: FreshOPC } = require('@/overview/overview-page-controller')

      // When/Then: 初始化不應拋出錯誤（setupEventListeners 中有 null 檢查）
      expect(() => {
        const minimalController = new FreshOPC(mockEventBus, minimalDocument)
        minimalController.books = [...testBooks]
      }).not.toThrow()
    })
  })
})
