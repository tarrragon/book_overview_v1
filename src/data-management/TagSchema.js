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

const { COLORS } = require('../core/design-system/colors.js')

const TAG_CATEGORY_NAME_MAX_LENGTH = 50
const TAG_CATEGORY_DESCRIPTION_MAX_LENGTH = 200
const TAG_NAME_MAX_LENGTH = 50
const MAX_TAGS_PER_BOOK = 100
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/
const DEFAULT_COLOR = COLORS.tagDefault

// === 樹狀 model 常數（v0.20.0 PROP-007 樹狀化） ===

/**
 * TagCategory 樹的最大深度（根 = depth 0，故最深 4 層含根）。
 * 插入或移動節點時，插入後深度 > 此值即拒（max_depth_exceeded）。
 */
const TAG_TREE_MAX_DEPTH = 4

/**
 * 無 parentId 的根節點 scoped 鍵 sentinel。
 * 用於 makeCategoryKey 將 null parentId 正規化為可序列化字串，
 * 使「同一父層」的唯一性比對在根層與子層採同一機制。
 */
const ROOT_PARENT_SENTINEL = 'ROOT'

/**
 * 系統預裝 category 的確定性 ID 前綴（賴永祥分類法等預裝節點）。
 *
 * 預裝節點走 initializePresets 的確定性 ID upsert（繞過隨機 ID），其 ID 形如 `sys_cat_*`，
 * 且可能在使用者操作時尚未被 eager 載入入當前集合。引用存在性檢查對此前綴的 parentId
 * 視為合法預裝引用，避免「子類引用尚未載入的預裝父節點」被誤判 invalid_parent_reference。
 */
const SYSTEM_CATEGORY_ID_PREFIX = 'sys_cat_'

/**
 * 驗證錯誤碼（與 SPEC-010 §4 錯誤處理表對齊；adapter 取 codes[0] 轉回傳）。
 * 字面須與測試硬斷言一致，禁止內聯字串重寫。
 */
const TAG_CATEGORY_ERROR_CODES = Object.freeze({
  DUPLICATE_NAME: 'duplicate_name',
  INVALID_PARENT_REFERENCE: 'invalid_parent_reference',
  CIRCULAR_REFERENCE: 'circular_reference',
  MAX_DEPTH_EXCEEDED: 'max_depth_exceeded'
})

// === TagCategory Schema ===

