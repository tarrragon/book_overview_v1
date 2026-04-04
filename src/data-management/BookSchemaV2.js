/**
 * Book Schema v2 定義與驗證
 *
 * PROP-007 tag-based model 核心模組。
 * 負責 Book 欄位驗證、ReadingStatus 列舉與自動狀態轉換。
 *
 * Schema version: 3.0.0
 * 變更：isNew/isFinished 布林 → readingStatus 列舉（6 種），
 *       新增 tagIds、isManualStatus、updatedAt 欄位。
 */

// === ReadingStatus 列舉 ===

const READING_STATUS = Object.freeze({
  UNREAD: 'unread',
  READING: 'reading',
  FINISHED: 'finished',
  QUEUED: 'queued',
  ABANDONED: 'abandoned',
  REFERENCE: 'reference'
})

const READING_STATUS_VALUES = Object.freeze(Object.values(READING_STATUS))

/**
 * 判斷狀態是否為手動專用狀態（queued/abandoned/reference）
 * 手動專用狀態設定時 isManualStatus 必須為 true
 */
function isManualOnlyStatus (status) {
  return [READING_STATUS.QUEUED, READING_STATUS.ABANDONED, READING_STATUS.REFERENCE].includes(status)
}

/**
 * 判斷狀態是否為自動可追蹤狀態（unread/reading/finished）
 * 設定這些狀態時 isManualStatus 恢復為 false
 */
function isAutoTrackableStatus (status) {
  return [READING_STATUS.UNREAD, READING_STATUS.READING, READING_STATUS.FINISHED].includes(status)
}

// === Schema 定義 ===

const SCHEMA_VERSION = '3.0.0'

const BOOK_SCHEMA_V2 = Object.freeze({
  version: SCHEMA_VERSION,
  platform: 'READMOO',
  fields: {
    // 必填欄位
    id: { type: 'string', required: true },
    title: { type: 'string', required: true },
    readingStatus: { type: 'string', required: true, enum: READING_STATUS_VALUES, default: 'unread' },

    // 選填欄位
    authors: { type: 'array', required: false, default: [] },
    publisher: { type: 'string', required: false, default: '' },
    progress: { type: 'number', required: false, min: 0, max: 100, default: 0 },
    type: { type: 'string', required: false, default: '' },
    cover: { type: 'string', required: false, default: '' },
    tagIds: { type: 'array', required: false, default: [], items: 'string' },
    isManualStatus: { type: 'boolean', required: false, default: false },

    // 自動欄位
    extractedAt: { type: 'string', required: false, auto: true },
    updatedAt: { type: 'string', required: false, auto: true },
    source: { type: 'string', required: false, auto: true, default: 'readmoo' }
  }
})

// === 欄位驗證（委派至共用驗證引擎） ===

const SchemaValidator = require('./SchemaValidator')

/**
 * 驗證單一欄位值是否符合 schema 定義
 * 委派至 SchemaValidator.validateField，維持原有 API 介面
 *
 * @param {string} fieldName - 欄位名稱
 * @param {*} value - 欄位值
 * @param {Object} fieldDef - 欄位定義
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateField (fieldName, value, fieldDef) {
  return SchemaValidator.validateField(fieldName, value, fieldDef)
}

/**
 * 驗證完整的 Book 物件
 * 委派至 SchemaValidator.validateObject，維持原有 API 介面
 *
 * @param {Object} book - 書籍物件
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateBook (book) {
  return SchemaValidator.validateObject(book, BOOK_SCHEMA_V2, 'book')
}

/**
 * 為 Book 物件填入預設值（僅填入缺失的欄位）
 * @param {Object} book - 書籍物件（部分欄位）
 * @returns {Object} 填入預設值後的書籍物件
 */
function applyDefaults (book) {
  if (!book || typeof book !== 'object') {
    return book
  }

  const result = { ...book }
  const fields = BOOK_SCHEMA_V2.fields

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    if (result[fieldName] === undefined && fieldDef.default !== undefined) {
      result[fieldName] = fieldDef.type === 'array' ? [...fieldDef.default] : fieldDef.default
    }
  }

  return result
}

// === 狀態轉換邏輯 ===

