/**
 * 匯出事件定義系統 - TDD循環 #29 Green階段實作
 *
 * 負責功能：
 * - 定義所有匯出相關的事件常數
 * - 提供事件優先級配置
 * - 提供事件建立工廠函數
 * - 提供事件驗證和工具函數
 * - 支援事件資料結構標準化
 *
 * 設計考量：
 * - 遵循 CLAUDE.md 的 MODULE.ACTION.STATE 格式
 * - 使用 URGENT(0-99)/HIGH(100-199)/NORMAL(200-299)/LOW(300-399) 優先級
 * - 與現有 EventBus 系統完全相容
 * - 提供完整的事件生命週期管理
 *
 * 處理流程：
 * 1. 事件常數定義和分類
 * 2. 優先級配置和查詢
 * 3. 事件建立工廠函數
 * 4. 事件驗證和類型檢查
 * 5. 資料結構標準化
 *
 * @version 1.0.0
 * @since 2025-08-08
 */

// ================================
// 匯出事件常數定義
// ================================

/**
 * 匯出事件類型常數
 * 遵循 MODULE.ACTION.STATE 命名格式
 */
const EXPORT_EVENTS = {
  // 基本匯出生命週期事件
  EXPORT_REQUESTED: 'EXPORT.REQUEST.INITIATED',
  EXPORT_STARTED: 'EXPORT.PROCESS.STARTED',
  EXPORT_PROGRESS: 'EXPORT.PROCESS.PROGRESS',
  EXPORT_COMPLETED: 'EXPORT.PROCESS.COMPLETED',
  EXPORT_FAILED: 'EXPORT.PROCESS.FAILED',
  EXPORT_CANCELLED: 'EXPORT.PROCESS.CANCELLED',

  // CSV 格式匯出事件
  CSV_EXPORT_REQUESTED: 'EXPORT.CSV.REQUESTED',
  CSV_EXPORT_COMPLETED: 'EXPORT.CSV.COMPLETED',
  CSV_EXPORT_FAILED: 'EXPORT.CSV.FAILED',

  // JSON 格式匯出事件
  JSON_EXPORT_REQUESTED: 'EXPORT.JSON.REQUESTED',
  JSON_EXPORT_COMPLETED: 'EXPORT.JSON.COMPLETED',
  JSON_EXPORT_FAILED: 'EXPORT.JSON.FAILED',

  // Excel 格式匯出事件
  EXCEL_EXPORT_REQUESTED: 'EXPORT.EXCEL.REQUESTED',
  EXCEL_EXPORT_COMPLETED: 'EXPORT.EXCEL.COMPLETED',
  EXCEL_EXPORT_FAILED: 'EXPORT.EXCEL.FAILED',

  // PDF 格式匯出事件
  PDF_EXPORT_REQUESTED: 'EXPORT.PDF.REQUESTED',
  PDF_EXPORT_COMPLETED: 'EXPORT.PDF.COMPLETED',
  PDF_EXPORT_FAILED: 'EXPORT.PDF.FAILED',

  // 批量匯出事件
  BATCH_EXPORT_REQUESTED: 'EXPORT.BATCH.REQUESTED',
  BATCH_EXPORT_STARTED: 'EXPORT.BATCH.STARTED',
  BATCH_EXPORT_PROGRESS: 'EXPORT.BATCH.PROGRESS',
  BATCH_EXPORT_COMPLETED: 'EXPORT.BATCH.COMPLETED',
  BATCH_EXPORT_FAILED: 'EXPORT.BATCH.FAILED',

  // ZIP 壓縮事件
  ZIP_CREATION_STARTED: 'EXPORT.ZIP.STARTED',
  ZIP_CREATION_PROGRESS: 'EXPORT.ZIP.PROGRESS',
  ZIP_CREATION_COMPLETED: 'EXPORT.ZIP.COMPLETED',
  ZIP_CREATION_FAILED: 'EXPORT.ZIP.FAILED',

  // 檔案操作事件
  FILE_DOWNLOAD_REQUESTED: 'EXPORT.DOWNLOAD.REQUESTED',
  FILE_DOWNLOAD_STARTED: 'EXPORT.DOWNLOAD.STARTED',
  FILE_DOWNLOAD_COMPLETED: 'EXPORT.DOWNLOAD.COMPLETED',
  FILE_DOWNLOAD_FAILED: 'EXPORT.DOWNLOAD.FAILED',

  FILE_SAVE_REQUESTED: 'EXPORT.SAVE.REQUESTED',
  FILE_SAVE_COMPLETED: 'EXPORT.SAVE.COMPLETED',
  FILE_SAVE_FAILED: 'EXPORT.SAVE.FAILED',

  // 剪貼簿操作事件
  CLIPBOARD_COPY_REQUESTED: 'EXPORT.CLIPBOARD.REQUESTED',
  CLIPBOARD_COPY_COMPLETED: 'EXPORT.CLIPBOARD.COMPLETED',
  CLIPBOARD_COPY_FAILED: 'EXPORT.CLIPBOARD.FAILED'
}

// ================================
// 事件優先級定義
// ================================

