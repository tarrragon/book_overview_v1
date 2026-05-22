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

/**
 * 建立測試用書籍物件
 * @param {Object} overrides - 覆寫欄位
 * @returns {Object} 完整的 Book 測試物件
 */
function makeBook (overrides = {}) {
  return {
    id: overrides.id || '1',
    title: overrides.title || '測試書籍',
    cover: overrides.cover || 'https://example.com/cover.jpg',
    tags: overrides.tags || ['readmoo'],
    progress: overrides.progress ?? 0,
    status: overrides.status || '閱讀中',
    readingStatus: overrides.readingStatus || 'reading',
    tagIds: overrides.tagIds || [],
    ...overrides
  }
}

describe('🖥️ Overview 頁面控制器測試 (TDD循環 #26)', () => {
  let dom
  let document
  let window
  // eslint-disable-next-line no-unused-vars
  let mockEventBus
  // eslint-disable-next-line no-unused-vars
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

    // 載入 EventHandler 並設置到 window
    // eslint-disable-next-line no-unused-vars
    const EventHandler = require('src/core/event-handler')
    window.EventHandler = EventHandler

    // Mock Chrome APIs for Promise-based usage
    global.chrome = {
      storage: {
        local: {
          get: jest.fn().mockImplementation((keys) => {
            return Promise.resolve({
              readmoo_books: []
            })
          }),
          set: jest.fn().mockImplementation(() => Promise.resolve())
        }
      },
      runtime: {
        onMessage: {
          addListener: jest.fn()
        },
        sendMessage: jest.fn().mockImplementation(() => Promise.resolve()),
        lastError: null
      }
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
        const { OverviewPageController } = require('src/overview/overview-page-controller')
        // eslint-disable-next-line no-unused-vars
        const controller = new OverviewPageController(mockEventBus, document)
        expect(controller).toBeInstanceOf(OverviewPageController)
      }).not.toThrow()
    })

    test('應該能正確初始化 DOM 元素引用', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      // 檢查關鍵 DOM 元素是否正確引用
      expect(controller.elements).toBeDefined()
      expect(controller.elements.totalBooks).toBeTruthy()
      expect(controller.elements.displayedBooks).toBeTruthy()
      expect(controller.elements.searchBox).toBeTruthy()
      expect(controller.elements.tableBody).toBeTruthy()
    })

    test('應該能與事件系統正確整合', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const _controller = new OverviewPageController(mockEventBus, document)

      // 檢查是否正確設置事件監聽器
      expect(mockEventBus.on).toHaveBeenCalledWith('STORAGE.LOAD.COMPLETED', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('EXTRACTION.COMPLETED', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('UI.BOOKS.UPDATE', expect.any(Function))
    })

    test('應該能正確設置初始狀態', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
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
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.handleStorageLoadCompleted).toBe('function')

      // eslint-disable-next-line no-unused-vars
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
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      // eslint-disable-next-line no-unused-vars
      const mockBooks = [
        { id: '1', title: '書籍1', tags: ['readmoo'], progress: 25, status: '閱讀中' },
        { id: '2', title: '書籍2', tags: ['kobo'], progress: 75, status: '閱讀中' },
        { id: '3', title: '書籍3', tags: ['readmoo'], progress: 100, status: '已完成' }
      ]

      // 設置當前書籍資料，這樣 totalBooks 統計才正確
      controller.currentBooks = mockBooks
      controller.updateStatistics(mockBooks)

      // eslint-disable-next-line no-unused-vars
      const totalBooks = document.getElementById('totalBooks')
      // eslint-disable-next-line no-unused-vars
      const displayedBooks = document.getElementById('displayedBooks')

      expect(totalBooks.textContent).toBe('3')
      expect(displayedBooks.textContent).toBe('3')
    })

    test('應該能渲染書籍表格', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      // eslint-disable-next-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars
      const tableBody = document.getElementById('tableBody')
      // eslint-disable-next-line no-unused-vars
      const rows = tableBody.querySelectorAll('tr')

      expect(rows.length).toBe(2)
      expect(rows[0].textContent).toContain('大腦不滿足')
      expect(rows[1].textContent).toContain('我們為何吃太多？')
    })

    test('應該能處理空資料狀態', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      controller.renderBooksTable([])

      // eslint-disable-next-line no-unused-vars
      const tableBody = document.getElementById('tableBody')
      expect(tableBody.children.length).toBe(1) // 應該有一個 "無資料" 的行
      expect(tableBody.textContent).toContain('目前沒有書籍資料')
    })
  })

  describe('🔴 Red Phase: 搜尋和篩選功能', () => {
    test('應該能處理搜尋輸入', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.handleSearchInput).toBe('function')

      // eslint-disable-next-line no-unused-vars
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
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      // eslint-disable-next-line no-unused-vars
      const mockBooks = [
        { id: '1', title: '大腦不滿足', tags: ['readmoo'], progress: 50, status: '閱讀中' },
        { id: '2', title: '我們為何吃太多？', tags: ['kobo'], progress: 75, status: '閱讀中' }
      ]

      controller.currentBooks = mockBooks
      controller.handleSearchInput('不存在的書籍')

      expect(controller.filteredBooks.length).toBe(0)
    })

    test('應該能清除搜尋條件', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      // eslint-disable-next-line no-unused-vars
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
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.showLoading).toBe('function')
      expect(typeof controller.hideLoading).toBe('function')

      controller.showLoading('載入書籍資料中...')

      // eslint-disable-next-line no-unused-vars
      const loadingIndicator = document.getElementById('loadingIndicator')
      // eslint-disable-next-line no-unused-vars
      const loadingText = document.querySelector('.loading-text')

      expect(loadingIndicator.style.display).not.toBe('none')
      expect(loadingText.textContent).toBe('載入書籍資料中...')
    })

    test('應該能隱藏載入狀態', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      controller.hideLoading()

      // eslint-disable-next-line no-unused-vars
      const loadingIndicator = document.getElementById('loadingIndicator')
      expect(loadingIndicator.style.display).toBe('none')
    })

    test('應該能顯示錯誤訊息', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.showError).toBe('function')

      // eslint-disable-next-line no-unused-vars
      const errorMessage = '載入書籍資料失敗，請檢查網路連線'
      controller.showError(errorMessage)

      // eslint-disable-next-line no-unused-vars
      const errorContainer = document.getElementById('errorContainer')
      // eslint-disable-next-line no-unused-vars
      const errorMessageElement = document.getElementById('errorMessage')

      expect(errorContainer.style.display).not.toBe('none')
      expect(errorMessageElement.textContent).toBe(errorMessage)
    })

    test('應該能隱藏錯誤訊息', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.hideError).toBe('function')

      controller.hideError()

      // eslint-disable-next-line no-unused-vars
      const errorContainer = document.getElementById('errorContainer')
      expect(errorContainer.style.display).toBe('none')
    })
  })

  describe('🔴 Red Phase: 使用者操作處理', () => {
    test('應該能處理重新載入操作', async () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.handleReload).toBe('function')

      await controller.handleReload()

      // 檢查是否調用了 Chrome Storage
      expect(global.chrome.storage.local.get).toHaveBeenCalledWith(['readmoo_books'])
    })

    test('應該能處理檔案載入操作', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.handleFileLoad).toBe('function')

      // Mock File 和 FileReader
      // eslint-disable-next-line no-unused-vars
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

  // ---------------------------------------------------------------------------
  // AC 3 (Ticket 0.18.0-W6-012.1) — loadBooksFromChromeStorage 直接覆蓋
  //
  // 目的：在 handleReload 間接呼叫之外，補上 loadBooksFromChromeStorage()
  //       本體的四個關鍵場景：有資料、空資料、API 不可用、storage 拋錯。
  //       對應 Solution 章節 H1 根因（stale build artifact 幻象）排除後
  //       source 端應確保的行為契約。
  // ---------------------------------------------------------------------------
  describe('loadBooksFromChromeStorage 載入流程（AC 3 覆蓋）', () => {
    let consoleWarnSpy
    let consoleLogSpy
    let consoleErrorSpy

    beforeEach(() => {
      // 抑制並追蹤 console 輸出（loadBooksFromChromeStorage 內以 console.* 作為 Logger 後備）
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleWarnSpy.mockRestore()
      consoleLogSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })

    test('場景 1：storage 有書 → 寫入 currentBooks 並渲染表格', async () => {
      const mockBooks = [
        makeBook({ id: '1', title: '自動載入書 1', progress: 30, readingStatus: 'reading' }),
        makeBook({ id: '2', title: '自動載入書 2', progress: 100, readingStatus: 'finished' })
      ]
      const extractionTimestamp = Date.now()

      // 覆蓋預設 mock：回傳 readmoo_books 物件結構（books + timestamp）
      global.chrome.storage.local.get = jest.fn().mockResolvedValue({
        readmoo_books: {
          books: mockBooks,
          extractionTimestamp
        }
      })

      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      await controller.loadBooksFromChromeStorage()

      // 1. 已呼叫正確的 storage key
      expect(global.chrome.storage.local.get).toHaveBeenCalledWith(['readmoo_books'])

      // 2. 內部狀態正確更新（驗證 _updateBooksData 被呼叫的副作用）
      expect(controller.currentBooks).toEqual(mockBooks)
      expect(controller.filteredBooks).toEqual(mockBooks)

      // 3. 表格已渲染（updateDisplay → renderBooksTable）
      const tableBody = document.getElementById('tableBody')
      const rows = tableBody.querySelectorAll('tr')
      expect(rows.length).toBe(2)
      expect(rows[0].textContent).toContain('自動載入書 1')
      expect(rows[1].textContent).toContain('自動載入書 2')

      // 4. 統計顯示正確
      expect(document.getElementById('totalBooks').textContent).toBe('2')
      expect(document.getElementById('displayedBooks').textContent).toBe('2')

      // 5. 未觸發錯誤路徑
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    test('場景 2：storage 空 → 顯示空資料狀態（保留手動載入 UI）', async () => {
      // storage 完全沒有 readmoo_books key
      global.chrome.storage.local.get = jest.fn().mockResolvedValue({})

      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      await controller.loadBooksFromChromeStorage()

      expect(global.chrome.storage.local.get).toHaveBeenCalledWith(['readmoo_books'])

      // 1. 空資料 log 已輸出
      const logCalls = consoleLogSpy.mock.calls.map(args => args.join(' ')).join('\n')
      expect(logCalls).toContain('Chrome Storage 中沒有書籍資料')

      // 2. tableBody 顯示「無資料」行（renderBooksTable([]) 行為）
      const tableBody = document.getElementById('tableBody')
      expect(tableBody.children.length).toBe(1)
      expect(tableBody.textContent).toContain('目前沒有書籍資料')

      // 3. 錯誤容器仍隱藏（保留手動載入 UI 流程，不顯示錯誤）
      expect(document.getElementById('errorContainer').style.display).toBe('none')

      // 4. Loading indicator 已收起
      expect(document.getElementById('loadingIndicator').style.display).toBe('none')

      // 5. 未觸發錯誤路徑
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    test('場景 3：chrome.storage API 不可用 → console.warn 提示並提前返回', async () => {
      // 模擬非 Chrome Extension 環境（chrome.storage 缺失）
      const originalChrome = global.chrome
      global.chrome = { runtime: originalChrome.runtime }

      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      await controller.loadBooksFromChromeStorage()

      // 1. console.warn 已被呼叫並包含關鍵字「Chrome Storage API 不可用」
      expect(consoleWarnSpy).toHaveBeenCalled()
      const warnCalls = consoleWarnSpy.mock.calls.map(args => args.join(' ')).join('\n')
      expect(warnCalls).toContain('Chrome Storage API 不可用')

      // 2. 應提前 return：currentBooks 保持初始空陣列，未進入 try/catch
      expect(controller.currentBooks).toEqual([])
      expect(controller.filteredBooks).toEqual([])

      // 3. 沒有觸發錯誤顯示
      expect(document.getElementById('errorContainer').style.display).toBe('none')

      // 還原
      global.chrome = originalChrome
    })

    test('場景 4：chrome.storage.local.get 拋錯 → 觸發 showError 並 console.error', async () => {
      const storageError = new Error('storage quota exceeded')
      global.chrome.storage.local.get = jest.fn().mockRejectedValue(storageError)

      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      await controller.loadBooksFromChromeStorage()

      // 1. console.error 已輸出原始錯誤
      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorCalls = consoleErrorSpy.mock.calls
      const hasExpectedError = errorCalls.some(args =>
        args.some(arg =>
          (typeof arg === 'string' && arg.includes('從 Chrome Storage 載入書籍資料失敗')) ||
          arg === storageError
        )
      )
      expect(hasExpectedError).toBe(true)

      // 2. showError 已執行 → errorContainer 可見
      expect(document.getElementById('errorContainer').style.display).not.toBe('none')

      // 3. errorMessage 文字包含原始錯誤訊息
      expect(document.getElementById('errorMessage').textContent).toContain('storage quota exceeded')

      // 4. Loading indicator 已收起（showError → hideLoading）
      expect(document.getElementById('loadingIndicator').style.display).toBe('none')

      // 5. currentBooks 維持初始空陣列（未誤更新）
      expect(controller.currentBooks).toEqual([])
    })
  })

  describe('Red Phase: readingStatus 篩選 bar 和 badge', () => {
    // 測試用書籍資料，涵蓋全部 6 種 readingStatus
    const mockBooksWithStatus = [
      makeBook({ id: '1', title: '未讀書籍', progress: 0, readingStatus: 'unread' }),
      makeBook({ id: '2', title: '閱讀中書籍', progress: 50, readingStatus: 'reading' }),
      makeBook({ id: '3', title: '已完成書籍', progress: 100, readingStatus: 'finished' }),
      makeBook({ id: '4', title: '待讀書籍', progress: 0, readingStatus: 'queued' }),
      makeBook({ id: '5', title: '已放棄書籍', progress: 30, readingStatus: 'abandoned' }),
      makeBook({ id: '6', title: '參考書籍', progress: 10, readingStatus: 'reference' })
    ]

    test('應該在初始化時設定 statusFilter 為 null（全部）', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      expect(controller.statusFilter).toBeNull()
    })

    test('應該能按 readingStatus 篩選書籍（單一狀態）', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)
      controller.currentBooks = mockBooksWithStatus

      // 篩選 reading 狀態
      controller.setStatusFilter('reading')

      expect(controller.filteredBooks.length).toBe(1)
      expect(controller.filteredBooks[0].readingStatus).toBe('reading')
    })

    test('應該能清除狀態篩選回到全部', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)
      controller.currentBooks = mockBooksWithStatus

      // 先篩選
      controller.setStatusFilter('finished')
      expect(controller.filteredBooks.length).toBe(1)

      // 清除篩選回到全部
      controller.setStatusFilter(null)
      expect(controller.filteredBooks.length).toBe(6)
    })

    test('應該能同時套用文字搜尋和狀態篩選', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)
      controller.currentBooks = [
        ...mockBooksWithStatus,
        makeBook({ id: '7', title: '另一本閱讀中', progress: 20, readingStatus: 'reading' })
      ]

      // 先設定狀態篩選為 reading
      controller.setStatusFilter('reading')
      expect(controller.filteredBooks.length).toBe(2)

      // 再加上文字搜尋
      controller.handleSearchInput('另一本')
      expect(controller.filteredBooks.length).toBe(1)
      expect(controller.filteredBooks[0].title).toBe('另一本閱讀中')
    })

    test('renderBooksTable 應該為每本書顯示 readingStatus badge', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      const books = [
        { id: '1', title: '測試書', tags: ['readmoo'], progress: 50, readingStatus: 'reading' }
      ]

      controller.renderBooksTable(books)

      const tableBody = document.getElementById('tableBody')
      const statusCell = tableBody.querySelector('.reading-status-badge')
      expect(statusCell).not.toBeNull()
      expect(statusCell.textContent).toContain('reading')
      expect(statusCell.dataset.status).toBe('reading')
    })

    test('renderBooksTable 應該為 unread 狀態顯示 readingStatus badge', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      const books = [
        { id: '1', title: '未讀書', tags: ['readmoo'], progress: 0, readingStatus: 'unread' }
      ]

      controller.renderBooksTable(books)

      const tableBody = document.getElementById('tableBody')
      const statusCell = tableBody.querySelector('.reading-status-badge')
      expect(statusCell).not.toBeNull()
      expect(statusCell.textContent).toContain('unread')
      expect(statusCell.dataset.status).toBe('unread')
    })

    test('renderBooksTable 應該為 queued 狀態顯示 readingStatus badge', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      const books = [
        { id: '1', title: '排隊書', tags: ['readmoo'], progress: 0, readingStatus: 'queued' }
      ]

      controller.renderBooksTable(books)

      const tableBody = document.getElementById('tableBody')
      const statusCell = tableBody.querySelector('.reading-status-badge')
      expect(statusCell).not.toBeNull()
      expect(statusCell.textContent).toContain('queued')
      expect(statusCell.dataset.status).toBe('queued')
    })

    test('renderBooksTable 應該為 finished 狀態顯示 readingStatus badge', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      const books = [
        { id: '1', title: '已讀完書', tags: ['readmoo'], progress: 100, readingStatus: 'finished' }
      ]

      controller.renderBooksTable(books)

      const tableBody = document.getElementById('tableBody')
      const statusCell = tableBody.querySelector('.reading-status-badge')
      expect(statusCell).not.toBeNull()
      expect(statusCell.textContent).toContain('finished')
      expect(statusCell.dataset.status).toBe('finished')
    })

    test('renderBooksTable 應該為 abandoned 狀態顯示 readingStatus badge', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      const books = [
        { id: '1', title: '放棄書', tags: ['readmoo'], progress: 30, readingStatus: 'abandoned' }
      ]

      controller.renderBooksTable(books)

      const tableBody = document.getElementById('tableBody')
      const statusCell = tableBody.querySelector('.reading-status-badge')
      expect(statusCell).not.toBeNull()
      expect(statusCell.textContent).toContain('abandoned')
      expect(statusCell.dataset.status).toBe('abandoned')
    })

    test('renderBooksTable 應該為 reference 狀態顯示 readingStatus badge', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      const books = [
        { id: '1', title: '參考書', tags: ['readmoo'], progress: 0, readingStatus: 'reference' }
      ]

      controller.renderBooksTable(books)

      const tableBody = document.getElementById('tableBody')
      const statusCell = tableBody.querySelector('.reading-status-badge')
      expect(statusCell).not.toBeNull()
      expect(statusCell.textContent).toContain('reference')
      expect(statusCell.dataset.status).toBe('reference')
    })
  })

  describe('Red Phase: Tag 顯示元件', () => {
    // 測試用 tag 和 category 資料
    const mockCategories = new Map([
      ['cat-1', { id: 'cat-1', name: '文學', color: '#e91e63' }],
      ['cat-2', { id: 'cat-2', name: '科技', color: '#2196f3' }]
    ])

    const mockTags = new Map([
      ['tag-1', { id: 'tag-1', name: '小說', categoryId: 'cat-1' }],
      ['tag-2', { id: 'tag-2', name: '推理', categoryId: 'cat-1' }],
      ['tag-3', { id: 'tag-3', name: 'AI', categoryId: 'cat-2' }],
      ['tag-4', { id: 'tag-4', name: '機器學習', categoryId: 'cat-2' }],
      ['tag-5', { id: 'tag-5', name: '深度學習', categoryId: 'cat-2' }]
    ])

    test('resolveTagsForDisplay 應正確解析 tagIds 為顯示資料', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      const result = controller.resolveTagsForDisplay(
        ['tag-1', 'tag-3'],
        mockTags,
        mockCategories
      )

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        tagId: 'tag-1',
        tagName: '小說',
        categoryName: '文學',
        categoryColor: '#e91e63'
      })
      expect(result[1]).toEqual({
        tagId: 'tag-3',
        tagName: 'AI',
        categoryName: '科技',
        categoryColor: '#2196f3'
      })
    })

    test('renderBooksTable 應為每本書渲染 tag chips（含 category 色彩）', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)
      controller.tagMap = mockTags
      controller.categoryMap = mockCategories

      const books = [
        { id: '1', title: '測試書', tags: ['readmoo'], progress: 50, readingStatus: 'reading', tagIds: ['tag-1', 'tag-3'] }
      ]

      controller.renderBooksTable(books)

      const tableBody = document.getElementById('tableBody')
      const tagChips = tableBody.querySelectorAll('.tag-chip')
      expect(tagChips.length).toBe(2)
      expect(tagChips[0].textContent).toContain('小說')
      expect(tagChips[0].style.color).toBe('rgb(233, 30, 99)')
      expect(tagChips[1].textContent).toContain('AI')
    })

    test('tag 超過 3 個時應顯示前 3 個 + +N 摺疊指示器', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)
      controller.tagMap = mockTags
      controller.categoryMap = mockCategories

      const books = [
        { id: '1', title: '多標籤書', tags: ['readmoo'], progress: 50, readingStatus: 'reading', tagIds: ['tag-1', 'tag-2', 'tag-3', 'tag-4', 'tag-5'] }
      ]

      controller.renderBooksTable(books)

      const tableBody = document.getElementById('tableBody')
      const tagChips = tableBody.querySelectorAll('.tag-chip:not(.tag-chip--more)')
      const moreChip = tableBody.querySelector('.tag-chip--more')

      expect(tagChips.length).toBe(3)
      expect(moreChip).not.toBeNull()
      expect(moreChip.textContent).toContain('+2')
    })

    test('無 tag 書籍應顯示灰色「未分類」', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)
      controller.tagMap = mockTags
      controller.categoryMap = mockCategories

      const books = [
        { id: '1', title: '無標籤書', tags: ['readmoo'], progress: 50, readingStatus: 'reading', tagIds: [] }
      ]

      controller.renderBooksTable(books)

      const tableBody = document.getElementById('tableBody')
      const bookTags = tableBody.querySelector('.book-tags')
      expect(bookTags).not.toBeNull()
      expect(bookTags.textContent).toContain('未分類')
    })

    test('resolveTagsForDisplay 應跳過無效的 tagIds', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      const result = controller.resolveTagsForDisplay(
        ['tag-1', 'invalid-id', 'tag-3'],
        mockTags,
        mockCategories
      )

      // 無效 ID 被跳過，只回傳有效的 2 個
      expect(result).toHaveLength(2)
      expect(result[0].tagName).toBe('小說')
      expect(result[1].tagName).toBe('AI')
    })
  })

  describe('Red Phase: Tag 篩選 widget 邏輯', () => {
    // 測試用書籍資料，含 tagIds
    const mockBooksWithTags = [
      makeBook({ id: '1', title: '推理小說A', progress: 50, readingStatus: 'reading', tagIds: ['tag-novel', 'tag-mystery'] }),
      makeBook({ id: '2', title: '科幻小說B', progress: 30, readingStatus: 'reading', tagIds: ['tag-novel', 'tag-scifi'] }),
      makeBook({ id: '3', title: 'AI教科書C', progress: 100, readingStatus: 'finished', tagIds: ['tag-tech', 'tag-ai'] }),
      makeBook({ id: '4', title: '歷史書D', progress: 0, readingStatus: 'unread', tagIds: ['tag-history'] }),
      makeBook({ id: '5', title: '無標籤書E', progress: 10, readingStatus: 'reading', tagIds: [] })
    ]

    test('應該在初始化時設定 tagFilterState 為空 Set + OR 模式', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      expect(controller.tagFilterState).toBeDefined()
      expect(controller.tagFilterState.selectedTagIds).toBeInstanceOf(Set)
      expect(controller.tagFilterState.selectedTagIds.size).toBe(0)
      expect(controller.tagFilterState.mode).toBe('or')
    })

    test('setTagFilter OR 模式：書籍有任一選中 tag 即顯示', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)
      controller.currentBooks = mockBooksWithTags

      // 選中 tag-mystery 和 tag-ai（OR 模式）
      controller.setTagFilter(new Set(['tag-mystery', 'tag-ai']), 'or')

      // 推理小說A（有 tag-mystery）和 AI教科書C（有 tag-ai）應顯示
      expect(controller.filteredBooks.length).toBe(2)
      expect(controller.filteredBooks.map(b => b.id)).toEqual(expect.arrayContaining(['1', '3']))
    })

    test('setTagFilter AND 模式：書籍必須包含所有選中 tag', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)
      controller.currentBooks = mockBooksWithTags

      // 選中 tag-novel 和 tag-mystery（AND 模式）
      controller.setTagFilter(new Set(['tag-novel', 'tag-mystery']), 'and')

      // 只有推理小說A 同時有 tag-novel 和 tag-mystery
      expect(controller.filteredBooks.length).toBe(1)
      expect(controller.filteredBooks[0].id).toBe('1')
    })

    test('clearTagFilter 應清除篩選回到全部書籍', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)
      controller.currentBooks = mockBooksWithTags

      // 先篩選
      controller.setTagFilter(new Set(['tag-mystery']), 'or')
      expect(controller.filteredBooks.length).toBe(1)

      // 清除篩選
      controller.clearTagFilter()

      expect(controller.tagFilterState.selectedTagIds.size).toBe(0)
      expect(controller.filteredBooks.length).toBe(5)
    })

    test('空 selectedTagIds 時不篩選（顯示全部）', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)
      controller.currentBooks = mockBooksWithTags

      // 設定空 Set
      controller.setTagFilter(new Set(), 'or')

      expect(controller.filteredBooks.length).toBe(5)
    })

    test('AND 模式應排除空 tagIds 的書籍', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)
      controller.currentBooks = mockBooksWithTags // 已有 id:'5' 的 tagIds: []

      // AND 模式選中 tag-novel
      controller.setTagFilter(new Set(['tag-novel']), 'and')

      // id:5 無標籤書E（tagIds: []）不應出現在結果中
      const ids = controller.filteredBooks.map(b => b.id)
      expect(ids).not.toContain('5')
      // 有 tag-novel 的是 id:1 和 id:2
      expect(controller.filteredBooks.length).toBe(2)
    })
  })

  describe('Red Phase: 三重組合篩選管線（狀態 -> tag -> 文字搜尋）', () => {
    // 測試用書籍資料：涵蓋不同狀態、tag、書名
    const mockBooksForPipeline = [
      makeBook({ id: '1', title: '推理小說三體', progress: 50, readingStatus: 'reading', tagIds: ['tag-novel', 'tag-scifi'] }),
      makeBook({ id: '2', title: '科幻小說基地', progress: 30, readingStatus: 'reading', tagIds: ['tag-novel', 'tag-scifi'] }),
      makeBook({ id: '3', title: 'AI 入門教材', progress: 100, readingStatus: 'finished', tagIds: ['tag-tech'] }),
      makeBook({ id: '4', title: '歷史三國志', progress: 0, readingStatus: 'unread', tagIds: ['tag-history'] }),
      makeBook({ id: '5', title: '推理偵探小說', progress: 10, readingStatus: 'reading', tagIds: ['tag-novel', 'tag-mystery'] })
    ]

    test('狀態+tag 二重篩選：只顯示閱讀中且有 tag-scifi 的書', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)
      controller.currentBooks = mockBooksForPipeline

      // 先設狀態篩選為 reading
      controller.setStatusFilter('reading')
      // 再設 tag 篩選為 tag-scifi
      controller.setTagFilter(new Set(['tag-scifi']), 'or')

      // reading 有 id 1,2,5；tag-scifi 有 id 1,2；交集 = id 1,2
      expect(controller.filteredBooks.length).toBe(2)
      expect(controller.filteredBooks.map(b => b.id)).toEqual(expect.arrayContaining(['1', '2']))
    })

    test('狀態+tag+文字 三重篩選：只顯示閱讀中+tag-scifi+書名含「三體」', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)
      controller.currentBooks = mockBooksForPipeline

      controller.setStatusFilter('reading')
      controller.setTagFilter(new Set(['tag-scifi']), 'or')
      controller.handleSearchInput('三體')

      // reading + tag-scifi = id 1,2；書名含「三體」= id 1
      expect(controller.filteredBooks.length).toBe(1)
      expect(controller.filteredBooks[0].title).toBe('推理小說三體')
    })

    test('三重篩選結果為空時 filteredBooks 為空陣列', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)
      controller.currentBooks = mockBooksForPipeline

      controller.setStatusFilter('finished')
      controller.setTagFilter(new Set(['tag-novel']), 'or')

      // finished 有 id 3；tag-novel 有 id 1,2,5；交集 = 空
      expect(controller.filteredBooks.length).toBe(0)
    })

    test('清除單一篩選條件後其他條件仍生效', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)
      controller.currentBooks = mockBooksForPipeline

      // 三重篩選
      controller.setStatusFilter('reading')
      controller.setTagFilter(new Set(['tag-scifi']), 'or')
      controller.handleSearchInput('三體')
      expect(controller.filteredBooks.length).toBe(1)

      // 清除 tag 篩選，狀態+文字仍生效
      controller.clearTagFilter()

      // reading = id 1,2,5；書名含「三體」= id 1
      expect(controller.filteredBooks.length).toBe(1)
      expect(controller.filteredBooks[0].id).toBe('1')
    })
  })

  describe('🔴 Red Phase: EventHandler 基底類別整合', () => {
    test('應該正確繼承 EventHandler', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const EventHandler = require('src/core/event-handler')

      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      // 檢查是否具有 EventHandler 的關鍵方法和屬性
      expect(controller.name).toBe('OverviewPageController')
      expect(controller.priority).toBeDefined()
      expect(typeof controller.process).toBe('function')
      expect(typeof controller.canHandle).toBe('function')
    })

    test('應該正確實現 EventHandler 抽象方法', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      expect(typeof controller.getSupportedEvents).toBe('function')
      expect(typeof controller.process).toBe('function')
      expect(typeof controller.getStatus).toBe('function')
    })

    test('應該能追蹤執行統計', async () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      // eslint-disable-next-line no-unused-vars
      const controller = new OverviewPageController(mockEventBus, document)

      // eslint-disable-next-line no-unused-vars
      const initialStats = controller.getStats()
      expect(initialStats.executionCount).toBe(0)

      // 模擬處理事件 - 使用繼承的 handle 方法來觸發統計
      await controller.handle({ type: 'STORAGE.LOAD.COMPLETED', data: { books: [] } })

      // eslint-disable-next-line no-unused-vars
      const updatedStats = controller.getStats()
      expect(updatedStats.executionCount).toBe(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Group F：匯入回傳介面 ImportResult 適配（0.19.0-W1-047.2 / IMP-B，場景 9-10）
  //
  // BookFileImporter 回傳介面由 Book[] 升級為 ImportResult
  // （{ books, tagCategories, tags }）。controller 在 handleFileLoad /
  // _handleFileContent 邊界解構 books 傳給 UI 層；tagCategories / tags 本
  // ticket 暫不流入 UI（IMP-C 接手 storage 持久化）。
  // 非匯入呼叫端（STORAGE.LOAD / EXTRACTION / UI.BOOKS.UPDATE）零回歸。
  // ---------------------------------------------------------------------------
  describe('Group F：匯入回傳介面 ImportResult 適配（0.19.0-W1-047.2）', () => {
    test('TC-12 handleFileLoad 解構 ImportResult.books 傳給 UI', async () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      const importResult = {
        books: [
          { id: 'b1', title: '書一', cover: 'http://x/c1.jpg', readingStatus: 'reading' },
          { id: 'b2', title: '書二', cover: 'http://x/c2.jpg', readingStatus: 'finished' },
          { id: 'b3', title: '書三', cover: 'http://x/c3.jpg', readingStatus: 'unread' }
        ],
        tagCategories: [{ id: 'c1', name: 'X' }],
        tags: [{ id: 't1', name: 'Y', categoryId: 'c1' }]
      }
      // stub importer 讀檔回傳 ImportResult
      controller.bookFileImporter._readFileWithReader = jest
        .fn()
        .mockResolvedValue(importResult)
      // W1-047.3 / IMP-C：handleFileLoad 在 _updateUIWithBooks 前插入 replaceAllData
      // 持久化。mock 其回傳 success，使本 TC 聚焦驗證 books 解構傳 UI。
      const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')
      TagStorageAdapter.replaceAllData = jest
        .fn()
        .mockResolvedValue({ success: true, counts: { books: 3, tags: 1, tagCategories: 1 } })
      const updateSpy = jest.spyOn(controller, '_updateUIWithBooks')

      const mockFile = { name: 'books.json', type: 'application/json', size: 100 }
      await controller.handleFileLoad(mockFile)

      // _updateUIWithBooks 收到的是陣列（非 ImportResult 物件）
      expect(updateSpy).toHaveBeenCalledTimes(1)
      const passedArg = updateSpy.mock.calls[0][0]
      expect(Array.isArray(passedArg)).toBe(true)
      expect(passedArg).toHaveLength(3)
      // controller 內部狀態正確
      expect(controller.currentBooks).toHaveLength(3)
      expect(controller.currentBooks).not.toContain(undefined)
    })

    test('TC-13 _handleFileContent 代理解構 ImportResult.books', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      const importResult = {
        books: [
          { id: 'b1', title: '書一', cover: 'http://x/c1.jpg', readingStatus: 'reading' },
          { id: 'b2', title: '書二', cover: 'http://x/c2.jpg', readingStatus: 'finished' }
        ],
        tagCategories: [],
        tags: []
      }
      // stub importer _handleFileContent 回傳 ImportResult
      controller.bookFileImporter._handleFileContent = jest
        .fn()
        .mockReturnValue(importResult)
      const updateSpy = jest.spyOn(controller, '_updateUIWithBooks')

      controller._handleFileContent('{"books":[]}')

      expect(updateSpy).toHaveBeenCalledTimes(1)
      const passedArg = updateSpy.mock.calls[0][0]
      expect(Array.isArray(passedArg)).toBe(true)
      expect(passedArg).toEqual(importResult.books)
    })

    test('TC-14 非匯入呼叫端零回歸（STORAGE / EXTRACTION / UI.BOOKS.UPDATE）', () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      const books = [
        makeBook({ id: 's1', title: '事件書一' }),
        makeBook({ id: 's2', title: '事件書二' })
      ]
      // 前置驗證：eventData.books 為純陣列（非匯入路徑不經 importer）
      expect(Array.isArray(books)).toBe(true)

      // STORAGE.LOAD.COMPLETED：_updateBooksData 收純陣列
      controller.handleStorageLoadCompleted({ books })
      expect(controller.currentBooks).toEqual(books)
      expect(controller.filteredBooks).toEqual(books)

      // UI.BOOKS.UPDATE：_updateBooksData 收純陣列
      const updateBooks = [makeBook({ id: 'u1', title: '更新書' })]
      controller.handleBooksUpdate({ books: updateBooks })
      expect(controller.currentBooks).toEqual(updateBooks)

      // EXTRACTION.COMPLETED：委派 handleReload（不經 importer，行為不變）
      expect(typeof controller.handleExtractionCompleted).toBe('function')
      expect(() => controller.handleExtractionCompleted({})).not.toThrow()
    })
  })

  // ---------------------------------------------------------------------------
  // Group G：UC-04 匯入持久化接線（0.19.0-W1-047.3 / IMP-C，場景 1-6）
  //
  // handleFileLoad 解構 ImportResult 後呼叫 TagStorageAdapter.replaceAllData
  // 覆蓋模式持久化；持久化成功才呼叫 _updateUIWithBooks，失敗則 showError 並
  // 中止 UI 更新。replaceAllData 行為由 storage 測試覆蓋，此處 mock 其回傳契約。
  // ---------------------------------------------------------------------------
  describe('Group G：UC-04 匯入持久化接線（0.19.0-W1-047.3）', () => {
    const mockFile = { name: 'books.json', type: 'application/json', size: 100 }

    /**
     * 建立已 stub importer 與 replaceAllData 的 controller
     * @param {Object} importResult - importer 回傳的 ImportResult
     * @param {Object} writeResult - replaceAllData mock 回傳值
     * @returns {{ controller, replaceAllDataMock }}
     */
    function setupController (importResult, writeResult) {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      controller.bookFileImporter._readFileWithReader = jest
        .fn()
        .mockResolvedValue(importResult)

      // mock TagStorageAdapter.replaceAllData（與 controller 共用同一模組實例）
      const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')
      const replaceAllDataMock = jest.fn().mockResolvedValue(writeResult)
      TagStorageAdapter.replaceAllData = replaceAllDataMock

      return { controller, replaceAllDataMock }
    }

    test('TC-G1 持久化成功才更新 UI', async () => {
      const importResult = {
        books: [
          { id: 'b1', title: '書一', cover: 'http://x/c1.jpg', readingStatus: 'reading' },
          { id: 'b2', title: '書二', cover: 'http://x/c2.jpg', readingStatus: 'finished' },
          { id: 'b3', title: '書三', cover: 'http://x/c3.jpg', readingStatus: 'unread' }
        ],
        tags: [{ id: 't1', name: 'Y', categoryId: 'c1' }],
        tagCategories: [{ id: 'c1', name: 'X' }]
      }
      const { controller, replaceAllDataMock } = setupController(
        importResult,
        { success: true, counts: { books: 3, tags: 1, tagCategories: 1 } }
      )
      // 前置驗證：ImportResult 三欄位為陣列
      expect(Array.isArray(importResult.books)).toBe(true)
      expect(Array.isArray(importResult.tags)).toBe(true)
      expect(Array.isArray(importResult.tagCategories)).toBe(true)

      const updateSpy = jest.spyOn(controller, '_updateUIWithBooks')

      await controller.handleFileLoad(mockFile)

      // replaceAllData 被呼叫一次，引數為物件形式
      expect(replaceAllDataMock).toHaveBeenCalledTimes(1)
      expect(replaceAllDataMock).toHaveBeenCalledWith({
        books: importResult.books,
        tags: importResult.tags,
        tagCategories: importResult.tagCategories
      })
      // _updateUIWithBooks 收到 books 陣列
      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy.mock.calls[0][0]).toEqual(importResult.books)
      expect(controller.currentBooks).toHaveLength(3)
    })

    test('TC-G2 空 tags/tagCategories 仍接線', async () => {
      const importResult = {
        books: [
          { id: 'b1', title: '書一', cover: 'http://x/c1.jpg', readingStatus: 'reading' },
          { id: 'b2', title: '書二', cover: 'http://x/c2.jpg', readingStatus: 'finished' }
        ],
        tags: [],
        tagCategories: []
      }
      const { controller, replaceAllDataMock } = setupController(
        importResult,
        { success: true, counts: { books: 2, tags: 0, tagCategories: 0 } }
      )
      const updateSpy = jest.spyOn(controller, '_updateUIWithBooks')

      await controller.handleFileLoad(mockFile)

      // replaceAllData 收到空陣列（非 undefined）
      const passedArg = replaceAllDataMock.mock.calls[0][0]
      expect(passedArg.tags).toEqual([])
      expect(passedArg.tagCategories).toEqual([])
      expect(updateSpy).toHaveBeenCalledTimes(1)
    })

    test('TC-G3 空書庫成功（_updateUIWithBooks 收 []，不 showError）', async () => {
      const importResult = { books: [], tags: [], tagCategories: [] }
      const { controller, replaceAllDataMock } = setupController(
        importResult,
        { success: true, counts: { books: 0, tags: 0, tagCategories: 0 } }
      )
      const updateSpy = jest.spyOn(controller, '_updateUIWithBooks')
      const errorSpy = jest.spyOn(controller, 'showError')

      await controller.handleFileLoad(mockFile)

      expect(replaceAllDataMock).toHaveBeenCalledTimes(1)
      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy.mock.calls[0][0]).toEqual([])
      expect(errorSpy).not.toHaveBeenCalled()
      expect(controller.currentBooks).toEqual([])
    })

    test('TC-G4 配額不足不更新 UI', async () => {
      const importResult = {
        books: [{ id: 'b1', title: '書一', cover: 'http://x/c1.jpg', readingStatus: 'reading' }],
        tags: [],
        tagCategories: []
      }
      const { controller, replaceAllDataMock } = setupController(
        importResult,
        { success: false, error: 'quota_exceeded' }
      )
      // 前置：currentBooks 保持呼叫前狀態
      const booksBefore = controller.currentBooks
      const updateSpy = jest.spyOn(controller, '_updateUIWithBooks')
      const errorSpy = jest.spyOn(controller, 'showError')

      await controller.handleFileLoad(mockFile)

      expect(replaceAllDataMock).toHaveBeenCalledTimes(1)
      // showError 被呼叫一次，訊息含儲存空間不足語意
      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect(errorSpy.mock.calls[0][0]).toContain('儲存空間不足')
      // _updateUIWithBooks 未被呼叫，currentBooks 維持呼叫前狀態
      expect(updateSpy).not.toHaveBeenCalled()
      expect(controller.currentBooks).toBe(booksBefore)
    })

    test('TC-G5 寫入失敗不更新 UI', async () => {
      const importResult = {
        books: [{ id: 'b1', title: '書一', cover: 'http://x/c1.jpg', readingStatus: 'reading' }],
        tags: [],
        tagCategories: []
      }
      const { controller } = setupController(
        importResult,
        { success: false, error: 'storage_error' }
      )
      const updateSpy = jest.spyOn(controller, '_updateUIWithBooks')
      const errorSpy = jest.spyOn(controller, 'showError')

      await controller.handleFileLoad(mockFile)

      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy).not.toHaveBeenCalled()
    })

    test('TC-G6 檔案驗證失敗不進入持久化（既有行為）', async () => {
      const { OverviewPageController } = require('src/overview/overview-page-controller')
      const controller = new OverviewPageController(mockEventBus, document)

      // importer 驗證階段拋出（既有行為：_validateFileBasics 失敗時 throw）
      const validationError = new Error('檔案驗證失敗')
      controller.bookFileImporter._validateFileBasics = jest.fn(() => {
        throw validationError
      })
      const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')
      const replaceAllDataMock = jest.fn()
      TagStorageAdapter.replaceAllData = replaceAllDataMock
      const updateSpy = jest.spyOn(controller, '_updateUIWithBooks')

      const invalidFile = { name: 'bad.txt', type: 'text/plain', size: 10 }
      let caught = null
      try {
        await controller.handleFileLoad(invalidFile)
      } catch (err) {
        caught = err
      }

      // 驗證階段拋出（既有行為不回歸）
      expect(caught).toBe(validationError)
      // 驗證失敗不進入持久化、不更新 UI
      expect(replaceAllDataMock).not.toHaveBeenCalled()
      expect(updateSpy).not.toHaveBeenCalled()
    })

    test('TC-G7 replaceAllData 引數三欄位內容對應 ImportResult', async () => {
      const importResult = {
        books: [{ id: 'b1', title: '書一', cover: 'http://x/c1.jpg', readingStatus: 'reading' }],
        tags: [{ id: 't1', name: 'Y', categoryId: 'c1' }],
        tagCategories: [{ id: 'c1', name: 'X' }]
      }
      const { controller, replaceAllDataMock } = setupController(
        importResult,
        { success: true, counts: { books: 1, tags: 1, tagCategories: 1 } }
      )

      await controller.handleFileLoad(mockFile)

      // 防欄位錯置：三欄位內容分別等於 ImportResult 對應欄位
      const passedArg = replaceAllDataMock.mock.calls[0][0]
      expect(passedArg.books).toEqual(importResult.books)
      expect(passedArg.tags).toEqual(importResult.tags)
      expect(passedArg.tagCategories).toEqual(importResult.tagCategories)
    })
  })
})
