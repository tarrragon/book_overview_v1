/**
const Logger = require("src/core/logging/Logger")
 * UI DOM 管理工具類
const Logger = require("src/core/logging/Logger")
 * 為 UI 處理器提供統一的 DOM 操作抽象
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 負責功能：
const Logger = require("src/core/logging/Logger")
 * - 統一DOM元素查找和快取機制
const Logger = require("src/core/logging/Logger")
 * - 提供安全的DOM操作方法
const Logger = require("src/core/logging/Logger")
 * - 實現DOM元素的創建和管理
const Logger = require("src/core/logging/Logger")
 *
const Logger = require("src/core/logging/Logger")
 * 設計考量：
const Logger = require("src/core/logging/Logger")
 * - 減少重複的DOM操作邏輯
const Logger = require("src/core/logging/Logger")
 * - 提供一致的錯誤處理
const Logger = require("src/core/logging/Logger")
 * - 支援元素快取以提高效能
const Logger = require("src/core/logging/Logger")
 */

const Logger = require("src/core/logging/Logger")
class UIDOMManager {
const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 建構DOM管理器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Object} document - DOM文檔物件
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  constructor (document) {
const Logger = require("src/core/logging/Logger")
    this.document = document
const Logger = require("src/core/logging/Logger")
    this.cachedElements = new Map()
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 安全地查找DOM元素（支援多重選擇器）
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Array<string>} selectors - CSS選擇器陣列（按優先順序）
const Logger = require("src/core/logging/Logger")
   * @param {string} cacheKey - 快取鍵值
const Logger = require("src/core/logging/Logger")
   * @param {Element} parent - 父元素（可選）
