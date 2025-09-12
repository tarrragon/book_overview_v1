/**
 * SearchResultFormatter - 搜尋結果格式化器
 * TDD 循環 4/8 - BookSearchFilter 職責拆分重構
 *
 * 負責功能：
 * - 搜尋結果格式化和結構化
 * - 事件格式化和發送
 * - 結果統計和後設資料處理
 * - 結果分組和排序功能
 * - 相關性分數計算
 * - 效能統計整合
 *
 * 設計考量：
 * - 單一職責：專注於結果格式化，不處理搜尋邏輯
 * - 事件驅動：格式化完成後發送事件
 * - 統計監控：提供詳細的格式化統計資料
 * - 錯誤處理：健壯的邊界條件處理
 * - 可配置性：支援多種格式化選項
 *
 * 處理流程：
 * 1. 驗證輸入參數
 * 2. 格式化搜尋結果
 * 3. 計算相關性分數
 * 4. 生成後設資料
 * 5. 發送格式化事件
 *
 * @version 1.0.0
 * @since 2025-08-20
 */

const { StandardError } = require('src/core/errors/StandardError')

class SearchResultFormatter {
  /**
   * 建構 SearchResultFormatter 實例
   *
   * @param {Object} options - 配置選項
   * @param {Object} options.eventBus - 事件總線實例
   * @param {Object} options.logger - 日誌記錄器實例
   * @param {Object} options.config - 自定義配置
   */
  constructor (options = {}) {
    const { eventBus, logger, config = {} } = options

    if (!eventBus || !logger) {
      throw new StandardError('EVENTBUS_ERROR', 'EventBus 和 Logger 是必需的', {
        category: 'ui'
      })
    }

    this.eventBus = eventBus
    this.logger = logger

    // 合併預設配置和自定義配置
    this.config = {
      maxResultsToFormat: 100,
      enableStatistics: true,
      enableEvents: true,
      enableResultGrouping: false,
      defaultSortBy: 'relevance',
      scoreThreshold: 0.1,
      ...config
    }

    // 初始化內部狀態
    this._initializeStatistics()
    this._isDestroyed = false
  }

  /**
   * 初始化統計資料
   * @private
   */
  _initializeStatistics () {
    this.statistics = {
      totalFormatOperations: 0,
      totalResultsFormatted: 0,
      averageFormattingTime: 0,
      lastFormattingTime: 0,
      queryTypes: {
        singleWord: 0,
        multipleWords: 0,
        empty: 0
      }
    }
  }

  /**
   * 格式化搜尋結果
   *
   * @param {string} query - 搜尋查詢
   * @param {Array} rawResults - 原始搜尋結果
   * @returns {Object} 格式化後的結果對象
   */
  formatResults (query, rawResults) {
    if (this._isDestroyed) {
      throw new StandardError('UNKNOWN_ERROR', '格式化器已被銷毀', {
        category: 'ui'
      })
    }

    // 驗證輸入參數
    this._validateInputs(query, rawResults)

    const startTime = Date.now()

    try {
      // 限制結果數量
      const limitedResults = this._limitResults(rawResults)

      // 格式化每個結果項目
      const formattedResults = limitedResults.map(result =>
        this._formatSingleResult(result, query)
      ).filter(result => result !== null) // 過濾無效結果

      // 排序結果
      const sortedResults = this.sortResults(formattedResults, query, this.config.defaultSortBy)

      // 生成後設資料
      const metadata = this._generateMetadata(query, rawResults, sortedResults)

      const result = {
        query,
        results: sortedResults,
        metadata
      }

      // 記錄統計
      if (this.config.enableStatistics) {
        const formattingTime = Math.max(Date.now() - startTime, 1) // 確保至少 1ms
        this._recordStatistics(query, sortedResults.length, formattingTime)
      }

      return result
    } catch (error) {
      this.logger.error('格式化結果時發生錯誤', { query, error: error.message })
      throw error
    }
  }

