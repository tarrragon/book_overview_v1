/**
 * UC-04 搜尋端到端整合測試
 *
 * 測試目標：
 * - 驗證使用者輸入關鍵字 -> 篩選 -> 排序 -> 結果更新的完整流程
 * - 確保 handleSearchInput / applyCurrentFilter / updateDisplay 協同運作正確
 * - 驗證搜尋與排序的互動行為
 *
 * 搜尋流程架構：
 *   User Input (searchBox) -> handleSearchInput(term)
 *     -> this.searchTerm = term.toLowerCase().trim()
 *     -> applyCurrentFilter()
 *       -> filter: currentBooks.filter(book => book.title.toLowerCase().includes(searchTerm))
 *       -> sort: by sortSelect value + sortDirection
 *       -> this.filteredBooks = sorted result
 *     -> updateDisplay()
 *       -> updateStatistics(filteredBooks)
 *       -> renderBooksTable(filteredBooks)
 *
 * @jest-environment jsdom
 */

const { JSDOM } = require('jsdom')

// -- 測試資料 --

const TEST_BOOKS = [
  {
    id: 'book-1',
    title: 'JavaScript 設計模式',
    cover: 'http://example.com/js.jpg',
    progress: 80,
    status: '閱讀中',
    source: 'readmoo',
    tags: ['readmoo'],
    type: '電子書',
    extractedAt: '2025-08-01T00:00:00.000Z'
  },
  {
    id: 'book-2',
    title: 'Python 入門指南',
    cover: 'http://example.com/py.jpg',
    progress: 30,
    status: '閱讀中',
    source: 'readmoo',
    tags: ['readmoo'],
    type: '電子書',
    extractedAt: '2025-08-02T00:00:00.000Z'
  },
  {
    id: 'book-3',
    title: 'CSS 權威指南',
    cover: 'http://example.com/css.jpg',
    progress: 100,
    status: '已完成',
    source: 'kobo',
    tags: ['kobo'],
    type: '電子書',
    extractedAt: '2025-08-03T00:00:00.000Z'
  },
  {
    id: 'book-4',
    title: 'JavaScript 進階實戰',
    cover: 'http://example.com/js2.jpg',
    progress: 10,
    status: '閱讀中',
    source: 'readmoo',
    tags: ['readmoo'],
    type: '電子書',
    extractedAt: '2025-08-04T00:00:00.000Z'
  },
  {
    id: 'book-5',
    title: 'Rust 程式設計',
    cover: 'http://example.com/rust.jpg',
    progress: 55,
    status: '閱讀中',
    source: 'kobo',
    tags: ['kobo'],
    type: '電子書',
    extractedAt: '2025-08-05T00:00:00.000Z'
  },
  {
    id: 'book-6',
    title: 'HTML5 與 CSS3 實務',
    cover: 'http://example.com/html.jpg',
    progress: 0,
    status: '未開始',
    source: 'readmoo',
    tags: ['readmoo'],
    type: '電子書',
    extractedAt: '2025-08-06T00:00:00.000Z'
  }
]

// -- DOM 模板 --

const HTML_TEMPLATE = `
  <!DOCTYPE html>
  <html lang="zh-TW">
  <head>
    <meta charset="UTF-8">
    <title>Readmoo 書籍目錄</title>
  </head>
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

      <div class="controls">
        <input type="text" id="searchBox" placeholder="搜尋書名...">
        <select id="sortSelect">
          <option value="title">書名</option>
          <option value="progress">進度</option>
          <option value="source">來源</option>
        </select>
        <select id="sortDirection">
          <option value="asc">升冪</option>
          <option value="desc">降冪</option>
        </select>
      </div>

      <div class="actions">
        <button class="export-btn" id="importJSONBtn">匯入 JSON</button>
        <button class="export-btn" id="reloadBtn">重新載入</button>
      </div>

      <div id="fileUploader" style="display: none;">
        <div class="file-uploader">
          <h3>載入書籍 JSON 檔案</h3>
          <input type="file" id="jsonFileInput" accept=".json,application/json">
          <button class="export-btn" id="loadFileBtn">載入檔案</button>
        </div>
      </div>

      <div id="loadingIndicator" style="display: none;">
        <div class="loading-spinner"></div>
        <div class="loading-text">載入中...</div>
      </div>

      <div id="errorContainer" style="display: none;">
        <div id="errorMessage"></div>
        <button id="retryBtn">重試</button>
      </div>

      <table id="booksTable">
        <thead>
          <tr>
            <th>封面</th>
            <th>書名</th>
            <th>來源</th>
            <th>進度</th>
            <th>狀態</th>
          </tr>
        </thead>
        <tbody id="tableBody">
        </tbody>
      </table>
    </div>
  </body>
  </html>
`

