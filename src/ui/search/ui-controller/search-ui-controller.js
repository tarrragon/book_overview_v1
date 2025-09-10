/**
 * SearchUIController - 搜尋 UI 交互控制器
 * TDD 循環 7/8: UI 交互控制邏輯拆分
 *
 * 負責功能：
 * - DOM 元素管理和初始化
 * - 使用者輸入事件處理
 * - 搜尋防抖機制控制
 * - UI 狀態管理和更新
 * - 篩選器 UI 控制
 * - 搜尋結果 UI 顯示控制
 * - 錯誤狀態 UI 處理
 * - 效能監控 UI 反饋
 * - 事件監聽器管理
 * - 生命週期和資源清理
 *
 * 設計考量：
 * - 純 UI 控制器，不包含業務邏輯
 * - 通過事件系統與其他模組通訊
 * - 防抖機制提升使用者體驗
 * - 完整的錯誤狀態處理
 * - 支援自訂配置和主題
 * - 記憶體高效的事件處理
 * - 無障礙設計支援
 *
 * 處理流程：
 * 1. 初始化 DOM 元素引用和配置
 * 2. 設置事件監聽器和防抖計時器
 * 3. 處理使用者輸入並觸發適當事件
 * 4. 管理 UI 狀態變化和視覺反饋
 * 5. 協調搜尋結果和篩選器顯示
 * 6. 處理錯誤狀態和使用者提示
 * 7. 提供效能監控和統計反饋
 * 8. 執行資源清理和生命週期管理
 *
 * 使用情境：
 * - 搜尋界面的使用者交互管理
 * - 實時搜尋輸入處理和防抖
 * - 篩選器界面狀態控制
 * - 搜尋結果的視覺化呈現
 * - 錯誤狀態的使用者友善顯示
 * - 效能監控資訊的 UI 反饋
 *
 * @version 1.0.0
 * @since 2025-08-20
 * @lastModified 2025-08-20
 */

class SearchUIController {
  /**
   * 建構 SearchUIController 實例
   *
   * @param {Object} options - 初始化選項
   * @param {Object} options.eventBus - 事件總線實例
   * @param {Object} options.document - DOM 文檔物件
   * @param {Object} [options.config] - UI 配置選項
   * @param {Object} [options.logger] - 日誌記錄器
   */
  constructor (options = {}) {
    const { eventBus, document, config = {}, logger = null } = options

    // 驗證必要依賴
    if (!eventBus || !document) {
      throw new Error('EventBus 和 Document 是必需的')
    }

    // 核心依賴
    this.eventBus = eventBus
    this.document = document
    this.logger = logger
    this.isCleanedUp = false

    // 初始化配置
    this.initializeUIConfiguration(config)

    // 初始化 UI 狀態
    this.initializeUIState()

    // 初始化 DOM 元素引用
    this.initializeDOMReferences()

    // 初始化事件處理器
    this.initializeEventHandlers()

    // 設置事件監聽器
    this.setupEventListeners()

    // 初始化動畫系統
    this.initializeAnimationSystem()
  }

  /**
   * 初始化 UI 配置
   *
   * @param {Object} customConfig - 自訂配置
   */
  initializeUIConfiguration (customConfig) {
    // 預設配置
    const defaultConfig = {
      debounceDelay: 300,
      animationDuration: 200,
      maxSuggestions: 5,
      maxQueryLength: 1000,
      errorDisplayDuration: 5000,
      loadingThreshold: 100,
      performanceWarningThreshold: 2000,
      maxActiveAnimations: 3,
      enableAccessibility: true
    }

    // 合併配置
    this.config = { ...defaultConfig, ...customConfig }
  }

  /**
   * 初始化 UI 狀態
   */
  initializeUIState () {
    // 搜尋狀態
    this.currentQuery = ''
    this._isSearching = false
    this._isLoading = false
    this._hasError = false
    this._errorMessage = null

    // UI 控制狀態
    this.debounceTimer = null
    this.errorTimer = null
    this.activeAnimations = []

    // 事件處理器綁定
    this.boundHandlers = {}
  }

  /**
   * 初始化 DOM 元素引用
   */
  initializeDOMReferences () {
    this.searchInput = this.document.getElementById('search-input')
    this.filterContainer = this.document.getElementById('filter-container')
    this.resultContainer = this.document.getElementById('result-container')
  }

  /**
   * 重新初始化 DOM 引用
   */
  reinitializeDOMReferences () {
    this.initializeDOMReferences()
  }

