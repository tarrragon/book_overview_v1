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

// === 驗證函式（委派至共用驗證引擎） ===

const SchemaValidator = require('./SchemaValidator')

/**
 * 驗證 TagCategory 物件
 * 使用共用驗證引擎處理欄位驗證，額外處理 TagCategory 特有的名稱唯一性檢查
 *
 * @param {Object} category - TagCategory 物件
 * @param {Array} existingCategories - 現有的 categories（用於名稱唯一性檢查）
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTagCategory (category, existingCategories = []) {
  // 共用欄位驗證（auto 欄位跳過必填檢查，由系統自動填入）
  const result = SchemaValidator.validateObject(
    category, TAG_CATEGORY_SCHEMA, 'category', { skipAutoRequired: true }
  )

  if (!category || typeof category !== 'object') {
    return result
  }

  const errors = [...result.errors]

  // TagCategory 特有：名稱唯一性檢查（排除自身）
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
 * 使用共用驗證引擎處理欄位驗證，額外處理 Tag 特有的同 category 名稱唯一性檢查
 *
 * @param {Object} tag - Tag 物件
 * @param {Array} existingTags - 同一 category 內的現有 tags（用於名稱唯一性檢查）
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTag (tag, existingTags = []) {
  // 共用欄位驗證（auto 欄位跳過必填檢查）
  const result = SchemaValidator.validateObject(
    tag, TAG_SCHEMA, 'tag', { skipAutoRequired: true }
  )

  if (!tag || typeof tag !== 'object') {
    return result
  }

  const errors = [...result.errors]

  // Tag 特有：同一 category 內名稱唯一性檢查（大小寫不敏感，排除自身）
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
