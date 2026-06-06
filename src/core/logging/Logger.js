/**
 * 統一日誌系統
 *
 * 設計目標：
 * - 替換所有 console.log 使用，解決 3760個 lint 問題
 * - 提供結構化日誌輸出，支援不同等級過濾
 * - 日誌輸出時間 < 1ms
 * - 與 MessageDictionary 整合，統一文字管理
 * - 支援 Chrome Extension 環境
 *
 * @example
 * const logger = new Logger('BookExtraction')
 * logger.info('OPERATION_COMPLETE', { bookCount: 5 })
 * logger.error('VALIDATION_FAILED', { field: 'title', error: 'required' })
 */

// 條件性引入，支援瀏覽器和 Node.js 環境
// W1-119.3: 移除影子 fallback messages dict（與 W1-110 SSOT 設計一致）
// require fail 極少觸發（僅 Node.js + 路徑壞），提供最小 stub 維持 Logger init 不 crash
// stub 行為與 MessageDictionary.get() 對未註冊 key 的回應一致（'[Missing: KEY]'）
let GlobalMessages
if (typeof require !== 'undefined') {
  try {
    GlobalMessages = require('src/core/messages/MessageDictionary').GlobalMessages
  } catch (e) {
    GlobalMessages = { get: (key) => '[Missing: ' + key + ']' }
  }
}

/**
 * 日誌等級常數
 */
const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
}

/**
 * 日誌等級優先級（數字越大優先級越高）
 */
const LEVEL_PRIORITIES = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
}

class Logger {
  /**
   * 建立 Logger 實例
   *
   * 業務情境：caller 可注入自訂 MessageDictionary（local dict）以覆寫 GlobalMessages
   * 預設行為。W1-112 ANA 根因：原 constructor 僅 (name, level)，hardcoded
   * this.messages = GlobalMessages，導致 popup/search-filter/validator 等 3 處
   * `new Logger('Name', 'INFO', localMessages)` 的第三參數被 JS 靜默 ignore，
   * 整個 local dict 機制從未生效（W1-105 修 MessageDictionary union signature
   * 雖通過測試但 runtime 無效用）。
   *
   * @param {string} name - Logger 名稱
   * @param {string} level - 日誌等級（預設: 'INFO'）
   * @param {Object} messages - 訊息字典（預設: GlobalMessages，可注入 local dict）
   */
  constructor (name = 'App', level = 'INFO', messages = GlobalMessages) {
    this.name = name
    this.level = level
    this.messages = messages
    this._buffer = [] // 用於緩衝日誌（如果需要）
    this._maxBufferSize = 100
  }

  /**
   * 除錯訊息
   * @param {string} messageKey - 訊息鍵值
   * @param {Object} data - 額外資料
   */
  debug (messageKey, data = {}) {
    if (this._shouldLog('DEBUG')) {
      this._output('DEBUG', messageKey, data)
    }
  }

  /**
   * 資訊訊息
   * @param {string} messageKey - 訊息鍵值
   * @param {Object} data - 額外資料
   */
  info (messageKey, data = {}) {
    if (this._shouldLog('INFO')) {
      this._output('INFO', messageKey, data)
    }
  }

  /**
   * 警告訊息
   * @param {string} messageKey - 訊息鍵值
   * @param {Object} data - 額外資料
   */
  warn (messageKey, data = {}) {
    if (this._shouldLog('WARN')) {
      this._output('WARN', messageKey, data)
    }
  }

  /**
   * 錯誤訊息
   * @param {string} messageKey - 訊息鍵值
   * @param {Object} data - 額外資料
   */
  error (messageKey, data = {}) {
    if (this._shouldLog('ERROR')) {
      this._output('ERROR', messageKey, data)
    }
  }

  /**
   * 檢查是否應該輸出該等級的日誌
   * @private
   * @param {string} level - 要檢查的日誌等級
   * @returns {boolean} 是否應該輸出
   */
  _shouldLog (level) {
    const currentPriority = LEVEL_PRIORITIES[this.level] || LEVEL_PRIORITIES.INFO
    const targetPriority = LEVEL_PRIORITIES[level] || LEVEL_PRIORITIES.INFO
    return targetPriority >= currentPriority
  }

  /**
   * 輸出日誌（效能優化版本）
   * @private
   * @param {string} level - 日誌等級
   * @param {string} messageKey - 訊息鍵值
   * @param {Object} data - 額外資料
   */
  _output (level, messageKey, data) {
    try {
      const message = this.messages.get(messageKey, data)
      const timestamp = Date.now() // 使用數字時間戳，更高效

      // 延遲物件創建 - 只有在真正需要時才建立完整物件
      const logEntry = this._createLogEntry(timestamp, level, messageKey, message, data)

      this._consoleOutput(level, logEntry)

      if (this._buffer) {
        this._addToBuffer(logEntry)
      }
    } catch (error) {
      this._fallbackOutput(level, messageKey, data, error)
    }
  }