  /**
   * 發送格式化結果事件
   *
   * @param {string} query - 搜尋查詢
   * @param {Array} rawResults - 原始搜尋結果
   */
  emitResults (query, rawResults) {
    if (!this.config.enableEvents) {
      return
    }

    try {
      const formattedResults = this.formatResults(query, rawResults)

      // 發送搜尋結果事件
      if (formattedResults.results.length === 0) {
        this.eventBus.emit('SEARCH.NO.RESULTS', {
          query,
          formattedResults,
          metadata: formattedResults.metadata
        })
      } else {
        this.eventBus.emit('SEARCH.RESULTS.UPDATED', {
          query,
          formattedResults,
          metadata: formattedResults.metadata
        })
      }

      // 發送搜尋狀態更新事件
      this.eventBus.emit('SEARCH.STATUS.CHANGED', {
        isSearching: false,
        hasQuery: query.trim() !== '',
        resultCount: formattedResults.results.length,
        hasMore: formattedResults.metadata.hasMore || false
      })
    } catch (error) {
      this.logger.error('發送結果事件時發生錯誤', { query, error: error.message })
    }
  }

  /**
   * 按指定方式分組結果
   *
   * @param {Array} results - 結果陣列
   * @param {string} groupBy - 分組鍵
   * @returns {Object} 分組後的結果
   */
  groupResults (results, groupBy) {
    const grouped = {}

    for (const result of results) {
      const originalData = result.originalData || result
      const groupKey = originalData[groupBy] || 'ungrouped'

      if (!grouped[groupKey]) {
        grouped[groupKey] = []
      }
      grouped[groupKey].push(result)
    }

    return grouped
  }

  /**
   * 排序搜尋結果
   *
   * @param {Array} results - 結果陣列
   * @param {string} query - 搜尋查詢
   * @param {string} sortBy - 排序方式
   * @returns {Array} 排序後的結果
   */
  sortResults (results, query, sortBy) {
    const sortedResults = [...results]

    switch (sortBy) {
      case 'relevance':
        // 先計算相關性分數（如果還沒有）
        const withRelevance = sortedResults.map(result => {
          if (result.relevanceScore === undefined) {
            const book = result.originalData || result
            result.relevanceScore = this.calculateRelevanceScore(book, query)
          }
          return result
        })
        return withRelevance.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))

      case 'title':
        return sortedResults.sort((a, b) => {
          const titleA = (a.formattedTitle || a.originalData?.title || a.title || '').toLowerCase()
          const titleB = (b.formattedTitle || b.originalData?.title || b.title || '').toLowerCase()
          return titleA.localeCompare(titleB)
        })

      case 'author':
        return sortedResults.sort((a, b) => {
          const authorA = (a.formattedAuthor || a.originalData?.author || a.author || '').toLowerCase()
          const authorB = (b.formattedAuthor || b.originalData?.author || b.author || '').toLowerCase()
          return authorA.localeCompare(authorB)
        })

