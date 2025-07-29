/**
 * BookDataExtractor - Readmoo 書籍資料提取器
 * 
 * 負責功能：
 * - 繼承 EventHandler 提供標準化的事件處理能力
 * - 專注於 Readmoo 書城的資料提取
 * - 支援事件驅動的提取流程
 * - 提供 Readmoo 特定的 URL 識別和處理
 * - 整合 ReadmooAdapter 進行實際的資料提取
 * 
 * 設計考量：
 * - 高優先級 (HIGH) 確保提取任務優先處理
 * - 專用於 Readmoo 平台，簡化複雜度
 * - 事件驅動設計，與 EventBus 無縫整合
 * - 完整的錯誤處理和統計追蹤
 * 
 * 處理流程：
 * 1. 接收提取相關事件
 * 2. 識別 Readmoo 頁面 URL
 * 3. 初始化 ReadmooAdapter
 * 4. 執行資料提取和處理
 * 5. 發布提取結果事件
 * 
 * 使用情境：
 * - 使用者在 Readmoo 頁面觸發提取
 * - Tab 更新時自動檢測 Readmoo 頁面
 * - Popup 界面手動觸發提取
 */

const EventHandler = require('@/core/event-handler');

class BookDataExtractor extends EventHandler {
  /**
   * 建構函數
   * @param {Object} options - 配置選項
   */
  constructor(options = {}) {
    // 使用 HIGH 優先級確保提取任務優先處理
    super('BookDataExtractor', 1);
    
    // 確保 EventHandler 基礎屬性已初始化
    this.isEnabled = true;
    
    // 初始化提取狀態
    this.extractionState = {
      isExtracting: false,
      currentUrl: null,
      lastExtractionTime: null,
      extractedBooksCount: 0
    };
    
    // Readmoo 適配器 (稍後初始化)
    this.readmooAdapter = null;
    
    // 提取統計
    this.extractionStats = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      averageExtractionTime: 0
    };
    
