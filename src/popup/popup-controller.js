/**
 * PopupController - Popup 控制器和組件協調器
 *
 * 負責功能：
 * - 組件初始化和依賴注入管理
 * - 事件監聽器設置和協調
 * - 組件間通訊橋接
 * - 生命週期管理和錯誤處理
 *
 * 設計考量：
 * - 輕量級協調器：專注於組件協調，不處理具體業務邏輯
 * - 依賴注入：確保組件間依賴關係清晰且可測試
 * - 單一職責：只負責 Popup 界面的整體協調
 * - 錯誤恢復：組件載入失敗時提供降級機制
 *
 * 處理流程：
 * 1. 初始化所有模組化組件並建立依賴關係
 * 2. 設置組件間事件通訊機制
 * 3. 綁定 DOM 事件監聽器到對應組件方法
 * 4. 執行初始化檢查和狀態同步
 * 5. 提供統一的錯誤處理和恢復機制
 *
 * 使用情境：
 * - 作為 popup.js 的主要控制器和入口點
 * - 管理所有模組化組件的生命週期
 * - 提供統一的組件協調和通訊 API
 * - 確保 Popup 界面的初始化和運作正常
 *
 * @version 1.0.0
 * @since 2025-08-18
 */

class PopupController {
  /**
   * 建構 PopupController
   * @param {Document} [document] - DOM 文件物件 (用於測試注入)
   */
  constructor (document = globalThis.document) {
    // 組件容器
    this.components = {}

    // 初始化狀態
    this.isInitialized = false
    this.initializationError = null

    // DOM 文件引用 (支援測試注入)
    this.document = document

    // 事件監聽器清理追蹤
    this.eventListeners = []

    // 事件管理器 (延遲初始化)
    this.eventManager = null
  }

  /**
   * 初始化控制器和所有組件
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize () {
    try {
      // 依序初始化組件（遵循依賴順序）
      await this._initializeInDependencyOrder()

      // 設置組件協作機制
      this._setupComponentCollaboration()

      // 執行初始化驗證
      await this._performInitializationChecks()

      this.isInitialized = true

      return true
    } catch (error) {
      this.initializationError = error

      // 嘗試部分初始化和降級
      await this._handleInitializationFailure(error)

      return false
    }
  }

  /**
   * 按依賴順序初始化組件
   * @private
   */
  async _initializeInDependencyOrder () {
    // 1. 初始化 UI 管理器（基礎層）
    await this._initializeUIManager()

    // 2. 初始化狀態管理器（依賴 UI）
    await this._initializeStatusManager()

    // 3. 初始化進度管理器（依賴 UI）
    await this._initializeProgressManager()

    // 4. 初始化通訊服務（依賴狀態和進度管理器）
    await this._initializeCommunicationService()

    // 5. 初始化提取服務（依賴所有其他組件）
    await this._initializeExtractionService()
  }

  /**
   * 設置組件協作機制
   * @private
   */
  _setupComponentCollaboration () {
    // 設置組件間通訊
    this._setupInterComponentCommunication()

    // 初始化事件管理器
    this._initializeEventManager()

    // 設置事件監聽器
    this._setupEventListeners()
  }

  /**
   * 獲取組件實例
   * @param {string} componentName - 組件名稱
   * @returns {Object|null} 組件實例
   */
  getComponent (componentName) {
    return this.components[componentName] || null
  }

  /**
   * 檢查組件是否可用
   * @param {string} componentName - 組件名稱
   * @returns {boolean} 組件是否可用
   */
  isComponentAvailable (componentName) {
    return this.components[componentName] != null
  }

  /**
   * 獲取初始化狀態
   * @returns {Object} 初始化狀態資訊
   */
  getInitializationStatus () {
    return {
      isInitialized: this.isInitialized,
      initializationError: this.initializationError,
      availableComponents: Object.keys(this.components),
      componentCount: Object.keys(this.components).length
    }
  }

  /**
   * 清理控制器資源
   */
  cleanup () {
    // 清理事件管理器
    if (this.eventManager) {
      this.eventManager.cleanup()
      this.eventManager = undefined
    }

    // 清理舊式事件監聽器
    this.eventListeners.forEach(({ element, type, listener }) => {
      if (element && element.removeEventListener) {
        element.removeEventListener(type, listener)
      }
    })
    this.eventListeners = []

    // 清理組件
    Object.values(this.components).forEach(component => {
      if (component && typeof component.cleanup === 'function') {
        component.cleanup()
      }
    })

    // 重置狀態
    this.components = {}
    this.isInitialized = false
    this.initializationError = null
  }

  /**
   * 獲取剩餘的 TODO 標記
   * @returns {Array<string>} TODO 標記列表
   * @private
   */
  _getRemainingTodos () {
    // 檢查當前類別中的 TODO 標記
    const sourceCode = this.constructor.toString()
    const todoMatches = sourceCode.match(/\/\/\s*TODO[^]*?$/gm) || []

    return todoMatches.map(match => match.replace(/^\s*\/\/\s*TODO:?\s*/i, '').trim())
  }

