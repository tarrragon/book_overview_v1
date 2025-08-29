/**
 * SearchEngine - 搜尋引擎核心
 * TDD 循環 2/8 - BookSearchFilter 職責拆分重構
 *
 * 負責功能：
 * - 執行搜尋操作和匹配演算法
 * - 查詢驗證和正規化
 * - 搜尋條件匹配邏輯
 * - 多欄位搜尋支援（書名、作者、標籤）
 * - 搜尋效能監控
 *
 * 設計考量：
 * - 單一職責：專注於搜尋邏輯，不處理索引管理或快取
 * - 索引優化：優先使用索引搜尋，回退到線性搜尋
 * - 效能監控：記錄搜尋時間和統計資料
 * - 事件驅動：搜尋完成時發送事件
 * - 錯誤處理：健壯的錯誤處理和邊界條件
 *
 * 處理流程：
 * 1. 驗證和正規化查詢
 * 2. 嘗試使用索引進行快速搜尋
 * 3. 回退到線性搜尋（如需要）
 * 4. 合併和去重結果
 * 5. 記錄效能統計並發送事件
 *
 * //todo: 技術債務 - 效能警告測試 mock 問題
 * 效能警告功能在實際運行時正常工作，但測試環境中 performance.now()
 * 的 mock 無法正確應用。這是純技術性測試問題，不影響實際功能。
 * 可考慮使用依賴注入時間函數或重構時間測量邏輯以便於測試。
 *
 * @version 1.0.0
 * @since 2025-08-20
 */

class SearchEngine {
  /**
   * 建構 SearchEngine 實例
   *
   * @param {Object} options - 配置選項
   * @param {Object} options.indexManager - 索引管理器實例
   * @param {Object} options.eventBus - 事件總線實例
   * @param {Object} options.logger - 日誌記錄器實例
   * @param {Object} options.config - 自定義配置
   * @param {Function} options.getCurrentTime - 時間函數（用於測試注入）
   */
  constructor (options = {}) {
    const { indexManager, eventBus, logger, config = {}, getCurrentTime } = options

    if (!indexManager || !eventBus || !logger) {
      throw new Error('IndexManager、EventBus 和 Logger 是必需的')
    }

    this.indexManager = indexManager
    this.eventBus = eventBus
    this.logger = logger
    
    // 注入的時間函數（用於測試）
    this._timeFunction = getCurrentTime || this._getDefaultTimeFunction()

    // 合併預設配置和自定義配置
    this.config = {
      maxQueryLength: 100,
      minQueryLength: 1,
      enableFuzzySearch: true,
      fuzzyThreshold: 0.5,
      maxResults: 1000,
      enableWeightedSearch: true,
      performanceWarningThreshold: 1000, // 1秒
      ...config
    }

    // 初始化效能統計
    this._initializePerformanceStats()
  }

  /**
   * 初始化效能統計
   * @private
   */
  _initializePerformanceStats () {
    this.performanceStats = {
      totalSearches: 0,
      totalSearchTime: 0,
      averageSearchTime: 0,
      fastestSearch: null,
      slowestSearch: null,
      indexBasedSearches: 0,
      linearSearches: 0
    }
  }

  /**
   * 驗證搜尋查詢
   *
   * @param {string} query - 搜尋查詢
   * @returns {Object} 驗證結果 { isValid: boolean, error?: string }
   */
  validateQuery (query) {
    if (typeof query !== 'string') {
      return {
        isValid: false,
        error: '查詢必須是字串'
      }
    }

    const trimmedQuery = query.trim()
    if (trimmedQuery.length > this.config.maxQueryLength) {
      return {
        isValid: false,
        error: `查詢長度必須在 ${this.config.minQueryLength} 到 ${this.config.maxQueryLength} 個字元之間`
      }
    }

    // 允許空查詢（用於返回所有結果）
    if (trimmedQuery.length === 0) {
      return { isValid: true }
    }

    if (trimmedQuery.length < this.config.minQueryLength) {
      return {
        isValid: false,
        error: `查詢長度必須在 ${this.config.minQueryLength} 到 ${this.config.maxQueryLength} 個字元之間`
      }
    }

    return { isValid: true }
  }

  /**
   * 正規化搜尋查詢
   *
   * @param {string} query - 原始查詢
   * @returns {string} 正規化後的查詢
   */
  normalizeQuery (query) {
    return query.toLowerCase().trim().replace(/\s+/g, ' ')
  }

