/**
 * BookSearchFilter - 書籍搜尋篩選器 (TDD循環 #28)
 *
 * 負責功能：
 * - 多條件書籍搜尋功能
 * - 動態篩選和排序
 * - 搜尋歷史管理
 * - 效能優化和快取
 * - 模糊搜尋和智能建議
 *
 * 設計考量：
 * - 支援即時搜尋和篩選
 * - 多重搜尋條件組合
 * - 搜尋結果快取優化
 * - 靈活的排序機制
 * - 完整的搜尋統計
 *
 * 使用情境：
 * - Overview 頁面的搜尋功能
 * - 書籍列表的即時篩選
 * - 進階搜尋功能
 *
 * @version 1.0.0
 * @since 2025-08-06
 */

// 常數定義 - 分層組織架構
const CONSTANTS = {
  // 配置管理
  CONFIG: {
    DEFAULT: {
      caseSensitive: false,
      fuzzySearch: true,
      maxResults: 100,
      searchFields: ['title', 'author', 'publisher', 'category', 'tags'],
      cacheEnabled: true,
      historyMaxSize: 50
    },
    THRESHOLDS: {
      FUZZY_SIMILARITY: 0.6,
      CACHE_SIZE_LIMIT: 1000,
      BATCH_SIZE: 100
    },
    TIMING: {
      DEBOUNCE_DELAY: 300,
      SEARCH_TIMEOUT: 5000
    }
  },

  // 搜尋引擎
  SEARCH: {
    TYPES: {
      EXACT: 'exact',
      FUZZY: 'fuzzy',
      REGEX: 'regex',
      MULTI_KEYWORD: 'multiKeyword',
      INDEXED: 'indexed'
    },
    FIELDS: {
      TITLE: 'title',
      AUTHOR: 'author',
      PUBLISHER: 'publisher',
      CATEGORY: 'category',
      TAGS: 'tags',
      ISBN: 'isbn',
      CONTENT: 'content'
    },
    OPERATORS: {
      AND: 'AND',
      OR: 'OR',
      NOT: 'NOT'
    }
  },

  // 排序系統
  SORT: {
    DIRECTION: {
      ASC: 'asc',
      DESC: 'desc'
    },
    FIELDS: {
      TITLE: 'title',
      AUTHOR: 'author',
      PUBLISHER: 'publisher',
      PUBLISH_DATE: 'publishDate',
      CATEGORY: 'category',
      PROGRESS: 'progress',
      RATING: 'rating',
      STATUS: 'status',
      RELEVANCE: 'relevance'
    },
    TYPES: {
      STRING: 'string',
      NUMBER: 'number',
      DATE: 'date',
      BOOLEAN: 'boolean'
    }
  },

  // 效能優化
  PERFORMANCE: {
    CACHE_STRATEGY: {
      LRU: 'lru',
      FIFO: 'fifo',
      TTL: 'ttl'
    },
    INDEX_UPDATE: {
      IMMEDIATE: 'immediate',
      BATCH: 'batch',
      LAZY: 'lazy'
    }
  }
}

class BookSearchFilter {
  /**
   * 建構書籍搜尋篩選器
   *
   * @param {Array} books - 書籍陣列
   * @param {Object} options - 配置選項
   */
  constructor (books = [], options = {}) {
    this.originalBooks = books
    this.filteredBooks = [...books]

    // 合併配置
    this.config = { ...CONSTANTS.CONFIG.DEFAULT, ...options }

    // 初始化狀態
    this.currentQuery = ''
    this.searchHistory = []
    this.searchCache = new Map()

    // 效能統計
    this.stats = {
      searchCount: 0,
      totalSearchTime: 0,
      totalResultsReturned: 0,
      cacheHits: 0
    }

    // 初始化索引
    this.buildSearchIndex()
  }

  // ===============================
  // 私有方法 - 索引管理
  // ===============================

  /**
   * 建立搜尋索引
   */
  buildSearchIndex () {
    this._initializeIndexStructure()

    this.originalBooks.forEach((book, index) => {
      this._indexBook(book, index)
    })
  }

  /**
   * 初始化索引結構
   */
  _initializeIndexStructure () {
    this.searchIndex = {
      title: new Map(),
      author: new Map(),
      publisher: new Map(),
      category: new Map(),
      tags: new Map()
    }
  }