// -- 測試套件 --

describe('UC-04 搜尋端到端整合測試', () => {
  let dom
  let document
  let window
  let controller
  let OverviewPageController

  beforeEach(() => {
    dom = new JSDOM(HTML_TEMPLATE)
    document = dom.window.document
    window = dom.window

    // Mock EventHandler class
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
    global.mockEventBus = {
      listeners: new Map(),
      emit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      off: jest.fn()
    }

    // Mock console
    global.console = {
      ...console,
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }

    // 設置全域環境
    global.document = document
    global.window = window
    window.EventHandler = global.EventHandler

    // 載入 OverviewPageController
    const mod = require('@/overview/overview-page-controller')
    OverviewPageController = mod.OverviewPageController

    // 建立 controller 並設定測試資料
    controller = new OverviewPageController(global.mockEventBus, document)
    controller.currentBooks = [...TEST_BOOKS]
    controller.filteredBooks = [...TEST_BOOKS]
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete global.EventHandler
    delete global.mockEventBus
    delete global.document
    delete global.window
    delete require.cache[require.resolve('@/overview/overview-page-controller')]
  })

  // -- 輔助函式 --

  /**
   * 取得 filteredBooks 的 title 陣列，方便斷言
   */
  function filteredTitles () {
    return controller.filteredBooks.map(b => b.title)
  }

  /**
   * 取得 DOM 統計數值
   */
  function getDisplayedCount () {
    return document.getElementById('displayedBooks').textContent
  }

  function getTotalCount () {
    return document.getElementById('totalBooks').textContent
  }

  /**
   * 設定 sortSelect 的值
   */
  function setSortKey (key) {
    const el = document.getElementById('sortSelect')
    el.value = key
  }

  /**
   * 設定 sortDirection 的值
   */
  function setSortDirection (dir) {
    const el = document.getElementById('sortDirection')
    el.value = dir
  }

  // ============================================================
  // 正常路徑案例
  // ============================================================

  describe('正常路徑：關鍵字搜尋', () => {
    test('輸入部分書名，filteredBooks 只包含匹配的書', () => {
      // Given: controller 已載入 6 本測試書籍
      expect(controller.currentBooks).toHaveLength(6)

      // When: 使用者輸入 "JavaScript"
      controller.handleSearchInput('JavaScript')

      // Then: filteredBooks 只包含標題含 "javascript" 的 2 本書
      expect(controller.filteredBooks).toHaveLength(2)
      expect(filteredTitles()).toEqual(
        expect.arrayContaining([
          'JavaScript 設計模式',
          'JavaScript 進階實戰'
        ])
      )

      // Then: 統計資訊正確更新
      expect(getTotalCount()).toBe('6')
      expect(getDisplayedCount()).toBe('2')
    })

    test('輸入不同關鍵字，篩選出不同結果', () => {
      // Given: controller 已載入 6 本測試書籍

      // When: 使用者輸入 "指南"
      controller.handleSearchInput('指南')

      // Then: filteredBooks 只包含標題含 "指南" 的 2 本書
      expect(controller.filteredBooks).toHaveLength(2)
      expect(filteredTitles()).toEqual(
        expect.arrayContaining([
          'Python 入門指南',
          'CSS 權威指南'
        ])
      )
      expect(getDisplayedCount()).toBe('2')
    })

    test('清空搜尋框，filteredBooks 包含全部書', () => {
      // Given: 已搜尋 "JavaScript"，只顯示 2 本
      controller.handleSearchInput('JavaScript')
      expect(controller.filteredBooks).toHaveLength(2)

      // When: 使用者清空搜尋框
      controller.handleSearchInput('')

      // Then: filteredBooks 恢復為全部 6 本
      expect(controller.filteredBooks).toHaveLength(6)
      expect(getDisplayedCount()).toBe('6')
    })
  })

  // ============================================================
  // 篩選互動案例
  // ============================================================

  describe('篩選互動：搜尋 + 排序切換', () => {
    test('搜尋後切換排序為 progress，filteredBooks 依進度排序', () => {
      // Given: 使用者搜尋 "JavaScript"，結果為 2 本
      controller.handleSearchInput('JavaScript')
      expect(controller.filteredBooks).toHaveLength(2)

      // When: 切換排序為 progress（升冪）
      setSortKey('progress')
      controller.applyCurrentFilter()

      // Then: 結果仍為 2 本，且按進度升冪排列
      expect(controller.filteredBooks).toHaveLength(2)
      // JavaScript 進階實戰 (10%) < JavaScript 設計模式 (80%)
      expect(controller.filteredBooks[0].title).toBe('JavaScript 進階實戰')
      expect(controller.filteredBooks[0].progress).toBe(10)
      expect(controller.filteredBooks[1].title).toBe('JavaScript 設計模式')
      expect(controller.filteredBooks[1].progress).toBe(80)
    })

    test('切換 sortDirection 為 desc，結果順序反轉', () => {
      // Given: 搜尋 "JavaScript" 並按 progress 升冪排序
      controller.handleSearchInput('JavaScript')
      setSortKey('progress')
      controller.applyCurrentFilter()
      expect(controller.filteredBooks[0].progress).toBe(10) // 升冪：最小在前

      // When: 切換為降冪
      setSortDirection('desc')
      controller.applyCurrentFilter()

      // Then: 結果順序反轉
      expect(controller.filteredBooks).toHaveLength(2)
      expect(controller.filteredBooks[0].title).toBe('JavaScript 設計模式')
      expect(controller.filteredBooks[0].progress).toBe(80)
      expect(controller.filteredBooks[1].title).toBe('JavaScript 進階實戰')
      expect(controller.filteredBooks[1].progress).toBe(10)
    })

    test('全量書籍按 title 降冪排序', () => {
      // Given: 無搜尋條件，全部 6 本書
      controller.handleSearchInput('')

      // When: 切換為 title 降冪
      setSortKey('title')
      setSortDirection('desc')
      controller.applyCurrentFilter()

      // Then: 全部 6 本書按書名 Z->A 排列
      expect(controller.filteredBooks).toHaveLength(6)
      const titles = filteredTitles()
      for (let i = 0; i < titles.length - 1; i++) {
        expect(titles[i].localeCompare(titles[i + 1])).toBeGreaterThanOrEqual(0)
      }
    })
  })

  // ============================================================
  // 邊界案例
  // ============================================================

  describe('邊界案例', () => {
    test('大小寫不敏感搜尋', () => {
      // When: 使用者輸入全大寫 "JAVASCRIPT"
      controller.handleSearchInput('JAVASCRIPT')

      // Then: 仍能匹配到 "JavaScript" 開頭的 2 本書
      expect(controller.filteredBooks).toHaveLength(2)
      expect(filteredTitles()).toEqual(
        expect.arrayContaining([
          'JavaScript 設計模式',
          'JavaScript 進階實戰'
        ])
      )
    })

    test('搜尋無結果時 filteredBooks 為空陣列', () => {
      // When: 使用者輸入不存在的關鍵字
      controller.handleSearchInput('不存在的書名XYZ')

      // Then: filteredBooks 為空陣列
      expect(controller.filteredBooks).toEqual([])
      expect(controller.filteredBooks).toHaveLength(0)
      expect(getDisplayedCount()).toBe('0')
      expect(getTotalCount()).toBe('6')
    })

    test('搜尋詞前後有空白，自動 trim 處理', () => {
      // When: 使用者輸入帶空白的搜尋詞
      controller.handleSearchInput('  Rust  ')

      // Then: 去除空白後匹配到 "Rust 程式設計"
      expect(controller.filteredBooks).toHaveLength(1)
      expect(controller.filteredBooks[0].title).toBe('Rust 程式設計')
    })

    test('搜尋含特殊字元的關鍵字', () => {
      // When: 使用者輸入含特殊字元的搜尋詞（CSS3 含數字）
      controller.handleSearchInput('CSS3')

      // Then: 匹配到 "HTML5 與 CSS3 實務"
      expect(controller.filteredBooks).toHaveLength(1)
      expect(controller.filteredBooks[0].title).toBe('HTML5 與 CSS3 實務')
    })
  })
})
