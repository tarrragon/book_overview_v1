/**
 * Overview 表格欄位數一致性守衛測試（方案 B，源於 ANA 0.19.1-W1-002）
 *
 * 守衛三來源欄位數一致：
 * 1. overview.html thead 的 <th> 數
 * 2. CONSTANTS.TABLE.COLUMNS（透過 empty-state row 的 td.colSpan 間接讀取，
 *    因 CONSTANTS 為 module-private 未匯出）
 * 3. createBookRow 渲染列的 <td> 數
 *
 * 設計考量：
 * - 欄位數於 3 處硬編碼（thead / COLUMNS / 列渲染），任一新增或刪除欄位未同步
 *   即漂移。此守衛將漂移降級為 CI 紅燈（DRY/SSOT 漂移防護）。
 * - COLUMNS 透過 runtime 行為（empty-state colspan）讀取而非 import 私有常數，
 *   驗證強度更高：若常數與實際 colspan 脫鉤亦會被捕捉。
 *
 * @jest-environment jsdom
 */

const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

/**
 * 從 src/overview/overview.html 讀取 thead 的 <th> 數
 * @returns {number} thead 內 th 元素數量
 */
function countTheadColumns () {
  const htmlPath = path.resolve(__dirname, '../../../src/overview/overview.html')
  const html = fs.readFileSync(htmlPath, 'utf8')
  const dom = new JSDOM(html)
  const headerCells = dom.window.document.querySelectorAll('#booksTable thead th')
  return headerCells.length
}

describe('Overview 表格欄位數一致性守衛 (ANA 0.19.1-W1-002 方案 B)', () => {
  let dom
  let document
  let mockEventBus

  beforeEach(() => {
    // 建立含 booksTable 骨架的 DOM（供 controller 渲染列與 empty-state）
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head><meta charset="UTF-8"><title>test</title></head>
      <body>
        <div class="container">
          <table id="booksTable">
            <thead>
              <tr>
                <th class="select-col"><input type="checkbox" id="selectAllHeaderCheckbox" aria-label="全選"></th>
                <th>封面</th>
                <th>書名</th>
                <th>作者</th>
                <th>書城來源</th>
                <th>進度</th>
                <th>狀態</th>
                <th>標籤</th>
              </tr>
            </thead>
            <tbody id="tableBody"></tbody>
          </table>
        </div>
      </body>
      </html>
    `, { runScripts: 'outside-only', pretendToBeVisual: true })

    document = dom.window.document
    global.document = document
    global.window = dom.window

    mockEventBus = {
      emit: jest.fn().mockResolvedValue(true),
      on: jest.fn(),
      off: jest.fn(),
      once: jest.fn()
    }

    const EventHandler = require('src/core/event-handler')
    dom.window.EventHandler = EventHandler
  })

  test('thead th 數 === CONSTANTS.TABLE.COLUMNS === createBookRow td 數（皆為 8）', () => {
    const { OverviewPageController } = require('src/overview/overview-page-controller')
    const controller = new OverviewPageController(mockEventBus, document)

    // 來源 1：src/overview/overview.html thead th 數
    const theadColumns = countTheadColumns()

    // 來源 2：CONSTANTS.TABLE.COLUMNS（經 empty-state row 的 td.colSpan 間接讀取）
    controller.renderBooksTable([])
    const emptyRowCell = document.querySelector('#tableBody tr td')
    const constantsColumns = emptyRowCell.colSpan

    // 來源 3：createBookRow 渲染列的 td 數
    const sampleBook = {
      id: '1',
      title: '一致性守衛測試書',
      cover: 'https://example.com/cover.jpg',
      tags: ['readmoo'],
      progress: 50,
      status: '閱讀中',
      readingStatus: 'reading',
      tagIds: []
    }
    const row = controller.createBookRow(sampleBook)
    const renderedColumns = row.querySelectorAll('td').length

    // 三者必須完全一致（任一欄位漂移即紅燈）
    expect(theadColumns).toBe(8)
    expect(constantsColumns).toBe(theadColumns)
    expect(renderedColumns).toBe(theadColumns)
  })
})
