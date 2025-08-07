/**
 * @fileoverview EventPerformanceMonitor - 事件效能監控系統
 * TDD 循環 #34: 事件效能監控和警告機制
 *
 * 核心功能：
 * - 🔍 事件處理時間追蹤和統計
 * - 📊 記憶體使用監控和警告
 * - ⚠️ 智能效能警告機制
 * - 📈 詳細統計報告生成
 * - 🧹 自動記憶體管理和清理
 * - 🎯 可配置採樣率和閾值
 *
 * 設計特點：
 * - 繼承 EventHandler，優先級 5 (中等優先級)
 * - 支援效能採樣，降低監控開銷
 * - 自動清理過期事件，防止記憶體洩漏
 * - 提供 Chrome DevTools 整合的監控介面
 *
 * @author TDD Development Team
 * @since 2025-08-07
 * @version 1.0.0
 */

const EventHandler = require("../core/event-handler");

/**
 * EventPerformanceMonitor 類別
 *
 * 繼承 EventHandler，提供事件系統的效能監控功能
 * 追蹤事件處理時間、記憶體使用、發出效能警告
 */
class EventPerformanceMonitor extends EventHandler {
  /**
   * 分層常數架構
   *
   * 組織架構：
   * - CONFIG: 基本配置和預設值
   * - EVENTS: 輸入和輸出事件定義
   * - WARNINGS: 警告類型和閾值
   * - PERFORMANCE: 效能相關常數
   * - ERRORS: 錯誤訊息定義
   */
  static get CONSTANTS() {
    return {
      CONFIG: {
        NAME: "EventPerformanceMonitor",
        PRIORITY: 5,
        DEFAULT_SAMPLE_RATE: 1.0,
        DEFAULT_MAX_RECORDS: 1000,
        MAX_WARNING_HISTORY: 100,
      },
      EVENTS: {
        INPUT: {
          PROCESSING_STARTED: "EVENT.PROCESSING.STARTED",
          PROCESSING_COMPLETED: "EVENT.PROCESSING.COMPLETED",
          PROCESSING_FAILED: "EVENT.PROCESSING.FAILED",
          MONITOR_REQUEST: "PERFORMANCE.MONITOR.REQUEST",
        },
        OUTPUT: {
          WARNING: "PERFORMANCE.WARNING",
          MONITOR_RESPONSE: "PERFORMANCE.MONITOR.RESPONSE",
        },
      },
      WARNINGS: {
        TYPES: {
          SLOW_EVENT_PROCESSING: "SLOW_EVENT_PROCESSING",
          HIGH_MEMORY_USAGE: "HIGH_MEMORY_USAGE",
          HIGH_ACTIVE_EVENT_COUNT: "HIGH_ACTIVE_EVENT_COUNT",
        },
        DEFAULT_THRESHOLDS: {
          eventProcessingTime: 1000, // 1 秒
          memoryUsage: 100 * 1024 * 1024, // 100MB
          activeEventCount: 50,
        },
      },
      PERFORMANCE: {
        CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 分鐘
        EVENT_TIMEOUT: 30 * 1000, // 30 秒
        MARK_PREFIX: "event-start-",
        MEASURE_PREFIX: "event-duration-",
      },
      ERRORS: {
        MESSAGES: {
          PROCESSING_ERROR: "效能監控處理錯誤",
          UNSUPPORTED_EVENT_TYPE: "不支援的事件類型",
          EVENT_NOT_FOUND: "找不到對應的開始事件",
        },
      },
    };
  }

  /**
   * 建構函數
   *
   * @param {Object} eventBus - 事件總線實例
   * @param {Object} options - 配置選項
   */
  constructor(eventBus, options = {}) {
    const { CONFIG, EVENTS } = EventPerformanceMonitor.CONSTANTS;

    super(CONFIG.NAME, CONFIG.PRIORITY);

    this.eventBus = eventBus;
    this.supportedEvents = Object.values(EVENTS.INPUT);

    // 合併配置
    this.config = this._mergeConfiguration(options);

    // 初始化狀態
    this.isEnabled = true;
    this.startTime = Date.now();

    // 初始化資料結構
    this._initializeDataStructures();

    // 啟動定期清理
    this._startPeriodicCleanup();
  }

  /**
   * 合併配置選項
   *
   * @param {Object} options - 使用者配置
   * @returns {Object} 合併後的配置
   * @private
   */
  _mergeConfiguration(options) {
    const { CONFIG, WARNINGS, PERFORMANCE } = EventPerformanceMonitor.CONSTANTS;

    return {
      sampleRate: options.sampleRate || CONFIG.DEFAULT_SAMPLE_RATE,
      maxRecords: options.maxRecords || CONFIG.DEFAULT_MAX_RECORDS,
      warningThresholds: {
        ...WARNINGS.DEFAULT_THRESHOLDS,
        ...(options.warningThresholds || {}),
      },
      cleanupInterval: options.cleanupInterval || PERFORMANCE.CLEANUP_INTERVAL,
      eventTimeout: options.eventTimeout || PERFORMANCE.EVENT_TIMEOUT,
    };
  }

