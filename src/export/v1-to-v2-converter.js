'use strict'

const BookSchemaV2 = require('../data-management/BookSchemaV2')
const { assertBookHasIdTitle } = require('./book-validation-helpers')
const { COLORS } = require('../core/design-system/colors.js')
const {
  normalizeReadingStatusFromCanonical
} = require('./book-interchange-v1-adapter')

const IMPORT_CATEGORY_ID = 'cat_imported'
const IMPORT_CATEGORY_NAME = '匯入分類'

// 內部 v2 readingStatus 合法值（V1 命名，APP legacy 無損匯入用以判斷是否需逆正規化）
const V2_READING_STATUS_VALUES = ['unread', 'queued', 'reading', 'finished', 'abandoned', 'reference']

// APP legacy fixed-field（v0.31.x）已知頂層欄位白名單；其餘未知欄位入 _passthrough（spec §9，禁 strip）
const APP_LEGACY_KNOWN_FIELDS = new Set([
  'id', 'title', 'author', 'authors', 'publisher', 'source', 'platform',
  'isbn', 'identifiers', 'coverImageUrl', 'cover', 'progress', 'progressInfo',
  'readingStatus', 'status', 'reading_status', 'importance', 'importanceLevel',
  'ccl', 'tags', 'tagIds', 'createdAt', 'updatedAt', 'crossPlatformId',
  'dataFingerprint', 'activeLoan', 'description', 'series', 'language', 'alias'
])

/**
 * 將單本 v1 書籍轉換為 v2 格式
 *
 * @param {Object} v1Book - v1 格式書籍物件
 * @param {string} [importTimestamp] - 匯入時間
 * @returns {Object} v2 格式書籍物件
 */
