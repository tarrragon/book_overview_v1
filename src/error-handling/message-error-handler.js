/**
 * MessageErrorHandler - Chrome Extension 訊息錯誤處理器
 * TDD 循環 #31: 訊息處理錯誤監控
 * 
 * 負責功能：
 * - Chrome Extension 訊息錯誤捕獲和分類
 * - 未知訊息類型診斷和建議
 * - 訊息路由錯誤分析和修復建議
 * - 錯誤統計和診斷報告生成
 * 
 * 設計考量：
 * - 繼承 EventHandler 提供標準化事件處理
 * - 最高優先級 (0) 確保錯誤能被及時捕獲
 * - 診斷模式提供詳細的除錯資訊
 * - 記憶體管理避免錯誤記錄無限增長
 * 
 * 處理流程：
 * 1. 接收各類訊息錯誤事件
 * 2. 分類錯誤類型並更新統計
 * 3. 生成診斷建議和修復方案
 * 4. 發送診斷事件供其他系統使用
 * 
 * 使用情境：
 * - Chrome Extension 開發階段的錯誤診斷
 * - 生產環境的錯誤監控和報告
 * - START_EXTRACTION 等訊息處理問題的診斷
 */

const EventHandler = require('../core/event-handler');

class MessageErrorHandler extends EventHandler {
  /**
   * 建構 MessageErrorHandler
   * @param {Object} eventBus - 事件總線實例
   * @param {Object} options - 配置選項
   */
  constructor(eventBus, options = {}) {
    // EventHandler 建構函數簽名是 (name, priority)
    super('MessageErrorHandler', 0); // 最高優先級

    // 設置 eventBus 和支援的事件
    this.eventBus = eventBus;
    this.supportedEvents = [
      'MESSAGE.ERROR',
      'MESSAGE.UNKNOWN_TYPE', 
      'MESSAGE.ROUTING_ERROR'
    ];

    // 初始化錯誤統計
    this.errorStats = {
      totalErrors: 0,
      unknownMessageTypes: 0,
      routingErrors: 0,
      errorsByType: new Map(),
      lastErrorTime: null
    };

    // 診斷模式和錯誤記錄
    this.diagnosticMode = false;
    this.recentErrors = [];
    this.maxErrorRecords = options.maxErrorRecords || 100;
    this.errorRetentionHours = options.errorRetentionHours || 24;

    // Chrome Extension 相關
    this.chromeAvailable = typeof chrome !== 'undefined' && chrome.runtime;
    
    // 自動清理定時器
    this.setupCleanupTimer();
  }

