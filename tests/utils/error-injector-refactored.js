/**
 * ErrorInjector - 錯誤注入工具 - 重構版
 * 遵循 Five Lines 規則和單一責任原則
 * 提供精確的錯誤場景模擬能力
 *
 * @author TDD Phase 4 - cinnamon-refactor-owl重構設計師（重構）
 * @original-author TDD Phase 3 - pepper-test-implementer規劃
 * @date 2025-08-25
 * @version v0.9.38-refactor
 */

/**
 * 錯誤注入器 - 重構版
 * 統一管理各種錯誤場景的模擬
 */
class ErrorInjector {
  constructor () {
    this._initializeState()
    this._initializeConfig()
  }

  /**
   * 初始化狀態
   */
  _initializeState () {
    this.originalMethods = new Map()
    this.activeInjections = new Set()
  }

  /**
   * 初始化配置
   */
  _initializeConfig () {
    this.errorConfig = {
      probability: 1.0, // 預設100%錯誤率
      delay: 0 // 預設無延遲
    }
  }

  /**
   * 注入Chrome Extension API錯誤
   * @param {string} api - API名稱
   * @param {string} method - 方法名稱
   * @param {Error} error - 要拋出的錯誤
   */
  injectChromeApiError (api, method, error) {
    this._validateInjectionParameters(api, method, error)
    this._performChromeApiInjection(api, method, error)
  }

  /**
   * 驗證注入參數
   */
  _validateInjectionParameters (api, method, error) {
    if (!api || !method || !error) {
      throw new StandardError('ERROR_INJECTION_NOT_ENABLED', 'All parameters are required for error injection', { category: 'testing' })
    }
  }

  /**
   * 執行Chrome API錯誤注入
   */
  _performChromeApiInjection (api, method, error) {
    const fullPath = `${api}.${method}`
    this._saveOriginalMethod(fullPath)
    this._injectErrorMethod(fullPath, error)
  }

  /**
   * 保存原始方法
   */
  _saveOriginalMethod (fullPath) {
    const originalMethod = this._getNestedProperty(global, fullPath)
    this.originalMethods.set(fullPath, originalMethod)
  }

  /**
   * 注入錯誤方法
   */
  _injectErrorMethod (fullPath, error) {
    const errorFunction = () => { throw error }
    this._setNestedProperty(global, fullPath, errorFunction)
    this.activeInjections.add(fullPath)
  }

  /**
   * 注入網路請求錯誤
   * @param {string} type - 錯誤類型
   * @param {number} delay - 延遲時間
   */
  injectNetworkError (type, delay = 0) {
    this._validateNetworkErrorType(type)
    this._performNetworkErrorInjection(type, delay)
  }

  /**
   * 驗證網路錯誤類型
   */
  _validateNetworkErrorType (type) {
    const validTypes = ['timeout', 'network', 'dns']
    if (!validTypes.includes(type)) {
      throw new StandardError('VALIDATION_FAILED', `Invalid network error type: ${type}`, { category: 'testing' })
    }
  }

  /**
   * 執行網路錯誤注入
   */
  _performNetworkErrorInjection (type, delay) {
    this._saveOriginalFetch()
    this._injectFetchError(type, delay)
  }

  /**
   * 保存原始fetch方法
   */
  _saveOriginalFetch () {
    if (!this.originalMethods.has('global.fetch')) {
      this.originalMethods.set('global.fetch', global.fetch)
    }
  }

  /**
   * 注入fetch錯誤
   */
  _injectFetchError (type, delay) {
    global.fetch = this._createErrorFetch(type, delay)
    this.activeInjections.add('global.fetch')
  }

  /**
   * 創建錯誤fetch函數
   */
  _createErrorFetch (type, delay) {
    return async (...args) => {
      await this._applyDelay(delay)
      throw this._createNetworkError(type)
    }
  }

