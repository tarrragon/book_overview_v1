/**
 * @fileoverview DOM Utils - DOM 操作工具
 * @version v1.0.0
 * @since 2025-08-16
 *
 * 負責功能：
 * - 安全的 DOM 查詢和元素操作
 * - 多選擇器策略和備用方案
 * - 元素存在性和可見性檢查
 * - 文字和資料提取
 * - Readmoo 特定的 DOM 處理
 *
 * 設計考量：
 * - 防禦性 DOM 操作，避免 null 錯誤
 * - 效能優化的查詢快取機制
 * - Content Script 環境優化
 * - 記憶體洩漏預防
 *
 * 使用情境：
 * - 安全查詢 Readmoo 頁面元素
 * - 提取書籍資訊和資料
 * - 處理動態載入的內容
 * - 批量處理多個 DOM 元素
 */

/**
 * DOM 操作工具類
 */
const ErrorCodes = require('src/core/errors/ErrorCodes')

class DOMUtils {
  constructor () {
    this.queryCache = new Map()
    this.maxCacheSize = 100
    this.eventListeners = []
  }

  /**
   * 安全執行 querySelector 查詢
   * @param {string} selector - CSS 選擇器
   * @param {Element} container - 查詢容器（預設為 document）
   * @returns {Object} 查詢結果
   */
  safeQuerySelector (selector, container = document) {
    try {
      if (!selector || typeof selector !== 'string') {
        return {
          success: false,
          element: null,
          error: (() => {
            const error = new Error('Invalid selector')
            error.code = ErrorCodes.INVALID_DATA_FORMAT
            error.details = { category: 'general' }
            return error
          })()
        }
      }

      if (!container || typeof container.querySelector !== 'function') {
        return {
          success: false,
          element: null,
          error: (() => {
            const error = new Error('Invalid container')
            error.code = ErrorCodes.INVALID_DATA_FORMAT
            error.details = { category: 'general' }
            return error
          })()
        }
      }

      const element = container.querySelector(selector)

      if (element === null) {
        return {
          success: false,
          element: null,
          error: (() => {
            const error = new Error('Element not found')
            error.code = ErrorCodes.RESOURCE_NOT_FOUND
            error.details = { category: 'general' }
            return error
          })()
        }
      }

      return {
        success: true,
        element,
        selector
      }
    } catch (error) {
      return {
        success: false,
        element: null,
        error
      }
    }
  }

  /**
   * 安全執行 querySelectorAll 批量查詢
   * @param {string} selector - CSS 選擇器
   * @param {Element} container - 查詢容器
   * @returns {Object} 查詢結果
   */
  safeQuerySelectorAll (selector, container = document) {
    try {
      if (!selector || typeof selector !== 'string') {
        return {
          success: false,
          elements: [],
          count: 0,
          error: (() => {
            const error = new Error('Invalid selector')
            error.code = ErrorCodes.INVALID_DATA_FORMAT
            error.details = { category: 'general' }
            return error
          })()
        }
      }

      const elements = Array.from(container.querySelectorAll(selector))

      return {
        success: true,
        elements,
        count: elements.length,
        selector
      }
    } catch (error) {
      return {
        success: false,
        elements: [],
        count: 0,
        error
      }
    }
  }

  /**
   * 使用多個選擇器策略查詢
   * @param {Array} selectors - 選擇器陣列
   * @param {Element} container - 查詢容器
   * @returns {Object} 查詢結果
   */
  findWithMultipleSelectors (selectors, container = document) {
    if (!Array.isArray(selectors) || selectors.length === 0) {
      return {
        success: false,
        element: null,
        usedSelector: null,
        triedSelectors: []
      }
    }

    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i]
      const result = this.safeQuerySelector(selector, container)

