'use strict'

/**
 * book-interchange-v1-adapter 單元測試（Phase 3b-B，Group B/C/D 41 案例）
 *
 * 對應 ticket 0.19.0-W4-031.2.4 Phase 2 測試設計（sage-test-architect）。
 * 權威 SSOT：docs/spec/book-interchange-v1.md v3.0.0（§6/§7/§11）。
 * 全部 Layer 5 純函式單元測試，零 mock；round-trip 用 toEqual 值比對（無計時斷言）。
 */

const {
  mapV1BookToCanonical,
  mapCanonicalToV1Book,
  normalizeReadingStatusToCanonical,
  normalizeReadingStatusFromCanonical,
  buildTagTree
} = require('../../../src/export/book-interchange-v1-adapter')
const { BookValidationError } = require('../../../src/core/errors/BookValidationError')

// --- fixtures（各群組以本地 factory helper 建構，避免跨群組共享參考）---

function makeV1Book (overrides = {}) {
  return {
    id: 'b-001',
    title: '挪威的森林',
    authors: ['村上春樹'],
    source: 'readmoo',
    publisher: '時報出版',
    identifiers: { isbn: '9789571234567' },
    readingStatus: 'unread',
    tagIds: [],
    cover: 'https://x/full.jpg',
    progress: 45.5,
    ...overrides
  }
}

function makeCanonicalBook (overrides = {}) {
  return {
    id: 'b-001',
    title: '挪威的森林',
    tags: {
      author: [{ id: 'a1', name: '村上春樹' }],
      platform: [{ id: 'pl1', name: 'readmoo' }],
      publisher: [{ id: 'p1', name: '時報出版' }],
      isbn: [{ id: 'i1', name: '9789571234567' }],
      readingStatus: [{ id: 'rs-not_started', name: 'not_started' }]
    },
    ...overrides
  }
}

// =============================================================================
// Group B — write 映射（mapV1BookToCanonical）U6-U10 + B6-B10
// =============================================================================

describe('mapV1BookToCanonical (Group B — write 映射)', () => {
  test('B-U6: 多 author → tags.author 多元素', () => {
    const v1Book = makeV1Book({ authors: ['村上春樹', 'Haruki Murakami'] })
    expect(v1Book.id && v1Book.title).toBeTruthy()
    expect(v1Book.authors.length).toBe(2)

    const result = mapV1BookToCanonical(v1Book)
    expect(result.tags.author).toHaveLength(2)
    expect(result.tags.author[0]).toMatchObject({ name: '村上春樹' })
    expect(result.tags.author[1]).toMatchObject({ name: 'Haruki Murakami' })
    expect(result.tags.author[0]).toHaveProperty('id')
  })

  test('B-U7: source/publisher/isbn → 對應 tag 類別', () => {
    const v1Book = makeV1Book({
      source: 'readmoo',
      publisher: '時報出版',
      identifiers: { isbn: '9789571234567' }
    })
    const result = mapV1BookToCanonical(v1Book)
    expect(result.tags.platform[0].name).toBe('readmoo')
    expect(result.tags.publisher[0].name).toBe('時報出版')
    expect(result.tags.isbn[0].name).toBe('9789571234567')
  })

  test('B-U8: readingStatus enum → 單選 tag（§7 正規化 unread→not_started）', () => {
    const v1Book = makeV1Book({ readingStatus: 'unread' })
    expect(v1Book.readingStatus).toBe('unread')

    const result = mapV1BookToCanonical(v1Book)
    expect(result.tags.readingStatus).toHaveLength(1)
    expect(result.tags.readingStatus[0].name).toBe('not_started')
  })

  test('B-U9: tagIds 圖 → tags.custom', () => {
    const v1Book = makeV1Book({ tagIds: ['tag_xxx-001'] })
    const result = mapV1BookToCanonical(v1Book)
    expect(Array.isArray(result.tags.custom)).toBe(true)
    expect(result.tags.custom).toHaveLength(1)
    expect(result.tags.custom[0].id).toBe('tag_xxx-001')
  })

  test('B-U10: 固定欄位物件化 cover/progress', () => {
    const v1Book = makeV1Book({ cover: 'https://x/full.jpg', progress: 45.5 })
    const result = mapV1BookToCanonical(v1Book)
    expect(result.cover).toEqual({ original: 'https://x/full.jpg' })
    expect(result.progress).toEqual({ percentage: 45.5 })
  })

  test('B-B6: 非 object 輸入 → throw BookValidationError', () => {
    expect(() => mapV1BookToCanonical(null)).toThrow(BookValidationError)
    expect(() => mapV1BookToCanonical(123)).toThrow(BookValidationError)
    expect(() => mapV1BookToCanonical('string')).toThrow(BookValidationError)
  })

  test('B-B7: 缺 id 或 title → throw BookValidationError', () => {
    expect(() => mapV1BookToCanonical({ title: 'X' })).toThrow(BookValidationError)
    expect(() => mapV1BookToCanonical({ id: '1' })).toThrow(BookValidationError)
  })

  test('B-B8: 空 authors → tags.author 為 []', () => {
    const v1Book = makeV1Book({ authors: [] })
    expect(v1Book.id && v1Book.title).toBeTruthy()
    expect(v1Book.authors.length).toBe(0)

    const result = mapV1BookToCanonical(v1Book)
    expect(result.tags.author).toEqual([])
  })

  test('B-B9: 缺 source/publisher/isbn（undefined）→ 對應 tag 為 []', () => {
    const v1Book = makeV1Book({ source: undefined, publisher: undefined, identifiers: undefined })
    const result = mapV1BookToCanonical(v1Book)
    expect(result.tags.platform).toEqual([])
    expect(result.tags.publisher).toEqual([])
    expect(result.tags.isbn).toEqual([])
  })

  test('B-B10: readingStatus 缺值 → tags.readingStatus 為 []（不臆造）', () => {
    const v1Book = makeV1Book({ readingStatus: undefined })
    const result = mapV1BookToCanonical(v1Book)
    expect(result.tags.readingStatus).toEqual([])
  })
})

