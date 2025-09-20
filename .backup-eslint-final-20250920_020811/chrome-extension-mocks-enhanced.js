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

class ChromeExtensionMocksEnhanced {
  constructor () {
    this._initializeRegistry()
    this._initializeDefaultState()
  }

  /**
   * 初始化Mock註冊表
   */
  _initializeRegistry () {
    this._registry = new ChromeAPIMockRegistry()
  }

  /**
   * 初始化預設狀態
   */
  _initializeDefaultState () {
    this.resetToDefaults()
  }

  /**
   * 初始化所有Chrome API Mock
   */
  initializeAll () {
    this._registerStandardAPIs()
    this._activateRegistry()
    this._applyDefaultConfiguration()
  }

  /**
   * 註冊標準API
   */
  _registerStandardAPIs () {
    this._registry.registerStandardAPIs()
  }

  /**
   * 激活註冊表
   */
  _activateRegistry () {
    this._registry.activate()
  }

  /**
   * 應用預設配置
   */
  _applyDefaultConfiguration () {
    this._configurePermissions()
    this._configureQuotas()
  }

  /**
   * 配置權限
   */
  _configurePermissions () {
    // 權限配置邏輯
  }

  /**
   * 配置配額
   */
  _configureQuotas () {
    // 配額配置邏輯
  }

  /**
   * 重設為預設狀態
   */
  resetToDefaults () {
    this._initializeQuotaSettings()
    this._initializePermissionSettings()
    this._initializeContextSettings()
  }

  /**
   * 初始化配額設定
   */
  _initializeQuotaSettings () {
    this.storageQuota = {
      used: 0,
      total: 5242880 // 5MB預設限制
    }
  }

  /**
   * 初始化權限設定
   */
  _initializePermissionSettings () {
    this.permissions = {
      storage: true,
      tabs: true,
      activeTab: true
    }
  }

  /**
   * 初始化上下文設定
   */
  _initializeContextSettings () {
    this.contextValid = true
    this.storageEnabled = true
  }

  /**
   * 設置基礎Chrome物件
   * @private
   */
  _setupChrome () {
    if (!global.chrome) {
      global.chrome = {}
    }

    // Chrome基本API
    global.chrome.runtime = global.chrome.runtime || {}
    global.chrome.storage = global.chrome.storage || {}
    global.chrome.tabs = global.chrome.tabs || {}
    global.chrome.permissions = global.chrome.permissions || {}
  }

  /**
   * 設置Storage API Mock
   * @private
   */
  _setupStorageAPI () {
    this.storageData = new Map()

    global.chrome.storage.local = {
      get: (keys, callback) => {
        // 模擬權限被撤銷
        if (!this.permissions.storage) {
          const error = new Error('Extension context invalidated')
          if (callback) callback({})
          else return Promise.reject(error)
          return
        }

        // 模擬擴展上下文失效
        if (!this.contextValid) {
          const error = new Error('Extension context invalidated')
          if (callback) callback({})
          else return Promise.reject(error)
          return
        }

        const result = {}
        if (typeof keys === 'string') {
          result[keys] = this.storageData.get(keys)
        } else if (Array.isArray(keys)) {
          keys.forEach(key => {
            result[key] = this.storageData.get(key)
          })
        } else if (typeof keys === 'object' && keys !== null) {
          Object.keys(keys).forEach(key => {
            result[key] = this.storageData.get(key) ?? keys[key]
          })
        } else {
          // 獲取所有資料
          for (const [key, value] of this.storageData) {
            result[key] = value
          }
        }

        if (callback) {
          setTimeout(() => callback(result), 0)
        } else {
          return Promise.resolve(result)
        }
      },

      set: (items, callback) => {
        const permissionError = this._checkStoragePermission()
        if (permissionError) return this._handleStorageError(permissionError, callback)

        const quotaError = this._checkStorageQuota(items)
        if (quotaError) return this._handleStorageError(quotaError, callback)

        this._storeItems(items)
        return this._completeStorageOperation(callback)
      },

      remove: (keys, callback) => {
        if (!this.permissions.storage) {
          const error = new Error('Permission denied')
          if (callback) callback()
          else return Promise.reject(error)
          return
        }

        const keysToRemove = Array.isArray(keys) ? keys : [keys]
        keysToRemove.forEach(key => {
          const value = this.storageData.get(key)
          if (value !== undefined) {
            this.storageQuota.used -= JSON.stringify({ [key]: value }).length
            this.storageData.delete(key)
          }
        })

        if (callback) {
          setTimeout(callback, 0)
        } else {
          return Promise.resolve()
        }
      },

      clear: (callback) => {
        if (!this.permissions.storage) {
          const error = new Error('Permission denied')
          if (callback) callback()
          else return Promise.reject(error)
          return
        }

        this.storageData.clear()
        this.storageQuota.used = 0

        if (callback) {
          setTimeout(callback, 0)
        } else {
          return Promise.resolve()
        }
      },

      getBytesInUse: (keys, callback) => {
        let size = 0
        if (keys) {
          const keysToCheck = Array.isArray(keys) ? keys : [keys]
          keysToCheck.forEach(key => {
            const value = this.storageData.get(key)
            if (value !== undefined) {
              size += JSON.stringify({ [key]: value }).length
            }
          })
        } else {
          size = this.storageQuota.used
        }

        if (callback) {
          setTimeout(() => callback(size), 0)
        } else {
          return Promise.resolve(size)
        }
      }
    }
  }

