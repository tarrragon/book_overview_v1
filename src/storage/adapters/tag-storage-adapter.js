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
 * - schema_version: "3.0.0"
 *
 * 規格來源：docs/spec/data-management/data-management.md
 *
 * @version 1.0.0
 */

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

/** 預設類別顏色 */
const DEFAULT_CATEGORY_COLOR = '#808080'

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
      if (typeof console !== 'undefined') {
        console.error('[tag-storage-adapter] Lock operation failed:', err)
      }
    })
    return next
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
      id: `cat_${Date.now()}`,
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

    // 記錄回滾快照
    const originalCategories = JSON.parse(JSON.stringify(categories))
    const originalTags = JSON.parse(JSON.stringify(await loadTags()))
    const originalBooks = JSON.parse(JSON.stringify(await loadBooks()))

    try {
      // Step 1: 找出 category 下所有 tags
      const tags = await loadTags()
      const tagIdsToRemove = tags
        .filter(t => t.categoryId === categoryId)
        .map(t => t.id)

      // Step 2: 從書籍移除被刪 tag 引用
      const books = await loadBooks()
      if (tagIdsToRemove.length > 0) {
        const removeSet = new Set(tagIdsToRemove)
        for (const book of books) {
          if (book.tagIds && book.tagIds.length > 0) {
            book.tagIds = book.tagIds.filter(tid => !removeSet.has(tid))
          }
        }
        await saveBooksWrapper(books)
      }

      // Step 3: 刪除 tags
      const remainingTags = tags.filter(t => t.categoryId !== categoryId)
      await saveToStorage({ [STORAGE_KEYS.TAGS]: remainingTags })

      // Step 4: 刪除 category
      categories.splice(catIndex, 1)
      await saveToStorage({ [STORAGE_KEYS.TAG_CATEGORIES]: categories })

      return { success: true }
    } catch (err) {
      // 回滾
      await saveToStorage({
        [STORAGE_KEYS.TAG_CATEGORIES]: originalCategories,
        [STORAGE_KEYS.TAGS]: originalTags
      })
      await saveBooksWrapper(originalBooks)
      return { success: false, error: 'rollback', cause: err.message }
    }
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
      id: `tag_${Date.now()}`,
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

    // 回滾快照
    const originalTags = JSON.parse(JSON.stringify(tags))
    const originalBooks = JSON.parse(JSON.stringify(await loadBooks()))

    try {
      // Step 1: 從所有書籍移除引用
      const books = await loadBooks()
      for (const book of books) {
        if (book.tagIds && book.tagIds.includes(tagId)) {
          book.tagIds = book.tagIds.filter(tid => tid !== tagId)
        }
      }
      await saveBooksWrapper(books)

      // Step 2: 刪除 tag
      tags.splice(tagIndex, 1)
      await saveToStorage({ [STORAGE_KEYS.TAGS]: tags })

      return { success: true }
    } catch (err) {
      // 回滾
      await saveToStorage({ [STORAGE_KEYS.TAGS]: originalTags })
      await saveBooksWrapper(originalBooks)
      return { success: false, error: 'rollback', cause: err.message }
    }
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
  await saveToStorage({ [STORAGE_KEYS.SCHEMA_VERSION]: '3.0.0' })
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

  // 常數（供外部使用）
  STORAGE_KEYS,
  MAX_STORAGE_SIZE,
  QUOTA_THRESHOLDS
}

module.exports = TagStorageAdapter
