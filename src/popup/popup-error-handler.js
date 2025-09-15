const Logger = require('src/core/logging/Logger')
/**
 * PopupErrorHandler - 重構版錯誤處理器 (TDD 循環 #42)
 *
 * 負責功能：
 * - 錯誤邏輯處理和分析
 * - 錯誤恢復策略管理
 * - 事件驅動的錯誤報告
 * - 與 UIManager 整合進行 DOM 操作
 * - 診斷模組的動態載入
 * - Chrome API 錯誤處理
 *
 * 設計考量：
 * - 分離錯誤處理邏輯和 DOM 操作
 * - UIManager 負責所有 DOM 相關操作
 * - 保持向後相容性的 API
 * - 支援依賴注入和模組化設計
 *
 * 重構改善：
 * - ErrorHandler 專注於錯誤邏輯處理
 * - UIManager 負責所有 DOM 操作
 * - 診斷功能模組化為獨立模組
 * - 事件驅動的架構整合
 *
 * 使用情境：
 * - 與 PopupUIManager 整合使用
 * - 支援依賴注入模式
 * - 提供完整的錯誤處理能力
 */

// 錯誤配置函數（需要支援瀏覽器環境）
let getUserErrorMessage, getDiagnosticSuggestion

// 嘗試載入錯誤配置
try {
  if (typeof require !== 'undefined') {
    const errorConfig = require('src/config/error-config')
    getUserErrorMessage = errorConfig.getUserErrorMessage
    getDiagnosticSuggestion = errorConfig.getDiagnosticSuggestion
  }
} catch (error) {
  // eslint-disable-next-line no-console
  Logger.warn('[PopupErrorHandler] Unable to load error config, using fallback')

  // 備用錯誤訊息函數
  getUserErrorMessage = (errorType, defaultMessage) => ({
    title: '系統錯誤',
    message: defaultMessage || '發生未預期的錯誤，請重新載入擴展',
    actions: ['重新載入擴展', '重新整理頁面'],
    severity: 'error'
  })

  getDiagnosticSuggestion = () => null
}

// 嘗試載入診斷模組
let DiagnosticModule
try {
  if (typeof require !== 'undefined') {
    DiagnosticModule = require('./diagnostic-module')
  }
} catch (error) {
  // eslint-disable-next-line no-console
  Logger.warn('[PopupErrorHandler] Unable to load diagnostic module')
}

class PopupErrorHandler {
  /**
   * 建構 PopupErrorHandler
   *
   * @param {Object} dependencies - 依賴注入物件
   * @param {PopupUIManager} dependencies.uiManager - UI 管理器（可選）
   */
  constructor (dependencies = {}) {
    // 支援依賴注入的 UIManager
    this.uiManager = dependencies.uiManager || null

    // 向後相容性：保留原有屬性
    this.elements = {}
    this.diagnosticMode = false
    this.initializationFailed = false

    // 新增重構功能
    this.eventBus = null
    this.diagnosticModule = undefined // 延遲載入
    this.errorQueue = []
    this.errorHistory = []
    this.lastError = null

    // 錯誤恢復策略映射
    this.recoveryStrategies = {
      NETWORK_ERROR: {
        strategies: ['重試請求', '檢查網路連線', '使用快取資料'],
        priority: 'high',
        autoRetry: true,
        maxRetries: 3
      },
      CHROME_API_ERROR: {
        strategies: ['重新載入擴展', '檢查權限設定'],
        priority: 'critical',
        autoRetry: false,
        maxRetries: 1
      },
      SYSTEM_INITIALIZATION_ERROR: {
        strategies: ['重新載入擴展', '清除快取', '檢查擴展版本'],
        priority: 'critical',
        autoRetry: false,
        maxRetries: 1
      }
    }
  }

  /**
   * 初始化錯誤處理器（重構版：支援 UIManager 整合）
   *
   * 負責功能：
   * - 向後相容的初始化流程
   * - 如無 UIManager，則使用原有 DOM 管理
   * - 設定事件監聽和全域錯誤處理
   */
  initialize () {
    if (this.uiManager) {
      // 使用 UIManager 的情況，不需要直接 DOM 操作
      Logger.info('[PopupErrorHandler] Initializing with UIManager integration')
    } else {
      // 向後相容：原有的初始化流程
      this.initializeElements()
      this.setupEventListeners()
    }

    this.setupGlobalErrorHandling()
    Logger.info('[PopupErrorHandler] Error handler initialized')
  }

