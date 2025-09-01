/**
 * TimeoutHandler - 統一超時處理工具類
 *
 * 負責功能：
 * - 抽象 Promise.race 超時模式
 * - 提供可重用的超時處理邏輯
 * - 統一超時錯誤處理
 *
 * 設計考量：
 * - 遵循 Five Lines 規則
 * - 單一責任原則：只處理超時邏輯
 * - 可測試和可重用
 */

class TimeoutHandler {
  /**
   * 建立帶超時的 Promise
   * @param {Promise} promise - 原始 Promise
   * @param {number} delay - 超時時間(毫秒)
   * @param {*} timeoutResult - 超時時返回的結果
   * @returns {Promise} 帶超時的 Promise
   */
  static createTimeout (promise, delay, timeoutResult) {
    const timeoutPromise = this._createTimeoutPromise(delay, timeoutResult)
    return Promise.race([promise, timeoutPromise])
  }

  /**
   * 建立超時 Promise
   * @private
   */
  static _createTimeoutPromise (delay, timeoutResult) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(timeoutResult), delay)
    })
  }
}

module.exports = TimeoutHandler
