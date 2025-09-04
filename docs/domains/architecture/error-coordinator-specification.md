# ErrorCoordinator 和雙通道事件系統技術規範

## 📋 文件資訊

- **標題**: ErrorCoordinator 和雙通道事件系統技術規範
- **版本**: 1.0.0
- **日期**: 2025-08-10
- **狀態**: 規範階段
- **依賴**: error-handling-refactoring-design.md

## 🎯 技術規範目標

### 核心目的

定義 ErrorCoordinator 和雙通道事件系統的詳細技術實作規範，確保：

- API 接口的一致性和可預測性
- 系統組件間的解耦和獨立性
- 錯誤處理流程的可靠性和穩定性
- 開發和測試的便利性

## 🏗 ErrorCoordinator 詳細規範

### 類別定義和建構

#### 建構函數簽章

```typescript
class ErrorCoordinator {
  constructor(systemEventBus: SystemEventBus, options?: ErrorCoordinatorOptions)
}

interface ErrorCoordinatorOptions {
  // 錯誤處理配置
  maxRetryAttempts?: number // 預設: 3
  retryDelayMs?: number // 預設: 1000
  errorTimeoutMs?: number // 預設: 5000

  // 記憶體和效能限制
  maxErrorHistorySize?: number // 預設: 1000
  errorCleanupIntervalMs?: number // 預設: 60000

  // 錯誤處理行為
  enableAutoRecovery?: boolean // 預設: true
  enableErrorStatistics?: boolean // 預設: true
  enableErrorReporting?: boolean // 預設: true

  // 開發和除錯
  debugMode?: boolean // 預設: false
  logLevel?: LogLevel // 預設: 'error'
}

enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}
```

### 核心方法規範

#### handleError() - 主要錯誤處理接口

```typescript
async handleError(error: ProcessingError): Promise<ErrorResult> {
  // 參數驗證
  if (!error || !error.id || !error.timestamp) {
    throw new Error('Invalid ProcessingError format');
  }

  // 錯誤分類
  const classification = this.classifyError(error);

  // 處理策略選擇
  const strategy = this._selectStrategy(classification);

  // 執行錯誤處理
  const result = await this._executeErrorHandling(error, strategy);

  // 更新統計和記錄
  this._updateStatistics(error, result);
  this._recordErrorHistory(error, result);

  return result;
}
```

#### classifyError() - 錯誤分類邏輯

```typescript
classifyError(error: ProcessingError): ErrorClassification {
  // 基於錯誤訊息模式匹配
  const messagePatterns = {
    [ErrorCategory.NETWORK]: [
      /network.*error/i,
      /connection.*failed/i,
      /timeout/i,
      /fetch.*failed/i
    ],
    [ErrorCategory.MEMORY]: [
      /out of memory/i,
      /heap.*limit/i,
      /maximum call stack/i
    ],
    [ErrorCategory.VALIDATION]: [
      /validation.*failed/i,
      /invalid.*input/i,
      /required.*field/i
    ]
  };

  // 基於 error.name 分類
  const errorNameMapping = {
    'TypeError': ErrorCategory.BUSINESS_LOGIC,
    'RangeError': ErrorCategory.VALIDATION,
    'ReferenceError': ErrorCategory.CONFIGURATION,
    'NetworkError': ErrorCategory.NETWORK,
    'TimeoutError': ErrorCategory.TIMEOUT
  };

  // 基於上下文組件分類
  const componentMapping = {
    'export-handler': ErrorCategory.BUSINESS_LOGIC,
    'storage-adapter': ErrorCategory.STORAGE,
    'network-client': ErrorCategory.NETWORK
  };

  return {
    category: this._determineCategory(error, messagePatterns, errorNameMapping, componentMapping),
    severity: this._determineSeverity(error),
    confidence: this._calculateConfidence(error)
  };
}

interface ErrorClassification {
  category: ErrorCategory;
  severity: ErrorSeverity;
  confidence: number; // 0.0 - 1.0
}

enum ErrorSeverity {
  LOW = 'low',        // 使用者可忽略，系統繼續運行
  MEDIUM = 'medium',  // 影響使用者體驗，但不中斷功能
  HIGH = 'high',      // 影響核心功能，需要立即處理
  CRITICAL = 'critical' // 系統無法繼續運行
}
```