  /**
   * 初始化資料結構
   *
   * @private
   */
  _initializeDataStructures() {
    // 活躍事件追蹤
    this.activeEvents = new Map();

    // 效能統計
    this.performanceStats = {
      totalEvents: 0,
      failedEvents: 0,
      averageProcessingTime: 0,
      warningCount: 0,
      lastWarningTime: null,
    };

    // 效能歷史記錄
    this.performanceHistory = [];

    // 警告歷史
    this.warningHistory = [];

    // 清理定時器
    this.cleanupTimer = null;
  }

  /**
   * 處理事件
   *
   * @param {Object} eventData - 事件資料
   * @returns {Object} 處理結果
   */
  process(eventData) {
    if (!this.isEnabled || !this._shouldSample()) {
      return { success: true, skipped: true };
    }

    try {
      return this._dispatchEventHandler(eventData);
    } catch (error) {
      return this._createErrorResponse("PROCESSING_ERROR", error, eventData);
    }
  }

  /**
   * 分派事件處理器
   *
   * @param {Object} eventData - 事件資料
   * @returns {Object} 處理結果
   * @private
   */
  _dispatchEventHandler(eventData) {
    const { EVENTS } = EventPerformanceMonitor.CONSTANTS;

    switch (eventData.type) {
      case EVENTS.INPUT.PROCESSING_STARTED:
        return this._handleProcessingStarted(eventData.data);
      case EVENTS.INPUT.PROCESSING_COMPLETED:
        return this._handleProcessingCompleted(eventData.data);
      case EVENTS.INPUT.PROCESSING_FAILED:
        return this._handleProcessingFailed(eventData.data);
      case EVENTS.INPUT.MONITOR_REQUEST:
        return this._handleMonitorRequest(eventData.data);
      default:
        const { ERRORS } = EventPerformanceMonitor.CONSTANTS;
        return this._createErrorResponse(
          "UNSUPPORTED_EVENT_TYPE",
          new Error(
            `${ERRORS.MESSAGES.UNSUPPORTED_EVENT_TYPE}: ${eventData.type}`
          ),
          eventData
        );
    }
  }

  /**
   * 處理事件開始
   *
   * @param {Object} data - 事件資料
   * @returns {Object} 處理結果
   * @private
   */
  _handleProcessingStarted(data) {
    const { eventId, eventType } = data;
    const startTime = this._getCurrentTime();

    // 記錄活躍事件
    this.activeEvents.set(eventId, {
      eventType,
      startTime,
      timestamp: Date.now(),
    });

    // 設置效能標記
    if (typeof performance !== "undefined" && performance.mark) {
      const { PERFORMANCE } = EventPerformanceMonitor.CONSTANTS;
      performance.mark(`${PERFORMANCE.MARK_PREFIX}${eventId}`);
    }

    // 檢查活躍事件數量警告
    this._checkActiveEventCountWarning();

    return { success: true, eventId, startTime };
  }

  /**
   * 處理事件完成
   *
   * @param {Object} data - 事件資料
   * @returns {Object} 處理結果
   * @private
   */
  _handleProcessingCompleted(data) {
    const { eventId, eventType } = data;
    const endTime = this._getCurrentTime();

    if (!this.activeEvents.has(eventId)) {
      const { ERRORS } = EventPerformanceMonitor.CONSTANTS;
      return { success: false, error: ERRORS.MESSAGES.EVENT_NOT_FOUND };
    }

    const eventInfo = this.activeEvents.get(eventId);
    const processingTime = endTime - eventInfo.startTime;

    // 更新統計
    this._updateProcessingStats(processingTime);

    // 記錄效能資料
    this._addPerformanceRecord({
      eventId,
      eventType: eventType || eventInfo.eventType,
      processingTime,
      timestamp: Date.now(),
    });

    // 檢查處理時間警告
    this._checkProcessingTimeWarning(
      eventId,
      eventType || eventInfo.eventType,
      processingTime
    );

    // 清理活躍事件
    this.activeEvents.delete(eventId);

    // 設置效能測量
    if (typeof performance !== "undefined" && performance.measure) {
      try {
        const { PERFORMANCE } = EventPerformanceMonitor.CONSTANTS;
        performance.measure(
          `${PERFORMANCE.MEASURE_PREFIX}${eventId}`,
          `${PERFORMANCE.MARK_PREFIX}${eventId}`
        );
      } catch (error) {
        // 忽略測量錯誤
      }
    }

    return { success: true, eventId, processingTime };
  }

