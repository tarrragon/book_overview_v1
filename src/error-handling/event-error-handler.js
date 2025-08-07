/**
 * EventErrorHandler - 核心錯誤處理系統
 * TDD 循環 #32: EventErrorHandler 核心錯誤系統
 *
 * 負責功能：
 * - 統一錯誤處理和分類系統
 * - 斷路器模式實現和自動恢復
 * - 錯誤隔離和處理器管理
 * - 系統健康監控和報告
 *
 * 設計考量：
 * - 繼承 EventHandler 提供標準化事件處理
 * - 最高優先級 (0) 確保系統錯誤優先處理
 * - 斷路器模式防止級聯失敗
 * - 自動恢復機制維持系統穩定性
 *
 * 處理流程：
 * 1. 接收系統和處理器錯誤事件
 * 2. 分類錯誤嚴重程度並更新統計
 * 3. 管理斷路器狀態和自動恢復
 * 4. 監控系統整體健康狀態
 *
 * 使用情境：
 * - 系統級錯誤監控和處理
 * - 防止錯誤級聯和系統崩潰
 * - 自動錯誤恢復和系統自癒
 */

const EventHandler = require("../core/event-handler");

class EventErrorHandler extends EventHandler {
  /**
   * 常數定義 - 統一管理所有硬編碼值
   */
  static get CONSTANTS() {
    return {
      // 事件類型
      EVENT_TYPES: {
        ERROR_SYSTEM: "ERROR.SYSTEM",
        ERROR_HANDLER: "ERROR.HANDLER",
        ERROR_CIRCUIT_BREAKER: "ERROR.CIRCUIT_BREAKER",
      },

      // 發送事件類型
      EMIT_EVENTS: {
        ERROR_CLASSIFIED: "ERROR.CLASSIFIED",
        ERROR_HANDLER_ISOLATED: "ERROR.HANDLER_ISOLATED",
        SYSTEM_ALERT: "SYSTEM.ALERT",
        CIRCUIT_BREAKER_OPENED: "CIRCUIT_BREAKER.OPENED",
        CIRCUIT_BREAKER_CLOSED: "CIRCUIT_BREAKER.CLOSED",
        HANDLER_ISOLATED: "HANDLER.ISOLATED",
        HANDLER_RESTORED: "HANDLER.RESTORED",
        HANDLER_RECOVERY_ATTEMPT: "HANDLER.RECOVERY_ATTEMPT",
        SYSTEM_HEALTH_DEGRADED: "SYSTEM.HEALTH_DEGRADED",
      },

      // 斷路器狀態
      CIRCUIT_BREAKER_STATES: {
        CLOSED: "CLOSED",
        OPEN: "OPEN",
        HALF_OPEN: "HALF_OPEN",
      },

      // 錯誤嚴重程度
      SEVERITY_LEVELS: {
        LOW: "LOW",
        MEDIUM: "MEDIUM",
        HIGH: "HIGH",
        CRITICAL: "CRITICAL",
      },

      // 系統健康狀態
      HEALTH_STATUS: {
        HEALTHY: "HEALTHY",
        DEGRADED: "DEGRADED",
        UNHEALTHY: "UNHEALTHY",
      },

      // 預設配置
      DEFAULTS: {
        MAX_ERROR_RECORDS: 100,
        HEALTH_THRESHOLD: 5,
        AUTO_RECOVERY_INTERVAL: 300000, // 5分鐘
        CIRCUIT_BREAKER_TIMEOUT: 60000, // 1分鐘
        CIRCUIT_BREAKER_FAILURE_THRESHOLD: 5,
      },
    };
  }