#### registerErrorHandler() - 錯誤處理器註冊

```typescript
registerErrorHandler(handler: IErrorHandler): void {
  // 驗證處理器接口
  if (!handler.name || !handler.canHandle || !handler.handle) {
    throw new Error('Invalid error handler: missing required methods');
  }

  // 檢查重複註冊
  if (this._handlers.has(handler.name)) {
    throw new Error(`Error handler '${handler.name}' is already registered`);
  }

  // 註冊處理器
  this._handlers.set(handler.name, handler);

  // 綁定系統事件
  const supportedEvents = handler.getSupportedEvents();
  supportedEvents.forEach(eventType => {
    this._systemEventBus.on(eventType, async (data) => {
      if (handler.canHandle(data)) {
        return await handler.handle(data);
      }
    });
  });

  this._logDebug(`Registered error handler: ${handler.name}`);
}

interface IErrorHandler {
  readonly name: string;
  readonly priority: number;

  // 核心方法
  canHandle(error: ProcessingError): boolean;
  handle(error: ProcessingError): Promise<ErrorResult>;
  getSupportedEvents(): SystemEventType[];

  // 生命週期方法
  initialize?(): Promise<void>;
  cleanup?(): Promise<void>;

  // 統計和監控
  getStatistics?(): HandlerStatistics;
  reset?(): void;
}
```

### 錯誤處理策略實作

#### 策略選擇邏輯

```typescript
private _selectStrategy(classification: ErrorClassification): ErrorHandlingStrategy {
  const strategyMatrix = {
    [ErrorCategory.NETWORK]: {
      [ErrorSeverity.LOW]: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      [ErrorSeverity.MEDIUM]: ErrorHandlingStrategy.RETRY_WITH_BACKOFF,
      [ErrorSeverity.HIGH]: ErrorHandlingStrategy.RETRY_AND_DEGRADE,
      [ErrorSeverity.CRITICAL]: ErrorHandlingStrategy.FAIL_AND_NOTIFY
    },
    [ErrorCategory.MEMORY]: {
      [ErrorSeverity.LOW]: ErrorHandlingStrategy.CLEANUP_AND_CONTINUE,
      [ErrorSeverity.MEDIUM]: ErrorHandlingStrategy.CLEANUP_AND_RETRY,
      [ErrorSeverity.HIGH]: ErrorHandlingStrategy.RESTART_COMPONENT,
      [ErrorSeverity.CRITICAL]: ErrorHandlingStrategy.EMERGENCY_SHUTDOWN
    },
    [ErrorCategory.BUSINESS_LOGIC]: {
      [ErrorSeverity.LOW]: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      [ErrorSeverity.MEDIUM]: ErrorHandlingStrategy.USER_NOTIFICATION,
      [ErrorSeverity.HIGH]: ErrorHandlingStrategy.USER_NOTIFICATION_AND_FALLBACK,
      [ErrorSeverity.CRITICAL]: ErrorHandlingStrategy.FAIL_AND_NOTIFY
    }
    // ... 其他類別的策略對應
  };

  return strategyMatrix[classification.category][classification.severity]
    || ErrorHandlingStrategy.LOG_AND_CONTINUE;
}

enum ErrorHandlingStrategy {
  LOG_AND_CONTINUE = 'log_and_continue',
  RETRY_WITH_BACKOFF = 'retry_with_backoff',
  RETRY_AND_DEGRADE = 'retry_and_degrade',
  CLEANUP_AND_CONTINUE = 'cleanup_and_continue',
  CLEANUP_AND_RETRY = 'cleanup_and_retry',
  RESTART_COMPONENT = 'restart_component',
  USER_NOTIFICATION = 'user_notification',
  USER_NOTIFICATION_AND_FALLBACK = 'user_notification_and_fallback',
  FAIL_AND_NOTIFY = 'fail_and_notify',
  EMERGENCY_SHUTDOWN = 'emergency_shutdown'
}
```

