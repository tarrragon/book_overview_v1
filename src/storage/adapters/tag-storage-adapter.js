/**
 * TagStorageAdapter - Chrome Storage Tag-based 操作適配器
 *
 * 負責 tag_categories、tags、book-tag 關聯的 CRUD 操作，
 * 以及配額管理和原子操作一致性保證。
 *
 * Storage Key 結構：
 * - readmoo_books: 書籍陣列（v2 欄位含 tagIds）
 * - tag_categories: 類別陣列
 * - tags: 標籤陣列
 * - schema_version: BookSchemaV2.SCHEMA_VERSION
 *
 * 規格來源：docs/spec/data-management/data-management.md
 *
 * @version 1.0.0
 */

const { SCHEMA_VERSION: BOOK_SCHEMA_VERSION } = require('../../data-management/BookSchemaV2')

const { COLORS } = require('../../core/design-system/colors.js')

const TagSchema = require('../../data-management/TagSchema')

const {
  UNCATEGORIZED_CATEGORY_ID,
  UNCATEGORIZED_CATEGORY_NAME,
  CHINESE_CLASSIFICATION_PRESETS
} = require('../../data-management/presets/chinese-classification')

const { Logger } = require('../../core/logging/Logger')
// 顯式指向 messages/index 避免與同層 messages.js（legacy 基礎字典）衝突解析
const { MessageDictionary } = require('../../core/messages/index')

// 本地訊息字典（W4-024.2 G1 console A/C 分流 C 類處理）
// Why: 業務日誌統一走 Logger 系統；保留原 [tag-storage-adapter] prefix 透過 Logger name 欄位呈現
// Consequence: 訊息文字若需調整，僅修改本字典；無需散佈 grep
// Action: 新增訊息時加入 TAG_STORAGE_* key（前綴對齊 module 命名規範，project-conventions §Messages 系統）
const tagStorageAdapterMessages = new MessageDictionary({
  LOCK_OPERATION_FAILED: 'Lock operation failed: {error}',
  ROLLBACK_TRIGGERED: '{operation} failed, rolling back: {error}',
  REPLACE_BLOCKED_QUOTA: 'replaceAllData blocked: quota exceeded',
  REPLACE_FAILED_AFTER_ROLLBACK: 'replaceAllData failed after rollback',
  MERGE_TAG_CATEGORY_MISSING: "merge: tag '{tagId}' categoryId 無對應，歸入「未分類」",
  MERGE_BOOK_MISSING_ID: 'merge: book 缺 id 跳過',
  MERGE_TAGID_UNMAPPABLE: "merge: 匯入 tagId 無法重映射，過濾 '{tagId}'",
  MERGE_TAGIDS_TRUNCATED: "merge: book '{bookId}' tagIds 聯集超 {limit} 截斷",
  MERGE_BLOCKED_QUOTA: 'mergeAllData blocked: quota exceeded',
  MERGE_FAILED_AFTER_ROLLBACK: 'mergeAllData failed after rollback',
  CASCADE_DELETE_FAILED: 'deleteTagCategory cascade failed, rolled back: {error}',
  PRESET_INIT_BLOCKED_QUOTA: 'initializePresets blocked: quota exceeded',
  PRESET_INIT_FAILED: 'initializePresets failed: {error}'
})

const logger = new Logger('[tag-storage-adapter]', 'INFO', tagStorageAdapterMessages)

const STORAGE_KEYS = {
  READMOO_BOOKS: 'readmoo_books',
  TAG_CATEGORIES: 'tag_categories',
  // CATEGORIES 為 TAG_CATEGORIES 的別名（樹狀 model 測試/契約以 CATEGORIES 指稱同一 key）
  CATEGORIES: 'tag_categories',
  TAGS: 'tags',
  SCHEMA_VERSION: 'schema_version'
}

/** Chrome Storage local 配額上限 (5MB) */
const MAX_STORAGE_SIZE = 5242880

/** 配額閾值常數 */
const QUOTA_THRESHOLDS = {
  WARNING: 0.8,
  AUTO_CLEANUP: 0.9,
  BLOCK: 0.95
}

/** 預設類別顏色（引用 design-system 統一定義） */
const DEFAULT_CATEGORY_COLOR = COLORS.tagDefault

/**
 * 樹狀刪除 / 預裝載入錯誤碼（集中管理，字面須與 SPEC-010 §3-4 + 測試硬斷言一致）。
 *
 * 設計：與 TagSchema.TAG_CATEGORY_ERROR_CODES（驗證類錯誤）分離——本組為
 * adapter 層操作類錯誤（刪除分層 / cascade / 預裝），不屬 schema 驗證範疇。
 */
const TAG_CATEGORY_OPERATION_ERROR_CODES = Object.freeze({
  NOT_FOUND: 'not_found',
  HAS_CHILDREN: 'has_children',
  SYSTEM_PROTECTED: 'system_protected',
  CASCADE_PARTIAL: 'cascade_partial',
  PRESET_INIT_FAILED: 'preset_init_failed'
})

/** 刪非葉 category 時的引導提示（場景 C1，引導使用者先處理子類） */
const HAS_CHILDREN_HINT = '請先處理子類（移除或一併刪除子樹）後再刪除此分類'

/**
 * 配額狀態覆寫旗標 storage key（測試注入用）。
 *
 * 正式路徑配額由 checkQuotaLevel（getBytesInUse 比率門檻）判定。樹狀 model
 * 測試 fixture 以 store 內此 key 直接注入 'blocked'，使預裝載入可在不 mock
 * getBytesInUse 的前提下驗證 D-quota 拒寫行為。正式 runtime 不寫此 key，
 * loadFromStorage 回 null，不影響正常流程。
 */
const QUOTA_OVERRIDE_KEY = '__quota'

// --- 內部 Storage 存取輔助 ---

/**
 * 從 Chrome Storage 讀取指定 key
 * @param {string} key - storage key
 * @returns {Promise<any>}
 */
/**
 * 偵測 chrome.runtime.lastError，於可用時回傳其 message，否則 null。
 * 樹狀 model 測試 mock 可能不提供 chrome.runtime，故以可選鏈防護避免 TypeError。
 */
function readLastError () {
  return (chrome && chrome.runtime && chrome.runtime.lastError)
    ? chrome.runtime.lastError.message
    : null
}

/**
 * 從 Chrome Storage 讀取單一 key。
 *
 * 雙模式相容：Chrome MV3 的 storage.local.get 同時支援 callback 與 Promise 形式；
 * 既有測試 mock 採 callback 形式，樹狀 model 測試 fixture 採 Promise 形式。
 * 本函式同時掛 callback 並消化回傳 thenable，使兩種 mock 皆能 resolve。
 *
 * @param {string} key
 * @returns {Promise<*>}
 */
function loadFromStorage (key) {
  return new Promise((resolve, reject) => {
    let settled = false
    const settleResolve = (value) => { if (!settled) { settled = true; resolve(value) } }
    const settleReject = (err) => { if (!settled) { settled = true; reject(err) } }

    const maybePromise = chrome.storage.local.get([key], (result) => {
      const lastError = readLastError()
      if (lastError) settleReject(new Error(lastError))
      else settleResolve((result && result[key]) || null)
    })

    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then(
        (result) => settleResolve((result && result[key]) || null),
        (err) => settleReject(err)
      )
    }
  })
}