// =============================================================================
// Group C — read 映射（mapCanonicalToV1Book）+ 多值收斂 + normalize 子函式
// =============================================================================

describe('mapCanonicalToV1Book (Group C — read 映射 + 多值收斂)', () => {
  test('C-U11: tag → 固定欄位還原（單值）', () => {
    const canonical = makeCanonicalBook({
      tags: {
        author: [{ id: 'a1', name: '村上春樹' }],
        platform: [{ id: 'pl1', name: 'readmoo' }],
        publisher: [{ id: 'p1', name: '時報出版' }]
      }
    })
    expect(canonical.id && canonical.title).toBeTruthy()

    const result = mapCanonicalToV1Book(canonical)
    expect(result.authors).toEqual(['村上春樹'])
    expect(result.source).toBe('readmoo')
    expect(result.publisher).toBe('時報出版')
  })

  test('C-U12: readingStatus 逆正規化（not_started→unread）', () => {
    const canonical = makeCanonicalBook({
      tags: { readingStatus: [{ id: 'rs-not_started', name: 'not_started' }] }
    })
    const result = mapCanonicalToV1Book(canonical)
    expect(result.readingStatus).toBe('unread')
  })

  test('C-U13: tags.custom → tagIds 圖', () => {
    const canonical = makeCanonicalBook({
      tags: { custom: [{ id: 'c2', name: '送同事', path: '送禮清單/送同事' }] }
    })
    const result = mapCanonicalToV1Book(canonical)
    expect(result.tagIds).toContain('c2')
  })

  test('C-U14: cover/progress 還原', () => {
    const canonical = makeCanonicalBook({
      cover: { original: 'https://x/full.jpg' },
      progress: { percentage: 45.5 }
    })
    const result = mapCanonicalToV1Book(canonical)
    expect(result.cover).toBe('https://x/full.jpg')
    expect(result.progress).toBe(45.5)
  })

  test('C-U15: carry 類進 _passthrough（不丟失，C1）', () => {
    const canonical = makeCanonicalBook({
      tags: {
        author: [{ id: 'a1', name: '村上春樹' }],
        importance: [{ id: 'imp-4', name: '推薦分享' }],
        ccl: [{ id: 'ccl-861', name: '日本文學', path: '語言文學/東方文學/日本文學' }],
        description: [{ id: 'd1', name: '青春小說' }]
      },
      activeLoan: { dueDate: '2026-04-01' },
      crossPlatformId: 'cpid_x',
      dataFingerprint: 'fp_x',
      extensions: { book_overview_app: { apiEnriched: true } }
    })
    const result = mapCanonicalToV1Book(canonical)
    expect(result._passthrough.tags.importance).toEqual([{ id: 'imp-4', name: '推薦分享' }])
    expect(result._passthrough.tags.ccl).toEqual([{ id: 'ccl-861', name: '日本文學', path: '語言文學/東方文學/日本文學' }])
    expect(result._passthrough.tags.description).toEqual([{ id: 'd1', name: '青春小說' }])
    expect(result._passthrough.activeLoan).toEqual({ dueDate: '2026-04-01' })
    expect(result._passthrough.crossPlatformId).toBe('cpid_x')
    expect(result._passthrough.dataFingerprint).toBe('fp_x')
    expect(result._passthrough.extensions).toEqual({ book_overview_app: { apiEnriched: true } })
  })

  test('C-U18: 多值收斂（A）— platform/publisher/isbn 多元素', () => {
    const canonical = makeCanonicalBook({
      tags: {
        platform: [{ id: 'pl1', name: 'readmoo' }, { id: 'pl2', name: 'kobo' }],
        publisher: [{ id: 'p1', name: '時報' }, { id: 'p2', name: '新版社' }],
        isbn: [{ id: 'i1', name: 'ISBN-A' }, { id: 'i2', name: 'ISBN-B' }]
      }
    })
    expect(canonical.tags.platform.length).toBeGreaterThanOrEqual(2)

    const result = mapCanonicalToV1Book(canonical)
    expect(result.source).toBe('readmoo')
    expect(result.publisher).toBe('時報')
    expect(result.identifiers.isbn).toBe('ISBN-A')
    expect(result._passthrough.tags.platform).toEqual(canonical.tags.platform)
    expect(result._passthrough.tags.publisher).toEqual(canonical.tags.publisher)
    expect(result._passthrough.tags.isbn).toEqual(canonical.tags.isbn)
  })

  test('C-U19: cover 多尺寸收斂（A）', () => {
    const canonical = makeCanonicalBook({
      cover: { thumbnail: 't.jpg', medium: 'm.jpg', original: 'o.jpg' }
    })
    const result = mapCanonicalToV1Book(canonical)
    expect(result.cover).toBe('o.jpg')
    expect(result._passthrough.cover).toEqual({ thumbnail: 't.jpg', medium: 'm.jpg' })
  })

  test('C-U20: progress 多欄位收斂（A）', () => {
    const canonical = makeCanonicalBook({
      progress: { percentage: 45.5, currentPage: 120, totalPages: 265, lastReadAt: '2026-03-20T14:22:00.000Z' }
    })
    const result = mapCanonicalToV1Book(canonical)
    expect(result.progress).toBe(45.5)
    expect(result.progressInfo).toEqual({
      currentPage: 120,
      totalPages: 265,
      lastReadAt: '2026-03-20T14:22:00.000Z'
    })
  })

  test('C-U17: 多值作者不收斂（V1 即陣列）', () => {
    const canonical = makeCanonicalBook({
      tags: { author: [{ id: 'a1', name: '村上春樹' }, { id: 'a2', name: 'Haruki Murakami' }] }
    })
    const result = mapCanonicalToV1Book(canonical)
    // 主行為：author 多值全保留至 authors[]（不收斂為單值，§A author 例外）
    expect(result.authors).toEqual(['村上春樹', 'Haruki Murakami'])
    // C1 losslessness：author tag node 含 id，為使 canonical 出發 round-trip（D-U17）
    // 還原 tag id 無損，原始 author tag 陣列存入 _passthrough（write 端優先讀以重建 id）。
    // 設計 §A 原註「author 無需 passthrough」僅就「authors[] 不丟 name」而言；
    // tag id 的無損還原仍需 passthrough 承載（3b 實作期發現的 C1 補強，對齊 D-U17）。
    expect(result._passthrough.tags.author).toEqual(canonical.tags.author)
  })

  test('C-B11: 非 object / 缺 id-title → throw', () => {
    expect(() => mapCanonicalToV1Book(null)).toThrow(BookValidationError)
    expect(() => mapCanonicalToV1Book({ title: 'X' })).toThrow(BookValidationError)
    expect(() => mapCanonicalToV1Book({ id: '1' })).toThrow(BookValidationError)
  })

  test('C-B12: tags 類別缺漏 → 安全降級', () => {
    const canonical = makeCanonicalBook({ tags: {} })
    expect(canonical.id && canonical.title).toBeTruthy()
    expect(canonical.tags.author).toBeUndefined()

    const result = mapCanonicalToV1Book(canonical)
    expect(result.authors).toEqual([])
  })

  test('C-B13: read 端對未知 readingStatus 的防禦（F，非 V1 必經路徑）', () => {
    const canonical = makeCanonicalBook({
      tags: { readingStatus: [{ id: 'rs-x', name: 'archived_future' }] }
    })
    expect(normalizeReadingStatusFromCanonical('archived_future')).toBeNull()

    const result = mapCanonicalToV1Book(canonical)
    expect(result._passthrough.readingStatusRaw).toBe('archived_future')
    expect(result.readingStatus).toBeUndefined()
  })

  test('C-B16: read 端不丟棄多值/多欄位（U17 round-trip 前提）', () => {
    const canonical = makeCanonicalBook({
      tags: {
        platform: [{ id: 'pl1', name: 'readmoo' }, { id: 'pl2', name: 'kobo' }],
        publisher: [{ id: 'p1', name: '時報' }, { id: 'p2', name: '新版社' }],
        isbn: [{ id: 'i1', name: 'ISBN-A' }, { id: 'i2', name: 'ISBN-B' }]
      },
      cover: { thumbnail: 't.jpg', medium: 'm.jpg', original: 'o.jpg' }
    })
    const result = mapCanonicalToV1Book(canonical)
    expect(result._passthrough.tags.platform).toEqual(canonical.tags.platform)
    expect(result._passthrough.tags.publisher).toEqual(canonical.tags.publisher)
    expect(result._passthrough.tags.isbn).toEqual(canonical.tags.isbn)
    expect(result._passthrough.cover).toEqual({ thumbnail: 't.jpg', medium: 'm.jpg' })
  })
})

