/**
 * MessageTracker - 即時訊息追蹤診斷系統
 * TDD 循環 #33: 即時診斷系統
 *
 * 負責功能：
 * - Chrome Extension 訊息流程即時追蹤
 * - 未知訊息類型識別和記錄
 * - Console 診斷介面提供
 * - 訊息處理時間統計和分析
 *
 * 設計考量：
 * - 繼承 EventHandler 提供標準化事件處理
 * - 中等優先級 (10) 不干擾核心錯誤處理
 * - 輕量級設計，最小侵入性
 * - 記憶體管理避免追蹤記錄無限增長
 *
 * 處理流程：
 * 1. 接收訊息相關事件
 * 2. 記錄訊息流程和狀態變化
 * 3. 識別未知訊息類型
 * 4. 提供 Console 診斷介面
 *
 * 使用情境：
 * - Chrome Extension 開發階段的訊息診斷
 * - START_EXTRACTION 等訊息處理問題的追蹤
 * - 即時訊息流程監控和分析
 */

const EventHandler = require("../core/event-handler");

class MessageTracker extends EventHandler {
  /**
   * 常數定義 - 統一管理所有硬編碼值
   */
  static get CONSTANTS() {
    return {
      // 事件類型
      EVENT_TYPES: {
        MESSAGE_SENT: "MESSAGE.SENT",
        MESSAGE_RECEIVED: "MESSAGE.RECEIVED",
        MESSAGE_PROCESSED: "MESSAGE.PROCESSED",
        MESSAGE_FAILED: "MESSAGE.FAILED",
      },

      // 發送事件類型
      EMIT_EVENTS: {
        TRACKING_STARTED: "TRACKING.STARTED",
        UNKNOWN_MESSAGE_DETECTED: "UNKNOWN_MESSAGE.DETECTED",
        MESSAGE_FLOW_COMPLETED: "MESSAGE_FLOW.COMPLETED",
        DIAGNOSTIC_INFO_UPDATED: "DIAGNOSTIC_INFO.UPDATED",
      },

      // 訊息狀態
      MESSAGE_STATUS: {
        SENT: "SENT",
        RECEIVED: "RECEIVED",
        PROCESSED: "PROCESSED",
        FAILED: "FAILED",
        TIMEOUT: "TIMEOUT",
      },

      // 訊息來源/目標
      MESSAGE_CONTEXTS: {
        POPUP: "popup",
        BACKGROUND: "background",
        CONTENT: "content",
        DEVTOOLS: "devtools",
      },

      // 預設配置
      DEFAULTS: {
        MAX_MESSAGE_RECORDS: 100,
        MESSAGE_TIMEOUT_MS: 30000, // 30秒
        CLEANUP_INTERVAL_MS: 60 * 1000, // 1分鐘
        CONSOLE_LOG_LIMIT: 20,
      },

      // 錯誤訊息模板
      ERROR_MESSAGES: {
        UNSUPPORTED_EVENT_TYPE: "不支援的追蹤事件類型",
        PROCESSING_FAILED: "處理追蹤事件失敗",
        CONSOLE_UNAVAILABLE: "Console 診斷介面不可用",
      },
    };
  }

  /**
   * 建構 MessageTracker
   * @param {Object} eventBus - 事件總線實例
   * @param {Object} options - 配置選項
   */
  constructor(eventBus, options = {}) {
    // EventHandler 建構函數簽名是 (name, priority)
    super("MessageTracker", 10); // 中等優先級

    // 設置 eventBus 和支援的事件
    this.eventBus = eventBus;
    this.supportedEvents = [
      MessageTracker.CONSTANTS.EVENT_TYPES.MESSAGE_SENT,
      MessageTracker.CONSTANTS.EVENT_TYPES.MESSAGE_RECEIVED,
      MessageTracker.CONSTANTS.EVENT_TYPES.MESSAGE_PROCESSED,
      MessageTracker.CONSTANTS.EVENT_TYPES.MESSAGE_FAILED,
    ];

    // 初始化各個子系統
    this.initializeTrackingState(options);
    this.initializeMessageLog(options);
    this.initializeStatistics(options);
    this.initializeConsoleInterface();
    this.setupCleanupTimer();
  }

  /**
   * 初始化追蹤狀態
   * @param {Object} options - 配置選項
   */
  initializeTrackingState(options) {
    this.trackingEnabled = true;
    this.diagnosticMode = false;
    this.startTime = Date.now();
  }

  /**
   * 初始化訊息記錄系統
   * @param {Object} options - 配置選項
   */
  initializeMessageLog(options) {
    const { DEFAULTS } = MessageTracker.CONSTANTS;

    this.messageLog = [];
    this.activeMessages = new Map();
    this.unknownMessages = [];
    this.maxMessageRecords =
      options.maxMessageRecords || DEFAULTS.MAX_MESSAGE_RECORDS;
    this.messageTimeoutMs =
      options.messageTimeoutMs || DEFAULTS.MESSAGE_TIMEOUT_MS;
  }

