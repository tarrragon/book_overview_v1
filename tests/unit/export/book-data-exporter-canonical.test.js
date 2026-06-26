/**
 * BookDataExporter canonical（book-interchange-v1 v3）匯出測試
 *
 * 範圍（ticket 0.19.0-W4-031.2.1）：
 * - canonical root 組裝（spec §3：format / formatVersion / metadata / books / tagTree）
 * - 逐書 everything-as-tags 映射（spec §4，消費 foundation mapV1BookToCanonical write 方向）
 * - tagTree 聚合（spec §6，消費 foundation buildTagTree）
 * - metadata.totalBooks 交叉驗證
 * - cover 物件化（單字串→original）、progress 物件化（單數字→percentage）
 * - round-trip：canonical → mapCanonicalToV1Book → 內部 v2，固定欄位/狀態還原一致
 * - v2 路徑（formatVersion === '2.0.0'）回歸：canonical 分支不影響既有 v2 行為
 *
 * 註：本檔為功能正確性測試，不含計時/精度斷言（test-assertion-design-rules）。
 */

'use strict'

const BookDataExporter = require('src/export/book-data-exporter')
const {
  mapCanonicalToV1Book
} = require('src/export/book-interchange-v1-adapter')

// Extension 內部 v2 book model（mapV1BookToCanonical 的輸入型別）
const mockBooksV2 = [
  {
    id: 'book-001',
    title: '挪威的森林',
    authors: ['村上春樹', 'Haruki Murakami'],
    publisher: '時報出版',
    source: 'readmoo',
    identifiers: { isbn: '9789571234567' },
    readingStatus: 'reading',
    progress: 45.5,
    cover: 'https://readmoo.com/cover/book-001-full.jpg',
    tagIds: ['tag-gift', 'tag-friend'],
    createdAt: '2026-01-15T08:30:00.000Z',
    updatedAt: '2026-03-20T14:22:00.000Z'
  },
  {
    id: 'book-002',
    title: '原子習慣',
    authors: ['James Clear'],
    publisher: '方智出版社',
    source: 'readmoo',
    readingStatus: 'unread',
    progress: 0,
    cover: '',
    tagIds: []
  }
]

