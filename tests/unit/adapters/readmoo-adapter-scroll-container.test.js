/**
 * ReadmooAdapter findScrollContainer 單元測試
 *
 * 對應 TDD Phase 2 測試設計 TG-6（0.19.0-W1-030-phase2-test-design.md）。
 * 驗證 5 層 fallback 捲動容器辨識：
 * selector -> load-more-button -> scrollable-ancestor -> document -> none。
 *
 * findScrollContainer 為純結構判定，jsdom 可建構 DOM 樹驗證 fallback 順序。
 * 捲動有效性探測（TC-6.7/6.8）依賴 loadAllBooksLazy 主迴圈，
 * 以注入 mock 捲動函式驗證早期降級。
 * DOM 清理使用 textContent 重設（非 innerHTML），避免 HTML 注入。
 */

describe('ReadmooAdapter.findScrollContainer', () => {
  let createReadmooAdapter
  let adapter

  beforeEach(() => {
    jest.resetModules()
    createReadmooAdapter = require('src/content/adapters/readmoo-adapter')
    adapter = createReadmooAdapter()
  })

  afterEach(() => {
    document.body.textContent = ''
    adapter = null
    jest.clearAllMocks()
  })

  /**
   * 建立指定 class 的 div 並附加到 parent。
   * @param {string} className - class 字串
   * @param {HTMLElement} parent - 父元素
   * @returns {HTMLElement} 建立的元素
   */
  const appendDiv = (className, parent = document.body) => {
    const el = document.createElement('div')
    el.className = className
    parent.appendChild(el)
    return el
  }

  // TC-6.1 優先級 1 selector 命中
  test('優先級 1：library 捲動容器 selector 命中時回傳 strategy=selector', () => {
    // Readmoo library 捲動容器（實機取證 react-container 為頁面根容器）
    const container = appendDiv('react-container')
    appendDiv('library-item', container)

    const result = adapter.findScrollContainer()

    expect(result.strategy).toBe('selector')
    expect(result.container).toBe(container)
  })

  // TC-6.2 優先級 2 load-more-button 命中
  test('優先級 2：無 selector 容器但有「更多...」按鈕時回傳 strategy=load-more-button', () => {
    appendDiv('library-item')
    const btn = document.createElement('button')
    btn.className = 'btn-outline-primary'
    btn.textContent = '更多...'
    document.body.appendChild(btn)

    const result = adapter.findScrollContainer()

    expect(result.strategy).toBe('load-more-button')
    expect(result.container).toBe(btn)
  })

  // TC-6.3 優先級 3 scrollable-ancestor 命中
  test('優先級 3：.library-item 有可捲動祖先時回傳 strategy=scrollable-ancestor', () => {
    const scrollable = appendDiv('scroll-wrapper')
    // 模擬可捲動：scrollHeight > clientHeight
    Object.defineProperty(scrollable, 'scrollHeight', { value: 4000, configurable: true })
    Object.defineProperty(scrollable, 'clientHeight', { value: 800, configurable: true })
    const item = appendDiv('library-item', scrollable)
    expect(item.parentElement).toBe(scrollable)

    const result = adapter.findScrollContainer()

    expect(result.strategy).toBe('scrollable-ancestor')
    expect(result.container).toBe(scrollable)
  })

  // TC-6.4 優先級 4 document 退回
  test('優先級 4：無前 3 者但 document 可捲動時回傳 strategy=document', () => {
    appendDiv('library-item')
    // 模擬 documentElement 可捲動
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 4647, configurable: true })
    Object.defineProperty(document.documentElement, 'clientHeight', { value: 761, configurable: true })

    const result = adapter.findScrollContainer()

    expect(result.strategy).toBe('document')
  })

  // TC-6.5 優先級 5 全失敗 none
  test('優先級 5：無任何可用容器時回傳 strategy=none、container=null', () => {
    // 無 .library-item、無按鈕、document 不可捲動
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 600, configurable: true })
    Object.defineProperty(document.documentElement, 'clientHeight', { value: 600, configurable: true })

    const result = adapter.findScrollContainer()

    expect(result.strategy).toBe('none')
    expect(result.container).toBeNull()
  })

  // TC-6.6 fallback 優先順序（命中即停）
  test('優先順序：同時存在 selector 容器與「更多...」按鈕時回傳 strategy=selector', () => {
    const container = appendDiv('react-container')
    appendDiv('library-item', container)
    const btn = document.createElement('button')
    btn.className = 'btn-outline-primary'
    btn.textContent = '更多...'
    container.appendChild(btn)

    const result = adapter.findScrollContainer()

    // 優先級 1 命中即不嘗試優先級 2
    expect(result.strategy).toBe('selector')
  })

  // 補充：載入更多按鈕文字變體（實機取證：首次載入後文字變為「載入更多...」）
  test('優先級 2：按鈕文字為「載入更多...」變體時仍命中 load-more-button', () => {
    appendDiv('library-item')
    const btn = document.createElement('button')
    btn.className = 'btn-outline-primary'
    btn.textContent = '載入更多...'
    document.body.appendChild(btn)

    const result = adapter.findScrollContainer()

    expect(result.strategy).toBe('load-more-button')
  })

  describe('捲動有效性探測（TC-6.7/6.8，整合 loadAllBooksLazy）', () => {
    /**
     * 建立含 N 個 .library-item 的 DOM（含 header）。
     * @param {number} count - .library-item 數量
     */
    const buildLibraryDom = (count) => {
      document.body.textContent = ''
      const headerEl = document.createElement('div')
      headerEl.className = 'item-list-state container-fluid'
      headerEl.textContent = '擁有 928 本書'
      document.body.appendChild(headerEl)
      for (let i = 0; i < count; i++) {
        const item = document.createElement('div')
        item.className = 'library-item'
        const privacy = document.createElement('div')
        privacy.className = 'privacy'
        privacy.id = `privacy-${1000 + i}`
        item.appendChild(privacy)
        document.body.appendChild(item)
      }
    }

    // TC-6.7 捲動有效性探測——位置未變化早期降級
    test('捲動位置未變化且 loadedCount 未增加時，在遠少於 maxIterations 輪數內停止', async () => {
      buildLibraryDom(96)
      // findScrollContainer 回傳 selector 容器；該策略捲動完全無效
      const selectorContainer = document.querySelector('.library-item').parentElement
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({
        container: selectorContainer,
        strategy: 'selector'
      })
      // 注入捲動函式：恆不改變捲動位置（捲動無效）
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => {})
      // 量測恆回傳同一批 ID（loadedCount 不增加）
      jest.spyOn(adapter, '_measureBooks').mockReturnValue(['p1', 'p2', 'p3'])

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30,
        stableRounds: 3,
        renderWaitMs: 10,
        overallTimeoutMs: 5000
      })

      // 捲動無效應在遠少於 maxIterations 的輪數內被偵測並降級或停止
      expect(result.iterations).toBeLessThan(30)
    })

    // TC-6.8 所有策略捲動皆無效 → container_not_found
    test('所有 fallback 策略捲動皆無效時，stopReason=container_not_found', async () => {
      buildLibraryDom(96)
      // 注入：每個策略捲動皆無效（scrollTop 恆不變、loadedCount 恆不變）
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => {})
      jest.spyOn(adapter, '_measureBooks').mockReturnValue(['p1', 'p2', 'p3'])
      // findScrollContainer 全部 fallback 耗盡回傳 none
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({
        container: null,
        strategy: 'none'
      })

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30,
        stableRounds: 3,
        renderWaitMs: 10,
        overallTimeoutMs: 5000
      })

      expect(result.stopReason).toBe('container_not_found')
    })
  })
})
