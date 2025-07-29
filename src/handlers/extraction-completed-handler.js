/**
 * ExtractionCompletedHandler - 提取完成事件處理器
 * 
 * 負責功能：
 * - 監聽和處理 EXTRACTION.COMPLETED 事件
 * - 驗證提取完成資料的完整性和有效性
 * - 觸發 STORAGE.SAVE.REQUESTED 事件以儲存提取結果
 * - 觸發 UI.NOTIFICATION.SHOW 事件以顯示完成通知
 * - 觸發 ANALYTICS.EXTRACTION.COMPLETED 事件以收集分析資料
 * - 提供詳細的完成統計和處理歷史
 * - 實現智能的資料處理和優化機制
 * - 支援多書城平台的統一處理介面
 * 
 * 設計考量：
 * - 繼承自 EventHandler 基底類別，確保標準化介面
 * - HIGH 優先級確保優先處理完成事件
 * - 支援事件鏈式處理和錯誤隔離
 * - 提供完整的錯誤處理和復原機制
 * - 實現效能優化和記憶體管理
 * - 採用事件驅動架構，與其他模組低耦合整合
 * 
 * 處理流程：
 * 1. 接收 EXTRACTION.COMPLETED 事件
 * 2. 驗證提取結果資料完整性
 * 3. 準備儲存資料結構和選項
 * 4. 觸發 STORAGE.SAVE.REQUESTED 事件
 * 5. 生成適當的通知訊息
 * 6. 觸發 UI.NOTIFICATION.SHOW 事件
 * 7. 收集分析統計資料
 * 8. 觸發 ANALYTICS.EXTRACTION.COMPLETED 事件
 * 9. 更新完成統計和歷史記錄
 * 
 * 使用情境：
 * - BookDataExtractor 完成資料提取時
 * - 需要觸發後續儲存和通知流程時
 * - 收集提取完成統計和分析資料時
 * - 實現完整的提取作業閉環處理時
 */

const EventHandler = require('../core/event-handler');
const crypto = require('crypto');

class ExtractionCompletedHandler extends EventHandler {
  constructor(options = {}) {
    super('ExtractionCompletedHandler', 100); // HIGH 優先級
    
    // 兼容性屬性 (測試期望的介面)
    this.handlerName = this.name;
    
    // 完成處理專用統計
    this.completionStats = {
      totalCompletions: 0,        // 總完成次數
      successfulSaves: 0,         // 成功儲存次數
      failedSaves: 0,            // 失敗儲存次數
      averageProcessingTime: 0,   // 平均處理時間
      lastCompletionTime: null,   // 最後完成時間
      bookstoreBreakdown: {}      // 書城分類統計
    };
    
    // 處理歷史記錄
    this.processingHistory = [];
    
    // EventBus 參考 (用於觸發後續事件)
    this.eventBus = null;
    
    // 會話識別碼
    this.sessionId = this.generateSessionId();
    
    // 配置選項
    this.config = {
      maxHistorySize: 100,        // 最大歷史記錄數
      compressionThreshold: 200,   // 壓縮閾值 (書籍數量)
      dataSizeThreshold: 1024 * 1024, // 資料大小閾值 (1MB)
      ...options
    };
  }
  
  /**
   * 設置事件總線參考
   * @param {EventBus} eventBus - 事件總線實例
   */
  setEventBus(eventBus) {
    this.eventBus = eventBus;
  }
  
  /**
   * 取得事件總線參考
   * @returns {EventBus|null} 事件總線實例
   */
  getEventBus() {
    return this.eventBus;
  }
  
  /**
   * 取得支援的事件類型
   * @returns {string[]} 支援的事件類型陣列
   */
  getSupportedEvents() {
    return ['EXTRACTION.COMPLETED'];
  }
  
  /**
   * 檢查是否支援特定事件類型 (測試相容性方法)
   * @param {string} eventType - 事件類型
   * @returns {boolean} 是否支援
   */
  isEventSupported(eventType) {
    return this.canHandle(eventType);
  }
  