function convertV1ToV2Book (v1Book, importTimestamp) {
  assertBookHasIdTitle(v1Book)

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
 * W1-057 timestamp 一致化：tag id 中的 tsMs 與 createdAt/updatedAt 的 ISO timestamp
 * 必須源自單一時間取值，避免「同次 conversion 產生兩個 timestamp」的設計 bug
 * （違反業務語意一致性，並導致下游測試出現 ms-level race flaky）。
 *
 * 實作策略：
 * - 若 caller 傳入 `timestamp`（ISO 字串），用 `Date.parse()` 解出 `tsMs`，
 *   保證 tsMs 與 ts 源自同一時刻。
 * - 若 caller 未傳入，內部一次取 `Date.now()` 並衍生 ISO 字串，避免兩次取值。
 *
 * @param {string[]} categories - 不重複的 category 名稱陣列
 * @param {string} [timestamp] - 建立時間（ISO 字串），未傳入時內部統一取值
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

  // W1-057：單次時間取值 + 雙向衍生，保證 ts 與 tsMs 同源
  // W1-078：Date.parse NaN fallback 完備化——當 caller 傳入無效 timestamp 字串時，
  // tsMs 回退至 Date.now() 後必須重新衍生 ts，避免保留原始無效字串（如 'invalid-date'）
  // 而導致 tag id 中的 ms 與 createdAt/updatedAt 指向不同時刻（W1-057 雙時間問題變體）
  let ts
  let tsMs
  if (timestamp) {
    const parsedMs = Date.parse(timestamp)
    if (Number.isFinite(parsedMs)) {
      ts = timestamp
      tsMs = parsedMs
    } else {
      // Date.parse 失敗（NaN）時：tsMs 與 ts 一起回退並從同一 tsMs 衍生，保證同源
      tsMs = Date.now()
      ts = new Date(tsMs).toISOString()
    }
  } else {
    tsMs = Date.now()
    ts = new Date(tsMs).toISOString()
  }

  const tagCategory = {
    id: IMPORT_CATEGORY_ID,
    name: IMPORT_CATEGORY_NAME,
    color: COLORS.tagDefault,
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
      source: 'book-overview',
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

// =============================================================================
// APP legacy（book_overview_app fixed-field, v0.31.x backup_info/export_info wrapper）
// 無損匯入分支（止血核心，spec §8 來源 3 / §11 映射總表）
//
// 根因：APP backup 格式 {backup_info|export_info, books:[]} 無 metadata.formatVersion，
// 舊 detector 誤判 flat v1 → 跑 lossy convertV1ToV2Book（只取 id/title/author 單值/cover/category）
// → 丟失 APP 的 tags/readingStatus/多值/importance/ccl。本分支補無損轉換。
//
// 設計原則（C1 雙向無損）：
// - readingStatus 不重推（不依 progress 衍生）——carry APP 原值，canonical 命名逆正規化為 V1 命名，
//   未知值記 _passthrough.readingStatusRaw（禁臆造）。
// - coverImageUrl → cover；多值欄位（多 publisher/platform/isbn）入 _passthrough.tags 供 write 端重建。
// - importance/ccl/description/series/language/alias 等 V1 無對應固定欄位者 carry+display 入 _passthrough.tags。
// - 未知頂層欄位（APP_LEGACY_KNOWN_FIELDS 以外）入 _passthrough（spec §9，禁 strip）。
// - id 保留禁重生（spec §8 D5）。
// =============================================================================

/**
 * 將單本 APP legacy book 無損轉換為內部 v2 book model。
 *
 * 產出的內部 v2 book 額外攜帶 _passthrough（多值/carry/未知欄位）與 extensions，
 * 使後續 round-trip（Ext→canonical→APP）不丟失 APP 專屬資訊（C1）。
 *
 * @param {Object} appBook - APP legacy fixed-field book
 * @param {string} [importTimestamp] - 匯入時間（更新 updatedAt）
 * @returns {Object} 內部 v2 book model（含 _passthrough）
 * @throws {BookValidationError} 非 object 或缺 id/title
 */
function convertAppLegacyToV2Book (appBook, importTimestamp) {
  assertBookHasIdTitle(appBook)

  const timestamp = importTimestamp || new Date().toISOString()
  const passthrough = {}

  const v2Book = {
    id: appBook.id, // 保留禁重生（spec §8 D5）
    title: appBook.title,
    authors: normalizeAppAuthors(appBook),
    publisher: firstMultiValue(appBook.publisher, passthrough, 'publisher'),
    progress: normalizeAppProgress(appBook),
    cover: appBook.coverImageUrl || appBook.cover || '',
    tagIds: normalizeAppTagIds(appBook),
    isManualStatus: false,
    extractedAt: appBook.createdAt || timestamp,
    updatedAt: appBook.updatedAt || timestamp,
    source: firstMultiValue(appBook.source || appBook.platform, passthrough, 'platform')
  }

  // readingStatus 不重推：carry APP 原值（canonical 命名逆正規化為 V1 命名，未知記 passthrough）
  applyAppReadingStatus(v2Book, appBook, passthrough)

  // identifiers.isbn 收斂（多值入 passthrough）
  applyAppIsbn(v2Book, appBook, passthrough)

  // importance/ccl/description/series/language/alias 等 carry+display 入 _passthrough.tags（V1 無對應固定欄位）
  carryAppTags(appBook, passthrough)

  // 未知頂層欄位保留（spec §9，禁 strip）
  carryUnknownFields(appBook, passthrough)

  // extensions：APP 專屬已知欄位袋（spec §9，對方保留）
  if (appBook.activeLoan !== undefined) passthrough.activeLoan = appBook.activeLoan
  if (appBook.crossPlatformId !== undefined) passthrough.crossPlatformId = appBook.crossPlatformId
  if (appBook.dataFingerprint !== undefined) passthrough.dataFingerprint = appBook.dataFingerprint

  if (Object.keys(passthrough).length > 0) {
    v2Book._passthrough = passthrough
  }

  return v2Book
}

// APP author：authors[] 優先，否則 author(單值) 包陣列，皆無則 []
function normalizeAppAuthors (appBook) {
  if (Array.isArray(appBook.authors)) {
    return appBook.authors.filter(a => typeof a === 'string' && a !== '')
  }
  if (typeof appBook.author === 'string' && appBook.author !== '') {
    return [appBook.author]
  }
  return []
}

// 多值欄位收斂：首值入固定欄位，length>1 時完整陣列入 _passthrough.tags（供 write 重建，C1）
function firstMultiValue (value, passthrough, passthroughKey) {
  if (Array.isArray(value)) {
    if (value.length === 0) return ''
    if (value.length > 1) {
      passthrough.tags = passthrough.tags || {}
      passthrough.tags[passthroughKey] = value.map(toTagNode(passthroughKey))
    }
    return tagValueToName(value[0])
  }
  if (value === undefined || value === null) return ''
  return tagValueToName(value)
}

// APP tag 值可能為字串或 {id,name}；統一取 name
function tagValueToName (v) {
  if (v && typeof v === 'object') return v.name !== undefined ? v.name : ''
  return v
}

// 將 APP 多值原始值轉為 canonical tag node（{id,name}），供 write 端還原完整多值 tag
function toTagNode (prefix) {
  return (v) => {
    if (v && typeof v === 'object' && v.id !== undefined) return v
    const name = tagValueToName(v)
    return { id: `${prefix}-${name}`, name }
  }
}

// APP progress：物件取 percentage，數字直用，皆無 → 0（不重推狀態）
function normalizeAppProgress (appBook) {
  if (typeof appBook.progress === 'number') {
    return Math.max(0, Math.min(100, appBook.progress))
  }
  if (appBook.progress && typeof appBook.progress === 'object' &&
      typeof appBook.progress.percentage === 'number') {
    return Math.max(0, Math.min(100, appBook.progress.percentage))
  }
  return 0
}

// APP tagIds / tags.custom → 內部 v2 tagIds 圖
function normalizeAppTagIds (appBook) {
  if (Array.isArray(appBook.tagIds)) {
    return appBook.tagIds.filter(t => typeof t === 'string' && t !== '')
  }
  if (appBook.tags && typeof appBook.tags === 'object' && Array.isArray(appBook.tags.custom)) {
    return appBook.tags.custom.map(node => (node && node.id !== undefined ? node.id : node))
      .filter(id => typeof id === 'string' && id !== '')
  }
  return []
}

// readingStatus 不重推：APP 原值若為 canonical 命名（not_started 等）逆正規化為 V1，
// 若已是 V1 合法值直用，未知值記 _passthrough.readingStatusRaw（禁臆造）
function applyAppReadingStatus (v2Book, appBook, passthrough) {
  const raw = appBook.readingStatus || appBook.reading_status || appBook.status
  if (raw === undefined || raw === null || raw === '') return // 不臆造

  if (V2_READING_STATUS_VALUES.includes(raw)) {
    v2Book.readingStatus = raw
    return
  }
  const fromCanonical = normalizeReadingStatusFromCanonical(raw)
  if (fromCanonical !== null) {
    v2Book.readingStatus = fromCanonical
    return
  }
  // 未知態：保留原值不丟失（C1），不臆造 readingStatus
  passthrough.readingStatusRaw = raw
}

// identifiers.isbn 收斂（多值入 _passthrough.tags.isbn）
function applyAppIsbn (v2Book, appBook, passthrough) {
  const isbnSource = appBook.isbn !== undefined
    ? appBook.isbn
    : (appBook.identifiers && appBook.identifiers.isbn)
  if (isbnSource === undefined || isbnSource === null) return
  const name = firstMultiValue(isbnSource, passthrough, 'isbn')
  if (name === '') return
  v2Book.identifiers = v2Book.identifiers || {}
  v2Book.identifiers.isbn = name
}

// importance/ccl/description/series/language/alias：carry+display 入 _passthrough.tags（V1 無固定欄位）
function carryAppTags (appBook, passthrough) {
  const tagCarry = {}

  // importanceLevel(1-7) → imp-N tag node（spec §5.1）；或 importance 物件/陣列直 carry
  const importanceNodes = normalizeImportance(appBook)
  if (importanceNodes.length > 0) tagCarry.importance = importanceNodes

  // ccl 單選 tag node（含 path）
  const cclNodes = normalizeTagCategory(appBook.ccl)
  if (cclNodes.length > 0) tagCarry.ccl = cclNodes

  // 其餘 APP-only tag 類別直 carry
  for (const cat of ['description', 'series', 'language', 'alias']) {
    const nodes = normalizeTagCategory(appBook[cat])
    if (nodes.length > 0) tagCarry[cat] = nodes
  }

  // APP tags 物件內的同類別（everything-as-tags 已分組）合併 carry
  if (appBook.tags && typeof appBook.tags === 'object') {
    for (const cat of ['importance', 'ccl', 'description', 'series', 'language', 'alias']) {
      if (Array.isArray(appBook.tags[cat]) && appBook.tags[cat].length > 0 && !tagCarry[cat]) {
        tagCarry[cat] = appBook.tags[cat]
      }
    }
  }

  if (Object.keys(tagCarry).length > 0) {
    passthrough.tags = passthrough.tags || {}
    Object.assign(passthrough.tags, tagCarry)
  }
}

// importanceLevel(1-7) → [{id:imp-N, name:imp-N}]；importance 物件/陣列 → tag node 陣列
function normalizeImportance (appBook) {
  if (typeof appBook.importanceLevel === 'number' &&
      appBook.importanceLevel >= 1 && appBook.importanceLevel <= 7) {
    const id = `imp-${appBook.importanceLevel}`
    return [{ id, name: id }]
  }
  return normalizeTagCategory(appBook.importance)
}

// 將 APP tag 類別值（字串 / {id,name} / 陣列）正規化為 tag node 陣列
function normalizeTagCategory (value) {
  if (value === undefined || value === null || value === '') return []
  const arr = Array.isArray(value) ? value : [value]
  return arr
    .filter(v => v !== undefined && v !== null && v !== '')
    .map(v => {
      if (v && typeof v === 'object') return v
      return { id: String(v), name: String(v) }
    })
}

// 未知頂層欄位（白名單外）保留（spec §9，禁 strip）
function carryUnknownFields (appBook, passthrough) {
  for (const key of Object.keys(appBook)) {
    if (!APP_LEGACY_KNOWN_FIELDS.has(key) && key !== '_passthrough') {
      passthrough[key] = appBook[key]
    }
  }
  // APP 自身若已帶 _passthrough，合併保留
  if (appBook._passthrough && typeof appBook._passthrough === 'object') {
    Object.assign(passthrough, appBook._passthrough)
  }
}

/**
 * 完整的 APP legacy → 內部 v2 資料轉換（含 dedup）。
 *
 * 接受 {backup_info|export_info, books:[]} wrapper 或裸 books 陣列。
 * dedup（spec §8 C5）：以 id 為主鍵；crossPlatformId / dataFingerprint 為軟連結輔助，
 * 不取代 id。同一集合內重複 id（或軟連結相同）保留首見、後者捨棄。
 *
 * @param {Object|Array} appData - APP legacy 匯入資料
 * @returns {{ metadata: Object, tagCategories: Array, tags: Array, books: Array }}
 */
function convertAppLegacyToV2Data (appData) {
  const timestamp = new Date().toISOString()

  let appBooks
  if (Array.isArray(appData)) {
    appBooks = appData
  } else if (appData && Array.isArray(appData.books)) {
    appBooks = appData.books
  } else {
    appBooks = []
  }

  const books = []
  for (const appBook of appBooks) {
    try {
      books.push(convertAppLegacyToV2Book(appBook, timestamp))
    } catch (_e) {
      // 跳過轉換失敗的書籍（缺 id/title），與 convertV1ToV2Data 一致
    }
  }

  const deduped = dedupBooks(books)

  return {
    metadata: {
      formatVersion: '2.0.0',
      exportDate: timestamp,
      source: 'book_overview_app',
      schemaVersion: BookSchemaV2.SCHEMA_VERSION,
      totalBooks: deduped.length,
      totalTags: 0,
      totalTagCategories: 0
    },
    tagCategories: [],
    tags: [],
    books: deduped
  }
}

/**
 * 以 id 為主鍵去重，crossPlatformId / dataFingerprint 為軟連結輔助（spec §8 C5）。
 * 保留首見，後續重複捨棄；id 為唯一最終裁決（軟連結不取代 id）。
 *
 * @param {Array} books - 內部 v2 book model 陣列（_passthrough 可含軟連結）
 * @returns {Array} 去重後陣列（保序）
 */
function dedupBooks (books) {
  const seenIds = new Set()
  const seenSoftLinks = new Set()
  const result = []

  for (const book of books) {
    const id = book.id
    if (seenIds.has(id)) continue // id 主鍵命中 → 重複

    const softLinks = collectSoftLinks(book)
    if (softLinks.some(link => seenSoftLinks.has(link))) continue // 軟連結命中 → 重複

    seenIds.add(id)
    softLinks.forEach(link => seenSoftLinks.add(link))
    result.push(book)
  }

  return result
}

// 收集一本書的軟連結鍵（crossPlatformId / dataFingerprint，含 _passthrough 內者）
function collectSoftLinks (book) {
  const links = []
  const pt = book._passthrough || {}
  const cpid = book.crossPlatformId !== undefined ? book.crossPlatformId : pt.crossPlatformId
  const fp = book.dataFingerprint !== undefined ? book.dataFingerprint : pt.dataFingerprint
  if (cpid !== undefined && cpid !== null) links.push(`cpid:${cpid}`)
  if (fp !== undefined && fp !== null) links.push(`fp:${fp}`)
  return links
}

module.exports = {
  convertV1ToV2Book,
  convertV1CategoryToTag,
  convertV1ToV2Data,
  convertAppLegacyToV2Book,
  convertAppLegacyToV2Data,
  dedupBooks
}
