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
 * const logger = createLogger('BookExtraction')
 * logger.info('OPERATION_COMPLETE', { bookCount: 5 })
 * logger.error('VALIDATION_FAILED', { field: 'title', error: 'required' })
 */

// 條件性引入，支援瀏覽器和 Node.js 環境
let GlobalMessages
if (typeof require !== 'undefined') {
  try {
    GlobalMessages = require('src/core/messages/MessageDictionary').GlobalMessages
  } catch (e) {
    // 瀏覽器環境或引入失敗時，使用後備方案
    GlobalMessages = {
      get: (key, params = {}) => {
        // 簡單的後備訊息系統
        const fallbackMessages = {
          DEBUG_MESSAGE: 'Debug: {message}',
          INFO_MESSAGE: 'Info: {message}',
          WARN_MESSAGE: 'Warning: {message}',
          ERROR_MESSAGE: 'Error: {message}'
        }
        return fallbackMessages[key] || key
      }
    }
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
   * @param {string} name - Logger 名稱
   * @param {string} level - 日誌等級（預設: 'INFO'）
   */
  constructor (name = 'App', level = 'INFO') {
    this.name = name
    this.level = level
    this.messages = GlobalMessages
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
   * @private
   * @param {string} level - 日誌等級
   * @param {Object} logEntry - 日誌項目
   */
  _consoleOutput (level, logEntry) {
    const prefix = `[${level}]`

    switch (level) {
      case 'DEBUG':
        if (console.debug) {
          console.debug(prefix, logEntry)
        } else {
          console.log(prefix, logEntry)
        }
        break
      case 'INFO':
        if (console.info) {
          console.info(prefix, logEntry)
        } else {
          console.log(prefix, logEntry)
        }
        break
      case 'WARN':
        if (console.warn) {
          console.warn(prefix, logEntry)
        } else {
          console.log(prefix, logEntry)
        }
        break
      case 'ERROR':
        if (console.error) {
          console.error(prefix, logEntry)
        } else {
          console.log(prefix, logEntry)
        }
        break
      default:
        console.log(prefix, logEntry)
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
      console.error('[Logger Fallback]', {
        level,
        name: this.name,
        messageKey,
        data,
        originalError: error.message
      })
    } catch (fallbackError) {
      // 最後的後備機制
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
}

/**
 * 建立 Logger 實例的工廠函數
 * @param {string} name - Logger 名稱
 * @param {string} level - 日誌等級（可選）
 * @returns {Logger} Logger 實例
 */
function createLogger (name, level = 'INFO') {
  return new Logger(name, level)
}

/**
 * 建立快捷 Logger（用於快速替換 console.log）
 * @param {string} name - Logger 名稱
 * @returns {Object} 包含常用方法的物件
 */
function quickLogger (name) {
  const logger = new Logger(name)

  return {
    log: (messageKey, data) => logger.info(messageKey, data),
    info: (messageKey, data) => logger.info(messageKey, data),
    warn: (messageKey, data) => logger.warn(messageKey, data),
    error: (messageKey, data) => logger.error(messageKey, data),
    debug: (messageKey, data) => logger.debug(messageKey, data)
  }
}

// 匯出類別和函數
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Logger,
    createLogger,
    quickLogger,
    LOG_LEVELS
  }
} else if (typeof window !== 'undefined') {
  window.Logger = Logger
  window.createLogger = createLogger
  window.quickLogger = quickLogger
  window.LOG_LEVELS = LOG_LEVELS
}
