/**
 * Chrome Extension Enhanced Mocks V2 - Stage 3整合測試專用
 * 基於現有ChromeExtensionMocksEnhanced擴展，專門為整合測試優化
 * 
 * 新功能:
 * - 完整的Chrome Storage API模擬 (local, sync, managed)  
 * - 增強的Chrome Tabs API支援
 * - Service Worker生命週期模擬
 * - 跨上下文通訊測試支援
 * - 狀態一致性驗證
 *
 * @author Stage 3 TDD 主線程實作
 * @date 2025-08-27  
 * @version v0.9.45
 */

const ChromeExtensionMocksEnhanced = require('./chrome-extension-mocks-enhanced')

class ChromeExtensionMocksEnhancedV2 extends ChromeExtensionMocksEnhanced {
  constructor() {
    super()
    this._initializeV2Features()
  }

  /**
   * 初始化V2新功能
   */
  _initializeV2Features() {
    this._setupStorageAPIEnhancement()
    this._setupTabsAPIEnhancement()
    this._setupRuntimeAPIEnhancement()
    this._setupServiceWorkerLifecycle()
  }

  /**
   * 完整的Storage API增強
   */
  _setupStorageAPIEnhancement() {
    this._storageState = {
      local: new Map(),
      sync: new Map(),
      managed: new Map()
    }
    
    this._storageListeners = {
      local: [],
      sync: [],
      managed: []
    }
  }

  /**
   * Tabs API增強
   */
  _setupTabsAPIEnhancement() {
    this._tabsState = {
      tabs: new Map(),
      activeTabId: 1,
      nextTabId: 2
    }
    
    this._messageHandlers = new Map()
  }

  /**
   * Runtime API增強  
   */
  _setupRuntimeAPIEnhancement() {
    this._runtimeState = {
      listeners: new Map(),
      ports: new Map(),
      lastError: null
    }
  }

  /**
   * Service Worker生命週期模擬
   */
  _setupServiceWorkerLifecycle() {
    this._serviceWorkerState = {
      isActive: true,
      installPromise: Promise.resolve(),
      activatePromise: Promise.resolve()
    }
  }

  /**
   * 創建完整的Chrome API Mock
   */
  createCompleteChromeAPI() {
    return {
      storage: this._createStorageAPIMock(),
      tabs: this._createTabsAPIMock(),
      runtime: this._createRuntimeAPIMock(),
      extension: this._createExtensionAPIMock()
    }
  }

  /**
   * 創建Storage API Mock
   */
  _createStorageAPIMock() {
    return {
      local: this._createStorageAreaMock('local'),
      sync: this._createStorageAreaMock('sync'),
      managed: this._createStorageAreaMock('managed'),
      onChanged: this._createStorageOnChangedMock()
    }
  }

  /**
   * 創建Storage Area Mock
   */
  _createStorageAreaMock(areaName) {
    const storage = this._storageState[areaName]
    
    return {
      get: jest.fn((keys, callback) => {
        const result = this._getStorageData(storage, keys)
        if (callback) callback(result)
        return Promise.resolve(result)
      }),
      
      set: jest.fn((items, callback) => {
        this._setStorageData(storage, items, areaName)
        if (callback) callback()
        return Promise.resolve()
      }),
      
      remove: jest.fn((keys, callback) => {
        this._removeStorageData(storage, keys, areaName)
        if (callback) callback()
        return Promise.resolve()
      }),
      
      clear: jest.fn((callback) => {
        this._clearStorageData(storage, areaName)
        if (callback) callback()
        return Promise.resolve()
      })
    }
  }

  /**
   * 獲取Storage資料
   */
  _getStorageData(storage, keys) {
    if (!keys) return Object.fromEntries(storage)
    
    const keyArray = Array.isArray(keys) ? keys : [keys]
    const result = {}
    
    keyArray.forEach(key => {
      if (storage.has(key)) {
        result[key] = storage.get(key)
      }
    })
    
    return result
  }

  /**
   * 設定Storage資料
   */
  _setStorageData(storage, items, areaName) {
    Object.entries(items).forEach(([key, value]) => {
      const oldValue = storage.get(key)
      storage.set(key, value)
      
      this._triggerStorageChange(key, value, oldValue, areaName)
    })
  }

  /**
   * 移除Storage資料
   */
  _removeStorageData(storage, keys, areaName) {
    const keyArray = Array.isArray(keys) ? keys : [keys]
    
    keyArray.forEach(key => {
      if (storage.has(key)) {
        const oldValue = storage.get(key)
        storage.delete(key)
        
        this._triggerStorageChange(key, undefined, oldValue, areaName)
      }
    })
  }

