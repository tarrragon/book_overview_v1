/**
 * Chrome Mock Factory - 集中的 Chrome API Mock 工廠
 * 提供 createCompleteChromeAPIMock(overrides) 函式，統一測試環境的 Chrome API mock
 *
 * 涵蓋的 Chrome API：
 * - chrome.runtime (sendMessage, onMessage, onInstalled, onStartup, getManifest, getURL, id, lastError, reload)
 * - chrome.storage (local, sync, onChanged)
 * - chrome.tabs (query, get, create, update, remove, sendMessage, onUpdated, onCreated, onRemoved)
 * - chrome.action (setBadgeText, getBadgeText, setBadgeBackgroundColor, setTitle, setIcon)
 * - chrome.permissions (request, contains, remove, onAdded, onRemoved)
 * - chrome.scripting (executeScript)
 * - chrome.webNavigation (onBeforeNavigate, onCommitted, onCompleted, onErrorOccurred, onHistoryStateUpdated)
 *
 * 設計考量：
 * - 每個方法使用 jest.fn() 建立，支援 mock 斷言
 * - 支援 overrides 參數讓個別測試自訂行為
 * - 與既有 jest-chrome 基礎相容
 * - 提供完整的事件監聽器模式 (addListener/removeListener/hasListener)
 */

// -- 事件介面工廠 --

/**
 * 建立標準的 Chrome 事件介面 (addListener, removeListener, hasListener)
 * @returns {Object} 事件介面物件
 */
function createEventInterface () {
  const listeners = []

  return {
    addListener: jest.fn((listener) => {
      listeners.push(listener)
    }),
    removeListener: jest.fn((listener) => {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }),
    hasListener: jest.fn((listener) => {
      return listeners.includes(listener)
    }),
    // 測試用：觸發所有已註冊的監聽器
    _trigger: (...args) => {
      listeners.forEach(listener => listener(...args))
    },
    // 測試用：取得所有監聽器
    _getListeners: () => [...listeners],
    // 測試用：清除所有監聽器
    _clearListeners: () => {
      listeners.length = 0
    }
  }
}

// -- 各 API 命名空間工廠 --

/**
 * 建立 chrome.runtime mock
 */
function createRuntimeMock () {
  return {
    id: 'test-extension-id',
    lastError: null,
    getManifest: jest.fn(() => ({
      name: 'Test Extension',
      version: '1.0.0',
      manifest_version: 3
    })),
    sendMessage: jest.fn(),
    getURL: jest.fn((path) => `chrome-extension://test-extension-id/${path}`),
    reload: jest.fn(),
    onMessage: createEventInterface(),
    onInstalled: createEventInterface(),
    onStartup: createEventInterface()
  }
}

/**
 * 建立 chrome.storage.local mock（帶預設實作）
 */
function createStorageLocalMock () {
  return {
    get: jest.fn((keys, callback) => {
      const result = {}
      if (typeof keys === 'string') {
        result[keys] = null
      } else if (Array.isArray(keys)) {
        keys.forEach(key => { result[key] = null })
      }
      if (callback) callback(result)
    }),
    set: jest.fn((items, callback) => {
      if (callback) callback()
    }),
    remove: jest.fn((keys, callback) => {
      if (callback) callback()
    }),
    clear: jest.fn((callback) => {
      if (callback) callback()
    }),
    getBytesInUse: jest.fn((keys, callback) => {
      if (callback) callback(0)
    })
  }
}

/**
 * 建立 chrome.storage.sync mock
 */
function createStorageSyncMock () {
  return {
    get: jest.fn((keys, callback) => {
      const result = {}
      if (typeof keys === 'string') {
        result[keys] = null
      }
      if (callback) callback(result)
    }),
    set: jest.fn((items, callback) => {
      if (callback) callback()
    }),
    remove: jest.fn((keys, callback) => {
      if (callback) callback()
    }),
    clear: jest.fn((callback) => {
      if (callback) callback()
    })
  }
}

/**
 * 建立 chrome.storage mock
 */
function createStorageMock () {
  return {
    local: createStorageLocalMock(),
    sync: createStorageSyncMock(),
    onChanged: createEventInterface()
  }
}

/**
 * 建立 chrome.tabs mock
 */
function createTabsMock () {
  return {
    query: jest.fn((queryInfo, callback) => {
      const defaultTabs = [{
        id: 1,
        url: 'https://readmoo.com/library',
        title: 'Readmoo',
        active: true
      }]
      if (callback) callback(defaultTabs)
    }),
    get: jest.fn((tabId, callback) => {
      if (callback) callback(null)
    }),
    create: jest.fn((createProperties, callback) => {
      const newTab = {
        id: 999,
        url: createProperties.url || 'chrome://newtab/',
        active: createProperties.active !== false,
        title: 'New Tab'
      }
      if (callback) callback(newTab)
    }),
    update: jest.fn((tabId, updateProperties, callback) => {
      if (callback) callback({ id: tabId, ...updateProperties })
    }),
    remove: jest.fn((tabIds, callback) => {
      if (callback) callback()
    }),
    sendMessage: jest.fn(),
    onUpdated: createEventInterface(),
    onCreated: createEventInterface(),
    onRemoved: createEventInterface()
  }
}

