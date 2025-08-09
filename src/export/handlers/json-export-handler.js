/**
 * JSON 匯出事件處理器 - TDD循環 #29 Green階段實作
 * 
 * 負責功能：
 * - 處理 JSON 格式匯出請求事件
 * - 整合 BookDataExporter 執行 JSON 匯出
 * - 支援 JSON 格式的各種選項配置
 * - 提供進度追蹤和錯誤處理
 * 
 * 設計考量：
 * - 繼承自 EventHandler 基底類別
 * - 專門處理 JSON 相關匯出事件
 * - 支援大型資料集的高效處理
 * - 提供完整的選項傳遞機制
 * 
 * @version 1.0.0
 * @since 2025-08-08
 */

const EventHandler = require('../../core/event-handler');
const BookDataExporter = require('../book-data-exporter');
const { EXPORT_EVENTS } = require('../export-events');

/**
 * JSON 匯出處理器類別
 * 專門處理 JSON 格式的匯出請求
 */
class JSONExportHandler extends EventHandler {
  /**
   * 建構函數
   */
  constructor() {
    super('JSONExportHandler', 2);
    this.progressCallback = null;
  }

  /**
   * 獲取支援的事件類型
   * 
   * @returns {Array<string>} 支援的事件類型陣列
   */
  getSupportedEvents() {
    return [EXPORT_EVENTS.JSON_EXPORT_REQUESTED];
  }

  /**
   * 處理事件的核心邏輯
   * 
   * @param {Object} eventData - 事件資料
   * @param {Array} eventData.books - 書籍資料陣列
   * @param {Object} eventData.options - JSON 匯出選項
   * @returns {Promise<Object>} 處理結果
   */
  async process(eventData) {
    try {
      this._validateEventData(eventData);

      const exporter = new BookDataExporter(eventData.books);

      if (this.progressCallback) {
        exporter.setProgressCallback(this.progressCallback);
      }

      const jsonData = exporter.exportToJSON(eventData.options);

      return {
        success: true,
        data: jsonData,
        format: 'json',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * 設定進度回調函數
   * 
   * @param {Function} callback - 進度回調函數
   */
  setProgressCallback(callback) {
    if (typeof callback === 'function') {
      this.progressCallback = callback;
    }
  }

  /**
   * 驗證事件資料
   * 
   * @param {Object} eventData - 待驗證的事件資料
   * @throws {Error} 當資料無效時拋出錯誤
   * @private
   */
  _validateEventData(eventData) {
    if (!eventData) {
      throw new Error('Event data is required');
    }

    if (!eventData.books || !Array.isArray(eventData.books)) {
      throw new Error('Books array is required for JSON export');
    }

    if (!eventData.options || typeof eventData.options !== 'object') {
      eventData.options = {};
    }
  }

  /**
   * 事件處理前的預處理
   */
  async beforeHandle(event) {
    console.log(`[${this.name}] Processing JSON export request`);
  }

  /**
   * 事件處理後的後處理
   */
  async afterHandle(event, result) {
    console.log(`[${this.name}] JSON export completed successfully`);
  }

  /**
   * 錯誤處理
   */
  async onError(event, error) {
    console.error(`[${this.name}] JSON export failed:`, error.message);
  }
}

module.exports = JSONExportHandler;