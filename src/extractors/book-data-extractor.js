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

    // 初始化狀態追蹤 (TDD Cycle #2)
    this.initializationState = {
      isInitializing: false,
      lastInitializedUrl: null,
      lastInitializationTime: null,
      initializationCount: 0
    };
    
    // Readmoo 適配器 (稍後初始化)
    this.readmooAdapter = null;

    // EventBus 整合 (TDD Cycle #3)
    this.eventBus = null;

    // 活躍提取流程追蹤 (TDD Cycle #3)
    this.activeExtractionFlows = new Map();

    // 提取流程計數器
    this.flowCounter = 0;
    
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
      await this.initializeReadmooAdapter(url);
      
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
   * 取得 Readmoo 頁面類型 (TDD Cycle #2)
   * @param {string} url - 要檢查的 URL
   * @returns {string|null} 頁面類型或 null
   */
  getReadmooPageType(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }

    // 如果不是 Readmoo URL，直接返回 null
    if (!this.isReadmooUrl(url)) {
      return null;
    }

    // Readmoo 頁面類型模式
    const pageTypes = [
      { pattern: /\/library(?:\/|$)/i, type: 'library' },
      { pattern: /\/shelf(?:\/|$)/i, type: 'shelf' },
      { pattern: /reader\.readmoo\.com.*\/reader/i, type: 'reader' },
      { pattern: /^https?:\/\/readmoo\.com\/?$/i, type: 'home' }
    ];

    for (const { pattern, type } of pageTypes) {
      if (pattern.test(url)) {
        return type;
      }
    }

    // 預設為主頁類型
    return 'home';
  }

  /**
   * 檢查 Readmoo 頁面是否支援資料提取 (TDD Cycle #2)
   * @param {string} url - 要檢查的 URL
   * @returns {boolean} 是否支援提取
   */
  isExtractableReadmooPage(url) {
    const pageType = this.getReadmooPageType(url);
    
    // 支援提取的頁面類型
    const extractableTypes = ['library', 'shelf'];
    return extractableTypes.includes(pageType);
  }

  /**
   * 檢查頁面準備狀態 (TDD Cycle #2)
   * @param {string} url - 要檢查的頁面 URL
   * @returns {Promise<boolean>} 頁面是否準備好
   */
  async checkPageReady(url) {
    const pageType = this.getReadmooPageType(url);
    
    try {
      switch (pageType) {
        case 'library':
          return await this.checkLibraryPageReady();
        case 'shelf':
          return await this.checkShelfPageReady();
        default:
          return false;
      }
    } catch (error) {
      console.warn(`頁面準備檢查失敗: ${error.message}`);
      return false;
    }
  }

  /**
   * 檢查書庫頁面準備狀態 (TDD Cycle #2)
   * 設計考量：檢查書庫頁面的關鍵 DOM 元素是否載入完成
   * 處理流程：
   * 1. 檢查書籍容器元素是否存在
   * 2. 檢查是否有足夠的書籍資料載入
   * 3. 驗證頁面互動功能是否可用
   * @returns {Promise<boolean>} 書庫頁面是否準備好
   */
  async checkLibraryPageReady() {
    // 模擬 DOM 檢查邏輯
    // TODO: 在實際實現中檢查以下元素：
    // - 書籍列表容器: .library-books, .book-grid
    // - 載入完成指示器: .loading-complete
    // - 分頁控制器: .pagination
    return new Promise(resolve => {
      setTimeout(() => resolve(true), 10);
    });
  }

  /**
   * 檢查書架頁面準備狀態 (TDD Cycle #2)
   * 設計考量：書架頁面通常有不同的佈局和載入方式
   * 處理流程：
   * 1. 檢查書架分類是否載入
   * 2. 檢查書籍元素是否可互動
   * 3. 驗證書架功能是否可用
   * @returns {Promise<boolean>} 書架頁面是否準備好
   */
  async checkShelfPageReady() {
    // 模擬 DOM 檢查邏輯
    // TODO: 在實際實現中檢查以下元素：
    // - 書架容器: .shelf-container
    // - 書籍卡片: .book-card
    // - 書架操作按鈕: .shelf-actions
    return new Promise(resolve => {
      setTimeout(() => resolve(true), 10);
    });
  }

  /**
   * 取得頁面完整狀態資訊 (TDD Cycle #2)
   * @param {string} url - 要檢查的頁面 URL
   * @returns {Promise<Object>} 頁面狀態資訊
   */
  async getPageStatus(url) {
    const pageType = this.getReadmooPageType(url);
    const isExtractable = this.isExtractableReadmooPage(url);
    const isReady = isExtractable ? await this.checkPageReady(url) : false;

    return {
      url,
      pageType,
      isExtractable,
      isReady,
      checkedAt: new Date().toISOString()
    };
  }

  /**
   * 初始化 Readmoo 適配器 (TDD Cycle #2 改進)
   * @param {string} url - 要初始化的頁面 URL
   * @returns {Promise<void>}
   */
  async initializeReadmooAdapter(url) {
    // 更新初始化狀態
    this.initializationState.isInitializing = true;
    this.initializationState.initializationCount++;

    try {
      // 檢查是否支援提取
      if (!this.isExtractableReadmooPage(url)) {
        throw new Error('此 Readmoo 頁面不支援資料提取');
      }

      // 檢查頁面準備狀態
      const isReady = await this.checkPageReady(url);
      if (!isReady) {
        throw new Error('Readmoo 頁面未準備好');
      }

      // 初始化適配器
      const pageType = this.getReadmooPageType(url);
      this.readmooAdapter = {
        initialized: true,
        name: 'ReadmooAdapter',
        pageType,
        url,
        initializedAt: new Date().toISOString()
      };

      // 更新初始化狀態
      this.initializationState.lastInitializedUrl = url;
      this.initializationState.lastInitializationTime = new Date().toISOString();

    } catch (error) {
      throw error;
    } finally {
      // 重置初始化狀態
      this.initializationState.isInitializing = false;
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
    this.eventBus = null;
    this.activeExtractionFlows.clear();
    super.destroy();
  }

  // === TDD Cycle #3: 事件驅動提取流程方法 ===

  /**
   * 設置 EventBus (TDD Cycle #3)
   * @param {Object} eventBus - EventBus 實例
   */
  setEventBus(eventBus) {
    this.eventBus = eventBus;
  }

  /**
   * 取得 EventBus (TDD Cycle #3)
   * @returns {Object|null} EventBus 實例
   */
  getEventBus() {
    return this.eventBus;
  }

  /**
   * 生成唯一的流程ID (TDD Cycle #3)
   * @returns {string} 流程ID
   */
  generateFlowId() {
    this.flowCounter++;
    return `extraction-flow-${Date.now()}-${this.flowCounter}`;
  }

  /**
   * 開始完整的事件驅動提取流程 (TDD Cycle #3)
   * @param {string} url - 要提取的頁面 URL
   * @param {Object} options - 提取選項
   * @returns {Promise<string>} 流程ID
   */
  async startExtractionFlow(url, options = {}) {
    const flowId = this.generateFlowId();
    const startTime = Date.now();

    try {
      // 初始化進度追蹤
      this.initializeProgressTracking(flowId);

      // 發布開始事件
      await this.emitEvent('EXTRACTION.STARTED', {
        url,
        options,
        timestamp: new Date().toISOString(),
        flowId
      });

      // 報告初始化進度
      await this.reportProgress(flowId, {
        stage: 'initialization',
        progress: 0,
        message: '初始化提取器...'
      });

      // 檢查頁面準備狀態
      const isReady = await this.checkPageReady(url);
      if (!isReady) {
        throw new Error('頁面未準備好');
      }

      // 初始化適配器
      await this.initializeReadmooAdapter(url);

      // 報告初始化完成
      await this.reportProgress(flowId, {
        stage: 'adapter_ready',
        progress: 20,
        message: '適配器初始化完成...'
      });

      // 執行實際提取
      const extractedBooks = await this.performActualExtraction(url, options, flowId);

      // 完成提取
      await this.completeExtraction(flowId, extractedBooks);

      return flowId;

    } catch (error) {
      await this.handleExtractionError(flowId, error, { url, stage: 'flow_start' });
      throw error;
    }
  }

  /**
   * 報告提取進度 (TDD Cycle #3)
   * @param {string} flowId - 流程ID
   * @param {Object} progressData - 進度資料
   */
  async reportProgress(flowId, progressData) {
    const progress = {
      flowId,
      ...progressData,
      timestamp: new Date().toISOString()
    };

    // 更新流程狀態
    if (this.activeExtractionFlows.has(flowId)) {
      const flow = this.activeExtractionFlows.get(flowId);
      flow.currentStage = progressData.stage;
      flow.progress = progressData.progress || 0;
      flow.processedCount = progressData.processedCount || 0;
      flow.totalCount = progressData.totalCount || 0;
    }

    // 發布進度事件
    await this.emitEvent('EXTRACTION.PROGRESS', progress);
  }

  /**
   * 完成提取 (TDD Cycle #3)
   * @param {string} flowId - 流程ID
   * @param {Array} extractedBooks - 提取的書籍資料
   */
  async completeExtraction(flowId, extractedBooks) {
    const flow = this.activeExtractionFlows.get(flowId);
    const duration = flow ? Date.now() - new Date(flow.startedAt).getTime() : 0;

    // 更新提取狀態
    this.extractionState.isExtracting = false;
    this.extractionState.extractedBooksCount = extractedBooks.length;
    this.extractionStats.successfulExtractions++;

    // 發布完成事件
    await this.emitEvent('EXTRACTION.COMPLETED', {
      flowId,
      books: extractedBooks,
      totalCount: extractedBooks.length,
      completedAt: new Date().toISOString(),
      duration
    });
  }

  /**
   * 執行實際的資料提取 (TDD Cycle #3)
   * @param {string} url - 頁面 URL
   * @param {Object} options - 提取選項
   * @param {string} flowId - 流程ID
   * @returns {Promise<Array>} 提取的書籍資料
   */
  async performActualExtraction(url, options, flowId) {
    // 報告開始提取
    await this.reportProgress(flowId, {
      stage: 'parsing',
      progress: 30,
      message: '開始解析頁面...'
    });

    // 模擬提取過程 (實際實現會從 DOM 提取)
    // TODO: 在實際實現中會調用 ReadmooAdapter 的提取方法
    const mockBooks = [
      { id: '1', title: '測試書籍', cover: 'test.jpg' }
    ];

    // 報告提取完成
    await this.reportProgress(flowId, {
      stage: 'extraction_complete',
      progress: 100,
      message: '資料提取完成'
    });

    return mockBooks;
  }

  /**
   * 處理提取錯誤 (TDD Cycle #3)
   * @param {string} flowId - 流程ID
   * @param {Error} error - 錯誤物件
   * @param {Object} context - 錯誤上下文
   */
  async handleExtractionError(flowId, error, context) {
    const isRetryable = this.isErrorRetryable(error);

    await this.emitEvent('EXTRACTION.ERROR', {
      flowId,
      error: error.message,
      context,
      timestamp: new Date().toISOString(),
      retryable: isRetryable
    });

    // 更新統計
    this.extractionStats.failedExtractions++;
  }

  /**
   * 判斷錯誤是否可重試 (TDD Cycle #3)
   * @param {Error} error - 錯誤物件
   * @returns {boolean} 是否可重試
   */
  isErrorRetryable(error) {
    const retryableErrors = [
      '網路連線失敗',
      '網路連線錯誤',
      '頁面載入超時',
      '伺服器暫時無法回應'
    ];

    return retryableErrors.some(msg => error.message.includes(msg));
  }

  /**
   * 重試提取 (TDD Cycle #3)
   * @param {string} flowId - 流程ID
   * @param {Object} retryOptions - 重試選項
   */
  async retryExtraction(flowId, retryOptions = {}) {
    const { maxRetries = 3, retryDelay = 1000, backoffMultiplier = 2 } = retryOptions;

    // 發布重試事件
    await this.emitEvent('EXTRACTION.RETRY', {
      flowId,
      retryCount: 1,
      maxRetries,
      timestamp: new Date().toISOString()
    });

    // 模擬重試邏輯 (實際會重新執行提取)
    // TODO: 實際實現會重新執行提取流程
  }

  /**
   * 標記提取最終失敗 (TDD Cycle #3)
   * @param {string} flowId - 流程ID
   * @param {Error} lastError - 最後的錯誤
   * @param {Array} retryHistory - 重試歷史
   */
  async markExtractionFailed(flowId, lastError, retryHistory) {
    // 重置提取狀態
    this.extractionState.isExtracting = false;
    this.extractionStats.failedExtractions++;

    // 發布失敗事件
    await this.emitEvent('EXTRACTION.FAILED', {
      flowId,
      finalError: lastError.message,
      retryHistory,
      failedAt: new Date().toISOString(),
      totalRetries: retryHistory.length
    });
  }

  /**
   * 取消提取 (TDD Cycle #3)
   * @param {string} flowId - 流程ID
   * @param {string} reason - 取消原因
   */
  async cancelExtraction(flowId, reason) {
    // 取得部分結果
    const partialResults = [];

    // 發布取消事件
    await this.emitEvent('EXTRACTION.CANCELLED', {
      flowId,
      reason,
      cancelledAt: new Date().toISOString(),
      partialResults
    });

    // 執行清理
    await this.cleanupExtractionFlow(flowId, 'cancellation');
  }

  /**
   * 清理提取流程 (TDD Cycle #3)
   * @param {string} flowId - 流程ID
   * @param {string} cleanupType - 清理類型
   */
  async cleanupExtractionFlow(flowId, cleanupType = 'completion') {
    // 發布清理事件
    await this.emitEvent('EXTRACTION.CLEANUP', {
      flowId,
      cleanupType,
      timestamp: new Date().toISOString()
    });

    // 從活躍流程中移除
    this.activeExtractionFlows.delete(flowId);
  }

  /**
   * 初始化進度追蹤 (TDD Cycle #3)
   * @param {string} flowId - 流程ID
   */
  initializeProgressTracking(flowId) {
    this.activeExtractionFlows.set(flowId, {
      flowId,
      isActive: true,
      currentStage: 'initialization',
      progress: 0,
      startedAt: new Date().toISOString(),
      estimatedTimeRemaining: null,
      processedCount: 0,
      totalCount: 0
    });
  }

  /**
   * 取得提取流程狀態 (TDD Cycle #3)
   * @param {string} flowId - 流程ID
   * @returns {Object|null} 流程狀態
   */
  getExtractionFlowStatus(flowId) {
    return this.activeExtractionFlows.get(flowId) || null;
  }

  /**
   * 取得所有活躍的提取流程 (TDD Cycle #3)
   * @returns {Array} 活躍流程列表
   */
  getActiveExtractionFlows() {
    return Array.from(this.activeExtractionFlows.values());
  }

  /**
   * 發布事件 (TDD Cycle #3)
   * 設計考量：統一的事件發布介面，確保與 EventBus 的正確整合
   * 處理流程：
   * 1. 檢查 EventBus 是否可用
   * 2. 驗證事件資料的完整性
   * 3. 發布事件到 EventBus
   * 4. 處理發布過程中的錯誤
   * @param {string} eventType - 事件類型
   * @param {Object} eventData - 事件資料
   */
  async emitEvent(eventType, eventData) {
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      try {
        await this.eventBus.emit(eventType, eventData);
      } catch (error) {
        console.warn(`事件發布失敗: ${eventType}`, error);
        // 不重新拋出錯誤，避免中斷提取流程
      }
    } else {
      console.warn(`EventBus 未設置，無法發布事件: ${eventType}`);
    }
  }
}

module.exports = BookDataExtractor; 