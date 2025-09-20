/**
 * Popup 事件控制器
 * 基於 EventHandler 實現 Popup 與事件系統的整合
 *
 * 負責功能：
 * - 管理 Popup 與 Background Script 的通訊
 * - 處理事件驅動的狀態更新
 * - 整合 UI 事件與系統事件
 * - 提供統一的事件處理介面
 *
 * 設計考量：
 * - 繼承 EventHandler 提供標準化的事件處理流程
 * - 支援多種 Chrome Extension API 通訊
 * - 實現完整的錯誤處理和恢復機制
 * - 提供靈活的 DOM 元素管理
 *
 * 處理流程：
 * 1. 初始化 DOM 元素引用和事件監聽器
 * 2. 建立與 Background Script 的通訊連接
 * 3. 處理各種 UI 事件和系統事件
 * 4. 更新 Popup 界面狀態和顯示
 * 5. 管理提取流程的完整生命週期
 *
 * 使用情境：
 * - Chrome Extension Popup 的主要控制器
 * - 事件驅動的 UI 狀態管理
 * - Background Script 與 Content Script 的通訊橋梁
 */

const EventHandler = require('src/core/event-handler')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')
const { Logger } = require('src/core/logging/Logger')

class PopupEventController extends EventHandler {
  /**
   * 建構 Popup 事件控制器
   *
   * @param {Object} eventBus - 事件總線實例
   * @param {Object} document - DOM 文檔物件
   * @param {Object} chrome - Chrome Extension API 物件
   *
   * 負責功能：
   * - 初始化事件處理器基本配置
   * - 設定 DOM 文檔和 Chrome API 引用
   * - 配置處理器優先級 (Popup 控制需要較高優先級)
   * - 初始化 UI 狀態和通訊管理
   */
  constructor (eventBus, document, chrome) {
    super('PopupEventController', 1) // Popup 控制優先級設為1 (較高)

    this.eventBus = eventBus
    this.document = document
    this.chrome = chrome

    // UI 狀態管理
    this.currentStatus = null
    this.extractionInProgress = false
    this.lastTabInfo = null

    // 通訊狀態
    this.backgroundConnected = false
    this.contentScriptReady = false

    // 統計資訊
    this.messageCount = 0
    this.errorCount = 0
    this.lastError = null

    // 狀態類型常數
    this.STATUS_TYPES = {
      LOADING: 'loading',
      READY: 'ready',
      ERROR: 'error'
    }

    // 訊息類型常數
    this.MESSAGE_TYPES = {
      PING: 'PING',
      GET_STATUS: 'GET_STATUS',
      START_EXTRACTION: 'START_EXTRACTION'
    }

    // DOM 元素引用
    this.elements = null

    // 初始化
    this.initialize()
  }

  /**
   * 取得支援的事件類型
   *
   * @returns {Array<string>} 支援的事件類型列表
   *
   * 負責功能：
   * - 定義此處理器能處理的事件類型
   * - 用於事件總線的處理器註冊和路由
   */
  getSupportedEvents () {
    return [
      'UI.PROGRESS.UPDATE',
      'UI.NOTIFICATION.SHOW',
      'EXTRACTION.PROGRESS',
      'EXTRACTION.COMPLETED',
      'EXTRACTION.ERROR',
      'POPUP.STATUS.UPDATE'
    ]
  }

  /**
   * 處理事件的核心邏輯
   *
   * @param {Object} event - 事件物件
   * @returns {Promise<Object>} 處理結果
   *
   * 負責功能：
   * - 根據事件類型分發到對應的處理方法
   * - 統一的事件處理流程
   * - 錯誤處理和狀態更新
   */
  async process (event) {
    const { type, data, flowId } = event

    try {
      let result

      switch (type) {
        case 'UI.PROGRESS.UPDATE':
          result = await this.handleProgressUpdate(data, flowId)
          break
        case 'UI.NOTIFICATION.SHOW':
          result = await this.handleNotificationShow(data, flowId)
          break
        case 'EXTRACTION.PROGRESS':
          result = await this.handleExtractionProgress(data, flowId)
          break
        case 'EXTRACTION.COMPLETED':
          result = await this.handleExtractionCompleted(data, flowId)
          break
        case 'EXTRACTION.ERROR':
          result = await this.handleExtractionError(data, flowId)
          break
        case 'POPUP.STATUS.UPDATE':
          result = await this.handleStatusUpdate(data, flowId)
          break
        default: {
          const error = new Error(`Unsupported event type: ${type}`)
          error.code = ErrorCodes.UNKNOWN_ERROR
          error.details = { category: 'general', type }
          throw error
        }
      }

      this.messageCount++
      return result
    } catch (error) {
      this.errorCount++
      this.lastError = { type, error: error.message, timestamp: Date.now() }
      throw error
    }
  }

