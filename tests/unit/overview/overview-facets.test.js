/**
 * overview 左側篩選欄：分組依據、本數，以及點選後的篩選
 *
 * 重要程度是 APP 的七級 importanceLevel，本頁唯讀：值來自 book.importanceLevel
 * 或 APP 匯入時存進的 _passthrough.tags.importance（spec book-interchange-v1 §5.1）。
 */
const { JSDOM } = require('jsdom')
const facets = require('src/overview/overview-facets')

const BOOKS = [
  { id: 'r1', title: 'A', readingStatus: 'reading', source: 'readmoo', tags: ['readmoo'], tagIds: ['t1'], importanceLevel: 4 },
  { id: 'r2', title: 'B', readingStatus: 'finished', source: 'readmoo', tags: ['readmoo'], tagIds: [], _passthrough: { tags: { importance: [{ id: 'imp-7', name: 'imp-7' }] } } },
  { id: 'k1', title: 'C', readingStatus: 'reading', source: 'kobo', tags: ['kobo'], tagIds: ['t1', 't2'] },
  { id: 'b1', title: 'D', readingStatus: 'unread', tags: ['books_com_tw'] }
]
const TAG_MAP = new Map([['t1', { id: 't1', name: '心理' }], ['t2', { id: 't2', name: '歷史' }]])

describe('overview-facets 分組依據', () => {
  test('書城：source 優先，其次是書城 tag', () => {
    expect(facets.getPlatformId(BOOKS[0])).toBe('readmoo')
    expect(facets.getPlatformId(BOOKS[3])).toBe('books_com_tw')
    expect(facets.getPlatformLabel('books_com_tw')).toBe('博客來')
  })

  test('重要程度：讀 importanceLevel 與 _passthrough.tags.importance，沒有就是 null', () => {
    expect(facets.getImportanceId(BOOKS[0])).toBe('imp-4')
    expect(facets.getImportanceId(BOOKS[1])).toBe('imp-7')
    expect(facets.getImportanceId(BOOKS[2])).toBeNull()
    expect(facets.getImportanceId({ importanceLevel: 9 })).toBeNull()
  })

  test('buildFacetModel 算出各組本數，重要程度另列未設定', () => {
    const model = facets.buildFacetModel(BOOKS, TAG_MAP)
    expect(model.status).toEqual([
      { value: 'reading', label: '閱讀中', count: 2 },
      { value: 'unread', label: '未讀', count: 1 },
      { value: 'finished', label: '讀完', count: 1 }
    ])
    expect(model.platform.find(p => p.value === 'readmoo').count).toBe(2)
    expect(model.importance).toEqual([
      { value: 'imp-4', label: '推薦分享', count: 1 },
      { value: 'imp-7', label: '可清理', count: 1 },
      { value: facets.UNSET, label: '未設定', count: 2 }
    ])
    expect(model.tags[0]).toEqual({ value: 't1', label: '心理', count: 2 })
  })
})