describe('normalizeReadingStatus 子函式（§7 雙向查表）', () => {
  test('C-N1: normalizeReadingStatusToCanonical 六態查表', () => {
    expect(normalizeReadingStatusToCanonical('unread')).toBe('not_started')
    expect(normalizeReadingStatusToCanonical('queued')).toBe('queued')
    expect(normalizeReadingStatusToCanonical('reading')).toBe('reading')
    expect(normalizeReadingStatusToCanonical('finished')).toBe('finished')
    expect(normalizeReadingStatusToCanonical('abandoned')).toBe('abandoned')
    expect(normalizeReadingStatusToCanonical('reference')).toBe('reference')
  })

  test('C-N2: normalizeReadingStatusToCanonical 未知值 → null', () => {
    expect(normalizeReadingStatusToCanonical('archived_future')).toBeNull()
    expect(normalizeReadingStatusToCanonical(undefined)).toBeNull()
  })

  test('C-N3: normalizeReadingStatusFromCanonical 逆查表', () => {
    expect(normalizeReadingStatusFromCanonical('not_started')).toBe('unread')
    expect(normalizeReadingStatusFromCanonical('queued')).toBe('queued')
    expect(normalizeReadingStatusFromCanonical('reading')).toBe('reading')
    expect(normalizeReadingStatusFromCanonical('finished')).toBe('finished')
    expect(normalizeReadingStatusFromCanonical('abandoned')).toBe('abandoned')
    expect(normalizeReadingStatusFromCanonical('reference')).toBe('reference')
  })

  test('C-N4: normalizeReadingStatusFromCanonical 未知值 → null', () => {
    expect(normalizeReadingStatusFromCanonical('archived_future')).toBeNull()
    expect(normalizeReadingStatusFromCanonical(undefined)).toBeNull()
  })
})

