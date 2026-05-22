/**
 * ReadmooAdapter parseLibraryTotal 單元測試
 *
 * 對應 TDD Phase 2 測試設計 TG-7（0.19.0-W1-030-phase2-test-design.md）。
 * 驗證從 Readmoo header 文字「擁有 N 本書，其中封存 X 本，借出 Y 本」
 * 解析出可見書目數（N - X - Y）。
 *
 * 測試對象為純文字 regex 解析，無 DOM layout 依賴；
 * DOM fixture 僅用於提供 header 元素文字。jsdom 環境的 innerHTML
 * 沿用既有測試檔（readmoo-adapter.test.js）慣例建構受控 DOM fixture。
 */

describe('ReadmooAdapter.parseLibraryTotal', () => {
  let createReadmooAdapter
  let adapter

  beforeEach(() => {
    jest.resetModules()
    createReadmooAdapter = require('src/content/adapters/readmoo-adapter')
    adapter = createReadmooAdapter()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    adapter = null
    jest.clearAllMocks()
  })

  /**
   * 設定 Readmoo library header 元素。
   * 實機取證：header 容器為 div.item-list-state.container-fluid。
   * 以 textContent 設定文字內容，避免 HTML 注入。
   * @param {string} text - header 文字內容
   */
  const setHeaderText = (text) => {
    document.body.innerHTML = ''
    const headerEl = document.createElement('div')
    headerEl.className = 'item-list-state container-fluid'
    headerEl.textContent = text
    document.body.appendChild(headerEl)
  }

  // TC-7.1 標準格式解析可見書目數
  test('標準格式「擁有 N 本書，其中封存 X 本，借出 Y 本」解析出 N-X-Y', () => {
    setHeaderText('擁有 944 本書，其中封存 10 本，借出 6 本')

    const result = adapter.parseLibraryTotal()

    expect(result.total).toBe(928)
    expect(result.raw).toContain('擁有 944 本書')
  })

  // TC-7.2 無封存無借出子句
  test('無封存無借出子句時 total 等於書庫總數', () => {
    setHeaderText('擁有 50 本書')

    const result = adapter.parseLibraryTotal()

    expect(result.total).toBe(50)
  })

  // TC-7.3 0 本書庫
  test('0 本書庫解析為 total=0', () => {
    setHeaderText('擁有 0 本書')

    const result = adapter.parseLibraryTotal()

    expect(result.total).toBe(0)
  })

  // TC-7.4 header 元素不存在 → null
  test('header 元素不存在時回傳 total=null', () => {
    document.body.innerHTML = ''
    const rowEl = document.createElement('div')
    rowEl.className = 'row'
    document.body.appendChild(rowEl)

    const result = adapter.parseLibraryTotal()

    expect(result.total).toBeNull()
  })

  // TC-7.5 文字格式變更無法解析 → null（場景 6）
  test('header 文字格式變更無法解析時回傳 total=null', () => {
    setHeaderText('Your library: 944 books')

    const result = adapter.parseLibraryTotal()

    expect(result.total).toBeNull()
  })

  // TC-7.6 封存/借出大於總數的異常文字
  // Phase 3a 待釐清 2 決議：N-X-Y 為負時回 null（不夾 0）。
  // W1-033 R6：原 Phase 3b 偏離為 Math.max(0,...) 夾 0，本次重構對齊規格回 null。
  // 夾 0 會讓 loadAllBooksLazy 誤判 already_complete，回 null 才正確退回穩定條件停止。
  test('封存/借出大於總數時 total 回 null，不回傳負數也不夾 0', () => {
    setHeaderText('擁有 5 本書，其中封存 10 本')

    const result = adapter.parseLibraryTotal()

    expect(result.total).toBeNull()
  })

  // 補充：實機取證的完整文字格式（含封存與借出）
  test('實機取證格式「擁有 944 本書，其中封存 15 本，借出 1 本」解析為 928', () => {
    setHeaderText('擁有 944 本書，其中封存 15 本，借出 1 本')

    const result = adapter.parseLibraryTotal()

    expect(result.total).toBe(928)
  })

  // 補充：只有借出子句無封存子句
  test('只有借出子句時 total 等於 N - Y', () => {
    setHeaderText('擁有 100 本書，借出 3 本')

    const result = adapter.parseLibraryTotal()

    expect(result.total).toBe(97)
  })
})