/**
 * 匯出事件優先級配置
 * 根據 CLAUDE.md 架構規範：URGENT(0-99), HIGH(100-199), NORMAL(200-299), LOW(300-399)
 */
const EXPORT_EVENT_PRIORITIES = {
  // URGENT 優先級：系統關鍵事件
  EXPORT_FAILED: 50,
  EXPORT_CANCELLED: 60,
  CSV_EXPORT_FAILED: 51,
  JSON_EXPORT_FAILED: 52,
  EXCEL_EXPORT_FAILED: 53,
  PDF_EXPORT_FAILED: 54,
  BATCH_EXPORT_FAILED: 55,
  ZIP_CREATION_FAILED: 56,
  FILE_DOWNLOAD_FAILED: 57,
  FILE_SAVE_FAILED: 58,
  CLIPBOARD_COPY_FAILED: 59,

  // HIGH 優先級：使用者互動事件
  EXPORT_REQUESTED: 100,
  CSV_EXPORT_REQUESTED: 101,
  JSON_EXPORT_REQUESTED: 102,
  EXCEL_EXPORT_REQUESTED: 103,
  PDF_EXPORT_REQUESTED: 104,
  BATCH_EXPORT_REQUESTED: 105,
  FILE_DOWNLOAD_REQUESTED: 110,
  FILE_SAVE_REQUESTED: 120,
  CLIPBOARD_COPY_REQUESTED: 130,

  // NORMAL 優先級：一般處理事件
  EXPORT_STARTED: 200,
  EXPORT_PROGRESS: 210,
  EXPORT_COMPLETED: 220,
  CSV_EXPORT_COMPLETED: 221,
  JSON_EXPORT_COMPLETED: 222,
  EXCEL_EXPORT_COMPLETED: 223,
  PDF_EXPORT_COMPLETED: 224,
  BATCH_EXPORT_STARTED: 225,
  BATCH_EXPORT_COMPLETED: 226,
  ZIP_CREATION_STARTED: 227,
  ZIP_CREATION_COMPLETED: 228,
  FILE_DOWNLOAD_STARTED: 229,
  FILE_DOWNLOAD_COMPLETED: 230,
  FILE_SAVE_COMPLETED: 231,
  CLIPBOARD_COPY_COMPLETED: 232,

  // LOW 優先級：背景處理事件
  BATCH_EXPORT_PROGRESS: 310,
  ZIP_CREATION_PROGRESS: 300
}

// 為所有事件類型建立優先級對應（使用事件類型轉換為常數名稱）
Object.values(EXPORT_EVENTS).forEach(eventType => {
  const priorityKey = eventType.replace(/\./g, '_')
  if (!EXPORT_EVENT_PRIORITIES[priorityKey]) {
    // 為沒有明確優先級的事件設定預設優先級（NORMAL）
    EXPORT_EVENT_PRIORITIES[priorityKey] = 250
  }
})

// ================================
// 事件資料結構標準
// ================================

/**
 * 匯出事件資料結構規範
 */
const EXPORT_EVENT_SCHEMAS = {
  // CSV 匯出請求事件資料結構
  CSV_EXPORT_REQUESTED: {
    books: 'array',
    options: 'object'
  },

  // JSON 匯出請求事件資料結構
  JSON_EXPORT_REQUESTED: {
    books: 'array',
    options: 'object'
  },

  // Excel 匯出請求事件資料結構
  EXCEL_EXPORT_REQUESTED: {
    books: 'array',
    options: 'object'
  },

  // 進度事件資料結構
  EXPORT_PROGRESS: {
    current: 'number',
    total: 'number',
    percentage: 'number',
    phase: 'string',
    message: 'string'
  },

  // 批量匯出請求事件資料結構
  BATCH_EXPORT_REQUESTED: {
    formats: 'array',
    books: 'array',
    options: 'object'
  }
}

// ================================
// 事件建立工廠函數
// ================================

/**
 * 建立標準化匯出事件物件
 *
 * @param {string} eventType - 事件類型
 * @param {Object} eventData - 事件資料
 * @param {Object} options - 額外選項
 * @param {string} options.correlationId - 關聯ID
 * @returns {Object} 標準化事件物件
 */
function createExportEvent (eventType, eventData, options = {}) {
  const event = {
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    type: eventType,
    data: eventData || {},
    timestamp: new Date().toISOString(),
    priority: getEventPriority(eventType),
    source: 'export-system',
    correlationId: options.correlationId || null,
    metadata: {
      version: '1.0.0',
      createdBy: 'export-events',
      ...options.metadata
    }
  }

  return event
}

/**
 * 建立 CSV 匯出事件
 *
 * @param {Array} books - 書籍資料陣列
 * @param {Object} options - CSV 匯出選項
 * @returns {Object} CSV 匯出事件
 */
function createCSVExportEvent (books, options = {}) {
  return createExportEvent(EXPORT_EVENTS.CSV_EXPORT_REQUESTED, {
    books,
    options
  })
}

/**
 * 建立 JSON 匯出事件
 *
 * @param {Array} books - 書籍資料陣列
 * @param {Object} options - JSON 匯出選項
 * @returns {Object} JSON 匯出事件
 */