  /**
   * 執行搜尋
   *
   * @param {string} query - 搜尋查詢
   * @param {Array} books - 書籍陣列
   * @returns {Promise<Array>} 搜尋結果
   */
  async search (query, books) {
    const startTime = this._getCurrentTime()

    try {
      // 處理無效輸入
      if (!books || !Array.isArray(books)) {
        return []
      }

      // 驗證查詢
      const validation = this.validateQuery(query)
      if (!validation.isValid) {
        this.logger.warn('搜尋查詢驗證失敗', { query, error: validation.error })
        return []
      }

      // 正規化查詢
      const normalizedQuery = this.normalizeQuery(query)

      // 空查詢返回所有結果
      if (normalizedQuery === '') {
        const results = books.slice(0, this.config.maxResults)

        // 記錄效能統計
        const endTime = this._getCurrentTime()
        const searchTime = endTime - startTime
        this._recordPerformance(searchTime, normalizedQuery, results.length)

        // 發送搜尋完成事件
        this.eventBus.emit('SEARCH.COMPLETED', {
          query: normalizedQuery,
          results,
          resultCount: results.length,
          searchTime,
          timestamp: endTime
        })

        return results
      }

      // 執行搜尋
      let results = []

      try {
        // 嘗試使用索引搜尋
        results = await this._performIndexBasedSearch(normalizedQuery, books)
        this.performanceStats.indexBasedSearches++
      } catch (error) {
        this.logger.warn('索引搜尋失敗，回退到線性搜尋', { error: error.message })
        // 回退到線性搜尋
        results = await this._performLinearSearch(normalizedQuery, books)
        this.performanceStats.linearSearches++
      }

      // 限制結果數量
      if (results.length > this.config.maxResults) {
        results = results.slice(0, this.config.maxResults)
      }

      // 記錄效能統計
      const endTime = this._getCurrentTime()
      const searchTime = endTime - startTime
      this._recordPerformance(searchTime, normalizedQuery, results.length)

      // 發送搜尋完成事件
      this.eventBus.emit('SEARCH.COMPLETED', {
        query: normalizedQuery,
        results,
        resultCount: results.length,
        searchTime,
        timestamp: endTime
      })

      return results
    } catch (error) {
      this.logger.error('搜尋過程中發生錯誤', { query, error: error.message })
      return []
    }
  }

  /**
   * 執行索引基礎搜尋
   * @private
   */
  async _performIndexBasedSearch (query, books) {
    const results = new Set()
    const queryWords = query.split(' ').filter(word => word.length > 0)

    // 如果書籍陣列為空，直接返回空結果
    if (!books || books.length === 0) {
      return []
    }

    for (const word of queryWords) {
      // 從書名索引搜尋
      if (this.indexManager.titleIndex.has(word)) {
        const titleMatches = this.indexManager.titleIndex.get(word)
        titleMatches.forEach(book => {
          // 只加入實際存在於當前書籍陣列中的書籍
          if (books.some(b => b && b.id === book.id)) {
            results.add(book)
          }
        })
      }

      // 從作者索引搜尋
      if (this.indexManager.authorIndex.has(word)) {
        const authorMatches = this.indexManager.authorIndex.get(word)
        authorMatches.forEach(book => {
          if (books.some(b => b && b.id === book.id)) {
            results.add(book)
          }
        })
      }

      // 從標籤索引搜尋
      if (this.indexManager.tagIndex.has(word)) {
        const tagMatches = this.indexManager.tagIndex.get(word)
        tagMatches.forEach(book => {
          if (books.some(b => b && b.id === book.id)) {
            results.add(book)
          }
        })
      }
    }

    // 如果索引搜尋沒有結果，回退到線性搜尋
    if (results.size === 0) {
      throw new Error('索引搜尋無結果，需要線性搜尋')
    }

    return Array.from(results)
  }

  /**
   * 執行線性搜尋
   * @private
   */
  async _performLinearSearch (query, books) {
    const results = []

    for (const book of books) {
      // 跳過 null 或 undefined 書籍
      if (!book) {
        this.logger.warn('跳過空書籍', { book })
        continue
      }

      try {
        if (this._matchesSearchCriteria(book, query)) {
          results.push(book)
        }
      } catch (error) {
        this.logger.warn('跳過無效書籍', { bookId: book?.id, error: error.message })
        continue
      }
    }

    return results
  }