  /**
   * 初始化統計系統
   * @param {Object} options - 配置選項
   */
  initializeStatistics(options) {
    this.trackingStats = {
      totalMessages: 0,
      unknownMessages: 0,
      failedMessages: 0,
      processedMessages: 0,
      averageProcessingTime: 0,
      lastMessageTime: null,
    };
  }

  /**
   * 初始化 Console 診斷介面
   */
  initializeConsoleInterface() {
    if (typeof window !== "undefined") {
      this.setupConsoleInterface();
    }
  }

  /**
   * 處理追蹤事件
   * @param {Object} event - 追蹤事件
   * @returns {Object} 處理結果
   */
  async process(event) {
    if (!this.trackingEnabled) {
      return { success: true, message: "追蹤已停用" };
    }

    const { type, data } = event;

    try {
      const { EVENT_TYPES } = MessageTracker.CONSTANTS;

      switch (type) {
        case EVENT_TYPES.MESSAGE_SENT:
          return await this.handleMessageSent(data);

        case EVENT_TYPES.MESSAGE_RECEIVED:
          return await this.handleMessageReceived(data);

        case EVENT_TYPES.MESSAGE_PROCESSED:
          return await this.handleMessageProcessed(data);

        case EVENT_TYPES.MESSAGE_FAILED:
          return await this.handleMessageFailed(data);

        default:
          return this.createErrorResponse(
            MessageTracker.CONSTANTS.ERROR_MESSAGES.UNSUPPORTED_EVENT_TYPE,
            type
          );
      }
    } catch (error) {
      console.error(
        `[MessageTracker] ${MessageTracker.CONSTANTS.ERROR_MESSAGES.PROCESSING_FAILED}:`,
        error
      );
      return this.createErrorResponse(error.message);
    }
  }

  /**
   * 處理訊息發送事件
   * @param {Object} messageData - 訊息資料
   * @returns {Object} 處理結果
   */
  async handleMessageSent(messageData) {
    const {
      messageId,
      type,
      source,
      target,
      data,
      timestamp = Date.now(),
    } = messageData;

    // 生成訊息記錄
    const messageRecord = this.createMessageRecord({
      id: messageId || this.generateMessageId(),
      type,
      source,
      target,
      status: MessageTracker.CONSTANTS.MESSAGE_STATUS.SENT,
      timestamp,
      data,
    });

    // 記錄到活躍訊息
    this.activeMessages.set(messageRecord.id, messageRecord);

    // 記錄到訊息日誌
    this.addToMessageLog(messageRecord);

    // 更新統計
    this.updateTrackingStats("sent", timestamp);

    // 發送追蹤事件
    this.eventBus.emit(
      MessageTracker.CONSTANTS.EMIT_EVENTS.DIAGNOSTIC_INFO_UPDATED,
      {
        action: "message_sent",
        messageId: messageRecord.id,
        type,
        timestamp,
      }
    );

    return { success: true, messageId: messageRecord.id };
  }

  /**
   * 處理訊息接收事件
   * @param {Object} messageData - 訊息資料
   * @returns {Object} 處理結果
   */
  async handleMessageReceived(messageData) {
    const { messageId, type, source, timestamp = Date.now() } = messageData;

    // 查找對應的發送記錄
    let messageRecord = this.activeMessages.get(messageId);

    if (!messageRecord) {
      // 如果沒有發送記錄，可能是未追蹤的訊息
      messageRecord = this.createMessageRecord({
        id: messageId || this.generateMessageId(),
        type,
        source,
        status: MessageTracker.CONSTANTS.MESSAGE_STATUS.RECEIVED,
        timestamp,
      });

      this.activeMessages.set(messageRecord.id, messageRecord);
    } else {
      // 更新現有記錄
      messageRecord.status = MessageTracker.CONSTANTS.MESSAGE_STATUS.RECEIVED;
      messageRecord.receivedTime = timestamp;
    }

    // 記錄到訊息日誌
    this.addToMessageLog({ ...messageRecord });

    // 更新統計
    this.updateTrackingStats("received", timestamp);

    return { success: true, messageId: messageRecord.id };
  }

