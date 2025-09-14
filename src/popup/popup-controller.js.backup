/**
const Logger = require("src/core/logging/Logger")
 * PopupController - Popup 控制器和組件協調器
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 負責功能：
const Logger = require("src/core/logging/Logger")
 * - 組件初始化和依賴注入管理
const Logger = require("src/core/logging/Logger")
 * - 事件監聽器設置和協調
const Logger = require("src/core/logging/Logger")
 * - 組件間通訊橋接
const Logger = require("src/core/logging/Logger")
 * - 生命週期管理和錯誤處理
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 設計考量：
const Logger = require("src/core/logging/Logger")
 * - 輕量級協調器：專注於組件協調，不處理具體業務邏輯
const Logger = require("src/core/logging/Logger")
 * - 依賴注入：確保組件間依賴關係清晰且可測試
const Logger = require("src/core/logging/Logger")
 * - 單一職責：只負責 Popup 界面的整體協調
const Logger = require("src/core/logging/Logger")
 * - 錯誤恢復：組件載入失敗時提供降級機制
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 處理流程：
const Logger = require("src/core/logging/Logger")
 * 1. 初始化所有模組化組件並建立依賴關係
const Logger = require("src/core/logging/Logger")
 * 2. 設置組件間事件通訊機制
const Logger = require("src/core/logging/Logger")
 * 3. 綁定 DOM 事件監聽器到對應組件方法
const Logger = require("src/core/logging/Logger")
 * 4. 執行初始化檢查和狀態同步
const Logger = require("src/core/logging/Logger")
 * 5. 提供統一的錯誤處理和恢復機制
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 使用情境：
const Logger = require("src/core/logging/Logger")
 * - 作為 popup.js 的主要控制器和入口點
const Logger = require("src/core/logging/Logger")
 * - 管理所有模組化組件的生命週期
const Logger = require("src/core/logging/Logger")
 * - 提供統一的組件協調和通訊 API
const Logger = require("src/core/logging/Logger")
 * - 確保 Popup 界面的初始化和運作正常
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * @version 1.0.0
const Logger = require("src/core/logging/Logger")
 * @since 2025-08-18
const Logger = require("src/core/logging/Logger")
 */

