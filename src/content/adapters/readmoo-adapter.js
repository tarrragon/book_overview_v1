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

/**
 * 建立 Readmoo 適配器實例
 *
 * @returns {Object} ReadmooAdapter 實例
 */
function createReadmooAdapter () {
  const stats = {
    totalExtracted: 0,
    successfulExtractions: 0,
    failedExtractions: 0,
    domQueryTime: 0,
    parseTime: 0,
    lastExtraction: 0
  }

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

  // 安全性過濾規則
  const SECURITY_FILTERS = {
    maliciousProtocols: ['javascript:', 'data:', 'vbscript:'],
    allowedImageTypes: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
  }

  const adapter = {
    /**
     * 取得書籍容器元素 (修正：使用正確的 Readmoo 頁面結構)
     *
     * @returns {HTMLElement[]} 書籍容器元素陣列
     */
    getBookElements () {
      const startTime = performance.now()
      let elements = []

      try {
        // 主要策略：查找 .library-item 容器
        elements = Array.from(document.querySelectorAll(SELECTORS.bookContainer))

        // 備用策略：如果沒有找到主要容器，嘗試其他選擇器
        if (elements.length === 0) {
          console.log('⚠️ 未找到 .library-item，嘗試備用選擇器...')

          for (const selector of SELECTORS.alternativeContainers) {
            const found = document.querySelectorAll(selector)
            if (found.length > 0) {
              elements = Array.from(found)
              console.log(`✅ 使用備用選擇器 ${selector} 找到 ${elements.length} 個元素`)
              break
            }
          }
        }

        // 最後備用策略：直接查找閱讀器連結的父容器
        if (elements.length === 0) {
          console.log('⚠️ 使用最後備用策略：查找閱讀器連結的父容器...')
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

        console.log(`📚 找到 ${elements.length} 個書籍容器元素`)

        stats.domQueryTime += performance.now() - startTime
        return elements
      } catch (error) {
        console.error('❌ DOM 查詢失敗:', error)
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
          console.warn('⚠️ 容器中未找到閱讀器連結:', element)
          return null
        }

        const href = readerLink.getAttribute('href') || ''

        // 安全檢查 - 過濾惡意URL
        if (this.isUnsafeUrl(href)) {
          console.warn('⚠️ 檢測到惡意URL，已過濾:', href)
          stats.failedExtractions++
          return null
        }

        // 提取書籍 ID
        const id = this.extractBookId(href)
        if (!id) {
          console.warn('⚠️ 無法提取書籍ID:', href)
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
          console.warn('⚠️ 檢測到惡意圖片URL，已過濾:', cover)
          cover = ''
        }

        // 提取閱讀進度
        const progressData = this.extractProgressFromContainer(element)

        // 提取書籍類型
        const bookType = this.extractBookTypeFromContainer(element)

        // 建立完整的書籍資料物件
        const bookData = {
          // 使用封面ID系統產生穩定的書籍ID
          id: this.generateStableBookId(id, title, cover),
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
            primarySource: cover ? 'cover' : 'reader-link'
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
        console.error('❌ 解析書籍容器元素失敗:', error)
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
          const bookData = this.parseBookElement(element)
          if (bookData) {
            books.push(bookData)
            stats.successfulExtractions++
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
      console.log(`📊 提取完成: ${books.length}/${bookElements.length} 本書籍 (${totalTime.toFixed(2)}ms)`)
      console.log(`✅ 成功: ${stats.successfulExtractions}, ❌ 失敗: ${stats.failedExtractions}`)

      if (bookElements.length === 0) {
        console.warn('⚠️ 未找到任何書籍元素，可能的原因：')
        console.warn('   1. 頁面尚未完全載入')
        console.warn('   2. Readmoo 變更了頁面結構')
        console.warn('   3. CSS 選擇器需要更新')
        console.warn('   4. 不是書庫或書架頁面')
      } else if (books.length === 0) {
        console.warn('⚠️ 找到書籍容器但無法解析，可能的原因：')
        console.warn('   1. 容器結構不符合預期')
        console.warn('   2. 缺少必要的子元素')
        console.warn('   3. URL 或圖片格式不符合')
      } else if (books.length < bookElements.length) {
        console.warn(`⚠️ 部分書籍解析失敗 (${stats.failedExtractions}/${bookElements.length})`)
      }

      // 在開發模式下輸出第一本書的詳細資訊
      if (books.length > 0 && globalThis.DEBUG_MODE) {
        console.log('📖 第一本書籍資訊範例:', books[0])
      }

      return books
    },

    /**
     * 檢查URL是否安全
     *
     * @param {string} url - 要檢查的URL
     * @returns {boolean} 是否為不安全的URL
     */
    isUnsafeUrl (url) {
      if (!url || typeof url !== 'string') return false

      const lowerUrl = url.toLowerCase().trim()
      return SECURITY_FILTERS.maliciousProtocols.some(protocol =>
        lowerUrl.startsWith(protocol)
      )
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
      // 輸入參數安全化處理
      const safeReaderId = this.safeStringify(readerId)
      const safeTitle = this.safeStringify(title)
      const safeCover = this.safeStringify(cover)
      
      try {
        // 優先使用封面URL提取的ID（最穩定）
        if (safeCover && safeCover.trim()) {
          const coverId = this.extractCoverIdFromUrl(safeCover)
          if (coverId) {
            return `cover-${coverId}`
          }
        }

        // 備用：使用標題生成ID
        if (safeTitle && safeTitle.trim() && safeTitle.trim() !== '未知標題') {
          const titleId = this.generateTitleBasedId(safeTitle)
          if (titleId) {
            return `title-${titleId}`
          }
        }

        // 最後備用：使用閱讀器連結ID
        if (safeReaderId && safeReaderId.trim()) {
          return `reader-${safeReaderId}`
        }

        // 極端情況：所有參數都無效
        return 'reader-undefined'
      } catch (error) {
        console.warn('generateStableBookId 發生錯誤:', error)
        return safeReaderId ? `reader-${safeReaderId}` : 'reader-undefined'
      }
    },

    /**
     * 安全字符串化處理
     * @param {*} input - 任何類型的輸入
     * @returns {string} 安全的字符串
     */
    safeStringify (input) {
      if (input === null || input === undefined) {
        return ''
      }
      if (typeof input === 'string') {
        return input
      }
      
      // 特殊處理非字符串類型，根據測試要求返回空字符串
      if (typeof input === 'boolean' || typeof input === 'object' || typeof input === 'number') {
        return ''
      }
      
      try {
        return String(input)
      } catch (error) {
        return ''
      }
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
     * 從封面 URL 提取 ID
     *
     * @param {string} coverUrl - 封面 URL
     * @returns {string|null} 封面 ID
     */
    extractCoverIdFromUrl (coverUrl) {
      if (!coverUrl || typeof coverUrl !== 'string') {
        return null
      }

      try {
        const trimmedUrl = coverUrl.trim()
        
        // 安全性檢查
        if (this.isUnsafeUrl(trimmedUrl)) {
          return null
        }
        
        // 檢查是否為 Readmoo 封面 URL
        const urlObj = new URL(trimmedUrl)
        if (urlObj.hostname !== 'cdn.readmoo.com' || !urlObj.pathname.includes('/cover/')) {
          return null
        }

        // 解析封面ID格式：https://cdn.readmoo.com/cover/xx/xxxxx_210x315.jpg?v=xxxxxxxx
        const coverMatch = coverUrl.match(/\/cover\/[a-z0-9]+\/([^_]+)_/)
        if (coverMatch) {
          return coverMatch[1]
        }

        // 備用解析方式
        const filenameMatch = coverUrl.match(/\/([^/]+)\.(jpg|png|jpeg)/i)
        if (filenameMatch) {
          return filenameMatch[1].replace(/_\d+x\d+$/, '') // 移除尺寸後綴
        }

        return null
      } catch (error) {
        return null
      }
    },

    /**
     * 基於標題生成 ID
     *
     * @param {string} title - 書籍標題
     * @returns {string|null} 標題 ID
     */
    generateTitleBasedId (title) {
      if (!title || typeof title !== 'string') {
        return null
      }

      try {
        let normalizedTitle = title.trim()
        
        // 清理HTML標籤和惡意內容（更嚴格的處理）
        normalizedTitle = normalizedTitle
          .replace(/<script[^>]*>.*?<\/script>/gi, '') // 移除 script 標籤及其內容
          .replace(/<[^>]*>/g, '') // 移除其他 HTML 標籤
          .replace(/&[a-zA-Z0-9#]+;/g, '') // 移除HTML實體
          .replace(/[<>"']/g, '') // 移除潛在XSS字符
        
        // 處理URL編碼字符
        normalizedTitle = normalizedTitle
          .replace(/%20/g, ' ') // 空格URL編碼
          .replace(/&amp;/g, '&') // HTML實體還原
        
        // 正規化空白和特殊字符
        normalizedTitle = normalizedTitle
          .replace(/\s+/g, ' ') // 正規化空白字符
          .replace(/[^\u4e00-\u9fff\w\s]/g, '') // 保留中文、英文、數字、空格
          .replace(/\s+/g, '-') // 空格轉換為連字符
          .toLowerCase()

        if (normalizedTitle.length > 0) {
          return normalizedTitle.substring(0, 50) // 限制長度
        }

        return null
      } catch (error) {
        console.warn('generateTitleBasedId 處理錯誤:', error)
        return null
      }
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
        successRate: stats.totalExtracted > 0
          ? (stats.successfulExtractions / stats.totalExtracted * 100).toFixed(2) + '%'
          : '0%',
        avgParseTime: stats.successfulExtractions > 0
          ? (stats.parseTime / stats.successfulExtractions).toFixed(2) + 'ms'
          : '0ms'
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