      if (result.success && result.element) {
        return {
          success: true,
          element: result.element,
          usedSelector: selector,
          selectorIndex: i
        }
      }
    }

    return {
      success: false,
      element: null,
      usedSelector: null,
      triedSelectors: selectors
    }
  }

  /**
   * 查找父容器策略
   * @param {string} childSelector - 子元素選擇器
   * @returns {Object} 查詢結果
   */
  findParentContainers (childSelector) {
    try {
      const childElements = document.querySelectorAll(childSelector)
      const containers = []

      childElements.forEach(child => {
        const parent = child.parentElement
        if (parent && !containers.includes(parent)) {
          containers.push(parent)
        }
      })

      return {
        success: true,
        containers,
        count: containers.length
      }
    } catch (error) {
      return {
        success: false,
        containers: [],
        count: 0,
        error
      }
    }
  }

  /**
   * 檢查元素是否存在
   * @param {Element} element - 要檢查的元素
   * @returns {boolean} 是否存在
   */
  elementExists (element) {
    return element !== null && element !== undefined && element.nodeType === Node.ELEMENT_NODE
  }

  /**
   * 檢查元素是否可見
   * @param {Element} element - 要檢查的元素
   * @returns {boolean} 是否可見
   */
  isElementVisible (element) {
    if (!this.elementExists(element)) {
      return false
    }

    try {
      const style = window.getComputedStyle(element)

      return style.display !== 'none' &&
             style.visibility !== 'hidden' &&
             style.opacity !== '0'
    } catch (error) {
      return false
    }
  }

  /**
   * 檢查元素是否在視窗範圍內
   * @param {Element} element - 要檢查的元素
   * @returns {boolean} 是否在視窗內
   */
  isElementInViewport (element) {
    if (!this.elementExists(element)) {
      return false
    }

    try {
      const rect = element.getBoundingClientRect()
      const windowHeight = window.innerHeight || document.documentElement.clientHeight
      const windowWidth = window.innerWidth || document.documentElement.clientWidth

      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= windowHeight &&
        rect.right <= windowWidth
      )
    } catch (error) {
      return false
    }
  }

  /**
   * 檢查元素是否包含必要屬性
   * @param {Element} element - 要檢查的元素
   * @param {Array} requiredAttrs - 必要屬性陣列
   * @returns {Object} 檢查結果
   */
  hasRequiredAttributes (element, requiredAttrs) {
    if (!this.elementExists(element) || !Array.isArray(requiredAttrs)) {
      return {
        hasAll: false,
        missing: requiredAttrs || [],
        found: []
      }
    }

    const found = []
    const missing = []

    requiredAttrs.forEach(attr => {
      if (element.hasAttribute(attr)) {
        found.push(attr)
      } else {
        missing.push(attr)
      }
    })

    return {
      hasAll: missing.length === 0,
      missing,
      found
    }
  }

  /**
   * 安全提取元素文字內容
   * @param {Element} element - 要提取的元素
   * @returns {Object} 提取結果
   */
  extractText (element) {
    if (!this.elementExists(element)) {
      return {
        success: false,
        content: '',
        original: '',
        length: 0,
        error: (() => {
          const error = new Error('Invalid element')
          error.code = ErrorCodes.INVALID_DATA_FORMAT
          error.details = { category: 'general' }
          return error
        })()
      }
    }

    try {
      const original = element.textContent || ''
      const content = original.trim()

      return {
        success: true,
        content,
        original,
        length: content.length
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        original: '',
        length: 0,
        error
      }
    }
  }

  /**
   * 從多個候選元素中提取文字
   * @param {Element} container - 容器元素
   * @param {Array} selectors - 候選選擇器陣列
   * @returns {Object} 提取結果
   */
  extractTextFromCandidates (container, selectors) {
    if (!this.elementExists(container) || !Array.isArray(selectors)) {
      return {
        success: false,
        content: '',
        usedSelector: null
      }
    }

    for (const selector of selectors) {
      const result = this.safeQuerySelector(selector, container)
      if (result.success && result.element) {
        const textResult = this.extractText(result.element)
        if (textResult.success && textResult.content) {
          return {
            success: true,
            content: textResult.content,
            usedSelector: selector
          }
        }
      }
    }

    return {
      success: false,
      content: '',
      usedSelector: null
    }
  }

  /**
   * 提取元素屬性值
   * @param {Element} element - 要提取的元素
   * @param {Array} attrs - 屬性名稱陣列
   * @returns {Object} 提取結果
   */
  extractAttributes (element, attrs) {
    if (!this.elementExists(element) || !Array.isArray(attrs)) {
      return {
        success: false,
        attributes: {},
        foundCount: 0
      }
    }

    const attributes = {}
    let foundCount = 0

    attrs.forEach(attr => {
      const value = element.getAttribute(attr)
      attributes[attr] = value || ''
      if (value) foundCount++
    })

    return {
      success: true,
      attributes,
      foundCount
    }
  }

  /**
   * 從連結中提取 URL 和路徑
   * @param {Element} linkElement - 連結元素
   * @returns {Object} URL 資訊
   */
  extractUrlInfo (linkElement) {
    if (!this.elementExists(linkElement)) {
      return {
        success: false,
        href: '',
        pathname: '',
        search: '',
        isReaderLink: false
      }
    }

    try {
      const href = linkElement.getAttribute('href') || ''
      const url = new URL(href, window.location.origin)

      return {
        success: true,
        href,
        pathname: url.pathname,
        search: url.search,
        isReaderLink: href.includes('/read/')
      }
    } catch (error) {
      // 處理相對路徑或無效 URL
      const href = linkElement.getAttribute('href') || ''
      return {
        success: true,
        href,
        pathname: href.split('?')[0],
        search: href.includes('?') ? '?' + href.split('?')[1] : '',
        isReaderLink: href.includes('/read/')
      }
    }
  }

  /**
   * 安全設定元素屬性
   * @param {Element} element - 目標元素
   * @param {string} attr - 屬性名稱
   * @param {string} value - 屬性值
   * @returns {Object} 操作結果
   */
  safeSetAttribute (element, attr, value) {
    if (!element) {
      return {
        success: false,
        error: (() => {
          const error = new Error('Invalid element')
          error.code = ErrorCodes.INVALID_DATA_FORMAT
          error.details = { category: 'general' }
          return error
        })()
      }
    }

    try {
      element.setAttribute(attr, value)
      return {
        success: true,
        attribute: attr,
        value
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 安全添加 CSS 類別
   * @param {Element} element - 目標元素
   * @param {string} className - 類別名稱
   * @returns {Object} 操作結果
   */
  safeAddClass (element, className) {
    if (!this.elementExists(element)) {
      return {
        success: false,
        error: (() => {
          const error = new Error('Invalid element')
          error.code = ErrorCodes.INVALID_DATA_FORMAT
          error.details = { category: 'general' }
          return error
        })()
      }
    }

    try {
      element.classList.add(className)
      return {
        success: true,
        className,
        classList: Array.from(element.classList)
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 安全移除 CSS 類別
   * @param {Element} element - 目標元素
   * @param {string} className - 類別名稱
   * @returns {Object} 操作結果
   */
  safeRemoveClass (element, className) {
    if (!this.elementExists(element)) {
      return {
        success: false,
        error: (() => {
          const error = new Error('Invalid element')
          error.code = ErrorCodes.INVALID_DATA_FORMAT
          error.details = { category: 'general' }
          return error
        })()
      }
    }

    try {
      element.classList.remove(className)
      return {
        success: true,
        className,
        classList: Array.from(element.classList)
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 建立新的 DOM 元素
   * @param {string} tagName - 標籤名稱
   * @param {Object} attributes - 屬性物件
   * @returns {Object} 建立結果
   */
  createElement (tagName, attributes = {}) {
    try {
      const element = document.createElement(tagName)

      Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'textContent') {
          element.textContent = value
        } else if (key === 'className') {
          element.className = value
        } else {
          element.setAttribute(key, value)
        }
      })

      return {
        success: true,
        element,
        tagName
      }
    } catch (error) {
      return {
        success: false,
        element: null,
        error
      }
    }
  }

  /**
   * 插入元素到指定位置
   * @param {Element} container - 容器元素
   * @param {Element} element - 要插入的元素
   * @param {string} position - 插入位置
   * @returns {Object} 插入結果
   */
  insertElement (container, element, position = 'beforeend') {
    if (!this.elementExists(container) || !this.elementExists(element)) {
      return {
        success: false,
        error: (() => {
          const error = new Error('Invalid container or element')
          error.code = ErrorCodes.INVALID_DATA_FORMAT
          error.details = { category: 'general' }
          return error
        })()
      }
    }

    try {
      container.insertAdjacentElement(position, element)
      return {
        success: true,
        position,
        childCount: container.children.length
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 快取查詢結果
   * @param {string} selector - CSS 選擇器
   * @param {Element} container - 查詢容器
   * @returns {Object} 查詢結果
   */
  cachedQuerySelector (selector, container = document) {
    const cacheKey = `${selector}:${container === document ? 'document' : 'container'}`

    if (this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey)
      return {
        ...cached,
        fromCache: true
      }
    }

    const result = this.safeQuerySelector(selector, container)

    if (result.success && this.queryCache.size < this.maxCacheSize) {
      this.queryCache.set(cacheKey, {
        ...result,
        fromCache: false
      })
    }

    return {
      ...result,
      fromCache: false
    }
  }

  /**
   * 清空查詢快取
   * @returns {Object} 清空結果
   */
  clearQueryCache () {
    const clearedCount = this.queryCache.size
    this.queryCache.clear()

    return {
      success: true,
      clearedCount
    }
  }

  /**
   * 批量處理多個元素
   * @param {NodeList|Array} elements - 元素列表
   * @param {Function} processor - 處理函數
   * @returns {Object} 處理結果
   */
  batchProcessElements (elements, processor) {
    if (!elements || typeof processor !== 'function') {
      return {
        success: false,
        processed: 0,
        failed: 0,
        errors: []
      }
    }

    const results = []
    const errors = []
    let processed = 0
    let failed = 0

    Array.from(elements).forEach((element, index) => {
      try {
        const result = processor(element, index)
        results.push(result)
        processed++
      } catch (error) {
        errors.push(error)
        failed++
      }
    })

    return {
      success: true,
      processed,
      failed,
      results,
      errors
    }
  }

  /**
   * 識別書籍容器元素
   * @param {Element} element - 要檢查的元素
   * @returns {Object} 識別結果
   */
  isBookContainer (element) {
    if (!this.elementExists(element)) {
      return {
        isContainer: false,
        confidence: 0,
        indicators: {}
      }
    }

    const indicators = {
      hasImage: !!element.querySelector('img'),
      hasTitle: !!(element.querySelector('h1, h2, h3, h4, h5, h6, .title')),
      hasReadLink: !!element.querySelector('a[href*="/read/"]'),
      hasBookClass: /book|library|item/.test(element.className)
    }

    const trueCount = Object.values(indicators).filter(Boolean).length
    const confidence = trueCount / Object.keys(indicators).length

    return {
      isContainer: confidence >= 0.5,
      confidence,
      indicators
    }
  }

  /**
   * 提取書籍基本資訊
   * @param {Element} container - 書籍容器元素
   * @returns {Object} 書籍資訊
   */
  extractBookInfo (container) {
    if (!this.elementExists(container)) {
      return {
        success: false,
        error: (() => {
          const error = new Error('Invalid container')
          error.code = ErrorCodes.INVALID_DATA_FORMAT
          error.details = { category: 'general' }
          return error
        })()
      }
    }

    try {
      const id = container.getAttribute('data-book-id') || ''

      const titleElement = container.querySelector('h1, h2, h3, h4, h5, h6, .title')
      const title = titleElement ? titleElement.textContent.trim() : ''

      const authorElement = container.querySelector('.author, .creator')
      const author = authorElement ? authorElement.textContent.trim() : ''

      const imgElement = container.querySelector('img')
      const cover = imgElement ? imgElement.getAttribute('src') || '' : ''

      const linkElement = container.querySelector('a[href*="/read/"]')
      const readUrl = linkElement ? linkElement.getAttribute('href') || '' : ''

      const progressElement = container.querySelector('.progress, [class*="progress"]')
      const progress = progressElement ? progressElement.textContent.trim() : ''

      return {
        success: true,
        id,
        title,
        author,
        cover,
        readUrl,
        progress
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }

  /**
   * 檢測頁面載入狀態
   * @returns {Object} 頁面狀態
   */
  checkPageReadiness () {
    try {
      const readyState = document.readyState
      const isReady = readyState === 'complete' || readyState === 'interactive'
      const hasContent = document.body && document.body.children.length > 0

      return {
        isReady,
        readyState,
        hasContent,
        contentCount: document.body ? document.body.children.length : 0
      }
    } catch (error) {
      return {
        isReady: false,
        readyState: 'unknown',
        hasContent: false,
        contentCount: 0,
        error
      }
    }
  }

  /**
   * 等待動態內容載入
   * @param {string} selector - 等待的選擇器
   * @param {Object} options - 選項
   * @returns {Promise} 等待結果
   */
  async waitForContent (selector, options = {}) {
    const { timeout = 5000, interval = 100 } = options
    const startTime = Date.now()

    return new Promise((resolve) => {
      const checkContent = () => {
        const element = document.querySelector(selector)

        if (element) {
          resolve({
            found: true,
            element,
            waitTime: Date.now() - startTime,
            timedOut: false
          })
          return
        }

        if (Date.now() - startTime >= timeout) {
          resolve({
            found: false,
            element: null,
            waitTime: Date.now() - startTime,
            timedOut: true
          })
          return
        }

        setTimeout(checkContent, interval)
      }

      checkContent()
    })
  }

  /**
   * 清理資源和快取
   * @returns {Object} 清理結果
   */
  cleanup () {
    try {
      // 清空查詢快取
      const cacheResult = this.clearQueryCache()

      // 移除事件監聽器
      let removedListeners = 0
      this.eventListeners.forEach(listener => {
        try {
          listener.element.removeEventListener(listener.type, listener.handler)
          removedListeners++
        } catch (error) {
          // 忽略移除失敗
        }
      })
      this.eventListeners = []

      return {
        success: true,
        clearedCache: cacheResult.success,
        removedListeners
      }
    } catch (error) {
      return {
        success: false,
        error
      }
    }
  }
}

// 建立單例實例
const domUtils = new DOMUtils()

// 匯出靜態方法介面
module.exports = {
  safeQuerySelector: (selector, container) => domUtils.safeQuerySelector(selector, container),
  safeQuerySelectorAll: (selector, container) => domUtils.safeQuerySelectorAll(selector, container),
  findWithMultipleSelectors: (selectors, container) => domUtils.findWithMultipleSelectors(selectors, container),
  findParentContainers: (childSelector) => domUtils.findParentContainers(childSelector),
  elementExists: (element) => domUtils.elementExists(element),
  isElementVisible: (element) => domUtils.isElementVisible(element),
  isElementInViewport: (element) => domUtils.isElementInViewport(element),
  hasRequiredAttributes: (element, requiredAttrs) => domUtils.hasRequiredAttributes(element, requiredAttrs),
  extractText: (element) => domUtils.extractText(element),
  extractTextFromCandidates: (container, selectors) => domUtils.extractTextFromCandidates(container, selectors),
  extractAttributes: (element, attrs) => domUtils.extractAttributes(element, attrs),
  extractUrlInfo: (linkElement) => domUtils.extractUrlInfo(linkElement),
  safeSetAttribute: (element, attr, value) => domUtils.safeSetAttribute(element, attr, value),
  safeAddClass: (element, className) => domUtils.safeAddClass(element, className),
  safeRemoveClass: (element, className) => domUtils.safeRemoveClass(element, className),
  createElement: (tagName, attributes) => domUtils.createElement(tagName, attributes),
  insertElement: (container, element, position) => domUtils.insertElement(container, element, position),
  cachedQuerySelector: (selector, container) => domUtils.cachedQuerySelector(selector, container),
  clearQueryCache: () => domUtils.clearQueryCache(),
  batchProcessElements: (elements, processor) => domUtils.batchProcessElements(elements, processor),
  isBookContainer: (element) => domUtils.isBookContainer(element),
  extractBookInfo: (container) => domUtils.extractBookInfo(container),
  checkPageReadiness: () => domUtils.checkPageReadiness(),
  waitForContent: (selector, options) => domUtils.waitForContent(selector, options),
  cleanup: () => domUtils.cleanup()
}