/**
 * 將資料寫入 Chrome Storage
 * @param {Object} items - key-value 對
 * @returns {Promise<void>}
 */
function saveToStorage (items) {
  return new Promise((resolve, reject) => {
    let settled = false
    const settleResolve = () => { if (!settled) { settled = true; resolve() } }
    const settleReject = (err) => { if (!settled) { settled = true; reject(err) } }

    const maybePromise = chrome.storage.local.set(items, () => {
      const lastError = readLastError()
      if (lastError) settleReject(new Error(lastError))
      else settleResolve()
    })

    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then(() => settleResolve(), (err) => settleReject(err))
    }
  })
}

/**
 * 取得 storage 使用量
 * @returns {Promise<number>} bytes in use
 */
function getBytesInUse () {
  return new Promise((resolve, reject) => {
    // 部分測試 mock 不提供 getBytesInUse；缺失時視為 0 bytes（配額充足）
    if (!chrome.storage.local.getBytesInUse) {
      resolve(0)
      return
    }

    let settled = false
    const settleResolve = (value) => { if (!settled) { settled = true; resolve(value) } }
    const settleReject = (err) => { if (!settled) { settled = true; reject(err) } }

    const maybePromise = chrome.storage.local.getBytesInUse(null, (bytes) => {
      const lastError = readLastError()
      if (lastError) settleReject(new Error(lastError))
      else settleResolve(bytes)
    })

    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then((bytes) => settleResolve(bytes), (err) => settleReject(err))
    }
  })
}

// --- 配額檢查 ---

/**
 * 檢查配額狀態，回傳 { level, usageRatio }
 * level: 'normal' | 'warning' | 'auto_cleanup' | 'blocked'
 */
async function checkQuotaLevel () {
  const bytesUsed = await getBytesInUse()
  const usageRatio = bytesUsed / MAX_STORAGE_SIZE

  if (usageRatio >= QUOTA_THRESHOLDS.BLOCK) {
    return { level: 'blocked', usageRatio }
  }
  if (usageRatio >= QUOTA_THRESHOLDS.AUTO_CLEANUP) {
    return { level: 'auto_cleanup', usageRatio }
  }
  if (usageRatio >= QUOTA_THRESHOLDS.WARNING) {
    return { level: 'warning', usageRatio }
  }
  return { level: 'normal', usageRatio }
}

// --- 內部資料讀取輔助 ---

async function loadCategories () {
  return (await loadFromStorage(STORAGE_KEYS.TAG_CATEGORIES)) || []
}

/**
 * 從 validateTagCategory 回傳的 codes 取單一錯誤碼供 OperationResult error 欄位。
 *
 * 優先序：結構性錯誤（引用/循環/深度）先於命名衝突，使「parentId 不存在」等更根本的
 * 問題優先回報。codes 為空時 fallback 'validation_failed'。
 *
 * @param {{ codes: string[] }} validation
 * @returns {string}
 */
function pickCategoryErrorCode (validation) {
  const codes = (validation && validation.codes) || []
  const PRIORITY = [
    TagSchema.TAG_CATEGORY_ERROR_CODES.INVALID_PARENT_REFERENCE,
    TagSchema.TAG_CATEGORY_ERROR_CODES.CIRCULAR_REFERENCE,
    TagSchema.TAG_CATEGORY_ERROR_CODES.MAX_DEPTH_EXCEEDED,
    TagSchema.TAG_CATEGORY_ERROR_CODES.DUPLICATE_NAME
  ]
  for (const code of PRIORITY) {
    if (codes.includes(code)) return code
  }
  return codes[0] || 'validation_failed'
}

async function loadTags () {
  return (await loadFromStorage(STORAGE_KEYS.TAGS)) || []
}

async function loadBooks () {
  const raw = await loadFromStorage(STORAGE_KEYS.READMOO_BOOKS)
  if (!raw) return []
  // readmoo_books 可能是 { books: [...] } 或直接陣列
  if (Array.isArray(raw)) return raw
  if (raw.books && Array.isArray(raw.books)) return raw.books
  return []
}

async function saveBooksWrapper (books) {
  // 保持原始結構格式
  const raw = await loadFromStorage(STORAGE_KEYS.READMOO_BOOKS)
  if (raw && !Array.isArray(raw) && raw.books) {
    await saveToStorage({ [STORAGE_KEYS.READMOO_BOOKS]: { ...raw, books } })
  } else {
    await saveToStorage({ [STORAGE_KEYS.READMOO_BOOKS]: books })
  }
}

// --- 互斥鎖（簡易 Promise-based） ---

const operationLock = {
  _queue: Promise.resolve(),
  /**
   * 以序列方式執行 fn，避免並發寫入衝突
   * @param {Function} fn - async 函式
   * @returns {Promise<any>}
   */
  run (fn) {
    const next = this._queue.then(fn, fn)
    this._queue = next.catch((err) => {
      logger.error('LOCK_OPERATION_FAILED', { error: err && err.message ? err.message : String(err) })
    })
    return next
  }
}

/**
 * snapshot key 名稱到 STORAGE_KEYS 的對映
 * 用於 withAtomicRollback 泛用回滾迴圈
 * 注意：'books' 使用 saveBooksWrapper 特殊處理（需保持原始結構格式）
 */
const SNAPSHOT_KEY_TO_STORAGE_KEY = {
  categories: STORAGE_KEYS.TAG_CATEGORIES,
  tags: STORAGE_KEYS.TAGS
}

// --- 原子回滾輔助 ---

/**
 * 以原子回滾模式執行操作：先建立快照，失敗時自動還原
 * 需求：deleteTagCategory 和 deleteTag 的 cascade 刪除需要一致性保證
 *
 * @param {Object} snapshotKeys - 需要快照的 storage key 及其當前值
 *   格式: { tags: [...], books: [...], categories?: [...] }
 * @param {Function} operation - async 操作函式
 * @param {string} operationName - 操作名稱（用於錯誤日誌）
 * @returns {Promise<Object>} operation 的回傳值，或回滾結果
 */
async function withAtomicRollback (snapshotKeys, operation, operationName) {
  const snapshot = {}
  for (const [key, value] of Object.entries(snapshotKeys)) {
    snapshot[key] = JSON.parse(JSON.stringify(value))
  }

  try {
    return await operation()
  } catch (err) {
    logger.error('ROLLBACK_TRIGGERED', { operation: operationName, error: err.message })
    for (const [key, value] of Object.entries(snapshot)) {
      if (key === 'books') {
        await saveBooksWrapper(value)
      } else {
        const storageKey = SNAPSHOT_KEY_TO_STORAGE_KEY[key]
        if (storageKey) {
          await saveToStorage({ [storageKey]: value })
        }
      }
    }
    return { success: false, error: 'rollback', cause: err.message }
  }
}

// ==========================================
// Tag Categories CRUD
// ==========================================

/**
 * 建立 tag category
 * 業務規則：name 必填且唯一，description 和 color 為選填
 *
 * @param {Object} input - { name, description?, color? }
 * @returns {Promise<Object>} 建立的 category 物件或 { success: false, error }
 */
