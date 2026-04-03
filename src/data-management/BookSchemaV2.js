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

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

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

// === 欄位驗證 ===

/**
 * 驗證單一欄位值是否符合 schema 定義
 * @param {string} fieldName - 欄位名稱
 * @param {*} value - 欄位值
 * @param {Object} fieldDef - 欄位定義
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateField (fieldName, value, fieldDef) {
  // 必填檢查
  if (fieldDef.required && (value === undefined || value === null || value === '')) {
    return { valid: false, error: `必填欄位 '${fieldName}' 缺失` }
  }

  // 值為 undefined/null 且非必填，允許通過
  if (value === undefined || value === null) {
    return { valid: true, error: null }
  }

  // 型別檢查
  const typeValid = checkType(value, fieldDef.type)
  if (!typeValid) {
    return { valid: false, error: `欄位 '${fieldName}' 型別錯誤：期望 ${fieldDef.type}，實際 ${typeof value}` }
  }

  // enum 檢查
  if (fieldDef.enum && !fieldDef.enum.includes(value)) {
    return { valid: false, error: `欄位 '${fieldName}' 值 '${value}' 不在允許列舉中` }
  }

  // 數值範圍檢查
  if (fieldDef.type === 'number') {
    if (fieldDef.min !== undefined && value < fieldDef.min) {
      return { valid: false, error: `欄位 '${fieldName}' 值 ${value} 小於最小值 ${fieldDef.min}` }
    }
    if (fieldDef.max !== undefined && value > fieldDef.max) {
      return { valid: false, error: `欄位 '${fieldName}' 值 ${value} 大於最大值 ${fieldDef.max}` }
    }
  }

  // 陣列元素型別檢查
  if (fieldDef.type === 'array' && fieldDef.items && Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (!checkType(value[i], fieldDef.items)) {
        return { valid: false, error: `欄位 '${fieldName}[${i}]' 元素型別錯誤：期望 ${fieldDef.items}` }
      }
    }
  }

  return { valid: true, error: null }
}

/**
 * 檢查值的型別
 */
function checkType (value, expectedType) {
  if (expectedType === 'array') {
    return Array.isArray(value)
  }
  return typeof value === expectedType
}

/**
 * 驗證完整的 Book 物件
 * @param {Object} book - 書籍物件
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateBook (book) {
  if (!book || typeof book !== 'object') {
    return { valid: false, errors: ['book 必須是非 null 的物件'] }
  }

  const errors = []
  const fields = BOOK_SCHEMA_V2.fields

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    const result = validateField(fieldName, book[fieldName], fieldDef)
    if (!result.valid) {
      errors.push(result.error)
    }
  }

  return { valid: errors.length === 0, errors }
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
 * @param {Object} v1Book - v1 格式書籍（含 isNew、isFinished、progress）
 * @returns {string} v2 readingStatus 值
 */
function mapV1StatusToV2 (v1Book) {
  const isFinished = v1Book.isFinished
  const isNew = v1Book.isNew
  const progress = v1Book.progress || 0

  // isFinished 優先（含異常組合 isNew=true + isFinished=true）
  if (isFinished === true) {
    return READING_STATUS.FINISHED
  }

  // 有 progress 且非完成
  if (isNew === false && isFinished === false && progress > 0) {
    return READING_STATUS.READING
  }

  // 預設為 unread（含 isNew=true、兩者 undefined/null 等情況）
  return READING_STATUS.UNREAD
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
  mapV1StatusToV2
}

module.exports = BookSchemaV2
