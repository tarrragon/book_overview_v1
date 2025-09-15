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

    switch (level) {
      case 'ERROR':
        console.error(entry)
        break
      case 'WARN':
        console.warn(entry)
        break
      case 'DEBUG':
        console.debug(entry)
        break
      default:
        console.info(entry)
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