  /**
   * 建構 EventErrorHandler
   * @param {Object} eventBus - 事件總線實例
   * @param {Object} options - 配置選項
   */
  constructor(eventBus, options = {}) {
    // EventHandler 建構函數簽名是 (name, priority)
    super("EventErrorHandler", 0); // 最高優先級

    // 設置 eventBus 和支援的事件
    this.eventBus = eventBus;
    this.supportedEvents = [
      EventErrorHandler.CONSTANTS.EVENT_TYPES.ERROR_SYSTEM,
      EventErrorHandler.CONSTANTS.EVENT_TYPES.ERROR_HANDLER,
      EventErrorHandler.CONSTANTS.EVENT_TYPES.ERROR_CIRCUIT_BREAKER,
    ];

    // 初始化各個子系統
    this.initializeErrorStats(options);
    this.initializeCircuitBreakers(options);
    this.initializeHandlerIsolation(options);
    this.initializeSystemHealth(options);
    this.setupAutoRecovery(options);
  }

  /**
   * 初始化錯誤統計系統
   * @param {Object} options - 配置選項
   */
  initializeErrorStats(options = {}) {
    this.errorStats = {
      totalErrors: 0,
      systemErrors: 0,
      handlerErrors: 0,
      criticalErrors: 0,
      errorsByType: new Map(),
      lastErrorTime: null,
    };

    this.recentErrors = [];
    this.maxErrorRecords =
      options.maxErrorRecords ||
      EventErrorHandler.CONSTANTS.DEFAULTS.MAX_ERROR_RECORDS;
  }

  /**
   * 初始化斷路器系統
   * @param {Object} options - 配置選項
   */
  initializeCircuitBreakers(options = {}) {
    this.circuitBreakers = new Map();
  }

  /**
   * 初始化處理器隔離系統
   * @param {Object} options - 配置選項
   */
  initializeHandlerIsolation(options = {}) {
    this.isolatedHandlers = new Map();
  }

  /**
   * 初始化系統健康監控
   * @param {Object} options - 配置選項
   */
  initializeSystemHealth(options) {
    this.systemHealthy = true;
    this.healthThreshold =
      options.healthThreshold ||
      EventErrorHandler.CONSTANTS.DEFAULTS.HEALTH_THRESHOLD;
  }

  /**
   * 設置自動恢復機制
   * @param {Object} options - 配置選項
   */
  setupAutoRecovery(options) {
    const interval =
      options.autoRecoveryInterval ||
      EventErrorHandler.CONSTANTS.DEFAULTS.AUTO_RECOVERY_INTERVAL;

    setInterval(() => {
      this.attemptAutoRecovery();
    }, interval);
  }

  /**
   * 處理錯誤事件
   * @param {Object} event - 錯誤事件
   * @returns {Object} 處理結果
   */
  async process(event) {
    const { type, data } = event;

    try {
      const { EVENT_TYPES } = EventErrorHandler.CONSTANTS;

      switch (type) {
        case EVENT_TYPES.ERROR_SYSTEM:
          return await this.handleSystemError(data);

        case EVENT_TYPES.ERROR_HANDLER:
          return await this.handleHandlerError(data);

        case EVENT_TYPES.ERROR_CIRCUIT_BREAKER:
          return await this.handleCircuitBreakerError(data);

        default:
          return this.createErrorResponse("不支援的錯誤事件類型", type);
      }
    } catch (error) {
      console.error("[EventErrorHandler] 處理錯誤事件失敗:", error);
      return this.createErrorResponse(error.message);
    }
  }

  /**
   * 處理系統錯誤
   * @param {Object} errorData - 系統錯誤資料
   * @returns {Object} 處理結果
   */
  async handleSystemError(errorData) {
    const { error, component, severity = "MEDIUM", timestamp } = errorData;

    // 更新統計
    this.errorStats.totalErrors++;
    this.errorStats.systemErrors++;
    this.errorStats.lastErrorTime = timestamp || Date.now();

    // 處理嚴重程度
    if (severity === EventErrorHandler.CONSTANTS.SEVERITY_LEVELS.CRITICAL) {
      this.errorStats.criticalErrors++;
      this.eventBus.emit(EventErrorHandler.CONSTANTS.EMIT_EVENTS.SYSTEM_ALERT, {
        level: "CRITICAL",
        error: error.message,
        component,
        timestamp: this.errorStats.lastErrorTime,
      });
    }

    // 記錄錯誤
    this.recordError({
      type: "SYSTEM_ERROR",
      error,
      component,
      severity,
      timestamp: this.errorStats.lastErrorTime,
    });

    // 更新斷路器狀態
    if (component) {
      this.updateCircuitBreaker(component, false);
    }

    // 發送分類事件
    this.eventBus.emit(
      EventErrorHandler.CONSTANTS.EMIT_EVENTS.ERROR_CLASSIFIED,
      {
        type: "SYSTEM_ERROR",
        severity,
        component,
        timestamp: this.errorStats.lastErrorTime,
      }
    );

    // 檢查系統健康狀態
    this.checkSystemHealth();

    return { success: true, errorId: this.generateErrorId() };
  }