  /**
   * 創建日誌項目（延遲物件創建）
   * @private
   * @param {number} timestamp - 時間戳
   * @param {string} level - 日誌等級
   * @param {string} messageKey - 訊息鍵值
   * @param {string} message - 訊息內容
   * @param {Object} data - 額外資料
   * @returns {Object} 日誌項目
   */
  _createLogEntry (timestamp, level, messageKey, message, data) {
    return {
      timestamp,
      level,
      name: this.name,
      messageKey,
      message,
      data: Object.keys(data).length > 0 ? data : undefined
    }
  }

  /**
   * Console 輸出
   *
   * 設計考量（0.18.0-W6-012.3）：
   * - 將 logEntry 序列化為單一字串輸出，避免 chrome-devtools-mcp 等
   *   外部觀測工具取得 console message text 時，物件第二參數被降為
   *   `[object Object]` toString fallback（W6-012.1 實機 MCP 驗證觀察 16+ 次）
   * - JSON.stringify 含 circular reference 與 Error 物件 replacer
   * - 序列化失敗時降級為 messageKey 為核心的最小字串，確保任何情況都有可讀內容
   *
   * @private
   * @param {string} level - 日誌等級
   * @param {Object} logEntry - 日誌項目
   */
  _consoleOutput (level, logEntry) {
    const prefix = `[${level}]`
    const serialized = Logger._safeSerialize(logEntry)
    const output = `${prefix} ${serialized}`

    switch (level) {
      case 'DEBUG':
        // eslint-disable-next-line no-console
        if (console.debug) {
          // eslint-disable-next-line no-console
          console.debug(output)
        } else {
          // eslint-disable-next-line no-console
          console.log(output)
        }
        break
      case 'INFO':
        // eslint-disable-next-line no-console
        if (console.info) {
          // eslint-disable-next-line no-console
          console.info(output)
        } else {
          // eslint-disable-next-line no-console
          console.log(output)
        }
        break
      case 'WARN':
        // eslint-disable-next-line no-console
        if (console.warn) {
          // eslint-disable-next-line no-console
          console.warn(output)
        } else {
          // eslint-disable-next-line no-console
          console.log(output)
        }
        break
      case 'ERROR':
        // eslint-disable-next-line no-console
        if (console.error) {
          // eslint-disable-next-line no-console
          console.error(output)
        } else {
          // eslint-disable-next-line no-console
          console.log(output)
        }
        break
      default:
        // eslint-disable-next-line no-console
        console.log(output)
    }
  }

