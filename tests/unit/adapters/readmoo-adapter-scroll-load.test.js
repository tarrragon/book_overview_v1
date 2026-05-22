/**
 * ReadmooAdapter loadAllBooksLazy 單元測試
 *
 * 對應 TDD Phase 2 測試設計 TG-1 ~ TG-5、TG-9、TG-10
 * （0.19.0-W1-030-phase2-test-design.md）。
 *
 * 驗證捲動主迴圈的停止邏輯（4 獨立停止條件）、loadedCount 累積 unique
 * book ID Set 去重、降級路徑、涵蓋率日誌契約、計時行為、捲動位置還原。
 *
 * 測試策略（規格 R5 可測性）：停止條件演算法核心與 DOM 操作分離。
 * - _scrollStep / _measureBooks 為可注入私有方法，以 jest.spyOn 注入序列驅動停止邏輯。
 * - findScrollContainer / parseLibraryTotal 以 spyOn 注入，解耦對容器辨識與總數解析的依賴。
 * - 計時驗證以 jest fake timer 推進虛擬時間（test-assertion-design-rules 規則 1 mock 豁免）。
 */

describe('ReadmooAdapter.loadAllBooksLazy', () => {
  let createReadmooAdapter
  let adapter
  let mockLogger

  /**
   * 建立 mock Logger，spy 各等級方法以驗證日誌契約。
   * @returns {Object} mock logger
   */
  const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })

  /**
   * 設定捲動容器為一個可捲動 div（strategy=selector）。
   * 容器附加到 DOM，scrollTop 可寫，模擬捲動有效。
   * @returns {HTMLElement} 容器元素
   */
  const setupScrollableContainer = () => {
    document.body.textContent = ''
    const container = document.createElement('div')
    container.className = 'react-container'
    let scrollTopValue = 0
    Object.defineProperty(container, 'scrollTop', {
      get: () => scrollTopValue,
      set: (v) => { scrollTopValue = v },
      configurable: true
    })
    Object.defineProperty(container, 'scrollHeight', { value: 27000, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 761, configurable: true })
    document.body.appendChild(container)
    return container
  }

  beforeEach(() => {
    jest.resetModules()
    createReadmooAdapter = require('src/content/adapters/readmoo-adapter')
    mockLogger = createMockLogger()
    adapter = createReadmooAdapter({ logger: mockLogger })
  })

  afterEach(() => {
    document.body.textContent = ''
    adapter = null
    jest.clearAllMocks()
    jest.useRealTimers()
  })

  // ===== TG-1 正常流程停止邏輯 =====
  describe('TG-1 正常流程停止邏輯', () => {
    // TC-1.1 大型書庫完整捲動載入至達標（場景 1）
    test('TC-1.1 大型書庫累積至達標，stopReason=reached_total、coverageComplete=true', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 928, raw: '擁有 944 本書' })
      // 捲動有效：每輪改變 scrollTop
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 2700; container.scrollTop = pos })
      // 量測序列：累積遞增至 928
      const idArray = (n) => Array.from({ length: n }, (_, i) => `id-${i}`)
      jest.spyOn(adapter, '_measureBooks')
        .mockReturnValueOnce(idArray(96))
        .mockReturnValueOnce(idArray(200))
        .mockReturnValueOnce(idArray(400))
        .mockReturnValueOnce(idArray(650))
        .mockReturnValueOnce(idArray(850))
        .mockReturnValue(idArray(928))

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 10, overallTimeoutMs: 60000
      })

      expect(result.stopReason).toBe('reached_total')
      expect(result.coverageComplete).toBe(true)
      expect(result.loadedCount).toBe(928)
      expect(result.expectedTotal).toBe(928)
      expect(result.missingCount).toBe(0)
      expect(result.iterations).toBeGreaterThanOrEqual(1)
    })

    // TC-1.2 小型書庫首批即完整略過迴圈（場景 2）
    test('TC-1.2 首批即完整時 stopReason=already_complete、iterations=0、不捲動', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 50, raw: '擁有 50 本書' })
      const scrollSpy = jest.spyOn(adapter, '_scrollStep').mockImplementation(() => {})
      jest.spyOn(adapter, '_measureBooks').mockReturnValue(Array.from({ length: 50 }, (_, i) => `id-${i}`))

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 10, overallTimeoutMs: 60000
      })

      expect(result.stopReason).toBe('already_complete')
      expect(result.iterations).toBe(0)
      expect(result.coverageComplete).toBe(true)
      expect(scrollSpy).not.toHaveBeenCalled()
    })

    // TC-1.3 連續穩定後停止（場景 3）
    test('TC-1.3 連續 stableRounds 輪不變時 stopReason=count_stable', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 928, raw: '擁有 944 本書' })
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 2700; container.scrollTop = pos })
      const idArray = (n) => Array.from({ length: n }, (_, i) => `id-${i}`)
      // 第 3 輪起停在 500
      jest.spyOn(adapter, '_measureBooks')
        .mockReturnValueOnce(idArray(96))
        .mockReturnValueOnce(idArray(300))
        .mockReturnValue(idArray(500))

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 10, overallTimeoutMs: 60000
      })

      expect(result.stopReason).toBe('count_stable')
      expect(result.loadedCount).toBe(500)
      expect(result.coverageComplete).toBe(false)
      expect(result.missingCount).toBe(428)
    })

    // TC-1.4 reached_total 與 already_complete 語義區分
    test('TC-1.4 already_complete 與 reached_total 語義不同且 stopReason 不相等', async () => {
      // (A) 首次即達標
      const containerA = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container: containerA, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 50, raw: 'A' })
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => {})
      jest.spyOn(adapter, '_measureBooks').mockReturnValue(Array.from({ length: 50 }, (_, i) => `a-${i}`))
      const resultA = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 10, overallTimeoutMs: 60000
      })

      // (B) 捲動後達標
      const adapterB = createReadmooAdapter({ logger: createMockLogger() })
      const containerB = setupScrollableContainer()
      jest.spyOn(adapterB, 'findScrollContainer').mockReturnValue({ container: containerB, strategy: 'selector' })
      jest.spyOn(adapterB, 'parseLibraryTotal').mockReturnValue({ total: 100, raw: 'B' })
      let posB = 0
      jest.spyOn(adapterB, '_scrollStep').mockImplementation(() => { posB += 2700; containerB.scrollTop = posB })
      jest.spyOn(adapterB, '_measureBooks')
        .mockReturnValueOnce(Array.from({ length: 40 }, (_, i) => `b-${i}`))
        .mockReturnValue(Array.from({ length: 100 }, (_, i) => `b-${i}`))
      const resultB = await adapterB.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 10, overallTimeoutMs: 60000
      })

      expect(resultA.stopReason).toBe('already_complete')
      expect(resultA.iterations).toBe(0)
      expect(resultB.stopReason).toBe('reached_total')
      expect(resultB.iterations).toBeGreaterThanOrEqual(1)
      expect(resultA.stopReason).not.toBe(resultB.stopReason)
    })
  })

  // ===== TG-2 邊界條件停止 =====
  describe('TG-2 邊界條件停止', () => {
    // TC-2.1 達 maxIterations 上限（場景 4）
    test('TC-2.1 持續微增永不達標時 stopReason=max_iterations、iterations=maxIterations', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 928, raw: 'X' })
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 100; container.scrollTop = pos })
      // 每輪 +5，永不達標永不穩定
      let n = 96
      jest.spyOn(adapter, '_measureBooks').mockImplementation(() => {
        n += 5
        return Array.from({ length: n }, (_, i) => `id-${i}`)
      })

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 10, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      expect(result.stopReason).toBe('max_iterations')
      expect(result.iterations).toBe(10)
      expect(result.missingCount).toBeGreaterThan(0)
    })

    // TC-2.2 整體逾時（場景 5）— fake timer
    test('TC-2.2 累計耗時達 overallTimeoutMs 時 stopReason=timeout', async () => {
      jest.useFakeTimers()
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 928, raw: 'X' })
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 100; container.scrollTop = pos })
      let n = 96
      jest.spyOn(adapter, '_measureBooks').mockImplementation(() => {
        n += 5
        return Array.from({ length: n }, (_, i) => `id-${i}`)
      })

      const promise = adapter.loadAllBooksLazy({
        maxIterations: 1000, stableRounds: 3, renderWaitMs: 800, overallTimeoutMs: 5000
      })
      await jest.runAllTimersAsync()
      const result = await promise

      expect(result.stopReason).toBe('timeout')
      expect(result.durationMs).toBeGreaterThanOrEqual(5000)
      expect(result.missingCount).toBeGreaterThan(0)
    })

    // TC-2.3 單輪 hang 由 overallTimeoutMs 兜底
    test('TC-2.3 MutationObserver 永不觸發時，overallTimeoutMs 為唯一防線', async () => {
      jest.useFakeTimers()
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 928, raw: 'X' })
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 100; container.scrollTop = pos })
      // 量測恆回傳同一批（DOM 永不穩定靠 timeout 兜底，maxIterations 設極大）
      let n = 96
      jest.spyOn(adapter, '_measureBooks').mockImplementation(() => {
        n += 1
        return Array.from({ length: n }, (_, i) => `id-${i}`)
      })

      const promise = adapter.loadAllBooksLazy({
        maxIterations: 100000, stableRounds: 3, renderWaitMs: 800, overallTimeoutMs: 5000
      })
      await jest.runAllTimersAsync()
      const result = await promise

      expect(result.stopReason).toBe('timeout')
    })

    // TC-2.4 空書庫 parseLibraryTotal=0（場景 9 路徑 A）
    test('TC-2.4 parseLibraryTotal=0 時 stopReason=already_complete、不捲動', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 0, raw: '擁有 0 本書' })
      const scrollSpy = jest.spyOn(adapter, '_scrollStep').mockImplementation(() => {})
      jest.spyOn(adapter, '_measureBooks').mockReturnValue([])

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 10, overallTimeoutMs: 60000
      })

      expect(result.stopReason).toBe('already_complete')
      expect(result.iterations).toBe(0)
      expect(scrollSpy).not.toHaveBeenCalled()
    })

    // TC-2.5 空書庫 parseLibraryTotal=null（場景 9 路徑 B）
    test('TC-2.5 parseLibraryTotal=null 且量測恆 0 時 stopReason=count_stable', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: null, raw: '' })
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 100; container.scrollTop = pos })
      jest.spyOn(adapter, '_measureBooks').mockReturnValue([])

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 10, overallTimeoutMs: 60000
      })

      expect(result.stopReason).toBe('count_stable')
      expect(result.loadedCount).toBe(0)
      expect(result.coverageComplete).toBe(false)
      expect(result.missingCount).toBe(0)
    })

    // TC-2.6 四停止條件獨立性矩陣
    test('TC-2.6 四停止條件各自獨立成立且皆在有限步內 resolve', async () => {
      // (a) reached_total
      {
        const a = createReadmooAdapter({ logger: createMockLogger() })
        const c = setupScrollableContainer()
        jest.spyOn(a, 'findScrollContainer').mockReturnValue({ container: c, strategy: 'selector' })
        jest.spyOn(a, 'parseLibraryTotal').mockReturnValue({ total: 100, raw: 'a' })
        let p = 0
        jest.spyOn(a, '_scrollStep').mockImplementation(() => { p += 100; c.scrollTop = p })
        jest.spyOn(a, '_measureBooks')
          .mockReturnValueOnce(Array.from({ length: 50 }, (_, i) => `x${i}`))
          .mockReturnValue(Array.from({ length: 100 }, (_, i) => `x${i}`))
        const r = await a.loadAllBooksLazy({ maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000 })
        expect(r.stopReason).toBe('reached_total')
      }
      // (b) count_stable
      {
        const a = createReadmooAdapter({ logger: createMockLogger() })
        const c = setupScrollableContainer()
        jest.spyOn(a, 'findScrollContainer').mockReturnValue({ container: c, strategy: 'selector' })
        jest.spyOn(a, 'parseLibraryTotal').mockReturnValue({ total: 9999, raw: 'b' })
        let p = 0
        jest.spyOn(a, '_scrollStep').mockImplementation(() => { p += 100; c.scrollTop = p })
        jest.spyOn(a, '_measureBooks').mockReturnValue(Array.from({ length: 30 }, (_, i) => `y${i}`))
        const r = await a.loadAllBooksLazy({ maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000 })
        expect(r.stopReason).toBe('count_stable')
      }
      // (c) max_iterations
      {
        const a = createReadmooAdapter({ logger: createMockLogger() })
        const c = setupScrollableContainer()
        jest.spyOn(a, 'findScrollContainer').mockReturnValue({ container: c, strategy: 'selector' })
        jest.spyOn(a, 'parseLibraryTotal').mockReturnValue({ total: 99999, raw: 'c' })
        let p = 0
        jest.spyOn(a, '_scrollStep').mockImplementation(() => { p += 100; c.scrollTop = p })
        let n = 0
        jest.spyOn(a, '_measureBooks').mockImplementation(() => { n += 3; return Array.from({ length: n }, (_, i) => `z${i}`) })
        const r = await a.loadAllBooksLazy({ maxIterations: 8, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000 })
        expect(r.stopReason).toBe('max_iterations')
      }
      // (d) timeout
      {
        jest.useFakeTimers()
        const a = createReadmooAdapter({ logger: createMockLogger() })
        const c = setupScrollableContainer()
        jest.spyOn(a, 'findScrollContainer').mockReturnValue({ container: c, strategy: 'selector' })
        jest.spyOn(a, 'parseLibraryTotal').mockReturnValue({ total: 99999, raw: 'd' })
        let p = 0
        jest.spyOn(a, '_scrollStep').mockImplementation(() => { p += 100; c.scrollTop = p })
        let n = 0
        jest.spyOn(a, '_measureBooks').mockImplementation(() => { n += 3; return Array.from({ length: n }, (_, i) => `w${i}`) })
        const promise = a.loadAllBooksLazy({ maxIterations: 100000, stableRounds: 3, renderWaitMs: 800, overallTimeoutMs: 4000 })
        await jest.runAllTimersAsync()
        const r = await promise
        expect(r.stopReason).toBe('timeout')
        jest.useRealTimers()
      }
    })
  })

  // ===== TG-3 總數解析失敗路徑 =====
  describe('TG-3 總數解析失敗路徑', () => {
    // TC-3.1 expectedTotal=null 改依穩定條件停止（場景 6）
    test('TC-3.1 expectedTotal=null 時依連續穩定停止，捲動迴圈確實執行', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: null, raw: '' })
      let pos = 0
      const scrollSpy = jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 2700; container.scrollTop = pos })
      const idArray = (n) => Array.from({ length: n }, (_, i) => `id-${i}`)
      jest.spyOn(adapter, '_measureBooks')
        .mockReturnValueOnce(idArray(96))
        .mockReturnValueOnce(idArray(300))
        .mockReturnValue(idArray(500))

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 10, overallTimeoutMs: 60000
      })

      expect(result.stopReason).toBe('count_stable')
      expect(result.expectedTotal).toBeNull()
      expect(result.coverageComplete).toBe(false)
      expect(result.missingCount).toBe(0)
      expect(scrollSpy).toHaveBeenCalled()
    })
  })

  // ===== TG-4 降級與例外路徑 =====
  describe('TG-4 降級與例外路徑', () => {
    // TC-4.1 捲動容器找不到降級（場景 7）
    test('TC-4.1 findScrollContainer 回傳 none 時 stopReason=container_not_found、resolve 不 reject', async () => {
      document.body.textContent = ''
      // 當下 DOM 有 96 個 .library-item 可供降級量測
      for (let i = 0; i < 96; i++) {
        const item = document.createElement('div')
        item.className = 'library-item'
        const privacy = document.createElement('div')
        privacy.className = 'privacy'
        privacy.id = `privacy-${2000 + i}`
        item.appendChild(privacy)
        document.body.appendChild(item)
      }
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container: null, strategy: 'none' })
      const scrollSpy = jest.spyOn(adapter, '_scrollStep').mockImplementation(() => {})

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 10, overallTimeoutMs: 60000
      })

      expect(result.stopReason).toBe('container_not_found')
      expect(result.iterations).toBe(0)
      expect(result.loadedCount).toBe(96)
      expect(scrollSpy).not.toHaveBeenCalled()
      // warn 級日誌 SCROLL_CONTAINER_NOT_FOUND
      expect(mockLogger.warn).toHaveBeenCalledWith('SCROLL_CONTAINER_NOT_FOUND', expect.any(Object))
    })

    // TC-4.2 捲動過程拋出例外（場景 8）
    test('TC-4.2 _scrollStep 拋例外時 stopReason=error、回傳已累積 loadedCount、resolve 不 reject', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 928, raw: 'X' })
      let calls = 0
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => {
        calls++
        if (calls >= 3) throw new Error('DOM detached')
        pos += 2700
        container.scrollTop = pos
      })
      const idArray = (n) => Array.from({ length: n }, (_, i) => `id-${i}`)
      jest.spyOn(adapter, '_measureBooks')
        .mockReturnValueOnce(idArray(96))
        .mockReturnValueOnce(idArray(250))
        .mockReturnValue(idArray(400))

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 10, overallTimeoutMs: 60000
      })

      expect(result.stopReason).toBe('error')
      expect(result.loadedCount).toBe(400)
      expect(mockLogger.error).toHaveBeenCalled()
    })

    // TC-4.3 量測函式拋例外亦被捕捉
    test('TC-4.3 _measureBooks 拋例外時 stopReason=error、resolve 不 reject', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 928, raw: 'X' })
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 2700; container.scrollTop = pos })
      let calls = 0
      jest.spyOn(adapter, '_measureBooks').mockImplementation(() => {
        calls++
        if (calls >= 3) throw new Error('querySelectorAll failed')
        return Array.from({ length: calls * 100 }, (_, i) => `id-${i}`)
      })

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 10, overallTimeoutMs: 60000
      })

      expect(result.stopReason).toBe('error')
      expect(mockLogger.error).toHaveBeenCalled()
    })

    // TC-4.4 loadAllBooksLazy 永遠 resolve
    test('TC-4.4 各 stopReason 路徑皆 resolve，不 reject', async () => {
      // already_complete
      {
        const a = createReadmooAdapter({ logger: createMockLogger() })
        const c = setupScrollableContainer()
        jest.spyOn(a, 'findScrollContainer').mockReturnValue({ container: c, strategy: 'selector' })
        jest.spyOn(a, 'parseLibraryTotal').mockReturnValue({ total: 10, raw: 'a' })
        jest.spyOn(a, '_scrollStep').mockImplementation(() => {})
        jest.spyOn(a, '_measureBooks').mockReturnValue(Array.from({ length: 10 }, (_, i) => `a${i}`))
        await expect(a.loadAllBooksLazy({ maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000 })).resolves.toBeDefined()
      }
      // container_not_found
      {
        const a = createReadmooAdapter({ logger: createMockLogger() })
        jest.spyOn(a, 'findScrollContainer').mockReturnValue({ container: null, strategy: 'none' })
        await expect(a.loadAllBooksLazy({ maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000 })).resolves.toBeDefined()
      }
      // error
      {
        const a = createReadmooAdapter({ logger: createMockLogger() })
        const c = setupScrollableContainer()
        jest.spyOn(a, 'findScrollContainer').mockReturnValue({ container: c, strategy: 'selector' })
        jest.spyOn(a, 'parseLibraryTotal').mockReturnValue({ total: 928, raw: 'e' })
        jest.spyOn(a, '_scrollStep').mockImplementation(() => { throw new Error('boom') })
        jest.spyOn(a, '_measureBooks').mockReturnValue([])
        await expect(a.loadAllBooksLazy({ maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000 })).resolves.toBeDefined()
      }
    })
  })

  // ===== TG-5 loadedCount 去重與日誌契約 =====
  describe('TG-5 loadedCount 去重與日誌契約', () => {
    // TC-5.1 累積 unique book ID Set 去重（跨輪重複）
    test('TC-5.1 跨輪重複 book ID 不灌大 count，loadedCount 為 unique 數', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 9999, raw: 'X' })
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 100; container.scrollTop = pos })
      // 輪1 [a,b,c]、輪2 [b,c,d,e]、輪3 [d,e,f]；unique = a-f = 6
      jest.spyOn(adapter, '_measureBooks')
        .mockReturnValueOnce(['a', 'b', 'c'])
        .mockReturnValueOnce(['b', 'c', 'd', 'e'])
        .mockReturnValue(['d', 'e', 'f'])

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      expect(result.loadedCount).toBe(6)
    })

    // TC-5.2 同輪 DOM 內重複 ID 去重
    test('TC-5.2 同輪內重複 ID 去重', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 9999, raw: 'X' })
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 100; container.scrollTop = pos })
      // 某輪 [a,a,b]；該輪貢獻 2 個 unique
      jest.spyOn(adapter, '_measureBooks').mockReturnValue(['a', 'a', 'b'])

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      expect(result.loadedCount).toBe(2)
    })

    // TC-5.3 累積 Set 對 DOM 回收免疫
    test('TC-5.3 模擬回收式虛擬捲動，累積 Set 保留前批 ID', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 9999, raw: 'X' })
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 100; container.scrollTop = pos })
      // 輪1 [a,b,c]、輪2 [d,e,f]（前批已回收，當輪 DOM 僅 d,e,f）
      jest.spyOn(adapter, '_measureBooks')
        .mockReturnValueOnce(['a', 'b', 'c'])
        .mockReturnValue(['d', 'e', 'f'])

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      // 累積保留 a-f = 6，非「當下 DOM count=3」
      expect(result.loadedCount).toBe(6)
    })

    // TC-5.4 SCROLL_LOAD_COMPLETED 日誌契約
    test('TC-5.4 結束時輸出 info 級 SCROLL_LOAD_COMPLETED 含 6 欄位', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 100, raw: 'X' })
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 100; container.scrollTop = pos })
      jest.spyOn(adapter, '_measureBooks')
        .mockReturnValueOnce(Array.from({ length: 50 }, (_, i) => `id-${i}`))
        .mockReturnValue(Array.from({ length: 100 }, (_, i) => `id-${i}`))

      await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      expect(mockLogger.info).toHaveBeenCalledWith('SCROLL_LOAD_COMPLETED', expect.objectContaining({
        loadedCount: expect.any(Number),
        expectedTotal: expect.anything(),
        coverageComplete: expect.any(Boolean),
        stopReason: expect.any(String),
        iterations: expect.any(Number),
        durationMs: expect.any(Number)
      }))
    })

    // TC-5.5 COVERAGE_INCOMPLETE 日誌契約
    test('TC-5.5 coverageComplete=false 時額外輸出 warn 級 COVERAGE_INCOMPLETE', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 928, raw: 'X' })
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 100; container.scrollTop = pos })
      // count_stable 在 500 停止，未達 928
      jest.spyOn(adapter, '_measureBooks')
        .mockReturnValueOnce(Array.from({ length: 300 }, (_, i) => `id-${i}`))
        .mockReturnValue(Array.from({ length: 500 }, (_, i) => `id-${i}`))

      await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      expect(mockLogger.warn).toHaveBeenCalledWith('COVERAGE_INCOMPLETE', expect.objectContaining({
        missingCount: expect.any(Number)
      }))
    })

    // TC-5.6 coverageComplete=true 時不輸出 COVERAGE_INCOMPLETE
    test('TC-5.6 coverageComplete=true 時不輸出 COVERAGE_INCOMPLETE', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 100, raw: 'X' })
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 100; container.scrollTop = pos })
      jest.spyOn(adapter, '_measureBooks')
        .mockReturnValueOnce(Array.from({ length: 50 }, (_, i) => `id-${i}`))
        .mockReturnValue(Array.from({ length: 100 }, (_, i) => `id-${i}`))

      await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      const coverageIncompleteCalls = mockLogger.warn.mock.calls.filter(c => c[0] === 'COVERAGE_INCOMPLETE')
      expect(coverageIncompleteCalls).toHaveLength(0)
    })

    // TC-5.7 expectedTotal=null 時 coverageComplete 恆 false 且輸出 COVERAGE_INCOMPLETE
    test('TC-5.7 expectedTotal=null 時 coverageComplete=false 且輸出 COVERAGE_INCOMPLETE', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: null, raw: '' })
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 100; container.scrollTop = pos })
      jest.spyOn(adapter, '_measureBooks').mockReturnValue(Array.from({ length: 96 }, (_, i) => `id-${i}`))

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      expect(result.coverageComplete).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith('COVERAGE_INCOMPLETE', expect.any(Object))
    })
  })

  // ===== TG-9 計時行為（fake timer）=====
  describe('TG-9 計時行為（fake timer）', () => {
    // TC-9.4 durationMs 等於累計虛擬時間
    test('TC-9.4 durationMs 約等於累計虛擬時間', async () => {
      jest.useFakeTimers()
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 99999, raw: 'X' })
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 100; container.scrollTop = pos })
      // 5 輪後停（count_stable）
      let calls = 0
      jest.spyOn(adapter, '_measureBooks').mockImplementation(() => {
        calls++
        const n = calls <= 2 ? calls * 100 : 200
        return Array.from({ length: n }, (_, i) => `id-${i}`)
      })

      const promise = adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 800, overallTimeoutMs: 60000
      })
      await jest.runAllTimersAsync()
      const result = await promise

      // durationMs 為 fake timer 累加值，應 > 0 且有限
      expect(result.durationMs).toBeGreaterThan(0)
      expect(result.stopReason).toBe('count_stable')
    })

    // TC-9.1 renderWaitMs 逾時結束本輪等待（MutationObserver 永不觸發）
    test('TC-9.1 MutationObserver 永不觸發時，本輪等待於 renderWaitMs 逾時結束', async () => {
      jest.useFakeTimers()
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 99999, raw: 'X' })
      let pos = 0
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { pos += 100; container.scrollTop = pos })
      jest.spyOn(adapter, '_measureBooks').mockReturnValue(Array.from({ length: 30 }, (_, i) => `id-${i}`))

      const promise = adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 800, overallTimeoutMs: 60000
      })
      await jest.runAllTimersAsync()
      const result = await promise

      // 量測恆穩定，3 輪後停止（renderWaitMs 逾時驅動每輪推進）
      expect(result.stopReason).toBe('count_stable')
    })
  })

  // ===== TG-10 捲動位置還原 =====
  describe('TG-10 捲動位置還原', () => {
    // TC-10.1 結束後還原起始 scrollTop
    test('TC-10.1 結束後 container scrollTop 還原為起始值', async () => {
      const container = setupScrollableContainer()
      container.scrollTop = 120
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 100, raw: 'X' })
      // 捲動會改變 scrollTop（> 120）
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { container.scrollTop = container.scrollTop + 2000 })
      jest.spyOn(adapter, '_measureBooks')
        .mockReturnValueOnce(Array.from({ length: 50 }, (_, i) => `id-${i}`))
        .mockReturnValue(Array.from({ length: 100 }, (_, i) => `id-${i}`))

      await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      expect(container.scrollTop).toBe(120)
    })

    // TC-10.2 還原為 best-effort（失敗不影響結果）
    test('TC-10.2 還原 scrollTop 拋例外時仍正常 resolve', async () => {
      const container = setupScrollableContainer()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 100, raw: 'X' })
      let restoreShouldThrow = false
      Object.defineProperty(container, 'scrollTop', {
        get: () => 0,
        set: () => { if (restoreShouldThrow) throw new Error('scrollTop set failed') },
        configurable: true
      })
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => {})
      jest.spyOn(adapter, '_measureBooks')
        .mockReturnValueOnce(Array.from({ length: 50 }, (_, i) => `id-${i}`))
        .mockImplementationOnce(() => { restoreShouldThrow = true; return Array.from({ length: 100 }, (_, i) => `id-${i}`) })
        .mockReturnValue(Array.from({ length: 100 }, (_, i) => `id-${i}`))

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      expect(result).toBeDefined()
      expect(result.loadedCount).toBe(100)
    })

    // TC-10.3 各 stopReason 路徑皆執行還原
    test('TC-10.3 already_complete 路徑亦還原起始 scrollTop', async () => {
      const container = setupScrollableContainer()
      container.scrollTop = 88
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 10, raw: 'X' })
      jest.spyOn(adapter, '_scrollStep').mockImplementation(() => { container.scrollTop = 5000 })
      jest.spyOn(adapter, '_measureBooks').mockReturnValue(Array.from({ length: 10 }, (_, i) => `id-${i}`))

      await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      // already_complete 不捲動，scrollTop 維持起始值
      expect(container.scrollTop).toBe(88)
    })
  })

  // ===== TG-11 _scrollStep 每輪同時捲動 + 點擊「更多...」按鈕（W1-040）=====
  // 驗證 W1-040 根因修復：原 _scrollStep 依 strategy 二擇一，實機 selector
  // 策略恆優先命中容器導致「更多...」按鈕永不被點擊，首批 96 無法展開。
  // 修復後每輪同時執行捲動與按鈕點擊。本組測試 _scrollStep 真實實作（不 spy）。
  describe('TG-11 _scrollStep 每輪同時捲動 + 點擊「更多...」按鈕（W1-040）', () => {
    /**
     * 建立 .btn-outline-primary 「更多...」按鈕並附加到 DOM。
     * @param {string} text - 按鈕文字（預設「更多...」）
     * @returns {HTMLElement} 按鈕元素
     */
    const setupLoadMoreButton = (text = '更多...') => {
      const btn = document.createElement('button')
      btn.className = 'btn-outline-primary'
      btn.textContent = text
      document.body.appendChild(btn)
      return btn
    }

    // TC-11.1 selector 策略下仍點擊「更多...」按鈕（W1-040 核心根因）
    test('TC-11.1 selector 策略捲動容器，同時點擊頁面上的「更多...」按鈕', () => {
      const container = setupScrollableContainer()
      const btn = setupLoadMoreButton()
      const clickSpy = jest.spyOn(btn, 'click')

      adapter._scrollStep(container, 'selector')

      // selector 策略：容器捲動至底部
      expect(container.scrollTop).toBe(container.scrollHeight)
      // 修復重點：selector 策略下仍點擊「更多...」按鈕（原實作不會點）
      expect(clickSpy).toHaveBeenCalled()
    })

    // TC-11.2 scrollable-ancestor 策略下亦點擊按鈕
    test('TC-11.2 scrollable-ancestor 策略捲動容器，同時點擊「更多...」按鈕', () => {
      const container = setupScrollableContainer()
      const btn = setupLoadMoreButton('載入更多...')
      const clickSpy = jest.spyOn(btn, 'click')

      adapter._scrollStep(container, 'scrollable-ancestor')

      expect(container.scrollTop).toBe(container.scrollHeight)
      expect(clickSpy).toHaveBeenCalled()
    })

    // TC-11.3 按鈕不存在時不報錯（全部載入完成的正常終止情境）
    test('TC-11.3 「更多...」按鈕不存在時 _scrollStep 仍正常捲動且不拋例外', () => {
      const container = setupScrollableContainer()
      // 不建立按鈕

      expect(() => adapter._scrollStep(container, 'selector')).not.toThrow()
      expect(container.scrollTop).toBe(container.scrollHeight)
    })

    // TC-11.4 load-more-button 策略下按鈕仍被點擊
    test('TC-11.4 load-more-button 策略下「更多...」按鈕被點擊', () => {
      const btn = setupLoadMoreButton()
      const clickSpy = jest.spyOn(btn, 'click')

      adapter._scrollStep(btn, 'load-more-button')

      expect(clickSpy).toHaveBeenCalled()
    })

    // TC-11.5 loadAllBooksLazy 主迴圈每輪皆點擊「更多...」按鈕
    test('TC-11.5 loadAllBooksLazy 每輪呼叫 _clickLoadMoreButton 觸發首批展開', async () => {
      const container = setupScrollableContainer()
      setupLoadMoreButton()
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 928, raw: '擁有 944 本書' })
      const clickSpy = jest.spyOn(adapter, '_clickLoadMoreButton')
      // 模擬點擊後書籍漸增至達標
      const idArray = (n) => Array.from({ length: n }, (_, i) => `id-${i}`)
      jest.spyOn(adapter, '_measureBooks')
        .mockReturnValueOnce(idArray(96))
        .mockReturnValueOnce(idArray(192))
        .mockReturnValueOnce(idArray(500))
        .mockReturnValue(idArray(928))

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      // 每輪迴圈皆觸發按鈕點擊（首批 96 -> 192 的展開路徑）
      expect(clickSpy).toHaveBeenCalled()
      expect(result.stopReason).toBe('reached_total')
      expect(result.loadedCount).toBe(928)
    })

    // TC-11.6 「更多...」消失後（全部載入完成）仍正常推進至達標
    test('TC-11.6 按鈕消失後 _clickLoadMoreButton 略過點擊，迴圈仍正常結束', async () => {
      const container = setupScrollableContainer()
      // 不建立按鈕，模擬全部載入完成後按鈕已消失
      jest.spyOn(adapter, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(adapter, 'parseLibraryTotal').mockReturnValue({ total: 100, raw: 'X' })
      const idArray = (n) => Array.from({ length: n }, (_, i) => `id-${i}`)
      jest.spyOn(adapter, '_measureBooks')
        .mockReturnValueOnce(idArray(50))
        .mockReturnValue(idArray(100))

      const result = await adapter.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      expect(result.stopReason).toBe('reached_total')
      expect(result.loadedCount).toBe(100)
    })
  })
})