  /**
   * 覆寫父類的 handle 方法以提供測試兼容性
   * @param {Object} event - 事件物件
   * @returns {Object} 處理結果
   */
  async handle(event) {
    if (!this.isEnabled) {
      return { success: true, skipped: true };
    }
    
    return super.handle(event);
  }
  
  /**
   * 核心事件處理邏輯
   * @param {Object} event - 完成事件物件
   * @returns {Object} 處理結果
   */
     async process(event) {
     const startTime = performance.now();
     let hasStorageError = false;
     let hasUIError = false;
     
     const result = {
       success: false,
       eventsTriggered: [],
       warnings: [],
       processedBooks: 0,
       bookstore: null,
       dataSize: 0
     };
     
     try {
      // 驗證事件基本結構
      if (!event.data) {
        throw new Error('Missing required completion data');
      }
      
      if (typeof event.data !== 'object') {
        throw new Error('Invalid completion data format');
      }
      
      // 驗證 EventBus 配置
      if (!this.eventBus) {
        throw new Error('EventBus not configured');
      }
      
      // 驗證完成資料
      const validationResult = this.validateCompletionData(event.data);
      if (!validationResult.valid) {
        throw new Error(`Invalid completion data: ${validationResult.errors.join(', ')}`);
      }
      
      const { books, bookstore, count } = event.data;
      result.processedBooks = count || books.length;
      result.bookstore = bookstore;
      result.dataSize = this.calculateDataSize(books);
      
             // 更新統計
       this.completionStats.totalCompletions++;
       this.updateBookstoreStats(bookstore);
      
      try {
        // 觸發儲存事件
        await this.triggerStorageEvent(event);
        result.eventsTriggered.push('STORAGE.SAVE.REQUESTED');
        this.completionStats.successfulSaves++;
      } catch (error) {
        hasStorageError = true;
        this.completionStats.failedSaves++;
        throw error; // 儲存失敗視為嚴重錯誤
      }
      
      try {
        // 觸發通知事件
        await this.triggerNotificationEvent(event);
        result.eventsTriggered.push('UI.NOTIFICATION.SHOW');
      } catch (error) {
        hasUIError = true;
        result.warnings.push('UI notification failed');
        // 通知失敗不阻止整體處理
      }
      
      try {
        // 觸發分析事件
        await this.triggerAnalyticsEvent(event);
        result.eventsTriggered.push('ANALYTICS.EXTRACTION.COMPLETED');
      } catch (error) {
        result.warnings.push('Analytics event failed');
        // 分析失敗不阻止整體處理
      }
      
      // 記錄處理歷史
      const processingTime = performance.now() - startTime;
      this.recordProcessingHistory(event, processingTime, true);
      
      // 更新統計
      this.completionStats.lastCompletionTime = Date.now();
      this.updateAverageProcessingTime(processingTime);
      
      // 如果只有非關鍵事件失敗，仍視為成功
      result.success = !hasStorageError;
      
      return result;
      
         } catch (error) {
       // 只有在還沒有儲存失敗的情況下才增加計數器
       if (!hasStorageError) {
         this.completionStats.failedSaves++;
       }
       
       // 記錄失敗歷史
       const processingTime = performance.now() - startTime;
       this.recordProcessingHistory(event, processingTime, false, error.message);
       
       return {
         success: false,
         error: error.message,
         eventsTriggered: result.eventsTriggered,
         warnings: result.warnings
       };
     }
  }
  
