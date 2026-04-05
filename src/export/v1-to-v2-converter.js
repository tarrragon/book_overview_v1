'use strict'

const BookSchemaV2 = require('../data-management/BookSchemaV2')
const { BookValidationError } = require('../core/errors/BookValidationError')

const IMPORT_CATEGORY_ID = 'cat_imported'
const IMPORT_CATEGORY_NAME = '匯入分類'

/**
 * 將單本 v1 書籍轉換為 v2 格式
 *
 * @param {Object} v1Book - v1 格式書籍物件
 * @param {string} [importTimestamp] - 匯入時間
 * @returns {Object} v2 格式書籍物件
 */
function convertV1ToV2Book (v1Book, importTimestamp) {
  if (!v1Book || typeof v1Book !== 'object') {
    throw new BookValidationError(v1Book, [{ field: 'book', message: 'Input must be an object' }])
  }

  if (!v1Book.id || !v1Book.title) {
    const missing = []
    if (!v1Book.id) missing.push({ field: 'id', message: 'Required field missing' })
    if (!v1Book.title) missing.push({ field: 'title', message: 'Required field missing' })
    throw new BookValidationError(v1Book, missing)
  }

  const timestamp = importTimestamp || new Date().toISOString()
  const progress = Math.max(0, Math.min(100, BookSchemaV2.normalizeV1Progress(v1Book.progress)))

  const v2Book = {
    id: v1Book.id,
    title: v1Book.title,
    authors: (v1Book.author && typeof v1Book.author === 'string') ? [v1Book.author] : [],
    publisher: v1Book.publisher || '',
    readingStatus: BookSchemaV2.mapV1StatusToV2(v1Book),
    progress,
    type: v1Book.type || '',
    cover: v1Book.cover || '',
    tagIds: [],
    isManualStatus: false,
    extractedAt: v1Book.extractedAt || timestamp,
    updatedAt: timestamp,
    source: 'readmoo'
  }

  // 保留 category 供上層 convertV1CategoryToTag 使用
  if (v1Book.category && v1Book.category !== '') {
    v2Book._v1Category = v1Book.category
  }

  return v2Book
}

/**
 * 將 v1 category 字串集合轉換為 tag 結構
 *
 * @param {string[]} categories - 不重複的 category 名稱陣列
 * @param {string} [timestamp] - 建立時間
 * @returns {{ tagCategory: Object|null, tags: Object[], categoryToTagIdMap: Map }}
 */
function convertV1CategoryToTag (categories, timestamp) {
  if (!Array.isArray(categories)) {
    return { tagCategory: null, tags: [], categoryToTagIdMap: new Map() }
  }

  const validCategories = categories.filter(c => c && c !== '' && c !== '未分類')

  if (validCategories.length === 0) {
    return { tagCategory: null, tags: [], categoryToTagIdMap: new Map() }
  }

  const ts = timestamp || new Date().toISOString()
  const tsMs = Date.now()

  const tagCategory = {
    id: IMPORT_CATEGORY_ID,
    name: IMPORT_CATEGORY_NAME,
    color: '#808080',
    isSystem: false,
    sortOrder: 0,
    createdAt: ts,
    updatedAt: ts
  }

  const tags = []
  const categoryToTagIdMap = new Map()

  validCategories.forEach((categoryName, index) => {
    const tagId = 'tag_' + tsMs + '-' + String(index).padStart(3, '0')
    const tag = {
      id: tagId,
      name: categoryName,
      categoryId: IMPORT_CATEGORY_ID,
      isSystem: false,
      sortOrder: index,
      createdAt: ts,
      updatedAt: ts
    }
    tags.push(tag)
    categoryToTagIdMap.set(categoryName, tagId)
  })

  return { tagCategory, tags, categoryToTagIdMap }
}

/**
 * 完整的 v1 -> v2 資料轉換
 *
 * @param {Object|Array} v1Data - v1 格式匯入資料
 * @returns {Object} v2 interchange format
 */
function convertV1ToV2Data (v1Data) {
  const timestamp = new Date().toISOString()

  // 提取書籍陣列
  let v1Books
  if (Array.isArray(v1Data)) {
    v1Books = v1Data
  } else if (v1Data && Array.isArray(v1Data.books)) {
    v1Books = v1Data.books
  } else {
    v1Books = []
  }

  // 逐本轉換，失敗則跳過
  const books = []
  const allCategories = new Set()

  for (const v1Book of v1Books) {
    try {
      const v2Book = convertV1ToV2Book(v1Book, timestamp)
      books.push(v2Book)
      if (v2Book._v1Category) {
        allCategories.add(v2Book._v1Category)
      }
    } catch (_e) {
      // 跳過轉換失敗的書籍
    }
  }

  // 轉換 categories
  const { tagCategory, tags, categoryToTagIdMap } = convertV1CategoryToTag(
    Array.from(allCategories),
    timestamp
  )

  // 將 tagId 寫入書籍，並移除暫存欄位
  for (const book of books) {
    if (book._v1Category && categoryToTagIdMap.has(book._v1Category)) {
      book.tagIds = [categoryToTagIdMap.get(book._v1Category)]
    }
    delete book._v1Category
  }

  const tagCategories = tagCategory ? [tagCategory] : []

  return {
    metadata: {
      formatVersion: '2.0.0',
      exportDate: timestamp,
      source: 'readmoo-book-extractor',
      schemaVersion: BookSchemaV2.SCHEMA_VERSION,
      totalBooks: books.length,
      totalTags: tags.length,
      totalTagCategories: tagCategories.length
    },
    tagCategories,
    tags,
    books
  }
}

module.exports = { convertV1ToV2Book, convertV1CategoryToTag, convertV1ToV2Data }