#### 策略執行實作

```typescript
private async _executeErrorHandling(
  error: ProcessingError,
  strategy: ErrorHandlingStrategy
): Promise<ErrorResult> {

  switch (strategy) {
    case ErrorHandlingStrategy.RETRY_WITH_BACKOFF:
      return await this._executeRetryStrategy(error);

    case ErrorHandlingStrategy.CLEANUP_AND_RETRY:
      return await this._executeCleanupStrategy(error);

    case ErrorHandlingStrategy.USER_NOTIFICATION:
      return await this._executeNotificationStrategy(error);

    // ... 其他策略實作

    default:
      return await this._executeDefaultStrategy(error);
  }
}

private async _executeRetryStrategy(error: ProcessingError): Promise<ErrorResult> {
  const maxAttempts = this._options.maxRetryAttempts || 3;
  const baseDelay = this._options.retryDelayMs || 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // 嘗試重新執行原始操作
      const result = await this._retryOriginalOperation(error);

      return {
        processed: true,
        strategy: ErrorHandlingStrategy.RETRY_WITH_BACKOFF,
        actions: [`Retry attempt ${attempt} succeeded`],
        recommendation: 'Operation completed after retry',
        retryable: false,
        metadata: { attemptCount: attempt }
      };

    } catch (retryError) {
      if (attempt < maxAttempts) {
        // 指數退避延遲
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await this._delay(delay);
        continue;
      } else {
        // 最後一次重試失敗，回傳失敗結果
        return {
          processed: true,
          strategy: ErrorHandlingStrategy.RETRY_WITH_BACKOFF,
          actions: [`All ${maxAttempts} retry attempts failed`],
          recommendation: 'Manual intervention required',
          retryable: false,
          metadata: {
            attemptCount: maxAttempts,
            finalError: retryError.message
          }
        };
      }
    }
  }
}
```

## 🚀 雙通道事件系統規範

### SystemEventBus 實作規範

#### 基本架構

```typescript
class SystemEventBus extends EventBus {
  constructor(options?: SystemEventBusOptions) {
    super()
    this._options = { ...defaultSystemEventBusOptions, ...options }
    this._systemListeners = new Map()
    this._eventQueue = new PriorityQueue()
    this._processing = false
  }

  // 系統事件特有的發送邏輯
  async emit(eventType: SystemEventType, data: SystemEventData): Promise<void> {
    // 驗證事件類型
    if (!this._isValidSystemEvent(eventType)) {
      throw new Error(`Invalid system event type: ${eventType}`)
    }

    // 增強事件資料
    const enhancedData = this._enhanceEventData(data)

    // 添加到優先級佇列
    this._eventQueue.enqueue({
      type: eventType,
      data: enhancedData,
      priority: this._getEventPriority(eventType),
      timestamp: Date.now()
    })

    // 啟動處理程序
    if (!this._processing) {
      await this._processEventQueue()
    }
  }

  // 系統事件監聽器註冊
  on(eventType: SystemEventType, handler: SystemEventHandler): void {
    if (!this._systemListeners.has(eventType)) {
      this._systemListeners.set(eventType, [])
    }

    const wrappedHandler = this._wrapSystemHandler(handler)
    this._systemListeners.get(eventType).push(wrappedHandler)
  }
}

interface SystemEventBusOptions {
  maxQueueSize?: number // 預設: 10000
  processingIntervalMs?: number // 預設: 10
  enablePrioritization?: boolean // 預設: true
  errorHandler?: (error: Error) => void
}

interface SystemEventData {
  correlationId?: string
  userId?: string
  sessionId?: string
  component: string
  metadata?: Record<string, any>
}
```

#### 事件優先級系統

