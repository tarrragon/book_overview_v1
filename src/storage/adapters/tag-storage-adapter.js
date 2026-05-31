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
  MERGE_FAILED_AFTER_ROLLBACK: 'mergeAllData failed after rollback'
})

const logger = new Logger('[tag-storage-adapter]', 'INFO', tagStorageAdapterMessages)

const STORAGE_KEYS = {
  READMOO_BOOKS: 'readmoo_books',
  TAG_CATEGORIES: 'tag_categories',
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

// --- 內部 Storage 存取輔助 ---

/**
 * 從 Chrome Storage 讀取指定 key
 * @param {string} key - storage key
 * @returns {Promise<any>}
 */
function loadFromStorage (key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve(result[key] || null)
      }
    })
  })
}

/**
 * 將資料寫入 Chrome Storage
 * @param {Object} items - key-value 對
 * @returns {Promise<void>}
 */
function saveToStorage (items) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve()
      }
    })
  })
}

/**
 * 取得 storage 使用量
 * @returns {Promise<number>} bytes in use
 */
function getBytesInUse () {
  return new Promise((resolve, reject) => {
    chrome.storage.local.getBytesInUse(null, (bytes) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve(bytes)
      }
    })
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
    const isDuplicate = categories.some(
      c => c.name.toLowerCase() === input.name.trim().toLowerCase()
    )
    if (isDuplicate) {
      return { success: false, error: 'duplicate_name' }
    }

    const now = new Date().toISOString()
    const category = {
      id: `cat_${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: input.name.trim(),
      description: input.description || '',
      color: input.color || DEFAULT_CATEGORY_COLOR,
      isSystem: false,
      sortOrder: categories.length,
      createdAt: now,
      updatedAt: now
    }

    categories.push(category)
    await saveToStorage({ [STORAGE_KEYS.TAG_CATEGORIES]: categories })

    const result = { ...category }
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
    Object.assign(category, safeUpdates, { updatedAt: new Date().toISOString() })

    await saveToStorage({ [STORAGE_KEYS.TAG_CATEGORIES]: categories })
    return { ...category }
  })
}

/**
 * 刪除 tag category（cascade 刪除所屬 tags 和書籍引用）
 * 業務規則：isSystem=true 不可刪除
 *
 * @param {string} categoryId
 * @returns {Promise<Object>} { success: true } 或 { success: false, error }
 */
async function deleteTagCategory (categoryId) {
  return operationLock.run(async () => {
    const categories = await loadCategories()
    const catIndex = categories.findIndex(c => c.id === categoryId)
    if (catIndex === -1) {
      return { success: false, error: 'not_found' }
    }
    if (categories[catIndex].isSystem) {
      return { success: false, error: 'cannot_delete_system' }
    }

    const currentTags = await loadTags()
    const currentBooks = await loadBooks()

    return withAtomicRollback(
      { categories, tags: currentTags, books: currentBooks },
      async () => {
        // Step 1: 找出 category 下所有 tags
        const tagIdsToRemove = currentTags
          .filter(t => t.categoryId === categoryId)
          .map(t => t.id)

        // Step 2: 從書籍移除被刪 tag 引用
        if (tagIdsToRemove.length > 0) {
          const removeSet = new Set(tagIdsToRemove)
          for (const book of currentBooks) {
            if (book.tagIds && book.tagIds.length > 0) {
              book.tagIds = book.tagIds.filter(tid => !removeSet.has(tid))
            }
          }
          await saveBooksWrapper(currentBooks)
        }

        // Step 3: 刪除 tags
        const remainingTags = currentTags.filter(t => t.categoryId !== categoryId)
        await saveToStorage({ [STORAGE_KEYS.TAGS]: remainingTags })

        // Step 4: 刪除 category
        categories.splice(catIndex, 1)
        await saveToStorage({ [STORAGE_KEYS.TAG_CATEGORIES]: categories })

        return { success: true }
      },
      'deleteTagCategory'
    )
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
  deleteTagCategory,

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
  QUOTA_THRESHOLDS
}

module.exports = TagStorageAdapter
