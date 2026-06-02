/**
 * ContentParser 四來源接線單元測試（0.19.0-W4-031.2.2）
 *
 * 測試範圍（spec §8 四來源 + §9 passthrough）：
 * - canonical 來源：經 mapCanonicalToV1Book read 映射 + dedup
 * - app-legacy 來源：經 convertAppLegacyToV2Data 無損止血（不丟 tags/readingStatus）
 * - v1 / v2 既有來源：回歸不變（向後相容，B5）
 * - DI 接點：注入 detectInterchangeSource / convertAppLegacyToV2Data / mapCanonicalToV1Book / dedupBooks
 *
 * 測試策略（Sociable Unit）：預設真實依賴；DI 接點以 stub 驗證注入生效。
 * 權威 SSOT：docs/spec/book-interchange-v1.md v3.0.0（§8/§9）。
 *
 * @jest-environment jsdom
 */

const { ContentParser } = require('src/overview/import/content-parser')

describe('ContentParser — 四來源接線（W4-031.2.2）', () => {
  let consoleWarnSpy
  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  // ---- canonical 來源 ----
  describe('canonical（book-interchange-v1）來源', () => {
    function makeCanonicalRoot (books) {
      return {
        format: 'book-interchange-v1',
        formatVersion: '3.0.0',
        books
      }
    }

    function makeCanonicalBook (overrides = {}) {
      return {
        id: '210327003000101',
        title: '挪威的森林',
        cover: { original: 'https://x/full.jpg' },
        progress: { percentage: 45.5 },
        tags: {
          author: [{ id: 'a1', name: '村上春樹' }],
          platform: [{ id: 'pl1', name: 'readmoo' }],
          readingStatus: [{ id: 'rs-reading', name: 'reading' }]
        },
        ...overrides
      }
    }

    test('canonical 來源逐本 read 映射為內部 v2 book（read 方向）', () => {
      const parser = new ContentParser()
      const result = parser.parse(JSON.stringify(makeCanonicalRoot([makeCanonicalBook()])), 'json')
      expect(result.books).toHaveLength(1)
      const book = result.books[0]
      expect(book.id).toBe('210327003000101')
      expect(book.title).toBe('挪威的森林')
      expect(book.authors).toEqual(['村上春樹'])
      // readingStatus 逆正規化（§7）：reading → reading
      expect(book.readingStatus).toBe('reading')
      // cover.original → cover(str)
      expect(book.cover).toBe('https://x/full.jpg')
    })

    test('readingStatus 逆正規化：not_started → unread（§7）', () => {
      const parser = new ContentParser()
      const book = makeCanonicalBook({
        tags: { readingStatus: [{ id: 'rs-not_started', name: 'not_started' }] }
      })
      const result = parser.parse(JSON.stringify(makeCanonicalRoot([book])), 'json')
      expect(result.books[0].readingStatus).toBe('unread')
    })

    test('canonical 來源 dedup：相同 id 保留首見（spec §8）', () => {
      const parser = new ContentParser()
      const root = makeCanonicalRoot([
        makeCanonicalBook({ id: 'dup', title: 'A' }),
        makeCanonicalBook({ id: 'dup', title: 'B' })
      ])
      const result = parser.parse(JSON.stringify(root), 'json')
      expect(result.books).toHaveLength(1)
      expect(result.books[0].title).toBe('A')
    })

    test('canonical 來源缺 id/title 書籍跳過', () => {
      const parser = new ContentParser()
      const root = makeCanonicalRoot([makeCanonicalBook(), { title: '無 id' }])
      const result = parser.parse(JSON.stringify(root), 'json')
      expect(result.books).toHaveLength(1)
    })

    test('INV-1：canonical 來源三欄位恆為陣列', () => {
      const parser = new ContentParser()
      const result = parser.parse(JSON.stringify(makeCanonicalRoot([makeCanonicalBook()])), 'json')
      expect(Array.isArray(result.books)).toBe(true)
      expect(Array.isArray(result.tagCategories)).toBe(true)
      expect(Array.isArray(result.tags)).toBe(true)
    })
  })

  // ---- app-legacy 來源（止血核心）----
  describe('app-legacy（backup_info wrapper）來源 — 無損止血', () => {
    function makeAppBackup (books) {
      return {
        backup_info: { app: 'book_overview_app', version: '1.0.0' },
        books
      }
    }

    function makeAppBook (overrides = {}) {
      return {
        id: 'book_1700000000',
        title: '挪威的森林',
        authors: ['村上春樹', 'Haruki Murakami'],
        coverImageUrl: 'https://x/cover.jpg',
        readingStatus: 'reading',
        progress: 45.5,
        tagIds: ['c2'],
        importanceLevel: 4,
        ...overrides
      }
    }

    test('app-legacy 不再誤判 v1 lossy 轉換：tags/readingStatus 不丟失', () => {
      const parser = new ContentParser()
      const result = parser.parse(JSON.stringify(makeAppBackup([makeAppBook()])), 'json')
      expect(result.books).toHaveLength(1)
      const book = result.books[0]
      // 止血斷言：readingStatus 保留不重推
      expect(book.readingStatus).toBe('reading')
      // 止血斷言：tagIds 不丟失
      expect(book.tagIds).toEqual(['c2'])
      // coverImageUrl → cover
      expect(book.cover).toBe('https://x/cover.jpg')
      // 多 author 全保留
      expect(book.authors).toEqual(['村上春樹', 'Haruki Murakami'])
      // importance carry 入 _passthrough（不丟失）
      expect(book._passthrough.tags.importance).toEqual([{ id: 'imp-4', name: 'imp-4' }])
    })

    test('export_info wrapper 亦辨識為 app-legacy', () => {
      const parser = new ContentParser()
      const data = {
        export_info: { app: 'book_overview_app' },
        books: [makeAppBook()]
      }
      const result = parser.parse(JSON.stringify(data), 'json')
      expect(result.books).toHaveLength(1)
      expect(result.books[0].readingStatus).toBe('reading')
    })

    test('readingStatus 不重推：progress=0 仍保 reading', () => {
      const parser = new ContentParser()
      const result = parser.parse(
        JSON.stringify(makeAppBackup([makeAppBook({ readingStatus: 'reading', progress: 0 })])),
        'json'
      )
      expect(result.books[0].readingStatus).toBe('reading')
    })

    test('INV-1：app-legacy 來源三欄位恆為陣列', () => {
      const parser = new ContentParser()
      const result = parser.parse(JSON.stringify(makeAppBackup([makeAppBook()])), 'json')
      expect(Array.isArray(result.books)).toBe(true)
      expect(Array.isArray(result.tagCategories)).toBe(true)
      expect(Array.isArray(result.tags)).toBe(true)
    })
  })

  // ---- 既有來源回歸（向後相容）----
  describe('既有 v1/v2 來源回歸（向後相容，B5）', () => {
    test('flat v1（純陣列）仍走 convertV1ToV2Data', () => {
      const parser = new ContentParser()
      const v1Books = [{ id: 'v1a', title: '書一', author: '作者', progress: 50 }]
      const result = parser.parse(JSON.stringify(v1Books), 'json')
      expect(result.books).toHaveLength(1)
      expect(result.books[0].id).toBe('v1a')
      expect(result.books[0].authors).toEqual(['作者'])
    })

    test('v2（metadata.formatVersion 2.x）仍取 data.books', () => {
      const parser = new ContentParser()
      const v2 = {
        metadata: { formatVersion: '2.0.0' },
        books: [{ id: 'v2a', title: '書二', readingStatus: 'finished' }],
        tagCategories: [],
        tags: []
      }
      const result = parser.parse(JSON.stringify(v2), 'json')
      expect(result.books).toHaveLength(1)
      expect(result.books[0].id).toBe('v2a')
    })

    test('空物件仍回空 ImportResult', () => {
      const parser = new ContentParser()
      const result = parser.parse('{}', 'json')
      expect(result.books).toEqual([])
    })

    test('無法辨識結構仍 throw VALIDATION_ERROR', () => {
      const parser = new ContentParser()
      expect(() => parser.parse(JSON.stringify({ foo: 'bar' }), 'json')).toThrow()
    })
  })

  // ---- DI 接點驗證 ----
  describe('DI 接點：四來源依賴可注入', () => {
    test('注入 detectInterchangeSource + convertAppLegacyToV2Data 生效', () => {
      const detectStub = jest.fn(() => 'app-legacy')
      const convertStub = jest.fn(() => ({
        books: [{ id: 'stub', title: 'Stub', cover: undefined }],
        tagCategories: [],
        tags: []
      }))
      const parser = new ContentParser({
        detectInterchangeSource: detectStub,
        convertAppLegacyToV2Data: convertStub
      })
      const result = parser.parse(JSON.stringify({ books: [{ id: 'x', title: 'y' }] }), 'json')
      expect(detectStub).toHaveBeenCalled()
      expect(convertStub).toHaveBeenCalled()
      expect(result.books[0].id).toBe('stub')
    })

    test('注入 detectInterchangeSource + mapCanonicalToV1Book + dedupBooks 生效（canonical 路徑）', () => {
      const detectStub = jest.fn(() => 'canonical')
      const mapStub = jest.fn((b) => ({ id: b.id, title: b.title, cover: undefined }))
      const dedupStub = jest.fn((books) => books)
      const parser = new ContentParser({
        detectInterchangeSource: detectStub,
        mapCanonicalToV1Book: mapStub,
        dedupBooks: dedupStub
      })
      const result = parser.parse(
        JSON.stringify({ format: 'book-interchange-v1', books: [{ id: 'c1', title: 'C' }] }),
        'json'
      )
      expect(detectStub).toHaveBeenCalled()
      expect(mapStub).toHaveBeenCalled()
      expect(dedupStub).toHaveBeenCalled()
      expect(result.books[0].id).toBe('c1')
    })
  })
})