  /**
   * 處理訊息錯誤事件
   * @param {Object} event - 錯誤事件
   * @returns {Object} 處理結果
   */
  async process(event) {
    const { type, data } = event;

    try {
      switch (type) {
        case 'MESSAGE.ERROR':
          return await this.handleMessageError(data);
        
        case 'MESSAGE.UNKNOWN_TYPE':
          return await this.handleUnknownMessageType(data);
        
        case 'MESSAGE.ROUTING_ERROR':
          return await this.handleRoutingError(data);
        
        default:
          throw new Error(`不支援的錯誤事件類型: ${type}`);
      }
    } catch (error) {
      console.error('[MessageErrorHandler] 處理錯誤事件失敗:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 處理一般訊息錯誤
   * @param {Object} errorData - 錯誤資料
   * @returns {Object} 處理結果
   */
  async handleMessageError(errorData) {
    const { error, message, context, timestamp } = errorData;

    // 更新統計
    this.errorStats.totalErrors++;
    this.errorStats.lastErrorTime = timestamp || Date.now();

    // 記錄錯誤
    this.recordError({
      type: 'MESSAGE.ERROR',
      error,
      message,
      context,
      timestamp: this.errorStats.lastErrorTime
    });

    // 發送錯誤日誌事件
    this.eventBus.emit('ERROR.LOGGED', {
      type: 'MESSAGE_ERROR',
      error: error.message,
      context,
      timestamp: this.errorStats.lastErrorTime
    });

    return { success: true, errorId: this.generateErrorId() };
  }

  /**
   * 處理未知訊息類型錯誤
   * @param {Object} unknownTypeData - 未知類型資料
   * @returns {Object} 處理結果
   */
  async handleUnknownMessageType(unknownTypeData) {
    const { 
      messageType, 
      receivedMessage, 
      context, 
      availableTypes = [], 
      timestamp 
    } = unknownTypeData;

    // 更新統計
    this.errorStats.unknownMessageTypes++;
    this.errorStats.totalErrors++;
    this.errorStats.lastErrorTime = timestamp || Date.now();

    // 記錄錯誤
    this.recordError({
      type: 'MESSAGE.UNKNOWN_TYPE',
      messageType,
      receivedMessage,
      context,
      availableTypes,
      timestamp: this.errorStats.lastErrorTime
    });

    // 生成診斷建議
    const suggestion = this.generateUnknownTypeSuggestion(messageType, availableTypes);

    // 發送診斷建議事件
    this.eventBus.emit('DIAGNOSTIC.SUGGESTION', {
      type: 'UNKNOWN_MESSAGE_TYPE',
      messageType,
      suggestion,
      context,
      timestamp: this.errorStats.lastErrorTime
    });

    return { success: true, suggestion };
  }

  /**
   * 處理訊息路由錯誤
   * @param {Object} routingErrorData - 路由錯誤資料
   * @returns {Object} 處理結果
   */
  async handleRoutingError(routingErrorData) {
    const { source, target, message, error, timestamp } = routingErrorData;

    // 更新統計
    this.errorStats.routingErrors++;
    this.errorStats.totalErrors++;
    this.errorStats.lastErrorTime = timestamp || Date.now();

    // 記錄錯誤
    this.recordError({
      type: 'MESSAGE.ROUTING_ERROR',
      source,
      target,
      message,
      error,
      timestamp: this.errorStats.lastErrorTime
    });

    // 分析路由問題
    const analysis = this.analyzeRoutingError(source, target, error.message);

    // 發送路由問題診斷事件
    this.eventBus.emit('DIAGNOSTIC.ROUTING_ISSUE', {
      source,
      target,
      message,
      analysis,
      timestamp: this.errorStats.lastErrorTime
    });

    return { success: true, analysis };
  }

  /**
   * 生成未知訊息類型的診斷建議
   * @param {string} unknownType - 未知的訊息類型
   * @param {Array} availableTypes - 可用的訊息類型
   * @returns {string} 診斷建議
   */
  generateUnknownTypeSuggestion(unknownType, availableTypes) {
    let suggestion = `收到未知的訊息類型: "${unknownType}"\n\n`;
    
    suggestion += '可能的解決方案:\n';
    suggestion += '1. 檢查訊息格式是否正確\n';
    suggestion += '2. 確認訊息處理器是否已註冊\n';
    suggestion += '3. 檢查版本相容性問題\n\n';

    if (availableTypes.length > 0) {
      suggestion += `目前支援的訊息類型:\n`;
      availableTypes.forEach(type => {
        suggestion += `- ${type}\n`;
      });
    }

    // 提供相似類型建議
    const similarType = this.findSimilarMessageType(unknownType, availableTypes);
    if (similarType) {
      suggestion += `\n建議: 您可能想使用 "${similarType}" 而不是 "${unknownType}"`;
    }

    return suggestion;
  }

  /**
   * 分析訊息路由錯誤
   * @param {string} source - 訊息來源
   * @param {string} target - 訊息目標
   * @param {string} errorMessage - 錯誤訊息
   * @returns {Object} 分析結果
   */
  analyzeRoutingError(source, target, errorMessage) {
    const analysis = {
      issue: 'UNKNOWN_ROUTING_ERROR',
      suggestions: []
    };

    // 分析常見的路由錯誤
    if (errorMessage.includes('No receiving end')) {
      if (target === 'content-script') {
        analysis.issue = 'CONTENT_SCRIPT_NOT_READY';
        analysis.suggestions = [
          '確認 Content Script 已載入',
          '檢查頁面是否為 Readmoo 網站',
          '確認 manifest.json 中的 content_scripts 配置正確'
        ];
      } else if (target === 'background') {
        analysis.issue = 'BACKGROUND_NOT_READY';
        analysis.suggestions = [
          '確認 Background Service Worker 正在運行',
          '檢查 manifest.json 中的 background 配置',
          '確認沒有 Service Worker 啟動錯誤'
        ];
      }
    } else if (errorMessage.includes('Extension context invalidated')) {
      analysis.issue = 'EXTENSION_CONTEXT_INVALIDATED';
      analysis.suggestions = [
        '擴展已重新載入，需要重新初始化',
        '檢查是否有開發者工具重載擴展',
        '確認擴展沒有被禁用或卸載'
      ];
    }

    return analysis;
  }

  /**
   * 啟用診斷模式
   */
  enableDiagnosticMode() {
    this.diagnosticMode = true;
    
    this.eventBus.emit('DIAGNOSTIC.MODE_ENABLED', {
      handler: 'MessageErrorHandler',
      timestamp: Date.now()
    });
  }

  /**
   * 停用診斷模式
   */
  disableDiagnosticMode() {
    this.diagnosticMode = false;
    
    this.eventBus.emit('DIAGNOSTIC.MODE_DISABLED', {
      handler: 'MessageErrorHandler',
      timestamp: Date.now()
    });
  }

  /**
   * 獲取錯誤統計資訊
   * @returns {Object} 統計資訊
   */
  getErrorStatistics() {
    return {
      ...this.errorStats,
      errorsByType: Object.fromEntries(this.errorStats.errorsByType),
      recentErrorsCount: this.recentErrors.length,
      diagnosticMode: this.diagnosticMode
    };
  }

  /**
   * 生成錯誤報告
   * @returns {string} 錯誤報告
   */
  generateErrorReport() {
    const stats = this.getErrorStatistics();
    
    let report = '=== 訊息錯誤統計報告 ===\n\n';
    report += `總錯誤數: ${stats.totalErrors}\n`;
    report += `未知訊息類型: ${stats.unknownMessageTypes}\n`;
    report += `路由錯誤: ${stats.routingErrors}\n`;
    report += `最後錯誤時間: ${stats.lastErrorTime ? new Date(stats.lastErrorTime).toLocaleString() : '無'}\n\n`;

    if (Object.keys(stats.errorsByType).length > 0) {
      report += '錯誤類型分佈:\n';
      Object.entries(stats.errorsByType).forEach(([type, count]) => {
        report += `- ${type}: ${count}\n`;
      });
    }

    report += `\n診斷模式: ${stats.diagnosticMode ? '啟用' : '停用'}\n`;
    report += `記錄的錯誤數: ${stats.recentErrorsCount}\n`;

    return report;
  }

  /**
   * 匯出錯誤資料
   * @returns {Object} 匯出資料
   */
  exportErrorData() {
    return {
      statistics: this.getErrorStatistics(),
      recentErrors: this.recentErrors.slice(),
      diagnosticInfo: {
        chromeAvailable: this.chromeAvailable,
        diagnosticMode: this.diagnosticMode,
        maxErrorRecords: this.maxErrorRecords,
        errorRetentionHours: this.errorRetentionHours
      },
      timestamp: Date.now()
    };
  }

  /**
   * 設置 Chrome 錯誤監聽
   */
  setupChromeErrorListening() {
    if (!this.chromeAvailable) return;

    // 監聽 Chrome Runtime 訊息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (this.diagnosticMode) {
        console.log('[MessageErrorHandler] 診斷模式 - 收到訊息:', message);
      }
    });
  }