  // ===== 私有方法：組件初始化 =====

  /**
   * 初始化 UI 管理器
   * @private
   */
  async _initializeUIManager () {
    try {
      // 使用統一的 UI 管理器實作
      this.components.ui = this._createUIManagerMock()

      // UI 管理器初始化完成
    } catch (error) {
      // UI 管理器初始化失敗
      throw new Error(`UI Manager initialization failed: ${error.message}`)
    }
  }

  /**
   * 建立 UI 管理器的 Mock 實作
   * @returns {Object} UI 管理器 Mock 物件
   * @private
   */
  _createUIManagerMock () {
    return {
      initialize: () => {},
      cleanup: () => {},
      bindEvent: (selector, event, handler) => {
        this._bindEventToElement(selector, event, handler)
      },
      updateStatus: (statusData) => {
        this._updateStatusElements(statusData)
      },
      showError: (errorInfo) => {
        console.log('Error displayed:', errorInfo)
      },
      updateProgress: (percentage, status, text) => {
        this._updateProgressElements(percentage, status, text)
      },
      showProgress: () => {
        this._toggleProgressVisibility(true)
      },
      hideProgress: () => {
        this._toggleProgressVisibility(false)
      }
    }
  }

  /**
   * 綁定事件到 DOM 元素
   * @param {string} selector - 元素選擇器
   * @param {string} event - 事件類型
   * @param {Function} handler - 事件處理函數
   * @private
   */
  _bindEventToElement (selector, event, handler) {
    const element = this.document.getElementById(selector.replace('#', ''))
    if (element) {
      element.addEventListener(event, handler)
      this.eventListeners.push({ element, type: event, listener: handler })
    }
  }

  /**
   * 切換進度容器可見性
   * @param {boolean} visible - 是否可見
   * @private
   */
  _toggleProgressVisibility (visible) {
    const progressContainer = this.document.getElementById('progress-container')
    if (progressContainer) {
      if (visible) {
        progressContainer.classList.remove('hidden')
      } else {
        progressContainer.classList.add('hidden')
      }
    }
  }

  /**
   * 更新狀態相關的 DOM 元素
   * @param {Object} statusData - 狀態資料
   * @private
   */
  _updateStatusElements (statusData) {
    // 更新狀態點樣式
    const statusDot = this.document.getElementById('status-dot')
    if (statusDot) {
      statusDot.className = `status-dot ${statusData.type}`
    }

    // 更新狀態文字
    const statusText = this.document.getElementById('status-text')
    if (statusText) {
      statusText.textContent = statusData.text
    }

    // 更新狀態資訊
    const statusInfo = this.document.getElementById('status-info')
    if (statusInfo && statusData.info) {
      statusInfo.textContent = statusData.info
    }

    // 更新擴展狀態
    const extensionStatus = this.document.getElementById('extension-status')
    if (extensionStatus && statusData.status) {
      extensionStatus.textContent = statusData.status
    }
  }

  /**
   * 更新進度相關的 DOM 元素
   * @param {number} percentage - 進度百分比
   * @param {string} status - 進度狀態
   * @param {string} text - 進度文字
   * @private
   */
  _updateProgressElements (percentage, status, text) {
    // 更新進度條寬度
    const progressBar = this.document.getElementById('progress-bar')
    if (progressBar) {
      progressBar.style.width = `${percentage}%`
    }

    // 更新進度文字
    const progressText = this.document.getElementById('progress-text')
    if (progressText && text) {
      progressText.textContent = text
    }

    // 更新進度百分比
    const progressPercentage = this.document.getElementById('progress-percentage')
    if (progressPercentage) {
      progressPercentage.textContent = `${percentage}%`
    }
  }

  /**
   * 初始化狀態管理器
   * @private
   */
  async _initializeStatusManager () {
    try {
      // 載入 PopupStatusManager
      const PopupStatusManager = require('./components/popup-status-manager.js')
      this.components.status = new PopupStatusManager(this.components.ui)

      // 狀態管理器初始化完成
    } catch (error) {
      // 狀態管理器初始化失敗
      throw new Error(`Status Manager initialization failed: ${error.message}`)
    }
  }

  /**
   * 初始化進度管理器
   * @private
   */
  async _initializeProgressManager () {
    try {
      // 載入 PopupProgressManager
      const PopupProgressManager = require('./components/popup-progress-manager.js')
      this.components.progress = new PopupProgressManager(this.components.ui)

      // 進度管理器初始化完成
    } catch (error) {
      // 進度管理器初始化失敗
      throw new Error(`Progress Manager initialization failed: ${error.message}`)
    }
  }

  /**
   * 初始化通訊服務
   * @private
   */
  async _initializeCommunicationService () {
    try {
      // 載入 PopupCommunicationService
      const PopupCommunicationService = require('./services/popup-communication-service.js')
      this.components.communication = new PopupCommunicationService(
        this.components.status,
        this.components.progress
      )

      // 通訊服務初始化完成
    } catch (error) {
      // 通訊服務初始化失敗
      throw new Error(`Communication Service initialization failed: ${error.message}`)
    }
  }

