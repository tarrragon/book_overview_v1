/**
 * Overview 頁面控制器測試 - TDD 循環 #26
 *
 * 測試範圍：
 * - Overview 頁面初始化和事件系統整合
 * - 資料載入和顯示功能
 * - 事件驅動的資料處理
 * - 頁面狀態管理
 * - 與儲存系統的整合
 *
 * 設計考量：
 * - 基於 EventHandler 的架構整合
 * - 與現有事件系統無縫銜接
 * - 響應式資料更新機制
 * - 完整的錯誤處理流程
 *
 * @jest-environment jsdom
 */

const { JSDOM } = require('jsdom')

describe('🖥️ Overview 頁面控制器測試 (TDD循環 #26)', () => {
  let dom
  let document
  let window
  let mockEventBus
  let OverviewPageController

  beforeEach(() => {
    // 創建基本的 DOM 環境
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head>
        <meta charset="UTF-8">
        <title>Readmoo書籍目錄</title>
      </head>
      <body>
        <div class="container">
          <h1 id="pageTitle">📚 Readmoo書籍目錄</h1>
          
          <!-- 統計資訊區域 -->
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

          <!-- 搜尋區域 -->
          <input type="text" id="searchBox" placeholder="🔍 搜尋書籍標題...">
          
          <!-- 操作按鈕區域 -->
          <div class="export-buttons">
            <button class="export-btn" id="exportCSVBtn">📊 匯出 CSV</button>
            <button class="export-btn" id="exportJSONBtn">🧾 匯出 JSON</button>
            <button class="export-btn" id="importJSONBtn">📥 匯入 JSON</button>
            <button class="export-btn" id="selectAllBtn">✅ 選取全部</button>
            <button class="export-btn" id="reloadBtn">🔄 重新載入</button>
            <div style="display:inline-block;margin-left:16px;">
              <label for="sortSelect">排序：</label>
              <select id="sortSelect">
                <option value="title">書名</option>
                <option value="progress">閱讀進度</option>
                <option value="source">書城來源</option>
              </select>
              <select id="sortDirection">
                <option value="asc">升冪</option>
                <option value="desc">降冪</option>
              </select>
            </div>
          </div>

          <!-- 檔案載入區域 -->
          <div id="fileUploader" style="display: none;">
            <div class="file-uploader">
              <h3>📁 載入書籍 JSON 檔案</h3>
              <input type="file" id="jsonFileInput" accept=".json">
              <button class="export-btn" id="loadFileBtn">📂 載入檔案</button>
              <button class="export-btn" id="loadSampleBtn">📚 載入範例資料</button>
            </div>
          </div>

          <!-- 書籍表格區域 -->
          <table id="booksTable">
            <thead>
              <tr>
                <th>封面</th>
                <th>書名</th>
                <th>書城來源</th>
                <th>進度</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody id="tableBody">
            </tbody>
          </table>

          <!-- 載入狀態區域 -->
          <div id="loadingIndicator" style="display: none;">
            <div class="loading-spinner"></div>
            <div class="loading-text">載入中...</div>
          </div>

          <!-- 錯誤訊息區域 -->
          <div id="errorContainer" style="display: none;">
            <div class="error-message" id="errorMessage"></div>
            <button class="error-retry-btn" id="retryBtn">重試</button>
          </div>
        </div>
      </body>
      </html>
    `, {
      runScripts: 'outside-only',
      pretendToBeVisual: true
    })

    document = dom.window.document
    window = dom.window
    global.document = document
    global.window = window

    // Mock EventBus
    mockEventBus = {
      emit: jest.fn().mockResolvedValue(true),
      on: jest.fn(),
      off: jest.fn(),
      once: jest.fn()
    }

    // 重置模組快取
    jest.resetModules()
    OverviewPageController = null
  })

  afterEach(() => {
    if (dom) {
      dom.window.close()
    }
    jest.clearAllMocks()
  })

  describe('🔴 Red Phase: 頁面初始化和事件系統整合', () => {
    test('應該能創建 OverviewPageController 實例', () => {
      // 這個測試應該失敗，因為 OverviewPageController 類別還不存在
      expect(() => {
        const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
        const controller = new OverviewPageController(mockEventBus, document)
        expect(controller).toBeInstanceOf(OverviewPageController)
      }).not.toThrow()
    })

    test('應該能正確初始化 DOM 元素引用', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      // 檢查關鍵 DOM 元素是否正確引用
      expect(controller.elements).toBeDefined()
      expect(controller.elements.totalBooks).toBeTruthy()
      expect(controller.elements.displayedBooks).toBeTruthy()
      expect(controller.elements.searchBox).toBeTruthy()
      expect(controller.elements.tableBody).toBeTruthy()
    })

    test('應該能與事件系統正確整合', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      // 檢查是否正確設置事件監聽器
      expect(mockEventBus.on).toHaveBeenCalledWith('STORAGE.LOAD.COMPLETED', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('EXTRACTION.COMPLETED', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('UI.BOOKS.UPDATE', expect.any(Function))
    })

    test('應該能正確設置初始狀態', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      // 檢查初始狀態設置
      expect(controller.currentBooks).toEqual([])
      expect(controller.filteredBooks).toEqual([])
      expect(controller.isLoading).toBe(false)
      expect(controller.searchTerm).toBe('')
    })
  })

  describe('🔴 Red Phase: 資料載入和顯示功能', () => {
    test('應該能處理 STORAGE.LOAD.COMPLETED 事件', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.handleStorageLoadCompleted).toBe('function')

      const mockBooksData = [
        { id: '1', title: '測試書籍1', cover: 'cover1.jpg', tags: ['readmoo'], progress: 50, status: '閱讀中' },
        { id: '2', title: '測試書籍2', cover: 'cover2.jpg', tags: ['kobo'], progress: 100, status: '已完成' }
      ]

      controller.handleStorageLoadCompleted({ books: mockBooksData })

      // 檢查資料是否正確載入
      expect(controller.currentBooks).toEqual(mockBooksData)
      expect(controller.filteredBooks).toEqual(mockBooksData)
    })

    test('應該能更新統計資訊顯示', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      const mockBooks = [
        { id: '1', title: '書籍1', tags: ['readmoo'], progress: 25, status: '閱讀中' },
        { id: '2', title: '書籍2', tags: ['kobo'], progress: 75, status: '閱讀中' },
        { id: '3', title: '書籍3', tags: ['readmoo'], progress: 100, status: '已完成' }
      ]

      // 設置當前書籍資料，這樣 totalBooks 統計才正確
      controller.currentBooks = mockBooks
      controller.updateStatistics(mockBooks)

      const totalBooks = document.getElementById('totalBooks')
      const displayedBooks = document.getElementById('displayedBooks')

      expect(totalBooks.textContent).toBe('3')
      expect(displayedBooks.textContent).toBe('3')
    })

    test('應該能渲染書籍表格', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      const mockBooks = [
        {
          id: '210327003000101',
          title: '大腦不滿足',
          cover: 'https://example.com/cover1.jpg',
          tags: ['readmoo'],
          progress: 75,
          status: '閱讀中'
        },
        {
          id: '210165843000101',
          title: '我們為何吃太多？',
          cover: 'https://example.com/cover2.jpg',
          tags: ['kobo'],
          progress: 100,
          status: '已完成'
        }
      ]

      controller.renderBooksTable(mockBooks)

      const tableBody = document.getElementById('tableBody')
      const rows = tableBody.querySelectorAll('tr')

      expect(rows.length).toBe(2)
      expect(rows[0].textContent).toContain('大腦不滿足')
      expect(rows[1].textContent).toContain('我們為何吃太多？')
    })

    test('應該能處理空資料狀態', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      controller.renderBooksTable([])

      const tableBody = document.getElementById('tableBody')
      expect(tableBody.children.length).toBe(1) // 應該有一個 "無資料" 的行
      expect(tableBody.textContent).toContain('目前沒有書籍資料')
    })
  })

  describe('🔴 Red Phase: 搜尋和篩選功能', () => {
    test('應該能處理搜尋輸入', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.handleSearchInput).toBe('function')

      const mockBooks = [
        { id: '1', title: '大腦不滿足', tags: ['readmoo'], progress: 50, status: '閱讀中' },
        { id: '2', title: '我們為何吃太多？', tags: ['kobo'], progress: 75, status: '閱讀中' },
        { id: '3', title: '雜食者的兩難', tags: ['readmoo'], progress: 100, status: '已完成' }
      ]

      controller.currentBooks = mockBooks
      controller.handleSearchInput('大腦')

      expect(controller.filteredBooks.length).toBe(1)
      expect(controller.filteredBooks[0].title).toBe('大腦不滿足')
    })

    test('應該能處理搜尋結果為空的情況', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      const mockBooks = [
        { id: '1', title: '大腦不滿足', tags: ['readmoo'], progress: 50, status: '閱讀中' },
        { id: '2', title: '我們為何吃太多？', tags: ['kobo'], progress: 75, status: '閱讀中' }
      ]

      controller.currentBooks = mockBooks
      controller.handleSearchInput('不存在的書籍')

      expect(controller.filteredBooks.length).toBe(0)
    })

    test('應該能清除搜尋條件', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      const mockBooks = [
        { id: '1', title: '大腦不滿足', tags: ['readmoo'], progress: 50, status: '閱讀中' },
        { id: '2', title: '我們為何吃太多？', tags: ['kobo'], progress: 75, status: '閱讀中' }
      ]

      controller.currentBooks = mockBooks
      controller.handleSearchInput('') // 空字串應該顯示所有書籍

      expect(controller.filteredBooks).toEqual(mockBooks)
    })
  })

  describe('🔴 Red Phase: 載入狀態和錯誤處理', () => {
    test('應該能顯示載入狀態', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.showLoading).toBe('function')
      expect(typeof controller.hideLoading).toBe('function')

      controller.showLoading('載入書籍資料中...')

      const loadingIndicator = document.getElementById('loadingIndicator')
      const loadingText = document.querySelector('.loading-text')

      expect(loadingIndicator.style.display).not.toBe('none')
      expect(loadingText.textContent).toBe('載入書籍資料中...')
    })

    test('應該能隱藏載入狀態', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      controller.hideLoading()

      const loadingIndicator = document.getElementById('loadingIndicator')
      expect(loadingIndicator.style.display).toBe('none')
    })

    test('應該能顯示錯誤訊息', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.showError).toBe('function')

      const errorMessage = '載入書籍資料失敗，請檢查網路連線'
      controller.showError(errorMessage)

      const errorContainer = document.getElementById('errorContainer')
      const errorMessageElement = document.getElementById('errorMessage')

      expect(errorContainer.style.display).not.toBe('none')
      expect(errorMessageElement.textContent).toBe(errorMessage)
    })

    test('應該能隱藏錯誤訊息', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.hideError).toBe('function')

      controller.hideError()

      const errorContainer = document.getElementById('errorContainer')
      expect(errorContainer.style.display).toBe('none')
    })
  })

  describe('🔴 Red Phase: 使用者操作處理', () => {
    test('應該能處理匯出 CSV 操作', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.handleExportCSV).toBe('function')

      const mockBooks = [
        { id: '1', title: '書籍1', tags: ['readmoo'], progress: 50, status: '閱讀中' },
        { id: '2', title: '書籍2', tags: ['kobo'], progress: 100, status: '已完成' }
      ]

      // Mock 全域函數
      global.URL = {
        createObjectURL: jest.fn(() => 'blob:url'),
        revokeObjectURL: jest.fn()
      }
      global.Blob = jest.fn()

      controller.filteredBooks = mockBooks
      controller.handleExportCSV()

      expect(global.Blob).toHaveBeenCalled()
    })

    test('應該能處理重新載入操作', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.handleReload).toBe('function')

      controller.handleReload()

      // 檢查是否觸發了資料載入事件
      expect(mockEventBus.emit).toHaveBeenCalledWith('STORAGE.LOAD.REQUESTED', expect.any(Object))
    })

    test('應該能處理檔案載入操作', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.handleFileLoad).toBe('function')

      // Mock File 和 FileReader
      const mockFile = new Blob(['{"books": []}'], { type: 'application/json' })
      mockFile.name = 'test.json'

      global.FileReader = jest.fn(() => ({
        readAsText: jest.fn(),
        result: '{"books": [{"id": "1", "title": "測試書籍"}]}',
        onload: null
      }))

      controller.handleFileLoad(mockFile)

      expect(global.FileReader).toHaveBeenCalled()
    })
  })

  describe('🔴 Red Phase: EventHandler 基底類別整合', () => {
    test('應該正確繼承 EventHandler', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const EventHandler = require('../../../src/core/event-handler')

      const controller = new OverviewPageController(mockEventBus, document)

      expect(controller).toBeInstanceOf(EventHandler)
      expect(controller.name).toBe('OverviewPageController')
      expect(controller.priority).toBeDefined()
    })

    test('應該正確實現 EventHandler 抽象方法', () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.getSupportedEvents).toBe('function')
      expect(typeof controller.process).toBe('function')
      expect(typeof controller.getStatus).toBe('function')
    })

    test('應該能追蹤執行統計', async () => {
      const { OverviewPageController } = require('../../../src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      const initialStats = controller.getStats()
      expect(initialStats.executionCount).toBe(0)

      // 模擬處理事件 - 使用繼承的 handle 方法來觸發統計
      await controller.handle({ type: 'STORAGE.LOAD.COMPLETED', data: { books: [] } })

      const updatedStats = controller.getStats()
      expect(updatedStats.executionCount).toBe(1)
    })
  })
})
