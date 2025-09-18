/**
 * UI處理器統一配置管理
 *
 * 負責功能：
 * - 統一管理所有UI處理器的配置參數
 * - 消除魔術數字和硬編碼字串
 * - 提供環境相關的配置選項
 * - 支援配置的動態調整和驗證
 *
 * 設計考量：
 * - 集中化配置管理避免分散式配置
 * - 提供合理的預設值
 * - 支援開發和生產環境的差異化配置
 * - 容易擴展新的配置項目
 *
 * 使用情境：
 * - UI處理器初始化時載入對應配置
 * - 動態調整UI行為和效能參數
 * - 環境相關的配置切換
 *
 * @version 1.0.0
 * @since 2025-08-07
 */

/**
 * 通知處理器配置
 */
const NOTIFICATION_CONFIG = {
  // 顯示相關配置
  MAX_NOTIFICATIONS: 5, // 最大同時顯示通知數量
  DEFAULT_DURATION: 3000, // 預設顯示時間(毫秒)
  ANIMATION_DELAY: 10, // 動畫延遲(毫秒)
  HIDE_DELAY: 300, // 隱藏延遲(毫秒)

  // 樣式相關配置
  SUCCESS_CLASS: 'notification-success',
  ERROR_CLASS: 'notification-error',
  WARNING_CLASS: 'notification-warning',
  INFO_CLASS: 'notification-info',

  // 行為配置
  AUTO_HIDE_SUCCESS: true, // 成功通知自動隱藏
  AUTO_HIDE_ERROR: false, // 錯誤通知不自動隱藏
  ENABLE_ANIMATIONS: true, // 啟用動畫效果
  ENABLE_SOUND: false, // 啟用聲音提醒

  // 效能配置
  CLEANUP_INTERVAL: 30000, // 清理間隔(毫秒)
  MAX_HISTORY_SIZE: 100 // 最大歷史記錄數量
}

/**
 * 進度處理器配置
 */
const PROGRESS_CONFIG = {
  // 顯示相關配置
  UPDATE_THROTTLE: 100, // 更新節流間隔(毫秒)
  COMPLETION_DELAY: 1000, // 完成後顯示延遲
  CLEANUP_DELAY: 3000, // 清理延遲(毫秒)

  // 進度條配置
  MIN_PROGRESS: 0, // 最小進度值
  MAX_PROGRESS: 100, // 最大進度值
  DEFAULT_PROGRESS: 0, // 預設進度值
  PROGRESS_PRECISION: 1, // 進度精確度(小數位數)

  // 動畫配置
  ENABLE_SMOOTH_ANIMATION: true, // 啟用平滑動畫
  ANIMATION_DURATION: 300, // 動畫持續時間(毫秒)
  BOUNCE_EFFECT: false, // 彈跳效果

  // 效能配置
  MAX_HISTORY_SIZE: 100, // 最大歷史記錄數量
  UPDATE_BATCH_SIZE: 5 // 批次更新大小
}

/**
 * DOM選擇器配置
 */
const SELECTOR_CONFIG = {
  // 通知相關選擇器
  NOTIFICATION_CONTAINER: [
    '.notification-container',
    '#notification-container',
    '[data-notification-container]'
  ],
  NOTIFICATION_ITEM: [
    '.notification-item',
    '[data-notification-item]'
  ],

  // 進度相關選擇器
  PROGRESS_CONTAINER: [
    '.progress-container',
    '#progress-container',
    '[data-progress-container]'
  ],
  PROGRESS_BAR: [
    '.progress-bar',
    '#progress-bar',
    '[data-progress-bar]'
  ],
  PROGRESS_TEXT: [
    '.progress-text',
    '#progress-text',
    '[data-progress-text]'
  ],

  // 通用選擇器
  ERROR_MESSAGE: [
    '.error-message',
    '[data-error-message]'
  ],
  SUCCESS_MESSAGE: [
    '.success-message',
    '[data-success-message]'
  ]
}

/**
 * 錯誤類型定義
 */
const ERROR_TYPES = {
  // 通用錯誤
  GENERAL: 'GENERAL',
  VALIDATION: 'VALIDATION',
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',

  // DOM相關錯誤
  DOM_NOT_FOUND: 'DOM_NOT_FOUND',
  DOM_MANIPULATION: 'DOM_MANIPULATION',

  // 通知相關錯誤
  NOTIFICATION_CREATION: 'NOTIFICATION_CREATION',
  NOTIFICATION_DISPLAY: 'NOTIFICATION_DISPLAY',

  // 進度相關錯誤
  PROGRESS_UPDATE: 'PROGRESS_UPDATE',
  PROGRESS_INVALID_VALUE: 'PROGRESS_INVALID_VALUE'
}

/**
 * 效能相關配置
 */
const PERFORMANCE_CONFIG = {
  // 監控配置
  ENABLE_PERFORMANCE_MONITORING: true,
  MAX_OPERATION_HISTORY: 100,
  PERFORMANCE_WARNING_THRESHOLD: 1000, // 毫秒

  // 記憶體管理
  MEMORY_CLEANUP_INTERVAL: 60000, // 記憶體清理間隔
  MAX_RETAINED_ERRORS: 50, // 最大保留錯誤數量

  // 批次處理
  BATCH_PROCESSING_DELAY: 16, // 批次處理延遲(約60fps)
  MAX_BATCH_SIZE: 10 // 最大批次大小
}

/**
 * 環境相關配置
 */
const ENVIRONMENT_CONFIG = {
  development: {
    ENABLE_DEBUG_LOGGING: true,
    ENABLE_VERBOSE_ERRORS: true,
    PERFORMANCE_MONITORING_LEVEL: 'detailed'
  },
  test: {
    ENABLE_DEBUG_LOGGING: false,
    ENABLE_VERBOSE_ERRORS: true,
    PERFORMANCE_MONITORING_LEVEL: 'basic',
    DISABLE_ANIMATIONS: true,
    FAST_TIMEOUTS: true
  },
  production: {
    ENABLE_DEBUG_LOGGING: false,
    ENABLE_VERBOSE_ERRORS: false,
    PERFORMANCE_MONITORING_LEVEL: 'basic'
  }
}

/**
 * 主要配置匯出物件
 */
const UI_HANDLER_CONFIG = {
  NOTIFICATION: NOTIFICATION_CONFIG,
  PROGRESS: PROGRESS_CONFIG,
  SELECTORS: SELECTOR_CONFIG,
  ERROR_TYPES,
  PERFORMANCE: PERFORMANCE_CONFIG,

  /**
   * 取得環境相關配置
   *
   * @param {string} environment - 環境名稱 (development, test, production)
   * @returns {Object} 環境配置
   */
  getEnvironmentConfig (environment = 'production') {
    return ENVIRONMENT_CONFIG[environment] || ENVIRONMENT_CONFIG.production
  },

  /**
   * 合併配置
   *
   * @param {Object} baseConfig - 基礎配置
   * @param {Object} overrideConfig - 覆寫配置
   * @returns {Object} 合併後的配置
   */
  mergeConfig (baseConfig, overrideConfig) {
    return {
      ...baseConfig,
      ...overrideConfig
    }
  },

  /**
   * 驗證配置有效性
   *
   * @param {Object} config - 要驗證的配置
   * @param {Array} requiredKeys - 必需的配置鍵
   * @returns {Object} 驗證結果
   */
  validateConfig (config, requiredKeys = []) {
    const missing = requiredKeys.filter(key => !(key in config))

    return {
      isValid: missing.length === 0,
      missingKeys: missing,
      config
    }
  }
}

module.exports = UI_HANDLER_CONFIG
