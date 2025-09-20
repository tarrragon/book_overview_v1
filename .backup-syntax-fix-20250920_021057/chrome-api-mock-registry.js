/**
 * Chrome API Mock 註冊表
 * 統一管理所有Chrome API Mock，確保行為一致性
 * 使用 Registry Pattern 管理 Mock 實例生命周期
 *
 * @author TDD Phase 4 - cinnamon-refactor-owl重構設計師
 * @date 2025-08-25
 * @version v0.9.38-refactor
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')
const StorageLocalMock = require('../mocks/storage-local-mock')
const StorageSyncMock = require('../mocks/storage-sync-mock')
const RuntimeMock = require('../mocks/runtime-mock')
const TabsMock = require('../mocks/tabs-mock')

/**
 * Chrome API Mock 註冊表
 * 提供統一的 Chrome API Mock 管理和配置
 */
class ChromeAPIMockRegistry {
  constructor () {
    this._initializeRegistry()
    this._initializeState()
  }

  /**
   * 初始化註冊表
   */
  _initializeRegistry () {
    this._mocks = new Map()
  }

  /**
   * 初始化狀態
   */
  _initializeState () {
    this._activeConfig = null
    this._isActivated = false
  }

  /**
   * 註冊 Mock 實作
   * @param {string} apiPath - API 路徑 (例: 'storage.local')
   * @param {Object} mockImplementation - Mock 實作實例
   * @returns {ChromeAPIMockRegistry} 註冊表實例（支援鏈式調用）
   */
  register (apiPath, mockImplementation) {
    this._validateApiPath(apiPath)
    this._validateMockImplementation(mockImplementation)
    this._storeMockImplementation(apiPath, mockImplementation)
    return this
  }

  /**
   * 驗證API路徑有效性
   */
  _validateApiPath (apiPath) {
    if (!apiPath || typeof apiPath !== 'string') {
      throw (() => { const error = new Error( 'API path must be a non-empty string'); error.code = ErrorCodes.INVALID_API_PATH; error.details =  { category: 'testing' }; return error })()
    }
  }

  /**
   * 驗證Mock實作有效性
   */
  _validateMockImplementation (mockImplementation) {
    if (!mockImplementation) {
      throw (() => { const error = new Error( 'Mock implementation cannot be null or undefined'); error.code = ErrorCodes.INVALID_MOCK_IMPLEMENTATION; error.details =  { category: 'testing' }; return error })()
    }
  }

  /**
   * 儲存Mock實作
   */
  _storeMockImplementation (apiPath, mockImplementation) {
    this._mocks.set(apiPath, mockImplementation)
  }

  /**
   * 激活已註冊的 Mock
   * @param {Object} config - 激活配置
   * @returns {ChromeAPIMockRegistry} 註冊表實例
   */
  activate (config = {}) {
    this._setActiveConfig(config)
    this._buildChromeObject()
    this._markAsActivated()
    return this
  }

  /**
   * 設置活躍配置
   */
  _setActiveConfig (config) {
    this._activeConfig = config
  }

  /**
   * 建構全域 Chrome 對象
   */
  _buildChromeObject () {
    this._initializeGlobalChrome()
    this._applyAllRegisteredMocks()
  }

  /**
   * 初始化全域Chrome對象
   */
  _initializeGlobalChrome () {
    global.chrome = {}
  }

  /**
   * 應用所有已註冊的Mock
   */
  _applyAllRegisteredMocks () {
    this._mocks.forEach((mock, apiPath) => {
      this._setNestedProperty(global.chrome, apiPath, mock)
    })
  }

  /**
   * 標記為已激活
   */
  _markAsActivated () {
    this._isActivated = true
  }

  /**
   * 註冊標準 Chrome Extension API Mock
   * 提供常用API的快速註冊方法
   * @returns {ChromeAPIMockRegistry} 註冊表實例
   */
  registerStandardAPIs () {
    this._registerStorageAPIs()
    this._registerRuntimeAPIs()
    this._registerTabsAPIs()
    return this
  }

  /**
   * 註冊Storage相關API
   */
  _registerStorageAPIs () {
    this.register('storage.local', new StorageLocalMock())
    this.register('storage.sync', new StorageSyncMock())
  }

  /**
   * 註冊Runtime相關API
   */
  _registerRuntimeAPIs () {
    this.register('runtime', new RuntimeMock())
  }

  /**
   * 註冊Tabs相關API
   */
  _registerTabsAPIs () {
    this.register('tabs', new TabsMock())
  }

  /**
   * 清除所有註冊的 Mock
   * 用於測試清理和重置
   */
  clear () {
    this._clearMocksRegistry()
    this._clearGlobalChrome()
    this._resetState()
  }

  /**
   * 清除Mock註冊表
   */
  _clearMocksRegistry () {
    this._mocks.clear()
  }

  /**
   * 清除全域Chrome對象
   */
  _clearGlobalChrome () {
    if (global.chrome) {
      delete global.chrome
    }
  }

  /**
   * 重置狀態
   */
  _resetState () {
    this._activeConfig = null
    this._isActivated = false
  }

  /**
   * 檢查是否已激活
   * @returns {boolean} 是否已激活
   */
  isActivated () {
    return this._isActivated
  }

  /**
   * 獲取已註冊的 Mock 數量
   * @returns {number} Mock 數量
   */
  getMockCount () {
    return this._mocks.size
  }

  /**
   * 設置嵌套屬性
   * 輔助方法：在對象中設置嵌套屬性
   * @param {Object} obj - 目標對象
   * @param {string} path - 屬性路徑
   * @param {any} value - 屬性值
   */
  _setNestedProperty (obj, path, value) {
    const keys = this._splitPath(path)
    const target = this._navigateToParent(obj, keys)
    const finalKey = this._getFinalKey(keys)
    this._setFinalProperty(target, finalKey, value)
  }

  /**
   * 分割路徑為鍵陣列
   */
  _splitPath (path) {
    return path.split('.')
  }

  /**
   * 導航到父對象
   */
  _navigateToParent (obj, keys) {
    let current = obj
    const parentKeys = keys.slice(0, -1)

    parentKeys.forEach(key => {
      current = this._ensurePropertyExists(current, key)
    })

    return current
  }

  /**
   * 確保屬性存在
   */
  _ensurePropertyExists (obj, key) {
    if (!obj[key]) {
      obj[key] = {}
    }
    return obj[key]
  }

  /**
   * 獲取最終鍵
   */
  _getFinalKey (keys) {
    return keys[keys.length - 1]
  }

  /**
   * 設置最終屬性
   */
  _setFinalProperty (target, key, value) {
    target[key] = value
  }
}

module.exports = ChromeAPIMockRegistry
