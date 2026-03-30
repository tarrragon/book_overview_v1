/**
 * UC-01 重複書籍 ID 匯入處理 - 單元測試
 *
 * TDD Red Phase：測試 _handleDuplicateBooks 方法的三種策略
 * - skip：重複 ID 保留既有書籍，不匯入
 * - override：重複 ID 一律用匯入版本替換
 * - merge：比較 updatedAt 時間戳，取較新版本（Last-Write-Wins）
 *
 * @jest-environment jsdom
 */

const { JSDOM } = require('jsdom')

describe('UC-01 重複書籍 ID 匯入處理 - _handleDuplicateBooks', () => {
  let controller
  let OverviewPageController

  // --- 測試資料 ---

  const existingBooks = [
    {
      id: 'book-001',
      title: '既有書籍A',
      cover: 'http://example.com/a.jpg',
      progress: 50,
      author: '作者A',
      updatedAt: '2026-03-01T10:00:00.000Z'
    },
    {
      id: 'book-002',
      title: '既有書籍B',
      cover: 'http://example.com/b.jpg',
      progress: 30,
      author: '作者B',
      updatedAt: '2026-03-10T10:00:00.000Z'
    },
    {
      id: 'book-003',
      title: '既有書籍C',
      cover: 'http://example.com/c.jpg',
      progress: 100,
      author: '作者C',
      updatedAt: '2026-02-15T10:00:00.000Z'
    }
  ]

  const importedBooks = [
    {
      id: 'book-001',
      title: '匯入書籍A（更新版）',
      cover: 'http://example.com/a-new.jpg',
      progress: 75,
      author: '作者A',
      updatedAt: '2026-03-20T10:00:00.000Z'
    },
    {
      id: 'book-002',
      title: '匯入書籍B（舊版）',
      cover: 'http://example.com/b-old.jpg',
      progress: 10,
      author: '作者B',
      updatedAt: '2026-02-01T10:00:00.000Z'
    },
    {
      id: 'book-004',
      title: '匯入書籍D（全新）',
      cover: 'http://example.com/d.jpg',
      progress: 0,
      author: '作者D',
      updatedAt: '2026-03-25T10:00:00.000Z'
    }
  ]

  // --- 環境設定 ---

  beforeEach(() => {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head><meta charset="UTF-8"><title>Test</title></head>
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
              <tr><th>封面</th><th>書名</th><th>來源</th><th>進度</th><th>狀態</th></tr>
            </thead>
            <tbody id="tableBody"></tbody>
          </table>
        </div>
      </body>
      </html>
    `)

    const document = dom.window.document
    const window = dom.window

    // Mock EventHandler
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

    global.document = document
    global.window = window
    window.EventHandler = global.EventHandler

    const { OverviewPageController: Ctrl } = require('@/overview/overview-page-controller')
    OverviewPageController = Ctrl

    controller = new OverviewPageController(global.mockEventBus, document)
    controller.books = []
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete global.EventHandler
    delete global.mockEventBus
    delete global.document
    delete global.window
    delete require.cache[require.resolve('@/overview/overview-page-controller')]
  })

  // =================================================================
  // 1. skip 策略測試
  // =================================================================

  describe('skip 策略：重複 ID 保留既有書籍', () => {
    test('重複 ID 書籍應保留既有版本，不被匯入版本覆蓋', () => {
      // When: 以 skip 策略處理重複書籍
      const result = controller._handleDuplicateBooks(existingBooks, importedBooks, 'skip')

      // Then: book-001 和 book-002 應保留既有版本
      const book001 = result.find(b => b.id === 'book-001')
      expect(book001.title).toBe('既有書籍A')
      expect(book001.progress).toBe(50)

      const book002 = result.find(b => b.id === 'book-002')
      expect(book002.title).toBe('既有書籍B')
      expect(book002.progress).toBe(30)
    })

    test('非重複的匯入書籍應被加入結果', () => {
      // When: 以 skip 策略處理
      const result = controller._handleDuplicateBooks(existingBooks, importedBooks, 'skip')

      // Then: book-004（全新書籍）應被加入
      const book004 = result.find(b => b.id === 'book-004')
      expect(book004).toBeDefined()
      expect(book004.title).toBe('匯入書籍D（全新）')
    })

    test('合併結果應包含所有不重複的書籍', () => {
      // When: 以 skip 策略處理
      const result = controller._handleDuplicateBooks(existingBooks, importedBooks, 'skip')

      // Then: 應有 4 本書（既有 3 本 + 匯入不重複 1 本）
      expect(result).toHaveLength(4)
      const ids = result.map(b => b.id)
      expect(ids).toContain('book-001')
      expect(ids).toContain('book-002')
      expect(ids).toContain('book-003')
      expect(ids).toContain('book-004')
    })
  })

  // =================================================================
  // 2. override 策略測試
  // =================================================================

  describe('override 策略：重複 ID 一律用匯入版本替換', () => {
    test('重複 ID 書籍應被匯入版本替換', () => {
      // When: 以 override 策略處理
      const result = controller._handleDuplicateBooks(existingBooks, importedBooks, 'override')

      // Then: book-001 應被匯入版本替換
      const book001 = result.find(b => b.id === 'book-001')
      expect(book001.title).toBe('匯入書籍A（更新版）')
      expect(book001.progress).toBe(75)
      expect(book001.cover).toBe('http://example.com/a-new.jpg')

      // Then: book-002 也應被匯入版本替換（即使匯入版本較舊）
      const book002 = result.find(b => b.id === 'book-002')
      expect(book002.title).toBe('匯入書籍B（舊版）')
      expect(book002.progress).toBe(10)
    })

    test('非重複的既有書籍應被保留', () => {
      // When: 以 override 策略處理
      const result = controller._handleDuplicateBooks(existingBooks, importedBooks, 'override')

      // Then: book-003（無匯入對應）應保留
      const book003 = result.find(b => b.id === 'book-003')
      expect(book003).toBeDefined()
      expect(book003.title).toBe('既有書籍C')
    })

    test('非重複的匯入書籍應被加入', () => {
      // When: 以 override 策略處理
      const result = controller._handleDuplicateBooks(existingBooks, importedBooks, 'override')

      // Then: book-004 應被加入
      const book004 = result.find(b => b.id === 'book-004')
      expect(book004).toBeDefined()
      expect(book004.title).toBe('匯入書籍D（全新）')
    })

    test('合併結果應包含所有不重複的書籍', () => {
      // When: 以 override 策略處理
      const result = controller._handleDuplicateBooks(existingBooks, importedBooks, 'override')

      // Then: 應有 4 本書
      expect(result).toHaveLength(4)
    })
  })

  // =================================================================
  // 3. merge 策略測試
  // =================================================================

  describe('merge 策略：比較 updatedAt 取較新版本', () => {
    test('匯入版本較新時應取匯入版本', () => {
      // book-001: 既有 2026-03-01 vs 匯入 2026-03-20 => 匯入較新
      const result = controller._handleDuplicateBooks(existingBooks, importedBooks, 'merge')

      const book001 = result.find(b => b.id === 'book-001')
      expect(book001.title).toBe('匯入書籍A（更新版）')
      expect(book001.updatedAt).toBe('2026-03-20T10:00:00.000Z')
    })

    test('既有版本較新時應保留既有版本', () => {
      // book-002: 既有 2026-03-10 vs 匯入 2026-02-01 => 既有較新
      const result = controller._handleDuplicateBooks(existingBooks, importedBooks, 'merge')

      const book002 = result.find(b => b.id === 'book-002')
      expect(book002.title).toBe('既有書籍B')
      expect(book002.updatedAt).toBe('2026-03-10T10:00:00.000Z')
    })

    test('updatedAt 相同時應保留既有版本（保守策略）', () => {
      // Given: 兩本 updatedAt 完全相同的書
      const sameTimeExisting = [
        { id: 'book-same', title: '既有版本', updatedAt: '2026-03-15T10:00:00.000Z' }
      ]
      const sameTimeImported = [
        { id: 'book-same', title: '匯入版本', updatedAt: '2026-03-15T10:00:00.000Z' }
      ]

      const result = controller._handleDuplicateBooks(sameTimeExisting, sameTimeImported, 'merge')

      const book = result.find(b => b.id === 'book-same')
      expect(book.title).toBe('既有版本')
    })

    test('缺少 updatedAt 的書籍應視為最舊', () => {
      // Given: 既有書籍缺少 updatedAt
      const noDateExisting = [
        { id: 'book-nodate', title: '既有無日期', progress: 20 }
      ]
      const withDateImported = [
        { id: 'book-nodate', title: '匯入有日期', progress: 80, updatedAt: '2026-01-01T00:00:00.000Z' }
      ]

      const result = controller._handleDuplicateBooks(noDateExisting, withDateImported, 'merge')

      // Then: 匯入版本有日期，應取匯入版本
      const book = result.find(b => b.id === 'book-nodate')
      expect(book.title).toBe('匯入有日期')
    })

    test('匯入書籍缺少 updatedAt 時應保留既有版本', () => {
      // Given: 匯入書籍缺少 updatedAt
      const withDateExisting = [
        { id: 'book-nodate2', title: '既有有日期', updatedAt: '2026-01-01T00:00:00.000Z' }
      ]
      const noDateImported = [
        { id: 'book-nodate2', title: '匯入無日期' }
      ]

      const result = controller._handleDuplicateBooks(withDateExisting, noDateImported, 'merge')

      // Then: 既有版本有日期，應保留既有版本
      const book = result.find(b => b.id === 'book-nodate2')
      expect(book.title).toBe('既有有日期')
    })

    test('雙方都缺少 updatedAt 時應保留既有版本（保守策略）', () => {
      // Given: 雙方都沒有 updatedAt
      const noDateExisting = [
        { id: 'book-both-nodate', title: '既有無日期' }
      ]
      const noDateImported = [
        { id: 'book-both-nodate', title: '匯入無日期' }
      ]

      const result = controller._handleDuplicateBooks(noDateExisting, noDateImported, 'merge')

      // Then: 都是最舊 = 相同，保守策略保留既有
      const book = result.find(b => b.id === 'book-both-nodate')
      expect(book.title).toBe('既有無日期')
    })

    test('非重複書籍應全部包含在結果中', () => {
      const result = controller._handleDuplicateBooks(existingBooks, importedBooks, 'merge')

      // Then: book-003（僅既有）和 book-004（僅匯入）都應在結果中
      expect(result).toHaveLength(4)
      expect(result.find(b => b.id === 'book-003')).toBeDefined()
      expect(result.find(b => b.id === 'book-004')).toBeDefined()
    })
  })

  // =================================================================
  // 4. 邊界案例
  // =================================================================

  describe('邊界案例', () => {
    test('既有書籍為空清單時應回傳所有匯入書籍', () => {
      const result = controller._handleDuplicateBooks([], importedBooks, 'skip')

      expect(result).toHaveLength(3)
      expect(result.map(b => b.id)).toEqual(['book-001', 'book-002', 'book-004'])
    })

    test('匯入書籍為空清單時應回傳所有既有書籍', () => {
      const result = controller._handleDuplicateBooks(existingBooks, [], 'skip')

      expect(result).toHaveLength(3)
      expect(result.map(b => b.id)).toEqual(['book-001', 'book-002', 'book-003'])
    })

    test('雙方都為空清單時應回傳空陣列', () => {
      const result = controller._handleDuplicateBooks([], [], 'skip')

      expect(result).toHaveLength(0)
      expect(result).toEqual([])
    })

    test('匯入資料內部有重複 ID 時應只取最後一筆', () => {
      // Given: 匯入清單中有兩本 book-dup
      const duplicateImported = [
        { id: 'book-dup', title: '第一版', updatedAt: '2026-01-01T00:00:00.000Z' },
        { id: 'book-dup', title: '第二版', updatedAt: '2026-03-01T00:00:00.000Z' }
      ]

      const result = controller._handleDuplicateBooks([], duplicateImported, 'skip')

      // Then: 應只有一本 book-dup（取最後出現的）
      const dups = result.filter(b => b.id === 'book-dup')
      expect(dups).toHaveLength(1)
      expect(dups[0].title).toBe('第二版')
    })

    test('所有三種策略對空清單應有一致行為', () => {
      const strategies = ['skip', 'override', 'merge']

      for (const strategy of strategies) {
        const result = controller._handleDuplicateBooks(existingBooks, [], strategy)
        expect(result).toHaveLength(3)
      }
    })

    test('完全不重複的兩組書籍應全部合併', () => {
      const groupA = [
        { id: 'a-001', title: 'A書', updatedAt: '2026-01-01T00:00:00.000Z' }
      ]
      const groupB = [
        { id: 'b-001', title: 'B書', updatedAt: '2026-01-01T00:00:00.000Z' }
      ]

      const strategies = ['skip', 'override', 'merge']
      for (const strategy of strategies) {
        const result = controller._handleDuplicateBooks(groupA, groupB, strategy)
        expect(result).toHaveLength(2)
      }
    })
  })
})
