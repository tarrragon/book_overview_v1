/* eslint-disable no-console */

/**
 * Jest 測試環境設定檔案
 * 負責設定測試所需的全域變數、模擬物件和通用測試工具
 *
 * Design considerations:
 * - 模擬Chrome Extension APIs以便在測試環境中使用
 * - 設定全域變數以提供一致的測試環境
 * - 提供通用測試工具函數供所有測試檔案使用
 */

// 引入 jest-chrome 模擬 Chrome Extension APIs（提供基礎的 chrome 物件）
require('jest-chrome')
// 引入集中的 Chrome Mock 工廠，補充 jest-chrome 未覆蓋的 API
const { createCompleteChromeAPIMock } = require('./mocks/chrome-mock-factory')
// 提供額外的 DOM 斷言（toHaveClass 等）
try {
  require('@testing-library/jest-dom')
} catch (e) {
  // 若未安裝則略過，不影響其餘測試
}

// 設定全域測試工具
global.testUtils = {
  /**
   * 等待指定時間
   * @param {number} ms - 等待毫秒數
   * @returns {Promise} Promise物件
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * 模擬DOM元素
   * @param {string} tag - HTML標籤名稱
   * @param {Object} attributes - 元素屬性
   * @param {string} textContent - 文字內容
   * @returns {Element} DOM元素
   */
  createMockElement: (tag, attributes = {}, textContent = '') => {
    const element = document.createElement(tag)
    Object.keys(attributes).forEach(key => {
      element.setAttribute(key, attributes[key])
    })
    if (textContent) {
      element.textContent = textContent
    }
    return element
  },

  /**
   * 模擬書籍資料
   * @param {Object} overrides - 覆蓋預設值的物件
   * @returns {Object} 書籍資料物件
   */
  createMockBook: (overrides = {}) => ({
    id: '210327003000101',
    title: '測試書籍',
    cover: 'https://example.com/cover.jpg',
    progress: 50,
    type: '流式',
    isNew: false,
    isFinished: false,
    extractedAt: new Date().toISOString(),
    ...overrides
  }),

  /**
   * 模擬書籍陣列
   * @param {number} count - 書籍數量
   * @returns {Array} 書籍陣列
   */
  createMockBooks: (count = 3) => {
    return Array.from({ length: count }, (_, index) =>
      global.testUtils.createMockBook({
        id: `21032700300010${index + 1}`,
        title: `測試書籍 ${index + 1}`,
        progress: (index + 1) * 20
      })
    )
  },

  /**
   * 模擬事件物件
   * @param {string} type - 事件類型
   * @param {Object} detail - 事件詳細資料
   * @returns {Event} 事件物件
   */
  createMockEvent: (type, detail = {}) => {
    const event = new CustomEvent(type, { detail })
    return event
  },

  /**
   * 清理測試環境
   * 每個測試後呼叫以重置狀態
   */
  cleanup: () => {
    // 清理 localStorage（如果存在）
    if (typeof localStorage !== 'undefined' && localStorage) {
      if (typeof localStorage.clear === 'function') {
        localStorage.clear()
      }
      if (localStorage.getItem && typeof localStorage.getItem.mockClear === 'function') {
        localStorage.getItem.mockClear()
      }
      if (localStorage.setItem && typeof localStorage.setItem.mockClear === 'function') {
        localStorage.setItem.mockClear()
      }
      if (localStorage.removeItem && typeof localStorage.removeItem.mockClear === 'function') {
        localStorage.removeItem.mockClear()
      }
    }

    // 清理 sessionStorage
    sessionStorage.clear()

    // 重置 Chrome API 模擬
    if (typeof chrome !== 'undefined' && chrome && chrome.flush) {
      chrome.flush()
    }

    // 清理 DOM (安全檢查)
    if (typeof document !== 'undefined' && document) {
      if (document.body) {
        document.body.innerHTML = ''
      }
      if (document.head) {
        document.head.innerHTML = ''
      }
    }
  }
}

// 模擬 localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
})
global.localStorage = localStorageMock

// 設定 Chrome Extension API 模擬
// 確保 chrome 物件存在於全域範圍
global.chrome = require('jest-chrome').chrome

// 設定 ErrorCodes 全域變數供所有測試使用
// 解決 186 個測試檔案的 ErrorCodes 未定義問題
try {
  const { ErrorCodes } = require('src/core/errors/ErrorCodes')
  // 設定在瀏覽器環境和 Node.js 環境
  global.ErrorCodes = ErrorCodes
  if (typeof window !== 'undefined') {
    window.ErrorCodes = ErrorCodes
  }
  // 為了相容性，也設定在 global 物件上
  global.window = global.window || {}
  global.window.ErrorCodes = ErrorCodes
} catch (error) {
  // eslint-disable-next-line no-console
  console.warn('Warning: ErrorCodes 無法載入，某些測試可能會失敗:', error.message)
}

