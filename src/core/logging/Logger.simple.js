/**
 * 簡化版 Logger - 基於 Linux "Good Taste" 原則重構
 *
 * 設計原則：
 * - 解決實際問題，不解決假想問題
 * - 單一API，避免選擇困惑
 * - 簡單直接，任何人都能在5分鐘內理解
 * - 專注於日誌本身，不是虛假的優化
 */

class Logger {
  constructor (name, level = 'INFO') {
    this.name = name
    this.level = level
    this.levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }
  }

  _shouldLog (level) {
    return this.levels[level] >= this.levels[this.level]
  }

  _log (level, message, data = {}) {
    if (!this._shouldLog(level)) return

    const entry = {
      level,
      name: this.name,
      message,
      data,
      timestamp: Date.now()
    }

    // 序列化為單一字串輸出（0.18.0-W6-012.3）：
    // 避免外部觀測工具（chrome-devtools-mcp 等）取得 console message text
    // 時，物件參數降為 [object Object] 失去可讀性
    const output = Logger._safeSerialize(entry)

    switch (level) {
      case 'ERROR':
        // eslint-disable-next-line no-console
        console.error(output)
        break
      case 'WARN':
        // eslint-disable-next-line no-console
        console.warn(output)
        break
      case 'DEBUG':
        // eslint-disable-next-line no-console
        console.debug(output)
        break
      default:
        // eslint-disable-next-line no-console
        console.info(output)
    }
  }

  /**
   * 安全序列化 entry 為可讀字串（與 Logger.js _safeSerialize 行為一致）
   *
   * 設計原則：循環引用以 '[Circular]' 替代；Error 物件展開保留 stack；
   * 序列化失敗時降級為錯誤訊息字串，確保任何情況都有可讀輸出。
   *
   * @param {Object} entry - 日誌項目
   * @returns {string}
   */
  static _safeSerialize (entry) {
    try {
      const seen = new WeakSet()
      const replacer = (key, value) => {
        if (value instanceof Error) {
          return { name: value.name, message: value.message, stack: value.stack }
        }
        if (typeof value === 'function') {
          return `[Function: ${value.name || 'anonymous'}]`
        }
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]'
          seen.add(value)
        }
        return value
      }
      return JSON.stringify(entry, replacer, 2)
    } catch (e) {
      return `[Logger Serialize Failed: ${e && e.message}]`
    }
  }

  debug (message, data) {
    this._log('DEBUG', message, data)
  }

  info (message, data) {
    this._log('INFO', message, data)
  }

  warn (message, data) {
    this._log('WARN', message, data)
  }

  error (message, data) {
    this._log('ERROR', message, data)
  }
}

// 唯一的匯出方式
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Logger }
} else if (typeof window !== 'undefined') {
  window.Logger = Logger
}
