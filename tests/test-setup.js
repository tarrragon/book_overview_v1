/**
 * Jest 測試環境設定檔案
 * 負責設定測試所需的全域變數、模擬物件和通用測試工具
 *
 * Design considerations:
 * - 模擬Chrome Extension APIs以便在測試環境中使用
 * - 設定全域變數以提供一致的測試環境
 * - 提供通用測試工具函數供所有測試檔案使用
 */

// 引入 jest-chrome 模擬 Chrome Extension APIs
require('jest-chrome')
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
  value: localStorageMock
})
global.localStorage = localStorageMock

// 設定 Chrome Extension API 模擬
// 確保 chrome 物件存在於全域範圍
global.chrome = require('jest-chrome').chrome

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

// 設定 console 方法的模擬（可選）
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
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// 設定測試超時時間
jest.setTimeout(10000) // 10秒

// 模擬 IntersectionObserver（如果需要的話）
global.IntersectionObserver = class IntersectionObserver {
  constructor () {}
  disconnect () {}
  observe () {}
  unobserve () {}
}

// 模擬 ResizeObserver（如果需要的話）
global.ResizeObserver = class ResizeObserver {
  constructor () {}
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