  /**
   * 初始化控制器
   *
   * 負責功能：
   * - 初始化 DOM 元素引用
   * - 設定事件監聽器
   * - 檢查初始狀態
   */
  async initialize () {
    try {
      // 初始化 DOM 元素引用
      this.initializeElements()

      // 設定事件監聽器
      this.setupEventListeners()

      // 檢查初始狀態
      await this.checkInitialStatus()
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.error('[PopupEventController] Initialization failed:', error)
      this.handleInitializationError(error)
    }
  }

  /**
   * 初始化 DOM 元素引用
   *
   * 負責功能：
   * - 收集所有必要的 DOM 元素引用
   * - 驗證元素的存在性
   */
  initializeElements () {
    if (!this.document) {
      const error = new Error('Document not available')
      error.code = ErrorCodes.DOM_ERROR
      error.details = { category: 'general' }
      throw error
    }

    this.elements = {
      // 狀態顯示元素
      statusDot: this.document.getElementById('statusDot'),
      statusText: this.document.getElementById('statusText'),
      statusInfo: this.document.getElementById('statusInfo'),
      extensionStatus: this.document.getElementById('extensionStatus'),

      // 控制按鈕
      extractBtn: this.document.getElementById('extractBtn'),
      settingsBtn: this.document.getElementById('settingsBtn'),
      helpBtn: this.document.getElementById('helpBtn'),

      // 頁面資訊
      pageInfo: this.document.getElementById('pageInfo'),
      bookCount: this.document.getElementById('bookCount'),

      // 進度顯示元素
      progressContainer: this.document.getElementById('progressContainer'),
      progressBar: this.document.getElementById('progressBar'),
      progressText: this.document.getElementById('progressText'),
      progressPercentage: this.document.getElementById('progressPercentage'),

      // 結果展示元素
      resultsContainer: this.document.getElementById('resultsContainer'),
      extractedBookCount: this.document.getElementById('extractedBookCount'),
      extractionTime: this.document.getElementById('extractionTime'),
      successRate: this.document.getElementById('successRate'),
      exportBtn: this.document.getElementById('exportBtn'),
      viewResultsBtn: this.document.getElementById('viewResultsBtn'),

      // 錯誤訊息元素
      errorContainer: this.document.getElementById('errorContainer'),
      errorMessage: this.document.getElementById('errorMessage'),
      retryBtn: this.document.getElementById('retryBtn'),
      reportBtn: this.document.getElementById('reportBtn')
    }

    // 驗證關鍵元素
    const requiredElements = ['statusDot', 'statusText', 'extractBtn']
    for (const elementName of requiredElements) {
      if (!this.elements[elementName]) {
        const error = new Error(`Required element not found: ${elementName}`)
        error.code = ErrorCodes.DOM_ERROR
        error.details = { category: 'ui', elementName }
        throw error
      }
    }
  }

  /**
   * 設定事件監聽器
   *
   * 負責功能：
   * - 為所有互動元素設定事件監聽器
   * - 綁定處理方法到對應的事件
   */
  setupEventListeners () {
    if (this.elements.extractBtn) {
      this.elements.extractBtn.addEventListener('click', () => this.handleExtractClick())
    }

    if (this.elements.settingsBtn) {
      this.elements.settingsBtn.addEventListener('click', () => this.handleSettingsClick())
    }

    if (this.elements.helpBtn) {
      this.elements.helpBtn.addEventListener('click', () => this.handleHelpClick())
    }

    if (this.elements.retryBtn) {
      this.elements.retryBtn.addEventListener('click', () => this.handleRetryClick())
    }

    if (this.elements.exportBtn) {
      this.elements.exportBtn.addEventListener('click', () => this.handleExportClick())
    }
  }

  /**
   * 檢查初始狀態
   *
   * 負責功能：
   * - 檢查 Background Service Worker 狀態
   * - 檢查當前標籤頁狀態
   * - 更新 UI 初始狀態
   */
  async checkInitialStatus () {
    // 檢查 Background Service Worker
    this.backgroundConnected = await this.checkBackgroundStatus()

    if (this.backgroundConnected) {
      // 檢查當前標籤頁
      await this.checkCurrentTab()
    }
  }

