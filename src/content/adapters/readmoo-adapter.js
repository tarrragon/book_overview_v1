/**
 * readmoo-adapter.js
 *
 * Readmoo 頁面適配器模組
 *
 * 負責功能：
 * - DOM 操作和書籍元素提取
 * - 書籍資料解析和格式化
 * - 安全性過濾和資料驗證
 * - 提取統計和效能監控
 *
 * 設計考量：
 * - 支援多種 DOM 結構變化
 * - 實現強健的 XSS 防護
 * - 優化 DOM 查詢效能
 * - 提供詳細的除錯資訊
 *
 * 處理流程：
 * 1. DOM 查詢 → 找出所有書籍元素
 * 2. 資料解析 → 提取 ID、標題、封面等
 * 3. 安全過濾 → 移除惡意內容
 * 4. 格式驗證 → 確保資料完整性
 * 5. 統計更新 → 記錄提取結果
 *
 * 使用情境：
 * - Content Script 中的 DOM 操作層
 * - Readmoo 頁面結構的專門處理
 * - 書籍資料的標準化和清理
 */

// 導入統一日誌系統
const { Logger } = require('src/core/logging/Logger')
const { MessageDictionary } = require('src/core/messages/MessageDictionary')

/**
 * Readmoo Adapter local MessageDictionary (W1-108)
 *
 * Business context: mirrors the local dict pattern from popup.js and
 * book-search-filter-integrated.js. Decouples 36 extractor/content layer
 * message keys from GlobalMessages. After W1-115 fixed the Logger
 * constructor third parameter messages, this local dict actually takes
 * effect at runtime.
 *
 * Why (PC-165 防護): W1-117 mock-based tests verified the Logger
 * constructor signature, but unit tests assert mockLogger calls only at
 * messageKey level, never validating the rendered message text. Whether
 * this local dict switch truly takes effect needs runtime-level
 * verification — see Test Results section for the integration-level
 * assertion plan.
 *
 * Scope boundary:
 * - Locally owned: 18 keys already in GlobalMessages (override the
 *   GlobalMessages text)
 * - Locally added: 18 keys missing in GlobalMessages (previously hit
 *   `[Missing: KEY]` at runtime)
 * - Out of scope: W1-109 will clean up GlobalMessages._loadDefaultMessages
 *   extractor keys; W1-110 will implement the freeze mechanism.
 *
 * Design note: message texts mirror existing GlobalMessages versions where
 * possible to preserve grep alignment; newly added keys carry concise
 * Chinese descriptions with parameter placeholders.
 */
const readmooAdapterMessages = new MessageDictionary({
  // === 18 keys with existing GlobalMessages text (preserved as-is) ===
  BOOK_CONTAINERS_FOUND: '找到書籍容器',
  BOOK_CONTAINERS_PARSE_FAILED: '書籍容器解析失敗',
  BOOK_BATCH_PARSE_FAILED: '批次書籍解析失敗',
  NO_BOOK_ELEMENTS_FOUND: '未找到書籍元素',
  EXTRACTION_COMPLETED: '提取作業完成',
  UNSAFE_COVER_URL_FILTERED: '不安全的封面網址已過濾',
  PLACEHOLDER_URL_REPLACED: '佔位 URL 已替換為 privacy ID',
  FALLBACK_SELECTOR_ATTEMPT: '嘗試回退選擇器',
  LAST_RESORT_STRATEGY: '最後手段策略',
  GET_BOOK_ELEMENTS_CALLED: '呼叫 getBookElements (caller: {caller})',
  WAIT_FOR_BOOK_ELEMENTS_START: '開始等待書籍元素出現 (timeoutMs: {timeoutMs})',
  WAIT_FOR_BOOK_ELEMENTS_FOUND: '書籍元素已找到 (source: {source}, count: {count})',
  WAIT_FOR_BOOK_ELEMENTS_TIMEOUT: '等待書籍元素逾時 (timeoutMs: {timeoutMs}, finalCount: {finalCount})',
  SELECTOR_PARADOX: '選擇器矛盾: 主選擇器未找到但備用策略成功',
  CONTAINER_SAMPLE: '容器取樣資料',
  EXTRACTION_SAMPLE_DATA: '提取樣本資料 (totalBooks: {totalBooks})',
  FALLBACK_SELECTOR_SUCCESS: '備用選擇器成功 (selector: {selector}, count: {count})',

  // === 18 keys missing in GlobalMessages, previously rendered as
  // `[Missing: KEY]` at runtime; now filled with concise Chinese text. ===
  ADAPTER_METHOD_ERROR: '適配器方法執行錯誤 (method: {method})',
  BOOK_INSUFFICIENT_DATA: '書籍資料不足 (title / id / cover 全部缺失)',
  BOOK_PARSE_ELEMENT_FAILED: '書籍元素解析失敗 (element: {elementTag}.{elementClass})',
  COVERAGE_INCOMPLETE: '書庫提取涵蓋不完整 (missingCount: {missingCount}, reason: {reason})',
  DOCUMENT_UNAVAILABLE: 'document 物件無法取得 (非瀏覽器環境或 SW context)',
  DOM_QUERY_FAILED: 'DOM 查詢失敗',
  FIND_SCROLL_CONTAINER_FAILED: '捲動容器辨識失敗',
  FIRST_BOOK_SAMPLE: '首本書籍樣本資料',
  MUTATION_OBSERVER_FAILED: 'MutationObserver 觀察失敗',
  PARSE_LIBRARY_TOTAL_FAILED: '解析書庫總數失敗',
  PARTIAL_EXTRACTION_FAILURE: '部分書籍提取失敗 (failed: {failed} / total: {total})',
  PRIVACY_ID_EXTRACTION_FAILED: 'privacy ID 提取失敗',
  READER_LINK_NOT_FOUND: '閱讀器連結未找到 (elementClass: {elementClass})',
  RENDER_SETTLE_OBSERVER_FAILED: '渲染穩定 observer 觀察失敗',
  SCROLL_CONTAINER_NOT_FOUND: '捲動容器辨識失敗,降級為現行提取行為',
  SCROLL_LOAD_COMPLETED: '捲動載入完成',
  SCROLL_LOAD_ERROR: '捲動載入過程發生例外',
  SCROLL_POSITION_RESTORE_FAILED: '捲動位置還原失敗',
  UNSAFE_URL_FILTERED: '不安全的 URL 已過濾'
})

/**
 * 建立 Readmoo 適配器實例
 *
 * @param {Object} options - 配置選項
 * @param {Document} options.document - 可選的 document 物件，用於測試環境
 * @param {Object} [options.logger] - 可選的日誌記錄器，用於測試驗證日誌契約；
 *   未提供時建立預設 Logger（W1-030：捲動載入涵蓋率日誌契約需可注入 mock 驗證）
 * @returns {Object} ReadmooAdapter 實例
 */