  /**
   * 處理事件失敗
   *
   * @param {Object} data - 事件資料
   * @returns {Object} 處理結果
   * @private
   */
  _handleProcessingFailed(data) {
    const { eventId, eventType, error } = data;

    // 更新失敗統計
    this.performanceStats.failedEvents++;

    // 清理活躍事件
    if (this.activeEvents.has(eventId)) {
      this.activeEvents.delete(eventId);
    }

    // 記錄失敗事件
    this._addPerformanceRecord({
      eventId,
      eventType,
      failed: true,
      error: error?.message || "未知錯誤",
      timestamp: Date.now(),
    });

    return { success: true, eventId, failed: true };
  }

  /**
   * 處理監控請求
   *
   * @param {Object} data - 請求資料
   * @returns {Object} 處理結果
   * @private
   */
  _handleMonitorRequest(data) {
    const { requestId, includeHistory = false } = data;

    const report = this.generatePerformanceReport();
    const response = {
      requestId,
      report,
      timestamp: Date.now(),
    };

    if (includeHistory) {
      response.history = [...this.performanceHistory];
    }

    // 發送回應事件
    this._emitMonitorResponse(response);

    return { success: true, requestId };
  }

  /**
   * 檢查是否應該採樣
   *
   * @returns {boolean} 是否採樣
   * @private
   */
  _shouldSample() {
    return Math.random() < this.config.sampleRate;
  }

  /**
   * 獲取當前時間
   *
   * @returns {number} 當前時間戳
   * @private
   */
  _getCurrentTime() {
    return typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  }

  /**
   * 更新處理統計
   *
   * @param {number} processingTime - 處理時間
   * @private
   */
  _updateProcessingStats(processingTime) {
    const currentTotal = this.performanceStats.totalEvents;
    const currentAverage = this.performanceStats.averageProcessingTime;

    this.performanceStats.totalEvents++;
    this.performanceStats.averageProcessingTime =
      (currentAverage * currentTotal + processingTime) / (currentTotal + 1);
  }

  /**
   * 添加效能記錄
   *
   * @param {Object} record - 效能記錄
   * @private
   */
  _addPerformanceRecord(record) {
    this.performanceHistory.unshift(record);

    // 限制記錄數量 - 保留最新的記錄
    if (this.performanceHistory.length > this.config.maxRecords) {
      this.performanceHistory.length = this.config.maxRecords;
    }
  }

  /**
   * 檢查處理時間警告
   *
   * @param {string} eventId - 事件 ID
   * @param {string} eventType - 事件類型
   * @param {number} processingTime - 處理時間
   * @private
   */
  _checkProcessingTimeWarning(eventId, eventType, processingTime) {
    const threshold = this.config.warningThresholds.eventProcessingTime;

    if (processingTime > threshold) {
      this._emitWarning(
        EventPerformanceMonitor.CONSTANTS.WARNINGS.TYPES.SLOW_EVENT_PROCESSING,
        {
          eventId,
          eventType,
          processingTime,
          threshold,
          timestamp: Date.now(),
        }
      );
    }
  }

  /**
   * 檢查活躍事件數量警告
   *
   * @private
   */
  _checkActiveEventCountWarning() {
    const activeCount = this.activeEvents.size;
    const threshold = this.config.warningThresholds.activeEventCount;

    if (activeCount > threshold) {
      this._emitWarning(
        EventPerformanceMonitor.CONSTANTS.WARNINGS.TYPES
          .HIGH_ACTIVE_EVENT_COUNT,
        {
          activeEventCount: activeCount,
          threshold,
          timestamp: Date.now(),
        }
      );
    }
  }

  /**
   * 檢查記憶體警告
   *
   * @private
   */
  _checkMemoryWarnings() {
    const memoryStats = this._collectMemoryStats();
    const threshold = this.config.warningThresholds.memoryUsage;

    if (memoryStats.usedMemory > threshold) {
      this._emitWarning(
        EventPerformanceMonitor.CONSTANTS.WARNINGS.TYPES.HIGH_MEMORY_USAGE,
        {
          usedMemory: memoryStats.usedMemory,
          threshold,
          memoryUsagePercent: memoryStats.memoryUsagePercent,
          timestamp: Date.now(),
        }
      );
    }
  }