  /**
   * 驗證完成資料的完整性和有效性
   * @param {Object} completionData - 完成資料物件
   * @returns {Object} 驗證結果 { valid: boolean, errors: string[] }
   */
  validateCompletionData(completionData) {
    const errors = [];
    
    // 驗證必要欄位
    if (!completionData.books || !Array.isArray(completionData.books)) {
      errors.push('books must be an array');
    }
    
    if (!completionData.bookstore || typeof completionData.bookstore !== 'string') {
      errors.push('bookstore must be a non-empty string');
    }
    
    if (completionData.count !== undefined && 
        (typeof completionData.count !== 'number' || completionData.count < 0)) {
      errors.push('count must be a non-negative number');
    }
    
    // 驗證書籍陣列和計數一致性
    if (completionData.books && completionData.count !== undefined) {
      if (completionData.books.length !== completionData.count) {
        errors.push('books array length does not match count');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * 觸發儲存事件
   * @param {Object} event - 原始完成事件
   */
  async triggerStorageEvent(event) {
    const { books, bookstore, extractedAt, count } = event.data;
    const dataSize = this.calculateDataSize(books);
    
    // 根據資料大小決定是否壓縮
    const shouldCompress = books.length >= this.config.compressionThreshold || 
                          dataSize >= this.config.dataSizeThreshold;
    
    const storageEvent = {
      type: 'STORAGE.SAVE.REQUESTED',
      timestamp: Date.now(),
      flowId: event.flowId,
      data: {
        key: 'extracted_books',
        books: books,
        metadata: {
          bookstore,
          extractedAt: extractedAt || new Date().toISOString(),
          count: count || books.length,
          sessionId: this.sessionId,
          handlerVersion: '1.0.0'
        },
        options: {
          autoSave: true,
          compress: shouldCompress,
          backup: true
        }
      }
    };
    
    await this.eventBus.emit('STORAGE.SAVE.REQUESTED', storageEvent);
  }
  
  /**
   * 觸發通知事件
   * @param {Object} event - 原始完成事件
   */
  async triggerNotificationEvent(event) {
    const { books, bookstore, count } = event.data;
    const bookCount = count || books.length;
    
    let notificationType = 'success';
    let message = '';
    
    if (bookCount === 0) {
      notificationType = 'warning';
      message = '未找到任何書籍資料';
    } else {
      message = `成功提取 ${bookCount} 本 ${bookstore} 書籍資料`;
    }
    
    const notificationEvent = {
      type: 'UI.NOTIFICATION.SHOW',
      timestamp: Date.now(),
      flowId: event.flowId,
      data: {
        type: notificationType,
        message: message,
        duration: 3000,
        actions: bookCount > 0 ? [
          { text: '查看詳情', action: 'view_results' },
          { text: '匯出資料', action: 'export_data' }
        ] : []
      }
    };
    
    await this.eventBus.emit('UI.NOTIFICATION.SHOW', notificationEvent);
  }
  
  /**
   * 觸發分析事件
   * @param {Object} event - 原始完成事件
   */
  async triggerAnalyticsEvent(event) {
    const { books, bookstore, extractionDuration, url } = event.data;
    
    // 收集詳細分析資料
    const analytics = this.collectAnalyticsData(books, extractionDuration);
    
    const analyticsEvent = {
      type: 'ANALYTICS.EXTRACTION.COMPLETED',
      timestamp: Date.now(),
      flowId: event.flowId,
      data: {
        bookstore,
        count: books.length,
        extractionDuration: extractionDuration || 0,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        url: url || '',
        analytics
      }
    };
    
    await this.eventBus.emit('ANALYTICS.EXTRACTION.COMPLETED', analyticsEvent);
  }
  
  /**
   * 收集詳細的分析資料
   * @param {Array} books - 書籍陣列
   * @param {number} extractionDuration - 提取持續時間
   * @returns {Object} 分析資料
   */
  collectAnalyticsData(books, extractionDuration = 0) {
    const bookTypes = {};
    const progressDistribution = { inProgress: 0, completed: 0 };
    let totalProgress = 0;
    
    books.forEach(book => {
      // 統計書籍類型
      const type = book.type || '未知';
      bookTypes[type] = (bookTypes[type] || 0) + 1;
      
      // 統計進度分佈
      const progress = book.progress || 0;
      totalProgress += progress;
      
      if (progress >= 100) {
        progressDistribution.completed++;
      } else if (progress > 0) {
        progressDistribution.inProgress++;
      }
    });
    
    const averageProgress = books.length > 0 ? totalProgress / books.length : 0;
    const extractionRate = extractionDuration > 0 ? books.length / (extractionDuration / 1000) : 0;
    
    return {
      bookTypes,
      progressDistribution,
      averageProgress,
      extractionRate
    };
  }
  
  /**
   * 計算資料大小
   * @param {Array} books - 書籍陣列
   * @returns {number} 資料大小 (bytes)
   */
  calculateDataSize(books) {
    return JSON.stringify(books).length;
  }
  
  /**
   * 記錄處理歷史
   * @param {Object} event - 處理的事件
   * @param {number} processingTime - 處理時間
   * @param {boolean} success - 是否成功
   * @param {string} error - 錯誤訊息 (如果有)
   */
     recordProcessingHistory(event, processingTime, success, error = null) {
     const eventData = event.data || {};
     const historyEntry = {
       flowId: event.flowId,
       bookstore: eventData.bookstore || 'unknown',
       count: eventData.count || (eventData.books ? eventData.books.length : 0),
       timestamp: Date.now(),
       processingTime,
       success,
       error
     };
    
    this.processingHistory.push(historyEntry);
    
    // 保持歷史記錄在限制範圍內
    if (this.processingHistory.length > this.config.maxHistorySize) {
      this.processingHistory.shift();
    }
  }
  
  /**
   * 更新書城統計
   * @param {string} bookstore - 書城名稱
   */
  updateBookstoreStats(bookstore) {
    if (!this.completionStats.bookstoreBreakdown[bookstore]) {
      this.completionStats.bookstoreBreakdown[bookstore] = 0;
    }
    this.completionStats.bookstoreBreakdown[bookstore]++;
  }
  
  /**
   * 更新平均處理時間
   * @param {number} processingTime - 本次處理時間
   */
  updateAverageProcessingTime(processingTime) {
    const totalCompletions = this.completionStats.totalCompletions;
    if (totalCompletions === 1) {
      this.completionStats.averageProcessingTime = processingTime;
    } else {
      this.completionStats.averageProcessingTime = 
        (this.completionStats.averageProcessingTime * (totalCompletions - 1) + processingTime) / totalCompletions;
    }
  }
  
  /**
   * 取得完成統計資訊
   * @returns {Object} 完成統計
   */
  getCompletionStats() {
    return {
      ...this.completionStats
    };
  }
  
  /**
   * 取得處理歷史記錄
   * @returns {Array} 處理歷史
   */
  getProcessingHistory() {
    return [...this.processingHistory];
  }
  
  /**
   * 清理歷史記錄
   * @param {number} keepCount - 保留的記錄數量
   */
  cleanupHistory(keepCount = 10) {
    if (this.processingHistory.length > keepCount) {
      this.processingHistory = this.processingHistory.slice(-keepCount);
    }
  }
  
  /**
   * 生成會話識別碼
   * @returns {string} 會話ID
   */
  generateSessionId() {
    return crypto.randomBytes(8).toString('hex');
  }
  
  /**
   * 處理器狀態重置
   */
  reset() {
    this.completionStats = {
      totalCompletions: 0,
      successfulSaves: 0,
      failedSaves: 0,
      averageProcessingTime: 0,
      lastCompletionTime: null,
      bookstoreBreakdown: {}
    };
    this.processingHistory = [];
    this.sessionId = this.generateSessionId();
    this.executionCount = 0;
    this.lastExecutionTime = null;
    this.averageExecutionTime = 0;
  }
  
  /**
   * 銷毀處理器資源
   */
  destroy() {
    this.processingHistory = [];
    this.completionStats.totalCompletions = 0;
    this.eventBus = null;
  }
}

module.exports = ExtractionCompletedHandler; 