// =============================================================================
// Group D — 雙向可逆 round-trip（C1）+ tagTree 聚合
// =============================================================================

describe('round-trip 雙向可逆 (Group D)', () => {
  test('D-U16: V1 出發 round-trip（V1→canonical→V1，無損）', () => {
    const v1Book = makeV1Book({
      id: 'b-016',
      title: '海邊的卡夫卡',
      authors: ['村上春樹', 'Haruki Murakami'],
      source: 'readmoo',
      publisher: '時報出版',
      identifiers: { isbn: '9789571234567' },
      readingStatus: 'unread',
      tagIds: ['tag_a-001'],
      cover: 'https://x/full.jpg',
      progress: 45.5,
      createdAt: '2026-01-15T08:30:00.000Z',
      updatedAt: '2026-03-20T14:22:00.000Z'
    })
    expect(v1Book.id && v1Book.title).toBeTruthy()

    const canonical = mapV1BookToCanonical(v1Book)
    const result = mapCanonicalToV1Book(canonical)

    expect(result.id).toBe(v1Book.id)
    expect(result.title).toBe(v1Book.title)
    expect(result.authors).toEqual(v1Book.authors)
    expect(result.source).toBe(v1Book.source)
    expect(result.publisher).toBe(v1Book.publisher)
    expect(result.identifiers.isbn).toBe(v1Book.identifiers.isbn)
    expect(result.readingStatus).toBe('unread')
    expect(result.tagIds).toEqual(v1Book.tagIds)
    expect(result.cover).toBe(v1Book.cover)
    expect(result.progress).toBe(v1Book.progress)
    expect(result.createdAt).toBe(v1Book.createdAt)
    expect(result.updatedAt).toBe(v1Book.updatedAt)
  })

  test('D-U17: canonical 出發 round-trip（canonical→V1→canonical，APP→Ext→APP 真實路徑，A）', () => {
    const canonical = makeCanonicalBook({
      id: 'b-017',
      title: '挪威的森林',
      tags: {
        author: [{ id: 'a1', name: '村上春樹' }, { id: 'a2', name: 'Haruki Murakami' }],
        platform: [{ id: 'pl1', name: 'readmoo' }, { id: 'pl2', name: 'kobo' }],
        publisher: [{ id: 'p1', name: '時報' }, { id: 'p2', name: '新版社' }],
        isbn: [{ id: 'i1', name: 'ISBN-A' }, { id: 'i2', name: 'ISBN-B' }],
        readingStatus: [{ id: 'rs-reading', name: 'reading' }],
        importance: [{ id: 'imp-4', name: '推薦分享' }],
        ccl: [{ id: 'ccl-861', name: '日本文學', path: '語言文學/東方文學/日本文學' }]
      },
      cover: { thumbnail: 't.jpg', medium: 'm.jpg', original: 'o.jpg' }
    })
    expect(canonical.tags.platform.length).toBeGreaterThanOrEqual(2)

    const v1 = mapCanonicalToV1Book(canonical)
    const result = mapV1BookToCanonical(v1)

    expect(result.tags.platform).toEqual(canonical.tags.platform)
    expect(result.tags.publisher).toEqual(canonical.tags.publisher)
    expect(result.tags.isbn).toEqual(canonical.tags.isbn)
    expect(result.tags.author).toEqual(canonical.tags.author)
    expect(result.cover).toEqual(canonical.cover)
    expect(result.tags.importance).toEqual(canonical.tags.importance)
    expect(result.tags.ccl).toEqual(canonical.tags.ccl)
    expect(result.tags.readingStatus).toEqual(canonical.tags.readingStatus)
  })

  test('D-B14: §7 正規化可逆（六態各驗一次）', () => {
    const statuses = ['unread', 'queued', 'reading', 'finished', 'abandoned', 'reference']
    statuses.forEach((s) => {
      const canonicalName = normalizeReadingStatusToCanonical(s)
      expect(normalizeReadingStatusFromCanonical(canonicalName)).toBe(s)
    })
  })

  test('D-B15: 非 V1 來源未知 readingStatus 經 _passthrough.readingStatusRaw 可還原（F）', () => {
    const canonical = makeCanonicalBook({
      tags: { readingStatus: [{ id: 'rs-x', name: 'archived_future' }] }
    })
    const v1 = mapCanonicalToV1Book(canonical)
    const result = mapV1BookToCanonical(v1)
    expect(result.tags.readingStatus[0].name).toBe('archived_future')
  })
})

