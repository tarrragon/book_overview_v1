/**
 * 集中化訊息字典系統
 * 
 * 設計目標：
 * - 集中化管理所有硬編碼文字，統一文字輸出
 * - 支援參數替換，處理動態內容
 * - 記憶體使用 < 100KB
 * - 查詢時間 < 0.1ms
 * - 支援多語系擴展（預留）
 * 
 * @example
 * const messages = new MessageDictionary()
 * messages.get('BOOK_COUNT', { count: 5 }) // "找到 5 本書"
 * messages.set('CUSTOM_MESSAGE', '自訂訊息: {value}')
 */

class MessageDictionary {
  /**
   * 建立訊息字典實例
   * @param {string} language - 語言代碼 (預設: 'zh-TW')
   */
  constructor(language = 'zh-TW') {
    this.messages = this._loadDefaultMessages()
    this.language = language
    this._cacheSize = 0
    this._maxCacheSize = 100 * 1024 // 100KB 限制
  }
  
  /**
   * 載入預設訊息
   * @private
   * @returns {Object} 預設訊息物件
   */
  _loadDefaultMessages() {
    return {
      // 錯誤訊息
      VALIDATION_FAILED: '資料驗證失敗',
      NETWORK_ERROR: '網路連線異常',
      STORAGE_ERROR: '儲存操作失敗',
      PERMISSION_DENIED: '權限不足',
      UNKNOWN_ERROR: '未知錯誤',
      
      // 操作訊息
      OPERATION_START: '開始執行操作',
      OPERATION_COMPLETE: '操作完成',
      OPERATION_CANCELLED: '操作已取消',
      OPERATION_TIMEOUT: '操作逾時',
      OPERATION_RETRY: '重試操作',
      
      // 系統訊息
      SYSTEM_READY: '系統準備就緒',
      SYSTEM_SHUTDOWN: '系統正在關閉',
      LOADING: '載入中...',
      PROCESSING: '處理中...',
      
      // 書庫相關訊息
      BOOK_EXTRACTION_START: '開始提取書籍資料',
      BOOK_EXTRACTION_COMPLETE: '書籍資料提取完成',
      BOOK_COUNT: '找到 {count} 本書',
      BOOK_PROGRESS_UPDATE: '書籍 {title} 進度更新為 {progress}%',
      BOOK_VALIDATION_FAILED: '書籍 {title} 資料驗證失敗',
      
      // Chrome Extension 相關
      EXTENSION_READY: '擴充功能準備就緒',
      CONTENT_SCRIPT_LOADED: '內容腳本已載入',
      POPUP_OPENED: '彈出視窗已開啟',
      BACKGROUND_SCRIPT_ACTIVE: '背景腳本運行中',
      
      // 使用者訊息
      SUCCESS: '成功',
      FAILED: '失敗',
      RETRY: '重試',
      CANCEL: '取消',
      CONFIRM: '確認',
      
      // 測試專用訊息
      TEST_MESSAGE: '測試訊息',
      TEST_WITH_PARAMS: '測試參數: {param1} 和 {param2}',
      
      // 日誌相關
      DEBUG_MESSAGE: '除錯訊息: {message}',
      INFO_MESSAGE: '資訊: {message}',
      WARN_MESSAGE: '警告: {message}',
      ERROR_MESSAGE: '錯誤: {message}'
    }
  }
  
  /**
   * 取得訊息
   * @param {string} key - 訊息鍵值
   * @param {Object} params - 參數物件
   * @returns {string} 處理後的訊息
   */
  get(key, params = {}) {
    const message = this.messages[key]
    return message ? this._replaceParameters(message, params) : `[Missing: ${key}]`
  }
  
  /**
   * 參數替換處理
   * @private
   * @param {string} message - 原始訊息
   * @param {Object} params - 參數物件
   * @returns {string} 替換後的訊息
   */
  _replaceParameters(message, params) {
    try {
      let result = message
      
      // 替換所有 {key} 格式的參數
      Object.keys(params).forEach(param => {
        const placeholder = `{${param}}`
        const value = params[param]
        
        // 處理不同類型的參數值
        let replacement
        if (value === null || value === undefined) {
          replacement = ''
        } else if (typeof value === 'object') {
          replacement = JSON.stringify(value)
        } else {
          replacement = String(value)
        }
        
        // 全域替換
        result = result.replace(new RegExp(this._escapeRegExp(placeholder), 'g'), replacement)
      })
      
      return result
    } catch (error) {
      // 參數替換失敗時返回原始訊息
      return message
    }
  }
  