    // 應用配置選項
    this.applyOptions(options);
  }

  /**
   * 應用配置選項
   * 設計考量：採用防禦性程式設計，確保無效選項不會影響建構
   * @param {Object} options - 配置選項
   * @param {boolean} [options.enableDebugLogging] - 啟用除錯日誌
   * @param {number} [options.maxRetries] - 最大重試次數
   */
  applyOptions(options) {
    if (options && typeof options === 'object') {
      // 暫時忽略配置選項，為未來擴展預留空間
      // 未來可加入：除錯模式、重試次數、超時設定等
    }
  }

  /**
   * 取得支援的事件類型
   * @returns {string[]} 支援的事件類型陣列
   */
  getSupportedEvents() {
    return [
      'EXTRACTION.STARTED',      // 開始提取事件
      'TAB.UPDATED.READMOO',     // Readmoo 頁面更新事件
      'USER.EXTRACT.REQUESTED'   // 使用者請求提取事件
    ];
  }

  /**
   * 處理事件的核心方法
   * @param {Object} event - 事件物件
   * @returns {Promise<any>} 處理結果
   */
  async process(event) {
    switch (event.type) {
      case 'EXTRACTION.STARTED':
        return await this.handleExtractionStart(event);
      
      case 'TAB.UPDATED.READMOO':
        return await this.handleTabUpdate(event);
      
      case 'USER.EXTRACT.REQUESTED':
        return await this.handleUserRequest(event);
      
      default:
        throw new Error(`Unsupported event type: ${event.type}`);
    }
  }

  /**
   * 處理提取開始事件
   * @param {Object} event - 提取開始事件
   * @returns {Promise<Object>} 處理結果
   */
  async handleExtractionStart(event) {
    const { url, options } = event.data;
    
    try {
      // 更新提取狀態
      this.extractionState.isExtracting = true;
      this.extractionState.currentUrl = url;
      this.extractionState.lastExtractionTime = new Date().toISOString();
      
      // 驗證是否為 Readmoo URL
      if (!this.isReadmooUrl(url)) {
        throw new Error(`非 Readmoo URL: ${url}`);
      }
      
      // 初始化 Readmoo 適配器
      await this.initializeReadmooAdapter();
      
      // 更新統計
      this.extractionStats.totalExtractions++;
      
      return { success: true, url, startTime: new Date().toISOString() };
      
         } catch (error) {
       this.extractionState.isExtracting = false;
       this.extractionStats.failedExtractions++;
       await this.reportError(error, event);
       // 返回錯誤狀態而不是重新拋出錯誤
       return { success: false, error: error.message, url };
     }
  }

  /**
   * 處理 Tab 更新事件
   * @param {Object} event - Tab 更新事件
   * @returns {Promise<Object>} 處理結果
   */
  async handleTabUpdate(event) {
    const { tabId, url } = event.data;
    
    try {
      // 檢查是否為 Readmoo 頁面
      if (this.isReadmooUrl(url)) {
        // 記錄 Readmoo 頁面訪問
        return { processed: true, tabId, url, isReadmoo: true };
      }
      
      return { processed: true, tabId, url, isReadmoo: false };
      
    } catch (error) {
      await this.reportError(error, event);
      return { processed: false, error: error.message };
    }
  }

  /**
   * 處理使用者提取請求事件
   * @param {Object} event - 使用者請求事件
   * @returns {Promise<Object>} 處理結果
   */
  async handleUserRequest(event) {
    const { trigger, options } = event.data;
    
    try {
      // 記錄使用者觸發的提取請求
      return { 
        initiated: true, 
        trigger, 
        timestamp: new Date().toISOString(),
        options 
      };
      
    } catch (error) {
      await this.reportError(error, event);
      return { initiated: false, error: error.message };
    }
  }

  /**
   * 檢查是否為 Readmoo URL
   * @param {string} url - 要檢查的 URL
   * @returns {boolean} 是否為 Readmoo URL
   */
  isReadmooUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    const readmooPatterns = [
      /^https?:\/\/readmoo\.com/,
      /^https?:\/\/[^.]+\.readmoo\.com/,
      /^https?:\/\/member\.readmoo\.com/
    ];
    
    return readmooPatterns.some(pattern => pattern.test(url));
  }

  /**
   * 初始化 Readmoo 適配器
   * @returns {Promise<void>}
   */
  async initializeReadmooAdapter() {
    // 預留 ReadmooAdapter 初始化邏輯
    // 在後續的 TDD 循環中實現
    if (!this.readmooAdapter) {
      // 暫時使用模擬適配器
      this.readmooAdapter = {
        initialized: true,
        name: 'ReadmooAdapter'
      };
    }
  }

  /**
   * 錯誤回報機制
   * @param {Error} error - 錯誤物件
   * @param {Object} event - 相關事件
   * @returns {Promise<Object>} 回報結果
   */
  async reportError(error, event) {
    // 記錄錯誤詳情
    const errorReport = {
      error: error.message,
      event: event ? event.type : 'unknown',
      timestamp: new Date().toISOString(),
      extractorState: this.extractionState
    };
    
    // 實際的錯誤回報邏輯 (如發送到監控系統)
    // 目前只是返回回報狀態
    return { reported: true, errorReport };
  }

  /**
   * 取得提取專用統計
   * @returns {Object} 提取統計資訊
   */
  getExtractionStats() {
    return {
      ...this.extractionStats,
      currentState: this.extractionState,
      baseStats: this.getStats()
    };
  }

  /**
   * 重置提取狀態 (用於測試和維護)
   */
  resetExtractionState() {
    this.extractionState = {
      isExtracting: false,
      currentUrl: null,
      lastExtractionTime: null,
      extractedBooksCount: 0
    };
  }

  /**
   * 銷毀提取器 (清理資源)
   */
  destroy() {
    this.resetExtractionState();
    this.readmooAdapter = null;
    super.destroy();
  }
}

module.exports = BookDataExtractor; 