  /**
   * 檢查 Background Service Worker 狀態
   *
   * @returns {Promise<boolean>} 是否連接成功
   *
   * 負責功能：
   * - 向 Background Script 發送狀態檢查訊息
   * - 處理通訊結果和錯誤
   */
  async checkBackgroundStatus () {
    try {
      if (!this.chrome || !this.chrome.runtime) {
        const error = new Error('Chrome runtime not available')
        error.code = ErrorCodes.CHROME_ERROR
        error.details = { category: 'general' }
        throw error
      }

      const response = await this.chrome.runtime.sendMessage({
        type: this.MESSAGE_TYPES.GET_STATUS
      })

      if (response && response.success) {
        this.updateStatus('線上', 'Background Service Worker 連線正常', '系統就緒', this.STATUS_TYPES.READY)
        return true
      } else {
        const error = new Error('Background Service Worker 回應異常')
        error.code = ErrorCodes.CHROME_ERROR
        error.details = { category: 'general' }
        throw error
      }
    } catch (error) {
      this.updateStatus('離線', 'Service Worker 離線', '請重新載入擴展', this.STATUS_TYPES.ERROR)
      return false
    }
  }

  /**
   * 檢查當前標籤頁狀態
   *
   * @returns {Promise<Object|null>} 標籤頁物件或 null
   *
   * 負責功能：
   * - 查詢當前活動標籤頁
   * - 檢查是否為 Readmoo 頁面
   * - 測試 Content Script 連接狀態
   */
  async checkCurrentTab () {
    try {
      if (!this.chrome || !this.chrome.tabs) {
        const error = new Error('Chrome tabs API not available')
        error.code = ErrorCodes.CHROME_ERROR
        error.details = { category: 'general' }
        throw error
      }

      const [tab] = await this.chrome.tabs.query({ active: true, currentWindow: true })

      if (!tab) {
        this.updateStatus('無效', '無法取得標籤頁資訊', '請重新整理頁面後再試', this.STATUS_TYPES.ERROR)
        return null
      }

      this.lastTabInfo = tab

      // 檢查是否為 Readmoo 頁面
      const isReadmoo = tab.url && tab.url.includes('readmoo.com')

      if (this.elements.pageInfo) {
        this.elements.pageInfo.textContent = isReadmoo
          ? `Readmoo (${new URL(tab.url).pathname})`
          : '非 Readmoo 頁面'
      }

      if (isReadmoo) {
        // 測試 Content Script 連接
        try {
          const response = await this.chrome.tabs.sendMessage(tab.id, {
            type: this.MESSAGE_TYPES.PING
          })

          if (response && response.success) {
            this.contentScriptReady = true
            this.updateStatus('就緒', 'Content Script 連線正常', '可以開始提取書庫資料', this.STATUS_TYPES.READY)
            this.updateButtonState(false)
            return tab
          }
        } catch (error) {
          this.contentScriptReady = false
          this.updateStatus('載入中', 'Content Script 載入中', '請稍候或重新整理頁面', this.STATUS_TYPES.LOADING)
        }
      } else {
        this.updateStatus('待機', '請前往 Readmoo 網站', '需要在 Readmoo 書庫頁面使用此功能', this.STATUS_TYPES.READY)
        this.updateButtonState(true)
      }

      return tab
    } catch (error) {
      this.updateStatus('錯誤', '無法檢查頁面狀態', error.message, this.STATUS_TYPES.ERROR)
      return null
    }
  }

  /**
   * 處理進度更新事件
   *
   * @param {Object} data - 進度資料
   * @param {string} flowId - 流程ID
   * @returns {Promise<Object>} 處理結果
   */
  async handleProgressUpdate (data, flowId) {
    this.updateProgress(data.percentage, data.message)
    return { success: true, flowId }
  }

  /**
   * 處理通知顯示事件
   *
   * @param {Object} data - 通知資料
   * @param {string} flowId - 流程ID
   * @returns {Promise<Object>} 處理結果
   */
  async handleNotificationShow (data, flowId) {
    // TODO: 實現通知顯示邏輯
    Logger.info(`[PopupEventController] Notification: ${data.message}`)
    return { success: true, flowId }
  }