```typescript
private _getEventPriority(eventType: SystemEventType): EventPriority {
  const priorityMap = {
    // 最高優先級：系統安全和穩定性
    [SystemEventType.MEMORY_CRITICAL]: EventPriority.CRITICAL,
    [SystemEventType.SECURITY_BREACH]: EventPriority.CRITICAL,
    [SystemEventType.SYSTEM_FAILURE]: EventPriority.CRITICAL,

    // 高優先級：錯誤和警告
    [SystemEventType.ERROR_OCCURRED]: EventPriority.HIGH,
    [SystemEventType.PERFORMANCE_WARNING]: EventPriority.HIGH,
    [SystemEventType.RESOURCE_EXHAUSTION]: EventPriority.HIGH,

    // 中優先級：一般系統事件
    [SystemEventType.COMPONENT_STATE_CHANGED]: EventPriority.MEDIUM,
    [SystemEventType.CONFIGURATION_UPDATED]: EventPriority.MEDIUM,

    // 低優先級：統計和監控
    [SystemEventType.STATISTICS_UPDATED]: EventPriority.LOW,
    [SystemEventType.HEARTBEAT]: EventPriority.LOW
  };

  return priorityMap[eventType] || EventPriority.MEDIUM;
}

enum EventPriority {
  CRITICAL = 0,  // 立即處理
  HIGH = 1,      // 高優先級
  MEDIUM = 2,    // 一般優先級
  LOW = 3        // 低優先級
}
```

### BusinessEventBus 實作規範

#### 業務事件處理

```typescript
class BusinessEventBus extends EventBus {
  constructor(systemEventBus: SystemEventBus, options?: BusinessEventBusOptions) {
    super()
    this._systemEventBus = systemEventBus
    this._options = { ...defaultBusinessEventBusOptions, ...options }
    this._businessListeners = new Map()
  }

  // 業務事件發送（含錯誤處理）
  async emit(eventType: BusinessEventType, data: BusinessEventData): Promise<any> {
    try {
      // 驗證業務事件
      this._validateBusinessEvent(eventType, data)

      // 執行業務邏輯
      const result = await super.emit(eventType, data)

      // 發送成功事件到系統通道
      await this._systemEventBus.emit(SystemEventType.BUSINESS_OPERATION_COMPLETED, {
        component: 'BusinessEventBus',
        operation: eventType,
        metadata: { success: true, resultSize: JSON.stringify(result).length }
      })

      return result
    } catch (error) {
      // 將業務錯誤轉換為系統錯誤事件
      const processingError = this._convertToProcessingError(error, eventType, data)

      // 發送到系統事件通道
      await this._systemEventBus.emit(SystemEventType.ERROR_OCCURRED, processingError)

      // 重新拋出錯誤供上層處理
      throw error
    }
  }

  private _convertToProcessingError(
    error: Error,
    eventType: BusinessEventType,
    data: BusinessEventData
  ): ProcessingError {
    return {
      id: this._generateErrorId(),
      timestamp: Date.now(),
      message: error.message,
      originalError: error,
      context: {
        component: 'BusinessEventBus',
        operation: eventType,
        inputData: data,
        userId: data.userId
      },
      classification: ErrorCategory.BUSINESS_LOGIC,
      severity: this._determineSeverityFromError(error),
      recoverable: this._isRecoverableError(error),
      stackTrace: error.stack || '',
      correlationId: data.correlationId || this._generateCorrelationId()
    }
  }
}
```

### 事件類型定義

#### 系統事件類型枚舉