const Logger = require("src/core/logging/Logger")
   * @returns {Element|null} 找到的DOM元素
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  findElement (selectors, cacheKey = null, parent = null) {
const Logger = require("src/core/logging/Logger")
    if (!this.document) return null

const Logger = require("src/core/logging/Logger")
    // 檢查快取
const Logger = require("src/core/logging/Logger")
    if (cacheKey && this.cachedElements.has(cacheKey)) {
const Logger = require("src/core/logging/Logger")
      return this.cachedElements.get(cacheKey)
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    const searchContext = parent || this.document
const Logger = require("src/core/logging/Logger")
    let element = null

const Logger = require("src/core/logging/Logger")
    // 依序嘗試每個選擇器
const Logger = require("src/core/logging/Logger")
    for (const selector of selectors) {
const Logger = require("src/core/logging/Logger")
      try {
const Logger = require("src/core/logging/Logger")
        element = searchContext.querySelector(selector)
const Logger = require("src/core/logging/Logger")
        if (element) break
const Logger = require("src/core/logging/Logger")
      } catch (error) {
const Logger = require("src/core/logging/Logger")
        // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
        Logger.warn(`[UIDOMManager] Invalid selector: ${selector}`, error)
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    // 快取結果（包括 null）
const Logger = require("src/core/logging/Logger")
    if (cacheKey) {
const Logger = require("src/core/logging/Logger")
      this.cachedElements.set(cacheKey, element)
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    return element
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 創建DOM元素
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} tagName - 元素標籤名稱
const Logger = require("src/core/logging/Logger")
   * @param {Object} options - 創建選項
const Logger = require("src/core/logging/Logger")
   * @param {Array<string>} options.classes - CSS類別陣列
const Logger = require("src/core/logging/Logger")
   * @param {Object} options.attributes - 屬性物件
const Logger = require("src/core/logging/Logger")
   * @param {string} options.textContent - 文字內容
const Logger = require("src/core/logging/Logger")
   * @param {string} options.innerHTML - HTML內容（將被轉義）
const Logger = require("src/core/logging/Logger")
   * @returns {Element|null} 創建的DOM元素
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  createElement (tagName, options = {}) {
const Logger = require("src/core/logging/Logger")
    if (!this.document) return null

const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      const element = this.document.createElement(tagName)
const Logger = require("src/core/logging/Logger")
      const { classes = [], attributes = {}, textContent, innerHTML } = options

const Logger = require("src/core/logging/Logger")
      // 添加CSS類別
const Logger = require("src/core/logging/Logger")
      classes.forEach(className => {
const Logger = require("src/core/logging/Logger")
        if (className) element.classList.add(className)
const Logger = require("src/core/logging/Logger")
      })

const Logger = require("src/core/logging/Logger")
      // 設定屬性
const Logger = require("src/core/logging/Logger")
      Object.entries(attributes).forEach(([key, value]) => {
const Logger = require("src/core/logging/Logger")
        if (value !== null && value !== undefined) {
const Logger = require("src/core/logging/Logger")
          element.setAttribute(key, String(value))
const Logger = require("src/core/logging/Logger")
        }
const Logger = require("src/core/logging/Logger")
      })

const Logger = require("src/core/logging/Logger")
      // 設定內容（優先使用textContent以確保安全）
const Logger = require("src/core/logging/Logger")
      if (textContent !== undefined) {
const Logger = require("src/core/logging/Logger")
        element.textContent = String(textContent)
const Logger = require("src/core/logging/Logger")
      } else if (innerHTML !== undefined) {
const Logger = require("src/core/logging/Logger")
        element.innerHTML = this.escapeHtml(String(innerHTML))
const Logger = require("src/core/logging/Logger")
      }

const Logger = require("src/core/logging/Logger")
      return element
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.error('[UIDOMManager] Failed to create element:', error)
const Logger = require("src/core/logging/Logger")
      return null
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 安全地添加事件監聽器
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Element} element - 目標元素
const Logger = require("src/core/logging/Logger")
   * @param {string} eventType - 事件類型
const Logger = require("src/core/logging/Logger")
   * @param {Function} handler - 事件處理函數
const Logger = require("src/core/logging/Logger")
   * @param {Object} options - 事件選項
const Logger = require("src/core/logging/Logger")
   * @returns {boolean} 是否成功添加
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  addEventListener (element, eventType, handler, options = {}) {
const Logger = require("src/core/logging/Logger")
    if (!element || typeof element.addEventListener !== 'function') {
const Logger = require("src/core/logging/Logger")
      return false
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      element.addEventListener(eventType, handler, options)
const Logger = require("src/core/logging/Logger")
      return true
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.error('[UIDOMManager] Failed to add event listener:', error)
const Logger = require("src/core/logging/Logger")
      return false
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 安全地移除DOM元素
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Element} element - 要移除的元素
const Logger = require("src/core/logging/Logger")
   * @param {number} delay - 延遲時間（毫秒）
const Logger = require("src/core/logging/Logger")
   * @returns {Promise<boolean>} 是否成功移除
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  async removeElement (element, delay = 0) {
const Logger = require("src/core/logging/Logger")
    if (!element) return false

const Logger = require("src/core/logging/Logger")
    const performRemoval = () => {
const Logger = require("src/core/logging/Logger")
      try {
const Logger = require("src/core/logging/Logger")
        if (element.parentNode && typeof element.parentNode.removeChild === 'function') {
const Logger = require("src/core/logging/Logger")
          element.parentNode.removeChild(element)
const Logger = require("src/core/logging/Logger")
        } else if (typeof element.remove === 'function') {
const Logger = require("src/core/logging/Logger")
          element.remove()
const Logger = require("src/core/logging/Logger")
        }
const Logger = require("src/core/logging/Logger")
        return true
const Logger = require("src/core/logging/Logger")
      } catch (error) {
const Logger = require("src/core/logging/Logger")
        // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
        Logger.warn('[UIDOMManager] Failed to remove element:', error)
const Logger = require("src/core/logging/Logger")
        return false
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
    }

const Logger = require("src/core/logging/Logger")
    if (delay > 0) {
const Logger = require("src/core/logging/Logger")
      return new Promise(resolve => {
const Logger = require("src/core/logging/Logger")
        setTimeout(() => resolve(performRemoval()), delay)
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
    } else {
const Logger = require("src/core/logging/Logger")
      return performRemoval()
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 更新元素樣式
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Element} element - 目標元素
const Logger = require("src/core/logging/Logger")
   * @param {Object} styles - 樣式物件
const Logger = require("src/core/logging/Logger")
   * @returns {boolean} 是否成功更新
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  updateStyles (element, styles = {}) {
const Logger = require("src/core/logging/Logger")
    if (!element || !element.style) return false

const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      Object.entries(styles).forEach(([property, value]) => {
const Logger = require("src/core/logging/Logger")
        if (value !== null && value !== undefined) {
const Logger = require("src/core/logging/Logger")
          element.style[property] = String(value)
const Logger = require("src/core/logging/Logger")
        }
const Logger = require("src/core/logging/Logger")
      })
const Logger = require("src/core/logging/Logger")
      return true
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      // eslint-disable-next-line no-console
const Logger = require("src/core/logging/Logger")
      Logger.error('[UIDOMManager] Failed to update styles:', error)
const Logger = require("src/core/logging/Logger")
      return false
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * HTML轉義處理
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} text - 要轉義的文字
const Logger = require("src/core/logging/Logger")
   * @returns {string} 轉義後的文字
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  escapeHtml (text) {
const Logger = require("src/core/logging/Logger")
    if (!text) return ''

const Logger = require("src/core/logging/Logger")
    return text.replace(/[&<>"']/g, (match) => {
const Logger = require("src/core/logging/Logger")
      const escapeMap = {
const Logger = require("src/core/logging/Logger")
        '&': '&amp;',
const Logger = require("src/core/logging/Logger")
        '<': '&lt;',
const Logger = require("src/core/logging/Logger")
        '>': '&gt;',
const Logger = require("src/core/logging/Logger")
        '"': '&quot;',
const Logger = require("src/core/logging/Logger")
        "'": '&#39;'
const Logger = require("src/core/logging/Logger")
      }
const Logger = require("src/core/logging/Logger")
      return escapeMap[match]
const Logger = require("src/core/logging/Logger")
    })
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 清理快取
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {string} cacheKey - 特定的快取鍵值，如未提供則清理所有
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  clearCache (cacheKey = null) {
const Logger = require("src/core/logging/Logger")
    if (cacheKey) {
const Logger = require("src/core/logging/Logger")
      this.cachedElements.delete(cacheKey)
const Logger = require("src/core/logging/Logger")
    } else {
const Logger = require("src/core/logging/Logger")
      this.cachedElements.clear()
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }

const Logger = require("src/core/logging/Logger")
  /**
const Logger = require("src/core/logging/Logger")
   * 檢查元素是否存在於DOM中
const Logger = require("src/core/logging/Logger")
   *
const Logger = require("src/core/logging/Logger")
   * @param {Element} element - 要檢查的元素
const Logger = require("src/core/logging/Logger")
   * @returns {boolean} 元素是否存在
const Logger = require("src/core/logging/Logger")
   */
const Logger = require("src/core/logging/Logger")
  isElementInDOM (element) {
const Logger = require("src/core/logging/Logger")
    if (!element || !this.document) return false

const Logger = require("src/core/logging/Logger")
    try {
const Logger = require("src/core/logging/Logger")
      return this.document.contains(element)
const Logger = require("src/core/logging/Logger")
    } catch (error) {
const Logger = require("src/core/logging/Logger")
      return false
const Logger = require("src/core/logging/Logger")
    }
const Logger = require("src/core/logging/Logger")
  }
const Logger = require("src/core/logging/Logger")
}

const Logger = require("src/core/logging/Logger")
module.exports = UIDOMManager