  /**
   * 處理提取進度事件
   *
   * @param {Object} data - 進度資料
   * @param {string} flowId - 流程ID
   * @returns {Promise<Object>} 處理結果
   */
  async handleExtractionProgress (data, flowId) {
    this.extractionInProgress = true
    this.updateProgress(data.percentage, data.message)
    this.updateStatus('提取中', '正在提取書庫資料', '請保持頁面開啟', this.STATUS_TYPES.LOADING)
    return { success: true, flowId }
  }

  /**
   * 處理提取完成事件
   *
   * @param {Object} data - 完成資料
   * @param {string} flowId - 流程ID
   * @returns {Promise<Object>} 處理結果
   */
  async handleExtractionCompleted (data, flowId) {
    this.extractionInProgress = false
    this.hideProgress()

    const results = {
      bookCount: data.books ? data.books.length : 0,
      extractionTime: data.extractionTime || '-',
      successRate: data.successRate || 100
    }

    this.displayExtractionResults(results)
    this.updateStatus('完成', '資料提取完成', `成功提取 ${results.bookCount} 本書籍`, this.STATUS_TYPES.READY)

    return { success: true, flowId, results }
  }

  /**
   * 處理提取錯誤事件
   *
   * @param {Object} data - 錯誤資料
   * @param {string} flowId - 流程ID
   * @returns {Promise<Object>} 處理結果
   */
  async handleExtractionError (data, flowId) {
    this.extractionInProgress = false
    this.handleExtractionErrorUI(data.message || '提取過程中發生錯誤', data.error)
    return { success: true, flowId }
  }

  /**
   * 處理狀態更新事件
   *
   * @param {Object} data - 狀態資料
   * @param {string} flowId - 流程ID
   * @returns {Promise<Object>} 處理結果
   */
  async handleStatusUpdate (data, flowId) {
    this.updateStatus(data.status, data.text, data.info, data.type)
    return { success: true, flowId }
  }

  /**
   * 處理提取按鈕點擊
   */
  async handleExtractClick () {
    if (this.extractionInProgress) return

    try {
      await this.startExtraction()
    } catch (error) {
      this.handleExtractionErrorUI('啟動提取失敗', error)
    }
  }

  /**
   * 處理設定按鈕點擊
   */
  handleSettingsClick () {
    // TODO: 實現設定功能
    if (this.chrome && this.chrome.tabs) {
      this.chrome.tabs.create({ url: 'chrome://extensions/?id=' + this.chrome.runtime.id })
    }
  }

  /**
   * 處理說明按鈕點擊
   */
  handleHelpClick () {
    // TODO: 實現說明功能
    const helpText = '使用說明：\n\n1. 前往 Readmoo 書庫頁面\n2. 點擊「開始提取書庫資料」\n3. 等待提取完成'
    alert(helpText)
  }

  /**
   * 處理重試按鈕點擊
   */
  async handleRetryClick () {
    this.hideError()
    await this.handleExtractClick()
  }

  /**
   * 處理匯出按鈕點擊
   */
  handleExportClick () {
    // TODO: 實現匯出功能
    Logger.info('[PopupEventController] Export functionality not implemented yet')
  }

  /**
   * 開始資料提取
   */
  async startExtraction () {
    const tab = await this.checkCurrentTab()
    if (!tab || !this.contentScriptReady) {
      const error = new Error('頁面或 Content Script 未就緒')
      error.code = ErrorCodes.CHROME_ERROR
      error.details = { category: 'general' }
      throw error
    }

    this.extractionInProgress = true
    this.updateButtonState(true, '提取中...')
    this.updateStatus('提取中', '正在啟動提取流程', '請保持頁面開啟', this.STATUS_TYPES.LOADING)

    try {
      const response = await this.chrome.tabs.sendMessage(tab.id, {
        type: this.MESSAGE_TYPES.START_EXTRACTION
      })

      if (response && response.success) {
        // 提取成功，等待後續事件
        Logger.info('[PopupEventController] Extraction started successfully')
      } else {
        const error = new Error(response?.error || '未知錯誤')
        error.code = ErrorCodes.OPERATION_ERROR
        error.details = { category: 'general', response }
        throw error
      }
    } catch (error) {
      this.extractionInProgress = false
      this.updateButtonState(false, '🚀 開始提取書庫資料')
      throw error
    }
  }