  /**
   * 檢查書籍是否符合搜尋條件
   * @private
   */
  _matchesSearchCriteria (book, query) {
    if (!book || typeof book !== 'object') {
      throw new Error('無效的書籍資料格式')
    }

    // 檢查書名
    if (book.title && typeof book.title === 'string') {
      const titleLower = book.title.toLowerCase()
      if (titleLower.includes(query)) {
        return true
      }

      // 支援模糊匹配
      if (this.config.enableFuzzySearch) {
        const fuzzyScore = this._calculateFuzzyScore(titleLower, query)
        if (fuzzyScore > 0) {
          return true
        }
      }
    }

    // 檢查作者
    if (book.author && typeof book.author === 'string') {
      const authorLower = book.author.toLowerCase()
      if (authorLower.includes(query)) {
        return true
      }

      // 支援模糊匹配
      if (this.config.enableFuzzySearch) {
        const fuzzyScore = this._calculateFuzzyScore(authorLower, query)
        if (fuzzyScore > 0) {
          return true
        }
      }
    }

    // 檢查標籤
    if (book.tags && Array.isArray(book.tags)) {
      for (const tag of book.tags) {
        if (typeof tag === 'string') {
          const tagLower = tag.toLowerCase()
          if (tagLower.includes(query)) {
            return true
          }

          // 支援模糊匹配
          if (this.config.enableFuzzySearch) {
            const fuzzyScore = this._calculateFuzzyScore(tagLower, query)
            if (fuzzyScore > 0) {
              return true
            }
          }
        }
      }
    }

    return false
  }

  /**
   * 帶評分的搜尋
   *
   * @param {string} query - 搜尋查詢
   * @param {Array} books - 書籍陣列
   * @param {Object} fieldWeights - 欄位權重 { title: 1.0, author: 0.8, tags: 0.6 }
   * @returns {Promise<Array>} 帶評分的搜尋結果 [{ book, score }]
   */
  async searchWithScoring (query, books, fieldWeights = null) {
    const defaultWeights = { title: 1.0, author: 0.8, tags: 0.6 }
    const weights = fieldWeights || defaultWeights

    if (!books || !Array.isArray(books)) {
      return []
    }

    const normalizedQuery = this.normalizeQuery(query)
    const results = []

    for (const book of books) {
      try {
        const score = this._calculateBookScore(book, normalizedQuery, weights)
        if (score > 0) {
          results.push({ book, score })
        }
      } catch (error) {
        this.logger.warn('計算書籍評分時出錯', { bookId: book?.id, error: error.message })
        continue
      }
    }

    // 按評分排序（降序）
    results.sort((a, b) => b.score - a.score)

    return results.slice(0, this.config.maxResults)
  }

  /**
   * 計算書籍評分
   * @private
   */
  _calculateBookScore (book, query, weights) {
    let score = 0

    // 書名匹配評分
    if (book.title && typeof book.title === 'string') {
      const titleScore = this._calculateFieldScore(book.title, query)
      score += titleScore * weights.title
    }

    // 作者匹配評分
    if (book.author && typeof book.author === 'string') {
      const authorScore = this._calculateFieldScore(book.author, query)
      score += authorScore * weights.author
    }

    // 標籤匹配評分
    if (book.tags && Array.isArray(book.tags)) {
      let maxTagScore = 0
      for (const tag of book.tags) {
        if (typeof tag === 'string') {
          const tagScore = this._calculateFieldScore(tag, query)
          maxTagScore = Math.max(maxTagScore, tagScore)
        }
      }
      score += maxTagScore * weights.tags
    }

    return Math.min(score, 1.0) // 評分上限為 1.0
  }

  /**
   * 計算欄位評分
   * @private
   */
  _calculateFieldScore (field, query) {
    const normalizedField = field.toLowerCase()
    const queryWords = query.split(' ').filter(word => word.length > 0)

    let matchCount = 0
    let exactMatch = false

    // 檢查完全匹配
    if (normalizedField === query) {
      exactMatch = true
    }

    // 檢查包含匹配
    if (normalizedField.includes(query)) {
      matchCount += queryWords.length
    } else {
      // 檢查個別詞匹配
      for (const word of queryWords) {
        if (normalizedField.includes(word)) {
          matchCount++
        }
      }
    }

    // 計算評分
    let score = matchCount / queryWords.length

    // 完全匹配加成
    if (exactMatch) {
      score += 0.2
    }

    // 模糊匹配支援
    if (this.config.enableFuzzySearch && score < this.config.fuzzyThreshold) {
      const fuzzyScore = this._calculateFuzzyScore(normalizedField, query)
      score = Math.max(score, fuzzyScore)
    }

    return Math.min(score, 1.0)
  }

  /**
   * 計算模糊匹配評分
   * @private
   */
  _calculateFuzzyScore (field, query) {
    // 改善的模糊匹配：使用編輯距離
    const distance = this._calculateEditDistance(field, query)
    const maxLength = Math.max(field.length, query.length)

    if (maxLength === 0) return 0

    const similarity = 1 - (distance / maxLength)

    // 降低模糊匹配門檻，並對相似度進行調整
    // 如果相似度達到 0.7 以上，給予更高的評分
    if (similarity >= 0.7) {
      return similarity * 0.9 // 高相似度給予更高權重
    } else if (similarity >= this.config.fuzzyThreshold) {
      return similarity * 0.7 // 中等相似度
    }

    return 0
  }