async function createTagCategory (input) {
  return operationLock.run(async () => {
    if (!input || !input.name || input.name.trim() === '') {
      return { success: false, error: 'name is required' }
    }

    const quota = await checkQuotaLevel()
    if (quota.level === 'blocked') {
      return { success: false, error: 'quota_exceeded' }
    }

    const categories = await loadCategories()
    const parentId = input.parentId === undefined ? null : input.parentId
    const newId = `cat_${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // 樹防護 + scoped 兄弟唯一鍵驗證（候選含實際 id 與 parentId；
    // siblings 為同 parentId 兄弟集合）。先生成 id 再驗證，避免 id 必填誤判。
    const candidate = {
      id: newId,
      name: input.name.trim(),
      parentId
    }
    const siblings = categories.filter(c => (c.parentId == null ? null : c.parentId) === parentId)
    const validation = TagSchema.validateTagCategory(candidate, siblings, categories)
    if (!validation.valid) {
      return { success: false, error: pickCategoryErrorCode(validation) }
    }

    const now = new Date().toISOString()
    const category = {
      id: newId,
      name: input.name.trim(),
      parentId,
      description: input.description || '',
      color: input.color || DEFAULT_CATEGORY_COLOR,
      isSystem: false,
      sortOrder: categories.length,
      createdAt: now,
      updatedAt: now
    }

    categories.push(category)
    await saveToStorage({ [STORAGE_KEYS.TAG_CATEGORIES]: categories })

    // success:true 與 category 欄位並陳：既有測試讀 result.id/name（向後相容），
    // 樹狀 model 測試讀 result.success（A1/A3-1 契約）。
    const result = { success: true, ...category }
    if (quota.level === 'warning' || quota.level === 'auto_cleanup') {
      result._quotaWarning = true
    }
    return result
  })
}

/**
 * 取得所有 tag categories
 * @returns {Promise<Array>}
 */
async function getAllTagCategories () {
  return loadCategories()
}

/**
 * 依 id 取得單一 tag category
 * @param {string} categoryId
 * @returns {Promise<Object|null>}
 */
async function getTagCategory (categoryId) {
  const categories = await loadCategories()
  return categories.find(c => c.id === categoryId) || null
}

/**
 * 更新 tag category
 * 業務規則：不可修改 id 和 isSystem，自動更新 updatedAt
 *
 * @param {string} categoryId
 * @param {Object} updates
 * @returns {Promise<Object>} 更新後物件或 { success: false, error }
 */
async function updateTagCategory (categoryId, updates) {
  return operationLock.run(async () => {
    const categories = await loadCategories()
    const index = categories.findIndex(c => c.id === categoryId)
    if (index === -1) {
      return { success: false, error: 'not_found' }
    }

    const category = categories[index]
    // 保護欄位：id, isSystem, createdAt 不可修改
    const { id: _id, isSystem: _sys, createdAt: _ca, ...safeUpdates } = updates

    // 樹防護：合併 patch 後驗證（含 parentId 變更的引用/循環/深度 + scoped 兄弟唯一鍵）。
    // 失敗時不寫入，回對應 error code。
    const merged = { ...category, ...safeUpdates }
    const mergedParentId = merged.parentId == null ? null : merged.parentId
    const siblings = categories.filter(
      c => c.id !== category.id && (c.parentId == null ? null : c.parentId) === mergedParentId
    )
    const validation = TagSchema.validateTagCategory(merged, siblings, categories)
    if (!validation.valid) {
      return { success: false, error: pickCategoryErrorCode(validation) }
    }

    Object.assign(category, safeUpdates, { updatedAt: new Date().toISOString() })

    await saveToStorage({ [STORAGE_KEYS.TAG_CATEGORIES]: categories })
    return { ...category }
  })
}

/**
 * 移動 tag category 至新父節點（樹狀重組）。
 *
 * 樹防護：循環引用（移至自身或子孫）、深度超限、目標 parent 引用存在性。
 * 驗證失敗時不寫入並回對應 error code，保證樹不變（B1 場景）。
 *
 * 注意：本 ticket（W2-009.1 場景組 B）僅實作 B1 循環防護所需的最小移動路徑；
 * 「目標深度 + 子樹最大相對深度」整體深度檢查屬後續場景組 F 的 move 完整契約。
 *
 * @param {string} categoryId - 要移動的 category id
 * @param {string|null} newParentId - 新父節點 id（null 為移至根層）
 * @returns {Promise<Object>} { success: true } 或 { success: false, error }
 */
async function moveTagCategory (categoryId, newParentId) {
  return operationLock.run(async () => {
    const categories = await loadCategories()
    const index = categories.findIndex(c => c.id === categoryId)
    if (index === -1) {
      return { success: false, error: 'not_found' }
    }

    const targetParentId = newParentId === undefined ? null : newParentId
    const category = categories[index]
    const merged = { ...category, parentId: targetParentId }
    const siblings = categories.filter(
      c => c.id !== category.id && (c.parentId == null ? null : c.parentId) === targetParentId
    )
    const validation = TagSchema.validateTagCategory(merged, siblings, categories)
    if (!validation.valid) {
      return { success: false, error: pickCategoryErrorCode(validation) }
    }

    category.parentId = targetParentId
    category.updatedAt = new Date().toISOString()
    await saveToStorage({ [STORAGE_KEYS.TAG_CATEGORIES]: categories })
    return { success: true }
  })
}

/**
 * 確保系統「未分類」category 存在，回傳其確定性 id（場景 C2-lazy）。
 *
 * 葉 category 刪除時，其下 tag 轉至此節點。不存在則惰性建立確定性 ID 節點
 * （isSystem=true，本身不可刪除，C4-uncat）。傳入的 categories 陣列會就地
 * 追加新節點，呼叫端負責後續寫入。
 *
 * @param {Array} categories - 當前 category 集合（就地追加）
 * @returns {string} 未分類 category 的 id
 */
function ensureUncategorizedCategory (categories) {
  const existing = categories.find(c => c.id === UNCATEGORIZED_CATEGORY_ID)
  if (existing) return existing.id

  const now = new Date().toISOString()
  categories.push({
    id: UNCATEGORIZED_CATEGORY_ID,
    name: UNCATEGORIZED_CATEGORY_NAME,
    parentId: null,
    description: '',
    color: DEFAULT_CATEGORY_COLOR,
    isSystem: true,
    sortOrder: categories.length,
    createdAt: now,
    updatedAt: now
  })
  return UNCATEGORIZED_CATEGORY_ID
}

/**
 * 蒐集指定 category 的整棵子樹 id（含自身），葉到根序回傳。
 *
 * @param {string} rootId - 子樹根 id
 * @param {Array} categories - 全量 category 集合
 * @returns {string[]} 子樹所有節點 id（葉節點在前、根節點在後）
 */
function collectSubtreeIds (rootId, categories) {
  const childrenByParent = new Map()
  for (const c of categories) {
    const pid = c.parentId == null ? null : c.parentId
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
    childrenByParent.get(pid).push(c.id)
  }

  // 後序走訪（子先於父），保證刪除時葉節點在前
  const ordered = []
  const visit = (id) => {
    const children = childrenByParent.get(id) || []
    for (const childId of children) visit(childId)
    ordered.push(id)
  }
  visit(rootId)
  return ordered
}

/**
 * 刪除 tag category（樹狀分層語意，場景組 C）。
 *
 * 分層規則：
 * - C4 isSystem（含「未分類」）不可刪 → system_protected
 * - C1/C3-noopt 非葉且未 opt-in cascadeSubtree → has_children（含引導 hint）
 * - C2 葉節點：其下 tag 轉至 Uncategorized（惰性建立），tag 不刪、Book.tagIds 不變
 * - C3 cascadeSubtree=true：刪整棵子樹（含其下 tag）
 * - C-rollback cascade 中途寫入失敗 → cascade_partial + rolledBack:true，原狀態回滾
 *
 * @param {string} categoryId
 * @param {Object} [options]
 * @param {boolean} [options.cascadeSubtree=false] - 是否刪整棵子樹（opt-in）
 * @returns {Promise<Object>} { success: true } 或 { success: false, error, hint?, rolledBack? }
 */
async function deleteTagCategory (categoryId, options = {}) {
  return operationLock.run(async () => {
    const cascadeSubtree = options.cascadeSubtree === true
    const categories = await loadCategories()
    const catIndex = categories.findIndex(c => c.id === categoryId)
    if (catIndex === -1) {
      return { success: false, error: TAG_CATEGORY_OPERATION_ERROR_CODES.NOT_FOUND }
    }

    // C4：isSystem 保護（含 cascadeSubtree 仍拒）
    if (categories[catIndex].isSystem) {
      return { success: false, error: TAG_CATEGORY_OPERATION_ERROR_CODES.SYSTEM_PROTECTED }
    }

    const children = categories.filter(c => c.parentId === categoryId)
    // C1/C3-noopt：非葉且未 opt-in → 禁止刪除
    if (children.length > 0 && !cascadeSubtree) {
      return {
        success: false,
        error: TAG_CATEGORY_OPERATION_ERROR_CODES.HAS_CHILDREN,
        hint: HAS_CHILDREN_HINT
      }
    }

    const currentTags = await loadTags()
    const currentBooks = await loadBooks()

    // 樹狀刪除自管原子回滾：rollback 本身寫入也可能失敗，需保證恆回傳
    // cascade_partial + rolledBack:true 契約（既有 withAtomicRollback 無此語意）。
    const snapshot = {
      categories: JSON.parse(JSON.stringify(categories)),
      tags: JSON.parse(JSON.stringify(currentTags)),
      books: JSON.parse(JSON.stringify(currentBooks))
    }

    try {
      if (cascadeSubtree) {
        // C3：刪整棵子樹（葉到根序）+ 其下 tag 一併刪除
        const subtreeIds = new Set(collectSubtreeIds(categoryId, categories))
        const remainingTags = currentTags.filter(t => !subtreeIds.has(t.categoryId))
        const removedTagIds = new Set(
          currentTags.filter(t => subtreeIds.has(t.categoryId)).map(t => t.id)
        )
        // Book.tagIds 移除被刪 tag 引用
        let booksChanged = false
        for (const book of currentBooks) {
          if (book.tagIds && book.tagIds.length > 0) {
            const before = book.tagIds.length
            book.tagIds = book.tagIds.filter(tid => !removedTagIds.has(tid))
            if (book.tagIds.length < before) booksChanged = true
          }
        }
        if (booksChanged) await saveBooksWrapper(currentBooks)
        await saveToStorage({ [STORAGE_KEYS.TAGS]: remainingTags })
        const remainingCategories = categories.filter(c => !subtreeIds.has(c.id))
        await saveToStorage({ [STORAGE_KEYS.TAG_CATEGORIES]: remainingCategories })
      } else {
        // C2：刪葉節點，其下 tag 轉至 Uncategorized（tag 不刪、Book.tagIds 不變）
        const uncategorizedId = ensureUncategorizedCategory(categories)
        const now = new Date().toISOString()
        for (const tag of currentTags) {
          if (tag.categoryId === categoryId) {
            tag.categoryId = uncategorizedId
            tag.updatedAt = now
          }
        }
        await saveToStorage({ [STORAGE_KEYS.TAGS]: currentTags })
        const remainingCategories = categories.filter(c => c.id !== categoryId)
        await saveToStorage({ [STORAGE_KEYS.TAG_CATEGORIES]: remainingCategories })
      }
      return { success: true }
    } catch (err) {
      logger.error('CASCADE_DELETE_FAILED', { error: err && err.message ? err.message : String(err) })
      // 嘗試回滾至刪除前快照；回滾寫入本身可能再失敗，吞掉以保證契約回傳
      try {
        await saveBooksWrapper(snapshot.books)
        await saveToStorage({ [STORAGE_KEYS.TAGS]: snapshot.tags })
        await saveToStorage({ [STORAGE_KEYS.TAG_CATEGORIES]: snapshot.categories })
      } catch (rollbackErr) {
        logger.error('CASCADE_DELETE_FAILED', {
          error: `rollback also failed: ${rollbackErr && rollbackErr.message ? rollbackErr.message : String(rollbackErr)}`
        })
      }
      return {
        success: false,
        error: TAG_CATEGORY_OPERATION_ERROR_CODES.CASCADE_PARTIAL,
        rolledBack: true
      }
    }
  })
}

/**
 * 初始化賴永祥分類法預裝樹（場景組 D，確定性 ID upsert 冪等）。
 *
 * 機制：
 * - D1 全新安裝 → 全部預裝節點以確定性 ID（sys_cat_*）注入，isSystem=true
 * - D3/D3-idem onStartup 補償 → 已存在節點（依 id）跳過，僅補缺失，重複呼叫無新增
 * - D4 不經 createTagCategory（繞隨機 ID）；直接整批 storage.local.set
 * - D-atomic / D-quota 配額 blocked 或寫入失敗 → preset_init_failed，無部分寫入
 *
 * 冪等核心 = 確定性 ID + 「id 已存在則保留使用者修改不覆蓋」（Q5）。
 *
 * @returns {Promise<Object>} { success: true, count } 或 { success: false, error }
 */
async function initializePresets () {
  return operationLock.run(async () => {
    // D-quota：配額 blocked 不強寫。既有 quota 檢查走 getBytesInUse 比率門檻；
    // 樹狀 model 測試 fixture 另以 store 內 __quota 旗標直接注入 blocked 狀態
    // （對齊既有 quota 檢查 pattern，避免 mock getBytesInUse 比率換算）。兩路任一
    // 判定 blocked 即拒寫，回 preset_init_failed。
    const quota = await checkQuotaLevel()
    const injectedQuota = await loadFromStorage(QUOTA_OVERRIDE_KEY)
    if (quota.level === 'blocked' || injectedQuota === 'blocked') {
      logger.error('PRESET_INIT_BLOCKED_QUOTA')
      return { success: false, error: TAG_CATEGORY_OPERATION_ERROR_CODES.PRESET_INIT_FAILED }
    }

    const existing = await loadCategories()
    const existingIds = new Set(existing.map(c => c.id))

    // 確定性 ID upsert：已存在跳過（保留使用者修改），僅補缺失
    const now = new Date().toISOString()
    const result = existing.slice()
    let added = 0
    for (const preset of CHINESE_CLASSIFICATION_PRESETS) {
      if (existingIds.has(preset.id)) continue // 冪等：已存在不重建
      result.push({
        id: preset.id,
        name: preset.name,
        parentId: preset.parentId == null ? null : preset.parentId,
        description: '',
        color: DEFAULT_CATEGORY_COLOR,
        isSystem: true,
        sortOrder: result.length,
        createdAt: now,
        updatedAt: now
      })
      added += 1
    }

    // D-atomic：整批原子 set；失敗整批不生效（store 不變）
    try {
      await saveToStorage({ [STORAGE_KEYS.TAG_CATEGORIES]: result })
    } catch (err) {
      logger.error('PRESET_INIT_FAILED', { error: err && err.message ? err.message : String(err) })
      return { success: false, error: TAG_CATEGORY_OPERATION_ERROR_CODES.PRESET_INIT_FAILED }
    }

    return { success: true, count: result.length, added }
  })
}

// ==========================================
// Tags CRUD
// ==========================================

/**
 * 建立 tag
 * 業務規則：categoryId 必須存在，同 category 內 name 唯一
 *
 * @param {Object} input - { name, categoryId }
 * @returns {Promise<Object>} 建立的 tag 物件或 { success: false, error }
 */
async function createTag (input) {
  return operationLock.run(async () => {
    if (!input || !input.name || input.name.trim() === '') {
      return { success: false, error: 'name is required' }
    }
    if (!input.categoryId) {
      return { success: false, error: 'categoryId is required' }
    }

    const quota = await checkQuotaLevel()
    if (quota.level === 'blocked') {
      return { success: false, error: 'quota_exceeded' }
    }

    const categories = await loadCategories()
    if (!categories.some(c => c.id === input.categoryId)) {
      return { success: false, error: 'category_not_found' }
    }

    const tags = await loadTags()
    const isDuplicate = tags.some(
      t => t.categoryId === input.categoryId &&
           t.name.toLowerCase() === input.name.trim().toLowerCase()
    )
    if (isDuplicate) {
      return { success: false, error: 'duplicate_name_in_category' }
    }

    const now = new Date().toISOString()
    const tag = {
      id: `tag_${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: input.name.trim(),
      categoryId: input.categoryId,
      isSystem: false,
      sortOrder: tags.filter(t => t.categoryId === input.categoryId).length,
      createdAt: now,
      updatedAt: now
    }

    tags.push(tag)
    await saveToStorage({ [STORAGE_KEYS.TAGS]: tags })

    const result = { ...tag }
    if (quota.level === 'warning' || quota.level === 'auto_cleanup') {
      result._quotaWarning = true
    }
    return result
  })
}