/**
 * 根據 progress 變化計算自動狀態轉換
 *
 * 業務規則：
 * - isManualStatus === true 時，不觸發自動轉換
 * - progress 從 0 變為 > 0：unread → reading
 * - progress 達到 100：reading → finished
 *
 * @param {Object} book - 當前書籍狀態
 * @param {number} newProgress - 新的 progress 值
 * @returns {{ readingStatus: string, isManualStatus: boolean } | null} 轉換結果，null 表示不需轉換
 */
function computeAutoStatusTransition (book, newProgress) {
  // 手動狀態不觸發自動轉換
  if (book.isManualStatus) {
    return null
  }

  const currentStatus = book.readingStatus || READING_STATUS.UNREAD
  const currentProgress = book.progress || 0

  // unread → reading：progress 從 0 變為 > 0
  if (currentStatus === READING_STATUS.UNREAD && currentProgress === 0 && newProgress > 0) {
    return { readingStatus: READING_STATUS.READING, isManualStatus: false }
  }

  // reading → finished：progress 達到 100
  if (currentStatus === READING_STATUS.READING && newProgress === 100) {
    return { readingStatus: READING_STATUS.FINISHED, isManualStatus: false }
  }

  return null
}

/**
 * 計算手動狀態設定的結果
 *
 * 業務規則：
 * - 設定 queued/abandoned/reference → isManualStatus = true
 * - 設定 unread/reading/finished → isManualStatus = false（恢復自動追蹤）
 *
 * @param {string} newStatus - 使用者手動設定的新狀態
 * @returns {{ readingStatus: string, isManualStatus: boolean } | null} null 表示狀態值無效
 */
function computeManualStatusChange (newStatus) {
  if (!READING_STATUS_VALUES.includes(newStatus)) {
    return null
  }

  return {
    readingStatus: newStatus,
    isManualStatus: isManualOnlyStatus(newStatus)
  }
}

// === v1 → v2 狀態對映 ===

/**
 * 將 v1 的 isNew/isFinished 布林轉換為 v2 的 readingStatus
 *
 * 轉換規則（優先順序由高到低）：
 * 1. isFinished === true -> 'finished'
 * 2. progress >= 100 -> 'finished'
 * 3. progress > 0 -> 'reading'
 * 4. 其餘 -> 'unread'
 *
 * 注意：此函式同時被 BookSchemaV2 和 v1-to-v2 migration 使用，
 * 修改時須確認兩邊的測試都通過。
 *
 * @param {Object} v1Book - v1 格式書籍（含 isNew、isFinished、progress）
 * @returns {string} v2 readingStatus 值
 */
function mapV1StatusToV2 (v1Book) {
  // isFinished 優先（含異常組合 isNew=true + isFinished=true）
  if (v1Book.isFinished === true) {
    return READING_STATUS.FINISHED
  }

  const progress = normalizeV1Progress(v1Book.progress)

  // progress 達 100 視為完成
  if (progress >= 100) {
    return READING_STATUS.FINISHED
  }

  // 有 progress 代表閱讀中
  if (progress > 0) {
    return READING_STATUS.READING
  }

  // 預設為 unread（含 isNew=true、兩者 undefined/null 等情況）
  return READING_STATUS.UNREAD
}

/**
 * 正規化 v1 progress 值為數字
 * 處理 null/undefined/NaN 等邊界情況
 *
 * @param {*} value - v1 格式的 progress 值
 * @returns {number} 正規化後的 progress
 */
function normalizeV1Progress (value) {
  if (value === null || value === undefined) {
    return 0
  }
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    return isNaN(parsed) ? 0 : parsed
  }
  if (typeof value === 'object' && value !== null && 'progress' in value) {
    return normalizeV1Progress(value.progress)
  }
  return 0
}

// === 匯出 ===

const BookSchemaV2 = {
  READING_STATUS,
  READING_STATUS_VALUES,
  SCHEMA_VERSION,
  BOOK_SCHEMA_V2,
  isManualOnlyStatus,
  isAutoTrackableStatus,
  validateField,
  validateBook,
  applyDefaults,
  computeAutoStatusTransition,
  computeManualStatusChange,
  mapV1StatusToV2,
  normalizeV1Progress
}

module.exports = BookSchemaV2
