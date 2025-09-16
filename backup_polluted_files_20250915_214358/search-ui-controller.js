/**
const Logger = require("src/core/logging/Logger")
 * SearchUIController - 搜尋 UI 交互控制器
const Logger = require("src/core/logging/Logger")
 * TDD 循環 7/8: UI 交互控制邏輯拆分
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 負責功能：
const Logger = require("src/core/logging/Logger")
 * - DOM 元素管理和初始化
const Logger = require("src/core/logging/Logger")
 * - 使用者輸入事件處理
const Logger = require("src/core/logging/Logger")
 * - 搜尋防抖機制控制
const Logger = require("src/core/logging/Logger")
 * - UI 狀態管理和更新
const Logger = require("src/core/logging/Logger")
 * - 篩選器 UI 控制
const Logger = require("src/core/logging/Logger")
 * - 搜尋結果 UI 顯示控制
const Logger = require("src/core/logging/Logger")
 * - 錯誤狀態 UI 處理
const Logger = require("src/core/logging/Logger")
 * - 效能監控 UI 反饋
const Logger = require("src/core/logging/Logger")
 * - 事件監聽器管理
const Logger = require("src/core/logging/Logger")
 * - 生命週期和資源清理
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 設計考量：
const Logger = require("src/core/logging/Logger")
 * - 純 UI 控制器，不包含業務邏輯
const Logger = require("src/core/logging/Logger")
 * - 通過事件系統與其他模組通訊
const Logger = require("src/core/logging/Logger")
 * - 防抖機制提升使用者體驗
const Logger = require("src/core/logging/Logger")
 * - 完整的錯誤狀態處理
const Logger = require("src/core/logging/Logger")
 * - 支援自訂配置和主題
const Logger = require("src/core/logging/Logger")
 * - 記憶體高效的事件處理
const Logger = require("src/core/logging/Logger")
 * - 無障礙設計支援
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 處理流程：
const Logger = require("src/core/logging/Logger")
 * 1. 初始化 DOM 元素引用和配置
const Logger = require("src/core/logging/Logger")
 * 2. 設置事件監聽器和防抖計時器
const Logger = require("src/core/logging/Logger")
 * 3. 處理使用者輸入並觸發適當事件
const Logger = require("src/core/logging/Logger")
 * 4. 管理 UI 狀態變化和視覺反饋
const Logger = require("src/core/logging/Logger")
 * 5. 協調搜尋結果和篩選器顯示
const Logger = require("src/core/logging/Logger")
 * 6. 處理錯誤狀態和使用者提示
const Logger = require("src/core/logging/Logger")
 * 7. 提供效能監控和統計反饋
const Logger = require("src/core/logging/Logger")
 * 8. 執行資源清理和生命週期管理
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 使用情境：
const Logger = require("src/core/logging/Logger")
 * - 搜尋界面的使用者交互管理
const Logger = require("src/core/logging/Logger")
 * - 實時搜尋輸入處理和防抖
const Logger = require("src/core/logging/Logger")
 * - 篩選器界面狀態控制
const Logger = require("src/core/logging/Logger")
 * - 搜尋結果的視覺化呈現
const Logger = require("src/core/logging/Logger")
 * - 錯誤狀態的使用者友善顯示
const Logger = require("src/core/logging/Logger")
 * - 效能監控資訊的 UI 反饋
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * @version 1.0.0
const Logger = require("src/core/logging/Logger")
 * @since 2025-08-20
const Logger = require("src/core/logging/Logger")
 * @lastModified 2025-08-20
const Logger = require("src/core/logging/Logger")
 */

const Logger = require("src/core/logging/Logger")
const { StandardError } = require('src/core/errors/StandardError')

const Logger = require("src/core/logging/Logger")
class SearchUIController {
const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 建構 SearchUIController 實例
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} options - 初始化選項
const Logger = require("src/core/logging/Logger")
   * @param {Object} options.eventBus - 事件總線實例
const Logger = require("src/core/logging/Logger")
   * @param {Object} options.document - DOM 文檔物件
const Logger = require("src/core/logging/Logger")
   * @param {Object} [options.config] - UI 配置選項