  /**
   * 跳脫正則表達式特殊字符
   * @private
   * @param {string} string - 要跳脫的字串
   * @returns {string} 跳脫後的字串
   */
  _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  
  /**
   * 設定或更新訊息
   * @param {string} key - 訊息鍵值
   * @param {string} message - 訊息內容
   */
  set(key, message) {
    if (typeof key !== 'string' || typeof message !== 'string') {
      throw new Error('Message key and value must be strings')
    }
    
    // 檢查快取大小限制
    if (this._checkCacheSize(key, message)) {
      this.messages[key] = message
      this._updateCacheSize()
    }
  }
  
  /**
   * 批次新增訊息
   * @param {Object} messages - 訊息物件
   */
  addMessages(messages) {
    if (!messages || typeof messages !== 'object') {
      throw new Error('Messages must be an object')
    }
    
    // 檢查總大小限制
    const estimatedSize = this._estimateSize(messages)
    if (this._cacheSize + estimatedSize > this._maxCacheSize) {
      throw new Error('Adding messages would exceed cache size limit')
    }
    
    Object.assign(this.messages, messages)
    this._updateCacheSize()
  }
  
  /**
   * 檢查快取大小限制
   * @private
   * @param {string} key - 鍵值
   * @param {string} message - 訊息
   * @returns {boolean} 是否在限制內
   */
  _checkCacheSize(key, message) {
    const itemSize = this._estimateSize({ [key]: message })
    
    if (this._cacheSize + itemSize > this._maxCacheSize) {
      console.warn(`MessageDictionary: Adding "${key}" would exceed cache limit (${this._maxCacheSize / 1024}KB)`)
      return false
    }
    
    return true
  }
  
  /**
   * 估算物件大小
   * @private
   * @param {Object} obj - 要估算的物件
   * @returns {number} 估算的位元組大小
   */
  _estimateSize(obj) {
    try {
      return JSON.stringify(obj).length * 2 // 每個字符約 2 bytes (Unicode)
    } catch (error) {
      return 1000 // 預設估算
    }
  }
  
  /**
   * 更新快取大小記錄
   * @private
   */
  _updateCacheSize() {
    this._cacheSize = this._estimateSize(this.messages)
  }
  
  /**
   * 檢查訊息是否存在
   * @param {string} key - 訊息鍵值
   * @returns {boolean} 是否存在
   */
  has(key) {
    return this.messages.hasOwnProperty(key)
  }
  
  /**
   * 刪除訊息
   * @param {string} key - 要刪除的訊息鍵值
   * @returns {boolean} 是否成功刪除
   */
  delete(key) {
    if (this.has(key)) {
      delete this.messages[key]
      this._updateCacheSize()
      return true
    }
    return false
  }
  
  /**
   * 取得所有訊息鍵值
   * @returns {Array<string>} 所有鍵值陣列
   */
  keys() {
    return Object.keys(this.messages)
  }
  
  /**
   * 取得訊息統計
   * @returns {Object} 統計資訊
   */
  getStats() {
    return {
      messageCount: Object.keys(this.messages).length,
      cacheSize: this._cacheSize,
      maxCacheSize: this._maxCacheSize,
      usage: `${((this._cacheSize / this._maxCacheSize) * 100).toFixed(2)}%`,
      language: this.language
    }
  }
  
  /**
   * 清空所有訊息（重置為預設）
   */
  reset() {
    this.messages = this._loadDefaultMessages()
    this._updateCacheSize()
  }
  
  /**
   * 匯出所有訊息
   * @returns {Object} 所有訊息的複製
   */
  export() {
    return { ...this.messages }
  }
}

// 建立全域訊息字典實例
const GlobalMessages = new MessageDictionary()

// 匯出類別和全域實例
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MessageDictionary, GlobalMessages }
} else if (typeof window !== 'undefined') {
  window.MessageDictionary = MessageDictionary
  window.GlobalMessages = GlobalMessages
}