  /**
   * 處理訊息處理完成事件
   * @param {Object} messageData - 訊息資料
   * @returns {Object} 處理結果
   */
  async handleMessageProcessed(messageData) {
    const {
      messageId,
      result,
      processingTime,
      timestamp = Date.now(),
    } = messageData;

    const messageRecord = this.activeMessages.get(messageId);

    if (messageRecord) {
      messageRecord.status = MessageTracker.CONSTANTS.MESSAGE_STATUS.PROCESSED;
      messageRecord.processedTime = timestamp;
      messageRecord.result = result;
      messageRecord.processingTime =
        processingTime || this.calculateProcessingTime(messageRecord);

      // 記錄到訊息日誌
      this.addToMessageLog({ ...messageRecord });

      // 從活躍訊息中移除
      this.activeMessages.delete(messageId);

      // 更新統計
      this.updateTrackingStats(
        "processed",
        timestamp,
        messageRecord.processingTime
      );

      // 發送流程完成事件
      this.eventBus.emit(
        MessageTracker.CONSTANTS.EMIT_EVENTS.MESSAGE_FLOW_COMPLETED,
        {
          messageId,
          type: messageRecord.type,
          processingTime: messageRecord.processingTime,
          timestamp,
        }
      );
    }

    return { success: true, messageId };
  }

  /**
   * 處理訊息失敗事件
   * @param {Object} messageData - 訊息資料
   * @returns {Object} 處理結果
   */
  async handleMessageFailed(messageData) {
    const { messageId, error, timestamp = Date.now() } = messageData;

    const messageRecord = this.activeMessages.get(messageId);

    if (messageRecord) {
      messageRecord.status = MessageTracker.CONSTANTS.MESSAGE_STATUS.FAILED;
      messageRecord.failedTime = timestamp;
      messageRecord.error = error;
      messageRecord.processingTime =
        this.calculateProcessingTime(messageRecord);

      // 記錄到訊息日誌
      this.addToMessageLog({ ...messageRecord });

      // 從活躍訊息中移除
      this.activeMessages.delete(messageId);

      // 更新統計
      this.updateTrackingStats("failed", timestamp);
    }

    return { success: true, messageId };
  }

  /**
   * 創建訊息記錄
   * @param {Object} recordData - 記錄資料
   * @returns {Object} 訊息記錄
   */
  createMessageRecord(recordData) {
    return {
      id: recordData.id,
      type: recordData.type,
      source: recordData.source,
      target: recordData.target,
      status: recordData.status,
      timestamp: recordData.timestamp,
      data: recordData.data,
      error: recordData.error,
      result: recordData.result,
      processingTime: recordData.processingTime,
      receivedTime: recordData.receivedTime,
      processedTime: recordData.processedTime,
      failedTime: recordData.failedTime,
    };
  }

  /**
   * 添加到訊息日誌
   * @param {Object} messageRecord - 訊息記錄
   */
  addToMessageLog(messageRecord) {
    this.messageLog.push({ ...messageRecord });

    // 限制記錄數量
    if (this.messageLog.length > this.maxMessageRecords) {
      this.messageLog.shift();
    }
  }

  /**
   * 更新追蹤統計
   * @param {string} action - 動作類型
   * @param {number} timestamp - 時間戳
   * @param {number} [processingTime] - 處理時間
   */
  updateTrackingStats(action, timestamp, processingTime) {
    this.trackingStats.lastMessageTime = timestamp;

    switch (action) {
      case "sent":
        this.trackingStats.totalMessages++;
        break;
      case "processed":
        this.trackingStats.processedMessages++;
        if (processingTime) {
          this.updateAverageProcessingTime(processingTime);
        }
        break;
      case "failed":
        this.trackingStats.failedMessages++;
        break;
    }
  }

  /**
   * 更新平均處理時間
   * @param {number} processingTime - 處理時間
   */
  updateAverageProcessingTime(processingTime) {
    const { processedMessages, averageProcessingTime } = this.trackingStats;
    this.trackingStats.averageProcessingTime =
      (averageProcessingTime * (processedMessages - 1) + processingTime) /
      processedMessages;
  }

  /**
   * 計算處理時間
   * @param {Object} messageRecord - 訊息記錄
   * @returns {number} 處理時間（毫秒）
   */
  calculateProcessingTime(messageRecord) {
    const endTime =
      messageRecord.processedTime || messageRecord.failedTime || Date.now();
    const startTime = messageRecord.receivedTime || messageRecord.timestamp;
    return endTime - startTime;
  }

