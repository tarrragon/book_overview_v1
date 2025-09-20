/**
 * 匯出使用者回饋系統測試 - TDD 循環 #30 Red 階段
 *
 * 負責功能：
 * - 測試匯出開始/完成的使用者通知系統
 * - 驗證檔案下載確認和狀態回饋
 * - 測試錯誤訊息的使用者友好化處理
 * - 驗證匯出歷史和統計資訊展示
 * - 測試通知偏好和設定管理
 *
 * 設計考量：
 * - 基於事件驅動的通知系統架構
 * - 支援多種通知方式（Browser、Chrome Extension、UI）
 * - 確保通知訊息的國際化和可訪問性
 * - 整合使用者偏好和個人化設定
 *
 * 測試策略：
 * - 模擬各種匯出情境的使用者體驗
 * - 驗證通知時機和內容的準確性
 * - 測試不同錯誤類型的友好化處理
 * - 確保歷史記錄和統計的有用性
 *
 * @version 1.0.0
 * @since 2025-08-09
 */

const EventBus = require('src/core/event-bus')
const { EXPORT_EVENTS } = require('src/export/export-events')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

// 模擬 Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  },
  notifications: {
    create: jest.fn(),
    clear: jest.fn(),
    onClicked: {
      addListener: jest.fn()
    },
    onClosed: {
      addListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
}

// 模擬 Browser Notification API
global.Notification = class MockNotification {
  constructor (title, options) {
    this.title = title
    this.options = options
    this.onclick = null
    this.onclose = null
  }

  static requestPermission () {
    return Promise.resolve('granted')
  }

  close () {
    if (this.onclose) this.onclose()
  }
}

global.navigator = {
  serviceWorker: {
    ready: Promise.resolve({
      showNotification: jest.fn()
    })
  }
}

/**
 * 匯出使用者回饋管理器
 * 管理所有匯出相關的使用者通知和回饋
 */
class ExportUserFeedback {
  constructor (eventBus) {
    this.eventBus = eventBus
    this.notifications = new Map()
    this.userPreferences = {
      enableBrowserNotifications: true,
      enableChromeNotifications: true,
      enableSoundAlerts: false,
      notificationPersistence: 5000 // 5 秒
    }
    this.exportHistory = []
    this.initialized = false
  }

  /**
   * 初始化使用者回饋系統
   */
  async initialize () {
    // 測試將驗證初始化流程
    throw (() => { const error = new Error('ExportUserFeedback.initialize() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_USER_FEEDBACK_INIT_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 載入使用者通知偏好
   */
  async loadUserPreferences () {
    // 測試將驗證偏好載入
    throw (() => { const error = new Error('ExportUserFeedback.loadUserPreferences() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_USER_PREFERENCES_LOAD_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 儲存使用者通知偏好
   * @param {Object} preferences - 偏好設定
   */
  async saveUserPreferences (preferences) {
    // 測試將驗證偏好儲存
    throw (() => { const error = new Error('ExportUserFeedback.saveUserPreferences() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_USER_PREFERENCES_SAVE_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 發送匯出開始通知
   * @param {Object} exportInfo - 匯出資訊
   */
  notifyExportStarted (exportInfo) {
    // 測試將驗證開始通知
    throw (() => { const error = new Error('ExportUserFeedback.notifyExportStarted() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_NOTIFICATION_START_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 發送匯出完成通知
   * @param {Object} exportResult - 匯出結果
   */
  notifyExportCompleted (exportResult) {
    // 測試將驗證完成通知
    throw (() => { const error = new Error('ExportUserFeedback.notifyExportCompleted() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_NOTIFICATION_COMPLETE_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 發送匯出錯誤通知
   * @param {Object} errorInfo - 錯誤資訊
   */
  notifyExportError (errorInfo) {
    // 測試將驗證錯誤通知
    throw (() => { const error = new Error('ExportUserFeedback.notifyExportError() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_NOTIFICATION_ERROR_ALERT; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 顯示檔案下載確認
   * @param {Object} downloadInfo - 下載資訊
   */
  showDownloadConfirmation (downloadInfo) {
    // 測試將驗證下載確認
    throw (() => { const error = new Error('ExportUserFeedback.showDownloadConfirmation() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_DOWNLOAD_CONFIRMATION_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 取得匯出歷史記錄
   * @param {Object} filters - 篩選條件
   */
  getExportHistory (filters = {}) {
    // 測試將驗證歷史查詢
    throw (() => { const error = new Error('ExportUserFeedback.getExportHistory() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_HISTORY_QUERY_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 取得匯出統計資訊
   */
  getExportStatistics () {
    // 測試將驗證統計資訊
    throw (() => { const error = new Error('ExportUserFeedback.getExportStatistics() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_STATISTICS_QUERY_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 清理過期通知
   */
  cleanupExpiredNotifications () {
    // 測試將驗證通知清理
    throw (() => { const error = new Error('ExportUserFeedback.cleanupExpiredNotifications() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_NOTIFICATION_CLEANUP_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 將技術錯誤轉為使用者友好訊息
   * @param {Error} error - 技術錯誤
   */
  humanizeError (error) {
    // 測試將驗證錯誤友好化
    throw (() => { const error = new Error('ExportUserFeedback.humanizeError() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_ERROR_HUMANIZATION_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 搜尋匯出歷史記錄
   * @param {Object} searchFilters - 搜尋篩選條件
   */
  searchExportHistory (searchFilters) {
    throw (() => { const error = new Error('ExportUserFeedback.searchExportHistory() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_HISTORY_SEARCH_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 匯出歷史記錄
   * @param {Object} exportOptions - 匯出選項
   */
  exportHistory (exportOptions) {
    throw (() => { const error = new Error('ExportUserFeedback.exportHistory() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_HISTORY_EXPORT_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 取得指定時間範圍的統計資訊
   * @param {string} range - 時間範圍
   */
  getStatisticsForRange (range) {
    throw (() => { const error = new Error('ExportUserFeedback.getStatisticsForRange() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_STATISTICS_RANGE_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 取得效能基準比較
   */
  getBenchmarkComparison () {
    throw (() => { const error = new Error('ExportUserFeedback.getBenchmarkComparison() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_BENCHMARK_COMPARISON_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 新增通知
   * @param {Object} notification - 通知物件
   */
  addNotification (notification) {
    throw (() => { const error = new Error('ExportUserFeedback.addNotification() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_NOTIFICATION_ADD_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 建立通知群組
   * @param {Object} groupedNotifications - 群組化通知
   */
  createNotificationGroup (groupedNotifications) {
    throw (() => { const error = new Error('ExportUserFeedback.createNotificationGroup() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_NOTIFICATION_GROUP_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 驗證偏好設定
   * @param {Object} preferences - 偏好設定
   */
  validatePreferences (preferences) {
    throw (() => { const error = new Error('ExportUserFeedback.validatePreferences() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_PREFERENCES_VALIDATION_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 與預設偏好合併
   * @param {Object} partialPreferences - 部分偏好設定
   */
  mergeWithDefaults (partialPreferences) {
    throw (() => { const error = new Error('ExportUserFeedback.mergeWithDefaults() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_PREFERENCES_MERGE_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 重置偏好設定
   */
  resetPreferences () {
    throw (() => { const error = new Error('ExportUserFeedback.resetPreferences() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_PREFERENCES_RESET_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 設定語言
   * @param {string} language - 語言代碼
   */
  setLanguage (language) {
    throw (() => { const error = new Error('ExportUserFeedback.setLanguage() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_LANGUAGE_SET_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 取得本地化訊息
   * @param {string} messageKey - 訊息鍵值
   */
  getLocalizedMessage (messageKey) {
    throw (() => { const error = new Error('ExportUserFeedback.getLocalizedMessage() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_LOCALIZATION_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 格式化日期時間
   * @param {Date} date - 日期
   * @param {string} timezone - 時區
   */
  formatDateTime (date, timezone) {
    throw (() => { const error = new Error('ExportUserFeedback.formatDateTime() not implemented - Red phase'); error.code = ErrorCodes.EXPORT_DATETIME_FORMAT_ERROR; error.details = { category: 'testing' }; return error })()
  }
}

/**
 * 通知服務類別
 * 管理不同類型的通知發送
 */
class NotificationService {
  constructor (userPreferences) {
    this.preferences = userPreferences
    this.activeNotifications = new Map()
  }

  /**
   * 發送 Browser 通知
   * @param {string} title - 通知標題
   * @param {Object} options - 通知選項
   */
  sendBrowserNotification (title, options) {
    // 測試將驗證 Browser 通知
    throw (() => { const error = new Error('NotificationService.sendBrowserNotification() not implemented - Red phase'); error.code = ErrorCodes.NOTIFICATION_BROWSER_SEND_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 發送 Chrome Extension 通知
   * @param {string} notificationId - 通知ID
   * @param {Object} options - 通知選項
   */
  sendChromeNotification (notificationId, options) {
    // 測試將驗證 Chrome 通知
    throw (() => { const error = new Error('NotificationService.sendChromeNotification() not implemented - Red phase'); error.code = ErrorCodes.NOTIFICATION_CHROME_SEND_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 發送 UI 內嵌通知
   * @param {Object} notificationData - 通知資料
   */
  sendUINotification (notificationData) {
    // 測試將驗證 UI 通知
    throw (() => { const error = new Error('NotificationService.sendUINotification() not implemented - Red phase'); error.code = ErrorCodes.NOTIFICATION_UI_SEND_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 播放音效通知
   * @param {string} soundType - 音效類型
   */
  playSoundAlert (soundType) {
    // 測試將驗證音效通知
    throw (() => { const error = new Error('NotificationService.playSoundAlert() not implemented - Red phase'); error.code = ErrorCodes.NOTIFICATION_SOUND_PLAY_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 清除通知
   * @param {string} notificationId - 通知ID
   */
  clearNotification (notificationId) {
    // 測試將驗證通知清除
    throw (() => { const error = new Error('NotificationService.clearNotification() not implemented - Red phase'); error.code = ErrorCodes.NOTIFICATION_CLEAR_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 批量清除多個通知
   * @param {Array} notificationIds - 通知ID陣列
   */
  clearMultipleNotifications (notificationIds) {
    throw (() => { const error = new Error('NotificationService.clearMultipleNotifications() not implemented - Red phase'); error.code = ErrorCodes.NOTIFICATION_BATCH_CLEAR_ERROR; error.details = { category: 'testing' }; return error })()
  }

  /**
   * 清理過期通知
   */
  cleanupExpiredNotifications () {
    throw (() => { const error = new Error('NotificationService.cleanupExpiredNotifications() not implemented - Red phase'); error.code = ErrorCodes.NOTIFICATION_CLEANUP_EXPIRED_ERROR; error.details = { category: 'testing' }; return error })()
  }
}

describe('ExportUserFeedback', () => {
  let eventBus
  let userFeedback

  beforeEach(() => {
    eventBus = new EventBus()
    userFeedback = new ExportUserFeedback(eventBus)

    // 重置 Chrome API mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    eventBus.destroy()
  })

  describe('初始化', () => {
    test('應該正確初始化使用者回饋系統', async () => {
      await expect(async () => {
        await userFeedback.initialize()
      }).rejects.toThrow(Error)

      // Red 階段：測試將驗證初始化流程
      // - 事件監聽器註冊
      // - 通知權限檢查
      // - 使用者偏好載入
      // - 歷史記錄初始化
      expect(userFeedback.initialized).toBe(false)
    })

    test('應該載入使用者通知偏好', async () => {
      chrome.storage.local.get.mockResolvedValue({
        notificationPreferences: {
          enableBrowserNotifications: false,
          enableSoundAlerts: true
        }
      })

      await expect(async () => {
        await userFeedback.loadUserPreferences()
      }).rejects.toThrow(Error)

      // Red 階段：測試將驗證偏好載入
      // - Chrome Storage 讀取
      // - 預設值合併
      // - 偏好驗證
    })

    test('應該儲存使用者通知偏好', async () => {
      const newPreferences = {
        enableBrowserNotifications: true,
        enableChromeNotifications: false,
        enableSoundAlerts: true,
        notificationPersistence: 3000
      }

      await expect(async () => {
        await userFeedback.saveUserPreferences(newPreferences)
      }).rejects.toThrow(Error)

      // Red 階段：測試將驗證偏好儲存
      // - 偏好驗證
      // - Chrome Storage 寫入
      // - 即時套用
    })
  })

  describe('匯出開始通知', () => {
    test('應該發送匯出開始通知', () => {
      const exportInfo = {
        exportId: 'start-notification-001',
        format: 'csv',
        bookCount: 150,
        estimatedDuration: 45000, // 45 秒
        startTime: new Date()
      }

      expect(() => {
        userFeedback.notifyExportStarted(exportInfo)
      }).toThrow(Error)

      // Red 階段：測試將驗證開始通知
      // - 通知內容格式化
      // - 估計時間顯示
      // - 格式特定訊息
      // - 取消選項提供
    })

    test('應該支援批量匯出開始通知', () => {
      const batchExportInfo = {
        exportId: 'batch-start-001',
        formats: ['csv', 'json', 'excel'],
        bookCount: 200,
        estimatedDuration: 120000, // 2 分鐘
        startTime: new Date()
      }

      // Red 階段：測試將驗證批量開始通知
      // - 多格式顯示
      // - 整體時間估算
      // - 進度追蹤連結
      expect(() => {
        userFeedback.notifyExportStarted(batchExportInfo)
      }).toThrow()
    })

    test('應該處理大量資料匯出警告', () => {
      const largeExportInfo = {
        exportId: 'large-export-001',
        format: 'pdf',
        bookCount: 5000,
        estimatedSize: '50 MB',
        estimatedDuration: 600000, // 10 分鐘
        startTime: new Date()
      }

      // Red 階段：測試將驗證大量匯出警告
      // - 檔案大小警告
      // - 時間消耗提醒
      // - 效能影響說明
      expect(() => {
        userFeedback.notifyExportStarted(largeExportInfo)
      }).toThrow()
    })
  })

  describe('匯出完成通知', () => {
    test('應該發送匯出完成通知', () => {
      const exportResult = {
        exportId: 'complete-notification-001',
        format: 'csv',
        filename: 'readmoo-books-2025-01-09.csv',
        fileSize: '2.3 MB',
        itemCount: 280,
        duration: 38000, // 38 秒
        downloadUrl: 'blob:chrome-extension://...'
      }

      expect(() => {
        userFeedback.notifyExportCompleted(exportResult)
      }).toThrow(Error)

      // Red 階段：測試將驗證完成通知
      // - 成功訊息顯示
      // - 檔案資訊摘要
      // - 下載按鈕/連結
      // - 分享選項
    })

    test('應該包含匯出統計資訊', () => {
      const exportResult = {
        exportId: 'stats-notification-001',
        format: 'json',
        filename: 'readmoo-export.json',
        statistics: {
          totalBooks: 150,
          processedBooks: 148,
          skippedBooks: 2,
          errors: 0,
          warnings: 1,
          processingRate: 3.8 // 每秒書籍數
        },
        duration: 39474
      }

      // Red 階段：測試將驗證統計資訊顯示
      // - 處理成功率
      // - 跳過項目說明
      // - 錯誤警告摘要
      // - 效能指標
      expect(() => {
        userFeedback.notifyExportCompleted(exportResult)
      }).toThrow()
    })

    test('應該提供後續操作選項', () => {
      const exportResult = {
        exportId: 'actions-notification-001',
        format: 'excel',
        filename: 'readmoo-library.xlsx',
        actions: [
          { type: 'open', label: '開啟檔案' },
          { type: 'save-as', label: '另存新檔' },
          { type: 'share', label: '分享' },
          { type: 'export-another', label: '匯出其他格式' }
        ]
      }

      // Red 階段：測試將驗證後續操作
      // - 動作按鈕顯示
      // - 快速重新匯出
      // - 檔案操作整合
      expect(() => {
        userFeedback.notifyExportCompleted(exportResult)
      }).toThrow()
    })
  })

  describe('匯出錯誤通知', () => {
    test('應該發送使用者友好的錯誤通知', () => {
      const errorInfo = {
        exportId: 'error-notification-001',
        error: (() => { const error = new Error('Network request failed'); error.code = ErrorCodes.NETWORK_REQUEST_FAILED; return error })(),
        format: 'pdf',
        context: {
          bookCount: 100,
          processedCount: 45,
          failurePoint: 'PDF generation'
        }
      }

      expect(() => {
        userFeedback.notifyExportError(errorInfo)
      }).toThrow(Error)

      // Red 階段：測試將驗證錯誤通知
      // - 使用者友好錯誤訊息
      // - 錯誤發生位置說明
      // - 建議解決方案
      // - 重試選項
    })

    test('應該將技術錯誤轉為使用者友好訊息', () => {
      const technicalErrors = [
        { error: (() => { const error = new Error('ENOTFOUND example.com'); error.code = ErrorCodes.ENOTFOUND_ERROR; return error })(), expected: '網路連線問題' },
        { error: (() => { const error = new Error('QuotaExceededError'); error.code = ErrorCodes.QUOTA_EXCEEDED_ERROR; return error })(), expected: '儲存空間不足' },
        { error: (() => { const error = new Error('SecurityError'); error.code = ErrorCodes.SECURITY_ERROR; return error })(), expected: '權限不足' },
        { error: (() => { const error = new Error('OutOfMemoryError'); error.code = ErrorCodes.OUT_OF_MEMORY_ERROR; return error })(), expected: '記憶體不足' }
      ]

      technicalErrors.forEach(({ error, expected }) => {
        expect(() => {
          const humanMessage = userFeedback.humanizeError(error)
        }).toThrow(Error)
      })

      // Red 階段：測試將驗證錯誤友好化
      // - 技術錯誤識別
      // - 使用者語言轉換
      // - 解決建議提供
      // - 支援連結包含
    })

    test('應該提供錯誤恢復選項', () => {
      const recoverableError = {
        exportId: 'recoverable-error-001',
        error: (() => { const error = new Error('Temporary network failure'); error.code = ErrorCodes.TEMPORARY_NETWORK_FAILURE; return error })(),
        isRecoverable: true,
        context: {
          format: 'csv',
          progressBeforeError: 75
        },
        recoveryOptions: [
          { type: 'retry', label: '重試' },
          { type: 'resume', label: '繼續' },
          { type: 'partial-download', label: '下載部分結果' }
        ]
      }

      // Red 階段：測試將驗證錯誤恢復
      // - 可恢復錯誤識別
      // - 恢復選項提供
      // - 部分結果保存
      expect(() => {
        userFeedback.notifyExportError(recoverableError)
      }).toThrow()
    })
  })

  describe('檔案下載確認', () => {
    test('應該顯示下載確認對話框', () => {
      const downloadInfo = {
        filename: 'readmoo-books-export.csv',
        fileSize: '3.2 MB',
        format: 'csv',
        itemCount: 420,
        downloadUrl: 'blob:chrome-extension://...',
        securityCheck: {
          isSafe: true,
          scanResults: 'clean'
        }
      }

      expect(() => {
        userFeedback.showDownloadConfirmation(downloadInfo)
      }).toThrow(Error)

      // Red 階段：測試將驗證下載確認
      // - 檔案資訊顯示
      // - 安全性檢查結果
      // - 下載選項
      // - 預覽功能
    })

    test('應該處理大檔案下載警告', () => {
      const largeDownloadInfo = {
        filename: 'comprehensive-library.pdf',
        fileSize: '125 MB',
        format: 'pdf',
        itemCount: 2500,
        downloadWarnings: [
          '檔案較大，下載可能需要較長時間',
          '建議使用穩定的網路連線',
          '確保有足夠的儲存空間'
        ]
      }

      // Red 階段：測試將驗證大檔案警告
      // - 檔案大小警告
      // - 下載建議
      // - 空間檢查提醒
      expect(() => {
        userFeedback.showDownloadConfirmation(largeDownloadInfo)
      }).toThrow()
    })

    test('應該支援下載選項自訂', () => {
      const downloadOptions = {
        filename: 'custom-export.json',
        saveOptions: {
          location: 'downloads',
          overwriteExisting: false,
          openAfterDownload: true
        },
        formatOptions: {
          compression: 'gzip',
          encoding: 'utf-8'
        }
      }

      // Red 階段：測試將驗證下載選項
      // - 儲存位置選擇
      // - 覆寫確認
      // - 格式選項設定
      expect(() => {
        userFeedback.showDownloadConfirmation(downloadOptions)
      }).toThrow()
    })
  })

  describe('匯出歷史記錄', () => {
    test('應該取得完整匯出歷史', () => {
      const filters = {
        dateRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-09')
        },
        formats: ['csv', 'json'],
        status: 'completed'
      }

      expect(() => {
        const history = userFeedback.getExportHistory(filters)
      }).toThrow(Error)

      // Red 階段：測試將驗證歷史查詢
      // - 日期範圍篩選
      // - 格式類型篩選
      // - 狀態篩選
      // - 分頁支援
    })

    test('應該提供歷史記錄搜尋', () => {
      const searchFilters = {
        keyword: '電子書',
        minItemCount: 50,
        maxFileSize: '10 MB',
        sortBy: 'date',
        sortOrder: 'desc'
      }

      // Red 階段：測試將驗證歷史搜尋
      // - 關鍵字搜尋
      // - 數量範圍篩選
      // - 檔案大小篩選
      // - 排序功能
      expect(() => {
        const searchResults = userFeedback.searchExportHistory(searchFilters)
      }).toThrow()
    })

    test('應該支援歷史記錄匯出', () => {
      const exportOptions = {
        format: 'csv',
        includeDetails: true,
        includeStatistics: true,
        dateRange: 'last-30-days'
      }

      // Red 階段：測試將驗證歷史匯出
      // - 歷史記錄格式化
      // - 統計資訊包含
      // - 匯出選項支援
      expect(() => {
        userFeedback.exportHistory(exportOptions)
      }).toThrow()
    })
  })

  describe('統計資訊', () => {
    test('應該提供詳細匯出統計', () => {
      expect(() => {
        const statistics = userFeedback.getExportStatistics()
      }).toThrow(Error)

      // Red 階段：測試將驗證統計資訊
      // - 總匯出次數
      // - 格式分布統計
      // - 成功率分析
      // - 平均處理時間
      // - 檔案大小統計
    })

    test('應該提供時間範圍統計', () => {
      const timeRanges = ['today', 'week', 'month', 'year', 'all-time']

      timeRanges.forEach(range => {
        expect(() => {
          const stats = userFeedback.getStatisticsForRange(range)
        }).toThrow()
      })

      // Red 階段：測試將驗證時間統計
      // - 不同時間範圍支援
      // - 趨勢分析
      // - 比較功能
    })

    test('應該提供效能基準比較', () => {
      const benchmarkData = {
        currentSession: { averageTime: 45.2, successRate: 0.96 },
        historicalAverage: { averageTime: 52.8, successRate: 0.92 },
        comparison: 'improved'
      }

      // Red 階段：測試將驗證效能比較
      // - 當前與歷史比較
      // - 效能趨勢分析
      // - 改善建議
      expect(() => {
        const benchmark = userFeedback.getBenchmarkComparison()
      }).toThrow()
    })
  })

  describe('通知管理', () => {
    test('應該清理過期通知', () => {
      expect(() => {
        userFeedback.cleanupExpiredNotifications()
      }).toThrow(Error)

      // Red 階段：測試將驗證通知清理
      // - 過期時間檢查
      // - 自動清理機制
      // - 記憶體管理
    })

    test('應該管理通知數量限制', () => {
      // 模擬大量通知
      const notifications = Array.from({ length: 20 }, (_, i) => ({
        id: `notification-${i}`,
        timestamp: new Date(),
        type: 'export-complete'
      }))

      // Red 階段：測試將驗證數量限制
      // - 最大通知數限制
      // - 優先級管理
      // - 舊通知自動清理
      expect(() => {
        notifications.forEach(notification => {
          userFeedback.addNotification(notification)
        })
      }).toThrow()
    })

    test('應該支援通知群組化', () => {
      const groupedNotifications = {
        group: 'batch-export-001',
        notifications: [
          { format: 'csv', status: 'completed' },
          { format: 'json', status: 'completed' },
          { format: 'pdf', status: 'failed' }
        ]
      }

      // Red 階段：測試將驗證通知群組
      // - 相關通知群組
      // - 群組狀態摘要
      // - 統合顯示
      expect(() => {
        userFeedback.createNotificationGroup(groupedNotifications)
      }).toThrow()
    })
  })

  describe('偏好設定管理', () => {
    test('應該驗證偏好設定值', () => {
      const invalidPreferences = [
        { enableBrowserNotifications: 'yes' }, // 應為 boolean
        { notificationPersistence: -1000 }, // 應為正數
        { unknownSetting: true } // 未知設定
      ]

      invalidPreferences.forEach(prefs => {
        expect(() => {
          userFeedback.validatePreferences(prefs)
        }).toThrow()
      })

      // Red 階段：測試將驗證偏好驗證
      // - 型別檢查
      // - 範圍驗證
      // - 未知設定處理
    })

    test('應該合併預設偏好', () => {
      const partialPreferences = {
        enableBrowserNotifications: false
      }

      // Red 階段：測試將驗證偏好合併
      // - 部分偏好設定
      // - 預設值保留
      // - 完整偏好輸出
      expect(() => {
        const merged = userFeedback.mergeWithDefaults(partialPreferences)
      }).toThrow()
    })

    test('應該支援偏好重置', () => {
      // Red 階段：測試將驗證偏好重置
      // - 恢復預設設定
      // - 確認對話框
      // - 儲存清理
      expect(() => {
        userFeedback.resetPreferences()
      }).toThrow()
    })
  })

  describe('國際化支援', () => {
    test('應該支援多語言通知', () => {
      const languages = ['zh-TW', 'zh-CN', 'en-US', 'ja-JP']

      languages.forEach(lang => {
        expect(() => {
          userFeedback.setLanguage(lang)
          const message = userFeedback.getLocalizedMessage('export-completed')
        }).toThrow()
      })

      // Red 階段：測試將驗證多語言支援
      // - 語言切換
      // - 訊息本地化
      // - 預設語言處理
    })

    test('應該支援時區和日期格式', () => {
      const timezones = ['Asia/Taipei', 'UTC', 'America/New_York']

      timezones.forEach(tz => {
        expect(() => {
          const formatted = userFeedback.formatDateTime(new Date(), tz)
        }).toThrow()
      })

      // Red 階段：測試將驗證時區支援
      // - 時區轉換
      // - 日期格式本地化
      // - 相對時間顯示
    })
  })
})

describe('NotificationService', () => {
  let notificationService
  let userPreferences

  beforeEach(() => {
    userPreferences = {
      enableBrowserNotifications: true,
      enableChromeNotifications: true,
      enableSoundAlerts: false,
      notificationPersistence: 5000
    }
    notificationService = new NotificationService(userPreferences)

    // 重置 mocks
    jest.clearAllMocks()
  })

  describe('Browser 通知', () => {
    test('應該發送 Browser 通知', () => {
      const title = '匯出完成'
      const options = {
        body: 'CSV 檔案已成功匯出，包含 150 本書籍',
        icon: '/icons/success.png',
        tag: 'export-complete'
      }

      expect(() => {
        notificationService.sendBrowserNotification(title, options)
      }).toThrow(Error)

      // Red 階段：測試將驗證 Browser 通知
      // - 權限檢查
      // - 通知建立
      // - 點擊事件處理
    })

    test('應該處理通知權限拒絕', () => {
      // 模擬權限拒絕
      global.Notification.requestPermission = jest.fn().mockResolvedValue('denied')

      // Red 階段：測試將驗證權限處理
      // - 權限檢查
      // - 降級處理
      // - 使用者提示
      expect(() => {
        notificationService.sendBrowserNotification('Test', {})
      }).toThrow()
    })
  })

  describe('Chrome Extension 通知', () => {
    test('應該發送 Chrome 通知', () => {
      const notificationId = 'export-chrome-001'
      const options = {
        type: 'basic',
        iconUrl: '/icons/icon48.png',
        title: '匯出進度',
        message: '已完成 75% (150/200 本書籍)'
      }

      expect(() => {
        notificationService.sendChromeNotification(notificationId, options)
      }).toThrow(Error)

      // Red 階段：測試將驗證 Chrome 通知
      // - Chrome API 調用
      // - 通知選項驗證
      // - 事件監聽器設定
    })

    test('應該支援豐富通知類型', () => {
      const richNotification = {
        type: 'progress',
        iconUrl: '/icons/export.png',
        title: '批量匯出進度',
        message: '正在處理多種格式...',
        progress: 65,
        buttons: [
          { title: '查看詳情' },
          { title: '取消' }
        ]
      }

      // Red 階段：測試將驗證豐富通知
      // - 進度通知類型
      // - 按鈕互動
      // - 通知更新
      expect(() => {
        notificationService.sendChromeNotification('rich-001', richNotification)
      }).toThrow()
    })
  })

  describe('UI 內嵌通知', () => {
    test('應該發送 UI 通知', () => {
      const notificationData = {
        type: 'success',
        title: '匯出成功',
        message: 'JSON 檔案已準備下載',
        duration: 3000,
        action: {
          label: '立即下載',
          callback: jest.fn()
        }
      }

      expect(() => {
        notificationService.sendUINotification(notificationData)
      }).toThrow(Error)

      // Red 階段：測試將驗證 UI 通知
      // - UI 元素建立
      // - 自動消失機制
      // - 動作按鈓處理
    })

    test('應該支援不同通知樣式', () => {
      const notificationTypes = [
        { type: 'info', expectedClass: 'notification-info' },
        { type: 'success', expectedClass: 'notification-success' },
        { type: 'warning', expectedClass: 'notification-warning' },
        { type: 'error', expectedClass: 'notification-error' }
      ]

      notificationTypes.forEach(({ type, expectedClass }) => {
        expect(() => {
          notificationService.sendUINotification({ type, message: 'Test' })
        }).toThrow()
      })

      // Red 階段：測試將驗證通知樣式
      // - CSS 類別設定
      // - 圖示選擇
      // - 顏色主題
    })
  })

  describe('音效通知', () => {
    test('應該播放音效通知', () => {
      const soundTypes = ['success', 'error', 'warning', 'info']

      soundTypes.forEach(soundType => {
        expect(() => {
          notificationService.playSoundAlert(soundType)
        }).toThrow(Error)
      })

      // Red 階段：測試將驗證音效通知
      // - 音效檔案載入
      // - 音量控制
      // - 偏好設定檢查
    })

    test('應該支援自訂音效', () => {
      const customSound = {
        type: 'custom',
        audioUrl: '/sounds/custom-notification.mp3',
        volume: 0.7
      }

      // Red 階段：測試將驗證自訂音效
      // - 自訂音效檔案
      // - 音量設定
      // - 播放失敗處理
      expect(() => {
        notificationService.playSoundAlert(customSound)
      }).toThrow()
    })
  })

  describe('通知清理', () => {
    test('應該清除指定通知', () => {
      const notificationId = 'clear-test-001'

      expect(() => {
        notificationService.clearNotification(notificationId)
      }).toThrow(Error)

      // Red 階段：測試將驗證通知清除
      // - Chrome 通知清除
      // - UI 通知移除
      // - 記錄清理
    })

    test('應該批量清除通知', () => {
      const notificationIds = ['batch-clear-001', 'batch-clear-002', 'batch-clear-003']

      // Red 階段：測試將驗證批量清除
      // - 批量操作
      // - 錯誤處理
      // - 部分失敗處理
      expect(() => {
        notificationService.clearMultipleNotifications(notificationIds)
      }).toThrow()
    })

    test('應該自動清除過期通知', () => {
      // Red 階段：測試將驗證自動清除
      // - 過期檢查機制
      // - 定時清理
      // - 記憶體管理
      expect(() => {
        notificationService.cleanupExpiredNotifications()
      }).toThrow()
    })
  })
})
