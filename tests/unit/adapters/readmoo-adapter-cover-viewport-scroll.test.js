/**
 * ReadmooAdapter 封面真圖替換整頁捲動單元測試（W2-005.1）
 *
 * 對應根因：Readmoo 書庫封面是「viewport 可見性驅動替換」——viewport 外
 * .library-item 的 cover-img src 為 placeholder（/images/openbook.png），
 * 進入過 viewport 後 React 才換成真實 CDN URL。即使全部 item 載入，提取當下
 * viewport 外書籍封面仍是 placeholder（實機實驗 5：placeholder 恆約 90 本）。
 *
 * 修復：loadAllBooksLazy item 全載入後、提取前，以整頁 window.scrollTo 從頂
 * 漸進捲到底，讓每本書進過 viewport 觸發封面真圖替換。
 *
 * 測試策略：jsdom 無真實 viewport 載入與 React 替換，無法直接驗證 placeholder
 * 歸零（實機驗證由 PM 接手）。本檔聚焦可測行為：
 * - _scrollThroughAllItemsForCovers 的分段捲動邏輯與停止條件
 * - loadAllBooksLazy 在「提取前」確實呼叫整頁捲動方法（時序契約）
 * - 降級路徑（window 不可用 / scrollTo 例外）永遠 resolve 不中斷提取
 *
 * 計時以 jest.spyOn 注入 _waitMs 即時 resolve（解耦真實等待）。
 */

