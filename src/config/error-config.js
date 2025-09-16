/**
 * 錯誤處理系統生產環境配置
 *
 * 負責功能：
 * - 統一錯誤處理配置管理
 * - 生產/開發環境差異化配置
 * - 使用者友善錯誤訊息對應
 * - 診斷資料收集設定
 *
 * 使用情境：
 * - 生產環境錯誤處理初始化
 * - 錯誤訊息本地化和友善化
 * - 診斷模式控制
 */

/**
 * 環境檢測
 */
const isProduction = () => {
  // Chrome Extension 中檢測生產環境
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    // 檢查 manifest 中的 version 或其他標識
    return !chrome.runtime.getManifest().name.includes('Dev')
  }
  return process.env.NODE_ENV === 'production'
}

/**
 * 基礎錯誤配置
 */
const BASE_CONFIG = {
  // 錯誤記錄配置
  logging: {
    maxErrorRecords: 1000, // 最大錯誤記錄數量
    errorRetentionDays: 30, // 錯誤記錄保留天數
    enableConsoleLogging: true, // 啟用 Console 日誌
    enablePersistence: true // 啟用持久化儲存
  },

  // 效能監控配置
  performance: {
    maxPerformanceRecords: 500, // 最大效能記錄數量
    performanceSampleRate: 0.1, // 效能採樣率（10%）
    warningThresholds: {
      processingTime: 5000, // 處理時間警告閾值（毫秒）
      memoryUsage: 50 * 1024 * 1024, // 記憶體使用警告閾值（50MB）
      activeEvents: 100 // 活躍事件數量警告閾值
    }
  },

  // 事件追蹤配置
  tracking: {
    maxEventRecords: 2000, // 最大事件記錄數量
    trackingLevel: 'INFO', // 追蹤級別：DEBUG, INFO, WARN, ERROR
    enableEventPersistence: true, // 啟用事件持久化
    excludeEventTypes: [ // 排除的事件類型
      'UI.HEARTBEAT',
      'SYSTEM.KEEPALIVE'
    ]
  },

  // 斷路器配置
  circuitBreaker: {
    failureThreshold: 5, // 失敗閾值
    recoveryTimeout: 30000, // 恢復超時（毫秒）
    monitoringPeriod: 60000 // 監控周期（毫秒）
  },

  // 使用者通知配置
  userNotification: {
    showErrorDetails: false, // 是否顯示錯誤詳情
    enableDiagnosticSuggestions: true, // 啟用診斷建議
    maxUserErrorHistoryDays: 7 // 使用者錯誤歷史保留天數
  }
}

/**
 * 開發環境配置覆蓋
 */
const DEVELOPMENT_CONFIG = {
  logging: {
    maxErrorRecords: 10000, // 開發環境保留更多記錄
    enableConsoleLogging: true // 啟用詳細 Console 輸出
  },
  performance: {
    performanceSampleRate: 1.0 // 100% 採樣率
  },
  tracking: {
    trackingLevel: 'DEBUG', // 開發環境使用 DEBUG 級別
    excludeEventTypes: [] // 開發環境不排除任何事件
  },
  userNotification: {
    showErrorDetails: true // 開發環境顯示詳細錯誤
  }
}

/**
 * 生產環境配置覆蓋
 */
const PRODUCTION_CONFIG = {
  logging: {
    enableConsoleLogging: false // 生產環境關閉 Console 日誌
  },
  performance: {
    performanceSampleRate: 0.05 // 5% 採樣率
  },
  tracking: {
    trackingLevel: 'WARN' // 生產環境只記錄警告以上級別
  },
  userNotification: {
    showErrorDetails: false // 生產環境不顯示詳細錯誤
  }
}

/**
 * 使用者友善錯誤訊息對應
 */