const TAG_CATEGORY_SCHEMA = Object.freeze({
  fields: {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true, maxLength: TAG_CATEGORY_NAME_MAX_LENGTH },
    parentId: { type: 'string', required: false, default: null, nullable: true },
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
 * 生成 TagCategory 的 scoped 唯一鍵（同一父層下唯一）。
 *
 * 沿用 makeTagKey 的 JSON.stringify 元組序列化（非 spec 草案的 `::` 字串拼接），
 * 理由：與既有鍵生成 pattern 一致（ARCH-020 共用抽象核心是同序列化策略），
 * 且避免 name 含分隔字元時的鍵碰撞。null parentId 正規化為 ROOT sentinel，
 * 使根層與子層採同一唯一性比對機制。name 以 trim + toLowerCase 正規化（大小寫不敏感）。
 *
 * @param {string|null} parentId - 父 category id（根節點為 null）
 * @param {string} name - category 名稱
 * @returns {string} scoped 唯一鍵
 */
function makeCategoryKey (parentId, name) {
  const normalizedParent = (parentId === null || parentId === undefined)
    ? ROOT_PARENT_SENTINEL
    : parentId
  const normalizedName = String(name == null ? '' : name).trim().toLowerCase()
  return JSON.stringify([normalizedParent, normalizedName])
}

/**
 * 計算 parentId 起算的祖先鏈深度（根 parentId=null → depth 0）。
 *
 * @param {string|null} parentId - 起算的父 id
 * @param {Array} allCategories - 全量 category 集合（供沿 parentId 上溯）
 * @returns {number} 祖先鏈長度（即「插入於此 parentId 下的節點」之深度）
 */
function depthOfParent (parentId, allCategories) {
  let depth = 0
  let cursor = parentId
  const byId = new Map(allCategories.map((c) => [c.id, c]))
  // 防禦：上溯遇環時以 allCategories 長度為上限，避免無限迴圈
  const guardLimit = allCategories.length + 1
  while (cursor !== null && cursor !== undefined && depth <= guardLimit) {
    const node = byId.get(cursor)
    if (!node) break
    depth += 1
    cursor = node.parentId == null ? null : node.parentId
  }
  return depth
}

/**
 * 驗證 TagCategory 物件（含樹狀防護）。
 *
 * 雙模式：
 * - 兩參數（category, siblingCategories）：unit 級檢查——欄位驗證 + parentId 型別
 *   + 兄弟集合 scoped 唯一鍵（siblingCategories 語意為「同 parentId 兄弟集合」）。
 * - 三參數（category, siblingCategories, allCategories）：追加樹完整性——引用存在性
 *   （invalid_parent_reference）、循環引用（circular_reference）、深度超限（max_depth_exceeded）。
 *
 * 回傳 errors 為人類可讀字串（向後相容既有 `.includes` 斷言）；codes 為對應錯誤碼陣列
 * （adapter 取 codes[0] 轉 OperationResult error 欄位）。
 *
 * @param {Object} category - TagCategory 物件
 * @param {Array} siblingCategories - 同 parentId 兄弟集合（scoped 唯一性檢查）
 * @param {Array} [allCategories] - 全量集合（提供時啟用樹完整性檢查）
 * @returns {{ valid: boolean, errors: string[], codes: string[] }}
 */
function validateTagCategory (category, siblingCategories = [], allCategories) {
  // 共用欄位驗證（含 parentId 型別；auto 欄位跳過必填檢查，由系統自動填入）
  const result = SchemaValidator.validateObject(
    category, TAG_CATEGORY_SCHEMA, 'category', { skipAutoRequired: true }
  )

  if (!category || typeof category !== 'object') {
    return { valid: result.valid, errors: result.errors, codes: [] }
  }

  const errors = [...result.errors]
  const codes = []

  // 樹完整性檢查（僅三參數模式啟用，需全量集合上溯）
  if (Array.isArray(allCategories) && category.parentId != null) {
    const byId = new Map(allCategories.map((c) => [c.id, c]))
    const isSystemPresetRef =
      typeof category.parentId === 'string' &&
      category.parentId.startsWith(SYSTEM_CATEGORY_ID_PREFIX)

    // 引用存在性（系統預裝前綴視為合法預裝引用，可能尚未 eager 載入）
    if (!byId.has(category.parentId) && !isSystemPresetRef) {
      errors.push(`parentId '${category.parentId}' 引用的 category 不存在`)
      codes.push(TAG_CATEGORY_ERROR_CODES.INVALID_PARENT_REFERENCE)
    } else if (byId.has(category.parentId)) {
      // 循環引用：沿 parent 鏈上溯，遇自身即環
      let ancestorId = category.parentId
      const guardLimit = allCategories.length + 1
      let steps = 0
      while (ancestorId != null && steps <= guardLimit) {
        if (ancestorId === category.id) {
          errors.push('parentId 形成循環引用')
          codes.push(TAG_CATEGORY_ERROR_CODES.CIRCULAR_REFERENCE)
          break
        }
        const node = byId.get(ancestorId)
        if (!node) break
        ancestorId = node.parentId == null ? null : node.parentId
        steps += 1
      }

      // 深度超限（插入後深度 = 父深度 + 1）
      if (depthOfParent(category.parentId, allCategories) + 1 > TAG_TREE_MAX_DEPTH) {
        errors.push(`插入後深度超過上限 ${TAG_TREE_MAX_DEPTH}`)
        codes.push(TAG_CATEGORY_ERROR_CODES.MAX_DEPTH_EXCEEDED)
      }
    }
  }

  // scoped 兄弟唯一鍵（排除自身；siblingCategories 為同 parentId 兄弟集合）
  if (category.name && siblingCategories.length > 0) {
    const candidateKey = makeCategoryKey(category.parentId, category.name)
    const isDuplicate = siblingCategories.some(
      (existing) => existing.id !== category.id &&
        makeCategoryKey(existing.parentId, existing.name) === candidateKey
    )
    if (isDuplicate) {
      errors.push(`category 名稱 '${category.name}' 已存在`)
      codes.push(TAG_CATEGORY_ERROR_CODES.DUPLICATE_NAME)
    }
  }

  return { valid: errors.length === 0, errors, codes }
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
  TAG_TREE_MAX_DEPTH,
  ROOT_PARENT_SENTINEL,
  SYSTEM_CATEGORY_ID_PREFIX,
  TAG_CATEGORY_ERROR_CODES,
  makeCategoryKey,
  depthOfParent,
  validateTagCategory,
  validateTag,
  validateTagIds
}

module.exports = TagSchema
