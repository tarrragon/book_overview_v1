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
  constructor(document = globalThis.document) {
    // 組件容器
    this.components = {}
    
    // 初始化狀態
    this.isInitialized = false
    this.initializationError = null
    
    // DOM 文件引用 (支援測試注入)
    this.document = document
    
    // 事件監聽器清理追蹤
    this.eventListeners = []
  }

  /**
   * 初始化控制器和所有組件
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    try {
      // 1. 初始化 UI 管理器
      await this._initializeUIManager()
      
      // 2. 初始化狀態管理器
      await this._initializeStatusManager()
      
      // 3. 初始化進度管理器
      await this._initializeProgressManager()
      
      // 4. 初始化通訊服務
      await this._initializeCommunicationService()
      
      // 5. 初始化提取服務
      await this._initializeExtractionService()
      
      // 6. 設置組件間通訊
      this._setupInterComponentCommunication()
      
      // 7. 設置事件監聽器
      this._setupEventListeners()
      
      // 8. 執行初始化檢查
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
   * 獲取組件實例
   * @param {string} componentName - 組件名稱
   * @returns {Object|null} 組件實例
   */
  getComponent(componentName) {
    return this.components[componentName] || null
  }

  /**
   * 檢查組件是否可用
   * @param {string} componentName - 組件名稱
   * @returns {boolean} 組件是否可用
   */
  isComponentAvailable(componentName) {
    return this.components[componentName] != null
  }

  /**
   * 獲取初始化狀態
   * @returns {Object} 初始化狀態資訊
   */
  getInitializationStatus() {
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
  cleanup() {
    // 清理事件監聽器
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

  // ===== 私有方法：組件初始化 =====

  /**
   * 初始化 UI 管理器
   * @private
   */
  async _initializeUIManager() {
    try {
      // TODO: 動態載入 PopupUIManager
      // const PopupUIManager = await import('./popup-ui-manager.js')
      // this.components.ui = new PopupUIManager.default(this.document)
      
      // 暫時的 Mock 實作，支援 StatusManager 所需的 updateStatus 接口
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
  _createUIManagerMock() {
    return {
      initialize: () => {},
      cleanup: () => {},
      bindEvent: (selector, event, handler) => {
        const element = this.document.getElementById(selector.replace('#', ''))
        if (element) {
          element.addEventListener(event, handler)
          this.eventListeners.push({ element, type: event, listener: handler })
        }
      },
      updateStatus: (statusData) => {
        this._updateStatusElements(statusData)
      },
      showError: (errorInfo) => {
        console.log('Error displayed:', errorInfo)
      }
    }
  }

  /**
   * 更新狀態相關的 DOM 元素
   * @param {Object} statusData - 狀態資料
   * @private
   */
  _updateStatusElements(statusData) {
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
   * 初始化狀態管理器
   * @private
   */
  async _initializeStatusManager() {
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
  async _initializeProgressManager() {
    try {
      // TODO: 動態載入 PopupProgressManager
      // const PopupProgressManager = await import('./components/popup-progress-manager.js')
      // this.components.progress = new PopupProgressManager.default(this.components.ui)
      
      // 暫時的 Mock 實作
      this.components.progress = {
        startProgress: (config) => {
          console.log('Progress started:', config)
        },
        updateProgress: (progressData) => {
          console.log('Progress updated:', progressData)
        },
        completeProgress: (result) => {
          console.log('Progress completed:', result)
        },
        cleanup: () => {}
      }
      
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
  async _initializeCommunicationService() {
    try {
      // TODO: 動態載入 PopupCommunicationService
      // const PopupCommunicationService = await import('./services/popup-communication-service.js')
      // this.components.communication = new PopupCommunicationService.default()
      
      // 暫時的 Mock 實作
      this.components.communication = {
        checkBackgroundStatus: () => Promise.resolve({ status: 'ready' }),
        startExtraction: () => Promise.resolve({ success: true }),
        cleanup: () => {}
      }
      
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
  async _initializeExtractionService() {
    try {
      // TODO: 動態載入 PopupExtractionService
      // const PopupExtractionService = await import('./services/popup-extraction-service.js')
      // this.components.extraction = new PopupExtractionService.default(
      //   this.components.status,
      //   this.components.progress,
      //   this.components.communication
      // )
      
      // 暫時的 Mock 實作
      this.components.extraction = {
        startExtraction: () => {
          console.log('Starting extraction via service...')
          return Promise.resolve({ success: true })
        },
        cancelExtraction: () => {
          console.log('Canceling extraction...')
          return Promise.resolve({ cancelled: true })
        },
        cleanup: () => {}
      }
      
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
  _setupInterComponentCommunication() {
    try {
      // TODO: 實作組件間事件通訊
      // 目前為佔位符實作
      
      // 組件間通訊設置完成
    } catch (error) {
      // 組件間通訊設置失敗
    }
  }

  /**
   * 設置事件監聽器
   * @private
   */
  _setupEventListeners() {
    try {
      // 綁定主要操作按鈕
      this.components.ui.bindEvent('extract-button', 'click', () => {
        this.components.extraction.startExtraction()
      })

      // TODO: 綁定其他按鈕事件
      // - settings-button -> showSettings
      // - help-button -> showHelp
      // - retry-button -> retryExtraction
      
      // 事件監聽器設置完成
    } catch (error) {
      // 事件監聽器設置失敗
    }
  }

  /**
   * 執行初始化檢查
   * @private
   */
  async _performInitializationChecks() {
    try {
      // 檢查所有組件是否正確載入
      const requiredComponents = ['ui', 'status', 'progress', 'communication', 'extraction']
      const missingComponents = requiredComponents.filter(name => !this.components[name])
      
      if (missingComponents.length > 0) {
        throw new Error(`Missing components: ${missingComponents.join(', ')}`)
      }

      // TODO: 執行 Background Service Worker 狀態檢查
      // const backgroundStatus = await this.components.communication.checkBackgroundStatus()
      
      // 初始化檢查完成
    } catch (error) {
      // 初始化檢查失敗
      throw error
    }
  }

  /**
   * 處理初始化失敗
   * @param {Error} error - 初始化錯誤
   * @private
   */
  async _handleInitializationFailure(error) {
    try {
      // TODO: 實作降級機制
      // - 使用基本 UI 操作
      // - 禁用高級功能
      // - 顯示錯誤狀態
      
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