```typescript
enum SystemEventType {
  // 錯誤相關事件
  ERROR_OCCURRED = 'SYSTEM.ERROR.OCCURRED',
  ERROR_RECOVERED = 'SYSTEM.ERROR.RECOVERED',
  ERROR_HANDLER_FAILED = 'SYSTEM.ERROR.HANDLER_FAILED',

  // 效能和資源監控
  MEMORY_WARNING = 'SYSTEM.MONITOR.MEMORY.WARNING',
  MEMORY_CRITICAL = 'SYSTEM.MONITOR.MEMORY.CRITICAL',
  PERFORMANCE_DEGRADATION = 'SYSTEM.MONITOR.PERFORMANCE.DEGRADATION',
  RESOURCE_EXHAUSTION = 'SYSTEM.MONITOR.RESOURCE.EXHAUSTION',

  // 系統狀態
  COMPONENT_STARTED = 'SYSTEM.STATE.COMPONENT.STARTED',
  COMPONENT_STOPPED = 'SYSTEM.STATE.COMPONENT.STOPPED',
  COMPONENT_STATE_CHANGED = 'SYSTEM.STATE.COMPONENT.CHANGED',

  // 安全和診斷
  SECURITY_BREACH = 'SYSTEM.SECURITY.BREACH',
  DIAGNOSTIC_INFO = 'SYSTEM.DIAGNOSTIC.INFO',
  HEARTBEAT = 'SYSTEM.HEARTBEAT',

  // 業務操作完成通知
  BUSINESS_OPERATION_COMPLETED = 'SYSTEM.BUSINESS.OPERATION.COMPLETED',
  BUSINESS_OPERATION_FAILED = 'SYSTEM.BUSINESS.OPERATION.FAILED'
}
```

#### 業務事件類型枚舉

```typescript
enum BusinessEventType {
  // 資料提取相關
  DATA_EXTRACTION_REQUESTED = 'BUSINESS.DATA.EXTRACTION.REQUESTED',
  DATA_EXTRACTION_COMPLETED = 'BUSINESS.DATA.EXTRACTION.COMPLETED',
  DATA_VALIDATION_COMPLETED = 'BUSINESS.DATA.VALIDATION.COMPLETED',

  // 匯出相關
  EXPORT_CSV_REQUESTED = 'BUSINESS.EXPORT.CSV.REQUESTED',
  EXPORT_JSON_REQUESTED = 'BUSINESS.EXPORT.JSON.REQUESTED',
  EXPORT_EXCEL_REQUESTED = 'BUSINESS.EXPORT.EXCEL.REQUESTED',
  EXPORT_COMPLETED = 'BUSINESS.EXPORT.COMPLETED',

  // 儲存相關
  STORAGE_SAVE_REQUESTED = 'BUSINESS.STORAGE.SAVE.REQUESTED',
  STORAGE_LOAD_REQUESTED = 'BUSINESS.STORAGE.LOAD.REQUESTED',
  STORAGE_OPERATION_COMPLETED = 'BUSINESS.STORAGE.OPERATION.COMPLETED',

  // UI 相關
  UI_ACTION_TRIGGERED = 'BUSINESS.UI.ACTION.TRIGGERED',
  UI_STATE_UPDATED = 'BUSINESS.UI.STATE.UPDATED',

  // 搜尋和篩選
  SEARCH_REQUESTED = 'BUSINESS.SEARCH.REQUESTED',
  FILTER_APPLIED = 'BUSINESS.FILTER.APPLIED'
}
```

## 🔧 實作指導原則

### 程式碼組織結構

```
src/
├── core/
│   ├── error/
│   │   ├── error-coordinator.js          # ErrorCoordinator 主實作
│   │   ├── error-handlers/               # 具體錯誤處理器
│   │   │   ├── network-error-handler.js
│   │   │   ├── memory-error-handler.js
│   │   │   └── validation-error-handler.js
│   │   ├── strategies/                   # 錯誤處理策略
│   │   │   ├── retry-strategy.js
│   │   │   ├── cleanup-strategy.js
│   │   │   └── notification-strategy.js
│   │   └── types/                        # 型別定義
│   │       ├── processing-error.js
│   │       ├── error-result.js
│   │       └── error-enums.js
│   └── events/
│       ├── system-event-bus.js           # 系統事件匯流排
│       ├── business-event-bus.js         # 業務事件匯流排
│       └── event-types.js                # 事件類型定義
```

### 測試結構對應