  /**
   * 設置Runtime API Mock
   * @private
   */
  _setupRuntimeAPI () {
    // 兼容jest-chrome的lastError設定
    if (global.chrome.runtime.lastError !== undefined) {
      try {
        global.chrome.runtime.lastError = null
      } catch (error) {
        // 忽略jest-chrome的型別檢查錯誤，使用descriptor重新定義
        Object.defineProperty(global.chrome.runtime, 'lastError', {
          value: null,
          writable: true,
          configurable: true
        })
      }
    } else {
      global.chrome.runtime.lastError = null
    }

    global.chrome.runtime.sendMessage = (extensionId, message, options, callback) => {
      // 參數處理 (extensionId可選)
      if (typeof extensionId !== 'string') {
        callback = options
        options = message
        message = extensionId
        extensionId = null
      }

      // 模擬擴展上下文失效
      if (!this.contextValid) {
        if (callback) {
          global.chrome.runtime.lastError = { message: 'Extension context invalidated' }
          setTimeout(() => callback(), 0)
        }
        return
      }

      // 模擬訊息傳遞
      if (callback) {
        setTimeout(() => {
          global.chrome.runtime.lastError = null
          callback({ success: true, echo: message })
        }, 10)
      }
    }

    global.chrome.runtime.connect = (extensionId, connectInfo) => {
      if (!this.contextValid) {
        throw (() => { const error = new Error( 'Extension context invalidated'); error.code = ErrorCodes.'VALIDATION_FAILED'; error.details =  { category: 'testing' }; return error })()
      }

      return {
        name: connectInfo?.name || 'default',
        sender: null,
        onMessage: {
          addListener: () => {},
          removeListener: () => {}
        },
        onDisconnect: {
          addListener: () => {},
          removeListener: () => {}
        },
        postMessage: (message) => {
          if (!this.contextValid) {
            throw (() => { const error = new Error( 'Port disconnected'); error.code = ErrorCodes.'TEST_ERROR'; error.details =  { category: 'testing' }; return error })()
          }
        },
        disconnect: () => {}
      }
    }

    global.chrome.runtime.getURL = (path) => {
      if (!this.contextValid) {
        throw (() => { const error = new Error( 'Extension context invalidated'); error.code = ErrorCodes.'VALIDATION_FAILED'; error.details =  { category: 'testing' }; return error })()
      }
      return `chrome-extension://test-extension-id/${path}`
    }
  }

  /**
   * 設置Tabs API Mock
   * @private
   */
  _setupTabsAPI () {
    global.chrome.tabs.query = (queryInfo, callback) => {
      if (!this.permissions.tabs) {
        if (callback) {
          global.chrome.runtime.lastError = { message: 'Permission denied' }
          callback([])
        }
        return
      }

      const mockTabs = [
        {
          id: 1,
          url: 'https://readmoo.com/library',
          title: 'Readmoo Library',
          active: true,
          windowId: 1
        }
      ]

      if (callback) {
        setTimeout(() => {
          global.chrome.runtime.lastError = null
          callback(mockTabs)
        }, 0)
      }
    }

    global.chrome.tabs.sendMessage = (tabId, message, options, callback) => {
      if (!this.permissions.activeTab && !this.permissions.tabs) {
        if (callback) {
          global.chrome.runtime.lastError = { message: 'Permission denied' }
          callback()
        }
        return
      }

      if (callback) {
        setTimeout(() => {
          global.chrome.runtime.lastError = null
          callback({ success: true })
        }, 10)
      }
    }
  }

  /**
   * 設置Permissions API Mock
   * @private
   */
  _setupPermissionsAPI () {
    global.chrome.permissions.contains = (permissions, callback) => {
      const hasPermissions = permissions.permissions?.every(perm => this.permissions[perm]) ?? true

      if (callback) {
        setTimeout(() => callback(hasPermissions), 0)
      } else {
        return Promise.resolve(hasPermissions)
      }
    }

    global.chrome.permissions.request = (permissions, callback) => {
      // 模擬使用者拒絕權限
      const granted = Math.random() > 0.3 // 70%機會獲得權限

      if (granted && permissions.permissions) {
        permissions.permissions.forEach(perm => {
          this.permissions[perm] = true
        })
      }

      if (callback) {
        setTimeout(() => callback(granted), 100) // 模擬使用者思考時間
      } else {
        return Promise.resolve(granted)
      }
    }
  }

  /**
   * 模擬權限被撤銷
   * @param {string} permission - 權限名稱
   */
  revokePermission (permission) {
    this.permissions[permission] = false
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
    this.storageQuota.used = Math.min(usedBytes, this.storageQuota.total)
  }

  /**
   * 獲取當前儲存使用情況
   */
  getStorageQuota () {
    return { ...this.storageQuota }
  }

  /**
   * 檢查儲存權限
   * @private
   */
  _checkStoragePermission () {
    return !this.permissions.storage ? 'Permission denied' : null
  }

  /**
   * 檢查儲存配額
   * @private
   */
  _checkStorageQuota (items) {
    const newDataSize = JSON.stringify(items).length
    const wouldExceedQuota = this.storageQuota.used + newDataSize > this.storageQuota.total
    return wouldExceedQuota ? 'Quota exceeded' : null
  }

  /**
   * 處理儲存錯誤
   * @private
   */
  _handleStorageError (errorMessage, callback) {
    const error = new Error(errorMessage)
    if (callback) {
      global.chrome.runtime.lastError = { message: errorMessage }
      callback()
    } else {
      return Promise.reject(error)
    }
  }

  /**
   * 儲存項目
   * @private
   */
  _storeItems (items) {
    Object.entries(items).forEach(([key, value]) => {
      this.storageData.set(key, value)
    })
    this.storageQuota.used += JSON.stringify(items).length
  }

  /**
   * 完成儲存操作
   * @private
   */
  _completeStorageOperation (callback) {
    if (callback) {
      setTimeout(callback, 0)
    } else {
      return Promise.resolve()
    }
  }
}

module.exports = ChromeExtensionMocksEnhanced
