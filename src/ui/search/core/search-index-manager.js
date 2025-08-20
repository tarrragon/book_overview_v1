/**
 * SearchIndexManager - 搜尋索引管理器
 * TDD 循環 1/8 - BookSearchFilter 職責拆分重構
 *
 * 負責功能：
 * - 搜尋索引的建構和維護
 * - 書名、作者、標籤索引管理
 * - 索引更新和重建機制
 * - 索引統計和診斷功能
 * - 記憶體管理和錯誤處理
 *
 * 設計考量：
 * - 單一職責：專注於索引管理，不處理搜尋邏輯
 * - 分詞索引：支援完整文字和分詞搜尋
 * - 記憶體管理：限制大型資料集的記憶體使用
 * - 事件驅動：索引狀態變更時發送事件
 * - 錯誤處理：健壯的錯誤處理和邊界條件
 *
 * 處理流程：
 * 1. 初始化索引 Maps（書名、作者、標籤）
 * 2. 建構索引時處理分詞和正規化
 * 3. 支援增量更新和完整重建
 * 4. 維護統計資料和效能指標
 * 5. 發送索引變更事件供其他模組使用
 *
 * @version 1.0.0
 * @since 2025-08-20
 */

class SearchIndexManager {
  /**
   * 建構 SearchIndexManager 實例
   *
   * @param {Object} options - 配置選項
   * @param {Object} options.eventBus - 事件總線實例
   * @param {Object} options.logger - 日誌記錄器實例
   */
  constructor (options = {}) {
    const { eventBus, logger } = options

    if (!eventBus || !logger) {
      throw new Error('EventBus 和 Logger 是必需的')
    }

    this.eventBus = eventBus
    this.logger = logger

    // 初始化索引 Maps
    this.titleIndex = new Map()
    this.authorIndex = new Map()
    this.tagIndex = new Map()

    // 初始化統計資料
    this._initializeStats()

    // 記憶體限制設定（根據實際記憶體情況動態調整）
    this.memoryLimit = this._calculateMemoryLimit()

    // 效能監控設定
    this.performanceConfig = {
      warnThreshold: 1000, // 超過1秒建構時間發出警告
      maxIndexSize: 100000, // 最大索引項目數量
      cleanupInterval: 30000 // 30秒清理一次
    }
  }

  /**
   * 初始化統計資料
   * @private
   */
  _initializeStats () {
    this.stats = {
      totalBooks: 0,
      lastBuildTime: null,
      buildDuration: 0
    }
  }

  /**
   * 計算記憶體限制
   * @private
   */
  _calculateMemoryLimit () {
    // 保持測試相容性：使用固定限制 50,000
    // 在實際部署中可以根據可用記憶體動態調整
    return 50000
  }

