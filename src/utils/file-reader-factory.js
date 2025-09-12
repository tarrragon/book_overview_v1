/**
 * FileReaderFactory - FileReader 工廠模式
 *
 * 負責功能：
 * - 統一 FileReader 實例建立
 * - 相容性檢查和處理
 * - 測試環境支援
 *
 * 設計考量：
 * - 遵循 Five Lines 規則
 * - 單一責任原則：只負責建立 FileReader
 * - 更專業的錯誤訊息
 */

const { StandardError } = require('src/core/errors/StandardError')

class FileReaderFactory {
  /**
   * 建立 FileReader 實例
   * @returns {FileReader} FileReader 實例
   * @throws {Error} 當 FileReader 不可用時
   */
  static createReader () {
    if (global.FileReader) return new global.FileReader()
    if (typeof FileReader !== 'undefined') return new FileReader()
    throw new StandardError('UNKNOWN_ERROR', '檔案讀取功能不支援', {
      category: 'general'
    })
  }

  /**
   * 檢查 FileReader 是否可用
   * @returns {boolean} 是否可用
   */
  static isAvailable () {
    return Boolean(global.FileReader || typeof FileReader !== 'undefined')
  }
}

module.exports = FileReaderFactory
