/**
 * Background Service Worker 模組常數定義
 *
 * 負責功能：
 * - 定義所有模組的常數和配置值
 * - 提供統一的常數管理和維護
 * - 支援不同環境的配置切換
 * - 確保常數的類型安全和一致性
 */

// ====================
// 模組狀態常數
// ====================

/**
 * 模組生命週期狀態
 */
const MODULE_STATES = {
  NOT_INITIALIZED: 'not_initialized',
  INITIALIZING: 'initializing',
  INITIALIZED: 'initialized',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  ERROR: 'error',
  CLEANING: 'cleaning'
}

/**
 * 模組健康狀態
 */
const HEALTH_STATES = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  UNKNOWN: 'unknown'
}

// ====================
// 生命週期常數
// ====================

/**
 * Chrome Extension 安裝原因
 */
const INSTALL_REASONS = {
  INSTALL: 'install',
  UPDATE: 'update',
  CHROME_UPDATE: 'chrome_update',
  SHARED_MODULE_UPDATE: 'shared_module_update'
}

/**
 * 生命週期事件類型
 */
const LIFECYCLE_EVENTS = {
  INSTALLED: 'LIFECYCLE.INSTALLED',
  STARTUP: 'LIFECYCLE.STARTUP',
  SHUTDOWN: 'LIFECYCLE.SHUTDOWN',
  LISTENERS_REGISTERED: 'LIFECYCLE.LISTENERS.REGISTERED',
  STATE_CHECKED: 'LIFECYCLE.STATE.CHECKED',
  INSTALL_FAILED: 'LIFECYCLE.INSTALL.FAILED',
  STARTUP_FAILED: 'LIFECYCLE.STARTUP.FAILED',
  FORCE_SHUTDOWN: 'SYSTEM.FORCE.SHUTDOWN'
}

/**
 * 模組啟動順序
 */
const STARTUP_SEQUENCE = [
  'eventCoordinator', // 事件系統優先
  'errorHandler', // 錯誤處理次之
  'messageRouter', // 通訊系統
  'pageMonitor' // 頁面監控最後
]

/**
 * 模組關閉順序（與啟動相反）
 */
const SHUTDOWN_SEQUENCE = [
  'pageMonitor', // 頁面監控最先關閉
  'messageRouter', // 通訊系統
  'errorHandler', // 錯誤處理
  'eventCoordinator' // 事件系統最後關閉
]

// ====================
// 訊息和通訊常數
// ====================

/**
 * 訊息類型
 */
const MESSAGE_TYPES = {
  // 基本訊息類型
  PING: 'PING',
  HEALTH_CHECK: 'HEALTH_CHECK',
  EVENT_SYSTEM_STATUS_CHECK: 'EVENT_SYSTEM_STATUS_CHECK',
  GET_STATUS: 'GET_STATUS',

  // 事件相關
  EVENT_EMIT: 'EVENT.EMIT',
  EVENT_STATS: 'EVENT.STATS',

  // Content Script 訊息
  CONTENT_TO_BACKGROUND: 'CONTENT.TO.BACKGROUND',
  CONTENT_EVENT_FORWARD: 'CONTENT.EVENT.FORWARD',
  CONTENT_STATUS_UPDATE: 'CONTENT.STATUS.UPDATE',
  CONTENT_SCRIPT_READY: 'CONTENT.SCRIPT.READY',
  CONTENT_SCRIPT_ERROR: 'CONTENT.SCRIPT.ERROR',

  // Popup 訊息
  POPUP_TO_BACKGROUND: 'POPUP.TO.BACKGROUND',
  POPUP_STATUS_REQUEST: 'POPUP.STATUS.REQUEST',
  POPUP_DATA_REQUEST: 'POPUP.DATA.REQUEST',
  POPUP_OPERATION_REQUEST: 'POPUP.OPERATION.REQUEST',
  POPUP_SESSION_START: 'POPUP.SESSION.START',
  POPUP_SESSION_END: 'POPUP.SESSION.END',
  POPUP_EXTRACTION_START: 'POPUP.EXTRACTION.START',
  POPUP_EXPORT_REQUEST: 'POPUP.EXPORT.REQUEST'
}

/**
 * 訊息來源類型
 */
const MESSAGE_SOURCES = {
  CONTENT_SCRIPT: 'content-script',
  POPUP: 'popup',
  BACKGROUND: 'background',
  UNKNOWN: 'unknown'
}