  /**
   * 為單本書建立索引
   *
   * @param {Object} book - 書籍物件
   * @param {number} index - 書籍索引
   */
  _indexBook (book, index) {
    // 為文字欄位建立索引
    this._indexTextField(book, CONSTANTS.SEARCH.FIELDS.TITLE, index)
    this._indexTextField(book, CONSTANTS.SEARCH.FIELDS.AUTHOR, index)
    this._indexTextField(book, CONSTANTS.SEARCH.FIELDS.PUBLISHER, index)
    this._indexTextField(book, CONSTANTS.SEARCH.FIELDS.CATEGORY, index)

    // 為標籤建立索引
    this._indexTagsField(book, index)

    // 為其他欄位建立索引
    this._indexSpecialFields(book, index)
  }

  /**
   * 為文字欄位建立索引
   *
   * @param {Object} book - 書籍物件
   * @param {string} field - 欄位名稱
   * @param {number} index - 書籍索引
   */
  _indexTextField (book, field, index) {
    const fieldValue = book[field]
    if (!fieldValue || typeof fieldValue !== 'string') return

    const words = this._tokenize(fieldValue)
    words.forEach(word => {
      this._addToIndex(field, word, index)
    })
  }

  /**
   * 為標籤欄位建立索引
   *
   * @param {Object} book - 書籍物件
   * @param {number} index - 書籍索引
   */
  _indexTagsField (book, index) {
    if (!book.tags || !Array.isArray(book.tags)) return

    book.tags.forEach(tag => {
      if (typeof tag === 'string') {
        const normalizedTag = this.config.caseSensitive ? tag : tag.toLowerCase()
        this._addToIndex(CONSTANTS.SEARCH.FIELDS.TAGS, normalizedTag, index)
      }
    })
  }

  /**
   * 為特殊欄位建立索引
   *
   * @param {Object} book - 書籍物件
   * @param {number} index - 書籍索引
   */
  _indexSpecialFields (book, index) {
    // ISBN 索引
    if (book.isbn) {
      this._addToIndex('isbn', book.isbn.toLowerCase(), index)
    }

    // 狀態索引
    if (book.status) {
      this._addToIndex('status', book.status.toLowerCase(), index)
    }
  }

  /**
   * 加入詞彙到索引
   *
   * @param {string} field - 欄位名稱
   * @param {string} word - 詞彙
   * @param {number} index - 書籍索引
   */
  _addToIndex (field, word, index) {
    if (!this.searchIndex[field]) {
      this.searchIndex[field] = new Map()
    }

    if (!this.searchIndex[field].has(word)) {
      this.searchIndex[field].set(word, [])
    }

    this.searchIndex[field].get(word).push(index)
  }

  /**
   * 建立欄位索引（向後兼容）
   *
   * @param {Object} book - 書籍物件
   * @param {string} field - 欄位名稱
   * @param {number} index - 書籍索引
   */
  indexField (book, field, index) {
    this._indexTextField(book, field, index)
  }

  // ===============================
  // 私有方法 - 文字處理
  // ===============================

  /**
   * 文字分詞
   *
   * @param {string} text - 文字內容
   * @returns {Array} 分詞結果
   */
  _tokenize (text) {
    if (!text || typeof text !== 'string') return []

    const normalized = this._normalizeText(text)
    return this._splitIntoWords(normalized)
  }

  /**
   * 正規化文字
   *
   * @param {string} text - 原始文字
   * @returns {string} 正規化後的文字
   */
  _normalizeText (text) {
    let normalized = this.config.caseSensitive ? text : text.toLowerCase()

    // 移除多餘空白
    normalized = normalized.trim()

    // 統一標點符號
    normalized = normalized.replace(/[""'']/g, '"')
    normalized = normalized.replace(/[－—]/g, '-')

    return normalized
  }

  /**
   * 將文字分割為詞彙
   *
   * @param {string} text - 正規化的文字
   * @returns {Array} 詞彙陣列
   */
  _splitIntoWords (text) {
    // 定義分隔符號
    const separators = /[\s\u3000，。！？；：「」『』（）\[\]{}\/\\-_\.]/

    return text.split(separators)
      .filter(word => word.length > 0)
      .filter(word => !this._isStopWord(word))
  }