  /**
   * 初始化事件處理器
   */
  initializeEventHandlers () {
    // 綁定搜尋輸入處理器
    this.boundHandlers.handleSearchInput = this.handleSearchInput.bind(this)

    // 綁定外部事件處理器
    this.boundHandlers.handleSearchResultsReady = this.handleSearchResultsReady.bind(this)
    this.boundHandlers.handleSearchError = this.handleSearchError.bind(this)
    this.boundHandlers.handleFilterOptionsUpdated = this.handleFilterOptionsUpdated.bind(this)
    this.boundHandlers.handleThemeChanged = this.handleThemeChanged.bind(this)
  }

  /**
   * 設置事件監聽器
   */
  setupEventListeners () {
    // 設置搜尋輸入監聽器
    if (this.searchInput) {
      this.searchInput.addEventListener('input', this.boundHandlers.handleSearchInput)
    }

    // 設置事件總線監聽器
    this.eventBus.on('SEARCH.RESULTS.READY', this.boundHandlers.handleSearchResultsReady)
    this.eventBus.on('SEARCH.ERROR', this.boundHandlers.handleSearchError)
    this.eventBus.on('FILTER.OPTIONS.UPDATED', this.boundHandlers.handleFilterOptionsUpdated)
    this.eventBus.on('UI.THEME.CHANGED', this.boundHandlers.handleThemeChanged)
  }

  /**
   * 初始化動畫系統
   */
  initializeAnimationSystem () {
    this.activeAnimationsCount = 0
  }

  /**
   * DOM 元素 Getter 方法
   */
  getSearchInput () {
    return this.searchInput
  }

  getFilterContainer () {
    return this.filterContainer
  }

  getResultContainer () {
    return this.resultContainer
  }

  /**
   * DOM 元素存在性檢查
   */
  hasSearchInput () {
    return this.searchInput !== null
  }

  hasFilterContainer () {
    return this.filterContainer !== null
  }

  hasResultContainer () {
    return this.resultContainer !== null
  }

  /**
   * 處理搜尋輸入事件
   *
   * @param {Event} event - 輸入事件
   */
  handleSearchInput (event) {
    if (this.isCleanedUp) {
      throw new Error('SearchUIController 已被清理')
    }

    try {
      const rawQuery = event.target.value || ''

      // 正規化查詢
      const normalizedQuery = this.normalizeSearchQuery(rawQuery)
      this.currentQuery = normalizedQuery

      // 清除之前的防抖計時器
      this.clearDebounceTimer()

      // 處理空輸入
      if (!normalizedQuery.trim()) {
        this.handleEmptyInput()
        return
      }

      // 處理非空輸入
      this.handleNonEmptyInput(normalizedQuery)
    } catch (error) {
      this.handleInputProcessingError(error)
    }
  }

  /**
   * 正規化搜尋查詢
   *
   * @param {string} rawQuery - 原始查詢
   * @returns {string} 正規化後的查詢
   */
  normalizeSearchQuery (rawQuery) {
    if (typeof rawQuery !== 'string') {
      return ''
    }

    // 移除前後空白和多餘空格
    let normalized = rawQuery.trim().toLowerCase()

    // 移除特殊字符，只保留字母、數字、空格和中文字符
    normalized = normalized.replace(/[^\w\s\u4e00-\u9fff]/g, '')

    // 移除多餘空格
    normalized = normalized.replace(/\s+/g, ' ')

    // 限制長度
    if (normalized.length > this.config.maxQueryLength) {
      normalized = normalized.substring(0, this.config.maxQueryLength)
    }

    return normalized
  }