function createReadmooAdapter (options = {}) {
  // 建立專用日誌記錄器（允許注入以驗證涵蓋率日誌契約）
  // W1-108: use module-level readmooAdapterMessages as the message
  // dictionary source for the default Logger; no longer depends on
  // GlobalMessages defaults (paving the way for W1-109 cleanup).
  const logger = options.logger || new Logger('ReadmooAdapter', 'INFO', readmooAdapterMessages)
  const stats = {
    totalExtracted: 0,
    successfulExtractions: 0,
    failedExtractions: 0,
    domQueryTime: 0,
    parseTime: 0,
    lastExtraction: 0
  }

  // 動態取得環境物件的輔助函數
  const getDocument = () => options.document || globalThis.document || window?.document
  const getLocation = () => globalThis.location || window?.location || {}

  // DOM 選擇器配置 (與 ReadmooAdapter 保持一致)
  const SELECTORS = {
    // 主要書籍容器 - 與 ReadmooAdapter 一致
    bookContainer: '.library-item',
    readerLink: 'a[href*="/api/reader/"]',
    bookImage: '.cover-img',
    bookTitle: '.title',
    progressBar: '.progress-bar',
    renditionType: '.label.rendition',
    // privacy 元素選擇器 — id 格式為 "privacy-{bookId}"
    privacyElement: '[id^="privacy-"]',

    // 額外的備用選擇器
    alternativeContainers: [
      '.book-item',
      '.book-card',
      '.library-book'
    ],
    progressIndicators: [
      '.progress-bar',
      '.progress',
      '[class*="progress"]',
      '.reading-progress'
    ],

    // W1-030：捲動載入相關選擇器（實機取證 2026-05-22）
    // 捲動容器候選 — Readmoo library 為 React SPA，頁面根容器 id=react-container
    scrollContainerCandidates: [
      '#react-container',
      '.react-container'
    ],
    // 「更多...」/「載入更多...」按鈕 — 實機取證 button.btn-outline-primary
    loadMoreButton: 'button.btn-outline-primary',
    // 書庫總數 header — 實機取證 div.item-list-state.container-fluid
    libraryTotalHeader: '.item-list-state'
  }

  // W1-030：書庫總數 header 文字解析正則
  // 來源文字格式：「擁有 N 本書，其中封存 X 本，借出 Y 本」
  // 封存與借出子句皆為可選；可見書目數 = N - X - Y
  const LIBRARY_TOTAL_PATTERN = /擁有\s*(\d+)\s*本書/
  const ARCHIVED_PATTERN = /封存\s*(\d+)\s*本/
  const LENT_PATTERN = /借出\s*(\d+)\s*本/

  // W1-030：「更多...」/「載入更多...」按鈕文字判定（兩種變體皆需匹配）
  const LOAD_MORE_TEXT_PATTERN = /更多/

  // Readmoo SPA 佔位 URL 偵測用正則
  const PLACEHOLDER_URL_PATTERN = /\/api\/reader\/\d+$/

  // 已知不穩定 / 佔位用 cover 圖片識別字（例：openbook.png placeholder）
  // 命中時應跳過 cover 策略，改走 reader-link / title / fallback
  // W6-012.2.1：cover-openbook 無法反查書籍，必須過濾
  const UNSTABLE_COVER_IDS = new Set(['openbook', 'undefined', 'placeholder', 'default'])

  // 向上尋找祖先元素的最大層數（W1-033 R4：getBookElements LAST_RESORT 策略與
  // findScrollableAncestor 原各自 local 定義且值不一致＝10 vs 12，提為單一共用常數）。
  // 取較大者 12 為共用上界，涵蓋 Readmoo .library-item 到捲動容器的祖先深度。
  const MAX_ANCESTOR_DEPTH = 12

  const adapter = {
    // 適配器標準屬性
    name: 'ReadmooAdapter',
    version: '2.0.0',
    isInitialized: false,

    // 適配器配置
    config: {
      batchSize: 10,
      timeout: 5000,
      retryCount: 3,
      validateUrls: true,
      enableStats: true
    },

    // 適配器統計 (提供 stats 屬性訪問)
    get stats () {
      return this.getStats()
    },

    /**
     * 標準化書籍提取介面 (兼容測試期望)
     * @param {Document} document - DOM 文件物件 (測試用，實際使用全域 document)
     * @returns {Promise<Object[]>} 書籍資料陣列
     */
    async extractBooks (document = globalThis.document) {
      return await this.extractAllBooks()
    },

    /**
     * 取得書籍容器元素 (修正：使用正確的 Readmoo 頁面結構)
     *
     * @returns {HTMLElement[]} 書籍容器元素陣列
     */
    getBookElements () {
      const startTime = performance.now()
      let elements = []
      // 診斷：記錄呼叫來源，用於分析時序問題
      const caller = new Error().stack?.split('\n')[2]?.trim() || 'unknown'

      try {
        const document = getDocument()
        if (!document) {
          logger.warn('DOCUMENT_UNAVAILABLE')
          return []
        }

        // 診斷日誌：記錄呼叫時的 DOM 狀態
        const readerLinkCount = document.querySelectorAll(SELECTORS.readerLink).length
        const directLibraryItemCount = document.querySelectorAll(SELECTORS.bookContainer).length
        // 額外診斷：測試屬性選擇器是否能匹配
        const attrSelectorCount = document.querySelectorAll('[class*="library-item"]').length

        logger.info('GET_BOOK_ELEMENTS_CALLED', {
          caller,
          readyState: document.readyState,
          directLibraryItemCount,
          attrSelectorCount,
          readerLinkCount
        })

        // 主要策略：查找 .library-item 容器
        elements = Array.from(document.querySelectorAll(SELECTORS.bookContainer))

        // 備用策略：如果沒有找到主要容器，嘗試其他選擇器
        if (elements.length === 0) {
          logger.debug('FALLBACK_SELECTOR_ATTEMPT', { reason: '未找到 .library-item' })

          for (const selector of SELECTORS.alternativeContainers) {
            const found = document.querySelectorAll(selector)
            if (found.length > 0) {
              elements = Array.from(found)
              logger.info('FALLBACK_SELECTOR_SUCCESS', { selector, count: elements.length })
              break
            }
          }
        }

        // 最後備用策略：直接查找閱讀器連結的父容器
        if (elements.length === 0) {
          logger.info('LAST_RESORT_STRATEGY', { reason: '查找閱讀器連結的父容器' })
          const readerLinks = document.querySelectorAll(SELECTORS.readerLink)
          const containers = new Set()

          readerLinks.forEach(link => {
            // 向上查找 .library-item 容器，最多走 MAX_ANCESTOR_DEPTH 層
            let parent = link.parentElement
            let depth = 0
            while (parent && parent !== document.body && depth < MAX_ANCESTOR_DEPTH) {
              if (parent.classList.contains('library-item')) {
                containers.add(parent)
                break
              }
              depth++
              parent = parent.parentElement
            }
          })

          elements = Array.from(containers)

          // 診斷：如果 LAST_RESORT 找到但主選擇器沒找到，記錄詳細資訊
          if (elements.length > 0 && directLibraryItemCount === 0) {
            const sampleParent = elements[0]
            logger.warn('SELECTOR_PARADOX', {
              directQueryFound: directLibraryItemCount,
              attrQueryFound: attrSelectorCount,
              lastResortFound: elements.length,
              readerLinksFound: readerLinkCount,
              sampleClassName: sampleParent.className,
              sampleOuterHtmlPrefix: sampleParent.outerHTML.substring(0, 200)
            })
          }
        }

        // 診斷日誌：確認容器類型
        if (elements.length > 0) {
          const sample = elements.slice(0, 3).map(el => ({
            tag: el.tagName,
            classes: el.className.split(' ').slice(0, 3).join(' '),
            hasReaderLink: !!el.querySelector(SELECTORS.readerLink),
            hasTitle: !!el.querySelector(SELECTORS.bookTitle)
          }))
          logger.info('CONTAINER_SAMPLE', { sample })
        }

        logger.info('BOOK_CONTAINERS_FOUND', { count: elements.length })

        stats.domQueryTime += performance.now() - startTime
        return elements
      } catch (error) {
        logger.error('DOM_QUERY_FAILED', { error: error.message, stack: error.stack })
        stats.domQueryTime += performance.now() - startTime
        return []
      }
    },

    /**
     * 等待書籍元素出現在 DOM 中
     *
     * 解決 SPA 動態渲染問題：Readmoo 頁面載入後，
     * 書籍元素可能需要額外時間才會渲染到 DOM。
     * 此方法使用 MutationObserver 監聽 DOM 變化，
     * 在元素出現後立即回傳結果。
     *
     * @param {Object} [waitOptions={}] - 等待選項
     * @param {number} [waitOptions.timeoutMs=3000] - 最大等待毫秒數
     * @param {number} [waitOptions.checkIntervalMs=200] - 輪詢間隔毫秒數
     * @returns {Promise<HTMLElement[]>} 書籍容器元素陣列
     */
    async waitForBookElements (waitOptions = {}) {
      const WAIT_TIMEOUT_MS = waitOptions.timeoutMs || 3000
      const CHECK_INTERVAL_MS = waitOptions.checkIntervalMs || 200

      // 先嘗試立即取得
      const immediate = this.getBookElements()
      if (immediate.length > 0) {
        return immediate
      }

      // [0.16.0-W1-003] 移除「無 reader links 就 skip」的邏輯
      // 在 SPA 架構中，readyState === "interactive" 時框架 JS 還在執行，
      // 書籍列表尚未渲染，readerLinkCount 為 0 不代表「不是書庫頁面」，
      // 而是「SPA 還沒渲染完」。必須啟動 MutationObserver 等待。

      logger.info('WAIT_FOR_BOOK_ELEMENTS_START', { timeoutMs: WAIT_TIMEOUT_MS })

      return new Promise((resolve) => {
        const document = getDocument()
        if (!document) {
          resolve([])
          return
        }

        let resolved = false
        let observer = null
        let intervalId = null

        const cleanup = () => {
          if (observer) {
            observer.disconnect()
            observer = null
          }
          if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
          }
        }

        const tryResolve = (source) => {
          if (resolved) return
          const elements = this.getBookElements()
          if (elements.length > 0) {
            resolved = true
            cleanup()
            logger.info('WAIT_FOR_BOOK_ELEMENTS_FOUND', {
              source,
              count: elements.length
            })
            resolve(elements)
          }
        }

        // 策略 1：MutationObserver 監聽 DOM 新增節點（W1-033 R2：與
        // waitForRenderSettle 共用 _observeChildListOnce helper）
        const observeTarget = document.body || document.documentElement
        observer = this._observeChildListOnce(
          observeTarget,
          () => tryResolve('mutation'),
          'MUTATION_OBSERVER_FAILED'
        )

        // 策略 2：定時輪詢作為備援
        intervalId = setInterval(() => {
          tryResolve('interval')
        }, CHECK_INTERVAL_MS)

        // 超時保護：到期後回傳當前結果（可能為空陣列）
        setTimeout(() => {
          if (!resolved) {
            resolved = true
            cleanup()
            const finalElements = this.getBookElements()
            // finalCount > 0 表示超時但仍取得結果，屬正常情境（降級為 info）
            // finalCount === 0 表示真正失敗，維持 warn
            const timeoutPayload = {
              timeoutMs: WAIT_TIMEOUT_MS,
              finalCount: finalElements.length
            }
            if (finalElements.length > 0) {
              logger.info('WAIT_FOR_BOOK_ELEMENTS_TIMEOUT', timeoutPayload)
            } else {
              logger.warn('WAIT_FOR_BOOK_ELEMENTS_TIMEOUT', timeoutPayload)
            }
            resolve(finalElements)
          }
        }, WAIT_TIMEOUT_MS)
      })
    },

    /**
     * 從頁面 header 文字解析「可見書目數」（W1-030）
     *
     * Readmoo library header 文字格式為「擁有 N 本書，其中封存 X 本，借出 Y 本」。
     * 可見書目數 = N - X - Y（封存與借出書籍不渲染為 .library-item）。
     * 封存與借出子句皆為可選。
     *
     * 此方法為捲動載入停止條件的目標值來源：loadAllBooksLazy 以此判定
     * 是否達 expectedTotal。文字格式變更、元素不存在、或計算結果為負
     * （封存/借出大於總數的異常文字）時回傳 total=null，此時捲動載入
     * 改依「連續穩定」條件停止。
     *
     * W1-033 R6：Phase 3a 待釐清 2 決議「N-X-Y 為負時回 null」，
     * 不回傳 Math.max(0,...) 夾 0 的值——夾 0 會讓 loadAllBooksLazy
     * 誤判 already_complete（0 本書庫），回 null 才正確退回穩定條件停止。
     *
     * @returns {{ total: number|null, raw: string }} total 為可見書目數，
     *   無法解析時為 null；raw 為原始 header 文字
     */
    parseLibraryTotal () {
      try {
        const document = getDocument()
        if (!document) {
          return { total: null, raw: '' }
        }

        const headerEl = document.querySelector(SELECTORS.libraryTotalHeader)
        if (!headerEl) {
          return { total: null, raw: '' }
        }

        const raw = headerEl.textContent?.trim() || ''
        const totalMatch = raw.match(LIBRARY_TOTAL_PATTERN)
        if (!totalMatch) {
          // 文字格式變更無法解析書庫總數
          return { total: null, raw }
        }

        const libraryTotal = parseInt(totalMatch[1], 10)
        const archivedMatch = raw.match(ARCHIVED_PATTERN)
        const lentMatch = raw.match(LENT_PATTERN)
        const archived = archivedMatch ? parseInt(archivedMatch[1], 10) : 0
        const lent = lentMatch ? parseInt(lentMatch[1], 10) : 0

        // R6：N-X-Y 為負時回 null（封存/借出大於總數的異常文字無法判定可見書目數）
        const visible = libraryTotal - archived - lent
        if (visible < 0) {
          return { total: null, raw }
        }
        return { total: visible, raw }
      } catch (error) {
        logger.warn('PARSE_LIBRARY_TOTAL_FAILED', { error: error.message })
        return { total: null, raw: '' }
      }
    },

    /**
     * 多層 fallback 辨識虛擬捲動容器（W1-030）
     *
     * Readmoo library 為 React SPA 虛擬捲動，捲動容器型態因頁面結構而異。
     * 依序嘗試 5 層 fallback 策略，命中即停：
     * 1. selector：指定的 library 捲動容器 class（react-container）
     * 2. load-more-button：底部「更多...」按鈕（官方載入路徑之一）
     * 3. scrollable-ancestor：從 .library-item 向上找可捲動祖先
     * 4. document：退回整頁捲動（window.scrollTo）
     * 5. none：以上皆失敗，觸發提取降級
     *
     * @returns {{ container: HTMLElement|null, strategy: string }}
     *   strategy 枚舉：selector / load-more-button / scrollable-ancestor / document / none
     */
    findScrollContainer () {
      try {
        const document = getDocument()
        if (!document) {
          return { container: null, strategy: 'none' }
        }

        // 策略 1：指定 selector 捲動容器
        for (const selector of SELECTORS.scrollContainerCandidates) {
          const el = document.querySelector(selector)
          if (el) {
            return { container: el, strategy: 'selector' }
          }
        }

        // 策略 2：「更多...」/「載入更多...」按鈕
        const loadMoreBtn = this.findLoadMoreButton()
        if (loadMoreBtn) {
          return { container: loadMoreBtn, strategy: 'load-more-button' }
        }

        // 策略 3：從 .library-item 向上找可捲動祖先
        const scrollableAncestor = this.findScrollableAncestor()
        if (scrollableAncestor) {
          return { container: scrollableAncestor, strategy: 'scrollable-ancestor' }
        }

        // 策略 4：退回整頁捲動（document）
        const docEl = document.documentElement
        if (docEl && docEl.scrollHeight > docEl.clientHeight) {
          return { container: docEl, strategy: 'document' }
        }

        // 策略 5：全失敗
        return { container: null, strategy: 'none' }
      } catch (error) {
        logger.warn('FIND_SCROLL_CONTAINER_FAILED', { error: error.message })
        return { container: null, strategy: 'none' }
      }
    },

    /**
     * 尋找底部「更多...」/「載入更多...」按鈕（W1-030）
     *
     * 實機取證：按鈕為 button.btn-outline-primary，文字在首次載入前後
     * 於「更多...」與「載入更多...」間變化，全部載入完成後按鈕消失。
     *
     * @returns {HTMLElement|null} 按鈕元素，找不到時為 null
     */
    findLoadMoreButton () {
      const document = getDocument()
      if (!document) return null
      const buttons = document.querySelectorAll(SELECTORS.loadMoreButton)
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || ''
        if (LOAD_MORE_TEXT_PATTERN.test(text)) {
          return btn
        }
      }
      return null
    },

    /**
     * 從 .library-item 向上尋找可捲動祖先元素（W1-030）
     *
     * 可捲動定義：scrollHeight > clientHeight。最多向上走 MAX_ANCESTOR_DEPTH
     * 層祖先（與 getBookElements LAST_RESORT 策略共用同一模組級常數）。
     *
     * @returns {HTMLElement|null} 可捲動祖先，找不到時為 null
     */
    findScrollableAncestor () {
      const document = getDocument()
      if (!document) return null
      const firstItem = document.querySelector(SELECTORS.bookContainer)
      if (!firstItem) return null

      let parent = firstItem.parentElement
      let depth = 0
      while (parent && parent !== document.body && depth < MAX_ANCESTOR_DEPTH) {
        if (parent.scrollHeight > parent.clientHeight) {
          return parent
        }
        depth++
        parent = parent.parentElement
      }
      return null
    },

    /**
     * 執行單輪捲動（W1-030，可注入私有方法）
     *
     * 每輪同時執行兩個 lazy load 觸發動作，不再依 strategy 二擇一：
     * 1. 捲動容器至底部（觸發虛擬捲動 render 後批書籍）
     * 2. 點擊底部「更多...」按鈕（觸發官方分頁載入）
     *
     * W1-040：原實作依 strategy 二擇一——load-more-button 策略只點按鈕、
     * 其餘策略只捲動。實機（read.readmoo.com/#/library）findScrollContainer
     * 永遠先命中 selector 策略（#react-container 為頁面根容器），導致「更多...」
     * 按鈕永不被點擊。Readmoo library 首批僅 render 96 本，必須先點「更多...」
     * 按鈕才會展開至 192 本，之後虛擬捲動才接手——只捲動 #react-container
     * 對首批 96 完全無效，3 輪 count 不變即誤觸 count_stable 放棄（實機
     * log：loadedCount:96 expectedTotal:928 stopReason:count_stable）。
     * 手動「scrollTo + 點擊更多按鈕」證實可載入完整 928 本。
     *
     * 兩動作每輪皆執行使任一觸發路徑有效即可推進：按鈕點擊負責首批展開，
     * 容器捲動負責後續虛擬捲動批次。按鈕全部載入完成後會消失，
     * findLoadMoreButton 回傳 null 時自然略過點擊。
     *
     * W1-033 R3：document 策略下 container 即 documentElement，
     * 設定其 scrollTop 即整頁捲動，不另寫 window.scrollTo（雙寫在
     * Mobile Chrome 兩者可能不一致）。
     *
     * 此方法刻意抽為獨立方法，使 Phase 2 測試能以 jest.spyOn 注入受控
     * 捲動行為驗證停止邏輯（規格 R5 可測性）。
     *
     * @param {HTMLElement} container - 捲動容器（load-more-button 策略下為按鈕元素）
     * @param {string} strategy - findScrollContainer 回傳的策略
     */
    _scrollStep (container, strategy) {
      // 動作 1：捲動容器至底部觸發虛擬捲動。
      // load-more-button 策略下 container 為按鈕元素本身，改捲入視野後由動作 2 點擊。
      if (container) {
        if (strategy === 'load-more-button') {
          if (typeof container.scrollIntoView === 'function') {
            container.scrollIntoView({ block: 'center' })
          }
        } else {
          // selector / scrollable-ancestor / document：捲動容器至底部。
          container.scrollTop = container.scrollHeight
        }
      }

      // 動作 2：點擊底部「更多...」按鈕觸發官方分頁載入。
      // 與動作 1 並行而非二擇一——實機 selector 策略恆優先命中容器，
      // 若僅靠 strategy 分支則按鈕永不被點擊，首批 96 無法展開（W1-040 根因）。
      // 按鈕在全部載入完成後消失，findLoadMoreButton 回傳 null 時略過。
      this._clickLoadMoreButton()
    },

    /**
     * 尋找並點擊底部「更多...」按鈕（W1-040，可注入私有方法）
     *
     * 由 _scrollStep 每輪呼叫。按鈕不存在（全部載入完成或頁面結構不符）
     * 時靜默略過——此為正常終止情境，非錯誤。點擊前先捲入視野，
     * 確保虛擬捲動容器內的按鈕可被點擊。
     *
     * 抽為獨立方法以支援 Phase 2 測試以 jest.spyOn 注入驗證點擊行為。
     */
    _clickLoadMoreButton () {
      const loadMoreBtn = this.findLoadMoreButton()
      if (!loadMoreBtn) return

      if (typeof loadMoreBtn.scrollIntoView === 'function') {
        loadMoreBtn.scrollIntoView({ block: 'center' })
      }
      if (typeof loadMoreBtn.click === 'function') {
        loadMoreBtn.click()
      }
    },

    /**
     * 量測當下 DOM 內所有書籍的識別符（W1-030，可注入私有方法）
     *
     * 對當下 DOM 的每個 .library-item 解析其書籍 ID（優先 privacy ID，
     * 沿用 adapter 既有解析邏輯）。回傳該輪 DOM 內所有 book ID 陣列，
     * 由 loadAllBooksLazy 累積為 unique Set。抽為獨立方法以支援測試注入。
     *
     * @returns {string[]} 當下 DOM 內所有 .library-item 的書籍 ID 陣列
     */
    _measureBooks () {
      const document = getDocument()
      if (!document) return []

      const items = document.querySelectorAll(SELECTORS.bookContainer)
      const ids = []
      for (const item of items) {
        // 優先 privacy ID（Readmoo 內部真實 book ID，最穩定）
        const privacyId = this.extractBookIdFromPrivacy(item)
        if (privacyId) {
          ids.push(privacyId)
          continue
        }
        // 退回 reader link href ID
        const { readerId } = this.extractHrefFromElement(item)
        if (readerId) {
          ids.push(readerId)
        }
      }
      return ids
    },

    /**
     * 提取前程式化捲動 library 容器，反覆觸發虛擬捲動 lazy load（W1-030）
     *
     * 解決 Vue/React SPA 虛擬捲動導致書庫提取涵蓋不全的問題：
     * DOM 任一時刻僅渲染約 96 個 .library-item，提取前需先捲動載入全部書籍。
     *
     * 演算法：反覆「捲動 → 等待新項目渲染 → 量測累積 unique 書籍數」直到
     * 達可見書目數、連續數輪無進展、或達上限/逾時。loadedCount 採累積
     * unique book ID Set（對 DOM 回收式虛擬捲動天然免疫，天然去重）。
     *
     * 防無限迴圈（4 個獨立停止條件，任一成立即跳出迴圈）：
     * (a) reached_total：loadedCount >= expectedTotal（expectedTotal 非 null 時）
     * (b) count_stable：連續 stableRounds 輪「無進展」（loadedCount 未增加）
     * (c) max_iterations：iterations >= maxIterations（輪數硬上限）
     * (d) timeout：累計耗時 >= overallTimeoutMs（單輪 hang 硬上限）
     *
     * W1-033 R1：原以 stableCount（計數面）與 ineffectiveScrollCount
     * （捲動位置面）兩個計數器測量同一件事——「這一輪有無進展」，且兩者
     * 皆觸發 count_stable。合併為單一「無進展輪數」計數器：只要該輪
     * loadedCount 未增加即視為無進展，連續 stableRounds 輪即 count_stable。
     *
     * 此方法永遠 resolve（不 reject）：捲動容器找不到或捲動例外時降級回傳，
     * 不讓提取流程整體失敗。
     *
     * @param {Object} [scrollOptions={}] - 捲動選項
     * @param {number} [scrollOptions.maxIterations=30] - 捲動輪數上限（1-100）
     * @param {number} [scrollOptions.stableRounds=3] - 連續穩定輪數（2-5）
     * @param {number} [scrollOptions.renderWaitMs=800] - 每輪渲染等待上限毫秒（200-3000）
     * @param {number} [scrollOptions.overallTimeoutMs=60000] - 整體逾時上限毫秒（5000-120000）
     * @returns {Promise<Object>} LoadAllBooksResult：loadedCount / expectedTotal /
     *   coverageComplete / missingCount / stopReason / iterations / durationMs
     */
    async loadAllBooksLazy (scrollOptions = {}) {
      const startTime = Date.now()
      const maxIterations = scrollOptions.maxIterations || 30
      const stableRounds = scrollOptions.stableRounds || 3
      const renderWaitMs = scrollOptions.renderWaitMs || 800
      const overallTimeoutMs = scrollOptions.overallTimeoutMs || 60000

      // 解析可見書目數（停止條件 a 的目標值；null 時改依連續穩定停止）
      const { total: expectedTotal } = this.parseLibraryTotal()

      // 累積 unique book ID Set（對 DOM 回收式虛擬捲動天然免疫）
      const bookIdSet = new Set()
      let iterations = 0
      let stopReason = ''

      // R5：讀取容器 scrollTop 的容錯 helper（原 try/catch 重複 4 處抽為單一函式）。
      // 某些環境讀取 scrollTop 可能拋例外；失敗時回傳 null 不中斷捲動流程。
      const readScrollTop = (el) => {
        try {
          return el.scrollTop ?? null
        } catch (readError) {
          return null
        }
      }

      // 結束時統一輸出涵蓋率日誌與還原捲動位置的收尾函式
      const finalize = (reason, restoreContainer, originalScrollTop) => {
        // 捲動位置還原為 best-effort（D5）：失敗不影響提取結果
        if (restoreContainer && originalScrollTop !== null) {
          try {
            restoreContainer.scrollTop = originalScrollTop
          } catch (restoreError) {
            logger.debug('SCROLL_POSITION_RESTORE_FAILED', { error: restoreError.message })
          }
        }

        const loadedCount = bookIdSet.size
        const coverageComplete = expectedTotal !== null && loadedCount >= expectedTotal
        const missingCount = expectedTotal !== null
          ? Math.max(0, expectedTotal - loadedCount)
          : 0
        const durationMs = Date.now() - startTime

        const result = {
          loadedCount,
          expectedTotal,
          coverageComplete,
          missingCount,
          stopReason: reason,
          iterations,
          durationMs
        }

        logger.info('SCROLL_LOAD_COMPLETED', result)

        if (!coverageComplete) {
          logger.warn('COVERAGE_INCOMPLETE', {
            missingCount,
            stopReason: reason,
            reason: this.describeStopReason(reason)
          })
        }

        return result
      }

      try {
        // 辨識捲動容器
        const { container, strategy } = this.findScrollContainer()
        if (!container || strategy === 'none') {
          // 降級：捲動容器找不到，量測當下 DOM 後回傳現行行為
          const initialIds = this._measureBooks()
          initialIds.forEach(id => bookIdSet.add(id))
          logger.warn('SCROLL_CONTAINER_NOT_FOUND', {
            loadedCount: bookIdSet.size,
            message: '捲動容器辨識失敗，降級為現行提取行為'
          })
          return finalize('container_not_found', null, null)
        }

        // 記錄起始捲動位置（D5 還原用）
        const originalScrollTop = readScrollTop(container)

        // 首次量測：判定是否首批即完整（already_complete）
        const firstIds = this._measureBooks()
        firstIds.forEach(id => bookIdSet.add(id))
        if (expectedTotal !== null && bookIdSet.size >= expectedTotal) {
          return finalize('already_complete', container, originalScrollTop)
        }

        // 捲動主迴圈：單一「無進展輪數」計數器（R1 合併 stableCount 與
        // ineffectiveScrollCount——兩者皆測量「這一輪 loadedCount 有無增加」）。
        let noProgressRounds = 0
        let prevCount = bookIdSet.size

        // 迴圈以四個停止條件控制（任一成立即跳出），不再用 maxIterations
        // 作迴圈條件＋迴圈內二次判定（R5：原 maxIterations 三處判定收斂為單一出口）。
        while (true) {
          // 停止條件 (d)：整體逾時
          if (Date.now() - startTime >= overallTimeoutMs) {
            stopReason = 'timeout'
            break
          }

          // 執行單輪捲動
          this._scrollStep(container, strategy)
          iterations++

          // 等待新項目渲染（MutationObserver 提早結束 + renderWaitMs 上限）
          await this.waitForRenderSettle(container, renderWaitMs, overallTimeoutMs - (Date.now() - startTime))

          // 量測累積 unique 書籍數
          const roundIds = this._measureBooks()
          roundIds.forEach(id => bookIdSet.add(id))
          const currentCount = bookIdSet.size

          // 停止條件 (a)：達可見書目數
          if (expectedTotal !== null && currentCount >= expectedTotal) {
            stopReason = 'reached_total'
            break
          }

          // 停止條件 (b)：連續無進展（loadedCount 未增加即視為無進展，
          // 涵蓋「捲動有效但已無新書」與「捲動對此頁面無效」兩種情況）
          if (currentCount === prevCount) {
            noProgressRounds++
            if (noProgressRounds >= stableRounds) {
              stopReason = 'count_stable'
              break
            }
          } else {
            noProgressRounds = 0
          }

          prevCount = currentCount

          // 停止條件 (c)：達輪數上限
          if (iterations >= maxIterations) {
            stopReason = 'max_iterations'
            break
          }
        }

        return finalize(stopReason, container, originalScrollTop)
      } catch (error) {
        // 捲動或量測過程拋例外：終止迴圈，以已累積書籍繼續（不整體失敗）
        logger.error('SCROLL_LOAD_ERROR', {
          error: error.message,
          component: 'ReadmooAdapter',
          loadedCount: bookIdSet.size,
          iterations
        })
        return finalize('error', null, null)
      }
    },

    /**
     * 在指定元素上掛 MutationObserver 監聽子節點新增（W1-033 R2 共用 helper）
     *
     * waitForBookElements 與 waitForRenderSettle 原各自重複「建立 observer →
     * try-catch observe childList/subtree → 失敗回 null」的模式，抽為單一 helper。
     *
     * @param {HTMLElement} target - 監聽目標元素
     * @param {Function} onMutation - 偵測到子節點變化時的回呼
     * @param {string} failLogEvent - observe 失敗時的 logger.debug 事件名
     * @returns {MutationObserver|null} 建立成功的 observer，環境不支援或失敗時為 null
     */
    _observeChildListOnce (target, onMutation, failLogEvent) {
      if (typeof MutationObserver === 'undefined' || !target || target.nodeType !== 1) {
        return null
      }
      try {
        const observer = new MutationObserver(onMutation)
        observer.observe(target, { childList: true, subtree: true })
        return observer
      } catch (observeError) {
        logger.debug(failLogEvent, { error: observeError.message })
        return null
      }
    },

    /**
     * 等待新書籍項目渲染（W1-030 混合式渲染等待）
     *
     * 固定 renderWaitMs 上限 + MutationObserver 提早結束混合策略：
     * 監聽書籍渲染區域的子節點新增，偵測到新節點即提早結束；
     * 若 renderWaitMs 內無新增則逾時結束本輪。此設計避免固定等待在慢網路下
     * 「等不夠」誤觸發 count_stable，也避免快網路下無謂等滿上限。
     *
     * W1-033 R2：監聽目標改為書籍實際渲染區域（document.body），而非傳入的
     * scrollContainer。load-more-button 策略下 scrollContainer 是按鈕元素，
     * 在按鈕上掛 MutationObserver 永不觸發，混合等待會退回 renderWaitMs
     * 固定逾時、失去提早結束效益。新書 .library-item 渲染在 body 子樹內，
     * 監聽 body 對所有策略皆有效。
     *
     * @param {HTMLElement} container - 捲動容器（保留參數相容；實際監聽 body）
     * @param {number} renderWaitMs - 渲染等待上限毫秒
     * @param {number} remainingTimeoutMs - 距整體逾時的剩餘毫秒（取較小值為上限）
     * @returns {Promise<void>}
     */
    async waitForRenderSettle (container, renderWaitMs, remainingTimeoutMs) {
      const waitMs = Math.max(0, Math.min(renderWaitMs, remainingTimeoutMs))
      if (waitMs === 0) return

      return new Promise((resolve) => {
        let settled = false
        let observer = null
        let timeoutId = null

        const cleanup = () => {
          if (observer) {
            observer.disconnect()
            observer = null
          }
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
        }

        const done = () => {
          if (settled) return
          settled = true
          cleanup()
          resolve()
        }

        // 策略 1：MutationObserver 偵測書籍渲染區域新節點提早結束。
        // 監聽 document.body：新書渲染於此子樹，對所有捲動策略（含按鈕）皆有效。
        const document = getDocument()
        const observeTarget = document ? (document.body || document.documentElement) : null
        observer = this._observeChildListOnce(observeTarget, () => done(), 'RENDER_SETTLE_OBSERVER_FAILED')

        // 策略 2：固定 renderWaitMs 上限逾時結束
        timeoutId = setTimeout(done, waitMs)
      })
    },

    /**
     * 將停止原因枚舉轉為可讀說明（W1-030 涵蓋率診斷日誌用）
     *
     * @param {string} stopReason - loadAllBooksLazy 的 stopReason 枚舉值
     * @returns {string} 可讀說明
     */
    describeStopReason (stopReason) {
      const descriptions = {
        reached_total: '捲動後已達可見書目數',
        already_complete: '首批渲染即達可見書目數，未進入捲動',
        count_stable: '捲動到底後書籍數連續穩定但未達可見書目數',
        max_iterations: '達捲動輪數上限仍未達可見書目數',
        timeout: '達整體逾時上限仍未達可見書目數',
        container_not_found: '捲動容器辨識失敗，僅提取已渲染書籍',
        error: '捲動過程發生例外，以已載入書籍繼續'
      }
      return descriptions[stopReason] || stopReason
    },

    /**
     * 從容器元素提取 href（容錯：找不到 readerLink 時回傳空字串）
     *
     * @param {HTMLElement} element - 書籍容器元素
     * @returns {Object} { href: string, readerId: string }
     */
    extractHrefFromElement (element) {
      // 從容器中查找閱讀器連結（容器可能本身就是連結）
      let readerLink = element.querySelector(SELECTORS.readerLink)
      if (!readerLink && element.matches && element.matches(SELECTORS.readerLink)) {
        readerLink = element
      }

      if (!readerLink) {
        logger.warn('READER_LINK_NOT_FOUND', { elementClass: element.className })
        return { href: '', readerId: '' }
      }

      const rawHref = readerLink.getAttribute('href') || ''

      // 安全檢查 - 不安全的 URL 清空但不丟棄整筆
      // 傳入 location.origin 作 base，使相對路徑 reader link（如 /api/reader/abc123）
      // 能被正確解析而非誤判為 unsafe（W1-012 / W1-010 同源修復）
      // 若不傳 base，單參數 new URL() 對相對路徑 throw → 誤判 unsafe → href 清空
      // → readerId 退化為 fallback ID（如 privacy ID 或硬編碼）
      const hrefBase = getLocation().origin
      if (rawHref && this.isUnsafeUrl(rawHref, hrefBase)) {
        logger.warn('UNSAFE_URL_FILTERED', { url: rawHref })
        return { href: '', readerId: '' }
      }

      const readerId = this.extractBookId(rawHref)
      return { href: rawHref, readerId }
    },

    /**
     * 從容器元素的 privacy 子元素提取書籍 ID
     *
     * Readmoo DOM 結構中，每本書包含 <div class="privacy" id="privacy-{bookId}">，
     * 其中 {bookId} 是該書的唯一數字 ID。此方法作為 reader link href 的替代 ID 來源，
     * 解決 SPA 佔位 URL 導致所有書籍共用同一 href 的問題。
     *
     * @param {HTMLElement} element - 書籍容器元素
     * @returns {string} 書籍 ID（純數字字串），找不到時回傳空字串
     */
    extractBookIdFromPrivacy (element) {
      try {
        const privacyEl = element.querySelector(SELECTORS.privacyElement)
        if (!privacyEl) return ''

        const idAttr = privacyEl.getAttribute('id') || ''
        // 格式：privacy-{數字ID}
        const match = idAttr.match(/^privacy-(\d+)$/)
        return match ? match[1] : ''
      } catch (error) {
        logger.warn('PRIVACY_ID_EXTRACTION_FAILED', { error: error.message })
        return ''
      }
    },

    /**
     * 判斷 href 是否為 SPA 佔位 URL（所有書籍共用的假連結）
     *
     * Readmoo SPA 初始載入時，所有 reader-link 的 href 可能共用同一個
     * 佔位 URL（如 /api/reader/210017268000101）。此方法用於偵測這種情況，
     * 觸發 privacy ID 等替代策略取得真實書籍 ID。
     *
     * 設計考量：只有在同一批次中所有 href 都相同時才認為是佔位 URL。
     * 單一元素層級無法判斷，因此此方法僅檢查格式特徵。
     * 實際的佔位偵測由 parseBookElement 中配合 privacy ID 進行。
     *
     * @param {string} href - reader link 的 href 值
     * @returns {boolean} 是否符合佔位 URL 格式
     */
    isPlaceholderUrl (href) {
      if (!href) return false
      return PLACEHOLDER_URL_PATTERN.test(href)
    },

    /**
     * 從容器元素提取封面和標題（容錯：各欄位獨立 fallback）
     *
     * @param {HTMLElement} element - 書籍容器元素
     * @returns {Object} { cover: string, title: string }
     */
    extractCoverAndTitle (element) {
      // 從容器中查找封面圖片
      const img = element.querySelector(SELECTORS.bookImage) || element.querySelector('img')
      let cover = img ? img.getAttribute('src') || '' : ''
      let title = ''

      // 提取標題 - 優先從標題元素，備用從圖片 alt
      const titleElement = element.querySelector(SELECTORS.bookTitle)
      if (titleElement) {
        title = titleElement.textContent?.trim() || titleElement.getAttribute('title')?.trim() || ''
      } else if (img) {
        title = img.getAttribute('alt')?.trim() || img.getAttribute('title')?.trim() || ''
      }

      // 安全檢查 - 過濾惡意圖片URL
      // 收集不安全 URL，在 extractAllBooks() 完成後批量彙整輸出
      // 傳入 location.origin 作 base，使相對路徑封面 URL（如 /cover/abc/xyz.jpg）
      // 能被正確解析而非誤判為 unsafe（W1-010 / W1-006 根因修復）
      const coverBase = getLocation().origin
      if (cover && this.isUnsafeUrl(cover, coverBase)) {
        if (!this._unsafeUrlCount) this._unsafeUrlCount = 0
        this._unsafeUrlCount++
        cover = ''
      }

      return { cover, title }
    },

    /**
     * 檢查是否有足夠的必要欄位保留此書籍記錄
     * 需求：至少有 title 或任何來源的 ID
     *
     * @param {string} title - 書籍標題
     * @param {string} readerId - 閱讀器連結 ID
     * @param {string} cover - 封面 URL
     * @returns {boolean} 是否應保留
     */
    hasRequiredFields (title, readerId, cover) {
      const hasTitle = Boolean(title && title.trim())
      const hasReaderId = Boolean(readerId && readerId.trim())
      const hasCoverId = Boolean(this.extractCoverIdFromUrl(cover))
      return hasTitle || hasReaderId || hasCoverId
    },

    /**
     * 解析書籍容器元素（容錯策略：必要/可選欄位分離）
     *
     * 容錯規則：
     * - readerLink 找不到：繼續從其他元素提取 title/cover
     * - href 不安全：清空 href 但不丟棄整筆
     * - extractBookId 失敗：使用 title-based 或 cover-based ID 作為 fallback
     * - 最終檢查：title 和所有 ID 來源都為空才 return null
     *
     * @param {HTMLElement} element - 書籍容器元素
     * @returns {Object|null} 書籍資料物件
     */
    parseBookElement (element) {
      const startTime = performance.now()

      try {
        // 步驟 1：提取 href 和 readerId（容錯：失敗時回傳空字串）
        const { href, readerId } = this.extractHrefFromElement(element)

        // 步驟 1.5：從 privacy 元素提取真實書籍 ID
        // 解決 SPA 佔位 URL 問題 — 所有書籍共用同一 href
        const privacyBookId = this.extractBookIdFromPrivacy(element)

        // 決定有效的書籍 ID 和 URL：
        // 佔位 URL 偵測策略：當 privacy ID 存在且與 href 中的 ID 不同時，
        // 表示 href 是 SPA 佔位值（所有書共用同一 href，但每本書有獨立的 privacy ID）。
        // 此時用 privacy ID 取代 href 的 ID 並構建正確的 URL。
        let effectiveReaderId = readerId
        let effectiveUrl = href

        if (privacyBookId) {
          // privacy ID 存在 — 始終優先作為書籍識別碼
          effectiveReaderId = privacyBookId

          // 偵測佔位 URL：privacy ID 與 href 中的 reader ID 不同
          const isPlaceholder = readerId && readerId !== privacyBookId
          if (isPlaceholder || !href) {
            // href 是佔位值或為空 — 用 privacy ID 構建真實 reader URL
            effectiveUrl = `https://readmoo.com/api/reader/${privacyBookId}`
            if (isPlaceholder) {
              // 收集佔位 URL 替換計數，在 extractAllBooks() 完成後批量彙整輸出
              if (!this._placeholderUrlCount) this._placeholderUrlCount = 0
              this._placeholderUrlCount++
            }
          }
        }

        // 步驟 2：提取封面和標題（容錯：各欄位獨立 fallback）
        const { cover, title } = this.extractCoverAndTitle(element)

        // 步驟 3：最終必要欄位檢查 — 至少有 title 或任何 ID 來源
        if (!this.hasRequiredFields(title, effectiveReaderId, cover)) {
          logger.warn('BOOK_INSUFFICIENT_DATA', {
            elementClass: element.className,
            hasTitle: Boolean(title),
            hasReaderId: Boolean(effectiveReaderId),
            hasCover: Boolean(cover)
          })
          return null
        }

        // 步驟 4：提取可選欄位（失敗留預設值）
        const progressData = this.extractProgressFromContainer(element)
        const bookType = this.extractBookTypeFromContainer(element)

        // 步驟 5：生成穩定的書籍 ID（使用所有可用來源）
        const idInfo = this.generateStableBookIdWithInfo(effectiveReaderId, title, cover)

        // 建立完整的書籍資料物件
        const bookData = {
          id: idInfo.id,
          title: this.sanitizeText(title) || '未知標題',
          cover: cover || '',
          progress: progressData.progress,
          type: bookType || '未知',
          extractedAt: new Date().toISOString(),
          url: effectiveUrl,
          source: 'readmoo',

          // 提取的完整識別資訊
          identifiers: {
            readerLinkId: effectiveReaderId,
            privacyBookId: privacyBookId || '',
            coverId: this.extractCoverIdFromUrl(cover),
            titleBased: this.generateTitleBasedId(title),
            primarySource: idInfo.strategy
          },

          // 完整的封面資訊
          coverInfo: {
            url: cover,
            filename: this.extractFilenameFromUrl(cover),
            domain: this.extractDomainFromUrl(cover)
          },

          // 額外資訊
          progressInfo: progressData,
          extractedFrom: 'content-script'
        }

        stats.parseTime += performance.now() - startTime
        return bookData
      } catch (error) {
        logger.warn('BOOK_PARSE_ELEMENT_FAILED', {
          error: error.message,
          elementTag: element?.tagName || 'unknown',
          elementClass: element?.className || 'unknown'
        })
        stats.failedExtractions++
        stats.parseTime += performance.now() - startTime
        return null
      }
    },

    /**
     * 提取所有書籍
     *
     * @returns {Promise<Object[]>} 書籍資料陣列
     */
    async extractAllBooks () {
      const extractionStart = performance.now()

      // W1-030：提取前先捲動載入全部書籍，解決 SPA 虛擬捲動 lazy load
      // 導致涵蓋不全（單次僅約 96/928）的問題。loadAllBooksLazy 永遠 resolve，
      // 即使捲動失敗也降級回傳，不讓提取流程整體失敗。
      const loadResult = await this.loadAllBooksLazy()

      // 使用 waitForBookElements 作為降級路徑安全網（R6）：
      // 捲動成功路徑下 DOM 已就緒，waitForBookElements 立即 resolve；
      // 捲動降級（container_not_found / error）時確保至少有書籍元素可提取。
      const bookElements = await this.waitForBookElements({ timeoutMs: 5000 })
      const books = []

      stats.totalExtracted = bookElements.length
      stats.successfulExtractions = 0
      stats.failedExtractions = 0

      // 批量處理 (優化：避免阻塞主執行緒)
      const batchSize = 10
      for (let i = 0; i < bookElements.length; i += batchSize) {
        const batch = bookElements.slice(i, i + batchSize)

        for (const element of batch) {
          try {
            const bookData = this.parseBookElement(element)
            if (bookData) {
              books.push(bookData)
              stats.successfulExtractions++
            }
          } catch (error) {
            stats.failedExtractions++
            logger.error('BOOK_BATCH_PARSE_FAILED', { error: error.message })
          }
        }

        // 讓渡控制權給瀏覽器 (防止頁面凍結)
        if (i + batchSize < bookElements.length) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      }

      // 批量彙整不安全封面 URL 警告（避免逐筆輸出洗版 console）
      if (this._unsafeUrlCount > 0) {
        logger.warn('UNSAFE_COVER_URL_FILTERED', {
          totalFiltered: this._unsafeUrlCount,
          message: `${this._unsafeUrlCount} 個不安全的封面網址已過濾`
        })
        this._unsafeUrlCount = 0
      }

      // 批量彙整佔位 URL 替換日誌（避免逐筆輸出洗版 console）
      if (this._placeholderUrlCount > 0) {
        logger.info('PLACEHOLDER_URL_REPLACED', {
          totalReplaced: this._placeholderUrlCount,
          message: `${this._placeholderUrlCount} 個佔位 URL 已替換為 privacy ID`
        })
        this._placeholderUrlCount = 0
      }

      stats.lastExtraction = Date.now()
      const totalTime = performance.now() - extractionStart

      // 詳細的提取結果日誌（W1-030：併入捲動載入涵蓋率欄位）
      logger.info('EXTRACTION_COMPLETED', {
        extracted: books.length,
        total: bookElements.length,
        duration: totalTime.toFixed(2) + 'ms',
        successful: stats.successfulExtractions,
        failed: stats.failedExtractions,
        expectedTotal: loadResult.expectedTotal,
        coverageComplete: loadResult.coverageComplete
      })

      // 診斷日誌：印出前 3 本書的資料摘要
      if (books.length > 0) {
        const sample = books.slice(0, 3).map(b => ({
          id: b.id,
          title: b.title,
          url: b.url ? b.url.substring(0, 50) : '無',
          cover: b.cover ? '有' : '無'
        }))
        logger.info('EXTRACTION_SAMPLE_DATA', {
          totalBooks: books.length,
          sampleBooks: sample
        })
      }

      if (bookElements.length === 0) {
        logger.warn('NO_BOOK_ELEMENTS_FOUND', {
          possibleReasons: [
            '頁面尚未完全載入',
            'Readmoo 變更了頁面結構',
            'CSS 選擇器需要更新',
            '不是書庫或書架頁面'
          ]
        })
      } else if (books.length === 0) {
        logger.error('BOOK_CONTAINERS_PARSE_FAILED', {
          possibleReasons: [
            '容器結構不符合預期',
            '缺少必要的子元素',
            'URL 或圖片格式不符合'
          ]
        })
      } else if (books.length < bookElements.length) {
        logger.warn('PARTIAL_EXTRACTION_FAILURE', {
          failed: stats.failedExtractions,
          total: bookElements.length
        })
      }

      // 在開發模式下輸出第一本書的詳細資訊
      if (books.length > 0 && globalThis.DEBUG_MODE) {
        logger.debug('FIRST_BOOK_SAMPLE', { book: books[0] })
      }

      return books
    },

    /**
     * 檢查URL是否不安全
     *
     * 支援相對路徑：傳入 base 時以 new URL(url, base) 解析，使相對路徑
     * （如 /cover/abc/xyz.jpg）能正確判定協議與遍歷風險。未傳 base 時，
     * 相對路徑會在 new URL() throw 後被歸為 unsafe（向後相容舊行為）。
     *
     * 路徑遍歷檢查刻意對「原始輸入字串」進行，而非解析後的 pathname：
     * new URL(url, base) 會將 .. 正規化消除（/a/../b 變成 /b），若只檢查
     * 解析後 pathname 將遺漏遍歷攻擊。
     *
     * @param {string} url - 要檢查的URL（可為絕對 URL 或相對路徑）
     * @param {string} [base] - 解析相對路徑用的 base URL（如 location.origin）
     * @returns {boolean} 是否不安全
     */
    isUnsafeUrl (url, base) {
      if (!url || typeof url !== 'string') {
        return true
      }

      // 路徑遍歷檢查 - 對原始字串進行，避免 new URL 正規化掩蓋遍歷
      const lowerUrl = url.toLowerCase()
      if (lowerUrl.includes('..') || lowerUrl.includes('%2e%2e')) {
        return true
      }

      try {
        const urlObj = base ? new URL(url, base) : new URL(url)
        const protocol = urlObj.protocol.toLowerCase()

        // 只允許 https 和 http 協議
        if (protocol !== 'https:' && protocol !== 'http:') {
          return true
        }

        return false
      } catch (error) {
        return true
      }
    },

    /**
     * 提取書籍ID
     *
     * @param {string} href - 書籍連結
     * @returns {string} 書籍ID
     */
    extractBookId (href) {
      // 快取正則表達式
      if (!this._idRegexCache) {
        this._idRegexCache = {
          apiReader: /\/api\/reader\/([^/?#]+)/,
          bookPath: /\/book\/([^/?#]+)/
        }
      }

      let match = href.match(this._idRegexCache.apiReader)
      if (match) return match[1]

      match = href.match(this._idRegexCache.bookPath)
      if (match) return match[1]

      return ''
    },

    /**
     * 從容器提取進度資訊
     *
     * @param {HTMLElement} element - 書籍容器元素
     * @returns {Object} 進度資訊物件
     */
    extractProgressFromContainer (element) {
      try {
        // 查找進度條元素
        const progressBar = element.querySelector(SELECTORS.progressBar)
        if (!progressBar) {
          return { progress: 0, progressText: '', hasProgress: false }
        }

        // 從樣式中提取進度百分比
        const style = progressBar.getAttribute('style') || ''
        let progressPercent = 0

        const widthMatch = style.match(/width:\s*(\d+(?:\.\d+)?)%/)
        if (widthMatch) {
          progressPercent = Math.round(parseFloat(widthMatch[1]))
        }

        // 提取進度文字
        let progressText = progressBar.textContent?.trim() || ''
        if (!progressText) {
          // 備用：從兄弟元素查找進度文字
          const progressTextEl = element.querySelector('.progress-text, .reading-progress, [class*="progress"]')
          if (progressTextEl) {
            progressText = progressTextEl.textContent?.trim() || ''
          }
        }

        return {
          progress: progressPercent,
          progressText,
          hasProgress: true,
          progressStyle: style
        }
      } catch (error) {
        return { progress: 0, progressText: '', hasProgress: false }
      }
    },

    /**
     * 從容器提取書籍類型
     *
     * @param {HTMLElement} element - 書籍容器元素
     * @returns {string} 書籍類型
     */
    extractBookTypeFromContainer (element) {
      try {
        // 查找書籍類型元素
        const typeElement = element.querySelector(SELECTORS.renditionType)
        if (typeElement) {
          const typeText = typeElement.textContent?.trim()
          if (typeText) {
            return typeText
          }
        }

        // 備用：查找其他可能的類型指示器
        const altTypeElement = element.querySelector('.book-type, .type, [class*="rendition"], [class*="type"]')
        if (altTypeElement) {
          return altTypeElement.textContent?.trim() || '未知'
        }

        return '未知'
      } catch (error) {
        return '未知'
      }
    },

    /**
     * 生成穩定的書籍 ID
     *
     * @param {string} readerId - 閱讀器連結 ID
     * @param {string} title - 書籍標題
     * @param {string} cover - 封面 URL
     * @returns {string} 穩定的書籍 ID
     */
    generateStableBookId (readerId, title, cover) {
      return this.generateStableBookIdWithInfo(readerId, title, cover).id
    },

    /**
     * 生成穩定的書籍 ID 並返回策略資訊
     *
     * @param {string} readerId - 閱讀器連結 ID
     * @param {string} title - 書籍標題
     * @param {string} cover - 封面 URL
     * @returns {Object} {id: string, strategy: string} ID 和使用的策略
     */
    generateStableBookIdWithInfo (readerId, title, cover) {
      return this.handleWithFallback(
        'generateStableBookIdWithInfo',
        () => {
          const inputs = this.validateAndSanitizeInputs(readerId, title, cover)
          return this.applyIdGenerationStrategiesWithInfo(inputs)
        },
        {
          id: readerId ? `reader-${readerId}` : 'reader-undefined',
          strategy: 'reader-link'
        }
      )
    },

    /**
     * 驗證並安全化輸入參數
     *
     * @param {string} readerId - 閱讀器連結 ID
     * @param {string} title - 書籍標題
     * @param {string} cover - 封面 URL
     * @returns {Object} 安全化後的輸入參數物件
     */
    validateAndSanitizeInputs (readerId, title, cover) {
      return {
        readerId: this.safeStringify(readerId),
        title: this.safeStringify(title),
        cover: this.safeStringify(cover)
      }
    },

    /**
     * 按優先級應用ID生成策略
     *
     * @param {Object} inputs - 安全化的輸入參數
     * @returns {string} 生成的書籍 ID
     */
    applyIdGenerationStrategies (inputs) {
      return this.applyIdGenerationStrategiesWithInfo(inputs).id
    },

    /**
     * 按優先級應用ID生成策略（含策略資訊）
     *
     * @param {Object} inputs - 安全化的輸入參數
     * @returns {Object} {id: string, strategy: string}
     */
    applyIdGenerationStrategiesWithInfo (inputs) {
      // W6-012.2.1：策略優先級重排為 reader-link → cover → title → fallback
      // 原因：privacy 反查需要穩定 reader id，cover-XXX 無法用於深連結 / 書城跳轉
      const readerResult = this.tryReaderStrategy(inputs)
      if (readerResult) {
        return {
          id: `reader-${inputs.readerId}`,
          strategy: 'reader-link'
        }
      }

      const coverResult = this.tryCoverStrategy(inputs)
      if (coverResult) {
        return { id: coverResult, strategy: 'cover' }
      }

      const titleResult = this.tryTitleStrategy(inputs)
      if (titleResult) {
        return { id: titleResult, strategy: 'title' }
      }

      return {
        id: this.createFallbackId(),
        strategy: 'fallback'
      }
    },

    /**
     * 嘗試封面ID生成策略
     *
     * @param {Object} inputs - 輸入參數
     * @returns {string|null} 封面ID或null
     */
    tryCoverStrategy ({ cover }) {
      if (!cover || !cover.trim()) return null
      const coverId = this.extractCoverIdFromUrl(cover)
      if (!coverId) return null
      // W6-012.2.1：過濾已知不穩定 / 佔位用 cover（openbook 等），避免覆蓋 reader 策略
      if (UNSTABLE_COVER_IDS.has(coverId)) return null
      return `cover-${coverId}`
    },

    /**
     * 嘗試標題ID生成策略
     *
     * @param {Object} inputs - 輸入參數
     * @returns {string|null} 標題ID或null
     */
    tryTitleStrategy ({ title }) {
      if (!title || !title.trim() || title.trim() === '未知標題') return null
      const titleId = this.generateTitleBasedId(title)
      return titleId ? `title-${titleId}` : null
    },

    /**
     * 嘗試閱讀器ID生成策略
     *
     * @param {Object} inputs - 輸入參數
     * @returns {string|null} 閱讀器ID或null
     */
    tryReaderStrategy ({ readerId }) {
      return readerId && readerId.trim() ? `reader-${readerId}` : null
    },

    /**
     * 創建降級ID
     *
     * @returns {string} 默認的降級ID
     */
    createFallbackId () {
      return 'reader-undefined'
    },

    /**
     * 檢查輸入是否為null或undefined
     * @param {*} input - 輸入值
     * @returns {boolean} 是否為null或undefined
     */
    isNullOrUndefined (input) {
      return input === null || input === undefined
    },

    /**
     * 檢查輸入是否為字符串類型
     * @param {*} input - 輸入值
     * @returns {boolean} 是否為字符串
     */
    isStringType (input) {
      return typeof input === 'string'
    },

    /**
     * 檢查是否為需要特殊處理的類型
     * @param {*} input - 輸入值
     * @returns {boolean} 是否需要特殊處理
     */
    requiresSpecialHandling (input) {
      const type = typeof input
      return type === 'boolean' || type === 'object' || type === 'number'
    },

    /**
     * 安全轉換為字符串
     * @param {*} input - 輸入值
     * @returns {string} 轉換後的字符串
     */
    safeConvertToString (input) {
      return this.handleWithFallback(
        'safeConvertToString',
        () => String(input),
        ''
      )
    },

    /**
     * 安全字符串化處理
     * @param {*} input - 任何類型的輸入
     * @returns {string} 安全的字符串
     */
    safeStringify (input) {
      if (this.isNullOrUndefined(input)) return ''
      if (this.isStringType(input)) return input
      if (this.requiresSpecialHandling(input)) return ''
      return this.safeConvertToString(input)
    },

    /**
     * 驗證封面URL輸入
     * @param {string} coverUrl - 封面URL
     * @returns {string|null} 驗證後的URL或null
     */
    validateCoverUrlInput (coverUrl) {
      if (!coverUrl || typeof coverUrl !== 'string') return null
      const trimmed = coverUrl.trim()
      return this.isUnsafeUrl(trimmed) ? null : trimmed
    },

    /**
     * 驗證Readmoo域名
     * @param {string} url - URL
     * @returns {boolean} 是否為Readmoo封面URL
     */
    validateReadmooDomain (url) {
      return this.handleWithFallback(
        'validateReadmooDomain',
        () => {
          const urlObj = new URL(url)
          return urlObj.hostname === 'cdn.readmoo.com' && urlObj.pathname.includes('/cover/')
        },
        false
      )
    },

    /**
     * 從封面路徑提取ID
     * @param {string} coverUrl - 封面URL
     * @returns {string|null} 提取的ID或null
     */
    extractIdFromCoverPath (coverUrl) {
      const coverMatch = coverUrl.match(/\/cover\/[a-z0-9]+\/([^_]+)_/)
      return coverMatch ? coverMatch[1] : null
    },

    /**
     * 從檔名提取ID
     * @param {string} coverUrl - 封面URL
     * @returns {string|null} 提取的ID或null
     */
    extractIdFromFilename (coverUrl) {
      const filenameMatch = coverUrl.match(/\/([^/]+)\.(jpg|png|jpeg)/i)
      return filenameMatch ? filenameMatch[1].replace(/_\d+x\d+$/, '') : null
    },

    /**
     * 從封面 URL 提取 ID
     *
     * @param {string} coverUrl - 封面 URL
     * @returns {string|null} 封面 ID
     */
    extractCoverIdFromUrl (coverUrl) {
      const validatedUrl = this.validateCoverUrlInput(coverUrl)
      if (!validatedUrl) return null

      if (!this.validateReadmooDomain(validatedUrl)) return null

      return this.extractIdFromCoverPath(validatedUrl) ||
             this.extractIdFromFilename(validatedUrl) ||
             null
    },

    /**
     * 驗證標題輸入
     * @param {string} title - 書籍標題
     * @returns {string|null} 驗證後的標題或null
     */
    validateTitleInput (title) {
      if (!title || typeof title !== 'string') return null
      const trimmed = title.trim()
      return trimmed || null
    },

    /**
     * 清理HTML標籤和惡意內容
     * @param {string} text - 輸入文字
     * @returns {string} 清理後的文字
     */
    cleanHtmlAndMaliciousContent (text) {
      if (!text) return ''
      return text
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&[a-zA-Z0-9#]+;/g, '')
        .replace(/[<>"']/g, '')
    },

    /**
     * 處理URL編碼字符
     * @param {string} text - 輸入文字
     * @returns {string} 處理後的文字
     */
    processUrlEncoding (text) {
      if (!text) return ''
      return text
        .replace(/%20/g, ' ')
        .replace(/&amp;/g, '&')
    },

    /**
     * 正規化文字內容
     * @param {string} text - 輸入文字
     * @returns {string} 正規化後的文字
     */
    normalizeTextContent (text) {
      if (!text) return ''
      return text
        .replace(/\s+/g, ' ')
        .replace(/[^\u4e00-\u9fff\w\s]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
    },

    /**
     * 限制文字長度
     * @param {string} text - 輸入文字
     * @param {number} maxLength - 最大長度
     * @returns {string|null} 限制長度後的文字或null
     */
    limitTextLength (text, maxLength) {
      if (!text) return null
      return text.length > 0 ? text.substring(0, maxLength) : null
    },

    /**
     * 基於標題生成 ID
     *
     * @param {string} title - 書籍標題
     * @returns {string|null} 標題 ID
     */
    generateTitleBasedId (title) {
      return this.handleWithFallback(
        'generateTitleBasedId',
        () => {
          const validated = this.validateTitleInput(title)
          if (!validated) return null
          const cleaned = this.cleanHtmlAndMaliciousContent(validated)
          const urlProcessed = this.processUrlEncoding(cleaned)
          const normalized = this.normalizeTextContent(urlProcessed)
          return this.limitTextLength(normalized, 50)
        },
        null
      )
    },

    /**
     * 從 URL 提取檔名
     *
     * @param {string} url - URL
     * @returns {string|null} 檔名
     */
    extractFilenameFromUrl (url) {
      if (!url || typeof url !== 'string') {
        return null
      }

      try {
        const urlObj = new URL(url.trim())
        const pathname = urlObj.pathname
        const filename = pathname.split('/').pop()
        return filename?.split('?')[0] || null // 移除查詢參數
      } catch (error) {
        // 備用方法：使用正規表達式
        const match = url.match(/\/([^/]+\.(jpg|png|jpeg|gif|webp))(\?|$)/i)
        return match ? match[1] : null
      }
    },

    /**
     * 從 URL 提取域名
     *
     * @param {string} url - URL
     * @returns {string|null} 域名
     */
    extractDomainFromUrl (url) {
      if (!url || typeof url !== 'string') {
        return null
      }

      try {
        const urlObj = new URL(url.trim())
        return urlObj.hostname
      } catch (error) {
        return null
      }
    },

    /**
     * 標準化錯誤日誌記錄
     * @param {string} methodName - 方法名稱
     * @param {Error} error - 錯誤對象
     * @param {string} context - 額外上下文資訊
     */
    logError (methodName, error, context = '') {
      logger.warn('ADAPTER_METHOD_ERROR', {
        method: methodName,
        context,
        error: error.message,
        stack: error.stack
      })
    },

    /**
     * 標準化錯誤處理包裝器
     * @param {string} methodName - 方法名稱
     * @param {Function} operation - 要執行的操作
     * @param {*} fallbackValue - 錯誤時的回退值
     * @param {string} context - 額外上下文資訊
     * @returns {*} 操作結果或回退值
     */
    handleWithFallback (methodName, operation, fallbackValue, context = '') {
      try {
        return operation()
      } catch (error) {
        this.logError(methodName, error, context)
        return fallbackValue
      }
    },

    /**
     * 清理文字內容
     *
     * @param {string} text - 原始文字
     * @returns {string} 清理後的文字
     */
    sanitizeText (text) {
      if (!text) return ''

      return text
        .replace(/\s+/g, ' ') // 正規化空白字符
        .replace(/[<>'"]/g, '') // 移除潛在的HTML字符
        .trim()
    },

    /**
     * 取得統計資訊
     *
     * @returns {Object} 統計資料
     */
    getStats () {
      return {
        ...stats,
        // 別名兼容測試期望
        totalExtractions: stats.totalExtracted,
        successRate: stats.totalExtracted > 0
          ? (stats.successfulExtractions / stats.totalExtracted * 100).toFixed(2) + '%'
          : '0%',
        avgParseTime: stats.successfulExtractions > 0
          ? (stats.parseTime / stats.successfulExtractions).toFixed(2) + 'ms'
          : '0ms'
      }
    },

    /**
     * 標準化介面：解析文檔
     * @param {Document} document - DOM 文檔物件
     * @returns {Object} 解析結果物件 {isValid, bookElements}
     */
    parseDocument (document = globalThis.document) {
      try {
        const bookElements = this.getBookElements()
        return {
          isValid: true,
          bookElements
        }
      } catch (error) {
        return {
          isValid: false,
          bookElements: []
        }
      }
    },

    /**
     * 標準化介面：查找書籍容器 (測試期望的方法)
     * @param {Document} document - DOM 文檔物件
     * @returns {HTMLElement[]} 書籍容器元素陣列
     */
    findBookContainers (document = globalThis.document) {
      return this.getBookElements()
    },

    /**
     * 標準化介面：驗證頁面是否支援此適配器
     * @param {string} url - 頁面 URL
     * @returns {boolean} 是否支援
     */
    validatePage (url = getLocation().href || '') {
      try {
        const urlObj = new URL(url)
        const isReadmooHost = urlObj.hostname.includes('readmoo.com')
        const isLibraryPath = urlObj.pathname.includes('library')
        const isBookshelfPath = urlObj.pathname.includes('bookshelf') || urlObj.pathname.includes('shelf')

        return isReadmooHost && (isLibraryPath || isBookshelfPath)
      } catch (error) {
        return false
      }
    },

    /**
     * 標準化介面：獲取支援的 URL 模式
     * @returns {string[]} 支援的 URL 模式陣列
     */
    getSupportedUrls () {
      // W1-029.1: 真實書庫頁為 https://read.readmoo.com/#/library
      // （Vue SPA hash route）。Chrome match pattern 的 path 段不支援
      // URL fragment(#)，故不可硬編 /library；改放寬至 host 層級，
      // 由 detectPageType / validatePage 負責 hash route 細部判斷。
      return [
        'readmoo.com',
        'member.readmoo.com',
        '*://*.readmoo.com/*'
      ]
    },

    /**
     * 重置適配器狀態 (測試期望的方法)
     */
    reset () {
      stats.totalExtracted = 0
      stats.successfulExtractions = 0
      stats.failedExtractions = 0
      stats.domQueryTime = 0
      stats.parseTime = 0
      stats.lastExtraction = 0
      this.isInitialized = false
    },

    /**
     * 獲取適配器資訊 (測試期望的方法)
     * @returns {Object} 適配器資訊物件
     */
    getAdapterInfo () {
      return {
        name: this.name,
        version: this.version,
        supportedSites: ['readmoo.com', 'member.readmoo.com'],
        features: [
          'book-extraction',
          'progress-tracking',
          'cover-analysis',
          'batch-processing'
        ],
        config: this.config
      }
    }
  }

  // 設定構造函數名稱
  Object.defineProperty(adapter, 'constructor', {
    value: { name: 'ReadmooAdapter' },
    writable: false
  })

  return adapter
}

module.exports = createReadmooAdapter
