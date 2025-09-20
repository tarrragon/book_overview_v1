/**
 * Chrome Extension Environment Simulator
 * 模擬真實的Chrome Extension執行環境，支援多上下文和API互動
 *
 * 主要功能：
 * - Extension多上下文環境模擬
 * - Chrome API完整模擬
 * - 跨上下文通訊模擬
 * - 權限管理和狀態控制
 *
 * @author TDD Phase 2 - sage-test-architect
 * @date 2025-08-25
 * @version v0.9.38
 */

const ChromeExtensionMocksEnhanced = require('../utils/chrome-extension-mocks-enhanced')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class ChromeExtensionEnvironmentSimulator {
  constructor () {
    this.extensionContext = null
    this.popupInstance = null
    this.contentScriptInstance = null
    this.backgroundInstance = null
    this.enhancedMocks = null
    this.contexts = new Map()
    this.messageQueue = []
    this.eventListeners = new Map()
  }

  /**
   * 設定Extension執行上下文
   * @param {ExtensionConfig} config - Extension配置
   */
  setupExtensionContext (config = {}) {
    // 基於現有的ChromeExtensionMocksEnhanced擴展
    this.enhancedMocks = new ChromeExtensionMocksEnhanced()
    this.enhancedMocks.initializeAll()

    // 設定E2E測試專用的額外配置
    this.setupE2ESpecificMocks(config)

    // 建立Extension context
    this.extensionContext = {
      id: config.extensionId || 'test-extension-id',
      version: config.version || '1.0.0',
      manifestVersion: config.manifestVersion || 3,
      permissions: config.permissions || ['storage', 'activeTab'],
      origins: config.origins || ['https://readmoo.com/*'],
      initialized: true
    }

    // 設定各個上下文
    this.setupContexts()
  }

  /**
   * 設定E2E測試專用的額外Mock配置
   * @param {ExtensionConfig} config - 配置參數
   * @private
   */
  setupE2ESpecificMocks (config) {
    // 擴展chrome.tabs API
    if (!global.chrome.tabs.executeScript) {
      global.chrome.tabs.executeScript = (tabId, details, callback) => {
        setTimeout(() => {
          if (callback) {
            callback([{ result: 'script executed' }])
          }
        }, 10)
      }
    }

    // 擴展chrome.runtime API
    if (!global.chrome.runtime.getManifest) {
      global.chrome.runtime.getManifest = () => ({
        name: config.name || 'Test Extension',
        version: config.version || '1.0.0',
        manifest_version: config.manifestVersion || 3,
        permissions: config.permissions || ['storage', 'activeTab']
      })
    }

    // 擴展chrome.extension API (向後相容)
    if (!global.chrome.extension) {
      global.chrome.extension = {
        getURL: (path) => `chrome-extension://${this.extensionContext?.id || 'test'}/${path}`
      }
    }

    // 設定自訂事件系統
    this.setupCustomEventSystem()
  }

  /**
   * 設定自訂事件系統
   * @private
   */
  setupCustomEventSystem () {
    global.chrome.runtime.onMessage = {
      addListener: (listener) => {
        if (!this.eventListeners.has('message')) {
          this.eventListeners.set('message', [])
        }
        this.eventListeners.get('message').push(listener)
      },
      removeListener: (listener) => {
        const listeners = this.eventListeners.get('message') || []
        const index = listeners.indexOf(listener)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    }

    // 模擬訊息傳遞機制
    const originalSendMessage = global.chrome.runtime.sendMessage
    global.chrome.runtime.sendMessage = (...args) => {
      this.handleMessagePassing(...args)
      if (originalSendMessage) {
        return originalSendMessage(...args)
      }
    }
  }

  /**
   * 處理訊息傳遞
   * @param {...any} args - sendMessage參數
   * @private
   */
  handleMessagePassing (...args) {
    let extensionId, message, options, callback

    // 參數處理 (extensionId可選)
    if (typeof args[0] === 'string') {
      [extensionId, message, options, callback] = args
    } else {
      [message, options, callback] = args
      extensionId = null
    }

    // 將訊息加入佇列
    this.messageQueue.push({
      extensionId,
      message,
      options,
      callback,
      timestamp: Date.now()
    })

    // 觸發onMessage監聽器
    const listeners = this.eventListeners.get('message') || []
    listeners.forEach(listener => {
      try {
        setTimeout(() => {
          listener(message, { id: extensionId }, callback)
        }, Math.random() * 10) // 隨機延遲模擬真實情況
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Message listener error:', error)
      }
    })
  }

  /**
   * 設定各個上下文
   * @private
   */
  setupContexts () {
    // 設定Popup上下文
    this.contexts.set('popup', {
      type: 'popup',
      initialized: false,
      document: null,
      window: null
    })

    // 設定Background上下文
    this.contexts.set('background', {
      type: 'background',
      initialized: true,
      serviceWorker: true,
      persistent: false
    })

    // 設定Content Script上下文
    this.contexts.set('contentScript', {
      type: 'contentScript',
      initialized: false,
      injected: false,
      tabId: null
    })
  }

  /**
   * 模擬Popup開啟操作
   * @param {Object} tabInfo - 標籤資訊
   * @returns {Promise<PopupInstance>} Popup實例
   */
  async openPopupWindow (tabInfo = {}) {
    try {
      // 觸發popup.html載入
      const popupInstance = await this.createMockPopupInstance(tabInfo)

      // 初始化PopupController
      await this.initializePopupController()

      // 建立與Background的通訊
      this.establishPopupBackgroundCommunication()

      // 更新context狀態
      const popupContext = this.contexts.get('popup')
      popupContext.initialized = true
      popupContext.tabInfo = tabInfo

      this.popupInstance = popupInstance
      return popupInstance
    } catch (error) {
      throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
    }
  }

  /**
   * 創建Mock Popup實例
   * @param {Object} tabInfo - 標籤資訊
   * @returns {Promise<Object>} Popup實例
   * @private
   */
  async createMockPopupInstance (tabInfo) {
    // 模擬popup.html載入過程
    const popupDocument = this.createPopupDOM()

    return {
      document: popupDocument,
      window: {
        location: { href: `chrome-extension://${this.extensionContext.id}/popup/popup.html` },
        addEventListener: (event, handler) => {
          popupDocument.addEventListener(event, handler)
        },
        removeEventListener: (event, handler) => {
          popupDocument.removeEventListener(event, handler)
        }
      },
      tabInfo,
      ready: true,
      controller: null // 將在initializePopupController中設置
    }
  }

  /**
   * 創建Popup DOM結構
   * @returns {Document} Popup文檔物件
   * @private
   */
  createPopupDOM () {
    if (typeof document === 'undefined') {
      // 在Node.js環境中創建簡單的DOM mock
      return {
        getElementById: (id) => ({ id, innerHTML: '', style: {} }),
        querySelector: (selector) => ({ selector, innerHTML: '', style: {} }),
        addEventListener: () => {},
        removeEventListener: () => {}
      }
    }

    // 在瀏覽器環境中創建實際DOM
    const popupContainer = document.createElement('div')
    popupContainer.id = 'popup-container'
    popupContainer.innerHTML = `
      <div class="popup-header">
        <h3>書籍資料提取</h3>
      </div>
      <div class="popup-content">
        <button id="extractButton" class="extract-btn">提取書籍資料</button>
        <div id="statusMessage" class="status-message"></div>
        <div id="progressBar" class="progress-bar" style="display: none;"></div>
      </div>
    `

    return {
      ...document,
      body: popupContainer,
      getElementById: (id) => popupContainer.querySelector(`#${id}`) || document.getElementById(id),
      querySelector: (selector) => popupContainer.querySelector(selector) || document.querySelector(selector)
    }
  }

  /**
   * 初始化PopupController
   * @private
   */
  async initializePopupController () {
    // 模擬PopupController初始化過程
    if (this.popupInstance) {
      this.popupInstance.controller = {
        initialized: true,
        eventHandlers: new Map(),
        statusManager: {
          updateStatus: (message) => {
            const statusElement = this.popupInstance.document.getElementById('statusMessage')
            if (statusElement) {
              statusElement.innerHTML = message
            }
          }
        },
        extractionService: {
          startExtraction: async () => {
            // 模擬提取過程
            return { success: true, booksFound: 15 }
          }
        }
      }
    }
  }

  /**
   * 建立Popup與Background的通訊
   * @private
   */
  establishPopupBackgroundCommunication () {
    // 設定Popup到Background的通訊通道
    if (this.popupInstance && this.popupInstance.controller) {
      this.popupInstance.controller.sendToBackground = (message) => {
        return new Promise(resolve => {
          global.chrome.runtime.sendMessage(message, resolve)
        })
      }
    }
  }

  /**
   * 模擬Content Script注入
   * @param {Object} pageContext - 頁面上下文
   * @returns {Promise<ContentScriptInstance>} Content Script實例
   */
  async injectContentScript (pageContext = {}) {
    try {
      // 模擬content script injection過程
      const contentScriptInstance = await this.createContentScriptInstance(pageContext)

      // 建立與Background的通訊橋樑
      this.establishContentScriptBackgroundCommunication(contentScriptInstance)

      // 更新context狀態
      const contentContext = this.contexts.get('contentScript')
      contentContext.initialized = true
      contentContext.injected = true
      contentContext.tabId = pageContext.tabId || 1

      this.contentScriptInstance = contentScriptInstance
      return contentScriptInstance
    } catch (error) {
      throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
    }
  }

  /**
   * 創建Content Script實例
   * @param {Object} pageContext - 頁面上下文
   * @returns {Promise<Object>} Content Script實例
   * @private
   */
  async createContentScriptInstance (pageContext) {
    return {
      tabId: pageContext.tabId || 1,
      url: pageContext.url || 'https://readmoo.com/shelf',
      injected: true,
      extractors: {
        BookDataExtractor: {
          extract: async () => {
            // 模擬書籍資料提取
            return [
              { id: 'book-1', title: 'Test Book 1' },
              { id: 'book-2', title: 'Test Book 2' }
            ]
          }
        }
      },
      communicator: null // 將在建立通訊時設置
    }
  }

  /**
   * 建立Content Script與Background的通訊橋樑
   * @param {Object} contentScriptInstance - Content Script實例
   * @private
   */
  establishContentScriptBackgroundCommunication (contentScriptInstance) {
    contentScriptInstance.communicator = {
      sendToBackground: (message) => {
        return new Promise(resolve => {
          global.chrome.runtime.sendMessage(message, resolve)
        })
      },
      onMessage: (handler) => {
        global.chrome.runtime.onMessage.addListener(handler)
      }
    }
  }

  /**
   * 模擬跨上下文訊息傳遞
   * @param {string} source - 訊息來源
   * @param {string} target - 訊息目標
   * @param {Object} message - 訊息內容
   */
  simulateMessagePassing (source, target, message) {
    const messageData = {
      source,
      target,
      message,
      timestamp: Date.now(),
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    // 記錄訊息傳遞日誌
    this.messageQueue.push(messageData)

    // 模擬chrome.runtime.sendMessage行為
    setTimeout(() => {
      this.deliverMessage(messageData)
    }, Math.random() * 50) // 0-50ms隨機延遲
  }

  /**
   * 傳遞訊息到目標上下文
   * @param {Object} messageData - 訊息資料
   * @private
   */
  deliverMessage (messageData) {
    const { target, message } = messageData

    // 根據目標上下文傳遞訊息
    switch (target) {
      case 'background':
        this.deliverToBackground(message)
        break
      case 'popup':
        this.deliverToPopup(message)
        break
      case 'contentScript':
        this.deliverToContentScript(message)
        break
    }
  }

  /**
   * 傳遞訊息到Background
   * @param {Object} message - 訊息內容
   * @private
   */
  deliverToBackground (message) {
    // 觸發Background的訊息監聽器
    const listeners = this.eventListeners.get('message') || []
    listeners.forEach(listener => {
      try {
        listener(message, { tab: { id: 1 } })
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Background message delivery error:', error)
      }
    })
  }

  /**
   * 傳遞訊息到Popup
   * @param {Object} message - 訊息內容
   * @private
   */
  deliverToPopup (message) {
    if (this.popupInstance && this.popupInstance.controller) {
      // 觸發Popup的訊息處理
      try {
        if (message.type === 'EXTRACTION_COMPLETE') {
          this.popupInstance.controller.statusManager.updateStatus('提取完成')
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Popup message delivery error:', error)
      }
    }
  }

  /**
   * 傳遞訊息到Content Script
   * @param {Object} message - 訊息內容
   * @private
   */
  deliverToContentScript (message) {
    if (this.contentScriptInstance && this.contentScriptInstance.communicator) {
      // 觸發Content Script的訊息處理
      try {
        // 模擬訊息處理
        // eslint-disable-next-line no-console
        console.log('Content Script received message:', message)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Content Script message delivery error:', error)
      }
    }
  }

  /**
   * 檢查權限
   * @param {Array<string>} permissions - 要檢查的權限列表
   * @returns {Promise<Object>} 權限檢查結果
   */
  async checkPermissions (permissions) {
    const result = {}

    permissions.forEach(permission => {
      result[permission] = this.enhancedMocks?.permissions?.[permission] ?? true
    })

    return result
  }

  /**
   * 撤銷權限
   * @param {Array<string>} permissions - 要撤銷的權限列表
   */
  revokePermissions (permissions) {
    if (this.enhancedMocks) {
      permissions.forEach(permission => {
        this.enhancedMocks.revokePermission(permission)
      })
    }
  }

  /**
   * 模擬Extension icon點擊
   */
  async simulateExtensionIconClick () {
    // 觸發Extension icon點擊事件
    const clickEvent = {
      type: 'extensionIconClick',
      timestamp: Date.now()
    }

    // 記錄事件
    this.messageQueue.push(clickEvent)

    return Promise.resolve(clickEvent)
  }

  /**
   * 重置模擬器狀態
   */
  reset () {
    this.extensionContext = null
    this.popupInstance = null
    this.contentScriptInstance = null
    this.backgroundInstance = null
    this.contexts.clear()
    this.messageQueue = []
    this.eventListeners.clear()

    if (this.enhancedMocks) {
      this.enhancedMocks.resetToDefaults()
    }
  }

  /**
   * 清理資源
   */
  cleanup () {
    this.reset()

    if (this.enhancedMocks) {
      // 清理Chrome API mocks
      delete global.chrome
    }
  }

  /**
   * 獲取訊息佇列
   * @returns {Array} 訊息佇列
   */
  getMessageQueue () {
    return [...this.messageQueue]
  }

  /**
   * 清除訊息佇列
   */
  clearMessageQueue () {
    this.messageQueue = []
  }
}

module.exports = ChromeExtensionEnvironmentSimulator
