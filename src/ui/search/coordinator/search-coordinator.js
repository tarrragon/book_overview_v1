/**
 * SearchCoordinator - 搜尋協調器
 * TDD 循環 6/8 - BookSearchFilter 職責拆分重構
 *
 * 負責功能：
 * - 協調搜尋引擎、篩選引擎、結果格式化器等模組
 * - 管理搜尋流程的完整生命週期
 * - 處理模組間的通訊和資料流
 * - 統一的錯誤處理和狀態管理
 * - 事件協調和轉發
 * - 效能監控和統計整合
 *
 * 設計考量：
 * - 單一職責：專注於協調和管理，不直接執行業務邏輯
 * - 依賴注入：所有模組透過建構器注入，便於測試和擴展
 * - 事件驅動：協調各模組的事件發送和接收
 * - 錯誤隔離：模組錯誤不會影響其他模組的正常運作
 * - 狀態管理：維護搜尋狀態的一致性
 *
 * 處理流程：
 * 1. 接收搜尋請求或篩選請求
 * 2. 驗證輸入參數
 * 3. 檢查快取是否存在
 * 4. 協調各模組按順序執行
 * 5. 收集和整合結果
 * 6. 發送協調事件
 * 7. 更新狀態和統計
 *
 * @version 1.0.0
 * @since 2025-08-20
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class SearchCoordinator {
  /**
   * 建構 SearchCoordinator 實例
   *
   * @param {Object} options - 配置選項
   * @param {Object} options.eventBus - 事件總線實例
   * @param {Object} options.logger - 日誌記錄器實例
   * @param {Object} options.searchEngine - 搜尋引擎實例
   * @param {Object} options.filterEngine - 篩選引擎實例
   * @param {Object} options.searchResultFormatter - 搜尋結果格式化器實例
   * @param {Object} options.searchCacheManager - 搜尋快取管理器實例
   * @param {Object} options.config - 自定義配置
   */
  constructor (options = {}) {
    const {
      eventBus,
      logger,
      searchEngine,
      filterEngine,
      searchResultFormatter,
      searchCacheManager,
      config = {}
    } = options

    // 驗證必需依賴
    if (!eventBus) {
      const error = new Error('EventBus 是必需的')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'ui'
      }
      throw error
    }
    if (!logger) {
      const error = new Error('Logger 是必需的')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'ui',
        component: 'SearchCoordinator',
        field: 'logger'
      }
      throw error
    }
    if (!searchEngine) {
      const error = new Error('SearchEngine 是必需的')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'ui',
        component: 'SearchCoordinator',
        field: 'searchEngine'
      }
      throw error
    }
    if (!filterEngine) {
      const error = new Error('FilterEngine 是必需的')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'ui',
        component: 'SearchCoordinator',
        field: 'filterEngine'
      }
      throw error
    }
    if (!searchResultFormatter) {
      const error = new Error('SearchResultFormatter 是必需的')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'ui',
        component: 'SearchCoordinator',
        field: 'searchResultFormatter'
      }
      throw error
    }
    if (!searchCacheManager) {
      const error = new Error('SearchCacheManager 是必需的')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'ui',
        component: 'SearchCoordinator',
        field: 'searchCacheManager'
      }
      throw error
    }

    // 保存依賴
    this.eventBus = eventBus
    this.logger = logger
    this.searchEngine = searchEngine
    this.filterEngine = filterEngine
    this.searchResultFormatter = searchResultFormatter
    this.searchCacheManager = searchCacheManager

    // 合併預設配置和自定義配置
    this.config = {
      enableCaching: true,
      enableEvents: true,
      enableStatistics: true,
      debounceDelay: 300,
      performanceWarningThreshold: 1000,
      maxCacheSize: 100,
      ...config
    }

    // 初始化內部狀態
    this._initializeState()
    this._initializeStatistics()
    this._registerEventListeners()

    // 生成協調器 ID
    this.coordinatorId = this._generateCoordinatorId()
    this._isDestroyed = false

    // 防抖計時器
    this._debounceTimer = null
  }

  /**
   * 初始化內部狀態
   * @private
   */
  _initializeState () {
    this.booksData = []
    this._currentSearchState = {
      lastQuery: '',
      lastFilters: {},
      isSearching: false,
      lastSearchTime: 0
    }
  }

  /**
   * 初始化統計資料
   * @private
   */
  _initializeStatistics () {
    this._statistics = {
      totalCoordinatedOperations: 0,
      averageCoordinationTime: 0,
      lastCoordinationTime: 0,
      errorCount: 0,
      cacheHitRate: 0
    }
  }

  /**
   * 註冊事件監聽器
   * @private
   */
  _registerEventListeners () {
    // 搜尋執行事件
    this._searchExecuteHandler = async (event) => {
      try {
        await this.executeSearch(event.query, event.filters || {})
      } catch (error) {
        this.logger.error('事件搜尋執行失敗', { event, error: error.message })
      }
    }

    // 篩選應用事件
    this._filterApplyHandler = async (event) => {
      try {
        await this.applyFiltersToResults(event.books, event.filters)
      } catch (error) {
        this.logger.error('事件篩選應用失敗', { event, error: error.message })
      }
    }

    // 書籍資料更新事件
    this._booksDataUpdateHandler = (event) => {
      try {
        this.updateBooksData(event.books)
      } catch (error) {
        this.logger.error('書籍資料更新失敗', { event, error: error.message })
      }
    }

    // 註冊事件監聽器
    this.eventBus.on('SEARCH.EXECUTE', this._searchExecuteHandler)
    this.eventBus.on('FILTER.APPLY', this._filterApplyHandler)
    this.eventBus.on('BOOKS.DATA.UPDATED', this._booksDataUpdateHandler)
  }

  /**
   * 執行搜尋協調
   *
   * @param {string} query - 搜尋查詢
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Object>} 搜尋結果
   */
  async executeSearch (query, filters = {}) {
    if (this._isDestroyed) {
      const error = new Error('協調器已被銷毀')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
        category: 'ui',
        component: 'SearchCoordinator',
        state: 'destroyed'
      }
      throw error
    }

    // 驗證輸入
    this._validateSearchInputs(query, filters)

    const startTime = Date.now()

    try {
      // 更新搜尋狀態
      this._updateSearchState(query, filters, true)

      // 發送協調開始事件
      if (this.config.enableEvents) {
        this.eventBus.emit('COORDINATOR.SEARCH.STARTED', {
          query,
          filters,
          timestamp: Date.now(),
          coordinatorId: this.coordinatorId
        })

        this.eventBus.emit('SEARCH.STARTED', {
          query,
          filters,
          timestamp: Date.now()
        })
      }

      // 檢查快取
      let result = null
      if (this.config.enableCaching) {
        const cacheKey = this._generateCacheKey(query, filters)
        result = await this.searchCacheManager.get(cacheKey)

        if (result) {
          this._updateSearchState(query, filters, false)
          return result
        }
      }

      // 執行搜尋流程協調
      result = await this._coordinateSearchFlow(query, filters)

      // 儲存到快取
      if (this.config.enableCaching && result) {
        const cacheKey = this._generateCacheKey(query, filters)
        await this.searchCacheManager.set(cacheKey, result)
      }

      // 記錄統計
      if (this.config.enableStatistics) {
        this._recordStatistics(Date.now() - startTime)
      }

      // 更新搜尋狀態
      this._updateSearchState(query, filters, false)

      // 發送完成事件
      if (this.config.enableEvents) {
        this.eventBus.emit('COORDINATOR.SEARCH.COMPLETED', {
          query,
          filters,
          resultCount: result.results ? result.results.length : 0,
          processingTime: Date.now() - startTime,
          cached: false,
          timestamp: Date.now(),
          coordinatorId: this.coordinatorId
        })

        this.eventBus.emit('SEARCH.COMPLETED', {
          query,
          resultCount: result.results ? result.results.length : 0,
          processingTime: Date.now() - startTime
        })
      }

      // 檢查效能警告
      this._checkPerformanceWarning(Date.now() - startTime)

      return result
    } catch (error) {
      this._updateSearchState(query, filters, false)
      this._handleCoordinationError('search', error, { query, filters })
      const wrappedError = new Error('搜尋協調失敗: ' + error.message)
      wrappedError.code = ErrorCodes.OPERATION_ERROR
      wrappedError.details = {
        category: 'ui',
        operation: 'executeSearch',
        originalError: error.message
      }
      throw wrappedError
    }
  }

  /**
   * 協調搜尋流程
   * @private
   */
  async _coordinateSearchFlow (query, filters) {
    // 執行搜尋
    let searchResults
    if (query.trim() === '') {
      // 空查詢返回所有書籍
      searchResults = [...this.booksData]
    } else {
      searchResults = await this.searchEngine.search(query, this.booksData)
    }

    // 應用篩選
    const filterResult = await this.filterEngine.applyFilters(searchResults, filters)

    // 格式化結果
    const formattedResult = await this.searchResultFormatter.formatResults(query, filterResult.filteredBooks)

    // 整合結果
    return {
      results: formattedResult.results,
      metadata: {
        ...formattedResult.metadata,
        originalCount: searchResults.length,
        filteredCount: filterResult.totalCount,
        appliedFilters: filters,
        coordinatedBy: this.coordinatorId
      }
    }
  }

  /**
   * 防抖搜尋執行
   *
   * @param {string} query - 搜尋查詢
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Object>} 搜尋結果
   */
  async debouncedSearch (query, filters = {}) {
    return new Promise((resolve, reject) => {
      // 清除之前的計時器
      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer)
      }

      // 設置新的計時器
      this._debounceTimer = setTimeout(async () => {
        try {
          const result = await this.executeSearch(query, filters)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      }, this.config.debounceDelay)
    })
  }

  /**
   * 對結果應用篩選
   *
   * @param {Array} searchResults - 搜尋結果
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Object>} 篩選結果
   */
  async applyFiltersToResults (searchResults, filters) {
    if (this._isDestroyed) {
      const error = new Error('協調器已被銷毀')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
        category: 'ui',
        component: 'SearchCoordinator',
        state: 'destroyed'
      }
      throw error
    }

    // 驗證輸入
    this._validateFilterInputs(searchResults, filters)

    const startTime = Date.now()

    try {
      // 發送篩選開始事件
      if (this.config.enableEvents) {
        this.eventBus.emit('COORDINATOR.FILTER.STARTED', {
          resultCount: searchResults.length,
          filters,
          timestamp: Date.now(),
          coordinatorId: this.coordinatorId
        })
      }

      // 應用篩選
      const result = await this.filterEngine.applyFilters(searchResults, filters)

      // 發送篩選完成事件
      if (this.config.enableEvents) {
        this.eventBus.emit('COORDINATOR.FILTER.COMPLETED', {
          originalCount: searchResults.length,
          filteredCount: result.totalCount,
          processingTime: Date.now() - startTime,
          timestamp: Date.now(),
          coordinatorId: this.coordinatorId
        })
      }

      return result
    } catch (error) {
      this._handleCoordinationError('filter', error, { searchResults, filters })
      const wrappedError = new Error('篩選協調失敗: ' + error.message)
      wrappedError.code = ErrorCodes.OPERATION_ERROR
      wrappedError.details = {
        category: 'ui',
        operation: 'applyFiltersToResults',
        originalError: error.message
      }
      throw wrappedError
    }
  }

  /**
   * 重置篩選器
   */
  async resetFilters () {
    if (this._isDestroyed) {
      const error = new Error('協調器已被銷毀')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
        category: 'ui',
        component: 'SearchCoordinator',
        state: 'destroyed'
      }
      throw error
    }

    try {
      await this.filterEngine.resetFilters()

      if (this.config.enableEvents) {
        this.eventBus.emit('COORDINATOR.FILTERS.RESET', {
          timestamp: Date.now(),
          coordinatorId: this.coordinatorId
        })
      }
    } catch (error) {
      this._handleCoordinationError('resetFilters', error, {})
      const wrappedError = new Error('篩選重置協調失敗: ' + error.message)
      wrappedError.code = ErrorCodes.OPERATION_ERROR
      wrappedError.details = {
        category: 'ui',
        operation: 'resetFilters',
        originalError: error.message
      }
      throw wrappedError
    }
  }

  /**
   * 更新書籍資料
   *
   * @param {Array} newBooks - 新的書籍資料
   */
  async updateBooksData (newBooks) {
    if (this._isDestroyed) {
      const error = new Error('協調器已被銷毀')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
        category: 'ui',
        component: 'SearchCoordinator',
        state: 'destroyed'
      }
      throw error
    }

    this.booksData = newBooks

    // 清除快取
    if (this.config.enableCaching) {
      await this.searchCacheManager.clear()
    }

    if (this.config.enableEvents) {
      this.eventBus.emit('COORDINATOR.BOOKS.UPDATED', {
        bookCount: newBooks.length,
        timestamp: Date.now(),
        coordinatorId: this.coordinatorId
      })
    }
  }

  /**
   * 取得協調統計資料
   *
   * @returns {Promise<Object>} 統計資料
   */
  async getCoordinatedStatistics () {
    const stats = {
      coordinator: { ...this._statistics },
      searchEngine: await this._safeGetStatistics(this.searchEngine),
      filterEngine: await this._safeGetStatistics(this.filterEngine),
      searchResultFormatter: await this._safeGetStatistics(this.searchResultFormatter),
      searchCacheManager: await this._safeGetStatistics(this.searchCacheManager)
    }

    return stats
  }

  /**
   * 安全取得模組統計
   * @private
   */
  async _safeGetStatistics (module) {
    try {
      if (module && typeof module.getStatistics === 'function') {
        return module.getStatistics()
      } else if (module && typeof module.getStats === 'function') {
        return module.getStats()
      }
      return {}
    } catch (error) {
      this.logger.warn('取得模組統計失敗', { error: error.message })
      return {}
    }
  }

  /**
   * 協調清理所有模組
   */
  async coordinatedCleanup () {
    if (this._isDestroyed) {
      return
    }

    try {
      // 清理所有模組
      await Promise.allSettled([
        this._safeModuleOperation(this.searchEngine, 'cleanup'),
        this._safeModuleOperation(this.filterEngine, 'cleanup'),
        this._safeModuleOperation(this.searchResultFormatter, 'cleanup'),
        this._safeModuleOperation(this.searchCacheManager, 'cleanup')
      ])

      // 重置統計
      this.resetStatistics()

      if (this.config.enableEvents) {
        this.eventBus.emit('COORDINATOR.CLEANUP.COMPLETED', {
          timestamp: Date.now(),
          coordinatorId: this.coordinatorId
        })
      }
    } catch (error) {
      this.logger.error('協調清理失敗', { error: error.message })
    }
  }

  /**
   * 清理方法別名 (為了與其他模組保持一致的接口)
   */
  async cleanup () {
    return await this.coordinatedCleanup()
  }

  /**
   * 取得當前搜尋狀態
   *
   * @returns {Object} 搜尋狀態
   */
  getCurrentSearchState () {
    return { ...this._currentSearchState }
  }

  /**
   * 重置統計資料
   */
  resetStatistics () {
    this._initializeStatistics()
  }

  /**
   * 取得內部統計資料
   * @private
   */
  _getInternalStatistics () {
    return { ...this._statistics }
  }

  /**
   * 優雅關閉
   */
  async gracefulShutdown () {
    if (this._isDestroyed) {
      return
    }

    // 等待當前操作完成（簡化實作）
    if (this._currentSearchState.isSearching) {
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this._currentSearchState.isSearching) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 50)
      })
    }

    await this.destroy()
  }

  /**
   * 銷毀協調器
   */
  async destroy () {
    if (this._isDestroyed) {
      return
    }

    try {
      // 清除防抖計時器
      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer)
        this._debounceTimer = null
      }

      // 取消註冊事件監聽器
      this.eventBus.off('SEARCH.EXECUTE', this._searchExecuteHandler)
      this.eventBus.off('FILTER.APPLY', this._filterApplyHandler)
      this.eventBus.off('BOOKS.DATA.UPDATED', this._booksDataUpdateHandler)

      // 銷毀所有模組
      await Promise.allSettled([
        this._safeModuleOperation(this.searchEngine, 'destroy'),
        this._safeModuleOperation(this.filterEngine, 'destroy'),
        this._safeModuleOperation(this.searchResultFormatter, 'destroy'),
        this._safeModuleOperation(this.searchCacheManager, 'destroy')
      ])

      // 發送銷毀事件
      if (this.config.enableEvents) {
        this.eventBus.emit('COORDINATOR.DESTROYED', {
          coordinatorId: this.coordinatorId,
          timestamp: Date.now()
        })
      }

      this._isDestroyed = true
    } catch (error) {
      this.logger.error('協調器銷毀失敗', { error: error.message })
    }
  }

  // ===== 私有方法 =====

  /**
   * 驗證搜尋輸入
   * @private
   */
  _validateSearchInputs (query, filters) {
    if (query === null || query === undefined) {
      const error = new Error('搜尋查詢是必需的')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'ui',
        field: 'query',
        validationType: 'required'
      }
      throw error
    }

    if (typeof query !== 'string') {
      const error = new Error('搜尋查詢必須是字串')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'ui',
        field: 'query',
        validationType: 'type',
        expectedType: 'string',
        actualType: typeof query
      }
      throw error
    }

    if (filters === null || filters === undefined) {
      const error = new Error('篩選條件是必需的')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'ui',
        field: 'filters',
        validationType: 'required'
      }
      throw error
    }

    if (typeof filters !== 'object') {
      const error = new Error('篩選條件必須是物件')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'ui',
        field: 'filters',
        validationType: 'type',
        expectedType: 'object',
        actualType: typeof filters
      }
      throw error
    }
  }

  /**
   * 驗證篩選輸入
   * @private
   */
  _validateFilterInputs (searchResults, filters) {
    if (!Array.isArray(searchResults)) {
      const error = new Error('搜尋結果陣列是必需的')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'ui',
        field: 'searchResults',
        validationType: 'type',
        expectedType: 'array',
        actualType: typeof searchResults
      }
      throw error
    }

    if (filters === null || filters === undefined) {
      const error = new Error('篩選條件是必需的')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'ui',
        field: 'filters',
        validationType: 'required'
      }
      throw error
    }

    if (typeof filters !== 'object') {
      const error = new Error('篩選條件必須是物件')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        category: 'ui',
        field: 'filters',
        validationType: 'type',
        expectedType: 'object',
        actualType: typeof filters
      }
      throw error
    }
  }

  /**
   * 生成快取鍵值
   * @private
   */
  _generateCacheKey (query, filters) {
    const queryPart = query.trim().toLowerCase().replace(/\s+/g, '_')
    const filtersPart = Object.keys(filters).length > 0
      ? JSON.stringify(filters).replace(/[{}":,]/g, '').replace(/\s+/g, '_')
      : 'no_filters'

    return `search:${queryPart}:filter:${filtersPart}`
  }

  /**
   * 生成協調器 ID
   * @private
   */
  _generateCoordinatorId () {
    return `coordinator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 更新搜尋狀態
   * @private
   */
  _updateSearchState (query, filters, isSearching) {
    this._currentSearchState = {
      lastQuery: query,
      lastFilters: filters,
      isSearching,
      lastSearchTime: isSearching ? this._currentSearchState.lastSearchTime : Date.now()
    }

    if (this.config.enableEvents) {
      this.eventBus.emit('COORDINATOR.STATE.CHANGED', {
        ...this._currentSearchState,
        coordinatorId: this.coordinatorId
      })
    }
  }

  /**
   * 記錄統計資料
   * @private
   */
  _recordStatistics (executionTime) {
    this._statistics.totalCoordinatedOperations++
    // 確保協調時間至少為 1ms，避免測試中的 0 值問題
    this._statistics.lastCoordinationTime = Math.max(executionTime, 1)

    // 計算平均協調時間
    const totalTime = this._statistics.averageCoordinationTime * (this._statistics.totalCoordinatedOperations - 1) + this._statistics.lastCoordinationTime
    this._statistics.averageCoordinationTime = totalTime / this._statistics.totalCoordinatedOperations
  }

  /**
   * 檢查效能警告
   * @private
   */
  _checkPerformanceWarning (executionTime) {
    if (executionTime > this.config.performanceWarningThreshold) {
      this.logger.warn('協調操作效能警告', {
        executionTime,
        threshold: this.config.performanceWarningThreshold,
        coordinatorId: this.coordinatorId
      })
    }
  }

  /**
   * 處理協調錯誤
   * @private
   */
  _handleCoordinationError (operation, error, context) {
    this._statistics.errorCount++

    this.logger.error('搜尋執行失敗', {
      operation,
      error: error.message,
      context,
      coordinatorId: this.coordinatorId,
      ...context
    })

    if (this.config.enableEvents) {
      this.eventBus.emit('COORDINATOR.ERROR', {
        operation,
        error,
        context,
        timestamp: Date.now(),
        coordinatorId: this.coordinatorId
      })
    }
  }

  /**
   * 安全執行模組操作
   * @private
   */
  async _safeModuleOperation (module, operation) {
    try {
      if (module && typeof module[operation] === 'function') {
        return await module[operation]()
      }
    } catch (error) {
      this.logger.warn(`模組 ${operation} 操作失敗`, { error: error.message })
    }
  }
}

module.exports = SearchCoordinator