  /**
   * 處理處理器錯誤
   * @param {Object} errorData - 處理器錯誤資料
   * @returns {Object} 處理結果
   */
  async handleHandlerError(errorData) {
    const {
      error,
      handlerName,
      eventType,
      consecutiveFailures = 1,
      timestamp,
    } = errorData;

    // 更新統計
    this.errorStats.totalErrors++;
    this.errorStats.handlerErrors++;
    this.errorStats.lastErrorTime = timestamp || Date.now();

    // 記錄錯誤
    this.recordError({
      type: "HANDLER_ERROR",
      error,
      handlerName,
      eventType,
      consecutiveFailures,
      timestamp: this.errorStats.lastErrorTime,
    });

    // 檢查是否需要隔離處理器
    if (consecutiveFailures >= 5) {
      this.isolateHandler(handlerName, `連續失敗 ${consecutiveFailures} 次`);
    }

    // 發送處理器隔離事件
    this.eventBus.emit(
      EventErrorHandler.CONSTANTS.EMIT_EVENTS.ERROR_HANDLER_ISOLATED,
      {
        handlerName,
        eventType,
        consecutiveFailures,
        timestamp: this.errorStats.lastErrorTime,
      }
    );

    return { success: true, errorId: this.generateErrorId() };
  }

  /**
   * 處理斷路器錯誤
   * @param {Object} errorData - 斷路器錯誤資料
   * @returns {Object} 處理結果
   */
  async handleCircuitBreakerError(errorData) {
    const { component, error, timestamp } = errorData;

    // 更新統計
    this.errorStats.totalErrors++;
    this.errorStats.lastErrorTime = timestamp || Date.now();

    // 更新斷路器狀態
    this.updateCircuitBreaker(component, false);

    return { success: true, errorId: this.generateErrorId() };
  }

  /**
   * 創建斷路器
   * @param {string} component - 組件名稱
   * @param {Object} options - 斷路器配置
   */
  createCircuitBreaker(component, options = {}) {
    const { DEFAULTS, CIRCUIT_BREAKER_STATES } = EventErrorHandler.CONSTANTS;

    const breaker = {
      component,
      state: CIRCUIT_BREAKER_STATES.CLOSED,
      failureCount: 0,
      failureThreshold:
        options.failureThreshold || DEFAULTS.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      timeout: options.timeout || DEFAULTS.CIRCUIT_BREAKER_TIMEOUT,
      lastFailureTime: null,
      nextAttemptTime: null,
    };

    this.circuitBreakers.set(component, breaker);
    return breaker;
  }