function createJSONExportEvent (books, options = {}) {
  return createExportEvent(EXPORT_EVENTS.JSON_EXPORT_REQUESTED, {
    books,
    options
  })
}

/**
 * 建立 Excel 匯出事件
 *
 * @param {Array} books - 書籍資料陣列
 * @param {Object} options - Excel 匯出選項
 * @returns {Object} Excel 匯出事件
 */
function createExcelExportEvent (books, options = {}) {
  return createExportEvent(EXPORT_EVENTS.EXCEL_EXPORT_REQUESTED, {
    books,
    options
  })
}

/**
 * 建立 PDF 匯出事件
 *
 * @param {Array} books - 書籍資料陣列
 * @param {Object} options - PDF 匯出選項
 * @returns {Object} PDF 匯出事件
 */
function createPDFExportEvent (books, options = {}) {
  return createExportEvent(EXPORT_EVENTS.PDF_EXPORT_REQUESTED, {
    books,
    options
  })
}

/**
 * 建立批量匯出事件
 *
 * @param {Array} formats - 匯出格式陣列
 * @param {Array} books - 書籍資料陣列
 * @param {Object} options - 各格式的匯出選項
 * @returns {Object} 批量匯出事件
 */
function createBatchExportEvent (formats, books, options = {}) {
  return createExportEvent(EXPORT_EVENTS.BATCH_EXPORT_REQUESTED, {
    formats,
    books,
    options
  })
}

/**
 * 建立進度更新事件
 *
 * @param {Object} progressData - 進度資料
 * @param {number} progressData.current - 當前進度
 * @param {number} progressData.total - 總進度
 * @param {string} progressData.phase - 當前階段
 * @param {string} progressData.message - 進度訊息
 * @returns {Object} 進度更新事件
 */
function createProgressEvent (progressData) {
  const data = {
    ...progressData,
    percentage: progressData.total > 0
      ? Math.round((progressData.current / progressData.total) * 100)
      : 0
  }

  return createExportEvent(EXPORT_EVENTS.EXPORT_PROGRESS, data)
}

// ================================
// 事件驗證工具
// ================================

/**
 * 驗證匯出事件物件結構
 *
 * @param {Object} event - 待驗證的事件物件
 * @returns {boolean} 驗證結果
 */
function validateExportEvent (event) {
  if (!event || typeof event !== 'object') {
    return false
  }

  // 檢查必要屬性
  const requiredProperties = ['id', 'type', 'data', 'timestamp', 'priority']
  for (const prop of requiredProperties) {
    if (!Object.prototype.hasOwnProperty.call(event, prop)) {
      return false
    }
  }

  // 檢查事件類型是否為有效的匯出事件
  if (!isExportEvent(event.type)) {
    return false
  }

  return true
}

/**
 * 檢查是否為匯出事件類型
 *
 * @param {string} eventType - 事件類型
 * @returns {boolean} 檢查結果
 */
function isExportEvent (eventType) {
  return Object.values(EXPORT_EVENTS).includes(eventType)
}

/**
 * 獲取事件的優先級
 *
 * @param {string} eventType - 事件類型
 * @returns {number} 事件優先級
 */
function getEventPriority (eventType) {
  const priorityKey = eventType.replace(/\./g, '_')
  return EXPORT_EVENT_PRIORITIES[priorityKey] || 250 // 預設 NORMAL 優先級
}

/**
 * 驗證事件資料結構
 *
 * @param {string} eventType - 事件類型
 * @param {Object} eventData - 事件資料
 * @returns {boolean} 驗證結果
 */
function validateEventData (eventType, eventData) {
  const schemaKey = eventType.replace(/EXPORT\./, '').replace(/\./g, '_')
  const schema = EXPORT_EVENT_SCHEMAS[schemaKey]

  if (!schema) {
    return true // 沒有定義結構規範的事件預設為有效
  }

  if (!eventData || typeof eventData !== 'object') {
    return false
  }

  // 檢查每個欄位的類型
  for (const [field, expectedType] of Object.entries(schema)) {
    const actualValue = eventData[field]

    if (expectedType === 'array' && !Array.isArray(actualValue)) {
      return false
    }

    if (expectedType === 'object' && (typeof actualValue !== 'object' || Array.isArray(actualValue))) {
      return false
    }

    if (expectedType === 'string' && typeof actualValue !== 'string') {
      return false
    }

    if (expectedType === 'number' && typeof actualValue !== 'number') {
      return false
    }
  }

  return true
}

// ================================
// 模組匯出
// ================================

module.exports = {
  // 事件常數
  EXPORT_EVENTS,
  EXPORT_EVENT_PRIORITIES,
  EXPORT_EVENT_SCHEMAS,

  // 事件建立工廠函數
  createExportEvent,
  createCSVExportEvent,
  createJSONExportEvent,
  createExcelExportEvent,
  createPDFExportEvent,
  createBatchExportEvent,
  createProgressEvent,

  // 事件驗證工具
  validateExportEvent,
  isExportEvent,
  getEventPriority,
  validateEventData
}
