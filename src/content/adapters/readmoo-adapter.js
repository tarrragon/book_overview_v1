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

// 導入拆分模組
const {
  sanitizeText,
  cleanHtmlAndMaliciousContent,
  processUrlEncoding,
  normalizeTextContent,
  limitTextLength,
  isUnsafeUrl,
  extractFilenameFromUrl,
  extractDomainFromUrl,
  isNullOrUndefined,
  isStringType,
  requiresSpecialHandling,
  safeConvertToString,
  safeStringify,
  handleWithFallback
} = require('src/content/platform/adapter-utils')
const createStableIdGenerator = require('src/content/platform/stable-id-generator')
const createReadmooScrollLoader = require('src/content/adapters/readmoo-scroll-loader')

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
  COVER_SCROLL_FAILED: '封面整頁捲動觸發失敗 (segments: {segments})',
  COVER_SCROLL_COMPLETED: '封面整頁捲動完成 (segments: {segments}, reason: {reason}, converged: {converged}, finalPlaceholderCount: {finalPlaceholderCount})',
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
  const logger = options.logger || new Logger('ReadmooAdapter', 'INFO', readmooAdapterMessages)
  const stats = {
    totalExtracted: 0,
    successfulExtractions: 0,
    failedExtractions: 0,
    domQueryTime: 0,
    parseTime: 0,
    lastExtraction: 0
  }

  const getDocument = () => options.document || globalThis.document || window?.document
  const getLocation = () => globalThis.location || window?.location || {}
  const getWindow = () => options.window || globalThis.window || globalThis

  // DOM 選擇器配置
  const SELECTORS = {
    bookContainer: '.library-item',
    readerLink: 'a[href*="/api/reader/"]',
    bookImage: '.cover-img',
    bookTitle: '.title',
    progressBar: '.progress-bar',
    renditionType: '.label.rendition',
    privacyElement: '[id^="privacy-"]',
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
    scrollContainerCandidates: [
      '#react-container',
      '.react-container'
    ],
    loadMoreButton: 'button.btn-outline-primary',
    libraryTotalHeader: '.item-list-state'
  }

  const PLACEHOLDER_URL_PATTERN = /\/api\/reader\/\d+$/
  const UNSTABLE_COVER_IDS = new Set(['openbook', 'undefined', 'placeholder', 'default'])
  const MAX_ANCESTOR_DEPTH = 12

  // 建立穩定 ID 生成器
  const idGenerator = createStableIdGenerator({
    logger,
    getLocationOrigin: () => getLocation().origin,
    unstableCoverIds: UNSTABLE_COVER_IDS
  })

  // 建立捲動載入器（在 adapter 定義後才 wire up measureBooksFn / getBookElementsFn）
  let scrollLoader = null

  const adapter = {
    name: 'ReadmooAdapter',
    version: '2.0.0',
    isInitialized: false,

    config: {
      batchSize: 10,
      timeout: 5000,
      retryCount: 3,
      validateUrls: true,
      enableStats: true
    },

    get stats () {
      return this.getStats()
    },

    async extractBooks (document = globalThis.document) {
      return await this.extractAllBooks()
    },

    getBookElements () {
      const startTime = performance.now()
      let elements = []
      const caller = new Error().stack?.split('\n')[2]?.trim() || 'unknown'

      try {
        const document = getDocument()
        if (!document) {
          logger.warn('DOCUMENT_UNAVAILABLE')
          return []
        }

        const readerLinkCount = document.querySelectorAll(SELECTORS.readerLink).length
        const directLibraryItemCount = document.querySelectorAll(SELECTORS.bookContainer).length
        const attrSelectorCount = document.querySelectorAll('[class*="library-item"]').length

        logger.info('GET_BOOK_ELEMENTS_CALLED', {
          caller,
          readyState: document.readyState,
          directLibraryItemCount,
          attrSelectorCount,
          readerLinkCount
        })

        elements = Array.from(document.querySelectorAll(SELECTORS.bookContainer))

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

        if (elements.length === 0) {
          logger.info('LAST_RESORT_STRATEGY', { reason: '查找閱讀器連結的父容器' })
          const readerLinks = document.querySelectorAll(SELECTORS.readerLink)
          const containers = new Set()

          readerLinks.forEach(link => {
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

    // === 捲動載入代理（delegate to scrollLoader） ===

    async waitForBookElements (waitOptions = {}) {
      return scrollLoader.waitForBookElements(waitOptions)
    },

    parseLibraryTotal () {
      return scrollLoader.parseLibraryTotal()
    },

    findScrollContainer () {
      return scrollLoader.findScrollContainer()
    },

    findLoadMoreButton () {
      return scrollLoader.findLoadMoreButton()
    },

    findScrollableAncestor () {
      return scrollLoader.findScrollableAncestor()
    },

    _scrollStep (container, strategy) {
      return scrollLoader._scrollStep(container, strategy)
    },

    _scrollWindowToBottom () {
      return scrollLoader._scrollWindowToBottom()
    },

    _clickLoadMoreButton () {
      return scrollLoader._clickLoadMoreButton()
    },

    _waitMs (ms) {
      return scrollLoader._waitMs(ms)
    },

    _countPlaceholderCovers () {
      return scrollLoader._countPlaceholderCovers()
    },

    async _waitForPlaceholderConvergence (waitOptions = {}) {
      return scrollLoader._waitForPlaceholderConvergence(waitOptions)
    },

    async _scrollThroughAllItemsForCovers (coverScrollOptions = {}) {
      return scrollLoader._scrollThroughAllItemsForCovers(coverScrollOptions)
    },

    _readScrollY (win, scrollingEl) {
      return scrollLoader._readScrollY(win, scrollingEl)
    },

    _measureBooks () {
      return scrollLoader._measureBooks()
    },

    async loadAllBooksLazy (scrollOptions = {}) {
      return scrollLoader.loadAllBooksLazy(scrollOptions)
    },

    _observeChildListOnce (target, onMutation, failLogEvent) {
      return scrollLoader._observeChildListOnce(target, onMutation, failLogEvent)
    },

    async waitForRenderSettle (container, renderWaitMs, remainingTimeoutMs) {
      return scrollLoader.waitForRenderSettle(container, renderWaitMs, remainingTimeoutMs)
    },

    describeStopReason (stopReason) {
      return scrollLoader.describeStopReason(stopReason)
    },

    // === 書籍解析（保留在 adapter） ===

    extractHrefFromElement (element) {
      let readerLink = element.querySelector(SELECTORS.readerLink)
      if (!readerLink && element.matches && element.matches(SELECTORS.readerLink)) {
        readerLink = element
      }

      if (!readerLink) {
        logger.warn('READER_LINK_NOT_FOUND', { elementClass: element.className })
        return { href: '', readerId: '' }
      }

      const rawHref = readerLink.getAttribute('href') || ''

      const hrefBase = getLocation().origin
      if (rawHref && this.isUnsafeUrl(rawHref, hrefBase)) {
        logger.warn('UNSAFE_URL_FILTERED', { url: rawHref })
        return { href: '', readerId: '' }
      }

      const readerId = this.extractBookId(rawHref)
      return { href: rawHref, readerId }
    },

    extractBookIdFromPrivacy (element) {
      try {
        const privacyEl = element.querySelector(SELECTORS.privacyElement)
        if (!privacyEl) return ''

        const idAttr = privacyEl.getAttribute('id') || ''
        const match = idAttr.match(/^privacy-(\d+)$/)
        return match ? match[1] : ''
      } catch (error) {
        logger.warn('PRIVACY_ID_EXTRACTION_FAILED', { error: error.message })
        return ''
      }
    },

    isPlaceholderUrl (href) {
      if (!href) return false
      return PLACEHOLDER_URL_PATTERN.test(href)
    },

    extractCoverAndTitle (element) {
      const img = element.querySelector(SELECTORS.bookImage) || element.querySelector('img')
      let cover = img ? img.getAttribute('src') || '' : ''
      let title = ''

      const titleElement = element.querySelector(SELECTORS.bookTitle)
      if (titleElement) {
        title = titleElement.textContent?.trim() || titleElement.getAttribute('title')?.trim() || ''
      } else if (img) {
        title = img.getAttribute('alt')?.trim() || img.getAttribute('title')?.trim() || ''
      }

      const coverBase = getLocation().origin
      if (cover && this.isUnsafeUrl(cover, coverBase)) {
        if (!this._unsafeUrlCount) this._unsafeUrlCount = 0
        this._unsafeUrlCount++
        cover = ''
      }

      return { cover, title }
    },

    hasRequiredFields (title, readerId, cover) {
      const hasTitle = Boolean(title && title.trim())
      const hasReaderId = Boolean(readerId && readerId.trim())
      const hasCoverId = Boolean(this.extractCoverIdFromUrl(cover))
      return hasTitle || hasReaderId || hasCoverId
    },

    parseBookElement (element) {
      const startTime = performance.now()

      try {
        const { href, readerId } = this.extractHrefFromElement(element)
        const privacyBookId = this.extractBookIdFromPrivacy(element)

        let effectiveReaderId = readerId
        let effectiveUrl = href

        if (privacyBookId) {
          effectiveReaderId = privacyBookId

          const isPlaceholder = readerId && readerId !== privacyBookId
          if (isPlaceholder || !href) {
            effectiveUrl = `https://readmoo.com/api/reader/${privacyBookId}`
            if (isPlaceholder) {
              if (!this._placeholderUrlCount) this._placeholderUrlCount = 0
              this._placeholderUrlCount++
            }
          }
        }

        const { cover, title } = this.extractCoverAndTitle(element)

        if (!this.hasRequiredFields(title, effectiveReaderId, cover)) {
          logger.warn('BOOK_INSUFFICIENT_DATA', {
            elementClass: element.className,
            hasTitle: Boolean(title),
            hasReaderId: Boolean(effectiveReaderId),
            hasCover: Boolean(cover)
          })
          return null
        }

        const progressData = this.extractProgressFromContainer(element)
        const bookType = this.extractBookTypeFromContainer(element)

        const idInfo = this.generateStableBookIdWithInfo(effectiveReaderId, title, cover)

        const bookData = {
          id: idInfo.id,
          title: this.sanitizeText(title) || '未知標題',
          cover: cover || '',
          progress: progressData.progress,
          type: bookType || '未知',
          extractedAt: new Date().toISOString(),
          url: effectiveUrl,
          source: 'readmoo',

          identifiers: {
            readerLinkId: effectiveReaderId,
            privacyBookId: privacyBookId || '',
            coverId: this.extractCoverIdFromUrl(cover),
            titleBased: this.generateTitleBasedId(title),
            primarySource: idInfo.strategy
          },

          coverInfo: {
            url: cover,
            filename: this.extractFilenameFromUrl(cover),
            domain: this.extractDomainFromUrl(cover)
          },

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

    async extractAllBooks () {
      const extractionStart = performance.now()

      const loadResult = await this.loadAllBooksLazy()

      const bookElements = await this.waitForBookElements({ timeoutMs: 5000 })
      const books = []

      stats.totalExtracted = bookElements.length
      stats.successfulExtractions = 0
      stats.failedExtractions = 0

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

        if (i + batchSize < bookElements.length) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      }

      if (this._unsafeUrlCount > 0) {
        logger.warn('UNSAFE_COVER_URL_FILTERED', {
          totalFiltered: this._unsafeUrlCount,
          message: `${this._unsafeUrlCount} 個不安全的封面網址已過濾`
        })
        this._unsafeUrlCount = 0
      }

      if (this._placeholderUrlCount > 0) {
        logger.info('PLACEHOLDER_URL_REPLACED', {
          totalReplaced: this._placeholderUrlCount,
          message: `${this._placeholderUrlCount} 個佔位 URL 已替換為 privacy ID`
        })
        this._placeholderUrlCount = 0
      }

      stats.lastExtraction = Date.now()
      const totalTime = performance.now() - extractionStart

      logger.info('EXTRACTION_COMPLETED', {
        extracted: books.length,
        total: bookElements.length,
        duration: totalTime.toFixed(2) + 'ms',
        successful: stats.successfulExtractions,
        failed: stats.failedExtractions,
        expectedTotal: loadResult.expectedTotal,
        coverageComplete: loadResult.coverageComplete
      })

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

      if (books.length > 0 && globalThis.DEBUG_MODE) {
        logger.debug('FIRST_BOOK_SAMPLE', { book: books[0] })
      }

      return books
    },

    // === 通用工具代理（delegate to adapter-utils） ===

    isUnsafeUrl (url, base) {
      return isUnsafeUrl(url, base)
    },

    extractBookId (href) {
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

    extractProgressFromContainer (element) {
      try {
        const progressBar = element.querySelector(SELECTORS.progressBar)
        if (!progressBar) {
          return { progress: 0, progressText: '', hasProgress: false }
        }

        const style = progressBar.getAttribute('style') || ''
        let progressPercent = 0

        const widthMatch = style.match(/width:\s*(\d+(?:\.\d+)?)%/)
        if (widthMatch) {
          progressPercent = Math.round(parseFloat(widthMatch[1]))
        }

        let progressText = progressBar.textContent?.trim() || ''
        if (!progressText) {
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

    extractBookTypeFromContainer (element) {
      try {
        const typeElement = element.querySelector(SELECTORS.renditionType)
        if (typeElement) {
          const typeText = typeElement.textContent?.trim()
          if (typeText) {
            return typeText
          }
        }

        const altTypeElement = element.querySelector('.book-type, .type, [class*="rendition"], [class*="type"]')
        if (altTypeElement) {
          return altTypeElement.textContent?.trim() || '未知'
        }

        return '未知'
      } catch (error) {
        return '未知'
      }
    },

    // === 穩定 ID 生成代理（delegate to idGenerator） ===

    generateStableBookId (readerId, title, cover) {
      return idGenerator.generateStableBookId(readerId, title, cover)
    },

    generateStableBookIdWithInfo (readerId, title, cover) {
      return idGenerator.generateStableBookIdWithInfo(readerId, title, cover)
    },

    validateAndSanitizeInputs (readerId, title, cover) {
      return idGenerator.validateAndSanitizeInputs(readerId, title, cover)
    },

    applyIdGenerationStrategies (inputs) {
      return idGenerator.applyIdGenerationStrategies(inputs)
    },

    applyIdGenerationStrategiesWithInfo (inputs) {
      return idGenerator.applyIdGenerationStrategiesWithInfo(inputs)
    },

    tryReaderStrategy (inputs) {
      return idGenerator.tryReaderStrategy(inputs)
    },

    tryCoverStrategy (inputs) {
      return idGenerator.tryCoverStrategy(inputs)
    },

    tryTitleStrategy (inputs) {
      return idGenerator.tryTitleStrategy(inputs)
    },

    createFallbackId () {
      return idGenerator.createFallbackId()
    },

    validateTitleInput (title) {
      return idGenerator.validateTitleInput(title)
    },

    validateCoverUrlInput (coverUrl) {
      return idGenerator.validateCoverUrlInput(coverUrl)
    },

    validateReadmooDomain (url) {
      return idGenerator.validateReadmooDomain(url)
    },

    extractIdFromCoverPath (coverUrl) {
      return idGenerator.extractIdFromCoverPath(coverUrl)
    },

    extractIdFromFilename (coverUrl) {
      return idGenerator.extractIdFromFilename(coverUrl)
    },

    extractCoverIdFromUrl (coverUrl) {
      return idGenerator.extractCoverIdFromUrl(coverUrl)
    },

    generateTitleBasedId (title) {
      return idGenerator.generateTitleBasedId(title)
    },

    // === 文字處理代理（delegate to adapter-utils） ===

    sanitizeText (text) {
      return sanitizeText(text)
    },

    cleanHtmlAndMaliciousContent (text) {
      return cleanHtmlAndMaliciousContent(text)
    },

    processUrlEncoding (text) {
      return processUrlEncoding(text)
    },

    normalizeTextContent (text) {
      return normalizeTextContent(text)
    },

    limitTextLength (text, maxLength) {
      return limitTextLength(text, maxLength)
    },

    extractFilenameFromUrl (url) {
      return extractFilenameFromUrl(url)
    },

    extractDomainFromUrl (url) {
      return extractDomainFromUrl(url)
    },

    isNullOrUndefined (input) {
      return isNullOrUndefined(input)
    },

    isStringType (input) {
      return isStringType(input)
    },

    requiresSpecialHandling (input) {
      return requiresSpecialHandling(input)
    },

    safeConvertToString (input) {
      return safeConvertToString(input, logger)
    },

    safeStringify (input) {
      return safeStringify(input, logger)
    },

    logError (methodName, error, context = '') {
      logger.warn('ADAPTER_METHOD_ERROR', {
        method: methodName,
        context,
        error: error.message,
        stack: error.stack
      })
    },

    handleWithFallback (methodName, operation, fallbackValue, context = '') {
      return handleWithFallback(methodName, operation, fallbackValue, context, logger)
    },

    // === 標準介面 ===

    getStats () {
      return {
        ...stats,
        totalExtractions: stats.totalExtracted,
        successRate: stats.totalExtracted > 0
          ? (stats.successfulExtractions / stats.totalExtracted * 100).toFixed(2) + '%'
          : '0%',
        avgParseTime: stats.successfulExtractions > 0
          ? (stats.parseTime / stats.successfulExtractions).toFixed(2) + 'ms'
          : '0ms'
      }
    },

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

    findBookContainers (document = globalThis.document) {
      return this.getBookElements()
    },

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

    getSupportedUrls () {
      return [
        'readmoo.com',
        'member.readmoo.com',
        '*://*.readmoo.com/*'
      ]
    },

    reset () {
      stats.totalExtracted = 0
      stats.successfulExtractions = 0
      stats.failedExtractions = 0
      stats.domQueryTime = 0
      stats.parseTime = 0
      stats.lastExtraction = 0
      this.isInitialized = false
    },

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

  // Wire up scroll loader with adapter callbacks (adapterRef 確保 spy 攔截)
  scrollLoader = createReadmooScrollLoader({
    adapterRef: adapter,
    selectors: {
      bookContainer: SELECTORS.bookContainer,
      bookImage: SELECTORS.bookImage,
      scrollContainerCandidates: SELECTORS.scrollContainerCandidates,
      loadMoreButton: SELECTORS.loadMoreButton,
      libraryTotalHeader: SELECTORS.libraryTotalHeader,
      readerLink: SELECTORS.readerLink
    },
    logger,
    getDocument,
    getWindow,
    constants: {
      LIBRARY_TOTAL_PATTERN: /擁有\s*(\d+)\s*本書/,
      ARCHIVED_PATTERN: /封存\s*(\d+)\s*本/,
      LENT_PATTERN: /借出\s*(\d+)\s*本/,
      LOAD_MORE_TEXT_PATTERN: /更多/,
      MAX_ANCESTOR_DEPTH,
      COVER_SCROLL_SEGMENT_RATIO: 0.8,
      COVER_SCROLL_MAX_SEGMENTS: 200,
      COVER_POLL_INTERVAL_MS: 150,
      COVER_SEGMENT_SETTLE_MS: 600,
      COVER_CONVERGENCE_TIMEOUT_MS: 20000,
      PLACEHOLDER_COVER_PATTERN: /openbook|\/images\/(undefined|placeholder|default)/i
    },
    measureBooksFn: () => {
      const document = getDocument()
      if (!document) return []

      const items = document.querySelectorAll(SELECTORS.bookContainer)
      const ids = []
      for (const item of items) {
        const privacyId = adapter.extractBookIdFromPrivacy(item)
        if (privacyId) {
          ids.push(privacyId)
          continue
        }
        const { readerId } = adapter.extractHrefFromElement(item)
        if (readerId) {
          ids.push(readerId)
        }
      }
      return ids
    },
    getBookElementsFn: () => adapter.getBookElements()
  })

  Object.defineProperty(adapter, 'constructor', {
    value: { name: 'ReadmooAdapter' },
    writable: false
  })

  return adapter
}

module.exports = createReadmooAdapter
