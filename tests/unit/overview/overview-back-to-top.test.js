/**
 * overview 的「回到頂部」：捲過第一個畫面才出現；隱藏時不在 Tab 順序裡；按下後捲回頂端、焦點移到搜尋框
 */
const { JSDOM } = require('jsdom')

describe('overview 回到頂部', () => {
  let dom
  let win

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div class="ov-tools"><input id="searchBox">
        <button id="backToTopBtn" class="back-to-top" aria-hidden="true" tabindex="-1">回到頂部</button></div>
      <table id="booksTable"><tbody id="tableBody"></tbody></table>
    </body></html>`, { pretendToBeVisual: true })
    win = dom.window
    win.scrollTo = jest.fn()
    global.document = win.document
    global.window = win
    global.chrome = undefined
    jest.resetModules()
    const { OverviewPageController } = require('src/overview/overview-page-controller')
    // eslint-disable-next-line no-new
    new OverviewPageController(null, win.document)
  })

  afterEach(() => dom.window.close())

  const scrollTo = async (y) => {
    Object.defineProperty(win, 'scrollY', { value: y, configurable: true })
    win.dispatchEvent(new win.Event('scroll'))
    await new Promise(resolve => win.requestAnimationFrame(() => resolve()))
  }

  test('在頂端時隱藏且不在 Tab 順序；捲過第一個畫面後出現', async () => {
    const btn = win.document.getElementById('backToTopBtn')
    expect(btn.dataset.shown).toBe('false')
    expect(btn.tabIndex).toBe(-1)

    await scrollTo(win.innerHeight * 2)
    expect(btn.dataset.shown).toBe('true')
    expect(btn.tabIndex).toBe(0)
    expect(btn.getAttribute('aria-hidden')).toBe('false')
  })

  test('按下後捲回頂端，焦點移到搜尋框', async () => {
    await scrollTo(win.innerHeight * 2)
    win.document.getElementById('backToTopBtn').click()
    expect(win.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
    expect(win.document.activeElement.id).toBe('searchBox')
  })
})