/**
 * Content Script 狀態
 */
const CONTENT_SCRIPT_STATES = {
  READY: 'ready',
  BUSY: 'busy',
  ERROR: 'error',
  OFFLINE: 'offline'
}

// ====================
// Chrome API 常數
// ====================

/**
 * 支援的 Chrome API
 */
const SUPPORTED_CHROME_APIS = {
  STORAGE_LOCAL_GET: 'storage.local.get',
  STORAGE_LOCAL_SET: 'storage.local.set',
  STORAGE_LOCAL_REMOVE: 'storage.local.remove',
  STORAGE_LOCAL_CLEAR: 'storage.local.clear',
  STORAGE_SYNC_GET: 'storage.sync.get',
  STORAGE_SYNC_SET: 'storage.sync.set',
  TABS_QUERY: 'tabs.query',
  TABS_SEND_MESSAGE: 'tabs.sendMessage',
  TABS_CREATE: 'tabs.create',
  TABS_UPDATE: 'tabs.update',
  TABS_REMOVE: 'tabs.remove',
  RUNTIME_SEND_MESSAGE: 'runtime.sendMessage',
  RUNTIME_GET_MANIFEST: 'runtime.getManifest',
  RUNTIME_RELOAD: 'runtime.reload',
  NOTIFICATIONS_CREATE: 'notifications.create',
  NOTIFICATIONS_CLEAR: 'notifications.clear'
}

/**
 * API 錯誤類型
 */
const API_ERROR_TYPES = {
  CONNECTION_FAILED: 'connection_failed',
  CONTEXT_INVALIDATED: 'context_invalidated',
  PORT_CLOSED: 'port_closed',
  NOT_FOUND: 'not_found',
  UNKNOWN_ERROR: 'unknown_error'
}

/**
 * 可重試的錯誤訊息
 */
const RETRYABLE_ERRORS = [
  'Could not establish connection',
  'The message port closed',
  'Extension context invalidated'
]

// ====================
// 事件系統常數
// ====================

/**
 * 事件優先級
 */
const EVENT_PRIORITIES = {
  URGENT: 0, // 0-99: 系統關鍵事件
  HIGH: 100, // 100-199: 使用者互動事件
  NORMAL: 200, // 200-299: 一般處理事件
  LOW: 300 // 300-399: 背景處理事件
}

/**
 * 系統事件類型
 */
const SYSTEM_EVENTS = {
  // 系統生命週期
  INSTALLED: 'SYSTEM.INSTALLED',
  UPDATED: 'SYSTEM.UPDATED',
  STARTUP: 'SYSTEM.STARTUP',
  READY: 'SYSTEM.READY',
  SHUTDOWN: 'SYSTEM.SHUTDOWN',
  ERROR: 'SYSTEM.ERROR',

  // 模組事件
  MODULE_INITIALIZED: 'MODULE.INITIALIZED',
  MODULE_STARTED: 'MODULE.STARTED',
  MODULE_STOPPED: 'MODULE.STOPPED',
  MODULE_CLEANED: 'MODULE.CLEANED',

  // 錯誤事件
  INSTALL_FAILED: 'SYSTEM.INSTALL.FAILED',
  STARTUP_FAILED: 'SYSTEM.STARTUP.FAILED',
  INITIALIZATION_FAILED: 'MODULE.INITIALIZATION.FAILED'
}

/**
 * 頁面事件類型
 */
const PAGE_EVENTS = {
  READMOO_DETECTED: 'PAGE.READMOO.DETECTED',
  CONTENT_READY: 'PAGE.CONTENT.READY',
  CONTENT_NOT_READY: 'PAGE.CONTENT.NOT_READY',
  NAVIGATION_CHANGED: 'PAGE.NAVIGATION.CHANGED'
}

/**
 * 提取事件類型
 */
const EXTRACTION_EVENTS = {
  STARTED: 'EXTRACTION.STARTED',
  COMPLETED: 'EXTRACTION.COMPLETED',
  PROGRESS: 'EXTRACTION.PROGRESS',
  ERROR: 'EXTRACTION.ERROR',
  STARTED_FROM_POPUP: 'EXTRACTION.STARTED.FROM.POPUP'
}

/**
 * 訊息事件類型
 */
