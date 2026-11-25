/**
 * 書櫃頁回報給 popup 的本數：讀得到書櫃總數就用總數，否則用已渲染的本數
 */
const { resolveLibraryBookCount } = require('src/content/utils/library-book-count')

describe('resolveLibraryBookCount', () => {
  test('Readmoo 進頁面只渲染 96 本時，回報頁首的書櫃總數（扣掉封存與借出）', () => {
    const adapter = { parseLibraryTotal: () => ({ total: 1068, raw: '擁有 1090 本書（封存 21、借出 1）' }) }
    expect(resolveLibraryBookCount(adapter, 96)).toBe(1068)
  })

  test('adapter 沒有總數解析（Kobo、博客來）時回報已渲染的本數', () => {
    expect(resolveLibraryBookCount({}, 40)).toBe(40)
    expect(resolveLibraryBookCount(null, 40)).toBe(40)
  })

  test('讀不到頁首、總數比已渲染的少、或解析拋錯時，回報已渲染的本數', () => {
    expect(resolveLibraryBookCount({ parseLibraryTotal: () => ({ total: null, raw: '' }) }, 96)).toBe(96)
    expect(resolveLibraryBookCount({ parseLibraryTotal: () => ({ total: 10, raw: '' }) }, 96)).toBe(96)
    expect(resolveLibraryBookCount({ parseLibraryTotal: () => { throw new Error('x') } }, 96)).toBe(96)
  })
})

describe('Readmoo 書櫃頁首解析', () => {
  test('「擁有 1090 本書（封存 21、借出 1）」沒有「本」字也扣掉封存與借出', () => {
    document.body.innerHTML = '<div class="item-list-state">擁有 1090 本書（封存 21、借出 1）</div>'
    const createReadmooAdapter = require('src/content/adapters/readmoo-adapter')
    const adapter = createReadmooAdapter()
    expect(adapter.parseLibraryTotal().total).toBe(1068)
  })
})