  /**
   * 檢查是否為停用詞
   *
   * @param {string} word - 詞彙
   * @returns {boolean} 是否為停用詞
   */
  _isStopWord (word) {
    const stopWords = ['的', '了', '和', '與', '及', '或', '但', '是', '在', '有', '會', 'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'as', 'by']
    return stopWords.includes(word.toLowerCase())
  }

  /**
   * 文字分詞（向後兼容）
   *
   * @param {string} text - 文字內容
   * @returns {Array} 分詞結果
   */
  tokenize (text) {
    return this._tokenize(text)
  }

  /**
   * 根據書名搜尋
   *
   * @param {string} query - 搜尋查詢
   * @returns {Array} 搜尋結果
   */
  searchByTitle (query) {
    return this.searchByField('title', query)
  }

  /**
   * 根據作者搜尋
   *
   * @param {string} query - 搜尋查詢
   * @returns {Array} 搜尋結果
   */
  searchByAuthor (query) {
    return this.searchByField('author', query)
  }

  /**
   * 根據出版社搜尋
   *
   * @param {string} query - 搜尋查詢
   * @returns {Array} 搜尋結果
   */
  searchByPublisher (query) {
    return this.searchByField('publisher', query)
  }

  /**
   * 根據特定欄位搜尋
   *
   * @param {string} field - 欄位名稱
   * @param {string} query - 搜尋查詢
   * @returns {Array} 搜尋結果
   */
  searchByField (field, query) {
    if (!query || typeof query !== 'string') return this.originalBooks

    const normalizedQuery = this.config.caseSensitive ? query : query.toLowerCase()
    const results = []

    this.originalBooks.forEach(book => {
      if (book[field] && typeof book[field] === 'string') {
        const fieldValue = this.config.caseSensitive ? book[field] : book[field].toLowerCase()
        if (fieldValue.includes(normalizedQuery)) {
          results.push(book)
        }
      }
    })

    return results
  }

  /**
   * 通用搜尋
   *
   * @param {string} query - 搜尋查詢
   * @returns {Array} 搜尋結果
   */
  search (query) {
    const startTime = performance.now()

    // 處理空查詢
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return this.originalBooks
    }

    this.currentQuery = query
    this.addToHistory(query)

    // 檢查快取
    const cachedResult = this._getCachedResult(query)
    if (cachedResult) {
      return cachedResult
    }

    const normalizedQuery = this.config.caseSensitive ? query : query.toLowerCase()
    const results = []
    const resultSet = new Set()

    this.originalBooks.forEach(book => {
      let matches = false

      // 搜尋所有配置的欄位
      this.config.searchFields.forEach(field => {
        if (matches) return

        if (field === 'tags' && book.tags && Array.isArray(book.tags)) {
          matches = book.tags.some(tag => {
            const tagValue = this.config.caseSensitive ? tag : tag.toLowerCase()
            return tagValue.includes(normalizedQuery)
          })
        } else if (book[field] && typeof book[field] === 'string') {
          const fieldValue = this.config.caseSensitive ? book[field] : book[field].toLowerCase()
          matches = fieldValue.includes(normalizedQuery)
        }
      })

      if (matches && !resultSet.has(book.id)) {
        results.push(book)
        resultSet.add(book.id)
      }
    })

    // 限制結果數量
    const limitedResults = results.slice(0, this.config.maxResults)

    // 快取結果
    this._manageCache(query, limitedResults)

    // 更新統計
    const endTime = performance.now()
    this.updateStats(endTime - startTime, limitedResults.length)

    return limitedResults
  }

  /**
   * 根據分類篩選
   *
   * @param {string} category - 分類名稱
   * @returns {Array} 篩選結果
   */
  filterByCategory (category) {
    return this.originalBooks.filter(book => book.category === category)
  }

  /**
   * 根據閱讀狀態篩選
   *
   * @param {string} status - 閱讀狀態
   * @returns {Array} 篩選結果
   */
  filterByStatus (status) {
    return this.originalBooks.filter(book => book.status === status)
  }

  /**
   * 根據進度範圍篩選
   *
   * @param {number} min - 最小進度
   * @param {number} max - 最大進度
   * @returns {Array} 篩選結果
   */
  filterByProgressRange (min, max) {
    return this.originalBooks.filter(book =>
      book.progress >= min && book.progress <= max
    )
  }