```
tests/
├── unit/
│   ├── core/
│   │   ├── error/
│   │   │   ├── error-coordinator.test.js
│   │   │   ├── error-handlers/
│   │   │   └── strategies/
│   │   └── events/
│   │       ├── system-event-bus.test.js
│   │       └── business-event-bus.test.js
├── integration/
│   ├── error-handling-flow.test.js       # 完整錯誤處理流程
│   └── dual-channel-communication.test.js # 雙通道通訊測試
└── performance/
    └── error-handling-load.test.js       # 錯誤處理負載測試
```

### 效能考量

#### 記憶體管理

```typescript
class ErrorCoordinator {
  private _cleanupErrorHistory(): void {
    const now = Date.now()
    const maxAge = this._options.errorCleanupIntervalMs || 60000
    const maxSize = this._options.maxErrorHistorySize || 1000

    // 清理過期記錄
    this._errorHistory = this._errorHistory.filter((entry) => now - entry.timestamp < maxAge)

    // 保持最大大小限制
    if (this._errorHistory.length > maxSize) {
      this._errorHistory = this._errorHistory
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, maxSize)
    }
  }

  private _shouldCompressError(error: ProcessingError): boolean {
    // 壓縮大型錯誤物件以節省記憶體
    const errorSize = JSON.stringify(error).length
    return errorSize > 10240 // 大於 10KB 時壓縮
  }
}
```

#### 效能優化策略

```typescript
class SystemEventBus {
  private async _processEventQueue(): Promise<void> {
    this._processing = true

    while (!this._eventQueue.isEmpty()) {
      const batchSize = Math.min(10, this._eventQueue.size())
      const batch = []

      // 批次處理事件
      for (let i = 0; i < batchSize; i++) {
        const event = this._eventQueue.dequeue()
        if (event) batch.push(event)
      }

      // 並行處理批次中的事件
      await Promise.allSettled(batch.map((event) => this._handleSingleEvent(event)))

      // 短暫讓出控制權
      await this._yield()
    }

    this._processing = false
  }

  private async _yield(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0))
  }
}
```

## 📊 監控和診斷

### 統計資訊收集

```typescript
interface ErrorStatistics {
  totalErrors: number
  errorsByCategory: Record<ErrorCategory, number>
  errorsBySeverity: Record<ErrorSeverity, number>
  errorsByComponent: Record<string, number>

  // 處理效能統計
  averageProcessingTime: number
  maxProcessingTime: number
  processingTimePercentiles: {
    p50: number
    p90: number
    p95: number
    p99: number
  }

  // 成功率統計
  totalProcessed: number
  successfullyProcessed: number
  successRate: number

  // 重試統計
  retriedErrors: number
  successfulRetries: number
  retrySuccessRate: number
}
```

### 健康檢查接口

```typescript
class ErrorCoordinator {
  getHealthStatus(): HealthStatus {
    const stats = this.getErrorStats()
    const memoryUsage = process.memoryUsage()

    return {
      status: this._determineHealthStatus(stats),
      timestamp: Date.now(),
      errorRate: this._calculateErrorRate(),
      memoryUsage: memoryUsage.heapUsed,
      activeHandlers: this._handlers.size,
      queueSize: this._getSystemEventBusQueueSize(),
      lastError: this._getLastError(),
      uptime: Date.now() - this._startTime
    }
  }

  private _determineHealthStatus(stats: ErrorStatistics): HealthStatusType {
    const errorRate = stats.totalErrors / stats.totalProcessed
    const memoryUsage = process.memoryUsage().heapUsed

    if (errorRate > 0.1 || memoryUsage > 100 * 1024 * 1024) {
      // 10% 錯誤率或 100MB 記憶體
      return HealthStatusType.UNHEALTHY
    } else if (errorRate > 0.05 || memoryUsage > 50 * 1024 * 1024) {
      // 5% 錯誤率或 50MB 記憶體
      return HealthStatusType.DEGRADED
    } else {
      return HealthStatusType.HEALTHY
    }
  }
}

enum HealthStatusType {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}
```

---

_本規範文件將作為實作的權威參考，任何變更都需要更新此文件並記錄在工作日誌中。_