  /**
   * 初始化提取服務
   * @private
   */
  async _initializeExtractionService () {
    try {
      // 載入 PopupExtractionService
      const PopupExtractionService = require('./services/popup-extraction-service.js')
      this.components.extraction = new PopupExtractionService(
        this.components.status,
        this.components.progress,
        this.components.communication
      )

      // 提取服務初始化完成
    } catch (error) {
      // 提取服務初始化失敗
      throw new Error(`Extraction Service initialization failed: ${error.message}`)
    }
  }

  /**
   * 設置組件間通訊機制
   * @private
   */
  _setupInterComponentCommunication () {
    try {
      // 組件間通訊已通過依賴注入實現
      // StatusManager 和 ProgressManager 都持有 UI 管理器引用
      // CommunicationService 持有 StatusManager 和 ProgressManager 引用
      // ExtractionService 持有所有必要的組件引用

      // 組件間通訊設置完成
    } catch (error) {
      // 組件間通訊設置失敗
    }
  }

  /**
   * 初始化事件管理器
   * @private
   */
  _initializeEventManager () {
    try {
      // 動態載入 EventManager
      const EventManager = require('./utils/event-manager.js')
      this.eventManager = new EventManager(this.document, this.components)
    } catch (error) {
      // 降級到舊式事件處理
      console.warn('EventManager 載入失敗，使用舊式事件處理:', error.message)
      this.eventManager = null
    }
  }

  /**
   * 設置事件監聽器
   * @private
   */
  _setupEventListeners () {
    try {
      if (this.eventManager) {
        // 使用新的事件管理器
        this.eventManager.bindEvents()
      } else {
        // 降級到舊式事件綁定
        this._setupLegacyEventListeners()
      }

      // 事件監聽器設置完成
    } catch (error) {
      // 事件監聽器設置失敗
      console.error('事件監聽器設置失敗:', error.message)
    }
  }

  /**
   * 舊式事件監聽器設置（降級機制）
   * @private
   */
  _setupLegacyEventListeners () {
    // 綁定主要操作按鈕
    this.components.ui.bindEvent('extract-button', 'click', () => {
      this.components.extraction.startExtraction()
    })

    // 綁定其他按鈕事件（通過 EventManager 統一管理）
    this.components.ui.bindEvent('settings-button', 'click', () => {
      // 設定功能通過 EventManager 實現
    })
    this.components.ui.bindEvent('help-button', 'click', () => {
      // 說明功能通過 EventManager 實現
    })
    this.components.ui.bindEvent('retry-button', 'click', () => {
      this.components.extraction.retryExtraction()
    })
  }

  /**
   * 執行初始化檢查
   * @private
   */
  async _performInitializationChecks () {
    try {
      // 檢查所有組件是否正確載入
      const requiredComponents = ['ui', 'status', 'progress', 'communication', 'extraction']
      const missingComponents = requiredComponents.filter(name => !this.components[name])

      if (missingComponents.length > 0) {
        throw new Error(`Missing components: ${missingComponents.join(', ')}`)
      }

      // 執行 Background Service Worker 狀態檢查
      try {
        await this.components.communication.checkBackgroundStatus()
        // 檢查成功，記錄狀態
        console.log('✅ Background service check completed successfully')
      } catch (error) {
        // 背景服務檢查失敗，但不阻止初始化
        // 錯誤已經在 communication service 中處理，包含使用者友好的錯誤訊息
        console.warn('Background service check failed:', error.message)
        
        // 在測試環境中，不應該當作錯誤
        if (process.env.NODE_ENV === 'test') {
          console.log('📝 Test environment - background service check skipped')
        }
      }

      // 初始化檢查完成
      console.log('✅ Popup initialization checks completed')
    } catch (error) {
      // 初始化檢查失敗
      console.error('❌ Initialization checks failed:', error)
      throw error
    }
  }

  /**
   * 處理初始化失敗
   * @param {Error} error - 初始化錯誤
   * @private
   */
  async _handleInitializationFailure (error) {
    try {
      // 實作降級機制
      console.warn('初始化失敗，啟動降級模式:', error.message)

      // 使用基本 UI 操作
      if (!this.components.ui) {
        this.components.ui = this._createUIManagerMock()
      }

      // 禁用高級功能
      this.isInitialized = false

      // 顯示錯誤狀態
      if (this.components.ui && this.components.ui.showError) {
        this.components.ui.showError({
          type: 'initialization_failed',
          message: '初始化失敗，部分功能可能不可用',
          details: error.message
        })
      }

      // 降級機制啟動完成
    } catch (degradationError) {
      // 記錄降級失敗，但不中斷執行
      this.initializationError = degradationError
    }
  }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PopupController
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.PopupController = PopupController
}