  /**
   * 計算編輯距離（簡化版）
   * @private
   */
  _calculateEditDistance (str1, str2) {
    const len1 = str1.length
    const len2 = str2.length

    if (len1 === 0) return len2
    if (len2 === 0) return len1

    const matrix = []

    // 初始化矩陣
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j
    }

    // 填充矩陣
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

    return matrix[len1][len2]
  }

  /**
   * 使用自定義匹配函數搜尋
   *
   * @param {Function} matcher - 自定義匹配函數 (book, query) => boolean
   * @param {string} query - 搜尋查詢
   * @param {Array} books - 書籍陣列
   * @returns {Promise<Array>} 搜尋結果
   */
  async searchWithMatcher (matcher, query, books) {
    if (!books || !Array.isArray(books)) {
      return []
    }

    const normalizedQuery = this.normalizeQuery(query)
    const results = []

    for (const book of books) {
      try {
        if (matcher(book, normalizedQuery)) {
          results.push(book)
        }
      } catch (error) {
        this.logger.warn('自定義匹配器執行錯誤', { bookId: book?.id, error: error.message })
        continue
      }
    }

    return results.slice(0, this.config.maxResults)
  }

  /**
   * 記錄效能統計
   * @private
   */
  _recordPerformance (searchTime, query, resultCount) {
    this.performanceStats.totalSearches++
    this.performanceStats.totalSearchTime += searchTime
    this.performanceStats.averageSearchTime =
      this.performanceStats.totalSearchTime / this.performanceStats.totalSearches

    if (this.performanceStats.fastestSearch === null ||
        searchTime < this.performanceStats.fastestSearch) {
      this.performanceStats.fastestSearch = searchTime
    }

    if (this.performanceStats.slowestSearch === null ||
        searchTime > this.performanceStats.slowestSearch) {
      this.performanceStats.slowestSearch = searchTime
    }

    // 發送效能事件
    this.eventBus.emit('SEARCH.PERFORMANCE.RECORDED', {
      query,
      searchTime,
      resultCount,
      searchType: this.performanceStats.indexBasedSearches > this.performanceStats.linearSearches ? 'index' : 'linear',
      timestamp: Date.now()
    })

    // 檢查效能警告
    if (searchTime > this.config.performanceWarningThreshold) {
      this.eventBus.emit('SEARCH.PERFORMANCE.WARNING', {
        type: 'slow_search',
        searchTime,
        threshold: this.config.performanceWarningThreshold,
        query,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 取得效能統計
   *
   * @returns {Object} 效能統計資料
   */
  getPerformanceStats () {
    return { ...this.performanceStats }
  }

  /**
   * 重置效能統計
   */
  resetPerformanceStats () {
    this._initializePerformanceStats()
  }

  /**
   * 取得當前時間 (支援測試中的 mock)
   * @private
   * @returns {number} 當前時間戳
   */
  /**
   * 取得預設時間函數
   * @returns {Function} 時間函數
   */
  _getDefaultTimeFunction () {
    return () => {
      // 在測試環境中，優先使用 global.performance
      if (typeof global !== 'undefined' && global.performance && typeof global.performance.now === 'function') {
        return global.performance.now()
      }
      
      // 在瀏覽器環境中，使用 performance
      if (typeof performance !== 'undefined' && performance.now) {
        return performance.now()
      }
      
      // 後備方案
      return Date.now()
    }
  }

  /**
   * 取得當前時間（支援依賴注入）
   * @returns {number} 當前時間戳
   */
  _getCurrentTime () {
    return this._timeFunction()
  }

  /**
   * 處理搜尋請求事件
   *
   * @param {Object} request - 搜尋請求 { query, books, options }
   */
  handleSearchRequest (request) {
    const { query, books, options = {} } = request

    // 發送請求接收事件
    this.eventBus.emit('SEARCH.REQUEST.RECEIVED', {
      query,
      timestamp: Date.now()
    })

    // 異步執行搜尋
    this.search(query, books)
      .then(results => {
        this.eventBus.emit('SEARCH.REQUEST.COMPLETED', {
          query,
          results,
          timestamp: Date.now()
        })
      })
      .catch(error => {
        this.logger.error('處理搜尋請求時發生錯誤', { query, error: error.message })
        this.eventBus.emit('SEARCH.REQUEST.FAILED', {
          query,
          error: error.message,
          timestamp: Date.now()
        })
      })
  }

  /**
   * 處理索引更新事件
   *
   * @param {Object} indexStats - 索引統計資料
   */
  handleIndexUpdate (indexStats) {
    this.logger.info('搜尋引擎已更新索引統計', indexStats)

    this.eventBus.emit('SEARCH.INDEX.UPDATED', {
      ...indexStats,
      timestamp: Date.now()
    })
  }

  /**
   * 銷毀搜尋引擎
   */
  destroy () {
    this.resetPerformanceStats()
  }
}

module.exports = SearchEngine
