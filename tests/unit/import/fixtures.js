/**
 * JSON 匯入測試共用資料工廠（Q11 資料純淨性：各工廠只產對應版本欄位，無殘留舊版欄位）。
 *
 * 分流條件對齊 detectInterchangeSource：
 *   canonical   → format: 'book-interchange-v1'
 *   v2          → metadata.formatVersion 以 '2.' 開頭
 *   app-legacy  → backup_info + books 陣列
 *   v1          → 純陣列 或 { books } 無版本標記
 */

function createCanonicalBook (id, title) {
  return {
    id,
    title: title || `Book ${id}`,
    tags: {
      custom: [],
      ccl: [],
      author: [{ id: `a-${id}`, name: 'Author', path: 'Author' }]
    }
  }
}

function createCanonicalJSON ({ bookCount = 3, exportedAt = '2026-06-20T10:00:00Z', sourceApp = 'book_overview_app', totalBooks } = {}) {
  const books = []
  for (let i = 1; i <= bookCount; i++) {
    books.push(createCanonicalBook(`canon-${i}`, `Canonical Book ${i}`))
  }
  return JSON.stringify({
    format: 'book-interchange-v1',
    metadata: {
      exportedAt,
      sourceApp,
      totalBooks: totalBooks !== undefined ? totalBooks : bookCount
    },
    books
  })
}

function createV2JSON ({ bookCount = 2 } = {}) {
  const books = []
  for (let i = 1; i <= bookCount; i++) {
    books.push({ id: `v2-${i}`, title: `V2 Book ${i}`, updatedAt: '2026-06-19T00:00:00Z', tagIds: [] })
  }
  return JSON.stringify({
    metadata: { formatVersion: '2.0.0' },
    books,
    tags: [],
    tagCategories: []
  })
}

function createV1JSON ({ bookCount = 4 } = {}) {
  const books = []
  for (let i = 1; i <= bookCount; i++) {
    books.push({ id: `v1-${i}`, title: `V1 Book ${i}` })
  }
  return JSON.stringify({ books })
}

function createAppLegacyJSON ({ bookCount = 1 } = {}) {
  const books = []
  for (let i = 1; i <= bookCount; i++) {
    books.push({ id: `app-${i}`, title: `App Book ${i}`, updatedAt: '2026-06-20T00:00:00Z' })
  }
  return JSON.stringify({
    backup_info: { version: '1.0', exportedBy: 'book_overview_app' },
    books
  })
}

module.exports = {
  createCanonicalBook,
  createCanonicalJSON,
  createV2JSON,
  createV1JSON,
  createAppLegacyJSON
}