// 動態 StandardError 匯入 (支援瀏覽器和 Node.js)
const Logger = require("src/core/logging/Logger")
let StandardError
const Logger = require("src/core/logging/Logger")
if (typeof window !== 'undefined' && window.StandardError) {
const Logger = require("src/core/logging/Logger")
  StandardError = window.StandardError
const Logger = require("src/core/logging/Logger")
} else {
const Logger = require("src/core/logging/Logger")
  try {
const Logger = require("src/core/logging/Logger")
    ({ StandardError } = require('src/core/errors/StandardError'))
const Logger = require("src/core/logging/Logger")
  } catch (e) {
const Logger = require("src/core/logging/Logger")
    // 如果無法載入 StandardError，使用原生 Error
const Logger = require("src/core/logging/Logger")
    StandardError = class extends Error {
const Logger = require("src/core/logging/Logger")
      constructor (type, message, metadata = {}) {
const Logger = require("src/core/logging/Logger")
        super(message)
const Logger = require("src/core/logging/Logger")
        this.type = type
const Logger = require("src/core/logging/Logger")
        this.metadata = metadata
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }
const Logger = require("src/core/logging/Logger")
}

const Logger = require("src/core/logging/Logger")
class PopupController {
const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 建構 PopupController
const Logger = require("src/core/logging/Logger")
   * @param {Document} [document] - DOM 文件物件 (用於測試注入)
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  constructor (document = globalThis.document) {
const Logger = require("src/core/logging/Logger")
    // 組件容器
const Logger = require("src/core/logging/Logger")
    this.components = {}

const Logger = require("src/core/logging/Logger")
    // 初始化狀態
const Logger = require("src/core/logging/Logger")
    this.isInitialized = false
const Logger = require("src/core/logging/Logger")
    this.initializationError = null

const Logger = require("src/core/logging/Logger")
    // DOM 文件引用 (支援測試注入)
const Logger = require("src/core/logging/Logger")
    this.document = document

const Logger = require("src/core/logging/Logger")
    // 事件監聽器清理追蹤
const Logger = require("src/core/logging/Logger")
    this.eventListeners = []

const Logger = require("src/core/logging/Logger")
    // 事件管理器 (延遲初始化)
const Logger = require("src/core/logging/Logger")
    this.eventManager = null
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化控制器和所有組件
const Logger = require("src/core/logging/Logger")
   * @returns {Promise<boolean>} 初始化是否成功
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async initialize () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      // 依序初始化組件（遵循依賴順序）
const Logger = require("src/core/logging/Logger")
      await this._initializeInDependencyOrder()

const Logger = require("src/core/logging/Logger")
      // 設置組件協作機制
const Logger = require("src/core/logging/Logger")
      this._setupComponentCollaboration()

const Logger = require("src/core/logging/Logger")
      // 執行初始化驗證
const Logger = require("src/core/logging/Logger")
      await this._performInitializationChecks()

const Logger = require("src/core/logging/Logger")
      this.isInitialized = true

const Logger = require("src/core/logging/Logger")
      return true
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      this.initializationError = error

const Logger = require("src/core/logging/Logger")
      // 嘗試部分初始化和降級
const Logger = require("src/core/logging/Logger")
      await this._handleInitializationFailure(error)

const Logger = require("src/core/logging/Logger")
      return false
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 按依賴順序初始化組件
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async _initializeInDependencyOrder () {
const Logger = require("src/core/logging/Logger")
    // 1. 初始化 UI 管理器（基礎層）
const Logger = require("src/core/logging/Logger")
    await this._initializeUIManager()

const Logger = require("src/core/logging/Logger")
    // 2. 初始化狀態管理器（依賴 UI）
const Logger = require("src/core/logging/Logger")
    await this._initializeStatusManager()

const Logger = require("src/core/logging/Logger")
    // 3. 初始化進度管理器（依賴 UI）
const Logger = require("src/core/logging/Logger")
    await this._initializeProgressManager()

const Logger = require("src/core/logging/Logger")
    // 4. 初始化通訊服務（依賴狀態和進度管理器）
const Logger = require("src/core/logging/Logger")
    await this._initializeCommunicationService()

const Logger = require("src/core/logging/Logger")
    // 5. 初始化提取服務（依賴所有其他組件）
const Logger = require("src/core/logging/Logger")
    await this._initializeExtractionService()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 設置組件協作機制
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  _setupComponentCollaboration () {
const Logger = require("src/core/logging/Logger")
    // 設置組件間通訊
const Logger = require("src/core/logging/Logger")
    this._setupInterComponentCommunication()

const Logger = require("src/core/logging/Logger")
    // 初始化事件管理器
const Logger = require("src/core/logging/Logger")
    this._initializeEventManager()

const Logger = require("src/core/logging/Logger")
    // 設置事件監聽器
const Logger = require("src/core/logging/Logger")
    this._setupEventListeners()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 獲取組件實例
const Logger = require("src/core/logging/Logger")
   * @param {string} componentName - 組件名稱
const Logger = require("src/core/logging/Logger")
   * @returns {Object|null} 組件實例
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  getComponent (componentName) {
const Logger = require("src/core/logging/Logger")
    return this.components[componentName] || null
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 檢查組件是否可用
const Logger = require("src/core/logging/Logger")
   * @param {string} componentName - 組件名稱
const Logger = require("src/core/logging/Logger")
   * @returns {boolean} 組件是否可用
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  isComponentAvailable (componentName) {
const Logger = require("src/core/logging/Logger")
    return this.components[componentName] != null
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 獲取初始化狀態
const Logger = require("src/core/logging/Logger")
   * @returns {Object} 初始化狀態資訊
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  getInitializationStatus () {
const Logger = require("src/core/logging/Logger")
    return {
const Logger = require("src/core/logging/Logger")
      isInitialized: this.isInitialized,
const Logger = require("src/core/logging/Logger")
      initializationError: this.initializationError,
const Logger = require("src/core/logging/Logger")
      availableComponents: Object.keys(this.components),
const Logger = require("src/core/logging/Logger")
      componentCount: Object.keys(this.components).length
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 清理控制器資源
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  cleanup () {
const Logger = require("src/core/logging/Logger")
    // 清理事件管理器
const Logger = require("src/core/logging/Logger")
    if (this.eventManager) {
const Logger = require("src/core/logging/Logger")
      this.eventManager.cleanup()
const Logger = require("src/core/logging/Logger")
      this.eventManager = undefined
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 清理舊式事件監聽器
const Logger = require("src/core/logging/Logger")
    this.eventListeners.forEach(({ element, type, listener }) => {
const Logger = require("src/core/logging/Logger")
      if (element && element.removeEventListener) {
const Logger = require("src/core/logging/Logger")
        element.removeEventListener(type, listener)
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
    this.eventListeners = []

const Logger = require("src/core/logging/Logger")
    // 清理組件
const Logger = require("src/core/logging/Logger")
    Object.values(this.components).forEach(component => {
const Logger = require("src/core/logging/Logger")
      if (component && typeof component.cleanup === 'function') {
const Logger = require("src/core/logging/Logger")
        component.cleanup()
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    })

const Logger = require("src/core/logging/Logger")
    // 重置狀態
const Logger = require("src/core/logging/Logger")
    this.components = {}
const Logger = require("src/core/logging/Logger")
    this.isInitialized = false
const Logger = require("src/core/logging/Logger")
    this.initializationError = null
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 獲取剩餘的 TODO 標記
const Logger = require("src/core/logging/Logger")
   * @returns {Array<string>} TODO 標記列表
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  _getRemainingTodos () {
const Logger = require("src/core/logging/Logger")
    // 檢查當前類別中的 TODO 標記
const Logger = require("src/core/logging/Logger")
    const sourceCode = this.constructor.toString()
const Logger = require("src/core/logging/Logger")
    const todoMatches = sourceCode.match(/\/\/\s*TODO[^]*?$/gm) || []

const Logger = require("src/core/logging/Logger")
    return todoMatches.map(match => match.replace(/^\s*\/\/\s*TODO:?\s*/i, '').trim())
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  // ===== 私有方法：組件初始化 =====

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化 UI 管理器
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async _initializeUIManager () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      // 使用統一的 UI 管理器實作
const Logger = require("src/core/logging/Logger")
      this.components.ui = this._createUIManagerMock()

const Logger = require("src/core/logging/Logger")
      // UI 管理器初始化完成
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // UI 管理器初始化失敗
const Logger = require("src/core/logging/Logger")
      throw new StandardError('INITIALIZATION_ERROR', `UI Manager initialization failed: ${error.message}`, { category: 'initialization' })
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 建立 UI 管理器的 Mock 實作
const Logger = require("src/core/logging/Logger")
   * @returns {Object} UI 管理器 Mock 物件
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  _createUIManagerMock () {
const Logger = require("src/core/logging/Logger")
    return {
const Logger = require("src/core/logging/Logger")
      initialize: () => {},
const Logger = require("src/core/logging/Logger")
      cleanup: () => {},
const Logger = require("src/core/logging/Logger")
      bindEvent: (selector, event, handler) => {
const Logger = require("src/core/logging/Logger")
        this._bindEventToElement(selector, event, handler)
const Logger = require("src/core/logging/Logger")
      },
const Logger = require("src/core/logging/Logger")
      updateStatus: (statusData) => {
const Logger = require("src/core/logging/Logger")
        this._updateStatusElements(statusData)
const Logger = require("src/core/logging/Logger")
      },
const Logger = require("src/core/logging/Logger")
      showError: (errorInfo) => {
const Logger = require("src/core/logging/Logger")
      },
const Logger = require("src/core/logging/Logger")
      updateProgress: (percentage, status, text) => {
const Logger = require("src/core/logging/Logger")
        this._updateProgressElements(percentage, status, text)
const Logger = require("src/core/logging/Logger")
      },
const Logger = require("src/core/logging/Logger")
      showProgress: () => {
const Logger = require("src/core/logging/Logger")
        this._toggleProgressVisibility(true)
const Logger = require("src/core/logging/Logger")
      },
const Logger = require("src/core/logging/Logger")
      hideProgress: () => {
const Logger = require("src/core/logging/Logger")
        this._toggleProgressVisibility(false)
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 綁定事件到 DOM 元素
const Logger = require("src/core/logging/Logger")
   * @param {string} selector - 元素選擇器
const Logger = require("src/core/logging/Logger")
   * @param {string} event - 事件類型
const Logger = require("src/core/logging/Logger")
   * @param {Function} handler - 事件處理函數
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  _bindEventToElement (selector, event, handler) {
const Logger = require("src/core/logging/Logger")
    const element = this.document.getElementById(selector.replace('#', ''))
const Logger = require("src/core/logging/Logger")
    if (element) {
const Logger = require("src/core/logging/Logger")
      element.addEventListener(event, handler)
const Logger = require("src/core/logging/Logger")
      this.eventListeners.push({ element, type: event, listener: handler })
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 切換進度容器可見性
const Logger = require("src/core/logging/Logger")
   * @param {boolean} visible - 是否可見
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  _toggleProgressVisibility (visible) {
const Logger = require("src/core/logging/Logger")
    const progressContainer = this.document.getElementById('progress-container')
const Logger = require("src/core/logging/Logger")
    if (progressContainer) {
const Logger = require("src/core/logging/Logger")
      if (visible) {
const Logger = require("src/core/logging/Logger")
        progressContainer.classList.remove('hidden')
const Logger = require("src/core/logging/Logger")
      } else {
const Logger = require("src/core/logging/Logger")
        progressContainer.classList.add('hidden')
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 更新狀態相關的 DOM 元素
const Logger = require("src/core/logging/Logger")
   * @param {Object} statusData - 狀態資料
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  _updateStatusElements (statusData) {
const Logger = require("src/core/logging/Logger")
    // 更新狀態點樣式
const Logger = require("src/core/logging/Logger")
    const statusDot = this.document.getElementById('status-dot')
const Logger = require("src/core/logging/Logger")
    if (statusDot) {
const Logger = require("src/core/logging/Logger")
      statusDot.className = `status-dot ${statusData.type}`
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 更新狀態文字
const Logger = require("src/core/logging/Logger")
    const statusText = this.document.getElementById('status-text')
const Logger = require("src/core/logging/Logger")
    if (statusText) {
const Logger = require("src/core/logging/Logger")
      statusText.textContent = statusData.text
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 更新狀態資訊
const Logger = require("src/core/logging/Logger")
    const statusInfo = this.document.getElementById('status-info')
const Logger = require("src/core/logging/Logger")
    if (statusInfo && statusData.info) {
const Logger = require("src/core/logging/Logger")
      statusInfo.textContent = statusData.info
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 更新擴展狀態
const Logger = require("src/core/logging/Logger")
    const extensionStatus = this.document.getElementById('extension-status')
const Logger = require("src/core/logging/Logger")
    if (extensionStatus && statusData.status) {
const Logger = require("src/core/logging/Logger")
      extensionStatus.textContent = statusData.status
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 更新進度相關的 DOM 元素
const Logger = require("src/core/logging/Logger")
   * @param {number} percentage - 進度百分比
const Logger = require("src/core/logging/Logger")
   * @param {string} status - 進度狀態
const Logger = require("src/core/logging/Logger")
   * @param {string} text - 進度文字
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  _updateProgressElements (percentage, status, text) {
const Logger = require("src/core/logging/Logger")
    // 更新進度條寬度
const Logger = require("src/core/logging/Logger")
    const progressBar = this.document.getElementById('progress-bar')
const Logger = require("src/core/logging/Logger")
    if (progressBar) {
const Logger = require("src/core/logging/Logger")
      progressBar.style.width = `${percentage}%`
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 更新進度文字
const Logger = require("src/core/logging/Logger")
    const progressText = this.document.getElementById('progress-text')
const Logger = require("src/core/logging/Logger")
    if (progressText && text) {
const Logger = require("src/core/logging/Logger")
      progressText.textContent = text
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 更新進度百分比
const Logger = require("src/core/logging/Logger")
    const progressPercentage = this.document.getElementById('progress-percentage')
const Logger = require("src/core/logging/Logger")
    if (progressPercentage) {
const Logger = require("src/core/logging/Logger")
      progressPercentage.textContent = `${percentage}%`
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化狀態管理器
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async _initializeStatusManager () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      // 載入 PopupStatusManager
const Logger = require("src/core/logging/Logger")
      const PopupStatusManager = require('./components/popup-status-manager.js')
const Logger = require("src/core/logging/Logger")
      this.components.status = new PopupStatusManager(this.components.ui)

const Logger = require("src/core/logging/Logger")
      // 狀態管理器初始化完成
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // 狀態管理器初始化失敗
const Logger = require("src/core/logging/Logger")
      throw new StandardError('INITIALIZATION_ERROR', `Status Manager initialization failed: ${error.message}`, { category: 'initialization' })
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化進度管理器
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async _initializeProgressManager () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      // 載入 PopupProgressManager
const Logger = require("src/core/logging/Logger")
      const PopupProgressManager = require('./components/popup-progress-manager.js')
const Logger = require("src/core/logging/Logger")
      this.components.progress = new PopupProgressManager(this.components.ui)

const Logger = require("src/core/logging/Logger")
      // 進度管理器初始化完成
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // 進度管理器初始化失敗
const Logger = require("src/core/logging/Logger")
      throw new StandardError('INITIALIZATION_ERROR', `Progress Manager initialization failed: ${error.message}`, { category: 'initialization' })
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化通訊服務
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async _initializeCommunicationService () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      // 載入 PopupCommunicationService
const Logger = require("src/core/logging/Logger")
      const PopupCommunicationService = require('./services/popup-communication-service.js')
const Logger = require("src/core/logging/Logger")
      this.components.communication = new PopupCommunicationService(
const Logger = require("src/core/logging/Logger")
        this.components.status,
const Logger = require("src/core/logging/Logger")
        this.components.progress
const Logger = require("src/core/logging/Logger")
      )

const Logger = require("src/core/logging/Logger")
      // 通訊服務初始化完成
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // 通訊服務初始化失敗
const Logger = require("src/core/logging/Logger")
      throw new StandardError('INITIALIZATION_ERROR', `Communication Service initialization failed: ${error.message}`, { category: 'initialization' })
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化提取服務
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async _initializeExtractionService () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      // 載入 PopupExtractionService
const Logger = require("src/core/logging/Logger")
      const PopupExtractionService = require('./services/popup-extraction-service.js')
const Logger = require("src/core/logging/Logger")
      this.components.extraction = new PopupExtractionService(
const Logger = require("src/core/logging/Logger")
        this.components.status,
const Logger = require("src/core/logging/Logger")
        this.components.progress,
const Logger = require("src/core/logging/Logger")
        this.components.communication
const Logger = require("src/core/logging/Logger")
      )

const Logger = require("src/core/logging/Logger")
      // 提取服務初始化完成
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // 提取服務初始化失敗
const Logger = require("src/core/logging/Logger")
      throw new StandardError('INITIALIZATION_ERROR', `Extraction Service initialization failed: ${error.message}`, { category: 'initialization' })
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 設置組件間通訊機制
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  _setupInterComponentCommunication () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      // 組件間通訊已通過依賴注入實現
const Logger = require("src/core/logging/Logger")
      // StatusManager 和 ProgressManager 都持有 UI 管理器引用
const Logger = require("src/core/logging/Logger")
      // CommunicationService 持有 StatusManager 和 ProgressManager 引用
const Logger = require("src/core/logging/Logger")
      // ExtractionService 持有所有必要的組件引用

const Logger = require("src/core/logging/Logger")
      // 組件間通訊設置完成
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // 組件間通訊設置失敗
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 初始化事件管理器
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  _initializeEventManager () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      // 動態載入 EventManager
const Logger = require("src/core/logging/Logger")
      const EventManager = require('./utils/event-manager.js')
const Logger = require("src/core/logging/Logger")
      this.eventManager = new EventManager(this.document, this.components)
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // 降級到舊式事件處理
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.warn('EventManager 載入失敗，使用舊式事件處理:', error.message)
const Logger = require("src/core/logging/Logger")
      this.eventManager = null
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 設置事件監聽器
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  _setupEventListeners () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      if (this.eventManager) {
const Logger = require("src/core/logging/Logger")
        // 使用新的事件管理器
const Logger = require("src/core/logging/Logger")
        this.eventManager.bindEvents()
const Logger = require("src/core/logging/Logger")
      } else {
const Logger = require("src/core/logging/Logger")
        // 降級到舊式事件綁定
const Logger = require("src/core/logging/Logger")
        this._setupLegacyEventListeners()
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      // 事件監聽器設置完成
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // 事件監聽器設置失敗
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.error('事件監聽器設置失敗:', error.message)
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 舊式事件監聽器設置（降級機制）
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  _setupLegacyEventListeners () {
const Logger = require("src/core/logging/Logger")
    // 綁定主要操作按鈕
const Logger = require("src/core/logging/Logger")
    this.components.ui.bindEvent('extract-button', 'click', () => {
const Logger = require("src/core/logging/Logger")
      this.components.extraction.startExtraction()
const Logger = require("src/core/logging/Logger")
    })

const Logger = require("src/core/logging/Logger")
    // 綁定其他按鈕事件（通過 EventManager 統一管理）
const Logger = require("src/core/logging/Logger")
    this.components.ui.bindEvent('settings-button', 'click', () => {
const Logger = require("src/core/logging/Logger")
      // 設定功能通過 EventManager 實現
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
    this.components.ui.bindEvent('help-button', 'click', () => {
const Logger = require("src/core/logging/Logger")
      // 說明功能通過 EventManager 實現
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
    this.components.ui.bindEvent('retry-button', 'click', () => {
const Logger = require("src/core/logging/Logger")
      this.components.extraction.retryExtraction()
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 執行初始化檢查
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async _performInitializationChecks () {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      // 檢查所有組件是否正確載入
const Logger = require("src/core/logging/Logger")
      const requiredComponents = ['ui', 'status', 'progress', 'communication', 'extraction']
const Logger = require("src/core/logging/Logger")
      const missingComponents = requiredComponents.filter(name => !this.components[name])

const Logger = require("src/core/logging/Logger")
      if (missingComponents.length > 0) {
const Logger = require("src/core/logging/Logger")
        throw new StandardError('VALIDATION_ERROR', `Missing components: ${missingComponents.join(', ')}`, { category: 'validation' })
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      // 執行 Background Service Worker 狀態檢查
const Logger = require("src/core/logging/Logger")
      try {
const Logger = require("src/core/logging/Logger")
        await this.components.communication.checkBackgroundStatus()
const Logger = require("src/core/logging/Logger")
        // 檢查成功，記錄狀態
const Logger = require("src/core/logging/Logger")
      } catch (error) {
const Logger = require("src/core/logging/Logger")
        // 背景服務檢查失敗，但不阻止初始化
const Logger = require("src/core/logging/Logger")
        // 錯誤已經在 communication service 中處理，包含使用者友好的錯誤訊息
const Logger = require("src/core/logging/Logger")
        // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
        // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
        Logger.warn('Background service check failed:', error.message)

const Logger = require("src/core/logging/Logger")
        // 在測試環境中，不應該當作錯誤
const Logger = require("src/core/logging/Logger")
        if (process.env.NODE_ENV === 'test') {
const Logger = require("src/core/logging/Logger")
          // 測試環境跳過背景服務檢查
const Logger = require("src/core/logging/Logger")
        }
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      // 初始化檢查完成
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // 初始化檢查失敗
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.error('❌ Initialization checks failed:', error)
const Logger = require("src/core/logging/Logger")
      throw error
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 處理初始化失敗
const Logger = require("src/core/logging/Logger")
   * @param {Error} error - 初始化錯誤
const Logger = require("src/core/logging/Logger")
   * @private
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async _handleInitializationFailure (error) {
const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      // 實作降級機制
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.warn('初始化失敗，啟動降級模式:', error.message)

const Logger = require("src/core/logging/Logger")
      // 使用基本 UI 操作
const Logger = require("src/core/logging/Logger")
      if (!this.components.ui) {
const Logger = require("src/core/logging/Logger")
        this.components.ui = this._createUIManagerMock()
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      // 禁用高級功能
const Logger = require("src/core/logging/Logger")
      this.isInitialized = false

const Logger = require("src/core/logging/Logger")
      // 顯示錯誤狀態
const Logger = require("src/core/logging/Logger")
      if (this.components.ui && this.components.ui.showError) {
const Logger = require("src/core/logging/Logger")
        this.components.ui.showError({
const Logger = require("src/core/logging/Logger")
          type: 'initialization_failed',
const Logger = require("src/core/logging/Logger")
          message: '初始化失敗，部分功能可能不可用',
const Logger = require("src/core/logging/Logger")
          details: error.message
const Logger = require("src/core/logging/Logger")
        })
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      // 降級機制啟動完成
const Logger = require("src/core/logging/Logger")
    } catch (degradationError) {
const Logger = require("src/core/logging/Logger")
      // 記錄降級失敗，但不中斷執行
const Logger = require("src/core/logging/Logger")
      this.initializationError = degradationError
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }
const Logger = require("src/core/logging/Logger")
}

// 導出模組
const Logger = require("src/core/logging/Logger")
if (typeof module !== 'undefined' && module.exports) {
const Logger = require("src/core/logging/Logger")
  module.exports = PopupController
const Logger = require("src/core/logging/Logger")
}

// 瀏覽器環境支援
const Logger = require("src/core/logging/Logger")
if (typeof window !== 'undefined') {
const Logger = require("src/core/logging/Logger")
  window.PopupController = PopupController
const Logger = require("src/core/logging/Logger")
}
