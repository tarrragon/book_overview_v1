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
const { createLogger } = require('../../core/logging/Logger')

/**
 * 建立 Readmoo 適配器實例
 *
 * @param {Object} options - 配置選項
 * @param {Document} options.document - 可選的 document 物件，用於測試環境
 * @returns {Object} ReadmooAdapter 實例
 */
function createReadmooAdapter (options = {}) {
  // 建立專用日誌記錄器
  const logger = createLogger('ReadmooAdapter')
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
    ]
  }

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

      try {
        const document = getDocument()
        if (!document) {
          logger.warn('DOCUMENT_UNAVAILABLE')
          return []
        }

        // 主要策略：查找 .library-item 容器
        elements = Array.from(document.querySelectorAll(SELECTORS.bookContainer))

        // 備用策略：如果沒有找到主要容器，嘗試其他選擇器
        if (elements.length === 0) {
          logger.warn('FALLBACK_SELECTOR_ATTEMPT', { reason: '未找到 .library-item' })

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
          logger.warn('LAST_RESORT_STRATEGY', { reason: '查找閱讀器連結的父容器' })
          const readerLinks = document.querySelectorAll(SELECTORS.readerLink)
          const containers = new Set()

          readerLinks.forEach(link => {
            // 向上查找可能的書籍容器
            let parent = link.parentElement
            while (parent && parent !== document.body) {
              if (parent.classList.length > 0) {
                containers.add(parent)
                break
              }
              parent = parent.parentElement
            }
          })

          elements = Array.from(containers)
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
     * 解析書籍容器元素 (修正：使用 ReadmooAdapter 相同邏輯)
     *
     * @param {HTMLElement} element - 書籍容器元素
     * @returns {Object|null} 書籍資料物件
     */
    parseBookElement (element) {
      const startTime = performance.now()

      try {
        // 從容器中查找閱讀器連結（容器可能本身就是連結）
        let readerLink = element.querySelector(SELECTORS.readerLink)
        if (!readerLink && element.matches && element.matches(SELECTORS.readerLink)) {
          readerLink = element
        }
        if (!readerLink) {
          logger.warn('READER_LINK_NOT_FOUND', { elementClass: element.className })
          return null
        }

        const href = readerLink.getAttribute('href') || ''

        // 安全檢查 - 過濾惡意URL
        if (this.isUnsafeUrl(href)) {
          logger.warn('UNSAFE_URL_FILTERED', { url: href })
          stats.failedExtractions++
          return null
        }

        // 提取書籍 ID
        const id = this.extractBookId(href)
        if (!id) {
          logger.warn('BOOK_ID_EXTRACTION_FAILED', { href })
          return null
        }

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
        if (cover && this.isUnsafeUrl(cover)) {
          logger.warn('UNSAFE_COVER_URL_FILTERED', { coverUrl: cover })
          cover = ''
        }

        // 提取閱讀進度
        const progressData = this.extractProgressFromContainer(element)

        // 提取書籍類型
        const bookType = this.extractBookTypeFromContainer(element)

        // 生成穩定的書籍ID並取得策略資訊
        const idInfo = this.generateStableBookIdWithInfo(id, title, cover)

        // 建立完整的書籍資料物件
        const bookData = {
          id: idInfo.id,
          title: this.sanitizeText(title) || '未知標題',
          cover: cover || '',
          progress: progressData.progress,
          type: bookType || '未知',
          extractedAt: new Date().toISOString(),
          url: href,
          source: 'readmoo',

          // 提取的完整識別資訊
          identifiers: {
            readerLinkId: id,
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
        logger.error('BOOK_ELEMENT_PARSE_FAILED', { error: error.message, stack: error.stack })
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
      const bookElements = this.getBookElements()
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

      stats.lastExtraction = Date.now()
      const totalTime = performance.now() - extractionStart

      // 詳細的提取結果日誌
      logger.info('EXTRACTION_COMPLETED', {
        extracted: books.length,
        total: bookElements.length,
        duration: totalTime.toFixed(2) + 'ms',
        successful: stats.successfulExtractions,
        failed: stats.failedExtractions
      })

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
        logger.warn('BOOK_CONTAINERS_PARSE_FAILED', {
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
     * @param {string} url - 要檢查的URL
     * @returns {boolean} 是否不安全
     */
    isUnsafeUrl (url) {
      if (!url || typeof url !== 'string') {
        return true
      }

      try {
        const urlObj = new URL(url)
        const protocol = urlObj.protocol.toLowerCase()

        // 只允許 https 和 http 協議
        if (protocol !== 'https:' && protocol !== 'http:') {
          return true
        }

        // 檢查路徑遍歷攻擊
        if (urlObj.pathname.includes('..') || urlObj.pathname.includes('%2e%2e')) {
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
      const coverResult = this.tryCoverStrategy(inputs)
      if (coverResult) {
        return { id: coverResult, strategy: 'cover' }
      }

      const titleResult = this.tryTitleStrategy(inputs)
      if (titleResult) {
        return { id: titleResult, strategy: 'title' }
      }

      const readerResult = this.tryReaderStrategy(inputs)
      if (readerResult) {
        return {
          id: `unstable-${inputs.readerId}`,
          strategy: 'reader-link'
        }
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
      return coverId ? `cover-${coverId}` : null
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
      return [
        'readmoo.com',
        'member.readmoo.com',
        'https://readmoo.com/library*',
        'https://readmoo.com/bookshelf*',
        'https://*.readmoo.com/library*',
        'https://*.readmoo.com/bookshelf*'
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
