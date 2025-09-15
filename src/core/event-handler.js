const { Logger } = require('src/core/logging/Logger')
const { StandardError } = require('src/core/errors/StandardError')

/**
 * 事件處理器基底類別
 * 提供統一的事件處理介面和統計功能
 *
 * 負責功能：
 * - 定義事件處理的標準生命週期
 * - 提供統計追蹤和效能監控
 * - 實現統一的錯誤處理機制
 * - 確保子類別實現必要的抽象方法
 *
 * 設計考量：
 * - 抽象基底類別，子類別必須實現 process 和 getSupportedEvents
 * - 支援啟用/停用機制
 * - 統計資訊包含執行次數、執行時間等
 * - 使用 performance.now() 提供高精度時間測量
 *
 * 處理流程：
 * 1. 檢查處理器是否啟用
 * 2. 執行 beforeHandle 前處理
 * 3. 調用 process 主要處理邏輯
 * 4. 執行 afterHandle 後處理
 * 5. 更新統計資訊
 * 6. 錯誤時調用 onError 處理
 *
 * 使用情境：
 * - 所有具體事件處理器的基底類別
 * - 提供標準化的事件處理介面
 * - 確保處理器的統一實現模式
 */
class EventHandler {
  /**
   * 建構事件處理器
   * @param {string} name - 處理器名稱
   * @param {number} priority - 優先級 (0: 最高, 越大越低)
   */
  constructor (name, priority = 2) {
    this.name = name
    this.priority = priority
    this.isEnabled = true
    this.executionCount = 0
    this.lastExecutionTime = null
    this.averageExecutionTime = 0
    this.logger = new Logger(name || 'EventHandler')
  }

  /**
   * 處理事件的主要方法
   * 負責完整的事件處理生命週期
   * @param {Object} event - 要處理的事件
   * @returns {Promise<any>} 處理結果
   */
  async handle (event) {
    if (!this.isEnabled) {
      return null
    }

    const startTime = performance.now()
    this.executionCount++

    try {
      // 預處理
      await this.beforeHandle(event)

      // 主要處理邏輯
      const result = await this.process(event)

      // 後處理
      await this.afterHandle(event, result)

      return result
    } catch (error) {
      await this.onError(event, error)
      throw error
    } finally {
      // 更新統計資訊
      const executionTime = performance.now() - startTime
      this.updateStats(executionTime)
    }
  }

  /**
   * 實際的處理邏輯 - 子類別必須實現
   * @param {Object} event - 要處理的事件
   * @returns {Promise<any>} 處理結果
   */
  async process (event) {
    throw new StandardError('IMPLEMENTATION_ERROR', 'Process method must be implemented by subclass')
  }

  /**
   * 處理前的準備工作
   * @param {Object} event - 要處理的事件
   */
  async beforeHandle (event) {
    // 預設實現：記錄日誌
    this.logger.info('EVENT_PROCESSING_START', { eventType: event.type })
  }

  /**
   * 處理後的清理工作
   * @param {Object} event - 已處理的事件
   * @param {any} result - 處理結果
   */
  async afterHandle (event, result) {
    // 預設實現：記錄結果
    this.logger.info('EVENT_PROCESSING_COMPLETE', { eventType: event.type })
  }

  /**
   * 錯誤處理
   * @param {Object} event - 發生錯誤的事件
   * @param {Error} error - 錯誤物件
   */
  async onError (event, error) {
    // eslint-disable-next-line no-console
    this.logger.error('EVENT_PROCESSING_ERROR', { eventType: event.type, error: error.message })
  }

  /**
   * 更新執行統計
   * @param {number} executionTime - 執行時間（毫秒）
   */
  updateStats (executionTime) {
    this.lastExecutionTime = executionTime
    this.averageExecutionTime =
      (this.averageExecutionTime * (this.executionCount - 1) + executionTime) /
      this.executionCount
  }

  /**
   * 檢查是否可以處理指定事件
   * @param {string} eventType - 事件類型
   * @returns {boolean} 是否支援該事件類型
   */
  canHandle (eventType) {
    return this.getSupportedEvents().includes(eventType)
  }

  /**
   * 取得支援的事件類型 - 子類別必須實現
   * @returns {string[]} 支援的事件類型列表
   */
  getSupportedEvents () {
    throw new StandardError('IMPLEMENTATION_ERROR', 'getSupportedEvents method must be implemented by subclass')
  }

  /**
   * 啟用/停用處理器
   * @param {boolean} enabled - 是否啟用
   */
  setEnabled (enabled) {
    this.isEnabled = enabled
  }

  /**
   * 取得處理器統計資訊
   * @returns {Object} 統計資訊物件
   */
  getStats () {
    return {
      name: this.name,
      executionCount: this.executionCount,
      lastExecutionTime: this.lastExecutionTime,
      averageExecutionTime: this.averageExecutionTime,
      isEnabled: this.isEnabled
    }
  }
}

// 瀏覽器環境：將 EventHandler 定義為全域變數
if (typeof window !== 'undefined') {
  window.EventHandler = EventHandler
}

// Node.js 環境：保持 CommonJS 匯出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventHandler
}