describe('overview 篩選欄與主區空狀態', () => {
  let dom
  let controller

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id="totalBooks"></div><div id="displayedBooks"></div>
      <input id="searchBox">
      <nav id="facetPanel"></nav>
      <span id="selectionCount" hidden></span>
      <section id="emptyState" hidden><h2 id="emptyStateTitle"></h2><p id="emptyStateBody"></p><button id="emptyStateAction"></button></section>
      <button id="exportCSVBtn"></button><button id="exportJSONBtn"></button>
      <div id="fileUploader" style="display:none"><input type="file" id="jsonFileInput"></div>
      <ul id="bookGrid"></ul>
      <table id="booksTable"><thead><tr><th><input type="checkbox" id="selectAllHeaderCheckbox"></th></tr></thead><tbody id="tableBody"></tbody></table>
    </body></html>`)
    global.document = dom.window.document
    global.window = dom.window
    global.chrome = undefined
    jest.resetModules()
    const { OverviewPageController } = require('src/overview/overview-page-controller')
    controller = new OverviewPageController(null, dom.window.document)
    controller.tagMap = TAG_MAP
    controller._updateBooksData(BOOKS.map(b => ({ ...b })))
    controller.updateDisplay()
  })

  afterEach(() => dom.window.close())

  const click = (facet, value) => {
    dom.window.document.querySelector(`.facet-item[data-facet="${facet}"][data-value="${value}"]`).click()
  }

  test('篩選欄列出四組，點重要程度只剩那些書，再點一次取消', () => {
    const groups = [...dom.window.document.querySelectorAll('.facet-title')].map(h => h.textContent)
    expect(groups).toEqual(['閱讀狀態', '書城', '重要程度', '標籤'])

    click('importance', 'imp-4')
    expect(controller.filteredBooks.map(b => b.id)).toEqual(['r1'])
    expect(dom.window.document.querySelector('.facet-item[data-value="imp-4"]').getAttribute('aria-pressed')).toBe('true')

    click('importance', 'imp-4')
    expect(controller.filteredBooks).toHaveLength(4)
  })

  test('未設定重要程度、書城、標籤可以疊加篩選', () => {
    click('importance', facets.UNSET)
    expect(controller.filteredBooks.map(b => b.id).sort()).toEqual(['b1', 'k1'])
    click('platform', 'kobo')
    expect(controller.filteredBooks.map(b => b.id)).toEqual(['k1'])
    click('tags', 't2')
    expect(controller.filteredBooks.map(b => b.id)).toEqual(['k1'])
  })

  test('篩選後沒有書時，主區給「清除篩選」，按下後回到全部', () => {
    click('platform', 'kobo')
    click('status', 'unread')
    expect(controller.filteredBooks).toHaveLength(0)
    const empty = dom.window.document.getElementById('emptyState')
    expect(empty.hidden).toBe(false)
    expect(dom.window.document.getElementById('emptyStateTitle').textContent).toBe('沒有符合條件的書')

    dom.window.document.getElementById('emptyStateAction').click()
    expect(controller.filteredBooks).toHaveLength(4)
    expect(empty.hidden).toBe(true)
  })

  test('書庫是空的時，主區給匯入的下一步並打開匯入面板', () => {
    controller._updateBooksData([])
    controller.updateDisplay()
    expect(dom.window.document.getElementById('emptyStateTitle').textContent).toBe('書庫還沒有書')
    dom.window.document.getElementById('emptyStateAction').click()
    expect(dom.window.document.getElementById('fileUploader').style.display).toBe('block')
  })

  test('從 storage 載入時沒有任何書，也顯示書庫是空的', async () => {
    global.chrome = {
      storage: {
        local: { get: jest.fn((keys, cb) => { if (typeof cb === 'function') { cb({}); return undefined } return Promise.resolve({}) }) },
        onChanged: { addListener: jest.fn() }
      },
      runtime: { lastError: null }
    }
    await controller.loadBooksFromChromeStorage()
    expect(dom.window.document.getElementById('emptyState').hidden).toBe(false)
    expect(dom.window.document.getElementById('emptyStateTitle').textContent).toBe('書庫還沒有書')
  })

  test('網格勾選與表格共用選取，工具列寫出已選本數', () => {
    const box = dom.window.document.querySelector('#bookGrid .card-checkbox[data-book-id="k1"]')
    box.click()
    expect(controller.selectedBookIds.has('k1')).toBe(true)
    expect(dom.window.document.getElementById('selectionCount').textContent).toBe('已選 1 本')
    expect(dom.window.document.querySelector('#tableBody .row-checkbox[data-book-id="k1"]').checked).toBe(true)
  })

  test('點封面任一處切換選取', () => {
    const cover = dom.window.document.querySelector('#bookGrid .book-card[data-book-id="r2"] .book-card-cover')
    cover.click()
    expect(controller.selectedBookIds.has('r2')).toBe(true)
    cover.click()
    expect(controller.selectedBookIds.has('r2')).toBe(false)
  })

  test('書庫是空的時停用匯出，有書後恢復', () => {
    const exportBtn = dom.window.document.getElementById('exportJSONBtn')
    expect(exportBtn.disabled).toBe(false)
    controller._updateBooksData([])
    controller.updateDisplay()
    expect(exportBtn.disabled).toBe(true)
    controller._updateBooksData(BOOKS.map(b => ({ ...b })))
    controller.updateDisplay()
    expect(exportBtn.disabled).toBe(false)
  })
})