  /**
   * 更新狀態顯示
   *
   * @param {string} status - 擴展狀態文字
   * @param {string} text - 主要狀態文字
   * @param {string} info - 詳細資訊文字
   * @param {string} type - 狀態類型
   */
  updateStatus (status, text, info, type = this.STATUS_TYPES.LOADING) {
    if (this.elements.statusDot) {
      this.elements.statusDot.className = `status-dot ${type}`
    }

    if (this.elements.statusText) {
      this.elements.statusText.textContent = text
    }

    if (this.elements.statusInfo) {
      this.elements.statusInfo.textContent = info
    }

    if (this.elements.extensionStatus) {
      this.elements.extensionStatus.textContent = status
    }

    this.currentStatus = { status, text, info, type }
  }

  /**
   * 更新按鈕狀態
   *
   * @param {boolean} disabled - 是否禁用
   * @param {string} text - 按鈕文字
   */
  updateButtonState (disabled, text) {
    if (this.elements.extractBtn) {
      this.elements.extractBtn.disabled = disabled
      if (text) {
        this.elements.extractBtn.textContent = text
      }
    }
  }

  /**
   * 更新進度顯示
   *
   * @param {number} percentage - 進度百分比
   * @param {string} text - 進度文字
   */
  updateProgress (percentage, text) {
    if (!this.elements.progressContainer) return

    this.elements.progressContainer.style.display = 'block'

    const clampedPercentage = Math.min(100, Math.max(0, percentage))

    const progressFill = this.elements.progressBar?.querySelector('.progress-fill')
    if (progressFill) {
      progressFill.style.width = `${clampedPercentage}%`
    }

    if (this.elements.progressPercentage) {
      this.elements.progressPercentage.textContent = `${Math.round(clampedPercentage)}%`
    }

    if (this.elements.progressText && text) {
      this.elements.progressText.textContent = text
    }
  }

  /**
   * 隱藏進度顯示
   */
  hideProgress () {
    if (this.elements.progressContainer) {
      this.elements.progressContainer.style.display = 'none'
    }
  }

  /**
   * 顯示提取結果
   *
   * @param {Object} results - 結果資料
   */
  displayExtractionResults (results) {
    if (!this.elements.resultsContainer) return

    this.elements.resultsContainer.style.display = 'block'

    if (this.elements.extractedBookCount) {
      this.elements.extractedBookCount.textContent = results.bookCount || 0
    }

    if (this.elements.extractionTime) {
      this.elements.extractionTime.textContent = results.extractionTime || '-'
    }

    if (this.elements.successRate) {
      this.elements.successRate.textContent = results.successRate ? `${results.successRate}%` : '-'
    }

    if (this.elements.exportBtn) {
      this.elements.exportBtn.disabled = false
    }

    if (this.elements.viewResultsBtn) {
      this.elements.viewResultsBtn.disabled = false
    }
  }

  /**
   * 處理提取錯誤 UI
   *
   * @param {string} message - 錯誤訊息
   * @param {Error} error - 錯誤物件
   */
  handleExtractionErrorUI (message, error) {
    if (this.elements.errorContainer) {
      this.elements.errorContainer.style.display = 'block'
    }

    if (this.elements.errorMessage) {
      this.elements.errorMessage.textContent = message || '發生未知錯誤'
    }

    this.hideProgress()
    this.updateButtonState(false, '🚀 開始提取書庫資料')
    this.updateStatus('失敗', '提取失敗', message, this.STATUS_TYPES.ERROR)

    if (error) {
      // eslint-disable-next-line no-console
      Logger.error('[PopupEventController] Extraction error:', error)
    }
  }

  /**
   * 隱藏錯誤顯示
   */
  hideError () {
    if (this.elements.errorContainer) {
      this.elements.errorContainer.style.display = 'none'
    }
  }

  /**
   * 處理初始化錯誤
   *
   * @param {Error} error - 錯誤物件
   */
  handleInitializationError (error) {
    this.updateStatus('錯誤', '初始化失敗', error.message, this.STATUS_TYPES.ERROR)
  }

  /**
   * 取得處理器的統計資訊
   *
   * @returns {Object} 統計資訊物件
   */
  getStats () {
    const baseStats = super.getStats()

    return {
      ...baseStats,
      messageCount: this.messageCount,
      errorCount: this.errorCount,
      backgroundConnected: this.backgroundConnected,
      contentScriptReady: this.contentScriptReady,
      extractionInProgress: this.extractionInProgress,
      currentStatus: this.currentStatus,
      lastTabInfo: this.lastTabInfo,
      lastError: this.lastError
    }
  }
}

module.exports = PopupEventController
