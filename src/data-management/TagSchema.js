/**
 * Tag 資料結構 Schema 定義與驗證
 *
 * PROP-007 tag-based model 的 Tag/TagCategory 驗證模組。
 * 負責 TagCategory 和 Tag 的欄位驗證、唯一性檢查。
 *
 * 設計決策：v1.0 採用扁平 tag 結構（無 parentId），
 * 樹狀 tag 需求延至 v0.20.0。
 */

// === 常數 ===

const TAG_CATEGORY_NAME_MAX_LENGTH = 50
const TAG_CATEGORY_DESCRIPTION_MAX_LENGTH = 200
const TAG_NAME_MAX_LENGTH = 50
const MAX_TAGS_PER_BOOK = 100
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/
const DEFAULT_COLOR = '#808080'

// === TagCategory Schema ===

const TAG_CATEGORY_SCHEMA = Object.freeze({
  fields: {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true, maxLength: TAG_CATEGORY_NAME_MAX_LENGTH },
    description: { type: 'string', required: false, default: '', maxLength: TAG_CATEGORY_DESCRIPTION_MAX_LENGTH },
    color: { type: 'string', required: false, default: DEFAULT_COLOR, pattern: HEX_COLOR_PATTERN },
    isSystem: { type: 'boolean', required: false, default: false },
    sortOrder: { type: 'number', required: false, default: 0 },
    createdAt: { type: 'string', required: true, auto: true },
    updatedAt: { type: 'string', required: true, auto: true }
  }
})

// === Tag Schema ===

const TAG_SCHEMA = Object.freeze({
  fields: {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true, maxLength: TAG_NAME_MAX_LENGTH },
    categoryId: { type: 'string', required: true },
    isSystem: { type: 'boolean', required: false, default: false },
    sortOrder: { type: 'number', required: false, default: 0 },
    createdAt: { type: 'string', required: true, auto: true },
    updatedAt: { type: 'string', required: true, auto: true }
  }
})

// === 驗證函式 ===

/**
 * 驗證 TagCategory 物件
 * @param {Object} category - TagCategory 物件
 * @param {Array} existingCategories - 現有的 categories（用於名稱唯一性檢查）
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTagCategory (category, existingCategories = []) {
  if (!category || typeof category !== 'object') {
    return { valid: false, errors: ['category 必須是非 null 的物件'] }
  }

  const errors = []
  const fields = TAG_CATEGORY_SCHEMA.fields

  // 逐欄位驗證
  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    const value = category[fieldName]

    // 必填檢查（auto 欄位跳過必填檢查，由系統自動填入）
    if (fieldDef.required && !fieldDef.auto && (value === undefined || value === null || value === '')) {
      errors.push(`必填欄位 '${fieldName}' 缺失`)
      continue
    }

    if (value === undefined || value === null) {
      continue
    }

    // 型別檢查
    if (typeof value !== fieldDef.type) {
      errors.push(`欄位 '${fieldName}' 型別錯誤：期望 ${fieldDef.type}，實際 ${typeof value}`)
      continue
    }

    // 字串長度檢查
    if (fieldDef.maxLength && typeof value === 'string' && value.length > fieldDef.maxLength) {
      errors.push(`欄位 '${fieldName}' 超過最大長度 ${fieldDef.maxLength}`)
    }

    // hex 色碼格式檢查
    if (fieldDef.pattern && typeof value === 'string' && !fieldDef.pattern.test(value)) {
      errors.push(`欄位 '${fieldName}' 格式不符：期望 hex 色碼格式`)
    }
  }

  // 名稱唯一性檢查（排除自身）
  if (category.name && existingCategories.length > 0) {
    const isDuplicate = existingCategories.some(
      (existing) => existing.id !== category.id && existing.name === category.name
    )
    if (isDuplicate) {
      errors.push(`category 名稱 '${category.name}' 已存在`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * 驗證 Tag 物件
 * @param {Object} tag - Tag 物件
 * @param {Array} existingTags - 同一 category 內的現有 tags（用於名稱唯一性檢查）
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTag (tag, existingTags = []) {
  if (!tag || typeof tag !== 'object') {
    return { valid: false, errors: ['tag 必須是非 null 的物件'] }
  }

  const errors = []
  const fields = TAG_SCHEMA.fields

  // 逐欄位驗證
  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    const value = tag[fieldName]

    // 必填檢查（auto 欄位跳過必填檢查）
    if (fieldDef.required && !fieldDef.auto && (value === undefined || value === null || value === '')) {
      errors.push(`必填欄位 '${fieldName}' 缺失`)
      continue
    }

    if (value === undefined || value === null) {
      continue
    }

    // 型別檢查
    if (typeof value !== fieldDef.type) {
      errors.push(`欄位 '${fieldName}' 型別錯誤：期望 ${fieldDef.type}，實際 ${typeof value}`)
      continue
    }

    // 字串長度檢查
    if (fieldDef.maxLength && typeof value === 'string' && value.length > fieldDef.maxLength) {
      errors.push(`欄位 '${fieldName}' 超過最大長度 ${fieldDef.maxLength}`)
    }
  }

  // 同一 category 內名稱唯一性檢查（大小寫不敏感，排除自身）
  if (tag.name && existingTags.length > 0) {
    const isDuplicate = existingTags.some(
      (existing) => existing.id !== tag.id &&
        existing.categoryId === tag.categoryId &&
        existing.name.toLowerCase() === tag.name.toLowerCase()
    )
    if (isDuplicate) {
      errors.push(`同一 category 內 tag 名稱 '${tag.name}' 已存在（大小寫不敏感）`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * 驗證 tagIds 陣列（Book 的 tagIds 欄位）
 * @param {Array} tagIds - tag ID 陣列
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTagIds (tagIds) {
  if (!Array.isArray(tagIds)) {
    return { valid: false, errors: ['tagIds 必須是陣列'] }
  }

  const errors = []

  if (tagIds.length > MAX_TAGS_PER_BOOK) {
    errors.push(`tagIds 數量 ${tagIds.length} 超過上限 ${MAX_TAGS_PER_BOOK}`)
  }

  for (let i = 0; i < tagIds.length; i++) {
    if (typeof tagIds[i] !== 'string') {
      errors.push(`tagIds[${i}] 必須是 string 型別`)
    }
  }

  return { valid: errors.length === 0, errors }
}

// === 匯出 ===

const TagSchema = {
  TAG_CATEGORY_SCHEMA,
  TAG_SCHEMA,
  TAG_CATEGORY_NAME_MAX_LENGTH,
  TAG_CATEGORY_DESCRIPTION_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
  MAX_TAGS_PER_BOOK,
  HEX_COLOR_PATTERN,
  DEFAULT_COLOR,
  validateTagCategory,
  validateTag,
  validateTagIds
}

module.exports = TagSchema
