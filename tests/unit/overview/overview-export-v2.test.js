/**
 * Overview 匯出按鈕 v2 路徑測試（W1-042.1）
 *
 * 測試範圍：
 * - handleExportJSONv2 產出符合 Interchange Format v2 的 JSON
 *   （metadata/formatVersion、tagCategories、tags 頂層；書籍用 readingStatus/tagIds）
 * - handleExportCSVv2 產出符合 csv-export-spec v2 的 CSV
 *   （英文 headers，含 readingStatus / tagNames / tagCategories）
 * - selection-aware：有選取書本時僅匯出選取項
 * - tags / tagCategories 從 TagStorageAdapter 讀取並注入 v2 匯出
 *
 * 背景：W1-042 ANA 指出 overview 匯出按鈕原接 v1 簡易匯出器 book-exporter.js，
 * 產出不符 v2 規格。本 ticket 將按鈕改接 BookDataExporter v2 路徑。
 *
 * @jest-environment jsdom
 */

const { JSDOM } = require('jsdom')

// Mock TagStorageAdapter：TagStorageAdapter 內部使用 callback-style chrome.storage，
// 與測試環境的 Promise-based mock 不相容，故直接 mock adapter 的查詢方法。
jest.mock('src/storage/adapters/tag-storage-adapter', () => ({
  getAllTags: jest.fn(),
  getAllTagCategories: jest.fn()
}))

const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')

/**
 * 建立 v2 測試書籍（含 COMPLETE_V2 欄位）
 * @param {Object} overrides - 覆寫欄位
 * @returns {Object}
 */
function makeV2Book (overrides = {}) {
  return {
    id: 'book-001',
    title: '三體',
    authors: ['劉慈欣'],
    publisher: '貓頭鷹出版社',
    progress: 100,
    readingStatus: 'finished',
    type: '電子書',
    cover: 'https://readmoo.com/cover/book-001.jpg',
    tagIds: ['tag-1'],
    isManualStatus: false,
    extractedAt: '2026-03-01T08:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
    source: 'readmoo',
    ...overrides
  }
}