/**
 * 取得所有 tags
 * @returns {Promise<Array>}
 */
async function getAllTags () {
  return loadTags()
}

/**
 * 取得指定 category 下所有 tags
 * @param {string} categoryId
 * @returns {Promise<Array>}
 */
async function getTagsByCategory (categoryId) {
  const tags = await loadTags()
  return tags.filter(t => t.categoryId === categoryId)
}

/**
 * 依書籍 id 取得其所有 tag 完整物件
 * 業務規則：tagIds 中不存在的 tag 跳過
 *
 * @param {string} bookId
 * @returns {Promise<Array>}
 */
async function getTagsForBook (bookId) {
  const books = await loadBooks()
  const book = books.find(b => b.id === bookId)
  if (!book || !book.tagIds || book.tagIds.length === 0) {
    return []
  }

  const tags = await loadTags()
  const tagMap = new Map(tags.map(t => [t.id, t]))
  return book.tagIds
    .map(tid => tagMap.get(tid))
    .filter(Boolean)
}

/**
 * 更新 tag
 * 業務規則：不可修改 id 和 isSystem
 *
 * @param {string} tagId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
async function updateTag (tagId, updates) {
  return operationLock.run(async () => {
    const tags = await loadTags()
    const index = tags.findIndex(t => t.id === tagId)
    if (index === -1) {
      return { success: false, error: 'not_found' }
    }

    const tag = tags[index]
    const { id: _id, isSystem: _sys, createdAt: _ca, ...safeUpdates } = updates
    Object.assign(tag, safeUpdates, { updatedAt: new Date().toISOString() })

    await saveToStorage({ [STORAGE_KEYS.TAGS]: tags })
    return { ...tag }
  })
}

/**
 * 刪除 tag（cascade 移除書籍引用）
 * 業務規則：isSystem=true 不可刪除
 *
 * @param {string} tagId
 * @returns {Promise<Object>}
 */
