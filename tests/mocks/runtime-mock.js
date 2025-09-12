const { StandardError } = require('src/core/errors/StandardError')
/**
 * Runtime Mock - Chrome Runtime API 模擬
 * 遵循 Five Lines 規則和單一責任原則
 *
 * @author TDD Phase 4 - cinnamon-refactor-owl重構設計師
 * @date 2025-08-25
 * @version v0.9.38-refactor
 */

/**
 * Chrome Runtime API Mock
 * 模擬 chrome.runtime 相關功能
 */
class RuntimeMock {
  constructor () {
    this._initializeState()
    this._initializeMethods()
  }

  /**
   * 初始化狀態
   */
  _initializeState () {
    this.lastError = null
    this._contextValid = true
  }

  /**
   * 初始化方法
   */
  _initializeMethods () {
    this.sendMessage = this._createSendMessage()
    this.connect = this._createConnect()
    this.getManifest = this._createGetManifest()
    this.getURL = this._createGetURL()
  }

  /**
   * 創建 sendMessage 方法
   */
  _createSendMessage () {
    return (extensionId, message, options, callback) => {
      const normalizedArgs = this._normalizeSendMessageArgs(extensionId, message, options, callback)
      this._executeSendMessage(normalizedArgs)
    }
  }

  /**
   * 正規化 sendMessage 參數
   */
  _normalizeSendMessageArgs (extensionId, message, options, callback) {
    if (typeof extensionId !== 'string') {
      return { message: extensionId, callback: message }
    }
    return { extensionId, message, options, callback }
  }

  /**
   * 執行訊息發送
   */
  _executeSendMessage ({ message, callback }) {
    this._validateContext()
    this._simulateMessageDelivery(message, callback)
  }

  /**
   * 驗證上下文有效性
   */
  _validateContext () {
    if (!this._contextValid) {
      throw new StandardError('INVALID_INPUT_ERROR', 'Extension context invalidated', { category: 'testing' })
    }
  }

  /**
   * 模擬訊息傳遞
   */
  _simulateMessageDelivery (message, callback) {
    if (callback && typeof callback === 'function') {
      this._deliverMessageWithCallback(message, callback)
    }
  }

  /**
   * 帶回調的訊息傳遞
   */
  _deliverMessageWithCallback (message, callback) {
    setTimeout(() => {
      this._clearLastError()
      this._invokeCallback(callback, message)
    }, 10)
  }

  /**
   * 清除最後錯誤
   */
  _clearLastError () {
    this.lastError = null
  }

  /**
   * 調用回調函數
   */
  _invokeCallback (callback, message) {
    const response = { success: true, echo: message }
    callback(response)
  }

  /**
   * 創建 connect 方法
   */
  _createConnect () {
    return (extensionId, connectInfo) => {
      this._validateContext()
      return this._createPortObject(connectInfo)
    }
  }

  /**
   * 創建 Port 對象
   */
  _createPortObject (connectInfo) {
    return {
      name: this._getPortName(connectInfo),
      sender: null,
      onMessage: this._createEventInterface(),
      onDisconnect: this._createEventInterface(),
      postMessage: this._createPostMessage(),
      disconnect: () => {}
    }
  }

  /**
   * 獲取端口名稱
   */
  _getPortName (connectInfo) {
    return connectInfo?.name || 'default'
  }

  /**
   * 創建事件接口
   */
  _createEventInterface () {
    return {
      addListener: () => {},
      removeListener: () => {}
    }
  }

  /**
   * 創建 postMessage 方法
   */
  _createPostMessage () {
    return (message) => {
      this._validatePortContext()
    }
  }

  /**
   * 驗證端口上下文
   */
  _validatePortContext () {
    if (!this._contextValid) {
      throw new StandardError('TEST_ERROR', 'Port disconnected', { category: 'testing' })
    }
  }

  /**
   * 創建 getManifest 方法
   */
  _createGetManifest () {
    return () => {
      return this._getManifestData()
    }
  }

  /**
   * 獲取 Manifest 資料
   */
  _getManifestData () {
    return {
      name: 'Test Extension',
      version: '1.0.0',
      manifest_version: 3
    }
  }

  /**
   * 創建 getURL 方法
   */
  _createGetURL () {
    return (path) => {
      this._validateContext()
      return this._buildExtensionURL(path)
    }
  }

  /**
   * 建構擴展URL
   */
  _buildExtensionURL (path) {
    const extensionId = 'test-extension-id'
    return `chrome-extension://${extensionId}/${path}`
  }

  /**
   * 使上下文失效（測試用）
   */
  invalidateContext () {
    this._contextValid = false
  }

  /**
   * 重置上下文（測試用）
   */
  resetContext () {
    this._contextValid = true
    this.lastError = null
  }
}

module.exports = RuntimeMock