  /**
   * 清空Storage資料
   */
  _clearStorageData(storage, areaName) {
    const oldEntries = Object.fromEntries(storage)
    storage.clear()
    
    Object.keys(oldEntries).forEach(key => {
      this._triggerStorageChange(key, undefined, oldEntries[key], areaName)
    })
  }

  /**
   * 觸發Storage變更事件
   */
  _triggerStorageChange(key, newValue, oldValue, areaName) {
    const changes = {
      [key]: { newValue, oldValue }
    }
    
    this._storageListeners[areaName].forEach(listener => {
      listener(changes, areaName)
    })
  }

  /**
   * 創建Storage onChanged Mock
   */
  _createStorageOnChangedMock() {
    return {
      addListener: jest.fn((listener) => {
        this._storageListeners.local.push(listener)
        this._storageListeners.sync.push(listener)
        this._storageListeners.managed.push(listener)
      }),
      
      removeListener: jest.fn((listener) => {
        Object.keys(this._storageListeners).forEach(area => {
          const index = this._storageListeners[area].indexOf(listener)
          if (index > -1) {
            this._storageListeners[area].splice(index, 1)
          }
        })
      })
    }
  }

  /**
   * 創建Tabs API Mock
   */
  _createTabsAPIMock() {
    return {
      query: jest.fn((queryInfo, callback) => {
        const results = this._queryTabs(queryInfo)
        if (callback) callback(results)
        return Promise.resolve(results)
      }),
      
      sendMessage: jest.fn((tabId, message, callback) => {
        return this._sendTabMessage(tabId, message, callback)
      }),
      
      executeScript: jest.fn((tabId, details, callback) => {
        const result = this._executeScript(tabId, details)
        if (callback) callback(result)
        return Promise.resolve(result)
      }),
      
      create: jest.fn((createProperties, callback) => {
        const tab = this._createTab(createProperties)
        if (callback) callback(tab)
        return Promise.resolve(tab)
      })
    }
  }

  /**
   * 查詢標籤頁
   */
  _queryTabs(queryInfo) {
    const allTabs = Array.from(this._tabsState.tabs.values())
    
    return allTabs.filter(tab => {
      return this._matchesTabQuery(tab, queryInfo)
    })
  }

  /**
   * 檢查標籤頁是否符合查詢條件
   */
  _matchesTabQuery(tab, queryInfo) {
    if (queryInfo.active !== undefined && tab.active !== queryInfo.active) {
      return false
    }
    
    if (queryInfo.url && !tab.url.includes(queryInfo.url)) {
      return false
    }
    
    return true
  }

  /**
   * 發送標籤頁訊息
   */
  _sendTabMessage(tabId, message, callback) {
    const handler = this._messageHandlers.get(tabId)
    
    if (handler) {
      const response = handler(message)
      if (callback) callback(response)
      return Promise.resolve(response)
    }
    
    if (callback) callback(undefined)
    return Promise.resolve(undefined)
  }

  /**
   * 執行腳本
   */
  _executeScript(tabId, details) {
    // 模擬腳本執行結果
    return [{ result: 'script executed' }]
  }

  /**
   * 創建新標籤頁
   */
  _createTab(createProperties) {
    const tabId = this._tabsState.nextTabId++
    const tab = {
      id: tabId,
      url: createProperties.url || 'about:blank',
      active: createProperties.active !== false,
      windowId: 1,
      index: 0
    }
    
    this._tabsState.tabs.set(tabId, tab)
    return tab
  }

  /**
   * 創建Runtime API Mock
   */
  _createRuntimeAPIMock() {
    return {
      sendMessage: jest.fn((message, callback) => {
        return this._sendRuntimeMessage(message, callback)
      }),
      
      onMessage: this._createRuntimeOnMessageMock(),
      
      getManifest: jest.fn(() => ({
        name: 'Test Extension',
        version: '1.0.0',
        manifest_version: 3
      })),
      
      id: 'test-extension-id',
      
      lastError: null
    }
  }

  /**
   * 發送Runtime訊息
   */
  _sendRuntimeMessage(message, callback) {
    const listeners = this._runtimeState.listeners.get('message') || []
    
    if (listeners.length > 0) {
      const response = listeners[0](message)
      if (callback) callback(response)
      return Promise.resolve(response)
    }
    
    if (callback) callback(undefined)
    return Promise.resolve(undefined)
  }

  /**
   * 創建Runtime onMessage Mock
   */
  _createRuntimeOnMessageMock() {
    return {
      addListener: jest.fn((listener) => {
        const listeners = this._runtimeState.listeners.get('message') || []
        listeners.push(listener)
        this._runtimeState.listeners.set('message', listeners)
      }),
      
      removeListener: jest.fn((listener) => {
        const listeners = this._runtimeState.listeners.get('message') || []
        const index = listeners.indexOf(listener)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      })
    }
  }

