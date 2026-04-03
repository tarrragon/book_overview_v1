/**
 * Book Schema v2 Duplicate Handling - 單元測試
 *
 * TDD Red Phase：測試 _handleDuplicateBooks 方法的 Schema v2 合併策略
 * - readingStatus 合併：isManualStatus=true 優先（manual > auto）
 * - progress 合併：取較大值
 * - tagIds 合併：聯集（union，去重）
 * - 時間戳比較：updatedAt 決定基底版本
 * - 其他欄位：取非空值
 * - 跨平台去重：title + authors 組合識別
 *
 * @jest-environment jsdom
 */

const { JSDOM } = require('jsdom')

describe('Book Schema v2 Duplicate Handling - _handleDuplicateBooks', () => {
  let controller
  let OverviewPageController

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
  // 1. readingStatus 合併策略：isManualStatus=true 優先
  // =================================================================

  describe('readingStatus 合併：isManualStatus=true 優先', () => {
    test('merge 策略：manual status 應優先於 auto status（既有為 manual）', () => {
      const existing = [{
        id: 'book-rs-001',
        title: '測試書籍',
        readingStatus: 'finished',
        isManualStatus: true,
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]
      const imported = [{
        id: 'book-rs-001',
        title: '測試書籍',
        readingStatus: 'reading',
        isManualStatus: false,
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')
      const book = result.find(b => b.id === 'book-rs-001')

      // 既有版本 isManualStatus=true，即使匯入較新也應保留 manual status
      expect(book.readingStatus).toBe('finished')
      expect(book.isManualStatus).toBe(true)
    })

    test('merge 策略：manual status 應優先於 auto status（匯入為 manual）', () => {
      const existing = [{
        id: 'book-rs-002',
        title: '測試書籍',
        readingStatus: 'reading',
        isManualStatus: false,
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]
      const imported = [{
        id: 'book-rs-002',
        title: '測試書籍',
        readingStatus: 'abandoned',
        isManualStatus: true,
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')
      const book = result.find(b => b.id === 'book-rs-002')

      // 匯入版本 isManualStatus=true，即使既有較新也應取匯入的 manual status
      expect(book.readingStatus).toBe('abandoned')
      expect(book.isManualStatus).toBe(true)
    })

    test('merge 策略：雙方都是 manual 時取較新版本的 status', () => {
      const existing = [{
        id: 'book-rs-003',
        title: '測試書籍',
        readingStatus: 'reading',
        isManualStatus: true,
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]
      const imported = [{
        id: 'book-rs-003',
        title: '測試書籍',
        readingStatus: 'finished',
        isManualStatus: true,
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')
      const book = result.find(b => b.id === 'book-rs-003')

      // 雙方都是 manual，取 updatedAt 較新的
      expect(book.readingStatus).toBe('finished')
      expect(book.isManualStatus).toBe(true)
    })

    test('merge 策略：雙方都是 auto 時取較新版本的 status', () => {
      const existing = [{
        id: 'book-rs-004',
        title: '測試書籍',
        readingStatus: 'reading',
        isManualStatus: false,
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]
      const imported = [{
        id: 'book-rs-004',
        title: '測試書籍',
        readingStatus: 'finished',
        isManualStatus: false,
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')
      const book = result.find(b => b.id === 'book-rs-004')

      // 雙方都是 auto，取 updatedAt 較新的
      expect(book.readingStatus).toBe('finished')
    })
  })

  // =================================================================
  // 2. progress 合併策略：取較大值
  // =================================================================

  describe('progress 合併：取較大值', () => {
    test('merge 策略：應取兩者中較大的 progress', () => {
      const existing = [{
        id: 'book-pg-001',
        title: '測試書籍',
        progress: 30,
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]
      const imported = [{
        id: 'book-pg-001',
        title: '測試書籍',
        progress: 80,
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')
      const book = result.find(b => b.id === 'book-pg-001')

      // 即使既有較新，progress 應取較大值 80
      expect(book.progress).toBe(80)
    })

    test('merge 策略：progress 為 0 時應取較大值', () => {
      const existing = [{
        id: 'book-pg-002',
        title: '測試書籍',
        progress: 0,
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]
      const imported = [{
        id: 'book-pg-002',
        title: '測試書籍',
        progress: 50,
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')
      const book = result.find(b => b.id === 'book-pg-002')

      expect(book.progress).toBe(50)
    })

    test('merge 策略：progress 缺失時應取有值的一方', () => {
      const existing = [{
        id: 'book-pg-003',
        title: '測試書籍',
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]
      const imported = [{
        id: 'book-pg-003',
        title: '測試書籍',
        progress: 40,
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')
      const book = result.find(b => b.id === 'book-pg-003')

      expect(book.progress).toBe(40)
    })
  })

  // =================================================================
  // 3. tagIds 合併策略：聯集 union（去重）
  // =================================================================

  describe('tagIds 合併：聯集 union（去重）', () => {
    test('merge 策略：tagIds 應取兩者的聯集', () => {
      const existing = [{
        id: 'book-tg-001',
        title: '測試書籍',
        tagIds: ['tag-a', 'tag-b'],
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]
      const imported = [{
        id: 'book-tg-001',
        title: '測試書籍',
        tagIds: ['tag-b', 'tag-c'],
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')
      const book = result.find(b => b.id === 'book-tg-001')

      // 聯集去重：tag-a, tag-b, tag-c
      expect(book.tagIds).toHaveLength(3)
      expect(book.tagIds).toContain('tag-a')
      expect(book.tagIds).toContain('tag-b')
      expect(book.tagIds).toContain('tag-c')
    })

    test('merge 策略：一方 tagIds 為空時應取另一方', () => {
      const existing = [{
        id: 'book-tg-002',
        title: '測試書籍',
        tagIds: [],
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]
      const imported = [{
        id: 'book-tg-002',
        title: '測試書籍',
        tagIds: ['tag-x', 'tag-y'],
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')
      const book = result.find(b => b.id === 'book-tg-002')

      expect(book.tagIds).toEqual(['tag-x', 'tag-y'])
    })

    test('merge 策略：tagIds 缺失時應取有值的一方', () => {
      const existing = [{
        id: 'book-tg-003',
        title: '測試書籍',
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]
      const imported = [{
        id: 'book-tg-003',
        title: '測試書籍',
        tagIds: ['tag-z'],
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')
      const book = result.find(b => b.id === 'book-tg-003')

      expect(book.tagIds).toEqual(['tag-z'])
    })
  })

  // =================================================================
  // 4. 其他欄位合併：取非空值
  // =================================================================

  describe('其他欄位合併：取非空值', () => {
    test('merge 策略：基底版本欄位為空時應取另一方的非空值', () => {
      const existing = [{
        id: 'book-nv-001',
        title: '測試書籍',
        cover: null,
        author: '作者A',
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]
      const imported = [{
        id: 'book-nv-001',
        title: '測試書籍',
        cover: 'http://example.com/cover.jpg',
        author: null,
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')
      const book = result.find(b => b.id === 'book-nv-001')

      // 既有較新為基底，cover 為 null 應取匯入的非空值
      expect(book.cover).toBe('http://example.com/cover.jpg')
      // author 在基底（既有）有值，保留
      expect(book.author).toBe('作者A')
    })

    test('merge 策略：undefined 欄位也應被非空值填補', () => {
      const existing = [{
        id: 'book-nv-002',
        title: '測試書籍',
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]
      const imported = [{
        id: 'book-nv-002',
        title: '測試書籍',
        publisher: '出版社A',
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')
      const book = result.find(b => b.id === 'book-nv-002')

      // 既有缺少 publisher 欄位，應從匯入補充
      expect(book.publisher).toBe('出版社A')
    })
  })

  // =================================================================
  // 5. 跨平台去重：title + authors 組合識別
  // =================================================================

  describe('跨平台去重：title + authors 組合識別', () => {
    test('merge 策略：不同 ID 但 title+author 相同應視為重複', () => {
      const existing = [{
        id: 'readmoo-001',
        title: '相同書名',
        author: '相同作者',
        progress: 30,
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]
      const imported = [{
        id: 'kindle-001',
        title: '相同書名',
        author: '相同作者',
        progress: 80,
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      // 應只有 1 本書（跨平台去重），不是 2 本
      expect(result).toHaveLength(1)
      // merge 策略下 progress 取較大值
      expect(result[0].progress).toBe(80)
    })

    test('merge 策略：title 相同但 author 不同不應視為重複', () => {
      const existing = [{
        id: 'readmoo-002',
        title: '相同書名',
        author: '作者A',
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]
      const imported = [{
        id: 'kindle-002',
        title: '相同書名',
        author: '作者B',
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      // title 同 author 不同，應為 2 本不同的書
      expect(result).toHaveLength(2)
    })

    test('skip 策略：跨平台同書應保留既有版本', () => {
      const existing = [{
        id: 'readmoo-003',
        title: '跨平台書籍',
        author: '作者C',
        progress: 50,
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]
      const imported = [{
        id: 'kindle-003',
        title: '跨平台書籍',
        author: '作者C',
        progress: 90,
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'skip')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('readmoo-003')
      expect(result[0].progress).toBe(50)
    })

    test('override 策略：跨平台同書應用匯入版本替換', () => {
      const existing = [{
        id: 'readmoo-004',
        title: '跨平台書籍',
        author: '作者D',
        progress: 50,
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]
      const imported = [{
        id: 'kindle-004',
        title: '跨平台書籍',
        author: '作者D',
        progress: 90,
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'override')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('kindle-004')
      expect(result[0].progress).toBe(90)
    })
  })

  // =================================================================
  // 6. 綜合 merge 場景
  // =================================================================

  describe('綜合 merge 場景', () => {
    test('merge 應同時套用所有 v2 欄位合併策略', () => {
      const existing = [{
        id: 'book-combo-001',
        title: '綜合測試',
        readingStatus: 'reading',
        isManualStatus: false,
        progress: 60,
        tagIds: ['tag-1', 'tag-2'],
        cover: null,
        author: '作者X',
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]
      const imported = [{
        id: 'book-combo-001',
        title: '綜合測試',
        readingStatus: 'finished',
        isManualStatus: true,
        progress: 40,
        tagIds: ['tag-2', 'tag-3'],
        cover: 'http://example.com/combo.jpg',
        author: null,
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')
      const book = result.find(b => b.id === 'book-combo-001')

      // readingStatus: 匯入 isManualStatus=true，取匯入
      expect(book.readingStatus).toBe('finished')
      expect(book.isManualStatus).toBe(true)

      // progress: 取較大值 60
      expect(book.progress).toBe(60)

      // tagIds: 聯集 [tag-1, tag-2, tag-3]
      expect(book.tagIds).toHaveLength(3)
      expect(book.tagIds).toContain('tag-1')
      expect(book.tagIds).toContain('tag-2')
      expect(book.tagIds).toContain('tag-3')

      // cover: 基底(既有)為 null，取匯入的非空值
      expect(book.cover).toBe('http://example.com/combo.jpg')

      // author: 基底(既有)有值，保留
      expect(book.author).toBe('作者X')
    })

    test('skip/override 策略不應套用 v2 欄位合併', () => {
      const existing = [{
        id: 'book-combo-002',
        title: '策略測試',
        readingStatus: 'reading',
        isManualStatus: true,
        progress: 30,
        tagIds: ['tag-a'],
        updatedAt: '2026-03-01T00:00:00.000Z'
      }]
      const imported = [{
        id: 'book-combo-002',
        title: '策略測試',
        readingStatus: 'finished',
        isManualStatus: false,
        progress: 90,
        tagIds: ['tag-b'],
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]

      // skip：保留既有原樣
      const skipResult = controller._handleDuplicateBooks(existing, imported, 'skip')
      const skipBook = skipResult.find(b => b.id === 'book-combo-002')
      expect(skipBook.progress).toBe(30)
      expect(skipBook.tagIds).toEqual(['tag-a'])

      // override：用匯入版本原樣替換
      const overrideResult = controller._handleDuplicateBooks(existing, imported, 'override')
      const overrideBook = overrideResult.find(b => b.id === 'book-combo-002')
      expect(overrideBook.progress).toBe(90)
      expect(overrideBook.tagIds).toEqual(['tag-b'])
    })
  })
})
