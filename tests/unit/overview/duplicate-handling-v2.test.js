/**
 * UC-01/UC-02 Book Schema v2 重複書籍處理 - 單元測試
 *
 * TDD Red Phase：基於 Book Schema v2 重寫 duplicate handling 測試
 * Schema v2 變更：
 * - isNew/isFinished 布林 -> readingStatus 列舉
 * - 新增 tagIds 陣列（tag 引用）
 * - 新增 isManualStatus（boolean）
 * - 新增 updatedAt（ISO string）
 *
 * 合併策略（v2）：
 * - 相同 id：保留最新版本（比較 updatedAt/extractedAt）
 * - readingStatus：isManualStatus=true 優先保留（manual > auto）
 * - progress：取較大值
 * - tagIds：聯集（union）
 * - 其他欄位：取非空值
 *
 * @jest-environment jsdom
 */

const { JSDOM } = require('jsdom')

// --- Book Schema v2 測試資料工廠 ---

/**
 * 建立符合 Book Schema v2 的測試書籍
 * 需求：Schema v2 欄位完整性
 */
function createBookV2 (overrides = {}) {
  return {
    id: 'book-default',
    title: '預設書籍',
    cover: 'http://example.com/default.jpg',
    author: '預設作者',
    progress: 0,
    readingStatus: 'unread',
    isManualStatus: false,
    tagIds: [],
    updatedAt: '2026-03-01T00:00:00.000Z',
    extractedAt: '2026-03-01T00:00:00.000Z',
    ...overrides
  }
}