  /**
   * 更新斷路器狀態
   * @param {string} component - 組件名稱
   * @param {boolean} success - 是否成功
   */
  updateCircuitBreaker(component, success) {
    let breaker = this.circuitBreakers.get(component);

    if (!breaker) {
      breaker = this.createCircuitBreaker(component);
    }

    const { CIRCUIT_BREAKER_STATES } = EventErrorHandler.CONSTANTS;
    const now = Date.now();

    if (success) {
      // 成功執行，重置失敗計數
      breaker.failureCount = 0;

      // 如果斷路器是開啟或半開狀態，成功後應該關閉
      if (
        breaker.state === CIRCUIT_BREAKER_STATES.HALF_OPEN ||
        breaker.state === CIRCUIT_BREAKER_STATES.OPEN
      ) {
        breaker.state = CIRCUIT_BREAKER_STATES.CLOSED;
        this.eventBus.emit(
          EventErrorHandler.CONSTANTS.EMIT_EVENTS.CIRCUIT_BREAKER_CLOSED,
          {
            component,
            timestamp: now,
          }
        );
      }
    } else {
      // 失敗執行，增加失敗計數
      breaker.failureCount++;
      breaker.lastFailureTime = now;

      if (
        breaker.failureCount >= breaker.failureThreshold &&
        breaker.state === CIRCUIT_BREAKER_STATES.CLOSED
      ) {
        breaker.state = CIRCUIT_BREAKER_STATES.OPEN;
        breaker.nextAttemptTime = now + breaker.timeout;
        this.eventBus.emit(
          EventErrorHandler.CONSTANTS.EMIT_EVENTS.CIRCUIT_BREAKER_OPENED,
          {
            component,
            failureCount: breaker.failureCount,
            timestamp: now,
          }
        );
      }
    }
  }

