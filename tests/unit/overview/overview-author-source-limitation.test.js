/**
 * Overview 作者欄位 source limitation 顯示測試（W1-061.2）
 *
 * 測試範圍：
 * - authors=[] 時顯示 placeholder「— 待補」+ tooltip 提示 source-limited
 * - authors 含值時正常顯示（多作者以「、」分隔）
 * - authorCell 標註 data-source-limited 屬性供樣式 / 後續編輯流程使用
 *
 * 背景：W1-061 ANA 確認 Readmoo library 頁 DOM 不提供作者欄位（96 樣本 selector 0 命中）。
 * 為避免用戶誤判 extractor 漏抓，UI 須明示 source limitation 並引導手動編輯。
 *
 * @jest-environment jsdom
 */

const { JSDOM } = require('jsdom')

function makeBookWithAuthors (authors) {
  return {
    id: 'book-w1-061-2',
    title: '測試書籍',
    cover: 'https://example.com/cover.jpg',
    authors,
    tags: ['readmoo'],
    progress: 50,
    readingStatus: 'reading',
    tagIds: []
  }
}

describe('Overview 作者欄位 source limitation 顯示（W1-061.2）', () => {
  let dom
  let document
  let window
  let controller

  beforeEach(() => {
    // overview table 需含 author 欄位（COLUMNS=8）
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html lang="zh-TW">
      <body>
        <div id="totalBooks">0</div>
        <div id="displayedBooks">0</div>
        <input type="text" id="searchBox">
        <table id="booksTable">
          <thead>
            <tr>
              <th class="select-col"><input type="checkbox" id="selectAllHeaderCheckbox"></th>
              <th>封面</th>
              <th>書名</th>
              <th>作者</th>
              <th>書城來源</th>
              <th>進度</th>
              <th>狀態</th>
            </tr>
          </thead>
          <tbody id="tableBody"></tbody>
        </table>
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

    global.chrome = {
      storage: {
        local: {
          get: jest.fn().mockImplementation(() => Promise.resolve({})),
          set: jest.fn().mockImplementation(() => Promise.resolve())
        }
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

  describe('authors=[] (source-limited)', () => {
    test('應顯示 placeholder「— 待補」', () => {
      controller.renderBooksTable([makeBookWithAuthors([])])

      const authorCell = document.querySelector('.book-author-cell')
      expect(authorCell).not.toBeNull()
      expect(authorCell.textContent).toBe('— 待補')
    })

    test('應設置 tooltip 屬性說明 source limitation', () => {
      controller.renderBooksTable([makeBookWithAuthors([])])

      const authorCell = document.querySelector('.book-author-cell')
      const tooltip = authorCell.getAttribute('title')
      expect(tooltip).toContain('Readmoo')
      expect(tooltip).toContain('來源')
      expect(tooltip).toContain('可手動編輯')
    })

    test('應標註 data-source-limited 屬性', () => {
      controller.renderBooksTable([makeBookWithAuthors([])])

      const authorCell = document.querySelector('.book-author-cell')
      expect(authorCell.getAttribute('data-source-limited')).toBe('authors')
    })

    test('authors=undefined 視為 source-limited', () => {
      const book = makeBookWithAuthors(undefined)
      delete book.authors
      controller.renderBooksTable([book])

      const authorCell = document.querySelector('.book-author-cell')
      expect(authorCell.textContent).toBe('— 待補')
      expect(authorCell.getAttribute('data-source-limited')).toBe('authors')
    })
  })

  describe('authors 含值', () => {
    test('單一作者直接顯示', () => {
      controller.renderBooksTable([makeBookWithAuthors(['劉慈欣'])])

      const authorCell = document.querySelector('.book-author-cell')
      expect(authorCell.textContent).toBe('劉慈欣')
      expect(authorCell.getAttribute('data-source-limited')).toBeNull()
      expect(authorCell.getAttribute('title')).toBeNull()
    })

    test('多作者以「、」分隔顯示', () => {
      controller.renderBooksTable([makeBookWithAuthors(['作者甲', '作者乙', '作者丙'])])

      const authorCell = document.querySelector('.book-author-cell')
      expect(authorCell.textContent).toBe('作者甲、作者乙、作者丙')
      expect(authorCell.getAttribute('data-source-limited')).toBeNull()
    })
  })

  describe('表格結構', () => {
    test('table COLUMNS 應為 8（含作者欄位）', () => {
      // CONSTANTS.TABLE.COLUMNS 影響 empty state 的 colspan
      controller.renderBooksTable([])

      const emptyCell = document.querySelector('#tableBody td')
      expect(emptyCell).not.toBeNull()
      expect(emptyCell.getAttribute('colspan')).toBe('8')
    })

    test('作者欄位位置在書名與書城來源之間', () => {
      controller.renderBooksTable([makeBookWithAuthors([])])

      const row = document.querySelector('#tableBody tr')
      const cells = row.querySelectorAll('td')
      // select / cover / title / author / source / progress / status / tag = 8 cells
      expect(cells.length).toBe(8)
      // index 3 為作者欄
      expect(cells[3].className).toContain('book-author-cell')
    })
  })
})