  /**
   * 清除防抖計時器
   */
  clearDebounceTimer () {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  /**
   * 處理空輸入
   */
  handleEmptyInput () {
    this.emitEvent('SEARCH.INPUT.CLEARED', {
      timestamp: Date.now()
    })
  }

  /**
   * 處理非空輸入
   *
   * @param {string} query - 搜尋查詢
   */
  handleNonEmptyInput (query) {
    // 觸發輸入變更事件
    this.emitEvent('SEARCH.INPUT.CHANGED', {
      query,
      timestamp: Date.now()
    })

    // 設置防抖計時器
    this.debounceTimer = setTimeout(() => {
      this.triggerDebouncedSearch(query)
    }, this.config.debounceDelay)
  }

  /**
   * 觸發防抖搜尋
   *
   * @param {string} query - 搜尋查詢
   */
  triggerDebouncedSearch (query) {
    this.emitEvent('SEARCH.DEBOUNCED.TRIGGERED', {
      query,
      debounceDelay: this.config.debounceDelay,
      timestamp: Date.now()
    })
  }

  /**
   * 處理輸入處理錯誤
   *
   * @param {Error} error - 錯誤物件
   */
  handleInputProcessingError (error) {
    if (this.logger) {
      this.logger.error('Search input processing error:', error)
    } else {
      // eslint-disable-next-line no-console
      console.error('Search input processing error:', error)
    }
  }

  /**
   * UI 狀態管理方法
   */

  /**
   * 設置搜尋狀態
   *
   * @param {boolean} isSearching - 是否正在搜尋
   */
  setSearchingState (isSearching) {
    this._isSearching = Boolean(isSearching)

    this.emitEvent('UI.SEARCH.STATE.CHANGED', {
      isSearching: this._isSearching,
      timestamp: Date.now()
    })
  }

  /**
   * 取得搜尋狀態
   *
   * @returns {boolean} 是否正在搜尋
   */
  isSearching () {
    return this._isSearching
  }

  /**
   * 設置載入狀態
   *
   * @param {boolean} isLoading - 是否正在載入
   */
  setLoadingState (isLoading) {
    this._isLoading = Boolean(isLoading)

    // 更新搜尋輸入狀態
    if (this.searchInput) {
      if (isLoading) {
        this.searchInput.setAttribute('disabled', 'true')
      } else {
        this.searchInput.removeAttribute('disabled')
      }
    }

    this.emitEvent('UI.LOADING.STATE.CHANGED', {
      isLoading: this._isLoading,
      timestamp: Date.now()
    })
  }

  /**
   * 取得載入狀態
   *
   * @returns {boolean} 是否正在載入
   */
  isLoading () {
    return this._isLoading
  }

  /**
   * 設置錯誤狀態
   *
   * @param {boolean} hasError - 是否有錯誤
   * @param {string} [errorMessage] - 錯誤訊息
   */
  setErrorState (hasError, errorMessage = null) {
    this._hasError = Boolean(hasError)
    this._errorMessage = errorMessage

    this.emitEvent('UI.ERROR.STATE.CHANGED', {
      hasError: this._hasError,
      errorMessage: this._errorMessage,
      timestamp: Date.now()
    })
  }

  /**
   * 清除錯誤狀態
   */
  clearErrorState () {
    this.setErrorState(false, null)
  }

  /**
   * 取得錯誤狀態
   *
   * @returns {boolean} 是否有錯誤
   */
  hasError () {
    return this._hasError
  }

  /**
   * 取得錯誤訊息
   *
   * @returns {string|null} 錯誤訊息
   */
  getErrorMessage () {
    return this._errorMessage
  }

  /**
   * 取得完整 UI 狀態
   *
   * @returns {Object} UI 狀態快照
   */
  getUIState () {
    return {
      isSearching: this._isSearching,
      isLoading: this._isLoading,
      hasError: this._hasError,
      errorMessage: this._errorMessage,
      currentQuery: this.currentQuery,
      timestamp: Date.now()
    }
  }

  /**
   * 篩選器 UI 控制方法
   */

  /**
   * 更新篩選器 UI
   *
   * @param {Object} filterOptions - 篩選選項
   */
  updateFilterUI (filterOptions) {
    this.emitEvent('FILTER.UI.UPDATED', {
      filterOptions,
      timestamp: Date.now()
    })
  }

  /**
   * 處理篩選器變更
   *
   * @param {Event} event - 變更事件
   */
  handleFilterChange (event) {
    const { target } = event

    this.emitEvent('FILTER.SELECTION.CHANGED', {
      filterName: target.name,
      filterValue: target.value,
      isSelected: target.checked,
      timestamp: Date.now()
    })
  }

  /**
   * 重置所有篩選器
   */
  resetFilters () {
    this.emitEvent('FILTER.RESET', {
      timestamp: Date.now()
    })
  }

  /**
   * 設置篩選器載入狀態
   *
   * @param {boolean} isLoading - 是否正在載入
   */
  setFilterLoadingState (isLoading) {
    if (this.filterContainer) {
      this.filterContainer.style.opacity = isLoading ? '0.5' : '1'
    }

    this.emitEvent('FILTER.UI.LOADING.CHANGED', {
      isLoading,
      timestamp: Date.now()
    })
  }

  /**
   * 設置篩選器錯誤狀態
   *
   * @param {string} errorMessage - 錯誤訊息
   */
  setFilterErrorState (errorMessage) {
    this.emitEvent('FILTER.UI.ERROR', {
      errorMessage,
      timestamp: Date.now()
    })
  }

  /**
   * 搜尋結果 UI 顯示控制方法
   */

  /**
   * 顯示搜尋結果
   *
   * @param {Array} searchResults - 搜尋結果
   */
  displaySearchResults (searchResults) {
    if (searchResults && searchResults.length > 0) {
      this.emitEvent('SEARCH.RESULTS.DISPLAYED', {
        resultCount: searchResults.length,
        results: searchResults,
        timestamp: Date.now()
      })
    } else {
      this.emitEvent('SEARCH.RESULTS.EMPTY', {
        message: '沒有找到符合條件的書籍',
        timestamp: Date.now()
      })
    }
  }

  /**
   * 清除搜尋結果顯示
   */
  clearSearchResults () {
    if (this.resultContainer) {
      this.resultContainer.innerHTML = ''
    }

    this.emitEvent('SEARCH.RESULTS.CLEARED', {
      timestamp: Date.now()
    })
  }

  /**
   * 顯示搜尋結果統計
   *
   * @param {Object} statistics - 統計資料
   */
  displaySearchStatistics (statistics) {
    this.emitEvent('SEARCH.STATISTICS.DISPLAYED', {
      statistics,
      timestamp: Date.now()
    })
  }

  /**
   * 處理搜尋結果分頁
   *
   * @param {number} currentPage - 當前頁數
   * @param {number} pageSize - 每頁大小
   * @param {number} totalResults - 總結果數
   */
  handleResultsPagination (currentPage, pageSize, totalResults) {
    const totalPages = Math.ceil(totalResults / pageSize)

    this.emitEvent('SEARCH.RESULTS.PAGINATION', {
      currentPage,
      pageSize,
      totalResults,
      totalPages,
      timestamp: Date.now()
    })
  }

  /**
   * 錯誤狀態 UI 處理方法
   */

  /**
   * 處理搜尋錯誤
   *
   * @param {Error} error - 錯誤物件
   */
  handleSearchError (error) {
    const errorMessage = error.message || '搜尋發生未知錯誤'

    this.emitEvent('UI.SEARCH.ERROR', {
      error: errorMessage,
      timestamp: Date.now()
    })
  }

  /**
   * 處理驗證錯誤
   *
   * @param {Object} validationError - 驗證錯誤
   */
  handleValidationError (validationError) {
    this.emitEvent('UI.VALIDATION.ERROR', {
      field: validationError.field,
      message: validationError.message,
      timestamp: Date.now()
    })
  }

  /**
   * 處理網絡錯誤
   *
   * @param {Object} networkError - 網絡錯誤
   */
  handleNetworkError (networkError) {
    this.emitEvent('UI.NETWORK.ERROR', {
      type: networkError.type,
      message: networkError.message,
      timestamp: Date.now()
    })
  }

  /**
   * 顯示臨時錯誤訊息
   *
   * @param {string} message - 錯誤訊息
   * @param {number} duration - 顯示持續時間
   */
  showTemporaryError (message, duration = this.config.errorDisplayDuration) {
    this.setErrorState(true, message)

    // 清除之前的錯誤計時器
    if (this.errorTimer) {
      clearTimeout(this.errorTimer)
    }

    // 設置自動清除計時器
    this.errorTimer = setTimeout(() => {
      this.clearErrorState()
      this.emitEvent('UI.ERROR.AUTO.CLEARED', {
        timestamp: Date.now()
      })
    }, duration)
  }

  /**
   * 效能監控 UI 反饋方法
   */

  /**
   * 顯示效能警告
   *
   * @param {Object} performanceData - 效能資料
   */
  showPerformanceWarning (performanceData) {
    this.emitEvent('UI.PERFORMANCE.WARNING', {
      searchTime: performanceData.searchTime,
      threshold: performanceData.threshold,
      query: performanceData.query,
      timestamp: Date.now()
    })
  }

  /**
   * 更新效能指標顯示
   *
   * @param {Object} metrics - 效能指標
   */
  updatePerformanceMetrics (metrics) {
    this.emitEvent('UI.PERFORMANCE.METRICS.UPDATED', {
      metrics,
      timestamp: Date.now()
    })
  }

  /**
   * 更新載入進度
   *
   * @param {number} progress - 進度百分比 (0-100)
   * @param {string} message - 進度訊息
   */
  updateLoadingProgress (progress, message) {
    this.emitEvent('UI.LOADING.PROGRESS', {
      progress,
      message,
      timestamp: Date.now()
    })
  }

  /**
   * 外部事件處理器
   */

  /**
   * 處理搜尋結果就緒事件
   *
   * @param {Object} event - 事件物件
   */
  handleSearchResultsReady (event) {
    if (event.results) {
      this.displaySearchResults(event.results)
    }
  }

  /**
   * 處理篩選選項更新事件
   *
   * @param {Object} event - 事件物件
   */
  handleFilterOptionsUpdated (event) {
    if (event.options) {
      this.updateFilterUI(event.options)
    }
  }

  /**
   * 處理主題變更事件
   *
   * @param {Object} themeEvent - 主題事件
   */
  handleThemeChanged (themeEvent) {
    this.emitEvent('UI.THEME.APPLIED', {
      theme: themeEvent.theme,
      timestamp: Date.now()
    })
  }

  /**
   * 與外部系統整合方法
   */

  /**
   * 處理協調器事件
   *
   * @param {Object} coordinatorEvent - 協調器事件
   */
  handleCoordinatorEvent (coordinatorEvent) {
    this.emitEvent('UI.COORDINATOR.RESPONSE', {
      type: coordinatorEvent.type,
      handled: true,
      timestamp: Date.now()
    })
  }

  /**
   * 處理搜尋引擎事件
   *
   * @param {Object} searchEngineEvent - 搜尋引擎事件
   */
  handleSearchEngineEvent (searchEngineEvent) {
    this.emitEvent('UI.SEARCH.ENGINE.PROGRESS', {
      progress: searchEngineEvent.progress,
      message: searchEngineEvent.message,
      timestamp: Date.now()
    })
  }

  /**
   * 處理篩選引擎事件
   *
   * @param {Object} filterEngineEvent - 篩選引擎事件
   */
  handleFilterEngineEvent (filterEngineEvent) {
    this.emitEvent('UI.FILTER.OPTIONS.SYNC', {
      options: filterEngineEvent.options,
      timestamp: Date.now()
    })
  }

  /**
   * 動畫系統方法
   */

  /**
   * 取得活躍動畫數量
   *
   * @returns {number} 活躍動畫數量
   */
  getActiveAnimationsCount () {
    return this.activeAnimationsCount
  }

  /**
   * 工具方法
   */

  /**
   * 發出事件
   *
   * @param {string} eventName - 事件名稱
   * @param {Object} eventData - 事件資料
   */
  emitEvent (eventName, eventData) {
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit(eventName, eventData)
    }
  }