  /**
   * 創建Extension API Mock
   */
  _createExtensionAPIMock() {
    return {
      getURL: jest.fn((path) => `chrome-extension://test-id/${path}`),
      getBackgroundPage: jest.fn(() => window),
      getViews: jest.fn(() => [window])
    }
  }

  /**
   * 重置所有狀態
   */
  resetAllStates() {
    super.resetToDefaults()
    this._resetV2States()
  }

  /**
   * 重置V2狀態
   */
  _resetV2States() {
    this._resetStorageState()
    this._resetTabsState()
    this._resetRuntimeState()
    this._resetServiceWorkerState()
  }

  /**
   * 重置Storage狀態
   */
  _resetStorageState() {
    this._storageState.local.clear()
    this._storageState.sync.clear()
    this._storageState.managed.clear()
    
    this._storageListeners.local = []
    this._storageListeners.sync = []
    this._storageListeners.managed = []
  }

  /**
   * 重置Tabs狀態
   */
  _resetTabsState() {
    this._tabsState.tabs.clear()
    this._tabsState.activeTabId = 1
    this._tabsState.nextTabId = 2
    this._messageHandlers.clear()
  }

  /**
   * 重置Runtime狀態
   */
  _resetRuntimeState() {
    this._runtimeState.listeners.clear()
    this._runtimeState.ports.clear()
    this._runtimeState.lastError = null
  }

  /**
   * 重置Service Worker狀態
   */
  _resetServiceWorkerState() {
    this._serviceWorkerState.isActive = true
    this._serviceWorkerState.installPromise = Promise.resolve()
    this._serviceWorkerState.activatePromise = Promise.resolve()
  }

  /**
   * 驗證Mock狀態一致性
   */
  validateMockConsistency() {
    const issues = []
    
    issues.push(...this._validateStorageConsistency())
    issues.push(...this._validateTabsConsistency())
    issues.push(...this._validateRuntimeConsistency())
    
    return {
      isValid: issues.length === 0,
      issues: issues
    }
  }

  /**
   * 驗證Storage一致性
   */
  _validateStorageConsistency() {
    const issues = []
    
    Object.keys(this._storageState).forEach(area => {
      const storage = this._storageState[area]
      if (!(storage instanceof Map)) {
        issues.push(`Storage ${area} is not a Map instance`)
      }
    })
    
    return issues
  }

  /**
   * 驗證Tabs一致性
   */
  _validateTabsConsistency() {
    const issues = []
    
    const { tabs, nextTabId } = this._tabsState
    const maxTabId = Math.max(...Array.from(tabs.keys()), 0)
    
    if (nextTabId <= maxTabId) {
      issues.push('Next tab ID should be greater than max existing tab ID')
    }
    
    return issues
  }

  /**
   * 驗證Runtime一致性
   */
  _validateRuntimeConsistency() {
    const issues = []
    
    if (!(this._runtimeState.listeners instanceof Map)) {
      issues.push('Runtime listeners is not a Map instance')
    }
    
    return issues
  }

  /**
   * 設定訊息處理器
   */
  setTabMessageHandler(tabId, handler) {
    this._messageHandlers.set(tabId, handler)
  }

  /**
   * 模擬Service Worker安裝
   */
  async simulateServiceWorkerInstall() {
    this._serviceWorkerState.isActive = false
    await this._serviceWorkerState.installPromise
    this._serviceWorkerState.isActive = true
  }

  /**
   * 模擬Service Worker重啟
   */
  async simulateServiceWorkerRestart() {
    this._serviceWorkerState.isActive = false
    this._resetV2States()
    await this._serviceWorkerState.activatePromise
    this._serviceWorkerState.isActive = true
  }

  /**
   * 獲取當前狀態快照
   */
  getStateSnapshot() {
    return {
      storage: {
        local: Object.fromEntries(this._storageState.local),
        sync: Object.fromEntries(this._storageState.sync),
        managed: Object.fromEntries(this._storageState.managed)
      },
      tabs: {
        tabs: Object.fromEntries(this._tabsState.tabs),
        activeTabId: this._tabsState.activeTabId,
        nextTabId: this._tabsState.nextTabId
      },
      runtime: {
        listenerCount: this._runtimeState.listeners.size,
        portCount: this._runtimeState.ports.size
      },
      serviceWorker: {
        isActive: this._serviceWorkerState.isActive
      }
    }
  }
}

module.exports = ChromeExtensionMocksEnhancedV2