describe('UC-01/UC-02 Book Schema v2 重複書籍處理', () => {
  let controller
  let OverviewPageController

  // --- 環境設定（與 v1 測試一致的 DOM 和 Mock 結構）---

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

    global.mockEventBus = {
      listeners: new Map(),
      emit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      off: jest.fn()
    }

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
  // 1. merge 策略：readingStatus 合併（manual > auto）
  // =================================================================

  describe('merge 策略：readingStatus 合併（isManualStatus 優先）', () => {
    test('isManualStatus=true 的 readingStatus 應優先保留，即使 updatedAt 較舊', () => {
      // Given: 既有書籍手動設定為 reading，匯入書籍自動偵測為 finished（較新）
      const existing = [createBookV2({
        id: 'book-001',
        readingStatus: 'reading',
        isManualStatus: true,
        updatedAt: '2026-03-01T00:00:00.000Z'
      })]
      const imported = [createBookV2({
        id: 'book-001',
        readingStatus: 'finished',
        isManualStatus: false,
        updatedAt: '2026-03-20T00:00:00.000Z'
      })]

      // When: 以 merge 策略處理
      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      // Then: readingStatus 應保留手動設定的 reading
      const book = result.find(b => b.id === 'book-001')
      expect(book.readingStatus).toBe('reading')
      expect(book.isManualStatus).toBe(true)
    })

    test('雙方都是 isManualStatus=true 時，應取 updatedAt 較新的 readingStatus', () => {
      const existing = [createBookV2({
        id: 'book-001',
        readingStatus: 'reading',
        isManualStatus: true,
        updatedAt: '2026-03-01T00:00:00.000Z'
      })]
      const imported = [createBookV2({
        id: 'book-001',
        readingStatus: 'finished',
        isManualStatus: true,
        updatedAt: '2026-03-20T00:00:00.000Z'
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      expect(book.readingStatus).toBe('finished')
      expect(book.updatedAt).toBe('2026-03-20T00:00:00.000Z')
    })

    test('雙方都是 isManualStatus=false 時，應取 updatedAt 較新的 readingStatus', () => {
      const existing = [createBookV2({
        id: 'book-001',
        readingStatus: 'unread',
        isManualStatus: false,
        updatedAt: '2026-03-01T00:00:00.000Z'
      })]
      const imported = [createBookV2({
        id: 'book-001',
        readingStatus: 'reading',
        isManualStatus: false,
        updatedAt: '2026-03-20T00:00:00.000Z'
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      expect(book.readingStatus).toBe('reading')
    })

    test('readingStatus 列舉值應為有效值', () => {
      // Given: 合併後的 readingStatus 應為有效列舉值之一
      const validStatuses = ['unread', 'reading', 'finished', 'queued', 'abandoned', 'reference']

      const existing = [createBookV2({
        id: 'book-001',
        readingStatus: 'queued',
        isManualStatus: true
      })]
      const imported = [createBookV2({
        id: 'book-001',
        readingStatus: 'abandoned',
        isManualStatus: false
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      expect(validStatuses).toContain(book.readingStatus)
    })
  })

  // =================================================================
  // 2. merge 策略：tagIds 聯集合併
  // =================================================================

  describe('merge 策略：tagIds 聯集合併', () => {
    test('兩組不同 tagIds 應合併為聯集', () => {
      const existing = [createBookV2({
        id: 'book-001',
        tagIds: ['tag-sci-fi', 'tag-favorite']
      })]
      const imported = [createBookV2({
        id: 'book-001',
        tagIds: ['tag-2026', 'tag-must-read']
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      expect(book.tagIds).toHaveLength(4)
      expect(book.tagIds).toContain('tag-sci-fi')
      expect(book.tagIds).toContain('tag-favorite')
      expect(book.tagIds).toContain('tag-2026')
      expect(book.tagIds).toContain('tag-must-read')
    })

    test('重複的 tagIds 應去重', () => {
      const existing = [createBookV2({
        id: 'book-001',
        tagIds: ['tag-sci-fi', 'tag-favorite']
      })]
      const imported = [createBookV2({
        id: 'book-001',
        tagIds: ['tag-sci-fi', 'tag-2026']
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      const sciFiCount = book.tagIds.filter(t => t === 'tag-sci-fi').length
      expect(sciFiCount).toBe(1)
      expect(book.tagIds).toHaveLength(3)
    })

    test('一方 tagIds 為空時應保留另一方的 tagIds', () => {
      const existing = [createBookV2({
        id: 'book-001',
        tagIds: ['tag-sci-fi']
      })]
      const imported = [createBookV2({
        id: 'book-001',
        tagIds: []
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      expect(book.tagIds).toEqual(['tag-sci-fi'])
    })

    test('雙方 tagIds 都為空時結果應為空陣列', () => {
      const existing = [createBookV2({
        id: 'book-001',
        tagIds: []
      })]
      const imported = [createBookV2({
        id: 'book-001',
        tagIds: []
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      expect(book.tagIds).toEqual([])
    })

    test('一方缺少 tagIds 欄位時應視為空陣列處理', () => {
      const existing = [createBookV2({
        id: 'book-001',
        tagIds: ['tag-a']
      })]
      const imported = [{
        id: 'book-001',
        title: '匯入書籍',
        updatedAt: '2026-03-20T00:00:00.000Z'
        // 缺少 tagIds 欄位
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      expect(book.tagIds).toContain('tag-a')
    })
  })

  // =================================================================
  // 3. merge 策略：progress 取較大值
  // =================================================================

  describe('merge 策略：progress 取較大值', () => {
    test('應取兩方 progress 的較大值', () => {
      const existing = [createBookV2({
        id: 'book-001',
        progress: 30,
        updatedAt: '2026-03-01T00:00:00.000Z'
      })]
      const imported = [createBookV2({
        id: 'book-001',
        progress: 75,
        updatedAt: '2026-02-01T00:00:00.000Z'
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      expect(book.progress).toBe(75)
    })

    test('既有 progress 較大時應保留既有值', () => {
      const existing = [createBookV2({
        id: 'book-001',
        progress: 80
      })]
      const imported = [createBookV2({
        id: 'book-001',
        progress: 20
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      expect(book.progress).toBe(80)
    })

    test('progress 相同時應保留該值', () => {
      const existing = [createBookV2({
        id: 'book-001',
        progress: 50
      })]
      const imported = [createBookV2({
        id: 'book-001',
        progress: 50
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      expect(book.progress).toBe(50)
    })
  })

  // =================================================================
  // 4. merge 策略：其他欄位取非空值
  // =================================================================

  describe('merge 策略：其他欄位取非空值', () => {
    test('既有 cover 為空時應取匯入的 cover', () => {
      const existing = [createBookV2({
        id: 'book-001',
        cover: '',
        updatedAt: '2026-03-20T00:00:00.000Z'
      })]
      const imported = [createBookV2({
        id: 'book-001',
        cover: 'http://example.com/cover.jpg',
        updatedAt: '2026-03-01T00:00:00.000Z'
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      expect(book.cover).toBe('http://example.com/cover.jpg')
    })

    test('匯入 author 為空時應保留既有 author', () => {
      const existing = [createBookV2({
        id: 'book-001',
        author: '作者A'
      })]
      const imported = [createBookV2({
        id: 'book-001',
        author: ''
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      expect(book.author).toBe('作者A')
    })
  })

  // =================================================================
  // 5. merge 策略：updatedAt/extractedAt 時間戳比較
  // =================================================================

  describe('merge 策略：時間戳比較決定基底版本', () => {
    test('匯入版本 updatedAt 較新時應以匯入為基底', () => {
      const existing = [createBookV2({
        id: 'book-001',
        title: '既有版本',
        updatedAt: '2026-03-01T00:00:00.000Z'
      })]
      const imported = [createBookV2({
        id: 'book-001',
        title: '匯入版本',
        updatedAt: '2026-03-20T00:00:00.000Z'
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      expect(book.title).toBe('匯入版本')
    })

    test('既有版本 updatedAt 較新時應以既有為基底', () => {
      const existing = [createBookV2({
        id: 'book-001',
        title: '既有版本',
        updatedAt: '2026-03-20T00:00:00.000Z'
      })]
      const imported = [createBookV2({
        id: 'book-001',
        title: '匯入版本',
        updatedAt: '2026-03-01T00:00:00.000Z'
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      expect(book.title).toBe('既有版本')
    })

    test('缺少 updatedAt 時應 fallback 到 extractedAt', () => {
      const existing = [{
        id: 'book-001',
        title: '既有版本',
        extractedAt: '2026-03-20T00:00:00.000Z'
        // 無 updatedAt
      }]
      const imported = [{
        id: 'book-001',
        title: '匯入版本',
        extractedAt: '2026-03-01T00:00:00.000Z'
      }]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      expect(book.title).toBe('既有版本')
    })

    test('updatedAt 相同時應保留既有版本（保守策略）', () => {
      const existing = [createBookV2({
        id: 'book-001',
        title: '既有版本',
        updatedAt: '2026-03-15T00:00:00.000Z'
      })]
      const imported = [createBookV2({
        id: 'book-001',
        title: '匯入版本',
        updatedAt: '2026-03-15T00:00:00.000Z'
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      expect(book.title).toBe('既有版本')
    })
  })

  // =================================================================
  // 6. skip 策略：v2 欄位保留驗證
  // =================================================================

  describe('skip 策略：Schema v2 欄位保留', () => {
    test('skip 應保留既有書籍的所有 v2 欄位', () => {
      const existing = [createBookV2({
        id: 'book-001',
        readingStatus: 'reading',
        isManualStatus: true,
        tagIds: ['tag-a', 'tag-b']
      })]
      const imported = [createBookV2({
        id: 'book-001',
        readingStatus: 'finished',
        isManualStatus: false,
        tagIds: ['tag-c']
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'skip')

      const book = result.find(b => b.id === 'book-001')
      expect(book.readingStatus).toBe('reading')
      expect(book.isManualStatus).toBe(true)
      expect(book.tagIds).toEqual(['tag-a', 'tag-b'])
    })

    test('skip 應加入非重複的匯入書籍（含 v2 欄位）', () => {
      const existing = [createBookV2({ id: 'book-001' })]
      const imported = [createBookV2({
        id: 'book-002',
        readingStatus: 'queued',
        tagIds: ['tag-new']
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'skip')

      expect(result).toHaveLength(2)
      const book002 = result.find(b => b.id === 'book-002')
      expect(book002.readingStatus).toBe('queued')
      expect(book002.tagIds).toEqual(['tag-new'])
    })
  })

  // =================================================================
  // 7. override 策略：v2 欄位覆蓋驗證
  // =================================================================

  describe('override 策略：Schema v2 欄位覆蓋', () => {
    test('override 應用匯入版本的所有 v2 欄位替換', () => {
      const existing = [createBookV2({
        id: 'book-001',
        readingStatus: 'reading',
        isManualStatus: true,
        tagIds: ['tag-a']
      })]
      const imported = [createBookV2({
        id: 'book-001',
        readingStatus: 'finished',
        isManualStatus: false,
        tagIds: ['tag-b', 'tag-c']
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'override')

      const book = result.find(b => b.id === 'book-001')
      expect(book.readingStatus).toBe('finished')
      expect(book.isManualStatus).toBe(false)
      expect(book.tagIds).toEqual(['tag-b', 'tag-c'])
    })
  })

  // =================================================================
  // 8. 跨平台去重：title + authors 組合識別
  // =================================================================

  describe('跨平台去重：title + author 組合識別', () => {
    test('不同 id 但相同 title + author 應被識別為重複', () => {
      const existing = [createBookV2({
        id: 'readmoo-001',
        title: '程式設計入門',
        author: '王大明',
        progress: 50,
        tagIds: ['tag-tech']
      })]
      const imported = [createBookV2({
        id: 'kindle-001',
        title: '程式設計入門',
        author: '王大明',
        progress: 30,
        tagIds: ['tag-kindle']
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      // Then: 應識別為同一本書，合併而非新增
      // 結果應只有 1 本書（而非 2 本）
      const matchingBooks = result.filter(b =>
        b.title === '程式設計入門' && b.author === '王大明'
      )
      expect(matchingBooks).toHaveLength(1)
    })

    test('相同 title 但不同 author 應視為不同書籍', () => {
      const existing = [createBookV2({
        id: 'book-001',
        title: 'JavaScript 入門',
        author: '作者A'
      })]
      const imported = [createBookV2({
        id: 'book-002',
        title: 'JavaScript 入門',
        author: '作者B'
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      expect(result).toHaveLength(2)
    })

    test('跨平台合併時 tagIds 應聯集', () => {
      const existing = [createBookV2({
        id: 'readmoo-001',
        title: '同一本書',
        author: '同一作者',
        tagIds: ['tag-readmoo']
      })]
      const imported = [createBookV2({
        id: 'kindle-001',
        title: '同一本書',
        author: '同一作者',
        tagIds: ['tag-kindle']
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.title === '同一本書')
      expect(book.tagIds).toContain('tag-readmoo')
      expect(book.tagIds).toContain('tag-kindle')
    })
  })

  // =================================================================
  // 9. 邊界案例：Schema v2 特有
  // =================================================================

  describe('邊界案例：Schema v2 特有', () => {
    test('既有書籍為空清單時應回傳所有匯入書籍（含 v2 欄位）', () => {
      const imported = [
        createBookV2({ id: 'book-001', readingStatus: 'reading', tagIds: ['tag-a'] }),
        createBookV2({ id: 'book-002', readingStatus: 'finished', tagIds: ['tag-b'] })
      ]

      const result = controller._handleDuplicateBooks([], imported, 'merge')

      expect(result).toHaveLength(2)
      expect(result[0].readingStatus).toBeDefined()
      expect(result[0].tagIds).toBeDefined()
    })

    test('匯入書籍為空清單時應回傳所有既有書籍', () => {
      const existing = [
        createBookV2({ id: 'book-001', tagIds: ['tag-a'] })
      ]

      const result = controller._handleDuplicateBooks(existing, [], 'merge')

      expect(result).toHaveLength(1)
      expect(result[0].tagIds).toEqual(['tag-a'])
    })

    test('雙方都為空清單時應回傳空陣列', () => {
      const result = controller._handleDuplicateBooks([], [], 'merge')
      expect(result).toEqual([])
    })

    test('匯入資料內部有重複 ID 時應只取最後一筆', () => {
      const duplicateImported = [
        createBookV2({ id: 'book-dup', title: '第一版', tagIds: ['tag-1'] }),
        createBookV2({ id: 'book-dup', title: '第二版', tagIds: ['tag-2'] })
      ]

      const result = controller._handleDuplicateBooks([], duplicateImported, 'skip')

      const dups = result.filter(b => b.id === 'book-dup')
      expect(dups).toHaveLength(1)
      expect(dups[0].title).toBe('第二版')
    })

    test('v1 格式書籍（含 isNew/isFinished）匯入時不應導致錯誤', () => {
      // Given: 匯入的書籍使用舊 Schema v1 格式
      const existing = [createBookV2({ id: 'book-001' })]
      const v1Imported = [{
        id: 'book-002',
        title: 'v1 格式書籍',
        isNew: true,
        isFinished: false,
        progress: 0
      }]

      // When/Then: 不應拋出異常
      expect(() => {
        controller._handleDuplicateBooks(existing, v1Imported, 'merge')
      }).not.toThrow()

      const result = controller._handleDuplicateBooks(existing, v1Imported, 'merge')
      expect(result).toHaveLength(2)
    })

    test('merge 時的複合場景：同時合併 readingStatus + tagIds + progress', () => {
      // Given: 複合合併場景
      const existing = [createBookV2({
        id: 'book-001',
        readingStatus: 'reading',
        isManualStatus: true,
        progress: 30,
        tagIds: ['tag-a', 'tag-b'],
        cover: '',
        updatedAt: '2026-03-01T00:00:00.000Z'
      })]
      const imported = [createBookV2({
        id: 'book-001',
        readingStatus: 'finished',
        isManualStatus: false,
        progress: 75,
        tagIds: ['tag-b', 'tag-c'],
        cover: 'http://example.com/new-cover.jpg',
        updatedAt: '2026-03-20T00:00:00.000Z'
      })]

      const result = controller._handleDuplicateBooks(existing, imported, 'merge')

      const book = result.find(b => b.id === 'book-001')
      // readingStatus: manual > auto，保留既有的 reading
      expect(book.readingStatus).toBe('reading')
      expect(book.isManualStatus).toBe(true)
      // progress: 取較大值 75
      expect(book.progress).toBe(75)
      // tagIds: 聯集 ['tag-a', 'tag-b', 'tag-c']
      expect(book.tagIds).toHaveLength(3)
      expect(book.tagIds).toContain('tag-a')
      expect(book.tagIds).toContain('tag-b')
      expect(book.tagIds).toContain('tag-c')
      // cover: 取非空值
      expect(book.cover).toBe('http://example.com/new-cover.jpg')
    })

    test('所有三種策略對空清單應有一致行為', () => {
      const existing = [createBookV2({ id: 'book-001' })]
      const strategies = ['skip', 'override', 'merge']

      for (const strategy of strategies) {
        const result = controller._handleDuplicateBooks(existing, [], strategy)
        expect(result).toHaveLength(1)
      }
    })
  })
})
