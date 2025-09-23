/**
 * SearchUIController 測試套件
 * TDD 循環 7/8: UI 交互控制邏輯拆分
 *
 * 測試範圍：
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
 */

const SearchUIController = require('src/ui/search/ui-controller/search-ui-controller')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

describe('SearchUIController', () => {
  let searchUIController
  let mockEventBus
  let mockDocument
  let mockSearchInput
  let mockFilterContainer
  let mockResultContainer

  beforeEach(() => {
    // 設置 Jest 假計時器
    jest.useFakeTimers()

    // 建立 Mock DOM 元素
    mockSearchInput = {
      value: '',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      removeAttribute: jest.fn(),
      focus: jest.fn(),
      blur: jest.fn(),
      style: {}
    }

    mockFilterContainer = {
      innerHTML: '',
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([]),
      style: {}
    }

    mockResultContainer = {
      innerHTML: '',
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([]),
      style: {}
    }

    // 建立 Mock Document
    mockDocument = {
      getElementById: jest.fn((id) => {
        switch (id) {
          case 'search-input': return mockSearchInput
          case 'filter-container': return mockFilterContainer
          case 'result-container': return mockResultContainer
          default: return null
        }
      }),
      createElement: jest.fn((tag) => ({
        tagName: tag.toUpperCase(),
        innerHTML: '',
        appendChild: jest.fn(),
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
        style: {}
      })),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }

    // 建立 Mock EventBus
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    }

    // 建立標準測試配置
    setupStandardConfiguration()
  })

  afterEach(() => {
    if (searchUIController) {
      searchUIController.cleanup()
    }
    jest.clearAllMocks()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  function setupStandardConfiguration () {
    // 標準配置設置
  }

  describe('1. Construction and Initialization', () => {
    test('應該成功建構 SearchUIController 實例', () => {
      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })

      expect(searchUIController).toBeInstanceOf(SearchUIController)
      expect(searchUIController.eventBus).toBe(mockEventBus)
      expect(searchUIController.document).toBe(mockDocument)
    })

    test('應該正確初始化 DOM 元素引用', () => {
      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })

      expect(mockDocument.getElementById).toHaveBeenCalledWith('search-input')
      expect(mockDocument.getElementById).toHaveBeenCalledWith('filter-container')
      expect(mockDocument.getElementById).toHaveBeenCalledWith('result-container')

      expect(searchUIController.searchInput).toBe(mockSearchInput)
      expect(searchUIController.filterContainer).toBe(mockFilterContainer)
      expect(searchUIController.resultContainer).toBe(mockResultContainer)
    })

    test('應該拋出錯誤當缺少必要依賴', () => {
      try {
        const controller = new SearchUIController({})
        // 變數賦值確保建構子結果被正確處理，測試錯誤條件
        throw new Error('應該拋出錯誤')
      } catch (error) {
        expect(error).toMatchObject({
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'EventBus 和 Document 是必需的',
          details: expect.objectContaining({
            category: 'ui'
          })
        })
      }

      try {
        const controller = new SearchUIController({ eventBus: mockEventBus })
        // 變數賦值確保建構子結果被正確處理，測試錯誤條件
        throw new Error('應該拋出錯誤')
      } catch (error) {
        expect(error).toMatchObject({
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'EventBus 和 Document 是必需的',
          details: expect.objectContaining({
            category: 'ui'
          })
        })
      }

      try {
        const controller = new SearchUIController({ document: mockDocument })
        // 變數賦值確保建構子結果被正確處理，測試錯誤條件
        throw new Error('應該拋出錯誤')
      } catch (error) {
        expect(error).toMatchObject({
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'EventBus 和 Document 是必需的',
          details: expect.objectContaining({
            category: 'ui'
          })
        })
      }
    })

    test('應該初始化預設 UI 配置', () => {
      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })

      expect(searchUIController.config).toBeDefined()
      expect(searchUIController.config.debounceDelay).toBe(300)
      expect(searchUIController.config.animationDuration).toBe(200)
      expect(searchUIController.config.maxSuggestions).toBe(5)
    })

    test('應該允許自訂 UI 配置覆蓋', () => {
      const customConfig = {
        debounceDelay: 500,
        animationDuration: 300,
        maxSuggestions: 10
      }

      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument,
        config: customConfig
      })

      expect(searchUIController.config.debounceDelay).toBe(500)
      expect(searchUIController.config.animationDuration).toBe(300)
      expect(searchUIController.config.maxSuggestions).toBe(10)
    })
  })

  describe('2. DOM Elements Management', () => {
    beforeEach(() => {
      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })
    })

    test('應該正確取得必要的 DOM 元素', () => {
      expect(searchUIController.getSearchInput()).toBe(mockSearchInput)
      expect(searchUIController.getFilterContainer()).toBe(mockFilterContainer)
      expect(searchUIController.getResultContainer()).toBe(mockResultContainer)
    })

    test('應該處理 DOM 元素不存在的情況', () => {
      mockDocument.getElementById.mockReturnValue(null)

      const controller = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })

      expect(controller.searchInput).toBeNull()
      expect(controller.filterContainer).toBeNull()
      expect(controller.resultContainer).toBeNull()
    })

    test('應該提供 DOM 元素存在性檢查', () => {
      expect(searchUIController.hasSearchInput()).toBe(true)
      expect(searchUIController.hasFilterContainer()).toBe(true)
      expect(searchUIController.hasResultContainer()).toBe(true)

      // 測試元素不存在的情況
      searchUIController.searchInput = null
      expect(searchUIController.hasSearchInput()).toBe(false)
    })

    test('應該能夠重新初始化 DOM 引用', () => {
      searchUIController.reinitializeDOMReferences()

      expect(mockDocument.getElementById).toHaveBeenCalledTimes(6) // 初始3次 + 重新初始化3次
    })
  })

  describe('3. Search Input Handling', () => {
    beforeEach(() => {
      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })
    })

    test('應該設置搜尋輸入事件監聽器', () => {
      expect(mockSearchInput.addEventListener).toHaveBeenCalledWith(
        'input',
        expect.any(Function)
      )
    })

    test('應該處理搜尋輸入事件', () => {
      const mockEvent = {
        target: { value: 'test query' }
      }

      searchUIController.handleSearchInput(mockEvent)

      expect(searchUIController.currentQuery).toBe('test query')
    })

    test('應該觸發搜尋輸入變更事件', () => {
      const mockEvent = {
        target: { value: 'javascript' }
      }

      searchUIController.handleSearchInput(mockEvent)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.INPUT.CHANGED', {
        query: 'javascript',
        timestamp: expect.any(Number)
      })
    })

    test('應該處理空輸入值', () => {
      const mockEvent = {
        target: { value: '' }
      }

      searchUIController.handleSearchInput(mockEvent)

      expect(searchUIController.currentQuery).toBe('')
      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.INPUT.CLEARED', {
        timestamp: expect.any(Number)
      })
    })

    test('應該正規化輸入查詢', () => {
      const mockEvent = {
        target: { value: '  JavaScript  Programming  ' }
      }

      searchUIController.handleSearchInput(mockEvent)

      expect(searchUIController.currentQuery).toBe('javascript programming')
    })

    test('應該處理特殊字符輸入', () => {
      const mockEvent = {
        target: { value: 'test@#$%^&*()' }
      }

      searchUIController.handleSearchInput(mockEvent)

      expect(searchUIController.currentQuery).toBe('test')
    })
  })

  describe('4. Search Debouncing Control', () => {
    beforeEach(() => {
      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })
    })

    test('應該實現搜尋防抖機制', () => {
      const mockEvent1 = { target: { value: 'java' } }
      const mockEvent2 = { target: { value: 'javascript' } }

      searchUIController.handleSearchInput(mockEvent1)
      searchUIController.handleSearchInput(mockEvent2)

      // 在防抖延遲之前不應觸發搜尋
      expect(mockEventBus.emit).not.toHaveBeenCalledWith(
        expect.stringContaining('SEARCH.DEBOUNCED')
      )

      jest.advanceTimersByTime(300)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.DEBOUNCED.TRIGGERED', {
        query: 'javascript',
        debounceDelay: 300,
        timestamp: expect.any(Number)
      })
    })

    test('應該清除之前的防抖計時器', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      const mockEvent1 = { target: { value: 'java' } }
      const mockEvent2 = { target: { value: 'javascript' } }

      searchUIController.handleSearchInput(mockEvent1)
      searchUIController.handleSearchInput(mockEvent2)

      expect(clearTimeoutSpy).toHaveBeenCalled()
    })

    test('應該支援自訂防抖延遲時間', () => {
      const customController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument,
        config: { debounceDelay: 500 }
      })

      const mockEvent = { target: { value: 'test' } }
      customController.handleSearchInput(mockEvent)

      jest.advanceTimersByTime(300)
      expect(mockEventBus.emit).not.toHaveBeenCalledWith(
        expect.stringContaining('SEARCH.DEBOUNCED')
      )

      jest.advanceTimersByTime(200)
      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.DEBOUNCED.TRIGGERED', {
        query: 'test',
        debounceDelay: 500,
        timestamp: expect.any(Number)
      })
    })

    test('應該取消防抖當輸入為空', () => {
      const mockEvent1 = { target: { value: 'test' } }
      const mockEvent2 = { target: { value: '' } }

      searchUIController.handleSearchInput(mockEvent1)
      searchUIController.handleSearchInput(mockEvent2)

      jest.advanceTimersByTime(300)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.INPUT.CLEARED', {
        timestamp: expect.any(Number)
      })
      expect(mockEventBus.emit).not.toHaveBeenCalledWith(
        expect.stringContaining('SEARCH.DEBOUNCED')
      )
    })
  })

  describe('5. UI State Management', () => {
    beforeEach(() => {
      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })
    })

    test('應該管理搜尋狀態', () => {
      expect(searchUIController.isSearching()).toBe(false)

      searchUIController.setSearchingState(true)
      expect(searchUIController.isSearching()).toBe(true)

      searchUIController.setSearchingState(false)
      expect(searchUIController.isSearching()).toBe(false)
    })

    test('應該更新搜尋狀態 UI', () => {
      searchUIController.setSearchingState(true)

      expect(mockEventBus.emit).toHaveBeenCalledWith('UI.SEARCH.STATE.CHANGED', {
        isSearching: true,
        timestamp: expect.any(Number)
      })
    })

    test('應該管理載入狀態', () => {
      expect(searchUIController.isLoading()).toBe(false)

      searchUIController.setLoadingState(true)
      expect(searchUIController.isLoading()).toBe(true)
      expect(mockSearchInput.setAttribute).toHaveBeenCalledWith('disabled', 'true')

      searchUIController.setLoadingState(false)
      expect(searchUIController.isLoading()).toBe(false)
    })

    test('應該管理錯誤狀態', () => {
      const errorMessage = '搜尋發生錯誤'

      searchUIController.setErrorState(true, errorMessage)

      expect(searchUIController.hasError()).toBe(true)
      expect(searchUIController.getErrorMessage()).toBe(errorMessage)
      expect(mockEventBus.emit).toHaveBeenCalledWith('UI.ERROR.STATE.CHANGED', {
        hasError: true,
        errorMessage,
        timestamp: expect.any(Number)
      })
    })

    test('應該清除錯誤狀態', () => {
      searchUIController.setErrorState(true, '錯誤訊息')
      searchUIController.clearErrorState()

      expect(searchUIController.hasError()).toBe(false)
      expect(searchUIController.getErrorMessage()).toBeNull()
    })

    test('應該提供完整的狀態快照', () => {
      searchUIController.setSearchingState(true)
      searchUIController.setLoadingState(true)
      searchUIController.setErrorState(true, '測試錯誤')

      const state = searchUIController.getUIState()

      expect(state).toEqual({
        isSearching: true,
        isLoading: true,
        hasError: true,
        errorMessage: '測試錯誤',
        currentQuery: '',
        timestamp: expect.any(Number)
      })
    })
  })

  describe('6. Filter UI Control', () => {
    beforeEach(() => {
      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })
    })

    test('應該更新篩選器 UI', () => {
      const filterOptions = {
        categories: ['技術', '文學'],
        status: ['已讀', '未讀'],
        progress: ['0-25%', '26-50%']
      }

      searchUIController.updateFilterUI(filterOptions)

      expect(mockEventBus.emit).toHaveBeenCalledWith('FILTER.UI.UPDATED', {
        filterOptions,
        timestamp: expect.any(Number)
      })
    })

    test('應該處理篩選器選擇變更', () => {
      const mockEvent = {
        target: {
          name: 'category',
          value: '技術',
          checked: true
        }
      }

      searchUIController.handleFilterChange(mockEvent)

      expect(mockEventBus.emit).toHaveBeenCalledWith('FILTER.SELECTION.CHANGED', {
        filterName: 'category',
        filterValue: '技術',
        isSelected: true,
        timestamp: expect.any(Number)
      })
    })

    test('應該重置所有篩選器', () => {
      searchUIController.resetFilters()

      expect(mockEventBus.emit).toHaveBeenCalledWith('FILTER.RESET', {
        timestamp: expect.any(Number)
      })
    })

    test('應該顯示篩選器載入狀態', () => {
      searchUIController.setFilterLoadingState(true)

      expect(mockFilterContainer.style.opacity).toBe('0.5')
      expect(mockEventBus.emit).toHaveBeenCalledWith('FILTER.UI.LOADING.CHANGED', {
        isLoading: true,
        timestamp: expect.any(Number)
      })
    })

    test('應該處理篩選器錯誤狀態', () => {
      const errorMessage = '篩選器載入失敗'

      searchUIController.setFilterErrorState(errorMessage)

      expect(mockEventBus.emit).toHaveBeenCalledWith('FILTER.UI.ERROR', {
        errorMessage,
        timestamp: expect.any(Number)
      })
    })
  })

  describe('7. Search Results UI Display', () => {
    beforeEach(() => {
      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })
    })

    test('應該顯示搜尋結果', () => {
      const searchResults = [
        { id: 1, title: 'JavaScript Guide', author: 'John Doe' },
        { id: 2, title: 'React Handbook', author: 'Jane Smith' }
      ]

      searchUIController.displaySearchResults(searchResults)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.RESULTS.DISPLAYED', {
        resultCount: 2,
        results: searchResults,
        timestamp: expect.any(Number)
      })
    })

    test('應該處理空搜尋結果', () => {
      searchUIController.displaySearchResults([])

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.RESULTS.EMPTY', {
        message: '沒有找到符合條件的書籍',
        timestamp: expect.any(Number)
      })
    })

    test('應該清除搜尋結果顯示', () => {
      searchUIController.clearSearchResults()

      expect(mockResultContainer.innerHTML).toBe('')
      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.RESULTS.CLEARED', {
        timestamp: expect.any(Number)
      })
    })

    test('應該顯示搜尋結果統計', () => {
      const statistics = {
        totalResults: 150,
        searchTime: 23,
        filteredResults: 45,
        cacheHit: true
      }

      searchUIController.displaySearchStatistics(statistics)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.STATISTICS.DISPLAYED', {
        statistics,
        timestamp: expect.any(Number)
      })
    })

    test('應該處理搜尋結果分頁', () => {
      searchUIController.handleResultsPagination(2, 10, 150)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.RESULTS.PAGINATION', {
        currentPage: 2,
        pageSize: 10,
        totalResults: 150,
        totalPages: 15,
        timestamp: expect.any(Number)
      })
    })
  })

  describe('8. Error State UI Handling', () => {
    beforeEach(() => {
      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })
    })

    test('應該顯示搜尋錯誤', () => {
      const error = new Error('搜尋服務暫時不可用')

      searchUIController.handleSearchError(error)

      expect(mockEventBus.emit).toHaveBeenCalledWith('UI.SEARCH.ERROR', {
        error: error.message,
        timestamp: expect.any(Number)
      })
    })

    test('應該顯示驗證錯誤', () => {
      const validationError = {
        field: 'query',
        message: '搜尋關鍵字太短'
      }

      searchUIController.handleValidationError(validationError)

      expect(mockEventBus.emit).toHaveBeenCalledWith('UI.VALIDATION.ERROR', {
        field: validationError.field,
        message: validationError.message,
        timestamp: expect.any(Number)
      })
    })

    test('應該顯示網絡錯誤', () => {
      const networkError = {
        type: 'network',
        message: '網絡連線中斷'
      }

      searchUIController.handleNetworkError(networkError)

      expect(mockEventBus.emit).toHaveBeenCalledWith('UI.NETWORK.ERROR', {
        type: networkError.type,
        message: networkError.message,
        timestamp: expect.any(Number)
      })
    })

    test('應該自動隱藏錯誤訊息', () => {
      searchUIController.showTemporaryError('臨時錯誤訊息', 3000)

      expect(searchUIController.hasError()).toBe(true)

      jest.advanceTimersByTime(3000)

      expect(searchUIController.hasError()).toBe(false)
      expect(mockEventBus.emit).toHaveBeenLastCalledWith('UI.ERROR.AUTO.CLEARED', {
        timestamp: expect.any(Number)
      })
    })
  })

  describe('9. Performance Monitoring UI Feedback', () => {
    beforeEach(() => {
      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })
    })

    test('應該顯示效能警告', () => {
      const performanceData = {
        searchTime: 2500,
        threshold: 2000,
        query: 'slow query'
      }

      searchUIController.showPerformanceWarning(performanceData)

      expect(mockEventBus.emit).toHaveBeenCalledWith('UI.PERFORMANCE.WARNING', {
        searchTime: 2500,
        threshold: 2000,
        query: 'slow query',
        timestamp: expect.any(Number)
      })
    })

    test('應該更新效能指標顯示', () => {
      const metrics = {
        avgSearchTime: 156,
        totalSearches: 45,
        cacheHitRate: 0.78,
        memoryUsage: '12.5MB'
      }

      searchUIController.updatePerformanceMetrics(metrics)

      expect(mockEventBus.emit).toHaveBeenCalledWith('UI.PERFORMANCE.METRICS.UPDATED', {
        metrics,
        timestamp: expect.any(Number)
      })
    })

    test('應該顯示載入進度', () => {
      searchUIController.updateLoadingProgress(65, '正在處理篩選條件...')

      expect(mockEventBus.emit).toHaveBeenCalledWith('UI.LOADING.PROGRESS', {
        progress: 65,
        message: '正在處理篩選條件...',
        timestamp: expect.any(Number)
      })
    })
  })

  describe('10. Event Listeners Management', () => {
    beforeEach(() => {
      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })
    })

    test('應該註冊所有必要的事件監聽器', () => {
      expect(mockEventBus.on).toHaveBeenCalledWith('SEARCH.RESULTS.READY', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('SEARCH.ERROR', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('FILTER.OPTIONS.UPDATED', expect.any(Function))
      expect(mockEventBus.on).toHaveBeenCalledWith('UI.THEME.CHANGED', expect.any(Function))
    })

    test('應該處理搜尋結果就緒事件', () => {
      const eventHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'SEARCH.RESULTS.READY'
      )[1]

      const mockEvent = {
        results: [{ id: 1, title: 'Test Book' }],
        query: 'test',
        searchTime: 123
      }

      eventHandler(mockEvent)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.RESULTS.DISPLAYED', expect.any(Object))
    })

    test('應該處理主題變更事件', () => {
      const eventHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'UI.THEME.CHANGED'
      )[1]

      const themeEvent = { theme: 'dark' }
      eventHandler(themeEvent)

      expect(mockEventBus.emit).toHaveBeenCalledWith('UI.THEME.APPLIED', {
        theme: 'dark',
        timestamp: expect.any(Number)
      })
    })

    test('應該正確移除事件監聽器', () => {
      searchUIController.cleanup()

      expect(mockEventBus.off).toHaveBeenCalledWith('SEARCH.RESULTS.READY', expect.any(Function))
      expect(mockEventBus.off).toHaveBeenCalledWith('SEARCH.ERROR', expect.any(Function))
      expect(mockEventBus.off).toHaveBeenCalledWith('FILTER.OPTIONS.UPDATED', expect.any(Function))
      expect(mockEventBus.off).toHaveBeenCalledWith('UI.THEME.CHANGED', expect.any(Function))
    })

    test('應該移除 DOM 事件監聽器', () => {
      searchUIController.cleanup()

      expect(mockSearchInput.removeEventListener).toHaveBeenCalledWith('input', expect.any(Function))
    })
  })

  describe('11. Lifecycle and Resource Cleanup', () => {
    beforeEach(() => {
      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })
    })

    test('應該執行完整的資源清理', () => {
      searchUIController.cleanup()

      // 檢查防抖計時器清理
      expect(searchUIController.debounceTimer).toBeNull()

      // 檢查 UI 狀態重置
      expect(searchUIController.isSearching()).toBe(false)
      expect(searchUIController.isLoading()).toBe(false)
      expect(searchUIController.hasError()).toBe(false)
    })

    test('應該清除所有計時器', () => {
      jest.useFakeTimers()
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      const mockEvent = { target: { value: 'test' } }
      searchUIController.handleSearchInput(mockEvent)

      searchUIController.cleanup()

      expect(clearTimeoutSpy).toHaveBeenCalled()
      jest.useRealTimers()
    })

    test('應該重置所有 DOM 引用', () => {
      searchUIController.cleanup()

      expect(searchUIController.searchInput).toBeNull()
      expect(searchUIController.filterContainer).toBeNull()
      expect(searchUIController.resultContainer).toBeNull()
    })

    test('應該支援多次清理調用', () => {
      searchUIController.cleanup()
      expect(() => searchUIController.cleanup()).not.toThrow()
    })

    test('應該在清理後拒絕新的操作', () => {
      searchUIController.cleanup()

      expect(() => {
        const mockEvent = { target: { value: 'test' } }
        searchUIController.handleSearchInput(mockEvent)
      }).toMatchObject(expect.objectContaining({ message: 'SearchUIController 已被清理' }))
    })
  })

  describe('12. Integration with External Systems', () => {
    beforeEach(() => {
      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })
    })

    test('應該與協調器正確整合', () => {
      const coordinatorEvent = {
        type: 'COORDINATOR.SEARCH.COMPLETED',
        data: {
          results: [{ id: 1, title: 'Book 1' }],
          statistics: { searchTime: 150 }
        }
      }

      searchUIController.handleCoordinatorEvent(coordinatorEvent)

      expect(mockEventBus.emit).toHaveBeenCalledWith('UI.COORDINATOR.RESPONSE', {
        type: coordinatorEvent.type,
        handled: true,
        timestamp: expect.any(Number)
      })
    })

    test('應該處理搜尋引擎事件', () => {
      const searchEngineEvent = {
        type: 'SEARCH.ENGINE.PROGRESS',
        progress: 75,
        message: '正在搜尋標籤索引...'
      }

      searchUIController.handleSearchEngineEvent(searchEngineEvent)

      expect(mockEventBus.emit).toHaveBeenCalledWith('UI.SEARCH.ENGINE.PROGRESS', {
        progress: 75,
        message: '正在搜尋標籤索引...',
        timestamp: expect.any(Number)
      })
    })

    test('應該回應篩選引擎更新', () => {
      const filterEngineEvent = {
        type: 'FILTER.ENGINE.OPTIONS.UPDATED',
        options: {
          categories: ['技術', '文學', '科學'],
          authors: ['作者A', '作者B']
        }
      }

      searchUIController.handleFilterEngineEvent(filterEngineEvent)

      expect(mockEventBus.emit).toHaveBeenCalledWith('UI.FILTER.OPTIONS.SYNC', {
        options: filterEngineEvent.options,
        timestamp: expect.any(Number)
      })
    })
  })

  describe('13. Error Edge Cases', () => {
    beforeEach(() => {
      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })
    })

    test('應該處理事件總線不可用', () => {
      searchUIController.eventBus = null

      expect(() => {
        const mockEvent = { target: { value: 'test' } }
        searchUIController.handleSearchInput(mockEvent)
      }).not.toThrow()
    })

    test('應該處理 DOM 元素意外移除', () => {
      searchUIController.searchInput = null

      const mockEvent = { target: { value: 'test' } }

      expect(() => {
        searchUIController.handleSearchInput(mockEvent)
      }).not.toThrow()
    })

    test('應該處理異常大的搜尋查詢', () => {
      const longQuery = 'a'.repeat(10000)
      const mockEvent = { target: { value: longQuery } }

      searchUIController.handleSearchInput(mockEvent)

      expect(searchUIController.currentQuery.length).toBeLessThanOrEqual(1000)
    })

    test('應該處理記憶體不足情況', () => {
      // 模擬記憶體不足
      // eslint-disable-next-line no-console
      const originalError = console.error
      // eslint-disable-next-line no-console
      console.error = jest.fn()

      const mockEvent = { target: { value: 'test' } }

      // 模擬處理過程中的記憶體問題
      const originalNormalize = searchUIController.normalizeSearchQuery
      searchUIController.normalizeSearchQuery = jest.fn().mockImplementation(() => {
        const error = new Error('Memory allocation failed')
        error.code = 'SEARCH_UI_MEMORY_ERROR'
        error.details = { category: 'testing' }
        throw error
      })

      expect(() => {
        searchUIController.handleSearchInput(mockEvent)
      }).not.toThrow()

      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalled()

      // 恢復原始方法和控制台
      searchUIController.normalizeSearchQuery = originalNormalize
      // eslint-disable-next-line no-console
      console.error = originalError
    })
  })

  describe('14. Performance Requirements', () => {
    beforeEach(() => {
      searchUIController = new SearchUIController({
        eventBus: mockEventBus,
        document: mockDocument
      })
    })

    test('應該在要求的時間內處理輸入事件', () => {
      const startTime = performance.now()

      const mockEvent = { target: { value: 'test query' } }
      searchUIController.handleSearchInput(mockEvent)

      const executionTime = performance.now() - startTime
      expect(executionTime).toBeLessThan(10) // 應在10ms內完成
    })

    test('應該高效處理大量快速輸入', () => {
      const inputCount = 100

      for (let i = 0; i < inputCount; i++) {
        const mockEvent = { target: { value: `query${i}` } }
        searchUIController.handleSearchInput(mockEvent)
      }

      // 只有最後一個查詢應該被處理
      jest.advanceTimersByTime(300)

      expect(mockEventBus.emit).toHaveBeenCalledWith('SEARCH.DEBOUNCED.TRIGGERED', {
        query: 'query99',
        debounceDelay: 300,
        timestamp: expect.any(Number)
      })
    })

    test('應該限制同時進行的動畫數量', () => {
      for (let i = 0; i < 10; i++) {
        searchUIController.setLoadingState(true)
        searchUIController.setLoadingState(false)
      }

      // 檢查動畫隊列不會無限增長
      expect(searchUIController.getActiveAnimationsCount()).toBeLessThanOrEqual(3)
    })
  })
})