  /**
   * 根據日期範圍篩選
   *
   * @param {string} startDate - 開始日期
   * @param {string} endDate - 結束日期
   * @returns {Array} 篩選結果
   */
  filterByDateRange (startDate, endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)

    return this.originalBooks.filter(book => {
      if (!book.publishDate) return false
      const bookDate = new Date(book.publishDate)
      return bookDate >= start && bookDate <= end
    })
  }

  /**
   * 根據標籤篩選
   *
   * @param {Array} tags - 標籤陣列
   * @returns {Array} 篩選結果
   */
  filterByTags (tags) {
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return this.originalBooks
    }

    return this.originalBooks.filter(book => {
      if (!book.tags || !Array.isArray(book.tags)) return false
      return tags.some(tag => book.tags.includes(tag))
    })
  }

  /**
   * 應用多個篩選條件
   *
   * @param {Object} filters - 篩選條件物件
   * @returns {Array} 篩選結果
   */
  applyFilters (filters) {
    let results = [...this.originalBooks]

    if (filters.category) {
      results = results.filter(book => book.category === filters.category)
    }

    if (filters.status) {
      results = results.filter(book => book.status === filters.status)
    }

    if (filters.progressMin !== undefined && filters.progressMax !== undefined) {
      results = results.filter(book =>
        book.progress >= filters.progressMin && book.progress <= filters.progressMax
      )
    }

    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate)
      const end = new Date(filters.endDate)
      results = results.filter(book => {
        if (!book.publishDate) return false
        const bookDate = new Date(book.publishDate)
        return bookDate >= start && bookDate <= end
      })
    }

    if (filters.tags && Array.isArray(filters.tags)) {
      results = results.filter(book => {
        if (!book.tags || !Array.isArray(book.tags)) return false
        return filters.tags.some(tag => book.tags.includes(tag))
      })
    }

    return results
  }

  /**
   * 排序功能
   *
   * @param {string} field - 排序欄位
   * @param {string} direction - 排序方向 ('asc' 或 'desc')
   * @returns {Array} 排序結果
   */
  sortBy (field, direction = 'asc') {
    const results = [...this.filteredBooks]

    return results.sort((a, b) => {
      let aValue = a[field]
      let bValue = b[field]

      // 處理不存在的欄位
      if (aValue === undefined || aValue === null) aValue = ''
      if (bValue === undefined || bValue === null) bValue = ''

      // 處理日期欄位
      if (field === 'publishDate') {
        aValue = new Date(aValue)
        bValue = new Date(bValue)
      }

      // 處理數字欄位
      if (field === 'progress' || field === 'rating') {
        aValue = Number(aValue) || 0
        bValue = Number(bValue) || 0
      }

      // 處理字串欄位
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      let comparison = 0
      if (aValue < bValue) comparison = -1
      if (aValue > bValue) comparison = 1

      return direction === 'desc' ? -comparison : comparison
    })
  }

  /**
   * 模糊搜尋
   *
   * @param {string} query - 搜尋查詢
   * @returns {Array} 搜尋結果
   */
  fuzzySearch (query) {
    if (!query || typeof query !== 'string') return this.originalBooks

    const results = []
    const normalizedQuery = query.toLowerCase()

    this.originalBooks.forEach(book => {
      let maxSimilarity = 0

      this.config.searchFields.forEach(field => {
        if (field === 'tags' && book.tags && Array.isArray(book.tags)) {
          book.tags.forEach(tag => {
            const similarity = this.calculateSimilarity(normalizedQuery, tag.toLowerCase())
            maxSimilarity = Math.max(maxSimilarity, similarity)
          })
        } else if (book[field] && typeof book[field] === 'string') {
          const similarity = this.calculateSimilarity(normalizedQuery, book[field].toLowerCase())
          maxSimilarity = Math.max(maxSimilarity, similarity)
        }
      })

      if (maxSimilarity >= CONSTANTS.CONFIG.THRESHOLDS.FUZZY_SIMILARITY) {
        results.push({ book, similarity: maxSimilarity })
      }
    })

    // 根據相似度排序並只返回書籍物件
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .map(result => result.book)
  }

  /**
   * 正則表達式搜尋
   *
   * @param {RegExp} regex - 正則表達式
   * @returns {Array} 搜尋結果
   */
  regexSearch (regex) {
    if (!(regex instanceof RegExp)) return this.originalBooks

    const results = []

    this.originalBooks.forEach(book => {
      let matches = false

      this.config.searchFields.forEach(field => {
        if (matches) return

        if (field === 'tags' && book.tags && Array.isArray(book.tags)) {
          matches = book.tags.some(tag => regex.test(tag))
        } else if (book[field] && typeof book[field] === 'string') {
          matches = regex.test(book[field])
        }
      })

      if (matches) {
        results.push(book)
      }
    })

    return results
  }

  /**
   * 多關鍵字搜尋
   *
   * @param {Array} keywords - 關鍵字陣列
   * @returns {Array} 搜尋結果
   */
  multiKeywordSearch (keywords) {
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return this.originalBooks
    }

    const results = []
    const resultSet = new Set()

    keywords.forEach(keyword => {
      const keywordResults = this.search(keyword)
      keywordResults.forEach(book => {
        if (!resultSet.has(book.id)) {
          results.push(book)
          resultSet.add(book.id)
        }
      })
    })

    return results
  }

  /**
   * 計算字串相似度
   *
   * @param {string} str1 - 字串1
   * @param {string} str2 - 字串2
   * @returns {number} 相似度（0-1）
   */
  calculateSimilarity (str1, str2) {
    if (str1 === str2) return 1
    if (str1.length === 0 || str2.length === 0) return 0

    // 使用簡化的編輯距離算法
    const matrix = []
    const len1 = str1.length
    const len2 = str2.length

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // 刪除
          matrix[i][j - 1] + 1, // 插入
          matrix[i - 1][j - 1] + cost // 替換
        )
      }
    }

    const maxLen = Math.max(len1, len2)
    return (maxLen - matrix[len1][len2]) / maxLen
  }

  /**
   * 加入搜尋歷史
   *
   * @param {string} query - 搜尋查詢
   */
  addToHistory (query) {
    if (!query || typeof query !== 'string') return

    // 移除重複項
    const index = this.searchHistory.indexOf(query)
    if (index > -1) {
      this.searchHistory.splice(index, 1)
    }

    // 加入到最前面
    this.searchHistory.unshift(query)

    // 限制歷史大小
    if (this.searchHistory.length > this.config.historyMaxSize) {
      this.searchHistory = this.searchHistory.slice(0, this.config.historyMaxSize)
    }
  }

  /**
   * 取得搜尋歷史
   *
   * @returns {Array} 搜尋歷史
   */
  getSearchHistory () {
    return [...this.searchHistory]
  }

  /**
   * 清除搜尋歷史
   */
  clearSearchHistory () {
    this.searchHistory = []
  }

  /**
   * 取得搜尋建議
   *
   * @param {string} partial - 部分輸入
   * @returns {Array} 建議清單
   */
  getSuggestions (partial) {
    if (!partial || typeof partial !== 'string') return []

    const suggestions = new Set()
    const normalizedPartial = partial.toLowerCase()

    // 從搜尋歷史中取得建議
    this.searchHistory.forEach(query => {
      if (query.toLowerCase().includes(normalizedPartial)) {
        suggestions.add(query)
      }
    })

    // 從書籍資料中取得建議
    this.originalBooks.forEach(book => {
      this.config.searchFields.forEach(field => {
        if (field === 'tags' && book.tags && Array.isArray(book.tags)) {
          book.tags.forEach(tag => {
            if (tag.toLowerCase().includes(normalizedPartial)) {
              suggestions.add(tag)
            }
          })
        } else if (book[field] && typeof book[field] === 'string') {
          const words = this.tokenize(book[field])
          words.forEach(word => {
            if (word.includes(normalizedPartial)) {
              suggestions.add(book[field])
            }
          })
        }
      })
    })

    return Array.from(suggestions).slice(0, 10)
  }

  /**
   * 取得即時建議
   *
   * @param {string} input - 輸入內容
   * @returns {Array} 即時建議清單
   */
  getInstantSuggestions (input) {
    if (!input || typeof input !== 'string') return []

    const suggestions = new Set()
    const normalizedInput = input.toLowerCase()

    // 從所有書籍資料中尋找匹配的內容
    this.originalBooks.forEach(book => {
      // 書名建議
      if (book.title && book.title.toLowerCase().includes(normalizedInput)) {
        suggestions.add(book.title)
      }

      // 作者建議
      if (book.author && book.author.toLowerCase().includes(normalizedInput)) {
        suggestions.add(book.author)
      }

      // 分類建議
      if (book.category && book.category.toLowerCase().includes(normalizedInput)) {
        suggestions.add(book.category)
      }

      // 標籤建議
      if (book.tags && Array.isArray(book.tags)) {
        book.tags.forEach(tag => {
          if (tag.toLowerCase().includes(normalizedInput)) {
            suggestions.add(tag)
          }
        })
      }
    })

    return Array.from(suggestions).slice(0, 8)
  }

  /**
   * 取得效能統計
   *
   * @returns {Object} 效能統計資料
   */
  getPerformanceStats () {
    return {
      searchCount: this.stats.searchCount,
      averageSearchTime: this.stats.searchCount > 0
        ? (this.stats.totalSearchTime / this.stats.searchCount)
        : 0,
      totalResultsReturned: this.stats.totalResultsReturned,
      cacheHitRate: this.stats.searchCount > 0
        ? (this.stats.cacheHits / this.stats.searchCount)
        : 0
    }
  }

  /**
   * 清除搜尋快取
   */
  clearCache () {
    this.searchCache.clear()
  }

  // ===============================
  // 私有方法 - 效能優化
  // ===============================

  /**
   * 智能快取管理
   *
   * @param {string} key - 快取鍵
   * @param {Array} results - 搜尋結果
   */
  _manageCache (key, results) {
    if (!this.config.cacheEnabled) return

    // 檢查快取大小限制
    if (this.searchCache.size >= CONSTANTS.CONFIG.THRESHOLDS.CACHE_SIZE_LIMIT) {
      this._evictCache()
    }

    // 加入快取並記錄時間戳
    this.searchCache.set(key, {
      results,
      timestamp: Date.now(),
      accessCount: 1
    })
  }

  /**
   * 快取淘汰策略
   */
  _evictCache () {
    const entries = Array.from(this.searchCache.entries())

    // LRU 策略：移除最少使用的快取項目
    entries.sort((a, b) => {
      const aData = a[1]
      const bData = b[1]

      // 先按存取次數排序，再按時間戳排序
      if (aData.accessCount !== bData.accessCount) {
        return aData.accessCount - bData.accessCount
      }
      return aData.timestamp - bData.timestamp
    })

    // 移除前 25% 的項目
    const itemsToRemove = Math.floor(entries.length * 0.25)
    for (let i = 0; i < itemsToRemove; i++) {
      this.searchCache.delete(entries[i][0])
    }
  }

  /**
   * 從快取獲取結果
   *
   * @param {string} key - 快取鍵
   * @returns {Array|null} 快取的結果或 null
   */
  _getCachedResult (key) {
    if (!this.config.cacheEnabled || !this.searchCache.has(key)) {
      return null
    }

    const cacheData = this.searchCache.get(key)
    cacheData.accessCount++
    cacheData.timestamp = Date.now()

    this.stats.cacheHits++
    return cacheData.results
  }

  /**
   * 批量處理搜尋結果
   *
   * @param {Array} books - 書籍陣列
   * @param {Function} processor - 處理函數
   * @returns {Array} 處理結果
   */
  _batchProcess (books, processor) {
    const results = []
    const batchSize = CONSTANTS.CONFIG.THRESHOLDS.BATCH_SIZE

    for (let i = 0; i < books.length; i += batchSize) {
      const batch = books.slice(i, i + batchSize)
      const batchResults = batch.map(processor).filter(result => result !== null)
      results.push(...batchResults)
    }

    return results
  }

  /**
   * 更新統計資料
   *
   * @param {number} searchTime - 搜尋時間
   * @param {number} resultCount - 結果數量
   */
  updateStats (searchTime, resultCount) {
    this.stats.searchCount++
    this.stats.totalSearchTime += searchTime
    this.stats.totalResultsReturned += resultCount
  }

  /**
   * 重置效能統計
   */
  _resetStats () {
    this.stats = {
      searchCount: 0,
      totalSearchTime: 0,
      totalResultsReturned: 0,
      cacheHits: 0
    }
  }
}

// CommonJS 匯出
module.exports = BookSearchFilter