const Logger = require("src/core/logging/Logger")
   * @param {Object} [options.logger] - 日誌記錄器
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  constructor (options = {}) {
const Logger = require("src/core/logging/Logger")
    const { eventBus, document, config = {}, logger = null } = options

const Logger = require("src/core/logging/Logger")
    // 驗證必要依賴
const Logger = require("src/core/logging/Logger")
    if (!eventBus || !document) {
const Logger = require("src/core/logging/Logger")
      throw new StandardError('EVENTBUS_ERROR', 'EventBus 和 Document 是必需的', {
const Logger = require("src/core/logging/Logger")
        category: 'ui'
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 核心依賴
const Logger = require("src/core/logging/Logger")
    this.eventBus = eventBus
const Logger = require("src/core/logging/Logger")
    this.document = document
const Logger = require("src/core/logging/Logger")
    this.logger = logger
const Logger = require("src/core/logging/Logger")
    this.isCleanedUp = false

const Logger = require("src/core/logging/Logger")
    // 初始化配置
const Logger = require("src/core/logging/Logger")
    this.initializeUIConfiguration(config)

const Logger = require("src/core/logging/Logger")
    // 初始化 UI 狀態
const Logger = require("src/core/logging/Logger")
    this.initializeUIState()

const Logger = require("src/core/logging/Logger")
    // 初始化 DOM 元素引用
const Logger = require("src/core/logging/Logger")
    this.initializeDOMReferences()

const Logger = require("src/core/logging/Logger")
    // 初始化事件處理器
const Logger = require("src/core/logging/Logger")
    this.initializeEventHandlers()

const Logger = require("src/core/logging/Logger")
    // 設置事件監聽器
const Logger = require("src/core/logging/Logger")
    this.setupEventListeners()

const Logger = require("src/core/logging/Logger")
    // 初始化動畫系統
const Logger = require("src/core/logging/Logger")
    this.initializeAnimationSystem()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化 UI 配置
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} customConfig - 自訂配置
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  initializeUIConfiguration (customConfig) {
const Logger = require("src/core/logging/Logger")
    // 預設配置
const Logger = require("src/core/logging/Logger")
    const defaultConfig = {
const Logger = require("src/core/logging/Logger")
      debounceDelay: 300,
const Logger = require("src/core/logging/Logger")
      animationDuration: 200,
const Logger = require("src/core/logging/Logger")
      maxSuggestions: 5,
const Logger = require("src/core/logging/Logger")
      maxQueryLength: 1000,
const Logger = require("src/core/logging/Logger")
      errorDisplayDuration: 5000,
const Logger = require("src/core/logging/Logger")
      loadingThreshold: 100,
const Logger = require("src/core/logging/Logger")
      performanceWarningThreshold: 2000,
const Logger = require("src/core/logging/Logger")
      maxActiveAnimations: 3,
const Logger = require("src/core/logging/Logger")
      enableAccessibility: true
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 合併配置
const Logger = require("src/core/logging/Logger")
    this.config = { ...defaultConfig, ...customConfig }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化 UI 狀態
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  initializeUIState () {
const Logger = require("src/core/logging/Logger")
    // 搜尋狀態
const Logger = require("src/core/logging/Logger")
    this.currentQuery = ''
const Logger = require("src/core/logging/Logger")
    this._isSearching = false
const Logger = require("src/core/logging/Logger")
    this._isLoading = false
const Logger = require("src/core/logging/Logger")
    this._hasError = false
const Logger = require("src/core/logging/Logger")
    this._errorMessage = null

const Logger = require("src/core/logging/Logger")
    // UI 控制狀態
const Logger = require("src/core/logging/Logger")
    this.debounceTimer = null
const Logger = require("src/core/logging/Logger")
    this.errorTimer = null
const Logger = require("src/core/logging/Logger")
    this.activeAnimations = []

const Logger = require("src/core/logging/Logger")
    // 事件處理器綁定
const Logger = require("src/core/logging/Logger")
    this.boundHandlers = {}
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化 DOM 元素引用
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  initializeDOMReferences () {
const Logger = require("src/core/logging/Logger")
    this.searchInput = this.document.getElementById('search-input')
const Logger = require("src/core/logging/Logger")
    this.filterContainer = this.document.getElementById('filter-container')
const Logger = require("src/core/logging/Logger")
    this.resultContainer = this.document.getElementById('result-container')
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 重新初始化 DOM 引用
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  reinitializeDOMReferences () {
const Logger = require("src/core/logging/Logger")
    this.initializeDOMReferences()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化事件處理器
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  initializeEventHandlers () {
const Logger = require("src/core/logging/Logger")
    // 綁定搜尋輸入處理器
const Logger = require("src/core/logging/Logger")
    this.boundHandlers.handleSearchInput = this.handleSearchInput.bind(this)

const Logger = require("src/core/logging/Logger")
    // 綁定外部事件處理器
const Logger = require("src/core/logging/Logger")
    this.boundHandlers.handleSearchResultsReady = this.handleSearchResultsReady.bind(this)
const Logger = require("src/core/logging/Logger")
    this.boundHandlers.handleSearchError = this.handleSearchError.bind(this)
const Logger = require("src/core/logging/Logger")
    this.boundHandlers.handleFilterOptionsUpdated = this.handleFilterOptionsUpdated.bind(this)
const Logger = require("src/core/logging/Logger")
    this.boundHandlers.handleThemeChanged = this.handleThemeChanged.bind(this)
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 設置事件監聽器
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  setupEventListeners () {
const Logger = require("src/core/logging/Logger")
    // 設置搜尋輸入監聽器
const Logger = require("src/core/logging/Logger")
    if (this.searchInput) {
const Logger = require("src/core/logging/Logger")
      this.searchInput.addEventListener('input', this.boundHandlers.handleSearchInput)
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 設置事件總線監聽器
const Logger = require("src/core/logging/Logger")
    this.eventBus.on('SEARCH.RESULTS.READY', this.boundHandlers.handleSearchResultsReady)
const Logger = require("src/core/logging/Logger")
    this.eventBus.on('SEARCH.ERROR', this.boundHandlers.handleSearchError)
const Logger = require("src/core/logging/Logger")
    this.eventBus.on('FILTER.OPTIONS.UPDATED', this.boundHandlers.handleFilterOptionsUpdated)
const Logger = require("src/core/logging/Logger")
    this.eventBus.on('UI.THEME.CHANGED', this.boundHandlers.handleThemeChanged)
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化動畫系統
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  initializeAnimationSystem () {
const Logger = require("src/core/logging/Logger")
    this.activeAnimationsCount = 0
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * DOM 元素 Getter 方法
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  getSearchInput () {
const Logger = require("src/core/logging/Logger")
    return this.searchInput
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  getFilterContainer () {
const Logger = require("src/core/logging/Logger")
    return this.filterContainer
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  getResultContainer () {
const Logger = require("src/core/logging/Logger")
    return this.resultContainer
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * DOM 元素存在性檢查
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  hasSearchInput () {
const Logger = require("src/core/logging/Logger")
    return this.searchInput !== null
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  hasFilterContainer () {
const Logger = require("src/core/logging/Logger")
    return this.filterContainer !== null
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  hasResultContainer () {
const Logger = require("src/core/logging/Logger")
    return this.resultContainer !== null
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理搜尋輸入事件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Event} event - 輸入事件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleSearchInput (event) {
const Logger = require("src/core/logging/Logger")
    if (this.isCleanedUp) {
const Logger = require("src/core/logging/Logger")
      throw new StandardError('UI_OPERATION_FAILED', 'SearchUIController 已被清理', {
const Logger = require("src/core/logging/Logger")
        category: 'ui'
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      const rawQuery = event.target.value || ''

const Logger = require("src/core/logging/Logger")
      // 正規化查詢
const Logger = require("src/core/logging/Logger")
      const normalizedQuery = this.normalizeSearchQuery(rawQuery)
const Logger = require("src/core/logging/Logger")
      this.currentQuery = normalizedQuery

const Logger = require("src/core/logging/Logger")
      // 清除之前的防抖計時器
const Logger = require("src/core/logging/Logger")
      this.clearDebounceTimer()

const Logger = require("src/core/logging/Logger")
      // 處理空輸入
const Logger = require("src/core/logging/Logger")
      if (!normalizedQuery.trim()) {
const Logger = require("src/core/logging/Logger")
        this.handleEmptyInput()
const Logger = require("src/core/logging/Logger")
        return
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      // 處理非空輸入
const Logger = require("src/core/logging/Logger")
      this.handleNonEmptyInput(normalizedQuery)
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      this.handleInputProcessingError(error)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 正規化搜尋查詢
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} rawQuery - 原始查詢
const Logger = require("src/core/logging/Logger")
   * @returns {string} 正規化後的查詢
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  normalizeSearchQuery (rawQuery) {
const Logger = require("src/core/logging/Logger")
    if (typeof rawQuery !== 'string') {
const Logger = require("src/core/logging/Logger")
      return ''
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 移除前後空白和多餘空格
const Logger = require("src/core/logging/Logger")
    let normalized = rawQuery.trim().toLowerCase()

const Logger = require("src/core/logging/Logger")
    // 移除特殊字符，只保留字母、數字、空格和中文字符
const Logger = require("src/core/logging/Logger")
    normalized = normalized.replace(/[^\w\s\u4e00-\u9fff]/g, '')

const Logger = require("src/core/logging/Logger")
    // 移除多餘空格
const Logger = require("src/core/logging/Logger")
    normalized = normalized.replace(/\s+/g, ' ')

const Logger = require("src/core/logging/Logger")
    // 限制長度
const Logger = require("src/core/logging/Logger")
    if (normalized.length > this.config.maxQueryLength) {
const Logger = require("src/core/logging/Logger")
      normalized = normalized.substring(0, this.config.maxQueryLength)
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    return normalized
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 清除防抖計時器
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  clearDebounceTimer () {
const Logger = require("src/core/logging/Logger")
    if (this.debounceTimer) {
const Logger = require("src/core/logging/Logger")
      clearTimeout(this.debounceTimer)
const Logger = require("src/core/logging/Logger")
      this.debounceTimer = null
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理空輸入
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleEmptyInput () {
const Logger = require("src/core/logging/Logger")
    this.emitEvent('SEARCH.INPUT.CLEARED', {
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理非空輸入
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} query - 搜尋查詢
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleNonEmptyInput (query) {
const Logger = require("src/core/logging/Logger")
    // 觸發輸入變更事件
const Logger = require("src/core/logging/Logger")
    this.emitEvent('SEARCH.INPUT.CHANGED', {
const Logger = require("src/core/logging/Logger")
      query,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })

const Logger = require("src/core/logging/Logger")
    // 設置防抖計時器
const Logger = require("src/core/logging/Logger")
    this.debounceTimer = setTimeout(() => {
const Logger = require("src/core/logging/Logger")
      this.triggerDebouncedSearch(query)
const Logger = require("src/core/logging/Logger")
    }, this.config.debounceDelay)
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 觸發防抖搜尋
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} query - 搜尋查詢
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  triggerDebouncedSearch (query) {
const Logger = require("src/core/logging/Logger")
    this.emitEvent('SEARCH.DEBOUNCED.TRIGGERED', {
const Logger = require("src/core/logging/Logger")
      query,
const Logger = require("src/core/logging/Logger")
      debounceDelay: this.config.debounceDelay,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理輸入處理錯誤
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Error} error - 錯誤物件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleInputProcessingError (error) {
const Logger = require("src/core/logging/Logger")
    if (this.logger) {
const Logger = require("src/core/logging/Logger")
      this.logger.error('Search input processing error:', error)
const Logger = require("src/core/logging/Logger")
    } else {
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.error('Search input processing error:', error)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * UI 狀態管理方法
const Logger = require("src/core/logging/Logger")
   */

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 設置搜尋狀態
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {boolean} isSearching - 是否正在搜尋
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  setSearchingState (isSearching) {
const Logger = require("src/core/logging/Logger")
    this._isSearching = Boolean(isSearching)

const Logger = require("src/core/logging/Logger")
    this.emitEvent('UI.SEARCH.STATE.CHANGED', {
const Logger = require("src/core/logging/Logger")
      isSearching: this._isSearching,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 取得搜尋狀態
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {boolean} 是否正在搜尋
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  isSearching () {
const Logger = require("src/core/logging/Logger")
    return this._isSearching
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 設置載入狀態
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {boolean} isLoading - 是否正在載入
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  setLoadingState (isLoading) {
const Logger = require("src/core/logging/Logger")
    this._isLoading = Boolean(isLoading)

const Logger = require("src/core/logging/Logger")
    // 更新搜尋輸入狀態
const Logger = require("src/core/logging/Logger")
    if (this.searchInput) {
const Logger = require("src/core/logging/Logger")
      if (isLoading) {
const Logger = require("src/core/logging/Logger")
        this.searchInput.setAttribute('disabled', 'true')
const Logger = require("src/core/logging/Logger")
      } else {
const Logger = require("src/core/logging/Logger")
        this.searchInput.removeAttribute('disabled')
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    this.emitEvent('UI.LOADING.STATE.CHANGED', {
const Logger = require("src/core/logging/Logger")
      isLoading: this._isLoading,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 取得載入狀態
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {boolean} 是否正在載入
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  isLoading () {
const Logger = require("src/core/logging/Logger")
    return this._isLoading
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 設置錯誤狀態
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {boolean} hasError - 是否有錯誤
const Logger = require("src/core/logging/Logger")
   * @param {string} [errorMessage] - 錯誤訊息
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  setErrorState (hasError, errorMessage = null) {
const Logger = require("src/core/logging/Logger")
    this._hasError = Boolean(hasError)
const Logger = require("src/core/logging/Logger")
    this._errorMessage = errorMessage

const Logger = require("src/core/logging/Logger")
    this.emitEvent('UI.ERROR.STATE.CHANGED', {
const Logger = require("src/core/logging/Logger")
      hasError: this._hasError,
const Logger = require("src/core/logging/Logger")
      errorMessage: this._errorMessage,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 清除錯誤狀態
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  clearErrorState () {
const Logger = require("src/core/logging/Logger")
    this.setErrorState(false, null)
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 取得錯誤狀態
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {boolean} 是否有錯誤
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  hasError () {
const Logger = require("src/core/logging/Logger")
    return this._hasError
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 取得錯誤訊息
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {string|null} 錯誤訊息
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  getErrorMessage () {
const Logger = require("src/core/logging/Logger")
    return this._errorMessage
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 取得完整 UI 狀態
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {Object} UI 狀態快照
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  getUIState () {
const Logger = require("src/core/logging/Logger")
    return {
const Logger = require("src/core/logging/Logger")
      isSearching: this._isSearching,
const Logger = require("src/core/logging/Logger")
      isLoading: this._isLoading,
const Logger = require("src/core/logging/Logger")
      hasError: this._hasError,
const Logger = require("src/core/logging/Logger")
      errorMessage: this._errorMessage,
const Logger = require("src/core/logging/Logger")
      currentQuery: this.currentQuery,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 篩選器 UI 控制方法
const Logger = require("src/core/logging/Logger")
   */

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 更新篩選器 UI
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} filterOptions - 篩選選項
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  updateFilterUI (filterOptions) {
const Logger = require("src/core/logging/Logger")
    this.emitEvent('FILTER.UI.UPDATED', {
const Logger = require("src/core/logging/Logger")
      filterOptions,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理篩選器變更
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Event} event - 變更事件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleFilterChange (event) {
const Logger = require("src/core/logging/Logger")
    const { target } = event

const Logger = require("src/core/logging/Logger")
    this.emitEvent('FILTER.SELECTION.CHANGED', {
const Logger = require("src/core/logging/Logger")
      filterName: target.name,
const Logger = require("src/core/logging/Logger")
      filterValue: target.value,
const Logger = require("src/core/logging/Logger")
      isSelected: target.checked,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 重置所有篩選器
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  resetFilters () {
const Logger = require("src/core/logging/Logger")
    this.emitEvent('FILTER.RESET', {
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 設置篩選器載入狀態
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {boolean} isLoading - 是否正在載入
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  setFilterLoadingState (isLoading) {
const Logger = require("src/core/logging/Logger")
    if (this.filterContainer) {
const Logger = require("src/core/logging/Logger")
      this.filterContainer.style.opacity = isLoading ? '0.5' : '1'
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    this.emitEvent('FILTER.UI.LOADING.CHANGED', {
const Logger = require("src/core/logging/Logger")
      isLoading,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 設置篩選器錯誤狀態
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} errorMessage - 錯誤訊息
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  setFilterErrorState (errorMessage) {
const Logger = require("src/core/logging/Logger")
    this.emitEvent('FILTER.UI.ERROR', {
const Logger = require("src/core/logging/Logger")
      errorMessage,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 搜尋結果 UI 顯示控制方法
const Logger = require("src/core/logging/Logger")
   */

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 顯示搜尋結果
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Array} searchResults - 搜尋結果
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  displaySearchResults (searchResults) {
const Logger = require("src/core/logging/Logger")
    if (searchResults && searchResults.length > 0) {
const Logger = require("src/core/logging/Logger")
      this.emitEvent('SEARCH.RESULTS.DISPLAYED', {
const Logger = require("src/core/logging/Logger")
        resultCount: searchResults.length,
const Logger = require("src/core/logging/Logger")
        results: searchResults,
const Logger = require("src/core/logging/Logger")
        timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
    } else {
const Logger = require("src/core/logging/Logger")
      this.emitEvent('SEARCH.RESULTS.EMPTY', {
const Logger = require("src/core/logging/Logger")
        message: '沒有找到符合條件的書籍',
const Logger = require("src/core/logging/Logger")
        timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 清除搜尋結果顯示
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  clearSearchResults () {
const Logger = require("src/core/logging/Logger")
    if (this.resultContainer) {
const Logger = require("src/core/logging/Logger")
      this.resultContainer.innerHTML = ''
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    this.emitEvent('SEARCH.RESULTS.CLEARED', {
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 顯示搜尋結果統計
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} statistics - 統計資料
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  displaySearchStatistics (statistics) {
const Logger = require("src/core/logging/Logger")
    this.emitEvent('SEARCH.STATISTICS.DISPLAYED', {
const Logger = require("src/core/logging/Logger")
      statistics,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理搜尋結果分頁
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {number} currentPage - 當前頁數
const Logger = require("src/core/logging/Logger")
   * @param {number} pageSize - 每頁大小
const Logger = require("src/core/logging/Logger")
   * @param {number} totalResults - 總結果數
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleResultsPagination (currentPage, pageSize, totalResults) {
const Logger = require("src/core/logging/Logger")
    const totalPages = Math.ceil(totalResults / pageSize)

const Logger = require("src/core/logging/Logger")
    this.emitEvent('SEARCH.RESULTS.PAGINATION', {
const Logger = require("src/core/logging/Logger")
      currentPage,
const Logger = require("src/core/logging/Logger")
      pageSize,
const Logger = require("src/core/logging/Logger")
      totalResults,
const Logger = require("src/core/logging/Logger")
      totalPages,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 錯誤狀態 UI 處理方法
const Logger = require("src/core/logging/Logger")
   */

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理搜尋錯誤
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Error} error - 錯誤物件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleSearchError (error) {
const Logger = require("src/core/logging/Logger")
    const errorMessage = error.message || '搜尋發生未知錯誤'

const Logger = require("src/core/logging/Logger")
    this.emitEvent('UI.SEARCH.ERROR', {
const Logger = require("src/core/logging/Logger")
      error: errorMessage,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理驗證錯誤
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} validationError - 驗證錯誤
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleValidationError (validationError) {
const Logger = require("src/core/logging/Logger")
    this.emitEvent('UI.VALIDATION.ERROR', {
const Logger = require("src/core/logging/Logger")
      field: validationError.field,
const Logger = require("src/core/logging/Logger")
      message: validationError.message,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理網絡錯誤
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} networkError - 網絡錯誤
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleNetworkError (networkError) {
const Logger = require("src/core/logging/Logger")
    this.emitEvent('UI.NETWORK.ERROR', {
const Logger = require("src/core/logging/Logger")
      type: networkError.type,
const Logger = require("src/core/logging/Logger")
      message: networkError.message,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 顯示臨時錯誤訊息
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} message - 錯誤訊息
const Logger = require("src/core/logging/Logger")
   * @param {number} duration - 顯示持續時間
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  showTemporaryError (message, duration = this.config.errorDisplayDuration) {
const Logger = require("src/core/logging/Logger")
    this.setErrorState(true, message)

const Logger = require("src/core/logging/Logger")
    // 清除之前的錯誤計時器
const Logger = require("src/core/logging/Logger")
    if (this.errorTimer) {
const Logger = require("src/core/logging/Logger")
      clearTimeout(this.errorTimer)
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 設置自動清除計時器
const Logger = require("src/core/logging/Logger")
    this.errorTimer = setTimeout(() => {
const Logger = require("src/core/logging/Logger")
      this.clearErrorState()
const Logger = require("src/core/logging/Logger")
      this.emitEvent('UI.ERROR.AUTO.CLEARED', {
const Logger = require("src/core/logging/Logger")
        timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
    }, duration)
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 效能監控 UI 反饋方法
const Logger = require("src/core/logging/Logger")
   */

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 顯示效能警告
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} performanceData - 效能資料
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  showPerformanceWarning (performanceData) {
const Logger = require("src/core/logging/Logger")
    this.emitEvent('UI.PERFORMANCE.WARNING', {
const Logger = require("src/core/logging/Logger")
      searchTime: performanceData.searchTime,
const Logger = require("src/core/logging/Logger")
      threshold: performanceData.threshold,
const Logger = require("src/core/logging/Logger")
      query: performanceData.query,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 更新效能指標顯示
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} metrics - 效能指標
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  updatePerformanceMetrics (metrics) {
const Logger = require("src/core/logging/Logger")
    this.emitEvent('UI.PERFORMANCE.METRICS.UPDATED', {
const Logger = require("src/core/logging/Logger")
      metrics,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 更新載入進度
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {number} progress - 進度百分比 (0-100)
const Logger = require("src/core/logging/Logger")
   * @param {string} message - 進度訊息
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  updateLoadingProgress (progress, message) {
const Logger = require("src/core/logging/Logger")
    this.emitEvent('UI.LOADING.PROGRESS', {
const Logger = require("src/core/logging/Logger")
      progress,
const Logger = require("src/core/logging/Logger")
      message,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 外部事件處理器
const Logger = require("src/core/logging/Logger")
   */

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理搜尋結果就緒事件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} event - 事件物件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleSearchResultsReady (event) {
const Logger = require("src/core/logging/Logger")
    if (event.results) {
const Logger = require("src/core/logging/Logger")
      this.displaySearchResults(event.results)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理篩選選項更新事件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} event - 事件物件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleFilterOptionsUpdated (event) {
const Logger = require("src/core/logging/Logger")
    if (event.options) {
const Logger = require("src/core/logging/Logger")
      this.updateFilterUI(event.options)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理主題變更事件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} themeEvent - 主題事件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleThemeChanged (themeEvent) {
const Logger = require("src/core/logging/Logger")
    this.emitEvent('UI.THEME.APPLIED', {
const Logger = require("src/core/logging/Logger")
      theme: themeEvent.theme,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 與外部系統整合方法
const Logger = require("src/core/logging/Logger")
   */

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理協調器事件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} coordinatorEvent - 協調器事件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleCoordinatorEvent (coordinatorEvent) {
const Logger = require("src/core/logging/Logger")
    this.emitEvent('UI.COORDINATOR.RESPONSE', {
const Logger = require("src/core/logging/Logger")
      type: coordinatorEvent.type,
const Logger = require("src/core/logging/Logger")
      handled: true,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理搜尋引擎事件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} searchEngineEvent - 搜尋引擎事件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleSearchEngineEvent (searchEngineEvent) {
const Logger = require("src/core/logging/Logger")
    this.emitEvent('UI.SEARCH.ENGINE.PROGRESS', {
const Logger = require("src/core/logging/Logger")
      progress: searchEngineEvent.progress,
const Logger = require("src/core/logging/Logger")
      message: searchEngineEvent.message,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理篩選引擎事件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} filterEngineEvent - 篩選引擎事件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleFilterEngineEvent (filterEngineEvent) {
const Logger = require("src/core/logging/Logger")
    this.emitEvent('UI.FILTER.OPTIONS.SYNC', {
const Logger = require("src/core/logging/Logger")
      options: filterEngineEvent.options,
const Logger = require("src/core/logging/Logger")
      timestamp: Date.now()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 動畫系統方法
const Logger = require("src/core/logging/Logger")
   */

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 取得活躍動畫數量
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {number} 活躍動畫數量
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  getActiveAnimationsCount () {
const Logger = require("src/core/logging/Logger")
    return this.activeAnimationsCount
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 工具方法
const Logger = require("src/core/logging/Logger")
   */

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 發出事件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} eventName - 事件名稱
const Logger = require("src/core/logging/Logger")
   * @param {Object} eventData - 事件資料
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  emitEvent (eventName, eventData) {
const Logger = require("src/core/logging/Logger")
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
const Logger = require("src/core/logging/Logger")
      this.eventBus.emit(eventName, eventData)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 生命週期和資源清理方法
const Logger = require("src/core/logging/Logger")
   */

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 執行資源清理
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  cleanup () {
const Logger = require("src/core/logging/Logger")
    // 防止重複清理
const Logger = require("src/core/logging/Logger")
    if (this.isCleanedUp) {
const Logger = require("src/core/logging/Logger")
      return
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 清除所有計時器
const Logger = require("src/core/logging/Logger")
    this.clearAllTimers()

const Logger = require("src/core/logging/Logger")
    // 移除事件監聽器
const Logger = require("src/core/logging/Logger")
    this.removeAllEventListeners()

const Logger = require("src/core/logging/Logger")
    // 重置 UI 狀態
const Logger = require("src/core/logging/Logger")
    this.resetUIState()

const Logger = require("src/core/logging/Logger")
    // 清除 DOM 引用
const Logger = require("src/core/logging/Logger")
    this.clearDOMReferences()

const Logger = require("src/core/logging/Logger")
    // 標記為已清理
const Logger = require("src/core/logging/Logger")
    this.isCleanedUp = true
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 清除所有計時器
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  clearAllTimers () {
const Logger = require("src/core/logging/Logger")
    if (this.debounceTimer) {
const Logger = require("src/core/logging/Logger")
      clearTimeout(this.debounceTimer)
const Logger = require("src/core/logging/Logger")
      this.debounceTimer = null
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (this.errorTimer) {
const Logger = require("src/core/logging/Logger")
      clearTimeout(this.errorTimer)
const Logger = require("src/core/logging/Logger")
      this.errorTimer = null
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 移除所有事件監聽器
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  removeAllEventListeners () {
const Logger = require("src/core/logging/Logger")
    // 移除 DOM 事件監聽器
const Logger = require("src/core/logging/Logger")
    if (this.searchInput && this.boundHandlers.handleSearchInput) {
const Logger = require("src/core/logging/Logger")
      this.searchInput.removeEventListener('input', this.boundHandlers.handleSearchInput)
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 移除事件總線監聽器
const Logger = require("src/core/logging/Logger")
    if (this.eventBus) {
const Logger = require("src/core/logging/Logger")
      this.eventBus.off('SEARCH.RESULTS.READY', this.boundHandlers.handleSearchResultsReady)
const Logger = require("src/core/logging/Logger")
      this.eventBus.off('SEARCH.ERROR', this.boundHandlers.handleSearchError)
const Logger = require("src/core/logging/Logger")
      this.eventBus.off('FILTER.OPTIONS.UPDATED', this.boundHandlers.handleFilterOptionsUpdated)
const Logger = require("src/core/logging/Logger")
      this.eventBus.off('UI.THEME.CHANGED', this.boundHandlers.handleThemeChanged)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 重置 UI 狀態
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  resetUIState () {
const Logger = require("src/core/logging/Logger")
    this.currentQuery = ''
const Logger = require("src/core/logging/Logger")
    this._isSearching = false
const Logger = require("src/core/logging/Logger")
    this._isLoading = false
const Logger = require("src/core/logging/Logger")
    this._hasError = false
const Logger = require("src/core/logging/Logger")
    this._errorMessage = null
const Logger = require("src/core/logging/Logger")
    this.activeAnimationsCount = 0
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 清除 DOM 引用
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  clearDOMReferences () {
const Logger = require("src/core/logging/Logger")
    this.searchInput = null
const Logger = require("src/core/logging/Logger")
    this.filterContainer = null
const Logger = require("src/core/logging/Logger")
    this.resultContainer = null
const Logger = require("src/core/logging/Logger")
  }
const Logger = require("src/core/logging/Logger")
}

const Logger = require("src/core/logging/Logger")
module.exports = SearchUIController