// Logger 靜態方法已完整實作（第 365-410 行），直接使用類別本身
// Ticket: 0.15.0-W3-003.1
try {
  const { Logger: LoggerClass, LOG_LEVELS } = require('../src/core/logging/Logger')
  global.Logger = LoggerClass
  global.LOG_LEVELS = LOG_LEVELS

  // 為了相容性，也設定在 window 物件上
  global.window = global.window || {}
  global.window.Logger = LoggerClass
  global.window.LOG_LEVELS = LOG_LEVELS
} catch (error) {
  // eslint-disable-next-line no-console
  console.warn('Warning: Logger 無法載入，某些測試可能會失敗:', error.message)
}

chrome.runtime.id = 'test-extension-id'

// 將 onMessage.addListener 模擬為 jest.fn()
chrome.runtime.onMessage.addListener = jest.fn()
// chrome.runtime.lastError 由 jest-chrome 自動管理，不需要手動設置
chrome.storage.local.get.mockImplementation((keys, callback) => {
  const result = {}
  if (typeof keys === 'string') {
    result[keys] = null
  } else if (Array.isArray(keys)) {
    keys.forEach(key => {
      result[key] = null
    })
  }
  callback(result)
})

chrome.storage.local.set.mockImplementation((items, callback) => {
  if (callback) callback()
})

chrome.tabs.query.mockImplementation((queryInfo, callback) => {
  callback([{
    id: 1,
    url: 'https://readmoo.com/library',
    title: 'Readmoo 電子書',
    active: true
  }])
})

// 使用 Chrome Mock 工廠補充 jest-chrome 未提供完整 mock 的 API
// 僅補充缺失的命名空間，不覆蓋 jest-chrome 已設定的 mock
const factoryMock = createCompleteChromeAPIMock()

// 補充 permissions API（jest-chrome 提供骨架但可能缺少事件介面）
if (!global.chrome.permissions || !global.chrome.permissions.request) {
  global.chrome.permissions = factoryMock.permissions
} else {
  if (!global.chrome.permissions.onAdded) {
    global.chrome.permissions.onAdded = factoryMock.permissions.onAdded
  }
  if (!global.chrome.permissions.onRemoved) {
    global.chrome.permissions.onRemoved = factoryMock.permissions.onRemoved
  }
}

// 補充 scripting API（Manifest V3 專用，jest-chrome 可能未提供）
if (!global.chrome.scripting) {
  global.chrome.scripting = factoryMock.scripting
}

// 補充 webNavigation API 事件介面
if (!global.chrome.webNavigation) {
  global.chrome.webNavigation = factoryMock.webNavigation
} else {
  const navEvents = ['onBeforeNavigate', 'onCommitted', 'onCompleted', 'onErrorOccurred', 'onHistoryStateUpdated']
  navEvents.forEach(event => {
    if (!global.chrome.webNavigation[event]) {
      global.chrome.webNavigation[event] = factoryMock.webNavigation[event]
    }
  })
}

// 補充 storage.onChanged 事件介面
if (!global.chrome.storage.onChanged || !global.chrome.storage.onChanged.addListener) {
  global.chrome.storage.onChanged = factoryMock.storage.onChanged
}

// 設定 console 方法的模擬（可選）
// eslint-disable-next-line no-unused-vars
const originalConsole = { ...console }
beforeEach(() => {
  // 可以選擇性地模擬 console 方法來避免測試輸出污染
  // console.log = jest.fn();
  // console.error = jest.fn();
  // console.warn = jest.fn();
})

afterEach(() => {
  // 每個測試後清理環境
  global.testUtils.cleanup()

  // 重置 console（如果有模擬的話）
  // Object.assign(console, originalConsole);
})

// 全域錯誤處理
process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// 設定測試超時時間
jest.setTimeout(30000) // 30秒 - 增加以支援複雜的整合測試和錯誤恢復測試

// 模擬 IntersectionObserver（如果需要的話）
global.IntersectionObserver = class IntersectionObserver {
  disconnect () {}
  observe () {}
  unobserve () {}
}

// 模擬 ResizeObserver（如果需要的話）
global.ResizeObserver = class ResizeObserver {
  disconnect () {}
  observe () {}
  unobserve () {}
}

// 添加 TextEncoder/TextDecoder 支持 (JSDOM 需要)
const { TextEncoder, TextDecoder } = require('util')
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// 修復 JSDOM 中 Blob 的 type 屬性問題
const OriginalBlob = global.Blob
global.Blob = class extends OriginalBlob {
  constructor (blobParts, options = {}) {
    super(blobParts, options)
    // 確保 type 屬性被正確設置
    Object.defineProperty(this, 'type', {
      value: options.type || '',
      writable: false,
      enumerable: true,
      configurable: false
    })
  }
}