async function deleteTag (tagId) {
  return operationLock.run(async () => {
    const tags = await loadTags()
    const tagIndex = tags.findIndex(t => t.id === tagId)
    if (tagIndex === -1) {
      return { success: false, error: 'not_found' }
    }
    if (tags[tagIndex].isSystem) {
      return { success: false, error: 'cannot_delete_system' }
    }

    const currentBooks = await loadBooks()

    return withAtomicRollback(
      { tags, books: currentBooks },
      async () => {
        // Step 1: 從所有書籍移除引用
        for (const book of currentBooks) {
          if (book.tagIds && book.tagIds.includes(tagId)) {
            book.tagIds = book.tagIds.filter(tid => tid !== tagId)
          }
        }
        await saveBooksWrapper(currentBooks)

        // Step 2: 刪除 tag
        tags.splice(tagIndex, 1)
        await saveToStorage({ [STORAGE_KEYS.TAGS]: tags })

        return { success: true }
      },
      'deleteTag'
    )
  })
}

// ==========================================
// Book-Tag 關聯操作
// ==========================================

/**
 * 將 tag 加入書籍
 * 業務規則：去重、tagId 和 bookId 必須存在
 *
 * @param {string} bookId
 * @param {string} tagId
 * @returns {Promise<Object>}
 */
async function addTagToBook (bookId, tagId) {
  return operationLock.run(async () => {
    const tags = await loadTags()
    if (!tags.some(t => t.id === tagId)) {
      return { success: false, error: 'tag_not_found' }
    }

    const books = await loadBooks()
    const book = books.find(b => b.id === bookId)
    if (!book) {
      return { success: false, error: 'book_not_found' }
    }

    if (!book.tagIds) {
      book.tagIds = []
    }
    if (!book.tagIds.includes(tagId)) {
      book.tagIds.push(tagId)
    }

    await saveBooksWrapper(books)
    return { success: true, tagIds: [...book.tagIds] }
  })
}

/**
 * 從書籍移除 tag（冪等）
 *
 * @param {string} bookId
 * @param {string} tagId
 * @returns {Promise<Object>}
 */
async function removeTagFromBook (bookId, tagId) {
  return operationLock.run(async () => {
    const books = await loadBooks()
    const book = books.find(b => b.id === bookId)
    if (!book) {
      return { success: false, error: 'book_not_found' }
    }

    if (book.tagIds) {
      book.tagIds = book.tagIds.filter(tid => tid !== tagId)
    }

    await saveBooksWrapper(books)
    return { success: true, tagIds: [...(book.tagIds || [])] }
  })
}

/**
 * 替換書籍所有 tagIds
 * 業務規則：驗證每個 tagId 是否存在，不存在的跳過
 *
 * @param {string} bookId
 * @param {string[]} tagIds
 * @returns {Promise<Object>}
 */
async function setBookTags (bookId, tagIds) {
  return operationLock.run(async () => {
    const books = await loadBooks()
    const book = books.find(b => b.id === bookId)
    if (!book) {
      return { success: false, error: 'book_not_found' }
    }

    const allTags = await loadTags()
    const validTagIds = new Set(allTags.map(t => t.id))
    const validatedTagIds = tagIds.filter(tid => validTagIds.has(tid))

    // 如果有無效 tagId 且全部無效，回傳錯誤；部分無效則跳過
    if (tagIds.length > 0 && validatedTagIds.length === 0) {
      return { success: false, error: 'no_valid_tags' }
    }

    book.tagIds = [...new Set(validatedTagIds)]
    await saveBooksWrapper(books)
    return { success: true, tagIds: [...book.tagIds] }
  })
}

