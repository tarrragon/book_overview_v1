/**
 * Chrome Extension API 模擬物件
 * 提供完整的Chrome Extension APIs模擬實現
 *
 * Responsible for:
 * - 模擬Chrome Storage API
 * - 模擬Chrome Runtime API
 * - 模擬Chrome Tabs API
 * - 模擬Chrome Action API
 *
 * Design considerations:
 * - 儘可能貼近真實Chrome API的行為
 * - 提供可配置的回應和錯誤模擬
 * - 支援非同步操作的模擬
 *
 * Usage context:
 * - 在測試環境中取代真實的Chrome APIs
 * - 允許測試各種成功和失敗情境
 */

// 模擬Chrome Storage API
const createStorageMock = () => {
  const storage = new Map()

  return {
    local: {
      get: jest.fn((keys, callback) => {
        const result = {}

        if (typeof keys === 'string') {
          result[keys] = storage.get(keys) || null
        } else if (Array.isArray(keys)) {
          keys.forEach(key => {
            result[key] = storage.get(key) || null
          })
        } else if (typeof keys === 'object' && keys !== null) {
          Object.keys(keys).forEach(key => {
            result[key] = storage.get(key) || keys[key]
          })
        }

        if (callback) {
          setTimeout(() => callback(result), 0)
        }
      }),

      set: jest.fn((items, callback) => {
        Object.keys(items).forEach(key => {
          storage.set(key, items[key])
        })

        if (callback) {
          setTimeout(callback, 0)
        }
      }),

      remove: jest.fn((keys, callback) => {
        const keysArray = Array.isArray(keys) ? keys : [keys]
        keysArray.forEach(key => storage.delete(key))

        if (callback) {
          setTimeout(callback, 0)
        }
      }),

      clear: jest.fn((callback) => {
        storage.clear()
        if (callback) {
          setTimeout(callback, 0)
        }
      }),

      getBytesInUse: jest.fn((keys, callback) => {
        // 模擬儲存空間使用量
        const bytesInUse = JSON.stringify(Object.fromEntries(storage)).length
        if (callback) {
          setTimeout(() => callback(bytesInUse), 0)
        }
      })
    },

    sync: {
      get: jest.fn((keys, callback) => {
        // 與local相同的邏輯，但模擬同步儲存
        const result = {}
        if (typeof keys === 'string') {
          result[keys] = storage.get(`sync_${keys}`) || null
        }
        if (callback) {
          setTimeout(() => callback(result), 0)
        }
      }),

      set: jest.fn((items, callback) => {
        Object.keys(items).forEach(key => {
          storage.set(`sync_${key}`, items[key])
        })
        if (callback) {
          setTimeout(callback, 0)
        }
      })
    },

    // 內部方法，用於測試
    _getStorage: () => storage,
    _clearStorage: () => storage.clear()
  }
}

// 模擬Chrome Runtime API
const createRuntimeMock = () => {
  const listeners = {
    onMessage: [],
    onInstalled: [],
    onStartup: []
  }

  return {
    id: 'test-extension-id',
    lastError: null,

    getManifest: jest.fn(() => ({
      name: 'Test Extension',
      version: '1.0.0',
      manifest_version: 3
    })),

    sendMessage: jest.fn((extensionId, message, options, callback) => {
      // 如果extensionId是函數，表示它實際上是message
      if (typeof extensionId === 'function') {
        callback = extensionId
        message = null
      } else if (typeof message === 'function') {
        callback = message
        message = extensionId
      }

      // 模擬非同步響應
      setTimeout(() => {
        if (callback) {
          callback({ success: true, echo: message })
        }
      }, 0)
    }),

    onMessage: {
      addListener: jest.fn((listener) => {
        listeners.onMessage.push(listener)
      }),
      removeListener: jest.fn((listener) => {
        const index = listeners.onMessage.indexOf(listener)
        if (index > -1) {
          listeners.onMessage.splice(index, 1)
        }
      }),
      hasListener: jest.fn((listener) => {
        return listeners.onMessage.includes(listener)
      }),
      // 測試用方法
      _trigger: (message, sender, sendResponse) => {
        listeners.onMessage.forEach(listener => {
          listener(message, sender, sendResponse)
        })
      }
    },

    onInstalled: {
      addListener: jest.fn((listener) => {
        listeners.onInstalled.push(listener)
      }),
      removeListener: jest.fn((listener) => {
        const index = listeners.onInstalled.indexOf(listener)
        if (index > -1) {
          listeners.onInstalled.splice(index, 1)
        }
      }),
      // 測試用方法
      _trigger: (details) => {
        listeners.onInstalled.forEach(listener => {
          listener(details)
        })
      }
    },

    onStartup: {
      addListener: jest.fn((listener) => {
        listeners.onStartup.push(listener)
      }),
      removeListener: jest.fn((listener) => {
        const index = listeners.onStartup.indexOf(listener)
        if (index > -1) {
          listeners.onStartup.splice(index, 1)
        }
      }),
      // 測試用方法
      _trigger: () => {
        listeners.onStartup.forEach(listener => {
          listener()
        })
      }
    },

    getURL: jest.fn((path) => {
      return `chrome-extension://test-extension-id/${path}`
    }),

    // 內部方法，用於測試
    _getListeners: () => listeners,
    _clearListeners: () => {
      Object.keys(listeners).forEach(key => {
        listeners[key] = []
      })
    }
  }
}