const MESSAGE_EVENTS = {
  RECEIVED: 'MESSAGE.RECEIVED',
  ERROR: 'MESSAGE.ERROR',
  ROUTER_STOP_ACCEPTING: 'MESSAGE.ROUTER.STOP.ACCEPTING',
  CONTENT_MESSAGE_RECEIVED: 'CONTENT.MESSAGE.RECEIVED',
  POPUP_MESSAGE_RECEIVED: 'POPUP.MESSAGE.RECEIVED'
}

/**
 * UX Domain 事件類型
 */
const UX_EVENTS = {
  // 協調器事件
  COORDINATOR_INITIALIZED: 'UX.COORDINATOR.INITIALIZED',
  COORDINATOR_STARTED: 'UX.COORDINATOR.STARTED',
  COORDINATOR_STOPPED: 'UX.COORDINATOR.STOPPED',

  // 狀態管理事件
  STATUS_REQUEST: 'UX.STATUS.REQUEST',
  STATUS_RESPONSE: 'UX.STATUS.RESPONSE',

  // 偏好設定事件
  PREFERENCE_UPDATED: 'UX.PREFERENCE.UPDATED',
  PREFERENCE_COORDINATED: 'UX.PREFERENCE.COORDINATED',
  PREFERENCE_RESET: 'UX.PREFERENCE.RESET'
}

/**
 * 主題相關事件類型
 */
const THEME_EVENTS = {
  // 主題變更事件
  CHANGE_REQUEST: 'UX.THEME.CHANGE.REQUEST',
  CHANGED: 'UX.THEME.CHANGED',
  CHANGE_COORDINATED: 'UX.THEME.CHANGE.COORDINATED',

  // 主題提供者事件
  PROVIDER_REGISTERED: 'UX.THEME.PROVIDER.REGISTERED',
  PROVIDER_UNREGISTERED: 'UX.THEME.PROVIDER.UNREGISTERED',

  // 系統主題事件
  SYSTEM_CHANGED: 'UX.THEME.SYSTEM.CHANGED'
}

/**
 * Popup 相關事件類型
 */
const POPUP_EVENTS = {
  // 狀態協調事件
  STATE_COORDINATED: 'UX.POPUP.STATE.COORDINATED',
  STATE_UPDATE_REQUESTED: 'UX.POPUP.STATE.UPDATE.REQUESTED',

  // 模組載入事件
  MODULES_LOADED: 'UX.POPUP.MODULES.LOADED',
  MODULE_LOADED: 'UX.POPUP.MODULE.LOADED',

  // 提取協調事件
  EXTRACTION_COORDINATED: 'UX.POPUP.EXTRACTION.COORDINATED',

  // UI 協調事件
  UI_COORDINATION_INITIALIZED: 'UX.POPUP_UI.COORDINATION.INITIALIZED',
  UI_COORDINATION_STARTED: 'UX.POPUP_UI.COORDINATION.STARTED'
}

// ====================
// 配置和限制常數
// ====================

/**
 * 超時和限制設定
 */
const TIMEOUTS = {
  DEFAULT_MESSAGE_TIMEOUT: 120000, // 2分鐘
  SHUTDOWN_TIMEOUT: 30000, // 30秒
  STARTUP_TIMEOUT: 60000, // 1分鐘
  API_RETRY_DELAY: 1000, // 1秒
  BATCH_DELAY: 50, // 50毫秒
  HEALTH_CHECK_INTERVAL: 30000, // 30秒
  QUEUE_COMPLETION_TIMEOUT: 5000 // 5秒
}

/**
 * 限制設定
 */
const LIMITS = {
  MAX_RETRIES: 3,
  MAX_QUEUE_SIZE: 100,
  MAX_ERROR_HISTORY: 50,
  MAX_SESSION_HISTORY: 20,
  MAX_STARTUP_ATTEMPTS: 3,
  MAX_BATCH_OPERATIONS: 50
}

/**
 * 預設配置
 */
const DEFAULT_CONFIG = {
  isEnabled: true,
  extractionSettings: {
    autoExtract: false,
    progressTracking: true,
    dataValidation: true
  },
  debugMode: false,
  logLevel: 'info'
}

// ====================
// 操作權限常數
// ====================

/**
 * Popup 操作權限配置
 */