/**
 * 查詢含特定 tag 的所有書籍
 *
 * @param {string} tagId
 * @returns {Promise<Array>}
 */
async function getBooksByTag (tagId) {
  const books = await loadBooks()
  return books.filter(b => b.tagIds && b.tagIds.includes(tagId))
}

// ==========================================
// 配額管理
// ==========================================

/**
 * 取得配額狀態
 * @returns {Promise<Object>}
 */
async function getQuotaStatus () {
  const bytesUsed = await getBytesInUse()
  const usageRatio = bytesUsed / MAX_STORAGE_SIZE
  return {
    bytesUsed,
    maxSize: MAX_STORAGE_SIZE,
    usageRatio,
    level: (await checkQuotaLevel()).level
  }
}

// ==========================================
// 引用完整性檢查
// ==========================================

/**
 * 執行引用完整性檢查並自動修復
 * - 移除書籍 tagIds 中不存在的 tagId
 * - tag 的 categoryId 引用不存在時，移至預設 category 或刪除
 *
 * @returns {Promise<Object>} 修復結果
 */
async function checkReferentialIntegrity () {
  return operationLock.run(async () => {
    const tags = await loadTags()
    const categories = await loadCategories()
    const books = await loadBooks()

    const validTagIds = new Set(tags.map(t => t.id))
    const validCategoryIds = new Set(categories.map(c => c.id))

    let booksFixed = 0
    let tagsFixed = 0

    // 修復書籍中的無效 tagIds
    for (const book of books) {
      if (book.tagIds && book.tagIds.length > 0) {
        const before = book.tagIds.length
        book.tagIds = book.tagIds.filter(tid => validTagIds.has(tid))
        if (book.tagIds.length < before) {
          booksFixed++
        }
      }
    }

    // 修復 tag 的無效 categoryId
    const defaultCategory = categories.find(c => !c.isSystem) || categories[0]
    const remainingTags = []
    for (const tag of tags) {
      if (!validCategoryIds.has(tag.categoryId)) {
        if (defaultCategory) {
          tag.categoryId = defaultCategory.id
          tag.updatedAt = new Date().toISOString()
          remainingTags.push(tag)
          tagsFixed++
        }
        // 沒有預設 category 則刪除 tag
      } else {
        remainingTags.push(tag)
      }
    }

    await saveBooksWrapper(books)
    await saveToStorage({ [STORAGE_KEYS.TAGS]: remainingTags })

    return { success: true, booksFixed, tagsFixed }
  })
}

// ==========================================
// Schema Version 初始化
// ==========================================

/**
 * 初始化 tag storage schema version
 * @returns {Promise<void>}
 */
async function initializeSchema () {
  await saveToStorage({ [STORAGE_KEYS.SCHEMA_VERSION]: BOOK_SCHEMA_VERSION })
}

// ==========================================
// 覆蓋模式整批寫入（UC-04 匯入）
// ==========================================

/**
 * 覆蓋模式整批寫入：以匯入資料完全取代 storage 中的 books / tags / tag_categories。
 *
 * 語意 = 清空後載入（SPEC-EXPORT-V2 §8.1）。三個 storage key 一併取代，
 * 空集合也覆蓋為 []（不保留舊值）。
 *
 * 設計：複用既有基礎設施，不新增機制——
 * - operationLock.run：與其他 storage 操作序列化互斥
 * - checkQuotaLevel：寫入前攔截配額不足
 * - withAtomicRollback：任一 key 寫入失敗時回滾全部三 key 至寫入前快照
 * - saveBooksWrapper：保持 readmoo_books 既有結構慣例（陣列或 { books: [...] }）
 *
 * @param {Object} data
 * @param {Array<Object>} data.books          - v2 書籍陣列
 * @param {Array<Object>} data.tags           - v2 tag 陣列
 * @param {Array<Object>} data.tagCategories  - v2 tag category 陣列
 * @returns {Promise<{ success: boolean, error?: string,
 *                      counts?: { books: number, tags: number, tagCategories: number } }>}
 *   success=true：三 key 寫入完成，counts 回報寫入筆數
 *   success=false：error 為 'quota_exceeded' | 'storage_error'
 */
async function replaceAllData ({ books, tags, tagCategories }) {
  return operationLock.run(async () => {
    // 步驟 A：配額前置攔截——blocked 時不寫入任何 key
    const quota = await checkQuotaLevel()
    if (quota.level === 'blocked') {
      logger.error('REPLACE_BLOCKED_QUOTA')
      return { success: false, error: 'quota_exceeded' }
    }

    // 步驟 B：建立寫入前快照（三 key）
    // 快照 key 名稱必須對齊 SNAPSHOT_KEY_TO_STORAGE_KEY 契約：
    // categories→TAG_CATEGORIES、tags→TAGS，books 走 saveBooksWrapper 特殊處理。
    const previousBooks = await loadBooks()
    const previousTags = await loadTags()
    const previousCategories = await loadCategories()

    // 步驟 C：原子寫入（包入回滾機制），依序寫三 key
    const result = await withAtomicRollback(
      { books: previousBooks, tags: previousTags, categories: previousCategories },
      async () => {
        await saveBooksWrapper(books)
        await saveToStorage({ [STORAGE_KEYS.TAGS]: tags })
        await saveToStorage({ [STORAGE_KEYS.TAG_CATEGORIES]: tagCategories })
        return { success: true }
      },
      'replaceAllData'
    )

    // 步驟 D：判定終點
    if (result.success === true) {
      return {
        success: true,
        counts: {
          books: books.length,
          tags: tags.length,
          tagCategories: tagCategories.length
        }
      }
    }

    // withAtomicRollback 已完成回滾並回傳 { success:false, error:'rollback' }；
    // 對外統一轉為 'storage_error'，'rollback' 為實作細節不外洩。
    logger.error('REPLACE_FAILED_AFTER_ROLLBACK')
    return { success: false, error: 'storage_error' }
  })
}

// ==========================================
// 合併模式整批寫入（UC-04 匯入）
// ==========================================

/**
 * 截斷字串至指定上限（用於 tag/category name 超長時的防禦）
 * @param {string} value - 原字串（非字串時回傳空字串）
 * @param {number} maxLength - 上限長度
 * @returns {string}
 */
function truncateName (value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.length > maxLength ? value.slice(0, maxLength) : value
}

/**
 * 組成 tag 同名比對複合鍵：重映射後本地 categoryId + name（大小寫不敏感）。
 *
 * 同名比對鍵必須含 categoryId——不同 category 下的同名 tag 不應視為相同。
 * 以 JSON.stringify 元組編碼，避免 id/name 內含分隔字元造成的鍵碰撞。
 *
 * @param {string} categoryId - 重映射後的本地 categoryId
 * @param {string} name - tag 名稱
 * @returns {string}
 */
/**
 * scoped category 合併（樹狀 model A3-2）：以 makeCategoryKey(parentId, name) 為同一性鍵，
 * 使不同 parent 下的同名次類在 merge 後各自保留，不被全域同名誤併。
 *
 * 本 ticket（W2-009.1 場景組 A）僅實作 category scoped 去重的最小路徑（A3-2 對應契約）；
 * 完整 merge 管線（tag/book 重映射、tombstone、LWW）仍由既有三參數 computeMergeResult 承擔。
 *
 * @param {Object} input - { localCategories, incomingCategories, localTags, incomingTags }
 * @returns {{ categories: Array, tags: Array }}
 */