describe('buildTagTree (Group D — tagTree 聚合，spec §6)', () => {
  test('D-U21: buildTagTree 多 book 聚合 + path 推導 parentId + 去重', () => {
    const books = [
      makeCanonicalBook({
        id: 'a',
        tags: {
          ccl: [{ id: 'ccl-861', name: '日本文學', path: '語言文學/東方文學/日本文學' }],
          custom: [{ id: 'c2', name: '送同事', path: '送禮清單/送同事' }]
        }
      }),
      makeCanonicalBook({
        id: 'b',
        tags: {
          ccl: [{ id: 'ccl-861', name: '日本文學', path: '語言文學/東方文學/日本文學' }],
          custom: [{ id: 'c3', name: '送家人', path: '送禮清單/送家人' }]
        }
      })
    ]
    expect(Array.isArray(books)).toBe(true)

    const result = buildTagTree(books)

    // ccl 階層節點：語言文學/東方文學/日本文學
    const cclNames = result.ccl.map((n) => n.name)
    expect(cclNames).toContain('語言文學')
    expect(cclNames).toContain('東方文學')
    expect(cclNames).toContain('日本文學')

    const dongfang = result.ccl.find((n) => n.name === '東方文學')
    const riben = result.ccl.find((n) => n.name === '日本文學')
    expect(riben.parentId).toBe(dongfang.id)
    const yuyan = result.ccl.find((n) => n.name === '語言文學')
    expect(yuyan.parentId).toBeNull()

    // 同 id 去重（ccl-861 出現於 bookA/bookB 只一個葉節點）
    const leaf861 = result.ccl.filter((n) => n.id === 'ccl-861')
    expect(leaf861).toHaveLength(1)

    // custom：送禮清單(頂層)/送同事/送家人
    const customNames = result.custom.map((n) => n.name)
    expect(customNames).toContain('送禮清單')
    expect(customNames).toContain('送同事')
    expect(customNames).toContain('送家人')
    const songli = result.custom.find((n) => n.name === '送禮清單')
    expect(songli.parentId).toBeNull()
    const songtongshi = result.custom.find((n) => n.name === '送同事')
    expect(songtongshi.parentId).toBe(songli.id)
  })

  test('D-U22: ccl/custom locked 標記', () => {
    const books = [
      makeCanonicalBook({
        tags: {
          ccl: [{ id: 'ccl-861', name: '日本文學', path: '語言文學/東方文學/日本文學' }],
          custom: [{ id: 'c2', name: '送同事', path: '送禮清單/送同事' }]
        }
      })
    ]
    const result = buildTagTree(books)
    expect(result.ccl.every((n) => n.locked === true)).toBe(true)
    expect(result.custom.every((n) => n.locked === false)).toBe(true)
  })

  test('D-B17: books 非陣列 → 安全降級', () => {
    expect(buildTagTree(null)).toEqual({ ccl: [], custom: [] })
    expect(buildTagTree(undefined)).toEqual({ ccl: [], custom: [] })
    expect(buildTagTree({})).toEqual({ ccl: [], custom: [] })
    expect(buildTagTree('string')).toEqual({ ccl: [], custom: [] })
  })

  test('D-B18: book 無 ccl/custom tag → 對應樹為 []', () => {
    const books = [makeCanonicalBook({ tags: {} })]
    const result = buildTagTree(books)
    expect(result.ccl).toEqual([])
    expect(result.custom).toEqual([])
  })
})
