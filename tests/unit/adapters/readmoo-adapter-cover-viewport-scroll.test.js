/**
 * ReadmooAdapter 封面真圖替換整頁捲動 + 收斂等待單元測試（W2-005.1）
 *
 * 根因（PM 三次實機量測鎖定）：Readmoo 書庫封面是「viewport 可見性驅動替換」——
 * viewport 外 .library-item 的 cover-img src 為 placeholder（/images/openbook.png），
 * 進入過 viewport 後 React 才以**異步 render** 換成真實 CDN URL。
 *
 * 第一版缺陷：window.scrollTo 瞬間到底，每段僅固定等 300ms 且捲完無收斂條件，
 * 提取緊接讀取時真圖尚未 render → 讀到 656 placeholder（稍後 render 完成 DOM
 * 才變真圖）。修復：以「輪詢 placeholder 數歸零」的收斂等待取代固定延遲。
 *
 * 測試策略：jsdom 無真實 React 異步 render，以 _countPlaceholderCovers 注入
 * 序列模擬「placeholder 數隨輪詢遞減至 0」，驗證收斂等待邏輯本身；scroll
 * 分段邏輯則 mock _waitForPlaceholderConvergence 即時返回。實機 placeholder
 * 歸零驗證由 PM 接手。
 */

describe('ReadmooAdapter 封面真圖替換整頁捲動 + 收斂等待（W2-005.1）', () => {
  let createReadmooAdapter
  let adapter
  let mockLogger

  const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })

  /**
   * 建立可控的 mock window，scrollY 隨 scrollTo 推進至底部上限。
   * @param {Object} opts - { innerHeight, scrollHeight }
   * @returns {Object} { win, maxScrollY }
   */
  const createMockWindow = ({ innerHeight = 800, scrollHeight = 10000 } = {}) => {
    const maxScrollY = Math.max(0, scrollHeight - innerHeight)
    const win = {
      innerHeight,
      scrollY: 0,
      scrollTo: jest.fn((x, y) => {
        win.scrollY = Math.min(Math.max(0, y), maxScrollY)
      })
    }
    return { win, maxScrollY }
  }

  /**
   * 建立 mock document，scrollingElement 提供 scrollHeight / clientHeight。
   * @param {Object} opts - { scrollHeight, clientHeight }
   * @returns {Object} mock document
   */
  const createMockDocument = ({ scrollHeight = 10000, clientHeight = 800 } = {}) => ({
    scrollingElement: { scrollHeight, clientHeight, scrollTop: 0 },
    documentElement: { scrollHeight, clientHeight, scrollTop: 0 },
    querySelectorAll: jest.fn(() => []),
    querySelector: jest.fn(() => null),
    body: { nodeType: 1 }
  })

  /**
   * 以收斂已完成（converged）即時返回 mock _waitForPlaceholderConvergence，
   * 解耦 scroll 分段邏輯與收斂等待。
   * @param {Object} a - adapter 實例
   * @returns {jest.SpyInstance}
   */
  const stubConvergeImmediate = (a) =>
    jest.spyOn(a, '_waitForPlaceholderConvergence')
      .mockResolvedValue({ converged: true, finalPlaceholderCount: 0, reason: 'converged' })

  beforeEach(() => {
    jest.resetModules()
    createReadmooAdapter = require('src/content/adapters/readmoo-adapter')
    mockLogger = createMockLogger()
  })

  afterEach(() => {
    adapter = null
    jest.clearAllMocks()
    jest.useRealTimers()
  })

  // ===== 整頁捲動分段邏輯（收斂等待 mock 即時返回）=====
  describe('_scrollThroughAllItemsForCovers 分段捲動邏輯', () => {
    test('整頁可捲時從頂漸進捲到底，呼叫 scrollTo 多段且最終達底部', async () => {
      const { win, maxScrollY } = createMockWindow({ innerHeight: 800, scrollHeight: 10000 })
      const mockDoc = createMockDocument({ scrollHeight: 10000, clientHeight: 800 })
      adapter = createReadmooAdapter({ logger: mockLogger, window: win, document: mockDoc })
      stubConvergeImmediate(adapter)

      const result = await adapter._scrollThroughAllItemsForCovers()

      expect(result.reason).toBe('reached_bottom')
      expect(result.segments).toBeGreaterThan(1)
      expect(win.scrollTo).toHaveBeenCalled()
      expect(win.scrollTo).toHaveBeenNthCalledWith(1, 0, 0)
      expect(win.scrollY).toBe(maxScrollY)
    })

    test('每段捲動後皆做收斂等待（呼叫 _waitForPlaceholderConvergence）+ 捲完整體收斂', async () => {
      const { win } = createMockWindow({ innerHeight: 800, scrollHeight: 5000 })
      const mockDoc = createMockDocument({ scrollHeight: 5000, clientHeight: 800 })
      adapter = createReadmooAdapter({ logger: mockLogger, window: win, document: mockDoc })
      const convergeSpy = stubConvergeImmediate(adapter)

      const result = await adapter._scrollThroughAllItemsForCovers()

      // 每段一次收斂等待 + 捲完整體收斂一次：呼叫次數 == segments + 1
      expect(convergeSpy).toHaveBeenCalledTimes(result.segments + 1)
    })

    test('整頁不可捲（內容未超出 viewport）時 reason=no_scroll_needed，仍做一次整體收斂', async () => {
      const { win } = createMockWindow({ innerHeight: 800, scrollHeight: 800 })
      const mockDoc = createMockDocument({ scrollHeight: 800, clientHeight: 800 })
      adapter = createReadmooAdapter({ logger: mockLogger, window: win, document: mockDoc })
      const convergeSpy = stubConvergeImmediate(adapter)

      const result = await adapter._scrollThroughAllItemsForCovers()

      expect(result.reason).toBe('no_scroll_needed')
      expect(result.segments).toBe(0)
      expect(win.scrollTo).not.toHaveBeenCalled()
      // 不捲動但仍對當前 viewport 做收斂等待（小書庫亦可能有未 render 的 placeholder）
      expect(convergeSpy).toHaveBeenCalledTimes(1)
    })

    test('window 不可用時降級回傳 no_window，不拋例外', async () => {
      const mockDoc = createMockDocument()
      adapter = createReadmooAdapter({ logger: mockLogger, window: {}, document: mockDoc })

      const result = await adapter._scrollThroughAllItemsForCovers()

      expect(result.reason).toBe('no_window')
      expect(result.segments).toBe(0)
    })

    test('scrollTo 拋例外時降級回傳 error，logger.warn 記錄，不 reject', async () => {
      const win = {
        innerHeight: 800,
        scrollY: 0,
        scrollTo: jest.fn(() => { throw new Error('scrollTo blocked') })
      }
      const mockDoc = createMockDocument({ scrollHeight: 10000, clientHeight: 800 })
      adapter = createReadmooAdapter({ logger: mockLogger, window: win, document: mockDoc })
      stubConvergeImmediate(adapter)

      const result = await adapter._scrollThroughAllItemsForCovers()

      expect(result.reason).toBe('error')
      expect(mockLogger.warn).toHaveBeenCalledWith('COVER_SCROLL_FAILED', expect.objectContaining({
        segments: expect.any(Number)
      }))
    })

    test('scrollY 停滯不增（容器拒絕捲動）時停止，避免空轉超過上限', async () => {
      const win = {
        innerHeight: 800,
        scrollY: 0,
        scrollTo: jest.fn() // no-op：scrollY 恆 0
      }
      const mockDoc = createMockDocument({ scrollHeight: 10000, clientHeight: 800 })
      adapter = createReadmooAdapter({ logger: mockLogger, window: win, document: mockDoc })
      stubConvergeImmediate(adapter)

      const result = await adapter._scrollThroughAllItemsForCovers()

      expect(result.reason).toBe('reached_bottom')
      expect(result.segments).toBeLessThan(10)
    })

    test('maxSegments 上限保護：scrollY 持續微增不達底時停在上限', async () => {
      let y = 0
      const win = {
        innerHeight: 800,
        get scrollY () { return y },
        scrollTo: jest.fn(() => { y += 1 })
      }
      const mockDoc = createMockDocument({ scrollHeight: 1000000, clientHeight: 800 })
      adapter = createReadmooAdapter({ logger: mockLogger, window: win, document: mockDoc })
      stubConvergeImmediate(adapter)

      const result = await adapter._scrollThroughAllItemsForCovers({ maxSegments: 5 })

      expect(result.reason).toBe('max_segments')
      expect(result.segments).toBe(5)
    })

    test('返回結果含 converged / finalPlaceholderCount（透傳整體收斂結果）', async () => {
      const { win } = createMockWindow({ innerHeight: 800, scrollHeight: 5000 })
      const mockDoc = createMockDocument({ scrollHeight: 5000, clientHeight: 800 })
      adapter = createReadmooAdapter({ logger: mockLogger, window: win, document: mockDoc })
      // 最後整體收斂回傳「未收斂、剩 3 個（Readmoo 端本身無封面者）」
      jest.spyOn(adapter, '_waitForPlaceholderConvergence')
        .mockResolvedValue({ converged: false, finalPlaceholderCount: 3, reason: 'stable' })

      const result = await adapter._scrollThroughAllItemsForCovers()

      expect(result.converged).toBe(false)
      expect(result.finalPlaceholderCount).toBe(3)
    })
  })

  // ===== 收斂等待核心邏輯（_waitForPlaceholderConvergence）=====
  describe('_waitForPlaceholderConvergence 收斂等待（核心修復）', () => {
    test('placeholder 數隨輪詢遞減至 0 → converged=true、reason=converged', async () => {
      adapter = createReadmooAdapter({ logger: mockLogger })
      jest.spyOn(adapter, '_waitMs').mockResolvedValue(undefined)
      // 模擬 React 異步 render：每輪 placeholder 數遞減 656 → 300 → 90 → 0
      jest.spyOn(adapter, '_countPlaceholderCovers')
        .mockReturnValueOnce(656) // 初始量測
        .mockReturnValueOnce(300)
        .mockReturnValueOnce(90)
        .mockReturnValue(0)

      const result = await adapter._waitForPlaceholderConvergence({ timeoutMs: 60000 })

      expect(result.converged).toBe(true)
      expect(result.reason).toBe('converged')
      expect(result.finalPlaceholderCount).toBe(0)
    })

    test('一開始即無 placeholder 時立即收斂，不輪詢', async () => {
      adapter = createReadmooAdapter({ logger: mockLogger })
      const waitSpy = jest.spyOn(adapter, '_waitMs').mockResolvedValue(undefined)
      jest.spyOn(adapter, '_countPlaceholderCovers').mockReturnValue(0)

      const result = await adapter._waitForPlaceholderConvergence({ timeoutMs: 60000 })

      expect(result.converged).toBe(true)
      expect(result.reason).toBe('converged')
      expect(waitSpy).not.toHaveBeenCalled()
    })

    test('placeholder 數穩定不再下降（Readmoo 端本身無封面者）→ reason=stable', async () => {
      adapter = createReadmooAdapter({ logger: mockLogger })
      jest.spyOn(adapter, '_waitMs').mockResolvedValue(undefined)
      // 降到 5 後恆定不變（5 本 Readmoo 端確實無封面），連續 4 輪即 stable
      jest.spyOn(adapter, '_countPlaceholderCovers')
        .mockReturnValueOnce(90) // 初始
        .mockReturnValueOnce(20)
        .mockReturnValue(5) // 之後恆 5
      const result = await adapter._waitForPlaceholderConvergence({
        timeoutMs: 60000, stableRounds: 4
      })

      expect(result.converged).toBe(false)
      expect(result.reason).toBe('stable')
      expect(result.finalPlaceholderCount).toBe(5)
    })

    test('render 永不完成（placeholder 持續高位緩降但不到 timeout 內歸零）→ reason=timeout', async () => {
      jest.useFakeTimers()
      adapter = createReadmooAdapter({ logger: mockLogger })
      // 真實 _waitMs（推進 fake timer），placeholder 每輪 -1 永遠 > 0（緩降不穩定）
      let n = 100
      jest.spyOn(adapter, '_countPlaceholderCovers').mockImplementation(() => {
        n = Math.max(1, n - 1)
        return n
      })

      const promise = adapter._waitForPlaceholderConvergence({
        timeoutMs: 1000, pollIntervalMs: 150, stableRounds: 999
      })
      await jest.runAllTimersAsync()
      const result = await promise

      expect(result.reason).toBe('timeout')
      expect(result.converged).toBe(false)
      jest.useRealTimers()
    })

    test('收斂達成前每輪呼叫 _countPlaceholderCovers（輪詢驅動）', async () => {
      adapter = createReadmooAdapter({ logger: mockLogger })
      jest.spyOn(adapter, '_waitMs').mockResolvedValue(undefined)
      const countSpy = jest.spyOn(adapter, '_countPlaceholderCovers')
        .mockReturnValueOnce(50)
        .mockReturnValueOnce(10)
        .mockReturnValue(0)

      await adapter._waitForPlaceholderConvergence({ timeoutMs: 60000 })

      // 初始 1 次 + 每輪輪詢，直到讀到 0
      expect(countSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })

  // ===== _countPlaceholderCovers placeholder 偵測 =====
  describe('_countPlaceholderCovers placeholder 封面偵測', () => {
    /**
     * 在 jsdom 真實 document 建立 .library-item，各帶指定 cover src。
     * @param {string[]} srcs - 每本書的 cover-img src
     */
    const setupItems = (srcs) => {
      document.body.textContent = ''
      srcs.forEach((src) => {
        const item = document.createElement('div')
        item.className = 'library-item'
        const img = document.createElement('img')
        img.className = 'cover-img'
        if (src !== null) img.setAttribute('src', src)
        item.appendChild(img)
        document.body.appendChild(item)
      })
    }

    afterEach(() => { document.body.textContent = '' })

    test('計算 src 含 openbook 的 placeholder 數，真實 CDN URL 不計入', () => {
      adapter = createReadmooAdapter({ logger: mockLogger })
      setupItems([
        '/images/openbook.png', // placeholder
        'https://cdn.readmoo.com/cover/abc.jpg', // 真圖
        '/images/openbook.png', // placeholder
        'https://cdn.readmoo.com/cover/def.jpg' // 真圖
      ])

      expect(adapter._countPlaceholderCovers()).toBe(2)
    })

    test('全部真圖時回傳 0', () => {
      adapter = createReadmooAdapter({ logger: mockLogger })
      setupItems([
        'https://cdn.readmoo.com/cover/a.jpg',
        'https://cdn.readmoo.com/cover/b.jpg'
      ])

      expect(adapter._countPlaceholderCovers()).toBe(0)
    })

    test('全部 placeholder 時回傳全數', () => {
      adapter = createReadmooAdapter({ logger: mockLogger })
      setupItems(['/images/openbook.png', '/images/openbook.png', '/images/openbook.png'])

      expect(adapter._countPlaceholderCovers()).toBe(3)
    })

    test('document 不可用時回傳 0，不拋例外', () => {
      adapter = createReadmooAdapter({ logger: mockLogger, document: null })
      // getDocument 退回 globalThis.document（jsdom），清空確保無 item
      document.body.textContent = ''
      expect(() => adapter._countPlaceholderCovers()).not.toThrow()
    })
  })

  // ===== loadAllBooksLazy 提取前呼叫整頁捲動（時序契約）=====
  describe('loadAllBooksLazy 提取前呼叫整頁捲動（時序契約）', () => {
    const setupAdapterWithScroll = ({ total = 100, measureSeq } = {}) => {
      const { win } = createMockWindow({ innerHeight: 800, scrollHeight: 5000 })
      const mockDoc = createMockDocument({ scrollHeight: 5000, clientHeight: 800 })
      const a = createReadmooAdapter({ logger: createMockLogger(), window: win, document: mockDoc })
      const container = { scrollTop: 0, scrollHeight: 27000, clientHeight: 761 }
      jest.spyOn(a, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(a, 'parseLibraryTotal').mockReturnValue({ total, raw: 'X' })
      jest.spyOn(a, '_scrollStep').mockImplementation(() => {})
      const measure = jest.spyOn(a, '_measureBooks')
      if (measureSeq) {
        measureSeq.forEach((n, i) => {
          const arr = Array.from({ length: n }, (_, k) => `id-${k}`)
          if (i < measureSeq.length - 1) measure.mockReturnValueOnce(arr)
          else measure.mockReturnValue(arr)
        })
      }
      return { a, win, container }
    }

    test('主迴圈達標後、finalize 前呼叫 _scrollThroughAllItemsForCovers', async () => {
      const { a } = setupAdapterWithScroll({ total: 100, measureSeq: [50, 100] })
      const coverScrollSpy = jest.spyOn(a, '_scrollThroughAllItemsForCovers')
        .mockResolvedValue({ segments: 5, reason: 'reached_bottom', converged: true, finalPlaceholderCount: 0 })

      const result = await a.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      expect(result.stopReason).toBe('reached_total')
      expect(coverScrollSpy).toHaveBeenCalled()
    })

    test('整頁捲動結果輸出 info 級 COVER_SCROLL_COMPLETED 日誌（可觀測）', async () => {
      const sharedLogger = createMockLogger()
      const { win } = createMockWindow({ innerHeight: 800, scrollHeight: 5000 })
      const mockDoc = createMockDocument({ scrollHeight: 5000, clientHeight: 800 })
      const a = createReadmooAdapter({ logger: sharedLogger, window: win, document: mockDoc })
      const container = { scrollTop: 0, scrollHeight: 27000, clientHeight: 761 }
      jest.spyOn(a, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(a, 'parseLibraryTotal').mockReturnValue({ total: 100, raw: 'X' })
      jest.spyOn(a, '_scrollStep').mockImplementation(() => {})
      jest.spyOn(a, '_measureBooks')
        .mockReturnValueOnce(Array.from({ length: 50 }, (_, k) => `id-${k}`))
        .mockReturnValue(Array.from({ length: 100 }, (_, k) => `id-${k}`))
      jest.spyOn(a, '_scrollThroughAllItemsForCovers')
        .mockResolvedValue({ segments: 5, reason: 'reached_bottom', converged: true, finalPlaceholderCount: 0 })

      await a.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      expect(sharedLogger.info).toHaveBeenCalledWith('COVER_SCROLL_COMPLETED', expect.objectContaining({
        converged: expect.any(Boolean),
        finalPlaceholderCount: expect.any(Number)
      }))
    })

    test('首批即完整（already_complete）路徑亦呼叫整頁捲動觸發封面', async () => {
      const { a } = setupAdapterWithScroll({ total: 50, measureSeq: [50] })
      const coverScrollSpy = jest.spyOn(a, '_scrollThroughAllItemsForCovers')
        .mockResolvedValue({ segments: 3, reason: 'reached_bottom', converged: true, finalPlaceholderCount: 0 })

      const result = await a.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      expect(result.stopReason).toBe('already_complete')
      expect(coverScrollSpy).toHaveBeenCalled()
    })

    test('整頁捲動拋例外時 loadAllBooksLazy 仍 resolve（封面捲動不阻斷提取）', async () => {
      const { a } = setupAdapterWithScroll({ total: 100, measureSeq: [50, 100] })
      jest.spyOn(a, '_scrollThroughAllItemsForCovers').mockRejectedValue(new Error('cover scroll boom'))

      const result = await a.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      expect(result).toBeDefined()
      expect(result.loadedCount).toBeGreaterThanOrEqual(0)
    })

    test('container_not_found 降級路徑不呼叫整頁捲動（無 item 可觸發封面）', async () => {
      const { win } = createMockWindow()
      const mockDoc = createMockDocument()
      const a = createReadmooAdapter({ logger: createMockLogger(), window: win, document: mockDoc })
      jest.spyOn(a, 'findScrollContainer').mockReturnValue({ container: null, strategy: 'none' })
      jest.spyOn(a, '_measureBooks').mockReturnValue([])
      const coverScrollSpy = jest.spyOn(a, '_scrollThroughAllItemsForCovers')

      const result = await a.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      expect(result.stopReason).toBe('container_not_found')
      expect(coverScrollSpy).not.toHaveBeenCalled()
    })
  })

  // ===== _scrollWindowToBottom（F3 防禦性整頁捲動）=====
  describe('_scrollWindowToBottom（F3 防禦性整頁捲動）', () => {
    test('整頁 scrollTo 至 scrollingElement.scrollHeight', () => {
      const { win } = createMockWindow({ innerHeight: 800, scrollHeight: 6000 })
      const mockDoc = createMockDocument({ scrollHeight: 6000, clientHeight: 800 })
      adapter = createReadmooAdapter({ logger: mockLogger, window: win, document: mockDoc })

      adapter._scrollWindowToBottom()

      expect(win.scrollTo).toHaveBeenCalledWith(0, 6000)
    })

    test('window 不可用時靜默略過，不拋例外', () => {
      const mockDoc = createMockDocument()
      adapter = createReadmooAdapter({ logger: mockLogger, window: {}, document: mockDoc })

      expect(() => adapter._scrollWindowToBottom()).not.toThrow()
    })

    test('scrollTo 拋例外時靜默略過，不拋例外（best-effort）', () => {
      const win = { scrollTo: jest.fn(() => { throw new Error('blocked') }) }
      const mockDoc = createMockDocument()
      adapter = createReadmooAdapter({ logger: mockLogger, window: win, document: mockDoc })

      expect(() => adapter._scrollWindowToBottom()).not.toThrow()
    })
  })

  // ===== _waitMs 等待行為 =====
  describe('_waitMs 等待行為', () => {
    test('_waitMs 回傳 Promise 並於指定時間後 resolve（fake timer）', async () => {
      jest.useFakeTimers()
      adapter = createReadmooAdapter({ logger: mockLogger })
      let resolved = false
      const p = adapter._waitMs(300).then(() => { resolved = true })

      expect(resolved).toBe(false)
      await jest.advanceTimersByTimeAsync(300)
      await p
      expect(resolved).toBe(true)
    })
  })
})