const OPERATION_PERMISSIONS = {
  'EXTRACTION.START': {
    requiresActiveTab: true,
    requiresReadmoo: true
  },
  'DATA.EXPORT': {
    requiresData: true
  },
  'SYSTEM.RELOAD': {
    requiresConfirmation: true
  },
  'STORAGE.CLEAR': {
    requiresConfirmation: true
  },
  'CONFIG.UPDATE': {
    requiresValidation: true
  },
  'TAB.NAVIGATE': {
    requiresActiveTab: true
  }
}

/**
 * 支援的操作類型
 */
const OPERATION_TYPES = {
  SYSTEM_RELOAD: 'SYSTEM.RELOAD',
  STORAGE_CLEAR: 'STORAGE.CLEAR',
  CONFIG_UPDATE: 'CONFIG.UPDATE',
  TAB_NAVIGATE: 'TAB.NAVIGATE',
  EXTRACTION_START: 'EXTRACTION.START',
  DATA_EXPORT: 'DATA.EXPORT'
}

// ====================
// 同步系統常數
// ====================

/**
 * 同步狀態常數
 */
const SYNC_STATES = {
  INITIALIZING: 'initializing',
  VALIDATING: 'validating',
  EXPORTING: 'exporting',
  TRANSFERRING: 'transferring',
  IMPORTING: 'importing',
  VERIFYING: 'verifying',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

/**
 * 同步策略常數
 */
const SYNC_STRATEGIES = {
  MERGE: 'merge', // 合併資料（預設）
  OVERWRITE: 'overwrite', // 覆寫目標資料
  SKIP_EXISTING: 'skip_existing', // 跳過重複資料
  CREATE_BACKUP: 'create_backup' // 建立備份後合併
}

/**
 * 同步事件常數
 */
const SYNC_EVENTS = {
  SYNC_REQUEST: 'SYNC.REQUEST',
  SYNC_RESPONSE: 'SYNC.RESPONSE',
  SYNC_STARTED: 'SYNC.STARTED',
  SYNC_PROGRESS: 'SYNC.PROGRESS',
  SYNC_COMPLETED: 'SYNC.COMPLETED',
  SYNC_FAILED: 'SYNC.FAILED',
  SYNC_CANCELLED: 'SYNC.CANCELLED',
  CONFLICT_DETECTED: 'SYNC.CONFLICT_DETECTED',
  CONFLICT_RESOLVED: 'SYNC.CONFLICT_RESOLVED'
}

// ====================
// 儲存鍵名常數
// ====================

/**
 * Chrome Storage 鍵名
 */
const STORAGE_KEYS = {
  // 系統配置
  IS_ENABLED: 'isEnabled',
  EXTRACTION_SETTINGS: 'extractionSettings',
  VERSION: 'version',

  // 資料儲存
  READMOO_BOOKS: 'readmoo_books',
  EXTRACTION_HISTORY: 'extraction_history',
  LAST_EXTRACTION: 'last_extraction',

  // 系統狀態
  SYSTEM_SHUTDOWN_STATE: 'system_shutdown_state',
  LAST_SHUTDOWN_TIME: 'last_shutdown_time',
  STARTUP_FAILURE_REPORT: 'startup_failure_report'
}

// ====================
// 匯出所有常數
// ====================

module.exports = {
  // 模組狀態
  MODULE_STATES,
  HEALTH_STATES,

  // 生命週期
  INSTALL_REASONS,
  LIFECYCLE_EVENTS,
  STARTUP_SEQUENCE,
  SHUTDOWN_SEQUENCE,

  // 訊息和通訊
  MESSAGE_TYPES,
  MESSAGE_SOURCES,
  CONTENT_SCRIPT_STATES,

  // Chrome API
  SUPPORTED_CHROME_APIS,
  API_ERROR_TYPES,
  RETRYABLE_ERRORS,

  // 事件系統
  EVENT_PRIORITIES,
  SYSTEM_EVENTS,
  PAGE_EVENTS,
  EXTRACTION_EVENTS,
  MESSAGE_EVENTS,

  // 同步系統
  SYNC_STATES,
  SYNC_STRATEGIES,
  SYNC_EVENTS,

  // 配置和限制
  TIMEOUTS,
  LIMITS,
  DEFAULT_CONFIG,

  // 操作權限
  OPERATION_PERMISSIONS,
  OPERATION_TYPES,

  // 儲存鍵名
  STORAGE_KEYS
}
