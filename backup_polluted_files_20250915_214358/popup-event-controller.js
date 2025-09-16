/**
const Logger = require("src/core/logging/Logger")
 * Popup 事件控制器
const Logger = require("src/core/logging/Logger")
 * 基於 EventHandler 實現 Popup 與事件系統的整合
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 負責功能：
const Logger = require("src/core/logging/Logger")
 * - 管理 Popup 與 Background Script 的通訊
const Logger = require("src/core/logging/Logger")
 * - 處理事件驅動的狀態更新
const Logger = require("src/core/logging/Logger")
 * - 整合 UI 事件與系統事件
const Logger = require("src/core/logging/Logger")
 * - 提供統一的事件處理介面
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 設計考量：
const Logger = require("src/core/logging/Logger")
 * - 繼承 EventHandler 提供標準化的事件處理流程
const Logger = require("src/core/logging/Logger")
 * - 支援多種 Chrome Extension API 通訊
const Logger = require("src/core/logging/Logger")
 * - 實現完整的錯誤處理和恢復機制
const Logger = require("src/core/logging/Logger")
 * - 提供靈活的 DOM 元素管理
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 處理流程：
const Logger = require("src/core/logging/Logger")
 * 1. 初始化 DOM 元素引用和事件監聽器
const Logger = require("src/core/logging/Logger")
 * 2. 建立與 Background Script 的通訊連接
const Logger = require("src/core/logging/Logger")
 * 3. 處理各種 UI 事件和系統事件
const Logger = require("src/core/logging/Logger")
 * 4. 更新 Popup 界面狀態和顯示
const Logger = require("src/core/logging/Logger")
 * 5. 管理提取流程的完整生命週期
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 使用情境：
const Logger = require("src/core/logging/Logger")
 * - Chrome Extension Popup 的主要控制器
const Logger = require("src/core/logging/Logger")
 * - 事件驅動的 UI 狀態管理
const Logger = require("src/core/logging/Logger")
 * - Background Script 與 Content Script 的通訊橋梁
const Logger = require("src/core/logging/Logger")
 */

const Logger = require("src/core/logging/Logger")
const EventHandler = require('src/core/event-handler')
const Logger = require("src/core/logging/Logger")
const { StandardError } = require('src/core/errors/StandardError')

const Logger = require("src/core/logging/Logger")
class PopupEventController extends EventHandler {
const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 建構 Popup 事件控制器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} eventBus - 事件總線實例
const Logger = require("src/core/logging/Logger")
   * @param {Object} document - DOM 文檔物件
const Logger = require("src/core/logging/Logger")
   * @param {Object} chrome - Chrome Extension API 物件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * 負責功能：
const Logger = require("src/core/logging/Logger")
   * - 初始化事件處理器基本配置
const Logger = require("src/core/logging/Logger")
   * - 設定 DOM 文檔和 Chrome API 引用
const Logger = require("src/core/logging/Logger")
   * - 配置處理器優先級 (Popup 控制需要較高優先級)