  /**
   * 初始化DOM元素引用
   */
  initializeElements () {
    // 系統初始載入錯誤元素
    this.elements.initErrorContainer = document.getElementById('initErrorContainer')
    this.elements.initErrorMessage = document.getElementById('initErrorMessage')
    this.elements.forceReloadBtn = document.getElementById('forceReloadBtn')
    this.elements.openExtensionPageBtn = document.getElementById('openExtensionPageBtn')

    // 一般錯誤元素
    this.elements.errorContainer = document.getElementById('errorContainer')
    this.elements.errorMessage = document.getElementById('errorMessage')
    this.elements.retryBtn = document.getElementById('retryBtn')
    this.elements.reloadExtensionBtn = document.getElementById('reloadExtensionBtn')
    this.elements.reportBtn = document.getElementById('reportBtn')

    // 錯誤建議元素
    this.elements.errorSuggestions = document.getElementById('errorSuggestions')
    this.elements.suggestionsList = document.getElementById('suggestionsList')

    // 診斷模式按鈕
    this.elements.diagnosticBtn = document.getElementById('diagnosticBtn')
  }

  /**
   * 設置事件監聽器
   */
  setupEventListeners () {
    // 強制重新載入按鈕
    if (this.elements.forceReloadBtn) {
      this.elements.forceReloadBtn.addEventListener('click', () => {
        this.forceReloadExtension()
      })
    }

    // 開啟擴展管理頁面按鈕
    if (this.elements.openExtensionPageBtn) {
      this.elements.openExtensionPageBtn.addEventListener('click', () => {
        this.openExtensionManagePage()
      })
    }

    // 擴展重新載入按鈕
    if (this.elements.reloadExtensionBtn) {
      this.elements.reloadExtensionBtn.addEventListener('click', () => {
        this.reloadExtension()
      })
    }

    // 問題回報按鈕
    if (this.elements.reportBtn) {
      this.elements.reportBtn.addEventListener('click', () => {
        this.handleErrorReport()
      })
    }

    // 診斷模式按鈕
    if (this.elements.diagnosticBtn) {
      this.elements.diagnosticBtn.addEventListener('click', () => {
        this.toggleDiagnosticMode()
      })
    }
  }