  /**
   * 安全序列化 logEntry 為可讀字串
   *
   * 設計考量（0.18.0-W6-012.3）：
   * - 使用 WeakSet 偵測循環引用，遇到時以 '[Circular]' 替代避免 stack overflow
   * - Error 物件展開為 `{ name, message, stack }`，保留可 debug 資訊
   * - function / undefined 給予可讀字串標示，避免被 JSON.stringify 丟棄
   * - 整體序列化失敗時，降級輸出含 messageKey 的最小 JSON 字串
   *
   * @private
   * @param {Object} logEntry - 日誌項目
   * @returns {string} JSON 字串（縮排 2 空白）或降級訊息
   */
  static _safeSerialize (logEntry) {
    try {
      const seen = new WeakSet()
      const replacer = (key, value) => {
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack
          }
        }
        if (typeof value === 'function') {
          return `[Function: ${value.name || 'anonymous'}]`
        }
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]'
          }
          seen.add(value)
        }
        return value
      }
      return JSON.stringify(logEntry, replacer, 2)
    } catch (serializeError) {
      // 序列化失敗的最後防線：盡量輸出 messageKey / level / name 三欄
      try {
        const fallback = {
          level: logEntry && logEntry.level,
          name: logEntry && logEntry.name,
          messageKey: logEntry && logEntry.messageKey,
          message: logEntry && logEntry.message,
          serializeError: serializeError && serializeError.message
        }
        return JSON.stringify(fallback)
      } catch (_) {
        return '[Logger Serialize Failed]'
      }
    }
  }

  /**
   * 後備輸出機制（當主要日誌系統失敗時）
   * @private
   * @param {string} level - 日誌等級
   * @param {string} messageKey - 訊息鍵值
   * @param {Object} data - 額外資料
   * @param {Error} error - 原始錯誤
   */
  _fallbackOutput (level, messageKey, data, error) {
    const fallbackMessage = `[${level}][${this.name}] ${messageKey}`

    try {
      // eslint-disable-next-line no-console
      console.error('[Logger Fallback]', {
        level,
        name: this.name,
        messageKey,
        data,
        originalError: error.message
      })
    } catch (fallbackError) {
      // 最後的後備機制
      // eslint-disable-next-line no-console
      console.error(`[Logger Critical] ${fallbackMessage}`)
    }
  }

  /**
   * 新增日誌到緩衝區
   * @private
   * @param {Object} logEntry - 日誌項目
   */
  _addToBuffer (logEntry) {
    this._buffer.push(logEntry)

    // 限制緩衝區大小
    if (this._buffer.length > this._maxBufferSize) {
      this._buffer.shift() // 移除最舊的日誌
    }
  }

  /**
   * 設定日誌等級
   * @param {string} level - 新的日誌等級
   */
  setLevel (level) {
    if (LOG_LEVELS[level]) {
      this.level = level
    } else {
      this.warn('INVALID_LOG_LEVEL', { level, validLevels: Object.keys(LOG_LEVELS) })
    }
  }

  /**
   * 取得當前日誌等級
   * @returns {string} 當前日誌等級
   */
  getLevel () {
    return this.level
  }

  /**
   * 取得緩衝區中的日誌
   * @returns {Array} 日誌項目陣列
   */
  getBuffer () {
    return [...this._buffer]
  }

  /**
   * 清空緩衝區
   */
  clearBuffer () {
    this._buffer = []
  }

  /**
   * 停用緩衝區
   */
  disableBuffer () {
    this._buffer = null
  }

  /**
   * 啟用緩衝區
   */
  enableBuffer () {
    if (!this._buffer) {
      this._buffer = []
    }
  }

  /**
   * 取得 Logger 統計資訊
   * @returns {Object} 統計資訊
   */
  getStats () {
    return {
      name: this.name,
      level: this.level,
      bufferEnabled: this._buffer !== null,
      bufferSize: this._buffer ? this._buffer.length : 0,
      maxBufferSize: this._maxBufferSize
    }
  }

  /**
   * 直接輸出訊息（不經過訊息字典，用於緊急情況）
   * @param {string} level - 日誌等級
   * @param {string} message - 直接訊息
   * @param {Object} data - 額外資料
   */
  direct (level, message, data = {}) {
    if (!this._shouldLog(level)) {
      return
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      name: this.name,
      message,
      data: Object.keys(data).length > 0 ? data : undefined,
      direct: true
    }

    this._consoleOutput(level, logEntry)
  }

  /**
   * 靜態方法 - 使用預設全域實例記錄除錯訊息
   * @param {string} messageKey - 訊息鍵值或直接訊息
   * @param {Object} data - 額外資料
   */
  static debug (messageKey, data = {}) {
    Logger._getDefaultInstance().direct('DEBUG', messageKey, typeof data === 'object' ? data : {})
  }

  /**
   * 靜態方法 - 使用預設全域實例記錄資訊訊息
   * @param {string} messageKey - 訊息鍵值或直接訊息
   * @param {Object} data - 額外資料
   */
  static info (messageKey, data = {}) {
    Logger._getDefaultInstance().direct('INFO', messageKey, typeof data === 'object' ? data : {})
  }

  /**
   * 靜態方法 - 使用預設全域實例記錄警告訊息
   * @param {string} messageKey - 訊息鍵值或直接訊息
   * @param {Object} data - 額外資料
   */
  static warn (messageKey, data = {}) {
    Logger._getDefaultInstance().direct('WARN', messageKey, typeof data === 'object' ? data : {})
  }

  /**
   * 靜態方法 - 使用預設全域實例記錄錯誤訊息
   * @param {string} messageKey - 訊息鍵值或直接訊息
   * @param {Object} data - 額外資料
   */
  static error (messageKey, data = {}) {
    Logger._getDefaultInstance().direct('ERROR', messageKey, typeof data === 'object' ? data : {})
  }

  /**
   * 取得預設全域 Logger 實例（懶載入）
   * @returns {Logger} 預設 Logger 實例
   * @private
   */
  static _getDefaultInstance () {
    if (!Logger._defaultInstance) {
      Logger._defaultInstance = new Logger('App', 'DEBUG')
    }
    return Logger._defaultInstance
  }
}

// 預設實例快取
Logger._defaultInstance = null

// classic script（非模組）全域掛載：popup.js fallback chain（window.Logger）需要。
// 原 `if (module.exports) {...} else if (window) {...}` 的 CJS 分支已移除：
// - Jest（CJS）：Babel（.babelrc modules:'commonjs'）將下方 ESM `export` 轉為
//   exports.Logger / exports.LOG_LEVELS，require() 消費者照常取得具名匯出，
//   無需顯式 module.exports。
// - esbuild bundle（ESM）：透過下方 `export` 解析；bundle 內 CJS require() 消費者
//   由 esbuild __toCommonJS interop 路由，亦不經 module.exports。
// 因此 module.exports 在兩條消費路徑皆為死碼，移除可消除 esbuild
// commonjs-variable-in-esm warning（1.0.0-W2-004），同時保留 window 全域掛載。
if (typeof window !== 'undefined') {
  window.Logger = Logger
  window.LOG_LEVELS = LOG_LEVELS
}

// ES module export（Chrome Extension Service Worker 需要）
export { Logger, LOG_LEVELS }
