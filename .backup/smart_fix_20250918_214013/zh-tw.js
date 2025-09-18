/**
 * 繁體中文 (台灣) 語言包
 *
 * 負責功能：
 * - 提供所有 Background Service Worker 模組的繁體中文文字
 * - 支援動態參數替換和格式化
 * - 維護一致的台灣用語習慣
 * - 提供錯誤訊息和系統通知的本地化文字
 */

const zhTW = {
  // ====================
  // 系統基礎訊息
  // ====================
  system: {
    name: 'Readmoo 書庫提取器',
    description: 'Chrome Extension Background Service Worker',

    // 系統狀態
    status: {
      healthy: '正常',
      degraded: '降級',
      unhealthy: '異常',
      unknown: '未知',
      active: '啟用',
      inactive: '停用',
      running: '運作中',
      stopped: '已停止',
      initializing: '初始化中',
      error: '錯誤'
    },

    // 基本操作
    actions: {
      initialize: '初始化',
      start: '啟動',
      stop: '停止',
      restart: '重新啟動',
      cleanup: '清理',
      reload: '重新載入',
      reset: '重設'
    },

    // 系統訊息
    messages: {
      starting: '系統啟動中...',
      ready: '系統準備就緒',
      stopping: '系統停止中...',
      stopped: '系統已停止',
      error: '系統發生錯誤',
      unavailable: '系統暫時無法使用',
      maintenance: '系統維護中'
    }
  },

  // ====================
  // 模組相關訊息
  // ====================
  modules: {
    // 基本狀態
    states: {
      not_initialized: '未初始化',
      initializing: '初始化中',
      initialized: '已初始化',
      starting: '啟動中',
      running: '運作中',
      stopping: '停止中',
      stopped: '已停止',
      error: '錯誤',
      cleaning: '清理中'
    },

    // 基本操作訊息
    operations: {
      create: '建立 {moduleName} 模組',
      initialize: '初始化 {moduleName} 模組',
      start: '啟動 {moduleName} 模組',
      stop: '停止 {moduleName} 模組',
      cleanup: '清理 {moduleName} 模組',

      // 成功訊息
      createSuccess: '{moduleName} 模組建立完成',
      initializeSuccess: '{moduleName} 模組初始化完成',
      startSuccess: '{moduleName} 模組啟動完成',
      stopSuccess: '{moduleName} 模組停止完成',
      cleanupSuccess: '{moduleName} 模組清理完成',

      // 失敗訊息
      createFailed: '{moduleName} 模組建立失敗',
      initializeFailed: '{moduleName} 模組初始化失敗',
      startFailed: '{moduleName} 模組啟動失敗',
      stopFailed: '{moduleName} 模組停止失敗',
      cleanupFailed: '{moduleName} 模組清理失敗',

      // 跳過訊息
      alreadyInitialized: '{moduleName} 模組已初始化，跳過重複初始化',
      alreadyStarted: '{moduleName} 模組已啟動，跳過重複啟動',
      notStarted: '{moduleName} 模組未啟動，跳過停止'
    },

    // 健康檢查
    health: {
      checkStarted: '開始 {moduleName} 模組健康檢查',
      checkCompleted: '{moduleName} 模組健康檢查完成',
      statusHealthy: '{moduleName} 模組狀態正常',
      statusDegraded: '{moduleName} 模組狀態降級',
      statusUnhealthy: '{moduleName} 模組狀態異常'
    }
  },

  // ====================
  // 生命週期訊息
  // ====================
  lifecycle: {
    // 安裝相關
    install: {
      started: '開始處理安裝事件',
      completed: '安裝事件處理完成',
      failed: '安裝事件處理失敗',

      reasons: {
        install: '全新安裝',
        update: '擴展更新',
        chrome_update: 'Chrome 瀏覽器更新',
        shared_module_update: '共享模組更新'
      },

      newInstall: '處理全新安裝',
      update: '處理擴展更新：{previousVersion} → {currentVersion}',
      chromeUpdate: '處理 Chrome 瀏覽器更新',
      sharedModuleUpdate: '處理共享模組更新',
      unknownReason: '處理未知安裝原因：{reason}'
    },

    // 啟動相關
    startup: {
      started: '開始處理 Service Worker 啟動',
      completed: 'Service Worker 啟動完成',
      failed: 'Service Worker 啟動失敗',
      attempt: '啟動嘗試 #{attempt}',
      duration: '啟動耗時：{duration}ms',

      cleanup: '清理上次啟動狀態',
      moduleSequence: '按順序啟動模組',
      stateRestore: '恢復系統狀態',
      systemReady: '系統準備就緒',

      recovery: '嘗試從啟動失敗中恢復',
      retry: '準備重試啟動 ({attempt}/3)',
      degradedMode: '啟用系統降級模式',
      finalFailure: '系統啟動最終失敗'
    },

    // 關閉相關
    shutdown: {
      started: '開始優雅關閉',
      completed: '優雅關閉完成',
      failed: '優雅關閉失敗',
      forced: '執行強制關閉',
      timeout: '關閉超時',

      reason: '關閉原因：{reason}',
      duration: '關閉耗時：{duration}ms',

      savingState: '保存關鍵狀態',
      stopRequests: '停止接受新請求',
      pendingOps: '等待正在進行的操作完成',
      moduleSequence: '按順序關閉模組',
      cleanup: '清理系統資源'
    }
  },

  // ====================
  // 訊息處理相關
  // ====================
  messaging: {
    // 訊息路由
    router: {
      started: '訊息路由器啟動完成',
      stopped: '訊息路由器停止完成',
      messageReceived: '收到訊息',
      messageProcessed: '訊息已處理',
      messageRouted: '訊息已路由',

      stopAccepting: '停止接受新訊息',
      queueProcessing: '處理佇列中的 {count} 個訊息',
      invalidFormat: '無效的訊息格式或類型：{type}',
      unknownSource: '未知的訊息來源：{source}',
      noHandler: '沒有處理器處理訊息類型：{type}'
    },

    // Content Script 處理
    contentScript: {
      messageReceived: '處理 Content Script 訊息',
      statusUpdate: 'Content Script 狀態更新：Tab {tabId} → {status}',
      scriptReady: 'Content Script 準備就緒：Tab {tabId}',
      scriptError: 'Content Script 錯誤：Tab {tabId}',
      eventForward: '處理 Content Script 事件轉發',
      registered: 'Content Script 已註冊',

      sendMessage: '發送訊息到 Content Script：Tab {tabId}',
      sendSuccess: 'Content Script 回應：Tab {tabId}',
      sendFailed: '發送訊息到 Content Script 失敗：Tab {tabId}',

      offline: 'Content Script 離線：Tab {tabId}',
      shutdown: '通知 Content Script 系統即將關閉'
    },

    // Popup 處理
    popup: {
      messageReceived: '處理 Popup 訊息',
      sessionStarted: '開始 Popup 會話：{sessionId}',
      sessionEnded: '結束 Popup 會話：{sessionId}',
      dataRequest: '處理 Popup 資料請求：{type}',
      operationRequest: '處理 Popup 操作請求：{operation}',

      extractionStart: '開始從 Popup 觸發的提取操作',
      exportRequest: '處理 Popup 匯出請求：{type}',

      invalidTab: '當前標籤頁不是 Readmoo 頁面',
      permissionDenied: '操作權限不足',
      sessionEstablished: 'Popup 會話已建立',
      sessionTerminated: 'Popup 會話已結束'
    }
  },

  // ====================
  // Chrome API 相關
  // ====================
  chromeApi: {
    // 基本操作
    calling: '調用 Chrome API：{apiPath}',
    success: 'Chrome API 調用成功：{apiPath}',
    failed: 'Chrome API 調用失敗：{apiPath}',
    retry: '重試 Chrome API 調用：{apiPath} ({attempt}/{maxRetries})',

    // 可用性檢查
    checking: 'Chrome API 可用性檢查',
    available: 'Chrome API 可用性檢查通過',
    missing: '缺少必要的 Chrome API：{apis}',
    manifestVersion: '非 Manifest V3 環境',

    // 批次處理
    batchStarted: '開始批次處理',
    batchCompleted: '批次處理完成',
    batchFailed: '批次處理失敗：{apiName}',

    // 錯誤類型
    errors: {
      connection_failed: '連接失敗',
      context_invalidated: '擴展上下文失效',
      port_closed: '訊息通道關閉',
      not_found: '目標不存在',
      unknown_error: '未知錯誤'
    }
  },

  // ====================
  // 事件系統相關
  // ====================
  events: {
    // 基本操作
    emitting: '觸發事件：{eventType}',
    emitted: '事件已觸發：{eventType}',
    listening: '監聽事件：{eventType}',
    handled: '事件已處理：{eventType}',

    // 事件統計
    stats: '事件統計',
    totalEvents: '總事件數：{count}',
    totalEmissions: '總觸發次數：{count}',
    avgExecutionTime: '平均執行時間：{time}ms',

    // 錯誤處理
    handlerError: '事件處理器錯誤 ({eventType})',
    emitFailed: '事件觸發失敗 ({eventType})',

    // 系統事件
    systemReady: '系統就緒事件已觸發',
    extractionCompleted: '書籍提取完成事件被觸發',
    extractionData: '提取資料欄位檢查'
  },

  // ====================
  // 頁面監控相關
  // ====================
  pageMonitoring: {
    detected: '檢測到 Readmoo 頁面',
    contentReady: 'Content Script 就緒',
    contentNotReady: 'Content Script 尚未就緒',
    pageReady: '頁面準備訊息已發送',
    navigationChanged: '頁面導航變更'
  },

  // ====================
  // 資料處理相關
  // ====================
  dataProcessing: {
    // 儲存操作
    saving: '保存資料到 Chrome Storage',
    saved: '資料儲存完成',
    loading: '載入資料',
    loaded: '資料載入完成',

    // 資料驗證
    validating: '驗證資料格式',
    valid: '資料格式有效',
    invalid: '資料格式無效',

    // 書籍資料
    booksFound: '找到 {count} 本書籍',
    booksProcessed: '處理了 {count} 本書籍',
    booksSaved: '儲存了 {count} 本書籍到 Chrome Storage',
    booksVerified: '驗證儲存結果：{count} 本書籍',
    noBooksData: '提取完成事件中沒有有效的書籍資料'
  },

  // ====================
  // 錯誤和警告訊息
  // ====================
  errors: {
    // 一般錯誤
    unknown: '未知錯誤',
    timeout: '操作超時',
    cancelled: '操作已取消',
    permission: '權限不足',
    notFound: '目標不存在',

    // 模組錯誤
    moduleNotFound: '模組不存在：{moduleName}',
    moduleNotInitialized: '{moduleName} 模組尚未初始化，無法啟動',
    moduleAlreadyRunning: '{moduleName} 模組已啟動',

    // 系統錯誤
    systemError: '系統錯誤',
    initializationFailed: '初始化失敗',
    startupFailed: '啟動失敗',
    shutdownFailed: '關閉失敗',

    // 訊息錯誤
    messageError: '訊息處理錯誤',
    invalidMessage: '無效訊息格式',
    messageTimeout: '訊息處理超時',

    // API 錯誤
    apiError: 'API 調用錯誤',
    apiNotSupported: '不支援的 API：{apiPath}',
    apiRetryLimit: 'API 調用重試次數已達上限：{apiPath}',

    // 資料錯誤
    dataError: '資料處理錯誤',
    storageError: '儲存操作失敗',
    validationError: '資料驗證失敗'
  },

  // ====================
  // 警告訊息
  // ====================
  warnings: {
    deprecated: '功能已棄用',
    experimental: '實驗性功能',
    performance: '效能警告',
    compatibility: '相容性警告',

    // 具體警告
    eventBusNotReady: 'EventBus 未初始化，無法轉發事件',
    handlerMissing: '缺少處理器',
    configMissing: '缺少配置',
    dataMissing: '缺少必要資料'
  },

  // ====================
  // 成功訊息
  // ====================
  success: {
    // 一般成功
    completed: '操作完成',
    saved: '儲存成功',
    loaded: '載入成功',
    updated: '更新成功',
    deleted: '刪除成功',

    // 系統成功
    systemReady: 'Background Service Worker 運作正常',
    systemHealthy: 'Background Service Worker 健康狀態正常',

    // 具體操作成功
    messageProcessed: '訊息已處理',
    eventForwarded: '事件已轉發',
    extractionStarted: '提取操作已開始',
    exportProcessed: '匯出請求已處理'
  }
}

module.exports = zhTW
