/**
 * overview 展開書籍時顯示的標籤
 *
 * 書目只存 tagIds，標籤名稱與分類存在 storage 的 tags / tag_categories。
 * 載入書目時要把它們讀進 controller 的 tagMap / categoryMap，標籤欄才解析得出名稱；
 * 沒讀進來時每本書都只顯示「未分類」。
 */
const { JSDOM } = require('jsdom')

describe('overview 標籤顯示', () => {
  let dom
  let document
  let controller

  const BASE_STORAGE = {
    readmoo_books: {
      books: [{ id: 'b1', title: '有標籤的書', authors: ['作者'], progress: 30, readingStatus: 'reading', tagIds: ['t1', 't2'], source: 'readmoo' }]
    },
    tags: [
      { id: 't1', name: '心理', categoryId: 'c1' },
      { id: 't2', name: '工作方法', categoryId: 'c2' }
    ],
    tag_categories: [
      { id: 'c1', name: '類型' },
      { id: 'c2', name: '用途' }
    ]
  }

  let STORAGE

  function pick (keys) {
    if (keys == null) return { ...STORAGE }
    const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys)
    return Object.fromEntries(list.filter(k => k in STORAGE).map(k => [k, STORAGE[k]]))
  }

  beforeEach(() => {
    STORAGE = JSON.parse(JSON.stringify(BASE_STORAGE))
    dom = new JSDOM(`
      <!DOCTYPE html><html lang="zh-TW"><body>
        <div id="totalBooks">0</div><div id="displayedBooks">0</div>
        <input type="text" id="searchBox">
        <table id="booksTable"><thead><tr>
          <th class="select-col"><input type="checkbox" id="selectAllHeaderCheckbox"></th>
          <th>封面</th><th>書名</th><th>作者</th><th>書城來源</th><th>進度</th><th>狀態</th><th class="expand-col"></th>
        </tr></thead><tbody id="tableBody"></tbody></table>
        <div id="loadingIndicator" style="display:none;"><div class="loading-text">載入中...</div></div>
        <div id="errorContainer" style="display:none;"><div class="error-message" id="errorMessage"></div></div>
      </body></html>
    `, { runScripts: 'outside-only', pretendToBeVisual: true })
    document = dom.window.document
    global.document = document
    global.window = dom.window

    global.chrome = {
      storage: {
        local: {
          get: jest.fn((keys, cb) => {
            const result = pick(keys)
            if (typeof cb === 'function') { cb(result); return undefined }
            return Promise.resolve(result)
          }),
          set: jest.fn(() => Promise.resolve())
        },
        onChanged: { addListener: jest.fn(), removeListener: jest.fn() }
      },
      runtime: { lastError: null }
    }

    jest.resetModules()
    const { OverviewPageController } = require('src/overview/overview-page-controller')
    controller = new OverviewPageController(null, document)
  })

  afterEach(() => {
    if (dom) dom.window.close()
    jest.clearAllMocks()
  })

  test('載入書目後，標籤欄解析出標籤名稱', async () => {
    await controller.loadBooksFromChromeStorage()

    const cell = controller.tagCellRenderer.createTagCell(['t1', 't2'])
    expect(cell.textContent).toContain('心理')
    expect(cell.textContent).toContain('工作方法')
    expect(cell.textContent).not.toContain('未分類')
  })

  test('tags 變更（例如改了標籤名稱）時重讀標籤', async () => {
    await controller.loadBooksFromChromeStorage()
    const listener = chrome.storage.onChanged.addListener.mock.calls.at(-1)[0]

    STORAGE.tags = [{ id: 't1', name: '心理學', categoryId: 'c1' }, STORAGE.tags[1]]
    listener({ tags: { newValue: STORAGE.tags } }, 'local')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(controller.tagCellRenderer.createTagCell(['t1']).textContent).toContain('心理學')
  })

  test('展開書籍那一列時看得到它的標籤', async () => {
    await controller.loadBooksFromChromeStorage()

    const toggle = document.querySelector('.expand-toggle-btn')
    expect(toggle).not.toBeNull()
    toggle.click()

    const expandRow = document.querySelector('.tag-expand-row')
    expect(expandRow).not.toBeNull()
    expect(expandRow.textContent).toContain('心理')
  })
})