  /**
   * 設置全域錯誤處理
   */
  setupGlobalErrorHandling () {
    // 監聽來自錯誤系統的使用者錯誤通知
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'USER_ERROR_NOTIFICATION') {
          this.handleUserErrors(message.errors)
        }
        return false // 不需要異步回應
      })
    }

    // 監聽初始化錯誤
    window.addEventListener('popup-initialization-error', (event) => {
      this.handleInitializationError(event.detail)
    })
  }

  /**
   * 處理系統初始化錯誤（重構版：使用 UIManager）
   *
   * @param {Error} error - 初始化錯誤物件
   *
   * 負責功能：
   * - 處理系統初始化失敗
   * - 委派 DOM 操作給 UIManager
   * - 提供錯誤恢復建議
   */
  handleInitializationError (error) {
    this.initializationFailed = true

    const userMessage = getUserErrorMessage('SYSTEM_INITIALIZATION_ERROR', error.message)
    const errorData = {
      title: '初始化錯誤',
      message: userMessage.message + (error.message ? `: ${error.message}` : ''),
      actions: ['重新載入擴展', '查看診斷'],
      severity: 'error'
    }

    // 使用 UIManager 或向後相容的 DOM 操作
    if (this.uiManager) {
      this.uiManager.showError(errorData)
    } else {
      // 向後相容的 DOM 操作
      this._legacyShowInitError(errorData)
    }

    // 記錄錯誤
    this.logError('SYSTEM_INITIALIZATION_ERROR', {
      originalError: error,
      timestamp: Date.now()
    })

    // eslint-disable-next-line no-console
    Logger.error('[PopupErrorHandler] Initialization failed:', error)
  }

  /**
   * 向後相容的初始化錯誤顯示
   *
   * @param {Object} errorData - 錯誤資料
   * @private
   */
  _legacyShowInitError (errorData) {
    if (this.elements.initErrorContainer) {
      this.elements.initErrorContainer.style.display = 'block'
    }

    if (this.elements.initErrorMessage) {
      this.elements.initErrorMessage.textContent = errorData.message
    }

    // 隱藏正常的UI元素
    const normalElements = ['extractBtn', 'settingsBtn', 'helpBtn']
    normalElements.forEach(id => {
      const element = document.getElementById(id)
      if (element) {
        element.style.display = 'none'
      }
    })

    // 顯示診斷模式按鈕
    if (this.elements.diagnosticBtn) {
      this.elements.diagnosticBtn.style.display = 'block'
    }
  }

  /**
   * 處理使用者錯誤
   */
  handleUserErrors (errors) {
    if (!errors || errors.length === 0) return

    // 取得最新的未顯示錯誤
    const latestError = errors[errors.length - 1]
    this.showUserFriendlyError(latestError)

    // 標記錯誤為已顯示
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'MARK_ERROR_DISPLAYED',
        errorId: latestError.id
      })
    }
  }

  /**
   * 顯示使用者友善錯誤（重構版：委派給 UIManager）
   *
   * @param {Object} errorInfo - 錯誤資訊物件
   *
   * 負責功能：
   * - 處理錯誤訊息轉換
   * - 委派 DOM 顯示給 UIManager
   * - 向後相容性支援
   */
  showUserFriendlyError (errorInfo) {
    const userMessage = getUserErrorMessage(errorInfo.type, errorInfo.data?.technicalMessage)
    const errorData = {
      title: userMessage.title || '錯誤',
      message: userMessage.message,
      actions: userMessage.actions || [],
      severity: userMessage.severity || 'error'
    }

    // 使用 UIManager 或向後相容的 DOM 操作
    if (this.uiManager) {
      this.uiManager.showError(errorData)
    } else {
      // 向後相容的 DOM 操作
      this._legacyShowError(errorData)
    }
  }

  /**
   * 向後相容的錯誤顯示
   *
   * @param {Object} errorData - 錯誤資料
   * @private
   */
  _legacyShowError (errorData) {
    if (!this.elements.errorContainer || !this.elements.errorMessage) return

    // 顯示錯誤容器
    this.elements.errorContainer.style.display = 'block'

    // 設置錯誤訊息
    this.elements.errorMessage.textContent = errorData.message

    // 顯示建議解決步驟
    if (errorData.actions && errorData.actions.length > 0) {
      this.showErrorSuggestions(errorData.actions)
    }

    // 根據錯誤嚴重程度調整UI
    this.adjustUIForErrorSeverity(errorData.severity)
  }

  /**
   * 顯示錯誤（統一 API，支援 UIManager 整合）
   *
   * @param {Object} errorData - 錯誤資料物件
   *
   * 負責功能：
   * - 提供統一的錯誤顯示接口
   * - 自動選擇顯示方式（UIManager 或傳統方式）
   */
  showError (errorData) {
    if (this.uiManager && typeof this.uiManager.showError === 'function') {
      this.uiManager.showError(errorData)
    } else {
      this._legacyShowError(errorData)
    }
  }

  /**
   * 顯示錯誤建議
   */
  showErrorSuggestions (actions) {
    if (!this.elements.errorSuggestions || !this.elements.suggestionsList) return

    // 清空現有建議
    this.elements.suggestionsList.innerHTML = ''

    // 添加建議項目
    actions.forEach(action => {
      const li = document.createElement('li')
      li.textContent = action
      this.elements.suggestionsList.appendChild(li)
    })

    // 顯示建議容器
    this.elements.errorSuggestions.style.display = 'block'
  }

  /**
   * 根據錯誤嚴重程度調整UI
   */
  adjustUIForErrorSeverity (severity) {
    if (!this.elements.errorContainer) return

    // 移除現有的嚴重程度類別
    this.elements.errorContainer.classList.remove('error-critical', 'error-warning', 'error-info')

    // 添加對應的嚴重程度類別
    switch (severity) {
      case 'critical':
        this.elements.errorContainer.classList.add('error-critical')
        break
      case 'warning':
        this.elements.errorContainer.classList.add('error-warning')
        break
      case 'info':
        this.elements.errorContainer.classList.add('error-info')
        break
    }
  }

  /**
   * 強制重新載入擴展
   */
  forceReloadExtension () {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        // 嘗試使用 chrome.runtime.reload()
        chrome.runtime.reload()
      } catch (error) {
        // eslint-disable-next-line no-console
        Logger.warn('[PopupErrorHandler] chrome.runtime.reload() failed, trying alternative methods')

        // 備用方法：重新載入所有相關分頁
        this.reloadAllExtensionPages()
      }
    }
  }

  /**
   * 重新載入擴展（溫和方式）
   */
  reloadExtension () {
    // 首先嘗試重新初始化
    try {
      // 觸發重新初始化事件
      window.dispatchEvent(new CustomEvent('popup-reinitialize'))

      // 隱藏錯誤界面
      this.hideAllErrors()

      // 延遲後重新初始化
      setTimeout(() => {
        if (window.initialize && typeof window.initialize === 'function') {
          window.initialize()
        }
      }, 500)
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.warn('[PopupErrorHandler] Soft reload failed, trying force reload')
      this.forceReloadExtension()
    }
  }

  /**
   * 重新載入所有擴展頁面
   */
  reloadAllExtensionPages () {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.url && tab.url.startsWith('chrome-extension://')) {
            chrome.tabs.reload(tab.id)
          }
        })
      })
    }

    // 重新載入當前 popup
    try {
      window.location.reload()
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.warn('[PopupErrorHandler] Unable to reload popup window:', error)
      // 在測試環境或某些情況下，reload 可能不可用
    }
  }

  /**
   * 開啟擴展管理頁面
   */
  openExtensionManagePage () {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({
        url: 'chrome://extensions/',
        active: true
      })
    }
  }

  /**
   * 處理錯誤回報
   */
  async handleErrorReport () {
    try {
      // 收集診斷資訊
      const diagnosticData = await this.collectDiagnosticData()

      // 建立錯誤回報URL
      const reportUrl = this.generateErrorReportURL(diagnosticData)

      // 開啟錯誤回報頁面
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({
          url: reportUrl,
          active: true
        })
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.error('[PopupErrorHandler] Failed to generate error report:', error)

      // 備用方案：顯示手動回報指引
      alert(`請手動前往 GitHub Issues 回報問題：
https://github.com/your-repo/readmoo-extractor/issues

請包含以下資訊：
- Chrome 版本：${navigator.userAgent}
- 擴展版本：v0.6.7
- 錯誤時間：${new Date().toLocaleString()}
- 錯誤描述：請詳細描述遇到的問題`)
    }
  }

  /**
   * 收集診斷資料
   */
  async collectDiagnosticData () {
    const diagnosticData = {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      extensionVersion: chrome.runtime.getManifest().version,
      url: window.location.href,
      initializationFailed: this.initializationFailed,
      diagnosticMode: this.diagnosticMode
    }

    // 嘗試從錯誤系統取得診斷報告
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        const response = await chrome.runtime.sendMessage({
          type: 'EXPORT_DIAGNOSTIC_REPORT'
        })

        if (response && response.success) {
          diagnosticData.systemReport = response.report
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.warn('[PopupErrorHandler] Failed to collect system diagnostic report:', error)
    }

    return diagnosticData
  }

  /**
   * 生成錯誤回報URL
   */
  generateErrorReportURL (diagnosticData) {
    const baseURL = 'https://github.com/your-repo/readmoo-extractor/issues/new'
    const title = encodeURIComponent('🐛 Bug Report: Popup Error')

    const body = encodeURIComponent(`
## 問題描述
請詳細描述遇到的問題：

## 環境資訊
- **Chrome 版本**: ${diagnosticData.userAgent}
- **擴展版本**: ${diagnosticData.extensionVersion}
- **發生時間**: ${new Date(diagnosticData.timestamp).toLocaleString()}
- **初始化失敗**: ${diagnosticData.initializationFailed ? '是' : '否'}

## 診斷資料
\`\`\`json
${JSON.stringify(diagnosticData, null, 2)}
\`\`\`

## 重現步驟
1. 
2. 
3. 

## 預期行為
請描述您預期應該發生什麼：

## 實際行為
請描述實際發生了什麼：
    `)

    return `${baseURL}?title=${title}&body=${body}`
  }

  /**
   * 切換診斷模式
   */
  toggleDiagnosticMode () {
    this.diagnosticMode = !this.diagnosticMode

    // 更新按鈕文字
    if (this.elements.diagnosticBtn) {
      this.elements.diagnosticBtn.textContent = this.diagnosticMode
        ? '🔧 停用診斷'
        : '🔧 診斷模式'
    }

    // 通知錯誤系統
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: this.diagnosticMode ? 'ENABLE_DIAGNOSTIC_MODE' : 'DISABLE_DIAGNOSTIC_MODE'
      })
    }

    Logger.info(`[PopupErrorHandler] Diagnostic mode ${this.diagnosticMode ? 'enabled' : 'disabled'}`)
  }

  /**
   * 啟用診斷模式（重構版：模組化診斷功能）
   *
   * 負責功能：
   * - 延遲載入診斷模組
   * - 啟用深度診斷功能
   * - 整合 UIManager 顯示
   */
  enableDiagnosticMode () {
    if (!this.diagnosticModule && DiagnosticModule) {
      this.diagnosticModule = new DiagnosticModule()
      this.diagnosticModule.initialize()
    }

    this.diagnosticMode = true

    Logger.info('[PopupErrorHandler] Diagnostic mode enabled with module integration')
  }

  // ===== 新增重構功能 =====

  /**
   * 設定事件總線（事件驅動架構整合）
   *
   * @param {Object} eventBus - 事件總線物件
   */
  setEventBus (eventBus) {
    this.eventBus = eventBus
    Logger.info('[PopupErrorHandler] Event bus integrated')
  }

  /**
   * 報告錯誤（事件驅動）
   *
   * @param {string} errorType - 錯誤類型
   * @param {string} message - 錯誤訊息
   * @param {Object} context - 錯誤上下文
   */
  reportError (errorType, message, context = {}) {
    const errorEvent = {
      type: errorType,
      message,
      timestamp: Date.now(),
      context
    }

    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit('ERROR.SYSTEM.REPORTED', errorEvent)
    }

    // 記錄到錯誤歷史
    this.logError(errorType, { message, context, timestamp: errorEvent.timestamp })
  }

  /**
   * 處理 Chrome API 錯誤
   *
   * @param {string} apiName - API 名稱
   * @returns {Promise} 處理結果
   */
  async handleChromeAPIError (apiName) {
    try {
      // 嘗試執行 Chrome API 調用（這裡模擬）
      if (apiName === 'sendMessage') {
        await chrome.runtime.sendMessage({ type: 'TEST_MESSAGE' })
      }

      return { success: true }
    } catch (error) {
      const apiError = {
        type: 'CHROME_API_ERROR',
        api: apiName,
        message: error.message,
        timestamp: Date.now()
      }

      this.lastError = apiError
      this.logError('CHROME_API_ERROR', apiError)

      return { success: false, error: apiError }
    }
  }

  /**
   * 取得錯誤恢復策略
   *
   * @param {Object} error - 錯誤物件
   * @returns {Object} 恢復策略
   */
  getRecoveryStrategy (error) {
    const errorType = error.type || 'UNKNOWN_ERROR'
    return this.recoveryStrategies[errorType] || {
      strategies: ['聯絡技術支援'],
      priority: 'low',
      autoRetry: false,
      maxRetries: 0
    }
  }

  /**
   * 處理錯誤（重構版：統一錯誤處理入口）
   *
   * @param {Object} error - 錯誤物件
   */
  handleError (error) {
    // 錯誤節流處理
    this._throttleError(error)

    // 根據錯誤類型選擇處理策略
    const strategy = this.getRecoveryStrategy(error)

    // 顯示錯誤
    this.showError({
      title: this._getErrorTitle(error.type),
      message: error.message,
      actions: strategy.strategies,
      severity: this._mapPriorityToSeverity(strategy.priority)
    })

    // 記錄錯誤
    this.logError(error.type, error)
  }

  /**
   * 錯誤節流處理
   *
   * @param {Object} error - 錯誤物件
   * @private
   */
  _throttleError (error) {
    const errorKey = `${error.type}_${error.message}`

    // 查找現有錯誤
    const existingError = this.errorQueue.find(e =>
      `${e.type}_${e.message}` === errorKey
    )

    if (existingError) {
      existingError.count = (existingError.count || 1) + 1
    } else {
      this.errorQueue.push({
        ...error,
        count: 1
      })
    }
  }

  /**
   * 記錄錯誤到歷史中
   *
   * @param {string} errorType - 錯誤類型
   * @param {Object} errorData - 錯誤資料
   */
  logError (errorType, errorData) {
    const errorRecord = {
      type: errorType,
      ...errorData,
      timestamp: errorData.timestamp || Date.now()
    }

    this.errorHistory.push(errorRecord)

    // 限制錯誤歷史記錄數量（記憶體優化）
    if (this.errorHistory.length > 100) {
      this.errorHistory = this.errorHistory.slice(-100) // 保持最新的100條
    }

    // 如果有診斷模組，同步記錄
    if (this.diagnosticModule && typeof this.diagnosticModule.logError === 'function') {
      this.diagnosticModule.logError(errorRecord)
    }
  }

  /**
   * 取得錯誤標題
   *
   * @param {string} errorType - 錯誤類型
   * @returns {string} 錯誤標題
   * @private
   */
  _getErrorTitle (errorType) {
    const titles = {
      NETWORK_ERROR: '網路連線錯誤',
      CHROME_API_ERROR: 'Chrome 擴展錯誤',
      SYSTEM_INITIALIZATION_ERROR: '系統初始化錯誤',
      EXTRACTION_ERROR: '資料提取錯誤'
    }

    return titles[errorType] || '系統錯誤'
  }

  /**
   * 將優先級映射為嚴重程度
   *
   * @param {string} priority - 優先級
   * @returns {string} 嚴重程度
   * @private
   */
  _mapPriorityToSeverity (priority) {
    const mapping = {
      critical: 'critical',
      high: 'error',
      medium: 'warning',
      low: 'info'
    }

    return mapping[priority] || 'error'
  }

  /**
   * 隱藏所有錯誤界面
   */
  hideAllErrors () {
    const errorContainers = [
      this.elements.initErrorContainer,
      this.elements.errorContainer,
      this.elements.errorSuggestions
    ]

    errorContainers.forEach(container => {
      if (container) {
        container.style.display = 'none'
      }
    })
  }

  /**
   * 檢查是否有系統初始化錯誤
   */
  hasInitializationError () {
    return this.initializationFailed
  }

  /**
   * 重置錯誤狀態（重構版：整合 UIManager）
   */
  resetErrorState () {
    this.initializationFailed = false

    if (this.uiManager && typeof this.uiManager.reset === 'function') {
      this.uiManager.reset()
    } else {
      this.hideAllErrors()

      // 顯示正常UI元素
      const normalElements = ['extractBtn', 'settingsBtn', 'helpBtn']
      normalElements.forEach(id => {
        const element = document.getElementById(id)
        if (element) {
          element.style.display = ''
        }
      })

      // 隱藏診斷模式按鈕
      if (this.elements.diagnosticBtn) {
        this.elements.diagnosticBtn.style.display = 'none'
      }
    }

    // 清理錯誤資料
    this.errorQueue = []
    this.lastError = null
  }

  /**
   * 清理錯誤處理器（重構版：完整清理）
   */
  cleanup () {
    // 清理診斷模組
    if (this.diagnosticModule && typeof this.diagnosticModule.cleanup === 'function') {
      this.diagnosticModule.cleanup()
    }

    // 清理錯誤資料
    this.errorQueue = []
    this.errorHistory = []
    this.lastError = null

    // 重置狀態
    this.diagnosticMode = false
    this.initializationFailed = false
    this.eventBus = null

    // 如果有 UIManager，也進行清理
    if (this.uiManager && typeof this.uiManager.cleanup === 'function') {
      this.uiManager.cleanup()
    }

    Logger.info('[PopupErrorHandler] Cleanup completed')
  }
}

// 導出錯誤處理器
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PopupErrorHandler
} else {
  window.PopupErrorHandler = PopupErrorHandler
}