const USER_ERROR_MESSAGES = {
  // 訊息處理錯誤
  MESSAGE_UNKNOWN_TYPE: {
    title: '通訊錯誤',
    message: '擴展組件通訊出現問題，請嘗試重新載入擴展。',
    actions: [
      '重新載入擴展',
      '重新整理頁面',
      '重新啟動瀏覽器'
    ],
    severity: 'warning'
  },

  MESSAGE_ROUTING_ERROR: {
    title: '訊息路由錯誤',
    message: '系統內部通訊錯誤，請稍後重試。',
    actions: [
      '稍後重試',
      '檢查網路連線',
      '聯絡技術支援'
    ],
    severity: 'error'
  },

  // 資料提取錯誤
  EXTRACTION_PAGE_NOT_READY: {
    title: '頁面未準備就緒',
    message: 'Readmoo 頁面尚未完全載入，請等待載入完成後重試。',
    actions: [
      '等待頁面載入完成',
      '重新整理頁面',
      '檢查網路連線'
    ],
    severity: 'warning'
  },

  EXTRACTION_NO_DATA: {
    title: '未找到書籍資料',
    message: '當前頁面沒有可提取的書籍資料。',
    actions: [
      '確認您在正確的 Readmoo 頁面',
      '檢查書庫是否有書籍',
      '嘗試重新載入頁面'
    ],
    severity: 'info'
  },

  EXTRACTION_ACCESS_DENIED: {
    title: '存取被拒絕',
    message: '無法存取 Readmoo，請檢查登入狀態和擴展權限。',
    actions: [
      '重新登入 Readmoo',
      '檢查擴展權限設定',
      '確認網路連線正常'
    ],
    severity: 'error'
  },

  // 儲存相關錯誤
  STORAGE_QUOTA_EXCEEDED: {
    title: '儲存空間不足',
    message: 'Chrome 擴展儲存空間已滿，請清理資料或匯出重要內容。',
    actions: [
      '清除歷史資料',
      '匯出現有書籍資料',
      '重置擴展資料'
    ],
    severity: 'error'
  },

  STORAGE_DATA_CORRUPTED: {
    title: '資料損壞',
    message: '儲存的資料檔案損壞，可能需要重置資料。',
    actions: [
      '嘗試恢復備份',
      '重置擴展資料',
      '聯絡技術支援'
    ],
    severity: 'error'
  },

  STORAGE_ACCESS_ERROR: {
    title: '儲存存取錯誤',
    message: '無法存取儲存系統，請檢查 Chrome 設定。',
    actions: [
      '重新啟動 Chrome',
      '檢查擴展權限',
      '暫時停用其他擴展'
    ],
    severity: 'error'
  },

  // 系統錯誤
  SYSTEM_MEMORY_LOW: {
    title: '記憶體不足',
    message: '系統記憶體不足，建議關閉不必要的分頁或應用程式。',
    actions: [
      '關閉不必要的分頁',
      '關閉其他應用程式',
      '重新啟動瀏覽器'
    ],
    severity: 'warning'
  },

  SYSTEM_COMPATIBILITY: {
    title: '相容性問題',
    message: '您的 Chrome 版本可能過舊，請更新到最新版本。',
    actions: [
      '更新 Chrome 到最新版本',
      '重新啟動瀏覽器',
      '檢查作業系統相容性'
    ],
    severity: 'error'
  },

  // 預設錯誤訊息
  UNKNOWN_ERROR: {
    title: '未知錯誤',
    message: '發生了未預期的錯誤，請嘗試重新操作。',
    actions: [
      '重新嘗試操作',
      '重新載入擴展',
      '聯絡技術支援'
    ],
    severity: 'error'
  }
}

/**
 * 診斷建議映射
 * Note: 暫時未使用，保留供未來擴展診斷功能使用
 */
// eslint-disable-next-line no-unused-vars
const DIAGNOSTIC_SUGGESTIONS = {
  START_EXTRACTION_ERROR: {
    problem: 'START_EXTRACTION 訊息處理失敗',
    suggestions: [
      '檢查 Content Script 是否正確載入',
      '驗證訊息類型定義一致性',
      '確認事件監聽器正確註冊',
      '檢查 Chrome Extension 權限設定'
    ],
    technicalDetails: {
      messageFlow: 'Popup → Background → Content Script',
      requiredPermissions: ['activeTab', 'storage'],
      commonCauses: [
        '擴展版本不匹配',
        'Content Script 注入失敗',
        '訊息路由配置錯誤'
      ]
    }
  }
}

/**
 * 取得環境配置
 */
const getErrorConfig = () => {
  const config = { ...BASE_CONFIG }

  if (isProduction()) {
    // 深度合併生產環境配置
    Object.keys(PRODUCTION_CONFIG).forEach(key => {
      config[key] = { ...config[key], ...PRODUCTION_CONFIG[key] }
    })
  } else {
    // 深度合併開發環境配置
    Object.keys(DEVELOPMENT_CONFIG).forEach(key => {
      config[key] = { ...config[key], ...DEVELOPMENT_CONFIG[key] }
    })
  }

  return config
}

/**
 * 取得使用者友善錯誤訊息
 */
const getUserErrorMessage = (errorType, defaultMessage = null) => {
  const errorInfo = USER_ERROR_MESSAGES[errorType] || USER_ERROR_MESSAGES.UNKNOWN_ERROR

  // 如果有預設訊息，則合併
  if (defaultMessage) {
    return {
      ...errorInfo,
      technicalMessage: defaultMessage
    }
  }

  return errorInfo
}

/**
 * 導出配置和工具函數
 */
module.exports = {
  getErrorConfig,
  getUserErrorMessage,

  // 常數導出
  ERROR_SEVERITY: {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
  },

  TRACKING_LEVELS: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
  }
}