describe('BookDataExporter canonical（book-interchange-v1 v3）匯出', () => {
  let exporter

  beforeEach(() => {
    exporter = new BookDataExporter(mockBooksV2)
  })

  describe('root 結構（spec §3）', () => {
    test('產出 format / formatVersion / metadata / books / tagTree 五區段', () => {
      const result = JSON.parse(exporter.exportToJSON({ formatVersion: '3.0.0' }))

      expect(result.format).toBe('book-interchange-v1')
      expect(result.formatVersion).toBe('3.0.0')
      expect(result).toHaveProperty('metadata')
      expect(Array.isArray(result.books)).toBe(true)
      expect(result).toHaveProperty('tagTree')
    })

    test('metadata 含 exportedAt / sourceApp / totalBooks，且 totalBooks 與 books 長度交叉一致', () => {
      const result = JSON.parse(exporter.exportToJSON({ formatVersion: '3.0.0' }))

      expect(typeof result.metadata.exportedAt).toBe('string')
      expect(result.metadata.sourceApp).toBe('book-overview')
      expect(result.metadata.totalBooks).toBe(mockBooksV2.length)
      expect(result.metadata.totalBooks).toBe(result.books.length)
    })

    test('options.metadata 可覆蓋/擴充預設 metadata', () => {
      const result = JSON.parse(exporter.exportToJSON({
        formatVersion: '3.0.0',
        metadata: { sourceApp: 'custom-source', note: 'manual' }
      }))

      expect(result.metadata.sourceApp).toBe('custom-source')
      expect(result.metadata.note).toBe('manual')
      // totalBooks 由匯出書數推導，仍應與 books 長度一致
      expect(result.metadata.totalBooks).toBe(result.books.length)
    })

    test('非物件書項被過濾，totalBooks 反映實際匯出書數', () => {
      const dirty = new BookDataExporter([
        mockBooksV2[0],
        null,
        undefined,
        'not-a-book',
        mockBooksV2[1]
      ])
      const result = JSON.parse(dirty.exportToJSON({ formatVersion: '3.0.0' }))

      expect(result.books).toHaveLength(2)
      expect(result.metadata.totalBooks).toBe(2)
    })
  })

  describe('book everything-as-tags 映射（spec §4，消費 foundation write 方向）', () => {
    test('固定欄位包成單元素 tag：authors→tags.author（多值各成 tag）、source→platform、publisher、isbn', () => {
      const result = JSON.parse(exporter.exportToJSON({ formatVersion: '3.0.0' }))
      const book = result.books[0]

      expect(book.tags.author.map(t => t.name)).toEqual(['村上春樹', 'Haruki Murakami'])
      expect(book.tags.platform.map(t => t.name)).toEqual(['readmoo'])
      expect(book.tags.publisher.map(t => t.name)).toEqual(['時報出版'])
      expect(book.tags.isbn.map(t => t.name)).toEqual(['9789571234567'])
      expect(book.tags.custom.map(t => t.id)).toEqual(['tag-gift', 'tag-friend'])
    })

    test('readingStatus 單選 tag 經 §7 正規化（unread→not_started、reading→reading）', () => {
      const result = JSON.parse(exporter.exportToJSON({ formatVersion: '3.0.0' }))

      expect(result.books[0].tags.readingStatus[0].name).toBe('reading')
      expect(result.books[1].tags.readingStatus[0].name).toBe('not_started')
    })

    test('cover 單字串物件化為 {original}；空字串 cover → 空物件', () => {
      const result = JSON.parse(exporter.exportToJSON({ formatVersion: '3.0.0' }))

      expect(result.books[0].cover).toEqual({
        original: 'https://readmoo.com/cover/book-001-full.jpg'
      })
      expect(result.books[1].cover).toEqual({})
    })

    test('progress 單數字物件化為 {percentage}', () => {
      const result = JSON.parse(exporter.exportToJSON({ formatVersion: '3.0.0' }))

      expect(result.books[0].progress).toEqual({ percentage: 45.5 })
      expect(result.books[1].progress).toEqual({ percentage: 0 })
    })

    test('id 保留禁重生；createdAt/updatedAt carry', () => {
      const result = JSON.parse(exporter.exportToJSON({ formatVersion: '3.0.0' }))

      expect(result.books[0].id).toBe('book-001')
      expect(result.books[0].createdAt).toBe('2026-01-15T08:30:00.000Z')
      expect(result.books[0].updatedAt).toBe('2026-03-20T14:22:00.000Z')
    })
  })

  describe('tagTree 聚合（spec §6，消費 foundation buildTagTree）', () => {
    test('tagTree 含 ccl / custom 兩鍵', () => {
      const result = JSON.parse(exporter.exportToJSON({ formatVersion: '3.0.0' }))

      expect(result.tagTree).toHaveProperty('ccl')
      expect(result.tagTree).toHaveProperty('custom')
      expect(Array.isArray(result.tagTree.ccl)).toBe(true)
      expect(Array.isArray(result.tagTree.custom)).toBe(true)
    })

    test('custom tagIds 經 book 級映射後由 buildTagTree 聚合為扁平節點（locked:false）', () => {
      const result = JSON.parse(exporter.exportToJSON({ formatVersion: '3.0.0' }))

      const customIds = result.tagTree.custom.map(n => n.id)
      // 兩本書合計 tagIds：tag-gift / tag-friend，去重後出現於 custom 樹
      expect(customIds).toEqual(expect.arrayContaining(['tag-gift', 'tag-friend']))
      result.tagTree.custom.forEach(node => {
        expect(node.locked).toBe(false)
      })
    })
  })

  describe('round-trip（canonical → 內部 v2 還原一致）', () => {
    test('canonical book 經 mapCanonicalToV1Book 還原固定欄位與狀態', () => {
      const result = JSON.parse(exporter.exportToJSON({ formatVersion: '3.0.0' }))
      const restored = mapCanonicalToV1Book(result.books[0])

      expect(restored.id).toBe('book-001')
      expect(restored.title).toBe('挪威的森林')
      expect(restored.authors).toEqual(['村上春樹', 'Haruki Murakami'])
      expect(restored.source).toBe('readmoo')
      expect(restored.publisher).toBe('時報出版')
      expect(restored.identifiers.isbn).toBe('9789571234567')
      expect(restored.readingStatus).toBe('reading') // §7 逆正規化
      expect(restored.cover).toBe('https://readmoo.com/cover/book-001-full.jpg')
      expect(restored.progress).toBe(45.5)
      expect(restored.tagIds).toEqual(['tag-gift', 'tag-friend'])
    })

    test('全書集 round-trip：每本還原後 id 與 readingStatus 對齊原始輸入', () => {
      const result = JSON.parse(exporter.exportToJSON({ formatVersion: '3.0.0' }))

      const restored = result.books.map(mapCanonicalToV1Book)
      expect(restored.map(b => b.id)).toEqual(['book-001', 'book-002'])
      // book-002 原 unread → canonical not_started → 還原 unread
      expect(restored[1].readingStatus).toBe('unread')
    })
  })

  describe('pretty 控制', () => {
    test('pretty:false 產出無換行縮排的緊湊 JSON', () => {
      const compact = exporter.exportToJSON({ formatVersion: '3.0.0', pretty: false })
      const pretty = exporter.exportToJSON({ formatVersion: '3.0.0', pretty: true })

      expect(compact).not.toContain('\n')
      expect(pretty).toContain('\n')
      // 兩者解析後結構等價
      expect(JSON.parse(compact).format).toBe(JSON.parse(pretty).format)
    })
  })

  describe('v2 路徑回歸（canonical 分支不影響既有 v2 行為）', () => {
    test('formatVersion === 2.0.0 仍走 v2 路徑（無 format 鍵、有 tagCategories/tags 區段）', () => {
      const result = JSON.parse(exporter.exportToJSON({
        formatVersion: '2.0.0',
        tagCategories: [],
        tags: []
      }))

      expect(result).not.toHaveProperty('format')
      expect(result.metadata.formatVersion).toBe('2.0.0')
      expect(result).toHaveProperty('tagCategories')
      expect(result).toHaveProperty('tags')
    })

    test('無 formatVersion 時走 v1 預設路徑（直接序列化 books 陣列）', () => {
      const result = JSON.parse(exporter.exportToJSON())

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(mockBooksV2.length)
    })
  })
})