  /**
   * 收集記憶體統計
   *
   * @returns {Object} 記憶體統計資料
   * @private
   */
  _collectMemoryStats() {
    if (typeof performance !== "undefined" && performance.memory) {
      const memory = performance.memory;
      return {
        usedMemory: memory.usedJSHeapSize,
        totalMemory: memory.totalJSHeapSize,
        memoryLimit: memory.jsHeapSizeLimit,
        memoryUsagePercent: Math.round(
          (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
        ),
      };
    }

    return {
      usedMemory: 0,
      totalMemory: 0,
      memoryLimit: 0,
      memoryUsagePercent: 0,
    };
  }

  /**
   * 發出警告事件
   *
   * @param {string} warningType - 警告類型
   * @param {Object} warningData - 警告資料
   * @private
   */
  _emitWarning(warningType, warningData) {
    const warning = {
      type: warningType,
      ...warningData,
    };

    // 更新警告統計
    this.performanceStats.warningCount++;
    this.performanceStats.lastWarningTime = Date.now();

    // 記錄警告歷史
    this.warningHistory.unshift(warning);
    const { CONFIG } = EventPerformanceMonitor.CONSTANTS;
    if (this.warningHistory.length > CONFIG.MAX_WARNING_HISTORY) {
      // 限制警告歷史數量
      this.warningHistory.length = CONFIG.MAX_WARNING_HISTORY;
    }

    // 發送警告事件
    if (this.eventBus && this.eventBus.emit) {
      this.eventBus.emit(
        EventPerformanceMonitor.CONSTANTS.EVENTS.OUTPUT.WARNING,
        warning
      );
    }
  }

  /**
   * 發送監控回應事件
   *
   * @param {Object} response - 回應資料
   * @private
   */
  _emitMonitorResponse(response) {
    if (this.eventBus && this.eventBus.emit) {
      this.eventBus.emit(
        EventPerformanceMonitor.CONSTANTS.EVENTS.OUTPUT.MONITOR_RESPONSE,
        response
      );
    }
  }

  /**
   * 生成效能報告
   *
   * @returns {Object} 效能報告
   */
  generatePerformanceReport() {
    const memoryStats = this._collectMemoryStats();
    const uptime = Date.now() - this.startTime;

    return {
      summary: {
        totalEvents: this.performanceStats.totalEvents,
        failedEvents: this.performanceStats.failedEvents,
        successRate:
          this.performanceStats.totalEvents > 0
            ? Math.round(
                ((this.performanceStats.totalEvents -
                  this.performanceStats.failedEvents) /
                  this.performanceStats.totalEvents) *
                  100
              )
            : 100,
        averageProcessingTime: this.performanceStats.averageProcessingTime,
        activeEventCount: this.activeEvents.size,
      },
      warnings: {
        totalWarnings: this.performanceStats.warningCount,
        lastWarningTime: this.performanceStats.lastWarningTime,
        recentWarnings: this.warningHistory.slice(0, 5),
      },
      memory: memoryStats,
      uptime,
      timestamp: Date.now(),
    };
  }

  /**
   * 獲取效能統計
   *
   * @returns {Object} 效能統計資料
   */
  getPerformanceStats() {
    return {
      ...this.performanceStats,
      uptime: Date.now() - this.startTime,
      activeEventCount: this.activeEvents.size,
      memoryStats: this._collectMemoryStats(),
    };
  }

  /**
   * 重置統計資料
   */
  resetStats() {
    this.performanceStats = {
      totalEvents: 0,
      failedEvents: 0,
      averageProcessingTime: 0,
      warningCount: 0,
      lastWarningTime: null,
    };

    this.performanceHistory = [];
    this.warningHistory = [];
    this.startTime = Date.now();
  }

  /**
   * 啟動定期清理
   *
   * @private
   */
  _startPeriodicCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this._performCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 執行清理任務
   *
   * @private
   */
  _performCleanup() {
    this._cleanupExpiredEvents();
    this._checkMemoryWarnings();
  }

  /**
   * 清理過期事件
   *
   * @private
   */
  _cleanupExpiredEvents() {
    const now = Date.now();
    const timeout = this.config.eventTimeout;

    for (const [eventId, eventInfo] of this.activeEvents.entries()) {
      if (now - eventInfo.timestamp > timeout) {
        this.activeEvents.delete(eventId);
      }
    }
  }

  /**
   * 停用監控器
   */
  disable() {
    this.isEnabled = false;

    // 清理定時器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // 清理資源
    this.activeEvents.clear();
    this.performanceHistory = [];
    this.warningHistory = [];
  }

  /**
   * 創建錯誤回應
   *
   * @param {string} errorType - 錯誤類型
   * @param {Error} error - 錯誤物件
   * @param {Object} eventData - 事件資料
   * @returns {Object} 錯誤回應
   * @private
   */
  _createErrorResponse(errorType, error, eventData) {
    return {
      success: false,
      error: errorType,
      message: error.message,
      eventData,
      timestamp: Date.now(),
    };
  }
}

module.exports = EventPerformanceMonitor;