  /**
   * 檢查 Chrome Runtime lastError
   * @returns {boolean} 是否有錯誤
   */
  checkChromeLastError() {
    if (!this.chromeAvailable) return false;

    if (chrome.runtime.lastError) {
      const error = new Error(chrome.runtime.lastError.message);
      
      this.eventBus.emit('MESSAGE.ERROR', {
        error,
        context: 'chrome-runtime',
        timestamp: Date.now()
      });

      return true;
    }

    return false;
  }

  /**
   * 獲取 Chrome Extension 健康狀態
   * @returns {Object} 健康狀態
   */
  getChromeExtensionHealth() {
    return {
      runtimeAvailable: this.chromeAvailable,
      messageSystemWorking: this.chromeAvailable && !chrome.runtime.lastError,
      lastErrorStatus: this.chromeAvailable ? 
        (chrome.runtime.lastError ? chrome.runtime.lastError.message : null) : 
        'Chrome API 不可用'
    };
  }

  /**
   * 記錄錯誤
   * @param {Object} errorRecord - 錯誤記錄
   */
  recordError(errorRecord) {
    // 添加到最近錯誤列表
    this.recentErrors.push(errorRecord);

    // 限制記錄數量
    if (this.recentErrors.length > this.maxErrorRecords) {
      this.recentErrors.shift();
    }

    // 更新錯誤類型統計
    const errorType = errorRecord.type;
    const currentCount = this.errorStats.errorsByType.get(errorType) || 0;
    this.errorStats.errorsByType.set(errorType, currentCount + 1);
  }

  /**
   * 清理過期的錯誤記錄
   */
  cleanupExpiredErrors() {
    const cutoffTime = Date.now() - (this.errorRetentionHours * 60 * 60 * 1000);
    
    this.recentErrors = this.recentErrors.filter(error => 
      error.timestamp > cutoffTime
    );
  }

  /**
   * 獲取記憶體使用統計
   * @returns {Object} 記憶體統計
   */
  getMemoryUsage() {
    const errorRecordsCount = this.recentErrors.length;
    const estimatedMemoryUsage = errorRecordsCount * 1024; // 估算每個記錄 1KB

    return {
      errorRecordsCount,
      estimatedMemoryUsage,
      lastCleanupTime: this.lastCleanupTime || null
    };
  }

  /**
   * 設置清理定時器
   */
  setupCleanupTimer() {
    // 每小時清理一次過期記錄
    setInterval(() => {
      this.cleanupExpiredErrors();
      this.lastCleanupTime = Date.now();
    }, 60 * 60 * 1000);
  }

  /**
   * 尋找相似的訊息類型
   * @param {string} unknownType - 未知類型
   * @param {Array} availableTypes - 可用類型
   * @returns {string|null} 相似類型
   */
  findSimilarMessageType(unknownType, availableTypes) {
    if (!availableTypes.length) return null;

    // 簡單的字串相似度比較
    let bestMatch = null;
    let bestScore = 0;

    availableTypes.forEach(type => {
      const score = this.calculateStringSimilarity(unknownType, type);
      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = type;
      }
    });

    return bestMatch;
  }

  /**
   * 計算字串相似度
   * @param {string} str1 - 字串1
   * @param {string} str2 - 字串2
   * @returns {number} 相似度 (0-1)
   */
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * 計算編輯距離
   * @param {string} str1 - 字串1
   * @param {string} str2 - 字串2
   * @returns {number} 編輯距離
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 生成錯誤ID
   * @returns {string} 錯誤ID
   */
  generateErrorId() {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = MessageErrorHandler;