function computeScopedCategoryMerge (input) {
  const localCategories = (input && input.localCategories) || []
  const incomingCategories = (input && input.incomingCategories) || []
  const localTags = (input && input.localTags) || []
  const incomingTags = (input && input.incomingTags) || []

  const resultCategories = localCategories.slice()
  // scoped 鍵 → category，供 O(1) 同鍵收斂（key = makeCategoryKey(parentId, name)）
  const byScopedKey = new Map()
  for (const cat of resultCategories) {
    byScopedKey.set(TagSchema.makeCategoryKey(cat.parentId, cat.name), cat)
  }

  for (const impCat of incomingCategories) {
    const key = TagSchema.makeCategoryKey(impCat.parentId, impCat.name)
    if (!byScopedKey.has(key)) {
      resultCategories.push({ ...impCat })
      byScopedKey.set(key, impCat)
    }
    // 同 scoped 鍵則視為同一節點，保留本地（不重複新增）
  }

  return { categories: resultCategories, tags: localTags.concat(incomingTags) }
}

function makeTagKey (categoryId, name) {
  return JSON.stringify([categoryId, name.toLowerCase()])
}

/**
 * 合併計算純函式：計算匯入資料與本地資料疊加後的結果，並建立 id 重映射表。
 *
 * 與 storage I/O 完全解耦——不觸碰 chrome.storage、不產生時間戳。新建本地 id
 * 透過注入的 idGenerators 提供，使本函式可重現、可獨立於 chrome.storage mock 測試。
 *
 * 四階段管線（順序即保證三層 id 一致性）：
 * 1. category 同名比對 → 建 categoryIdMap
 * 2. tag 同名比對（鍵 = 重映射後 categoryId + name）→ 建 tagIdMap
 * 3. book tagIds 重映射 + 同 id tagIds 聯集
 *
 * 合併語意：同 id 更新（其餘欄位以匯入覆蓋、tagIds 取聯集）、新 id 新增、永不刪除本地。
 * 合併不修復本地破損：本地既有孤兒 tagId 在聯集後原樣保留（修復屬 checkReferentialIntegrity 職責）。
 *
 * @param {Object} local - 本地現況 { books, tags, tagCategories }
 * @param {Object} incoming - 匯入資料 { books, tags, tagCategories }
 * @param {Object} idGenerators - { nextCategoryId, nextTagId } 兩個無參數函式
 * @returns {{ books: Array, tags: Array, tagCategories: Array,
 *             remap: { categoryIdMap: Map, tagIdMap: Map,
 *                      categoryRemapToExisting: number, tagRemapToExisting: number } }}
 */
function computeMergeResult (local, incoming, idGenerators) {
  // 物件形式 overload（樹狀 model A3-2 scoped merge）：
  // computeMergeResult({ localCategories, incomingCategories, localTags, incomingTags })
  // 與既有三參數形式（local, incoming, idGenerators）並存，由首參數欄位辨識。
  if (local && (local.localCategories !== undefined || local.incomingCategories !== undefined)) {
    return computeScopedCategoryMerge(local)
  }

  const localBooks = (local && local.books) || []
  const localTags = (local && local.tags) || []
  const localCategories = (local && local.tagCategories) || []
  const incomingBooks = (incoming && incoming.books) || []
  const incomingTags = (incoming && incoming.tags) || []
  const incomingCategories = (incoming && incoming.tagCategories) || []

  // === 階段 1：category 同名比對與重映射 ===
  // categoryIdMap：匯入 category id → 本地 category id（同名映射或新建）
  const categoryIdMap = new Map()
  // resultCategories 以本地 category 淺拷貝起始，新建 category 追加於後
  const resultCategories = localCategories.slice()
  // localCatByName：name.toLowerCase() → category 物件，供 O(1) 同名查找與收斂
  const localCatByName = new Map()
  for (const cat of resultCategories) {
    localCatByName.set(cat.name.toLowerCase(), cat)
  }
  // 既有本地 category id 集合，供 remap 統計區分「映射至既有」與「新建」
  const previousCategoryIds = new Set(localCategories.map(c => c.id))

  // 惰性建立的「未分類」category id（首次需要時才建，避免無孤兒 tag 時憑空多出）
  let uncategorizedId = null
  /**
   * 確保「未分類」category 存在並回傳其本地 id。
   * 本地已有「未分類」則映射至本地；否則新建並參與後續同名比對。
   */
  function ensureUncategorized () {
    if (uncategorizedId !== null) return uncategorizedId
    const key = '未分類'.toLowerCase()
    if (localCatByName.has(key)) {
      uncategorizedId = localCatByName.get(key).id
      return uncategorizedId
    }
    const newId = idGenerators.nextCategoryId()
    const newCat = {
      id: newId,
      name: '未分類',
      description: '',
      color: DEFAULT_CATEGORY_COLOR,
      isSystem: false,
      sortOrder: resultCategories.length
    }
    resultCategories.push(newCat)
    localCatByName.set(key, newCat)
    uncategorizedId = newId
    return newId
  }

  for (const impCat of incomingCategories) {
    const name = truncateName(impCat.name, TagSchema.TAG_CATEGORY_NAME_MAX_LENGTH)
    const key = name.toLowerCase()
    if (localCatByName.has(key)) {
      // 同名（含先前 incoming 已收斂建立者）→ 映射至既有本地 id
      categoryIdMap.set(impCat.id, localCatByName.get(key).id)
    } else {
      // 不存在則新建本地 category
      const newId = idGenerators.nextCategoryId()
      const newCat = { ...impCat, id: newId, name }
      resultCategories.push(newCat)
      localCatByName.set(key, newCat)
      categoryIdMap.set(impCat.id, newId)
    }
  }

  // === 階段 2：tag 同名比對與重映射 ===
  // tagIdMap：匯入 tag id → 本地 tag id
  const tagIdMap = new Map()
  const resultTags = localTags.slice()
  // localTagByKey：複合鍵（categoryId + name）→ tag 物件
  const localTagByKey = new Map()
  for (const tag of resultTags) {
    localTagByKey.set(makeTagKey(tag.categoryId, tag.name), tag)
  }
  const previousTagIds = new Set(localTags.map(t => t.id))

  for (const impTag of incomingTags) {
    const name = truncateName(impTag.name, TagSchema.TAG_NAME_MAX_LENGTH)
    // 重映射 categoryId；匯入檔案內找不到對應 category → 歸入「未分類」
    let localCatId = categoryIdMap.get(impTag.categoryId)
    if (localCatId === undefined) {
      logger.warn('MERGE_TAG_CATEGORY_MISSING', { tagId: impTag.id })
      localCatId = ensureUncategorized()
    }
    const key = makeTagKey(localCatId, name)
    if (localTagByKey.has(key)) {
      // 同 category 同名 → 映射至既有本地 tag id
      tagIdMap.set(impTag.id, localTagByKey.get(key).id)
    } else {
      // 不存在則新建本地 tag
      const newId = idGenerators.nextTagId()
      const newTag = { ...impTag, id: newId, name, categoryId: localCatId }
      resultTags.push(newTag)
      localTagByKey.set(key, newTag)
      tagIdMap.set(impTag.id, newId)
    }
  }

  // === 階段 3：book tagIds 重映射 + 同 id 聯集 ===
  // localBookById 初始即含全部本地書，保證本地未匹配書原樣保留
  const localBookById = new Map()
  for (const book of localBooks) {
    localBookById.set(book.id, book)
  }

  for (const impBook of incomingBooks) {
    if (impBook.id === undefined || impBook.id === null) {
      logger.warn('MERGE_BOOK_MISSING_ID')
      continue
    }
    // 重映射匯入 tagIds，過濾無法重映射者（匯入側孤兒，不觸碰本地側）
    const remappedTagIds = []
    for (const tid of (impBook.tagIds || [])) {
      const mapped = tagIdMap.get(tid)
      if (mapped === undefined) {
        logger.warn('MERGE_TAGID_UNMAPPABLE', { tagId: tid })
        continue
      }
      remappedTagIds.push(mapped)
    }
    if (localBookById.has(impBook.id)) {
      // 同 id：其餘欄位以匯入覆蓋，tagIds 取聯集（本地在前、新增在後、去重）
      const localBook = localBookById.get(impBook.id)
      let unionTagIds = [...new Set([...(localBook.tagIds || []), ...remappedTagIds])]
      if (unionTagIds.length > TagSchema.MAX_TAGS_PER_BOOK) {
        logger.warn('MERGE_TAGIDS_TRUNCATED', { bookId: impBook.id, limit: TagSchema.MAX_TAGS_PER_BOOK })
        unionTagIds = unionTagIds.slice(0, TagSchema.MAX_TAGS_PER_BOOK)
      }
      localBookById.set(impBook.id, { ...localBook, ...impBook, tagIds: unionTagIds })
    } else {
      // 新 id 直接加入
      localBookById.set(impBook.id, { ...impBook, tagIds: remappedTagIds })
    }
  }

  const resultBooks = [...localBookById.values()]

  // remap 統計：僅計「映射至既有本地 id」者，新建不計入（feature-spec §2.2）
  let categoryRemapToExisting = 0
  for (const localId of categoryIdMap.values()) {
    if (previousCategoryIds.has(localId)) categoryRemapToExisting++
  }
  let tagRemapToExisting = 0
  for (const localId of tagIdMap.values()) {
    if (previousTagIds.has(localId)) tagRemapToExisting++
  }

  return {
    books: resultBooks,
    tags: resultTags,
    tagCategories: resultCategories,
    remap: { categoryIdMap, tagIdMap, categoryRemapToExisting, tagRemapToExisting }
  }
}