  /**
   * 生成訊息ID
   * @returns {string} 訊息ID
   */
  generateMessageId() {
    return `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 設置 Console 診斷介面
   */
  setupConsoleInterface() {
    try {
      window.MessageDiagnostic = {
        status: () => this.getTrackingStatus(),
        messages: (limit) => this.getRecentMessages(limit),
        unknown: () => this.getUnknownMessages(),
        clear: () => this.clearTrackingLog(),
        active: () => this.getActiveMessages(),
        stats: () => this.getTrackingStats(),
      };

      console.log("[MessageTracker] Console 診斷介面已啟用");
      console.log("使用 MessageDiagnostic.status() 查看追蹤狀態");
    } catch (error) {
      console.warn(
        `[MessageTracker] ${MessageTracker.CONSTANTS.ERROR_MESSAGES.CONSOLE_UNAVAILABLE}:`,
        error
      );
    }
  }

  /**
   * 獲取追蹤狀態
   * @returns {Object} 追蹤狀態
   */
  getTrackingStatus() {
    const status = {
      enabled: this.trackingEnabled,
      diagnosticMode: this.diagnosticMode,
      uptime: Date.now() - this.startTime,
      activeMessages: this.activeMessages.size,
      totalRecords: this.messageLog.length,
      ...this.trackingStats,
    };

    console.table(status);
    return status;
  }

  /**
   * 獲取最近的訊息記錄
   * @param {number} [limit] - 限制數量
   * @returns {Array} 訊息記錄
   */
  getRecentMessages(limit) {
    const { CONSOLE_LOG_LIMIT } = MessageTracker.CONSTANTS.DEFAULTS;
    const actualLimit = limit || CONSOLE_LOG_LIMIT;
    const messages = this.messageLog.slice(-actualLimit);

    console.group("最近訊息記錄");
    messages.forEach((msg, index) => {
      console.log(`${index + 1}.`, msg);
    });
    console.groupEnd();

    return messages;
  }

  /**
   * 獲取未知訊息
   * @returns {Array} 未知訊息記錄
   */
  getUnknownMessages() {
    console.warn("未知訊息類型:", this.unknownMessages);
    return this.unknownMessages;
  }

  /**
   * 獲取活躍訊息
   * @returns {Array} 活躍訊息記錄
   */
  getActiveMessages() {
    const active = Array.from(this.activeMessages.values());
    console.log("當前活躍訊息:", active);
    return active;
  }

  /**
   * 獲取追蹤統計
   * @returns {Object} 統計資訊
   */
  getTrackingStats() {
    return { ...this.trackingStats };
  }

  /**
   * 清除追蹤記錄
   * @returns {Object} 清除結果
   */
  clearTrackingLog() {
    const clearedCount = this.messageLog.length;
    this.messageLog = [];
    this.unknownMessages = [];

    console.log(`已清除 ${clearedCount} 條追蹤記錄`);
    return { clearedCount };
  }

  /**
   * 設置清理定時器
   */
  setupCleanupTimer() {
    const { CLEANUP_INTERVAL_MS } = MessageTracker.CONSTANTS.DEFAULTS;

    setInterval(() => {
      this.cleanupTimeoutMessages();
    }, CLEANUP_INTERVAL_MS);
  }

  /**
   * 清理超時的訊息
   */
  cleanupTimeoutMessages() {
    const now = Date.now();
    const timeoutMessages = [];

    for (const [messageId, messageRecord] of this.activeMessages.entries()) {
      if (now - messageRecord.timestamp > this.messageTimeoutMs) {
        messageRecord.status = MessageTracker.CONSTANTS.MESSAGE_STATUS.TIMEOUT;
        messageRecord.timeoutTime = now;

        timeoutMessages.push(messageRecord);
        this.activeMessages.delete(messageId);
      }
    }

    // 將超時訊息添加到日誌
    timeoutMessages.forEach((record) => {
      this.addToMessageLog(record);
    });

    if (timeoutMessages.length > 0 && this.diagnosticMode) {
      console.warn(
        `[MessageTracker] 清理了 ${timeoutMessages.length} 個超時訊息`
      );
    }
  }

  /**
   * 啟用/停用追蹤
   * @param {boolean} enabled - 是否啟用
   */
  setTrackingEnabled(enabled) {
    this.trackingEnabled = enabled;

    if (enabled) {
      this.eventBus.emit(
        MessageTracker.CONSTANTS.EMIT_EVENTS.TRACKING_STARTED,
        {
          timestamp: Date.now(),
        }
      );
    }
  }

  /**
   * 啟用/停用診斷模式
   * @param {boolean} enabled - 是否啟用
   */
  setDiagnosticMode(enabled) {
    this.diagnosticMode = enabled;
    console.log(`[MessageTracker] 診斷模式 ${enabled ? "啟用" : "停用"}`);
  }

  /**
   * 創建標準化錯誤回應
   * @param {string} message - 錯誤訊息
   * @param {string} [details] - 額外詳細資訊
   * @returns {Object} 標準化錯誤回應
   */
  createErrorResponse(message, details = null) {
    const errorResponse = {
      success: false,
      error: message,
      timestamp: Date.now(),
      trackerId: this.generateMessageId(),
    };

    if (details) {
      errorResponse.details = details;
    }

    return errorResponse;
  }
}

module.exports = MessageTracker;