      default:
        return sortedResults
    }
  }

  /**
   * 計算相關性分數
   *
   * @param {Object} book - 書籍對象
   * @param {string} query - 搜尋查詢
   * @returns {number} 相關性分數 (0-1)
   */
  calculateRelevanceScore (book, query) {
    if (!book || !query) return 0

    const normalizedQuery = query.toLowerCase().trim()
    if (!normalizedQuery) return 0

    let score = 0
    const title = (book.title || '').toLowerCase()
    const author = (book.author || '').toLowerCase()
    const tags = book.tags || []

    // 標題匹配 (權重: 60%)
    if (title === normalizedQuery) {
      score += 0.9 // 完全匹配得高分
    } else if (title.includes(normalizedQuery)) {
      score += 0.4 // 部分匹配
    } else {
      // 檢查標題中的單詞匹配
      const titleWords = title.split(/\s+/)
      const queryWords = normalizedQuery.split(/\s+/)
      const matchedWords = queryWords.filter(word =>
        titleWords.some(titleWord => titleWord.includes(word))
      )
      score += (matchedWords.length / queryWords.length) * 0.3
    }

    // 作者匹配 (權重: 25%)
    if (author.includes(normalizedQuery)) {
      score += 0.25
    }

    // 標籤匹配 (權重: 30%)
    if (Array.isArray(tags)) {
      const matchingTags = tags.filter(tag =>
        typeof tag === 'string' && tag.toLowerCase().includes(normalizedQuery)
      )
      if (matchingTags.length > 0) {
        score += Math.min(matchingTags.length * 0.25, 0.3)
      }
    }

    return Math.min(score, 1) // 確保分數不超過 1
  }

  /**
   * 取得統計資料
   *
   * @returns {Object} 統計資料
   */
  getStatistics () {
    return { ...this.statistics }
  }

  /**
   * 重置統計資料
   */
  resetStatistics () {
    this._initializeStatistics()
  }

  /**
   * 清理內部狀態
   */
  cleanup () {
    this.resetStatistics()
  }

  /**
   * 銷毀格式化器實例
   */
  destroy () {
    this.cleanup()
    this._isDestroyed = true
  }

  // ===== 私有方法 =====

  /**
   * 驗證輸入參數
   * @private
   */
  _validateInputs (query, results) {
    if (typeof query !== 'string') {
      throw new StandardError('UNKNOWN_ERROR', '查詢參數必須是字串', {
        category: 'ui'
      })
    }

    if (!Array.isArray(results)) {
      throw new StandardError('UNKNOWN_ERROR', '結果參數必須是陣列', {
        category: 'ui'
      })
    }
  }

  /**
   * 限制結果數量
   * @private
   */
  _limitResults (results) {
    return results.slice(0, this.config.maxResultsToFormat)
  }

  /**
   * 格式化單一結果項目
   * @private
   */
  _formatSingleResult (result, query) {
    if (!result || typeof result !== 'object' || !result.title) {
      this.logger.warn('跳過無效的結果項目', { result })
      return null
    }

    const relevanceScore = this.calculateRelevanceScore(result, query)

    return {
      originalData: result,
      formattedTitle: result.title,
      formattedAuthor: result.author || '',
      formattedProgress: this._formatProgress(result.readingProgress),
      relevanceScore
    }
  }

  /**
   * 格式化閱讀進度
   * @private
   */
  _formatProgress (progress) {
    if (typeof progress === 'number' && progress >= 0 && progress <= 1) {
      return `${Math.round(progress * 100)}%`
    }
    return '0%'
  }

  /**
   * 生成後設資料
   * @private
   */
  _generateMetadata (query, rawResults, formattedResults) {
    const totalAvailable = rawResults.length
    const totalFormatted = formattedResults.length
    const hasMore = totalAvailable > totalFormatted

    return {
      totalCount: totalFormatted,
      totalAvailable,
      hasMore,
      isEmpty: totalFormatted === 0,
      processingTime: this.statistics.lastFormattingTime,
      queryLength: query.length,
      avgRelevanceScore: this._calculateAverageRelevance(formattedResults)
    }
  }

  /**
   * 計算平均相關性分數
   * @private
   */
  _calculateAverageRelevance (results) {
    if (results.length === 0) return 0

    const totalScore = results.reduce((sum, result) => sum + (result.relevanceScore || 0), 0)
    return totalScore / results.length
  }

  /**
   * 記錄統計資料
   * @private
   */
  _recordStatistics (query, resultCount, formattingTime) {
    this.statistics.totalFormatOperations++
    this.statistics.totalResultsFormatted += resultCount
    this.statistics.lastFormattingTime = formattingTime

    // 計算平均格式化時間
    const totalTime = this.statistics.averageFormattingTime * (this.statistics.totalFormatOperations - 1) + formattingTime
    this.statistics.averageFormattingTime = totalTime / this.statistics.totalFormatOperations

    // 記錄查詢類型
    const trimmedQuery = query.trim()
    if (trimmedQuery === '') {
      this.statistics.queryTypes.empty++
    } else {
      const queryWords = trimmedQuery.split(/\s+/).filter(word => word.length > 0)
      if (queryWords.length === 1) {
        this.statistics.queryTypes.singleWord++
      } else {
        this.statistics.queryTypes.multipleWords++
      }
    }
  }
}

module.exports = SearchResultFormatter