const Logger = require("src/core/logging/Logger")
   * - 初始化 UI 狀態和通訊管理
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  constructor (eventBus, document, chrome) {
const Logger = require("src/core/logging/Logger")
    super('PopupEventController', 1) // Popup 控制優先級設為1 (較高)

const Logger = require("src/core/logging/Logger")
    this.eventBus = eventBus
const Logger = require("src/core/logging/Logger")
    this.document = document
const Logger = require("src/core/logging/Logger")
    this.chrome = chrome

const Logger = require("src/core/logging/Logger")
    // UI 狀態管理
const Logger = require("src/core/logging/Logger")
    this.currentStatus = null
const Logger = require("src/core/logging/Logger")
    this.extractionInProgress = false
const Logger = require("src/core/logging/Logger")
    this.lastTabInfo = null

const Logger = require("src/core/logging/Logger")
    // 通訊狀態
const Logger = require("src/core/logging/Logger")
    this.backgroundConnected = false
const Logger = require("src/core/logging/Logger")
    this.contentScriptReady = false

const Logger = require("src/core/logging/Logger")
    // 統計資訊
const Logger = require("src/core/logging/Logger")
    this.messageCount = 0
const Logger = require("src/core/logging/Logger")
    this.errorCount = 0
const Logger = require("src/core/logging/Logger")
    this.lastError = null

const Logger = require("src/core/logging/Logger")
    // 狀態類型常數
const Logger = require("src/core/logging/Logger")
    this.STATUS_TYPES = {
const Logger = require("src/core/logging/Logger")
      LOADING: 'loading',
const Logger = require("src/core/logging/Logger")
      READY: 'ready',
const Logger = require("src/core/logging/Logger")
      ERROR: 'error'
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 訊息類型常數
const Logger = require("src/core/logging/Logger")
    this.MESSAGE_TYPES = {
const Logger = require("src/core/logging/Logger")
      PING: 'PING',
const Logger = require("src/core/logging/Logger")
      GET_STATUS: 'GET_STATUS',
const Logger = require("src/core/logging/Logger")
      START_EXTRACTION: 'START_EXTRACTION'
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // DOM 元素引用
const Logger = require("src/core/logging/Logger")
    this.elements = null

const Logger = require("src/core/logging/Logger")
    // 初始化
const Logger = require("src/core/logging/Logger")
    this.initialize()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 取得支援的事件類型
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {Array<string>} 支援的事件類型列表
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * 負責功能：
const Logger = require("src/core/logging/Logger")
   * - 定義此處理器能處理的事件類型
const Logger = require("src/core/logging/Logger")
   * - 用於事件總線的處理器註冊和路由
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  getSupportedEvents () {
const Logger = require("src/core/logging/Logger")
    return [
const Logger = require("src/core/logging/Logger")
      'UI.PROGRESS.UPDATE',
const Logger = require("src/core/logging/Logger")
      'UI.NOTIFICATION.SHOW',
const Logger = require("src/core/logging/Logger")
      'EXTRACTION.PROGRESS',
const Logger = require("src/core/logging/Logger")
      'EXTRACTION.COMPLETED',
const Logger = require("src/core/logging/Logger")
      'EXTRACTION.ERROR',
const Logger = require("src/core/logging/Logger")
      'POPUP.STATUS.UPDATE'
const Logger = require("src/core/logging/Logger")
    ]
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理事件的核心邏輯
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} event - 事件物件
const Logger = require("src/core/logging/Logger")
   * @returns {Promise<Object>} 處理結果
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * 負責功能：
const Logger = require("src/core/logging/Logger")
   * - 根據事件類型分發到對應的處理方法
const Logger = require("src/core/logging/Logger")
   * - 統一的事件處理流程
const Logger = require("src/core/logging/Logger")
   * - 錯誤處理和狀態更新
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async process (event) {
const Logger = require("src/core/logging/Logger")
    const { type, data, flowId } = event

const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      let result

const Logger = require("src/core/logging/Logger")
      switch (type) {
const Logger = require("src/core/logging/Logger")
        case 'UI.PROGRESS.UPDATE':
const Logger = require("src/core/logging/Logger")
          result = await this.handleProgressUpdate(data, flowId)
const Logger = require("src/core/logging/Logger")
          break
const Logger = require("src/core/logging/Logger")
        case 'UI.NOTIFICATION.SHOW':
const Logger = require("src/core/logging/Logger")
          result = await this.handleNotificationShow(data, flowId)
const Logger = require("src/core/logging/Logger")
          break
const Logger = require("src/core/logging/Logger")
        case 'EXTRACTION.PROGRESS':
const Logger = require("src/core/logging/Logger")
          result = await this.handleExtractionProgress(data, flowId)
const Logger = require("src/core/logging/Logger")
          break
const Logger = require("src/core/logging/Logger")
        case 'EXTRACTION.COMPLETED':
const Logger = require("src/core/logging/Logger")
          result = await this.handleExtractionCompleted(data, flowId)
const Logger = require("src/core/logging/Logger")
          break
const Logger = require("src/core/logging/Logger")
        case 'EXTRACTION.ERROR':
const Logger = require("src/core/logging/Logger")
          result = await this.handleExtractionError(data, flowId)
const Logger = require("src/core/logging/Logger")
          break
const Logger = require("src/core/logging/Logger")
        case 'POPUP.STATUS.UPDATE':
const Logger = require("src/core/logging/Logger")
          result = await this.handleStatusUpdate(data, flowId)
const Logger = require("src/core/logging/Logger")
          break
const Logger = require("src/core/logging/Logger")
        default:
const Logger = require("src/core/logging/Logger")
          throw new StandardError('UNKNOWN_ERROR', `Unsupported event type: ${type}`, {
const Logger = require("src/core/logging/Logger")
            category: 'general'
const Logger = require("src/core/logging/Logger")
          })
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      this.messageCount++
const Logger = require("src/core/logging/Logger")
      return result
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      this.errorCount++
const Logger = require("src/core/logging/Logger")
      this.lastError = { type, error: error.message, timestamp: Date.now() }
const Logger = require("src/core/logging/Logger")
      throw error
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化控制器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * 負責功能：
const Logger = require("src/core/logging/Logger")
   * - 初始化 DOM 元素引用
const Logger = require("src/core/logging/Logger")
   * - 設定事件監聽器
const Logger = require("src/core/logging/Logger")
   * - 檢查初始狀態
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async initialize () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      // 初始化 DOM 元素引用
const Logger = require("src/core/logging/Logger")
      this.initializeElements()

const Logger = require("src/core/logging/Logger")
      // 設定事件監聽器
const Logger = require("src/core/logging/Logger")
      this.setupEventListeners()

const Logger = require("src/core/logging/Logger")
      // 檢查初始狀態
const Logger = require("src/core/logging/Logger")
      await this.checkInitialStatus()
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.error('[PopupEventController] Initialization failed:', error)
const Logger = require("src/core/logging/Logger")
      this.handleInitializationError(error)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化 DOM 元素引用
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * 負責功能：
const Logger = require("src/core/logging/Logger")
   * - 收集所有必要的 DOM 元素引用
const Logger = require("src/core/logging/Logger")
   * - 驗證元素的存在性
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  initializeElements () {
const Logger = require("src/core/logging/Logger")
    if (!this.document) {
const Logger = require("src/core/logging/Logger")
      throw new StandardError('RESOURCE_NOT_AVAILABLE', 'Document not available', {
const Logger = require("src/core/logging/Logger")
        category: 'general'
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    this.elements = {
const Logger = require("src/core/logging/Logger")
      // 狀態顯示元素
const Logger = require("src/core/logging/Logger")
      statusDot: this.document.getElementById('statusDot'),
const Logger = require("src/core/logging/Logger")
      statusText: this.document.getElementById('statusText'),
const Logger = require("src/core/logging/Logger")
      statusInfo: this.document.getElementById('statusInfo'),
const Logger = require("src/core/logging/Logger")
      extensionStatus: this.document.getElementById('extensionStatus'),

const Logger = require("src/core/logging/Logger")
      // 控制按鈕
const Logger = require("src/core/logging/Logger")
      extractBtn: this.document.getElementById('extractBtn'),
const Logger = require("src/core/logging/Logger")
      settingsBtn: this.document.getElementById('settingsBtn'),
const Logger = require("src/core/logging/Logger")
      helpBtn: this.document.getElementById('helpBtn'),

const Logger = require("src/core/logging/Logger")
      // 頁面資訊
const Logger = require("src/core/logging/Logger")
      pageInfo: this.document.getElementById('pageInfo'),
const Logger = require("src/core/logging/Logger")
      bookCount: this.document.getElementById('bookCount'),

const Logger = require("src/core/logging/Logger")
      // 進度顯示元素
const Logger = require("src/core/logging/Logger")
      progressContainer: this.document.getElementById('progressContainer'),
const Logger = require("src/core/logging/Logger")
      progressBar: this.document.getElementById('progressBar'),
const Logger = require("src/core/logging/Logger")
      progressText: this.document.getElementById('progressText'),
const Logger = require("src/core/logging/Logger")
      progressPercentage: this.document.getElementById('progressPercentage'),

const Logger = require("src/core/logging/Logger")
      // 結果展示元素
const Logger = require("src/core/logging/Logger")
      resultsContainer: this.document.getElementById('resultsContainer'),
const Logger = require("src/core/logging/Logger")
      extractedBookCount: this.document.getElementById('extractedBookCount'),
const Logger = require("src/core/logging/Logger")
      extractionTime: this.document.getElementById('extractionTime'),
const Logger = require("src/core/logging/Logger")
      successRate: this.document.getElementById('successRate'),
const Logger = require("src/core/logging/Logger")
      exportBtn: this.document.getElementById('exportBtn'),
const Logger = require("src/core/logging/Logger")
      viewResultsBtn: this.document.getElementById('viewResultsBtn'),

const Logger = require("src/core/logging/Logger")
      // 錯誤訊息元素
const Logger = require("src/core/logging/Logger")
      errorContainer: this.document.getElementById('errorContainer'),
const Logger = require("src/core/logging/Logger")
      errorMessage: this.document.getElementById('errorMessage'),
const Logger = require("src/core/logging/Logger")
      retryBtn: this.document.getElementById('retryBtn'),
const Logger = require("src/core/logging/Logger")
      reportBtn: this.document.getElementById('reportBtn')
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 驗證關鍵元素
const Logger = require("src/core/logging/Logger")
    const requiredElements = ['statusDot', 'statusText', 'extractBtn']
const Logger = require("src/core/logging/Logger")
    for (const elementName of requiredElements) {
const Logger = require("src/core/logging/Logger")
      if (!this.elements[elementName]) {
const Logger = require("src/core/logging/Logger")
        throw new StandardError('REQUIRED_FIELD_MISSING', `Required element not found: ${elementName}`, {
const Logger = require("src/core/logging/Logger")
          category: 'ui'
const Logger = require("src/core/logging/Logger")
        })
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 設定事件監聽器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * 負責功能：
const Logger = require("src/core/logging/Logger")
   * - 為所有互動元素設定事件監聽器
const Logger = require("src/core/logging/Logger")
   * - 綁定處理方法到對應的事件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  setupEventListeners () {
const Logger = require("src/core/logging/Logger")
    if (this.elements.extractBtn) {
const Logger = require("src/core/logging/Logger")
      this.elements.extractBtn.addEventListener('click', () => this.handleExtractClick())
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (this.elements.settingsBtn) {
const Logger = require("src/core/logging/Logger")
      this.elements.settingsBtn.addEventListener('click', () => this.handleSettingsClick())
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (this.elements.helpBtn) {
const Logger = require("src/core/logging/Logger")
      this.elements.helpBtn.addEventListener('click', () => this.handleHelpClick())
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (this.elements.retryBtn) {
const Logger = require("src/core/logging/Logger")
      this.elements.retryBtn.addEventListener('click', () => this.handleRetryClick())
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (this.elements.exportBtn) {
const Logger = require("src/core/logging/Logger")
      this.elements.exportBtn.addEventListener('click', () => this.handleExportClick())
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 檢查初始狀態
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * 負責功能：
const Logger = require("src/core/logging/Logger")
   * - 檢查 Background Service Worker 狀態
const Logger = require("src/core/logging/Logger")
   * - 檢查當前標籤頁狀態
const Logger = require("src/core/logging/Logger")
   * - 更新 UI 初始狀態
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async checkInitialStatus () {
const Logger = require("src/core/logging/Logger")
    // 檢查 Background Service Worker
const Logger = require("src/core/logging/Logger")
    this.backgroundConnected = await this.checkBackgroundStatus()

const Logger = require("src/core/logging/Logger")
    if (this.backgroundConnected) {
const Logger = require("src/core/logging/Logger")
      // 檢查當前標籤頁
const Logger = require("src/core/logging/Logger")
      await this.checkCurrentTab()
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 檢查 Background Service Worker 狀態
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {Promise<boolean>} 是否連接成功
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * 負責功能：
const Logger = require("src/core/logging/Logger")
   * - 向 Background Script 發送狀態檢查訊息
const Logger = require("src/core/logging/Logger")
   * - 處理通訊結果和錯誤
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async checkBackgroundStatus () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      if (!this.chrome || !this.chrome.runtime) {
const Logger = require("src/core/logging/Logger")
        throw new StandardError('RESOURCE_NOT_AVAILABLE', 'Chrome runtime not available', {
const Logger = require("src/core/logging/Logger")
          category: 'general'
const Logger = require("src/core/logging/Logger")
        })
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      const response = await this.chrome.runtime.sendMessage({
const Logger = require("src/core/logging/Logger")
        type: this.MESSAGE_TYPES.GET_STATUS
const Logger = require("src/core/logging/Logger")
      })

const Logger = require("src/core/logging/Logger")
      if (response && response.success) {
const Logger = require("src/core/logging/Logger")
        this.updateStatus('線上', 'Background Service Worker 連線正常', '系統就緒', this.STATUS_TYPES.READY)
const Logger = require("src/core/logging/Logger")
        return true
const Logger = require("src/core/logging/Logger")
      } else {
const Logger = require("src/core/logging/Logger")
        throw new StandardError('UNKNOWN_ERROR', 'Background Service Worker 回應異常', {
const Logger = require("src/core/logging/Logger")
          category: 'general'
const Logger = require("src/core/logging/Logger")
        })
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      this.updateStatus('離線', 'Service Worker 離線', '請重新載入擴展', this.STATUS_TYPES.ERROR)
const Logger = require("src/core/logging/Logger")
      return false
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 檢查當前標籤頁狀態
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {Promise<Object|null>} 標籤頁物件或 null
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * 負責功能：
const Logger = require("src/core/logging/Logger")
   * - 查詢當前活動標籤頁
const Logger = require("src/core/logging/Logger")
   * - 檢查是否為 Readmoo 頁面
const Logger = require("src/core/logging/Logger")
   * - 測試 Content Script 連接狀態
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async checkCurrentTab () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      if (!this.chrome || !this.chrome.tabs) {
const Logger = require("src/core/logging/Logger")
        throw new StandardError('RESOURCE_NOT_AVAILABLE', 'Chrome tabs API not available', {
const Logger = require("src/core/logging/Logger")
          category: 'general'
const Logger = require("src/core/logging/Logger")
        })
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      const [tab] = await this.chrome.tabs.query({ active: true, currentWindow: true })

const Logger = require("src/core/logging/Logger")
      if (!tab) {
const Logger = require("src/core/logging/Logger")
        this.updateStatus('無效', '無法取得標籤頁資訊', '請重新整理頁面後再試', this.STATUS_TYPES.ERROR)
const Logger = require("src/core/logging/Logger")
        return null
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      this.lastTabInfo = tab

const Logger = require("src/core/logging/Logger")
      // 檢查是否為 Readmoo 頁面
const Logger = require("src/core/logging/Logger")
      const isReadmoo = tab.url && tab.url.includes('readmoo.com')

const Logger = require("src/core/logging/Logger")
      if (this.elements.pageInfo) {
const Logger = require("src/core/logging/Logger")
        this.elements.pageInfo.textContent = isReadmoo
const Logger = require("src/core/logging/Logger")
          ? `Readmoo (${new URL(tab.url).pathname})`
const Logger = require("src/core/logging/Logger")
          : '非 Readmoo 頁面'
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      if (isReadmoo) {
const Logger = require("src/core/logging/Logger")
        // 測試 Content Script 連接
const Logger = require("src/core/logging/Logger")
        try {
const Logger = require("src/core/logging/Logger")
          const response = await this.chrome.tabs.sendMessage(tab.id, {
const Logger = require("src/core/logging/Logger")
            type: this.MESSAGE_TYPES.PING
const Logger = require("src/core/logging/Logger")
          })

const Logger = require("src/core/logging/Logger")
          if (response && response.success) {
const Logger = require("src/core/logging/Logger")
            this.contentScriptReady = true
const Logger = require("src/core/logging/Logger")
            this.updateStatus('就緒', 'Content Script 連線正常', '可以開始提取書庫資料', this.STATUS_TYPES.READY)
const Logger = require("src/core/logging/Logger")
            this.updateButtonState(false)
const Logger = require("src/core/logging/Logger")
            return tab
const Logger = require("src/core/logging/Logger")
          }
const Logger = require("src/core/logging/Logger")
        } catch (error) {
const Logger = require("src/core/logging/Logger")
          this.contentScriptReady = false
const Logger = require("src/core/logging/Logger")
          this.updateStatus('載入中', 'Content Script 載入中', '請稍候或重新整理頁面', this.STATUS_TYPES.LOADING)
const Logger = require("src/core/logging/Logger")
        }
const Logger = require("src/core/logging/Logger")
      } else {
const Logger = require("src/core/logging/Logger")
        this.updateStatus('待機', '請前往 Readmoo 網站', '需要在 Readmoo 書庫頁面使用此功能', this.STATUS_TYPES.READY)
const Logger = require("src/core/logging/Logger")
        this.updateButtonState(true)
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      return tab
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      this.updateStatus('錯誤', '無法檢查頁面狀態', error.message, this.STATUS_TYPES.ERROR)
const Logger = require("src/core/logging/Logger")
      return null
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理進度更新事件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} data - 進度資料
const Logger = require("src/core/logging/Logger")
   * @param {string} flowId - 流程ID
const Logger = require("src/core/logging/Logger")
   * @returns {Promise<Object>} 處理結果
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async handleProgressUpdate (data, flowId) {
const Logger = require("src/core/logging/Logger")
    this.updateProgress(data.percentage, data.message)
const Logger = require("src/core/logging/Logger")
    return { success: true, flowId }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理通知顯示事件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} data - 通知資料
const Logger = require("src/core/logging/Logger")
   * @param {string} flowId - 流程ID
const Logger = require("src/core/logging/Logger")
   * @returns {Promise<Object>} 處理結果
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async handleNotificationShow (data, flowId) {
const Logger = require("src/core/logging/Logger")
    // TODO: 實現通知顯示邏輯
const Logger = require("src/core/logging/Logger")
    Logger.info(`[PopupEventController] Notification: ${data.message}`)
const Logger = require("src/core/logging/Logger")
    return { success: true, flowId }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理提取進度事件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} data - 進度資料
const Logger = require("src/core/logging/Logger")
   * @param {string} flowId - 流程ID
const Logger = require("src/core/logging/Logger")
   * @returns {Promise<Object>} 處理結果
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async handleExtractionProgress (data, flowId) {
const Logger = require("src/core/logging/Logger")
    this.extractionInProgress = true
const Logger = require("src/core/logging/Logger")
    this.updateProgress(data.percentage, data.message)
const Logger = require("src/core/logging/Logger")
    this.updateStatus('提取中', '正在提取書庫資料', '請保持頁面開啟', this.STATUS_TYPES.LOADING)
const Logger = require("src/core/logging/Logger")
    return { success: true, flowId }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理提取完成事件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} data - 完成資料
const Logger = require("src/core/logging/Logger")
   * @param {string} flowId - 流程ID
const Logger = require("src/core/logging/Logger")
   * @returns {Promise<Object>} 處理結果
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async handleExtractionCompleted (data, flowId) {
const Logger = require("src/core/logging/Logger")
    this.extractionInProgress = false
const Logger = require("src/core/logging/Logger")
    this.hideProgress()

const Logger = require("src/core/logging/Logger")
    const results = {
const Logger = require("src/core/logging/Logger")
      bookCount: data.books ? data.books.length : 0,
const Logger = require("src/core/logging/Logger")
      extractionTime: data.extractionTime || '-',
const Logger = require("src/core/logging/Logger")
      successRate: data.successRate || 100
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    this.displayExtractionResults(results)
const Logger = require("src/core/logging/Logger")
    this.updateStatus('完成', '資料提取完成', `成功提取 ${results.bookCount} 本書籍`, this.STATUS_TYPES.READY)

const Logger = require("src/core/logging/Logger")
    return { success: true, flowId, results }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理提取錯誤事件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} data - 錯誤資料
const Logger = require("src/core/logging/Logger")
   * @param {string} flowId - 流程ID
const Logger = require("src/core/logging/Logger")
   * @returns {Promise<Object>} 處理結果
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async handleExtractionError (data, flowId) {
const Logger = require("src/core/logging/Logger")
    this.extractionInProgress = false
const Logger = require("src/core/logging/Logger")
    this.handleExtractionErrorUI(data.message || '提取過程中發生錯誤', data.error)
const Logger = require("src/core/logging/Logger")
    return { success: true, flowId }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理狀態更新事件
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} data - 狀態資料
const Logger = require("src/core/logging/Logger")
   * @param {string} flowId - 流程ID
const Logger = require("src/core/logging/Logger")
   * @returns {Promise<Object>} 處理結果
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async handleStatusUpdate (data, flowId) {
const Logger = require("src/core/logging/Logger")
    this.updateStatus(data.status, data.text, data.info, data.type)
const Logger = require("src/core/logging/Logger")
    return { success: true, flowId }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理提取按鈕點擊
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async handleExtractClick () {
const Logger = require("src/core/logging/Logger")
    if (this.extractionInProgress) return

const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      await this.startExtraction()
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      this.handleExtractionErrorUI('啟動提取失敗', error)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理設定按鈕點擊
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleSettingsClick () {
const Logger = require("src/core/logging/Logger")
    // TODO: 實現設定功能
const Logger = require("src/core/logging/Logger")
    if (this.chrome && this.chrome.tabs) {
const Logger = require("src/core/logging/Logger")
      this.chrome.tabs.create({ url: 'chrome://extensions/?id=' + this.chrome.runtime.id })
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理說明按鈕點擊
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleHelpClick () {
const Logger = require("src/core/logging/Logger")
    // TODO: 實現說明功能
const Logger = require("src/core/logging/Logger")
    const helpText = '使用說明：\n\n1. 前往 Readmoo 書庫頁面\n2. 點擊「開始提取書庫資料」\n3. 等待提取完成'
const Logger = require("src/core/logging/Logger")
    alert(helpText)
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理重試按鈕點擊
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async handleRetryClick () {
const Logger = require("src/core/logging/Logger")
    this.hideError()
const Logger = require("src/core/logging/Logger")
    await this.handleExtractClick()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理匯出按鈕點擊
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleExportClick () {
const Logger = require("src/core/logging/Logger")
    // TODO: 實現匯出功能
const Logger = require("src/core/logging/Logger")
    Logger.info('[PopupEventController] Export functionality not implemented yet')
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 開始資料提取
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async startExtraction () {
const Logger = require("src/core/logging/Logger")
    const tab = await this.checkCurrentTab()
const Logger = require("src/core/logging/Logger")
    if (!tab || !this.contentScriptReady) {
const Logger = require("src/core/logging/Logger")
      throw new StandardError('UNKNOWN_ERROR', '頁面或 Content Script 未就緒', {
const Logger = require("src/core/logging/Logger")
        category: 'general'
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    this.extractionInProgress = true
const Logger = require("src/core/logging/Logger")
    this.updateButtonState(true, '提取中...')
const Logger = require("src/core/logging/Logger")
    this.updateStatus('提取中', '正在啟動提取流程', '請保持頁面開啟', this.STATUS_TYPES.LOADING)

const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      const response = await this.chrome.tabs.sendMessage(tab.id, {
const Logger = require("src/core/logging/Logger")
        type: this.MESSAGE_TYPES.START_EXTRACTION
const Logger = require("src/core/logging/Logger")
      })

const Logger = require("src/core/logging/Logger")
      if (response && response.success) {
const Logger = require("src/core/logging/Logger")
        // 提取成功，等待後續事件
const Logger = require("src/core/logging/Logger")
        Logger.info('[PopupEventController] Extraction started successfully')
const Logger = require("src/core/logging/Logger")
      } else {
const Logger = require("src/core/logging/Logger")
        throw new StandardError('UNKNOWN_ERROR', response?.error || '未知錯誤', {
const Logger = require("src/core/logging/Logger")
          category: 'general'
const Logger = require("src/core/logging/Logger")
        })
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      this.extractionInProgress = false
const Logger = require("src/core/logging/Logger")
      this.updateButtonState(false, '🚀 開始提取書庫資料')
const Logger = require("src/core/logging/Logger")
      throw error
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 更新狀態顯示
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} status - 擴展狀態文字
const Logger = require("src/core/logging/Logger")
   * @param {string} text - 主要狀態文字
const Logger = require("src/core/logging/Logger")
   * @param {string} info - 詳細資訊文字
const Logger = require("src/core/logging/Logger")
   * @param {string} type - 狀態類型
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  updateStatus (status, text, info, type = this.STATUS_TYPES.LOADING) {
const Logger = require("src/core/logging/Logger")
    if (this.elements.statusDot) {
const Logger = require("src/core/logging/Logger")
      this.elements.statusDot.className = `status-dot ${type}`
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (this.elements.statusText) {
const Logger = require("src/core/logging/Logger")
      this.elements.statusText.textContent = text
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (this.elements.statusInfo) {
const Logger = require("src/core/logging/Logger")
      this.elements.statusInfo.textContent = info
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (this.elements.extensionStatus) {
const Logger = require("src/core/logging/Logger")
      this.elements.extensionStatus.textContent = status
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    this.currentStatus = { status, text, info, type }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 更新按鈕狀態
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {boolean} disabled - 是否禁用
const Logger = require("src/core/logging/Logger")
   * @param {string} text - 按鈕文字
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  updateButtonState (disabled, text) {
const Logger = require("src/core/logging/Logger")
    if (this.elements.extractBtn) {
const Logger = require("src/core/logging/Logger")
      this.elements.extractBtn.disabled = disabled
const Logger = require("src/core/logging/Logger")
      if (text) {
const Logger = require("src/core/logging/Logger")
        this.elements.extractBtn.textContent = text
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 更新進度顯示
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {number} percentage - 進度百分比
const Logger = require("src/core/logging/Logger")
   * @param {string} text - 進度文字
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  updateProgress (percentage, text) {
const Logger = require("src/core/logging/Logger")
    if (!this.elements.progressContainer) return

const Logger = require("src/core/logging/Logger")
    this.elements.progressContainer.style.display = 'block'

const Logger = require("src/core/logging/Logger")
    const clampedPercentage = Math.min(100, Math.max(0, percentage))

const Logger = require("src/core/logging/Logger")
    const progressFill = this.elements.progressBar?.querySelector('.progress-fill')
const Logger = require("src/core/logging/Logger")
    if (progressFill) {
const Logger = require("src/core/logging/Logger")
      progressFill.style.width = `${clampedPercentage}%`
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (this.elements.progressPercentage) {
const Logger = require("src/core/logging/Logger")
      this.elements.progressPercentage.textContent = `${Math.round(clampedPercentage)}%`
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (this.elements.progressText && text) {
const Logger = require("src/core/logging/Logger")
      this.elements.progressText.textContent = text
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 隱藏進度顯示
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  hideProgress () {
const Logger = require("src/core/logging/Logger")
    if (this.elements.progressContainer) {
const Logger = require("src/core/logging/Logger")
      this.elements.progressContainer.style.display = 'none'
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 顯示提取結果
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} results - 結果資料
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  displayExtractionResults (results) {
const Logger = require("src/core/logging/Logger")
    if (!this.elements.resultsContainer) return

const Logger = require("src/core/logging/Logger")
    this.elements.resultsContainer.style.display = 'block'

const Logger = require("src/core/logging/Logger")
    if (this.elements.extractedBookCount) {
const Logger = require("src/core/logging/Logger")
      this.elements.extractedBookCount.textContent = results.bookCount || 0
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (this.elements.extractionTime) {
const Logger = require("src/core/logging/Logger")
      this.elements.extractionTime.textContent = results.extractionTime || '-'
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (this.elements.successRate) {
const Logger = require("src/core/logging/Logger")
      this.elements.successRate.textContent = results.successRate ? `${results.successRate}%` : '-'
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (this.elements.exportBtn) {
const Logger = require("src/core/logging/Logger")
      this.elements.exportBtn.disabled = false
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (this.elements.viewResultsBtn) {
const Logger = require("src/core/logging/Logger")
      this.elements.viewResultsBtn.disabled = false
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理提取錯誤 UI
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} message - 錯誤訊息
const Logger = require("src/core/logging/Logger")
   * @param {Error} error - 錯誤物件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleExtractionErrorUI (message, error) {
const Logger = require("src/core/logging/Logger")
    if (this.elements.errorContainer) {
const Logger = require("src/core/logging/Logger")
      this.elements.errorContainer.style.display = 'block'
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (this.elements.errorMessage) {
const Logger = require("src/core/logging/Logger")
      this.elements.errorMessage.textContent = message || '發生未知錯誤'
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    this.hideProgress()
const Logger = require("src/core/logging/Logger")
    this.updateButtonState(false, '🚀 開始提取書庫資料')
const Logger = require("src/core/logging/Logger")
    this.updateStatus('失敗', '提取失敗', message, this.STATUS_TYPES.ERROR)

const Logger = require("src/core/logging/Logger")
    if (error) {
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.error('[PopupEventController] Extraction error:', error)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 隱藏錯誤顯示
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  hideError () {
const Logger = require("src/core/logging/Logger")
    if (this.elements.errorContainer) {
const Logger = require("src/core/logging/Logger")
      this.elements.errorContainer.style.display = 'none'
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理初始化錯誤
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Error} error - 錯誤物件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  handleInitializationError (error) {
const Logger = require("src/core/logging/Logger")
    this.updateStatus('錯誤', '初始化失敗', error.message, this.STATUS_TYPES.ERROR)
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 取得處理器的統計資訊
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @returns {Object} 統計資訊物件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  getStats () {
const Logger = require("src/core/logging/Logger")
    const baseStats = super.getStats()

const Logger = require("src/core/logging/Logger")
    return {
const Logger = require("src/core/logging/Logger")
      ...baseStats,
const Logger = require("src/core/logging/Logger")
      messageCount: this.messageCount,
const Logger = require("src/core/logging/Logger")
      errorCount: this.errorCount,
const Logger = require("src/core/logging/Logger")
      backgroundConnected: this.backgroundConnected,
const Logger = require("src/core/logging/Logger")
      contentScriptReady: this.contentScriptReady,
const Logger = require("src/core/logging/Logger")
      extractionInProgress: this.extractionInProgress,
const Logger = require("src/core/logging/Logger")
      currentStatus: this.currentStatus,
const Logger = require("src/core/logging/Logger")
      lastTabInfo: this.lastTabInfo,
const Logger = require("src/core/logging/Logger")
      lastError: this.lastError
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }
const Logger = require("src/core/logging/Logger")
}

const Logger = require("src/core/logging/Logger")
module.exports = PopupEventController