  /**
   * 檢查是否可以執行
   * @param {string} component - 組件名稱
   * @returns {boolean} 是否可以執行
   */
  canExecute(component) {
    const breaker = this.circuitBreakers.get(component);
    if (!breaker) return true;

    const { CIRCUIT_BREAKER_STATES } = EventErrorHandler.CONSTANTS;
    const now = Date.now();

    switch (breaker.state) {
      case CIRCUIT_BREAKER_STATES.CLOSED:
        return true;

      case CIRCUIT_BREAKER_STATES.OPEN:
        if (now >= breaker.nextAttemptTime) {
          breaker.state = CIRCUIT_BREAKER_STATES.HALF_OPEN;
          return true;
        }
        return false;

      case CIRCUIT_BREAKER_STATES.HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /**
   * 記錄成功執行
   * @param {string} component - 組件名稱
   */
  recordSuccess(component) {
    this.updateCircuitBreaker(component, true);
  }

  /**
   * 隔離處理器
   * @param {string} handlerName - 處理器名稱
   * @param {string} reason - 隔離原因
   */
  isolateHandler(handlerName, reason) {
    this.isolatedHandlers.set(handlerName, {
      reason,
      isolatedAt: Date.now(),
      recoveryAttempts: 0,
    });

    this.eventBus.emit(
      EventErrorHandler.CONSTANTS.EMIT_EVENTS.HANDLER_ISOLATED,
      {
        handlerName,
        reason,
        timestamp: Date.now(),
      }
    );
  }

  /**
   * 恢復處理器
   * @param {string} handlerName - 處理器名稱
   */
  restoreHandler(handlerName) {
    this.isolatedHandlers.delete(handlerName);

    this.eventBus.emit(
      EventErrorHandler.CONSTANTS.EMIT_EVENTS.HANDLER_RESTORED,
      {
        handlerName,
        timestamp: Date.now(),
      }
    );
  }

  /**
   * 檢查處理器是否被隔離
   * @param {string} handlerName - 處理器名稱
   * @returns {boolean} 是否被隔離
   */
  isHandlerIsolated(handlerName) {
    return this.isolatedHandlers.has(handlerName);
  }

  /**
   * 嘗試自動恢復
   */
  attemptAutoRecovery() {
    // 嘗試恢復隔離的處理器
    for (const [handlerName, isolation] of this.isolatedHandlers.entries()) {
      this.eventBus.emit(
        EventErrorHandler.CONSTANTS.EMIT_EVENTS.HANDLER_RECOVERY_ATTEMPT,
        {
          handlerName,
          isolatedAt: isolation.isolatedAt,
          recoveryAttempts: isolation.recoveryAttempts,
          timestamp: Date.now(),
        }
      );

      isolation.recoveryAttempts++;
    }

    // 清理過期的斷路器
    this.cleanupExpiredCircuitBreakers();
  }

  /**
   * 獲取系統健康狀態
   * @returns {Object} 系統健康狀態
   */
  getSystemHealth() {
    const { HEALTH_STATUS } = EventErrorHandler.CONSTANTS;

    let status = HEALTH_STATUS.HEALTHY;

    if (this.errorStats.criticalErrors > 0) {
      status = HEALTH_STATUS.UNHEALTHY;
    } else if (this.errorStats.totalErrors > this.healthThreshold) {
      status = HEALTH_STATUS.DEGRADED;
    }

    return {
      status,
      totalErrors: this.errorStats.totalErrors,
      criticalErrors: this.errorStats.criticalErrors,
      handlerErrors: this.errorStats.handlerErrors,
      isolatedHandlers: this.isolatedHandlers.size,
      openCircuitBreakers: Array.from(this.circuitBreakers.values()).filter(
        (b) =>
          b.state === EventErrorHandler.CONSTANTS.CIRCUIT_BREAKER_STATES.OPEN
      ).length,
      lastErrorTime: this.errorStats.lastErrorTime,
    };
  }

  /**
   * 檢查系統健康狀態
   */
  checkSystemHealth() {
    const health = this.getSystemHealth();

    if (
      health.status === EventErrorHandler.CONSTANTS.HEALTH_STATUS.UNHEALTHY &&
      this.systemHealthy
    ) {
      this.systemHealthy = false;
      this.eventBus.emit(
        EventErrorHandler.CONSTANTS.EMIT_EVENTS.SYSTEM_HEALTH_DEGRADED,
        {
          health,
          timestamp: Date.now(),
        }
      );
    } else if (
      health.status === EventErrorHandler.CONSTANTS.HEALTH_STATUS.HEALTHY &&
      !this.systemHealthy
    ) {
      this.systemHealthy = true;
    }
  }

  /**
   * 生成系統健康報告
   * @returns {string} 健康報告
   */
  generateHealthReport() {
    const health = this.getSystemHealth();

    let report = "=== 系統健康狀態報告 ===\n\n";
    report += `系統狀態: ${health.status}\n`;
    report += `總錯誤數: ${health.totalErrors}\n`;
    report += `嚴重錯誤: ${health.criticalErrors}\n`;
    report += `處理器錯誤: ${health.handlerErrors}\n`;
    report += `隔離的處理器: ${health.isolatedHandlers}\n`;
    report += `開啟的斷路器: ${health.openCircuitBreakers}\n`;
    report += `最後錯誤時間: ${
      health.lastErrorTime
        ? new Date(health.lastErrorTime).toLocaleString()
        : "無"
    }\n`;

    return report;
  }

  /**
   * 清理過期的斷路器
   */
  cleanupExpiredCircuitBreakers() {
    const { CIRCUIT_BREAKER_STATES } = EventErrorHandler.CONSTANTS;
    const now = Date.now();

    for (const [component, breaker] of this.circuitBreakers.entries()) {
      if (
        breaker.state === CIRCUIT_BREAKER_STATES.OPEN &&
        now >= breaker.nextAttemptTime
      ) {
        breaker.state = CIRCUIT_BREAKER_STATES.HALF_OPEN;
      }
    }
  }

  /**
   * 獲取記憶體使用統計
   * @returns {Object} 記憶體統計
   */
  getMemoryUsage() {
    const errorRecordsCount = this.recentErrors.length;
    const circuitBreakersCount = this.circuitBreakers.size;
    const estimatedMemoryUsage =
      errorRecordsCount * 1024 + circuitBreakersCount * 512;

    return {
      errorRecordsCount,
      circuitBreakersCount,
      estimatedMemoryUsage,
      lastCleanupTime: Date.now(),
    };
  }

  /**
   * 記錄錯誤
   * @param {Object} errorRecord - 錯誤記錄
   */
  recordError(errorRecord) {
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
      errorId: this.generateErrorId(),
    };

    if (details) {
      errorResponse.details = details;
    }

    return errorResponse;
  }

  /**
   * 生成錯誤ID
   * @returns {string} 錯誤ID
   */
  generateErrorId() {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = EventErrorHandler;