  /**
   * 生命週期和資源清理方法
   */

  /**
   * 執行資源清理
   */
  cleanup () {
    // 防止重複清理
    if (this.isCleanedUp) {
      return
    }

    // 清除所有計時器
    this.clearAllTimers()

    // 移除事件監聽器
    this.removeAllEventListeners()

    // 重置 UI 狀態
    this.resetUIState()

    // 清除 DOM 引用
    this.clearDOMReferences()

    // 標記為已清理
    this.isCleanedUp = true
  }

  /**
   * 清除所有計時器
   */
  clearAllTimers () {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (this.errorTimer) {
      clearTimeout(this.errorTimer)
      this.errorTimer = null
    }
  }

  /**
   * 移除所有事件監聽器
   */
  removeAllEventListeners () {
    // 移除 DOM 事件監聽器
    if (this.searchInput && this.boundHandlers.handleSearchInput) {
      this.searchInput.removeEventListener('input', this.boundHandlers.handleSearchInput)
    }

    // 移除事件總線監聽器
    if (this.eventBus) {
      this.eventBus.off('SEARCH.RESULTS.READY', this.boundHandlers.handleSearchResultsReady)
      this.eventBus.off('SEARCH.ERROR', this.boundHandlers.handleSearchError)
      this.eventBus.off('FILTER.OPTIONS.UPDATED', this.boundHandlers.handleFilterOptionsUpdated)
      this.eventBus.off('UI.THEME.CHANGED', this.boundHandlers.handleThemeChanged)
    }
  }

  /**
   * 重置 UI 狀態
   */
  resetUIState () {
    this.currentQuery = ''
    this._isSearching = false
    this._isLoading = false
    this._hasError = false
    this._errorMessage = null
    this.activeAnimationsCount = 0
  }

  /**
   * 清除 DOM 引用
   */
  clearDOMReferences () {
    this.searchInput = null
    this.filterContainer = null
    this.resultContainer = null
  }
}

module.exports = SearchUIController
