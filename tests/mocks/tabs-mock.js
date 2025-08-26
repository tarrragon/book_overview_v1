/**
 * Tabs Mock - Chrome Tabs API 模擬
 * 遵循 Five Lines 規則和單一責任原則
 *
 * @author TDD Phase 4 - cinnamon-refactor-owl重構設計師
 * @date 2025-08-25
 * @version v0.9.38-refactor
 */

/**
 * Chrome Tabs API Mock
 * 模擬 chrome.tabs 相關功能
 */
class TabsMock {
  constructor () {
    this._initializePermissions()
    this._initializeMockTabs()
    this._initializeMethods()
  }

  /**
   * 初始化權限狀態
   */
  _initializePermissions () {
    this._permissions = {
      tabs: true,
      activeTab: true
    }
  }

  /**
   * 初始化模擬分頁
   */
  _initializeMockTabs () {
    this._tabs = [
      this._createDefaultTab(),
      this._createReadmooTab()
    ]
  }

  /**
   * 創建預設分頁
   */
  _createDefaultTab () {
    return {
      id: 1,
      url: 'https://readmoo.com/library',
      title: 'Readmoo Library',
      active: true,
      windowId: 1
    }
  }

  /**
   * 創建 Readmoo 分頁
   */
  _createReadmooTab () {
    return {
      id: 2,
      url: 'https://readmoo.com/shelf',
      title: 'My Shelf - Readmoo',
      active: false,
      windowId: 1
    }
  }

  /**
   * 初始化方法
   */
  _initializeMethods () {
    this.query = this._createQueryMethod()
    this.sendMessage = this._createSendMessageMethod()
  }

  /**
   * 創建 query 方法
   */
  _createQueryMethod () {
    return (queryInfo, callback) => {
      this._checkTabsPermission()
      const results = this._filterTabs(queryInfo)
      this._executeCallback(callback, results)
    }
  }

  /**
   * 檢查 tabs 權限
   */
  _checkTabsPermission () {
    if (!this._permissions.tabs) {
      this._setPermissionError()
    }
  }

  /**
   * 設定權限錯誤
   */
  _setPermissionError () {
    if (global.chrome?.runtime) {
      global.chrome.runtime.lastError = { message: 'Permission denied' }
    }
  }

  /**
   * 篩選分頁
   */
  _filterTabs (queryInfo) {
    if (!queryInfo) {
      return this._tabs
    }
    return this._applyFilters(queryInfo)
  }

  /**
   * 應用篩選條件
   */
  _applyFilters (queryInfo) {
    let filtered = this._tabs

    if (queryInfo.active !== undefined) {
      filtered = this._filterByActive(filtered, queryInfo.active)
    }

    if (queryInfo.url) {
      filtered = this._filterByURL(filtered, queryInfo.url)
    }

    return filtered
  }

  /**
   * 按活躍狀態篩選
   */
  _filterByActive (tabs, active) {
    return tabs.filter(tab => tab.active === active)
  }

  /**
   * 按 URL 篩選
   */
  _filterByURL (tabs, urlPattern) {
    return tabs.filter(tab => {
      return this._matchesURLPattern(tab.url, urlPattern)
    })
  }

  /**
   * 檢查 URL 是否匹配模式
   */
  _matchesURLPattern (url, pattern) {
    if (typeof pattern === 'string') {
      return url.includes(pattern)
    }
    return pattern.test && pattern.test(url)
  }

  /**
   * 創建 sendMessage 方法
   */
  _createSendMessageMethod () {
    return (tabId, message, options, callback) => {
      this._checkMessagingPermission()
      this._simulateTabMessage(tabId, message, callback)
    }
  }

  /**
   * 檢查消息權限
   */
  _checkMessagingPermission () {
    const hasPermission = this._hasMessagingPermission()
    if (!hasPermission) {
      this._setPermissionError()
    }
  }

  /**
   * 檢查是否有消息權限
   */
  _hasMessagingPermission () {
    return this._permissions.activeTab || this._permissions.tabs
  }

  /**
   * 模擬分頁消息
   */
  _simulateTabMessage (tabId, message, callback) {
    const targetTab = this._findTab(tabId)
    if (!targetTab) {
      this._handleTabNotFound(callback)
      return
    }

    this._deliverMessageToTab(message, callback)
  }

  /**
   * 尋找分頁
   */
  _findTab (tabId) {
    return this._tabs.find(tab => tab.id === tabId)
  }

  /**
   * 處理分頁未找到
   */
  _handleTabNotFound (callback) {
    if (callback) {
      this._setTabNotFoundError()
      callback()
    }
  }

  /**
   * 設定分頁未找到錯誤
   */
  _setTabNotFoundError () {
    if (global.chrome?.runtime) {
      global.chrome.runtime.lastError = { message: 'Tab not found' }
    }
  }

  /**
   * 傳遞消息到分頁
   */
  _deliverMessageToTab (message, callback) {
    if (callback) {
      this._deliverWithCallback(message, callback)
    }
  }

  /**
   * 帶回調的消息傳遞
   */
  _deliverWithCallback (message, callback) {
    setTimeout(() => {
      this._clearLastError()
      callback({ success: true })
    }, 10)
  }

  /**
   * 清除最後錯誤
   */
  _clearLastError () {
    if (global.chrome?.runtime) {
      global.chrome.runtime.lastError = null
    }
  }

  /**
   * 執行回調函數
   */
  _executeCallback (callback, result) {
    if (callback && typeof callback === 'function') {
      setTimeout(() => callback(result), 0)
    }
  }

  /**
   * 撤銷權限（測試用）
   */
  revokePermission (permission) {
    this._permissions[permission] = false
  }

  /**
   * 恢復權限（測試用）
   */
  restorePermission (permission) {
    this._permissions[permission] = true
  }
}

module.exports = TabsMock
