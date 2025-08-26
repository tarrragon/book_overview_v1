/**
 * ErrorInjector - 錯誤注入工具
 * 用於測試中模擬各種錯誤場景
 *
 * @author TDD Phase 3 - pepper-test-implementer規劃
 * @date 2025-08-25
 */

class ErrorInjector {
  constructor () {
    this.originalMethods = new Map()
    this.errorConfig = {
      probability: 1.0, // 預設100%錯誤率
      delay: 0 // 預設無延遲
    }
  }

  /**
   * 注入Chrome Extension API錯誤
   * @param {string} api - API名稱 (chrome.storage, chrome.runtime等)
   * @param {string} method - 方法名稱
   * @param {Error} error - 要拋出的錯誤
   */
  injectChromeApiError (api, method, error) {
    const fullPath = `${api}.${method}`

    // 保存原始方法
    const originalMethod = this._getNestedProperty(window, fullPath)
    this.originalMethods.set(fullPath, originalMethod)

    // 注入錯誤
    this._setNestedProperty(window, fullPath, () => {
      throw error
    })
  }

  /**
   * 注入網路請求錯誤
   * @param {string} type - 錯誤類型 (timeout, network, dns)
   * @param {number} delay - 延遲時間(ms)
   */
  injectNetworkError (type, delay = 0) {
    const originalFetch = window.fetch
    this.originalMethods.set('window.fetch', originalFetch)

    window.fetch = async (...args) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      switch (type) {
        case 'timeout':
          throw new Error('Request timeout')
        case 'network':
          throw new Error('Network error')
        case 'dns':
          throw new Error('DNS resolution failed')
        default:
          throw new Error('Unknown network error')
      }
    }
  }

  /**
   * 注入DOM操作錯誤
   * @param {string} selector - CSS選擇器
   * @param {boolean} returnNull - 是否返回null
   */
  injectDomError (selector, returnNull = true) {
    const originalQuerySelector = document.querySelector
    const originalQuerySelectorAll = document.querySelectorAll

    this.originalMethods.set('document.querySelector', originalQuerySelector)
    this.originalMethods.set('document.querySelectorAll', originalQuerySelectorAll)

    document.querySelector = (sel) => {
      if (sel === selector) {
        return returnNull ? null : originalQuerySelector.call(document, sel)
      }
      return originalQuerySelector.call(document, sel)
    }

    document.querySelectorAll = (sel) => {
      if (sel === selector) {
        return returnNull ? [] : originalQuerySelectorAll.call(document, sel)
      }
      return originalQuerySelectorAll.call(document, sel)
    }
  }

  /**
   * 注入資料處理錯誤
   * @param {string} method - 方法名稱 (JSON.parse, JSON.stringify)
   * @param {Error} error - 要拋出的錯誤
   */
  injectDataProcessingError (method, error) {
    if (method === 'JSON.parse') {
      const original = JSON.parse
      this.originalMethods.set('JSON.parse', original)

      JSON.parse = (text) => {
        throw error
      }
    } else if (method === 'JSON.stringify') {
      const original = JSON.stringify
      this.originalMethods.set('JSON.stringify', original)

      JSON.stringify = (value) => {
        throw error
      }
    }
  }

  /**
   * 注入記憶體限制錯誤
   */
  injectMemoryError () {
    // 模擬記憶體不足情況
    const originalArrayConstructor = Array
    this.originalMethods.set('Array', originalArrayConstructor)

    window.Array = function (...args) {
      if (args.length === 1 && args[0] > 1000000) {
        throw new Error('Out of memory')
      }
      return new originalArrayConstructor(...args)
    }
  }

  /**
   * 恢復所有原始方法
   */
  restoreAll () {
    for (const [path, originalMethod] of this.originalMethods) {
      this._restoreMethod(path, originalMethod)
    }
    this.originalMethods.clear()
  }

  /**
   * 恢復單一方法
   * @private
   */
  _restoreMethod (path, originalMethod) {
    if (path.includes('.')) {
      this._restoreNestedProperty(path, originalMethod)
    } else {
      this._restoreGlobalMethod(path, originalMethod)
    }
  }

  /**
   * 恢復嵌套屬性
   * @private
   */
  _restoreNestedProperty (path, originalMethod) {
    this._setNestedProperty(window, path, originalMethod)
  }

  /**
   * 恢復全域方法
   * @private
   */
  _restoreGlobalMethod (path, originalMethod) {
    if (this._isJsonMethod(path)) {
      this._restoreJsonMethod(path, originalMethod)
    } else if (path === 'Array') {
      window.Array = originalMethod
    } else if (path.startsWith('document.')) {
      this._restoreDocumentMethod(path, originalMethod)
    }
  }

  /**
   * 檢查是否為JSON方法
   * @private
   */
  _isJsonMethod (path) {
    return path === 'JSON.parse' || path === 'JSON.stringify'
  }

  /**
   * 恢復JSON方法
   * @private
   */
  _restoreJsonMethod (path, originalMethod) {
    if (path === 'JSON.parse') {
      JSON.parse = originalMethod
    } else {
      JSON.stringify = originalMethod
    }
  }

  /**
   * 恢復文件方法
   * @private
   */
  _restoreDocumentMethod (path, originalMethod) {
    const methodName = path.split('.')[1]
    document[methodName] = originalMethod
  }

  /**
   * 設置錯誤發生概率
   * @param {number} probability - 概率 (0-1)
   */
  setProbability (probability) {
    this.errorConfig.probability = Math.max(0, Math.min(1, probability))
  }

  /**
   * 檢查是否應該觸發錯誤
   * @returns {boolean}
   */
  shouldTriggerError () {
    return Math.random() < this.errorConfig.probability
  }

  /**
   * 輔助方法：獲取嵌套屬性
   * @private
   */
  _getNestedProperty (obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj)
  }

  /**
   * 輔助方法：設置嵌套屬性
   * @private
   */
  _setNestedProperty (obj, path, value) {
    const keys = path.split('.')
    const lastKey = keys.pop()
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {}
      return current[key]
    }, obj)
    target[lastKey] = value
  }
}

module.exports = ErrorInjector
