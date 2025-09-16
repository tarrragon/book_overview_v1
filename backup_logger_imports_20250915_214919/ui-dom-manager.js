/**
 * UI DOM 管理工具類
 * 為 UI 處理器提供統一的 DOM 操作抽象
 *
 * 負責功能：
 * - 統一DOM元素查找和快取機制
 * - 提供安全的DOM操作方法
 * - 實現DOM元素的創建和管理
 *
 * 設計考量：
 * - 減少重複的DOM操作邏輯
 * - 提供一致的錯誤處理
 * - 支援元素快取以提高效能
 */

class UIDOMManager {
  /**
   * 建構DOM管理器
   *
   * @param {Object} document - DOM文檔物件
   */
  constructor (document) {
    this.document = document
    this.cachedElements = new Map()
  }

  /**
   * 安全地查找DOM元素（支援多重選擇器）
   *
   * @param {Array<string>} selectors - CSS選擇器陣列（按優先順序）
   * @param {string} cacheKey - 快取鍵值
   * @param {Element} parent - 父元素（可選）
   * @returns {Element|null} 找到的DOM元素
   */
  findElement (selectors, cacheKey = null, parent = null) {
    if (!this.document) return null

    // 檢查快取
    if (cacheKey && this.cachedElements.has(cacheKey)) {
      return this.cachedElements.get(cacheKey)
    }

    const searchContext = parent || this.document
    let element = null

    // 依序嘗試每個選擇器
    for (const selector of selectors) {
      try {
        element = searchContext.querySelector(selector)
        if (element) break
      } catch (error) {
        // eslint-disable-next-line no-console
        Logger.warn(`[UIDOMManager] Invalid selector: ${selector}`, error)
      }
    }

    // 快取結果（包括 null）
    if (cacheKey) {
      this.cachedElements.set(cacheKey, element)
    }

    return element
  }

  /**
   * 創建DOM元素
   *
   * @param {string} tagName - 元素標籤名稱
   * @param {Object} options - 創建選項
   * @param {Array<string>} options.classes - CSS類別陣列
   * @param {Object} options.attributes - 屬性物件
   * @param {string} options.textContent - 文字內容
   * @param {string} options.innerHTML - HTML內容（將被轉義）
   * @returns {Element|null} 創建的DOM元素
   */
  createElement (tagName, options = {}) {
    if (!this.document) return null

    try {
      const element = this.document.createElement(tagName)
      const { classes = [], attributes = {}, textContent, innerHTML } = options

      // 添加CSS類別
      classes.forEach(className => {
        if (className) element.classList.add(className)
      })

      // 設定屬性
      Object.entries(attributes).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          element.setAttribute(key, String(value))
        }
      })

      // 設定內容（優先使用textContent以確保安全）
      if (textContent !== undefined) {
        element.textContent = String(textContent)
      } else if (innerHTML !== undefined) {
        element.innerHTML = this.escapeHtml(String(innerHTML))
      }

      return element
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.error('[UIDOMManager] Failed to create element:', error)
      return null
    }
  }

  /**
   * 安全地添加事件監聽器
   *
   * @param {Element} element - 目標元素
   * @param {string} eventType - 事件類型
   * @param {Function} handler - 事件處理函數
   * @param {Object} options - 事件選項
   * @returns {boolean} 是否成功添加
   */
  addEventListener (element, eventType, handler, options = {}) {
    if (!element || typeof element.addEventListener !== 'function') {
      return false
    }

    try {
      element.addEventListener(eventType, handler, options)
      return true
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.error('[UIDOMManager] Failed to add event listener:', error)
      return false
    }
  }

  /**
   * 安全地移除DOM元素
   *
   * @param {Element} element - 要移除的元素
   * @param {number} delay - 延遲時間（毫秒）
   * @returns {Promise<boolean>} 是否成功移除
   */
  async removeElement (element, delay = 0) {
    if (!element) return false

    const performRemoval = () => {
      try {
        if (element.parentNode && typeof element.parentNode.removeChild === 'function') {
          element.parentNode.removeChild(element)
        } else if (typeof element.remove === 'function') {
          element.remove()
        }
        return true
      } catch (error) {
        // eslint-disable-next-line no-console
        Logger.warn('[UIDOMManager] Failed to remove element:', error)
        return false
      }
    }

    if (delay > 0) {
      return new Promise(resolve => {
        setTimeout(() => resolve(performRemoval()), delay)
      })
    } else {
      return performRemoval()
    }
  }

  /**
   * 更新元素樣式
   *
   * @param {Element} element - 目標元素
   * @param {Object} styles - 樣式物件
   * @returns {boolean} 是否成功更新
   */
  updateStyles (element, styles = {}) {
    if (!element || !element.style) return false

    try {
      Object.entries(styles).forEach(([property, value]) => {
        if (value !== null && value !== undefined) {
          element.style[property] = String(value)
        }
      })
      return true
    } catch (error) {
      // eslint-disable-next-line no-console
      Logger.error('[UIDOMManager] Failed to update styles:', error)
      return false
    }
  }

  /**
   * HTML轉義處理
   *
   * @param {string} text - 要轉義的文字
   * @returns {string} 轉義後的文字
   */
  escapeHtml (text) {
    if (!text) return ''

    return text.replace(/[&<>"']/g, (match) => {
      const escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }
      return escapeMap[match]
    })
  }

  /**
   * 清理快取
   *
   * @param {string} cacheKey - 特定的快取鍵值，如未提供則清理所有
   */
  clearCache (cacheKey = null) {
    if (cacheKey) {
      this.cachedElements.delete(cacheKey)
    } else {
      this.cachedElements.clear()
    }
  }

  /**
   * 檢查元素是否存在於DOM中
   *
   * @param {Element} element - 要檢查的元素
   * @returns {boolean} 元素是否存在
   */
  isElementInDOM (element) {
    if (!element || !this.document) return false

    try {
      return this.document.contains(element)
    } catch (error) {
      return false
    }
  }
}

module.exports = UIDOMManager