// 模擬Chrome Tabs API
const createTabsMock = () => {
  const listeners = {
    onUpdated: [],
    onCreated: [],
    onRemoved: []
  }

  const tabs = new Map()
  let nextTabId = 1

  return {
    query: jest.fn((queryInfo, callback) => {
      const allTabs = Array.from(tabs.values())
      let filteredTabs = allTabs

      if (queryInfo.active !== undefined) {
        filteredTabs = filteredTabs.filter(tab => tab.active === queryInfo.active)
      }
      if (queryInfo.url) {
        filteredTabs = filteredTabs.filter(tab =>
          tab.url.includes(queryInfo.url) || new RegExp(queryInfo.url).test(tab.url)
        )
      }

      if (callback) {
        setTimeout(() => callback(filteredTabs), 0)
      }
    }),

    get: jest.fn((tabId, callback) => {
      const tab = tabs.get(tabId)
      if (callback) {
        setTimeout(() => callback(tab), 0)
      }
    }),

    create: jest.fn((createProperties, callback) => {
      const newTab = {
        id: nextTabId++,
        url: createProperties.url || 'chrome://newtab/',
        active: createProperties.active !== false,
        title: createProperties.url || 'New Tab',
        status: 'loading'
      }

      tabs.set(newTab.id, newTab)

      if (callback) {
        setTimeout(() => callback(newTab), 0)
      }

      // 觸發onCreated事件
      setTimeout(() => {
        listeners.onCreated.forEach(listener => listener(newTab))
      }, 0)
    }),

    update: jest.fn((tabId, updateProperties, callback) => {
      const tab = tabs.get(tabId)
      if (tab) {
        Object.assign(tab, updateProperties)
        tabs.set(tabId, tab)

        if (callback) {
          setTimeout(() => callback(tab), 0)
        }

        // 觸發onUpdated事件
        setTimeout(() => {
          listeners.onUpdated.forEach(listener =>
            listener(tabId, updateProperties, tab)
          )
        }, 0)
      }
    }),

    remove: jest.fn((tabIds, callback) => {
      const idsArray = Array.isArray(tabIds) ? tabIds : [tabIds]
      idsArray.forEach(id => {
        tabs.delete(id)
        // 觸發onRemoved事件
        setTimeout(() => {
          listeners.onRemoved.forEach(listener =>
            listener(id, { windowId: 1, isWindowClosing: false })
          )
        }, 0)
      })

      if (callback) {
        setTimeout(callback, 0)
      }
    }),

    onUpdated: {
      addListener: jest.fn((listener) => {
        listeners.onUpdated.push(listener)
      }),
      removeListener: jest.fn((listener) => {
        const index = listeners.onUpdated.indexOf(listener)
        if (index > -1) {
          listeners.onUpdated.splice(index, 1)
        }
      }),
      // 測試用方法
      _trigger: (tabId, changeInfo, tab) => {
        listeners.onUpdated.forEach(listener => {
          listener(tabId, changeInfo, tab)
        })
      }
    },

    onCreated: {
      addListener: jest.fn((listener) => {
        listeners.onCreated.push(listener)
      }),
      removeListener: jest.fn((listener) => {
        const index = listeners.onCreated.indexOf(listener)
        if (index > -1) {
          listeners.onCreated.splice(index, 1)
        }
      })
    },

    onRemoved: {
      addListener: jest.fn((listener) => {
        listeners.onRemoved.push(listener)
      }),
      removeListener: jest.fn((listener) => {
        const index = listeners.onRemoved.indexOf(listener)
        if (index > -1) {
          listeners.onRemoved.splice(index, 1)
        }
      })
    },

    // 內部方法，用於測試
    _getTabs: () => tabs,
    _addTab: (tab) => {
      tabs.set(tab.id, tab)
    },
    _clearTabs: () => {
      tabs.clear()
      nextTabId = 1
    }
  }
}

// 模擬Chrome Action API (Manifest V3)
const createActionMock = () => {
  let badgeText = ''
  let badgeBackgroundColor = '#000000'

  return {
    setBadgeText: jest.fn((details, callback) => {
      badgeText = details.text || ''
      if (callback) {
        setTimeout(callback, 0)
      }
    }),

    getBadgeText: jest.fn((details, callback) => {
      if (callback) {
        setTimeout(() => callback(badgeText), 0)
      }
    }),

    setBadgeBackgroundColor: jest.fn((details, callback) => {
      badgeBackgroundColor = details.color
      if (callback) {
        setTimeout(callback, 0)
      }
    }),

    setTitle: jest.fn((details, callback) => {
      // 模擬設定工具提示
      if (callback) {
        setTimeout(callback, 0)
      }
    }),

    setIcon: jest.fn((details, callback) => {
      // 模擬設定圖示
      if (callback) {
        setTimeout(callback, 0)
      }
    }),

    // 內部方法，用於測試
    _getBadgeText: () => badgeText,
    _getBadgeBackgroundColor: () => badgeBackgroundColor
  }
}

// 建立完整的Chrome API模擬
const createChromeMock = () => {
  const storage = createStorageMock()
  const runtime = createRuntimeMock()
  const tabs = createTabsMock()
  const action = createActionMock()

  return {
    storage,
    runtime,
    tabs,
    action,

    // 全域方法
    flush: () => {
      // 清理所有模擬狀態
      storage._clearStorage()
      runtime._clearListeners()
      tabs._clearTabs()
    },

    // 工具方法，用於設定測試場景
    _setLastError: (error) => {
      runtime.lastError = error
    },

    _clearLastError: () => {
      runtime.lastError = null
    },

    _simulateStorageQuotaExceeded: () => {
      storage.local.set.mockImplementation((items, callback) => {
        runtime.lastError = new Error('QUOTA_EXCEEDED_ERR')
        if (callback) {
          setTimeout(callback, 0)
        }
      })
    }
  }
}

module.exports = createChromeMock()