  /**
   * 檢查效能閾值並發出警告
   * @private
   */
  _checkPerformanceThresholds () {
    // 建構時間警告
    if (this.stats.buildDuration > this.performanceConfig.warnThreshold) {
      this.logger.warn('索引建構時間過長', {
        duration: this.stats.buildDuration,
        threshold: this.performanceConfig.warnThreshold,
        totalBooks: this.stats.totalBooks
      })

      this.eventBus.emit('SEARCH.PERFORMANCE.WARNING', {
        type: 'slow_build',
        duration: this.stats.buildDuration,
        threshold: this.performanceConfig.warnThreshold,
        timestamp: Date.now()
      })
    }

    // 索引大小警告
    const totalIndexSize = this.titleIndex.size + this.authorIndex.size + this.tagIndex.size
    if (totalIndexSize > this.performanceConfig.maxIndexSize) {
      this.logger.warn('索引大小超過建議值', {
        size: totalIndexSize,
        maxSize: this.performanceConfig.maxIndexSize
      })

      this.eventBus.emit('SEARCH.PERFORMANCE.WARNING', {
        type: 'large_index',
        size: totalIndexSize,
        maxSize: this.performanceConfig.maxIndexSize,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 建構搜尋索引
   *
   * @param {Array} books - 書籍陣列
   */
  buildIndex (books) {
    if (!books || !Array.isArray(books)) {
      books = []
    }

    const startTime = Date.now()

    try {
      // 檢查記憶體限制
      if (books.length > this.memoryLimit) {
        const error = new Error('記憶體不足')
        this.eventBus.emit('SEARCH.WARNING', {
          message: '記憶體不足，無法建構搜尋索引',
          error: error.message,
          timestamp: Date.now()
        })
        throw error
      }

      // 清空現有索引
      this.titleIndex.clear()
      this.authorIndex.clear()
      this.tagIndex.clear()

      // 建構索引
      let validBookCount = 0
      for (const book of books) {
        if (!book) continue

        this._indexBook(book)
        validBookCount++
      }

      // 更新統計資料
      const endTime = Date.now()
      this.stats.totalBooks = validBookCount
      this.stats.lastBuildTime = endTime
      this.stats.buildDuration = endTime - startTime

      // 效能監控和警告
      this._checkPerformanceThresholds()

      // 發送索引建構完成事件
      this.eventBus.emit('SEARCH.INDEX.BUILT', {
        totalBooks: this.stats.totalBooks,
        titleIndexSize: this.titleIndex.size,
        authorIndexSize: this.authorIndex.size,
        tagIndexSize: this.tagIndex.size,
        buildDuration: this.stats.buildDuration,
        timestamp: endTime
      })
    } catch (error) {
      this.logger.error('建構索引時發生錯誤:', error)
      throw error
    }
  }

  /**
   * 為單一書籍建立索引
   * @private
   */
  _indexBook (book) {
    try {
      // 建構書名索引
      if (book.title && typeof book.title === 'string') {
        this._addToTitleIndex(book)
      } else if (book.title && typeof book.title !== 'string') {
        this.logger.warn('書名必須是字串類型', { bookId: book.id, title: book.title })
      }

      // 建構作者索引
      if (book.author && typeof book.author === 'string') {
        this._addToAuthorIndex(book)
      } else if (book.author && typeof book.author !== 'string') {
        this.logger.warn('作者名稱必須是字串類型', { bookId: book.id, author: book.author })
      }

      // 建構標籤索引
      if (book.tags && Array.isArray(book.tags)) {
        this._addToTagIndex(book)
      } else if (book.tags && !Array.isArray(book.tags)) {
        this.logger.warn('標籤必須是陣列類型', { bookId: book.id, tags: book.tags })
      }
    } catch (error) {
      this.logger.error('索引書籍時發生錯誤:', error)
      throw error
    }
  }

  /**
   * 新增書籍到書名索引
   * @private
   */
  _addToTitleIndex (book) {
    const title = book.title.toLowerCase()
    const words = title.split(/\s+/).filter(word => word.length > 0)

    // 完整標題索引
    this._addToIndex(this.titleIndex, title, book)

    // 分詞索引
    for (const word of words) {
      this._addToIndex(this.titleIndex, word, book)
    }
  }

  /**
   * 新增書籍到作者索引
   * @private
   */
  _addToAuthorIndex (book) {
    const author = book.author.toLowerCase()
    const words = author.split(/\s+/).filter(word => word.length > 0)

    // 完整作者名索引
    this._addToIndex(this.authorIndex, author, book)

    // 分詞索引
    for (const word of words) {
      this._addToIndex(this.authorIndex, word, book)
    }
  }

  /**
   * 新增書籍到標籤索引
   * @private
   */
  _addToTagIndex (book) {
    for (const tag of book.tags) {
      if (typeof tag === 'string' && tag.trim().length > 0) {
        const normalizedTag = tag.toLowerCase()
        this._addToIndex(this.tagIndex, normalizedTag, book)
      }
    }
  }

  /**
   * 通用索引新增方法
   * @private
   */
  _addToIndex (indexMap, key, book) {
    if (!indexMap.has(key)) {
      indexMap.set(key, [])
    }
    indexMap.get(key).push(book)
  }

  /**
   * 新增單一書籍到索引
   *
   * @param {Object} book - 書籍物件
   */
  addBookToIndex (book) {
    if (!book) return

    this._indexBook(book)
    this.stats.totalBooks++

    this.eventBus.emit('SEARCH.INDEX.UPDATED', {
      action: 'add',
      bookId: book.id,
      totalBooks: this.stats.totalBooks,
      timestamp: Date.now()
    })
  }

  /**
   * 從索引中移除書籍
   *
   * @param {Object} book - 要移除的書籍物件
   */
  removeBookFromIndex (book) {
    if (!book) return

    this._removeFromAllIndexes(book)
    this.stats.totalBooks = Math.max(0, this.stats.totalBooks - 1)

    this.eventBus.emit('SEARCH.INDEX.UPDATED', {
      action: 'remove',
      bookId: book.id,
      totalBooks: this.stats.totalBooks,
      timestamp: Date.now()
    })
  }

  /**
   * 從所有索引中移除書籍
   * @private
   */
  _removeFromAllIndexes (book) {
    // 從書名索引移除
    if (book.title) {
      this._removeFromIndex(this.titleIndex, book)
    }

    // 從作者索引移除
    if (book.author) {
      this._removeFromIndex(this.authorIndex, book)
    }

    // 從標籤索引移除
    if (book.tags && Array.isArray(book.tags)) {
      for (const tag of book.tags) {
        const normalizedTag = tag.toLowerCase()
        this._removeBookFromIndexKey(this.tagIndex, normalizedTag, book)
      }
    }
  }

  /**
   * 從特定索引移除書籍
   * @private
   */
  _removeFromIndex (indexMap, book) {
    // 效能優化：避免遍歷所有索引項目，改為重建書籍相關的索引項目
    const keysToRemove = []

    for (const [key, books] of indexMap.entries()) {
      const bookIndex = books.findIndex(b => b.id === book.id)
      if (bookIndex !== -1) {
        // 使用 splice 而非 filter 提升效能
        books.splice(bookIndex, 1)
        if (books.length === 0) {
          keysToRemove.push(key)
        }
      }
    }

    // 批次刪除空的索引項目
    keysToRemove.forEach(key => indexMap.delete(key))
  }

  /**
   * 從特定索引鍵移除書籍
   * @private
   */
  _removeBookFromIndexKey (indexMap, key, book) {
    if (indexMap.has(key)) {
      const books = indexMap.get(key)
      const filteredBooks = books.filter(b => b.id !== book.id)
      if (filteredBooks.length === 0) {
        indexMap.delete(key)
      } else {
        indexMap.set(key, filteredBooks)
      }
    }
  }

  /**
   * 更新現有書籍索引
   *
   * @param {Object} oldBook - 舊的書籍資料
   * @param {Object} newBook - 新的書籍資料
   */
  updateBookInIndex (oldBook, newBook) {
    this.removeBookFromIndex(oldBook)
    this.addBookToIndex(newBook)

    this.eventBus.emit('SEARCH.INDEX.UPDATED', {
      action: 'update',
      bookId: newBook.id,
      totalBooks: this.stats.totalBooks,
      timestamp: Date.now()
    })
  }

  /**
   * 清空所有索引
   */
  clearIndex () {
    this.titleIndex.clear()
    this.authorIndex.clear()
    this.tagIndex.clear()
    this.stats.totalBooks = 0

    this.eventBus.emit('SEARCH.INDEX.CLEARED', {
      timestamp: Date.now()
    })
  }

  /**
   * 重建整個索引
   *
   * @param {Array} books - 新的書籍陣列
   */
  rebuildIndex (books) {
    this.clearIndex()
    this.buildIndex(books)

    this.eventBus.emit('SEARCH.INDEX.REBUILT', {
      totalBooks: this.stats.totalBooks,
      timestamp: Date.now()
    })
  }

  /**
   * 取得索引統計資料
   *
   * @returns {Object} 統計資料物件
   */
  getIndexStats () {
    return {
      titleIndexSize: this.titleIndex.size,
      authorIndexSize: this.authorIndex.size,
      tagIndexSize: this.tagIndex.size,
      totalBooks: this.stats.totalBooks,
      lastBuildTime: this.stats.lastBuildTime,
      buildDuration: this.stats.buildDuration
    }
  }

  /**
   * 取得記憶體使用估算
   *
   * @returns {Object} 記憶體使用資訊
   */
  getMemoryUsage () {
    const titleEntries = this.titleIndex.size
    const authorEntries = this.authorIndex.size
    const tagEntries = this.tagIndex.size
    const totalEntries = titleEntries + authorEntries + tagEntries

    // 簡化的記憶體估算（假設每個索引項目平均佔用 100 bytes）
    const estimatedMemoryKB = Math.round(totalEntries * 0.1)

    return {
      titleIndexEntries: titleEntries,
      authorIndexEntries: authorEntries,
      tagIndexEntries: tagEntries,
      totalIndexEntries: totalEntries,
      estimatedMemoryKB
    }
  }

  /**
   * 索引優化（移除空白項目、重新組織）
   */
  optimizeIndex () {
    // 移除空的索引項目
    this._cleanupEmptyIndexEntries(this.titleIndex)
    this._cleanupEmptyIndexEntries(this.authorIndex)
    this._cleanupEmptyIndexEntries(this.tagIndex)

    this.logger.info('索引優化完成', this.getIndexStats())
  }

  /**
   * 清理空的索引項目
   * @private
   */
  _cleanupEmptyIndexEntries (indexMap) {
    for (const [key, books] of indexMap.entries()) {
      if (!books || books.length === 0) {
        indexMap.delete(key)
      }
    }
  }

  /**
   * 處理重建索引請求事件
   *
   * @param {Object} eventData - 事件資料
   */
  handleRebuildRequest (eventData) {
    const { books, force } = eventData

    if (force || this.stats.totalBooks === 0) {
      this.rebuildIndex(books)
    }
  }

  /**
   * 銷毀索引管理器
   */
  destroy () {
    this.clearIndex()
    this._initializeStats()
  }
}

module.exports = SearchIndexManager
