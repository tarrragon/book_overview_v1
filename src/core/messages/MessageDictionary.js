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

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class MessageDictionary {
  /**
   * 建立訊息字典實例
   *
   * Union signature：依參數型別分流
   * - string：作為語言代碼（向後相容既有呼叫端）
   * - object：作為初始 messages 物件，批次註冊至 this.messages
   * - undefined：使用預設語言 'zh-TW'
   *
   * @param {string|Object} languageOrMessages - 語言代碼或初始 messages 物件
   */
  constructor (languageOrMessages = 'zh-TW') {
    // 先初始化 cache 欄位與預設訊息（addMessages 內部需要這些欄位）
    this._cacheSize = 0
    this._maxCacheSize = 100 * 1024 // 100KB 限制
    this.messages = this._loadDefaultMessages()
    this._updateCacheSize()

    if (typeof languageOrMessages === 'object' && languageOrMessages !== null) {
      // Object 路徑：批次註冊自訂 messages，沿用預設 language
      this.language = 'zh-TW'
      this.addMessages(languageOrMessages) // 重用既有方法，含 cache size 檢查與型別驗證
    } else {
      // String 路徑或 undefined（向後相容）
      this.language = languageOrMessages || 'zh-TW'
    }
  }

  /**
   * 載入預設訊息
   *
   * 設計原則（W1-107 ANA → W1-109 落地）：
   * GlobalMessages 僅承載「真正跨模組共用」訊息（被 2+ 獨立模組引用、
   * 屬通用詞彙、無模組前綴）。Module-specific 訊息一律由該模組自有
   * local dict（new MessageDictionary({...}) 注入 Logger）承擔。
   *
   * 已外移到 local dict 的模組：
   * - popup (popupMessages, 22 keys) — src/popup/popup.js
   * - popup-error-handler (popupErrorHandlerMessages, 1 key) — src/popup/popup-error-handler.js
   * - search-filter (searchUIMessages, 14 keys) — src/ui/book-search-filter-integrated.js
   * - validator (validatorMessages, 22 keys) — src/platform/readmoo-platform-migration-validator.js
   * - readmoo-adapter (readmooAdapterMessages, 36 keys) — src/content/adapters/readmoo-adapter.js
   * - background (BACKGROUND_STARTUP 等 27 keys) — src/background/background.js 已遷移為
   *   backgroundMessages local dict（W1-110.1）
   * - filter-engine (filterEngineMessages, 1 key FILTER_UNKNOWN_CONDITION) —
   *   src/ui/search/filter/filter-engine.js（W1-119.1）
   * - search-engine (searchEngineMessages, 1 key SEARCH_INDEX_FALLBACK_TO_LINEAR) —
   *   src/ui/search/core/search-engine.js（W1-119.1）
   * - platform-detection-service (platformDetectionMessages, 1 key
   *   EVENT_LISTENER_REGISTRATION_FAILED) — src/background/domains/platform/services/
   *   platform-detection-service.js（W1-119.1）
   *
   * W1-119.1 收尾：3 個中文 legacy keys（未知的篩選條件 / 索引搜尋失敗... /
   * Event listener registration failed）已隨 caller 建立 local dict 完成清理。
   * GlobalMessages 進入「僅 21 個跨模組共用 key」的最終穩態。
   *
   * @private
   * @returns {Object} 預設訊息物件（21 個跨模組共用 key）
   */
  _loadDefaultMessages () {
    return {
      // 錯誤類（5）
      VALIDATION_FAILED: '資料驗證失敗',
      NETWORK_ERROR: '網路連線異常',
      STORAGE_ERROR: '儲存操作失敗',
      PERMISSION_DENIED: '權限不足',
      UNKNOWN_ERROR: '未知錯誤',

      // 操作類（5）
      OPERATION_START: '開始執行操作',
      OPERATION_COMPLETE: '操作完成',
      OPERATION_CANCELLED: '操作已取消',
      OPERATION_TIMEOUT: '操作逾時',
      OPERATION_RETRY: '重試操作',

      // 系統類（4）
      SYSTEM_READY: '系統準備就緒',
      SYSTEM_SHUTDOWN: '系統正在關閉',
      LOADING: '載入中...',
      PROCESSING: '處理中...',

      // 通用 UI（5）
      SUCCESS: '成功',
      FAILED: '失敗',
      RETRY: '重試',
      CANCEL: '取消',
      CONFIRM: '確認',

      // 測試專用（2）— 跨多個測試套件共用
      TEST_MESSAGE: '測試訊息',
      TEST_WITH_PARAMS: '測試參數: {param1} 和 {param2}'
    }
  }

  /**
   * 取得訊息
   * @param {string} key - 訊息鍵值
   * @param {Object} params - 參數物件
   * @returns {string} 處理後的訊息
   */
  get (key, params = {}) {
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
  _replaceParameters (message, params) {
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
  _escapeRegExp (string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * 設定或更新訊息
   * @param {string} key - 訊息鍵值
   * @param {string} message - 訊息內容
   */
  set (key, message) {
    if (typeof key !== 'string' || typeof message !== 'string') {
      const error = new Error('Message key and value must be strings')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'general' }
      throw error
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
  addMessages (messages) {
    if (!messages || typeof messages !== 'object') {
      const error = new Error('Messages must be an object')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = {
        dataType: 'object',
        category: 'general'
      }
      throw error
    }

    // 檢查總大小限制
    const estimatedSize = this._estimateSize(messages)
    if (this._cacheSize + estimatedSize > this._maxCacheSize) {
      const error = new Error('Adding messages would exceed cache size limit')
      error.code = ErrorCodes.VALIDATION_ERROR
      error.details = { category: 'general' }
      throw error
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
  _checkCacheSize (key, message) {
    const itemSize = this._estimateSize({ [key]: message })

    if (this._cacheSize + itemSize > this._maxCacheSize) {
      // W1-119.2: 改用 console.warn 移除對 Logger 的循環依賴
      // 設計：messages 是底層 primitive，不應依賴 logging（依賴方向原則）
      // eslint-disable-next-line no-console
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
  _estimateSize (obj) {
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
  _updateCacheSize () {
    this._cacheSize = this._estimateSize(this.messages)
  }

  /**
   * 檢查訊息是否存在
   * @param {string} key - 訊息鍵值
   * @returns {boolean} 是否存在
   */
  has (key) {
    return Object.prototype.hasOwnProperty.call(this.messages, key)
  }

  /**
   * 刪除訊息
   * @param {string} key - 要刪除的訊息鍵值
   * @returns {boolean} 是否成功刪除
   */
  delete (key) {
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
  keys () {
    return Object.keys(this.messages)
  }

  /**
   * 取得訊息統計
   * @returns {Object} 統計資訊
   */
  getStats () {
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
  reset () {
    this.messages = this._loadDefaultMessages()
    this._updateCacheSize()
  }

  /**
   * 匯出所有訊息
   * @returns {Object} 所有訊息的複製
   */
  export () {
    return { ...this.messages }
  }
}

// 建立全域訊息字典實例
const GlobalMessages = new MessageDictionary()

// W1-110：對 GlobalMessages.messages 套用 Object.freeze 物理防護
//
// 設計依據（W1-107 議題 B 方案 3 結論）：
// W1-109 完成 _loadDefaultMessages 收斂（80 → 24 keys）、W1-110.1 完成 background
// 唯一動態寫入點移除後，GlobalMessages 進入「禁止任何後續變更」的穩態。對其
// messages 物件套 shallow freeze 提供物理層級防護，從根本上阻止：
//
// 1. 任何呼叫 GlobalMessages.set(key, value) 寫入嘗試（strict mode 拋 TypeError）
// 2. 任何呼叫 GlobalMessages.addMessages({...}) 寫入嘗試（同上）
// 3. 直接 GlobalMessages.messages.X = 'y' 寫入嘗試（同上）
// 4. delete GlobalMessages.messages.X 移除嘗試（同上）
//
// 模組層 ES Module 自動為 strict mode，違規寫入會立即拋錯，避免 W1-004 模式
// （popup-specific key 不知不覺加進 GlobalMessages）再次發生。
//
// 範圍說明：
// - 僅 freeze GlobalMessages（全域實例的 messages），不影響 new MessageDictionary({...})
//   建立的 local dict 實例（其 messages 物件未 freeze，仍可用 set/addMessages）。
// - shallow freeze 足夠：messages 結構為 { key: string }，無 nested object 需 deep freeze。
Object.freeze(GlobalMessages.messages)

// classic script（非模組）全域掛載：window 全域使用情境保留。
// 原 `if (module.exports) {...} else if (window) {...}` 的 CJS 分支已移除：
// - Jest（CJS）：Babel（.babelrc modules:'commonjs'）將下方 ESM `export` 轉為
//   exports.MessageDictionary / exports.GlobalMessages，require() 消費者照常
//   取得具名匯出，無需顯式 module.exports。
// - esbuild bundle（ESM）：透過下方 `export` 解析；bundle 內 CJS require() 消費者
//   由 esbuild __toCommonJS interop 路由，亦不經 module.exports。
// 因此 module.exports 在兩條消費路徑皆為死碼，移除可消除 esbuild
// commonjs-variable-in-esm warning（1.0.0-W2-004），同時保留 window 全域掛載。
if (typeof window !== 'undefined') {
  window.MessageDictionary = MessageDictionary
  window.GlobalMessages = GlobalMessages
}

// ES module export（Chrome Extension Service Worker 需要）
export { MessageDictionary, GlobalMessages }