describe('ReadmooAdapter 封面真圖替換整頁捲動（W2-005.1）', () => {
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
   * @returns {Object} mock window（含 scrollTo / scrollY / innerHeight）
   */
  const createMockWindow = ({ innerHeight = 800, scrollHeight = 10000 } = {}) => {
    const maxScrollY = Math.max(0, scrollHeight - innerHeight)
    const win = {
      innerHeight,
      scrollY: 0,
      scrollTo: jest.fn((x, y) => {
        // 真實瀏覽器會夾在 [0, maxScrollY]
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

  describe('_scrollThroughAllItemsForCovers 分段捲動邏輯', () => {
    test('整頁可捲時從頂漸進捲到底，呼叫 scrollTo 多段且最終達底部', async () => {
      const { win, maxScrollY } = createMockWindow({ innerHeight: 800, scrollHeight: 10000 })
      const mockDoc = createMockDocument({ scrollHeight: 10000, clientHeight: 800 })
      adapter = createReadmooAdapter({ logger: mockLogger, window: win, document: mockDoc })
      // 等待即時 resolve（不真實 setTimeout）
      jest.spyOn(adapter, '_waitMs').mockResolvedValue(undefined)

      const result = await adapter._scrollThroughAllItemsForCovers()

      expect(result.reason).toBe('reached_bottom')
      // 每段約 800*0.8=640，10000-800=9200 可捲距離，需多段
      expect(result.segments).toBeGreaterThan(1)
      expect(win.scrollTo).toHaveBeenCalled()
      // 第一段必從頂部 (0,0) 開始
      expect(win.scrollTo).toHaveBeenNthCalledWith(1, 0, 0)
      // 最終捲到可捲底部
      expect(win.scrollY).toBe(maxScrollY)
    })

    test('每段捲動後皆等待封面載入（呼叫 _waitMs）', async () => {
      const { win } = createMockWindow({ innerHeight: 800, scrollHeight: 5000 })
      const mockDoc = createMockDocument({ scrollHeight: 5000, clientHeight: 800 })
      adapter = createReadmooAdapter({ logger: mockLogger, window: win, document: mockDoc })
      const waitSpy = jest.spyOn(adapter, '_waitMs').mockResolvedValue(undefined)

      const result = await adapter._scrollThroughAllItemsForCovers()

      // 每段一次等待：waitMs 呼叫次數 == segments
      expect(waitSpy).toHaveBeenCalledTimes(result.segments)
      // 預設等待毫秒傳入
      expect(waitSpy).toHaveBeenCalledWith(expect.any(Number))
    })

    test('整頁內容未超出 viewport（不可捲）時提早結束，reason=no_scroll_needed', async () => {
      const { win } = createMockWindow({ innerHeight: 800, scrollHeight: 800 })
      const mockDoc = createMockDocument({ scrollHeight: 800, clientHeight: 800 })
      adapter = createReadmooAdapter({ logger: mockLogger, window: win, document: mockDoc })
      jest.spyOn(adapter, '_waitMs').mockResolvedValue(undefined)

      const result = await adapter._scrollThroughAllItemsForCovers()

      expect(result.reason).toBe('no_scroll_needed')
      expect(result.segments).toBe(0)
      expect(win.scrollTo).not.toHaveBeenCalled()
    })

    test('window 不可用時降級回傳 no_window，不拋例外', async () => {
      const mockDoc = createMockDocument()
      // window 物件無 scrollTo
      adapter = createReadmooAdapter({ logger: mockLogger, window: {}, document: mockDoc })
      jest.spyOn(adapter, '_waitMs').mockResolvedValue(undefined)

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
      jest.spyOn(adapter, '_waitMs').mockResolvedValue(undefined)

      const result = await adapter._scrollThroughAllItemsForCovers()

      expect(result.reason).toBe('error')
      expect(mockLogger.warn).toHaveBeenCalledWith('COVER_SCROLL_FAILED', expect.objectContaining({
        segments: expect.any(Number)
      }))
    })

    test('scrollY 停滯不增（容器拒絕捲動）時停止，避免空轉超過上限', async () => {
      // scrollTo 不更新 scrollY（永遠 0），模擬無法捲動
      const win = {
        innerHeight: 800,
        scrollY: 0,
        scrollTo: jest.fn() // no-op：scrollY 恆 0
      }
      const mockDoc = createMockDocument({ scrollHeight: 10000, clientHeight: 800 })
      adapter = createReadmooAdapter({ logger: mockLogger, window: win, document: mockDoc })
      jest.spyOn(adapter, '_waitMs').mockResolvedValue(undefined)

      const result = await adapter._scrollThroughAllItemsForCovers()

      // scrollY 停在 0 不增 → reached_bottom（防空轉），段數遠低於 maxSegments
      expect(result.reason).toBe('reached_bottom')
      expect(result.segments).toBeLessThan(10)
    })

    test('maxSegments 上限保護：scrollY 持續微增不達底時停在上限', async () => {
      // scrollY 每段 +1（持續增加但極慢，永不達底）
      let y = 0
      const win = {
        innerHeight: 800,
        get scrollY () { return y },
        scrollTo: jest.fn(() => { y += 1 })
      }
      const mockDoc = createMockDocument({ scrollHeight: 1000000, clientHeight: 800 })
      adapter = createReadmooAdapter({ logger: mockLogger, window: win, document: mockDoc })
      jest.spyOn(adapter, '_waitMs').mockResolvedValue(undefined)

      const result = await adapter._scrollThroughAllItemsForCovers({ maxSegments: 5 })

      expect(result.reason).toBe('max_segments')
      expect(result.segments).toBe(5)
    })
  })

  describe('loadAllBooksLazy 提取前呼叫整頁捲動（時序契約）', () => {
    /**
     * 設定可捲容器（沿用 scroll-load 測試模式）並掛 mock window/document。
     */
    const setupAdapterWithScroll = ({ total = 100, measureSeq } = {}) => {
      const { win } = createMockWindow({ innerHeight: 800, scrollHeight: 5000 })
      const mockDoc = createMockDocument({ scrollHeight: 5000, clientHeight: 800 })
      const a = createReadmooAdapter({ logger: createMockLogger(), window: win, document: mockDoc })
      const container = { scrollTop: 0, scrollHeight: 27000, clientHeight: 761 }
      jest.spyOn(a, 'findScrollContainer').mockReturnValue({ container, strategy: 'selector' })
      jest.spyOn(a, 'parseLibraryTotal').mockReturnValue({ total, raw: 'X' })
      jest.spyOn(a, '_scrollStep').mockImplementation(() => {})
      jest.spyOn(a, '_waitMs').mockResolvedValue(undefined)
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

      const result = await a.loadAllBooksLazy({
        maxIterations: 30, stableRounds: 3, renderWaitMs: 5, overallTimeoutMs: 60000
      })

      expect(result.stopReason).toBe('reached_total')
      expect(coverScrollSpy).toHaveBeenCalled()
    })

    test('首批即完整（already_complete）路徑亦呼叫整頁捲動觸發封面', async () => {
      const { a } = setupAdapterWithScroll({ total: 50, measureSeq: [50] })
      const coverScrollSpy = jest.spyOn(a, '_scrollThroughAllItemsForCovers')

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

      // _scrollThroughAllItemsForCovers 內部已 try/catch，理論上不 reject；
      // 即便 mock 強制 reject，loadAllBooksLazy 外層 catch 仍以 error 路徑 resolve
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
