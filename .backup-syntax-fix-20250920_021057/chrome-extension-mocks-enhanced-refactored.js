/**
 * Chrome Extension Enhanced Mocks - 重構版
 * 遵循 Five Lines 規則和單一責任原則
 * 使用統一的Mock基礎設施，提高代碼重用性
 *
 * @author TDD Phase 4 - cinnamon-refactor-owl重構設計師（重構）
 * @original-author TDD Phase 3 - pepper-test-implementer規劃
 * @date 2025-08-25
 * @version v0.9.38-refactor
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

const ChromeAPIMockRegistry = require('../infrastructure/chrome-api-mock-registry')

/**
 * Chrome Extension Enhanced Mocks - 重構版
 * 使用統一的Mock註冊表，符合五行規則
 */
class ChromeExtensionMocksEnhanced {
  constructor () {
    this._initializeRegistry()
    this._initializeState()
    this._initializeConfiguration()
  }

  /**
   * 初始化Mock註冊表
   */
  _initializeRegistry () {
    this._registry = new ChromeAPIMockRegistry()
  }

  /**
   * 初始化狀態
   */
  _initializeState () {
    this._isInitialized = false
    this._activeConfig = {}
  }

  /**
   * 初始化配置
   */
  _initializeConfiguration () {
    this.resetToDefaults()
  }

  /**
   * 初始化所有Chrome API Mock
   */
  initializeAll () {
    this._registerAllAPIs()
    this._activateAPIs()
    this._markAsInitialized()
  }

  /**
   * 註冊所有API
   */
  _registerAllAPIs () {
    this._registry.registerStandardAPIs()
  }

  /**
   * 激活API
   */
  _activateAPIs () {
    this._registry.activate(this._activeConfig)
  }

  /**
   * 標記為已初始化
   */
  _markAsInitialized () {
    this._isInitialized = true
  }

  /**
   * 重設為預設狀態
   */
  resetToDefaults () {
    this._resetQuotaSettings()
    this._resetPermissionSettings()
    this._resetContextSettings()
  }

  /**
   * 重設配額設定
   */
  _resetQuotaSettings () {
    this.storageQuota = {
      used: 0,
      total: 5242880 // 5MB
    }
  }

  /**
   * 重設權限設定
   */
  _resetPermissionSettings () {
    this.permissions = {
      storage: true,
      tabs: true,
      activeTab: true
    }
  }

  /**
   * 重設上下文設定
   */
  _resetContextSettings () {
    this.contextValid = true
    this.storageEnabled = true
  }

  /**
   * 模擬權限被撤銷
   * @param {string} permission - 權限名稱
   */
  revokePermission (permission) {
    this._validatePermissionName(permission)
    this._setPermissionStatus(permission, false)
  }

  /**
   * 驗證權限名稱
   */
  _validatePermissionName (permission) {
    if (!permission || typeof permission !== 'string') {
      throw (() => { const error = new Error( 'Permission name must be a non-empty string'); error.code = ErrorCodes.PERMISSION_DENIED; error.details =  { category: 'testing' }; return error })()
    }
  }

  /**
   * 設定權限狀態
   */
  _setPermissionStatus (permission, status) {
    this.permissions[permission] = status
  }

  /**
   * 模擬擴展上下文失效
   */
  invalidateContext () {
    this.contextValid = false
  }

  /**
   * 模擬存儲配額超限
   * @param {number} usedBytes - 已使用位元組數
   */
  setStorageQuotaUsed (usedBytes) {
    this._validateUsedBytes(usedBytes)
    this._updateQuotaUsage(usedBytes)
  }

  /**
   * 驗證使用量參數
   */
  _validateUsedBytes (usedBytes) {
    if (typeof usedBytes !== 'number' || usedBytes < 0) {
      throw (() => { const error = new Error( 'Used bytes must be a non-negative number'); error.code = ErrorCodes.TEST_ERROR; error.details =  { category: 'testing' }; return error })()
    }
  }

  /**
   * 更新配額使用量
   */
  _updateQuotaUsage (usedBytes) {
    this.storageQuota.used = Math.min(usedBytes, this.storageQuota.total)
  }

  /**
   * 獲取當前儲存使用情況
   * @returns {Object} 儲存配額資訊
   */
  getStorageQuota () {
    return this._copyQuotaInfo()
  }

  /**
   * 複製配額資訊
   */
  _copyQuotaInfo () {
    return { ...this.storageQuota }
  }

  /**
   * 檢查是否已初始化
   * @returns {boolean}
   */
  isInitialized () {
    return this._isInitialized
  }

  /**
   * 獲取Mock註冊表
   * @returns {ChromeAPIMockRegistry}
   */
  getRegistry () {
    return this._registry
  }

  /**
   * 清理所有Mock
   */
  cleanup () {
    this._cleanupRegistry()
    this._resetAllState()
  }

  /**
   * 清理註冊表
   */
  _cleanupRegistry () {
    if (this._registry) {
      this._registry.clear()
    }
  }

  /**
   * 重設所有狀態
   */
  _resetAllState () {
    this._isInitialized = false
    this._activeConfig = {}
    this.resetToDefaults()
  }

  // 兼容性方法 - 保持向後兼容

  /**
   * 設置基本Mock（兼容舊API）
   * @deprecated 請使用 initializeAll() 替代
   */
  setupBasicMocks () {
    // eslint-disable-next-line no-console
    console.warn('setupBasicMocks() is deprecated. Use initializeAll() instead.')
    this.initializeAll()
  }

  /**
   * 獲取Chrome對象（兼容舊API）
   * @deprecated Chrome對象現在自動在global中可用
   * @returns {Object}
   */
  getChrome () {
    // eslint-disable-next-line no-console
    console.warn('getChrome() is deprecated. Use global.chrome directly.')
    return global.chrome
  }
}

module.exports = ChromeExtensionMocksEnhanced