/**
 * 合併模式整批寫入：將匯入資料與 storage 既有 books / tags / tag_categories 疊加。
 *
 * 語意 = 同 id 更新、新 id 新增，永不清空本地（SPEC-EXPORT-V2 §8.2）。與覆蓋模式
 * replaceAllData 對稱：合併計算（computeMergeResult 純函式）+ storage I/O 編排。
 *
 * 設計：複用既有基礎設施，不新增機制——
 * - operationLock.run：與其他 storage 操作序列化互斥
 * - checkQuotaLevel：寫入前攔截配額不足
 * - withAtomicRollback：任一 key 寫入失敗時回滾全部三 key 至寫入前快照
 * - saveBooksWrapper：保持 readmoo_books 既有結構慣例（陣列或 { books: [...] }）
 *
 * @param {Object} data
 * @param {Array<Object>} data.books          - 匯入的 v2 書籍陣列
 * @param {Array<Object>} data.tags           - 匯入的 v2 tag 陣列
 * @param {Array<Object>} data.tagCategories  - 匯入的 v2 tag category 陣列
 * @returns {Promise<{ success: boolean, error?: string,
 *                      counts?: { books: number, tags: number, tagCategories: number },
 *                      remap?: { categories: number, tags: number } }>}
 *   success=true：合併結果原子寫回三 key，counts 為合併後筆數，remap 為重映射統計
 *   success=false：error 為 'quota_exceeded' | 'storage_error'
 */
async function mergeAllData ({ books, tags, tagCategories }) {
  return operationLock.run(async () => {
    // 步驟 A：配額前置攔截——blocked 時不讀、不算、不寫
    const quota = await checkQuotaLevel()
    if (quota.level === 'blocked') {
      logger.error('MERGE_BLOCKED_QUOTA')
      return { success: false, error: 'quota_exceeded' }
    }

    // 步驟 B：讀本地三 key 現況作為合併輸入
    const previousBooks = await loadBooks()
    const previousTags = await loadTags()
    const previousCategories = await loadCategories()

    // 步驟 C：計算合併結果（純函式，注入正式 id 產生器）
    const idGenerators = {
      nextCategoryId: () => `cat_${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nextTagId: () => `tag_${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }
    const merged = computeMergeResult(
      { books: previousBooks, tags: previousTags, tagCategories: previousCategories },
      { books, tags, tagCategories },
      idGenerators
    )

    // 步驟 D：原子寫回（快照 key 名對齊 SNAPSHOT_KEY_TO_STORAGE_KEY）
    const result = await withAtomicRollback(
      { books: previousBooks, tags: previousTags, categories: previousCategories },
      async () => {
        await saveBooksWrapper(merged.books)
        await saveToStorage({ [STORAGE_KEYS.TAGS]: merged.tags })
        await saveToStorage({ [STORAGE_KEYS.TAG_CATEGORIES]: merged.tagCategories })
        return { success: true }
      },
      'mergeAllData'
    )

    // 步驟 E：判定終點
    if (result.success === true) {
      return {
        success: true,
        counts: {
          books: merged.books.length,
          tags: merged.tags.length,
          tagCategories: merged.tagCategories.length
        },
        remap: {
          categories: merged.remap.categoryRemapToExisting,
          tags: merged.remap.tagRemapToExisting
        }
      }
    }

    // withAtomicRollback 已完成回滾並回傳 { success:false, error:'rollback' }；
    // 對外統一轉為 'storage_error'，'rollback' 為實作細節不外洩。
    logger.error('MERGE_FAILED_AFTER_ROLLBACK')
    return { success: false, error: 'storage_error' }
  })
}

// ==========================================
// 匯出
// ==========================================

const TagStorageAdapter = {
  // Tag Categories CRUD
  createTagCategory,
  getAllTagCategories,
  getTagCategory,
  updateTagCategory,
  moveTagCategory,
  deleteTagCategory,

  // 預裝載入（賴永祥分類法樹，場景組 D）
  initializePresets,

  // Tags CRUD
  createTag,
  getAllTags,
  getTagsByCategory,
  getTagsForBook,
  updateTag,
  deleteTag,

  // Book-Tag 關聯
  addTagToBook,
  removeTagFromBook,
  setBookTags,
  getBooksByTag,

  // 配額管理
  getQuotaStatus,
  checkQuotaLevel,
  getBytesInUse,

  // 引用完整性
  checkReferentialIntegrity,

  // Schema
  initializeSchema,

  // 覆蓋模式整批寫入（UC-04 匯入）
  replaceAllData,

  // 合併模式整批寫入與合併計算純函式（UC-04 匯入）
  mergeAllData,
  computeMergeResult,

  // 常數（供外部使用）
  STORAGE_KEYS,
  MAX_STORAGE_SIZE,
  QUOTA_THRESHOLDS,
  TAG_CATEGORY_OPERATION_ERROR_CODES
}

module.exports = TagStorageAdapter