  /**
   * 應用延遲
   */
  async _applyDelay (delay) {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  /**
   * 創建網路錯誤
   */
  _createNetworkError (type) {
    const errorMessages = {
      timeout: 'Request timeout',
      network: 'Network error',
      dns: 'DNS resolution failed'
    }
    return new Error(errorMessages[type])
  }

  /**
   * 注入DOM操作錯誤
   * @param {string} selector - CSS選擇器
   * @param {boolean} returnNull - 是否返回null
   */
  injectDomError (selector, returnNull = true) {
    this._validateDomSelector(selector)
    this._performDomErrorInjection(selector, returnNull)
  }

  /**
   * 驗證DOM選擇器
   */
  _validateDomSelector (selector) {
    if (!selector || typeof selector !== 'string') {
      throw new StandardError('TEST_ERROR', 'Selector must be a non-empty string', { category: 'testing' })
    }
  }

  /**
   * 執行DOM錯誤注入
   */
  _performDomErrorInjection (selector, returnNull) {
    this._saveDomMethods()
    this._injectDomMethods(selector, returnNull)
  }

  /**
   * 保存DOM方法
   */
  _saveDomMethods () {
    if (!this.originalMethods.has('document.querySelector')) {
      this._saveQuerySelectorMethods()
    }
  }

  /**
   * 保存查詢選擇器方法
   */
  _saveQuerySelectorMethods () {
    this.originalMethods.set('document.querySelector', document.querySelector)
    this.originalMethods.set('document.querySelectorAll', document.querySelectorAll)
  }

  /**
   * 注入DOM方法
   */
  _injectDomMethods (selector, returnNull) {
    document.querySelector = this._createSelectorError(selector, returnNull, 'single')
    document.querySelectorAll = this._createSelectorError(selector, returnNull, 'all')
    this._markDomMethodsAsInjected()
  }

  /**
   * 創建選擇器錯誤
   */
  _createSelectorError (targetSelector, returnNull, type) {
    const original = this.originalMethods.get(`document.querySelector${type === 'all' ? 'All' : ''}`)

    return (sel) => {
      if (sel === targetSelector) {
        return this._handleSelectorError(returnNull, type, original, sel)
      }
      return original.call(document, sel)
    }
  }

  /**
   * 處理選擇器錯誤
   */
  _handleSelectorError (returnNull, type, original, sel) {
    if (returnNull) {
      return type === 'all' ? [] : null
    }
    return original.call(document, sel)
  }

  /**
   * 標記DOM方法已注入
   */
  _markDomMethodsAsInjected () {
    this.activeInjections.add('document.querySelector')
    this.activeInjections.add('document.querySelectorAll')
  }

  /**
   * 注入資料處理錯誤
   * @param {string} method - 方法名稱
   * @param {Error} error - 錯誤對象
   */
  injectDataProcessingError (method, error) {
    this._validateDataMethod(method)
    this._performDataErrorInjection(method, error)
  }

  /**
   * 驗證資料方法
   */
  _validateDataMethod (method) {
    const validMethods = ['JSON.parse', 'JSON.stringify']
    if (!validMethods.includes(method)) {
      throw new StandardError('VALIDATION_FAILED', `Invalid data processing method: ${method}`, { category: 'testing' })
    }
  }

  /**
   * 執行資料錯誤注入
   */
  _performDataErrorInjection (method, error) {
    this._saveDataMethod(method)
    this._injectDataMethod(method, error)
  }

  /**
   * 保存資料方法
   */
  _saveDataMethod (method) {
    if (!this.originalMethods.has(method)) {
      const original = method === 'JSON.parse' ? JSON.parse : JSON.stringify
      this.originalMethods.set(method, original)
    }
  }

  /**
   * 注入資料方法
   */
  _injectDataMethod (method, error) {
    if (method === 'JSON.parse') {
      JSON.parse = () => { throw error }
    } else {
      JSON.stringify = () => { throw error }
    }
    this.activeInjections.add(method)
  }

  /**
   * 恢復所有原始方法
   */
  restoreAll () {
    this._restoreAllMethods()
    this._clearState()
  }

  /**
   * 恢復所有方法
   */
  _restoreAllMethods () {
    for (const [path, originalMethod] of this.originalMethods) {
      this._restoreMethod(path, originalMethod)
    }
  }

  /**
   * 恢復單一方法
   */
  _restoreMethod (path, originalMethod) {
    if (path.includes('.')) {
      this._restoreNestedMethod(path, originalMethod)
    } else {
      this._restoreGlobalMethod(path, originalMethod)
    }
  }

  /**
   * 恢復嵌套方法
   */
  _restoreNestedMethod (path, originalMethod) {
    this._setNestedProperty(global, path, originalMethod)
  }

  /**
   * 恢復全域方法
   */
  _restoreGlobalMethod (path, originalMethod) {
    if (path.startsWith('JSON.')) {
      this._restoreJsonMethod(path, originalMethod)
    } else if (path.startsWith('document.')) {
      this._restoreDocumentMethod(path, originalMethod)
    }
  }

  /**
   * 恢復JSON方法
   */
  _restoreJsonMethod (path, originalMethod) {
    if (path === 'JSON.parse') {
      JSON.parse = originalMethod
    } else if (path === 'JSON.stringify') {
      JSON.stringify = originalMethod
    }
  }

  /**
   * 恢復文檔方法
   */
  _restoreDocumentMethod (path, originalMethod) {
    const methodName = path.split('.')[1]
    document[methodName] = originalMethod
  }

  /**
   * 清理狀態
   */
  _clearState () {
    this.originalMethods.clear()
    this.activeInjections.clear()
  }

  /**
   * 設置錯誤發生概率
   * @param {number} probability - 概率 (0-1)
   */
  setProbability (probability) {
    this._validateProbability(probability)
    this.errorConfig.probability = probability
  }

  /**
   * 驗證概率值
   */
  _validateProbability (probability) {
    if (typeof probability !== 'number' || probability < 0 || probability > 1) {
      throw new StandardError('TEST_ERROR', 'Probability must be a number between 0 and 1', { category: 'testing' })
    }
  }

  /**
   * 檢查是否應該觸發錯誤
   * @returns {boolean}
   */
  shouldTriggerError () {
    return Math.random() < this.errorConfig.probability
  }

  /**
   * 獲取活躍注入數量
   * @returns {number}
   */
  getActiveInjectionsCount () {
    return this.activeInjections.size
  }

  /**
   * 檢查是否有活躍注入
   * @returns {boolean}
   */
  hasActiveInjections () {
    return this.activeInjections.size > 0
  }

  /**
   * 輔助方法：獲取嵌套屬性
   */
  _getNestedProperty (obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key]
    }, obj)
  }

  /**
   * 輔助方法：設置嵌套屬性
   */
  _setNestedProperty (obj, path, value) {
    const keys = path.split('.')
    const lastKey = keys.pop()
    const target = this._navigateToTarget(obj, keys)
    target[lastKey] = value
  }

  /**
   * 導航到目標對象
   */
  _navigateToTarget (obj, keys) {
    return keys.reduce((current, key) => {
      if (!current[key]) current[key] = {}
      return current[key]
    }, obj)
  }
}

module.exports = ErrorInjector