/**
 * 建立 chrome.action mock (Manifest V3)
 */
function createActionMock () {
  return {
    setBadgeText: jest.fn((details, callback) => {
      if (callback) callback()
    }),
    getBadgeText: jest.fn((details, callback) => {
      if (callback) callback('')
    }),
    setBadgeBackgroundColor: jest.fn((details, callback) => {
      if (callback) callback()
    }),
    setTitle: jest.fn((details, callback) => {
      if (callback) callback()
    }),
    setIcon: jest.fn((details, callback) => {
      if (callback) callback()
    })
  }
}

/**
 * 建立 chrome.permissions mock
 */
function createPermissionsMock () {
  return {
    request: jest.fn((permissions, callback) => {
      if (callback) callback(true)
    }),
    contains: jest.fn((permissions, callback) => {
      if (callback) callback(true)
    }),
    remove: jest.fn((permissions, callback) => {
      if (callback) callback(true)
    }),
    getAll: jest.fn((callback) => {
      if (callback) callback({ permissions: [], origins: [] })
    }),
    onAdded: createEventInterface(),
    onRemoved: createEventInterface()
  }
}

/**
 * 建立 chrome.scripting mock (Manifest V3)
 */
function createScriptingMock () {
  return {
    executeScript: jest.fn(() => Promise.resolve([{ result: undefined }])),
    insertCSS: jest.fn(() => Promise.resolve()),
    removeCSS: jest.fn(() => Promise.resolve())
  }
}

/**
 * 建立 chrome.webNavigation mock
 */
function createWebNavigationMock () {
  return {
    onBeforeNavigate: createEventInterface(),
    onCommitted: createEventInterface(),
    onCompleted: createEventInterface(),
    onErrorOccurred: createEventInterface(),
    onHistoryStateUpdated: createEventInterface(),
    getFrame: jest.fn((details, callback) => {
      if (callback) callback(null)
    }),
    getAllFrames: jest.fn((details, callback) => {
      if (callback) callback([])
    })
  }
}

// -- 主要工廠函式 --

/**
 * 建立完整的 Chrome API Mock
 *
 * @param {Object} overrides - 覆蓋預設 mock 的自訂設定，支援深層合併
 *   範例：
 *   - { runtime: { id: 'custom-id' } }
 *   - { storage: { local: { get: jest.fn(...) } } }
 *   - { tabs: { query: jest.fn(...) } }
 * @returns {Object} 完整的 chrome mock 物件
 */
function createCompleteChromeAPIMock (overrides = {}) {
  const baseMock = {
    runtime: createRuntimeMock(),
    storage: createStorageMock(),
    tabs: createTabsMock(),
    action: createActionMock(),
    permissions: createPermissionsMock(),
    scripting: createScriptingMock(),
    webNavigation: createWebNavigationMock()
  }

  // 深層合併 overrides
  return deepMerge(baseMock, overrides)
}

/**
 * 深層合併兩個物件
 * 注意：jest.fn() 等函式類型不做深層合併，直接用 source 覆蓋
 *
 * @param {Object} target - 目標物件
 * @param {Object} source - 來源物件
 * @returns {Object} 合併後的物件
 */
function deepMerge (target, source) {
  const result = { ...target }

  for (const key of Object.keys(source)) {
    const sourceValue = source[key]
    const targetValue = target[key]

    if (isPlainObject(sourceValue) && isPlainObject(targetValue) && !isMockFunction(sourceValue)) {
      result[key] = deepMerge(targetValue, sourceValue)
    } else {
      result[key] = sourceValue
    }
  }

  return result
}

/**
 * 判斷是否為純物件（非函式、非陣列、非 null）
 */
function isPlainObject (value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && typeof value !== 'function'
}

/**
 * 判斷是否為 jest mock 函式
 */
function isMockFunction (value) {
  return typeof value === 'function' && value._isMockFunction === true
}

// -- 便利函式 --

/**
 * 重置所有 Chrome API mock 的呼叫記錄
 * 用於 beforeEach / afterEach 中清理測試狀態
 *
 * @param {Object} chromeMock - chrome mock 物件
 */
function resetAllChromeMocks (chromeMock) {
  if (!chromeMock) return

  for (const namespace of Object.values(chromeMock)) {
    if (!namespace || typeof namespace !== 'object') continue

    resetNamespace(namespace)
  }
}

/**
 * 重置命名空間內所有 mock 函式
 */
function resetNamespace (namespace) {
  for (const value of Object.values(namespace)) {
    if (typeof value === 'function' && value.mockClear) {
      value.mockClear()
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      resetNamespace(value)
    }
  }
}

module.exports = {
  createCompleteChromeAPIMock,
  createEventInterface,
  resetAllChromeMocks,
  // 匯出個別工廠供需要精細控制的測試使用
  createRuntimeMock,
  createStorageMock,
  createStorageLocalMock,
  createStorageSyncMock,
  createTabsMock,
  createActionMock,
  createPermissionsMock,
  createScriptingMock,
  createWebNavigationMock
}