describe('Overview 匯出按鈕 v2 路徑（W1-042.1）', () => {
  let dom
  let document
  let window
  let controller
  let OverviewPageController

  const sampleTagCategories = [
    {
      id: 'cat-1',
      name: '自訂標籤',
      description: '',
      color: '#808080',
      isSystem: false,
      sortOrder: 0,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z'
    }
  ]
  const sampleTags = [
    {
      id: 'tag-1',
      name: '科幻',
      categoryId: 'cat-1',
      isSystem: false,
      sortOrder: 0,
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z'
    }
  ]

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html lang="zh-TW">
      <body>
        <div id="totalBooks">0</div>
        <div id="displayedBooks">0</div>
        <input type="text" id="searchBox">
        <button id="exportCSVBtn">匯出 CSV</button>
        <button id="exportJSONBtn">匯出 JSON</button>
        <button id="exportJSONv2Btn">匯出 JSON (v2 相容)</button>
        <table id="booksTable"><tbody id="tableBody"></tbody></table>
        <div id="loadingIndicator" style="display:none;">
          <div class="loading-text">載入中...</div>
        </div>
        <div id="errorContainer" style="display:none;">
          <div class="error-message" id="errorMessage"></div>
        </div>
      </body>
      </html>
    `, { runScripts: 'outside-only', pretendToBeVisual: true })

    document = dom.window.document
    window = dom.window
    global.document = document
    global.window = window

    // v2 匯出觸發下載需要 Blob / URL
    global.Blob = window.Blob || jest.fn()
    global.URL = {
      createObjectURL: jest.fn(() => 'blob:mock-url'),
      revokeObjectURL: jest.fn()
    }
    window.URL = global.URL

    // chrome.storage 存在即可觸發 _loadTagData 走 adapter 路徑
    global.chrome = {
      storage: {
        local: {
          get: jest.fn().mockImplementation(() => Promise.resolve({})),
          set: jest.fn().mockImplementation(() => Promise.resolve())
        }
      },
      runtime: { lastError: null }
    }

    TagStorageAdapter.getAllTags.mockResolvedValue(sampleTags)
    TagStorageAdapter.getAllTagCategories.mockResolvedValue(sampleTagCategories)

    OverviewPageController = require('src/overview/overview-page-controller').OverviewPageController
    controller = new OverviewPageController(null, document)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('handleExportJSONv2 — Interchange Format v2 JSON', () => {
    test('JSON 頂層含 metadata（formatVersion 2.0.0）/ tagCategories / tags / books', async () => {
      controller.filteredBooks = [makeV2Book()]

      let captured = null
      jest.spyOn(controller, '_triggerExportDownload').mockImplementation((content) => {
        captured = content
      })

      await controller.handleExportJSONv2()

      expect(captured).not.toBeNull()
      const parsed = JSON.parse(captured)
      expect(parsed.metadata).toBeDefined()
      expect(parsed.metadata.formatVersion).toBe('2.0.0')
      expect(parsed.metadata.source).toBe('readmoo-book-extractor')
      expect(Array.isArray(parsed.tagCategories)).toBe(true)
      expect(Array.isArray(parsed.tags)).toBe(true)
      expect(Array.isArray(parsed.books)).toBe(true)
    })

    test('tags / tagCategories 頂層由 TagStorageAdapter 注入', async () => {
      controller.filteredBooks = [makeV2Book()]
      jest.spyOn(controller, '_triggerExportDownload').mockImplementation(() => {})

      let captured = null
      jest.spyOn(controller, '_triggerExportDownload').mockImplementation((content) => {
        captured = content
      })

      await controller.handleExportJSONv2()

      const parsed = JSON.parse(captured)
      expect(parsed.tags).toHaveLength(1)
      expect(parsed.tags[0].id).toBe('tag-1')
      expect(parsed.tagCategories).toHaveLength(1)
      expect(parsed.tagCategories[0].id).toBe('cat-1')
      expect(parsed.metadata.totalTags).toBe(1)
      expect(parsed.metadata.totalTagCategories).toBe(1)
    })

    test('書籍欄位使用 readingStatus / tagIds（非 status / tags）', async () => {
      controller.filteredBooks = [makeV2Book()]
      let captured = null
      jest.spyOn(controller, '_triggerExportDownload').mockImplementation((content) => {
        captured = content
      })

      await controller.handleExportJSONv2()

      const book = JSON.parse(captured).books[0]
      expect(book.readingStatus).toBe('finished')
      expect(Array.isArray(book.tagIds)).toBe(true)
      expect(book.tagIds).toEqual(['tag-1'])
      // v1 欄位名不應出現
      expect(book.status).toBeUndefined()
    })

    test('無資料時不下載並提示使用者', async () => {
      controller.filteredBooks = []
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
      global.alert = window.alert
      const downloadSpy = jest.spyOn(controller, '_triggerExportDownload')

      await controller.handleExportJSONv2()

      expect(downloadSpy).not.toHaveBeenCalled()
      expect(alertSpy).toHaveBeenCalled()
    })
  })

  describe('handleExportCSVv2 — csv-export-spec v2 CSV', () => {
    test('CSV headers 為英文欄位名且含 readingStatus / tagNames / tagCategories', async () => {
      controller.filteredBooks = [makeV2Book()]
      let captured = null
      jest.spyOn(controller, '_triggerExportDownload').mockImplementation((content) => {
        captured = content
      })

      await controller.handleExportCSVv2()

      expect(captured).not.toBeNull()
      // W1-061.2: overview 匯出啟用 includeSourceLimitations，第一行為 # source-limited 註解列
      // 跳過註解列取得真正的 headers 行
      const lines = captured.split('\n').filter(l => !l.startsWith('#'))
      const header = lines[0]
      expect(header).toContain('readingStatus')
      expect(header).toContain('tagIds')
      expect(header).toContain('tagNames')
      expect(header).toContain('tagCategories')
      // 不應含 v1 中文 headers
      expect(header).not.toContain('書名')
      expect(header).not.toContain('狀態')
    })

    test('W1-061.2: CSV 前置 source-limited 註解列明示 authors 來源限制', async () => {
      controller.filteredBooks = [makeV2Book()]
      let captured = null
      jest.spyOn(controller, '_triggerExportDownload').mockImplementation((content) => {
        captured = content
      })

      await controller.handleExportCSVv2()

      expect(captured).not.toBeNull()
      const firstLine = captured.split('\n')[0]
      expect(firstLine).toMatch(/^#\s+source-limited:\s+authors/)
      expect(firstLine).toContain('Readmoo')
    })

    test('衍生欄位 tagNames 由 tagIds 解析出 tag 名稱', async () => {
      controller.filteredBooks = [makeV2Book()]
      let captured = null
      jest.spyOn(controller, '_triggerExportDownload').mockImplementation((content) => {
        captured = content
      })

      await controller.handleExportCSVv2()

      // 資料列應含 tag 名稱「科幻」與 category 名稱「自訂標籤」
      expect(captured).toContain('科幻')
      expect(captured).toContain('自訂標籤')
    })
  })

  describe('selection-aware 匯出', () => {
    test('有選取書本時僅匯出選取項', async () => {
      controller.filteredBooks = [
        makeV2Book({ id: 'book-001', title: '三體' }),
        makeV2Book({ id: 'book-002', title: '原子習慣' })
      ]
      controller.selectedBookIds = new Set(['book-002'])

      let captured = null
      jest.spyOn(controller, '_triggerExportDownload').mockImplementation((content) => {
        captured = content
      })

      await controller.handleExportJSONv2()

      const parsed = JSON.parse(captured)
      expect(parsed.books).toHaveLength(1)
      expect(parsed.books[0].id).toBe('book-002')
    })

    test('無選取時匯出全部 filteredBooks', async () => {
      controller.filteredBooks = [
        makeV2Book({ id: 'book-001' }),
        makeV2Book({ id: 'book-002' })
      ]
      controller.selectedBookIds = new Set()

      let captured = null
      jest.spyOn(controller, '_triggerExportDownload').mockImplementation((content) => {
        captured = content
      })

      await controller.handleExportJSONv2()

      expect(JSON.parse(captured).books).toHaveLength(2)
    })
  })

  describe('匯出按鈕點擊觸發 v2 路徑', () => {
    // 1.0.0-W4-001：主「匯出 JSON」鈕（exportJSONBtn）改走 v3 canonical；
    // v2 相容路徑改由新增的「匯出 JSON (v2 相容)」鈕（exportJSONv2Btn）觸發。
    test('點擊 exportJSONv2Btn 觸發 handleExportJSONv2', async () => {
      controller.filteredBooks = [makeV2Book()]
      const v2Spy = jest.spyOn(controller, 'handleExportJSONv2').mockResolvedValue()
      // 重新註冊監聽器以綁定 spy 後的方法
      controller.setupEventListeners()

      document.getElementById('exportJSONv2Btn').click()

      expect(v2Spy).toHaveBeenCalled()
    })

    test('點擊 exportCSVBtn 觸發 handleExportCSVv2', async () => {
      controller.filteredBooks = [makeV2Book()]
      const v2Spy = jest.spyOn(controller, 'handleExportCSVv2').mockResolvedValue()
      controller.setupEventListeners()

      document.getElementById('exportCSVBtn').click()

      expect(v2Spy).toHaveBeenCalled()
    })
  })
})
